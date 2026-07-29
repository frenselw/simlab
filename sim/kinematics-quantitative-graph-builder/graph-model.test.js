"use strict";
const assert = require("node:assert/strict"); const Q = require("./question-definitions.js"); const M = require("./graph-model.js");
const x = Q.taskDefinition("A", 6); assert.deepEqual(M.canonicalAnswer([2, 8, 18], x), [2, 8, 18]); assert.equal(M.canonicalAnswer([2, 8.5, 18], x), null);
const quadratic = M.quadraticThrough(x.times, [2, 8, 18]); assert.equal(quadratic.valueAt(2), 8); assert.deepEqual(M.impliedParameters(x, [2, 8, 18]), { x0: 2, v0: 2, a: 1 });
assert.equal(M.graphFunction(x, [2, null, 18]), null); assert.equal(M.sampledPath(x, [2, 8, 18]).length, 121);
const editor = new M.Editor(x); assert.equal(editor.set(0, 2.4), true); assert.equal(editor.answer[0], 2); assert.equal(editor.set(0, 2.1), false); assert.equal(editor.step(1, 1), true); assert.equal(editor.undoOnce(), true); assert.equal(editor.answer[1], null); assert.equal(M.snap(100, x.axis), x.axis.max);
console.log("Quantitative graph model tests passed");
