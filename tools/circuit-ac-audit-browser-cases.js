'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model');
const {settingsDraftCases}=require('./circuit-settings-browser-cases');
const link=(d,a,b,ap='a',bp='a')=>M.connect(d,a.id+':'+ap,b.id+':'+bp);
async function auditCases(h,source){
  let checks=0;
  await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await h.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  const d=M.empty('transient'),meters=[];
  for(const [index,frequency]of [1,.1].entries()){const y=180+index*340,s=M.add(d,'ac-source',150,y,{frequency}),r=M.add(d,'resistor',470,y-80,{resistance:12}),v=M.add(d,'ac-voltmeter',470,y+80);link(d,s,r);link(d,s,r,'b','b');link(d,s,v);link(d,s,v,'b','b');meters.push(v.id);}
  await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('advanceTime(1.1)');let a=await h.call('getAnalysis()');assert.equal(a.measurements[meters[0]].status,'ready');assert.equal(a.measurements[meters[1]].status,'collecting');assert.equal(a.components[meters[1]].reading,null);checks+=3;
  await h.call('advanceTime(10)');a=await h.call('getAnalysis()');for(const id of meters){assert.equal(a.measurements[id].status,'ready');assert(Math.abs(a.components[id].reading-6)<.006);checks+=2;}
  await h.screenshot(source+'-independent-rms');
  const mixed=M.empty('transient'),s1=M.add(mixed,'ac-source',160,180,{frequency:1}),s2=M.add(mixed,'ac-source',380,180,{frequency:Math.SQRT2}),r=M.add(mixed,'resistor',600,180,{resistance:12});link(mixed,s1,s2,'b','a');link(mixed,s1,r);link(mixed,s2,r,'b','b');await h.call('loadDocument('+JSON.stringify(mixed)+')');await h.call('advanceTime(10)');await h.click('[data-hit="body:'+r.id+'"]',true);
  assert.equal((await h.call('getAnalysis()')).period,null);checks++;assert(await h.inside('document.querySelector(".reading-host").textContent.includes("量測採時間窗")&&document.querySelector(".reading-host").textContent.includes("不是共同週期")'));checks++;await h.screenshot(source+'-mixed-window');
  const fast=M.empty('transient'),c=M.add(fast,'capacitor',300,240,{capacitance:.0001,initialVoltage:6}),w=link(fast,c,c,'a','b');w.resistance=.00001;await h.call('loadDocument('+JSON.stringify(fast)+')');await h.call('advanceTime(.001)');a=await h.call('getAnalysis()');assert(a.reliable&&a.energyBalance.status==='reliable');assert(Math.abs(a.energy+a.dissipatedEnergy-.0018)<1.8e-6);assert(await h.inside('document.querySelector(".ac-energy").textContent.includes("累計耗散")&&!document.querySelector(".ac-energy .diagnostic")'));checks+=3;await h.inside('document.querySelector(".ac-energy").scrollIntoView({block:"nearest"})');await h.screenshot(source+'-fast-discharge-energy');
  w.resistance=1e-10;await h.call('loadDocument('+JSON.stringify(fast)+')');await h.call('advanceTime(.001)');a=await h.call('getAnalysis()');assert.equal(a.reliable,false);assert.equal(a.dissipatedEnergy,null);assert(a.diagnostics.some(d=>d.code==='time-resolution'));assert(await h.inside('document.querySelector(".ac-energy .diagnostic").textContent.includes("未能可靠確定")'));checks+=4;await h.inside('document.querySelector(".ac-energy").scrollIntoView({block:"nearest"})');await h.screenshot(source+'-unresolved-discharge');
  const micro=M.empty('transient'),battery=M.add(micro,'battery',150,260,{voltage:6}),load=M.add(micro,'resistor',420,180,{resistance:.01}),v=M.add(micro,'ac-voltmeter',420,400,{resistance:1e12});link(micro,battery,load);link(micro,battery,load,'b','b');const top=link(micro,battery,v);link(micro,battery,v,'b','b');for(const reversed of [false,true]){if(reversed)[top.from,top.to]=[top.to,top.from];await h.call('loadDocument('+JSON.stringify(micro)+')');a=await h.call('getAnalysis()');assert(Math.abs(a.wires[top.id].current-(reversed?-6e-12:6e-12))<1e-20);checks++;}
  checks+=await settingsDraftCases(h,source);console.log(source+' full-workbench AC audit checks: '+checks);return checks;
}
module.exports={auditCases};
