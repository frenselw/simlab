"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Flow = require("../shared/activity-flow.js"), P = require("./persistence.js"), M = require("./model.js"), S = require("./scoring.js"), G = require("./generator.js");
const { Controller } = require("./ui-runtime.js");
const scormCode = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
function environment(options = {}) {
  const durable = options.durable || {}, storage = options.storage || new Map(), flags = options.flags || {};
  const values = { ...durable }, events = {}, stats = { commits: 0, writes: 0, finishes: 0 }; let error = "0";
  const window = {
    location: { reload() {} }, addEventListener(name, fn) { events[name] = fn; },
    localStorage: {
      getItem(k) { if (flags.storageReadFail) throw new Error("read"); return storage.get(k) ?? null; },
      setItem(k, v) {
        if (flags.storageWriteFail || (flags.storageFinalFail && k.endsWith(":checkpoint") && ["passed", "failed"].includes(JSON.parse(v)["cmi.core.lesson_status"]))) throw new Error("write");
        storage.set(k, v);
      },
      removeItem(k) { if (flags.storageRemoveFail) throw new Error("remove"); storage.delete(k); }
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
  const presentations = [], c = new Controller(window.SimScorm, Flow, current => presentations.push({ mode: current.mode, editable: current.editable, score: current.result?.score ?? null }), () => 21);
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
const localRestore = environment({ standalone: true, storage: local.storage }); assert.deepEqual(localRestore.c.state, local.c.state);
localRestore.c.check(); localRestore.c.submit(); const localReview = environment({ standalone: true, storage: local.storage }); assert.equal(localReview.c.mode, "review");
const localFail = environment({ standalone: true }); localFail.flags.storageWriteFail = true; drawOne(localFail.c); assert.equal(localFail.c.unsaved, true);
assert.equal(environment({ standalone: true, flags: { storageReadFail: true } }).c.mode, "technical");
const localPending = environment({ standalone: true }); drawOne(localPending.c); localPending.c.check();
localPending.flags.storageFinalFail = true; localPending.c.submit(); assert.equal(localPending.c.mode, "frozen"); assert.equal(localPending.c.result, null);
const localPendingReload = environment({ standalone: true, storage: localPending.storage }); assert.equal(localPendingReload.c.mode, "frozen");
localPendingReload.c.retryFinal(); assert.equal(localPendingReload.c.mode, "review"); assert.equal(localPendingReload.c.recoverDraft(), false);
const badDraft = { version: 1, activity: P.ACTIVITY, kind: "draft", answer: { ...P.fresh(21), current: null } };
const invalidDraft = environment({ durable: { "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify(badDraft) } });
assert.equal(invalidDraft.c.canRecover, true); assert.equal(invalidDraft.c.recoverDraft(), true); assert.equal(invalidDraft.c.mode, "edit");
const localDraft = environment({ standalone: true });
const checkpointKey = [...localDraft.storage.keys()].find(k => k.endsWith(":checkpoint"));
const bundle = JSON.parse(localDraft.storage.get(checkpointKey)); bundle["cmi.suspend_data"] = JSON.stringify(badDraft);
localDraft.storage.set(checkpointKey, JSON.stringify(bundle));
const localRecovery = environment({ standalone: true, storage: localDraft.storage }); assert.equal(localRecovery.c.canRecover, true);
localRecovery.flags.storageRemoveFail = true; assert.equal(localRecovery.c.recoverDraft(), false); assert.equal(localRecovery.c.mode, "technical");
localRecovery.flags.storageRemoveFail = false; assert.equal(localRecovery.c.recoverDraft(), "reload");
assert.equal(environment({ standalone: true, storage: localRecovery.storage }).c.mode, "edit");
console.log("equilibrium lifecycle: actual shared SCORM startup/submission/retry/quarantine, trust, storage failures and immutable review passed");
