(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionUiRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const COPY = Object.freeze({
    editable: Object.freeze({ title: "練習進行中", completion: "尚未提交", score: "--", locked: false }),
    summary: Object.freeze({ title: "提交前檢查", completion: "尚未提交", score: "--", locked: false }),
    review: Object.freeze({ title: "已提交作圖", locked: true }),
    committed: Object.freeze({ title: "成績已記錄，尚待完成連線", locked: true }),
    frozen: Object.freeze({ title: "提交狀態未能確認", completion: "未能安全判斷完成狀態", score: "--", locked: true }),
    retryable: Object.freeze({ title: "提交程序未能完成", completion: "尚未提交", score: "--", locked: false }),
    technical: Object.freeze({ title: "練習暫時鎖定", completion: "未能安全判斷完成狀態", score: "--", locked: true }),
    mismatch: Object.freeze({ title: "已完成紀錄未能安全核對", locked: true })
  });

  function startupPresentation(attempt) {
    if (attempt?.state === "finished") return "review";
    if (attempt?.state === "new" || attempt?.state === "draft") return "editable";
    if (attempt?.state === "pending-final") return "frozen";
    return "technical";
  }

  function submissionPresentation(outcome) {
    const state = outcome?.activityState || "retry";
    if (state === "success") return "review";
    if (state === "committed") return "committed";
    if (state === "frozen") return "frozen";
    return outcome?.retryable ? "retryable" : "technical";
  }

  function reviewPresentation(reviewResult) {
    return reviewResult?.trusted ? "review" : "mismatch";
  }

  function controlPolicy(options = {}) {
    const presentation = options.presentation || "technical";
    const editable = ["editable", "summary", "retryable"].includes(presentation);
    const inSummary = options.phase === "summary";
    return {
      progressEnabled: editable,
      dragEnabled: editable && !inSummary,
      undoEnabled: editable && !inSummary && Boolean(options.undoAvailable),
      resetEnabled: editable && !inSummary,
      navigationEnabled: editable && !inSummary,
      summaryEnabled: editable && !inSummary,
      submitEnabled: editable && inSummary && !options.unsaved,
      correctOverlayEnabled: presentation === "review" && Boolean(options.trusted)
    };
  }

  function completionLabel(value) {
    return value === true ? "已通過" : value === false ? "未通過" : "未能安全判斷合格狀態";
  }

  function copyFor(presentation, result) {
    const base = COPY[presentation] || COPY.technical;
    if (!["review", "committed", "mismatch"].includes(presentation)) return { ...base };
    return {
      ...base,
      score: Number.isFinite(result?.score) ? `${result.score} / ${result.maxScore || 100}` : "--",
      completion: completionLabel(result?.passed)
    };
  }

  return Object.freeze({ COPY, startupPresentation, submissionPresentation, reviewPresentation, controlPolicy, completionLabel, copyFor });
});
