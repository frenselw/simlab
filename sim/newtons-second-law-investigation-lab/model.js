(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  const ROLES = ["mass", "force", "acceleration"];
  const METHODS = ["linear", "origin", "quadratic", "inverse"];
  const GRAPH_NAMES = ["a–F合", "a–m", "a–1/m"];
  const MEANINGS = [["mass", "總質量 m"], ["inverse-mass", "總質量的倒數 1/m"], ["force", "合外力 F合"], ["inverse-force", "合外力的倒數 1/F合"]];
  const INTERPRETATIONS = [
    { title: "正確控制變量時，這幅圖的直線斜率 k 對應哪個物理量？", answer: "inverse-mass" },
    { title: "正確控制變量時，反比例模型 a = k/m 的係數 k 對應哪個物理量？", answer: "force" },
    { title: "正確控制變量時，這幅圖的直線斜率 k 對應哪個物理量？", answer: "force" }
  ];
  const QUESTIONS = [
    { title: "總質量保持不變時，加速度與合外力有甚麼關係？", options: [["direct", "成正比"], ["inverse", "成反比"], ["quadratic", "與合外力的平方成正比"], ["independent", "沒有關係"]] },
    { title: "合外力保持不變時，加速度與總質量有甚麼關係？", options: [["inverse", "成反比"], ["direct", "成正比"], ["inverse-square", "與質量的平方成反比"], ["independent", "沒有關係"]] },
    { title: "怎樣的直線圖像，才支持兩個量成正比？", options: [["near-origin", "直線近似通過原點"], ["any-line", "只要是直線便足夠"], ["positive-slope", "只要直線向上傾斜"], ["negative-slope", "只要直線向下傾斜"]] },
    { title: "a–m 圖呈下降趨勢。哪項進一步證據支持反比關係？", options: [["linear-reciprocal", "a–1/m 圖近似為通過原點的直線"], ["decrease-only", "只要 m 越大、a 越小便足夠"], ["few-points", "只要兩個點能連成直線"], ["curved-only", "只要 a–m 圖是曲線便足夠"]] },
    { title: "在本活動的 SI 單位與一維情境中，三個量的關係式是？", options: [["f-ma", "F合 = ma"], ["f-m-div-a", "F合 = m/a"], ["f-a-div-m", "F合 = a/m"], ["f-m-plus-a", "F合 = m + a"]] }
  ];
  const mass = i => .5 + .25 * i;
  const force = i => (i + 1) / 5;
  function motion(mi, fi, t) {
    if (!integer(mi, 0, 6) || !integer(fi, 0, 5) || !Number.isFinite(t) || t < 0) throw new Error("Invalid measurement settings");
    const acceleration = force(fi) / mass(mi);
    const position = .1 + acceleration * t * t / 2, velocity = acceleration * t;
    if (!Number.isFinite(position) || !Number.isFinite(velocity)) throw new Error("Invalid motion time");
    return { time: t, position, velocity, acceleration };
  }
  function measure(mi, fi) {
    const samples = Array.from({ length: 11 }, (_, i) => motion(mi, fi, i / 10));
    const mt = .5, mv = samples.reduce((s, p) => s + p.velocity, 0) / 11;
    const slope = samples.reduce((s, p) => s + (p.time - mt) * (p.velocity - mv), 0) / samples.reduce((s, p) => s + (p.time - mt) ** 2, 0);
    return [mi, fi, Math.round(slope * 1000)];
  }
  function validRecord(r) { return Array.isArray(r) && r.length === 3 && integer(r[0], 0, 6) && integer(r[1], 0, 5) && integer(r[2], 100, 2400) && measure(r[0], r[1])[2] === r[2]; }
  function values(r) { return { m: mass(r[0]), f: force(r[1]), a: r[2] / 1000, inverse: Math.round(1000 / mass(r[0])) / 1000 }; }
  const sourceGroup = graph => graph === 0 ? 0 : 1;
  function expected(graph, r) { const v = values(r); return [graph === 0 ? v.f : graph === 1 ? v.m : v.inverse, v.a]; }
  function bounds(state, graph) {
    const rows = state.groups[sourceGroup(graph)].records;
    const target = rows.length ? 1.1 * Math.max(...rows.map(r => r[2] / 1000)) : 1;
    const y = [.2, .25, .3, .4, .5, .6, .8, 1, 1.2, 1.5, 2, 2.5, 3].find(v => v + 1e-12 >= target) || 3;
    return { x: graph === 0 ? 1.4 : 2.25, y };
  }
  const emptyPlot = (schemaVersion = 2) => ({ points: [], model: null, fitAttempted: false, ...(schemaVersion === 2 ? { meaning: null } : {}) });
  function fresh(rubricVersion = 2) {
    return { schemaVersion: 2, modelVersion: 1, rubricVersion,
      groups: Array.from({ length: 2 }, () => ({ roles: [null, null, null], records: [] })),
      plots: Array.from({ length: 3 }, () => emptyPlot()), conclusions: [null, null, null, null, null],
      phase: "collect", group: 0, graph: null, returnToCheck: false,
      setups: Array.from({ length: 2 }, () => ({ settings: [2, 2], locks: [false, false], candidate: null })) };
  }
  function related(group) { return group === 0 ? [0] : [1, 2]; }
  function change(original, action) {
    const s = clone(original), group = action.group ?? s.group, graph = action.graph ?? s.graph;
    const g = s.groups[group], setup = s.setups?.[group], p = s.plots[graph];
    switch (action.type) {
      case "role": if (g && integer(action.index, 0, 2) && (action.value === null || ROLES.includes(action.value))) g.roles[action.index] = action.value; break;
      case "setting":
        if (setup && integer(action.index, 0, 1) && integer(action.value, 0, action.index ? 5 : 6) && !setup.locks[action.index]) { setup.settings[action.index] = action.value; setup.candidate = null; } break;
      case "lock": if (setup && integer(action.index, 0, 1)) setup.locks[action.index] = !setup.locks[action.index]; break;
      case "measure": if (setup && g.records.length < 6) setup.candidate = measure(...setup.settings); break;
      case "discard": if (setup) setup.candidate = null; break;
      case "record":
        if (setup?.candidate && g.records.length < 6) { g.records.push(setup.candidate); setup.candidate = null; for (const k of related(group)) { s.plots[k].points.push(null); s.plots[k].fitAttempted = false; } } break;
      case "removeRecord":
        if (g && integer(action.index, 0, g.records.length - 1)) { g.records.splice(action.index, 1); for (const k of related(group)) { s.plots[k].points.splice(action.index, 1); s.plots[k].fitAttempted = false; } } break;
      case "place":
        if (p && integer(action.index, 0, p.points.length - 1) && JSON.stringify(p.points[action.index]) !== JSON.stringify(action.point)) { p.points[action.index] = action.point === null ? null : clone(action.point); p.fitAttempted = false; } break;
      case "model": if (p && (action.value === null || METHODS.includes(action.value))) { p.model = action.value; p.fitAttempted = false; } break;
      case "fit": if (p?.model) p.fitAttempted = true; break;
      case "meaning": if (s.schemaVersion === 2 && p && (action.value === null || MEANINGS.some(([value]) => value === action.value))) p.meaning = action.value; break;
      case "conclusion": if (integer(action.index, 0, 4) && (action.value === null || QUESTIONS[action.index].options.some(o => o[0] === action.value))) s.conclusions[action.index] = action.value; break;
      case "clearGraph": if (p) s.plots[graph] = { ...emptyPlot(s.schemaVersion), points: p.points.map(() => null) }; break;
      case "clearGroup": if (g) { g.records = []; setup.candidate = null; for (const k of related(group)) s.plots[k] = emptyPlot(s.schemaVersion); } break;
      case "clearAll": return fresh(s.rubricVersion);
      default: break;
    }
    return s;
  }
  return Object.freeze({ clone, integer, ROLES, METHODS, GRAPH_NAMES, MEANINGS, INTERPRETATIONS, QUESTIONS, mass, force, motion, measure, validRecord, values, sourceGroup, expected, bounds, fresh, change, related });
});
