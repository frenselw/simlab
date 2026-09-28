"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Flow = require("../shared/activity-flow.js"), P = require("./persistence.js"), M = require("./model.js"), S = require("./scoring.js"), G = require("./generator.js");
const { Controller } = require("./ui-runtime.js");
const scormCode = fs.readFileSync(require.resolve("../shared/scorm.js"), "utf8");
function environment(options = {}) {
  const durable = options.durable || {}, storage = options.storage || new Map(), flags = options.flags || {};
  const values = { ...durable }, events = {}, stats = { commits: 0, writes: 0, finishes: 0, storageReads: 0, storageWrites: 0, storageRemoves: 0 }; let error = "0";
  const window = {
    location: { reload() {} }, addEventListener(name, fn) { events[name] = fn; },
    localStorage: {
      getItem(k) { stats.storageReads++; if (flags.storageReadFail) throw new Error("read"); return storage.get(k) ?? null; },
      setItem(k, v) {
        stats.storageWrites++; if (flags.storageWriteFail) throw new Error("write");
        storage.set(k, v);
      },
      removeItem(k) { stats.storageRemoves++; if (flags.storageRemoveFail) throw new Error("remove"); storage.delete(k); }
    }
  };
  window.parent = window; window.top = window;
  if (!options.standalone) window.API = {
    LMSInitialize: () => "true",
    LMSGetValue(k) { error = flags.readFail === k ? "101" : "0"; return error === "0" ? values[k] || "" : ""; },
    LMSSetValue(k, v) { stats.writes++; if (flags.writeFail === k) { error = "351"; return "false"; } values[k] = String(v); error = "0"; return "true"; },
    LMSCommit() { stats.commits++; if (flags.commitFail) { error = "391"; return "false"; } Object.assign(durable, values); error = "0"; return "true"; },
    LMSFinish() { stats.finishes++; error = flags.finishFail ? "101" : "0"; return flags.finishFail ? "false" : "true"; },
    LMSGetLastError: () => error, LMSGetErrorString: () => "test fixture", LMSGetDiagnostic: () => ""
  };
  vm.runInNewContext(scormCode, { window, console: { info() {}, warn() {}, error() {}, log() {} }, TextEncoder, setTimeout, clearTimeout });
  const presentations = [], c = new Controller(window.SimScorm, Flow, current => presentations.push({ mode: current.mode, editable: current.editable, score: current.result?.score ?? null }), () => options.seed ?? 21);
  c.start(); return { c, scorm: window.SimScorm, durable, storage, flags, stats, events, presentations };
}
function filled(seed=21,version=G.VERSION) { const s=P.fresh(seed,version);s.answers=G.generate(seed,version).questions.map(q=>M.clone(q.expected));return s; }
function envelope(kind,state) {const result=S.score(state);return {version:1,activity:P.ACTIVITY,kind,answer:kind==="review"?P.review(state):P.draft(state),...(kind==="review"?{score:result.score,passed:result.passed}:{})};}
function durableDraft(s) {return {"cmi.core.lesson_status":"incomplete","cmi.suspend_data":JSON.stringify(envelope("draft",s))};}
function finishedData(s) {const r=S.score(s);return {"cmi.core.lesson_status":r.passed?"passed":"failed","cmi.core.score.raw":String(r.score),"cmi.suspend_data":JSON.stringify(envelope("review",s))};}
function drawOne(c) {const index=c.targetIndex;c.command({type:"kind",index,kind:1});c.command({type:"body",index,body:0});c.command({type:"anchor",index,anchor:0});c.command({type:"place",index,angle:123.4,force:3.21});}
module.exports={environment,filled,envelope,durableDraft,finishedData,drawOne};
