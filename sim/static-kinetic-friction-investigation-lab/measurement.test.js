"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js");
const P = require("./physics.js");
const M = require("./measurement.js");
const scenario = G.generateScenario({ seed: 42 });
assert.equal(M.GRAPH_SAMPLE_DT_S, .1);
assert.equal(M.MAX_TRIAL_DURATION_S, 30);
let state = M.createMeasurementState(scenario);
const physical = P.createInitialState(scenario);
const physicalCheckpoint = JSON.stringify(physical);
for (let i = 0; i < 120; i += 1) state = M.step(state, physical, scenario, 1 / 240).state;
assert.equal(JSON.stringify(physical), physicalCheckpoint, "measurement filtering never mutates or feeds back into physics state");
const before = M.liveReading(state);
assert.equal(before.forceCN, 0, "the calibrated startup reading is already zero without a learner tare step");
const emptyRecorder = M.createRecorder(scenario);
assert.deepEqual(M.stopRecorder(emptyRecorder), { accepted: false, reason: "no-samples" }, "stopping before the first sample fails safely without throwing");
assert.equal(emptyRecorder.running, false);
const eventMeasurementBase = M.createMeasurementState(scenario);
const eventMeasurementBefore = { ...eventMeasurementBase, forceFilteredN: 5.8, velocityFilteredMps: .02, forceNoise: .2, velocityNoise: -.1 };
const eventMeasurementAfter = { ...eventMeasurementBase, forceFilteredN: 6.2, velocityFilteredMps: .04, forceNoise: .4, velocityNoise: .1 };
const eventPhysicalBefore = { timeS: .2 };
const eventPhysicalAfter = { timeS: .3 };
const breakawayPeak = M.enrichBreakaway(eventMeasurementAfter, { type: "breakaway", timeS: .25, physicalTensionN: 7.08 }, eventMeasurementBefore, eventMeasurementAfter, eventPhysicalBefore, eventPhysicalAfter);
const sameMeasuredDifferentHiddenPeak = M.enrichBreakaway(eventMeasurementAfter, { type: "breakaway", timeS: .25, physicalTensionN: 10.8 }, eventMeasurementBefore, eventMeasurementAfter, eventPhysicalBefore, eventPhysicalAfter);
assert.deepEqual(breakawayPeak.breakaway, sameMeasuredDifferentHiddenPeak.breakaway, "hidden physical threshold never changes the learner-facing event sensor reading");
assert.equal(breakawayPeak.breakaway.measuredPullCN % Math.round(M.FORCE_SENSOR_RESOLUTION_N * 100), 0, "event sensor reading uses the regular force resolution");
assert.notEqual(breakawayPeak.breakaway.measuredPullCN, 708, "breakaway sidecar does not copy raw physical spring tension");
assert.deepEqual(M.enrichBreakaway(eventMeasurementAfter, { type: "breakaway", timeS: .25 }, eventMeasurementBefore, eventMeasurementAfter, eventPhysicalBefore, eventPhysicalAfter).breakaway, breakawayPeak.breakaway, "event-time noise is deterministically seeded");
const samples = [];
for (let i = 0; i <= 300; i += 1) samples.push({ timeS: i * .1, pullCN: Math.min(1100, i * 3), velocityMMps: i > 80 ? Math.min(250, i - 80) : 0 });
const trace = M.packTrace({ regularSamples: samples, breakaway: { timeMs: 3200, measuredPullCN: 720, measuredVelocityMMps: 4, preBreakPeakGridIndex: 31 } });
const unpacked = M.unpackTrace(trace);
assert.equal(unpacked.regularSampleCount, 301);
assert.equal(unpacked.merged.length, 301);
assert.equal(unpacked.breakaway.timeMs, 3200);
assert.equal(unpacked.visibleBreakawayPeakCN, 720);
assert.ok(M.assessTrial(trace).candidates);
const preloadThenRise = Array.from({ length: 225 }, (_, i) => ({
  timeS: i * .1,
  pullCN: i < 50 ? 200 : Math.round((2 + (i - 50) * .1 * .4) * 100),
  velocityMMps: 0
}));
const preloadTrace = M.packTrace({ regularSamples: preloadThenRise, breakaway: { timeMs: 22400, measuredPullCN: 560, measuredVelocityMMps: 20, preBreakPeakGridIndex: 224 } });
const preloadDecoded = M.unpackTrace(preloadTrace);
assert.ok(M.otherPhaseFraction({ startIndex: 0, endIndex: 224 }, [], preloadDecoded, "static") > .15, "a flat preload is other phase for static-rise selection");
const shortRiseThenHold = Array.from({ length: 225 }, (_, i) => ({ timeS: i * .1, pullCN: Math.round((2 + Math.min(i, 20) * .1 * 1.25) * 100), velocityMMps: 0 }));
const shortRiseTrace = M.packTrace({ regularSamples: shortRiseThenHold, breakaway: { timeMs: 22400, measuredPullCN: 300, measuredVelocityMMps: 20, preBreakPeakGridIndex: 224 } });
assert.ok(M.findCandidateWindows(shortRiseTrace).static.some((candidate) => candidate.startIndex === 0 && candidate.endIndex <= 20), "static candidate finder enumerates the valid rise before a static hold");

const plateauSamples = Array.from({ length: 251 }, (_, i) => {
  let velocityMMps = 0; let pullCN = Math.min(600, i * 12);
  if (i > 50 && i <= 150) { velocityMMps = 100; pullCN = 500; }
  else if (i > 150 && i <= 170) { velocityMMps = 100 + (i - 150) * 5; pullCN = 600; }
  else if (i > 170) { velocityMMps = 200; pullCN = 500; }
  return { timeS: i * .1, pullCN, velocityMMps };
});
const plateauTrace = M.packTrace({ regularSamples: plateauSamples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 19 } });
const plateauCandidates = M.findCandidateWindows(plateauTrace);
assert.ok(plateauCandidates.slow.some((candidate) => candidate.startIndex === 60 && candidate.endIndex === 90), "every qualifying slow plateau subwindow is an authority candidate");
assert.ok(plateauCandidates.fast.some((candidate) => candidate.startIndex === 180 && candidate.endIndex === 220), "every qualifying fast plateau subwindow is an authority candidate");

const multipleFastSamples = Array.from({ length: 251 }, (_, i) => {
  let velocityMMps = 0; let pullCN = Math.min(600, i * 12);
  if (i > 50 && i <= 85) { velocityMMps = 120; pullCN = 500; }
  else if (i > 85 && i <= 105) { velocityMMps = 120 + Math.round((i - 85) * 2.5); pullCN = 600; }
  else if (i > 105 && i <= 140) { velocityMMps = 170; pullCN = 500; }
  else if (i > 140 && i <= 155) { velocityMMps = 170 + (i - 140) * 4; pullCN = 600; }
  else if (i > 155) { velocityMMps = 230; pullCN = 500; }
  return { timeS: i * .1, pullCN, velocityMMps };
});
const multipleFastTrace = M.packTrace({ regularSamples: multipleFastSamples, breakaway: { timeMs: 2000, measuredPullCN: 600, measuredVelocityMMps: 4, preBreakPeakGridIndex: 19 } });
const multipleFastQuality = M.assessTrial(multipleFastTrace);
assert.equal(multipleFastQuality.valid, true, "trial acceptance considers any separated slow/fast candidate pair, not only the first pair");

const rngLow = { next: () => .25 }; const rngHigh = { next: () => .75 };
const nearRange = { ...M.createMeasurementState(scenario), forceFilteredN: 11.94 };
const nearLow = M.captureSample(nearRange, physical, scenario, { timeS: 0, rng: rngLow, velocityRng: rngLow }).state;
const nearHigh = M.captureSample(nearRange, physical, scenario, { timeS: 0, rng: rngHigh, velocityRng: rngHigh }).state;
assert.equal(nearLow.overrange, nearHigh.overrange, "random sensor draw cannot decide range validity");
assert.ok(M.FORCE_SENSOR_NOISE_MAX_ABS_N >= .045 && M.VELOCITY_NOISE_MAX_ABS_MPS >= .0075);
assert.ok(Number.isFinite(before.forceN));
assert.throws(() => M.unpackTrace({ ...trace, forceVelocityBase64: "bad" }), /trace|base64/);
console.log("Static/kinetic friction measurement checks passed");
