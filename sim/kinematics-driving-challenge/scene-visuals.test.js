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
const points = Visuals.graphPoints([{ t: 0, x: 0, v: 5 }, { t: 1, x: 6, v: 7 }], "vt", { x: 0, y: 0, width: 100, height: 100 }, { start: 0, end: 10, graphVelocitySpan: 20, graphTimeSpan: 12 });
assert.equal(points.length, 2);
assert(points[1].x > points[0].x && points[1].y < points[0].y);

const rect = { x: 0, y: 0, width: 240, height: 120 };
const zone = { start: 0, end: 100, graphVelocitySpan: 20, graphTimeSpan: 12 };
const twoSeconds = Visuals.graphPoints(
  [{ t: 0, x: 0, v: 5 }, { t: 2, x: 12, v: 7 }],
  "vt", rect, zone
);
const fourSeconds = Visuals.graphPoints(
  [{ t: 0, x: 0, v: 5 }, { t: 4, x: 32, v: 9 }],
  "vt", rect, zone
);
assert.equal(twoSeconds.at(-1).x, 40, "a two-second partial trace occupies one sixth of the fixed time axis");
assert.equal(fourSeconds.at(-1).x, 80, "a four-second partial trace occupies one third of the same axis");
const shortPixelSlope = (twoSeconds[1].y - twoSeconds[0].y) / (twoSeconds[1].x - twoSeconds[0].x);
const longPixelSlope = (fourSeconds[1].y - fourSeconds[0].y) / (fourSeconds[1].x - fourSeconds[0].x);
assert.equal(shortPixelSlope, longPixelSlope, "equal physical acceleration keeps the same visual slope");

const uphill = Levels.LEVELS[3];
assert.equal(Visuals.visualSlopeAt(uphill, 30), 4);
assert(Visuals.visualSlopeAt(uphill, 54.5) < 4 && Visuals.visualSlopeAt(uphill, 54.5) > 0,
  "car pitch eases into a road-angle boundary without changing physics");

console.log("Kinematics driving visual helper tests passed");
