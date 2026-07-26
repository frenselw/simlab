"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");
const Visuals = require("./scene-visuals.js");

assert.equal(Visuals.worldToScreen(12, 10, 100, 5), 110);
assert.equal(Visuals.roadY(10, Levels.LEVELS[0], 200, 5), 200);
assert(Visuals.roadY(30, Levels.LEVELS[3], 200, 5) < 200, "uphill rises on screen");
assert.deepEqual(Visuals.backgroundAppearance("far", 7, 3), Visuals.backgroundAppearance("far", 7, 3));
assert.deepEqual(Visuals.backgroundAppearance("roadside", -4, 11), Visuals.backgroundAppearance("roadside", -4, 11));
assert(Visuals.visibleBackgroundCells("far", 20, 6, 390).length > 1);
assert(Visuals.visibleBackgroundCells("roadside", 20, 6, 390).length >
  Visuals.visibleBackgroundCells("far", 20, 6, 390).length, "near roadside scenery is denser than the far layer");
assert.deepEqual(Visuals.boundaryMarkers(Levels.LEVELS[4]), [
  { position: 70, target: "accelerating" },
  { position: 150, target: "decelerating" },
  { position: 187, target: "uniform" }
]);
assert.equal(
  Visuals.stageTargetLabel(Levels.LEVELS[4], Levels.LEVELS[4].segments[1]),
  "保持勻加速"
);
assert.equal(
  Visuals.stageTargetLabel(Levels.LEVELS[4], Levels.LEVELS[4].segments[2]),
  "保持勻減速"
);
assert.throws(() => Visuals.backgroundAppearance("unknown", 0), /Invalid background cell/);
assert.equal(Visuals.targetLabel("accelerating"), "保持勻加速");
assert.equal(Visuals.graphShapeLabel(Array.from({ length: 20 }, (_, index) => ({ v: 5 + index * .2 }))), "圖線接近向上直線");
function fixedControlRun(levelId, code) {
  const level = Levels.levelById(levelId);
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    codes.push(code);
    run = Model.replay(level, codes);
  }
  return run;
}
const curvedRun = fixedControlRun("level2", 3);
assert.equal(
  Visuals.graphShapeLabel(curvedRun.samples),
  "圖線大致向上，但斜率有變化",
  "the canonical full-throttle curve is not announced as a straight line"
);
assert.equal(
  Visuals.graphShapeLabel(fixedControlRun("level2", 2).samples),
  "圖線接近向上直線",
  "the canonical constant-acceleration trace is still announced as straight"
);
assert.equal(
  Visuals.graphShapeLabel(fixedControlRun("level3", 5).samples),
  "圖線接近向下直線",
  "the canonical constant-deceleration trace is announced as straight"
);
assert.equal(
  Visuals.graphShapeLabel(fixedControlRun("level1", 1).samples, "xt"),
  "x–t 圖接近斜直線，斜率大致固定",
  "uniform motion has an x–t-specific straight-line description"
);
assert.equal(
  Visuals.graphShapeLabel(fixedControlRun("level2", 2).samples, "xt"),
  "x–t 圖愈來愈斜，斜率逐漸增加",
  "uniform acceleration is not described as a straight x–t graph"
);
assert.equal(
  Visuals.graphShapeLabel(fixedControlRun("level3", 5).samples, "xt"),
  "x–t 圖逐漸變平，斜率逐漸減少",
  "uniform deceleration describes the changing x–t slope"
);
assert.equal(
  Visuals.graphShapeLabel(Array.from({ length: 25 }, (_, index) => ({
    t: index * .05,
    v: 8 + Math.abs(index - 12) * .03
  }))),
  "圖線有明顯起伏，斜率不固定",
  "a trace with little net change but visible variation is not announced as horizontal"
);
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
assert.equal(lateWindow.startTime, 0);
assert.equal(lateWindow.endTime, 60);
assert.equal(lateWindow.duration, 96);
assert.equal(lateWindow.samples.length, longRun.length, "an expanding timeline retains the full trace");
const latePoints = Visuals.graphPoints(
  lateWindow.samples, "vt", rect, { ...zone, graphTimeSpan: lateWindow.duration }, lateWindow.startTime
);
assert(latePoints.every((point) => point.x >= rect.x && point.x <= rect.x + rect.width),
  "all samples in a legal max-ticks run stay inside the expanding graph timeline");
assert.equal(latePoints[0].x, rect.x, "the trace remains anchored at the original start");
const middleWindow = Visuals.graphWindow(longRun, 24, 12);
assert.equal(middleWindow.duration, 24);
assert.equal(middleWindow.samples[0].t, 0);
const middlePoints = Visuals.graphPoints(
  middleWindow.samples, "vt", rect, { ...zone, graphTimeSpan: middleWindow.duration }, middleWindow.startTime
);
const middleSlope = (middlePoints.at(-1).y - middlePoints[0].y) / (middlePoints.at(-1).x - middlePoints[0].x);
const lateSlope = (latePoints.at(-1).y - latePoints[0].y) / (latePoints.at(-1).x - latePoints[0].x);
assert(middleSlope < 0 && lateSlope < 0, "timeline expansion preserves the direction of an increasing v–t trace");
const lateXt = Visuals.graphPoints(
  lateWindow.samples, "xt", rect, { ...zone, end: 200, graphTimeSpan: lateWindow.duration }, lateWindow.startTime
);
assert.equal(lateXt[0].x, rect.x);
assert(Math.abs(lateXt[0].y - (rect.y + rect.height - longRun[0].x / 200 * rect.height)) < 1e-12);
const earlyWindow = Visuals.graphWindow(longRun, 6, 12);
assert.equal(earlyWindow.duration, 12, "the base time scale remains stable while the trace fits");
assert.equal(earlyWindow.samples[0].t, 0);

const uphill = Levels.LEVELS[3];
assert.equal(Visuals.visualSlopeAt(uphill, 30), 3.5);
assert.equal(Visuals.visualSlopeAt(uphill, 70), 3.5);
assert(Visuals.roadY(-10, uphill, 200, 5) > 200, "the uphill visual continues behind the route start");
assert(Visuals.roadY(uphill.routeLength + 10, uphill, 200, 5) <
  Visuals.roadY(uphill.routeLength, uphill, 200, 5), "the uphill visual continues beyond the finish");

console.log("Kinematics driving visual helper tests passed");
