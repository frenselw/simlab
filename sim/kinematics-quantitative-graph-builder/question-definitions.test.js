"use strict";
const assert = require("node:assert/strict"); const Q = require("./question-definitions.js");
assert.equal(Q.validateQuestionSet(), true); assert.deepEqual(Object.keys(Q.PAPERS), ["A", "B", "C", "D", "E", "F"]);
assert.equal(Q.paper("toString"), null); assert.equal(Q.taskDefinition("constructor", 0), null);
const a = Q.paper("A"); assert.equal(a[3].v0 + a[3].a * a[3].T, 0); assert.deepEqual(Q.targetValues(a[2], "x"), [2, 8, 18]);
assert.equal(Q.taskDefinition("A", 3).axis.max, 20); assert.equal(Q.taskDefinition("B", 9).axis.max, 50);
console.log("Quantitative graph question-definition tests passed");
