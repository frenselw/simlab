"use strict";

const assert = require("node:assert/strict");
const Model = require("./graph-model.js");

const empty = Model.createTrace();
assert.equal(empty.length, 96);
assert.equal(empty.every((value) => value === Model.EMPTY), true);
assert.equal(Model.pointToSample(50, 75, { left: 0, bottom: 100, width: 100, height: 100 }).bin, 48);
assert.equal(Model.pointToSample(50, 75, { left: 0, bottom: 100, width: 100, height: 100 }).value, 64);

let trace = Model.createTrace();
Model.applySegment(trace, { bin: 4, value: 20 }, { bin: 8, value: 100 }, "pen");
assert.deepEqual(Array.from(trace.slice(4, 9)), [20, 40, 60, 80, 100]);
Model.applySegment(trace, { bin: 8, value: 100 }, { bin: 4, value: 40 }, "pen");
assert.deepEqual(Array.from(trace.slice(4, 9)), [40, 55, 70, 85, 100]);
Model.applyPoint(trace, { bin: 6, value: 0 }, "erase", 1);
assert.deepEqual(Array.from(trace.slice(5, 8)), [255, 255, 255]);

const encoded = Model.encodeTrace(trace);
assert.equal(encoded.length, 128);
assert.deepEqual(Model.decodeTrace(encoded), trace);
assert.equal(Model.decodeTrace(`${encoded}=`), null);
assert.equal(Model.decodeTrace(encoded.slice(1)), null);
assert.throws(() => Model.encodeTrace(new Uint8Array(95)));

const editor = new Model.Editor();
assert.equal(editor.begin(1, { bin: 2, value: 10 }, { isPrimary: false }), false);
assert.equal(editor.begin(1, { bin: 2, value: 10 }, { isPrimary: true }), true);
assert.equal(editor.begin(2, { bin: 4, value: 20 }, { isPrimary: true }), false, "second pointer ignored");
assert.equal(editor.move(2, { bin: 8, value: 80 }), false);
assert.equal(editor.move(1, { bin: 8, value: 80 }), true);
assert.equal(editor.commit(1), true);
assert.equal(editor.trace()[2], 10);
assert.equal(editor.trace()[8], 80);
assert.equal(editor.canUndo, true);
assert.equal(editor.undo(), true);
assert.equal(editor.trace().every((value) => value === Model.EMPTY), true);
assert.equal(editor.redo(), true);
assert.equal(editor.trace()[8], 80);
assert.equal(editor.clear(), true);
assert.equal(editor.undo(), true);
assert.equal(editor.trace()[8], 80);

const committed = editor.trace();
assert.equal(editor.begin(7, { bin: 30, value: 200 }), true);
editor.move(7, { bin: 40, value: 220 });
assert.equal(editor.cancel(7), true);
assert.deepEqual(editor.trace(), committed, "cancel rolls back working stroke");

console.log("Qualitative kinematics graph model tests passed");
