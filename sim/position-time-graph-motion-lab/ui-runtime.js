(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PositionTimeUiRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function dragAllowed(kind, context) {
    if (!kind || context.locked || context.technical) return false;
    const [type, label] = kind.split(":");
    if (type === "car" || type === "velocity") {
      if (context.playing || context.time !== 0) return false;
      if (context.phase === "explore") return label === "A";
      return context.phase === "mission" && (([0, 3].includes(context.step) && label === "A") || (context.step === 4 && label === "B"));
    }
    if (type === "graph") return context.phase === "mission" && context.step === 1;
    if (type === "probe") return context.phase === "explore" ? label === "E" : context.phase === "mission" && context.step === 2 && ["A", "B"].includes(label);
    if (type === "faster") return context.phase === "mission" && context.step === 2;
    return false;
  }

  function transitionWithSave(source, mutate, save, clone = structuredClone) {
    if (!save(source)) return { ok: false, stage: "before", state: source };
    const next = clone(source);
    if (mutate(next) === false) return { ok: false, stage: "invalid", state: source };
    if (!save(next)) return { ok: false, stage: "after", state: source };
    return { ok: true, stage: "complete", state: next };
  }

  function focusKey(element) {
    if (!element?.dataset) return null;
    if (element.dataset.focusKey) return `focus:${element.dataset.focusKey}`;
    if (element.dataset.drag) return `drag:${element.dataset.drag}`;
    return null;
  }

  function restoreFocus(root, key) {
    if (!key || !root?.querySelectorAll) return false;
    const separator = key.indexOf(":");
    const kind = key.slice(0, separator);
    const value = key.slice(separator + 1);
    const attribute = kind === "drag" ? "drag" : "focusKey";
    const selector = kind === "drag" ? "[data-drag]" : "[data-focus-key]";
    const target = Array.from(root.querySelectorAll(selector)).find((element) => element.dataset?.[attribute] === value);
    if (!target?.focus) return false;
    target.focus({ preventScroll: true });
    return true;
  }

  function renderRetryAction(host, action, onRetry, documentRef = host?.ownerDocument) {
    if (!host?.replaceChildren) return null;
    host.replaceChildren();
    if (action !== "retry-pending" || !documentRef?.createElement) return null;
    const button = documentRef.createElement("button");
    button.type = "button";
    button.id = "retryPending";
    button.className = "primary-button";
    button.textContent = "重試同一份提交";
    button.addEventListener("click", onRetry);
    host.replaceChildren(button);
    return button;
  }

  function hitRadius(viewBoxWidth, renderedWidth, minimum = 23) {
    return Math.max(minimum, renderedWidth > 0 ? 22 * viewBoxWidth / renderedWidth : minimum);
  }

  function positionFromPointer(pointerX, grabOffset, left, right, axisMin, axisMax, step, clampMin = axisMin, clampMax = axisMax) {
    const raw = axisMin + (pointerX - grabOffset - left) / (right - left) * (axisMax - axisMin);
    return Math.min(clampMax, Math.max(clampMin, Math.round(raw / step) * step));
  }

  function adjustByArrow(value, key, step, min, max, shiftKey = false) {
    const direction = key === "ArrowLeft" || key === "ArrowDown" ? -1 : 1;
    return Math.min(max, Math.max(min, value + direction * step * (shiftKey ? 2 : 1)));
  }

  return { dragAllowed, transitionWithSave, focusKey, restoreFocus, renderRetryAction, hitRadius, positionFromPointer, adjustByArrow };
});
