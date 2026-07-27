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
const Tasks = require("../sim/kinematics-qualitative-graph-sketching/task-definitions.js");
const Model = require("../sim/kinematics-qualitative-graph-sketching/graph-model.js");
const Scoring = require("../sim/kinematics-qualitative-graph-sketching/scoring.js");
const Persistence = require("../sim/kinematics-qualitative-graph-sketching/persistence.js");

const root = path.resolve(__dirname, "..");
const slug = "kinematics-qualitative-graph-sketching";
const activity = slug;
let preloadIdentifier = null;

function idealAnswers() {
  return Tasks.TASKS.map((task) => Model.encodeTrace(Scoring.exemplarTrace(task.id)));
}

function reviewFixture() {
  const answers = idealAnswers();
  const state = {
    v: Persistence.VERSION,
    taskSetVersion: Tasks.TASK_SET_VERSION,
    phase: "review",
    visitedMask: Persistence.FULL_VISITED_MASK,
    answers
  };
  const result = Scoring.scoreActivity(answers);
  const review = Persistence.makeReview(state);
  const reviewSnapshot = {
    version: 1, activity, kind: "review", answer: review,
    score: result.score, passed: result.passed
  };
  return { answers, state, result, review, reviewSnapshot };
}

async function setPreload(cdp, values = null, behavior = {}) {
  if (preloadIdentifier) {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preloadIdentifier });
    preloadIdentifier = null;
  }
  if (!values) return;
  const source = `(() => {
    const values = ${JSON.stringify(values)};
    const behavior = ${JSON.stringify(behavior)};
    const log = [];
    let commits = 0;
    let finishes = 0;
    window.__fakeLms = { values, log, get commits(){return commits;}, get finishes(){return finishes;} };
    window.API = {
      LMSInitialize(){ log.push(["initialize"]); return behavior.initialize === false ? "false" : "true"; },
      LMSGetValue(key){ log.push(["get",key]); return String(values[key] ?? ""); },
      LMSSetValue(key,value){
        log.push(["set",key,String(value)]);
        if ((behavior.failSetKeys || []).includes(key)) return "false";
        values[key] = String(value); return "true";
      },
      LMSCommit(){
        commits += 1; log.push(["commit",commits]);
        const outcome = (behavior.commitResults || [])[commits - 1];
        return outcome === false ? "false" : "true";
      },
      LMSFinish(){
        finishes += 1; log.push(["finish",finishes]);
        return behavior.finish === false ? "false" : "true";
      },
      LMSGetLastError(){ return "0"; },
      LMSGetErrorString(){ return ""; }
    };
  })();`;
  const added = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source });
  preloadIdentifier = added.identifier;
}

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
    touchPoints: ["touchEnd", "touchCancel"].includes(type) ? [] : [{ x, y, radiusX: 5, radiusY: 5, force: 1 }],
    modifiers: 0
  });
}

async function clickPoint(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

async function pressKey(cdp, key, code = key) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}

async function directSmoke(cdp, baseUrl, launchPath, label) {
  await setPreload(cdp, null);
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
  const erasePractice = await evaluate(cdp, `(() => {
    const button=document.querySelector('#practiceSection [data-tool="erase"]');
    button.scrollIntoView({block:"center"});
    const rect=button.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  await clickPoint(cdp, erasePractice.x, erasePractice.y);
  assert.equal(await evaluate(cdp, `document.querySelector('#practiceSection [data-tool="erase"]').getAttribute('aria-pressed')`),
    "true", `${label}: practice eraser can be selected`);
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
  assert.equal(await evaluate(cdp, `document.querySelector('#taskSection [data-tool="pen"]').getAttribute('aria-pressed')`),
    "true", `${label}: challenge resets the active tool to pen`);
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

  const beforeCancel = await evaluate(cdp, `(() => ({
    answer:window.__kinematicsGraphDebug.getState().answers[0],
    cancel:window.__kinematicsGraphDebug.getPointerDiagnostics().cancel
  }))()`);
  await touch(cdp, "touchStart", taskSurface.x + 20, taskSurface.y - 20);
  await touch(cdp, "touchMove", taskSurface.x + 70, taskSurface.y - 55);
  await touch(cdp, "touchCancel", 0, 0);
  await delay(50);
  const afterCancel = await evaluate(cdp, `(() => ({
    answer:window.__kinematicsGraphDebug.getState().answers[0],
    cancel:window.__kinematicsGraphDebug.getPointerDiagnostics().cancel
  }))()`);
  assert.equal(afterCancel.answer, beforeCancel.answer, `${label}: pointercancel does not commit a partial stroke`);
  assert.ok(afterCancel.cancel > beforeCancel.cancel, `${label}: trusted pointercancel is observed`);

  const eraseTask = await evaluate(cdp, `(() => {
    const button=document.querySelector('#taskSection [data-tool="erase"]');
    button.scrollIntoView({block:"center"});
    const rect=button.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  await clickPoint(cdp, eraseTask.x, eraseTask.y);
  const beforeEraseCount = await evaluate(cdp,
    `Array.from(window.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length`);
  await touch(cdp, "touchStart", taskSurface.x + 75, taskSurface.y);
  await touch(cdp, "touchMove", taskSurface.x + 95, taskSurface.y);
  await touch(cdp, "touchEnd", 0, 0);
  const afterEraseCount = await evaluate(cdp,
    `Array.from(window.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length`);
  assert.ok(afterEraseCount < beforeEraseCount, `${label}: eraser removes authored bins`);
  const undo = await evaluate(cdp, `(() => {
    const button=document.querySelector('#taskSection [data-action="undo"]');
    button.scrollIntoView({block:"center"});
    const rect=button.getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  await clickPoint(cdp, undo.x, undo.y);
  const restoredCount = await evaluate(cdp,
    `Array.from(window.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length`);
  assert.equal(restoredCount, beforeEraseCount, `${label}: undo restores an erased stroke`);

  await evaluate(cdp, `document.querySelector('#taskSection [data-tool="pen"]').click();
    document.querySelector('#taskMount .graph-input-surface').focus()`);
  const beforeKeyboard = await evaluate(cdp, `window.__kinematicsGraphDebug.getState().answers[0]`);
  await pressKey(cdp, " ", "Space");
  await pressKey(cdp, "ArrowRight", "ArrowRight");
  await pressKey(cdp, "ArrowUp", "ArrowUp");
  await pressKey(cdp, " ", "Space");
  await delay(50);
  const afterKeyboard = await evaluate(cdp, `window.__kinematicsGraphDebug.getState().answers[0]`);
  assert.notEqual(afterKeyboard, beforeKeyboard, `${label}: trusted keyboard drawing commits and saves`);
  return `${label} direct touch`;
}

async function embeddedMatrix(cdp, baseUrl, launchPath, label) {
  await setPreload(cdp, null);
  const source = encodeURIComponent(launchPath);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${source}`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 600, deviceScaleFactor: 1, mobile: true
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const panelSwipe = await evaluate(cdp, `(() => {
    scrollTo(0,150);
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel");
    panel.scrollTop=0;
    const target=doc.querySelector(".graph-page-header p");
    const f=frame.getBoundingClientRect(), r=target.getBoundingClientRect();
    const stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport;
    return {x:f.left+r.left+r.width*.5,y:f.top+r.top+r.height*.5,
      host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,
      panelRange:panel.scrollHeight-panel.clientHeight,frameTop:f.top,stageTop:stage.top,stageHeight:stage.height,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0};
  })()`);
  assert.ok(panelSwipe.panelRange > 40, `${label}: fixed-height iframe has an independently scrollable controls panel`);
  await touch(cdp, "touchStart", panelSwipe.x, panelSwipe.y);
  await touch(cdp, "touchMove", panelSwipe.x, panelSwipe.y - 80);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const panelAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel"), stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport;
    return {host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,
      frameTop:frame.getBoundingClientRect().top,stageTop:stage.top,stageHeight:stage.height,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0};
  })()`);
  assert.ok(panelAfter.panel > panelSwipe.panel, `${label}: ordinary controls text scrolls only the controls panel`);
  for (const key of ["host", "inner", "frameTop", "stageTop", "stageHeight", "vvOffset", "vvPage"]) {
    assert.equal(panelAfter[key], panelSwipe[key], `${label}: controls swipe keeps ${key} fixed`);
  }

  const atBoundary = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel");
    panel.scrollTop=panel.scrollHeight;
    const nav=doc.querySelector(".practice-navigation").getBoundingClientRect(), f=frame.getBoundingClientRect();
    return {x:f.left+nav.left+18,y:f.top+nav.top+Math.min(nav.height*.5,22),
      host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,frameTop:f.top};
  })()`);
  await touch(cdp, "touchStart", atBoundary.x, atBoundary.y);
  await touch(cdp, "touchMove", atBoundary.x, atBoundary.y - 70);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(80);
  const boundaryAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity");
    return {host:scrollY,inner:frame.contentWindow.scrollY,
      panel:frame.contentDocument.getElementById("controlsPanel").scrollTop,
      frameTop:frame.getBoundingClientRect().top};
  })()`);
  assert.equal(boundaryAfter.host, atBoundary.host, `${label}: panel boundary does not leak scroll to host`);
  assert.equal(boundaryAfter.inner, atBoundary.inner, `${label}: panel boundary does not scroll activity document`);
  assert.equal(boundaryAfter.frameTop, atBoundary.frameTop, `${label}: panel boundary keeps iframe fixed`);

  const draw = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    const doc=frame.contentDocument;
    const surface=doc.querySelector('#practiceMount .graph-input-surface');
    const f=frame.getBoundingClientRect();
    const r=surface.getBoundingClientRect();
    const f2=frame.getBoundingClientRect(), r2=surface.getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport;
    return {x:f2.left+r2.left+r2.width*.2,y:f2.top+r2.top+r2.height*.6,host:scrollY,inner:frame.contentWindow.scrollY,
      panel:doc.getElementById("controlsPanel").scrollTop,frameTop:f2.top,
      stageTop:doc.getElementById("stageRegion").getBoundingClientRect().top,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      count:Array.from(frame.contentWindow.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length};
  })()`);
  await touch(cdp, "touchStart", draw.x, draw.y);
  await touch(cdp, "touchMove", draw.x + 120, draw.y - 50);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const drawAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    const vv=frame.contentWindow.visualViewport;
    return {host:scrollY,inner:frame.contentWindow.scrollY,
      panel:frame.contentDocument.getElementById("controlsPanel").scrollTop,
      frameTop:frame.getBoundingClientRect().top,
      stageTop:frame.contentDocument.getElementById("stageRegion").getBoundingClientRect().top,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      count:Array.from(frame.contentWindow.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length,
      pointer:frame.contentWindow.__kinematicsGraphDebug.getPointerDiagnostics()};
  })()`);
  assert.equal(drawAfter.host, draw.host, `${label}: drawing does not scroll host`);
  assert.equal(drawAfter.inner, draw.inner, `${label}: drawing does not scroll activity document`);
  assert.equal(drawAfter.panel, draw.panel, `${label}: drawing does not scroll controls panel`);
  assert.equal(drawAfter.frameTop, draw.frameTop, `${label}: drawing leaves iframe position fixed`);
  assert.equal(drawAfter.stageTop, draw.stageTop, `${label}: drawing leaves graph stage fixed`);
  assert.equal(drawAfter.vvOffset, draw.vvOffset, `${label}: drawing leaves activity visual viewport fixed`);
  assert.equal(drawAfter.vvPage, draw.vvPage, `${label}: drawing leaves activity visual page fixed`);
  assert.ok(drawAfter.count > draw.count, `${label}: iframe drawing changes only trace`);
  assert.ok(drawAfter.pointer.up >= 1 && drawAfter.pointer.cancel === 0, `${label}: iframe draw completes without cancellation`);
  return `${label} embedded ownership`;
}

async function clickSelector(cdp, selector) {
  const point = await evaluate(cdp, `(() => {
    const element=document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error("Missing click target");
    element.scrollIntoView({block:"center"});
    const rect=element.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  })()`);
  await clickPoint(cdp, point.x, point.y);
  await delay(70);
}

async function responsiveMatrix(cdp, baseUrl, launchPath, label) {
  await setPreload(cdp, null);
  for (const [width, height] of [[320, 500], [390, 500], [390, 600], [700, 390]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile: width < 600
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await navigate(cdp, `${baseUrl}${launchPath}?responsive=${width}x${height}`);
    const metrics = await evaluate(cdp, `(() => {
      const button=document.getElementById("startChallengeButton");
      button.scrollIntoView({block:"center"});
      const r=button.getBoundingClientRect();
      const board=document.querySelector(".graph-board").getBoundingClientRect();
      return {
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        buttonVisible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
        boardVisible:board.width>220&&board.height>160
      };
    })()`);
    assert.ok(metrics.overflow <= 1, `${label} ${width}x${height}: no horizontal overflow`);
    assert.equal(metrics.buttonVisible, true, `${label} ${width}x${height}: primary navigation remains reachable`);
    assert.equal(metrics.boardVisible, true, `${label} ${width}x${height}: graph remains readable`);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 600, deviceScaleFactor: 1, mobile: true
  });
  await navigate(cdp, `${baseUrl}${launchPath}?responsive=zoom`);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  const zoomed = await evaluate(cdp, `(() => {
    const button=document.getElementById("startChallengeButton");
    button.scrollIntoView({block:"center"});
    const r=button.getBoundingClientRect();
    return {
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      buttonWidth:r.width, buttonHeight:r.height,
      visualScale:visualViewport?.scale||1
    };
  })()`);
  assert.ok(zoomed.overflow <= 1, `${label}: 200% zoom has no document-level horizontal overflow`);
  assert.ok(zoomed.buttonWidth >= 44 && zoomed.buttonHeight >= 44, `${label}: primary action remains operable at 200% zoom`);
  assert.ok(zoomed.visualScale >= 1.9, `${label}: 200% zoom was applied`);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  return `${label} responsive`;
}

function lmsValues(snapshot, status = "incomplete", score = "") {
  return {
    "cmi.core.lesson_status": status,
    "cmi.suspend_data": snapshot ? JSON.stringify(snapshot) : "",
    "cmi.core.score.raw": String(score)
  };
}

async function lifecycleMatrix(cdp, baseUrl, launchPath, label) {
  const fixture = reviewFixture();
  const taskDraft = {
    v: Persistence.VERSION,
    taskSetVersion: Tasks.TASK_SET_VERSION,
    phase: "task",
    taskIndex: 0,
    variant: "first-pass",
    visitedMask: 1,
    answers: [fixture.answers[0], ...Array(Tasks.TASKS.length - 1).fill(null)]
  };
  const reviewDraft = {
    version: 1, activity, kind: "draft", answer: fixture.state
  };

  await setPreload(cdp, lmsValues({ version: 1, activity, kind: "draft", answer: taskDraft }));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=valid-draft`);
  const restored = await evaluate(cdp, `(() => {
    const state=window.__kinematicsGraphDebug.getState();
    return {mode:window.__kinematicsGraphDebug.getMode(),phase:state.phase,index:state.taskIndex,answer:state.answers[0]};
  })()`);
  assert.deepEqual(restored, { mode: "activity", phase: "task", index: 0, answer: fixture.answers[0] },
    `${label}: valid task draft restores authoritatively`);

  const invalidDraft = structuredClone(taskDraft);
  invalidDraft.visitedMask = 0;
  await setPreload(cdp, lmsValues({ version: 1, activity, kind: "draft", answer: invalidDraft }));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=invalid-draft`);
  assert.equal(await evaluate(cdp, `window.__kinematicsGraphDebug.getMode()`), "technical",
    `${label}: invalid draft is locked as technical state`);

  await setPreload(cdp, lmsValues(fixture.reviewSnapshot, fixture.result.passed ? "passed" : "failed", fixture.result.score));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=finished-trusted`);
  const trusted = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    graphHidden:document.getElementById("resultGraphMount").classList.contains("is-hidden"),
    tabs:document.querySelectorAll("[data-result-task]").length
  }))()`);
  assert.equal(trusted.mode, "submitted", `${label}: trusted finished attempt enters submitted review`);
  assert.equal(trusted.graphHidden, false, `${label}: trusted review displays submitted graph`);
  assert.equal(trusted.tabs, Tasks.TASKS.length, `${label}: all submitted graphs remain reviewable`);

  await setPreload(cdp, lmsValues(fixture.reviewSnapshot, "passed", fixture.result.score - 1));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=finished-mismatch`);
  const fallback = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    graphHidden:document.getElementById("resultGraphMount").classList.contains("is-hidden"),
    tabs:document.querySelectorAll("[data-result-task]").length,
    notice:document.getElementById("resultNotice").textContent
  }))()`);
  assert.equal(fallback.mode, "submitted", `${label}: mismatched finished attempt still shows recorded summary`);
  assert.equal(fallback.graphHidden, true, `${label}: mismatched review hides untrusted graph details`);
  assert.equal(fallback.tabs, 0, `${label}: mismatched review exposes no untrusted answer tabs`);
  assert.match(fallback.notice, /未能安全驗證/, `${label}: mismatch is explained as review fallback`);

  const pendingSnapshot = {
    version: 1, activity, kind: "pending-final",
    payload: {
      reviewJson: JSON.stringify(fixture.reviewSnapshot),
      score: fixture.result.score,
      maxScore: fixture.result.maxScore,
      passed: fixture.result.passed
    }
  };
  await setPreload(cdp, lmsValues(pendingSnapshot));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=pending-valid`);
  const pending = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    retry:!document.getElementById("resultRetryButton").classList.contains("is-hidden")
  }))()`);
  assert.deepEqual(pending, { mode: "technical", retry: true },
    `${label}: valid pending checkpoint freezes work and offers retry`);
  await clickSelector(cdp, "#resultRetryButton");
  const pendingSuccess = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    graphHidden:document.getElementById("stageRegion").classList.contains("is-hidden"),
    commits:window.__fakeLms.commits
  }))()`);
  assert.equal(pendingSuccess.mode, "submitted", `${label}: pending retry success restores trusted submitted review`);
  assert.equal(pendingSuccess.graphHidden, false, `${label}: pending retry success restores the review graph`);
  assert.ok(pendingSuccess.commits >= 1, `${label}: pending retry success commits through LMS`);

  await setPreload(cdp, lmsValues(pendingSnapshot));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=pending-failure`);
  await evaluate(cdp, `window.SimScorm.retryPending=()=>({committed:false,retryable:true})`);
  await clickSelector(cdp, "#resultRetryButton");
  const pendingFailure = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    retry:!document.getElementById("resultRetryButton").classList.contains("is-hidden"),
    notice:document.getElementById("resultNotice").textContent
  }))()`);
  assert.deepEqual({ mode: pendingFailure.mode, retry: pendingFailure.retry },
    { mode: "technical", retry: true }, `${label}: pending retry failure stays frozen and retryable`);
  assert.match(pendingFailure.notice, /仍未能確認提交/, `${label}: pending retry failure is described honestly`);

  const mismatchSnapshot = structuredClone(fixture.reviewSnapshot);
  mismatchSnapshot.answer.answers[0] = Model.encodeTrace(Scoring.exemplarTrace("uniform-at"));
  await setPreload(cdp, lmsValues(pendingSnapshot));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=pending-mismatch`);
  await evaluate(cdp, `window.SimScorm.retryPending=()=>({
    committed:true,finished:true,review:${JSON.stringify(mismatchSnapshot)},
    score:${fixture.result.score},status:${JSON.stringify(fixture.result.passed ? "passed" : "failed")}
  })`);
  await clickSelector(cdp, "#resultRetryButton");
  const pendingMismatch = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    retry:!document.getElementById("resultRetryButton").classList.contains("is-hidden"),
    notice:document.getElementById("resultNotice").textContent
  }))()`);
  assert.deepEqual({ mode: pendingMismatch.mode, retry: pendingMismatch.retry },
    { mode: "technical", retry: false }, `${label}: mismatched pending retry is locked`);
  assert.match(pendingMismatch.notice, /不一致/, `${label}: mismatched pending retry does not display untrusted result`);

  const invalidPending = structuredClone(pendingSnapshot);
  const nested = JSON.parse(invalidPending.payload.reviewJson);
  nested.answer.answers[0] = "not-a-trace";
  invalidPending.payload.reviewJson = JSON.stringify(nested);
  await setPreload(cdp, lmsValues(invalidPending));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=pending-invalid`);
  const quarantined = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    retry:!document.getElementById("resultRetryButton").classList.contains("is-hidden")
  }))()`);
  assert.deepEqual(quarantined, { mode: "technical", retry: false },
    `${label}: invalid pending checkpoint is quarantined without retry`);

  for (const scenario of [
    { name: "success", behavior: { commitResults: [true, true], finish: true }, mode: "submitted", retry: false },
    { name: "committed", behavior: { commitResults: [true, true], finish: false }, mode: "submitted", retry: true },
    { name: "frozen", behavior: { commitResults: [true, false], finish: true }, mode: "technical", retry: true }
  ]) {
    await setPreload(cdp, lmsValues(reviewDraft), scenario.behavior);
    await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=submit-${scenario.name}`);
    await clickSelector(cdp, "#submitButton");
    const outcome = await evaluate(cdp, `(() => ({
      mode:window.__kinematicsGraphDebug.getMode(),
      retry:![...document.querySelectorAll("#resultRetryButton,#submissionRetryButton")]
        .every(button=>button.classList.contains("is-hidden")),
      commits:window.__fakeLms.commits,finishes:window.__fakeLms.finishes
    }))()`);
    assert.equal(outcome.mode, scenario.mode, `${label}: ${scenario.name} submission renders correct mode`);
    assert.equal(outcome.retry, scenario.retry, `${label}: ${scenario.name} submission renders correct retry policy`);
    assert.ok(outcome.commits >= 1, `${label}: ${scenario.name} submission exercises LMS commit`);
  }

  for (const retryable of [true, false]) {
    await setPreload(cdp, lmsValues(reviewDraft));
    await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=callback-${retryable}`);
    await evaluate(cdp, `window.SimScorm.submitWithCallbacks=(_r,_s,callbacks)=>{
      const outcome={activityState:"retry",retryable:${retryable}};
      callbacks.onFailure(outcome); return outcome;
    }`);
    await clickSelector(cdp, "#submitButton");
    const outcome = await evaluate(cdp, `(() => ({
      mode:window.__kinematicsGraphDebug.getMode(),
      retry:!document.getElementById("submissionRetryButton").classList.contains("is-hidden"),
      warning:document.getElementById("reviewWarning").textContent
    }))()`);
    assert.equal(outcome.mode, "activity", `${label}: retry callback returns to review`);
    assert.equal(outcome.retry, retryable, `${label}: retryable policy controls retry CTA`);
    assert.match(outcome.warning, retryable ? /仍可修改或重試/ : /操作已鎖定/,
      `${label}: retry callback explains edit/lock policy`);
  }
  return `${label} LMS lifecycle`;
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
    summaries.push(await responsiveMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await lifecycleMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await directSmoke(cdp, packageUrl, extracted.activityPath, "packaged"));
    summaries.push(await embeddedMatrix(cdp, packageUrl, extracted.activityPath, "packaged"));
    summaries.push(await responsiveMatrix(cdp, packageUrl, extracted.activityPath, "packaged"));
    summaries.push(await lifecycleMatrix(cdp, packageUrl, extracted.activityPath, "packaged"));
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
