"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");

const scenario = G.generateScenario({ seed: 7 });

const boundaryParallelogram = {
  type: "parallelogram",
  forces: [G.vector(95, 0, "F1"), G.vector(95, 50, "F2")],
  initialTails: [{ x: 120, y: 120 }, { x: 120, y: 360 }]
};
const boundaryBounds = M.parallelogramAnchorBounds(boundaryParallelogram);
assert.equal(M.anchorWithinBounds({ x: 631, y: 250 }, boundaryParallelogram), false, "P anchor bounds include the fourth vertex, not only the two force heads");
const boundaryAnswer = M.freshAnswer(boundaryParallelogram);
boundaryAnswer.anchor10 = M.point10(M.clampAnchor({ x: 631, y: 250 }, boundaryParallelogram));
boundaryAnswer.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
assert.ok(M.resolvedForceGeometryWithinBounds(boundaryAnswer, boundaryParallelogram), "clamped P anchor keeps all four construction vertices inside the canvas");
assert.ok(M.corner(boundaryParallelogram, boundaryAnswer).x <= G.WIDTH - M.MODEL_VISUAL_INSET + M.MODEL_EPSILON);
assert.ok(boundaryBounds.maxX < 631);

function correctParallelogram(index = 0) {
  const question = scenario.questions[index];
  let answer = M.freshAnswer(question);
  answer.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
  answer.guides = [
    { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "CORNER" } },
    { originKey: "F2_HEAD", end: { mode: "snap", targetKey: "CORNER" } }
  ];
  answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CORNER" } };
  return answer;
}

function chainAnswer(question, order, completeResultant = true) {
  const answer = M.freshAnswer(question);
  answer.placements[order[0]] = { mode: "snap", targetKey: "ORIGIN" };
  for (let index = 1; index < order.length; index += 1) answer.placements[order[index]] = { mode: "snap", targetKey: M.headKey(order[index - 1]) };
  if (completeResultant) answer.resultant = { originKey: "ORIGIN", end: { mode: "snap", targetKey: "CHAIN_END" } };
  return answer;
}

const firstQuestion = scenario.questions[0];
const initial = M.freshAnswer(firstQuestion);
const beforeForce = firstQuestion.forces[0];
const moved = M.commitForceTranslation(initial, 0, { x: 270, y: 130 }, firstQuestion, { pointerType: "mouse" });
assert.equal(firstQuestion.forces[0].dx, beforeForce.dx);
assert.equal(firstQuestion.forces[0].dy, beforeForce.dy);
assert.equal(Math.hypot(firstQuestion.forces[0].dx, firstQuestion.forces[0].dy), Math.hypot(beforeForce.dx, beforeForce.dy), "translation cannot resize the vector");
assert.equal(moved.placements[0].mode, "snap", "the first placed force establishes a freely chosen common anchor");
assert.deepEqual(moved.anchor10, [2700, 1300]);
const secondAtArbitraryAnchor = M.commitForceTranslation(moved, 1, { x: 270, y: 130 }, firstQuestion, { pointerType: "mouse" });
assert.deepEqual(M.forceGeometry(secondAtArbitraryAnchor, firstQuestion).map((item) => item.tail), [{ x: 270, y: 130 }, { x: 270, y: 130 }], "the second force snaps to the selected anchor, not a fixed screen point");

const nearOrigin = M.commitForceTranslation(initial, 0, { x: 399, y: 250 }, firstQuestion, { pointerType: "touch" });
assert.deepEqual(nearOrigin.placements[0], { mode: "snap", targetKey: "ORIGIN" }, "19 CSS px touch distance snaps");
const outsideOrigin = M.commitForceTranslation(initial, 0, { x: 401, y: 250 }, firstQuestion, { pointerType: "touch" });
assert.equal(outsideOrigin.placements[0].mode, "snap", "the first force may establish an anchor at any valid position");
assert.notDeepEqual(outsideOrigin.anchor10, [3800, 2500]);

const touchBoundaryQuestion = {
  type: "head-to-tail-2",
  forces: [G.vector(95, 45, "F1"), G.vector(100, 90, "F2")],
  initialTails: [{ x: 111.412428, y: 163.587572 }, { x: 280, y: 300 }]
};
const touchBoundaryAnswer = M.freshAnswer(touchBoundaryQuestion);
const touchBoundaryCandidate = { x: 178.6, y: 134 };
const touchBoundarySnap = M.commitForceTranslation(touchBoundaryAnswer, 1, touchBoundaryCandidate, touchBoundaryQuestion, {
  pointerType: "touch", project: (point) => ({ x: point.x * 0.42, y: point.y * 0.42 })
});
assert.notDeepEqual(touchBoundarySnap.placements[1], { mode: "snap", targetKey: "F1_HEAD" }, "touch near-miss does not save an out-of-bounds head-to-tail relationship");
assert.ok(M.resolvedForceGeometryWithinBounds(touchBoundarySnap, touchBoundaryQuestion), "touch near-miss falls back to a persistence-safe geometry");
const liveTailSnap = M.previewSnappedForceTranslation(initial, 0, firstQuestion.initialTails[1], firstQuestion, { threshold: 14 });
assert.deepEqual(liveTailSnap.placements, [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }], "live force preview snaps both forces before pointer release");
const liveFarPreview = M.previewSnappedForceTranslation(initial, 0, { x: 200, y: 200 }, firstQuestion, { threshold: 14 });
assert.equal(liveFarPreview.placements[0].mode, "free", "moving away from a snap target immediately returns to a free preview");

// P1 endpoint targets must use the complete, canonical root-feasible region.
// Seed 0 deliberately places F1's tail outside that region while the two
// individual force vectors still fit.  The invalid direction must remain a
// free placement instead of previewing a snap that persistence will reject.
const bidirectionalP1 = G.generateScenario({ seed: 0 }).questions[0];
const bidirectionalAnswer = M.freshAnswer(bidirectionalP1);
const bidirectionalGeometry = M.forceGeometry(bidirectionalAnswer, bidirectionalP1);
assert.equal(M.anchorWithinBounds(bidirectionalGeometry[0].tail, bidirectionalP1), false, "regression seed keeps the old over-restrictive root case");
const validP1Preview = M.previewSnappedForceTranslation(bidirectionalAnswer, 0, bidirectionalGeometry[1].tail, bidirectionalP1, {
  pointerType: "mouse", threshold: M.SNAP_POINTER_PX
});
assert.deepEqual(validP1Preview.placements, [
  { mode: "snap", targetKey: M.ORIGIN_KEY },
  { mode: "snap", targetKey: M.ORIGIN_KEY }
], "P1 moving F1 onto the feasible F2 tail snaps both vectors to the common origin");
const reverseP1Preview = M.previewSnappedForceTranslation(bidirectionalAnswer, 1, bidirectionalGeometry[0].tail, bidirectionalP1, {
  pointerType: "mouse", threshold: M.SNAP_POINTER_PX
});
assert.deepEqual(reverseP1Preview.placements, [{ mode: "initial" }, { mode: "free", tail10: M.point10(bidirectionalGeometry[0].tail) }], "P1 rejects an out-of-bounds common-origin snap before release");
assert.equal(reverseP1Preview.anchor10, null, "P1 invalid snap does not create an out-of-bounds anchor");
assert.equal(M.canEstablishParallelogramOrigin(bidirectionalAnswer, bidirectionalP1, bidirectionalGeometry[0].tail), false, "P1 invalid root is rejected by the shared predicate");
assert.ok(M.resolvedForceGeometryWithinBounds(reverseP1Preview, bidirectionalP1), "P1 invalid-snap fallback remains release-safe");
assert.ok(M.selectSnapCandidate({ x: 14, y: 0 }, [{ key: "A", point: { x: 0, y: 0 } }], { pointerType: "mouse" }), "inclusive 14px pointer threshold snaps");
assert.equal(M.selectSnapCandidate({ x: 14.01, y: 0 }, [{ key: "A", point: { x: 0, y: 0 } }], { pointerType: "mouse" }), null);
assert.ok(M.selectSnapCandidate({ x: 6, y: 0 }, [{ key: "A", point: { x: 0, y: 0 } }], { pointerType: "keyboard", project: (point) => ({ x: point.x * 2, y: point.y * 2 }) }), "keyboard threshold is evaluated in projected CSS pixels");
assert.equal(M.selectSnapCandidate({ x: 10, y: 0 }, [{ key: "B", point: { x: 0, y: 0 } }, { key: "A", point: { x: 0, y: 0 } }], { threshold: 20 }).key, "A", "equal-distance ties use stable key order");
assert.equal(M.selectSnapCandidate({ x: 10, y: 0 }, [{ key: "F1_TAIL", point: { x: 0, y: 0 } }, { key: "ORIGIN", point: { x: 0, y: 0 } }], { threshold: 20, preferredKeys: ["ORIGIN"] }).key, "ORIGIN", "semantic priorities win equal endpoint ties");

const P = correctParallelogram();
assert.equal(M.derivedVariant(P, firstQuestion), "complete");
const releasedP = M.previewForceTranslation(P, 0, { x: 200, y: 200 }, firstQuestion);
assert.deepEqual(releasedP.guides, [null, null], "moving a common-origin force atomically clears both guides");
assert.equal(releasedP.resultant, null, "moving a common-origin force atomically clears resultant");

const P2Question = scenario.questions[1];
let P2 = M.freshAnswer(P2Question);
P2.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
P2 = M.commitGuide(P2, "ORIGIN", M.corner(P2Question), P2Question, { threshold: 1000 });
assert.equal(P2.guides.filter(Boolean)[0].end.mode, "free", "wrong neutral guide origin remains provisional even on the corner");
const p2FirstStart = M.endpointForKey(P2, P2Question, "ORIGIN");
const p2SecondStart = M.endpointForKey(P2, P2Question, "F1_HEAD");
const p2Midpoint = { x: (p2FirstStart.x + p2SecondStart.x) / 2, y: (p2FirstStart.y + p2SecondStart.y) / 2 };
const p2Half = { x: (p2SecondStart.x - p2FirstStart.x) / 2, y: (p2SecondStart.y - p2FirstStart.y) / 2 };
const P2Crossing = M.clone(P2);
P2Crossing.guides = [
  { originKey: "ORIGIN", end: { mode: "free", point10: M.point10(M.clampLinePoint({ x: p2Midpoint.x + p2Half.x * 0.8, y: p2Midpoint.y + p2Half.y * 0.8 })) } },
  { originKey: "F1_HEAD", end: { mode: "free", point10: M.point10(M.clampLinePoint({ x: p2Midpoint.x - p2Half.x * 0.8, y: p2Midpoint.y - p2Half.y * 0.8 })) } }
];
assert.ok(M.guideIntersectionPoint(P2Crossing, P2Question), "P2 arbitrary guide origins also expose their visible intersection");
assert.throws(() => M.commitGuide({ ...M.freshAnswer(firstQuestion), placements: P2.placements }, "ORIGIN", M.corner(firstQuestion), firstQuestion), /not available|Guide/);
const guideOrigin = M.endpointForKey(P, firstQuestion, "F1_HEAD");
const guideDirection = firstQuestion.forces[1];
const arbitraryGuideEnd = { x: guideOrigin.x + guideDirection.dx * 0.4, y: guideOrigin.y + guideDirection.dy * 0.4 };
const parallelGuide = M.commitGuide(P, "F1_HEAD", arbitraryGuideEnd, firstQuestion);
assert.deepEqual(parallelGuide.guides[0].end.mode, "snap");
assert.equal(parallelGuide.guides[0].end.targetKey, "PARALLEL", "a guide snaps by direction without requiring the fourth vertex");
assert.ok(Math.abs(M.distance(M.lineEndPoint(parallelGuide.guides[0], parallelGuide, firstQuestion), guideOrigin) - M.distance(arbitraryGuideEnd, guideOrigin)) < 1, "parallel snap preserves learner-chosen guide length");
const liveParallelGuide = M.previewGuide(P, "F2_HEAD", { x: M.endpointForKey(P, firstQuestion, "F2_HEAD").x + firstQuestion.forces[0].dx * 0.35, y: M.endpointForKey(P, firstQuestion, "F2_HEAD").y + firstQuestion.forces[0].dy * 0.35 }, firstQuestion, { snap: true });
assert.equal(liveParallelGuide.guides[1].end.targetKey, "PARALLEL", "guide direction visibly snaps before release");

// The saved guide endpoint is quantized to 0.1 model units.  Near the
// minimum-length threshold, rounding a projected endpoint can shorten it
// below the 8-unit requirement; preview must therefore leave it provisional
// instead of creating a PARALLEL relationship that persistence would reject.
const canonicalGuideQuestion = {
  type: "parallelogram",
  forces: [
    { key: "F1", dx: 1, dy: 0 },
    { key: "F2", dx: 0.1278379220029071, dy: -0.9917950724307812 }
  ],
  initialTails: [{ x: 0, y: 0 }, { x: 0, y: 0 }]
};
const canonicalGuideAnswer = {
  type: "parallelogram",
  anchor10: [495, 951],
  placements: [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }],
  guides: [null, null],
  resultant: null
};
const nearMinimumGuideEnd = { x: 51.8, y: 87.2 };
assert.equal(M.parallelSnapPoint(canonicalGuideAnswer, canonicalGuideQuestion, "F1_HEAD", nearMinimumGuideEnd), null, "parallel snap rejects a canonical endpoint rounded below the minimum length");
const canonicalGuidePreview = M.previewGuide(canonicalGuideAnswer, "F1_HEAD", nearMinimumGuideEnd, canonicalGuideQuestion, { snap: true });
assert.equal(canonicalGuidePreview.guides[0].end.mode, "free", "near-minimum preview stays persistence-safe");
const malformedParallelGuide = M.clone(canonicalGuideAnswer);
malformedParallelGuide.guides[0] = { originKey: "F1_HEAD", end: { mode: "snap", targetKey: "PARALLEL", point10: [518, 872] } };
assert.equal(M.guideEndIsParallel(malformedParallelGuide, canonicalGuideQuestion, malformedParallelGuide.guides[0]), false, "a skewed saved PARALLEL endpoint is not canonical");
assert.equal(M.correctGuides(malformedParallelGuide, canonicalGuideQuestion).length, 0, "scoring-facing correctGuides rejects a skewed saved PARALLEL endpoint");
const wrongGuides = M.freshAnswer(firstQuestion);
wrongGuides.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
wrongGuides.guides = [
  { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 3000] } },
  { originKey: "F2_HEAD", end: { mode: "free", point10: [5200, 1600] } }
];
assert.equal(M.resultantAvailable(wrongGuides, firstQuestion), true, "two drawn guides unlock resultant mode even when their directions are wrong");
const wrongGuideIntersection = M.guideIntersectionPoint(wrongGuides, firstQuestion);
assert.ok(wrongGuideIntersection, "two crossing wrong guides expose their visible segment intersection");
const wrongGuideResultant = M.commitResultant(wrongGuides, "ORIGIN", { x: wrongGuideIntersection.x + 7, y: wrongGuideIntersection.y - 6 }, firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, pointerType: "mouse"
});
assert.deepEqual(wrongGuideResultant.resultant.end, {
  mode: "snap", targetKey: M.GUIDE_INTERSECTION_KEY, point10: M.point10(wrongGuideIntersection)
}, "a resultant endpoint near a wrong-guide crossing snaps to that crossing");
assert.ok(M.distance(M.lineEndPoint(wrongGuideResultant.resultant, wrongGuideResultant, firstQuestion), wrongGuideIntersection) <= M.POSITION_QUANTUM, "the snapped wrong-guide crossing is the visible endpoint");
const wrongResultant = M.previewResultant(wrongGuides, "F1_HEAD", { x: 650, y: 300 }, firstQuestion, { allowIncomplete: true, allowAnyOrigin: true });
assert.equal(wrongResultant.resultant.originKey, "F1_HEAD", "resultant mode permits an intentionally wrong start endpoint");
const snappedToOtherCorner = M.previewResultant(wrongResultant, "F1_HEAD", M.endpointForKey(wrongResultant, firstQuestion, "F2_HEAD"), firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, snap: true, threshold: 1000
});
assert.deepEqual(snappedToOtherCorner.resultant.end, { mode: "snap", targetKey: "F2_HEAD" }, "resultant end may snap to any parallelogram corner");
const movedResultantStart = M.commitResultantStart(snappedToOtherCorner, M.corner(firstQuestion, snappedToOtherCorner), firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, pointerType: "mouse", threshold: 14
});
assert.equal(movedResultantStart.resultant.originKey, "CORNER", "resultant start may be dragged to the opposite corner");
const freeResultantStart = M.commitResultantStart(movedResultantStart, { x: 200, y: 200 }, firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, pointerType: "mouse"
});
assert.equal(freeResultantStart.resultant.originKey, "FREE", "resultant start remains editable between corner snaps");
assert.deepEqual(freeResultantStart.resultant.originPoint10, [2000, 2000]);
const freeInitialResultant = M.previewResultant(wrongGuides, "FREE", { x: 520, y: 300 }, firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, originPoint: { x: 210, y: 190 }, snap: true, pointerType: "mouse"
});
assert.deepEqual(freeInitialResultant.resultant.originPoint10, [2100, 1900], "resultant can begin at an arbitrary stage position");
const nearCorrectPResultant = M.previewResultant(wrongGuides, "FREE", { x: 520, y: 300 }, firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, originPoint: { x: M.anchorPoint(wrongGuides).x + 8, y: M.anchorPoint(wrongGuides).y - 6 }, snap: true, pointerType: "mouse"
});
assert.equal(nearCorrectPResultant.resultant.originKey, "ORIGIN", "a near-correct parallelogram resultant start snaps to the selected common origin");
assert.equal(Object.hasOwn(nearCorrectPResultant.resultant, "originPoint10"), false, "a snapped resultant start no longer stores a free origin");
const committedFreeInitial = M.commitResultant(wrongGuides, "FREE", { x: 520, y: 300 }, firstQuestion, {
  allowIncomplete: true, allowAnyOrigin: true, originPoint: { x: 210, y: 190 }
});
assert.deepEqual(committedFreeInitial.resultant.originPoint10, [2100, 1900], "arbitrary resultant origin persists on release");
const translatedParallelogram = M.commitResultantTranslation(committedFreeInitial, { x: 40, y: -20 }, firstQuestion, {
  allowIncomplete: true, pointerType: "mouse"
});
assert.equal(translatedParallelogram.resultant.originKey, "FREE", "whole resultant translation preserves an editable free origin");
assert.deepEqual(translatedParallelogram.resultant.originPoint10, [2500, 1700]);
assert.deepEqual(M.lineEndPoint(translatedParallelogram.resultant, translatedParallelogram, firstQuestion), { x: 560, y: 280 }, "whole resultant translation preserves the vector");

// When both resultant endpoints are still inside snap range, the two raw snap
// objects must be handled with the same data shape.  A no-op whole-line drag
// is enough to exercise the companion-end branch that previously dereferenced
// `companion.snap.point` and threw a TypeError.
assert.doesNotThrow(() => M.previewResultantTranslation(P, { x: 0, y: 0 }, firstQuestion, {
  allowIncomplete: true, snap: true, pointerType: "mouse"
}), "two-end resultant near-snap preview remains safe");
const twoEndSnapped = M.commitResultantTranslation(P, { x: 0, y: 0 }, firstQuestion, {
  allowIncomplete: true, pointerType: "mouse"
});
assert.equal(M.canonicalResultant(twoEndSnapped, firstQuestion), true, "two-end resultant snap preserves the canonical connection");

// A guide must follow the other force's arrow direction, not merely its
// undirected line.  The reverse 180° direction remains free/provisional and
// therefore contributes no correct-guide score.
const reverseGuideOrigin = M.endpointForKey(P, firstQuestion, "F1_HEAD");
const reverseGuideDirection = firstQuestion.forces[1];
const reverseGuide = M.commitGuide(P, "F1_HEAD", {
  x: reverseGuideOrigin.x - reverseGuideDirection.dx * 0.35,
  y: reverseGuideOrigin.y - reverseGuideDirection.dy * 0.35
}, firstQuestion);
assert.equal(reverseGuide.guides[0].end.mode, "free", "a reverse-direction guide stays provisional");
assert.equal(M.guideEndIsParallel(reverseGuide, firstQuestion, reverseGuide.guides[0]), false, "a reverse-direction guide is not parallel for scoring");
assert.equal(M.correctGuides(reverseGuide).length, 1, "the untouched guide remains independently correct");

const boundaryTranslationQuestion = {
  type: "parallelogram",
  forces: [G.vector(95, 0, "F1"), G.vector(95, 50, "F2")],
  initialTails: [{ x: 120, y: 120 }, { x: 120, y: 360 }]
};
const boundaryTranslation = M.freshAnswer(boundaryTranslationQuestion);
boundaryTranslation.anchor10 = M.point10({ x: 34, y: 250 });
boundaryTranslation.placements = [{ mode: "snap", targetKey: "ORIGIN" }, { mode: "snap", targetKey: "ORIGIN" }];
boundaryTranslation.guides = [
  { originKey: "F1_HEAD", end: { mode: "free", point10: [3000, 2500] } },
  { originKey: "F2_HEAD", end: { mode: "free", point10: [3000, 3000] } }
];
boundaryTranslation.resultant = {
  originKey: "FREE", originPoint10: [340, 2500],
  end: { mode: "free", point10: [6510, 2500] }
};
const boundaryTranslated = M.commitResultantTranslation(boundaryTranslation, { x: 85, y: 0 }, boundaryTranslationQuestion, { pointerType: "mouse" });
assert.equal(boundaryTranslated.resultant.originKey, "FREE", "an inexact boundary correction remains a free resultant");
assert.equal(boundaryTranslated.resultant.end.mode, "free", "an inexact boundary correction does not save a clipped endpoint snap");
assert.ok(M.lineEndPoint(boundaryTranslated.resultant, boundaryTranslated, boundaryTranslationQuestion).x <= G.WIDTH - M.FREE_LINE_INSET + M.MODEL_EPSILON);

const HQuestion = scenario.questions[2];
const TQuestion = scenario.questions[4];
for (const order of [[0, 1], [1, 0]]) {
  const answer = chainAnswer(HQuestion, order);
  assert.deepEqual(M.chainInfo(answer, HQuestion).order, order);
  assert.equal(M.canonicalResultant(answer, HQuestion), true);
  assert.deepEqual(M.corner(HQuestion), M.endpointForKey(answer, HQuestion, "CHAIN_END"));
}
const freshChain = M.freshAnswer(HQuestion);
const freshChainGeometry = M.forceGeometry(freshChain, HQuestion);
const reverseFirst = M.commitForceTranslation(freshChain, 0, freshChainGeometry[1].head, HQuestion, { pointerType: "mouse", threshold: 14 });
assert.deepEqual(reverseFirst.placements, [{ mode: "snap", targetKey: "F2_HEAD" }, { mode: "snap", targetKey: "ORIGIN" }], "either force may be placed first by snapping its tail to the other force head");
assert.deepEqual(M.chainInfo(reverseFirst, HQuestion).order, [1, 0], "reverse first placement establishes the stationary force as chain root");
const endpointSnapCases = [
  { moving: 0, endpoint: "TAIL", target: "F2_HEAD", order: [1, 0] },
  { moving: 0, endpoint: "HEAD", target: "F2_TAIL", order: [0, 1] },
  { moving: 1, endpoint: "TAIL", target: "F1_HEAD", order: [0, 1] },
  { moving: 1, endpoint: "HEAD", target: "F1_TAIL", order: [1, 0] }
];
for (const testCase of endpointSnapCases) {
  const answer = M.freshAnswer(HQuestion);
  const geometry = M.forceGeometry(answer, HQuestion);
  const targetIndex = testCase.moving === 0 ? 1 : 0;
  const target = geometry[targetIndex][testCase.target.endsWith("HEAD") ? "head" : "tail"];
  const force = HQuestion.forces[testCase.moving];
  const candidateTail = testCase.endpoint === "TAIL" ? target : { x: target.x - force.dx, y: target.y - force.dy };
  const snapped = M.commitForceTranslation(answer, testCase.moving, candidateTail, HQuestion, { pointerType: "mouse", threshold: 14 });
  assert.equal(snapped.placements[testCase.moving].mode, "snap", `moving F${testCase.moving + 1} ${testCase.endpoint.toLowerCase()} snaps`);
  assert.deepEqual(M.chainInfo(snapped, HQuestion).order, testCase.order, `moving F${testCase.moving + 1} ${testCase.endpoint.toLowerCase()} creates the expected chain order`);
  assert.equal(M.chainInfo(snapped, HQuestion).complete, true, `moving F${testCase.moving + 1} ${testCase.endpoint.toLowerCase()} completes H1`);
}
const stationary = M.freshAnswer(HQuestion);
const stationaryGeometry = M.forceGeometry(stationary, HQuestion);
const stationaryTail = stationaryGeometry[0].tail;
const exactHeadTail = { x: stationaryTail.x - HQuestion.forces[1].dx, y: stationaryTail.y - HQuestion.forces[1].dy };
const nearMissHeadTail = { x: exactHeadTail.x + 8, y: exactHeadTail.y };
const snappedNearMiss = M.commitForceTranslation(stationary, 1, nearMissHeadTail, HQuestion, { pointerType: "mouse", threshold: 14 });
const snappedNearMissGeometry = M.forceGeometry(snappedNearMiss, HQuestion);
assert.ok(M.distance(snappedNearMissGeometry[0].tail, stationaryTail) <= 0.1, "head-to-tail snap keeps the stationary force endpoint fixed");
assert.ok(M.distance(snappedNearMissGeometry[1].head, stationaryTail) <= 0.1, "head-to-tail snap moves the dragged force onto the stationary endpoint");

// A first/root force can be individually safe while its tail is outside the
// all-orders root-feasible region.  The live preview must use that same
// individual candidate for both rendering and snap detection: crossing the
// semantic endpoint threshold may snap, but it must not jump from a hidden
// root-clamped position many model units away.
const continuityH2 = G.generateScenario({ seed: 91 }).questions[3];
const continuityAnswer = M.freshAnswer(continuityH2);
const continuityGeometry = M.forceGeometry(continuityAnswer, continuityH2);
const continuityTarget = continuityGeometry[0].head;
const continuityOutsideCandidate = { x: continuityTarget.x - (M.SNAP_POINTER_PX + 1), y: continuityTarget.y };
const continuityInsideCandidate = { x: continuityTarget.x - (M.SNAP_POINTER_PX - 1), y: continuityTarget.y };
const continuityOutside = M.previewSnappedForceTranslation(continuityAnswer, 1, continuityOutsideCandidate, continuityH2, { pointerType: "mouse", threshold: M.SNAP_POINTER_PX });
const continuityInside = M.previewSnappedForceTranslation(continuityAnswer, 1, continuityInsideCandidate, continuityH2, { pointerType: "mouse", threshold: M.SNAP_POINTER_PX });
const continuityOutsideTail = M.forceGeometry(continuityOutside, continuityH2)[1].tail;
const continuityInsideTail = M.forceGeometry(continuityInside, continuityH2)[1].tail;
assert.equal(continuityOutside.placements[1].mode, "free", "H2 threshold-outside preview remains the visible free candidate");
assert.deepEqual(continuityInside.placements, [
  { mode: "snap", targetKey: M.ORIGIN_KEY },
  { mode: "snap", targetKey: "F1_HEAD" }
], "H2 threshold-inside preview uses the visible candidate for endpoint snap");
assert.ok(M.distance(continuityOutsideTail, continuityInsideTail) <= M.SNAP_POINTER_PX + 2 + M.POSITION_QUANTUM + M.MODEL_EPSILON,
  "H2 threshold crossing stays within pointer movement plus snap threshold");
assert.ok(M.distance(continuityOutsideTail, continuityInsideTail) < 20, "H2 threshold crossing does not jump from the hidden root-clamped candidate");
const continuityCommitted = M.commitForceTranslation(continuityAnswer, 1, continuityInsideCandidate, continuityH2, { pointerType: "mouse", threshold: M.SNAP_POINTER_PX });
assert.deepEqual(continuityCommitted.placements, continuityInside.placements, "H2 pointerup commits the same threshold-inside snap preview");

// Keyboard movement has an explicit 2/10-unit contract.  In particular, a
// fresh force outside the chain/parallelogram root region must remain free;
// the ordinary Arrow key must never project it to a distant root boundary.
const keyboardBoundaryScenario = G.generateScenario({ seed: 2990 });
const keyboardBoundaryQuestion = keyboardBoundaryScenario.questions[1];
const keyboardBoundaryAnswer = M.freshAnswer(keyboardBoundaryQuestion);
const keyboardBoundaryBefore = M.forceGeometry(keyboardBoundaryAnswer, keyboardBoundaryQuestion)[0].tail;
const keyboardBoundaryAfter = M.commitForceTranslation(keyboardBoundaryAnswer, 0, {
  x: keyboardBoundaryBefore.x + 2, y: keyboardBoundaryBefore.y
}, keyboardBoundaryQuestion, { pointerType: "keyboard" });
const keyboardBoundaryTail = M.forceGeometry(keyboardBoundaryAfter, keyboardBoundaryQuestion)[0].tail;
assert.ok(Math.abs(keyboardBoundaryTail.x - keyboardBoundaryBefore.x - 2) <= 0.11, "seed 2990 P2 F1 ArrowRight moves two horizontal units");
assert.ok(Math.abs(keyboardBoundaryTail.y - keyboardBoundaryBefore.y) <= 0.11, "seed 2990 P2 F1 ArrowRight does not move vertically");
assert.equal(keyboardBoundaryAfter.placements[0].mode, "free", "seed 2990 P2 F1 remains free outside the root region");
assert.equal(keyboardBoundaryAfter.anchor10, null, "seed 2990 P2 F1 does not create a distant root on ArrowRight");

const keyboardDirections = [
  { x: 1, y: 0, name: "right" }, { x: -1, y: 0, name: "left" },
  { x: 0, y: 1, name: "down" }, { x: 0, y: -1, name: "up" }
];
for (let seedValue = 0; seedValue < 10000; seedValue += 1) {
  const generated = G.generateScenario({ seed: seedValue });
  for (const question of generated.questions) {
    for (let movingIndex = 0; movingIndex < question.forces.length; movingIndex += 1) {
      for (const direction of keyboardDirections) {
        for (const shift of [false, true]) {
          const answer = M.freshAnswer(question);
          const before = M.forceGeometry(answer, question)[movingIndex].tail;
          const step = shift ? 10 : 2;
          const candidate = { x: before.x + direction.x * step, y: before.y + direction.y * step };
          const preview = M.previewSnappedForceTranslation(answer, movingIndex, candidate, question, { pointerType: "keyboard" });
          const committed = M.commitForceTranslation(answer, movingIndex, candidate, question, { pointerType: "keyboard" });
          const previewTail = M.forceGeometry(preview, question)[movingIndex].tail;
          const committedTail = M.forceGeometry(committed, question)[movingIndex].tail;
          assert.ok(M.distance(committedTail, previewTail) <= 0.11, `seed ${seedValue} ${question.id} F${movingIndex + 1} ${direction.name} ${shift ? "shift" : "ordinary"} preview/release geometry parity`);
          const placement = committed.placements[movingIndex];
          if (placement.mode !== "free") continue;
          const after = M.forceGeometry(committed, question)[movingIndex].tail;
          const axisDelta = direction.x ? after.x - before.x : after.y - before.y;
          const orthogonalDelta = direction.x ? after.y - before.y : after.x - before.x;
          assert.ok(Math.abs(axisDelta) <= step + 0.11, `seed ${seedValue} ${question.id} F${movingIndex + 1} ${direction.name} ${shift ? "shift" : "ordinary"} respects ${step}-unit axis step`);
          assert.ok(Math.abs(orthogonalDelta) <= 0.11, `seed ${seedValue} ${question.id} F${movingIndex + 1} ${direction.name} ${shift ? "shift" : "ordinary"} keeps orthogonal axis fixed`);
          assert.equal(committed.anchor10, null, `seed ${seedValue} ${question.id} free keyboard step does not create an implicit root`);
        }
      }
    }
  }
}

const establishedChain = chainAnswer(HQuestion, [0, 1]);
const establishedGeometry = M.forceGeometry(establishedChain, HQuestion);
const reRooted = M.commitForceTranslation(establishedChain, 1, {
  x: establishedGeometry[0].tail.x - HQuestion.forces[1].dx,
  y: establishedGeometry[0].tail.y - HQuestion.forces[1].dy
}, HQuestion, { pointerType: "mouse", threshold: 14 });
assert.deepEqual(M.chainInfo(reRooted, HQuestion).order, [1, 0], "moving a placed force head onto the root tail re-roots the two-force chain");
const translatedChain = M.commitResultantTranslation(chainAnswer(HQuestion, [0, 1]), { x: 40, y: -20 }, HQuestion, { pointerType: "mouse" });
assert.equal(translatedChain.resultant.originKey, "FREE", "head-to-tail resultant can be translated as a whole");
assert.equal(translatedChain.resultant.end.mode, "free");
const editedTranslatedChain = M.commitResultant(translatedChain, "FREE", { x: 520, y: 280 }, HQuestion, { pointerType: "mouse" });
assert.deepEqual(editedTranslatedChain.resultant.end, { mode: "free", point10: [5200, 2800] }, "a translated resultant remains endpoint-editable");
const oneEndNearOrigin = chainAnswer(HQuestion, [0, 1], false);
oneEndNearOrigin.resultant = {
  originKey: "FREE",
  originPoint10: [M.point10({ x: M.anchorPoint(oneEndNearOrigin).x - 8, y: M.anchorPoint(oneEndNearOrigin).y })[0], M.point10({ x: M.anchorPoint(oneEndNearOrigin).x - 8, y: M.anchorPoint(oneEndNearOrigin).y })[1]],
  end: { mode: "free", point10: [M.point10({ x: M.anchorPoint(oneEndNearOrigin).x + 42, y: M.anchorPoint(oneEndNearOrigin).y + 18 })[0], M.point10({ x: M.anchorPoint(oneEndNearOrigin).x + 42, y: M.anchorPoint(oneEndNearOrigin).y + 18 })[1]] }
};
const beforeOneEndVector = {
  start: M.lineStartPoint(oneEndNearOrigin.resultant, oneEndNearOrigin, HQuestion),
  end: M.lineEndPoint(oneEndNearOrigin.resultant, oneEndNearOrigin, HQuestion)
};
const snappedOneEnd = M.commitResultantTranslation(oneEndNearOrigin, { x: 0, y: 0 }, HQuestion, { pointerType: "mouse" });
const afterOneEndVector = {
  start: M.lineStartPoint(snappedOneEnd.resultant, snappedOneEnd, HQuestion),
  end: M.lineEndPoint(snappedOneEnd.resultant, snappedOneEnd, HQuestion)
};
assert.equal(snappedOneEnd.resultant.originKey, "ORIGIN", "translation snaps a near start without changing its semantic priority");
assert.ok(Math.abs((afterOneEndVector.end.x - afterOneEndVector.start.x) - (beforeOneEndVector.end.x - beforeOneEndVector.start.x)) <= M.POSITION_QUANTUM);
assert.ok(Math.abs((afterOneEndVector.end.y - afterOneEndVector.start.y) - (beforeOneEndVector.end.y - beforeOneEndVector.start.y)) <= M.POSITION_QUANTUM);
const oneEndNearChainEnd = chainAnswer(HQuestion, [0, 1], false);
const chainEnd = M.endpointForKey(oneEndNearChainEnd, HQuestion, "CHAIN_END");
oneEndNearChainEnd.resultant = {
  originKey: "FREE",
  originPoint10: [1000, 1000],
  end: { mode: "free", point10: M.point10({ x: chainEnd.x - 8, y: chainEnd.y }) }
};
const beforeEndVector = {
  start: M.lineStartPoint(oneEndNearChainEnd.resultant, oneEndNearChainEnd, HQuestion),
  end: M.lineEndPoint(oneEndNearChainEnd.resultant, oneEndNearChainEnd, HQuestion)
};
const snappedEndOnly = M.commitResultantTranslation(oneEndNearChainEnd, { x: 0, y: 0 }, HQuestion, { pointerType: "mouse" });
assert.equal(snappedEndOnly.resultant.end.targetKey, "CHAIN_END", "translation snaps a near end without changing the line vector");
const afterEndVector = {
  start: M.lineStartPoint(snappedEndOnly.resultant, snappedEndOnly, HQuestion),
  end: M.lineEndPoint(snappedEndOnly.resultant, snappedEndOnly, HQuestion)
};
assert.ok(Math.abs((afterEndVector.end.x - afterEndVector.start.x) - (beforeEndVector.end.x - beforeEndVector.start.x)) <= M.POSITION_QUANTUM);
assert.ok(Math.abs((afterEndVector.end.y - afterEndVector.start.y) - (beforeEndVector.end.y - beforeEndVector.start.y)) <= M.POSITION_QUANTUM);
const arbitraryChainResultant = M.commitResultant(chainAnswer(HQuestion, [0, 1]), "F1_HEAD", M.endpointForKey(chainAnswer(HQuestion, [0, 1]), HQuestion, "F2_HEAD"), HQuestion, {
  allowAnyOrigin: true, pointerType: "mouse", threshold: 14
});
assert.equal(arbitraryChainResultant.resultant.originKey, "F1_HEAD", "head-to-tail resultant may start at any force endpoint");
assert.deepEqual(arbitraryChainResultant.resultant.end, { mode: "snap", targetKey: "F2_HEAD" }, "head-to-tail resultant endpoint may snap to any force endpoint");
const canonicalChainResultant = M.commitResultant(chainAnswer(HQuestion, [0, 1]), "ORIGIN", M.endpointForKey(chainAnswer(HQuestion, [0, 1]), HQuestion, "F2_HEAD"), HQuestion, {
  pointerType: "mouse", threshold: 14
});
assert.deepEqual(canonicalChainResultant.resultant.end, { mode: "snap", targetKey: "CHAIN_END" }, "a resultant from the chain root prefers the semantic chain-end snap");
for (const order of [[0, 1], [1, 0]]) {
  const chain = chainAnswer(HQuestion, order, false);
  const origin = M.anchorPoint(chain);
  const end = M.endpointForKey(chain, HQuestion, "CHAIN_END");
  const freeStart = M.commitResultant(chain, "FREE", end, HQuestion, {
    allowIncomplete: true, allowAnyOrigin: true, originPoint: origin, pointerType: "mouse", threshold: 14
  });
  assert.equal(freeStart.resultant.originKey, "ORIGIN", `free H1/H2 resultant start snaps to ORIGIN for order ${order.join(",")}`);
  assert.deepEqual(freeStart.resultant.end, { mode: "snap", targetKey: "CHAIN_END" }, `free H1/H2 resultant end uses semantic CHAIN_END for order ${order.join(",")}`);
  assert.equal(M.canonicalResultant(freeStart, HQuestion), true, `free H1/H2 resultant is complete for order ${order.join(",")}`);
}
const tripleEndpointSnapCases = [];
for (let moving = 0; moving < TQuestion.forces.length; moving += 1) {
  for (let target = 0; target < TQuestion.forces.length; target += 1) {
    if (moving !== target) tripleEndpointSnapCases.push({ moving, target });
  }
}
for (const { moving, target } of tripleEndpointSnapCases) {
  const answer = M.freshAnswer(TQuestion);
  const beforeGeometry = M.forceGeometry(answer, TQuestion);
  const force = TQuestion.forces[moving];
  const targetTail = beforeGeometry[target].tail;
  const candidateTail = { x: targetTail.x - force.dx, y: targetTail.y - force.dy };
  const preview = M.previewSnappedForceTranslation(answer, moving, candidateTail, TQuestion, { pointerType: "mouse", threshold: 14 });
  assert.equal(preview.placements[moving].targetKey, "ORIGIN", `T1 moving F${moving + 1} head snaps to F${target + 1} tail during preview`);
  assert.equal(preview.placements[target].targetKey, M.headKey(moving), `T1 F${target + 1} becomes the moving force's child during preview`);
  assert.deepEqual(M.chainInfo(preview, TQuestion).order, [moving, target], `T1 head-to-tail preview creates a single path ${moving}->${target}`);
  const committed = M.commitForceTranslation(answer, moving, candidateTail, TQuestion, { pointerType: "mouse", threshold: 14 });
  assert.deepEqual(M.chainInfo(committed, TQuestion).order, [moving, target], `T1 head-to-tail release keeps path ${moving}->${target}`);
  const afterGeometry = M.forceGeometry(committed, TQuestion);
  assert.ok(M.distance(afterGeometry[target].tail, targetTail) <= 0.1, `T1 head-to-tail snap keeps stationary F${target + 1} fixed`);
}
const establishedTriple = chainAnswer(TQuestion, [0, 1], false);
const establishedTripleGeometry = M.forceGeometry(establishedTriple, TQuestion);
const prependForce = TQuestion.forces[2];
const prependTail = establishedTripleGeometry[0].tail;
const prependedTriple = M.commitForceTranslation(establishedTriple, 2, {
  x: prependTail.x - prependForce.dx,
  y: prependTail.y - prependForce.dy
}, TQuestion, { pointerType: "mouse", threshold: 14 });
assert.deepEqual(M.chainInfo(prependedTriple, TQuestion).order, [2, 0, 1], "T1 head-to-tail snap can prepend a force at the current chain root without a branch");
const prependedGeometry = M.forceGeometry(prependedTriple, TQuestion);
assert.ok(M.distance(prependedGeometry[0].tail, establishedTripleGeometry[0].tail) <= 0.1, "T1 prepend keeps the existing chain root tail fixed");
assert.ok(M.distance(prependedGeometry[1].tail, establishedTripleGeometry[1].tail) <= 0.1, "T1 prepend keeps the existing chain descendant fixed");
for (const [question, order] of [[HQuestion, [0, 1]], [TQuestion, [2, 0, 1]]]) {
  const chain = chainAnswer(question, order, false);
  const nearCorrectChainResultant = M.previewResultant(chain, "FREE", { x: 520, y: 300 }, question, {
    allowIncomplete: true, allowAnyOrigin: true, originPoint: { x: M.anchorPoint(chain).x - 7, y: M.anchorPoint(chain).y + 9 }, snap: true, pointerType: "mouse"
  });
  assert.equal(nearCorrectChainResultant.resultant.originKey, "ORIGIN", `${question.type} resultant start snaps to the chain root`);
  assert.equal(Object.hasOwn(nearCorrectChainResultant.resultant, "originPoint10"), false, `${question.type} snapped start removes the free origin`);
}
assert.equal(M.removeResultant(P).resultant, null, "deleting a resultant clears only the resultant");
assert.deepEqual(M.removeResultant(P).guides, P.guides, "deleting a resultant preserves completed construction work");

const resultantEndpoints = [];
for (const order of G.permutations([0, 1, 2])) {
  const answer = chainAnswer(TQuestion, order);
  const chain = M.chainInfo(answer, TQuestion);
  assert.equal(chain.valid, true);
  assert.equal(chain.complete, true);
  assert.deepEqual(chain.order, order);
  assert.equal(M.canonicalResultant(answer, TQuestion), true);
  resultantEndpoints.push(M.endpointForKey(answer, TQuestion, "CHAIN_END"));
}
for (let rootIndex = 0; rootIndex < TQuestion.forces.length; rootIndex += 1) {
  const bounds = M.chainAnchorBounds(TQuestion, rootIndex);
  for (const order of G.permutations([0, 1, 2]).filter((candidate) => candidate[0] === rootIndex)) {
    const bounded = chainAnswer(TQuestion, order, true);
    bounded.anchor10 = M.point10({ x: bounds.minX, y: bounds.minY });
    const geometry = M.forceGeometry(bounded, TQuestion);
    assert.ok(geometry.every((item) => M.anchorWithinBounds(item.tail, TQuestion, rootIndex) || item.tail.x >= M.MODEL_VISUAL_INSET - M.MODEL_EPSILON), `root ${rootIndex} remains valid at the computed feasible boundary`);
    assert.ok(geometry.every((item) => item.tail.x >= M.MODEL_VISUAL_INSET - M.MODEL_EPSILON && item.head.x <= G.WIDTH - M.MODEL_VISUAL_INSET + M.MODEL_EPSILON && item.tail.y >= M.MODEL_VISUAL_INSET - M.MODEL_EPSILON && item.head.y <= G.HEIGHT - M.MODEL_VISUAL_INSET + M.MODEL_EPSILON), `root ${rootIndex} order ${order.join(",")} stays inside visual bounds`);
  }
}
assert.ok(resultantEndpoints.every((point) => M.distance(point, resultantEndpoints[0]) <= M.MODEL_EPSILON), "all six orders have the same resultant endpoint");

const chain = chainAnswer(TQuestion, [0, 1, 2], false);
const beforeTails = M.resolveTails(chain, TQuestion);
const detached = M.previewForceTranslation(chain, 0, { x: 200, y: 150 }, TQuestion);
assert.equal(detached.placements[1].mode, "free");
assert.equal(detached.placements[2].mode, "free");
assert.deepEqual(M.fromPoint10(detached.placements[1].tail10), { x: Math.round(beforeTails[1].x * 10) / 10, y: Math.round(beforeTails[1].y * 10) / 10 }, "moving an upstream force releases descendants without moving their visible tails");

const branched = chainAnswer(TQuestion, [0, 1], false);
branched.placements[2] = { mode: "snap", targetKey: "F1_HEAD" };
assert.equal(M.chainInfo(branched, TQuestion).valid, false, "branches are rejected");
const cycle = M.freshAnswer(TQuestion);
cycle.placements[0] = { mode: "snap", targetKey: "F2_HEAD" };
cycle.placements[1] = { mode: "snap", targetKey: "F1_HEAD" };
assert.equal(M.chainInfo(cycle, TQuestion).valid, false, "cycles are rejected");

assert.deepEqual(M.clampLinePoint({ x: -100, y: 900 }), { x: 24, y: 476 });
const clampedTail = M.clampForceTail({ x: -500, y: 900 }, firstQuestion.forces[0]);
const clampedHead = M.add(clampedTail, firstQuestion.forces[0]);
assert.ok(clampedTail.x >= 34 && clampedTail.y >= 34 && clampedHead.x <= 726 && clampedHead.y <= 466, "whole force stays inside hard visual bounds");

console.log("force-composition model tests passed");
