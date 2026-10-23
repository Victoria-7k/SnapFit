/* Standalone image-only PDF writer. No network, fonts, or third-party scripts. */
(function(root){
  'use strict';
  const encoder=new TextEncoder();
  const bytes=s=>encoder.encode(s);
  const mm=v=>(v*72/25.4).toFixed(6);
  function stream(dictionary,data){
    return [bytes(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),data,bytes('\nendstream')];
  }
  async function prepareImage(image){
    const img=new Image();
    img.src=image.url;
    await img.decode();
    // 600 dpi at the physical output width; small originals keep their resolution.
    const target=Math.ceil(ReportLayout.computeLayout([]).imageWidth/25.4*600);
    const scale=Math.min(1,target/img.naturalWidth);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const context=canvas.getContext('2d');
    if(!context) throw new Error('浏览器无法创建图片画布。');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片转换失败。')),'image/jpeg',.97));
    const result={width:canvas.width,height:canvas.height,data:new Uint8Array(await blob.arrayBuffer())};
    canvas.width=1;canvas.height=1;
    return result;
  }
  async function createPdf(images,layout,onProgress=()=>{}){
    if(layout.errors.length||!layout.pages.length) throw new Error('请先添加可排版的图片。');
    const objects=[null,null],pageIds=[];
    const add=parts=>{objects.push(parts);return objects.length;};
    let completed=0;
    for(const page of layout.pages){
      const resources=[],commands=[];
      for(const item of page.items){
        onProgress(completed,images.length);
        const picture=await prepareImage(images[item.index]);
        const id=add(stream(`/Type /XObject /Subtype /Image /Width ${picture.width} /Height ${picture.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,picture.data));
        const name=`Im${resources.length}`;
        resources.push(`/${name} ${id} 0 R`);
        commands.push(`q\n${mm(item.width)} 0 0 ${mm(item.height)} ${mm(item.x)} ${mm(ReportLayout.RULES.pageHeight-item.y-item.height)} cm\n/${name} Do\nQ`);
        completed++;
      }
      const contentId=add(stream('',bytes(commands.join('\n'))));
      const pageId=add([bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mm(176)} ${mm(250)}] /Resources << /XObject << ${resources.join(' ')} >> >> /Contents ${contentId} 0 R >>`)]);
      pageIds.push(pageId);
    }
    objects[0]=[bytes('<< /Type /Catalog /Pages 2 0 R >>')];
    objects[1]=[bytes(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)];
    const chunks=[bytes('%PDF-1.4\n%'),new Uint8Array([0xe2,0xe3,0xcf,0xd3,10])],offsets=[0];
    let length=chunks.reduce((sum,chunk)=>sum+chunk.length,0);
    const push=part=>{chunks.push(part);length+=part.length;};
    objects.forEach((parts,index)=>{
      offsets.push(length);push(bytes(`${index+1} 0 obj\n`));parts.forEach(push);push(bytes('\nendobj\n'));
    });
    const xref=length;
    push(bytes(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    onProgress(completed,images.length);
    return new Blob(chunks,{type:'application/pdf'});
  }
  root.ReportPdf={createPdf};
})(window);
