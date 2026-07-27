"use strict";

const assert = require("node:assert/strict");
const Model = require("./graph-model.js");
const Analysis = require("./graph-analysis.js");

function traceFrom(fn, graphType = "xt", blank = () => false) {
  const trace = Model.createTrace();
  for (let index = 0; index < Model.DRAW_BINS; index += 1) {
    if (blank(index)) continue;
    const t = index / (Model.DRAW_BINS - 1);
    const y = fn(t);
    trace[index] = Model.quantizeY(graphType === "xt" ? y : y + 0.5);
  }
  return trace;
}

let metrics = Analysis.analyzeTrace(traceFrom((t) => 0.1 + 0.6 * t), "xt");
assert.equal(metrics.structuralInvalid, false);
assert.equal(metrics.coverage, 1);
assert.ok(metrics.line.rmse < 0.01);
assert.ok(Math.abs(metrics.line.slope - 0.6) < 0.03);
assert.ok(metrics.positiveSlopeRatio > 0.9);
assert.ok(Math.abs(metrics.localSlopes.delta) < 0.04);

metrics = Analysis.analyzeTrace(traceFrom((t) => 0.1 + 0.7 * t * t), "xt");
assert.ok(metrics.localSlopes.delta > 0.4);
assert.ok(metrics.localSlopes.rho > 0.8);
assert.ok(metrics.deltaBIC > 6);

metrics = Analysis.analyzeTrace(traceFrom((t) => 0.1 + 0.7 * t - 0.35 * t * t), "xt");
assert.ok(metrics.localSlopes.delta < -0.35);
assert.ok(metrics.endSlope < 0.2);
assert.ok(metrics.positiveSlopeRatio > 0.8);

metrics = Analysis.analyzeTrace(traceFrom(() => 0.28, "vt"), "vt");
assert.ok(Math.abs(metrics.line.slope) < 0.01);
assert.ok(metrics.region.positive > 0.99);

metrics = Analysis.analyzeTrace(traceFrom(() => 0, "at"), "at");
assert.ok(metrics.region.zero > 0.99);
assert.ok(metrics.region.zeroP80 < 0.01);

metrics = Analysis.analyzeTrace(traceFrom((t) => 0.2 + 0.4 * t, "xt", (index) => index >= 44 && index <= 51), "xt");
assert.ok(metrics.maxGapFraction >= 2 / 24);
assert.ok(metrics.coverage < 1);
assert.ok(metrics.coverage > 0.75);

assert.equal(Analysis.spearman([1, 1, 2, 2, 3, 3]) > 0.9, true, "ties use average ranks");
assert.equal(Analysis.quadraticFit([{ x: 0, y: 0 }]), null);
assert.equal(Analysis.analyzeTrace(new Uint8Array(95), "xt").structuralInvalid, true);

const composite = Analysis.analyzeTrace(traceFrom((t) => {
  const phase = Math.min(3, Math.floor(t * 4));
  return [0.2, 0.4, 0.6, 0.8][phase];
}, "at"), "at", { composite: true });
assert.equal(composite.phases.length, 4);
assert.equal(composite.boundaries.length, 3);
assert.equal(composite.phases.every((phase) => phase.coverage === 1), true);

const repeated = Analysis.analyzeTrace(traceFrom((t) => 0.2 + 0.3 * t * t), "xt");
assert.deepEqual(repeated, Analysis.analyzeTrace(traceFrom((t) => 0.2 + 0.3 * t * t), "xt"));

console.log("Qualitative kinematics graph analysis tests passed");
