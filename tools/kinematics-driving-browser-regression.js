#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  CdpClient, buildAndExtractPackage, closeServer, createServer, delay, devToolsPort,
  evaluate, fetchJson, findBrowser, listenServer, stopChrome, withTimeout
} = require("./position-time-browser-regression.js");

const root = path.resolve(__dirname, "..");
const slug = "kinematics-driving-challenge";
const Levels = require(path.join(root, "sim", slug, "level-definitions.js"));
const Model = require(path.join(root, "sim", slug, "driving-model.js"));
const Persistence = require(path.join(root, "sim", slug, "persistence.js"));

function analysisDraft() {
  const level = Levels.LEVELS[0];
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) { codes.push(1); run = Model.replay(level, codes); }
  const state = {
    ...Persistence.initialState(), phase: "level", variant: "analysis", currentItem: "level1",
    candidateRun: { ownerId: "level1", codes }
  };
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}

async function waitFor(cdp, expression, label) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(50);
  }
  throw new Error(`${label} did not become ready`);
}
async function touch(cdp, x, y, endX, endY, holdMs = 80, id = 1) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(holdMs);
  if (endX !== x || endY !== y) {
    for (let step = 1; step <= 4; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (endX - x) * step / 4, y: y + (endY - y) * step / 4, id, radiusX: 1, radiusY: 1, force: 1 }]
      });
      await delay(25);
    }
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function smoke(cdp, baseUrl, activityPath, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?qa=${encodeURIComponent(label)}` });
  await waitFor(cdp, "document.readyState === 'complete' && Boolean(window.KinematicsDrivingPersistence) && document.getElementById('panelTitle')?.textContent.includes('操作練習')", `${label} activity`);
  const initial = await evaluate(cdp, `(() => {
    const app = document.querySelector('.driving-app');
    const panel = document.getElementById('controlPanel');
    const stage = document.getElementById('stage');
    return {
      runtime: Boolean(window.SimScorm && window.SimActivityFlow && window.KinematicsDrivingModel && window.KinematicsDrivingScoring),
      documentRange: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      documentHeights: [document.documentElement.scrollHeight, document.documentElement.clientHeight, document.body.scrollHeight, document.body.clientHeight],
      boxes: Object.fromEntries(['.driving-app','.driving-header','.driving-shell','.driving-stage','.driving-panel','.driving-deck'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,[r.top,r.bottom,r.height,getComputedStyle(document.querySelector(selector)).overflowY]];})),
      documentUsableScroll: (() => { document.documentElement.scrollTop=50; document.body.scrollTop=50; const value=Math.max(document.documentElement.scrollTop,document.body.scrollTop); document.documentElement.scrollTop=0;document.body.scrollTop=0;return value; })(),
      panelRange: panel.scrollHeight - panel.clientHeight,
      stageHeight: stage.getBoundingClientRect().height,
      pedalHeight: document.getElementById('throttleButton').getBoundingClientRect().height,
      graphText: document.getElementById('graphCard').innerText,
      appHeight: app.getBoundingClientRect().height,
      viewport: innerHeight,
      button: (() => { const r = document.getElementById('startButton').getBoundingClientRect(); return { x:r.left+r.width/2,y:r.top+r.height/2 }; })()
    };
  })()`);
  assert.equal(initial.runtime, true, `${label}: runtime modules execute`);
  assert.equal(initial.documentUsableScroll, 0, `${label}: activity document is not a usable third scroll owner (range ${initial.documentRange}; ${initial.documentHeights.join("/")}; ${JSON.stringify(initial.boxes)})`);
  assert(initial.panelRange > 0, `${label}: control panel owns overflow`);
  assert(initial.stageHeight >= 208, `${label}: stage retains its minimum track`);
  assert(initial.pedalHeight >= 64, `${label}: pedals meet touch size`);
  assert(!/\d/.test(initial.graphText), `${label}: preview exposes no numeric values`);
  assert(Math.abs(initial.appHeight - initial.viewport) <= 2, `${label}: app is viewport bounded`);
  if (label === "development") {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.mkdirSync(path.join(root, "output"), { recursive: true });
    fs.writeFileSync(path.join(root, "output", "kinematics-driving-mobile-qa.png"), Buffer.from(screenshot.data, "base64"));
  }

  await evaluate(cdp, "document.getElementById('startButton').click()");
  const pedal = await evaluate(cdp, `(() => {
    window.__pedalEvents=[];
    const p=document.getElementById('controlPanel'),deck=document.getElementById('drivingDeck');
    p.scrollTop=deck.offsetTop;
    const b=document.getElementById('throttleButton');
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>b.addEventListener(type,e=>window.__pedalEvents.push({type,trusted:e.isTrusted,pointerType:e.pointerType})));
    const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,panel:document.getElementById('controlPanel').scrollTop};
  })()`);
  await touch(cdp, pedal.x, pedal.y, pedal.x, pedal.y, 550, 3);
  await evaluate(cdp, "document.getElementById('pauseButton').click()");
  const held = await evaluate(cdp, `(() => {
    const raw=window.SimScorm.getLocalLog().filter(e=>e.key==='cmi.suspend_data').at(-1)?.value;
    const snapshot=raw?JSON.parse(raw):null;
    return {events:window.__pedalEvents,control:document.getElementById('controlState').textContent,ticks:snapshot?.answer?.c?.n||0,panel:document.getElementById('controlPanel').scrollTop};
  })()`);
  assert(held.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"), `${label}: trusted touch starts pedal`);
  assert(held.events.some((event) => event.type === "pointerup"), `${label}: pedal receives pointerup`);
  assert(!held.events.some((event) => event.type === "pointercancel"), `${label}: normal hold is not cancelled`);
  assert.equal(held.control, "目前：空檔", `${label}: release returns to neutral`);
  assert(held.ticks >= 5, `${label}: hold creates authoritative ticks (${held.ticks}; ${JSON.stringify(held.events)}; ${held.control})`);
  assert.equal(held.panel, pedal.panel, `${label}: pedal hold does not scroll panel`);
  return `${label} launch, layout and trusted hold passed`;
}
async function embeddedMatrix(cdp, baseUrl, activityPath, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 500, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Page.navigate", { url: `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}` });
  await waitFor(cdp, "document.getElementById('activity')?.contentDocument?.getElementById('controlPanel')", `${label} embedded activity`);
  const stage = await evaluate(cdp, `(() => {
    scrollTo(0,180);
    const f=document.getElementById('activity'), fr=f.getBoundingClientRect(), d=f.contentDocument;
    const r=d.getElementById('drivingCanvas').getBoundingClientRect();
    return {x:fr.left+r.left+r.width*.72,y:fr.top+r.top+r.height*.62,host:scrollY,panel:d.getElementById('controlPanel').scrollTop,frameTop:fr.top};
  })()`);
  await touch(cdp, stage.x, stage.y, stage.x, stage.y - 75, 40, 7);
  const stageAfter = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),d=f.contentDocument;
    return {host:scrollY,panel:d.getElementById('controlPanel').scrollTop,doc:d.documentElement.scrollTop,frameTop:f.getBoundingClientRect().top};
  })()`);
  assert(stageAfter.host > stage.host, `${label}: blank stage forwards only to host owner`);
  assert(stageAfter.frameTop < stage.frameTop, `${label}: iframe moves with host`);
  assert.equal(stageAfter.panel, stage.panel, `${label}: stage never scrolls sibling panel`);
  assert.equal(stageAfter.doc, 0, `${label}: activity document stays fixed`);

  const panel = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),d=f.contentDocument,p=d.getElementById('controlPanel');
    p.scrollTop=0; const r=p.getBoundingClientRect();
    let point=null;
    for(let y=r.top+12;y<r.bottom-12&&!point;y+=12) for(let x=r.left+12;x<r.right-12&&!point;x+=18){
      const hit=d.elementFromPoint(x,y);
      if(hit&&p.contains(hit)&&!hit.closest('button,input,label,fieldset')) point={x,y,tag:hit.tagName};
    }
    if(!point) point={x:r.right-8,y:r.top+18,tag:'fallback'};
    return {x:fr.left+point.x,y:fr.top+point.y,tag:point.tag,host:scrollY,top:p.scrollTop,frameTop:fr.top};
  })()`);
  await touch(cdp, panel.x, panel.y, panel.x, panel.y - 90, 40, 8);
  const panelAfter = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),d=f.contentDocument;
    return {host:scrollY,top:d.getElementById('controlPanel').scrollTop,frameTop:f.getBoundingClientRect().top,doc:d.documentElement.scrollTop};
  })()`);
  assert(panelAfter.top > panel.top, `${label}: panel gesture scrolls panel (start ${panel.tag})`);
  assert.equal(panelAfter.host, panel.host, `${label}: panel gesture does not move host`);
  assert.equal(panelAfter.frameTop, panel.frameTop, `${label}: iframe stays fixed during panel gesture`);
  assert.equal(panelAfter.doc, 0, `${label}: activity document stays fixed during panel gesture`);
  return `${label} embedded stage/panel matrix passed`;
}
async function analysisScrub(cdp, baseUrl, activityPath, label) {
  const snapshot = analysisDraft();
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const values={'cmi.core.lesson_status':'incomplete','cmi.suspend_data':${JSON.stringify(snapshot)},'cmi.core.score.raw':''};
    window.API={LMSInitialize:()=>'true',LMSGetValue:key=>values[key]||'',LMSSetValue:(key,value)=>(values[key]=String(value),'true'),LMSCommit:()=>'true',LMSFinish:()=>'true',LMSGetLastError:()=>'0',LMSGetErrorString:()=>''};
  })();` });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-analysis`)}` });
  await waitFor(cdp, "!document.getElementById('analysisSection')?.classList.contains('is-hidden')", `${label} analysis`);
  const setup = await evaluate(cdp, `(() => {
    const p=document.getElementById('controlPanel'),r=document.getElementById('scrubRange');
    p.scrollTop=r.offsetTop; r.value='20'; r.dispatchEvent(new Event('input',{bubbles:true}));
    window.__scrubEvents=[]; ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>r.addEventListener(type,e=>window.__scrubEvents.push({type,trusted:e.isTrusted,pointerType:e.pointerType})));
    const b=r.getBoundingClientRect(); return {x:b.left+b.width*.2,endX:b.left+b.width*.78,y:b.top+b.height/2,panel:p.scrollTop,host:scrollY,value:r.value};
  })()`);
  await touch(cdp, setup.x, setup.y, setup.endX, setup.y, 60, 29);
  const after = await evaluate(cdp, `(() => ({value:document.getElementById('scrubRange').value,panel:document.getElementById('controlPanel').scrollTop,host:scrollY,events:window.__scrubEvents}))()`);
  assert.notEqual(after.value, setup.value, `${label}: trusted scrub changes replay position`);
  assert.equal(after.panel, setup.panel, `${label}: scrub does not scroll panel`);
  assert.equal(after.host, setup.host, `${label}: scrub does not scroll page`);
  assert(after.events.some((event) => event.type === "pointermove" && event.trusted && event.pointerType === "touch"), `${label}: scrub receives trusted touch move`);
  assert(after.events.some((event) => event.type === "pointerup"), `${label}: scrub receives pointerup`);
  assert(!after.events.some((event) => event.type === "pointercancel"), `${label}: scrub has no pointercancel`);
  return `${label} trusted analysis scrub passed`;
}

async function main() {
  const browser = findBrowser();
  if (!browser) throw new Error("Chrome/Chromium is required for driving browser regression");
  const tempRoot = fs.realpathSync(os.tmpdir());
  const { packageDirectory, activityPath } = buildAndExtractPackage(tempRoot, {
    slug, packagePrefix: "simlab-driving-package-", packageNamePattern: /^simlab-driving-package-[A-Za-z0-9]+$/
  });
  const profile = fs.mkdtempSync(path.join(tempRoot, "simlab-driving-chrome-"));
  const servers = [];
  let chrome, cdp, failure;
  try {
    const sourceServer = await listenServer(createServer(path.join(root, "sim"))); servers.push(sourceServer);
    const artifactServer = await listenServer(createServer(packageDirectory)); servers.push(artifactServer);
    const sourceUrl = `http://127.0.0.1:${sourceServer.address().port}`;
    const artifactUrl = `http://127.0.0.1:${artifactServer.address().port}`;
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--disable-background-networking", "about:blank"];
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    const port = await withTimeout(devToolsPort(profile, chrome), 12000, "Chrome startup");
    const { body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    const summaries = [];
    summaries.push(await smoke(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await embeddedMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await smoke(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await embeddedMatrix(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await analysisScrub(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await analysisScrub(cdp, artifactUrl, activityPath, "packaged"));
    console.log(`Kinematics driving browser regression passed: ${summaries.join("; ")}`);
  } catch (error) { failure = error; }
  try { await cdp?.close?.(); } catch (error) { failure ||= error; }
  try { if (chrome) await stopChrome(chrome); } catch (error) { failure ||= error; }
  for (const server of servers) try { await closeServer(server); } catch (error) { failure ||= error; }
  for (const target of [profile, packageDirectory]) {
    try {
      const real = fs.realpathSync(target);
      if (!real.startsWith(`${tempRoot}${path.sep}`) || !/^simlab-driving-(?:chrome|package)-[A-Za-z0-9]+$/.test(path.basename(real))) throw new Error(`Unsafe cleanup target ${real}`);
      fs.rmSync(real, { recursive: true, force: false });
    } catch (error) { failure ||= error; }
  }
  if (failure) throw failure;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
