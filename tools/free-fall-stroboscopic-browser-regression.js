#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { XMLParser } = require("fast-xml-parser");
const {
  CdpClient, buildAndExtractPackage, cleanupResources, createServer, delay, devToolsPort,
  evaluate, fetchJson, findBrowser, listenServer, validateOwnedProfile, withTimeout
} = require("./position-time-browser-regression.js");

const root = path.resolve(__dirname, "..");
const slug = "free-fall-stroboscopic-measurement-lab";
const REQUIRED_VIEWPORTS = Object.freeze([
  [320, 500, 1], [390, 500, 1], [390, 600, 1],
  [430, 800, 1], [700, 390, 1], [390, 600, 2]
]);

function sourceParity() {
  const html = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "sim", "manifests", `${slug}.xml`), "utf8");
  const referenced = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1]).filter((value) => /\.(?:js|css)$/.test(value))
    .map((value) => value.startsWith("../") ? value.slice(3) : `${slug}/${value}`));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(manifest);
  const declared = new Set([].concat(parsed.manifest.resources.resource.file || [])
    .map((entry) => entry["@_href"]).filter((value) => value !== "config.js" && value !== `${slug}/index.html`));
  assert.deepEqual([...referenced].sort(), [...declared].sort(), "manifest exactly declares every local runtime dependency");
}

async function navigate(cdp, url, embedded = false) {
  await cdp.send("Page.navigate", { url });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = await evaluate(cdp, embedded
      ? "Boolean(document.getElementById('activity')?.contentWindow?.__freeFallDebug)"
      : "Boolean(window.__freeFallDebug)");
    if (ready) return;
    await delay(50);
  }
  throw new Error(`free-fall activity did not load: ${url}`);
}

async function setViewport(cdp, width, height, pageScale = 1) {
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: pageScale });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
}

async function prepare(cdp, frameExpression = "window") {
  await evaluate(cdp, `(() => { const w=${frameExpression},d=w.document; d.querySelector('[data-frequency="5"]').click(); d.getElementById('generateButton').click(); })()`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const mode = await evaluate(cdp, `${frameExpression}.__freeFallDebug.animation().mode`);
    if (mode === "static") return;
    await delay(25);
  }
  throw new Error("free-fall capture did not reach its static state");
}

async function productionFixture(cdp) {
  return evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel;
    let state=P.generate(P.configuredState(5));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,edgeSide:'right',edgeGapPx:10,zeroErrorPx:0});
    state=P.withPlacement(state,place('total',0));
    for(let index=0;index<4;index+=1)state=P.resolveMeasurement(state,M.displacementAt(5,index+1));
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index];state=P.resolveMeasurement(P.withPlacement(state,place(task,M.displacementAt(5,index))),M.intervalDisplacement(5,index+1));}
    state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{status:'answered',values:[1,2,3,4]},totalDisplacementRatio:{status:'answered',values:[1,4,9,16]},intervalTimeRatio:{status:'answered',values:[1,1,1,1]},intervalDistanceRatio:{status:'answered',values:[1,3,5,7]},lawAnswerId:'square',intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);const review=P.makeReview(state),result=S.scoreAttempt(review),snapshot=w.SimScorm.makeSnapshot('${slug}','review',review,result);
    return {review,result,snapshot,pending:{version:1,activity:'${slug}',kind:'pending-final',payload:{reviewJson:JSON.stringify(snapshot),score:result.score,maxScore:100,passed:result.passed}}};
  })()`);
}

async function reloadWithLms(cdp, activityPath, caseId, values) {
  await evaluate(cdp, `(() => {
    const values=${JSON.stringify(values)},f=document.getElementById('activity');
    window.API={LMSInitialize:()=>'true',LMSGetValue:key=>values[key]||'',LMSSetValue:(key,value)=>(values[key]=String(value),'true'),LMSCommit:()=>'true',LMSFinish:()=>'true',LMSGetLastError:()=>'0',LMSGetErrorString:()=>'No error'};
    f.src=${JSON.stringify(activityPath)}+'?lifecycle='+${JSON.stringify(caseId)};
  })()`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, `(() => {const w=document.getElementById('activity')?.contentWindow;return Boolean(w&&new URLSearchParams(w.location.search).get('lifecycle')===${JSON.stringify(caseId)}&&w.__freeFallDebug)})()`)) return;
    await delay(50);
  }
  throw new Error(`lifecycle case did not load: ${caseId}`);
}

async function lockedSnapshot(cdp) {
  return evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document;
    const sections=['setupSection','measurementSection','analysisSection','reviewSection','resultSection','technicalSection'];
    return {
      locked:w.__freeFallDebug.locked(),
      state:JSON.stringify(w.__freeFallDebug.state()),
      animation:JSON.stringify(w.__freeFallDebug.animation()),
      ruler:JSON.stringify(w.__freeFallDebug.ruler()),
      visible:sections.filter(id=>!d.getElementById(id).classList.contains('is-hidden')),
      panelHtml:d.getElementById('controlPanel').innerHTML,
      controls:[...d.querySelectorAll('input,button')].map((control)=>({
        id:control.id,name:control.name,value:control.value,checked:control.checked,
        disabled:control.disabled,hidden:control.classList.contains('is-hidden')
      }))
    };
  })()`);
}

async function realVisibilityCycle(cdp) {
  await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document;
    w.__lockedVisibilityEvents=0;
    d.addEventListener('visibilitychange',()=>{if(d.hidden)w.__lockedVisibilityEvents+=1});
  })()`);
  const currentTarget = await cdp.send("Target.getTargetInfo");
  const backgroundTarget = await cdp.send("Target.createTarget", { url: "about:blank" });
  let immediate;
  try {
    await cdp.send("Target.activateTarget", { targetId: backgroundTarget.targetId });
    await delay(100);
    await cdp.send("Target.activateTarget", { targetId: currentTarget.targetInfo.targetId });
    immediate = {
      events: await evaluate(cdp, "document.getElementById('activity').contentWindow.__lockedVisibilityEvents"),
      snapshot: await lockedSnapshot(cdp)
    };
  } finally {
    await cdp.send("Target.closeTarget", { targetId: backgroundTarget.targetId });
  }
  return immediate;
}

async function attemptLockedEdits(cdp) {
  return evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document;
    let saves=0;
    const original=w.SimScorm.saveDraft.bind(w.SimScorm);
    w.SimScorm.saveDraft=(snapshot)=>{saves+=1;return original(snapshot)};
    d.querySelectorAll('[data-edit]').forEach(button=>button.click());
    d.querySelector('[data-edit-measurement]')?.click();
    ['submitButton','submissionRetry','recordButton','skipButton','parkButton','returnReviewButton',
      'reviewButton','generateButton','replayPreviewButton'].forEach(id=>d.getElementById(id)?.click());
    d.querySelector('[data-frequency]')?.click();
    if(d.getElementById('resultRetry').classList.contains('is-hidden'))d.getElementById('resultRetry').click();
    w.__freeFallDebug.replayPreview();
    w.__freeFallDebug.cancelAnimation();
    return {saves};
  })()`);
}

async function runLifecycleMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`, true);
  const fixture = await productionFixture(cdp);
  const values = (status, snapshot, score = "") => ({
    "cmi.core.lesson_status": status,
    "cmi.core.score.raw": String(score),
    "cmi.suspend_data": snapshot ? JSON.stringify(snapshot) : ""
  });

  await reloadWithLms(cdp, activityPath, `${label}-pending-valid`, values("incomplete", fixture.pending));
  let view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('technicalTitle').textContent,retry:[...d.querySelectorAll('#technicalSection button')].some(b=>/重試同一份/.test(b.textContent)),locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /待確認/); assert.ok(view.retry && view.locked, `${label}: valid frozen startup is locked with same-payload retry`);

  const badNested = { ...fixture.snapshot, answer: { invalid: true } };
  const badPending = { ...fixture.pending, payload: { ...fixture.pending.payload, reviewJson: JSON.stringify(badNested) } };
  await reloadWithLms(cdp, activityPath, `${label}-pending-invalid`, values("incomplete", badPending));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('technicalTitle').textContent,retry:w.SimScorm.retryPending().reason,locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /安全載入/); assert.equal(view.retry, "no-pending"); assert.ok(view.locked, `${label}: invalid frozen payload is quarantined and locked`);

  const badFinished = { version: 1, activity: slug, kind: "review", answer: { invalid: true }, score: 42, passed: false };
  await reloadWithLms(cdp, activityPath, `${label}-finished-invalid`, values("failed", badFinished, 42));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('resultTitle').textContent,score:d.getElementById('scorePanel').textContent,locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /詳細資料不可驗證/); assert.match(view.score, /42/); assert.ok(view.locked, `${label}: invalid finished review uses Moodle fallback`);

  await reloadWithLms(cdp, activityPath, `${label}-unknown-status`, values("completed", fixture.snapshot, fixture.result.score));
  view = await evaluate(cdp, `document.getElementById('activity').contentWindow.document.getElementById('scorePanel').textContent`);
  assert.match(view, /未能安全判斷合格狀態/, `${label}: unknown Moodle pass status remains indeterminate`);

  for (const [name, outcome] of [
    ["retryable", { activityState: "retry", retryable: true }],
    ["nonretryable", { activityState: "retry", retryable: false }],
    ["frozen", { activityState: "frozen", retryable: true }],
    ["success", { activityState: "success" }]
  ]) {
    await reloadWithLms(cdp, activityPath, `${label}-${name}`, values("not attempted", null));
    view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)};w.__freeFallDebug.setReview(fixture.review);w.__freeFallDebug.routeSubmission(${JSON.stringify(outcome)});return {locked:w.__freeFallDebug.locked(),review:!d.getElementById('reviewSection').classList.contains('is-hidden'),technical:!d.getElementById('technicalSection').classList.contains('is-hidden'),result:!d.getElementById('resultSection').classList.contains('is-hidden'),retry:!d.getElementById('submissionRetry').classList.contains('is-hidden')};})()`);
    if (name === "retryable") assert.ok(!view.locked && view.review && view.retry, `${label}: retryable outcome remains editable`);
    if (name === "nonretryable") assert.ok(view.locked && view.technical, `${label}: non-retryable outcome uses technical lock`);
    if (name === "frozen") assert.ok(view.locked && view.technical, `${label}: frozen outcome uses pending lock`);
    if (name === "success") assert.ok(view.locked && view.result, `${label}: success outcome uses locked result`);
  }

  await reloadWithLms(cdp, activityPath, `${label}-committed`, values("not attempted", null));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)};let finishes=0;w.SimScorm.finish=()=>{finishes+=1;return true};w.__freeFallDebug.setReview(fixture.review);w.__freeFallDebug.routeSubmission({activityState:'committed'});const before={locked:w.__freeFallDebug.locked(),retry:!d.getElementById('resultRetry').classList.contains('is-hidden')};d.getElementById('resultRetry').click();return {...before,finishes,title:d.getElementById('resultTitle').textContent,stillLocked:w.__freeFallDebug.locked()};})()`);
  assert.ok(view.locked && view.retry && view.finishes === 1 && view.stillLocked, `${label}: committed recovery calls finish once and remains locked`);
  assert.match(view.title, /完成連線/);

  const lockedCases = [
    {
      name: "success-result", visible: "resultSection", title: /已提交並鎖定/,
      setup: async () => {
        await reloadWithLms(cdp, activityPath, `${label}-locked-success`, values("not attempted", null));
        await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,fixture=${JSON.stringify(fixture)};
          w.__freeFallDebug.setReview(fixture.review);w.__freeFallDebug.routeSubmission({activityState:'success'})})()`);
      }
    },
    {
      name: "committed-result", visible: "resultSection", title: /完成連線仍需重試/,
      setup: async () => {
        await reloadWithLms(cdp, activityPath, `${label}-locked-committed`, values("not attempted", null));
        await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,fixture=${JSON.stringify(fixture)};
          w.__freeFallDebug.setReview(fixture.review);w.__freeFallDebug.routeSubmission({activityState:'committed'})})()`);
      }
    },
    {
      name: "frozen-pending", visible: "technicalSection", title: /提交狀態仍待確認/,
      setup: () => reloadWithLms(cdp, activityPath, `${label}-locked-pending`, values("incomplete", fixture.pending))
    },
    {
      name: "trust-mismatch", visible: "resultSection", title: /不一致/,
      setup: () => reloadWithLms(cdp, activityPath, `${label}-locked-mismatch`,
        values("passed", fixture.snapshot, fixture.result.score - 1))
    },
    {
      name: "safe-technical", visible: "technicalSection", title: /暫時未能安全載入活動/,
      setup: () => reloadWithLms(cdp, activityPath, `${label}-locked-technical`, values("incomplete", badPending))
    }
  ];
  for (const testCase of lockedCases) {
    await testCase.setup();
    const before = await lockedSnapshot(cdp);
    assert.ok(before.locked, `${label}: ${testCase.name} starts locked`);
    assert.deepEqual(before.visible, [testCase.visible], `${label}: ${testCase.name} starts on its exact presentation`);
    assert.match(testCase.visible === "resultSection"
      ? await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('resultTitle').textContent")
      : await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('technicalTitle').textContent"),
    testCase.title, `${label}: ${testCase.name} title`);
    const visibility = await realVisibilityCycle(cdp);
    assert.ok(visibility.events > 0, `${label}: ${testCase.name} receives a real hidden visibilitychange`);
    assert.deepEqual(visibility.snapshot, before,
      `${label}: ${testCase.name} visibility interruption preserves the exact locked presentation`);
    const attempted = await attemptLockedEdits(cdp);
    const after = await lockedSnapshot(cdp);
    assert.equal(attempted.saves, 0, `${label}: ${testCase.name} exposed edit/submit controls cannot checkpoint`);
    assert.deepEqual(after, before,
      `${label}: ${testCase.name} exposed edit/submit and cancellation entry points cannot mutate locked state or presentation`);
  }
}

async function runAnimationMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await navigate(cdp, `${baseUrl}${activityPath}?animation=${encodeURIComponent(label)}`);
  const preview = await evaluate(cdp, `(async()=> {
    const stateBefore=JSON.stringify(__freeFallDebug.state());
    __freeFallDebug.replayPreview();
    const samples=[];
    for(const threshold of [.2,.4,.6]){
      const sample=await new Promise((resolve,reject)=>{
        const started=performance.now(),diagnostics=[];
        const tick=()=>{
          const view=__freeFallDebug.animation(),ball=document.querySelector('[data-live-ball]');
          const renderedY=ball?Number(ball.getAttribute('cy')):null;
          diagnostics.push({elapsedS:view.elapsedS,liveBallM:view.liveBallM,renderedY,mode:view.mode});
          if(diagnostics.length>8)diagnostics.shift();
          if(view.mode==='preview'&&view.elapsedS>=threshold&&Number.isFinite(renderedY))
            return resolve({...view,renderedY,threshold});
          if(performance.now()-started>1500)
            return reject(new Error('preview threshold '+threshold+' timeout: '+JSON.stringify(diagnostics)));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      samples.push(sample);
    }
    const stateAfter=JSON.stringify(__freeFallDebug.state()),d=document;
    const beforeReplay=__freeFallDebug.animation();
    d.getElementById('replayPreviewButton').click();
    const replay=__freeFallDebug.animation();
    return {samples,stateBefore,stateAfter,beforeReplay,replay,stamps:d.querySelectorAll('[data-stamp]').length,
      balls:d.querySelectorAll('[data-live-ball]').length,rulerHidden:d.getElementById('rulerHandle').classList.contains('is-hidden'),
      pointerEvents:getComputedStyle(d.getElementById('trajectoryGroup')).pointerEvents};
  })()`);
  assert.equal(preview.stateAfter, preview.stateBefore, `${label}: preview/replay do not change authoritative state`);
  assert.equal(preview.stamps, 0); assert.equal(preview.balls, 1); assert.ok(preview.rulerHidden);
  assert.equal(preview.pointerEvents, "none", `${label}: preview ball never owns gestures`);
  const previewDistances = preview.samples.map((sample) => sample.liveBallM);
  const previewRenderedY = preview.samples.map((sample) => sample.renderedY);
  assert.ok(previewDistances[0] < previewDistances[1] && previewDistances[1] < previewDistances[2],
    `${label}: preview ball moves continuously downward ${JSON.stringify(preview.samples)}`);
  assert.ok(previewDistances[1] - previewDistances[0] < previewDistances[2] - previewDistances[1],
    `${label}: equal-time preview displacement increments increase ${JSON.stringify(preview.samples)}`);
  assert.ok(previewRenderedY[0] < previewRenderedY[1] && previewRenderedY[1] < previewRenderedY[2] &&
    previewRenderedY[1] - previewRenderedY[0] < previewRenderedY[2] - previewRenderedY[1],
  `${label}: rendered preview position accelerates at equal elapsed thresholds ${JSON.stringify(preview.samples)}`);
  assert.equal(preview.replay.liveBallM, 0, `${label}: explicit replay returns the ball to release`);

  for (const frequency of [4, 5, 6]) {
    await navigate(cdp, `${baseUrl}${activityPath}?capture=${frequency}-${encodeURIComponent(label)}`);
    const capture = await evaluate(cdp, `(async()=> {
      const d=document,w=window,frequency=${frequency};let saves=0;
      const original=w.SimScorm.saveDraft.bind(w.SimScorm);
      w.SimScorm.saveDraft=(snapshot)=>{saves+=1;return original(snapshot)};
      d.querySelector('[data-frequency="'+frequency+'"]').click();
      const beforeGenerateSaves=saves,start=performance.now(),observed=[];
      const button=d.getElementById('generateButton');button.click();button.click();
      let prior=-1;
      await new Promise((resolve,reject)=>{const tick=()=>{const view=w.__freeFallDebug.animation();
        if(view.stamps.length!==prior){prior=view.stamps.length;observed.push({count:prior,ms:performance.now()-start,stamps:view.stamps})}
        if(view.mode==='static')return resolve();if(performance.now()-start>1800)return reject(new Error('capture timeout'));requestAnimationFrame(tick)};tick()});
      const view=w.__freeFallDebug.animation(),state=w.__freeFallDebug.state();
      return {observed,view,state,saveDelta:saves-beforeGenerateSaves,
        domStamps:d.querySelectorAll('[data-stamp]').length,live:d.querySelectorAll('[data-live-ball]').length,
        rulerHidden:d.getElementById('rulerHandle').classList.contains('is-hidden'),
        measurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden'),
        status:d.getElementById('animationStatus').textContent};
    })()`);
    assert.equal(capture.saveDelta, 1, `${label} ${frequency} Hz: double activation checkpoints generated state once`);
    assert.equal(capture.view.stamps.length, 5); assert.equal(capture.domStamps, 5); assert.equal(capture.live, 0);
    assert.ok(!capture.rulerHidden && !capture.measurementHidden, `${label} ${frequency} Hz: ruler appears only after P4`);
    assert.equal(capture.state.phase, "measure-total");
    assert.match(capture.status, /五個球影來自同一個球/);
    const stampEvents = capture.observed.filter((item) => item.count > 0);
    assert.deepEqual(stampEvents.map((item) => item.count), [1, 2, 3, 4, 5], `${label} ${frequency} Hz: stamps appear uniquely in order`);
    for (let index = 0; index < 5; index += 1) {
      const stamp = capture.view.stamps[index];
      assert.equal(stamp.index, index);
      assert.ok(Math.abs(stamp.timeS - index / frequency) < 1e-12);
      assert.ok(Math.abs(stamp.displacementM - 5 * (index / frequency) ** 2) < 1e-12);
      assert.ok(Math.abs(stampEvents[index].ms - index * 1000 / frequency) <= 90,
        `${label} ${frequency} Hz P${index}: browser reveal is within 90ms scheduler tolerance ${JSON.stringify(stampEvents)}`);
    }
  }

  await navigate(cdp, `${baseUrl}${activityPath}?cancel-debug=${encodeURIComponent(label)}`);
  const cancelled = await evaluate(cdp, `(async()=> {
    const d=document,w=window,S=w.FreeFallScoring;let saves=0;
    const original=w.SimScorm.saveDraft.bind(w.SimScorm);
    w.SimScorm.saveDraft=(snapshot)=>{saves+=1;return original(snapshot)};
    d.querySelector('[data-frequency="4"]').click();d.getElementById('generateButton').click();
    await new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{
      const view=w.__freeFallDebug.animation();
      if(view.mode==='capture'&&view.elapsedS>=.2)return resolve();
      if(performance.now()-started>1000)return reject(new Error('debug cancellation did not reach active capture'));
      requestAnimationFrame(tick)};tick()});
    const beforeState=JSON.stringify(w.__freeFallDebug.state()),beforeScore=JSON.stringify(S.scoreAttempt(w.__freeFallDebug.state()));
    const beforeEvidence=JSON.stringify(w.__freeFallDebug.state().evidence),beforeSaves=saves;
    w.__freeFallDebug.cancelAnimation();
    const immediate={animation:w.__freeFallDebug.animation(),state:w.__freeFallDebug.state(),
      setupHidden:d.getElementById('setupSection').classList.contains('is-hidden'),
      measurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden'),
      rulerHidden:d.getElementById('rulerHandle').classList.contains('is-hidden'),
      generateDisabled:d.getElementById('generateButton').disabled,replayDisabled:d.getElementById('replayPreviewButton').disabled,
      recordDisabled:d.getElementById('recordButton').disabled,skipDisabled:d.getElementById('skipButton').disabled,
      parkDisabled:d.getElementById('parkButton').disabled,stamps:d.querySelectorAll('[data-stamp]').length,
      live:d.querySelectorAll('[data-live-ball]').length};
    const waitStarted=performance.now();
    await new Promise(resolve=>{const tick=()=>performance.now()-waitStarted>=1100?resolve():requestAnimationFrame(tick);tick()});
    return {beforeState,beforeScore,beforeEvidence,beforeSaves,immediate,
      afterState:JSON.stringify(w.__freeFallDebug.state()),afterScore:JSON.stringify(S.scoreAttempt(w.__freeFallDebug.state())),
      afterEvidence:JSON.stringify(w.__freeFallDebug.state().evidence),afterSaves:saves,
      afterAnimation:w.__freeFallDebug.animation(),afterStamps:d.querySelectorAll('[data-stamp]').length,
      afterLive:d.querySelectorAll('[data-live-ball]').length,
      afterSetupHidden:d.getElementById('setupSection').classList.contains('is-hidden'),
      afterMeasurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden')};
  })()`);
  assertCancellationResult(cancelled, `${label}: direct debug cancellation`);

  await navigate(cdp, `${baseUrl}${activityPath}?cancel-visibility=${encodeURIComponent(label)}`);
  await evaluate(cdp, `(async() => {
    const d=document,w=window,S=w.FreeFallScoring;let saves=0;
    const original=w.SimScorm.saveDraft.bind(w.SimScorm);
    w.SimScorm.saveDraft=(snapshot)=>{saves+=1;return original(snapshot)};
    w.__visibilityProbe={hiddenEvents:0,hiddenAtElapsedMs:null,getSaves:()=>saves};
    d.addEventListener('visibilitychange',()=>{if(d.hidden){
      w.__visibilityProbe.hiddenEvents+=1;
      w.__visibilityProbe.hiddenAtElapsedMs=performance.now()-w.__visibilityProbe.captureStartedAt;
    }});
    d.querySelector('[data-frequency="4"]').click();d.getElementById('generateButton').click();
    w.__visibilityProbe.captureStartedAt=performance.now();
    await new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{
      const view=w.__freeFallDebug.animation();
      if(view.mode==='capture'&&view.elapsedS>=.15)return resolve();
      if(performance.now()-started>700)return reject(new Error('visibility cancellation did not reach active capture'));
      requestAnimationFrame(tick)};tick()});
    w.__visibilityProbe.beforeState=JSON.stringify(w.__freeFallDebug.state());
    w.__visibilityProbe.beforeScore=JSON.stringify(S.scoreAttempt(w.__freeFallDebug.state()));
    w.__visibilityProbe.beforeEvidence=JSON.stringify(w.__freeFallDebug.state().evidence);
    w.__visibilityProbe.beforeSaves=saves;
    w.__visibilityProbe.beforeAnimation=w.__freeFallDebug.animation();
  })()`);
  const currentTarget = await cdp.send("Target.getTargetInfo");
  const backgroundTarget = await cdp.send("Target.createTarget", { url: "about:blank" });
  let visibilityImmediate;
  try {
    await cdp.send("Target.activateTarget", { targetId: backgroundTarget.targetId });
    await delay(150);
    await cdp.send("Target.activateTarget", { targetId: currentTarget.targetInfo.targetId });
    visibilityImmediate = await evaluate(cdp, `(() => {
      const d=document,w=window,probe=w.__visibilityProbe;
      return {animation:w.__freeFallDebug.animation(),state:w.__freeFallDebug.state(),
        foregroundElapsedMs:performance.now()-probe.captureStartedAt,
        setupHidden:d.getElementById('setupSection').classList.contains('is-hidden'),
        measurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden'),
        rulerHidden:d.getElementById('rulerHandle').classList.contains('is-hidden'),
        generateDisabled:d.getElementById('generateButton').disabled,replayDisabled:d.getElementById('replayPreviewButton').disabled,
        recordDisabled:d.getElementById('recordButton').disabled,skipDisabled:d.getElementById('skipButton').disabled,
        parkDisabled:d.getElementById('parkButton').disabled,stamps:d.querySelectorAll('[data-stamp]').length,
        live:d.querySelectorAll('[data-live-ball]').length};
    })()`);
  } finally {
    await cdp.send("Target.closeTarget", { targetId: backgroundTarget.targetId });
  }
  const visibilityCancelled = await evaluate(cdp, `(async()=> {
    const d=document,w=window,S=w.FreeFallScoring,probe=w.__visibilityProbe,waitStarted=performance.now();
    await new Promise(resolve=>{const tick=()=>performance.now()-waitStarted>=1100?resolve():requestAnimationFrame(tick);tick()});
    return {beforeState:probe.beforeState,beforeScore:probe.beforeScore,beforeEvidence:probe.beforeEvidence,
      beforeSaves:probe.beforeSaves,beforeAnimation:probe.beforeAnimation,hiddenEvents:probe.hiddenEvents,
      hiddenAtElapsedMs:probe.hiddenAtElapsedMs,immediate:${JSON.stringify(null)},
      afterState:JSON.stringify(w.__freeFallDebug.state()),afterScore:JSON.stringify(S.scoreAttempt(w.__freeFallDebug.state())),
      afterEvidence:JSON.stringify(w.__freeFallDebug.state().evidence),afterSaves:probe.getSaves(),
      afterAnimation:w.__freeFallDebug.animation(),afterStamps:d.querySelectorAll('[data-stamp]').length,
      afterLive:d.querySelectorAll('[data-live-ball]').length,
      afterSetupHidden:d.getElementById('setupSection').classList.contains('is-hidden'),
      afterMeasurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden')};
  })()`);
  visibilityCancelled.immediate = visibilityImmediate;
  assert.ok(visibilityCancelled.hiddenEvents > 0, `${label}: real tab visibility interruption delivered hidden visibilitychange`);
  assert.equal(visibilityCancelled.beforeAnimation.mode, "capture", `${label}: visibility interruption starts during active capture`);
  assert.ok(visibilityCancelled.hiddenAtElapsedMs < 1000 && visibilityCancelled.immediate.foregroundElapsedMs < 1000,
    `${label}: visibility cancellation is observed before natural 4 Hz completion ${JSON.stringify({
      hiddenAtElapsedMs: visibilityCancelled.hiddenAtElapsedMs,
      foregroundElapsedMs: visibilityCancelled.immediate.foregroundElapsedMs
    })}`);
  assertCancellationResult(visibilityCancelled, `${label}: visibility interruption`);

  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await navigate(cdp, `${baseUrl}${activityPath}?reduced=${encodeURIComponent(label)}`);
  const reduced = await evaluate(cdp, `(() => {
    const d=document,before=__freeFallDebug.animation();d.querySelector('[data-frequency="6"]').click();d.getElementById('generateButton').click();
    return {before,after:__freeFallDebug.animation(),state:__freeFallDebug.state(),
      stamps:d.querySelectorAll('[data-stamp]').length,live:d.querySelectorAll('[data-live-ball]').length,
      measurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden'),
      hint:d.getElementById('stageHint').textContent};
  })()`);
  assert.equal(reduced.before.mode, "preview-reduced");
  assert.equal(reduced.after.mode, "static"); assert.equal(reduced.after.stamps.length, 5);
  assert.equal(reduced.stamps, 5); assert.equal(reduced.live, 0); assert.ok(!reduced.measurementHidden);
  assert.equal(reduced.state.phase, "measure-total");
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

  await navigate(cdp, `${baseUrl}${activityPath}?restore=${encodeURIComponent(label)}`);
  const restored = await evaluate(cdp, `(() => {
    const P=FreeFallPersistence,d=document,state=P.generate(P.configuredState(5));
    __freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:P.encode(state)}});
    return {animation:__freeFallDebug.animation(),state:__freeFallDebug.state(),
      stamps:d.querySelectorAll('[data-stamp]').length,live:d.querySelectorAll('[data-live-ball]').length};
  })()`);
  assert.equal(restored.state.phase, "measure-total");
  assert.equal(restored.animation.mode, "static"); assert.equal(restored.stamps, 5); assert.equal(restored.live, 0);
}

async function runUnitNotationMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}${activityPath}?units=${encodeURIComponent(label)}`);
  const value = await evaluate(cdp, `(() => {
    const w=window,d=document,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel;
    let state=P.generate(P.configuredState(5));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,edgeSide:'right',edgeGapPx:10,zeroErrorPx:0});
    state=P.withPlacement(state,place('total',0));
    for(let index=0;index<4;index+=1)state=P.resolveMeasurement(state,M.displacementAt(5,index+1));
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index];state=P.resolveMeasurement(P.withPlacement(state,place(task,M.displacementAt(5,index))),M.intervalDisplacement(5,index+1));}
    state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{status:'answered',values:[1,2,3,4]},totalDisplacementRatio:{status:'answered',values:[1,4,9,16]},intervalTimeRatio:{status:'answered',values:[1,1,1,1]},intervalDistanceRatio:{status:'answered',values:[1,3,5,7]},lawAnswerId:'square',intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);const review=P.makeReview(state),score=S.scoreAttempt(review);
    w.__freeFallDebug.setReview(review);
    const canonicalBefore=JSON.stringify(P.makeReview(w.__freeFallDebug.state())),scoreBefore=JSON.stringify(S.scoreAttempt(review));
    const reviewHtml=d.getElementById('reviewContent').innerHTML,reviewText=d.getElementById('reviewContent').textContent;
    d.querySelector('[data-edit-measurement="total1"]').click();
    const editValue=d.getElementById('readingInput').value,editUnit=d.querySelector('#measurementSection .reading-row .unit').textContent;
    w.__freeFallDebug.setReview(review);
    const sup=d.querySelector('#reviewContent sup'),base=sup.previousElementSibling;
    const supRect={top:sup.getBoundingClientRect().top,bottom:sup.getBoundingClientRect().bottom};
    const supBaseRect={top:base.getBoundingClientRect().top,bottom:base.getBoundingClientRect().bottom};
    const supAlign=getComputedStyle(sup).verticalAlign;
    w.__freeFallDebug.routeSubmission({activityState:'success'});
    const canonicalAfter=JSON.stringify(P.makeReview(w.__freeFallDebug.state()));
    const scoreAfter=JSON.stringify(S.scoreAttempt(P.makeReview(w.__freeFallDebug.state())));
    const resultHtml=d.getElementById('resultFeedback').innerHTML,resultText=d.getElementById('resultFeedback').textContent;
    const sub=d.querySelector('.freefall-header sub'),subBase=d.querySelector('.freefall-header var');
    return {canonicalBefore,canonicalAfter,scoreBefore,scoreAfter,reviewHtml,reviewText,editValue,editUnit,resultHtml,resultText,
      notation:{vars:d.querySelectorAll('var').length,subs:d.querySelectorAll('sub').length,sups:d.querySelectorAll('sup').length,
        supAlign,subAlign:getComputedStyle(sub).verticalAlign,supRect,supBaseRect,
        subRect:{top:sub.getBoundingClientRect().top,bottom:sub.getBoundingClientRect().bottom},
        subBaseRect:{top:subBase.getBoundingClientRect().top,bottom:subBase.getBoundingClientRect().bottom},
        supAbove:(supRect.top+supRect.bottom)/2<(supBaseRect.top+supBaseRect.bottom)/2,
        subBelow:(sub.getBoundingClientRect().top+sub.getBoundingClientRect().bottom)/2>
          (subBase.getBoundingClientRect().top+subBase.getBoundingClientRect().bottom)/2}};
  })()`);
  assert.equal(value.editValue, "20", `${label}: restored 0.2 m reading edits as 20 cm`);
  assert.equal(value.editUnit, "cm");
  assert.match(value.reviewText, /20 cm/); assert.match(value.reviewText, /80 cm/);
  assert.doesNotMatch(value.reviewText, /\d(?:\.\d+)? m(?:\s|$)/, `${label}: review distances do not leak meter units`);
  assert.match(value.resultText, /cm/); assert.match(value.resultText, /±/);
  assert.match(value.reviewHtml, /<var>/); assert.match(value.resultHtml, /<sub>/);
  assert.deepEqual(value.canonicalAfter, value.canonicalBefore, `${label}: display/restore/result conversion does not change canonical JSON`);
  assert.deepEqual(value.scoreAfter, value.scoreBefore, `${label}: display/restore/result conversion does not change score`);
  assert.ok(value.notation.vars > 5 && value.notation.subs > 5 && value.notation.sups >= 2,
    `${label}: semantic math markup is present ${JSON.stringify(value.notation)}`);
  assert.ok(value.notation.supAbove && value.notation.subBelow &&
    value.notation.supAlign === "super" && value.notation.subAlign === "sub",
  `${label}: semantic sub/sup has computed geometry ${JSON.stringify(value.notation)}`);
}

async function directClick(cdp, selector) {
  const target = await evaluate(cdp, `(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed", x: target.x, y: target.y, button: "left", buttons: 1, clickCount: 1
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: target.x, y: target.y, button: "left", buttons: 0, clickCount: 1
  });
  await delay(50);
}

async function directFill(cdp, selector, value) {
  await directClick(cdp, selector);
  await evaluate(cdp, `(() => {const input=document.querySelector(${JSON.stringify(selector)});input.focus();input.select()})()`);
  await cdp.send("Input.insertText", { text: value });
}

async function runRealInputPath(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}${activityPath}?real-input=${encodeURIComponent(label)}`);
  await prepare(cdp);
  const drag = await evaluate(cdp, `(() => {
    const d=document,h=d.getElementById('rulerHandle'),s=d.getElementById('stage'),hr=h.getBoundingClientRect(),
      sr=s.getBoundingClientRect(),current=__freeFallDebug.ruler();
    return {start:{x:hr.left+hr.width/2,y:hr.top+hr.height/2},
      end:{x:hr.left+hr.width/2+(90-current.x)*sr.width/360,
        y:hr.top+hr.height/2+(30-current.y)*sr.height/440}};
  })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: drag.start.x, y: drag.start.y });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed", x: drag.start.x, y: drag.start.y, button: "left", buttons: 1, clickCount: 1
  });
  for (let step = 1; step <= 5; step += 1) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved", x: drag.start.x + (drag.end.x - drag.start.x) * step / 5,
      y: drag.start.y + (drag.end.y - drag.start.y) * step / 5, button: "left", buttons: 1
    });
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: drag.end.x, y: drag.end.y, button: "left", buttons: 0, clickCount: 1
  });
  await directFill(cdp, "#readingInput", "20");
  await directClick(cdp, "#recordButton");
  await directFill(cdp, "#readingInput", "31.25");
  await directClick(cdp, "#recordButton");

  const result = await evaluate(cdp, `(() => {
    const w=window,d=document,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel;
    const partial=w.__freeFallDebug.state(),encoded=P.encode(partial),decoded=P.decode(encoded);
    let state=decoded;
    state=P.resolveMeasurement(state,M.displacementAt(5,3));
    state=P.resolveMeasurement(state,M.displacementAt(5,4));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,edgeSide:'right',edgeGapPx:10,zeroErrorPx:0});
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index];
      state=P.resolveMeasurement(P.withPlacement(state,place(task,M.displacementAt(5,index))),M.intervalDisplacement(5,index+1));}
    state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{status:'answered',values:[1,2,3,4]},
      totalDisplacementRatio:{status:'answered',values:[1,4,9,16]},intervalTimeRatio:{status:'answered',values:[1,1,1,1]},
      intervalDistanceRatio:{status:'answered',values:[1,3,5,7]},lawAnswerId:'square',
      intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);
    const review=P.makeReview(state),decodedReview=P.decodeReview(review),score=S.scoreAttempt(review);
    w.__freeFallDebug.setReview(review);
    const reviewText=d.getElementById('reviewContent').textContent;
    const canonicalBefore=JSON.stringify(P.makeReview(w.__freeFallDebug.state()));
    const evidenceBefore=JSON.stringify(review.evidence);
    d.querySelector('[data-edit-measurement="total2"]').click();
    const editValue=d.getElementById('readingInput').value;
    w.__freeFallDebug.setReview(review);
    w.__freeFallDebug.routeSubmission({activityState:'success'});
    const canonicalAfter=JSON.stringify(P.makeReview(w.__freeFallDebug.state()));
    const scoreAfter=S.scoreAttempt(P.makeReview(w.__freeFallDebug.state()));
    const resultText=d.getElementById('resultFeedback').textContent;
    const aria=d.getElementById('rulerHandle').getAttribute('aria-label');
    return {
      readings:[partial.measurements.total1.readingM,partial.measurements.total2.readingM],
      used:[partial.measurements.total1.usedTotalPlacement,partial.measurements.total2.usedTotalPlacement],
      partialEvidence:partial.evidence.totalPlacement,
      partialRoundTrip:JSON.stringify(decoded)===JSON.stringify(encoded),
      reviewRoundTrip:JSON.stringify(decodedReview)===JSON.stringify(review),
      evidenceRoundTrip:JSON.stringify(decodedReview.evidence)===evidenceBefore,
      canonicalBefore,canonicalAfter,score,scoreAfter,editValue,reviewText,resultText,aria
    };
  })()`);
  assert.deepEqual(result.readings, [.2, .3125], `${label}: production input converts centimeters to canonical meters exactly once`);
  assert.deepEqual(result.used, [true, true], `${label}: both production Record actions retain the valid total placement`);
  assert.ok(result.partialEvidence && result.partialEvidence.mode === "pointer",
    `${label}: production mouse placement creates pointer evidence`);
  assert.ok(result.partialRoundTrip && result.reviewRoundTrip && result.evidenceRoundTrip,
    `${label}: draft/review encode-decode preserves readings and evidence`);
  assert.equal(result.editValue, "31.25", `${label}: restored edit field preserves 31.25 cm without pre-score rounding`);
  assert.equal(result.canonicalAfter, result.canonicalBefore, `${label}: review/result rendering preserves canonical review JSON`);
  assert.deepEqual(result.scoreAfter, result.score, `${label}: review/result rendering preserves score`);
  assert.match(result.reviewText, /20 cm/); assert.match(result.reviewText, /31\.25 cm/); assert.match(result.reviewText, /180 cm/);
  assert.match(result.resultText, /60/); assert.match(result.resultText, /140/); assert.match(result.resultText, /10\.8/);
  for (const text of [result.reviewText, result.resultText, result.aria]) {
    assert.doesNotMatch(text, /(?:0{8,}|9{8,})\d/, `${label}: normalized learner copy has no IEEE-754 tail`);
  }
}

async function runRulerGeometryMatrix(cdp, baseUrl, activityPath, label) {
  for (const [width, height, pageScale] of REQUIRED_VIEWPORTS) {
    await setViewport(cdp, width, height, pageScale);
    await navigate(cdp, `${baseUrl}${activityPath}?ruler-geometry=${width}-${height}-${pageScale}-${encodeURIComponent(label)}`);
    const setupNotation = await evaluate(cdp, `(() => {
      const d=document,sup=d.querySelector('.camera-note sup'),supBase=sup.parentElement,
        supBlock=sup.closest('p'),unit=sup.closest('.unit'),panel=d.getElementById('controlPanel');
      sup.scrollIntoView({block:'center'});
      const rect=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {sup:rect(sup),supBase:rect(supBase),supBlock:rect(supBlock),
        panel:rect(panel),supAlign:getComputedStyle(sup).verticalAlign,blockOverflow:getComputedStyle(supBlock).overflow,
        unitStyle:getComputedStyle(unit).fontStyle};
    })()`);
    assert.ok(setupNotation.sup.width > 0 && setupNotation.sup.height > 0 &&
      setupNotation.supAlign === "super" &&
      (setupNotation.sup.top + setupNotation.sup.bottom) / 2 <
        (setupNotation.supBase.top + setupNotation.supBase.bottom) / 2,
    `${label} ${width}x${height}@${pageScale}: semantic superscript is visible and raised ${JSON.stringify(setupNotation)}`);
    assert.ok(setupNotation.blockOverflow === "visible" &&
      setupNotation.sup.top >= setupNotation.panel.top - 1 && setupNotation.sup.bottom <= setupNotation.panel.bottom + 1,
    `${label} ${width}x${height}@${pageScale}: superscript is not clipped by learner copy ${JSON.stringify(setupNotation)}`);
    assert.equal(setupNotation.unitStyle, "normal", `${label} ${width}x${height}@${pageScale}: physical unit remains upright`);
    await prepare(cdp);
    const measurementNotation = await evaluate(cdp, `(() => {
      const panel=document.getElementById('controlPanel');panel.scrollTop=0;
      const sub=document.querySelector('#measurementPrompt sub'),base=sub.previousElementSibling,block=sub.closest('p');
      const rect=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {sub:rect(sub),base:rect(base),block:rect(block),panel:rect(panel),
        align:getComputedStyle(sub).verticalAlign,blockOverflow:getComputedStyle(block).overflow};
    })()`);
    assert.ok(measurementNotation.sub.width > 0 && measurementNotation.sub.height > 0 &&
      measurementNotation.align === "sub" &&
      (measurementNotation.sub.top + measurementNotation.sub.bottom) / 2 >
        (measurementNotation.base.top + measurementNotation.base.bottom) / 2,
    `${label} ${width}x${height}@${pageScale}: semantic subscript is visible and lowered ${JSON.stringify(measurementNotation)}`);
    assert.ok(measurementNotation.blockOverflow === "visible" &&
      measurementNotation.sub.top >= measurementNotation.panel.top - 1 &&
      measurementNotation.sub.bottom <= measurementNotation.panel.bottom + 1,
    `${label} ${width}x${height}@${pageScale}: subscript is not clipped by learner copy ${JSON.stringify(measurementNotation)}`);
    await evaluate(cdp, "document.activeElement.blur()");
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    let focus = await evaluate(cdp, `(() => {const h=document.getElementById('rulerHandle'),s=getComputedStyle(h);
      return {active:document.activeElement.id,outline:s.outlineStyle,width:s.outlineWidth}})()`);
    if (focus.active !== "rulerHandle") {
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown", key: "Tab", code: "Tab", modifiers: 8, windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9
      });
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyUp", key: "Tab", code: "Tab", modifiers: 8, windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9
      });
      focus = await evaluate(cdp, `(() => {const h=document.getElementById('rulerHandle'),s=getComputedStyle(h);
        return {active:document.activeElement.id,outline:s.outlineStyle,width:s.outlineWidth}})()`);
    }
    assert.equal(focus.active, "rulerHandle", `${label} ${width}x${height}@${pageScale}: keyboard Tab focuses the direct ruler`);
    assert.ok(focus.outline !== "none" && parseFloat(focus.width) > 0,
      `${label} ${width}x${height}@${pageScale}: keyboard focus-visible outline follows the ruler ${JSON.stringify(focus)}`);
    for (const pointIndex of [0, 1, 2, 3]) {
      const geometry = await evaluate(cdp, `(() => {
        const w=window,d=document,M=w.FreeFallModel;
        const targetY=M.geometry(5,440,30,25).metersToY(M.displacementAt(5,${pointIndex}));
        w.__freeFallDebug.setRuler({x:90,y:targetY});
        const body=d.querySelector('[data-ruler-body]'),visible=d.querySelector('[data-ruler-visible-body]'),
          handle=d.getElementById('rulerHandle'),stage=d.getElementById('stage'),layout=w.__freeFallDebug.rulerLayout();
        const br=body.getBoundingClientRect(),vr=visible.getBoundingClientRect(),hr=handle.getBoundingClientRect(),sr=stage.getBoundingClientRect();
        const samples=[[hr.left+2,hr.top+2],[hr.left+hr.width/2,hr.top+2],[hr.right-2,hr.top+hr.height/2],
          [hr.left+2,hr.bottom-2],[hr.left+hr.width/2,hr.bottom-2]];
        return {targetY,layout,body:{left:br.left,top:br.top,right:br.right,bottom:br.bottom},
          visible:{left:vr.left,top:vr.top,right:vr.right,bottom:vr.bottom,width:vr.width,height:vr.height},
          handle:{left:hr.left,top:hr.top,right:hr.right,bottom:hr.bottom,width:hr.width,height:hr.height},
          stage:{top:sr.top,bottom:sr.bottom},owners:samples.map(([x,y])=>d.elementFromPoint(x,y)?.id),
          units:[...d.querySelectorAll('[data-ruler-unit]')].map(node=>node.textContent),
          tickKinds:[...d.querySelectorAll('[data-ruler-tick]')].map(node=>[Number(node.dataset.tickCm),node.dataset.tickKind]),
          labels:[...d.querySelectorAll('[data-ruler-label-cm]')].map(node=>Number(node.dataset.rulerLabelCm)),
          preserveNone:d.getElementById('scene').getAttribute('preserveAspectRatio')==='none',
          magnifiers:d.querySelectorAll('[id*="magnifier"],.magnifier').length};
      })()`);
      const delta = (a, b) => Math.abs(a - b);
      assert.ok(geometry.preserveNone, `${label} ${width}x${height}@${pageScale}: SVG uses explicit nonuniform CTM`);
      assert.ok(delta(geometry.visible.left, geometry.handle.left) <= 1 && delta(geometry.visible.top, geometry.handle.top) <= 1 &&
        delta(geometry.visible.right, geometry.handle.right) <= 1 && delta(geometry.visible.bottom, geometry.handle.bottom) <= 1,
      `${label} ${width}x${height}@${pageScale} P${pointIndex}: overlay matches visible ruler body ${JSON.stringify(geometry)}`);
      assert.ok(geometry.handle.width >= 43.99, `${label} ${width}x${height}@${pageScale} P${pointIndex}: visible drag width is at least 44 CSS px`);
      assert.ok(geometry.owners.every((owner) => owner === "rulerHandle"),
        `${label} ${width}x${height}@${pageScale} P${pointIndex}: visible ruler has no dead drag zone ${JSON.stringify(geometry.owners)}`);
      assert.deepEqual(geometry.units, ["cm"], `${label}: ruler shows one upright centimeter unit`);
      assert.equal(geometry.magnifiers, 0, `${label}: ruler magnifier is absent`);
      assert.ok(Math.abs(geometry.layout.zeroY - geometry.targetY) < 1e-9,
        `${label} P${pointIndex}: zero tick remains aligned to the requested point`);
      assert.equal(geometry.layout.zeroY - geometry.layout.fullTop, 12);
      assert.equal(geometry.layout.fullBottom - (geometry.layout.zeroY + geometry.layout.tickSpan), 12);
      if (pointIndex > 0) assert.ok(geometry.body.bottom > geometry.stage.bottom,
        `${label} P${pointIndex}: full ruler body may clip below the stage`);
      const tickMap = new Map(geometry.tickKinds);
      assert.equal(tickMap.get(5), "fine"); assert.equal(tickMap.get(10), "medium"); assert.equal(tickMap.get(50), "major");
      assert.ok(geometry.labels.every((cm) => cm % 50 === 0), `${label}: only 50 cm ticks are numbered`);
    }
  }
}

function assertCancellationResult(value, label) {
  assert.equal(value.immediate.animation.mode, "static", `${label}: animation becomes static`);
  assert.equal(value.immediate.state.phase, "measure-total", `${label}: authoritative phase stays measure-total`);
  assert.ok(value.immediate.setupHidden && !value.immediate.measurementHidden && !value.immediate.rulerHidden,
    `${label}: static measurement UI is usable ${JSON.stringify(value.immediate)}`);
  assert.ok(value.immediate.generateDisabled && !value.immediate.replayDisabled &&
    !value.immediate.recordDisabled && !value.immediate.skipDisabled && !value.immediate.parkDisabled,
  `${label}: setup and measurement controls are consistent ${JSON.stringify(value.immediate)}`);
  assert.equal(value.immediate.stamps, 5); assert.equal(value.immediate.live, 0);
  assert.equal(value.afterState, value.beforeState, `${label}: learner state is unchanged`);
  assert.equal(value.afterScore, value.beforeScore, `${label}: score is unchanged`);
  assert.equal(value.afterEvidence, value.beforeEvidence, `${label}: evidence is unchanged`);
  assert.equal(value.afterSaves, value.beforeSaves, `${label}: cancellation and stale callbacks do not checkpoint`);
  assert.equal(value.afterAnimation.mode, "static", `${label}: stale callbacks cannot restart capture`);
  assert.equal(value.afterStamps, 5); assert.equal(value.afterLive, 0);
  assert.ok(value.afterSetupHidden && !value.afterMeasurementHidden, `${label}: stale callbacks cannot revert the panel UI`);
}

async function layoutMatrix(cdp, baseUrl, activityPath, label) {
  for (const [width, height, pageScale] of REQUIRED_VIEWPORTS) {
    await setViewport(cdp, width, height, pageScale);
    await navigate(cdp, `${baseUrl}${activityPath}`);
    const radioLabels = await evaluate(cdp, `(() => [...document.querySelectorAll('fieldset label')]
      .filter(label=>label.getClientRects().length>0)
      .map(label=>{const r=label.getBoundingClientRect();return {w:r.width,h:r.height,display:getComputedStyle(label).display}}))()`);
    await prepare(cdp);
    const snapshot = await evaluate(cdp, `(() => {
      const d=document.documentElement,b=document.body,a=document.querySelector('.freefall-app'),p=document.getElementById('controlPanel');
      p.scrollTop=p.scrollHeight;a.scrollTop=100;
      const last=p.querySelector('[data-reset-frequency]').getBoundingClientRect(),pr=p.getBoundingClientRect();
      return {docRange:d.scrollHeight-d.clientHeight,bodyRange:b.scrollHeight-b.clientHeight,
        appRange:a.scrollHeight-a.clientHeight,appScroll:a.scrollTop,horizontal:Math.max(d.scrollWidth-d.clientWidth,b.scrollWidth-b.clientWidth),
        panelRange:p.scrollHeight-p.clientHeight,panelBottom:p.scrollTop,buttonReachable:last.bottom<=pr.bottom+1,
        visual:visualViewport?{scale:visualViewport.scale,width:visualViewport.width,height:visualViewport.height}:null};
    })()`);
    assert.ok(snapshot.docRange <= 1 && snapshot.bodyRange <= 1 && snapshot.appScroll === 0,
      `${label} ${width}x${height}: activity document is not a third vertical owner ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.horizontal <= 1, `${label} ${width}x${height}: no horizontal overflow`);
    assert.ok(snapshot.panelRange > 0 && snapshot.panelBottom >= snapshot.panelRange - 1 && snapshot.buttonReachable,
      `${label} ${width}x${height}: independently scrolling panel reaches its true bottom`);
    assert.ok(radioLabels.length >= 2 && radioLabels.every((item) => item.h >= 44 && item.w > 0 && ["flex", "inline-flex", "block", "grid"].includes(item.display)),
      `${label} ${width}x${height}: radio labels are real >=44px layout boxes ${JSON.stringify(radioLabels)}`);
  }
}

async function touch(cdp, type, x, y) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" || type === "touchCancel" ? [] :
      [{ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 }]
  });
  await delay(45);
}

async function swipe(cdp, start, end) {
  await touch(cdp, "touchStart", start.x, start.y);
  for (let step = 1; step <= 5; step += 1) {
    await touch(cdp, "touchMove", start.x + (end.x - start.x) * step / 5, start.y + (end.y - start.y) * step / 5);
  }
  await touch(cdp, "touchEnd", 0, 0);
  await delay(100);
}

async function mouseDrag(cdp, start, end) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x, y: start.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: start.x, y: start.y, button: "left", buttons: 1, clickCount: 1 });
  const pressed = await snapshot(cdp);
  for (let step = 1; step <= 4; step += 1) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved", x: start.x + (end.x - start.x) * step / 4,
      y: start.y + (end.y - start.y) * step / 4, button: "left", buttons: 1
    });
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: end.x, y: end.y, button: "left", buttons: 0, clickCount: 1 });
  await delay(100);
  return pressed;
}

async function settle(cdp, script, expected, label) {
  const value = await evaluate(cdp, `new Promise((resolve,reject)=>{let stable=0,frames=0;const tick=()=>{${script};const now=${expected.expression};stable=Math.abs(now-${expected.value})<=1?stable+1:0;if(stable>=5)return resolve(now);if(++frames>80)return reject(new Error('settle timeout'));requestAnimationFrame(tick)};tick()})`);
  assert.ok(Math.abs(value - expected.value) <= 1, label);
}

async function snapshot(cdp) {
  return evaluate(cdp, `(() => {
    const f=document.getElementById('activity'),w=f.contentWindow,d=w.document,p=d.getElementById('controlPanel'),
      r=f.getBoundingClientRect(),sr=d.getElementById('stage').getBoundingClientRect();
    const hv=visualViewport,av=w.visualViewport;
    return {host:scrollY,hostViewport:{top:hv?.offsetTop||0,page:hv?.pageTop||0,left:hv?.offsetLeft||0},
      iframe:{top:r.top,left:r.left},activity:d.scrollingElement.scrollTop,
      activityViewport:{top:av?.offsetTop||0,page:av?.pageTop||0,left:av?.offsetLeft||0},
      panel:p.scrollTop,stage:{top:sr.top,left:sr.left,width:sr.width,height:sr.height},
      state:JSON.stringify(w.__freeFallDebug.state()),ruler:w.__freeFallDebug.ruler(),
      events:w.__freeFallDebug.eventCounts()};
  })()`);
}

function zeroDelta(before, after, keys, label) {
  for (const key of keys) assert.deepEqual(after[key], before[key], `${label}: ${key} remains fixed`);
}

async function point(cdp, selector) {
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),e=f.contentWindow.document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(); return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2}; })()`);
}

async function pointAt(cdp, selector, xFraction, yFraction) {
  return evaluate(cdp, `(() => { const f=document.getElementById('activity'),fr=f.getBoundingClientRect(),
    e=f.contentWindow.document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();
    return {x:fr.left+r.left+r.width*${xFraction},y:fr.top+r.top+r.height*${yFraction},
      owner:f.contentWindow.document.elementFromPoint(r.left+r.width*${xFraction},r.top+r.height*${yFraction})?.id}; })()`);
}

const PANEL_ROWS = Object.freeze([
  ["middle-up", "p.scrollTop=Math.floor((p.scrollHeight-p.clientHeight)/2)", -90],
  ["middle-down", "p.scrollTop=Math.floor((p.scrollHeight-p.clientHeight)/2)", 90],
  ["top-boundary", "p.scrollTop=0", 90],
  ["bottom-boundary", "p.scrollTop=p.scrollHeight", -90]
]);

async function runPanelRows(cdp, label, stateName, prepareRow, expectedAnimationMode) {
  for (const [name, setup, delta] of PANEL_ROWS) {
    if (prepareRow) await prepareRow(name);
    await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 },
      `${label}: ${stateName} ${name} host setup`);
    const target = name === "top-boundary" ? 0 : name === "bottom-boundary"
      ? await evaluate(cdp, "(()=>{const p=document.getElementById('activity').contentWindow.document.getElementById('controlPanel');return p.scrollHeight-p.clientHeight})()")
      : await evaluate(cdp, "(()=>{const p=document.getElementById('activity').contentWindow.document.getElementById('controlPanel');return Math.floor((p.scrollHeight-p.clientHeight)/2)})()");
    await settle(cdp, `const p=document.getElementById('activity').contentWindow.document.getElementById('controlPanel');${setup}`,
      { expression: "Math.round(document.getElementById('activity').contentWindow.document.getElementById('controlPanel').scrollTop)", value: target },
      `${label}: ${stateName} ${name} panel setup`);
    if (expectedAnimationMode) {
      assert.equal(await evaluate(cdp, "document.getElementById('activity').contentWindow.__freeFallDebug.animation().mode"),
        expectedAnimationMode, `${label}: ${stateName} ${name} starts in ${expectedAnimationMode}`);
    }
    const panelPoint = await point(cdp, "#controlPanel");
    const before = await snapshot(cdp);
    await swipe(cdp, panelPoint, { x: panelPoint.x, y: panelPoint.y + delta });
    const after = await snapshot(cdp);
    if (name.startsWith("middle")) assert.ok(Math.abs(after.panel - before.panel) > 10,
      `${label}: ${stateName} ${name} changes panel scroll`);
    else {
      assert.ok(Math.abs(after.panel - before.panel) <= 1,
        `${label}: ${stateName} ${name} remains contained at panel boundary`);
      assert.ok(Math.abs(after.panel - target) <= 1,
        `${label}: ${stateName} ${name} remains at the intended panel boundary`);
    }
    zeroDelta(before, after, ["host", "hostViewport", "iframe", "activity", "activityViewport", "stage", "state", "ruler"],
      `${label}: ${stateName} panel ${name}`);
  }
}

async function runTouchMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  const embeddedUrl = (stateName) => {
    const source = `${activityPath}?trusted-touch=${encodeURIComponent(`${label}-${stateName}`)}`;
    return `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(source)}`;
  };
  await navigate(cdp, embeddedUrl("setup"), true);
  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: host setup`);

  let blank = await point(cdp, "#stage");
  blank.x = 35;
  let before = await snapshot(cdp);
  await swipe(cdp, blank, { x: blank.x, y: blank.y - 80 });
  let after = await snapshot(cdp);
  assert.ok(Math.abs(after.host - before.host) > 10, `${label}: setup preview blank-stage swipe moves host`);
  zeroDelta(before, after, ["activity", "activityViewport", "panel", "state", "ruler"], `${label}: setup preview stage`);

  await runPanelRows(cdp, label, "setup preview", async () => {
    await evaluate(cdp, "document.getElementById('activity').contentWindow.__freeFallDebug.replayPreview()");
  }, "preview");

  await navigate(cdp, embeddedUrl("capture"), true);
  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: capture host page setup`);
  blank = await point(cdp, "#stage");
  blank.x = 35;
  await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;
    d.getElementById('controlPanel').scrollTop=0;d.querySelector('[data-frequency="4"]').click();d.getElementById('generateButton').click()})()`);
  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: capture host reset`);
  await settle(cdp, "document.getElementById('activity').contentWindow.document.getElementById('controlPanel').scrollTop=0",
    { expression: "Math.round(document.getElementById('activity').contentWindow.document.getElementById('controlPanel').scrollTop)", value: 0 },
    `${label}: capture panel reset`);
  before = await snapshot(cdp);
  await swipe(cdp, blank, { x: blank.x, y: blank.y + 80 });
  after = await snapshot(cdp);
  assert.ok(Math.abs(after.host - before.host) > 10, `${label}: capture blank-stage swipe moves host`);
  zeroDelta(before, after, ["activity", "activityViewport", "panel", "state", "ruler"], `${label}: capture stage`);
  await runPanelRows(cdp, label, "capture", async (name) => {
    await navigate(cdp, embeddedUrl(`capture-${name}`), true);
    await evaluate(cdp, `(() => {const d=document.getElementById('activity').contentWindow.document;
      d.querySelector('[data-frequency="4"]').click();d.getElementById('generateButton').click()})()`);
  }, "capture");

  await navigate(cdp, embeddedUrl("static"), true);
  await prepare(cdp, "document.getElementById('activity').contentWindow");
  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: static host page setup`);
  blank = await point(cdp, "#stage");
  blank.x = 35;

  for (const direction of [-1, 1]) {
    await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: blank reset`);
    const before = await snapshot(cdp);
    await swipe(cdp, { x: blank.x, y: blank.y }, { x: blank.x, y: blank.y + direction * 90 });
    const after = await snapshot(cdp);
    assert.ok(Math.abs(after.host - before.host) > 10, `${label}: blank-stage swipe ${direction} moves host`);
    assert.ok(Math.abs((after.iframe.top - before.iframe.top) + (after.host - before.host)) <= 3, `${label}: iframe moves with host`);
    zeroDelta(before, after, ["activity", "activityViewport", "panel", "state", "ruler"], `${label}: blank-stage swipe ${direction}`);
  }

  await runPanelRows(cdp, label, "static", null, "static");

  await settle(cdp, "window.scrollTo(0,260)", { expression: "Math.round(scrollY)", value: 260 }, `${label}: ruler host reset`);
  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('controlPanel').scrollTop=0");
  const dragStarts = [["top", .5, .03], ["middle", .5, .5], ["bottom", .5, .97], ["left-edge", .03, .5], ["right-edge", .97, .5]];
  for (const [name, xFraction, yFraction] of dragStarts) {
    const start = await pointAt(cdp, "#rulerHandle", xFraction, yFraction);
    assert.equal(start.owner, "rulerHandle", `${label}: trusted touch ${name} starts on the ruler drag owner`);
    const beforeDrag = await snapshot(cdp);
    await swipe(cdp, start, { x: start.x + 24, y: start.y + 12 });
    const afterDrag = await snapshot(cdp);
    assert.notDeepEqual(afterDrag.ruler, beforeDrag.ruler, `${label}: trusted touch from ${name} changes ruler`);
    zeroDelta(beforeDrag, afterDrag, ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel"], `${label}: ruler drag ${name}`);
    const beforeState = JSON.parse(beforeDrag.state), afterState = JSON.parse(afterDrag.state);
    assert.deepEqual(afterState.measurements, beforeState.measurements, `${label}: ${name} drag does not record an answer`);
    assert.deepEqual(afterState.evidence, beforeState.evidence, `${label}: ${name} pointerup creates placement, not finalized evidence`);
    assert.ok(afterDrag.events.trusted && afterDrag.events.pointerType === "touch" && afterDrag.events.moves > 0 &&
      afterDrag.events.ups === 1 && afterDrag.events.cancels === 0,
    `${label}: trusted touch from ${name} delivers pointermove/pointerup without pointercancel ${JSON.stringify(afterDrag.events)}`);
  }

  for (const [name, xFraction, yFraction] of dragStarts) {
    const start = await pointAt(cdp, "#rulerHandle", xFraction, yFraction);
    assert.equal(start.owner, "rulerHandle", `${label}: mouse ${name} starts on the ruler drag owner`);
    const beforeMouse = await snapshot(cdp);
    const pressedMouse = await mouseDrag(cdp, start, { x: start.x - 18, y: start.y + 10 });
    const afterMouse = await snapshot(cdp);
    assert.deepEqual(pressedMouse.ruler, beforeMouse.ruler, `${label}: mouse ${name} pointerdown preserves relative grab offset`);
    assert.notDeepEqual(afterMouse.ruler, beforeMouse.ruler, `${label}: mouse ${name} drag changes ruler`);
    zeroDelta(beforeMouse, afterMouse, ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel"], `${label}: mouse ruler drag ${name}`);
    assert.ok(afterMouse.events.trusted && afterMouse.events.pointerType === "mouse" && afterMouse.events.moves > 0 &&
      afterMouse.events.ups === 1 && afterMouse.events.cancels === 0, `${label}: trusted mouse ${name} drag completes normally`);
  }

  const cancelPoint = await pointAt(cdp, "#rulerHandle", .5, .5);
  const beforeCancel = await snapshot(cdp);
  await touch(cdp, "touchStart", cancelPoint.x, cancelPoint.y);
  await touch(cdp, "touchMove", cancelPoint.x + 30, cancelPoint.y + 15);
  await touch(cdp, "touchCancel", 0, 0);
  const afterCancel = await snapshot(cdp);
  assert.deepEqual(afterCancel.ruler, beforeCancel.ruler, `${label}: trusted pointercancel restores the completed ruler position`);
  assert.equal(afterCancel.events.cancels, 1); assert.equal(afterCancel.events.ups, 0);
  zeroDelta(beforeCancel, afterCancel, ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel", "state"],
    `${label}: pointercancel`);

  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('rulerHandle').focus({preventScroll:true})");
  const beforeKey = await snapshot(cdp);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  const afterFine = await snapshot(cdp);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", modifiers: 8, windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", code: "ArrowDown", modifiers: 8, windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
  const afterCoarse = await snapshot(cdp);
  assert.ok(Math.abs(afterFine.ruler.x - beforeKey.ruler.x) > 0, `${label}: Arrow key moves focused ruler`);
  assert.ok(Math.abs(afterCoarse.ruler.y - afterFine.ruler.y) >= 7, `${label}: Shift+Arrow uses coarse ruler movement`);
  zeroDelta(beforeKey, afterCoarse, ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel"], `${label}: keyboard ruler movement`);
  const keyState = JSON.parse(afterCoarse.state);
  assert.equal(keyState.activePlacement.mode, "keyboard");
  assert.equal(await evaluate(cdp, "document.getElementById('activity').contentWindow.document.activeElement.id"), "rulerHandle",
    `${label}: keyboard rerender preserves ruler focus`);
  assert.equal(await evaluate(cdp, "document.getElementById('activity').contentWindow.document.querySelectorAll('[data-nudge],.nudge-grid').length"), 0,
    `${label}: no panel nudge controls remain`);
}

async function runArtifact(cdp, packageRoot, activityPath, label) {
  const server = createServer(packageRoot);
  await withTimeout(listenServer(server), 3000, `${label} HTTP listen`);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await runAnimationMatrix(cdp, baseUrl, activityPath, label);
    await runUnitNotationMatrix(cdp, baseUrl, activityPath, label);
    await runRealInputPath(cdp, baseUrl, activityPath, label);
    await runRulerGeometryMatrix(cdp, baseUrl, activityPath, label);
    await layoutMatrix(cdp, baseUrl, activityPath, label);
    await runTouchMatrix(cdp, baseUrl, activityPath, label);
    await runLifecycleMatrix(cdp, baseUrl, activityPath, label);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function main() {
  sourceParity();
  const browser = findBrowser();
  if (!browser) throw new Error("Chrome/Chromium is required for free-fall trusted-touch regression.");
  const tempRoot = fs.realpathSync(os.tmpdir());
  let chrome, cdp, profileDirectory, packageDirectory, failure;
  try {
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-"));
    validateOwnedProfile(profileDirectory, tempRoot);
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update", "--disable-sync", "about:blank"];
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    const port = await withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome startup");
    const { response, body } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Could not create Chrome target (${response.status}).`);
    cdp = new CdpClient(body.webSocketDebuggerUrl);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    await runArtifact(cdp, root, `/sim/${slug}/index.html`, "development source");
    const extracted = buildAndExtractPackage(tempRoot, { slug });
    packageDirectory = extracted.packageDirectory;
    await runArtifact(cdp, packageDirectory, extracted.activityPath, "extracted SCORM");
  } catch (error) { failure = error; }
  try {
    await cleanupResources({ chrome, cdp, server: null, profileDirectory, packageDirectory, tempRoot });
  } catch (error) {
    failure = new AggregateError(failure ? [failure, error] : [error], "free-fall browser cleanup failed");
  }
  if (failure) throw failure;
  console.log("Free-fall source and extracted-package responsive/trusted-touch regression passed");
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { sourceParity };
