"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");

assert.strictEqual(Model.format3(0.005), "0.00500");
assert.strictEqual(Model.format3(0.5), "0.500");
assert.strictEqual(Model.format3(5), "5.00");
assert.strictEqual(Model.format3(50), "50.0");
assert.strictEqual(Model.format3(500), "5.00 × 10²");
assert.strictEqual(Model.format3(0), "0.00");
assert.strictEqual(Model.format3(Model.canonicalNumber(9.996)), "10.0");
["5.00", "0.500", "05.00", "0.00", "5.00e2", "1.00E+2", "5.00e-4"].forEach((value) => assert(Model.normalizeInput(value), value));
["5", "5.0", "5.00 m", "5,00", "5e0", "5.0e2", "Infinity", "NaN"].forEach((value) => assert.strictEqual(Model.normalizeInput(value), null, value));
assert.strictEqual(Model.normalizeInput("05.00").text, "5.00");
assert.strictEqual(Model.normalizeInput("500").text, "5.00e2");
assert.strictEqual(Model.normalizeInput("5.00e-4").text, "5.00e-4");
assert.strictEqual(Model.formatInput3(500), "5.00e2");
assert(Model.numericMatch(6.424999, 6.42));
assert(!Model.numericMatch(6.425001, 6.42));
assert(Model.numericMatch(0, 0));
assert(!Model.numericMatch(0.001, 0));

const first = Model.createAttempt(12345);
assert.deepStrictEqual(Model.createAttempt(12345), first);
const tuples = new Set();
const uniformAnswers = new Set();
const variableAnswers = new Set();
for (let seed = 0; seed < 100; seed += 1) {
  const definition = Model.createAttempt(seed);
  assert(Model.validateDefinition(definition));
  tuples.add(JSON.stringify([definition.uniform.speed, definition.uniform.x0, definition.variable.slowSpeed, definition.variable.fastSpeed, definition.variable.initialPhase, definition.instantTarget]));
  const uniform = Model.captureMeasurement((time) => Model.uniformPosition(definition.uniform, time), 0, 2.37);
  const cycle = Model.cycleDuration(definition.variable);
  const variable = Model.captureMeasurement((time) => Model.variablePosition(definition.variable, time), 0, cycle);
  uniformAnswers.add(JSON.stringify(Model.expectedFromMeasurement(uniform)));
  variableAnswers.add(JSON.stringify(Model.expectedFromMeasurement(variable)));
  assert(definition.variable.slowSpeed >= 1.5 && definition.variable.fastSpeed <= 9.5);
  assert(definition.variable.durations.stopped >= 0.6);
  const target = Model.targetSceneTime(definition);
  const rows = Model.analysisWindows(definition);
  assert(rows.every((row) => row.startTime < row.endTime && row.duration > 0));
  assert(new Set(rows.map((row) => row.averageVelocity)).size >= 3);
  const exact = Model.variableVelocity(definition.variable, target);
  for (let index = 1; index < rows.length; index += 1) {
    const directed = definition.instantTarget.segment === "accelerate"
      ? rows[index].averageVelocity > rows[index - 1].averageVelocity
      : rows[index].averageVelocity < rows[index - 1].averageVelocity;
    assert(directed, `seed ${seed} window ${index} direction`);
    assert(Math.abs(rows[index].averageVelocity - exact) < Math.abs(rows[index - 1].averageVelocity - exact), `seed ${seed} window ${index} approach`);
  }
  assert.strictEqual(definition.instantOptions.filter((option) => option.correct).length, 1);
  assert(Math.abs(definition.uniform.speed - definition.variable.slowSpeed) >= 0.75);
  assert(Math.abs(definition.uniform.speed - definition.variable.fastSpeed) >= 0.75);
}
assert(tuples.size >= 95);
assert(uniformAnswers.size > 20);
assert(variableAnswers.size > 20);
assert.throws(() => Model.createAttempt(1, 0));
assert.throws(() => Model.createAttempt(29, 1), /未能產生有效/);

const definition = Model.createAttempt(9);
assert.strictEqual(Model.uniformPosition(definition.uniform, 2), definition.uniform.x0 + definition.uniform.speed * 2);
assert.strictEqual(Model.uniformVelocity(definition.uniform), definition.uniform.speed);
const table = Model.segmentTable(definition.variable);
for (let index = 1; index < table.length; index += 1) {
  const boundary = table[index].start - definition.variable.initialPhase;
  const left = Model.variableVelocity(definition.variable, boundary - 1e-7);
  const right = Model.variableVelocity(definition.variable, boundary + 1e-7);
  assert(Math.abs(left - right) < 1e-5, table[index].key);
  assert(Math.abs(Model.variablePosition(definition.variable, boundary - 1e-7) - Model.variablePosition(definition.variable, boundary + 1e-7)) < 1e-4);
}
const cycle = Model.cycleDuration(definition.variable);
for (let t = 0; t < cycle * 2; t += 0.05) {
  assert(Model.variableVelocity(definition.variable, t) >= -1e-10);
  assert(Model.variablePosition(definition.variable, t + 0.01) >= Model.variablePosition(definition.variable, t) - 1e-10);
}
const stop = table.find((segment) => segment.key === "stopped");
const stopTime = stop.start + stop.duration / 2 - definition.variable.initialPhase + cycle;
assert.strictEqual(Model.variableVelocity(definition.variable, stopTime), 0);
const fineSchedule = Array.from({ length: 100 }, () => ({ dt: 0.01, running: true }));
const coarseSchedule = Array.from({ length: 20 }, () => ({ dt: 0.05, running: true }));
const fineTime = Model.advanceSimulationTime(0, fineSchedule);
const coarseTime = Model.advanceSimulationTime(0, coarseSchedule);
assert(Math.abs(fineTime - coarseTime) < 1e-12);
assert(Math.abs(Model.variablePosition(definition.variable, fineTime) - Model.variablePosition(definition.variable, coarseTime)) < 1e-12, "frame schedules preserve model position");
const pausedTime = Model.advanceSimulationTime(0, [
  ...Array.from({ length: 50 }, () => ({ dt: 0.01, running: true })),
  ...Array.from({ length: 50 }, () => ({ dt: 0.01, running: false }))
]);
assert(Math.abs(pausedTime - 0.5) < 1e-12, "paused frames do not advance simulation time");
assert(Math.abs(Model.advanceSimulationTime(12, Array.from({ length: 6000 }, () => ({ dt: 0.05, running: true }))) - 312) < 1e-9, "observation has no automatic time limit");

const seed2235 = Model.createAttempt(2235);
const regressionRows = Model.analysisWindows(seed2235);
const regressionExact = Model.variableVelocity(seed2235.variable, Model.targetSceneTime(seed2235));
for (let index = 1; index < regressionRows.length; index += 1) {
  assert(Math.abs(regressionRows[index].averageVelocity - regressionExact) < Math.abs(regressionRows[index - 1].averageVelocity - regressionExact));
}

for (const mutate of [
  (value) => { value.uniform.layout = 3; },
  (value) => { value.variable.layout = -1; },
  (value) => { value.uniform.coordinateOrigin += 1; },
  (value) => { value.variable.x0 = 1000; },
  (value) => { value.uniform.speed = value.variable.fastSpeed; },
  (value) => { value.variable.durations.slow = 1.65; },
  (value) => { value.variable.durations.accelerate = 0.2; },
  (value) => { value.variable.durations.fast = 1.15; },
  (value) => { value.variable.durations.restart = 0.2; },
  (value) => { value.instantTarget.cycleIndex = 1; }
]) {
  const corrupt = JSON.parse(JSON.stringify(definition));
  mutate(corrupt);
  assert.strictEqual(Model.validateDefinition(corrupt), false);
}

console.log("Linear motion model tests passed");
