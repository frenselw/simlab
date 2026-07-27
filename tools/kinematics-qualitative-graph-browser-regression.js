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
const slug = "kinematics-qualitative-graph-sketching";

async function waitReady(cdp) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = await evaluate(cdp, `Boolean(
      window.__kinematicsGraphDebug && document.querySelector('.graph-input-surface') ||
      document.getElementById('activity')?.contentWindow?.__kinematicsGraphDebug
    )`);
    if (ready) return;
    await delay(50);
  }
  throw new Error("Qualitative graph activity did not become ready");
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitReady(cdp);
}

async function touch(cdp, type, x, y) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 5, radiusY: 5, force: 1 }],
    modifiers: 0
  });
}

async function clickPoint(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

async function directSmoke(cdp, baseUrl, launchPath, label) {
  await navigate(cdp, `${baseUrl}${launchPath}?browser-regression=${label}`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 600, deviceScaleFactor: 1, mobile: true
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const before = await evaluate(cdp, `(() => {
    const rect=document.querySelector('#practiceMount .graph-input-surface').getBoundingClientRect();
    return {x:rect.left+rect.width*.2,y:rect.top+rect.height*.65,count:Array.from(window.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length};
  })()`);
  await touch(cdp, "touchStart", before.x, before.y);
  for (let index = 1; index <= 5; index += 1) {
    await touch(cdp, "touchMove", before.x + index * 35, before.y - index * 18);
  }
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const after = await evaluate(cdp, `(() => ({
    count:Array.from(window.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length,
    pointer:window.__kinematicsGraphDebug.getPointerDiagnostics(),
    horizontal:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    mode:window.__kinematicsGraphDebug.getMode()
  }))()`);
  assert.ok(after.count > before.count, `${label}: trusted touch draws a trace`);
  assert.ok(after.pointer.trustedTouch >= 1 && after.pointer.move >= 1 && after.pointer.up >= 1, `${label}: trusted touch pointer sequence completes`);
  assert.equal(after.pointer.cancel, 0, `${label}: normal draw has no pointercancel`);
  assert.ok(after.horizontal <= 1, `${label}: no horizontal overflow`);
  assert.equal(after.mode, "activity");
  const start = await evaluate(cdp, `(() => {
    const button=document.getElementById('startChallengeButton');
    button.scrollIntoView({block:'center'});
    const rect=button.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  await clickPoint(cdp, start.x, start.y);
  await delay(100);
  const taskSurface = await evaluate(cdp, `(() => {
    const state=window.__kinematicsGraphDebug.getState();
    const surface=document.querySelector('#taskMount .graph-input-surface');
    surface.scrollIntoView({block:'center'});
    const rect=surface.getBoundingClientRect();
    return {phase:state.phase,index:state.taskIndex,x:rect.left+rect.width*.2,y:rect.top+rect.height*.65};
  })()`);
  assert.equal(taskSurface.phase, "task", `${label}: production transition enters task phase`);
  assert.equal(taskSurface.index, 0);
  await touch(cdp, "touchStart", taskSurface.x, taskSurface.y);
  await touch(cdp, "touchMove", taskSurface.x + 150, taskSurface.y);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const taskSaved = await evaluate(cdp, `(() => {
    const state=window.__kinematicsGraphDebug.getState();
    const writes=window.SimScorm.getLocalLog().filter(entry=>entry.key==='cmi.suspend_data');
    return {answer:state.answers[0],draft:writes.at(-1)?.value||''};
  })()`);
  assert.equal(typeof taskSaved.answer, "string", `${label}: committed task trace becomes authoritative answer`);
  assert.match(taskSaved.draft, /"kind":"draft"/, `${label}: semantic task change saves through shared SCORM runtime`);
  return `${label} direct touch`;
}

async function embeddedMatrix(cdp, baseUrl, launchPath, label) {
  const source = encodeURIComponent(launchPath);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${source}`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 600, deviceScaleFactor: 1, mobile: true
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const header = await evaluate(cdp, `(() => {
    scrollTo(0,150);
    const frame=document.getElementById('activity');
    const f=frame.getBoundingClientRect();
    const h=frame.contentDocument.querySelector('[data-host-scroll-region]').getBoundingClientRect();
    return {x:f.left+h.left+h.width*.5,y:f.top+h.top+Math.min(38,h.height*.45),host:scrollY,inner:frame.contentWindow.scrollY};
  })()`);
  await touch(cdp, "touchStart", header.x, header.y);
  await touch(cdp, "touchMove", header.x, header.y - 75);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const headerAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    return {host:scrollY,inner:frame.contentWindow.scrollY};
  })()`);
  assert.ok(headerAfter.host > header.host, `${label}: blank/header gesture scrolls host`);
  assert.equal(headerAfter.inner, header.inner, `${label}: header gesture does not scroll activity document`);
  const reverse = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    const f=frame.getBoundingClientRect();
    const h=frame.contentDocument.querySelector('[data-host-scroll-region]').getBoundingClientRect();
    return {x:f.left+h.left+h.width*.5,y:f.top+h.top+Math.min(38,h.height*.45),host:scrollY,inner:frame.contentWindow.scrollY};
  })()`);
  await touch(cdp, "touchStart", reverse.x, reverse.y);
  await touch(cdp, "touchMove", reverse.x, reverse.y + 60);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const reverseAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    return {host:scrollY,inner:frame.contentWindow.scrollY};
  })()`);
  assert.ok(reverseAfter.host < reverse.host, `${label}: blank/header gesture scrolls host in the opposite direction`);
  assert.equal(reverseAfter.inner, reverse.inner, `${label}: reverse header gesture leaves activity document fixed`);

  const draw = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    const doc=frame.contentDocument;
    const surface=doc.querySelector('#practiceMount .graph-input-surface');
    surface.scrollIntoView({block:'center'});
    scrollTo(0,Math.max(0,scrollY-1));
    const f=frame.getBoundingClientRect();
    const r=surface.getBoundingClientRect();
    return {x:f.left+r.left+r.width*.2,y:f.top+r.top+r.height*.6,host:scrollY,inner:frame.contentWindow.scrollY,
      count:Array.from(frame.contentWindow.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length};
  })()`);
  await touch(cdp, "touchStart", draw.x, draw.y);
  await touch(cdp, "touchMove", draw.x + 120, draw.y - 50);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const drawAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    return {host:scrollY,inner:frame.contentWindow.scrollY,
      count:Array.from(frame.contentWindow.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length,
      pointer:frame.contentWindow.__kinematicsGraphDebug.getPointerDiagnostics()};
  })()`);
  assert.equal(drawAfter.host, draw.host, `${label}: drawing does not scroll host`);
  assert.equal(drawAfter.inner, draw.inner, `${label}: drawing does not scroll activity document`);
  assert.ok(drawAfter.count > draw.count, `${label}: iframe drawing changes only trace`);
  assert.ok(drawAfter.pointer.up >= 1 && drawAfter.pointer.cancel === 0, `${label}: iframe draw completes without cancellation`);
  return `${label} embedded ownership`;
}

async function main() {
  let chrome, cdp, profile, packageDirectory;
  const servers = [];
  const tempRoot = fs.realpathSync(os.tmpdir());
  let failure;
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required; install it or set CHROME_PATH.");
    const extracted = buildAndExtractPackage(tempRoot, {
      slug,
      packagePrefix: "simlab-qualitative-graph-package-",
      packageNamePattern: /^simlab-qualitative-graph-package-[A-Za-z0-9]+$/
    });
    packageDirectory = extracted.packageDirectory;
    const sourceServer = await listenServer(createServer(path.join(root, "sim")));
    const packageServer = await listenServer(createServer(packageDirectory));
    servers.push(sourceServer, packageServer);
    const sourceUrl = `http://127.0.0.1:${sourceServer.address().port}`;
    const packageUrl = `http://127.0.0.1:${packageServer.address().port}`;
    profile = fs.mkdtempSync(path.join(tempRoot, "simlab-qualitative-graph-chrome-"));
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      `--user-data-dir=${profile}`, "--no-first-run", "--disable-background-networking", "about:blank"];
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    const port = await withTimeout(devToolsPort(profile, chrome), 12000, "Chrome startup");
    const { body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const summaries = [];
    summaries.push(await directSmoke(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await embeddedMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await directSmoke(cdp, packageUrl, extracted.activityPath, "packaged"));
    summaries.push(await embeddedMatrix(cdp, packageUrl, extracted.activityPath, "packaged"));
    console.log(`Qualitative graph browser regression passed: ${summaries.join("; ")}`);
  } catch (error) {
    failure = error;
  }
  try { if (chrome) await stopChrome(chrome, cdp); } catch (error) { failure ||= error; }
  try { await cdp?.close?.(); } catch (error) { failure ||= error; }
  for (const server of servers) try { await closeServer(server); } catch (error) { failure ||= error; }
  for (const target of [profile, packageDirectory].filter(Boolean)) {
    try {
      const real = fs.realpathSync(target);
      if (!real.startsWith(`${tempRoot}${path.sep}`) ||
          !/^simlab-qualitative-graph-(?:chrome|package)-[A-Za-z0-9]+$/.test(path.basename(real))) {
        throw new Error(`Unsafe cleanup target ${real}`);
      }
      fs.rmSync(real, { recursive: true, force: false });
    } catch (error) { failure ||= error; }
  }
  if (failure) throw failure;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
