"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Visuals = require("./scene-visuals.js");

assert.equal(Visuals.worldToScreen(12, 10, 100, 5), 110);
assert.equal(Visuals.roadY(10, Levels.LEVELS[0], 200, 5), 200);
assert(Visuals.roadY(30, Levels.LEVELS[3], 200, 5) < 200, "uphill rises on screen");
assert.deepEqual(Visuals.sceneryCell(7, 3), Visuals.sceneryCell(7, 3));
assert.equal(Visuals.targetLabel("accelerating"), "保持勻加速");
assert.equal(Visuals.graphShapeLabel(Array.from({ length: 20 }, (_, index) => ({ v: 5 + index * .2 }))), "圖線接近向上直線");
const points = Visuals.graphPoints([{ t: 0, x: 0, v: 5 }, { t: 1, x: 6, v: 7 }], "vt", { x: 0, y: 0, width: 100, height: 100 }, { start: 0, end: 10, graphVelocitySpan: 20 });
assert.equal(points.length, 2);
assert(points[1].x > points[0].x && points[1].y < points[0].y);

console.log("Kinematics driving visual helper tests passed");
