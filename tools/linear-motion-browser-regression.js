#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  CdpClient,
  buildAndExtractPackage,
  closeServer,
  createServer,
  delay,
  devToolsPort,
  evaluate,
  fetchJson,
  findBrowser,
  listenServer,
  stopChrome,
  validateOwnedDirectory,
  withTimeout
} = require("./position-time-browser-regression.js");

const slug = "linear-motion-velocity-lab";
const packagePrefix = "simlab-linear-motion-package-";
const profilePrefix = "simlab-linear-motion-chrome-";
const packagePattern = /^simlab-linear-motion-package-[A-Za-z0-9]+$/;
const profilePattern = /^simlab-linear-motion-chrome-[A-Za-z0-9]+$/;

function formatError(error, indent = "") {
  const own = `${indent}${error.stack || error.message || String(error)}`;
  if (!(error instanceof AggregateError)) return own;
  return `${own}\n${Array.from(error.errors, (nested) => formatError(nested, `${indent}  `)).join("\n")}`;
}

function removeOwned(directory, tempRoot, pattern, label) {
  if (!directory || !fs.existsSync(directory)) return;
  const exact = validateOwnedDirectory(directory, tempRoot, pattern, label);
  fs.rmSync(exact, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
  if (fs.existsSync(exact)) throw new Error(`${label} cleanup did not remove ${exact}`);
}

async function waitForActivity(cdp) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = await evaluate(cdp, "document.readyState === 'complete' && document.getElementById('stageTitle')?.textContent === '勻速運動' && Boolean(window.LinearMotionUiPolicy)");
    if (ready) return;
    await delay(50);
  }
  throw new Error("Linear-motion production activity did not finish rendering.");
}

async function runLearnerFlow(cdp, baseUrl, activityPath) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=production-flow` });
  await waitForActivity(cdp);
  const result = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, label, timeout = 5000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error(label + ' timed out');
        await wait(25);
      }
    };
    const setValue = (element, value) => {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const fillMeasurement = (relationship) => {
      setValue(document.getElementById('displacementInput'), '0');
      setValue(document.getElementById('timeInput'), '0');
      setValue(document.getElementById('averageInput'), '0');
      const relation = document.querySelector('input[name="relationship"][value="' + relationship + '"]');
      relation.checked = true;
      relation.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('measurementForm').requestSubmit();
    };
    const tangentPixels = () => {
      const canvas = document.getElementById('motionCanvas');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const graphTop = canvas.clientHeight < 260 ? 78 : 125;
      const firstGraphRow = Math.floor(graphTop * canvas.height / canvas.clientHeight);
      let count = 0;
      for (let index = firstGraphRow * canvas.width * 4; index < data.length; index += 4) {
        if (data[index] > 190 && data[index] < 245 && data[index + 1] < 65 && data[index + 2] < 65 && data[index + 3] > 200) count += 1;
      }
      return count;
    };
    const pageAssets = {
      scripts: Array.from(document.scripts, (script) => script.src).filter(Boolean),
      styles: Array.from(document.styleSheets, (sheet) => sheet.href).filter(Boolean)
    };

    document.getElementById('observeButton').click();
    await waitFor(() => !document.getElementById('timerButton').disabled, 'uniform observation');
    document.getElementById('timerButton').click();
    const uniformPositions = [];
    for (let index = 0; index < 18; index += 1) {
      await wait(100);
      uniformPositions.push(Number.parseFloat(document.getElementById('positionReadout').textContent));
    }
    await waitFor(() => !document.getElementById('timerButton').disabled, 'uniform minimum duration');
    document.getElementById('timerButton').click();
    await waitFor(() => !document.getElementById('measurementForm').classList.contains('is-hidden'), 'uniform measurement form');
    fillMeasurement('yes');
    await waitFor(() => document.getElementById('stageTitle').textContent === '變速運動', 'variable stage');

    document.getElementById('observeButton').click();
    await waitFor(() => !document.getElementById('timerButton').disabled, 'variable observation');
    document.getElementById('timerButton').click();
    await wait(5300);
    await waitFor(() => !document.getElementById('timerButton').disabled, 'variable minimum duration');
    document.getElementById('timerButton').click();
    await waitFor(() => !document.getElementById('measurementForm').classList.contains('is-hidden'), 'variable measurement form');
    fillMeasurement('no');
    await waitFor(() => document.getElementById('stageTitle').textContent === '時間放大鏡', 'instant stage');

    for (let count = 1; count <= 4; count += 1) {
      document.getElementById('shorterWindowButton').click();
      await waitFor(() => document.querySelectorAll('#windowRows tr').length === count, 'analysis window ' + count);
    }
    const prediction = document.querySelector('input[name="prediction"]');
    prediction.checked = true;
    prediction.dispatchEvent(new Event('change', { bubbles: true }));
    const concept = document.querySelector('input[name="concept"][value="limit"]');
    concept.checked = true;
    concept.dispatchEvent(new Event('change', { bubbles: true }));
    setValue(document.getElementById('stoppedInput'), '0');
    document.getElementById('instantForm').requestSubmit();
    await waitFor(() => !document.getElementById('reviewSection').classList.contains('is-hidden'), 'pre-submit review');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const preSubmit = {
      tangentPixels: tangentPixels(),
      revealHidden: document.getElementById('revealCard').classList.contains('is-hidden'),
      leakedCopy: /模型在目標時刻的瞬時速度是|已揭示目標點切線|已揭示該點切線/.test(document.body.innerText),
      reviewVisible: !document.getElementById('reviewSection').classList.contains('is-hidden')
    };
    const reviewSnapshot = JSON.parse(window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').at(-1).value);
    document.querySelector('[data-edit="2"]').click();
    await waitFor(() => document.getElementById('stageTitle').textContent === '時間放大鏡' && !document.getElementById('activitySection').classList.contains('is-hidden'), 'review edit');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const reviewEdit = {
      tangentPixels: tangentPixels(),
      revealHidden: document.getElementById('revealCard').classList.contains('is-hidden'),
      leakedCopy: /模型在目標時刻的瞬時速度是|已揭示目標點切線|已揭示該點切線/.test(document.body.innerText),
      selectedPrediction: Boolean(document.querySelector('input[name="prediction"]:checked'))
    };
    return {
      pageAssets,
      runtimeReady: Boolean(window.SimScorm && window.SimActivityFlow && window.LinearMotionModel && window.LinearMotionUiPolicy && window.LinearMotionPersistence),
      uniformPositions,
      preSubmit,
      reviewEdit,
      rowCount: document.querySelectorAll('#windowRows tr').length,
      reviewSnapshot
    };
  })()`);

  assert.equal(result.runtimeReady, true, "packaged production runtime executed");
  assert(result.pageAssets.scripts.some((src) => src.endsWith(`/${slug}/main.js`)), "packaged production main.js loaded");
  assert(result.pageAssets.scripts.some((src) => src.endsWith(`/${slug}/ui-policy.js`)), "packaged production UI policy loaded");
  assert(result.pageAssets.scripts.some((src) => src.endsWith("/shared/scorm.js")), "packaged SCORM runtime loaded");
  assert(result.pageAssets.styles.some((href) => href.endsWith(`/${slug}/styles.css`)), "packaged activity stylesheet loaded");
  assert(result.uniformPositions.every(Number.isFinite), "live position samples are numeric");
  for (let index = 1; index < result.uniformPositions.length; index += 1) {
    assert(result.uniformPositions[index] >= result.uniformPositions[index - 1], "displayed position never moves backward while crossing ruler ranges");
  }
  assert.equal(result.preSubmit.reviewVisible, true, "full production flow reaches pre-submit review");
  assert.equal(result.preSubmit.tangentPixels, 0, "pre-submit canvas contains no correct tangent pixels");
  assert.equal(result.preSubmit.revealHidden, true, "pre-submit reveal card remains hidden");
  assert.equal(result.preSubmit.leakedCopy, false, "pre-submit review exposes no solution copy");
  assert.equal(result.reviewEdit.tangentPixels, 0, "returning to edit contains no correct tangent pixels");
  assert.equal(result.reviewEdit.revealHidden, true, "review edit keeps reveal card hidden");
  assert.equal(result.reviewEdit.leakedCopy, false, "review edit exposes no solution copy");
  assert.equal(result.reviewEdit.selectedPrediction, true, "review edit restores the learner's answer without revealing correctness");
  assert.equal(result.rowCount, 4, "all four analysis windows remain visible after review edit");
  return { summary: "uniform→variable→instant→review→edit completed without solution leakage", reviewSnapshot: result.reviewSnapshot };
}

async function runTimingPerformance(cdp, baseUrl, activityPath) {
  const commitDelayMs = 180;
  const preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const values = {
      'cmi.core.lesson_status': 'incomplete',
      'cmi.suspend_data': '',
      'cmi.core.score.raw': ''
    };
    const calls = { commits: 0, commitTimes: [], finishes: 0 };
    const block = (milliseconds) => {
      const end = performance.now() + milliseconds;
      while (performance.now() < end) {}
    };
    window.__timingLms = { values, calls, commitDelayMs: ${commitDelayMs} };
    window.API = {
      LMSInitialize: () => 'true',
      LMSFinish: () => { calls.finishes += 1; return 'true'; },
      LMSCommit: () => {
        calls.commits += 1;
        calls.commitTimes.push(performance.now());
        block(${commitDelayMs});
        return 'true';
      },
      LMSGetValue: (key) => values[key] || '',
      LMSSetValue: (key, value) => { values[key] = String(value); return 'true'; },
      LMSGetLastError: () => '0',
      LMSGetErrorString: () => ''
    };
  })();` });
  try {
    const cases = [
      { name: "desktop", metrics: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, includeVariable: false },
      { name: "mobile-dpr2", metrics: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, includeVariable: true }
    ];
    const summaries = [];
    for (const testCase of cases) {
      await cdp.send("Emulation.setDeviceMetricsOverride", testCase.metrics);
      await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=slow-lms-${testCase.name}` });
      await waitForActivity(cdp);
      const result = await evaluate(cdp, `(async () => {
        const includeVariable = ${testCase.includeVariable};
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const waitFor = async (predicate, label, timeout = 8000) => {
          const started = performance.now();
          while (!predicate()) {
            if (performance.now() - started > timeout) throw new Error(label + ' timed out');
            await wait(20);
          }
        };
        const interaction = async (id) => {
          await nextFrame();
          const commitsBefore = window.__timingLms.calls.commits;
          const started = performance.now();
          document.getElementById(id).click();
          const handlerMs = performance.now() - started;
          await nextFrame();
          return {
            handlerMs,
            firstFrameMs: performance.now() - started,
            immediateCommits: window.__timingLms.calls.commits - commitsBefore
          };
        };
        const measureStage = async (minimumWait) => {
          const frameGaps = [];
          let lastFrame = performance.now();
          let frameId = 0;
          const sample = (timestamp) => {
            frameGaps.push(timestamp - lastFrame);
            lastFrame = timestamp;
            frameId = requestAnimationFrame(sample);
          };
          frameId = requestAnimationFrame(sample);
          const commitsBefore = window.__timingLms.calls.commits;
          const positionBefore = Number.parseFloat(document.getElementById('positionReadout').textContent);
          const observe = await interaction('observeButton');
          await waitFor(() => !document.getElementById('timerButton').disabled, 'timer enable');
          await wait(120);
          const positionAfter = Number.parseFloat(document.getElementById('positionReadout').textContent);
          const start = await interaction('timerButton');
          await waitFor(() => document.getElementById('timerButton').textContent === '停止計時', 'timer start render');
          await wait(minimumWait);
          await waitFor(() => !document.getElementById('timerButton').disabled, 'minimum duration');
          const stop = await interaction('timerButton');
          await waitFor(() => !document.getElementById('measurementForm').classList.contains('is-hidden'), 'captured form');
          await wait(120);
          cancelAnimationFrame(frameId);
          frameGaps.sort((a, b) => a - b);
          const commitsBeforePause = window.__timingLms.calls.commits;
          const pause = await interaction('pauseButton');
          return {
            observe,
            start,
            stop,
            pause,
            positionBefore,
            positionAfter,
            runningCommits: commitsBeforePause - commitsBefore,
            maxFrameGap: frameGaps.at(-1) || 0,
            p95FrameGap: frameGaps[Math.max(0, Math.ceil(frameGaps.length * .95) - 1)] || 0
          };
        };
        const fillMeasurement = (relationship) => {
          for (const id of ['displacementInput', 'timeInput', 'averageInput']) {
            const input = document.getElementById(id);
            input.value = '0';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const choice = document.querySelector('input[name="relationship"][value="' + relationship + '"]');
          choice.checked = true;
          choice.dispatchEvent(new Event('change', { bubbles: true }));
          document.getElementById('measurementForm').requestSubmit();
        };

        const initialCommits = window.__timingLms.calls.commits;
        const uniform = await measureStage(1650);
        const uniformDurable = JSON.parse(window.__timingLms.values['cmi.suspend_data']);
        let variable = null;
        let variableDurable = null;
        if (includeVariable) {
          fillMeasurement('yes');
          await waitFor(() => document.getElementById('stageTitle').textContent === '變速運動', 'variable stage');
          variable = await measureStage(5300);
          variableDurable = JSON.parse(window.__timingLms.values['cmi.suspend_data']);
        }
        return {
          initialCommits,
          uniform,
          variable,
          timerLabel: document.getElementById('timerButton').textContent,
          formVisible: !document.getElementById('measurementForm').classList.contains('is-hidden'),
          uniformDurableKind: uniformDurable.kind,
          uniformDurableCaptured: uniformDurable.answer.uniformMeasurement?.x2 != null,
          uniformDurableVariant: uniformDurable.answer.variant,
          variableDurableCaptured: variableDurable?.answer.variableMeasurement?.x2 != null,
          variableDurableVariant: variableDurable?.answer.variant
        };
      })()`);

      assert(result.initialCommits >= 1, `${testCase.name}: harness observes the initial durable draft commit`);
      for (const [stageName, stage] of [["uniform", result.uniform], ["variable", result.variable]]) {
        if (!stage) continue;
        for (const [name, timing] of [["observe", stage.observe], ["stopwatch start", stage.start], ["stopwatch stop", stage.stop]]) {
          assert.equal(timing.immediateCommits, 0, `${testCase.name} ${stageName} ${name}: no synchronous LMS commit`);
          assert(timing.handlerMs < 100, `${testCase.name} ${stageName} ${name}: responsive handler (${timing.handlerMs.toFixed(1)} ms)`);
          assert(timing.firstFrameMs < 120, `${testCase.name} ${stageName} ${name}: prompt next frame (${timing.firstFrameMs.toFixed(1)} ms)`);
        }
        assert.equal(stage.runningCommits, 0, `${testCase.name} ${stageName}: no immediate or deferred commit while motion runs`);
        assert(stage.maxFrameGap < commitDelayMs - 20, `${testCase.name} ${stageName}: no commit-sized animation gap (${stage.maxFrameGap.toFixed(1)} ms)`);
        assert(stage.positionAfter > stage.positionBefore, `${testCase.name} ${stageName}: car advances immediately`);
        assert.equal(stage.pause.immediateCommits, 1, `${testCase.name} ${stageName}: manual pause creates the safe checkpoint`);
        assert(stage.pause.handlerMs >= commitDelayMs - 20, `${testCase.name} ${stageName}: harness proves durable commits block`);
      }
      assert.equal(result.timerLabel, "開始計時", `${testCase.name}: captured measurement renders`);
      assert.equal(result.formVisible, true, `${testCase.name}: captured answer form is visible`);
      assert.equal(result.uniformDurableKind, "draft");
      assert.equal(result.uniformDurableCaptured, true, `${testCase.name}: safe checkpoint contains uniform endpoint`);
      assert.equal(result.uniformDurableVariant, "captured");
      if (testCase.includeVariable) {
        assert.equal(result.variableDurableCaptured, true, `${testCase.name}: safe checkpoint contains variable endpoint`);
        assert.equal(result.variableDurableVariant, "captured");
      }
      const stages = [result.uniform, result.variable].filter(Boolean);
      summaries.push(`${testCase.name} handlers ${stages.flatMap((stage) => [
        stage.observe.handlerMs, stage.start.handlerMs, stage.stop.handlerMs
      ]).map((value) => `${value.toFixed(1)} ms`).join("/")} (p95 ${Math.max(...stages.map((stage) => stage.p95FrameGap)).toFixed(1)} ms)`);
    }
    return `slow ${commitDelayMs} ms LMS commit: ${summaries.join("; ")}; no running commits and pause checkpoints were durable`;
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
}

function lifecycleLmsPreload(snapshot = null) {
  return `(() => {
    const values = {
      'cmi.core.lesson_status': 'incomplete',
      'cmi.suspend_data': ${JSON.stringify(snapshot ? JSON.stringify(snapshot) : "")},
      'cmi.core.score.raw': ''
    };
    const calls = { commits: 0, finishes: 0 };
    window.__lifecycleLms = { values, calls };
    window.API = {
      LMSInitialize: () => 'true',
      LMSFinish: () => { calls.finishes += 1; return 'true'; },
      LMSCommit: () => { calls.commits += 1; return 'true'; },
      LMSGetValue: (key) => values[key] || '',
      LMSSetValue: (key, value) => { values[key] = String(value); return 'true'; },
      LMSGetLastError: () => '0',
      LMSGetErrorString: () => ''
    };
  })();`;
}

async function runBufferedLifecycleRestore(cdp, baseUrl, activityPath) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  let preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: lifecycleLmsPreload() });
  let runningSnapshot;
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=buffered-pagehide` });
    await waitForActivity(cdp);
    runningSnapshot = await evaluate(cdp, `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      document.getElementById('observeButton').click();
      document.getElementById('timerButton').click();
      await wait(320);
      const commitsBefore = window.__lifecycleLms.calls.commits;
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      const snapshot = JSON.parse(window.__lifecycleLms.values['cmi.suspend_data']);
      return {
        snapshot,
        lifecycleCommits: window.__lifecycleLms.calls.commits - commitsBefore
      };
    })()`);
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
  assert.equal(runningSnapshot.lifecycleCommits, 1, "buffered running measurement is committed by pagehide");
  assert.equal(runningSnapshot.snapshot.answer.variant, "paused-measuring");
  assert(runningSnapshot.snapshot.answer.uniformMeasurement.dt > 0, "pagehide captures latest running elapsed time");
  assert.equal(
    runningSnapshot.snapshot.answer.uniformMeasurement.currentOrEndModelTime,
    runningSnapshot.snapshot.answer.scene.simulationTime,
    "pagehide snapshot keeps scene and active measurement time aligned"
  );

  preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: lifecycleLmsPreload(runningSnapshot.snapshot) });
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=buffered-restore` });
    await waitForActivity(cdp);
    const restored = await evaluate(cdp, `(() => {
      const before = {
        observeLabel: document.getElementById('observeButton').textContent,
        timerLabel: document.getElementById('timerButton').textContent,
        timerDisabled: document.getElementById('timerButton').disabled,
        elapsed: Number.parseFloat(document.getElementById('timerReadout').textContent)
      };
      document.getElementById('observeButton').click();
      return {
        ...before,
        resumedTimerDisabled: document.getElementById('timerButton').disabled,
        resumedObserveLabel: document.getElementById('observeButton').textContent
      };
    })()`);
    assert.equal(restored.observeLabel, "繼續觀察");
    assert.equal(restored.timerLabel, "停止計時");
    assert.equal(restored.timerDisabled, true, "restored active timer waits for observation resume");
    assert(restored.elapsed > 0, "restored timer shows the flushed elapsed time");
    assert.equal(restored.resumedTimerDisabled, true, "minimum-duration rule still applies immediately after resume");
    assert.equal(restored.resumedObserveLabel, "觀察中");
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }

  preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: lifecycleLmsPreload() });
  let offstageSnapshot;
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=offstage-pagehide` });
    await waitForActivity(cdp);
    offstageSnapshot = await evaluate(cdp, `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (predicate, label) => {
        const started = performance.now();
        while (!predicate()) {
          if (performance.now() - started > 5000) throw new Error(label + ' timed out');
          await wait(20);
        }
      };
      document.getElementById('observeButton').click();
      await wait(120);
      document.getElementById('timerButton').click();
      await wait(320);
      document.getElementById('nextStageButton').click();
      await waitFor(() => document.getElementById('stageTitle').textContent === '變速運動', 'variable navigation');
      document.getElementById('nextStageButton').click();
      await waitFor(() => document.getElementById('stageTitle').textContent === '時間放大鏡', 'instant navigation');
      const timeBeforePagehide = JSON.parse(window.__lifecycleLms.values['cmi.suspend_data']).answer.uniformMeasurement.currentOrEndModelTime;
      const commitsBefore = window.__lifecycleLms.calls.commits;
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      const snapshot = JSON.parse(window.__lifecycleLms.values['cmi.suspend_data']);
      return {
        snapshot,
        timeBeforePagehide,
        lifecycleCommits: window.__lifecycleLms.calls.commits - commitsBefore
      };
    })()`);
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
  assert.equal(offstageSnapshot.lifecycleCommits, 1, "off-stage unfinished measurement remains encodable on pagehide");
  assert.equal(offstageSnapshot.snapshot.answer.phase, "instant");
  assert.equal(
    offstageSnapshot.snapshot.answer.uniformMeasurement.currentOrEndModelTime,
    offstageSnapshot.timeBeforePagehide,
    "off-stage lifecycle snapshot does not rewrite the uniform measurement with instant scene time"
  );

  preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: lifecycleLmsPreload(offstageSnapshot.snapshot) });
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=offstage-restore` });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await evaluate(cdp, "document.readyState === 'complete' && document.getElementById('stageTitle')?.textContent === '時間放大鏡'");
      if (ready) break;
      if (attempt === 119) throw new Error("off-stage lifecycle snapshot did not restore");
      await delay(50);
    }
    const restored = await evaluate(cdp, `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (predicate) => { while (!predicate()) await wait(20); };
      document.getElementById('previousStageButton').click();
      await waitFor(() => document.getElementById('stageTitle').textContent === '變速運動');
      document.getElementById('previousStageButton').click();
      await waitFor(() => document.getElementById('stageTitle').textContent === '勻速運動');
      return {
        observeLabel: document.getElementById('observeButton').textContent,
        timerLabel: document.getElementById('timerButton').textContent,
        timerDisabled: document.getElementById('timerButton').disabled
      };
    })()`);
    assert.equal(restored.observeLabel, "繼續觀察");
    assert.equal(restored.timerLabel, "停止計時");
    assert.equal(restored.timerDisabled, true);
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
  return "buffered running and off-stage unfinished measurements survived pagehide, reload, and legal continuation";
}

async function runSubmissionOutcome(cdp, baseUrl, activityPath, reviewSnapshot, scenario) {
  const preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const values = {
      'cmi.core.lesson_status': 'incomplete',
      'cmi.suspend_data': ${JSON.stringify(JSON.stringify(reviewSnapshot))},
      'cmi.core.score.raw': ''
    };
    window.API = {
      LMSInitialize: () => 'true', LMSFinish: () => 'true', LMSCommit: () => 'true',
      LMSGetValue: (key) => values[key] || '',
      LMSSetValue: (key, value) => { values[key] = String(value); return 'true'; },
      LMSGetLastError: () => '0', LMSGetErrorString: () => ''
    };
  })();` });
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=outcome-${scenario}` });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await evaluate(cdp, "document.readyState === 'complete' && !document.getElementById('reviewSection').classList.contains('is-hidden') && !document.getElementById('submitButton').disabled");
      if (ready) break;
      if (attempt === 119) throw new Error(`${scenario}: complete review did not restore`);
      await delay(50);
    }
    const outcome = {
      success: { activityState: "success", retryable: false },
      committed: { activityState: "committed", retryable: true },
      frozen: { activityState: "frozen", retryable: true },
      retryable: { activityState: "retry", retryable: true },
      nonretryable: { activityState: "retry", retryable: false }
    }[scenario];
    return await evaluate(cdp, `(async () => {
      const outcome = ${JSON.stringify(outcome)};
      window.confirm = () => true;
      window.SimScorm.submitWithCallbacks = (_computed, _snapshot, callbacks) => {
        (outcome.activityState === 'success' ? callbacks.onSuccess : callbacks.onFailure)(outcome);
        return outcome;
      };
      document.getElementById('submitButton').click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = document.getElementById('motionCanvas');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const graphTop = canvas.clientHeight < 260 ? 78 : 125;
      const firstGraphRow = Math.floor(graphTop * canvas.height / canvas.clientHeight);
      let tangentPixels = 0;
      for (let index = firstGraphRow * canvas.width * 4; index < data.length; index += 4) {
        if (data[index] > 190 && data[index] < 245 && data[index + 1] < 65 && data[index + 2] < 65 && data[index + 3] > 200) tangentPixels += 1;
      }
      return {
        activityVisible: !document.getElementById('activitySection').classList.contains('is-hidden'),
        reviewVisible: !document.getElementById('reviewSection').classList.contains('is-hidden'),
        resultVisible: !document.getElementById('resultSection').classList.contains('is-hidden'),
        resultTitle: document.getElementById('resultTitle').textContent,
        score: document.getElementById('scorePanel').textContent,
        tangentPixels,
        retryVisible: !document.getElementById('retryButton').classList.contains('is-hidden'),
        reviewRetryVisible: !document.getElementById('reviewRetryButton').classList.contains('is-hidden'),
        submitDisabled: document.getElementById('submitButton').disabled,
        editDisabled: Array.from(document.querySelectorAll('[data-edit]')).some((button) => button.disabled),
        solutionCopy: /目標時刻的瞬時速度 =|模型在目標時刻的瞬時速度是|已揭示目標點切線/.test(document.body.innerText)
      };
    })()`);
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
}

function assertSubmissionOutcome(name, state) {
  if (name === "success" || name === "committed") {
    assert.equal(state.activityVisible, false, `${name}: activity is hidden after trusted submission`);
    assert.equal(state.reviewVisible, false, `${name}: review is hidden after trusted submission`);
    assert.equal(state.resultVisible, true, `${name}: submitted result is visible`);
    assert.match(state.score, /成績：\d+ \/ 100.*狀態：(已通過|未通過)/, `${name}: trusted score/status is shown`);
    assert(state.tangentPixels > 0, `${name}: trusted result reveals the tangent`);
    assert.equal(state.solutionCopy, true, `${name}: trusted detailed solution is shown`);
    assert.equal(state.retryVisible, name === "committed", `${name}: only committed finish exposes retry`);
    return;
  }
  assert.equal(state.tangentPixels, 0, `${name}: untrusted outcome cannot reveal the tangent`);
  assert.equal(state.solutionCopy, false, `${name}: untrusted outcome cannot reveal solution copy`);
  if (name === "retryable") {
    assert.equal(state.reviewVisible, true, "retryable: learner remains on editable review");
    assert.equal(state.resultVisible, false, "retryable: technical result does not replace editable review");
    assert.equal(state.reviewRetryVisible, true, "retryable: resubmit control is visible");
    assert.equal(state.submitDisabled, false, "retryable: normal submit remains enabled");
    assert.equal(state.editDisabled, false, "retryable: review edit controls remain enabled");
    return;
  }
  assert.equal(state.activityVisible, false, `${name}: unsafe activity is hidden`);
  assert.equal(state.reviewVisible, false, `${name}: unsafe review is hidden`);
  assert.equal(state.resultVisible, true, `${name}: technical result is visible`);
  assert.match(state.score, /成績：--.*未能安全判斷合格狀態/, `${name}: no score/pass claim is shown`);
  assert.equal(state.resultTitle, "技術狀態", `${name}: outcome is labelled technical`);
  assert.equal(state.retryVisible, name === "frozen", `${name}: only frozen exposes pending retry`);
}

async function runLoadError(cdp, baseUrl, activityPath) {
  const preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.API = {
    LMSInitialize: () => 'false', LMSFinish: () => 'true', LMSCommit: () => 'false',
    LMSGetValue: () => '', LMSSetValue: () => 'false',
    LMSGetLastError: () => '101', LMSGetErrorString: () => 'forced load failure'
  };` });
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=load-error` });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await evaluate(cdp, "document.readyState === 'complete' && !document.getElementById('resultSection').classList.contains('is-hidden')");
      if (ready) break;
      if (attempt === 119) throw new Error("load-error: technical view did not render");
      await delay(50);
    }
    return evaluate(cdp, `(() => ({
      activityVisible: !document.getElementById('activitySection').classList.contains('is-hidden'),
      reviewVisible: !document.getElementById('reviewSection').classList.contains('is-hidden'),
      resultVisible: !document.getElementById('resultSection').classList.contains('is-hidden'),
      resultTitle: document.getElementById('resultTitle').textContent,
      score: document.getElementById('scorePanel').textContent,
      tangentPixels: 0,
      retryVisible: !document.getElementById('retryButton').classList.contains('is-hidden'),
      solutionCopy: /目標時刻的瞬時速度 =|模型在目標時刻的瞬時速度是|已揭示目標點切線/.test(document.body.innerText)
    }))()`);
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
}

async function main() {
  let server;
  let profileDirectory;
  let packageDirectory;
  let chrome;
  let cdp;
  let failure;
  let browserErrors = "";
  const pageErrors = [];
  const tempRoot = fs.realpathSync(os.tmpdir());
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required. Install it or set CHROME_PATH.");
    const extracted = buildAndExtractPackage(tempRoot, { slug, packagePrefix, packageNamePattern: packagePattern });
    packageDirectory = extracted.packageDirectory;
    server = createServer(packageDirectory);
    await withTimeout(listenServer(server), 3000, "HTTP server listen");
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, profilePrefix));
    validateOwnedDirectory(profileDirectory, tempRoot, profilePattern, "Chrome profile");
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--metrics-recording-only", "about:blank"];
    if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    const spawnFailure = new Promise((_, reject) => chrome.once("error", (error) => reject(new Error(`Could not spawn Chrome: ${error.message}`))));
    chrome.stderr.on("data", (chunk) => { browserErrors = `${browserErrors}${chunk}`.slice(-4000); });
    const port = await Promise.race([withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome DevTools startup"), spawnFailure]);
    const { response, body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Could not create Chrome target (${response.status}).`);
    cdp = new CdpClient(target.webSocketDebuggerUrl, WebSocket, 45000);
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => pageErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "Uncaught page exception"));
    cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
      if (type === "error" || type === "assert") pageErrors.push(args.map((item) => item.value ?? item.description ?? "").join(" "));
    });
    cdp.on("Log.entryAdded", ({ entry }) => { if (entry?.level === "error") pageErrors.push(entry.text); });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    const timing = await runTimingPerformance(cdp, baseUrl, extracted.activityPath);
    const lifecycle = await runBufferedLifecycleRestore(cdp, baseUrl, extracted.activityPath);
    const flow = await runLearnerFlow(cdp, baseUrl, extracted.activityPath);
    for (const scenario of ["success", "committed", "frozen", "retryable", "nonretryable"]) {
      assertSubmissionOutcome(scenario, await runSubmissionOutcome(cdp, baseUrl, extracted.activityPath, flow.reviewSnapshot, scenario));
    }
    assertSubmissionOutcome("load-error", await runLoadError(cdp, baseUrl, extracted.activityPath));
    assert.deepEqual(pageErrors, [], `browser page/console errors:\n${pageErrors.join("\n")}`);
    console.log(`Linear-motion real-browser regression passed: ${timing}; ${lifecycle}; ${flow.summary}; success/committed/frozen/retryable/nonretryable/load-error handlers verified`);
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    failure = error;
  }
  const cleanupErrors = [];
  try { await stopChrome(chrome, cdp); } catch (error) { cleanupErrors.push(error); }
  try { cdp?.close(); } catch (error) { cleanupErrors.push(error); }
  try { await closeServer(server); } catch (error) { cleanupErrors.push(error); }
  try { removeOwned(profileDirectory, tempRoot, profilePattern, "Chrome profile"); } catch (error) { cleanupErrors.push(error); }
  try { removeOwned(packageDirectory, tempRoot, packagePattern, "SCORM package"); } catch (error) { cleanupErrors.push(error); }
  if (cleanupErrors.length) failure = new AggregateError(failure ? [failure, ...cleanupErrors] : cleanupErrors, "Browser regression cleanup failed.");
  if (failure) throw failure;
}

if (require.main === module) main().catch((error) => { console.error(formatError(error)); process.exitCode = 1; });
