"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Flow = require("../shared/activity-flow.js"), P = require("./persistence.js"), M = require("./model.js"), S = require("./scoring.js");
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
  const presentations = [], c = new Controller(window.SimScorm, Flow, current => presentations.push({ mode: current.mode, editable: current.editable, score: current.result?.score ?? null }));
  c.start(); return { c, scorm: window.SimScorm, durable, storage, flags, stats, events, presentations };
}
function record(state, group, mi, fi) {
  let s = state;
  for (const [index, value] of [mi, fi].entries()) s = M.change(s, {type:"setting", group, index, value});
  s = M.change(s, {type:"measure", group});
  return M.change(s, {type:"record", group});
}
function filled() {
  let s = M.fresh();
  s.groups[0].roles = ["force","mass","acceleration"];
  s.groups[1].roles = ["mass","force","acceleration"];
  for (let i=0;i<6;i++) { s = record(s,0,2,i); s = record(s,1,[0,1,2,3,4,6][i],2); }
  for (let graph=0;graph<3;graph++) {
    s.groups[M.sourceGroup(graph)].records.forEach((r,index)=> { s=M.change(s,{type:"place",graph,index,point:M.expected(graph,r).map(v=>Math.round(v*10000))}); });
    s=M.change(s,{type:"model",graph,value:graph===1?"inverse":"origin"}); s=M.change(s,{type:"fit",graph});
    s=M.change(s,{type:"meaning",graph,value:M.INTERPRETATIONS[graph].answer});
  }
  s.conclusions=M.QUESTIONS.map(q=>q.options[0][0]); return s;
}
function durableDraft(state) {
  const e=environment({standalone:true});
  return {"cmi.core.lesson_status":"incomplete","cmi.suspend_data":JSON.stringify(e.scorm.makeSnapshot(P.ACTIVITY,"draft",P.draft(state)))};
}
function finishedData(state) {
  const e=environment({standalone:true}),result=S.score(state);
  return {"cmi.core.lesson_status":result.passed?"passed":"failed","cmi.core.score.raw":String(result.score),"cmi.suspend_data":JSON.stringify(e.scorm.makeSnapshot(P.ACTIVITY,"review",P.review(state),result))};
}
function legacy(state) { const s=M.clone(state);s.schemaVersion=1;s.rubricVersion=1;s.plots.forEach(p=>{delete p.meaning;});return s; }
module.exports={environment,record,filled,durableDraft,finishedData,legacy};
