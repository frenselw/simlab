(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./model.js") : root.FreeFallModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.FreeFallScoring;
  const api = factory(model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FreeFallPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, Scoring) {
  "use strict";

  const VERSION = 3;
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
  function currentPlacementKeys(value, base) {
    const conditional = value.horizontalMode === "guide-fraction" ? ["guideFraction"] : ["boundaryOverlapPx"];
    return Object.keys(value).every((key) =>
      [...base, "rulerX", "rulerSide", "rulerGeometry", "zeroTickOverlapPx", "horizontalMode", ...conditional].includes(key));
  }

  function initialState() {
    return {
      v: VERSION, modelVersion: Model.MODEL_VERSION, rubricVersion: Scoring.RUBRIC_VERSION,
      phase: "setup", variant: "new", currentStep: "setup", returnToReview: false,
      frequencyHz: null, frequencyAssigned: false
    };
  }
  function chooseFrequency(random = Math.random) {
    if (typeof random !== "function") return null;
    const sample = random();
    return finite(sample) && sample >= 0 && sample < 1
      ? Model.ASSIGNABLE_FREQUENCIES[Math.floor(sample * Model.ASSIGNABLE_FREQUENCIES.length)] : null;
  }
  function assignedState(frequencyHz) {
    if (!Model.validFrequency(frequencyHz)) return null;
    return {
      ...initialState(), variant: "assigned", frequencyHz,
      frequencyAssigned: true
    };
  }
  function assignFrequency(state, frequencyHz) {
    return validateDraft(state) && state.phase === "setup" && state.variant === "new"
      && Model.ASSIGNABLE_FREQUENCIES.includes(frequencyHz) ? assignedState(frequencyHz) : null;
  }
  function reset(state) {
    return validateDraft(state) && Model.validFrequency(state.frequencyHz) && state.frequencyAssigned === true
      ? assignedState(state.frequencyHz) : null;
  }
  function emptyMeasurements() { return Object.fromEntries(MEASUREMENT_KEYS.map((key) => [key, null])); }
  function emptyAnalysis() {
    return {
      deltaTS: null,
      cumulativeTimeRatio: { values: [1, null, null, null] },
      intervalTimeRatio: { values: [1, null, null, null] },
      lawAnswerId: null, intervalLawAnswerId: null, accelerationAnswerId: null
    };
  }
  function generate(state) {
    if (!validateDraft(state) || state.phase !== "setup" || state.variant !== "assigned") return null;
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
    const negativeAllowanceM = targetM === 0
      ? Scoring.ZERO_ALIGNMENT_TOLERANCE_PX / MIN_GEOMETRY_PX_PER_M : 0;
    if (!finite(targetM) || rulerZeroM < -negativeAllowanceM ||
        rulerZeroM > Model.cameraMax(frequencyHz)) return false;
    const displacementM = rulerZeroM - targetM;
    if (Math.abs(displacementM) < 1e-12) return Math.abs(zeroErrorPx) < 1e-9;
    if (Math.sign(displacementM) !== Math.sign(zeroErrorPx)) return false;
    const pixelsPerMeter = Math.abs(zeroErrorPx / displacementM);
    return pixelsPerMeter >= MIN_GEOMETRY_PX_PER_M && pixelsPerMeter <= MAX_GEOMETRY_PX_PER_M;
  }
  function validPlacementShape(value, expectedTask, frequencyHz) {
    if (!value || !["pointer", "keyboard"].includes(value.mode) || value.task !== expectedTask ||
        ![value.moveNorm, value.rulerZeroM, value.zeroErrorPx].every(finite) ||
        value.moveNorm < 0 || value.moveNorm > 1 ||
        Math.abs(value.zeroErrorPx) > 500 ||
        !consistentRulerGeometry(value.rulerZeroM, value.zeroErrorPx, expectedTask, frequencyHz)) return false;
    const common = ["task", "mode", "moveNorm", "rulerZeroM", "zeroErrorPx"];
    const current = finite(value.rulerX) && value.rulerX >= 0 && value.rulerX <= 360 &&
      finite(value.zeroTickOverlapPx) && value.zeroTickOverlapPx >= 0 && value.zeroTickOverlapPx <= 500 &&
      Scoring.validCurrentHorizontalRelation(value) && currentPlacementKeys(value, common);
    const legacy = finite(value.legacyEdgeGapPx) && value.legacyEdgeGapPx >= 0 && value.legacyEdgeGapPx <= 200 &&
      ["left", "right"].includes(value.legacyEdgeSide) &&
      Object.keys(value).every((key) => [...common, "legacyEdgeSide", "legacyEdgeGapPx"].includes(key));
    return current || legacy;
  }
  function validTotalEvidence(value, frequencyHz) {
    return Boolean(value && ["pointer", "keyboard"].includes(value.mode) &&
      [value.moveNorm, value.rulerZeroM, value.zeroErrorPx].every(finite) &&
      consistentRulerGeometry(value.rulerZeroM, value.zeroErrorPx, "total", frequencyHz) &&
      Scoring.totalPlacementValid({ task: "total", ...value }) &&
      (finite(value.rulerX) && value.rulerX >= 0 && value.rulerX <= 360 &&
       finite(value.zeroTickOverlapPx) && value.zeroTickOverlapPx <= 500 &&
       Scoring.validCurrentHorizontalRelation(value) &&
       currentPlacementKeys(value, ["mode", "moveNorm", "rulerZeroM", "zeroErrorPx"]) ||
       ["left", "right"].includes(value.legacyEdgeSide) &&
       Object.keys(value).every((key) => ["mode", "moveNorm", "rulerZeroM", "legacyEdgeSide", "zeroErrorPx", "legacyEdgeGapPx"].includes(key))));
  }
  function validGapEvidence(value, task, reading) {
    return Boolean(value &&
      (finite(value.rulerX) && value.rulerX >= 0 && value.rulerX <= 360 &&
       finite(value.zeroTickOverlapPx) && value.zeroTickOverlapPx <= 500 &&
       Scoring.validCurrentHorizontalRelation(value) &&
       currentPlacementKeys(value, ["mode", "moveNorm", "zeroErrorPx", "readingM", "usedWhileValid", "task"]) ||
       Object.keys(value).every((key) => ["mode", "moveNorm", "zeroErrorPx", "legacyEdgeGapPx", "readingM", "usedWhileValid", "task"].includes(key))) &&
      value.task === task && value.usedWhileValid === true && Scoring.gapEvidenceValid(value, task, reading));
  }
  function validTimeRatio(value) {
    return exactKeys(value, ["values"]) && Array.isArray(value.values) && value.values.length === 4 &&
      value.values[0] === 1 && value.values.slice(1).every((term) => term === null || finite(term) && term > 0);
  }
  function analysisFieldValid(analysis) {
    if (!exactKeys(analysis, ["deltaTS", "cumulativeTimeRatio", "intervalTimeRatio",
      "lawAnswerId", "intervalLawAnswerId", "accelerationAnswerId"])) return false;
    return (analysis.deltaTS === null || finite(analysis.deltaTS) && analysis.deltaTS > 0) &&
      validTimeRatio(analysis.cumulativeTimeRatio) && validTimeRatio(analysis.intervalTimeRatio) &&
      (analysis.lawAnswerId === null || ["square", "linear", "constant"].includes(analysis.lawAnswerId)) &&
      (analysis.intervalLawAnswerId === null || ["odd", "equal", "square"].includes(analysis.intervalLawAnswerId)) &&
      (analysis.accelerationAnswerId === null || ["constant-acceleration", "constant-speed", "frequency-changes-gravity"].includes(analysis.accelerationAnswerId));
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
    if (!Model.validFrequency(state.frequencyHz) || state.frequencyAssigned !== true || state.generated !== true ||
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
    return analysisFieldValid(state.analysis);
  }
  function validateDraft(state) {
    if (!state || state.v !== VERSION || state.modelVersion !== Model.MODEL_VERSION ||
        state.rubricVersion !== Scoring.RUBRIC_VERSION || !PHASES.includes(state.phase) ||
        typeof state.returnToReview !== "boolean") return false;
    if (state.phase === "setup") {
      const expected = ["v", "modelVersion", "rubricVersion", "phase", "variant", "currentStep", "returnToReview", "frequencyHz", "frequencyAssigned"];
      if (!exactKeys(state, expected) || state.currentStep !== "setup" || state.returnToReview ||
          !["new", "assigned"].includes(state.variant)) return false;
      return state.variant === "new"
        ? state.frequencyHz === null && state.frequencyAssigned === false
        : Model.validFrequency(state.frequencyHz) && state.frequencyAssigned === true;
    }
    if (!validateGenerated(state)) return false;
    const allowedTop = ["v", "modelVersion", "rubricVersion", "phase", "variant", "currentStep", "returnToReview",
      "frequencyHz", "frequencyAssigned", "generated", "activePlacement", "measurements", "evidence", "analysis"];
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
        if (JSON.stringify(state.analysis) !== JSON.stringify(emptyAnalysis())) return false;
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
      if (state.variant !== "ready" || state.currentStep !== "review" || state.returnToReview ||
          totalResolved !== 4 || gapResolved !== 4) return false;
      return true;
    }
    return false;
  }
  function encode(source) {
    if (!validateDraft(source)) throw new Error("Invalid free-fall draft");
    return clone(source);
  }
  function validLegacyV1Placement(placement, finalized) {
    const minGap = finalized ? Scoring.LEGACY_EDGE_MIN_GAP_PX : 0;
    const maxGap = finalized ? Scoring.LEGACY_EDGE_MAX_GAP_PX : 200;
    return Boolean(placement && finite(placement.edgeGapPx) &&
      placement.edgeGapPx >= minGap && placement.edgeGapPx <= maxGap &&
      (!own(placement, "rulerZeroM") || finite(placement.rulerZeroM) && placement.rulerZeroM >= 0));
  }
  function validLegacyV1Placements(value) {
    if (own(value || {}, "activePlacement") && !validLegacyV1Placement(value.activePlacement, false)) return false;
    if (own(value?.evidence || {}, "totalPlacement") &&
        !validLegacyV1Placement(value.evidence.totalPlacement, true)) return false;
    return Scoring.GAP_KEYS.every((key) => !own(value?.evidence || {}, key) ||
      validLegacyV1Placement(value.evidence[key], true));
  }
  function migrateLegacyPlacement(placement) {
    const migrated = clone(placement);
    migrated.legacyEdgeGapPx = migrated.edgeGapPx;
    delete migrated.edgeGapPx;
    if (own(migrated, "edgeSide")) {
      migrated.legacyEdgeSide = migrated.edgeSide;
      delete migrated.edgeSide;
    }
    return migrated;
  }
  function migrateV1(value, review = false) {
    if (!value || value.v !== 1 || value.modelVersion !== Model.MODEL_VERSION ||
        value.rubricVersion !== Scoring.LEGACY_RUBRIC_VERSION || own(value, "frequencyAssigned") ||
        typeof value.frequencyActivelySelected !== "boolean") return null;
    const expectedSetup = ["v", "modelVersion", "rubricVersion", "phase", "variant", "currentStep",
      "returnToReview", "frequencyHz", "frequencyActivelySelected"];
    const expectedReview = ["v", "locked", "modelVersion", "rubricVersion", "frequencyHz",
      "frequencyActivelySelected", "measurements", "evidence", "analysis"];
    if (review ? !exactKeys(value, expectedReview) :
      value.phase === "setup" ? !exactKeys(value, expectedSetup) :
        Object.keys(value).some((key) => !["v", "modelVersion", "rubricVersion", "phase", "variant",
          "currentStep", "returnToReview", "frequencyHz", "frequencyActivelySelected", "generated",
          "activePlacement", "measurements", "evidence", "analysis"].includes(key))) return null;
    if (!validLegacyV1Placements(value)) return null;
    const migrated = clone(value);
    migrated.v = 2;
    migrated.rubricVersion = Scoring.LEGACY_RUBRIC_VERSION;
    migrated.frequencyAssigned = migrated.frequencyActivelySelected;
    delete migrated.frequencyActivelySelected;
    if (own(migrated, "activePlacement")) migrated.activePlacement = migrateLegacyPlacement(migrated.activePlacement);
    if (own(migrated.evidence || {}, "totalPlacement")) {
      migrated.evidence.totalPlacement = migrateLegacyPlacement(migrated.evidence.totalPlacement);
    }
    for (const key of Scoring.GAP_KEYS) {
      if (own(migrated.evidence || {}, key)) migrated.evidence[key] = migrateLegacyPlacement(migrated.evidence[key]);
    }
    if (!review && migrated.phase === "setup") {
      if (migrated.variant === "configured") migrated.variant = "assigned";
      else if (migrated.variant !== "new") return null;
    }
    return migrated;
  }
  function positiveReadings(measurements, keys) {
    return keys.every((key) => measurements?.[key]?.status === "recorded" &&
      finite(measurements[key].readingM) && measurements[key].readingM > 0);
  }
  function validLegacyRatio(value, allowInsufficient, hasSources) {
    if (value === null) return true;
    if (!value || !["answered", "insufficient-data"].includes(value.status)) return false;
    if (value.status === "insufficient-data") return allowInsufficient && !hasSources && exactKeys(value, ["status"]);
    return exactKeys(value, ["status", "values"]) && Array.isArray(value.values) && value.values.length === 4 &&
      value.values[0] === 1 && value.values.every((term) => finite(term) && term > 0);
  }
  function legacyAnalysisValid(analysis, measurements, complete) {
    if (!exactKeys(analysis, ["deltaTS", "cumulativeTimeRatio", "totalDisplacementRatio",
      "intervalTimeRatio", "intervalDistanceRatio", "lawAnswerId", "intervalLawAnswerId",
      "accelerationAnswerId"])) return false;
    const totalSources = positiveReadings(measurements, Scoring.TOTAL_KEYS);
    const gapSources = positiveReadings(measurements, Scoring.GAP_KEYS);
    const totalDistanceValid = validLegacyRatio(analysis.totalDisplacementRatio, true, totalSources) &&
      (totalSources || analysis.totalDisplacementRatio?.status === "insufficient-data" || analysis.totalDisplacementRatio === null);
    const intervalDistanceValid = validLegacyRatio(analysis.intervalDistanceRatio, true, gapSources) &&
      (gapSources || analysis.intervalDistanceRatio?.status === "insufficient-data" || analysis.intervalDistanceRatio === null);
    const valid = (analysis.deltaTS === null || finite(analysis.deltaTS) && analysis.deltaTS >= 0 && analysis.deltaTS <= 1) &&
      validLegacyRatio(analysis.cumulativeTimeRatio, false, true) &&
      totalDistanceValid &&
      validLegacyRatio(analysis.intervalTimeRatio, false, true) &&
      intervalDistanceValid &&
      (analysis.lawAnswerId === null || ["square", "linear", "constant"].includes(analysis.lawAnswerId)) &&
      (analysis.intervalLawAnswerId === null || ["odd", "equal", "square"].includes(analysis.intervalLawAnswerId)) &&
      (analysis.accelerationAnswerId === null || ["constant-acceleration", "constant-speed", "frequency-changes-gravity"].includes(analysis.accelerationAnswerId));
    if (!valid || !complete) return valid;
    return finite(analysis.deltaTS) && analysis.deltaTS > 0 && analysis.cumulativeTimeRatio !== null &&
      analysis.totalDisplacementRatio !== null && analysis.intervalTimeRatio !== null &&
      analysis.intervalDistanceRatio !== null && typeof analysis.lawAnswerId === "string" &&
      typeof analysis.intervalLawAnswerId === "string" && typeof analysis.accelerationAnswerId === "string";
  }
  function migratedTimeRatio(value) {
    return value?.status === "answered" && Array.isArray(value.values)
      ? { values: clone(value.values) } : { values: [1, null, null, null] };
  }
  function migrateV2(value, review = false) {
    if (!value || value.v !== 2 || value.modelVersion !== Model.MODEL_VERSION ||
        value.rubricVersion !== Scoring.LEGACY_RUBRIC_VERSION ||
        typeof value.frequencyAssigned !== "boolean") return null;
    const migrated = clone(value);
    migrated.v = VERSION;
    migrated.rubricVersion = Scoring.RUBRIC_VERSION;
    if (!review && migrated.phase === "setup") return migrated;
    if (!legacyAnalysisValid(value.analysis, value.measurements, review)) return null;
    if (!review && migrated.phase === "review") {
      const complete = legacyAnalysisValid(value.analysis, value.measurements, true);
      if (value.variant !== (complete ? "complete" : "incomplete")) return null;
    }
    migrated.analysis = {
      deltaTS: migrated.analysis.deltaTS === 0 ? null : migrated.analysis.deltaTS,
      cumulativeTimeRatio: migratedTimeRatio(migrated.analysis.cumulativeTimeRatio),
      intervalTimeRatio: migratedTimeRatio(migrated.analysis.intervalTimeRatio),
      lawAnswerId: migrated.analysis.lawAnswerId,
      intervalLawAnswerId: migrated.analysis.intervalLawAnswerId,
      accelerationAnswerId: migrated.analysis.accelerationAnswerId
    };
    if (!review && migrated.phase === "review") migrated.variant = "ready";
    return migrated;
  }
  function decode(value) {
    const legacy = value?.v === 1 ? migrateV1(value, false) : value;
    const candidate = legacy?.v === 2 ? migrateV2(legacy, false) : legacy;
    return validateDraft(candidate) ? encode(candidate) : null;
  }
  function makeReview(source) {
    if (!validateDraft(source) || source.phase !== "review" || source.variant !== "ready") throw new Error("Ready review required");
    const review = {
      v: VERSION, locked: 1, modelVersion: Model.MODEL_VERSION, rubricVersion: Scoring.RUBRIC_VERSION,
      frequencyHz: source.frequencyHz, frequencyAssigned: true,
      measurements: clone(source.measurements), evidence: clone(source.evidence), analysis: clone(source.analysis)
    };
    if (!validateReview(review)) throw new Error("Invalid review");
    return review;
  }
  function validateReview(review) {
    if (!exactKeys(review, ["v", "locked", "modelVersion", "rubricVersion", "frequencyHz",
      "frequencyAssigned", "measurements", "evidence", "analysis"]) ||
      review.v !== VERSION || review.locked !== 1 || review.modelVersion !== Model.MODEL_VERSION ||
      review.rubricVersion !== Scoring.RUBRIC_VERSION || review.frequencyAssigned !== true) return false;
    return validateGenerated({
      ...review, phase: "review", variant: "ready", currentStep: "review",
      returnToReview: false, generated: true
    });
  }
  function decodeReview(value) {
    const legacy = value?.v === 1 ? migrateV1(value, true) : value;
    const candidate = legacy?.v === 2 ? migrateV2(legacy, true) : legacy;
    return validateReview(candidate) ? clone(candidate) : null;
  }
  function decodeImmutableReview(value) {
    const legacy = value?.v === 1 ? migrateV1(value, true) : value;
    if (legacy?.v === 2) {
      const migrated = migrateV2(legacy, true);
      return migrated && validateReview(migrated) ? clone(legacy) : null;
    }
    return validateReview(legacy) ? clone(legacy) : null;
  }
  function fromReview(review) {
    const value = decodeReview(review);
    return value ? {
      v: VERSION, modelVersion: Model.MODEL_VERSION, rubricVersion: Scoring.RUBRIC_VERSION,
      phase: "review", variant: "ready", currentStep: "review", returnToReview: false,
      frequencyHz: value.frequencyHz, frequencyAssigned: true, generated: true,
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
  function refreshPlacement(state, placement) {
    if (!validateDraft(state) || !state.activePlacement ||
        !["measure-total", "measure-interval"].includes(state.phase)) return null;
    const task = state.phase === "measure-total" ? "total" : Scoring.GAP_KEYS[state.currentStep];
    const candidate = { task, ...clone(placement) };
    if (!validPlacementShape(candidate, task, state.frequencyHz)) return null;
    const next = clone(state);
    next.activePlacement = candidate;
    next.variant = state.returnToReview ? "review-edit-placement-ready" : "normal-placement-ready";
    return validateDraft(next) ? next : null;
  }
  function horizontalEvidence(placement) {
    return {
      rulerX: placement.rulerX, rulerSide: placement.rulerSide,
      ...(own(placement, "rulerGeometry") ? { rulerGeometry: placement.rulerGeometry } : {}),
      horizontalMode: placement.horizontalMode,
      ...(placement.horizontalMode === "guide-fraction"
        ? { guideFraction: placement.guideFraction }
        : { boundaryOverlapPx: placement.boundaryOverlapPx }),
      zeroTickOverlapPx: placement.zeroTickOverlapPx
    };
  }
  function resolveMeasurement(state, readingM, skipped = false, options = {}) {
    if (!validateDraft(state) || !["measure-total", "measure-interval"].includes(state.phase)) return null;
    const next = clone(state);
    const isTotal = state.phase === "measure-total";
    const key = isTotal ? Scoring.TOTAL_KEYS[state.currentStep] : Scoring.GAP_KEYS[state.currentStep];
    const previous = state.measurements[key];
    const reuseOriginal = !skipped && options?.reusedOriginal === true && state.returnToReview === true &&
      !state.activePlacement && previous?.status === "recorded" && finite(readingM) &&
      Object.is(readingM, previous.readingM);
    if (reuseOriginal) {
      // Preserve the canonical item and its process evidence exactly; only advance back to review.
    } else if (skipped) {
      next.measurements[key] = { status: "skipped" };
      if (!isTotal) delete next.evidence[key];
    } else {
      if (!finite(readingM) || readingM < 0 || readingM > Model.cameraMax(state.frequencyHz)) return null;
      const placement = state.activePlacement;
      const task = isTotal ? "total" : key;
      next.measurements[key] = { status: "recorded", readingM };
      const placementValid = placement && (Scoring.validPlacement(placement, task) ||
        Scoring.validLegacyPlacement(placement, task));
      if (isTotal && placementValid) {
        next.measurements[key].usedTotalPlacement = true;
        next.evidence.totalPlacement = own(placement, "zeroTickOverlapPx") ? {
          mode: placement.mode, moveNorm: placement.moveNorm, rulerZeroM: placement.rulerZeroM,
          ...horizontalEvidence(placement), zeroErrorPx: placement.zeroErrorPx
        } : {
          mode: placement.mode, moveNorm: placement.moveNorm, rulerZeroM: placement.rulerZeroM,
          legacyEdgeSide: placement.legacyEdgeSide, zeroErrorPx: placement.zeroErrorPx,
          legacyEdgeGapPx: placement.legacyEdgeGapPx
        };
      } else if (isTotal) {
        next.measurements[key].usedTotalPlacement = false;
      } else if (placementValid) {
        next.evidence[key] = {
          task: key, mode: placement.mode, moveNorm: placement.moveNorm,
          ...(own(placement, "zeroTickOverlapPx")
            ? { ...horizontalEvidence(placement), zeroErrorPx: placement.zeroErrorPx }
            : { zeroErrorPx: placement.zeroErrorPx, legacyEdgeGapPx: placement.legacyEdgeGapPx }),
          readingM, usedWhileValid: true
        };
      } else delete next.evidence[key];
    }
    if (isTotal && next.evidence.totalPlacement &&
        !Scoring.TOTAL_KEYS.some((totalKey) => next.measurements[totalKey]?.usedTotalPlacement === true)) {
      delete next.evidence.totalPlacement;
    }
    if (!isTotal) delete next.activePlacement;
    if (state.returnToReview) {
      delete next.activePlacement;
      next.phase = "review"; next.variant = "ready";
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
  function enterReview(state) {
    if (!validateDraft(state) || state.phase !== "analyze") return null;
    const next = clone(state);
    next.phase = "review"; next.variant = "ready";
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
    const candidate = clone(state);
    candidate.analysis = { ...candidate.analysis, ...patch };
    return validateDraft(candidate) ? clone(candidate) : null;
  }
  function bytes(value) { return new TextEncoder().encode(JSON.stringify(value)).length; }

  return {
    VERSION, MEASUREMENT_KEYS, initialState, chooseFrequency, assignedState, assignFrequency, reset,
    emptyMeasurements, emptyAnalysis, generate, validateDraft, encode, decode, makeReview,
    validateReview, decodeReview, decodeImmutableReview, fromReview,
    withPlacement, refreshPlacement, resolveMeasurement, enterReview, edit, setAnalysis, analysisFieldValid, bytes
  };
});
