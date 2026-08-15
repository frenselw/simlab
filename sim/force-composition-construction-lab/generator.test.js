"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const G = require("./generator.js");

function compact(scenario) {
  return scenario.questions.map((question) => ({
    id: question.id,
    type: question.type,
    guided: question.guided,
    forces: question.forces.map(({ key, length, directionDeg, dx, dy }) => ({ key, length, directionDeg, dx, dy })),
    initialTails: question.initialTails
  }));
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const first = G.generateScenario({ seed: 7 });
const again = G.generateScenario({ seed: 7 });
assert.deepEqual(first, again, "same generator version and seed reproduce every question field");
assert.equal(hash(compact(first)), "7b9655b80609e5ce386b8932b0ba75ae77602be09d2b17437f1e97a31970a5b0", "v1 golden full specification stays immutable");
const forcedFallback = G.generateScenario({ seed: 7, forceFallback: true });
assert.equal(hash(compact(forcedFallback)), "40a2d57a6247f9ca1be4950f3a22ebaa5a4b360d25421e815803c8285866aa30", "v1 forced-fallback full specification stays immutable");
assert.ok(Object.isFrozen(G.GENERATORS) && Object.isFrozen(first.questions[0].forces[0]), "registry and generated scenario are immutable");

function basicQuestion(angle) {
  const forces = [G.vector(130, 0, "F1"), G.vector(85, angle, "F2")];
  const centers = [{ x: 145, y: 130 }, { x: 145, y: 370 }];
  return {
    type: "parallelogram",
    forces,
    initialTails: forces.map((force, index) => ({ x: centers[index].x - force.dx / 2, y: centers[index].y - force.dy / 2 }))
  };
}

for (const angle of [30, 60, 85, 95, 120, 150]) assert.equal(G.validateBasic(basicQuestion(angle)), true, `${angle} degrees is accepted`);
for (const angle of [25, 90, 155]) assert.equal(G.validateBasic(basicQuestion(angle)), false, `${angle} degrees is rejected`);

const signatures = new Set();
const directionBins = new Set();
const lengthBins = new Set();
let fallbacks = 0;
for (let seed = 0; seed < 10000; seed += 1) {
  const scenario = G.generateScenario({ seed });
  assert.equal(scenario.questions.length, 5);
  assert.deepEqual(scenario.questions.map((question) => question.type), ["parallelogram", "parallelogram", "head-to-tail-2", "head-to-tail-2", "head-to-tail-3"]);
  const basicSignatures = scenario.questions.slice(0, 4).map(G.signature);
  assert.equal(new Set(basicSignatures).size, 4, `seed ${seed}: four basic question signatures differ`);
  scenario.questions.slice(0, 4).forEach((question) => assert.equal(G.validateBasic(question), true));
  assert.equal(G.validateTriple(scenario.questions[4]), true);
  assert.deepEqual(G.generateScenario({ seed }), scenario, `seed ${seed}: deterministic`);
  signatures.add(scenario.signature);
  scenario.questions.flatMap((question) => question.forces).forEach((force) => {
    directionBins.add(Math.floor(force.directionDeg / 45));
    lengthBins.add(force.length);
  });
  fallbacks += scenario.diagnostics.filter((item) => item.fallback).length;
}
assert.ok(signatures.size >= 9900, `whole-set variation is at least 99%, got ${signatures.size}`);
assert.equal(directionBins.size, 8, "all direction sectors appear");
assert.ok(lengthBins.size >= 12, "the available length levels are broadly represented");
assert.ok(fallbacks / 50000 < 0.01, `normal fallback rate stays below 1%, got ${fallbacks / 50000}`);
forcedFallback.questions.slice(0, 4).forEach((question) => assert.equal(G.validateBasic(question), true));
assert.equal(G.validateTriple(forcedFallback.questions[4]), true, "forced fallback uses the same validators");

assert.throws(() => G.generateScenario({ seed: -1 }), /uint32/);
assert.throws(() => G.generateScenario({ seed: 1, generatorVersion: 99 }), /Unsupported/);

console.log("force-composition generator tests passed");
