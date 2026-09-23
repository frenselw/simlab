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
const freeForward = Persistence.switchScenario(first, "accelerating");
assert(freeForward);
assert.equal(freeForward.taskIndex, Tasks.taskIndexById("accelerating-xt"),
  "first-pass quick navigation can enter any scenario");
switched = Persistence.setAnswer(switched, switched.taskIndex, encodedIdeal[switched.taskIndex]);
switched = Persistence.switchTask(switched, Tasks.taskIndexById("uniform-at"));
assert(switched);
switched = Persistence.setAnswer(switched, switched.taskIndex, encodedIdeal[switched.taskIndex]);
const secondScenario = Persistence.nextTask(switched);
assert.equal(secondScenario.taskIndex, Tasks.taskIndexById("accelerating-xt"),
  "after all three graphs, next advances to the next scenario x-t");
const quickBack = Persistence.switchScenario(secondScenario, "uniform");
assert(quickBack);
assert.equal(quickBack.taskIndex, Tasks.taskIndexById("uniform-xt"),
  "quick navigation returns to the first graph of an unlocked scenario");
const quickForward = Persistence.switchScenario(quickBack, "accelerating");
assert(quickForward);
assert.equal(quickForward.taskIndex, Tasks.taskIndexById("accelerating-xt"),
  "quick navigation enters the current unlocked scenario");
assert.equal(Persistence.switchScenario(secondScenario, "not-a-scenario"), null);
roundTrip(switched, Persistence.nextTask);

let compositeOnly = Persistence.switchScenario(Persistence.startTasks(practice), "composite");
compositeOnly = Persistence.switchTask(compositeOnly, Tasks.taskIndexById("composite-vt"));
compositeOnly = Persistence.switchTask(compositeOnly, Tasks.taskIndexById("composite-at"));
const compositeCheck = Persistence.nextTask(compositeOnly);
assert.equal(compositeCheck.phase, "review",
  "finishing the last scenario opens review instead of wrapping to the first scenario");
assert.equal(compositeCheck.visitedMask, compositeOnly.visitedMask,
  "partial review preserves which graphs the learner actually opened");
assert.equal(Persistence.reviewVariant(compositeCheck), "incomplete");
assert.equal(Persistence.scoreState(compositeCheck).score, 0,
  "all blank answers may be submitted and score zero");
assert.equal(Persistence.decodeReview(Persistence.makeReview(compositeCheck)).answers.every((answer) => answer == null), true,
  "an incomplete attempt can be serialized for submission");
const partialReviewRoundTrip = roundTrip(compositeCheck,
  (state) => Persistence.openReviewEdit(state, Tasks.taskIndexById("uniform-xt")));
const partialReviewEdit = Persistence.openReviewEdit(partialReviewRoundTrip, Tasks.taskIndexById("uniform-xt"));
assert(partialReviewEdit);
assert.equal(Boolean(partialReviewEdit.visitedMask & (1 << Tasks.taskIndexById("uniform-xt"))), true,
  "opening an untouched review card records that graph as visited");
assert.equal(Persistence.nextTask(partialReviewEdit).phase, "review",
  "review-edit returns to review even while other graphs remain unvisited");
roundTrip(partialReviewEdit, Persistence.nextTask);

let skipped = Persistence.startTasks(practice);
skipped = Persistence.nextTask(skipped);
skipped = Persistence.nextTask(skipped);
skipped = Persistence.nextTask(skipped);
assert.equal(Tasks.TASKS[skipped.taskIndex].scenarioId, "accelerating",
  "visiting all three graphs unlocks the next scenario even when answers remain blank");
assert.equal(skipped.answers.slice(0, 3).every((answer) => answer == null), true);

const firstPassStates = [];
const queuedFirstPass = [Persistence.startTasks(Persistence.initialState())];
const seenFirstPass = new Set();
while (queuedFirstPass.length) {
  const candidate = queuedFirstPass.shift();
  if (!candidate || candidate.phase !== "task" || candidate.variant !== "first-pass") continue;
  const key = JSON.stringify(candidate);
  if (seenFirstPass.has(key)) continue;
  seenFirstPass.add(key);
  firstPassStates.push(candidate);
  queuedFirstPass.push(Persistence.nextTask(candidate));
  for (const scenario of Tasks.SCENARIOS) {
    queuedFirstPass.push(Persistence.switchScenario(candidate, scenario.id));
  }
  for (const task of Tasks.displayTasksForScenario(Tasks.TASKS[candidate.taskIndex].scenarioId)) {
    queuedFirstPass.push(Persistence.switchTask(candidate, Tasks.taskIndexById(task.id)));
  }
}
assert.equal(firstPassStates.length, 3400,
  "every reachable first-pass scenario, active graph, and visited-mask invariant variant is covered");
for (const firstPass of firstPassStates) {
  roundTrip(firstPass, Persistence.nextTask);
  const answered = Persistence.setAnswer(firstPass, firstPass.taskIndex, encodedIdeal[firstPass.taskIndex]);
  assert(answered, "a reachable first-pass state accepts a production-shaped active trace");
  roundTrip(answered, Persistence.nextTask);
}

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

const fullyVisitedTask = {
  ...Persistence.reviewToState(Persistence.makeReview(ready)),
  phase: "task",
  taskIndex: Tasks.taskIndexById("uniform-xt"),
  variant: "first-pass"
};
assert.equal(Persistence.openReview(fullyVisitedTask).phase, "review",
  "quick navigation opens review from any fully visited active scenario");
const earlyReview = Persistence.openReview(first);
assert.equal(earlyReview.phase, "review",
  "the check button opens review before every graph has been visited");
assert.equal(earlyReview.visitedMask, first.visitedMask,
  "opening early review does not mark untouched graphs as visited");
assert.equal(Persistence.reviewVariant(earlyReview), "incomplete");

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
  { ...earlyReview, visitedMask: 0 },
  { ...ready, answers: ready.answers.slice(0, 11) },
  { ...ready, unknown: true }
];
const laterFirstPass = firstPassStates.find((state) =>
  Tasks.TASKS[state.taskIndex].scenarioId === "accelerating" && state.taskIndex === Tasks.taskIndexById("accelerating-xt"));
assert(laterFirstPass);
const missingTaskIndex = { ...first };
delete missingTaskIndex.taskIndex;
const missingVariant = { ...first };
delete missingVariant.variant;
badStates.push(
  missingTaskIndex,
  missingVariant,
  { ...ready, taskIndex: 0 },
  { ...first, answers: [encodedIdeal[0], ...first.answers.slice(1)] },
  {
    ...laterFirstPass,
    answers: laterFirstPass.answers.map((answer, index) =>
      index === Tasks.taskIndexById("decelerating-xt") ? encodedIdeal[index] : answer)
  },
  {
    ...laterFirstPass,
    taskIndex: Tasks.taskIndexById("decelerating-vt"),
    visitedMask: laterFirstPass.visitedMask | (1 << Tasks.taskIndexById("decelerating-vt"))
  },
  {
    ...laterFirstPass,
    visitedMask: laterFirstPass.visitedMask & ~(1 << Tasks.taskIndexById("accelerating-xt"))
  },
  ...[-1, 1.5, Tasks.TASKS.length, NaN, Infinity].map((taskIndex) => ({ ...first, taskIndex })),
  ...[-1, 1.5, Persistence.FULL_VISITED_MASK + 1, NaN, Infinity].map((visitedMask) => ({ ...first, visitedMask }))
);
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
  "three-graph buttons remain scoped to the active scenario");

let reviewSwitch = Persistence.openReviewEdit(ready, Tasks.taskIndexById("accelerating-vt"));
reviewSwitch = Persistence.switchTask(reviewSwitch, Tasks.taskIndexById("accelerating-xt"));
assert.equal(reviewSwitch.taskIndex, Tasks.taskIndexById("accelerating-xt"), "review edit may switch within the scenario");
reviewSwitch = Persistence.switchScenario(reviewSwitch, "composite");
assert.equal(reviewSwitch.taskIndex, Tasks.taskIndexById("composite-xt"),
  "review edit quick navigation may enter any scenario");

console.log("Qualitative kinematics persistence tests passed");
