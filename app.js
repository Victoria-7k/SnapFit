(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const images=[];
  let busy=false,draggedId=null,currentLayout=ReportLayout.computeLayout(images);
  const emptyMarkup=$('pages').innerHTML;
  function status(message,error=false){
    $('status').textContent=message;$('status').hidden=!message;$('status').classList.toggle('error',error);
  }
  function setBusy(value){
    busy=value;
    $('file-input').disabled=value;$('drop-zone').disabled=value;$('clear-button').disabled=value;
    $('export-button').disabled=value||!images.length||!!currentLayout.errors.length;
    $('image-list').querySelectorAll('button').forEach(button=>button.disabled=value||button.dataset.boundary==='true');
    $('image-list').querySelectorAll('li').forEach(item=>item.draggable=!value);
  }
  function render(){
    currentLayout=ReportLayout.computeLayout(images);
    $('image-count').textContent=`${images.length} 张`;
    $('summary-images').textContent=images.length;$('summary-pages').textContent=currentLayout.pages.length;
    $('list-toolbar').hidden=!images.length;$('order-hint').hidden=!images.length;
    const list=$('image-list');list.replaceChildren();
    images.forEach((image,index)=>{
      const item=document.createElement('li');item.className='image-item';item.draggable=!busy;item.dataset.id=image.id;item.id=`image-${image.id}`;
      if(currentLayout.errors.some(error=>error.index===index))item.classList.add('has-error');
      item.title=`${index+1}. ${image.name} (${image.width} × ${image.height})`;
      const wrap=document.createElement('div');wrap.className='thumb-wrap';
      const img=document.createElement('img');img.src=image.url;img.alt=image.name;img.draggable=false;
      const number=document.createElement('span');number.className='image-number';number.textContent=index+1;
      wrap.append(img,number);
      const actions=document.createElement('div');actions.className='thumb-actions';
      [['←','前移',()=>move(index,index-1),index===0],['→','后移',()=>move(index,index+1),index===images.length-1],['×','删除',()=>remove(index),false]].forEach(([symbol,label,fn,boundary])=>{
        const button=document.createElement('button');button.type='button';button.textContent=symbol;button.title=`${label}第 ${index+1} 张：${image.name}`;button.setAttribute('aria-label',button.title);button.dataset.boundary=String(boundary);button.disabled=busy||boundary;
        if(symbol==='×')button.className='remove';button.addEventListener('click',fn);actions.append(button);
      });
      item.append(wrap,actions);list.append(item);
    });
    const problems=$('problems');problems.replaceChildren();problems.hidden=!currentLayout.errors.length;
    if(currentLayout.errors.length){
      const p=document.createElement('p');p.textContent='以下图片超出排版范围，处理后即可预览并导出：';problems.append(p);
      const ul=document.createElement('ul');
      currentLayout.errors.forEach(error=>{
        const li=document.createElement('li'),link=document.createElement('a');link.href=`#image-${images[error.index].id}`;link.textContent=`第 ${error.index+1} 张 · ${images[error.index].name}`;li.append(link,document.createTextNode(`：${error.message}`));ul.append(li);
      });problems.append(ul);
    }
    const pages=$('pages');pages.replaceChildren();
    if(!images.length)pages.innerHTML=emptyMarkup;
    currentLayout.pages.forEach((page,index)=>{
      const wrap=document.createElement('section');wrap.className='page-wrap';wrap.setAttribute('aria-label',`第 ${index+1} 页`);
      const caption=document.createElement('div');caption.className='page-caption';
      const title=document.createElement('strong');title.textContent=`第 ${String(index+1).padStart(2,'0')} 页`;
      const detail=document.createElement('span');detail.textContent=`${page.items.length} 张图片 · ${page.rows} 行`;caption.append(title,detail);
      const sheet=document.createElement('div');sheet.className='sheet';
      page.items.forEach(item=>{
        const img=document.createElement('img');img.className='sheet-image';img.src=images[item.index].url;img.alt=`第 ${item.index+1} 张：${images[item.index].name}`;img.title=img.alt;img.draggable=false;
        img.style.left=`${item.x/176*100}%`;img.style.top=`${item.y/250*100}%`;img.style.width=`${item.width/176*100}%`;img.style.height=`${item.height/250*100}%`;sheet.append(img);
      });wrap.append(caption,sheet);pages.append(wrap);
    });
    setBusy(busy);
  }
  function move(from,to){if(busy||from===to||to<0||to>=images.length)return;images.splice(to,0,images.splice(from,1)[0]);status('');render();}
  function remove(index){if(busy)return;URL.revokeObjectURL(images[index].url);images.splice(index,1);status('');render();}
  async function addFiles(files){
    if(busy)return;
    const selected=Array.from(files);if(!selected.length)return;
    setBusy(true);const failed=[];let added=0;
    try{
      for(let index=0;index<selected.length;index++){
        const file=selected[index];
        status(`正在读取图片 ${index+1} / ${selected.length}…`);
        if(!/^image\/(jpeg|png|webp)$/i.test(file.type)&&!(/\.(jpe?g|png|webp)$/i.test(file.name)&&!file.type)){failed.push(`${file.name}：请使用 JPG、PNG 或 WebP`);continue;}
        const url=URL.createObjectURL(file);
        try{
          const img=new Image();img.src=url;await img.decode();
          if(!img.naturalWidth||!img.naturalHeight)throw new Error('empty image');
          images.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`,name:file.name,url,width:img.naturalWidth,height:img.naturalHeight});added++;
        }catch{URL.revokeObjectURL(url);failed.push(`${file.name}：图片读取失败，请检查文件`);}
      }
    }finally{
      busy=false;render();
      status(failed.length?`已添加 ${added} 张。以下文件未添加：\n${failed.join('\n')}`:`已添加 ${added} 张图片，排版已更新。`,!!failed.length);
      $('file-input').value='';
    }
  }
  $('file-input').addEventListener('change',event=>addFiles(event.target.files));
  $('drop-zone').addEventListener('click',()=>$('file-input').click());
  ['dragenter','dragover'].forEach(type=>$('drop-zone').addEventListener(type,event=>{event.preventDefault();if(!busy)$('drop-zone').classList.add('is-over');}));
  $('drop-zone').addEventListener('dragleave',()=>$('drop-zone').classList.remove('is-over'));
  $('drop-zone').addEventListener('drop',event=>{event.preventDefault();$('drop-zone').classList.remove('is-over');addFiles(event.dataTransfer.files);});
  // Keep a dropped file from replacing the application page.
  window.addEventListener('dragover',event=>event.preventDefault());
  window.addEventListener('drop',event=>event.preventDefault());
  $('clear-button').addEventListener('click',()=>{if(busy)return;images.forEach(image=>URL.revokeObjectURL(image.url));images.length=0;status('');render();});
  $('image-list').addEventListener('dragstart',event=>{
    const item=event.target.closest('.image-item');if(!item||busy){event.preventDefault();return;}
    draggedId=item.dataset.id;event.dataTransfer.setData('text/plain',draggedId);event.dataTransfer.effectAllowed='move';item.classList.add('is-dragging');
  });
  $('image-list').addEventListener('dragover',event=>{
    const item=event.target.closest('.image-item');if(!item||!draggedId||busy)return;event.preventDefault();event.dataTransfer.dropEffect='move';
    $('image-list').querySelectorAll('.is-target').forEach(target=>target.classList.remove('is-target'));item.classList.add('is-target');
  });
  $('image-list').addEventListener('drop',event=>{
    const item=event.target.closest('.image-item');if(!item||!draggedId||busy)return;event.preventDefault();
    const from=images.findIndex(image=>image.id===draggedId),to=images.findIndex(image=>image.id===item.dataset.id);draggedId=null;if(from>=0&&to>=0)move(from,to);
  });
  $('image-list').addEventListener('dragend',()=>{draggedId=null;$('image-list').querySelectorAll('.is-dragging,.is-target').forEach(item=>item.classList.remove('is-dragging','is-target'));});
  $('export-button').addEventListener('click',async()=>{
    if(busy||!images.length||currentLayout.errors.length)return;
    setBusy(true);
    try{
      const blob=await ReportPdf.createPdf(images,currentLayout,(done,total)=>{$('export-label').textContent=`正在导出 ${done} / ${total}`;});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='实验报告图片_B5.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status(`已导出 ${currentLayout.pages.length} 页 PDF，共 ${images.length} 张图片。打印时请选择 B5 和「实际大小 / 100%」。`);
    }catch(error){status(`导出失败：${error.message} 请重试。`,true);}
    finally{$('export-label').textContent='导出 PDF';setBusy(false);}
  });
  render();
})();
