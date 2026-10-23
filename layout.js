/* Physical layout shared by the screen preview and PDF exporter. All units: mm. */
(function (root) {
  'use strict';
  const RULES = Object.freeze({pageWidth:176,pageHeight:250,margin:10,gap:10,columns:3});
  function computeLayout(images) {
    const r=RULES, width=(r.pageWidth-2*r.margin-(r.columns-1)*r.gap)/r.columns;
    const usableHeight=r.pageHeight-2*r.margin;
    const heights=images.map(image=>width*image.height/image.width);
    const errors=[];
    heights.forEach((height,index)=>{
      if(!Number.isFinite(height)||height<=0) errors.push({index,message:'图片尺寸无效，请删除后重新添加。'});
      else if(height>usableHeight+1e-8) errors.push({index,message:`按统一宽度缩放后高 ${height.toFixed(1)} mm，超过单页可用高度 ${usableHeight} mm，请移除或更换该图。`});
    });
    if(errors.length) return {pages:[],errors,imageWidth:width};
    const pages=[];
    let page=null, top=r.margin;
    for(let start=0;start<images.length;start+=r.columns){
      const rowHeight=Math.max(...heights.slice(start,start+r.columns));
      if(!page||top+rowHeight>r.pageHeight-r.margin+1e-8){
        page={items:[],rows:0};pages.push(page);top=r.margin;
      }
      for(let col=0;col<r.columns&&start+col<images.length;col++){
        const index=start+col;
        page.items.push({index,x:r.margin+col*(width+r.gap),y:top,width,height:heights[index]});
      }
      page.rows++;top+=rowHeight+r.gap;
    }
    return {pages,errors,imageWidth:width};
  }
  root.ReportLayout={RULES,computeLayout};
  if(typeof module!=='undefined'&&module.exports) module.exports=root.ReportLayout;
})(typeof window!=='undefined'?window:globalThis);
