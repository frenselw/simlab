"use strict";

const assert = require("node:assert/strict");
const P = require("./persistence.js");
const S = require("./scoring.js");
const G = require("./generator.js");

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
const originalScore = S.scoreAssessment(state.assessment);
const restoredScore = S.scoreAssessment(restored.assessment);
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
assert.equal(S.scoreAssessment(submitted.assessment).score, originalScore.score, "review rescoring is invariant");
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

const generatedSeed = "0123456789abcdeffedcba9876543210";
const generatedPaper = G.generatePaper(generatedSeed);
const adversarial = P.createExplore();
assert.equal(P.startGeneratedAssessment(adversarial, generatedSeed, generatedPaper), true);
const alternateM1 = G.candidatePools().m1.find((candidate) => {
  const changed = structuredClone(generatedPaper);
  changed.missions.m1 = structuredClone(candidate);
  return G.validateGeneratedPaper(changed) && G.fingerprint(changed) !== G.fingerprint(generatedPaper);
});
assert.ok(alternateM1, "test fixture has another individually and paper-level valid mission 1 candidate");
adversarial.assessment.paper.missions.m1 = structuredClone(alternateM1);
assert.equal(G.validateGeneratedPaper(adversarial.assessment.paper), true, "adversarial in-memory paper remains structurally valid");
assert.equal(G.matchesSeed(adversarial.assessment.seed, adversarial.assessment.paper), false, "adversarial paper no longer matches its canonical seed");
assert.equal(P.scenariosForAssessment(adversarial.assessment), null, "scenario resolver rejects a structurally valid paper detached from its seed");
assert.equal(P.encodeDraft(adversarial), null, "draft boundary rejects an in-memory valid-candidate paper swap");
assert.equal(P.encodeReview(adversarial), null, "submission review boundary rejects an in-memory valid-candidate paper swap");
assert.equal(P.nextMission(adversarial), false, "phase transition fails closed after an in-memory valid-candidate paper swap");
let generated = P.createExplore(-3, 1.5);
assert.equal(P.encodeDraft(generated).v, 2, "new explore drafts use schema v2");
assert.equal(P.startGeneratedAssessment(generated, generatedSeed, generatedPaper), true, "new assessment embeds a generated paper");
for (let step = 0; step < 5; step += 1) {
  const copy = roundTrip(generated);
  assert.ok(copy, `generated normal mission step ${step} round-trips`);
  assert.equal(copy.assessment.seed, generatedSeed);
  assert.deepEqual(copy.assessment.paper, generatedPaper, "authoritative generated paper is unchanged by restore");
  assert.equal(P.nextMission(copy), true, `generated restored step ${step} has a legal continuation`);
  assert.equal(P.nextMission(generated), true);
}
assert.equal(generated.phase, "final-review");
for (let step = 0; step < 5; step += 1) {
  const editing = roundTrip(generated);
  assert.equal(P.editMission(editing, step), true);
  const editingRestored = roundTrip(editing);
  assert.deepEqual(editingRestored.assessment.paper, generatedPaper, `generated from-review mission ${step} retains its paper`);
  assert.equal(P.returnToReview(editingRestored), true);
}
const generatedReview = P.encodeReview(generated);
const generatedSubmitted = P.decodeReview(generatedReview);
assert.ok(generatedSubmitted?.locked, "generated review restores locked");
assert.deepEqual(generatedSubmitted.assessment.paper, generatedPaper, "generated review embeds the authoritative paper");
assert.equal(P.scenariosForAssessment(generatedSubmitted.assessment), generatedSubmitted.assessment.paper.missions, "generated scenario resolver uses embedded missions");
assert.equal(P.scenariosForAssessment(submitted.assessment), S.SCENARIO_SETS.alpha, "legacy scenario resolver still uses immutable v1 library");

generated.assessment.ans = {
  m1: { x0: -8, v: -2 },
  m2: { xStart: -20, xEnd: 20 },
  m3: { A: { probes: [0, 6], velocity: -2 }, B: { probes: [6, 0], velocity: 2 }, faster: "same" },
  m4: { x0: 8, v: 2 },
  m5: { x0B: -8, vB: 2, meetingX: 20 }
};
const generatedDraftEnvelope = { version: 1, activity: "position-time-graph-motion-lab", kind: "draft", answer: P.encodeDraft(generated) };
const generatedReviewEnvelope = { version: 1, activity: "position-time-graph-motion-lab", kind: "review", answer: P.encodeReview(generated), score: 0, passed: false };
const generatedPendingEnvelope = { version: 1, activity: "position-time-graph-motion-lab", kind: "pending-final", payload: { reviewJson: JSON.stringify(generatedReviewEnvelope), score: 0, maxScore: 100, passed: false } };
const generatedSizes = [generatedDraftEnvelope, generatedReviewEnvelope, generatedPendingEnvelope].map((value) => Buffer.byteLength(JSON.stringify(value), "utf8"));
assert.ok(generatedSizes.every((bytes) => bytes < 4000), `v2 draft/review/pending snapshots fit SCORM (${generatedSizes.join(", ")} bytes)`);

function invalidGenerated(mutator, label) {
  const payload = structuredClone(P.encodeDraft(generated));
  mutator(payload);
  assert.equal(P.decodeDraft(payload), null, label);
}
invalidGenerated((value) => { value.g.s = "bad"; }, "malformed generated seed is rejected");
invalidGenerated((value) => { value.g.s = "fedcba98765432100123456789abcdef"; }, "a valid replacement seed cannot be detached from its paper");
invalidGenerated((value) => { value.g.q = G.generatePaper("fedcba98765432100123456789abcdef").missions; }, "a different still-valid paper cannot be detached from its seed");
invalidGenerated((value) => { value.g.v = 3; }, "unknown generator version is rejected");
invalidGenerated((value) => { delete value.g.q.m1; }, "missing generated mission is rejected");
invalidGenerated((value) => { value.g.q.extra = {}; }, "extra generated mission is rejected");
invalidGenerated((value) => { value.g.q.m1.v = 0; }, "invalid generated mission lattice is rejected");
invalidGenerated((value) => { value.g.q.m2.x0 = 1; }, "unreachable generated graph endpoint setup is rejected");
invalidGenerated((value) => { value.g.q.m3.B.x0 = value.g.q.m3.A.x0; }, "generated measure lines require different starts");
invalidGenerated((value) => { value.g.q.m4.atPosition += 0.5; }, "generated stated position must match its motion");
invalidGenerated((value) => { value.g.q.m5.meetTime = 1; }, "generated meeting time stays in the safe set");
invalidGenerated((value) => { value.g.q.m5 = { A: { x0: -8, v: -2 }, meetTime: 2 }; }, "generated meeting scenario with fewer than three solutions is rejected");
invalidGenerated((value) => { value.g = null; }, "assessment phases require generated metadata");
invalidGenerated((value) => { value.a = null; }, "assessment phases require generated answers");

const generatedExplore = P.encodeDraft(P.createExplore());
generatedExplore.g = { v: 2, s: generatedSeed, q: generatedPaper.missions };
assert.equal(P.decodeDraft(generatedExplore), null, "explore cannot carry a generated paper");
const badReview = structuredClone(generatedReview);
badReview.g.q.m5.meetTime = 6;
assert.equal(P.decodeReview(badReview), null, "invalid generated finished review fails closed");

function rejectsMissingTopLevel(payload, label) {
  for (const key of Object.keys(payload)) {
    const missing = structuredClone(payload);
    delete missing[key];
    assert.equal(P.decodeDraft(missing), null, `${label} requires explicit top-level ${key}`);
  }
}
const legacyNormal = P.createExplore();
P.startAssessment(legacyNormal, "alpha");
rejectsMissingTopLevel(P.encodeDraft(legacyNormal), "v1 normal mission");
rejectsMissingTopLevel(P.encodeDraft(state), "v1 final review");
const legacyExplorePayload = { v: 1, p: "explore", r: "free", c: null, e: null, x: { x0: 0, v: 1 }, a: null };
assert.ok(P.decodeDraft(legacyExplorePayload), "frozen v1 explore fixture remains supported");
rejectsMissingTopLevel(legacyExplorePayload, "v1 explore");
const generatedNormal = P.createExplore();
P.startGeneratedAssessment(generatedNormal, generatedSeed, generatedPaper);
rejectsMissingTopLevel(P.encodeDraft(generatedNormal), "v2 normal mission");
rejectsMissingTopLevel(P.encodeDraft(generated), "v2 final review");
rejectsMissingTopLevel(P.encodeDraft(P.createExplore()), "v2 explore");

console.log(`Position-time persistence checks passed; maximum v2 snapshot ${Math.max(...generatedSizes)} bytes`);
