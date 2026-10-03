(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./circuit-model.js") : root.CircuitModel, node ? require("./circuit-routing.js") : root.CircuitRouting);
  if (node) module.exports = api; else root.CircuitPresets = api;
})(globalThis, function (M, G) {
  "use strict";
  const names = { series: "兩燈串聯", parallel: "兩燈並聯", mixed: "串並混聯", ohm: "全電路歐姆定律", meters: "A／V／W 表接線", bridge: "橋式電路", wiring: "固定元件接線", empty: "空白畫布" };
  function create(name) {
    const d = M.empty(); if (name === "empty") return d;
    function add(type, x, y, label, params = {}, angle = 0) { const c = M.add(d, type, x, y, params); c.label = label; c.angle = angle; return c; }
    function link(a, ap, b, bp, via = []) {
      const from=(typeof a==='string'?a:a.id)+':'+ap,to=(typeof b==='string'?b:b.id)+':'+bp,ends=M.endpoints(d),points=G.rounded([ends.get(from),...via,ends.get(to)]);
      const w=M.connect(d,from,to,points.slice(1,-1),'free');w.length=Math.max(600,Math.ceil(G.length(points))+400);return w;
    }
    const battery = add("battery", 180, 320, "電源", { voltage: 6, resistance: name === "ohm" ? 2 : 0 }, 90);
    if (["series", "wiring"].includes(name)) {
      battery.x=200;
      const s = add("switch", 350, 180, "開關"), l1 = add("lamp", 530, 180, "燈泡 1"), l2 = add("lamp", 650, 320, "燈泡 2", {}, 90);
      link(battery, "a", s, "a", [{ x: 200, y: 180 }]); link(s, "b", l1, "a"); link(l1, "b", l2, "a", [{ x: 650, y: 180 }]); link(l2, "b", battery, "b", [{ x: 650, y: 440 }, { x: 200, y: 440 }]);
    } else if (["parallel", "mixed"].includes(name)) {
      const s = add(name === "mixed" ? "resistor" : "switch", 340, 180, name === "mixed" ? "串聯電阻" : "開關"), l1 = add("lamp", 560, 240, "燈泡 1"), l2 = add("lamp", 560, 420, "燈泡 2");
      d.junctions.push({id:'j1',x:440,y:240},{id:'j2',x:700,y:420});
      link(battery,'a',s,'a',[{x:180,y:180}]);link(s,'b','j1','p',[{x:440,y:180}]);link('j1','p',l1,'a');link('j1','p',l2,'a',[{x:440,y:420}]);
      link(l1,'b','j2','p',[{x:700,y:240}]);link(l2,'b','j2','p');link('j2','p',battery,'b',[{x:700,y:540},{x:180,y:540}]);
    } else if (name === "ohm") {
      const a=add('ammeter',650,460,'電流表'),r=add('rheostat',800,320,'變阻器',{resistance:20,position:.5},90),v=add('voltmeter',400,300,'路端電壓');
      d.junctions.push({id:'j1',x:620,y:100});
      link(battery,'a','j1','p',[{x:180,y:100}]);link('j1','p',r,'a',[{x:800,y:100}]);link(r,'b',a,'a',[{x:800,y:620},{x:714,y:620}]);
      link(a,'b',battery,'b',[{x:586,y:620},{x:180,y:620}]);link(v,'a','j1','p',[{x:464,y:430},{x:540,y:430},{x:540,y:150},{x:620,y:150}]);
      link(v,'b',battery,'b',[{x:336,y:450},{x:260,y:450},{x:260,y:380}]);
    } else if (name === "meters") {
      battery.y=360;
      const a=add('ammeter',380,500,'電流表'),w=add('wattmeter',500,140,'電功率表'),l=add('lamp',780,360,'負載燈泡',{},90),v=add('voltmeter',990,460,'電壓表');
      d.junctions.push({id:'j1',x:780,y:260},{id:'j2',x:780,y:500});
      link(battery,'a',w,'a',[{x:180,y:120}]);link(w,'b','j1','p',[{x:780,y:120}]);link('j1','p',l,'a');link(l,'b','j2','p');
      link('j2','p',a,'a',[{x:780,y:640},{x:444,y:640}]);link(a,'b',battery,'b',[{x:316,y:640},{x:180,y:640}]);
      link(w,'c','j1','p',[{x:400,y:180},{x:400,y:260}]);link(w,'d','j2','p',[{x:600,y:180},{x:600,y:500}]);
      link(v,'a','j1','p',[{x:1054,y:580},{x:1120,y:580},{x:1120,y:260}]);link(v,'b','j2','p',[{x:926,y:580},{x:860,y:580},{x:860,y:500}]);
    } else if (name === "bridge") {
      battery.x=80;battery.y=370;
      const r1=add('resistor',380,160,'R₁',{resistance:10}),r2=add('resistor',620,160,'R₂',{resistance:20}),r3=add('resistor',380,620,'R₃',{resistance:10}),r4=add('resistor',620,620,'R₄',{resistance:20}),a=add('ammeter',500,360,'橋中電流',{},270);
      link(battery,'a',r1,'a',[{x:80,y:160}]);link(r1,'a',r3,'a',[{x:320,y:240},{x:260,y:240},{x:260,y:620}]);link(r1,'b',r2,'a');link(r3,'b',r4,'a');
      link(r2,'b',r4,'b',[{x:780,y:160},{x:780,y:620}]);link(r4,'b',battery,'b',[{x:680,y:800},{x:80,y:800}]);
      link(a,'a',r1,'b',[{x:700,y:296},{x:700,y:200},{x:440,y:200}]);link(a,'b',r3,'b',[{x:700,y:424},{x:700,y:570},{x:440,y:570}]);
    } else throw new Error("未知的範例");
    if (name === "series") {
      const paths = [[{x:200,y:219},{x:235,y:181},{x:280,y:178}],[],[{x:629,y:181},{x:650,y:217}],[{x:652,y:415},{x:620,y:440},{x:250,y:440},{x:200,y:415}]];
      d.wires.forEach((wire,i)=>{wire.shape="smooth";wire.via=paths[i];wire.length=600;});
    }
    if (name === "wiring") { d.wires = []; d.policy.mode = "wiring"; }
    return M.validate(d);
  }
  return { names, create };
});
