(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry.js'):root.CircuitRegistry,node?require('./circuit-routing.js'):root.CircuitRouting,node?require('./circuit-math.js'):root.CircuitMath);
  if(node)module.exports=api;else root.CircuitLabelLayout=api;
})(globalThis,function(R,G,Q){
  'use strict';
  let context;const widths=new Map();
  function measure(value,size){
    const key=size+':'+value;if(widths.has(key))return widths.get(key);
    if(context===undefined)context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
    let width;if(context){context.font=`${size}px system-ui,sans-serif`;width=context.measureText(value).width;}
    else width=[...value].reduce((n,c)=>n+size*(/[^\u0000-\u024f]/u.test(c)?1:/[MW@%]/.test(c)?.95:/[ilI .,:'·]/.test(c)?.35:.68),0);
    if(widths.size>2048)widths.clear();widths.set(key,width);return width;
  }
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const expand=(r,gap)=>({left:r.left-gap,right:r.right+gap,top:r.top-gap,bottom:r.bottom+gap});
  function segmentHits(a,b,r){
    let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
    for(const [p,q]of [[-dx,a.x-r.left],[dx,r.right-a.x],[-dy,a.y-r.top],[dy,r.bottom-a.y]]){
      if(Math.abs(p)<1e-10){if(q<0)return false;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
    }return true;
  }
  function bodyBounds(c,view='real'){
    const local={battery:view==='schematic'?[-63,-48,63,31]:[-63,-31,63,31],resistor:[-63,-22,63,22],rheostat:[-63,-32,63,48],switch:[-63,-32,63,26],lamp:view==='real'?[-63,-92,63,32]:[-63,-42,63,42],ammeter:view==='real'?[-80,-88,80,80]:[-68,-39,68,70],voltmeter:view==='real'?[-80,-88,80,80]:[-68,-39,68,70],wattmeter:[-63,-47,63,47]}[c.type];
    if(R.dualMeter(c)&&view==='real'){const scale=R.meterBodyScale(c);local.splice(0,4,-76,-86*scale-2,76,78);}
    if(!local)return R.bodyBounds(c);
    const angle=c.angle*Math.PI/180,cos=Math.round(Math.cos(angle)),sin=Math.round(Math.sin(angle)),points=[local[0],local[2]].flatMap(x=>[local[1],local[3]].map(y=>({x:c.x+x*cos-y*sin,y:c.y+x*sin+y*cos})));
    return{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
  }
  function wrap(value,size,maxWidth){
    if(value.includes(' · ')&&measure(value,size)>maxWidth)return value.split(' · ').flatMap(part=>wrap(part,size,maxWidth));
    const lines=[];let current='';
    for(const char of [...value]){if(current&&measure(current+char,size)>maxWidth){const space=current.lastIndexOf(' ');if(space>0){lines.push(current.slice(0,space).trimEnd());current=current.slice(space+1)+char;}else{lines.push(current.trimEnd());current=char.trimStart();}}else current+=char;}if(current)lines.push(current);return lines;
  }
  function rowsFor(lines,maxWidth){return lines.flatMap(line=>{
    if(line.tex){const parts=line.parts&&Q.measure(line.tex,line.size).width>maxWidth?line.parts:[line];return parts.map(part=>({...line,...part,parts:undefined}));}
    return wrap(line.text,line.size,maxWidth).map(text=>({...line,text}));
  }).map(row=>{const m=row.tex?Q.measure(row.tex,row.size):{width:measure(row.text,row.size),ascent:row.size,descent:0};return{...row,width:m.width,ascent:Math.max(row.size,m.ascent),step:Math.max(row.size,m.ascent)+m.descent+4};});}
  function layout(doc,items,scale,routes={},viewport=null,extra=[],previous=null){
    const origin=viewport||{x:0,y:0},toScreen=p=>({x:(p.x-origin.x)*scale,y:(p.y-origin.y)*scale}),toRect=r=>({left:(r.left-origin.x)*scale,right:(r.right-origin.x)*scale,top:(r.top-origin.y)*scale,bottom:(r.bottom-origin.y)*scale});
    const frame=viewport?{left:4,top:4,right:viewport.width*scale-4,bottom:viewport.height*scale-4}:null,cells=new Map(),broad=[],cell=48;
    const keys=r=>{const b=frame?{left:Math.max(r.left,frame.left-160),right:Math.min(r.right,frame.right+160),top:Math.max(r.top,frame.top-160),bottom:Math.min(r.bottom,frame.bottom+160)}:r,out=[],x0=Math.floor(b.left/cell),x1=Math.floor(b.right/cell),y0=Math.floor(b.top/cell),y1=Math.floor(b.bottom/cell);if((x1-x0+1)*(y1-y0+1)>4096)return null;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)out.push(x+','+y);return out;};
    const add=o=>{const places=keys(o.box);if(!places){broad.push(o);return;}for(const key of places){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o);}};
    const query=box=>new Set([...(keys(box)||[]).flatMap(key=>cells.get(key)||[]),...broad.filter(o=>intersects(box,o.box))]);
    const bodies=new Map(doc.components.map(c=>[c.id,toRect(bodyBounds(c,doc.display.view))]));
    for(const [id,box]of bodies)add({type:'body',id,box:expand(box,4)});
    extra.forEach(box=>add({type:'detail',box:toRect(box)}));
    doc.junctions.forEach(j=>{const p=toScreen(j);add({type:'detail',box:{left:p.x-8,right:p.x+8,top:p.y-8,bottom:p.y+8}});});
    doc.components.forEach(c=>R.ports(c).forEach(port=>{const p=toScreen(port);add({type:'detail',box:{left:p.x-8,right:p.x+8,top:p.y-8,bottom:p.y+8}});}));
    doc.wires.forEach(w=>{const points=G.simplify(routes[w.id]||G.route(doc,w),.6/scale).map(toScreen);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];add({type:'wire',id:w.id,a,b,box:expand({left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)},7)});}});
    function collision(box){
      let penalty=0;if(frame){const outside=(box.right-box.left)*(box.bottom-box.top)-Math.max(0,Math.min(box.right,frame.right)-Math.max(box.left,frame.left))*Math.max(0,Math.min(box.bottom,frame.bottom)-Math.max(box.top,frame.top));if(outside>.01)penalty+=100000+outside*100;}
      const wires=new Set();for(const o of query(expand(box,7))){if(o.type==='wire'){if(segmentHits(o.a,o.b,expand(box,7)))wires.add(o.id);}else if(intersects(box,o.box))penalty+=o.type==='label'?50000:30000;}return penalty+wires.size*10000;
    }
    const work=[];
    items.forEach((item,order)=>{
      const body=bodies.get(item.id);if(frame&&!intersects(body,frame))return;
      const rows=rowsFor(item.lines,Math.min(item.maxWidth||180,frame?frame.right-frame.left-8:220));if(!rows.length)return;
      const width=Math.max(...rows.map(line=>line.width))+6,height=rows.reduce((n,line)=>n+line.step,0)+4,cx=(body.left+body.right)/2,cy=(body.top+body.bottom)/2,candidates=[];
      for(const gap of [6,16,30,48,72,104])for(const side of ['below','above','right','left'])for(const offset of [0,-.6,.6,-1,1]){
        let x=cx,y=cy;if(side==='below'||side==='above'){x+=offset*width;y=side==='below'?body.bottom+gap+height/2:body.top-gap-height/2;}else{x=side==='right'?body.right+gap+width/2:body.left-gap-width/2;y+=offset*height;}
        const box={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2},slot=side+':'+gap+':'+offset,base=Math.hypot(x-cx,y-cy)+(['below','above','right','left'].indexOf(side))*2+Math.abs(offset)*4;
        candidates.push({box,slot,base,penalty:collision(box)});
        if(frame){const px=Math.max(frame.left+width/2,Math.min(frame.right-width/2,x)),py=Math.max(frame.top+height/2,Math.min(frame.bottom-height/2,y));if(px!==x||py!==y){const adjusted={left:px-width/2,right:px+width/2,top:py-height/2,bottom:py+height/2};candidates.push({box:adjusted,slot:'clamped:'+slot,base:Math.hypot(px-cx,py-cy)+8,penalty:collision(adjusted)});}}
      }
      const old=previous?.get(item.id);if(old?.startsWith('grid:')){const [,dx,dy]=old.split(':').map(Number),x=cx+dx,y=cy+dy,box={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2};candidates.push({box,slot:old,base:Math.hypot(dx,dy)+6,penalty:collision(box)});}
      work.push({item,order,body,rows,width,height,candidates,free:candidates.filter(c=>!c.penalty).length});
    });
    // Put constrained labels first, then keep a still-clear previous slot close to the best one.
    work.sort((a,b)=>a.free-b.free||b.width-a.width||a.order-b.order);const placed=[];
    for(const entry of work){
      let best=null;for(const candidate of entry.candidates){const penalty=collision(candidate.box),score=penalty+candidate.base;if(!best||score<best.score)best={...candidate,penalty,score};}
      if(best.penalty){const cx=(entry.body.left+entry.body.right)/2,cy=(entry.body.top+entry.body.bottom)/2;for(let dy=-144;dy<=144;dy+=12)for(let dx=-180;dx<=180;dx+=12){const x=cx+dx,y=cy+dy,box={left:x-entry.width/2,right:x+entry.width/2,top:y-entry.height/2,bottom:y+entry.height/2},penalty=collision(box),base=Math.hypot(dx,dy)+6,score=penalty+base;if(score<best.score)best={box,slot:'grid:'+dx+':'+dy,penalty,base,score};}}
      if(best.penalty)for(const limit of [120,96,72,54]){if(limit>=entry.width-6)continue;
        const rows=rowsFor(entry.item.lines,limit),width=Math.max(...rows.map(row=>row.width))+6,height=rows.reduce((n,row)=>n+row.step,0)+4,cx=(entry.body.left+entry.body.right)/2,cy=(entry.body.top+entry.body.bottom)/2;
        for(let dy=-144;dy<=144;dy+=12)for(let dx=-180;dx<=180;dx+=12){const x=cx+dx,y=cy+dy,box={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2},penalty=collision(box),base=Math.hypot(dx,dy)+12+(rows.length-entry.rows.length)*8,score=penalty+base;if(score<best.score)best={box,rows,slot:'compact:'+limit+':'+dx+':'+dy,penalty,base,score};}
        if(!best.penalty)break;
      }
      const preferred=entry.candidates.find(c=>c.slot===previous?.get(entry.item.id));if(preferred&&!best.penalty&&!collision(preferred.box)&&preferred.base<=best.base+28)best={...preferred,penalty:0,score:preferred.base};
      add({type:'label',id:entry.item.id,box:expand(best.box,3)});const box={left:origin.x+best.box.left/scale,right:origin.x+best.box.right/scale,top:origin.y+best.box.top/scale,bottom:origin.y+best.box.bottom/scale};let y=box.top+2/scale;
      const rows=(best.rows||entry.rows).map(row=>{const baseline=y+row.ascent/scale;y+=row.step/scale;return{...row,x:(box.left+box.right)/2,y:baseline};});
      const center={x:(best.box.left+best.box.right)/2,y:(best.box.top+best.box.bottom)/2},nearest=(r,p)=>({x:Math.max(r.left,Math.min(r.right,p.x)),y:Math.max(r.top,Math.min(r.bottom,p.y))}),from=nearest(entry.body,center),to=nearest(best.box,from),leader=Math.hypot(from.x-to.x,from.y-to.y)>22?{from:{x:origin.x+from.x/scale,y:origin.y+from.y/scale},to:{x:origin.x+to.x/scale,y:origin.y+to.y/scale}}:null;
      placed.push({id:entry.item.id,box,rows,slot:best.slot,crowded:best.penalty>0,leader});
    }
    return placed.sort((a,b)=>items.findIndex(i=>i.id===a.id)-items.findIndex(i=>i.id===b.id));
  }
  return{layout,measure,wrap,bodyBounds,intersects,segmentHits};
});
