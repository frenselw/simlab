#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const { CdpClient, buildAndExtractPackage, createServer, listenServer, devToolsPort, fetchJson, evaluate, delay, findBrowser, stopChrome, closeServer, validateOwnedDirectory } = require("./position-time-browser-regression.js");
const G = require("../sim/force-equilibrium-diagram-lab/generator.js"), P = require("../sim/force-equilibrium-diagram-lab/persistence.js"), S = require("../sim/force-equilibrium-diagram-lab/scoring.js");
const root = path.resolve(__dirname, ".."), slug = P.ACTIVITY, artifactDir = path.join(root, "output/playwright/force-equilibrium");
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
    try { if (await call(cdp, "return d.readyState==='complete' && Boolean(w.__equilibriumApp);", embedded)) return; } catch (_) {}
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
  const src = `/${slug}/index.html?${params}`;
  const url = options.embedded ? `${base}/__embed-scroll-test.html?src=${encodeURIComponent(src)}` : `${base}${src}`;
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
  const [message] = await Promise.all([dialog, press()]); assert.match(message, /全部五題答案/); await delay(50);
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
  const local = await call(cdp, `const app=w.__equilibriumApp,p=d.getElementById('controlPanel'),s=d.getElementById('stage'),r=s.getBoundingClientRect(),v=w.visualViewport;return {docX:w.scrollX,docY:w.scrollY,docRange:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.scrollTop,panelRange:p.scrollHeight-p.clientHeight,stage:[r.left,r.top,r.width,r.height],view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],answer:JSON.stringify(app.getState()?.answers),pointer:app.getPointerDiagnostics(),mode:app.getMode()};`, embedded);
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
async function visualMatrix(cdp, base, label) {
  const evidence = [];
  for (const [width, height] of [[320,500],[390,500],[390,600],[390,844],[768,900],[1024,768],[1280,900],[740,360],[320,400]]) {
    await viewport(cdp,width,height); await navigate(cdp,base);
    const result = await call(cdp, `const p=d.getElementById('controlPanel'),s=d.getElementById('stage');return {width:w.innerWidth,height:w.innerHeight,overflow:d.documentElement.scrollWidth-w.innerWidth,range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.clientHeight,stage:s.clientHeight,bodyFont:getComputedStyle(p).fontSize};`);
    assert.ok(result.overflow <= 1 && result.range <= 1, `${label} ${width}×${height}: bounded document`);
    assert.ok(result.panel >= 70, `${label} ${width}×${height}: reachable controls`);
    for (let i=0;i<5;i++) {
      await click(cdp, `#questionNav button:nth-child(${i+1})`);
      assert.equal(await call(cdp, "return w.__equilibriumApp.getMode();"), "edit");
    }
    evidence.push(result);
    if (width===320 || width===1280 || (width===390 && height===844)) await screenshot(cdp,`${label}-${width}x${height}`);
  }
  // CSS reflow at a 200% zoom equivalent viewport, plus real visual-viewport scale.
  await viewport(cdp,390,600); await navigate(cdp,base); await cdp.send("Emulation.setPageScaleFactor",{pageScaleFactor:2});
  assert.equal(await call(cdp,"return w.visualViewport.scale;"),2);
  await screenshot(cdp,`${label}-200-percent`);
  await cdp.send("Emulation.setPageScaleFactor",{pageScaleFactor:1});
  return evidence;
}
async function touchMatrix(cdp, base, label, width=390, height=500) {
  const embedded = true, rows = [];
  await viewport(cdp,width,height); await navigate(cdp,base,{embedded});
  for (const side of ["left","right","blank"]) for (const direction of [-1,1]) {
    await evaluate(cdp,"scrollTo(0,300)"); await delay(60);
    const stage=await rect(cdp,"#stage",true); const x=side==="left"?8:side==="right"?width-8:width/2;
    const start={x,y:stage.y+(direction===1?35:-30)},end={x,y:start.y-direction*65};
    const before=await metrics(cdp,true), hostTrace=[];
    await dragTouch(cdp,start,end,null,async()=>hostTrace.push(await evaluate(cdp,"scrollY"))); const after=await metrics(cdp,true);
    fixed(before,after,"host",`${label}-${side}-${direction}`); assert.ok((after.host.y-before.host.y)*direction>20,`${side} scrolls host in both directions`);
    assert.ok(hostTrace.every((y,i)=>i===0||(y-hostTrace[i-1])*direction>=0),"host follows finger travel without iframe-coordinate oscillation");
    assert.ok(Math.abs((after.host.frame[1]-before.host.frame[1])+(after.host.y-before.host.y))<1);
    rows.push({name:`${side}-${direction}`,before,after,hostTrace});
  }
  await evaluate(cdp,"scrollTo(0,300)"); await delay(60);
  for (const boundary of ["middle","top","bottom"]) {
    await delay(550);
    await call(cdp,`const p=d.getElementById('controlPanel');p.scrollTop=${boundary==="middle"?"p.scrollHeight/3":boundary==="top"?"0":"p.scrollHeight"};`,true);
    await delay(60);
    const p=await rect(cdp,"#controlPanel",true); const direction=boundary==="top"?-1:1;
    const start={x:width-9,y:p.y+direction*20},end={x:width-9,y:start.y-direction*65};
    const before=await metrics(cdp,true); await dragTouch(cdp,start,end); const after=await metrics(cdp,true);
    fixed(before,after,"panel",`${label}-panel-${boundary}`);
    if(boundary==="middle") assert.ok(after.panel>before.panel); else assert.equal(after.panel,before.panel,`${label}: panel ${boundary} boundary`);
    rows.push({name:`panel-${boundary}`,before,after});
  }
  // Every kind, plus repeated T and F: use the actual add controls and stable origin/head targets.
  await navigate(cdp,base,{embedded});
  for (const [i,kind] of [0,1,2,3,4,3,4].entries()) {
    await click(cdp,`[data-add-kind="${kind}"]`,true);
    const start=await rect(cdp,".origin-hit",true), a=(i*47+25)*Math.PI/180;
    const end={x:start.x+Math.cos(a)*66,y:start.y-Math.sin(a)*66};
    const before=await metrics(cdp,true), camera=await call(cdp,"return d.getElementById('stageSvg').getAttribute('viewBox');",true);
    await dragTouch(cdp,start,end,async()=>{
      const preview=await call(cdp,`const m=d.getElementById('magnifier'),s=d.getElementById('stageSvg'),v=d.getElementById('magnifierSvg');return {visible:!m.hidden,scene:v.querySelectorAll('.object').length,focus:!!v.querySelector('[data-preview-focus]'),ids:v.querySelectorAll('[id]').length,events:getComputedStyle(m).pointerEvents,camera:s.getAttribute('viewBox')};`,true);
      assert.deepEqual(preview,{visible:true,scene:1,focus:true,ids:0,events:"none",camera});
      if(i===3 && width===390) await screenshot(cdp,`${label}-touch-preview`);
    });
    const after=await metrics(cdp,true); fixed(before,after,"drawing",`${label}-draw-${i}`);
    assert.notEqual(after.answer,before.answer); assert.ok(after.pointer.move>before.pointer.move && after.pointer.up>before.pointer.up && after.pointer.trustedTouch>before.pointer.trustedTouch);
    assert.equal(after.pointer.cancel,before.pointer.cancel);
    assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden && !d.getElementById('magnifierSvg').children.length;",true),true);
    const head=await rect(cdp,`.force-head-hit[data-index="${i}"]`,true); const b=await metrics(cdp,true);
    await dragTouch(cdp,head,{x:head.x+16,y:head.y-18}); const c=await metrics(cdp,true); fixed(b,c,"drawing",`${label}-head-${i}`); assert.equal(c.pointer.cancel,b.pointer.cancel);
    rows.push({name:`kind-${kind}-instance-${i}`,before,after});
  }
  // Cancel must roll back a working stroke.
  let head=await rect(cdp,'.force-head-hit[data-index="0"]',true), before=await metrics(cdp,true);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x+20,y:head.y+15})]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]}); await delay(60);
  assert.equal((await metrics(cdp,true)).answer,before.answer); assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);
  // A second finger on another force cannot modify that force or steal the primary gesture.
  head=await rect(cdp,'.force-head-hit[data-index="0"]',true); const second=await rect(cdp,'.force-head-hit[data-index="1"]',true);
  const original=await call(cdp,"return w.__equilibriumApp.getState();",true);
  const twoFingerBefore=await metrics(cdp,true);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head),touchPoint(second,2)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x+15,y:head.y}),touchPoint({x:second.x+15,y:second.y+10},2)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[touchPoint({x:head.x+15,y:head.y})]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]}); await delay(80);
  const changed=await call(cdp,"return w.__equilibriumApp.getState();",true),family=G.generate(original.seed).order[original.current];
  assert.deepEqual(changed.answers[family][1],original.answers[family][1]);
  const twoFingerAfter=await metrics(cdp,true);
  fixed(twoFingerBefore,twoFingerAfter,"drawing",`${label}-second-force`);
  assert.ok(twoFingerAfter.pointer.up>twoFingerBefore.pointer.up);
  assert.equal(twoFingerAfter.pointer.cancel,twoFingerBefore.pointer.cancel);
  rows.push({name:"second-force",before:twoFingerBefore,after:twoFingerAfter});
  // Independent host/panel second-touch continuations cancel the first drag before handoff.
  for(const owner of ["host","panel"]) {
    await call(cdp,"d.getElementById('controlPanel').scrollTop=0;",true); await evaluate(cdp,"scrollTo(0,300)");
    head=await rect(cdp,'.force-head-hit[data-index="0"]',true); const box=await rect(cdp,owner==="host"?"#stage":"#controlPanel",true);
    const p={x:width-8,y:box.y+25}; before=await metrics(cdp,true);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint(head)]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x+12,y:head.y})]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touchPoint({x:head.x+12,y:head.y}),touchPoint(p,2)]});
    for(let j=1;j<=8;j++) { await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touchPoint({x:head.x+12,y:head.y}),touchPoint({x:p.x,y:p.y-j*7},2)]}); await delay(12); }
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]}); await delay(100);
    const after=await metrics(cdp,true); fixed(before,after,owner,`${label}-second-${owner}`);
    assert.ok(owner==="host"?after.host.y>before.host.y:after.panel>before.panel,`${owner} second touch retains owner`);
    rows.push({name:`second-${owner}`,before,after});
  }
  // Locks remove the interaction at old head footprints immediately, before a reload.
  await evaluate(cdp,"scrollTo(0,300)"); await call(cdp,"d.getElementById('controlPanel').scrollTop=0;",true);
  const oldHead=await rect(cdp,'.force-head-hit[data-index="0"]',true);
  await click(cdp,"#checkButton",true); await click(cdp,"#submitButton",true);
  assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();",true),"review");
  assert.equal(await call(cdp,"return Array.from(d.querySelectorAll('.force-head-hit,.origin-hit')).every(e=>e.hidden);",true),true);
  before=await metrics(cdp,true); await dragTouch(cdp,oldHead,{x:oldHead.x,y:oldHead.y-55}); const after=await metrics(cdp,true); fixed(before,after,"host",`${label}-locked-footprint`); assert.ok(after.host.y>before.host.y);
  rows.push({name:"locked-footprint",before,after});
  for(const mode of ["frozen","committed"]) {
    const fixture={"cmi.core.lesson_status":"incomplete","cmi.suspend_data":JSON.stringify({version:1,activity:slug,kind:"draft",answer:P.draft(original)})};
    await navigate(cdp,base,{embedded,fixture});
    const old=await rect(cdp,'.force-head-hit[data-index="0"]',true);
    await call(cdp,mode==="frozen"?"w.__failFinal=true;":"w.__failFinish=true;",true);
    await click(cdp,"#checkButton",true);await click(cdp,"#submitButton",true);
    assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();",true),mode);
    assert.equal(await call(cdp,"return Array.from(d.querySelectorAll('.force-head-hit,.origin-hit')).every(e=>e.hidden);",true),true);
    const b=await metrics(cdp,true);await dragTouch(cdp,old,{x:old.x,y:old.y-55});const a=await metrics(cdp,true);
    fixed(b,a,"host",`${label}-${mode}-footprint`);assert.ok(a.host.y>b.host.y);
    rows.push({name:`${mode}-footprint`,before:b,after:a});
  }
  return rows;
}
async function clearAllFlows(cdp,base,label) {
  for (const [width,height] of [[390,600],[1280,900]]) for (const standalone of [false,true]) {
    await viewport(cdp,width,height); await navigate(cdp,base,{fixture:standalone?false:undefined});
    assert.equal(await call(cdp,"return d.getElementById('clearAllButton').disabled;"),true);
    for (let position=0;position<5;position++) {
      await click(cdp,`#questionNav button:nth-child(${position+1})`);await click(cdp,`[data-add-kind="${position}"]`);
      if(position===0) { await click(cdp,'[data-adjust="ccw"]');await click(cdp,'#confirmDirection'); }
    }
    const before=await call(cdp,"return w.__equilibriumApp.getState();");
    await confirmClick(cdp,"#clearAllButton",false,width===390);
    assert.deepEqual(await call(cdp,"return w.__equilibriumApp.getState();"),before,"cancelling reset keeps every answer");
    if(width===1280) await click(cdp,"#checkButton");
    const selector=width===1280?"#clearAllCheckButton":"#clearAllButton";
    await screenshot(cdp,`${label}-clear-all-${standalone?'standalone':'lms'}-${width}`);
    await confirmClick(cdp,selector,true,width===390);
    const after=await call(cdp,"return w.__equilibriumApp.getState();");
    assert.deepEqual(after,P.fresh(before.seed),"clear all retains the paper and returns to question one");
    assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"edit");
    assert.ok(await call(cdp,"return d.getElementById('undoButton').disabled&&d.getElementById('redoButton').disabled&&d.getElementById('magnifier').hidden;"));
    if(!standalone) {
      const fixture=await call(cdp,"return w.__lmsValues;");
      assert.equal(fixture["cmi.core.lesson_status"],"incomplete");assert.equal(fixture["cmi.core.score.raw"],undefined);
      await navigate(cdp,base,{fixture});assert.deepEqual(await call(cdp,"return w.__equilibriumApp.getState();"),after);
    }
    await click(cdp,'[data-add-kind="0"]');await click(cdp,"#checkButton");await click(cdp,"#submitButton");
    assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"review");
    assert.equal(await call(cdp,"return [d.getElementById('clearAllButton'),d.getElementById('clearAllCheckButton')].every(e=>e.disabled&&e.getClientRects().length===0);"),true);
  }
}
async function flows(cdp,base,label) {
  await clearAllFlows(cdp,base,label);
  const labelSizes = [];
  await viewport(cdp,390,600); await navigate(cdp,base);
  await click(cdp,"#checkButton");
  assert.ok(await call(cdp,"return d.getElementById('controlPanel').clientHeight > 300;"),"check panel uses the space released by the stage");
  await click(cdp,"#submitButton");
  assert.equal(await call(cdp,"return w.__equilibriumApp.getResult().score;"),0);
  assert.equal(await call(cdp,"return w.__lmsValues['cmi.core.lesson_status'];"),"failed");
  // Keyboard answer, draft reload and pending retry through the production UI.
  await navigate(cdp,base); await click(cdp,'[data-add-kind="0"]');
  await call(cdp,"d.querySelector('.origin-hit').focus();");
  for(const key of ["Enter","ArrowLeft","Enter"]) {
    await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key,code:key,windowsVirtualKeyCode:{Enter:13,ArrowLeft:37}[key]});
    await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key,code:key,windowsVirtualKeyCode:{Enter:13,ArrowLeft:37}[key]});
  }
  let state=await call(cdp,"return w.__equilibriumApp.getState();"); assert.ok(state.answers.some(a=>a.some(r=>r[1]===10)));
  let fixture=await call(cdp,"return w.__lmsValues;"); await navigate(cdp,base,{fixture}); assert.deepEqual(await call(cdp,"return w.__equilibriumApp.getState();"),state);
  await click(cdp,"#checkButton"); await call(cdp,"w.__failFinal=true;"); await click(cdp,"#submitButton");
  assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"frozen");
  assert.equal(await call(cdp,"return d.getElementById('scorePanel').textContent;"),"-- · 成績尚未確認");
  fixture=await call(cdp,"return w.__lmsValues;"); await navigate(cdp,base,{fixture}); assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"frozen");
  await click(cdp,"#retryFinalButton"); assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"review");
  fixture=await call(cdp,"return w.__lmsValues;"); await navigate(cdp,base,{fixture}); assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"review");
  const originalReview=await call(cdp,"return {answer:w.__equilibriumApp.getState(),result:w.__equilibriumApp.getResult(),arrows:d.querySelectorAll('#stageSvg [data-arrow]').length};");
  await click(cdp,"#referenceButton");
  assert.ok(await call(cdp,"return d.querySelectorAll('#stageSvg [data-arrow]').length;" )>originalReview.arrows);
  await click(cdp,"#referenceButton");
  assert.deepEqual(await call(cdp,"return {answer:w.__equilibriumApp.getState(),result:w.__equilibriumApp.getResult(),arrows:d.querySelectorAll('#stageSvg [data-arrow]').length};"),originalReview,"reference toggle never changes the recorded answer");
  // A submitted ideal set exercises all scenes and their readable reference labels.
  state=P.fresh(21); state.answers=G.generate(21).questions.map(q=>q.expected.map(f=>[f.kind,Math.round(f.angle*10)%3600,620]));
  const result=S.score(state), snapshot={version:1,activity:slug,kind:"review",answer:P.review(state),score:result.score,passed:result.passed};
  fixture={"cmi.core.lesson_status":"passed","cmi.core.score.raw":"100","cmi.suspend_data":JSON.stringify(snapshot)};
  for(const [width,height] of [[390,600],[1024,768],[1280,900]]) {
    await viewport(cdp,width,height); await navigate(cdp,base,{fixture});
    for(let position=0;position<5;position++) {
      await click(cdp,`#questionNav button:nth-child(${position+1})`);
      const family=G.generate(21).questions[G.generate(21).order[position]].family;
      await screenshot(cdp,`${label}-${family}-${width}`);
      const labels=await call(cdp,`const stage=d.getElementById('stage').getBoundingClientRect();return Array.from(d.querySelectorAll('#stageSvg .force-label')).map(t=>{const r=t.getBoundingClientRect();return {inside:r.left>=stage.left&&r.right<=stage.right&&r.top>=stage.top&&r.bottom<=stage.bottom,size:parseFloat(getComputedStyle(t).fontSize)};});`);
      assert.ok(labels.every(l=>l.inside&&(width===390?l.size===18:l.size>=32)), "force labels fit at the original phone size and enlarged desktop size");
      assert.equal(await call(cdp,"return d.getElementById('stageSvg').textContent.includes('重心');"),false);
      labelSizes.push({width,family,sizes:labels.map(l=>l.size)});
    }
  }
  // The three-push variant has five simultaneous force labels on phone and desktop.
  let threePushSeed=0;
  while(G.generate(threePushSeed).questions[4].params.count!==3) threePushSeed++;
  state=P.fresh(threePushSeed);
  state.answers=G.generate(threePushSeed).questions.map(q=>q.expected.map(f=>[f.kind,Math.round(f.angle*10)%3600,620]));
  fixture={"cmi.core.lesson_status":"passed","cmi.core.score.raw":"100","cmi.suspend_data":JSON.stringify({...snapshot,answer:P.review(state)})};
  for(const [width,height] of [[390,600],[1024,768],[1280,900]]) {
    await viewport(cdp,width,height);await navigate(cdp,base,{fixture});
    await click(cdp,`#questionNav button:nth-child(${G.generate(threePushSeed).order.indexOf(4)+1})`);
    assert.equal(await call(cdp,"return d.querySelectorAll('#stageSvg .force-label').length;"),5);
    assert.ok(await call(cdp,"const edge=d.getElementById('motionLabel').getBoundingClientRect().bottom;return [...d.querySelectorAll('#stageSvg .rod-label')].every(e=>e.getBoundingClientRect().top>edge);"),"rod labels clear the motion caption");
    await screenshot(cdp,`${label}-E-three-push-${width}`);
  }
  // Moving background changes while the object's geometry and authoritative answer stay fixed.
  await viewport(cdp,390,600); await navigate(cdp,base);
  const generated=G.generate(21), movingPosition=generated.order.findIndex(i=>generated.questions[i].motion);
  await click(cdp,`#questionNav button:nth-child(${movingPosition+1})`);
  const readMotion=()=>call(cdp,"return {object:d.querySelector('#stageSvg .object').getAttribute('transform'),answer:JSON.stringify(w.__equilibriumApp.getState()),offset:d.querySelector('[data-background=ground]').getAttribute('transform')};");
  const b=await readMotion(); await delay(220); const a=await readMotion(); assert.equal(a.object,b.object);assert.equal(a.answer,b.answer);assert.notEqual(a.offset,b.offset);
  assert.equal(await call(cdp,"return d.querySelector('[data-background=far]');"),null,"the old upright scenery is removed");
  await click(cdp,"#pauseButton");const pause=await readMotion();await delay(180);assert.deepEqual(await readMotion(),pause);
  await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});await navigate(cdp,base);assert.equal(await call(cdp,"return w.__equilibriumApp.getAnimation().paused;"),true);
  await cdp.send("Emulation.setEmulatedMedia",{features:[]});
  // Standalone refresh really navigates a fresh document, without an LMS fixture.
  // Seed an old finished checkpoint to reproduce the previously trapped learner.
  await navigate(cdp,base,{fixture:false});
  const checkpointKey=`simlab:${slug}:checkpoint`, oldCheckpoint=JSON.stringify(fixture);
  await call(cdp,`w.localStorage.setItem(${JSON.stringify(checkpointKey)},${JSON.stringify(oldCheckpoint)});`);
  const freshLocal=async()=>{
    await cdp.send("Page.reload",{ignoreCache:true});await delay(120);await ready(cdp);
    const local=await call(cdp,"return {mode:w.__equilibriumApp.getMode(),answers:w.__equilibriumApp.getState().answers,result:w.__equilibriumApp.getResult(),hasRefreshHint:d.body.innerText.includes('獨立練習：重新整理')};");
    assert.equal(local.mode,"edit");assert.ok(local.answers.every(a=>a.length===0));assert.equal(local.result,null);assert.equal(local.hasRefreshHint,false);
    assert.equal(await call(cdp,`return w.localStorage.getItem(${JSON.stringify(checkpointKey)});`),oldCheckpoint,"legacy evidence is ignored, not overwritten");
  };
  await freshLocal();
  await click(cdp,'[data-add-kind="0"]');await freshLocal();
  await click(cdp,'[data-add-kind="1"]');await click(cdp,"#checkButton");await click(cdp,"#submitButton");
  assert.equal(await call(cdp,"return w.__equilibriumApp.getMode();"),"review");
  assert.equal(await call(cdp,"return d.querySelectorAll('.origin-hit:not([hidden]),.force-head-hit:not([hidden])').length;"),0);
  await freshLocal();
  // Larger desktop geometry must still use the same visible arrow tip as its hit target.
  await viewport(cdp,1280,900);await click(cdp,'[data-add-kind="0"]');
  const origin=await rect(cdp,'.origin-hit');
  for(const [type,x,y,buttons] of [["mousePressed",origin.x,origin.y,1],["mouseMoved",origin.x+160,origin.y-90,1],["mouseReleased",origin.x+160,origin.y-90,0]])
    await cdp.send("Input.dispatchMouseEvent",{type,x,y,button:"left",buttons,clickCount:1});
  const tip=await rect(cdp,'.force-head-hit[data-index="0"]');
  const displayed=await call(cdp,"const c=d.querySelector('.student-arrows circle'),s=d.getElementById('stage').getBoundingClientRect();return {x:Number(c.getAttribute('cx'))+s.left,y:Number(c.getAttribute('cy'))+s.top};");
  assert.ok(Math.hypot(tip.x-displayed.x,tip.y-displayed.y)<.1,"desktop tip and target agree after drawing");
  const beforeEdit=await call(cdp,"return w.__equilibriumApp.getState().answers;");
  for(const [type,x,y,buttons] of [["mousePressed",tip.x,tip.y,1],["mouseMoved",tip.x-40,tip.y-40,1],["mouseReleased",tip.x-40,tip.y-40,0]])
    await cdp.send("Input.dispatchMouseEvent",{type,x,y,button:"left",buttons,clickCount:1});
  assert.notDeepEqual(await call(cdp,"return w.__equilibriumApp.getState().answers;"),beforeEdit,"desktop arrow editing still records the changed direction");
  return {checks:"clear-all cancel/confirm/reload/lock in standalone and LMS, blank, partial, keyboard, Moodle draft/pending/review, fresh standalone reload with legacy checkpoint, desktop drawing, reference scenes and motion passed",labelSizes};
}
async function main() {
  fs.mkdirSync(artifactDir,{recursive:true}); sourceParity();
  const tempRoot=fs.realpathSync(os.tmpdir()),servers=[];let profile,packageDirectory,chrome,cdp,failure;
  const report={activity:slug,engine:"Chrome / CDP trusted touch",viewports:{},gestures:{},flows:{},errors:[]};
  try {
    const browser=findBrowser();if(!browser)throw new Error("Chrome is required");
    const extracted=buildAndExtractPackage(tempRoot,{slug,packagePrefix:"simlab-equilibrium-package-",packageNamePattern:/^simlab-equilibrium-package-[A-Za-z0-9]+$/});packageDirectory=extracted.packageDirectory;
    profile=fs.mkdtempSync(path.join(tempRoot,"simlab-equilibrium-chrome-"));
    chrome=spawn(browser,["--headless=new","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0",`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","--disable-background-networking","--disable-component-update","--disable-sync","about:blank"],{stdio:["ignore","ignore","pipe"]});
    let stderr="";chrome.stderr.on("data",b=>{stderr=(stderr+b).slice(-3000);});
    const port=await devToolsPort(profile,chrome).catch(e=>{e.message+=stderr;throw e;});
    let targetId;
    async function freshPage() {
      if(cdp) { await cdp.send("Target.closeTarget",{targetId});cdp.close(); }
      const {body:target}=await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:"PUT"});targetId=target.id;
      cdp=new CdpClient(target.webSocketDebuggerUrl,WebSocket,15000);
      await cdp.send("Page.enable");await cdp.send("Runtime.enable");await cdp.send("Page.bringToFront");await preload(cdp);
      cdp.on("Runtime.exceptionThrown",e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
    }
    await freshPage();
    report.browser=await cdp.send("Browser.getVersion");
    for(const [label,directory] of [["source",path.join(root,"sim")],["package",packageDirectory]]) {
      const server=createServer(directory);servers.push(server);await listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;
      if(label==="package") await freshPage();
      console.log(`equilibrium browser: ${label} layout and flow checks`);
      if(process.argv.includes("--smoke")) {
        await viewport(cdp,390,600);await navigate(cdp,base);await screenshot(cdp,`${label}-smoke`);
        const a=await call(cdp,"return {mode:w.__equilibriumApp.getMode(),text:d.body.innerText};");assert.equal(a.mode,"edit");console.log(a.text.slice(0,600));break;
      }
      report.viewports[label]=await visualMatrix(cdp,base,label);report.flows[label]=await flows(cdp,base,label);
      console.log(`equilibrium browser: ${label} trusted touch matrix`);
      await freshPage();
      report.gestures[label]=await touchMatrix(cdp,base,label);
      await freshPage();
      report.gestures[`${label}-320`]=await touchMatrix(cdp,base,`${label}-320`,320,500);
    }
    assert.deepEqual(report.errors,[],"no runtime exceptions");
    fs.writeFileSync(path.join(artifactDir,"report.json"),JSON.stringify(report,null,2));
  } catch(e) {
    failure=e;
    if(cdp) report.failureUI=await evaluate(cdp,"(()=>{const w=document.getElementById('activity')?.contentWindow||window;return {text:w.document.body.innerText,mode:w.__equilibriumApp?.getMode()};})()").catch(()=>null);
    fs.writeFileSync(path.join(artifactDir,"failure.json"),JSON.stringify({message:e.stack,report},null,2));if(cdp)await screenshot(cdp,"failure").catch(()=>{});
  }
  try {if(chrome)await stopChrome(chrome,cdp);cdp?.close();for(const server of servers)await closeServer(server);
    for(const dir of [profile,packageDirectory].filter(Boolean)) {validateOwnedDirectory(dir,tempRoot,/^simlab-equilibrium-(?:chrome|package)-[A-Za-z0-9]+$/,"equilibrium test artifact");fs.rmSync(dir,{recursive:true,force:false});}
  } catch(e) {failure ||= e;}
  if(failure)throw failure;console.log(process.argv.includes("--smoke")?"equilibrium source browser smoke passed":"equilibrium source/package browser regression passed");
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={sourceParity,main};
