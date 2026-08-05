(function (root, factory) {
  const api = factory(
    root?.HookesLawGenerator || (typeof require === "function" ? require("./generator.js") : null),
    root?.HookesLawModel || (typeof require === "function" ? require("./model.js") : null),
    root?.HookesLawScoring || (typeof require === "function" ? require("./scoring.js") : null)
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HookesLawPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model, Scoring) {
  "use strict";

  const ACTIVITY = "hookes-law-spring-investigation-lab";
  const SCHEMA_VERSION = 1;
  const GENERATOR_VERSION = 3;
  const RUBRIC_VERSION = 2;
  const PHASES = Object.freeze(["investigate", "model", "predict", "design", "review"]);
  const LOAD_KEYS = Object.freeze(["F1", "F2", "F3"]);
  const SPRINGS = Object.freeze(["A", "B"]);
  const MODES = Object.freeze(["pointer", "keyboard"]);
  const MAX_SNAPSHOT_BYTES = 4000;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function finite(value) { return Number.isFinite(value); }
  function exactKeys(value, keys) {
    return value && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(value).sort().join("|") === keys.slice().sort().join("|");
  }
  function nullableFinite(value) { return value === null || finite(value); }
  function validSeed(seed) { return Generator.validateSeed(seed); }
  function validMode(mode) { return MODES.includes(mode); }
  function emptyMeasurements() {
    return { F1: null, F2: null, F3: null };
  }
  function freshState(seed) {
    if (!validSeed(seed)) throw new Error("Invalid seed");
    return {
      schemaVersion: SCHEMA_VERSION,
      generatorVersion: GENERATOR_VERSION,
      rubricVersion: RUBRIC_VERSION,
      seed,
      phase: "investigate",
      fromReview: false,
      activeSpring: "A",
      activeLoadKey: null,
      activePredictionIndex: 0,
      calibrations: { A: null, B: null },
      measurements: { A: emptyMeasurements(), B: emptyMeasurements() },
      models: { A: null, B: null },
      predictions: [null, null, null],
      design: null,
      working: { zeroDraftM: 0.045, cursorDraftM: null }
    };
  }

  function calibrationValid(record, scenario, springKey) {
    return record === null || (exactKeys(record, ["zeroM", "mode", "moveM"]) &&
      validMode(record.mode) && finite(record.zeroM) && finite(record.moveM) &&
      record.moveM >= Model.MIN_OPERATION_MOVE_M - Model.FLOAT_EPSILON && record.zeroM >= 0 && record.zeroM <= scenario.stage.spanM + Model.FLOAT_EPSILON &&
      Scoring.validCalibration(record, scenario, springKey));
  }
  function measurementValid(record, scenario, springKey, loadKey, calibration) {
    return record === null || (exactKeys(record, ["loadKey", "cursorM", "mode", "moveM"]) &&
      record.loadKey === loadKey && validMode(record.mode) && finite(record.cursorM) && finite(record.moveM) &&
      record.moveM >= Model.MIN_OPERATION_MOVE_M - Model.FLOAT_EPSILON && record.cursorM >= 0 && record.cursorM <= scenario.stage.spanM + Model.FLOAT_EPSILON &&
      calibration !== null && record.cursorM >= calibration.zeroM - Model.FLOAT_EPSILON &&
      Scoring.validMeasurement(record, scenario, springKey, loadKey));
  }
  function modelValid(record, scenario) {
    return record === null || (exactKeys(record, ["handleExtensionM"]) && Scoring.validModel(record, scenario));
  }
  function sameModelHandle(first, second) {
    return finite(first) && finite(second) && Math.abs(first - second) <= Model.FLOAT_EPSILON;
  }
  function sameMeasurement(first, second) {
    return Boolean(first && second && first.loadKey === second.loadKey && finite(first.cursorM) && finite(second.cursorM) &&
      Math.abs(first.cursorM - second.cursorM) <= Model.FLOAT_EPSILON);
  }
  function predictionValid(record, scenario) {
    return record === null || (exactKeys(record, ["extensionM"]) && Scoring.validPrediction(record, scenario));
  }
  function designValid(record, scenario) {
    return record === null || (exactKeys(record, ["springKey", "moduleCount"]) && Scoring.validDesign(record, scenario));
  }

  function hasCalibration(state, springKey) { return state.calibrations[springKey] !== null; }
  function hasAllMeasurements(state, springKey) { return LOAD_KEYS.every((loadKey) => state.measurements[springKey][loadKey] !== null); }
  function hasAllCalibrationsAndMeasurements(state) { return SPRINGS.every((key) => hasCalibration(state, key) && hasAllMeasurements(state, key)); }
  function hasAllModels(state) { return SPRINGS.every((key) => state.models[key] !== null); }
  function hasAllPredictions(state) { return state.predictions.every((prediction) => prediction !== null); }
  function hasCompleteAnswer(state, scenario) { return hasAllCalibrationsAndMeasurements(state) && hasAllModels(state) && hasAllPredictions(state) && state.design !== null && Scoring.completeEvidence(state, scenario); }

  function validateWorking(state, scenario) {
    if (!exactKeys(state.working, ["zeroDraftM", "cursorDraftM"])) return false;
    if (!nullableFinite(state.working.zeroDraftM) || !nullableFinite(state.working.cursorDraftM)) return false;
    if (state.working.zeroDraftM !== null && (state.working.zeroDraftM < 0 || state.working.zeroDraftM > scenario.stage.spanM)) return false;
    if (state.working.cursorDraftM !== null && (state.working.cursorDraftM < 0 || state.working.cursorDraftM > scenario.stage.spanM)) return false;
    if (state.working.cursorDraftM !== null && state.working.zeroDraftM !== null && state.working.cursorDraftM < state.working.zeroDraftM - Model.FLOAT_EPSILON) return false;
    return true;
  }

  function validatePhaseMatrix(state, scenario) {
    const allMeasurements = hasAllCalibrationsAndMeasurements(state);
    const allModels = hasAllModels(state);
    const allPredictions = hasAllPredictions(state);
    const downstreamAllowed = state.fromReview;
    const modelsMatchEvidence = SPRINGS.every((key) => state.models[key] === null || (hasCalibration(state, key) && hasAllMeasurements(state, key)));
    if (!PHASES.includes(state.phase)) return false;
    if (state.phase === "review") {
      return !state.fromReview && allMeasurements && allModels && allPredictions && state.design !== null && hasCompleteAnswer(state, scenario) && state.working.zeroDraftM === null && state.working.cursorDraftM === null;
    }
    if (state.phase === "investigate") {
      if (!modelsMatchEvidence || (!downstreamAllowed && (state.predictions.some(Boolean) || state.design !== null))) return false;
      return true;
    }
    if (state.phase === "model") {
      if (!allMeasurements || (!downstreamAllowed && (state.predictions.some(Boolean) || state.design !== null))) return false;
      return true;
    }
    if (state.phase === "predict") {
      if (!allModels || (!downstreamAllowed && state.design !== null)) return false;
      return true;
    }
    if (state.phase === "design") {
      if (!allModels || !allPredictions) return false;
      return true;
    }
    return false;
  }

  function validateAnswer(answer, scenario, options = {}) {
    if (!answer || typeof answer !== "object" || Array.isArray(answer) || !scenario) return { ok: false, reason: "shape" };
    if (!exactKeys(answer, ["schemaVersion", "generatorVersion", "rubricVersion", "seed", "phase", "fromReview", "activeSpring", "activeLoadKey", "activePredictionIndex", "calibrations", "measurements", "models", "predictions", "design", "working"])) return { ok: false, reason: "keys" };
    if (answer.schemaVersion !== SCHEMA_VERSION || answer.generatorVersion !== GENERATOR_VERSION || answer.rubricVersion !== RUBRIC_VERSION || !validSeed(answer.seed) || answer.seed !== scenario.seed) return { ok: false, reason: "version-or-seed" };
    if (!PHASES.includes(answer.phase) || typeof answer.fromReview !== "boolean" || !SPRINGS.includes(answer.activeSpring) ||
      !(answer.activeLoadKey === null || LOAD_KEYS.includes(answer.activeLoadKey)) || !Number.isInteger(answer.activePredictionIndex) || answer.activePredictionIndex < 0 || answer.activePredictionIndex > 2) return { ok: false, reason: "enum" };
    if (!exactKeys(answer.calibrations, SPRINGS) || !exactKeys(answer.measurements, SPRINGS) || !exactKeys(answer.models, SPRINGS) || !Array.isArray(answer.predictions) || answer.predictions.length !== 3) return { ok: false, reason: "collections" };
    if (!exactKeys(answer.measurements.A, LOAD_KEYS) || !exactKeys(answer.measurements.B, LOAD_KEYS) || !exactKeys(answer.models, SPRINGS) || !exactKeys(answer.calibrations, SPRINGS)) return { ok: false, reason: "relationship-keys" };
    if (!calibrationValid(answer.calibrations.A, scenario, "A") || !calibrationValid(answer.calibrations.B, scenario, "B")) return { ok: false, reason: "calibration" };
    for (const springKey of SPRINGS) for (const loadKey of LOAD_KEYS) if (!measurementValid(answer.measurements[springKey][loadKey], scenario, springKey, loadKey, answer.calibrations[springKey])) return { ok: false, reason: "measurement" };
    if (!modelValid(answer.models.A, scenario) || !modelValid(answer.models.B, scenario) || !answer.predictions.every((record) => predictionValid(record, scenario)) || !designValid(answer.design, scenario) || !validateWorking(answer, scenario)) return { ok: false, reason: "numeric" };
    if (answer.phase !== "investigate" && answer.activeLoadKey !== null) return { ok: false, reason: "active-load-phase" };
    if (answer.phase !== "predict" && answer.activePredictionIndex !== 0) return { ok: false, reason: "active-prediction-phase" };
    if (options.kind === "review" && answer.phase !== "review") return { ok: false, reason: "review-phase" };
    if (options.kind === "draft" && answer.phase === "review") return { ok: false, reason: "draft-review-phase" };
    if (!validatePhaseMatrix(answer, scenario)) return { ok: false, reason: "phase-matrix" };
    return { ok: true };
  }

  function normalizeForReview(state) {
    const review = clone(state);
    review.phase = "review";
    review.fromReview = false;
    review.activeLoadKey = null;
    review.activePredictionIndex = 0;
    review.working = { zeroDraftM: null, cursorDraftM: null };
    return review;
  }

  function answerForSnapshot(state, kind, scenario) {
    const answer = kind === "review" ? normalizeForReview(state) : clone(state);
    const result = validateAnswer(answer, scenario, { kind });
    if (!result.ok) throw new Error(`Cannot encode invalid ${kind} answer: ${result.reason}`);
    return answer;
  }

  function snapshotBytes(value) {
    const json = JSON.stringify(value);
    return typeof TextEncoder === "function" ? new TextEncoder().encode(json).length : Buffer.byteLength(json, "utf8");
  }

  function makeSnapshot(kind, state, scenario, result) {
    if (kind !== "draft" && kind !== "review") throw new Error("Unsupported snapshot kind");
    const answer = answerForSnapshot(state, kind, scenario);
    const snapshot = { version: 1, activity: ACTIVITY, kind, answer };
    if (result) { snapshot.score = Number(result.score); snapshot.passed = Boolean(result.passed); }
    if (snapshotBytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds 4000 UTF-8 bytes");
    return snapshot;
  }

  function decodeSnapshot(snapshot, scenario, expectedKind) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || !["draft", "review"].includes(snapshot.kind) || (expectedKind && snapshot.kind !== expectedKind)) throw new Error("Invalid snapshot envelope");
    const validation = validateAnswer(snapshot.answer, scenario, { kind: snapshot.kind });
    if (!validation.ok) throw new Error(`Invalid ${snapshot.kind} answer: ${validation.reason}`);
    return clone(snapshot.answer);
  }

  function normalizePhase(state) {
    const next = clone(state);
    if (next.phase === "review") return next;
    if (!hasAllCalibrationsAndMeasurements(next)) next.phase = "investigate";
    else if (!hasAllModels(next)) next.phase = "model";
    else if (!hasAllPredictions(next)) next.phase = "predict";
    else next.phase = "design";
    next.activeLoadKey = next.phase === "investigate" ? next.activeLoadKey : null;
    next.activePredictionIndex = next.phase === "predict" ? next.activePredictionIndex : 0;
    return next;
  }

  function apply(state, event, scenario) {
    const original = clone(state);
    const before = validateAnswer(original, scenario, { kind: original.phase === "review" ? "review" : "draft" });
    if (!before.ok) throw new Error(`Cannot transition invalid state: ${before.reason}`);
    const next = clone(original);
    const { springKey, loadKey } = event || {};
    if (["clearCalibration", "replaceCalibration", "replaceMeasurement", "replaceModel"].includes(event?.type) && !SPRINGS.includes(springKey)) throw new Error("Invalid spring key");
    if (event.type === "clearCalibration") {
      next.calibrations[springKey] = null;
      next.measurements[springKey] = emptyMeasurements();
      next.models[springKey] = null;
      next.predictions = [null, null, null];
      next.design = null;
      next.activeSpring = springKey;
      next.activeLoadKey = null;
      next.activePredictionIndex = 0;
      next.phase = "investigate";
      next.fromReview = false;
      next.working = { zeroDraftM: 0.045, cursorDraftM: null };
    } else if (event.type === "replaceCalibration") {
      if (!event.evidence || !calibrationValid(event.evidence, scenario, springKey)) throw new Error("Invalid calibration evidence");
      next.calibrations[springKey] = { zeroM: event.evidence.zeroM, mode: event.evidence.mode, moveM: event.evidence.moveM };
      next.measurements[springKey] = emptyMeasurements();
      next.models[springKey] = null;
      next.predictions = [null, null, null];
      next.design = null;
      next.working = { zeroDraftM: event.evidence.zeroM, cursorDraftM: null };
      next.activeSpring = springKey;
      next.activeLoadKey = null;
      next.activePredictionIndex = 0;
      next.phase = "investigate";
      next.fromReview = false;
    } else if (event.type === "replaceMeasurement") {
      if (!LOAD_KEYS.includes(loadKey) || !measurementValid(event.evidence, scenario, springKey, loadKey, next.calibrations[springKey])) throw new Error("Invalid measurement evidence");
      if (sameMeasurement(next.measurements[springKey][loadKey], event.evidence)) return original;
      next.measurements[springKey][loadKey] = { loadKey, cursorM: event.evidence.cursorM, mode: event.evidence.mode, moveM: event.evidence.moveM };
      next.models[springKey] = null;
      next.predictions = [null, null, null];
      next.design = null;
      next.activeSpring = springKey;
      next.activeLoadKey = loadKey;
      next.working = { zeroDraftM: next.calibrations[springKey].zeroM, cursorDraftM: event.evidence.cursorM };
      next.phase = "investigate";
      next.fromReview = false;
    } else if (event.type === "replaceModel") {
      if (!event.evidence || !modelValid(event.evidence, scenario)) throw new Error("Invalid model evidence");
      if (sameModelHandle(next.models[springKey]?.handleExtensionM, event.evidence.handleExtensionM)) return original;
      next.models[springKey] = { handleExtensionM: event.evidence.handleExtensionM };
      next.predictions = [null, null, null];
      next.design = null;
      next.activeSpring = springKey;
      next.activeLoadKey = null;
      next.activePredictionIndex = 0;
      next.fromReview = false;
      next.phase = "model";
    } else if (event.type === "replacePrediction") {
      if (!Number.isInteger(event.index) || event.index < 0 || event.index >= 3 || !predictionValid(event.evidence, scenario)) throw new Error("Invalid prediction evidence");
      next.predictions[event.index] = { extensionM: event.evidence.extensionM };
      next.design = next.design;
      next.activePredictionIndex = event.index;
      next.activeLoadKey = null;
      next.phase = "predict";
    } else if (event.type === "replaceDesign") {
      if (!designValid(event.design, scenario)) throw new Error("Invalid design evidence");
      next.design = { springKey: event.design.springKey, moduleCount: event.design.moduleCount };
      next.activeLoadKey = null;
      next.activePredictionIndex = 0;
      next.fromReview = false;
      next.phase = "design";
    } else if (event.type === "setPhase") {
      const phase = event.phase;
      if (!PHASES.includes(phase)) throw new Error("Invalid phase transition");
      if (phase === "model" && !hasAllCalibrationsAndMeasurements(next)) throw new Error("Model prerequisites incomplete");
      if (phase === "predict" && !hasAllModels(next)) throw new Error("Prediction prerequisites incomplete");
      if (phase === "design" && (!hasAllModels(next) || !hasAllPredictions(next))) throw new Error("Design prerequisites incomplete");
      if (phase === "review" && !hasCompleteAnswer(next, scenario)) throw new Error("Review prerequisites incomplete");
      next.phase = phase;
      next.activeLoadKey = null;
      next.activePredictionIndex = 0;
      if (PHASES.indexOf(phase) < PHASES.indexOf(original.phase)) next.fromReview = true;
      if (phase !== "investigate") next.working = { zeroDraftM: null, cursorDraftM: null };
      if (phase === "review") { next.fromReview = false; next.working = { zeroDraftM: null, cursorDraftM: null }; }
    } else if (event.type === "editSection") {
      if (original.phase !== "review" || !["investigate", "model", "predict", "design"].includes(event.phase)) throw new Error("Invalid review edit");
      next.phase = event.phase;
      next.fromReview = true;
      next.activeLoadKey = null;
      next.activePredictionIndex = 0;
      next.working = { zeroDraftM: null, cursorDraftM: null };
    } else {
      throw new Error("Unknown persistence event");
    }
    const validation = validateAnswer(next, scenario, { kind: next.phase === "review" ? "review" : "draft" });
    if (!validation.ok) throw new Error(`Transition produced invalid state: ${validation.reason}`);
    return next;
  }

  return {
    ACTIVITY,
    SCHEMA_VERSION,
    GENERATOR_VERSION,
    RUBRIC_VERSION,
    PHASES,
    LOAD_KEYS,
    SPRINGS,
    MODES,
    MAX_SNAPSHOT_BYTES,
    freshState,
    clone,
    validateAnswer,
    hasAllCalibrationsAndMeasurements,
    hasAllModels,
    hasAllPredictions,
    hasCompleteAnswer,
    normalizeForReview,
    answerForSnapshot,
    snapshotBytes,
    makeSnapshot,
    decodeSnapshot,
    normalizePhase,
    sameModelHandle,
    sameMeasurement,
    apply,
    transitions: Object.freeze({
      replaceCalibration: (state, springKey, evidence, scenario) => apply(state, { type: "replaceCalibration", springKey, evidence }, scenario),
      clearCalibration: (state, springKey, scenario) => apply(state, { type: "clearCalibration", springKey }, scenario),
      replaceMeasurement: (state, springKey, loadKey, evidence, scenario) => apply(state, { type: "replaceMeasurement", springKey, loadKey, evidence }, scenario),
      replaceModel: (state, springKey, handleExtensionM, scenario) => apply(state, { type: "replaceModel", springKey, evidence: { handleExtensionM } }, scenario),
      replacePrediction: (state, index, extensionM, scenario) => apply(state, { type: "replacePrediction", index, evidence: { extensionM } }, scenario),
      replaceDesign: (state, springKey, moduleCount, scenario) => apply(state, { type: "replaceDesign", design: { springKey, moduleCount } }, scenario),
      setPhase: (state, phase, scenario) => apply(state, { type: "setPhase", phase }, scenario),
      editSection: (state, phase, scenario) => apply(state, { type: "editSection", phase }, scenario)
    })
  };
});
