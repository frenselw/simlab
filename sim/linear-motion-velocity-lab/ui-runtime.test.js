"use strict";

const assert = require("assert");
const Model = require("./motion-model.js");
const UiPolicy = require("./ui-policy.js");

const result = { score: 100, passed: true };
const hiddenCases = [
  ["answer", { locked: false, trustedReview: true, result: null }],
  ["pre-submit review", { locked: false, trustedReview: true, result: null }],
  ["review edit", { locked: false, trustedReview: true, result: null }],
  ["locked save failure", { locked: true, trustedReview: false, result: null }],
  ["frozen", { locked: true, trustedReview: false, result: null }],
  ["retry", { locked: false, trustedReview: false, result: null }],
  ["load error", { locked: true, trustedReview: false, result: null }]
];
hiddenCases.forEach(([name, context]) => assert.strictEqual(UiPolicy.canRevealSolution(context), false, `${name} cannot reveal`));
for (const name of ["success", "committed"]) {
  assert.strictEqual(UiPolicy.canRevealSolution({ locked: true, trustedReview: true, result }), true, `${name} trusted review reveals`);
}
assert.strictEqual(UiPolicy.canRevealSolution({ locked: true, trustedReview: false, result }), false, "untrusted restored result cannot reveal");

const forged = UiPolicy.reviewOutcome(
  { score: 0, maxScore: 100, passed: false, completed: true, feedbackItems: [{ title: "secret" }] },
  { score: 100, passed: true },
  { score: 100, status: "passed" }
);
assert.strictEqual(forged.trusted, false, "a decoded but forged pending review is not trusted");
assert.deepStrictEqual(forged.result.feedbackItems, [], "forged pending data receives only the LMS summary");
assert.strictEqual(forged.result.score, 100);
assert.strictEqual(forged.result.passed, true);
const consistent = UiPolicy.reviewOutcome(
  { score: 100, maxScore: 100, passed: true, completed: true, feedbackItems: [] },
  { score: 100, passed: true },
  { score: 100, status: "passed" }
);
assert.strictEqual(consistent.trusted, true);

const definition = Model.createAttempt(77123);
for (const row of UiPolicy.analysisRows(definition)) {
  assert.strictEqual(row.averageVelocity, Model.canonicalNumber(row.displacement / row.duration), "production table values are mutually derivable");
}

const graph = UiPolicy.graphAnalysis(definition);
assert.strictEqual(graph.points.length, 90);
assert.strictEqual(UiPolicy.graphAnalysis(definition), graph, "production graph geometry and points are cached by definition");
assert(Object.isFrozen(graph.points) && graph.points.every(Object.isFrozen));

class FakeNode {
  constructor(tagName = "#text", textContent = "") {
    this.tagName = tagName;
    this.textContent = textContent;
    this.children = [];
    this.attributes = {};
  }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}
const fakeDocument = {
  createElement: (name) => new FakeNode(name),
  createTextNode: (text) => new FakeNode("#text", text)
};
const container = new FakeNode("div");
UiPolicy.appendPredictionOptions(container, definition.instantOptions, fakeDocument);
assert.strictEqual(container.children.length, 4);
const renderedInputs = container.children.map((label) => label.children[0]);
assert.deepStrictEqual(renderedInputs.map((input) => input.value).sort(), ["o1", "o2", "o3", "o4"]);
assert(renderedInputs.every((input) => input.tagName === "input" && input.type === "radio" && input.name === "prediction"));
UiPolicy.appendPredictionOptions(container, definition.instantOptions, fakeDocument);
assert.strictEqual(container.children.length, 4, "production option rendering is idempotent");

const hostile = JSON.parse(JSON.stringify(definition));
hostile.instantOptions[0].id = 'x\"><img src=x onerror=alert(1)>';
assert.strictEqual(Model.validateDefinition(hostile), false, "restored hostile option IDs are rejected before rendering");

const origin = UiPolicy.stageReadingOrigin(definition, "uniform");
const before = UiPolicy.displayedPosition(definition, "uniform", 49.99);
const after = UiPolicy.displayedPosition(definition, "uniform", 50);
assert.strictEqual(origin, definition.uniform.coordinateOrigin);
assert(after > before, "production display remains continuous across a 50 m world boundary");
const startMeasurement = { readingOrigin: origin };
assert.strictEqual(UiPolicy.displayedPosition(definition, "uniform", 50, startMeasurement), after, "stopwatch start retains the visible origin without a jump");

assert.strictEqual(UiPolicy.isLegacySnapshot({ v: 5 }, 6), true, "v5 draft takes the explicit legacy restart path");
assert.strictEqual(UiPolicy.isLegacySnapshot({ v: 6 }, 6), false);

console.log("Linear motion production UI helper tests passed");
