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
  function reviewResult(computed, saved, attempt) {
    const recorded = recordedResult(attempt);
    const trusted = Boolean(computed && saved && computed.score === saved.score && Boolean(computed.passed) === Boolean(saved.passed) &&
      (recorded.score == null || recorded.score === computed.score) &&
      recorded.passed !== null && recorded.passed === Boolean(computed.passed));
    return {
      trusted,
      result: trusted ? computed : {
        score: recorded.score,
        maxScore: computed?.maxScore || 100,
        passed: recorded.passed,
        completed: true,
        detail: [],
        feedbackItems: []
      }
    };
  }
  function completionLabel(passed) {
    return passed === true ? "已通過" : passed === false ? "未通過" : "未能安全判斷合格狀態";
  }
  return { submission, startup, recordedResult, reviewResult, completionLabel };
});
