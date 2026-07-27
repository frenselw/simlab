"use strict";

const assert = require("node:assert/strict");
const Tasks = require("./task-definitions.js");

assert.equal(Tasks.TASK_SET_VERSION, 1);
assert.equal(Tasks.TASKS.length, 12);
assert.equal(new Set(Tasks.TASKS.map((task) => task.id)).size, 12);
assert.deepEqual(Tasks.GRAPH_TYPES, ["vt", "at", "xt"]);
assert.deepEqual(
  Tasks.SCENARIOS.map((scenario) => scenario.points),
  [15, 25, 25, 35]
);
assert.equal(Tasks.TASKS.reduce((sum, task) => sum + task.points, 0), 100);
assert.deepEqual(
  Object.fromEntries(Tasks.GRAPH_TYPES.map((type) => [
    type, Tasks.TASKS.filter((task) => task.graphType === type).reduce((sum, task) => sum + task.points, 0)
  ])),
  { vt: 32, at: 32, xt: 36 }
);
assert.equal(Tasks.tasksForScenario("uniform").length, 3);
assert.deepEqual(Tasks.tasksForScenario("uniform").map((task) => task.graphType), ["vt", "at", "xt"]);
assert.deepEqual(Tasks.scenarioById("composite").phases, [
  "A 勻加速", "B 勻速", "C 勻減速至停止", "D 靜止"
]);
for (const task of Tasks.TASKS) {
  assert.equal(Tasks.taskById(task.id), task);
  assert.equal(Tasks.taskIndexById(task.id) >= 0, true);
  assert.doesNotMatch(task.prompt, /\d+\s*(?:m|s)|m\/s/);
  assert.equal(typeof task.rubric, "string");
}
assert.equal(Tasks.taskById("missing"), null);

console.log("Qualitative kinematics task definition tests passed");
