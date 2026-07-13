"use strict";

const assert = require("node:assert/strict");
const Coverage = require("./route-coverage.js");
const Persistence = require("./map-persistence.js");
const Scoring = require("./scoring.js");

const edges = [
  { id: 0, a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
  { id: 1, a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
  { id: 2, a: { x: 10, y: 10 }, b: { x: 20, y: 10 } }
];
const edgeById = Object.fromEntries(edges.map((edge) => [edge.id, edge]));
const source = {
  seed: 0,
  routeIds: [2, 4, 1],
  currentSegment: 1,
  phase: "walk",
  person: { x: 10, y: 6, edgeId: 1, t: 0.6 },
  segments: [
    { reached: true, routeDistance: 244.345678, coverage: [{ edgeId: 0, start: 0.2, end: 1 }, { edgeId: 1, start: 0, end: 0.6 }], arrow: { tail: { x: 0, y: 0 }, head: { x: 10, y: 6 } }, answers: { routeDistance: 244.3, displacementMagnitude: 11.7, direction: { directionType: "north-east", angle: 31 } } },
    { reached: false, routeDistance: 37.812345, coverage: [{ edgeId: 2, start: 0.1, end: 0.5 }], arrow: null, answers: null }
  ],
  totalArrow: null,
  totalAnswers: null
};

const encoded = Persistence.encode(source);
assert.equal(encoded.traceFormat, 2, "production serializer marks the topology format");
const restored = Persistence.decode(encoded, edges, () => { throw new Error("new format must not use legacy migration"); });
assert.ok(restored, "production serializer output restores");
assert.deepEqual(restored.segments.map((segment) => segment.routeDistance), [244.345678, 37.812345], "full-precision route distances round-trip unchanged");
for (const answer of [243, 243.345678, 237]) {
  assert.equal(
    Scoring.isDistanceAnswerCorrect(answer, source.segments[0].routeDistance),
    Scoring.isDistanceAnswerCorrect(answer, restored.segments[0].routeDistance),
    "distance scoring is invariant across persistence"
  );
}
assert.deepEqual(restored.segments.map((segment) => Coverage.compact(segment.coverage)), encoded.segments.map((segment) => segment.coverage), "coverage intervals round-trip unchanged");
assert.deepEqual(restored.person, { x: 10, y: 6 }, "person position round-trips");
assert.equal(restored.currentSegment, 1, "current segment round-trips");
assert.equal(restored.phase, "walk", "phase round-trips");
restored.segments.flatMap((segment) => segment.coverage).forEach((interval) => {
  const points = Coverage.intervalPoints(interval, edgeById);
  assert.ok(points && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)), "render segment geometry is available");
});

const segmentAnswer = structuredClone(encoded);
segmentAnswer.currentSegment = 0;
segmentAnswer.phase = "segment-answer";
segmentAnswer.segments[0].answers = null;
segmentAnswer.segments[1] = { reached: false, routeDistance: 0, coverage: [], arrow: null, answers: null };
assert.equal(Persistence.decode(segmentAnswer, edges, legacyRoadPath)?.phase, "draw-segment", "legacy segment-answer normalizes to a current UI phase");
segmentAnswer.segments[0].arrow = null;
assert.equal(Persistence.decode(segmentAnswer, edges, legacyRoadPath), null, "legacy segment-answer still requires its saved arrow");

const readySubmit = structuredClone(encoded);
readySubmit.phase = "ready-submit";
readySubmit.segments[1] = { ...readySubmit.segments[0], routeDistance: 10 };
readySubmit.totalArrow = readySubmit.segments[0].arrow;
readySubmit.totalAnswers = structuredClone(readySubmit.segments[0].answers);
const normalizedReadySubmit = Persistence.decode(readySubmit, edges, legacyRoadPath);
assert.equal(normalizedReadySubmit?.phase, "draw-total", "legacy ready-submit normalizes to a current UI phase");
assert.deepEqual(normalizedReadySubmit.totalAnswers, readySubmit.totalAnswers, "legacy final answers keep their scoring values");
assert.equal(Scoring.isDistanceAnswerCorrect(normalizedReadySubmit.totalAnswers.routeDistance, readySubmit.totalAnswers.routeDistance), true, "normalized legacy distance retains its scoring meaning");
readySubmit.totalArrow = null;
assert.equal(Persistence.decode(readySubmit, edges, legacyRoadPath), null, "legacy ready-submit requires its total arrow");
assert.equal(Persistence.encode({ ...source, phase: "ready-submit" }).phase, "draw-total", "serializer only emits current phase names");

const drawSegmentSource = structuredClone(source);
drawSegmentSource.currentSegment = 0;
drawSegmentSource.phase = "draw-segment";
drawSegmentSource.segments[0].answers = null;
drawSegmentSource.segments[1] = { reached: false, routeDistance: 0, coverage: [], arrow: null, answers: null };
assert.equal(Persistence.decode(Persistence.encode(drawSegmentSource), edges, legacyRoadPath)?.phase, "draw-segment", "draw-segment round-trips unchanged");
const drawTotalSource = structuredClone(source);
drawTotalSource.phase = "draw-total";
drawTotalSource.segments[1] = { ...structuredClone(source.segments[0]), routeDistance: 10 };
drawTotalSource.totalArrow = structuredClone(source.segments[0].arrow);
assert.equal(Persistence.decode(Persistence.encode(drawTotalSource), edges, legacyRoadPath)?.phase, "draw-total", "draw-total round-trips unchanged");

for (const phase of ["walk", "draw-segment"]) {
  const secondSegment = structuredClone(source);
  secondSegment.phase = phase;
  if (phase === "draw-segment") {
    secondSegment.segments[1].reached = true;
    secondSegment.segments[1].arrow = structuredClone(source.segments[0].arrow);
  }
  assert.equal(Persistence.decode(Persistence.encode(secondSegment), edges, legacyRoadPath)?.phase, phase, `segment 2 ${phase} remains valid after segment 1 is answered`);
  secondSegment.segments[0].answers = null;
  assert.equal(Persistence.decode(Persistence.encode(secondSegment), edges, legacyRoadPath), null, `segment 2 ${phase} requires the first answer`);
}

for (const futureData of ["second", "secondDistance", "secondCoverage", "totalArrow", "totalAnswers"]) {
  const stale = structuredClone(drawSegmentSource);
  if (futureData === "second") stale.segments[1].reached = true;
  if (futureData === "secondDistance") stale.segments[1].routeDistance = 1;
  if (futureData === "secondCoverage") stale.segments[1].coverage = [[0, 0, 0.1]];
  if (futureData === "totalArrow") stale.totalArrow = structuredClone(source.segments[0].arrow);
  if (futureData === "totalAnswers") stale.totalAnswers = structuredClone(source.segments[0].answers);
  assert.equal(Persistence.decode(Persistence.encode(stale), edges, legacyRoadPath), null, `segment 1 rejects stale ${futureData} data`);
}

for (const currentSegment of [0, 1]) {
  const answeredActiveSegment = currentSegment === 0 ? structuredClone(drawSegmentSource) : structuredClone(source);
  answeredActiveSegment.currentSegment = currentSegment;
  answeredActiveSegment.phase = "draw-segment";
  answeredActiveSegment.segments[currentSegment].reached = true;
  answeredActiveSegment.segments[currentSegment].arrow = structuredClone(source.segments[0].arrow);
  answeredActiveSegment.segments[currentSegment].answers = structuredClone(source.segments[0].answers);
  assert.equal(Persistence.decode(Persistence.encode(answeredActiveSegment), edges, legacyRoadPath), null, `answered segment ${currentSegment + 1} cannot restore as editable`);
}

const legacyTrace = Array.from({ length: 18 }, (_, index) => index < 9
  ? [2 + index, 0]
  : [10, index - 8]);
const legacy = {
  ...encoded,
  currentSegment: 0,
  traceFormat: undefined,
  person: [10, 9],
  segments: [
    { reached: false, routeDistance: 244.3, trace: legacyTrace, arrow: null, answers: null },
    { reached: false, routeDistance: 0, trace: [], arrow: null, answers: null }
  ]
};
function legacyRoadPath(from, to) {
  const a = Array.isArray(from) ? { x: from[0], y: from[1] } : from;
  const b = Array.isArray(to) ? { x: to[0], y: to[1] } : to;
  if (a.y === b.y || a.x === b.x) return [a, b];
  return [a, { x: 10, y: 0 }, b];
}
const migrated = Persistence.decode(legacy, edges, legacyRoadPath);
assert.ok(migrated?.legacy, "legacy 18-point snapshot uses production migration");
assert.equal(migrated.segments[0].routeDistance, 244.3, "legacy migration does not change distance");
migrated.segments[0].coverage.forEach((interval) => {
  const points = Coverage.intervalPoints(interval, edgeById);
  assert.ok(points, "legacy output references a scene edge");
  const edge = edgeById[interval.edgeId];
  points.forEach((point) => {
    const cross = (point.x - edge.a.x) * (edge.b.y - edge.a.y) - (point.y - edge.a.y) * (edge.b.x - edge.a.x);
    assert.ok(Math.abs(cross) < 1e-9, "legacy output has no diagonal segments");
  });
});

const corrupt = structuredClone(encoded);
corrupt.segments[0].coverage = [[99, 0, 1]];
assert.equal(Persistence.decode(corrupt, edges, legacyRoadPath), null, "unknown edge id is rejected");
for (const distance of [-1, NaN, Infinity]) {
  const damaged = structuredClone(encoded);
  damaged.segments[0].routeDistance = distance;
  assert.equal(Persistence.decode(damaged, edges, legacyRoadPath), null, `invalid distance ${distance} is rejected`);
}
{
  const damaged = structuredClone(encoded);
  damaged.phase = "draw-total";
  assert.equal(Persistence.decode(damaged, edges, legacyRoadPath), null, "draw-total requires completed segment answers and a total arrow");
}
{
  const damaged = structuredClone(encoded);
  damaged.segments[0].answers.direction = null;
  assert.equal(Persistence.decode(damaged, edges, legacyRoadPath), null, "malformed answers are rejected");
}
for (const direction of [
  { directionType: "up" },
  { directionType: "north", angle: 10 },
  { directionType: "south-west", angle: 91 }
]) {
  const damaged = structuredClone(encoded);
  damaged.segments[0].answers.direction = direction;
  assert.equal(Persistence.decode(damaged, edges, legacyRoadPath), null, `invalid production direction ${JSON.stringify(direction)} is rejected`);
}
const envelope = { version: 1, activity: "displacement-distance-map-journey", kind: "draft", answer: encoded };
assert.ok(Buffer.byteLength(JSON.stringify(envelope), "utf8") < 4000, "production snapshot envelope fits suspend_data");

console.log("Map persistence integration checks passed");
