"use strict";
const assert = require("assert");
const Model = require("./model.js");

for (const frequency of Model.FREQUENCIES) {
  assert.strictEqual(Model.deltaT(frequency), 1 / frequency);
  const points = Model.trajectory(frequency);
  assert.strictEqual(points.length, 5);
  assert.deepStrictEqual(points.map((point) => Math.round(point.timeS / points[1].timeS)).slice(1), [1, 2, 3, 4]);
  const totals = points.slice(1).map((point) => point.displacementM / points[1].displacementM);
  assert.deepStrictEqual(totals.map(Math.round), [1, 4, 9, 16]);
  const gaps = [1, 2, 3, 4].map((index) => Model.intervalDisplacement(frequency, index));
  assert.deepStrictEqual(gaps.map((value) => Math.round(value / gaps[0])), [1, 3, 5, 7]);
}
assert.deepStrictEqual(Model.FREQUENCIES, [4, 5, 6, 8]);
assert.deepStrictEqual(Model.ASSIGNABLE_FREQUENCIES, [4, 5, 8]);
assert.deepStrictEqual([4, 5, 6, 8].map(Model.cameraMax), [5.5, 3.5, 2.5, 1.5]);
for (const frequency of Model.FREQUENCIES) {
  assert.strictEqual(Model.metersToPhotoCm(frequency, Model.cameraMax(frequency)), 5);
  assert.strictEqual(Model.photoCmToMeters(frequency, 5), Model.cameraMax(frequency));
  for (const meters of [0, Model.displacementAt(frequency, 1), Model.displacementAt(frequency, 4)]) {
    assert.ok(Math.abs(Model.photoCmToMeters(frequency, Model.metersToPhotoCm(frequency, meters)) - meters) < 1e-12);
  }
}
assert.ok(Number.isNaN(Model.metersToPhotoCm(7, 1)));
assert.ok(Number.isNaN(Model.photoCmToMeters(5, Infinity)));
assert.strictEqual(Model.displacementAt(4, 4), 5);
assert.strictEqual(Model.displacementAt(5, 4), 3.2);
assert.ok(Math.abs(Model.displacementAt(6, 4) - 2.2222222222222223) < 1e-12);
assert.strictEqual(Model.deltaT(8), .125);
assert.strictEqual(Model.displacementAt(8, 4), 1.25);
assert.strictEqual(Model.geometry(5, 440).metersToY(1), Model.geometry(5, 800).metersToY(1) * 0 + Model.geometry(5, 440).metersToY(1));
assert.strictEqual(Model.geometry(5, 440, 20, 20).yToMeters(Model.geometry(5, 440, 20, 20).metersToY(2.4)), 2.4);
for (const value of [0, 3, 7, NaN, Infinity, "5"]) assert.strictEqual(Model.validFrequency(value), false);
assert.throws(() => Model.deltaT(3));
console.log("free-fall model tests passed");
