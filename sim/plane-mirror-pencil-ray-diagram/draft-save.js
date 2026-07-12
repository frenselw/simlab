(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MirrorDraftSave = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function create(save, delay = 350, timers = globalThis) {
    let timer = 0;
    return {
      schedule() {
        timers.clearTimeout(timer);
        timer = timers.setTimeout(() => { timer = 0; save(); }, delay);
      },
      flush() {
        if (!timer) return false;
        timers.clearTimeout(timer);
        timer = 0;
        save();
        return true;
      }
    };
  }
  function change(mutator, debouncer) {
    mutator();
    debouncer.schedule();
  }
  return { create, change };
});
