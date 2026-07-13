"use strict";

const assert = require("assert");
const createAnimationLoop = require("./animation-loop.js");

let now = 1000;
let nextId = 1;
const pending = new Map();
const elapsed = [];
let playing = true;
let hidden = false;
let draws = 0;
const loop = createAnimationLoop({
  requestFrame(callback) {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  },
  cancelFrame(id) { pending.delete(id); },
  now: () => now,
  onFrame(value) {
    elapsed.push(value);
    draws += 1;
    return playing && !hidden;
  }
});

function sync() {
  if (playing && !hidden) loop.start();
  else loop.stop();
}

function resize() {
  draws += 1;
}

function frame(milliseconds) {
  now += milliseconds;
  const callback = pending.values().next().value;
  pending.clear();
  callback(now);
}

loop.start();
loop.start();
assert.equal(pending.size, 1, "playing must have exactly one pending frame");
frame(20);
assert.equal(elapsed[0], 0.02);
assert.equal(pending.size, 1);

playing = false;
sync();
assert.equal(pending.size, 0, "pause must cancel the pending frame");
resize();
assert.equal(draws, 2, "resize redraws once without starting a loop");
playing = true;
hidden = true;
sync();
assert.equal(pending.size, 0, "hidden must remain stopped");
now += 5000;
hidden = false;
sync();
assert.equal(pending.size, 1, "visible playing state must resume");
frame(10);
assert.equal(elapsed.at(-1), 0.01, "resume must reset the time baseline");

playing = false;
frame(20);
assert.equal(pending.size, 0, "completion must stop scheduling frames");
loop.stop();

console.log("reference-frame animation scheduler checks passed");
