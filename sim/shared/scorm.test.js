"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(__dirname + "/scorm.js", "utf8");
const result = { score: 72, maxScore: 100, passed: true };

function runtime(api, location = "standalone") {
  const listeners = {};
  const window = { API: api, opener: null, addEventListener: (name, fn) => { listeners[name] = fn; } };
  window.parent = location === "embedded" ? {} : window;
  window.top = location === "embedded" ? {} : window;
  if (location === "opener") window.opener = {};
  vm.runInNewContext(source, { window, console, JSON, TextEncoder });
  return { scorm: window.SimScorm, listeners };
}

function fakeApi(fail = {}, values = {}) {
  values.commits ||= 0;
  values.finishes ||= 0;
  return {
    LMSInitialize: () => fail.initialize ? "false" : "true",
    LMSSetValue(key, value) {
      if (fail.throw === key) throw new Error("fake exception");
      if (fail[key]) return "false";
      values[key] = value;
      return "true";
    },
    LMSGetValue: (key) => values[key] || "",
    LMSCommit: () => { values.commits += 1; return fail.commit ? "false" : "true"; },
    LMSFinish: () => { values.finishes += 1; return fail.finish ? "false" : "true"; },
    LMSGetLastError: () => "101",
    LMSGetErrorString: () => "fake LMS error"
  };
}

assert.equal(runtime(fakeApi()).scorm.init(), true);
assert.equal(runtime(fakeApi({ initialize: true })).scorm.init(), false);

for (const [failure, reason] of [
  ["cmi.suspend_data", "snapshot"],
  ["cmi.core.score.raw", "score"],
  ["cmi.core.lesson_status", "status"],
  ["cmi.core.exit", "exit"],
  ["commit", "commit"]
]) {
  const outcome = runtime(fakeApi({ [failure]: true })).scorm.submitResult(result, { answer: 1 });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, reason);
}

const finishFailure = runtime(fakeApi({ finish: true })).scorm.submitResult(result);
assert.equal(finishFailure.ok, false);
assert.equal(finishFailure.finished, false);
assert.equal(finishFailure.committed, true);
assert.equal(finishFailure.reason, "finish");

const committedValues = {};
const committedFailure = { finish: true };
const committedRuntime = runtime(fakeApi(committedFailure, committedValues));
const finalSnapshot = committedRuntime.scorm.makeSnapshot("activity", "review", { final: true }, result);
assert.equal(committedRuntime.scorm.submitResult(result, finalSnapshot).committed, true);
assert.equal(committedRuntime.scorm.saveDraft(committedRuntime.scorm.makeSnapshot("activity", "draft", { final: false })), false);
assert.equal(JSON.parse(committedValues["cmi.suspend_data"]).kind, "review");
committedFailure.finish = false;
committedRuntime.listeners.pagehide();
assert.equal(committedValues.finishes, 2);
assert.equal(JSON.parse(committedValues["cmi.suspend_data"]).kind, "review");

const finishFail = {};
const finishRetryRuntime = runtime(fakeApi(finishFail));
finishFail.finish = true;
assert.equal(finishRetryRuntime.scorm.submitResult(result).reason, "finish");
finishFail.finish = false;
assert.equal(finishRetryRuntime.scorm.submitResult(result).ok, true);

const exception = runtime(fakeApi({ throw: "cmi.core.score.raw" })).scorm.submitResult(result);
assert.equal(exception.ok, false);
assert.equal(exception.reason, "score");

const fail = {};
const retryRuntime = runtime(fakeApi(fail));
fail.commit = true;
assert.equal(retryRuntime.scorm.submitResult(result).ok, false);
fail.commit = false;
assert.equal(retryRuntime.scorm.submitResult(result).ok, true);

const local = runtime(null).scorm;
assert.equal(local.submitResult(result).ok, true);
assert(local.getLocalLog().some((entry) => entry.key === "cmi.core.score.raw" && entry.value === "72"));
assert.equal(runtime(null, "embedded").scorm.submitResult(result).reason, "initialize");
assert.equal(runtime(null, "opener").scorm.submitResult(result).reason, "initialize");

const pagehideValues = {};
const pagehideRuntime = runtime(fakeApi({}, pagehideValues));
assert.equal(pagehideRuntime.scorm.init(), true);
pagehideRuntime.listeners.pagehide();
assert.equal(pagehideValues["cmi.core.exit"], "suspend");
assert.equal(pagehideValues.commits, 1);
assert.equal(pagehideValues.finishes, 1);

const draftValues = {};
const draftRuntime = runtime(fakeApi({}, draftValues));
const draft = draftRuntime.scorm.makeSnapshot("activity", "draft", { step: 2 });
assert.equal(draftRuntime.scorm.saveDraft(draft), true);
assert.equal(JSON.parse(draftValues["cmi.suspend_data"]).answer.step, 2);
assert.equal(draftValues["cmi.core.exit"], "suspend");
assert.equal(draftRuntime.scorm.readSnapshot("activity", "draft").answer.step, 2);
assert.equal(draftRuntime.scorm.readSnapshot("other", "draft"), null);
assert.throws(() => draftRuntime.scorm.makeSnapshot("activity", "draft", { text: "x".repeat(4100) }), /4000 bytes/);

const providerValues = {};
const providerRuntime = runtime(fakeApi({}, providerValues));
providerRuntime.scorm.init();
providerRuntime.scorm.setDraftProvider(() => providerRuntime.scorm.makeSnapshot("activity", "draft", { step: 3 }));
providerRuntime.listeners.pagehide();
assert.equal(JSON.parse(providerValues["cmi.suspend_data"]).answer.step, 3);

const pagehideFailure = { finish: true };
const pagehideRetryValues = {};
const pagehideRetryRuntime = runtime(fakeApi(pagehideFailure, pagehideRetryValues));
assert.equal(pagehideRetryRuntime.scorm.init(), true);
pagehideRetryRuntime.listeners.pagehide();
assert.equal(pagehideRetryValues.finishes, 1);
pagehideFailure.finish = false;
const afterPagehideFailure = pagehideRetryRuntime.scorm.submitResult(result);
assert.equal(afterPagehideFailure.ok, true);
assert.equal(afterPagehideFailure.finished, true);
assert.equal(pagehideRetryValues.finishes, 2);

const repeatedPagehideFailure = { finish: true };
const repeatedPagehideValues = {};
const repeatedPagehideRuntime = runtime(fakeApi(repeatedPagehideFailure, repeatedPagehideValues));
assert.equal(repeatedPagehideRuntime.scorm.init(), true);
repeatedPagehideRuntime.listeners.pagehide();
repeatedPagehideFailure.finish = false;
repeatedPagehideRuntime.listeners.pagehide();
assert.equal(repeatedPagehideValues.finishes, 2);

for (const failingKey of ["cmi.core.score.raw", "cmi.core.lesson_status", "cmi.core.exit", "commit", "finish"]) {
  const failState = { [failingKey]: true };
  const gateRuntime = runtime(fakeApi(failState));
  let successes = 0;
  let failures = 0;
  gateRuntime.scorm.submitWithCallbacks(result, null, {
    onSuccess: () => { successes += 1; },
    onFailure: () => { failures += 1; }
  });
  assert.equal(successes, 0);
  assert.equal(failures, 1);
  failState[failingKey] = false;
  gateRuntime.scorm.submitWithCallbacks(result, null, {
    onSuccess: () => { successes += 1; },
    onFailure: () => { failures += 1; }
  });
  assert.equal(successes, 1);
  assert.equal(failures, 1);
}

let committedCallback = false;
runtime(fakeApi({ finish: true })).scorm.submitWithCallbacks(result, { final: true }, {
  onSuccess: () => assert.fail("finish failure must not report full success"),
  onFailure: (submission) => { committedCallback = submission.committed === true; }
});
assert.equal(committedCallback, true);

console.log("SCORM fake LMS checks passed");
