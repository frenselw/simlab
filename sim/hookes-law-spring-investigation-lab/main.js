(function (root, factory) {
  const G = typeof module === "object" && module.exports ? require("./generator.js") : root.HookesLawGenerator;
  const M = typeof module === "object" && module.exports ? require("./model.js") : root.HookesLawModel;
  const A = typeof module === "object" && module.exports ? require("./animation.js") : root.HookesLawAnimation;
  const S = typeof module === "object" && module.exports ? require("./scoring.js") : root.HookesLawScoring;
  const P = typeof module === "object" && module.exports ? require("./persistence.js") : root.HookesLawPersistence;
  const api = factory(G, M, A, S, P);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HookesLawApp = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => { root.__hookesLawDebug = api.boot(); });
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model, Animation, Scoring, Persistence) {
  "use strict";

  const ACTIVITY = "hookes-law-spring-investigation-lab";
  const NS = "http://www.w3.org/2000/svg";
  const SPRINGS = ["A", "B"];
  const LOADS = ["F1", "F2", "F3"];
  const PHASE_LABELS = Object.freeze({ investigate: "探究與量度", model: "建立 F–x 模型", predict: "盲測預測", design: "盲測工程設計", review: "提交前 review" });
  const PHASE_PROGRESS = Object.freeze({ investigate: 0, model: 8, predict: 10, design: 13, review: 14 });
  const GRAPH = Object.freeze({ left: 122, top: 54, width: 585, height: 354, maxExtensionM: Generator.MAX_LINEAR_EXTENSION_M, maxForceN: 4.0 });
  const INVESTIGATION_DRAG_HANDLE_X = 650;

  function finite(value) { return Number.isFinite(value); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function freshSeed() {
    const buffer = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(buffer)[0];
    return (Date.now() ^ Math.floor((globalThis.performance?.now?.() || 0) * 1000)) >>> 0;
  }
  function cm(meters) { return finite(meters) ? `${(meters * 100).toFixed(1)} cm` : "--"; }
  function cmTick(meters) { return finite(meters) ? `${Math.round(meters * 100)} cm` : "--"; }
  function n(value, digits = 1) { return finite(value) ? Number(value).toFixed(digits) : "--"; }
  function forceLabel(key) { return ({ F1: "1.0 N", F2: "2.0 N", F3: "3.0 N" })[key] || "--"; }
  function springLabel(key) { return key === "A" ? "彈簧 A" : "彈簧 B"; }
  function operationMode(mode) { return mode === "keyboard" ? "keyboard" : "pointer"; }
  function mayRevealCorrectness(activityState) {
    return ["submitted-success", "submitted-committed", "trusted-finished-review"].includes(activityState);
  }

  function measuredRows(state, springKey) {
    const calibration = state?.calibrations?.[springKey];
    return LOADS.map((loadKey) => {
      const record = state?.measurements?.[springKey]?.[loadKey];
      return {
        loadKey,
        forceN: Scoring.forceByKey[loadKey],
        cursorM: record?.cursorM ?? null,
        extensionM: record && calibration ? Model.measuredExtensionM(calibration.zeroM, record.cursorM) : null
      };
    });
  }

  // This is deliberately a learner-only projection.  Do not add scenario.springs[*].kNPerM,
  // naturalLengthM, trueExtensionM, optimum or correctness flags here.
  function buildEditableViewModel(state, scenario) {
    return {
      phase: state.phase,
      activeSpring: state.activeSpring,
      activeLoadKey: state.activeLoadKey,
      activePredictionIndex: state.activePredictionIndex,
      calibrations: Object.fromEntries(SPRINGS.map((key) => [key, state.calibrations[key] ? { zeroM: state.calibrations[key].zeroM, mode: state.calibrations[key].mode } : null])),
      measurements: Object.fromEntries(SPRINGS.map((key) => [key, measuredRows(state, key)])),
      models: Object.fromEntries(SPRINGS.map((key) => {
        const handle = state.models[key]?.handleExtensionM ?? null;
        return [key, handle === null ? null : { handleExtensionM: handle, kModelNPerM: Model.kFromModelHandle(handle) }];
      })),
      predictions: (scenario?.predictions || []).map((spec, index) => ({
        id: spec.id,
        springKey: spec.springKey,
        forceN: spec.forceN,
        extensionM: state.predictions[index]?.extensionM ?? null
      })),
      design: state.design ? { springKey: state.design.springKey, moduleCount: state.design.moduleCount, forceN: state.design.moduleCount * scenario.design.moduleForceN } : null
    };
  }

  // This projection is only called after mayRevealCorrectness() is true.
  function buildResultViewModel(state, scenario, result) {
    const editable = buildEditableViewModel(state, scenario);
    return {
      ...editable,
      trueSprings: Object.fromEntries(SPRINGS.map((key) => [key, {
        kNPerM: scenario.springs[key].kNPerM,
        naturalLengthM: scenario.springs[key].naturalLengthM,
        measurements: LOADS.map((loadKey) => ({ loadKey, endpointM: Model.endpointM(scenario.springs[key].naturalLengthM, Scoring.forceByKey[loadKey], scenario.springs[key].kNPerM) }))
      }])),
      predictions: scenario.predictions.map((spec, index) => ({
        ...editable.predictions[index],
        actualExtensionM: spec.trueExtensionM,
        errorM: result?.breakdown?.predictions?.[index]?.errorM ?? null
      })),
      engineering: result?.breakdown?.engineering ? {
        ...result.breakdown.engineering,
        optimal: result.breakdown.engineering.optimal
      } : null,
      score: result?.score ?? null,
      passed: result?.passed ?? null
    };
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  }
  function clientToSvg(svg, clientX, clientY) {
    if (svg?.getScreenCTM && typeof DOMPoint !== "undefined") {
      const matrix = svg.getScreenCTM();
      if (matrix) {
        const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
        return { x: point.x, y: point.y };
      }
    }
    const rect = svg?.getBoundingClientRect?.() || { left: 0, top: 0, width: 800, height: 500 };
    return { x: (clientX - rect.left) * 800 / Math.max(1, rect.width), y: (clientY - rect.top) * 500 / Math.max(1, rect.height) };
  }
  function svgToClient(svg, x, y) {
    if (svg?.getScreenCTM && typeof DOMPoint !== "undefined") {
      const matrix = svg.getScreenCTM();
      if (matrix) {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      }
    }
    const rect = svg?.getBoundingClientRect?.() || { left: 0, top: 0, width: 800, height: 500 };
    return { x: rect.left + x * rect.width / 800, y: rect.top + y * rect.height / 500 };
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function appendGrid(parent, entries) {
    const fragment = document.createDocumentFragment();
    for (const [label, value] of entries) { fragment.append(element("span", label), element("strong", value)); }
    parent.append(fragment);
  }

  function routeStartup(attempt, flow) {
    return (flow || globalThis.SimActivityFlow)?.startup(attempt) || "load-error";
  }
  function routeSubmission(outcome, flow, handlers) {
    return (flow || globalThis.SimActivityFlow)?.submission(outcome, handlers || {}) || "retry";
  }

  function investigationEndpointM(state, spring, loadedPositionM) {
    return state?.activeLoadKey ? loadedPositionM : spring?.naturalLengthM;
  }

  function boot(options = {}) {
    if (typeof document === "undefined") return { activity: ACTIVITY, mode: "headless" };
    const host = typeof window !== "undefined" ? window : globalThis;
    const SimScorm = options.scorm || host.SimScorm;
    const SimActivityFlow = options.activityFlow || host.SimActivityFlow;
    const $ = (id) => document.getElementById(id);
    const dom = {
      app: $("app"), badge: $("phaseBadge"), progress: $("progress"), stage: $("stage"), svg: $("stageSvg"), dragLayer: $("dragLayer"),
      panel: $("controlPanel"), technical: $("technicalPanel"), technicalTitle: $("technicalTitle"), technicalMessage: $("technicalMessage"), technicalActions: $("technicalActions"),
      investigate: $("investigatePanel"), model: $("modelPanel"), predict: $("predictPanel"), design: $("designPanel"), review: $("reviewPanel"), result: $("resultPanel"), live: $("liveRegion"),
      calibrationInstruction: $("calibrationInstruction"), zeroReadout: $("zeroReadout"), recordCalibration: $("recordCalibration"), recalibrate: $("recalibrate"), calibrationStatus: $("calibrationStatus"),
      loadCards: $("loadCards"), attachLoad: $("attachLoad"), loadStatus: $("loadStatus"), cursorReadout: $("cursorReadout"), recordMeasurement: $("recordMeasurement"), measurementStatus: $("measurementStatus"), dataTable: $("dataTable"), toModel: $("toModel"),
      modelData: $("modelData"), modelReadout: $("modelReadout"), modelStatus: $("modelStatus"), toPredict: $("toPredict"),
      predictionCards: $("predictionCards"), predictionStatus: $("predictionStatus"), toDesign: $("toDesign"),
      designLimit: $("designLimit"), moduleCount: $("moduleCount"), designSummary: $("designSummary"), toReview: $("toReview"),
      reviewSummary: $("reviewSummary"), submit: $("submit"), submitStatus: $("submitStatus"),
      zeroDrag: $("zeroDrag"), cursorDrag: $("cursorDrag"), modelDrag: $("modelDrag"), predictionDrag: $("predictionDrag"), dialog: $("recalibrationDialog"), confirmRecalibration: $("confirmRecalibration")
    };
    const dragTargets = { zero: dom.zeroDrag, cursor: dom.cursorDrag, model: dom.modelDrag, prediction: dom.predictionDrag };
    let state = null;
    let scenario = null;
    let locked = false;
    let presentation = "editable";
    let latestResult = null;
    let latestReviewSnapshot = null;
    let pendingExpected = null;
    let lastDraftState = null;
    let selectedLoadKey = "F1";
    let visualPositionM = 0.09;
    let stable = true;
    let modelDraftM = 0.08;
    let predictionDraftM = 0.06;
    let zeroMoveM = 0;
    let cursorMoveM = 0;
    let modelMoveM = 0;
    let predictionMoveM = 0;
    let zeroMode = "pointer";
    let cursorMode = "pointer";
    let modelMode = "pointer";
    let predictionMode = "pointer";
    let drag = null;
    let hostSwipe = null;
    let animator = null;
    let animationFallback = null;
    let animationToken = 0;
    let submitMessage = "";

    function scenarioFor(answer) {
      return Generator.generateScenario({ seed: answer.seed, generatorVersion: answer.generatorVersion });
    }
    function ensureServices() {
      if (!SimScorm || !SimActivityFlow) throw new Error("Shared SCORM runtime unavailable");
    }
    function setText(node, value) { if (node) node.textContent = value == null ? "" : String(value); }
    function announce(message) {
      if (!dom.live) return;
      dom.live.textContent = "";
      (host.requestAnimationFrame || ((callback) => setTimeout(callback, 0)))(() => { dom.live.textContent = message; });
    }
    function validCurrent(kind = state?.phase === "review" ? "review" : "draft") {
      return Boolean(state && scenario && Persistence.validateAnswer(state, scenario, { kind }).ok);
    }
    function draftEnvelope(answerState = state) {
      const answer = Persistence.answerForSnapshot(answerState, "draft", scenarioFor(answerState));
      return SimScorm.makeSnapshot(ACTIVITY, "draft", answer);
    }
    function registerDraftProvider() {
      if (!SimScorm?.setDraftProvider) return;
      SimScorm.setDraftProvider(() => {
        const source = state?.phase === "review" ? lastDraftState : state;
        if (!source) throw new Error("No editable draft state");
        return draftEnvelope(source);
      });
    }
    function checkpoint(message) {
      if (locked || !state || state.phase === "review") return true;
      if (!validCurrent("draft")) { technicalLock("目前狀態未能通過保存前驗證；操作已鎖定，沒有把資料改成另一份答案。"); return false; }
      try {
        lastDraftState = Persistence.clone(state);
        const ok = SimScorm.saveDraft(draftEnvelope(lastDraftState));
        if (!ok) { technicalLock("Moodle 沒有確認草稿保存；操作已鎖定，不能聲稱資料已保存。"); return false; }
        if (message) announce(message);
        return true;
      } catch (error) {
        technicalLock("草稿資料未能安全編碼；操作已鎖定。" );
        return false;
      }
    }
    function syncRuntime() {
      if (!state || !scenario) return;
      const calibration = state.calibrations[state.activeSpring];
      const defaultZero = calibration?.zeroM ?? state.working.zeroDraftM ?? 0.09;
      if (state.phase === "investigate") {
        if (!calibration) {
          if (!finite(state.working.zeroDraftM)) state.working.zeroDraftM = defaultZero;
        }
        modelDraftM = state.models[state.activeSpring]?.handleExtensionM ?? modelDraftM;
        const prediction = state.predictions[state.activePredictionIndex];
        predictionDraftM = prediction?.extensionM ?? predictionDraftM;
        if (state.activeLoadKey && calibration) {
          if (state.working.cursorDraftM === null) state.working.cursorDraftM = calibration.zeroM;
          visualPositionM = endpointFor(state.activeSpring, state.activeLoadKey);
        }
        else visualPositionM = state.working.zeroDraftM ?? defaultZero;
      } else if (state.phase === "model") {
        modelDraftM = state.models[state.activeSpring]?.handleExtensionM ?? 0.08;
      } else if (state.phase === "predict") {
        predictionDraftM = state.predictions[state.activePredictionIndex]?.extensionM ?? 0.06;
      }
      selectedLoadKey = state.activeLoadKey || selectedLoadKey || "F1";
    }
    function endpointFor(springKey, loadKey) {
      const spring = scenario?.springs?.[springKey];
      const forceN = Scoring.forceByKey[loadKey];
      return spring ? Model.endpointM(spring.naturalLengthM, forceN, spring.kNPerM) : 0.09;
    }
    function setState(next, message, shouldCheckpoint = true) {
      if (!next || !scenario) return false;
      const nextScenario = scenarioFor(next);
      const kind = next.phase === "review" ? "review" : "draft";
      if (!Persistence.validateAnswer(next, nextScenario, { kind }).ok) return false;
      state = next;
      scenario = nextScenario;
      syncRuntime();
      render();
      if (shouldCheckpoint && state.phase !== "review" && !checkpoint()) return false;
      if (message) announce(message);
      return true;
    }
    function mutateTransient(mutator, message, shouldCheckpoint = true) {
      if (!state || locked) return false;
      const next = Persistence.clone(state);
      mutator(next);
      return setState(next, message, shouldCheckpoint);
    }
    function activeSelection(nextSpring, message) {
      return mutateTransient((next) => {
        next.activeSpring = nextSpring;
        next.activeLoadKey = null;
        next.activePredictionIndex = next.phase === "predict" ? next.activePredictionIndex : 0;
        next.working.cursorDraftM = next.phase === "investigate" ? next.calibrations[nextSpring]?.zeroM ?? null : null;
      }, message);
    }
    function selectLoad(loadKey) {
      if (locked || !LOADS.includes(loadKey) || !state.calibrations[state.activeSpring]) return;
      selectedLoadKey = loadKey;
      document.querySelectorAll("[data-action='select-load']").forEach((button) => button.dataset.selected = String(button.dataset.load === loadKey));
      setText(dom.loadStatus, `${forceLabel(loadKey)} 已選取；按「掛上所選負載」開始觀察。`);
      renderStage();
    }
    function attachLoad() {
      if (locked || state.phase !== "investigate" || !state.calibrations[state.activeSpring] || !LOADS.includes(selectedLoadKey)) return;
      stopAnimation();
      const next = Persistence.clone(state);
      next.activeLoadKey = selectedLoadKey;
      next.working.cursorDraftM = next.calibrations[next.activeSpring].zeroM;
      if (!Persistence.validateAnswer(next, scenario, { kind: "draft" }).ok) return;
      state = next;
      cursorMoveM = 0;
      cursorMode = "pointer";
      visualPositionM = state.calibrations[state.activeSpring].zeroM;
      stable = false;
      render();
      animateTo(endpointFor(state.activeSpring, selectedLoadKey));
      announce(`${springLabel(state.activeSpring)} 已掛上 ${forceLabel(selectedLoadKey)}；等待彈簧穩定。`);
    }
    function animateTo(targetM) {
      const token = ++animationToken;
      stable = false;
      if (animator) animator.cancel();
      if (animationFallback !== null) {
        (host.clearTimeout || clearTimeout)(animationFallback);
        animationFallback = null;
      }
      animator = Animation.createAnimator({
        requestFrame: host.requestAnimationFrame?.bind(host) || ((callback) => setTimeout(() => callback(Date.now()), 16)),
        cancelFrame: host.cancelAnimationFrame?.bind(host) || clearTimeout,
        reducedMotion: () => Boolean(host.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
        onFrame: () => {},
        now: () => host.performance?.now?.() || Date.now()
      });
      animator.start({
        from: visualPositionM,
        equilibrium: targetM,
        onFrame: (position) => { if (token !== animationToken) return; visualPositionM = position; renderStage(); },
        onSettled: () => settleAnimation(targetM, token)
      });
      if (!stable) {
        animationFallback = (host.setTimeout || setTimeout)(() => {
          animationFallback = null;
          if (token !== animationToken) return;
          animator?.cancel();
          settleAnimation(targetM, token);
        }, 2000);
      }
    }
    function settleAnimation(targetM, token) {
      if (token !== animationToken) return;
      if (animationFallback !== null) {
        (host.clearTimeout || clearTimeout)(animationFallback);
        animationFallback = null;
      }
      visualPositionM = targetM;
      stable = true;
      const calibration = state?.calibrations?.[state.activeSpring];
      if (state?.phase === "investigate" && calibration) {
        state.working.cursorDraftM = calibration.zeroM;
        cursorMoveM = 0;
      }
      render();
      announce("彈簧已穩定；可移動量度游標，再記錄你的讀數。");
    }
    function stopAnimation() {
      animationToken += 1;
      if (animator) animator.cancel();
      animator = null;
      if (animationFallback !== null) {
        (host.clearTimeout || clearTimeout)(animationFallback);
        animationFallback = null;
      }
      if (state?.phase === "investigate" && state.activeLoadKey) visualPositionM = endpointFor(state.activeSpring, state.activeLoadKey);
      stable = true;
    }
    function recordCalibration() {
      if (locked || state.phase !== "investigate" || state.activeLoadKey || state.calibrations[state.activeSpring] || zeroMoveM < Model.MIN_OPERATION_MOVE_M) return;
      const evidence = { zeroM: state.working.zeroDraftM, mode: operationMode(zeroMode), moveM: zeroMoveM };
      const next = Persistence.transitions.replaceCalibration(state, state.activeSpring, evidence, scenario);
      zeroMoveM = 0;
      cursorMoveM = 0;
      setState(next, `已記錄${springLabel(state.activeSpring)}的自然長度位置。`);
    }
    function recordMeasurement() {
      if (locked || state.phase !== "investigate" || !state.activeLoadKey || !stable || cursorMoveM < Model.MIN_OPERATION_MOVE_M) return;
      const evidence = { loadKey: state.activeLoadKey, cursorM: state.working.cursorDraftM, mode: operationMode(cursorMode), moveM: cursorMoveM };
      const next = Persistence.transitions.replaceMeasurement(state, state.activeSpring, state.activeLoadKey, evidence, scenario);
      const label = `${springLabel(state.activeSpring)}在 ${forceLabel(state.activeLoadKey)} 下的量度`;
      cursorMoveM = 0;
      setState(next, `已記錄${label}。`);
    }
    function beginModelSpring(key) {
      if (!SPRINGS.includes(key) || state.phase !== "model") return;
      modelMoveM = 0;
      modelMode = "pointer";
      modelDraftM = state.models[key]?.handleExtensionM ?? 0.08;
      activeSelection(key, `現在編輯${springLabel(key)}的模型。`);
    }
    function recordModel() {
      if (locked || state.phase !== "model" || modelMoveM < Model.MIN_OPERATION_MOVE_M) return;
      const next = Persistence.transitions.replaceModel(state, state.activeSpring, modelDraftM, scenario);
      modelMoveM = 0;
      setState(next, `已記錄${springLabel(state.activeSpring)}的模型控制點。`);
    }
    function choosePrediction(index) {
      if (locked || state.phase !== "predict" || !Number.isInteger(index) || index < 0 || index > 2) return;
      const next = Persistence.clone(state);
      next.activePredictionIndex = index;
      next.activeLoadKey = null;
      if (!Persistence.validateAnswer(next, scenario, { kind: "draft" }).ok) return;
      state = next;
      predictionDraftM = state.predictions[index]?.extensionM ?? 0.06;
      predictionMoveM = 0;
      render();
      checkpoint(`已選擇預測 ${index + 1}；尚未顯示任何正確性回饋。`);
      announce(`現在編輯預測 ${index + 1}。`);
    }
    function recordPrediction() {
      if (locked || state.phase !== "predict" || predictionMoveM < Model.MIN_OPERATION_MOVE_M) return;
      const index = state.activePredictionIndex;
      const next = Persistence.transitions.replacePrediction(state, index, predictionDraftM, scenario);
      predictionMoveM = 0;
      setState(next, `已記錄預測 ${index + 1}。`);
    }
    function changeDesign(springKey, moduleCount) {
      if (locked || state.phase !== "design" || !SPRINGS.includes(springKey) || !Number.isInteger(moduleCount)) return;
      const next = Persistence.transitions.replaceDesign(state, springKey, moduleCount, scenario);
      setState(next, `已保存${springLabel(springKey)}、${moduleCount} 個負載模組的工程方案。`);
    }
    function goPhase(phase) {
      if (locked || !state) return;
      if (phase === "model" && !Persistence.hasAllCalibrationsAndMeasurements(state)) return announce("兩條彈簧各三項量度完成後，才可建立模型。");
      if (phase === "predict" && !Persistence.hasAllModels(state)) return announce("兩條模型都有值後，才可進行盲測預測。");
      if (phase === "design" && (!Persistence.hasAllModels(state) || !Persistence.hasAllPredictions(state))) return announce("三項預測完成後，才可進行工程設計。");
      if (phase === "review") {
        if (!Persistence.hasCompleteAnswer(state, scenario)) return announce("請先完成所有量度、模型、預測及工程方案。");
        if (!checkpoint()) return;
      }
      try {
        const next = Persistence.transitions.setPhase(state, phase, scenario);
        setState(next, phase === "review" ? "已進入提交前 review；這裡只顯示你的答案及完成度。" : `已進入${PHASE_LABELS[phase]}。`, false);
      } catch { announce("目前依賴資料未符合這項 phase 的要求。"); }
    }
    function editSection(phase) {
      if (locked || state.phase !== "review") return;
      try {
        const next = Persistence.transitions.editSection(state, phase, scenario);
        lastDraftState = Persistence.clone(next);
        registerDraftProvider();
        setState(next, `已返回${PHASE_LABELS[phase]}；不改動答案即可返回 review。`, true);
      } catch { announce("目前不能返回這個 section。"); }
    }
    function requestRecalibration() {
      if (locked || !state.calibrations[state.activeSpring]) return;
      if (dom.dialog?.showModal) dom.dialog.showModal();
      else if (host.confirm?.("重新標定會清除這條彈簧已記錄的量度、模型及所有依賴模型的預測／工程方案。")) confirmRecalibration();
    }
    function confirmRecalibration() {
      if (dom.dialog?.open) dom.dialog.close("confirm");
      try {
        const next = Persistence.transitions.clearCalibration(state, state.activeSpring, scenario);
        zeroMoveM = 0;
        cursorMoveM = 0;
        stopAnimation();
        setState(next, `已清除${springLabel(state.activeSpring)}的依賴資料；請重新標定。`);
      } catch { technicalLock("重新標定未能安全完成；操作已鎖定。"); }
    }
    function toReviewEditOrNext() {
      if (state.phase === "investigate") return goPhase("model");
      if (state.phase === "model") return goPhase("predict");
      if (state.phase === "predict") return goPhase("design");
      if (state.phase === "design") return goPhase("review");
    }
    function submit() {
      if (locked || state.phase !== "review" || !Persistence.hasCompleteAnswer(state, scenario)) return;
      try {
        latestResult = Scoring.scoreAnswer(state, scenario);
        latestReviewSnapshot = SimScorm.makeSnapshot(ACTIVITY, "review", Persistence.answerForSnapshot(state, "review", scenario), latestResult);
        pendingExpected = { reviewJson: JSON.stringify(latestReviewSnapshot), score: latestResult.score, maxScore: latestResult.maxScore, passed: latestResult.passed };
      } catch { return technicalLock("提交前的權威答案未能安全編碼；沒有送出未確認的資料。"); }
      locked = true;
      presentation = "submitting";
      SimScorm.setDraftProvider(null);
      renderReview("提交中；請勿離開這個視窗。", false);
      try {
        SimScorm.submitWithCallbacks(latestResult, latestReviewSnapshot, { onSuccess: routeSubmissionOutcome, onFailure: routeSubmissionOutcome });
      } catch { technicalLock("提交呼叫未能完成；結果未確認。"); }
    }
    function routeSubmissionOutcome(outcome) {
      routeSubmission(outcome, SimActivityFlow, {
        success: () => { presentation = "submitted-success"; locked = true; renderResult(); },
        committed: () => { presentation = "submitted-committed"; locked = true; renderResult("Moodle 已寫入結果；完成連線仍可重試。"); },
        frozen: () => { presentation = "frozen"; locked = true; latestResult = null; renderFrozen("提交仍待 Moodle 確認；答案已凍結，沒有顯示分數或正確性。"); },
        retry: () => {
          if (outcome?.retryable) {
            locked = false;
            presentation = "editable";
            submitMessage = "提交尚未建立已確認的 final state；答案仍可安全保留並重試。";
            registerDraftProvider();
            render();
            announce(submitMessage);
          } else technicalLock("提交失敗，且系統不能承諾可安全重試；沒有顯示提交、分數或合格結論。");
        }
      });
    }
    function finishCommitted() {
      if (presentation !== "submitted-committed") return;
      const ok = SimScorm.finish();
      if (ok) { presentation = "submitted-success"; renderResult("結果已提交並完成 Moodle 連線。"); }
      else announce("Moodle 尚未確認完成連線；可稍後再按一次。 ");
    }
    function verifyPendingOutcome(outcome) {
      if (!outcome || (!outcome.ok && !outcome.committed)) return true;
      const review = outcome.review;
      return Boolean(pendingExpected && review && JSON.stringify(review) === pendingExpected.reviewJson && outcome.score === pendingExpected.score && outcome.status === (pendingExpected.passed ? "passed" : "failed"));
    }
    function retryPending() {
      if (presentation === "submitted-committed") return finishCommitted();
      let outcome;
      try { outcome = SimScorm.retryPending(); } catch { return technicalLock("重試呼叫未能完成；提交狀態未確認。"); }
      if ((outcome?.ok || outcome?.committed) && !verifyPendingOutcome(outcome)) {
        SimScorm.quarantinePending();
        return technicalLock("重試回傳資料與原有凍結提交不一致；已停止繼續處理。");
      }
      if (outcome?.ok || outcome?.committed) {
        latestResult = Scoring.scoreAnswer(state, scenario);
        routeSubmissionOutcome({ ...outcome, activityState: outcome.ok ? "success" : "committed" });
      } else routeSubmissionOutcome({ ...outcome, activityState: outcome?.frozen ? "frozen" : "retry" });
    }
    function technicalLock(message) {
      stopAnimation();
      locked = true;
      presentation = "technical";
      renderTechnical(message);
      announce(message);
    }
    function renderTechnical(message, title = "活動暫時鎖定", retry = false) {
      hidePanels();
      dom.technical.classList.remove("is-hidden");
      setText(dom.technicalTitle, title);
      setText(dom.technicalMessage, message);
      dom.technicalMessage.dataset.kind = "technical";
      dom.technicalActions.replaceChildren();
      if (retry) {
        const button = element("button", "重試同一份待確認提交", "primary-button retry-button");
        button.type = "button";
        button.dataset.action = "retry-pending";
        dom.technicalActions.append(button);
      }
      renderStage();
    }
    function renderFrozen(message) {
      renderTechnical(message, "提交狀態未確認", true);
    }
    function renderFallback(attempt, message) {
      stopAnimation();
      locked = true;
      presentation = "fallback";
      hidePanels();
      dom.result.classList.remove("is-hidden");
      const section = element("section", undefined, "result-block");
      section.append(element("h2", "已完成的 Moodle attempt"), element("p", message));
      const summary = element("p", `Moodle 已記錄分數：${String(attempt.score ?? "未提供")}；狀態：${attempt.status === "passed" ? "passed" : attempt.status === "failed" ? "failed" : "未提供"}。`);
      section.append(summary, element("p", "詳細活動答案未能安全驗證，因此不顯示活動重算結果。"));
      dom.result.append(section);
      renderStage();
    }
    function hidePanels() {
      [dom.technical, dom.investigate, dom.model, dom.predict, dom.design, dom.review, dom.result].forEach((node) => node?.classList.add("is-hidden"));
    }
    function render() {
      if (presentation === "technical" || presentation === "frozen") return renderTechnical(dom.technicalMessage.textContent, presentation === "frozen" ? "提交狀態未確認" : "活動暫時鎖定", presentation === "frozen");
      if (presentation === "fallback") return;
      if (mayRevealCorrectness(presentation)) return renderResult();
      hidePanels();
      if (!state) return renderTechnical("沒有可用的活動狀態。");
      const panel = { investigate: dom.investigate, model: dom.model, predict: dom.predict, design: dom.design, review: dom.review }[state.phase];
      panel?.classList.remove("is-hidden");
      dom.progress.max = 14;
      dom.progress.value = completionCount();
      dom.badge.textContent = PHASE_LABELS[state.phase] || state.phase;
      renderInvestigate();
      renderModel();
      renderPredict();
      renderDesign();
      renderReview();
      renderStage();
    }
    function completionCount() {
      if (!state) return 0;
      return (SPRINGS.filter((key) => state.calibrations[key]).length) + SPRINGS.reduce((sum, key) => sum + LOADS.filter((loadKey) => state.measurements[key][loadKey]).length, 0) + SPRINGS.filter((key) => state.models[key]).length + state.predictions.filter(Boolean).length + (state.design ? 1 : 0);
    }
    function renderInvestigate() {
      const key = state?.activeSpring || "A";
      const calibration = state?.calibrations?.[key];
      const active = state?.activeLoadKey;
      setText(dom.calibrationInstruction, calibration ? "自然長度位置已保存；如需重做，請先確認清除這條彈簧及其依賴資料。" : "在沒有額外負載時，拖動紫色零位標記到彈簧末端，再記錄位置。");
      setText(dom.zeroReadout, `位置 ${cm(state?.working?.zeroDraftM)}`);
      dom.recordCalibration.disabled = Boolean(locked || calibration || active || zeroMoveM < Model.MIN_OPERATION_MOVE_M);
      dom.recalibrate.disabled = Boolean(locked || !calibration);
      setText(dom.calibrationStatus, calibration ? `已記錄${springLabel(key)}的自然長度位置。` : "尚未記錄；系統只保存你按下記錄時的游標位置。");
      document.querySelectorAll("[data-action='spring-tab']").forEach((button) => { button.setAttribute("aria-selected", String(button.dataset.spring === key)); button.disabled = locked; });
      document.querySelectorAll("[data-action='select-load']").forEach((button) => { button.dataset.selected = String(button.dataset.load === selectedLoadKey); button.disabled = locked || !calibration; });
      dom.attachLoad.disabled = Boolean(locked || !calibration || !LOADS.includes(selectedLoadKey) || !stable);
      setText(dom.loadStatus, active ? `目前觀察負載：${forceLabel(active)}${stable ? "；彈簧已穩定。" : "；等待穩定。"}` : "尚未掛上負載。");
      const extensionM = calibration && state?.working?.cursorDraftM !== null ? Model.measuredExtensionM(calibration.zeroM, state.working.cursorDraftM) : null;
      setText(dom.cursorReadout, active && stable ? `伸長量 ${cm(extensionM)}` : active ? "等待彈簧穩定" : "--");
      dom.recordMeasurement.disabled = Boolean(locked || !active || !stable || cursorMoveM < Model.MIN_OPERATION_MOVE_M);
      setText(dom.measurementStatus, active && stable ? "讀數只代表你目前的游標位置；完成移動後可記錄。" : "掛上負載並等待穩定後，才可量度。");
      renderDataTables();
      dom.toModel.disabled = Boolean(locked || !Persistence.hasAllCalibrationsAndMeasurements(state));
    }
    function renderDataTables() {
      dom.dataTable.replaceChildren();
      for (const key of SPRINGS) {
        const table = element("table", undefined, "data-table math-context");
        const caption = element("caption", `${springLabel(key)}：學生量得的 F–x 數據`);
        const head = element("thead");
        const headRow = element("tr");
        headRow.append(element("th", "F / N"), element("th", "學生伸長 / cm"));
        head.append(headRow);
        const body = element("tbody");
        for (const row of measuredRows(state, key)) {
          const tr = element("tr");
          tr.append(element("td", forceLabel(row.loadKey)), element("td", row.extensionM === null ? "未記錄" : cm(row.extensionM)));
          tr.lastChild.dataset.recorded = String(row.extensionM !== null);
          body.append(tr);
        }
        table.append(caption, head, body);
        dom.dataTable.append(table);
      }
    }
    function renderModel() {
      if (!state || state.phase !== "model") return;
      const key = state.activeSpring;
      document.querySelectorAll("[data-action='model-spring-tab']").forEach((button) => { button.setAttribute("aria-selected", String(button.dataset.spring === key)); button.disabled = locked; });
      dom.modelData.replaceChildren();
      const list = element("ul");
      for (const row of measuredRows(state, key)) list.append(element("li", `${forceLabel(row.loadKey)}：${row.extensionM === null ? "未記錄" : cm(row.extensionM)}`));
      dom.modelData.append(element("p", "這些是你自己記錄的三個數據點。模型線及 k 由你的控制點產生。"), list);
      setText(dom.modelReadout, `模型伸長 ${cm(modelDraftM)}；k = ${n(Model.kFromModelHandle(modelDraftM), 1)} N/m`);
      setText(dom.modelStatus, state.models[key] ? `已保存${springLabel(key)}模型；可拖動控制點重新設定。` : "尚未保存這條彈簧的模型控制點。");
      dom.toPredict.disabled = Boolean(locked || !Persistence.hasAllModels(state));
    }
    function renderPredict() {
      if (!state || state.phase !== "predict") return;
      dom.predictionCards.replaceChildren();
      scenario.predictions.forEach((spec, index) => {
        const card = element("article", undefined, "prediction-card math-context");
        card.dataset.selected = String(index === state.activePredictionIndex);
        const button = element("button", `編輯 ${index + 1}`);
        button.type = "button"; button.dataset.action = "prediction-select"; button.dataset.index = String(index); button.setAttribute("aria-pressed", String(index === state.activePredictionIndex)); button.disabled = locked;
        const copy = element("div"); copy.append(element("strong", `預測 ${index + 1}：${springLabel(spec.springKey)}、${n(spec.forceN, 1)} N`), element("span", state.predictions[index] ? `你的伸長：${cm(state.predictions[index].extensionM)}` : "尚未填寫"));
        card.append(button, copy, element("span", index === state.activePredictionIndex ? "目前編輯" : ""));
        dom.predictionCards.append(card);
      });
      setText(dom.predictionStatus, `${state.predictions.filter(Boolean).length}/3 項預測已填寫；這裡不會顯示實際測試結果。`);
      dom.toDesign.disabled = Boolean(locked || !Persistence.hasAllPredictions(state));
    }
    function renderDesign() {
      if (!state || state.phase !== "design") return;
      setText(dom.designLimit, cm(scenario.design.limitM));
      const spring = state.design?.springKey || "";
      document.querySelectorAll("[data-action='design-spring']").forEach((input) => { input.checked = input.value === spring; input.disabled = locked; });
      setText(dom.moduleCount, state.design?.moduleCount ?? "--");
      const count = state.design?.moduleCount || 1;
      document.querySelectorAll("[data-action='module-minus']").forEach((button) => button.disabled = locked || !state.design || count <= 1);
      document.querySelectorAll("[data-action='module-plus']").forEach((button) => button.disabled = locked || !state.design || count >= scenario.design.maxModuleCount);
      dom.toReview.disabled = Boolean(locked || !state.design);
      dom.designSummary.replaceChildren();
      if (state.design) appendGrid(dom.designSummary, [["彈簧", springLabel(state.design.springKey)], ["負載模組", String(state.design.moduleCount)], ["總負載", `${n(state.design.moduleCount * scenario.design.moduleForceN, 1)} N`]]);
      else dom.designSummary.append(element("p", "尚未選擇完整方案；提交前只顯示自己的選擇及題目限制。"));
    }
    function renderReview(notice = submitMessage, submitting = false) {
      if (!state || state.phase !== "review") return;
      dom.reviewSummary.replaceChildren();
      const required = Persistence.hasCompleteAnswer(state, scenario);
      if (notice) dom.reviewSummary.append(element("p", notice, "neutral-status"));
      const editable = buildEditableViewModel(state, scenario);
      const sections = [
        ["量度", `${SPRINGS.map((key) => `${springLabel(key)}零位 ${cm(editable.calibrations[key]?.zeroM)}`).join("；")}；六項量度已保存：${completionCount() >= 8 ? "是" : "否"}`],
        ["模型", SPRINGS.map((key) => `${springLabel(key)} ${editable.models[key] ? `k = ${n(editable.models[key].kModelNPerM, 1)} N/m` : "未完成"}`).join("；")],
        ["預測", editable.predictions.map((prediction, index) => `預測 ${index + 1}：${prediction.extensionM === null ? "未填寫" : cm(prediction.extensionM)}`).join("；")],
        ["工程方案", editable.design ? `${springLabel(editable.design.springKey)}；${editable.design.moduleCount} 個模組；${n(editable.design.forceN, 1)} N` : "未完成"]
      ];
      for (const [title, text] of sections) { const section = element("section"); section.append(element("h3", title), element("p", text)); dom.reviewSummary.append(section); }
      document.querySelectorAll("[data-action='edit-section']").forEach((button) => { button.disabled = locked || submitting; });
      dom.submit.disabled = Boolean(locked || submitting || !required);
      setText(dom.submitStatus, submitting ? "提交呼叫進行中；未顯示結果。" : required ? "所有必要答案及依賴資料已具備，可以一次提交。" : "仍有未完成的必要答案。 ");
    }
    function renderResult(message = "") {
      if (!latestResult || !state || !scenario || !mayRevealCorrectness(presentation)) return renderTechnical("結果未能安全驗證；沒有顯示推測分數或正確性。 ");
      hidePanels();
      dom.result.classList.remove("is-hidden");
      dom.progress.max = 14; dom.progress.value = 14; dom.badge.textContent = "已鎖定的結果";
      const view = buildResultViewModel(state, scenario, latestResult);
      dom.result.replaceChildren();
      const scoreBlock = element("section", undefined, "result-block result-score");
      scoreBlock.append(element("strong", `${latestResult.score} / ${latestResult.maxScore}`), element("span", SimActivityFlow.completionLabel(latestResult.passed)));
      dom.result.append(scoreBlock);
      if (message) dom.result.append(element("p", message, "neutral-status"));
      const totals = element("section", undefined, "result-block");
      totals.append(element("h2", "分項結果"));
      const grid = element("div", undefined, "result-grid");
      appendGrid(grid, [["探究與量度", `${latestResult.breakdown.experimentScore} / 20`], ["模型", `${latestResult.breakdown.modelScore} / 20`], ["盲測預測", `${latestResult.breakdown.predictionScore} / 36`], ["工程設計", `${latestResult.breakdown.engineeringScore} / 24`]]);
      totals.append(grid); dom.result.append(totals);
      const evidence = element("section", undefined, "result-block"); evidence.append(element("h2", "物理證據與回饋"));
      const list = element("ul", undefined, "feedback-list"); latestResult.feedbackItems.forEach((item) => list.append(element("li", item))); evidence.append(list); dom.result.append(evidence);
      const reveal = element("section", undefined, "result-block"); reveal.append(element("h2", "提交後的實際測試"));
      const rows = element("div", undefined, "result-grid");
      for (const key of SPRINGS) rows.append(element("span", `${springLabel(key)} 理想 k`), element("strong", `${n(view.trueSprings[key].kNPerM, 1)} N/m`));
      view.predictions.forEach((prediction, index) => rows.append(element("span", `預測 ${index + 1} 實際伸長`), element("strong", cm(prediction.actualExtensionM))));
      if (view.engineering) {
        rows.append(element("span", "工程方案實際伸長"), element("strong", cm(view.engineering.extensionM)), element("span", "最大安全方案"), element("strong", view.engineering.optimal ? `${springLabel(view.engineering.optimal.springKey)}、${view.engineering.optimal.moduleCount} 個模組` : "--"));
      }
      reveal.append(rows); dom.result.append(reveal);
      if (presentation === "submitted-committed") {
        const button = element("button", "重試完成 Moodle 連線", "primary-button retry-button"); button.type = "button"; button.dataset.action = "finish"; dom.result.append(button);
      }
      renderStage();
    }
    function positionToY(positionM) { return 54 + clamp(positionM, 0, Generator.STAGE_SPAN_M) / Generator.STAGE_SPAN_M * 382; }
    function graphPoint(extensionM, forceN) { return Model.graphPointFromPhysics(extensionM, forceN, GRAPH); }
    function drawText(x, y, text, attributes = {}) { return svgElement("text", { x, y, "font-size": 14, fill: "#334155", ...attributes }); }
    function drawLine(x1, y1, x2, y2, attributes = {}) { return svgElement("line", { x1, y1, x2, y2, stroke: "#94a3b8", "stroke-width": 2, ...attributes }); }
    function drawInvestigationStage() {
      const key = state.activeSpring;
      const spring = scenario.springs[key];
      const endpoint = investigationEndpointM(state, spring, visualPositionM);
      dom.svg.append(drawText(36, 32, `${springLabel(key)}・真實探究現象`, { "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawLine(98, 42, 98, 455, { stroke: "#64748b", "stroke-width": 3 }));
      dom.svg.append(drawText(112, 30, "位置 / cm", { class: "math-svg", "font-size": 12, fill: "#64748b" }));
      for (let cmValue = 0; cmValue <= 25; cmValue += 5) {
        const y = positionToY(cmValue / 100);
        const label = cmValue === 0 ? "0" : `${cmValue} cm`;
        dom.svg.append(drawLine(88, y, 108, y, { stroke: "#64748b", "stroke-width": cmValue === 0 ? 3 : 2 }), drawText(112, y + 5, label, { class: "math-svg", "font-size": 12 }));
      }
      dom.svg.append(drawLine(98, 42, 548, 42, { stroke: "#334155", "stroke-width": 5 }));
      dom.svg.append(drawLine(418, 48, 418, 455, { stroke: "#cbd5e1", "stroke-width": 2 }));
      const top = 62, bottom = positionToY(endpoint), coils = [];
      for (let i = 0; i <= 18; i += 1) { const y = top + (bottom - top) * i / 18; const x = 418 + (i % 2 ? 24 : -24); coils.push(`${x},${y}`); }
      dom.svg.append(svgElement("polyline", { points: coils.join(" "), fill: "none", stroke: "#475569", "stroke-width": 4, "stroke-linejoin": "round" }));
      dom.svg.append(svgElement("rect", { x: 385, y: bottom, width: 66, height: 16, rx: 3, fill: "#64748b" }));
      if (state.activeLoadKey) dom.svg.append(drawText(470, bottom + 13, forceLabel(state.activeLoadKey), { class: "math-svg", "font-weight": 700 }));
      else dom.svg.append(drawText(470, bottom + 13, "無額外負載", { "font-size": 13 }));
      const calibrationY = positionToY(state.calibrations[key]?.zeroM ?? state.working.zeroDraftM ?? spring.naturalLengthM);
      dom.svg.append(drawLine(148, calibrationY, 636, calibrationY, { stroke: "#7c3aed", "stroke-dasharray": "6 5", "stroke-width": 2 }), drawText(606, calibrationY - 7, "零位", { fill: "#6d28d9", "font-size": 13 }));
      if (state.activeLoadKey && stable) {
        const cursorY = positionToY(state.working.cursorDraftM ?? state.calibrations[key]?.zeroM ?? endpoint);
        dom.svg.append(drawLine(145, cursorY, 645, cursorY, { stroke: "#dc2626", "stroke-width": 2 }), drawText(600, cursorY - 7, "游標", { fill: "#b91c1c", "font-size": 13 }));
      }
      dom.svg.append(drawText(580, 440, "讀尺位置 / cm", { class: "math-svg", "font-size": 12, fill: "#64748b" }));
    }
    function drawModelStage() {
      const key = state.activeSpring;
      dom.svg.append(drawText(36, 32, `${springLabel(key)}・你的 F–x 模型`, { class: "math-svg", "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawLine(GRAPH.left, GRAPH.top + GRAPH.height, GRAPH.left + GRAPH.width, GRAPH.top + GRAPH.height, { stroke: "#334155", "stroke-width": 3 }), drawLine(GRAPH.left, GRAPH.top, GRAPH.left, GRAPH.top + GRAPH.height, { stroke: "#334155", "stroke-width": 3 }));
      dom.svg.append(drawText(GRAPH.left + GRAPH.width - 78, GRAPH.top + GRAPH.height + 30, "伸長 x / cm", { class: "math-svg", "font-size": 12 }), drawText(GRAPH.left - 40, GRAPH.top + 6, "F / N", { class: "math-svg", "font-size": 12 }));
      dom.svg.append(drawText(GRAPH.left - 30, GRAPH.top + GRAPH.height + 5, "0", { class: "math-svg", "font-size": 12 }));
      for (const forceN of [1, 2, 3, 4]) { const y = GRAPH.top + GRAPH.height - forceN / GRAPH.maxForceN * GRAPH.height; dom.svg.append(drawLine(GRAPH.left - 5, y, GRAPH.left + GRAPH.width, y, { stroke: "#e2e8f0", "stroke-width": 1 }), drawText(GRAPH.left - 30, y + 5, String(forceN), { class: "math-svg", "font-size": 12 })); }
      for (const xM of [0, .05, .10, .15, .18]) { const point = graphPoint(xM, 0); dom.svg.append(drawLine(point.x, GRAPH.top + GRAPH.height, point.x, GRAPH.top + GRAPH.height + 5, { stroke: "#334155", "stroke-width": 2 }), drawText(point.x - 12, GRAPH.top + GRAPH.height + 20, cmTick(xM), { class: "math-svg", "font-size": 11 })); }
      for (const row of measuredRows(state, key)) if (row.extensionM !== null) { const point = graphPoint(row.extensionM, row.forceN); dom.svg.append(svgElement("circle", { cx: point.x, cy: point.y, r: 7, fill: "#0f766e" }), drawText(point.x + 10, point.y + 5, forceLabel(row.loadKey), { class: "math-svg", "font-size": 11 })); }
      const modelPoint = graphPoint(modelDraftM, Model.MODEL_HANDLE_FORCE_N);
      if (modelPoint) {
        dom.svg.append(drawLine(GRAPH.left, GRAPH.top + GRAPH.height, modelPoint.x, modelPoint.y, { stroke: "#2563eb", "stroke-width": 3 }));
        dom.svg.append(drawLine(GRAPH.left, modelPoint.y, modelPoint.x, modelPoint.y, { stroke: "#2563eb", "stroke-dasharray": "5 4", "stroke-width": 1 }));
        dom.svg.append(drawText(modelPoint.x + 10, modelPoint.y - 8, "你的模型控制點", { fill: "#1d4ed8", "font-size": 12 }));
      }
    }
    function drawPredictionStage() {
      const spec = scenario.predictions[state.activePredictionIndex];
      const extension = predictionDraftM;
      dom.svg.append(drawText(36, 32, `預測 ${state.activePredictionIndex + 1}・${springLabel(spec.springKey)}、${n(spec.forceN, 1)} N`, { class: "math-svg", "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawLine(128, 70, 128, 438, { stroke: "#334155", "stroke-width": 4 }));
      const zeroY = 108, markerY = zeroY + clamp(extension, 0, Generator.MAX_LINEAR_EXTENSION_M) / Generator.MAX_LINEAR_EXTENSION_M * 300;
      dom.svg.append(drawLine(102, zeroY, 680, zeroY, { stroke: "#7c3aed", "stroke-dasharray": "6 5", "stroke-width": 2 }), drawText(145, zeroY - 9, "學生使用的 0 cm 基準", { class: "math-svg", fill: "#6d28d9", "font-size": 13 }));
      dom.svg.append(drawLine(102, markerY, 680, markerY, { stroke: "#c2410c", "stroke-width": 3 }), drawText(540, markerY - 9, `你的預測 ${cm(extension)}`, { class: "math-svg", fill: "#9a3412", "font-size": 13 }));
      dom.svg.append(drawLine(128, zeroY, 128, markerY, { stroke: "#c2410c", "stroke-width": 2 }));
      dom.svg.append(drawText(470, 430, "提交前不掛上這個負載，不顯示實際終點。", { fill: "#64748b", "font-size": 13 }));
    }
    function drawDesignStage() {
      dom.svg.append(drawText(36, 32, "盲測工程設計・只顯示題目限制及你的方案", { "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawLine(116, 330, 680, 330, { stroke: "#dc2626", "stroke-dasharray": "8 5", "stroke-width": 3 }), drawText(560, 320, `伸長上限 ${cm(scenario.design.limitM)}`, { class: "math-svg", fill: "#b91c1c", "font-size": 13 }));
      dom.svg.append(drawLine(170, 78, 170, 430, { stroke: "#334155", "stroke-width": 4 }), drawLine(170, 78, 630, 78, { stroke: "#334155", "stroke-width": 5 }));
      const selected = state.design;
      const count = selected?.moduleCount || 0;
      for (let i = 0; i < count; i += 1) dom.svg.append(svgElement("rect", { x: 340 + i * 42, y: 110, width: 32, height: 28, rx: 4, fill: "#64748b" }), drawText(348 + i * 42, 129, "0.5", { class: "math-svg", fill: "#fff", "font-size": 9 }));
      dom.svg.append(drawText(230, 205, selected ? `${springLabel(selected.springKey)}・${selected.moduleCount} 個模組・${n(selected.moduleCount * scenario.design.moduleForceN, 1)} N` : "尚未選擇方案", { class: "math-svg", "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawText(230, 245, "提交前不實際掛上負載，不顯示安全性或最佳方案。", { fill: "#64748b", "font-size": 13 }));
    }
    function drawReviewStage() {
      dom.svg.append(drawText(36, 32, "提交前 review・圖台只顯示你的答案", { "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawText(270, 215, "請在左側檢查完整答案及依賴資料。", { "font-size": 18, "font-weight": 700 }), drawText(276, 250, "提交後才會顯示正確性、分數及實際測試。", { fill: "#64748b", "font-size": 14 }));
    }
    function drawResultStage() {
      const view = buildResultViewModel(state, scenario, latestResult);
      dom.svg.append(drawText(36, 32, "已鎖定結果・揭示理想模型與實際測試", { "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawText(260, 160, `總分 ${view.score} / 100`, { "font-size": 32, "font-weight": 800, fill: "#1d4ed8" }), drawText(260, 205, view.passed ? "達到合格條件" : "未達到合格條件", { "font-size": 18, "font-weight": 700 }));
      const lines = ["結果已鎖定，這個 attempt 不能再修改。", `A：理想 k ${n(view.trueSprings.A.kNPerM, 1)} N/m；B：理想 k ${n(view.trueSprings.B.kNPerM, 1)} N/m`];
      lines.forEach((line, index) => dom.svg.append(drawText(260, 270 + index * 28, line, index === 1 ? { class: "math-svg", "font-size": 14, fill: "#475569" } : { "font-size": 14, fill: "#475569" })));
    }
    function renderStage() {
      if (!dom.svg || !state || !scenario) return;
      dom.svg.replaceChildren();
      if (presentation === "fallback" || presentation === "technical" || presentation === "frozen") {
        dom.svg.append(drawText(250, 220, "目前沒有可安全顯示的可編輯圖台。", { "font-size": 18, "font-weight": 700 }));
        hideDragTargets();
        return;
      }
      if (mayRevealCorrectness(presentation)) drawResultStage();
      else if (state.phase === "investigate") drawInvestigationStage();
      else if (state.phase === "model") drawModelStage();
      else if (state.phase === "predict") drawPredictionStage();
      else if (state.phase === "design") drawDesignStage();
      else drawReviewStage();
      setText($("stageDescription"), mayRevealCorrectness(presentation) ? "提交後的鎖定結果圖台，包含理想模型及實際測試結果。" : "圖台只顯示目前可觀察的探究現象、學生自己的資料或學生自己的標記；提交前不顯示正確性。");
      positionDragTargets();
    }
    function hideDragTargets() { Object.values(dragTargets).forEach((target) => { if (target) target.hidden = true; }); }
    function setDrag(target, visible, left, top, label, text) {
      if (!target) return;
      target.hidden = !visible;
      target.style.left = `${left}%`; target.style.top = `${top}%`;
      target.setAttribute("aria-label", label);
      target.textContent = text;
      target.classList.toggle("is-dragging", Boolean(drag && drag.target === target));
    }
    function positionDragTargets() {
      const focusedTarget = Object.values(dragTargets).find((target) => target && target === document.activeElement);
      hideDragTargets();
      if (locked || !state || presentation !== "editable") return;
      const stageRect = dom.stage.getBoundingClientRect();
      const toPercent = (x, y) => {
        const point = svgToClient(dom.svg, x, y);
        return [clamp((point.x - stageRect.left) / Math.max(1, stageRect.width) * 100, 3, 97), clamp((point.y - stageRect.top) / Math.max(1, stageRect.height) * 100, 7, 93)];
      };
      if (state.phase === "investigate") {
        const key = state.activeSpring; const zeroY = positionToY(state.working.zeroDraftM ?? scenario.springs[key].naturalLengthM);
        const zeroHandle = toPercent(INVESTIGATION_DRAG_HANDLE_X, zeroY);
        setDrag(dom.zeroDrag, !state.calibrations[key] && !state.activeLoadKey, zeroHandle[0], zeroHandle[1], "自然長度零位標記；上下方向鍵可微調", "零");
        const cursorY = positionToY(state.working.cursorDraftM ?? state.calibrations[key]?.zeroM ?? scenario.springs[key].naturalLengthM); const cursor = toPercent(INVESTIGATION_DRAG_HANDLE_X, cursorY);
        setDrag(dom.cursorDrag, Boolean(state.activeLoadKey && stable && state.calibrations[key]), cursor[0], cursor[1], "量度游標；上下方向鍵可微調", "量");
      } else if (state.phase === "model") {
        const point = graphPoint(modelDraftM, Model.MODEL_HANDLE_FORCE_N); const target = toPercent(point.x, point.y);
        setDrag(dom.modelDrag, true, target[0], target[1], "模型控制點；左右方向鍵可微調", "模");
      } else if (state.phase === "predict") {
        const x = 128, y = 108 + clamp(predictionDraftM, 0, Generator.MAX_LINEAR_EXTENSION_M) / Generator.MAX_LINEAR_EXTENSION_M * 300; const target = toPercent(x, y);
        setDrag(dom.predictionDrag, true, target[0], target[1], "預測標記；上下方向鍵可微調", "預");
      }
      if (focusedTarget && !focusedTarget.hidden) focusedTarget.focus({ preventScroll: true });
    }
    function coordinateFromEvent(event) {
      const point = clientToSvg(dom.svg, event.clientX, event.clientY);
      return { x: clamp(point.x, 0, 800), y: clamp(point.y, 0, 500) };
    }
    function valueFromPoint(kind, point) {
      if (kind === "zero" || kind === "cursor") return clamp((point.y - 54) / 382 * Generator.STAGE_SPAN_M, 0, Generator.STAGE_SPAN_M);
      if (kind === "model") return clamp((point.x - GRAPH.left) / GRAPH.width, 0, 1) * Generator.MAX_LINEAR_EXTENSION_M;
      if (kind === "prediction") return clamp((point.y - 108) / 300, 0, 1) * Generator.MAX_LINEAR_EXTENSION_M;
      return 0;
    }
    function beginDrag(event, kind, target) {
      if (locked || presentation !== "editable" || !target || event.button > 0 || (event.pointerType === "touch" && event.isPrimary === false)) return;
      if (kind === "zero" && (state.phase !== "investigate" || state.calibrations[state.activeSpring] || state.activeLoadKey)) return;
      if (kind === "cursor" && (state.phase !== "investigate" || !state.activeLoadKey || !stable)) return;
      if (kind === "model" && state.phase !== "model") return;
      if (kind === "prediction" && state.phase !== "predict") return;
      event.preventDefault();
      const point = coordinateFromEvent(event); const current = kind === "zero" ? state.working.zeroDraftM : kind === "cursor" ? state.working.cursorDraftM : kind === "model" ? modelDraftM : predictionDraftM;
      drag = { kind, target, pointerId: event.pointerId, startValue: current, lastValue: current, startPoint: point };
      try { target.setPointerCapture(event.pointerId); } catch {}
      target.classList.add("is-dragging");
      target.addEventListener("pointermove", moveDrag);
      target.addEventListener("pointerup", endDrag);
      target.addEventListener("pointercancel", cancelDrag);
      renderStage();
    }
    function moveDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      const point = coordinateFromEvent(event);
      const value = valueFromPoint(drag.kind, point); drag.lastValue = value;
      const delta = Math.abs(value - drag.startValue);
      if (drag.kind === "zero") { state.working.zeroDraftM = value; zeroMoveM = Math.max(zeroMoveM, delta); zeroMode = "pointer"; }
      else if (drag.kind === "cursor") { state.working.cursorDraftM = value; cursorMoveM = Math.max(cursorMoveM, delta); cursorMode = "pointer"; }
      else if (drag.kind === "model") { modelDraftM = value; modelMoveM = Math.max(modelMoveM, delta); modelMode = "pointer"; }
      else { predictionDraftM = value; predictionMoveM = Math.max(predictionMoveM, delta); predictionMode = "pointer"; }
      render();
    }
    function removeDragListeners() {
      if (!drag) return;
      drag.target.removeEventListener("pointermove", moveDrag);
      drag.target.removeEventListener("pointerup", endDrag);
      drag.target.removeEventListener("pointercancel", cancelDrag);
      drag.target.classList.remove("is-dragging");
    }
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      const current = drag.kind; removeDragListeners(); drag = null;
      if (current === "zero") checkpoint("已保存零位游標的目前草稿位置；按記錄後才會成為量度證據。");
      else if (current === "cursor") checkpoint("已保存量度游標的目前草稿位置；按記錄後才會成為量度證據。");
      else if (current === "model") recordModel();
      else recordPrediction();
      render();
    }
    function cancelDrag(event) {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      const snapshot = drag;
      removeDragListeners(); drag = null;
      if (snapshot.kind === "zero") state.working.zeroDraftM = snapshot.startValue;
      else if (snapshot.kind === "cursor") state.working.cursorDraftM = snapshot.startValue;
      else if (snapshot.kind === "model") modelDraftM = snapshot.startValue;
      else predictionDraftM = snapshot.startValue;
      zeroMoveM = cursorMoveM = modelMoveM = predictionMoveM = 0;
      render();
      announce("操作被取消；已回復拖動前的語意狀態。");
    }
    function keyboardAdjust(event, kind, target) {
      if (locked || presentation !== "editable" || !target) return;
      const vertical = kind === "zero" || kind === "cursor" || kind === "prediction";
      const allowed = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
      if (!allowed.includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? .005 : .001; const direction = (event.key === "ArrowUp" || event.key === "ArrowRight") ? 1 : -1;
      if (kind === "zero") { const before = state.working.zeroDraftM; state.working.zeroDraftM = clamp(before + direction * step, 0, Generator.STAGE_SPAN_M); zeroMoveM = Math.min(Generator.STAGE_SPAN_M, zeroMoveM + Math.abs(state.working.zeroDraftM - before)); zeroMode = "keyboard"; }
      else if (kind === "cursor") { const before = state.working.cursorDraftM; state.working.cursorDraftM = clamp(before + direction * step, 0, Generator.STAGE_SPAN_M); cursorMoveM = Math.min(Generator.STAGE_SPAN_M, cursorMoveM + Math.abs(state.working.cursorDraftM - before)); cursorMode = "keyboard"; }
      else if (kind === "model") { const before = modelDraftM; modelDraftM = clamp(before + direction * step, Model.MIN_EXTENSION_M, Generator.MAX_LINEAR_EXTENSION_M); modelMoveM = Math.min(Generator.MAX_LINEAR_EXTENSION_M, modelMoveM + Math.abs(modelDraftM - before)); modelMode = "keyboard"; }
      else { const before = predictionDraftM; predictionDraftM = clamp(before + direction * step, 0, Generator.MAX_LINEAR_EXTENSION_M); predictionMoveM = Math.min(Generator.MAX_LINEAR_EXTENSION_M, predictionMoveM + Math.abs(predictionDraftM - before)); predictionMode = "keyboard"; }
      if (kind === "model") recordModel(); else if (kind === "prediction") recordPrediction();
      else checkpoint("已保存鍵盤微調的草稿位置；按記錄後才會成為量度證據。");
      render();
    }
    function bindDragTarget(kind, target) {
      if (!target) return;
      target.addEventListener("pointerdown", (event) => beginDrag(event, kind, target));
      target.addEventListener("keydown", (event) => keyboardAdjust(event, kind, target));
    }
    function bind() {
      dom.panel.addEventListener("click", (event) => {
        const actionNode = event.target.closest?.("[data-action]"); if (!actionNode) return;
        const action = actionNode.dataset.action;
        if (action === "spring-tab") activeSelection(actionNode.dataset.spring, `現在操作${springLabel(actionNode.dataset.spring)}。`);
        else if (action === "select-load") selectLoad(actionNode.dataset.load);
        else if (action === "attach-load") attachLoad();
        else if (action === "record-calibration") recordCalibration();
        else if (action === "request-recalibrate") requestRecalibration();
        else if (action === "record-measurement") recordMeasurement();
        else if (action === "to-model" || action === "to-predict" || action === "to-design" || action === "to-review") toReviewEditOrNext();
        else if (action === "model-spring-tab") beginModelSpring(actionNode.dataset.spring);
        else if (action === "prediction-select") choosePrediction(Number(actionNode.dataset.index));
        else if (action === "module-minus" || action === "module-plus") { if (state?.design) changeDesign(state.design.springKey, clamp(state.design.moduleCount + (action === "module-plus" ? 1 : -1), 1, scenario.design.maxModuleCount)); }
        else if (action === "to-review") goPhase("review");
        else if (action === "edit-section") editSection(actionNode.dataset.editPhase);
        else if (action === "submit") submit();
        else if (action === "retry-pending") retryPending();
        else if (action === "finish") finishCommitted();
      });
      dom.panel.addEventListener("change", (event) => {
        const input = event.target.closest?.("[data-action='design-spring']"); if (input?.checked && state?.phase === "design") changeDesign(input.value, state.design?.moduleCount || 1);
      });
      dom.confirmRecalibration?.addEventListener("click", (event) => { event.preventDefault(); confirmRecalibration(); });
      bindDragTarget("zero", dom.zeroDrag); bindDragTarget("cursor", dom.cursorDrag); bindDragTarget("model", dom.modelDrag); bindDragTarget("prediction", dom.predictionDrag);
      dom.stage.addEventListener("pointerdown", (event) => {
        if (locked || event.pointerType !== "touch" || event.isPrimary === false || event.target.closest?.(".drag-target")) return;
        hostSwipe = { pointerId: event.pointerId, lastY: event.clientY };
      });
      dom.stage.addEventListener("pointermove", (event) => {
        if (!hostSwipe || hostSwipe.pointerId !== event.pointerId) return;
        const delta = hostSwipe.lastY - event.clientY;
        hostSwipe.lastY = event.clientY;
        if (Math.abs(delta) < .1) return;
        try {
          if (host.parent && host.parent !== host) host.parent.scrollBy(0, delta);
        } catch {}
        event.preventDefault();
      }, { passive: false });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) dom.stage.addEventListener(type, (event) => { if (hostSwipe?.pointerId === event.pointerId) hostSwipe = null; });
      host.addEventListener?.("resize", () => { if (!drag) renderStage(); });
      host.addEventListener?.("blur", () => { if (drag) cancelDrag(); stopAnimation(); renderStage(); });
      document.addEventListener("visibilitychange", () => { if (document.hidden) { if (drag) cancelDrag(); stopAnimation(); renderStage(); } });
    }
    function startup(attempt) {
      const startupState = routeStartup(attempt, SimActivityFlow);
      if (startupState === "editable") {
        try {
          if (attempt.state === "draft") {
            const answer = attempt.snapshot?.answer; scenario = scenarioFor(answer); state = Persistence.decodeSnapshot(attempt.snapshot, scenario, "draft");
          } else {
            state = Persistence.freshState(options.seed ?? freshSeed()); scenario = scenarioFor(state);
          }
          locked = false; presentation = "editable"; latestResult = null; syncRuntime(); lastDraftState = Persistence.clone(state); registerDraftProvider();
          if (attempt.state === "new" && !checkpoint()) return;
          render();
        } catch { technicalLock("草稿資料無法安全還原；系統沒有把它改成另一份答案。"); }
      } else if (startupState === "review") {
        try {
          const answer = attempt.snapshot?.answer; scenario = scenarioFor(answer); state = Persistence.decodeSnapshot(attempt.snapshot, scenario, "review");
          const computed = Scoring.scoreAnswer(state, scenario); const trusted = SimActivityFlow.reviewResult(computed, attempt.snapshot, attempt);
          if (trusted.trusted) { latestResult = trusted.result; presentation = "trusted-finished-review"; locked = true; renderResult("已從已完成 attempt 安全還原並重算結果。"); }
          else renderFallback(attempt, "已完成 attempt 的詳細答案與活動重算不一致；只顯示可信的 Moodle summary。");
        } catch { renderFallback(attempt, "已完成 attempt 的詳細答案無法安全驗證；只顯示可信的 Moodle summary。"); }
      } else if (startupState === "frozen") {
        try {
          const payload = attempt.snapshot?.payload; const review = JSON.parse(payload?.reviewJson || "null");
          scenario = scenarioFor(review.answer); state = Persistence.decodeSnapshot(review, scenario, "review");
          const computed = Scoring.scoreAnswer(state, scenario);
          if (!payload || payload.reviewJson !== JSON.stringify(review) || payload.score !== computed.score || payload.maxScore !== computed.maxScore || payload.passed !== computed.passed || review.score !== computed.score || review.passed !== computed.passed) throw new Error("pending mismatch");
          pendingExpected = { reviewJson: payload.reviewJson, score: payload.score, maxScore: payload.maxScore, passed: payload.passed }; locked = true; presentation = "frozen"; latestResult = null; renderFrozen("上次提交仍待 Moodle 確認；只可重試同一份已凍結答案。");
        } catch { SimScorm.quarantinePending(); technicalLock("待確認提交資料未能安全驗證；已停止重試。"); }
      } else technicalLock("無法安全讀取 Moodle attempt；操作及分數均未確認。");
    }
    ensureServices();
    bind();
    let attempt;
    try { attempt = options.attempt || SimScorm.loadAttempt(ACTIVITY); startup(attempt); } catch { technicalLock("活動共享 runtime 未能安全啟動；操作及分數均未確認。"); }
    return {
      activity: ACTIVITY,
      getState: () => clone(state),
      getPresentation: () => presentation,
      getScenario: () => scenario,
      getResult: () => mayRevealCorrectness(presentation) ? clone(latestResult) : null,
      render,
      routeAttempt: (value) => startup(value),
      routeStartup: (value) => routeStartup(value, SimActivityFlow),
      routeSubmission: (value) => routeSubmission(value, SimActivityFlow, {}),
      cancelDrag,
      mayReveal: () => mayRevealCorrectness(presentation),
      interactionEvidence: () => ({ zeroMoveM, cursorMoveM, modelMoveM, predictionMoveM, modelDraftM, predictionDraftM, stable, locked, selectedLoadKey })
    };
  }

  return { ACTIVITY, PHASE_LABELS, mayRevealCorrectness, buildEditableViewModel, buildResultViewModel, routeStartup, routeSubmission, investigationEndpointM, INVESTIGATION_DRAG_HANDLE_X, freshSeed, clientToSvg, svgToClient, boot };
});
