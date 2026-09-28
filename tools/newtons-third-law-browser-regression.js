#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const { CdpClient, buildAndExtractPackage, createServer, listenServer, devToolsPort, fetchJson, evaluate, delay, findBrowser, stopChrome, closeServer, validateOwnedDirectory } = require("./position-time-browser-regression.js");
const M = require("../sim/newtons-third-law-reaction-force-lab/model.js"), G = require("../sim/newtons-third-law-reaction-force-lab/generator.js"), P = require("../sim/newtons-third-law-reaction-force-lab/persistence.js"), S = require("../sim/newtons-third-law-reaction-force-lab/scoring.js");
const root = path.resolve(__dirname, ".."), slug = P.ACTIVITY, artifactDir = path.join(root, "output/playwright/newtons-third-law");
function sourceParity() {
  const html = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => path.posix.normalize(`${slug}/${m[1]}`)).sort();
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(fs.readFileSync(path.join(root, "sim/manifests", `${slug}.xml`), "utf8"));
  const declared = parsed.manifest.resources.resource.file.map(f => f["@_href"]).filter(f => f !== "config.js" && f !== `${slug}/index.html`).sort();
  assert.deepEqual(refs, declared, "all runtime dependencies declared exactly once"); return refs;
}
const call = (cdp, code, embedded = false) => evaluate(cdp, `((w,d)=>{${code}})(${embedded ? 'document.getElementById("activity").contentWindow,document.getElementById("activity").contentDocument' : "window,document"})`);
async function ready(cdp, embedded = false) {
  for (let i = 0; i < 150; i++) {
    try { if (await call(cdp, "return d.readyState==='complete' && Boolean(w.__reactionApp);", embedded)) return; } catch (_) {}
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
  const params = new URLSearchParams({ __seed: String(options.seed ?? 21) });
  if (options.fixture !== false) params.set("__fixture", JSON.stringify(options.fixture || { "cmi.core.lesson_status": "not attempted" }));
  if(options.denyStorage) params.set("__denyStorage","1");
  const src = `/${slug}/index.html?${params}`;
  const url = options.embedded ? `${base}/__embed-scroll-test.html?src=${encodeURIComponent(src)}${options.fluid ? "&fluid=1" : ""}` : `${base}${src}`;
  await cdp.send("Page.navigate", { url }); await delay(100); await ready(cdp, options.embedded);
  if (options.embedded) { await evaluate(cdp, "scrollTo(0,300)"); await delay(70); }
}
async function rect(cdp, selector, embedded = false, scroll = false) {
  const r = await call(cdp, `const e=d.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing ${selector}');${scroll ? "e.scrollIntoView({block:'nearest'});" : ""}const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};`, embedded);
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
async function confirmClick(cdp, selector, accept, touch = false) {
  const dialog = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error("Missing clear-all confirmation")); }, 10000);
    const remove = cdp.on("Page.javascriptDialogOpening", ({ message }) => {
      clearTimeout(timer); remove();
      cdp.send("Page.handleJavaScriptDialog", { accept }).then(() => resolve(message), reject);
    });
  });
  const press = async () => {
    if (!touch) return click(cdp, selector);
    const p = await rect(cdp, selector, false, true);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(p)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const [message] = await Promise.all([dialog, press()]); assert.match(message, /五題的全部答案/); await delay(50);
}
const touchPoint = (p, id = 1) => ({ x: p.x, y: p.y, id, radiusX: 2, radiusY: 2, force: 1 });
async function dragTouch(cdp, start, end, during = null, afterMove = null) {
  const dispatch = async (type, touchPoints) => {
    try { await cdp.send("Input.dispatchTouchEvent", { type, touchPoints }); }
    catch (error) { error.message += ` (${type}, ${JSON.stringify(touchPoints)})`; throw error; }
  };
  await dispatch("touchStart", [touchPoint(start)]);
  for (let step = 1; step <= 12; step++) {
    await dispatch("touchMove", [touchPoint({ x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12 })]); await delay(12);
    if (afterMove) await afterMove();
  }
  if (during) await during();
  await dispatch("touchEnd", []); await delay(180);
}
async function metrics(cdp, embedded = false) {
  const local = await call(cdp, `const app=w.__reactionApp,p=d.getElementById('controlPanel'),s=d.getElementById('stage'),r=s.getBoundingClientRect(),v=w.visualViewport;return {docX:w.scrollX,docY:w.scrollY,docRange:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.scrollTop,panelRange:p.scrollHeight-p.clientHeight,stage:[r.left,r.top,r.width,r.height],view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],answer:JSON.stringify(app.getState()),pointer:app.getPointerDiagnostics(),mode:app.getMode()};`, embedded);
  const host = await evaluate(cdp, `(()=>{const r=${embedded ? "document.getElementById('activity').getBoundingClientRect()" : "null"},v=visualViewport;return {x:scrollX,y:scrollY,view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],frame:r?[r.left,r.top,r.width,r.height]:null};})()`);
  return { ...local, host };
}
function fixed(before, after, owner, label) {
  assert.equal(after.docX, before.docX, `${label}: document x`); assert.equal(after.docY, before.docY, `${label}: document y`);
  assert.ok(after.docRange <= 1, `${label}: no third scroll owner`);
  assert.deepEqual(after.view, before.view, `${label}: activity visual viewport`);
  assert.deepEqual(after.stage, before.stage, `${label}: local stage`);
  if (owner !== "panel") assert.equal(after.panel, before.panel, `${label}: panel fixed`);
  if (owner !== "host") assert.deepEqual(after.host, before.host, `${label}: host and iframe fixed`);
  if (owner !== "drawing") assert.equal(after.answer, before.answer, `${label}: answer fixed`);
}
async function screenshot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(artifactDir, `${name}.png`), Buffer.from(data, "base64"));
}
const {environment,filled,durableDraft,finishedData}=require("../sim/newtons-third-law-reaction-force-lab/test-support.js");
const state=(cdp,embedded=false)=>call(cdp,"return w.__reactionApp.getState();",embedded);
async function stagePoint(cdp,p,embedded=false){const r=await call(cdp,"const r=d.getElementById('stage').getBoundingClientRect();return {x:r.left,y:r.top};",embedded);if(embedded){const frame=await evaluate(cdp,"(()=>{const r=document.getElementById('activity').getBoundingClientRect();return {x:r.left,y:r.top};})()");r.x+=frame.x;r.y+=frame.y;}return {x:r.x+p.x,y:r.y+p.y};}
async function snapshot(cdp,base,s,options={}){await navigate(cdp,base,{...options,fixture:durableDraft(s)});await delay(120);}
async function select(cdp,selector,value,embedded=false){await call(cdp,`const e=d.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new w.Event('change',{bubbles:true}));`,embedded);}
async function draw(cdp,force,embedded=false,touch=false,during=null){
  const start=await rect(cdp,'.anchor-hit:not([hidden])',embedded);
  const q=await call(cdp,"return w.__reactionApp.getQuestion();",embedded),l=await call(cdp,"return w.__reactionApp.getGeometry();",embedded);
  const local=M.endpoint(force,q,l),end=await stagePoint(cdp,local,embedded);
  if(touch)await dragTouch(cdp,start,end,during);else{await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:end.x,y:end.y,button:'left',buttons:1});if(during)await during();await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',clickCount:1});await delay(80);}
}
async function visualMatrix(cdp,base,label){
 const results=[];
 for(const [width,height] of [[320,500],[390,500],[390,600],[390,844],[768,900],[1024,768],[1280,900],[740,360],[320,400]]){
  await viewport(cdp,width,height);await navigate(cdp,base);
  const r=await call(cdp,"const p=d.getElementById('controlPanel'),s=d.getElementById('stage');return {overflow:d.documentElement.scrollWidth-w.innerWidth,range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.clientHeight,stage:s.clientHeight};");
  assert.ok(r.overflow<=1&&r.range<=1,`${label} ${width}x${height} bounded document ${JSON.stringify(r)}`);assert.ok(r.panel>=65);assert.ok(r.stage>=195);
  for(let family=0;family<5;family++){
   await click(cdp,`[data-question="${family}"]`);assert.equal((await state(cdp)).question,family);
   const bounds=await call(cdp,"return [...d.querySelectorAll('#questionNav button')].map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height];});");assert.ok(bounds.every(([w,h])=>w>=32&&h>=44));
   if([390,1280].includes(width)&&height!==500)await screenshot(cdp,`${label}-${width}-question-${family}`);
  }
  results.push({width,height,...r});
 }
 // Fixed paper fixtures expose force labels and opposing arrows in all five scenes.
 for(const width of [320,390,1280]){
  await viewport(cdp,width,width===1280?900:600);
  for(let family=0;family<5;family++){const s=filled(21);s.question=family;await snapshot(cdp,base,s);const visible=await call(cdp,"const s=d.getElementById('stage');return [...s.querySelectorAll('.force-label')].map(e=>{const r=e.getBoundingClientRect(),b=s.getBoundingClientRect();return {text:e.textContent,x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height,inside:r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1};});");assert.ok(visible.every(r=>r.inside),`${label} ${width} family ${family}: force label inside stage ${JSON.stringify(visible)}`);await screenshot(cdp,`${label}-${width}-answered-${family}`);}
 }
 // Reflow at the CSS viewport equivalent of 200% desktop zoom, then actual visual zoom.
 await viewport(cdp,640,450);await navigate(cdp,base);const zoomReflow=await call(cdp,"return {width:w.innerWidth,range:d.documentElement.scrollHeight-w.innerHeight};");assert.ok(zoomReflow.range<=1);
 await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});assert.equal(await call(cdp,'return w.visualViewport.scale;'),2);await screenshot(cdp,`${label}-zoom-200`);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
 return results;
}
async function flows(cdp,base,label){
 await viewport(cdp,1280,900);await navigate(cdp,base,{seed:21});
 const blank=await state(cdp);for(const family of G.generate(21).order){const q=G.generate(21).questions[family];for(let slot=0;slot<q.targets.length;slot++){
  await click(cdp,`[data-question="${family}"]`);await click(cdp,`[data-target="${slot}"]`);const expected=q.expected[slot];
  await click(cdp,`[data-body="${expected[0]}"]`);await click(cdp,`[data-anchor="${expected[1]}"]`);await select(cdp,'#kindSelect',expected[2]);await draw(cdp,expected);
  const current=(await state(cdp)).answers[family][slot];assert.equal(current[0],expected[0]);assert.equal(current[1],expected[1]);assert.ok(M.angleDelta(current[3]/10,expected[3]/10)<.11);assert.ok(Math.abs(current[4]-expected[4])<=5);
 }}
 let result=S.score(await state(cdp));assert.equal(result.score,100,'actual mouse drawing earns all eight pairs');
 assert.equal(await call(cdp,"return [...d.querySelectorAll('#questionNav button')].every(e=>e.dataset.progress==='complete');"),true);
 await click(cdp,'#checkButton');assert.equal(await call(cdp,"return w.__reactionApp.getMode();"),'check');await click(cdp,'#checkList button');assert.equal((await state(cdp)).returnToCheck,true);await click(cdp,'#returnCheckButton');await click(cdp,'#submitButton');assert.equal(await call(cdp,"return w.__reactionApp.getMode();"),'review');assert.equal((await call(cdp,"return w.__reactionApp.getResult();")).score,100);
 assert.equal(await call(cdp,"return [...d.querySelectorAll('#dragLayer button')].every(b=>b.hidden);"),true);await click(cdp,'#referenceButton');await screenshot(cdp,`${label}-review`);
 const recorded=await call(cdp,"return w.__lmsValues;");await navigate(cdp,base,{fixture:recorded});assert.equal(await call(cdp,"return w.__reactionApp.getMode();"),'review');
 // Blank and partially answered submissions are legal and preserve earned credit.
 for(const s of [P.fresh(21),(()=>{const s=P.fresh(21);s.answers[0][0][2]=0;return s;})()]){await snapshot(cdp,base,s);await click(cdp,'#checkButton');await click(cdp,'#submitButton');assert.equal((await call(cdp,"return w.__reactionApp.getResult();")).score,S.score(s).score);}
 // Clear / undo / retained identity, and standalone refresh without storage.
 await snapshot(cdp,base,filled());await confirmClick(cdp,'#clearAllButton',false);assert.equal(S.score(await state(cdp)).score,100);await confirmClick(cdp,'#clearAllButton',true);assert.deepEqual(await state(cdp),blank);
 await navigate(cdp,base,{fixture:false,denyStorage:true});await click(cdp,'[data-body="0"]');const changed=await state(cdp);assert.ok(changed.answers.some(a=>a.some(M.started)));await cdp.send('Page.reload');await ready(cdp);assert.ok((await state(cdp)).answers.every(a=>a.every(r=>!M.started(r))));assert.equal(await call(cdp,'return w.__storageProbes;'),0);
 // Same attempt draft and immutable pending-final retry.
 const s=filled();s.question=2;s.target=1;await snapshot(cdp,base,s);await click(cdp,'#checkButton');await call(cdp,'w.__failFinal=true;');await click(cdp,'#submitButton');assert.equal(await call(cdp,"return w.__reactionApp.getMode();"),'frozen');assert.equal(await call(cdp,"return w.__reactionApp.getQuestion().family;"),2);assert.equal(await call(cdp,"return d.querySelector('#targetNav [aria-current=\"step\"]').dataset.target;"),'1');assert.equal(await call(cdp,"return w.__reactionApp.getResult();"),null);const pending=await call(cdp,'return w.__lmsValues;');await navigate(cdp,base,{fixture:pending});assert.equal(await call(cdp,"return w.__reactionApp.getMode();"),'frozen');await click(cdp,'#retryFinalButton');assert.equal(await call(cdp,"return w.__reactionApp.getMode();"),'review');
 return {mouseScore:result.score,slots:8,blankPartial:true,clear:true,standalone:true,reviewAndPending:true};
}
async function touchMatrix(cdp,base,label,width,height=500){
 await viewport(cdp,width,height);const report=[];
 for(let family=0;family<5;family++)for(let slot=0;slot<G.generate(21).questions[family].targets.length;slot++){
  const s=P.fresh(21);s.question=family;s.target=slot;const q=G.generate(21).questions[family],expected=q.expected[slot];s.answers[family][slot]=[expected[0],expected[1],expected[2],null,null];
  await snapshot(cdp,base,s,{embedded:true,fluid:height<500});await delay(150);const before=await metrics(cdp,true);let previewEvidence;
  await draw(cdp,expected,true,true,async()=>{
   const data=await call(cdp,"const m=d.getElementById('magnifier'),r=m.getBoundingClientRect(),s=d.getElementById('stage').getBoundingClientRect();return {hidden:m.hidden,text:d.getElementById('previewValues').textContent,body:d.getElementById('previewBody').textContent,inside:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom,valuesInside:d.getElementById('previewValues').scrollWidth<=d.getElementById('previewValues').clientWidth,svg:d.getElementById('magnifierSvg').children.length};",true);
   assert.equal(data.hidden,false);assert.match(data.text,/F′.*N.*θ.*°/);assert.ok(data.inside&&data.valuesInside&&data.svg>0);assert.ok(data.body.includes(q.bodies[expected[0]].name));previewEvidence=data;
   await screenshot(cdp,`${label}-preview-${family}-${slot}`);
  });
  const after=await metrics(cdp,true);fixed(before,after,'drawing',`${label} origin ${family}/${slot}`);assert.ok(after.pointer.trustedTouch>before.pointer.trustedTouch);assert.equal(after.pointer.cancels,before.pointer.cancels);assert.ok(S.score(await state(cdp,true)).detail[family].detail[slot].magnitude);
  assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden && !d.getElementById('magnifierSvg').children.length;",true),true);
  const head=await rect(cdp,'.reaction-head-hit:not([hidden])',true),preHead=await metrics(cdp,true);await dragTouch(cdp,head,{x:head.x+6,y:head.y+6});const postHead=await metrics(cdp,true);fixed(preHead,postHead,'drawing',`${label} arrow head ${family}/${slot}`);assert.ok(postHead.pointer.ups>preHead.pointer.ups);assert.equal(postHead.pointer.cancels,preHead.pointer.cancels);report.push({family,slot,before,after,preview:previewEvidence});
 }
 // Blank stage and both side strips return scrolling to the containing page.
 await snapshot(cdp,base,P.fresh(21),{embedded:true,fluid:height<500});
 for(const side of ['left','right','blank'])for(const direction of [-1,1]){
  await evaluate(cdp,'scrollTo(0,300)');await delay(80);const l=await call(cdp,'return w.__reactionApp.getGeometry();',true),start=await stagePoint(cdp,{x:side==='left'?16:side==='right'?l.width-16:l.width/2,y:l.height*.5},true),before=await metrics(cdp,true);
  await dragTouch(cdp,start,{x:start.x,y:start.y-direction*35});const after=await metrics(cdp,true);fixed(before,after,'host',`${label} ${side} pan`);assert.ok((after.host.y-before.host.y)*direction>15);report.push({side,direction,before,after});
 }
 // Panel middle in both directions, then outward gestures at both boundaries.
 await evaluate(cdp,'scrollTo(0,300)');
 for(const [boundary,direction] of [['middle',1],['middle',-1],['top',-1],['bottom',1]]){
  await delay(550);await call(cdp,`const p=d.getElementById('controlPanel');p.scrollTop=${boundary==='top'?'0':boundary==='bottom'?'p.scrollHeight':'(p.scrollHeight-p.clientHeight)/2'};`,true);await delay(100);
  const panel=await rect(cdp,'#controlPanel',true),start={x:width-9,y:panel.y+direction*20},before=await metrics(cdp,true);await dragTouch(cdp,start,{x:start.x,y:start.y-direction*45});const after=await metrics(cdp,true);fixed(before,after,'panel',`${label} panel ${boundary}/${direction}`);
  if(boundary==='middle')assert.ok((after.panel-before.panel)*direction>10);else assert.equal(after.panel,before.panel);report.push({boundary,direction,before,after});
 }
 return report;
}
async function specialChecks(cdp,base,label,width){
 await viewport(cdp,width,500);const report=[];
 // Wrong-recipient geometry remains legal: ownership must not be inferred from the contact point.
 let s=P.fresh(21);s.question=0;s.answers[0][0]=[0,1,0,null,null];const expected=G.generate(21).questions[0].expected[0];await snapshot(cdp,base,s,{embedded:true});await draw(cdp,[0,1,0,expected[3],expected[4]],true,true);let a=await state(cdp,true);assert.equal(a.answers[0][0][0],0);assert.equal(S.score(a).detail[0].detail[0].body,false);const draft=await call(cdp,'return w.__lmsValues;',true);await navigate(cdp,base,{fixture:draft,embedded:true});assert.deepEqual(await state(cdp,true),a);report.push('wrong-owner-and-contact-restored');
 for(const reason of ['outside','blur','resize','lost-capture','pointercancel','navigation']){
  await viewport(cdp,width,500);s=filled();s.question=2;await snapshot(cdp,base,s,{embedded:true});const head=await rect(cdp,'.reaction-head-hit:not([hidden])',true),before=await state(cdp,true);
  await call(cdp,"d.getElementById('stage').addEventListener('pointerdown',e=>{w.__pointer={id:e.pointerId,target:e.target};},{once:true});",true);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(head)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:head.x+16,y:head.y+10})]});assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),false);
  if(reason==='outside')await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:9,y:head.y})]});if(reason==='blur')await call(cdp,"w.dispatchEvent(new w.Event('blur'));",true);if(reason==='resize')await viewport(cdp,width+10,500);if(reason==='pointercancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});if(reason==='navigation')await call(cdp,"d.querySelector('[data-question=\"0\"]').click();",true);if(reason==='lost-capture'){await call(cdp,'w.__pointer.target.releasePointerCapture(w.__pointer.id);',true);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:head.x+17,y:head.y+10})]});}
  if(reason!=='pointercancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);const afterCancel=await state(cdp,true);assert.deepEqual(afterCancel.answers,before.answers,`${label} ${reason} rolls back`);if(reason!=='navigation')assert.deepEqual(afterCancel,before);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);report.push(reason);
 }
 await viewport(cdp,width,500);s=filled();s.question=2;const original=s.answers[2][0][4]=G.generate(s.seed).questions[2].maxForce100;s.answers[2][0][3]=0;await snapshot(cdp,base,s,{embedded:true});let head=await rect(cdp,'.offscale-head-hit:not([hidden])',true);const before=await state(cdp,true);await dragTouch(cdp,head,head);assert.deepEqual(await state(cdp,true),before,'offscale tap must preserve actual magnitude');await dragTouch(cdp,head,{x:head.x-20,y:head.y});a=await state(cdp,true);assert.ok(a.answers[2][0][4]<original);assert.ok(a.answers[2][0][4]>original/2,'offscale movement uses actual endpoint');report.push('offscale');
 // Keyboard temporary drawing is not persisted until Enter and is rolled back on Escape.
 await viewport(cdp,1280,900);s=P.fresh(21);s.question=4;s.answers[4][0]=[1,0,4,null,null];await snapshot(cdp,base,s);await call(cdp,"d.querySelector('.anchor-hit:not([hidden])').focus();");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp'});assert.deepEqual(await state(cdp),s);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.deepEqual(await state(cdp),s);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp'});await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});assert.equal((await state(cdp)).answers[4][0][4],110);report.push('keyboard-transaction');
 return report;
}
async function ownershipChecks(cdp,base,label,width){
 const results=[];await viewport(cdp,width,500);
 for(const owner of ['host','panel']){
  const s=filled();s.question=2;await snapshot(cdp,base,s,{embedded:true});await call(cdp,"d.getElementById('controlPanel').scrollTop=0;",true);await evaluate(cdp,'scrollTo(0,300)');await delay(150);
  const head=await rect(cdp,'.reaction-head-hit:not([hidden])',true),box=await rect(cdp,owner==='host'?'#stage':'#controlPanel',true),p={x:width-8,y:box.y+25},before=await metrics(cdp,true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(head)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:head.x+12,y:head.y})]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint({x:head.x+12,y:head.y}),touchPoint(p,2)]});
  for(let j=1;j<=8;j++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:head.x+12,y:head.y}),touchPoint({x:p.x,y:p.y-j*6},2)]});await delay(12);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);const after=await metrics(cdp,true);fixed(before,after,owner,`${label} second finger ${owner}`);assert.ok(owner==='host'?after.host.y>before.host.y:after.panel>before.panel);assert.ok(after.pointer.cancels>before.pointer.cancels);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);results.push({owner,before,after});
 }
 return results;
}
async function lockedChecks(cdp,base,label,width){
 const results=[];await viewport(cdp,width,500);
 for(const mode of ['review','frozen','committed']){
  const s=filled();s.question=4;await snapshot(cdp,base,s,{embedded:true});const old=await rect(cdp,'.reaction-head-hit:not([hidden])',true);
  if(mode!=='review')await call(cdp,mode==='frozen'?'w.__failFinal=true;':'w.__failFinish=true;',true);await click(cdp,'#checkButton',true);await click(cdp,'#submitButton',true);assert.equal(await call(cdp,'return w.__reactionApp.getMode();',true),mode);assert.equal(await call(cdp,"return [...d.querySelectorAll('#dragLayer button')].every(e=>e.hidden);",true),true);
  for(const direction of [-1,1]){await evaluate(cdp,'scrollTo(0,300)');await delay(100);const before=await metrics(cdp,true);await dragTouch(cdp,old,{x:old.x,y:old.y-direction*35});const after=await metrics(cdp,true);fixed(before,after,'host',`${label} ${mode} footprint`);assert.ok((after.host.y-before.host.y)*direction>10);results.push({mode,direction,before,after});}
 }
 return results;
}
async function fineChecks(cdp,base,label){
 await viewport(cdp,390,600);const s=filled();s.question=2;await snapshot(cdp,base,s);const head=await rect(cdp,'.reaction-head-hit:not([hidden])');
 await dragTouch(cdp,head,{x:head.x+2,y:head.y+2});assert.deepEqual(await state(cdp),s,'natural touch jitter does not change magnitude');
 // The actual pointerup position wins even when no pointermove reached that point.
 const q=G.generate(s.seed).questions[2],l=await call(cdp,'return w.__reactionApp.getGeometry();'),origin=M.pixel(M.origin(s.answers[2][0],q),l),angle=s.answers[2][0][3]/10,force=s.answers[2][0][4]/100;
 const end=await stagePoint(cdp,M.endpoint([s.answers[2][0][0],s.answers[2][0][1],3,Math.round(angle*10),Math.round(force*.75*100)],q,l));
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:head.x,y:head.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',clickCount:1});await delay(80);let current=await state(cdp);assert.ok(Math.abs(current.answers[2][0][4]-Math.round(force*.75*100))<=5);
 // Changes to recipient clear dependent geometry, retain kind, and remain undoable.
 const before=current.answers[2][0];await click(cdp,'[data-body="0"]');assert.deepEqual((await state(cdp)).answers[2][0],[0,null,before[2],null,null]);await click(cdp,'#undoButton');assert.deepEqual((await state(cdp)).answers[2][0],before);await click(cdp,'#redoButton');assert.deepEqual((await state(cdp)).answers[2][0],[0,null,before[2],null,null]);
 // Changing only the anchor is a translation, never a new magnitude.
 await click(cdp,'#undoButton');await click(cdp,'[data-anchor="0"]');const translated=(await state(cdp)).answers[2][0];assert.deepEqual(translated,[before[0],0,...before.slice(2)]);
 // Supplied background movement is cosmetic and can be paused without changing the task.
 const a=filled();a.question=0;await snapshot(cdp,base,a);const t=await call(cdp,'return w.__reactionApp.getAnimation();');await delay(150);assert.ok((await call(cdp,'return w.__reactionApp.getAnimation();')).elapsed>t.elapsed);await click(cdp,'#pauseButton');const stopped=await call(cdp,'return w.__reactionApp.getAnimation();');await delay(150);assert.deepEqual(await call(cdp,'return w.__reactionApp.getAnimation();'),stopped);assert.deepEqual(await state(cdp),a);
 return {jitter:true,finalPointerup:true,dependenciesAndUndo:true,pause:true};
}
async function main(){
 fs.mkdirSync(artifactDir,{recursive:true});sourceParity();const tempRoot=fs.realpathSync(os.tmpdir()),servers=[];let profile,packageDirectory,chrome,cdp,failure;
 const report={activity:slug,engine:'Chrome/CDP trusted touch',viewports:{},flows:{},gestures:{},special:{},ownership:{},locked:{},fine:{},errors:[]};
 try{
  const browser=findBrowser();assert.ok(browser,'Chrome required');const extracted=buildAndExtractPackage(tempRoot,{slug,packagePrefix:'simlab-thirdlaw-package-',packageNamePattern:/^simlab-thirdlaw-package-[A-Za-z0-9]+$/});packageDirectory=extracted.packageDirectory;
  for(const name of sourceParity().concat(`${slug}/index.html`))assert.equal(fs.readFileSync(path.join(root,'sim',name),'utf8'),fs.readFileSync(path.join(packageDirectory,name),'utf8'),`package parity ${name}`);
  profile=fs.mkdtempSync(path.join(tempRoot,'simlab-thirdlaw-chrome-'));chrome=spawn(browser,['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';chrome.stderr.on('data',b=>stderr=(stderr+b).slice(-3000));const port=await devToolsPort(profile,chrome).catch(e=>{e.message+=stderr;throw e;});let targetId;
  async function fresh(){if(cdp){await cdp.send('Target.closeTarget',{targetId});cdp.close();}const {body:t}=await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});targetId=t.id;cdp=new CdpClient(t.webSocketDebuggerUrl,WebSocket,15000);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');await preload(cdp);cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));}
  await fresh();report.browser=await cdp.send('Browser.getVersion');
  for(const [label,directory] of [['source',path.join(root,'sim')],['package',packageDirectory]]){
   const server=createServer(directory);servers.push(server);await listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;await fresh();console.log(`third law: ${label} layout/flow`);
   if(process.argv.includes('--edges')){for(const width of [390,320]){await fresh();report.special[`${label}-${width}`]=await specialChecks(cdp,base,`${label}-${width}`,width);await fresh();report.ownership[`${label}-${width}`]=await ownershipChecks(cdp,base,`${label}-${width}`,width);await fresh();report.locked[`${label}-${width}`]=await lockedChecks(cdp,base,`${label}-${width}`,width);}continue;}
   if(!process.argv.includes('--touch')){report.viewports[label]=await visualMatrix(cdp,base,label);if(!process.argv.includes('--smoke')){report.flows[label]=await flows(cdp,base,label);report.fine[label]=await fineChecks(cdp,base,label);}}
   if(process.argv.includes('--smoke'))continue;
   for(const width of [390,320]){console.log(`third law: ${label} trusted touch ${width}`);await fresh();report.gestures[`${label}-${width}`]=await touchMatrix(cdp,base,`${label}-${width}`,width);await fresh();report.special[`${label}-${width}`]=await specialChecks(cdp,base,`${label}-${width}`,width);await fresh();report.ownership[`${label}-${width}`]=await ownershipChecks(cdp,base,`${label}-${width}`,width);await fresh();report.locked[`${label}-${width}`]=await lockedChecks(cdp,base,`${label}-${width}`,width);}
   await fresh();report.gestures[`${label}-short`]=await touchMatrix(cdp,base,`${label}-short`,320,400);
  }
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(artifactDir,process.argv.includes('--smoke')?'smoke-report.json':process.argv.includes('--edges')?'edges-report.json':'report.json'),JSON.stringify(report,null,2));
 }catch(e){failure=e;if(cdp)report.failureUI=await evaluate(cdp,"(()=>{const w=document.getElementById('activity')?.contentWindow||window;return {text:w.document.body.innerText,mode:w.__reactionApp?.getMode(),state:w.__reactionApp?.getState()};})()").catch(()=>null);fs.writeFileSync(path.join(artifactDir,'failure.json'),JSON.stringify({message:e.stack,report},null,2));if(cdp)await screenshot(cdp,'failure').catch(()=>{});}
 try{if(chrome)await stopChrome(chrome,cdp);cdp?.close();for(const server of servers)await closeServer(server);for(const dir of [profile,packageDirectory].filter(Boolean)){validateOwnedDirectory(dir,tempRoot,/^simlab-thirdlaw-(?:chrome|package)-[A-Za-z0-9]+$/,'third law test artifact');fs.rmSync(dir,{recursive:true,force:false});}}catch(e){failure ||=e;}
 if(failure)throw failure;console.log('third law source/package browser checks passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={sourceParity,main};
