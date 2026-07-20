"use strict";

const assert = require("node:assert/strict");
const S = require("./scoring.js");
const G = require("./generator.js");

assert.equal(S.validateScenarioLibrary(), true, "all published scenario sets satisfy their contracts");
function libraryWith(mutate) {
  const library = structuredClone(S.SCENARIO_SETS);
  mutate(library);
  return library;
}
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { delete library.gamma; })), false, "scenario library requires at least three sets");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m1.v = 0; })), false, "mission 1 rejects zero and non-contract velocities");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m2.v = 0; })), false, "mission 2 reserves stationary motion for mission 4");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m2.x0 = 10; })), false, "mission setup positions stay inside the learner control range");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m3.B.x0 = library.alpha.m3.A.x0; })), false, "mission 3 requires different even starting positions");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.gamma.m3.B.v = 2; })), false, "mission 3 sets collectively cover A faster, B faster, and equal speed");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.beta.m3.A.v = 2; library.gamma.m3.B.v = 1; })), false, "mission 3 itself retains at least one negative velocity");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => {
  [library.alpha.m3.A.x0, library.alpha.m3.B.x0] = [library.alpha.m3.B.x0, library.alpha.m3.A.x0];
  [library.beta.m3.A.x0, library.beta.m3.B.x0] = [library.beta.m3.B.x0, library.beta.m3.A.x0];
})), false, "mission 3 sets retain a higher-but-slower misconception check");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m4.atPosition += 1; })), false, "mission 4 stated endpoint must agree with its motion");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m4.v = 1; library.alpha.m4.atPosition = 11; })), false, "scenario library collectively retains stationary motion");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => {
  library.alpha.m4.v = 1;
  library.alpha.m4.atPosition = 11;
  library.alpha.m5.exampleB = { x0: 2, v: 0 };
})), false, "zero velocity outside mission 4 cannot satisfy its stationary scenario contract");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m5.meetTime = 1; })), false, "mission 5 meeting time comes from the documented interior set");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m5.exampleB = { ...library.alpha.m5.A }; })), false, "mission 5 requires a non-coincident example solution");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.m5.exampleB = { x0: 6.5, v: -1.5 }; })), false, "mission 5 example start must be an integer reachable by the UI");
assert.equal(S.validateScenarioLibrary(libraryWith((library) => { library.alpha.extra = {}; })), false, "scenario sets contain exactly the five mission keys");
assert.equal(S.positionAt({ x0: 3, v: 2 }, 0), 3, "position at time zero is x0");
assert.equal(S.positionAt({ x0: 3, v: -2 }, 4), -5, "negative velocity updates position");
assert.equal(S.positionAt({ x0: 3, v: 0 }, 4), 3, "zero velocity keeps position fixed");
assert.equal(S.velocityFromPoints({ t: 1, x: 4 }, { t: 4, x: -2 }), -2, "probe slope keeps its sign");
assert.equal(S.velocityFromPoints({ t: 4, x: -2 }, { t: 1, x: 4 }), -2, "reversed probes keep the same slope");
assert.equal(S.velocityFromPoints({ t: 1, x: 4 }, { t: 1, x: 5 }), null, "equal probe times do not divide by zero");
assert.deepEqual(S.intersection({ x0: 0, v: 1 }, { x0: 6, v: -1 }), { kind: "point", time: 3, position: 3 });
assert.equal(S.intersection({ x0: 0, v: 1 }, { x0: 2, v: 1 }).kind, "parallel");
assert.equal(S.intersection({ x0: 0, v: 1 }, { x0: 0, v: 1 }).kind, "coincident");

for (const id of S.scenarioIds()) {
  const set = S.getScenarioSet(1, id);
  const answers = {
    m1: { x0: set.m1.x0, v: set.m1.v },
    m2: { xStart: set.m2.x0, xEnd: S.positionAt(set.m2, 6) },
    m3: { A: { probes: [0, 3], velocity: set.m3.A.v }, B: { probes: [5, 1], velocity: set.m3.B.v }, faster: Math.abs(set.m3.A.v) === Math.abs(set.m3.B.v) ? "same" : Math.abs(set.m3.A.v) > Math.abs(set.m3.B.v) ? "A" : "B" },
    m4: { x0: set.m4.x0, v: set.m4.v },
    m5: { x0B: set.m5.exampleB.x0, vB: set.m5.exampleB.v, meetingX: S.positionAt(set.m5.A, set.m5.meetTime) }
  };
  assert.deepEqual(S.scoreAssessment(answers, set).score, 100, `${id} has a reachable perfect score`);
}

const set = S.SCENARIO_SETS.alpha;
function scoreWith(key, answer) {
  const answers = S.blankAnswers();
  answers[key] = answer;
  return S.scoreAssessment(answers, set).detail[Number(key.slice(1)) - 1];
}
assert.equal(scoreWith("m1", { x0: -5.5, v: 1.9 }).score, 20, "inclusive position and velocity tolerance earns full credit");
assert.equal(scoreWith("m1", { x0: -5.4, v: 2 }).score, 12, "position just outside tolerance loses only position points");
assert.equal(scoreWith("m1", { x0: -6, v: -2 }).score, 8, "wrong velocity sign earns no velocity points");
assert.equal(scoreWith("m2", { xStart: 4.5, xEnd: -1.5 }).score, 20, "graph start and derived slope are scored separately");
assert.equal(scoreWith("m2", { xStart: 4, xEnd: 4 }).score, 8, "correct graph intercept retains partial credit");

const validMeasure = { A: { probes: [0, 2], velocity: 1 }, B: { probes: [6, 3], velocity: 2 }, faster: "B" };
assert.equal(scoreWith("m3", validMeasure).score, 20, "two measured velocities and comparison earn full credit");
assert.equal(scoreWith("m3", { ...validMeasure, A: { probes: [0, 1.5], velocity: 1 } }).score, 7, "short probe interval blocks A and comparison credit");
assert.equal(scoreWith("m3", { ...validMeasure, A: { probes: [0], velocity: 1 } }).score, 7, "one probe is valid partial state but not a valid measurement");
assert.equal(scoreWith("m3", { ...validMeasure, faster: "A" }).score, 14, "wrong comparison does not erase measured velocities");
assert.equal(scoreWith("m3", { ...validMeasure, A: { probes: [0, 2], velocity: -1 } }).score, 13, "wrong sign loses only A velocity points");

const stationary = S.SCENARIO_SETS.alpha.m4;
assert.equal(S.scoreAssessment({ ...S.blankAnswers(), m4: { x0: stationary.x0, v: 0.05 } }, set).detail[3].score, 20, "stationary tolerance includes 0.05 m/s");
assert.equal(S.scoreAssessment({ ...S.blankAnswers(), m4: { x0: stationary.x0, v: 0.06 } }, set).detail[3].score, 8, "non-zero motion outside stationary tolerance is rejected");

assert.equal(scoreWith("m5", { x0B: 8, vB: -2, meetingX: 2.5 }).score, 20, "meeting time and position tolerances are inclusive");
assert.equal(scoreWith("m5", { x0B: -4, vB: 2, meetingX: 2 }).score, 8, "coincident lines earn only independently correct position credit");
assert.equal(scoreWith("m5", { x0B: 7.6, vB: -2, meetingX: 2 }).score, 20, "a different B solution within meeting-time tolerance is accepted");
assert.equal(scoreWith("m5", { x0B: 8, vB: 2, meetingX: 2 }).score, 8, "parallel B motion does not earn meeting credit");

for (const key of ["m1", "m2", "m3", "m4", "m5"]) assert.equal(S.completeness(key, S.blankAnswers()[key]), "empty", `${key} starts empty`);
assert.equal(S.completeness("m3", { A: { probes: [1] }, B: { probes: [] } }), "partial", "one probe remains a legal partial answer");
assert.equal(S.completeness("m5", { x0B: -4, vB: 2, meetingX: 2 }), "complete", "coincident answer is structurally complete even though incorrect");
assert.equal(S.scoreAssessment(S.blankAnswers(), set).score, 0, "blank attempt floors at zero");
assert.equal(S.scoreAssessment(S.blankAnswers(), set).passed, false, "passing threshold is 60");

for (const bad of [NaN, Infinity, -Infinity]) {
  const answer = S.blankAnswers();
  answer.m1.x0 = bad;
  assert.equal(S.validAnswers(answer), false, `${bad} is rejected at the answer boundary`);
}

for (const seed of ["00000000000000000000000000000001", "fedcba98765432100123456789abcdef", "1234567890abcdef1234567890abcdef"]) {
  const paper = G.generatePaper(seed);
  const set = paper.missions;
  const solution = G.enumerateMeetingSolutions(set.m5)[0];
  const answers = {
    m1: { x0: set.m1.x0, v: set.m1.v },
    m2: { xStart: set.m2.x0, xEnd: S.positionAt(set.m2, 6) },
    m3: { A: { probes: [0, 2], velocity: set.m3.A.v }, B: { probes: [5, 1], velocity: set.m3.B.v }, faster: Math.abs(set.m3.A.v) === Math.abs(set.m3.B.v) ? "same" : Math.abs(set.m3.A.v) > Math.abs(set.m3.B.v) ? "A" : "B" },
    m4: { x0: set.m4.x0, v: set.m4.v },
    m5: { x0B: solution.x0, vB: solution.v, meetingX: S.positionAt(set.m5.A, set.m5.meetTime) }
  };
  assert.equal(S.scoreAssessment(answers, set).score, 100, `generated paper ${seed.slice(0, 8)} has a reachable perfect score`);
  const alternate = G.enumerateMeetingSolutions(set.m5).at(-1);
  answers.m5 = { x0B: alternate.x0, vB: alternate.v, meetingX: S.positionAt(set.m5.A, set.m5.meetTime) };
  assert.equal(S.scoreAssessment(answers, set).detail[4].score, 20, "generated mission 5 accepts alternate valid B solutions");
}

console.log("Position-time scoring checks passed");
