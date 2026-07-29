(function (root, factory) {
  const flow = typeof module === "object" && module.exports ? require("../shared/activity-flow.js") : root.SimActivityFlow;
  const api = factory(flow);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsQuantitativeUiPolicy = api;
})(typeof window !== "undefined" ? window : globalThis, function (Flow) {
  "use strict";
  const startupMode = (outcome) => ({ review: "review", editable: "activity", frozen: "pending", "load-error": "technical" }[outcome] || "technical");
  function validResultMetadata(value) { return Boolean(value && Number.isFinite(value.score) && value.score >= 0 && value.score <= 100 && value.maxScore === 100 && typeof value.passed === "boolean"); }
  function reviewOutcome(computed, saved, attempt) { if (!validResultMetadata(computed) || !validResultMetadata(saved)) return { trusted: false, result: Flow.reviewResult(computed, saved, attempt).result }; return Flow.reviewResult(computed, saved, attempt); }
  function technicalResult(mode) { return { title: mode === "pending" ? "提交待確認" : "技術問題", score: "--", completion: "狀態未能確認", submittedClaim: false, message: mode === "pending" ? "上次提交仍待確認；答案已凍結，請重試同一份提交。" : "未能安全讀取或保存活動資料；作圖操作已鎖定。" }; }
  function pendingReturnDecision(outcome, expected, decoded, computed) { if (!(outcome?.ok || outcome?.committed)) return outcome?.frozen ? "pending" : "technical"; const returned = outcome.review; return Boolean(decoded && validResultMetadata(returned) && computed && computed.score === returned.score && computed.passed === returned.passed && returned.maxScore === 100 && JSON.stringify(returned.answer) === JSON.stringify(expected?.answer)) ? outcome.ok ? "review" : "committed" : "quarantine"; }
  function attemptSummary(attempt) { const rawScore = attempt?.score; const score = rawScore == null || String(rawScore).trim() === "" ? "--" : String(rawScore); const rawStatus = attempt?.status; return { score, status: typeof rawStatus === "string" && rawStatus.trim() ? rawStatus : "--" }; }
  function usesCompactLayout(viewport) { const width = Number(viewport?.width) || 0; const height = Number(viewport?.height) || 0; return width > 0 && width < 820 && height > 0 && height <= 420; }
  const retryableRetryMessage = "提交未完成；你可以檢查答案後重試。";
  return { startupMode, validResultMetadata, reviewOutcome, technicalResult, pendingReturnDecision, attemptSummary, usesCompactLayout, retryableRetryMessage, submission: Flow.submission, controlsLocked: (mode) => ["pending", "technical", "submitted", "committed"].includes(mode) };
});
