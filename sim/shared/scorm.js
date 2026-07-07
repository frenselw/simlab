(function () {
  "use strict";

  let api = null;
  let initialized = false;
  let finished = false;
  const localLog = [];

  function findApi(win) {
    let current = win;
    for (let i = 0; i < 8 && current; i += 1) {
      try {
        if (current.API) return current.API;
        if (current.parent === current) break;
        current = current.parent;
      } catch {
        return null;
      }
    }
    return null;
  }

  function init() {
    if (initialized) return true;
    api = findApi(window);
    if (!api && window.opener) {
      api = findApi(window.opener);
    }
    initialized = true;
    if (api && api.LMSInitialize) {
      return api.LMSInitialize("") === "true";
    }
    return true;
  }

  function setValue(key, value) {
    if (!initialized) init();
    const stringValue = String(value);
    if (api && api.LMSSetValue) {
      return api.LMSSetValue(key, stringValue) === "true";
    } else {
      localLog.push({ key, value: stringValue });
      console.info("[SCORM local]", key, stringValue);
      return true;
    }
  }

  function getValue(key) {
    if (!initialized) init();
    if (api && api.LMSGetValue) {
      return api.LMSGetValue(key);
    }
    for (let i = localLog.length - 1; i >= 0; i -= 1) {
      if (localLog[i].key === key) return localLog[i].value;
    }
    return "";
  }

  function commit() {
    if (api && api.LMSCommit) {
      api.LMSCommit("");
    }
  }

  function finish() {
    if (!initialized || finished) return;
    commit();
    if (api && api.LMSFinish) {
      api.LMSFinish("");
    }
    finished = true;
  }

  function submitResult(result, reviewState) {
    init();
    if (reviewState) {
      if (!setValue("cmi.suspend_data", JSON.stringify(reviewState))) {
        console.warn("[SCORM] Failed to save review state");
      }
    }
    setValue("cmi.core.score.min", 0);
    setValue("cmi.core.score.max", result.maxScore || 100);
    setValue("cmi.core.score.raw", result.score);
    setValue("cmi.core.lesson_status", result.passed ? "passed" : "failed");
    setValue("cmi.core.exit", "logout");
    finish();
    return result;
  }

  function isAttemptFinished() {
    return ["completed", "passed", "failed"].includes(getValue("cmi.core.lesson_status"));
  }

  function getLocalLog() {
    return localLog.slice();
  }

  window.SimScorm = {
    init,
    getValue,
    isAttemptFinished,
    submitResult,
    finish,
    getLocalLog
  };

  window.addEventListener("pagehide", finish);
})();
