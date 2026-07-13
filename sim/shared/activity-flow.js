(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SimActivityFlow = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function submission(outcome, handlers) {
    const state = outcome?.activityState || "retry";
    const handler = handlers[state] || handlers.retry;
    handler(outcome);
    return state;
  }
  function startup(attempt) {
    if (attempt?.state === "finished") return "review";
    if (attempt?.state === "draft" || attempt?.state === "new") return "editable";
    if (attempt?.state === "pending-final") return "frozen";
    return "load-error";
  }
  function recordedResult(attempt) {
    const raw = String(attempt?.score ?? "").trim();
    const score = raw === "" ? null : Number(raw);
    return {
      score: Number.isFinite(score) ? score : null,
      passed: attempt?.status === "passed" ? true : attempt?.status === "failed" ? false : null
    };
  }
  return { submission, startup, recordedResult };
});
