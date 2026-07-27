(function (root, factory) {
  const flow = typeof module === "object" && module.exports ? require("../shared/activity-flow.js") : root.SimActivityFlow;
  const api = factory(flow);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphUiPolicy = api;
})(typeof window !== "undefined" ? window : globalThis, function (Flow) {
  "use strict";

  function startupMode(outcome) {
    return { review: "review", editable: "activity", frozen: "pending", "load-error": "technical" }[outcome] || "technical";
  }

  function submission(outcome, handlers) {
    return Flow.submission(outcome, handlers);
  }

  function reviewOutcome(computed, saved, attempt) {
    return Flow.reviewResult(computed, saved, attempt);
  }

  function controlsLocked(mode) {
    return ["pending", "technical", "submitted", "committed"].includes(mode);
  }

  function technicalCopy(mode) {
    if (mode === "pending") return "上次提交仍待確認；十二幅圖已凍結，請重試同一份提交。";
    if (mode === "committed") return "成績已寫入，但 Moodle 尚未完成離開程序；已提交圖線保持鎖定。";
    if (mode === "review-fallback") return "已完成的圖線記錄未能安全驗證；以下只顯示 Moodle 可確認的結果摘要。";
    return "未能安全讀取或保存活動資料；作圖操作已鎖定。";
  }

  function technicalResult(mode) {
    return {
      title: mode === "pending" ? "提交待確認" : "技術問題",
      score: "--",
      completion: "狀態未能確認",
      message: technicalCopy(mode),
      submittedClaim: false
    };
  }

  function shouldHandleGraphShortcut(target) {
    return !target?.closest?.("button, input, select, textarea, a[href], summary, [contenteditable='true']");
  }

  return {
    startupMode,
    submission,
    reviewOutcome,
    controlsLocked,
    technicalCopy,
    technicalResult,
    shouldHandleGraphShortcut
  };
});
