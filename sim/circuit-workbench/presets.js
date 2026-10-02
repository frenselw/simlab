(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./circuit-model.js") : root.CircuitModel);
  if (node) module.exports = api; else root.CircuitPresets = api;
})(globalThis, function (M) {
  "use strict";
  const names = { series: "兩燈串聯", parallel: "兩燈並聯", mixed: "串並混聯", ohm: "全電路歐姆定律", meters: "A／V／W 表接線", bridge: "橋式電路", wiring: "固定元件接線", empty: "空白畫布" };
  function create(name) {
    const d = M.empty(); if (name === "empty") return d;
    function add(type, x, y, label, params = {}, angle = 0) { const c = M.add(d, type, x, y, params); c.label = label; c.angle = angle; return c; }
    function link(a, ap, b, bp, via = []) { return M.connect(d, a.id + ":" + ap, b.id + ":" + bp, via); }
    const battery = add("battery", 180, 320, "電源", { voltage: 6, resistance: name === "ohm" ? 2 : 0 }, 90);
    if (["series", "wiring"].includes(name)) {
      const s = add("switch", 340, 180, "開關"), l1 = add("lamp", 560, 180, "燈泡 1"), l2 = add("lamp", 720, 320, "燈泡 2", {}, 90);
      link(battery, "a", s, "a", [{ x: 180, y: 180 }]); link(s, "b", l1, "a"); link(l1, "b", l2, "a", [{ x: 720, y: 180 }]); link(l2, "b", battery, "b", [{ x: 720, y: 460 }, { x: 180, y: 460 }]);
    } else if (["parallel", "mixed"].includes(name)) {
      const s = add(name === "mixed" ? "resistor" : "switch", 340, 180, name === "mixed" ? "串聯電阻" : "開關"), l1 = add("lamp", 560, 240, "燈泡 1"), l2 = add("lamp", 560, 400, "燈泡 2");
      const a = { id: "j1", x: 440, y: 180 }, b = { id: "j2", x: 680, y: 460 }; d.junctions.push(a, b);
      link(battery, "a", s, "a", [{ x: 180, y: 180 }]); M.connect(d, s.id + ":b", "j1:p"); M.connect(d, "j1:p", l1.id + ":a", [{ x: 440, y: 240 }]); M.connect(d, "j1:p", l2.id + ":a", [{ x: 440, y: 400 }]); M.connect(d, l1.id + ":b", "j2:p", [{ x: 680, y: 240 }]); M.connect(d, l2.id + ":b", "j2:p", [{ x: 680, y: 400 }]); M.connect(d, "j2:p", battery.id + ":b", [{ x: 180, y: 460 }]);
    } else if (name === "ohm") {
      const a = add("ammeter", 360, 180, "電流表"), r = add("rheostat", 620, 320, "變阻器", { resistance: 20, position: .5 }, 90), v = add("voltmeter", 800, 320, "路端電壓", {}, 90);
      link(battery, "a", a, "a", [{ x: 180, y: 180 }]); link(a, "b", r, "a", [{ x: 620, y: 180 }]); link(r, "b", battery, "b", [{ x: 620, y: 460 }, { x: 180, y: 460 }]); link(v, "a", r, "a"); link(v, "b", r, "b");
    } else if (name === "meters") {
      const a = add("ammeter", 340, 160, "電流表"), w = add("wattmeter", 560, 180, "電功率表"), l = add("lamp", 780, 320, "負載燈泡", {}, 90), v = add("voltmeter", 560, 440, "電壓表");
      link(battery, "a", a, "a", [{ x: 180, y: 160 }]); link(a, "b", w, "a"); link(w, "b", l, "a", [{ x: 780, y: 160 }]); link(l, "b", battery, "b", [{ x: 780, y: 540 }, { x: 180, y: 540 }]); link(w, "c", l, "a", [{ x: 480, y: 280 }, { x: 680, y: 280 }, { x: 680, y: 260 }]); link(w, "d", l, "b", [{ x: 680, y: 220 }, { x: 680, y: 520 }]); link(v, "a", l, "a", [{ x: 440, y: 440 }, { x: 440, y: 300 }, { x: 740, y: 300 }]); link(v, "b", l, "b", [{ x: 640, y: 440 }, { x: 640, y: 500 }, { x: 760, y: 500 }]);
    } else if (name === "bridge") {
      const r1 = add("resistor", 380, 220, "R₁", { resistance: 10 }), r2 = add("resistor", 620, 220, "R₂", { resistance: 20 }), r3 = add("resistor", 380, 440, "R₃", { resistance: 10 }), r4 = add("resistor", 620, 440, "R₄", { resistance: 20 }), a = add("ammeter", 500, 320, "橋中電流", {}, 90);
      link(battery, "a", r1, "a", [{ x: 180, y: 220 }]); link(battery, "a", r3, "a", [{ x: 240, y: 260 }, { x: 240, y: 440 }]); link(r1, "b", r2, "a"); link(r3, "b", r4, "a"); link(r2, "b", battery, "b", [{ x: 760, y: 220 }, { x: 760, y: 540 }, { x: 180, y: 540 }]); link(r4, "b", r2, "b", [{ x: 760, y: 440 }, { x: 760, y: 220 }]); link(a, "a", r1, "b"); link(a, "b", r3, "b");
    } else throw new Error("未知的範例");
    if (name === "series") {
      const paths = [[{x:177,y:217},{x:217,y:181},{x:252,y:178}],[],[{x:670,y:181},{x:712,y:212}],[{x:722,y:436},{x:659,y:460},{x:250,y:456},{x:178,y:425}]];
      d.wires.forEach((wire,i)=>{wire.shape="smooth";wire.via=paths[i];});
    }
    if (name === "wiring") { d.wires = []; d.policy.mode = "wiring"; }
    return M.validate(d);
  }
  return { names, create };
});
