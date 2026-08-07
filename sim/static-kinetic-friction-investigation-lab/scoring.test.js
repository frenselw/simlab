"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./measurement.js");
const S = require("./scoring.js");
const scenario = G.generateScenario({ seed: 7 });
const samples = [];
for (let i = 0; i <= 300; i += 1) { const t = i * .04; let f = 0, v = 0; if (t < 2) f = t * 3; else if (t < 3.24) { f = 5; v = .1; } else if (t < 4.04) { f = 6; v = .1 + (t - 3.24) * .125; } else { f = 5; v = .2; } samples.push({ timeS: t, pullCN: Math.round(f * 100), velocityMMps: Math.round(v * 1000) }); }
const trace = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 49 } });
const perfect = S.perfectAnswer(scenario, trace);
const result = S.scoreAnswer(perfect, scenario);
assert.equal(result.score, 100);
assert.equal(result.passed, true);
const bad = JSON.parse(JSON.stringify(perfect)); bad.predictions[0].committed = false;
assert.ok(S.scoreAnswer(bad, scenario).score < 100);
assert.equal(S.balanceToleranceN(4), .2);
assert.equal(S.approx(4.2, 4, .2), true);
assert.equal(S.approx(4.201, 4, .2), false);
console.log("Static/kinetic friction scoring checks passed");
