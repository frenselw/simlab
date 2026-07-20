"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");
const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");

const definition = Model.createAttempt(77123);
const answerFor = (measurement, relationship) => {
  const expected = Model.expectedFromMeasurement(measurement);
  return { displacement: String(expected.displacement), time: String(expected.time), averageVelocity: String(expected.averageVelocity), relationship };
};
const states = [];
let state = Persistence.initialState(definition); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
state = Persistence.continueOnce(state); states.push(state);
states[states.length - 1] = JSON.parse(JSON.stringify(state));
state.viewedWindowCount = 4;
state.answers.instant = { predictionChoice: Scoring.correctOption(definition).id, concept: "limit", stoppedVelocity: "0" };
state.variant = "answered"; assert(Persistence.validateDraft(state)); states.push(JSON.parse(JSON.stringify(state)));
state = Persistence.continueOnce(state); states.push(state);
const review = state;

for (const [action, type] of [["edit-uniform", "uniform"], ["edit-variable", "variable"]]) {
  const answered = Persistence.next(review, action); states.push(answered);
  const ready = JSON.parse(JSON.stringify(answered)); ready.variant = "review-edit-ready"; ready[`${type}Measurement`] = null; ready.answers[type] = null; states.push(ready);
  const active = Persistence.continueOnce(ready); states.push(active);
  states.push(Persistence.continueOnce(active));
}
states.push(Persistence.next(review, "edit-instant"));
assert.strictEqual(states.length, Object.keys(Persistence.ROWS).length);
const expectedContinuation = {
  "uniform/ready": "uniform/paused-measuring", "uniform/paused-measuring": "uniform/captured", "uniform/captured": "uniform/answered", "uniform/answered": "variable/ready",
  "variable/ready": "variable/paused-measuring", "variable/paused-measuring": "variable/captured", "variable/captured": "variable/answered", "variable/answered": "instant/exploring",
  "instant/exploring": "instant/exploring", "instant/answered": "review/complete", "review/complete": "instant/review-edit-answered",
  "uniform/review-edit-ready": "uniform/review-edit-paused-measuring", "uniform/review-edit-paused-measuring": "uniform/review-edit-captured", "uniform/review-edit-captured": "uniform/review-edit-answered", "uniform/review-edit-answered": "review/complete",
  "variable/review-edit-ready": "variable/review-edit-paused-measuring", "variable/review-edit-paused-measuring": "variable/review-edit-captured", "variable/review-edit-captured": "variable/review-edit-answered", "variable/review-edit-answered": "review/complete",
  "instant/review-edit-answered": "review/complete"
};
const seen = new Set();
for (const item of states) {
  const key = `${item?.phase}/${item?.variant}`; seen.add(key);
  assert(item && Persistence.validateDraft(item), key);
  const restored = Persistence.decode(Persistence.encode(item));
  assert.deepStrictEqual(restored.answers, item.answers, `answers retain meaning ${key}`);
  assert.deepStrictEqual(restored.uniformMeasurement, item.uniformMeasurement, `uniform measurement retains meaning ${key}`);
  assert.deepStrictEqual(restored.variableMeasurement, item.variableMeasurement, `variable measurement retains meaning ${key}`);
  const continued = restored && Persistence.continueOnce(restored);
  assert(continued, `round trip and legal continuation ${key}`);
  assert.strictEqual(`${continued.phase}/${continued.variant}`, expectedContinuation[key], `expected continuation ${key}`);
}
assert.deepStrictEqual([...seen].sort(), Object.keys(Persistence.ROWS).sort());
assert.strictEqual(Persistence.VERSION, 4);
const oldDraft = Persistence.encode(review); oldDraft.v = 3;
assert.strictEqual(Persistence.decode(oldDraft), null, "v3 draft is explicitly rejected rather than reinterpreted");

const reviewAnswer = Persistence.makeReview(review);
assert(Persistence.validateReview(reviewAnswer));
const restoredReview = Persistence.fromReview(Persistence.decodeReview(reviewAnswer));
assert.strictEqual(Scoring.scoreAttempt(restoredReview.definition, restoredReview.uniformMeasurement, restoredReview.variableMeasurement, restoredReview.answers).score, 100);
assert(Buffer.byteLength(JSON.stringify({ version: 1, activity: "linear-motion-velocity-lab", kind: "draft", answer: Persistence.encode(review) })) < 4000, "draft envelope stays compact");
assert(Buffer.byteLength(JSON.stringify({ version: 1, activity: "linear-motion-velocity-lab", kind: "review", answer: reviewAnswer, score: 100, passed: true })) < 4000, "review envelope stays compact");

const variableReady = Persistence.continueOnce(Persistence.continueOnce(Persistence.continueOnce(Persistence.continueOnce(Persistence.initialState(definition)))));
const variableActive = Persistence.continueOnce(variableReady);
assert.strictEqual(variableActive.variableMeasurement.x2, null);
const variableCaptured = Persistence.continueOnce(variableActive);
assert(Model.minimumDurationReached(variableCaptured.variableMeasurement.dt, definition.variableMinimumDuration));
assert(variableCaptured.variableMeasurement.dt < 5.01, "test continuation uses the visible minimum, not a full cycle");
assert.strictEqual(Persistence.measurementControlState({ timerRunning: true, duration: definition.variableMinimumDuration - 0.01, minimum: definition.variableMinimumDuration, captured: false, answered: false, running: true, observationStarted: true }).canStop, false);
assert.strictEqual(Persistence.measurementControlState({ timerRunning: true, duration: definition.variableMinimumDuration, minimum: definition.variableMinimumDuration, captured: false, answered: false, running: true, observationStarted: true }).canStop, true);
assert.strictEqual(Persistence.measurementControlState({ timerRunning: true, duration: definition.variableMinimumDuration, minimum: definition.variableMinimumDuration, captured: false, answered: false, running: false, observationStarted: true }).canStop, false);

const active = Persistence.continueOnce(Persistence.initialState(definition));
assert.deepStrictEqual(Persistence.runtimeFlagsForRestore(Persistence.decode(Persistence.encode({ ...active, running: true, timerRunning: true }))), { running: false, timerRunning: true });
assert.deepStrictEqual(Persistence.resumeRuntime({ running: false, timerRunning: true }), { running: true, timerRunning: true });

const invalid = (mutator, source = review) => { const copy = JSON.parse(JSON.stringify(source)); mutator(copy); assert.strictEqual(Persistence.decode(copy), null); };
invalid((value) => { value.v = 3; });
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
invalid((value) => { value.uniformMeasurement.x1 += 1; });
invalid((value) => { value.uniformMeasurement.readingOrigin += 50; });
invalid((value) => { value.uniformMeasurement.x2 += 1; });
invalid((value) => { value.uniformMeasurement.dt += 0.1; });
invalid((value) => { value.uniformMeasurement.startModelTime = -1; });
invalid((value) => { delete value.uniformMeasurement.currentOrEndModelTime; });
invalid((value) => { value.variableMeasurement.endModelTime = value.variableMeasurement.startModelTime + 1; value.variableMeasurement.currentOrEndModelTime = value.variableMeasurement.endModelTime; value.variableMeasurement.dt = 1; });
invalid((value) => { value.viewedWindowCount = 3; });

const byKey = Object.fromEntries(states.map((item) => [`${item.phase}/${item.variant}`, item]));
invalid((value) => { value.answers.uniform = null; }, byKey["variable/ready"]);
invalid((value) => { value.answers.variable = answerFor(variableCaptured.variableMeasurement, "no"); }, byKey["uniform/captured"]);
invalid((value) => { value.scene.observationStarted = 0; }, byKey["uniform/paused-measuring"]);
invalid((value) => { value.scene.observationStarted = 2; }, byKey["uniform/ready"]);
invalid((value) => { value.scene.simulationTime = 1; value.scene.observationStarted = 0; }, byKey["uniform/ready"]);
invalid((value) => { value.scene.simulationTime = Infinity; }, byKey["uniform/ready"]);
invalid((value) => { value.scene.simulationTime = Model.MAX_MODEL_TIME; value.scene.observationStarted = 1; }, byKey["uniform/ready"]);
invalid((value) => { value.uniformMeasurement.endModelTime = value.uniformMeasurement.currentOrEndModelTime; delete value.uniformMeasurement.currentOrEndModelTime; }, byKey["uniform/paused-measuring"]);
invalid((value) => { value.uniformMeasurement.x2 = value.uniformMeasurement.x1; }, byKey["uniform/paused-measuring"]);
invalid((value) => { value.returnToReview = false; }, byKey["uniform/review-edit-answered"]);
invalid((value) => { value.answers.instant = null; }, byKey["variable/review-edit-answered"]);
invalid((value) => { value.answers.variable = null; }, byKey["instant/review-edit-answered"]);

const shortVariable = JSON.parse(JSON.stringify(byKey["variable/captured"]));
shortVariable.variableMeasurement = { ...Model.captureMeasurement((time) => Model.variablePosition(definition.variable, time), 0, definition.variableMinimumDuration - 0.25), currentOrEndModelTime: definition.variableMinimumDuration - 0.25 };
shortVariable.scene.simulationTime = definition.variableMinimumDuration - 0.25;
assert.strictEqual(Persistence.decode(shortVariable), null, "short variable capture fails closed");

const badReviewVersion = JSON.parse(JSON.stringify(reviewAnswer)); badReviewVersion.v = 3;
assert.strictEqual(Persistence.decodeReview(badReviewVersion), null);
const badReviewShape = JSON.parse(JSON.stringify(reviewAnswer)); badReviewShape.uniformMeasurement.currentOrEndModelTime = badReviewShape.uniformMeasurement.endModelTime;
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
