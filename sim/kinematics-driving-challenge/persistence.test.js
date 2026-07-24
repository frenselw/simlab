"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");
const Persistence = require("./persistence.js");
const Scoring = require("./scoring.js");

function terminalCodes(level, code) {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal && codes.length < level.maxTicks) {
    codes.push(code);
    run = Model.replay(level, codes);
  }
  assert(run.state.terminal);
  return codes;
}
const terminal = {
  level1: terminalCodes(Levels.LEVELS[0], 0),
  level2: terminalCodes(Levels.LEVELS[1], 2),
  level3: terminalCodes(Levels.LEVELS[2], 5),
  level4: terminalCodes(Levels.LEVELS[3], 2),
  level5: terminalCodes(Levels.LEVELS[4], 2)
};
function selectedThrough(count) {
  return Object.fromEntries(Levels.LEVELS.slice(0, count).map((level) => [level.id, { revision: 1, codes: terminal[level.id] }]));
}
function checkpoint(selected, answered = true) {
  return {
    sourceLevelId: "level2", sourceRunRevision: selected.level2?.revision ?? null,
    viewedXt: answered, viewedVt: answered, answerId: answered ? Scoring.CHECKPOINT_ANSWER : null
  };
}
function base(overrides = {}) {
  return {
    ...Persistence.initialState(), ...overrides,
    selectedRuns: overrides.selectedRuns || {},
    graphCheckpoint: overrides.graphCheckpoint || Persistence.initialState().graphCheckpoint
  };
}
function roundTrip(state, next) {
  const encoded = Persistence.encode(state);
  const restored = Persistence.decode(encoded);
  assert(restored, `${state.phase}/${state.variant} restores`);
  assert.deepEqual(Persistence.encode(restored), encoded, "canonical re-encode");
  next(restored);
}

roundTrip(base(), (restored) => {
  restored.candidateRun = { ownerId: "practice", codes: [] }; restored.variant = "paused";
  assert(Persistence.validateState(restored, false));
});
roundTrip(base({ variant: "paused", candidateRun: { ownerId: "practice", codes: [1, 1] } }), (restored) => {
  restored.candidateRun.codes.push(1); assert(Persistence.validateState(restored, false));
});

roundTrip(base({ phase: "level", variant: "briefing", currentItem: "level1" }), (restored) => {
  restored.variant = "paused"; restored.candidateRun = { ownerId: "level1", codes: [] };
  assert(Persistence.validateState(restored, false));
});
roundTrip(base({ phase: "level", variant: "briefing", currentItem: "level5" }), (restored) => {
  restored.variant = "paused"; restored.candidateRun = { ownerId: "level5", codes: [] };
  assert(Persistence.validateState(restored, false), "a learner can enter level 5 before recording earlier levels");
});
roundTrip(base({ phase: "level", variant: "paused", currentItem: "level1", candidateRun: { ownerId: "level1", codes: [1, 1] } }), (restored) => {
  restored.candidateRun.codes.push(1); assert(Persistence.validateState(restored, false));
});
roundTrip(base({ phase: "level", variant: "analysis", currentItem: "level1", candidateRun: { ownerId: "level1", codes: terminal.level1 } }), (restored) => {
  restored.selectedRuns.level1 = { revision: 1, codes: restored.candidateRun.codes }; restored.candidateRun = null; restored.variant = "accepted";
  assert(Persistence.validateState(restored, false));
});
roundTrip(base({ phase: "level", variant: "accepted", currentItem: "level1", selectedRuns: selectedThrough(1) }), (restored) => {
  restored.currentItem = "level2"; restored.variant = "briefing"; assert(Persistence.validateState(restored, false));
});

for (const variant of ["review-retry-briefing", "review-retry-paused", "review-retry-analysis"]) {
  const needsCandidate = variant !== "review-retry-briefing";
  const candidate = variant.endsWith("analysis") ? terminal.level1 : [1, 1];
  roundTrip(base({
    phase: "level", variant, currentItem: "level1", returnToReview: true, selectedRuns: selectedThrough(1),
    candidateRun: needsCandidate ? { ownerId: "level1", codes: candidate } : null
  }), (restored) => {
    restored.phase = "review"; restored.variant = "incomplete"; restored.currentItem = "review";
    restored.returnToReview = false; restored.candidateRun = null;
    assert(Persistence.validateState(restored, false));
  });
}

const firstThree = selectedThrough(3);
for (const [variant, returning, answered] of [
  ["exploring", false, false], ["answered", false, true],
  ["review-edit-exploring", true, false], ["review-edit-answered", true, true]
]) {
  roundTrip(base({
    phase: "graph-check", variant, currentItem: "checkpoint", returnToReview: returning,
    selectedRuns: firstThree, graphCheckpoint: checkpoint(firstThree, answered)
  }), (restored) => {
    if (!answered) {
      restored.graphCheckpoint.viewedXt = true; restored.graphCheckpoint.viewedVt = true;
      restored.graphCheckpoint.answerId = Scoring.CHECKPOINT_ANSWER;
      restored.variant = returning ? "review-edit-answered" : "answered";
    } else {
      restored.phase = returning ? "review" : "level";
      restored.variant = returning ? "incomplete" : "briefing";
      restored.currentItem = returning ? "review" : "level4";
      restored.returnToReview = false;
    }
    assert(Persistence.validateState(restored, false));
  });
}
const onlyLevel3 = { level3: { revision: 1, codes: terminal.level3 } };
roundTrip(base({
  phase: "graph-check", variant: "exploring", currentItem: "checkpoint",
  selectedRuns: onlyLevel3,
  graphCheckpoint: {
    sourceLevelId: "level3", sourceRunRevision: 1,
    viewedXt: false, viewedVt: false, answerId: null
  }
}), (restored) => {
  restored.graphCheckpoint.viewedXt = true;
  assert(Persistence.validateState(restored, false), "level 3 alone can supply the graph checkpoint");
});

roundTrip(base({ phase: "review", variant: "incomplete", currentItem: "review", selectedRuns: selectedThrough(2), graphCheckpoint: checkpoint(selectedThrough(2), false) }), (restored) => {
  restored.phase = "level"; restored.variant = "review-retry-briefing"; restored.currentItem = "level1"; restored.returnToReview = true;
  assert(Persistence.validateState(restored, false));
});
const complete = base({
  phase: "review", variant: "complete", currentItem: "review", selectedRuns: selectedThrough(5),
  graphCheckpoint: checkpoint(selectedThrough(5), true)
});
roundTrip(complete, (restored) => assert(Scoring.scoreActivity(restored.selectedRuns, restored.graphCheckpoint)));
const reviewEncoded = Persistence.makeReview(complete);
const review = Persistence.decodeReview(reviewEncoded);
assert(review && review.phase === "submitted");
assert.deepEqual(
  Scoring.scoreActivity(review.selectedRuns, review.graphCheckpoint).score,
  Scoring.scoreActivity(complete.selectedRuns, complete.graphCheckpoint).score
);

for (const codes of [[], [0], [0, 1, 2, 3, 4, 5, 6], Array.from({ length: 97 }, (_, index) => index % 7)]) {
  assert.deepEqual(Persistence.unpackControls(Persistence.packControls(codes), codes.length), codes);
}
assert.throws(() => Persistence.packControls([7]));
assert.equal(Persistence.unpackControls("AA==", 0), null, "length mismatch rejected");
assert.equal(Persistence.unpackControls("***", 1), null, "malformed base64 rejected");

const invalid = Persistence.encode(base());
invalid.q = "analysis";
assert.equal(Persistence.decode(invalid), null, "analysis without candidate rejected");
const freelySelected = Persistence.encode(base({ phase: "level", variant: "briefing", currentItem: "level3" }));
assert.equal(Persistence.decode(freelySelected)?.currentItem, "level3", "missing earlier levels do not block direct navigation");
const mismatched = Persistence.encode(base({
  phase: "graph-check", variant: "answered", currentItem: "checkpoint", selectedRuns: firstThree,
  graphCheckpoint: checkpoint(firstThree, true)
}));
mismatched.k.r = 999;
assert.equal(Persistence.decode(mismatched), null, "checkpoint revision mismatch rejected");
const earlyAnswer = cloneEncoded(mismatched);
earlyAnswer.k.r = 1; earlyAnswer.k.x = 0;
assert.equal(Persistence.decode(earlyAnswer), null, "answer before both views rejected");
const priorPhysics = Persistence.encode(base());
priorPhysics.p = 4;
assert.equal(Persistence.decode(priorPhysics), null, "a physics-v4 snapshot is rejected after resistance-model calibration");
const priorLevels = Persistence.encode(base());
priorLevels.l = 7;
assert.equal(Persistence.decode(priorLevels), null, "a level-set-v7 snapshot is rejected after simplifying level 5");
for (const malformed of [
  { path: ["b"], value: 2 },
  { path: ["b"], value: false },
  { path: ["k", "x"], value: 2 },
  { path: ["k", "x"], value: "1" },
  { path: ["k", "y"], value: true }
]) {
  const encoded = Persistence.encode(base());
  if (malformed.path.length === 1) encoded[malformed.path[0]] = malformed.value;
  else encoded[malformed.path[0]][malformed.path[1]] = malformed.value;
  assert.equal(Persistence.decode(encoded), null, `${malformed.path.join(".")} requires compact 0/1`);
}

function maxTickCodes(level) {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    const zone = Levels.segmentAt(level, run.state.x);
    const desiredAcceleration = .8 * (.5 - run.state.v);
    const code = Array.from({ length: 7 }, (_, candidate) => candidate).reduce((best, candidate) =>
      Math.abs(Model.accelerationFor(run.state.v, zone.slopeDeg, candidate) - desiredAcceleration) <
      Math.abs(Model.accelerationFor(run.state.v, zone.slopeDeg, best) - desiredAcceleration) ? candidate : best, 0);
    codes.push(code);
    run = Model.replay(level, codes);
  }
  assert(["complete", "max-ticks"].includes(run.state.terminal));
  if (run.state.terminal === "max-ticks") assert.equal(codes.length, level.maxTicks);
  return codes;
}
const maxTick = Object.fromEntries(Levels.LEVELS.map((level) => [level.id, maxTickCodes(level)]));
assert(Object.values(maxTick).some((codes) => codes.length === Levels.levelById("level5").maxTicks),
  "at least one legal run exercises the full tick cap");
const maxSelected = Object.fromEntries(Levels.LEVELS.map((level) =>
  [level.id, { revision: 999, codes: maxTick[level.id] }]
));
const maxCheckpoint = {
  sourceLevelId: "level2", sourceRunRevision: 999, viewedXt: true, viewedVt: true,
  answerId: Scoring.CHECKPOINT_ANSWER
};
const maxDraft = base({
  phase: "level", variant: "review-retry-paused", currentItem: "level5", returnToReview: true,
  selectedRuns: maxSelected,
  graphCheckpoint: maxCheckpoint,
  candidateRun: { ownerId: "level5", codes: maxTick.level5.slice(0, -1) }
});
const maxDraftEncoded = Persistence.encode(maxDraft);
assert(Persistence.bytes(maxDraftEncoded) < 3600, `max-tick draft ${Persistence.bytes(maxDraftEncoded)} bytes`);
const maxComplete = base({
  phase: "review", variant: "complete", currentItem: "review",
  selectedRuns: maxSelected, graphCheckpoint: maxCheckpoint
});
const maxReviewEncoded = Persistence.makeReview(maxComplete);
const innerReviewBytes = Persistence.bytes(maxReviewEncoded);
const sharedReview = { version: 1, activity: "kinematics-driving-challenge", kind: "review", answer: maxReviewEncoded, score: 50, passed: false };
const pending = { version: 1, activity: "kinematics-driving-challenge", kind: "pending-final", payload: { reviewJson: JSON.stringify(sharedReview), score: 50, maxScore: 100, passed: false } };
assert(innerReviewBytes < 2200, `max-tick inner review ${innerReviewBytes} bytes`);
assert(Persistence.bytes(sharedReview) < 2800, `max-tick shared review ${Persistence.bytes(sharedReview)} bytes`);
assert(Persistence.bytes(pending) < 4000, `max-tick pending submit ${Persistence.bytes(pending)} bytes`);

function cloneEncoded(value) { return JSON.parse(JSON.stringify(value)); }
console.log("Kinematics driving persistence matrix tests passed");
