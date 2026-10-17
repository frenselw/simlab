'use strict';
const assert=require('node:assert/strict'),P=require('../sim/circuit-workbench/circuit-ac-presets');
async function transformerCases({inside,call,click,point,cdp,touch,screenshot,source,delay}){
 let checks=0;await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await call('loadDocument('+JSON.stringify(P.create('transformer'))+')');await call('advanceTime(1.125)');await click('[data-hit="body:c2"]',true);await click('.ac-field-details>summary');
 async function field(){return inside(`(()=>{const d=CircuitACWorkbench.getDocument(),a=CircuitACWorkbench.getAnalysis(),c=d.components.find(c=>c.id==='c2'),r=CircuitRenderer.displayComponent(d,a,c),scene=document.querySelector('[data-component=c2]'),g=scene.querySelector('[data-field-kind=transformer-core]'),caption=document.querySelector('[data-transformer-ratio="c2"]'),ratio=caption.getBoundingClientRect(),core=scene.querySelector('[data-transformer-core]')?.getBoundingClientRect(),panel=document.querySelector('.ac-field [data-field-kind=transformer-core]');return {flux:r.coreFlux,current:r.current,sign:Number(g?.dataset.fieldSign),panelSign:Number(panel?.dataset.fieldSign),visible:g?.getAttribute('opacity'),paths:g?.querySelectorAll('[data-field-line=core-closed]').length,ratioAbove:core?ratio.bottom<core.top:true,ratio:caption.dataset.tex,ratioFont:Number(caption.getAttribute('font-size'))*CircuitACWorkbench.getInteraction().camera.scale,duplicates:document.querySelectorAll('[data-component-value=c2]').length};})()`);}
 let f=await field();assert(f.flux<0&&f.sign===-1&&f.panelSign===-1&&f.visible==='1');assert(f.paths>=2&&f.paths<=4);assert(f.ratioAbove);assert.equal(f.ratio,'N_1:N_2=2:1');assert.equal(f.duplicates,0);assert(f.ratioFont>=17.9,'single ratio uses the normal readable screen font');checks+=6;
 assert(await inside('document.querySelectorAll("[data-component=c2] [data-core-lamination]").length===6'));checks++;
 async function resources(){return inside(`(()=>{const ids=[...document.querySelectorAll('[id*="transformer-art-"]')].map(e=>e.id);return new Set(ids).size===ids.length&&[...document.querySelectorAll('[data-ac-apparatus=transformer]')].every(body=>[...body.querySelectorAll('[fill],[stroke],[mask],[clip-path]')].every(e=>[...e.attributes].every(a=>{const ref=a.value.match(/^url\\(#([^)]*)\\)$/);return !ref||document.getElementById(ref[1])?.closest('[data-ac-apparatus=transformer]')===body;})));})()`);}
 assert(await resources());assert(await inside('(()=>{const b=document.querySelector("[data-component=c2]"),coils=[...b.querySelectorAll("[data-transformer-winding]")],slot=b.querySelector("[data-transformer-field-slot]");return coils.every(c=>c.getAttribute("opacity")==="1"&&(c.compareDocumentPosition(slot)&Node.DOCUMENT_POSITION_FOLLOWING))&&!!slot.querySelector("[data-field-occluded]");})()'));checks+=2;
 // Sample actual SVG curves to ensure the closed magnetic paths stay inside the iron.
 assert(await inside(`(()=>{const b=document.querySelector('[data-component=c2]'),core=b.querySelector('[data-core-face]');return [...b.querySelectorAll('[data-field-line=core-closed]')].every(p=>{const length=p.getTotalLength();return Array.from({length:161},(_,n)=>p.getPointAtLength(length*n/160)).every(pt=>core.isPointInFill(pt));});})()`));checks++;
 await screenshot(source+'-transformer-core-field');
 const frozen=await call('captureSession()');await call('setPlayback({paused:false})');
 const live=await inside(`new Promise(resolve=>{const samples=[],start=performance.now();function frame(t){const d=CircuitACWorkbench.getDocument(),a=CircuitACWorkbench.getAnalysis(),c=d.components.find(c=>c.id==='c2'),r=CircuitRenderer.displayComponent(d,a,c),m=document.querySelector('[data-component=c2] [data-field-kind=transformer-core]'),p=document.querySelector('.ac-field [data-field-kind=transformer-core]');samples.push({flux:r.coreFlux,m:Number(m.dataset.fieldSign),p:Number(p.dataset.fieldSign)});const enough=samples.length>=12&&samples.some(s=>s.m===1)&&samples.some(s=>s.m===-1);if(t-start<4000&&(t-start<500||!enough))requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);})`);
 await call('setPlayback({paused:true})');assert(live.length>=12);assert(live.every(s=>s.m===Math.sign(s.flux)&&s.p===s.m));assert(live.some(s=>s.m===1)&&live.some(s=>s.m===-1));checks+=3;
 await click('.panel-section:has(.ac-field-details) input[type=checkbox]');assert(await inside('!document.querySelector("[data-component=c2] [data-field-kind]")&&!!document.querySelector(\'[data-transformer-ratio="c2"]\')'));checks++;
 assert(await inside('[...document.querySelectorAll("[data-component=c2] [data-transformer-winding], [data-component=c2] [data-transformer-back]")].every(e=>e.getAttribute("opacity")==="1")'));assert(await resources());checks+=2;await screenshot(source+'-transformer-solid-windings');
 await click('.panel-section:has(.ac-field-details) input[type=checkbox]');await click('[data-field-open]');assert(await inside('document.querySelector(".ac-field-dialog").open&&!!document.querySelector(".ac-field-large [data-field-kind=transformer-core]")'));checks++;
 assert(await resources());checks++;
 await screenshot(source+'-transformer-field-dialog');await click('[data-field-close]');
 // Multiple editors/components must not share gradient or clipping resources.
 const unchanged=await call('captureSession()');
 await inside(`(async()=>{const host=document.createElement('div');host.id='transformer-second-editor';host.style.cssText='position:fixed;left:-10000px;top:0;width:900px;height:800px';document.body.append(host);const d=CircuitACPresets.create('transformer');CircuitModel.add(d,'transformer',650,430,{primaryTurns:1,secondaryTurns:2000});window.__transformerSecond=await CircuitEditor.mount(host,{role:'teacher',analysis:'transient',palette:CircuitAC.palette,initialDocument:d,idPrefix:'transformer-second-'});__transformerSecond.setPlayback({paused:true});__transformerSecond.advanceTime(1.125);host.querySelector('.ac-field-details').open=true;})()`);await delay(80);
 assert(await resources());assert(await inside('document.querySelectorAll("#transformer-second-editor [data-component] [data-transformer-core]").length===2'));assert.deepEqual(await call('captureSession()'),unchanged);checks+=3;
 await inside('__transformerSecond.destroy();document.getElementById("transformer-second-editor").remove();delete window.__transformerSecond');
 // Annotation remains above the core and readable through every rotation.
 const before=await call('captureSession()');for(let i=0;i<4;i++){await click('[data-circuit-id=rotateSelected]');assert((await field()).ratioAbove);assert.equal(await call('getAnalysis().time'),before.physics.time);checks+=2;}
 await click('[data-circuit-id=schematicView]');assert(await inside('!!document.querySelector("[data-component=c2] [data-field-kind=transformer-core]")&&!!document.querySelector(\'[data-transformer-ratio="c2"][data-tex]\')'));checks++;
 await screenshot(source+'-transformer-schematic-field');await click('[data-circuit-id=realView]');
 await call('execute({type:"setParam",id:"c2",key:"secondaryTurns",value:200})');assert.equal((await field()).ratio,'N_1:N_2=1:1');assert.equal((await field()).visible,'0');checks+=2;
 await call('advanceTime(1.125)');assert((await field()).visible==='1');checks++;
 for(const turns of [1,2000]){await call('execute({type:"setParam",id:"c2",key:"primaryTurns",value:'+turns+'})');await call('execute({type:"setParam",id:"c2",key:"secondaryTurns",value:'+turns+'})');await call('advanceTime(1.125)');assert(await resources());assert(await inside('[...document.querySelectorAll("[data-component=c2] [data-transformer-winding]")].every(e=>Number(e.dataset.visibleTurns)==='+require('../sim/circuit-workbench/circuit-ac-components').transformerTurns(turns)+')'));assert(await inside('(()=>{const body=document.querySelector("[data-component=c2] [data-ac-apparatus=transformer]"),leads=[...body.querySelectorAll("[data-transformer-leads] path")].map(p=>p.getBBox());return leads.every(b=>b.x>=53||b.x+b.width<=-53);})()'));checks+=3;await screenshot(source+'-transformer-turns-'+turns);}
 // Empty secondary must not erase the ideal transformer's core flux.
 const empty=P.create('transformer',{comparisonMeters:false});empty.components=empty.components.filter(c=>['ac-source','transformer'].includes(c.type));const ids=new Set(empty.components.map(c=>c.id));empty.wires=empty.wires.filter(w=>ids.has(w.from.split(':')[0])&&ids.has(w.to.split(':')[0]));
 await call('loadDocument('+JSON.stringify(empty)+')');await call('advanceTime(1.125)');await click('[data-hit="body:c2"]',true);f=await field();assert.equal(f.current,0);assert(f.visible==='1'&&Math.abs(f.flux)>.001);checks+=2;
 await call('execute({type:"setParam",id:"c1",key:"voltage",value:0})');await call('advanceTime(1.125)');f=await field();assert.equal(f.flux,0);assert.equal(f.visible,'0');assert.equal(f.panelSign,0);checks+=3;
 await call('loadDocument('+JSON.stringify(P.create('coupled'))+')');await call('advanceTime(1.125)');await click('[data-hit="body:c2"]',true);f=await field();assert.equal(f.sign,Math.sign(f.flux));assert(f.visible==='1');checks+=2;
 await call('restoreSession('+JSON.stringify(frozen)+')');assert.equal((await field()).visible,'0','restored ideal flux awaits an observed cycle');await call('advanceTime(1)');assert.equal((await field()).visible,'1');assert(await inside('Number(document.querySelector(".ac-field [data-readout-bar=coreFlux] [role=meter]").getAttribute("aria-valuemax"))>=CircuitACWorkbench.getAnalysis().components.c2.coreFluxPeak'));checks+=3;
 for(const width of [390,320]){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:true});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await call('fit()');await delay(60);await touch(await point('[data-hit="body:c2"]',true));assert.equal(await call('getInteraction().selection.id'),'c2');checks++;
  if(await inside('getComputedStyle(document.querySelector("[data-circuit-id=focusSelected]")).display==="none"')){await touch(await point('[data-circuit-id=moreSelected]'));await touch(await point('[data-selection-action=focusSelected]'));}else await touch(await point('[data-circuit-id=focusSelected]'));
  assert((await field()).ratioFont>=17.9,'phone zoom retains a readable ratio');checks++;await screenshot(source+'-transformer-ratio-readable-'+width);
  const snap=await call('captureSession()');await touch(await point('[data-field-open]'));assert(await inside('(()=>{const d=document.querySelector(".ac-field-dialog"),r=d.getBoundingClientRect(),svg=d.querySelector(".ac-field-diagram"),b=svg.getBBox(),v=svg.viewBox.baseVal;return d.open&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1&&b.y>=v.y&&b.y+b.height<=v.y+v.height;})()'));assert(await inside('[...document.querySelectorAll(".ac-field-large .ac-bar-value")].every(e=>e.scrollWidth<=e.clientWidth+1)'));assert.deepEqual(await call('captureSession()'),snap);checks+=3;
  await screenshot(source+'-transformer-field-phone-'+width);await touch(await point('[data-field-close]'));
  await call('fit()');await delay(60);
  const beforeCable=await call('captureSession()');let previewSeen=false;await touch(await point('[data-circuit-id=pickWire]'));
  await touch(await point('[data-hit="wireend:w1:to"]'),0,12,true,async()=>{if(await inside('!document.querySelector("[data-circuit-id=preview]").hidden')){previewSeen=true;assert(await resources(),'touch-preview SVG resources resolve locally without duplicate ids');}});
  await touch(await point('[data-circuit-id=pickWire]'));assert(previewSeen);assert.deepEqual(await call('captureSession()'),beforeCable);checks+=2;
 }
 console.log(source+' transformer core/ratio/flux checks: '+checks+'; '+live.length+' synchronized RAF samples');return checks;
}
async function transformerComparisonCases(h,source){let checks=0;
 for(const width of [1280,390]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await h.call('loadDocument('+JSON.stringify(P.create('transformer'))+')');await h.call('setPlayback({paused:true})');
  const doc=await h.call('getDocument()'),t=doc.components.find(c=>c.type==='transformer'),load=doc.components.find(c=>c.label==='負載電阻'),meters=doc.components.filter(c=>['ac-ammeter','ac-voltmeter'].includes(c.type));assert.equal(meters.length,4);assert.equal(doc.wires.filter(w=>w.from.split(':')[0]===t.id||w.to.split(':')[0]===t.id).length,4);checks+=2;
  for(const turns of width===1280?[100,200,400]:[100,400]){
   await h.call('execute({type:"setParam",id:'+JSON.stringify(t.id)+',key:"secondaryTurns",value:'+turns+'})');await h.call('advanceTime(8)');const a=await h.call('getAnalysis()'),reflected=12/(turns/200)**2,primary=6*a.components.c1.protection.scale*reflected/(reflected+.05),v=primary*turns/200,current=v/12;if(turns===400)assert(a.measurements.c1.currentRms<=1.001);assert(a.reliable);checks++;
   for(const c of meters){const expected=c.label==='原線圈電壓表'?primary:c.label==='副線圈電壓表'?v:c.label==='副線圈電流表'?current:current*turns/200;assert(Math.abs(a.components[c.id].reading-expected)<Math.max(.002,expected*.001));assert.equal(a.components[c.id].meterStatus,'normal');checks+=2;}
   if(turns===100){assert(await h.inside('document.documentElement.scrollWidth<=innerWidth+1'));checks++;await h.screenshot(source+'-transformer-four-meters-'+width);}
  }
  if(width===1280){await h.call('execute({type:"setParam",id:'+JSON.stringify(load.id)+',key:"resistance",value:24})');const before=await h.call('getAnalysis().components.c1.protection.scale');await h.call('advanceTime(8)');const a=await h.call('getAnalysis()'),primary=6*a.components.c1.protection.scale*6/(6+.05);assert(a.components.c1.protection.scale>before);for(const c of meters){const expected=c.label==='原線圈電壓表'?primary:c.label==='副線圈電壓表'?primary*2:c.label==='副線圈電流表'?primary/12:primary/6;assert(Math.abs(a.components[c.id].reading-expected)<expected*.001);checks++;}}
 }
 console.log(source+' transformer comparison meters: '+checks+' checks passed');return checks;
}
async function mutualLayoutCases(h,source){let checks=0;
 for(const width of [1280,390]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await h.call('loadDocument('+JSON.stringify(P.create('mutual'))+')');await h.call('setPlayback({paused:true})');
  for(const view of ['real','schematic']){await h.click('[data-circuit-id='+ (view==='real'?'realView':'schematicView')+']');assert(await h.inside('document.documentElement.scrollWidth<=innerWidth+1'));assert.equal((await h.call('getDocument()')).components.length,7);checks+=2;await h.screenshot(source+'-mutual-clean-layout-'+view+'-'+width);}
  await h.click('[data-circuit-id=realView]');await h.click('[data-hit="body:c5"]',true);await h.call('advanceTime(.02)');const on=await h.call('getAnalysis()');assert(on.reliable);assert(Math.abs(on.components.c4.reading)>1e-5);checks+=2;
  await h.call('advanceTime(8)');const steady=await h.call('getAnalysis()');assert(steady.reliable);assert(Math.abs(steady.components.c4.reading)<1e-7);checks+=2;
  await h.click('[data-hit="body:c5"]',true);await h.call('advanceTime(.02)');const off=await h.call('getAnalysis()');assert(off.reliable);assert(on.components.c4.reading*off.components.c4.reading<0);checks+=2;await h.screenshot(source+'-mutual-switch-off-'+width);
 }
 console.log(source+' mutual layout and induction: '+checks+' checks passed');return checks;
}
async function transmissionCases(h,source){
 let checks=0;
 for(const [width,height]of [[1280,900],[390,844],[320,700]]){
  await h.cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<960});await h.cdp.send('Emulation.setTouchEmulationEnabled',{enabled:width<960,maxTouchPoints:5});
  await h.call('loadDocument('+JSON.stringify(P.create('resistive'))+')');
  const selector='[data-circuit-id=preset]';
  if(width<960)await h.touch(await h.point(selector));else await h.click(selector);
  const index=await h.inside(`Array.from(document.querySelector('${selector}').options).findIndex(o=>o.value==='transmission')`);assert(index>0);
  async function key(key){await h.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key});await h.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key});}
  await key('Home');for(let n=0;n<index;n++)await key('ArrowDown');await key('Enter');await h.delay(100);
  assert.equal(await h.inside(`document.querySelector('${selector}').value`),'transmission');
  await h.call('setPlayback({paused:false})');await h.delay(1200);await h.call('setPlayback({paused:true})');await h.call('advanceTime(.08)');const doc=await h.call('getDocument()'),out=await h.call('getAnalysis()');assert.equal(out.diagnostics.length,0);assert.equal(doc.components.length,11);
  for(const meter of doc.components.filter(c=>c.type==='ac-ammeter'||c.type==='ac-voltmeter'))assert.equal(out.components[meter.id].meterStatus,'normal');
  assert(out.measurements.c9.averagePower>out.measurements.c3.averagePower*1.8);assert(out.components.c10.reading>22000&&out.components.c10.reading<23001);checks+=10;
  assert(await h.inside('document.documentElement.scrollWidth<=innerWidth+1'));checks++;
  for(const view of ['real','schematic']){
   if(await h.call('getDocument().display.view')!==view)await h.click('[data-circuit-id='+(view==='real'?'realView':'schematicView')+']');
   assert.equal(await h.call('getDocument().display.view'),view);assert.equal(await h.inside('document.querySelectorAll("[data-component]").length'),11);checks+=2;
   await h.screenshot(source+'-transmission-'+width+'-'+view);
  }
  if(width<960){
   await h.touch(await h.point('[data-hit="body:c10"]',true));assert.equal((await h.call('getInteraction()')).selection.id,'c10');
   async function action(id){const selector='[data-circuit-id='+id+']';if(await h.inside(`getComputedStyle(document.querySelector('${selector}')).display==='none'`)){await h.touch(await h.point('[data-circuit-id=moreSelected]'));await h.touch(await h.point('[data-selection-action='+id+']'));}else await h.touch(await h.point(selector));}
   await action('focusSelected');assert((await h.call('getInteraction()')).camera.scale>=1);await action('inspectMeter');assert(await h.inside('document.querySelector("[data-circuit-id=meterDialog]").open'));checks+=3;
   assert(await h.inside('document.querySelector("[data-circuit-id=meterDetail] [data-meter-unit]").dataset.math==="kV~"'));assert(await h.inside('Math.abs(Number(document.querySelector("[data-circuit-id=meterDetail] [data-meter-needle]").dataset.fraction)-23/30)<.01'));checks+=2;
   await h.screenshot(source+'-transmission-'+width+'-meter-detail');await h.touch(await h.point('[data-circuit-id=closeMeter]'));
  }
  const saved=await h.call('captureSession()');await h.call('advanceTime(.02)');await h.call('restoreSession('+JSON.stringify(saved)+')');await h.call('advanceTime(.02)');assert.equal(await h.call('getAnalysis().diagnostics.length'),0);checks++;
  await h.call('execute({type:"setParam",id:"c9",key:"resistance",value:1058})');await h.call('advanceTime(.06)');assert(await h.call('getAnalysis().measurements.c9.averagePower')<51);checks++;
  await h.call('loadDocument('+JSON.stringify(P.create('transmission'))+')');await h.call('setPlayback({paused:false})');const before=await h.call('getAnalysis().time');await h.delay(200);await h.call('setPlayback({paused:true})');assert(await h.call('getAnalysis().time')>before);assert.equal(await h.call('getAnalysis().diagnostics.length'),0);checks+=2;
 }
 await h.cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 console.log(source+' high-voltage transmission preset, metered comparison and continuation: '+checks+' checks passed');return checks;
}
module.exports={transformerCases,transformerComparisonCases,mutualLayoutCases,transmissionCases};
