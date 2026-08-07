"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const scenarios = Array.from({ length: 400 }, (_, seed) => G.generateScenario({ seed }));
for (const scenario of scenarios) {
  assert.equal(scenario.generatorVersion, 1);
  assert.ok(scenario.staticLimitMeanN >= 4.5 && scenario.staticLimitMeanN <= 9);
  assert.ok(scenario.kineticFrictionMeanN >= 3.2 && scenario.kineticFrictionMeanN <= 7);
  assert.ok(scenario.staticLimitMeanN - scenario.kineticFrictionMeanN >= .8);
  assert.equal(scenario.predictions.length, 4);
  assert.deepEqual(scenario, G.generateScenario({ seed: scenario.seed }));
  const values = Array.from({ length: 100 }, (_, i) => G.surfaceVariation(i * .01, scenario.surfaceProfile));
  assert.ok(values.every((value) => Math.abs(value) <= 1 + 1e-9));
}
assert.notDeepEqual(scenarios[1], scenarios[2]);
assert.equal(G.deriveSeed(10, "surface"), G.deriveSeed(10, "surface"));
assert.notEqual(G.deriveSeed(10, "surface"), G.deriveSeed(10, "sensor"));
assert.throws(() => G.generateScenario({ seed: -1 }), /Unsupported/);
assert.throws(() => G.generateScenario({ seed: 1, physicsVersion: 2 }), /Unsupported/);
console.log("Static/kinetic friction generator checks passed");
