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
  const ANALYSIS_MARKER_META = Object.freeze([
    Object.freeze({ key: "staticFriction", id: "staticFrictionMarker", target: "static-friction-marker", label: "靜摩擦力", color: "#2563eb", className: "analysis-marker-static" }),
    Object.freeze({ key: "maximumStaticFriction", id: "maximumStaticFrictionMarker", target: "maximum-static-friction-marker", label: "最大靜摩擦力", color: "#c2410c", className: "analysis-marker-maximum" }),
    Object.freeze({ key: "kineticFriction", id: "kineticFrictionMarker", target: "kinetic-friction-marker", label: "滑動摩擦力", color: "#15803d", className: "analysis-marker-kinetic" })
  ]);
  const EXPERIMENT_START_POSITION_M = 0;
  const EXPERIMENT_FORCE_SCALE_PX_PER_N = 30;
  const EXPERIMENT_MAX_FORCE_N = 12;
  // The B physics remains the ordinary fixed-kinetic-friction Newton model.
  // Keep the visual track close to the physical track so the automatically
  // maintained post-breakaway motion is clearly visible within 30 seconds.
  const EXPERIMENT_RENDER_TRACK_MULTIPLIER = 1;
  const EXPERIMENT_AUTO_LAUNCH_DURATION_S = 0.18;
  const EXPERIMENT_AUTO_LAUNCH_SURPLUS_N = 0.50;
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
    let experimentAutoKineticHold = false;
    let experimentAutoHoldElapsedS = 0;
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
    function svgElement(tag, attrs = {}, textContent = null) { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); if (textContent != null) node.append(document.createTextNode(String(textContent))); return node; }
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
      if (!state || !Persistence.PHASES.includes(phase)) throw new Error("invalid learner task navigation");
      if (state.phase === phase) return;
      if (state.phase === "experiment" && recorder?.running) abortExperimentRecording("已中止未完成的 B 記錄；切換任務後可重新開始。");
      cancelBalanceMotion();
      state = Persistence.transitions.setPhase(state, phase);
      if (phase === "review") {
        presentation = "editable";
        latestResult = null;
        q("controlPanel")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      analysisDraft = phase === "analysis" ? null : analysisDraft;
      predictionDraft = phase === "predict" ? [] : predictionDraft;
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
        const allowedWhileLocked = finishRetry || pendingRetry;
        if (locked) {
          if (allowedWhileLocked) {
            node.disabled = false;
            delete node.dataset.lockDisabled;
          } else {
            if (!node.disabled) node.dataset.lockDisabled = "true";
            node.disabled = true;
          }
        } else if (node.dataset.lockDisabled === "true") {
          node.disabled = false;
          delete node.dataset.lockDisabled;
        }
        node.setAttribute("aria-disabled", String(Boolean(node.disabled)));
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
    function focusReviewSurface() {
      q("controlPanel")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      focusPhase("review");
    }
    function currentAnalysisKey() {
      if (!state) return null;
      if (state.fromReview && state.working?.reviewEditTarget?.section === "analysis") return state.working.reviewEditTarget.semanticKey;
      return Persistence.ANALYSIS_KEYS[state.working?.activeAnalysisTask ?? 0] || null;
    }
    function analysisMarkerDefaults(trial) {
      // Keep the three graph targets unselected until the learner drags them.
      // Candidate windows are scoring authority only and must never become
      // editable defaults or hidden answer overlays.
      if (!trial) return { staticFriction: null, maximumStaticFriction: null, kineticFriction: null };
      return { staticFriction: null, maximumStaticFriction: null, kineticFriction: null };
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
      const showExperimentOrigin = phase === "experiment" && !state?.fromReview && Boolean(recorder?.running) && !experimentAutoKineticHold;
      setTargetVisible("experimentOrigin", showExperimentOrigin);
      q("experimentOrigin")?.classList.toggle("is-coached", showExperimentOrigin);
      setTargetVisible("balanceOrigin", activeBalance && !balanceOffscreen);
      q("balanceOrigin")?.classList.toggle("is-coached", activeBalance);
      setTargetVisible("resetBalanceObject", activeBalance && balanceOffscreen);
      setTargetVisible("predictionFriction", phase === "predict");
      q("predictionFriction")?.classList.toggle("is-coached", phase === "predict");
      const reviewKey = state?.fromReview && state.working?.reviewEditTarget?.section === "analysis" ? state.working.reviewEditTarget.semanticKey : null;
      for (const marker of ANALYSIS_MARKER_META) {
        const visible = phase === "analysis" && Boolean(state?.trial) && (!state.fromReview || reviewKey === marker.key);
        setTargetVisible(marker.id, visible);
      }
    }
    function renderStageCoach() {
      const coach = q("stageCoach");
      if (!coach || !state || ["analysis", "predict", "review"].includes(state.phase)) {
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
          title = "這次記錄未能保存"; text = "請按「開始 30 秒記錄」重新嘗試；只需逐漸增加拉力，直到物體啱啱開始移動。";
        } else if (recorder?.running) {
          title = "記錄中：逐漸增加拉力至物體開始移動"; text = experimentAutoKineticHold ? "物體已開始移動；系統會自動維持接近勻速的拉力。" : "按住中央小圓點向右拖，逐漸增加拉力，直到物體啱啱開始移動；之後由系統維持拉力。";
        } else {
          title = "先按右邊的「開始 30 秒記錄」"; text = "開始後按住物體中央的小圓點向右拖動，逐漸增加拉力，直到物體啱啱開始移動。";
        }
      } else if (state.phase === "predict") {
        const index = currentPredictionIndex();
        step = `D${index + 1}/4`;
        title = state.fromReview ? `修改 D${index + 1}：重畫摩擦力` : `D${index + 1}：先畫出摩擦力`;
        text = "由物體中央旁的藍色小圓點拖出箭嘴；不畫代表摩擦力為零，然後在控制欄選擇類型及運動結果。";
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
      const viewBox = svg.viewBox?.baseVal;
      const viewWidth = finite(viewBox?.width, 900) || 900;
      const viewHeight = finite(viewBox?.height, 430) || 430;
      const scale = Math.min(svgRect.width / viewWidth, svgRect.height / viewHeight);
      return {
        scale,
        viewWidth,
        viewHeight,
        left: svgRect.left - stageRect.left + (svgRect.width - viewWidth * scale) / 2,
        top: svgRect.top - stageRect.top + (svgRect.height - viewHeight * scale) / 2
      };
    }
    function positionApparatusTarget(target, viewX, viewY) {
      const layout = apparatusLayout();
      if (!target || !layout) return;
      target.style.left = `${layout.left + clamp(viewX, 0, layout.viewWidth) * layout.scale}px`;
      target.style.top = `${layout.top + clamp(viewY, 0, layout.viewHeight) * layout.scale}px`;
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
      experimentAutoKineticHold = false;
      experimentAutoHoldElapsedS = 0;
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
      experimentAutoKineticHold = false;
      experimentAutoHoldElapsedS = 0;
      experimentAccumulatorS = 0;
      stopLoop();
      if (message) setText("experimentStatus", message);
    }
    function setExperimentAppliedForce(value) {
      if (experimentAutoKineticHold) return;
      experimentAppliedForceN = clamp(finite(value), 0, EXPERIMENT_MAX_FORCE_N);
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
    function experimentKineticHoldForceN() {
      if (!scenario || !directExperimentState) return 0;
      return clamp(Math.max(0, finite(Physics.kineticFrictionAt(directExperimentState, scenario))), 0, EXPERIMENT_MAX_FORCE_N);
    }
    function stepExperimentKineticHold(stepS) {
      // The learner's spring/connector pull creates the breakaway peak and
      // natural drop.  A short, low surplus launch makes the new sliding
      // motion observable; after that transient, the system supplies the
      // local fixed kinetic-friction force so the block continues at a
      // nearly constant speed.
      const kineticForceN = experimentKineticHoldForceN();
      const launchSurplusN = experimentAutoHoldElapsedS < EXPERIMENT_AUTO_LAUNCH_DURATION_S ? EXPERIMENT_AUTO_LAUNCH_SURPLUS_N : 0;
      const holdForceN = clamp(kineticForceN + launchSurplusN, 0, EXPERIMENT_MAX_FORCE_N);
      experimentAppliedForceN = holdForceN;
      const directInputState = {
        timeS: directExperimentState.timeS,
        block: directExperimentState.block,
        contact: directExperimentState.contact
      };
      const next = Physics.stepDirectForce(directInputState, holdForceN, scenario, stepS);
      const stiffness = Math.max(1, finite(scenario.connector?.stiffnessNPerM, 300));
      const extensionM = holdForceN / stiffness;
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
      const textClass = `force-builder-label${className.includes("experiment-force-arrow") ? " experiment-force-label" : ""}`;
      const text = svgElement("text", { x: (startX + endX) / 2, y: labelY, "text-anchor": "middle", class: textClass, fill: color }); text.appendChild(document.createTextNode(label)); svg.append(text);
    }
    function experimentFeedbackText() {
      if (experimentTimedOut) return "時間已經超時，請重新開始記錄。";
      if (!recorder?.running || !directExperimentState) return "按開始後直接拖動物體中央；F拉–t 圖會同步記錄，系統不顯示摩擦力。";
      if (experimentAutoKineticHold) return "物體已開始移動；系統正維持接近勻速的拉力。";
      if (directExperimentState.contact?.mode === "static" || Math.abs(finite(directExperimentState.block?.velocityMps)) < 0.015) return "慢慢增加拉力，直到物體開始移動。";
      return "繼續逐漸增加拉力，直到物體啱啱開始移動。";
    }
    function renderExperimentForceGraph(svg) {
      let defs = svg.querySelector("defs");
      if (!defs) { defs = svgElement("defs"); svg.append(defs); }
      const axisMarker = svgElement("marker", { id: "graph-axis-arrow", viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: 15, markerHeight: 15, markerUnits: "userSpaceOnUse", orient: "auto" });
      axisMarker.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#334155" }));
      defs.append(axisMarker);
      const chart = { left: 54, top: 28, width: 792, height: 168, maxTimeS: 30, maxForceN: 12 };
      const xFor = (timeS) => chart.left + clamp(timeS, 0, chart.maxTimeS) / chart.maxTimeS * chart.width;
      const yFor = (forceN) => chart.top + chart.height - clamp(forceN, 0, chart.maxForceN) / chart.maxForceN * chart.height;
      for (let time = 0; time <= chart.maxTimeS; time += 5) {
        const x = xFor(time);
        svg.append(svgElement("line", { x1: x, y1: chart.top, x2: x, y2: chart.top + chart.height, class: "graph-grid" }));
        const label = svgElement("text", { x, y: chart.top + chart.height + 28, "text-anchor": "middle", class: "graph-tick-label" }); label.appendChild(document.createTextNode(String(time))); svg.append(label);
      }
      for (let force = 0; force <= chart.maxForceN; force += 3) {
        const y = yFor(force);
        svg.append(svgElement("line", { x1: chart.left, y1: y, x2: chart.left + chart.width, y2: y, class: "graph-grid" }));
        const label = svgElement("text", { x: chart.left - 10, y: y + 5, "text-anchor": "end", class: "graph-tick-label" }); label.appendChild(document.createTextNode(String(force))); svg.append(label);
      }
      svg.append(svgElement("line", { x1: chart.left, y1: chart.top + chart.height, x2: chart.left, y2: chart.top, class: "graph-axis", "marker-end": "url(#graph-axis-arrow)" }));
      svg.append(svgElement("line", { x1: chart.left, y1: chart.top + chart.height, x2: chart.left + chart.width, y2: chart.top + chart.height, class: "graph-axis", "marker-end": "url(#graph-axis-arrow)" }));
      const yLabel = svgElement("text", { x: 22, y: chart.top + chart.height / 2, transform: `rotate(-90 22 ${chart.top + chart.height / 2})`, "text-anchor": "middle", class: "graph-axis-label" });
      const yF = svgElement("tspan", { "font-style": "italic" }); yF.textContent = "F"; yLabel.append(yF);
      const ySub = svgElement("tspan", { "baseline-shift": "sub", "font-size": "70%" }); ySub.textContent = "拉"; yLabel.append(ySub);
      yLabel.append(document.createTextNode(" / N")); svg.append(yLabel);
      const xLabel = svgElement("text", { x: chart.left + chart.width / 2, y: chart.top + chart.height + 55, "text-anchor": "middle", class: "graph-axis-label" });
      const xT = svgElement("tspan", { "font-style": "italic" }); xT.textContent = "t"; xLabel.append(xT);
      xLabel.append(document.createTextNode(" / s")); svg.append(xLabel);
      // Entering B again deliberately resets the transient physics and sensor
      // state.  The accepted trial is the durable source for both B and C;
      // use it whenever there is no live recording to render.
      const savedTrace = state?.trial ? Measurement.unpackTrace(state.trial) : null;
      const liveSamples = measurementState?.regularSamples || [];
      const samples = liveSamples.length ? liveSamples : (savedTrace?.regularSamples || []);
      const breakaway = measurementState?.breakaway || savedTrace?.breakaway || null;
      const points = samples.map((sample) => ({ timeS: sample.timeS, forceN: sample.measuredPullN, kind: "regular" }));
      if (breakaway) {
        points.push({ timeS: breakaway.timeMs / 1000, forceN: breakaway.measuredPullCN / 100, kind: "breakaway" });
      }
      if (directExperimentState && (recorder?.running || experimentTimedOut) && measurementState) {
        const live = Measurement.liveReading(measurementState);
        const timeS = finite(directExperimentState.timeS);
        points.push({ timeS, forceN: live.forceN, kind: "live" });
      }
      if (points.length) {
        points.sort((a, b) => a.timeS - b.timeS || (a.kind === "breakaway" ? 1 : b.kind === "breakaway" ? -1 : 0));
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
      const reviewMode = state?.phase === "review";
      svg.classList.toggle("is-hidden", graphMode);
      q("stageGraph")?.classList.toggle("is-hidden", !graphMode);
      q("experimentGraphStage")?.classList.toggle("is-hidden", !experimentMode || graphMode);
      q("stage")?.classList.toggle("has-experiment-graph", experimentMode && !graphMode);
      q("stage")?.classList.toggle("has-prediction", predictionMode);
      // The control card already exposes the prediction details.  Keep the
      // stage clear so a long mobile readout cannot cover the block.
      q("predictionReadout")?.classList.add("is-hidden");
      const experimentGraphSvg = q("experimentGraphSvg");
      if (!experimentMode) experimentGraphSvg?.replaceChildren();
      renderDragTargets();
      renderStageCoach();
      if (graphMode) { renderGraph(); return; }
      svg.replaceChildren();
      svg.setAttribute("viewBox", experimentMode ? "0 0 900 260" : "0 0 900 430");
      const groundY = experimentMode ? 170 : predictionMode ? 240 : 300;
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
      const physicsTrackLengthM = scenario?.stage.lengthM || 1.65;
      const position = predictionMode ? .45 : reviewMode ? physicsTrackLengthM / 2 : balanceMode ? (balanceDirectState?.block?.positionM ?? (.72 + balanceMotionOffsetM)) : experimentMode ? (directExperimentState?.block?.positionM ?? EXPERIMENT_START_POSITION_M) : physicsState?.block?.positionM ?? 0;
      const target = predictionMode ? .95 : physicsState?.handle?.positionM ?? (scenario?.connector.restLengthM || .18);
      const renderTrackLengthM = experimentMode ? physicsTrackLengthM * EXPERIMENT_RENDER_TRACK_MULTIPLIER : physicsTrackLengthM;
      const positionFraction = position / renderTrackLengthM;
      const x = balanceMode ? 100 + positionFraction * 650 : experimentMode ? 45 + clamp(positionFraction, 0, 1) * 728 : 100 + clamp(positionFraction, .04, .88) * 650;
      const hx = 100 + clamp(target / (scenario?.stage.lengthM || 1.65), 0, 1) * 650;
      svg.append(svgElement("rect", { x, y: groundY - 54, width: 92, height: 54, rx: 8, class: "apparatus-block" }));
      if (!balanceMode && !experimentMode && !predictionMode && !reviewMode) {
        svg.append(svgElement("line", { x1: x + 92, y1: groundY - 27, x2: hx, y2: groundY - 27, class: "apparatus-rope" }));
        svg.append(svgElement("rect", { x: hx - 12, y: groundY - 43, width: 34, height: 32, rx: 7, class: "apparatus-grip" }));
      }
      const experimentOrigin = q("experimentOrigin");
      if (experimentMode) {
        const comX = x + 46;
        const comY = groundY - 27;
        const visibleForceN = experimentVisibleForceN();
        const endpoint = clamp(comX + visibleForceN * EXPERIMENT_FORCE_SCALE_PX_PER_N, comX, 880);
        if (visibleForceN > .01) appendForceArrow(svg, comX, endpoint, comY, "pull-arrow experiment-force-arrow", "#b91c1c", `拉力 ${visibleForceN.toFixed(2)} N`, groundY - 64);
        if (experimentOrigin) {
          positionApparatusTarget(experimentOrigin, comX, comY);
          experimentOrigin.setAttribute("aria-label", `由物體中央向右拖動拉力，目前 ${visibleForceN.toFixed(2)} 牛頓`);
        }
        if (experimentGraphSvg) {
          experimentGraphSvg.replaceChildren();
          renderExperimentForceGraph(experimentGraphSvg);
        }
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
        if ((spec?.pullN || 0) > .01) appendForceArrow(svg, comX, comX + Math.min(180, (spec?.pullN || 0) * scale), comY, "pull-arrow prediction-pull-arrow", "#b91c1c", `已知拉力 ${(spec?.pullN || 0).toFixed(1)} N`, pullLabelY);
        if (frictionN > .01 && ["left", "right"].includes(response?.direction)) appendForceArrow(svg, comX, comX + clamp(signedFrictionN * scale, -180, 180), comY, "learner-friction-arrow prediction-friction-arrow", "#1d4ed8", `摩擦力 ${frictionN.toFixed(2)} N`, frictionLabelY);
        const predictionHandle = q("predictionFriction"); if (predictionHandle) { positionApparatusTarget(predictionHandle, endpoint, comY); predictionHandle.setAttribute("aria-label", `D${index + 1} 摩擦力箭嘴，目前 ${frictionN > .01 ? `${frictionN.toFixed(2)} 牛頓、方向${response?.direction === "left" ? "向左" : "向右"}` : "未畫出（0 牛頓）"}`); }
        setText("predictionReadout", `D${index + 1}：已知拉力 ${(spec?.pullN || 0).toFixed(1)} N；初速度 ${(spec?.velocityMps || 0).toFixed(2)} m/s；畫出的摩擦力 ${frictionN > .01 ? `${frictionN.toFixed(2)} N` : "0 N"}。`);
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
          const nextPhysical = experimentAutoKineticHold
            ? stepExperimentKineticHold(stepS)
            : Physics.stepPhysics(directExperimentState, handleInput, scenario, stepS);
          if (experimentAutoKineticHold) experimentAutoHoldElapsedS += stepS;
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
              experimentAutoKineticHold = true;
              experimentAutoHoldElapsedS = 0;
              experimentAppliedForceN = experimentKineticHoldForceN();
              announce("物體已開始移動；系統正維持接近勻速的拉力");
              setText("experimentStatus", "物體已開始移動；拉力已由峰值降至滑動摩擦力附近，系統會自動維持接近勻速。請稍後按「停止並保存記錄」。");
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
      experimentAutoKineticHold = false;
      experimentAutoHoldElapsedS = 0;
      experimentAccumulatorS = 0;
      breakawayAnnounced = false;
      markRecordingActive(true);
      announce("記錄開始");
      setText("experimentStatus", "記錄進行中：逐漸增加物體中央的向右拉力，直到物體啱啱開始移動；30 秒內完成。");
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
        setText("experimentStatus", "已重新開始記錄：逐漸增加向右拉力，直到物體啱啱開始移動；30 秒內完成。");
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
        experimentAutoHoldElapsedS = 0;
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
      experimentAutoKineticHold = false;
      experimentAutoHoldElapsedS = 0;
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
      experimentAutoKineticHold = false;
      experimentAutoHoldElapsedS = 0;
      markRecordingActive(false);
      recorder = null;
      experimentQuality = { valid: false, neutralMessage: "時間已經超時，請重新開始記錄。" };
      setText("experimentStatus", "時間已經超時，請重新開始記錄。");
      announce("時間已經超時，請重新開始記錄");
      render();
    }
    function analysisChartConfig(decoded) {
      const observedTimeS = decoded.merged.reduce((latest, sample) => Math.max(latest, finite(sample.timeS)), 0);
      return {
        ...Graph.GRAPH,
        // Leave a clear frame around the plot and use the actual recorded
        // duration instead of reserving empty space up to 30 seconds.
        left: 108,
        top: 54,
        width: 660,
        height: 294,
        maxTimeS: Math.min(30, Math.max(5, Math.ceil(Math.max(1, observedTimeS) / 5) * 5)),
        viewWidth: 820,
        viewHeight: 430,
        timeTickCount: 5
      };
    }
    function analysisGraphPointFromEvent(event) {
      const svg = q("graphSvg");
      if (!svg) return null;
      try {
        const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
        const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
        return { x: transformed.x, y: transformed.y };
      } catch {
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox?.baseVal;
        const viewWidth = finite(viewBox?.width, 820) || 820;
        const viewHeight = finite(viewBox?.height, 430) || 430;
        return { x: (event.clientX - rect.left) * viewWidth / Math.max(1, rect.width), y: (event.clientY - rect.top) * viewHeight / Math.max(1, rect.height) };
      }
    }
    function analysisIndexFromPointer(event, decoded) {
      const point = analysisGraphPointFromEvent(event);
      if (!point || !decoded?.merged?.length) return 0;
      const chart = analysisChartConfig(decoded);
      const timeS = clamp((point.x - chart.left) / chart.width * chart.maxTimeS, 0, chart.maxTimeS);
      return Graph.canonicalIndexAtTime(decoded, timeS);
    }
    function analysisMarkerLabelLayout(selectedMarkers, chart) {
      const rows = [];
      const layout = {};
      const rowGap = 8;
      selectedMarkers.forEach(({ markerIndex, label, x }) => {
        const width = Math.max(52, Array.from(label).length * 17);
        const anchor = x - chart.left < width / 2 ? "start" : x + width / 2 > chart.left + chart.width ? "end" : "middle";
        const left = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
        const right = anchor === "start" ? x + width : anchor === "end" ? x : x + width / 2;
        let row = 0;
        while (rows[row]?.some((box) => left < box.right + rowGap && right > box.left - rowGap)) row += 1;
        rows[row] ||= [];
        rows[row].push({ left, right });
        layout[markerIndex] = { x, y: chart.top - 18 + row * 22, anchor };
      });
      return layout;
    }
    function setAnalysisTargetPosition(target, svg, x, y, chart) {
      if (!target || !svg) return;
      const layer = q("dragLayer")?.getBoundingClientRect();
      try {
        const point = svg.createSVGPoint(); point.x = x; point.y = y;
        const screen = point.matrixTransform(svg.getScreenCTM());
        if (layer?.width && layer?.height) {
          target.style.left = `${clamp((screen.x - layer.left) / layer.width * 100, 0, 100)}%`;
          target.style.top = `${clamp((screen.y - layer.top) / layer.height * 100, 0, 100)}%`;
          return;
        }
      } catch {}
      target.style.left = `${clamp(x / chart.viewWidth * 100, 0, 100)}%`;
      target.style.top = `${clamp(y / chart.viewHeight * 100, 0, 100)}%`;
    }
    function renderGraph() {
      const svg = q("graphSvg"); if (!svg) return;
      if (!state?.trial) { svg.replaceChildren(); setText("graphCursorReadout", "請先在 Part B 完成並保存一份有效的實驗記錄。"); return; }
      svg.replaceChildren();
      const decoded = Measurement.unpackTrace(state.trial);
      const chart = analysisChartConfig(decoded);
      const formatTimeTick = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);
      const defs = svgElement("defs");
      const axisMarker = svgElement("marker", { id: "analysis-axis-arrow", viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: 14, markerHeight: 14, markerUnits: "userSpaceOnUse", orient: "auto" });
      axisMarker.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#334155" }));
      defs.append(axisMarker); svg.append(defs);
      for (let i = 0; i <= chart.timeTickCount; i += 1) {
        const timeS = chart.maxTimeS * i / chart.timeTickCount;
        const x = Graph.timeToX(timeS, chart);
        svg.append(svgElement("line", { x1: x, y1: chart.top, x2: x, y2: chart.top + chart.height, class: "graph-grid" }));
      }
      for (let i = 0; i <= 4; i += 1) { const y = Graph.forceToY(i * 3, chart); svg.append(svgElement("line", { x1: chart.left, y1: y, x2: chart.left + chart.width, y2: y, class: "graph-grid" })); }
      svg.append(svgElement("line", { x1: chart.left, y1: chart.top + chart.height, x2: chart.left, y2: chart.top, class: "graph-axis", "marker-end": "url(#analysis-axis-arrow)" }));
      svg.append(svgElement("line", { x1: chart.left, y1: chart.top + chart.height, x2: chart.left + chart.width, y2: chart.top + chart.height, class: "graph-axis", "marker-end": "url(#analysis-axis-arrow)" }));
      for (let i = 0; i <= chart.timeTickCount; i += 1) {
        const timeS = chart.maxTimeS * i / chart.timeTickCount;
        svg.append(svgElement("text", { x: Graph.timeToX(timeS, chart), y: chart.top + chart.height + 27, "text-anchor": "middle", class: "graph-tick-label" }, formatTimeTick(timeS)));
      }
      for (let i = 0; i <= 4; i += 1) svg.append(svgElement("text", { x: chart.left - 14, y: Graph.forceToY(i * 3, chart) + 6, "text-anchor": "end", class: "graph-tick-label" }, `${i * 3}`));
      svg.append(svgElement("path", { d: Graph.svgPath(decoded, "force", chart), class: "force-line analysis-force-line", stroke: "#b91c1c", "aria-label": "拉力 F拉—時間 t" }));
      const yLabelX = 42;
      const graphCenterY = chart.top + chart.height / 2;
      const yLabel = svgElement("text", { x: yLabelX, y: graphCenterY, transform: `rotate(-90 ${yLabelX} ${graphCenterY})`, "text-anchor": "middle", class: "graph-axis-label" });
      const yF = svgElement("tspan", { "font-style": "italic" }); yF.textContent = "F"; yLabel.append(yF);
      const ySub = svgElement("tspan", { "baseline-shift": "sub", "font-size": "70%" }); ySub.textContent = "拉"; yLabel.append(ySub); yLabel.append(document.createTextNode(" / N")); svg.append(yLabel);
      const xLabel = svgElement("text", { x: chart.left + chart.width / 2, y: chart.top + chart.height + 61, "text-anchor": "middle", class: "graph-axis-label" });
      const xT = svgElement("tspan", { "font-style": "italic" }); xT.textContent = "t"; xLabel.append(xT); xLabel.append(document.createTextNode(" / s")); svg.append(xLabel);
      const draft = ensureAnalysisDraft();
      const readouts = [];
      const markerPositions = ANALYSIS_MARKER_META.map((marker, markerIndex) => {
        const selectedIndex = Number.isInteger(draft?.[marker.key]?.index) ? draft[marker.key].index : null;
        const index = selectedIndex == null ? null : clamp(Math.round(selectedIndex), 0, decoded.merged.length - 1);
        const sample = index == null ? null : decoded.merged[index];
        return sample ? { markerIndex, sample, x: Graph.timeToX(sample.timeS, chart), label: marker.label } : null;
      });
      const labelLayout = analysisMarkerLabelLayout(markerPositions.filter(Boolean), chart);
      ANALYSIS_MARKER_META.forEach((marker, markerIndex) => {
        const markerPosition = markerPositions[markerIndex];
        const sample = markerPosition?.sample || null;
        const target = q(marker.id);
        if (sample) {
          const x = markerPosition.x; const y = Graph.forceToY(sample.measuredPullN, chart);
          svg.append(svgElement("line", { x1: x, y1: chart.top, x2: x, y2: chart.top + chart.height, class: `analysis-marker-line ${marker.className}`, "data-marker-key": marker.key, stroke: marker.color }));
          svg.append(svgElement("circle", { cx: x, cy: y, r: 7, class: `analysis-marker-dot ${marker.className}`, fill: marker.color }));
          // Keep each label on the same x-coordinate as its coloured guide.
          // If guides are close, place the labels on separate rows instead of
          // moving them into fixed columns that lose the visual association.
          const labelPosition = labelLayout[markerIndex];
          svg.append(svgElement("text", { x: labelPosition.x, y: labelPosition.y, "text-anchor": labelPosition.anchor, class: `analysis-marker-label ${marker.className}`, "data-marker-key": marker.key, fill: marker.color }, marker.label));
          if (target) { setAnalysisTargetPosition(target, svg, x, chart.top + chart.height - 20, chart); target.setAttribute("aria-label", `${marker.label}位置，目前 ${sample.timeS.toFixed(2)} 秒、${sample.measuredPullN.toFixed(2)} 牛頓`); }
          readouts.push(`${marker.label}：${sample.timeS.toFixed(2)} s，${sample.measuredPullN.toFixed(2)} N`);
        } else if (target) {
          const x0 = chart.left + (markerIndex + .5) * chart.width / ANALYSIS_MARKER_META.length;
          setAnalysisTargetPosition(target, svg, x0, chart.top + chart.height - 20, chart);
          target.setAttribute("aria-label", `${marker.label}位置，尚未標示；拖動此圓點到圖線上的位置`);
        }
      });
      setText("graphCursorReadout", readouts.length ? readouts.join("；") : "三個位置尚未標示；請拖動圖上的彩色圓點。 ");
    }
    function ensureAnalysisDraft() {
      if (!state?.trial) return null;
      if (!analysisDraft) {
        analysisDraft = clone(state.analysis);
        if (state.fromReview && state.working?.editDraft?.kind === "analysis-task") analysisDraft[state.working.reviewEditTarget.semanticKey] = clone(state.working.editDraft.value);
      }
      const defaults = analysisMarkerDefaults(state.trial);
      Persistence.ANALYSIS_KEYS.forEach((key) => { if (!(key in analysisDraft)) analysisDraft[key] = clone(defaults[key]); });
      return analysisDraft;
    }
    function renderAnalysisTasks() {
      const host = q("analysisTasks"); if (!host) return;
      if (!state?.trial) {
        host.innerHTML = '<p class="neutral-status">目前沒有可分析的實驗記錄；請先完成 Part B。</p>';
        q("to-predict")?.toggleAttribute("disabled", true);
        renderGraph();
        return;
      }
      const draft = ensureAnalysisDraft(); const decoded = Measurement.unpackTrace(state.trial);
      const rows = ANALYSIS_MARKER_META.map((marker, index) => {
        const selectedIndex = Number.isInteger(draft?.[marker.key]?.index) ? draft[marker.key].index : null;
        const sample = selectedIndex == null ? null : decoded.merged[clamp(Math.round(selectedIndex), 0, decoded.merged.length - 1)];
        const saved = Persistence.analysisTaskComplete(marker.key, state.analysis?.[marker.key]);
        return `<div class="analysis-marker-row"><span class="analysis-marker-swatch ${marker.className}" aria-hidden="true"></span><span><strong>C${index + 1}　${marker.label}</strong><small>${sample ? `${sample.timeS.toFixed(2)} s，${sample.measuredPullN.toFixed(2)} N` : "未標示"}${saved ? "・已保存" : ""}</small></span></div>`;
      }).join("");
      host.innerHTML = `<div class="analysis-marker-card"><p><strong>操作：</strong>直接拖動圖上的彩色圓點；三個位置都完成後按保存。</p><div class="analysis-marker-list">${rows}</div><p class="instruction">標示可隨時再拖動修改。</p></div>`;
      q("to-predict")?.toggleAttribute("disabled", !Persistence.hasAllAnalysisFields(state));
      q("to-predict")?.classList.toggle("is-hidden", Boolean(state.fromReview));
      renderGraph();
    }
    function collectAnalysisDraft() {
      return ensureAnalysisDraft();
    }
    function persistAnalysisDraft() {
      const draft = collectAnalysisDraft(); const key = currentAnalysisKey(); if (!draft || !key) return false;
      state = state.fromReview ? Persistence.transitions.setAnalysisDraft(state, key, draft[key]) : Persistence.transitions.setAnalysisMarkersDraft(state, draft);
      saveDraft(); return true;
    }
    function commitAnalysisDraft(draft) {
      const key = currentAnalysisKey(); if (!draft || !key) return false;
      const editingReview = state.fromReview;
      if (editingReview) {
        if (!Persistence.analysisTaskHasSelection(key, draft[key])) return false;
        state = Persistence.transitions.setAnalysisTask(state, key, { index: draft[key].index, committed: true });
      } else {
        const completed = Object.fromEntries(Persistence.ANALYSIS_KEYS.map((analysisKey) => [analysisKey, { index: Math.round(draft[analysisKey]?.index), committed: true }]));
        if (Persistence.ANALYSIS_KEYS.some((analysisKey) => !Number.isInteger(completed[analysisKey].index))) return false;
        state = Persistence.transitions.setAnalysisMarkers(state, completed);
      }
      analysisDraft = null;
      return true;
    }
    function renderPredictions() {
      const host = q("predictionCards"); if (!host || !scenario) return;
      host.replaceChildren();
      const activeIndex = currentPredictionIndex();
      const answers = state.predictions.map((answer, index) => state.fromReview && state.working?.editDraft?.kind === "prediction" && state.working.reviewEditTarget?.semanticKey === index ? state.working.editDraft.value : answer);
      const progress = document.createElement("div");
      progress.className = "prediction-progress";
      progress.setAttribute("aria-label", "Part D 題目進度");
      scenario.predictions.forEach((spec, index) => {
        const answer = answers[index];
        const step = document.createElement("span");
        step.className = `prediction-progress-step${index === activeIndex ? " is-current" : ""}${answer?.committed ? " is-complete" : ""}`;
        step.innerHTML = `${spec.id}<small>${answer?.committed ? "已保存" : index === activeIndex ? "目前" : "未完成"}</small>`;
        progress.append(step);
      });
      host.append(progress);
      const spec = scenario.predictions[activeIndex];
      const response = answers[activeIndex] || {};
      const magnitude = Number.isInteger(response.magnitudeCN) ? response.magnitudeCN : null;
      const magnitudeText = magnitude == null ? "尚未畫出" : `${(magnitude / 100).toFixed(2)} N`;
      const card = document.createElement("article");
      card.className = "prediction-card prediction-card-active";
      card.dataset.predictionIndex = activeIndex;
      card.innerHTML = `<div class="prediction-card-heading"><p class="task-title">${spec.id}：根據圖示作答</p><span class="prediction-step-label">第 ${activeIndex + 1} 題／共 4 題</span></div><p class="prediction-prompt">先由物體中央旁的藍色小圓點拖出摩擦力箭嘴；不畫箭嘴代表沒有摩擦力。畫出箭嘴後，選擇它是靜摩擦力還是滑動摩擦力。</p><p class="prediction-scenario">已知拉力：<var>F</var><sub>拉</sub> = ${spec.pullN.toFixed(1)} N；初速度：<var>v</var> = ${spec.velocityMps.toFixed(2)} m/s</p><input type="hidden" data-prediction-field="direction" value="${response.direction || ""}"><input type="hidden" data-prediction-field="magnitudeCN" value="${magnitude == null ? "" : magnitude}"><p class="prediction-force-readout">畫出的摩擦力：<output data-prediction-magnitude-readout>${magnitudeText}</output></p><label>摩擦力類型<select data-prediction-field="frictionType"><option value="">請選擇</option><option value="none" ${response.frictionType === "none" ? "selected" : ""}>沒有摩擦力</option><option value="static" ${response.frictionType === "static" ? "selected" : ""}>靜摩擦力</option><option value="kinetic" ${response.frictionType === "kinetic" ? "selected" : ""}>滑動摩擦力</option></select></label><label>運動結果<select data-prediction-field="motionOutcome"><option value="">請選擇</option><option value="remain-still" ${response.motionOutcome === "remain-still" ? "selected" : ""}>保持靜止</option><option value="start-sliding" ${response.motionOutcome === "start-sliding" ? "selected" : ""}>開始滑動</option><option value="speed-up" ${response.motionOutcome === "speed-up" ? "selected" : ""}>加速</option><option value="slow-down" ${response.motionOutcome === "slow-down" ? "selected" : ""}>減速</option></select></label><div class="save-action-row"><button type="button" data-action="save-prediction" class="primary-button">${state.fromReview ? `保存 D${activeIndex + 1} 修改` : `保存 D${activeIndex + 1} 答案`}</button></div>`;
      if (response.committed && !state.fromReview && activeIndex < scenario.predictions.length - 1) card.insertAdjacentHTML("beforeend", `<button type="button" data-action="advance-prediction" class="next-button">下一題 D${activeIndex + 2}</button>`);
      if (response.committed && !state.fromReview && activeIndex >= scenario.predictions.length - 1) card.insertAdjacentHTML("beforeend", `<p class="neutral-status">四題已保存；亦可直接前往提交前檢查。</p>`);
      host.append(card);
      const predictionHandle = q("predictionFriction");
      if (predictionHandle) predictionHandle.setAttribute("aria-label", `D${activeIndex + 1} 摩擦力箭嘴，目前 ${magnitude == null || magnitude === 0 ? "未畫出（0 牛頓）" : `${(magnitude / 100).toFixed(2)} 牛頓、方向${response.direction === "left" ? "向左" : "向右"}`}`);
      q("to-review")?.toggleAttribute("disabled", false);
      q("to-review")?.classList.toggle("is-hidden", Boolean(state.fromReview));
    }
    function collectPredictionDraft(card) {
      if (!card || !state || !scenario) return;
      const index = Number(card.dataset.predictionIndex);
      if (!Number.isInteger(index)) return;
      const values = {};
      card.querySelectorAll("[data-prediction-field]").forEach((input) => { values[input.dataset.predictionField] = input.dataset.predictionField === "magnitudeCN" ? (input.value === "" ? null : Math.round(Number(input.value))) : (input.value || null); });
      try {
        state = Persistence.transitions.setPrediction(state, index, { id: scenario.predictions[index].id, scenarioId: scenario.predictions[index].scenarioId, frictionType: values.frictionType, direction: values.direction, magnitudeCN: values.magnitudeCN, motionOutcome: values.motionOutcome, committed: false });
        saveDraft();
      } catch {}
    }
    function renderReview() {
      const host = q("reviewSummary"); if (!host || !state) return;
      const balanceDone = [state.balance.zeroForce?.committed, state.balance.staticCase?.learnerAppliedForce?.committed && state.balance.staticCase?.learnerForce?.committed, state.balance.breakaway?.committed].filter(Boolean).length;
      const requiredComplete = Persistence.hasRequiredAuthority(state);
      const predictionDone = state.predictions.filter((prediction) => prediction?.committed === true).length;
      const reviewMessage = requiredComplete ? "已保存的作答資料完整，可以提交。" : "可先核對已保存答案，再提交。";
      host.innerHTML = `<ul><li>Part A 三項任務：${balanceDone}/3</li><li>Part B 實驗記錄：${state.trial ? "已保存" : "未完成"}</li><li>Part C 圖像標示：${Persistence.hasAllAnalysisFields(state) ? "三項已保存" : "尚未完整"}</li><li>Part D 預測：${predictionDone}/4</li></ul><p class="${requiredComplete ? "result-good" : "result-neutral"}">${reviewMessage}</p>`;
      const editActions = [];
      if (state.balance.zeroForce?.committed) editActions.push('<button type="button" data-action="edit-balance">修改 A1 零拉力判斷</button>');
      if (state.balance.staticCase?.learnerAppliedForce?.committed && state.balance.staticCase?.learnerForce?.committed) editActions.push('<button type="button" data-action="edit-balance-task" data-balance-key="static-case">修改 A2 力箭嘴判斷</button>');
      if (state.balance.breakaway?.committed) editActions.push('<button type="button" data-action="edit-balance-task" data-balance-key="breakaway">修改 A3 最大靜摩擦力估計</button>');
      if (state.trial) editActions.push('<button type="button" data-action="edit-experiment">重新做 B 實驗</button>');
      const reviewEditActions = q("reviewEditActions");
      if (reviewEditActions) reviewEditActions.innerHTML = editActions.length ? editActions.join("") : '<p class="neutral-status review-empty-actions">目前沒有已保存答案；可用上方任務列返回作答。</p>';
      q("submit")?.toggleAttribute("disabled", !Persistence.hasSubmittableAnswer(state));
      const analysisButtons = q("analysisEditButtons");
      if (analysisButtons) {
        const savedAnalysis = Persistence.ANALYSIS_KEYS.map((key, index) => state.analysis?.[key]?.committed ? `<button type="button" data-action="edit-analysis" data-analysis-key="${key}">修改 C${index + 1}</button>` : "").filter(Boolean);
        analysisButtons.innerHTML = savedAnalysis.join("");
      }
      const predictionButtons = q("predictionEditButtons");
      if (predictionButtons) predictionButtons.innerHTML = state.predictions.map((prediction, index) => prediction?.committed ? `<button type="button" data-action="edit-predict" data-prediction-index="${index}">修改 D${index + 1}</button>` : "").join("");
      q("submit")?.classList.toggle("is-hidden", presentation !== "editable");
      q("cancelReviewEdit")?.classList.toggle("is-hidden", !state.fromReview);
    }
    function scoreBreakdownMarkup(result, currentScenario) {
      const breakdown = result?.breakdown;
      if (!breakdown) return '<p class="neutral-status">目前只有可信的總分摘要，沒有可重建的逐項得分資料。</p>';
      const groups = [
        { key: "balance", title: "Part A：受力圖與最大靜摩擦力", items: [["zero-force", "A1 零拉力判斷", 4], ["static-case", "A2 力平衡判斷", 6], ["maximum-static-friction", "A3 最大靜摩擦力估計", 10]] },
        { key: "experiment", title: "Part B：拉力—時間實驗", items: [["breakaway", "B1 觀察開始滑動", 10], ["continued-motion", "B2 觀察持續移動", 10]] },
        { key: "analysis", title: "Part C：圖像分析", items: [["static-friction", "C1 靜摩擦力位置", 13], ["maximum-static-friction", "C2 最大靜摩擦力位置", 14], ["kinetic-friction", "C3 滑動摩擦力位置", 13]] },
        { key: "predictions", title: "Part D：情境預測", items: (currentScenario?.predictions || []).map((spec, index) => [spec.scenarioId || spec.id || `D${index + 1}`, `${spec.id || `D${index + 1}`} 預測`, 5]) }
      ];
      return `<section class="score-breakdown" aria-label="逐部分得分及扣分"><h3>各部分得分及扣分</h3>${groups.map((group) => {
        const part = breakdown[group.key] || {};
        const partScore = Number.isFinite(part.score) ? part.score : 0;
        const partMax = Number.isFinite(part.maxScore) ? part.maxScore : group.items.reduce((sum, [, , max]) => sum + max, 0);
        const details = Array.isArray(part.detail) ? part.detail : [];
        const rows = group.items.map(([key, label, fallbackMax], index) => {
          const found = details.find((item) => item?.key === key) || details[index] || {};
          const max = Number.isFinite(found.max) ? found.max : fallbackMax;
          const points = Number.isFinite(found.points) ? found.points : 0;
          const lost = Math.max(0, max - points);
          const status = lost === 0 ? "未扣分" : `扣 ${lost} 分${points === 0 ? "（未完成或未得分）" : ""}`;
          const statusClass = lost === 0 ? "score-full" : points === 0 ? "score-zero" : "score-partial";
          return `<li class="score-breakdown-row"><span>${label}</span><strong>${points} / ${max}</strong><em class="${statusClass}">${status}</em></li>`;
        }).join("");
        return `<section class="score-breakdown-part"><div class="score-breakdown-heading"><strong>${group.title}</strong><span>${partScore} / ${partMax}</span></div><ul>${rows}</ul></section>`;
      }).join("")}</section>`;
    }
    function renderResult() {
      const panel = q("resultPanel"); if (!panel || !latestResult || !mayRevealCorrectness(presentation)) return;
      const label = latestResult.passed === true ? "已通過" : latestResult.passed === false ? "未通過" : "未能安全判斷合格狀態";
      panel.classList.remove("is-hidden");
      const explanation = scenario ? `<details><summary>物理解釋與各部分分數</summary><p>提交後才顯示的模擬設定：質量 ${scenario.massKg.toFixed(1)} kg；最大靜摩擦力約 ${scenario.staticLimitMeanN.toFixed(2)} N；平均滑動摩擦力約 ${scenario.kineticFrictionMeanN.toFixed(2)} N。</p></details>` : "<p>此頁只顯示可信的 Moodle 成績摘要；原始活動答案未被信任。</p>";
      const finishRetry = presentation === "submitted-committed" ? '<button type="button" data-action="retry-finish">重試完成提交</button>' : "";
      panel.innerHTML = `<h2>${scenario ? "本次提交結果" : "已完成的 Moodle 成績摘要"}</h2><p class="result-score">${latestResult.score == null ? "—" : `${latestResult.score} / ${latestResult.maxScore}`}</p><p class="${latestResult.passed ? "result-good" : "result-neutral"}">${label}</p><p class="result-neutral">以下列出每一部分邊度得分、邊度扣分；「未扣分」代表該小題已取得滿分。</p>${scoreBreakdownMarkup(latestResult, scenario)}<ul>${(latestResult.feedbackItems || []).map((item) => `<li>${item}</li>`).join("")}</ul>${explanation}${finishRetry}`;
    }
    function render() {
      if (typeof document === "undefined") return;
      updatePills();
      if (!state) { showPanel(null); renderResult(); }
      else {
        showPanel(presentation === "trusted-finished-review" || presentation.startsWith("submitted") ? "review" : state.phase); renderApparatus(); renderBalance();
        if (state.phase === "experiment" && experimentQuality) renderQuality();
        if (state.phase === "experiment" && state.trial && !experimentQuality) setText("experimentStatus", "B 記錄已保存，可以前往 Part C 分析這張 F拉–t 圖。");
        if (state.phase === "analysis") renderAnalysisTasks(); if (state.phase === "predict") renderPredictions(); if (state.phase === "review") renderReview(); renderResult();
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
      stopLoop(); cancelBalanceMotion(); recorder = null; previousFrameMs = null; dragging = null; breakawayAnnounced = false; predictionDraft = []; directExperimentState = null; experimentAppliedForceN = 0; experimentAutoKineticHold = false; experimentAutoHoldElapsedS = 0; experimentAccumulatorS = 0; experimentQuality = null; experimentTimedOut = false; balanceDirectState = null; balanceForceEndpointX = null; balanceOffscreen = false; balanceDrawingsSource = null; balanceDrawings = { applied: null, friction: null };
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
      if (action === "select-analysis-task") { focusNode(q(currentAnalysisKey() ? ANALYSIS_MARKER_META.find((marker) => marker.key === currentAnalysisKey())?.id : null)); return; }
      if (action === "select-prediction") { focusNode(q(`[data-prediction-index="${currentPredictionIndex()}"]`)?.querySelector("input,select")); return; }
      if (action === "save-zero-force") { focusNode(q("draw-applied")); return; }
      if (action === "save-static-force") { focusNode(q("balanceOrigin")); return; }
      if (action === "save-breakaway-answer") { focusNode(q("to-experiment")); return; }
      if (action === "save-analysis") { focusNode(q("analysisTasks")); return; }
      if (action === "advance-prediction") { focusNode(q(`[data-prediction-index="${currentPredictionIndex()}"]`)?.querySelector("select")); return; }
      if (action === "request-redo-experiment") focusNode(q("experimentOrigin") || q("startRecording"));
    }
    function validationMessage(action) {
      if (action === "save-zero-force") return "請先選擇 A1 的摩擦力類型、方向及大小。";
      if (action === "save-static-force") return "請先由物體中央畫出 A2 拉力；摩擦力可以畫出，亦可以不畫。";
      if (action === "save-breakaway-answer") return "請先完成試拉，然後填寫最大靜摩擦力估計。";
      if (action === "save-analysis") return "請先在圖上放好靜摩擦力、最大靜摩擦力及滑動摩擦力三個標記。";
      if (action === "save-prediction") return "請先在圖上畫出摩擦力（不畫代表零），再選擇摩擦力類型及運動結果。";
      if (action === "to-review") return "可以前往提交前檢查；提交後答案會鎖定。";
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
          else if (action === "select-analysis-task") { state = Persistence.transitions.selectAnalysisTask(state, event.target.closest("[data-analysis-key]")?.dataset.analysisKey); analysisDraft = null; saveDraft(); }
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
          else if (action === "save-analysis") { const draft = collectAnalysisDraft(); if (!commitAnalysisDraft(draft)) throw new Error("complete the active analysis task before saving"); saveDraft(); announce("三個 marker 已保存"); }
          else if (action === "to-predict") { if (!Persistence.hasAllAnalysisFields(state)) throw new Error("analysis incomplete"); state = Persistence.transitions.setPhase(state, "predict"); analysisDraft = null; saveDraft(); }
          else if (action === "save-prediction") {
            const card = event.target.closest("[data-prediction-index]"); const index = Number(card.dataset.predictionIndex); const values = {};
            card.querySelectorAll("[data-prediction-field]").forEach((input) => { values[input.dataset.predictionField] = input.dataset.predictionField === "magnitudeCN" ? (input.value === "" ? null : Number(input.value)) : input.value || null; });
            const magnitudeCN = values.magnitudeCN == null ? 0 : Math.round(Number(values.magnitudeCN));
            if (!values.frictionType || !values.motionOutcome) throw new Error("complete the drawn force type and motion result");
            if (values.frictionType === "none") {
              if (magnitudeCN !== 0) throw new Error("no-friction answer cannot contain an arrow");
              values.direction = "none";
            } else if (!Number.isInteger(magnitudeCN) || magnitudeCN <= 0 || !["left", "right"].includes(values.direction)) {
              throw new Error("draw a non-zero friction arrow and choose its type");
            }
            state = Persistence.transitions.setPrediction(state, index, { id: scenario.predictions[index].id, scenarioId: scenario.predictions[index].scenarioId, frictionType: values.frictionType, direction: values.direction, magnitudeCN, motionOutcome: values.motionOutcome, committed: true }); saveDraft();
          }
          else if (action === "advance-prediction") { state = Persistence.transitions.advancePrediction(state); saveDraft(); }
          else if (action === "to-review") navigateToPhase("review");
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
      }, { passive: true });
      q("controlPanel")?.addEventListener("touchmove", (event) => {
        if (panelTouchY == null || event.touches.length !== 1) return;
        const y = event.touches[0].clientY; panelTouchY = y;
        if (!panelTouchMoved && Math.abs(y - panelTouchStartY) < 2) return;
        panelTouchMoved = true;
        // Let the browser's native overflow scroller own the panel gesture.
        // In particular, do not write scrollTop or cancel touchmove here:
        // those two operations disable the release velocity that provides
        // normal touch momentum scrolling.
        // An iframe's native pan chain may otherwise move the Moodle host
        // when the panel is at an edge. Keep this gesture owned by the panel.
        if (panelHostScrollY != null) try { window.parent.scrollTo(0, panelHostScrollY); } catch {}
      }, { passive: true });
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
      document.addEventListener("input", (event) => { if (event.target.dataset?.predictionField) collectPredictionDraft(event.target.closest("[data-prediction-index]")); });
      document.addEventListener("change", (event) => { if (event.target.dataset?.predictionField) collectPredictionDraft(event.target.closest("[data-prediction-index]")); });
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
        const viewBox = svg.viewBox?.baseVal;
        const viewWidth = finite(viewBox?.width, 900) || 900;
        const viewHeight = finite(viewBox?.height, 430) || 430;
        return { x: (event.clientX - rect.left) * viewWidth / Math.max(1, rect.width), y: (event.clientY - rect.top) * viewHeight / Math.max(1, rect.height) };
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
    function predictionComPoint() {
      const block = q("apparatusSvg")?.querySelector(".apparatus-block");
      if (!block) return { x: 146, y: 273 };
      return { x: Number(block.getAttribute("x")) + Number(block.getAttribute("width")) / 2, y: Number(block.getAttribute("y")) + Number(block.getAttribute("height")) / 2 };
    }
    function setPredictionForceDraft(card, force) {
      if (!card || !state || !scenario) return;
      const index = Number(card.dataset.predictionIndex);
      if (!Number.isInteger(index)) return;
      const direction = force?.direction || "none";
      const magnitudeCN = force?.magnitudeCN || 0;
      const frictionType = card.querySelector("[data-prediction-field='frictionType']")?.value || null;
      const motionOutcome = card.querySelector("[data-prediction-field='motionOutcome']")?.value || null;
      const directionInput = card.querySelector("[data-prediction-field='direction']");
      const magnitudeInput = card.querySelector("[data-prediction-field='magnitudeCN']");
      if (directionInput) directionInput.value = direction;
      if (magnitudeInput) magnitudeInput.value = String(magnitudeCN);
      try {
        state = Persistence.transitions.setPrediction(state, index, { id: scenario.predictions[index].id, scenarioId: scenario.predictions[index].scenarioId, frictionType, direction, magnitudeCN, motionOutcome, committed: false });
        saveDraft();
      } catch {}
      const output = card.querySelector("[data-prediction-magnitude-readout]");
      if (output) output.textContent = magnitudeCN ? `${(magnitudeCN / 100).toFixed(2)} N` : "尚未畫出";
    }
    function updatePredictionForceFromPointer(event) {
      if (!dragging || dragging.kind !== "prediction-friction") return;
      const point = svgPointFromEvent(event);
      setPredictionForceDraft(dragging.card, forceFromPointer(dragging.originX, point.x));
      renderApparatus();
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
        if (state?.phase !== "experiment" || !recorder?.running || state.fromReview || experimentAutoKineticHold) return;
        const point = svgPointFromEvent(event);
        dragging = { kind: "experiment-pull", target: event.currentTarget, pointerId: event.pointerId, lastPointX: point.x };
        experimentAppliedForceN = 0;
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
      } else if (ANALYSIS_MARKER_META.some((marker) => marker.target === target) && state?.phase === "analysis" && state.trial) {
        const marker = ANALYSIS_MARKER_META.find((item) => item.target === target);
        dragging = {
          kind: "analysis-marker", target: event.currentTarget, pointerId: event.pointerId, markerKey: marker.key,
          checkpoint: clone(state), checkpointDraft: clone(analysisDraft),
          predictionMagnitudes: [...document.querySelectorAll("[data-prediction-field='magnitudeCN']")].map((input) => input.value)
        };
      } else if (target === "prediction-friction" && state?.phase === "predict") {
        const point = predictionComPoint();
        dragging = {
          kind: "prediction-friction", target: event.currentTarget, pointerId: event.pointerId,
          originX: point.x, originY: point.y, card: q(`#predictionCards [data-prediction-index="${currentPredictionIndex()}"]`),
          checkpoint: clone(state), checkpointDraft: clone(analysisDraft)
        };
      } else {
        dragging = { target: event.currentTarget, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, checkpoint: clone(state), checkpointDraft: clone(analysisDraft), predictionMagnitudes: [...document.querySelectorAll("[data-prediction-field='magnitudeCN']")].map((input) => input.value) };
      }
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    }
    function adjustDragTarget(target, direction, magnitude = 1) {
      if (target === "experiment-origin") {
        if (!recorder?.running || experimentAutoKineticHold) return;
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
      if (target === "prediction-friction") {
        const index = currentPredictionIndex(); const card = q(`#predictionCards [data-prediction-index="${index}"]`); if (!card) return;
        const directionInput = card.querySelector("[data-prediction-field='direction']"); const magnitudeInput = card.querySelector("[data-prediction-field='magnitudeCN']");
        const currentSignedN = (directionInput?.value === "left" ? -1 : directionInput?.value === "right" ? 1 : 0) * Number(magnitudeInput?.value || 0) / 100;
        const next = currentSignedN + direction * magnitude * .1;
        setPredictionForceDraft(card, forceFromPointer(0, next * 18)); renderApparatus(); return;
      }
      if (!state?.trial) return;
      ensureAnalysisDraft();
      const decoded = Measurement.unpackTrace(state.trial);
      const marker = ANALYSIS_MARKER_META.find((item) => item.target === target); if (!marker) return;
      analysisDraft[marker.key] ||= { index: 0, committed: false };
      analysisDraft[marker.key].index = clamp((analysisDraft[marker.key].index ?? 0) + direction * magnitude, 0, decoded.merged.length - 1);
      analysisDraft[marker.key].committed = false;
      renderGraph();
    }
    function moveDrag(event) {
      if (!dragging || dragging.target !== event.currentTarget || event.isPrimary === false) return;
      if (dragging.kind === "balance-draw") { updateBalanceDrawFromPointer(event); return; }
      if (dragging.kind === "prediction-friction") { updatePredictionForceFromPointer(event); return; }
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
      if (dragging.kind === "analysis-marker") {
        const decoded = Measurement.unpackTrace(state.trial);
        const marker = ANALYSIS_MARKER_META.find((item) => item.key === dragging.markerKey);
        const index = analysisIndexFromPointer(event, decoded);
        ensureAnalysisDraft();
        analysisDraft[marker.key] = { index, committed: false };
        renderGraph();
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
        if (!experimentAutoKineticHold) {
          experimentAppliedForceN = 0;
          resetExperimentHandleToRest();
        }
      }
      saveDraft(); render();
    }
    function cancelDrag() {
      if (!dragging) return;
      try { dragging.target.releasePointerCapture?.(dragging.pointerId); } catch {}
      if (dragging.kind === "experiment-pull") {
        if (!experimentAutoKineticHold) {
          experimentAppliedForceN = 0;
          resetExperimentHandleToRest();
        }
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
      if (!state || !Persistence.hasSubmittableAnswer(state) || typeof SimScorm === "undefined") return;
      const result = Scoring.scoreAnswer(state, scenario); const reviewState = Persistence.normalizeReview(state); const review = Persistence.encodeReview(reviewState); const reviewSnapshot = SimScorm.makeSnapshot(ACTIVITY, "review", review, result);
      const Flow = typeof SimActivityFlow !== "undefined" ? SimActivityFlow : null;
      const callbacks = {
        success: () => { latestResult = result; presentation = "submitted-success"; state = reviewState; render(); focusReviewSurface(); setText("submitStatus", "已提交並完成此活動。"); },
        committed: () => { latestResult = result; presentation = "submitted-committed"; state = reviewState; render(); focusReviewSurface(); setText("submitStatus", "資料已提交；活動已鎖定，完成程序可稍後重試。"); },
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
    const controllerApi = { activity: ACTIVITY, boot, getState: () => clone(state), getScenario: () => scenario, getPresentation: () => presentation, getResult: () => clone(latestResult), mayReveal: () => mayRevealCorrectness(presentation), interactionEvidence: () => ({ dragging: Boolean(dragging), recorderRunning: Boolean(recorder?.running), phase: state?.phase, experiment: directExperimentState ? { positionM: directExperimentState.block.positionM, velocityMps: directExperimentState.block.velocityMps, accelerationMps2: directExperimentState.block.accelerationMps2, appliedForceN: experimentAppliedForceN, measuredForceN: experimentVisibleForceN(), breakawayForceN: measurementState?.breakaway ? measurementState.breakaway.measuredPullCN / 100 : null, timeS: directExperimentState.timeS, timedOut: experimentTimedOut, contactMode: directExperimentState.contact?.mode, autoKineticHold: experimentAutoKineticHold } : null, balanceMotion: balanceDirectState ? { positionM: balanceDirectState.block.positionM, velocityMps: balanceDirectState.block.velocityMps, accelerationMps2: balanceDirectState.block.accelerationMps2, appliedForceN: balanceCurrentForceN(), offscreen: balanceOffscreen } : null }), render, routeAttempt: applyAttempt, routeStartup, routeSubmission, cancelDrag, hostSwipe };
    return controllerApi;
  }
  function boot() { if (dependencyIssue()) return createTechnicalApp(new Error("missing activity dependency")); return createController().boot(); }
  return Object.freeze({ ACTIVITY, PHASES, PHASE_LABELS, mayRevealCorrectness, buildEditableViewModel, buildResultViewModel, routeStartup, routeSubmission, simulateBalanceRig, localExtremaIndices, createTechnicalApp, createController, boot });
});
