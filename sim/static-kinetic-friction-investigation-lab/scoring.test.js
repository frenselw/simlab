"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const M = require("./measurement.js");
const S = require("./scoring.js");
const scenario = G.generateScenario({ seed: 7 });
const samples = [];
for (let i = 0; i <= 300; i += 1) { const t = i * .1; let f = 0, v = 0; if (t < 2) f = t * 3; else if (t < 3.4) { f = 5; v = .1; } else if (t < 4.2) { f = 6; v = .1 + (t - 3.4) * .125; } else { f = 5; v = .2; } samples.push({ timeS: t, pullCN: Math.round(f * 100), velocityMMps: Math.round(v * 1000) }); }
const trace = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 19 } });
const perfect = S.perfectAnswer(scenario, trace);
const result = S.scoreAnswer(perfect, scenario);
assert.equal(result.score, 100);
assert.equal(result.passed, true);
const bad = JSON.parse(JSON.stringify(perfect)); bad.predictions[0].committed = false;
assert.ok(S.scoreAnswer(bad, scenario).score < 100);
assert.equal(S.balanceToleranceN(4), .2);
assert.equal(S.approx(4.2, 4, .2), true);
assert.equal(S.approx(4.201, 4, .2), false);

const wrongBalanceMagnitude = JSON.parse(JSON.stringify(perfect));
wrongBalanceMagnitude.balance.staticCase.learnerForce.frictionMagnitudeCN += 200;
const partialBalance = S.balanceScore(wrongBalanceMagnitude, scenario);
assert.equal(partialBalance.score, 19, "a wrong A2 friction magnitude loses only its magnitude component");
assert.equal(partialBalance.detail.find((item) => item.key === "static-case").points, 5);

const wrongZeroForce = JSON.parse(JSON.stringify(perfect));
wrongZeroForce.balance.zeroForce = { frictionType: "static", direction: "right", frictionMagnitudeCN: 100, committed: true };
assert.equal(S.balanceScore(wrongZeroForce, scenario).detail.find((item) => item.key === "zero-force").points, 0, "A1 must explicitly identify zero friction");

const justInsideMaximum = JSON.parse(JSON.stringify(perfect));
justInsideMaximum.balance.breakaway.learnerMaxCN = Math.round((scenario.staticLimitMeanN + S.maximumStaticBalanceToleranceN(scenario.staticLimitMeanN) - .01) * 100);
assert.equal(S.balanceScore(justInsideMaximum, scenario).detail.find((item) => item.key === "maximum-static-friction").points, 10);
const justOutsideMaximum = JSON.parse(JSON.stringify(perfect));
justOutsideMaximum.balance.breakaway.learnerMaxCN = Math.round((scenario.staticLimitMeanN + S.maximumStaticBalanceToleranceN(scenario.staticLimitMeanN) + .01) * 100);
assert.equal(S.balanceScore(justOutsideMaximum, scenario).detail.find((item) => item.key === "maximum-static-friction").points, 0);

const wrongC1Relation = JSON.parse(JSON.stringify(perfect));
wrongC1Relation.analysis.staticInterval.relation = "pull-greater";
const partialAnalysis = S.analysisScore(wrongC1Relation, scenario);
assert.equal(partialAnalysis.detail.find((item) => item.key === "static-rise").points, 5, "C1 interval and type credit remain independent of relation");

const wrongPredictionType = JSON.parse(JSON.stringify(perfect));
const predictionSpec = scenario.predictions[0];
wrongPredictionType.predictions[0].frictionType = predictionSpec.frictionType === "static" ? "kinetic" : "static";
const predictionDetail = S.predictionScore(wrongPredictionType, scenario).detail[0];
assert.equal(predictionDetail.direction, true, "direction credit is independent of type");
assert.equal(predictionDetail.magnitude, false, "magnitude remains gated by correct type and direction");
const blankPredictionMagnitude = JSON.parse(JSON.stringify(perfect));
blankPredictionMagnitude.predictions[0].magnitudeCN = null;
assert.equal(S.predictionScore(blankPredictionMagnitude, scenario).detail[0].magnitude, false, "blank magnitude cannot be coerced to zero for credit");
console.log("Static/kinetic friction scoring checks passed");
