'use strict';
const assert=require('node:assert/strict');

async function dragPlaybackCases(h,source){
 let checks=0;
 const sample=()=>h.inside(`(()=>{const a=CircuitACWorkbench.getAnalysis(),i=CircuitACWorkbench.getInteraction(),scene=document.querySelector('[data-circuit-id=scene]');return {time:a.time,reliable:a.reliable,document:CircuitACWorkbench.exportDocument(),interaction:i,changes:window.__dragChanges,brightness:+scene.querySelector('[data-lamp]')?.dataset.brightness,powerKnown:scene.querySelector('[data-lamp]')?.dataset.powerKnown,charges:[...scene.querySelectorAll('[data-charge-count]')].map(e=>+e.dataset.chargeCount),charge:a.components.c4?.charge,trusted:window.__dragInputs};})()`);
 async function setup(name='resistive',paused=false){
  await h.call('setReadOnly(false)');await h.call('setPlayback({paused:true})');
  if(await h.call('getInteraction().panMode'))await h.click('[data-circuit-id=pan]');
  await h.inside(`(()=>{const d=CircuitACPresets.create(${JSON.stringify(name)});window.__dragWire=CircuitModel.addWire(d,430,320).id;CircuitACWorkbench.loadDocument(d);window.__dragOff?.();window.__dragChanges=0;window.__dragOff=CircuitACWorkbench.onChange(()=>__dragChanges++);window.__dragInputs=[];})()`);
  await h.call('advanceTime(.25)');await h.call('setPlayback({paused:'+paused+',rate:.1})');
 }
 async function input(type,p,mobile,id=71){
  if(mobile)await h.send('Input.dispatchTouchEvent',{type:type==='down'?'touchStart':type==='move'?'touchMove':'touchEnd',touchPoints:type==='up'?[]:[{...p,id,radiusX:2,radiusY:2,force:1}]});
  else await h.send('Input.dispatchMouseEvent',{type:type==='down'?'mousePressed':type==='move'?'mouseMoved':'mouseReleased',...p,button:'left',buttons:type==='up'?0:1,clickCount:1});
 }
 async function escape(){await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
 const destination=id=>h.inside(`(()=>{const p=CircuitModel.endpoints(CircuitACWorkbench.getDocument()).get(${JSON.stringify(id)}),c=CircuitACWorkbench.getInteraction().camera,r=document.querySelector('[data-circuit-id=surface]').getBoundingClientRect();return{x:r.left+(p.x-c.x)*c.scale,y:r.top+(p.y-c.y)*c.scale};})()`);
 for(const width of [1280,390]){
  const mobile=width<600;await h.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile});await h.send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:2});
  await h.inside(`(()=>{if(window.__dragListener)return;window.__dragListener=e=>{if(e.target.closest('[data-circuit-id=surface]'))window.__dragInputs?.push({trusted:e.isTrusted,pointer:e.pointerType,hit:e.target.dataset.hit});};document.addEventListener('pointerdown',__dragListener,true);})()`);
  for(const kind of ['body','wire','wireend','pan'])for(const finish of ['cancel','release']){
   await setup();const wire=await h.inside('__dragWire');if(kind==='pan')await h.click('[data-circuit-id=pan]');
   const selector=kind==='body'?'[data-hit="body:c3"]':kind==='wire'?'[data-hit="wire:'+wire+':0"]':kind==='wireend'?'[data-hit="wireend:'+wire+':from"]':'[data-circuit-id=surface]';
   const p=kind==='pan'?await h.inside(`(()=>{const r=document.querySelector('[data-circuit-id=surface]').getBoundingClientRect();return{x:r.left+r.width*.5,y:r.bottom-100};})()`):await h.point(selector,true),to={x:p.x+30,y:p.y+15},before=await sample();
   await input('down',p,mobile);await input('move',to,mobile);await h.delay(250);const held=await sample();await h.delay(250);const still=await sample();
   assert.equal(held.interaction.dragging,kind);assert(still.time>held.time+.005,JSON.stringify({kind,width,held,still}));assert(held.time>before.time);assert.equal(still.document,before.document);assert.equal(still.changes,0);assert.equal(still.reliable,true);assert.equal(still.powerKnown,'true');assert(still.brightness>.1);assert(still.trusted.some(e=>e.trusted&&e.pointer===(mobile?'touch':'mouse')));checks+=8;
   if(finish==='cancel')await escape();await input('up',to,mobile);const after=await sample();if(finish==='cancel'||kind==='pan')assert.equal(after.document,before.document);else assert.notEqual(after.document,before.document);assert.equal(after.changes,finish==='release'&&kind!=='pan'?1:0);assert(after.time>=still.time);assert.equal(after.interaction.dragging,null);assert.equal(after.powerKnown,'true');assert(after.brightness>.1);checks+=6;
  }
  // Hold the snap ring without moving: both the visible lamp and capacitor stay live.
  for(const name of ['resistive','capacitive'])for(const finish of ['cancel','release']){
   await setup(name);const wire=await h.inside('__dragWire'),p=await h.point('[data-hit="wireend:'+wire+':from"]',true),to=await destination('c2:a'),before=await sample();
   await input('down',p,mobile);await input('move',to,mobile);await h.delay(250);const held=await sample();await h.delay(250);const still=await sample();
   assert.equal(still.interaction.snap,'c2:a');assert.equal(still.document,before.document);assert.equal(still.changes,0);assert(still.time>held.time+.005);assert.equal(still.powerKnown,'true');assert(still.brightness>.1);if(name==='capacitive'){assert(still.charges.some(n=>n>0));assert(still.charge>0);}checks+=name==='capacitive'?8:6;
   // Inspect immediately after pointerup, before another time step could hide a dark frame.
   await h.inside(`window.__dragReleased=null;document.querySelector('[data-circuit-id=surface]').addEventListener('pointerup',()=>{const a=CircuitACWorkbench.getAnalysis(),lamp=document.querySelector('[data-circuit-id=scene] [data-lamp]');window.__dragReleased={time:a.time,powerKnown:lamp.dataset.powerKnown,brightness:+lamp.dataset.brightness,charge:a.components.c4?.charge};},{once:true});`);
   if(finish==='cancel')await escape();await input('up',to,mobile);const after=await sample();assert(after.time>=still.time);assert.equal(after.reliable,true);
   if(finish==='cancel'){assert.equal(after.document,before.document);assert.equal(after.changes,0);}else{assert.equal(await h.call('getDocument().wires.find(w=>w.id==='+JSON.stringify(wire)+').from'),'c2:a');assert.equal(after.changes,1);const release=await h.inside('__dragReleased');assert.equal(release.powerKnown,'true');assert(release.brightness>.1);if(name==='capacitive')assert(release.charge>0);}
   checks+=finish==='release'?7:4;await h.screenshot(source+'-live-drag-'+name+'-'+finish+'-'+width);
  }
  if(mobile){
   await setup();const pair=await h.inside(`(()=>{const r=document.querySelector('[data-circuit-id=surface]').getBoundingClientRect();return [.35,.65].map((x,i)=>({x:r.left+r.width*x,y:r.bottom-80,id:81+i,radiusX:2,radiusY:2,force:1}));})()`),before=await sample();
   await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pair});await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pair.map((p,i)=>({...p,x:p.x+(i?15:-15),y:p.y-12}))});await h.delay(250);const held=await sample();await h.delay(250);const still=await sample();assert.equal(still.interaction.dragging,'camera');assert(still.time>held.time+.005);assert.equal(still.document,before.document);assert.equal(still.changes,0);assert.equal(still.powerKnown,'true');assert(still.brightness>.1);await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});checks+=6;
  }
  // Explicit pause still freezes physics while a connection preview is held.
  await setup('capacitive',true);let wire=await h.inside('__dragWire'),p=await h.point('[data-hit="wireend:'+wire+':from"]',true),to=await destination('c2:a'),before=await h.call('captureSession()');await input('down',p,mobile);await input('move',to,mobile);await h.delay(250);assert.deepEqual(await h.call('captureSession()'),before);const frozen=await sample();assert(frozen.charges.some(n=>n>0));assert(frozen.brightness>.1);await escape();await input('up',to,mobile);assert.deepEqual(await h.call('captureSession()'),before);checks+=4;
  // A genuine disconnection is preview-only until released, then follows reset rules.
  await setup();wire=await h.call('getDocument().wires[2].id');const wireBody=await h.inside(`(()=>{const d=CircuitACWorkbench.getDocument(),w=d.wires[2],points=CircuitRouting.simplify(CircuitRouting.route(d,w),1.2/CircuitACWorkbench.getInteraction().camera.scale),segments=points.slice(1).map((p,i)=>({i,length:Math.hypot(p.x-points[i].x,p.y-points[i].y)}));segments.sort((a,b)=>b.length-a.length);return '[data-hit="wire:'+w.id+':'+segments[0].i+'"]';})()`);await h.click(wireBody,true);p=await h.point('[data-hit="wireend:'+wire+':from"]',true);to={x:p.x+45,y:p.y+60};await input('down',p,mobile);await input('move',to,mobile);await h.delay(250);const openPreview=await sample();assert.equal(openPreview.interaction.snap,null);assert.equal(openPreview.powerKnown,'true');assert(openPreview.brightness>.1);const heldTime=openPreview.time;await input('up',to,mobile);assert((await sample()).time<heldTime);checks+=4;
  if(!mobile)for(const finish of ['cancel','release']){
   await setup();await h.click('[data-hit="body:c1"]',true);const slider=await h.point('[data-circuit-id=properties] input[type=range]'),end={x:slider.x+30,y:slider.y};await input('down',slider,false);await input('move',end,false);const accepted=await h.call('captureSession()');await h.delay(250);assert.deepEqual(await h.call('captureSession()'),accepted);const first=await h.inside('document.querySelector("[data-circuit-id=scene] [data-lamp]").dataset.power');await h.delay(250);assert.notEqual(await h.inside('document.querySelector("[data-circuit-id=scene] [data-lamp]").dataset.power'),first);assert.equal(await h.call('getDocument().components[0].params.voltage'),6);checks+=3;
   if(finish==='cancel')await escape();await input('up',end,false);assert.equal(await h.call('getDocument().components[0].params.voltage')===6,finish==='cancel');assert.equal(await h.call('getAnalysis().reliable'),true);assert.equal(await h.inside('__dragChanges'),finish==='cancel'?0:1);checks+=3;
  }
  // Read-only navigation never restarts playback.
  await h.call('setReadOnly(true)');await h.click('[data-circuit-id=pan]');before=await h.call('captureSession()');p=await h.inside(`(()=>{const r=document.querySelector('[data-circuit-id=surface]').getBoundingClientRect();return{x:r.left+r.width*.5,y:r.bottom-100};})()`);to={x:p.x+25,y:p.y};await input('down',p,mobile);await input('move',to,mobile);await h.delay(150);await input('up',to,mobile);assert.deepEqual(await h.call('captureSession()'),before);assert.equal(await h.call('getPlayback().paused'),true);checks+=2;await h.call('setReadOnly(false)');
 }
 console.log(source+' live drag/playback: '+checks+' focused checks passed');return checks;
}
module.exports={dragPlaybackCases};
