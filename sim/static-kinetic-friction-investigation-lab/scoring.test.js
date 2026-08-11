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
for (const [zeroForce, expected] of [
  [{ frictionType: "none", direction: "right", frictionMagnitudeCN: 0, committed: true }, 3],
  [{ frictionType: "none", direction: "none", frictionMagnitudeCN: 100, committed: true }, 2],
  [{ frictionType: "static", direction: "none", frictionMagnitudeCN: 0, committed: true }, 3]
]) {
  const componentAnswer = JSON.parse(JSON.stringify(perfect)); componentAnswer.balance.zeroForce = zeroForce;
  assert.equal(S.balanceScore(componentAnswer, scenario).detail.find((item) => item.key === "zero-force").points, expected, "A1 type, direction and magnitude are scored independently");
}

const justInsideMaximum = JSON.parse(JSON.stringify(perfect));
justInsideMaximum.balance.breakaway.learnerMaxCN = Math.round((scenario.staticLimitMeanN + S.maximumStaticBalanceToleranceN(scenario.staticLimitMeanN) - .01) * 100);
assert.equal(S.balanceScore(justInsideMaximum, scenario).detail.find((item) => item.key === "maximum-static-friction").points, 10);
const justOutsideMaximum = JSON.parse(JSON.stringify(perfect));
justOutsideMaximum.balance.breakaway.learnerMaxCN = Math.round((scenario.staticLimitMeanN + S.maximumStaticBalanceToleranceN(scenario.staticLimitMeanN) + .01) * 100);
assert.equal(S.balanceScore(justOutsideMaximum, scenario).detail.find((item) => item.key === "maximum-static-friction").points, 0);

const wrongStaticMarker = JSON.parse(JSON.stringify(perfect));
wrongStaticMarker.analysis.staticFriction.index = wrongStaticMarker.trial.regularSampleCount;
const partialAnalysis = S.analysisScore(wrongStaticMarker, scenario);
assert.equal(partialAnalysis.detail.find((item) => item.key === "static-friction").points, 0, "an incorrectly placed static-friction marker receives no C1 credit");
const wrongKineticMarker = JSON.parse(JSON.stringify(perfect));
wrongKineticMarker.analysis.kineticFriction.index = 0;
assert.equal(S.analysisScore(wrongKineticMarker, scenario).detail.find((item) => item.key === "kinetic-friction").points, 0, "a pre-breakaway marker is not kinetic friction");
const uncommittedCorrectMarkers = JSON.parse(JSON.stringify(perfect));
Object.values(uncommittedCorrectMarkers.analysis).forEach((marker) => { marker.committed = false; });
const uncommittedAnalysis = S.analysisScore(uncommittedCorrectMarkers, scenario);
assert.equal(uncommittedAnalysis.score, 0, "correct-looking Part C drafts receive no credit until explicitly saved");
assert.ok(uncommittedAnalysis.detail.every((item) => item.points === 0));

// Part B now automatically holds the post-breakaway pull near the kinetic
// friction value. A stable speed between the historical slow/fast bands is
// still a valid C3 tail, so a late marker must receive credit even when the
// candidate finder has no speed-band window for it.
const stablePostBreakSamples = Array.from({ length: 301 }, (_, index) => {
  const timeS = index * 0.1;
  const beforeBreakaway = timeS < 2;
  return { timeS, pullCN: Math.round((beforeBreakaway ? timeS * 3 : 5) * 100), velocityMMps: beforeBreakaway ? 0 : 140 };
});
const stablePostBreakTrace = M.packTrace({ regularSamples: stablePostBreakSamples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 140, preBreakPeakGridIndex: 19 } });
const stablePostBreakCandidates = M.findCandidateWindows(stablePostBreakTrace);
assert.equal(stablePostBreakCandidates.slow.length, 0);
assert.equal(stablePostBreakCandidates.fast.length, 0);
const stablePostBreakDecoded = M.unpackTrace(stablePostBreakTrace);
const stablePostBreakAnswer = JSON.parse(JSON.stringify(perfect));
stablePostBreakAnswer.trial = stablePostBreakTrace;
stablePostBreakAnswer.analysis = {
  staticFriction: { index: stablePostBreakCandidates.static[0].startIndex, committed: true },
  maximumStaticFriction: { index: stablePostBreakDecoded.merged.findIndex((sample) => sample.kind === "breakaway"), committed: true },
  kineticFriction: { index: stablePostBreakDecoded.merged.length - 1, committed: true }
};
const stablePostBreakC3 = S.analysisScore(stablePostBreakAnswer, scenario).detail.find((item) => item.key === "kinetic-friction");
assert.equal(stablePostBreakC3.points, 13, "a late stable post-breakaway marker receives C3 credit outside speed bands");
assert.equal(stablePostBreakC3.settledPostBreak, true);

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
