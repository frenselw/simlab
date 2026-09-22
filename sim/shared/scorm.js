(function () {
  "use strict";

  let api = null;
  let initialized = false;
  let finished = false;
  let finalCommitted = false;
  let submitting = false;
  let draftProvider = null;
  let launchStatus = "";
  let pendingFinal = null;
  let pendingCheckpoint = "";
  let pendingCheckpointCommitted = false;
  let pendingQuarantined = false;
  let lastFinalPayload = null;
  let writesBlocked = false;
  let lastDraftCheckpoint = "";
  let standaloneActivity = "";
  let standaloneStorage = "disabled";
  let standaloneValues = Object.create(null);
  let standaloneBundleLoaded = false;
  let standaloneReadError = false;
  let standaloneDirty = false;
  let standaloneHasDurableCheckpoint = false;
  let standaloneDurabilityFailure = false;
  const localLog = [];
  const SNAPSHOT_LIMIT = 4000;
  const FINISHED = ["completed", "passed", "failed"];
  const STANDALONE_FIELDS = ["cmi.suspend_data", "cmi.core.lesson_status", "cmi.core.score.raw", "cmi.core.score.min", "cmi.core.score.max", "cmi.core.exit"];

  function standaloneKey(activity, field) {
    return `simlab:${activity}:${field}`;
  }

  function standaloneBundleKey(activity = standaloneActivity) {
    return standaloneKey(activity, "checkpoint");
  }

  function enableStandalonePersistence(activity) {
    standaloneActivity = String(activity || "");
    standaloneStorage = "unavailable";
    standaloneValues = Object.create(null);
    standaloneBundleLoaded = false;
    standaloneReadError = false;
    standaloneDirty = false;
    standaloneHasDurableCheckpoint = false;
    standaloneDurabilityFailure = false;
    try {
      if (!standaloneActivity || !window.localStorage) return standaloneStorage;
      const probe = standaloneKey(standaloneActivity, "probe");
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      standaloneStorage = "available";
    } catch (_) {
      try {
        // Quota/security policies can deny writes while still allowing reads.
        // Keep an existing checkpoint readable, but never report new durable
        // writes as successful in this read-only mode.
        window.localStorage.getItem(standaloneBundleKey());
        standaloneStorage = "read-only";
      } catch (_) { standaloneStorage = "unavailable"; }
    }
    return standaloneStorage;
  }

  function loadStandaloneBundle() {
    if (standaloneBundleLoaded) return true;
    if (!("available" === standaloneStorage || "read-only" === standaloneStorage)) {
      standaloneBundleLoaded = !standaloneReadError;
      return standaloneBundleLoaded;
    }
    try {
      const bundle = window.localStorage.getItem(standaloneBundleKey());
      if (bundle !== null) {
        const values = JSON.parse(bundle);
        if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("invalid standalone checkpoint");
        standaloneValues = Object.create(null);
        Object.keys(values).forEach(key => { standaloneValues[key] = String(values[key]); });
        standaloneHasDurableCheckpoint = true;
      } else {
        // Read legacy per-field keys once so older local attempts remain
        // recoverable; all new transactions use the single checkpoint key.
        standaloneValues = Object.create(null);
        STANDALONE_FIELDS.forEach(key => {
          const value = window.localStorage.getItem(standaloneKey(standaloneActivity, key));
          if (value !== null) standaloneValues[key] = String(value);
        });
        standaloneHasDurableCheckpoint = Object.keys(standaloneValues).length > 0;
      }
      standaloneBundleLoaded = true;
      return true;
    } catch (_) {
      standaloneReadError = true;
      standaloneStorage = "unavailable";
      return false;
    }
  }

  function standaloneRead(key) {
    if (!standaloneActivity) return { ok: true, value: null };
    if (!loadStandaloneBundle()) return { ok: false, value: null };
    return { ok: true, value: Object.prototype.hasOwnProperty.call(standaloneValues, key) ? standaloneValues[key] : null };
  }

  function standaloneCommit() {
    if (!standaloneDirty) return true;
    if (!standaloneActivity) { standaloneDirty = false; return true; }
    if (standaloneStorage !== "available") {
      // A page that already had a durable checkpoint must never silently
      // downgrade a failed retry to memory-only success. The staged values
      // remain in memory, but the transaction stays frozen until a new
      // launch can verify writable storage.
      standaloneDirty = false;
      return standaloneHasDurableCheckpoint || standaloneDurabilityFailure ? false : true;
    }
    try {
      window.localStorage.setItem(standaloneBundleKey(), JSON.stringify(standaloneValues));
      standaloneDirty = false;
      standaloneHasDurableCheckpoint = true;
      standaloneDurabilityFailure = false;
      return true;
    } catch (_) {
      // Keep the staged values in this live page for an explicit retry, but
      // never report this transaction as durably committed.
      standaloneDirty = false;
      standaloneStorage = "unavailable";
      standaloneHasDurableCheckpoint = true;
      standaloneDurabilityFailure = true;
      return false;
    }
  }

  function clearStandaloneAttempt(activity = standaloneActivity) {
    if (!activity || !["available", "read-only"].includes(standaloneStorage)) return false;
    try {
      window.localStorage.removeItem(standaloneBundleKey(activity));
      STANDALONE_FIELDS.forEach(key => window.localStorage.removeItem(standaloneKey(activity, key)));
      if (activity === standaloneActivity) {
        standaloneValues = Object.create(null);
        standaloneBundleLoaded = true;
        standaloneDirty = false;
        standaloneHasDurableCheckpoint = false;
        standaloneDurabilityFailure = false;
      }
      return true;
    } catch (_) { return false; }
  }

  const bytes = (text) => new TextEncoder().encode(text).length;
  const snapshotBytes = (value) => bytes(JSON.stringify(value));

  function makeSnapshot(activity, kind, answer, result) {
    const snapshot = { version: 1, activity, kind, answer };
    if (result) {
      snapshot.score = result.score;
      snapshot.passed = Boolean(result.passed);
    }
    if (snapshotBytes(snapshot) > SNAPSHOT_LIMIT) throw new Error("SCORM snapshot exceeds 4000 bytes");
    return snapshot;
  }

  function findApi(win) {
    let current = win;
    for (let i = 0; i < 8 && current; i += 1) {
      try {
        if (current.API) return current.API;
        if (current.parent === current) break;
        current = current.parent;
      } catch { return null; }
    }
    return null;
  }

  function isStandalone() {
    try { return window.top === window && !window.opener; } catch { return false; }
  }

  function errorDetails(action, exception) {
    let code = "";
    let message = exception?.message || "";
    try {
      code = api?.LMSGetLastError?.() || "";
      message = api?.LMSGetErrorString?.(code) || message;
    } catch (error) { message ||= error.message; }
    const error = { action, code, message };
    console.warn("[SCORM] operation failed", error);
    return error;
  }

  function call(action, method, ...args) {
    try {
      if (!api?.[method]) return { ok: false, error: errorDetails(action) };
      const value = api[method](...args);
      return value === "true" ? { ok: true, value } : { ok: false, error: errorDetails(action) };
    } catch (error) { return { ok: false, error: errorDetails(action, error) }; }
  }

  function readValue(key) {
    if (!initialized && !init()) return { ok: false, error: { action: `get ${key}`, code: "initialize" } };
    if (!api) {
      const stored = standaloneRead(key);
      if (!stored.ok) return { ok: false, error: { action: `get ${key}`, code: "standalone-storage" } };
      if (stored.value !== null) return { ok: true, value: stored.value };
      for (let i = localLog.length - 1; i >= 0; i -= 1) if (localLog[i].key === key) return { ok: true, value: localLog[i].value };
      return { ok: true, value: "" };
    }
    try {
      const value = api.LMSGetValue(key);
      const code = api.LMSGetLastError?.() || "0";
      if (String(code) !== "0") return { ok: false, error: errorDetails(`get ${key}`) };
      return { ok: true, value: String(value ?? "") };
    } catch (error) { return { ok: false, error: errorDetails(`get ${key}`, error) }; }
  }

  function init() {
    if (initialized) return true;
    api = findApi(window) || (window.opener ? findApi(window.opener) : null);
    if (!api && isStandalone()) { initialized = true; return true; }
    if (!api) return false;
    initialized = call("initialize", "LMSInitialize", "").ok;
    return initialized;
  }

  function setValue(key, value) {
    if (!initialized && !init()) return false;
    const stringValue = String(value);
    if (api) return call(`set ${key}`, "LMSSetValue", key, stringValue).ok;
    if (standaloneReadError) return false;
    localLog.push({ key, value: stringValue });
    if (!standaloneBundleLoaded && !loadStandaloneBundle()) return false;
    standaloneValues[key] = stringValue;
    standaloneDirty = true;
    return true;
  }
  function getValue(key) { const outcome = readValue(key); return outcome.ok ? outcome.value : ""; }
  function commit() { return (!initialized && !init()) ? false : (api ? call("commit", "LMSCommit", "").ok : standaloneCommit()); }

  function parseSnapshot(raw) {
    try {
      const value = JSON.parse(raw || "null");
      if (!value || value.version !== 1 || typeof value.activity !== "string" || !value.kind) return null;
      return value;
    } catch { return null; }
  }

  function validPending(snapshot, activity) {
    const payload = snapshot?.payload;
    if (!payload || typeof payload.reviewJson !== "string" || !Number.isFinite(payload.score) ||
        !Number.isFinite(payload.maxScore) || typeof payload.passed !== "boolean") return false;
    const review = parseSnapshot(payload.reviewJson);
    return Boolean(review && review.activity === activity && review.kind === "review" && review.answer != null);
  }

  function readSnapshot(activity, kind) {
    // Compatibility helper for non-critical display code. Startup must use loadAttempt(),
    // which preserves LMS read failures instead of collapsing them to a missing snapshot.
    const raw = readValue("cmi.suspend_data");
    if (!raw.ok) return null;
    const value = parseSnapshot(raw.value);
    return value && value.activity === activity && value.kind === kind && value.answer != null ? value : null;
  }

  function loadAttempt(activity) {
    writesBlocked = false;
    lastDraftCheckpoint = "";
    if (!init()) { writesBlocked = true; return { state: "read-error", reason: "initialize" }; }
    const statusResult = readValue("cmi.core.lesson_status");
    const snapshotResult = readValue("cmi.suspend_data");
    const scoreResult = readValue("cmi.core.score.raw");
    if (!statusResult.ok || !snapshotResult.ok || !scoreResult.ok) {
      writesBlocked = true;
      return { state: "read-error", reason: !statusResult.ok ? "status" : !snapshotResult.ok ? "snapshot" : "score" };
    }
    launchStatus = statusResult.value;
    const done = FINISHED.includes(launchStatus);
    const raw = snapshotResult.value;
    const snapshot = parseSnapshot(raw);
    if (raw && (!snapshot || snapshot.activity !== activity)) {
      if (done) return { state: "finished", snapshot: null, fallback: true, status: launchStatus, score: scoreResult.value };
      writesBlocked = true;
      return { state: "inconsistent", reason: "corrupt-snapshot" };
    }
    if (done) {
      if (!snapshot) return { state: "finished", snapshot: null, fallback: true, status: launchStatus, score: scoreResult.value };
      if (snapshot.kind !== "review") {
        writesBlocked = true;
        return { state: "finished", snapshot: null, fallback: true, status: launchStatus, score: scoreResult.value };
      }
      return { state: "finished", snapshot, status: launchStatus, score: scoreResult.value };
    }
    if (!snapshot) return { state: "new" };
    if (snapshot.kind === "draft") return { state: "draft", snapshot };
    if (snapshot.kind === "pending-final") {
      if (!validPending(snapshot, activity)) {
        writesBlocked = true;
        pendingCheckpoint = raw;
        pendingCheckpointCommitted = true;
        return { state: "pending-invalid", reason: "corrupt-pending", snapshot };
      }
      pendingFinal = Object.freeze(snapshot.payload);
      pendingCheckpoint = raw;
      pendingCheckpointCommitted = true;
      return { state: "pending-final", snapshot };
    }
    writesBlocked = true;
    return { state: "inconsistent", reason: "unfinished-with-review" };
  }

  function saveDraft(snapshot) {
    if (finalCommitted || pendingFinal || !snapshot || snapshot.kind !== "draft" || snapshotBytes(snapshot) > SNAPSHOT_LIMIT) return false;
    const checkpoint = JSON.stringify(snapshot);
    const saved = setValue("cmi.suspend_data", checkpoint) && setValue("cmi.core.lesson_status", "incomplete") &&
      setValue("cmi.core.exit", "suspend") && commit();
    // Any failed attempt may have dirtied the LMS session buffer even though
    // its durable state did not change. Only a fully committed write is safe
    // to deduplicate later.
    lastDraftCheckpoint = saved ? checkpoint : "";
    return saved;
  }

  function saveProvidedDraft() {
    const snapshot = draftProvider();
    return JSON.stringify(snapshot) === lastDraftCheckpoint || saveDraft(snapshot);
  }

  function makePending(result, reviewState) {
    if (!reviewState || reviewState.kind !== "review") throw new Error("Final submission requires a review snapshot");
    const reviewJson = JSON.stringify(reviewState);
    if (bytes(reviewJson) > SNAPSHOT_LIMIT) throw new Error("SCORM snapshot exceeds 4000 bytes");
    const payload = { reviewJson, score: Number(result.score), maxScore: Number(result.maxScore || 100), passed: Boolean(result.passed) };
    if (!Number.isFinite(payload.score) || !Number.isFinite(payload.maxScore)) throw new Error("Invalid SCORM result");
    const checkpoint = { version: 1, activity: reviewState.activity, kind: "pending-final", payload };
    if (snapshotBytes(checkpoint) > SNAPSHOT_LIMIT) throw new Error("SCORM pending snapshot exceeds 4000 bytes");
    return { payload: Object.freeze(payload), checkpoint: JSON.stringify(checkpoint) };
  }

  function writeFinal(payload) {
    const writes = [
      ["cmi.suspend_data", payload.reviewJson, "snapshot"],
      ["cmi.core.score.min", 0, "score-min"],
      ["cmi.core.score.max", payload.maxScore, "score-max"],
      ["cmi.core.score.raw", payload.score, "score"],
      ["cmi.core.lesson_status", payload.passed ? "passed" : "failed", "status"],
      ["cmi.core.exit", "logout", "exit"]
    ];
    for (const [key, value, reason] of writes) if (!setValue(key, value)) return { ok: false, reason };
    if (!commit()) return { ok: false, reason: "commit" };
    finalCommitted = true;
    lastFinalPayload = payload;
    pendingFinal = null;
    pendingCheckpoint = "";
    pendingCheckpointCommitted = false;
    return { ok: true, review: parseSnapshot(payload.reviewJson), score: payload.score, status: payload.passed ? "passed" : "failed" };
  }

  function finish() {
    if (!initialized || finished) return true;
    if (!finalCommitted && !FINISHED.includes(launchStatus)) return false;
    if (!api) { finished = true; return true; }
    finished = call("finish", "LMSFinish", "").ok;
    return finished;
  }

  function retryPending(finishSession = true) {
    if (!pendingFinal) return { ok: false, reason: "no-pending" };
    if (!pendingCheckpointCommitted) {
      const checkpointOk = setValue("cmi.suspend_data", pendingCheckpoint) &&
        setValue("cmi.core.lesson_status", "incomplete") && setValue("cmi.core.exit", "suspend") && commit();
      if (!checkpointOk) return { ok: false, committed: false, retryable: true, frozen: true, reason: "checkpoint" };
      pendingCheckpointCommitted = true;
    }
    const final = writeFinal(pendingFinal);
    if (!final.ok) return { ok: false, committed: false, retryable: true, frozen: true, reason: final.reason };
    if (!finishSession) return { ok: true, committed: true, finished: false, review: final.review, score: final.score, status: final.status };
    const finishOk = finish();
    return finishOk
      ? { ok: true, committed: true, finished: true, review: final.review, score: final.score, status: final.status }
      : { ok: false, committed: true, finished: false, retryable: true, frozen: true, reason: "finish", review: final.review, score: final.score, status: final.status };
  }
  function retryFinish() {
    if (!finalCommitted) return { ok: false, committed: false, retryable: true, reason: "no-final" };
    const finishOk = finish();
    return finishOk
      ? { ok: true, committed: true, finished: true, review: lastFinalPayload ? parseSnapshot(lastFinalPayload.reviewJson) : null, score: lastFinalPayload?.score ?? null, status: lastFinalPayload?.passed ? "passed" : "failed" }
      : { ok: false, committed: true, finished: false, retryable: true, frozen: true, reason: "finish" };
  }

  function quarantinePending() {
    if (finalCommitted || pendingQuarantined) return false;
    // Leave the durable pending checkpoint untouched for diagnosis/recovery,
    // but prevent this page from retrying data the activity could not validate.
    pendingQuarantined = true;
    pendingFinal = null;
    pendingCheckpoint = "";
    pendingCheckpointCommitted = false;
    writesBlocked = true;
    return true;
  }

  function submitResult(result, reviewState) {
    if (submitting) return { ok: false, retryable: true, reason: "busy", result };
    submitting = true;
    try {
      if (!init()) return { ok: false, retryable: true, reason: "initialize", result };
      if (finalCommitted) return { ...retryFinish(), result };
      if (pendingFinal) return { ...retryPending(), result };
      let prepared;
      try { prepared = makePending(result, reviewState); } catch (error) { return { ok: false, retryable: false, reason: "preflight", error, result }; }
      pendingFinal = prepared.payload;
      pendingCheckpoint = prepared.checkpoint;
      pendingCheckpointCommitted = false;
      const checkpointOk = setValue("cmi.suspend_data", prepared.checkpoint) && setValue("cmi.core.lesson_status", "incomplete") &&
        setValue("cmi.core.exit", "suspend") && commit();
      if (!checkpointOk) return { ok: false, committed: false, retryable: true, frozen: true, reason: "checkpoint", result };
      pendingCheckpointCommitted = true;
      return { ...retryPending(), result };
    } finally { submitting = false; }
  }

  function submitWithCallbacks(result, reviewState, callbacks) {
    const raw = submitResult(result, reviewState);
    const submission = { ...raw, activityState: raw.ok ? "success" : raw.committed ? "committed" : raw.frozen ? "frozen" : "retry" };
    (submission.ok ? callbacks.onSuccess : callbacks.onFailure)(submission);
    return submission;
  }

  function closeSession() {
    if (!initialized || finished) return;
    if (writesBlocked) { if (api) call("finish", "LMSFinish", ""); return; }
    if (pendingFinal) {
      // A visible frozen submission is recovered only by a fresh launch or
      // an explicit learner retry. Never turn an unload into an implicit
      // second final commit after the page already reported the first one as
      // unconfirmed.
      return;
    }
    if (finalCommitted) { finish(); return; }
    if (FINISHED.includes(launchStatus)) { finish(); return; }
    if (draftProvider) {
      try { if (!saveProvidedDraft()) return; } catch (error) { console.warn("[SCORM] draft save failed", error); return; }
    } else if (!(setValue("cmi.core.exit", "suspend") && commit())) return;
    if (!api) finished = true;
    else finished = call("finish", "LMSFinish", "").ok;
  }

  function suspendSession() {
    if (!initialized || finished || writesBlocked) return;
    if (pendingFinal) { retryPending(false); return; }
    if (finalCommitted || FINISHED.includes(launchStatus)) { commit(); return; }
    if (draftProvider) {
      try { saveProvidedDraft(); } catch (error) { console.warn("[SCORM] draft save failed", error); }
    } else setValue("cmi.core.exit", "suspend") && commit();
  }

  window.SimScorm = {
    init, readValue, getValue, loadAttempt, enableStandalonePersistence, clearStandaloneAttempt,
    getStandaloneStorageStatus: () => standaloneStorage,
    isStandalone: () => Boolean(initialized && !api),
    isAttemptFinished: () => FINISHED.includes(getValue("cmi.core.lesson_status")),
    submitResult, submitWithCallbacks, retryPending, retryFinish, quarantinePending, makeSnapshot, readSnapshot, saveDraft,
    setDraftProvider: (provider) => { draftProvider = provider; }, snapshotBytes, finish,
    getLocalLog: () => localLog.slice()
  };
  window.addEventListener("pagehide", (event) => event?.persisted ? suspendSession() : closeSession());
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
})();
