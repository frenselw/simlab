"use strict";

// Owned operation probes complement the blank/panel matrix. Pointer input is
// dispatched by Chrome; only lifecycle interruption uses the production APIs.
async function runMirrorOperations({ cdp, childEval, observation, prepare, swipe, delay }, spec) {
  const results = [];
  let nextId = 8000;
  const geometry = () => childEval(`(() => [...document.querySelectorAll('#diagram circle[data-kind],#diagram circle[data-image-handle],#diagram line[data-image-handle]')].map(e => ({kind:e.dataset.kind,handle:e.dataset.imageHandle,id:e.dataset.id,coordinates:['cx','cy','x1','y1','x2','y2'].map(k=>e.getAttribute(k))})))()`);
  const locate = selector => childEval(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing owned target: '+${JSON.stringify(selector)});
    const r=e.getBoundingClientRect(),f=frameOffset(),x=r.left+r.width/2,y=r.top+r.height/2;
    const hit=document.elementFromPoint(x,y);
    return {x:x+f.left,y:y+f.top,hit:hit?.matches(${JSON.stringify(selector)})||false,touchAction:window.getComputedStyle(e).touchAction};
  })()`);
  function scrollIssues(before, during, after) {
    const issues = [];
    for (const sample of [...during, after]) {
      for (const key of ['host','document','panel','outerWindow']) {
        if (Math.abs(sample[key]-before[key])>1.1) issues.push('owned operation moved '+key);
      }
    }
    if (!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch')) issues.push('owned operation lacks trusted touch');
    return [...new Set(issues)];
  }
  if (spec.ownedTarget) {
    for (const interruption of ['touchcancel','lostcapture','secondary','blur','complete']) {
      await prepare('stage','middle');
      const point=await locate(spec.ownedTarget),before=await observation(),oldGeometry=await geometry();
      const issues=[];
      if(!point.hit||point.touchAction!=='none')issues.push('owned target does not own its visible endpoint');
      const id=nextId++,touch=p=>({x:p.x,y:p.y,id,radiusX:1,radiusY:1,force:1});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point)]});
      const during=[];
      for(let i=1;i<=6;i++) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch({x:point.x+36*i/6,y:point.y+18*i/6})]});
        await delay(25);during.push(await observation());
      }
      const movedGeometry=await geometry();
      if(JSON.stringify(oldGeometry)===JSON.stringify(movedGeometry))issues.push('owned drag did not update geometry');
      if(interruption==='touchcancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      else if(interruption==='lostcapture') {
        await childEval(`(() => {const svg=document.getElementById('diagram'),id=window.__auditEvents.find(e=>e.type==='pointerdown')?.pointerId;if(id==null||!svg.hasPointerCapture(id))throw new Error('No capture to interrupt');svg.releasePointerCapture(id);return true;})()`);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else if(interruption==='secondary') {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch({x:point.x+36,y:point.y+18}),{...touch({x:point.x-10,y:point.y+10}),id:nextId++}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else if(interruption==='blur') {
        await childEval(`(() => {window.dispatchEvent(new window.Event('blur'));return true;})()`);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await delay(100);
      const after=await observation(),newGeometry=await geometry();
      issues.push(...scrollIssues(before,during,after));
      if(interruption==='complete') {
        if(!after.events.some(e=>e.type==='pointerup'&&e.isTrusted)||after.events.some(e=>e.type==='pointercancel'))issues.push('owned completion did not receive pointerup');
        if(JSON.stringify(oldGeometry)===JSON.stringify(newGeometry)||before.state.suspend===after.state.suspend)issues.push('completed owned drag did not save changed work');
      } else {
        if(JSON.stringify(oldGeometry)!==JSON.stringify(newGeometry))issues.push('interrupted drag did not restore geometry');
        if(before.state.suspend!==after.state.suspend)issues.push('interrupted drag changed durable snapshot');
      }
      if(await childEval(`document.querySelector('.drag-preview')?.classList.contains('is-active')`))issues.push('preview remains after gesture');
      results.push({case:'G5/G6-mirror-'+interruption,target:spec.ownedTarget,point,before,after,during,oldGeometry,newGeometry,issues:[...new Set(issues)]});
    }
  }
  if(spec.releasedTarget) {
    await prepare('stage','middle');const point=await locate(spec.releasedTarget),before=await observation();
    const samples=await swipe({...point,delta:-48}),after=await observation();
    const issues=[];
    if(point.touchAction==='none'||point.hit)issues.push('locked editing footprint still owns touch');
    if(after.host-before.host<3)issues.push('locked footprint swallowed host gesture');
    if(before.state.suspend!==after.state.suspend)issues.push('locked gesture changed snapshot');
    if(samples.some(s=>Math.abs(s.panel-before.panel)>1.1||Math.abs(s.page-before.document)>1.1))issues.push('locked gesture moved wrong owner');
    results.push({case:'G6-mirror-locked-footprint',point,before,after,samples,issues});
  }
  return results;
}
async function runHouseholdOperations({cdp,childEval,observation,prepare,delay},spec){
  if(spec.id!=='initial')return [];
  const results=[],original=await childEval('window.CircuitHouseholdWorkbench.captureSession()');let id=9500;
  async function fixture(kind){
    await childEval(`(()=>{const M=window.CircuitModel,d=M.empty('household-rms'),a=M.add(d,'hh-appliance',0,0);d.cables.length=1200;
      if(${JSON.stringify(kind)}==='wire-bend'||${JSON.stringify(kind)}==='attached-end'){const b=M.add(d,'hh-appliance',300,0);M.connect(d,a.id+':a',b.id+':a',[],'free');}
      if(${JSON.stringify(kind)}==='free-end')M.addWire(d,0,0);
      const e=window.CircuitHouseholdWorkbench;e.loadDocument(d);e.focus(a.id);
      if(${JSON.stringify(kind)}==='attached-end'){document.querySelector('[data-circuit-id=pickWire]').click();document.querySelector('[data-hit="wire:w1:0"]').click();}
      return true;})()`);
    await prepare('stage','middle');
  }
  const locate=selector=>childEval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing household owned target '+${JSON.stringify(selector)});const r=e.getBoundingClientRect(),f=frameOffset();for(const x of [.5,.3,.7,.15,.85])for(const y of [.5,.3,.7,.15,.85]){const p={x:r.left+r.width*x,y:r.top+r.height*y};if(p.x<34||p.x>innerWidth-34||p.y<0||p.y>innerHeight)continue;if(document.elementFromPoint(p.x,p.y)===e)return {x:p.x+f.left,y:p.y+f.top,touchAction:getComputedStyle(e).touchAction};}throw Error('No exposed household target '+${JSON.stringify(selector)});})()`);
  const targets=[['body','[data-hit="body:c1"]'],['port','[data-hit="port:c1:a"]'],['free-end','[data-hit="wireend:w1:from"]'],['attached-end','[data-hit="wireend:w1:from"]'],['wire-bend','[data-hit="wire:w1:0"]']];
  for(const [kind,selector]of targets)for(const cancel of [false,true,...(kind==='body'?['lostcapture','secondary','blur']:[])]){
    await fixture(kind);const point=await locate(selector),before=await observation(),snapshot=await childEval('window.CircuitHouseholdWorkbench.captureSession()'),during=[],issues=[];const pointer=id++,touch=(dx=0,dy=0)=>({x:point.x+dx,y:point.y+dy,id:pointer,radiusX:4,radiusY:4});
    if(point.touchAction!=='none')issues.push('owned household target lacks touch-action:none');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch()]});
    for(const distance of [8,16,24,32]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(distance,0)]});await delay(20);during.push(await observation());}
    if(['free-end','attached-end'].includes(kind)&&!await childEval('!document.querySelector("[data-circuit-id=preview]").hidden'))issues.push('precision endpoint drag has no magnified preview');
    if(cancel==='lostcapture'){await childEval('(()=>{const e=document.querySelector('+JSON.stringify(selector)+'),pointer=window.__auditEvents.filter(e=>e.type==="pointerdown").at(-1)?.pointerId;if(pointer==null||!e.hasPointerCapture(pointer))throw Error("Missing stable capture");e.releasePointerCapture(pointer);return true;})()');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else if(cancel==='secondary'){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(32),{...touch(-10),id:id++}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else if(cancel==='blur'){await childEval('window.dispatchEvent(new window.Event("blur"))');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await delay(60);const after=await observation(),accepted=await childEval('window.CircuitHouseholdWorkbench.captureSession()');
    for(const sample of [...during,after])for(const key of ['host','outerWindow','document','panel'])if(Math.abs(sample[key]-before[key])>1.1)issues.push('owned drag moved '+key);
    if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('owned drag has no trusted touch');
    if(JSON.stringify(accepted.physics)!==JSON.stringify(snapshot.physics))issues.push('owned geometry drag changed time/heat/energy');
    if(cancel&&JSON.stringify(accepted.document)!==JSON.stringify(snapshot.document))issues.push('cancel changed accepted wiring');
    if(!cancel&&JSON.stringify(accepted.document)===JSON.stringify(snapshot.document))issues.push('completed drag did not change geometry');
    if(await childEval('!document.querySelector("[data-circuit-id=preview]").hidden'))issues.push('preview survived release');
    results.push({case:'household-owned-'+kind+(typeof cancel==='string'?'-'+cancel:cancel?'-cancel':'-complete'),point,before,after,during,issues:[...new Set(issues)]});
  }
  for(const cancel of [false,true]){
    await fixture('body');
    const point=await childEval(`(()=>{const slider=document.querySelector('[data-circuit-id="properties"] [data-param="ratedPower"]').closest('label').nextElementSibling;if(slider.type!=='range')throw Error('Missing household range');slider.scrollIntoView({block:'nearest'});const r=slider.getBoundingClientRect(),f=frameOffset(),style=window.getComputedStyle(slider),left=parseFloat(style.paddingLeft)+parseFloat(style.borderLeftWidth),right=parseFloat(style.paddingRight)+parseFloat(style.borderRightWidth),ratio=(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min)),x=r.left+left+8+(r.width-left-right-16)*ratio,y=r.top+r.height/2;if(document.elementFromPoint(x,y)!==slider)throw Error('Household range is occluded');return {x:x+f.left,y:y+f.top};})()`);
    await delay(60);const before=await observation(),snapshot=await childEval('window.CircuitHouseholdWorkbench.captureSession()'),during=[],pointer=id++,touch=dx=>({x:point.x+dx,y:point.y,id:pointer,radiusX:4,radiusY:4});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(0)]});
    for(const distance of [-8,-16,-24,-32]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(distance)]});await delay(20);during.push(await observation());}
    await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await delay(60);
    const after=await observation(),accepted=await childEval('window.CircuitHouseholdWorkbench.captureSession()'),issues=[];
    for(const sample of [...during,after])for(const key of ['host','outerWindow','document','panel'])if(Math.abs(sample[key]-before[key])>1.1)issues.push('slider moved '+key);
    if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('slider lacks trusted touch');
    if(JSON.stringify(accepted.physics)!==JSON.stringify(snapshot.physics))issues.push('slider changed time/heat/energy');
    if(cancel&&JSON.stringify(accepted)!==JSON.stringify(snapshot))issues.push('cancelled slider changed accepted state');
    if(!cancel&&accepted.document.components[0].params.ratedPower===snapshot.document.components[0].params.ratedPower)issues.push('slider did not commit changed power');
    results.push({case:'household-owned-slider-'+(cancel?'cancel':'complete'),point,before,after,during,issues:[...new Set(issues)]});
  }
  await childEval('window.CircuitHouseholdWorkbench.restoreSession('+JSON.stringify(original)+')');
  return results;
}
module.exports={runMirrorOperations,runHouseholdOperations};
