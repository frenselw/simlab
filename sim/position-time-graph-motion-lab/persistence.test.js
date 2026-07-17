"use strict";

const assert = require("node:assert/strict");
const P = require("./persistence.js");
const S = require("./scoring.js");

const roundTrip = (state) => P.decodeDraft(P.encodeDraft(state));
let state = P.createExplore(4, -1.5);
let restored = roundTrip(state);
assert.deepEqual(restored.exploration, { x0: 4, v: -1.5 }, "exploration parameters round-trip");
assert.equal(P.startAssessment(restored, "alpha"), true, "restored exploration can continue into assessment");

state = P.createExplore();
P.startAssessment(state, "alpha");
for (let step = 0; step < 5; step += 1) {
  const key = `m${step + 1}`;
  if (step === 0) state.assessment.ans.m1 = { x0: -6 };
  if (step === 1) state.assessment.ans.m2 = { xStart: 4, xEnd: -2 };
  if (step === 2) state.assessment.ans.m3 = { A: { probes: [0] }, B: { probes: [1, 1], velocity: 2 } };
  if (step === 3) state.assessment.ans.m4 = { x0: 5, v: 0 };
  if (step === 4) state.assessment.ans.m5 = { x0B: -4, vB: 2, meetingX: 2 };
  restored = roundTrip(state);
  assert.ok(restored, `normal mission step ${step} round-trips`);
  assert.equal(S.completeness(key, restored.assessment.ans[key]) !== "invalid", true, `step ${step} answer remains structurally valid`);
  assert.equal(P.nextMission(restored), true, `restored step ${step} has a legal continuation`);
  P.nextMission(state);
}
assert.equal(state.phase, "final-review");
restored = roundTrip(state);
assert.ok(restored, "mixed complete and partial final review round-trips");
const originalScore = S.scoreAssessment(state.assessment.ans, S.getScenarioSet(state.assessment.lv, state.assessment.sid));
const restoredScore = S.scoreAssessment(restored.assessment.ans, S.getScenarioSet(restored.assessment.lv, restored.assessment.sid));
assert.equal(restoredScore.score, originalScore.score, "draft score remains invariant after restore");
assert.equal(P.editMission(restored, 2), true, "restored final review can edit a mission");

for (let step = 0; step < 5; step += 1) {
  const editState = roundTrip(state);
  P.editMission(editState, step);
  const editRestored = roundTrip(editState);
  assert.ok(editRestored, `from-review mission ${step} round-trips with all answers retained`);
  assert.equal(P.returnToReview(editRestored), true, `from-review mission ${step} can return to review`);
}

const reviewPayload = P.encodeReview(state);
const submitted = P.decodeReview(reviewPayload);
assert.ok(submitted?.locked, "review restores as submitted and locked");
assert.equal(S.scoreAssessment(submitted.assessment.ans, S.getScenarioSet(submitted.assessment.lv, submitted.assessment.sid)).score, originalScore.score, "review rescoring is invariant");
assert.equal(P.editMission(submitted, 0), false, "submitted review cannot become editable");

const draftEnvelope = { version: 1, activity: "position-time-graph-motion-lab", kind: "draft", answer: P.encodeDraft(state) };
const reviewEnvelope = { version: 1, activity: "position-time-graph-motion-lab", kind: "review", answer: reviewPayload, score: originalScore.score, passed: originalScore.passed };
const pending = { version: 1, activity: "position-time-graph-motion-lab", kind: "pending-final", payload: { reviewJson: JSON.stringify(reviewEnvelope), score: originalScore.score, maxScore: 100, passed: originalScore.passed } };
assert.ok(Buffer.byteLength(JSON.stringify(draftEnvelope), "utf8") < 4000, "maximum-shaped draft fits suspend_data");
assert.ok(Buffer.byteLength(JSON.stringify(reviewEnvelope), "utf8") < 4000, "review fits suspend_data");
assert.ok(Buffer.byteLength(JSON.stringify(pending), "utf8") < 4000, "pending-final wrapped review fits suspend_data");

function invalid(mutator, label) {
  const payload = structuredClone(P.encodeDraft(state));
  mutator(payload);
  assert.equal(P.decodeDraft(payload), null, label);
}
invalid((value) => { value.v = 2; }, "unknown schema version is rejected");
invalid((value) => { value.p = "unknown"; }, "unknown phase is rejected");
invalid((value) => { value.r = "normal"; }, "phase/variant mismatch is rejected");
invalid((value) => { value.c = 2; }, "final review cannot have a current step");
invalid((value) => { value.e = 2; }, "final review cannot have an editing step");
invalid((value) => { value.a.sid = "missing"; }, "unknown scenario set is rejected");
invalid((value) => { value.a.seen.pop(); }, "visited array must match all five missions");
invalid((value) => { value.a.ans.m3.A.probes = [0, 1, 2]; }, "more than two probes is rejected");
invalid((value) => { value.a.ans.m3.A.probes = [-1]; }, "negative probe time is rejected");
invalid((value) => { value.a.ans.m1.x0 = Infinity; }, "non-finite answer is rejected");
invalid((value) => { value.a.ans.m6 = {}; }, "unknown mission key is rejected");

const normal = P.createExplore();
P.startAssessment(normal, "alpha");
let payload = P.encodeDraft(normal);
payload.a.seen[2] = true;
assert.equal(P.decodeDraft(payload), null, "normal mode cannot skip an earlier mission");
payload = P.encodeDraft(normal);
payload.a.ans.m4 = { x0: 2 };
assert.equal(P.decodeDraft(payload), null, "normal mode rejects future answer data");
payload = P.encodeDraft(normal);
payload.r = "from-review";
payload.e = 0;
assert.equal(P.decodeDraft(payload), null, "from-review requires all missions visited");

const explore = P.encodeDraft(P.createExplore());
explore.a = { lv: 1 };
assert.equal(P.decodeDraft(explore), null, "explore cannot carry assessment data");

const legalWrong = P.createExplore();
P.startAssessment(legalWrong, "alpha");
P.nextMission(legalWrong);
P.nextMission(legalWrong);
legalWrong.assessment.ans.m3 = { A: { probes: [1, 1] }, B: { probes: [] } };
assert.ok(roundTrip(legalWrong), "equal-time probes are legal incorrect student data");

console.log("Position-time persistence checks passed");
