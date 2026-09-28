#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const { CdpClient, buildAndExtractPackage, createServer, listenServer, devToolsPort, fetchJson, evaluate, delay, findBrowser, stopChrome, closeServer, validateOwnedDirectory } = require("./position-time-browser-regression.js");
const M = require("../sim/newtons-second-law-investigation-lab/model.js"), G = require("../sim/newtons-second-law-investigation-lab/graph.js"), P = require("../sim/newtons-second-law-investigation-lab/persistence.js"), S = require("../sim/newtons-second-law-investigation-lab/scoring.js");
const root = path.resolve(__dirname, ".."), slug = P.ACTIVITY, artifactDir = path.join(root, "output/playwright/newtons-second-law");
function sourceParity() {
  const html = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => path.posix.normalize(`${slug}/${m[1]}`)).sort();
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(fs.readFileSync(path.join(root, "sim/manifests", `${slug}.xml`), "utf8"));
  const declared = parsed.manifest.resources.resource.file.map(f => f["@_href"]).filter(f => f !== `${slug}/index.html`).sort();
  assert.deepEqual(refs, declared, "all runtime dependencies declared exactly once"); return refs;
}
const call = (cdp, code, embedded = false) => evaluate(cdp, `((w,d)=>{${code}})(${embedded ? 'document.getElementById("activity").contentWindow,document.getElementById("activity").contentDocument' : "window,document"})`);
async function ready(cdp, embedded = false) {
  for (let i = 0; i < 150; i++) {
    try { if (await call(cdp, "return d.readyState==='complete' && Boolean(w.__newtonApp);", embedded)) return; } catch (_) {}
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
    window.__randomDraws=0;
    if(params.has('__random')) {const draws=JSON.parse(params.get('__random'));Math.random=()=>draws[window.__randomDraws++ % draws.length];}
    window.__storageProbes=0;
    if(params.has('__denyStorage')) Object.defineProperty(window,'localStorage',{get(){window.__storageProbes++;throw new DOMException('Storage denied by test','SecurityError');}});
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
  if(options.random) params.set("__random",JSON.stringify(options.random));
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
  const [message] = await Promise.all([dialog, press()]); assert.match(message, /清除/); await delay(50);
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
  const local = await call(cdp, `const app=w.__newtonApp,p=d.getElementById('controlPanel'),s=d.getElementById('stage'),r=s.getBoundingClientRect(),v=w.visualViewport;return {docX:w.scrollX,docY:w.scrollY,docRange:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.scrollTop,panelRange:p.scrollHeight-p.clientHeight,stage:[r.left,r.top,r.width,r.height],view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],answer:JSON.stringify(app.getState()),pointer:app.getPointerDiagnostics(),mode:app.getMode()};`, embedded);
  const host = await evaluate(cdp, `(()=>{const r=${embedded ? "document.getElementById('activity').getBoundingClientRect()" : "null"},v=visualViewport;return {x:scrollX,y:scrollY,view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],frame:r?[r.left,r.top,r.width,r.height]:null};})()`);
  return { ...local, host };
}
function fixed(before, after, owner, label) {
  assert.equal(after.docX, before.docX, `${label}: document x`); assert.equal(after.docY, before.docY, `${label}: document y`);
  assert.ok(after.docRange <= 1, `${label}: no third scroll owner`);
  assert.deepEqual(after.view, before.view, `${label}: activity visual viewport`);
  assert.deepEqual(after.stage, before.stage, `${label}: local stage`);
  if (owner !== "panel") assert.equal(after.panel, before.panel, `${label}: panel fixed ${JSON.stringify({before,after})}`);
  if (owner !== "host") assert.deepEqual(after.host, before.host, `${label}: host and iframe fixed`);
  if (owner !== "drawing") assert.equal(after.answer, before.answer, `${label}: answer fixed`);
}
async function screenshot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(artifactDir, `${name}.png`), Buffer.from(data, "base64"));
}

const {environment,filled,durableDraft,finishedData,legacy,assertFresh}=require("../sim/newtons-second-law-investigation-lab/test-support.js");
const state = (cdp,embedded=false)=>call(cdp,"return w.__newtonApp.getState();",embedded);
const mode = (cdp,embedded=false)=>call(cdp,"return w.__newtonApp.getMode();",embedded);
async function choose(cdp,selector,value,embedded=false) {
  await call(cdp,`const e=d.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));`,embedded);await delay(30);
}
async function mouseDrag(cdp,start,end) {
  for(const [type,p,buttons] of [["mousePressed",start,1],["mouseMoved",end,1],["mouseReleased",end,0]]) await cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",buttons,clickCount:1});
  await delay(50);
}
async function graphPixel(cdp,point,embedded=false) {
  const g=await call(cdp,"return w.__newtonApp.getGeometry();",embedded),r=await rect(cdp,"#stage",embedded);
  const p=G.pixel(g,point);return {x:r.x-r.width/2+p.x,y:r.y-r.height/2+p.y};
}
async function plotRecord(cdp,index,point,embedded=false,touch=false,during=null) {
  await click(cdp,`[data-select-row="${index}"]`,embedded);
  const start=await rect(cdp,"#sourceHandle",embedded),end=await graphPixel(cdp,point,embedded);
  if(touch) await dragTouch(cdp,start,end,during);else await mouseDrag(cdp,start,end);
}
async function visualMatrix(cdp,base,label) {
  const evidence=[];
  for(const [width,height] of [[320,500],[390,500],[390,600],[390,844],[768,900],[1024,768],[1280,900],[740,360],[320,400]]) {
    await viewport(cdp,width,height);await navigate(cdp,base,{fixture:durableDraft(filled())});
    for(const [phase,sel] of [["collect",'[data-phase="collect"]'],["plot",'[data-phase="plot"]'],["conclude",'[data-phase="conclude"]'],["check","#checkButton"]]) {
      await click(cdp,sel);
      const r=await call(cdp,`const p=d.getElementById('controlPanel'),s=d.getElementById('stage');return {phase:w.__newtonApp.getMode(),width:w.innerWidth,height:w.innerHeight,overflow:d.documentElement.scrollWidth-w.innerWidth,range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.clientHeight,stage:s.clientHeight,smallTargets:[...d.querySelectorAll('button')].filter(e=>e.getClientRects().length && e.getBoundingClientRect().height<43.9).map(e=>e.id||e.textContent)};`);
      assert.equal(r.phase,phase);assert.ok(r.overflow<=1 && r.range<=1,`${label} ${width}x${height}: no competing scroll ${JSON.stringify(r)}`);assert.ok(r.panel>=70,`${width}x${height}: controls remain reachable`);assert.deepEqual(r.smallTargets,[]);
      if(phase==="plot" || phase==="collect") {assert.ok(r.stage>=165,JSON.stringify(r));if([320,390,1280].includes(width)) await screenshot(cdp,`${label}-${phase}-${width}x${height}`);}
      evidence.push(r);
    }
  }
  await viewport(cdp,390,600);await navigate(cdp,base,{fixture:durableDraft(P.navigate(filled(),"plot",2))});
  await cdp.send("Emulation.setPageScaleFactor",{pageScaleFactor:2});assert.equal(await call(cdp,"return w.visualViewport.scale;"),2);await screenshot(cdp,`${label}-zoom-200`);await cdp.send("Emulation.setPageScaleFactor",{pageScaleFactor:1});
  return evidence;
}
async function waitFor(cdp, code, timeout = 8500) {
  const until=Date.now()+timeout;
  while(Date.now()<until) {if(await call(cdp,code))return;await delay(50);}
  throw new Error(`Timed out waiting for ${code}`);
}
async function setMass(cdp,target) {
  const s=await state(cdp),initial=s.setups[s.group].settings[0];
  for(let i=0;i<Math.abs(target-initial);i++)await click(cdp,target>initial?"#massUp":"#massDown");
  assert.equal((await state(cdp)).setups[s.group].settings[0],target);
}
async function settingsChecks(cdp,base,label) {
  await viewport(cdp,1280,900,false);
  const starts=[];
  for(let i=0;i<6;i++) {
    await navigate(cdp,base,{random:[(i+.5)/6,(5-i+.5)/6]});const s=await state(cdp);assertFresh(s);
    const masses=s.setups.map(setup=>setup.settings[0]);assert.deepEqual(masses,[M.INITIAL_MASSES[i],M.INITIAL_MASSES[5-i]]);starts.push(masses);
    assert.equal(await call(cdp,"return w.__randomDraws;"),2);
    assert.ok(await call(cdp,"return !d.querySelector('#massLock,#forceLock,.lock') && !/防誤改|鎖定/.test(d.body.innerText);"));
    for(const [group,title] of [[0,"A · 探究加速度與合外力的關係"],[1,"B · 探究加速度與總質量的關係"]]) {
      await click(cdp,`[data-group="${group}"]`);assert.equal(await call(cdp,"return d.getElementById('collectTitle').textContent;"),title);
      assert.equal(await call(cdp,`return d.querySelector('[data-group="${group}"]').textContent;`),title);
    }
    await click(cdp,'[data-group="0"]');assert.deepEqual((await state(cdp)).setups,s.setups);assert.equal(await call(cdp,"return w.__randomDraws;"),2);
  }
  await setMass(cdp,2);await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await click(cdp,"#measureButton");const measured=await state(cdp),saved=await call(cdp,"return {...w.__lmsValues};");
  await navigate(cdp,base,{fixture:saved,random:[0,.99]});assert.deepEqual(await state(cdp),measured);assert.equal(await call(cdp,"return w.__randomDraws;"),0);
  await click(cdp,"#recordButton");await click(cdp,"#massUp");await click(cdp,"#forceUp");await click(cdp,"#measureButton");await click(cdp,"#recordButton");
  assert.deepEqual((await state(cdp)).groups[0].records.map(r=>r.slice(0,2)),[[2,2],[3,3]],"both variables are freely adjustable between runs");
  assert.equal(S.score(await state(cdp)).detail.experiments[0].control,0,"changing both variables loses control-consistency credit");
  const old=legacy(M.fresh(2,()=>.2),2);old.setups.forEach(setup=>{setup.locks=[true,true];});old.setups[0].settings=[2,2];old.setups[0].candidate=M.measure(2,2);
  await navigate(cdp,base,{fixture:durableDraft(old),random:[.99,.99]});assert.deepEqual(await state(cdp),P.upgradeDraft(old));assert.equal(await call(cdp,"return w.__randomDraws;"),0);
  await click(cdp,"#recordButton");await click(cdp,"#massDown");await click(cdp,"#forceDown");assert.deepEqual((await state(cdp)).setups[0].settings,[1,1]);
  await screenshot(cdp,`${label}-free-settings-desktop`);
  const touch=[];
  for(const width of [320,390]) {
    await viewport(cdp,width,500,true);await navigate(cdp,base,{embedded:true,random:[.2,.8]});
    await call(cdp,"w.__settingsTrusted=[];d.getElementById('massUp').addEventListener('click',e=>w.__settingsTrusted.push(e.isTrusted));",true);
    const p=await rect(cdp,"#massUp",true,true),before=await metrics(cdp,true);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(p)]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await delay(100);
    const after=await metrics(cdp,true);fixed(before,after,"drawing",`${label} free mass ${width}`);
    assert.equal((await state(cdp,true)).setups[0].settings[0],2);assert.deepEqual(await call(cdp,"return w.__settingsTrusted;",true),[true]);
    await screenshot(cdp,`${label}-free-settings-touch-${width}`);touch.push({width,before,after});
  }
  await cdp.send("Emulation.setEmulatedMedia",{features:[]});
  return {starts,resume:true,manualOneKilogram:true,legacyUnlock:true,touch};
}
const cartPosition=cdp=>call(cdp,"return Number(d.querySelector('#stageSvg .cart').dataset.position);");
async function assertCartExited(cdp) {
  assert.ok(await call(cdp,"return d.querySelector('.cart-body').getBoundingClientRect().left>d.getElementById('stage').getBoundingClientRect().right;"),"entire cart exits the visible track");
}
async function motionChecks(cdp,base,label) {
  await viewport(cdp,1280,900,false);
  await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
  const fast=M.fresh();fast.setups[0].settings=[0,5];
  await navigate(cdp,base,{fixture:durableDraft(fast)});
  for(const [value,symbol] of [["mass","m"],["force","F合"],["acceleration","a"]]) {
    await choose(cdp,"#role0",value);
    assert.equal(await call(cdp,"return d.getElementById('roleSymbol0').textContent;"),symbol);
    assert.equal(await call(cdp,"return w.getComputedStyle(d.querySelector('#roleSymbol0 var')).fontStyle;"),"italic");
  }
  assert.ok(await call(cdp,"return [...d.querySelectorAll('select option')].every(o=>!/[a-zA-Z]/.test(o.textContent));"),"native options use readable names, math sits outside them");
  assert.deepEqual(await call(cdp,"return [...d.querySelectorAll('.motion-readout .variable')].map(e=>[e.textContent,w.getComputedStyle(e).fontStyle]);"),[["t","italic"],["v","italic"]]);
  await click(cdp,"#measureButton");await waitFor(cdp,"return Boolean(w.__newtonApp.getState().setups[0].candidate);");
  assert.equal((await state(cdp)).setups[0].candidate[2],2400);
  assert.ok(await call(cdp,"return +d.querySelector('.cart').dataset.time>=1;"),"fastest run never reveals an uncollected sensor sample");
  const saved=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:saved});
  assert.deepEqual((await state(cdp)).setups[0].candidate,[0,5,2400]);assert.equal(await call(cdp,"return w.__newtonApp.getRunning();"),false);await assertCartExited(cdp);
  await click(cdp,"#replayButton");await waitFor(cdp,"return !d.getElementById('recordButton').disabled;");await click(cdp,"#recordButton");
  await waitFor(cdp,"return !w.__newtonApp.getRunning();");await assertCartExited(cdp);
  assert.equal((await state(cdp)).groups[0].records.length,1);assert.equal((await state(cdp)).setups[0].candidate,null,"replay does not remeasure after recording");
  const slow=M.fresh();slow.setups[0].settings=[6,0];await navigate(cdp,base,{fixture:durableDraft(slow)});
  await click(cdp,"#measureButton");await delay(150);await click(cdp,'[data-group="1"]');await delay(4500);
  assert.ok((await state(cdp)).setups.every(s=>s.candidate===null));assert.equal(await call(cdp,"return w.__newtonApp.getRunning();"),false,"cancelled run cannot later publish a reading");
  await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await navigate(cdp,base,{fixture:durableDraft(slow)});await click(cdp,"#measureButton");
  assert.deepEqual((await state(cdp)).setups[0].candidate,[6,0,100]);await assertCartExited(cdp);
  await click(cdp,'[data-phase="plot"]');
  for(const model of M.METHODS) {await choose(cdp,"#fitModel",model);assert.ok(await call(cdp,"return [...d.querySelectorAll('#fitFormula var')].every(e=>w.getComputedStyle(e).fontStyle==='italic') && d.querySelectorAll('#fitFormula var').length>=2;"));}
  await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
  return {fastestReading:2400,slowestReading:100,resume:true,replay:true,cancel:true,reducedMotion:true,notation:true};
}
async function interpretationChecks(cdp,base,label) {
  await viewport(cdp,1280,900,false);
  await navigate(cdp,base);await click(cdp,'[data-phase="plot"]');
  await click(cdp,'#meaningChoices input[value="inverse-mass"]');
  await confirmClick(cdp,"#clearGraph",false);assert.equal((await state(cdp)).plots[0].meaning,"inverse-mass");
  await confirmClick(cdp,"#clearGraph",true);assert.equal((await state(cdp)).plots[0].meaning,null);
  const answer=filled();answer.plots.forEach(p=>{p.meaning=null;});
  await navigate(cdp,base,{fixture:durableDraft(P.navigate(answer,"plot",0))});
  for(const graph of [0,1,2]) {
    await click(cdp,`#graphNav [data-graph="${graph}"]`);
    assert.match(await call(cdp,"return d.getElementById('coefficientReadout').textContent;"),graph===0?/kg⁻¹/:/N/);
    await click(cdp,'#meaningChoices input[value="mass"]');
    assert.equal(await call(cdp,"const s=w.__newtonApp.getState();return w.NewtonInterpretation.analyze(s,s.graph).conversion.unit;"),graph===0?"kg⁻¹":"N","incorrect meaning cannot invent a mass unit");
    await click(cdp,`#meaningChoices input[value="${M.INTERPRETATIONS[graph].answer}"]`);
    const interpretation=await call(cdp,"const s=w.__newtonApp.getState();return w.NewtonInterpretation.analyze(s,s.graph);");
    assert.ok(Math.abs(interpretation.conversion.value-(graph===0?1:.6))<.001);
    assert.match(await call(cdp,"return d.getElementById('conversionReadout').textContent;"),graph===0?/1\/k = 1 kg/:/k = [\d.]+ N/);
    await call(cdp,"d.getElementById('interpretationPanel').scrollIntoView({block:'end'});");await screenshot(cdp,`${label}-interpretation-${graph}`);
  }
  await click(cdp,"#checkButton");assert.match(await call(cdp,"return d.getElementById('checkSummary').textContent;"),/解讀已答/);
  await click(cdp,'[data-check-phase="plot"][data-index="0"]');
  const saved=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:saved});
  assert.equal((await state(cdp)).returnToCheck,true);assert.equal((await state(cdp)).plots[0].meaning,"inverse-mass");
  await choose(cdp,"#fitModel","quadratic");assert.equal(await call(cdp,"return d.getElementById('conversionReadout').hidden;"),true);assert.equal((await state(cdp)).plots[0].meaning,"inverse-mass");
  await click(cdp,"#fitButton");assert.match(await call(cdp,"return d.getElementById('coefficientReadout').textContent;"),/若二次項近乎零/);
  await choose(cdp,"#fitModel","origin");await click(cdp,"#fitButton");
  await click(cdp,'[data-phase="conclude"]');
  assert.ok(await call(cdp,"return d.querySelectorAll('#conclusionFields var').length>=12 && [...d.querySelectorAll('#conclusionFields var')].every(e=>w.getComputedStyle(e).fontStyle==='italic');"));
  assert.ok(await call(cdp,"return d.querySelectorAll('#conclusionFields sub').length===4;"));
  await call(cdp,"d.getElementById('conclusionFields').lastElementChild.scrollIntoView({block:'end'});");
  await screenshot(cdp,`${label}-conclusion-math`);await click(cdp,"#returnCheck");await click(cdp,"#submitButton");assert.equal(await call(cdp,"return w.__newtonApp.getResult().score;"),100);
  await click(cdp,'[data-phase="plot"]');assert.ok(await call(cdp,"return [...d.querySelectorAll('#meaningChoices input')].every(e=>e.disabled);"));
  // Old in-progress attempts gain the practice without losing already earned credit.
  const old=legacy(M.fresh());old.conclusions[0]="direct";
  await navigate(cdp,base,{fixture:durableDraft(P.navigate(old,"plot",0))});assert.equal((await state(cdp)).schemaVersion,3);assert.equal((await state(cdp)).rubricVersion,1);
  assert.match(await call(cdp,"return d.getElementById('interpretationWeight').textContent;"),/不計分/);
  await click(cdp,'#meaningChoices input[value="inverse-mass"]');await click(cdp,"#checkButton");await click(cdp,"#submitButton");assert.equal(await call(cdp,"return w.__newtonApp.getResult().score;"),5);
  await navigate(cdp,base,{fixture:finishedData(old)});assert.equal(await mode(cdp),"review");assert.equal((await state(cdp)).schemaVersion,1);assert.equal(await call(cdp,"return d.getElementById('interpretationPanel').hidden;"),true);
  const pending=environment();pending.flags.writeFail="cmi.core.score.raw";pending.scorm.submitWithCallbacks(S.score(old),pending.scorm.makeSnapshot(slug,"review",P.review(old),S.score(old)),{onSuccess(){},onFailure(){}});
  await navigate(cdp,base,{fixture:pending.durable});assert.equal(await mode(cdp),"frozen");await click(cdp,"#retryFinalButton");assert.equal(await mode(cdp),"review");assert.equal(await call(cdp,"return w.__newtonApp.getResult().score;"),5);
  // The same interpretation radio remains a native, trusted touch target in the player.
  const touch=[];
  for(const width of [320,390]) {
    await viewport(cdp,width,600,true);await navigate(cdp,base,{fixture:durableDraft(P.navigate(answer,"plot",0)),embedded:true});
    await call(cdp,"w.__meaningTrusted=[];d.getElementById('meaningChoices').addEventListener('change',e=>w.__meaningTrusted.push(e.isTrusted));",true);
    const p=await rect(cdp,'#meaningChoices input[value="inverse-mass"]',true,true),before=await metrics(cdp,true);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(p)]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await delay(100);
    const after=await metrics(cdp,true);fixed(before,after,"drawing",`${label} interpretation ${width}`);
    assert.equal((await state(cdp,true)).plots[0].meaning,"inverse-mass");assert.deepEqual(await call(cdp,"return w.__meaningTrusted;",true),[true]);
    assert.ok(await call(cdp,"return !d.getElementById('keyboardPlace') && d.getElementById('keyboardHelp').classList.contains('sr-only');",true));
    await screenshot(cdp,`${label}-interpretation-touch-${width}`);touch.push({width,before,after});
  }
  return {realCoefficient:true,units:true,math:true,legacyDraft:true,legacyReview:true,legacyPending:true,touch};
}
async function interactionChecks(cdp,base,label) {
  const evidence=[],jitter=[],offscaleKeyboard=[];
  const key=async (name,modifiers=0)=>{
    for(const type of ["keyDown","keyUp"])await cdp.send("Input.dispatchKeyEvent",{type,key:name,code:name,modifiers});
  };
  const mouse=async(type,p,pointerType="mouse")=>cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",buttons:type==="mouseReleased"?0:1,clickCount:1,pointerType});
  for(const [width,height] of [[1280,900],[320,400]]) {
    await viewport(cdp,width,height,width<600);
    const answer=P.navigate(filled(),"plot",0),expected=answer.plots[0].points[0].slice();
    for(const moved of [true,false]) {
      const unplaced=M.clone(answer);unplaced.plots[0].points[0]=null;unplaced.plots[0].fitAttempted=false;
      await navigate(cdp,base,{fixture:durableDraft(unplaced)});
      await call(cdp,"w.__releaseEvents=[];for(const type of ['pointerdown','pointermove','pointerup'])d.getElementById('sourceHandle').addEventListener(type,e=>w.__releaseEvents.push({type:e.type,x:e.clientX,y:e.clientY,trusted:e.isTrusted}));");
      await mouse("mousePressed",await rect(cdp,"#sourceHandle"));
      if(moved)await mouse("mouseMoved",await graphPixel(cdp,[.8,.8]));
      await mouse("mouseReleased",await graphPixel(cdp,[.2,.2]));
      assert.deepEqual((await state(cdp)).plots[0].points[0],expected,"release position is authoritative even without a final move");
      const events=await call(cdp,"return w.__releaseEvents;");assert.ok(events.every(e=>e.trusted));
      assert.deepEqual(events.map(e=>e.type),moved?["pointerdown","pointermove","pointerup"]:["pointerdown","pointerup"]);
      evidence.push({width,height,release:moved?"newer-than-move":"without-move",events});
    }
    const wrong=M.clone(answer);wrong.plots[0].points[0]=[2137,3179];
    await navigate(cdp,base,{fixture:durableDraft(wrong)});
    let hit=await rect(cdp,'.plot-point-hit[data-point="0"]');hit.x+=8;
    await mouse("mousePressed",hit);await mouse("mouseReleased",hit);
    assert.deepEqual(await state(cdp),wrong,"clicking an existing point must preserve its precise position and fit");
    await mouse("mousePressed",await rect(cdp,'.plot-point-hit[data-point="0"]'));
    await mouse("mouseMoved",await graphPixel(cdp,[.6,.8]));
    const stage=await rect(cdp,"#stage");await mouse("mouseReleased",{x:stage.x-stage.width/2+8,y:stage.y});
    assert.deepEqual(await state(cdp),wrong,"release outside cancels the edit even after a valid move");
    const offscale=M.clone(answer);offscale.plots[0].points[0]=[2000,30000];
    await navigate(cdp,base,{fixture:durableDraft(offscale)});
    hit=await rect(cdp,'.offscale-point-hit[data-point="0"]');
    await mouse("mousePressed",hit);await mouse("mouseReleased",hit);
    assert.deepEqual(await state(cdp),offscale,"an unchanged offscale grabber must not clamp the saved point");
    for(const initial of [wrong,offscale]) {
      const selector=initial===wrong?'.plot-point-hit[data-point="0"]':'.offscale-point-hit[data-point="0"]';
      for(const pointer of ["mouse","pen"]) {
        const distance=pointer==="mouse"?2:5;
        for(const moved of [false,true]) {
          await navigate(cdp,base,{fixture:durableDraft(initial)});
          await call(cdp,`w.__jitterEvents=[];const b=d.querySelector(${JSON.stringify(selector)});for(const type of ['pointerdown','pointermove','pointerup'])b.addEventListener(type,e=>w.__jitterEvents.push({type:e.type,pointer:e.pointerType,trusted:e.isTrusted}));`);
          const start=await rect(cdp,selector),end={x:start.x+distance,y:start.y};
          await mouse("mousePressed",start,pointer);if(moved)await mouse("mouseMoved",end,pointer);await mouse("mouseReleased",end,pointer);
          assert.deepEqual(await state(cdp),initial,"sub-threshold jitter must preserve the original point and fit");
          assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;"),true);
          const events=await call(cdp,"return w.__jitterEvents;");assert.ok(events.length>=2&&events.every(e=>e.trusted&&e.pointer===pointer));
          jitter.push({width,pointer,moved,offscale:initial===offscale,distance,events});
        }
        // Once a drag starts, returning near the press location is still an edit.
        const start=await rect(cdp,selector),end={x:start.x+1,y:start.y};
        await mouse("mousePressed",start,pointer);await mouse("mouseMoved",await graphPixel(cdp,[1,.8]),pointer);await mouse("mouseMoved",end,pointer);await mouse("mouseReleased",end,pointer);
        const changed=await state(cdp);assert.notDeepEqual(changed.plots[0].points[0],initial.plots[0].points[0]);assert.equal(changed.plots[0].fitAttempted,false);
        assert.deepEqual(changed.plots[0].points.slice(1),initial.plots[0].points.slice(1));
      }
      await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:2});
      for(const distance of [1,5]) {
        await navigate(cdp,base,{fixture:durableDraft(initial)});
        const start=await rect(cdp,selector),before=await call(cdp,"return w.__newtonApp.getPointerDiagnostics();");
        await dragTouch(cdp,start,{x:start.x+distance,y:start.y});
        assert.deepEqual(await state(cdp),initial,"trusted finger jitter must not snap or clamp an existing point");
        const after=await call(cdp,"return w.__newtonApp.getPointerDiagnostics();");assert.ok(after.trustedTouch>before.trustedTouch&&after.moves>before.moves&&after.ups>before.ups);assert.equal(after.cancels,before.cancels);
        jitter.push({width,pointer:"touch",offscale:initial===offscale,distance,before,after});
      }
      const start=await rect(cdp,selector);await dragTouch(cdp,start,await graphPixel(cdp,[1,.8]));
      const changed=await state(cdp),geometry=await call(cdp,"return w.__newtonApp.getGeometry();");
      assert.notDeepEqual(changed.plots[0].points[0],initial.plots[0].points[0],"a finger drag past the threshold can still edit the point");
      const actual=G.pixel(geometry,changed.plots[0].points[0].map(v=>v/10000)),end=G.pixel(geometry,[1,.8]);
      assert.ok(Math.hypot(actual.x-end.x,actual.y-end.y)<=14.01,"the dragged result remains within the documented touch snap hold radius");
      assert.equal(changed.plots[0].fitAttempted,false);assert.deepEqual(changed.plots[0].points.slice(1),initial.plots[0].points.slice(1));
    }
    // A single key must make the documented small step from either a reading or a wrong point.
    for(const initial of [answer,wrong]) {
      await navigate(cdp,base,{fixture:durableDraft(initial)});
      await call(cdp,"w.__keyEvents=[];const b=d.querySelector('.plot-point-hit[data-point=\"0\"]');b.focus();b.addEventListener('keydown',e=>w.__keyEvents.push({key:e.key,trusted:e.isTrusted}));");
      await key("Enter");await key("ArrowRight");
      const wanted=initial.plots[0].points[0].map((v,i)=>i===0?v+50:v);
      assert.deepEqual(await state(cdp),initial,"working keyboard coordinates remain uncommitted");
      const preview=await call(cdp,"const p=d.querySelector('#stageSvg circle.selected');return {x:+p.getAttribute('cx'),y:+p.getAttribute('cy')};");
      const geometry=await call(cdp,"return w.__newtonApp.getGeometry();"),position=G.pixel(geometry,wanted.map(v=>v/10000));
      assert.ok(Math.hypot(preview.x-position.x,preview.y-position.y)<.01,"one key visibly resolves to one data step without snapping back");
      await key("Enter");assert.deepEqual((await state(cdp)).plots[0].points[0],wanted);assert.equal((await state(cdp)).plots[0].fitAttempted,false);
      assert.ok((await call(cdp,"return w.__keyEvents;")).every(e=>e.trusted));
      await key("Enter");await key("ArrowRight",8);await key("Enter");
      wanted[0]+=500;assert.deepEqual((await state(cdp)).plots[0].points[0],wanted,"Shift moves one whole minor interval");
      const before=await state(cdp);await key("Enter");await key("ArrowUp");await key("Escape");
      assert.deepEqual(await state(cdp),before,"Escape restores the committed answer");
    }
    // Shrinking an axis must not make one key silently clamp a retained answer.
    await navigate(cdp,base,{fixture:durableDraft(offscale)});
    await call(cdp,"d.querySelector('.offscale-point-hit[data-point=\"0\"]').focus();");
    const offGeometry=await call(cdp,"return w.__newtonApp.getGeometry();");
    const delta=Math.round(offGeometry.minorY/10*10000),wanted=[2000,30000-delta];
    const pointLabel=()=>call(cdp,"const p=d.querySelector('#stageSvg .point-label'),r=p.getBoundingClientRect(),s=d.getElementById('stage').getBoundingClientRect();return {text:p.textContent,inside:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom};");
    await key("Enter");await key("ArrowDown");
    assert.deepEqual(await state(cdp),offscale,"offscale working coordinates remain uncommitted");
    const labelBeforeSave=await pointLabel();
    assert.equal(labelBeforeSave.text,`#1 (0.2, ${G.fmt(wanted[1]/10000)}) 超出圖框`);
    assert.ok(labelBeforeSave.inside,"the actual offscale working coordinate is readable inside the stage");
    await screenshot(cdp,`${label}-offscale-keyboard-${width}`);
    await key("Enter");const savedOffscale=await state(cdp);
    assert.deepEqual(savedOffscale.plots[0].points[0],wanted,"one key adjusts the true offscale coordinate by one small step");
    assert.ok(wanted[1]/10000>offGeometry.range.y);assert.equal(savedOffscale.plots[0].fitAttempted,false);
    assert.deepEqual(savedOffscale.plots[0].points.slice(1),offscale.plots[0].points.slice(1));
    const durable=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:durable});
    assert.deepEqual(await state(cdp),savedOffscale,"the true offscale coordinate survives a production save and restore");
    await call(cdp,"d.querySelector('.offscale-point-hit[data-point=\"0\"]').focus();");
    await key("Enter");await key("ArrowUp");await key("Enter");
    const restoredOffscale=await state(cdp);
    assert.deepEqual(restoredOffscale.plots[0].points[0],[2000,30000],"a new edit can move back up within the valid saved range");
    for(const cancel of ["Escape","focusout"]) {
      await call(cdp,"d.querySelector('.offscale-point-hit[data-point=\"0\"]').focus();");
      await key("Enter");await key("ArrowDown");
      if(cancel==="Escape")await key("Escape");else await call(cdp,"d.getElementById('sourceHandle').focus();");
      assert.deepEqual(await state(cdp),restoredOffscale,"canceling an offscale edit preserves the committed coordinate");
      const afterCancel=await pointLabel();assert.equal(afterCancel.text,"#1 (0.2, 3) 超出圖框");assert.ok(afterCancel.inside);
    }
    offscaleKeyboard.push({width,height,delta,visibleMax:offGeometry.range.y,saved:wanted,restored:restoredOffscale.plots[0].points[0],labelBeforeSave});
    for(const leave of ["Tab","focusout"]) {
      await navigate(cdp,base,{fixture:durableDraft(answer)});
      await call(cdp,"d.getElementById('sourceHandle').focus();");await key("Enter");await key("ArrowRight");
      if(leave==="Tab") {
        await key("Tab");await key("Tab");
        assert.equal(await call(cdp,"return d.activeElement.dataset.point;"),"1","native Tab reaches the next placed point");
      }else await call(cdp,"d.querySelector('.plot-point-hit[data-point=\"1\"]').focus();");
      assert.deepEqual(await state(cdp),answer,"leaving a keyboard operation must not save it");
      const restored=await call(cdp,"const p=d.querySelector('#stageSvg circle.selected');return {x:+p.getAttribute('cx'),y:+p.getAttribute('cy')};"),geometry=await call(cdp,"return w.__newtonApp.getGeometry();");
      const original=G.pixel(geometry,[.2,.2]);assert.ok(Math.hypot(restored.x-original.x,restored.y-original.y)<.01,"focus changes remove the abandoned working point");
      await key("Enter");await key("ArrowRight");await key("Enter");
      const changed=await state(cdp);assert.deepEqual(changed.plots[0].points[0],expected,"the previous source point is untouched");
      assert.deepEqual(changed.plots[0].points[1],[4050,4000],"only the newly focused point is edited");
      evidence.push({width,height,keyboardLeave:leave,first:changed.plots[0].points[0],second:changed.plots[0].points[1]});
    }
  }
  return {label,evidence,jitter,offscaleKeyboard,stationaryClick:true,outsideCancel:true,offscaleClick:true,singleStep:true,shiftStep:true,escape:true};
}
async function flows(cdp,base,label) {
  await viewport(cdp,1280,900,false);await navigate(cdp,base);
  for(const phase of ["collect","plot","conclude"]) {await click(cdp,`[data-phase="${phase}"]`);await click(cdp,"#checkButton");assert.equal(await mode(cdp),"check");}
  await click(cdp,"#submitButton");assert.equal(await mode(cdp),"review");assert.equal(await call(cdp,"return w.__newtonApp.getResult().score;"),0);
  assert.equal(await call(cdp,"return !d.getElementById('editableFooter').hidden;"),false);
  // Collect all twelve observations through actual controls, first with animation then reduced motion.
  await navigate(cdp,base);await choose(cdp,"#role0","force");await choose(cdp,"#role1","mass");await choose(cdp,"#role2","acceleration");
  await setMass(cdp,2);await click(cdp,"#forceDown");await click(cdp,"#forceDown");
  await click(cdp,"#measureButton");assert.equal(await call(cdp,"return w.__newtonApp.getRunning();"),true);
  await delay(1100);assert.equal((await state(cdp)).setups[0].candidate,null,"reading waits for about one metre");
  await waitFor(cdp,"return Boolean(w.__newtonApp.getState().setups[0].candidate);");
  assert.equal((await state(cdp)).setups[0].candidate[2],200);assert.equal((await state(cdp)).groups[0].records.length,0);
  assert.equal(await call(cdp,"return w.__newtonApp.getRunning() && !d.getElementById('recordButton').disabled;"),true,"recording is available while cart is still moving");
  await screenshot(cdp,`${label}-reading-while-moving`);
  await click(cdp,"#recordButton");const position=await cartPosition(cdp);await delay(180);
  assert.ok(await cartPosition(cdp)>position,"recording must not stop or reset the cart");
  assert.equal((await state(cdp)).groups[0].records.length,1);
  await waitFor(cdp,"return !w.__newtonApp.getRunning();");
  await assertCartExited(cdp);assert.equal((await state(cdp)).setups[0].candidate,null,"end of animation cannot create a second reading");
  assert.equal((await state(cdp)).groups[0].records.length,1);await screenshot(cdp,`${label}-cart-exited`);
  await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  for(let i=1;i<6;i++){await click(cdp,"#forceUp");await click(cdp,"#measureButton");await click(cdp,"#recordButton");}
  await click(cdp,'[data-group="1"]');await choose(cdp,"#role0","mass");await choose(cdp,"#role1","force");await choose(cdp,"#role2","acceleration");await setMass(cdp,0);
  for(let i=0;i<6;i++){if(i>0) await click(cdp,"#massUp");if(i===5)await click(cdp,"#massUp");await click(cdp,"#measureButton");await click(cdp,"#recordButton");}
  assert.deepEqual((await state(cdp)).groups,filled().groups);
  await click(cdp,'[data-phase="plot"]');
  for(let graph=0;graph<3;graph++) {
    await click(cdp,`#graphNav [data-graph="${graph}"]`);
    const rows=(await state(cdp)).groups[M.sourceGroup(graph)].records;
    for(let i=0;i<6;i++)await plotRecord(cdp,i,M.expected(graph,rows[i]));
    await choose(cdp,"#fitModel",graph===1?"inverse":"origin");await click(cdp,"#fitButton");
    assert.equal(await call(cdp,"return Boolean(d.querySelector('.fit-curve'));"),true);
    assert.match(await call(cdp,"return d.getElementById('fitResult').textContent;"),/RMSE/);
    await click(cdp,`#meaningChoices input[value="${M.INTERPRETATIONS[graph].answer}"]`);
    assert.equal((await state(cdp)).plots[graph].meaning,M.INTERPRETATIONS[graph].answer);
  }
  // Wrong points are used by the fit and remain recoverable; changing one invalidates the displayed fit.
  await click(cdp,'#graphNav [data-graph="0"]');await plotRecord(cdp,0,[.2,1]);
  assert.equal((await state(cdp)).plots[0].fitAttempted,false);await click(cdp,"#fitButton");
  assert.ok(await call(cdp,"const p=w.__newtonApp.getState().plots[0];return w.NewtonFitting.fit(p.model,w.NewtonFitting.plotted(p)).rmse>.1;"));
  await plotRecord(cdp,0,[.2,.2]);await click(cdp,"#fitButton");
  await click(cdp,'[data-phase="conclude"]');for(let i=0;i<5;i++)await click(cdp,`input[data-conclusion="${i}"][value="${M.QUESTIONS[i].options[0][0]}"]`);
  await click(cdp,"#checkButton");await click(cdp,'[data-check-phase="plot"][data-index="2"]');assert.equal((await state(cdp)).returnToCheck,true);
  const draft=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:draft});assert.equal((await state(cdp)).returnToCheck,true);
  await click(cdp,"#returnCheck");await click(cdp,"#submitButton");assert.equal(await mode(cdp),"review");assert.equal(await call(cdp,"return w.__newtonApp.getResult().score;"),100);
  const complete=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:complete});assert.equal(await mode(cdp),"review");
  await click(cdp,"#referenceButton");assert.equal(await call(cdp,"return d.querySelectorAll('#stageSvg .reference-point').length;"),6);await screenshot(cdp,`${label}-complete-review`);
  // Freeze, reload pending, retry exactly the same reviewed answers.
  await navigate(cdp,base,{fixture:draft});await click(cdp,"#checkButton");await call(cdp,"w.__failFinal=true;");await click(cdp,"#submitButton");assert.equal(await mode(cdp),"frozen");assert.equal(await call(cdp,"return w.__newtonApp.getResult();"),null);
  const pending=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:pending});assert.equal(await mode(cdp),"frozen");await click(cdp,"#retryFinalButton");assert.equal(await mode(cdp),"review");
  await navigate(cdp,base,{fixture:draft});await click(cdp,"#checkButton");await call(cdp,"w.__failFinish=true;");await click(cdp,"#submitButton");assert.equal(await mode(cdp),"committed");await call(cdp,"w.__failFinish=false;");await click(cdp,"#retryFinalButton");assert.equal(await mode(cdp),"review");
  // Mathematical failure restores as an editable answer, then keyboard can change it.
  const bad=filled();bad.plots[1].model="inverse";bad.plots[1].points[0]=[0,0];
  await navigate(cdp,base,{fixture:durableDraft(P.navigate(bad,"plot",1))});assert.match(await call(cdp,"return d.getElementById('fitResult').textContent;"),/大於 0/);
  await call(cdp,"d.getElementById('sourceHandle').focus();");await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter"});await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight",code:"ArrowRight",modifiers:8});await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter"});assert.equal((await state(cdp)).plots[1].fitAttempted,false);
  // Every standalone refresh starts fresh, even with old local checkpoints or denied storage.
  for(const phase of ["collect","check","review"]) {
    await navigate(cdp,base,{fixture:false,denyStorage:true});await click(cdp,"#measureButton");await click(cdp,"#recordButton");
    if(phase!=="collect")await click(cdp,"#checkButton");if(phase==="review")await click(cdp,"#submitButton");
    assert.equal(await call(cdp,"return w.__storageProbes;"),0);await cdp.send("Page.reload",{ignoreCache:true});await delay(100);await ready(cdp);assertFresh(await state(cdp));
  }
  for(const old of [draft,complete,pending,"corrupt"]) {
    await navigate(cdp,base,{fixture:false});await call(cdp,`w.localStorage.setItem('simlab:${slug}:checkpoint',${JSON.stringify(JSON.stringify(old))});`);await cdp.send("Page.reload",{ignoreCache:true});await delay(100);await ready(cdp);assertFresh(await state(cdp));await click(cdp,"#measureButton");assert.ok((await state(cdp)).setups[0].candidate);
  }
  await navigate(cdp,base,{fixture:durableDraft(filled())});await confirmClick(cdp,"#clearAllButton",false);assert.equal((await state(cdp)).groups[0].records.length,6);await confirmClick(cdp,"#clearAllButton",true);assertFresh(await state(cdp));
  const clearedState=await state(cdp),cleared=await call(cdp,"return {...w.__lmsValues};");await navigate(cdp,base,{fixture:cleared});assert.deepEqual(await state(cdp),clearedState);
  await navigate(cdp,base,{fixture:{"cmi.core.lesson_status":"not attempted"}});assertFresh(await state(cdp));assert.equal(JSON.parse(complete["cmi.suspend_data"]).score,100);
  await cdp.send("Emulation.setEmulatedMedia",{features:[]});
  return {result:100,checks:"actual 12-record experiment and 18-point plotting; wrong fit, keyboard, check-edit, clear, SCORM draft/review/pending/committed, fresh standalone and new Moodle attempt"};
}
async function touchMatrix(cdp,base,label,width=390,height=500) {
  const embedded=true,rows=[];
  let s=P.navigate(filled(),"plot",0);s.plots[0].points=s.plots[0].points.map(()=>null);s.plots[0].fitAttempted=false;
  await viewport(cdp,width,height);await navigate(cdp,base,{embedded,fluid:height<500,fixture:durableDraft(s)});
  for(const side of ["left","right","blank"])for(const direction of [-1,1]) {
    await evaluate(cdp,"scrollTo(0,300)");await delay(80);const r=await rect(cdp,"#stage",true);
    const g=await call(cdp,"return w.__newtonApp.getGeometry();",true);
    const x=side==="left"?8:side==="right"?width-8:width/2,start={x,y:side==="blank"?r.y-r.height/2+(g.top+g.bottom)/2:r.y+(direction===1?32:-30)},end={x,y:start.y-direction*60};
    const before=await metrics(cdp,true),trace=[];await dragTouch(cdp,start,end,null,async()=>trace.push(await evaluate(cdp,"scrollY")));const after=await metrics(cdp,true);
    fixed(before,after,"host",`${label} ${side} ${direction}`);assert.ok((after.host.y-before.host.y)*direction>20);assert.ok(trace.every((y,i)=>!i||(y-trace[i-1])*direction>=0));rows.push({name:`${side}-${direction}`,before,after});
  }
  await evaluate(cdp,"scrollTo(0,300)");await delay(100);
  for(const boundary of ["middle","top","bottom"]) {
    await delay(550);await call(cdp,`const p=d.getElementById('controlPanel');p.scrollTop=${boundary==="middle"?"p.scrollHeight/3":boundary==="top"?"0":"p.scrollHeight"};`,true);await delay(70);
    const r=await rect(cdp,"#controlPanel",true),direction=boundary==="top"?-1:1,start={x:width-9,y:r.y+direction*18},end={x:width-9,y:start.y-direction*60};
    const before=await metrics(cdp,true);await dragTouch(cdp,start,end);const after=await metrics(cdp,true);fixed(before,after,"panel",`${label} panel ${boundary}`);
    if(boundary==="middle")assert.ok(after.panel>before.panel);else assert.equal(after.panel,before.panel);rows.push({name:`panel-${boundary}`,before,after});
  }
  for(const graph of [0,1,2]) {
    await click(cdp,`#graphNav [data-graph="${graph}"]`,true);await click(cdp,'[data-select-row="0"]',true);await delay(550);
    const before=await metrics(cdp,true),camera=await call(cdp,"return d.getElementById('stageSvg').getAttribute('viewBox');",true),target=graph===0?[.2,.2]:graph===1?[.5,1.2]:[2,1.2];
    await dragTouch(cdp,await rect(cdp,"#sourceHandle",true),await graphPixel(cdp,target,true),async()=>{
      const preview=await call(cdp,`const m=d.getElementById('magnifier'),s=d.getElementById('stageSvg'),v=d.getElementById('magnifierSvg'),r=m.getBoundingClientRect(),vb=v.viewBox.baseVal;return {visible:!m.hidden,grid:v.querySelectorAll('.grid-major').length,point:v.querySelectorAll('.data-point').length,events:getComputedStyle(m).pointerEvents,camera:s.getAttribute('viewBox'),scale:(r.width-4)/vb.width,focus:[vb.x+vb.width/2,vb.y+vb.height/2],dot:[Number(v.querySelector('.data-point.selected')?.getAttribute('cx')),Number(v.querySelector('.data-point.selected')?.getAttribute('cy'))],overFinger:(()=>{const q=s.querySelector('.data-point.selected'),sr=s.getBoundingClientRect(),x=sr.left+Number(q.getAttribute('cx')),y=sr.top+Number(q.getAttribute('cy'));return x>r.left-18&&x<r.right+18&&y>r.top-18&&y<r.bottom+18;})(),duplicates:[...d.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i)};`,true);
      assert.equal(preview.visible,true);assert.ok(preview.grid>3 && preview.point>=1);assert.equal(preview.events,"none");assert.equal(preview.camera,camera);assert.deepEqual(preview.duplicates,[]);assert.ok(Math.abs(preview.scale-2)<.01);assert.ok(Math.hypot(preview.focus[0]-preview.dot[0],preview.focus[1]-preview.dot[1])<.01);assert.equal(preview.overFinger,false);
      if(graph===1&&width===390)await screenshot(cdp,`${label}-touch-preview`);
    });
    const after=await metrics(cdp,true);fixed(before,after,"drawing",`${label} source-${graph}`);assert.ok(after.pointer.moves>before.pointer.moves && after.pointer.ups>before.pointer.ups && after.pointer.trustedTouch>before.pointer.trustedTouch);assert.equal(after.pointer.cancels,before.pointer.cancels);
    assert.deepEqual((await state(cdp,true)).plots[graph].points[0],G.encoded(target));assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden && !d.getElementById('magnifierSvg').children.length;",true),true);
    const head=await rect(cdp,`.plot-point-hit[data-graph="${graph}"][data-point="0"]`,true),b=await metrics(cdp,true);
    await dragTouch(cdp,head,{x:head.x+(graph===2?-35:35),y:head.y+(graph===0?-24:24)});const a=await metrics(cdp,true);fixed(b,a,"drawing",`${label} placed-${graph}`);assert.notEqual(a.answer,b.answer);assert.equal(a.pointer.cancels,b.pointer.cancels);rows.push({name:`source-point-${graph}`,before,after:a});
  }
  // Cancellation, blur, resize and multi-touch discard only the working gesture.
  let head=await rect(cdp,'.plot-point-hit[data-graph="2"][data-point="0"]',true),before=await metrics(cdp,true);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head)]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x-20,y:head.y+20})]});await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});await delay(60);
  assert.equal((await metrics(cdp,true)).answer,before.answer);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head)]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x-20,y:head.y+20})]});
  const panel=await rect(cdp,"#controlPanel",true),second={x:width-10,y:panel.y};
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head),touchPoint(second,2)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint(head),touchPoint({x:second.x,y:second.y-30},2)]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await delay(80);
  const multiAfter=await metrics(cdp,true);fixed(before,multiAfter,"panel",`${label} multi-touch handoff`);assert.ok(multiAfter.panel>before.panel);assert.equal(multiAfter.answer,before.answer);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);rows.push({name:"multi-touch-handoff",before,after:multiAfter});
  return rows;
}
async function specialTouch(cdp,base,label,width,kind) {
  await viewport(cdp,width,500);
  if(kind==="locked") {
    const pending=environment({durable:durableDraft(filled())});pending.c.check();pending.flags.writeFail="cmi.core.score.raw";pending.c.submit();
    const checks=[];
    for(const fixture of [finishedData(filled()),pending.durable]) {
      await navigate(cdp,base,{embedded:true,fixture});
      assert.equal(await call(cdp,"return [...d.querySelectorAll('#pointHandles button,#sourceHandle')].every(e=>e.hidden);",true),true);
      for(const direction of [-1,1]) {
        await evaluate(cdp,"scrollTo(0,300)");await delay(100);const start=await graphPixel(cdp,[.2,.2],true),before=await metrics(cdp,true);
        await dragTouch(cdp,start,{x:start.x,y:start.y-direction*45});const after=await metrics(cdp,true);
        fixed(before,after,"host",`${label} locked target`);assert.ok((after.host.y-before.host.y)*direction>15);checks.push({before,after});
      }
    }
    return {name:"review-and-pending-targets-return-to-host",checks};
  }
  if(kind==="cancel") {
    const checks=[];
    for(const reason of ["outside","blur","resize","lost-capture"]) {
      await viewport(cdp,width,500);await navigate(cdp,base,{embedded:true,fixture:durableDraft(P.navigate(filled(),"plot",2))});
      const head=await rect(cdp,'.plot-point-hit[data-point="0"]',true),before=await state(cdp,true);
      await call(cdp,"d.getElementById('stage').addEventListener('pointerdown',e=>{w.__activeTestPointer={id:e.pointerId,target:e.target};},{once:true});",true);
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head)]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x-30,y:head.y+20})]});
      assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),false);
      if(reason==="outside")await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:9,y:head.y})]});
      if(reason==="blur")await call(cdp,"w.dispatchEvent(new w.Event('blur'));",true);
      if(reason==="resize")await viewport(cdp,width+10,500);
      if(reason==="lost-capture"){await call(cdp,"w.__activeTestPointer.target.releasePointerCapture(w.__activeTestPointer.id);",true);await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x-29,y:head.y+20})]});}
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await delay(120);
      assert.deepEqual(await state(cdp,true),before);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden && !d.getElementById('magnifierSvg').children.length;",true),true);checks.push(reason);
    }
    return {name:"working-drag-rollback",checks};
  }
  if(kind==="offscale") {
    const s=P.navigate(filled(),"plot",1);s.plots[1].points[0]=[7000,30000];s.plots[1].points[1]=[7000,30000];s.plots[1].fitAttempted=false;
    await navigate(cdp,base,{embedded:true,fixture:durableDraft(s)});await click(cdp,'[data-select-row="1"]',true);await delay(250);
    const head=await rect(cdp,'.offscale-point-hit[data-point="1"]',true),before=await metrics(cdp,true);
    await dragTouch(cdp,head,await graphPixel(cdp,[.75,.8],true));const after=await metrics(cdp,true);
    fixed(before,after,"drawing",`${label} offscale`);assert.deepEqual((await state(cdp,true)).plots[1].points[0],[7000,30000]);assert.deepEqual((await state(cdp,true)).plots[1].points[1],[7500,8000]);assert.ok(after.pointer.trustedTouch>before.pointer.trustedTouch);assert.equal(after.pointer.cancels,before.pointer.cancels);
    return {name:"offscale-overlap",before,after};
  }
  await navigate(cdp,base,{embedded:true});await call(cdp,"w.__rangeEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])d.getElementById('forceRange').addEventListener(type,e=>w.__rangeEvents.push({type,trusted:e.isTrusted,pointer:e.pointerType}));",true);const r=await rect(cdp,"#forceRange",true,true);await delay(250);const before=await metrics(cdp,true);
  await dragTouch(cdp,{x:r.x,y:r.y},{x:r.x+r.width/3,y:r.y});const after=await metrics(cdp,true);
  fixed(before,after,"drawing",`${label} force-range`);assert.notEqual(after.answer,before.answer);const events=await call(cdp,"return w.__rangeEvents;",true);assert.ok(events.some(e=>e.type==="pointerup")&&events.some(e=>e.type==="pointermove"));assert.ok(events.every(e=>e.trusted&&e.pointer==="touch"&&e.type!=="pointercancel"));return {name:"force-range",before,after,events};
}
async function main() {
  fs.mkdirSync(artifactDir,{recursive:true});sourceParity();
  const tempRoot=fs.realpathSync(os.tmpdir()),servers=[];let profile,packageDirectory,chrome,cdp,failure;
  const report={activity:slug,engine:"Chrome/CDP trusted touch",viewports:{},gestures:{},flows:{},motion:{},interpretation:{},settings:{},interaction:{},errors:[]};
  try {
    const browser=findBrowser();assert.ok(browser,"Chrome is required");
    const extracted=buildAndExtractPackage(tempRoot,{slug,packagePrefix:"simlab-newton-package-",packageNamePattern:/^simlab-newton-package-[A-Za-z0-9]+$/});packageDirectory=extracted.packageDirectory;
    for(const name of sourceParity().concat(`${slug}/index.html`))assert.equal(fs.readFileSync(path.join(root,"sim",name),"utf8"),fs.readFileSync(path.join(packageDirectory,name),"utf8"),`package parity: ${name}`);
    profile=fs.mkdtempSync(path.join(tempRoot,"simlab-newton-chrome-"));
    chrome=spawn(browser,["--headless=new","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0",`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","--disable-background-networking","--disable-component-update","--disable-sync","about:blank"],{stdio:["ignore","ignore","pipe"]});
    let stderr="";chrome.stderr.on("data",b=>stderr=(stderr+b).slice(-3000));const port=await devToolsPort(profile,chrome).catch(e=>{e.message+=stderr;throw e;});let targetId;
    async function freshPage(){if(cdp){await cdp.send("Target.closeTarget",{targetId});cdp.close();}const {body:t}=await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:"PUT"});targetId=t.id;cdp=new CdpClient(t.webSocketDebuggerUrl,WebSocket,15000);await cdp.send("Page.enable");await cdp.send("Runtime.enable");await cdp.send("Page.bringToFront");await preload(cdp);cdp.on("Runtime.exceptionThrown",e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));}
    await freshPage();report.browser=await cdp.send("Browser.getVersion");
    for(const [label,directory] of [["source",path.join(root,"sim")],["package",packageDirectory]]) {
      const server=createServer(directory);servers.push(server);await listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;await freshPage();
      console.log(`newton browser: ${label} layout / flow`);
      if(process.argv.includes("--interaction")) {report.interaction[label]=await interactionChecks(cdp,base,label);continue;}
      if(process.argv.includes("--interpretation")) {report.interpretation[label]=await interpretationChecks(cdp,base,label);report.flows[label]=await flows(cdp,base,label);continue;}
      if(process.argv.includes("--motion")) {report.motion[label]=await motionChecks(cdp,base,label);report.flows[label]=await flows(cdp,base,label);continue;}
      if(!process.argv.includes("--touch"))report.viewports[label]=await visualMatrix(cdp,base,label);
      if(process.argv.includes("--smoke"))break;
      if(process.argv.includes("--settings")) {report.settings[label]=await settingsChecks(cdp,base,label);report.flows[label]=await flows(cdp,base,label);continue;}
      if(process.argv.includes("--short")) {await freshPage();report.gestures[`${label}-320-short`]=await touchMatrix(cdp,base,`${label}-320-short`,320,400);continue;}
      if(!process.argv.includes("--touch")) {report.interaction[label]=await interactionChecks(cdp,base,label);report.settings[label]=await settingsChecks(cdp,base,label);report.motion[label]=await motionChecks(cdp,base,label);report.interpretation[label]=await interpretationChecks(cdp,base,label);report.flows[label]=await flows(cdp,base,label);}
      for(const width of [390,320]) {await freshPage();console.log(`newton browser: ${label} trusted touch ${width}`);report.gestures[`${label}-${width}`]=await touchMatrix(cdp,base,`${label}-${width}`,width);
        // Isolate later scenarios from Chromium's multi-touch gesture sequence and stale frame hit testing.
        for(const kind of ["offscale","range","locked","cancel"]) {await freshPage();report.gestures[`${label}-${width}`].push(await specialTouch(cdp,base,`${label}-${width}`,width,kind));}}
      if(!process.argv.includes("--touch")) {await freshPage();report.gestures[`${label}-320-short`]=await touchMatrix(cdp,base,`${label}-320-short`,320,400);}
    }
    assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(artifactDir,process.argv.includes("--interaction")?"interaction-report.json":process.argv.includes("--settings")?"settings-report.json":process.argv.includes("--short")?"short-report.json":process.argv.includes("--motion")?"motion-report.json":process.argv.includes("--interpretation")?"interpretation-report.json":"report.json"),JSON.stringify(report,null,2));
  } catch(e) {failure=e;if(cdp)report.failureUI=await evaluate(cdp,"(()=>{const w=document.getElementById('activity')?.contentWindow||window;return {text:w.document.body.innerText,mode:w.__newtonApp?.getMode(),state:w.__newtonApp?.getState()};})()").catch(()=>null);fs.writeFileSync(path.join(artifactDir,"failure.json"),JSON.stringify({message:e.stack,report},null,2));if(cdp)await screenshot(cdp,"failure").catch(()=>{});}
  try {if(chrome)await stopChrome(chrome,cdp);cdp?.close();for(const server of servers)await closeServer(server);for(const dir of [profile,packageDirectory].filter(Boolean)){validateOwnedDirectory(dir,tempRoot,/^simlab-newton-(?:chrome|package)-[A-Za-z0-9]+$/,"Newton test artifact");fs.rmSync(dir,{recursive:true,force:false});}}catch(e){failure ||=e;}
  if(failure)throw failure;console.log("newton source/package browser checks passed");
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={sourceParity,main};
