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
  const PHASE_LABELS = Object.freeze({ investigate: "探究與量度", model: "找出 F–x 線性關係", predict: "盲測預測", design: "安全承載設計", review: "提交前 review" });
  const PHASE_PROGRESS = Object.freeze({ investigate: 0, model: 8, predict: 10, design: 13, review: 14 });
  const GRAPH = Object.freeze({ left: 122, top: 54, width: 585, height: 354, maxExtensionM: Generator.MAX_LINEAR_EXTENSION_M, maxForceN: 4.0 });
  const GRAPH_X_AXIS_LABEL_X = GRAPH.left + GRAPH.width / 2;
  const GRAPH_X_AXIS_LABEL_Y = GRAPH.top + GRAPH.height + 52;
  const INVESTIGATION_DRAG_HANDLE_X = 650;
  const INVESTIGATION_GUIDE_LABEL_X = 596;
  const INVESTIGATION_RULER_TOP = 42;
  const INVESTIGATION_RULER_BOTTOM = 455;
  const MEASUREMENT_SNAP_THRESHOLD_M = 0.003;
  const MODEL_MIN_POINT_FORCE_N = 0.5;
  const PREDICTION_SNAP_STEP_M = 0.01;
  const PREDICTION_STAGE = Object.freeze({ springX: 410, springTopY: 78, shortestSpringEndY: 190, extensionPixels: 220, guideLeft: 150, guideRight: 690 });
  const PREDICTION_LOAD_VISUALS = Object.freeze({
    "1.5": Object.freeze({ width: 58, height: 18, fill: "#bfdbfe", stroke: "#1d4ed8" }),
    "2.5": Object.freeze({ width: 74, height: 24, fill: "#fde68a", stroke: "#b45309" }),
    "3.5": Object.freeze({ width: 90, height: 30, fill: "#fecaca", stroke: "#b91c1c" })
  });
  const PREDICTION_LOAD_PALETTE = Object.freeze([
    Object.freeze({ fill: "#dbeafe", stroke: "#2563eb" }),
    Object.freeze({ fill: "#cffafe", stroke: "#0891b2" }),
    Object.freeze({ fill: "#dcfce7", stroke: "#16a34a" }),
    Object.freeze({ fill: "#fef3c7", stroke: "#d97706" }),
    Object.freeze({ fill: "#ffedd5", stroke: "#ea580c" }),
    Object.freeze({ fill: "#fee2e2", stroke: "#dc2626" }),
    Object.freeze({ fill: "#f3e8ff", stroke: "#9333ea" })
  ]);
  const LOAD_VISUALS = Object.freeze({
    F1: Object.freeze({ width: 54, height: 16, fill: "#bfdbfe", stroke: "#1d4ed8" }),
    F2: Object.freeze({ width: 70, height: 20, fill: "#fde68a", stroke: "#b45309" }),
    F3: Object.freeze({ width: 86, height: 24, fill: "#fecaca", stroke: "#b91c1c" })
  });

  function predictionLoadVisual(forceN) {
    const numericForce = Number(forceN);
    const exactKey = Object.keys(PREDICTION_LOAD_VISUALS).find((key) => Math.abs(Number(key) - numericForce) <= (Generator.FLOAT_EPSILON || 1e-9));
    if (exactKey) return PREDICTION_LOAD_VISUALS[exactKey];
    const normalizedForce = clamp(finite(numericForce) ? numericForce : 2.5, 0.5, 4);
    const paletteIndex = Math.min(PREDICTION_LOAD_PALETTE.length - 1, Math.max(0, Math.round((normalizedForce - 0.5) / 0.5)));
    const palette = PREDICTION_LOAD_PALETTE[paletteIndex];
    return Object.freeze({
      width: Math.round(48 + normalizedForce * 11),
      height: Math.round(16 + normalizedForce * 3.5),
      fill: palette.fill,
      stroke: palette.stroke
    });
  }

  function finite(value) { return Number.isFinite(value); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function snapMeasurementValue(value, target, threshold = MEASUREMENT_SNAP_THRESHOLD_M) {
    return finite(value) && finite(target) && Math.abs(value - target) <= threshold ? target : value;
  }
  function snapPredictionValue(value) {
    if (!finite(value)) return 0;
    return Math.max(0, Math.min(Generator.MAX_LINEAR_EXTENSION_M, Math.round(value / PREDICTION_SNAP_STEP_M) * PREDICTION_SNAP_STEP_M));
  }
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
  function debugQueryEnabled(search) {
    try {
      const value = new URLSearchParams(search || "").get("debug");
      return ["1", "true", "on"].includes(String(value || "").toLowerCase());
    } catch { return false; }
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
  function appendParts(parent, parts) {
    for (const part of parts || []) {
      if (part == null) continue;
      if (part.nodeType) parent.append(part);
      else parent.append(document.createTextNode(String(part)));
    }
    return parent;
  }
  function mathNumber(value) { return element("span", value == null ? "--" : String(value), "math-number"); }
  function mathVariable(value) { return element("i", value, "math-variable"); }
  function mathSubscript(value) { return element("sub", value, "math-variable"); }
  function mathUnit(value) { return element("span", value, "math-unit"); }
  function mathPlaceholder() { return element("span", "--", "math-quantity"); }
  function mathQuantity(value, unit) {
    const node = element("span", undefined, "math-quantity");
    node.append(mathNumber(value), mathUnit(unit));
    return node;
  }
  function mathLength(meters, digits = 1) { return finite(meters) ? mathQuantity((meters * 100).toFixed(digits), "cm") : mathPlaceholder(); }
  function mathForce(key) {
    const value = ({ F1: 1, F2: 2, F3: 3 })[key];
    return finite(value) ? mathQuantity(value.toFixed(1), "N") : mathPlaceholder();
  }
  function mathForceValue(value, digits = 1) { return finite(value) ? mathQuantity(Number(value).toFixed(digits), "N") : mathPlaceholder(); }
  function mathStiffness(value) { return finite(value) ? mathQuantity(n(value, 1), "N/m") : mathPlaceholder(); }
  function mathFxFormula() {
    const node = element("span", undefined, "math-inline");
    node.append(mathVariable("F"), document.createTextNode("–"), mathVariable("x"));
    return node;
  }
  function mathKFormula(value) {
    const node = element("span", undefined, "math-inline");
    node.append(mathVariable("k"), document.createTextNode(" = "), mathStiffness(value));
    return node;
  }
  function mathFEqualsKX() {
    const node = element("span", undefined, "math-inline");
    node.append(mathVariable("F"), document.createTextNode(" = "), mathVariable("k"), mathVariable("x"));
    return node;
  }
  function formatMathSentence(value) {
    const text = String(value ?? "");
    const parts = [];
    const pattern = /(F[=＝]kx|F[-–]x|(?:\d+(?:\.\d+)?)(?:\s*)(?:N\/m|N|cm|m)|(?<![\p{L}])k(?![\p{L}]))/gu;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      if (start > cursor) parts.push(text.slice(cursor, start));
      const token = match[0];
      if (/^F[=＝]kx$/.test(token)) parts.push(mathFEqualsKX());
      else if (/^F[-–]x$/.test(token)) parts.push(mathFxFormula());
      else if (/^k$/.test(token)) parts.push(mathVariable("k"));
      else {
        const quantity = token.match(/^(\d+(?:\.\d+)?)\s*(N\/m|N|cm|m)$/);
        parts.push(quantity ? mathQuantity(quantity[1], quantity[2]) : token);
      }
      cursor = start + token.length;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
  }
  function mathAxisLabel(prefix, variable, unit) {
    const node = element("span", undefined, "math-inline");
    if (prefix) node.append(document.createTextNode(prefix));
    if (variable) node.append(document.createTextNode(prefix ? " " : ""), mathVariable(variable));
    node.append(document.createTextNode(" / "), mathUnit(unit));
    return node;
  }
  function mathReadout(prefix, value) {
    const node = element("span", undefined, "math-inline");
    node.append(document.createTextNode(prefix), value);
    return node;
  }
  function appendGrid(parent, entries) {
    const fragment = document.createDocumentFragment();
    for (const [label, value] of entries) {
      const valueNode = element("strong");
      if (value?.nodeType) valueNode.append(value);
      else if (Array.isArray(value)) appendParts(valueNode, value);
      else valueNode.textContent = value == null ? "" : String(value);
      fragment.append(element("span", label), valueNode);
    }
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
      debugPanel: $("debugPanel"), debugComplete: $("debugCompleteInvestigation"), debugCompleteModel: $("debugCompleteModel"), debugStatus: $("debugStatus"),
      calibrationInstruction: $("calibrationInstruction"), zeroReadout: $("zeroReadout"), recordCalibration: $("recordCalibration"), recalibrate: $("recalibrate"), calibrationStatus: $("calibrationStatus"),
      loadCards: $("loadCards"), attachLoad: $("attachLoad"), loadStatus: $("loadStatus"), cursorReadout: $("cursorReadout"), recordMeasurement: $("recordMeasurement"), measurementStatus: $("measurementStatus"), dataTable: $("dataTable"), toModel: $("toModel"),
      modelData: $("modelData"), modelReadout: $("modelReadout"), modelStatus: $("modelStatus"), toPredict: $("toPredict"),
      predictionCards: $("predictionCards"), predictionStatus: $("predictionStatus"), toDesign: $("toDesign"),
      designLimit: $("designLimit"), designK_A: $("designK_A"), designK_B: $("designK_B"), moduleCount: $("moduleCount"), designCalculation: $("designCalculation"), designSummary: $("designSummary"), toReview: $("toReview"),
      reviewSummary: $("reviewSummary"), submit: $("submit"), submitStatus: $("submitStatus"),
      zeroDrag: $("zeroDrag"), cursorDrag: $("cursorDrag"), modelDrag: $("modelDrag"), predictionDrag: $("predictionDrag"), dialog: $("recalibrationDialog"), confirmRecalibration: $("confirmRecalibration")
    };
    const dragTargets = { zero: dom.zeroDrag, cursor: dom.cursorDrag, model: dom.modelDrag, prediction: dom.predictionDrag };
    const debugAvailable = debugQueryEnabled(host.location?.search || "");
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
    let modelDraftForceN = Model.MODEL_HANDLE_FORCE_N;
    let predictionDraftM = 0;
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
    let debugEnabled = false;

    function scenarioFor(answer) {
      return Generator.generateScenario({ seed: answer.seed, generatorVersion: answer.generatorVersion });
    }
    function ensureServices() {
      if (!SimScorm || !SimActivityFlow) throw new Error("Shared SCORM runtime unavailable");
    }
    function setText(node, value) { if (node) node.textContent = value == null ? "" : String(value); }
    function setMathContent(node, parts) {
      if (!node) return;
      node.replaceChildren();
      appendParts(node, parts);
    }
    function renderPhaseBadge(phase) {
      if (phase === "model") setMathContent(dom.badge, ["找出 ", mathFxFormula(), " 線性關係"]);
      else setText(dom.badge, PHASE_LABELS[phase] || phase);
    }
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
        predictionDraftM = snapPredictionValue(prediction?.extensionM ?? predictionDraftM);
        if (state.activeLoadKey && calibration) {
          if (state.working.cursorDraftM === null) state.working.cursorDraftM = calibration.zeroM;
          visualPositionM = endpointFor(state.activeSpring, state.activeLoadKey);
        }
        else visualPositionM = state.working.zeroDraftM ?? defaultZero;
      } else if (state.phase === "model") {
        modelDraftM = state.models[state.activeSpring]?.handleExtensionM ?? 0.08;
      } else if (state.phase === "predict") {
        predictionDraftM = snapPredictionValue(state.predictions[state.activePredictionIndex]?.extensionM ?? 0);
      }
      selectedLoadKey = state.activeLoadKey || selectedLoadKey || "F1";
    }
    function endpointFor(springKey, loadKey) {
      const spring = scenario?.springs?.[springKey];
      const forceN = Scoring.forceByKey[loadKey];
      return spring ? Model.endpointM(spring.naturalLengthM, forceN, spring.kNPerM) : 0.09;
    }
    function measurementSnapTarget(kind) {
      if (!state || !scenario || state.phase !== "investigate") return null;
      const spring = scenario.springs[state.activeSpring];
      if (kind === "zero" && spring && !state.calibrations[state.activeSpring] && !state.activeLoadKey) return spring.naturalLengthM;
      if (kind === "cursor" && state.activeLoadKey && stable && state.calibrations[state.activeSpring]) return endpointFor(state.activeSpring, state.activeLoadKey);
      return null;
    }
    function snapMeasurementPosition(kind, value) {
      return snapMeasurementValue(value, measurementSnapTarget(kind));
    }
    function completeInvestigationForDebug() {
      if (!debugAvailable || locked || !state || state.phase !== "investigate") {
        announce("調試自動量度只可在第一階段使用。");
        return false;
      }
      try {
        let next = Persistence.clone(state);
        for (const springKey of SPRINGS) {
          const spring = scenario.springs[springKey];
          next = Persistence.transitions.replaceCalibration(next, springKey, { zeroM: spring.naturalLengthM, mode: "keyboard", moveM: Model.MIN_OPERATION_MOVE_M }, scenario);
          for (const loadKey of LOADS) next = Persistence.transitions.replaceMeasurement(next, springKey, loadKey, { loadKey, cursorM: endpointFor(springKey, loadKey), mode: "keyboard", moveM: Model.MIN_OPERATION_MOVE_M }, scenario);
        }
        next.activeSpring = "A";
        next = Persistence.transitions.setPhase(next, "model", scenario);
        debugEnabled = true;
        zeroMoveM = cursorMoveM = 0;
        selectedLoadKey = "F1";
        stable = true;
        const ok = setState(next, "調試模式已自動完成第一階段；現在可以直接測試第二階段。", true);
        if (!ok) debugEnabled = false;
        return ok;
      } catch {
        debugEnabled = false;
        announce("調試模式未能安全完成第一階段。");
        return false;
      }
    }
    function completeModelForDebug() {
      if (!debugAvailable || !debugEnabled || locked || !state || state.phase !== "model") {
        announce("調試自動模型只可在第二階段使用。先開啟第一階段調試，再按這個按鈕。 ");
        return false;
      }
      try {
        let next = Persistence.clone(state);
        for (const springKey of SPRINGS) {
          const spring = scenario.springs[springKey];
          next = Persistence.transitions.replaceModel(next, springKey, Model.MODEL_HANDLE_FORCE_N / spring.kNPerM, scenario);
        }
        next.activeSpring = "A";
        next = Persistence.transitions.setPhase(next, "predict", scenario);
        const ok = setState(next, "調試模式已自動完成第二階段；現在可以直接測試第三階段。", true);
        if (!ok) announce("調試模式未能安全完成第二階段。 ");
        return ok;
      } catch {
        announce("調試模式未能安全完成第二階段。 ");
        return false;
      }
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
      setMathContent(dom.loadStatus, [mathForce(loadKey), " 已選取；按「掛上所選負載」開始觀察。"]);
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
      modelDraftForceN = Model.MODEL_HANDLE_FORCE_N;
      activeSelection(key, `現在調整${springLabel(key)}的 F–x 直線。`);
    }
    function recordModel() {
      if (locked || state.phase !== "model" || modelMoveM < Model.MIN_OPERATION_MOVE_M) return;
      const next = Persistence.transitions.replaceModel(state, state.activeSpring, modelDraftM, scenario);
      modelMoveM = 0;
      setState(next, `已記錄${springLabel(state.activeSpring)}的直線斜率。`);
    }
    function choosePrediction(index) {
      if (locked || state.phase !== "predict" || !Number.isInteger(index) || index < 0 || index > 2) return;
      const next = Persistence.clone(state);
      next.activePredictionIndex = index;
      next.activeLoadKey = null;
      if (!Persistence.validateAnswer(next, scenario, { kind: "draft" }).ok) return;
      state = next;
      predictionDraftM = snapPredictionValue(state.predictions[index]?.extensionM ?? 0);
      predictionMoveM = 0;
      render();
      checkpoint(`已選擇預測 ${index + 1}；尚未顯示任何正確性回饋。`);
      announce(`現在編輯預測 ${index + 1}。`);
    }
    function recordPrediction() {
      if (locked || state.phase !== "predict" || predictionMoveM < Model.MIN_OPERATION_MOVE_M) return;
      const index = state.activePredictionIndex;
      predictionDraftM = snapPredictionValue(predictionDraftM);
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
      if (!Object.hasOwn(PHASE_LABELS, phase) || phase === "review" && state.phase !== "review" && !Persistence.hasCompleteAnswer(state, scenario)) {
        if (phase === "review") announce("請先完成所有量度、模型、預測及工程方案。");
        return;
      }
      if (phase === "model" && !Persistence.hasAllCalibrationsAndMeasurements(state)) return announce("兩條彈簧各三項量度完成後，才可找出線性關係。");
      if (phase === "predict" && !Persistence.hasAllModels(state)) return announce("兩條直線都有斜率後，才可進行盲測預測。");
      if (phase === "design" && (!Persistence.hasAllModels(state) || !Persistence.hasAllPredictions(state))) return announce("三項預測完成後，才可進行安全承載設計。");
      if (phase === "review") {
        if (!Persistence.hasCompleteAnswer(state, scenario)) return announce("請先完成所有量度、模型、預測及工程方案。");
        if (!checkpoint()) return;
      }
      try {
        const next = Persistence.transitions.setPhase(state, phase, scenario);
        const returning = Persistence.PHASES.indexOf(phase) < Persistence.PHASES.indexOf(state.phase);
        const message = phase === "review"
          ? "已進入提交前 review；這裡只顯示你的答案及完成度。"
          : returning
            ? `已返回${PHASE_LABELS[phase]}；沒有更改已記錄的後續答案。`
            : `已進入${PHASE_LABELS[phase]}。`;
        setState(next, message, phase !== "review");
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
      [dom.technical, dom.debugPanel, dom.investigate, dom.model, dom.predict, dom.design, dom.review, dom.result].forEach((node) => node?.classList.add("is-hidden"));
    }
    function renderDebugPanel() {
      if (!dom.debugPanel || !dom.debugComplete) return;
      const visible = debugAvailable && presentation === "editable" && !locked && Boolean(state);
      dom.debugPanel.classList.toggle("is-hidden", !visible);
      if (!visible) return;
      dom.debugComplete.checked = debugEnabled;
      dom.debugComplete.disabled = debugEnabled || state.phase !== "investigate";
      if (dom.debugCompleteModel) dom.debugCompleteModel.disabled = !debugEnabled || state.phase !== "model";
      if (debugEnabled && state.phase === "model") setText(dom.debugStatus, "第一階段已自動完成；可按下方按鈕填入兩條正確直線，直接測試第三階段。 ");
      else if (debugEnabled && state.phase === "predict") setText(dom.debugStatus, "第一、二階段已自動完成；目前可直接測試第三階段。 ");
      else if (debugEnabled) setText(dom.debugStatus, "第一階段已自動完成；目前可直接測試第二階段。 ");
      else if (state.phase !== "investigate") setText(dom.debugStatus, "目前已離開第一階段；如要重新測試，請開啟新的 attempt。 ");
      else setText(dom.debugStatus, "開啟後會填入兩條彈簧的正確零位及三個負載讀數，並直接進入第二階段。 ");
    }
    function render() {
      if (presentation === "technical" || presentation === "frozen") return renderTechnical(dom.technicalMessage.textContent, presentation === "frozen" ? "提交狀態未確認" : "活動暫時鎖定", presentation === "frozen");
      if (presentation === "fallback") return;
      if (mayRevealCorrectness(presentation)) return renderResult();
      hidePanels();
      renderDebugPanel();
      if (!state) return renderTechnical("沒有可用的活動狀態。");
      const panel = { investigate: dom.investigate, model: dom.model, predict: dom.predict, design: dom.design, review: dom.review }[state.phase];
      panel?.classList.remove("is-hidden");
      dom.progress.max = 14;
      dom.progress.value = completionCount();
      renderPhaseBadge(state.phase);
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
      setMathContent(dom.zeroReadout, ["位置 ", mathLength(state?.working?.zeroDraftM)]);
      dom.recordCalibration.disabled = Boolean(locked || calibration || active || zeroMoveM < Model.MIN_OPERATION_MOVE_M);
      dom.recalibrate.disabled = Boolean(locked || !calibration);
      setText(dom.calibrationStatus, calibration ? `已記錄${springLabel(key)}的自然長度位置。` : "尚未記錄；系統只保存你按下記錄時的游標位置。");
      document.querySelectorAll("[data-action='spring-tab']").forEach((button) => { button.setAttribute("aria-selected", String(button.dataset.spring === key)); button.disabled = locked; });
      document.querySelectorAll("[data-action='select-load']").forEach((button) => { button.dataset.selected = String(button.dataset.load === selectedLoadKey); button.disabled = locked || !calibration; });
      dom.attachLoad.disabled = Boolean(locked || !calibration || !LOADS.includes(selectedLoadKey) || !stable);
      if (active) setMathContent(dom.loadStatus, ["目前觀察負載：", mathForce(active), stable ? "；彈簧已穩定。" : "；等待穩定。"]);
      else setText(dom.loadStatus, "尚未掛上負載。");
      const extensionM = calibration && state?.working?.cursorDraftM !== null ? Model.measuredExtensionM(calibration.zeroM, state.working.cursorDraftM) : null;
      if (active && stable) setMathContent(dom.cursorReadout, ["伸長量 ", mathLength(extensionM)]);
      else setText(dom.cursorReadout, active ? "等待彈簧穩定" : "--");
      dom.recordMeasurement.disabled = Boolean(locked || !active || !stable || cursorMoveM < Model.MIN_OPERATION_MOVE_M);
      setText(dom.measurementStatus, active && stable ? "讀數只代表你目前的游標位置；完成移動後可記錄。" : "掛上負載並等待穩定後，才可量度。");
      renderDataTables();
      dom.toModel.disabled = Boolean(locked || !Persistence.hasAllCalibrationsAndMeasurements(state));
      dom.toModel.textContent = state.fromReview ? "返回第二階段線性關係" : "完成量度後找出線性關係";
    }
    function renderDataTables() {
      dom.dataTable.replaceChildren();
      for (const key of SPRINGS) {
        const table = element("table", undefined, "data-table math-context");
        const caption = element("caption");
        appendParts(caption, [springLabel(key), "：學生量得的 ", mathFxFormula(), " 數據"]);
        const head = element("thead");
        const headRow = element("tr");
        headRow.append(element("th"), element("th"));
        setMathContent(headRow.firstChild, [mathAxisLabel("", "F", "N")]);
        setMathContent(headRow.lastChild, [mathAxisLabel("學生伸長", "x", "cm")]);
        head.append(headRow);
        const body = element("tbody");
        for (const row of measuredRows(state, key)) {
          const tr = element("tr");
          const forceCell = element("td");
          const extensionCell = element("td");
          setMathContent(forceCell, [mathForce(row.loadKey)]);
          setMathContent(extensionCell, [row.extensionM === null ? "未記錄" : mathLength(row.extensionM)]);
          tr.append(forceCell, extensionCell);
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
      for (const row of measuredRows(state, key)) {
        const item = element("li");
        appendParts(item, [mathForce(row.loadKey), "：", row.extensionM === null ? "未記錄" : mathLength(row.extensionM)]);
        list.append(item);
      }
      const modelCopy = element("p");
      appendParts(modelCopy, ["觀察三個數據點是否接近一直線。拖動圖上的「線」標記，調整一條由原點出發的直線；直線斜率 ", mathKFormula(Model.kFromModelHandle(modelDraftM)), "。"]);
      dom.modelData.append(modelCopy, list);
      setMathContent(dom.modelReadout, ["直線斜率 ", mathKFormula(Model.kFromModelHandle(modelDraftM)), "；參考 ", mathForceValue(Model.MODEL_HANDLE_FORCE_N), " 時伸長 ", mathLength(modelDraftM)]);
      setText(dom.modelStatus, state.models[key] ? `已保存${springLabel(key)}的直線斜率；可再次調整。` : "尚未保存這條彈簧的直線斜率。");
      dom.toPredict.disabled = Boolean(locked || !Persistence.hasAllModels(state));
      dom.toPredict.textContent = state.fromReview ? "返回第三階段預測" : "兩條直線都有斜率後繼續";
    }
    function renderPredict() {
      if (!state || state.phase !== "predict") return;
      dom.predictionCards.replaceChildren();
      scenario.predictions.forEach((spec, index) => {
        const card = element("article", undefined, "prediction-card math-context");
        card.dataset.selected = String(index === state.activePredictionIndex);
        const button = element("button", `選擇題目 ${index + 1}`);
        button.type = "button"; button.dataset.action = "prediction-select"; button.dataset.index = String(index); button.setAttribute("aria-pressed", String(index === state.activePredictionIndex)); button.disabled = locked;
        button.setAttribute("aria-label", `選擇預測題目 ${index + 1}：${springLabel(spec.springKey)}、${n(spec.forceN, 2)} N`);
        const heading = element("strong");
        appendParts(heading, [`預測 ${index + 1}：${springLabel(spec.springKey)}、`, mathForceValue(spec.forceN, 2)]);
        const predictionValue = element("span");
        if (state.predictions[index]) {
          const extensionM = state.predictions[index].extensionM;
          const naturalLengthM = state.calibrations[spec.springKey]?.zeroM;
          appendParts(predictionValue, ["你的預測伸長量：", mathLength(extensionM, 0), "；總長度：", mathLength(finite(naturalLengthM) ? naturalLengthM + extensionM : null, 1)]);
        }
        else predictionValue.textContent = "尚未填寫";
        const copy = element("div"); copy.append(heading, predictionValue);
        card.append(button, copy);
        dom.predictionCards.append(card);
      });
      setText(dom.predictionStatus, `${state.predictions.filter(Boolean).length}/3 項預測已填寫；這裡不會顯示實際測試結果。`);
      dom.toDesign.disabled = Boolean(locked || !Persistence.hasAllPredictions(state));
      dom.toDesign.textContent = state.fromReview ? "返回第四階段安全承載設計" : "完成三項預測後繼續";
    }
    function designCalculation() {
      const design = state?.design;
      const model = design ? state.models?.[design.springKey] : null;
      const kModelNPerM = model ? Model.kFromModelHandle(model.handleExtensionM) : null;
      const forceN = design ? design.moduleCount * scenario.design.moduleForceN : null;
      const extensionM = finite(kModelNPerM) && finite(forceN) ? Model.extensionM(forceN, kModelNPerM) : null;
      const limitM = scenario.design.limitM;
      return design ? {
        springKey: design.springKey,
        moduleCount: design.moduleCount,
        kModelNPerM,
        forceN,
        extensionM,
        limitM,
        predictedWithinLimit: finite(extensionM) && extensionM <= limitM + (Generator.FLOAT_EPSILON || 1e-9)
      } : null;
    }
    function renderDesign() {
      if (!state || state.phase !== "design") return;
      setMathContent(dom.designLimit, [mathLength(scenario.design.limitM)]);
      for (const key of SPRINGS) {
        const model = state.models[key];
        const target = key === "A" ? dom.designK_A : dom.designK_B;
        setMathContent(target, ["你的 ", mathKFormula(model ? Model.kFromModelHandle(model.handleExtensionM) : null)]);
      }
      const spring = state.design?.springKey || "";
      document.querySelectorAll("[data-action='design-spring']").forEach((input) => {
        input.checked = input.value === spring;
        input.disabled = locked;
      });
      setMathContent(dom.moduleCount, [mathNumber(state.design?.moduleCount ?? "--")]);
      const count = state.design?.moduleCount || 1;
      document.querySelectorAll("[data-action='module-minus']").forEach((button) => { button.disabled = locked || !state.design || count <= 1; });
      document.querySelectorAll("[data-action='module-plus']").forEach((button) => { button.disabled = locked || !state.design || count >= scenario.design.maxModuleCount; });
      dom.toReview.disabled = Boolean(locked || !state.design);

      const calculation = designCalculation();
      dom.designCalculation.replaceChildren();
      if (!calculation) {
        dom.designCalculation.dataset.state = "empty";
        appendParts(dom.designCalculation, ["先選擇一條彈簧，再用加減按鈕調整負載。"]);
      } else {
        dom.designCalculation.dataset.state = "calculation";
        const formulaForce = element("p");
        appendParts(formulaForce, ["你的模型計算：", mathVariable("F"), " = ", mathNumber(calculation.moduleCount), " × ", mathQuantity(scenario.design.moduleForceN.toFixed(1), "N"), " = ", mathForceValue(calculation.forceN)]);
        const formulaExtension = element("p");
        appendParts(formulaExtension, [mathVariable("x"), " = ", mathVariable("F"), " / ", mathVariable("k"), " = ", mathLength(calculation.extensionM), "；安全上限 ", mathVariable("x"), mathSubscript("max"), " = ", mathLength(calculation.limitM)]);
        const status = element("p", "請把上面的 x 與安全上限比較；在不超過上限的方案中，找出總負載最大的方案。");
        status.className = "design-status";
        dom.designCalculation.append(formulaForce, formulaExtension, status);
      }
      dom.designSummary.replaceChildren();
      if (state.design) appendGrid(dom.designSummary, [["彈簧", springLabel(state.design.springKey)], ["負載模組", mathNumber(state.design.moduleCount)], ["總負載", mathForceValue(state.design.moduleCount * scenario.design.moduleForceN)]]);
      else dom.designSummary.append(element("p", "先選擇彈簧及負載；計算結果會根據你自己的斜率更新。"));
    }
    function renderReview(notice = submitMessage, submitting = false) {
      if (!state || state.phase !== "review") return;
      dom.reviewSummary.replaceChildren();
      const required = Persistence.hasCompleteAnswer(state, scenario);
      if (notice) dom.reviewSummary.append(element("p", notice, "neutral-status"));
      const editable = buildEditableViewModel(state, scenario);
      const measurementText = element("p");
      SPRINGS.forEach((key, index) => {
        if (index) measurementText.append(document.createTextNode("；"));
        appendParts(measurementText, [springLabel(key), "零位 ", mathLength(editable.calibrations[key]?.zeroM)]);
      });
      measurementText.append(document.createTextNode(`；六項量度已保存：${completionCount() >= 8 ? "是" : "否"}`));
      const modelText = element("p");
      SPRINGS.forEach((key, index) => {
        if (index) modelText.append(document.createTextNode("；"));
        appendParts(modelText, [springLabel(key), " ", editable.models[key] ? mathKFormula(editable.models[key].kModelNPerM) : "未完成"]);
      });
      const predictionText = element("p");
      editable.predictions.forEach((prediction, index) => {
        if (index) predictionText.append(document.createTextNode("；"));
        appendParts(predictionText, [`預測 ${index + 1}：`, prediction.extensionM === null ? "未填寫" : mathLength(prediction.extensionM, 0)]);
      });
      const designText = element("p");
      if (editable.design) appendParts(designText, [springLabel(editable.design.springKey), "；", mathNumber(editable.design.moduleCount), " 個模組；", mathForceValue(editable.design.forceN)]);
      else designText.textContent = "未完成";
      for (const [title, content] of [["量度", measurementText], ["線性關係（胡克定律）", modelText], ["預測", predictionText], ["安全承載設計", designText]]) {
        const section = element("section");
        section.append(element("h3", title), content);
        dom.reviewSummary.append(section);
      }
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
      const list = element("ul", undefined, "feedback-list");
      latestResult.feedbackItems.forEach((item) => {
        const itemNode = element("li");
        appendParts(itemNode, formatMathSentence(item));
        list.append(itemNode);
      });
      evidence.append(list); dom.result.append(evidence);
      const reveal = element("section", undefined, "result-block"); reveal.append(element("h2", "提交後的實際測試"));
      const rows = element("div", undefined, "result-grid");
      for (const key of SPRINGS) {
        const label = element("span");
        appendParts(label, [springLabel(key), " 理想 ", mathVariable("k")]);
        const value = element("strong");
        value.append(mathStiffness(view.trueSprings[key].kNPerM));
        rows.append(label, value);
      }
      view.predictions.forEach((prediction, index) => {
        const value = element("strong");
        value.append(mathLength(prediction.actualExtensionM));
        rows.append(element("span", `預測 ${index + 1} 實際伸長`), value);
      });
      if (view.engineering) {
        const extension = element("strong");
        extension.append(mathLength(view.engineering.extensionM));
        rows.append(element("span", "工程方案實際伸長"), extension, element("span", "最大安全方案"), element("strong", view.engineering.optimal ? `${springLabel(view.engineering.optimal.springKey)}、${view.engineering.optimal.moduleCount} 個模組` : "--"));
      }
      reveal.append(rows); dom.result.append(reveal);
      if (presentation === "submitted-committed") {
        const button = element("button", "重試完成 Moodle 連線", "primary-button retry-button"); button.type = "button"; button.dataset.action = "finish"; dom.result.append(button);
      }
      renderStage();
    }
    function positionToY(positionM) { return INVESTIGATION_RULER_TOP + clamp(positionM, 0, Generator.STAGE_SPAN_M) / Generator.STAGE_SPAN_M * (INVESTIGATION_RULER_BOTTOM - INVESTIGATION_RULER_TOP); }
    function graphPoint(extensionM, forceN) { return Model.graphPointFromPhysics(extensionM, forceN, GRAPH); }
    function predictionSpringEndY(extensionM) {
      return PREDICTION_STAGE.shortestSpringEndY + clamp(extensionM, 0, Generator.MAX_LINEAR_EXTENSION_M) / Generator.MAX_LINEAR_EXTENSION_M * PREDICTION_STAGE.extensionPixels;
    }
    function modelDraftPoint() {
      const k = Model.kFromModelHandle(modelDraftM);
      if (!finite(k)) return null;
      const maximumForceN = Math.max(MODEL_MIN_POINT_FORCE_N, Math.min(GRAPH.maxForceN, k * GRAPH.maxExtensionM));
      const forceN = clamp(modelDraftForceN, MODEL_MIN_POINT_FORCE_N, maximumForceN);
      const extensionM = Model.extensionM(forceN, k);
      return finite(extensionM) ? graphPoint(extensionM, forceN) : null;
    }
    function modelValueFromPoint(point) {
      const physics = Model.physicsFromGraphPoint(point.x, point.y, GRAPH);
      const forceN = clamp(physics?.forceN ?? Model.MODEL_HANDLE_FORCE_N, MODEL_MIN_POINT_FORCE_N, GRAPH.maxForceN);
      const extensionM = clamp(physics?.extensionM ?? modelDraftM, Model.MIN_EXTENSION_M, Generator.MAX_LINEAR_EXTENSION_M);
      const k = forceN / extensionM;
      return {
        handleExtensionM: clamp(Model.MODEL_HANDLE_FORCE_N / k, Model.MIN_EXTENSION_M, Generator.MAX_LINEAR_EXTENSION_M),
        forceN
      };
    }
    function drawText(x, y, text, attributes = {}) {
      const node = svgElement("text", { x, y, "font-size": 16, fill: "#334155", ...attributes });
      node.textContent = String(text ?? "");
      return node;
    }
    function drawMathText(x, y, parts, attributes = {}) {
      const { class: extraClass, ...rest } = attributes;
      const node = svgElement("text", { x, y, "font-size": 16, fill: "#334155", ...rest, class: ["math-svg", extraClass].filter(Boolean).join(" ") });
      for (const part of parts || []) {
        const item = typeof part === "string" ? { text: part } : part;
        const tspan = svgElement("tspan", item.class ? { class: item.class, ...(item.dx === undefined ? {} : { dx: item.dx }) } : (item.dx === undefined ? {} : { dx: item.dx }));
        tspan.textContent = String(item.text ?? "");
        node.append(tspan);
      }
      return node;
    }
    function drawSvgQuantity(x, y, value, unit, attributes = {}) {
      return drawMathText(x, y, [{ text: value, class: "math-number" }, { text: ` ${unit}`, class: "math-unit" }], attributes);
    }
    function drawSvgLength(x, y, meters, attributes = {}) {
      return finite(meters) ? drawSvgQuantity(x, y, (meters * 100).toFixed(1), "cm", attributes) : drawMathText(x, y, ["--"], attributes);
    }
    function drawSvgForce(x, y, key, attributes = {}) {
      const value = ({ F1: "1.0", F2: "2.0", F3: "3.0" })[key];
      return value ? drawSvgQuantity(x, y, value, "N", attributes) : drawMathText(x, y, ["--"], attributes);
    }
    function drawSvgAxisLabel(x, y, prefix, variable, unit, attributes = {}) {
      const parts = [];
      if (prefix) parts.push(prefix);
      if (variable) parts.push({ text: `${prefix ? " " : ""}${variable}`, class: "math-variable" });
      parts.push({ text: " / " }, { text: unit, class: "math-unit" });
      return drawMathText(x, y, parts, attributes);
    }
    function drawSvgFxFormula(x, y, prefix = "", suffix = "", attributes = {}) {
      return drawMathText(x, y, [prefix, { text: "F", class: "math-variable" }, "–", { text: "x", class: "math-variable" }, suffix], attributes);
    }
    function drawSvgKValue(x, y, value, attributes = {}) {
      return drawMathText(x, y, [{ text: "k", class: "math-variable" }, " ", { text: "=", class: "math-number" }, " ", { text: n(value, 1), class: "math-number" }, { text: " N/m", class: "math-unit" }], attributes);
    }
    function drawLine(x1, y1, x2, y2, attributes = {}) { return svgElement("line", { x1, y1, x2, y2, stroke: "#94a3b8", "stroke-width": 2, ...attributes }); }
    function drawInvestigationStage() {
      const key = state.activeSpring;
      const spring = scenario.springs[key];
      const endpoint = investigationEndpointM(state, spring, visualPositionM);
      dom.svg.append(drawLine(98, INVESTIGATION_RULER_TOP, 98, INVESTIGATION_RULER_BOTTOM, { stroke: "#64748b", "stroke-width": 3 }));
      dom.svg.append(drawSvgAxisLabel(118, 72, "位置", "", "cm", { "font-size": 16, fill: "#64748b", "font-weight": 700 }));
      for (let cmValue = 0; cmValue <= 25; cmValue += 5) {
        const y = positionToY(cmValue / 100);
        const label = cmValue === 0 ? "0" : `${cmValue} cm`;
        const labelNode = cmValue === 0
          ? drawMathText(74, y + 6, [{ text: label, class: "math-number" }], { "font-size": 16, "font-weight": 700, "text-anchor": "end" })
          : drawSvgQuantity(74, y + 6, cmValue, "cm", { "font-size": 16, "font-weight": 600, "text-anchor": "end" });
        dom.svg.append(drawLine(82, y, 114, y, { stroke: "#64748b", "stroke-width": cmValue === 0 ? 4 : 3 }), labelNode);
      }
      dom.svg.append(drawLine(98, INVESTIGATION_RULER_TOP, 548, INVESTIGATION_RULER_TOP, { stroke: "#334155", "stroke-width": 5 }));
      dom.svg.append(drawText(560, 34, "固定端／天花板", { class: "math-svg", "font-size": 15, "font-weight": 700, fill: "#334155" }));
      dom.svg.append(drawLine(418, 48, 418, INVESTIGATION_RULER_BOTTOM, { stroke: "#cbd5e1", "stroke-width": 2 }));
      const top = INVESTIGATION_RULER_TOP, bottom = positionToY(endpoint), coils = [];
      for (let i = 0; i <= 18; i += 1) { const y = top + (bottom - top) * i / 18; const x = 418 + (i % 2 ? 24 : -24); coils.push(`${x},${y}`); }
      dom.svg.append(svgElement("polyline", { points: coils.join(" "), fill: "none", stroke: "#475569", "stroke-width": 4, "stroke-linejoin": "round" }));
      const loadVisual = LOAD_VISUALS[state.activeLoadKey];
      if (loadVisual) {
        dom.svg.append(svgElement("rect", { x: 418 - loadVisual.width / 2, y: bottom, width: loadVisual.width, height: loadVisual.height, rx: 4, fill: loadVisual.fill, stroke: loadVisual.stroke, "stroke-width": 2 }));
        dom.svg.append(drawSvgForce(470, bottom + loadVisual.height / 2 + 6, state.activeLoadKey, { "font-size": 16, "font-weight": 700, fill: loadVisual.stroke }));
      } else dom.svg.append(drawText(470, bottom + 16, "無額外負載", { class: "math-svg", "font-size": 15 }));
      const guideLabelAttributes = { class: "math-svg", "font-size": 17, "font-weight": 700, "text-anchor": "end", stroke: "#fff", "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round" };
      const calibrationY = positionToY(state.calibrations[key]?.zeroM ?? state.working.zeroDraftM ?? spring.naturalLengthM);
      dom.svg.append(drawLine(148, calibrationY, 636, calibrationY, { stroke: "#7c3aed", "stroke-dasharray": "6 5", "stroke-width": 2 }), drawText(INVESTIGATION_GUIDE_LABEL_X, calibrationY - 8, "零位", { ...guideLabelAttributes, fill: "#6d28d9" }));
      if (state.activeLoadKey && stable) {
        const cursorY = positionToY(state.working.cursorDraftM ?? state.calibrations[key]?.zeroM ?? endpoint);
        dom.svg.append(drawLine(145, cursorY, 645, cursorY, { stroke: "#dc2626", "stroke-width": 2 }), drawText(INVESTIGATION_GUIDE_LABEL_X, cursorY - 8, "游標", { ...guideLabelAttributes, fill: "#b91c1c" }));
      }
      dom.svg.append(drawSvgAxisLabel(98, 480, "讀尺位置", "", "cm", { "font-size": 15, fill: "#64748b", "font-weight": 700, "text-anchor": "middle" }));
    }
    function drawModelStage() {
      const key = state.activeSpring;
      dom.svg.append(drawSvgFxFormula(36, 32, `${springLabel(key)}・`, " 線性關係", { "font-size": 20, "font-weight": 700 }));
      dom.svg.append(drawLine(GRAPH.left, GRAPH.top + GRAPH.height, GRAPH.left + GRAPH.width, GRAPH.top + GRAPH.height, { stroke: "#334155", "stroke-width": 3 }), drawLine(GRAPH.left, GRAPH.top, GRAPH.left, GRAPH.top + GRAPH.height, { stroke: "#334155", "stroke-width": 3 }));
      dom.svg.append(drawSvgAxisLabel(GRAPH_X_AXIS_LABEL_X, GRAPH_X_AXIS_LABEL_Y, "伸長", "x", "cm", { "font-size": 16, "font-weight": 700, "text-anchor": "middle" }), drawSvgAxisLabel(GRAPH.left - 50, GRAPH.top + 8, "", "F", "N", { "font-size": 16, "font-weight": 700, "text-anchor": "end" }));
      dom.svg.append(drawMathText(GRAPH.left - 34, GRAPH.top + GRAPH.height + 6, [{ text: "0", class: "math-number" }], { "font-size": 15, "font-weight": 700 }));
      for (const forceN of [1, 2, 3, 4]) { const y = GRAPH.top + GRAPH.height - forceN / GRAPH.maxForceN * GRAPH.height; dom.svg.append(drawLine(GRAPH.left - 5, y, GRAPH.left + GRAPH.width, y, { stroke: "#e2e8f0", "stroke-width": 1 }), drawMathText(GRAPH.left - 34, y + 5, [{ text: String(forceN), class: "math-number" }], { "font-size": 15 })); }
      for (const xM of [0, .05, .10, .15, .18]) { const point = graphPoint(xM, 0); dom.svg.append(drawLine(point.x, GRAPH.top + GRAPH.height, point.x, GRAPH.top + GRAPH.height + 5, { stroke: "#334155", "stroke-width": 2 }), drawSvgLength(point.x - 18, GRAPH.top + GRAPH.height + 22, xM, { "font-size": 14 })); }
      for (const row of measuredRows(state, key)) if (row.extensionM !== null) { const point = graphPoint(row.extensionM, row.forceN); dom.svg.append(svgElement("circle", { cx: point.x, cy: point.y, r: 7, fill: "#0f766e" }), drawSvgForce(point.x + 10, point.y + 5, row.loadKey, { "font-size": 14 })); }
      const modelPoint = modelDraftPoint();
      if (modelPoint) {
        dom.svg.append(drawLine(GRAPH.left, GRAPH.top + GRAPH.height, modelPoint.x, modelPoint.y, { stroke: "#2563eb", "stroke-width": 3 }));
        dom.svg.append(drawLine(GRAPH.left, modelPoint.y, modelPoint.x, modelPoint.y, { stroke: "#2563eb", "stroke-dasharray": "5 4", "stroke-width": 1 }));
        dom.svg.append(drawText(modelPoint.x + 10, modelPoint.y - 8, "調整直線", { class: "math-svg", fill: "#1d4ed8", "font-size": 15, "font-weight": 700 }));
      }
    }
    function drawPredictionStage() {
      const spec = scenario.predictions[state.activePredictionIndex];
      const extension = clamp(predictionDraftM, 0, Generator.MAX_LINEAR_EXTENSION_M);
      const loadVisual = predictionLoadVisual(spec.forceN);
      const springEndY = predictionSpringEndY(extension);
      const shortestLoadBottomY = predictionSpringEndY(0) + loadVisual.height;
      const loadBottomY = springEndY + loadVisual.height;
      const maxLoadBottomY = predictionSpringEndY(Generator.MAX_LINEAR_EXTENSION_M) + loadVisual.height;
      const springX = PREDICTION_STAGE.springX;
      const coils = [];
      for (let index = 0; index <= 18; index += 1) {
        const y = PREDICTION_STAGE.springTopY + (springEndY - PREDICTION_STAGE.springTopY) * index / 18;
        const x = springX + (index % 2 ? 26 : -26);
        coils.push(`${x},${y}`);
      }
      dom.svg.append(drawSvgFxFormula(36, 32, `預測 ${state.activePredictionIndex + 1}・${springLabel(spec.springKey)}・`, "負載", { "font-size": 20, "font-weight": 700 }));
      dom.svg.append(drawLine(225, 55, 595, 55, { stroke: "#334155", "stroke-width": 5 }), drawText(605, 61, "固定端／天花板", { class: "math-svg", "font-size": 15, "font-weight": 700 }));
      dom.svg.append(drawLine(springX, 55, springX, PREDICTION_STAGE.springTopY, { stroke: "#94a3b8", "stroke-width": 2 }));
      dom.svg.append(drawLine(PREDICTION_STAGE.guideLeft, shortestLoadBottomY, PREDICTION_STAGE.guideRight, shortestLoadBottomY, { stroke: "#7c3aed", "stroke-dasharray": "6 5", "stroke-width": 2 }), drawMathText(PREDICTION_STAGE.guideLeft + 8, shortestLoadBottomY - 10, ["最短位置（", { text: "x", class: "math-variable" }, " = ", { text: "0", class: "math-number" }, { text: " cm", class: "math-unit" }, "）"], { fill: "#6d28d9", "font-size": 15, "font-weight": 700 }));
      dom.svg.append(drawLine(112, shortestLoadBottomY, 112, maxLoadBottomY, { stroke: "#64748b", "stroke-width": 3 }));
      for (const extensionM of [0, .05, .10, .15, .18]) {
        const y = predictionSpringEndY(extensionM) + loadVisual.height;
        dom.svg.append(drawLine(106, y, 118, y, { stroke: "#64748b", "stroke-width": 2 }), drawSvgLength(100, y + 5, extensionM, { "font-size": 14, "text-anchor": "end" }, 0));
      }
      dom.svg.append(drawSvgAxisLabel(112, 470, "伸長量", "x", "cm", { "font-size": 15, fill: "#64748b", "font-weight": 700, "text-anchor": "middle" }));
      dom.svg.append(svgElement("polyline", { points: coils.join(" "), fill: "none", stroke: "#475569", "stroke-width": 4, "stroke-linejoin": "round" }));
      dom.svg.append(svgElement("rect", { x: springX - loadVisual.width / 2, y: springEndY, width: loadVisual.width, height: loadVisual.height, rx: 4, fill: loadVisual.fill, stroke: loadVisual.stroke, "stroke-width": 2 }));
      dom.svg.append(drawMathText(springX + loadVisual.width / 2 + 14, springEndY + loadVisual.height / 2 + 5, [{ text: n(spec.forceN, 2), class: "math-number" }, { text: " N", class: "math-unit" }], { fill: loadVisual.stroke, "font-size": 16, "font-weight": 700 }));
      const predictionLabelY = Math.min(458, loadBottomY + 24);
      dom.svg.append(drawLine(PREDICTION_STAGE.guideLeft, loadBottomY, PREDICTION_STAGE.guideRight, loadBottomY, { stroke: "#c2410c", "stroke-width": 3 }), drawMathText(PREDICTION_STAGE.guideLeft + 8, predictionLabelY, ["你的預測伸長量 ", { text: (extension * 100).toFixed(0), class: "math-number" }, { text: " cm", class: "math-unit" }], { fill: "#9a3412", "font-size": 15, "font-weight": 700 }));
      dom.svg.append(drawText(440, 470, "只顯示你的預測；提交前不顯示實際終點。", { class: "math-svg", fill: "#64748b", "font-size": 15 }));
    }
    function drawDesignStage() {
      const selected = state.design;
      const calculation = designCalculation();
      const ruler = { x: 96, top: 92, bottom: 410 };
      const springX = 450;
      const maxExtensionM = Generator.MAX_LINEAR_EXTENSION_M;
      const yForExtension = (extensionM) => ruler.top + clamp(extensionM, 0, maxExtensionM) / maxExtensionM * (ruler.bottom - ruler.top);
      const limitY = yForExtension(scenario.design.limitM);
      const endpointY = yForExtension(calculation?.extensionM ?? 0.02);
      const statusColor = calculation ? "#2563eb" : "#64748b";
      const statusFill = calculation ? "#dbeafe" : "#e2e8f0";

      dom.svg.append(drawMathText(36, 32, ["安全承載設計・用你的 ", { text: "F", class: "math-variable" }, " = ", { text: "kx", class: "math-variable" }], { "font-size": 20, "font-weight": 700 }));
      dom.svg.append(drawLine(150, 62, 700, 62, { stroke: "#334155", "stroke-width": 5 }), drawText(710, 68, "固定端／天花板", { class: "math-svg", "font-size": 15, "font-weight": 700 }));

      dom.svg.append(drawLine(ruler.x, ruler.top, ruler.x, ruler.bottom, { stroke: "#64748b", "stroke-width": 3 }));
      for (const extensionM of [0, .05, .10, .15, .18]) {
        const y = yForExtension(extensionM);
        dom.svg.append(drawLine(ruler.x - 7, y, ruler.x + 10, y, { stroke: "#64748b", "stroke-width": 2 }), drawSvgLength(ruler.x - 13, y + 5, extensionM, { "font-size": 14, "text-anchor": "end" }));
      }
      dom.svg.append(drawSvgAxisLabel(ruler.x, 448, "伸長", "x", "cm", { "font-size": 15, fill: "#64748b", "font-weight": 700, "text-anchor": "middle" }));

      dom.svg.append(drawLine(142, limitY, 705, limitY, { stroke: "#dc2626", "stroke-dasharray": "8 5", "stroke-width": 3 }));
      dom.svg.append(drawMathText(148, limitY - 10, ["安全上限 ", { text: "x", class: "math-variable" }, { text: "max", class: "math-variable" }, " = ", { text: (scenario.design.limitM * 100).toFixed(1), class: "math-number" }, { text: " cm", class: "math-unit" }], { fill: "#b91c1c", "font-size": 15, "font-weight": 700 }));

      if (!calculation) {
        dom.svg.append(drawMathText(235, 220, ["先在左側選擇彈簧及負載。"], { "font-size": 20, "font-weight": 700 }), drawText(235, 252, "圖台會用你的斜率預測伸長，再與紅色安全上限比較。", { class: "math-svg", fill: "#64748b", "font-size": 15 }));
        return;
      }

      dom.svg.append(drawSvgKValue(205, 94, calculation.kModelNPerM, { "font-size": 16, "font-weight": 700, fill: "#1d4ed8" }));
      dom.svg.append(drawMathText(205, 118, ["負載 ", { text: "F", class: "math-variable" }, " = ", { text: String(calculation.moduleCount), class: "math-number" }, " × ", { text: "0.5", class: "math-number" }, { text: " N", class: "math-unit" }, " = ", { text: n(calculation.forceN, 1), class: "math-number" }, { text: " N", class: "math-unit" }], { "font-size": 15 }));
      dom.svg.append(drawMathText(205, 142, [{ text: "x", class: "math-variable" }, " = ", { text: "F", class: "math-variable" }, " / ", { text: "k", class: "math-variable" }, " = ", { text: n(calculation.extensionM * 100, 1), class: "math-number" }, { text: " cm", class: "math-unit" }], { "font-size": 15, fill: statusColor, "font-weight": 700 }));

      const coils = [];
      const springEndY = Math.max(72, endpointY - 2);
      for (let index = 0; index <= 18; index += 1) {
        const y = 70 + (springEndY - 70) * index / 18;
        const x = springX + (index % 2 ? 25 : -25);
        coils.push(`${x},${y}`);
      }
      dom.svg.append(drawLine(springX, 62, springX, 70, { stroke: "#94a3b8", "stroke-width": 2 }), svgElement("polyline", { points: coils.join(" "), fill: "none", stroke: "#475569", "stroke-width": 4, "stroke-linejoin": "round" }));
      dom.svg.append(svgElement("rect", { x: springX - 30 - calculation.moduleCount * 2, y: endpointY - 2, width: 60 + calculation.moduleCount * 4, height: 22 + calculation.moduleCount * 2, rx: 4, fill: statusFill, stroke: statusColor, "stroke-width": 2 }));
      dom.svg.append(drawMathText(springX + 52, endpointY + 14, [springLabel(calculation.springKey), "・", { text: n(calculation.forceN, 1), class: "math-number" }, { text: " N", class: "math-unit" }], { fill: statusColor, "font-size": 15, "font-weight": 700 }));
      dom.svg.append(drawLine(142, endpointY, 705, endpointY, { stroke: statusColor, "stroke-width": 2, "stroke-dasharray": "4 4" }), drawMathText(148, Math.min(ruler.bottom + 25, endpointY + 26), ["你的模型預測末端：", { text: n(calculation.extensionM * 100, 1), class: "math-number" }, { text: " cm", class: "math-unit" }], { fill: statusColor, "font-size": 15, "font-weight": 700 }));

      const moduleStartX = 245;
      const moduleY = 470;
      dom.svg.append(drawMathText(moduleStartX, moduleY, ["負載模組：", { text: String(calculation.moduleCount), class: "math-number" }, " 個 × ", { text: "0.5", class: "math-number" }, { text: " N", class: "math-unit" }], { "font-size": 15, "font-weight": 700 }));
      for (let index = 0; index < calculation.moduleCount; index += 1) {
        const x = moduleStartX + 112 + index * 42;
        dom.svg.append(svgElement("rect", { x, y: moduleY - 19, width: 34, height: 22, rx: 3, fill: "#64748b" }));
      }
    }
    function drawReviewStage() {
      dom.svg.append(drawText(36, 32, "提交前 review・圖台只顯示你的答案", { class: "math-svg", "font-size": 20, "font-weight": 700 }));
      dom.svg.append(drawText(270, 215, "請在左側檢查完整答案及依賴資料。", { class: "math-svg", "font-size": 20, "font-weight": 700 }), drawText(276, 250, "提交後才會顯示正確性、分數及實際測試。", { class: "math-svg", fill: "#64748b", "font-size": 16 }));
    }
    function drawResultStage() {
      const view = buildResultViewModel(state, scenario, latestResult);
      dom.svg.append(drawText(36, 32, "已鎖定結果・揭示理想模型與實際測試", { "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawText(260, 160, `總分 ${view.score} / 100`, { "font-size": 32, "font-weight": 800, fill: "#1d4ed8" }), drawText(260, 205, view.passed ? "達到合格條件" : "未達到合格條件", { "font-size": 18, "font-weight": 700 }));
      dom.svg.append(drawText(260, 270, "結果已鎖定，這個 attempt 不能再修改。", { "font-size": 14, fill: "#475569" }));
      dom.svg.append(drawMathText(260, 298, ["A：理想 ", { text: "k", class: "math-variable" }, " = ", { text: n(view.trueSprings.A.kNPerM, 1), class: "math-number" }, { text: " N/m", class: "math-unit" }], { "font-size": 14, fill: "#475569" }), drawMathText(430, 298, ["B：理想 ", { text: "k", class: "math-variable" }, " = ", { text: n(view.trueSprings.B.kNPerM, 1), class: "math-number" }, { text: " N/m", class: "math-unit" }], { "font-size": 14, fill: "#475569" }));
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
      const stageDescription = mayRevealCorrectness(presentation)
        ? "提交後的鎖定結果圖台，包含理想模型及實際測試結果。"
        : state?.phase === "predict"
          ? "第三階段圖台顯示題目指定的彈簧和負載；拖動預測標記會令彈簧和負載一起伸長或縮短，提交前不顯示實際終點。"
          : state?.phase === "design"
            ? "第四階段用你第二階段建立的斜率計算 x = F/k；紅色虛線是安全伸長上限，請在安全方案中找出負載最大的方案。"
          : "圖台只顯示目前可觀察的探究現象、學生自己的資料或學生自己的標記；提交前不顯示正確性。";
      setText($("stageDescription"), stageDescription);
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
        const point = modelDraftPoint(); const target = toPercent(point.x, point.y);
        setDrag(dom.modelDrag, true, target[0], target[1], "調整直線斜率；可在圖中上下左右移動，方向鍵也可微調", "線");
      } else if (state.phase === "predict") {
        const spec = scenario.predictions[state.activePredictionIndex];
        const loadVisual = predictionLoadVisual(spec.forceN);
        const target = toPercent(PREDICTION_STAGE.springX + loadVisual.width / 2 + 55, predictionSpringEndY(predictionDraftM));
        setDrag(dom.predictionDrag, true, target[0], target[1], "預測標記；拖動會令彈簧和負載一起伸長或縮短，上下方向鍵可微調", "預");
      }
      if (focusedTarget && !focusedTarget.hidden) focusedTarget.focus({ preventScroll: true });
    }
    function coordinateFromEvent(event) {
      const point = clientToSvg(dom.svg, event.clientX, event.clientY);
      return { x: clamp(point.x, 0, 800), y: clamp(point.y, 0, 500) };
    }
    function valueFromPoint(kind, point) {
      if (kind === "zero" || kind === "cursor") return clamp((point.y - INVESTIGATION_RULER_TOP) / (INVESTIGATION_RULER_BOTTOM - INVESTIGATION_RULER_TOP) * Generator.STAGE_SPAN_M, 0, Generator.STAGE_SPAN_M);
      if (kind === "model") return modelValueFromPoint(point).handleExtensionM;
      if (kind === "prediction") return snapPredictionValue(clamp((point.y - PREDICTION_STAGE.shortestSpringEndY) / PREDICTION_STAGE.extensionPixels, 0, 1) * Generator.MAX_LINEAR_EXTENSION_M);
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
      drag = { kind, target, pointerId: event.pointerId, startValue: current, startModelForceN: kind === "model" ? modelDraftForceN : null, lastValue: current, startPoint: point };
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
      if (drag.kind === "model") {
        const modelValue = modelValueFromPoint(point);
        modelDraftM = modelValue.handleExtensionM;
        modelDraftForceN = modelValue.forceN;
        drag.lastValue = modelDraftM;
        const delta = Math.max(Math.abs(modelDraftM - drag.startValue), Math.abs(modelDraftForceN - drag.startModelForceN) / GRAPH.maxForceN * Generator.MAX_LINEAR_EXTENSION_M);
        modelMoveM = Math.max(modelMoveM, delta);
        modelMode = "pointer";
        render();
        return;
      }
      const rawValue = valueFromPoint(drag.kind, point);
      const value = drag.kind === "zero" || drag.kind === "cursor" ? snapMeasurementPosition(drag.kind, rawValue) : rawValue;
      drag.lastValue = value;
      const delta = Math.abs(rawValue - drag.startValue);
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
      else if (snapshot.kind === "model") { modelDraftM = snapshot.startValue; modelDraftForceN = snapshot.startModelForceN; }
      else predictionDraftM = snapshot.startValue;
      zeroMoveM = cursorMoveM = modelMoveM = predictionMoveM = 0;
      render();
      announce("操作被取消；已回復拖動前的語意狀態。");
    }
    function keyboardAdjust(event, kind, target) {
      if (locked || presentation !== "editable" || !target) return;
      const vertical = kind === "zero" || kind === "cursor" || kind === "prediction";
      const allowed = kind === "model" ? ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] : vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
      if (!allowed.includes(event.key)) return;
      event.preventDefault();
      const step = kind === "prediction" ? PREDICTION_SNAP_STEP_M : event.shiftKey ? .005 : .001; const direction = (event.key === "ArrowUp" || event.key === "ArrowRight") ? 1 : -1;
      if (kind === "zero") { const before = state.working.zeroDraftM; const rawValue = clamp(before + direction * step, 0, Generator.STAGE_SPAN_M); state.working.zeroDraftM = snapMeasurementPosition(kind, rawValue); zeroMoveM = Math.min(Generator.STAGE_SPAN_M, zeroMoveM + Math.abs(rawValue - before)); zeroMode = "keyboard"; }
      else if (kind === "cursor") { const before = state.working.cursorDraftM; const rawValue = clamp(before + direction * step, 0, Generator.STAGE_SPAN_M); state.working.cursorDraftM = snapMeasurementPosition(kind, rawValue); cursorMoveM = Math.min(Generator.STAGE_SPAN_M, cursorMoveM + Math.abs(rawValue - before)); cursorMode = "keyboard"; }
      else if (kind === "model") {
        const beforeM = modelDraftM; const beforeForceN = modelDraftForceN;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") modelDraftForceN = clamp(beforeForceN + direction * (event.shiftKey ? .5 : .1), MODEL_MIN_POINT_FORCE_N, GRAPH.maxForceN);
        else modelDraftM = clamp(beforeM + direction * step, Model.MIN_EXTENSION_M, Generator.MAX_LINEAR_EXTENSION_M);
        modelMoveM = Math.min(Generator.MAX_LINEAR_EXTENSION_M, modelMoveM + Math.max(Math.abs(modelDraftM - beforeM), Math.abs(modelDraftForceN - beforeForceN) / GRAPH.maxForceN * Generator.MAX_LINEAR_EXTENSION_M));
        modelMode = "keyboard";
      }
      else { const before = snapPredictionValue(predictionDraftM); predictionDraftM = snapPredictionValue(clamp(before + direction * step, 0, Generator.MAX_LINEAR_EXTENSION_M)); predictionMoveM = Math.min(Generator.MAX_LINEAR_EXTENSION_M, predictionMoveM + Math.abs(predictionDraftM - before)); predictionMode = "keyboard"; }
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
        else if (action === "navigate-phase") goPhase(actionNode.dataset.phase);
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
      dom.debugComplete?.addEventListener("change", (event) => {
        if (!debugAvailable) return;
        const checkbox = event.currentTarget;
        if (!checkbox.checked) {
          debugEnabled = false;
          renderDebugPanel();
          announce("調試模式已關閉；已填入的第一階段數據不會清除。 ");
          return;
        }
        if (!completeInvestigationForDebug()) {
          debugEnabled = false;
          checkbox.checked = false;
          renderDebugPanel();
        }
      });
      dom.debugCompleteModel?.addEventListener("click", () => {
        if (!completeModelForDebug()) renderDebugPanel();
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
      interactionEvidence: () => ({ zeroMoveM, cursorMoveM, modelMoveM, modelDraftM, modelDraftForceN, predictionMoveM, predictionDraftM, stable, locked, selectedLoadKey, debugAvailable, debugEnabled })
    };
  }

  return { ACTIVITY, PHASE_LABELS, mayRevealCorrectness, debugQueryEnabled, buildEditableViewModel, buildResultViewModel, routeStartup, routeSubmission, investigationEndpointM, INVESTIGATION_DRAG_HANDLE_X, INVESTIGATION_GUIDE_LABEL_X, INVESTIGATION_RULER_TOP, INVESTIGATION_RULER_BOTTOM, MEASUREMENT_SNAP_THRESHOLD_M, GRAPH_X_AXIS_LABEL_X, GRAPH_X_AXIS_LABEL_Y, PREDICTION_STAGE, PREDICTION_LOAD_VISUALS, PREDICTION_SNAP_STEP_M, snapMeasurementValue, snapPredictionValue, predictionLoadVisual, LOAD_VISUALS, freshSeed, clientToSvg, svgToClient, boot };
});
