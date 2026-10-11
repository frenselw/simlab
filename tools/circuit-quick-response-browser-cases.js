'use strict';
const assert=require('node:assert/strict'),P=require('../sim/circuit-workbench/circuit-ac-presets');
async function quickResponseCases(h,source){
 let checks=0,id=7200;const selector=name=>`[data-circuit-id="${name}"]`;
 const value=()=>h.call('getDocument().components.find(c=>c.type==="ac-source").params.frequency');
 const state=()=>h.inside(`(()=>{const e=document.querySelector('${selector('quickPlus')}');return {disabled:e.disabled,frequency:CircuitACWorkbench.getDocument().components.find(c=>c.type==='ac-source').params.frequency,touch:CircuitACWorkbench.getInteraction().touchCount,time:CircuitACWorkbench.getAnalysis().time};})()`);
 async function press(name,hold,cancel=false){
  const p=await h.point(selector(name));await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:id++,radiusX:2,radiusY:2,force:1}]});await h.delay(hold);
  const held=await state();await h.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await h.delay(40);return held;
 }
 for(const width of [320,390]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await h.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  for(const frequency of [.1,1.3])for(const paused of [false,true]){
   const d=P.create('resistive');d.components[0].params.frequency=frequency;await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('setPlayback({paused:true})');await h.call('fit()');
   if(await h.inside(`document.querySelector('${selector('panelToggle')}').getAttribute('aria-expanded')==='true'`))await h.touch(await h.point(selector('panelToggle')));
   await h.touch(await h.point('[data-hit="body:'+d.components[0].id+'"]',true));await h.call('setPlayback({paused:'+paused+'})');await h.delay(120);
   await h.inside(`window.__quickUnsubscribe?.();window.__quickChanges=0;window.__quickClicks=[];window.__quickUnsubscribe=CircuitACWorkbench.onChange(()=>__quickChanges++);for(const name of ['quickPlus','quickMinus'])document.querySelector('[data-circuit-id="'+name+'"]').addEventListener('click',e=>__quickClicks.push({trusted:e.isTrusted,name}),{capture:true});`);
   for(const hold of [350,20,180,600]){
    const before=await value(),changes=await h.inside('__quickChanges'),start=await h.call('getAnalysis().time'),held=await press('quickPlus',hold);
    assert.equal(held.disabled,false,JSON.stringify({source,width,paused,hold,before,held}));assert.equal(held.frequency,before,'holding must not submit');assert.equal(held.touch,1);assert(Math.abs(await value()-(before+.1))<1e-12,'one release must increment once');assert.equal(await h.inside('__quickChanges'),changes+1);assert(await h.inside('__quickClicks.at(-1).trusted'));checks+=6;
    if(!paused&&hold>=180){assert(held.time>start,'playback must continue during footer contact');checks++;}
    const plus=await value();await press('quickMinus',hold);assert(Math.abs(await value()-(plus-.1))<1e-12);checks++;
   }
   const beforeCancel=await value(),cancelChanges=await h.inside('__quickChanges');await press('quickPlus',350,true);assert.equal(await value(),beforeCancel);assert.equal(await h.inside('__quickChanges'),cancelChanges);assert.equal(await h.inside(`document.querySelector('${selector('quickPlus')}').disabled`),false);checks+=3;
   // Native focused drafts survive repaint; Enter commits once.
   await h.touch(await h.point(selector('quickValue')));await h.inside(`document.querySelector('${selector('quickValue')}').select()`);await h.send('Input.insertText',{text:'1.7'});await h.delay(1100);
   assert.equal(await h.inside(`document.querySelector('${selector('quickValue')}').value`),'1.7');assert.equal(await value(),beforeCancel);await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await h.delay(60);assert.equal(await value(),1.7,JSON.stringify(await h.call('getInteraction()')));checks+=3;
   // Keyboard activation remains a single native click.
   await h.inside(`document.querySelector('${selector('quickPlus')}').focus()`);await h.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await h.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await h.delay(60);assert.equal(await value(),1.8);checks++;
   if(width===390&&!paused&&frequency===1.3)await h.screenshot(source+'-quick-response-390');await h.call('setPlayback({paused:true})');
   // Holding a component on the canvas still freezes footer geometry; cancellation restores it.
   const beforeDrag=await h.call('exportDocument()'),body=await h.point('[data-hit="body:'+d.components[0].id+'"]',true);await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...body,id:id++,radiusX:2,radiusY:2,force:1}]});await h.delay(200);assert(await h.inside(`document.querySelector('${selector('quickPlus')}').disabled`));assert.equal((await h.call('getInteraction()')).dragging,'body');await h.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await h.delay(60);assert.equal(await h.call('exportDocument()'),beforeDrag);assert.equal(await h.inside(`document.querySelector('${selector('quickPlus')}').disabled`),false);checks+=4;
  }
  // Limits and a lock arriving while the finger is held must still reject edits.
  const component=await h.call('getDocument().components.find(c=>c.type==="ac-source")'),spec=await h.inside('CircuitRegistry.primaryParameter(CircuitACWorkbench.getDocument().components.find(c=>c.type==="ac-source"))');
  await h.call('execute({type:"setParam",id:'+JSON.stringify(component.id)+',key:"frequency",value:'+spec.max+'})');assert(await h.inside(`document.querySelector('${selector('quickPlus')}').disabled`));await press('quickPlus',350);assert.equal(await value(),spec.max);checks+=2;
  await h.call('execute({type:"setParam",id:'+JSON.stringify(component.id)+',key:"frequency",value:'+spec.min+'})');assert(await h.inside(`document.querySelector('${selector('quickMinus')}').disabled`));await press('quickMinus',350);assert.equal(await value(),spec.min);checks+=2;
  const p=await h.point(selector('quickPlus'));await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:id++,radiusX:2,radiusY:2,force:1}]});await h.call('setReadOnly(true)');await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await h.delay(100);assert.equal(await value(),spec.min);assert(await h.inside(`document.querySelector('${selector('quickPlus')}').disabled`));checks+=2;await h.call('setReadOnly(false)');
 }
 console.log(source+' held-touch frequency response: '+checks+' checks passed');return checks;
}
module.exports={quickResponseCases};
