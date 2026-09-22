"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(__dirname + "/scorm.js", "utf8");
const result = { score: 72, maxScore: 100, passed: true };

function launch(lms, location = "standalone", storage = null) {
  const listeners = {};
  const window = { API: lms?.api(), opener: null, localStorage: storage || undefined, location: { reloads: 0, reload() { this.reloads += 1; } }, setTimeout, clearTimeout, addEventListener: (name, fn) => { listeners[name] = fn; } };
  window.parent = location === "embedded" ? {} : window;
  window.top = location === "embedded" ? {} : window;
  vm.runInNewContext(source, { window, console, JSON, TextEncoder });
  return { scorm: window.SimScorm, listeners, window };
}

function storage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    failReads: false,
    failWrites: false,
    failOnWrite: null,
    writeCount: 0,
    getItem(key) { if (this.failReads) throw new Error("read denied"); return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { this.writeCount += 1; if (this.failWrites || (this.failOnWrite !== null && this.writeCount >= this.failOnWrite)) throw new Error("quota exceeded"); data[key] = String(value); },
    removeItem(key) { if (this.failWrites) throw new Error("quota exceeded"); delete data[key]; }
  };
}

function fakeLms(durable = {}) {
  const control = { fail: {}, calls: { commit: 0, finish: 0 }, durable, finished: false };
  control.api = () => {
    let buffer = { ...control.durable };
    let lastError = "0";
    const failed = (name) => { lastError = "101"; return control.fail[name]; };
    return {
      LMSInitialize: () => failed("initialize") ? "false" : "true",
      LMSSetValue(key, value) {
        control.calls[key] = (control.calls[key] || 0) + 1;
        if (failed(`set:${key}`) || control.failOnSet?.[key] === control.calls[key]) return "false";
        buffer[key] = value; lastError = "0"; return "true";
      },
      LMSGetValue(key) {
        control.calls[`get:${key}`] = (control.calls[`get:${key}`] || 0) + 1;
        if ((control.rejectReadsAfterFinish && control.finished) || failed(`get:${key}`) || control.failOnGet?.[key] === control.calls[`get:${key}`]) return "";
        lastError = "0"; return buffer[key] || "";
      },
      LMSCommit() { control.calls.commit += 1; if (failed("commit") || control.failOnCommitCall === control.calls.commit) return "false"; control.durable = { ...buffer }; lastError = "0"; return "true"; },
      LMSFinish() {
        control.calls.finish += 1;
        if (failed("finish")) return "false";
        if (control.finishSavesBuffer) control.durable = { ...buffer };
        control.finished = true;
        return "true";
      },
      LMSGetLastError: () => lastError,
      LMSGetErrorString: () => "fake LMS error"
    };
  };
  return control;
}
const review = (scorm) => scorm.makeSnapshot("activity", "review", { final: true }, result);

// Startup retry returns everything needed to render before finishing; post-finish reads may be rejected.
{
  const pendingLms = fakeLms();
  pendingLms.failOnCommitCall = 2;
  const first = launch(pendingLms);
  first.scorm.submitResult(result, review(first.scorm));
  pendingLms.failOnCommitCall = 0;
  pendingLms.rejectReadsAfterFinish = true;
  const second = launch(pendingLms);
  assert.equal(second.scorm.loadAttempt("activity").state, "pending-final");
  const retry = second.scorm.retryPending(false);
  assert.equal(retry.review.kind, "review");
  assert.equal(retry.score, 72);
  assert.equal(second.scorm.finish(), true);
  assert.equal(second.scorm.readValue("cmi.core.score.raw").ok, false);
}

// A later critical read failure is not silently treated as an empty/new attempt.
{
  const lms = fakeLms();
  lms.failOnGet = { "cmi.core.lesson_status": 1 };
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "read-error");
  assert.equal(lms.calls.commit, 0);
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.commit, 0);
  assert.equal(lms.calls.finish, 1);
}

// BFCache saves recoverable state without finishing, then reloads the restored page.
{
  const lms = fakeLms();
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "new");
  run.scorm.setDraftProvider(() => run.scorm.makeSnapshot("activity", "draft", { step: 2 }));
  run.listeners.pagehide({ persisted: true });
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).answer.step, 2);
  assert.equal(lms.calls.finish, 0);
  run.listeners.pageshow({ persisted: true });
  assert.equal(run.window.location.reloads, 1);
}
// Every final SetValue boundary leaves the durable pending payload recoverable.
for (const key of ["cmi.suspend_data", "cmi.core.score.min", "cmi.core.score.max", "cmi.core.score.raw", "cmi.core.lesson_status", "cmi.core.exit"]) {
  const lms = fakeLms();
  lms.failOnSet = { [key]: ["cmi.suspend_data", "cmi.core.lesson_status", "cmi.core.exit"].includes(key) ? 2 : 1 };
  const run = launch(lms);
  const outcome = run.scorm.submitResult(result, review(run.scorm));
  assert.equal(outcome.frozen, true, `${key} failure freezes the immutable submission`);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "pending-final", `${key} failure retains durable pending data`);
}

{
  const lms = fakeLms();
  const { scorm } = launch(lms);
  assert.equal(scorm.submitResult(result, review(scorm)).ok, true);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "review");
  assert.equal(lms.durable["cmi.core.lesson_status"], "passed");
}

// A failed final commit leaves only the durable pending checkpoint. A new launch can finish it.
{
  const lms = fakeLms();
  lms.failOnCommitCall = 2;
  const first = launch(lms);
  const outcome = first.scorm.submitResult(result, review(first.scorm));
  assert.equal(outcome.frozen, true);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "pending-final");
  const second = launch(lms);
  assert.equal(second.scorm.loadAttempt("activity").state, "pending-final");
  assert.equal(second.scorm.retryPending().ok, true);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "review");
}

// A visible frozen result must not be silently retried by unload after the
// LMS becomes available; only the learner's explicit retry owns that commit.
{
  const lms = fakeLms();
  lms.failOnCommitCall = 2;
  const run = launch(lms);
  assert.equal(run.scorm.submitResult(result, review(run.scorm)).frozen, true);
  lms.failOnCommitCall = 0;
  const finishesBeforeUnload = lms.calls.finish;
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.finish, finishesBeforeUnload, "unload does not implicitly retry a visible frozen submission");
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "pending-final");
}

// An activity can quarantine a structurally valid pending payload that fails
// its deeper authoritative-state validation. Pagehide must not finalize it.
{
  const reviewSnapshot = {
    version: 1, activity: "activity", kind: "review", answer: { final: "tampered" },
    score: 99, passed: true
  };
  const pendingSnapshot = {
    version: 1, activity: "activity", kind: "pending-final",
    payload: {
      reviewJson: JSON.stringify(reviewSnapshot),
      score: 99, maxScore: 100, passed: true
    }
  };
  const lms = fakeLms({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify(pendingSnapshot),
    "cmi.core.score.raw": ""
  });
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "pending-final");
  const before = { ...lms.calls };
  assert.equal(run.scorm.quarantinePending(), true);
  assert.equal(run.scorm.quarantinePending(), false, "quarantine is one-way for this page");
  assert.equal(run.scorm.retryPending().reason, "no-pending");
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.commit, before.commit, "quarantined data is not committed on pagehide");
  for (const key of ["cmi.core.score.min", "cmi.core.score.max", "cmi.core.score.raw", "cmi.core.lesson_status", "cmi.core.exit"]) {
    assert.equal(lms.calls[key] || 0, before[key] || 0, `${key} is not rewritten from quarantined data`);
  }
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "pending-final",
    "the durable checkpoint remains available for external recovery");
}

// Finish implementations that implicitly save must never be reached before a durable final commit.
for (const finishSavesBuffer of [false, true]) {
  const lms = fakeLms();
  lms.finishSavesBuffer = finishSavesBuffer;
  lms.failOnCommitCall = 2;
  const run = launch(lms);
  assert.equal(run.scorm.submitResult(result, review(run.scorm)).reason, "commit");
  lms.fail.commit = true;
  run.listeners.pagehide();
  assert.equal(lms.calls.finish, 0);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "pending-final");
}

// Pending submissions cannot be overwritten by drafts or finished before a durable final commit.
{
  const lms = fakeLms();
  lms.fail.commit = true;
  const run = launch(lms);
  const outcome = run.scorm.submitResult(result, review(run.scorm));
  assert.equal(outcome.frozen, true);
  assert.equal(run.scorm.saveDraft(run.scorm.makeSnapshot("activity", "draft", { edit: true })), false);
  run.listeners.pagehide();
  assert.equal(lms.calls.finish, 0);
}

// A checkpoint commit failure is retried before any final write.
{
  const lms = fakeLms();
  lms.fail.commit = true;
  const run = launch(lms);
  assert.equal(run.scorm.submitResult(result, review(run.scorm)).reason, "checkpoint");
  lms.fail.commit = false;
  lms.failOnCommitCall = lms.calls.commit + 2;
  assert.equal(run.scorm.retryPending().reason, "commit");
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).kind, "pending-final");
}

// Finish failure means final data is durable and only termination is retried.
{
  const lms = fakeLms();
  lms.fail.finish = true;
  const run = launch(lms);
  const outcome = run.scorm.submitResult(result, review(run.scorm));
  assert.equal(outcome.committed, true);
  assert.equal(outcome.reason, "finish");
  lms.fail.finish = false;
  run.listeners.pagehide();
  assert.equal(lms.calls.finish, 2);
}

// The shared pagehide provider persists the latest in-memory geometry even if a keyboard debounce is pending.
{
  const lms = fakeLms();
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("mirror").state, "new");
  const geometry = { imageX: 10 };
  run.scorm.setDraftProvider(() => run.scorm.makeSnapshot("mirror", "draft", { geometry: { ...geometry } }));
  geometry.imageX = 18;
  run.listeners.pagehide();
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).answer.geometry.imageX, 18);
}

// A lifecycle interruption may already have durably saved the exact draft
// before pagehide. Do not risk an unnecessary second commit before finishing.
{
  const lms = fakeLms();
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "new");
  const snapshot = run.scorm.makeSnapshot("activity", "draft", { step: 3 });
  assert.equal(run.scorm.saveDraft(snapshot), true);
  const commitsAfterSave = lms.calls.commit;
  run.scorm.setDraftProvider(() => snapshot);
  lms.failOnCommitCall = commitsAfterSave + 1;
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.commit, commitsAfterSave, "an identical durable draft is not committed twice");
  assert.equal(lms.calls.finish, 1, "the redundant-commit failure cannot prevent session close");
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).answer.step, 3);
}

{
  const lms = fakeLms();
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "new");
  const snapshot = run.scorm.makeSnapshot("activity", "draft", { step: "bfcache" });
  assert.equal(run.scorm.saveDraft(snapshot), true);
  const commitsAfterSave = lms.calls.commit;
  run.scorm.setDraftProvider(() => snapshot);
  run.listeners.pagehide({ persisted: true });
  assert.equal(lms.calls.commit, commitsAfterSave, "BFCache also skips an identical same-session draft");
  assert.equal(lms.calls.finish, 0);
}

// A draft loaded from a previous LMS session is not a save in this session:
// unchanged close must still set the current session's suspend exit and commit.
{
  const snapshot = { version: 1, activity: "activity", kind: "draft", answer: { step: 4 } };
  const lms = fakeLms({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify(snapshot),
    "cmi.core.score.raw": ""
  });
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "draft");
  run.scorm.setDraftProvider(() => snapshot);
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.commit, 1);
  assert.equal(lms.durable["cmi.core.exit"], "suspend");
  assert.equal(lms.calls.finish, 1);
}

// A failed later save may leave an uncommitted LMS buffer different from the
// last durable draft. Invalidate the dedupe cache and rewrite the provider
// snapshot before an LMSFinish implementation can implicitly save that buffer.
{
  const lms = fakeLms();
  lms.finishSavesBuffer = true;
  const run = launch(lms);
  assert.equal(run.scorm.loadAttempt("activity").state, "new");
  const durable = run.scorm.makeSnapshot("activity", "draft", { step: "A" });
  const dirty = run.scorm.makeSnapshot("activity", "draft", { step: "B" });
  assert.equal(run.scorm.saveDraft(durable), true);
  lms.fail.commit = true;
  assert.equal(run.scorm.saveDraft(dirty), false);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).answer.step, "A");
  lms.fail.commit = false;
  const commitsBeforeClose = lms.calls.commit;
  run.scorm.setDraftProvider(() => durable);
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.commit, commitsBeforeClose + 1,
    "the prior cache entry is invalid after a failed write dirties the LMS buffer");
  assert.equal(lms.calls.finish, 1);
  assert.equal(JSON.parse(lms.durable["cmi.suspend_data"]).answer.step, "A");
}

// Reads distinguish legitimate empty values from LMS errors and drive the startup matrix.
{
  const empty = launch(fakeLms()).scorm;
  assert.deepEqual(empty.readValue("cmi.suspend_data"), { ok: true, value: "" });
  const lms = fakeLms();
  lms.fail["get:cmi.core.lesson_status"] = true;
  assert.equal(launch(lms).scorm.loadAttempt("activity").state, "read-error");
}
{
  const lms = fakeLms();
  const run = launch(lms);
  const attempt = run.scorm.loadAttempt("activity");
  assert.equal(lms.calls["get:cmi.core.lesson_status"], 1);
  assert.equal(lms.calls["get:cmi.suspend_data"], 1);
  assert.equal(lms.calls["get:cmi.core.score.raw"], 1);
  assert.equal(attempt.state, "new");
}

// Production callbacks receive one normalized activity state for all four callers.
for (const [configure, expected] of [
  [() => {}, "success"],
  [(lms) => { lms.fail.commit = true; }, "frozen"],
  [(lms) => { lms.fail.finish = true; }, "committed"]
]) {
  const lms = fakeLms();
  configure(lms);
  const run = launch(lms);
  let observed = "";
  run.scorm.submitWithCallbacks(result, review(run.scorm), {
    onSuccess: (submission) => { observed = submission.activityState; },
    onFailure: (submission) => { observed = submission.activityState; }
  });
  assert.equal(observed, expected);
}
{
  const run = launch(null, "embedded");
  let observed = "";
  const snapshot = { version: 1, activity: "activity", kind: "review", answer: {} };
  run.scorm.submitWithCallbacks(result, snapshot, { onSuccess() {}, onFailure: (submission) => { observed = submission.activityState; } });
  assert.equal(observed, "retry");
}
for (const [durable, expected] of [
  [{ "cmi.core.lesson_status": "passed", "cmi.suspend_data": JSON.stringify({ version: 1, activity: "activity", kind: "review", answer: {} }) }, "finished"],
  [{ "cmi.core.lesson_status": "passed", "cmi.suspend_data": JSON.stringify({ version: 1, activity: "activity", kind: "draft", answer: {} }) }, "finished"],
  [{ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify({ version: 1, activity: "activity", kind: "review", answer: {} }) }, "inconsistent"],
  [{ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify({ version: 1, activity: "activity", kind: "draft", answer: {} }) }, "draft"]
]) assert.equal(launch(fakeLms(durable)).scorm.loadAttempt("activity").state, expected);

for (const kind of ["draft", "pending-final"]) {
  const lms = fakeLms({
    "cmi.core.lesson_status": "passed",
    "cmi.core.score.raw": "73",
    "cmi.suspend_data": JSON.stringify({ version: 1, activity: "activity", kind, answer: { ignored: true } })
  });
  const attempt = launch(lms).scorm.loadAttempt("activity");
  assert.equal(attempt.state, "finished", `finished ${kind} uses the safe Moodle summary`);
  assert.equal(attempt.fallback, true);
  assert.equal(attempt.snapshot, null);
  assert.equal(attempt.status, "passed");
  assert.equal(attempt.score, "73");
}

assert.equal(launch(null).scorm.submitResult(result, review(launch(null).scorm)).ok, true);
assert.equal(launch(null, "embedded").scorm.loadAttempt("activity").state, "read-error");

// Standalone launches use the same validated cmi snapshot lifecycle as an LMS,
// with localStorage as the durable browser fallback. A second launch is the
// reload boundary; it must recover the draft rather than the old memory log.
{
  const durableStorage = storage();
  const first = launch(null, "standalone", durableStorage);
  assert.equal(first.scorm.enableStandalonePersistence("activity"), "available");
  assert.equal(first.scorm.loadAttempt("activity").state, "new");
  first.scorm.setDraftProvider(() => first.scorm.makeSnapshot("activity", "draft", { step: 6, geometry: { x: -12, y: -30 } }));
  assert.equal(first.scorm.saveDraft(first.scorm.makeSnapshot("activity", "draft", { step: 6, geometry: { x: -12, y: -30 } })), true);
  const second = launch(null, "standalone", durableStorage);
  assert.equal(second.scorm.enableStandalonePersistence("activity"), "available");
  const restored = second.scorm.loadAttempt("activity");
  assert.equal(restored.state, "draft");
  assert.equal(restored.snapshot.answer.step, 6);
  assert.equal(restored.snapshot.answer.geometry.x, -12);
  assert.equal(second.scorm.clearStandaloneAttempt("activity"), true);
  assert.equal(launch(null, "standalone", durableStorage).scorm.enableStandalonePersistence("activity"), "available");
}

// Storage denial is explicit. The current page can keep its memory log, but a
// new page cannot claim that the draft survived a reload.
{
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  const first = launch(null, "standalone", denied);
  assert.equal(first.scorm.enableStandalonePersistence("activity"), "unavailable");
  assert.equal(first.scorm.loadAttempt("activity").state, "new");
  const snapshot = first.scorm.makeSnapshot("activity", "draft", { step: 7 });
  assert.equal(first.scorm.saveDraft(snapshot), true, "memory-only fallback remains usable for this page");
  assert.equal(launch(null, "standalone", denied).scorm.enableStandalonePersistence("activity"), "unavailable");
  assert.equal(launch(null, "standalone", denied).scorm.loadAttempt("activity").state, "new");
}

// A probe can succeed and a later read can fail. That failure is a startup
// read-error, never an empty/new attempt that silently discards the draft.
{
  const durableStorage = storage();
  const first = launch(null, "standalone", durableStorage);
  assert.equal(first.scorm.enableStandalonePersistence("activity"), "available");
  assert.equal(first.scorm.saveDraft(first.scorm.makeSnapshot("activity", "draft", { step: 8 })), true);
  durableStorage.failReads = true;
  const second = launch(null, "standalone", durableStorage);
  assert.equal(second.scorm.enableStandalonePersistence("activity"), "available");
  assert.equal(second.scorm.loadAttempt("activity").state, "read-error");
}

// A quota/write failure leaves the prior atomic checkpoint intact. The current
// launch becomes unavailable for durable writes and later launches can read
// that checkpoint in read-only mode, but never claim the failed new draft was
// durably saved.
{
  const durableStorage = storage();
  const first = launch(null, "standalone", durableStorage);
  assert.equal(first.scorm.enableStandalonePersistence("activity"), "available");
  assert.equal(first.scorm.saveDraft(first.scorm.makeSnapshot("activity", "draft", { step: 9 })), true);
  durableStorage.failWrites = true;
  assert.equal(first.scorm.saveDraft(first.scorm.makeSnapshot("activity", "draft", { step: 10 })), false);
  assert.equal(first.scorm.getStandaloneStorageStatus(), "unavailable");
  const second = launch(null, "standalone", durableStorage);
  assert.equal(second.scorm.enableStandalonePersistence("activity"), "read-only");
  const restored = second.scorm.loadAttempt("activity");
  assert.equal(restored.state, "draft");
  assert.equal(restored.snapshot.answer.step, 9);
}

// A later nth bundle write can fail during the final transaction. The last
// successful checkpoint remains a retryable pending-final envelope, so a new
// launch can recover and finish the same immutable submission after storage is
// available again; it never observes a mixed review/status/score bundle.
{
  const durableStorage = storage();
  const first = launch(null, "standalone", durableStorage);
  assert.equal(first.scorm.enableStandalonePersistence("activity"), "available");
  assert.equal(first.scorm.loadAttempt("activity").state, "new");
  assert.equal(first.scorm.saveDraft(first.scorm.makeSnapshot("activity", "draft", { step: 12 })), true);
  durableStorage.failOnWrite = durableStorage.writeCount + 2;
  const outcome = first.scorm.submitResult(result, review(first.scorm));
  assert.equal(outcome.frozen, true, "nth transaction write failure freezes the submission");
  const checkpoint = JSON.parse(durableStorage.data["simlab:activity:checkpoint"]);
  assert.equal(JSON.parse(checkpoint["cmi.suspend_data"]).kind, "pending-final");
  assert.equal(checkpoint["cmi.core.lesson_status"], "incomplete");
  assert.equal(checkpoint["cmi.core.score.raw"] || "", "", "failed final transaction does not publish a score");
  const samePageRetry = first.scorm.retryPending(false);
  assert.equal(samePageRetry.ok, false, "same-page retry cannot claim success after storage loss");
  assert.equal(samePageRetry.frozen, true, "same-page retry stays frozen after storage loss");
  first.listeners.pagehide({ persisted: false });
  assert.equal(JSON.parse(JSON.parse(durableStorage.data["simlab:activity:checkpoint"])["cmi.suspend_data"] || "null").kind, "pending-final",
    "pagehide cannot finish a pending transaction after storage loss");
  const second = launch(null, "standalone", durableStorage);
  assert.equal(second.scorm.enableStandalonePersistence("activity"), "read-only");
  assert.equal(second.scorm.loadAttempt("activity").state, "pending-final");
  const readOnlyRetry = second.scorm.retryPending(false);
  assert.equal(readOnlyRetry.ok, false, "read-only pending cannot downgrade to memory-only success");
  assert.equal(readOnlyRetry.frozen, true, "read-only pending remains frozen");
  durableStorage.failOnWrite = null;
  const third = launch(null, "standalone", durableStorage);
  assert.equal(third.scorm.enableStandalonePersistence("activity"), "available");
  assert.equal(third.scorm.loadAttempt("activity").state, "pending-final");
  assert.equal(third.scorm.retryPending(false).ok, true);
  const finalCheckpoint = JSON.parse(durableStorage.data["simlab:activity:checkpoint"]);
  assert.equal(JSON.parse(finalCheckpoint["cmi.suspend_data"]).kind, "review");
  assert.equal(finalCheckpoint["cmi.core.lesson_status"], "passed");
}

// An outer pending envelope that the shared runtime cannot structurally trust
// is itself quarantined: there is no retryable pending payload and pagehide
// cannot automatically submit it.
{
  const lms = fakeLms({
    "cmi.core.lesson_status": "incomplete",
    "cmi.suspend_data": JSON.stringify({ version: 1, activity: "activity", kind: "pending-final", payload: { reviewJson: "not-json", score: 72, maxScore: 100, passed: true } })
  });
  const run = launch(lms);
  const attempt = run.scorm.loadAttempt("activity");
  assert.equal(attempt.state, "pending-invalid");
  assert.equal(run.scorm.quarantinePending(), true);
  assert.equal(run.scorm.retryPending().reason, "no-pending");
  run.listeners.pagehide({ persisted: false });
  assert.equal(lms.calls.commit, 0);
}

// Activity opt-in storage is namespaced: another activity's checkpoint is
// preserved and cannot be read as this activity's draft.
{
  const durableStorage = storage();
  const first = launch(null, "standalone", durableStorage);
  first.scorm.enableStandalonePersistence("activity-a");
  assert.equal(first.scorm.saveDraft(first.scorm.makeSnapshot("activity-a", "draft", { step: 11 })), true);
  const second = launch(null, "standalone", durableStorage);
  second.scorm.enableStandalonePersistence("activity-b");
  assert.equal(second.scorm.loadAttempt("activity-b").state, "new");
  assert.ok(Object.keys(durableStorage.data).some(key => key.includes("activity-a")));
}
console.log("SCORM durable-session checks passed");
