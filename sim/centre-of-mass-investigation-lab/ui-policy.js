(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassUiPolicy = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function previewCorner(point, bounds) {
    const horizontal = point.x < bounds.left + bounds.width / 2 ? "right" : "left";
    const vertical = point.y < bounds.top + bounds.height / 2 ? "bottom" : "top";
    return `${vertical}-${horizontal}`;
  }
  function activation(start, current, threshold = 5) { return Math.hypot(current.x - start.x, current.y - start.y) >= threshold; }
  function pointerOwner(target) {
    if (target?.closest?.("[data-direct-target]")) return "simulation";
    if (target?.closest?.("#controlPanel")) return "panel";
    return "host";
  }
  function startupView(outcome) { return { editable: outcome === "editable", locked: outcome !== "editable",
    mode: outcome === "review" ? "review" : outcome === "frozen" ? "pending" : outcome === "editable" ? "activity" : "technical" }; }
  function submissionView(outcome) { const state = outcome?.activityState || "retry"; return { locked: state !== "retry" || outcome?.retryable !== true,
    showScore: state === "success" || state === "committed", mode: state }; }
  return { previewCorner, activation, pointerOwner, startupView, submissionView };
});
