"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const scenarios = Array.from({ length: 400 }, (_, seed) => G.generateScenario({ seed }));
for (const scenario of scenarios) {
  assert.equal(scenario.generatorVersion, 1);
  assert.ok(scenario.staticLimitMeanN >= 4.5 && scenario.staticLimitMeanN <= 9);
  assert.ok(scenario.kineticFrictionMeanN >= 3.2 && scenario.kineticFrictionMeanN <= 7);
  assert.ok(scenario.staticLimitMeanN - scenario.kineticFrictionMeanN >= .8);
  assert.ok(["left", "right"].includes(scenario.balancePullDirection));
  assert.ok(scenario.balancePullN > 0 && scenario.balancePullN < scenario.staticLimitMeanN, "A2 supplied pull stays below maximum static friction");
  assert.equal(scenario.balancePullCN, Math.round(scenario.balancePullN * 100));
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
assert.throws(() => G.generateScenario({ seed: 1, physicsVersion: 1 }), /Unsupported/);
assert.throws(() => G.generateScenario({ seed: 1, physicsVersion: 3 }), /Unsupported/);
assert.throws(() => G.generateScenario({ seed: 1, physicsVersion: 4 }), /Unsupported/);
assert.throws(() => G.generateScenario({ seed: 1, physicsVersion: 5 }), /Unsupported/);
assert.throws(() => G.generateScenario({ seed: 1, measurementVersion: 3 }), /Unsupported/);
console.log("Static/kinetic friction generator checks passed");
