'use strict';
const assert=require('node:assert/strict'),P=require('../sim/circuit-workbench/circuit-ac-presets'),M=require('../sim/circuit-workbench/circuit-model');
async function sourceProtectionCases(h,source){let checks=0;
 for(const width of [1280,390,320]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await h.call('loadDocument('+JSON.stringify(P.create('transformer'))+')');await h.call('setPlayback({paused:true})');await h.click('[data-hit="body:c1"]',true);
  assert.equal(await h.inside('document.querySelector("[data-source-protection]").open'),false);checks++;
  async function tap(selector){await h.inside('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');await h.delay(40);const p=await h.point(selector);await h.touch(p);}
  await tap('[data-source-protection]>summary');assert.equal(await h.inside('document.querySelector("[data-source-protection]").open'),true);checks++;
  assert(await h.inside('document.querySelector("[data-param=protectionEnabled]").checked'));assert(await h.inside('document.querySelector("[data-protection-reset]").hidden'));checks+=2;
  await tap('[data-param=protectionEnabled]');assert.equal(await h.call('getDocument().components[0].params.protectionEnabled'),false);assert.equal(await h.inside('document.querySelector("[data-source-protection]").open'),true);checks+=2;
  await tap('[data-param=protectionEnabled]');assert.equal(await h.call('getDocument().components[0].params.protectionEnabled'),true);checks++;
  // A native keyboard edit reaches the common parameter pipeline.
  await tap('[data-param=maxCurrent]');await h.inside('document.querySelector("[data-param=maxCurrent]").select()');await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2});await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2});await h.send('Input.insertText',{text:'0.1'});await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  assert.equal(await h.call('getDocument().components[0].params.maxCurrent'),.1);assert.equal(await h.call('getAnalysis().components.c1.protection.status'),'limited');checks+=2;
  await h.call('advanceTime(1.125)');assert(Math.abs(await h.call('getAnalysis().components.c5.reading')-.1)<.001);assert(Math.abs(await h.call('getAnalysis().components.c6.reading')-4.8)<.005);checks+=2;
  await h.screenshot(source+'-source-protection-'+width);
  const d=P.create('transformer');M.connect(d,'c1:a','c1:b');await h.call('loadDocument('+JSON.stringify(d)+')');await h.click('[data-hit="body:c1"]',true);await tap('[data-source-protection]>summary');assert.equal(await h.call('getAnalysis().components.c1.protection.status'),'tripped');assert.equal(await h.inside('document.querySelector("[data-protection-reset]").hidden'),false);checks+=2;
  const saved=await h.call('captureSession()');await h.call('loadDocument('+JSON.stringify(saved)+')');assert.deepEqual(await h.call('captureSession()'),saved);checks++;
  await h.click('[data-hit="body:c1"]',true);await tap('[data-source-protection]>summary');await tap('[data-protection-reset]');assert.equal(await h.call('getAnalysis().components.c1.protection.status'),'tripped');checks++;
  const short=await h.call('getDocument().wires.find(w=>[w.from,w.to].includes("c1:a")&&[w.from,w.to].includes("c1:b")).id');await h.call('execute({type:"remove",id:'+JSON.stringify(short)+'})');assert.equal(await h.call('getAnalysis().components.c1.protection.status'),'tripped');checks++;
  await tap('[data-protection-reset]');assert.equal(await h.call('getAnalysis().components.c1.protection.status'),'normal');assert(await h.inside('document.querySelector("[data-protection-reset]").hidden'));checks+=2;
  await h.call('setReadOnly(true)');assert.equal(await h.call('resetSourceProtection("c1")'),false);assert(await h.inside('document.querySelector("[data-param=protectionEnabled]").disabled'));checks+=2;await h.call('setReadOnly(false)');
  assert(await h.inside('document.documentElement.scrollWidth<=innerWidth+1'));assert(await h.inside('__trusted.some(e=>e.trusted&&e.pointer==="touch")'));checks+=2;
  // CW-12 uses the real checkbox after the editor has accepted charge and phase.
  for(const at of [0,.125,.25,.375,.5]){
   const d=M.empty('transient'),source=M.add(d,'ac-source',100,100,{maxCurrent:1,maxPower:6}),c=M.add(d,'capacitor',300,100,{capacitance:.02});for(const p of ['a','b'])M.connect(d,source.id+':'+p,c.id+':'+p);
   await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('setPlayback({paused:true})');if(at>0)await h.call('advanceTime('+at+')');const before=await h.call('captureSession()');await h.click('[data-hit="body:c1"]',true);
   if(!await h.inside('document.querySelector("[data-source-protection]").open'))await tap('[data-source-protection]>summary');await tap('[data-param=protectionEnabled]');
   const after=await h.call('captureSession()');assert.equal(after.physics.protection.c1.status,'normal');assert.equal(after.physics.time,before.physics.time);assert.equal(after.physics.sources.c1,before.physics.sources.c1);assert(Math.abs(after.physics.dynamic['c2:a'].v-before.physics.dynamic['c2:a'].v)<1e-9);checks+=4;
   await h.call('advanceTime(1.125)');assert.equal(await h.call('getAnalysis().diagnostics.length'),0);assert(Math.abs(await h.call('getAnalysis().measurements.c1.currentRms')-2*Math.PI*.02*6)<.001);const saved=await h.call('captureSession()');await h.call('restoreSession('+JSON.stringify(saved)+')');await h.call('advanceTime(.005)');assert.equal(await h.call('getAnalysis().diagnostics.length'),0);checks+=3;
  }
  // CW-13 goes through production add/attach commands, rather than a reloaded fixture.
  for(const state of ['none','normal','tripped']){
   const d=M.empty('transient'),a=M.add(d,'ac-source',100,100),r=M.add(d,'resistor',300,100);for(const p of ['a','b'])M.connect(d,a.id+':'+p,r.id+':'+p);
   if(state!=='none'){const b=M.add(d,'ac-source',100,400,{protectionEnabled:true}),r=M.add(d,'resistor',300,400);for(const p of ['a','b'])M.connect(d,b.id+':'+p,r.id+':'+p);if(state==='tripped')M.connect(d,b.id+':a',b.id+':b');}
   await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('setPlayback({paused:true})');await h.call('advanceTime(.25)');
   const cap=await h.inside(`(()=>{const e=CircuitACWorkbench;e.execute({type:'addComponent',key:'capacitor',x:500,y:100});const cap=e.getDocument().components.at(-1).id;for(const p of ['a','b']){e.execute({type:'addWire',x:250,y:250});const id=e.getDocument().wires.at(-1).id;e.execute({type:'attach',id,end:'from',target:'c1:'+p});e.execute({type:'attach',id,end:'to',target:cap+':'+p});}return cap;})()`);
   const saved=await h.call('captureSession()');assert.equal(await h.call('getAnalysis().diagnostics.length'),0);assert.equal(saved.physics.sources.c1,0);assert.equal(saved.physics.dynamic[cap+':a'].v,0);if(state==='tripped')assert.equal(saved.physics.protection.c3.status,'tripped');await h.call('restoreSession('+JSON.stringify(saved)+')');await h.call('advanceTime(.125)');assert.equal(await h.call('getAnalysis().diagnostics.length'),0);checks+=4;
   if(state==='tripped'){await h.call('execute({type:"setParam",id:'+JSON.stringify(cap)+',key:"capacitance",value:.04})');const updated=await h.call('captureSession()');assert.equal(updated.physics.sources.c1,0);assert.equal(updated.physics.dynamic[cap+':a'].v,0);assert.equal(updated.physics.protection.c3.status,'tripped');checks+=3;}
  }
  // CW-14 enables the opposing source through the common UI parameter pipeline.
  {const d=M.empty('transient'),a=M.add(d,'ac-source',100,100),b=M.add(d,'ac-source',300,100,{voltage:4}),r=M.add(d,'resistor',500,100,{resistance:1});M.connect(d,a.id+':b',b.id+':b');M.connect(d,a.id+':a',r.id+':a');M.connect(d,b.id+':a',r.id+':b');await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('setPlayback({paused:true})');await h.call('advanceTime(.125)');await h.click('[data-hit="body:c1"]',true);if(!await h.inside('document.querySelector("[data-source-protection]").open'))await tap('[data-source-protection]>summary');await tap('[data-param=protectionEnabled]');assert.equal(await h.call('getAnalysis().components.c1.protection.status'),'limited');assert(Math.abs(await h.call('getAnalysis().components.c1.protection.scale')-5/6)<1e-7);await h.call('advanceTime(1.125)');assert(await h.call('getAnalysis().measurements.c1.currentRms')<=1.001);assert(-await h.call('getAnalysis().measurements.c1.averagePower')<=6.01);checks+=4;await h.screenshot(source+'-opposing-source-limited-'+width);}
 }
 console.log(source+' source protection UI: '+checks+' checks passed');return checks;
}
module.exports={sourceProtectionCases};
