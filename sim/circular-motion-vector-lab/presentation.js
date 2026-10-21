(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircularVectorPresentation=api;
})(globalThis,function(){
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const math=(tex,text=tex)=>CircuitMath.html({tex,text});
  function prose(value){const symbols={'Δv':'\\Delta v','Δx':'\\Delta x','Δt':'\\Delta t','v₁':'v_1','v₂':'v_2'};return String(value).split(/(Δv|Δx|Δt|v₁|v₂)/).map(s=>symbols[s]?math(symbols[s],s):esc(s)).join('');}
  function intersects(box,a,b){
    let lo=0,hi=1;
    for(let i=0;i<2;i++){const v=b[i]-a[i],min=box[i]-5,max=box[i+2]+5;if(Math.abs(v)<1e-9){if(a[i]<min||a[i]>max)return false;}else{const x=(min-a[i])/v,y=(max-a[i])/v;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi)return false;}}
    return true;
  }
  function labels(points,center,r,width,height,segments=[],compact=false,top=compact?27:54){
    const placed=[],half=compact?[13,15]:[16,19];
    for(const point of points){
      const angle=Math.atan2(point[1]-center[1],point[0]-center[0]),candidates=[];
      for(const extra of [34,52,70])for(let step=0;step<=12;step++)for(const sign of step?[1,-1]:[1]){
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
  const nodeName=node=>({S:'共同起點',U:'初速度末端',V:'末速度末端'}[node]??'未選');
  function positionGeometry(width,height,readoutHeight,velocity=false){
    const compact=height<140,top=compact?27:readoutHeight+12;
    const r=Math.max(10,Math.min((width-108)/2,(height-(velocity?(compact?60:154):top+(compact?24:52)))/2,velocity?165:300));
    return {r,center:[width/2,velocity?height/2+7:(top+height-(compact?4:28))/2],compact,labelTop:top};
  }
  function velocityLabels(nodes,width,height){
    const compact=height<220,font=compact?18:20,top=height<150?0:35,choices=[],segments=[[nodes.S,nodes.U],[nodes.S,nodes.V],[nodes.U,nodes.V]];
    for(const key of ['S','U','V']){
      const label=compact?{S:'起點',U:'初速端',V:'末速端'}[key]:nodeName(key),half=label.length*font/2+5,candidates=[];
      const add=(x,y)=>{
        const box=[x-half,y-13,x+half,y+13];
        if(box[0]<6||box[2]>width-6||box[1]<top||box[3]>height||segments.some(([a,b])=>intersects(box,a,b)))return;
        candidates.push({key,label,font,x,y,box,cost:Math.hypot(x-nodes[key][0],y-nodes[key][1])});
      };
      for(const dx of [0,-half-14,half+14])for(const dy of [-60,-30,0,30,60])add(nodes[key][0]+dx,nodes[key][1]+dy);
      for(let col=0;col<3;col++)for(let row=0;row<5;row++)add(half+6+(width-2*half-12)*col/2,top+15+(height-top-30)*row/4);
      candidates.sort((a,b)=>a.cost-b.cost);
      if(!candidates.length)throw Error('No clear velocity label position');
      choices.push(candidates);
    }
    let best=null,bestCost=Infinity;
    function choose(index,selected,cost){
      if(cost>=bestCost)return;
      if(index===choices.length){best=selected;bestCost=cost;return;}
      for(const p of choices[index]){const b=p.box;if(selected.some(q=>!(b[2]+5<q.box[0]||b[0]-5>q.box[2]||b[3]+5<q.box[1]||b[1]-5>q.box[3])))continue;choose(index+1,[...selected,p],cost+p.cost);}
    }
    choose(0,[],0);
    if(!best)throw Error('No clear velocity annotation layout');
    return best;
  }
  function quantityLabels(specs,width,height,segments,occupied=[],top=0,ring=null){
    const placed=[],size=height<140?18:24,overlap=(a,b)=>a[0]<b[2]+4&&a[2]>b[0]-4&&a[1]<b[3]+4&&a[3]>b[1]-4;
    for(const spec of specs){
      const metric=CircuitMath.measure(spec.tex,size),half=[metric.width/2+5,metric.height/2+4],mid=spec.from.map((n,i)=>(n+spec.to[i])/2),dx=spec.to[0]-spec.from[0],dy=spec.to[1]-spec.from[1],length=Math.hypot(dx,dy)||1,candidates=[];
      const add=(x,y)=>{x=Math.max(half[0]+3,Math.min(width-half[0]-3,x));y=Math.max(top+half[1],Math.min(height-half[1]-3,y));const box=[x-half[0],y-half[1],x+half[0],y+half[1]];const blocked=occupied.concat(placed.map(p=>p.box)).filter(b=>overlap(box,b)).length,hits=segments.filter(([a,b])=>intersects(box,a,b)).length;let ringHit=0;if(ring){const [cx,cy]=ring.center,near=Math.hypot(Math.max(box[0]-cx,0,cx-box[2]),Math.max(box[1]-cy,0,cy-box[3])),far=Math.hypot(Math.max(Math.abs(cx-box[0]),Math.abs(cx-box[2])),Math.max(Math.abs(cy-box[1]),Math.abs(cy-box[3])));ringHit=near<ring.r+4&&far>ring.r-4?1:0;}candidates.push({...spec,x,y,box,size,baseline:y+(metric.ascent-metric.descent)/2,cost:blocked*1e6+(hits+ringHit)*1e4+Math.hypot(x-mid[0],y-mid[1])});};
      for(const fraction of [.5,.25,.75])for(const offset of [24,-24,42,-42,60,-60])add(spec.from[0]+dx*fraction-dy/length*offset,spec.from[1]+dy*fraction+dx/length*offset);
      for(const distance of [24,42,60,84,110])for(let step=0;step<8;step++)add(mid[0]+distance*Math.cos(step*Math.PI/4),mid[1]+distance*Math.sin(step*Math.PI/4));
      for(let col=0;col<3;col++)for(let row=0;row<3;row++)add(half[0]+4+(width-2*half[0]-8)*col/2,top+half[1]+(height-top-2*half[1]-4)*row/2);
      candidates.sort((a,b)=>a.cost-b.cost);placed.push(candidates[0]);
    }
    return placed;
  }
  return {math,prose,labels,intersects,velocityOrigin,nodeName,positionGeometry,velocityLabels,quantityLabels};
});
