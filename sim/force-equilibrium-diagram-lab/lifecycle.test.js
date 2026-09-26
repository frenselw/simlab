"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Flow = require("../shared/activity-flow.js"), P = require("./persistence.js"), M = require("./model.js"), S = require("./scoring.js"), G = require("./generator.js");
const { Controller } = require("./ui-runtime.js");
const scormCode = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
function environment(options = {}) {
  const durable = options.durable || {}, storage = options.storage || new Map(), flags = options.flags || {};
  const values = { ...durable }, events = {}, stats = { commits: 0, writes: 0, finishes: 0, storageReads: 0, storageWrites: 0, storageRemoves: 0 }; let error = "0";
  const window = {
    location: { reload() {} }, addEventListener(name, fn) { events[name] = fn; },
    localStorage: {
      getItem(k) { stats.storageReads++; if (flags.storageReadFail) throw new Error("read"); return storage.get(k) ?? null; },
      setItem(k, v) {
        stats.storageWrites++; if (flags.storageWriteFail) throw new Error("write");
        storage.set(k, v);
      },
      removeItem(k) { stats.storageRemoves++; if (flags.storageRemoveFail) throw new Error("remove"); storage.delete(k); }
    }
  };
  window.parent = window; window.top = window;
  if (!options.standalone) window.API = {
    LMSInitialize: () => "true",
    LMSGetValue(k) { error = flags.readFail === k ? "101" : "0"; return error === "0" ? values[k] || "" : ""; },
    LMSSetValue(k, v) { stats.writes++; if (flags.writeFail === k) { error = "351"; return "false"; } values[k] = String(v); error = "0"; return "true"; },
    LMSCommit() { stats.commits++; if (flags.commitFail) { error = "391"; return "false"; } Object.assign(durable, values); error = "0"; return "true"; },
    LMSFinish() { stats.finishes++; error = flags.finishFail ? "101" : "0"; return flags.finishFail ? "false" : "true"; },
    LMSGetLastError: () => error, LMSGetErrorString: () => "test fixture", LMSGetDiagnostic: () => ""
  };
  vm.runInNewContext(scormCode, { window, console: { info() {}, warn() {}, error() {}, log() {} }, TextEncoder, setTimeout, clearTimeout });
  const presentations = [], c = new Controller(window.SimScorm, Flow, current => presentations.push({ mode: current.mode, editable: current.editable, score: current.result?.score ?? null }), () => options.seed ?? 21);
  c.start(); return { c, scorm: window.SimScorm, durable, storage, flags, stats, events, presentations };
}
function drawOne(c) { c.command({ type: "add", kind: 0 }); c.command({ type: "place", index: 0, angle: 270, length: 500 }); }
function filled() { const s = P.fresh(21); s.answers = G.generate(21).questions.map(q => q.expected.map(f => [f.kind, Math.round(f.angle * 10) % 3600, 500])); return s; }
function finishedData(state) {
  const score = S.score(state), review = { version: 1, activity: P.ACTIVITY, kind: "review", answer: P.review(state), score: score.score, passed: score.passed };
  return { "cmi.core.lesson_status": score.passed ? "passed" : "failed", "cmi.core.score.raw": String(score.score), "cmi.suspend_data": JSON.stringify(review) };
}
for (const content of ["blank", "pending", "partial", "full"]) {
  const e = environment(); assert.equal(e.c.mode, "edit");
  if (content === "pending") e.c.command({ type: "add", kind: 3 });
  if (content === "partial") drawOne(e.c);
  if (content === "full") e.c.state = filled();
  e.c.check(); assert.equal(e.c.mode, "check"); const before = P.review(e.c.state), score = S.score(e.c.state);
  e.c.submit(); assert.equal(e.c.mode, "review"); assert.equal(e.c.result.score, score.score); assert.equal(e.c.trusted, true);
  const saved = JSON.stringify(e.c.state); assert.equal(e.c.setAnswer([]), false); assert.equal(JSON.stringify(e.c.state), saved);
  e.c.navigate(3); assert.equal(e.c.reviewIndex, 3, "read-only legal continuation");
  const reopened = environment({ durable: e.durable }); assert.equal(reopened.c.mode, "review"); assert.deepEqual(P.review(reopened.c.state), before);
  const frozen = environment(); frozen.c.state = { ...M.clone(before), phase: "edit", current: 0, returnToCheck: false };
  frozen.c.check(); frozen.flags.writeFail = "cmi.core.score.raw"; frozen.c.submit();
  assert.equal(frozen.c.mode, "frozen");
  const continued = environment({ durable: frozen.durable });
  assert.equal(continued.c.mode, "frozen"); assert.deepEqual(P.review(continued.c.state), before);
  continued.c.retryFinal(); assert.equal(continued.c.mode, "review"); assert.equal(continued.c.result.score, score.score);
}
const e = environment(); drawOne(e.c); e.c.check(); e.c.navigate(3); assert.equal(e.c.state.returnToCheck, true);
const restored = environment({ durable: e.durable }); assert.deepEqual(restored.c.state, e.c.state); restored.c.check();
for (const [failure, expected] of [["commitFail", "frozen"], ["finishFail", "committed"], ["writeFail", "frozen"]]) {
  const t = environment(); drawOne(t.c); t.c.check();
  t.flags[failure] = failure === "writeFail" ? "cmi.core.score.raw" : true;
  const answers = P.review(t.c.state); t.c.submit(); assert.equal(t.c.mode, expected); assert.equal(t.c.editable, false);
  if (expected === "frozen") { assert.equal(t.c.result, null); assert.equal(t.c.trusted, false); }
  t.flags[failure] = false; t.c.retryFinal(); assert.equal(t.c.mode, "review"); assert.deepEqual(P.review(t.c.state), answers);
}
const pending = environment(); drawOne(pending.c); pending.c.check(); pending.flags.writeFail = "cmi.core.score.raw"; pending.c.submit();
const corruptPending = M.clone(pending.durable);
const pendingReload = environment({ durable: pending.durable }); assert.equal(pendingReload.c.mode, "frozen"); pendingReload.c.navigate(2); pendingReload.c.retryFinal(); assert.equal(pendingReload.c.mode, "review");
const outer = JSON.parse(corruptPending["cmi.suspend_data"]), inner = JSON.parse(outer.payload.reviewJson);
inner.answer.answers[0] = [[0, null, 10]]; outer.payload.reviewJson = JSON.stringify(inner); corruptPending["cmi.suspend_data"] = JSON.stringify(outer);
const quarantined = environment({ durable: corruptPending }); assert.equal(quarantined.c.mode, "technical"); assert.equal(quarantined.stats.writes, 0);
assert.equal(quarantined.scorm.retryPending().reason, "no-pending"); quarantined.events.pagehide({ persisted: false }); assert.equal(quarantined.stats.writes, 0);
for (const mutate of [d => { d["cmi.core.score.raw"] = "19"; }, d => { d["cmi.core.lesson_status"] = "completed"; }, d => { d["cmi.suspend_data"] = "broken"; }, d => { const s = JSON.parse(d["cmi.suspend_data"]); s.answer.answers.pop(); d["cmi.suspend_data"] = JSON.stringify(s); }]) {
  const d = finishedData(filled()); mutate(d); const t = environment({ durable: d });
  assert.equal(t.c.mode, "mismatch"); assert.equal(t.c.editable, false); assert.equal(t.c.canRecover, false); assert.equal(t.stats.writes, 0);
}
const failure = environment({ flags: { readFail: "cmi.suspend_data" } }); assert.equal(failure.c.mode, "technical"); assert.equal(failure.stats.writes, 0);
for (const retryable of [true, false]) {
  const t = environment(); t.c.check(); t.c.handleOutcome({ activityState: "retry", retryable }); assert.equal(t.c.mode, retryable ? "check" : "technical");
}
// Confirmed callbacks must compare authoritative geometry, even when totals match.
const mismatch = environment(); mismatch.c.check(); const zero = S.score(mismatch.c.state);
mismatch.c.finalSnapshot = mismatch.scorm.makeSnapshot(P.ACTIVITY, "review", P.review(mismatch.c.state), zero);
const other = M.clone(mismatch.c.finalSnapshot); other.answer.seed = 22;
mismatch.c.handleOutcome({ activityState: "success", review: other, score: 0, status: "failed" }); assert.equal(mismatch.c.mode, "technical");
const local = environment({ standalone: true }); drawOne(local.c);
const localReload = environment({ standalone: true, storage: local.storage, seed: 22 });
assert.deepEqual(localReload.c.state, P.fresh(22), "standalone draft refresh starts a new round");
local.c.check(); local.c.submit(); assert.equal(local.c.mode, "review");
assert.equal(local.c.setAnswer([]), false, "the submitted page itself stays read-only");
assert.equal(local.c.recoverDraft(), false);
const newRound = environment({ standalone: true, storage: local.storage, seed: 23 });
assert.deepEqual(newRound.c.state, P.fresh(23), "standalone submitted refresh starts a new round");
newRound.c.command({ type: "add", kind: 1 }); assert.equal(newRound.c.state.answers[newRound.c.familyIndex].length, 1, "legal continuation after refresh");
const noStorage = environment({ standalone: true, flags: { storageReadFail: true, storageWriteFail: true, storageRemoveFail: true } });
drawOne(noStorage.c); assert.equal(noStorage.c.unsaved, false); noStorage.c.check(); noStorage.c.submit(); assert.equal(noStorage.c.mode, "review");
const badDraft = { version: 1, activity: P.ACTIVITY, kind: "draft", answer: { ...P.fresh(21), current: null } };
const invalidDraft = environment({ durable: { "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify(badDraft) } });
assert.equal(invalidDraft.c.canRecover, true); assert.equal(invalidDraft.c.recoverDraft(), true); assert.equal(invalidDraft.c.mode, "edit");
// Existing installations may still have checkpoints from the old opt-in policy.
// Neither old finished work nor an unreadable checkpoint may trap local practice.
for (const checkpoint of [JSON.stringify(finishedData(filled())), JSON.stringify(corruptPending), JSON.stringify({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify(badDraft) }), "corrupt checkpoint"]) {
  const storage = new Map([[`simlab:${P.ACTIVITY}:checkpoint`, checkpoint]]);
  const fresh = environment({ standalone: true, storage });
  assert.equal(fresh.c.mode, "edit"); assert.deepEqual(fresh.c.state, P.fresh(21));
  drawOne(fresh.c); fresh.c.check(); fresh.c.submit(); assert.equal(fresh.c.mode, "review");
  assert.equal(fresh.stats.storageReads + fresh.stats.storageWrites + fresh.stats.storageRemoves, 0);
  assert.equal(storage.get(`simlab:${P.ACTIVITY}:checkpoint`), checkpoint, "old evidence is not deleted or overwritten");
}
console.log("equilibrium lifecycle: shared SCORM outcomes/trust/quarantine, immutable Moodle review and fresh standalone reload passed");
