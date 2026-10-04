'use strict';
const assert=require('node:assert/strict');
const M=require('../sim/circuit-workbench/circuit-model'),G=require('../sim/circuit-workbench/circuit-routing');
const xy=p=>({x:p.x,y:p.y});
const near=(a,b,message)=>assert(Math.hypot(a.x-b.x,a.y-b.y)<.02,message);
const ends=(d,w)=>[xy(M.endpoints(d).get(w.from)),xy(M.endpoints(d).get(w.to))];
const bow=p=>Math.max(...p.map(q=>G.nearest([p[0],p.at(-1)],q).distance));
function fixture(){const d=M.empty();d.display.flow='off';M.add(d,'battery',200,200);const w=M.addWire(d,340,310);return{d,w};}

async function wireGripCases(h,mode,base){
  let width,touchId=14000;
  const evidence=(kind,data={})=>h.evidence.push({mode,wireGrip:kind,width,...data});
  async function tap(selector){if(width<600)await h.touch(await h.point(selector),0,0);else await h.click(selector);}
  async function sample(){return h.inside(`(()=>{const e=document.querySelector('#scene [data-wire="w1"]'),p=e?Array.from(e.getAttribute('d').matchAll(/[ML]([^ML]+)/g),m=>{const[x,y]=m[1].split(',').map(Number);return{x,y};}):[];return{path:p,interaction:CircuitWorkbench.getInteraction(),preview:!document.getElementById('preview').hidden,saved:CircuitWorkbench.exportDocument(),scroll:[scrollX,scrollY,visualViewport.offsetLeft,visualViewport.offsetTop]};})()`);}
  async function start(p,kind){
    assert.equal(await h.inside(`document.elementFromPoint(${p.x},${p.y})?.meta?.kind`),kind,'grip hits the visible intended target');
    const id=touchId++,before=await sample();
    if(width<600)await h.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id,radiusX:2,radiusY:2,force:1}]});
    else await h.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
    await h.delay(20);return{p,last:p,id,before};
  }
  async function move(grip,to,check){const from=grip.last;for(let i=1;i<=8;i++){
    const p={x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8};
    if(width<600)await h.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:grip.id,radiusX:2,radiusY:2,force:1}]});
    else await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1});
    await h.delay(20);const held=await sample();assert.equal(held.saved,grip.before.saved,'drag previews do not write history');assert.deepEqual(held.interaction.camera,grip.before.interaction.camera);assert.deepEqual(held.scroll,grip.before.scroll);if(check)check(held);
  }grip.last=to;return sample();}
  async function finish(grip,cancel=false){
    if(width<600)await h.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
    else{if(cancel)await h.key('Escape','Escape',27);await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',...grip.last,button:'left',buttons:0,clickCount:1});}
    await h.delay(40);const s=await sample();assert.equal(s.interaction.dragging,null);assert(!s.preview);return s;
  }
  async function gripEnd(key){return start(await h.point(`[data-hit="wireend:w1:${key}"]`),'wireend');}
  async function gripBody(d,w){return start(await h.scenePoint(G.along(G.route(d,w),G.length(G.route(d,w))/2)),'wire');}

  for(const w of [390,1280]){
    width=w;console.log(`${mode}: focused straight cable grips ${width}px`);await h.freshPage();h.setContext('window');
    await h.send('Emulation.setDeviceMetricsOverride',{width,height:width<600?844:800,deviceScaleFactor:1,mobile:width<600});
    await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});
    await h.send('Page.navigate',{url:base+'/circuit-workbench/index.html'});await h.ready();
    await h.inside(`window.__gripEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.getElementById('surface').addEventListener(type,e=>__gripEvents.push({type,trusted:e.isTrusted,pointer:e.pointerType,target:e.target.dataset.hit}));`);
    await h.load(M.empty());await tap('#quickWire');const taken=await h.doc();assert.equal(taken.cables.count,20);assert.equal(taken.wires.length,1);assert.equal(taken.wires[0].via.length,0);assert.equal(await h.inside('document.getElementById("wireStock").textContent'),'19 / 20');evidence('take-straight',{stock:20});

    for(const key of ['from','to']){
      await h.load(taken);const before=await h.doc(),wire=before.wires[0],other=key==='from'?1:0,fixed=ends(before,wire)[other],grip=await gripEnd(key),scale=grip.before.interaction.camera.scale;
      await move(grip,{x:grip.p.x-35*scale,y:grip.p.y+45*scale},held=>{near(held.path[other?held.path.length-1:0],fixed,'far loose endpoint is stationary');assert.equal(held.path.length,2,'loose cable stays straight every frame');});
      await finish(grip);const after=await h.doc();near(ends(after,after.wires[0])[other],fixed);assert.equal(after.wires[0].via.length,0);await tap('#undo');assert.equal(await h.save(),grip.before.saved);evidence('loose-end',{key,fixedFarEnd:true,straightFrames:8,undo:true});
    }
    for(const key of ['from','to']){
      const f=fixture();await h.load(f.d);const before=await h.doc(),wire=before.wires[0],other=key==='from'?1:0,fixed=ends(before,wire)[other],grip=await gripEnd(key),destination=await h.scenePoint(M.endpoints(before).get('c1:a'));
      const held=await move(grip,destination,s=>{near(s.path[other?s.path.length-1:0],fixed,'endpoint snap keeps far end stationary');assert.equal(s.path.length,2);});assert.equal(held.interaction.snap,'c1:a');
      await finish(grip);const after=await h.doc();assert.equal(after.wires[0][key],'c1:a');near(ends(after,after.wires[0])[other],fixed);evidence('endpoint-snap',{key,fixedFarEnd:true});
    }

    const f=fixture();assert(M.attach(f.d,f.w.id,'from','c1:a'));await h.load(f.d);let d=await h.doc(),wire=d.wires[0],fixed=ends(d,wire);const electrical=await h.inside('CircuitWorkbench.getAnalysis()'),body=await gripBody(d,wire),scale=body.before.interaction.camera.scale;
    await move(body,{x:body.p.x,y:body.p.y+75*scale},held=>{near(held.path[0],fixed[0]);near(held.path.at(-1),fixed[1]);assert(!held.preview,'body bending does not open magnifier');});await finish(body);
    d=await h.doc();wire=d.wires[0];assert(bow(G.route(d,wire))>60);assert.deepEqual(ends(d,wire),fixed);assert.deepEqual(await h.inside('CircuitWorkbench.getAnalysis()'),electrical);const bent=await h.save();evidence('one-attached-body-bend',{bothEndsFixed:true,openEndFixed:true});
    await h.screenshot(`${mode}-one-attached-wire-bend-${width}.png`);

    // Restore the actual resulting document, then continue through a trusted endpoint grip.
    await h.load(bent);const endpoint=await gripEnd('to'),endScale=endpoint.before.interaction.camera.scale;
    await move(endpoint,{x:endpoint.p.x+35*endScale,y:endpoint.p.y-20*endScale},held=>{near(held.path[0],fixed[0]);assert(bow(held.path)>40,'existing curvature survives endpoint movement');assert(G.length(held.path)<=d.wires[0].length+.05);});await finish(endpoint);
    const changed=await h.save();assert.notEqual(changed,bent);await tap('#undo');assert.equal(await h.save(),bent);await tap('#redo');assert.equal(await h.save(),changed);evidence('curved-free-end',{originalBendPreserved:true,restoredContinuation:true,undoRedo:true});
    const abort=await gripEnd('to');await move(abort,{x:abort.p.x-20,y:abort.p.y+20});await finish(abort,true);assert.equal(await h.save(),changed);const continueGrip=await gripEnd('to');await move(continueGrip,{x:continueGrip.p.x-15,y:continueGrip.p.y-15});await finish(continueGrip);assert.notEqual(await h.save(),changed);await tap('#undo');assert.equal(await h.save(),changed);evidence('cancel-and-continue',{rollback:true});

    // Keep the existing whole-body pickup: transient snap, leave, then rigid snap on release.
    const loose=fixture();await h.load(loose.d);d=await h.doc();wire=d.wires[0];const old=ends(d,wire),target=M.endpoints(d).get('c1:a'),body2=await gripBody(d,wire),s=body2.before.interaction.camera.scale,at={x:body2.p.x+(target.x-old[0].x)*s+8,y:body2.p.y+(target.y-old[0].y)*s};
    let held=await move(body2,at,x=>assert(!x.preview));assert.equal(held.interaction.snap,'c1:a');near(held.path[1],{x:target.x+old[1].x-old[0].x,y:target.y+old[1].y-old[0].y},'body snap translates far end by the same amount');
    held=await move(body2,body2.p);assert.equal(held.interaction.snap,null,'moving away clears transient snap');await move(body2,at);await finish(body2);const joined=await h.doc(),points=ends(joined,joined.wires[0]);assert.equal(joined.wires[0].from,'c1:a');near({x:points[1].x-points[0].x,y:points[1].y-points[0].y},{x:180,y:0});assert.equal(joined.wires[0].via.length,0);evidence('whole-body-snap',{rigid:true,transientLeave:true});

    const events=await h.inside('__gripEvents'),pointer=width<600?'touch':'mouse';assert(events.every(e=>e.trusted));for(const type of ['pointerdown','pointermove','pointerup'])assert(events.some(e=>e.type===type&&e.pointer===pointer));assert.equal(events.filter(e=>e.type==='pointercancel').length,width<600?1:0,'only the explicit cancellation interrupts');assert.equal(await h.inside('document.documentElement.scrollWidth>innerWidth'),false);evidence('trusted-ownership',{pointer,events:events.length,noOverflow:true});
  }
}
module.exports={wireGripCases};
