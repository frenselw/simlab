"use strict";

const assert = require("node:assert/strict");
const Scoring = require("./scoring.js");

function synthetic(target, velocities, points = 5, span = 20) {
  const samples = velocities.map((v, index) => ({ t: index * .05, x: index * .5, v }));
  const zone = { id: "z", start: 0, end: samples.at(-1).x, target, points, graphVelocitySpan: span };
  return { run: { samples, state: { terminal: "complete" } }, zone };
}

assert.equal(Scoring.fullThenFade(.08, .08, .16), 1);
assert(Scoring.fullThenFade(.0801, .08, .16) < 1);
assert.equal(Scoring.riseScore(.02), 0);
assert.equal(Scoring.riseScore(.10), 1);

const times = Array.from({ length: 80 }, (_, index) => index);
let fixture = synthetic("uniform", times.map(() => 8), 15);
assert.equal(Scoring.scoreZone(fixture.run, fixture.zone).points, 15);
fixture = synthetic("accelerating", times.map((index) => 4 + index * .05), 20);
assert.equal(Scoring.scoreZone(fixture.run, fixture.zone).points, 20);
fixture = synthetic("decelerating", times.map((index) => 12 - index * .05), 20);
assert.equal(Scoring.scoreZone(fixture.run, fixture.zone).points, 20);
fixture = synthetic("accelerating", times.map((index) => 8 + Math.sin(index / 4)), 20);
assert(Scoring.scoreZone(fixture.run, fixture.zone).points < 20, "curved/nonlinear speed loses credit");
fixture = synthetic("accelerating", times.map((index) => 8 - index * .03), 20);
assert(Scoring.scoreZone(fixture.run, fixture.zone).points <= 5.01, "wrong direction cannot gain linearity credit");

const worked = .25 * 1 + .25 * .75 + .5 * .8;
assert.equal(worked, .8375);
assert.equal(Scoring.checkpointPoints({ viewedXt: true, viewedVt: true, answerId: "vt-linear" }), 10);
assert.equal(Scoring.checkpointPoints({ viewedXt: true, viewedVt: false, answerId: "vt-linear" }), 0);
assert.equal(Scoring.checkpointPoints({ viewedXt: true, viewedVt: true, answerId: "xt-curvature" }), 0);

console.log("Kinematics driving scoring tests passed");
