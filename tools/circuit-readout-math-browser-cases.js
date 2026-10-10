'use strict';
const assert=require('node:assert/strict');
async function readoutMathCases({inside,call,click,cdp,screenshot,source,delay,load}){
 let checks=0;
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await inside("CircuitACWorkbench.loadDocument(CircuitACPresets.create('generator'))");
 const id=await call('getDocument().components.find(c=>c.type==="generator").id');
 await click('[data-hit="body:'+id+'"]',true);await click('.ac-field-details>summary');await call('advanceTime(.123)');
 const saved=await call('captureSession()');
 async function audit(){return inside(`(()=>{const r=CircuitACWorkbench.getAnalysis().components[${JSON.stringify(id)}],d=document.querySelector('.ac-field'),keys=['phase','flux','fluxLinkage','sourceEmf'];return {rows:keys.map(key=>{const el=d.querySelector('[data-readout-bar="'+key+'"]'),track=el?.querySelector('[role=meter]');return {key,value:Number(el?.dataset.readoutValue),inspectorValue:Number(document.querySelector('.reading-host [data-readout-bar="'+key+'"]')?.dataset.readoutValue),max:Number(track?.getAttribute('aria-valuemax')),text:el?.querySelector('.ac-bar-value').textContent,unit:el?.querySelector('.ac-bar-value [data-math]')?.dataset.math};}),r,labels:[...d.querySelectorAll('dt [data-tex]')].map(e=>e.dataset.tex),staticField:!d.querySelector('[data-field-readout=field] [data-readout-bar]'),normal:!!d.querySelector('[data-generator-normal] [data-tex]')};})()`);}
 const a=await audit();assert.deepEqual(a.labels,['\\theta','B','\\Phi','N\\Phi','e']);assert(a.staticField&&a.normal);checks+=3;
 for(const row of a.rows){assert(Number.isFinite(row.value));assert(row.unit);assert(!/[0-9]e[+-][0-9]/i.test(row.text));const expected=row.key==='phase'?a.r.phase*180/Math.PI:a.r[row.key];assert(Math.abs(row.value-expected)<1e-8);assert(Math.abs(row.inspectorValue-expected)<1e-8);checks+=5;}
 assert.equal(a.rows[0].max,360);assert(a.rows[1].max<.1);checks+=2;
 assert.equal(await inside('[...document.querySelectorAll(".reading-host [data-readout-bar]")].filter(e=>["phase","flux","fluxLinkage","sourceEmf"].includes(e.dataset.readoutBar)).length'),4);checks++;
 await call('setObservationChannels([{id:'+JSON.stringify(id)+',quantity:"voltage"}])');await delay(80);
 assert(await inside('!!document.querySelector(".ac-scope-title [data-tex=U]")&&!!document.querySelector(".ac-scope-time-ruler [data-tex]")'));checks++;
 await screenshot(source+'-scope-math');
 // Verify cached vector glyphs draw into Canvas, including a minus sign and a SI prefix.
 assert(await inside(`(()=>{const c=document.createElement('canvas');c.width=160;c.height=60;const ctx=c.getContext('2d');ctx.fillStyle='#000';CircuitMath.canvas(ctx,10,35,CircuitMath.quantity(-2,'mV'),20);return ctx.getImageData(0,0,160,60).data.some((v,i)=>i%4===3&&v>0);})()`));checks++;
 assert.deepEqual(await call('captureSession()'),saved);checks++;
 await call('setObservationTools([])');await click('[data-field-open]');assert.equal(await inside('document.querySelectorAll(".ac-field-large [data-readout-bar]").length'),4);checks++;
 await screenshot(source+'-generator-bar-math');await click('[data-field-close]');
 await call('setPlayback({paused:false})');await delay(300);await call('setPlayback({paused:true})');const live=await audit();for(const row of live.rows){const expected=row.key==='phase'?live.r.phase*180/Math.PI:live.r[row.key];assert(Math.abs(row.value-expected)<1e-8);assert(Math.abs(row.inspectorValue-expected)<1e-8);}checks++;await call('restoreSession('+JSON.stringify(saved)+')');
 await call('advanceTime(.55)');const b=await audit();assert(b.rows[1].value<0&&b.rows[3].value<0);assert.equal(b.rows[1].unit,a.rows[1].unit);checks+=2;
 // The same UI consumes every common AC parameter symbol; user labels remain literal text.
 for(const [preset,type,tex]of [['capacitive','capacitor','C'],['inductive','inductor','L'],['transformer','transformer','N_2'],['resistive','ac-source','U']]){
  await inside('CircuitACWorkbench.loadDocument(CircuitACPresets.create('+JSON.stringify(preset)+'))');const cid=await call('getDocument().components.find(c=>c.type==='+JSON.stringify(type)+').id');await click('[data-hit="body:'+cid+'"]',true);
  assert(await inside('[...document.querySelectorAll("[data-circuit-id=properties] [data-tex]")].some(e=>e.dataset.tex.includes('+JSON.stringify(tex)+'))'));checks++;
 }
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:500,deviceScaleFactor:1,mobile:true});
 await inside("CircuitACWorkbench.loadDocument(CircuitACPresets.create('generator'))");await call('fit()');await click('[data-hit="body:'+id+'"]',true);await call('advanceTime(.123)');await click('[data-field-open]');
 assert(await inside('(()=>{const d=document.querySelector(".ac-field-dialog"),r=d.getBoundingClientRect();return d.open&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1;})()'));checks++;
 assert(await inside('[...document.querySelectorAll(".ac-field-large .ac-bar-value")].every(e=>e.scrollWidth<=e.clientWidth+1)'));checks++;
 await screenshot(source+'-generator-bar-math-320');await click('[data-field-close]');
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await load('/circuit-ac-workbench/activity-examples.html','window','CircuitACExample');await call('advanceTime(.001)');await inside('[...document.querySelectorAll("button")].find(e=>e.textContent==="保存目前瞬間").click()');assert(await inside('[...document.querySelectorAll("[role=status] [data-tex]")].some(e=>e.dataset.tex.startsWith("t="))'));checks++;
 console.log(source+' focused generator readout / physics notation checks: '+checks);return checks;
}
module.exports={readoutMathCases};
