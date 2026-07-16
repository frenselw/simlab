"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");
const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");

const definition = Model.createAttempt(77123);
const uniformPosition = (time) => Model.uniformPosition(definition.uniform, time);
const variablePosition = (time) => Model.variablePosition(definition.variable, time);
const uniform = { ...Model.captureMeasurement(uniformPosition, 0, 1.75), currentOrEndModelTime: 1.75 };
const variableDuration = Model.cycleDuration(definition.variable);
const variable = { ...Model.captureMeasurement(variablePosition, 0, variableDuration), currentOrEndModelTime: variableDuration };
function answerFor(measurement, relationship) {
  const expected = Model.expectedFromMeasurement(measurement);
  return { displacement: Model.formatInput3(expected.displacement), time: Model.formatInput3(expected.time), averageVelocity: Model.formatInput3(expected.averageVelocity), relationship };
}
const uniformAnswer = answerFor(uniform, "yes");
const variableAnswer = answerFor(variable, "no");
const instantAnswer = { predictionChoice: Scoring.correctOption(definition).id, concept: "limit", stoppedVelocity: "0.00" };

const states = [];
const ready = Persistence.initialState(definition);
states.push(ready);
const uniformActive = Persistence.continueOnce(ready); states.push(uniformActive);
const uniformCaptured = Persistence.continueOnce(uniformActive); states.push(uniformCaptured);
const uniformAnswered = Persistence.continueOnce(uniformCaptured); states.push(uniformAnswered);
const variableReady = Persistence.continueOnce(uniformAnswered); states.push(variableReady);
const variableActive = Persistence.continueOnce(variableReady); states.push(variableActive);
const variableCaptured = Persistence.continueOnce(variableActive); states.push(variableCaptured);
const variableAnswered = Persistence.continueOnce(variableCaptured); states.push(variableAnswered);
const instantExploring = Persistence.continueOnce(variableAnswered); states.push(instantExploring);
const instantAnswered = JSON.parse(JSON.stringify(instantExploring));
instantAnswered.viewedWindowCount = 4;
instantAnswered.answers.instant = instantAnswer;
instantAnswered.variant = "answered";
assert(Persistence.validateDraft(instantAnswered)); states.push(instantAnswered);
const review = Persistence.continueOnce(instantAnswered); states.push(review);

const uniformEditAnswered = Persistence.next(review, "edit-uniform"); states.push(uniformEditAnswered);
const uniformEditReady = JSON.parse(JSON.stringify(uniformEditAnswered)); uniformEditReady.variant = "review-edit-ready"; uniformEditReady.uniformMeasurement = null; uniformEditReady.answers.uniform = null; states.push(uniformEditReady);
const uniformEditActive = Persistence.continueOnce(uniformEditReady); states.push(uniformEditActive);
const uniformEditCaptured = Persistence.continueOnce(uniformEditActive); states.push(uniformEditCaptured);

const variableEditAnswered = Persistence.next(review, "edit-variable"); states.push(variableEditAnswered);
const variableEditReady = JSON.parse(JSON.stringify(variableEditAnswered)); variableEditReady.variant = "review-edit-ready"; variableEditReady.variableMeasurement = null; variableEditReady.answers.variable = null; states.push(variableEditReady);
const variableEditActive = Persistence.continueOnce(variableEditReady); states.push(variableEditActive);
const variableEditCaptured = Persistence.continueOnce(variableEditActive); states.push(variableEditCaptured);
const instantEditAnswered = Persistence.next(review, "edit-instant"); states.push(instantEditAnswered);

assert.strictEqual(states.length, Object.keys(Persistence.ROWS).length);
const seen = new Set();
const expectedContinuation = {
  "uniform/ready": "uniform/paused-measuring",
  "uniform/paused-measuring": "uniform/captured",
  "uniform/captured": "uniform/answered",
  "uniform/answered": "variable/ready",
  "variable/ready": "variable/paused-measuring",
  "variable/paused-measuring": "variable/captured",
  "variable/captured": "variable/answered",
  "variable/answered": "instant/exploring",
  "instant/exploring": "instant/exploring",
  "instant/answered": "review/complete",
  "review/complete": "instant/review-edit-answered",
  "uniform/review-edit-ready": "uniform/review-edit-paused-measuring",
  "uniform/review-edit-paused-measuring": "uniform/review-edit-captured",
  "uniform/review-edit-captured": "uniform/review-edit-answered",
  "uniform/review-edit-answered": "review/complete",
  "variable/review-edit-ready": "variable/review-edit-paused-measuring",
  "variable/review-edit-paused-measuring": "variable/review-edit-captured",
  "variable/review-edit-captured": "variable/review-edit-answered",
  "variable/review-edit-answered": "review/complete",
  "instant/review-edit-answered": "review/complete"
};
for (const original of states) {
  assert(original, "fixture continuation exists");
  const key = `${original.phase}/${original.variant}`;
  seen.add(key);
  assert(Persistence.validateDraft(original), key);
  const restored = Persistence.decode(Persistence.encode(original));
  assert(restored, `round trip ${key}`);
  assert.strictEqual(`${restored.phase}/${restored.variant}`, key);
  const continued = Persistence.continueOnce(restored);
  assert(continued, `legal continuation ${key}`);
  assert.strictEqual(`${continued.phase}/${continued.variant}`, expectedContinuation[key], `next state ${key}`);
}
assert.deepStrictEqual([...seen].sort(), Object.keys(Persistence.ROWS).sort());

const normalizedRunning = Persistence.encode({ ...uniformActive, running: true, timerRunning: true });
assert.strictEqual(normalizedRunning.variant, "paused-measuring");
assert.strictEqual(normalizedRunning.scene.paused, 1);
const restoredRuntime = Persistence.runtimeFlagsForRestore(Persistence.decode(normalizedRunning));
assert.deepStrictEqual(restoredRuntime, { running: false, timerRunning: true });
assert.deepStrictEqual(Persistence.resumeRuntime(restoredRuntime), { running: true, timerRunning: true }, "resume preserves the active stopwatch");
assert.deepStrictEqual(Persistence.runtimeFlagsForRestore(ready), { running: false, timerRunning: false });

const reviewAnswer = Persistence.makeReview(review);
assert(Persistence.validateReview(reviewAnswer));
const restoredReview = Persistence.fromReview(Persistence.decodeReview(reviewAnswer));
const before = Scoring.scoreAttempt(definition, review.uniformMeasurement, review.variableMeasurement, review.answers);
const after = Scoring.scoreAttempt(restoredReview.definition, restoredReview.uniformMeasurement, restoredReview.variableMeasurement, restoredReview.answers);
assert.strictEqual(after.score, before.score);
assert.strictEqual(after.passed, before.passed);
assert(Buffer.byteLength(JSON.stringify({ version: 1, activity: "linear-motion-velocity-lab", kind: "draft", answer: Persistence.encode(review) })) < 4000);
assert(Buffer.byteLength(JSON.stringify({ version: 1, activity: "linear-motion-velocity-lab", kind: "review", answer: reviewAnswer, score: 100, passed: true })) < 4000);

function invalid(mutator, source = review) {
  const value = JSON.parse(JSON.stringify(source));
  mutator(value);
  assert.strictEqual(Persistence.decode(value), null);
}
invalid((value) => { value.v = 99; });
invalid((value) => { value.phase = "missing"; });
invalid((value) => { value.stage = 0; });
invalid((value) => { value.returnToReview = true; });
invalid((value) => { value.answers.uniform = null; });
invalid((value) => { value.answers.uniform.time = "1.7"; });
invalid((value) => { value.definition.variable.slowSpeed = NaN; });
invalid((value) => { value.definition.variable.fastSpeed = Infinity; });
invalid((value) => { value.definition.variable.durations.accelerate = 0; });
invalid((value) => { value.definition.windows.reverse(); });
invalid((value) => { value.definition.instantTarget.timeWithinSegment = 0.1; });
invalid((value) => { value.uniformMeasurement.startModelTime = -1; });
invalid((value) => { delete value.uniformMeasurement.readingOrigin; });
invalid((value) => { value.uniformMeasurement.readingOrigin += 50; });
invalid((value) => { value.uniformMeasurement.x1 += 1; });
invalid((value) => { value.uniformMeasurement.currentOrEndModelTime = value.uniformMeasurement.endModelTime + 1; });
invalid((value) => { delete value.uniformMeasurement.currentOrEndModelTime; });
invalid((value) => { value.variableMeasurement.currentOrEndModelTime = value.variableMeasurement.startModelTime + 1; value.variableMeasurement.endModelTime = value.variableMeasurement.currentOrEndModelTime; value.variableMeasurement.dt = 1; });
invalid((value) => { value.answers.instant.predictionChoice = "missing"; });
invalid((value) => { value.viewedWindowCount = 3; });
invalid((value) => { value.answers.variable = variableAnswer; }, uniformCaptured);
invalid((value) => { value.uniformMeasurement.x2 = value.uniformMeasurement.x1; }, uniformActive);
invalid((value) => { value.scene.simulationTime = -0.01; }, ready);
invalid((value) => { value.scene.simulationTime = Infinity; }, ready);
invalid((value) => { value.scene.simulationTime = Number.MAX_VALUE; }, ready);
invalid((value) => { value.scene.simulationTime = 1e16; value.scene.observationStarted = 1; }, ready);
invalid((value) => { value.scene.simulationTime = 1e100; value.scene.observationStarted = 1; }, ready);
invalid((value) => { value.scene.observationStarted = 2; }, ready);
invalid((value) => { value.scene.observationStarted = 0; value.scene.simulationTime = 1; }, ready);
invalid((value) => { value.scene.simulationTime = 0.25; }, uniformActive);
invalid((value) => {
  value.uniformMeasurement.endModelTime = value.uniformMeasurement.currentOrEndModelTime;
  delete value.uniformMeasurement.currentOrEndModelTime;
}, uniformActive);
invalid((value) => { value.scene.simulationTime = value.uniformMeasurement.endModelTime - 0.01; }, uniformCaptured);
invalid((value) => { value.definition.uniform.layout = 99; });
invalid((value) => { value.definition.uniform.coordinateOrigin += 1; });
invalid((value) => { value.definition.uniform.speed = value.definition.variable.fastSpeed; });

for (const [type, source, position, start, end] of [
  ["uniform", uniformActive, uniformPosition, 10000, 10001.5],
  ["variable", variableActive, variablePosition, 100000, 100000 + variableDuration * 8]
]) {
  const longActive = JSON.parse(JSON.stringify(source));
  longActive.scene.simulationTime = start;
  longActive.scene.observationStarted = 1;
  const readingOrigin = Model.rollingReadingOrigin(position(start));
  longActive[`${type}Measurement`] = { startModelTime: start, currentOrEndModelTime: start, readingOrigin, x1: Model.canonicalNumber(Model.readingPosition(position(start), readingOrigin)), x2: null, dt: 0 };
  const restoredActive = Persistence.decode(Persistence.encode(longActive));
  assert(restoredActive, `${type} long-running active measurement survives encode/reload`);
  const advanced = Model.advanceSimulationTime(restoredActive.scene.simulationTime, [{ dt: 0.05, running: true }]);
  assert(advanced > restoredActive.scene.simulationTime, `${type} restored model time can advance`);
  assert(Number.isFinite(Model.readingPosition(position(advanced), restoredActive[`${type}Measurement`].readingOrigin)), `${type} restored reading can render`);
  restoredActive.scene.simulationTime = advanced;
  restoredActive[`${type}Measurement`].currentOrEndModelTime = advanced;
  restoredActive[`${type}Measurement`].dt = Model.canonicalNumber(advanced - start);
  assert(Persistence.decode(Persistence.encode(restoredActive)), `${type} restored state executes a legal timed continuation`);
  restoredActive.scene.simulationTime = end;
  restoredActive[`${type}Measurement`] = { ...Model.captureMeasurement(position, start, end, readingOrigin), currentOrEndModelTime: end };
  restoredActive.variant = "captured";
  const restoredCaptured = Persistence.decode(Persistence.encode(restoredActive));
  assert(restoredCaptured, `${type} manually captured long measurement survives encode/reload`);
  const expected = Model.expectedFromMeasurement(restoredCaptured[`${type}Measurement`]);
  assert(expected.displacement > 0, `${type} late-start captured displacement remains visible`);
  const maximumExpected = type === "uniform" ? definition.uniform.speed + 0.2 : definition.variable.fastSpeed;
  assert(expected.averageVelocity > 0 && expected.averageVelocity <= maximumExpected, `${type} late-start average remains physically plausible`);
  assert(Model.normalizeInput(Model.formatInput3(expected.displacement)), `${type} long displacement is answerable`);
  assert(Model.normalizeInput(Model.formatInput3(expected.time)), `${type} long time is answerable`);
}

const safeLateReady = JSON.parse(JSON.stringify(ready));
safeLateReady.scene = { simulationTime: 1e8, paused: 1, observationStarted: 1 };
const restoredLateReady = Persistence.decode(Persistence.encode(safeLateReady));
assert(restoredLateReady, "multi-year-scale finite scene restores safely");
const nextLateTime = Model.advanceSimulationTime(restoredLateReady.scene.simulationTime, [{ dt: 0.05, running: true }]);
assert(nextLateTime > restoredLateReady.scene.simulationTime);
assert(Model.safeWorldPosition(uniformPosition(nextLateTime)));

const badReview = JSON.parse(JSON.stringify(reviewAnswer)); badReview.answers.instant.stoppedVelocity = "zero";
assert.strictEqual(Persistence.decodeReview(badReview), null);
const draftShapedReview = JSON.parse(JSON.stringify(reviewAnswer));
draftShapedReview.uniformMeasurement.currentOrEndModelTime = draftShapedReview.uniformMeasurement.endModelTime;
assert.strictEqual(Persistence.decodeReview(draftShapedReview), null);
assert.deepStrictEqual(Persistence.startupView("editable"), { editable: true, locked: false, mode: "activity" });
assert.strictEqual(Persistence.startupView("review").mode, "review");
assert.strictEqual(Persistence.startupView("frozen").mode, "pending");
assert.strictEqual(Persistence.startupView("load-error").mode, "technical");
assert.deepStrictEqual(Persistence.submissionView({ activityState: "success" }), { locked: true, mode: "review", retryable: false, trusted: true });
assert.strictEqual(Persistence.submissionView({ activityState: "committed" }).mode, "committed");
assert.strictEqual(Persistence.submissionView({ activityState: "frozen" }).mode, "pending");
assert.strictEqual(Persistence.submissionView({ activityState: "retry", retryable: true }).locked, false);
assert.strictEqual(Persistence.submissionView({ activityState: "retry", retryable: false }).locked, true);
assert.strictEqual(Persistence.retryAction({ activityState: "committed" }), "finish");
assert.strictEqual(Persistence.retryAction({ activityState: "frozen" }), "pending");
assert.strictEqual(Persistence.retryAction({ activityState: "retry", retryable: true }), "resubmit");
assert.strictEqual(Persistence.retryAction({ activityState: "retry", retryable: false }), "none");
assert.deepStrictEqual(Persistence.measurementControlState({ timerRunning: true, duration: 1.49, minimum: 1.5, captured: false, answered: false }), { label: "停止計時", disabled: true, canStop: false });
assert.deepStrictEqual(Persistence.measurementControlState({ timerRunning: true, duration: 1.5, minimum: 1.5, captured: false, answered: false }), { label: "停止計時", disabled: false, canStop: true });
assert.strictEqual(Persistence.measurementControlState({ timerRunning: false, duration: 2, minimum: 1.5, captured: true, answered: false }).disabled, true);

console.log("Linear motion persistence tests passed");
