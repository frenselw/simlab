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
    score: result.score, passed: result.passed, maxScore: result.maxScore
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

async function settleHostScroll(cdp, target, label) {
  const settled = await evaluate(cdp, `new Promise((resolve, reject) => {
    let stable = 0, frames = 0;
    const tick = () => {
      window.scrollTo(0, ${JSON.stringify(target)});
      const current = Math.round(window.scrollY);
      stable = current === ${JSON.stringify(target)} ? stable + 1 : 0;
      if (stable >= 5) return resolve(current);
      if (++frames > 60) return reject(new Error("host scroll did not settle"));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })`);
  assert.equal(settled, target, `${label}: host scroll settles before trusted touch`);
}

async function clickPoint(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

async function pressKey(cdp, key, code = key) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}

function respondToNextDialog(cdp, accept) {
  return new Promise((resolve, reject) => {
    const remove = cdp.on("Page.javascriptDialogOpening", ({ message }) => {
      remove();
      cdp.send("Page.handleJavaScriptDialog", { accept }).then(() => resolve(message), reject);
    });
  });
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
  assert.equal(taskSurface.index, Tasks.taskIndexById("uniform-xt"), `${label}: recommended display order starts with x-t`);
  const graphSemantics = await evaluate(cdp, `(() => ({
    arrows:document.querySelectorAll("#taskMount .vertical-arrow, #taskMount .time-arrow").length,
    signedHints:document.querySelectorAll("#taskMount .positive-label, #taskMount .negative-label").length,
    zeroVisible:getComputedStyle(document.querySelector("#taskMount .zero-label")).display !== "none",
    graphVars:document.getElementById("graphLabel").querySelectorAll("var").length,
    switchVars:Array.from(document.querySelectorAll("[data-switch-task]"))
      .every(button => button.querySelectorAll("var").length === 2)
  }))()`);
  assert.equal(graphSemantics.arrows, 2, `${label}: graph axes use up and right arrowheads`);
  assert.equal(graphSemantics.signedHints, 0, `${label}: graph omits plus/minus shortcut labels`);
  assert.equal(graphSemantics.zeroVisible, false, `${label}: x-t graph does not show a signed zero-axis label`);
  assert.equal(graphSemantics.graphVars, 2, `${label}: active graph name uses semantic variables`);
  assert.equal(graphSemantics.switchVars, true, `${label}: graph switch labels use semantic variables`);
  await evaluate(cdp, `document.getElementById("scenarioTitle").focus()`);
  const focusSequence = [];
  for (let index = 0; index < 16; index += 1) {
    await pressKey(cdp, "Tab", "Tab");
    const focused = await evaluate(cdp, `(() => {
      const active=document.activeElement;
      if (active.matches(".graph-input-surface")) return "graph-surface";
      if (active.dataset.switchTask != null) return "switch-"+active.dataset.switchTask;
      if (active.dataset.tool) return "tool-"+active.dataset.tool;
      if (active.dataset.action) return "action-"+active.dataset.action;
      return active.id || active.tagName.toLowerCase();
    })()`);
    focusSequence.push(focused);
    if (focused === "graph-surface") break;
  }
  assert.equal(focusSequence[0], "switch-2", `${label}: task focus starts with the display-order x-t control`);
  assert.ok(!focusSequence.includes("checkGraphButton") && focusSequence.includes("nextButton"),
    `${label}: no answer-check control is exposed while task navigation remains reachable`);
  assert.equal(focusSequence.at(-1), "graph-surface",
    `${label}: graph surface follows task controls without focus becoming trapped`);
  assert.equal(await evaluate(cdp, `document.querySelector('#taskSection [data-tool="pen"]').getAttribute('aria-pressed')`),
    "true", `${label}: challenge resets the active tool to pen`);
  await touch(cdp, "touchStart", taskSurface.x, taskSurface.y);
  await touch(cdp, "touchMove", taskSurface.x + 150, taskSurface.y);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const taskSaved = await evaluate(cdp, `(() => {
    const state=window.__kinematicsGraphDebug.getState();
    const writes=window.SimScorm.getLocalLog().filter(entry=>entry.key==='cmi.suspend_data');
    return {answer:state.answers[state.taskIndex],draft:writes.at(-1)?.value||'',
      incompleteHint:!document.getElementById("stageCompletenessHint").classList.contains("is-hidden")};
  })()`);
  assert.equal(typeof taskSaved.answer, "string", `${label}: committed task trace becomes authoritative answer`);
  assert.match(taskSaved.draft, /"kind":"draft"/, `${label}: semantic task change saves through shared SCORM runtime`);
  assert.equal(taskSaved.incompleteHint, true, `${label}: partial trace gets a subtle non-scoring completion hint`);

  const beforeCancel = await evaluate(cdp, `(() => ({
    answer:window.__kinematicsGraphDebug.getState().answers[window.__kinematicsGraphDebug.getState().taskIndex],
    cancel:window.__kinematicsGraphDebug.getPointerDiagnostics().cancel
  }))()`);
  await touch(cdp, "touchStart", taskSurface.x + 20, taskSurface.y - 20);
  await touch(cdp, "touchMove", taskSurface.x + 70, taskSurface.y - 55);
  await touch(cdp, "touchCancel", 0, 0);
  await delay(50);
  const afterCancel = await evaluate(cdp, `(() => ({
    answer:window.__kinematicsGraphDebug.getState().answers[window.__kinematicsGraphDebug.getState().taskIndex],
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
  const beforeKeyboard = await evaluate(cdp, `(() => { const s=window.__kinematicsGraphDebug.getState(); return s.answers[s.taskIndex]; })()`);
  await pressKey(cdp, " ", "Space");
  await pressKey(cdp, "ArrowRight", "ArrowRight");
  await pressKey(cdp, "ArrowUp", "ArrowUp");
  await pressKey(cdp, " ", "Space");
  await delay(50);
  const afterKeyboard = await evaluate(cdp, `(() => { const s=window.__kinematicsGraphDebug.getState(); return s.answers[s.taskIndex]; })()`);
  assert.notEqual(afterKeyboard, beforeKeyboard, `${label}: trusted keyboard drawing commits and saves`);

  const fullStroke = await evaluate(cdp, `(() => {
    const surface=document.querySelector("#taskMount .graph-input-surface");
    surface.scrollIntoView({block:"center"});
    const rect=surface.getBoundingClientRect();
    return {left:rect.left+2,right:rect.right-2,y:rect.top+rect.height*.55};
  })()`);
  await touch(cdp, "touchStart", fullStroke.left, fullStroke.y);
  for (let index = 1; index <= 12; index += 1) {
    await touch(cdp, "touchMove", fullStroke.left + (fullStroke.right - fullStroke.left) * index / 12, fullStroke.y);
  }
  await touch(cdp, "touchEnd", 0, 0);
  await delay(70);
  const completedTrace = await evaluate(cdp, `(() => {
    const s=window.__kinematicsGraphDebug.getState();
    return {answer:s.answers[s.taskIndex],
      hintHidden:document.getElementById("stageCompletenessHint").classList.contains("is-hidden")};
  })()`);
  assert.equal(completedTrace.hintHidden, true, `${label}: full continuous trace clears the completion hint`);

  const beforeClear = completedTrace.answer;
  await clickSelector(cdp, '#taskSection [data-action="clear"]');
  const cleared = await evaluate(cdp, `(() => {
    const s=window.__kinematicsGraphDebug.getState();
    return {answer:s.answers[s.taskIndex],disabled:document.querySelector('#taskSection [data-action="clear"]').disabled,
      hintHidden:document.getElementById("stageCompletenessHint").classList.contains("is-hidden")};
  })()`);
  assert.equal(cleared.answer, null, `${label}: one-click clear immediately clears the authoritative answer`);
  assert.equal(cleared.disabled, true, `${label}: clear is disabled for a blank trace`);
  assert.equal(cleared.hintHidden, true, `${label}: blank graph does not add a redundant visual warning`);
  await clickSelector(cdp, '[data-switch-task="0"]');
  await clickSelector(cdp, '[data-switch-task="2"]');
  await clickSelector(cdp, '#taskSection [data-action="undo"]');
  const afterClearUndo = await evaluate(cdp, `(() => {
    const s=window.__kinematicsGraphDebug.getState(); return s.answers[s.taskIndex];
  })()`);
  assert.equal(afterClearUndo, beforeClear, `${label}: per-task undo restores clear after switching away and back`);

  await clickSelector(cdp, '[data-switch-task="0"]');
  const switched = await evaluate(cdp, `(() => {
    const s=window.__kinematicsGraphDebug.getState();
    return {index:s.taskIndex,xt:s.answers[2],pressed:document.querySelector('[data-switch-task="0"]').getAttribute("aria-pressed")};
  })()`);
  assert.equal(switched.index, 0, `${label}: scenario graph buttons freely switch to v-t`);
  assert.equal(switched.xt, beforeClear, `${label}: switching graphs preserves canonical x-t answer storage`);
  assert.equal(switched.pressed, "true", `${label}: active graph button exposes aria-pressed`);
  await clickSelector(cdp, "#nextButton");
  assert.equal(await evaluate(cdp, `window.__kinematicsGraphDebug.getState().taskIndex`), 1,
    `${label}: next visits the remaining a-t graph`);
  await clickSelector(cdp, "#nextButton");
  assert.equal(await evaluate(cdp, `window.__kinematicsGraphDebug.getState().taskIndex`),
    Tasks.taskIndexById("accelerating-xt"), `${label}: visiting all three graphs advances with blanks left for review`);
  for (let index = 0; index < 9; index += 1) await clickSelector(cdp, "#nextButton");
  assert.equal(await evaluate(cdp, `window.__kinematicsGraphDebug.getState().phase`), "review",
    `${label}: visiting all display-ordered graphs reaches review`);
  await clickSelector(cdp, '[data-edit-task="2"]');
  assert.equal(await evaluate(cdp, `document.querySelector('#taskSection [data-action="redo"]').disabled`), false,
    `${label}: per-task redo history survives review and review-edit`);
  await clickSelector(cdp, '#taskSection [data-action="redo"]');
  assert.equal(await evaluate(cdp, `window.__kinematicsGraphDebug.getState().answers[2]`), null,
    `${label}: review-edit restores the same per-task editor history`);
  await clickSelector(cdp, '#taskSection [data-action="undo"]');
  assert.equal(await evaluate(cdp, `window.__kinematicsGraphDebug.getState().answers[2]`), beforeClear,
    `${label}: review-edit undo restores the cleared trace again`);
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
  await settleHostScroll(cdp, 150, label);
  const panelSwipe = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel");
    panel.scrollTop=0;
    const target=doc.querySelector(".graph-page-header p");
    const f=frame.getBoundingClientRect(), r=target.getBoundingClientRect();
    const stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {x:f.left+r.left+r.width*.5,y:f.top+r.top+r.height*.5,
      host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,
      panelRange:panel.scrollHeight-panel.clientHeight,frameTop:f.top,stageTop:stage.top,stageHeight:stage.height,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
  })()`);
  assert.ok(panelSwipe.panelRange > 40, `${label}: fixed-height iframe has an independently scrollable controls panel`);
  await touch(cdp, "touchStart", panelSwipe.x, panelSwipe.y);
  await touch(cdp, "touchMove", panelSwipe.x, panelSwipe.y - 80);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const panelAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel"), stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,
      frameTop:frame.getBoundingClientRect().top,stageTop:stage.top,stageHeight:stage.height,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
  })()`);
  assert.ok(panelAfter.panel > panelSwipe.panel, `${label}: ordinary controls text scrolls only the controls panel`);
  for (const key of ["host", "inner", "frameTop", "stageTop", "stageHeight", "hostVvOffset", "hostVvPage", "vvOffset", "vvPage", "answer"]) {
    assert.equal(panelAfter[key], panelSwipe[key], `${label}: controls swipe keeps ${key} fixed`);
  }

  const atBoundary = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel");
    panel.scrollTop=panel.scrollHeight;
    const nav=doc.querySelector(".practice-navigation").getBoundingClientRect(), f=frame.getBoundingClientRect();
    const stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {x:f.left+nav.left+18,y:f.top+nav.top+Math.min(nav.height*.5,22),
      host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,panelMax:panel.scrollHeight-panel.clientHeight,
      frameTop:f.top,stageTop:stage.top,stageHeight:stage.height,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
  })()`);
  assert.ok(Math.abs(atBoundary.panel - atBoundary.panelMax) < 1, `${label}: panel begins at its bottom boundary`);
  await touch(cdp, "touchStart", atBoundary.x, atBoundary.y);
  await touch(cdp, "touchMove", atBoundary.x, atBoundary.y - 70);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(80);
  const boundaryAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel"), stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {host:scrollY,inner:frame.contentWindow.scrollY,
      panel:panel.scrollTop,panelMax:panel.scrollHeight-panel.clientHeight,
      frameTop:frame.getBoundingClientRect().top,stageTop:stage.top,stageHeight:stage.height,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
  })()`);
  assert.ok(Math.abs(boundaryAfter.panel - boundaryAfter.panelMax) < 1, `${label}: bottom-boundary outward swipe keeps the panel at bottom`);
  for (const key of Object.keys(atBoundary)) {
    if (!["x", "y", "panelMax"].includes(key)) assert.equal(boundaryAfter[key], atBoundary[key],
      `${label}: panel bottom-boundary outward swipe keeps ${key} fixed`);
  }

  await delay(250);
  const topBoundary = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const panel=doc.getElementById("controlsPanel");
    panel.scrollTop=0;
    const target=doc.querySelector(".graph-page-header p"), r=target.getBoundingClientRect(), f=frame.getBoundingClientRect();
    const stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {x:f.left+r.left+r.width*.5,y:f.top+r.top+r.height*.5,
      host:scrollY,inner:frame.contentWindow.scrollY,panel:panel.scrollTop,frameTop:f.top,stageTop:stage.top,stageHeight:stage.height,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
  })()`);
  await touch(cdp, "touchStart", topBoundary.x, topBoundary.y);
  await touch(cdp, "touchMove", topBoundary.x, topBoundary.y + 70);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(80);
  const topBoundaryAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById("activity"), doc=frame.contentDocument;
    const stage=doc.getElementById("stageRegion").getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {host:scrollY,inner:frame.contentWindow.scrollY,panel:frame.contentDocument.getElementById("controlsPanel").scrollTop,
      frameTop:frame.getBoundingClientRect().top,stageTop:stage.top,stageHeight:stage.height,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
  })()`);
  for (const key of Object.keys(topBoundary)) {
    if (!["x", "y"].includes(key)) assert.equal(topBoundaryAfter[key], topBoundary[key],
      `${label}: panel top-boundary outward swipe keeps ${key} fixed`);
  }

  async function stageSwipe(hostStart, deltaY, description) {
    await settleHostScroll(cdp, hostStart, `${label}: ${description}`);
    const setup = await evaluate(cdp, `(() => {
      const frame=document.getElementById("activity"), doc=frame.contentDocument;
      const stage=doc.getElementById("stageRegion"), bounds=stage.getBoundingClientRect();
      const frameBounds=frame.getBoundingClientRect();
      const x=bounds.left+3, y=bounds.top+bounds.height/2;
      const target=doc.elementFromPoint(x,y);
      const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
      return {
        x:frameBounds.left+x,y:frameBounds.top+y,
        target:target?.id||target?.className||"",
        host:scrollY,inner:frame.contentWindow.scrollY,
        panel:doc.getElementById("controlsPanel").scrollTop,
        frameTop:frameBounds.top,stageTop:bounds.top,
        hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
        vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
        answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())
      };
    })()`);
    assert.match(String(setup.target), /stageRegion|stage-region/,
      `${label}: ${description} starts on noninteractive stage content (${JSON.stringify(setup)})`);
    await touch(cdp, "touchStart", setup.x, setup.y);
    await touch(cdp, "touchMove", setup.x, setup.y + deltaY);
    await touch(cdp, "touchEnd", 0, 0);
    await delay(100);
    const after = await evaluate(cdp, `(() => {
      const frame=document.getElementById("activity"), doc=frame.contentDocument;
      const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
      return {host:scrollY,inner:frame.contentWindow.scrollY,
        panel:doc.getElementById("controlsPanel").scrollTop,
        frameTop:frame.getBoundingClientRect().top,stageTop:doc.getElementById("stageRegion").getBoundingClientRect().top,
        hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
        vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
        answer:JSON.stringify(frame.contentWindow.__kinematicsGraphDebug.getState())};
    })()`);
    assert.equal(after.inner, setup.inner, `${label}: ${description} does not scroll the activity document`);
    assert.equal(after.panel, setup.panel, `${label}: ${description} does not scroll the controls panel`);
    assert.equal(after.answer, setup.answer, `${label}: ${description} does not change an answer`);
    assert.equal(after.stageTop, setup.stageTop, `${label}: ${description} keeps the activity stage fixed`);
    assert.equal(after.vvOffset, setup.vvOffset, `${label}: ${description} keeps the activity visual viewport fixed`);
    assert.equal(after.vvPage, setup.vvPage, `${label}: ${description} keeps the activity visual page fixed`);
    assert.equal(after.hostVvOffset, setup.hostVvOffset, `${label}: ${description} keeps the host visual viewport offset fixed`);
    assert.equal(after.hostVvPage - setup.hostVvPage, after.host - setup.host,
      `${label}: ${description} host visual viewport tracks the host scroll`);
    assert.ok(Math.abs((after.frameTop - setup.frameTop) + (after.host - setup.host)) < 0.5,
      `${label}: ${description} moves the iframe with the host`);
    return { setup, after };
  }

  const stageUp = await stageSwipe(150, -90, "upward stage swipe");
  assert.ok(stageUp.after.host > stageUp.setup.host, `${label}: upward noninteractive stage swipe scrolls the host down`);
  const stageDown = await stageSwipe(stageUp.after.host, 90, "downward stage swipe");
  assert.ok(stageDown.after.host < stageDown.setup.host, `${label}: downward noninteractive stage swipe scrolls the host up`);
  const stageBoundary = await stageSwipe(0, 90, "stage swipe at host top boundary");
  assert.equal(stageBoundary.after.host, 0, `${label}: host top boundary remains stable`);

  const draw = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    const doc=frame.contentDocument;
    const surface=doc.querySelector('#practiceMount .graph-input-surface');
    const f=frame.getBoundingClientRect();
    const r=surface.getBoundingClientRect();
    const f2=frame.getBoundingClientRect(), r2=surface.getBoundingClientRect();
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {x:f2.left+r2.left+r2.width*.2,y:f2.top+r2.top+r2.height*.6,host:scrollY,inner:frame.contentWindow.scrollY,
      panel:doc.getElementById("controlsPanel").scrollTop,frameTop:f2.top,
      stageTop:doc.getElementById("stageRegion").getBoundingClientRect().top,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      count:Array.from(frame.contentWindow.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length};
  })()`);
  await touch(cdp, "touchStart", draw.x, draw.y);
  await touch(cdp, "touchMove", draw.x + 120, draw.y - 50);
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
  const drawAfter = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    const vv=frame.contentWindow.visualViewport, hostVv=visualViewport;
    return {host:scrollY,inner:frame.contentWindow.scrollY,
      panel:frame.contentDocument.getElementById("controlsPanel").scrollTop,
      frameTop:frame.getBoundingClientRect().top,
      stageTop:frame.contentDocument.getElementById("stageRegion").getBoundingClientRect().top,
      hostVvOffset:hostVv?.offsetTop||0,hostVvPage:hostVv?.pageTop||0,
      vvOffset:vv?.offsetTop||0,vvPage:vv?.pageTop||0,
      count:Array.from(frame.contentWindow.__kinematicsGraphDebug.getActiveTrace()).filter(v=>v!==255).length,
      pointer:frame.contentWindow.__kinematicsGraphDebug.getPointerDiagnostics()};
  })()`);
  assert.equal(drawAfter.host, draw.host, `${label}: drawing does not scroll host`);
  assert.equal(drawAfter.inner, draw.inner, `${label}: drawing does not scroll activity document`);
  assert.equal(drawAfter.panel, draw.panel, `${label}: drawing does not scroll controls panel`);
  assert.equal(drawAfter.frameTop, draw.frameTop, `${label}: drawing leaves iframe position fixed`);
  assert.equal(drawAfter.stageTop, draw.stageTop, `${label}: drawing leaves graph stage fixed`);
  assert.equal(drawAfter.hostVvOffset, draw.hostVvOffset, `${label}: drawing leaves host visual viewport offset fixed`);
  assert.equal(drawAfter.hostVvPage, draw.hostVvPage, `${label}: drawing leaves host visual page fixed`);
  assert.equal(drawAfter.vvOffset, draw.vvOffset, `${label}: drawing leaves activity visual viewport fixed`);
  assert.equal(drawAfter.vvPage, draw.vvPage, `${label}: drawing leaves activity visual page fixed`);
  assert.ok(drawAfter.count > draw.count, `${label}: iframe drawing changes only trace`);
  assert.ok(drawAfter.pointer.move >= 1 && drawAfter.pointer.up >= 1 && drawAfter.pointer.cancel === 0,
    `${label}: iframe draw completes with pointermove/pointerup and no cancellation`);
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
  for (const [width, height] of [[320, 500], [390, 500], [390, 600], [402, 874], [700, 390], [768, 1024], [820, 700], [874, 402], [1024, 700], [1024, 768], [1366, 1024], [1440, 900], [1920, 1080]]) {
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
      const stage=document.getElementById("stageRegion").getBoundingClientRect();
      const controls=document.getElementById("controlsPanel").getBoundingClientRect();
      const app=document.querySelector(".graph-app").getBoundingClientRect();
      const progress=Array.from(document.querySelectorAll(".progress li")).map(item=>item.getBoundingClientRect());
      return {
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        buttonVisible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
        boardVisible:board.width>220&&board.height>160,
        board:{width:board.width,height:board.height},
        app:{left:app.left,right:app.right,width:app.width},
        progressRows:new Set(progress.map(item=>Math.round(item.top))).size,
        stage:{left:stage.left,top:stage.top,right:stage.right,bottom:stage.bottom,width:stage.width,height:stage.height},
        controls:{left:controls.left,top:controls.top,right:controls.right,bottom:controls.bottom,width:controls.width,height:controls.height}
      };
    })()`);
    assert.ok(metrics.overflow <= 1, `${label} ${width}x${height}: no horizontal overflow`);
    assert.equal(metrics.buttonVisible, true, `${label} ${width}x${height}: primary navigation remains reachable`);
    assert.equal(metrics.boardVisible, true, `${label} ${width}x${height}: graph remains readable`);
    assert.equal(metrics.progressRows, 1, `${label} ${width}x${height}: progress remains on one row`);
    if (width >= 820) {
      assert.ok(metrics.app.left <= 1 && metrics.app.right >= width - 1,
        `${label} ${width}x${height}: desktop work area fills the viewport width`);
      assert.ok(metrics.controls.right <= metrics.stage.left + 2,
        `${label} ${width}x${height}: desktop controls remain left of the graph`);
      assert.ok(metrics.stage.width > metrics.controls.width,
        `${label} ${width}x${height}: desktop graph remains the dominant region`);
    } else {
      assert.ok(metrics.stage.bottom <= metrics.controls.top + 2,
        `${label} ${width}x${height}: phone/tablet graph remains above controls`);
    }
    if (width === 402 && height === 874) {
      assert.ok(metrics.stage.height <= metrics.board.height + 18,
        `${label} ${width}x${height}: portrait stage hugs the graph instead of reserving blank height`);
      assert.ok(metrics.board.width >= 350,
        `${label} ${width}x${height}: portrait graph uses the available width`);
    }
    if (width === 768 && height === 1024) {
      assert.ok(metrics.board.width >= 720,
        `${label} ${width}x${height}: portrait tablet graph uses the available width`);
      assert.ok(metrics.stage.height <= metrics.board.height + 18,
        `${label} ${width}x${height}: portrait tablet stage avoids vertical padding`);
    }
    if (width === 874 && height === 402) {
      assert.ok(metrics.board.width >= 480,
        `${label} ${width}x${height}: wide short desktop graph uses the stage`);
    }
    if (width === 1024 && height === 768) {
      assert.ok(metrics.board.width >= 720,
        `${label} ${width}x${height}: landscape tablet graph uses the available stage width`);
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 512, height: 650, deviceScaleFactor: 1, mobile: true
  });
  await navigate(cdp, `${baseUrl}${launchPath}?responsive=effective-width-pinch`);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  const zoomed = await evaluate(cdp, `(() => {
    const button=document.getElementById("startChallengeButton");
    button.scrollIntoView({block:"center"});
    const r=button.getBoundingClientRect();
    const stage=document.getElementById("stageRegion").getBoundingClientRect();
    const controls=document.getElementById("controlsPanel").getBoundingClientRect();
    return {
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      buttonWidth:r.width, buttonHeight:r.height,
      visualScale:visualViewport?.scale||1,
      stacked:stage.bottom<=controls.top+2
    };
  })()`);
  assert.ok(zoomed.overflow <= 1, `${label}: effective-width/pinch visual safety has no document-level horizontal overflow`);
  assert.ok(zoomed.buttonWidth >= 44 && zoomed.buttonHeight >= 44,
    `${label}: primary action remains operable under effective-width/pinch visual safety`);
  assert.ok(zoomed.visualScale >= 1.9, `${label}: pinch visual scale was applied`);
  assert.equal(zoomed.stacked, true, `${label}: effective-width layout retains the top/bottom arrangement`);
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
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  const fixture = reviewFixture();
  const taskDraft = {
    v: Persistence.VERSION,
    taskSetVersion: Tasks.TASK_SET_VERSION,
    phase: "task",
    taskIndex: 0,
    variant: "first-pass",
    visitedMask: 5,
    answers: [fixture.answers[0], ...Array(Tasks.TASKS.length - 1).fill(null)]
  };
  const reviewDraft = {
    version: 1, activity, kind: "draft", answer: fixture.state
  };
  const incompleteState = structuredClone(fixture.state);
  incompleteState.answers[0] = null;
  const incompleteReviewDraft = {
    version: 1, activity, kind: "draft", answer: incompleteState
  };

  await setPreload(cdp, lmsValues(reviewDraft));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=review-display-order`);
  assert.deepEqual(await evaluate(cdp, `Array.from(document.querySelectorAll("[data-edit-task]"))
    .slice(0,3).map(button=>button.dataset.editTask)`), ["2", "0", "1"],
  `${label}: review list uses x-t, v-t, a-t display order with canonical indices`);
  const reviewLayout = await evaluate(cdp, `(() => {
    const app=document.querySelector(".graph-app").getBoundingClientRect();
    const controls=document.getElementById("controlsPanel").getBoundingClientRect();
    const review=document.getElementById("reviewSection").getBoundingClientRect();
    return {appHeight:app.height,controlsHeight:controls.height,reviewHeight:review.height,controlsTop:controls.top};
  })()`);
  assert.ok(reviewLayout.controlsHeight >= reviewLayout.appHeight - 2,
    `${label}: desktop no-stage review controls retain the full app height`);
  assert.ok(reviewLayout.reviewHeight > 300 && reviewLayout.controlsTop <= 1,
    `${label}: desktop review content is not collapsed into a zero-height grid row`);

  const contradictionState = structuredClone(fixture.state);
  contradictionState.answers[Tasks.taskIndexById("accelerating-vt")] =
    Model.encodeTrace(Scoring.exemplarTrace("decelerating-vt"));
  await setPreload(cdp, lmsValues({ version: 1, activity, kind: "draft", answer: contradictionState }));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=review-contradiction-placement`);
  assert.ok(await evaluate(cdp, `window.__kinematicsGraphDebug.score().contradictions.length > 0`),
    `${label}: contradiction fixture contains a cross-graph diagnostic`);
  assert.equal(await evaluate(cdp, `document.querySelectorAll("#reviewSection .contradiction-box").length`), 0,
    `${label}: editable review does not reveal cross-graph contradictions`);
  await clickSelector(cdp, "#submitButton");
  assert.match(await evaluate(cdp, `document.getElementById("scorePanel").textContent`), /三圖關係提示/,
    `${label}: locked result presents cross-graph contradictions`);

  await setPreload(cdp, lmsValues({ version: 1, activity, kind: "draft", answer: taskDraft }));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=valid-draft`);
  const restored = await evaluate(cdp, `(() => {
    const state=window.__kinematicsGraphDebug.getState();
    const surface=document.querySelector("#taskMount .graph-input-surface");
    return {mode:window.__kinematicsGraphDebug.getMode(),phase:state.phase,index:state.taskIndex,answer:state.answers[0],
      tabIndex:surface.tabIndex,graphLabel:surface.getAttribute("aria-label")};
  })()`);
  assert.equal(restored.mode, "activity", `${label}: valid task draft restores in activity mode`);
  assert.equal(restored.phase, "task");
  assert.equal(restored.index, 0);
  assert.equal(restored.answer, fixture.answers[0]);
  assert.equal(restored.tabIndex, 0, `${label}: editable restored graph is keyboard focusable`);
  assert.match(restored.graphLabel, /空白鍵|方向鍵/, `${label}: editable graph advertises keyboard drawing controls`);

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
    tabs:document.querySelectorAll("[data-result-task]").length,
    firstTabs:Array.from(document.querySelectorAll("[data-result-task]")).slice(0,3)
      .map(button=>button.dataset.resultTask),
    pressed:document.querySelector("[data-result-task][aria-pressed='true']")?.dataset.resultTask,
    tabIndex:document.querySelector("#resultGraphMount .graph-input-surface")?.tabIndex,
    graphLabel:document.querySelector("#resultGraphMount .graph-input-surface")?.getAttribute("aria-label")
  }))()`);
  assert.equal(trusted.mode, "submitted", `${label}: trusted finished attempt enters submitted review`);
  assert.equal(trusted.graphHidden, false, `${label}: trusted review displays submitted graph`);
  assert.equal(trusted.tabs, Tasks.TASKS.length, `${label}: all submitted graphs remain reviewable`);
  assert.deepEqual(trusted.firstTabs, ["2", "0", "1"], `${label}: result graphs use x-t, v-t, a-t display order`);
  assert.equal(trusted.pressed, "2", `${label}: result review defaults to uniform x-t`);
  assert.equal(trusted.tabIndex, -1, `${label}: locked result graph is removed from keyboard focus`);
  assert.match(trusted.graphLabel, /只讀/, `${label}: locked result graph has a read-only accessible label`);
  assert.doesNotMatch(trusted.graphLabel, /空白鍵|方向鍵/,
    `${label}: locked result graph does not advertise editing shortcuts`);

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

  for (const [name, mutate] of [
    ["missing-max", (snapshot) => { delete snapshot.maxScore; }],
    ["zero-max", (snapshot) => { snapshot.maxScore = 0; }],
    ["non-boolean-pass", (snapshot) => { snapshot.passed = "true"; }]
  ]) {
    const invalidMetadata = structuredClone(fixture.reviewSnapshot);
    mutate(invalidMetadata);
    await setPreload(cdp, lmsValues(invalidMetadata, fixture.result.passed ? "passed" : "failed", fixture.result.score));
    await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=finished-${name}`);
    const metadataFallback = await evaluate(cdp, `(() => ({
      graphHidden:document.getElementById("resultGraphMount").classList.contains("is-hidden"),
      tabs:document.querySelectorAll("[data-result-task]").length,
      notice:document.getElementById("resultNotice").textContent
    }))()`);
    assert.equal(metadataFallback.graphHidden, true, `${label}: ${name} finished metadata hides untrusted graph details`);
    assert.equal(metadataFallback.tabs, 0, `${label}: ${name} finished metadata exposes no answer tabs`);
    assert.match(metadataFallback.notice, /未能安全驗證/, `${label}: ${name} finished metadata uses fallback copy`);
  }

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

  const zeroMaxPending = structuredClone(pendingSnapshot);
  zeroMaxPending.payload.maxScore = 0;
  await setPreload(cdp, lmsValues(zeroMaxPending));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=pending-zero-max`);
  const zeroMaxQuarantined = await evaluate(cdp, `(() => ({
    mode:window.__kinematicsGraphDebug.getMode(),
    retry:!document.getElementById("resultRetryButton").classList.contains("is-hidden")
  }))()`);
  assert.deepEqual(zeroMaxQuarantined, { mode: "technical", retry: false },
    `${label}: pending maxScore 0 is quarantined instead of falling back to 100`);

  await setPreload(cdp, lmsValues(incompleteReviewDraft));
  await navigate(cdp, `${baseUrl}${launchPath}?lifecycle=incomplete-confirmation`);
  await evaluate(cdp, `(() => {
    window.__submitCalls=0;
    const original=window.SimScorm.submitWithCallbacks;
    window.SimScorm.submitWithCallbacks=(...args)=>{
      window.__submitCalls+=1;
      return original(...args);
    };
  })()`);
  const cancelDialog = respondToNextDialog(cdp, false);
  await clickSelector(cdp, "#submitButton");
  assert.match(await cancelDialog, /仍有空白、覆蓋不足或不可判讀圖線/,
    `${label}: incomplete submission explains the evidence risk`);
  const cancelledSubmit = await evaluate(cdp, `(() => ({
    calls:window.__submitCalls,
    mode:window.__kinematicsGraphDebug.getMode()
  }))()`);
  assert.deepEqual(cancelledSubmit, { calls: 0, mode: "activity" },
    `${label}: cancelling incomplete submission keeps the review editable and does not submit`);
  const acceptDialog = respondToNextDialog(cdp, true);
  await clickSelector(cdp, "#submitButton");
  await acceptDialog;
  const confirmedSubmit = await evaluate(cdp, `(() => ({
    calls:window.__submitCalls,
    mode:window.__kinematicsGraphDebug.getMode()
  }))()`);
  assert.equal(confirmedSubmit.calls, 1, `${label}: explicit confirmation submits exactly once`);
  assert.equal(confirmedSubmit.mode, "submitted", `${label}: confirmed incomplete submission reaches the submitted review`);

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
