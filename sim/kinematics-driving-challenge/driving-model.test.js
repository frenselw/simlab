"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");

assert(Model.accelerationFor(8, 0, 3) > Model.accelerationFor(8, 0, 2));
assert(Model.accelerationFor(8, 0, 2) > Model.accelerationFor(8, 0, 1));
assert(Model.accelerationFor(8, 0, 1) > Model.accelerationFor(8, 0, 0));
assert(Model.accelerationFor(8, 0, 0) > Model.accelerationFor(8, 0, 4));
assert(Model.accelerationFor(8, -4, 0) > Model.accelerationFor(8, 0, 0));
assert(Model.accelerationFor(8, 0, 0) > Model.accelerationFor(8, 4, 0));
assert.equal(Model.accelerationFor(0, 0, 0), 0, "static hold prevents reverse motion");

const level = Levels.LEVELS[0];
const controls = Array(200).fill(1);
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

let state = Model.initialState(level);
for (let index = 0; index < level.maxTicks && !state.terminal; index += 1) state = Model.tick(level, state, 1);
assert(["complete", "max-ticks"].includes(state.terminal));
assert.equal(Model.wheelAngle(10), Model.wheelAngle(10));
assert.equal(Model.qualitativeMotion(runA.samples).startsWith("速度"), true);

console.log("Kinematics driving model tests passed");
