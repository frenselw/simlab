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

async function prepare(cdp, frameExpression = "window", frequency = 5) {
  await evaluate(cdp, `(() => { const w=${frameExpression},d=w.document,P=w.FreeFallPersistence;
    w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:P.assignedState(${frequency})}});
    d.getElementById('generateButton').click(); })()`);
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
    let state=P.generate(P.assignedState(6));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,rulerX:100,rulerSide:'left',rulerGeometry:'fixed-left-v1',horizontalMode:'guide-fraction',guideFraction:20/205,zeroTickOverlapPx:23,zeroErrorPx:0});
    state=P.withPlacement(state,place('total',0));
    for(let index=0;index<4;index+=1)state=P.resolveMeasurement(state,M.displacementAt(6,index+1));
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index];state=P.resolveMeasurement(P.withPlacement(state,place(task,M.displacementAt(6,index))),M.intervalDisplacement(6,index+1));}
    state=P.setAnalysis(state,{deltaTS:1/6,cumulativeTimeRatio:{values:[1,2,3,4]},intervalTimeRatio:{values:[1,1,1,1]},lawAnswerId:'square',intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);const review=P.makeReview(state),result=S.scoreAttempt(review),snapshot=w.SimScorm.makeSnapshot('${slug}','review',review,result);
    const oldAnalysis=(analysis)=>({deltaTS:analysis.deltaTS,
      cumulativeTimeRatio:{status:'answered',values:analysis.cumulativeTimeRatio.values},
      totalDisplacementRatio:{status:'answered',values:[1,4,9,16]},
      intervalTimeRatio:{status:'answered',values:analysis.intervalTimeRatio.values},
      intervalDistanceRatio:{status:'answered',values:[1,3,5,7]},lawAnswerId:analysis.lawAnswerId,
      intervalLawAnswerId:analysis.intervalLawAnswerId,accelerationAnswerId:analysis.accelerationAnswerId});
    const legacyReview=JSON.parse(JSON.stringify(review));legacyReview.v=1;legacyReview.rubricVersion=2;
    legacyReview.frequencyActivelySelected=legacyReview.frequencyAssigned;delete legacyReview.frequencyAssigned;
    legacyReview.analysis=oldAnalysis(legacyReview.analysis);
    const legacy=(value,keepSide=false)=>{value.edgeGapPx=10;delete value.zeroTickOverlapPx;delete value.rulerX;delete value.rulerGeometry;
      delete value.horizontalMode;delete value.guideFraction;delete value.boundaryOverlapPx;
      if('rulerSide'in value){if(keepSide)value.edgeSide='right';delete value.rulerSide;}};
    legacy(legacyReview.evidence.totalPlacement,true);S.GAP_KEYS.forEach(key=>legacy(legacyReview.evidence[key]));
    const legacyResult=S.scoreAttempt(P.decodeImmutableReview(legacyReview));
    const legacySnapshot=w.SimScorm.makeSnapshot('${slug}','review',legacyReview,legacyResult);
    const historicalReview=JSON.parse(JSON.stringify(review));historicalReview.v=2;historicalReview.rubricVersion=2;
    historicalReview.analysis=oldAnalysis(historicalReview.analysis);delete historicalReview.evidence.totalPlacement.rulerGeometry;
    S.GAP_KEYS.forEach(key=>delete historicalReview.evidence[key].rulerGeometry);
    const historicalResult=S.scoreAttempt(P.decodeImmutableReview(historicalReview));
    const historicalSnapshot=w.SimScorm.makeSnapshot('${slug}','review',historicalReview,historicalResult);
    return {review,result,snapshot,legacySnapshot,historicalSnapshot,
      pending:{version:1,activity:'${slug}',kind:'pending-final',payload:{reviewJson:JSON.stringify(snapshot),score:result.score,maxScore:100,passed:result.passed}},
      legacyPending:{version:1,activity:'${slug}',kind:'pending-final',payload:{reviewJson:JSON.stringify(legacySnapshot),score:legacyResult.score,maxScore:100,passed:legacyResult.passed}},
      historicalPending:{version:1,activity:'${slug}',kind:'pending-final',payload:{reviewJson:JSON.stringify(historicalSnapshot),score:historicalResult.score,maxScore:100,passed:historicalResult.passed}}};
  })()`);
}

async function reloadWithLms(cdp, activityPath, caseId, values) {
  await evaluate(cdp, `(() => {
    const values=window.__lmsValues=${JSON.stringify(values)},f=document.getElementById('activity');
    window.API={LMSInitialize:()=>'true',LMSGetValue:key=>values[key]||'',LMSSetValue:(key,value)=>(values[key]=String(value),'true'),LMSCommit:()=>'true',LMSFinish:()=>'true',LMSGetLastError:()=>'0',LMSGetErrorString:()=>'No error'};
    f.src=${JSON.stringify(activityPath)}+'?lifecycle='+${JSON.stringify(caseId)};
  })()`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, `(() => {const w=document.getElementById('activity')?.contentWindow;return Boolean(w&&new URLSearchParams(w.location.search).get('lifecycle')===${JSON.stringify(caseId)}&&w.__freeFallDebug)})()`)) return;
    await delay(50);
  }
  throw new Error(`lifecycle case did not load: ${caseId}`);
}

async function runAssignmentCheckpointMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`, true);
  await evaluate(cdp, `(() => {
    const durable={'cmi.core.lesson_status':'not attempted','cmi.core.score.raw':'','cmi.suspend_data':''};
    let buffer={...durable},lastError='0';
    const control=window.__assignmentLms={durable,fail:true,commits:0};
    window.API={
      LMSInitialize:()=>'true',
      LMSGetValue:key=>buffer[key]||'',
      LMSSetValue:(key,value)=>(buffer[key]=String(value),lastError='0','true'),
      LMSCommit:()=>{control.commits+=1;if(control.fail){lastError='101';return 'false'}
        Object.assign(durable,buffer);lastError='0';return 'true'},
      LMSFinish:()=>'true',LMSGetLastError:()=>lastError,LMSGetErrorString:()=>'forced assignment checkpoint failure'
    };
    document.getElementById('activity').src=${JSON.stringify(activityPath)}+'?forced-rng=0.1&assignment-checkpoint=first';
  })()`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, "Boolean(document.getElementById('activity')?.contentWindow?.__freeFallDebug?.locked())")) break;
    await delay(50);
  }
  let view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document,state=w.__freeFallDebug.state();
    return {calls:w.__freeFallRngCalls,state,locked:w.__freeFallDebug.locked(),
      generateDisabled:d.getElementById('generateButton').disabled,
      retryText:d.getElementById('technicalRetry').textContent,commits:window.__assignmentLms.commits};
  })()`);
  assert.equal(view.calls, 1, `${label}: genuinely new attempt samples exactly once`);
  assert.equal(view.state.frequencyHz, 4); assert.ok(view.locked && view.generateDisabled);
  assert.match(view.retryText, /同一頻率/);
  await evaluate(cdp, `(() => {
    window.__assignmentLms.fail=false;
    document.getElementById('activity').contentWindow.document.getElementById('technicalRetry').click();
  })()`);
  view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document;
    return {calls:w.__freeFallRngCalls,state:w.__freeFallDebug.state(),locked:w.__freeFallDebug.locked(),
      generateDisabled:d.getElementById('generateButton').disabled,
      durable:JSON.parse(window.__assignmentLms.durable['cmi.suspend_data'])};
  })()`);
  assert.equal(view.calls, 1, `${label}: assignment retry reuses the in-memory sample`);
  assert.equal(view.state.frequencyHz, 4); assert.ok(!view.locked && !view.generateDisabled);
  assert.equal(view.durable.answer.frequencyHz, 4, `${label}: retry checkpoints that same assignment`);
  await evaluate(cdp, `document.getElementById('activity').src=${JSON.stringify(activityPath)}+
    '?forced-rng=0.9&assignment-checkpoint=restore'`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, `(() => {const w=document.getElementById('activity')?.contentWindow;
      return Boolean(w&&new URLSearchParams(w.location.search).get('assignment-checkpoint')==='restore'&&w.__freeFallDebug)})()`)) break;
    await delay(50);
  }
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow;
    return {calls:w.__freeFallRngCalls,state:w.__freeFallDebug.state(),locked:w.__freeFallDebug.locked()}})()`);
  assert.equal(view.calls, 0, `${label}: restored assignment does not call a different injected RNG`);
  assert.equal(view.state.frequencyHz, 4); assert.equal(view.state.variant, "assigned"); assert.ok(!view.locked);
}

async function runPersistedFrequencyResetMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(activityPath)}`, true);
  const snapshot = { version: 1, activity: slug, kind: "draft", answer: {
    v: 2, modelVersion: 1, rubricVersion: 2, phase: "setup", variant: "assigned", currentStep: "setup",
    returnToReview: false, frequencyHz: 6, frequencyAssigned: true
  } };
  await evaluate(cdp, `(() => {const values=window.__lmsValues={
    'cmi.core.lesson_status':'incomplete','cmi.core.score.raw':'','cmi.suspend_data':${JSON.stringify(JSON.stringify(snapshot))}};
    window.API={LMSInitialize:()=>'true',LMSGetValue:key=>values[key]||'',LMSSetValue:(key,value)=>(values[key]=String(value),'true'),
      LMSCommit:()=>'true',LMSFinish:()=>'true',LMSGetLastError:()=>'0',LMSGetErrorString:()=>'No error'};
    document.getElementById('activity').src=${JSON.stringify(activityPath)}+'?forced-rng=0&persisted-6-reset='+${JSON.stringify(label)};})()`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, `(() => {const w=document.getElementById('activity')?.contentWindow;
      return Boolean(w&&new URLSearchParams(w.location.search).get('persisted-6-reset')===${JSON.stringify(label)}&&w.__freeFallDebug)})()`)) break;
    await delay(50);
  }
  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('generateButton').click()");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(cdp, "document.getElementById('activity').contentWindow.__freeFallDebug.animation().mode==='static'")) break;
    await delay(25);
  }
  const reset = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;w.confirm=()=>true;
    d.querySelector('[data-reset-frequency]').click();const state=w.__freeFallDebug.state();
    return {calls:w.__freeFallRngCalls,state,assigned:d.getElementById('assignedFrequency').textContent,
      generateDisabled:d.getElementById('generateButton').disabled};})()`);
  assert.equal(reset.calls, 0, `${label}: restored 6 Hz render/capture/reset never calls the injected RNG`);
  assert.ok(reset.state.frequencyHz===6&&reset.state.phase==="setup"&&reset.state.variant==="assigned"&&
    reset.state.generated===undefined&&!reset.generateDisabled&&/6 Hz/.test(reset.assigned),
  `${label}: UI reset preserves persisted-only 6 Hz ${JSON.stringify(reset)}`);
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
  let view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('technicalTitle').textContent,retry:[...d.querySelectorAll('#technicalSection button')].some(b=>/重試同一份/.test(b.textContent)),locked:w.__freeFallDebug.locked(),frequency:d.getElementById('frequencyChip').textContent}})()`);
  assert.match(view.title, /待確認/); assert.match(view.frequency, /f = 6 Hz/);
  assert.ok(view.retry && view.locked, `${label}: valid frozen startup is locked with same-payload retry`);

  await reloadWithLms(cdp, activityPath, `${label}-pending-v1`, values("incomplete", fixture.legacyPending));
  view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document,
      frozenRaw=window.__lmsValues['cmi.suspend_data'],
      button=[...d.querySelectorAll('#technicalSection button')].find(node=>/重試同一份/.test(node.textContent));
    button.click();
    return {frozenRaw,after:window.__lmsValues['cmi.suspend_data'],locked:w.__freeFallDebug.locked(),
      expected:JSON.stringify(${JSON.stringify(fixture.legacySnapshot)})};
  })()`);
  assert.equal(view.after, view.expected, `${label}: migrated v1 frozen retry writes the original legacy review payload`);
  assert.equal(JSON.parse(view.frozenRaw).payload.reviewJson, JSON.stringify(fixture.legacySnapshot),
    `${label}: v1 pending payload remains unchanged until same-payload retry`);
  assert.ok(view.locked, `${label}: successful v1 retry finishes in a locked state`);

  await reloadWithLms(cdp, activityPath, `${label}-finished-v1-6hz`,
    values("passed", fixture.legacySnapshot, fixture.result.score));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;
    return {frequency:w.__freeFallDebug.state().frequencyHz,chip:d.getElementById('frequencyChip').textContent,
      locked:w.__freeFallDebug.locked(),result:!d.getElementById('resultSection').hidden}})()`);
  assert.deepEqual(view, { frequency: 6, chip: "頻閃頻率：f = 6 Hz", locked: true, result: true },
    `${label}: v1 persisted-only 6 Hz finished review migrates without RNG`);

  await reloadWithLms(cdp, activityPath, `${label}-pending-v2-historical`, values("incomplete", fixture.historicalPending));
  view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document,
      frozenRaw=window.__lmsValues['cmi.suspend_data'],
      button=[...d.querySelectorAll('#technicalSection button')].find(node=>/重試同一份/.test(node.textContent));
    button.click();
    return {frozenRaw,after:window.__lmsValues['cmi.suspend_data'],locked:w.__freeFallDebug.locked(),
      expected:JSON.stringify(${JSON.stringify(fixture.historicalSnapshot)})};
  })()`);
  assert.equal(view.after, view.expected, `${label}: historical v2 6 Hz frozen retry preserves original review bytes`);
  assert.equal(JSON.parse(view.frozenRaw).payload.reviewJson, JSON.stringify(fixture.historicalSnapshot));
  assert.ok(view.locked);

  const invalidLegacySnapshot = JSON.parse(JSON.stringify(fixture.legacySnapshot));
  invalidLegacySnapshot.answer.evidence.totalPlacement.rulerZeroM = -.75;
  invalidLegacySnapshot.answer.evidence.totalPlacement.zeroErrorPx = -6;
  const invalidLegacyPending = {
    ...fixture.legacyPending,
    payload: { ...fixture.legacyPending.payload, reviewJson: JSON.stringify(invalidLegacySnapshot) }
  };
  await reloadWithLms(cdp, activityPath, `${label}-pending-v1-negative`, values("incomplete", invalidLegacyPending));
  view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document;
    return {title:d.getElementById('technicalTitle').textContent,frequency:d.getElementById('frequencyChip').textContent,
      retry:w.SimScorm.retryPending().reason,locked:w.__freeFallDebug.locked()};
  })()`);
  assert.match(view.title, /安全載入/);
  assert.match(view.frequency, /未能確認/);
  assert.equal(view.retry, "no-pending");
  assert.ok(view.locked, `${label}: v1-invalid negative placement is quarantined and technically locked`);

  const badNested = { ...fixture.snapshot, answer: { invalid: true } };
  const badPending = { ...fixture.pending, payload: { ...fixture.pending.payload, reviewJson: JSON.stringify(badNested) } };
  await reloadWithLms(cdp, activityPath, `${label}-pending-invalid`, values("incomplete", badPending));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('technicalTitle').textContent,retry:w.SimScorm.retryPending().reason,locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /安全載入/); assert.equal(view.retry, "no-pending"); assert.ok(view.locked, `${label}: invalid frozen payload is quarantined and locked`);

  const badFinished = { version: 1, activity: slug, kind: "review", answer: { invalid: true }, score: 42, passed: false };
  await reloadWithLms(cdp, activityPath, `${label}-finished-invalid`, values("failed", badFinished, 42));
  view = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;return {title:d.getElementById('resultTitle').textContent,score:d.getElementById('scorePanel').textContent,locked:w.__freeFallDebug.locked()}})()`);
  assert.match(view.title, /詳細資料不可驗證/); assert.match(view.score, /42/); assert.ok(view.locked, `${label}: invalid finished review uses Moodle fallback`);

  await reloadWithLms(cdp, activityPath, `${label}-finished-trust-mismatch`, values("passed", fixture.snapshot, 42));
  view = await evaluate(cdp, `(() => {const d=document.getElementById('activity').contentWindow.document;return {
    score:d.getElementById('scorePanel').textContent,cards:d.querySelectorAll('#resultFeedback .result-card').length,
    feedback:d.getElementById('resultFeedback').textContent};})()`);
  assert.match(view.score, /Moodle 記錄/); assert.match(view.score, /42/); assert.match(view.score, /已通過/);
  assert.equal(view.cards, 0); assert.doesNotMatch(view.feedback, /正確|需修正|參考答案/,
    `${label}: trust mismatch shows authoritative Moodle summary without correctness cards`);

  await reloadWithLms(cdp, activityPath, `${label}-unknown-status`, values("completed", fixture.snapshot, fixture.result.score));
  view = await evaluate(cdp, `document.getElementById('activity').contentWindow.document.getElementById('scorePanel').textContent`);
  assert.match(view, /未能安全判斷合格狀態/, `${label}: unknown Moodle pass status remains indeterminate`);

  await reloadWithLms(cdp, activityPath, `${label}-blank-confirm`, values("not attempted", null));
  view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)},P=w.FreeFallPersistence;
    const blank=JSON.parse(JSON.stringify(fixture.review));blank.analysis=P.emptyAnalysis();
    w.__freeFallDebug.setReview(blank);let calls=0;
    w.SimScorm.submitWithCallbacks=(result,snapshot,callbacks)=>{calls+=1;if(calls===1)callbacks.onFailure({activityState:'retry',retryable:true})};
    d.getElementById('submitButton').click();d.getElementById('submitButton').click();
    const warning=d.getElementById('submissionNotice').textContent;
    const notice=d.getElementById('submissionNotice');
    const before={calls,locked:w.__freeFallDebug.locked(),warning,role:notice.getAttribute('role'),
      labelledby:notice.getAttribute('aria-labelledby'),describedby:notice.getAttribute('aria-describedby')};
    d.querySelector('[data-blank-action="confirm"]').click();
    const afterConfirm={calls,locked:w.__freeFallDebug.locked(),retry:!d.getElementById('submissionRetry').classList.contains('is-hidden')};
    d.getElementById('submissionRetry').click();
    return {before,afterConfirm,afterRetry:{calls,locked:w.__freeFallDebug.locked()}};
  })()`);
  assert.equal(view.before.calls, 0); assert.equal(view.before.locked, false);
  assert.match(view.before.warning, /10 項未答/); assert.match(view.before.warning, /返回修改/); assert.match(view.before.warning, /仍然提交/);
  assert.match(view.before.warning, /0 分/); assert.match(view.before.warning, /鎖定今次 attempt/);
  assert.deepEqual({ role: view.before.role, labelledby: view.before.labelledby, describedby: view.before.describedby },
    { role: "alertdialog", labelledby: "blankWarningTitle", describedby: "blankWarningDescription" });
  assert.deepEqual(view.afterConfirm, { calls: 1, locked: false, retry: true },
    `${label}: only explicit Still submit creates the canonical submission`);
  assert.deepEqual(view.afterRetry, { calls: 2, locked: true },
    `${label}: retry resubmits the already-confirmed identical canonical review without reopening the warning`);

  await reloadWithLms(cdp, activityPath, `${label}-blank-return`, values("not attempted", null));
  view = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)},P=w.FreeFallPersistence;
    const blank=JSON.parse(JSON.stringify(fixture.review));blank.analysis=P.emptyAnalysis();
    w.__freeFallDebug.setReview(blank);let calls=0;w.SimScorm.submitWithCallbacks=()=>{calls+=1};
    d.getElementById('submitButton').click();d.querySelector('[data-blank-action="return"]').click();
    return {calls,phase:w.__freeFallDebug.state().phase,focus:d.activeElement.id};
  })()`);
  assert.deepEqual(view, { calls: 0, phase: "analyze", focus: "analysisTitle" },
    `${label}: Return from blank warning restores analysis focus without SCORM mutation`);

  for (const outcome of ["success", "frozen"]) {
    await reloadWithLms(cdp, activityPath, `${label}-blank-${outcome}`, values("not attempted", null));
    view = await evaluate(cdp, `(() => {
      const w=document.getElementById('activity').contentWindow,d=w.document,fixture=${JSON.stringify(fixture)},P=w.FreeFallPersistence;
      const blank=JSON.parse(JSON.stringify(fixture.review));blank.analysis=P.emptyAnalysis();w.__freeFallDebug.setReview(blank);
      let calls=0;w.SimScorm.submitWithCallbacks=(result,snapshot,callbacks)=>{calls+=1;
        const value={activityState:${JSON.stringify(outcome)}};${outcome === "success" ? "callbacks.onSuccess(value)" : "callbacks.onFailure(value)"}};
      d.getElementById('submitButton').click();const before=calls;d.querySelector('[data-blank-action="confirm"]').click();
      return {before,calls,locked:w.__freeFallDebug.locked(),result:!d.getElementById('resultSection').classList.contains('is-hidden'),
        pending:/待確認/.test(d.getElementById('technicalTitle').textContent),cards:d.querySelectorAll('#resultFeedback .result-card').length};
    })()`);
    assert.equal(view.before, 0); assert.equal(view.calls, 1); assert.equal(view.locked, true);
    if (outcome === "success") assert.ok(view.result && view.cards > 0);
    else assert.ok(view.pending && view.cards === 0);
  }

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

  for (const frequency of [4, 5, 6, 8]) {
    await navigate(cdp, `${baseUrl}${activityPath}?capture=${frequency}-${encodeURIComponent(label)}`);
    const capture = await evaluate(cdp, `(async()=> {
      const d=document,w=window,frequency=${frequency};let saves=0;
      const original=w.SimScorm.saveDraft.bind(w.SimScorm);
      w.SimScorm.saveDraft=(snapshot)=>{saves+=1;return original(snapshot)};
      w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:w.FreeFallPersistence.assignedState(frequency)}});
      const beforeGenerateSaves=saves,start=performance.now(),observed=[];
      const button=d.getElementById('generateButton');button.click();button.click();
      let prior=-1;
      const stageBackground=getComputedStyle(d.getElementById('stage')).backgroundColor;
      await new Promise((resolve,reject)=>{const tick=()=>{const view=w.__freeFallDebug.animation();
        if(view.stamps.length!==prior){prior=view.stamps.length;const cue=d.querySelector('[data-exposure-cue]');
          observed.push({count:prior,ms:performance.now()-start,stamps:view.stamps,cueIndex:view.cueIndex,
            cue:cue?Number(cue.dataset.exposureCue):null,cuePointer:cue?getComputedStyle(cue).pointerEvents:null,
            stageBackground:getComputedStyle(d.getElementById('stage')).backgroundColor,
            status:d.getElementById('animationStatus').textContent})}
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
    assert.match(capture.status, /以相等時間間隔記錄/);
    assert.doesNotMatch(capture.status, /Δt|t\s*=|\d+(?:\.\d+)?\s*s\b/,
      `${label} ${frequency} Hz: completion copy does not disclose an exact interval or timestamp`);
    const stampEvents = capture.observed.filter((item) => item.count > 0);
    assert.deepEqual(stampEvents.map((item) => item.count), [1, 2, 3, 4, 5], `${label} ${frequency} Hz: stamps appear uniquely in order`);
    for (let index = 0; index < 5; index += 1) {
      const stamp = capture.view.stamps[index];
      assert.equal(stamp.index, index);
      assert.ok(Math.abs(stamp.timeS - index / frequency) < 1e-12);
      assert.ok(Math.abs(stamp.displacementM - 5 * (index / frequency) ** 2) < 1e-12);
      assert.ok(Math.abs(stampEvents[index].ms - index * 1000 / frequency) <= 90,
        `${label} ${frequency} Hz P${index}: browser reveal is within 90ms scheduler tolerance ${JSON.stringify(stampEvents)}`);
      assert.equal(stampEvents[index].cueIndex, index, `${label} ${frequency} Hz P${index}: cue follows the authoritative exposure`);
      assert.equal(stampEvents[index].cue, index, `${label} ${frequency} Hz P${index}: one localized cue renders at the new stamp`);
      assert.equal(stampEvents[index].cuePointer, "none", `${label} ${frequency} Hz P${index}: cue is pointer-inert`);
      if (index < 4) assert.match(stampEvents[index].status, new RegExp(`已記錄\\s*P${index}`),
        `${label} ${frequency} Hz P${index}: active-capture status names only the recorded point`);
      else assert.match(stampEvents[index].status, /以相等時間間隔記錄/,
        `${label} ${frequency} Hz P4: final exposure transitions directly to neutral completion copy`);
      assert.doesNotMatch(stampEvents[index].status, /Δt|t\s*=|\d+(?:\.\d+)?\s*s\b/,
        `${label} ${frequency} Hz P${index}: capture status does not disclose an exact interval or timestamp`);
      assert.equal(stampEvents[index].stageBackground, capture.observed[0].stageBackground,
        `${label} ${frequency} Hz P${index}: cue does not flash stage luminance`);
    }
  }

  await navigate(cdp, `${baseUrl}${activityPath}?cancel-debug=${encodeURIComponent(label)}`);
  const cancelled = await evaluate(cdp, `(async()=> {
    const d=document,w=window,S=w.FreeFallScoring;let saves=0;
    const original=w.SimScorm.saveDraft.bind(w.SimScorm);
    w.SimScorm.saveDraft=(snapshot)=>{saves+=1;return original(snapshot)};
    w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:w.FreeFallPersistence.assignedState(4)}});
    d.getElementById('generateButton').click();
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
    w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:w.FreeFallPersistence.assignedState(4)}});
    d.getElementById('generateButton').click();
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
    const d=document,before=__freeFallDebug.animation();
    __freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:FreeFallPersistence.assignedState(6)}});
    d.getElementById('generateButton').click();
    const cue=d.querySelector('[data-exposure-cue]');
    return {before,after:__freeFallDebug.animation(),state:__freeFallDebug.state(),
      stamps:d.querySelectorAll('[data-stamp]').length,live:d.querySelectorAll('[data-live-ball]').length,
      cueCount:d.querySelectorAll('[data-exposure-cue]').length,cueStatic:cue?.classList.contains('is-static'),
      cuePointer:cue?getComputedStyle(cue).pointerEvents:null,
      measurementHidden:d.getElementById('measurementSection').classList.contains('is-hidden'),
      hint:d.getElementById('stageHint').textContent};
  })()`);
  assert.equal(reduced.before.mode, "preview-reduced");
  assert.equal(reduced.after.mode, "static"); assert.equal(reduced.after.stamps.length, 5);
  assert.equal(reduced.stamps, 5); assert.equal(reduced.live, 0); assert.ok(!reduced.measurementHidden);
  assert.equal(reduced.cueCount, 1); assert.ok(reduced.cueStatic); assert.equal(reduced.cuePointer, "none");
  assert.equal(reduced.state.phase, "measure-total");
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

  await navigate(cdp, `${baseUrl}${activityPath}?restore=${encodeURIComponent(label)}`);
  const restored = await evaluate(cdp, `(() => {
    const P=FreeFallPersistence,d=document,state=P.generate(P.assignedState(5));
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
    let state=P.generate(P.assignedState(5));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,rulerX:100,rulerSide:'left',rulerGeometry:'fixed-left-v1',horizontalMode:'guide-fraction',guideFraction:20/205,zeroTickOverlapPx:23,zeroErrorPx:0});
    state=P.withPlacement(state,place('total',0));
    for(let index=0;index<4;index+=1)state=P.resolveMeasurement(state,M.displacementAt(5,index+1));
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index];state=P.resolveMeasurement(P.withPlacement(state,place(task,M.displacementAt(5,index))),M.intervalDisplacement(5,index+1));}
    state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{values:[1,2,3,4]},intervalTimeRatio:{values:[1,1,1,1]},lawAnswerId:'square',intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);const review=P.makeReview(state),score=S.scoreAttempt(review);
    w.__freeFallDebug.setReview(review);
    const canonicalBefore=JSON.stringify(P.makeReview(w.__freeFallDebug.state())),scoreBefore=JSON.stringify(S.scoreAttempt(review));
    const reviewHtml=d.getElementById('reviewContent').innerHTML,reviewText=d.getElementById('reviewContent').textContent;
    d.querySelector('[data-edit-measurement="total1"]').click();
    const editValue=d.getElementById('readingInput').value,editUnit=d.querySelector('#measurementSection .reading-row .unit').textContent;
    w.__freeFallDebug.setReview(review);
    const sup=d.querySelector('.camera-note sup'),base=sup.parentElement;
    const supRect={top:sup.getBoundingClientRect().top,bottom:sup.getBoundingClientRect().bottom};
    const supBaseRect={top:base.getBoundingClientRect().top,bottom:base.getBoundingClientRect().bottom};
    const supAlign=getComputedStyle(sup).verticalAlign;
    w.__freeFallDebug.routeSubmission({activityState:'success'});
    const canonicalAfter=JSON.stringify(P.makeReview(w.__freeFallDebug.state()));
    const scoreAfter=JSON.stringify(S.scoreAttempt(P.makeReview(w.__freeFallDebug.state())));
    const resultHtml=d.getElementById('resultFeedback').innerHTML,resultText=d.getElementById('resultFeedback').textContent;
    const cardText=[...d.querySelectorAll('#resultFeedback .result-card')].map(card=>card.textContent);
    const mixed=JSON.parse(JSON.stringify(review));
    mixed.analysis.deltaTS=null;
    mixed.analysis.cumulativeTimeRatio.values=[1,2,8,null];
    mixed.analysis.intervalTimeRatio.values=[1,1,8,null];
    mixed.analysis.lawAnswerId='linear';mixed.analysis.intervalLawAnswerId=null;
    delete mixed.evidence.gap01;
    w.__freeFallDebug.setReview(P.decodeReview(mixed));w.__freeFallDebug.routeSubmission({activityState:'success'});
    const mixedCards=Object.fromEntries(['correct','incorrect','unanswered','no-evidence'].map(status=>{
      const cards=[...d.querySelectorAll('#resultFeedback .result-card.status-'+status)];
      return [status,{count:cards.length,text:cards.map(card=>card.textContent)}];
    }));
    const itemTuple=(id)=>{
      const card=d.querySelector('#resultFeedback .result-card[data-result-item="'+id+'"]');
      if(!card)return null;
      const lines=[...card.querySelectorAll('p')].map(node=>node.textContent.trim());
      const value=(prefix)=>lines.find(line=>line.startsWith(prefix))?.slice(prefix.length).trim()??null;
      return {status:[...card.classList].find(name=>name.startsWith('status-'))?.slice(7)??null,
        learner:value('你的答案：'),expected:value('參考答案：'),points:value('得分：')};
    };
    const mixedItems=Object.fromEntries(['delta-t','cumulative-time-3','process-gap01','displacement','acceleration']
      .map(id=>[id,itemTuple(id)]));
    const sub=d.querySelector('.freefall-header sub'),subBase=d.querySelector('.freefall-header var');
    return {canonicalBefore,canonicalAfter,scoreBefore,scoreAfter,reviewHtml,reviewText,editValue,editUnit,resultHtml,resultText,cardText,mixedCards,mixedItems,
      obsoleteInputs:d.querySelectorAll('[data-ratio="totalDisplacementRatio"],[data-ratio="intervalDistanceRatio"],[data-ratio-key="totalDisplacementRatio"],[data-ratio-key="intervalDistanceRatio"]').length,
      notation:{vars:d.querySelectorAll('var').length,subs:d.querySelectorAll('sub').length,sups:d.querySelectorAll('sup').length,
        supAlign,subAlign:getComputedStyle(sub).verticalAlign,supRect,supBaseRect,
        subRect:{top:sub.getBoundingClientRect().top,bottom:sub.getBoundingClientRect().bottom},
        subBaseRect:{top:subBase.getBoundingClientRect().top,bottom:subBase.getBoundingClientRect().bottom},
        supAbove:(supRect.top+supRect.bottom)/2<(supBaseRect.top+supBaseRect.bottom)/2,
        subBelow:(sub.getBoundingClientRect().top+sub.getBoundingClientRect().bottom)/2>
          (subBase.getBoundingClientRect().top+subBase.getBoundingClientRect().bottom)/2}};
  })()`);
  assert.match(value.editValue, /^0\.285714/, `${label}: review edit prefills the previous recorded photo-centimeter answer`);
  assert.equal(value.editUnit, "cm");
  assert.match(value.reviewText, /相片上 0\.29 cm/); assert.match(value.reviewText, /相片上 1\.14 cm/);
  for (const target of [/1:2:3:4/, /1:1:1:1/, /1:3:5:7/, /平方成正比/, /s∝t²/]) {
    assert.doesNotMatch(value.reviewText, target, `${label}: pre-submit review does not disclose target ${target}`);
    assert.match(value.resultText, target, `${label}: trusted result discloses target ${target}`);
  }
  assert.match(value.resultText, /Δt\s*=\s*0\.2000\s*s/,
    `${label}: trusted result retains the exact interval target`);
  assert.doesNotMatch(value.reviewText, /\d(?:\.\d+)? m(?:\s|$)/, `${label}: review distances do not leak meter units`);
  assert.match(value.resultText, /cm/); assert.match(value.resultText, /±/);
  assert.equal(value.obsoleteInputs, 0);
  assert.ok(value.cardText.length >= 20 && value.cardText.every((text) => /得分：/.test(text)));
  assert.ok(value.cardText.some((text) => /正確/.test(text)) && value.cardText.some((text) => /總位移與時間平方成正比/.test(text)));
  for (const [status, labelText] of Object.entries({correct:"正確",incorrect:"需修正",unanswered:"未答","no-evidence":"未有證據"})) {
    const cards=value.mixedCards[status];
    assert.ok(cards.count>0, `${label}: trusted mixed result renders status-${status} cards`);
    assert.ok(cards.text.every(text=>text.includes(labelText)&&/你的答案：/.test(text)&&/參考答案：/.test(text)&&/得分：/.test(text)),
      `${label}: ${status} cards include Traditional Chinese status, learner/reference values, and points`);
  }
  assert.deepEqual(value.mixedItems, {
    "delta-t": {status:"unanswered",learner:"未答",expected:"0.2 s",points:"0 / 4"},
    "cumulative-time-3": {status:"incorrect",learner:"8",expected:"3",points:"0 / 1.67"},
    "process-gap01": {status:"no-evidence",learner:"未有證據",expected:"重新對準並記錄",points:"0 / 6"},
    displacement: {status:"incorrect",learner:"總位移與時間成正比",expected:"總位移與時間平方成正比",points:"0 / 12"},
    acceleration: {status:"correct",learner:"加速度固定，速度等量增加",expected:"加速度固定，速度等量增加",points:"8 / 8"}
  }, `${label}: trusted mixed fixture renders exact production learner/reference/points tuples by stable item id`);
  assert.match(value.reviewText, /P0→P1/); assert.match(value.reviewText, /P3P4/);
  assert.match(value.reviewHtml, /<var>/); assert.match(value.resultHtml, /<sub>/);
  assert.deepEqual(value.canonicalAfter, value.canonicalBefore, `${label}: display/restore/result conversion does not change canonical JSON`);
  assert.deepEqual(value.scoreAfter, value.scoreBefore, `${label}: display/restore/result conversion does not change score`);
  assert.ok(value.notation.vars > 5 && value.notation.subs > 5 && value.notation.sups >= 2,
    `${label}: semantic math markup is present ${JSON.stringify(value.notation)}`);
  assert.ok(value.notation.subBelow && value.notation.supAlign === "super" && value.notation.subAlign === "sub",
  `${label}: semantic sub/sup has computed geometry ${JSON.stringify(value.notation)}`);
}

async function runFrequencyPhaseOutcomeMatrix(cdp, baseUrl, activityPath, label) {
  await setViewport(cdp, 390, 600);
  await navigate(cdp, `${baseUrl}${activityPath}?frequency-matrix=${encodeURIComponent(label)}`);
  const values = await evaluate(cdp, `(() => {
    const w=window,d=document,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel;
    const chip=()=>d.getElementById('frequencyChip').textContent;
    const rows=[]; const show=(name,state)=>{w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:P.encode(state)}});rows.push([name,chip()])};
    const setup=P.assignedState(6);show('setup',setup);const assigned=d.getElementById('assignedFrequency').textContent;
    let measure=P.generate(setup);show('measure',measure);
    const totals=S.expectedTotals(6),gaps=S.expectedGaps(6);
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,rulerX:100,rulerSide:'left',rulerGeometry:'fixed-left-v1',horizontalMode:'guide-fraction',guideFraction:20/205,zeroTickOverlapPx:23,zeroErrorPx:0});
    let analyze=P.withPlacement(measure,place('total',0));
    for(let i=0;i<4;i+=1)analyze=P.resolveMeasurement(analyze,totals[i]);
    for(let i=0;i<4;i+=1){const task=S.GAP_KEYS[i];analyze=P.resolveMeasurement(P.withPlacement(analyze,place(task,i?totals[i-1]:0)),gaps[i]);}
    show('analysis',analyze);
    let answered=P.setAnalysis(analyze,{deltaTS:1/6,cumulativeTimeRatio:{values:[1,2,3,4]},intervalTimeRatio:{values:[1,1,1,1]},lawAnswerId:'square',intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    const reviewState=P.enterReview(answered),review=P.makeReview(reviewState);w.__freeFallDebug.setReview(review);rows.push(['review',chip()]);
    const original=w.SimScorm.submitWithCallbacks;w.SimScorm.submitWithCallbacks=()=>{};d.getElementById('submitButton').click();rows.push(['submitting',chip()]);w.SimScorm.submitWithCallbacks=original;
    for(const outcome of [{name:'success',value:{activityState:'success'}},{name:'committed',value:{activityState:'committed'}},{name:'frozen',value:{activityState:'frozen'}},{name:'retry',value:{activityState:'retry',retryable:true}}]){
      w.__freeFallDebug.setReview(review);w.__freeFallDebug.routeSubmission(outcome.value);rows.push([outcome.name,chip()]);
    }
    const series=()=>Object.fromEntries([...d.querySelectorAll('#reviewContent .recorded-series [data-series-key]')].map(node=>[node.dataset.seriesKey,node.textContent]));
    w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:P.encode(P.fromReview(review))}});const seriesBefore=series();
    d.querySelector('[data-edit-measurement="total2"]').click();d.getElementById('skipButton').click();
    d.querySelector('[data-edit-measurement="gap23"]').click();d.getElementById('skipButton').click();
    const seriesAfter=series(),skippedReview=P.makeReview(w.__freeFallDebug.state());
    w.__freeFallDebug.setReview(P.decodeReview(JSON.parse(JSON.stringify(review))));
    const seriesRestored=series();
    w.__freeFallDebug.setReview(P.decodeReview(JSON.parse(JSON.stringify(skippedReview))));
    d.querySelector('[data-edit-measurement="total2"]').click();w.__freeFallDebug.setReview(P.makeReview(P.resolveMeasurement(w.__freeFallDebug.state(),totals[1])));
    d.querySelector('[data-edit-measurement="gap23"]').click();w.__freeFallDebug.setReview(P.makeReview(P.resolveMeasurement(w.__freeFallDebug.state(),gaps[2])));
    const seriesRerecorded=series();
    return {rows,assigned,seriesBefore,seriesAfter,seriesRestored,seriesRerecorded};
  })()`);
  for (const [phase, text] of values.rows) assert.match(text, /f = 6 Hz/, `${label}: global frequency persists in ${phase}`);
  assert.match(values.assigned, /f = 6 Hz/, `${label}: local assignment repeats frequency only`);
  assert.doesNotMatch(values.assigned, /Δt|\d+(?:\.\d+)?\s*s\b/, `${label}: local assignment does not disclose exact Δt`);
  const keys = ["total1", "total2", "total3", "total4", "gap01", "gap12", "gap23", "gap34"];
  for (const key of keys) {
    assert.doesNotMatch(values.seriesBefore[key], /未量得/, `${label}: ${key} starts with a numeric value`);
    assert.match(values.seriesBefore[key], /\d+(?:\.\d+)? cm/, `${label}: ${key} starts with production display units`);
  }
  for (const key of keys) {
    const skipped = key === "total2" || key === "gap23";
    assert.equal(/未量得/.test(values.seriesAfter[key]), skipped, `${label}: edit/skip changes only ${key}`);
    assert.equal(values.seriesRestored[key], values.seriesBefore[key], `${label}: restore recovers ${key}`);
    assert.doesNotMatch(values.seriesRerecorded[key], /未量得/, `${label}: re-record restores numeric ${key}`);
  }
}

async function directClick(cdp, selector) {
  await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
  await delay(50);
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
  await navigate(cdp, `${baseUrl}${activityPath}?manual-input=${encodeURIComponent(label)}`);
  await prepare(cdp);
  for (const invalid of ["", "-0.01", "5.01", "Infinity"]) {
    await directFill(cdp, "#readingInput", invalid);
    const before = await evaluate(cdp, "JSON.stringify(__freeFallDebug.state())");
    await directClick(cdp, "#recordButton");
    const rejected = await evaluate(cdp, `(() => ({same:JSON.stringify(__freeFallDebug.state())===${JSON.stringify(before)},
      error:document.getElementById('measurementError').textContent}))()`);
    assert.ok(rejected.same && /0 至 5/.test(rejected.error), `${label}: manual input rejects ${JSON.stringify(invalid)}`);
  }
  for (const accepted of ["0", "5", "2.5714285714285716"]) {
    await directFill(cdp, "#readingInput", accepted);
    await directClick(cdp, "#recordButton");
  }
  const manualOnly = await evaluate(cdp, `(() => {const s=__freeFallDebug.state(),P=FreeFallPersistence;
    document.getElementById('readingInput').value='3.21';
    return {state:s,encoded:JSON.stringify(P.encode(s)),input:document.getElementById('readingInput').value}})()`);
  assert.equal(manualOnly.state.measurements.total1.readingM, 0, `${label}: inclusive 0 cm is recorded`);
  assert.equal(manualOnly.state.measurements.total2.readingM, 3.5, `${label}: inclusive 5 cm is recorded`);
  assert.ok(Math.abs(manualOnly.state.measurements.total3.readingM-1.8)<1e-12,
    `${label}: correct manual answer is converted once without placement`);
  assert.ok([1,2,3].every(index=>manualOnly.state.measurements[`total${index}`].usedTotalPlacement===false),
    `${label}: correct and wrong no-placement answers do not fabricate operation evidence`);
  assert.doesNotMatch(manualOnly.encoded, /3\\.21/, `${label}: transient typed input is not persisted`);

  await navigate(cdp, `${baseUrl}${activityPath}?real-input=${encodeURIComponent(label)}`);
  await prepare(cdp);
  await evaluate(cdp, `(() => {const M=FreeFallModel,y=M.geometry(5,440,55,25).metersToY(0);
    __freeFallDebug.setRuler({x:100,y});document.getElementById('rulerHandle').focus({preventScroll:true})})()`);
  for (let index = 0; index < 8; index += 1) {
    for (const [key, code, virtualKey] of [["ArrowLeft", "ArrowLeft", 37], ["ArrowRight", "ArrowRight", 39]]) {
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers: 8, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers: 8, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
    }
  }
  async function placeBoundary(kind) {
    await evaluate(cdp, `(() => {const d=document,l=__freeFallDebug.rulerLayout(),M=FreeFallModel,
      y=M.geometry(5,440,55,25).metersToY(0),desired=${JSON.stringify(kind)}==='far-left'
        ?80+4/l.scaleX:${JSON.stringify(kind)}==='far-right'?285+19/l.scaleX:100,
      targetY=${JSON.stringify(kind)}==='+6'?y+6/l.scaleY:${JSON.stringify(kind)}==='-6'?y-6/l.scaleY:y,
      vertical=${JSON.stringify(kind)}==='+6'||${JSON.stringify(kind)}==='-6';
      __freeFallDebug.setRuler({x:vertical?100:desired-2,y:vertical?targetY+(${JSON.stringify(kind)}==='+6'?-2:2):targetY});
      d.getElementById('rulerHandle').focus({preventScroll:true})})()`);
    const key = kind === "+6" ? "ArrowDown" : kind === "-6" ? "ArrowUp" : "ArrowRight";
    const code = key;
    const virtualKey = { ArrowRight: 39, ArrowDown: 40, ArrowUp: 38 }[key];
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
    return evaluate(cdp, `(() => {const p=__freeFallDebug.state().activePlacement;
      return {placement:p,valid:FreeFallScoring.validPlacement(p,'total')}})()`);
  }
  for (const kind of ["far-left", "far-right", "+6", "-6"]) {
    const boundary = await placeBoundary(kind);
    assert.ok(boundary.valid, `${label}: ${kind} inclusive guide/alignment boundary is valid ${JSON.stringify(boundary)}`);
    if (kind === "far-left") assert.ok(boundary.placement.zeroTickOverlapPx>=4-.02,
      `${label}: fixed-right clamp preserves at least the inclusive 4 CSS px left overlap`);
    else if (kind === "far-right") assert.ok(Math.abs(boundary.placement.zeroTickOverlapPx-4)<.02,
      `${label}: far-right raw overlap is the inclusive 4 CSS px boundary`);
    else assert.ok(Math.abs(Math.abs(boundary.placement.zeroErrorPx)-6)<.02,
      `${label}: ${kind} alignment is the inclusive 6 CSS px boundary`);
  }
  await evaluate(cdp, `(() => {__freeFallDebug.setRuler({x:100,y:55});
    document.getElementById('rulerHandle').focus({preventScroll:true})})()`);
  for (const [key, code, virtualKey] of [["ArrowRight", "ArrowRight", 39], ["ArrowLeft", "ArrowLeft", 37]]) {
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown", key, code, modifiers: 8, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key, code, modifiers: 8, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey
    });
  }
  const firstReadout = await evaluate(cdp, `(() => {const d=document,o=d.getElementById('stageReadout'),
    scene=d.getElementById('scene'),p=scene.createSVGPoint(),r=o.getBoundingClientRect();
    p.x=0;p.y=Number(o.dataset.measuredY);const measured=p.matrixTransform(scene.getScreenCTM());return {value:d.getElementById('readingInput').value,
    stage:o.textContent,
    canonical:Number(o.dataset.readingM),measuredY:Number(o.dataset.measuredY),outputY:(r.top+r.bottom)/2,expectedY:measured.y,
    stageHidden:document.getElementById('stageReadout').classList.contains('is-hidden'),
    disabled:document.getElementById('recordButton').disabled,state:__freeFallDebug.state(),ruler:__freeFallDebug.ruler()}})()`);
  await directFill(cdp, "#readingInput", "0.2857142857142857");
  await evaluate(cdp, "document.getElementById('recordButton').click()");
  const secondReadout = await evaluate(cdp, `(() => ({value:document.getElementById('readingInput').value,
    stage:document.getElementById('stageReadout').textContent,
    canonical:Number(document.getElementById('stageReadout').dataset.readingM),
    stageHidden:document.getElementById('stageReadout').classList.contains('is-hidden'),
    disabled:document.getElementById('recordButton').disabled,state:__freeFallDebug.state()}))()`);
  await directFill(cdp, "#readingInput", "1.1428571428571428");
  await evaluate(cdp, "document.getElementById('recordButton').click()");

  const result = await evaluate(cdp, `(() => {
    const w=window,d=document,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel;
    const partial=w.__freeFallDebug.state(),encoded=P.encode(partial),decoded=P.decode(encoded);
    let state=decoded;
    state=P.resolveMeasurement(state,M.displacementAt(5,3));
    state=P.resolveMeasurement(state,M.displacementAt(5,4));
    if(!state)throw new Error('real-input totals did not advance: '+JSON.stringify(partial));
    const place=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,rulerX:100,rulerSide:'left',rulerGeometry:'fixed-left-v1',horizontalMode:'guide-fraction',guideFraction:20/205,zeroTickOverlapPx:23,zeroErrorPx:0});
    for(let index=0;index<4;index+=1){const task=S.GAP_KEYS[index],before=state,
      placed=P.withPlacement(state,place(task,M.displacementAt(state.frequencyHz,index)));
      state=placed&&P.resolveMeasurement(placed,M.intervalDisplacement(before.frequencyHz,index+1));
      if(!state)throw new Error('real-input gap '+index+' did not advance: '+JSON.stringify({before,placed}));}
    state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{values:[1,2,3,4]},intervalTimeRatio:{values:[1,1,1,1]},lawAnswerId:'square',
      intervalLawAnswerId:'odd',accelerationAnswerId:'constant-acceleration'});
    state=P.enterReview(state);
    if(!state||state.phase!=='review'||state.variant!=='ready')throw new Error('real-input review invalid: '+JSON.stringify(state));
    const review=P.makeReview(state),decodedReview=P.decodeReview(review),score=S.scoreAttempt(review);
    w.__freeFallDebug.setReview(review);
    const reviewText=d.getElementById('reviewContent').textContent;
    const canonicalBefore=JSON.stringify(P.makeReview(w.__freeFallDebug.state()));
    const evidenceBefore=JSON.stringify(review.evidence);
    d.querySelector('[data-edit-measurement="total2"]').click();
    const editValue=d.getElementById('readingInput').value,editFocus=d.activeElement.id;
    const editStageHidden=d.getElementById('stageReadout').classList.contains('is-hidden');
    d.getElementById('recordButton').click();
    const postEditState=w.__freeFallDebug.state();
    const unchangedReading=postEditState.measurements.total2.readingM;
    const canonicalAfter=JSON.stringify(P.makeReview(postEditState));
    const evidenceAfter=JSON.stringify(postEditState.evidence);
    const scoreAfter=S.scoreAttempt(P.makeReview(postEditState));
    const reviewStageHidden=d.getElementById('stageReadout').classList.contains('is-hidden');
    w.__freeFallDebug.routeSubmission({activityState:'success'});
    const submissionStageHidden=d.getElementById('stageReadout').classList.contains('is-hidden');
    const resultText=d.getElementById('resultFeedback').textContent;
    const aria=d.getElementById('rulerHandle').getAttribute('aria-label');
    return {
      readings:[partial.measurements.total1.readingM,partial.measurements.total2.readingM],
      used:[partial.measurements.total1.usedTotalPlacement,partial.measurements.total2.usedTotalPlacement],
      partialEvidence:partial.evidence.totalPlacement,
      partialRoundTrip:JSON.stringify(decoded)===JSON.stringify(encoded),
      reviewRoundTrip:JSON.stringify(decodedReview)===JSON.stringify(review),
      evidenceRoundTrip:JSON.stringify(decodedReview.evidence)===evidenceBefore,evidenceBefore,evidenceAfter,
      canonicalBefore,canonicalAfter,score,scoreAfter,editValue,editFocus,editReadonly:d.getElementById('readingInput').readOnly,
      unchangedReading,editStageHidden,reviewStageHidden,submissionStageHidden,reviewText,resultText,aria
    };
  })()`);
  assert.ok(Math.abs(result.readings[0]-.2)<1e-12 && Math.abs(result.readings[1]-.8)<1e-12,
    `${label}: production Record converts the learner's photo-centimeter input once to canonical meters`);
  assert.equal(firstReadout.value, ""); assert.equal(firstReadout.stage, "0.29 cm");
  assert.equal(firstReadout.canonical, .2); assert.equal(firstReadout.stageHidden, false);
  assert.ok(Math.abs(firstReadout.outputY-firstReadout.expectedY)<=1,
    `${label}: stage readout vertical center follows the full-precision measured tick, not the ruler zero`);
  assert.equal(secondReadout.value, ""); assert.equal(secondReadout.stage, "");
  assert.equal(secondReadout.stageHidden, true,
    `${label}: advancing to the next task clears the prior task's stage output`);
  assert.deepEqual(result.used, [true, true], `${label}: both production Record actions retain the valid total placement`);
  assert.ok(result.partialEvidence && result.partialEvidence.mode === "keyboard",
    `${label}: production keyboard placement creates ruler-use evidence`);
  assert.ok(result.partialRoundTrip && result.reviewRoundTrip && result.evidenceRoundTrip,
    `${label}: draft/review encode-decode preserves readings and evidence`);
  assert.match(result.editValue, /^1\.142857/, `${label}: review edit prefills the previous manual photo-centimeter answer`);
  assert.equal(result.editFocus, "measurementTitle", `${label}: measurement review-edit hands focus to its heading`);
  assert.equal(result.unchangedReading, .8,
    `${label}: submitting the exact unchanged review prefill reuses the original canonical reading`);
  assert.equal(result.editReadonly, false);
  assert.ok(result.editStageHidden && result.reviewStageHidden && result.submissionStageHidden,
    `${label}: review-edit, review, and submitted states clear stale stage output`);
  assert.equal(result.canonicalAfter, result.canonicalBefore, `${label}: review/result rendering preserves canonical review JSON`);
  assert.equal(result.evidenceAfter, result.evidenceBefore,
    `${label}: production unchanged review confirmation preserves process evidence exactly`);
  assert.deepEqual(result.scoreAfter, result.score, `${label}: review/result rendering preserves score`);
  assert.match(result.reviewText, /相片上 0\.29 cm/); assert.match(result.reviewText, /相片上 1\.14 cm/);
  assert.match(result.reviewText, /相片上 2\.57 cm/); assert.match(result.reviewText, /相片上 4\.57 cm/);
  assert.match(result.resultText, /相片上/); assert.match(result.resultText, /0\.86/); assert.match(result.resultText, /1\.43/);
  for (const text of [result.reviewText, result.resultText, result.aria]) {
    assert.doesNotMatch(text, /(?:0{8,}|9{8,})\d/, `${label}: normalized learner copy has no IEEE-754 tail`);
  }
}

async function runCrossCtmBoundaryMatrix(cdp, baseUrl, activityPath, label) {
  for (const viewport of [[390, 600, 1], [320, 568, 2], [1280, 720, 1]]) {
    await setViewport(cdp, ...viewport);
    await navigate(cdp, `${baseUrl}${activityPath}?historical-active=${viewport.join("-")}-${encodeURIComponent(label)}`);
    const historicalCases = await evaluate(cdp, `(() => {
      const w=window,P=w.FreeFallPersistence,S=w.FreeFallScoring,results=[];
      const initial=w.__freeFallDebug.rulerLayout(),scale=initial.scaleX;
      const cases=[
        {name:'guide-left-x80',rulerX:80,rulerSide:'left',horizontalMode:'guide-fraction',guideFraction:0,overlap:23,
          expected:80+23/scale},
        {name:'guide-right',rulerX:240,rulerSide:'right',horizontalMode:'guide-fraction',guideFraction:160/205,overlap:23,
          expected:240},
        {name:'boundary-left',rulerX:80-19/scale,rulerSide:'left',horizontalMode:'left-boundary',boundaryOverlapPx:4,overlap:4,
          expected:Math.max(48/scale,80+4/scale)},
        {name:'boundary-right',rulerX:285+19/scale,rulerSide:'right',horizontalMode:'right-boundary',boundaryOverlapPx:4,overlap:4,
          expected:285+19/scale}
      ];
      for(const testCase of cases){
        let state=P.generate(P.assignedState(6));
        const candidate={mode:'keyboard',moveNorm:.03,rulerZeroM:0,rulerX:testCase.rulerX,rulerSide:testCase.rulerSide,
          horizontalMode:testCase.horizontalMode,zeroTickOverlapPx:testCase.overlap,zeroErrorPx:0,
          ...(testCase.horizontalMode==='guide-fraction'?{guideFraction:testCase.guideFraction}:
            {boundaryOverlapPx:testCase.boundaryOverlapPx})};
        state=P.withPlacement(state,{...candidate,rulerGeometry:'fixed-left-v1'});
        delete state.activePlacement.rulerGeometry;
        const historical=JSON.stringify(state);
        w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:state}});
        const restored=w.__freeFallDebug.state(),layout=w.__freeFallDebug.rulerLayout(),
          visible=document.querySelector('[data-ruler-visible-body]').getBoundingClientRect(),
          owner=document.getElementById('rulerHandle').getBoundingClientRect();
        document.getElementById('readingInput').value=String(5/18);
        document.getElementById('recordButton').click();
        const recorded=w.__freeFallDebug.state();
        results.push({name:testCase.name,historical,expected:testCase.expected,layout,placement:restored.activePlacement,
          valid:S.validPlacement(restored.activePlacement,'total'),recorded:recorded.measurements.total1,
          evidence:recorded.evidence.totalPlacement,
          ownerDelta:Math.max(Math.abs(visible.left-owner.left),Math.abs(visible.right-owner.right),
            Math.abs(visible.top-owner.top),Math.abs(visible.bottom-owner.bottom))});
      }
      return results;
    })()`);
    for (const item of historicalCases) {
      assert.doesNotMatch(item.historical, /rulerGeometry/);
      assert.ok(item.valid && item.placement.rulerGeometry === "fixed-left-v1" && item.layout.direction === -1 &&
        Math.abs(item.layout.anchorX-item.expected)<1e-6 && item.recorded?.usedTotalPlacement === true &&
        item.evidence?.rulerGeometry === "fixed-left-v1" && item.ownerDelta <= 1,
      `${label} ${viewport.join("x")}: historical ${item.name} converts from its old tick right endpoint and records legally ${JSON.stringify(item)}`);
    }
  }
  const cases = [
    { kind: "far-left", start: [1280, 720, 1], end: [320, 568, 2] },
    { kind: "far-right", start: [320, 568, 2], end: [1280, 720, 1] }
  ];
  for (const testCase of cases) {
    await setViewport(cdp, ...testCase.start);
    await navigate(cdp, `${baseUrl}${activityPath}?cross-ctm=${testCase.kind}-${encodeURIComponent(label)}`);
    await prepare(cdp);
    await evaluate(cdp, `(() => {
      const d=document,l=__freeFallDebug.rulerLayout(),M=FreeFallModel,
        y=M.geometry(5,440,55,25).metersToY(0),
        desired=${JSON.stringify(testCase.kind)}==="far-left"?80+4/l.scaleX:285+19/l.scaleX;
      __freeFallDebug.setRuler({x:desired-2,y});
      d.getElementById("rulerHandle").focus({preventScroll:true});
    })()`);
    for (let index = 0; index < 8; index += 1) {
      for (const [key, virtualKey] of [["ArrowLeft", 37], ["ArrowRight", 39]]) {
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, modifiers: 8,
          windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, modifiers: 8,
          windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
      }
    }
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight",
      windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight",
      windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
    const draft = await evaluate(cdp, `(() => {
      const s=__freeFallDebug.state(),p=s.activePlacement;
      return {answer:FreeFallPersistence.encode(s),placement:p,
        valid:FreeFallScoring.validPlacement(p,"total")};
    })()`);
    assert.ok(draft.valid && Math.abs(draft.placement.zeroTickOverlapPx - 4) < .02,
      `${label}: ${testCase.kind} begins at the exact 4 CSS px boundary`);

    await setViewport(cdp, ...testCase.end);
    await delay(100);
    const resized = await evaluate(cdp, `(() => {
      const d=document,p=__freeFallDebug.state().activePlacement,
        output=d.getElementById("stageReadout"),stage=d.getElementById("stage"),
        r=output.getBoundingClientRect(),sr=stage.getBoundingClientRect(),
        owner=d.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {placement:p,valid:FreeFallScoring.validPlacement(p,"total"),
        output:{hidden:output.classList.contains("is-hidden"),left:r.left,right:r.right,top:r.top,bottom:r.bottom,
          pointer:getComputedStyle(output).pointerEvents,owner:owner&&owner.id},
        stage:{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom},
        aria:d.getElementById("rulerHandle").getAttribute("aria-label")};
    })()`);
    assert.ok(resized.valid && resized.placement.zeroTickOverlapPx >= 4 - .02,
      `${label}: ${testCase.kind} is reconstructed with a valid clamped overlap after CTM change ${JSON.stringify(resized.placement)}`);
    assert.equal(resized.placement.horizontalMode,
      testCase.kind === "far-left" ? "left-boundary" : "right-boundary");
    assert.ok(!resized.output.hidden && resized.output.left >= resized.stage.left - 1 &&
      resized.output.right <= resized.stage.right + 1 && resized.output.top >= resized.stage.top - 1 &&
      resized.output.bottom <= resized.stage.bottom + 1,
    `${label}: stage output remains clamped inside the stage after ${testCase.kind} CTM reconstruction`);
    assert.equal(resized.output.pointer, "none");
    assert.notEqual(resized.output.owner, "stageReadout",
      `${label}: stage output cannot steal ruler pointer targeting`);
    assert.match(resized.aria, /相片上距離/);

    await directFill(cdp, "#readingInput", "0.2857142857142857");
    await evaluate(cdp, `document.getElementById("recordButton").click()`);
    const resizedRecord = await evaluate(cdp, `(() => {
      const s=__freeFallDebug.state(),e=s.evidence.totalPlacement;
      return {reading:s.measurements.total1,evidence:e,phase:s.phase,active:s.activePlacement,
        input:document.getElementById("readingInput").value,
        error:document.getElementById("measurementError").textContent,
        disabled:document.getElementById("recordButton").disabled};
    })()`);
    assert.ok(resizedRecord.reading && resizedRecord.reading.usedTotalPlacement === true,
      `${label}: resized Record succeeds ${JSON.stringify(resizedRecord)}`);
    assert.ok(Math.abs(resizedRecord.evidence.zeroTickOverlapPx - resized.placement.zeroTickOverlapPx) < .02,
      `${label}: Record uses the current visible resized placement`);

    await navigate(cdp, `${baseUrl}${activityPath}?cross-ctm-reload=${testCase.kind}-${encodeURIComponent(label)}`);
    await evaluate(cdp, `__freeFallDebug.routeStartup("editable",{state:"draft",snapshot:{answer:${JSON.stringify(draft.answer)}}})`);
    const restored = await evaluate(cdp, `(() => {
      const d=document,p=__freeFallDebug.state().activePlacement,o=d.getElementById("stageReadout"),
        r=o.getBoundingClientRect(),s=d.getElementById("stage").getBoundingClientRect();
      return {p,valid:FreeFallScoring.validPlacement(p,"total"),hidden:o.classList.contains("is-hidden"),
        inside:r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1};
    })()`);
    assert.ok(restored.valid && restored.inside && !restored.hidden &&
      restored.p.zeroTickOverlapPx >= 4 - .02,
    `${label}: draft reload reconstructs ${testCase.kind} from its scale-independent anchor`);

    await directFill(cdp, "#readingInput", testCase.kind === "far-left" ? "5" : "0.2857142857142857");
    await evaluate(cdp, `document.getElementById("recordButton").click()`);
    const reloadRecord = await evaluate(cdp, `(() => {
      const s=__freeFallDebug.state(),e=s.evidence.totalPlacement;
      return {reading:s.measurements.total1,evidence:e,
        roundTrip:JSON.stringify(FreeFallPersistence.decode(FreeFallPersistence.encode(s)))===JSON.stringify(s)};
    })()`);
    assert.equal(reloadRecord.reading.usedTotalPlacement, true);
    assert.ok(reloadRecord.roundTrip && reloadRecord.evidence.zeroTickOverlapPx >= 4 - .02,
      `${label}: legal Record after boundary reload preserves current evidence through draft round-trip`);

    if (testCase.kind === "far-right") {
      for (const [action, selector] of [["park", "#parkButton"], ["skip", "#skipButton"]]) {
        await evaluate(cdp, `__freeFallDebug.routeStartup("editable",{state:"draft",snapshot:{answer:${JSON.stringify(draft.answer)}}})`);
        await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)}).click()`);
        assert.equal(await evaluate(cdp, `document.getElementById("stageReadout").classList.contains("is-hidden")`), true,
          `${label}: ${action} clears stale stage output`);
      }
      await evaluate(cdp, `__freeFallDebug.routeStartup("editable",{state:"draft",snapshot:{answer:${JSON.stringify(draft.answer)}}});
        __freeFallDebug.setRuler({x:0,y:__freeFallDebug.ruler().y})`);
      assert.equal(await evaluate(cdp, `document.getElementById("stageReadout").classList.contains("is-hidden")`), true,
        `${label}: invalid placement clears stale stage output`);
      await evaluate(cdp, `__freeFallDebug.routeStartup("editable",{state:"draft",snapshot:{answer:${JSON.stringify(draft.answer)}}});
        window.confirm=()=>true`);
      await evaluate(cdp, `document.querySelector("[data-reset-frequency]").click()`);
      assert.equal(await evaluate(cdp, `document.getElementById("stageReadout").classList.contains("is-hidden")`), true,
        `${label}: reset clears stale stage output`);
      await evaluate(cdp, `__freeFallDebug.routeStartup("load-error",{state:"none"})`);
      assert.equal(await evaluate(cdp, `document.getElementById("stageReadout").classList.contains("is-hidden")`), true,
        `${label}: technical lock clears stale stage output`);
    }

    if (testCase.kind === "far-left") {
      const wrong = await evaluate(cdp, `(() => {
        const P=FreeFallPersistence,S=FreeFallScoring,M=FreeFallModel;
        let state=__freeFallDebug.state();
        const place=(zero)=>({mode:"keyboard",moveNorm:.03,rulerZeroM:zero,rulerX:100,rulerSide:"left",
          rulerGeometry:"fixed-left-v1",horizontalMode:"guide-fraction",guideFraction:20/205,zeroTickOverlapPx:23,zeroErrorPx:0});
        for(let index=1;index<4;index+=1){
          state=P.resolveMeasurement(state,M.displacementAt(5,index+1));
        }
        for(let index=0;index<4;index+=1){
          state=P.withPlacement(state,place(M.displacementAt(5,index)));
          state=P.resolveMeasurement(state,M.intervalDisplacement(5,index+1));
        }
        state=P.setAnalysis(state,{deltaTS:.2,cumulativeTimeRatio:{values:[1,2,3,4]},
          intervalTimeRatio:{values:[1,1,1,1]},lawAnswerId:"square",
          intervalLawAnswerId:"odd",accelerationAnswerId:"constant-acceleration"});
        state=P.enterReview(state);const review=P.makeReview(state),score=S.scoreAttempt(review);
        return {score,measurements:review.measurements,evidence:review.evidence,
          reviewRoundTrip:JSON.stringify(P.decodeReview(JSON.parse(JSON.stringify(review))))===JSON.stringify(review)};
      })()`);
      assert.ok(wrong.score.detail.totalLinks[0] === true,
        `${label}: wrong manual answer retains valid process evidence ${JSON.stringify(wrong)}`);
      assert.equal(wrong.score.detail.totalReadingCorrect[0], false,
        `${label}: valid placement does not make a wrong numeric answer correct`);
      assert.ok(wrong.reviewRoundTrip, `${label}: wrong numeric answer and valid evidence survive review round-trip`);
    }
  }
}

async function runRulerGeometryMatrix(cdp, baseUrl, activityPath, label) {
  for (const [width, height, pageScale] of REQUIRED_VIEWPORTS) {
    await setViewport(cdp, width, height, pageScale);
    await navigate(cdp, `${baseUrl}${activityPath}?ruler-geometry=${width}-${height}-${pageScale}-${encodeURIComponent(label)}`);
    const setupNotation = await evaluate(cdp, `(() => {
      const d=document,sup=d.querySelector('.camera-note sup'),supBase=sup.parentElement,
        supBlock=sup.closest('p'),unit=sup.closest('.unit'),panel=d.getElementById('controlPanel'),
        expression=d.querySelector('.camera-note .math-expression'),operator=expression.querySelector('.operator'),
        variable=expression.querySelector('var'),value=expression.querySelector('.value');
      sup.scrollIntoView({block:'center'});
      const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const operatorStyle=getComputedStyle(operator);
      return {sup:rect(sup),supBase:rect(supBase),supBlock:rect(supBlock),
        panel:rect(panel),supAlign:getComputedStyle(sup).verticalAlign,blockOverflow:getComputedStyle(supBlock).overflow,
        unitStyle:getComputedStyle(unit).fontStyle,operator:rect(operator),variable:rect(variable),value:rect(value),unit:rect(unit),
        operatorPadding:{left:parseFloat(operatorStyle.paddingLeft),right:parseFloat(operatorStyle.paddingRight)}};
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
    assert.ok(setupNotation.operatorPadding.left >= 1 && setupNotation.operatorPadding.right >= 1 &&
      setupNotation.operator.width > setupNotation.operatorPadding.left + setupNotation.operatorPadding.right &&
      setupNotation.unit.left - setupNotation.value.right >= 2,
    `${label} ${width}x${height}@${pageScale}: rendered operator/value/unit spacing remains visible ${JSON.stringify(setupNotation)}`);
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
        const targetY=M.geometry(5,440,55,25).metersToY(M.displacementAt(5,${pointIndex}));
        const before=w.__freeFallDebug.rulerLayout(),
          rulerX=[80+4/before.scaleX,100,240,285+19/before.scaleX][${pointIndex}];
        w.__freeFallDebug.setRuler({x:rulerX,y:targetY});
        const body=d.querySelector('[data-ruler-body]'),visible=d.querySelector('[data-ruler-visible-body]'),
          handle=d.getElementById('rulerHandle'),stage=d.getElementById('stage'),scene=d.getElementById('scene'),
          ball=d.querySelector('[data-stamp="0"]'),layout=w.__freeFallDebug.rulerLayout(),matrix=scene.getScreenCTM(),
          inverse=matrix.inverse();
        const pointLabels=[...d.querySelectorAll('[data-point-label]')],
          rulerLabels=[...d.querySelectorAll('[data-ruler-label-cm]')],
          unitNode=d.querySelector('[data-ruler-unit]'),
          fineTick=d.querySelector('[data-ruler-tick][data-tick-kind="fine"]');
        const br=body.getBoundingClientRect(),vr=visible.getBoundingClientRect(),hr=handle.getBoundingClientRect(),
          sr=stage.getBoundingClientRect(),cr=ball.getBoundingClientRect();
        const svgPoint=scene.createSVGPoint();svgPoint.x=123;svgPoint.y=234;
        const clientPoint=svgPoint.matrixTransform(matrix),roundTrip=clientPoint.matrixTransform(inverse);
        const zeroPoint=scene.createSVGPoint();zeroPoint.x=layout.anchorX;zeroPoint.y=targetY;
        const zeroClient=zeroPoint.matrixTransform(matrix);
        const viewTopLeft=(()=>{const p=scene.createSVGPoint();p.x=0;p.y=0;return p.matrixTransform(matrix)})(),
          viewBottomRight=(()=>{const p=scene.createSVGPoint();p.x=360;p.y=440;return p.matrixTransform(matrix)})();
        const samples=[[hr.left+2,hr.top+2],[hr.left+hr.width/2,hr.top+2],[hr.right-2,hr.top+hr.height/2],
          [hr.left+2,hr.bottom-2],[hr.left+hr.width/2,hr.bottom-2]];
        return {targetY,rulerX:layout.anchorX,zeroClientX:zeroClient.x,layout,body:{left:br.left,top:br.top,right:br.right,bottom:br.bottom},
          visible:{left:vr.left,top:vr.top,right:vr.right,bottom:vr.bottom,width:vr.width,height:vr.height},
          handle:{left:hr.left,top:hr.top,right:hr.right,bottom:hr.bottom,width:hr.width,height:hr.height},
          stage:{left:sr.left,top:sr.top,right:sr.right,bottom:sr.bottom},
          view:{left:viewTopLeft.x,top:viewTopLeft.y,right:viewBottomRight.x,bottom:viewBottomRight.y},
          circle:{width:cr.width,height:cr.height},scale:{x:Math.hypot(matrix.a,matrix.b),y:Math.hypot(matrix.c,matrix.d)},
          pointLabelHeights:pointLabels.map(node=>node.getBoundingClientRect().height),
          rulerLabelHeights:rulerLabels.map(node=>node.getBoundingClientRect().height),
          unitHeight:unitNode.getBoundingClientRect().height,
          unitRect:(()=>{const r=unitNode.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}})(),
          unitSvg:{x:Number(unitNode.getAttribute('x')),y:Number(unitNode.getAttribute('y'))},
          unitWeight:Number(getComputedStyle(unitNode).fontWeight),
          tickXs:[...d.querySelectorAll('[data-ruler-tick]')].map(node=>({x1:Number(node.getAttribute('x1')),x2:Number(node.getAttribute('x2'))})),
          labelRects:rulerLabels.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}),
          strokes:{body:parseFloat(getComputedStyle(body).strokeWidth)*Math.hypot(matrix.a,matrix.b),
            tick:parseFloat(getComputedStyle(fineTick).strokeWidth)*Math.hypot(matrix.a,matrix.b)},
          roundTrip:{x:roundTrip.x,y:roundTrip.y},owners:samples.map(([x,y])=>d.elementFromPoint(x,y)?.id),
          units:[...d.querySelectorAll('[data-ruler-unit]')].map(node=>node.textContent),
          tickKinds:[...d.querySelectorAll('[data-ruler-tick]')].map(node=>[Number(node.dataset.tickCm),node.dataset.tickKind]),
          labels:[...d.querySelectorAll('[data-ruler-label-cm]')].map(node=>Number(node.dataset.rulerLabelCm)),
          preserveMeet:scene.getAttribute('preserveAspectRatio')==='xMidYMid meet',
          magnifiers:d.querySelectorAll('[id*="magnifier"],.magnifier').length};
      })()`);
      const delta = (a, b) => Math.abs(a - b);
      assert.ok(geometry.preserveMeet, `${label} ${width}x${height}@${pageScale}: SVG uses explicit uniform meet scaling`);
      assert.ok(delta(geometry.scale.x, geometry.scale.y) <= .01,
        `${label} ${width}x${height}@${pageScale}: screen CTM is uniform ${JSON.stringify(geometry.scale)}`);
      assert.ok(delta(geometry.circle.width, geometry.circle.height) <= 1,
        `${label} ${width}x${height}@${pageScale}: rendered ball remains circular ${JSON.stringify(geometry.circle)}`);
      assert.ok(geometry.circle.width >= 17.9,
        `${label} ${width}x${height}@${pageScale}: rendered ball remains screen-legible ${JSON.stringify(geometry.circle)}`);
      assert.ok(geometry.pointLabelHeights.length === 5 && geometry.pointLabelHeights.every((value) => value >= 9.9),
        `${label} ${width}x${height}@${pageScale}: every P label is at least 10 CSS px ${JSON.stringify(geometry.pointLabelHeights)}`);
      assert.ok(geometry.rulerLabelHeights.length === 6 && geometry.rulerLabelHeights.every((value) => value >= 15.9),
        `${label} ${width}x${height}@${pageScale}: every ruler numeral is at least 16 CSS px ${JSON.stringify(geometry.rulerLabelHeights)}`);
      assert.ok(geometry.unitHeight >= 17.9 && geometry.unitWeight >= 700 &&
        geometry.strokes.body >= .99 && geometry.strokes.tick >= .99,
        `${label} ${width}x${height}@${pageScale}: ruler unit and strokes meet screen-space minimums ${JSON.stringify({
          unitHeight:geometry.unitHeight,strokes:geometry.strokes})}`);
      assert.ok(delta((geometry.unitRect.left+geometry.unitRect.right)/2,
        (geometry.body.left+geometry.body.right)/2)<=1,
      `${label} ${width}x${height}@${pageScale}: cm is centered in the full ruler body`);
      assert.ok(delta(geometry.unitSvg.y,
        geometry.layout.zeroY+geometry.layout.tickSpan*.3/5)<=1e-9,
      `${label} ${width}x${height}@${pageScale}: cm baseline uses the fixed 0.3 cm contract`);
      const intersects = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert.ok(geometry.labelRects.every((rect)=>!intersects(geometry.unitRect,rect)),
        `${label} ${width}x${height}@${pageScale}: centered cm remains disjoint from every numeral ${JSON.stringify({unit:geometry.unitRect,labels:geometry.labelRects,layout:geometry.layout})}`);
      assert.ok(delta(geometry.roundTrip.x, 123) <= .001 && delta(geometry.roundTrip.y, 234) <= .001,
        `${label} ${width}x${height}@${pageScale}: CTM inverse round-trips SVG/client coordinates`);
      assert.ok(geometry.view.left >= geometry.stage.left - 1 && geometry.view.right <= geometry.stage.right + 1 &&
        geometry.view.top >= geometry.stage.top - 1 && geometry.view.bottom <= geometry.stage.bottom + 1,
      `${label} ${width}x${height}@${pageScale}: aspect-preserved viewBox remains inside the stage`);
      assert.ok(delta(geometry.visible.left, geometry.handle.left) <= 1 && delta(geometry.visible.top, geometry.handle.top) <= 1 &&
        delta(geometry.visible.right, geometry.handle.right) <= 1 && delta(geometry.visible.bottom, geometry.handle.bottom) <= 1,
      `${label} ${width}x${height}@${pageScale} P${pointIndex}: owner matches the actual visible ruler intersection ${JSON.stringify(geometry)}`);
      assert.ok(geometry.handle.width >= 43.99,
        `${label} ${width}x${height}@${pageScale} P${pointIndex}: visible drag width is at least 44 CSS px ${JSON.stringify(geometry)}`);
      assert.ok(geometry.owners.every((owner) => owner === "rulerHandle"),
        `${label} ${width}x${height}@${pageScale} P${pointIndex}: visible ruler has no dead drag zone ${JSON.stringify(geometry.owners)}`);
      assert.deepEqual(geometry.units, ["cm"], `${label}: ruler shows one upright centimeter unit`);
      assert.equal(geometry.magnifiers, 0, `${label}: ruler magnifier is absent`);
      assert.ok(geometry.zeroClientX - geometry.body.left >= 43 &&
        Math.abs(geometry.body.right-geometry.zeroClientX)<=1,
      `${label} ${width}x${height}@${pageScale} P${pointIndex}: body remains left of the fixed right spine`);
      assert.ok(geometry.tickXs.every(({x1,x2})=>x1===geometry.rulerX&&x2<=x1) &&
        geometry.labelRects.every((rect)=>rect.right<=geometry.zeroClientX+1),
      `${label} ${width}x${height}@${pageScale} P${pointIndex}: all ticks and numerals remain left of the spine`);
      assert.ok(Math.abs(geometry.layout.zeroY - geometry.targetY) < 1e-9,
        `${label} P${pointIndex}: zero tick remains aligned to the requested point`);
      assert.ok((geometry.layout.zeroY - geometry.layout.fullTop) * geometry.scale.y >= 27.9);
      assert.equal(geometry.layout.fullBottom - (geometry.layout.zeroY + geometry.layout.tickSpan), 12);
      if (pointIndex > 0) assert.ok(geometry.body.bottom > geometry.stage.bottom,
        `${label} P${pointIndex}: full ruler body may clip below the stage`);
      const tickMap = new Map(geometry.tickKinds);
      assert.equal(geometry.tickKinds.length, 51, `${label}: conventional ruler has both endpoints and 49 interior ticks`);
      assert.equal(tickMap.get(.1), "fine"); assert.equal(tickMap.get(.5), "medium"); assert.equal(tickMap.get(1), "major");
      assert.deepEqual(geometry.labels, [0, 1, 2, 3, 4, 5], `${label}: every whole photograph centimeter is numbered`);
    }
    const readouts = await evaluate(cdp, `(() => {
      const w=window,d=document,P=w.FreeFallPersistence,S=w.FreeFallScoring,M=w.FreeFallModel,results=[];
      const placement=(task,zero)=>({mode:'keyboard',moveNorm:.03,rulerZeroM:zero,rulerX:100,rulerSide:'left',
        rulerGeometry:'fixed-left-v1',horizontalMode:'guide-fraction',guideFraction:20/205,
        zeroTickOverlapPx:23,zeroErrorPx:0});
      for(const area of ['total','gap'])for(let index=0;index<4;index+=1){
        let state=P.generate(P.assignedState(5)),task;
        if(area==='total'){
          for(let prior=0;prior<index;prior+=1)state=P.resolveMeasurement(state,null,true);
          task='total';
        }else{
          for(let total=0;total<4;total+=1)state=P.resolveMeasurement(state,null,true);
          for(let prior=0;prior<index;prior+=1)state=P.resolveMeasurement(state,null,true);
          task=S.GAP_KEYS[index];
        }
        const start=area==='total'?0:M.displacementAt(5,index);
        state=P.withPlacement(state,placement(task,start));
        w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:state}});
        const handle=d.getElementById('rulerHandle');handle.focus({preventScroll:true});
        for(const key of ['ArrowRight','ArrowLeft'])handle.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
        const output=d.getElementById('stageReadout'),scene=d.getElementById('scene'),or=output.getBoundingClientRect(),
          measuredY=Number(output.dataset.measuredY),measured=scene.createSVGPoint();measured.x=0;
        let expectedY=NaN;if(Number.isFinite(measuredY)){measured.y=measuredY;expectedY=measured.matrixTransform(scene.getScreenCTM()).y;}
        const protectedNodes=[...scene.querySelectorAll(
          '[data-stamp],[data-point-label],[data-ruler-body],[data-ruler-tick],[data-ruler-label-cm],[data-ruler-unit]')];
        const collisions=protectedNodes.filter(node=>{const r=node.getBoundingClientRect();
          return or.left<r.right&&or.right>r.left&&or.top<r.bottom&&or.bottom>r.top;})
          .map(node=>node.dataset.stamp??node.dataset.pointLabel??node.dataset.rulerLabelCm??node.dataset.rulerUnit??node.dataset.rulerBody??node.dataset.rulerTick);
        results.push({area,index,hidden:output.classList.contains('is-hidden'),collisions,
          centerY:(or.top+or.bottom)/2,expectedY,text:output.textContent,
          input:d.getElementById('readingInput').value,placement:w.__freeFallDebug.state().activePlacement,
          status:d.getElementById('placementStatus').textContent,aria:d.getElementById('rulerHandle').getAttribute('aria-label')});
      }
      return results;
    })()`);
    assert.ok(readouts.every((item)=>!item.hidden && item.collisions.length===0 &&
      Math.abs(item.centerY-item.expectedY)<=1 && item.input===""),
    `${label} ${width}x${height}@${pageScale}: every task readout keeps exact measured-y and avoids apparatus ${JSON.stringify(readouts)}`);
    if(width===320&&height===500&&pageScale===1){
      assert.deepEqual(readouts[0].collisions, [],
        `${label}: 320x500 total1 x100 readout is fully disjoint`);
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
    const setupControls = await evaluate(cdp, `(() => {
      const assigned=document.getElementById('assignedFrequency'),button=document.getElementById('generateButton'),
        rect=button.getBoundingClientRect();
      return {assigned:assigned.textContent,button:{width:rect.width,height:rect.height},frequencyButtons:
        document.querySelectorAll('[data-frequency]').length};
    })()`);
    await prepare(cdp);
    const snapshot = await evaluate(cdp, `(() => {
      const d=document.documentElement,b=document.body,a=document.querySelector('.freefall-app'),p=document.getElementById('controlPanel');
      p.scrollTop=p.scrollHeight;a.scrollTop=100;
      const last=p.querySelector('[data-reset-frequency]').getBoundingClientRect(),pr=p.getBoundingClientRect(),
        actions=p.querySelector('#measurementSection .phase-actions').getBoundingClientRect();
      return {docRange:d.scrollHeight-d.clientHeight,bodyRange:b.scrollHeight-b.clientHeight,
        appRange:a.scrollHeight-a.clientHeight,appScroll:a.scrollTop,horizontal:Math.max(d.scrollWidth-d.clientWidth,b.scrollWidth-b.clientWidth),
        panelRange:p.scrollHeight-p.clientHeight,panelBottom:p.scrollTop,buttonReachable:last.bottom<=pr.bottom+1,
        resetGap:last.top-actions.bottom,
        visual:visualViewport?{scale:visualViewport.scale,width:visualViewport.width,height:visualViewport.height}:null};
    })()`);
    assert.ok(snapshot.docRange <= 1 && snapshot.bodyRange <= 1 && snapshot.appScroll === 0,
      `${label} ${width}x${height}: activity document is not a third vertical owner ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.horizontal <= 1, `${label} ${width}x${height}: no horizontal overflow`);
    assert.ok(snapshot.panelRange > 0 && snapshot.panelBottom >= snapshot.panelRange - 1 && snapshot.buttonReachable,
      `${label} ${width}x${height}: independently scrolling panel reaches its true bottom`);
    assert.ok(setupControls.assigned.includes("Hz") && setupControls.frequencyButtons === 0 &&
      setupControls.button.height >= 44 && setupControls.button.width > 0,
    `${label} ${width}x${height}: random assignment replaces frequency controls and retains a 44px capture target`);
    assert.ok(snapshot.resetGap >= 11.9,
      `${label} ${width}x${height}: destructive reset is separated from primary actions by at least 12px ${snapshot.resetGap}`);
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
    d.getElementById('controlPanel').scrollTop=0;
    w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:w.FreeFallPersistence.assignedState(4)}});
    d.getElementById('generateButton').click()})()`);
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
    await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document;
      w.__freeFallDebug.routeStartup('editable',{state:'draft',snapshot:{answer:w.FreeFallPersistence.assignedState(4)}});
      d.getElementById('generateButton').click()})()`);
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
  await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow;
    w.__freeFallDebug.setRuler({x:250,y:w.__freeFallDebug.ruler().y})})()`);
  let crossStart = await pointAt(cdp, "#rulerHandle", .5, .5);
  const beforeCrossTouch = await snapshot(cdp);
  await swipe(cdp, crossStart, { x: crossStart.x - 150, y: crossStart.y });
  const afterCrossTouch = await snapshot(cdp);
  let crossGeometry = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,
    l=w.__freeFallDebug.rulerLayout();return {direction:l.direction,x:w.__freeFallDebug.ruler().x,
      ticks:[...d.querySelectorAll('[data-ruler-tick]')].every(n=>+n.getAttribute('x1')>=+n.getAttribute('x2'))}})()`);
  assert.ok(beforeCrossTouch.ruler !== afterCrossTouch.ruler && crossGeometry.x < 182.5 &&
    crossGeometry.direction === -1 && crossGeometry.ticks,
  `${label}: trusted touch crosses the midpoint without flipping the fixed-left ruler`);
  zeroDelta(beforeCrossTouch, afterCrossTouch,
    ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel"], `${label}: cross-midline touch`);
  crossStart = await pointAt(cdp, "#rulerHandle", .5, .5);
  const beforeCrossMouse = await snapshot(cdp);
  await mouseDrag(cdp, crossStart, { x: crossStart.x + 150, y: crossStart.y });
  const afterCrossMouse = await snapshot(cdp);
  crossGeometry = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,
    l=w.__freeFallDebug.rulerLayout();return {direction:l.direction,x:w.__freeFallDebug.ruler().x,
      ticks:[...d.querySelectorAll('[data-ruler-tick]')].every(n=>+n.getAttribute('x1')>=+n.getAttribute('x2'))}})()`);
  assert.ok(beforeCrossMouse.ruler !== afterCrossMouse.ruler && crossGeometry.x > 182.5 &&
    crossGeometry.direction === -1 && crossGeometry.ticks,
  `${label}: trusted mouse crosses the midpoint without flipping the fixed-left ruler`);
  zeroDelta(beforeCrossMouse, afterCrossMouse,
    ["host", "hostViewport", "iframe", "activity", "activityViewport", "panel"], `${label}: cross-midline mouse`);
  await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow;
    w.__freeFallDebug.setRuler({x:150,y:w.__freeFallDebug.ruler().y})})()`);
  const clampStart = await pointAt(cdp, "#rulerHandle", .5, .5);
  await swipe(cdp, clampStart, { x: 2, y: clampStart.y });
  let clampGeometry = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,
    l=w.__freeFallDebug.rulerLayout(),v=d.querySelector('[data-ruler-visible-body]').getBoundingClientRect(),
    h=d.getElementById('rulerHandle').getBoundingClientRect();return {anchorCss:l.anchorX*l.scaleX,width:v.width,
      delta:Math.max(Math.abs(v.left-h.left),Math.abs(v.right-h.right),Math.abs(v.top-h.top),Math.abs(v.bottom-h.bottom))}})()`);
  assert.ok(clampGeometry.anchorCss>=47.9&&clampGeometry.width>=47.9&&clampGeometry.delta<=1,
    `${label}: trusted drag clamps the fixed-right spine without a phantom owner ${JSON.stringify(clampGeometry)}`);
  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('rulerHandle').focus({preventScroll:true})");
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft",
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft",
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  clampGeometry = await evaluate(cdp, `(() => {const w=document.getElementById('activity').contentWindow,d=w.document,
    l=w.__freeFallDebug.rulerLayout(),v=d.querySelector('[data-ruler-visible-body]').getBoundingClientRect(),
    h=d.getElementById('rulerHandle').getBoundingClientRect();return {anchorCss:l.anchorX*l.scaleX,width:v.width,
      delta:Math.max(Math.abs(v.left-h.left),Math.abs(v.right-h.right),Math.abs(v.top-h.top),Math.abs(v.bottom-h.bottom))}})()`);
  assert.ok(clampGeometry.anchorCss>=47.9&&clampGeometry.width>=47.9&&clampGeometry.delta<=1,
    `${label}: trusted keyboard movement respects the same visible ruler clamp ${JSON.stringify(clampGeometry)}`);
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

  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('rulerHandle').focus({preventScroll:true})");
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight",
    windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight",
    windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  const cancelPoint = await pointAt(cdp, "#rulerHandle", .5, .5);
  const beforeCancel = await snapshot(cdp);
  await evaluate(cdp, "document.getElementById('activity').contentWindow.document.getElementById('readingInput').value='2.34'");
  await touch(cdp, "touchStart", cancelPoint.x, cancelPoint.y);
  await touch(cdp, "touchMove", cancelPoint.x + 30, cancelPoint.y + 15);
  const duringDrag = await evaluate(cdp, `(() => {
    const w=document.getElementById('activity').contentWindow,d=w.document,before=JSON.stringify(w.__freeFallDebug.state());
    const readout={value:d.getElementById('readingInput').value,disabled:d.getElementById('recordButton').disabled,
      stageHidden:d.getElementById('stageReadout').classList.contains('is-hidden')};
    d.getElementById('recordButton').click();
    return {...readout,stateUnchanged:JSON.stringify(w.__freeFallDebug.state())===before,
      error:d.getElementById('measurementError').textContent};
  })()`);
  assert.equal(duringDrag.value, "2.34", `${label}: active drag does not alter the learner's transient manual input`);
  assert.ok(!duringDrag.disabled && duringDrag.stageHidden && duringDrag.stateUnchanged && /完成移尺/.test(duringDrag.error),
    `${label}: Record fails closed throughout an active drag ${JSON.stringify(duringDrag)}`);
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
    await runAssignmentCheckpointMatrix(cdp, baseUrl, activityPath, label);
    await runPersistedFrequencyResetMatrix(cdp, baseUrl, activityPath, label);
    await runAnimationMatrix(cdp, baseUrl, activityPath, label);
    await runUnitNotationMatrix(cdp, baseUrl, activityPath, label);
    await runFrequencyPhaseOutcomeMatrix(cdp, baseUrl, activityPath, label);
    await runRealInputPath(cdp, baseUrl, activityPath, label);
    await runCrossCtmBoundaryMatrix(cdp, baseUrl, activityPath, label);
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
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const nativeRandom=Math.random;let calls=0;
      Math.random=()=>{const forced=new URLSearchParams(location.search).get('forced-rng');
        if(forced===null)return nativeRandom();calls+=1;return Number(forced)};
      Object.defineProperty(window,'__freeFallRngCalls',{configurable:false,get:()=>calls});
    })()` });
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
