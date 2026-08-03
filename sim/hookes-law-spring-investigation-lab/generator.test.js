"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");

for (let seed = 0; seed < 1000; seed += 1) {
  const scenario = G.generateScenario({ seed });
  assert.equal(scenario.generatorVersion, 1);
  assert.equal(scenario.seed, seed);
  assert.ok(Object.isFrozen(scenario));
  assert.ok(Object.isFrozen(scenario.springs));
  assert.notEqual(scenario.springs.A.kNPerM, scenario.springs.B.kNPerM);
  assert.ok(G.K_PAIRS_N_PER_M.some(([a, b]) => [a, b].includes(scenario.springs.A.kNPerM) && [a, b].includes(scenario.springs.B.kNPerM)));
  assert.ok(scenario.predictions.some((item) => item.springKey === "A"));
  assert.ok(scenario.predictions.some((item) => item.springKey === "B"));
  assert.equal(new Set(scenario.predictions.map((item) => `${item.springKey}:${item.forceN}`)).size, 3);
  assert.ok(scenario.predictions.every((item) => !G.INVESTIGATION_FORCES_N.includes(item.forceN)));
  assert.ok(scenario.stage.maxEndpointM <= G.STAGE_SPAN_M + G.FLOAT_EPSILON);
  const designs = G.enumerateDesigns(scenario);
  const safe = designs.filter((design) => design.safe);
  const best = G.bestDesigns(designs);
  assert.equal(best.length, 1);
  assert.ok(best[0].moduleCount >= 3 && best[0].moduleCount <= 7);
  assert.ok(safe.every((design) => design.extensionM <= G.MAX_LINEAR_EXTENSION_M + G.FLOAT_EPSILON));
  assert.ok(designs.filter((design) => design.moduleCount === best[0].moduleCount + 1).every((design) => !design.safe));
}

assert.deepEqual(G.generateScenario({ seed: 123 }), G.generateScenario({ seed: 123 }));
assert.notDeepEqual(G.generateScenario({ seed: 123 }), G.generateScenario({ seed: 124 }));
assert.throws(() => G.generateScenario({ seed: -1 }), /Unsupported generator/);
assert.throws(() => G.generateScenario({ seed: 1, generatorVersion: 2 }), /Unsupported generator/);

console.log("Hooke's law generator checks passed");
