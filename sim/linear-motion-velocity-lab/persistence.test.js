"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");
const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
const definition = Model.createAttempt(77123);
const statesByKey = new Map();
const keep = (state) => {
  assert(state && Persistence.validateDraft(state), `${state?.phase}/${state?.variant}`);
  statesByKey.set(`${state.phase}/${state.variant}`, clone(state));
  return state;
};

let state = keep(Persistence.initialState(definition));
state = keep(Persistence.continueOnce(state)); // uniform/paused-measuring
state = keep(Persistence.continueOnce(state)); // uniform/captured
state = keep(Persistence.continueOnce(state)); // uniform/answered
state = keep(Persistence.continueOnce(state)); // variable/ready
state = keep(Persistence.continueOnce(state)); // variable/paused-measuring
state = keep(Persistence.continueOnce(state)); // variable/captured
state = keep(Persistence.continueOnce(state)); // variable/answered
state = keep(Persistence.continueOnce(state)); // instant/exploring
for (let index = 0; index < 4; index += 1) state = Persistence.continueOnce(state);
state = keep(Persistence.continueOnce(state)); // instant/answered
const completeReview = keep(Persistence.continueOnce(state));

const incompleteReview = keep(Persistence.navigate(Persistence.initialState(definition), "review"));

for (const [action, type] of [["edit-uniform", "uniform"], ["edit-variable", "variable"]]) {
  const answered = keep(Persistence.next(completeReview, action));
  const ready = clone(answered);
  ready[`${type}Measurement`] = null;
  ready.answers[type] = null;
  ready.draftAnswers[type] = { displacement: "", time: "", averageVelocity: "", relationship: "" };
  ready.scene = { simulationTime: 0, paused: 1, observationStarted: 0 };
  ready.variant = "review-edit-ready";
  keep(ready);
  const active = keep(Persistence.continueOnce(ready));
  const captured = keep(Persistence.continueOnce(active));
  keep(Persistence.continueOnce(captured));
}

keep(Persistence.next(completeReview, "edit-instant"));
const instantEditExploring = clone(Persistence.next(completeReview, "edit-instant"));
instantEditExploring.answers.instant = null;
instantEditExploring.draftAnswers.instant = { predictionChoice: "", concept: "", stoppedVelocity: "" };
instantEditExploring.variant = "review-edit-exploring";
keep(instantEditExploring);

assert.strictEqual(statesByKey.size, Object.keys(Persistence.ROWS).length, "every saveable phase/variant has a representative");
assert.deepStrictEqual([...statesByKey.keys()].sort(), Object.keys(Persistence.ROWS).sort());

const expectedContinuation = {
  "uniform/ready": "uniform/paused-measuring", "uniform/paused-measuring": "uniform/captured", "uniform/captured": "uniform/answered", "uniform/answered": "variable/ready",
  "variable/ready": "variable/paused-measuring", "variable/paused-measuring": "variable/captured", "variable/captured": "variable/answered", "variable/answered": "instant/exploring",
  "instant/exploring": "instant/exploring", "instant/answered": "review/complete",
  "review/incomplete": "instant/review-edit-exploring", "review/complete": "instant/review-edit-answered",
  "uniform/review-edit-ready": "uniform/review-edit-paused-measuring", "uniform/review-edit-paused-measuring": "uniform/review-edit-captured", "uniform/review-edit-captured": "uniform/review-edit-answered", "uniform/review-edit-answered": "review/complete",
  "variable/review-edit-ready": "variable/review-edit-paused-measuring", "variable/review-edit-paused-measuring": "variable/review-edit-captured", "variable/review-edit-captured": "variable/review-edit-answered", "variable/review-edit-answered": "review/complete",
  "instant/review-edit-exploring": "instant/review-edit-answered", "instant/review-edit-answered": "review/complete"
};
for (const [key, item] of statesByKey) {
  const restored = Persistence.decode(Persistence.encode(item));
  assert.deepStrictEqual(restored, item, `round trip retains full draft meaning ${key}`);
  const continued = Persistence.continueOnce(restored);
  assert(continued, `legal continuation exists ${key}`);
  assert.strictEqual(`${continued.phase}/${continued.variant}`, expectedContinuation[key], `expected continuation ${key}`);
}

assert.strictEqual(Persistence.VERSION, 6);
for (const oldVersion of [3, 4, 5]) {
  const oldDraft = Persistence.encode(completeReview); oldDraft.v = oldVersion;
  assert.strictEqual(Persistence.decode(oldDraft), null, `v${oldVersion} draft is rejected rather than reinterpreted`);
}

// Free navigation does not depend on confirmation, and preserves incomplete work.
const freeVariable = Persistence.navigate(Persistence.initialState(definition), "variable");
assert.strictEqual(`${freeVariable.phase}/${freeVariable.variant}`, "variable/ready");
const freeInstant = Persistence.navigate(freeVariable, "instant");
assert.strictEqual(`${freeInstant.phase}/${freeInstant.variant}`, "instant/exploring");
const freeReview = Persistence.navigate(freeInstant, "review");
assert.strictEqual(`${freeReview.phase}/${freeReview.variant}`, "review/incomplete");
assert.strictEqual(`${Persistence.navigate(freeReview, "uniform", true).phase}/${Persistence.navigate(freeReview, "uniform", true).variant}`, "uniform/review-edit-ready");

const partial = clone(statesByKey.get("uniform/captured"));
partial.draftAnswers.uniform = { displacement: "1.2", time: "", averageVelocity: "3", relationship: "" };
assert(Persistence.validateDraft(partial));
const partialAway = Persistence.navigate(partial, "variable");
const partialBack = Persistence.navigate(partialAway, "uniform");
assert.deepStrictEqual(partialBack.draftAnswers.uniform, partial.draftAnswers.uniform, "partial form strings survive stage navigation");

const activeAway = Persistence.navigate(statesByKey.get("uniform/paused-measuring"), "instant");
const activeBack = Persistence.navigate(activeAway, "uniform");
assert.strictEqual(activeBack.variant, "paused-measuring");
assert.strictEqual(activeBack.scene.simulationTime, activeBack.uniformMeasurement.currentOrEndModelTime);
assert.deepStrictEqual(Persistence.runtimeFlagsForRestore(Persistence.decode(Persistence.encode(activeBack))), { running: false, timerRunning: true });
assert.deepStrictEqual(Persistence.runtimeFlagsForRestore(Persistence.decode(Persistence.encode({ ...activeBack, running: true, timerRunning: true }))), { running: false, timerRunning: true });

const reviewAnswer = Persistence.makeReview(completeReview);
assert(Persistence.validateReview(reviewAnswer));
const v5Review = clone(reviewAnswer); v5Review.v = 5;
assert.strictEqual(Persistence.decodeReview(v5Review), null, "v5 submitted review is rejected rather than trusted under v6 invariants");
const restoredReview = Persistence.fromReview(Persistence.decodeReview(reviewAnswer));
assert.strictEqual(Scoring.scoreAttempt(restoredReview.definition, restoredReview.uniformMeasurement, restoredReview.variableMeasurement, restoredReview.answers).score, 100);
assert(Buffer.byteLength(JSON.stringify({ version: 1, activity: "linear-motion-velocity-lab", kind: "draft", answer: Persistence.encode(completeReview) })) < 4000, "draft envelope stays compact");
assert(Buffer.byteLength(JSON.stringify({ version: 1, activity: "linear-motion-velocity-lab", kind: "review", answer: reviewAnswer, score: 100, passed: true })) < 4000, "review envelope stays compact");

const variableActive = statesByKey.get("variable/paused-measuring");
const variableCaptured = statesByKey.get("variable/captured");
assert.strictEqual(variableActive.variableMeasurement.x2, null);
assert(Model.minimumDurationReached(variableCaptured.variableMeasurement.dt, definition.variableMinimumDuration));
assert(variableCaptured.variableMeasurement.dt < 5.01, "test continuation uses the visible minimum, not a full cycle");
assert.strictEqual(Persistence.measurementControlState({ timerRunning: true, duration: definition.variableMinimumDuration - 0.01, minimum: definition.variableMinimumDuration, captured: false, answered: false, running: true, observationStarted: true }).canStop, false);
assert.strictEqual(Persistence.measurementControlState({ timerRunning: true, duration: definition.variableMinimumDuration, minimum: definition.variableMinimumDuration, captured: false, answered: false, running: true, observationStarted: true }).canStop, true);
assert.strictEqual(Persistence.measurementControlState({ timerRunning: true, duration: definition.variableMinimumDuration, minimum: definition.variableMinimumDuration, captured: false, answered: false, running: false, observationStarted: true }).canStop, false);
assert.deepStrictEqual(Persistence.resumeRuntime({ running: false, timerRunning: true }), { running: true, timerRunning: true });

const invalid = (mutator, source = completeReview) => {
  const copy = clone(source); mutator(copy); assert.strictEqual(Persistence.decode(copy), null);
};
invalid((value) => { value.v = 4; });
invalid((value) => { value.phase = "missing"; });
invalid((value) => { value.stage = 0; });
invalid((value) => { value.returnToReview = true; });
invalid((value) => { value.definition.variable.streamVersion = 99; });
invalid((value) => { value.definition.variableMinimumDuration = 9; });
invalid((value) => { value.definition.variableMinimumDuration = 3.1; });
invalid((value) => { value.definition.instantTarget.segmentIndex = -1; });
invalid((value) => { value.definition.instantTarget.timeWithinSegment = 0.1; });
invalid((value) => { value.definition.instantOptions[0].value = Infinity; });
invalid((value) => { value.definition.windows.reverse(); });
invalid((value) => { value.answers.uniform.time = "5 m"; });
invalid((value) => { value.answers.variable.averageVelocity = "-1"; });
invalid((value) => { value.answers.variable.averageVelocity = "1e308"; });
invalid((value) => { value.answers.instant.stoppedVelocity = "1e-324"; });
invalid((value) => { value.draftAnswers.uniform.time = "different"; });
invalid((value) => { value.draftAnswers.variable.relationship = "maybe"; });
invalid((value) => { value.draftAnswers.instant.concept = "unknown"; });
invalid((value) => { value.uniformMeasurement.x1 += 1; });
invalid((value) => { value.uniformMeasurement.readingOrigin += 50; });
invalid((value) => { value.uniformMeasurement.x2 += 1; });
invalid((value) => { value.uniformMeasurement.dt += 0.1; });
invalid((value) => { value.uniformMeasurement.startModelTime = -1; });
invalid((value) => { delete value.uniformMeasurement.currentOrEndModelTime; });
invalid((value) => { value.variableMeasurement.endModelTime = value.variableMeasurement.startModelTime + 1; value.variableMeasurement.currentOrEndModelTime = value.variableMeasurement.endModelTime; value.variableMeasurement.dt = 1; });
invalid((value) => { value.viewedWindowCount = 3; });

invalid((value) => { value.scene.observationStarted = 0; }, statesByKey.get("uniform/paused-measuring"));
invalid((value) => { value.scene.observationStarted = 2; }, statesByKey.get("uniform/ready"));
invalid((value) => { value.scene.simulationTime = 1; value.scene.observationStarted = 0; }, statesByKey.get("uniform/ready"));
invalid((value) => { value.scene.simulationTime = Infinity; }, statesByKey.get("uniform/ready"));
invalid((value) => { value.scene.simulationTime = Model.MAX_MODEL_TIME; value.scene.observationStarted = 1; }, statesByKey.get("uniform/ready"));
invalid((value) => { value.uniformMeasurement.endModelTime = value.uniformMeasurement.currentOrEndModelTime; delete value.uniformMeasurement.currentOrEndModelTime; }, statesByKey.get("uniform/paused-measuring"));
invalid((value) => { value.uniformMeasurement.x2 = value.uniformMeasurement.x1; }, statesByKey.get("uniform/paused-measuring"));
invalid((value) => { value.returnToReview = false; }, statesByKey.get("uniform/review-edit-answered"));

const shortVariable = clone(statesByKey.get("variable/captured"));
shortVariable.variableMeasurement = { ...Model.captureMeasurement((time) => Model.variablePosition(definition.variable, time), 0, definition.variableMinimumDuration - 0.25), currentOrEndModelTime: definition.variableMinimumDuration - 0.25 };
shortVariable.scene.simulationTime = definition.variableMinimumDuration - 0.25;
assert.strictEqual(Persistence.decode(shortVariable), null, "short variable capture fails closed");

const badReviewVersion = clone(reviewAnswer); badReviewVersion.v = 4;
assert.strictEqual(Persistence.decodeReview(badReviewVersion), null);
const badReviewShape = clone(reviewAnswer); badReviewShape.uniformMeasurement.currentOrEndModelTime = badReviewShape.uniformMeasurement.endModelTime;
assert.strictEqual(Persistence.decodeReview(badReviewShape), null);

assert.deepStrictEqual(Persistence.startupView("editable"), { editable: true, locked: false, mode: "activity" });
assert.strictEqual(Persistence.startupView("review").mode, "review");
assert.strictEqual(Persistence.startupView("frozen").mode, "pending");
assert.strictEqual(Persistence.startupView("load-error").mode, "technical");
assert.deepStrictEqual(Persistence.submissionView({ activityState: "success" }), { locked: true, mode: "review", retryable: false, trusted: true });
assert.strictEqual(Persistence.submissionView({ activityState: "committed" }).mode, "committed");
assert.strictEqual(Persistence.submissionView({ activityState: "frozen" }).mode, "pending");
assert.strictEqual(Persistence.submissionView({ activityState: "retry", retryable: false }).locked, true);
assert.strictEqual(Persistence.retryAction({ activityState: "retry", retryable: true }), "resubmit");
assert.strictEqual(Persistence.retryAction({ activityState: "committed" }), "finish");
assert.strictEqual(Persistence.retryAction({ activityState: "frozen" }), "pending");

console.log("Linear motion persistence tests passed");
