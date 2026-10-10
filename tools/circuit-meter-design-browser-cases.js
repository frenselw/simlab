'use strict';
require('../sim/circuit-workbench/circuit-ac-components');
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model');
function fixture(type,{reverseCurrent=false,reverseVoltage=false}={}){
 const d=M.empty('transient');d.cables.length=1200;
 const source=M.add(d,'ac-source',160,330,{frequency:1,voltage:6});source.angle=90;
 const meter=M.add(d,type,400,180,{range:type==='ac-ammeter'?3:type==='ac-voltmeter'?15:20});
 const load=M.add(d,'resistor',650,330,{resistance:12});load.angle=90;
 const link=(a,ap,b,bp,via=[])=>M.connect(d,a.id+':'+ap,b.id+':'+bp,via,'free');
 if(type==='ac-voltmeter'){
  meter.y=330;link(source,'a',load,'a',[{x:160,y:180},{x:650,y:180}]);link(load,'b',source,'b',[{x:650,y:450},{x:160,y:450}]);
  link(meter,reverseVoltage?'b':'a',load,'a',[{x:340,y:270}]);link(meter,reverseVoltage?'a':'b',load,'b',[{x:460,y:450},{x:650,y:450}]);
 }else{
  link(source,'a',meter,reverseCurrent?'b':'a',[{x:160,y:160}]);link(meter,reverseCurrent?'a':'b',load,'a',[{x:650,y:160}]);link(load,'b',source,'b',[{x:650,y:450},{x:160,y:450}]);
  if(type==='ac-wattmeter'){link(meter,reverseVoltage?'d':'c',load,'a',[{x:310,y:220},{x:310,y:100},{x:650,y:100}]);link(meter,reverseVoltage?'c':'d',load,'b',[{x:480,y:220},{x:480,y:450},{x:650,y:450}]);}
 }
 return M.validate(d);
}
async function meterDesignCases({inside,call,click,point,cdp,touch,screenshot,source,delay,load}){
 let checks=0;const types=['ac-ammeter','ac-voltmeter','ac-wattmeter'];
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 const gallery=M.empty('transient');for(const [i,type]of [...types,'wattmeter'].entries()){const c=M.add(gallery,type,150+i*230,280);c.label=type==='wattmeter'?'直流功率表（參考）':{'ac-ammeter':'交流電流表','ac-voltmeter':'交流電壓表','ac-wattmeter':'交流功率表'}[type];}
 await call('loadDocument('+JSON.stringify(gallery)+')');await call('fit()');
 const names=require('../sim/circuit-workbench/circuit-ac-presets').names;
 assert.deepEqual(await inside('[...document.querySelector("[data-circuit-id=preset]").options].filter(o=>o.value!=="custom").map(o=>[o.value,o.text])'),[['empty',names.empty],...Object.entries(names).filter(([key])=>key!=='empty')]);checks++;
 assert.deepEqual(await inside('[...document.querySelector("[data-circuit-id=preset]").querySelectorAll("optgroup")].map(g=>g.label)'),['交流基礎','電容與電感','變壓器與互感','振盪電路']);checks++;
 assert(await inside('![...document.querySelectorAll(".panel summary")].some(e=>e.textContent==="實驗操作")'));checks++;
 for(const [i,type]of types.entries()){
  const id='c'+(i+1),art='[data-component="'+id+'"] [data-ac-apparatus]';
  const shape=await inside(`(()=>{const m=document.querySelector(${JSON.stringify(art)}),box=m.querySelector('[data-meter-case]');return {w:Number(box.getAttribute('width')),h:Number(box.getAttribute('height')),plain:m.querySelectorAll('text').length,unit:!!m.querySelector('[data-tex]'),ports:document.querySelectorAll('[data-port-label^="${id}:"]').length,ticks:m.querySelectorAll('[data-meter-tick]').length,needle:!!m.querySelector('[data-meter-needle]')};})()`);
  assert.equal(shape.w,92);assert.equal(shape.h,78);assert.equal(shape.plain,0);assert(shape.unit&&shape.needle);assert.equal(shape.ports,type==='ac-wattmeter'?4:0);assert.equal(shape.ticks,type==='ac-wattmeter'?61:31);checks+=6;
 }
 assert.deepEqual(await inside(`[...document.querySelectorAll('[data-port-label^="c3:"]')].map(e=>e.dataset.tex)`),['I_{+}','I_{-}','V_{+}','V_{-}']);checks++;
 await screenshot(source+'-compact-ac-meters');await click('[data-circuit-id=schematicView]');
 assert(await inside('[...document.querySelectorAll("[data-circuit-id=scene] [data-ac-apparatus] [data-tex]")].filter(e=>e.dataset.tex.includes("sim")).length===3&&![...document.querySelectorAll("[data-circuit-id=scene] [data-ac-apparatus] text")].length'));checks++;
 await screenshot(source+'-compact-ac-meters-schematic');await click('[data-circuit-id=realView]');
 // A and V reversal must retain RMS; W reversal of one coil must invert power.
 for(const [type,options,expected]of [['ac-ammeter',{reverseCurrent:true},.5],['ac-voltmeter',{reverseVoltage:true},6],['ac-wattmeter',{},3],['ac-wattmeter',{reverseCurrent:true},-3],['ac-wattmeter',{reverseCurrent:true,reverseVoltage:true},3]]){
  await call('loadDocument('+JSON.stringify(fixture(type,options))+')');await call('advanceTime(1.1)');const r=await call('getAnalysis().components.c2');assert.equal(r.meterStatus,'normal');assert(Math.abs(r.reading-expected)<.015);checks+=2;
 }
 await call('loadDocument('+JSON.stringify(fixture('ac-wattmeter'))+')');await call('advanceTime(1.1)');await click('[data-hit="body:c2"]',true);
 assert(await inside('document.querySelector(".reading-host").textContent.includes("電流端")&&[...document.querySelectorAll(".reading-host [data-tex]")].some(e=>e.dataset.tex==="I_{+}")'));checks++;
 const beforeRotation=await call('captureSession()');
 for(let i=0;i<4;i++){await click('[data-circuit-id=rotateSelected]');assert.equal(await call('getAnalysis().time'),beforeRotation.physics.time);assert(await inside(`document.querySelectorAll('[data-port-label^="c2:"] [data-mml-node=msub]').length===4`));checks+=2;}
 const saved=await call('captureSession()');assert.equal(saved.document.components[1].angle,beforeRotation.document.components[1].angle);assert.deepEqual(saved.physics,beforeRotation.physics);checks+=2;
 await screenshot(source+'-compact-ac-wattmeter-connected');
 // Trusted phone taps still select the compact body and open a readable dial.
 for(const width of [390,320]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:true});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await call('fit()');await delay(60);
  await touch(await point('[data-hit="body:c2"]',true));assert.equal(await call('getInteraction().selection.id'),'c2');checks++;
  await touch(await point('[data-circuit-id=inspectMeter]'));
  const bounds=await inside('(()=>{const d=document.querySelector("[data-circuit-id=meterDialog]"),r=d.getBoundingClientRect(),svg=d.querySelector("svg");return {open:d.open,left:r.left,right:r.right,top:r.top,bottom:r.bottom,box:svg.getAttribute("viewBox"),math:svg.querySelectorAll("[data-tex]").length};})()');
  assert(bounds.open&&bounds.left>=0&&bounds.right<=width+1&&bounds.top>=0&&bounds.bottom<=600+1);assert.equal(bounds.box,'-43 -40 86 62');assert(bounds.math>=6);assert.deepEqual(await call('captureSession()'),saved);checks+=4;
  await screenshot(source+'-compact-ac-meter-phone-'+width);await touch(await point('[data-circuit-id=closeMeter]'));assert.deepEqual(await call('captureSession()'),saved);checks++;
 }
 await load('/circuit-ac-workbench/activity-examples.html','window','CircuitACExample');assert.deepEqual(await inside('[...document.querySelectorAll("[data-example]")].map(e=>e.textContent)'),['變壓器：匝數與負載','LC：充電與振盪']);assert(await inside('document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll("[data-example]")].every(e=>e.getBoundingClientRect().height>=44)'));checks+=2;
 console.log(source+' compact meter / terminal notation / preset design: '+checks+' checks');return checks;
}
module.exports={fixture,meterDesignCases};
