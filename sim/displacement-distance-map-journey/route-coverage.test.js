"use strict";

const assert = require("node:assert/strict");
const Coverage = require("./route-coverage.js");
const { routeCompletion } = require("./scoring.js");

const edges = [
  { id: 0, a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
  { id: 1, a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
  { id: 2, a: { x: 10, y: 10 }, b: { x: 20, y: 10 } }
];
const edgeById = Object.fromEntries(edges.map((edge) => [edge.id, edge]));

let coverage = [];
coverage = Coverage.addPath(coverage, edges, [{ x: 2, y: 0 }, { x: 7, y: 0 }]);
assert.deepEqual(Coverage.compact(coverage), [[0, 0.2, 0.7]], "partial edge is preserved");

coverage = Coverage.addPath(coverage, edges, [{ x: 7, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }]);
assert.deepEqual(Coverage.compact(coverage), [[0, 0.2, 1], [1, 0, 0.6]], "turns remain on their two road edges");

const beforeRepeat = JSON.stringify(Coverage.compact(coverage));
coverage = Coverage.addPath(coverage, edges, [{ x: 10, y: 6 }, { x: 10, y: 2 }, { x: 10, y: 6 }]);
assert.equal(JSON.stringify(Coverage.compact(coverage)), beforeRepeat, "backtracking and duplicate coverage merge");

for (let index = 0; index < 200; index += 1) {
  coverage = Coverage.addPath(coverage, edges, [
    { x: index % 2 ? 10 : 0, y: 0 },
    { x: index % 2 ? 0 : 10, y: 0 }
  ]);
}
assert.deepEqual(Coverage.compact(coverage)[0], [0, 0, 1], "large wandering does not grow repeated edge data");

const compact = Coverage.compact(coverage);
const restored = Coverage.expand(compact, edges);
assert.deepEqual(Coverage.compact(restored), compact, "save and restore preserve visual coverage");
restored.forEach((interval) => {
  const points = Coverage.intervalPoints(interval, edgeById);
  assert.ok(points, "every restored interval references a road");
  const edge = edgeById[interval.edgeId];
  points.forEach((point) => {
    const cross = (point.x - edge.a.x) * (edge.b.y - edge.a.y) - (point.y - edge.a.y) * (edge.b.x - edge.a.x);
    assert.ok(Math.abs(cross) < 1e-9, "restored geometry stays on the road");
  });
});

assert.equal(Coverage.expand([[99, 0, 1]], edges), null, "unknown edge ids fail safely");
assert.equal(Coverage.expand([[0, -0.1, 1]], edges), null, "out-of-range intervals fail safely");

const legacy = Coverage.fromLegacyTrace(
  [[2, 0], [10, 0], [10, 6]],
  edges,
  (from, to) => [
    { x: from[0], y: from[1] },
    { x: to[0], y: to[1] }
  ]
);
assert.deepEqual(Coverage.compact(legacy), [[0, 0.2, 1], [1, 0, 0.6]], "legacy coordinate traces safely become road coverage");

const sameEdgeCompletion = routeCompletion(
  { x: 2, y: 0 },
  { x: 8, y: 0 },
  (from, to) => ({ distance: 6, points: [from, to] })
);
assert.deepEqual(
  Coverage.compact(Coverage.addPath([], edges, [{ x: 2, y: 0 }, ...sameEdgeCompletion.points])),
  [[0, 0.2, 0.8]],
  "final same-edge snap includes its starting point"
);
const crossEdgeCompletion = routeCompletion(
  { x: 2, y: 0 },
  { x: 10, y: 6 },
  (from, to) => ({ distance: 14, points: [from, { x: 10, y: 0 }, to] })
);
assert.deepEqual(
  Coverage.compact(Coverage.addPath([], edges, [{ x: 2, y: 0 }, ...crossEdgeCompletion.points])),
  [[0, 0.2, 1], [1, 0, 0.6]],
  "final cross-edge snap includes the first and later road portions"
);

const routeDistance = 244.3;
Coverage.addPath(restored, edges, [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
assert.equal(routeDistance, 244.3, "visual coverage does not alter independently accumulated distance");

const worstCase = {
  version: 1,
  activity: "displacement-distance-map-journey",
  kind: "draft",
  answer: {
    seed: 4294967295,
    routeIds: [4, 3, 2],
    currentSegment: 1,
    phase: "ready-submit",
    traceFormat: 2,
    person: [120, 80],
    segments: [0, 1].map(() => ({
      reached: true,
      routeDistance: 9999.9,
      coverage: Array.from({ length: 30 }, (_, id) => [id, 0, 1]),
      arrow: { tail: [0, 0], head: [120, 80] },
      answers: { routeDistance: 9999.9, displacementMagnitude: 999.9, direction: { x: -1, y: 1 } }
    })),
    totalArrow: { tail: [0, 0], head: [120, 80] },
    totalAnswers: { routeDistance: 9999.9, displacementMagnitude: 999.9, direction: { x: -1, y: 1 } }
  }
};
assert.ok(Buffer.byteLength(JSON.stringify(worstCase), "utf8") < 4000, "worst-case topology snapshot fits SCORM 1.2 suspend_data");

console.log("Map route coverage tests passed");
