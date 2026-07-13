"use strict";
const assert = require("assert");
const { create, change } = require("./draft-save.js");
let callback = null;
let scheduled = 0;
let saves = 0;
const timers = {
  setTimeout(fn) { callback = fn; scheduled += 1; return scheduled; },
  clearTimeout() { callback = null; }
};
const debounce = create(() => { saves += 1; }, 350, timers);
debounce.schedule();
debounce.schedule();
assert.equal(saves, 0);
assert.equal(scheduled, 2);
callback();
assert.equal(saves, 1, "repeated keydown produces one delayed save");
debounce.schedule();
assert.equal(debounce.flush(), true);
assert.equal(saves, 2, "pagehide-style flush saves the latest visible state");
assert.equal(debounce.flush(), false);
const geometry = { image: { x: 10 }, ray: { x: 20 } };
let changeSchedules = 0;
const scheduler = { schedule: () => { changeSchedules += 1; } };
change(() => { geometry.image.x += 8; }, scheduler);
change(() => { geometry.ray.x -= 8; }, scheduler);
assert.deepEqual(geometry, { image: { x: 18 }, ray: { x: 12 } });
assert.equal(changeSchedules, 2, "both image and ray keyboard mutations schedule persistence");
console.log("plane mirror draft debounce checks passed");
