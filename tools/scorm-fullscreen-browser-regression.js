#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawn } = require("node:child_process");
const H = require("./position-time-browser-regression.js");
const P = require("../sim/newtons-third-law-fullscreen-test/persistence.js");
const S = require("../sim/newtons-third-law-fullscreen-test/scoring.js");
const { durableDraft } = require("../sim/newtons-third-law-fullscreen-test/test-support.js");
const { sourceParity } = require("./newtons-third-law-fullscreen-activity-regression.js");
const root = path.resolve(__dirname, ".."), slug = P.ACTIVITY;
const artifactDir = path.join(root, "output/playwright/scorm-fullscreen");

function serverFor(directory) {
  const server = H.createServer(directory), staticHandler = server.listeners("request")[0];
  server.removeAllListeners("request");
  server.on("request", (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (!url.pathname.startsWith("/__fullscreen-")) return staticHandler(request, response);
    const blocked = url.searchParams.get("block") === "1";
    const depth = Number(url.searchParams.get("depth") || 0);
    const wrapper = url.pathname === "/__fullscreen-wrapper";
    const src = depth > 1
      ? `/__fullscreen-wrapper?depth=${depth - 1}`
      : `/${slug}/index.html${url.searchParams.has("unsupported") ? "?unsupported=1" : ""}`;
    const values = JSON.parse(url.searchParams.get("fixture") || '{"cmi.core.lesson_status":"not attempted"}');
    const api = wrapper ? "" : `window.__values=${JSON.stringify(values)};window.__failFinal=false;let error='0';window.API={
      LMSInitialize:()=> 'true',LMSGetValue:k=>(error='0',window.__values[k]||''),
      LMSSetValue:(k,v)=>{if(window.__failFinal&&k==='cmi.core.score.raw'){error='351';return 'false';}window.__values[k]=String(v);error='0';return 'true';},
      LMSCommit:()=> 'true',LMSFinish:()=> 'true',LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};`;
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>
      html,body{margin:0;${wrapper ? "height:100%;overflow:hidden" : ""}}iframe{display:block;border:0;width:100%;height:${wrapper ? "100%" : "500px"}}header{height:140px;background:#e2e8f0;padding:12px;box-sizing:border-box}.after{height:800px}
      </style></head><body>${wrapper ? "" : '<header>Moodle-like SCORM 測試播放器</header>'}
      <iframe id="activity" title="全螢幕測試活動" ${blocked ? 'allow="fullscreen \'none\'"' : 'allow="fullscreen" allowfullscreen'}></iframe>
      ${wrapper ? "" : '<div class="after"></div>'}<script>${api}document.getElementById('activity').src=${JSON.stringify(src)};<\/script></body></html>`;
    const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
    if (url.searchParams.has("policy")) headers["Permissions-Policy"] = "fullscreen=()";
    response.writeHead(200, headers).end(html);
  });
  return server;
}
function frameWindow(depth) {
  return "window" + ".document.getElementById('activity').contentWindow".repeat(depth);
}
const local = (cdp, code, depth = 0) => H.evaluate(cdp, `((w,d)=>{${code}})(${frameWindow(depth)},${frameWindow(depth)}.document)`);
async function until(cdp, expression, depth = 0) {
  for (let i = 0; i < 120; i++) {
    try { if (await local(cdp, `return ${expression};`, depth)) return; } catch (_) {}
    await H.delay(40);
  }
  throw new Error("Browser condition timed out: " + expression);
}
async function point(cdp, selector, depth) {
  return local(cdp, `const e=d.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();let x=r.left+r.width/2,y=r.top+r.height/2;for(let f=w;f!==f.top;f=f.parent){const b=f.frameElement.getBoundingClientRect();x+=b.left;y+=b.top;}return {x,y};`, depth);
}
async function click(cdp, selector, depth = 0, touch = false) {
  const p = await point(cdp, selector, depth);
  if (touch) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...p, id: 901, radiusX: 2, radiusY: 2, force: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...p, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...p, button: "left", clickCount: 1 });
  }
  await H.delay(80);
}
async function evidence(cdp, depth) {
  return local(cdp, `const app=w.__reactionApp,b=d.getElementById('fullscreenButton'),p=d.getElementById('controlPanel'),r=d.getElementById('app').getBoundingClientRect(),s=d.getElementById('stage').getBoundingClientRect();return {
    active:d.fullscreenElement===d.getElementById('app'),label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),disabled:b.disabled,
    enterIconVisible:w.getComputedStyle(b.querySelector('[data-fullscreen-enter]')).display!=='none',exitIconVisible:w.getComputedStyle(b.querySelector('[data-fullscreen-exit]')).display!=='none',
    width:w.innerWidth,height:w.innerHeight,screen:[w.screen.width,w.screen.height,w.screen.availHeight],app:[r.x,r.y,r.width,r.height],stage:[s.x,s.y,s.width,s.height],panelHeight:p.clientHeight,
    rootRange:d.documentElement.scrollHeight-w.innerHeight,panelScroll:p.scrollTop,mode:app.getMode(),state:app.getState(),snapshot:app.getSnapshot(),
    error:d.getElementById('fullscreenStatus').dataset.fullscreenError||null,clicks:w.__fullscreenClicks||[]};`, depth);
}
function sameWork(before, after) {
  assert.deepEqual(after.state, before.state, "fullscreen retains authoritative work");
  assert.deepEqual(after.snapshot, before.snapshot, "fullscreen leaves SCORM snapshot unchanged");
  assert.equal(after.mode, before.mode, "fullscreen leaves phase and lock unchanged");
}
function full(e) {
  assert.equal(e.active, true); assert.equal(e.label, "退出全螢幕"); assert.equal(e.pressed, "true");
  assert.equal(e.disabled, false); assert.equal(e.error, null);
  assert.equal(e.enterIconVisible,false);assert.equal(e.exitIconVisible,true);
  assert.ok(e.app[2] >= e.width - 1 && e.app[3] >= e.height - 1, "whole activity fills fullscreen viewport");
  assert.ok(e.rootRange <= 1); assert.ok(e.panelHeight >= 96, "panel remains usable");
  assert.ok(e.clicks.some(c => c.trusted), "fullscreen invoked by a trusted click/tap");
}
async function screenshot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(artifactDir, `${name}.png`), Buffer.from(data, "base64"));
}
async function fullscreenTouch(cdp, depth) {
  const expected = await local(cdp,"return w.__reactionApp.getQuestion().expected[w.__reactionApp.getState().target];",depth);
  await click(cdp,`[data-body="${expected[0]}"]`,depth,true);
  await click(cdp,`[data-anchor="${expected[1]}"]`,depth,true);
  await local(cdp,`const e=d.getElementById('kindSelect');e.value=${JSON.stringify(String(expected[2]))};e.dispatchEvent(new w.Event('change',{bubbles:true}));`,depth);
  const start = await point(cdp,".anchor-hit:not([hidden])",depth);
  const end = await local(cdp,`const app=w.__reactionApp,q=app.getQuestion(),p=w.ReactionModel.endpoint(q.expected[app.getState().target],q,app.getGeometry()),r=d.getElementById('stage').getBoundingClientRect();let x=r.left+p.x,y=r.top+p.y;for(let f=w;f!==f.top;f=f.parent){const b=f.frameElement.getBoundingClientRect();x+=b.left;y+=b.top;}return {x,y};`,depth);
  const touch = (p,id=902) => ({...p,id,radiusX:2,radiusY:2,force:1});
  const diagnosticsBefore = await local(cdp,"return w.__reactionApp.getPointerDiagnostics();",depth);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touch(start)]});
  for(let step=1;step<=12;step++) {
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touch({x:start.x+(end.x-start.x)*step/12,y:start.y+(end.y-start.y)*step/12})]});
    await H.delay(15);
  }
  assert.equal(await local(cdp,"return d.getElementById('magnifier').hidden;",depth),false,"fullscreen touch drag shows preview");
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]}); await H.delay(120);
  const after = await evidence(cdp,depth), answer=after.state.answers[after.state.question][after.state.target];
  assert.deepEqual(answer,expected,"fullscreen drag uses the correct resized geometry and saves the same force");
  const diagnosticsAfter = await local(cdp,"return w.__reactionApp.getPointerDiagnostics();",depth);
  assert.ok(diagnosticsAfter.trustedTouch>diagnosticsBefore.trustedTouch);
  assert.ok(diagnosticsAfter.ups>diagnosticsBefore.ups);
  assert.equal(diagnosticsAfter.cancels,diagnosticsBefore.cancels);
  assert.equal(await local(cdp,"return d.getElementById('magnifier').hidden;",depth),true);
  // A trusted panel swipe must retain stage position and the completed drawing.
  await local(cdp,"d.getElementById('controlPanel').scrollTop=100;",depth);
  await H.delay(150); // Let the compositor settle after programmatic test setup.
  const beforePanel=await evidence(cdp,depth),p=await point(cdp,"#controlPanel",depth);
  const hit=await local(cdp,`const r=d.getElementById('controlPanel').getBoundingClientRect(),e=d.elementFromPoint(r.left+r.width/2,r.top+r.height/2+25);let a=[];for(let n=e;n;n=n.parentElement){const s=w.getComputedStyle(n);a.push({tag:n.tagName,id:n.id,class:n.className,touchAction:s.touchAction,overflow:s.overflowY,height:n.clientHeight,scrollHeight:n.scrollHeight});}return a;`,depth);
  const hostBefore=await H.evaluate(cdp,"scrollY");
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[touch({x:p.x,y:p.y+50},903)]});
  for(let step=1;step<=12;step++) {
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[touch({x:p.x,y:p.y+50-100*step/12},903)]}); await H.delay(20);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await H.delay(200);
  const afterPanel=await evidence(cdp,depth);sameWork(beforePanel,afterPanel);
  assert.ok(afterPanel.panelScroll>beforePanel.panelScroll+5,"fullscreen control panel scrolls: "+JSON.stringify({before:beforePanel.panelScroll,after:afterPanel.panelScroll,point:p,height:afterPanel.height,panelHeight:afterPanel.panelHeight,screen:afterPanel.screen,hit,events:await local(cdp,"return w.__fullscreenTouchTrace;",depth)}));
  assert.deepEqual(afterPanel.stage,beforePanel.stage);assert.equal(await H.evaluate(cdp,"scrollY"),hostBefore);
  return {answer,diagnosticsBefore,diagnosticsAfter,beforePanel,afterPanel};
}
async function run(cdp, base, label) {
  const results = [];
  async function load(depth, options = {}) {
    const params = new URLSearchParams({ depth: String(depth), ...options });
    const url = depth ? `${base}/__fullscreen-host?${params}` : `${base}/${slug}/index.html`;
    await cdp.send("Page.navigate", { url });
    await until(cdp, "Boolean(w.__reactionApp)", depth); await H.delay(120);
  }
  for (const [depth, width, height] of [[0,390,844],[0,1280,900],[1,1280,900],[2,1280,900],[1,390,844],[2,320,500]]) {
    console.log(`fullscreen: ${label} T${depth} ${width}x${height}`);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, screenWidth:width, screenHeight:height, deviceScaleFactor: 1, mobile: width < 600 });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: width < 600, maxTouchPoints: 2 });
    await load(depth);
    // Legal partial work through the production UI, independent of fullscreen.
    await local(cdp, "const e=d.getElementById('kindSelect');e.value='0';e.dispatchEvent(new w.Event('change',{bubbles:true}));", depth);
    const before = await evidence(cdp, depth);
    const lmsBefore = depth ? await H.evaluate(cdp, "JSON.stringify(window.__values)") : null;
    await click(cdp, "#fullscreenButton", depth, width < 600);
    await until(cdp, "d.fullscreenElement===d.getElementById('app') && !d.getElementById('fullscreenButton').disabled", depth);
    const entered = await evidence(cdp, depth); full(entered); sameWork(before, entered);
    if (depth) assert.equal(await H.evaluate(cdp, "JSON.stringify(window.__values)"), lmsBefore);
    const touchEvidence=width<600?await fullscreenTouch(cdp,depth):null;
    const workBeforeExit=await evidence(cdp,depth);
    await screenshot(cdp, `${label}-T${depth}-${width}-full`);
    await click(cdp, "#fullscreenButton", depth, width < 600);
    await until(cdp, "!d.fullscreenElement && !d.getElementById('fullscreenButton').disabled", depth);
    const exited = await evidence(cdp, depth); sameWork(workBeforeExit, exited);
    assert.equal(exited.pressed, "false"); assert.equal(exited.label, "進入全螢幕");
    assert.equal(exited.enterIconVisible,true);assert.equal(exited.exitIconVisible,false);
    // Keyboard activation and an exit initiated outside the controller.
    await local(cdp, "d.getElementById('fullscreenButton').focus();", depth);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await until(cdp, "Boolean(d.fullscreenElement)", depth);
    await local(cdp, "return d.exitFullscreen();", depth);
    await until(cdp, "!d.fullscreenElement && d.getElementById('fullscreenButton').getAttribute('aria-pressed')==='false'", depth);
    results.push({ case: `T${depth}-${width}x${height}`, before, entered, exited, touchEvidence });
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, screenWidth:390, screenHeight:844, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  for (const [name, depth, options, error] of [
    ["iframe-policy",1,{block:"1"},"blocked"],
    ["ancestor-policy",2,{block:"1"},"blocked"],
    ["http-policy",1,{policy:"1"},"blocked"],
    ["unsupported",1,{unsupported:"1"},"unsupported"]
  ]) {
    await load(depth, options); const before = await evidence(cdp, depth);
    await click(cdp, "#fullscreenButton", depth, true); const after = await evidence(cdp, depth);
    assert.equal(after.active, false); assert.equal(after.error, error); assert.equal(after.disabled, false); sameWork(before, after);
    assert.ok(after.panelHeight >= 96); assert.ok(after.rootRange <= 1);
    // A display error must not block legal blank/partial check and submission.
    await click(cdp, "#checkButton", depth, true); await click(cdp, "#submitButton", depth, true);
    await until(cdp, "w.__reactionApp.getMode()==='review'", depth);
    results.push({ case: name, before, after }); await screenshot(cdp, `${label}-${name}`);
  }
  for (const pending of [false, true]) {
    const partial = P.fresh(21); partial.answers[partial.question][0][2] = 0;
    await load(1, { fixture: JSON.stringify(durableDraft(partial)) });
    await click(cdp, "#fullscreenButton", 1, true); await until(cdp, "Boolean(d.fullscreenElement)", 1);
    if (pending) await H.evaluate(cdp, "window.__failFinal=true");
    await click(cdp, "#checkButton", 1, true); await click(cdp, "#submitButton", 1, true);
    await until(cdp, `w.__reactionApp.getMode()===${JSON.stringify(pending ? "frozen" : "review")}`, 1);
    const locked = await evidence(cdp, 1); full(locked);
    await click(cdp, "#fullscreenButton", 1, true); await until(cdp, "!d.fullscreenElement", 1);
    sameWork(locked, await evidence(cdp, 1));
    if (pending) {
      await H.evaluate(cdp, "window.__failFinal=false"); await click(cdp, "#retryFinalButton", 1, true);
      await until(cdp, "w.__reactionApp.getMode()==='review'", 1);
    }
    assert.equal(await local(cdp, "return w.__reactionApp.getResult().score;", 1), S.score(partial).score);
    await local(cdp, "w.location.reload();", 1); await H.delay(150); await until(cdp, "w.__reactionApp?.getMode()==='review'", 1);
    assert.equal((await evidence(cdp, 1)).active, false);
    results.push({ case: pending ? "fullscreen-pending-retry-resume" : "fullscreen-submit-review-resume", locked });
  }
  return results;
}
async function main() {
  fs.mkdirSync(artifactDir, { recursive: true }); sourceParity();
  const temp = fs.realpathSync(os.tmpdir()), servers = [];
  let profile, packageDirectory, chrome, cdp, failure;
  const headless=process.argv.includes('--headless');
  const report = { activity: slug, engine: "Chrome/CDP trusted input", display:headless?'headless':'headed', errors: [], completed: false };
  try {
    const extracted = H.buildAndExtractPackage(temp, { slug, packagePrefix: "simlab-fullscreen-package-", packageNamePattern: /^simlab-fullscreen-package-[A-Za-z0-9]+$/ });
    packageDirectory = extracted.packageDirectory;
    for (const name of sourceParity().concat(`${slug}/index.html`)) assert.equal(fs.readFileSync(path.join(root,"sim",name),"utf8"),fs.readFileSync(path.join(packageDirectory,name),"utf8"));
    const browser = H.findBrowser(); assert.ok(browser, "Chrome required");
    profile = fs.mkdtempSync(path.join(temp, "simlab-fullscreen-chrome-"));
    // Native fullscreen gesture acceptance needs a real browser window here.
    // --headless is diagnostic: it does not bypass any failing assertions.
    chrome = spawn(browser, [...(headless?["--headless=new"]:[]),"--window-size=1280,1000","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0",`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","--disable-background-networking","--disable-component-update","--disable-sync","about:blank"], { stdio:["ignore","ignore","pipe"] });
    let stderr = ""; chrome.stderr.on("data", b => { stderr = (stderr+b).slice(-3000); });
    const port = await H.devToolsPort(profile,chrome).catch(e=>{e.message+=stderr;throw e;});
    const { body: tab } = await H.fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:"PUT"});
    cdp = new H.CdpClient(tab.webSocketDebuggerUrl,WebSocket,15000);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Page.bringToFront");
    cdp.on("Runtime.exceptionThrown",e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `Object.defineProperty(crypto,'getRandomValues',{value(a){a.fill(0);a[0]=21;return a;}});
      window.__fullscreenClicks=[];document.addEventListener('click',e=>{if(e.target.closest?.('#fullscreenButton'))window.__fullscreenClicks.push({trusted:e.isTrusted,pointerType:e.pointerType||'keyboard'});},true);
      window.__fullscreenTouchTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchmove'])document.addEventListener(type,e=>{if(type==='touchmove'&&!Array.from(e.changedTouches).some(t=>t.identifier===903))return;window.__fullscreenTouchTrace.push({type,target:e.target.id||e.target.className,primary:e.isPrimary,cancelable:e.cancelable,defaultPrevented:e.defaultPrevented,clientY:e.clientY||e.changedTouches?.[0]?.clientY});},true);
      if(location.search.includes('unsupported=1'))for(const name of ['requestFullscreen','webkitRequestFullscreen'])Object.defineProperty(Element.prototype,name,{value:undefined,configurable:true});` });
    report.browser = await cdp.send("Browser.getVersion");
    for (const [label, directory] of [["source",path.join(root,"sim")],["package",packageDirectory]]) {
      const server = serverFor(directory); servers.push(server); await H.listenServer(server);
      console.log(`fullscreen: ${label} native/iframe/policy/lifecycle`);
      report[label] = await run(cdp,`http://127.0.0.1:${server.address().port}`,label);
    }
    assert.deepEqual(report.errors,[]); report.completed = true;
  } catch (error) {
    failure = error; report.failure = error.stack;
    if (cdp) await screenshot(cdp,"failure").catch(()=>{});
  } finally {
    fs.writeFileSync(path.join(artifactDir,"report.json"),JSON.stringify(report,null,2)+"\n");
    try {
      if (chrome) await H.stopChrome(chrome,cdp); cdp?.close();
      for (const server of servers) await H.closeServer(server);
      for (const directory of [profile,packageDirectory].filter(Boolean)) {
        H.validateOwnedDirectory(directory,temp,/^simlab-fullscreen-(?:chrome|package)-[A-Za-z0-9]+$/,"fullscreen artifact");
        fs.rmSync(directory,{recursive:true,force:false});
      }
    } catch (error) { failure ||= error; }
  }
  if (failure) throw failure;
  console.log("Fullscreen source/package native, iframe, policy and SCORM checks passed");
}
if (require.main===module) main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports = { main };
