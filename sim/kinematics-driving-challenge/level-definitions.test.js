"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");
const Scoring = require("./scoring.js");

assert.equal(Levels.LEVELS.length, 5);
assert(Levels.LEVELS.every(Levels.validateLevel));
assert.deepEqual(Levels.LEVELS.map((level) => level.id), ["level1", "level2", "level3", "level4", "level5"]);
assert(Levels.LEVELS[3].segments.some((segment) => segment.slopeDeg > 0));
assert(Levels.LEVELS[3].segments.some((segment) => segment.slopeDeg < 0));
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 50).target, "transition");
assert.equal(Levels.scoredZones(Levels.LEVELS[4]).length, 4);
assert.equal(Levels.LEVELS.flatMap(Levels.scoredZones).reduce((sum, zone) => sum + zone.points, 0), 90);

const usefulConstant = [1, 2, 4, 2, 2];
Levels.LEVELS.forEach((level, index) => {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal && codes.length < level.maxTicks) {
    codes.push(usefulConstant[index]);
    run = Model.replay(level, codes);
  }
  assert(run.state.terminal, `${level.id} has a bounded human-hold terminal strategy`);
  assert(Scoring.scoreRun(level, codes), `${level.id} terminal strategy is scorable`);
  assert(run.samples.some((sample) => sample.t >= Scoring.MIN_EVIDENCE_S), `${level.id} provides evidence time`);
});

console.log("Kinematics driving level definition tests passed");
