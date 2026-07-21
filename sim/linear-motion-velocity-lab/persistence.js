(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./motion-model.js") : root.LinearMotionModel;
  const scoring = typeof module === "object" && module.exports ? require("./scoring.js") : root.LinearMotionScoring;
  const api = factory(model, scoring);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, Scoring) {
  "use strict";

  const VERSION = 5;
  const ROWS = {
    "uniform/ready": 0, "uniform/paused-measuring": 0, "uniform/captured": 0, "uniform/answered": 0,
    "variable/ready": 1, "variable/paused-measuring": 1, "variable/captured": 1, "variable/answered": 1,
    "instant/exploring": 2, "instant/answered": 2, "review/incomplete": 3, "review/complete": 3,
    "uniform/review-edit-ready": 0, "uniform/review-edit-paused-measuring": 0, "uniform/review-edit-captured": 0, "uniform/review-edit-answered": 0,
    "variable/review-edit-ready": 1, "variable/review-edit-paused-measuring": 1, "variable/review-edit-captured": 1, "variable/review-edit-answered": 1,
    "instant/review-edit-exploring": 2, "instant/review-edit-answered": 2
  };
  const COMPLETE = ["displacement", "time", "averageVelocity", "relationship"];
  const EMPTY_ANSWERS = () => ({ uniform: null, variable: null, instant: null });
  const EMPTY_DRAFT_ANSWERS = () => ({
    uniform: { displacement: "", time: "", averageVelocity: "", relationship: "" },
    variable: { displacement: "", time: "", averageVelocity: "", relationship: "" },
    instant: { predictionChoice: "", concept: "", stoppedVelocity: "" }
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function initialState(definition) {
    return {
      v: VERSION, definition: clone(definition), phase: "uniform", variant: "ready", stage: 0,
      returnToReview: false, scene: { simulationTime: 0, paused: 1, observationStarted: 0 }, uniformMeasurement: null,
      variableMeasurement: null, answers: EMPTY_ANSWERS(), draftAnswers: EMPTY_DRAFT_ANSWERS(), viewedWindowCount: 0
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
      answers: valid.answers, draftAnswers: clone(valid.answers), viewedWindowCount: 4
    };
  }

  function validateDraft(state) {
    if (!state || state.v !== VERSION || !Model.validateDefinition(state.definition)) return false;
    const key = `${state.phase}/${state.variant}`;
    if (!(key in ROWS) || state.stage !== ROWS[key] || !validScene(state.scene, state.definition, state.phase) || !validAnswersShape(state.answers) || !validDraftAnswers(state.draftAnswers, state.definition)) return false;
    if (state.variant.endsWith("paused-measuring") && state.scene.observationStarted !== 1) return false;
    const edit = state.variant.startsWith("review-edit-");
    if (Boolean(state.returnToReview) !== edit || !Number.isInteger(state.viewedWindowCount) || state.viewedWindowCount < 0 || state.viewedWindowCount > 4) return false;
    const u = measurementKind(state.definition, "uniform", state.uniformMeasurement, activeMeasurementTime(state, "uniform"));
    const v = measurementKind(state.definition, "variable", state.variableMeasurement, activeMeasurementTime(state, "variable"));
    const ua = stageAnswer(state.answers.uniform, "uniform");
    const va = stageAnswer(state.answers.variable, "variable");
    const ia = instantAnswer(state.answers.instant, state.definition);
    if (u === "invalid" || v === "invalid" || ua === "invalid" || va === "invalid" || ia === "invalid") return false;
    if (ua === "complete" && (u !== "captured" || !confirmedMatchesDraft(state.answers.uniform, state.draftAnswers.uniform))) return false;
    if (va === "complete" && (v !== "captured" || !confirmedMatchesDraft(state.answers.variable, state.draftAnswers.variable))) return false;
    if (ia === "complete" && (state.viewedWindowCount !== 4 || !confirmedMatchesDraft(state.answers.instant, state.draftAnswers.instant))) return false;
    if (["uniform", "variable"].includes(state.phase)) {
      const kind = state.phase === "uniform" ? u : v;
      const measurement = state.phase === "uniform" ? state.uniformMeasurement : state.variableMeasurement;
      const minimum = state.phase === "uniform" ? 1.5 : state.definition.variableMinimumDuration;
      if (state.variant.endsWith("ready") && !Model.hasModelTimeHeadroom(state.scene.simulationTime, minimum)) return false;
      if (kind === "active" && !Model.hasModelTimeHeadroom(state.scene.simulationTime, Math.max(0, minimum - (state.scene.simulationTime - measurement.startModelTime)))) return false;
    }
    const expected = variantFor(state.phase, state.returnToReview, { u, v, ua, va, ia });
    if (state.variant !== expected) return false;
    if (state.phase === "review" && state.returnToReview) return false;
    return true;
  }
  function validateReview(review) {
    if (!review || review.v !== VERSION || review.locked !== 1 || !Model.validateDefinition(review.definition) || !validAnswersShape(review.answers)) return false;
    if (measurementKind(review.definition, "uniform", review.uniformMeasurement, null, "review") !== "captured" || measurementKind(review.definition, "variable", review.variableMeasurement, null, "review") !== "captured") return false;
    return stageAnswer(review.answers.uniform, "uniform") === "complete" && stageAnswer(review.answers.variable, "variable") === "complete" && instantAnswer(review.answers.instant, review.definition) === "complete";
  }
  function validScene(scene, definition, phase) {
    if (!scene || !Model.safeModelTime(scene.simulationTime) || scene.paused !== 1 || ![0, 1].includes(scene.observationStarted)) return false;
    if (scene.observationStarted === 0 && scene.simulationTime !== 0) return false;
    if (!["uniform", "variable"].includes(phase)) return scene.simulationTime === 0 && scene.observationStarted === 0;
    const position = phase === "uniform"
      ? Model.uniformPosition(definition.uniform, scene.simulationTime)
      : Model.variablePosition(definition.variable, scene.simulationTime);
    return Model.safeWorldPosition(position);
  }
  function validAnswersShape(answers) { return Boolean(answers && ["uniform", "variable", "instant"].every((key) => key in answers)); }
  function validDraftAnswers(drafts, definition) {
    if (!drafts || Object.keys(drafts).length !== 3) return false;
    for (const type of ["uniform", "variable"]) {
      const value = drafts[type];
      if (!value || Object.keys(value).length !== 4 || !["displacement", "time", "averageVelocity"].every((key) => typeof value[key] === "string" && value[key].length <= Model.MAX_INPUT_LENGTH)) return false;
      if (!["", "yes", "no"].includes(value.relationship)) return false;
    }
    const instant = drafts.instant;
    if (!instant || Object.keys(instant).length !== 3 || typeof instant.stoppedVelocity !== "string" || instant.stoppedVelocity.length > Model.MAX_INPUT_LENGTH) return false;
    if (instant.predictionChoice !== "" && !definition.instantOptions.some((option) => option.id === instant.predictionChoice)) return false;
    if (!["", ...Scoring.CONCEPTS].includes(instant.concept)) return false;
    return true;
  }
  function confirmedMatchesDraft(answer, draft) {
    return Boolean(answer && draft && Object.keys(answer).length === Object.keys(draft).length && Object.keys(answer).every((key) => answer[key] === draft[key]));
  }
  function activeMeasurementTime(state, type) {
    const measurement = state[`${type}Measurement`];
    if (state.phase === type) return state.scene.simulationTime;
    return measurement?.x2 == null ? measurement?.currentOrEndModelTime ?? null : null;
  }
  function allComplete(kinds) { return kinds.ua === "complete" && kinds.va === "complete" && kinds.ia === "complete"; }
  function variantFor(phase, returnToReview, kinds) {
    if (phase === "review") return allComplete(kinds) ? "complete" : "incomplete";
    let suffix;
    if (phase === "instant") suffix = kinds.ia === "complete" ? "answered" : "exploring";
    else {
      const measurement = phase === "uniform" ? kinds.u : kinds.v;
      const answer = phase === "uniform" ? kinds.ua : kinds.va;
      suffix = answer === "complete" ? "answered" : measurement === "captured" ? "captured" : measurement === "active" ? "paused-measuring" : "ready";
    }
    return returnToReview ? `review-edit-${suffix}` : suffix;
  }
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
    if (type === "uniform" && !Model.minimumDurationReached(end - measurement.startModelTime, 1.5)) return "invalid";
    if (type === "variable" && !Model.minimumDurationReached(end - measurement.startModelTime, definition.variableMinimumDuration)) return "invalid";
    return "captured";
  }
  function sceneFor(state, phase) {
    if (!["uniform", "variable"].includes(phase)) return { simulationTime: 0, paused: 1, observationStarted: 0 };
    const measurement = state[`${phase}Measurement`];
    return measurement
      ? { simulationTime: measurement.currentOrEndModelTime, paused: 1, observationStarted: 1 }
      : { simulationTime: 0, paused: 1, observationStarted: 0 };
  }
  function navigate(source, phase, returnToReview = false) {
    if (!validateDraft(source) || !["uniform", "variable", "instant", "review"].includes(phase)) return null;
    const copy = clone(source);
    copy.phase = phase;
    copy.stage = { uniform: 0, variable: 1, instant: 2, review: 3 }[phase];
    copy.returnToReview = phase === "review" ? false : Boolean(returnToReview);
    copy.scene = sceneFor(copy, phase);
    const kinds = {
      u: measurementKind(copy.definition, "uniform", copy.uniformMeasurement, activeMeasurementTime(copy, "uniform")),
      v: measurementKind(copy.definition, "variable", copy.variableMeasurement, activeMeasurementTime(copy, "variable")),
      ua: stageAnswer(copy.answers.uniform, "uniform"), va: stageAnswer(copy.answers.variable, "variable"),
      ia: instantAnswer(copy.answers.instant, copy.definition)
    };
    copy.variant = variantFor(phase, copy.returnToReview, kinds);
    return validateDraft(copy) ? copy : null;
  }
  function next(state, action) {
    const key = `${state.phase}/${state.variant}`;
    if (action === "advance" && state.phase === "uniform" && state.variant.endsWith("answered")) return navigate(state, "variable");
    if (action === "advance" && state.phase === "variable" && state.variant.endsWith("answered")) return navigate(state, "instant");
    if (action === "review" && state.phase === "instant" && state.variant.endsWith("answered")) return navigate(state, "review");
    if (action === "return-review" && state.returnToReview && state.variant.endsWith("answered")) return navigate(state, "review");
    if (action === "edit-uniform" && ["review/complete", "review/incomplete"].includes(key)) return navigate(state, "uniform", true);
    if (action === "edit-variable" && ["review/complete", "review/incomplete"].includes(key)) return navigate(state, "variable", true);
    if (action === "edit-instant" && ["review/complete", "review/incomplete"].includes(key)) return navigate(state, "instant", true);
    return null;
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

  function measurementControlState({ timerRunning, duration, minimum, captured, answered, running, observationStarted }) {
    if (![duration, minimum].every(Number.isFinite) || duration < 0 || minimum < 0) return null;
    const observationActive = running === true && observationStarted === true;
    return {
      label: timerRunning ? "停止計時" : "開始計時",
      disabled: Boolean(captured || answered || !observationActive || (timerRunning && !Model.minimumDurationReached(duration, minimum))),
      canStop: Boolean(timerRunning && observationActive && !captured && !answered && Model.minimumDurationReached(duration, minimum))
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
        state.scene.observationStarted = 1;
        state[field] = { startModelTime: start, currentOrEndModelTime: start, readingOrigin, x1: Model.canonicalNumber(Model.readingPosition(position(start), readingOrigin)), x2: null, dt: 0 };
        state.variant = edit ? "review-edit-paused-measuring" : "paused-measuring";
      } else if (state.variant.endsWith("paused-measuring")) {
        const duration = type === "uniform" ? 1.5 : state.definition.variableMinimumDuration;
        const end = state[field].startModelTime + duration;
        state[field] = { ...Model.captureMeasurement(position, state[field].startModelTime, end), currentOrEndModelTime: end };
        state.scene.simulationTime = end;
        state.scene.observationStarted = 1;
        state.variant = edit ? "review-edit-captured" : "captured";
      } else if (state.variant.endsWith("captured")) {
        const expected = Model.expectedFromMeasurement(state[field]);
        state.answers[type] = { displacement: Model.formatInput3(expected.displacement), time: Model.formatInput3(expected.time), averageVelocity: Model.formatInput3(expected.averageVelocity), relationship: type === "uniform" ? "yes" : "no" };
        state.draftAnswers[type] = clone(state.answers[type]);
        state.variant = edit ? "review-edit-answered" : "answered";
      } else if (state.variant.endsWith("answered")) {
        return next(state, edit ? "return-review" : "advance");
      }
    } else if (state.phase === "instant") {
      if (state.variant.endsWith("exploring") && state.viewedWindowCount < 4) state.viewedWindowCount += 1;
      else if (state.variant.endsWith("exploring")) {
        state.answers.instant = { predictionChoice: Scoring.correctOption(state.definition).id, concept: "limit", stoppedVelocity: "0" };
        state.draftAnswers.instant = clone(state.answers.instant);
        state.variant = edit ? "review-edit-answered" : "answered";
      } else return next(state, edit ? "return-review" : "review");
    } else if (state.phase === "review") return next(state, "edit-instant");
    return validateDraft(state) ? state : null;
  }

  return { VERSION, ROWS, initialState, encode, decode, makeReview, decodeReview, fromReview, validateDraft, validateReview, navigate, next, startupView, submissionView, retryAction, runtimeFlagsForRestore, resumeRuntime, measurementControlState, continueOnce };
});
