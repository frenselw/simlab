"use strict";

const assert = require("node:assert/strict");
const Ui = require("./ui-runtime.js");

const context = { phase: "mission", step: 2, locked: false, technical: false, playing: false, time: 0 };
assert.equal(Ui.dragAllowed("car:A", context), false, "fixed mission 3 car rejects pointer and keyboard drag");
assert.equal(Ui.dragAllowed("velocity:B", context), false, "fixed mission 3 velocity rejects pointer and keyboard drag");
assert.equal(Ui.dragAllowed("probe:A:0", context), true, "mission 3 probe remains interactive");
assert.equal(Ui.dragAllowed("faster", context), true, "mission 3 comparison token remains interactive");
assert.equal(Ui.dragAllowed("car:B", { ...context, step: 4 }), true, "only learner B car is interactive in mission 5");
assert.equal(Ui.dragAllowed("car:A", { ...context, step: 4 }), false, "fixed A car is never interactive in mission 5");
assert.equal(Ui.dragAllowed("graph:xStart", { ...context, step: 1 }), true, "mission 2 graph point is interactive");
assert.equal(Ui.dragAllowed("graph:xStart", { ...context, step: 1, locked: true }), false, "submitted graph point is read-only");
assert.equal(Ui.dragAllowed("initial:x0", { ...context, step: 0 }), true, "mission 1 initial graph point is interactive at zero seconds");
assert.equal(Ui.dragAllowed("initial:x0", { ...context, step: 3 }), true, "mission 4 initial graph point is interactive at zero seconds");
assert.equal(Ui.dragAllowed("initial:x0", { ...context, step: 0, time: 0.5 }), false, "initial graph point locks after playback moves away from zero seconds");
assert.equal(Ui.dragAllowed("initial:x0", { ...context, step: 4 }), false, "mission 5 graph does not silently gain an initial-point control");

const original = { phase: "mission", step: 0 };
let calls = 0;
let outcome = Ui.transitionWithSave(original, (next) => { next.step = 1; }, () => { calls += 1; return calls === 1; });
assert.equal(outcome.ok, false, "failed post-transition save blocks navigation");
assert.equal(outcome.stage, "after");
assert.deepEqual(outcome.state, original, "failed navigation restores the last saved state");
outcome = Ui.transitionWithSave(original, (next) => { next.step = 1; }, () => true);
assert.deepEqual(outcome.state, { phase: "mission", step: 1 }, "successful transition advances");

const focused = { dataset: { focusKey: "quantity:x0" } };
assert.equal(Ui.focusKey(focused), "focus:quantity:x0");
const replacement = { dataset: { focusKey: "quantity:x0" }, calls: 0, focus() { this.calls += 1; } };
assert.equal(Ui.restoreFocus({ querySelectorAll: () => [replacement] }, "focus:quantity:x0"), true);
assert.equal(replacement.calls, 1, "semantic focus survives a render replacement");
const svgReplacement = { dataset: { drag: "probe:A:0" }, calls: 0, focus() { this.calls += 1; } };
assert.equal(Ui.restoreFocus({ querySelectorAll: () => [svgReplacement] }, "drag:probe:A:0"), true);
assert.equal(svgReplacement.calls, 1, "SVG focus survives a render replacement");
let adjusted = 0;
for (let press = 0; press < 2; press += 1) {
  adjusted = Ui.adjustByArrow(adjusted, "ArrowRight", 1, -8, 8);
  Ui.restoreFocus({ querySelectorAll: () => [svgReplacement] }, "drag:probe:A:0");
}
assert.equal(adjusted, 2, "two consecutive Arrow presses continue to adjust after rerenders");
assert.equal(svgReplacement.calls, 3, "semantic SVG focus is restored after every Arrow render");

function fakeDocument() {
  return { createElement: () => ({ listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; }, click() { this.listeners.click(); } }) };
}
const host = { ownerDocument: fakeDocument(), children: [], replaceChildren(...children) { this.children = children; } };
let retries = 0;
Ui.renderRetryAction(host, "retry-pending", () => { retries += 1; });
Ui.renderRetryAction(host, "retry-pending", () => { retries += 1; });
assert.equal(host.children.length, 1, "retry action remains after an authoritative rerender");
host.children[0].click();
assert.equal(retries, 1, "rerendered retry button executes the pending retry handler");

let finishes = 0;
Ui.renderFinishAction(host, true, () => { finishes += 1; });
Ui.renderFinishAction(host, true, () => { finishes += 1; });
assert.equal(host.children.length, 1, "finish retry remains after an authoritative rerender");
assert.equal(host.children[0].id, "retryFinish", "committed review exposes a dedicated finish action");
host.children[0].click();
assert.equal(finishes, 1, "finish retry calls only its finish handler once");
Ui.renderFinishAction(host, false, () => { finishes += 1; });
assert.equal(host.children.length, 0, "successful finish removes the retry action");

assert.equal(Ui.positionFromPointer(420, 20, 80, 760, -20, 20, 1), -1, "grab offset is preserved instead of snapping car center to the pointer");
assert.ok(Ui.hitRadius(800, 320) >= 55, "320px SVG hit radius yields at least a 44 CSS px target");
assert.ok(Ui.hitRadius(800, 390, 26, 52) >= 800 / 390 * 26, "graph endpoint radius yields at least a 52 CSS px touch target");

const optional = { velocity: 1 };
assert.equal(Ui.setOptional(optional, "velocity", Infinity, -2, 2), false, "non-finite input is rejected");
assert.equal(optional.velocity, 1, "rejected non-finite input preserves the last valid answer");
assert.equal(Ui.setOptional(optional, "velocity", 3, -2, 2), false, "out-of-range input is rejected");
assert.equal(optional.velocity, 1, "rejected out-of-range input preserves the last valid answer");
assert.equal(Ui.setOptional(optional, "velocity", -1.5, -2, 2), true, "valid input is accepted");
assert.equal(optional.velocity, -1.5);
assert.equal(Ui.setOptional(optional, "velocity", null, -2, 2), true, "empty optional input is accepted");
assert.equal("velocity" in optional, false, "empty optional input clears the answer");

console.log("Position-time UI runtime checks passed");
