(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root?.document) api.attach(root.document);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function attach(doc) {
    const button = doc.getElementById("fullscreenButton");
    const status = doc.getElementById("fullscreenStatus");
    if (!button || !status) return null;
    const target = doc.getElementById("app") || doc.documentElement;
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
    }
    function clearMessage() {
      status.hidden = true;
      status.textContent = "";
      delete status.dataset.fullscreenError;
    }
    function failed(action) {
      message(action, action === "exit"
        ? "未能退出全螢幕，請再按一次，或使用瀏覽器的退出功能（電腦可按 Esc）。"
        : "未能進入全螢幕，請再按一次；如仍失敗，請檢查播放器或瀏覽器的全螢幕權限。");
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
        message("blocked", "目前頁面不允許全螢幕，請檢查 Moodle 播放器或瀏覽器的全螢幕權限。");
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
        for (const event of ["fullscreenchange", "webkitfullscreenchange"]) doc.removeEventListener(event, changed);
        for (const event of ["fullscreenerror", "webkitfullscreenerror"]) doc.removeEventListener(event, error);
      }
    });
  }

  return Object.freeze({ attach });
});
