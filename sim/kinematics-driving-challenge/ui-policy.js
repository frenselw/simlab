(function (root, factory) {
  const flow = typeof module === "object" && module.exports ? require("../shared/activity-flow.js") : root.SimActivityFlow;
  const api = factory(flow);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingUiPolicy = api;
})(typeof window !== "undefined" ? window : globalThis, function (Flow) {
  "use strict";

  function startupMode(outcome) {
    return { review: "review", editable: "activity", frozen: "pending", "load-error": "technical" }[outcome] || "technical";
  }
  function submission(outcome, handlers) { return Flow.submission(outcome, handlers); }
  function reviewOutcome(computed, saved, attempt) { return Flow.reviewResult(computed, saved, attempt); }
  function controlsLocked(mode) { return ["pending", "technical", "submitted", "committed"].includes(mode); }
  function technicalCopy(mode) {
    if (mode === "pending") return "上次提交仍待確認；駕駛記錄已凍結，請重試同一份提交。";
    if (mode === "committed") return "成績已寫入，但 Moodle 尚未完成離開程序；目前記錄已鎖定。";
    return "未能安全讀取或保存活動資料；操作已鎖定。";
  }
  function canOpenReviewItem(state, itemId, locked = false) {
    if (locked || !state || state.phase !== "review") return false;
    if (itemId === "checkpoint") return Boolean(state.selectedRuns?.level2 || state.selectedRuns?.level3);
    return /^level[1-5]$/.test(itemId || "");
  }
  function shouldHandleGlobalShortcut(target) {
    return !target?.closest?.("input, button, select, textarea, a[href], summary, [contenteditable='true'], [role='button']");
  }
  return {
    startupMode, submission, reviewOutcome, controlsLocked, technicalCopy,
    canOpenReviewItem, shouldHandleGlobalShortcut
  };
});
