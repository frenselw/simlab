(function (global) {
  "use strict";

  const DEFAULT_THRESHOLD = 8;

  function attach(options) {
    const surface = options?.surface;
    const panel = options?.panel;
    const threshold = Number.isFinite(options?.threshold) ? options.threshold : DEFAULT_THRESHOLD;
    if (!surface || !panel) throw new TypeError("A forwarding surface and control panel are required");

    const activePointers = new Set();
    let gesture = null;

    function releaseGesture() {
      if (!gesture) return;
      const { pointerId } = gesture;
      gesture = null;
      if (surface.hasPointerCapture?.(pointerId)) surface.releasePointerCapture(pointerId);
    }

    function pointerDown(event) {
      if (event.pointerType !== "touch") return;
      activePointers.add(event.pointerId);
      if (activePointers.size !== 1 || !event.isPrimary) {
        releaseGesture();
        return;
      }
      gesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        previousY: event.clientY,
        owner: "candidate"
      };
    }

    function pointerMove(event) {
      if (!gesture || event.pointerId !== gesture.pointerId || activePointers.size !== 1) return;
      const totalX = event.clientX - gesture.startX;
      const totalY = event.clientY - gesture.startY;
      if (gesture.owner === "candidate") {
        if (Math.hypot(totalX, totalY) < threshold) return;
        if (Math.abs(totalY) <= Math.abs(totalX)) {
          gesture.owner = "browser";
          return;
        }
        gesture.owner = "panel";
        surface.setPointerCapture?.(event.pointerId);
      }
      if (gesture.owner !== "panel") return;
      const maximum = Math.max(0, panel.scrollHeight - panel.clientHeight);
      panel.scrollTop = Math.max(0, Math.min(maximum, panel.scrollTop - (event.clientY - gesture.previousY)));
      gesture.previousY = event.clientY;
      event.preventDefault();
    }

    function pointerEnd(event) {
      if (event.pointerType !== "touch") return;
      activePointers.delete(event.pointerId);
      if (gesture?.pointerId === event.pointerId) releaseGesture();
    }

    surface.addEventListener("pointerdown", pointerDown);
    surface.addEventListener("pointermove", pointerMove);
    surface.addEventListener("pointerup", pointerEnd);
    surface.addEventListener("pointercancel", pointerEnd);
    surface.addEventListener("lostpointercapture", pointerEnd);

    return {
      detach() {
        releaseGesture();
        activePointers.clear();
        surface.removeEventListener("pointerdown", pointerDown);
        surface.removeEventListener("pointermove", pointerMove);
        surface.removeEventListener("pointerup", pointerEnd);
        surface.removeEventListener("pointercancel", pointerEnd);
        surface.removeEventListener("lostpointercapture", pointerEnd);
      }
    };
  }

  global.SimPanelScrollForwarding = { attach };
})(typeof window !== "undefined" ? window : globalThis);
