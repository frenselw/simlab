const assert = require("assert");
const Scoring = require("./scoring.js");

function seededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const rounds = Scoring.instantiateAttempt("ABC", [0, 1, 2, 3, 0]);
assert.deepEqual(rounds.map((round) => round.weight), [10, 15, 25, 25, 25]);
assert(rounds.every(Scoring.validateRound));
assert(Scoring.validateAttempt(rounds));
assert.equal(Scoring.ROUND_GROUPS.length, 5);
assert(Scoring.ROUND_GROUPS.every((group) => group.length === 2));
assert.equal(Object.keys(Scoring.PATTERNS).length, 10);
Object.keys(Scoring.PATTERNS).forEach((id) => {
  assert(Scoring.validateRound(Scoring.instantiateRound(id, "ABC", 0)), `${id} must derive its accepted answers from its conditions`);
});

assert.deepEqual(Scoring.conditionCandidates(rounds[0], rounds[0].conditions[0]), ["R"]);
assert.deepEqual(rounds[1].accepted, ["A", "B"]);
assert.deepEqual(Scoring.conditionCandidates(rounds[1], rounds[1].conditions[0]), ["A", "B"]);
assert.deepEqual(Scoring.conditionCandidates(rounds[1], rounds[1].conditions[1]), ["A", "B"]);

rounds.slice(2).forEach((round) => {
  round.conditions.forEach((condition) => assert(Scoring.conditionCandidates(round, condition).length > 1));
  assert.equal(round.accepted.length, 1);
});

const perfect = Scoring.scoreAttempt(rounds, ["R", "A", "A", "B", "C"]);
assert.equal(perfect.score, 100);
assert.equal(perfect.passed, true);

const passingBoundary = Scoring.scoreAttempt(rounds, ["R", "R", "A", "B", "R"]);
assert.equal(passingBoundary.score, 60);
assert.equal(passingBoundary.passed, true);

const foundationsAndOneCore = Scoring.scoreAttempt(rounds, ["R", "B", "A", "R", "R"]);
assert.equal(foundationsAndOneCore.score, 50);
assert.equal(foundationsAndOneCore.passed, false);

const mixed = Scoring.scoreAttempt(rounds, ["R", "B", "A", "B", "R"]);
assert.equal(mixed.score, 75);
assert.equal(mixed.passed, true);

const wrong = Scoring.scoreAttempt(rounds, ["A", "R", "R", "R", "R"]);
assert.equal(wrong.score, 0);
assert.equal(wrong.passed, false);

const snapshot = Scoring.snapshotRound(rounds[4]);
assert.deepEqual(Scoring.roundFromSnapshot(snapshot), rounds[4]);
assert.throws(() => Scoring.roundFromSnapshot({ ...snapshot, c: [1, 1, 1] }));
assert.throws(() => Scoring.roundFromSnapshot({ ...snapshot, l: -1 }));
assert.throws(() => Scoring.roundFromSnapshot({ ...snapshot, l: Scoring.LAYOUT_COUNT }));
assert.equal(Scoring.validateAnswers(["R", "A", "B", "C", "A"], 5), true);
assert.equal(Scoring.validateAnswers(["R", "A", "invalid", "C", "A"], 5), false);
assert.equal(Scoring.validateAnswers(["R"], 5), false);

const permuted = Scoring.instantiateAttempt("BCA", [0, 0, 0, 0, 0]);
assert.deepEqual(permuted.map((round) => round.id), Scoring.ROUND_ORDER);
assert.deepEqual(permuted.filter((round) => round.accepted.length === 1).map((round) => round.accepted[0]).sort(), ["A", "B", "C", "R"]);

const variantOrder = Scoring.ROUND_GROUPS.map((group) => group[1]).reverse();
const independentPermutations = ["ABC", "BCA", "CAB", "ACB", "CBA"];
const varied = Scoring.instantiateAttempt(independentPermutations, [0, 1, 2, 3, 0], variantOrder);
assert.deepEqual(varied.map((round) => round.id), variantOrder);
assert.deepEqual(varied.map((round) => round.permutation), independentPermutations);
assert.equal(varied.reduce((total, round) => total + round.weight, 0), 100);
assert(varied.every(Scoring.validateRound));
assert(Scoring.validateAttempt(varied));
varied.forEach((round) => assert.deepEqual(Scoring.roundFromSnapshot(Scoring.snapshotRound(round)), round));
assert.equal(Scoring.scoreAttempt(varied, varied.map((round) => round.accepted[0])).score, 100);

const generatedSpecs = Array.from({ length: 8 }, (_, index) => Scoring.generateAttemptSpec(seededRandom(index + 1)));
generatedSpecs.forEach((spec) => {
  assert.equal(spec.roundOrder.length, 5);
  assert.equal(new Set(spec.roundOrder).size, 5);
  Scoring.ROUND_GROUPS.forEach((group) => assert.equal(spec.roundOrder.filter((id) => group.includes(id)).length, 1));
  assert(spec.permutations.every((value) => value.length === 3 && new Set(value).size === 3 && !/[^ABC]/.test(value)));
  assert(spec.layouts.every((value) => Number.isInteger(value) && value >= 0 && value < Scoring.LAYOUT_COUNT));
  const generated = Scoring.instantiateAttempt(spec.permutations, spec.layouts, spec.roundOrder);
  assert(Scoring.validateAttempt(generated));
  assert.equal(generated.reduce((total, round) => total + round.weight, 0), 100);
});
assert(new Set(generatedSpecs.map((spec) => spec.roundOrder.join(","))).size > 1);
assert(new Set(generatedSpecs.map((spec) => spec.permutations.join(","))).size > 1);
assert(generatedSpecs.some((spec) => new Set(spec.permutations).size > 1));
assert(generatedSpecs.some((spec) => new Set(spec.layouts).size > 1));
assert(new Set(generatedSpecs.map((spec) => spec.layouts.join(","))).size > 1);
assert.equal(Scoring.validateAttempt([rounds[0], rounds[0], rounds[2], rounds[3], rounds[4]]), false);

console.log("reference-frame scoring checks passed");
