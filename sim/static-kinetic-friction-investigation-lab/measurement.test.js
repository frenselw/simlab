"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const P = require("./physics.js");
const M = require("./measurement.js");
const scenario = G.generateScenario({ seed: 42 });
let state = M.createMeasurementState(scenario);
const physical = P.createInitialState(scenario);
for (let i = 0; i < 120; i += 1) state = M.step(state, physical, scenario, 1 / 240).state;
const before = M.liveReading(state);
state = M.tare(state);
assert.equal(state.tared, true);
assert.equal(state.tareCorrectionCN, Math.round((state.forceFilteredN + state.forceBiasN) * 100));
const samples = [];
for (let i = 0; i <= 300; i += 1) samples.push({ timeS: i * .04, pullCN: Math.min(1100, i * 3), velocityMMps: i > 80 ? Math.min(250, i - 80) : 0 });
const trace = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 3200, measuredPullCN: 720, measuredVelocityMMps: 4, preBreakPeakGridIndex: 80 } });
const unpacked = M.unpackTrace(trace);
assert.equal(unpacked.regularSampleCount, 301);
assert.equal(unpacked.merged.length, 301);
assert.equal(unpacked.breakaway.timeMs, 3200);
assert.equal(unpacked.visibleBreakawayPeakCN, 720);
assert.ok(M.assessTrial(trace).candidates);
const preloadThenRise = Array.from({ length: 225 }, (_, i) => ({
  timeS: i * .04,
  pullCN: i < 50 ? 200 : Math.round((2 + (i - 50) * .04 * .4) * 100),
  velocityMMps: 0
}));
const preloadTrace = M.packTrace({ regularSamples: preloadThenRise, breakaway: { timeMs: 9000, measuredPullCN: 560, measuredVelocityMMps: 20, preBreakPeakGridIndex: 224 } });
const preloadDecoded = M.unpackTrace(preloadTrace);
assert.ok(M.otherPhaseFraction({ startIndex: 0, endIndex: 224 }, [], preloadDecoded, "static") > .15, "a flat preload is other phase for static-rise selection");
const shortRiseThenHold = Array.from({ length: 225 }, (_, i) => ({ timeS: i * .04, pullCN: Math.round((2 + Math.min(i, 20) * .04 * 1.25) * 100), velocityMMps: 0 }));
const shortRiseTrace = M.packTrace({ regularSamples: shortRiseThenHold, breakaway: { timeMs: 9000, measuredPullCN: 300, measuredVelocityMMps: 20, preBreakPeakGridIndex: 224 } });
assert.ok(M.findCandidateWindows(shortRiseTrace).static.some((candidate) => candidate.startIndex === 0 && candidate.endIndex <= 20), "static candidate finder enumerates the valid rise before a static hold");
assert.ok(M.FORCE_SENSOR_NOISE_MAX_ABS_N >= .045 && M.VELOCITY_NOISE_MAX_ABS_MPS >= .0075);
assert.ok(Number.isFinite(before.forceN));
assert.throws(() => M.unpackTrace({ ...trace, forceVelocityBase64: "bad" }), /trace|base64/);
console.log("Static/kinetic friction measurement checks passed");
