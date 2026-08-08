(function (root, factory) {
  const G = root.StaticKineticFrictionGenerator || (typeof module === "object" && module.exports ? require("./generator.js") : null);
  const Physics = root.StaticKineticFrictionPhysics || (typeof module === "object" && module.exports ? require("./physics.js") : null);
  const Measurement = root.StaticKineticFrictionMeasurement || (typeof module === "object" && module.exports ? require("./measurement.js") : null);
  const Graph = root.StaticKineticFrictionGraph || (typeof module === "object" && module.exports ? require("./graph.js") : null);
  const Scoring = root.StaticKineticFrictionScoring || (typeof module === "object" && module.exports ? require("./scoring.js") : null);
  const Persistence = root.StaticKineticFrictionPersistence || (typeof module === "object" && module.exports ? require("./persistence.js") : null);
  const api = factory(G, Physics, Measurement, Graph, Scoring, Persistence);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionApp = api;
  if (typeof document !== "undefined") {
    const start = () => { try { root.__staticKineticFrictionApp = api.boot(); } catch (error) { root.__staticKineticFrictionApp = api.createTechnicalApp(error); } };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  }
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Physics, Measurement, Graph, Scoring, Persistence) {
  "use strict";

  const ACTIVITY = "static-kinetic-friction-investigation-lab";
  const NS = "http://www.w3.org/2000/svg";
  const PHASES = ["balance", "experiment", "analysis", "predict", "review"];
  const PHASE_LABELS = Object.freeze({ balance: "A 力平衡", experiment: "B 實驗", analysis: "C 圖像分析", predict: "D 預測", review: "檢查與提交" });
  function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function randomSeed() { const a = new Uint32Array(1); if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a); else a[0] = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0; return a[0] >>> 0; }
  function mayRevealCorrectness(state) { return ["submitted-success", "submitted-committed", "trusted-finished-review"].includes(state); }
  function dependencyIssue() {
    const required = [[Generator, ["generateScenario", "surfaceVariation"]], [Physics, ["createInitialState", "stepPhysics"]], [Measurement, ["createMeasurementState", "packTrace", "unpackTrace"]], [Graph, ["svgPath", "selectionStats"]], [Scoring, ["scoreAnswer"]], [Persistence, ["freshState", "decodeSnapshot", "encodeDraft"]]];
    return required.some(([value, methods]) => !value || methods.some((method) => typeof value[method] !== "function"));
  }
  function buildEditableViewModel(state, scenario) {
    return {
      phase: state.phase, variant: state.variant, fromReview: Boolean(state.fromReview),
      balance: { tared: state.balance.tared, tareCorrectionCN: state.balance.tareCorrectionCN, observations: clone(state.balance.observations) },
      trial: state.trial ? { sampleDtMs: state.trial.sampleDtMs, regularSampleCount: state.trial.regularSampleCount } : null,
      analysis: clone(state.analysis), predictions: clone(state.predictions), working: clone(state.working || {})
    };
  }
  function buildResultViewModel(state, scenario, result) {
    return {
      ...buildEditableViewModel(state, scenario),
      trueParameters: { massKg: scenario.massKg, muS: scenario.muS, muK: scenario.muK, staticLimitMeanN: scenario.staticLimitMeanN, kineticFrictionMeanN: scenario.kineticFrictionMeanN },
      breakawayAuthority: state.trial?.breakaway || null,
      score: result?.score ?? null, maxScore: result?.maxScore ?? 100, passed: result?.passed ?? null, breakdown: clone(result?.breakdown || {})
    };
  }
  function routeStartup(attempt, Flow = (typeof SimActivityFlow !== "undefined" ? SimActivityFlow : null)) {
    if (Flow?.startup) return Flow.startup(attempt);
    if (attempt?.state === "finished") return "review";
    if (attempt?.state === "draft" || attempt?.state === "new") return "editable";
    if (attempt?.state === "pending-final") return "frozen";
    return "load-error";
  }
  function routeSubmission(outcome, Flow = (typeof SimActivityFlow !== "undefined" ? SimActivityFlow : null), handlers = {}) {
    const state = outcome?.activityState || "retry";
    if (Flow?.submission) return Flow.submission(outcome, handlers);
    (handlers[state] || handlers.retry || (() => {}))(outcome); return state;
  }
  function simulateBalanceRig(scenario, targetPositionM, options = {}) {
    if (!scenario) throw new Error("scenario required");
    const target = clamp(Number(targetPositionM), scenario.connector.restLengthM, scenario.stage.lengthM);
    const simulation = Physics.simulate([{ timeS: 0, handleTargetPositionM: target }], scenario, { durationS: options.durationS ?? 0.75 });
    let measurement = Measurement.createMeasurementState(scenario, { tared: Boolean(options.tared), tareCorrectionCN: Number.isInteger(options.tareCorrectionCN) ? options.tareCorrectionCN : 0 });
    for (const physical of simulation.states.slice(1)) measurement = Measurement.step(measurement, physical, scenario, Physics.PHYSICS_DT_S).state;
    return { physicsState: simulation.state, measurementState: measurement, reading: Measurement.liveReading(measurement), moved: simulation.events.some((event) => event.type === "breakaway") || simulation.state.block.positionM > 1e-6 };
  }
  function localExtremaIndices(samples) {
    if (!Array.isArray(samples) || samples.length < 3) return [];
    const extrema = [];
    const fields = ["measuredPullN", "measuredVelocityMps"];
    for (let index = 1; index < samples.length - 1; index += 1) {
      const isExtremum = fields.some((field) => {
        const before = samples[index - 1]?.[field]; const value = samples[index]?.[field]; const after = samples[index + 1]?.[field];
        if (![before, value, after].every(Number.isFinite)) return false;
        return (value >= before && value >= after && (value > before || value > after)) || (value <= before && value <= after && (value < before || value < after));
      });
      if (isExtremum) extrema.push(index);
    }
    return extrema;
  }

  function createTechnicalApp(error) {
    const message = "活動程式未能安全啟動；操作及分數均未確認。";
    function lock() {
      if (typeof document === "undefined") return;
      document.getElementById("technicalPanel")?.classList.remove("is-hidden");
      const title = document.getElementById("technicalTitle"); if (title) title.textContent = "活動暫時鎖定";
      const text = document.getElementById("technicalMessage"); if (text) text.textContent = message;
      document.querySelectorAll("[data-action], input, select, .drag-target").forEach((node) => { node.disabled = true; node.setAttribute("aria-disabled", "true"); });
      document.getElementById("app")?.setAttribute("data-presentation", "technical");
      const live = document.getElementById("liveRegion"); if (live) live.textContent = message;
    }
    lock();
    return { activity: ACTIVITY, getState: () => null, getScenario: () => null, getPresentation: () => "technical", mayReveal: () => false, render: lock, routeAttempt: () => false, routeStartup: () => "load-error", routeSubmission: () => false, cancelDrag: () => {}, interactionEvidence: () => ({ locked: true }), error };
  }

  function createController() {
    let state = null;
    let scenario = null;
    let presentation = "editable";
    let latestResult = null;
    let recorder = null;
    let physicsState = null;
    let measurementState = null;
    let loop = null;
    let fixedRunner = null;
    let previousFrameMs = null;
    let inputTimeOriginMs = null;
    let analysisDraft = null;
    let predictionDraft = [];
    let dragging = null;
    let pendingRetryAvailable = false;
    let redoConfirmationVisible = false;
    let idleRigMoved = false;
    let breakawayAnnounced = false;
    let tableCursorIndex = null;
    const RECORDING_MARKER = `simlab:${ACTIVITY}:recording-active`;

    const q = (id) => {
      if (typeof document === "undefined") return null;
      const byId = document.getElementById(id);
      if (byId) return byId;
      return /[.#\[\s:]/.test(id) ? document.querySelector(id) : null;
    };
    function setText(id, value) { const node = q(id); if (node) node.textContent = String(value); }
    function svgElement(tag, attrs = {}) { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); return node; }
    function saveDraft() {
      if (presentation !== "editable" || !state || typeof SimScorm === "undefined" || !SimScorm.saveDraft) return false;
      try { return SimScorm.saveDraft(SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encodeDraft(state))); } catch { return false; }
    }
    function announce(text) { const live = q("liveRegion"); if (live) live.textContent = text; }
    function markRecordingActive(active) { try { if (typeof sessionStorage !== "undefined") { if (active) sessionStorage.setItem(RECORDING_MARKER, "1"); else sessionStorage.removeItem(RECORDING_MARKER); } } catch {} }
    function consumeInterruptedRecording() { try { if (typeof sessionStorage === "undefined") return false; const active = sessionStorage.getItem(RECORDING_MARKER) === "1"; sessionStorage.removeItem(RECORDING_MARKER); return active; } catch { return false; } }
    function updatePills() { document.querySelectorAll("[data-phase-pill]").forEach((pill) => pill.classList.toggle("is-current", pill.dataset.phasePill === state?.phase)); }
    function showPanel(panel) {
      ["balance", "experiment", "analysis", "predict", "review"].forEach((name) => q(`${name}Panel`)?.classList.toggle("is-hidden", name !== panel));
      q("resultPanel")?.classList.toggle("is-hidden", !mayRevealCorrectness(presentation));
    }
    function setLockedPresentation(locked) {
      if (typeof document === "undefined") return;
      document.querySelectorAll("[data-action], input, select, .drag-target").forEach((node) => {
        const finishRetry = node.dataset.action === "retry-finish" && presentation === "submitted-committed";
        const pendingRetry = node.dataset.action === "retry-pending" && presentation === "frozen" && pendingRetryAvailable;
        const disabled = locked ? !finishRetry && !pendingRetry : Boolean(node.disabled);
        if (locked) node.disabled = disabled;
        node.setAttribute("aria-disabled", String(disabled));
      });
      document.querySelectorAll("[data-action^='edit-']").forEach((node) => node.classList.toggle("is-hidden", Boolean(locked)));
    }
    function focusNode(node) {
      if (!node || typeof node.focus !== "function") return;
      if (!node.hasAttribute("tabindex") && !/^(BUTTON|INPUT|SELECT|A)$/.test(node.tagName)) node.setAttribute("tabindex", "-1");
      const focus = () => node.focus({ preventScroll: false });
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus); else setTimeout(focus, 0);
    }
    function focusPhase(phase = state?.phase) { focusNode(q(`${phase}Panel`)?.querySelector("h2")); }
    function currentAnalysisKey() {
      if (!state) return null;
      if (state.fromReview && state.working?.reviewEditTarget?.section === "analysis") return state.working.reviewEditTarget.semanticKey;
      return Persistence.ANALYSIS_KEYS[state.working?.activeAnalysisTask ?? 0] || null;
    }
    function currentPredictionIndex() {
      if (!state) return 0;
      return state.fromReview && state.working?.reviewEditTarget?.section === "predict" ? state.working.reviewEditTarget.semanticKey : state.working?.activePredictionIndex ?? 0;
    }
    function currentPredictionResponse() {
      const index = currentPredictionIndex();
      if (state?.fromReview && state.working?.reviewEditTarget?.section === "predict" && state.working?.editDraft?.kind === "prediction") return state.working.editDraft.value;
      return state?.predictions?.[index] || null;
    }
    function setTargetVisible(id, visible) {
      const target = q(id); if (!target) return;
      target.classList.toggle("is-hidden", !visible);
      target.tabIndex = visible ? 0 : -1;
      target.setAttribute("aria-hidden", String(!visible));
    }
    function renderDragTargets() {
      const phase = state?.phase;
      const activeBalance = phase === "balance" && Boolean(state?.balance?.observations.find((observation) => !observation.learnerForce?.committed) || (state?.fromReview && state.working?.reviewEditTarget?.section === "balance"));
      setTargetVisible("forceGrip", (phase === "balance" || phase === "experiment") && !state?.fromReview);
      setTargetVisible("balanceFriction", activeBalance);
      setTargetVisible("predictionFriction", phase === "predict");
      setTargetVisible("breakawayMarker", phase === "analysis" && currentAnalysisKey() === "breakaway");
      const interval = { staticInterval: "static", slowPlateau: "slow", acceleration: "acceleration", fastPlateau: "fast" }[currentAnalysisKey()];
      for (const prefix of ["static", "slow", "acceleration", "fast"]) for (const edge of ["start", "end"]) setTargetVisible(`${prefix}-${edge}`, phase === "analysis" && interval === prefix);
    }
    function resetIdleRig(targetPositionM = null) {
      if (!scenario) return;
      const target = targetPositionM ?? Number(q("gripPosition")?.value || scenario.connector.restLengthM);
      const rig = simulateBalanceRig(scenario, target, { tared: Boolean(state?.balance?.tared), tareCorrectionCN: state?.balance?.tareCorrectionCN ?? 0 });
      physicsState = rig.physicsState; measurementState = rig.measurementState; idleRigMoved = rig.moved;
    }
    function appendForceArrow(svg, startX, endX, y, className, color, label) {
      if (Math.abs(endX - startX) < 1) return;
      svg.append(svgElement("line", { x1: startX, y1: y, x2: endX, y2: y, class: className }));
      const direction = Math.sign(endX - startX);
      svg.append(svgElement("polygon", { points: `${endX},${y} ${endX - direction * 14},${y - 9} ${endX - direction * 14},${y + 9}`, fill: color }));
      const text = svgElement("text", { x: (startX + endX) / 2, y: y - 13, "text-anchor": "middle", class: "force-builder-label" }); text.appendChild(document.createTextNode(label)); svg.append(text);
    }
    function renderApparatus() {
      const svg = q("apparatusSvg"); if (!svg) return;
      const graphMode = state?.phase === "analysis";
      const predictionMode = state?.phase === "predict";
      svg.classList.toggle("is-hidden", graphMode);
      q("stageGraph")?.classList.toggle("is-hidden", !graphMode);
      q("liveReadouts")?.classList.toggle("is-hidden", graphMode || predictionMode);
      q("predictionReadout")?.classList.toggle("is-hidden", !predictionMode);
      renderDragTargets();
      if (graphMode) { renderGraph(); return; }
      svg.replaceChildren();
      const width = 900, groundY = 300;
      svg.append(svgElement("rect", { x: 35, y: groundY, width: 830, height: 35, class: "apparatus-surface" }));
      const position = predictionMode ? .45 : physicsState?.block?.positionM ?? 0;
      const target = predictionMode ? .95 : physicsState?.handle?.positionM ?? (scenario?.connector.restLengthM || .18);
      const x = 100 + clamp(position / (scenario?.stage.lengthM || 1.65), 0, 1) * 650;
      const hx = 100 + clamp(target / (scenario?.stage.lengthM || 1.65), 0, 1) * 650;
      svg.append(svgElement("rect", { x, y: groundY - 54, width: 92, height: 54, rx: 8, class: "apparatus-block" }));
      svg.append(svgElement("line", { x1: x + 92, y1: groundY - 27, x2: hx, y2: groundY - 27, class: "apparatus-rope" }));
      svg.append(svgElement("rect", { x: hx - 12, y: groundY - 43, width: 34, height: 32, rx: 7, class: "apparatus-grip" }));
      const labels = predictionMode ? [
        [x + 46, groundY + 62, "預測情境中的物體"], [Math.min(830, hx), groundY - 58, "已知向右拉力"],
        [92, 75, "水平粗糙面"], [185, 102, "藍色箭嘴是你建立的摩擦力"]
      ] : [
        [x + 46, groundY + 62, "物體"], [Math.min(830, hx), groundY - 58, "測力計握把"],
        [64, 75, "水平粗糙面"], [64, 102, "F拉—t 與 v—t 來自同一次物理記錄"]
      ];
      labels.forEach(([tx, ty, text]) => { const label = svgElement("text", { x: tx, y: ty, "text-anchor": "middle" }); label.appendChild(document.createTextNode(text)); svg.append(label); });
      const grip = q("forceGrip"); if (grip) { grip.style.left = `${clamp(hx / 900 * 100 - 3, 0, 94)}%`; grip.style.top = `${clamp((groundY - 43) / 430 * 100 - 2, 0, 92)}%`; }
      const reading = Measurement.liveReading(measurementState || Measurement.createMeasurementState(scenario || Generator.generateScenario({ seed: 1 })));
      if (state?.phase === "balance") {
        const active = state.balance.observations.find((observation) => !observation.learnerForce?.committed) || (state.fromReview ? state.balance.observations.find((observation) => observation.id === state.working?.reviewEditTarget?.semanticKey) : null) || state.balance.observations.at(-1);
        const pullN = active ? active.measuredPullCN / 100 : reading.forceN;
        const inputType = q("balanceType")?.value || null; const savedForce = active?.learnerForce?.committed ? active.learnerForce : null;
        const frictionType = inputType || savedForce?.frictionType || null;
        const direction = frictionType === "none" ? "none" : q("balanceDirection")?.value || savedForce?.direction || null;
        const frictionN = frictionType && frictionType !== "none" ? (inputType ? Number(q("balanceMagnitude")?.value || 0) : (savedForce?.frictionMagnitudeCN || 0) / 100) : 0;
        const signedFrictionN = direction === "left" ? -frictionN : direction === "right" ? frictionN : 0;
        const scale = 18;
        appendForceArrow(svg, x + 92, x + 92 + Math.min(150, pullN * scale), groundY - 90, "pull-arrow", "#b91c1c", `拉力 ${pullN.toFixed(2)} N`);
        appendForceArrow(svg, x, x + clamp(signedFrictionN * scale, -150, 150), groundY - 130, "learner-friction-arrow", "#1d4ed8", `你的摩擦力 ${frictionN.toFixed(2)} N`);
        setText("balanceNetForce", `你畫的水平合力 ΣFx：${(pullN + signedFrictionN).toFixed(2)} N`);
        const balanceHandle = q("balanceFriction"); if (balanceHandle) { const endpoint = x + clamp(signedFrictionN * scale, -150, 150); balanceHandle.style.left = `${clamp(endpoint / 900 * 100 - 2.7, 0, 94)}%`; balanceHandle.style.top = "34%"; balanceHandle.setAttribute("aria-label", `靜止狀態的水平摩擦力箭嘴，目前 ${frictionN.toFixed(2)} 牛頓`); }
      }
      if (predictionMode) {
        const index = currentPredictionIndex(); const spec = scenario?.predictions?.[index]; const response = currentPredictionResponse();
        const frictionN = Number.isInteger(response?.magnitudeCN) ? response.magnitudeCN / 100 : 0;
        const signedFrictionN = response?.direction === "left" ? -frictionN : response?.direction === "right" ? frictionN : 0;
        const scale = 18; const endpoint = x + clamp(signedFrictionN * scale, -180, 180);
        appendForceArrow(svg, x + 92, x + 92 + Math.min(180, (spec?.pullN || 0) * scale), groundY - 90, "pull-arrow prediction-pull-arrow", "#b91c1c", `已知拉力 ${(spec?.pullN || 0).toFixed(1)} N`);
        appendForceArrow(svg, x, endpoint, groundY - 130, "learner-friction-arrow prediction-friction-arrow", "#1d4ed8", `你的摩擦力 ${frictionN.toFixed(2)} N`);
        const predictionHandle = q("predictionFriction"); if (predictionHandle) { predictionHandle.style.left = `${clamp(endpoint / 900 * 100 - 2.7, 0, 94)}%`; predictionHandle.style.top = `${clamp((groundY - 130) / 430 * 100 - 5, 0, 90)}%`; predictionHandle.setAttribute("aria-label", `預測 ${index + 1} 的摩擦力箭嘴，目前 ${response?.magnitudeCN == null ? "未輸入" : `${frictionN.toFixed(2)} 牛頓`}`); }
        setText("predictionReadout", `情境 ${index + 1}：已知向右拉力 ${(spec?.pullN || 0).toFixed(1)} N；初速 ${(spec?.velocityMps || 0).toFixed(2)} m/s；你的摩擦力 ${response?.magnitudeCN == null ? "尚未輸入" : `${frictionN.toFixed(2)} N`}。`);
      }
      if (grip) grip.setAttribute("aria-label", `測力計握把，目前讀數 ${reading.forceN.toFixed(2)} 牛頓`);
      setText("forceReadout", `${reading.forceN.toFixed(2)} N`); setText("velocityReadout", `${reading.velocityMps.toFixed(3)} m/s`); setText("timeReadout", `${finite(physicsState?.timeS).toFixed(2)} s`);
    }
    function renderBalance() {
      const list = q("balanceObservations"); if (!list || !state) return;
      list.replaceChildren();
      state.balance.observations.forEach((observation) => {
        const card = document.createElement("article"); card.className = "observation-card";
        const force = observation.learnerForce;
        card.innerHTML = `<strong>${observation.id === "zero-pull" ? "無拉力狀態" : observation.id === "static-low" ? "較小非零拉力" : observation.id === "static-high" ? "較大非零拉力" : "非零拉力狀態"}</strong><span>測力計讀數：${(observation.measuredPullCN / 100).toFixed(2)} N；速度：${(observation.measuredVelocityMMps / 1000).toFixed(3)} m/s</span><span>${force?.committed ? `你的判斷：${force.frictionType}／${force.direction}／${(force.frictionMagnitudeCN / 100).toFixed(2)} N` : "尚未保存水平力判斷"}</span>`;
        list.append(card);
      });
      const reviewBalanceTarget = state.fromReview && state.working?.reviewEditTarget?.section === "balance" ? state.working.reviewEditTarget.semanticKey : null;
      const active = state.balance.observations.find((observation) => !observation.learnerForce?.committed) || (reviewBalanceTarget ? state.balance.observations.find((observation) => observation.id === reviewBalanceTarget) : null);
      q("balanceAnswer")?.classList.toggle("is-hidden", !active);
      if (active) {
        q("balanceAnswer")?.setAttribute("data-observation-id", active.id);
        const reviewDraft = state.fromReview && state.working?.editDraft?.kind === "observation" ? state.working.editDraft.value : null;
        const shownForce = reviewDraft || (state.fromReview ? active.learnerForce : null);
        if (shownForce) { if (q("balanceType")) q("balanceType").value = shownForce.frictionType; if (q("balanceDirection")) q("balanceDirection").value = shownForce.direction; if (q("balanceMagnitude")) q("balanceMagnitude").value = String(shownForce.frictionMagnitudeCN / 100); }
        setText("balanceMagnitudeValue", `${(Number(q("balanceMagnitude")?.value || 0)).toFixed(2)} N`);
      }
      const complete = Persistence.allBalanceAnswersCommitted(state);
      q("to-experiment")?.toggleAttribute("disabled", !complete);
      q("to-experiment")?.classList.toggle("is-hidden", Boolean(state.fromReview));
      q("balanceCaptureActions")?.classList.toggle("is-hidden", Boolean(state.fromReview));
      q("tareButton")?.toggleAttribute("disabled", state.balance.tared || state.balance.observations.length > 0);
      const pendingAnswer = state.balance.observations.some((observation) => !observation.learnerForce?.committed);
      q("recordBalance")?.toggleAttribute("disabled", !state.balance.tared || pendingAnswer || state.balance.observations.length >= 3);
      renderApparatus();
    }
    function renderQuality() {
      const box = q("trialQuality"); if (!box || !recorder?.trace) return;
      const quality = Measurement.assessTrial(recorder.trace);
      box.classList.remove("is-hidden"); box.textContent = quality.neutralMessage;
      q("keepTrial")?.classList.toggle("is-hidden", !quality.valid || Boolean(state?.trial) || Boolean(recorder.running));
      setText("experimentStatus", state?.trial ? "已保留這次實驗，可以前往同步圖像分析。" : quality.valid ? "資料已完成，可以保留這次實驗。" : quality.neutralMessage);
    }
    function stopLoop() {
      if (loop != null) {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(loop); else clearInterval(loop);
        loop = null;
      }
      previousFrameMs = null;
    }
    function startLoop() {
      stopLoop();
      const frame = (nowMs) => {
        if (!recorder || !scenario || !fixedRunner) return;
        if (previousFrameMs == null) previousFrameMs = nowMs;
        const frameDurationMs = Math.max(0, nowMs - previousFrameMs);
        previousFrameMs = nowMs;
        if (frameDurationMs > 50) {
          recorder.stalled = true; recorder.running = false; stopLoop();
          markRecordingActive(false);
          setText("experimentStatus", "這次記錄因技術時間間隔中斷；未確認資料，請回到記錄前狀態再重新開始。");
          renderApparatus();
          return;
        }
        const target = Number(q("gripPosition")?.value || scenario.connector.restLengthM);
        const advanced = fixedRunner.advanceFrame(frameDurationMs);
        if (advanced.abortedOnStall) {
          recorder.stalled = true; recorder.running = false; stopLoop();
          markRecordingActive(false);
          setText("experimentStatus", "這次記錄因技術時間間隔中斷；未確認資料，請重新開始。");
          return;
        }
        for (const nextPhysical of advanced.states || []) {
          const previousPhysical = physicsState;
          const previousMeasurement = measurementState;
          physicsState = nextPhysical;
          const stepped = Measurement.step(measurementState, physicsState, scenario, Physics.PHYSICS_DT_S);
          measurementState = stepped.state;
          const nextGridTime = measurementState.regularSamples.length * Measurement.GRAPH_SAMPLE_DT_S;
          if (measurementState.regularSamples.length === 0 || physicsState.timeS >= nextGridTime - 1e-6) {
            const captured = Measurement.captureSample(measurementState, physicsState, scenario, { timeS: physicsState.timeS }); measurementState = captured.state;
          }
          if (physicsState.events?.length) for (const event of physicsState.events) {
            measurementState = Measurement.enrichBreakaway(measurementState, event, previousMeasurement, measurementState, previousPhysical, physicsState);
            if (event.type === "breakaway" && !breakawayAnnounced) { breakawayAnnounced = true; announce("物體已開始移動"); }
          }
        }
        if (physicsState.timeS >= Measurement.MAX_TRIAL_DURATION_S) { stopRecording(); return; }
        renderApparatus();
        if (typeof requestAnimationFrame === "function") loop = requestAnimationFrame(frame); else loop = setTimeout(() => frame(performance.now()), 16);
      };
      if (typeof requestAnimationFrame === "function") loop = requestAnimationFrame(frame); else loop = setTimeout(() => frame(performance.now()), 16);
    }
    function startRecording() {
      if (!scenario || !state || presentation !== "editable" || state.phase !== "experiment" || state.fromReview || state.trial || recorder?.running || recorder?.trace) return false;
      recorder = Measurement.createRecorder(scenario, { tared: state.balance.tared, tareCorrectionCN: state.balance.tareCorrectionCN }); recorder.running = true; breakawayAnnounced = false; measurementState = recorder.measurement; physicsState = Physics.createInitialState(scenario); fixedRunner = Physics.runFixedStep(scenario); inputTimeOriginMs = typeof performance !== "undefined" ? performance.now() : 0; Physics.enqueueInput(fixedRunner.queue, { timeS: 0, handleTargetPositionM: Number(q("gripPosition")?.value || scenario.connector.restLengthM) }); recorder.startedAtS = 0; markRecordingActive(true); announce("記錄開始"); setText("experimentStatus", "記錄進行中：慢慢增加拉力，再保持兩段不同速度。"); startLoop(); return true;
    }
    function stopRecording() {
      if (!recorder?.running || state?.phase !== "experiment" || state?.fromReview) return false;
      stopLoop(); recorder.measurement = measurementState; const stopped = Measurement.stopRecorder(recorder); if (stopped.accepted) renderQuality(); else setText("experimentStatus", "上次記錄因技術時間間隔中斷，請重新開始這次記錄。"); recorder.running = false; markRecordingActive(false); announce("實驗記錄已停止"); return stopped.accepted;
    }
    function renderGraph() {
      const svg = q("graphSvg"); if (!svg || !state?.trial) return;
      svg.replaceChildren();
      const decoded = Measurement.unpackTrace(state.trial);
      const activeKey = currentAnalysisKey();
      const activeTask = analysisDraft?.[activeKey] || state.analysis?.[activeKey];
      for (let i = 0; i <= 6; i += 1) { const x = Graph.timeToX(i * 2); svg.append(svgElement("line", { x1: x, y1: 30, x2: x, y2: 400, class: "graph-grid" })); }
      if (activeKey !== "breakaway" && Number.isInteger(activeTask?.startIndex) && Number.isInteger(activeTask?.endIndex)) {
        const x0 = Graph.timeToX(decoded.merged[activeTask.startIndex]?.timeS || 0); const x1 = Graph.timeToX(decoded.merged[activeTask.endIndex]?.timeS || 0);
        svg.append(svgElement("rect", { x: Math.min(x0, x1), y: 30, width: Math.max(1, Math.abs(x1 - x0)), height: 370, fill: "rgba(124,58,237,.10)" }));
      }
      const forcePath = svgElement("path", { d: Graph.svgPath(decoded, "force"), class: "force-line" }); const velocityPath = svgElement("path", { d: Graph.svgPath(decoded, "velocity"), class: "velocity-line" }); svg.append(forcePath, velocityPath);
      const forceLabel = svgElement("text", { x: 410, y: 20, "text-anchor": "middle" }); forceLabel.appendChild(document.createTextNode("測力計讀數（拉力） F拉—時間 t")); svg.append(forceLabel);
      const velocityLabel = svgElement("text", { x: 410, y: 425, "text-anchor": "middle" }); velocityLabel.appendChild(document.createTextNode("速度 v—時間 t（同一時間軸）")); svg.append(velocityLabel);
      const marker = activeKey === "breakaway" ? activeTask?.markerIndex : null;
      if (Number.isInteger(marker) && decoded.merged[marker]) {
        const sample = decoded.merged[marker]; const x = Graph.timeToX(sample.timeS); svg.append(svgElement("line", { x1: x, y1: 25, x2: x, y2: 402, class: "graph-cursor" }));
        const markerTarget = q("breakawayMarker"); if (markerTarget) { markerTarget.style.left = `${clamp(x / 820 * 100, 0, 100)}%`; markerTarget.style.top = "48%"; markerTarget.setAttribute("aria-label", `最大靜摩擦力時間標記，目前 ${sample.timeS.toFixed(2)} 秒`); }
        setText("graphCursorReadout", `目前時間 ${sample.timeS.toFixed(2)} s；拉力 ${sample.measuredPullN.toFixed(2)} N；速度 ${sample.measuredVelocityMps.toFixed(3)} m/s。`);
      } else if (activeTask && Number.isInteger(activeTask.startIndex) && Number.isInteger(activeTask.endIndex)) {
        const prefix = { staticInterval: "static", slowPlateau: "slow", acceleration: "acceleration", fastPlateau: "fast" }[activeKey];
        for (const edge of ["start", "end"]) {
          const index = activeTask[`${edge}Index`]; const sample = decoded.merged[index]; const target = q(`${prefix}-${edge}`);
          if (target && sample) { target.style.left = `${clamp(Graph.timeToX(sample.timeS) / 820 * 100, 0, 100)}%`; target.style.top = edge === "start" ? "70%" : "82%"; target.setAttribute("aria-label", `${activeKey} 區段${edge === "start" ? "開始" : "結束"}，目前 ${sample.timeS.toFixed(2)} 秒`); }
        }
        const start = decoded.merged[activeTask.startIndex], end = decoded.merged[activeTask.endIndex];
        if (start && end) setText("graphCursorReadout", `目前區段 ${start.timeS.toFixed(2)}–${end.timeS.toFixed(2)} s；開始拉力 ${start.measuredPullN.toFixed(2)} N、速度 ${start.measuredVelocityMps.toFixed(3)} m/s；結束拉力 ${end.measuredPullN.toFixed(2)} N、速度 ${end.measuredVelocityMps.toFixed(3)} m/s。`);
      } else setText("graphCursorReadout", "尚未選取圖像時間。");
    }
    function renderDataTable() {
      const body = q("traceTable"); if (!body || !state?.trial) return;
      const decoded = Measurement.unpackTrace(state.trial); body.replaceChildren();
      if (!Number.isInteger(tableCursorIndex) || tableCursorIndex < 0 || tableCursorIndex >= decoded.merged.length) tableCursorIndex = null;
      decoded.merged.forEach((sample, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `<th scope="row">${sample.canonicalIndex}</th><td>${sample.timeS.toFixed(2)}</td><td>${sample.measuredPullN.toFixed(2)}</td><td>${sample.measuredVelocityMps.toFixed(3)}</td>`;
        row.setAttribute("aria-label", `樣本 ${sample.canonicalIndex}，時間 ${sample.timeS.toFixed(2)} 秒，拉力 ${sample.measuredPullN.toFixed(2)} 牛頓，速度 ${sample.measuredVelocityMps.toFixed(3)} 米每秒`);
        row.dataset.sampleIndex = String(index); row.tabIndex = index === tableCursorIndex ? 0 : -1;
        body.append(row);
      });
      const task = (analysisDraft || state.analysis)?.[currentAnalysisKey()] || null;
      const startIndex = currentAnalysisKey() === "breakaway" ? task?.markerIndex : task?.startIndex;
      const endIndex = currentAnalysisKey() === "breakaway" ? task?.markerIndex : task?.endIndex;
      q("jumpSelectionStart")?.toggleAttribute("disabled", !Number.isInteger(startIndex));
      q("jumpSelectionEnd")?.toggleAttribute("disabled", !Number.isInteger(endIndex));
      const extrema = localExtremaIndices(decoded.merged); const cursor = tableCursorIndex ?? -1;
      q("previousExtremum")?.toggleAttribute("disabled", !extrema.some((index) => index < cursor));
      q("nextExtremum")?.toggleAttribute("disabled", !extrema.some((index) => index > cursor));
      if (Number.isInteger(tableCursorIndex)) {
        const sample = decoded.merged[tableCursorIndex];
        setText("graphCursorReadout", `資料表游標：時間 ${sample.timeS.toFixed(2)} s；拉力 ${sample.measuredPullN.toFixed(2)} N；速度 ${sample.measuredVelocityMps.toFixed(3)} m/s。`);
      }
      const statsHost = q("intervalStatsList"); if (!statsHost) return;
      statsHost.replaceChildren();
      const draft = analysisDraft || state.analysis;
      const labels = { staticInterval: "C1 靜止上升", slowPlateau: "C3 低速平台", acceleration: "C4 加速", fastPlateau: "C5 高速平台" };
      Object.entries(labels).forEach(([key, label]) => {
        const selection = draft?.[key]; const stats = selection?.startIndex != null && selection?.endIndex != null ? Measurement.intervalStats(decoded, selection.startIndex, selection.endIndex) : null;
        const item = document.createElement("p"); item.className = "interval-stat"; item.id = `interval-stat-${key}`;
        item.textContent = stats ? `${label}：${stats.startTimeS.toFixed(2)}–${stats.endTimeS.toFixed(2)} s；duration ${stats.durationS.toFixed(2)} s；平均拉力 ${stats.meanPullN.toFixed(2)} N；平均速度 ${stats.meanVelocityMps.toFixed(3)} m/s；速度斜率 ${stats.velocitySlopeMps2.toFixed(3)} m/s²；拉力標準差 ${stats.forceStdN.toFixed(3)} N。` : `${label}：尚未選取完整區段。`;
        statsHost.append(item);
      });
    }
    function moveTableCursor(action) {
      if (!state?.trial) return false;
      const decoded = Measurement.unpackTrace(state.trial); const task = (analysisDraft || state.analysis)?.[currentAnalysisKey()] || null;
      let next = null;
      if (action === "jump-selection-start") next = currentAnalysisKey() === "breakaway" ? task?.markerIndex : task?.startIndex;
      else if (action === "jump-selection-end") next = currentAnalysisKey() === "breakaway" ? task?.markerIndex : task?.endIndex;
      else {
        const extrema = localExtremaIndices(decoded.merged); const cursor = tableCursorIndex ?? (action === "previous-extremum" ? decoded.merged.length : -1);
        const choices = extrema.filter((index) => action === "previous-extremum" ? index < cursor : index > cursor);
        next = action === "previous-extremum" ? choices.at(-1) : choices[0];
      }
      if (!Number.isInteger(next) || !decoded.merged[next]) return false;
      tableCursorIndex = next; return true;
    }
    function ensureAnalysisDraft() {
      if (!state?.trial) return null;
      if (!analysisDraft) {
        analysisDraft = clone(state.analysis);
        if (state.fromReview && state.working?.editDraft?.kind === "analysis-task") analysisDraft[state.working.reviewEditTarget.semanticKey] = clone(state.working.editDraft.value);
      }
      const defaults = Graph.createSelectionSet(state.trial);
      const key = currentAnalysisKey();
      if (key && !analysisDraft[key]) analysisDraft[key] = clone(defaults[key]);
      return analysisDraft;
    }
    function renderAnalysisTasks() {
      const host = q("analysisTasks"); if (!host || !state?.trial) return;
      const draft = ensureAnalysisDraft(); const decoded = Measurement.unpackTrace(state.trial); const max = decoded.merged.length - 1;
      host.replaceChildren();
      const specs = [
        ["staticInterval", "C1 靜止而拉力增加的區段", "frictionType", [["static", "靜摩擦力"], ["kinetic", "滑動摩擦力"], ["none", "沒有摩擦力"]]],
        ["breakaway", "C2 物體剛開始移動的時刻", "identifiedAs", [["maximum-static-friction", "最大靜摩擦力"], ["kinetic-friction", "滑動摩擦力"], ["applied-force", "施加拉力"]]],
        ["slowPlateau", "C3 低速近似勻速區段", "estimatedFkCN", []],
        ["acceleration", "C4 加速區段", "relation", [["pull-greater", "F拉 大於 fk"], ["equal", "F拉 等於 fk"], ["pull-less", "F拉 小於 fk"]]],
        ["fastPlateau", "C5 較高速近似勻速區段", "speedComparison", [["same-average", "平均值基本相同"], ["higher-at-fast-speed", "高速較大"], ["lower-at-fast-speed", "高速較小"]]]
      ];
      specs.forEach(([key, title, field, options]) => {
        const card = document.createElement("section"); card.className = "task-card"; card.dataset.analysisTask = key; if (key !== "breakaway") card.setAttribute("aria-describedby", `interval-stat-${key}`);
        const task = draft[key] || {};
        card.innerHTML = `<p class="task-title">${title}</p>`;
        if (key === "breakaway") {
          card.innerHTML += `<label>時間標記（秒）<input type="range" min="0" max="${max}" value="${task.markerIndex ?? 0}" data-analysis-field="markerIndex" aria-label="最大靜摩擦力時間標記"><output data-analysis-readout="markerIndex">${(decoded.merged[task.markerIndex ?? 0]?.timeS || 0).toFixed(2)} s</output></label><label>你讀到的最大靜摩擦力（N）<input type="number" min="0" max="12" step="0.01" value="${task.estimatedFsMaxCN == null ? "" : task.estimatedFsMaxCN / 100}" data-analysis-field="estimatedFsMaxCN"></label>`;
        } else if (key === "slowPlateau" || key === "fastPlateau") {
          card.innerHTML += `<label>開始樣本<input type="range" min="0" max="${max}" value="${task.startIndex ?? 0}" data-analysis-field="startIndex"></label><label>結束樣本<input type="range" min="0" max="${max}" value="${task.endIndex ?? 1}" data-analysis-field="endIndex"></label><label>估計平均 fk（N）<input type="number" min="0" max="12" step="0.01" value="${task.estimatedFkCN == null ? "" : task.estimatedFkCN / 100}" data-analysis-field="estimatedFkCN"></label>`;
        } else {
          card.innerHTML += `<label>開始樣本<input type="range" min="0" max="${max}" value="${task.startIndex ?? 0}" data-analysis-field="startIndex"></label><label>結束樣本<input type="range" min="0" max="${max}" value="${task.endIndex ?? 1}" data-analysis-field="endIndex"></label>`;
        }
        if (options.length) card.innerHTML += `<label>判斷<select data-analysis-field="${field}"><option value="">請選擇</option>${options.map(([value, label]) => `<option value="${value}" ${task[field] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
        if (key === "staticInterval") card.innerHTML += `<label>拉力和靜摩擦力的關係<select data-analysis-field="relation"><option value="">請選擇</option><option value="equal" ${task.relation === "equal" ? "selected" : ""}>拉力等於靜摩擦力</option><option value="pull-greater" ${task.relation === "pull-greater" ? "selected" : ""}>拉力大於靜摩擦力</option><option value="pull-less" ${task.relation === "pull-less" ? "selected" : ""}>拉力小於靜摩擦力</option></select></label>`;
        if (key === "acceleration") card.innerHTML += `<label>這段平均測力計讀數可否直接當作 fk？<select data-analysis-field="pullEqualsFk"><option value="">請選擇</option><option value="yes" ${task.pullEqualsFk === "yes" ? "selected" : ""}>可以</option><option value="no" ${task.pullEqualsFk === "no" ? "selected" : ""}>不可以</option></select></label>`;
        const activeKey = currentAnalysisKey();
        if (activeKey !== key) { card.setAttribute("aria-disabled", "true"); card.querySelectorAll("input,select").forEach((node) => { node.disabled = true; node.setAttribute("aria-disabled", "true"); }); }
        host.append(card);
      });
      q("to-predict")?.toggleAttribute("disabled", !Persistence.hasAllAnalysisFields(state));
      q("to-predict")?.classList.toggle("is-hidden", Boolean(state.fromReview));
      renderGraph();
    }
    function collectAnalysisDraft() {
      const draft = ensureAnalysisDraft(); if (!draft) return null;
      const key = currentAnalysisKey(); const card = document.querySelector(`[data-analysis-task="${key}"]`); if (!card) return draft;
      draft[key] ||= {};
      card.querySelectorAll("[data-analysis-field]").forEach((input) => { const field = input.dataset.analysisField; if (["startIndex", "endIndex", "markerIndex"].includes(field)) draft[key][field] = Math.round(Number(input.value)); else if (field === "estimatedFsMaxCN" || field === "estimatedFkCN") draft[key][field] = input.value === "" ? null : Math.round(Number(input.value) * 100); else draft[key][field] = input.value || null; });
      if (key !== "breakaway") { const selection = Graph.normalizeSelection(state.trial, draft[key].startIndex, draft[key].endIndex); draft[key].startIndex = selection.startIndex; draft[key].endIndex = selection.endIndex; }
      return draft;
    }
    function persistAnalysisDraft() {
      const draft = collectAnalysisDraft(); const key = currentAnalysisKey(); if (!draft || !key || !draft[key]) return false;
      state = state.fromReview ? Persistence.transitions.setAnalysisDraft(state, key, draft[key]) : Persistence.transitions.setAnalysisTask(state, key, draft[key]);
      saveDraft(); return true;
    }
    function commitAnalysisDraft(draft) {
      const key = currentAnalysisKey(); if (!draft || !key || !Persistence.analysisTaskComplete(key, draft[key])) return false;
      const editingReview = state.fromReview;
      state = Persistence.transitions.setAnalysisTask(state, key, draft[key]);
      if (!editingReview && state.phase === "analysis" && state.working.activeAnalysisTask < Persistence.ANALYSIS_KEYS.length - 1) state = Persistence.transitions.advanceAnalysisTask(state);
      analysisDraft = null;
      return true;
    }
    function renderPredictions() {
      const host = q("predictionCards"); if (!host || !scenario) return;
      host.replaceChildren();
      const answers = state.predictions.map((answer, index) => state.fromReview && state.working?.editDraft?.kind === "prediction" && state.working.reviewEditTarget?.semanticKey === index ? state.working.editDraft.value : answer) || predictionDraft;
      scenario.predictions.forEach((spec, index) => {
        const response = answers[index] || {}; const card = document.createElement("article"); card.className = "prediction-card"; card.dataset.predictionIndex = index;
        card.innerHTML = `<p class="task-title">${spec.id}：拉力 ${spec.pullN.toFixed(1)} N；物體目前速度 ${spec.velocityMps.toFixed(2)} m/s</p><label>摩擦力類型<select data-prediction-field="frictionType"><option value="">請選擇</option><option value="none" ${response.frictionType === "none" ? "selected" : ""}>沒有摩擦力</option><option value="static" ${response.frictionType === "static" ? "selected" : ""}>靜摩擦力</option><option value="kinetic" ${response.frictionType === "kinetic" ? "selected" : ""}>滑動摩擦力</option></select></label><label>方向<select data-prediction-field="direction"><option value="">請選擇</option><option value="none" ${response.direction === "none" ? "selected" : ""}>沒有方向</option><option value="left" ${response.direction === "left" ? "selected" : ""}>向左</option><option value="right" ${response.direction === "right" ? "selected" : ""}>向右</option></select></label><label>摩擦力大小（N）<input type="number" min="0" max="12" step="0.01" value="${response.magnitudeCN == null ? "" : response.magnitudeCN / 100}" data-prediction-field="magnitudeCN"></label><label>運動結果<select data-prediction-field="motionOutcome"><option value="">請選擇</option><option value="remain-still" ${response.motionOutcome === "remain-still" ? "selected" : ""}>保持靜止</option><option value="start-sliding" ${response.motionOutcome === "start-sliding" ? "selected" : ""}>開始滑動</option><option value="speed-up" ${response.motionOutcome === "speed-up" ? "selected" : ""}>加速</option><option value="slow-down" ${response.motionOutcome === "slow-down" ? "selected" : ""}>減速</option></select></label><button type="button" data-action="save-prediction">保存這題預測</button>`;
        if (response.committed && !state.fromReview) card.insertAdjacentHTML("beforeend", index < scenario.predictions.length - 1 ? `<button type="button" data-action="advance-prediction">下一題</button>` : "");
        const targetIndex = currentPredictionIndex();
        if (index !== targetIndex) card.querySelectorAll("select,input,button").forEach((node) => { node.disabled = true; node.setAttribute("aria-disabled", "true"); });
        host.append(card);
      });
      const activeIndex = currentPredictionIndex(); const magnitude = answers[activeIndex]?.magnitudeCN;
      const predictionHandle = q("predictionFriction");
      if (predictionHandle) predictionHandle.setAttribute("aria-label", `預測 ${activeIndex + 1} 的摩擦力大小，目前 ${magnitude == null ? "未輸入" : `${(magnitude / 100).toFixed(2)} 牛頓`}`);
      q("to-review")?.toggleAttribute("disabled", !Persistence.hasAllPredictions(state));
      q("to-review")?.classList.toggle("is-hidden", Boolean(state.fromReview));
    }
    function collectPredictionDraft(card) {
      if (!card || !state || !scenario) return;
      const index = Number(card.dataset.predictionIndex);
      if (!Number.isInteger(index)) return;
      const values = {};
      card.querySelectorAll("[data-prediction-field]").forEach((input) => { values[input.dataset.predictionField] = input.dataset.predictionField === "magnitudeCN" ? (input.value === "" ? null : Math.round(Number(input.value) * 100)) : (input.value || null); });
      try {
        state = Persistence.transitions.setPrediction(state, index, { id: scenario.predictions[index].id, scenarioId: scenario.predictions[index].scenarioId, frictionType: values.frictionType, direction: values.direction, magnitudeCN: values.magnitudeCN, motionOutcome: values.motionOutcome, committed: false });
        saveDraft();
      } catch {}
    }
    function renderReview() {
      const host = q("reviewSummary"); if (!host || !state) return;
      const complete = Persistence.hasCompleteAnswer(state);
      const balanceEditButtons = state.balance.observations.map((observation) => `<button type="button" data-action="edit-balance-observation" data-observation-id="${observation.id}">修改${observation.id === "zero-pull" ? "無拉力" : observation.id === "static-low" ? "較小非零拉力" : "較大非零拉力"}</button>`).join("");
      host.innerHTML = `<ul><li>力平衡觀察：${state.balance.observations.length}/3</li><li>實驗記錄：${state.trial ? "已保留" : "未完成"}</li><li>圖像分析：${Persistence.hasAllAnalysisFields(state) ? "五項已保存" : "尚未完整"}</li><li>預測：${state.predictions.filter(Boolean).length}/4</li></ul><p class="${complete ? "result-good" : "result-neutral"}">${complete ? "作答資料完整，可以提交。" : "尚有作答資料未完成；提交按鈕會保持鎖定。"}</p><div class="review-balance-edits">${balanceEditButtons}</div>`;
      q("submit")?.toggleAttribute("disabled", !complete);
      const analysisButtons = q("analysisEditButtons");
      if (analysisButtons) analysisButtons.innerHTML = Persistence.ANALYSIS_KEYS.map((key, index) => `<button type="button" data-action="edit-analysis" data-analysis-key="${key}">修改 C${index + 1}</button>`).join("");
      const predictionButtons = q("predictionEditButtons");
      if (predictionButtons) predictionButtons.innerHTML = state.predictions.map((prediction, index) => `<button type="button" data-action="edit-predict" data-prediction-index="${index}">修改預測 ${index + 1}</button>`).join("");
      q("submit")?.classList.toggle("is-hidden", presentation !== "editable");
      q("cancelReviewEdit")?.classList.toggle("is-hidden", !state.fromReview);
    }
    function renderResult() {
      const panel = q("resultPanel"); if (!panel || !latestResult || !mayRevealCorrectness(presentation)) return;
      const label = latestResult.passed === true ? "已通過" : latestResult.passed === false ? "未通過" : "未能安全判斷合格狀態";
      panel.classList.remove("is-hidden");
      const explanation = scenario ? `<details><summary>物理解釋與各部分分數</summary><p>提交後才顯示的模擬設定：質量 ${scenario.massKg.toFixed(1)} kg；最大靜摩擦力約 ${scenario.staticLimitMeanN.toFixed(2)} N；平均滑動摩擦力約 ${scenario.kineticFrictionMeanN.toFixed(2)} N。</p></details>` : "<p>此頁只顯示可信的 Moodle 成績摘要；原始活動答案未被信任。</p>";
      const finishRetry = presentation === "submitted-committed" ? '<button type="button" data-action="retry-finish">重試完成提交</button>' : "";
      panel.innerHTML = `<h2>${scenario ? "本次提交結果" : "已完成的 Moodle 成績摘要"}</h2><p class="result-score">${latestResult.score == null ? "—" : `${latestResult.score} / ${latestResult.maxScore}`}</p><p class="${latestResult.passed ? "result-good" : "result-neutral"}">${label}</p><ul>${(latestResult.feedbackItems || []).map((item) => `<li>${item}</li>`).join("")}</ul>${explanation}${finishRetry}`;
    }
    function render() {
      if (typeof document === "undefined") return;
      updatePills();
      if (!state) { showPanel(null); renderResult(); }
      else {
        showPanel(presentation === "trusted-finished-review" || presentation.startsWith("submitted") ? "review" : state.phase); renderApparatus(); renderBalance();
        if (state.phase === "experiment" && recorder?.trace) renderQuality(); if (state.phase === "analysis") { renderAnalysisTasks(); renderDataTable(); } if (state.phase === "predict") renderPredictions(); if (state.phase === "review") renderReview(); renderResult();
      }
      const experimentReview = state?.fromReview && state.working?.reviewEditTarget?.section === "experiment";
      q("experimentRunActions")?.classList.toggle("is-hidden", Boolean(experimentReview || redoConfirmationVisible));
      q("redoExperimentConfirm")?.classList.toggle("is-hidden", !experimentReview && !redoConfirmationVisible);
      q("to-analysis")?.classList.toggle("is-hidden", Boolean(experimentReview || redoConfirmationVisible));
      q("gripControls")?.classList.toggle("is-hidden", Boolean(experimentReview || redoConfirmationVisible));
      if (redoConfirmationVisible || experimentReview) q("keepTrial")?.classList.add("is-hidden");
      q("startRecording")?.toggleAttribute("disabled", state?.phase !== "experiment" || Boolean(state?.fromReview) || Boolean(state?.trial) || Boolean(recorder?.running) || Boolean(recorder?.trace));
      q("stopRecording")?.toggleAttribute("disabled", state?.phase !== "experiment" || !recorder?.running || Boolean(state?.fromReview));
      q("requestRedoExperiment")?.toggleAttribute("disabled", state?.phase !== "experiment" || Boolean(recorder?.running) || (!state?.trial && !recorder?.trace));
      q("to-analysis")?.toggleAttribute("disabled", !state?.trial);
      q("technicalPanel")?.classList.toggle("is-hidden", !["technical", "frozen", "load-error"].includes(presentation));
      const technicalActions = q("technicalActions");
      if (technicalActions) technicalActions.innerHTML = presentation === "frozen" && pendingRetryAvailable ? '<button type="button" data-action="retry-pending" class="primary-button">重試提交</button>' : "";
      q("cancelReviewEdit")?.classList.toggle("is-hidden", !state?.fromReview || presentation !== "editable");
      q("app")?.setAttribute("data-presentation", presentation);
      renderDragTargets();
      setLockedPresentation(["technical", "frozen", "load-error", "trusted-finished-review", "submitted-success", "submitted-committed"].includes(presentation));
    }
    function applyAttempt(attempt) {
      const interruptedRecording = consumeInterruptedRecording();
      stopLoop(); recorder = null; fixedRunner = null; previousFrameMs = null; inputTimeOriginMs = null; dragging = null; breakawayAnnounced = false; tableCursorIndex = null; predictionDraft = [];
      const startup = routeStartup(attempt);
      if (startup === "review") {
        try {
          const envelope = attempt.snapshot; state = Persistence.decodeSnapshot(envelope, null, "review"); scenario = Generator.generateScenario({ seed: state.seed }); state = Persistence.decodeSnapshot(envelope, scenario, "review");
          const computed = Scoring.scoreAnswer(state, scenario);
          const Flow = typeof SimActivityFlow !== "undefined" ? SimActivityFlow : null;
          const trust = Flow?.reviewResult ? Flow.reviewResult(computed, { score: envelope.score, passed: envelope.passed }, attempt) : { trusted: true, result: computed };
          latestResult = trust.result;
          if (trust.trusted) { presentation = "trusted-finished-review"; resetIdleRig(scenario.connector.restLengthM); render(); return true; }
          state = null; scenario = null; presentation = "trusted-finished-review"; render(); return false;
        } catch (error) {
          const Flow = typeof SimActivityFlow !== "undefined" ? SimActivityFlow : null;
          state = null; scenario = null; latestResult = Flow?.recordedResult ? { ...Flow.recordedResult(attempt), maxScore: 100, feedbackItems: [] } : { score: Number(attempt?.score) || null, maxScore: 100, passed: attempt?.status === "passed", feedbackItems: [] };
          presentation = "trusted-finished-review"; render(); return false;
        }
      }
      if (startup === "editable") {
        try {
          if (attempt.state === "draft" && attempt.snapshot) { state = Persistence.decodeSnapshot(attempt.snapshot, null, "draft"); scenario = Generator.generateScenario({ seed: state.seed }); state = Persistence.decodeSnapshot(attempt.snapshot, scenario, "draft"); }
          else { scenario = Generator.generateScenario({ seed: randomSeed() }); state = Persistence.freshState(scenario.seed); }
          presentation = "editable"; latestResult = null; analysisDraft = null; redoConfirmationVisible = false;
          if (q("gripPosition")) q("gripPosition").value = String(scenario.connector.restLengthM);
          resetIdleRig(scenario.connector.restLengthM);
          if (typeof SimScorm !== "undefined" && SimScorm.setDraftProvider) SimScorm.setDraftProvider(() => SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encodeDraft(state)));
          render();
          if (interruptedRecording && state.phase === "experiment" && !state.trial) setText("experimentStatus", "上次實驗記錄未完成，請重新開始這次記錄。");
          return true;
        } catch (error) { presentation = "technical"; createTechnicalApp(error); return false; }
      }
      if (startup === "frozen") {
        try {
          pendingRetryAvailable = true;
          const payload = attempt.snapshot?.payload; const nested = JSON.parse(payload?.reviewJson || "null");
          const frozenState0 = Persistence.decodeSnapshot(nested, null, "review"); const frozenScenario = Generator.generateScenario({ seed: frozenState0.seed }); const frozenState = Persistence.decodeSnapshot(nested, frozenScenario, "review"); const frozenResult = Scoring.scoreAnswer(frozenState, frozenScenario);
          const sameReview = JSON.stringify(Persistence.encodeReview(frozenState)) === JSON.stringify(nested.answer);
          const sameResult = Number(payload.score) === frozenResult.score && Number(payload.maxScore || 100) === frozenResult.maxScore && Boolean(payload.passed) === Boolean(frozenResult.passed);
          if (!sameReview || !sameResult) throw new Error("pending-final canonical answer mismatch");
          scenario = frozenScenario; state = frozenState; latestResult = frozenResult;
          if (typeof SimScorm !== "undefined" && SimScorm.retryPending) {
            const outcome = SimScorm.retryPending();
            if (outcome.ok || outcome.committed) { pendingRetryAvailable = false; presentation = outcome.finished ? "submitted-success" : "submitted-committed"; render(); return true; }
          }
          presentation = "frozen";
        } catch (error) {
          try { if (typeof SimScorm !== "undefined") SimScorm.quarantinePending?.(); } catch {}
          pendingRetryAvailable = false;
          presentation = "frozen";
        }
        if (typeof document !== "undefined") { setText("technicalTitle", "提交狀態暫時凍結"); setText("technicalMessage", "技術提交尚未能安全完成；操作及分數均未確認，請稍後重試。"); } render(); return false;
      }
      presentation = "load-error"; if (typeof document !== "undefined") { setText("technicalTitle", "活動暫時鎖定"); setText("technicalMessage", "無法安全讀取這次活動；操作及分數均未確認。"); } render(); return false;
    }
    function focusAfterAction(action) {
      if (["to-experiment", "to-analysis", "to-predict", "to-review", "edit-balance", "edit-balance-observation", "edit-experiment", "edit-analysis", "edit-predict", "cancel-review-edit"].includes(action)) { focusPhase(); return; }
      if (action === "tare") { focusNode(q("recordBalance")); return; }
      if (action === "record-balance") { focusNode(q("balanceType")); return; }
      if (action === "save-balance-answer") { focusNode(Persistence.allBalanceAnswersCommitted(state) ? q("to-experiment") : q("recordBalance")); return; }
      if (action === "save-analysis") { focusNode(q(`[data-analysis-task="${currentAnalysisKey()}"]`)?.querySelector("input,select")); return; }
      if (action === "advance-prediction") { focusNode(q(`[data-prediction-index="${currentPredictionIndex()}"]`)?.querySelector("select,input")); return; }
      if (["previous-extremum", "next-extremum", "jump-selection-start", "jump-selection-end"].includes(action)) { focusNode(q(`[data-sample-index="${tableCursorIndex}"]`)); return; }
      if (action === "request-redo-experiment") focusNode(q("redoExperimentTitle"));
    }
    function validationMessage(action) {
      if (action === "save-balance-answer") return "請先明確選擇摩擦力類型、方向及大小，然後再保存。";
      if (action === "record-balance") return "目前狀態未能記錄；請按上方提示調整握把或先完成上一筆判斷。";
      if (action === "save-analysis") return "請完成目前圖像項目的選區、數值及判斷，然後再保存。";
      if (action === "save-prediction") return "請完成這題的摩擦力類型、方向、大小及運動結果，然後再保存。";
      return "目前操作未能保存；請檢查這一階段的資料是否完整。";
    }
    function wireEvents() {
      if (typeof document === "undefined") return;
      document.addEventListener("click", (event) => {
        const action = event.target.closest?.("[data-action]")?.dataset.action; if (!action || !state) return;
          if (["technical", "load-error", "trusted-finished-review", "submitted-success"].includes(presentation) || (presentation === "frozen" && action !== "retry-pending") || (presentation === "submitted-committed" && action !== "retry-finish")) return;
        try {
          q("validationStatus")?.classList.add("is-hidden"); setText("validationStatus", "");
          if (action === "tare") { physicsState ||= Physics.createInitialState(scenario); measurementState ||= Measurement.createMeasurementState(scenario); measurementState = Measurement.tare(measurementState, physicsState, scenario); state = Persistence.transitions.setTare(state, measurementState.tareCorrectionCN); resetIdleRig(scenario.connector.restLengthM); setText("balanceStatus", "測力計已歸零。現在可以記錄第一個靜止狀態。"); announce("測力計已歸零"); saveDraft(); }
          else if (action === "record-balance") {
            const reading = Measurement.liveReading(measurementState || Measurement.createMeasurementState(scenario)); const first = state.balance.observations.length === 0;
            const staticState = !idleRigMoved && physicsState?.contact?.mode === "static" && Math.abs(physicsState?.block?.velocityMps || 0) <= Measurement.MAX_STATIC_ABS_VELOCITY_MPS && reading.velocityMMps <= Math.round(Measurement.MAX_STATIC_ABS_VELOCITY_MPS * 1000);
            const slack = (physicsState?.connector?.extensionM || 0) <= 1e-9;
            if (first && (!slack || reading.forceCN !== 0 || !staticState)) { setText("balanceStatus", "第一筆需要在繩保持鬆弛、物體靜止及測力計為零時記錄。"); throw new Error("zero observation requires a tared slack state"); }
            if (!first && (!staticState || reading.forceCN <= 0)) { setText("balanceStatus", "目前狀態不是可記錄的非零靜止狀態；請調整握把並保持物體靜止。"); throw new Error("nonzero observation requires a measured static state"); }
            try { state = Persistence.transitions.recordObservation(state, { id: first ? "zero-pull" : "static-1", measuredPullCN: reading.forceCN, measuredVelocityMMps: reading.velocityMMps, learnerForce: null }); }
            catch (error) { setText("balanceStatus", /too close/.test(error.message) ? "第二次記錄的拉力需要和第一次有較明顯差別。" : "目前狀態未能記錄；請先完成上一筆判斷。"); throw error; }
            if (q("balanceType")) q("balanceType").value = ""; if (q("balanceDirection")) q("balanceDirection").value = ""; if (q("balanceMagnitude")) q("balanceMagnitude").value = "0";
            setText("balanceStatus", "已記錄此刻的實際測力計與速度狀態；請保存你自己的水平力判斷。"); saveDraft();
          }
          else if (action === "save-balance-answer") { const id = q("balanceAnswer")?.dataset.observationId; const type = q("balanceType")?.value || null; const direction = type === "none" ? "none" : q("balanceDirection")?.value || null; const magnitudeCN = Math.round(Number(q("balanceMagnitude")?.value || 0) * 100); if (!type || !direction) throw new Error("explicit balance type and direction required"); state = Persistence.transitions.setObservationAnswer(state, id, { frictionType: type, direction, frictionMagnitudeCN: type === "none" ? 0 : magnitudeCN, operationDeltaCN: type === "none" ? 0 : magnitudeCN, committed: true }); if (q("balanceType")) q("balanceType").value = ""; if (q("balanceDirection")) q("balanceDirection").value = ""; if (q("balanceMagnitude")) q("balanceMagnitude").value = "0"; setText("balanceStatus", "已保存你自己的力平衡判斷。"); saveDraft(); }
          else if (action === "to-experiment") { state = Persistence.transitions.setPhase(state, "experiment"); if (q("gripPosition")) q("gripPosition").value = String(scenario.connector.restLengthM); resetIdleRig(scenario.connector.restLengthM); saveDraft(); }
          else if (action === "start-recording") startRecording();
          else if (action === "stop-recording") stopRecording();
          else if (action === "request-redo-experiment") { redoConfirmationVisible = true; }
          else if (action === "cancel-redo-experiment") { redoConfirmationVisible = false; if (state.fromReview) state = Persistence.transitions.cancelReviewEdit(state); }
          else if (action === "confirm-redo-experiment") { state = Persistence.transitions.redoExperiment(state); recorder = null; redoConfirmationVisible = false; stopLoop(); markRecordingActive(false); if (q("gripPosition")) q("gripPosition").value = String(scenario.connector.restLengthM); resetIdleRig(scenario.connector.restLengthM); saveDraft(); setText("experimentStatus", "已清除這次實驗的圖像分析及預測，請重新開始記錄。"); }
          else if (action === "keep-trial") { if (recorder?.trace && Measurement.assessTrial(recorder.trace).valid) { state = Persistence.transitions.acceptTrial(state, recorder.trace); analysisDraft = null; saveDraft(); } }
          else if (action === "to-analysis") { if (state.trial) { state = Persistence.transitions.setPhase(state, "analysis"); analysisDraft = null; saveDraft(); } }
          else if (["previous-extremum", "next-extremum", "jump-selection-start", "jump-selection-end"].includes(action)) { if (!moveTableCursor(action)) throw new Error("no matching data-table destination"); }
          else if (action === "save-analysis") { const draft = collectAnalysisDraft(); if (!commitAnalysisDraft(draft)) throw new Error("complete the active analysis task before saving"); saveDraft(); announce("區段已記錄"); }
          else if (action === "to-predict") { if (!Persistence.hasAllAnalysisFields(state)) throw new Error("analysis incomplete"); state = Persistence.transitions.setPhase(state, "predict"); analysisDraft = null; saveDraft(); }
          else if (action === "save-prediction") { const card = event.target.closest("[data-prediction-index]"); const index = Number(card.dataset.predictionIndex); const values = {}; card.querySelectorAll("[data-prediction-field]").forEach((input) => { values[input.dataset.predictionField] = input.dataset.predictionField === "magnitudeCN" ? (input.value === "" ? null : Math.round(Number(input.value) * 100)) : input.value || null; }); if (!values.frictionType || !values.direction || values.magnitudeCN == null || !values.motionOutcome) throw new Error("complete every prediction field"); state = Persistence.transitions.setPrediction(state, index, { id: scenario.predictions[index].id, scenarioId: scenario.predictions[index].scenarioId, ...values, committed: true }); saveDraft(); }
          else if (action === "advance-prediction") { state = Persistence.transitions.advancePrediction(state); saveDraft(); }
          else if (action === "to-review") { if (Persistence.hasAllPredictions(state)) { state = Persistence.transitions.setPhase(state, "review"); saveDraft(); } }
          else if (action === "edit-balance") { state = Persistence.transitions.enterReviewEdit(state, "balance", state.balance.observations[0]?.id || "zero-pull"); saveDraft(); }
          else if (action === "edit-balance-observation") { state = Persistence.transitions.enterReviewEdit(state, "balance", event.target.closest("[data-observation-id]")?.dataset.observationId || "zero-pull"); saveDraft(); }
          else if (action === "edit-experiment") { state = Persistence.transitions.enterReviewEdit(state, "experiment", null); redoConfirmationVisible = true; saveDraft(); }
          else if (action === "edit-analysis") { state = Persistence.transitions.enterReviewEdit(state, "analysis", event.target.closest("[data-analysis-key]")?.dataset.analysisKey); analysisDraft = null; saveDraft(); }
          else if (action === "edit-predict") { state = Persistence.transitions.enterReviewEdit(state, "predict", Number(event.target.closest("[data-prediction-index]")?.dataset.predictionIndex ?? 0)); saveDraft(); }
          else if (action === "cancel-review-edit") { state = Persistence.transitions.cancelReviewEdit(state); analysisDraft = null; redoConfirmationVisible = false; saveDraft(); }
          else if (action === "retry-finish") { const outcome = typeof SimScorm !== "undefined" ? SimScorm.retryFinish?.() : null; if (outcome?.ok) { presentation = "submitted-success"; render(); } else if (outcome?.committed) { setText("submitStatus", "完成程序仍未成功；已保留鎖定結果，可稍後重試。"); } }
          else if (action === "retry-pending") { const outcome = typeof SimScorm !== "undefined" ? SimScorm.retryPending?.() : null; if (outcome?.ok || outcome?.committed) { pendingRetryAvailable = false; presentation = outcome.finished ? "submitted-success" : "submitted-committed"; render(); } else { setText("technicalMessage", "技術提交仍未完成；操作及分數均未確認，請稍後再試。"); } }
          else if (action === "submit") submit();
          render();
          focusAfterAction(action);
        } catch (error) { console.warn(error); render(); const status = q("validationStatus"); if (status) { status.textContent = validationMessage(action); status.classList.remove("is-hidden"); focusNode(status); } }
      });
      q("balanceMagnitude")?.addEventListener("input", (event) => { setText("balanceMagnitudeValue", `${Number(event.target.value).toFixed(2)} N`); renderApparatus(); });
      q("balanceType")?.addEventListener("change", renderApparatus); q("balanceDirection")?.addEventListener("change", renderApparatus);
      q("gripPosition")?.addEventListener("input", (event) => { if (recorder?.running && fixedRunner) { const raw = Number(event.timeStamp); const now = typeof performance !== "undefined" ? performance.now() : 0; const pageMs = Number.isFinite(raw) && raw > 0 && raw < 1e9 ? raw : now; const origin = inputTimeOriginMs ?? pageMs; const timeS = Math.max(fixedRunner.getState().timeS, (pageMs - origin) / 1000); Physics.enqueueInput(fixedRunner.queue, { timeS, handleTargetPositionM: Number(event.target.value) }); } else if (state?.phase === "balance" || state?.phase === "experiment") resetIdleRig(Number(event.target.value)); renderApparatus(); });
      let stageTouchY = null;
      q("stage")?.addEventListener("touchstart", (event) => { if (event.touches.length === 1 && !event.target.closest?.(".drag-target")) stageTouchY = event.touches[0].clientY; }, { passive: true });
      q("stage")?.addEventListener("touchmove", (event) => { if (stageTouchY == null || event.touches.length !== 1 || event.target.closest?.(".drag-target")) return; const y = event.touches[0].clientY; const delta = stageTouchY - y; stageTouchY = y; hostSwipe(event, delta); }, { passive: true });
      q("stage")?.addEventListener("touchend", () => { stageTouchY = null; }, { passive: true });
      let panelTouchY = null;
      let panelTouchStartY = null;
      let panelTouchMoved = false;
      let panelHostScrollY = null;
      let panelHostOverflow = null;
      let panelHostBodyOverflow = null;
      let panelHostOverscroll = null;
      let panelHostBodyOverscroll = null;
      let panelHostTouchAction = null;
      let panelHostBodyTouchAction = null;
      let panelHostRestoreTimer = null;
      q("controlPanel")?.addEventListener("touchstart", (event) => {
        if (event.touches.length !== 1) return;
        panelTouchY = event.touches[0].clientY;
        panelTouchStartY = panelTouchY;
        panelTouchMoved = false;
        try {
          panelHostScrollY = window.parent.scrollY;
          const root = window.parent.document?.documentElement;
          const body = window.parent.document?.body;
          panelHostOverflow = root ? root.style.overflow : null;
          panelHostBodyOverflow = body ? body.style.overflow : null;
          panelHostOverscroll = root ? root.style.overscrollBehavior : null;
          panelHostBodyOverscroll = body ? body.style.overscrollBehavior : null;
          panelHostTouchAction = root ? root.style.touchAction : null;
          panelHostBodyTouchAction = body ? body.style.touchAction : null;
          if (root) root.style.overflow = "hidden";
          if (body) body.style.overflow = "hidden";
          if (root) root.style.overscrollBehavior = "none";
          if (body) body.style.overscrollBehavior = "none";
        } catch { panelHostScrollY = null; panelHostOverflow = null; panelHostBodyOverflow = null; panelHostOverscroll = null; panelHostBodyOverscroll = null; panelHostTouchAction = null; panelHostBodyTouchAction = null; }
        notifyPanelHost("start");
        if (panelHostScrollY != null) try { window.parent.scrollTo(0, panelHostScrollY); } catch {}
      }, { passive: false });
      q("controlPanel")?.addEventListener("touchmove", (event) => {
        if (panelTouchY == null || event.touches.length !== 1) return;
        const panel = q("controlPanel"); const y = event.touches[0].clientY; const delta = panelTouchY - y; panelTouchY = y;
        if (!panelTouchMoved && Math.abs(y - panelTouchStartY) < 2) return;
        panelTouchMoved = true;
        panel.scrollTop = clamp(panel.scrollTop + delta, 0, Math.max(0, panel.scrollHeight - panel.clientHeight));
        // An iframe's native pan chain may otherwise move the Moodle host
        // when the panel is at an edge. Keep this gesture owned by the panel.
        event.preventDefault();
        if (panelHostScrollY != null) try { window.parent.scrollTo(0, panelHostScrollY); } catch {}
      }, { passive: false });
      const finishPanelTouch = () => {
        if (panelHostRestoreTimer != null) clearTimeout(panelHostRestoreTimer);
        const lockedY = panelHostScrollY;
        if (lockedY != null) try { window.parent.scrollTo(0, lockedY); } catch {}
        const restore = () => {
          if (lockedY != null) try {
            window.parent.scrollTo(0, lockedY);
            const root = window.parent.document?.documentElement; const body = window.parent.document?.body;
            if (root && panelHostOverflow != null) { root.style.overflow = panelHostOverflow; root.style.overscrollBehavior = panelHostOverscroll; root.style.touchAction = panelHostTouchAction; }
            if (body && panelHostBodyOverflow != null) { body.style.overflow = panelHostBodyOverflow; body.style.overscrollBehavior = panelHostBodyOverscroll; body.style.touchAction = panelHostBodyTouchAction; }
          } catch {}
          if (lockedY != null) {
            const forceHostPosition = () => { try { window.parent.scrollTo(0, lockedY); } catch {} };
            if (typeof requestAnimationFrame === "function") requestAnimationFrame(forceHostPosition);
            setTimeout(forceHostPosition, 100);
            setTimeout(forceHostPosition, 300);
          }
          panelHostRestoreTimer = null; panelHostScrollY = null; panelHostOverflow = null; panelHostBodyOverflow = null; panelHostOverscroll = null; panelHostBodyOverscroll = null; panelHostTouchAction = null; panelHostBodyTouchAction = null;
        };
        panelTouchY = null; panelTouchStartY = null; panelTouchMoved = false;
        notifyPanelHost("end");
        // Keep the same-host scroll owner locked through the browser's final
        // iframe pan-chain task; restore the host topology on the next quiet
        // turn rather than racing touchend dispatch.
        panelHostRestoreTimer = setTimeout(restore, 400);
      };
      q("controlPanel")?.addEventListener("touchend", finishPanelTouch, { passive: true });
      q("controlPanel")?.addEventListener("touchcancel", finishPanelTouch, { passive: true });
      document.addEventListener("input", (event) => { const field = event.target.dataset?.analysisField; if (field && state?.phase === "analysis") { ensureAnalysisDraft(); try { persistAnalysisDraft(); } catch {} renderGraph(); renderDataTable(); } if (event.target.dataset?.predictionField) collectPredictionDraft(event.target.closest("[data-prediction-index]")); });
      document.addEventListener("change", (event) => { if (event.target.dataset?.analysisField && state?.phase === "analysis") { ensureAnalysisDraft(); try { persistAnalysisDraft(); } catch {} renderGraph(); renderDataTable(); } if (event.target.dataset?.predictionField) collectPredictionDraft(event.target.closest("[data-prediction-index]")); });
      document.addEventListener("keydown", (event) => {
        const target = event.target;
        if (target.id === "forceGrip" && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); const step = event.shiftKey ? .02 : .005; const input = q("gripPosition"); if (input) { input.value = clamp(Number(input.value) + (event.key === "ArrowRight" ? step : -step), .18, 1.4); input.dispatchEvent(new Event("input", { bubbles: true })); } }
        if (target.classList?.contains("drag-target") && target.id !== "forceGrip" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); adjustDragTarget(target.dataset.dragTarget, (event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1), event.shiftKey ? 5 : 1); if (state?.phase === "analysis") persistAnalysisDraft(); saveDraft(); render(); }
        if (target.classList?.contains("drag-target") && event.key === "Escape") cancelDrag();
      });
      document.querySelectorAll(".drag-target").forEach((target) => { target.addEventListener("pointerdown", beginDrag); target.addEventListener("pointermove", moveDrag); target.addEventListener("pointerup", endDrag); target.addEventListener("pointercancel", cancelDrag); });
    }
    function beginDrag(event) { if (event.isPrimary === false || dragging) return; dragging = { target: event.currentTarget, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, checkpoint: clone(state), checkpointDraft: clone(analysisDraft), gripValue: q("gripPosition")?.value, balanceMagnitude: q("balanceMagnitude")?.value, predictionMagnitudes: [...document.querySelectorAll("[data-prediction-field='magnitudeCN']")].map((input) => input.value) }; try { event.currentTarget.setPointerCapture(event.pointerId); } catch {} }
    function adjustDragTarget(target, direction, magnitude = 1) {
      if (target === "force-grip") return;
      if (target === "balance-friction") { const input = q("balanceMagnitude"); if (input) { input.value = clamp(Number(input.value) + direction * magnitude * .05, 0, 12); input.dispatchEvent(new Event("input", { bubbles: true })); } return; }
      if (target === "prediction-friction") { const index = currentPredictionIndex(); const input = q(`#predictionCards [data-prediction-index="${index}"] [data-prediction-field="magnitudeCN"]`); if (input) { input.value = clamp(Number(input.value || 0) + direction * magnitude * 0.05, 0, 12).toFixed(2); input.dispatchEvent(new Event("input", { bubbles: true })); } return; }
      if (!state?.trial) return;
      ensureAnalysisDraft();
      const decoded = Measurement.unpackTrace(state.trial);
      if (target === "breakaway-marker") { analysisDraft.breakaway ||= {}; analysisDraft.breakaway.markerIndex = clamp((analysisDraft.breakaway.markerIndex ?? 0) + direction * magnitude, 0, decoded.merged.length - 1); renderGraph(); return; }
      const match = /^(static|slow|acceleration|fast)-(start|end)$/.exec(target); if (!match) return;
      const key = { static: "staticInterval", slow: "slowPlateau", acceleration: "acceleration", fast: "fastPlateau" }[match[1]]; const field = `${match[2]}Index`; analysisDraft[key] ||= {}; analysisDraft[key][field] = clamp((analysisDraft[key][field] ?? 0) + direction * magnitude, 0, decoded.merged.length - 1); renderGraph();
    }
    function moveDrag(event) { if (!dragging || dragging.target !== event.currentTarget || event.isPrimary === false) return; const target = event.currentTarget.dataset.dragTarget; if (target === "force-grip") { const input = q("gripPosition"); if (input) { input.value = clamp(Number(input.value) + (event.clientX - dragging.startX) / 350, .18, 1.4); dragging.startX = event.clientX; input.dispatchEvent(new Event("input", { bubbles: true })); } } else { const steps = Math.round((event.clientX - dragging.startX) / 10); if (steps) { adjustDragTarget(target, steps > 0 ? 1 : -1, Math.abs(steps)); dragging.startX = event.clientX; } } }
    function endDrag(event) { if (!dragging || dragging.target !== event.currentTarget) return; try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {} if (analysisDraft && state?.phase === "analysis") persistAnalysisDraft(); dragging = null; saveDraft(); render(); }
    function cancelDrag() { if (!dragging) return; try { dragging.target.releasePointerCapture?.(dragging.pointerId); } catch {} if (dragging.checkpoint && state && !recorder?.running) state = dragging.checkpoint; analysisDraft = clone(dragging.checkpointDraft); if (q("gripPosition") && dragging.gripValue != null) { q("gripPosition").value = dragging.gripValue; if (!recorder?.running && (state?.phase === "balance" || state?.phase === "experiment")) resetIdleRig(Number(dragging.gripValue)); } if (q("balanceMagnitude") && dragging.balanceMagnitude != null) q("balanceMagnitude").value = dragging.balanceMagnitude; document.querySelectorAll("[data-prediction-field='magnitudeCN']").forEach((input, index) => { if (dragging.predictionMagnitudes?.[index] != null) input.value = dragging.predictionMagnitudes[index]; }); dragging = null; render(); }
    function hostSwipe(event, delta) { if (event?.target?.closest?.(".drag-target")) return false; try { const host = window.parent; if (host && host !== window && host.scrollBy) { host.scrollBy(0, delta); return true; } } catch {} return false; }
    function notifyPanelHost(phase) {
      try {
        if (window.parent === window) return;
        // Moodle can host the SCO on a different origin.  Prefer the parent
        // origin from the referrer (an explicit launch-origin allow-list),
        // falling back to same-origin development pages.
        const referrerOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
        window.parent.postMessage({ source: "simlab", activity: ACTIVITY, type: "panel-gesture", phase }, referrerOrigin);
      } catch {}
    }
    function reorderForAccessibility() {
      if (typeof document === "undefined") return;
      const shell = document.querySelector(".friction-shell"); const stage = q("stage"); const panel = q("controlPanel");
      // Controls are first in the live reading order while CSS keeps the
      // stage visible above them on phones and to their right on desktop.
      if (shell && panel && stage && shell.firstElementChild !== panel) shell.insertBefore(panel, stage);
    }
    function submit() {
      if (!state || !Persistence.hasCompleteAnswer(state) || typeof SimScorm === "undefined") return;
      const result = Scoring.scoreAnswer(state, scenario); const reviewState = Persistence.normalizeReview(state); const review = Persistence.encodeReview(reviewState); const reviewSnapshot = SimScorm.makeSnapshot(ACTIVITY, "review", review, result);
      const Flow = typeof SimActivityFlow !== "undefined" ? SimActivityFlow : null;
      const callbacks = {
        success: () => { latestResult = result; presentation = "submitted-success"; state = reviewState; render(); setText("submitStatus", "已提交並完成此活動。"); },
        committed: () => { latestResult = result; presentation = "submitted-committed"; state = reviewState; render(); setText("submitStatus", "資料已提交；活動已鎖定，完成程序可稍後重試。"); },
        frozen: () => { pendingRetryAvailable = true; presentation = "frozen"; setText("submitStatus", "技術提交暫時凍結；操作及分數均未確認。"); render(); },
        retry: (outcome) => { if (outcome?.retryable === false) { presentation = "technical"; setText("technicalTitle", "提交前技術檢查失敗"); setText("technicalMessage", "提交前檢查未能安全完成；活動已鎖定，操作及分數均未確認。"); } else setText("submitStatus", "技術提交未完成；請稍後重試，操作及分數均未確認。"); render(); if (outcome?.retryable === false) focusNode(q("technicalTitle")); }
      };
      const handle = (outcome) => routeSubmission(outcome, Flow, callbacks);
      SimScorm.submitWithCallbacks(result, reviewSnapshot, { onSuccess: handle, onFailure: handle });
    }
    function boot(attemptOverride = null) {
      reorderForAccessibility();
      wireEvents();
      let attempt = attemptOverride;
      if (!attempt && typeof SimScorm !== "undefined" && SimScorm.loadAttempt) attempt = SimScorm.loadAttempt(ACTIVITY);
      if (!attempt) attempt = { state: "new" };
      applyAttempt(attempt); return controllerApi;
    }
    const controllerApi = { activity: ACTIVITY, boot, getState: () => clone(state), getScenario: () => scenario, getPresentation: () => presentation, getResult: () => clone(latestResult), mayReveal: () => mayRevealCorrectness(presentation), interactionEvidence: () => ({ dragging: Boolean(dragging), recorderRunning: Boolean(recorder?.running), phase: state?.phase }), render, routeAttempt: applyAttempt, routeStartup, routeSubmission, cancelDrag, hostSwipe };
    return controllerApi;
  }
  function boot() { if (dependencyIssue()) return createTechnicalApp(new Error("missing activity dependency")); return createController().boot(); }
  return Object.freeze({ ACTIVITY, PHASES, PHASE_LABELS, mayRevealCorrectness, buildEditableViewModel, buildResultViewModel, routeStartup, routeSubmission, simulateBalanceRig, localExtremaIndices, createTechnicalApp, createController, boot });
});
