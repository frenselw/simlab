"use strict";
const assert = require("node:assert/strict");
const Animation = require("./animation.js");
const Model = require("./model.js");
const Persistence = require("./persistence.js");

function fakeClock() {
  let now = 0;
  let id = 0;
  const callbacks = new Map();
  return {
    now: () => now,
    requestFrame(callback) { callbacks.set(++id, callback); return id; },
    cancelFrame(frameId) { callbacks.delete(frameId); },
    advance(ms) {
      now += ms;
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(now));
    },
    takeStale() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      return pending;
    },
    pending: () => callbacks.size
  };
}

assert.equal(Model.freeFallDisplacement(0), 0);
assert.equal(Model.freeFallDisplacement(.5), 1.25);
assert.equal(Model.freeFallDisplacement(1), 5);
assert.throws(() => Model.freeFallDisplacement(-.1));
const equalSteps = [.2, .4, .6, .8].map(Model.freeFallDisplacement);
assert.ok(equalSteps[1] - equalSteps[0] < equalSteps[2] - equalSteps[1]);
assert.ok(equalSteps[2] - equalSteps[1] < equalSteps[3] - equalSteps[2]);

for (const frequency of Model.FREQUENCIES) {
  const clock = fakeClock();
  const stamps = [];
  let completes = 0;
  const controller = Animation.createController({ clock, onStamp: (stamp) => stamps.push(stamp), onComplete: () => completes += 1 });
  assert.equal(controller.startCapture(frequency), true);
  assert.deepEqual(stamps.map((stamp) => stamp.index), [0], `${frequency} Hz stamps P0 immediately`);
  assert.equal(controller.startCapture(frequency), false, `${frequency} Hz double activation is ignored`);
  for (let index = 1; index < 5; index += 1) clock.advance(1000 / frequency);
  assert.deepEqual(stamps.map((stamp) => stamp.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(stamps.map((stamp) => stamp.timeS), [0, 1, 2, 3, 4].map((index) => Model.timeAt(frequency, index)));
  assert.deepEqual(stamps.map((stamp) => stamp.displacementM), [0, 1, 2, 3, 4].map((index) => Model.displacementAt(frequency, index)));
  assert.equal(new Set(stamps.map((stamp) => stamp.index)).size, 5);
  assert.equal(controller.snapshot().mode, "static");
  assert.equal(controller.snapshot().liveBallM, null);
  assert.equal(completes, 1);
}

{
  const clock = fakeClock();
  const updates = [];
  const controller = Animation.createController({ clock, onUpdate: (view) => updates.push(view) });
  assert.equal(controller.startPreview(), true);
  clock.advance(250);
  clock.advance(250);
  const first = updates.find((view) => view.elapsedS === .25);
  const second = updates.find((view) => view.elapsedS === .5);
  assert.ok(first.liveBallM < second.liveBallM);
  controller.startPreview();
  assert.equal(controller.snapshot().liveBallM, 0, "replay restarts at release point");
}

{
  const clock = fakeClock();
  const stamps = [];
  const controller = Animation.createController({ clock, onStamp: (stamp) => stamps.push(stamp.index) });
  controller.startCapture(4);
  const stale = clock.takeStale();
  controller.cancel();
  stale.forEach((callback) => callback());
  assert.deepEqual(stamps, [0], "cancelled stale callback cannot add a stamp");
  assert.equal(controller.snapshot().mode, "idle");
}

{
  const clock = fakeClock();
  const controller = Animation.createController({ clock });
  controller.startPreview({ reducedMotion: true });
  assert.equal(clock.pending(), 0);
  assert.equal(controller.snapshot().mode, "preview-reduced");
  controller.startCapture(6, { reducedMotion: true });
  assert.equal(clock.pending(), 0);
  assert.equal(controller.snapshot().mode, "static");
  assert.equal(controller.snapshot().stamps.length, 5);
}

{
  const authoritative = Persistence.generate(Persistence.configuredState(5));
  const before = JSON.stringify(authoritative);
  const clock = fakeClock();
  const controller = Animation.createController({ clock });
  controller.startCapture(5);
  clock.advance(200);
  controller.startPreview();
  clock.advance(1000);
  assert.equal(JSON.stringify(authoritative), before, "capture and replay do not mutate authoritative learner state");
  assert.equal("animation" in Persistence.encode(authoritative), false);
  const restored = Persistence.decode(Persistence.encode(authoritative));
  assert.equal(restored.phase, "measure-total");
  assert.equal(restored.generated, true);
}

console.log("free-fall animation controller tests passed");
