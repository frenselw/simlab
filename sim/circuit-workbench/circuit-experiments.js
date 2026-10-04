(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry.js'):root.CircuitRegistry,node?require('./circuit-math.js'):root.CircuitMath);
  if(node)module.exports=api;else root.CircuitExperiments=api;
})(globalThis,function(R,Q){
  'use strict';
  const limit=200,empty=()=>({voltage:null,current:null,axis:'IU',fit:false,rows:[]});
  const state=doc=>doc.measurements||empty();
  const object=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new Error('量測資料欄位無效');};
  function validate(data,components){
    object(data,['voltage','current','axis','fit','rows']);
    for(const [key,types]of [['voltage',['voltmeter']],['current',['ammeter','galvanometer']]])if(data[key]!==null&&!components.some(c=>c.id===data[key]&&types.includes(c.type)))throw new Error('量測來源不是有效電表');
    if(!['IU','UI'].includes(data.axis)||typeof data.fit!=='boolean'||!Array.isArray(data.rows)||data.rows.length>limit)throw new Error('量測圖設定或筆數無效');
    for(const row of data.rows){
      object(row,['u','i','uLabel','iLabel','uRange','iRange','uStatus','iStatus']);
      if(![row.u,row.i].every(Number.isFinite)||![row.uRange,row.iRange].every(v=>Number.isFinite(v)&&v>0))throw new Error('量測數值或量程無效');
      for(const key of ['uLabel','iLabel'])if(typeof row[key]!=='string'||row[key].length>40)throw new Error('量測來源名稱無效');
      for(const key of ['uStatus','iStatus'])if(!['normal','reverse','overrange'].includes(row[key]))throw new Error('量測狀態無效');
    }
    return data;
  }
  function record(doc,analysis,voltage,current){
    const sources=[doc.components.find(c=>c.id===voltage&&c.type==='voltmeter'),doc.components.find(c=>c.id===current&&['ammeter','galvanometer'].includes(c.type))];
    if(sources.some(c=>!c))throw new Error('先選擇電壓表和電流表／G 表');
    const [u,i]=sources.map(c=>analysis.components[c.id]);
    if(![u?.reading,i?.reading].every(Number.isFinite))throw new Error('讀值未能確定，請先檢查電表接線');
    const data=doc.measurements||(doc.measurements=empty());
    if(data.rows.length>=limit)throw new Error('已達 200 筆；先刪除部分紀錄或匯出 CSV');
    data.voltage=voltage;data.current=current;
    data.rows.push({u:u.reading,i:i.reading,uLabel:sources[0].label,iLabel:sources[1].label,uRange:u.range,iRange:i.range,uStatus:u.meterStatus,iStatus:i.meterStatus});
    validate(data,doc.components);return data.rows.at(-1);
  }
  // Least squares uses the measured values, including meter loading and polarity.
  function fit(rows,axis){
    rows=rows.filter(r=>r.uStatus!=='overrange'&&r.iStatus!=='overrange');
    if(rows.length<2)return null;
    const points=rows.map(r=>axis==='UI'?{x:r.i,y:r.u}:{x:r.u,y:r.i}),mx=points.reduce((s,p)=>s+p.x,0)/points.length,my=points.reduce((s,p)=>s+p.y,0)/points.length;
    const xx=points.reduce((s,p)=>s+(p.x-mx)**2,0);if(xx<=Number.EPSILON*Math.max(1e-20,...points.map(p=>p.x**2)))return null;
    const slope=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/xx,intercept=my-slope*mx,ss=points.reduce((s,p)=>s+(p.y-my)**2,0),error=points.reduce((s,p)=>s+(p.y-intercept-slope*p.x)**2,0);
    return{slope,intercept,rSquared:ss===0?1:Math.max(0,1-error/ss)};
  }
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function plot(data,suffix='main'){
    const clipId='measurement-plot-clip-'+(suffix==='detail'?'detail':'main');
    const rows=data.rows,UI=data.axis==='UI',maximum=Math.max(0,...rows.map(r=>Math.abs(r.i))),factor=maximum>0&&maximum<.001?1e6:maximum>0&&maximum<1?1e3:1,unit=factor===1e6?'μA':factor===1e3?'mA':'A';
    const points=rows.map(r=>UI?{x:r.i*factor,y:r.u}:{x:r.u,y:r.i*factor});
    const bounds=key=>{const values=points.map(p=>p[key]),lo=Math.min(0,...values),hi=Math.max(0,...values),span=hi-lo||1;return[lo-span*.08,hi+span*.12];};
    const [xmin,xmax]=bounds('x'),[ymin,ymax]=bounds('y'),x=v=>55+(v-xmin)/(xmax-xmin)*220,y=v=>205-(v-ymin)/(ymax-ymin)*165;
    const axes=[{text:'U / V',tex:'U\\,/\\,\\mathrm{V}'},{text:'I / '+unit,tex:'I\\,/\\,'+Q.unit(unit).tex}];
    let out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 255" role="img" aria-label="'+(UI?'電壓隨電流':'電流隨電壓')+'量測圖"><rect width="320" height="255" fill="#fff"/>';
    for(let n=0;n<=4;n++){
      const vx=xmin+(xmax-xmin)*n/4,vy=ymin+(ymax-ymin)*n/4;
      out+=`<path d="M${x(vx)} 40V205 M55 ${y(vy)}H275" stroke="#e5ebf0" stroke-width="1"/>`+Q.svg(x(vx),223,Q.quantity(vx),12)+Q.svg(47,y(vy)+3,Q.quantity(vy),12,'text-anchor="end"');
    }
    out+=`<path d="M55 40V205H275" stroke="#667b8e" fill="none"/>`+Q.svg(165,248,UI?axes[1]:axes[0],12)+Q.svg(165,23,UI?axes[0]:axes[1],12);
    const line=data.fit?fit(rows,data.axis):null;
    if(line){const original=UI?points.map(p=>({x:p.x/factor,y:p.y})):points.map(p=>({x:p.x,y:p.y/factor})),lo=Math.min(...original.map(p=>p.x)),hi=Math.max(...original.map(p=>p.x));out+=`<defs><clipPath id="${clipId}"><rect x="55" y="40" width="220" height="165"/></clipPath></defs><path data-measurement-fit="true" clip-path="url(#${clipId})" d="M${x(UI?lo*factor:lo)} ${y((line.intercept+line.slope*lo)*(UI?1:factor))}L${x(UI?hi*factor:hi)} ${y((line.intercept+line.slope*hi)*(UI?1:factor))}" stroke="#e29a35" stroke-width="2" fill="none"/>`;}
    points.forEach((p,n)=>{out+=`<circle data-measurement-point="${n}" cx="${x(p.x)}" cy="${y(p.y)}" r="3.5" fill="${rows[n].uStatus==='overrange'||rows[n].iStatus==='overrange'?'#be6b24':'#2563eb'}"><title>${escape('第 '+(n+1)+' 筆：'+Q.quantity(rows[n].u,'V').text+'，'+Q.quantity(rows[n].i,'A').text)}</title></circle>`;});
    return out+'</svg>';
  }
  function csv(data){
    const cell=v=>'"'+String(typeof v==='string'&&/^[\s]*[=+\-@]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
    return '\uFEFF'+[['序號','U (V)','I (A)','電壓表','電流表','電壓量程 (V)','電流量程 (A)','電壓狀態','電流狀態'],...data.rows.map((r,n)=>[n+1,r.u,r.i,r.uLabel,r.iLabel,r.uRange,r.iRange,r.uStatus,r.iStatus])].map(row=>row.map(cell).join(',')).join('\r\n');
  }
  return{limit,empty,state,validate,record,fit,plot,csv};
});
