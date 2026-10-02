(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./component-registry.js") : root.CircuitRegistry);
  if (typeof module === "object" && module.exports) module.exports = api; else root.CircuitModel = api;
})(globalThis, function (R) {
  "use strict";
  const limits = Object.freeze({ components: 80, junctions: 120, wires: 240, bends: 24, stroke: 96, bytes: 262144, coordinate: 10000 });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const empty = () => ({ kind: "simlab-circuit", version: 2, components: [], junctions: [], wires: [], policy: { mode: "free", allowRotate: false, allowParams: false, allowSwitch: true }, display: { view: "real", flow: "current", meters: "digital", potential: false, values: true, reference: null, projection: false } });
  function object(value, keys) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !keys.includes(k))) throw new Error("電路檔含不支援的欄位"); }
  function numeric(v, min, max) { if (!Number.isFinite(v) || v < min || v > max) throw new Error("數值超出合法範圍"); }
  const bool = (v) => { if (typeof v !== "boolean") throw new Error("設定必須是布林值"); };
  const choice = (v, choices) => { if (!choices.includes(v)) throw new Error("不支援的設定值"); };
  const point = (p) => { object(p, ["x", "y"]); numeric(p.x, -limits.coordinate, limits.coordinate); numeric(p.y, -limits.coordinate, limits.coordinate); };
  function endpoints(doc) { const map = new Map(); doc.components.forEach((c) => R.ports(c).forEach((p) => map.set(p.id, p))); doc.junctions.forEach((j) => map.set(j.id + ":p", { ...j, id: j.id + ":p", dx: 0, dy: 0, label: "接點" })); return map; }
  function validate(input) {
    object(input, ["kind", "version", "components", "junctions", "wires", "policy", "display"]);
    if (input.kind !== "simlab-circuit" || ![1, 2].includes(input.version)) throw new Error("不支援的電路檔版本");
    const ids = new Set();
    const id = (value) => { if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,39}$/i.test(value) || ids.has(value)) throw new Error("元件或導線 ID 無效或重複"); ids.add(value); };
    for (const key of ["components", "junctions", "wires"]) if (!Array.isArray(input[key]) || input[key].length > limits[key]) throw new Error("電路超出容量限制");
    input.components.forEach((c) => {
      object(c, ["id", "type", "label", "x", "y", "angle", "locked", "editable", "params"]); id(c.id);
      if (typeof c.label !== "string" || c.label.length > 40) throw new Error("元件名稱過長或無效");
      numeric(c.x, -limits.coordinate, limits.coordinate); numeric(c.y, -limits.coordinate, limits.coordinate); choice(c.angle, [0, 90, 180, 270]); bool(c.locked); bool(c.editable);
      const specs = R.get(c.type).params; object(c.params, Object.keys(specs));
      for (const [k, spec] of Object.entries(specs)) if (spec.choices) choice(c.params[k], spec.choices); else numeric(c.params[k], spec.min, spec.max);
    });
    input.junctions.forEach((j) => { object(j, ["id", "x", "y"]); id(j.id); numeric(j.x, -limits.coordinate, limits.coordinate); numeric(j.y, -limits.coordinate, limits.coordinate); });
    const ports = endpoints(input), pairs = new Set();
    input.wires.forEach((w) => {
      object(w, input.version === 1 ? ["id", "from", "to", "via"] : ["id", "from", "to", "via", "shape"]); id(w.id);
      if (!ports.has(w.from) || !ports.has(w.to) || w.from === w.to) throw new Error("導線端點不存在或自接");
      const pair = [w.from, w.to].sort().join("|"); if (pairs.has(pair)) throw new Error("有重複的導線"); pairs.add(pair);
      const shape = input.version === 1 ? "auto" : w.shape; choice(shape, ["auto", "free", "smooth"]);
      if (!Array.isArray(w.via) || w.via.length > (shape === "auto" ? limits.bends : limits.stroke)) throw new Error("導線路徑點過多"); w.via.forEach(point);
    });
    object(input.policy, ["mode", "allowRotate", "allowParams", "allowSwitch"]); choice(input.policy.mode, ["free", "wiring"]); ["allowRotate", "allowParams", "allowSwitch"].forEach((k) => bool(input.policy[k]));
    object(input.display, ["view", "flow", "meters", "potential", "values", "reference", "projection"]);
    choice(input.display.view, ["real", "schematic"]); choice(input.display.flow, ["off", "current", "electron"]); choice(input.display.meters, ["digital", "analog"]);
    ["potential", "values", "projection"].forEach((k) => bool(input.display[k]));
    if (input.display.reference !== null && !ports.has(input.display.reference)) throw new Error("參考端點不存在");
    const valid = clone(input); valid.version = 2;
    if (input.version === 1) valid.wires.forEach((w) => { w.shape = "auto"; });
    return valid;
  }
  function nextId(doc, prefix) { const ids = new Set([...doc.components, ...doc.junctions, ...doc.wires].map((x) => x.id)); let n = 1; while (ids.has(prefix + n)) n++; return prefix + n; }
  function component(doc, type, x, y, params = {}) { R.get(type); return { id: nextId(doc, "c"), type, label: R.get(type).name, x, y, angle: 0, locked: false, editable: false, params: { ...R.defaults(type), ...params } }; }
  function permission(doc, c, operation) {
    if (operation === "switch") return doc.policy.allowSwitch;
    if (doc.policy.mode === "wiring") return operation === "rotate" ? doc.policy.allowRotate : operation === "params" ? doc.policy.allowParams || c.editable : false;
    return !c.locked;
  }
  function add(doc, type, x, y, params) { if (doc.policy.mode !== "free") throw new Error("目前固定元件，只能接線"); const c = component(doc, type, x, y, params); doc.components.push(c); return c; }
  function connect(doc, from, to, via = [], shape = "auto") {
    if (!endpoints(doc).has(from) || !endpoints(doc).has(to) || from === to) throw new Error("請選擇兩個不同的有效端點");
    if (doc.wires.some((w) => (w.from === from && w.to === to) || (w.from === to && w.to === from))) throw new Error("這兩個端點已接好");
    const w = { id: nextId(doc, "w"), from, to, via: clone(via), shape }; doc.wires.push(w); return w;
  }
  function remove(doc, id) {
    const c = doc.components.find((x) => x.id === id); if (c && !permission(doc, c, "remove")) throw new Error("這個元件已固定");
    const removedPorts = new Set(c ? R.ports(c).map((p) => p.id) : [id + ":p"]);
    doc.components = doc.components.filter((x) => x.id !== id); doc.junctions = doc.junctions.filter((x) => x.id !== id);
    doc.wires = doc.wires.filter((w) => w.id !== id && !removedPorts.has(w.from) && !removedPorts.has(w.to));
    if (removedPorts.has(doc.display.reference)) doc.display.reference = null;
  }
  function splitWire(doc, wireId, p, route) {
    const w = doc.wires.find((x) => x.id === wireId); if (!w) throw new Error("導線不存在");
    const j = { id: nextId(doc, "j"), x: p.x, y: p.y }; doc.junctions.push(j);
    const i = p.segment, left = route.slice(1, i + 1), right = route.slice(i + 1, -1);
    // A cut follows the displayed curve. Re-interpolating the two halves would move it.
    const shape = w.shape === "auto" ? "auto" : "free", limit = shape === "auto" ? limits.bends : limits.stroke;
    const bounded = (points) => points.length <= limit ? points.map(({x,y}) => ({x,y})) : Array.from({length:limit}, (_, n) => { const at = points[Math.round(n * (points.length - 1) / (limit - 1))]; return {x:at.x,y:at.y}; });
    doc.wires = doc.wires.filter((x) => x !== w);
    connect(doc, w.from, j.id + ":p", bounded(left), shape); connect(doc, j.id + ":p", w.to, bounded(right), shape); return j.id + ":p";
  }
  function history(initial) {
    let value = validate(initial), past = [], future = [];
    return { get: () => value, change(fn) { const next = clone(value); const result = fn(next); const checked = validate(next); if (JSON.stringify(value) !== JSON.stringify(checked)) { past.push(value); if (past.length > 80) past.shift(); value = checked; future = []; } return result; }, replace(doc) { this.change((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, validate(doc)); }); }, undo() { if (!past.length) return false; future.push(value); value = past.pop(); return true; }, redo() { if (!future.length) return false; past.push(value); value = future.pop(); return true; }, canUndo: () => past.length > 0, canRedo: () => future.length > 0 };
  }
  return { limits, clone, empty, validate, endpoints, nextId, component, permission, add, connect, remove, splitWire, history };
});
