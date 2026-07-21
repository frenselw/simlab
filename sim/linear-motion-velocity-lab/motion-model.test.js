"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");

assert.deepStrictEqual([0.005, 0.5, 5, 50, 500, 0].map(Model.format3), ["0.00500", "0.500", "5.00", "50.0", "500", "0.00"]);
assert.strictEqual(Model.format3(99.96), "100");
assert.strictEqual(Model.format3(1e-323), "--");
for (const value of ["5", "5.0", "5.00", "0", "0.0", "0.00", "0e-999", "05.00", "5e-1", "1.2E+3"]) assert(Model.normalizeInput(value), value);
for (const value of ["", "-1", "+1", "5 m", "5,0", "NaN", "Infinity", "1e999", "1e-323", "1e-324", String(Model.MAX_LEARNER_INPUT_VALUE + 1), "1e308", "1".repeat(Model.MAX_INPUT_LENGTH + 1)]) assert.strictEqual(Model.normalizeInput(value), null, value);
assert.strictEqual(Model.normalizeInput(" 5e-1 ").value, 0.5);
assert(Model.numericMatch(6.424999, 6.42));
assert(!Model.numericMatch(6.425001, 6.42));
assert(Model.numericMatch(0, 0));
assert(!Model.numericMatch(0.001, 0));

const first = Model.createAttempt(12345);
assert.deepStrictEqual(Model.createAttempt(12345), first, "same seed rebuilds the exact attempt");
const definitions = new Set();
const streams = new Set();
for (let seed = 0; seed < 100; seed += 1) {
  const definition = Model.createAttempt(seed);
  assert(Model.validateDefinition(definition));
  assert(definition.variableMinimumDuration >= 3 && definition.variableMinimumDuration <= 5);
  assert.strictEqual(definition.variableMinimumDuration * 4, Math.round(definition.variableMinimumDuration * 4));
  assert.strictEqual(definition.variable.streamVersion, Model.STREAM_VERSION);
  definitions.add(JSON.stringify([definition.uniform, definition.variableMinimumDuration, definition.instantTarget, definition.stoppedCheckpoint]));
  streams.add(JSON.stringify(Model.streamChunk(definition.variable, 3).map((segment) => [segment.duration, segment.v0, segment.v1])));
  const target = Model.targetSceneTime(definition);
  const rows = Model.analysisWindows(definition);
  const geometry = Model.analysisWindowGeometry(definition);
  assert.deepStrictEqual(rows.map((row) => row.duration), [2, 1, 0.5, 0.25]);
  assert(rows.every((row) => row.startTime < row.endTime && row.duration > 0));
  geometry.forEach((row) => {
    assert(Math.abs(Model.variablePosition(definition.variable, row.startTime) - row.startPosition) < 1e-10, `seed ${seed} secant start lies on curve`);
    assert(Math.abs(Model.variablePosition(definition.variable, row.endTime) - row.endPosition) < 1e-10, `seed ${seed} secant end lies on curve`);
  });
  assert(new Set(rows.map((row) => row.averageVelocity)).size >= 3);
  const exact = Model.variableVelocity(definition.variable, target);
  const acceleration = Model.profileState(definition.variable, target).acceleration;
  for (let index = 1; index < rows.length; index += 1) {
    assert(acceleration > 0 ? rows[index].averageVelocity > rows[index - 1].averageVelocity : rows[index].averageVelocity < rows[index - 1].averageVelocity);
    assert(Math.abs(rows[index].averageVelocity - exact) < Math.abs(rows[index - 1].averageVelocity - exact));
  }
  assert.strictEqual(Model.variableVelocity(definition.variable, Model.stoppedSceneTime(definition)), 0);
  assert.strictEqual(definition.instantOptions.filter((option) => option.correct).length, 1);
}
assert(definitions.size > 95);
assert(streams.size > 95, "later chunks vary with seed");
for (let seed = 100; seed < 2000; seed += 1) {
  const generated = Model.createAttempt(seed);
  const rows = Model.analysisWindows(generated);
  const geometry = Model.analysisWindowGeometry(generated);
  const exact = Model.variableVelocity(generated.variable, Model.targetSceneTime(generated));
  assert.deepStrictEqual(rows.map((row) => row.duration), Model.WINDOWS);
  geometry.forEach((row) => {
    assert(Math.abs(Model.variablePosition(generated.variable, row.startTime) - row.startPosition) < 1e-10, `seed ${seed} exact secant start`);
    assert(Math.abs(Model.variablePosition(generated.variable, row.endTime) - row.endPosition) < 1e-10, `seed ${seed} exact secant end`);
  });
  for (let index = 1; index < rows.length; index += 1) assert(Math.abs(rows[index].averageVelocity - exact) < Math.abs(rows[index - 1].averageVelocity - exact), `seed ${seed} strict convergence`);
}

const definition = Model.createAttempt(9);
assert.notDeepStrictEqual(Model.streamChunk(definition.variable, 0).map((item) => [item.duration, item.v0, item.v1]), Model.streamChunk(definition.variable, 1).map((item) => [item.duration, item.v0, item.v1]), "successive chunks do not repeat a cycle");
for (let chunkIndex = 0; chunkIndex < 12; chunkIndex += 1) {
  const table = Model.streamChunk(definition.variable, chunkIndex);
  assert(Math.abs(table.reduce((sum, item) => sum + item.duration, 0) - Model.CHUNK_DURATION) < 1e-8);
  assert.strictEqual(table.filter((item) => item.v0 === 0 && item.v1 === 0).length, 1, "each chunk has an exact stop plateau");
  assert(table.some((item) => item.v0 > 0 && item.v0 === item.v1), "each chunk has a seeded non-zero cruise plateau");
  assert(table.some((item) => item.v1 > item.v0), "each chunk accelerates");
  assert(table.some((item) => item.v1 < item.v0), "each chunk decelerates");
  assert(table.filter((item) => item.v0 === item.v1).every((item) => item.duration < definition.variableMinimumDuration), "no constant segment can satisfy the measurement alone");
  for (let index = 1; index < table.length; index += 1) {
    assert(Math.abs(table[index - 1].v1 - table[index].v0) < 1e-12);
    const boundary = chunkIndex * Model.CHUNK_DURATION + table[index].start;
    assert(Math.abs(Model.variableVelocity(definition.variable, boundary - 1e-7) - Model.variableVelocity(definition.variable, boundary + 1e-7)) < 1e-5);
    assert(Math.abs(Model.variablePosition(definition.variable, boundary - 1e-7) - Model.variablePosition(definition.variable, boundary + 1e-7)) < 1e-4);
  }
}
for (let time = 0; time < 300; time += 0.17) {
  assert(Model.variableVelocity(definition.variable, time) >= 0);
  assert(Model.variablePosition(definition.variable, time + 0.01) >= Model.variablePosition(definition.variable, time) - 1e-9);
}
for (let start = 0; start < 250; start += 0.31) {
  const values = [0, 0.75, 1.5, 2.25, 3].map((offset) => Model.variableVelocity(definition.variable, start + offset));
  assert(new Set(values.map((value) => value.toFixed(7))).size > 1, `a legal 3 s measurement from ${start} is non-uniform`);
}
assert(Math.abs(Model.variablePosition(definition.variable, Model.CHUNK_DURATION) - definition.variable.x0 - Model.CHUNK_DISTANCE) < 1e-9);
assert.strictEqual(Model.variablePosition(definition.variable, Model.CHUNK_DURATION * 1000) - definition.variable.x0, Model.CHUNK_DISTANCE * 1000);

const measurement = Model.captureMeasurement((time) => Model.uniformPosition(definition.uniform, time), 0.2, 2.2);
assert.strictEqual(Model.measurementWorldPosition(measurement, "x1"), measurement.readingOrigin + measurement.x1);
assert.strictEqual(Model.measurementWorldPosition(measurement, "x2"), measurement.readingOrigin + measurement.x2);
assert.strictEqual(Model.measurementWorldPosition({ ...measurement, x2: null }, "x2"), null);
assert(Model.expectedFromMeasurement(measurement).displacement > 0);

const fineTime = Model.advanceSimulationTime(0, Array.from({ length: 100 }, () => ({ dt: 0.01, running: true })));
const coarseTime = Model.advanceSimulationTime(0, Array.from({ length: 20 }, () => ({ dt: 0.05, running: true })));
assert(Math.abs(fineTime - coarseTime) < 1e-12);
assert(!Model.hasModelTimeHeadroom(Model.MAX_MODEL_TIME - 1.5, 1.5));
assert(Model.minimumDurationReached(1.5 - Model.MODEL_TIME_TOLERANCE / 2, 1.5));
assert(Model.safeWorldPosition(Model.variablePosition(definition.variable, 1e8)));

for (const mutate of [
  (value) => { value.variable.streamVersion += 1; },
  (value) => { value.variableMinimumDuration = 2.75; },
  (value) => { value.variableMinimumDuration = 3.1; },
  (value) => { value.instantTarget.segmentIndex = -1; },
  (value) => { value.instantTarget.timeWithinSegment = 0.1; },
  (value) => { value.stoppedCheckpoint.segmentIndex = value.instantTarget.segmentIndex; },
  (value) => { value.windows.reverse(); },
  (value) => { value.uniform.layout = 4; }
]) {
  const corrupt = JSON.parse(JSON.stringify(definition)); mutate(corrupt); assert.strictEqual(Model.validateDefinition(corrupt), false);
}

console.log("Linear motion model tests passed");
