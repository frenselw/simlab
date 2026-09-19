"use strict";

const assert = require("node:assert/strict");
const M = require("./model.js");

const axisDirections = [
  { key: "D1", unit: { x: 1, y: 0 }, axis: "horizontal", angle: 0 },
  { key: "D2", unit: { x: 0, y: 1 }, axis: "vertical", angle: Math.PI / 2 }
];

function pointOnAngle(angle, distance = 100) {
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

const insideAxisAngle = M.radians(9.9);
const outsideAxisAngle = M.radians(10.1);
const insideHorizontal = M.commitDirection(pointOnAngle(insideAxisAngle), [], { minDistance: 12 });
assert.equal(insideHorizontal.accepted, true, "9.9° direction snaps into the horizontal axis");
assert.equal(insideHorizontal.direction.axis, "horizontal");
assert.deepEqual(insideHorizontal.direction.unit, { x: 1, y: 0 });

const reverseHorizontal = M.commitDirection(pointOnAngle(Math.PI + insideAxisAngle), insideHorizontal.directions, { minDistance: 12 });
assert.equal(reverseHorizontal.accepted, false, "direction duplicates compare modulo 180°");
assert.equal(reverseHorizontal.reason, "duplicate");

const outsideHorizontal = M.directionFromPointer(pointOnAngle(outsideAxisAngle), { minDistance: 12 });
assert.equal(outsideHorizontal.axis, null, "10.1° direction remains a learner-drawn free line");
assert.equal(M.directionFromPointer({ x: 4, y: 5 }, { minDistance: 12 }).valid, false, "a short direction gesture does not create a line");

const horizontalFoot = M.projectionFoot(M.FORCE_HEAD, axisDirections[0]);
const verticalFoot = M.projectionFoot(M.FORCE_HEAD, axisDirections[1]);
assert.deepEqual(horizontalFoot, { x: 240, y: 0 });
assert.deepEqual(verticalFoot, { x: 0, y: 160 });

const shortPerpendicularPoint = { x: 240, y: 80 };
const shortPerpendicular = M.perpendicularPreview(shortPerpendicularPoint, axisDirections, { threshold: 20, pointerType: "touch" });
assert.equal(shortPerpendicular.targetKey, null, "a short perpendicular keeps its actual endpoint instead of being completed");
assert.deepEqual(shortPerpendicular.point, shortPerpendicularPoint);

const insideFoot = M.perpendicularPreview({ x: 240, y: 19.9 }, axisDirections, { threshold: 20, pointerType: "touch" });
assert.equal(insideFoot.targetKey, "D1", "19.9 CSS-px-equivalent foot distance snaps");
assert.deepEqual(insideFoot.point, horizontalFoot, "foot snapping uses the exact projection endpoint");

const outsideFoot = M.perpendicularPreview({ x: 240, y: 20.1 }, axisDirections, { threshold: 20, pointerType: "touch" });
assert.equal(outsideFoot.targetKey, null, "20.1 CSS-px-equivalent foot distance does not snap");
assert.ok(Math.abs(outsideFoot.point.x - 240) < 1e-9 && Math.abs(outsideFoot.point.y - 20.1) < 1e-9, "a near-miss preserves the learner's actual endpoint");

const stickyFoot = M.perpendicularPreview({ x: 240, y: 24 }, axisDirections, {
  threshold: 20,
  previousTargetKey: "D1",
  pointerType: "touch"
});
assert.equal(stickyFoot.targetKey, "D1", "an existing snap remains sticky through the 1.3x exit radius");
const releasedFoot = M.perpendicularPreview({ x: 240, y: 27 }, axisDirections, {
  threshold: 20,
  previousTargetKey: "D1",
  pointerType: "touch"
});
assert.equal(releasedFoot.targetKey, null, "a snap releases after the 1.3x exit radius");
const stickyCommittedPerpendicular = M.commitPerpendicular({ x: 240, y: 24 }, axisDirections, [], {
  threshold: 20,
  minDistance: M.MIN_DRAW_DISTANCE,
  previousTargetKey: "D1",
  pointerType: "touch"
});
assert.equal(stickyCommittedPerpendicular.accepted, true, "perpendicular commit preserves a preview snap in the sticky release band");
assert.equal(stickyCommittedPerpendicular.item.targetKey, "D1");
assert.deepEqual(stickyCommittedPerpendicular.item.end, horizontalFoot);

const exactPerpendiculars = [
  { key: "P1", end: horizontalFoot, targetKey: "D1" },
  { key: "P2", end: verticalFoot, targetKey: "D2" }
];
assert.deepEqual(M.visibleIntersections([], axisDirections), [], "hidden perpendiculars do not create component snap targets");
const visible = M.visibleIntersections(exactPerpendiculars, axisDirections);
assert.equal(visible.length, 2, "each student-drawn perpendicular exposes its visible endpoint intersection");
assert.deepEqual(visible.map((item) => item.point), [horizontalFoot, verticalFoot]);

const freeShort = [{ key: "P1", end: { x: 240, y: 80 }, targetKey: null }];
assert.equal(M.visibleIntersections(freeShort, axisDirections).length, 0, "a short segment that stops before a direction line has no hidden endpoint target");
const freeCrossing = [{ key: "P1", end: { x: 100, y: -40 }, targetKey: null }];
assert.equal(M.visibleIntersections(freeCrossing, axisDirections).length, 1, "an imperfect but visible crossing remains available for snapping");

const componentInside = M.previewComponent({ x: 240, y: 19.9 }, exactPerpendiculars, axisDirections, { threshold: 20, pointerType: "touch" });
assert.equal(componentInside.targetKey, "P1:D1", "component endpoint snaps to a visible intersection");
assert.deepEqual(componentInside.point, horizontalFoot);
const componentOutside = M.previewComponent({ x: 240, y: 20.1 }, exactPerpendiculars, axisDirections, { threshold: 20, pointerType: "touch" });
assert.equal(componentOutside.targetKey, null, "component endpoint respects the outside snap boundary");
assert.deepEqual(componentOutside.point, { x: 240, y: 20.1 });
const secondComponent = M.commitComponent(verticalFoot, exactPerpendiculars, axisDirections, [{ key: "F1", end: horizontalFoot, targetKey: "P1:D1" }], { threshold: 20 });
assert.equal(secondComponent.item.targetKey, "P2:D2");

const adjacentTargetPerpendiculars = [
  { key: "P1", end: { x: 240, y: 0 }, targetKey: "D1" },
  { key: "P2", end: { x: 250, y: 0 }, targetKey: "D1" }
];
const adjacentFirst = M.previewComponent({ x: 242, y: 2 }, adjacentTargetPerpendiculars, axisDirections, { threshold: 20, pointerType: "touch" });
assert.equal(adjacentFirst.targetKey, "P1:D1", "the nearest of adjacent visible targets wins initially");
const adjacentSticky = M.previewComponent({ x: 249, y: 2 }, adjacentTargetPerpendiculars, axisDirections, {
  threshold: 20,
  previousTargetKey: adjacentFirst.targetKey,
  pointerType: "touch"
});
assert.equal(adjacentSticky.targetKey, "P1:D1", "an adjacent target does not steal a sticky snap inside the exit radius");
const adjacentReleased = M.previewComponent({ x: 268, y: 2 }, adjacentTargetPerpendiculars, axisDirections, {
  threshold: 20,
  previousTargetKey: adjacentFirst.targetKey,
  pointerType: "touch"
});
assert.equal(adjacentReleased.targetKey, "P2:D1", "the sticky target releases and the adjacent target can then win");
const stickyCommittedComponent = M.commitComponent({ x: 249, y: 2 }, adjacentTargetPerpendiculars, axisDirections, [], {
  threshold: 20,
  minDistance: M.MIN_DRAW_DISTANCE,
  previousTargetKey: "P1:D1",
  pointerType: "touch"
});
assert.equal(stickyCommittedComponent.accepted, true, "component commit preserves a preview snap in the sticky release band");
assert.equal(stickyCommittedComponent.item.targetKey, "P1:D1");
assert.deepEqual(stickyCommittedComponent.item.end, { x: 240, y: 0 });
assert.equal(M.previewComponent({ x: 6, y: 0 }, exactPerpendiculars, axisDirections, { minDistance: M.MIN_DRAW_DISTANCE }).valid, false, "component preview rejects a too-short gesture from O");
assert.equal(M.commitComponent({ x: 6, y: 0 }, exactPerpendiculars, axisDirections, [], { minDistance: M.MIN_DRAW_DISTANCE }).accepted, false, "component commit cannot consume a slot for a too-short gesture");

const theta = M.thetaCandidates(axisDirections);
assert.equal(theta.length, 4, "both O and P expose their two acute theta candidates");
for (const candidate of theta) assert.equal(M.thetaCandidateAt(candidate.center, axisDirections).key, candidate.key, "every vertex resolves its own local angle");
assert.ok(Math.abs(M.distance(theta[0].labelCenter, theta[0].center) - 12) < 1e-8, "theta label stays close to its arc");
assert.equal(M.THETA_SNAP_RADIUS, 24, "theta uses its independent 24 CSS-px snap radius");
assert.equal(M.thetaCandidateAt(theta[0].center, axisDirections).key, "theta-horizontal");
assert.equal(M.thetaCandidateAt(theta[1].center, axisDirections).key, "theta-vertical");
const thetaInside = M.scale(M.fromAngle(theta[0].midAngle), theta[0].radius + 23.9);
const thetaOutside = M.scale(M.fromAngle(theta[0].midAngle), theta[0].radius + 24.1);
assert.equal(M.thetaCandidateAt(thetaInside, axisDirections).key, "theta-horizontal", "theta accepts points inside its dedicated radius");
assert.equal(M.thetaCandidateAt(thetaOutside, axisDirections), null, "theta rejects points outside its dedicated radius");
const thetaSticky = M.scale(M.fromAngle(theta[0].midAngle), theta[0].radius + 29);
const thetaReleased = M.scale(M.fromAngle(theta[0].midAngle), theta[0].radius + 33);
assert.equal(M.thetaCandidateAt(thetaSticky, axisDirections, { previousTargetKey: "theta-horizontal" }), null, "theta releases as soon as it leaves the normal snap radius");
assert.equal(M.thetaCandidateAt(thetaReleased, axisDirections, { previousTargetKey: "theta-horizontal" }), null, "theta stays free outside its snap radius");
assert.equal(M.thetaCandidateAt({ x: 0, y: 0 }, axisDirections, { threshold: 12 }), null, "the origin is not an angle candidate merely because it is near both rays");
assert.equal(M.thetaCandidates([insideHorizontal.direction, { key: "D2", unit: { x: .9, y: .4 }, axis: null }]).length, 0, "theta candidates require both snapped axes");
const imperfectDirections = [
  { key: "D1", unit: { x: .6, y: .8 }, axis: null },
  { key: "D2", unit: { x: .8, y: -.6 }, axis: null }
];
assert.equal(M.thetaCandidatesForInteraction(imperfectDirections, { scene: "horizontal-vertical" }).length, 0, "imperfect theta candidates stay opt-in");
const imperfectTheta = M.thetaCandidatesForInteraction(imperfectDirections, { scene: "horizontal-vertical", allowImperfect: true });
assert.equal(imperfectTheta.length, 4, "two imperfect direction lines still expose O/P theta choices for interaction");
assert.ok(imperfectTheta.every(candidate => candidate.learnerDefined && candidate.key.startsWith("learner-theta-")), "fallback theta choices are marked as learner-defined interaction candidates");
assert.equal(M.thetaCandidateAt(imperfectTheta[0].labelCenter, imperfectDirections, {
  scene: "horizontal-vertical",
  allowImperfect: true,
  threshold: M.THETA_SNAP_RADIUS
}).key, imperfectTheta[0].key, "a learner can snap theta onto an imperfect angle");
assert.equal(new Set(imperfectTheta.map(candidate => candidate.radius)).size, 1, "imperfect theta arcs use one consistent radius");
const imperfectPerpendiculars = [
  { key: "P1", end: { x: 180, y: 100 }, targetKey: null },
  { key: "P2", end: { x: 300, y: 40 }, targetKey: null }
];
const guidedImperfectTheta = M.thetaCandidatesForInteraction(imperfectDirections, {
  scene: "horizontal-vertical",
  allowImperfect: true,
  perpendiculars: imperfectPerpendiculars
});
const guidedHead = guidedImperfectTheta.find(candidate => candidate.key === "learner-theta-head-0");
const expectedGuideAngle = Math.atan2(imperfectPerpendiculars[0].end.y - M.FORCE_HEAD.y, imperfectPerpendiculars[0].end.x - M.FORCE_HEAD.x);
assert.ok(Math.min(M.angleDifference(guidedHead.startAngle, expectedGuideAngle), M.angleDifference(guidedHead.endAngle, expectedGuideAngle)) < 1e-8, "P theta follows the actual perpendicular guide");

const completeState = {
  phase: "angle",
  directions: axisDirections,
  perpendiculars: exactPerpendiculars,
  components: [
    { key: "F1", end: horizontalFoot, targetKey: "P1:D1" },
    { key: "F2", end: verticalFoot, targetKey: "P2:D2" }
  ],
  theta: null
};
assert.equal(M.isCorrectDecomposition(completeState), true, "the full fixed horizontal/vertical construction is recognised");
const extendedState = { ...completeState, perpendiculars: [
  { key: "P1", end: { x: 240, y: -34 }, targetKey: null },
  { key: "P2", end: { x: -34, y: 160 }, targetKey: null }
] };
assert.equal(M.isCorrectDecomposition(extendedState), true, "perpendicular guides extending past both feet still unlock theta");
assert.equal(M.perpendicularDirection(extendedState.perpendiculars[0], axisDirections).key, "D1", "extended guide gets its right-angle marker from geometry");
assert.equal(M.isCorrectDecomposition({ ...extendedState, perpendiculars: [{ key: "P1", end: { x: 280, y: -34 }, targetKey: null }, extendedState.perpendiculars[1]] }), false, "crossing an axis obliquely does not count as a perpendicular");
assert.equal(M.isCorrectDecomposition({ ...extendedState, components: [{ ...completeState.components[0], end: { x: 230, y: 0 } }, completeState.components[1]] }), false, "a stale target key cannot hide a misplaced component tip");
assert.equal(M.isCorrectDecomposition({ ...completeState, components: [{ ...completeState.components[0], targetKey: null }, completeState.components[1]] }), false, "a free component endpoint does not unlock theta");
assert.equal(M.isCorrectDecomposition({ ...completeState, perpendiculars: [{ ...exactPerpendiculars[0], end: { x: 240, y: 40 } }, exactPerpendiculars[1]] }), false, "an imperfect perpendicular remains visible but is not treated as a correct decomposition");

const segment = M.lineSegmentForDirection(axisDirections[0], { left: -120, right: 440, bottom: -80, top: 280 });
assert.deepEqual(segment, [{ x: -120, y: 0 }, { x: 440, y: 0 }], "direction lines are extended through O and clipped only at the stage boundary");
const arrowPath = M.arrowPathData(M.ORIGIN, M.FORCE_HEAD);
assert.match(arrowPath, /240\.000,160\.000/, "the arrow tip path ends at the model endpoint exactly");

let working = M.createState();
working = { ...working, directions: axisDirections, perpendiculars: exactPerpendiculars, components: completeState.components, theta: "theta-horizontal", phase: "components" };
const resetComponents = M.resetCurrentPhase(working);
assert.equal(resetComponents.phase, "components");
assert.equal(resetComponents.components.length, 0);
assert.equal(resetComponents.theta, null);
assert.equal(resetComponents.perpendiculars.length, 2);
const backToDirections = M.backToPrevious({ ...working, phase: "perpendiculars" });
assert.equal(backToDirections.phase, "directions");
assert.equal(backToDirections.directions.length, 2);
assert.equal(backToDirections.perpendiculars.length, working.perpendiculars.length);
assert.equal(backToDirections.components.length, working.components.length);
assert.equal(backToDirections.theta, working.theta);
assert.deepEqual(M.resetCurrentPhase(backToDirections), M.createState(), "redrawing directions still clears dependent geometry");
assert.equal(M.advance({ ...M.createState(), directions: axisDirections }).phase, "perpendiculars");
assert.equal(M.canAdvance({ ...M.createState(), directions: axisDirections }), true);


const editable = { ...M.clone(completeState), theta: "theta-head-vertical" };
const editedArrow = M.editGeometry(editable, "component", 0, { x: 150, y: 60 });
assert.equal(editedArrow.valid, true);
assert.equal(editedArrow.editedState.components.length, 2, "editing replaces rather than adds an arrow");
assert.deepEqual(editedArrow.editedState.components[1], editable.components[1], "editing F1 preserves F2");
assert.equal(editedArrow.editedState.components[0].key, "F1");
assert.equal(editedArrow.editedState.theta, null, "an invalidated angle is cleared");
const oneComponent = {
  ...M.clone(completeState),
  phase: "components",
  components: [M.clone(completeState.components[0])],
  theta: null,
  thetaPoint: null
};
const editedFirstComponent = M.editGeometry(oneComponent, "component", 0, { x: 150, y: 60 });
assert.equal(editedFirstComponent.valid, true, "F1 can be edited before F2 exists");
assert.equal(editedFirstComponent.editedState.components.length, 1, "editing the first component does not create F2");
const repairedArrow = M.editGeometry(editedArrow.editedState, "component", 0, horizontalFoot);
assert.equal(M.isCorrectDecomposition(repairedArrow.editedState), true, "an existing wrong arrow can be snapped back into place");
const editedGuide = M.editGeometry(editable, "perpendicular", 0, { x: 240, y: -40 });
assert.equal(editedGuide.editedState.perpendiculars.length, 2);
assert.deepEqual(editedGuide.editedState.components, editable.components, "extending a guide preserves component geometry and links");
assert.equal(editedGuide.editedState.theta, editable.theta, "equivalent construction preserves theta");
const editedDirection = M.editGeometry(editable, "direction", 0, { x: 100, y: 60 });
assert.equal(editedDirection.editedState.directions.length, 2);
assert.deepEqual(editedDirection.editedState.perpendiculars.map(line => line.end), editable.perpendiculars.map(line => line.end), "rotating an axis does not erase guides");
assert.deepEqual(editedDirection.editedState.components.map(line => line.end), editable.components.map(line => line.end), "rotating an axis does not erase arrows");
assert.equal(editedDirection.editedState.components[0].targetKey, null, "stale intersection links are removed");
assert.equal(M.editGeometry(editable, "direction", 0, { x: 0, y: 100 }).valid, false, "cannot rotate one axis onto the other");
assert.equal(M.editGeometry(editable, "component", 0, { x: 0, y: 0 }).valid, false, "too-short edit is rejected");
assert.deepEqual(editable.components, completeState.components, "preview edits do not mutate committed state");

const bounds = { left: -90, right: 410, bottom: -50, top: 230 };
for (const end of [{ x: -900, y: 80 }, { x: 900, y: 80 }, { x: 120, y: -900 }, { x: 120, y: 900 }]) {
  for (const start of [M.ORIGIN, M.FORCE_HEAD]) {
    const clipped = M.boundedEndpoint(start, end, bounds);
    assert(clipped.x >= bounds.left && clipped.x <= bounds.right && clipped.y >= bounds.bottom && clipped.y <= bounds.top, "endpoint stays in the editable rectangle");
    const a = M.subtract(end, start), b = M.subtract(clipped, start);
    assert(Math.abs(a.x * b.y - a.y * b.x) < 1e-7, "clipping preserves the drawn direction");
  }
  const guide = M.editGeometry(editable, "perpendicular", 0, end, { bounds });
  const arrow = M.editGeometry(editable, "component", 0, end, { bounds });
  for (const result of [guide, arrow]) {
    assert(result.valid);
    assert(result.point.x >= bounds.left && result.point.x <= bounds.right && result.point.y >= bounds.bottom && result.point.y <= bounds.top, "editing and snapping keep endpoints reachable");
  }
}
assert.deepEqual(M.boundedEndpoint(M.ORIGIN, horizontalFoot), horizontalFoot, "headless callers can omit bounds");
for (const angle of ["theta-horizontal", "theta-vertical", "theta-head-horizontal", "theta-head-vertical"]) {
  for (const reversed of [false, true]) {
    const base = { ...M.clone(completeState), theta: angle, formulas: { F1: null, F2: null } };
    if (reversed) base.components = base.components.reverse().map((item, index) => ({ ...item, key: `F${index + 1}` }));
    assert.equal(M.canAdvance(base), true, "valid angle unlocks formulas");
    let writing = M.advance(base);
    assert.equal(writing.phase, "formulas");
    assert.equal(M.checkFormulas(writing).status, "incomplete");
    const horizontalFunction = angle.endsWith("horizontal") ? "cos" : "sin";
    for (const component of writing.components) {
      const expected = component.end.y === 0 ? horizontalFunction : horizontalFunction === "sin" ? "cos" : "sin";
      writing = M.setFormula(writing, component.key, expected);
    }
    assert.equal(M.checkFormulas(writing).status, "correct", "four angle semantics work for both drawing orders");
    const wrong = M.setFormula(writing, "F1", writing.formulas.F1 === "sin" ? "cos" : "sin");
    assert.equal(M.checkFormulas(wrong).status, "incorrect", "same function in both slots is accepted as input but marked wrong");
    assert.deepEqual(M.backToPrevious(writing).formulas, writing.formulas);
    assert.deepEqual(M.resetCurrentPhase(writing).formulas, { F1: null, F2: null });
    assert.deepEqual(M.resetCurrentPhase(writing).components, writing.components, "clearing formulas preserves drawing");
    const changedAngle = { ...writing, theta: angle.endsWith("horizontal") ? "theta-vertical" : "theta-horizontal" };
    assert.equal(M.checkFormulas(changedAngle).status, "incorrect", "changing theta preserves answers and changes their correctness");
    const broken = M.editGeometry(writing, "component", 0, { x: 100, y: 70 }).editedState;
    assert.deepEqual(broken.formulas, writing.formulas, "geometry edits preserve attempted expressions");
    assert.equal(M.checkFormulas(broken).status, "unavailable", "invalid geometry cannot receive successful feedback");
    assert.deepEqual(M.setFormula(writing, "F1", "tan"), writing, "unsupported formula cannot be entered");
  }
}
assert.equal(M.canAdvance(completeState), false, "missing theta blocks formula phase");
assert.equal(M.formulaExpectations({ ...completeState, theta: "unknown" }), null);

for (const scenarioId of ["inclined-external-force", "inclined-gravity"]) {
  const scene = M.getScenario(scenarioId);
  const bounds = { left: -180, right: 440, bottom: -100, top: 280 };
  const first = M.commitDirection(M.add(scene.origin, M.scale(scene.axes[0].unit, 180)), [], { scene });
  const second = M.commitDirection(M.add(scene.origin, M.scale(scene.axes[1].unit, 180)), first.directions, { scene });
  assert.equal(first.accepted && second.accepted, true, `${scenarioId} accepts both scene axes`);
  let perpendiculars = [];
  for (const direction of second.directions) {
    perpendiculars = M.commitPerpendicular(M.projectionFoot(scene.forceHead, direction, scene), second.directions, perpendiculars, { scene, bounds, minDistance: 4 }).perpendiculars;
  }
  const intersections = M.visibleIntersections(perpendiculars, second.directions, scene);
  let components = [];
  for (const intersection of intersections) {
    components = M.commitComponent(intersection.point, perpendiculars, second.directions, components, { scene, bounds, minDistance: 4 }).components;
  }
  const complete = { ...M.createQuestionState(scenarioId), phase: "formulas", directions: second.directions, perpendiculars, components, theta: M.thetaCandidates(second.directions, scene)[0].key };
  assert.equal(M.isCorrectDecomposition(complete), true, `${scenarioId} recognises its orthogonal construction`);
  const reversed = { ...M.clone(complete), components: complete.components.slice().reverse().map((entry, index) => ({ ...entry, key: `F${index + 1}` })) };
  const expectations = M.formulaExpectations(reversed);
  assert.equal(expectations.some(entry => entry.value === "sin") && expectations.some(entry => entry.value === "cos"), true, `${scenarioId} gives complementary expressions in either creation order`);
  if (scenarioId === "inclined-gravity") {
    assert.equal(scene.forceSymbol, "G");
    assert.equal(M.componentSymbol(scene, "parallel"), "Gₓ");
    assert.equal(M.componentSymbol(scene, "normal"), "Gᵧ");
    const candidate = M.thetaCandidates(second.directions, scene)[0];
    assert.equal(candidate.key, "theta-incline");
    assert.ok(Math.abs(M.distance(candidate.labelCenter, candidate.center) - 12) < 1e-8, "gravity theta label stays close to its arc");
    assert.ok(Math.abs(candidate.decompositionAngle - scene.plane.angle) < 1e-8, "given theta equals the internal gravity-normal acute angle");
    assert.ok(Math.abs(candidate.startAngle - Math.atan2(scene.forceHead.y - scene.origin.y, scene.forceHead.x - scene.origin.x)) < 1e-8, "given theta starts on downward G");
    assert.notEqual(Math.round(candidate.startAngle * 180 / Math.PI), 0, "given theta is not the already-given slope-versus-horizontal sector");
    assert.deepEqual(expectations.map(entry => entry.value).sort(), ["cos", "sin"], "gravity keeps G parallel = G sin theta and normal = G cos theta");
  }
}
console.log("force orthogonal decomposition model tests passed");
