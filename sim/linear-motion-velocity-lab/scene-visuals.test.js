"use strict";

const assert = require("assert");
const Visuals = require("./scene-visuals.js");

assert.strictEqual(Visuals.wheelAngle(0), 0);
assert(Math.abs(Visuals.wheelAngle(Visuals.WHEEL_RADIUS_METRES * Math.PI) - Math.PI) < 1e-12, "wheel angle follows travelled distance");
assert(Visuals.wheelAngle(Visuals.WHEEL_RADIUS_METRES * Math.PI / 2) > 0, "positive rightward travel rotates clockwise in Canvas coordinates");
assert.strictEqual(Visuals.wheelAngle(123.456), Visuals.wheelAngle(123.456), "restored world position recreates the same wheel angle");
assert.throws(() => Visuals.wheelAngle(1, 0), /Invalid wheel geometry/);
for (const pixelsPerMetre of [16, 20, 28]) {
  const renderedRadius = 15 * Visuals.carScale(pixelsPerMetre);
  const backgroundTravelPerTurn = Visuals.TAU * Visuals.WHEEL_RADIUS_METRES * pixelsPerMetre;
  assert(Math.abs(backgroundTravelPerTurn - Visuals.TAU * renderedRadius) < 1e-12, "one wheel turn exactly matches one rendered circumference");
}

for (const cellId of [-20, -1, 0, 1, 20, 5_000_000_000]) {
  assert.deepStrictEqual(Visuals.landmarkAppearance(cellId), Visuals.landmarkAppearance(cellId), `cell ${cellId} has a stable identity`);
}
for (let cellId = -10000; cellId <= 10000; cellId += 1) {
  const appearance = Visuals.landmarkAppearance(cellId);
  if (appearance.type === "building") {
    const lastWindowBottom = 8 + (appearance.windowRows - 1) * 11 + 6;
    assert(lastWindowBottom <= appearance.height, `cell ${cellId} windows stay inside the building`);
  }
}
const beforeBoundary = Visuals.visibleLandmarkCells(17.99, 20, 600);
const afterBoundary = Visuals.visibleLandmarkCells(18.01, 20, 600);
assert(beforeBoundary.some((cell) => afterBoundary.includes(cell)), "visible cells persist across a world-cell boundary");
for (const cell of beforeBoundary.filter((item) => afterBoundary.includes(item))) {
  assert.deepStrictEqual(Visuals.landmarkAppearance(cell), Visuals.landmarkAppearance(cell), "persistent cells keep their appearance");
}
assert(Visuals.visibleLandmarkCells(100, 20, 320).length < Visuals.visibleLandmarkCells(100, 20, 1200).length, "viewport width controls buffered cell count");

console.log("Linear motion scene visual tests passed");
