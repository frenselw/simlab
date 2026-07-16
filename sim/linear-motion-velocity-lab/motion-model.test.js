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
["5.00", "0.500", "05.00", "0.00"].forEach((value) => assert(Model.normalizeInput(value), value));
["5", "5.0", "5.00 m", "5,00", "5e0", "Infinity", "NaN"].forEach((value) => assert.strictEqual(Model.normalizeInput(value), null, value));
assert.strictEqual(Model.normalizeInput("05.00").text, "5.00");
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
  assert(Math.abs(rows[3].averageVelocity - Model.variableVelocity(definition.variable, target)) < Math.abs(rows[0].averageVelocity - Model.variableVelocity(definition.variable, target)));
  assert.strictEqual(definition.instantOptions.filter((option) => option.correct).length, 1);
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
const a = Model.variablePosition(definition.variable, 5);
const b = Model.variablePosition(definition.variable, 5);
assert.strictEqual(a, b, "position is independent of render frame rate");

console.log("Linear motion model tests passed");
