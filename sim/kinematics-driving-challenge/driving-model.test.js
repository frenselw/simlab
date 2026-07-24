"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");

assert.equal(Model.CONTROL_LABELS.length, 7);
assert(Model.accelerationFor(8, 0, 3) > Model.accelerationFor(8, 0, 2));
assert(Model.accelerationFor(8, 0, 2) > Model.accelerationFor(8, 0, 1));
assert(Model.accelerationFor(8, 0, 1) > Model.accelerationFor(8, 0, 0));
assert(Model.accelerationFor(8, 0, 0) > Model.accelerationFor(8, 0, 4));
assert(Model.accelerationFor(8, 0, 4) > Model.accelerationFor(8, 0, 5));
assert(Model.accelerationFor(8, 0, 5) > Model.accelerationFor(8, 0, 6));
assert.equal(Model.accelerationFor(8, 0, 0), -Model.resistanceAcceleration(8));
assert(Math.abs(Model.accelerationFor(8, 0, 1)) < 1e-12,
  "light throttle balances resistance at the level-1 entry speed");
assert(Math.abs(Model.accelerationFor(4, 0, 2) - Model.accelerationFor(12, 0, 2)) < 1e-12,
  "the tuned medium throttle produces fixed acceleration");
assert(Model.accelerationFor(12, 0, 3) > Model.accelerationFor(4, 0, 3),
  "full throttle produces increasing acceleration and a curved v–t trace");
assert(Model.accelerationFor(4, 0, 1) > Model.accelerationFor(12, 0, 1),
  "light throttle approaches its equilibrium speed instead of producing uniform acceleration");
assert(Model.accelerationFor(8, -4, 0) > Model.accelerationFor(8, 0, 0));
assert(Model.accelerationFor(8, 0, 0) > Model.accelerationFor(8, 4, 0));
assert.equal(Model.accelerationFor(0, 0, 6), 0, "a stopped car does not reverse under braking");

const level = Levels.LEVELS[0];
const controls = Array(100).fill(1);
const runA = Model.replay(level, controls);
const runB = Model.replay(level, controls);
assert.deepEqual(runA, runB, "same control stream is deterministic");
assert(runA.samples.every((sample) => sample.v >= 0 && Number.isFinite(sample.x)));
assert.equal(runA.samples.length, controls.length + 1);
assert.equal(Model.replay(level, [7]), null);
assert.equal(Model.isTerminalRun(level, [1]), false);
const queued = [
  { timestamp: 100, sequence: 0, code: 2 },
  { timestamp: 100, sequence: 1, code: 4 },
  { timestamp: 160, sequence: 2, code: 0 }
];
const firstBoundary = Model.consumeInputTransitions(queued, 120, 0);
assert.equal(firstBoundary.code, 4, "same-timestamp transitions apply in sequence order");
assert.equal(firstBoundary.remaining.length, 1);
assert.equal(Model.consumeInputTransitions(firstBoundary.remaining, 170, firstBoundary.code).code, 0);

const boundaryLevel = {
  id: "boundary-fixture", initialSpeed: 10, maxTicks: 20, routeLength: 2,
  segments: [
    { id: "before", start: 0, end: 0.3, slopeDeg: 0, target: "transition", points: 0 },
    { id: "after", start: 0.3, end: 2, slopeDeg: 4, target: "transition", points: 0 }
  ]
};
const beforeAcceleration = Model.accelerationFor(boundaryLevel.initialSpeed, 0, 0);
const crossing = Model.crossingDuration(boundaryLevel.initialSpeed, beforeAcceleration, 0.3, Model.TICK_S);
assert(crossing > 0 && crossing < Model.TICK_S);
assert(Math.abs(boundaryLevel.initialSpeed * crossing + .5 * beforeAcceleration * crossing ** 2 - .3) < 1e-10);
const split = Model.tick(boundaryLevel, Model.initialState(boundaryLevel), 0);
assert.equal(split.pieces.length, 2);
assert.equal(split.pieces[0].segmentId, "before");
assert.equal(split.pieces[1].segmentId, "after");
assert.equal(split.pieces[0].endX, .3);
assert.equal(split.pieces[1].startX, .3);
assert(Math.abs(split.pieces[0].duration + split.pieces[1].duration - Model.TICK_S) < 1e-12);
const boundaryReplay = Model.replay(boundaryLevel, [0]);
assert.equal(boundaryReplay.samples.length, 3, "replay preserves an exact boundary evidence sample");
assert.equal(boundaryReplay.samples[1].x, .3);
assert.equal(boundaryReplay.samples[1].segmentId, "before");
assert.equal(boundaryReplay.samples[2].segmentId, "after");
assert.deepEqual(boundaryReplay, Model.replay(boundaryLevel, [0]), "split integration remains deterministic");

let state = Model.initialState(level);
for (let index = 0; index < level.maxTicks && !state.terminal; index += 1) state = Model.tick(level, state, 1);
assert(["complete", "max-ticks"].includes(state.terminal));
assert.equal(Model.wheelAngle(10), Model.wheelAngle(10));
assert(Model.wheelAngle(.58 * Math.PI / 2) > 0, "positive forward travel rotates the wheel clockwise in Canvas coordinates");
assert.throws(() => Model.wheelAngle(1, 0), /Invalid wheel geometry/);
assert.match(Model.qualitativeMotion(runA.samples), /速度|車輛/);

console.log("Kinematics driving model tests passed");
