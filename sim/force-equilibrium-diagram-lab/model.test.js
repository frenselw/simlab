"use strict";
const assert = require("node:assert/strict");
const M = require("./model.js"), Scene = require("./scene.js"), N = require("./notation.js");
let a = M.change([], { type: "add", kind: 3 }); assert.deepEqual(a, [[3, null, null]]);
a = M.change(a, { type: "place", index: 0, angle: 360.04, length: 1 }); assert.deepEqual(a, [[3, 0, 1]]);
assert.equal(M.angleDelta(359, 1), 2);
assert.equal(M.snap(5, [0, 90, 180, 270], "touch").angle, 0);
assert.equal(M.snap(8, [0, 90], "touch", 0).angle, 0);
assert.equal(M.snap(9.1, [0, 90], "touch", 0).target, null);
assert.equal(M.snap(5, [0, 90], "mouse").target, null);
for (const [w, h] of [[320, 208], [390, 220], [520, 400], [980, 620]]) {
  const l = M.layout(w, h);
  for (let angle = 0; angle < 360; angle += .5) {
    for (const len of [1, 500, 1000]) {
      const e = M.endpoint([0, angle * 10, len], l);
      assert.ok(e.x >= 58 - 1e-7 && e.x <= w - 58 + 1e-7);
      assert.ok(e.y >= 54 - 1e-7 && e.y <= h - 42 + 1e-7);
    }
  }
  assert.equal(M.fromPoint(0, l.center, l, [0, 90], "touch"), null);
  const p = { x: l.center.x - 60, y: l.center.y };
  const weight = M.fromPoint(0, p, l, [0, 90, 180], "touch"), tension = M.fromPoint(3, p, l, [0, 90, 180], "touch");
  assert.equal(weight.record[1], 1800); assert.equal(tension.record[1], weight.record[1], "snap is type-blind");
}
const history = new M.History(); history.record(0, []);
assert.deepEqual(history.apply(0, a), []); assert.deepEqual(history.apply(0, [], true), a);
for (const r of [[1, null, 200], [5, 0, 500], [0, NaN, 1], [0, 3600, 1], [0, 0, 0]]) assert.equal(M.validRecord(r), false);
assert.equal(M.validAnswer([[0, null, null], [0, null, null], [0, null, null], [0, null, null]]), false);
for (const fps of [30, 60, 120]) {
  let elapsed = 0; for (let i = 0; i < 3 * fps; i++) elapsed += 1 / fps;
  assert.ok(Math.abs(M.backgroundOffset(elapsed, 1) - M.backgroundOffset(3, 1)) < 1e-9);
}
assert.ok(M.backgroundOffset(.5, 1) > M.backgroundOffset(1, 1));
assert.match(Scene.arrowPath({ x: 50, y: 50 }, { x: 90, y: 60 }), /L90\.00,60\.00/);
assert.match(Scene.arrowPath({ x: 50, y: 50 }, { x: 90, y: 60 }, 1.8), /L90\.00,60\.00/, "enlarged arrows keep the exact interactive endpoint");
assert.equal(N.html([[3, 400, 500], [3, 1300, 500]], 1), "<var>T</var><sub>2</sub>");
console.log("equilibrium model: geometry, type-blind snap, history, notation and frame-rate invariance passed");
