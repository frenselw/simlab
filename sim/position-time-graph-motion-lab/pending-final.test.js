"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const P = require("./persistence.js");
const S = require("./scoring.js");
const G = require("./generator.js");

const activity = "position-time-graph-motion-lab";
const source = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
const seed = "0123456789abcdeffedcba9876543210";
const state = P.createExplore(8, 2);
assert.equal(P.startGeneratedAssessment(state, seed, G.generatePaper(seed)), true);
state.assessment.seen.fill(true);
state.phase = "final-review";
state.variant = "ready";
state.currentStep = null;
state.assessment.ans = {
  m1: { x0: -8, v: -2 },
  m2: { xStart: -20, xEnd: 20 },
  m3: { A: { probes: [0, 6], velocity: -2 }, B: { probes: [6, 0], velocity: 2 }, faster: "same" },
  m4: { x0: 8, v: 2 },
  m5: { x0B: -8, vB: 2, meetingX: 20 }
};
const result = S.scoreAssessment(state.assessment);

function runtimeWithFailure(failCommitNumber = 0) {
  const durable = {};
  const buffer = {};
  const commitSnapshots = [];
  let commits = 0;
  let lastError = "0";
  const api = {
    LMSInitialize: () => "true",
    LMSSetValue(key, value) { buffer[key] = String(value); lastError = "0"; return "true"; },
    LMSGetValue: (key) => buffer[key] || durable[key] || "",
    LMSCommit() {
      commits += 1;
      if (commits === failCommitNumber) { lastError = "101"; return "false"; }
      Object.assign(durable, buffer);
      commitSnapshots.push(durable["cmi.suspend_data"]);
      lastError = "0";
      return "true";
    },
    LMSFinish: () => "true",
    LMSGetLastError: () => lastError,
    LMSGetErrorString: () => "forced final commit failure"
  };
  const listeners = {};
  const window = { API: api, opener: null, addEventListener(name, handler) { listeners[name] = handler; } };
  window.parent = window;
  window.top = window;
  vm.runInNewContext(source, { window, console, JSON, TextEncoder });
  return { SimScorm: window.SimScorm, durable, commitSnapshots };
}

function prepare(runtime) {
  const draft = runtime.SimScorm.makeSnapshot(activity, "draft", P.encodeDraft(state));
  const review = runtime.SimScorm.makeSnapshot(activity, "review", P.encodeReview(state), result);
  return { draft, review };
}

const successful = runtimeWithFailure();
const successfulPayload = prepare(successful);
const successOutcome = successful.SimScorm.submitResult(result, successfulPayload.review);
assert.equal(successOutcome.ok, true, "fully populated generated review succeeds through the actual shared submission path");
const successCheckpoint = JSON.parse(successful.commitSnapshots[0]);
assert.equal(successCheckpoint.kind, "pending-final", "shared runtime first commits a generated pending-final checkpoint");
assert.equal(successCheckpoint.payload.reviewJson, JSON.stringify(successfulPayload.review), "successful path keeps the exact generated review payload");
assert.equal(successful.durable["cmi.suspend_data"], JSON.stringify(successfulPayload.review), "successful final write replaces pending data with the same review payload");

const failing = runtimeWithFailure(2);
const failingPayload = prepare(failing);
const frozenOutcome = failing.SimScorm.submitResult(result, failingPayload.review);
assert.equal(frozenOutcome.frozen, true, "actual shared generated submission freezes after final commit failure");
const checkpointText = failing.durable["cmi.suspend_data"];
const checkpoint = JSON.parse(checkpointText);
assert.equal(checkpoint.kind, "pending-final");
assert.equal(checkpoint.payload.reviewJson, JSON.stringify(failingPayload.review), "commit failure durably freezes the exact generated review payload");
const retry = failing.SimScorm.retryPending();
assert.equal(retry.ok, true, "pending generated submission can retry successfully");
assert.deepEqual(retry.review.answer, failingPayload.review.answer, "retry returns the same authoritative generated paper and answers");
assert.equal(failing.durable["cmi.suspend_data"], JSON.stringify(failingPayload.review), "retry writes exactly the originally frozen review payload");

const sizes = {
  draft: Buffer.byteLength(JSON.stringify(successfulPayload.draft), "utf8"),
  review: Buffer.byteLength(JSON.stringify(successfulPayload.review), "utf8"),
  pending: Buffer.byteLength(JSON.stringify(successCheckpoint), "utf8")
};
assert.ok(Object.values(sizes).every((bytes) => bytes < 4000), `fully populated production snapshots fit suspend_data: ${JSON.stringify(sizes)}`);

console.log(`Position-time generated pending-final shared-path checks passed; snapshot bytes ${JSON.stringify(sizes)}`);
