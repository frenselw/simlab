"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");
const Scoring = require("./scoring.js");

assert.equal(Levels.LEVELS.length, 5);
assert.equal(Model.PHYSICS_VERSION, 6);
assert(Levels.LEVELS.every(Levels.validateLevel));
assert.deepEqual(Levels.LEVELS.map((level) => level.id), ["level1", "level2", "level3", "level4", "level5"]);
assert(Levels.LEVELS[3].segments.some((segment) => segment.slopeDeg > 0));
assert.equal(Levels.LEVELS[3].segments.length, 1, "level4 is one uninterrupted slope");
assert.equal(Levels.LEVELS[3].segments[0].start, 0);
assert.equal(Levels.LEVELS[3].segments[0].end, Levels.LEVELS[3].routeLength);
assert.equal(Levels.scoredZones(Levels.LEVELS[3]).length, 1);
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 50).target, "uniform");
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 100).target, "accelerating");
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 160).target, "decelerating");
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 220).target, "uniform");
assert.equal(Levels.LEVELS[4].segments.length, 4);
assert.equal(Levels.LEVELS[4].routeLength, 267);
assert(!Levels.LEVELS[4].segments.some((segment) => segment.target === "transition"));
assert.equal(Levels.scoredZones(Levels.LEVELS[4]).length, 4);
assert.equal(Levels.LEVELS.flatMap(Levels.scoredZones).reduce((sum, zone) => sum + zone.points, 0), 90);
const catalog = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
assert.match(catalog, /folder:\s*"kinematics-driving-challenge"[\s\S]*?status:\s*"planned"/,
  "the activity remains planned until real-Moodle current/new-window and phone verification finish");

function simpleControlFor(zone, speed = 8) {
  if (zone.target === "accelerating") return 2;
  if (zone.target === "decelerating") return 5;
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
    codes.push(simpleControlFor(Levels.segmentAt(level, run.state.x), run.state.v));
    run = Model.replay(level, codes);
  }
  return { codes, run };
}

Levels.LEVELS.forEach((level) => {
  const strategy = simpleHoldStrategy(level);
  const scored = Scoring.scoreRun(level, strategy.codes);
  assert.equal(strategy.run.state.terminal, "complete", `${level.id} simple strategy completes`);
  assert.equal(scored.points, scored.maxPoints, `${level.id} simple strategy earns full marks`);
  Levels.scoredZones(level).forEach((zone) => {
    const summary = Scoring.regression(Scoring.zoneSamples(strategy.run, zone));
    assert(summary && summary.duration + 1e-9 >= Scoring.MIN_EVIDENCE_S,
      `${level.id}/${zone.id} preserves the required post-grace evidence time`);
  });
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
assert.equal(Scoring.scoreRun(Levels.levelById("level5"), mixed.codes).points, 20,
  "the boundary-only mixed strategy earns exactly 20/20");
const canonicalLevel5Codes = {
  "l5-uniform-flat": 1,
  "l5-accelerate-flat": 2,
  "l5-decelerate-flat": 5,
  "l5-uniform-down": 4
};
const perfectSelectedRuns = Object.fromEntries(Levels.LEVELS.map((level) => [
  level.id,
  { codes: simpleHoldStrategy(level).codes }
]));
for (const segment of Levels.levelById("level5").segments) {
  for (let alternative = 0; alternative <= 6; alternative += 1) {
    if (alternative === canonicalLevel5Codes[segment.id]) continue;
    const trial = [];
    let run = Model.replay(Levels.levelById("level5"), trial);
    while (!run.state.terminal) {
      const active = Levels.segmentAt(Levels.levelById("level5"), run.state.x);
      trial.push(active.id === segment.id ? alternative : canonicalLevel5Codes[active.id]);
      run = Model.replay(Levels.levelById("level5"), trial);
    }
    const trialScore = Scoring.scoreRun(Levels.levelById("level5"), trial);
    const changedZone = trialScore.zones.find((zone) => zone.zoneId === segment.id);
    assert(changedZone.points < changedZone.maxPoints - .05,
      `${segment.id} visibly rejects alternative fixed control ${alternative}`);
    const activityScore = Scoring.scoreActivity(
      { ...perfectSelectedRuns, level5: { codes: trial } },
      { viewedXt: true, viewedVt: true, answerId: Scoring.CHECKPOINT_ANSWER }
    );
    assert(activityScore.score < 100,
      `${segment.id} alternative ${alternative} cannot round back to a perfect activity score`);
  }
}
const mixedSegments = Levels.levelById("level5").segments;
for (let index = 1; index < mixedSegments.length; index += 1) {
  const boundary = mixedSegments[index].start;
  const sampleIndex = mixed.run.samples.findIndex((sample) => sample.boundary === true && sample.x === boundary);
  assert(sampleIndex > 0, `authoritative replay preserves the ${boundary} m boundary sample`);
  assert.equal(mixed.run.samples[sampleIndex].segmentId, mixedSegments[index - 1].id,
    "the crossing sample remains evidence for the segment that ends at the line");
  assert.equal(mixed.run.samples[sampleIndex + 1].segmentId, mixedSegments[index].id,
    "the remainder of the same fixed tick is assigned to the segment after the line");
}

console.log("Kinematics driving level definition tests passed");
