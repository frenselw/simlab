"use strict";

const assert = require("node:assert/strict");
const Levels = require("./level-definitions.js");
const Model = require("./driving-model.js");
const Scoring = require("./scoring.js");

function synthetic(target, velocities, points = 5, span = 20) {
  const samples = velocities.map((v, index) => ({ t: index * .05, x: index * .5, v }));
  const zone = { id: "z", start: 0, end: samples.at(-1).x, target, points, graphVelocitySpan: span };
  return { run: { samples, state: { terminal: "complete" } }, zone };
}

assert.equal(Scoring.fullThenFade(.08, .08, .16), 1);
assert(Scoring.fullThenFade(.0801, .08, .16) < 1);
assert(Scoring.fullThenFade(.1599, .08, .16) > 0);
assert.equal(Scoring.fullThenFade(.16, .08, .16), 0);
assert.equal(Scoring.riseScore(.02), 0);
assert(Scoring.riseScore(.0201) > 0);
assert(Scoring.riseScore(.0999) < 1);
assert.equal(Scoring.riseScore(.10), 1);

const times = Array.from({ length: 80 }, (_, index) => index);
let fixture = synthetic("uniform", times.map(() => 8), 15);
assert.equal(Scoring.scoreZone(fixture.run, fixture.zone).points, 15);
fixture = synthetic("accelerating", times.map((index) => 4 + index * .05), 20);
assert.equal(Scoring.scoreZone(fixture.run, fixture.zone).points, 20);
fixture = synthetic("decelerating", times.map((index) => 12 - index * .05), 20);
assert.equal(Scoring.scoreZone(fixture.run, fixture.zone).points, 20);
fixture = synthetic("accelerating", times.map((index) => 8 + Math.sin(index / 4)), 20);
assert(Scoring.scoreZone(fixture.run, fixture.zone).points < 20, "curved/nonlinear speed loses credit");
fixture = synthetic("accelerating", times.map((index) => 8 - index * .03), 20);
assert(Scoring.scoreZone(fixture.run, fixture.zone).points <= 5.01, "wrong direction cannot gain linearity credit");

const shortEvidenceRows = Array.from({ length: 45 }, (_, index) => 8 + index * .05);
fixture = synthetic("uniform", shortEvidenceRows, 20);
let scored = Scoring.scoreZone(fixture.run, fixture.zone);
assert.equal(scored.kind, "evidence");
assert.equal(scored.fraction, .4, "insufficient uniform evidence retains 0.4C completion credit");
fixture = synthetic("uniform", Array.from({ length: 45 }, () => 2), 20);
scored = Scoring.scoreZone(fixture.run, fixture.zone);
assert.equal(scored.kind, "too-slow");
assert.equal(scored.completion, 0, "sub-threshold uniform motion receives no effective completion");
assert.equal(scored.fraction, 0, "the uniform speed floor still applies when evidence is short");
fixture = synthetic("accelerating", shortEvidenceRows, 20);
scored = Scoring.scoreZone(fixture.run, fixture.zone);
assert.equal(scored.kind, "evidence");
assert.equal(scored.fraction, .25, "insufficient accelerating evidence retains 0.25C completion credit");
fixture = synthetic("decelerating", shortEvidenceRows.map((value) => 20 - value), 20);
scored = Scoring.scoreZone(fixture.run, fixture.zone);
assert.equal(scored.kind, "evidence");
assert.equal(scored.fraction, .25, "insufficient decelerating evidence retains 0.25C completion credit");
const exactEvidence = synthetic("uniform", Array.from({ length: 46 }, () => 8), 20);
assert.equal(Scoring.scoreZone(exactEvidence.run, exactEvidence.zone).fraction, 1,
  "exactly MIN_EVIDENCE_S is sufficient at the inclusive boundary");

const stoppedSamples = Array.from({ length: 121 }, (_, index) => {
  const t = index * .05;
  return {
    t,
    x: t <= 3 ? 6 * t - t * t : 9,
    v: Math.max(0, 6 - 2 * t)
  };
});
const stoppedZone = {
  id: "stopped", start: 0, end: 30, target: "decelerating", points: 20,
  graphVelocitySpan: 20
};
const stoppedResult = Scoring.scoreZone(
  { samples: stoppedSamples, state: { terminal: "stopped" } },
  stoppedZone
);
assert.equal(stoppedResult.kind, "stopped-early",
  "stop-timeout samples cannot dilute the more useful stopped-early classification");
assert(Math.abs(stoppedResult.summary.slope + 2) < 1e-10,
  "stationary timeout samples are excluded from deceleration regression");
assert(stoppedResult.summary.rmse < 1e-10);
assert(Math.abs(stoppedResult.completion - .3) < 1e-10);
assert(Math.abs(stoppedResult.fraction - .825) < 1e-10,
  "an early stop loses completion credit without corrupting valid linear evidence");
assert.match(Scoring.feedbackText(stoppedResult), /路段完結前已停止/);
assert.equal(
  Scoring.scoreZone(
    { samples: stoppedSamples, state: { terminal: "stopped" } },
    { ...stoppedZone, target: "accelerating" }
  ).kind,
  "wrong-direction",
  "an accelerating target still reports the incorrect direction instead of suggesting gentler braking"
);

const worked = .25 * 1 + .25 * .75 + .5 * .8;
assert.equal(worked, .8375);
assert.equal(Scoring.checkpointPoints({ viewedXt: true, viewedVt: true, answerId: "vt-linear" }), 10);
assert.equal(Scoring.checkpointPoints({ viewedXt: true, viewedVt: false, answerId: "vt-linear" }), 0);
assert.equal(Scoring.checkpointPoints({ viewedXt: true, viewedVt: true, answerId: "xt-curvature" }), 0);

function controlFor(zone) {
  if (zone.target === "accelerating") return 2;
  if (zone.target === "decelerating") return 5;
  if (zone.slopeDeg > 0) return 2;
  if (zone.slopeDeg < 0) return 4;
  return 1;
}

function terminalCodes(level, chooseCode) {
  const codes = [];
  let run = Model.replay(level, codes);
  while (!run.state.terminal) {
    codes.push(chooseCode(Levels.segmentAt(level, run.state.x)));
    run = Model.replay(level, codes);
  }
  return codes;
}

for (const levelId of ["level2", "level3"]) {
  const level = Levels.levelById(levelId);
  assert.equal(Scoring.checkpointEligible(levelId, [0]), false,
    `${levelId} non-terminal prefix is not checkpoint evidence`);
  for (let code = 0; code <= 6; code += 1) {
    assert.equal(Scoring.checkpointEligible(levelId, terminalCodes(level, () => code)), true,
      `${levelId} legal constant-control terminal ${code} retains checkpoint evidence`);
  }
}

const perfectRuns = Object.fromEntries(Levels.LEVELS.map((level) => [
  level.id,
  { codes: terminalCodes(level, controlFor) }
]));
const perfect = Scoring.scoreActivity(perfectRuns, {
  viewedXt: true, viewedVt: true, answerId: Scoring.CHECKPOINT_ANSWER
});
assert.equal(perfect.score, 100, "production replay and scoring produce the attainable perfect total");
assert.equal(perfect.maxScore, 100);
assert.equal(perfect.passed, true);

const exactPassRuns = {
  ...perfectRuns,
  level1: { codes: terminalCodes(Levels.levelById("level1"), () => 5) },
  level4: { codes: terminalCodes(Levels.levelById("level4"), () => 5) }
};
const exactPass = Scoring.scoreActivity(exactPassRuns, {
  viewedXt: false, viewedVt: false, answerId: null
});
assert.equal(exactPass.score, 60, "the production scoreActivity path reaches the exact pass boundary");
assert.equal(exactPass.passed, true, "60 is inclusive");
const belowPass = Scoring.scoreActivity({
  ...exactPassRuns,
  level5: { codes: terminalCodes(Levels.levelById("level5"), () => 5) }
}, { viewedXt: false, viewedVt: false, answerId: null });
assert(belowPass.score < 60);
assert.equal(belowPass.passed, false);

const originalReplay = Model.replay;
try {
  Model.replay = () => ({
    state: { terminal: "technical" },
    samples: [{ t: 0, x: 0, v: 0 }],
    codes: []
  });
  assert.equal(
    Scoring.scoreRun(Levels.levelById("level1"), [0]),
    null,
    "technical model terminals are never scoreable"
  );
  Model.replay = () => ({
    state: { terminal: "stopped" },
    samples: Array.from({ length: 46 }, (_, index) => ({
      tick: index, t: index * .05, x: 0, v: 0, a: 0, code: 0
    })),
    codes: []
  });
  const zero = Scoring.scoreActivity(
    Object.fromEntries(Levels.LEVELS.map((level) => [level.id, { codes: [0] }])),
    { viewedXt: false, viewedVt: false, answerId: null }
  );
  assert.equal(zero.score, 0, "scoreActivity preserves a genuine zero-valued terminal result");
  assert.equal(zero.passed, false);
} finally {
  Model.replay = originalReplay;
}

console.log("Kinematics driving scoring tests passed");
