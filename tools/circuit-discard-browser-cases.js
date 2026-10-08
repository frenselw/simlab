'use strict';
const assert=require('node:assert/strict'),M=require('../sim/circuit-workbench/circuit-model');
async function discardCases(h,mode,base){
  let width,pointer,touchId=330000;
  const control=id=>`[data-circuit-id="${id}"]`,evidence=(kind,data={})=>h.evidence.push({mode,discard:kind,width,pointer,...data});
  async function launch(w,p){width=w;pointer=p;await h.freshPage();h.setContext('window');await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:3});await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();}
  const selector=type=>type==='body'?'[data-hit="body:c1"]':type==='end'?'[data-hit="wireend:w1:from"]':'[data-hit="wire:w1:0"]';
  async function fixture(type,view='real'){
    const d=M.empty();d.display.view=view;d.cables.count=1;if(type==='body')M.add(d,'resistor',300,240);else M.addWire(d,300,240);await h.load(d);
    await h.click(selector(type));if(await h.inside(`document.querySelector('${control('panelToggle')}').getAttribute('aria-expanded')==='false'`))await h.click(control('panelToggle'));await h.delay(70);
    await h.inside(`window.__discardUnsubscribe?.();window.__discardChanges=0;window.__discardUnsubscribe=CircuitWorkbench.onChange(()=>__discardChanges++);window.__discardAbort?.abort();window.__discardAbort=new AbortController();window.__discardEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>__discardEvents.push({type,pointer:e.pointerType,id:e.pointerId,trusted:e.isTrusted,target:e.target.dataset.hit}),{capture:true,signal:__discardAbort.signal});`);
  }
  async function begin(type,zone){
    const a=await h.point(selector(type),type==='body'),id=touchId++,mobile=pointer==='touch';
    await h.send(mobile?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',mobile?{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id,radiusX:2,radiusY:2,force:1}]}:{type:'mousePressed',x:a.x,y:a.y,button:'left',buttons:1,clickCount:1,pointerType:pointer});
    const to=await h.point(control(zone==='trash'?'deleteSelected':'panel'));
    for(let n=1;n<=8;n++){const q={x:a.x+(to.x-a.x)*n/8,y:a.y+(to.y-a.y)*n/8};await h.send(mobile?'Input.dispatchTouchEvent':'Input.dispatchMouseEvent',mobile?{type:'touchMove',touchPoints:[{...q,id,radiusX:2,radiusY:2,force:1}]}:{type:'mouseMoved',...q,button:'left',buttons:1,pointerType:pointer});await h.delay(15);}
    await h.delay(180);return{...to,id,start:{x:a.x,y:a.y}};
  }
  async function end(to,cancel=false){if(pointer==='touch')await h.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});else{if(cancel)await h.key('Escape','Escape',27);await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:to.x,y:to.y,button:'left',buttons:0,clickCount:1,pointerType:pointer});}await h.delay(200);}
  const feedback=()=>h.inside(`(()=>{const b=document.querySelector('${control('deleteSelected')}');return{open:b.classList.contains('trash-open'),lid:getComputedStyle(b.querySelector('.trash-lid')).transform,duration:getComputedStyle(b.querySelector('.trash-lid')).transitionDuration,panel:document.querySelector('${control('panel')}').classList.contains('discard-active')};})()`);
  for(const [w,p]of [[1280,'mouse'],[1280,'pen'],[390,'touch'],[320,'touch']]){
    await launch(w,p);
    console.log(`${mode}: discard ${width}px ${pointer}`);
    for(const view of ['real','schematic'])for(const type of ['body','wire','end'])for(const zone of ['trash','panel']){
      await fixture(type,view);const saved=await h.save(),to=await begin(type,zone),state=await feedback();assert(state.open);assert.notEqual(state.lid,'none');assert.notEqual(state.lid,'matrix(1, 0, 0, 1, 0, 0)');assert.equal(state.panel,zone==='panel');assert.equal(await h.save(),saved);assert.equal(await h.inside('__discardChanges'),0);
      if(w===1280&&p==='mouse'&&view==='real'&&type==='body'&&zone==='trash')await h.screenshot(`${mode}-trash-open.png`);
      await end(to);const d=await h.doc();assert.equal(d.components.length,0);assert.equal(d.wires.length,0);assert.equal(d.junctions.length,0);assert.equal(await h.inside('__discardChanges'),1);assert(!(await feedback()).open);if(type!=='body')assert.equal(await h.inside(`document.querySelector('${control('addWire')}').disabled`),false,'discard returns wire stock');
      const events=await h.inside('__discardEvents');assert(events.some(e=>e.type==='pointermove'&&e.pointer===pointer));assert(events.some(e=>e.type==='pointerup'&&e.pointer===pointer));assert(events.every(e=>e.trusted));assert(!events.some(e=>e.type==='pointercancel'));
      const removed=await h.save();await h.click(control('undo'));assert.equal(await h.save(),saved);await h.click(control('redo'));assert.equal(await h.save(),removed);await h.load(saved);assert(await h.inside(`CircuitWorkbench.execute({type:'remove',id:'${type==='body'?'c1':'w1'}'})`));
      evidence('remove',{view,type,zone,oneCommit:true,undoRedo:true,restoredContinuation:true,lidAnimated:true});
    }
    await fixture('body');const saved=await h.save(),to=await begin('body','trash');await end(to,true);assert.equal(await h.save(),saved);assert(!(await feedback()).open);evidence('cancel',{noDeletion:true,lidClosed:true});
  }
  await launch(390,'touch');await fixture('body');const secondSaved=await h.save(),secondTo=await begin('body','trash'),secondPoint=await h.point(control('surface'));
  await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:secondTo.x,y:secondTo.y,id:secondTo.id,radiusX:2,radiusY:2,force:1},{x:secondPoint.x,y:secondPoint.y,id:secondTo.id+99999,radiusX:2,radiusY:2,force:1}]});await h.delay(70);assert.equal(await h.save(),secondSaved);assert(!(await feedback()).open);await h.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await h.save(),secondSaved);evidence('second-touch',{cancelsDiscard:true,unchanged:true});
  await launch(1280,'mouse');
  for(const reason of ['leave','blur','capture','resize','load','readonly','destroy']){
    await fixture('body');const saved=await h.save(),to=await begin('body','trash');assert((await feedback()).open);
    if(reason==='leave'){await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:to.start.x+20,y:to.start.y,button:'left',buttons:1});await h.delay(180);assert(!(await feedback()).open);await end(to,true);}
    else{
      if(reason==='blur')await h.inside(`window.dispatchEvent(new Event('blur'))`);
      if(reason==='capture'){await h.inside(`document.querySelector('[data-hit="body:c1"]').releasePointerCapture(__discardEvents.find(e=>e.type==='pointerdown').id)`);await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:to.x+1,y:to.y,button:'left',buttons:1});}
      if(reason==='resize'){await h.send('Emulation.setDeviceMetricsOverride',{width:1200,height:800,deviceScaleFactor:1,mobile:false});await h.delay(100);}
      if(reason==='load')await h.load(saved);
      if(reason==='readonly')await h.inside('CircuitWorkbench.setReadOnly(true)');
      if(reason==='destroy')await h.inside('CircuitWorkbench.destroy()');
      await end(to);
    }
    assert.equal(await h.save(),saved);assert.equal(await h.inside(`Boolean(document.querySelector('.trash-open,.discard-active'))`),false);
    if(reason==='readonly')await h.inside('CircuitWorkbench.setReadOnly(false)');
    if(reason==='resize')await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:844,deviceScaleFactor:1,mobile:false});
    if(reason==='destroy')await h.inside(`(async()=>{window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),{role:'teacher',idPrefix:''});})()`);
    evidence('interruption',{reason,unchanged:true,closed:true});
  }
  for(const kind of ['component-connected','wire-connected','wire-shared']){
    await fixture(kind==='component-connected'?'body':'wire');let d=await h.doc();
    if(kind==='component-connected'){const wire=M.addWire(d,500,300);assert(M.attach(d,wire.id,'from','c1:a'));}
    else if(kind==='wire-connected'){const c=M.add(d,'resistor',500,240);assert(M.attach(d,'w1','to',c.id+':a'));}
    else{d.cables.count=2;const wire=M.addWire(d,550,240),first=d.wires[0];assert(M.attach(d,wire.id,'from',first.to));}
    await h.load(d);const saved=await h.save(),to=await begin(kind==='component-connected'?'body':'wire','trash');assert(!(await feedback()).open);await end(to);assert.equal(await h.save(),saved);evidence('blocked',{kind,unchanged:true});
  }
  await fixture('body');const saved=await h.save();await h.inside('CircuitWorkbench.setReadOnly(true)');let to=await begin('body','trash');await end(to);assert.equal(await h.save(),saved);assert(!(await feedback()).open);await h.inside('CircuitWorkbench.setReadOnly(false)');evidence('readonly',{unchanged:true});
  await h.inside(`(async()=>{const d=CircuitWorkbench.getDocument();CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),{initialDocument:d,components:{default:{move:true}},ui:{inspector:true}});})()`);
  const protectedDoc=await h.save();to=await begin('body','panel');assert(!(await feedback()).open);await end(to);assert.equal(await h.save(),protectedDoc);evidence('permission',{removeForbidden:true});
  await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),{role:'teacher',idPrefix:''});})()`);await fixture('body');await h.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});to=await begin('body','trash');assert.equal((await feedback()).duration,'0s');assert((await feedback()).open);await end(to,true);await h.send('Emulation.setEmulatedMedia',{features:[]});evidence('reduced-motion',{instantLid:true,cancelSafe:true});
  await fixture('body');await h.inside(`(async()=>{const other=document.createElement('div');other.id='other';other.style.cssText='position:fixed;left:20px;top:130px;width:330px;height:390px;z-index:30';document.body.append(other);window.__otherDiscardEditor=await CircuitEditor.mount(other,{ui:{header:false,inspector:true,viewToggle:false},wires:false});})()`);
  const a=await h.point(selector('body'),true),foreign=await h.point('#other '+control('panel'));await h.send('Input.dispatchMouseEvent',{type:'mousePressed',x:a.x,y:a.y,button:'left',buttons:1,clickCount:1});for(let n=1;n<=6;n++)await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a.x+(foreign.x-a.x)*n/6,y:a.y+(foreign.y-a.y)*n/6,button:'left',buttons:1});assert(!(await feedback()).open);await end(foreign);assert.equal((await h.doc()).components.length,1);assert.equal(await h.inside('__otherDiscardEditor.getDocument().components.length'),0);await h.inside('__otherDiscardEditor.destroy();document.getElementById("other").remove()');evidence('isolation',{foreignPanelDoesNotDelete:true});
}
module.exports={discardCases};
