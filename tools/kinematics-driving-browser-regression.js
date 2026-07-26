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
const Scoring = require(path.join(root, "sim", slug, "scoring.js"));
const activePreloads = new WeakMap();
const preloadCounts = new WeakMap();

async function replacePreload(cdp, source = "") {
  const previous = activePreloads.get(cdp);
  const counts = preloadCounts.get(cdp) || { installed: 0, removed: 0 };
  if (previous) {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: previous });
    activePreloads.delete(cdp);
    counts.removed += 1;
  }
  if (source) {
    const { identifier } = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source });
    activePreloads.set(cdp, identifier);
    counts.installed += 1;
  }
  preloadCounts.set(cdp, counts);
}

async function navigate(cdp, url, preload = "") {
  await replacePreload(cdp, preload);
  await cdp.send("Page.navigate", { url });
}

function lmsPreload(values) {
  return `(() => {
    const values=${JSON.stringify(values)};
    const log={initialize:0,gets:[],sets:[],commits:0,finishes:0};
    window.__lmsHarness={values,log};
    window.API={
      LMSInitialize:()=>{log.initialize+=1;return 'true';},
      LMSGetValue:(key)=>{log.gets.push(key);return Object.prototype.hasOwnProperty.call(values,key)?String(values[key]):'';},
      LMSSetValue:(key,value)=>{values[key]=String(value);log.sets.push({key,value:String(value)});return 'true';},
      LMSCommit:()=>{log.commits+=1;return 'true';},
      LMSFinish:()=>{log.finishes+=1;return 'true';},
      LMSGetLastError:()=>'0',
      LMSGetErrorString:()=>''
    };
  })();`;
}
function catchupFailurePreload(snapshot) {
  return `(() => {
    const values={
      'cmi.core.lesson_status':'incomplete',
      'cmi.suspend_data':${JSON.stringify(snapshot)},
      'cmi.core.score.raw':''
    };
    const lms=window.__catchupLms={
      values,failCommit:false,
      log:{sets:[],commits:[],finishes:0}
    };
    window.API={
      LMSInitialize:()=>'true',
      LMSGetValue:(key)=>Object.prototype.hasOwnProperty.call(values,key)?String(values[key]):'',
      LMSSetValue:(key,value)=>{values[key]=String(value);lms.log.sets.push({key,value:String(value)});return 'true';},
      LMSCommit:()=>{const ok=!lms.failCommit;lms.log.commits.push(ok);return ok?'true':'false';},
      LMSFinish:()=>{lms.log.finishes+=1;return 'true';},
      LMSGetLastError:()=>lms.failCommit?'101':'0',
      LMSGetErrorString:()=>lms.failCommit?'forced draft commit failure':''
    };
    let nextId=1;
    const callbacks=new Map();
    window.__catchupRaf={
      runNamed:(name,delta)=>{
        const entry=Array.from(callbacks.entries()).find(([,callback])=>callback.name===name);
        if(!entry)return false;
        callbacks.delete(entry[0]);
        entry[1](performance.now()+delta);
        return true;
      },
      flush:(delta=0)=>{
        let guard=0;
        while(callbacks.size&&guard<50){
          const [id,callback]=callbacks.entries().next().value;
          callbacks.delete(id);
          callback(performance.now()+delta);
          guard+=1;
        }
        return {guard,pending:callbacks.size,names:Array.from(callbacks.values(),callback=>callback.name)};
      },
      pending:()=>Array.from(callbacks.values(),callback=>callback.name)
    };
    window.requestAnimationFrame=(callback)=>{const id=nextId++;callbacks.set(id,callback);return id;};
    window.cancelAnimationFrame=(id)=>{callbacks.delete(id);};
  })();`;
}

function pagehideSettlePreload(snapshot) {
  return `(() => {
    const values={
      'cmi.core.lesson_status':'incomplete',
      'cmi.suspend_data':${JSON.stringify(snapshot)},
      'cmi.core.score.raw':''
    };
    let now=1000;
    try { Object.defineProperty(performance,'now',{configurable:true,value:()=>now}); }
    catch { performance.now=()=>now; }
    const lms=window.__settleLms={values,log:{sets:[],commits:0,finishes:0}};
    window.API={
      LMSInitialize:()=>'true',
      LMSGetValue:(key)=>Object.prototype.hasOwnProperty.call(values,key)?String(values[key]):'',
      LMSSetValue:(key,value)=>{values[key]=String(value);lms.log.sets.push({key,value:String(value)});return 'true';},
      LMSCommit:()=>{lms.log.commits+=1;return 'true';},
      LMSFinish:()=>{lms.log.finishes+=1;return 'true';},
      LMSGetLastError:()=>'0',
      LMSGetErrorString:()=>''
    };
    let nextId=1;
    const callbacks=new Map();
    window.__settleClock={
      now:()=>now,
      advance:(delta)=>{now+=delta;return now;},
      pending:()=>Array.from(callbacks.values(),callback=>callback.name),
      executed:0
    };
    window.requestAnimationFrame=(callback)=>{const id=nextId++;callbacks.set(id,callback);return id;};
    window.cancelAnimationFrame=(id)=>{callbacks.delete(id);};
  })();`;
}

function reviewFixture() {
  const draft = JSON.parse(completeReviewDraft());
  const state = Persistence.decode(draft.answer);
  assert(state, "complete browser review fixture decodes");
  const result = Scoring.scoreActivity(state.selectedRuns, state.graphCheckpoint);
  const review = {
    version: 1,
    activity: slug,
    kind: "review",
    answer: Persistence.makeReview(state),
    score: result.score,
    passed: result.passed
  };
  const payload = {
    reviewJson: JSON.stringify(review),
    score: result.score,
    maxScore: result.maxScore,
    passed: result.passed
  };
  return {
    result,
    review,
    pending: { version: 1, activity: slug, kind: "pending-final", payload }
  };
}

function terminalCodes(level, code) {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) { codes.push(code); run = Model.replay(level, codes); }
  return codes;
}
function maxTickCodes(level) {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    const zone = Levels.segmentAt(level, run.state.x);
    const desiredAcceleration = .8 * (.5 - run.state.v);
    const code = Array.from({ length: 7 }, (_, candidate) => candidate).reduce((best, candidate) =>
      Math.abs(Model.accelerationFor(run.state.v, zone.slopeDeg, candidate) - desiredAcceleration) <
      Math.abs(Model.accelerationFor(run.state.v, zone.slopeDeg, best) - desiredAcceleration) ? candidate : best, 0);
    codes.push(code);
    run = Model.replay(level, codes);
  }
  assert.equal(run.state.terminal, "max-ticks");
  return codes;
}
function analysisDraft(levelId = "level1") {
  const level = Levels.levelById(levelId);
  const fixedCodes = { level1: 0, level2: 2, level3: 5, level4: 2, level5: 2 };
  const codes = levelId === "level1" ? maxTickCodes(level) : terminalCodes(level, fixedCodes[levelId]);
  if (levelId === "level5") {
    const selectedRuns = Object.fromEntries(Levels.LEVELS.map((item) =>
      [item.id, { revision: 1, codes: terminalCodes(item, fixedCodes[item.id]) }]
    ));
    const state = {
      ...Persistence.initialState(), phase: "level", variant: "review-retry-analysis", currentItem: "level5",
      returnToReview: true, selectedRuns, candidateRun: { ownerId: "level5", codes },
      graphCheckpoint: {
        sourceLevelId: "level2", sourceRunRevision: 1, viewedXt: true, viewedVt: true, answerId: "vt-linear"
      }
    };
    return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
  }
  const state = {
    ...Persistence.initialState(), phase: "level", variant: "analysis", currentItem: "level1",
    candidateRun: { ownerId: "level1", codes }
  };
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function completeReviewDraft() {
  const fixedCodes = { level1: 0, level2: 2, level3: 5, level4: 2, level5: 2 };
  const selectedRuns = Object.fromEntries(Levels.LEVELS.map((level) =>
    [level.id, { revision: 1, codes: terminalCodes(level, fixedCodes[level.id]) }]
  ));
  const state = {
    ...Persistence.initialState(), phase: "review", variant: "complete", currentItem: "review",
    selectedRuns,
    graphCheckpoint: {
      sourceLevelId: "level2", sourceRunRevision: 1, viewedXt: true, viewedVt: true, answerId: "vt-linear"
    }
  };
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function graphCheckpointDraft() {
  const level = Levels.levelById("level2");
  const codes = terminalCodes(level, 2);
  const selectedRuns = { level2: { revision: 1, codes } };
  const state = {
    ...Persistence.initialState(),
    phase: "graph-check",
    variant: "exploring",
    currentItem: "checkpoint",
    selectedRuns,
    graphCheckpoint: {
      sourceLevelId: "level2",
      sourceRunRevision: 1,
      viewedXt: false,
      viewedVt: false,
      answerId: null
    }
  };
  assert(Persistence.validateState(state, false), "graph checkpoint browser fixture is valid");
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function levelFourPreviewDraft() {
  const correctCodes = { level1: 1, level2: 2, level3: 5 };
  const selectedRuns = Object.fromEntries(Levels.LEVELS.slice(0, 3).map((level) =>
    [level.id, { revision: 1, codes: terminalCodes(level, correctCodes[level.id]) }]
  ));
  const state = {
    ...Persistence.initialState(), phase: "level", variant: "paused", currentItem: "level4",
    selectedRuns, candidateRun: { ownerId: "level4", codes: Array(260).fill(1) },
    graphCheckpoint: {
      sourceLevelId: "level2", sourceRunRevision: 1, viewedXt: true, viewedVt: true, answerId: "vt-linear"
    }
  };
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function levelFiveBoundaryDraft() {
  const state = {
    ...Persistence.initialState(), phase: "level", variant: "paused", currentItem: "level5",
    candidateRun: { ownerId: "level5", codes: [] }
  };
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function practiceDraft() {
  const state = Persistence.initialState();
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function reviewRetryLevelDraft(levelId = "level4") {
  const draft = JSON.parse(completeReviewDraft());
  const state = Persistence.decode(draft.answer);
  assert(state?.selectedRuns[levelId], `review-retry fixture has ${levelId}`);
  state.phase = "level";
  state.variant = "review-retry-briefing";
  state.currentItem = levelId;
  state.returnToReview = true;
  state.candidateRun = null;
  return JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) });
}
function alternativeEqualScoreReviewFixture() {
  const original = reviewFixture();
  const state = Persistence.decodeReview(original.review.answer);
  assert(state, "original review fixture decodes for alternative-run check");
  const level = Levels.levelById("level1");
  const proposed = state.selectedRuns.level1.codes.slice();
  proposed[0] = proposed[0] === 1 ? 0 : 1;
  const codes = [];
  let replay = Model.replay(level, codes);
  for (const code of proposed) {
    if (replay.state.terminal) break;
    codes.push(code);
    replay = Model.replay(level, codes);
    assert(replay, "alternative review remains physically replayable");
  }
  while (!replay.state.terminal && codes.length < level.maxTicks) {
    codes.push(proposed.at(-1));
    replay = Model.replay(level, codes);
    assert(replay, "alternative review terminal extension remains replayable");
  }
  assert(replay.state.terminal, "alternative review run is terminal");
  state.selectedRuns.level1 = { revision: 2, codes };
  const result = Scoring.scoreActivity(state.selectedRuns, state.graphCheckpoint);
  const review = {
    version: 1,
    activity: slug,
    kind: "review",
    answer: Persistence.makeReview(state),
    score: result.score,
    passed: result.passed
  };
  assert.equal(result.score, original.result.score, "alternative authoritative run keeps the same aggregate score");
  assert.equal(result.passed, original.result.passed);
  assert.notDeepEqual(review.answer, original.review.answer, "alternative review changes authoritative evidence");
  return { original, alternative: { review, result } };
}
function noncanonicalUnderBudgetPendingFixture() {
  const fixture = reviewFixture();
  const review = JSON.parse(JSON.stringify(fixture.review));
  review.answer.ignored = "noncanonical-but-under-budget";
  assert(Persistence.decodeReview(review.answer), "under-budget noncanonical review remains semantically decodable");
  const reviewJson = JSON.stringify(review);
  const pending = {
    version: 1,
    activity: slug,
    kind: "pending-final",
    payload: {
      reviewJson,
      score: fixture.result.score,
      maxScore: fixture.result.maxScore,
      passed: fixture.result.passed
    }
  };
  assert(Buffer.byteLength(JSON.stringify(pending)) < 4000,
    "noncanonical-only pending fixture remains under the SCORM snapshot budget");
  return { fixture, review, reviewJson, pending };
}
function oversizedNoncanonicalPendingFixture() {
  const fixture = reviewFixture();
  const review = JSON.parse(JSON.stringify(fixture.review));
  review.answer.ignored = { padding: "x".repeat(4200) };
  assert(Persistence.decodeReview(review.answer), "persistence decoder deliberately ignores the extra nested field");
  const reviewJson = JSON.stringify(review);
  assert(Buffer.byteLength(reviewJson) > 4000, "noncanonical nested review exceeds the SCORM snapshot budget");
  const pending = {
    version: 1,
    activity: slug,
    kind: "pending-final",
    payload: {
      reviewJson,
      score: fixture.result.score,
      maxScore: fixture.result.maxScore,
      passed: fixture.result.passed
    }
  };
  return { fixture, review, reviewJson, pending };
}

function nearTerminalDraft(levelId = "level1", code = 1) {
  const level = Levels.levelById(levelId);
  const full = terminalCodes(level, code);
  assert(full.length > 1, "near-terminal browser fixture has a removable final tick");
  const codes = full.slice(0, -1);
  assert.equal(Model.isTerminalRun(level, codes), false, "near-terminal browser fixture is not terminal yet");
  assert.equal(Model.isTerminalRun(level, [...codes, code]), true,
    "near-terminal browser fixture reaches a terminal state on the next control tick");
  const state = {
    ...Persistence.initialState(),
    phase: "level",
    variant: "paused",
    currentItem: levelId,
    candidateRun: { ownerId: levelId, codes }
  };
  assert(Persistence.validateState(state, false), "near-terminal browser fixture is a valid paused draft");
  return {
    snapshot: JSON.stringify({ version: 1, activity: slug, kind: "draft", answer: Persistence.encode(state) }),
    level,
    code,
    prefixLength: codes.length
  };
}

const canvasSignatureSource = `(canvas)=>{
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let hash=2166136261>>>0,weighted=0;
  for(let index=0;index<data.length;index+=16){
    hash=Math.imul((hash^data[index])>>>0,16777619)>>>0;
    hash=Math.imul((hash^data[index+1])>>>0,16777619)>>>0;
    hash=Math.imul((hash^data[index+2])>>>0,16777619)>>>0;
    weighted=(weighted+data[index]*(index+1)+data[index+1]*(index+3)+data[index+2]*(index+5))%1000000007;
  }
  return canvas.width+'x'+canvas.height+':'+hash+':'+weighted;
}`;

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
async function cancelTouch(cdp, x, y, holdMs = 80, id = 1) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id, radiusX: 1, radiusY: 1, force: 1 }]
  });
  await delay(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
}
async function installEmbeddedLmsHarness(cdp) {
  assert.equal(activePreloads.has(cdp), false, "embedded tests start without a document preload");
  const installed = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity');
    if(!frame?.contentDocument) return false;
    const harness=window.__embedLmsHarness={
      values:{},blockWrites:false,
      log:{initialize:0,gets:[],sets:[],blockedSets:[],commits:0,finishes:0}
    };
    window.API={
      LMSInitialize:()=>{harness.log.initialize+=1;return 'true';},
      LMSGetValue:(key)=>{harness.log.gets.push(key);return Object.prototype.hasOwnProperty.call(harness.values,key)?String(harness.values[key]):'';},
      LMSSetValue:(key,value)=>{
        const entry={key,value:String(value)};
        if(harness.blockWrites) harness.log.blockedSets.push(entry);
        else {harness.values[key]=entry.value;harness.log.sets.push(entry);}
        return 'true';
      },
      LMSCommit:()=>{harness.log.commits+=1;return 'true';},
      LMSFinish:()=>{harness.log.finishes+=1;return 'true';},
      LMSGetLastError:()=>'0',
      LMSGetErrorString:()=>'No error',
      LMSGetDiagnostic:()=>''
    };
    return true;
  })()`);
  assert.equal(installed, true, "embedded LMS harness installs in the scroll host");
}
async function loadEmbeddedDraft(cdp, snapshot, readyExpression, label) {
  await evaluate(cdp, `(() => {
    const harness=window.__embedLmsHarness;
    harness.values={
      'cmi.core.lesson_status':'incomplete',
      'cmi.suspend_data':${JSON.stringify(snapshot)},
      'cmi.core.score.raw':''
    };
    harness.blockWrites=true;
    harness.log={initialize:0,gets:[],sets:[],blockedSets:[],commits:0,finishes:0};
    document.getElementById('activity').contentWindow.location.reload();
  })()`);
  await waitFor(cdp, `(() => {
    const frame=document.getElementById('activity'),d=frame?.contentDocument;
    return d?.readyState==='complete' && Boolean(d.defaultView.KinematicsDrivingPersistence) && (${readyExpression});
  })()`, label);
  await delay(80);
  const loaded = await evaluate(cdp, `(() => {
    const harness=window.__embedLmsHarness;
    const raw=harness.values['cmi.suspend_data'];
    harness.blockWrites=false;
    harness.log.sets=[];
    harness.log.blockedSets=[];
    harness.log.commits=0;
    harness.log.finishes=0;
    return {raw,status:harness.values['cmi.core.lesson_status']};
  })()`);
  assert.equal(loaded.raw, snapshot, `${label}: fixture remains authoritative during iframe reload`);
  assert.equal(loaded.status, "incomplete", `${label}: fixture does not leak a terminal status`);
}
async function loadEmbeddedAttempt(cdp, values, readyExpression, label) {
  await evaluate(cdp, `(() => {
    const harness=window.__embedLmsHarness;
    harness.values=${JSON.stringify(values)};
    harness.blockWrites=true;
    harness.log={initialize:0,gets:[],sets:[],blockedSets:[],commits:0,finishes:0};
    document.getElementById('activity').contentWindow.location.reload();
  })()`);
  await waitFor(cdp, `(() => {
    const frame=document.getElementById('activity'),d=frame?.contentDocument;
    return d?.readyState==='complete' && Boolean(d.defaultView.KinematicsDrivingPersistence) && (${readyExpression});
  })()`, label);
  await delay(100);
  const loaded = await evaluate(cdp, `(() => {
    const harness=window.__embedLmsHarness;
    const result={values:{...harness.values},blockedSets:[...harness.log.blockedSets]};
    harness.blockWrites=false;
    harness.log.sets=[];harness.log.blockedSets=[];harness.log.commits=0;harness.log.finishes=0;
    return result;
  })()`);
  assert.deepEqual(loaded.values, values, `${label}: LMS fixture remains authoritative during iframe reload`);
  return loaded;
}
async function startEmbeddedOwnerWatch(cdp) {
  return evaluate(cdp, `(() => {
    window.__embedOwnerWatch?.cleanup?.();
    const frame=document.getElementById('activity'),child=frame.contentWindow,d=frame.contentDocument;
    const panel=d.getElementById('controlPanel'),stage=d.getElementById('stage');
    const viewport=(value)=>value?{
      offsetLeft:value.offsetLeft,offsetTop:value.offsetTop,pageLeft:value.pageLeft,pageTop:value.pageTop,
      width:value.width,height:value.height,scale:value.scale
    }:null;
    const rect=(element)=>{const value=element.getBoundingClientRect();return {
      left:value.left,top:value.top,width:value.width,height:value.height
    };};
    const snapshot=()=>{
      const frameRect=frame.getBoundingClientRect();
      return {
        host:{x:scrollX,y:scrollY},
        panel:{x:panel.scrollLeft,y:panel.scrollTop},
        document:{
          htmlX:d.documentElement.scrollLeft,htmlY:d.documentElement.scrollTop,
          bodyX:d.body.scrollLeft,bodyY:d.body.scrollTop
        },
        frame:{left:frameRect.left,top:frameRect.top},
        stage:rect(stage),
        hostViewport:viewport(visualViewport),
        childViewport:viewport(child.visualViewport)
      };
    };
    const events={host:[],panel:[],document:[],hostViewport:[],childViewport:[]};
    const listeners=[];
    const watch=(target,type,key)=>{
      if(!target)return;
      const handler=()=>events[key].push(snapshot());
      target.addEventListener(type,handler,{passive:true});
      listeners.push(()=>target.removeEventListener(type,handler));
    };
    watch(window,'scroll','host');
    watch(panel,'scroll','panel');
    watch(child,'scroll','document');
    watch(visualViewport,'scroll','hostViewport');
    watch(visualViewport,'resize','hostViewport');
    watch(child.visualViewport,'scroll','childViewport');
    watch(child.visualViewport,'resize','childViewport');
    const watchState={
      before:snapshot(),events,snapshot,
      cleanup:()=>{listeners.forEach(remove=>remove());}
    };
    window.__embedOwnerWatch=watchState;
    return watchState.before;
  })()`);
}
async function finishEmbeddedOwnerWatch(cdp) {
  return evaluate(cdp, `(() => {
    const watch=window.__embedOwnerWatch;
    const result={before:watch.before,after:watch.snapshot(),events:watch.events};
    watch.cleanup();
    window.__embedOwnerWatch=null;
    return result;
  })()`);
}
function assertDirectOwnersFixed(owners, label) {
  assert.deepEqual(owners.after, owners.before, `${label}: all scroll, iframe, and visual-viewport owners remain fixed`);
  for (const [owner, events] of Object.entries(owners.events)) {
    assert.equal(events.length, 0, `${label}: ${owner} emits no movement event`);
  }
}
function assertCapturedTouchSequence(events, targetId, label, requireCapture = true) {
  const down = events.find((event) => event.type === "pointerdown");
  const move = events.find((event) => event.type === "pointermove");
  const up = events.find((event) => event.type === "pointerup");
  assert(down?.trusted && down.pointerType === "touch", `${label}: receives trusted touch pointerdown`);
  assert(move?.trusted && move.pointerType === "touch", `${label}: receives trusted touch pointermove`);
  assert(up?.trusted && up.pointerType === "touch", `${label}: receives trusted touch pointerup`);
  assert.equal(down.owner || down.target, targetId, `${label}: pointerdown starts within the intended stable target`);
  assert.equal(move.owner || move.target, targetId, `${label}: captured pointermove remains targeted at the stable element`);
  assert.equal(up.owner || up.target, targetId, `${label}: captured pointerup remains targeted at the stable element`);
  assert.equal(move.pointerId, down.pointerId, `${label}: pointer identity remains stable through drag`);
  assert.equal(up.pointerId, down.pointerId, `${label}: pointer identity remains stable through release`);
  if (requireCapture) assert.equal(Boolean(down.captured || move.captured), true, `${label}: target owns pointer capture during the drag`);
  assert(!events.some((event) => event.type === "pointercancel"), `${label}: completes without pointercancel`);
}
function assertStageOwnsHostScroll(owners, direction, label) {
  const delta = owners.after.host.y - owners.before.host.y;
  assert(direction < 0 ? delta > 0 : delta < 0,
    `${label}: vertical stage gesture moves the enclosing host in the requested direction`);
  assert.equal(owners.after.host.x, owners.before.host.x, `${label}: host has no horizontal movement`);
  assert.deepEqual(owners.after.panel, owners.before.panel, `${label}: sibling panel remains fixed`);
  assert.deepEqual(owners.after.document, owners.before.document, `${label}: activity document remains fixed`);
  assert.deepEqual(owners.after.childViewport, owners.before.childViewport, `${label}: child visual viewport remains fixed`);
  assert.equal(owners.after.frame.left, owners.before.frame.left, `${label}: iframe has no horizontal movement`);
  assert.equal(owners.after.frame.top - owners.before.frame.top, -delta,
    `${label}: iframe moves only as a child of the host scroll owner`);
  assert.equal(owners.after.stage.left, owners.before.stage.left, `${label}: stage has no child-layout horizontal movement`);
  assert.equal(owners.after.stage.top, owners.before.stage.top, `${label}: stage has no child-layout vertical movement`);
  assert.equal(owners.after.stage.width, owners.before.stage.width, `${label}: stage width remains fixed`);
  assert.equal(owners.after.stage.height, owners.before.stage.height, `${label}: stage height remains fixed`);
  const { pageTop: beforePageTop, pageLeft: beforePageLeft, ...beforeViewport } = owners.before.hostViewport;
  const { pageTop: afterPageTop, pageLeft: afterPageLeft, ...afterViewport } = owners.after.hostViewport;
  assert.deepEqual(afterViewport, beforeViewport, `${label}: host visual viewport shape remains fixed`);
  assert.equal(afterPageLeft, beforePageLeft, `${label}: host visual viewport has no horizontal movement`);
  assert.equal(afterPageTop - beforePageTop, delta, `${label}: host visual viewport follows the same host owner`);
  assert(owners.events.host.length > 0, `${label}: enclosing host emits the scroll event`);
  assert.equal(owners.events.panel.length, 0, `${label}: panel emits no scroll event`);
  assert.equal(owners.events.document.length, 0, `${label}: activity document emits no scroll event`);
  assert.equal(owners.events.childViewport.length, 0, `${label}: child visual viewport emits no movement event`);
}
function assertPanelOwnsScroll(owners, expectedPanelY, requireMovement, label) {
  assert.deepEqual(owners.after.host, owners.before.host, `${label}: host remains fixed`);
  assert.deepEqual(owners.after.document, owners.before.document, `${label}: activity document remains fixed`);
  assert.deepEqual(owners.after.frame, owners.before.frame, `${label}: iframe remains fixed`);
  assert.deepEqual(owners.after.stage, owners.before.stage, `${label}: stage geometry remains fixed`);
  assert.deepEqual(owners.after.hostViewport, owners.before.hostViewport, `${label}: host visual viewport remains fixed`);
  assert.deepEqual(owners.after.childViewport, owners.before.childViewport, `${label}: child visual viewport remains fixed`);
  assert.equal(owners.after.panel.x, owners.before.panel.x, `${label}: panel has no horizontal movement`);
  if (requireMovement) assert.notEqual(owners.after.panel.y, owners.before.panel.y, `${label}: panel owns the available scroll range`);
  else assert.equal(owners.after.panel.y, expectedPanelY, `${label}: panel stays exactly at its settled boundary`);
  for (const owner of ["host", "document", "hostViewport", "childViewport"]) {
    assert.equal(owners.events[owner].length, 0, `${label}: ${owner} emits no movement event`);
  }
  if (requireMovement) assert(owners.events.panel.length > 0, `${label}: panel emits its own scroll event`);
}
async function smoke(cdp, baseUrl, activityPath, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(label)}`);
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
    const p=document.getElementById('controlPanel');
    const b=document.getElementById('throttleButton');
    p.scrollTop=0;
    const initialButton=b.getBoundingClientRect(),panelRect=p.getBoundingClientRect();
    p.scrollTop+=initialButton.top-panelRect.top-8;
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>b.addEventListener(type,e=>window.__pedalEvents.push({type,trusted:e.isTrusted,pointerType:e.pointerType})));
    const r=b.getBoundingClientRect(); return {x:r.left+r.width*.2,endX:r.left+r.width*.85,y:r.top+r.height/2,panel:p.scrollTop,hit:document.elementFromPoint(r.left+r.width*.2,r.top+r.height/2)?.id||document.elementFromPoint(r.left+r.width*.2,r.top+r.height/2)?.closest?.('button')?.id||''};
  })()`);
  await touch(cdp, pedal.x, pedal.y, pedal.endX, pedal.y, 550, 3);
  await delay(120);
  await evaluate(cdp, "document.getElementById('pauseButton').click()");
  const held = await evaluate(cdp, `(() => {
    const raw=window.SimScorm.getLocalLog().filter(e=>e.key==='cmi.suspend_data').at(-1)?.value;
    const snapshot=raw?JSON.parse(raw):null;
    const decoded=snapshot?window.KinematicsDrivingPersistence.decode(snapshot.answer):null;
    return {events:window.__pedalEvents,control:document.getElementById('controlState').textContent,ticks:snapshot?.answer?.c?.n||0,codes:decoded?.candidateRun?.codes||[],panel:document.getElementById('controlPanel').scrollTop};
  })()`);
  assert(held.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"),
    `${label}: trusted touch starts pedal (${JSON.stringify(pedal)})`);
  assert(held.events.some((event) => event.type === "pointerup"), `${label}: pedal receives pointerup`);
  assert(!held.events.some((event) => event.type === "pointercancel"), `${label}: normal hold is not cancelled`);
  assert.equal(held.control, "目前：空檔", `${label}: release returns to neutral`);
  assert(held.ticks >= 5, `${label}: hold creates authoritative ticks (${held.ticks}; ${JSON.stringify(held.events)}; ${held.control})`);
  assert(held.codes.includes(1) && held.codes.includes(3), `${label}: one pedal supports direct light-to-full pressure changes`);
  assert.equal(held.panel, pedal.panel, `${label}: pedal hold does not scroll panel`);

  const cancelPoint = await evaluate(cdp, `(() => {
    window.__cancelEvents=[];
    const button=document.getElementById('throttleButton');
    ['pointerdown','pointerup','pointercancel'].forEach(type=>button.addEventListener(type,event=>window.__cancelEvents.push({type,trusted:event.isTrusted,pointerType:event.pointerType})));
    document.getElementById('startButton').click();
    const rect=button.getBoundingClientRect();
    return {x:rect.left+rect.width*.45,y:rect.top+rect.height/2};
  })()`);
  await cancelTouch(cdp, cancelPoint.x, cancelPoint.y, 90, 31);
  await waitFor(cdp, "document.getElementById('liveRegion')?.textContent.includes('操作中斷')", `${label} pointer cancellation copy`);
  const cancelled = await evaluate(cdp, `(() => ({
    events:window.__cancelEvents,
    control:document.getElementById('controlState').textContent,
    live:document.getElementById('liveRegion').textContent,
    pressed:document.getElementById('throttleButton').getAttribute('aria-pressed')
  }))()`);
  assert(cancelled.events.some((event) => event.type === "pointercancel" && event.trusted && event.pointerType === "touch"),
    `${label}: pedal receives a trusted pointercancel`);
  assert.equal(cancelled.control, "目前：空檔", `${label}: cancelled pedal returns to neutral`);
  assert.equal(cancelled.pressed, "false", `${label}: cancelled pedal clears pressed state`);
  assert.match(cancelled.live, /操作中斷；踏板已安全回到空檔。/, `${label}: cancellation gives explicit safety feedback`);
  await evaluate(cdp, "document.getElementById('pauseButton').click()");
  return `${label} launch, layout, trusted hold and cancellation passed`;
}
async function desktopGeometry(cdp, baseUrl, activityPath, label) {
  const widths = [820, 900, 1000, 1100];
  for (const width of widths) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 720, deviceScaleFactor: 1, mobile: false });
    await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-desktop-${width}`)}`);
    await waitFor(cdp, "document.readyState === 'complete' && document.getElementById('panelTitle')?.textContent.includes('操作練習')", `${label} ${width}px desktop activity`);
    const geometry = await evaluate(cdp, `(() => {
      const shell=document.querySelector('.driving-shell');
      const panel=document.getElementById('controlPanel');
      const stage=document.getElementById('stage');
      const rect=(element)=>{const value=element.getBoundingClientRect();return {left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height};};
      const shellRect=rect(shell),panelRect=rect(panel),stageRect=rect(stage);
      const panelHit=document.elementFromPoint(panelRect.right-4,Math.min(panelRect.bottom-4,panelRect.top+40));
      const stageHit=document.elementFromPoint(stageRect.left+4,Math.min(stageRect.bottom-4,stageRect.top+40));
      return {
        shell:shellRect,panel:panelRect,stage:stageRect,
        panelOwnsEdge:Boolean(panelHit && panel.contains(panelHit)),
        stageOwnsEdge:Boolean(stageHit && stage.contains(stageHit)),
        panelScrollWidth:panel.scrollWidth,panelClientWidth:panel.clientWidth,
        documentRange:document.documentElement.scrollHeight-document.documentElement.clientHeight
      };
    })()`);
    assert(Math.abs(geometry.panel.left - geometry.shell.left) <= 1,
      `${label} ${width}px: panel starts at the grid edge (${JSON.stringify(geometry)})`);
    assert(Math.abs(geometry.panel.right - geometry.stage.left) <= 1,
      `${label} ${width}px: panel and stage meet without overlap or gap (${JSON.stringify(geometry)})`);
    assert(Math.abs(geometry.stage.right - geometry.shell.right) <= 1,
      `${label} ${width}px: stage ends at the shell edge (${JSON.stringify(geometry)})`);
    assert(geometry.panel.width > 0 && geometry.stage.width > 0,
      `${label} ${width}px: both desktop grid tracks remain usable`);
    assert.equal(geometry.panelOwnsEdge, true, `${label} ${width}px: panel owns its right-hand hit-test edge`);
    assert.equal(geometry.stageOwnsEdge, true, `${label} ${width}px: stage owns its left-hand hit-test edge`);
    assert(geometry.panelScrollWidth <= geometry.panelClientWidth + 1,
      `${label} ${width}px: panel content has no horizontal clipping (${JSON.stringify(geometry)})`);
    assert.equal(geometry.documentRange, 0, `${label} ${width}px: desktop activity remains viewport bounded`);
  }
  return `${label} 820/900/1000/1100 desktop grid geometry passed`;
}
async function compactGeometry(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": analysisDraft(),
    "cmi.core.score.raw": ""
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 500, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-compact-320`)}`, preload);
  await waitFor(cdp, "!document.getElementById('analysisSection')?.classList.contains('is-hidden') && document.getElementById('graphCanvas')?.getBoundingClientRect().width > 0", `${label} compact geometry`);
  const geometry = await evaluate(cdp, `(() => {
    const rect=(element)=>{const value=element.getBoundingClientRect();return {left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height};};
    const overlap=(left,right)=>Math.max(0,Math.min(left.right,right.right)-Math.max(left.left,right.left))*
      Math.max(0,Math.min(left.bottom,right.bottom)-Math.max(left.top,right.top));
    const app=rect(document.querySelector('.driving-app'));
    const stage=rect(document.getElementById('stage'));
    const panelElement=document.getElementById('controlPanel'),panel=rect(panelElement);
    const task=rect(document.querySelector('.stage-task-card'));
    const status=rect(document.getElementById('stageStatus'));
    const graph=rect(document.getElementById('graphCard'));
    const canvas=rect(document.getElementById('graphCanvas'));
    const hit=document.elementFromPoint(panel.left+Math.min(8,panel.width/2),panel.top+Math.min(8,panel.height/2));
    const usableDocumentScroll=(()=>{document.documentElement.scrollTop=40;document.body.scrollTop=40;const value=Math.max(document.documentElement.scrollTop,document.body.scrollTop);document.documentElement.scrollTop=0;document.body.scrollTop=0;return value;})();
    return {
      app,stage,panel,task,status,graph,canvas,
      plot:{width:canvas.width-49,height:canvas.height-42},
      overlaps:{taskGraph:overlap(task,graph),taskStatus:overlap(task,status),graphStatus:overlap(graph,status)},
      panelRange:panelElement.scrollHeight-panelElement.clientHeight,
      panelHit:Boolean(hit&&panelElement.contains(hit)),
      usableDocumentScroll,
      viewport:{width:innerWidth,height:innerHeight}
    };
  })()`);
  assert(geometry.plot.width >= 128 && geometry.plot.height >= 88,
    `${label}: 320×500 actual graph plot rect remains at least 128×88 (${JSON.stringify(geometry.plot)})`);
  assert.deepEqual(geometry.overlaps, { taskGraph: 0, taskStatus: 0, graphStatus: 0 },
    `${label}: compact stage task, graph, and status avoid critical overlap`);
  assert(geometry.stage.height >= 208, `${label}: compact stage retains its 208px minimum`);
  assert(geometry.panel.height > 0 && geometry.panel.top < geometry.viewport.height && geometry.panel.bottom <= geometry.viewport.height + 1,
    `${label}: compact control panel remains reachable (${JSON.stringify(geometry.panel)})`);
  assert.equal(geometry.panelHit, true, `${label}: compact panel owns a visible hit-test point`);
  assert(geometry.panelRange > 0, `${label}: compact panel retains its independent scroll range`);
  assert.equal(geometry.usableDocumentScroll, 0, `${label}: compact document is not a third scroll owner`);
  assert(Math.abs(geometry.app.height - geometry.viewport.height) <= 2, `${label}: compact activity remains viewport bounded`);
  return `${label} 320×500 compact geometry and plot rect passed`;
}
async function embeddedMatrix(cdp, baseUrl, activityPath, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 500, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`);
  await waitFor(cdp, "document.getElementById('activity')?.contentDocument?.getElementById('controlPanel')", `${label} embedded activity`);
  await installEmbeddedLmsHarness(cdp);
  await loadEmbeddedDraft(
    cdp,
    practiceDraft(),
    "d.getElementById('panelTitle')?.textContent.includes('操作練習')",
    `${label} embedded owner fixture`
  );
  const stage = await evaluate(cdp, `(() => {
    scrollTo(0,220);
    const f=document.getElementById('activity'), fr=f.getBoundingClientRect(), d=f.contentDocument;
    const canvas=d.getElementById('drivingCanvas');
    window.__embeddedStageEvents=[];
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>canvas.addEventListener(type,event=>
      window.__embeddedStageEvents.push({
        type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,target:event.target.id
      })
    ));
    const r=d.getElementById('drivingCanvas').getBoundingClientRect();
    const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
    const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
    return {
      x:fr.left+r.left+r.width*.72,y:fr.top+r.top+r.height*.62,
      raw,phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
      control:d.getElementById('controlState').textContent
    };
  })()`);
  const stageOwnersBefore = await startEmbeddedOwnerWatch(cdp);
  await touch(cdp, stage.x, stage.y, stage.x, stage.y - 75, 40, 7);
  const stageAfter = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),d=f.contentDocument;
    const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
    const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
    return {
      raw,phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
      control:d.getElementById('controlState').textContent,events:window.__embeddedStageEvents
    };
  })()`);
  const stageOwners = await finishEmbeddedOwnerWatch(cdp);
  assert.deepEqual(stageOwners.before, stageOwnersBefore);
  assertStageOwnsHostScroll(stageOwners, -1, `${label} blank stage`);
  assert(stageAfter.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"),
    `${label}: blank stage starts with a trusted touch pointer`);
  assert(stageAfter.events.some((event) => event.type === "pointermove" && event.trusted && event.pointerType === "touch"),
    `${label}: blank stage receives trusted touch movement`);
  assert.equal(stageAfter.raw, stage.raw, `${label}: blank-stage scroll cannot mutate the durable learner snapshot`);
  assert.deepEqual(
    { phase: stageAfter.phase, variant: stageAfter.variant, ticks: stageAfter.ticks, control: stageAfter.control },
    { phase: stage.phase, variant: stage.variant, ticks: stage.ticks, control: stage.control },
    `${label}: blank-stage scroll cannot change learner phase, ticks, or control`
  );

  const reverseStage = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),d=f.contentDocument;
    const r=d.getElementById('drivingCanvas').getBoundingClientRect();
    window.__embeddedStageEvents=[];
    const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
    const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
    return {
      x:fr.left+r.left+r.width*.72,y:fr.top+r.top+r.height*.52,
      raw,phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
      control:d.getElementById('controlState').textContent
    };
  })()`);
  const reverseOwnersBefore = await startEmbeddedOwnerWatch(cdp);
  await touch(cdp, reverseStage.x, reverseStage.y, reverseStage.x, reverseStage.y + 75, 40, 71);
  const reverseStageAfter = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),d=f.contentDocument;
    const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
    const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
    return {
      raw,phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
      control:d.getElementById('controlState').textContent,events:window.__embeddedStageEvents
    };
  })()`);
  const reverseOwners = await finishEmbeddedOwnerWatch(cdp);
  assert.deepEqual(reverseOwners.before, reverseOwnersBefore);
  assertStageOwnsHostScroll(reverseOwners, 1, `${label} reverse blank stage`);
  assert(reverseStageAfter.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"),
    `${label}: reverse blank-stage gesture is a trusted touch`);
  assert.equal(reverseStageAfter.raw, reverseStage.raw, `${label}: reverse stage scroll cannot mutate learner evidence`);
  assert.deepEqual(
    {
      phase: reverseStageAfter.phase, variant: reverseStageAfter.variant,
      ticks: reverseStageAfter.ticks, control: reverseStageAfter.control
    },
    {
      phase: reverseStage.phase, variant: reverseStage.variant,
      ticks: reverseStage.ticks, control: reverseStage.control
    },
    `${label}: reverse stage scroll leaves learner state unchanged`
  );

  const panel = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),d=f.contentDocument,p=d.getElementById('controlPanel');
    p.scrollTop=0; const r=p.getBoundingClientRect();
    window.__embeddedPanelEvents=[];
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>p.addEventListener(type,event=>
      window.__embeddedPanelEvents.push({
        type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,target:event.target.id||event.target.className||event.target.tagName
      }),true
    ));
    let point=null;
    for(let y=r.top+12;y<r.bottom-12&&!point;y+=12) for(let x=r.left+12;x<r.right-12&&!point;x+=18){
      const hit=d.elementFromPoint(x,y);
      if(hit&&p.contains(hit)&&!hit.closest('button,input,label,fieldset')) point={x,y,tag:hit.tagName};
    }
    if(!point) point={x:r.right-8,y:r.top+18,tag:'fallback'};
    const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
    const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
    return {
      x:fr.left+point.x,y:fr.top+point.y,tag:point.tag,raw,
      phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
      control:d.getElementById('controlState').textContent
    };
  })()`);
  const panelOwnersBefore = await startEmbeddedOwnerWatch(cdp);
  await touch(cdp, panel.x, panel.y, panel.x, panel.y - 90, 40, 8);
  const panelAfter = await evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),d=f.contentDocument;
    const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
    const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
    return {
      raw,phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
      control:d.getElementById('controlState').textContent,events:window.__embeddedPanelEvents
    };
  })()`);
  const panelOwners = await finishEmbeddedOwnerWatch(cdp);
  assert.deepEqual(panelOwners.before, panelOwnersBefore);
  assertPanelOwnsScroll(panelOwners, null, true, `${label} panel swipe`);
  assert(panelAfter.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"),
    `${label}: panel swipe starts as a trusted touch (${panel.tag})`);
  assert.equal(panelAfter.raw, panel.raw, `${label}: panel scrolling cannot mutate the learner snapshot`);
  assert.deepEqual(
    {
      phase: panelAfter.phase, variant: panelAfter.variant,
      ticks: panelAfter.ticks, control: panelAfter.control
    },
    { phase: panel.phase, variant: panel.variant, ticks: panel.ticks, control: panel.control },
    `${label}: panel scrolling cannot change phase, ticks, or control`
  );

  const panelBoundary = async (edge, deltaY, pointerId, holdMs = 40) => {
    await loadEmbeddedDraft(
      cdp,
      practiceDraft(),
      "d.getElementById('panelTitle')?.textContent.includes('操作練習')",
      `${label} ${edge} panel boundary fixture`
    );
    const before = await evaluate(cdp, `(() => {
      const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),d=f.contentDocument,p=d.getElementById('controlPanel');
      p.scrollTop=${JSON.stringify(edge)}==='top'?0:p.scrollHeight;
      window.__embeddedPanelEvents=[];
      ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>p.addEventListener(type,event=>
        window.__embeddedPanelEvents.push({
          type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,
          target:event.target.id||event.target.className||event.target.tagName
        }),true
      ));
      const r=p.getBoundingClientRect();
      let point=null;
      for(let y=r.top+18;y<r.bottom-18&&!point;y+=12) for(let x=r.left+18;x<r.right-18&&!point;x+=18){
        const hit=d.elementFromPoint(x,y);
        if(hit&&hit!==p&&p.contains(hit)&&!hit.closest('button,input,label,fieldset')) point={x,y,hit:hit.id||hit.className||hit.tagName};
      }
      point||={x:r.left+6,y:r.top+r.height*.5,hit:'controlPanel-padding'};
      return {
        x:fr.left+point.x,y:fr.top+point.y,host:scrollY,top:p.scrollTop,
        max:p.scrollHeight-p.clientHeight,frameTop:fr.top,doc:d.documentElement.scrollTop,
        hit:point.hit
      };
    })()`);
    assert.equal(before.top, edge === "top" ? 0 : before.max, `${label}: panel reaches its ${edge} boundary`);
    await delay(120);
    const settled = await evaluate(cdp, `(() => {
      const p=document.getElementById('activity').contentDocument.getElementById('controlPanel');
      const maximum=p.scrollHeight-p.clientHeight;
      p.scrollTop=${JSON.stringify(edge)}==='top'?0:maximum;
      return {top:p.scrollTop,max:maximum};
    })()`);
    await delay(50);
    assert.equal(settled.max, before.max, `${label}: ${edge} boundary range remains stable while settling`);
    assert.equal(settled.top, edge === "top" ? 0 : settled.max, `${label}: panel is settled exactly at ${edge} before touchstart`);
    const ownersBefore = await startEmbeddedOwnerWatch(cdp);
    assert.equal(ownersBefore.panel.y, settled.top, `${label}: owner watch starts at the settled ${edge} boundary`);
    await touch(cdp, before.x, before.y, before.x, before.y + deltaY, holdMs, pointerId);
    await delay(120);
    const after = await evaluate(cdp, `(() => {
      const f=document.getElementById('activity'),d=f.contentDocument,p=d.getElementById('controlPanel');
      return {
        top:p.scrollTop,max:p.scrollHeight-p.clientHeight,events:window.__embeddedPanelEvents
      };
    })()`);
    const owners = await finishEmbeddedOwnerWatch(cdp);
    assert.deepEqual(owners.before, ownersBefore);
    const expected = edge === "top" ? 0 : before.max;
    assert.equal(after.max, before.max, `${label}: panel range stays stable at its ${edge} boundary`);
    assert.equal(after.top, expected,
      `${label}: ${edge} boundary stays settled at the exact same offset (start ${before.hit})`);
    assertPanelOwnsScroll(owners, expected, false, `${label} ${edge} panel boundary`);
    assert(after.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"),
      `${label}: ${edge} boundary is exercised by a trusted touch`);
  };
  await panelBoundary("top", 80, 81);
  await panelBoundary("bottom", -80, 82);
  await panelBoundary("top", 80, 84, 0);
  await panelBoundary("bottom", -80, 85, 0);
  return `${label} embedded bidirectional stage and settled/fast panel-boundary matrix passed`;
}
async function embeddedTrustedDirectMatrix(cdp, baseUrl, activityPath, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 500, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`);
  await waitFor(cdp, "document.getElementById('activity')?.contentDocument?.getElementById('controlPanel')", `${label} trusted direct embedded activity`);
  await installEmbeddedLmsHarness(cdp);

  const pedalCheck = async (kind, pointerId) => {
    const buttonId = kind === "throttle" ? "throttleButton" : "brakeButton";
    const expectedCodes = kind === "throttle" ? [1, 3] : [4, 6];
    await loadEmbeddedDraft(
      cdp,
      practiceDraft(),
      "d.getElementById('panelTitle')?.textContent.includes('操作練習')",
      `${label} embedded ${kind} fixture`
    );
    await evaluate(cdp, `(() => {
      scrollTo(0,340);
      const frame=document.getElementById('activity'),d=frame.contentDocument;
      d.getElementById('startButton').click();
      const panel=d.getElementById('controlPanel'),button=d.getElementById(${JSON.stringify(buttonId)});
      panel.scrollTop=0;
      const initial=button.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
      panel.scrollTop+=initial.top-panelRect.top-12;
    })()`);
    await delay(140);
    const setup = await evaluate(cdp, `(() => {
      const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
      const button=d.getElementById(${JSON.stringify(buttonId)}),rect=button.getBoundingClientRect();
      window.__embeddedPedalEvents=[];
      ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'].forEach(type=>
        button.addEventListener(type,event=>window.__embeddedPedalEvents.push({
          type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,
          target:event.target.id,currentTarget:event.currentTarget.id,
          owner:event.target.closest?.('button')?.id||event.target.id,
          captured:button.hasPointerCapture?.(event.pointerId)===true
        }))
      );
      const start={x:rect.left+rect.width*.18,y:rect.top+rect.height/2};
      const end={x:Math.min(d.documentElement.clientWidth-2,rect.right+18),y:rect.top+rect.height/2};
      return {
        x:frameRect.left+start.x,y:frameRect.top+start.y,
        endX:frameRect.left+end.x,endY:frameRect.top+end.y,
        hit:d.elementFromPoint(start.x,start.y)?.closest?.('button')?.id||'',
        outsideHit:d.elementFromPoint(end.x,end.y)?.closest?.('button')?.id||d.elementFromPoint(end.x,end.y)?.id||'',
        outside:Boolean(end.x>rect.right),
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
        initialStatus:d.getElementById('stageStatus').textContent
      };
    })()`);
    assert.equal(setup.hit, buttonId, `${label}: embedded ${kind} uses a stable pre-pointerdown hit target`);
    assert.equal(setup.outside, true, `${label}: embedded ${kind} drag endpoint is outside the original target rect`);
    assert.notEqual(setup.outsideHit, buttonId, `${label}: embedded ${kind} endpoint hit-test leaves the button`);
    const ownersBefore = await startEmbeddedOwnerWatch(cdp);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: setup.x, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }]
    });
    await delay(180);
    for (let step = 1; step <= 4; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{
          x: setup.x + (setup.endX - setup.x) * step / 4,
          y: setup.y,
          id: pointerId,
          radiusX: 1,
          radiusY: 1,
          force: 1
        }]
      });
      await delay(30);
    }
    await delay(180);
    const held = await evaluate(cdp, `(() => {
      const d=document.getElementById('activity').contentDocument,button=d.getElementById(${JSON.stringify(buttonId)});
      return {
        control:d.getElementById('controlState').textContent,
        pressed:button.getAttribute('aria-pressed'),
        status:d.getElementById('stageStatus').textContent
      };
    })()`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(100);
    const released = await evaluate(cdp, `(() => {
      const d=document.getElementById('activity').contentDocument,button=d.getElementById(${JSON.stringify(buttonId)}),rect=button.getBoundingClientRect();
      return {
        events:window.__embeddedPedalEvents,
        control:d.getElementById('controlState').textContent,
        pressed:button.getAttribute('aria-pressed'),
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}
      };
    })()`);
    const owners = await finishEmbeddedOwnerWatch(cdp);
    assert.deepEqual(owners.before, ownersBefore);
    assertDirectOwnersFixed(owners, `${label} embedded ${kind}`);
    assert.match(held.control, kind === "throttle" ? /油門踩盡/ : /煞車踩盡/,
      `${label}: embedded ${kind} horizontal hold reaches full intensity (${JSON.stringify({ setup, held, released })})`);
    assert.equal(held.pressed, "true", `${label}: embedded ${kind} is visibly active during hold`);
    assert.notEqual(held.control, "目前：空檔", `${label}: embedded ${kind} changes control state`);
    assertCapturedTouchSequence(released.events, buttonId, `${label} embedded ${kind}`);
    assert.equal(released.control, "目前：空檔", `${label}: embedded ${kind} release returns to neutral`);
    assert.equal(released.pressed, "false");
    assert.deepEqual(released.rect, setup.rect, `${label}: embedded ${kind} target geometry stays fixed`);

    await evaluate(cdp, "document.getElementById('activity').contentDocument.getElementById('pauseButton').click()");
    await delay(100);
    const saved = await evaluate(cdp, `(() => {
      const frame=document.getElementById('activity'),d=frame.contentDocument;
      const raw=window.API.LMSGetValue('cmi.suspend_data'),snapshot=JSON.parse(raw);
      const state=d.defaultView.KinematicsDrivingPersistence.decode(snapshot.answer);
      return {
        phase:state?.phase,variant:state?.variant,codes:state?.candidateRun?.codes||[],
        status:d.getElementById('stageStatus').textContent
      };
    })()`);
    assert.equal(saved.phase, "practice");
    assert.equal(saved.variant, "paused");
    for (const code of expectedCodes) {
      assert(saved.codes.includes(code), `${label}: embedded ${kind} authoritative stream records code ${code}`);
    }
    assert(saved.codes.some((code) => code === 0), `${label}: embedded ${kind} stream records neutral state`);
  };
  await pedalCheck("throttle", 91);
  await pedalCheck("brake", 92);

  const rangeCheck = async (kind, pointerId) => {
    const checkpoint = kind === "checkpoint";
    const snapshot = checkpoint ? graphCheckpointDraft() : analysisDraft();
    const rangeId = checkpoint ? "checkpointScrubRange" : "scrubRange";
    const ready = checkpoint
      ? "!d.getElementById('checkpointSection')?.classList.contains('is-hidden')"
      : "!d.getElementById('analysisSection')?.classList.contains('is-hidden')";
    await loadEmbeddedDraft(cdp, snapshot, ready, `${label} embedded ${kind} range fixture`);
    await evaluate(cdp, `(() => {
      scrollTo(0,340);
      const d=document.getElementById('activity').contentDocument,panel=d.getElementById('controlPanel'),range=d.getElementById(${JSON.stringify(rangeId)});
      panel.scrollTop=0;
      const initial=range.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
      panel.scrollTop+=initial.top-panelRect.top-(panelRect.height-initial.height)/2;
      range.value='20';
      range.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await delay(140);
    const setup = await evaluate(cdp, `(() => {
      const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
      const range=d.getElementById(${JSON.stringify(rangeId)}),rect=range.getBoundingClientRect();
      const checkpoint=${JSON.stringify(checkpoint)};
      const canvas=d.getElementById(checkpoint?'checkpointVtCanvas':'graphCanvas');
      const companion=checkpoint?d.getElementById('checkpointXtCanvas'):null;
      const extent=()=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let blue=-1,amber=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}return {blue,amber};};
      window.__embeddedRangeEvents=[];
      ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>
        range.addEventListener(type,event=>window.__embeddedRangeEvents.push({
          type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,
          target:event.target.id,currentTarget:event.currentTarget.id,
          owner:event.target.id,
          captured:range.hasPointerCapture?.(event.pointerId)===true
        }))
      );
      const graphRect=canvas.getBoundingClientRect();
      const endX=Math.min(d.documentElement.clientWidth-2,rect.right+18);
      return {
        x:frameRect.left+rect.left+rect.width*.2,
        endX:frameRect.left+endX,
        y:frameRect.top+rect.top+rect.height/2,
        value:range.value,height:rect.height,
        hit:d.elementFromPoint(rect.left+rect.width*.2,rect.top+rect.height/2)?.id||'',
        outside:Boolean(endX>rect.right),
        outsideHit:d.elementFromPoint(endX,rect.top+rect.height/2)?.id||'',
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
        graph:{width:graphRect.width,height:graphRect.height},extent:extent(),
        graphSignature:(${canvasSignatureSource})(canvas),
        companionSignature:companion?(${canvasSignatureSource})(companion):null,
        stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas'))
      };
    })()`);
    assert.equal(setup.hit, rangeId, `${label}: embedded ${kind} range owns its stable start point`);
    assert(setup.height >= 44, `${label}: embedded ${kind} range is at least 44px high`);
    assert.equal(setup.outside, true, `${label}: embedded ${kind} drag endpoint leaves the range rect`);
    assert.notEqual(setup.outsideHit, rangeId, `${label}: embedded ${kind} endpoint no longer hit-tests to the range`);
    assert(setup.graph.width - 49 >= 128 && setup.graph.height - 42 >= 88,
      `${label}: embedded ${kind} actual graph plot rect is at least 128×88`);
    const ownersBefore = await startEmbeddedOwnerWatch(cdp);
    await touch(cdp, setup.x, setup.y, setup.endX, setup.y, 60, pointerId);
    await delay(100);
    const after = await evaluate(cdp, `(() => {
      const d=document.getElementById('activity').contentDocument,range=d.getElementById(${JSON.stringify(rangeId)});
      const checkpoint=${JSON.stringify(checkpoint)};
      const canvas=d.getElementById(checkpoint?'checkpointVtCanvas':'graphCanvas');
      const companion=checkpoint?d.getElementById('checkpointXtCanvas'):null;
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let blue=-1,amber=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}
      const rect=range.getBoundingClientRect();
      return {
        value:range.value,events:window.__embeddedRangeEvents,extent:{blue,amber},
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
        graphSignature:(${canvasSignatureSource})(canvas),
        companionSignature:companion?(${canvasSignatureSource})(companion):null,
        stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas'))
      };
    })()`);
    const owners = await finishEmbeddedOwnerWatch(cdp);
    assert.deepEqual(owners.before, ownersBefore);
    assertDirectOwnersFixed(owners, `${label} embedded ${kind} range`);
    assert.notEqual(after.value, setup.value, `${label}: embedded ${kind} trusted drag changes replay value`);
    assertCapturedTouchSequence(after.events, rangeId, `${label} embedded ${kind} range`);
    assert.deepEqual(after.rect, setup.rect, `${label}: embedded ${kind} stable range geometry is not replaced during drag`);
    assert(after.extent.blue > setup.extent.blue + 12,
      `${label}: embedded ${kind} graph trace follows replay movement`);
    assert(after.extent.amber > setup.extent.amber + 12,
      `${label}: embedded ${kind} graph cursor follows replay movement`);
    assert.notEqual(after.graphSignature, setup.graphSignature,
      `${label}: embedded ${kind} primary graph canvas redraws during replay`);
    if (checkpoint) assert.notEqual(after.companionSignature, setup.companionSignature,
      `${label}: embedded checkpoint keeps both x–t and v–t canvases synchronized`);
    assert.notEqual(after.stageSignature, setup.stageSignature,
      `${label}: embedded ${kind} replay also redraws the submitted vehicle/stage sample`);
  };

  await rangeCheck("analysis", 93);
  await evaluate(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument,canvas=d.getElementById('drivingCanvas');
    window.__embeddedSurfaceEvents=[];
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>canvas.addEventListener(type,event=>
      window.__embeddedSurfaceEvents.push({
        type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,target:event.target.id
      })
    ));
  })()`);

  const stageSurfaces = [
    { name: "canvas", selector: null },
    { name: "task-card", selector: ".stage-task-card" },
    { name: "status", selector: "#stageStatus" },
    { name: "graph", selector: "#graphCard" }
  ];
  for (const surface of stageSurfaces) {
    for (const direction of [-1, 1]) {
      await evaluate(cdp, "scrollTo(0,220)");
      await delay(120);
      const before = await evaluate(cdp, `(() => {
        const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
        const stage=d.getElementById('stage'),stageRect=stage.getBoundingClientRect(),canvas=d.getElementById('drivingCanvas');
        window.__embeddedSurfaceEvents=[];
        let x,y;
        const selector=${JSON.stringify(surface.selector)};
        if(selector){
          const rect=d.querySelector(selector).getBoundingClientRect();
          x=rect.left+rect.width/2;y=rect.top+rect.height/2;
        }else{
          const candidates=[[.5,.52],[.7,.55],[.45,.7],[.72,.72]];
          const found=candidates.map(([fx,fy])=>({x:stageRect.left+stageRect.width*fx,y:stageRect.top+stageRect.height*fy}))
            .find(point=>d.elementFromPoint(point.x,point.y)===canvas);
          x=found.x;y=found.y;
        }
        const panel=d.getElementById('controlPanel'),child=frame.contentWindow;
        const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
        const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
        const childViewport=child.visualViewport?{
          offsetLeft:child.visualViewport.offsetLeft,offsetTop:child.visualViewport.offsetTop,
          pageLeft:child.visualViewport.pageLeft,pageTop:child.visualViewport.pageTop,
          width:child.visualViewport.width,height:child.visualViewport.height,scale:child.visualViewport.scale
        }:null;
        return {
          x:frameRect.left+x,y:frameRect.top+y,hit:d.elementFromPoint(x,y)?.id||d.elementFromPoint(x,y)?.className||'',
          host:scrollY,panel:panel.scrollTop,
          doc:{html:d.documentElement.scrollTop,body:d.body.scrollTop},
          frameTop:frameRect.top,childViewport,raw,
          phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
          control:d.getElementById('controlState').textContent
        };
      })()`);
      assert.equal(before.hit, "drivingCanvas", `${label}: ${surface.name} blank stage start resolves to the stage canvas`);
      const ownersBefore = await startEmbeddedOwnerWatch(cdp);
      await touch(cdp, before.x, before.y, before.x, before.y + direction * 55, 40, 100 + stageSurfaces.indexOf(surface) * 2 + (direction > 0 ? 1 : 0));
      await delay(120);
      const after = await evaluate(cdp, `(() => {
        const frame=document.getElementById('activity'),d=frame.contentDocument,panel=d.getElementById('controlPanel'),child=frame.contentWindow;
        const raw=window.__embedLmsHarness.values['cmi.suspend_data'];
        const state=d.defaultView.KinematicsDrivingPersistence.decode(JSON.parse(raw).answer);
        const childViewport=child.visualViewport?{
          offsetLeft:child.visualViewport.offsetLeft,offsetTop:child.visualViewport.offsetTop,
          pageLeft:child.visualViewport.pageLeft,pageTop:child.visualViewport.pageTop,
          width:child.visualViewport.width,height:child.visualViewport.height,scale:child.visualViewport.scale
        }:null;
        return {
          host:scrollY,panel:panel.scrollTop,
          doc:{html:d.documentElement.scrollTop,body:d.body.scrollTop},
          frameTop:frame.getBoundingClientRect().top,childViewport,
          hostViewportPageTop:visualViewport?.pageTop,raw,
          phase:state?.phase,variant:state?.variant,ticks:state?.candidateRun?.codes?.length||0,
          control:d.getElementById('controlState').textContent,
          events:window.__embeddedSurfaceEvents
        };
      })()`);
      const owners = await finishEmbeddedOwnerWatch(cdp);
      assert.deepEqual(owners.before, ownersBefore);
      assertStageOwnsHostScroll(owners, direction, `${label} ${surface.name} stage surface`);
      assert(after.events.some((event) => event.type === "pointerdown" && event.trusted && event.pointerType === "touch"),
        `${label}: ${surface.name} stage surface receives trusted touch pointerdown`);
      assert(after.events.some((event) => event.type === "pointermove" && event.trusted && event.pointerType === "touch"),
        `${label}: ${surface.name} stage surface receives trusted touch movement`);
      assert.equal(after.raw, before.raw, `${label}: ${surface.name} stage surface does not mutate durable evidence`);
      assert.deepEqual(
        { phase: after.phase, variant: after.variant, ticks: after.ticks, control: after.control },
        { phase: before.phase, variant: before.variant, ticks: before.ticks, control: before.control },
        `${label}: ${surface.name} stage gesture leaves phase, ticks, and controls unchanged`
      );
    }
  }

  await rangeCheck("checkpoint", 94);
  return `${label} embedded throttle/brake, analysis/checkpoint ranges, and four-surface stage matrix passed`;
}

async function embeddedSubmittedReviewMatrix(cdp, baseUrl, activityPath, label) {
  const fixture = reviewFixture();
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 500, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`);
  await waitFor(cdp, "document.getElementById('activity')?.contentDocument?.getElementById('controlPanel')", `${label} embedded submitted review host`);
  await installEmbeddedLmsHarness(cdp);
  await loadEmbeddedAttempt(cdp, {
    "cmi.core.lesson_status": fixture.result.passed ? "passed" : "failed",
    "cmi.suspend_data": JSON.stringify(fixture.review),
    "cmi.core.score.raw": String(fixture.result.score)
  }, "!d.getElementById('resultReviewTools')?.classList.contains('is-hidden')", `${label} embedded submitted review`);
  await evaluate(cdp, `(() => {
    scrollTo(0,340);
    const d=document.getElementById('activity').contentDocument;
    const panel=d.getElementById('controlPanel'),range=d.getElementById('resultScrubRange');
    panel.scrollTop=0;
    const initial=range.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
    panel.scrollTop+=initial.top-panelRect.top-(panelRect.height-initial.height)/2;
    range.value='20';
    range.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await delay(120);
  const setup = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
    const range=d.getElementById('resultScrubRange'),rect=range.getBoundingClientRect(),canvas=d.getElementById('graphCanvas');
    const extent=()=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let blue=-1,amber=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}return {blue,amber};};
    window.__embeddedResultRangeEvents=[];
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>range.addEventListener(type,event=>
      window.__embeddedResultRangeEvents.push({
        type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,
        target:event.target.id,currentTarget:event.currentTarget.id,
        owner:event.target.id,
        captured:range.hasPointerCapture?.(event.pointerId)===true
      })
    ));
    const endX=Math.min(d.documentElement.clientWidth-2,rect.right+18);
    const levelButtons=Array.from(d.querySelectorAll('[data-result-level]'));
    const feedback=Array.from(d.querySelectorAll('#feedbackList .feedback-item')).at(-1)?.textContent||'';
    return {
      x:frameRect.left+rect.left+rect.width*.2,endX:frameRect.left+endX,
      y:frameRect.top+rect.top+rect.height/2,value:range.value,
      rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
      outside:Boolean(endX>rect.right),outsideHit:d.elementFromPoint(endX,rect.top+rect.height/2)?.id||'',
      hit:d.elementFromPoint(rect.left+rect.width*.2,rect.top+rect.height/2)?.id||'',
      touchAction:getComputedStyle(range).touchAction,
      toolsVisible:!d.getElementById('resultReviewTools').classList.contains('is-hidden'),
      levelCount:levelButtons.length,enabled:levelButtons.every(button=>!button.disabled),
      selected:levelButtons.filter(button=>button.getAttribute('aria-pressed')==='true').map(button=>button.dataset.resultLevel),
      feedback,extent:extent(),
      graphSignature:(${canvasSignatureSource})(canvas),
      stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas')),
      raw:window.__embedLmsHarness.values['cmi.suspend_data']
    };
  })()`);
  assert.equal(setup.toolsVisible, true, `${label}: trusted submitted result exposes readonly tools`);
  assert.equal(setup.levelCount, 5, `${label}: submitted readonly picker exposes all five authoritative runs`);
  assert.equal(setup.enabled, true, `${label}: all five readonly run selectors remain usable`);
  assert.deepEqual(setup.selected, ["level1"], `${label}: exactly one submitted run is selected`);
  assert.match(setup.feedback, /你的答案：.*（正確）。/, `${label}: submitted result shows the learner's actual checkpoint answer`);
  assert.match(setup.feedback, /正確解釋：/, `${label}: submitted result keeps the authoritative checkpoint explanation`);
  assert.equal(setup.hit, "resultScrubRange", `${label}: submitted readonly range owns its initial hit target`);
  assert(setup.rect.height >= 44, `${label}: submitted readonly range is at least 44px high`);
  assert.equal(setup.touchAction, "none", `${label}: submitted readonly range owns its active drag before pointerdown`);
  assert.equal(setup.outside, true, `${label}: submitted readonly drag endpoint leaves the range rect`);
  assert.notEqual(setup.outsideHit, "resultScrubRange", `${label}: submitted readonly endpoint hit-tests outside the range`);

  const ownersBefore = await startEmbeddedOwnerWatch(cdp);
  await touch(cdp, setup.x, setup.y, setup.endX, setup.y, 60, 141);
  await delay(100);
  const after = await evaluate(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument,range=d.getElementById('resultScrubRange'),canvas=d.getElementById('graphCanvas');
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let blue=-1,amber=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}
    const rect=range.getBoundingClientRect();
    return {
      value:range.value,events:window.__embeddedResultRangeEvents,
      rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
      extent:{blue,amber},graphSignature:(${canvasSignatureSource})(canvas),
      stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas')),
      raw:window.__embedLmsHarness.values['cmi.suspend_data'],
      log:JSON.parse(JSON.stringify(window.__embedLmsHarness.log))
    };
  })()`);
  const owners = await finishEmbeddedOwnerWatch(cdp);
  assert.deepEqual(owners.before, ownersBefore);
  assertDirectOwnersFixed(owners, `${label} embedded submitted readonly range`);
  assert.notEqual(after.value, setup.value, `${label}: submitted readonly drag changes replay position`);
  assertCapturedTouchSequence(after.events, "resultScrubRange", `${label} embedded submitted readonly range`);
  assert.deepEqual(after.rect, setup.rect, `${label}: submitted readonly range stays mounted and geometrically stable`);
  assert(after.extent.blue > setup.extent.blue + 12, `${label}: submitted graph trace follows readonly replay`);
  assert(after.extent.amber > setup.extent.amber + 12, `${label}: submitted graph cursor follows readonly replay`);
  assert.notEqual(after.graphSignature, setup.graphSignature, `${label}: submitted graph canvas redraws`);
  assert.notEqual(after.stageSignature, setup.stageSignature, `${label}: submitted vehicle/stage replay redraws in sync`);
  assert.equal(after.raw, setup.raw, `${label}: readonly submitted replay cannot change authoritative evidence`);
  assert.equal(after.log.sets.length, 0, `${label}: readonly submitted replay performs no LMS writes`);
  assert.equal(after.log.commits, 0, `${label}: readonly submitted replay performs no LMS commit`);

  const levelPoint = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
    const panel=d.getElementById('controlPanel'),button=d.querySelector('[data-result-level="level5"]');
    panel.scrollTop=0;
    const initial=button.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
    panel.scrollTop+=initial.top-panelRect.top-(panelRect.height-initial.height)/2;
    const rect=button.getBoundingClientRect();
    return {x:frameRect.left+rect.left+rect.width/2,y:frameRect.top+rect.top+rect.height/2};
  })()`);
  await touch(cdp, levelPoint.x, levelPoint.y, levelPoint.x, levelPoint.y, 40, 142);
  await waitFor(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument;
    return d.querySelector('[data-result-level="level5"]')?.getAttribute('aria-pressed')==='true' &&
      d.activeElement?.dataset?.resultLevel==='level5';
  })()`, `${label} submitted level 5 focus restoration`);
  const levelChanged = await evaluate(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument;
    return {
      selected:Array.from(d.querySelectorAll('[data-result-level][aria-pressed="true"]')).map(button=>button.dataset.resultLevel),
      zoneIds:Array.from(d.querySelectorAll('[data-result-zone]')).map(button=>button.dataset.resultZone),
      focused:d.activeElement?.dataset?.resultLevel||'',
      status:d.getElementById('resultReplayStatus').textContent,
      graphSignature:(${canvasSignatureSource})(d.getElementById('graphCanvas')),
      stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas')),
      raw:window.__embedLmsHarness.values['cmi.suspend_data']
    };
  })()`);
  assert.deepEqual(levelChanged.selected, ["level5"], `${label}: trusted readonly level selector chooses exactly level 5`);
  assert.equal(levelChanged.focused, "level5", `${label}: rerendered level selector restores focus to level 5`);
  assert(levelChanged.zoneIds.length > 1, `${label}: multi-zone submitted run exposes every readonly zone`);
  assert.match(levelChanged.status, /第 5 關/, `${label}: readonly replay status follows the selected run`);
  assert.notEqual(levelChanged.graphSignature, after.graphSignature, `${label}: changing submitted run redraws its graph`);
  assert.notEqual(levelChanged.stageSignature, after.stageSignature, `${label}: changing submitted run redraws its stage`);
  assert.equal(levelChanged.raw, setup.raw);

  const zonePoint = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
    const panel=d.getElementById('controlPanel'),button=d.querySelectorAll('[data-result-zone]')[1];
    const initial=button.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
    panel.scrollTop+=initial.top-panelRect.top-(panelRect.height-initial.height)/2;
    const rect=button.getBoundingClientRect();
    return {id:button.dataset.resultZone,x:frameRect.left+rect.left+rect.width/2,y:frameRect.top+rect.top+rect.height/2};
  })()`);
  await touch(cdp, zonePoint.x, zonePoint.y, zonePoint.x, zonePoint.y, 40, 143);
  await waitFor(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument;
    return d.querySelector('[data-result-zone="${zonePoint.id}"]')?.getAttribute('aria-pressed')==='true' &&
      d.activeElement?.dataset?.resultZone==='${zonePoint.id}';
  })()`, `${label} submitted zone focus restoration`);
  const zoneChanged = await evaluate(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument;
    return {
      selected:Array.from(d.querySelectorAll('[data-result-zone][aria-pressed="true"]')).map(button=>button.dataset.resultZone),
      focused:d.activeElement?.dataset?.resultZone||'',
      status:d.getElementById('resultReplayStatus').textContent,
      graphSignature:(${canvasSignatureSource})(d.getElementById('graphCanvas')),
      stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas')),
      raw:window.__embedLmsHarness.values['cmi.suspend_data']
    };
  })()`);
  assert.deepEqual(zoneChanged.selected, [zonePoint.id], `${label}: trusted readonly zone selector chooses exactly its requested zone`);
  assert.equal(zoneChanged.focused, zonePoint.id, `${label}: rerendered zone selector restores focus`);
  assert.match(zoneChanged.status, /第 5 關/, `${label}: selected zone retains the submitted level status`);
  assert.notEqual(zoneChanged.graphSignature, levelChanged.graphSignature, `${label}: changing submitted zone redraws its graph`);
  assert.notEqual(zoneChanged.stageSignature, levelChanged.stageSignature, `${label}: changing submitted zone redraws its stage`);
  assert.equal(zoneChanged.raw, setup.raw);

  const modePoint = await evaluate(cdp, `(() => {
    const frame=document.getElementById('activity'),frameRect=frame.getBoundingClientRect(),d=frame.contentDocument;
    const panel=d.getElementById('controlPanel'),input=d.querySelector('input[name=resultGraphMode][value=xt]');
    const initial=input.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
    panel.scrollTop+=initial.top-panelRect.top-(panelRect.height-initial.height)/2;
    const rect=input.getBoundingClientRect();
    return {x:frameRect.left+rect.left+rect.width/2,y:frameRect.top+rect.top+rect.height/2};
  })()`);
  await touch(cdp, modePoint.x, modePoint.y, modePoint.x, modePoint.y, 40, 144);
  await waitFor(cdp, `document.getElementById('activity').contentDocument.querySelector('input[name=resultGraphMode][value=xt]')?.checked`, `${label} submitted x-t mode`);
  const modeChanged = await evaluate(cdp, `(() => {
    const d=document.getElementById('activity').contentDocument;
    return {
      graphSignature:(${canvasSignatureSource})(d.getElementById('graphCanvas')),
      stageSignature:(${canvasSignatureSource})(d.getElementById('drivingCanvas')),
      raw:window.__embedLmsHarness.values['cmi.suspend_data'],
      log:JSON.parse(JSON.stringify(window.__embedLmsHarness.log))
    };
  })()`);
  assert.notEqual(modeChanged.graphSignature, zoneChanged.graphSignature, `${label}: trusted x–t selection redraws the submitted graph`);
  assert.equal(modeChanged.stageSignature, zoneChanged.stageSignature, `${label}: graph-mode change does not alter the submitted stage sample`);
  assert.equal(modeChanged.raw, setup.raw, `${label}: level/zone/mode tools remain strictly readonly`);
  assert.equal(modeChanged.log.sets.length, 0);
  assert.equal(modeChanged.log.commits, 0);
  return `${label} embedded submitted readonly range and authoritative feedback passed`;
}

async function freeLevelSelection(cdp, baseUrl, activityPath, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-free-levels`)}`);
  await waitFor(cdp, "document.getElementById('panelTitle')?.textContent.includes('操作練習')", `${label} free level picker`);
  const before = await evaluate(cdp, `(() => {
    const buttons=Array.from(document.querySelectorAll('[data-pick-level]'));
    const target=document.querySelector('[data-pick-level="level2"]'),r=target.getBoundingClientRect();
    window.__levelPickEvents=[];
    target.addEventListener('click',e=>window.__levelPickEvents.push({trusted:e.isTrusted}));
    return {count:buttons.length,allEnabled:buttons.every(button=>!button.disabled),x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  assert.equal(before.count, 5, `${label}: all five levels are present at startup`);
  assert.equal(before.allEnabled, true, `${label}: all five levels are enabled at startup`);
  await touch(cdp, before.x, before.y, before.x, before.y, 40, 41);
  await waitFor(cdp, "document.getElementById('panelKicker')?.textContent.includes('第 2 關')", `${label} direct level 2 navigation`);
  const after = await evaluate(cdp, `(() => ({
    title:document.getElementById('panelTitle').textContent,
    current:document.querySelector('[data-pick-level="level2"]').getAttribute('aria-current'),
    events:window.__levelPickEvents,
    enabled:Array.from(document.querySelectorAll('[data-pick-level]')).every(button=>!button.disabled)
  }))()`);
  assert.match(after.title, /勻加速/);
  assert.equal(after.current, "step");
  assert(after.events.some((event) => event.trusted), `${label}: trusted touch opens level 2`);
  assert.equal(after.enabled, true, `${label}: other levels remain open after navigation`);
  return `${label} free level selection passed`;
}
async function analysisScrub(cdp, baseUrl, activityPath, label) {
  const snapshot = analysisDraft();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": snapshot,
    "cmi.core.score.raw": ""
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-analysis`)}`, preload);
  await waitFor(cdp, "!document.getElementById('analysisSection')?.classList.contains('is-hidden')", `${label} analysis`);
  const setup = await evaluate(cdp, `(() => {
    const graphExtent=()=>{const c=document.getElementById('graphCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let blue=-1,amber=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}return {blue,amber};};
    const p=document.getElementById('controlPanel'),r=document.getElementById('scrubRange');
    p.scrollTop=r.offsetTop; r.value='20'; r.dispatchEvent(new Event('input',{bubbles:true}));
    window.__scrubEvents=[]; ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>r.addEventListener(type,e=>window.__scrubEvents.push({type,trusted:e.isTrusted,pointerType:e.pointerType})));
    const b=r.getBoundingClientRect(),graph=document.getElementById('graphCanvas').getBoundingClientRect();
    return {x:b.left+b.width*.2,endX:b.left+b.width*.78,y:b.top+b.height/2,panel:p.scrollTop,host:scrollY,value:r.value,extent:graphExtent(),rangeHeight:b.height,graph:{width:graph.width,height:graph.height}};
  })()`);
  assert(setup.rangeHeight >= 44, `${label}: analysis range has a 44px touch target`);
  assert(setup.graph.width - 49 >= 128 && setup.graph.height - 42 >= 88,
    `${label}: analysis graph's actual plot rect is at least 128×88 (${JSON.stringify(setup.graph)})`);
  await touch(cdp, setup.x, setup.y, setup.endX, setup.y, 60, 29);
  const after = await evaluate(cdp, `(() => {
    const c=document.getElementById('graphCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let blue=-1,amber=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}
    return {value:document.getElementById('scrubRange').value,panel:document.getElementById('controlPanel').scrollTop,host:scrollY,events:window.__scrubEvents,extent:{blue,amber}};
  })()`);
  assert.notEqual(after.value, setup.value, `${label}: trusted scrub changes replay position`);
  assert.equal(after.panel, setup.panel, `${label}: scrub does not scroll panel`);
  assert.equal(after.host, setup.host, `${label}: scrub does not scroll page`);
  assert(after.events.some((event) => event.type === "pointermove" && event.trusted && event.pointerType === "touch"), `${label}: scrub receives trusted touch move`);
  assert(after.events.some((event) => event.type === "pointerup"), `${label}: scrub receives pointerup`);
  assert(!after.events.some((event) => event.type === "pointercancel"), `${label}: scrub has no pointercancel`);
  assert(after.extent.blue > setup.extent.blue + 12, `${label}: partial graph trace grows with the scrub cursor`);
  assert(after.extent.amber > setup.extent.amber + 12, `${label}: visible graph cursor follows the scrub position`);
  const finalExtent = await evaluate(cdp, `(() => {
    const range=document.getElementById('scrubRange');range.value='100';range.dispatchEvent(new Event('input',{bubbles:true}));
    const c=document.getElementById('graphCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let amber=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}
    return {amber,width:c.width,value:range.value};
  })()`);
  assert.equal(finalExtent.value, "100");
  assert(finalExtent.amber >= 0 && finalExtent.amber < finalExtent.width,
    `${label}: max-ticks cursor remains visible inside the expanding timeline`);
  return `${label} trusted analysis scrub passed`;
}
async function checkpointScrub(cdp, baseUrl, activityPath, label) {
  const snapshot = graphCheckpointDraft();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": snapshot,
    "cmi.core.score.raw": ""
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-checkpoint-scrub`)}`, preload);
  await waitFor(cdp, "!document.getElementById('checkpointSection')?.classList.contains('is-hidden') && document.getElementById('checkpointScrubRange')?.getBoundingClientRect().width > 0", `${label} graph checkpoint scrub`);
  const setup = await evaluate(cdp, `(() => {
    const extent=()=>{const c=document.getElementById('checkpointVtCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let blue=-1,amber=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}return {blue,amber};};
    const panel=document.getElementById('controlPanel'),range=document.getElementById('checkpointScrubRange');
    const panelRect=panel.getBoundingClientRect(),initialRect=range.getBoundingClientRect();
    panel.scrollTop+=initialRect.top-panelRect.top-(panelRect.height-initialRect.height)/2;
    range.value='20';range.dispatchEvent(new Event('input',{bubbles:true}));
    window.__checkpointScrubEvents=[];
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>range.addEventListener(type,event=>window.__checkpointScrubEvents.push({type,trusted:event.isTrusted,pointerType:event.pointerType})));
    const rect=range.getBoundingClientRect(),graph=document.getElementById('checkpointVtCanvas').getBoundingClientRect();
    const visibleRanges=Array.from(document.querySelectorAll('input[type=range]')).filter(input=>{const box=input.getBoundingClientRect();return box.width>0&&box.height>0;});
    return {
      x:rect.left+rect.width*.2,endX:rect.left+rect.width*.78,y:rect.top+rect.height/2,
      value:range.value,panel:panel.scrollTop,host:scrollY,extent:extent(),
      visibleRangeIds:visibleRanges.map(input=>input.id),
      activityHidden:document.getElementById('activitySection').classList.contains('is-hidden'),
      checkpointVisible:!document.getElementById('checkpointSection').classList.contains('is-hidden'),
      disabled:range.disabled,
      hit:document.elementFromPoint(rect.left+rect.width*.2,rect.top+rect.height/2)?.id||'',
      rangeHeight:rect.height,graph:{width:graph.width,height:graph.height},
      stageSignature:(${canvasSignatureSource})(document.getElementById('drivingCanvas')),
      xtSignature:(${canvasSignatureSource})(document.getElementById('checkpointXtCanvas')),
      vtSignature:(${canvasSignatureSource})(document.getElementById('checkpointVtCanvas'))
    };
  })()`);
  assert.equal(setup.activityHidden, true, `${label}: driving/analysis section is hidden at graph checkpoint`);
  assert.equal(setup.checkpointVisible, true, `${label}: checkpoint section is visible`);
  assert.deepEqual(setup.visibleRangeIds, ["checkpointScrubRange"], `${label}: graph checkpoint exposes exactly its own replay range`);
  assert.equal(setup.disabled, false, `${label}: graph checkpoint replay range is enabled`);
  assert.equal(setup.hit, "checkpointScrubRange", `${label}: checkpoint replay range owns its trusted-touch start point`);
  assert(setup.rangeHeight >= 44, `${label}: checkpoint range has a 44px touch target`);
  assert(setup.graph.width - 49 >= 128 && setup.graph.height - 42 >= 88,
    `${label}: checkpoint v–t graph's actual plot rect is at least 128×88 (${JSON.stringify(setup.graph)})`);
  await touch(cdp, setup.x, setup.y, setup.endX, setup.y, 60, 83);
  const after = await evaluate(cdp, `(() => {
    const c=document.getElementById('checkpointVtCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let blue=-1,amber=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(b>150&&r<90&&g>50&&g<160)blue=Math.max(blue,x);if(r>190&&g>90&&g<200&&b<100)amber=Math.max(amber,x);}
    return {
      value:document.getElementById('checkpointScrubRange').value,
      panel:document.getElementById('controlPanel').scrollTop,host:scrollY,
      events:window.__checkpointScrubEvents,extent:{blue,amber},
      stageSignature:(${canvasSignatureSource})(document.getElementById('drivingCanvas')),
      xtSignature:(${canvasSignatureSource})(document.getElementById('checkpointXtCanvas')),
      vtSignature:(${canvasSignatureSource})(document.getElementById('checkpointVtCanvas'))
    };
  })()`);
  assert.notEqual(after.value, setup.value, `${label}: trusted checkpoint scrub changes replay position (${JSON.stringify({ setup, after })})`);
  assert.equal(after.panel, setup.panel, `${label}: checkpoint scrub does not scroll panel`);
  assert.equal(after.host, setup.host, `${label}: checkpoint scrub does not scroll host`);
  assert(after.events.some((event) => event.type === "pointermove" && event.trusted && event.pointerType === "touch"),
    `${label}: checkpoint scrub receives trusted touch movement`);
  assert(after.events.some((event) => event.type === "pointerup"), `${label}: checkpoint scrub receives pointerup`);
  assert(!after.events.some((event) => event.type === "pointercancel"), `${label}: checkpoint scrub completes without pointercancel`);
  assert(after.extent.blue > setup.extent.blue + 12,
    `${label}: checkpoint graph trace follows the replay range (${JSON.stringify({ before: setup.extent, after: after.extent })})`);
  assert(after.extent.amber > setup.extent.amber + 12,
    `${label}: checkpoint graph cursor follows the replay range (${JSON.stringify({ before: setup.extent, after: after.extent })})`);
  assert.notEqual(after.stageSignature, setup.stageSignature,
    `${label}: checkpoint scrub synchronizes the submitted vehicle/stage replay`);
  assert.notEqual(after.xtSignature, setup.xtSignature,
    `${label}: checkpoint scrub synchronizes the x–t graph`);
  assert.notEqual(after.vtSignature, setup.vtSignature,
    `${label}: checkpoint scrub synchronizes the v–t graph`);
  return `${label} visible trusted checkpoint scrub passed`;
}
async function multiZoneAnalysis(cdp, baseUrl, activityPath, label) {
  const snapshot = analysisDraft("level5");
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": snapshot,
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-multi-zone`)}`, preload);
  await waitFor(cdp, "document.querySelectorAll('[data-analysis-zone]').length === 4", `${label} multi-zone analysis`);
  const before = await evaluate(cdp, `(() => ({
    tabs:Array.from(document.querySelectorAll('[data-analysis-zone]')).map(x=>({id:x.dataset.analysisZone,pressed:x.getAttribute('aria-pressed'),text:x.textContent})),
    result:document.querySelector('.analysis-item.is-selected')?.textContent
  }))()`);
  assert.equal(before.tabs.length, 4, `${label}: only the four scored zones have analysis selectors`);
  assert.deepEqual(before.tabs.map((tab) => tab.id), [
    "l5-uniform-flat", "l5-accelerate-flat", "l5-decelerate-flat", "l5-uniform-down"
  ], `${label}: the four consecutive road segments have analysis selectors`);
  await evaluate(cdp, "document.querySelectorAll('[data-analysis-zone]')[2].click()");
  const after = await evaluate(cdp, `(() => ({
    tabs:Array.from(document.querySelectorAll('[data-analysis-zone]')).map(x=>({id:x.dataset.analysisZone,pressed:x.getAttribute('aria-pressed')})),
    result:document.querySelector('.analysis-item.is-selected')?.textContent,
    scrub:document.getElementById('scrubRange').value
  }))()`);
  assert.equal(after.tabs.filter((tab) => tab.pressed === "true").length, 1);
  assert.equal(after.tabs[2].pressed, "true");
  assert.notEqual(after.result, before.result, `${label}: selecting another scored zone updates its analysis`);
  assert.equal(after.scrub, "100");
  return `${label} multi-zone analysis selector passed`;
}
async function levelFourVisual(cdp, baseUrl, activityPath, label) {
  const snapshot = levelFourPreviewDraft();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": snapshot,
    "cmi.core.score.raw": ""
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-level4`)}`, preload);
  await waitFor(cdp, "document.getElementById('panelKicker')?.textContent.includes('第 4 關')", `${label} level 4`);
  const visual = await evaluate(cdp, `(() => {
    const level=window.KinematicsDrivingLevels.levelById('level4');
    const c=document.getElementById('graphCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let minBlue=c.width,maxBlue=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];
      if(b>150&&r<90&&g>50&&g<160){minBlue=Math.min(minBlue,x);maxBlue=Math.max(maxBlue,x);}
    }
    return {
      segments:level.segments.map(s=>({start:s.start,end:s.end,slope:s.slopeDeg,target:s.target})),
      routeLength:level.routeLength,graph:{width:c.width,minBlue,maxBlue},
      instruction:document.getElementById('instruction').textContent
    };
  })()`);
  assert.equal(visual.segments.length, 1, `${label}: level 4 has one uninterrupted slope`);
  assert.deepEqual(visual.segments[0], { start: 0, end: visual.routeLength, slope: 3.5, target: "uniform" });
  assert.match(visual.instruction, /整條.*上斜路/);
  assert(visual.graph.minBlue < visual.graph.width * .25, `${label}: the trace retains its original left-hand start`);
  assert(visual.graph.maxBlue > visual.graph.width * .35 && visual.graph.maxBlue < visual.graph.width * .8,
    `${label}: a 13-second trace expands its time scale without clearing or sliding (${JSON.stringify(visual.graph)})`);
  if (label === "development") {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(root, "output", "kinematics-driving-level4-mobile-qa.png"), Buffer.from(screenshot.data, "base64"));
  }
  return `${label} single-slope level 4 and persistent graph passed`;
}
async function levelFiveBoundaryVisual(cdp, baseUrl, activityPath, label) {
  const snapshot = levelFiveBoundaryDraft();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": snapshot,
    "cmi.core.score.raw": ""
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-level5-boundary`)}`, preload);
  await waitFor(cdp, "document.getElementById('panelKicker')?.textContent.includes('第 5 關')", `${label} level 5 boundary`);
  const visual = await evaluate(cdp, `(() => {
    const level=window.KinematicsDrivingLevels.levelById('level5');
    const markers=window.KinematicsDrivingVisuals.boundaryMarkers(level);
    const c=document.getElementById('drivingCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let yellow=0,minX=c.width,maxX=-1,maxRed=-1,lineX=-1,lineCount=-1;
    const yellowByX=Array(c.width).fill(0);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];
      if(r>225&&g>180&&b<120){yellow++;yellowByX[x]++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
      if(r>150&&g<130&&b<130)maxRed=Math.max(maxRed,x);
    }
    yellowByX.forEach((count,x)=>{if(count>lineCount){lineCount=count;lineX=x;}});
    return {
      routeLength:level.routeLength,markers,yellow,minX,maxX,width:c.width,lineX,lineCount,maxRed,
      status:document.getElementById('stageTarget').textContent,
      instruction:document.getElementById('instruction').textContent
    };
  })()`);
  assert.equal(visual.routeLength, 267);
  assert.deepEqual(visual.markers, [
    { position: 70, target: "accelerating" },
    { position: 150, target: "decelerating" },
    { position: 187, target: "uniform" }
  ]);
  assert(visual.yellow > 80 && visual.minX < visual.maxX,
    `${label}: the first instruction sign has a high-contrast line across the road (${JSON.stringify(visual)})`);
  assert(Math.abs(visual.lineX - visual.width * .38) <= 5,
    `${label}: the first boundary reaches the authoritative front position (${JSON.stringify(visual)})`);
  assert(visual.lineX - visual.maxRed >= 0 && visual.lineX - visual.maxRed <= 8,
    `${label}: the yellow line meets the visible front bumper (${JSON.stringify(visual)})`);
  assert.match(visual.status, /保持勻速/);
  assert.match(visual.instruction, /路牌正下方.*黃色分界線.*越過分界線後/);
  assert.doesNotMatch(`${visual.status} ${visual.instruction}`, /準備|計分區|轉換區|下一區/);
  if (label === "development") {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(root, "output", "kinematics-driving-level5-boundary-mobile-qa.png"), Buffer.from(screenshot.data, "base64"));
  }
  return `${label} simple sign-and-line level 5 boundaries passed`;
}
async function nonRetryableSubmission(cdp, baseUrl, activityPath, label) {
  const snapshot = completeReviewDraft();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": snapshot,
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-nonretryable`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} complete review`);
  const state = await evaluate(cdp, `(async () => {
    window.SimScorm.submitWithCallbacks=(_computed,_snapshot,callbacks)=>{
      const outcome={activityState:'retry',retryable:false};
      callbacks.onFailure(outcome);return outcome;
    };
    document.getElementById('submitButton').click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const buttons=Array.from(document.querySelectorAll('[data-edit-level],[data-edit-checkpoint]'));
    const first=buttons[0];first.click();
    return {
      count:buttons.length,allDisabled:buttons.every(button=>button.disabled),
      submitDisabled:document.getElementById('submitButton').disabled,
      reviewVisible:!document.getElementById('reviewSection').classList.contains('is-hidden'),
      activityHidden:document.getElementById('activitySection').classList.contains('is-hidden'),
      notice:document.getElementById('submissionNotice').textContent
    };
  })()`);
  assert.equal(state.count, 6);
  assert.equal(state.allDisabled, true, `${label}: non-retryable failure disables every review edit/checkpoint control`);
  assert.equal(state.submitDisabled, true, `${label}: non-retryable failure disables resubmission`);
  assert.equal(state.reviewVisible, true, `${label}: locked review remains visible`);
  assert.equal(state.activityHidden, true, `${label}: delegated click cannot enter an activity`);
  assert.match(state.notice, /已鎖定/);
  return `${label} non-retryable submission lock passed`;
}

async function directSuccessSubmission(cdp, baseUrl, activityPath, label) {
  const fixture = reviewFixture();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": completeReviewDraft(),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-success`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} success review`);
  await evaluate(cdp, `(() => {
    document.getElementById('controlPanel').scrollTop=document.getElementById('controlPanel').scrollHeight;
    window.__lmsHarness.log.sets=[];
    window.__lmsHarness.log.commits=0;
    window.__lmsHarness.log.finishes=0;
    document.getElementById('submitButton').click();
  })()`);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent.includes('已提交') && document.activeElement?.id === 'resultTitle'", `${label} success result`);
  const result = await evaluate(cdp, `(() => {
    const edit=document.querySelector('[data-edit-level]'),start=document.getElementById('startButton');
    edit?.click();start.click();
    const log=JSON.parse(JSON.stringify(window.__lmsHarness.log));
    const suspendWrites=log.sets.filter(entry=>entry.key==='cmi.suspend_data').map(entry=>entry.value);
    return {
      titleVisible:document.getElementById('resultTitle').getClientRects().length>0,
      focused:document.activeElement?.id,
      panelTop:document.getElementById('controlPanel').scrollTop,
      score:document.getElementById('scorePanel').textContent,
      headers:Array.from(document.querySelectorAll('#feedbackList .feedback-item h3')).map(item=>item.textContent),
      retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
      resultVisible:!document.getElementById('resultSection').classList.contains('is-hidden'),
      activityHidden:document.getElementById('activitySection').classList.contains('is-hidden'),
      checkpointHidden:document.getElementById('checkpointSection').classList.contains('is-hidden'),
      reviewHidden:document.getElementById('reviewSection').classList.contains('is-hidden'),
      stageStatus:document.getElementById('stageStatus').textContent,
      stageTarget:document.getElementById('stageTarget').textContent,
      stageKicker:document.getElementById('stageKicker').textContent,
      reviewToolsVisible:document.getElementById('resultReviewTools').getClientRects().length>0,
      log,suspendWrites,values:{...window.__lmsHarness.values}
    };
  })()`);
  assert.equal(result.titleVisible, true);
  assert.equal(result.focused, "resultTitle");
  assert.equal(result.panelTop, 0, `${label}: success result focus resets the panel`);
  assert.match(result.score, new RegExp(`^${fixture.result.score} / 100`));
  assert.equal(result.headers.length, 6, `${label}: success result shows five trusted levels plus graph evidence`);
  assert(result.headers.some((text) => /平路保持勻速/.test(text)));
  assert(result.headers.some((text) => /圖像證據/.test(text)));
  assert.equal(result.retryHidden, true, `${label}: successful submission has no retry action`);
  assert.equal(result.resultVisible, true);
  assert.equal(result.activityHidden, true, `${label}: locked controls cannot reopen the activity`);
  assert.equal(result.checkpointHidden, true, `${label}: locked edit cannot reopen the checkpoint`);
  assert.equal(result.reviewHidden, true, `${label}: locked edit cannot reopen review controls`);
  assert.match(result.stageKicker, /只讀回放/, `${label}: submitted stage is explicitly readonly`);
  assert(result.stageTarget.trim().length > 0 && result.stageStatus.trim().length > 0,
    `${label}: readonly stage retains its selected-zone target and feedback`);
  assert.equal(result.reviewToolsVisible, true, `${label}: trusted submission exposes readonly review tools`);
  assert.equal(result.suspendWrites.length, 2, `${label}: direct success writes one pending checkpoint and one final review`);
  assert.equal(result.suspendWrites[0], JSON.stringify(fixture.pending),
    `${label}: first durable write is the exact canonical pending-final checkpoint`);
  assert.equal(result.suspendWrites[1], JSON.stringify(fixture.review),
    `${label}: second durable write is the exact canonical final review`);
  assert.deepEqual(result.log.sets.map((entry) => entry.key), [
    "cmi.suspend_data", "cmi.core.lesson_status", "cmi.core.exit",
    "cmi.suspend_data", "cmi.core.score.min", "cmi.core.score.max",
    "cmi.core.score.raw", "cmi.core.lesson_status", "cmi.core.exit"
  ], `${label}: real SCORM success uses the two-phase pending-to-final write order`);
  assert.equal(result.log.commits, 2, `${label}: pending and final review are each committed durably`);
  assert.equal(result.log.finishes, 1, `${label}: direct success finishes the LMS session once`);
  assert.equal(result.values["cmi.suspend_data"], JSON.stringify(fixture.review));
  assert.equal(result.values["cmi.core.score.raw"], String(fixture.result.score));
  assert.equal(result.values["cmi.core.lesson_status"], fixture.result.passed ? "passed" : "failed");
  assert.equal(result.values["cmi.core.exit"], "logout");
  return `${label} direct success is trusted and permanently locked`;
}

async function retryableSubmission(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": completeReviewDraft(),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-retryable`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} retryable review`);
  await evaluate(cdp, `(() => {
    window.__retryable={calls:0,answers:[],sameAnswer:false};
    document.getElementById('controlPanel').scrollTop=document.getElementById('controlPanel').scrollHeight;
    window.SimScorm.submitWithCallbacks=(_computed,snapshot,callbacks)=>{
      window.__retryable.calls+=1;
      window.__retryable.answers.push(JSON.stringify(snapshot.answer));
      if(window.__retryable.calls===1){
        const outcome={ok:false,committed:false,retryable:true,activityState:'retry'};
        callbacks.onFailure(outcome);
        return outcome;
      }
      window.__retryable.sameAnswer=window.__retryable.answers[0]===window.__retryable.answers[1];
      const outcome={ok:true,committed:true,finished:true,activityState:'success'};
      callbacks.onSuccess(outcome);
      return outcome;
    };
    document.getElementById('submitButton').click();
  })()`);
  await waitFor(cdp, "document.activeElement?.id === 'submissionNotice' && document.getElementById('liveRegion')?.textContent.includes('未能確認提交')", `${label} retryable notice`);
  const retry = await evaluate(cdp, `(() => {
    const button=document.getElementById('submissionRetryButton'),notice=document.getElementById('submissionNotice');
    return {
      calls:window.__retryable.calls,
      reviewVisible:!document.getElementById('reviewSection').classList.contains('is-hidden'),
      noticeVisible:notice.getClientRects().length>0&&!notice.classList.contains('is-hidden'),
      notice:notice.textContent,live:document.getElementById('liveRegion').textContent,
      focused:document.activeElement?.id,panelTop:document.getElementById('controlPanel').scrollTop,
      retryVisible:button.getClientRects().length>0&&!button.classList.contains('is-hidden'),
      editsEnabled:Array.from(document.querySelectorAll('[data-edit-level],[data-edit-checkpoint]')).every(item=>!item.disabled),
      submitEnabled:!document.getElementById('submitButton').disabled
    };
  })()`);
  assert.equal(retry.calls, 1);
  assert.equal(retry.reviewVisible, true, `${label}: retryable failure remains on editable review`);
  assert.equal(retry.noticeVisible, true);
  assert.match(retry.notice, /未能確認提交.*可重試/);
  assert.match(retry.live, /未能確認提交.*可重試/, `${label}: retryable notice is announced`);
  assert.equal(retry.focused, "submissionNotice", `${label}: retryable notice receives focus`);
  assert.equal(retry.panelTop, 0, `${label}: retryable notice focus resets the panel`);
  assert.equal(retry.retryVisible, true);
  assert.equal(retry.editsEnabled, true, `${label}: retryable failure does not lock review edits`);
  assert.equal(retry.submitEnabled, true, `${label}: retryable failure does not lock submit`);

  await evaluate(cdp, "document.getElementById('submissionRetryButton').click()");
  await waitFor(cdp, "window.__retryable.calls === 2 && document.getElementById('resultTitle')?.textContent.includes('已提交') && document.activeElement?.id === 'resultTitle'", `${label} retryable success`);
  const success = await evaluate(cdp, `(() => ({
    calls:window.__retryable.calls,sameAnswer:window.__retryable.sameAnswer,
    retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
    resultVisible:!document.getElementById('resultSection').classList.contains('is-hidden'),
    focused:document.activeElement?.id
  }))()`);
  assert.equal(success.calls, 2, `${label}: retry submits exactly twice`);
  assert.equal(success.sameAnswer, true, `${label}: retry submits the same authoritative answer`);
  assert.equal(success.retryHidden, true);
  assert.equal(success.resultVisible, true);
  assert.equal(success.focused, "resultTitle");
  return `${label} retryable submission stays editable then succeeds with the same answer`;
}

async function retryCtaClearedOnEdit(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": completeReviewDraft(),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-retry-cta-edit-clear`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} retry CTA review`);
  await evaluate(cdp, `(() => {
    window.__editRetryCalls=0;
    window.SimScorm.submitWithCallbacks=(_computed,_snapshot,callbacks)=>{
      window.__editRetryCalls+=1;
      const outcome={ok:false,committed:false,retryable:true,activityState:'retry'};
      callbacks.onFailure(outcome);
      return outcome;
    };
    document.getElementById('submitButton').click();
  })()`);
  await waitFor(cdp, "!document.getElementById('submissionRetryButton').classList.contains('is-hidden') && document.activeElement?.id === 'submissionNotice'", `${label} retry CTA visible`);
  await evaluate(cdp, "document.querySelector('[data-edit-level=\"level4\"]').click()");
  await waitFor(cdp, "document.getElementById('panelKicker')?.textContent.includes('第 4 關') && document.getElementById('activitySection')?.getClientRects().length > 0", `${label} retry CTA edit level`);
  const duringEdit = await evaluate(cdp, `(() => ({
    calls:window.__editRetryCalls,
    retryHidden:document.getElementById('submissionRetryButton').classList.contains('is-hidden'),
    activityVisible:document.getElementById('activitySection').getClientRects().length>0,
    reviewVisible:document.getElementById('reviewSection').getClientRects().length>0
  }))()`);
  assert.equal(duringEdit.calls, 1, `${label}: entering an edit never resubmits the old attempt`);
  assert.equal(duringEdit.retryHidden, true, `${label}: entering a review edit clears the stale retry CTA`);
  assert.equal(duringEdit.activityVisible, true);
  assert.equal(duringEdit.reviewVisible, false);
  await evaluate(cdp, "document.getElementById('reviewProgressButton').click()");
  await waitFor(cdp, "document.getElementById('reviewSection')?.getClientRects().length > 0", `${label} return from retry CTA edit`);
  const returned = await evaluate(cdp, `(() => ({
    calls:window.__editRetryCalls,
    retryHidden:document.getElementById('submissionRetryButton').classList.contains('is-hidden'),
    noticeHidden:document.getElementById('submissionNotice').classList.contains('is-hidden'),
    notice:document.getElementById('submissionNotice').textContent
  }))()`);
  assert.equal(returned.calls, 1);
  assert.equal(returned.retryHidden, true, `${label}: stale retry CTA stays cleared on return to review`);
  assert.equal(returned.noticeHidden, true, `${label}: complete review does not retain the stale retry notice`);
  assert.equal(returned.notice, "");
  return `${label} review edit clears an abandoned retryable-submit CTA`;
}

async function frozenAlternativeReview(cdp, baseUrl, activityPath, label) {
  const fixtures = alternativeEqualScoreReviewFixture();
  const alternativePayload = {
    review: fixtures.alternative.review,
    score: fixtures.alternative.result.score,
    passed: fixtures.alternative.result.passed
  };
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": completeReviewDraft(),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-frozen-alternative`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} alternative review`);
  await evaluate(cdp, `(() => {
    const alternative=${JSON.stringify(alternativePayload)};
    window.__alternativeCalls={retryPending:0};
    window.SimScorm.submitWithCallbacks=(_computed,_snapshot,callbacks)=>{
      const outcome={ok:false,committed:false,retryable:true,frozen:true,activityState:'frozen'};
      callbacks.onFailure(outcome);
      return outcome;
    };
    window.SimScorm.retryPending=()=>{
      window.__alternativeCalls.retryPending+=1;
      return {
        ok:true,committed:true,finished:true,
        review:alternative.review,score:alternative.score,
        status:alternative.passed?'passed':'failed'
      };
    };
    document.getElementById('submitButton').click();
  })()`);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && !document.getElementById('resultRetryButton')?.classList.contains('is-hidden')", `${label} frozen alternative ready`);
  await evaluate(cdp, "document.getElementById('resultRetryButton').click()");
  await waitFor(cdp, "window.__alternativeCalls.retryPending === 1 && document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle' && document.getElementById('resultRetryButton')?.classList.contains('is-hidden')", `${label} frozen alternative rejected`);
  const rejected = await evaluate(cdp, `(() => ({
    score:document.getElementById('scorePanel').textContent,
    notice:document.getElementById('feedbackList').textContent,
    trustedHeadings:document.querySelectorAll('#feedbackList .feedback-item h3').length,
    retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
    titleVisible:document.getElementById('resultTitle').getClientRects().length>0,
    focused:document.activeElement?.id,
    stageStatus:document.getElementById('stageStatus').textContent
  }))()`);
  assert.match(rejected.score, /^--/, `${label}: equal-score alternative never displays a trusted aggregate`);
  assert.match(rejected.notice, /提交資料與駕駛記錄不一致/, `${label}: alternative authoritative run is rejected`);
  assert.equal(rejected.trustedHeadings, 0, `${label}: rejected alternative shows no trusted per-level feedback`);
  assert.equal(rejected.retryHidden, true, `${label}: mismatch locks further retries`);
  assert.equal(rejected.titleVisible, true);
  assert.equal(rejected.focused, "resultTitle");
  assert.match(rejected.stageStatus, /不可用/, `${label}: mismatch leaves driving controls technically locked`);
  return `${label} equal-score alternative authoritative review is rejected`;
}

async function progressVisual(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": reviewRetryLevelDraft("level4"),
    "cmi.core.score.raw": ""
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-progress`)}`, preload);
  await waitFor(cdp, "document.getElementById('panelKicker')?.textContent.includes('第 4 關')", `${label} progress`);
  const progress = await evaluate(cdp, `(() => Object.fromEntries(
    Array.from(document.querySelectorAll('[data-step]')).map(item => {
      const style=getComputedStyle(item);
      return [item.dataset.step,{
        current:item.classList.contains('is-current'),
        done:item.classList.contains('is-done'),
        aria:item.getAttribute('aria-current'),
        label:item.getAttribute('aria-label'),
        background:style.backgroundColor,
        color:style.color
      }];
    })
  ))()`);
  assert.equal(progress.level4.current, true, `${label}: level 4 is the computed current progress item`);
  assert.equal(progress.level4.done, true, `${label}: review-retry current level retains its completed marker`);
  assert.equal(progress.level4.aria, "step", `${label}: current progress item exposes aria-current=step`);
  assert.match(progress.level4.label, /目前步驟/, `${label}: current progress label names its state`);
  assert.equal(progress.level1.current, false);
  assert.equal(progress.level1.done, true, `${label}: accepted level is computed as done`);
  assert.equal(progress.level1.aria, "false");
  assert.match(progress.level1.label, /已完成/, `${label}: completed progress label names its state`);
  assert.equal(progress.review.current, false);
  assert.equal(progress.review.done, false);
  assert.notEqual(progress.level4.background, progress.level1.background,
    `${label}: item with both current/done classes still uses the current visual treatment`);
  assert.notEqual(progress.level4.background, progress.review.background,
    `${label}: current and pending progress states are visually distinct`);
  assert.notEqual(progress.level4.color, progress.level1.color,
    `${label}: current progress text has its own computed contrast treatment`);
  return `${label} semantic and computed progress states passed`;
}

async function animationLifecycle(cdp, baseUrl, activityPath, label) {
  const preload = `(() => {
    const nativeRequest=window.requestAnimationFrame.bind(window);
    const nativeCancel=window.cancelAnimationFrame.bind(window);
    const pending=new Set();
    const stats=window.__rafStats={requested:0,executed:0,cancelled:0,pending:0};
    window.requestAnimationFrame=(callback)=>{
      let id=0;
      id=nativeRequest((time)=>{
        pending.delete(id);
        stats.pending=pending.size;
        stats.executed+=1;
        callback(time);
      });
      pending.add(id);
      stats.pending=pending.size;
      stats.requested+=1;
      return id;
    };
    window.cancelAnimationFrame=(id)=>{
      if(pending.delete(id)) stats.cancelled+=1;
      stats.pending=pending.size;
      return nativeCancel(id);
    };
  })();`;
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-animation`)}`, preload);
  await waitFor(cdp, "document.getElementById('panelTitle')?.textContent.includes('操作練習') && window.__rafStats", `${label} animation instrumentation`);
  await delay(180);
  const idleBefore = await evaluate(cdp, "({...window.__rafStats})");
  await delay(220);
  const idleAfter = await evaluate(cdp, "({...window.__rafStats})");
  assert.equal(idleAfter.pending, 0, `${label}: idle activity has no queued animation callback`);
  assert.equal(idleAfter.requested, idleBefore.requested, `${label}: idle activity does not keep scheduling animation frames`);
  assert.equal(idleAfter.executed, idleBefore.executed, `${label}: idle activity executes no animation loop`);

  await evaluate(cdp, "document.getElementById('startButton').click()");
  await delay(260);
  const active = await evaluate(cdp, "({...window.__rafStats})");
  assert(active.executed >= idleAfter.executed + 5,
    `${label}: running simulation schedules animation callbacks (${JSON.stringify({ idleAfter, active })})`);

  await evaluate(cdp, "document.getElementById('pauseButton').click()");
  await delay(180);
  const pausedBefore = await evaluate(cdp, "({...window.__rafStats})");
  await delay(220);
  const pausedAfter = await evaluate(cdp, "({...window.__rafStats})");
  assert.equal(pausedAfter.pending, 0, `${label}: pausing cancels the queued animation callback`);
  assert.equal(pausedAfter.requested, pausedBefore.requested, `${label}: paused activity stops scheduling callbacks`);
  assert.equal(pausedAfter.executed, pausedBefore.executed, `${label}: paused activity executes no animation loop`);
  return `${label} demand-driven animation lifecycle passed`;
}

async function catchupDraftCommitFailure(cdp, baseUrl, activityPath, label) {
  const preload = catchupFailurePreload(practiceDraft());
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-catchup-save-failure`)}`, preload);
  await waitFor(cdp, "document.getElementById('panelTitle')?.textContent.includes('操作練習') && window.__catchupRaf && window.__catchupLms", `${label} catch-up instrumentation`);
  const started = await evaluate(cdp, `(() => {
    window.__catchupLms.log={sets:[],commits:[],finishes:0};
    window.__catchupLms.failCommit=true;
    document.getElementById('startButton').click();
    return {
      pending:window.__catchupRaf.pending(),
      activityVisible:!document.getElementById('activitySection').classList.contains('is-hidden')
    };
  })()`);
  assert(started.pending.includes("animate"), `${label}: start queues the named simulation animation callback`);
  assert.equal(started.activityVisible, true);
  const invoked = await evaluate(cdp, "window.__catchupRaf.runNamed('animate',600)");
  assert.equal(invoked, true, `${label}: test injects one animation frame with more than eight ticks of catch-up`);
  const flushed = await evaluate(cdp, "window.__catchupRaf.flush()");
  assert.equal(flushed.pending, 0, `${label}: catch-up technical transition leaves no animation callback queued`);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle'", `${label} catch-up technical focus`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 391, height: 601, deviceScaleFactor: 1, mobile: true });
  await delay(120);
  await evaluate(cdp, `(() => {
    document.getElementById('startButton').click();
    document.getElementById('resetButton').click();
    document.querySelector('[data-pick-level="level2"]')?.click();
    window.__catchupRaf.flush();
  })()`);
  const result = await evaluate(cdp, `(() => {
    const raw=window.__catchupLms.values['cmi.suspend_data'],snapshot=JSON.parse(raw);
    const state=window.KinematicsDrivingPersistence.decode(snapshot.answer);
    return {
      candidateTicks:state?.candidateRun?.codes?.length,
      phase:state?.phase,variant:state?.variant,
      resultVisible:!document.getElementById('resultSection').classList.contains('is-hidden'),
      activityHidden:document.getElementById('activitySection').classList.contains('is-hidden'),
      checkpointHidden:document.getElementById('checkpointSection').classList.contains('is-hidden'),
      reviewHidden:document.getElementById('reviewSection').classList.contains('is-hidden'),
      graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
      retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
      titleVisible:document.getElementById('resultTitle').getClientRects().length>0,
      focused:document.activeElement?.id,
      score:document.getElementById('scorePanel').textContent,
      notice:document.getElementById('feedbackList').textContent,
      stageStatus:document.getElementById('stageStatus').textContent,
      pendingRaf:window.__catchupRaf.pending(),
      log:JSON.parse(JSON.stringify(window.__catchupLms.log))
    };
  })()`);
  assert.equal(result.candidateTicks, 8, `${label}: catch-up frame processes exactly the eight-tick safety cap`);
  assert.equal(result.phase, "practice");
  assert.equal(result.variant, "paused");
  assert.deepEqual(result.log.commits, [false], `${label}: only the catch-up draft commit is forced to fail`);
  assert.equal(result.resultVisible, true, `${label}: failed catch-up save keeps the technical result visible`);
  assert.equal(result.activityHidden, true, `${label}: later render/control attempts cannot reopen the activity`);
  assert.equal(result.checkpointHidden, true);
  assert.equal(result.reviewHidden, true);
  assert.equal(result.graphHidden, true, `${label}: resize/redraw after catch-up failure keeps the graph hidden`);
  assert.equal(result.retryHidden, true, `${label}: failed draft commit is not presented as a final-submit retry`);
  assert.equal(result.titleVisible, true);
  assert.equal(result.focused, "resultTitle");
  assert.match(result.score, /^--/, `${label}: technical catch-up failure exposes no score`);
  assert.match(result.notice, /未能保存目前進度.*已鎖定/, `${label}: technical result explains the draft failure`);
  assert.match(result.stageStatus, /不可用/, `${label}: stage remains explicitly unavailable`);
  assert(!result.pendingRaf.includes("animate"), `${label}: locked technical state cannot restart animation`);
  return `${label} catch-up plus draft-commit failure stays technically locked`;
}

async function lifecycleFullTickSettlement(cdp, baseUrl, activityPath, label) {
  for (const trigger of ["pagehide", "blur"]) {
    const preload = pagehideSettlePreload(practiceDraft());
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
    await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-${trigger}-full-tick-settle`)}`, preload);
    await waitFor(cdp, "document.getElementById('panelTitle')?.textContent.includes('操作練習') && window.__settleClock && window.__settleLms", `${label} ${trigger} settlement instrumentation`);
    await evaluate(cdp, `(() => {
      window.__settleKeyEvents=[];
      ['keydown','keyup'].forEach(type=>addEventListener(type,event=>window.__settleKeyEvents.push({
        type,trusted:event.isTrusted,key:event.key,code:event.code
      })));
      window.__settleLms.log={sets:[],commits:0,finishes:0};
      document.getElementById('startButton').click();
    })()`);
    const queued = await evaluate(cdp, "window.__settleClock.pending()");
    assert(queued.includes("animate"), `${label}: ${trigger} fixture queues animate without executing it`);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "q", code: "KeyQ", windowsVirtualKeyCode: 81, nativeVirtualKeyCode: 81
    });
    await evaluate(cdp, "window.__settleClock.advance(60)");
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "q", code: "KeyQ", windowsVirtualKeyCode: 81, nativeVirtualKeyCode: 81
    });
    await evaluate(cdp, "window.__settleClock.advance(60)");
    const before = await evaluate(cdp, `(() => ({
      now:window.__settleClock.now(),executed:window.__settleClock.executed,
      keyEvents:window.__settleKeyEvents,
      control:document.getElementById('controlState').textContent,
      pressed:document.getElementById('throttleButton').getAttribute('aria-pressed'),
      pending:window.__settleClock.pending()
    }))()`);
    assert.equal(before.now, 1120, `${label}: ${trigger} clock advances two complete ticks plus a discarded 20ms remainder`);
    assert.equal(before.executed, 0, `${label}: ${trigger} settlement runs before any animation frame`);
    assert(before.keyEvents.some((event) => event.type === "keydown" && event.trusted && event.code === "KeyQ"),
      `${label}: ${trigger} queues a trusted keyboard throttle transition`);
    assert(before.keyEvents.some((event) => event.type === "keyup" && event.trusted && event.code === "KeyQ"),
      `${label}: ${trigger} queues a trusted keyboard neutral transition`);
    assert.equal(before.control, "目前：空檔", `${label}: ${trigger} keyboard release visibly returns to neutral before lifecycle save`);
    assert.equal(before.pressed, "false");
    if (trigger === "pagehide") {
      await evaluate(cdp, "window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))");
    } else {
      await evaluate(cdp, "window.dispatchEvent(new Event('blur'))");
    }
    await delay(60);
    const after = await evaluate(cdp, `(() => {
      const raw=window.__settleLms.values['cmi.suspend_data'],snapshot=JSON.parse(raw);
      const state=window.KinematicsDrivingPersistence.decode(snapshot.answer);
      return {
        phase:state?.phase,variant:state?.variant,codes:state?.candidateRun?.codes||[],
        raw,
        control:document.getElementById('controlState').textContent,
        pressed:document.getElementById('throttleButton').getAttribute('aria-pressed'),
        pending:window.__settleClock.pending(),executed:window.__settleClock.executed,
        log:JSON.parse(JSON.stringify(window.__settleLms.log))
      };
    })()`);
    assert.equal(after.phase, "practice");
    assert.equal(after.variant, "paused", `${label}: ${trigger} persists the interrupted run as paused`);
    assert.deepEqual(after.codes, [1, 0],
      `${label}: ${trigger} saves exactly the two due full ticks—throttle then neutral—with no partial tick`);
    assert.equal(after.control, "目前：空檔", `${label}: ${trigger} cannot leave a sticky control`);
    assert.equal(after.pressed, "false");
    assert.equal(after.executed, 0, `${label}: ${trigger} never executes the queued animation frame`);
    assert(!after.pending.includes("animate"), `${label}: ${trigger} cancels the stale animation callback`);
    assert.equal(after.log.commits, 1, `${label}: ${trigger} durably commits the settled paused draft once`);
    assert.equal(after.log.sets.filter((entry) => entry.key === "cmi.suspend_data").length, 1,
      `${label}: ${trigger} writes exactly one settled draft snapshot`);
    assert.equal(after.log.finishes, trigger === "pagehide" ? 1 : 0,
      `${label}: only pagehide closes the LMS session immediately`);
    if (trigger === "blur") {
      await evaluate(cdp, "window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))");
      await delay(50);
      const closing = await evaluate(cdp, `(() => ({
        raw:window.__settleLms.values['cmi.suspend_data'],
        log:JSON.parse(JSON.stringify(window.__settleLms.log))
      }))()`);
      assert.equal(closing.raw, after.raw, `${label}: pagehide preserves the already settled blur snapshot`);
      assert.equal(closing.log.commits, 1, `${label}: pagehide deduplicates the identical durable blur draft`);
      assert.equal(closing.log.finishes, 1, `${label}: pagehide still closes the LMS session after blur`);
    }
  }
  return `${label} pagehide/blur settle due keyboard transitions into full neutral ticks`;
}

async function terminalFrameRendering(cdp, baseUrl, activityPath, label) {
  const fixture = nearTerminalDraft("level1", 1);
  for (const commitFails of [false, true]) {
    const name = commitFails ? "commit-failure" : "normal";
    const preload = catchupFailurePreload(fixture.snapshot);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: true });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-terminal-frame-${name}`)}`, preload);
    await waitFor(cdp, "document.getElementById('panelKicker')?.textContent.includes('第 1 關') && window.__catchupRaf && window.__catchupLms", `${label} terminal frame ${name}`);
    const point = await evaluate(cdp, `(() => {
      window.__catchupLms.log={sets:[],commits:[],finishes:0};
      window.__catchupLms.failCommit=${JSON.stringify(commitFails)};
      document.getElementById('startButton').click();
      const panel=document.getElementById('controlPanel'),button=document.getElementById('throttleButton');
      panel.scrollTop=0;
      const initial=button.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
      panel.scrollTop+=initial.top-panelRect.top-10;
      const rect=button.getBoundingClientRect();
      return {x:rect.left+rect.width*.18,y:rect.top+rect.height/2,pending:window.__catchupRaf.pending()};
    })()`);
    assert(point.pending.includes("animate"), `${label}: terminal ${name} queues the named animation callback`);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: commitFails ? 161 : 160, radiusX: 1, radiusY: 1, force: 1 }]
    });
    const invoked = await evaluate(cdp, "window.__catchupRaf.runNamed('animate',60)");
    assert.equal(invoked, true, `${label}: terminal ${name} executes exactly the completing frame`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await evaluate(cdp, "window.__catchupRaf.flush()");
    if (commitFails) {
      await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態'", `${label} terminal commit-failure technical state`);
    } else {
      await waitFor(cdp, "!document.getElementById('analysisSection')?.classList.contains('is-hidden')", `${label} terminal normal analysis state`);
    }
    const result = await evaluate(cdp, `(() => {
      const raw=window.__catchupLms.values['cmi.suspend_data'],snapshot=JSON.parse(raw);
      const state=window.KinematicsDrivingPersistence.decode(snapshot.answer);
      return {
        phase:state?.phase,variant:state?.variant,codes:state?.candidateRun?.codes||[],
        stageStatus:document.getElementById('stageStatus').textContent,
        stageTarget:document.getElementById('stageTarget').textContent,
        resultVisible:document.getElementById('resultSection').getClientRects().length>0,
        analysisVisible:document.getElementById('analysisSection').getClientRects().length>0,
        graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
        startDisabled:document.getElementById('startButton').disabled,
        notice:document.getElementById('feedbackList').textContent,
        pending:window.__catchupRaf.pending(),
        log:JSON.parse(JSON.stringify(window.__catchupLms.log))
      };
    })()`);
    assert.equal(result.phase, "level");
    assert.equal(result.variant, "analysis", `${label}: terminal ${name} normalizes the completing run before durable save`);
    assert.equal(result.codes.length, fixture.prefixLength + 1, `${label}: terminal ${name} adds exactly the completing tick`);
    assert.equal(result.codes.at(-1), fixture.code, `${label}: terminal ${name} records the queued completing control`);
    assert(!result.pending.includes("animate"), `${label}: terminal ${name} leaves no animation callback`);
    if (commitFails) {
      assert.deepEqual(result.log.commits, [false], `${label}: terminal commit-failure attempts exactly one failed durable save`);
      assert.equal(result.resultVisible, true);
      assert.equal(result.analysisVisible, false, `${label}: technical lock is not overwritten by the terminal analysis render`);
      assert.equal(result.graphHidden, true);
      assert.equal(result.startDisabled, true);
      assert.match(result.notice, /未能保存目前進度.*已鎖定/);
      assert.match(result.stageTarget, /操作已鎖定/, `${label}: terminal commit failure keeps the locked target copy`);
      assert.match(result.stageStatus, /不可用/, `${label}: terminal commit failure keeps the technical stage copy`);
    } else {
      assert.deepEqual(result.log.commits, [true], `${label}: normal terminal frame commits the analysis draft once`);
      assert.equal(result.resultVisible, false);
      assert.equal(result.analysisVisible, true);
      assert.match(result.stageStatus, /試車已完成.*只讀回放/,
        `${label}: completing frame cannot overwrite finishRun's terminal status with qualitative motion`);
    }
  }
  return `${label} completing animation frame preserves terminal or technical render state`;
}

async function committedFinishRetry(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": completeReviewDraft(),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-committed-finish`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} committed review`);
  await evaluate(cdp, `(() => {
    window.__submissionCalls={submit:0,finish:0,retryPending:0};
    document.getElementById('controlPanel').scrollTop=document.getElementById('controlPanel').scrollHeight;
    window.SimScorm.submitWithCallbacks=(_computed,_snapshot,callbacks)=>{
      window.__submissionCalls.submit+=1;
      const outcome={ok:false,committed:true,finished:false,retryable:true,frozen:true,activityState:'committed'};
      callbacks.onFailure(outcome);
      return outcome;
    };
    window.SimScorm.finish=()=>{window.__submissionCalls.finish+=1;return true;};
    window.SimScorm.retryPending=()=>{window.__submissionCalls.retryPending+=1;return {ok:false,reason:'unexpected'};};
    document.getElementById('submitButton').click();
  })()`);
  await waitFor(cdp, "!document.getElementById('resultSection')?.classList.contains('is-hidden') && document.activeElement?.id === 'resultTitle'", `${label} committed result focus`);
  const before = await evaluate(cdp, `(() => {
    const title=document.getElementById('resultTitle'),retry=document.getElementById('resultRetryButton');
    return {
      calls:{...window.__submissionCalls},
      title:title.textContent,titleVisible:title.getClientRects().length>0,focused:document.activeElement?.id,
      notice:document.getElementById('feedbackList').textContent,
      retryVisible:retry.getClientRects().length>0&&!retry.classList.contains('is-hidden'),
      panelTop:document.getElementById('controlPanel').scrollTop
    };
  })()`);
  assert.equal(before.calls.submit, 1);
  assert.equal(before.calls.finish, 0);
  assert.equal(before.calls.retryPending, 0);
  assert.equal(before.titleVisible, true, `${label}: committed result title is visible`);
  assert.equal(before.focused, "resultTitle", `${label}: committed result title receives focus`);
  assert.equal(before.panelTop, 0, `${label}: result focus resets the independently scrolling panel`);
  assert.match(before.notice, /成績已寫入.*尚未完成/, `${label}: committed state shows the finish notice`);
  assert.equal(before.retryVisible, true, `${label}: committed state exposes finish retry`);

  await evaluate(cdp, "document.getElementById('resultRetryButton').click()");
  await waitFor(cdp, "window.__submissionCalls.finish === 1 && document.getElementById('resultRetryButton').classList.contains('is-hidden') && document.activeElement?.id === 'resultTitle'", `${label} finish-only retry`);
  const after = await evaluate(cdp, `(() => ({
    calls:{...window.__submissionCalls},
    title:document.getElementById('resultTitle').textContent,
    titleVisible:document.getElementById('resultTitle').getClientRects().length>0,
    retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
    focused:document.activeElement?.id
  }))()`);
  assert.equal(after.calls.finish, 1, `${label}: committed retry calls finish exactly once`);
  assert.equal(after.calls.retryPending, 0, `${label}: committed retry never calls retryPending`);
  assert.equal(after.retryHidden, true);
  assert.equal(after.titleVisible, true);
  assert.equal(after.focused, "resultTitle");
  return `${label} committed submission uses finish-only retry`;
}

async function frozenPendingRetry(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": completeReviewDraft(),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-frozen-retry`)}`, preload);
  await waitFor(cdp, "!document.getElementById('reviewSection')?.classList.contains('is-hidden') && !document.getElementById('submitButton')?.disabled", `${label} frozen review`);
  await evaluate(cdp, `(() => {
    window.__frozenCalls={submit:0,retryPending:0,finish:0,sameReview:false};
    document.getElementById('controlPanel').scrollTop=document.getElementById('controlPanel').scrollHeight;
    window.SimScorm.submitWithCallbacks=(computed,snapshot,callbacks)=>{
      window.__frozenCalls.submit+=1;
      window.__frozenExpected={computed:JSON.parse(JSON.stringify(computed)),snapshot:JSON.parse(JSON.stringify(snapshot))};
      const outcome={ok:false,committed:false,finished:false,retryable:true,frozen:true,activityState:'frozen'};
      callbacks.onFailure(outcome);
      return outcome;
    };
    window.SimScorm.finish=()=>{window.__frozenCalls.finish+=1;return true;};
    window.SimScorm.retryPending=()=>{
      window.__frozenCalls.retryPending+=1;
      const expected=window.__frozenExpected;
      const review=JSON.parse(JSON.stringify(expected.snapshot));
      window.__frozenCalls.sameReview=JSON.stringify(review.answer)===JSON.stringify(expected.snapshot.answer);
      return {
        ok:true,committed:true,finished:true,review,
        score:expected.computed.score,status:expected.computed.passed?'passed':'failed'
      };
    };
    document.getElementById('submitButton').click();
  })()`);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle'", `${label} frozen technical focus`);
  const before = await evaluate(cdp, `(() => {
    const retry=document.getElementById('resultRetryButton'),title=document.getElementById('resultTitle');
    return {
      calls:{...window.__frozenCalls},titleVisible:title.getClientRects().length>0,
      retryVisible:retry.getClientRects().length>0&&!retry.classList.contains('is-hidden'),
      notice:document.getElementById('feedbackList').textContent,focused:document.activeElement?.id,
      panelTop:document.getElementById('controlPanel').scrollTop
    };
  })()`);
  assert.equal(before.titleVisible, true);
  assert.equal(before.retryVisible, true, `${label}: frozen state exposes pending retry`);
  assert.equal(before.focused, "resultTitle");
  assert.equal(before.panelTop, 0, `${label}: technical focus resets the independently scrolling panel`);
  assert.match(before.notice, /提交仍待確認.*同一份提交/, `${label}: frozen notice describes the immutable retry`);

  await evaluate(cdp, "document.getElementById('resultRetryButton').click()");
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent.includes('已提交') && document.activeElement?.id === 'resultTitle'", `${label} frozen retry result`);
  const after = await evaluate(cdp, `(() => ({
    calls:{...window.__frozenCalls},
    titleVisible:document.getElementById('resultTitle').getClientRects().length>0,
    score:document.getElementById('scorePanel').textContent,
    retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
    focused:document.activeElement?.id
  }))()`);
  assert.equal(after.calls.retryPending, 1, `${label}: frozen retry calls retryPending exactly once`);
  assert.equal(after.calls.finish, 0, `${label}: app does not replace pending retry with a direct finish`);
  assert.equal(after.calls.sameReview, true, `${label}: retry returns the exact submitted review`);
  assert.match(after.score, /\/ 100/);
  assert.equal(after.retryHidden, true);
  assert.equal(after.titleVisible, true);
  assert.equal(after.focused, "resultTitle");
  return `${label} frozen submission retries and validates the same review`;
}

async function validStartupPending(cdp, baseUrl, activityPath, label) {
  const fixture = reviewFixture();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify(fixture.pending),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-startup-pending`)}`, preload);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle'", `${label} startup pending`);
  const before = await evaluate(cdp, `(() => {
    const retry=document.getElementById('resultRetryButton'),title=document.getElementById('resultTitle');
    return {
      titleVisible:title.getClientRects().length>0,
      retryVisible:retry.getClientRects().length>0&&!retry.classList.contains('is-hidden'),
      notice:document.getElementById('feedbackList').textContent,
      focused:document.activeElement?.id,
      log:JSON.parse(JSON.stringify(window.__lmsHarness.log))
    };
  })()`);
  assert.equal(before.titleVisible, true);
  assert.equal(before.retryVisible, true, `${label}: valid pending startup offers retry`);
  assert.equal(before.focused, "resultTitle");
  assert.match(before.notice, /待確認/);
  assert.equal(before.log.sets.length, 0, `${label}: loading a pending attempt does not rewrite it`);

  await evaluate(cdp, "document.getElementById('resultRetryButton').click()");
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent.includes('已提交') && document.activeElement?.id === 'resultTitle'", `${label} startup pending committed`);
  const after = await evaluate(cdp, `(() => ({
    titleVisible:document.getElementById('resultTitle').getClientRects().length>0,
    score:document.getElementById('scorePanel').textContent,
    retryHidden:document.getElementById('resultRetryButton').classList.contains('is-hidden'),
    focused:document.activeElement?.id,
    log:JSON.parse(JSON.stringify(window.__lmsHarness.log)),
    values:{...window.__lmsHarness.values},
    reviewToolsVisible:!document.getElementById('resultReviewTools').classList.contains('is-hidden'),
    levelTools:Array.from(document.querySelectorAll('[data-result-level]')).map(button=>({
      level:button.dataset.resultLevel,pressed:button.getAttribute('aria-pressed'),disabled:button.disabled
    })),
    resultRangeHeight:document.getElementById('resultScrubRange').getBoundingClientRect().height,
    checkpointFeedback:Array.from(document.querySelectorAll('#feedbackList .feedback-item')).at(-1)?.textContent||''
  }))()`);
  assert.equal(after.titleVisible, true);
  assert.equal(after.retryHidden, true);
  assert.equal(after.focused, "resultTitle");
  assert.match(after.score, new RegExp(`^${fixture.result.score} / 100`));
  assert.equal(after.log.commits, 1, `${label}: pending retry durably commits once`);
  assert.equal(after.log.finishes, 1, `${label}: pending retry finishes the LMS session once`);
  assert.equal(after.values["cmi.suspend_data"], JSON.stringify(fixture.review),
    `${label}: pending retry writes the validated review snapshot`);
  assert.equal(after.values["cmi.core.score.raw"], String(fixture.result.score));
  assert.equal(after.values["cmi.core.lesson_status"], fixture.result.passed ? "passed" : "failed");
  assert.equal(after.reviewToolsVisible, true, `${label}: validated pending result exposes trusted readonly review tools`);
  assert.equal(after.levelTools.length, 5, `${label}: validated pending result exposes all five submitted runs`);
  assert.equal(after.levelTools.every((item) => !item.disabled), true, `${label}: every submitted run tool is usable`);
  assert.equal(after.levelTools.filter((item) => item.pressed === "true").length, 1,
    `${label}: validated pending result has exactly one selected readonly run`);
  assert(after.resultRangeHeight >= 44, `${label}: validated pending result exposes the 44px readonly range`);
  assert.match(after.checkpointFeedback, /你的答案：.*（正確）。/,
    `${label}: validated pending result shows the learner's actual checkpoint answer`);
  assert.match(after.checkpointFeedback, /正確解釋：/,
    `${label}: validated pending result includes the authoritative checkpoint explanation`);
  return `${label} valid startup pending submission passed`;
}

async function tamperedStartupPending(cdp, baseUrl, activityPath, label) {
  const fixture = reviewFixture();
  const tampered = JSON.parse(JSON.stringify(fixture.pending));
  tampered.payload.score += 1;
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify(tampered),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-tampered-pending`)}`, preload);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle'", `${label} tampered pending`);
  const before = await evaluate(cdp, `(() => {
    const retry=document.getElementById('resultRetryButton'),title=document.getElementById('resultTitle');
    return {
      titleVisible:title.getClientRects().length>0,
      retryHidden:retry.classList.contains('is-hidden')||retry.getClientRects().length===0,
      notice:document.getElementById('feedbackList').textContent,
      focused:document.activeElement?.id,
      stageStatus:document.getElementById('stageStatus').textContent,
      graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
      log:JSON.parse(JSON.stringify(window.__lmsHarness.log))
    };
  })()`);
  assert.equal(before.titleVisible, true);
  assert.equal(before.retryHidden, true, `${label}: tampered pending attempt cannot be retried`);
  assert.equal(before.focused, "resultTitle");
  assert.match(before.notice, /資料與駕駛記錄不一致.*鎖定/, `${label}: tampered pending notice explains the safe lock`);
  assert.match(before.stageStatus, /不可用/, `${label}: technical load makes the stage status explicitly unavailable`);
  assert.equal(before.graphHidden, true, `${label}: technical load hides untrusted graph output`);
  assert.equal(before.log.sets.length, 0);
  assert.equal(before.log.commits, 0);

  await evaluate(cdp, "window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))");
  await delay(80);
  const after = await evaluate(cdp, "JSON.parse(JSON.stringify(window.__lmsHarness.log))");
  assert.equal(after.sets.length, 0, `${label}: pagehide never writes a quarantined pending result`);
  assert.equal(after.commits, 0, `${label}: pagehide never commits a quarantined pending result`);
  assert.equal(after.finishes, 1, `${label}: quarantined session may close without final writes`);
  return `${label} tampered startup pending is quarantined on pagehide`;
}

async function noncanonicalUnderBudgetPending(cdp, baseUrl, activityPath, label) {
  const fixture = noncanonicalUnderBudgetPendingFixture();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify(fixture.pending),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-noncanonical-under-budget-pending`)}`, preload);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle'", `${label} noncanonical under-budget pending`);
  const before = await evaluate(cdp, `(() => {
    const raw=window.__lmsHarness.values['cmi.suspend_data'];
    const pending=JSON.parse(raw),review=JSON.parse(pending.payload.reviewJson);
    const retry=document.getElementById('resultRetryButton');
    return {
      bytes:new TextEncoder().encode(raw).length,
      nestedExtra:review.answer.ignored,
      decodes:Boolean(window.KinematicsDrivingPersistence.decodeReview(review.answer)),
      retryHidden:retry.classList.contains('is-hidden')||retry.getClientRects().length===0,
      graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
      notice:document.getElementById('feedbackList').textContent,
      score:document.getElementById('scorePanel').textContent,
      log:JSON.parse(JSON.stringify(window.__lmsHarness.log))
    };
  })()`);
  assert(before.bytes < 4000, `${label}: canonical-only rejection fixture remains below 4000 bytes`);
  assert.equal(before.nestedExtra, "noncanonical-but-under-budget");
  assert.equal(before.decodes, true, `${label}: semantic decode alone deliberately accepts the ignored extra field`);
  assert.equal(before.retryHidden, true, `${label}: under-budget noncanonical pending cannot be retried`);
  assert.equal(before.graphHidden, true, `${label}: under-budget noncanonical pending exposes no untrusted graph`);
  assert.match(before.notice, /資料與駕駛記錄不一致.*鎖定/,
    `${label}: exact canonical mismatch is presented as a safe technical lock`);
  assert.match(before.score, /^--/, `${label}: canonical mismatch exposes no score`);
  assert.equal(before.log.sets.length, 0);
  assert.equal(before.log.commits, 0);

  await evaluate(cdp, "window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))");
  await delay(80);
  const after = await evaluate(cdp, "JSON.parse(JSON.stringify(window.__lmsHarness.log))");
  assert.equal(after.sets.length, 0, `${label}: pagehide never writes the under-budget noncanonical pending`);
  assert.equal(after.commits, 0, `${label}: pagehide never commits the under-budget noncanonical pending`);
  assert.equal(after.finishes, 1, `${label}: quarantined canonical mismatch may only close the LMS session`);
  return `${label} under-budget noncanonical pending fails exact canonical validation`;
}

async function noncanonicalOversizedPending(cdp, baseUrl, activityPath, label) {
  const fixture = oversizedNoncanonicalPendingFixture();
  const preload = lmsPreload({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify(fixture.pending),
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-noncanonical-oversized-pending`)}`, preload);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent === '技術狀態' && document.activeElement?.id === 'resultTitle'", `${label} noncanonical oversized pending`);
  const before = await evaluate(cdp, `(() => {
    const raw=window.__lmsHarness.values['cmi.suspend_data'];
    const pending=JSON.parse(raw),review=JSON.parse(pending.payload.reviewJson);
    const retry=document.getElementById('resultRetryButton'),title=document.getElementById('resultTitle');
    return {
      bytes:new TextEncoder().encode(pending.payload.reviewJson).length,
      nestedPadding:review.answer.ignored?.padding?.length,
      decodes:Boolean(window.KinematicsDrivingPersistence.decodeReview(review.answer)),
      titleVisible:title.getClientRects().length>0,
      retryHidden:retry.classList.contains('is-hidden')||retry.getClientRects().length===0,
      graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
      activityHidden:document.getElementById('activitySection').classList.contains('is-hidden'),
      notice:document.getElementById('feedbackList').textContent,
      score:document.getElementById('scorePanel').textContent,
      focused:document.activeElement?.id,
      log:JSON.parse(JSON.stringify(window.__lmsHarness.log))
    };
  })()`);
  assert(before.bytes > 4000, `${label}: nested pending review exceeds the 4000-byte budget`);
  assert.equal(before.nestedPadding, 4200, `${label}: ignored nested padding reached the browser intact`);
  assert.equal(before.decodes, true, `${label}: semantic decoder alone would accept the nested extra field`);
  assert.equal(before.titleVisible, true);
  assert.equal(before.focused, "resultTitle");
  assert.equal(before.retryHidden, true, `${label}: noncanonical oversized pending offers no retry`);
  assert.equal(before.graphHidden, true, `${label}: noncanonical oversized pending hides the graph`);
  assert.equal(before.activityHidden, true, `${label}: noncanonical oversized pending keeps controls hidden`);
  assert.match(before.notice, /資料與駕駛記錄不一致.*鎖定/,
    `${label}: canonical/size rejection is presented as a safe technical lock`);
  assert.match(before.score, /^--/, `${label}: rejected pending snapshot exposes no trusted score`);
  assert.equal(before.log.sets.length, 0, `${label}: canonical validation performs no LMS writes`);
  assert.equal(before.log.commits, 0);

  await evaluate(cdp, "window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))");
  await delay(80);
  const after = await evaluate(cdp, "JSON.parse(JSON.stringify(window.__lmsHarness.log))");
  assert.equal(after.sets.length, 0, `${label}: pagehide never writes the rejected oversized pending result`);
  assert.equal(after.commits, 0, `${label}: pagehide never commits the rejected oversized pending result`);
  assert.equal(after.finishes, 1, `${label}: rejected oversized pending may only close the LMS session`);
  return `${label} noncanonical oversized nested pending fails closed`;
}

async function invalidFinishedFallback(cdp, baseUrl, activityPath, label) {
  const preload = lmsPreload({
    "cmi.core.lesson_status": "passed",
    "cmi.suspend_data": "{",
    "cmi.core.score.raw": ""
  });
  await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-finished-fallback`)}`, preload);
  await waitFor(cdp, "document.getElementById('resultTitle')?.textContent.includes('安全摘要') && document.activeElement?.id === 'resultTitle'", `${label} finished fallback`);
  const result = await evaluate(cdp, `(() => {
    const title=document.getElementById('resultTitle'),retry=document.getElementById('resultRetryButton');
    return {
      title:title.textContent,titleVisible:title.getClientRects().length>0,
      score:document.getElementById('scorePanel').textContent,
      notice:document.getElementById('feedbackList').textContent,
      retryHidden:retry.classList.contains('is-hidden')||retry.getClientRects().length===0,
      focused:document.activeElement?.id,
      graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
      log:JSON.parse(JSON.stringify(window.__lmsHarness.log))
    };
  })()`);
  assert.equal(result.titleVisible, true);
  assert.equal(result.focused, "resultTitle");
  assert.match(result.score, /^-- \/ 100\s+已通過$/, `${label}: empty LMS score stays unknown while passed status is preserved`);
  assert.match(result.notice, /詳細駕駛記錄無法安全還原/, `${label}: invalid finished snapshot shows a visible fallback notice`);
  assert.equal(result.retryHidden, true);
  assert.equal(result.graphHidden, true, `${label}: invalid finished fallback never redraws an untrusted graph`);
  assert.equal(result.log.sets.length, 0, `${label}: finished fallback is read-only`);
  return `${label} invalid finished attempt preserves empty score and passed status`;
}

async function finishedNonReviewSafeSummary(cdp, baseUrl, activityPath, label) {
  const fixture = reviewFixture();
  const cases = [
    { name: "valid-draft", status: "passed", score: "73", snapshot: practiceDraft(), label: "已通過" },
    {
      name: "valid-pending-final",
      status: "failed",
      score: "42",
      snapshot: JSON.stringify(fixture.pending),
      label: "未通過"
    }
  ];
  for (const scenario of cases) {
    const preload = lmsPreload({
      "cmi.core.lesson_status": scenario.status,
      "cmi.suspend_data": scenario.snapshot,
      "cmi.core.score.raw": scenario.score
    });
    await navigate(cdp, `${baseUrl}${activityPath}?qa=${encodeURIComponent(`${label}-finished-${scenario.name}`)}`, preload);
    await waitFor(cdp, "document.getElementById('resultTitle')?.textContent.includes('安全摘要') && document.activeElement?.id === 'resultTitle'", `${label} finished ${scenario.name} fallback`);
    const before = await evaluate(cdp, `(() => {
      const retry=document.getElementById('resultRetryButton');
      return {
        title:document.getElementById('resultTitle').textContent,
        score:document.getElementById('scorePanel').textContent,
        notice:document.getElementById('feedbackList').textContent,
        focused:document.activeElement?.id,
        retryHidden:retry.classList.contains('is-hidden')||retry.getClientRects().length===0,
        graphHidden:document.getElementById('graphCard').classList.contains('is-hidden'),
        toolsHidden:document.getElementById('resultReviewTools').classList.contains('is-hidden'),
        log:JSON.parse(JSON.stringify(window.__lmsHarness.log))
      };
    })()`);
    assert.match(before.score, new RegExp(`^${scenario.score} / 100\\s+${scenario.label}$`),
      `${label}: finished ${scenario.name} preserves LMS score and completion status`);
    assert.match(before.notice, /詳細駕駛記錄無法安全還原/,
      `${label}: finished ${scenario.name} explains why only a safe summary is available`);
    assert.equal(before.focused, "resultTitle");
    assert.equal(before.retryHidden, true);
    assert.equal(before.graphHidden, true, `${label}: finished ${scenario.name} exposes no untrusted graph`);
    assert.equal(before.toolsHidden, true, `${label}: finished ${scenario.name} exposes no untrusted readonly tools`);
    assert.equal(before.log.sets.length, 0, `${label}: finished ${scenario.name} startup is read-only`);
    assert.equal(before.log.commits, 0);
    await evaluate(cdp, "window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))");
    await delay(60);
    const after = await evaluate(cdp, "JSON.parse(JSON.stringify(window.__lmsHarness.log))");
    assert.equal(after.sets.length, 0, `${label}: finished ${scenario.name} pagehide performs no writes`);
    assert.equal(after.commits, 0, `${label}: finished ${scenario.name} pagehide performs no commit`);
    assert.equal(after.finishes, 1, `${label}: finished ${scenario.name} may only close the LMS session`);
  }
  return `${label} finished valid draft/pending-final preserve safe LMS summaries`;
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
  const pageErrors = [];
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
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      pageErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "Uncaught page exception");
    });
    cdp.on("Runtime.consoleAPICalled", ({ type, args = [] }) => {
      if (type === "error" || type === "assert") {
        pageErrors.push(`console.${type}: ${args.map((item) => item.value ?? item.description ?? item.type ?? "").join(" ")}`);
      }
    });
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    const summaries = [];
    summaries.push(await smoke(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await embeddedMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await embeddedTrustedDirectMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await embeddedSubmittedReviewMatrix(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await smoke(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await embeddedMatrix(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await embeddedTrustedDirectMatrix(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await embeddedSubmittedReviewMatrix(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await desktopGeometry(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await desktopGeometry(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await compactGeometry(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await compactGeometry(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await freeLevelSelection(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await freeLevelSelection(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await analysisScrub(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await analysisScrub(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await checkpointScrub(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await checkpointScrub(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await multiZoneAnalysis(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await multiZoneAnalysis(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await levelFourVisual(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await levelFourVisual(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await levelFiveBoundaryVisual(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await levelFiveBoundaryVisual(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await nonRetryableSubmission(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await nonRetryableSubmission(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await directSuccessSubmission(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await directSuccessSubmission(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await retryableSubmission(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await retryableSubmission(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await retryCtaClearedOnEdit(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await retryCtaClearedOnEdit(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await frozenAlternativeReview(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await frozenAlternativeReview(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await progressVisual(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await progressVisual(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await animationLifecycle(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await animationLifecycle(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await catchupDraftCommitFailure(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await catchupDraftCommitFailure(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await lifecycleFullTickSettlement(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await lifecycleFullTickSettlement(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await terminalFrameRendering(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await terminalFrameRendering(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await committedFinishRetry(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await committedFinishRetry(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await frozenPendingRetry(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await frozenPendingRetry(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await validStartupPending(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await validStartupPending(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await tamperedStartupPending(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await tamperedStartupPending(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await noncanonicalUnderBudgetPending(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await noncanonicalUnderBudgetPending(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await noncanonicalOversizedPending(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await noncanonicalOversizedPending(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await invalidFinishedFallback(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await invalidFinishedFallback(cdp, artifactUrl, activityPath, "packaged"));
    summaries.push(await finishedNonReviewSafeSummary(cdp, sourceUrl, `/${slug}/index.html`, "development"));
    summaries.push(await finishedNonReviewSafeSummary(cdp, artifactUrl, activityPath, "packaged"));
    await replacePreload(cdp);
    const counts = preloadCounts.get(cdp) || { installed: 0, removed: 0 };
    assert.equal(counts.removed, counts.installed,
      `browser preloads are removed between scenarios (${JSON.stringify(counts)})`);
    assert.deepEqual(pageErrors, [], `browser runtime/console errors:\n${pageErrors.join("\n")}`);
    console.log(`Kinematics driving browser regression passed: ${summaries.join("; ")}`);
  } catch (error) { failure = error; }
  try { if (cdp) await replacePreload(cdp); } catch (error) { failure ||= error; }
  try { if (chrome) await stopChrome(chrome, cdp); } catch (error) { failure ||= error; }
  try { await cdp?.close?.(); } catch (error) { failure ||= error; }
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
