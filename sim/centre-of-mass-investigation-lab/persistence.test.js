"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js"), P = require("./persistence.js"), S = require("./scoring.js");
const seed = 11, problem = G.generate(seed), fixtures = [];
let state = P.initial(seed); fixtures.push(state);

let tentative = P.switchPart(P.initial(seed), 3);
tentative = P.selectPart3(tentative, problem.part3.correctKey);
assert.ok(tentative && P.validate(tentative), "candidate selection is a restorable tentative editing state");
assert.equal(P.allComplete(tentative), false);
assert.equal(P.enterCheck(tentative), null, "tentative selection cannot bypass the observation gate");
assert.deepEqual(P.decode(P.encode(tentative)), tentative);

// Complete the parts deliberately out of order to prove the tab is not a gate.
state = P.switchPart(state, 3); fixtures.push(state);
state = P.setView(state, { yaw10: 650, pitch10: -180 });
state = P.setView(state, { yaw10: 1100, pitch10: 220 });
state = P.selectPart3(state, problem.part3.correctKey); fixtures.push(state);
state = P.switchPart(state, 2);
for (const key of ["h1", "h2"]) { state = P.settleHole(state, key); fixtures.push(state); state = P.traceVertical(state); fixtures.push(state); assert.equal(state.part2.activeHoleKey, key, "recording a line keeps the plate suspended"); state = P.detachActiveHole(state); fixtures.push(state); }
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
const angledLine = (key, degrees, lengthFactor=.55) => { const hole=problem.part2.holes.find((item)=>item.key===key),dx=problem.part2.centre.x-hole.x,dy=problem.part2.centre.y-hole.y,n=Math.hypot(dx,dy),a=degrees*Math.PI/180,ux=dx/n*Math.cos(a)-dy/n*Math.sin(a),uy=dx/n*Math.sin(a)+dy/n*Math.cos(a),length=lengthFactor*problem.part2.size;return{holeKey:key,a:[hole.x,hole.y],b:[hole.x+ux*length,hole.y+uy*length]}; };
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
let legacySelectedWithoutEvidence = P.resetPart(state, 3);
legacySelectedWithoutEvidence = P.selectPart3(legacySelectedWithoutEvidence, problem.part3.correctKey);
const legacySelectedWithOneObservation = P.setView(legacySelectedWithoutEvidence, { yaw10: 650, pitch10: -180 });
for (const source of [legacySelectedWithoutEvidence, legacySelectedWithOneObservation]) {
  assert.equal(P.decode(legacy(source, "part3", "selected-normal")), null, "v1 candidate selection without its legacy observation gate is rejected");
}
let modernSlant=P.initial(seed);modernSlant=P.release(modernSlant,problem.part1.xCm);modernSlant=P.markPart1(modernSlant,problem.part1.xCm);modernSlant=P.switchPart(modernSlant,2);modernSlant=P.settleHole(modernSlant,"h1");modernSlant=P.recordLine(modernSlant,angledLine("h1",10.5));
assert.ok(P.decode(P.encode(modernSlant)),"v2 preserves a recordable 10.5 degree learner line");
assert.equal(S.evidence(modernSlant,problem).lines.length,0,"the unchanged strict scorer does not count the 10.5 degree line");
assert.equal(P.decode(legacy(modernSlant,"part2","between-one-normal")),null,"v1 migration remains strict and cannot launder a formerly impossible slanted line");
let invalidLineBase=P.switchPart(P.initial(seed),2);invalidLineBase=P.settleHole(invalidLineBase,"h1");const forward=angledLine("h1",0),activeHole=problem.part2.holes.find((item)=>item.key==="h1");for(const bad of [angledLine("h1",0,.4499),{holeKey:"h1",a:[activeHole.x,activeHole.y],b:[activeHole.x-(forward.b[0]-activeHole.x),activeHole.y-(forward.b[1]-activeHole.y)]},{holeKey:"h1",a:[activeHole.x,activeHole.y],b:[Infinity,0]},{holeKey:"h1",a:[activeHole.x,activeHole.y],b:[1.500001,1.500001]}])assert.equal(P.recordLine(invalidLineBase,bad),null,"production persistence rejects short, upward, nonfinite and out-of-range lines");

const restoredSettled = P.decode(P.encode(fixtures.find((item) => item.phase === "part2" && item.part2.activeHoleKey)));
const hole = problem.part2.holes.find((item) => item.key === restoredSettled.part2.activeHoleKey);
const dx = problem.part2.centre.x - hole.x, dy = problem.part2.centre.y - hole.y, n = Math.hypot(dx, dy);
const continuation = P.recordLine(restoredSettled, { holeKey: hole.key, a: [hole.x - dx / n * .02, hole.y - dy / n * .02], b: [hole.x + dx / n * .55, hole.y + dy / n * .55] });
assert.ok(continuation && P.validate(continuation), "restored settled state accepts a real traced-line continuation");
assert.equal(continuation.part2.activeHoleKey, hole.key, "tracing does not detach the restored plate");
const detached = P.detachActiveHole(restoredSettled);
assert.ok(detached && P.validate(detached), "restored settled state can take down an unlined plate");
assert.equal(detached.part2.activeHoleKey, null);
assert.ok(!detached.part2.hangRecords.some((record) => record.holeKey === hole.key), "take-down removes the unlined hang relationship");
assert.ok(P.settleHole(detached, problem.part2.holes.find((item) => item.key !== hole.key).key), "take-down can continue with another hole");

let redraw=P.switchPart(P.initial(seed),2);redraw=P.settleHole(redraw,"h1");redraw=P.traceVertical(redraw);const originalLine=structuredClone(redraw.part2.lines[0]);assert.equal(redraw.part2.activeHoleKey,"h1","the plate remains active immediately after its first line");redraw=P.detachActiveHole(redraw);redraw=P.settleHole(redraw,"h1");
assert.ok(redraw&&P.validate(redraw)&&redraw.part2.activeHoleKey==="h1","a used hole can be rehung for redraw");
assert.deepEqual(P.decode(P.encode(redraw)),redraw,"active redraw with its existing line round-trips");
const retained=P.detachActiveHole(redraw);assert.deepEqual(retained.part2.lines,[originalLine]);assert.deepEqual(retained.part2.hangRecords,[{holeKey:"h1"}],"detaching a redraw retains prior evidence");
redraw=P.recordLine(redraw,angledLine("h1",18));assert.equal(redraw.part2.lines.length,1);assert.equal(redraw.part2.activeHoleKey,"h1");assert.notDeepEqual(redraw.part2.lines[0],originalLine,"recording atomically replaces only that hole's line");

let markedActive=P.switchPart(state,2);markedActive=P.settleHole(markedActive,"h1");assert.ok(markedActive&&markedActive.part2.mark,"an existing mark survives same-hole rehang");assert.equal(P.allComplete(markedActive),false,"active redraw locks structural completion");const markedDetached=P.detachActiveHole(markedActive);assert.ok(markedDetached.part2.mark);assert.equal(P.allComplete(markedDetached),true,"detaching restored evidence unlocks completion again");
let markerWhileHung=P.switchPart(P.initial(seed),2);markerWhileHung=P.settleHole(markerWhileHung,"h1");markerWhileHung=P.traceVertical(markerWhileHung);markerWhileHung=P.detachActiveHole(markerWhileHung);markerWhileHung=P.settleHole(markerWhileHung,"h2");markerWhileHung=P.traceVertical(markerWhileHung);markerWhileHung=P.detachActiveHole(markerWhileHung);markerWhileHung=P.settleHole(markerWhileHung,"h3");markerWhileHung=P.markPart2(markerWhileHung,problem.part2.centre);assert.ok(markerWhileHung&&markerWhileHung.part2.activeHoleKey==="h3","centre marker can be recorded while another hole remains hung");assert.deepEqual(P.decode(P.encode(markerWhileHung)),markerWhileHung,"active marker state round-trips");

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
