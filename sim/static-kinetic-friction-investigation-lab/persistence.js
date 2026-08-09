(function (root, factory) {
  const M = root.StaticKineticFrictionMeasurement || (typeof module === "object" && module.exports ? require("./measurement.js") : null);
  const api = factory(M);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StaticKineticFrictionPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Measurement) {
  "use strict";

  const SCHEMA_VERSION = 5;
  const WIRE_VERSION = "s5";
  const GENERATOR_VERSION = 1;
  const PHYSICS_VERSION = 2;
  const MEASUREMENT_VERSION = 4;
  const RUBRIC_VERSION = 2;
  const ACTIVITY = "static-kinetic-friction-investigation-lab";
  const PHASES = Object.freeze(["balance", "experiment", "analysis", "predict", "review"]);
  const BALANCE_EDIT_KEYS = Object.freeze(["zero-force", "static-case", "breakaway"]);
  const PREDICTION_COUNT = 4;
  const ANALYSIS_KEYS = Object.freeze(["staticInterval", "breakaway", "slowPlateau", "acceleration", "fastPlateau"]);

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function integer(value) { return Number.isInteger(value); }
  function exactKeys(value, keys) { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.slice().sort().join(",")); }
  function emptyAnalysis() {
    return {
      staticInterval: null,
      breakaway: null,
      slowPlateau: null,
      acceleration: null,
      fastPlateau: null
    };
  }
  function emptyWorking() { return { activeBalanceStep: null, activeAnalysisTask: 0, activePredictionIndex: 0, reviewEditTarget: null, editDraft: null }; }
  function freshState(seed) {
    if (!integer(seed) || seed < 0 || seed > 0xffffffff) throw new Error("invalid seed");
    return {
      schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, physicsVersion: PHYSICS_VERSION, measurementVersion: MEASUREMENT_VERSION, rubricVersion: RUBRIC_VERSION,
      seed: seed >>> 0, phase: "balance", variant: "zero-ready", fromReview: false,
      balance: { zeroForce: null, staticCase: null, breakaway: emptyBreakaway() }, trial: null, analysis: emptyAnalysis(), predictions: [null, null, null, null], working: emptyWorking()
    };
  }
  function emptyBreakaway() { return { attempts: 0, bestPullCN: null, bestDirection: null, learnerMaxCN: null, committed: false }; }
  function forceAnswerComplete(force) { return Boolean(force?.committed === true); }
  function allBalanceAnswersCommitted(state) {
    return forceAnswerComplete(state?.balance?.zeroForce) &&
      forceAnswerComplete(state?.balance?.staticCase?.learnerAppliedForce) &&
      forceAnswerComplete(state?.balance?.staticCase?.learnerForce) &&
      state?.balance?.breakaway?.committed === true &&
      integer(state.balance.breakaway.learnerMaxCN);
  }
  function analysisTaskComplete(key, value) {
    if (!value) return false;
    if (key === "breakaway") return integer(value.markerIndex) && integer(value.estimatedFsMaxCN) && typeof value.identifiedAs === "string";
    if (!(integer(value.startIndex) && integer(value.endIndex))) return false;
    if (key === "staticInterval") return typeof value.frictionType === "string" && typeof value.relation === "string";
    if (key === "slowPlateau" || key === "fastPlateau") return integer(value.estimatedFkCN) && (key !== "fastPlateau" || typeof value.speedComparison === "string");
    return typeof value.relation === "string" && typeof value.pullEqualsFk === "string";
  }
  function analysisTaskHasSelection(key, value) {
    if (!value) return false;
    return key === "breakaway" ? integer(value.markerIndex) : integer(value.startIndex) && integer(value.endIndex);
  }
  function hasAllAnalysisFields(state) {
    return ANALYSIS_KEYS.every((key) => analysisTaskComplete(key, state.analysis?.[key]));
  }
  function hasAllPredictions(state) { return state.predictions.length === PREDICTION_COUNT && state.predictions.every((prediction) => prediction?.committed === true); }
  function inferVariant(state) {
    if (state.fromReview) return "review-edit";
    if (state.phase === "balance") {
      if (!state.balance.zeroForce) return "zero-ready";
      if (!state.balance.staticCase) return "static-ready";
      if (!state.balance.staticCase.learnerAppliedForce || !state.balance.staticCase.learnerForce) return "static-answer-pending";
      if (state.balance.breakaway.bestPullCN == null) return "breakaway-ready";
      if (state.balance.breakaway.learnerMaxCN == null) return "breakaway-answer-pending";
      return allBalanceAnswersCommitted(state) ? "answer-complete" : "breakaway-answer-pending";
    }
    if (state.phase === "experiment") return state.trial ? "accepted" : "ready";
    if (state.phase === "analysis") {
      if (!state.trial) return "waiting-for-trial";
      const completed = ANALYSIS_KEYS.filter((key) => state.analysis[key] != null).length;
      if (!completed) return "selection-ready";
      if (hasAllAnalysisFields(state)) return "complete";
      const activeKey = ANALYSIS_KEYS[Math.min(ANALYSIS_KEYS.length - 1, state.working?.activeAnalysisTask ?? 0)];
      const active = state.analysis[activeKey];
      if (active && ((active.startIndex != null && active.endIndex != null) || active.markerIndex != null)) {
        const required = activeKey === "breakaway" ? ["estimatedFsMaxCN", "identifiedAs"] : activeKey === "staticInterval" ? ["frictionType", "relation"] : activeKey === "slowPlateau" ? ["estimatedFkCN"] : activeKey === "acceleration" ? ["relation", "pullEqualsFk"] : ["estimatedFkCN", "speedComparison"];
        if (required.every((field) => active[field] != null)) return "task-complete";
        return "selection-only";
      }
      return "selection-ready";
    }
    if (state.phase === "predict") {
      if (state.fromReview) return "review-edit";
      const current = state.predictions[state.working.activePredictionIndex];
      if (!current) return "answer-ready";
      if (current.committed) return hasAllPredictions(state) ? "complete" : "answer-complete";
      return "answer-draft";
    }
    return state.fromReview ? "review-edit" : "complete";
  }
  function update(state, patch) {
    const next = { ...clone(state), ...patch };
    next.variant = inferVariant(next);
    return next;
  }
  function validateLearnerForce(force, options = {}) {
    if (force == null) return true;
    if (!exactKeys(force, ["frictionType", "direction", "frictionMagnitudeCN", "committed"]) || !["none", "static", "kinetic"].includes(force.frictionType) || !["none", "left", "right"].includes(force.direction) || !integer(force.frictionMagnitudeCN) || force.frictionMagnitudeCN < 0 || force.frictionMagnitudeCN > 1200 || ![true, false].includes(force.committed)) return false;
    if (!options.allowUncommitted && force.committed !== true) return false;
    if (force.frictionType === "none" && (force.direction !== "none" || force.frictionMagnitudeCN !== 0)) return false;
    if (force.frictionType !== "none" && !["left", "right"].includes(force.direction)) return false;
    return true;
  }
  function validateAppliedForce(force, options = {}) {
    if (!exactKeys(force, ["direction", "magnitudeCN", "committed"]) || !["left", "right"].includes(force.direction) || !integer(force.magnitudeCN) || force.magnitudeCN <= 0 || force.magnitudeCN > 1200 || ![true, false].includes(force.committed)) return false;
    if (!options.allowUncommitted && force.committed !== true) return false;
    return true;
  }
  function validateStaticCase(value, options = {}) {
    if (value == null) return true;
    return exactKeys(value, ["appliedDirection", "appliedMagnitudeCN", "learnerAppliedForce", "learnerForce"]) &&
      ["left", "right"].includes(value.appliedDirection) && integer(value.appliedMagnitudeCN) && value.appliedMagnitudeCN > 0 && value.appliedMagnitudeCN <= 1200 &&
      validateAppliedForce(value.learnerAppliedForce, options) && validateLearnerForce(value.learnerForce, options);
  }
  function validateBreakaway(value) {
    return exactKeys(value, ["attempts", "bestPullCN", "bestDirection", "learnerMaxCN", "committed"]) &&
      integer(value.attempts) && value.attempts >= 0 && value.attempts <= 1000 &&
      (value.bestPullCN === null || (integer(value.bestPullCN) && value.bestPullCN > 0 && value.bestPullCN <= 1200)) &&
      (value.bestDirection === null || ["left", "right"].includes(value.bestDirection)) &&
      (value.learnerMaxCN === null || (integer(value.learnerMaxCN) && value.learnerMaxCN >= 0 && value.learnerMaxCN <= 1200)) &&
      [true, false].includes(value.committed) &&
      (value.bestPullCN === null ? value.bestDirection === null : value.bestDirection !== null) &&
      (value.committed ? value.bestPullCN !== null && value.learnerMaxCN !== null : true);
  }
  function validateAnalysisTask(key, value, sampleCount) {
    if (value == null) return true;
    const allowed = key === "breakaway" ? ["markerIndex", "estimatedFsMaxCN", "identifiedAs"] : key === "staticInterval" ? ["startIndex", "endIndex", "frictionType", "relation"] : key === "slowPlateau" ? ["startIndex", "endIndex", "estimatedFkCN"] : key === "acceleration" ? ["startIndex", "endIndex", "relation", "pullEqualsFk"] : key === "fastPlateau" ? ["startIndex", "endIndex", "estimatedFkCN", "speedComparison"] : [];
    if (!allowed.length || !exactKeys(value, allowed)) return false;
    const indexFields = key === "breakaway" ? ["markerIndex"] : ["startIndex", "endIndex"];
    if (indexFields.some((field) => !integer(value[field]) || value[field] < 0 || value[field] >= sampleCount)) return false;
    if (key !== "breakaway" && value.endIndex < value.startIndex) return false;
    if (key === "staticInterval" && (value.frictionType != null && !["none", "static", "kinetic"].includes(value.frictionType) || value.relation != null && !["equal", "pull-greater", "pull-less"].includes(value.relation))) return false;
    if (key === "breakaway" && (value.estimatedFsMaxCN != null && (!integer(value.estimatedFsMaxCN) || value.estimatedFsMaxCN < 0 || value.estimatedFsMaxCN > 1200) || value.identifiedAs != null && !["maximum-static-friction", "kinetic-friction", "applied-force"].includes(value.identifiedAs))) return false;
    if (["slowPlateau", "fastPlateau"].includes(key) && value.estimatedFkCN != null && (!integer(value.estimatedFkCN) || value.estimatedFkCN < 0 || value.estimatedFkCN > 1200)) return false;
    if (key === "acceleration" && (value.relation != null && !["equal", "pull-greater", "pull-less"].includes(value.relation) || value.pullEqualsFk != null && !["yes", "no"].includes(value.pullEqualsFk))) return false;
    if (key === "fastPlateau" && value.speedComparison != null && !["same-average", "higher-at-fast-speed", "lower-at-fast-speed"].includes(value.speedComparison)) return false;
    return true;
  }
  function validatePrediction(prediction) {
    if (!exactKeys(prediction, ["id", "scenarioId", "frictionType", "direction", "magnitudeCN", "motionOutcome", "committed"]) || typeof prediction.id !== "string" || typeof prediction.scenarioId !== "string" || typeof prediction.committed !== "boolean") return false;
    if (prediction.frictionType != null && !["none", "static", "kinetic"].includes(prediction.frictionType)) return false;
    if (prediction.direction != null && !["none", "left", "right"].includes(prediction.direction)) return false;
    if (prediction.magnitudeCN != null && (!integer(prediction.magnitudeCN) || prediction.magnitudeCN < 0 || prediction.magnitudeCN > 1200)) return false;
    if (prediction.motionOutcome != null && !["remain-still", "speed-up", "slow-down", "start-sliding"].includes(prediction.motionOutcome)) return false;
    if (prediction.committed) {
      if (prediction.frictionType == null || prediction.direction == null || prediction.magnitudeCN == null || prediction.motionOutcome == null) return false;
      if (prediction.frictionType === "none" && prediction.direction !== "none") return false;
    }
    return true;
  }
  function validateState(state, options = {}) {
    const stateKeys = ["schemaVersion", "generatorVersion", "physicsVersion", "measurementVersion", "rubricVersion", "seed", "phase", "variant", "fromReview", "balance", "trial", "analysis", "predictions", ...(state?.working ? ["working"] : [])];
    if (!exactKeys(state, stateKeys) || state.schemaVersion !== SCHEMA_VERSION || state.generatorVersion !== GENERATOR_VERSION || state.physicsVersion !== PHYSICS_VERSION || state.measurementVersion !== MEASUREMENT_VERSION || state.rubricVersion !== RUBRIC_VERSION || !integer(state.seed) || state.seed < 0 || state.seed > 0xffffffff || !PHASES.includes(state.phase) || typeof state.fromReview !== "boolean" || !exactKeys(state.balance, ["breakaway", "staticCase", "zeroForce"]) || !Array.isArray(state.predictions) || state.predictions.length !== PREDICTION_COUNT || !exactKeys(state.analysis, ANALYSIS_KEYS) || (state.phase !== "review" && !state.working)) throw new Error("invalid state shape");
    if (state.working && !exactKeys(state.working, ["activeBalanceStep", "activeAnalysisTask", "activePredictionIndex", "reviewEditTarget", "editDraft"])) throw new Error("invalid working shape");
    if (state.trial != null && (!exactKeys(state.trial, ["sampleDtMs", "regularSampleCount", "forceVelocityBase64", "breakaway"]) || state.trial.breakaway != null && !exactKeys(state.trial.breakaway, ["timeMs", "measuredPullCN", "measuredVelocityMMps", "preBreakPeakGridIndex"]))) throw new Error("invalid trial shape");
    if (!state.fromReview && state.phase === "review" && state.working && JSON.stringify(state.working) !== JSON.stringify(emptyWorking())) throw new Error("complete review cannot contain working state");
    if (state.fromReview && state.phase === "review") throw new Error("review-edit must target an editable section");
    if (!validateLearnerForce(state.balance.zeroForce) || !validateStaticCase(state.balance.staticCase) || !validateBreakaway(state.balance.breakaway)) throw new Error("invalid balance answers");
    if (state.balance.zeroForce?.committed !== true && state.balance.staticCase !== null) throw new Error("static task cannot precede zero-force answer");
    if ((state.balance.staticCase?.learnerAppliedForce?.committed !== true || state.balance.staticCase?.learnerForce?.committed !== true) && state.balance.breakaway.bestPullCN !== null) throw new Error("breakaway trial cannot precede static-force answer");
    if (state.balance.breakaway.bestPullCN === null && state.balance.breakaway.learnerMaxCN !== null) throw new Error("maximum-friction answer needs a trial");
    if (state.balance.breakaway.learnerMaxCN !== null && state.balance.breakaway.committed !== true) throw new Error("maximum-friction answer must be committed");
    let decodedTrial = null;
    if (state.trial != null) {
      decodedTrial = Measurement.unpackTrace(state.trial);
      const quality = Measurement.assessTrial(decodedTrial);
      if (!quality.valid && ["analysis", "predict", "review"].includes(state.phase)) throw new Error("trial does not satisfy quality gate");
    }
    if (!state.trial && ANALYSIS_KEYS.some((key) => state.analysis[key] != null)) throw new Error("analysis answers require accepted trial");
    const sampleCount = decodedTrial?.merged?.length || 0;
    if (ANALYSIS_KEYS.some((key) => !validateAnalysisTask(key, state.analysis[key], sampleCount || 1))) throw new Error("invalid analysis task");
    if (state.phase === "review" && !hasAllPredictions(state)) throw new Error("review requires predictions");
    if (state.phase === "review" && !hasAllAnalysisFields(state)) throw new Error("review requires analysis");
    if (state.working?.reviewEditTarget && !state.fromReview) throw new Error("review edit target without fromReview");
    const predictionIds = new Set(), scenarioIds = new Set();
    state.predictions.forEach((prediction) => { if (prediction && (!validatePrediction(prediction) || predictionIds.has(prediction.id) || scenarioIds.has(prediction.scenarioId))) throw new Error("invalid prediction"); if (prediction) { predictionIds.add(prediction.id); scenarioIds.add(prediction.scenarioId); } });
    if (state.fromReview && (!state.working || !state.working.reviewEditTarget || !["balance", "experiment", "analysis", "predict"].includes(state.working.reviewEditTarget.section))) throw new Error("review-edit needs target");
    if (state.fromReview && !exactKeys(state.working.reviewEditTarget, ["section", "semanticKey"])) throw new Error("invalid review edit target shape");
    if (state.fromReview && state.phase !== state.working.reviewEditTarget.section) throw new Error("review-edit phase and target section differ");
    if (state.fromReview && (!allBalanceAnswersCommitted(state) || !state.trial || !hasAllAnalysisFields(state) || !hasAllPredictions(state))) throw new Error("review-edit must preserve complete authority");
    if (state.working && (!Number.isInteger(state.working.activeAnalysisTask) || state.working.activeAnalysisTask < 0 || state.working.activeAnalysisTask >= ANALYSIS_KEYS.length || !Number.isInteger(state.working.activePredictionIndex) || state.working.activePredictionIndex < 0 || state.working.activePredictionIndex >= PREDICTION_COUNT || (state.working.activeBalanceStep !== null && (!Number.isInteger(state.working.activeBalanceStep) || state.working.activeBalanceStep < 0 || state.working.activeBalanceStep > 2)))) throw new Error("invalid working cursor");
    if (!state.fromReview && state.working && (state.working.reviewEditTarget != null || state.working.editDraft != null)) throw new Error("working edit draft outside review-edit");
    if (state.fromReview && state.working.reviewEditTarget.semanticKey != null && typeof state.working.reviewEditTarget.semanticKey !== "string" && !Number.isInteger(state.working.reviewEditTarget.semanticKey)) throw new Error("invalid review edit key");
    if (state.fromReview && state.working.reviewEditTarget.section === "balance" && !BALANCE_EDIT_KEYS.includes(state.working.reviewEditTarget.semanticKey)) throw new Error("invalid balance review-edit key");
    if (state.fromReview && state.working.reviewEditTarget.section === "experiment" && state.working.reviewEditTarget.semanticKey !== null) throw new Error("invalid experiment review-edit key");
    if (state.fromReview && state.working.reviewEditTarget.section === "analysis" && !ANALYSIS_KEYS.includes(state.working.reviewEditTarget.semanticKey)) throw new Error("invalid analysis review-edit key");
    if (state.fromReview && state.working.reviewEditTarget.section === "predict" && (!Number.isInteger(state.working.reviewEditTarget.semanticKey) || state.working.reviewEditTarget.semanticKey < 0 || state.working.reviewEditTarget.semanticKey >= PREDICTION_COUNT)) throw new Error("invalid prediction review-edit key");
    if (state.fromReview && state.working.editDraft != null) {
      if (!exactKeys(state.working.editDraft, ["kind", "value"]) || !["balance", "analysis-task", "prediction"].includes(state.working.editDraft.kind)) throw new Error("invalid review edit draft");
      const target = state.working.reviewEditTarget;
      const expectedKind = { balance: "balance", analysis: "analysis-task", predict: "prediction" }[target.section];
      if (expectedKind && state.working.editDraft.kind !== expectedKind) throw new Error("review edit draft kind does not match target");
      if (target.section === "balance" && state.working.editDraft.kind !== "balance") throw new Error("invalid balance review-edit draft");
      if (target.section === "balance" && target.semanticKey === "zero-force" && !validateLearnerForce(state.working.editDraft.value, { allowUncommitted: true })) throw new Error("invalid zero-force review-edit draft");
      if (target.section === "balance" && target.semanticKey === "static-case" && !validateStaticCase(state.working.editDraft.value, { allowUncommitted: true })) throw new Error("invalid static-force review-edit draft");
      if (target.section === "balance" && target.semanticKey === "breakaway" && (!integer(state.working.editDraft.value) || state.working.editDraft.value < 0 || state.working.editDraft.value > 1200)) throw new Error("invalid maximum-friction review-edit draft");
      if (target.section === "analysis" && (state.working.editDraft.kind !== "analysis-task" || !validateAnalysisTask(target.semanticKey, state.working.editDraft.value, sampleCount || 1))) throw new Error("invalid analysis review-edit draft");
      if (state.working.editDraft.kind === "prediction" && !validatePrediction(state.working.editDraft.value)) throw new Error("invalid prediction review-edit draft");
    }
    if (!options.skipVariant && inferVariant(state) !== state.variant) throw new Error("variant does not match matrix");
    return true;
  }
  function setZeroForceAnswer(state, learnerForce) {
    if (!validateLearnerForce(learnerForce) || !learnerForce?.committed) throw new Error("explicit committed zero-force answer required");
    const editingReview = Boolean(state.fromReview);
    if (!editingReview && state.phase !== "balance") throw new Error("zero-force answer outside balance phase");
    if (editingReview && (state.working?.reviewEditTarget?.section !== "balance" || state.working.reviewEditTarget.semanticKey !== "zero-force")) throw new Error("zero-force answer is not the review-edit target");
    const changed = JSON.stringify(state.balance.zeroForce) !== JSON.stringify(learnerForce);
    const next = clone(state);
    next.balance.zeroForce = clone(learnerForce);
    next.phase = editingReview && !changed ? "review" : "balance";
    next.fromReview = false;
    next.working = editingReview ? emptyWorking() : (next.working || emptyWorking());
    return update(next, {});
  }
  function setStaticForceAnswer(state, applied, learnerAppliedForce, learnerForce) {
    const candidate = { appliedDirection: applied?.direction, appliedMagnitudeCN: applied?.magnitudeCN, learnerAppliedForce: clone(learnerAppliedForce), learnerForce: clone(learnerForce) };
    if (!exactKeys(applied, ["direction", "magnitudeCN"]) || !validateStaticCase(candidate) || !candidate.learnerAppliedForce?.committed || !candidate.learnerForce?.committed) throw new Error("explicit committed applied-force and friction-force answers required");
    const editingReview = Boolean(state.fromReview);
    if (!editingReview && state.phase !== "balance") throw new Error("static-force answer outside balance phase");
    if (!editingReview && state.balance.zeroForce?.committed !== true) throw new Error("zero-force task must be complete first");
    if (editingReview && (state.working?.reviewEditTarget?.section !== "balance" || state.working.reviewEditTarget.semanticKey !== "static-case")) throw new Error("static-force answer is not the review-edit target");
    const changed = JSON.stringify(state.balance.staticCase) !== JSON.stringify(candidate);
    const next = clone(state);
    next.balance.staticCase = candidate;
    next.phase = editingReview && !changed ? "review" : "balance";
    next.fromReview = false;
    next.working = editingReview ? emptyWorking() : (next.working || emptyWorking());
    return update(next, {});
  }
  function recordBreakawayTrial(state, trial) {
    if (state.fromReview || state.phase !== "balance" || state.balance.staticCase?.learnerAppliedForce?.committed !== true || state.balance.staticCase?.learnerForce?.committed !== true) throw new Error("breakaway trial outside balance phase");
    if (!exactKeys(trial, ["direction", "pullCN"]) || !["left", "right"].includes(trial.direction) || !integer(trial.pullCN) || trial.pullCN <= 0 || trial.pullCN > 1200) throw new Error("invalid breakaway trial");
    const next = clone(state); const current = next.balance.breakaway || emptyBreakaway(); current.attempts += 1;
    if (current.bestPullCN === null || trial.pullCN < current.bestPullCN) { current.bestPullCN = trial.pullCN; current.bestDirection = trial.direction; }
    next.balance.breakaway = current; next.working.activeBalanceStep = 2; return update(next, {});
  }
  function setBreakawayAnswer(state, learnerMaxCN) {
    if (!integer(learnerMaxCN) || learnerMaxCN < 0 || learnerMaxCN > 1200) throw new Error("invalid maximum static-friction answer");
    const editingReview = Boolean(state.fromReview);
    if (!editingReview && state.phase !== "balance") throw new Error("maximum static-friction answer outside balance phase");
    if (!editingReview && state.balance.breakaway?.bestPullCN === null) throw new Error("find breakaway before answering maximum static friction");
    if (editingReview && (state.working?.reviewEditTarget?.section !== "balance" || state.working.reviewEditTarget.semanticKey !== "breakaway")) throw new Error("maximum static-friction answer is not the review-edit target");
    const next = clone(state); next.balance.breakaway.learnerMaxCN = learnerMaxCN; next.balance.breakaway.committed = true; next.phase = editingReview ? "review" : "balance"; next.fromReview = false; next.working = editingReview ? emptyWorking() : (next.working || emptyWorking()); return update(next, {});
  }
  function acceptTrial(state, trial) {
    if (state.fromReview || state.phase !== "experiment") throw new Error("trial outside experiment phase");
    const decoded = Measurement.unpackTrace(trial);
    if (!Measurement.assessTrial(decoded).valid) throw new Error("trial quality incomplete");
    const next = clone(state); next.trial = clone(trial); next.phase = "experiment"; next.fromReview = false; next.analysis = emptyAnalysis(); next.working = next.working || emptyWorking(); return update(next, {});
  }
  function setAnalysisTask(state, key, value) {
    if (!ANALYSIS_KEYS.includes(key) || !value) throw new Error("invalid analysis task");
    const editingReview = Boolean(state.fromReview);
    const index = ANALYSIS_KEYS.indexOf(key);
    if (editingReview && (state.working?.reviewEditTarget?.section !== "analysis" || state.working.reviewEditTarget.semanticKey !== key)) throw new Error("analysis task is not the review-edit target");
    if (!editingReview) {
      if (state.phase !== "analysis") throw new Error("analysis task outside analysis phase");
      if (!state.trial) throw new Error("analysis task needs an accepted trial");
      const active = state.working?.activeAnalysisTask ?? 0;
      if (index !== active) throw new Error("analysis task is not the active task");
    }
    const next = clone(state);
    const allowed = key === "breakaway" ? ["markerIndex", "estimatedFsMaxCN", "identifiedAs"] : key === "staticInterval" ? ["startIndex", "endIndex", "frictionType", "relation"] : key === "slowPlateau" ? ["startIndex", "endIndex", "estimatedFkCN"] : key === "acceleration" ? ["startIndex", "endIndex", "relation", "pullEqualsFk"] : ["startIndex", "endIndex", "estimatedFkCN", "speedComparison"];
    const replacement = Object.fromEntries(allowed.filter((field) => Object.hasOwn(value, field)).map((field) => [field, clone(value[field])]));
    const changed = JSON.stringify(state.analysis[key]) !== JSON.stringify(replacement);
    if (!validateAnalysisTask(key, replacement, state.trial ? Measurement.unpackTrace(state.trial).merged.length : 1) || !analysisTaskHasSelection(key, replacement)) throw new Error("invalid analysis task value");
    if (editingReview && !analysisTaskComplete(key, replacement)) throw new Error("review analysis replacement must be complete");
    if (editingReview && !changed) {
      // A same-value review edit is a no-op: leave every upstream answer and
      // the complete review row intact, with no dangling working cursor.
      next.phase = "review";
      next.fromReview = false;
      next.working = emptyWorking();
      return update(next, {});
    }
    next.analysis[key] = replacement;
    next.phase = editingReview ? "predict" : "analysis";
    next.fromReview = editingReview ? false : state.fromReview;
    next.working = editingReview ? emptyWorking() : clone(state.working);
    if (!editingReview) next.working.activeAnalysisTask = index;
    return update(next, {});
  }
  function selectAnalysisTask(state, key) {
    if (!ANALYSIS_KEYS.includes(key) || state.fromReview || state.phase !== "analysis") throw new Error("invalid analysis task selection");
    if (!state.trial) throw new Error("analysis task needs an accepted trial");
    const next = clone(state); next.working.activeAnalysisTask = ANALYSIS_KEYS.indexOf(key); return update(next, {});
  }
  function setAnalysisDraft(state, key, value) {
    if (!state.fromReview) return setAnalysisTask(state, key, value);
    if (state.working?.reviewEditTarget?.section !== "analysis" || state.working.reviewEditTarget.semanticKey !== key) throw new Error("analysis task is not the review-edit target");
    const sampleCount = state.trial ? Measurement.unpackTrace(state.trial).merged.length : 1;
    if (!validateAnalysisTask(key, value, sampleCount) || !analysisTaskHasSelection(key, value)) throw new Error("invalid analysis review-edit draft");
    const next = clone(state); next.working.editDraft = { kind: "analysis-task", value: clone(value) }; return update(next, {});
  }
  function advanceAnalysisTask(state) {
    if (state.fromReview || state.phase !== "analysis") throw new Error("analysis advance outside analysis phase");
    const index = state.working?.activeAnalysisTask ?? 0;
    const key = ANALYSIS_KEYS[index];
    if (!analysisTaskComplete(key, state.analysis[key])) throw new Error("analysis task must be complete before advance");
    if (index >= ANALYSIS_KEYS.length - 1) return update(clone(state), {});
    const next = clone(state); next.working.activeAnalysisTask = index + 1; return update(next, {});
  }
  function setPrediction(state, index, prediction) {
    if (!integer(index) || index < 0 || index >= PREDICTION_COUNT || !prediction) throw new Error("invalid prediction index");
    if (!validatePrediction(prediction)) throw new Error("invalid prediction");
    const editingReview = Boolean(state.fromReview);
    if (!editingReview) {
      if (state.phase !== "predict") throw new Error("prediction outside predict phase");
    } else {
      const target = state.working?.reviewEditTarget;
      if (target?.section !== "predict" || target.semanticKey !== index) throw new Error("prediction is not the review-edit target");
      if (!prediction.committed) {
        const draft = clone(state); draft.working = { ...draft.working, editDraft: { kind: "prediction", value: clone(prediction) } }; return update(draft, {});
      }
    }
    const next = clone(state); next.predictions[index] = clone(prediction); next.working.activePredictionIndex = index; next.phase = editingReview ? "review" : "predict"; next.fromReview = false; if (editingReview) next.working = emptyWorking(); return update(next, {});
  }
  function selectPrediction(state, index) {
    if (!integer(index) || index < 0 || index >= PREDICTION_COUNT || state.fromReview || state.phase !== "predict") throw new Error("invalid prediction selection");
    const next = clone(state); next.working.activePredictionIndex = index; return update(next, {});
  }
  function advancePrediction(state) {
    if (state.fromReview || state.phase !== "predict") throw new Error("prediction advance outside predict phase");
    const index = state.working?.activePredictionIndex ?? 0;
    if (!state.predictions[index]?.committed) throw new Error("prediction must be committed before advance");
    if (index >= PREDICTION_COUNT - 1) return update(clone(state), {});
    const next = clone(state); next.working.activePredictionIndex = index + 1; return update(next, {});
  }
  function setPhase(state, phase) {
    if (!PHASES.includes(phase)) throw new Error("invalid phase");
    if (state.fromReview) throw new Error("review-edit must use its dedicated save or cancel transition");
    const next = clone(state); next.phase = phase; next.fromReview = false; next.working = next.working || emptyWorking();
    if (phase === "review" && (!hasAllAnalysisFields(next) || !hasAllPredictions(next))) throw new Error("prediction incomplete");
    if (phase === "review") next.working = emptyWorking();
    return update(next, {});
  }
  function enterReviewEdit(state, section, semanticKey = null) {
    if (state.phase !== "review" || !["balance", "experiment", "analysis", "predict"].includes(section)) throw new Error("invalid review edit");
    if (section === "balance" && !BALANCE_EDIT_KEYS.includes(semanticKey)) throw new Error("balance review-edit needs an existing task target");
    if (section === "experiment" && semanticKey !== null) throw new Error("experiment review-edit target must be null");
    if (section === "analysis" && !ANALYSIS_KEYS.includes(semanticKey)) throw new Error("analysis review-edit needs a task target");
    if (section === "predict" && (!Number.isInteger(semanticKey) || semanticKey < 0 || semanticKey >= PREDICTION_COUNT || !state.predictions[semanticKey]?.committed)) throw new Error("prediction review-edit needs an existing answer target");
    const next = clone(state); next.fromReview = true; next.phase = section; next.working = next.working || emptyWorking(); next.working.reviewEditTarget = { section, semanticKey };
    const balanceValue = semanticKey === "zero-force" ? next.balance.zeroForce : semanticKey === "static-case" ? next.balance.staticCase : next.balance.breakaway.learnerMaxCN;
    next.working.editDraft = section === "balance" ? { kind: "balance", value: clone(balanceValue) } : section === "analysis" ? { kind: "analysis-task", value: clone(next.analysis[semanticKey]) } : section === "predict" ? { kind: "prediction", value: clone(next.predictions[semanticKey]) } : null;
    return update(next, {});
  }
  function cancelReviewEdit(state) {
    if (!state.fromReview) return clone(state);
    const next = clone(state); next.phase = "review"; next.fromReview = false; next.working = emptyWorking(); return update(next, {});
  }
  function redoExperiment(state) {
    if (state.fromReview && state.working?.reviewEditTarget?.section !== "experiment") throw new Error("redo is not the review-edit target");
    if (!state.fromReview && state.phase !== "experiment") throw new Error("redo outside experiment phase");
    const next = clone(state); next.phase = "experiment"; next.trial = null; next.analysis = emptyAnalysis(); next.fromReview = false; next.working = emptyWorking(); return update(next, {});
  }
  function normalizeReview(state) {
    const next = clone(state); next.phase = "review"; next.variant = "complete"; next.fromReview = false; delete next.working; return next;
  }
  const TYPE_CODE = Object.freeze({ none: 0, static: 1, kinetic: 2 });
  const DIR_CODE = Object.freeze({ none: 0, left: 1, right: 2 });
  const REL_CODE = Object.freeze({ equal: 0, "pull-greater": 1, "pull-less": 2 });
  const OUTCOME_CODE = Object.freeze({ "remain-still": 0, "speed-up": 1, "slow-down": 2, "start-sliding": 3 });
  const inverse = (table) => Object.fromEntries(Object.entries(table).map(([key, value]) => [value, key]));
  const TYPE_FROM_CODE = inverse(TYPE_CODE), DIR_FROM_CODE = inverse(DIR_CODE), REL_FROM_CODE = inverse(REL_CODE), OUTCOME_FROM_CODE = inverse(OUTCOME_CODE);
  function encodeCode(table, value) { return value == null ? null : table[value]; }
  function decodeCode(table, value) { if (value == null) return null; if (!Object.hasOwn(table, value)) throw new Error("invalid enum code"); return table[value]; }
  function encodeForce(force) { return force == null ? null : [encodeCode(TYPE_CODE, force.frictionType), encodeCode(DIR_CODE, force.direction), force.frictionMagnitudeCN, force.committed ? 1 : 0]; }
  function encodeAppliedForce(force) { return force == null ? null : [encodeCode(DIR_CODE, force.direction), force.magnitudeCN, force.committed ? 1 : 0]; }
  function decodeForce(value) {
    if (value == null) return null;
    if (!Array.isArray(value) || (value.length !== 4 && value.length !== 5)) throw new Error("invalid force wire");
    return { frictionType: decodeCode(TYPE_FROM_CODE, value[0]), direction: decodeCode(DIR_FROM_CODE, value[1]), frictionMagnitudeCN: value[2], committed: value[value.length - 1] === 1 };
  }
  function decodeAppliedForce(value) {
    if (value == null) return null;
    if (!Array.isArray(value) || value.length !== 3) throw new Error("invalid applied-force wire");
    return { direction: decodeCode(DIR_FROM_CODE, value[0]), magnitudeCN: value[1], committed: value[2] === 1 };
  }
  function encodeAnalysisTask(key, value) {
    if (!value) return null;
    if (key === "staticInterval") return [value.startIndex, value.endIndex, encodeCode(TYPE_CODE, value.frictionType), encodeCode(REL_CODE, value.relation)];
    if (key === "breakaway") return [value.markerIndex, value.estimatedFsMaxCN, value.identifiedAs];
    if (key === "slowPlateau") return [value.startIndex, value.endIndex, value.estimatedFkCN];
    if (key === "acceleration") return [value.startIndex, value.endIndex, encodeCode(REL_CODE, value.relation), value.pullEqualsFk ?? null];
    return [value.startIndex, value.endIndex, value.estimatedFkCN, value.speedComparison];
  }
  function decodeAnalysisTask(key, value) {
    if (!value) return null;
    if (key === "staticInterval") return { startIndex: value[0], endIndex: value[1], frictionType: decodeCode(TYPE_FROM_CODE, value[2]), relation: decodeCode(REL_FROM_CODE, value[3]) };
    if (key === "breakaway") return { markerIndex: value[0], estimatedFsMaxCN: value[1], identifiedAs: value[2] };
    if (key === "slowPlateau") return { startIndex: value[0], endIndex: value[1], estimatedFkCN: value[2] };
    if (key === "acceleration") return { startIndex: value[0], endIndex: value[1], relation: decodeCode(REL_FROM_CODE, value[2]), pullEqualsFk: value[3] ?? null };
    return { startIndex: value[0], endIndex: value[1], estimatedFkCN: value[2], speedComparison: value[3] ?? null };
  }
  function compactTrial(trial) { return trial == null ? null : { d: trial.sampleDtMs, n: trial.regularSampleCount, x: trial.forceVelocityBase64, b: trial.breakaway ? [trial.breakaway.timeMs, trial.breakaway.measuredPullCN, trial.breakaway.measuredVelocityMMps, trial.breakaway.preBreakPeakGridIndex] : null }; }
  function expandTrial(trial) { return trial == null ? null : { sampleDtMs: trial.d, regularSampleCount: trial.n, forceVelocityBase64: trial.x, breakaway: trial.b ? { timeMs: trial.b[0], measuredPullCN: trial.b[1], measuredVelocityMMps: trial.b[2], preBreakPeakGridIndex: trial.b[3] } : null }; }
  const ANALYSIS_WIRE_KEYS = Object.freeze({ staticInterval: "i", breakaway: "b", slowPlateau: "l", acceleration: "c", fastPlateau: "f" });
  function compactAnswer(state, includeWorking) {
    validateState(state, { skipVariant: state.phase === "review" });
    const breakaway = state.balance.breakaway;
    const answer = { w: WIRE_VERSION, v: [state.schemaVersion, state.generatorVersion, state.physicsVersion, state.measurementVersion, state.rubricVersion], s: state.seed, p: state.phase, q: state.variant, R: Boolean(state.fromReview), b: { z: encodeForce(state.balance.zeroForce), s: state.balance.staticCase ? [encodeCode(DIR_CODE, state.balance.staticCase.appliedDirection), state.balance.staticCase.appliedMagnitudeCN, encodeAppliedForce(state.balance.staticCase.learnerAppliedForce), encodeForce(state.balance.staticCase.learnerForce)] : null, r: [breakaway.attempts, breakaway.bestPullCN, encodeCode(DIR_CODE, breakaway.bestDirection), breakaway.learnerMaxCN, breakaway.committed ? 1 : 0] }, t: compactTrial(state.trial), a: Object.fromEntries(ANALYSIS_KEYS.map((key) => [ANALYSIS_WIRE_KEYS[key], encodeAnalysisTask(key, state.analysis[key])])), P: state.predictions.map((prediction) => prediction ? [prediction.id, prediction.scenarioId, encodeCode(TYPE_CODE, prediction.frictionType), encodeCode(DIR_CODE, prediction.direction), prediction.magnitudeCN ?? null, encodeCode(OUTCOME_CODE, prediction.motionOutcome), prediction.committed ? 1 : 0] : null) };
    if (includeWorking) answer.k = { b: state.working?.activeBalanceStep ?? null, a: state.working?.activeAnalysisTask ?? 0, p: state.working?.activePredictionIndex ?? 0, e: state.working?.reviewEditTarget || null, d: state.working?.editDraft || null };
    return answer;
  }
  function migrateLegacyAnswer(answer, kind) {
    if (!answer || !["s1", "s2", "s3"].includes(answer.w)) return answer;
    if (kind === "review") throw new Error("legacy review cannot be safely migrated to the new Part A contract");
    return { w: WIRE_VERSION, v: [SCHEMA_VERSION, GENERATOR_VERSION, PHYSICS_VERSION, MEASUREMENT_VERSION, RUBRIC_VERSION], s: answer.s, p: "balance", q: "zero-ready", R: false, b: { z: null, s: null, r: [0, null, null, null, 0] }, t: null, a: { i: null, b: null, l: null, c: null, f: null }, P: [null, null, null, null], k: { b: null, a: 0, p: 0, e: null, d: null } };
  }
  function validateWireAnswer(answer, kind) {
    const answerKeys = ["w", "v", "s", "p", "q", "R", "b", "t", "a", "P", ...(kind === "draft" ? ["k"] : [])];
    if (!exactKeys(answer, answerKeys) || answer.w !== WIRE_VERSION || !Array.isArray(answer.v) || answer.v.length !== 5 || answer.v[0] !== SCHEMA_VERSION || answer.v[1] !== GENERATOR_VERSION || answer.v[2] !== PHYSICS_VERSION || answer.v[3] !== MEASUREMENT_VERSION || answer.v[4] !== RUBRIC_VERSION || !integer(answer.s) || answer.s < 0 || answer.s > 0xffffffff || !PHASES.includes(answer.p) || typeof answer.q !== "string" || typeof answer.R !== "boolean") throw new Error("invalid answer wire header");
    if (!exactKeys(answer.b, ["r", "s", "z"]) || (answer.b.z !== null && (!Array.isArray(answer.b.z) || (answer.b.z.length !== 4 && answer.b.z.length !== 5))) || (answer.b.s !== null && (!Array.isArray(answer.b.s) || answer.b.s.length !== 4)) || !Array.isArray(answer.b.r) || answer.b.r.length !== 5) throw new Error("invalid answer balance wire");
    if (!answer.a || typeof answer.a !== "object" || Object.keys(answer.a).sort().join(",") !== Object.values(ANALYSIS_WIRE_KEYS).sort().join(",")) throw new Error("invalid answer analysis wire");
    if (!Array.isArray(answer.P) || answer.P.length !== PREDICTION_COUNT) throw new Error("invalid answer prediction wire");
    if (answer.t !== null && (!exactKeys(answer.t, ["d", "n", "x", "b"]) || !integer(answer.t.d) || !integer(answer.t.n) || typeof answer.t.x !== "string" || (answer.t.b !== null && (!Array.isArray(answer.t.b) || answer.t.b.length !== 4)))) throw new Error("invalid answer trial wire");
    if (kind === "draft" && (!answer.k || typeof answer.k !== "object" || Object.keys(answer.k).sort().join(",") !== ["a", "b", "d", "e", "p"].join(","))) throw new Error("draft answer missing working wire");
    if (kind === "review" && Object.hasOwn(answer, "k")) throw new Error("review answer contains working wire");
    if (kind === "review" && (answer.p !== "review" || answer.q !== "complete" || answer.R !== false)) throw new Error("review answer has a noncanonical header");
    if (answer.b.z !== null && (!Number.isInteger(answer.b.z[2]) || ![0, 1].includes(answer.b.z[answer.b.z.length - 1]))) throw new Error("invalid zero-force wire");
    if (answer.b.s !== null && (!Object.hasOwn(DIR_FROM_CODE, answer.b.s[0]) || !Number.isInteger(answer.b.s[1]) || answer.b.s[1] <= 0 || answer.b.s[1] > 1200 || !Array.isArray(answer.b.s[2]) || answer.b.s[2].length !== 3 || !Object.hasOwn(DIR_FROM_CODE, answer.b.s[2][0]) || !Number.isInteger(answer.b.s[2][1]) || answer.b.s[2][1] <= 0 || answer.b.s[2][1] > 1200 || ![0, 1].includes(answer.b.s[2][2]) || !Array.isArray(answer.b.s[3]) || (answer.b.s[3].length !== 4 && answer.b.s[3].length !== 5))) throw new Error("invalid static-force wire");
    if (!Number.isInteger(answer.b.r[0]) || answer.b.r[0] < 0 || answer.b.r[0] > 1000 || (answer.b.r[1] !== null && (!Number.isInteger(answer.b.r[1]) || answer.b.r[1] <= 0 || answer.b.r[1] > 1200)) || (answer.b.r[2] !== null && !Object.hasOwn(DIR_FROM_CODE, answer.b.r[2])) || (answer.b.r[3] !== null && (!Number.isInteger(answer.b.r[3]) || answer.b.r[3] < 0 || answer.b.r[3] > 1200)) || ![0, 1].includes(answer.b.r[4])) throw new Error("invalid breakaway wire");
    for (const item of answer.P) if (item !== null && (!Array.isArray(item) || item.length !== 7 || ![0, 1].includes(item[6]))) throw new Error("invalid prediction wire");
    const analysisLengths = { i: 4, b: 3, l: 3, c: 4, f: 4 };
    for (const [key, length] of Object.entries(analysisLengths)) if (answer.a[key] !== null && (!Array.isArray(answer.a[key]) || answer.a[key].length !== length)) throw new Error("invalid analysis wire");
    return true;
  }
  function expandAnswer(answer) {
    if (!answer || answer.w !== WIRE_VERSION) return clone(answer);
    const versions = answer.v || [];
    const analysis = {};
    ANALYSIS_KEYS.forEach((key) => { analysis[key] = decodeAnalysisTask(key, answer.a?.[ANALYSIS_WIRE_KEYS[key]] || null); });
    const staticWire = answer.b?.s;
    const breakawayWire = answer.b?.r || [0, null, null, null, 0];
    return { schemaVersion: versions[0], generatorVersion: versions[1], physicsVersion: versions[2], measurementVersion: versions[3], rubricVersion: versions[4], seed: answer.s, phase: answer.p, variant: answer.q, fromReview: Boolean(answer.R), balance: { zeroForce: decodeForce(answer.b?.z || null), staticCase: staticWire ? { appliedDirection: decodeCode(DIR_FROM_CODE, staticWire[0]), appliedMagnitudeCN: staticWire[1], learnerAppliedForce: decodeAppliedForce(staticWire[2]), learnerForce: decodeForce(staticWire[3]) } : null, breakaway: { attempts: breakawayWire[0], bestPullCN: breakawayWire[1], bestDirection: decodeCode(DIR_FROM_CODE, breakawayWire[2]), learnerMaxCN: breakawayWire[3], committed: breakawayWire[4] === 1 } }, trial: expandTrial(answer.t), analysis, predictions: (answer.P || [null, null, null, null]).map((item) => item ? { id: item[0], scenarioId: item[1], frictionType: decodeCode(TYPE_FROM_CODE, item[2]), direction: decodeCode(DIR_FROM_CODE, item[3]), magnitudeCN: item[4] ?? null, motionOutcome: decodeCode(OUTCOME_FROM_CODE, item[5]), committed: item[6] === 1 } : null), working: { activeBalanceStep: answer.k?.b ?? null, activeAnalysisTask: answer.k?.a ?? 0, activePredictionIndex: answer.k?.p ?? 0, reviewEditTarget: answer.k?.e || null, editDraft: answer.k?.d || null } };
  }
  function encodeDraft(state) { validateState(state); return compactAnswer(state, true); }
  function encodeReview(state) { const review = normalizeReview(state); validateState({ ...review, working: emptyWorking(), variant: "complete" }, { skipVariant: true }); return compactAnswer({ ...review, working: emptyWorking() }, false); }
  function decodeSnapshot(snapshot, scenario, kind = "draft") {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || !snapshot.answer) throw new Error("invalid snapshot envelope");
    const wire = migrateLegacyAnswer(snapshot.answer, kind);
    validateWireAnswer(wire, kind);
    if (scenario && (scenario.seed !== wire.s || scenario.generatorVersion !== GENERATOR_VERSION || scenario.physicsVersion !== PHYSICS_VERSION || scenario.measurementVersion !== MEASUREMENT_VERSION || (Array.isArray(scenario.predictions) && scenario.predictions.some((spec, index) => wire.P[index] && (wire.P[index][0] !== spec.id || wire.P[index][1] !== spec.scenarioId))))) throw new Error("snapshot scenario mismatch");
    let answer = expandAnswer(wire);
    if (kind === "review") {
      delete answer.working; answer.phase = "review"; answer.variant = "complete"; answer.fromReview = false;
    } else answer.variant = inferVariant(answer);
    validateState(answer, { skipVariant: kind === "review" });
    return answer;
  }
  function answerForSnapshot(state, kind = "draft") { return kind === "review" ? encodeReview(state) : encodeDraft(state); }
  function hasCompleteAnswer(state) { return state.phase === "review" && allBalanceAnswersCommitted(state) && Boolean(state.trial) && hasAllAnalysisFields(state) && hasAllPredictions(state); }
  function transitionNames() { return ["setZeroForceAnswer", "setStaticForceAnswer", "recordBreakawayTrial", "setBreakawayAnswer", "acceptTrial", "setAnalysisTask", "selectAnalysisTask", "setAnalysisDraft", "advanceAnalysisTask", "setPrediction", "selectPrediction", "advancePrediction", "setPhase", "enterReviewEdit", "cancelReviewEdit", "redoExperiment"]; }

  const transitions = { setZeroForceAnswer, setStaticForceAnswer, recordBreakawayTrial, setBreakawayAnswer, acceptTrial, setAnalysisTask, selectAnalysisTask, setAnalysisDraft, replaceAnalysis: setAnalysisTask, advanceAnalysisTask, setPrediction, selectPrediction, replacePrediction: setPrediction, advancePrediction, setPhase, enterReviewEdit, editSection: enterReviewEdit, cancelReviewEdit, redoExperiment, clearTrial: redoExperiment };
  return Object.freeze({ SCHEMA_VERSION, WIRE_VERSION, PHASES, BALANCE_EDIT_KEYS, PREDICTION_COUNT, ANALYSIS_KEYS, freshState, clone, allBalanceAnswersCommitted, analysisTaskComplete, analysisTaskHasSelection, hasAllAnalysisFields, hasAllPredictions, inferVariant, validateState, validateAnswer: validateState, encodeDraft, encodeReview, answerForSnapshot, decodeSnapshot, normalizeReview, hasCompleteAnswer, transitionNames, transitions, emptyAnalysis, emptyWorking });
});
