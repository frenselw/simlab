"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js"), P = require("./persistence.js"), S = require("./scoring.js");
const seed = 11, problem = G.generate(seed), fixtures = [];
let state = P.initial(seed); fixtures.push(state);

// Complete the parts deliberately out of order to prove the tab is not a gate.
state = P.switchPart(state, 3); fixtures.push(state);
state = P.setView(state, { yaw10: 650, pitch10: -180 });
state = P.setView(state, { yaw10: 1100, pitch10: 220 });
state = P.selectPart3(state, problem.part3.correctKey); fixtures.push(state);
state = P.switchPart(state, 2);
for (const key of ["h1", "h2"]) { state = P.settleHole(state, key); fixtures.push(state); state = P.traceVertical(state); fixtures.push(state); }
state = P.markPart2(state, problem.part2.centre); fixtures.push(state);
state = P.switchPart(state, 1); state = P.release(state, problem.part1.xCm); state = P.markPart1(state, problem.part1.xCm); fixtures.push(state);
assert.equal(P.allComplete(state), true);
state = P.enterCheck(state); fixtures.push(state);

for (const item of fixtures) {
  const decoded = P.decode(P.encode(item));
  assert.deepEqual(decoded, item);
  assert.equal(S.score(decoded).score, S.score(item).score);
}
for (const part of [1, 2, 3]) {
  const switched = P.switchPart(state, part);
  assert.equal(switched.phase, `part${part}`);
  assert.equal(switched.variant, "editing");
  assert.equal(P.validate(switched), true);
  const reset = P.resetPart(state, part);
  assert.equal(reset.phase, `part${part}`);
  assert.equal(P.allComplete(reset), false);
}
const review = P.makeReview(state);
assert.equal(P.validate(review, true), true);
assert.deepEqual(P.fromReview(review), review);
assert.equal(P.decode(undefined), null);

const legacy = (source, phase, variant, returnToCheck = false) => ({
  v: 1, generatorVersion: source.generatorVersion, rubricVersion: source.rubricVersion, seed: source.seed,
  phase, variant, returnToCheck, part1: structuredClone(source.part1), part2: structuredClone(source.part2), part3: structuredClone(source.part3)
});
let legacyNormalSource = P.initial(seed);
legacyNormalSource = P.release(legacyNormalSource, problem.part1.xCm);
legacyNormalSource = P.markPart1(legacyNormalSource, problem.part1.xCm);
const migratedNormal = P.decode(legacy(legacyNormalSource, "part1", "marked-normal"));
assert.equal(migratedNormal.v, 2); assert.equal(migratedNormal.phase, "part1"); assert.equal(migratedNormal.variant, "editing");
const redoSource = P.resetPart(state, 2);
const migratedRedo = P.decode(legacy(redoSource, "part2", "ready-redo", true));
assert.equal(migratedRedo.v, 2); assert.equal(migratedRedo.phase, "part2");
const migratedReview = P.fromReview(legacy(review, "review", "submitted"));
assert.equal(migratedReview.v, 2); assert.equal(migratedReview.phase, "review");
const corruptLegacy = legacy(legacyNormalSource, "part1", "marked-redo", false);
assert.equal(P.decode(corruptLegacy), null, "corrupt v1 variant is rejected rather than washed through v2");

const restoredSettled = P.decode(P.encode(fixtures.find((item) => item.phase === "part2" && item.part2.activeHoleKey)));
const hole = problem.part2.holes.find((item) => item.key === restoredSettled.part2.activeHoleKey);
const dx = problem.part2.centre.x - hole.x, dy = problem.part2.centre.y - hole.y, n = Math.hypot(dx, dy);
const continuation = P.recordLine(restoredSettled, { holeKey: hole.key, a: [hole.x - dx / n * .02, hole.y - dy / n * .02], b: [hole.x + dx / n * .55, hole.y + dy / n * .55] });
assert.ok(continuation && P.validate(continuation), "restored settled state accepts a real traced-line continuation");

for (const make of [
  () => { const x = structuredClone(state); x.seed = NaN; return x; },
  () => { const x = structuredClone(state); x.part3.view.yaw10 = 1800; return x; },
  () => { const x = structuredClone(state); x.part2.lines[1].holeKey = "h1"; return x; },
  () => { const x = structuredClone(state); x.variant = "between-multi-normal"; return x; }
]) assert.equal(P.decode(make()), null);
assert.ok(Buffer.byteLength(JSON.stringify(review), "utf8") < 4000);
let capped = P.switchPart(P.initial(seed), 1); capped = P.release(capped, problem.part1.xCm);
for (let i = 0; i < 12; i += 1) capped = P.release(capped, i % 2 ? .08 : .92);
assert.equal(capped.part1.supportEpisodes.length, 12);
assert.ok(capped.part1.supportEpisodes.some((item) => item.outcome === "balanced"));
console.log("Centre-of-mass persistence v2, free-navigation and migration checks passed");
