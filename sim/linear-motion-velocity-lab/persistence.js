(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./motion-model.js") : root.LinearMotionModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.LinearMotionScoring;
  const api = factory(model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, Scoring) {
  "use strict";

  const VERSION = 3;
  const ROWS = {
    "uniform/ready": 0, "uniform/paused-measuring": 0, "uniform/captured": 0, "uniform/answered": 0,
    "variable/ready": 1, "variable/paused-measuring": 1, "variable/captured": 1, "variable/answered": 1,
    "instant/exploring": 2, "instant/answered": 2, "review/complete": 3,
    "uniform/review-edit-ready": 0, "uniform/review-edit-paused-measuring": 0, "uniform/review-edit-captured": 0, "uniform/review-edit-answered": 0,
    "variable/review-edit-ready": 1, "variable/review-edit-paused-measuring": 1, "variable/review-edit-captured": 1, "variable/review-edit-answered": 1,
    "instant/review-edit-answered": 2
  };
  const COMPLETE = ["displacement", "time", "averageVelocity", "relationship"];
  const EMPTY_ANSWERS = () => ({ uniform: null, variable: null, instant: null });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function initialState(definition) {
    return {
      v: VERSION, definition: clone(definition), phase: "uniform", variant: "ready", stage: 0,
      returnToReview: false, scene: { simulationTime: 0, paused: 1, observationStarted: 0 }, uniformMeasurement: null,
      variableMeasurement: null, answers: EMPTY_ANSWERS(), viewedWindowCount: 0
    };
  }
  function encode(source) {
    const state = clone(source);
    state.v = VERSION;
    state.scene = { simulationTime: Number(source.scene?.simulationTime || 0), paused: 1, observationStarted: source.scene?.observationStarted === 1 ? 1 : 0 };
    const reviewEdit = Boolean(source.returnToReview);
    if (source.running || source.timerRunning) {
      if (source.phase === "uniform" && source.timerRunning) state.variant = reviewEdit ? "review-edit-paused-measuring" : "paused-measuring";
      else if (source.phase === "variable" && source.timerRunning) state.variant = reviewEdit ? "review-edit-paused-measuring" : "paused-measuring";
    }
    delete state.running;
    delete state.timerRunning;
    delete state.locked;
    delete state.result;
    if (!validateDraft(state)) throw new Error("Invalid draft state");
    return state;
  }
  function decode(value) { return validateDraft(value) ? clone(value) : null; }
  function makeReview(source) {
    const review = {
      v: VERSION, locked: 1, definition: clone(source.definition),
      uniformMeasurement: reviewMeasurement(source.uniformMeasurement),
      variableMeasurement: reviewMeasurement(source.variableMeasurement),
      answers: clone(source.answers)
    };
    if (!validateReview(review)) throw new Error("Invalid review state");
    return review;
  }
  function decodeReview(value) { return validateReview(value) ? clone(value) : null; }
  function reviewMeasurement(measurement) {
    if (!measurement) return null;
    return {
      startModelTime: measurement.startModelTime,
      endModelTime: measurement.endModelTime ?? measurement.currentOrEndModelTime,
      readingOrigin: measurement.readingOrigin, x1: measurement.x1, x2: measurement.x2, dt: measurement.dt
    };
  }
  function fromReview(review) {
    const valid = decodeReview(review);
    if (!valid) return null;
    return {
      v: VERSION, definition: valid.definition, phase: "review", variant: "complete", stage: 3,
      returnToReview: false, scene: { simulationTime: 0, paused: 1, observationStarted: 0 },
      uniformMeasurement: { ...valid.uniformMeasurement, currentOrEndModelTime: valid.uniformMeasurement.endModelTime },
      variableMeasurement: { ...valid.variableMeasurement, currentOrEndModelTime: valid.variableMeasurement.endModelTime },
      answers: valid.answers, viewedWindowCount: 4
    };
  }

  function validateDraft(state) {
    if (!state || state.v !== VERSION || !Model.validateDefinition(state.definition)) return false;
    const key = `${state.phase}/${state.variant}`;
    if (!(key in ROWS) || state.stage !== ROWS[key] || !validScene(state.scene, state.definition, state.phase) || !validAnswersShape(state.answers)) return false;
    const edit = state.variant.startsWith("review-edit-");
    if (Boolean(state.returnToReview) !== edit || !Number.isInteger(state.viewedWindowCount) || state.viewedWindowCount < 0 || state.viewedWindowCount > 4) return false;
    const u = measurementKind(state.definition, "uniform", state.uniformMeasurement, state.phase === "uniform" ? state.scene.simulationTime : null);
    const v = measurementKind(state.definition, "variable", state.variableMeasurement, state.phase === "variable" ? state.scene.simulationTime : null);
    const ua = stageAnswer(state.answers.uniform, "uniform");
    const va = stageAnswer(state.answers.variable, "variable");
    const ia = instantAnswer(state.answers.instant, state.definition);
    if (u === "invalid" || v === "invalid" || ua === "invalid" || va === "invalid" || ia === "invalid") return false;
    if (["uniform", "variable"].includes(state.phase)) {
      const kind = state.phase === "uniform" ? u : v;
      const measurement = state.phase === "uniform" ? state.uniformMeasurement : state.variableMeasurement;
      const minimum = state.phase === "uniform" ? 1.5 : Model.cycleDuration(state.definition.variable);
      if (state.variant.endsWith("ready") && !Model.hasModelTimeHeadroom(state.scene.simulationTime, minimum)) return false;
      if (kind === "active" && !Model.hasModelTimeHeadroom(measurement.startModelTime, minimum)) return false;
    }
    const downstream = edit && ((state.phase === "uniform" && va === "complete" && ia === "complete") || (state.phase === "variable" && ua === "complete" && ia === "complete") || (state.phase === "instant" && ua === "complete" && va === "complete"));
    if (edit && !downstream) return false;
    switch (key) {
      case "uniform/ready": return u === "empty" && v === "empty" && ua === "empty" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "uniform/paused-measuring": return u === "active" && v === "empty" && ua === "empty" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "uniform/captured": return u === "captured" && v === "empty" && ua === "empty" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "uniform/answered": return u === "captured" && v === "empty" && ua === "complete" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "variable/ready": return u === "captured" && ua === "complete" && v === "empty" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "variable/paused-measuring": return u === "captured" && ua === "complete" && v === "active" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "variable/captured": return u === "captured" && ua === "complete" && v === "captured" && va === "empty" && ia === "empty" && state.viewedWindowCount === 0;
      case "variable/answered": return u === "captured" && ua === "complete" && v === "captured" && va === "complete" && ia === "empty" && state.viewedWindowCount === 0;
      case "instant/exploring": return u === "captured" && v === "captured" && ua === "complete" && va === "complete" && ia === "empty";
      case "instant/answered": return u === "captured" && v === "captured" && ua === "complete" && va === "complete" && ia === "complete" && state.viewedWindowCount === 4;
      case "review/complete": return u === "captured" && v === "captured" && ua === "complete" && va === "complete" && ia === "complete" && state.viewedWindowCount === 4;
      case "uniform/review-edit-ready": return downstream && u === "empty" && ua === "empty" && state.viewedWindowCount === 4;
      case "uniform/review-edit-paused-measuring": return downstream && u === "active" && ua === "empty" && state.viewedWindowCount === 4;
      case "uniform/review-edit-captured": return downstream && u === "captured" && ua === "empty" && state.viewedWindowCount === 4;
      case "uniform/review-edit-answered": return downstream && u === "captured" && ua === "complete" && state.viewedWindowCount === 4;
      case "variable/review-edit-ready": return downstream && v === "empty" && va === "empty" && state.viewedWindowCount === 4;
      case "variable/review-edit-paused-measuring": return downstream && v === "active" && va === "empty" && state.viewedWindowCount === 4;
      case "variable/review-edit-captured": return downstream && v === "captured" && va === "empty" && state.viewedWindowCount === 4;
      case "variable/review-edit-answered": return downstream && v === "captured" && va === "complete" && state.viewedWindowCount === 4;
      case "instant/review-edit-answered": return downstream && ia === "complete" && state.viewedWindowCount === 4;
      default: return false;
    }
  }
  function validateReview(review) {
    if (!review || review.v !== VERSION || review.locked !== 1 || !Model.validateDefinition(review.definition) || !validAnswersShape(review.answers)) return false;
    if (measurementKind(review.definition, "uniform", review.uniformMeasurement, null, "review") !== "captured" || measurementKind(review.definition, "variable", review.variableMeasurement, null, "review") !== "captured") return false;
    return stageAnswer(review.answers.uniform, "uniform") === "complete" && stageAnswer(review.answers.variable, "variable") === "complete" && instantAnswer(review.answers.instant, review.definition) === "complete";
  }
  function validScene(scene, definition, phase) {
    if (!scene || !Model.safeModelTime(scene.simulationTime) || scene.paused !== 1 || ![0, 1].includes(scene.observationStarted)) return false;
    if (scene.observationStarted === 0 && scene.simulationTime !== 0) return false;
    if (!["uniform", "variable"].includes(phase)) return true;
    const position = phase === "uniform"
      ? Model.uniformPosition(definition.uniform, scene.simulationTime)
      : Model.variablePosition(definition.variable, scene.simulationTime);
    return Model.safeWorldPosition(position);
  }
  function validAnswersShape(answers) { return Boolean(answers && ["uniform", "variable", "instant"].every((key) => key in answers)); }
  function stageAnswer(answer, type) {
    if (answer == null) return "empty";
    if (!answer || Object.keys(answer).length !== COMPLETE.length || !COMPLETE.every((key) => key in answer)) return "invalid";
    if (![answer.displacement, answer.time, answer.averageVelocity].every(Scoring.validNumericAnswer)) return "invalid";
    const expected = type === "uniform" ? "yes" : "no";
    return ["yes", "no"].includes(answer.relationship) && typeof expected === "string" ? "complete" : "invalid";
  }
  function instantAnswer(answer, definition) {
    if (answer == null) return "empty";
    if (!answer || Object.keys(answer).length !== 3 || !Scoring.completeAnswers({
      uniform: { displacement: "1.00", time: "1.00", averageVelocity: "1.00", relationship: "yes" },
      variable: { displacement: "1.00", time: "1.00", averageVelocity: "1.00", relationship: "no" }, instant: answer
    })) return "invalid";
    return definition.instantOptions.some((option) => option.id === answer.predictionChoice) ? "complete" : "invalid";
  }
  function measurementKind(definition, type, measurement, activeSceneTime = null, schema = "draft") {
    if (measurement == null) return "empty";
    if (!measurement || !Model.safeModelTime(measurement.startModelTime) || !Number.isFinite(measurement.readingOrigin) || !Number.isFinite(measurement.x1) || !Number.isFinite(measurement.dt)) return "invalid";
    const hasEnd = measurement.endModelTime != null;
    const hasCurrent = measurement.currentOrEndModelTime != null;
    if (schema === "review" ? (!hasEnd || hasCurrent || measurement.x2 == null) :
        (measurement.x2 == null ? (hasEnd || !hasCurrent) : (!hasEnd || !hasCurrent))) return "invalid";
    if (measurement.endModelTime != null && measurement.currentOrEndModelTime != null &&
        (!Number.isFinite(measurement.endModelTime) || !Number.isFinite(measurement.currentOrEndModelTime) ||
          Math.abs(measurement.endModelTime - measurement.currentOrEndModelTime) > 1e-9)) return "invalid";
    const end = measurement.endModelTime ?? measurement.currentOrEndModelTime;
    if (!Model.safeModelTime(end) || end < measurement.startModelTime || measurement.dt < 0) return "invalid";
    const position = type === "uniform"
      ? (time) => Model.uniformPosition(definition.uniform, time)
      : (time) => Model.variablePosition(definition.variable, time);
    let expectedX1;
    let expectedDuration;
    try {
      const startPosition = position(measurement.startModelTime);
      if (measurement.readingOrigin !== Model.rollingReadingOrigin(startPosition)) return "invalid";
      expectedX1 = Model.canonicalNumber(Model.readingPosition(startPosition, measurement.readingOrigin));
      expectedDuration = Model.canonicalNumber(end - measurement.startModelTime);
    } catch { return "invalid"; }
    if (measurement.x1 !== expectedX1 || measurement.dt !== expectedDuration) return "invalid";
    if (measurement.x2 == null) {
      if (activeSceneTime == null || Math.abs(end - activeSceneTime) > 1e-9) return "invalid";
      return "active";
    }
    if (activeSceneTime != null && activeSceneTime + 1e-9 < end) return "invalid";
    if (end === measurement.startModelTime) return "invalid";
    let expectedX2;
    try { expectedX2 = Model.canonicalNumber(Model.readingPosition(position(end), measurement.readingOrigin)); } catch { return "invalid"; }
    if (!Number.isFinite(measurement.x2) || measurement.x2 !== expectedX2) return "invalid";
    if (type === "uniform" && end - measurement.startModelTime < 1.5 - 1e-9) return "invalid";
    if (type === "variable" && end - measurement.startModelTime < Model.cycleDuration(definition.variable) - 1e-9) return "invalid";
    return "captured";
  }
  function next(state, action) {
    const copy = clone(state);
    const key = `${copy.phase}/${copy.variant}`;
    if (action === "advance" && key === "uniform/answered") Object.assign(copy, { phase: "variable", variant: "ready", stage: 1, scene: { simulationTime: 0, paused: 1, observationStarted: 0 } });
    else if (action === "advance" && key === "variable/answered") Object.assign(copy, { phase: "instant", variant: "exploring", stage: 2, scene: { simulationTime: 0, paused: 1, observationStarted: 0 } });
    else if (action === "review" && key === "instant/answered") Object.assign(copy, { phase: "review", variant: "complete", stage: 3, returnToReview: false });
    else if (action === "return-review" && copy.returnToReview && copy.variant.endsWith("answered")) Object.assign(copy, { phase: "review", variant: "complete", stage: 3, returnToReview: false });
    else if (action === "edit-uniform" && key === "review/complete") Object.assign(copy, { phase: "uniform", variant: "review-edit-answered", stage: 0, returnToReview: true, scene: { simulationTime: copy.uniformMeasurement.currentOrEndModelTime, paused: 1, observationStarted: 1 } });
    else if (action === "edit-variable" && key === "review/complete") Object.assign(copy, { phase: "variable", variant: "review-edit-answered", stage: 1, returnToReview: true, scene: { simulationTime: copy.variableMeasurement.currentOrEndModelTime, paused: 1, observationStarted: 1 } });
    else if (action === "edit-instant" && key === "review/complete") Object.assign(copy, { phase: "instant", variant: "review-edit-answered", stage: 2, returnToReview: true });
    else return null;
    return validateDraft(copy) ? copy : null;
  }

  function startupView(outcome) {
    return {
      editable: outcome === "editable",
      locked: outcome !== "editable",
      mode: outcome === "review" ? "review" : outcome === "frozen" ? "pending" : outcome === "editable" ? "activity" : "technical"
    };
  }
  function submissionView(outcome) {
    const state = outcome?.activityState || "retry";
    if (state === "success") return { locked: true, mode: "review", retryable: false, trusted: true };
    if (state === "committed") return { locked: true, mode: "committed", retryable: true, trusted: true };
    if (state === "frozen") return { locked: true, mode: "pending", retryable: true, trusted: false };
    return { locked: !outcome?.retryable, mode: "technical", retryable: Boolean(outcome?.retryable), trusted: false };
  }

  function retryAction(outcome) {
    const state = outcome?.activityState || "retry";
    if (state === "committed") return "finish";
    if (state === "frozen") return "pending";
    if (state === "retry" && outcome?.retryable) return "resubmit";
    return "none";
  }

  function runtimeFlagsForRestore(state) {
    if (!validateDraft(state)) return null;
    return { running: false, timerRunning: state.variant.endsWith("paused-measuring") };
  }

  function resumeRuntime(flags) {
    if (!flags || typeof flags.timerRunning !== "boolean") return null;
    return { running: true, timerRunning: flags.timerRunning };
  }

  function measurementControlState({ timerRunning, duration, minimum, captured, answered }) {
    if (![duration, minimum].every(Number.isFinite) || duration < 0 || minimum < 0) return null;
    return {
      label: timerRunning ? "停止計時" : "開始計時",
      disabled: Boolean(captured || answered || (timerRunning && duration + 1e-9 < minimum)),
      canStop: Boolean(timerRunning && !captured && !answered && duration + 1e-9 >= minimum)
    };
  }

  function continueOnce(source) {
    const state = clone(source);
    if (!validateDraft(state)) return null;
    const edit = state.returnToReview;
    if (["uniform", "variable"].includes(state.phase)) {
      const type = state.phase;
      const field = `${type}Measurement`;
      const position = type === "uniform"
        ? (time) => Model.uniformPosition(state.definition.uniform, time)
        : (time) => Model.variablePosition(state.definition.variable, time);
      if (state.variant.endsWith("ready")) {
        const start = state.scene.simulationTime;
        const readingOrigin = Model.rollingReadingOrigin(position(start));
        state[field] = { startModelTime: start, currentOrEndModelTime: start, readingOrigin, x1: Model.canonicalNumber(Model.readingPosition(position(start), readingOrigin)), x2: null, dt: 0 };
        state.variant = edit ? "review-edit-paused-measuring" : "paused-measuring";
      } else if (state.variant.endsWith("paused-measuring")) {
        const duration = type === "uniform" ? 1.5 : Model.cycleDuration(state.definition.variable);
        const end = state[field].startModelTime + duration;
        state[field] = { ...Model.captureMeasurement(position, state[field].startModelTime, end), currentOrEndModelTime: end };
        state.scene.simulationTime = end;
        state.scene.observationStarted = 1;
        state.variant = edit ? "review-edit-captured" : "captured";
      } else if (state.variant.endsWith("captured")) {
        const expected = Model.expectedFromMeasurement(state[field]);
        state.answers[type] = { displacement: Model.formatInput3(expected.displacement), time: Model.formatInput3(expected.time), averageVelocity: Model.formatInput3(expected.averageVelocity), relationship: type === "uniform" ? "yes" : "no" };
        state.variant = edit ? "review-edit-answered" : "answered";
      } else if (state.variant.endsWith("answered")) {
        return next(state, edit ? "return-review" : "advance");
      }
    } else if (state.phase === "instant") {
      if (state.variant === "exploring") state.viewedWindowCount += 1;
      else return next(state, edit ? "return-review" : "review");
    } else if (state.phase === "review") return next(state, "edit-instant");
    return validateDraft(state) ? state : null;
  }

  return { VERSION, ROWS, initialState, encode, decode, makeReview, decodeReview, fromReview, validateDraft, validateReview, next, startupView, submissionView, retryAction, runtimeFlagsForRestore, resumeRuntime, measurementControlState, continueOnce };
});
