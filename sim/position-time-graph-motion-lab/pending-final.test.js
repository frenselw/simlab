"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const P = require("./persistence.js");
const S = require("./scoring.js");

const source = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
const durable = {};
let buffer = {};
let commits = 0;
let lastError = "0";
const api = {
  LMSInitialize: () => "true",
  LMSSetValue(key, value) { buffer[key] = String(value); lastError = "0"; return "true"; },
  LMSGetValue: (key) => buffer[key] || durable[key] || "",
  LMSCommit() {
    commits += 1;
    if (commits === 2) { lastError = "101"; return "false"; }
    Object.assign(durable, buffer);
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

const state = P.createExplore(8, 2);
P.startAssessment(state, "alpha");
state.assessment.seen.fill(true);
state.assessment.ans = {
  m1: { x0: -8, v: -2 },
  m2: { xStart: -20, xEnd: 20 },
  m3: { A: { probes: [0, 6], velocity: -2 }, B: { probes: [6, 0], velocity: 2 }, faster: "same" },
  m4: { x0: 8, v: 2 },
  m5: { x0B: -8, vB: 2, meetingX: 20 }
};
const set = S.getScenarioSet(1, "alpha");
const result = S.scoreAssessment(state.assessment.ans, set);
const review = window.SimScorm.makeSnapshot("position-time-graph-motion-lab", "review", P.encodeReview(state), result);
const outcome = window.SimScorm.submitResult(result, review);
assert.equal(outcome.frozen, true, "actual shared submission path freezes after final commit failure");
const checkpoint = durable["cmi.suspend_data"];
assert.ok(checkpoint, "actual shared runtime durably writes pending-final first");
assert.equal(JSON.parse(checkpoint).kind, "pending-final");
assert.ok(Buffer.byteLength(checkpoint, "utf8") < 4000, "maximum production-shaped review stays under the pending-final byte ceiling");

console.log("Position-time pending-final shared-path checks passed");
