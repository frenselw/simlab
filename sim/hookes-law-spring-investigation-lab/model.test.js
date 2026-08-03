"use strict";

const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./model.js");
const close = (actual, expected, epsilon = 1e-12) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected}`);

const scenario = G.generateScenario({ seed: 42 });
close(M.extensionM(2, 20), 0.1);
close(M.endpointM(0.085, 2, 20), 0.185);
close(M.measuredExtensionM(0.085, 0.185), 0.1);
assert.equal(M.measuredExtensionM(0.2, 0.1), null);
close(M.kFromModelHandle(0.125), 20);
close(M.modelForceN(20, 0.1), 2);
close(M.fitKThroughOrigin([{ forceN: 1, measuredExtensionM: 0.05 }, { forceN: 2, measuredExtensionM: 0.1 }]), 20);
assert.equal(M.fitKThroughOrigin([{ forceN: 1, measuredExtensionM: 0 }, { forceN: 2, measuredExtensionM: 0 }]), null);
assert.equal(M.fitKThroughOrigin([{ forceN: 1, measuredExtensionM: Infinity }]), null);
assert.equal(M.extensionM(1, 0), null);
assert.equal(M.kFromModelHandle(0), null);

const graph = { left: 20, top: 10, width: 400, height: 300, maxExtensionM: 0.18, maxForceN: 4 };
const point = M.graphPointFromPhysics(0.09, 2, graph);
assert.deepEqual(point, { x: 220, y: 160 });
const physics = M.physicsFromGraphPoint(point.x, point.y, graph);
close(physics.extensionM, 0.09);
close(physics.forceN, 2);

const designs = M.enumerateDesigns(scenario);
assert.equal(designs.length, 16);
const optimal = M.optimalSafeDesign(scenario);
assert.ok(optimal && optimal.safe);
assert.equal(optimal.forceN, Math.max(...designs.filter((item) => item.safe).map((item) => item.forceN)));
assert.equal(M.validOperationEvidence({ mode: "pointer", moveM: 0.005 }, 0.1, scenario.stage.spanM), true);
assert.equal(M.validOperationEvidence({ mode: "pointer", moveM: 0.004 }, 0.1, scenario.stage.spanM), false);

console.log("Hooke's law model checks passed");
