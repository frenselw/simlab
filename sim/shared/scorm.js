(function () {
  "use strict";

  let api = null;
  let initialized = false;
  let finished = false;
  let finalCommitted = false;
  let submitting = false;
  let draftProvider = null;
  const localLog = [];
  const SNAPSHOT_LIMIT = 4000;

  function snapshotBytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  }

  function makeSnapshot(activity, kind, answer, result) {
    const snapshot = { version: 1, activity, kind, answer };
    if (result) {
      snapshot.score = result.score;
      snapshot.passed = Boolean(result.passed);
    }
    if (snapshotBytes(snapshot) > SNAPSHOT_LIMIT) throw new Error("SCORM snapshot exceeds 4000 bytes");
    return snapshot;
  }

  function readSnapshot(activity, kind) {
    try {
      const value = JSON.parse(getValue("cmi.suspend_data") || "null");
      if (!value || value.version !== 1 || value.activity !== activity || value.kind !== kind || value.answer == null) return null;
      return value;
    } catch {
      return null;
    }
  }

  function saveDraft(snapshot) {
    if (finalCommitted || !snapshot || snapshot.kind !== "draft" || snapshotBytes(snapshot) > SNAPSHOT_LIMIT) return false;
    return setValue("cmi.suspend_data", JSON.stringify(snapshot)) &&
      setValue("cmi.core.exit", "suspend") && commit();
  }

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

  function errorDetails(action, exception) {
    let code = "";
    let message = exception?.message || "";
    try {
      code = api?.LMSGetLastError?.() || "";
      message = api?.LMSGetErrorString?.(code) || message;
    } catch (error) {
      message ||= error.message;
    }
    const detail = { action, code, message };
    console.warn("[SCORM] operation failed", detail);
    return detail;
  }

  function call(action, method, ...args) {
    try {
      if (!api?.[method]) return { ok: false, error: errorDetails(action) };
      const value = api[method](...args);
      return value === "true" ? { ok: true, value } : { ok: false, error: errorDetails(action) };
    } catch (error) {
      return { ok: false, error: errorDetails(action, error) };
    }
  }

  function init() {
    if (initialized) return true;
    api = findApi(window) || (window.opener ? findApi(window.opener) : null);
    if (!api && isStandalone()) {
      initialized = true;
      return true;
    }
    if (!api) return false;
    const outcome = call("initialize", "LMSInitialize", "");
    initialized = outcome.ok;
    return outcome.ok;
  }

  function isStandalone() {
    try {
      return window.top === window && !window.opener;
    } catch {
      return false;
    }
  }

  function setValue(key, value) {
    if (!initialized && !init()) return false;
    const stringValue = String(value);
    if (api) return call(`set ${key}`, "LMSSetValue", key, stringValue).ok;
    localLog.push({ key, value: stringValue });
    console.info("[SCORM local]", key, stringValue);
    return true;
  }

  function getValue(key) {
    if (!initialized && !init()) return "";
    if (api?.LMSGetValue) {
      try {
        return api.LMSGetValue(key);
      } catch (error) {
        errorDetails(`get ${key}`, error);
        return "";
      }
    }
    for (let i = localLog.length - 1; i >= 0; i -= 1) {
      if (localLog[i].key === key) return localLog[i].value;
    }
    return "";
  }

  function commit() {
    if (!initialized && !init()) return false;
    return api ? call("commit", "LMSCommit", "").ok : true;
  }

  function finish() {
    if (!initialized || finished) return true;
    if (!finalCommitted) return false;
    if (!api) {
      finished = true;
      return true;
    }
    const outcome = call("finish", "LMSFinish", "");
    finished = outcome.ok;
    return outcome.ok;
  }

  function submitResult(result, reviewState) {
    if (submitting) return { ok: false, retryable: true, reason: "busy", result };
    submitting = true;
    try {
      if (!init()) return { ok: false, retryable: true, reason: "initialize", result };
      if (reviewState && !setValue("cmi.suspend_data", JSON.stringify(reviewState))) {
        return { ok: false, retryable: true, reason: "snapshot", result };
      }
      const optionalWrites = [
        ["cmi.core.score.min", 0],
        ["cmi.core.score.max", result.maxScore || 100]
      ];
      optionalWrites.forEach(([key, value]) => {
        if (value != null && !setValue(key, value)) console.warn(`[SCORM] Failed to write ${key}`);
      });
      if (!setValue("cmi.core.score.raw", result.score)) {
        return { ok: false, retryable: true, reason: "score", result };
      }
      if (!setValue("cmi.core.lesson_status", result.passed ? "passed" : "failed")) {
        return { ok: false, retryable: true, reason: "status", result };
      }
      if (!setValue("cmi.core.exit", "logout")) {
        return { ok: false, retryable: true, reason: "exit", result };
      }
      if (!commit()) return { ok: false, retryable: true, reason: "commit", result };
      finalCommitted = true;
      const finishOk = finish();
      if (!finishOk) {
        return { ok: false, committed: true, finished: false, retryable: true, reason: "finish", result };
      }
      return { ok: true, committed: true, finished: true, result };
    } finally {
      submitting = false;
    }
  }

  function submitWithCallbacks(result, reviewState, callbacks) {
    const submission = submitResult(result, reviewState);
    if (submission.ok) callbacks.onSuccess(submission);
    else callbacks.onFailure(submission);
    return submission;
  }

  function closeSession() {
    if (!initialized || finished) return;
    if (["completed", "passed", "failed"].includes(getValue("cmi.core.lesson_status"))) {
      if (!api) finished = true;
      else finished = call("finish", "LMSFinish", "").ok;
      return;
    }
    if (finalCommitted) {
      finish();
      return;
    }
    if (draftProvider) {
      try { saveDraft(draftProvider()); } catch (error) { console.warn("[SCORM] draft save failed", error); }
    } else {
      setValue("cmi.core.exit", "suspend");
      commit();
    }
    if (!api) {
      finished = true;
      return;
    }
    finished = call("finish", "LMSFinish", "").ok;
  }

  function isAttemptFinished() {
    return ["completed", "passed", "failed"].includes(getValue("cmi.core.lesson_status"));
  }

  window.SimScorm = {
    init,
    getValue,
    isAttemptFinished,
    submitResult,
    submitWithCallbacks,
    makeSnapshot,
    readSnapshot,
    saveDraft,
    setDraftProvider: (provider) => { draftProvider = provider; },
    snapshotBytes,
    finish,
    getLocalLog: () => localLog.slice()
  };

  window.addEventListener("pagehide", closeSession);
})();
