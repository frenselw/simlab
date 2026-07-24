"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Visuals = require("./scene-visuals.js");

assert.equal(Visuals.worldToScreen(12, 10, 100, 5), 110);
assert.equal(Visuals.roadY(10, Levels.LEVELS[0], 200, 5), 200);
assert(Visuals.roadY(30, Levels.LEVELS[3], 200, 5) < 200, "uphill rises on screen");
assert.deepEqual(Visuals.backgroundAppearance("far", 7, 3), Visuals.backgroundAppearance("far", 7, 3));
assert.deepEqual(Visuals.backgroundAppearance("roadside", -4, 11), Visuals.backgroundAppearance("roadside", -4, 11));
assert(Visuals.visibleBackgroundCells("far", 20, 6, 390).length > 1);
assert(Visuals.visibleBackgroundCells("roadside", 20, 6, 390).length >
  Visuals.visibleBackgroundCells("far", 20, 6, 390).length, "near roadside scenery is denser than the far layer");
assert.throws(() => Visuals.backgroundAppearance("unknown", 0), /Invalid background cell/);
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

const longRun = Array.from({ length: 1201 }, (_, index) => ({
  t: index * .05, x: index * .15, v: 5 + index * .0005, a: .01
}));
const lateWindow = Visuals.graphWindow(longRun, 60, 12);
assert.equal(lateWindow.startTime, 48);
assert.equal(lateWindow.endTime, 60);
assert(lateWindow.samples.length > 200 && lateWindow.samples.length <= 242);
const latePoints = Visuals.graphPoints(lateWindow.samples, "vt", rect, zone, lateWindow.startTime);
assert(latePoints.every((point) => point.x >= rect.x && point.x <= rect.x + rect.width),
  "all samples in a legal max-ticks run stay inside the fixed sliding graph window");
assert.equal(latePoints.at(-1).x, rect.x + rect.width, "the current cursor remains visible at the right edge");
const middleWindow = Visuals.graphWindow(longRun, 24, 12);
const middlePoints = Visuals.graphPoints(middleWindow.samples, "vt", rect, zone, middleWindow.startTime);
const middleSlope = (middlePoints.at(-1).y - middlePoints[0].y) / (middlePoints.at(-1).x - middlePoints[0].x);
const lateSlope = (latePoints.at(-1).y - latePoints[0].y) / (latePoints.at(-1).x - latePoints[0].x);
assert(Math.abs(middleSlope - lateSlope) < 1e-12,
  "panning the fixed window preserves the pixel slope of identical physical acceleration");
const middleXt = Visuals.graphPoints(middleWindow.samples, "xt", rect, { ...zone, end: 200 }, middleWindow.startTime);
const lateXt = Visuals.graphPoints(lateWindow.samples, "xt", rect, { ...zone, end: 200 }, lateWindow.startTime);
assert(Math.abs(middleXt[0].y - (rect.y + rect.height - middleWindow.samples[0].x / 200 * rect.height)) < 1e-12);
assert(Math.abs(lateXt[0].y - (rect.y + rect.height - lateWindow.samples[0].x / 200 * rect.height)) < 1e-12);
assert(lateXt[0].y < middleXt[0].y,
  "x–t vertical position remains referenced to the zone entrance while only the time axis pans");
const earlyWindow = Visuals.graphWindow(longRun, 6, 12);
assert.equal(earlyWindow.startTime, 0, "the graph does not pan before its fixed twelve-second span is filled");

const uphill = Levels.LEVELS[3];
assert.equal(Visuals.visualSlopeAt(uphill, 30), 4);
assert(Visuals.visualSlopeAt(uphill, 54.5) < 4 && Visuals.visualSlopeAt(uphill, 54.5) > 0,
  "car pitch eases into a road-angle boundary without changing physics");

console.log("Kinematics driving visual helper tests passed");
