const assert = require("assert");
const Scoring = require("./scoring.js");

const rounds = Scoring.instantiateAttempt("ABC", [0, 1, 2, 3, 0]);
assert.deepEqual(rounds.map((round) => round.weight), [10, 15, 25, 25, 25]);
assert(rounds.every(Scoring.validateRound));

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

console.log("reference-frame scoring checks passed");
