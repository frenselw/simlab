(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root?.document) { root.SimFullscreen = api; api.attach(root.document); }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function prepare(doc) {
    if (doc.getElementById("fullscreenButton")) return;
    const header = doc.querySelector?.("[data-sim-fullscreen]");
    if (!header) return;
    const button = doc.createElement("button");
    button.id = "fullscreenButton";
    button.className = "sim-fullscreen-button";
    button.type = "button";
    button.setAttribute("aria-label", "進入全螢幕");
    button.setAttribute("aria-pressed", "false");
    button.title = "進入全螢幕";
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path data-fullscreen-enter d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path data-fullscreen-exit d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" hidden/></svg>';
    const status = doc.createElement("p");
    status.id = "fullscreenStatus";
    status.className = "sim-fullscreen-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;
    header.classList.add("sim-fullscreen-header");
    header.append(button, status);
  }

  function attach(doc) {
    prepare(doc);
    const button = doc.getElementById("fullscreenButton");
    const status = doc.getElementById("fullscreenStatus");
    if (!button || !status) return null;
    const target = doc.querySelector?.("[data-sim-fullscreen-target]") || doc.getElementById("app") || doc.documentElement;
    const header = doc.querySelector?.("[data-sim-fullscreen]");
    const view = doc.defaultView;
    function layout() {
      if (!header || !view) return;
      const style = view.getComputedStyle(header);
      const columns = style.gridTemplateColumns.split(" ").filter(Boolean);
      const row = style.display === "flex" || (style.display === "grid" && columns.length > 1);
      header.classList.toggle("sim-fullscreen-header-row", row);
    }
    layout();
    view?.addEventListener("resize", layout);
    const enterIcon = button.querySelector("[data-fullscreen-enter]");
    const exitIcon = button.querySelector("[data-fullscreen-exit]");
    let busy = false;
    let lastAction = "enter";

    const active = () => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    function sync() {
      const full = active();
      const label = full ? "退出全螢幕" : "進入全螢幕";
      button.disabled = busy;
      button.setAttribute("aria-pressed", String(full));
      button.setAttribute("aria-label", label);
      button.title = label;
      if (enterIcon) enterIcon.toggleAttribute("hidden", full);
      if (exitIcon) exitIcon.toggleAttribute("hidden", !full);
    }
    function message(code, text) {
      status.dataset.fullscreenError = code;
      status.textContent = text;
      status.hidden = false;
      header?.classList.add("sim-fullscreen-has-message");
    }
    function clearMessage() {
      status.hidden = true;
      header?.classList.remove("sim-fullscreen-has-message");
      status.textContent = "";
      delete status.dataset.fullscreenError;
    }
    function failed(action) {
      message(action, action === "exit"
        ? "未能退出全螢幕，請再按一次，或使用瀏覽器的退出功能（電腦可按 Esc）。"
        : "未能進入全螢幕，請再按一次；如仍失敗，請檢查瀏覽器或網頁的全螢幕權限。");
    }
    async function toggle() {
      if (busy) return;
      clearMessage();
      const exiting = active();
      const standard = exiting ? doc.exitFullscreen : target.requestFullscreen;
      const method = standard || (exiting ? doc.webkitExitFullscreen : target.webkitRequestFullscreen);
      lastAction = exiting ? "exit" : "enter";
      if (typeof method !== "function") {
        if (exiting) failed("exit");
        else message("unsupported", "此瀏覽器不支援網頁全螢幕，請使用電腦或支援此功能的瀏覽器。");
        return;
      }
      const enabled = standard ? doc.fullscreenEnabled : doc.webkitFullscreenEnabled;
      if (!exiting && enabled === false) {
        message("blocked", "目前頁面不允許全螢幕，請檢查瀏覽器或網頁的全螢幕權限。");
        return;
      }
      busy = true;
      sync();
      try {
        // Invoke immediately inside the trusted click/tap; keep the same SCO page.
        const result = method.call(exiting ? doc : target);
        await result;
        // A legacy WebKit call returns void; its later event owns state updates.
        if (result && typeof result.then === "function" && active() === exiting) failed(lastAction);
      } catch (_) {
        failed(lastAction);
      } finally {
        busy = false;
        sync();
      }
    }
    function changed() {
      clearMessage();
      sync();
    }
    const error = () => { failed(lastAction); sync(); };
    button.addEventListener("click", toggle);
    for (const event of ["fullscreenchange", "webkitfullscreenchange"]) doc.addEventListener(event, changed);
    for (const event of ["fullscreenerror", "webkitfullscreenerror"]) doc.addEventListener(event, error);
    sync();
    return Object.freeze({
      toggle,
      destroy() {
        button.removeEventListener("click", toggle);
        view?.removeEventListener("resize", layout);
        for (const event of ["fullscreenchange", "webkitfullscreenchange"]) doc.removeEventListener(event, changed);
        for (const event of ["fullscreenerror", "webkitfullscreenerror"]) doc.removeEventListener(event, error);
      }
    });
  }

  return Object.freeze({ attach, prepare });
});
