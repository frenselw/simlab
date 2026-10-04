(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry.js'):root.CircuitRegistry,node?require('./circuit-math.js'):root.CircuitMath);
  if(node)module.exports=api;else root.CircuitExperiments=api;
})(globalThis,function(R,Q){
  'use strict';
  const models=['linear','proportional','inverse','quadratic'];
  const limit=200,empty=()=>({voltage:null,current:null,axis:'IU',fit:false,fitModel:'linear',rows:[]});
  const state=doc=>doc.measurements||empty();
  const object=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new Error('量測資料欄位無效');};
  function validate(data,components){
    object(data,['voltage','current','axis','fit','fitModel','rows']);
    if(Object.hasOwn(data,'fitModel')&&!models.includes(data.fitModel))throw new Error('擬合模型無效');
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
  const validRows=rows=>rows.filter(r=>r.uStatus!=='overrange'&&r.iStatus!=='overrange');
  const coordinates=(rows,axis)=>rows.map(r=>axis==='UI'?{x:r.i,y:r.u}:{x:r.u,y:r.i});
  // QR on centered, scaled x avoids squaring the conditioning of a polynomial.
  function polynomial(points,degree,center,scale){
    const q=[],r=Array.from({length:degree+1},()=>[]),target=[];
    for(let j=0;j<=degree;j++){
      let v=points.map(p=>((p.x-center)/scale)**j);
      for(let k=0;k<j;k++){r[k][j]=v.reduce((s,value,n)=>s+q[k][n]*value,0);v=v.map((value,n)=>value-r[k][j]*q[k][n]);}
      const norm=Math.hypot(...v);if(norm<1e-10)return null;
      r[j][j]=norm;q[j]=v.map(value=>value/norm);target[j]=q[j].reduce((s,value,n)=>s+value*points[n].y,0);
    }
    const terms=[];for(let j=degree;j>=0;j--)terms[j]=(target[j]-terms.reduce((s,value,k)=>s+(k>j?r[j][k]*value:0),0))/r[j][j];
    const roundoff=64*Number.EPSILON*Math.max(...points.map(p=>Math.abs(p.y)));
    return terms.map(v=>Math.abs(v)<=roundoff?0:v);
  }
  function predict(result,x){
    if(result.model==='inverse')return x===0?NaN:result.coefficients[0]/x;
    if(result.model==='proportional')return result.coefficients[0]*x;
    const z=(x-result.center)/result.scale;
    return result.terms.reduceRight((value,coefficient)=>value*z+coefficient,0);
  }
  // All models use original SI readings, including loading and signed polarity.
  function fit(rows,axis,model='linear'){
    if(!models.includes(model))return null;
    const points=coordinates(validRows(rows),axis).filter(p=>model!=='inverse'||p.x!==0),degree=model==='quadratic'?2:1;
    if(points.length<degree+1||new Set(points.map(p=>p.x)).size<degree+1)return null;
    const center=points.reduce((s,p)=>s+p.x,0)/points.length,scale=Math.max(...points.map(p=>Math.abs(p.x-center)));
    let result={model,used:points.length,excluded:rows.length-points.length,center,scale};
    if(model==='inverse'||model==='proportional'){
      const basis=points.map(p=>model==='inverse'?1/p.x:p.x),largest=Math.max(...basis.map(Math.abs));
      if(!Number.isFinite(largest)||largest===0)return null;
      const z=basis.map(v=>v/largest),coefficient=z.reduce((s,v,n)=>s+v*points[n].y,0)/z.reduce((s,v)=>s+v*v,0)/largest;
      result.coefficients=[coefficient];
    }else{
      const terms=polynomial(points,degree,center,scale);if(!terms)return null;result.terms=terms;
      if(model==='linear'){const slope=terms[1]/scale,intercept=terms[0]-slope*center;Object.assign(result,{slope,intercept,coefficients:[slope,intercept]});}
      else{const a=terms[2]/scale**2,b=terms[1]/scale-2*a*center,c=terms[0]-terms[1]*center/scale+a*center**2;result.coefficients=[a,b,c];}
    }
    if(!result.coefficients.every(Number.isFinite))return null;
    const my=points.reduce((s,p)=>s+p.y,0)/points.length,ss=points.reduce((s,p)=>s+(p.y-my)**2,0),error=points.reduce((s,p)=>s+(p.y-predict(result,p.x))**2,0),energy=points.reduce((s,p)=>s+p.y*p.y,0);
    if(!Number.isFinite(error)||!Number.isFinite(ss))return null;
    result.rSquared=ss===0?(error<=64*Number.EPSILON**2*Math.max(Number.MIN_VALUE,energy)?1:null):1-error/ss;
    return result;
  }
  function formula(result,axis){
    const x=axis==='UI'?'I':'U',y=axis==='UI'?'U':'I',a=result.coefficients,n=Q.numberTex;
    const term=(value,symbol)=>`${value<0?'-':'+'}${n(Math.abs(value))}${symbol?'\\,'+symbol:''}`;
    const quadratic=a.map((value,index)=>({value,symbol:index===0?x+'^2':index===1?x:''})).filter(t=>t.value!==0);
    const rhs=result.model==='inverse'?`\\frac{${n(a[0])}}{${x}}`:result.model==='quadratic'?(quadratic.map((t,index)=>index?term(t.value,t.symbol):n(t.value)+(t.symbol?'\\,'+t.symbol:'')).join('')||'0'):`${n(a[0])}\\,${x}${result.model==='linear'?term(a[1],''):''}`;
    return{text:`${y} = ${result.model==='inverse'?Q.number(a[0])+'/'+x:result.model==='quadratic'?Q.number(a[0])+' '+x+'² '+(a[1]<0?'−':'+')+' '+Q.number(Math.abs(a[1]))+' '+x+' '+(a[2]<0?'−':'+')+' '+Q.number(Math.abs(a[2])):Q.number(a[0])+' '+x+(result.model==='linear'?' '+(a[1]<0?'−':'+')+' '+Q.number(Math.abs(a[1])):'')}`,tex:y+'='+rhs};
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
    out+=`<path d="M55 40V205H275" stroke="#667b8e" fill="none"/>`+'<g data-measurement-axis="x">'+Q.svg(165,248,UI?axes[1]:axes[0],12)+'</g><g data-measurement-axis="y">'+Q.svg(55,23,UI?axes[0]:axes[1],12,'text-anchor="start"')+'</g>';
    const line=data.fit?fit(rows,data.axis,data.fitModel||'linear'):null;
    if(line){
      const original=coordinates(validRows(rows),data.axis).filter(p=>line.model!=='inverse'||p.x!==0),lo=Math.min(...original.map(p=>p.x)),hi=Math.max(...original.map(p=>p.x));
      let path='',previous=null;
      for(let n=0;n<=160;n++){
        const vx=lo+(hi-lo)*n/160,value=predict(line,vx);
        if(!Number.isFinite(value)||line.model==='inverse'&&Math.abs(vx)<(hi-lo)*1e-8){previous=null;continue;}
        const start=previous===null||line.model==='inverse'&&vx*previous<0;
        path+=(start?'M':'L')+x(UI?vx*factor:vx)+' '+Math.max(-4096,Math.min(4096,y(value*(UI?1:factor))));previous=vx;
      }
      out+=`<defs><clipPath id="${clipId}"><rect x="55" y="40" width="220" height="165"/></clipPath></defs><path data-measurement-fit="true" data-fit-model="${line.model}" clip-path="url(#${clipId})" d="${path}" stroke="#8956b4" stroke-width="2" fill="none"/>`;
    }
    points.forEach((p,n)=>{out+=`<circle data-measurement-point="${n}" cx="${x(p.x)}" cy="${y(p.y)}" r="3.5" fill="${rows[n].uStatus==='overrange'||rows[n].iStatus==='overrange'?'#be6b24':'#2563eb'}"><title>${escape('第 '+(n+1)+' 筆：'+Q.quantity(rows[n].u,'V').text+'，'+Q.quantity(rows[n].i,'A').text)}</title></circle>`;});
    return out+'</svg>';
  }
  function csv(data){
    const cell=v=>'"'+String(typeof v==='string'&&/^[\s]*[=+\-@]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
    return '\uFEFF'+[['序號','U (V)','I (A)','電壓表','電流表','電壓量程 (V)','電流量程 (A)','電壓狀態','電流狀態'],...data.rows.map((r,n)=>[n+1,r.u,r.i,r.uLabel,r.iLabel,r.uRange,r.iRange,r.uStatus,r.iStatus])].map(row=>row.map(cell).join(',')).join('\r\n');
  }
  return{limit,models,empty,state,validate,record,fit,predict,formula,plot,csv};
});
