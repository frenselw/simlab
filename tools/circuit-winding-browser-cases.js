'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/circuit-ac-presets');
const link=(d,a,b,ap='a',bp='a')=>M.connect(d,a.id+':'+ap,b.id+':'+bp);
async function exampleHintCases(h,source){let checks=0;
 for(const [width,height] of [[1280,900],[390,844],[844,390]]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<960});await h.call('setPlayback({paused:true})');
  for(const name of ['empty','capacitive']){
   await h.inside(`(()=>{const s=document.querySelector('[data-circuit-id=preset]');s.value=${JSON.stringify(name)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   assert.equal(await h.inside('document.querySelector("[data-circuit-id=preset]").value'),name);
   const doc=await h.call('getDocument()');assert(name==='empty'?doc.components.length===0:doc.components.some(c=>c.type==='capacitor'));
   assert(await h.inside('!document.querySelector(".ac-example-hint")&&!document.querySelector(".canvas-area").textContent.includes("示例提示")'));
   assert(await h.inside('!document.body.textContent.includes("已載入範例，可取線、改接及量測。")'));checks+=4;
  }
  if(width!==844)await h.screenshot(source+'-example-hint-removed-'+width);
 }
 await h.inside(`(async()=>{const host=document.createElement('div');host.id='hint-dc';host.style.cssText='position:fixed;inset:0;background:white;z-index:200';document.body.append(host);window.__hintDC=await CircuitEditor.mount(host,{role:'teacher',idPrefix:'hint-dc-'});})()`);
 for(const [width,height] of [[1280,900],[390,844],[844,390]]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<960});
  for(const name of ['empty','series']){
   await h.inside(`(()=>{const s=document.querySelector('#hint-dc [data-circuit-id=preset]');s.value=${JSON.stringify(name)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   assert.equal(await h.inside('document.querySelector("#hint-dc [data-circuit-id=preset]").value'),name);
   const doc=await h.inside('__hintDC.getDocument()');assert(name==='empty'?doc.components.length===0:doc.components.filter(c=>c.type==='lamp').length===2);
   assert(await h.inside('!document.querySelector("#hint-dc .ac-example-hint")&&!document.querySelector("#hint-dc").textContent.includes("已載入範例，可取線、改接及量測。")'));checks+=3;
  }
  await h.inside(`__hintDC.execute({type:'addComponent',key:'resistor',x:200,y:200});document.querySelector('#hint-dc [data-circuit-id=undo]').click()`);
  assert(await h.inside('document.querySelector("#hint-dc .canvas-notice:not([hidden])").getClientRects().length>0'));checks++;
 }
 await h.inside('__hintDC.destroy();document.getElementById("hint-dc").remove();delete window.__hintDC');console.log(source+' example hint removal: '+checks+' checks passed');return checks;
}
async function windingCases(h,source){let checks=await exampleHintCases(h,source);
 await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await h.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 async function geometry(selector='body'){
  return h.inside(`(()=>{const host=document.querySelector(${JSON.stringify(selector)}),flows=[...host.querySelectorAll('[data-flow-component]')];return flows.filter(g=>host.querySelector('[data-component="'+g.dataset.flowComponent+'"] [data-inductor-front],[data-component="'+g.dataset.flowComponent+'"] [data-transformer-winding],[data-component="'+g.dataset.flowComponent+'"] [data-rheostat-winding]')).map(g=>{const body=host.querySelector('[data-component="'+g.dataset.flowComponent+'"]'),route=g.querySelector('[data-flow-route]'),kind=body.querySelector('[data-ac-apparatus]')?.dataset.acApparatus||'rheostat',family=g.dataset.flowPath==='secondary'?'secondary':'primary';let conductors;
   if(kind==='inductor')conductors=body.querySelectorAll('[data-inductor-front] path:first-child,[data-inductor-leads] path:first-child');else if(kind==='transformer')conductors=body.querySelectorAll('[data-transformer-winding="'+family+'"] [data-transformer-front] path:first-child,[data-transformer-winding="'+family+'"] [data-transformer-leads] path:first-child');else conductors=body.querySelectorAll('[data-rheostat-winding],[data-rheostat-contact],[data-leads=rheostat],path[stroke="#a7bac5"]');
   const samples=[...conductors].flatMap(p=>{const matrix=route.getScreenCTM().inverse().multiply(p.getScreenCTM()),length=p.getTotalLength();return Array.from({length:1601},(_,n)=>p.getPointAtLength(length*n/1600).matrixTransform(matrix));}),particles=[...g.querySelectorAll('[data-flow-distance]')].map(e=>{const p=e.tagName==='circle'?{x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}:e.transform.baseVal.consolidate().matrix,at={x:p.x??p.e,y:p.y??p.f},distance=+e.dataset.flowDistance,q=route.getPointAtLength(distance);return {routeError:Math.hypot(at.x-q.x,at.y-q.y),copperError:Math.min(...samples.map(p=>Math.hypot(at.x-p.x,at.y-p.y)))};});return {id:g.dataset.flowComponent,key:g.dataset.flowPath,current:+g.dataset.current,direction:+g.dataset.direction,length:route.getTotalLength(),particles,kind};});})()`);
 }
 for(const name of ['inductive','transformer']){await h.call('loadDocument('+JSON.stringify(P.create(name))+')');await h.call('advanceTime(1.125)');for(const style of ['current','electron']){await h.inside(`(()=>{const d=CircuitACWorkbench.getDocument();d.display.flow=${JSON.stringify(style)};CircuitACWorkbench.loadDocument(d);CircuitACWorkbench.advanceTime(1.125);})()`);await h.delay(100);const rows=await geometry();assert(rows.length===(name==='transformer'?2:1));for(const row of rows){assert(row.length>200);assert(row.particles.length>0);assert(row.particles.every(p=>p.routeError<.04&&p.copperError<.5),JSON.stringify(row));assert.equal(row.direction,Math.sign(row.current)*(style==='electron'?-1:1));checks+=4;}await h.call('setPlayback({paused:false})');const motion=await h.inside(`new Promise(resolve=>{const rows=[];function frame(){rows.push([...document.querySelectorAll('[data-flow-component]')].filter(g=>g.querySelector('[data-flow-route]')&&${JSON.stringify(name)}==='transformer'?g.dataset.flowComponent==='c2':g.dataset.flowComponent==='c4').map(g=>({key:g.dataset.flowPath,phase:+g.dataset.phase,direction:+g.dataset.direction})));if(rows.length<8)requestAnimationFrame(frame);else resolve(rows);}requestAnimationFrame(frame);})`);await h.call('setPlayback({paused:true})');for(let n=1;n<motion.length;n++)for(const p of motion[n]){const previous=motion[n-1].find(q=>q.key===p.key),delta=((p.phase-previous.phase+97.5)%65)-32.5;assert(delta*p.direction>0,'actual RAF current follows the winding in the signed direction');}assert(motion.every(row=>row.length===(name==='transformer'?2:1)));checks+=2;await h.screenshot(source+'-winding-'+name+'-'+style);}
  assert(await h.inside('!document.documentElement.scrollWidth||document.documentElement.scrollWidth<=innerWidth'));checks++;
 }
 // Mount the production DC editor using the same bundled core, with its own IDs.
 for(const terminals of [2,4]){const d=M.empty(),b=M.add(d,'battery',160,300),r=M.add(d,'rheostat',400,220,{terminals,position:.37}),load=M.add(d,'resistor',650,300,{resistance:12});link(d,b,r);link(d,r,load,'b','a');link(d,load,b,'b','b');
  await h.inside(`(async()=>{const host=document.createElement('div');host.id='winding-dc';host.style.cssText='position:fixed;inset:0;background:white;z-index:200';document.body.append(host);window.__windingDC=await CircuitEditor.mount(host,{role:'teacher',initialDocument:${JSON.stringify(d)},palette:[],idPrefix:'winding-dc-'});__windingDC.setPlayback({paused:true});})()`);await h.delay(100);const saved=await h.inside('__windingDC.getDocument()'),rows=await geometry('#winding-dc');assert(rows.some(r=>r.kind==='rheostat'));for(const row of rows){assert(row.particles.length>0);assert(row.particles.every(p=>p.routeError<.04&&p.copperError<.5),JSON.stringify(row));checks+=2;}assert.deepEqual(await h.inside('__windingDC.getDocument()'),saved);assert(await h.inside('!document.querySelector("#winding-dc .ac-example-hint")'));checks+=2;await h.screenshot(source+'-winding-dc-rheostat-'+terminals);await h.inside('__windingDC.destroy();document.getElementById("winding-dc").remove();delete window.__windingDC');
 }
 console.log(source+' winding/hint browser checks: '+checks);return checks;
}
module.exports={windingCases,exampleHintCases};
