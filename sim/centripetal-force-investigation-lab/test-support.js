"use strict";
const M = require("./model.js"), S = require("./scoring.js"), P = require("./persistence.js");
const Flow = require("../shared/activity-flow.js"), { Controller } = require("./ui-runtime.js");
function environment(options = {}) {
  const durable = options.durable || { state: "new" }, events = { quarantined: 0, saves: 0, submits: 0 };
  const scorm = {
    loadAttempt: () => M.clone(durable),
    makeSnapshot: (activity, kind, answer, result) => ({ version: 1, activity, kind, answer,
      ...(result ? { score: result.score, passed: result.passed } : {}) }),
    saveDraft(snapshot) { events.saves++; if (options.saveFail) return false; durable.state = "draft"; durable.snapshot = M.clone(snapshot); return true; },
    setDraftProvider(provider) { this.provider = provider; },
    submitWithCallbacks(result, snapshot, callbacks) {
      events.submits++; const mode = options.submitMode || "success";
      const outcome = { activityState: mode, ok: mode === "success", committed: mode === "committed", frozen: mode === "frozen",
        retryable: options.retryable !== false, review: M.clone(snapshot), score: result.score, status: result.passed ? "passed" : "failed" };
      if (mode === "success" || mode === "committed") Object.assign(durable, { state: "finished", snapshot: M.clone(snapshot), score: String(result.score), status: outcome.status });
      if (mode === "frozen") Object.assign(durable, { state: "pending-final", snapshot: { version: 1, activity: P.ACTIVITY, kind: "pending-final", payload: { reviewJson: JSON.stringify(snapshot), score: result.score, maxScore: 100, passed: result.passed } } });
      (outcome.ok ? callbacks.onSuccess : callbacks.onFailure)(outcome);
      return outcome;
    },
    retryPending() { const inner = JSON.parse(durable.snapshot.payload.reviewJson), result = S.score(P.decode(inner, "review"));
      Object.assign(durable, { state: "finished", snapshot: inner, score: String(result.score), status: result.passed ? "passed" : "failed" });
      return { activityState: "success", ok: true, review: inner, score: result.score, status: durable.status }; },
    retryFinish() { return { activityState: "success", ok: true, review: durable.snapshot, score: Number(durable.score), status: durable.status }; },
    quarantinePending() { events.quarantined++; return true; }
  };
  const c = new Controller(scorm, Flow); c.start();
  return { c, scorm, durable, events };
}
module.exports = { environment };
