"use strict";

const assert = require("node:assert/strict");
const Tasks = require("./task-definitions.js");
const Model = require("./graph-model.js");
const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");

const encodedIdeal = Tasks.TASKS.map((task) => Model.encodeTrace(Scoring.exemplarTrace(task.id)));

function roundTrip(state, continuation) {
  const encoded = Persistence.encode(state);
  const restored = Persistence.decode(JSON.parse(JSON.stringify(encoded)));
  assert(restored);
  assert.deepEqual(restored, encoded);
  assert.deepEqual(Persistence.scoreState(restored), Persistence.scoreState(state));
  const continued = continuation(restored);
  assert(continued, "restored state executes a legal continuation");
  assert.equal(Persistence.validateDraftState(continued), true);
  return restored;
}

let practice = Persistence.initialState();
roundTrip(practice, Persistence.startTasks);

let first = Persistence.startTasks(practice);
assert.equal(first.taskIndex, Tasks.taskIndexById("uniform-xt"), "first-pass display starts with x-t without changing canonical storage");
first = Persistence.setAnswer(first, first.taskIndex, encodedIdeal[first.taskIndex]);
let switched = Persistence.switchTask(first, Tasks.taskIndexById("uniform-vt"));
assert(switched);
assert.equal(switched.answers[Tasks.taskIndexById("uniform-xt")], encodedIdeal[Tasks.taskIndexById("uniform-xt")]);
assert.equal(switched.taskIndex, Tasks.taskIndexById("uniform-vt"));
switched = Persistence.setAnswer(switched, switched.taskIndex, encodedIdeal[switched.taskIndex]);
switched = Persistence.switchTask(switched, Tasks.taskIndexById("uniform-at"));
assert(switched);
switched = Persistence.setAnswer(switched, switched.taskIndex, encodedIdeal[switched.taskIndex]);
const secondScenario = Persistence.nextTask(switched);
assert.equal(secondScenario.taskIndex, Tasks.taskIndexById("accelerating-xt"),
  "after all three graphs, next advances to the next scenario x-t");
roundTrip(switched, Persistence.nextTask);

let skipped = Persistence.startTasks(practice);
skipped = Persistence.nextTask(skipped);
skipped = Persistence.nextTask(skipped);
skipped = Persistence.nextTask(skipped);
assert.equal(Tasks.TASKS[skipped.taskIndex].scenarioId, "accelerating",
  "visiting all three graphs unlocks the next scenario even when answers remain blank");
assert.equal(skipped.answers.slice(0, 3).every((answer) => answer == null), true);

const impossibleNewState = {
  ...Persistence.startTasks(practice),
  taskIndex: Tasks.taskIndexById("uniform-vt"),
  visitedMask: 1
};
assert.equal(Persistence.validateDraftState(impossibleNewState), false,
  "new first-pass state must include the scenario's recommended x-t starting bit");
assert.throws(() => Persistence.encode(impossibleNewState));
const migratedLegacy = Persistence.decode(impossibleNewState);
assert(migratedLegacy, "explicit v1 legacy prefix state is migrated at decode");
assert.equal(migratedLegacy.taskIndex, Tasks.taskIndexById("uniform-vt"));
assert.equal(migratedLegacy.visitedMask, 5);
assert.deepEqual(migratedLegacy.answers, impossibleNewState.answers,
  "legacy migration never reorders or changes canonical answers");

let cursor = first;
while (cursor.phase === "task") {
  cursor = Persistence.setAnswer(cursor, cursor.taskIndex, encodedIdeal[cursor.taskIndex]);
  cursor = Persistence.nextTask(cursor);
  if (cursor?.phase === "task" && cursor.answers[cursor.taskIndex] != null) {
    const scenarioTasks = Tasks.displayTasksForScenario(Tasks.TASKS[cursor.taskIndex].scenarioId);
    const pending = scenarioTasks.find((task) => cursor.answers[Tasks.taskIndexById(task.id)] == null);
    if (pending) cursor = Persistence.switchTask(cursor, Tasks.taskIndexById(pending.id));
  }
}
assert.equal(cursor.phase, "review");
assert.equal(Persistence.reviewVariant(cursor), "ready");
const ready = roundTrip(cursor, (state) => Persistence.openReviewEdit(state, 5));

let edit = Persistence.openReviewEdit(ready, 5);
edit = Persistence.setAnswer(edit, 5, encodedIdeal[5]);
roundTrip(edit, Persistence.nextTask);

const incomplete = {
  ...ready,
  answers: ready.answers.map((answer, index) => index === 2 ? null : answer)
};
assert.equal(Persistence.reviewVariant(incomplete), "incomplete");
roundTrip(incomplete, (state) => Persistence.openReviewEdit(state, 2));

const partialEvidence = Scoring.exemplarTrace("uniform-vt");
for (let index = 76; index < 96; index += 1) partialEvidence[index] = Model.EMPTY;
const evidenceIncomplete = {
  ...ready,
  answers: ready.answers.map((answer, index) => index === 0 ? Model.encodeTrace(partialEvidence) : answer)
};
assert.equal(Persistence.reviewVariant(evidenceIncomplete), "incomplete",
  "review readiness uses the scorer's evidence-complete definition");

const review = Persistence.makeReview(ready);
const decodedReview = Persistence.decodeReview(JSON.parse(JSON.stringify(review)));
assert.deepEqual(decodedReview, review);
const reviewState = Persistence.reviewToState(decodedReview);
assert.equal(Persistence.scoreState(reviewState).score, Persistence.scoreState(ready).score);
assert.ok(Persistence.bytes(review) > 1500);
assert.ok(Persistence.bytes(review) < 2200);
const mockEnvelope = {
  version: 1,
  activity: "kinematics-qualitative-graph-sketching",
  kind: "pending-final",
  payload: {
    reviewJson: JSON.stringify({ version: 1, activity: "kinematics-qualitative-graph-sketching", kind: "review", answer: review, score: 97, passed: true }),
    score: 97,
    maxScore: 100,
    passed: true
  }
};
assert.ok(Persistence.bytes(mockEnvelope) < 3600);

const badStates = [
  { ...practice, phase: "missing" },
  { ...practice, visitedMask: 1 },
  { ...practice, answers: [encodedIdeal[0], ...Array(11).fill(null)] },
  { ...first, taskIndex: 2, visitedMask: 3 },
  { ...first, taskIndex: 0, answers: [encodedIdeal[0], encodedIdeal[1], ...Array(10).fill(null)] },
  { ...edit, variant: "bad" },
  { ...ready, visitedMask: 0 },
  { ...ready, answers: ready.answers.slice(0, 11) },
  { ...ready, unknown: true }
];
badStates.forEach((state, index) => assert.equal(Persistence.decode(state), null, `invalid matrix state ${index + 1}`));

const nonCanonical = ready.answers.slice();
nonCanonical[0] += "=";
assert.equal(Persistence.decode({ ...ready, answers: nonCanonical }), null);
assert.equal(Persistence.decodeReview({ ...review, locked: 0 }), null);
assert.equal(Persistence.decodeReview({ ...review, v: 2 }), null);
assert.equal(Persistence.decodeReview({ ...review, score: 97 }), null);
assert.equal(Persistence.openReviewEdit(first, 0), null);
assert.equal(Persistence.nextTask(practice), null);
assert.equal(Persistence.switchTask(first, Tasks.taskIndexById("accelerating-xt")), null,
  "first pass cannot jump to a future scenario");

let reviewSwitch = Persistence.openReviewEdit(ready, Tasks.taskIndexById("accelerating-vt"));
reviewSwitch = Persistence.switchTask(reviewSwitch, Tasks.taskIndexById("accelerating-xt"));
assert.equal(reviewSwitch.taskIndex, Tasks.taskIndexById("accelerating-xt"), "review edit may switch within the scenario");

console.log("Qualitative kinematics persistence tests passed");
