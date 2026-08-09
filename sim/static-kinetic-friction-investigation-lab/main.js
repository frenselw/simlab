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
  const EXPERIMENT_START_POSITION_M = 0;
  const EXPERIMENT_FORCE_SCALE_PX_PER_N = 30;
  const EXPERIMENT_MAX_FORCE_N = 12;
  const EXPERIMENT_ACTIVE_HANDLE_SPEED_LIMIT_MPS = 0.24;
  // Keep the direct post-breakaway interaction easy to control on a narrow
  // phone stage.  This is a velocity-proportional motion response term, not
  // an automatic kinetic-friction force: the learner's pull remains the
  // displayed arrow and measured F拉 value, while the block's net force is
  // integrated with the extra response term.
  const EXPERIMENT_DIRECT_MOTION_DAMPING_NS_PER_M = 36;
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
      balance: clone(state.balance),
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
  function simulateBalanceRig(scenario, targetPositionM) {
    if (!scenario) throw new Error("scenario required");
    const target = clamp(Number(targetPositionM), scenario.connector.restLengthM, scenario.stage.lengthM);
    const simulation = Physics.simulate([{ timeS: 0, handleTargetPositionM: target }], scenario, { durationS: 0.75 });
    let measurement = Measurement.createMeasurementState(scenario);
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
    let directExperimentState = null;
    let experimentAppliedForceN = 0;
    let experimentPullHasBrokenAway = false;
    let experimentForceControlActive = false;
    let experimentAccumulatorS = 0;
    let experimentQuality = null;
    let experimentTimedOut = false;
    let previousFrameMs = null;
    let analysisDraft = null;
    let predictionDraft = [];
    let dragging = null;
    let pendingRetryAvailable = false;
    let idleRigMoved = false;
    let breakawayAnnounced = false;
    let balanceTrialDirection = "right";
    let balanceTrialPullCN = 0;
    let balanceTrialRecorded = false;
    let balanceInteractionMode = "static";
    let balanceDrawMode = "applied";
    let balanceDrawings = { applied: null, friction: null };
    let balanceDrawingsSource = null;
    let balanceMotionRaf = null;
    let balanceMotionActive = false;
    let balanceMotionOffsetM = 0;
    let balanceMotionStartedAtMs = null;
    let balanceDirectState = null;
    let balanceForceEndpointX = null;
    let balanceOffscreen = false;
    let tableCursorIndex = null;
    let stageResizeObserver = null;
    const RECORDING_MARKER = `simlab:${ACTIVITY}:recording-active`;

    const q = (id) => {
      if (typeof document === "undefined") return null;
      const byId = document.getElementById(id);
      if (byId) return byId;
      return /[.#\[\s:]/.test(id) ? document.querySelector(id) : null;
    };
    function setText(id, value) { const node = q(id); if (node) node.textContent = String(value); }
    function clearZeroForceControls() {
      const type = q("zeroFrictionType"); const direction = q("zeroFrictionDirection"); const magnitude = q("zeroFrictionMagnitude");
      if (type) type.value = "";
      if (direction) direction.value = "";
      if (magnitude) magnitude.value = "0";
      setText("zeroFrictionMagnitudeValue", "請選擇");
    }
    function svgElement(tag, attrs = {}) { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); return node; }
    function saveDraft() {
      if (presentation !== "editable" || !state || typeof SimScorm === "undefined" || !SimScorm.saveDraft) return false;
      try { return SimScorm.saveDraft(SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encodeDraft(state))); } catch { return false; }
    }
    function announce(text) { const live = q("liveRegion"); if (live) live.textContent = text; }
    function markRecordingActive(active) { try { if (typeof sessionStorage !== "undefined") { if (active) sessionStorage.setItem(RECORDING_MARKER, "1"); else sessionStorage.removeItem(RECORDING_MARKER); } } catch {} }
    function consumeInterruptedRecording() { try { if (typeof sessionStorage === "undefined") return false; const active = sessionStorage.getItem(RECORDING_MARKER) === "1"; sessionStorage.removeItem(RECORDING_MARKER); return active; } catch { return false; } }
    function updatePills() {
      document.querySelectorAll("[data-phase-pill]").forEach((pill) => {
        const current = pill.dataset.phasePill === state?.phase;
        pill.classList.toggle("is-current", current);
        if (pill.matches("button")) pill.setAttribute("aria-current", current ? "step" : "false");
      });
    }
    function showPanel(panel) {
      ["balance", "experiment", "analysis", "predict", "review"].forEach((name) => q(`${name}Panel`)?.classList.toggle("is-hidden", name !== panel));
      q("resultPanel")?.classList.toggle("is-hidden", !mayRevealCorrectness(presentation));
    }
    function navigateToPhase(phase) {
      if (!state || !Persistence.PHASES.includes(phase) || phase === "review") throw new Error("invalid learner task navigation");
      if (state.phase === phase) return;
      if (state.phase === "experiment" && recorder?.running) abortExperimentRecording("已中止未完成的 B 記錄；切換任務後可重新開始。");
      cancelBalanceMotion();
      state = Persistence.transitions.setPhase(state, phase);
      analysisDraft = phase === "analysis" ? null : analysisDraft;
      predictionDraft = phase === "predict" ? [] : predictionDraft;
      tableCursorIndex = phase === "analysis" ? null : tableCursorIndex;
      if (phase === "balance") {
        resetBalanceTrialView();
        resetIdleRig(scenario?.connector?.restLengthM);
      } else if (phase === "experiment") {
        resetExperimentRig();
      }
      saveDraft();
      announce(`已切換到 ${({ balance: "A 力平衡", experiment: "B 實驗", analysis: "C 圖像分析", predict: "D 預測" })[phase] || phase}`);
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
    function balanceCanDragGrip() {
      return false;
    }
    function balanceStaticSpec() {
      return scenario ? { direction: scenario.balancePullDirection, magnitudeCN: scenario.balancePullCN } : { direction: "right", magnitudeCN: 0 };
    }
    function balanceHasStaticTask() {
      return Boolean(state?.phase === "balance" && state.balance.zeroForce?.committed === true && (
        state.fromReview && state.working?.reviewEditTarget?.semanticKey === "static-case" ||
        balanceInteractionMode === "static" ||
        !state.balance.staticCase?.learnerAppliedForce?.committed ||
        !state.balance.staticCase?.learnerForce?.committed
      ));
    }
    function balanceHasBreakawayTask() {
      return Boolean(state?.phase === "balance" && state.balance.staticCase?.learnerAppliedForce?.committed === true && state.balance.staticCase?.learnerForce?.committed === true && !state.fromReview);
    }
    // Direct dragging is quantized to 0.1 N semantic steps, so the first
    // sliding value is reachable rather than an arbitrary centinewton value.
    function balanceBreakawayThresholdCN() { return scenario ? Math.ceil(scenario.staticLimitMeanN * 10) * 10 : 0; }
    function balanceStaticCaseForView() {
      if (!state) return null;
      if (state.fromReview && state.working?.reviewEditTarget?.section === "balance" && state.working.reviewEditTarget.semanticKey === "static-case" && state.working.editDraft?.kind === "balance") return state.working.editDraft.value;
      return state.balance.staticCase;
    }
    function syncBalanceDrawings() {
      const source = balanceStaticCaseForView();
      const key = JSON.stringify(source ? {
        appliedDirection: source.appliedDirection,
        appliedMagnitudeCN: source.appliedMagnitudeCN,
        learnerAppliedForce: source.learnerAppliedForce,
        learnerForce: source.learnerForce
      } : null);
      if (balanceDrawingsSource === key) return;
      balanceDrawingsSource = key;
      balanceDrawings = {
        applied: source?.learnerAppliedForce ? { direction: source.learnerAppliedForce.direction, magnitudeCN: source.learnerAppliedForce.magnitudeCN } : null,
        friction: source?.learnerForce?.frictionType && source.learnerForce.frictionType !== "none" ? { direction: source.learnerForce.direction, magnitudeCN: source.learnerForce.frictionMagnitudeCN } : null
      };
    }
    function signedForce(direction, magnitudeN) { return direction === "left" ? -magnitudeN : direction === "right" ? magnitudeN : 0; }
    function balanceStaticInteractionActive() {
      return balanceHasStaticTask() && (!state?.fromReview || state.working?.reviewEditTarget?.semanticKey === "static-case");
    }
    function balanceDrawnForceN(force) { return force?.magnitudeCN == null ? 0 : force.magnitudeCN / 100; }
    function balanceDirectIsMoving() { return Boolean(balanceDirectState && Math.abs(finite(balanceDirectState.block?.velocityMps)) > 1e-5); }
    function balanceCurrentForceN() {
      if (balanceInteractionMode !== "breakaway" || balanceOffscreen || balanceForceEndpointX == null) return 0;
      return clamp((balanceForceEndpointX - balanceComX()) / 18, -12, 12);
    }
    function resetDirectBalanceState(positionM = 0.72) {
      cancelBalanceMotion();
      balanceDirectState = scenario && Physics.createDirectForceState ? Physics.createDirectForceState(scenario, positionM) : null;
      balanceMotionOffsetM = 0;
      balanceForceEndpointX = null;
      balanceOffscreen = false;
      balanceTrialPullCN = 0;
      balanceTrialRecorded = false;
    }
    function resetBalanceTrialView() {
      resetDirectBalanceState();
      balanceTrialDirection = state?.balance?.breakaway?.bestDirection || scenario?.balancePullDirection || "right";
      balanceInteractionMode = state?.balance?.staticCase?.learnerForce?.committed ? "breakaway" : "static";
    }
    function renderDragTargets() {
      const phase = state?.phase;
      const activeBalance = balanceStaticInteractionActive() || (balanceHasBreakawayTask() && balanceInteractionMode === "breakaway");
      const showExperimentOrigin = phase === "experiment" && !state?.fromReview && Boolean(recorder?.running);
      setTargetVisible("experimentOrigin", showExperimentOrigin);
      q("experimentOrigin")?.classList.toggle("is-coached", showExperimentOrigin);
      setTargetVisible("balanceOrigin", activeBalance && !balanceOffscreen);
      q("balanceOrigin")?.classList.toggle("is-coached", activeBalance);
      setTargetVisible("resetBalanceObject", activeBalance && balanceOffscreen);
      setTargetVisible("predictionFriction", phase === "predict");
      setTargetVisible("breakawayMarker", phase === "analysis" && currentAnalysisKey() === "breakaway");
      const interval = { staticInterval: "static", slowPlateau: "slow", acceleration: "acceleration", fastPlateau: "fast" }[currentAnalysisKey()];
      for (const prefix of ["static", "slow", "acceleration", "fast"]) for (const edge of ["start", "end"]) setTargetVisible(`${prefix}-${edge}`, phase === "analysis" && interval === prefix);
    }
    function renderStageCoach() {
      const coach = q("stageCoach");
      if (!coach || !state || ["analysis", "review"].includes(state.phase)) {
        coach?.classList.add("is-hidden");
        return;
      }
      coach.classList.remove("is-hidden");
      let step = "";
      let title = "";
      let text = "";
      if (state.phase === "balance") {
        if (state.fromReview) {
          const target = state.working?.reviewEditTarget?.semanticKey;
          step = "A"; title = "正在修改 Part A 答案"; text = target === "zero-force" ? "修改 A1：沒有水平拉力時，摩擦力是否存在？" : target === "static-case" ? "修改 A2：重新畫出拉力和摩擦力箭嘴。" : "修改 A3：重新輸入你估計的最大靜摩擦力。";
        } else if (!state.balance.zeroForce) {
          step = "A1"; title = "先判斷沒有水平拉力時的摩擦力"; text = "請在控制欄選擇摩擦力的類型、方向和大小；沒有水平拉力時，摩擦力應為零。";
        } else if (balanceStaticInteractionActive()) {
          step = "A2"; title = "直接由物體中央畫出兩個水平力"; text = `先畫${balanceDrawMode === "friction" ? "摩擦力" : "指定拉力"}；箭嘴長度代表大小，方向要${balanceDrawMode === "friction" ? "與拉力相反" : "符合指定拉力要求"}。`;
        } else if (state.balance.breakaway?.bestPullCN == null) {
          step = "A3"; title = "直接拖拉物體，觀察連續運動"; text = "按住物體中央的拉力箭嘴，讓箭嘴跟手指向左或向右移動；放手會停止施力，物體會按合力加速、勻速、減速或倒轉。";
        } else if (state.balance.breakaway.learnerMaxCN == null) {
          step = "A3✓"; title = "已找到開始滑動的臨界力"; text = "根據你觀察到的臨界值，填寫最大靜摩擦力估計。";
        } else {
          step = "A✓"; title = "Part A 三個概念任務已完成"; text = "可以用上方任務列自由切換到 Part B、C 或 D；之後仍可返回修改 Part A。";
        }
      } else if (state.phase === "experiment") {
        step = recorder?.running ? "B2" : state.trial ? "B✓" : "B1";
        if (state.fromReview) {
          title = "正在修改 Part B 實驗"; text = "按「重新開始」會立即清除舊記錄並開始新的 30 秒拉動。";
        } else if (state.trial) {
          title = "B 記錄已保存"; text = "可以前往 Part C 分析同一張 F拉–t 圖；亦可以自由切換其他任務。";
        } else if (experimentTimedOut) {
          title = "記錄已超時"; text = "請按「重新開始記錄」，再在 30 秒內完成一次可分析的拉動。";
        } else if (experimentQuality && !experimentQuality.valid) {
          title = "這次記錄未能保存"; text = "請按「開始 30 秒記錄」重新嘗試；先讓物體開始移動，再繼續拉一段時間。";
        } else if (recorder?.running) {
          title = "記錄中：由物體中央向右拖動拉力"; text = "按住中央小圓點向右拖；物體開始滑動後仍可再次按住中央，向右加力或向左減力。未到 30 秒不會因物體停低而鎖定。";
        } else {
          title = "先按右邊的「開始 30 秒記錄」"; text = "開始後，按住物體中央的小圓點向右拖動；向右少量移動，向右拉力會少量增加。";
        }
      } else if (state.phase === "predict") {
        step = `D${currentPredictionIndex() + 1}`; title = "拖動藍色箭嘴建立摩擦力"; text = "同時在右邊完成類型、方向、大小和運動結果。";
      }
      setText("stageCoachStep", step);
      setText("stageCoachTitle", title);
      setText("stageCoachText", text);
    }
    function apparatusLayout() {
      const svg = q("apparatusSvg"); const stage = q("stage");
      if (!svg || !stage) return null;
      const svgRect = svg.getBoundingClientRect(); const stageRect = stage.getBoundingClientRect();
      if (!(svgRect.width > 0) || !(svgRect.height > 0)) return null;
      const scale = Math.min(svgRect.width / 900, svgRect.height / 430);
      return {
        scale,
        left: svgRect.left - stageRect.left + (svgRect.width - 900 * scale) / 2,
        top: svgRect.top - stageRect.top + (svgRect.height - 430 * scale) / 2
      };
    }
    function positionApparatusTarget(target, viewX, viewY) {
      const layout = apparatusLayout();
      if (!target || !layout) return;
      target.style.left = `${layout.left + clamp(viewX, 0, 900) * layout.scale}px`;
      target.style.top = `${layout.top + clamp(viewY, 0, 430) * layout.scale}px`;
    }
    function resetIdleRig(targetPositionM = null) {
      if (!scenario) return;
      const target = targetPositionM ?? scenario.connector.restLengthM;
      const rig = simulateBalanceRig(scenario, target);
      physicsState = rig.physicsState; measurementState = rig.measurementState; idleRigMoved = rig.moved;
    }
    function resetExperimentRig(positionM = EXPERIMENT_START_POSITION_M) {
      stopLoop();
      directExperimentState = scenario && Physics.createInitialState ? Physics.createInitialState(scenario) : null;
      if (directExperimentState && Number.isFinite(positionM)) directExperimentState.block.positionM = positionM;
      physicsState = directExperimentState;
      measurementState = scenario ? Measurement.createMeasurementState(scenario) : null;
      experimentAppliedForceN = 0;
      experimentPullHasBrokenAway = false;
      experimentForceControlActive = false;
      experimentAccumulatorS = 0;
      experimentQuality = null;
      experimentTimedOut = false;
      previousFrameMs = null;
      breakawayAnnounced = false;
      q("trialQuality")?.classList.add("is-hidden");
      setText("trialQuality", "");
      markRecordingActive(false);
    }
    function abortExperimentRecording(message = "已中止未完成的 B 記錄；切換任務後可重新開始。") {
      if (recorder?.running) {
        recorder.running = false;
        recorder.stalled = true;
      }
      recorder = null;
      markRecordingActive(false);
      experimentAppliedForceN = 0;
      experimentForceControlActive = false;
      experimentAccumulatorS = 0;
      stopLoop();
      if (message) setText("experimentStatus", message);
    }
    function setExperimentAppliedForce(value) {
      const previousForceN = experimentAppliedForceN;
      experimentAppliedForceN = clamp(finite(value), 0, EXPERIMENT_MAX_FORCE_N);
      if (Math.abs(experimentAppliedForceN - previousForceN) > 0.001 && experimentPullHasBrokenAway && directExperimentState?.contact?.mode === "sliding") {
        experimentForceControlActive = true;
      }
    }
    function experimentHandleTargetPositionM() {
      if (!scenario) return 0.18;
      const blockPositionM = finite(directExperimentState?.block?.positionM, 0);
      return blockPositionM + finite(scenario.connector?.restLengthM, 0.18) + clamp(experimentAppliedForceN, 0, EXPERIMENT_MAX_FORCE_N) / Math.max(1, finite(scenario.connector?.stiffnessNPerM, 300));
    }
    function experimentVisibleForceN() {
      if (!recorder?.running || !directExperimentState || experimentAppliedForceN <= 0.01) return 0;
      return clamp(Math.max(0, finite(directExperimentState.connector?.tensionPhysicalN)), 0, EXPERIMENT_MAX_FORCE_N);
    }
    function resetExperimentHandleToRest() {
      if (!directExperimentState?.handle || !scenario) return;
      const restPositionM = finite(directExperimentState.block?.positionM) + finite(scenario.connector?.restLengthM, 0.18);
      directExperimentState.handle.positionM = restPositionM;
      directExperimentState.handle.targetPositionM = restPositionM;
      directExperimentState.handle.velocityMps = finite(directExperimentState.block?.velocityMps);
      directExperimentState.connector.extensionM = 0;
      directExperimentState.connector.tensionPhysicalN = 0;
    }
    function stepExperimentForceControl(stepS) {
      // The first breakaway is deliberately produced by the spring/connector
      // rig so the measured peak can drop to the kinetic plateau. Once the
      // learner changes the force again while the block is sliding, switch
      // to a direct applied-force hand model: the new force must be able to
      // increase immediately and remain steady while the pointer is held.
      const directInputState = {
        timeS: directExperimentState.timeS,
        block: directExperimentState.block,
        contact: directExperimentState.contact
      };
      const next = Physics.stepDirectForce(
        directInputState,
        experimentAppliedForceN,
        scenario,
        stepS,
        { dampingNsPerM: EXPERIMENT_DIRECT_MOTION_DAMPING_NS_PER_M }
      );
      const stiffness = Math.max(1, finite(scenario.connector?.stiffnessNPerM, 300));
      const extensionM = Math.max(0, experimentAppliedForceN) / stiffness;
      const handlePositionM = next.block.positionM + finite(scenario.connector?.restLengthM, 0.18) + extensionM;
      return {
        ...next,
        handle: { targetPositionM: handlePositionM, positionM: handlePositionM, velocityMps: next.block.velocityMps },
        connector: { extensionM, tensionPhysicalN: Math.max(0, experimentAppliedForceN) },
        contact: { mode: next.contact.mode, frictionPhysicalN: next.contact.frictionPhysicalN }
      };
    }
    function cancelBalanceMotion() {
      if (balanceMotionRaf != null) {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(balanceMotionRaf); else clearTimeout(balanceMotionRaf);
      }
      balanceMotionRaf = null;
      balanceMotionActive = false;
      balanceMotionStartedAtMs = null;
    }
    function balanceObjectOffscreen(positionM) {
      if (!scenario) return false;
      const leftEdgeM = ((35 - 100 - 92) / 650) * scenario.stage.lengthM;
      const rightEdgeM = ((865 - 100) / 650) * scenario.stage.lengthM;
      return positionM < leftEdgeM || positionM > rightEdgeM;
    }
    function balanceMotionStatusText(forceN = balanceCurrentForceN()) {
      if (balanceOffscreen) return "物體已離開畫面；按「物體返回中央」後可以繼續試拉。";
      const velocity = finite(balanceDirectState?.block?.velocityMps);
      const acceleration = finite(balanceDirectState?.block?.accelerationMps2);
      if (Math.abs(velocity) <= 1e-5) return Math.abs(forceN) > 1e-4 ? "拉力未超過最大靜摩擦力，物體仍然靜止；可以繼續改變拉力。" : "物體目前靜止；按住物體中央的箭嘴即可向左或向右施力。";
      if (Math.abs(acceleration) < .035) return "物體正在近似勻速運動；拉力箭嘴仍可即時向左或向右改變。";
      if (velocity * acceleration > 0) return "物體正在加速；拉力箭嘴仍可即時向左或向右改變。";
      return "物體正在減速；反方向施力可以令它停下並倒轉方向。";
    }
    function updateBreakawayReadout(forceN = balanceCurrentForceN()) {
      balanceTrialPullCN = clamp(Math.round(Math.abs(forceN) * 10) * 10, 0, 1200);
      if (balanceTrialPullCN > 0) balanceTrialDirection = forceN < 0 ? "left" : "right";
      setText("breakawayPullValue", `${(balanceTrialPullCN / 100).toFixed(1)} N`);
      setText("breakawayMotionStatus", balanceMotionStatusText(forceN));
    }
    function recordDirectBreakaway(event) {
      if (!balanceHasBreakawayTask() || balanceTrialRecorded) return;
      const pullCN = clamp(Math.round(Math.abs(finite(event?.physicalForceN, balanceDirectState?.appliedForceN)) * 10) * 10, 0, 1200);
      if (pullCN <= 0) return;
      const direction = finite(event?.physicalForceN, balanceDirectState?.appliedForceN) < 0 ? "left" : "right";
      state = Persistence.transitions.recordBreakawayTrial(state, { direction, pullCN });
      balanceTrialDirection = direction;
      balanceTrialPullCN = pullCN;
      balanceTrialRecorded = true;
      saveDraft();
      announce("物體已開始滑動");
    }
    function runBalanceMotionFrame(nowMs) {
      if (!scenario || !balanceDirectState || state?.phase !== "balance" || balanceInteractionMode !== "breakaway" || !balanceHasBreakawayTask() || balanceOffscreen) {
        balanceMotionRaf = null; balanceMotionActive = false; return;
      }
      if (balanceMotionStartedAtMs == null) balanceMotionStartedAtMs = nowMs;
      const frameDurationS = clamp((nowMs - balanceMotionStartedAtMs) / 1000, 0, .05);
      balanceMotionStartedAtMs = nowMs;
      let remainingS = frameDurationS;
      while (remainingS > 1e-8) {
        const stepS = Math.min(remainingS, Physics.PHYSICS_DT_S);
        const forceN = balanceCurrentForceN();
        const next = Physics.stepDirectForce(balanceDirectState, forceN, scenario, stepS);
        for (const event of next.events || []) if (event.type === "breakaway") recordDirectBreakaway(event);
        balanceDirectState = next;
        balanceMotionOffsetM = next.block.positionM - .72;
        if (next.contact.mode === "static" && Math.abs(next.block.velocityMps) <= 1e-5) balanceTrialRecorded = false;
        remainingS -= stepS;
      }
      updateBreakawayReadout(balanceCurrentForceN());
      if (balanceObjectOffscreen(balanceDirectState.block.positionM)) {
        balanceOffscreen = true;
        balanceForceEndpointX = null;
        cancelBalanceMotion();
        renderBalance();
        return;
      }
      renderBalance();
      const keepRunning = Boolean(dragging?.kind === "balance-draw" || balanceDirectIsMoving());
      if (!keepRunning) { balanceMotionRaf = null; balanceMotionActive = false; return; }
      balanceMotionRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(runBalanceMotionFrame) : setTimeout(() => runBalanceMotionFrame(typeof performance !== "undefined" ? performance.now() : Date.now()), 16);
    }
    function ensureBalanceMotionLoop() {
      if (!scenario || !balanceDirectState || balanceInteractionMode !== "breakaway" || balanceOffscreen || balanceMotionRaf != null) return;
      balanceMotionActive = true;
      balanceMotionStartedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      balanceMotionRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(runBalanceMotionFrame) : setTimeout(() => runBalanceMotionFrame(typeof performance !== "undefined" ? performance.now() : Date.now()), 16);
    }
    function appendForceArrow(svg, startX, endX, y, className, color, label, labelY = y - 13) {
      if (Math.abs(endX - startX) < 1) return;
      const marker = className.includes("learner-friction") ? "friction" : "applied";
      svg.append(svgElement("line", { x1: startX, y1: y, x2: endX, y2: y, class: `${className} force-line`, stroke: color, "marker-end": `url(#arrow-${marker})` }));
      const text = svgElement("text", { x: (startX + endX) / 2, y: labelY, "text-anchor": "middle", class: "force-builder-label", fill: color }); text.appendChild(document.createTextNode(label)); svg.append(text);
    }
    function experimentFeedbackText() {
      if (experimentTimedOut) return "時間已經超時，請重新開始記錄。";
      if (!recorder?.running || !directExperimentState) return "按開始後直接拖動物體中央；F拉–t 圖會同步記錄，系統不顯示摩擦力。";
      const speed = Math.abs(finite(directExperimentState.block?.velocityMps));
      const force = experimentVisibleForceN();
      if (directExperimentState.contact?.mode === "static" || speed < 0.015) return force > 0.05 ? "大力啲：拉力仍未令物體開始移動。" : "慢慢增加拉力，直到物體開始移動。";
      if (speed > 0.08) return "細力啲";
      if (speed < 0.025) return "大力啲";
      return "拉力合適，盡量保持勻速直線運動。";
    }
    function renderExperimentForceGraph(svg) {
      const chart = { left: 64, top: 224, width: 772, height: 154, maxTimeS: 30, maxForceN: 12 };
      const xFor = (timeS) => chart.left + clamp(timeS, 0, chart.maxTimeS) / chart.maxTimeS * chart.width;
      const yFor = (forceN) => chart.top + chart.height - clamp(forceN, 0, chart.maxForceN) / chart.maxForceN * chart.height;
      for (let time = 0; time <= chart.maxTimeS; time += 5) {
        const x = xFor(time);
        svg.append(svgElement("line", { x1: x, y1: chart.top, x2: x, y2: chart.top + chart.height, class: "graph-grid" }));
        const label = svgElement("text", { x, y: chart.top + chart.height + 19, "text-anchor": "middle", class: "graph-axis-label" }); label.appendChild(document.createTextNode(String(time))); svg.append(label);
      }
      for (let force = 0; force <= chart.maxForceN; force += 3) {
        const y = yFor(force);
        svg.append(svgElement("line", { x1: chart.left, y1: y, x2: chart.left + chart.width, y2: y, class: "graph-grid" }));
        const label = svgElement("text", { x: chart.left - 10, y: y + 5, "text-anchor": "end", class: "graph-axis-label" }); label.appendChild(document.createTextNode(String(force))); svg.append(label);
      }
      svg.append(svgElement("line", { x1: chart.left, y1: chart.top, x2: chart.left, y2: chart.top + chart.height, class: "graph-axis" }));
      svg.append(svgElement("line", { x1: chart.left, y1: chart.top + chart.height, x2: chart.left + chart.width, y2: chart.top + chart.height, class: "graph-axis" }));
      const yLabel = svgElement("text", { x: 18, y: chart.top + chart.height / 2, transform: `rotate(-90 18 ${chart.top + chart.height / 2})`, "text-anchor": "middle", class: "graph-axis-label" });
      const yF = svgElement("tspan", { "font-style": "italic" }); yF.textContent = "F"; yLabel.append(yF);
      const ySub = svgElement("tspan", { "baseline-shift": "sub", "font-size": "70%" }); ySub.textContent = "拉"; yLabel.append(ySub);
      yLabel.append(document.createTextNode(" / N")); svg.append(yLabel);
      const xLabel = svgElement("text", { x: chart.left + chart.width / 2, y: chart.top + chart.height + 39, "text-anchor": "middle", class: "graph-axis-label" });
      const xT = svgElement("tspan", { "font-style": "italic" }); xT.textContent = "t"; xLabel.append(xT);
      xLabel.append(document.createTextNode(" / s")); svg.append(xLabel);
      const points = (measurementState?.regularSamples || []).map((sample) => ({ timeS: sample.timeS, forceN: sample.measuredPullN }));
      if (directExperimentState && (recorder?.running || experimentTimedOut) && measurementState) {
        const live = Measurement.liveReading(measurementState);
        const timeS = finite(directExperimentState.timeS);
        if (!points.length || timeS > points[points.length - 1].timeS + 0.001) points.push({ timeS, forceN: live.forceN });
        else if (points.length) points[points.length - 1] = { timeS, forceN: live.forceN };
      }
      if (points.length) {
        const path = points.map((point, index) => `${index ? "L" : "M"}${xFor(point.timeS).toFixed(2)},${yFor(point.forceN).toFixed(2)}`).join(" ");
        svg.append(svgElement("path", { d: path, class: "force-line experiment-force-line", "aria-label": "拉力 F拉—時間 t" }));
      }
    }
    function renderApparatus() {
      const svg = q("apparatusSvg"); if (!svg) return;
      const graphMode = state?.phase === "analysis";
      const predictionMode = state?.phase === "predict";
      const balanceMode = state?.phase === "balance";
      const experimentMode = state?.phase === "experiment";
      svg.classList.toggle("is-hidden", graphMode);
      q("stageGraph")?.classList.toggle("is-hidden", !graphMode);
      q("predictionReadout")?.classList.toggle("is-hidden", !predictionMode);
      renderDragTargets();
      renderStageCoach();
      if (graphMode) { renderGraph(); return; }
      svg.replaceChildren();
      const groundY = experimentMode ? 170 : 300;
      const defs = svgElement("defs");
      const groundPattern = svgElement("pattern", { id: "ground-hatch", width: 18, height: 18, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
      groundPattern.append(svgElement("line", { x1: 0, y1: 0, x2: 0, y2: 18, class: "surface-hatch" }));
      defs.append(groundPattern);
      for (const [id, color] of [["applied", "#b91c1c"], ["friction", "#1d4ed8"]]) {
        const marker = svgElement("marker", { id: `arrow-${id}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
        marker.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
        defs.append(marker);
      }
      svg.append(defs);
      svg.append(svgElement("rect", { x: 35, y: groundY, width: 830, height: 35, fill: "url(#ground-hatch)", class: "apparatus-surface" }));
      svg.append(svgElement("line", { x1: 35, y1: groundY, x2: 865, y2: groundY, class: "apparatus-ground-line" }));
      const position = predictionMode ? .45 : balanceMode ? (balanceDirectState?.block?.positionM ?? (.72 + balanceMotionOffsetM)) : experimentMode ? (directExperimentState?.block?.positionM ?? EXPERIMENT_START_POSITION_M) : physicsState?.block?.positionM ?? 0;
      const target = predictionMode ? .95 : physicsState?.handle?.positionM ?? (scenario?.connector.restLengthM || .18);
      const positionFraction = position / (scenario?.stage.lengthM || 1.65);
      const x = balanceMode ? 100 + positionFraction * 650 : experimentMode ? 45 + clamp(positionFraction, 0, 1) * 728 : 100 + clamp(positionFraction, .04, .88) * 650;
      const hx = 100 + clamp(target / (scenario?.stage.lengthM || 1.65), 0, 1) * 650;
      svg.append(svgElement("rect", { x, y: groundY - 54, width: 92, height: 54, rx: 8, class: "apparatus-block" }));
      if (!balanceMode && !experimentMode) {
        svg.append(svgElement("line", { x1: x + 92, y1: groundY - 27, x2: hx, y2: groundY - 27, class: "apparatus-rope" }));
        svg.append(svgElement("rect", { x: hx - 12, y: groundY - 43, width: 34, height: 32, rx: 7, class: "apparatus-grip" }));
      }
      const labels = predictionMode ? [
        [Math.min(830, hx), groundY - 58, "已知向右拉力"],
        [185, 102, "藍色箭嘴是你建立的摩擦力"]
      ] : [];
      labels.forEach(([tx, ty, text]) => { const label = svgElement("text", { x: tx, y: ty, "text-anchor": tx <= 100 ? "start" : "middle" }); label.appendChild(document.createTextNode(text)); svg.append(label); });
      const experimentOrigin = q("experimentOrigin");
      if (experimentMode) {
        const comX = x + 46;
        const comY = groundY - 27;
        const visibleForceN = experimentVisibleForceN();
        const endpoint = clamp(comX + visibleForceN * EXPERIMENT_FORCE_SCALE_PX_PER_N, comX, 880);
        if (visibleForceN > .01) appendForceArrow(svg, comX, endpoint, comY, "pull-arrow", "#b91c1c", `拉力 ${visibleForceN.toFixed(2)} N`, groundY - 64);
        if (experimentOrigin) {
          positionApparatusTarget(experimentOrigin, comX, comY);
          experimentOrigin.setAttribute("aria-label", `由物體中央向右拖動拉力，目前 ${visibleForceN.toFixed(2)} 牛頓`);
        }
        renderExperimentForceGraph(svg);
      }
      if (balanceMode) {
        syncBalanceDrawings();
        const comX = x + 46;
        const comY = groundY - 27;
        const pullLabelY = groundY - 64;
        const frictionLabelY = groundY - 84;
        const scale = 18;
        const readForce = (typeId, directionId, magnitudeId) => {
          const type = q(typeId)?.value || null;
          const direction = type === "none" ? "none" : q(directionId)?.value || null;
          const magnitude = type && type !== "none" ? Number(q(magnitudeId)?.value || 0) : 0;
          return { type, direction, magnitude: Number.isFinite(magnitude) ? magnitude : 0 };
        };
        const signed = (direction, magnitude) => direction === "left" ? -magnitude : direction === "right" ? magnitude : 0;
        if (!state.balance.zeroForce || state.fromReview && state.working?.reviewEditTarget?.semanticKey === "zero-force") {
          const force = readForce("zeroFrictionType", "zeroFrictionDirection", "zeroFrictionMagnitude");
          appendForceArrow(svg, comX, comX + clamp(signed(force.direction, force.magnitude) * scale, -180, 180), comY, "learner-friction-arrow", "#1d4ed8", force.type === "none" ? "摩擦力 0 N" : `摩擦力 ${force.magnitude.toFixed(1)} N`, frictionLabelY);
        }
        if (balanceStaticInteractionActive() && state.balance.zeroForce?.committed) {
          const applied = balanceDrawings.applied;
          const friction = balanceDrawings.friction;
          const appliedN = balanceDrawnForceN(applied);
          const frictionN = balanceDrawnForceN(friction);
          if (applied) appendForceArrow(svg, comX, comX + clamp(signed(applied.direction, appliedN) * scale, -216, 216), comY, "pull-arrow", "#b91c1c", `拉力 ${appliedN.toFixed(1)} N`, pullLabelY);
          if (friction) appendForceArrow(svg, comX, comX + clamp(signed(friction.direction, frictionN) * scale, -216, 216), comY, "learner-friction-arrow", "#1d4ed8", `摩擦力 ${frictionN.toFixed(1)} N`, frictionLabelY);
        }
        if (balanceHasBreakawayTask() && balanceInteractionMode === "breakaway") {
          const pullN = balanceCurrentForceN();
          if (Math.abs(pullN) > .01) {
            const endpoint = balanceForceEndpointX == null ? comX + clamp(pullN * scale, -216, 216) : balanceForceEndpointX;
            appendForceArrow(svg, comX, endpoint, comY, "pull-arrow", "#b91c1c", `目前拉力 ${Math.abs(pullN).toFixed(1)} N`, pullLabelY);
          }
        }
        const originTarget = q("balanceOrigin");
        if (originTarget && (balanceStaticInteractionActive() || balanceHasBreakawayTask() && balanceInteractionMode === "breakaway")) {
          positionApparatusTarget(originTarget, comX, comY);
          originTarget.setAttribute("aria-label", balanceStaticInteractionActive() ? `由物體中央拖出${balanceDrawMode === "friction" ? "摩擦力" : "拉力"}箭嘴` : `由物體中央拖拉，現在拉力 ${(balanceTrialPullCN / 100).toFixed(1)} 牛頓`);
        }
      }
      if (predictionMode) {
        const index = currentPredictionIndex(); const spec = scenario?.predictions?.[index]; const response = currentPredictionResponse();
        const frictionN = Number.isInteger(response?.magnitudeCN) ? response.magnitudeCN / 100 : 0;
        const signedFrictionN = response?.direction === "left" ? -frictionN : response?.direction === "right" ? frictionN : 0;
        const comX = x + 46; const comY = groundY - 27; const pullLabelY = groundY - 64; const frictionLabelY = groundY - 84;
        const scale = 18; const endpoint = comX + clamp(signedFrictionN * scale, -180, 180);
        appendForceArrow(svg, comX, comX + Math.min(180, (spec?.pullN || 0) * scale), comY, "pull-arrow prediction-pull-arrow", "#b91c1c", `已知拉力 ${(spec?.pullN || 0).toFixed(1)} N`, pullLabelY);
        appendForceArrow(svg, comX, comX + clamp(signedFrictionN * scale, -180, 180), comY, "learner-friction-arrow prediction-friction-arrow", "#1d4ed8", `摩擦力 ${frictionN.toFixed(2)} N`, frictionLabelY);
        const predictionHandle = q("predictionFriction"); if (predictionHandle) { positionApparatusTarget(predictionHandle, endpoint, comY); predictionHandle.setAttribute("aria-label", `預測 ${index + 1} 的摩擦力箭嘴，目前 ${response?.magnitudeCN == null ? "未輸入" : `${frictionN.toFixed(2)} 牛頓`}`); }
        setText("predictionReadout", `情境 ${index + 1}：已知向右拉力 ${(spec?.pullN || 0).toFixed(1)} N；初速 ${(spec?.velocityMps || 0).toFixed(2)} m/s；你的摩擦力 ${response?.magnitudeCN == null ? "尚未輸入" : `${frictionN.toFixed(2)} N`}。`);
      }
      setText("experimentFeedback", experimentFeedbackText());
    }
    function renderBalance() {
      if (!state) return;
      const target = state.fromReview && state.working?.reviewEditTarget?.section === "balance" ? state.working.reviewEditTarget.semanticKey : null;
      const zero = target === "zero-force" && state.working?.editDraft?.kind === "balance" ? state.working.editDraft.value : state.balance.zeroForce;
      syncBalanceDrawings();
      const breakawayValue = target === "breakaway" && state.working?.editDraft?.kind === "balance" ? state.working.editDraft.value : state.balance.breakaway?.learnerMaxCN;
      const setValue = (id, value) => { const node = q(id); if (node && value != null) node.value = String(value); };
      if (zero) { setValue("zeroFrictionType", zero.frictionType); setValue("zeroFrictionDirection", zero.direction); setValue("zeroFrictionMagnitude", (zero.frictionMagnitudeCN || 0) / 100); }
      if (breakawayValue != null) setValue("breakawayAnswer", breakawayValue / 100);
      const spec = balanceStaticSpec();
      setText("staticPullPrompt", `指定拉力：${spec.direction === "left" ? "向左" : "向右"} ${ (spec.magnitudeCN / 100).toFixed(1) } N（小於最大靜摩擦力，物體保持靜止）`);
      const zeroTypeSelection = q("zeroFrictionType")?.value || "";
      setText("zeroFrictionMagnitudeValue", zeroTypeSelection ? `${(Number(q("zeroFrictionMagnitude")?.value || 0)).toFixed(1)} N` : "請選擇");
      const best = state.balance.breakaway?.bestPullCN;
      updateBreakawayReadout(balanceCurrentForceN());
      setText("breakawayBest", best == null ? "尚未找到臨界值。" : `你已觀察到開始滑動的臨界拉力約 ${(best / 100).toFixed(1)} N；可繼續向左或向右試拉。`);
      setText("breakawayAttempts", `已完成試拉 ${state.balance.breakaway?.attempts || 0} 次`);
      const applied = balanceDrawings.applied;
      const friction = balanceDrawings.friction;
      const directionText = (direction) => direction === "left" ? "向左" : "向右";
      setText("staticAppliedReadout", applied ? `你的拉力：${directionText(applied.direction)} ${(applied.magnitudeCN / 100).toFixed(1)} N` : "你的拉力：尚未畫出");
      setText("staticFrictionReadout", friction ? `你的摩擦力：${directionText(friction.direction)} ${(friction.magnitudeCN / 100).toFixed(1)} N（靜摩擦力）` : "你的摩擦力：尚未畫出（代表沒有摩擦力）");
      document.querySelectorAll("[data-balance-drawing]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.action === `draw-${balanceDrawMode}`)));
      setText("save-zero-force", state.balance.zeroForce?.committed ? "更新 A1 判斷" : "保存 A1 判斷");
      setText("save-static-force", state.balance.staticCase?.learnerAppliedForce?.committed ? "更新 A2 力平衡判斷" : "保存 A2 力平衡判斷");
      setText("balanceStatus", target ? "正在修改 Part A 的一項答案；可直接重新畫箭嘴，保存後會套用新答案。" : !state.balance.zeroForce ? "A1 尚未保存；完成後仍可用上方任務列切換到 B、C 或 D。" : balanceStaticInteractionActive() ? "完成 A2：由物體中央畫出指定拉力，再畫出等大反向的靜摩擦力；也可以不畫摩擦力。" : best == null ? (balanceOffscreen ? "物體已離開畫面；按返回中央後可以繼續試拉。" : "由物體中央按住拉力箭嘴，向左或向右改變拉力，觀察物體的運動狀態。") : breakawayValue == null ? "已找到臨界值，請填寫你估計的最大靜摩擦力。" : "Part A 已完成；可以自由切換其他任務，之後仍可返回修改。" );
      const zeroSaved = state.balance.zeroForce?.committed === true;
      const staticSaved = state.balance.staticCase?.learnerAppliedForce?.committed === true && state.balance.staticCase?.learnerForce?.committed === true;
      const setTaskDisabled = (selector, disabled) => document.querySelectorAll(selector).forEach((node) => { node.disabled = disabled; node.setAttribute("aria-disabled", String(disabled)); });
      setTaskDisabled("#zeroTask input, #zeroTask select, #zeroTask [data-balance-normal]", state.fromReview ? target !== "zero-force" : false);
      setTaskDisabled("#staticTask input, #staticTask select, #staticTask [data-balance-normal]", state.fromReview ? target !== "static-case" : !zeroSaved);
      setTaskDisabled("#breakawayTask input, #breakawayTask select, #breakawayTask [data-balance-normal]", state.fromReview ? target !== "breakaway" : !staticSaved);
      q("staticTask")?.classList.toggle("is-disabled", !zeroSaved && !target);
      q("breakawayTask")?.classList.toggle("is-disabled", !staticSaved && !target);
      q("to-experiment")?.toggleAttribute("disabled", false);
      q("to-experiment")?.classList.toggle("is-hidden", Boolean(state.fromReview));
      document.querySelectorAll("[data-balance-review]").forEach((node) => node.classList.toggle("is-hidden", !state.fromReview));
      renderApparatus();
    }
    function renderQuality() {
      const box = q("trialQuality"); if (!box || !experimentQuality) return;
      box.classList.remove("is-hidden"); box.textContent = experimentQuality.neutralMessage;
      setText("experimentStatus", state?.trial ? "已保存這次實驗，可以前往 Part C 分析。" : experimentQuality.neutralMessage);
    }
    function stopLoop() {
      if (loop != null) {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(loop); else clearTimeout(loop);
        loop = null;
      }
      previousFrameMs = null;
    }
    function startLoop() {
      stopLoop();
      const frame = (nowMs) => {
        if (!recorder?.running || !scenario || !directExperimentState) return;
        if (previousFrameMs == null) previousFrameMs = nowMs;
        const frameDurationMs = Math.max(0, nowMs - previousFrameMs);
        previousFrameMs = nowMs;
        // A normal phone frame can occasionally exceed 50 ms while the
        // browser is handling a touch event. Keep the 50 ms physics step,
        // but only treat a long visibility/load pause as a technical gap.
        if (frameDurationMs > 250) {
          recorder.stalled = true; recorder.running = false; stopLoop();
          markRecordingActive(false);
          recorder = null;
          setText("experimentStatus", "這次記錄因技術時間間隔中斷；未確認資料，請重新開始。");
          renderApparatus();
          return;
        }
        experimentAccumulatorS += frameDurationMs / 1000;
        while (experimentAccumulatorS >= Physics.PHYSICS_DT_S - 1e-9 && directExperimentState.timeS < Measurement.MAX_TRIAL_DURATION_S - 1e-9) {
          const stepS = Math.min(Physics.PHYSICS_DT_S, Measurement.MAX_TRIAL_DURATION_S - directExperimentState.timeS);
          const previousPhysical = directExperimentState;
          const previousMeasurement = measurementState;
          const handleInput = { handleTargetPositionM: experimentHandleTargetPositionM(stepS) };
          if (dragging?.kind === "experiment-pull" && experimentPullHasBrokenAway) handleInput.handleSpeedLimitMps = EXPERIMENT_ACTIVE_HANDLE_SPEED_LIMIT_MPS;
          const nextPhysical = experimentForceControlActive && dragging?.kind === "experiment-pull"
            ? stepExperimentForceControl(stepS)
            : Physics.stepPhysics(directExperimentState, handleInput, scenario, stepS);
          const stepped = Measurement.step(measurementState, nextPhysical, scenario, stepS);
          measurementState = stepped.state;
          const nextGridTime = measurementState.regularSamples.length * Measurement.GRAPH_SAMPLE_DT_S;
          if (measurementState.regularSamples.length === 0 || nextPhysical.timeS >= nextGridTime - 1e-6) {
            const captured = Measurement.captureSample(measurementState, nextPhysical, scenario, { timeS: nextPhysical.timeS }); measurementState = captured.state;
          }
          if (nextPhysical.events?.length) for (const event of nextPhysical.events) {
            measurementState = Measurement.enrichBreakaway(measurementState, event, previousMeasurement, measurementState, previousPhysical, nextPhysical);
            if (event.type === "breakaway" && !breakawayAnnounced) {
              breakawayAnnounced = true;
              experimentPullHasBrokenAway = true;
              announce("物體已開始移動");
            }
          }
          directExperimentState = nextPhysical;
          physicsState = nextPhysical;
          experimentAccumulatorS -= stepS;
        }
        if (directExperimentState.timeS >= Measurement.MAX_TRIAL_DURATION_S - 1e-9) {
          timeoutExperiment();
          return;
        }
        renderApparatus();
        if (typeof requestAnimationFrame === "function") loop = requestAnimationFrame(frame); else loop = setTimeout(() => frame(performance.now()), 16);
      };
      if (typeof requestAnimationFrame === "function") loop = requestAnimationFrame(frame); else loop = setTimeout(() => frame(performance.now()), 16);
    }
    function startRecording() {
      if (!scenario || !state || presentation !== "editable" || state.phase !== "experiment" || state.fromReview || state.trial || recorder?.running) return false;
      resetExperimentRig();
      recorder = Measurement.createRecorder(scenario); recorder.running = true;
      measurementState = recorder.measurement;
      directExperimentState = Physics.createInitialState(scenario);
      directExperimentState.block.positionM = EXPERIMENT_START_POSITION_M;
      physicsState = directExperimentState;
      experimentQuality = null;
      experimentTimedOut = false;
      experimentAppliedForceN = 0;
      experimentPullHasBrokenAway = false;
      experimentForceControlActive = false;
      experimentAccumulatorS = 0;
      breakawayAnnounced = false;
      markRecordingActive(true);
      announce("記錄開始");
      setText("experimentStatus", "記錄進行中：由物體中央向右拖動拉力，30 秒內完成。");
      renderApparatus();
      startLoop();
      return true;
    }
    function restartExperimentImmediately() {
      const editingExperimentReview = Boolean(state?.fromReview && state.working?.reviewEditTarget?.section === "experiment");
      const completeReview = Boolean(state && !state.fromReview && state.phase === "review");
      if (!scenario || !state || presentation !== "editable" || (!editingExperimentReview && !completeReview && state.phase !== "experiment")) return false;
      stopLoop();
      if (recorder) recorder.running = false;
      recorder = null;
      markRecordingActive(false);
      if (completeReview) state = Persistence.transitions.enterReviewEdit(state, "experiment", null);
      state = Persistence.transitions.redoExperiment(state);
      resetExperimentRig();
      saveDraft();
      const started = startRecording();
      if (started) {
        setText("experimentStatus", "已重新開始記錄：由物體中央向右拖動拉力，30 秒內完成。");
        announce("已重新開始記錄");
      }
      render();
      return started;
    }
    function stopRecording() {
      if (!recorder?.running || state?.phase !== "experiment" || state?.fromReview) return false;
      stopLoop();
      recorder.measurement = measurementState;
      const stopped = Measurement.stopRecorder(recorder);
      markRecordingActive(false);
      if (!stopped.accepted) {
        recorder = null;
        experimentQuality = { valid: false, neutralMessage: stopped.reason === "sensor-overrange" ? "拉力超出可記錄範圍，請重新開始並減少拉力。" : "這次記錄未能安全保存，請重新開始。" };
        setText("experimentStatus", experimentQuality.neutralMessage);
        announce("記錄未保存，請重新開始");
        render();
        return false;
      }
      const quality = Measurement.assessTrial(stopped.trial);
      experimentQuality = quality;
      recorder = null;
      experimentAppliedForceN = 0;
      experimentForceControlActive = false;
      announce(quality.valid ? "實驗記錄已保存" : "記錄未完成，請重新開始");
      if (quality.valid) {
        state = Persistence.transitions.acceptTrial(state, stopped.trial);
        analysisDraft = null;
        saveDraft();
        setText("experimentStatus", "記錄已保存，可以前往 Part C 分析這張 F拉–t 圖。");
      } else {
        setText("experimentStatus", quality.neutralMessage);
      }
      render();
      return quality.valid;
    }
    function timeoutExperiment() {
      if (!recorder?.running) return;
      stopLoop();
      recorder.running = false;
      recorder.measurement = measurementState;
      experimentTimedOut = true;
      experimentAppliedForceN = 0;
      experimentForceControlActive = false;
      markRecordingActive(false);
      recorder = null;
      experimentQuality = { valid: false, neutralMessage: "時間已經超時，請重新開始記錄。" };
      setText("experimentStatus", "時間已經超時，請重新開始記錄。");
      announce("時間已經超時，請重新開始記錄");
      render();
    }
    function renderGraph() {
      const svg = q("graphSvg"); if (!svg) return;
      if (!state?.trial) { svg.replaceChildren(); setText("graphCursorReadout", "請先在 Part B 完成並保存一份有效的實驗記錄，之後返回 Part C 分析。"); return; }
      svg.replaceChildren();
      const decoded = Measurement.unpackTrace(state.trial);
      const activeKey = currentAnalysisKey();
      const activeTask = analysisDraft?.[activeKey] || state.analysis?.[activeKey];
      for (let i = 0; i <= 6; i += 1) { const x = Graph.timeToX(i * 5); svg.append(svgElement("line", { x1: x, y1: Graph.GRAPH.top, x2: x, y2: Graph.GRAPH.top + Graph.GRAPH.height, class: "graph-grid" })); }
      for (let i = 0; i <= 4; i += 1) { const y = Graph.forceToY(i * 3); svg.append(svgElement("line", { x1: Graph.GRAPH.left, y1: y, x2: Graph.GRAPH.left + Graph.GRAPH.width, y2: y, class: "graph-grid" })); }
      if (activeKey !== "breakaway" && Number.isInteger(activeTask?.startIndex) && Number.isInteger(activeTask?.endIndex)) {
        const x0 = Graph.timeToX(decoded.merged[activeTask.startIndex]?.timeS || 0); const x1 = Graph.timeToX(decoded.merged[activeTask.endIndex]?.timeS || 0);
        svg.append(svgElement("rect", { x: Math.min(x0, x1), y: Graph.GRAPH.top, width: Math.max(1, Math.abs(x1 - x0)), height: Graph.GRAPH.height, fill: "rgba(124,58,237,.10)" }));
      }
      const forcePath = svgElement("path", { d: Graph.svgPath(decoded, "force"), class: "force-line", "aria-label": "拉力 F拉—時間 t" }); svg.append(forcePath);
      const forceLabel = svgElement("text", { x: 410, y: 20, "text-anchor": "middle" });
      forceLabel.append(document.createTextNode("拉力 "));
      const graphF = svgElement("tspan", { "font-style": "italic" }); graphF.textContent = "F"; forceLabel.append(graphF);
      const graphSub = svgElement("tspan", { "baseline-shift": "sub", "font-size": "70%" }); graphSub.textContent = "拉"; forceLabel.append(graphSub);
      const graphT = svgElement("tspan", { "font-style": "italic" }); graphT.textContent = "–t"; forceLabel.append(graphT);
      forceLabel.append(document.createTextNode(" 圖")); svg.append(forceLabel);
      const yLabel = svgElement("text", { x: 18, y: 200, transform: "rotate(-90 18 200)", "text-anchor": "middle" });
      const graphYF = svgElement("tspan", { "font-style": "italic" }); graphYF.textContent = "F"; yLabel.append(graphYF);
      const graphYSub = svgElement("tspan", { "baseline-shift": "sub", "font-size": "70%" }); graphYSub.textContent = "拉"; yLabel.append(graphYSub);
      yLabel.append(document.createTextNode(" / N")); svg.append(yLabel);
      const xLabel = svgElement("text", { x: 410, y: 425, "text-anchor": "middle" });
      const graphXT = svgElement("tspan", { "font-style": "italic" }); graphXT.textContent = "t"; xLabel.append(graphXT);
      xLabel.append(document.createTextNode(" / s")); svg.append(xLabel);
      const marker = activeKey === "breakaway" ? activeTask?.markerIndex : null;
      if (Number.isInteger(marker) && decoded.merged[marker]) {
        const sample = decoded.merged[marker]; const x = Graph.timeToX(sample.timeS); svg.append(svgElement("line", { x1: x, y1: 25, x2: x, y2: 402, class: "graph-cursor" }));
        const markerTarget = q("breakawayMarker"); if (markerTarget) { markerTarget.style.left = `${clamp(x / 820 * 100, 0, 100)}%`; markerTarget.style.top = "48%"; markerTarget.setAttribute("aria-label", `最大靜摩擦力時間標記，目前 ${sample.timeS.toFixed(2)} 秒`); }
        setText("graphCursorReadout", `目前時間 ${sample.timeS.toFixed(2)} s；拉力 ${sample.measuredPullN.toFixed(2)} N。`);
      } else if (activeTask && Number.isInteger(activeTask.startIndex) && Number.isInteger(activeTask.endIndex)) {
        const prefix = { staticInterval: "static", slowPlateau: "slow", acceleration: "acceleration", fastPlateau: "fast" }[activeKey];
        for (const edge of ["start", "end"]) {
          const index = activeTask[`${edge}Index`]; const sample = decoded.merged[index]; const target = q(`${prefix}-${edge}`);
          if (target && sample) { target.style.left = `${clamp(Graph.timeToX(sample.timeS) / 820 * 100, 0, 100)}%`; target.style.top = edge === "start" ? "70%" : "82%"; target.setAttribute("aria-label", `${activeKey} 區段${edge === "start" ? "開始" : "結束"}，目前 ${sample.timeS.toFixed(2)} 秒`); }
        }
        const start = decoded.merged[activeTask.startIndex], end = decoded.merged[activeTask.endIndex];
        if (start && end) setText("graphCursorReadout", `目前區段 ${start.timeS.toFixed(2)}–${end.timeS.toFixed(2)} s；開始拉力 ${start.measuredPullN.toFixed(2)} N；結束拉力 ${end.measuredPullN.toFixed(2)} N。`);
      } else setText("graphCursorReadout", "尚未選取圖像時間。");
    }
    function renderDataTable() {
      const body = q("traceTable"); if (!body) return;
      if (!state?.trial) { body.replaceChildren(); q("intervalStatsList")?.replaceChildren(); return; }
      const decoded = Measurement.unpackTrace(state.trial); body.replaceChildren();
      if (!Number.isInteger(tableCursorIndex) || tableCursorIndex < 0 || tableCursorIndex >= decoded.merged.length) tableCursorIndex = null;
      decoded.merged.forEach((sample, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `<th scope="row">${sample.canonicalIndex}</th><td>${sample.timeS.toFixed(2)}</td><td>${sample.measuredPullN.toFixed(2)}</td>`;
        row.setAttribute("aria-label", `樣本 ${sample.canonicalIndex}，時間 ${sample.timeS.toFixed(2)} 秒，拉力 ${sample.measuredPullN.toFixed(2)} 牛頓`);
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
        setText("graphCursorReadout", `資料表游標：時間 ${sample.timeS.toFixed(2)} s；拉力 ${sample.measuredPullN.toFixed(2)} N。`);
      }
      const statsHost = q("intervalStatsList"); if (!statsHost) return;
      statsHost.replaceChildren();
      const draft = analysisDraft || state.analysis;
      const labels = { staticInterval: "C1 靜止時拉力上升", slowPlateau: "C3 移動後穩定拉力", acceleration: "C4 拉力較大而加速", fastPlateau: "C5 另一段移動後平台" };
      Object.entries(labels).forEach(([key, label]) => {
        const selection = draft?.[key]; const stats = selection?.startIndex != null && selection?.endIndex != null ? Measurement.intervalStats(decoded, selection.startIndex, selection.endIndex) : null;
        const item = document.createElement("p"); item.className = "interval-stat"; item.id = `interval-stat-${key}`;
        item.textContent = stats ? `${label}：${stats.startTimeS.toFixed(2)}–${stats.endTimeS.toFixed(2)} s；duration ${stats.durationS.toFixed(2)} s；平均拉力 ${stats.meanPullN.toFixed(2)} N；拉力變化量 ${stats.forceRangeN.toFixed(2)} N；拉力標準差 ${stats.forceStdN.toFixed(3)} N。` : `${label}：尚未選取完整區段。`;
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
      const host = q("analysisTasks"); if (!host) return;
      if (!state?.trial) {
        host.innerHTML = '<p class="neutral-status">目前沒有可分析的實驗記錄。你可以先切換到 Part B；完成並保存有效記錄後，再返回 Part C。</p>';
        q("to-predict")?.toggleAttribute("disabled", true);
        renderGraph();
        return;
      }
      const draft = ensureAnalysisDraft(); const decoded = Measurement.unpackTrace(state.trial); const max = decoded.merged.length - 1; const activeKey = currentAnalysisKey();
      host.replaceChildren();
      const specs = [
        ["staticInterval", "C1　找出物體仍靜止而拉力上升的區段", "frictionType", [["static", "靜摩擦力"], ["kinetic", "滑動摩擦力"], ["none", "沒有摩擦力"]]],
        ["breakaway", "C2　標記物體開始移動的一刻", "identifiedAs", [["maximum-static-friction", "最大靜摩擦力"], ["kinetic-friction", "滑動摩擦力"], ["applied-force", "施加拉力"]]],
        ["slowPlateau", "C3　選出移動後的穩定拉力區段", "estimatedFkCN", []],
        ["acceleration", "C4　找出拉力令物體加速的區段", "relation", [["pull-greater", "<var>F</var><sub>拉</sub> 大於 <var>f</var><sub>k</sub>"], ["equal", "<var>F</var><sub>拉</sub> 等於 <var>f</var><sub>k</sub>"], ["pull-less", "<var>F</var><sub>拉</sub> 小於 <var>f</var><sub>k</sub>"]]],
        ["fastPlateau", "C5　比較另一段移動後的拉力平台", "speedComparison", [["same-average", "兩段平均拉力基本相同"], ["higher-at-fast-speed", "後段平均拉力較大"], ["lower-at-fast-speed", "後段平均拉力較小"]]]
      ];
      specs.forEach(([key, title, field, options]) => {
        const card = document.createElement("section"); card.className = "task-card"; card.dataset.analysisTask = key; if (key !== "breakaway") card.setAttribute("aria-describedby", `interval-stat-${key}`);
        const task = draft[key] || {};
        card.innerHTML = `<div class="task-card-heading"><p class="task-title">${title}</p><button type="button" data-action="select-analysis-task" data-analysis-key="${key}" class="task-select-button">${activeKey === key ? "正在編輯" : "編輯此項"}</button></div>`;
        if (key === "breakaway") {
          card.innerHTML += `<label><var>t</var> 標記（秒）<input type="range" min="0" max="${max}" value="${task.markerIndex ?? 0}" data-analysis-field="markerIndex" aria-label="最大靜摩擦力時間標記"><output data-analysis-readout="markerIndex">${(decoded.merged[task.markerIndex ?? 0]?.timeS || 0).toFixed(2)} s</output></label><label>你讀到的最大 <var>f</var><sub>s,max</sub>（N）<input type="number" min="0" max="12" step="0.01" value="${task.estimatedFsMaxCN == null ? "" : task.estimatedFsMaxCN / 100}" data-analysis-field="estimatedFsMaxCN"></label>`;
        } else if (key === "slowPlateau" || key === "fastPlateau") {
          card.innerHTML += `<label>開始樣本<input type="range" min="0" max="${max}" value="${task.startIndex ?? 0}" data-analysis-field="startIndex"></label><label>結束樣本<input type="range" min="0" max="${max}" value="${task.endIndex ?? 1}" data-analysis-field="endIndex"></label><label>估計平均 <var>f</var><sub>k</sub>（N）<input type="number" min="0" max="12" step="0.01" value="${task.estimatedFkCN == null ? "" : task.estimatedFkCN / 100}" data-analysis-field="estimatedFkCN"></label>`;
        } else {
          card.innerHTML += `<label>開始樣本<input type="range" min="0" max="${max}" value="${task.startIndex ?? 0}" data-analysis-field="startIndex"></label><label>結束樣本<input type="range" min="0" max="${max}" value="${task.endIndex ?? 1}" data-analysis-field="endIndex"></label>`;
        }
        if (options.length) card.innerHTML += `<label>判斷<select data-analysis-field="${field}"><option value="">請選擇</option>${options.map(([value, label]) => `<option value="${value}" ${task[field] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
        if (key === "staticInterval") card.innerHTML += `<label><var>F</var><sub>拉</sub> 和 <var>f</var><sub>s</sub> 的關係<select data-analysis-field="relation"><option value="">請選擇</option><option value="equal" ${task.relation === "equal" ? "selected" : ""}>拉力等於靜摩擦力</option><option value="pull-greater" ${task.relation === "pull-greater" ? "selected" : ""}>拉力大於靜摩擦力</option><option value="pull-less" ${task.relation === "pull-less" ? "selected" : ""}>拉力小於靜摩擦力</option></select></label>`;
        if (key === "acceleration") card.innerHTML += `<label>這段拉力可否直接當作滑動摩擦力？<select data-analysis-field="pullEqualsFk"><option value="">請選擇</option><option value="yes" ${task.pullEqualsFk === "yes" ? "selected" : ""}>可以</option><option value="no" ${task.pullEqualsFk === "no" ? "selected" : ""}>不可以</option></select></label>`;
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
        card.innerHTML = `<div class="task-card-heading"><p class="task-title">${spec.id}：<var>F</var><sub>拉</sub> = ${spec.pullN.toFixed(1)} N；物體目前 <var>v</var> = ${spec.velocityMps.toFixed(2)} m/s</p><button type="button" data-action="select-prediction" class="task-select-button">${index === currentPredictionIndex() ? "正在編輯" : "編輯此題"}</button></div><label>摩擦力類型<select data-prediction-field="frictionType"><option value="">請選擇</option><option value="none" ${response.frictionType === "none" ? "selected" : ""}>沒有摩擦力</option><option value="static" ${response.frictionType === "static" ? "selected" : ""}>靜摩擦力</option><option value="kinetic" ${response.frictionType === "kinetic" ? "selected" : ""}>滑動摩擦力</option></select></label><label>方向<select data-prediction-field="direction"><option value="">請選擇</option><option value="none" ${response.direction === "none" ? "selected" : ""}>沒有方向</option><option value="left" ${response.direction === "left" ? "selected" : ""}>向左</option><option value="right" ${response.direction === "right" ? "selected" : ""}>向右</option></select></label><label>摩擦力大小（N）<input type="number" min="0" max="12" step="0.01" value="${response.magnitudeCN == null ? "" : response.magnitudeCN / 100}" data-prediction-field="magnitudeCN"></label><label>運動結果<select data-prediction-field="motionOutcome"><option value="">請選擇</option><option value="remain-still" ${response.motionOutcome === "remain-still" ? "selected" : ""}>保持靜止</option><option value="start-sliding" ${response.motionOutcome === "start-sliding" ? "selected" : ""}>開始滑動</option><option value="speed-up" ${response.motionOutcome === "speed-up" ? "selected" : ""}>加速</option><option value="slow-down" ${response.motionOutcome === "slow-down" ? "selected" : ""}>減速</option></select></label><button type="button" data-action="save-prediction">保存這題預測</button>`;
        if (response.committed && !state.fromReview) card.insertAdjacentHTML("beforeend", index < scenario.predictions.length - 1 ? `<button type="button" data-action="advance-prediction">下一題</button>` : "");
        const targetIndex = currentPredictionIndex();
        if (index !== targetIndex) card.querySelectorAll("select,input,button:not([data-action='select-prediction'])").forEach((node) => { node.disabled = true; node.setAttribute("aria-disabled", "true"); });
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
      const balanceEditButtons = `<button type="button" data-action="edit-balance">修改 A1 零拉力判斷</button><button type="button" data-action="edit-balance-task" data-balance-key="static-case">修改 A2 力箭嘴判斷</button><button type="button" data-action="edit-balance-task" data-balance-key="breakaway">修改 A3 最大靜摩擦力估計</button>`;
      const balanceDone = [state.balance.zeroForce?.committed, state.balance.staticCase?.learnerAppliedForce?.committed && state.balance.staticCase?.learnerForce?.committed, state.balance.breakaway?.committed].filter(Boolean).length;
      host.innerHTML = `<ul><li>Part A 三項任務：${balanceDone}/3</li><li>實驗記錄：${state.trial ? "已保留" : "未完成"}</li><li>圖像分析：${Persistence.hasAllAnalysisFields(state) ? "五項已保存" : "尚未完整"}</li><li>預測：${state.predictions.filter(Boolean).length}/4</li></ul><p class="${complete ? "result-good" : "result-neutral"}">${complete ? "作答資料完整，可以提交。" : "尚有作答資料未完成；提交按鈕會保持鎖定。"}</p><div class="review-balance-edits">${balanceEditButtons}</div>`;
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
        if (state.phase === "experiment" && experimentQuality) renderQuality();
        if (state.phase === "experiment" && state.trial && !experimentQuality) setText("experimentStatus", "B 記錄已保存，可以前往 Part C 分析這張 F拉–t 圖。");
        if (state.phase === "analysis") { renderAnalysisTasks(); renderDataTable(); } if (state.phase === "predict") renderPredictions(); if (state.phase === "review") renderReview(); renderResult();
      }
      const experimentReview = state?.fromReview && state.working?.reviewEditTarget?.section === "experiment";
      q("experimentRunActions")?.classList.toggle("is-hidden", Boolean(experimentReview));
      q("to-analysis")?.classList.toggle("is-hidden", Boolean(experimentReview));
      q("startRecording")?.toggleAttribute("disabled", state?.phase !== "experiment" || Boolean(state?.fromReview) || Boolean(state?.trial) || Boolean(recorder?.running));
      q("stopRecording")?.toggleAttribute("disabled", state?.phase !== "experiment" || !recorder?.running || Boolean(state?.fromReview));
      q("requestRedoExperiment")?.toggleAttribute("disabled", state?.phase !== "experiment" || Boolean(state?.fromReview));
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
      stopLoop(); cancelBalanceMotion(); recorder = null; previousFrameMs = null; dragging = null; breakawayAnnounced = false; tableCursorIndex = null; predictionDraft = []; directExperimentState = null; experimentAppliedForceN = 0; experimentPullHasBrokenAway = false; experimentForceControlActive = false; experimentAccumulatorS = 0; experimentQuality = null; experimentTimedOut = false; balanceDirectState = null; balanceForceEndpointX = null; balanceOffscreen = false; balanceDrawingsSource = null; balanceDrawings = { applied: null, friction: null };
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
          presentation = "editable"; latestResult = null; analysisDraft = null; resetBalanceTrialView();
          if (state.balance.zeroForce == null) clearZeroForceControls();
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
      if (["navigate-phase", "to-experiment", "to-analysis", "to-predict", "to-review", "edit-balance", "edit-balance-task", "edit-experiment", "edit-analysis", "edit-predict", "cancel-review-edit"].includes(action)) { focusPhase(); return; }
      if (action === "select-analysis-task") { focusNode(q(`[data-analysis-task="${currentAnalysisKey()}"]`)?.querySelector("input,select")); return; }
      if (action === "select-prediction") { focusNode(q(`[data-prediction-index="${currentPredictionIndex()}"]`)?.querySelector("input,select")); return; }
      if (action === "save-zero-force") { focusNode(q("draw-applied")); return; }
      if (action === "save-static-force") { focusNode(q("balanceOrigin")); return; }
      if (action === "save-breakaway-answer") { focusNode(q("to-experiment")); return; }
      if (action === "save-analysis") { focusNode(q(`[data-analysis-task="${currentAnalysisKey()}"]`)?.querySelector("input,select")); return; }
      if (action === "advance-prediction") { focusNode(q(`[data-prediction-index="${currentPredictionIndex()}"]`)?.querySelector("select,input")); return; }
      if (["previous-extremum", "next-extremum", "jump-selection-start", "jump-selection-end"].includes(action)) { focusNode(q(`[data-sample-index="${tableCursorIndex}"]`)); return; }
      if (action === "request-redo-experiment") focusNode(q("experimentOrigin") || q("startRecording"));
    }
    function validationMessage(action) {
      if (action === "save-zero-force") return "請先選擇 A1 的摩擦力類型、方向及大小。";
      if (action === "save-static-force") return "請先由物體中央畫出 A2 拉力；摩擦力可以畫出，亦可以不畫。";
      if (action === "save-breakaway-answer") return "請先完成試拉，然後填寫最大靜摩擦力估計。";
      if (action === "save-analysis") return "請完成目前圖像項目的選區、數值及判斷，然後再保存。";
      if (action === "save-prediction") return "請完成這題的摩擦力類型、方向、大小及運動結果，然後再保存。";
      return "目前操作未能保存；請檢查這一階段的資料是否完整。";
    }
    function validationNode(action) {
      const localId = action === "save-zero-force" ? "zeroValidationStatus" : action === "save-static-force" ? "staticValidationStatus" : action === "save-breakaway-answer" ? "breakawayValidationStatus" : "validationStatus";
      return q(localId) || q("validationStatus");
    }
    function wireEvents() {
      if (typeof document === "undefined") return;
      document.addEventListener("click", (event) => {
        const action = event.target.closest?.("[data-action]")?.dataset.action; if (!action || !state) return;
          if (["technical", "load-error", "trusted-finished-review", "submitted-success"].includes(presentation) || (presentation === "frozen" && action !== "retry-pending") || (presentation === "submitted-committed" && action !== "retry-finish")) return;
        try {
          document.querySelectorAll(".validation-status").forEach((node) => { node.classList.add("is-hidden"); node.textContent = ""; });
          if (action === "navigate-phase") navigateToPhase(event.target.closest("[data-phase]")?.dataset.phase);
          else if (action === "select-analysis-task") { state = Persistence.transitions.selectAnalysisTask(state, event.target.closest("[data-analysis-key]")?.dataset.analysisKey); analysisDraft = null; tableCursorIndex = null; saveDraft(); }
          else if (action === "select-prediction") { state = Persistence.transitions.selectPrediction(state, Number(event.target.closest("[data-prediction-index]")?.dataset.predictionIndex)); predictionDraft = []; saveDraft(); }
          else if (action === "save-zero-force") {
            const type = q("zeroFrictionType")?.value || null; const direction = type === "none" ? "none" : q("zeroFrictionDirection")?.value || null; const magnitudeCN = type === "none" ? 0 : Math.round(Number(q("zeroFrictionMagnitude")?.value || 0) * 100);
            if (!type || !direction) throw new Error("explicit zero-force answer required");
            state = Persistence.transitions.setZeroForceAnswer(state, { frictionType: type, direction, frictionMagnitudeCN: magnitudeCN, committed: true }); balanceInteractionMode = "static"; balanceDrawMode = "applied"; saveDraft();
          }
          else if (action === "draw-applied") { balanceInteractionMode = "static"; balanceDrawMode = "applied"; announce("請由物體中央拖出指定拉力箭嘴"); }
          else if (action === "draw-friction") { balanceInteractionMode = "static"; balanceDrawMode = "friction"; announce("請由物體中央拖出摩擦力箭嘴；不畫箭嘴代表沒有摩擦力"); }
          else if (action === "clear-friction") { balanceInteractionMode = "static"; balanceDrawings.friction = null; balanceDrawMode = "friction"; announce("已清除摩擦力箭嘴，代表沒有摩擦力"); }
          else if (action === "reset-balance-object") { cancelBalanceMotion(); balanceDirectState = Physics.createDirectForceState(scenario, .72); balanceMotionOffsetM = 0; balanceForceEndpointX = null; balanceOffscreen = false; balanceTrialPullCN = 0; balanceTrialRecorded = false; announce("物體已返回中央，可以繼續試拉"); }
          else if (action === "save-static-force") {
            const applied = balanceDrawings.applied;
            if (!applied?.direction || !Number.isInteger(applied.magnitudeCN) || applied.magnitudeCN <= 0) throw new Error("drawn applied force required");
            const friction = balanceDrawings.friction ? { frictionType: "static", direction: balanceDrawings.friction.direction, frictionMagnitudeCN: balanceDrawings.friction.magnitudeCN, committed: true } : { frictionType: "none", direction: "none", frictionMagnitudeCN: 0, committed: true };
            state = Persistence.transitions.setStaticForceAnswer(state, balanceStaticSpec(), { direction: applied.direction, magnitudeCN: applied.magnitudeCN, committed: true }, friction); balanceInteractionMode = "breakaway"; balanceDrawMode = "applied"; saveDraft();
          }
          else if (action === "save-breakaway-answer") {
            const value = q("breakawayAnswer")?.value; if (value === "" || !Number.isFinite(Number(value))) throw new Error("maximum static-friction estimate required");
            state = Persistence.transitions.setBreakawayAnswer(state, Math.round(Number(value) * 100)); saveDraft();
          }
          else if (action === "to-experiment") { cancelBalanceMotion(); balanceForceEndpointX = null; state = Persistence.transitions.setPhase(state, "experiment"); resetExperimentRig(); saveDraft(); }
          else if (action === "start-recording") startRecording();
          else if (action === "stop-recording") stopRecording();
          else if (action === "request-redo-experiment") restartExperimentImmediately();
          else if (action === "to-analysis") { if (state.trial) { state = Persistence.transitions.setPhase(state, "analysis"); analysisDraft = null; saveDraft(); } }
          else if (["previous-extremum", "next-extremum", "jump-selection-start", "jump-selection-end"].includes(action)) { if (!moveTableCursor(action)) throw new Error("no matching data-table destination"); }
          else if (action === "save-analysis") { const draft = collectAnalysisDraft(); if (!commitAnalysisDraft(draft)) throw new Error("complete the active analysis task before saving"); saveDraft(); announce("區段已記錄"); }
          else if (action === "to-predict") { if (!Persistence.hasAllAnalysisFields(state)) throw new Error("analysis incomplete"); state = Persistence.transitions.setPhase(state, "predict"); analysisDraft = null; saveDraft(); }
          else if (action === "save-prediction") { const card = event.target.closest("[data-prediction-index]"); const index = Number(card.dataset.predictionIndex); const values = {}; card.querySelectorAll("[data-prediction-field]").forEach((input) => { values[input.dataset.predictionField] = input.dataset.predictionField === "magnitudeCN" ? (input.value === "" ? null : Math.round(Number(input.value) * 100)) : input.value || null; }); if (!values.frictionType || !values.direction || values.magnitudeCN == null || !values.motionOutcome) throw new Error("complete every prediction field"); state = Persistence.transitions.setPrediction(state, index, { id: scenario.predictions[index].id, scenarioId: scenario.predictions[index].scenarioId, ...values, committed: true }); saveDraft(); }
          else if (action === "advance-prediction") { state = Persistence.transitions.advancePrediction(state); saveDraft(); }
          else if (action === "to-review") { if (Persistence.hasAllPredictions(state)) { state = Persistence.transitions.setPhase(state, "review"); saveDraft(); } }
          else if (action === "edit-balance") { state = Persistence.transitions.enterReviewEdit(state, "balance", "zero-force"); saveDraft(); }
          else if (action === "edit-balance-task") { state = Persistence.transitions.enterReviewEdit(state, "balance", event.target.closest("[data-balance-key]")?.dataset.balanceKey); saveDraft(); }
          else if (action === "edit-experiment") restartExperimentImmediately();
          else if (action === "edit-analysis") { state = Persistence.transitions.enterReviewEdit(state, "analysis", event.target.closest("[data-analysis-key]")?.dataset.analysisKey); analysisDraft = null; saveDraft(); }
          else if (action === "edit-predict") { state = Persistence.transitions.enterReviewEdit(state, "predict", Number(event.target.closest("[data-prediction-index]")?.dataset.predictionIndex ?? 0)); saveDraft(); }
          else if (action === "cancel-review-edit") { state = Persistence.transitions.cancelReviewEdit(state); analysisDraft = null; saveDraft(); }
          else if (action === "retry-finish") { const outcome = typeof SimScorm !== "undefined" ? SimScorm.retryFinish?.() : null; if (outcome?.ok) { presentation = "submitted-success"; render(); } else if (outcome?.committed) { setText("submitStatus", "完成程序仍未成功；已保留鎖定結果，可稍後重試。"); } }
          else if (action === "retry-pending") { const outcome = typeof SimScorm !== "undefined" ? SimScorm.retryPending?.() : null; if (outcome?.ok || outcome?.committed) { pendingRetryAvailable = false; presentation = outcome.finished ? "submitted-success" : "submitted-committed"; render(); } else { setText("technicalMessage", "技術提交仍未完成；操作及分數均未確認，請稍後再試。"); } }
          else if (action === "submit") submit();
          render();
          focusAfterAction(action);
        } catch (error) { console.warn(error); render(); const status = validationNode(action); if (status) { status.textContent = validationMessage(action); status.classList.remove("is-hidden"); focusNode(status); } }
      });
      q("zeroFrictionMagnitude")?.addEventListener("input", (event) => { setText("zeroFrictionMagnitudeValue", `${Number(event.target.value).toFixed(1)} N`); renderApparatus(); });
      q("zeroFrictionType")?.addEventListener("change", renderBalance); q("zeroFrictionDirection")?.addEventListener("change", renderApparatus);
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
        if (panelTouchY == null && panelHostScrollY == null) return;
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
        if (target.id === "experimentOrigin" && recorder?.running && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setExperimentAppliedForce(experimentAppliedForceN + (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? .5 : .1)); renderApparatus(); }
        if (target.classList?.contains("drag-target") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); adjustDragTarget(target.dataset.dragTarget, (event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1), event.shiftKey ? 5 : 1); if (state?.phase === "analysis") persistAnalysisDraft(); saveDraft(); render(); }
        if (target.classList?.contains("drag-target") && event.key === "Escape") cancelDrag();
      });
      document.querySelectorAll(".drag-target").forEach((target) => { target.addEventListener("pointerdown", beginDrag); target.addEventListener("pointermove", moveDrag); target.addEventListener("pointerup", endDrag); target.addEventListener("pointercancel", cancelDrag); });
      const stage = q("stage");
      if (stage && typeof ResizeObserver === "function" && !stageResizeObserver) {
        stageResizeObserver = new ResizeObserver(() => { if (!dragging) renderApparatus(); });
        stageResizeObserver.observe(stage);
      } else if (typeof window !== "undefined" && !stageResizeObserver) {
        window.addEventListener("resize", () => { if (!dragging) renderApparatus(); });
        stageResizeObserver = { disconnect() {} };
      }
    }
    function svgPointFromEvent(event) {
      const svg = q("apparatusSvg");
      if (!svg) return { x: 0, y: 0 };
      try {
        const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
        const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
        return { x: transformed.x, y: transformed.y };
      } catch {
        const rect = svg.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * 900 / Math.max(1, rect.width), y: (event.clientY - rect.top) * 430 / Math.max(1, rect.height) };
      }
    }
    function balanceComX() {
      const length = scenario?.stage?.lengthM || 1.65;
      const position = balanceDirectState?.block?.positionM ?? (.72 + balanceMotionOffsetM);
      return 100 + (position / length) * 650 + 46;
    }
    function forceFromPointer(originX, pointX) {
      const signedN = clamp((pointX - originX) / 18, -12, 12);
      if (Math.abs(signedN) < .05) return null;
      return { direction: signedN < 0 ? "left" : "right", magnitudeCN: clamp(Math.round(Math.abs(signedN) * 10) * 10, 1, 1200) };
    }
    function updateBalanceDrawFromPointer(event) {
      if (!dragging || dragging.kind !== "balance-draw") return;
      const point = svgPointFromEvent(event);
      if (dragging.mode === "breakaway") {
        balanceForceEndpointX = point.x;
        updateBreakawayReadout(balanceCurrentForceN());
        ensureBalanceMotionLoop();
      } else {
        balanceDrawings[dragging.mode] = forceFromPointer(dragging.originX, point.x);
      }
      renderBalance();
    }
    function beginDrag(event) {
      if (event.isPrimary === false || dragging) return;
      const target = event.currentTarget.dataset.dragTarget;
      if (target === "experiment-origin") {
        if (state?.phase !== "experiment" || !recorder?.running || state.fromReview) return;
        const point = svgPointFromEvent(event);
        dragging = { kind: "experiment-pull", target: event.currentTarget, pointerId: event.pointerId, lastPointX: point.x };
        experimentAppliedForceN = 0;
        experimentPullHasBrokenAway = directExperimentState?.contact?.mode === "sliding" || Math.abs(finite(directExperimentState?.block?.velocityMps)) > 0.01;
        experimentForceControlActive = false;
        renderApparatus();
      } else if (target === "balance-origin") {
        dragging = {
          kind: "balance-draw", target: event.currentTarget, pointerId: event.pointerId,
          mode: balanceInteractionMode === "breakaway" ? "breakaway" : balanceDrawMode,
          originX: balanceComX(), checkpoint: clone(state), checkpointDraft: clone(analysisDraft),
          balanceDrawings: clone(balanceDrawings), balanceDrawingsSource, balanceTrialDirection, balanceTrialPullCN, balanceTrialRecorded,
          motionActive: balanceMotionActive, motionOffsetM: balanceMotionOffsetM, forceEndpointX: balanceForceEndpointX
        };
        if (dragging.mode === "breakaway") {
          balanceForceEndpointX = balanceComX();
          updateBreakawayReadout(0);
          ensureBalanceMotionLoop();
        }
      } else {
        dragging = { target: event.currentTarget, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, checkpoint: clone(state), checkpointDraft: clone(analysisDraft), predictionMagnitudes: [...document.querySelectorAll("[data-prediction-field='magnitudeCN']")].map((input) => input.value) };
      }
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    }
    function adjustDragTarget(target, direction, magnitude = 1) {
      if (target === "experiment-origin") {
        if (!recorder?.running) return;
        setExperimentAppliedForce(experimentAppliedForceN + direction * magnitude * .1);
        renderApparatus();
        return;
      }
      if (target === "balance-origin") {
        if (balanceInteractionMode === "breakaway") {
          const current = balanceCurrentForceN();
          balanceForceEndpointX = balanceComX() + (current + direction * magnitude * .1) * 18;
          updateBreakawayReadout(balanceCurrentForceN());
          ensureBalanceMotionLoop();
        } else {
          const selected = balanceDrawings[balanceDrawMode];
          const signedN = signedForce(selected?.direction, balanceDrawnForceN(selected)) + direction * magnitude * .1;
          balanceDrawings[balanceDrawMode] = forceFromPointer(0, signedN * 18);
        }
        renderApparatus(); renderBalance();
        return;
      }
      if (target === "prediction-friction") { const index = currentPredictionIndex(); const input = q(`#predictionCards [data-prediction-index="${index}"] [data-prediction-field="magnitudeCN"]`); if (input) { input.value = clamp(Number(input.value || 0) + direction * magnitude * 0.05, 0, 12).toFixed(2); input.dispatchEvent(new Event("input", { bubbles: true })); } return; }
      if (!state?.trial) return;
      ensureAnalysisDraft();
      const decoded = Measurement.unpackTrace(state.trial);
      if (target === "breakaway-marker") { analysisDraft.breakaway ||= {}; analysisDraft.breakaway.markerIndex = clamp((analysisDraft.breakaway.markerIndex ?? 0) + direction * magnitude, 0, decoded.merged.length - 1); renderGraph(); return; }
      const match = /^(static|slow|acceleration|fast)-(start|end)$/.exec(target); if (!match) return;
      const key = { static: "staticInterval", slow: "slowPlateau", acceleration: "acceleration", fast: "fastPlateau" }[match[1]]; const field = `${match[2]}Index`; analysisDraft[key] ||= {}; analysisDraft[key][field] = clamp((analysisDraft[key][field] ?? 0) + direction * magnitude, 0, decoded.merged.length - 1); renderGraph();
    }
    function moveDrag(event) {
      if (!dragging || dragging.target !== event.currentTarget || event.isPrimary === false) return;
      if (dragging.kind === "balance-draw") { updateBalanceDrawFromPointer(event); return; }
      if (dragging.kind === "experiment-pull") {
        const point = svgPointFromEvent(event);
        const deltaForceN = (point.x - dragging.lastPointX) / EXPERIMENT_FORCE_SCALE_PX_PER_N;
        if (Math.abs(deltaForceN) > 0.001) {
          setExperimentAppliedForce(experimentAppliedForceN + deltaForceN);
          dragging.lastPointX = point.x;
        }
        renderApparatus();
        return;
      }
      const target = event.currentTarget.dataset.dragTarget;
      const steps = Math.round((event.clientX - dragging.startX) / 10); if (steps) { adjustDragTarget(target, steps > 0 ? 1 : -1, Math.abs(steps)); dragging.startX = event.clientX; }
    }
    function endDrag(event) {
      if (!dragging || dragging.target !== event.currentTarget) return;
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
      const releasedBreakaway = dragging.kind === "balance-draw" && dragging.mode === "breakaway";
      const releasedExperiment = dragging.kind === "experiment-pull";
      if (analysisDraft && state?.phase === "analysis") persistAnalysisDraft();
      dragging = null;
      if (releasedBreakaway) {
        balanceForceEndpointX = null;
        updateBreakawayReadout(0);
        ensureBalanceMotionLoop();
      }
      if (releasedExperiment) {
        experimentAppliedForceN = 0;
        experimentForceControlActive = false;
        resetExperimentHandleToRest();
      }
      saveDraft(); render();
    }
    function cancelDrag() {
      if (!dragging) return;
      try { dragging.target.releasePointerCapture?.(dragging.pointerId); } catch {}
      if (dragging.kind === "experiment-pull") {
        experimentAppliedForceN = 0;
        experimentForceControlActive = false;
        resetExperimentHandleToRest();
        dragging = null;
        render();
        return;
      }
      if (dragging.kind === "balance-draw" && dragging.mode === "breakaway") {
        balanceForceEndpointX = null;
        dragging = null;
        updateBreakawayReadout(0);
        ensureBalanceMotionLoop();
        saveDraft(); render();
        return;
      }
      if (dragging.kind === "balance-draw") {
        cancelBalanceMotion();
        balanceDrawings = clone(dragging.balanceDrawings);
        balanceDrawingsSource = dragging.balanceDrawingsSource;
        balanceTrialDirection = dragging.balanceTrialDirection;
        balanceTrialPullCN = dragging.balanceTrialPullCN;
        balanceTrialRecorded = dragging.balanceTrialRecorded;
        balanceMotionActive = dragging.motionActive;
        balanceMotionOffsetM = dragging.motionOffsetM;
      }
      if (dragging.checkpoint && state && !recorder?.running) state = dragging.checkpoint;
      analysisDraft = clone(dragging.checkpointDraft);
      document.querySelectorAll("[data-prediction-field='magnitudeCN']").forEach((input, index) => { if (dragging.predictionMagnitudes?.[index] != null) input.value = dragging.predictionMagnitudes[index]; });
      dragging = null; saveDraft(); render();
    }
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
      // stage visible above them on phones and to their left on desktop.
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
    const controllerApi = { activity: ACTIVITY, boot, getState: () => clone(state), getScenario: () => scenario, getPresentation: () => presentation, getResult: () => clone(latestResult), mayReveal: () => mayRevealCorrectness(presentation), interactionEvidence: () => ({ dragging: Boolean(dragging), recorderRunning: Boolean(recorder?.running), phase: state?.phase, experiment: directExperimentState ? { positionM: directExperimentState.block.positionM, velocityMps: directExperimentState.block.velocityMps, accelerationMps2: directExperimentState.block.accelerationMps2, appliedForceN: experimentAppliedForceN, measuredForceN: experimentVisibleForceN(), timeS: directExperimentState.timeS, timedOut: experimentTimedOut, contactMode: directExperimentState.contact?.mode } : null, balanceMotion: balanceDirectState ? { positionM: balanceDirectState.block.positionM, velocityMps: balanceDirectState.block.velocityMps, accelerationMps2: balanceDirectState.block.accelerationMps2, appliedForceN: balanceCurrentForceN(), offscreen: balanceOffscreen } : null }), render, routeAttempt: applyAttempt, routeStartup, routeSubmission, cancelDrag, hostSwipe };
    return controllerApi;
  }
  function boot() { if (dependencyIssue()) return createTechnicalApp(new Error("missing activity dependency")); return createController().boot(); }
  return Object.freeze({ ACTIVITY, PHASES, PHASE_LABELS, mayRevealCorrectness, buildEditableViewModel, buildResultViewModel, routeStartup, routeSubmission, simulateBalanceRig, localExtremaIndices, createTechnicalApp, createController, boot });
});
