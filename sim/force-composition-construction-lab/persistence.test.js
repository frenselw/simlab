"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const P = require("./persistence.js");
const S = require("./scoring.js");

const seed = 91;
const scenario = G.generateScenario({ seed });

function stateWith(index, answer, phase = "practice") {
  const state = P.freshState(seed);
  state.currentQuestion = index;
  state.phase = phase;
  state.answers[index] = answer;
  return state;
}

function commonP(index) {
  const answer = M.freshAnswer(scenario.questions[index]);
  answer.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
  return answer;
}

function chain(index, order, count = order.length) {
  const question = scenario.questions[index];
  const answer = M.freshAnswer(question);
  if (count > 0) answer.placements[order[0]] = { mode: "snap", targetKey: "ORIGIN" };
  for (let position = 1; position < count; position += 1) answer.placements[order[position]] = { mode: "snap", targetKey: M.headKey(order[position - 1]) };
  return answer;
}

function chainForQuestion(question, order) {
  const answer = M.freshAnswer(question);
  answer.placements[order[0]] = { mode: "snap", targetKey: "ORIGIN" };
  for (let position = 1; position < order.length; position += 1) answer.placements[order[position]] = { mode: "snap", targetKey: M.headKey(order[position - 1]) };
  return answer;
}

function complete(index, order) {
  const question = scenario.questions[index];
  if (question.type === "parallelogram") {
    const answer = commonP(index);
    answer.guides = [
      { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "CORNER" } },
      { originKey: "F2_HEAD", end: { mode: "snap", targetKey: "CORNER" } }
    ];
    answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CORNER" } };
    return answer;
  }
  const actualOrder = order || question.forces.map((_, forceIndex) => forceIndex);
  const answer = chain(index, actualOrder);
  answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CHAIN_END" } };
  return answer;
}

const fixtures = [];
for (const index of [0, 1]) {
  fixtures.push(stateWith(index, M.freshAnswer(scenario.questions[index])));
  let placing = M.freshAnswer(scenario.questions[index]);
  placing.placements[0] = { mode: "free", tail10: [2300, 1500] };
  fixtures.push(stateWith(index, placing));
  const guides = commonP(index);
  fixtures.push(stateWith(index, guides));
  guides.guides[0] = { originKey: "F1_HEAD", end: { mode: "free", point10: [4400, 1600] } };
  fixtures.push(stateWith(index, guides));
  const resultStage = commonP(index);
  resultStage.guides = [
    { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "CORNER" } },
    { originKey: "F2_HEAD", end: { mode: "snap", targetKey: "CORNER" } }
  ];
  fixtures.push(stateWith(index, resultStage));
  resultStage.resultant = { originKey: "ORIGIN", end: { mode: "free", point10: [5000, 2500] } };
  fixtures.push(stateWith(index, resultStage));
  fixtures.push(stateWith(index, complete(index)));
}
const arbitraryAnchorState = P.freshState(seed);
arbitraryAnchorState.answers[0] = M.commitForceTranslation(arbitraryAnchorState.answers[0], 0, { x: 270, y: 130 }, scenario.questions[0], { pointerType: "mouse" });
fixtures.push(arbitraryAnchorState);
const intentionallyWrongResultant = P.freshState(seed);
const intentionallyWrongAnswer = commonP(0);
intentionallyWrongAnswer.guides = [
  { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } },
  { originKey: "F2_HEAD", end: { mode: "free", point10: [5200, 1600] } }
];
intentionallyWrongAnswer.resultant = { originKey: "F1_HEAD", end: { mode: "free", point10: [6500, 3000] } };
intentionallyWrongResultant.answers[0] = intentionallyWrongAnswer;
fixtures.push(intentionallyWrongResultant);
const freeResultantStartState = P.freshState(seed);
const freeResultantStartAnswer = commonP(0);
freeResultantStartAnswer.guides = [
  { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } },
  { originKey: "F2_HEAD", end: { mode: "free", point10: [5200, 1600] } }
];
freeResultantStartAnswer.resultant = {
  originKey: "FREE",
  originPoint10: [2200, 1900],
  end: { mode: "snap", targetKey: "F2_HEAD" }
};
freeResultantStartState.answers[0] = freeResultantStartAnswer;
fixtures.push(freeResultantStartState);
const wrongGuideIntersectionState = P.freshState(seed);
const wrongGuideIntersectionAnswer = commonP(0);
const firstWrongHead = M.endpointForKey(wrongGuideIntersectionAnswer, scenario.questions[0], "F1_HEAD");
const secondWrongHead = M.endpointForKey(wrongGuideIntersectionAnswer, scenario.questions[0], "F2_HEAD");
const wrongGuideMidpoint = { x: (firstWrongHead.x + secondWrongHead.x) / 2, y: (firstWrongHead.y + secondWrongHead.y) / 2 };
const wrongGuideHalf = { x: (secondWrongHead.x - firstWrongHead.x) / 2, y: (secondWrongHead.y - firstWrongHead.y) / 2 };
wrongGuideIntersectionAnswer.guides = [
  { originKey: "F1_HEAD", end: { mode: "free", point10: M.point10(M.clampLinePoint({ x: wrongGuideMidpoint.x + wrongGuideHalf.x * 0.8, y: wrongGuideMidpoint.y + wrongGuideHalf.y * 0.8 })) } },
  { originKey: "F2_HEAD", end: { mode: "free", point10: M.point10(M.clampLinePoint({ x: wrongGuideMidpoint.x - wrongGuideHalf.x * 0.8, y: wrongGuideMidpoint.y - wrongGuideHalf.y * 0.8 })) } }
];
const wrongGuideIntersection = M.guideIntersectionPoint(wrongGuideIntersectionAnswer, scenario.questions[0]);
wrongGuideIntersectionAnswer.resultant = M.commitResultant(wrongGuideIntersectionAnswer, "ORIGIN", {
  x: wrongGuideIntersection.x + 7, y: wrongGuideIntersection.y - 6
}, scenario.questions[0], { allowIncomplete: true, allowAnyOrigin: true, pointerType: "mouse" }).resultant;
assert.equal(wrongGuideIntersectionAnswer.resultant.end.targetKey, M.GUIDE_INTERSECTION_KEY);
wrongGuideIntersectionState.answers[0] = wrongGuideIntersectionAnswer;
fixtures.push(wrongGuideIntersectionState);
const translatedResultantState = P.freshState(seed);
translatedResultantState.answers[2] = M.commitResultantTranslation(complete(2, [0, 1]), { x: 40, y: -20 }, scenario.questions[2], { pointerType: "mouse" });
fixtures.push(translatedResultantState);
const arbitraryChainResultantState = P.freshState(seed);
const arbitraryChainResultantAnswer = chain(2, [0, 1]);
arbitraryChainResultantAnswer.resultant = { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "F2_TAIL" } };
arbitraryChainResultantState.answers[2] = arbitraryChainResultantAnswer;
fixtures.push(arbitraryChainResultantState);
for (const index of [2, 3]) {
  fixtures.push(stateWith(index, M.freshAnswer(scenario.questions[index])));
  fixtures.push(stateWith(index, chain(index, [0, 1], 1)));
  const reverse = chain(index, [1, 0]);
  fixtures.push(stateWith(index, reverse));
  reverse.resultant = { originKey: "ORIGIN", end: { mode: "free", point10: [5200, 2800] } };
  fixtures.push(stateWith(index, reverse));
  fixtures.push(stateWith(index, complete(index, [0, 1])));
  fixtures.push(stateWith(index, complete(index, [1, 0])));
}
fixtures.push(stateWith(4, M.freshAnswer(scenario.questions[4])));
fixtures.push(stateWith(4, chain(4, [2, 0, 1], 1)));
fixtures.push(stateWith(4, chain(4, [2, 0, 1], 2)));
const tripleReady = chain(4, [2, 0, 1]);
fixtures.push(stateWith(4, tripleReady));
tripleReady.resultant = { originKey: "ORIGIN", end: { mode: "free", point10: [5100, 2600] } };
fixtures.push(stateWith(4, tripleReady));
for (const order of G.permutations([0, 1, 2])) fixtures.push(stateWith(4, complete(4, order)));

const blankSummary = P.freshState(seed);
blankSummary.phase = "summary";
fixtures.push(blankSummary);
const completeSummary = P.freshState(seed);
completeSummary.phase = "summary";
completeSummary.answers = scenario.questions.map((_, index) => complete(index));
fixtures.push(completeSummary);

for (const [fixtureIndex, fixture] of fixtures.entries()) {
  const encoded = P.encodeDraft(fixture);
  const restored = P.decodeDraft(encoded);
  assert.deepEqual(restored, encoded, `fixture ${fixtureIndex}: production round-trip`);
  assert.deepEqual(P.derivedStatus(restored, scenario), P.derivedStatus(fixture, scenario), `fixture ${fixtureIndex}: derived variants survive`);
  assert.equal(S.score(restored, scenario).score, S.score(fixture, scenario).score, `fixture ${fixtureIndex}: score survives`);
  assert.equal(P.legalNextAction(restored, scenario), P.legalNextAction(fixture, scenario), `fixture ${fixtureIndex}: next action survives`);
  const continued = P.clone(restored);
  continued.phase = continued.phase === "summary" ? "practice" : "summary";
  assert.equal(P.validate(continued, { kind: "draft" }).ok, true, `fixture ${fixtureIndex}: restored state executes a legal phase continuation`);
}

const reviewState = completeSummary;
const result = S.score(reviewState, scenario);
const review = P.makeSnapshot("review", reviewState, result);
const restoredReview = P.decodeSnapshot(review, "review");
assert.equal(S.score(restoredReview, scenario).score, result.score, "review restores authoritative answer and rescores");
assert.equal("phase" in restoredReview, false);
assert.equal("currentQuestion" in restoredReview, false);

const maximum = P.freshState(seed);
maximum.phase = "summary";
for (const index of [0, 1]) {
  maximum.answers[index] = commonP(index);
  maximum.answers[index].guides = [
    { originKey: "F1_HEAD", end: { mode: "free", point10: [240, 4760] } },
    { originKey: "F2_HEAD", end: { mode: "free", point10: [7360, 240] } }
  ];
}
for (const index of [2, 3]) {
  maximum.answers[index] = chain(index, [1, 0]);
  maximum.answers[index].resultant = { originKey: index === 2 ? "ORIGIN" : "F2_HEAD", end: { mode: "free", point10: [7360, 4760] } };
}
maximum.answers[4] = chain(4, [2, 1, 0]);
maximum.answers[4].resultant = { originKey: "F3_HEAD", end: { mode: "free", point10: [240, 240] } };
const maxResult = S.score(maximum, scenario);
const maxDraft = P.makeSnapshot("draft", maximum);
const maxReview = P.makeSnapshot("review", maximum, maxResult);
const maxPending = P.pendingEnvelope(maxReview, maxResult);
assert.ok(P.bytes(maxDraft) <= 4000, `maximum draft is ${P.bytes(maxDraft)} bytes`);
assert.ok(P.bytes(maxReview) <= 4000, `maximum review is ${P.bytes(maxReview)} bytes`);
assert.ok(P.bytes(maxPending) <= 4000, `maximum pending-final is ${P.bytes(maxPending)} bytes`);
const pendingDecoded = P.decodePending(maxPending);
assert.deepEqual(pendingDecoded.answer, P.encodeReview(maximum));

function invalid(mutator, reasonPattern = /./) {
  const value = P.encodeDraft(P.freshState(seed));
  mutator(value);
  const outcome = P.validate(value, { kind: "draft" });
  assert.equal(outcome.ok, false, `invalid state was accepted: ${JSON.stringify(value)}`);
  assert.match(outcome.reason, reasonPattern);
}

invalid((value) => { value.schemaVersion = 2; }, /version/);
invalid((value) => { value.generatorVersion = 99; }, /version/);
const legacyState = P.freshState(seed, 1);
assert.equal(P.validate(P.encodeDraft(legacyState)).ok, true, "v1 drafts remain restorable after the latest generator is released");
invalid((value) => { value.seed = -1; }, /version/);
invalid((value) => { value.phase = "review"; }, /phase/);
invalid((value) => { value.currentQuestion = 5; }, /phase/);
invalid((value) => { value.answers.pop(); }, /count/);
invalid((value) => { value.answers[0].type = "head-to-tail-2"; }, /question-type/);
invalid((value) => { value.answers[0].placements[0] = { mode: "free", tail10: [1.5, 20] }; }, /free-placement/);
invalid((value) => { value.answers[0].placements[0] = { mode: "free", tail10: [-9999, 20] }; }, /bounds/);
invalid((value) => { value.answers[0].placements[0] = { mode: "free", tail10: [2000, 2000], targetKey: "ORIGIN" }; }, /free-placement/);
invalid((value) => { value.answers[0].placements[0] = { mode: "snap", targetKey: "F2_HEAD" }; }, /parallelogram-target/);
invalid((value) => { value.answers[0].guides[0] = { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } }; }, /guide-before/);
invalid((value) => {
  value.answers[0] = commonP(0);
  value.answers[0].guides = [
    { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } },
    { originKey: "F1_HEAD", end: { mode: "free", point10: [3100, 3100] } }
  ];
}, /duplicate/);
invalid((value) => {
  value.answers[0] = commonP(0);
  value.answers[0].resultant = { originKey: "ORIGIN", end: { mode: "free", point10: [3000, 3000] } };
}, /before-guides/);
invalid((value) => {
  value.answers[4].placements[0] = { mode: "snap", targetKey: "F2_HEAD" };
  value.answers[4].placements[1] = { mode: "snap", targetKey: "F1_HEAD" };
}, /floating-or-cycle|chain/);
invalid((value) => {
  value.answers[3] = chain(3, [1, 0]);
  value.answers[3].anchor10 = [-10, 0];
}, /anchor-bounds-3/);
invalid((value) => {
  value.answers[3] = chain(3, [1, 0]);
  value.answers[3].anchor10 = [0, 0];
}, /resolved-force-bounds-3/);
invalid((value) => {
  value.answers[4].placements[0] = { mode: "snap", targetKey: "ORIGIN" };
  value.answers[4].placements[1] = { mode: "snap", targetKey: "F1_HEAD" };
  value.answers[4].placements[2] = { mode: "snap", targetKey: "F1_HEAD" };
}, /branch/);
invalid((value) => {
  value.answers[2] = chain(2, [0, 1], 1);
  value.answers[2].resultant = { originKey: "ORIGIN", end: { mode: "free", point10: [3000, 3000] } };
}, /before-chain/);
invalid((value) => {
  value.answers[0] = commonP(0);
  value.answers[0].guides = [
    { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } },
    { originKey: "F2_HEAD", end: { mode: "free", point10: [5200, 1600] } }
  ];
  value.answers[0].resultant = { originKey: "FREE", end: { mode: "free", point10: [3000, 3000] } };
}, /resultant-origin-point/);
invalid((value) => {
  const answer = commonP(0);
  answer.guides = [
    { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } },
    { originKey: "F2_HEAD", end: { mode: "free", point10: [5200, 1600] } }
  ];
  answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: M.GUIDE_INTERSECTION_KEY, point10: [3000, 3000] } };
  value.answers[0] = answer;
}, /resultant-guide-intersection/);

const contaminatedReview = P.encodeReview(completeSummary);
contaminatedReview.phase = "summary";
assert.equal(P.validate(contaminatedReview, { kind: "review" }).ok, false, "review rejects editable fields");
const contaminatedDraft = P.encodeDraft(P.freshState(seed));
contaminatedDraft.score = 0;
assert.equal(P.validate(contaminatedDraft, { kind: "draft" }).ok, false, "draft rejects review metadata");

const invalidPending = P.clone(maxPending);
const nested = JSON.parse(invalidPending.payload.reviewJson);
nested.answer.answers[4].placements[0] = { mode: "free", tail10: [2000, 2000], targetKey: "ORIGIN" };
invalidPending.payload.reviewJson = JSON.stringify(nested);
assert.throws(() => P.decodePending(invalidPending), /Invalid force-composition review|canonical|free-placement/);

// A semantic endpoint snap must also be safe to materialise as free geometry
// later.  These two deterministic cases exercise the near-edge touch chain
// that used to pass the canvas-only predicate while leaving a force outside
// the hard visual inset.
const unsafeTouchH1 = P.freshState(0);
unsafeTouchH1.answers[2].anchor10 = [1651, 1730];
unsafeTouchH1.answers[2].placements = [
  { mode: "snap", targetKey: "ORIGIN" },
  { mode: "snap", targetKey: "F1_HEAD" }
];
assert.equal(P.validate(unsafeTouchH1, { kind: "draft" }).ok, false, "H1 near-edge endpoint snap is rejected when it cannot become free-safe");
assert.match(P.validate(unsafeTouchH1, { kind: "draft" }).reason, /resolved-force-bounds-2/);

const unsafeMobileH2 = P.freshState(1);
unsafeMobileH2.answers[3].anchor10 = [927, 3654];
unsafeMobileH2.answers[3].placements = [
  { mode: "snap", targetKey: "F2_HEAD" },
  { mode: "snap", targetKey: "ORIGIN" }
];
assert.equal(P.validate(unsafeMobileH2, { kind: "draft" }).ok, false, "H2 mobile edge chain cannot be saved outside free resultant bounds");
assert.match(P.validate(unsafeMobileH2, { kind: "draft" }).reason, /resolved-force-bounds-3/);

// Quantization-boundary regression: seed 417 H2 can put F2's tail within the
// pointer threshold of F1's head before point10() rounds the tail across its
// free clamp boundary.  It must not persist that semantic endpoint snap, and
// every resulting release must still round-trip through production storage.
const seed417Scenario = G.generateScenario({ seed: 417 });
const seed417Question = seed417Scenario.questions[3];
const seed417Initial = M.freshAnswer(seed417Question);
const seed417Geometry = M.forceGeometry(seed417Initial, seed417Question);
const seed417Snap = M.commitForceTranslation(seed417Initial, 1, seed417Geometry[0].head, seed417Question, { pointerType: "mouse" });
assert.notDeepEqual(seed417Snap.placements[1], { mode: "snap", targetKey: "F1_HEAD" }, "seed 417 H2 does not persist a quantization-unsafe F2-to-F1 endpoint snap");
for (const movingIndex of [0, 1]) {
  const released = M.releaseForceAndDescendants(seed417Snap, seed417Question, movingIndex);
  const releasedState = P.freshState(417);
  releasedState.currentQuestion = 3;
  releasedState.answers[3] = released;
  assert.doesNotThrow(() => P.productionRoundTrip(releasedState), `seed 417 H2 release F${movingIndex + 1} remains production-valid`);
}

// Property-style continuation coverage: every generated H1/H2/T1 order at
// both feasible anchor corners must survive releasing each individual force
// and then production round-tripping the resulting draft.  This closes the
// persistence state set under the same upstream-drag transition used by the
// pointer and keyboard handlers.
for (let seedValue = 0; seedValue < 1000; seedValue += 1) {
  const generated = G.generateScenario({ seed: seedValue });
  for (const questionIndex of [2, 3, 4]) {
    const question = generated.questions[questionIndex];
    for (const order of G.permutations(question.forces.map((_, index) => index))) {
      const bounds = M.chainAnchorBounds(question, order[0]);
      for (const anchor of [{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }]) {
        const answer = chainForQuestion(question, order);
        answer.anchor10 = M.point10(anchor);
        const state = P.freshState(seedValue);
        state.currentQuestion = questionIndex;
        state.answers[questionIndex] = answer;
        assert.equal(P.validate(state, { kind: "draft" }).ok, true, `seed ${seedValue} ${question.id} order ${order.join(",")} boundary chain is persistable`);
        for (const movingIndex of order) {
          const released = M.releaseForceAndDescendants(answer, question, movingIndex);
          state.answers[questionIndex] = released;
          assert.doesNotThrow(() => P.productionRoundTrip(state), `seed ${seedValue} ${question.id} order ${order.join(",")} release F${movingIndex + 1} remains production-valid`);
        }
      }
    }
  }
}

// Scan every generated initial ordered endpoint pair across 10,000 seeds.
// If the candidate establishes any semantic snap (including an implicit
// root), releasing each connected force must remain production-round-trippable
// after point10() canonicalisation.  This exercises the exact transition that
// a subsequent upstream drag performs, rather than only checking canonical
// boundary anchors.
for (let seedValue = 0; seedValue < 10000; seedValue += 1) {
  const generated = G.generateScenario({ seed: seedValue });
  const state = P.freshState(seedValue);
  for (const questionIndex of [2, 3, 4]) {
    const question = generated.questions[questionIndex];
    const initial = M.freshAnswer(question);
    const geometry = M.forceGeometry(initial, question);
    for (let movingIndex = 0; movingIndex < question.forces.length; movingIndex += 1) {
      for (let targetIndex = 0; targetIndex < question.forces.length; targetIndex += 1) {
        if (movingIndex === targetIndex) continue;
        for (const endpoint of ["TAIL", "HEAD"]) {
          const targetPoint = geometry[targetIndex][endpoint === "TAIL" ? "tail" : "head"];
          const force = question.forces[movingIndex];
          const candidateTail = endpoint === "TAIL"
            ? targetPoint
            : { x: targetPoint.x - force.dx, y: targetPoint.y - force.dy };
          const answer = M.commitForceTranslation(initial, movingIndex, candidateTail, question, { pointerType: "mouse" });
          const hasSemanticSnap = answer.placements.some((placement) => placement.mode === "snap");
          if (!hasSemanticSnap) continue;
          state.currentQuestion = questionIndex;
          state.answers[questionIndex] = answer;
          assert.doesNotThrow(() => P.productionRoundTrip(state), `seed ${seedValue} ${question.id} F${movingIndex + 1} ${endpoint} to F${targetIndex + 1} persists`);
          for (let releaseIndex = 0; releaseIndex < question.forces.length; releaseIndex += 1) {
            const released = M.releaseForceAndDescendants(answer, question, releaseIndex);
            state.answers[questionIndex] = released;
            assert.doesNotThrow(() => P.productionRoundTrip(state), `seed ${seedValue} ${question.id} endpoint pair release F${releaseIndex + 1} persists`);
          }
        }
      }
    }
  }
}

console.log("force-composition persistence tests passed");
