(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.CentripetalModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentripetalPersistence = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const ACTIVITY = "centripetal-force-investigation-lab", MAX_BYTES = 4000;
  const fields = ["v", "mv", "rv", "seed", "page", "view", "fromReview", "returnTo", "tasks", "sync", "massParts"];
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  const integer = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;
  function keys(value, names) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== names.length ||
      !names.every(key => Object.prototype.hasOwnProperty.call(value, key))) throw new Error("Invalid fields");
  }
  function cfg(value) {
    if (!Array.isArray(value) || value.length !== 4 || !value.every((n, i) => integer(n, 0, i < 2 ? 6 : 8))) throw new Error("Invalid configuration");
  }
  function reference(value, length) { return value === null || integer(value, 0, length - 1); }
  function validate(state, kind = "draft") {
    if (!["draft", "review"].includes(kind)) throw new Error("Invalid kind");
    keys(state, fields);
    if (state.v !== 1 || ![1, 2, 3, 4, 5].includes(state.mv) || ![1, 2, 3, 4, 5, 6, 7].includes(state.rv) || !integer(state.seed, 0, 0xffffffff) ||
      !integer(state.page, 0, 2) || typeof state.fromReview !== "boolean" ||
      !["setup", "collect", "analyse", "check", "review"].includes(state.view)) throw new Error("Invalid state version or navigation");
    if (kind === "review" ? state.view !== "review" || state.returnTo !== null || state.fromReview || state.tasks?.some(task => task.current !== null) : state.view === "review") throw new Error("Invalid review phase");
    if (state.returnTo !== null && (!Array.isArray(state.returnTo) || state.returnTo.length !== 2 ||
      !integer(state.returnTo[0], 0, 2) || !["setup", "collect", "analyse"].includes(state.returnTo[1]) || state.view !== "check")) throw new Error("Invalid return route");
    if (state.view === "check" && state.returnTo === null) throw new Error("Missing return route");
    if (!Array.isArray(state.tasks) || state.tasks.length !== 3) throw new Error("Invalid tasks");
    state.tasks.forEach((task, i) => {
      keys(task, ["work", "current", "selected", "roles", "runs", "law", ...(state.rv >= 2 ? ["inquiry"] : [])]); cfg(task.work);
      if (state.rv >= 2 && (!Array.isArray(task.inquiry) || task.inquiry.length !== 2 ||
        task.inquiry.some((answer, j) => answer !== null && (i === 2 || !(j === 0 ? M.SETUP_REASONS : M.SPEED_RELATIONS).includes(answer))))) throw new Error("Invalid inquiry answer");
      if (!Array.isArray(task.runs) || task.runs.length > 2 || !reference(task.current, task.runs.length) ||
        !reference(task.selected, task.runs.length) || !Array.isArray(task.roles) || task.roles.length !== 2 ||
        (task.roles[0] !== null && !M.VARIABLES.includes(task.roles[0])) ||
        (task.roles[1] !== null && (!Array.isArray(task.roles[1]) || task.roles[1].length > 2 ||
          new Set(task.roles[1]).size !== task.roles[1].length || task.roles[1].some(v => !M.VARIABLES.includes(v))))) throw new Error("Invalid task selection");
      if (task.law !== null && !M.LAWS.includes(task.law)) throw new Error("Invalid law");
      task.runs.forEach(run => {
        keys(run, ["cfg", "q", "fit", "a"]); cfg(run.cfg);
        // A resumed run may retain 96 old dense readings plus 192 distinguishable speeds.
        if (!Array.isArray(run.q) || run.q.length > (state.mv >= 5 ? 288 : state.mv === 1 ? 24 : state.mv === 4 && i === 2 ? 96 : 48) ||
          run.q.some(q => !Number.isInteger(q) || Math.abs(q) < 250 || Math.abs(q) > (state.mv < 3 ? 6000 : M.MAX_OMEGA * 1000) || state.mv === 1 && q < 0) ||
          (state.mv === 4 && i === 2 && [1, -1].some(sign => run.q.filter(q => Math.sign(q) === sign).length > M.MAX_SAMPLES)) ||
          (state.mv >= 5 && run.q.some((q,j)=>j && q<=run.q[j-1])) ||
          new Set(state.mv === 1 ? run.q.map(M.slot) : run.q).size !== run.q.length || typeof run.fit !== "boolean" ||
          (run.fit && !M.fit(M.KINDS[i], run).ok) || !Array.isArray(run.a) || run.a.length !== 3 ||
          (run.a[0] !== null && (typeof run.a[0] !== "string" || run.a[0].length > 12 || !/^\d*(?:\.\d*)?$/.test(run.a[0]))) ||
          (run.a[1] !== null && !(i === 2 ? M.LAWS : M.COMPARE).includes(run.a[1])) ||
          (run.a[2] !== null && !M.REASONS.includes(run.a[2]))) throw new Error("Invalid run");
      });
    });
    if (["collect", "analyse"].includes(state.view) && state.tasks[state.page].current === null) throw new Error("Missing current run");
    if (state.returnTo && ["collect", "analyse"].includes(state.returnTo[1]) && state.tasks[state.returnTo[0]].current === null) throw new Error("Broken return route");
    if (state.sync !== null && !M.SYNC.includes(state.sync) || state.massParts !== null && !M.MASS_PARTS.includes(state.massParts)) throw new Error("Invalid conclusion");
    if (bytes(encode(state)) > MAX_BYTES) throw new Error("Snapshot too large");
    return M.clone(state);
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function pack(samples) {
    let bits = "", previous = -24001;
    for (const q of samples) {
      const delta = q - previous; previous = q;
      bits += "1".repeat(Math.floor(delta / 128)) + "0" + (delta % 128).toString(2).padStart(7,"0");
    }
    bits += "00000000";
    return bits.padEnd(Math.ceil(bits.length / 6) * 6,"0").match(/.{6}/g).map(value=>alphabet[parseInt(value,2)]).join("");
  }
  function unpack(value) {
    if(typeof value!=="string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid sample encoding");
    const bits=[...value].map(char=>alphabet.indexOf(char).toString(2).padStart(6,"0")).join("");
    let at=0,previous=-24001;const samples=[];
    while(at<bits.length) {
      let high=0;while(bits[at++]==="1")high++;
      if(at+7>bits.length)throw new Error("Truncated samples");
      const delta=high*128+parseInt(bits.slice(at,at+7),2);at+=7;
      if(!delta) {if(bits.length-at>5 || /1/.test(bits.slice(at)) || pack(samples)!==value)throw new Error("Invalid padding");return samples;}
      previous+=delta;
      if(previous>24000 || samples.length>=288)throw new Error("Invalid sample range");
      samples.push(previous);
    }
    throw new Error("Missing sample terminator");
  }
  function encode(state) {
    const answer = M.clone(state);
    if (answer.mv >= 4) answer.tasks.forEach(task => task.runs.forEach(run => {
      run.q = answer.mv >= 5 ? pack(run.q) : run.q.map(q => (q + 24000).toString(36).padStart(4, "0")).join("");
    }));
    return answer;
  }
  function review(state) {
    const answer = M.clone(state); answer.view = "review"; answer.returnTo = null; answer.fromReview = false;
    answer.tasks.forEach(task => { task.current = null; });
    return validate(answer, "review");
  }
  function decode(snapshot, kind) {
    if (!snapshot || snapshot.version !== 1 || snapshot.activity !== ACTIVITY || snapshot.kind !== kind || bytes(snapshot) > MAX_BYTES) throw new Error("Invalid envelope");
    if (kind === "review" && (!Number.isFinite(snapshot.score) || snapshot.score < 0 || snapshot.score > 100 || typeof snapshot.passed !== "boolean")) throw new Error("Invalid result");
    const answer = M.clone(snapshot.answer);
    if (answer?.mv >= 4) answer.tasks.forEach((task, i) => task.runs.forEach(run => {
      if(answer.mv>=5){run.q=unpack(run.q);return;}
      if (typeof run.q !== "string" || run.q.length > (i===2?96:48) * 4 || !/^(?:[0-9a-z]{4})*$/.test(run.q)) throw new Error("Invalid sample encoding");
      run.q = (run.q.match(/.{4}/g) || []).map(value => parseInt(value, 36) - 24000);
    }));
    return validate(answer, kind);
  }
  return Object.freeze({ ACTIVITY, MAX_BYTES, bytes, validate, encode, review, decode, fresh: M.fresh });
});
