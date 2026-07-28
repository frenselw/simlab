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

const blankCompositePhase = traceFrom((t) => 0.2 + 0.2 * t, "vt",
  (index) => index >= 24 && index < 48);
assert.equal(Analysis.analyzeTrace(blankCompositePhase, "vt", { composite: true }).phases[1].structuralInvalid, true,
  "a completely blank composite phase is structurally invalid");

const repeated = Analysis.analyzeTrace(traceFrom((t) => 0.2 + 0.3 * t * t), "xt");
assert.deepEqual(repeated, Analysis.analyzeTrace(traceFrom((t) => 0.2 + 0.3 * t * t), "xt"));

for (const period of [1, 2]) {
  const alias = Model.createTrace();
  for (let index = 0; index < Model.DRAW_BINS; index += 1) {
    alias[index] = Math.floor(index / period) % 2 ? 250 : 4;
  }
  const aliased = Analysis.analyzeTrace(alias, "vt");
  assert.ok(aliased.rawDiagnostics.pathLengthRatio > 20, `period-${period} raw path length is preserved`);
  assert.ok(aliased.rawDiagnostics.oscillationCount > 30, `period-${period} raw oscillations are preserved`);
  assert.ok(aliased.rawDiagnostics.bucketVerticalSpreadP80 > 0.8, `period-${period} bucket spread is preserved`);
}

const isolatedPerBucket = traceFrom((t) => 0.18 + 0.32 * t, "vt",
  (index) => index % 4 !== 0);
const isolatedMetrics = Analysis.analyzeTrace(isolatedPerBucket, "vt");
assert.equal(isolatedMetrics.coverage, 1, "24-bin aggregation alone sees every bucket");
assert.ok(isolatedMetrics.rawDiagnostics.coverage < 0.3, "raw coverage preserves sparse authored bins");
assert.ok(isolatedMetrics.rawDiagnostics.density < 0.3, "raw density identifies isolated samples");
assert.equal(isolatedMetrics.rawDiagnostics.adjacentPairRatio, 0, "isolated samples have no connected raw pairs");
assert.ok(isolatedMetrics.rawDiagnostics.maxGapFraction > 0, "raw gaps remain measurable");

console.log("Qualitative kinematics graph analysis tests passed");
