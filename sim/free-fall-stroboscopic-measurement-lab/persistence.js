(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.FreeFallModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.FreeFallScoring;
  const api = factory(model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, Scoring) {
  "use strict";

  const VERSION = 1;
  const MEASUREMENT_KEYS = Object.freeze([...Scoring.TOTAL_KEYS, ...Scoring.GAP_KEYS]);
  const PHASES = Object.freeze(["setup", "measure-total", "measure-interval", "analyze", "review"]);
  const TOTAL_VARIANTS = Object.freeze(["normal-unpositioned", "normal-placement-ready", "review-edit-unpositioned", "review-edit-placement-ready"]);
  const ANALYZE_VARIANTS = Object.freeze(["normal", "review-edit"]);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const exactKeys = (value, keys) => Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => own(value, key)));
  const finite = Model.finite;
  const MIN_GEOMETRY_PX_PER_M = 8;
  const MAX_GEOMETRY_PX_PER_M = 1000;

  function initialState() {
    return {
      v: VERSION, modelVersion: Model.MODEL_VERSION, rubricVersion: Scoring.RUBRIC_VERSION,
      phase: "setup", variant: "new", currentStep: "setup", returnToReview: false,
      frequencyHz: null, frequencyActivelySelected: false
    };
  }
  function configuredState(frequencyHz) {
    if (!Model.validFrequency(frequencyHz)) return null;
    return {
      ...initialState(), variant: "configured", frequencyHz,
      frequencyActivelySelected: true
    };
  }
  function emptyMeasurements() { return Object.fromEntries(MEASUREMENT_KEYS.map((key) => [key, null])); }
  function emptyAnalysis() {
    return {
      deltaTS: null, cumulativeTimeRatio: null, totalDisplacementRatio: null,
      intervalTimeRatio: null, intervalDistanceRatio: null, lawAnswerId: null,
      intervalLawAnswerId: null, accelerationAnswerId: null
    };
  }
  function generate(state) {
    if (!validateDraft(state) || state.phase !== "setup" || state.variant !== "configured") return null;
    return {
      ...clone(state), phase: "measure-total", variant: "normal-unpositioned",
      currentStep: 0, generated: true, measurements: emptyMeasurements(),
      evidence: { setupCompleted: true }, analysis: emptyAnalysis()
    };
  }
  function validReading(item, cameraMaxM) {
    if (item === null) return "unresolved";
    if (!item || !["recorded", "skipped"].includes(item.status)) return "invalid";
    if (item.status === "skipped") return exactKeys(item, ["status"]) ? "skipped" : "invalid";
    const keys = Object.keys(item);
    if (!keys.every((key) => ["status", "readingM", "usedTotalPlacement"].includes(key)) ||
        !finite(item.readingM) || item.readingM < 0 || item.readingM > cameraMaxM ||
        (own(item, "usedTotalPlacement") && typeof item.usedTotalPlacement !== "boolean")) return "invalid";
    return "recorded";
  }
  function taskStartM(task, frequencyHz) {
    if (task === "total") return 0;
    const index = Scoring.GAP_KEYS.indexOf(task);
    return index >= 0 ? Model.displacementAt(frequencyHz, index) : null;
  }
  function consistentRulerGeometry(rulerZeroM, zeroErrorPx, task, frequencyHz) {
    const targetM = taskStartM(task, frequencyHz);
    if (!finite(targetM) || rulerZeroM < 0 || rulerZeroM > Model.cameraMax(frequencyHz)) return false;
    const displacementM = rulerZeroM - targetM;
    if (Math.abs(displacementM) < 1e-12) return Math.abs(zeroErrorPx) < 1e-9;
    if (Math.sign(displacementM) !== Math.sign(zeroErrorPx)) return false;
    const pixelsPerMeter = Math.abs(zeroErrorPx / displacementM);
    return pixelsPerMeter >= MIN_GEOMETRY_PX_PER_M && pixelsPerMeter <= MAX_GEOMETRY_PX_PER_M;
  }
  function validPlacementShape(value, expectedTask, frequencyHz) {
    if (!value || !["pointer", "keyboard"].includes(value.mode) || value.task !== expectedTask ||
        ![value.moveNorm, value.rulerZeroM, value.edgeGapPx, value.zeroErrorPx].every(finite) ||
        value.moveNorm < 0 || value.moveNorm > 1 ||
        value.edgeGapPx < 0 || value.edgeGapPx > 200 || Math.abs(value.zeroErrorPx) > 500 ||
        !["left", "right"].includes(value.edgeSide) ||
        !consistentRulerGeometry(value.rulerZeroM, value.zeroErrorPx, expectedTask, frequencyHz)) return false;
    return Object.keys(value).every((key) => ["task", "mode", "moveNorm", "rulerZeroM", "edgeSide", "edgeGapPx", "zeroErrorPx"].includes(key));
  }
  function validTotalEvidence(value, frequencyHz) {
    return Boolean(value && ["pointer", "keyboard"].includes(value.mode) &&
      [value.moveNorm, value.rulerZeroM, value.zeroErrorPx, value.edgeGapPx].every(finite) &&
      consistentRulerGeometry(value.rulerZeroM, value.zeroErrorPx, "total", frequencyHz) &&
      ["left", "right"].includes(value.edgeSide) &&
      Scoring.totalPlacementValid({ task: "total", ...value }) &&
      Object.keys(value).every((key) => ["mode", "moveNorm", "rulerZeroM", "edgeSide", "zeroErrorPx", "edgeGapPx"].includes(key)));
  }
  function validGapEvidence(value, task, reading) {
    return Boolean(value && Object.keys(value).every((key) => ["mode", "moveNorm", "zeroErrorPx", "edgeGapPx", "readingM", "usedWhileValid", "task"].includes(key)) &&
      value.task === task && value.usedWhileValid === true && Scoring.gapEvidenceValid(value, task, reading));
  }
  function positiveReadings(measurements, keys) {
    return keys.every((key) => measurements[key]?.status === "recorded" && finite(measurements[key].readingM) && measurements[key].readingM > 0);
  }
  function validRatio(value, allowInsufficient, hasSources) {
    if (!value || !["answered", "insufficient-data"].includes(value.status)) return false;
    if (value.status === "insufficient-data") return allowInsufficient && !hasSources && exactKeys(value, ["status"]);
    return exactKeys(value, ["status", "values"]) && Array.isArray(value.values) && value.values.length === 4 &&
      value.values[0] === 1 && value.values.every((term) => finite(term) && term > 0);
  }
  function analysisFieldValid(analysis, measurements, complete) {
    if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) return false;
    const allowed = ["deltaTS", "cumulativeTimeRatio", "totalDisplacementRatio", "intervalTimeRatio",
      "intervalDistanceRatio", "lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"];
    if (!Object.keys(analysis).every((key) => allowed.includes(key))) return false;
    const totalSources = positiveReadings(measurements, Scoring.TOTAL_KEYS);
    const gapSources = positiveReadings(measurements, Scoring.GAP_KEYS);
    const checks = [
      analysis.deltaTS == null || (finite(analysis.deltaTS) && analysis.deltaTS >= 0 && analysis.deltaTS <= 1),
      analysis.cumulativeTimeRatio == null || validRatio(analysis.cumulativeTimeRatio, false, true),
      analysis.totalDisplacementRatio == null || validRatio(analysis.totalDisplacementRatio, true, totalSources) &&
        (totalSources || analysis.totalDisplacementRatio.status === "insufficient-data"),
      analysis.intervalTimeRatio == null || validRatio(analysis.intervalTimeRatio, false, true),
      analysis.intervalDistanceRatio == null || validRatio(analysis.intervalDistanceRatio, true, gapSources) &&
        (gapSources || analysis.intervalDistanceRatio.status === "insufficient-data"),
      analysis.lawAnswerId == null || ["square", "linear", "constant"].includes(analysis.lawAnswerId),
      analysis.intervalLawAnswerId == null || ["odd", "equal", "square"].includes(analysis.intervalLawAnswerId),
      analysis.accelerationAnswerId == null || ["constant-acceleration", "constant-speed", "frequency-changes-gravity"].includes(analysis.accelerationAnswerId)
    ];
    if (!checks.every(Boolean)) return false;
    return !complete || finite(analysis.deltaTS) &&
      validRatio(analysis.cumulativeTimeRatio, false, true) &&
      validRatio(analysis.totalDisplacementRatio, true, totalSources) &&
      validRatio(analysis.intervalTimeRatio, false, true) &&
      validRatio(analysis.intervalDistanceRatio, true, gapSources) &&
      typeof analysis.lawAnswerId === "string" && typeof analysis.intervalLawAnswerId === "string" &&
      typeof analysis.accelerationAnswerId === "string";
  }
  function resolvedCount(measurements, keys) {
    let count = 0;
    for (const key of keys) {
      if (measurements[key] === null) break;
      count += 1;
    }
    return count;
  }
  function validateGenerated(state) {
    if (!Model.validFrequency(state.frequencyHz) || state.frequencyActivelySelected !== true || state.generated !== true ||
        !state.measurements || !state.evidence || state.evidence.setupCompleted !== true || !state.analysis) return false;
    const max = Model.cameraMax(state.frequencyHz);
    for (const key of MEASUREMENT_KEYS) if (validReading(state.measurements[key], max) === "invalid") return false;
    if (Object.keys(state.measurements).some((key) => !MEASUREMENT_KEYS.includes(key))) return false;
    if (Object.keys(state.evidence).some((key) => !["setupCompleted", "totalPlacement", ...Scoring.GAP_KEYS].includes(key))) return false;
    const totalEvidence = state.evidence.totalPlacement;
    if (totalEvidence && !validTotalEvidence(totalEvidence, state.frequencyHz)) return false;
    for (const key of Scoring.TOTAL_KEYS) {
      const item = state.measurements[key];
      if (item?.usedTotalPlacement === true && (!totalEvidence || item.status !== "recorded")) return false;
    }
    if (totalEvidence && !Scoring.TOTAL_KEYS.some((key) => state.measurements[key]?.usedTotalPlacement === true)) return false;
    for (const key of Scoring.GAP_KEYS) {
      const evidence = state.evidence[key];
      const item = state.measurements[key];
      if (own(item || {}, "usedTotalPlacement")) return false;
      if (evidence && (item?.status !== "recorded" || !validGapEvidence(evidence, key, item.readingM))) return false;
      if (item?.status === "skipped" && evidence) return false;
    }
    return analysisFieldValid(state.analysis, state.measurements, state.phase === "review" && state.variant === "complete");
  }
  function validateDraft(state) {
    if (!state || state.v !== VERSION || state.modelVersion !== Model.MODEL_VERSION ||
        state.rubricVersion !== Scoring.RUBRIC_VERSION || !PHASES.includes(state.phase) ||
        typeof state.returnToReview !== "boolean") return false;
    if (state.phase === "setup") {
      const expected = ["v", "modelVersion", "rubricVersion", "phase", "variant", "currentStep", "returnToReview", "frequencyHz", "frequencyActivelySelected"];
      if (!exactKeys(state, expected) || state.currentStep !== "setup" || state.returnToReview ||
          !["new", "configured"].includes(state.variant)) return false;
      return state.variant === "new"
        ? state.frequencyHz === null && state.frequencyActivelySelected === false
        : Model.validFrequency(state.frequencyHz) && state.frequencyActivelySelected === true;
    }
    if (!validateGenerated(state)) return false;
    const allowedTop = ["v", "modelVersion", "rubricVersion", "phase", "variant", "currentStep", "returnToReview",
      "frequencyHz", "frequencyActivelySelected", "generated", "activePlacement", "measurements", "evidence", "analysis"];
    if (Object.keys(state).some((key) => !allowedTop.includes(key))) return false;
    const totalResolved = resolvedCount(state.measurements, Scoring.TOTAL_KEYS);
    const gapResolved = resolvedCount(state.measurements, Scoring.GAP_KEYS);
    if (state.phase === "measure-total" || state.phase === "measure-interval") {
      if (!TOTAL_VARIANTS.includes(state.variant) || !Number.isInteger(state.currentStep) || state.currentStep < 0 || state.currentStep > 3) return false;
      const edit = state.variant.startsWith("review-edit-");
      const ready = state.variant.endsWith("placement-ready");
      if (state.returnToReview !== edit) return false;
      const task = state.phase === "measure-total" ? "total" : Scoring.GAP_KEYS[state.currentStep];
      if (ready !== own(state, "activePlacement") || (ready && !validPlacementShape(state.activePlacement, task, state.frequencyHz))) return false;
      if (!edit) {
        if (state.phase === "measure-total" && (totalResolved !== state.currentStep || gapResolved !== 0 ||
            Scoring.TOTAL_KEYS.slice(state.currentStep).some((key) => state.measurements[key] !== null) ||
            Scoring.GAP_KEYS.some((key) => state.measurements[key] !== null))) return false;
        if (state.phase === "measure-interval" && (totalResolved !== 4 || gapResolved !== state.currentStep ||
            Scoring.GAP_KEYS.slice(state.currentStep).some((key) => state.measurements[key] !== null))) return false;
        if (Object.values(state.analysis).some((value) => value !== null)) return false;
      } else if (totalResolved !== 4 || gapResolved !== 4) return false;
      const currentKey = state.phase === "measure-total" ? Scoring.TOTAL_KEYS[state.currentStep] : Scoring.GAP_KEYS[state.currentStep];
      if (ready && !edit && state.measurements[currentKey] !== null) return false;
      return true;
    }
    if (own(state, "activePlacement")) return false;
    if (state.phase === "analyze") {
      return ANALYZE_VARIANTS.includes(state.variant) && state.currentStep === "analysis" &&
        state.returnToReview === (state.variant === "review-edit") && totalResolved === 4 && gapResolved === 4;
    }
    if (state.phase === "review") {
      if (!["incomplete", "complete"].includes(state.variant) || state.currentStep !== "review" || state.returnToReview ||
          totalResolved !== 4 || gapResolved !== 4) return false;
      return state.variant === (analysisFieldValid(state.analysis, state.measurements, true) ? "complete" : "incomplete");
    }
    return false;
  }
  function encode(source) {
    const value = clone(source);
    if (!validateDraft(value)) throw new Error("Invalid free-fall draft");
    return value;
  }
  function decode(value) {
    return validateDraft(value) && JSON.stringify(encode(value)) === JSON.stringify(value) ? clone(value) : null;
  }
  function makeReview(source) {
    if (!validateDraft(source) || source.phase !== "review" || source.variant !== "complete") throw new Error("Complete review required");
    const review = {
      v: VERSION, locked: 1, modelVersion: Model.MODEL_VERSION, rubricVersion: Scoring.RUBRIC_VERSION,
      frequencyHz: source.frequencyHz, frequencyActivelySelected: true,
      measurements: clone(source.measurements), evidence: clone(source.evidence), analysis: clone(source.analysis)
    };
    if (!validateReview(review)) throw new Error("Invalid review");
    return review;
  }
  function validateReview(review) {
    if (!exactKeys(review, ["v", "locked", "modelVersion", "rubricVersion", "frequencyHz",
      "frequencyActivelySelected", "measurements", "evidence", "analysis"]) ||
      review.v !== VERSION || review.locked !== 1) return false;
    return validateGenerated({
      ...review, phase: "review", variant: "complete", currentStep: "review",
      returnToReview: false, generated: true
    });
  }
  function decodeReview(value) { return validateReview(value) ? clone(value) : null; }
  function fromReview(review) {
    const value = decodeReview(review);
    return value ? {
      v: VERSION, modelVersion: Model.MODEL_VERSION, rubricVersion: Scoring.RUBRIC_VERSION,
      phase: "review", variant: "complete", currentStep: "review", returnToReview: false,
      frequencyHz: value.frequencyHz, frequencyActivelySelected: true, generated: true,
      measurements: value.measurements, evidence: value.evidence, analysis: value.analysis
    } : null;
  }
  function withPlacement(state, placement) {
    if (!validateDraft(state) || !["measure-total", "measure-interval"].includes(state.phase)) return null;
    const next = clone(state);
    const task = state.phase === "measure-total" ? "total" : Scoring.GAP_KEYS[state.currentStep];
    const candidate = { task, ...clone(placement) };
    if (!validPlacementShape(candidate, task, state.frequencyHz)) return null;
    if (state.phase === "measure-total" && next.evidence.totalPlacement) {
      delete next.evidence.totalPlacement;
      for (const key of Scoring.TOTAL_KEYS) {
        if (next.measurements[key]?.status === "recorded") next.measurements[key].usedTotalPlacement = false;
      }
    }
    next.activePlacement = candidate;
    next.variant = state.returnToReview ? "review-edit-placement-ready" : "normal-placement-ready";
    return validateDraft(next) ? next : null;
  }
  function resolveMeasurement(state, readingM, skipped = false) {
    if (!validateDraft(state) || !["measure-total", "measure-interval"].includes(state.phase)) return null;
    const next = clone(state);
    const isTotal = state.phase === "measure-total";
    const key = isTotal ? Scoring.TOTAL_KEYS[state.currentStep] : Scoring.GAP_KEYS[state.currentStep];
    if (skipped) {
      next.measurements[key] = { status: "skipped" };
      if (!isTotal) delete next.evidence[key];
    } else {
      if (!finite(readingM) || readingM < 0 || readingM > Model.cameraMax(state.frequencyHz)) return null;
      const placement = state.activePlacement;
      next.measurements[key] = { status: "recorded", readingM };
      if (isTotal) {
        const valid = placement && Scoring.validPlacement(placement, "total");
        next.measurements[key].usedTotalPlacement = Boolean(valid);
        if (valid) {
          next.evidence.totalPlacement = {
            mode: placement.mode, moveNorm: placement.moveNorm, rulerZeroM: placement.rulerZeroM,
            edgeSide: placement.edgeSide, zeroErrorPx: placement.zeroErrorPx, edgeGapPx: placement.edgeGapPx
          };
        }
      } else if (placement && Scoring.validPlacement(placement, key)) {
        next.evidence[key] = {
          task: key, mode: placement.mode, moveNorm: placement.moveNorm, zeroErrorPx: placement.zeroErrorPx,
          edgeGapPx: placement.edgeGapPx, readingM, usedWhileValid: true
        };
      } else delete next.evidence[key];
    }
    if (!isTotal) delete next.activePlacement;
    if (state.returnToReview) {
      canonicalizeDistanceRatio(next, isTotal ? Scoring.TOTAL_KEYS : Scoring.GAP_KEYS,
        isTotal ? "totalDisplacementRatio" : "intervalDistanceRatio");
      delete next.activePlacement;
      next.phase = "review"; next.variant = analysisFieldValid(next.analysis, next.measurements, true) ? "complete" : "incomplete";
      next.currentStep = "review"; next.returnToReview = false;
    } else if (state.currentStep < 3) {
      next.currentStep += 1;
      next.variant = isTotal && own(next, "activePlacement") ? "normal-placement-ready" : "normal-unpositioned";
    } else {
      delete next.activePlacement;
      next.phase = isTotal ? "measure-interval" : "analyze";
      next.variant = "normal"; next.currentStep = isTotal ? 0 : "analysis";
      if (isTotal) next.variant = "normal-unpositioned";
    }
    return validateDraft(next) ? next : null;
  }
  function canonicalizeDistanceRatio(state, keys, ratioKey) {
    const sufficient = positiveReadings(state.measurements, keys);
    if (!sufficient) state.analysis[ratioKey] = { status: "insufficient-data" };
    else if (state.analysis[ratioKey]?.status === "insufficient-data") state.analysis[ratioKey] = null;
  }
  function enterReview(state) {
    if (!validateDraft(state) || state.phase !== "analyze") return null;
    const next = clone(state);
    next.phase = "review"; next.variant = analysisFieldValid(next.analysis, next.measurements, true) ? "complete" : "incomplete";
    next.currentStep = "review"; next.returnToReview = false;
    return validateDraft(next) ? next : null;
  }
  function edit(state, area, step = 0) {
    if (!validateDraft(state) || state.phase !== "review") return null;
    const next = clone(state);
    next.returnToReview = true;
    if (area === "analysis") {
      next.phase = "analyze"; next.variant = "review-edit"; next.currentStep = "analysis";
    } else if (area === "total" || area === "interval") {
      if (!Number.isInteger(step) || step < 0 || step > 3) return null;
      next.phase = area === "total" ? "measure-total" : "measure-interval";
      next.variant = "review-edit-unpositioned"; next.currentStep = step;
    } else return null;
    return validateDraft(next) ? next : null;
  }
  function setAnalysis(state, patch) {
    if (!validateDraft(state) || state.phase !== "analyze" || !patch || typeof patch !== "object") return null;
    const next = clone(state);
    next.analysis = { ...next.analysis, ...clone(patch) };
    return validateDraft(next) ? next : null;
  }
  function bytes(value) { return new TextEncoder().encode(JSON.stringify(value)).length; }

  return {
    VERSION, MEASUREMENT_KEYS, initialState, configuredState, emptyMeasurements, emptyAnalysis,
    generate, validateDraft, encode, decode, makeReview, validateReview, decodeReview, fromReview,
    withPlacement, resolveMeasurement, enterReview, edit, setAnalysis, analysisFieldValid, bytes
  };
});
