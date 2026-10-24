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
async function runHouseholdOperations({cdp,childEval,observation,prepare,delay}){
  const saved=await childEval('window.CircuitHouseholdWorkbench.captureSession()'),results=[];let touchId=10000;
  const actor='window.CircuitHouseholdWorkbench';
  const capture=()=>childEval(actor+'.captureSession()');
  async function load(code){await childEval(`(()=>{const app=${actor};app.setReadOnly(false);${code};app.setPlayback({paused:true});return true;})()`);await delay(100);await prepare('stage','middle');}
  async function locate(selector){return childEval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing household target '+${JSON.stringify(selector)});const r=e.getBoundingClientRect(),f=frameOffset();let p=null;for(const x of [.5,.25,.75,.1,.9])for(const y of [.5,.25,.75,.1,.9]){const q={x:r.left+r.width*x,y:r.top+r.height*y};if(!p&&document.elementFromPoint(q.x,q.y)===e)p=q;}if(!p)throw Error('No exposed household target '+${JSON.stringify(selector)});return{x:p.x+f.left,y:p.y+f.top,action:window.getComputedStyle(e).touchAction};})()`);}
  async function worldPoint(expression){return childEval(`(()=>{const p=${expression},r=document.querySelector('[data-circuit-id="surface"]').getBoundingClientRect(),c=${actor}.getInteraction().camera,f=frameOffset();return{x:f.left+r.left+(p.x-c.x)*c.scale,y:f.top+r.top+(p.y-c.y)*c.scale};})()`);}
  async function gesture(name,selector,delta,end='touchEnd',check){
    const point=await locate(selector),destination=typeof delta==='string'?await worldPoint(delta):{x:point.x+(delta?.x||0),y:point.y+(delta?.y||0)},before=await observation(),authority=await capture(),id=touchId++,during=[],issues=[];
    if(point.action!=='none')issues.push('owned target is not touch-action none');
    const touch=p=>({...p,id,radiusX:1,radiusY:1,force:1});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point)]});
    if(delta)for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch({x:point.x+(destination.x-point.x)*i/8,y:point.y+(destination.y-point.y)*i/8})]});await delay(18);during.push(await observation());}
    const preview=await childEval(`(()=>{const e=document.querySelector('[data-circuit-id="preview"]');return{shown:!e.hidden,pointerEvents:window.getComputedStyle(e).pointerEvents,html:e.innerHTML};})()`);
    await cdp.send('Input.dispatchTouchEvent',{type:end,touchPoints:[]});await delay(90);const after=await observation(),current=await capture();
    for(const sample of [...during,after])for(const key of ['host','outerWindow','document','panel'])if(Math.abs(sample[key]-before[key])>1.1)issues.push('owned touch moved '+key);
    if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('missing trusted owned pointer');
    if(end==='touchEnd'&&(!after.events.some(e=>e.type==='pointerup'&&e.isTrusted)||after.events.some(e=>e.type==='pointercancel')))issues.push('owned completion cancelled or lost pointerup');
    if(delta&&end==='touchEnd'&&JSON.stringify(authority)===JSON.stringify(current))issues.push('owned operation did not commit');
    if(end==='touchCancel'&&JSON.stringify(authority)!==JSON.stringify(current))issues.push('cancel changed authoritative state');
    if(['wire-end','hand'].includes(name)&&(!preview.shown||preview.pointerEvents!=='none'))issues.push('precision preview missing or intercepting');
    if(await childEval(`!document.querySelector('[data-circuit-id="preview"]').hidden`))issues.push('preview not cleaned');
    if(check&&!await childEval(check))issues.push('wrong household continuation');
    results.push({case:'G5/G6-household-'+name+'-'+end,selector,point,destination,preview,before,after,during,issues:[...new Set(issues)]});
  }
  try{
    await load("app.loadDocument(window.CircuitHouseholdPresets.create('C08'))");await gesture('body','[data-hit="body:load"]',{x:26,y:12});
    const loose="const d=window.CircuitHouseholdPresets.create('C08'),w=d.wires.find(w=>w.to==='load:n');window.CircuitModel.moveWireEnd(d,w.id,'from',{x:-67,y:49});app.loadDocument(d)";
    await load(loose);const end=await childEval(`${actor}.getDocument().wires.find(w=>w.to==='load:n').id`);await gesture('wire-end',`[data-hit="wireend:${end}:from"]`,`window.CircuitModel.endpoints(${actor}.getDocument()).get('socket:l')`,'touchEnd',`${actor}.getDocument().wires.find(w=>w.to==='load:n').from==='socket:l'`);
    await load(loose);await gesture('wire-end',`[data-hit="wireend:${end}:from"]`,{x:32,y:12},'touchCancel');
    await load("const d=window.CircuitModel.empty('household');window.CircuitModel.add(d,'house-insulated',160,0).id='load';d.junctions.push({id:'j1',x:-180,y:-26});window.CircuitModel.connect(d,'load:l','j1:p');app.loadDocument(d)");await gesture('wire-body','[data-hit="wire:w1:0"]',{x:0,y:-24});
    await load("const d=window.CircuitHouseholdPresets.create('C08'),w=d.wires.find(w=>w.to==='load:l'),route=window.CircuitRouting.route(d,w);window.CircuitModel.splitWire(d,w.id,{x:(route[0].x+route[1].x)/2,y:(route[0].y+route[1].y)/2,segment:0},route);app.loadDocument(d)");const junction=await childEval(`${actor}.getDocument().junctions.find(j=>window.CircuitModel.degree(${actor}.getDocument(),j.id+':p')>1).id`);await gesture('junction',`[data-hit="junction:${junction}"]`,{x:30,y:16});
    await load("app.loadDocument(window.CircuitHouseholdPresets.create('C03'))");await gesture('hand','[data-hit="hand:person"]',`window.CircuitHouseholdComponents.contactPoint(${actor}.getDocument().components.find(c=>c.id==='load'))`,'touchEnd',`${actor}.captureSession().contacts.person==='load'`);
    await load("app.loadDocument(window.CircuitHouseholdPresets.create('C03'))");await gesture('hand','[data-hit="hand:person"]',{x:-32,y:0},'touchCancel');
    await load("app.loadDocument(window.CircuitHouseholdPresets.create('C02'))");await gesture('switch','[data-hit="body:switch"]',null,'touchEnd',`${actor}.getDocument().components.find(c=>c.id==='switch').params.closed===false`);
    await load("app.loadDocument(window.CircuitHouseholdPresets.create('C08'))");
    const before=await observation(),beforeState=await capture(),camera=await childEval(actor+'.getInteraction().camera'),p=await worldPoint(`({x:0,y:160})`),one=touchId++,two=touchId++;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x-24,y:p.y,id:one},{x:p.x+24,y:p.y,id:two}]});const during=[];for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-24-i*2,y:p.y-i*2,id:one},{x:p.x+24+i*2,y:p.y-i*2,id:two}]});await delay(20);during.push(await observation());}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(80);const after=await observation(),issues=[];if(JSON.stringify(beforeState)!==JSON.stringify(await capture()))issues.push('camera changed work');if(JSON.stringify(camera)===JSON.stringify(await childEval(actor+'.getInteraction().camera')))issues.push('camera did not move');for(const sample of [...during,after])for(const key of ['host','outerWindow','document','panel'])if(Math.abs(sample[key]-before[key])>1.1)issues.push('camera moved '+key);results.push({case:'G5-household-two-finger-camera',before,after,during,issues});
  }finally{await childEval(`(()=>{${actor}.setReadOnly(false);${actor}.restoreSession(${JSON.stringify(saved)});return true;})()`);}
  return results;
}
function projectileReadingGeometry(){
  const app=window.__projectileApp,s=app.getState(),g=app.getGeometry(),e=document.querySelector('#scene [data-reading-target]'),r=s.rows[e?.dataset.readingSlot],p=r?window.ProjectileModel.impact(r.depthMm,r.speedOffsetPpm):null;
  const near=(a,b)=>Math.abs(a-b)<1e-5;
  const red=document.querySelector('#readingPreviewSvg [data-reading-target]'),marks=[...document.querySelectorAll('#readingPreviewSvg [data-impact-mark]')];
  const mark=e?marks[s.rows.slice(0,+e.dataset.readingSlot).filter(Boolean).length]:null;
  return{
    aligned:!!e&&!!p&&near(+e.getAttribute('cx'),g.ox+p.x*g.s)&&near(+e.getAttribute('cy'),g.oy+p.y*g.s),
    previewAligned:!!e&&!!red&&!!mark&&red.dataset.readingSlot===e.dataset.readingSlot&&near(+red.getAttribute('cx'),+mark.getAttribute('cx'))&&near(+red.getAttribute('cy'),+mark.getAttribute('cy')),
    inCanvas:document.getElementById('readingChoices').parentElement.id==='stage',corner:!!document.getElementById('magnifier')
  };
}
async function runProjectileOperations({cdp,childEval,observation,prepare,delay},spec){
  if(!spec.projectileTarget)return[];
  const results=[],selector=spec.projectileTarget,[dx,dy]=spec.projectileDelta;
  const previewStart=selector==='#previewRulerTarget'?await childEval('window.__projectileApp.getState().ruler'):null;
  for(const ending of['complete','cancel','lostcapture','blur','secondary']){
    if(previewStart)await childEval(`window.__projectileApp.controller.command({type:'ruler',value:${JSON.stringify(previewStart)}})`);
    await prepare('stage','middle');
    const point=await childEval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||!e.getClientRects().length)throw Error('Missing projectile drag target');const r=e.getBoundingClientRect(),f=frameOffset();let x=r.left+r.width*.5,y=r.top+r.height*.5;
      if(${JSON.stringify(selector)}==='#rulerBodyTarget'){
        const stage=document.getElementById('stage').getBoundingClientRect(),left=Math.max(r.left,stage.left,0),right=Math.min(r.right,stage.right,innerWidth),top=Math.max(r.top,stage.top,0),bottom=Math.min(r.bottom,stage.bottom,innerHeight);
        const exposed=[];for(const fy of [.5,.2,.8,.05,.95])for(const fx of [.5,.2,.8]){const px=left+(right-left)*fx,py=top+(bottom-top)*fy;if(document.elementFromPoint(px,py)===e)exposed.push([px,py]);}
        if(!exposed.length)throw Error('No exposed ruler body beside reading preview');[x,y]=exposed[0];
      }
      return{x:x+f.left,y:y+f.top,hit:document.elementFromPoint(x,y)===e,touchAction:getComputedStyle(e).touchAction};})()`);
    const before=await observation(),samples=[],issues=[],id=9001;
    const touch=(x,y,key=id)=>({x,y,id:key,radiusX:2,radiusY:2,force:1});
    if(!point.hit||point.touchAction!=='none')issues.push('projectile target not exposed with touch ownership');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point.x,point.y)]});
    for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(point.x+dx*i/6,point.y+dy*i/6)]});await delay(20);samples.push(await observation());}
    const preview=await childEval('!document.getElementById("readingChoices").hidden');
    if(selector==='#rulerBodyTarget'||selector==='#previewRulerTarget'){
      const alignment=await childEval(`(${projectileReadingGeometry.toString()})()`);
      if(preview!==alignment.aligned||(preview&&!alignment.previewAligned)||!alignment.inCanvas||alignment.corner)issues.push('ruler preview must be in canvas exactly when aligned');
    }
    if(ending==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    else{
      if(ending==='blur')await childEval('window.dispatchEvent(new window.Event("blur"))');
      if(ending==='lostcapture')await childEval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),id=window.__auditEvents.find(e=>e.type==='pointerdown'&&e.pointerType==='touch')?.pointerId;if(id==null||!e.hasPointerCapture(id))throw Error('Missing capture');e.releasePointerCapture(id);})()`);
      if(ending==='secondary')await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point.x+dx,point.y+dy),touch(point.x-45,point.y,9002)]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    for(const ms of[20,100,400]){await delay(ms===20?20:ms===100?80:300);samples.push(await observation());}
    const after=await observation();
    for(const sample of[...samples,after]){
      for(const key of['host','document','panel','outerWindow'])if(Math.abs(sample[key]-before[key])>1.1)issues.push('projectile drag moved '+key);
      if(sample.iframe&&before.iframe&&(Math.abs(sample.iframe.x-before.iframe.x)>1.1||Math.abs(sample.iframe.y-before.iframe.y)>1.1))issues.push('projectile drag moved iframe');
    }
    if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('projectile drag not trusted');
    const oldState=before.state.hooks.__projectileApp,newState=after.state.hooks.__projectileApp;
    if(ending==='complete'){
      if(JSON.stringify(oldState)===JSON.stringify(newState))issues.push('projectile drag did not change intended work');
      if(!after.events.some(e=>e.type==='pointerup'&&e.isTrusted)||after.events.some(e=>e.type==='pointercancel'))issues.push('projectile completion missed pointerup');
    }else if(JSON.stringify(oldState)!==JSON.stringify(newState)||before.state.suspend!==after.state.suspend)issues.push('projectile interruption changed saved work');
    results.push({case:'projectile-'+selector+'-'+ending,point,preview,before,after,samples,issues:[...new Set(issues)]});
  }
  return results;
}
async function runCircularVectorOperations({cdp,childEval,observation,prepare,delay},spec){
  if(!await childEval("window.__circularVectorApp?.controller.mode==='edit'"))return [];
  const results=[],endings=spec.id==='initial'?['complete','cancel','lostcapture','secondary','blur','navigate','check']:['complete'];let id=20000;
  for(const ending of endings){
    await prepare('stage','middle');
    await childEval("document.getElementById('controlPanel').scrollTop=0");
    const point=await childEval(`(()=>{const app=window.__circularVectorApp,s=app.getState(),M=window.CircularVectorModel,g=M.scene(s),p=app.getGeometry().position,r=document.getElementById('positionHandle').getBoundingClientRect(),f=frameOffset();window.__auditEvents=[];const x=r.left+r.width/2,y=r.top+r.height/2;return{x:x+f.left,y:y+f.top,hit:document.elementFromPoint(x,y)===document.getElementById('positionHandle'),gap:s.observation[M.GAP_KEYS[s.task]],target:s.observation[M.GAP_KEYS[s.task]]===5?35:5,theta:g.thetaA,sense:g.sense,cx:p.left+p.center[0]+f.left,cy:p.top+p.center[1]+f.top,radius:p.r};})()`);
    if(!point.hit)throw Error('Circular B handle is not exposed');
    const before=await observation(),pointer=id++,touch=p=>({x:p.x,y:p.y,id:pointer,radiusX:1,radiusY:1,force:1}),samples=[];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point)]});samples.push(await observation());
    let end;
    for(let step=1;step<=6;step++){const theta=point.theta+point.sense*(point.gap+(point.target-point.gap)*step/6)*Math.PI/180;end={x:point.cx+point.radius*Math.cos(theta),y:point.cy-point.radius*Math.sin(theta)};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(end)]});await delay(15);samples.push(await observation());}
    const preview=await childEval(`(()=>{const p=document.getElementById('preview').getBoundingClientRect(),b=document.getElementById('positionHandle').getBoundingClientRect();return{visible:!document.getElementById('preview').hidden,intercepts:getComputedStyle(document.getElementById('preview')).pointerEvents!=='none',coversTarget:p.left<b.left+b.width/2&&p.right>b.left+b.width/2&&p.top<b.top+b.height/2&&p.bottom>b.top+b.height/2};})()`);
    if(ending==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    else{
      if(ending==='lostcapture'){await childEval(`(()=>{const e=document.getElementById('positionHandle'),p=window.__auditEvents.find(e=>e.type==='pointerdown'&&e.pointerType==='touch');if(!p||!e.hasPointerCapture(p.pointerId))throw Error('Missing actual B pointer capture');e.releasePointerCapture(p.pointerId);})()`);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(end)]});}
      if(ending==='secondary')await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(end),{...touch(end),x:end.x+20,id:id++}]});
      if(ending==='blur')await childEval("window.dispatchEvent(new window.Event('blur'))");
      if(ending==='navigate')await childEval("document.querySelector('[data-task=\"'+((window.__circularVectorApp.getState().task+1)%3)+'\"]').click()");
      if(ending==='check')await childEval("document.getElementById('checkButton').click()");
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await delay(100);const after=await observation(),issues=[];
    for(const sample of [...samples,after]){
      for(const key of ['host','document','documentX','panel','outerWindow','immediateParent'])if(Math.abs(sample[key]-before[key])>1.1)issues.push('owned drag moved '+key);
      if(before.iframe&&sample.iframe&&(Math.abs(sample.iframe.y-before.iframe.y)>1.1||Math.abs(sample.iframe.x-before.iframe.x)>1.1))issues.push('owned drag moved iframe');
      if(before.viewport&&sample.viewport&&['pageTop','pageLeft','offsetTop','offsetLeft'].some(k=>Math.abs(sample.viewport[k]-before.viewport[k])>1.1))issues.push('owned drag moved visual viewport');
    }
    const old=before.state.hooks.__circularVectorApp,next=after.state.hooks.__circularVectorApp;
    if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('missing trusted B touch');
    if(!after.events.some(e=>e.type==='pointermove'&&e.isTrusted))issues.push('missing B pointermove');
    if(!preview.visible||preview.intercepts||preview.coversTarget)issues.push('B preview is hidden, intercepts input or covers its target');
    if(JSON.stringify(old.answers)!==JSON.stringify(next.answers))issues.push('B drag changed assessed answers');
    for(const sample of samples)if(JSON.stringify(sample.state.hooks.__circularVectorApp)!==JSON.stringify(old)||sample.state.suspend!==before.state.suspend)issues.push('drag saved uncommitted state');
    if(ending==='complete'){
      if(!after.events.some(e=>e.type==='pointerup'&&e.isTrusted)||after.events.some(e=>e.type==='pointercancel'))issues.push('B completion missed pointerup');
      const key=['positionGapDeg','velocityGapDeg','transferGapDeg'][old.task];if(next.observation[key]!==point.target)issues.push('B completion did not save expected angle');
      for(const k of Object.keys(old.observation))if(k!==key&&next.observation[k]!==old.observation[k])issues.push('B changed another page interval');
    }else if(JSON.stringify(old.observation)!==JSON.stringify(next.observation))issues.push('B cancellation did not roll back');
    if(await childEval("!document.getElementById('preview').hidden||window.__circularVectorApp.isDragging()"))issues.push('B preview/capture remains after gesture');
    results.push({case:'circular-vector-B-'+ending,point,preview,before,after,samples,issues:[...new Set(issues)]});
  }
  return results;
}
async function runRocketOperations({cdp,childEval,observation,prepare,delay},spec){
  if(!['camera-surface','planning'].includes(spec.id))return [];
  const results=[],selector=spec.id==='camera-surface'?'#cameraSurface':'#nodeHandle';let id=17000;
  for(const ending of ['complete','cancel','secondary','blur','lostcapture']){
    await prepare('stage','middle');const point=await childEval(`(()=>{const e=document.querySelector('${selector}'),r=e.getBoundingClientRect(),f=frameOffset();if(e.hidden||!r.width)throw Error('Rocket owned target unavailable');return{x:r.x+(e.id==='cameraSurface'?44:r.width/2)+f.left,y:r.y+r.height/2+f.top};})()`),before=await observation(),samples=[],touch=p=>({...p,id,radiusX:1,radiusY:1,force:1});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point)]});for(let j=1;j<=4;j++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch({x:point.x+j*4,y:point.y+j*2})]});await delay(20);samples.push(await observation());}
    if(ending==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    else if(ending==='secondary'){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch({x:point.x+16,y:point.y+8}),{...touch({x:point.x-12,y:point.y+12}),id:id+1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{if(ending==='blur')await childEval("window.dispatchEvent(new window.Event('blur'))");if(ending==='lostcapture')await childEval(`(()=>{const e=document.querySelector('${selector}'),p=window.__auditEvents.find(e=>e.type==='pointerdown')?.pointerId;if(p==null||!e.hasPointerCapture(p))throw Error('Rocket did not capture');e.releasePointerCapture(p);})()`);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await delay(80);const after=await observation(),issues=[];for(const sample of [...samples,after])for(const key of ['host','document','panel','outerWindow','immediateParent'])if(Math.abs((sample[key]||0)-(before[key]||0))>1.1)issues.push('rocket owned drag moved '+key);
    const canonical=v=>JSON.stringify(v.state.hooks.__rocketApp);if(spec.id==='camera-surface'||ending!=='complete'){if(canonical(before)!==canonical(after))issues.push('rocket cancelled/camera gesture changed answer');}else if(canonical(before)===canonical(after))issues.push('rocket node drag did not commit');
    if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('rocket missing trusted touch');if(await childEval("!document.getElementById('touchPreview').hidden"))issues.push('rocket preview remained');results.push({case:'rocket-'+spec.id+'-'+ending,point,before,after,samples,issues:[...new Set(issues)]});id+=2;
  }return results;
}
module.exports={runMirrorOperations,runHouseholdOperations,runProjectileOperations,projectileReadingGeometry,runCircularVectorOperations,runRocketOperations};
