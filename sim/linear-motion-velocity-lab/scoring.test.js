"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");
const Scoring = require("./scoring.js");

const definition = Model.createAttempt(20260716);
const uniform = Model.captureMeasurement((time) => Model.uniformPosition(definition.uniform, time), 0.37, 3.12);
const cycle = Model.cycleDuration(definition.variable);
const variable = Model.captureMeasurement((time) => Model.variablePosition(definition.variable, time), 0.21, 0.21 + cycle);
const expectedU = Model.expectedFromMeasurement(uniform);
const expectedV = Model.expectedFromMeasurement(variable);
const correct = {
  uniform: { displacement: Model.format3(expectedU.displacement), time: Model.format3(expectedU.time), averageVelocity: Model.format3(expectedU.averageVelocity), relationship: "yes" },
  variable: { displacement: Model.format3(expectedV.displacement), time: Model.format3(expectedV.time), averageVelocity: Model.format3(expectedV.averageVelocity), relationship: "no" },
  instant: { predictionChoice: Scoring.correctOption(definition).id, concept: "limit", stoppedVelocity: "0.00" }
};
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, correct).score, 100);
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, correct).passed, true);

const wrongOption = definition.instantOptions.find((option) => !option.correct).id;
const wrong = {
  uniform: { displacement: "0.00", time: "0.00", averageVelocity: "0.00", relationship: "no" },
  variable: { displacement: "0.00", time: "0.00", averageVelocity: "0.00", relationship: "yes" },
  instant: { predictionChoice: wrongOption, concept: "journey-average", stoppedVelocity: "1.00" }
};
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, wrong).score, 0);
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, wrong).passed, false);

const arithmeticOnly = JSON.parse(JSON.stringify(correct));
arithmeticOnly.uniform.relationship = "no";
arithmeticOnly.variable.relationship = "yes";
arithmeticOnly.instant = wrong.instant;
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, arithmeticOnly).score, 50);

const boundary = JSON.parse(JSON.stringify(arithmeticOnly));
boundary.uniform.relationship = "yes";
boundary.instant.stoppedVelocity = "0.00";
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, boundary).score, 60);
boundary.instant.stoppedVelocity = "1.00";
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, boundary).score, 55);

for (const [stage, fields] of Object.entries(Scoring.WEIGHTS)) {
  for (const field of Object.keys(fields)) assert.strictEqual(typeof Scoring.scoreAttempt(definition, uniform, variable, correct).detail[stage][field].points, "number");
}
const malformed = JSON.parse(JSON.stringify(correct));
malformed.uniform.time = "2.7";
assert.throws(() => Scoring.scoreAttempt(definition, uniform, variable, malformed));
const zeroWrong = JSON.parse(JSON.stringify(correct));
zeroWrong.uniform.displacement = "0.00";
assert.strictEqual(Scoring.scoreAttempt(definition, uniform, variable, zeroWrong).detail.uniform.displacement.correct, false);
assert.strictEqual(Model.expectedFromMeasurement(uniform).displacement, Model.canonicalNumber(uniform.x2 - uniform.x1));

console.log("Linear motion scoring tests passed");
