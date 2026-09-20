"use strict";

const assert = require("node:assert/strict");
const M = require("./model.js");
const Scoring = require("./scoring.js");
const P = require("./persistence.js");

const bounds = P.WORLD_BOUNDS;

function completeQuestion(scenarioId) {
  const scene = M.getScenario(scenarioId);
  let directions = [];
  for (const axis of scene.axes) {
    const result = M.commitDirection(M.add(scene.origin, M.scale(axis.unit, 180)), directions, { scene });
    assert.equal(result.accepted, true, `${scenarioId} direction is constructible`);
    directions = result.directions;
  }
  let perpendiculars = [];
  for (const direction of directions) {
    const result = M.commitPerpendicular(M.projectionFoot(scene.forceHead, direction, scene), directions, perpendiculars, {
      scene, bounds, minDistance: 4
    });
    assert.equal(result.accepted, true, `${scenarioId} perpendicular is constructible`);
    perpendiculars = result.perpendiculars;
  }
  let components = [];
  for (const intersection of M.visibleIntersections(perpendiculars, directions, scene)) {
    const result = M.commitComponent(intersection.point, perpendiculars, directions, components, {
      scene, bounds, minDistance: 4
    });
    assert.equal(result.accepted, true, `${scenarioId} component is constructible`);
    components = result.components;
  }
  const theta = M.thetaCandidates(directions, scene)[0];
  assert.ok(theta, `${scenarioId} exposes a theta candidate`);
  let state = {
    ...M.createQuestionState(scenarioId),
    phase: "formulas",
    directions,
    perpendiculars,
    components,
    theta: theta.key
  };
  assert.equal(M.isCorrectDecomposition(state), true, `${scenarioId} complete construction is valid`);
  const expectations = M.formulaExpectations(state);
  state.formulas = Object.fromEntries(expectations.map(entry => [entry.key, entry.value]));
  return state;
}

function fullActivity() {
  const activity = P.freshDraft();
  activity.phase = "summary";
  activity.questions = P.SCENARIO_IDS.map(completeQuestion);
  return activity;
}

function roundTrip(activity, label) {
  const encoded = P.encodeDraft(activity);
  assert.ok(P.bytes(encoded) <= P.MAX_SNAPSHOT_BYTES, `${label} stays under the snapshot budget`);
  const decoded = P.decodeDraft(encoded);
  assert.deepEqual(decoded, encoded, `${label} decodes to its canonical value`);
  return decoded;
}

const fresh = P.freshDraft();
assert.equal(P.validate(fresh).ok, true, "fresh activity is valid");
assert.equal(P.legalNextAction(fresh), "draw-directions");
for (let index = 0; index < P.SCENARIO_IDS.length; index += 1) {
  const anyQuestion = P.freshDraft();
  anyQuestion.currentQuestion = index;
  roundTrip(anyQuestion, `fresh question ${index + 1}`);
}

const complete = fullActivity();
const canonicalComplete = P.decodeDraft(P.encodeDraft(complete));
assert.ok(canonicalComplete.questions[2].perpendiculars.some(line => line.end.x < 0 || line.end.y < 0), "gravity keeps negative geometry coordinates");
assert.ok(canonicalComplete.questions[2].components.some(component => component.end.x < 0 || component.end.y < 0), "gravity keeps negative component coordinates");

for (const [index, scenarioId] of P.SCENARIO_IDS.entries()) {
  const question = canonicalComplete.questions[index];
  const zeroPerpendicular = { ...question, phase: "perpendiculars", perpendiculars: [], components: [], theta: null, formulas: { F1: null, F2: null } };
  const activity = P.freshDraft();
  activity.currentQuestion = index;
  activity.questions[index] = zeroPerpendicular;
  roundTrip(activity, `${scenarioId} zero-perpendicular entry`);

  const zeroComponent = { ...question, phase: "components", components: [], theta: null, formulas: { F1: null, F2: null } };
  const zeroComponentActivity = P.freshDraft();
  zeroComponentActivity.currentQuestion = index;
  zeroComponentActivity.questions[index] = zeroComponent;
  roundTrip(zeroComponentActivity, `${scenarioId} zero-component entry`);
}

let walkedBack = canonicalComplete.questions[0];
for (const phase of ["angle", "components", "perpendiculars", "directions"]) {
  walkedBack = M.backToPrevious(walkedBack);
  assert.equal(walkedBack.phase, phase, `back navigation reaches ${phase}`);
  const activity = P.freshDraft();
  activity.questions[0] = walkedBack;
  roundTrip(activity, `retained downstream data while at ${phase}`);
  assert.equal(activity.questions[0].components.length, 2, `${phase} keeps component geometry`);
  assert.ok(activity.questions[0].formulas.F1 && activity.questions[0].formulas.F2, `${phase} keeps attempted formulas`);
}

// A horizontal/vertical mistake is still a valid learner attempt in an
// inclined question. Its explicit null axis must stay null during draft and
// review serialisation; it must not be reclassified against question 1's axes.
function wrongSlopedDirectionQuestion(scenarioId) {
  return {
    ...M.createQuestionState(scenarioId),
    phase: "directions",
    directions: [
      { key: "D1", unit: { x: 1, y: 0 }, axisKey: null },
      { key: "D2", unit: { x: 0, y: 1 }, axisKey: null }
    ]
  };
}

for (const [index, scenarioId] of P.SCENARIO_IDS.entries()) {
  if (index === 0) continue;
  const wrong = wrongSlopedDirectionQuestion(scenarioId);
  assert.equal(P.validateQuestion(wrong, index).ok, true, `${scenarioId} accepts an unsnapped horizontal/vertical mistake`);
  const wrongActivity = P.freshDraft();
  wrongActivity.currentQuestion = index;
  wrongActivity.questions[index] = wrong;
  const restored = roundTrip(wrongActivity, `${scenarioId} unsnapped direction draft`);
  assert.deepEqual(restored.questions[index].directions.map(direction => direction.axisKey), [null, null], `${scenarioId} preserves null direction axes`);
}

const mixedSlopedMistakes = P.clone(complete);
mixedSlopedMistakes.phase = "summary";
mixedSlopedMistakes.questions[1] = wrongSlopedDirectionQuestion(P.SCENARIO_IDS[1]);
mixedSlopedMistakes.questions[2] = wrongSlopedDirectionQuestion(P.SCENARIO_IDS[2]);
const mixedMistakeResult = Scoring.score(mixedSlopedMistakes);
assert.ok(mixedMistakeResult.score < 100, "sloped mistakes are scored instead of blocking final evaluation");
assert.doesNotThrow(() => P.makeSnapshot("review", mixedSlopedMistakes, mixedMistakeResult), "sloped mistakes can be submitted for scoring");

const wrongEdit = M.editGeometry(complete.questions[0], "component", 0, { x: 100, y: 70 }).editedState;
assert.equal(wrongEdit.theta, null, "a wrong direct edit invalidates theta");
const invalidAngle = { ...wrongEdit, phase: "angle" };
const invalidAngleActivity = P.freshDraft();
invalidAngleActivity.questions[0] = invalidAngle;
roundTrip(invalidAngleActivity, "invalid angle continuation after direct edit");

// The formula phase remains editable: after a component is dragged away, the
// learner can put θ back before repairing the geometry. This is a wrong answer
// for scoring, but it is an interface-reachable draft and must round-trip and
// reach final review instead of failing formula-stale-geometry validation.
const formulaGeometryEdit = M.editGeometry(complete.questions[0], "component", 0, { x: 100, y: 70 }).editedState;
const formulaThetaCandidate = M.thetaCandidatesForInteraction(formulaGeometryEdit.directions, {
  scene: "horizontal-vertical",
  allowImperfect: true,
  perpendiculars: formulaGeometryEdit.perpendiculars
})[0];
assert.ok(formulaThetaCandidate, "formula-step geometry edit still exposes a θ candidate");
const formulaGeometryEditWithTheta = { ...formulaGeometryEdit, theta: formulaThetaCandidate.key, thetaPoint: null };
const formulaGeometryActivity = P.freshDraft();
formulaGeometryActivity.questions[0] = formulaGeometryEditWithTheta;
const formulaGeometryEncoded = P.encodeDraft(formulaGeometryActivity);
assert.equal(P.validateQuestion(formulaGeometryEncoded.questions[0], 0).ok, true, "formula-step wrong geometry with a newly placed θ remains savable");
const formulaGeometryRoundTrip = roundTrip(formulaGeometryActivity, "formula-step edit then re-place theta");
assert.equal(formulaGeometryRoundTrip.questions[0].theta, formulaThetaCandidate.key, "re-placed θ survives the formula-step round trip");
const formulaGeometrySubmission = P.clone(complete);
formulaGeometrySubmission.phase = "summary";
formulaGeometrySubmission.questions[0] = formulaGeometryEditWithTheta;
const formulaGeometryResult = Scoring.score(formulaGeometrySubmission);
assert.doesNotThrow(() => P.makeSnapshot("review", formulaGeometrySubmission, formulaGeometryResult), "formula-step wrong geometry can reach final review and scoring");

// Correcting a direction changes the canonical candidate keys. An older
// learner-defined key must be cleared rather than leaving an unvalidatable
// stale θ attached to an otherwise repaired construction.
const directionGeometryEdit = M.editGeometry(complete.questions[0], "direction", 0, { x: 100, y: 40 }).editedState;
const oldDirectionTheta = M.thetaCandidatesForInteraction(directionGeometryEdit.directions, {
  scene: "horizontal-vertical",
  allowImperfect: true,
  perpendiculars: directionGeometryEdit.perpendiculars
})[0];
assert.ok(oldDirectionTheta, "direction edit exposes the old interaction θ before repair");
const repairedDirectionGeometry = M.editGeometry({ ...directionGeometryEdit, theta: oldDirectionTheta.key }, "direction", 0, { x: 120, y: 0 }).editedState;
assert.equal(repairedDirectionGeometry.theta, null, "repairing a direction clears a stale θ candidate");
const repairedDirectionActivity = P.freshDraft();
repairedDirectionActivity.questions[0] = repairedDirectionGeometry;
const repairedDirectionRoundTrip = roundTrip(repairedDirectionActivity, "direction repair after stale theta");
assert.equal(repairedDirectionRoundTrip.questions[0].theta, null, "repaired direction remains savable without stale θ");

// The narrow inclined-force edit path must use the same post-clipping length
// rule as a newly drawn perpendicular.  Its saved free endpoint must survive
// a production draft round trip instead of becoming a zero-length line.
const narrowScene = M.getScenario("inclined-external-force");
const narrowInset = 28 / .6;
const narrowBounds = {
  left: -180 + narrowInset,
  right: 440 - narrowInset,
  bottom: -135 + narrowInset,
  top: 225 - narrowInset
};
const narrowState = {
  ...M.createQuestionState(narrowScene.id),
  phase: "perpendiculars",
  directions: [
    { key: "D1", unit: { x: Math.cos(M.radians(95)), y: Math.sin(M.radians(95)) }, axisKey: null },
    { key: "D2", unit: { x: Math.cos(M.radians(28)), y: Math.sin(M.radians(28)) }, axisKey: null }
  ],
  perpendiculars: [{ key: "P1", end: { x: 270, y: 140 }, targetKey: null }]
};
const narrowEdit = M.editGeometry(narrowState, "perpendicular", 0, { x: 250, y: 177 }, {
  scene: narrowScene,
  bounds: narrowBounds,
  minDistance: M.MIN_DRAW_DISTANCE,
  threshold: 20
});
assert.equal(narrowEdit.valid, true, "narrow edit keeps a valid free perpendicular endpoint");
const narrowActivity = P.freshDraft();
narrowActivity.currentQuestion = 1;
narrowActivity.questions[1] = narrowEdit.editedState;
const narrowRoundTrip = roundTrip(narrowActivity, "narrow perpendicular edit");
assert.deepEqual(narrowRoundTrip.questions[1].perpendiculars[0].end, { x: 250, y: 177 }, "narrow perpendicular edit survives save and reload");
const narrowReview = P.clone(narrowActivity);
narrowReview.phase = "summary";
const narrowResult = Scoring.score(narrowReview);
assert.doesNotThrow(() => P.makeSnapshot("review", narrowReview, narrowResult), "narrow perpendicular edit can reach final submission");

const forceScene = M.getScenario("horizontal-vertical");
const forceUnit = M.normalize(M.subtract(forceScene.forceHead, forceScene.origin));
const forcePerpendicular = { x: -forceUnit.y, y: forceUnit.x };
const imperfectDirections = [
  { key: "D1", unit: forcePerpendicular, axisKey: null },
  { key: "D2", unit: { x: .8, y: -.6 }, axisKey: null }
];
const imperfectPerpendiculars = [
  { key: "P1", end: { x: 320, y: 160 }, targetKey: null },
  { key: "P2", end: { x: 120, y: 40 }, targetKey: null }
];
const imperfectCandidates = M.thetaCandidatesForInteraction(imperfectDirections, {
  scene: "horizontal-vertical",
  allowImperfect: true,
  perpendiculars: imperfectPerpendiculars
});
const imperfectTheta = imperfectCandidates.find(candidate => candidate.key === "learner-theta-head-0");
assert.ok(imperfectTheta, "the guided imperfect P angle remains an interaction candidate");
const imperfectAngle = {
  ...M.createQuestionState("horizontal-vertical"),
  phase: "angle",
  directions: imperfectDirections,
  perpendiculars: imperfectPerpendiculars,
  components: [
    { key: "F1", end: { x: 100, y: 70 }, targetKey: null },
    { key: "F2", end: { x: 90, y: -40 }, targetKey: null }
  ],
  theta: imperfectTheta.key
};
const imperfectAngleActivity = P.freshDraft();
imperfectAngleActivity.questions[0] = imperfectAngle;
const imperfectAngleRoundTrip = roundTrip(imperfectAngleActivity, "imperfect angle with saved theta");
assert.equal(imperfectAngleRoundTrip.questions[0].theta, imperfectTheta.key, "an interaction-only theta key survives draft restore");
assert.equal(P.validateQuestion(imperfectAngleRoundTrip.questions[0], 0).ok, true, "the same perpendicular guides validate the saved theta");
const freeThetaAngle = { ...imperfectAngle, theta: null, thetaPoint: { x: 150, y: -40 } };
const freeThetaActivity = P.freshDraft();
freeThetaActivity.questions[0] = freeThetaAngle;
const freeThetaRoundTrip = roundTrip(freeThetaActivity, "free theta position");
assert.deepEqual(freeThetaRoundTrip.questions[0].thetaPoint, freeThetaAngle.thetaPoint, "an unsnapped theta keeps its release position");

const invalidFormulas = { ...wrongEdit, phase: "formulas" };
const invalidFormulaActivity = P.freshDraft();
invalidFormulaActivity.questions[0] = invalidFormulas;
const invalidFormulaRoundTrip = roundTrip(invalidFormulaActivity, "invalid formulas continuation");
assert.equal(P.legalNextAction(invalidFormulaRoundTrip), "repair-geometry");

// A direct component edit can be repaired while the learner is still on the
// formula step. The correct geometry clears the old theta, but must not make
// the reachable state invalid or discard the attempted expressions.
const originalEndpoint = complete.questions[0].components[0].end;
const damaged = M.editGeometry(complete.questions[0], "component", 0, { x: 100, y: 70 }).editedState;
const repaired = M.editGeometry(damaged, "component", 0, originalEndpoint).editedState;
assert.equal(repaired.phase, "formulas");
assert.equal(repaired.theta, null);
assert.equal(M.isCorrectDecomposition(repaired), true);
const repairedActivity = P.freshDraft();
repairedActivity.questions[0] = repaired;
const repairedRoundTrip = roundTrip(repairedActivity, "repaired geometry awaiting re-angle");
assert.equal(P.legalNextAction(repairedRoundTrip), "place-theta", "legal continuation points back to theta after repair");
let reangle = M.backToPrevious(repaired);
reangle = { ...reangle, theta: M.thetaCandidates(reangle.directions)[0].key };
assert.equal(M.canAdvance(reangle), true, "the learner can place theta after repairing the geometry");
reangle = M.advance(reangle);
const reangleActivity = P.freshDraft();
reangleActivity.questions[0] = reangle;
roundTrip(reangleActivity, "repair then re-angle continuation");

const reviewEdit = P.freshDraft();
reviewEdit.phase = "practice";
reviewEdit.fromReview = true;
reviewEdit.currentQuestion = 1;
reviewEdit.questions[1] = canonicalComplete.questions[1];
roundTrip(reviewEdit, "review-edit continuation");

const result = Scoring.score(canonicalComplete);
assert.equal(result.score, 100, "complete activity scores 100");
assert.equal(Scoring.questionDetail(canonicalComplete.questions[0], 0).groups.find(group => group.key === "theta").items.length, 1, "theta is one 20-point condition");
assert.equal(Scoring.questionDetail(canonicalComplete.questions[0], 0).groups.find(group => group.key === "theta").items[0].points, 20);
const reviewSnapshot = P.makeSnapshot("review", canonicalComplete, result);
assert.ok(P.bytes(reviewSnapshot) <= P.MAX_SNAPSHOT_BYTES, "review snapshot stays under the SCORM budget");
const pending = P.pendingEnvelope(reviewSnapshot, result);
assert.ok(P.bytes(pending) <= P.MAX_SNAPSHOT_BYTES, "pending submission stays under the SCORM budget");
assert.deepEqual(P.decodePending(pending).state, P.decodeReview(reviewSnapshot.answer), "pending recovery restores the same review state");

// A perpendicular that passes through the foot remains correct if it extends
// beyond the foot; a segment that stops short does not. Check both creation
// orders across all scene geometries.
for (const [index, scenarioId] of P.SCENARIO_IDS.entries()) {
  const scene = M.getScenario(scenarioId);
  for (const reverse of [false, true]) {
    const base = P.clone(canonicalComplete.questions[index]);
    base.perpendiculars = reverse ? base.perpendiculars.slice().reverse() : base.perpendiculars;
    const line = base.perpendiculars[0];
    const direction = base.directions.find(entry => entry.key === line.targetKey);
    const vector = M.subtract(line.end, scene.forceHead);
    const past = P.clone(base);
    past.perpendiculars[0] = { ...line, end: M.add(scene.forceHead, M.scale(vector, 1.2)), targetKey: null };
    const short = P.clone(base);
    short.perpendiculars[0] = { ...line, end: M.add(scene.forceHead, M.scale(vector, .8)), targetKey: null };
    const pastGroup = Scoring.questionDetail(past, index).groups.find(group => group.key === "perpendiculars");
    const shortGroup = Scoring.questionDetail(short, index).groups.find(group => group.key === "perpendiculars");
    const axisKey = M.directionAxisKey(direction, scene);
    assert.equal(pastGroup.items.find(item => item.key === `perpendicular-${axisKey}`).correct, true, `${scenarioId} past-foot perpendicular scores in either order`);
    assert.equal(shortGroup.items.find(item => item.key === `perpendicular-${axisKey}`).correct, false, `${scenarioId} short perpendicular remains incorrect`);
  }
}

function expectInvalid(value, label) {
  assert.equal(P.validate(value).ok, false, `${label} is rejected`);
}

const malformed = P.freshDraft();
malformed.questions[0].phase = "directions";
malformed.questions[0].perpendiculars = [{ key: "P1", end: { x: 20, y: 20 }, targetKey: "D1" }];
expectInvalid(malformed, "downstream data before two directions");

const danglingTheta = P.clone(canonicalComplete);
danglingTheta.questions[0].theta = "not-a-candidate";
expectInvalid(danglingTheta, "unknown theta key");

const thetaWithFreePoint = P.clone(canonicalComplete);
thetaWithFreePoint.questions[0].thetaPoint = { x: 150, y: -40 };
expectInvalid(thetaWithFreePoint, "a snapped theta cannot also have a free point");

const danglingTarget = P.clone(canonicalComplete);
danglingTarget.questions[0].perpendiculars[0].targetKey = "D9";
expectInvalid(danglingTarget, "dangling perpendicular target");

const nonFinite = P.clone(canonicalComplete);
nonFinite.questions[0].components[0].end.x = NaN;
expectInvalid(nonFinite, "non-finite coordinate");

const fabricatedFormulas = P.freshDraft();
fabricatedFormulas.questions[0].phase = "formulas";
fabricatedFormulas.questions[0].formulas = { F1: "cos", F2: "sin" };
expectInvalid(fabricatedFormulas, "formula phase without geometry");

console.log("force orthogonal decomposition persistence and scoring tests passed");
