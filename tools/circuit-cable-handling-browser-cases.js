'use strict';
const assert=require('node:assert/strict');
const M=require('../sim/circuit-workbench/circuit-model'),R=require('../sim/circuit-workbench/component-registry'),G=require('../sim/circuit-workbench/circuit-routing'),P=require('../sim/circuit-workbench/presets');
const {fixture:meterFixture}=require('./circuit-meter-snapping-browser-cases');

function looseFixture(type,key,end,angle,view){
  const d=M.empty();d.display.view=view;d.display.flow='off';d.display.meters=angle%180?'analog':'digital';
  let p,c;
  if(type==='junction'){
    const old=M.addWire(d,400,280),other=M.addWire(d,630,220);M.attach(d,other.id,'from',old.from);
    p={...M.endpoints(d).get(old.from),id:old.from,dx:0,dy:1};
  }else{c=M.add(d,type,400,280);c.angle=angle;p=R.ports(c).find(p=>p.key===key);}
  const start={x:p.x+p.dx*100,y:p.y+p.dy*100};
  const wire=M.addWire(d,start.x+(end==='from'?90:-90),start.y);
  return {d:M.validate(d),p,c,wire};
}

async function cableHandlingCases(h,mode,base){
  let width,touchId=9000;
  const evidence=(kind,data)=>h.evidence.push({mode,cableHandling:kind,width,...data});
  async function launch(w){
    width=w;await h.freshPage();h.setContext('window');
    await h.send('Emulation.setDeviceMetricsOverride',{width:w,height:w<600?844:800,deviceScaleFactor:1,mobile:w<600});
    await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
    await h.inside(`window.__handlingEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.getElementById('surface').addEventListener(type,e=>__handlingEvents.push({type,pointer:e.pointerType,trusted:e.isTrusted,target:e.target.dataset.hit}));`);
  }
  async function sample(){return h.inside(`(()=>{const p=document.getElementById('preview'),n=document.getElementById('canvasNotice'),s=document.querySelector('#ghostLayer [data-snap-target]'),needle=p.querySelector('[data-meter-needle]');return {interaction:CircuitWorkbench.getInteraction(),document:CircuitWorkbench.exportDocument(),preview:!p.hidden,previewMode:p.dataset.mode,caption:p.querySelector('span').textContent,needle:needle?{angle:+needle.dataset.angle,range:+needle.dataset.range,reading:+needle.dataset.reading}:null,ticks:p.querySelectorAll('[data-meter-tick]').length,notice:n.hidden?null:n.innerText,snap:s?{id:s.dataset.snapTarget,x:+s.getAttribute('cx'),y:+s.getAttribute('cy')}:null};})()`);}
  const compact=s=>({dragging:s.interaction.dragging,snap:s.snap,preview:s.preview,previewMode:s.previewMode,notice:s.notice,needle:s.needle});
  const settle=()=>h.inside('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  async function start(p,kind){
    const actual=await h.inside(`document.elementFromPoint(${p.x},${p.y})?.meta?.kind`);if(kind)assert.equal(actual,kind,'grip uses the visible object at the actual screen point');
    const id=touchId++;
    if(width<600)await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]});
    else await h.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
    await h.delay(20);await settle();return {p,last:p,id};
  }
  async function move(grip,to){
    const old=grip.last;for(let i=1;i<=6;i++){
      const p={x:old.x+(to.x-old.x)*i/6,y:old.y+(to.y-old.y)*i/6};
      if(width<600)await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:grip.id,radiusX:2,radiusY:2,force:1}]});
      else await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1});
      await h.delay(20);
    }grip.last=to;await settle();return sample();
  }
  async function finish(grip,abort=false){
    if(width<600)await h.send('Input.dispatchTouchEvent',{type:abort?'touchCancel':'touchEnd',touchPoints:[]});
    else{if(abort)await h.key('Escape','Escape',27);await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',...grip.last,button:'left',buttons:0,clickCount:1});}
    await h.delay(30);await settle();return sample();
  }
  async function bodyGrip(d,w){
    const p=await h.scenePoint(G.along(G.route(d,w),G.length(G.route(d,w))/2));
    if(await h.inside(`document.elementFromPoint(${p.x},${p.y})?.meta?.id===${JSON.stringify(w.id)}&&document.elementFromPoint(${p.x},${p.y})?.meta?.kind==='wire'`))return p;
    return h.inside(`(()=>{for(const e of [...document.querySelectorAll('.hit.wire')].filter(e=>e.meta.id===${JSON.stringify(w.id)}).sort((a,b)=>b.clientWidth-a.clientWidth)){const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(document.elementFromPoint(x,y)===e)return{x,y};}throw new Error('No exposed cable body');})()`);
  }
  async function destination(f,end,offset=12){
    const camera=await h.inside('CircuitWorkbench.getInteraction().camera'),e=M.endpoints(f.d).get(f.wire[end]),grip=await bodyGrip(f.d,f.wire);
    return{start:grip,to:{x:grip.x+(f.p.x-e.x)*camera.scale+f.p.dx*offset,y:grip.y+(f.p.y-e.y)*camera.scale+f.p.dy*offset},camera};
  }
  function translated(before,after,id){
    const a=before.wires.find(w=>w.id===id),b=after.wires.find(w=>w.id===id),pa=G.route(before,a),pb=G.route(after,b),ea=M.endpoints(before),eb=M.endpoints(after),dx=eb.get(b.from).x-ea.get(a.from).x,dy=eb.get(b.from).y-ea.get(a.from).y;
    assert(Math.hypot(eb.get(b.to).x-ea.get(a.to).x-dx,eb.get(b.to).y-ea.get(a.to).y-dy)<1e-7);
    assert.equal(a.via.length,b.via.length);for(let i=0;i<a.via.length;i++)assert(Math.hypot(b.via[i].x-a.via[i].x-dx,b.via[i].y-a.via[i].y-dy)<1e-7,'stored cable shape translates exactly');
    // The renderer rounds endpoint coordinates to 0.01 world units.
    assert.equal(pa.length,pb.length);for(let i=0;i<pa.length;i++)assert(Math.hypot(pb[i].x-pa[i].x-dx,pb[i].y-pa[i].y-dy)<.015,'display route remains rigid within endpoint quantization');
    assert.equal(b.length,a.length);assert(Math.abs(G.length(pa)-G.length(pb))<.02);assert(G.length(pb)<=b.length+.05);
    assert.deepEqual(after.cables,before.cables);assert.equal(after.wires.length,before.wires.length);assert.deepEqual(after.components,before.components);
  }
  async function connectBody(f,end,{history=true,capture=false}={}){
    await h.load(f.d);const before=await h.save(),dest=await destination(f,end),grip=await start(dest.start,'wire');
    assert(!(await sample()).preview,'loose cable body never opens a touch magnifier');
    const held=await move(grip,dest.to);
    if(held.interaction.snap!==f.p.id){console.log('Whole cable snap failure',JSON.stringify({width,type:f.c?.type,end,view:f.d.display.view,angle:f.c?.angle,p:f.p,dest,held:compact(held)}));await h.screenshot(`${mode}-whole-cable-failure.png`);}
    assert.equal(held.document,before,'snap preview leaves the committed document unchanged');assert.equal(held.interaction.snap,f.p.id);assert.equal(held.snap.id,f.p.id);assert(!held.preview);assert(held.notice.startsWith((end==='from'?'A':'B')+' 端將接到：'));
    assert.deepEqual(held.interaction.camera,dest.camera);if(capture)await h.screenshot(`${mode}-whole-cable-snap-${width}.png`);
    await finish(grip);const d=await h.doc(),wire=d.wires.find(w=>w.id===f.wire.id),other=end==='from'?'to':'from';
    assert.equal(wire[end],f.p.id);assert(!M.attached(d,wire,other),'only the nearest endpoint attaches on this pickup');translated(f.d,d,wire.id);
    const released=await sample();assert(!released.preview);assert.equal(released.snap,null);assert.equal(released.interaction.dragging,null);
    const committed=await h.save();if(history){await h.click('#undo');assert.equal(await h.save(),before);await h.click('#redo');assert.equal(await h.save(),committed);}
    return {held:compact(held),endpoint:wire[end],other:wire[other],length:wire.length,rigid:true,undoRedo:history};
  }

  const destinations=[['ammeter','a'],['ammeter','b'],['ammeter','c'],['voltmeter','a'],['voltmeter','b'],['voltmeter','c'],['wattmeter','a'],['wattmeter','d'],['resistor','b'],['junction','p']];
  for(const w of [320,390,1280]){
    console.log(`${mode}: whole cable pickup matrix ${w} px`);await launch(w);
    for(const view of ['real','schematic'])for(const end of ['from','to'])for(let i=0;i<destinations.length;i++){
      const [type,key]=destinations[i],angle=i%4*90,f=looseFixture(type,key,end,angle,view),result=await connectBody(f,end,{capture:w===390&&view==='real'&&type==='ammeter'&&key==='c'&&end==='to'});
      evidence('whole-pickup',{type,key,angle,view,end,source:w<600?'touch':'mouse',result});
    }
    const events=await h.inside('__handlingEvents'),source=w<600?'touch':'mouse';assert(events.every(e=>e.trusted));for(const type of ['pointerdown','pointermove','pointerup'])assert(events.some(e=>e.type===type&&e.pointer===source));
    assert(!events.some(e=>e.type==='pointercancel'));assert(events.filter(e=>e.type==='pointerdown').every(e=>e.target?.startsWith('wire:')));
    evidence('trusted-input',{source,events:events.length});
  }

  for(const w of [390,1280]){
    await launch(w);
    // Two close holes compete by actual distance; whole-body snapping shares the 24px boundary.
    const nearest=looseFixture('ammeter','b','from',0,'real');await h.load(nearest.d);
    const oldScale=await h.inside('CircuitWorkbench.getInteraction().camera.scale'),wheel=await h.point('#surface');await h.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:wheel.x,y:wheel.y,deltaX:0,deltaY:Math.log(oldScale/.5)/.0015});await settle();
    const camera=await h.inside('CircuitWorkbench.getInteraction().camera'),at=await bodyGrip(nearest.d,nearest.wire),old=M.endpoints(nearest.d).get(nearest.wire.from),nearGrip=await start(at,'wire'),nearHeld=await move(nearGrip,{x:at.x+(374-old.x)*camera.scale,y:at.y+(346-old.y)*camera.scale});
    assert.equal(nearHeld.snap?.id,nearest.c.id+':c');assert(!nearHeld.preview);await finish(nearGrip);assert.equal((await h.doc()).wires.find(w=>w.id===nearest.wire.id).from,nearest.c.id+':c');evidence('nearest-hole',{held:compact(nearHeld)});
    for(const offset of [23.5,24.5]){const f=looseFixture('resistor','b','from',0,'real');await h.load(f.d);const dest=await destination(f,'from',offset),grip=await start(dest.start,'wire'),held=await move(grip,dest.to);assert.equal(held.snap?.id??null,offset<24?f.p.id:null);await finish(grip);const after=await h.doc();assert.equal(M.attached(after,after.wires.find(w=>w.id===f.wire.id),'from'),offset<24);evidence('snap-boundary',{offset,held:compact(held)});}
    // A target is provisional: leaving its radius removes it, re-entering restores it.
    for(const end of ['from','to'])for(const leaveAtRelease of [false,true]){
      const f=looseFixture('voltmeter','c',end,0,'real');await h.load(f.d);const before=await h.save(),dest=await destination(f,end),grip=await start(dest.start,'wire');
      const near=await move(grip,dest.to),far=await move(grip,{x:dest.to.x,y:dest.to.y+65});
      assert.equal(near.snap?.id,f.p.id);assert.equal(far.snap,null);assert.equal(far.notice,null);assert.equal(far.document,before);assert(!far.preview);
      const last=leaveAtRelease?far:await move(grip,dest.to);assert.equal(last.snap?.id??null,leaveAtRelease?null:f.p.id);await finish(grip);
      const after=await h.doc(),wire=after.wires.find(x=>x.id===f.wire.id);assert.equal(M.attached(after,wire,end),!leaveAtRelease);translated(f.d,after,wire.id);
      evidence('snap-in-out',{end,leaveAtRelease,near:compact(near),far:compact(far),last:compact(last)});
    }
    // Cancel a snapped whole-body preview, then perform a legal continuation.
    const f=looseFixture('ammeter','c','to',0,'real');await h.load(f.d);const before=await h.save(),dest=await destination(f,'to'),grip=await start(dest.start,'wire');await move(grip,dest.to);const rollback=await finish(grip,true);
    assert.equal(await h.save(),before);assert.equal(rollback.snap,null);assert(!rollback.preview);assert.equal(rollback.interaction.dragging,null);await connectBody(f,'to');evidence('cancel-continue',{source:w<600?'touchCancel':'Escape'});

    // File restore at F1, then endpoint attachment reaches the same physical reading/range.
    for(const type of ['ammeter','voltmeter']){
      const f=meterFixture(type,'c');f.d.display.meters='analog';const anchor=f.wire.to;M.detach(f.d,f.wire.id,'to');
      await connectBody({...f,c:f.meter},'from');const one=await h.save();await h.load(one);assert.equal(await h.save(),one);
      const startAt=await h.point(`[data-hit="wireend:${f.wire.id}:to"]`),target=await h.scenePoint(M.endpoints(await h.doc()).get(anchor)),grip=await start(startAt,'wireend');
      const held=await move(grip,target);assert.equal(held.interaction.snap,anchor);assert.equal(held.preview,w<600);if(w<600)assert.equal(held.previewMode,'connection');await finish(grip);
      const r=await h.inside(`CircuitWorkbench.getAnalysis().components[${JSON.stringify(f.meter.id)}]`);assert(Math.abs(r.reading-(type==='ammeter'?.3:1.5))<1e-8);assert.equal(r.range,type==='ammeter'?.6:3);
      const two=await h.save();await h.load(two);assert.equal(await h.save(),two);await h.click('#undo');assert.equal(await h.save(),one);await h.click('#redo');assert.equal(await h.save(),two);
      evidence('restore-continuation',{type,reading:r.reading,range:r.range,endpoint:anchor,preview:compact(held)});
    }
    // Fixed ends never become automatic whole-body attachments.
    for(const fixed of [1,2]){
      const f=meterFixture('ammeter','a');if(fixed===2)M.attach(f.d,f.wire.id,'from',f.p.id);await h.load(f.d);
      const wire=(await h.doc()).wires.find(x=>x.id===f.wire.id),before=await h.save(),reading=await h.inside('CircuitWorkbench.getAnalysis()'),at=await bodyGrip(f.d,wire),grip=await start(at,'wire'),held=await move(grip,{x:at.x+20,y:at.y-24});
      assert.equal(held.snap,null);assert(!held.preview);await finish(grip);const after=await h.doc(),b=after.wires.find(x=>x.id===wire.id);assert.equal(b.from,wire.from);assert.equal(b.to,wire.to);assert.equal(b.length,wire.length);assert(G.length(G.route(after,b))<=b.length+.05);assert.deepEqual(await h.inside('CircuitWorkbench.getAnalysis()'),reading);
      if(await h.save()!==before){await h.click('#undo');assert.equal(await h.save(),before);}evidence('fixed-body-bend',{fixed,ends:[b.from,b.to],preview:false});
    }
  }

  // Smaller housings preserve all socket centres; foreground cables can be picked up over a face.
  await launch(390);
  for(const type of ['ammeter','voltmeter','wattmeter'])for(const style of ['analog','digital']){
    const d=M.empty(),c=M.add(d,type,400,280);d.display.flow='off';d.display.meters=style;d.display.names=false;d.display.values=true;
    const wire=M.addWire(d,400,240);await h.load(d);const bounds=await h.inside(`(()=>{const c=document.querySelector('[data-component="${c.id}"]'),body=c.querySelector('[data-meter-housing]'),b=body.querySelector('rect').getBBox(),w=document.querySelector('[data-wire="${wire.id}"]');return {transform:body.getAttribute('transform'),bbox:{x:b.x,y:b.y,width:b.width,height:b.height},foreground:!!(c.compareDocumentPosition(w)&Node.DOCUMENT_POSITION_FOLLOWING),sockets:[...c.querySelectorAll('[data-socket]')].map(e=>{const p=new DOMPoint(+e.getAttribute('cx'),+e.getAttribute('cy')).matrixTransform(c.transform.baseVal.consolidate().matrix);return{id:e.dataset.socket,x:p.x,y:p.y};})};})()`);
    // The unused lower part of the dual-meter housing was removed in the persistent-preview redesign.
    assert.equal(bounds.transform,`scale(${R.meterBodyScale(c)})`);assert(bounds.foreground);assert.equal(bounds.bbox.width,R.dualMeter(c)?156:86);assert.equal(bounds.bbox.height,R.dualMeter(c)?128:78);
    for(const socket of bounds.sockets){const p=R.ports(c).find(p=>p.key===socket.id);assert(Math.hypot(socket.x-p.x,socket.y-p.y)<1e-8);}
    const startAt=await bodyGrip(d,wire);await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20,buttons:0});await settle();
    const shot=await h.send('Page.captureScreenshot',{format:'png'}),pixel=await h.inside(`new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);resolve([...ctx.getImageData(${Math.round(startAt.x)},${Math.round(startAt.y)},1,1).data]);};i.onerror=reject;i.src=${JSON.stringify('data:image/png;base64,'+shot.data)};})`);
    assert(pixel.slice(0,3).every((n,i)=>Math.abs(n-[80,103,126][i])<=2),'actual screenshot pixel shows the cable colour over the meter face');assert.equal(pixel[3],255);
    const grip=await start(startAt,'wire');assert(!(await sample()).preview);const held=await move(grip,{x:startAt.x,y:startAt.y-35});assert(!held.preview);await finish(grip);assert.notEqual((await h.doc()).junctions[0].y,d.junctions[0].y);
    if(type==='ammeter'&&style==='analog')await h.screenshot(`${mode}-foreground-meter-390.png`);
    evidence('foreground-and-size',{type,style,bounds,pixel,grabbable:true,preview:false});
  }
  // Preview inventory: stationary analog readings only; body movement hides it immediately.
  for(const view of ['real','schematic'])for(const style of ['analog','digital']){
    const d=P.create('meters');d.display.flow='off';d.display.view=view;d.display.meters=style;await h.load(d);
    for(const type of ['ammeter','voltmeter','wattmeter']){
      const c=d.components.find(c=>c.type===type),p=await h.point(`[data-hit="body:${c.id}"]`),grip=await start(p,'body'),s=await sample();
      assert.equal(s.preview,style==='analog');if(s.preview){assert.equal(s.previewMode,'meter');assert.equal(s.caption,'刻度預覽');if(R.dualMeter(c)){
        const r=await h.inside(`CircuitWorkbench.getAnalysis().components[${JSON.stringify(c.id)}]`);assert.equal(s.needle.reading,r.reading);assert.equal(s.needle.range,r.range);assert(Math.abs(s.needle.angle-(-120+90*r.reading/r.range))<1e-8);assert.equal(s.ticks,41);
        if(view==='real'){const scene=await h.inside(`(()=>{const e=document.querySelector('#scene [data-meter-needle="${c.id}"]');return{angle:+e.dataset.angle,range:+e.dataset.range,reading:+e.dataset.reading};})()`);assert.deepEqual(s.needle,scene);}
        if(type==='ammeter'&&view==='real')await h.screenshot(`${mode}-analog-read-preview-390.png`);
      }}
      const moved=await move(grip,{x:p.x+15,y:p.y-15});assert(!moved.preview);await finish(grip,true);evidence('meter-preview',{type,view,style,stationary:compact(s),moveHides:true});
    }
  }
  for(const operation of ['body','junction','slider','wire','free-wire','pan']){
    const selector=await h.setupOperation(operation),p=await h.point(selector),grip=await start(p),held=await move(grip,{x:p.x+12,y:p.y-18});
    assert(!held.preview,operation+' must not open a magnifier');await finish(grip,true);evidence('no-preview',{operation});
    if(operation==='pan')await h.click('#pan');
  }
  // A second finger takes over navigation and rolls back the provisional attachment.
  const f=looseFixture('voltmeter','c','from',0,'real');await h.load(f.d);const before=await h.save(),dest=await destination(f,'from'),grip=await start(dest.start,'wire');await move(grip,dest.to);
  await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...grip.last,id:grip.id,radiusX:2,radiusY:2,force:1},{x:grip.last.x-70,y:grip.last.y-40,id:grip.id+1,radiusX:2,radiusY:2,force:1}]});
  const takeover=await sample();assert.equal(takeover.interaction.dragging,'camera');assert.equal(takeover.snap,null);assert(!takeover.preview);assert.equal(takeover.notice,null);assert.equal(await h.save(),before);await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await connectBody(f,'from');evidence('second-touch-continue',{takeover:compact(takeover)});
}
module.exports={cableHandlingCases};
