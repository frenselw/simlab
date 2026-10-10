'use strict';
const assert=require('node:assert/strict');
async function generatorCases({inside,call,click,point,cdp,touch,screenshot,source,delay}){
 let checks=0;
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await inside(`(()=>{const d=CircuitModel.empty('transient');d.cables.length=1200;const g=CircuitModel.add(d,'generator',340,340,{frequency:1,turns:300}),l=CircuitModel.add(d,'lamp',600,160,{model:'ideal',resistance:12});CircuitModel.connect(d,g.id+':a',l.id+':a',[{x:180,y:340},{x:180,y:160}]);CircuitModel.connect(d,l.id+':b',g.id+':b',[{x:760,y:160},{x:760,y:340}]);CircuitACWorkbench.loadDocument(d);window.__generatorId=g.id;})()`);
 const id=await inside('__generatorId'),model='[data-component="'+id+'"] [data-generator-model]';
 await click('[data-hit="body:'+id+'"]',true);
 await click('.ac-field-details>summary');
 const alignment=await inside(`(()=>{const m=document.querySelector(${JSON.stringify(model)}),n=m.querySelector('[data-generator-pole=N]').getBBox(),s=m.querySelector('[data-generator-pole=S]').getBBox(),f=document.querySelector('.ac-field [data-generator-model]');return {dy:n.y-s.y,dh:n.height-s.height,field:!!f,angle:Number(m.dataset.generatorAngle)};})()`);
 assert(Math.abs(alignment.dy)<1e-9&&Math.abs(alignment.dh)<1e-9);assert(alignment.field);checks+=3;
 await screenshot(source+'-generator-aligned');
 async function sample(duration){return inside(`new Promise(resolve=>{const samples=[],start=performance.now();function frame(t){const a=CircuitACWorkbench.getAnalysis(),m=document.querySelector(${JSON.stringify(model)}),f=document.querySelector('.ac-field [data-generator-model]');samples.push({time:a.time,phase:a.components[${JSON.stringify(id)}].phase,drawn:Number(m.dataset.generatorAngle),field:Number(f.dataset.generatorAngle),ports:[...document.querySelectorAll(${JSON.stringify('[data-port^="'+id+':"]')})].map(p=>[p.getAttribute('cx'),p.getAttribute('cy')])});if(t-start<${duration})requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);})`);}
 await click('[data-circuit-id=pause]');const live=await sample(1100);await click('[data-circuit-id=pause]');
 assert(live.length>30);assert(new Set(live.map(p=>p.drawn)).size>25);assert(live.every(p=>Math.abs(p.drawn-p.phase)<1e-8&&Math.abs(p.field-p.phase)<1e-8));assert.equal(new Set(live.map(p=>JSON.stringify(p.ports))).size,1);checks+=4;
 const frozen=await sample(200);assert.equal(new Set(frozen.map(p=>p.drawn)).size,1);assert.equal(new Set(frozen.map(p=>p.time)).size,1);checks+=2;
 await click('[data-circuit-id=slowMotion]');await click('[data-circuit-id=pause]');const slow=await sample(1100);await click('[data-circuit-id=pause]');await click('[data-circuit-id=slowMotion]');
 const normalDt=live.at(-1).time-live[0].time,slowDt=slow.at(-1).time-slow[0].time;assert(slowDt>0&&slowDt<normalDt*.5);assert(slow.every(p=>Math.abs(p.drawn-p.phase)<1e-8));checks+=2;
 const saved=await call('captureSession()');await call('advanceTime(.137)');await call('restoreSession('+JSON.stringify(saved)+')');assert.equal(await call('getPlayback().paused'),true);assert.equal(await inside(`Number(document.querySelector(${JSON.stringify(model)}).dataset.generatorAngle)`),saved.physics.sources[id]);checks+=2;
 const before=await call('captureSession()');await call('setReadOnly(true)');const readonly=await sample(200);assert.equal(new Set(readonly.map(p=>p.drawn)).size,1);await call('setReadOnly(false)');assert.deepEqual(await call('captureSession()'),before);checks+=2;
 await click('[data-hit="body:'+id+'"]',true);
 for(let i=0;i<4;i++){await click('[data-circuit-id=rotateSelected]');assert.equal(await call('getDocument().components.find(c=>c.id==='+JSON.stringify(id)+').angle'),(i+1)*90%360);const poles=await inside(`(()=>{const p=[...document.querySelector(${JSON.stringify(model)}).querySelectorAll('[data-generator-pole]')].map(e=>e.getBoundingClientRect());return {dx:p[0].x-p[1].x,dy:p[0].y-p[1].y};})()`);assert(Math.abs(i%2===0?poles.dx:poles.dy)<.01);checks+=2;}
 await click('[data-circuit-id=schematicView]');assert.equal(await inside('!!document.querySelector('+JSON.stringify(model)+')'),false);await click('[data-circuit-id=realView]');assert(await inside('!!document.querySelector('+JSON.stringify(model)+')'));checks+=2;
 await call('setFieldDisplay(false)');assert(await inside(`Array.from(document.querySelector(${JSON.stringify(model)}).querySelectorAll('[data-generator-field]')).every(e=>e.getAttribute('opacity')==='0')`));await call('setFieldDisplay(true)');checks++;
 // A running parameter preview has its own phase; cancellation keeps the saved session.
 await click('[data-circuit-id=pause]');const range=await point('input[aria-label="轉動頻率滑塊"]');await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...range,button:'left',buttons:1,clickCount:1});
 const preview=await sample(450);assert(preview.length>10&&new Set(preview.map(p=>p.drawn)).size>8);assert(preview.every(p=>Math.abs(p.drawn-p.field)<1e-8));await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...range,button:'left',buttons:0,clickCount:1});await call('setPlayback({paused:true})');checks+=2;
 for(const [width,height] of [[390,844],[320,500]]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await call('fit()');await delay(80);
  await touch(await point('[data-hit="body:'+id+'"]',true));assert.equal(await call('getInteraction().selection.id'),id);const at=await call('captureSession()');await touch(await point('[data-circuit-id=rotateSelected]'));assert.equal(await call('getAnalysis().time'),at.physics.time);assert.equal(await call('getDocument().components.find(c=>c.id==='+JSON.stringify(id)+').angle'),(at.document.components.find(c=>c.id===id).angle+90)%360);checks+=3;
  const layout=await inside('({scroll:document.documentElement.scrollWidth-innerWidth,button:document.querySelector("[data-circuit-id=pause]").getBoundingClientRect().height})');assert(layout.scroll<=1&&layout.button>=44);checks++;await screenshot(source+'-generator-phone-'+width);
 }
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 console.log(source+' generator '+checks+' checks, '+live.length+' RAF poses; main/field phase follows solver, ports remain fixed');
 return checks;
}
module.exports={generatorCases};
