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
 }
 console.log(source+' source protection UI: '+checks+' checks passed');return checks;
}
module.exports={sourceProtectionCases};
