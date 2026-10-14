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
module.exports={runMirrorOperations};
