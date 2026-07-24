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
assert(Levels.LEVELS[3].segments.some((segment) => segment.slopeDeg < 0));
assert.equal(Levels.segmentAt(Levels.LEVELS[4], 50).target, "transition");
assert.equal(Levels.scoredZones(Levels.LEVELS[4]).length, 4);
assert.equal(Levels.LEVELS.flatMap(Levels.scoredZones).reduce((sum, zone) => sum + zone.points, 0), 90);
const catalog = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
assert.match(catalog, /folder:\s*"kinematics-driving-challenge"[\s\S]*?status:\s*"planned"/,
  "the activity remains planned until browser QA and packaged-SCORM verification finish");

const STRATEGY_FIXTURES = {
  level1: [
    { holdTicks: 20, acceleration: .35, deceleration: .55, gain: .4 },
    { holdTicks: 25, acceleration: .5, deceleration: .7, gain: .8 },
    { holdTicks: 30, acceleration: .7, deceleration: .9, gain: 1.2 }
  ],
  level2: [
    { holdTicks: 18, acceleration: .35, deceleration: .55, gain: .6 },
    { holdTicks: 20, acceleration: .35, deceleration: .55, gain: .8 },
    { holdTicks: 22, acceleration: .35, deceleration: .55, gain: 1 }
  ],
  level3: [
    { holdTicks: 20, acceleration: .35, deceleration: .7, gain: 1.8 },
    { holdTicks: 25, acceleration: .5, deceleration: .7, gain: .8 },
    { holdTicks: 18, acceleration: .35, deceleration: .65, gain: 1.2 }
  ],
  level4: [
    { holdTicks: 20, acceleration: .35, deceleration: .55, gain: .4 },
    { holdTicks: 20, acceleration: .35, deceleration: .55, gain: .8 },
    { holdTicks: 25, acceleration: .5, deceleration: .7, gain: .8 }
  ],
  level5: [
    { holdTicks: 20, acceleration: .35, deceleration: .55, gain: .4 },
    { holdTicks: 20, acceleration: .5, deceleration: .55, gain: .8 },
    { holdTicks: 20, acceleration: .5, deceleration: .55, gain: 1.2 }
  ]
};

function humanHoldStrategy(level, fixture) {
  const codes = [];
  let run = Model.replay(level, codes);
  let zoneAnchor = null;
  let code = 0;
  while (!run.state.terminal) {
    if (codes.length % fixture.holdTicks === 0) {
      const current = run.state;
      const zone = Levels.segmentAt(level, current.x);
      if (!zoneAnchor || zoneAnchor.id !== zone.id) zoneAnchor = { id: zone.id, t: current.t, v: current.v };
      const targetAcceleration = zone.target === "accelerating" ? fixture.acceleration :
        zone.target === "decelerating" ? -fixture.deceleration : 0;
      const targetVelocity = zoneAnchor.v + targetAcceleration * (current.t - zoneAnchor.t);
      const desiredAcceleration = zone.target === "transition" ? 0 :
        targetAcceleration + fixture.gain * (targetVelocity - current.v);
      code = Array.from({ length: 7 }, (_, candidate) => candidate).reduce((best, candidate) =>
        Math.abs(Model.accelerationFor(current.v, zone.slopeDeg, candidate) - desiredAcceleration) <
        Math.abs(Model.accelerationFor(current.v, zone.slopeDeg, best) - desiredAcceleration) ? candidate : best, 0);
    }
    codes.push(code);
    run = Model.replay(level, codes);
  }
  return { codes, run };
}

Levels.LEVELS.forEach((level) => {
  const fixtures = STRATEGY_FIXTURES[level.id];
  assert.equal(fixtures.length, 3);
  fixtures.forEach((fixture, index) => {
    const strategy = humanHoldStrategy(level, fixture);
    const scored = Scoring.scoreRun(level, strategy.codes);
    assert.equal(strategy.run.state.terminal, "complete", `${level.id} fixture ${index + 1} completes`);
    assert(scored.points / scored.maxPoints >= .85, `${level.id} fixture ${index + 1} earns a high-quality score`);
    assert(strategy.codes.some((code, codeIndex) =>
      codeIndex && code !== strategy.codes[codeIndex - 1]), `${level.id} fixture ${index + 1} requires control changes`);
    assert(strategy.run.samples.some((sample) => sample.t >= Scoring.MIN_EVIDENCE_S), `${level.id} provides evidence time`);
  });
});

for (const [levelId, fixedCode] of [["level2", 2], ["level3", 1]]) {
  const level = Levels.levelById(levelId);
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    codes.push(fixedCode);
    run = Model.replay(level, codes);
  }
  const scored = Scoring.scoreRun(level, codes);
  assert(scored.points < scored.maxPoints, `${levelId} cannot be solved perfectly by one fixed input`);
}

const mixed = humanHoldStrategy(Levels.levelById("level5"), STRATEGY_FIXTURES.level5[0]);
const scoredZoneIds = new Set(Levels.scoredZones(Levels.levelById("level5")).map((zone) => zone.id));
const mixedZoneCodes = new Map();
mixed.run.samples.forEach((sample) => {
  if (!scoredZoneIds.has(sample.segmentId)) return;
  if (!mixedZoneCodes.has(sample.segmentId)) mixedZoneCodes.set(sample.segmentId, new Set());
  mixedZoneCodes.get(sample.segmentId).add(sample.code);
});
assert.equal(mixedZoneCodes.size, 4, "the mixed fixture reaches all four scored targets");
assert(new Set(mixed.run.samples.filter((sample) => scoredZoneIds.has(sample.segmentId)).map((sample) => sample.code)).size >= 4,
  "the mixed fixture visibly switches control strategy between targets");

console.log("Kinematics driving level definition tests passed");
