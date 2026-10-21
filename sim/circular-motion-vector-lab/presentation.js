(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircularVectorPresentation=api;
})(globalThis,function(){
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const math=(tex,text=tex)=>CircuitMath.html({tex,text});
  function prose(value){return String(value).split(/(Δv|Δx|Δt)/).map(s=>({'Δv':'\\Delta \\vec v','Δx':'\\Delta x','Δt':'\\Delta t'}[s]?math({'Δv':'\\Delta \\vec v','Δx':'\\Delta x','Δt':'\\Delta t'}[s],s):esc(s))).join('');}
  function intersects(box,a,b){
    let lo=0,hi=1;
    for(let i=0;i<2;i++){const v=b[i]-a[i],min=box[i]-5,max=box[i+2]+5;if(Math.abs(v)<1e-9){if(a[i]<min||a[i]>max)return false;}else{const x=(min-a[i])/v,y=(max-a[i])/v;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi)return false;}}
    return true;
  }
  function labels(points,center,r,width,height,segments=[],compact=false){
    const placed=[],half=compact?[11,12]:[13,15],top=compact?27:90;
    for(const point of points){
      const angle=Math.atan2(point[1]-center[1],point[0]-center[0]),candidates=[];
      for(const extra of [30,48,66])for(let step=0;step<=12;step++)for(const sign of step?[1,-1]:[1]){
        const t=angle+sign*step*Math.PI/12,x=center[0]+(r+extra)*Math.cos(t),y=center[1]+(r+extra)*Math.sin(t),box=[x-half[0],y-half[1],x+half[0],y+half[1]];
        if(box[0]<5||box[2]>width-5||box[1]<top||box[3]>height-5)continue;
        if(placed.some(p=>!(box[2]+8<p.box[0]||box[0]-8>p.box[2]||box[3]+8<p.box[1]||box[1]-8>p.box[3])))continue;
        if(segments.some(([a,b])=>intersects(box,a,b)))continue;
        candidates.push({x,y,box,cost:Math.hypot(x-point[0],y-point[1])});
      }
      candidates.sort((a,b)=>a.cost-b.cost);
      if(!candidates.length)throw Error('No clear point label position');
      placed.push(candidates[0]);
    }
    return placed;
  }
  function velocityOrigin(nodes,width,height,unit){
    const points=Object.values(nodes),xs=points.map(p=>p[0]*unit),ys=points.map(p=>-p[1]*unit);
    return [width/2-(Math.min(...xs)+Math.max(...xs))/2,height/2-(Math.min(...ys)+Math.max(...ys))/2];
  }
  return {math,prose,labels,intersects,velocityOrigin};
});
