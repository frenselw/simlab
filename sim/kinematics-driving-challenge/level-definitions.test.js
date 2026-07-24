"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");
const Scoring = require("./scoring.js");

assert.equal(Levels.LEVELS.length, 5);
assert(Levels.LEVELS.every(Levels.validateLevel));
assert.deepEqual(Levels.LEVELS.map((level) => level.id), ["level1", "level2", "level3", "level4", "level5"]);
assert(Levels.LEVELS[3].segments.some((segment) => segment.slopeDeg > 0));
assert.equal(Levels.LEVELS[3].segments.length, 1, "level4 is one uninterrupted slope");
assert.equal(Levels.LEVELS[3].segments[0].start, 0);
assert.equal(Levels.LEVELS[3].segments[0].end, Levels.LEVELS[3].routeLength);
assert.equal(Levels.scoredZones(Levels.LEVELS[3]).length, 1);
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 45).target, "transition");
assert.equal(Levels.scoredZones(Levels.LEVELS[4]).length, 4);
assert.equal(Levels.LEVELS.flatMap(Levels.scoredZones).reduce((sum, zone) => sum + zone.points, 0), 90);
const catalog = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
assert.match(catalog, /folder:\s*"kinematics-driving-challenge"[\s\S]*?status:\s*"planned"/,
  "the activity remains planned until browser QA and packaged-SCORM verification finish");

function simpleControlFor(zone) {
  if (zone.target === "accelerating") return 2;
  if (zone.target === "decelerating") return 5;
  if (zone.target === "transition") return 1;
  if (zone.target === "uniform") {
    return Array.from({ length: 7 }, (_, code) => code).reduce((best, code) =>
      Math.abs(Model.accelerationFor(8, zone.slopeDeg, code)) <
      Math.abs(Model.accelerationFor(8, zone.slopeDeg, best)) ? code : best, 0);
  }
  return 0;
}

function simpleHoldStrategy(level) {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    codes.push(simpleControlFor(Levels.segmentAt(level, run.state.x)));
    run = Model.replay(level, codes);
  }
  return { codes, run };
}

Levels.LEVELS.forEach((level) => {
  const strategy = simpleHoldStrategy(level);
  const scored = Scoring.scoreRun(level, strategy.codes);
  assert.equal(strategy.run.state.terminal, "complete", `${level.id} simple strategy completes`);
  assert.equal(scored.points, scored.maxPoints, `${level.id} simple strategy earns full marks`);
  assert(strategy.run.samples.some((sample) => sample.t >= Scoring.MIN_EVIDENCE_S), `${level.id} provides evidence time`);
});

for (const code of [1, 2, 3]) {
  const level = Levels.levelById("level2");
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) { codes.push(code); run = Model.replay(level, codes); }
  const points = Scoring.scoreRun(level, codes).points;
  if (code === 2) assert.equal(points, level.segments[0].points, "level2 accepts the tuned medium throttle");
  else assert(points <= 16, `level2 clearly rejects non-uniform throttle intensity ${code}`);
}
for (const code of [4, 5, 6]) {
  const level = Levels.levelById("level3");
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) { codes.push(code); run = Model.replay(level, codes); }
  const points = Scoring.scoreRun(level, codes).points;
  if (code === 5) assert.equal(points, level.segments[0].points, "level3 accepts the tuned medium brake");
  else assert(points <= 16, `level3 clearly rejects non-uniform brake intensity ${code}`);
}

for (const [levelId, fixedCode] of [["level1", 0], ["level1", 2], ["level2", 0], ["level2", 4], ["level3", 0], ["level3", 1]]) {
  const level = Levels.levelById(levelId);
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    codes.push(fixedCode);
    run = Model.replay(level, codes);
  }
  const scored = Scoring.scoreRun(level, codes);
  assert(scored.points < scored.maxPoints, `${levelId} rejects the wrong fixed input ${fixedCode}`);
}

for (const [levelId, correctCode] of [["level1", 1], ["level2", 2], ["level3", 5]]) {
  const level = Levels.levelById(levelId);
  for (let code = 0; code <= 6; code += 1) {
    const codes = [];
    let run = Model.replay(level, codes);
    while (!run.state.terminal) { codes.push(code); run = Model.replay(level, codes); }
    const points = Scoring.scoreRun(level, codes).points;
    if (code === correctCode) assert.equal(points, level.segments[0].points, `${levelId} unique strategy is full credit`);
    else assert(points <= level.segments[0].points * .9, `${levelId} wrong fixed code ${code} stays clearly below full credit`);
  }
}

const mixed = simpleHoldStrategy(Levels.levelById("level5"));
const scoredZoneIds = new Set(Levels.scoredZones(Levels.levelById("level5")).map((zone) => zone.id));
const mixedZoneCodes = new Map();
mixed.run.samples.forEach((sample) => {
  if (!scoredZoneIds.has(sample.segmentId)) return;
  if (!mixedZoneCodes.has(sample.segmentId)) mixedZoneCodes.set(sample.segmentId, new Set());
  mixedZoneCodes.get(sample.segmentId).add(sample.code);
});
assert.equal(mixedZoneCodes.size, 4, "the mixed fixture reaches all four scored targets");
assert(new Set(mixed.run.samples.filter((sample) => scoredZoneIds.has(sample.segmentId)).map((sample) => sample.code)).size >= 3,
  "the mixed fixture visibly switches control strategy between targets");

console.log("Kinematics driving level definition tests passed");
