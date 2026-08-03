"use strict";

const assert = require("node:assert/strict");
const A = require("./animation.js");

let step = A.stepDamped(0, 0, 0.1, 0.016);
assert.ok(step.x > 0 && step.x < 0.1);
assert.ok(Number.isFinite(step.velocity));

const frames = [];
const settled = [];
const queue = [];
let reduced = false;
const animator = A.createAnimator({
  requestFrame(callback) { queue.push(callback); return queue.length; },
  cancelFrame() {},
  now: () => 0,
  reducedMotion: () => reduced
});
animator.start({ from: 0, equilibrium: 0.1, onFrame: (x) => frames.push(x), onSettled: (state) => settled.push(state) });
let time = 16;
for (let i = 0; i < 1000 && !settled.length; i += 1) {
  const callback = queue.shift();
  if (!callback) break;
  callback(time);
  time += 16;
}
assert.ok(settled.length === 1);
assert.equal(settled[0].x, 0.1);
assert.equal(animator.getState().settled, true);
assert.ok(frames.length > 2);

reduced = true;
let immediate = null;
animator.start({ from: 0, equilibrium: 0.2, onFrame: (x) => { immediate = x; } });
assert.equal(immediate, 0.2);
assert.equal(animator.getState().settled, true);

const token = animator.start({ from: 0, equilibrium: 0.2 });
animator.cancel();
assert.equal(animator.isCurrent(token), false);

console.log("Hooke's law animation checks passed");
