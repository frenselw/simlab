#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {spawn}=require("node:child_process");
const {XMLParser}=require("fast-xml-parser");
const {CdpClient,buildAndExtractPackage,createServer,listenServer,devToolsPort,fetchJson,evaluate,delay,findBrowser,stopChrome,closeServer,validateOwnedDirectory}=require("./position-time-browser-regression.js");
const M=require("../sim/motion-composition-stroboscopic-lab/model.js"),P=require("../sim/motion-composition-stroboscopic-lab/persistence.js"),S=require("../sim/motion-composition-stroboscopic-lab/scoring.js");
const {filled,durableDraft,finishedData}=require("../sim/motion-composition-stroboscopic-lab/test-support.js");
const root=path.resolve(__dirname,".."),slug=P.ACTIVITY,suffix=process.env.MOTION_ARTIFACT_SUFFIX||"";
if(suffix&&!/^[a-z0-9-]+$/.test(suffix))throw new Error("Invalid artifact suffix");
const artifactDir=path.join(root,"output/playwright/motion-composition-stroboscopic-lab",suffix);
function sourceParity(){
 const html=fs.readFileSync(path.join(root,"sim",slug,"index.html"),"utf8");
 const refs=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(m=>path.posix.normalize(`${slug}/${m[1]}`)).sort();
 const parsed=new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(path.join(root,"sim/manifests",`${slug}.xml`),"utf8"));
 const declared=parsed.manifest.resources.resource.file.map(f=>f["@_href"]).filter(f=>f!=="config.js"&&f!==`${slug}/index.html`).sort();assert.deepEqual(refs,declared);return refs;
}
const call = (cdp, code, embedded = false) => evaluate(cdp, `((w,d)=>{${code}})(${embedded ? 'document.getElementById("activity").contentWindow,document.getElementById("activity").contentDocument' : "window,document"})`);
async function ready(cdp, embedded = false) {
  for (let i = 0; i < 150; i++) {
    try { if (await call(cdp, "return d.readyState==='complete' && Boolean(w.__motionComposition);", embedded)) return; } catch (_) {}
    await delay(40);
  }
  throw new Error("Activity did not initialize");
}
async function viewport(cdp, width, height, touch = true, scale = 1) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600, scale });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: 2 });
}
async function preload(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const params=new URLSearchParams(location.search);
    window.__storageProbes=0;
    if(params.has('__denyStorage')) Object.defineProperty(window,'localStorage',{get(){window.__storageProbes++;throw new DOMException('Storage denied by test','SecurityError');}});
    if(params.has('__seed')) Object.defineProperty(crypto,'getRandomValues',{value(a){a.fill(0);a[0]=Number(params.get('__seed'))>>>0;return a;}});
    if(params.has('__fixture')) {
      const durable=JSON.parse(params.get('__fixture')),values={...durable};let error='0';
      window.__lmsValues=durable;window.__failFinal=false;window.__failFinish=false;
      window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>(error='0',values[k]||''),
        LMSSetValue:(k,v)=>{if(window.__failFinal&&k==='cmi.core.score.raw'){error='351';return 'false';} values[k]=String(v);error='0';return 'true';},
        LMSCommit:()=>{Object.assign(durable,values);return 'true';},LMSFinish:()=>window.__failFinish?'false':'true',LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};
    }
  })();` });
}
async function navigate(cdp, base, options = {}) {
  // Each fixture is a new browsing session. Clear the emulator's gesture
  // sequence before replacing a document that may just have scrolled.
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const params = new URLSearchParams();
  if (options.fixture !== false) params.set("__fixture", JSON.stringify(options.fixture || { "cmi.core.lesson_status": "not attempted" }));
  if(options.denyStorage) params.set("__denyStorage","1");
  const src = `/${slug}/index.html?${params}`;
  const url = options.embedded ? `${base}/__embed-scroll-test.html?src=${encodeURIComponent(src)}${options.fluid ? "&fluid=1" : ""}` : `${base}${src}`;
  await cdp.send("Page.navigate", { url }); await delay(100); await ready(cdp, options.embedded);
  if (options.embedded) { await evaluate(cdp, "scrollTo(0,300)"); await delay(70); }
}
async function rect(cdp, selector, embedded = false, scroll = false) {
  const r = await call(cdp, `const e=d.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing ${selector}');${scroll ? "e.scrollIntoView({block:'nearest'});" : ""}const r=e.getBoundingClientRect();return {visible:Boolean(e.getClientRects().length&&r.width>0&&r.height>0&&w.getComputedStyle(e).visibility!=='hidden'),x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};`, embedded);
  assert.equal(r.visible,true,`Hidden target ${selector}`);
  if (embedded) {
    const f = await evaluate(cdp, "(()=>{const r=document.getElementById('activity').getBoundingClientRect();return {x:r.left,y:r.top};})()"); r.x += f.x; r.y += f.y;
  }
  return r;
}
async function click(cdp, selector, embedded = false) {
  const p = await rect(cdp, selector, embedded, true);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 }); await delay(40);
}
const traySelector=slot=>`#trayHandle${slot+1}`;
async function capture(cdp,embedded=false){
 await click(cdp,'#observeButton',embedded);
 for(let i=0;i<180;i++){if((await state(cdp,embedded)).cases[(await call(cdp,'return w.__motionComposition.getSelection().case;',embedded))].observed)return;await delay(25);}
 throw new Error('Progressive capture did not complete');
}
const state=(cdp,embedded=false)=>call(cdp,'return w.__motionComposition.getState();',embedded);
const mode=(cdp,embedded=false)=>call(cdp,'return w.__motionComposition.getMode();',embedded);
const touchPoint=(p,id=1)=>({x:p.x,y:p.y,id,radiusX:2,radiusY:2,force:1});
async function settled(cdp,condition,embedded=false,label='UI condition'){
 for(let i=0;i<80;i++){if(await call(cdp,condition,embedded))return;await delay(25);}
 const actual=await call(cdp,"return {interaction:w.__motionComposition.getInteraction(),pointer:w.__motionComposition.getPointerDiagnostics(),previewHidden:d.getElementById('magnifier').hidden,inputProbe:w.__inputProbe,hitProbe:w.__hitProbe};",embedded);
 throw new Error(`${label} did not settle: ${JSON.stringify(actual)}`);
}
async function previewEvidence(cdp,end,embedded){
 const cursor=await call(cdp,`const r=d.getElementById('stage').getBoundingClientRect(),f=${embedded?'w.frameElement.getBoundingClientRect()':'{x:0,y:0}'};return {x:${end.x}-f.x-r.x,y:${end.y}-f.y-r.y};`,embedded);
 await settled(cdp,`const i=w.__motionComposition.getInteraction();return i.active&&i.point&&i.cursor&&Math.hypot(i.cursor.x-${cursor.x},i.cursor.y-${cursor.y})<1.1;`,embedded,'final touch move');
 const evidence=await call(cdp,`const a=w.__motionComposition,i=a.getInteraction(),l=a.getGeometry(),m=d.getElementById('magnifier'),r=m.getBoundingClientRect(),s=d.getElementById('stage').getBoundingClientRect(),app=d.getElementById('app').getBoundingClientRect(),svg=d.getElementById('magnifierSvg');return {hidden:m.hidden,text:d.getElementById('previewValues').textContent,readout:d.getElementById('positionReadout').textContent,point:i.point,cursor:i.cursor,geometry:l,bounds:[r.left-s.left,r.top-s.top,r.width,r.height],inside:r.left>=app.left&&r.right<=app.right&&r.top>=app.top&&r.bottom<=app.bottom,insideStage:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom,appBounds:app.toJSON(),overlayBounds:r.toJSON(),intercept:w.getComputedStyle(m).pointerEvents,viewBox:svg.getAttribute('viewBox').split(' ').map(Number),svgSize:[svg.clientWidth,svg.clientHeight],mainPoints:[...d.querySelectorAll('#stageSvg circle[data-ball="answer"][data-selected="true"]')].map(e=>[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))]),previewPoints:[...svg.querySelectorAll('circle[data-ball="answer"][data-selected="true"]')].map(e=>[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))]),clipIds:[...svg.querySelectorAll('[id]')].map(e=>e.id)};`,embedded);
 assert.equal(evidence.hidden,false);assert.ok(evidence.inside);assert.equal(evidence.intercept,'none');
 if(evidence.geometry.width>=300)assert.equal(evidence.insideStage,true,'normal viewport keeps the preview in the stage');
 const focus=M.pixel(evidence.point,evidence.geometry),[x,y,width,height]=evidence.viewBox;
 assert.ok(Math.abs(x+width/2-focus.x)<1e-8&&Math.abs(y+height/2-focus.y)<1e-8,'preview uses the resolved focus');
 assert.ok(Math.abs(evidence.svgSize[0]/width-3)<.07&&Math.abs(evidence.svgSize[1]/height-3)<.01,'actual preview magnification');
 assert.ok(evidence.mainPoints.some(p=>Math.hypot(p[0]-focus.x,p[1]-focus.y)<1e-8));assert.ok(evidence.previewPoints.some(p=>Math.hypot(p[0]-focus.x,p[1]-focus.y)<1e-8));
 assert.ok(evidence.clipIds.every(id=>id.startsWith('preview-')));
 for(const [axis,value] of [['x',evidence.point[0]],['y',evidence.point[1]]]){assert.ok(evidence.text.includes(`${axis} ${M.format(value)} m`));assert.ok(evidence.readout.includes(`${axis} = ${M.format(value)} m`));}
 const [left,top,w,h]=evidence.bounds;assert.ok(!(evidence.cursor.x>left-16&&evidence.cursor.x<left+w+16&&evidence.cursor.y>top-16&&evidence.cursor.y<top+h+16),'preview avoids the finger');
 return evidence;
}
async function dragTouch(cdp,start,end,during=null){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(start)]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:start.x+(end.x-start.x)*i/10,y:start.y+(end.y-start.y)*i/10})]});await delay(14);}
 if(during)await during();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(350);
}
async function screenshot(cdp,name){const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(artifactDir,`${name}.png`),Buffer.from(data,'base64'));}
async function metrics(cdp,embedded=false){
 const local=await call(cdp,`const a=w.__motionComposition,p=d.getElementById('controlPanel'),r=d.getElementById('stage').getBoundingClientRect(),v=w.visualViewport;return {doc:[w.scrollX,w.scrollY],range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.scrollTop,panelRange:p.scrollHeight-p.clientHeight,stage:[r.left,r.top,r.width,r.height],view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],answer:JSON.stringify(a.getState()),selection:a.getSelection(),pointer:a.getPointerDiagnostics()};`,embedded);
 const host=await evaluate(cdp,`(()=>{const v=visualViewport,r=${embedded?'document.getElementById("activity").getBoundingClientRect()':'null'};return {x:scrollX,y:scrollY,view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],frame:r?[r.left,r.top,r.width,r.height]:null};})()`);return {...local,host};
}
function fixed(before,after,owner,label,time=before.selection.time){
 assert.deepEqual(after.selection,{...before.selection,time},`${label}: selection`);assert.deepEqual(after.doc,before.doc,`${label}: document`);assert.ok(after.range<=1,`${label}: no third scroll owner`);assert.deepEqual(after.view,before.view,`${label}: activity viewport`);assert.deepEqual(after.stage,before.stage,`${label}: local stage`);
 if(owner!=='panel')assert.equal(after.panel,before.panel,`${label}: panel`);if(owner!=='host')assert.deepEqual(after.host,before.host,`${label}: host/frame/viewport`);if(owner!=='drag')assert.equal(after.answer,before.answer,`${label}: authoritative answers`);
}
async function stagePoint(cdp,p,embedded=false){let r=await call(cdp,"const r=d.getElementById('stage').getBoundingClientRect();return{x:r.left,y:r.top};",embedded);if(embedded){const f=await evaluate(cdp,"(()=>{const r=document.getElementById('activity').getBoundingClientRect();return{x:r.left,y:r.top};})()");r={x:r.x+f.x,y:r.y+f.y};}return{x:r.x+p.x,y:r.y+p.y};}
async function target(cdp,index,slot,embedded=false){const l=await call(cdp,'return w.__motionComposition.getGeometry();',embedded);return stagePoint(cdp,M.pixel(M.expected(index)[slot],l),embedded);}
async function drawMouse(cdp,index,slot,embedded=false,finalDifferent=false){const start=await rect(cdp,traySelector(slot),embedded),end=await target(cdp,index,slot,embedded);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:end.x+(finalDifferent?20:0),y:end.y,button:'left',buttons:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',clickCount:1});await delay(60);}
async function select(cdp,id,value,embedded=false){await call(cdp,`const e=d.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new w.Event('change',{bubbles:true}));`,embedded);}
async function key(cdp,key,modifiers=0){await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,modifiers});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,modifiers});}
const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
async function diagramReadability(cdp,embedded=false){
 const e=await call(cdp,`const box=e=>e.getBoundingClientRect().toJSON(),ink=e=>{const r=d.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().toJSON();};return {
  stage:box(d.getElementById('stage')),
  labels:[...d.querySelectorAll('#stageSvg text')].map(e=>({text:e.textContent,axis:e.dataset.axisName||null,point:e.dataset.pointLabel||null,bounds:box(e)})),
  headers:['stageTime','componentLegend','stageHint'].map(id=>d.getElementById(id)).filter(e=>e.getClientRects().length&&e.textContent).map(e=>({text:e.textContent,bounds:ink(e)})),
  balls:[...d.querySelectorAll('#stageSvg circle[data-ball]')].map(e=>{const r=box(e),pad=Number(w.getComputedStyle(e).strokeWidth.replace('px',''))/2;return {ball:e.dataset.ball,point:e.dataset.pointSlot||null,slot:e.dataset.stamp||null,bounds:{left:r.left-pad,right:r.right+pad,top:r.top-pad,bottom:r.bottom+pad}};}),
  trays:[...d.querySelectorAll('.point-tray-handle')].filter(e=>!e.hidden).map(e=>({slot:e.dataset.slot,bounds:box(e),parts:[...e.querySelectorAll('.tray-ball,.tray-time')].map(box)}))};`,embedded);
 for(const label of e.labels){
  const b=label.bounds,s=e.stage;assert.ok(b.left>=s.left&&b.right<=s.right&&b.top>=s.top&&b.bottom<=s.bottom,`diagram label clipped: ${JSON.stringify(label)}`);
  for(const ball of e.balls)if(label.point||label.axis&&!ball.point)assert.equal(overlaps(b,ball.bounds),false,`diagram label covered by a sphere: ${JSON.stringify({label,ball})}`);
 }
 for(const tray of e.trays){
  for(const b of [tray.bounds,...tray.parts])assert.ok(b.left>=e.stage.left&&b.right<=e.stage.right&&b.top>=e.stage.top&&b.bottom<=e.stage.bottom,`parking content clipped: ${JSON.stringify(tray)}`);
  for(const label of [...e.labels,...e.headers])for(const b of [tray.bounds,...tray.parts])assert.equal(overlaps(label.bounds,b),false,`parking target covers diagram text: ${JSON.stringify({label,tray})}`);
 }
 return e;
}
async function diagramLabels(cdp,embedded=false){
 const e=await call(cdp,`const selected=w.__motionComposition.getSelection(),labels=[...d.querySelectorAll('#stageSvg text')].map(e=>({text:e.textContent,bounds:e.getBoundingClientRect().toJSON()})),highlightSlots=[...d.querySelectorAll('#stageSvg circle[data-stamp][data-selected="true"]')].map(e=>e.dataset.stamp);return {selected,labels,stage:d.getElementById('stage').getBoundingClientRect().toJSON(),legend:d.getElementById('componentLegend').textContent,highlightSlots,highlights:highlightSlots.length};`,embedded);
 assert.equal(e.legend,'水平 · 垂直');assert.deepEqual(e.highlightSlots,[String(e.selected.time),String(e.selected.time)]);assert.equal(e.highlights,2);
 for(const label of e.labels)assert.ok(label.bounds.left>=e.stage.left&&label.bounds.right<=e.stage.right&&label.bounds.top>=e.stage.top&&label.bounds.bottom<=e.stage.bottom,`diagram label clipped: ${JSON.stringify(label)}`);
 for(let i=0;i<e.labels.length;i++)for(let j=i+1;j<e.labels.length;j++){
  const a=e.labels[i].bounds,b=e.labels[j].bounds,overlap=Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
  assert.equal(overlap,false,`diagram labels overlap: ${JSON.stringify([e.labels[i],e.labels[j]])}`);
 }
 e.readability=await diagramReadability(cdp,embedded);return e;
}
async function trayTargets(cdp,embedded=false){
 const evidence=await call(cdp,`const l=w.__motionComposition.getGeometry(),s=d.getElementById('stage').getBoundingClientRect();return [...d.querySelectorAll('.point-tray-handle')].map(e=>{const r=e.getBoundingClientRect();return {slot:e.dataset.slot,hidden:e.hidden,bounds:[r.left-s.left,r.top-s.top,r.width,r.height],owner:d.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.point-tray-handle')?.id===e.id,action:w.getComputedStyle(e).touchAction,ball:w.getComputedStyle(e.querySelector('.tray-ball')).backgroundImage};});`,embedded);
 const l=await call(cdp,'return w.__motionComposition.getGeometry();',embedded);
 assert.deepEqual(evidence.map(e=>e.slot),['1','2','3','4']);
 for(const e of evidence){const [x,y,width,height]=e.bounds;assert.equal(e.hidden,false);assert.equal(e.owner,true);assert.equal(e.action,'none');assert.ok(width>=44&&height>=44&&x>=24&&x+width<=l.width-24&&y>=0&&y+height<=l.height);assert.ok(e.ball.includes('radial-gradient'));}
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=evidence[i].bounds,b=evidence[j].bounds;assert.ok(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1]);}
 await diagramReadability(cdp,embedded);return evidence;
}
async function playbackReadability(cdp,base,label){
 const report=[];
 for(const [width,height,embedded] of [[320,500,false],[390,500,false],[390,600,false],[320,225,false],[320,225,true]]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:height>300});
  for(const kind of ['capture','reference']){
   await navigate(cdp,base,{fixture:kind==='capture'?durableDraft(P.fresh()):finishedData(filled()),embedded,fluid:embedded});
   if(kind==='reference')await click(cdp,'#referenceButton',embedded);
   for(let index=0;index<4;index++){
    await click(cdp,`[data-case="${index}"]`,embedded);await click(cdp,kind==='capture'?'#observeButton':'#playButton',embedded);
    const beginning=await diagramReadability(cdp,embedded);
    await settled(cdp,'return w.__motionComposition.getAnimation().stamps>=1;',embedded,'first moving exposure');
    const firstExposure=await diagramReadability(cdp,embedded);
    if(width===320&&height===225&&index===0)await screenshot(cdp,`${label}-short-${embedded?'iframe':'standalone'}-${kind}-readability`);
    await click(cdp,'#playButton',embedded);
    report.push({width,height,embedded,kind,index,beginning,firstExposure});
   }
  }
 }
 return report;
}
async function shortReferenceReadability(cdp,base,label){
 const report=[];
 for(const height of [225,250,275,300,301]){
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height,deviceScaleFactor:1,mobile:false});
 for(const embedded of [false,true])for(let index=0;index<4;index++)for(let time=1;time<=4;time++){
  const answer=filled();answer.activeCase=index;answer.activeTime=time;await navigate(cdp,base,{fixture:finishedData(answer),embedded,fluid:embedded});const before=JSON.stringify(await state(cdp,embedded));await click(cdp,'#referenceButton',embedded);
  const diagram=await diagramLabels(cdp,embedded);assert.equal(diagram.selected.case,index);assert.equal(diagram.selected.time,time);assert.equal(diagram.selected.reference,true);assert.equal(JSON.stringify(await state(cdp,embedded)),before);
  if(time===1&&(index===0||index===3))await screenshot(cdp,`${label}-short-${height}-${embedded?'iframe':'standalone'}-reference-${index}-t${time}`);
  report.push({height,embedded,index,time,diagram});
 }
 for(const embedded of [false,true])for(const points of [[[200,-200],[400,-400],[600,-600],[800,-800]],[[0,0],null,[3600,-3600],null],[[2400,0],[1600,0],[0,-2400],[0,-1600]]])for(let time=1;time<=4;time++){
  const answer=filled();answer.activeTime=time;answer.cases[0].points=points;await navigate(cdp,base,{fixture:durableDraft(answer),embedded,fluid:embedded});const before=JSON.stringify(await state(cdp,embedded)),diagram=await diagramLabels(cdp,embedded);assert.equal(diagram.selected.time,time);assert.equal(JSON.stringify(await state(cdp,embedded)),before);report.push({height,embedded,denseOrPartialOrWrong:true,time,diagram});
 }
 }
 return report;
}
async function observation(cdp,base,label){
 const report=[];
 for(const reduced of [false,true])for(const index of (reduced?[1]:[0,1,2,3])){
  await viewport(cdp,390,600);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
  const initial=P.fresh();initial.activeCase=index;await navigate(cdp,base,{fixture:durableDraft(initial)});
  await click(cdp,'#observeButton');const exposures=[];
  for(let count=0;count<=4;count++){
   for(let poll=0;poll<180;poll++){if(await call(cdp,`return w.__motionComposition.getAnimation().stamps===${count};`))break;await delay(25);}
   const e=await call(cdp,`const a=w.__motionComposition;return {animation:a.getAnimation(),state:a.getState(),geometry:a.getGeometry(),balls:[...d.querySelectorAll('#stageSvg [data-stamp]')].map(e=>({slot:Number(e.dataset.stamp),axis:Number(e.dataset.axis),center:[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))],fill:e.getAttribute('fill')})),live:[...d.querySelectorAll('#stageSvg [data-live-ball]')].map(e=>({axis:e.dataset.liveBall,center:[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))]})),trays:[...d.querySelectorAll('.point-tray-handle')].map(e=>e.hidden)};`);
   assert.equal(e.animation.stamps,count);assert.equal(e.balls.length,count*2);assert.equal(e.state.cases[index].observed,count===4);assert.deepEqual(e.state.cases[index].points,[null,null,null,null]);
   for(const ball of e.balls){const expected=M.expected(index)[ball.slot-1],projected=M.pixel(ball.axis?[0,expected[1]]:[expected[0],0],e.geometry);assert.deepEqual(ball.center,[projected.x,projected.y]);assert.match(ball.fill,/url\(#scene-[xy]-ball\)/);}
   if(count<4){assert.deepEqual(e.trays,[true,true,true,true]);assert.equal(e.live.length,2);const p=M.position(index,e.animation.time);for(const ball of e.live){const q=M.pixel(ball.axis==='x'?[p[0],0]:[0,p[1]],e.geometry);assert.deepEqual(ball.center,[q.x,q.y]);}if(reduced)assert.equal(e.animation.time,count*M.DT);}
   else e.targets=await trayTargets(cdp);
   e.readability=await diagramReadability(cdp);
   if(!reduced&&index===1&&[0,2,4].includes(count))await screenshot(cdp,`${label}-capture-${count}`);exposures.push(e);
  }
  report.push({index,reduced,exposures});
 }
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await navigate(cdp,base);await select(cdp,'horizontalMotion','uniform');const before=await state(cdp);await click(cdp,'#observeButton');await delay(950);
 assert.equal((await state(cdp)).cases[0].observed,false);assert.deepEqual(await state(cdp),before,'partial capture is transient');
 const resume=await call(cdp,'return w.__lmsValues;');await click(cdp,'[data-case="1"]');await delay(2600);assert.equal((await state(cdp)).cases.some(c=>c.observed),false,'cancelled capture cannot finish another case');
 await navigate(cdp,base,{fixture:resume});assert.deepEqual(await state(cdp),before);assert.equal(await call(cdp,"return d.querySelectorAll('#stageSvg [data-stamp]').length;"),0);await capture(cdp);await drawMouse(cdp,0,2);assert.deepEqual((await state(cdp)).cases[0].points[2],M.expected(0)[2]);
 return {exposures:report,interruptedResumeAndLegalContinuation:true};
}
async function visual(cdp,base,label){const report=[];for(const [width,height] of [[320,500],[390,500],[390,600],[390,844],[768,900],[1024,768],[1280,900],[740,360],[320,400],[640,450],[320,499],[390,501],[390,467]]){
 await viewport(cdp,width,height);await navigate(cdp,base,{fixture:durableDraft(filled())});
 const m=await call(cdp,"const p=d.getElementById('controlPanel'),s=d.getElementById('stage');return {overflow:d.documentElement.scrollWidth-w.innerWidth,range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.clientHeight,stage:s.clientHeight,font:[...d.querySelectorAll('#stageSvg text')].map(e=>Number(w.getComputedStyle(e).fontSize.replace('px','')))};");assert.ok(m.overflow<=1&&m.range<=1,`${label} ${width}x${height}: bounded ${JSON.stringify(m)}`);assert.ok(m.panel>=65);assert.ok(m.stage>=150);assert.ok(m.font.every(size=>size>=11));
 m.diagrams=[];for(let index=0;index<4;index++){await click(cdp,`[data-case="${index}"]`);assert.equal((await state(cdp)).activeCase,index);for(let slot=1;slot<=4;slot++){await click(cdp,`[data-time="${slot}"]`);const diagram=await diagramLabels(cdp);assert.equal(diagram.selected.case,index);assert.equal(diagram.selected.time,slot);m.diagrams.push(diagram);if(slot===1){if((width===390&&height===600)||width===1280)await screenshot(cdp,`${label}-${width}-case-${index}`);if(height===500&&index===0)await screenshot(cdp,`${label}-${width}x${height}-parking`);}}await click(cdp,'[data-time="1"]');}
 assert.equal(await call(cdp,"return [...d.querySelectorAll('#questionNav button,#timeNav button')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;});"),true);
 await click(cdp,'#checkButton');await click(cdp,'#submitButton');assert.equal(await mode(cdp),'review');assert.equal(await call(cdp,"return d.getElementById('clearCaseButton').getClientRects().length;"),0);
 await assert.rejects(()=>rect(cdp,'[data-time="2"]'),/Hidden target/,'review time buttons cannot be clicked');
 for(let index=0;index<4;index++)for(let slot=1;slot<=4;slot++){
  const answer=filled();answer.activeCase=index;answer.activeTime=slot;await navigate(cdp,base,{fixture:finishedData(answer)});assert.equal(await mode(cdp),'review');const before=JSON.stringify(await state(cdp));
  await click(cdp,'#referenceButton');const diagram=await diagramLabels(cdp);assert.equal(diagram.selected.reference,true);assert.equal(diagram.selected.case,index);assert.equal(diagram.selected.time,slot);assert.equal(JSON.stringify(await state(cdp)),before,'reference view leaves submitted answers unchanged');m.diagrams.push(diagram);
  if(width===390&&height===600&&index>=2&&slot===4)await screenshot(cdp,`${label}-${width}-reference-${index}`);
 }
 report.push({width,height,...m});
 }
 await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});assert.equal(await call(cdp,'return w.visualViewport.scale;'),2);await screenshot(cdp,`${label}-zoom-200`);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});return report;
}
async function flows(cdp,base,label){
 await viewport(cdp,1280,900);await navigate(cdp,base,{fixture:false});
 for(let index=0;index<4;index++){await click(cdp,`[data-case="${index}"]`);await capture(cdp);for(const slot of [2,0,3,1]){await drawMouse(cdp,index,slot,false,true);assert.deepEqual((await state(cdp)).cases[index].points[slot],M.expected(index)[slot]);}await select(cdp,'horizontalMotion',M.CASES[index].motions[0]);await select(cdp,'verticalMotion',M.CASES[index].motions[1]);await select(cdp,'trajectorySelect',M.CASES[index].trajectory);}
 assert.equal(S.score(await state(cdp)).score,100);await click(cdp,'#checkButton');assert.equal(await mode(cdp),'check');await click(cdp,'#checkList button');assert.equal((await state(cdp)).returnToCheck,true);await click(cdp,'#returnCheckButton');await click(cdp,'#submitButton');assert.equal(await mode(cdp),'review');assert.equal((await call(cdp,'return w.__motionComposition.getResult();')).score,100);await click(cdp,'#referenceButton');await screenshot(cdp,`${label}-review`);
 for(const s of [P.fresh(),(()=>{const s=P.fresh();s.cases[0].motions[0]='uniform';return s;})()]){
  await navigate(cdp,base,{fixture:durableDraft(s)});await click(cdp,'#checkButton');await click(cdp,'#submitButton');assert.equal((await call(cdp,'return w.__motionComposition.getResult();')).score,S.score(s).score);
  assert.equal(await call(cdp,"return d.getElementById('stageHint').textContent;"),'你的作圖');assert.equal(await call(cdp,"return [...d.querySelectorAll('.point-tray-handle')].every(e=>e.hidden)&&!d.getElementById('animationStatus').textContent.includes('拖入');"),true);const answer=JSON.stringify(await state(cdp));
  await click(cdp,'#referenceButton');assert.equal(await call(cdp,"return d.getElementById('stageHint').textContent;"),'參考軌跡');assert.equal(JSON.stringify(await state(cdp)),answer);
  assert.equal(await call(cdp,"return d.querySelectorAll('#stageSvg circle[stroke=\"#2563eb\"],#stageSvg circle[stroke=\"#b45309\"]').length;"),8);
  await click(cdp,'#referenceButton');await click(cdp,'[data-case="1"]');assert.equal(await call(cdp,"return d.getElementById('stageHint').textContent;"),'你的作圖');
 }
 for(const lock of ['frozen','committed']){
  await navigate(cdp,base,{fixture:durableDraft(P.fresh())});await click(cdp,'#checkButton');await call(cdp,lock==='frozen'?'w.__failFinal=true;':'w.__failFinish=true;');await click(cdp,'#submitButton');assert.equal(await mode(cdp),lock);
  assert.equal(await call(cdp,"return d.getElementById('stageHint').textContent;"),lock==='frozen'?'作答已凍結':'你的作圖');
 }
 const malformed=durableDraft(P.fresh()),snapshot=JSON.parse(malformed['cmi.suspend_data']);snapshot.answer.cases[0].motions[0]=['uniform'];snapshot.answer.cases[0].trajectory=['line'];malformed['cmi.suspend_data']=JSON.stringify(snapshot);
 await navigate(cdp,base,{fixture:malformed});assert.equal(await mode(cdp),'technical');assert.deepEqual(await call(cdp,'return w.__lmsValues;'),malformed);
 await navigate(cdp,base,{fixture:finishedData(filled())});assert.equal(await mode(cdp),'review');const locked=JSON.stringify(await state(cdp));await click(cdp,'[data-case="2"]');assert.equal(JSON.stringify(await state(cdp)),locked);
 await navigate(cdp,base,{fixture:durableDraft(filled())});await click(cdp,'#checkButton');await call(cdp,'w.__failFinal=true;');await click(cdp,'#submitButton');assert.equal(await mode(cdp),'frozen');assert.equal(await call(cdp,'return w.__motionComposition.getResult();'),null);const pending=await call(cdp,'return w.__lmsValues;');await navigate(cdp,base,{fixture:pending});assert.equal(await mode(cdp),'frozen');await click(cdp,'#retryFinalButton');assert.equal(await mode(cdp),'review');
 for(const phase of ['edit','check','review']){await navigate(cdp,base,{fixture:false,denyStorage:true});await capture(cdp);await drawMouse(cdp,0,0);if(phase!=='edit')await click(cdp,'#checkButton');if(phase==='review')await click(cdp,'#submitButton');await cdp.send('Page.reload');await ready(cdp);assert.deepEqual(await state(cdp),P.fresh());assert.equal(await call(cdp,'return w.__storageProbes;'),0);}
 await navigate(cdp,base,{fixture:false});await select(cdp,'horizontalMotion','uniform');assert.equal(S.score(await state(cdp)).score,3);await capture(cdp);await call(cdp,"d.getElementById('trayHandle1').focus();");for(let i=0;i<4;i++)await key(cdp,'ArrowRight');for(let i=0;i<4;i++)await key(cdp,'ArrowDown');assert.equal((await state(cdp)).cases[0].points[0],null);await key(cdp,'Enter');assert.deepEqual((await state(cdp)).cases[0].points[0],[800,-800]);await key(cdp,'ArrowRight',8);await key(cdp,'Escape');assert.deepEqual((await state(cdp)).cases[0].points[0],[800,-800]);
 await navigate(cdp,base,{fixture:durableDraft(filled())});const keyboardExpected=await state(cdp);
 await call(cdp,"d.getElementById('trayHandle3').focus();");await key(cdp,'ArrowLeft');assert.equal((await state(cdp)).activeTime,3);assert.deepEqual((await state(cdp)).cases,keyboardExpected.cases,'keyboard selection does not grade an unfinished adjustment');
 await click(cdp,'#removePointButton');keyboardExpected.cases[0].points[2]=null;assert.deepEqual((await state(cdp)).cases,keyboardExpected.cases,'focus change and remove operate on the chosen ball');
 await call(cdp,"d.getElementById('trayHandle4').focus();");await key(cdp,'ArrowLeft');assert.equal((await state(cdp)).activeTime,4);await key(cdp,'Escape');assert.deepEqual((await state(cdp)).cases,keyboardExpected.cases);await click(cdp,'[data-case="1"]');assert.equal((await state(cdp)).activeCase,1);
 await click(cdp,'[data-case="0"]');await call(cdp,"d.getElementById('trayHandle2').focus();");await key(cdp,'ArrowLeft');await key(cdp,'Enter');keyboardExpected.cases[0].points[1]=[1400,-1600];assert.deepEqual((await state(cdp)).cases,keyboardExpected.cases,'noncurrent tray keyboard commit updates only that slot');
 await click(cdp,'[data-case="1"]');await capture(cdp);await call(cdp,"d.getElementById('spacingDetails').open=true;");await click(cdp,'[data-compare-axis="1"]');await click(cdp,'#showIncreases');const comparison=await call(cdp,"return d.getElementById('spacingBars').textContent;");assert.match(comparison,/0.20 m/);assert.match(comparison,/1.40 m/);assert.equal((comparison.match(/0.40 m/g)||[]).length,3);await screenshot(cdp,`${label}-comparison`);
 const beforeResize=JSON.stringify(await state(cdp));await click(cdp,'#playButton');await settled(cdp,"return d.getElementById('playButton').textContent==='停止播放';");await viewport(cdp,1280,899);await settled(cdp,"return d.getElementById('playButton').textContent==='重播分運動';");assert.equal(await call(cdp,"return d.getElementById('stageTime').textContent;"),'t1 = 0.20 s');assert.equal(JSON.stringify(await state(cdp)),beforeResize);
 await click(cdp,'#playButton');await settled(cdp,"return d.getElementById('playButton').textContent==='停止播放';");await click(cdp,'#playButton');
 return {mouseScore:100,directOutOfOrderMouse:true,blankAndPartial:true,reviewResume:true,pendingRetry:true,standaloneRefresh:true,keyboard:true,noncurrentKeyboardAndPanelCommands:true,comparison:true,readOnlyHints:true,malformedEnums:true,playbackResizeAndReplay:true};
}
async function zoomReflow(cdp,base,label){
 const report=[];
 for(const embedded of [false,true]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:225,deviceScaleFactor:2,mobile:false});
  await navigate(cdp,base,{fixture:durableDraft(filled()),embedded,fluid:embedded});
  const geometry=await call(cdp,"const p=d.getElementById('controlPanel'),s=d.getElementById('stage'),r=p.getBoundingClientRect();return {viewport:[w.innerWidth,w.innerHeight],panel:[r.x,r.y,r.width,r.height],panelOverflow:p.scrollWidth-p.clientWidth,docRange:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,docOverflow:d.documentElement.scrollWidth-w.innerWidth,stage:s.getBoundingClientRect().toJSON(),geometry:w.__motionComposition.getGeometry()};",embedded);
  assert.equal(geometry.docRange,0);assert.equal(geometry.docOverflow,0);assert.ok(geometry.panelOverflow<=1);assert.ok(geometry.panel[1]>=0&&geometry.panel[1]+geometry.panel[3]<=225.1&&geometry.panel[3]>=65);
  await click(cdp,'#checkButton',embedded);await rect(cdp,'#submitButton',embedded,true);
  const bounds=await call(cdp,"const r=d.getElementById('submitButton').getBoundingClientRect(),p=d.getElementById('controlPanel').getBoundingClientRect();return {button:r.toJSON(),panel:p.toJSON(),viewport:[w.innerWidth,w.innerHeight],font:w.getComputedStyle(d.getElementById('submitButton')).fontSize};",embedded);
  assert.ok(bounds.button.top>=bounds.panel.top&&bounds.button.bottom<=bounds.panel.bottom&&bounds.button.bottom<=225);assert.ok(bounds.button.height>=44);assert.ok(Number.parseFloat(bounds.font)>=16);
  await screenshot(cdp,`${label}-zoom-reflow-${embedded?'iframe':'standalone'}-check`);await click(cdp,'#submitButton',embedded);assert.equal(await mode(cdp,embedded),'review');await click(cdp,'#referenceButton',embedded);assert.equal((await call(cdp,'return w.__motionComposition.getSelection();',embedded)).reference,true);
  await screenshot(cdp,`${label}-zoom-reflow-${embedded?'iframe':'standalone'}-review`);report.push({embedded,geometry,submitBounds:bounds,submitted:true,reference:true});
 }
 return report;
}
async function shortTouch(cdp,base,label){
 const report=[];
 for(const embedded of [false,true]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:225,deviceScaleFactor:2,mobile:false});
  async function gesture(kind,end,index,slot){
   const row={kind,before:await metrics(cdp,embedded)},start=await rect(cdp,kind==='tray'?traySelector(slot):'#activeHandle',embedded);
   await dragTouch(cdp,start,end,async()=>{row.preview=await previewEvidence(cdp,end,embedded);row.during=await metrics(cdp,embedded);fixed(row.before,row.during,'preview',`${label} short ${kind}/${index}/${slot}`,slot+1);assert.equal(row.preview.insideStage,false,'short stage uses an unobstructed shell corner');});
   row.after=await metrics(cdp,embedded);fixed(row.before,row.after,'drag',`${label} short release ${kind}/${index}/${slot}`,slot+1);
   const before=JSON.parse(row.before.answer),after=JSON.parse(row.after.answer);before.activeTime=slot+1;before.cases[index].points[slot]=row.preview.point;assert.deepEqual(after,before,'only the selected saved point changes');
   assert.ok(row.after.pointer.trustedTouch>row.before.pointer.trustedTouch&&row.after.pointer.moves>row.before.pointer.moves&&row.after.pointer.ups>row.before.pointer.ups);assert.equal(row.after.pointer.cancels,row.before.pointer.cancels);
   assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",embedded),true);return row;
  }
  for(let index=0;index<4;index++)for(let slot=0;slot<4;slot++){
   const s=P.fresh();s.activeCase=index;s.cases[index].observed=slot!==0;await navigate(cdp,base,{fixture:slot===0?false:durableDraft(s),embedded,fluid:embedded});if(slot===0){await click(cdp,`[data-case="${index}"]`,embedded);await capture(cdp,embedded);}await trayTargets(cdp,embedded);
   const tray=await gesture('tray',await target(cdp,index,slot,embedded),index,slot);assert.deepEqual(tray.preview.point,M.expected(index)[slot]);tray.diagram=await diagramLabels(cdp,embedded);
   assert.equal(await call(cdp,"return d.getElementById('activeHandle').hidden;",embedded),false);const destination=await target(cdp,index,slot,embedded),active=await gesture('reposition',{x:destination.x+3,y:destination.y+3},index,slot);
   if(slot===0){const before=await metrics(cdp,embedded);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(await rect(cdp,traySelector(slot),embedded))]});const end=await target(cdp,index,slot,embedded);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint(end)]});await previewEvidence(cdp,end,embedded);await screenshot(cdp,`${label}-short-${embedded?'iframe':'standalone'}-preview-${index}`);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settled(cdp,"return d.getElementById('magnifier').hidden;",embedded,'short preview cancellation');const after=await metrics(cdp,embedded);fixed(before,after,'cancel',`${label} short cancellation ${index}`);active.cancellation={before,after};}
   report.push({embedded,index,slot,tray,active});
  }
  await navigate(cdp,base,{fixture:false,embedded,fluid:embedded});await capture(cdp,embedded);
  for(const [kind,point] of [['tray',[2400,0]],['active',[1600,0]]]){
   const l=await call(cdp,'return w.__motionComposition.getGeometry();',embedded),end=await stagePoint(cdp,M.pixel(point,l),embedded),row=await gesture(kind,end,0,0);assert.deepEqual(row.preview.point,point,'public wrong grid points remain valid');row.diagram=await diagramLabels(cdp,embedded);report.push({embedded,wrongGrid:true,...row});
  }
 }
 return report;
}
async function touch(cdp,base,label,width,fresh){
 await viewport(cdp,width,500);const report=[];
 for(let index=0;index<4;index++)for(let slot=0;slot<4;slot++){
  const s=P.fresh();s.activeCase=index;s.activeTime=1;s.cases[index].observed=true;await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});await delay(100);
  const tray={before:await metrics(cdp,true)},start=await rect(cdp,traySelector(slot),true),end=await target(cdp,index,slot,true);
  await dragTouch(cdp,start,end,async()=>{tray.preview=await previewEvidence(cdp,end,true);tray.during=await metrics(cdp,true);fixed(tray.before,tray.during,'preview',`${label} tray preview ${width}/${index}/${slot}`,slot+1);if(slot===0)await screenshot(cdp,`${label}-${width}-preview-${index}`);});
  tray.after=await metrics(cdp,true);fixed(tray.before,tray.after,'drag',`${label} tray ${width}/${index}/${slot}`,slot+1);assert.ok(tray.after.pointer.trustedTouch>tray.before.pointer.trustedTouch);assert.equal(tray.after.pointer.cancels,tray.before.pointer.cancels);
  assert.deepEqual((await state(cdp,true)).cases[index].points[slot],M.expected(index)[slot]);assert.deepEqual((await state(cdp,true)).cases[index].points[slot],tray.preview.point);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);
  const active={before:await metrics(cdp,true)},head=await rect(cdp,'#activeHandle',true),destination={x:head.x+5,y:head.y+5};
  await dragTouch(cdp,head,destination,async()=>{active.preview=await previewEvidence(cdp,destination,true);active.during=await metrics(cdp,true);fixed(active.before,active.during,'preview',`${label} active preview ${width}/${index}/${slot}`);});
  active.after=await metrics(cdp,true);fixed(active.before,active.after,'drag',`${label} active ${width}/${index}/${slot}`);assert.equal(active.after.pointer.cancels,active.before.pointer.cancels);assert.ok(active.after.pointer.trustedTouch>active.before.pointer.trustedTouch);
  assert.deepEqual((await state(cdp,true)).cases[index].points[slot],active.preview.point);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);
  for(const gesture of [tray,active]){const expected=JSON.parse(gesture.before.answer),actual=JSON.parse(gesture.after.answer);expected.activeTime=slot+1;expected.cases[index].points[slot]=actual.cases[index].points[slot];assert.deepEqual(actual,expected);assert.ok(gesture.after.pointer.moves>gesture.before.pointer.moves&&gesture.after.pointer.ups>gesture.before.pointer.ups);}
  report.push({index,slot,tray,active});
 }
 // A cancelled simulation gesture keeps its owner until every finger lifts.
 for(const kind of ['tray','active'])for(const entrance of ['background','left','right','target']){
  cdp=await fresh();await viewport(cdp,width,500);
  const initial=filled();if(kind==='tray')initial.cases[0].points[0]=null;
  await navigate(cdp,base,{fixture:durableDraft(initial),embedded:true});
  const before=await metrics(cdp,true),selector=kind==='tray'?'#trayHandle1':'#activeHandle',start=await rect(cdp,selector,true),end=await target(cdp,0,1,true);
  await call(cdp,`w.__inputProbe=[];d.addEventListener('pointerdown',e=>w.__inputProbe.push({type:e.pointerType,primary:e.isPrimary,button:e.button,target:e.target.id}),true);const r=d.querySelector('${selector}').getBoundingClientRect();w.__hitProbe={kind:'${kind}',entrance:'${entrance}',hit:d.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id,local:[r.x+r.width/2,r.y+r.height/2],global:[${start.x},${start.y}],viewport:[w.visualViewport.width,w.visualViewport.height,w.visualViewport.scale],hostScale:w.parent.visualViewport.scale};`,true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(start)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint(end)]});await previewEvidence(cdp,end,true);const during=await metrics(cdp,true);fixed(before,during,'preview',`${label} multi-touch working ${kind}/${entrance}`);
  const r=await rect(cdp,entrance==='target'?selector:entrance==='background'?'#stage':`.scroll-strip.${entrance}`,true),secondary=entrance==='background'?await stagePoint(cdp,M.pixel([2800,200],await call(cdp,'return w.__motionComposition.getGeometry();',true)),true):entrance==='target'?{x:r.x,y:r.y}:{x:r.x,y:r.y-30};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(end),touchPoint(secondary,2)]});
  await settled(cdp,"const i=w.__motionComposition.getInteraction();return !i.point&&i.blockedTouchSequence&&d.getElementById('magnifier').hidden;",true,'multi-touch cancellation');
  for(let step=1;step<=5;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint(end),touchPoint({x:secondary.x,y:secondary.y-step*7},2)]});await delay(40);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(350);
  const after=await metrics(cdp,true);fixed(before,after,'cancel',`${label} multi-touch ${width}/${kind}/${entrance}`);assert.ok(after.pointer.cancels>before.pointer.cancels);assert.equal(await call(cdp,'return w.__motionComposition.getInteraction().blockedTouchSequence;',true),false);
  const panBefore=await metrics(cdp,true),strip=await rect(cdp,'.scroll-strip.right',true),panStart={x:strip.x,y:strip.y-20};await dragTouch(cdp,panStart,{x:panStart.x,y:panStart.y-35});const panAfter=await metrics(cdp,true);fixed(panBefore,panAfter,'host',`${label} post-cancel host pan ${kind}/${entrance}`);assert.ok(Math.abs(panAfter.host.y-panBefore.host.y)>5);
  report.push({interruption:'multi-touch',kind,entrance,before,during,after,recoveryPan:{before:panBefore,after:panAfter}});
 }
 // Each scroll entrance is exercised independently in both directions.
 cdp=await fresh();await viewport(cdp,width,500);const s=filled();await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});
 for(const [entrance,selector] of [['left','.scroll-strip.left'],['right','.scroll-strip.right'],['background','#stage']])for(const direction of [-1,1]){
  await evaluate(cdp,'scrollTo(0,300)');await delay(100);const r=await rect(cdp,selector,true),start=entrance==='background'?await stagePoint(cdp,M.pixel([2800,200],await call(cdp,'return w.__motionComposition.getGeometry();',true)),true):{x:r.x,y:r.y-20};const before=await metrics(cdp,true);await dragTouch(cdp,start,{x:start.x,y:start.y+direction*45});const after=await metrics(cdp,true);fixed(before,after,'host',`${label} ${entrance}/${direction}`);assert.ok(Math.abs(after.host.y-before.host.y)>5);assert.equal(after.host.frame[1]-before.host.frame[1],before.host.y-after.host.y);report.push({entrance,direction,before,after});
 }
 await evaluate(cdp,'scrollTo(0,300)');await call(cdp,"d.getElementById('controlPanel').scrollTop=80;",true);await delay(100);
 for(const position of ['middle','top','bottom'])for(const direction of [-1,1]){
  await call(cdp,`const p=d.getElementById('controlPanel');p.scrollTop=${position==='top'?'0':position==='bottom'?'p.scrollHeight-p.clientHeight':'Math.min(120,p.scrollHeight-p.clientHeight-40)'};`,true);await delay(100);const r=await rect(cdp,'#controlPanel',true),start={x:r.x+40,y:r.y},before=await metrics(cdp,true);await dragTouch(cdp,start,{x:start.x,y:start.y+direction*45});const after=await metrics(cdp,true);fixed(before,after,'panel',`${label} panel ${position}/${direction}`);if(position==='middle')assert.notEqual(after.panel,before.panel);report.push({entrance:'panel',position,direction,before,after});
 }
 // Each interruption exercises the production rollback, then a legal continuation.
 for(const interruption of ['cancel','lost-capture','resize','outside']){
  cdp=await fresh();await viewport(cdp,width,500);
  await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});const before=await metrics(cdp,true),head=await rect(cdp,'#activeHandle',true),end=await target(cdp,0,1,true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(head)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint(end)]});const preview=await previewEvidence(cdp,end,true);let resized=null;
  if(interruption==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  else {
   if(interruption==='lost-capture'){await call(cdp,"const e=d.getElementById('activeHandle'),id=w.__motionComposition.getInteraction().pointerId;if(!e.hasPointerCapture(id))throw new Error('Missing capture');e.releasePointerCapture(id);",true);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:end.x+2,y:end.y+2})]});await settled(cdp,'return !w.__motionComposition.getInteraction().point;',true,'lost capture rollback');}
   if(interruption==='resize'){await viewport(cdp,width===390?320:390,500);await settled(cdp,'return !w.__motionComposition.getInteraction().point;',true,'resize rollback');resized=await metrics(cdp,true);assert.equal(resized.answer,before.answer);}
   if(interruption==='outside'){const l=await call(cdp,'return w.__motionComposition.getGeometry();',true),outside=await stagePoint(cdp,{x:l.left+l.size+10,y:l.top+l.size/2},true);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint(outside)]});await settled(cdp,'return !w.__motionComposition.getInteraction().point;',true,'outside preview cleanup');}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await delay(150);if(resized){await viewport(cdp,width,500);await delay(100);}
  const after=await metrics(cdp,true);fixed(before,after,'cancel',`${label} ${interruption}/${width}`);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);report.push({interruption,before,after,preview,resized});
 }
 for(const lock of ['review','frozen','committed']){await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});await click(cdp,'#checkButton',true);if(lock==='frozen')await call(cdp,'w.__failFinal=true;',true);if(lock==='committed')await call(cdp,'w.__failFinish=true;',true);await click(cdp,'#submitButton',true);assert.equal(await mode(cdp,true),lock);const before=await metrics(cdp,true),p=await target(cdp,0,0,true);await dragTouch(cdp,p,{x:p.x,y:p.y+40});const after=await metrics(cdp,true);fixed(before,after,'host',`${label} lock ${lock}`);assert.ok(Math.abs(after.host.y-before.host.y)>5);report.push({lock,before,after});}
 return report;
}
async function main(){
 fs.mkdirSync(artifactDir,{recursive:true});sourceParity();const tempRoot=fs.realpathSync(os.tmpdir()),servers=[];let profile,packageDirectory,chrome,cdp,targetId,failure;
 const report={activity:slug,engine:'Chrome/CDP trusted touch',viewports:{},observations:{},playbackReadability:{},shortReferenceReadability:{},flows:{},zoomReflow:{},shortGestures:{},gestures:{},errors:[]};
 try{
  const browser=findBrowser();assert.ok(browser,'Chrome required');const extracted=buildAndExtractPackage(tempRoot,{slug,packagePrefix:'simlab-motion-package-',packageNamePattern:/^simlab-motion-package-[A-Za-z0-9]+$/});packageDirectory=extracted.packageDirectory;
  for(const name of sourceParity().concat(`${slug}/index.html`))assert.equal(fs.readFileSync(path.join(root,'sim',name),'utf8'),fs.readFileSync(path.join(packageDirectory,name),'utf8'));
  profile=fs.mkdtempSync(path.join(tempRoot,'simlab-motion-chrome-'));chrome=spawn(browser,['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';chrome.stderr.on('data',b=>stderr=(stderr+b).slice(-3000));const port=await devToolsPort(profile,chrome).catch(e=>{e.message+=stderr;throw e;});
  async function fresh(){if(cdp){await cdp.send('Target.closeTarget',{targetId});cdp.close();}const {body:t}=await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});targetId=t.id;cdp=new CdpClient(t.webSocketDebuggerUrl,WebSocket,15000);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');await preload(cdp);cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));return cdp;}
  await fresh();report.browser=await cdp.send('Browser.getVersion');
  for(const [label,directory] of [['source',path.join(root,'sim')],['package',packageDirectory]]){const server=createServer(directory);servers.push(server);await listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;await fresh();console.log(`motion composition: ${label} layout/flows`);report.viewports[label]=await visual(cdp,base,label);report.observations[label]=await observation(cdp,base,label);report.playbackReadability[label]=await playbackReadability(cdp,base,label);report.flows[label]=await flows(cdp,base,label);report.zoomReflow[label]=await zoomReflow(cdp,base,label);report.shortReferenceReadability[label]=await shortReferenceReadability(cdp,base,label);console.log(`motion composition: ${label} short trusted touch`);report.shortGestures[label]=await shortTouch(cdp,base,label);if(!process.argv.includes('--smoke'))for(const width of [390,320]){await fresh();console.log(`motion composition: ${label} trusted touch ${width}`);report.gestures[`${label}-${width}`]=await touch(cdp,base,label,width,fresh);}}
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(artifactDir,process.argv.includes('--smoke')?'smoke-report.json':'report.json'),JSON.stringify(report,null,2));
 }catch(e){failure=e;if(cdp){report.failureUI=await evaluate(cdp,"(()=>{const w=document.getElementById('activity')?.contentWindow||window;return {text:w.document.body.innerText,mode:w.__motionComposition?.getMode(),state:w.__motionComposition?.getState()};})()").catch(()=>null);await screenshot(cdp,'failure').catch(()=>{});}fs.writeFileSync(path.join(artifactDir,'failure.json'),JSON.stringify({message:e.stack,report},null,2));}
 try{if(chrome)await stopChrome(chrome,cdp);cdp?.close();for(const server of servers)await closeServer(server);for(const dir of [profile,packageDirectory].filter(Boolean)){validateOwnedDirectory(dir,tempRoot,/^simlab-motion-(?:chrome|package)-[A-Za-z0-9]+$/,'motion test artifact');fs.rmSync(dir,{recursive:true,force:false});}}catch(e){failure ||=e;}
 if(failure)throw failure;console.log('motion composition source/package browser checks passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={sourceParity,main};
