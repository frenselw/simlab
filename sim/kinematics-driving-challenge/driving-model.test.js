"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");

assert.equal(Model.PHYSICS_VERSION, 6);
assert.equal(Model.CONTROL_LABELS.length, 7);
assert(Model.accelerationFor(8, 0, 3) > Model.accelerationFor(8, 0, 2));
assert(Model.accelerationFor(8, 0, 2) > Model.accelerationFor(8, 0, 1));
assert(Model.accelerationFor(8, 0, 1) > Model.accelerationFor(8, 0, 0));
assert(Model.accelerationFor(8, 0, 0) > Model.accelerationFor(8, 0, 4));
assert(Model.accelerationFor(8, 0, 4) > Model.accelerationFor(8, 0, 5));
assert(Model.accelerationFor(8, 0, 5) > Model.accelerationFor(8, 0, 6));
for (let step = 0; step <= Model.MAX_SPEED * 10; step += 1) {
  const speed = step / 10;
  const strongestToWeakest = [3, 2, 1, 0, 4, 5, 6]
    .map((code) => Model.flatRoadAcceleration(speed, code));
  for (let index = 1; index < strongestToWeakest.length; index += 1) {
    assert(strongestToWeakest[index - 1] > strongestToWeakest[index],
      `all flat-road controls retain their learner-facing order at ${speed.toFixed(1)} m/s`);
  }
}
assert.equal(Model.accelerationFor(8, 0, 0), -Model.resistanceAcceleration(8));
assert(Math.abs(Model.accelerationFor(8, 0, 1)) < 1e-12,
  "light throttle balances resistance at the level-1 entry speed");
assert(Math.abs(Model.accelerationFor(4, 0, 2) - Model.accelerationFor(12, 0, 2)) < 1e-12,
  "the tuned medium throttle produces fixed acceleration");
assert.equal(Model.accelerationFor(0, 0, 2), Model.MEDIUM_THROTTLE_NET_ACCELERATION);
assert.equal(Model.accelerationFor(0, 0, 3), Model.FULL_THROTTLE_BASE_NET_ACCELERATION);
for (const speed of [0.1, 4, 12, 16, Model.MAX_SPEED]) {
  assert(Math.abs(Model.accelerationFor(speed, 0, 5) + Model.MEDIUM_BRAKE_NET_DECELERATION) < 1e-12,
    `the tuned medium brake keeps fixed net deceleration at ${speed} m/s`);
  assert.equal(Model.flatRoadAcceleration(speed, 5), Model.accelerationFor(speed, 0, 5),
    "the exported flat-road response is the same authoritative model used by replay");
}
assert(Math.abs(
  Model.accelerationFor(16, 4, 5) -
  (-Model.MEDIUM_BRAKE_NET_DECELERATION - Model.slopeAcceleration(4))
) < 1e-12, "road slope is applied after the calibrated medium-brake response");
assert(Math.abs(Model.accelerationFor(8, -4.34, 4)) < 1e-12,
  "light brake balances the calibrated downhill slope at the uniform speed");
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
const unsortedQueue = [
  { timestamp: 160, sequence: 2, code: 0 },
  { timestamp: 100, sequence: 1, code: 4 },
  { timestamp: 100, sequence: 0, code: 2 }
];
const orderedBoundary = Model.consumeInputTransitions(unsortedQueue, 120, 0);
assert.equal(orderedBoundary.code, 4, "queue order cannot override timestamp and sequence ordering");
assert.deepEqual(orderedBoundary.remaining, [{ timestamp: 160, sequence: 2, code: 0 }]);
assert.deepEqual(unsortedQueue.map((transition) => transition.sequence), [2, 1, 0],
  "consuming transitions does not mutate the producer queue");
assert.throws(
  () => Model.consumeInputTransitions([
    { timestamp: 100, sequence: 0, code: 2 },
    { timestamp: Number.NaN, sequence: 1, code: 4 }
  ], 100, 0),
  /Invalid input transition/,
  "future transitions are validated before any due transition is applied"
);
assert.throws(
  () => Model.consumeInputTransitions([
    { timestamp: 100, sequence: 0, code: 2 },
    { timestamp: 120, sequence: 0, code: 4 }
  ], 200, 0),
  /Invalid input transition/,
  "sequence identifiers must be unique"
);
assert.throws(
  () => Model.consumeInputTransitions([{ timestamp: 100, sequence: -1, code: 2 }], 100, 0),
  /Invalid input transition/
);
assert.throws(
  () => Model.consumeInputTransitions([{ timestamp: -1, sequence: 0, code: 2 }], 100, 0),
  /Invalid input transition/
);
assert.throws(() => Model.consumeInputTransitions([], -1, 0), /Invalid input queue/);

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

const nearBoundaryStop = {
  tick: 805, t: 40.25, x: 149.99858635289, v: .0625, a: .6,
  stoppedTicks: 0, terminal: null
};
const nearBoundaryStopped = Model.tick(Levels.levelById("level5"), nearBoundaryStop, 6);
assert.notEqual(nearBoundaryStopped.terminal, "technical",
  "stopping inside a tick just before a boundary is a legal finite state");
assert.equal(nearBoundaryStopped.v, 0);
assert(nearBoundaryStopped.x < 150,
  "stop-clamped integration does not invent enough distance to cross the boundary");
assert.equal(nearBoundaryStopped.tick, nearBoundaryStop.tick + 1);

for (const candidateLevel of Levels.LEVELS) {
  for (const boundary of candidateLevel.segments.slice(0, -1).map((segment) => segment.end)) {
    for (const speed of [.001, .01, .05, .1, .5, 1, 4, 8, 12, 19.9]) {
      const segment = Levels.segmentAt(candidateLevel, boundary - 1e-7);
      for (let code = 0; code <= 6; code += 1) {
        const acceleration = Model.accelerationFor(speed, segment.slopeDeg, code);
        const stoppingDistance = acceleration < 0 ? speed * speed / (-2 * acceleration) : 0;
        const distances = [1e-7, .001];
        if (stoppingDistance > 0) distances.push(stoppingDistance * .9, stoppingDistance * 1.1);
        for (const distance of distances) {
          const source = {
            tick: 10, t: .5, x: Math.max(segment.start, boundary - distance),
            v: speed, a: 0, stoppedTicks: 0, terminal: null
          };
          const next = Model.tick(candidateLevel, source, code);
          assert.notEqual(next.terminal, "technical",
            `${candidateLevel.id} finite boundary state remains legal at x=${source.x}, v=${speed}, code=${code}`);
          assert([next.x, next.v, next.a].every(Number.isFinite));
          assert(next.x >= source.x && next.x <= candidateLevel.routeLength);
          assert(next.v >= 0 && next.v <= Model.MAX_SPEED);
        }
      }
    }
  }
}

let state = Model.initialState(level);
for (let index = 0; index < level.maxTicks && !state.terminal; index += 1) state = Model.tick(level, state, 1);
assert(["complete", "max-ticks"].includes(state.terminal));
assert.equal(Model.wheelAngle(10), Model.wheelAngle(10));
assert(Model.wheelAngle(.58 * Math.PI / 2) > 0, "positive forward travel rotates the wheel clockwise in Canvas coordinates");
assert.throws(() => Model.wheelAngle(1, 0), /Invalid wheel geometry/);
assert.match(Model.qualitativeMotion(runA.samples), /速度|車輛/);

console.log("Kinematics driving model tests passed");
