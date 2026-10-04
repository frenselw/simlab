(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry, node ? require("./circuit-routing.js") : root.CircuitRouting,node?require('./circuit-experiments.js'):root.CircuitExperiments);
  if (typeof module === "object" && module.exports) module.exports = api; else root.CircuitModel = api;
})(globalThis, function (R, G, E) {
  "use strict";
  const limits = Object.freeze({ components: 80, junctions: 600, wires: 240, bends: 24, stroke: 96, bytes: 262144, coordinate: 10000 });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const empty = () => ({ kind: "simlab-circuit", version: 4, components: [], junctions: [], wires: [], cables: {count:20,length:600}, policy: { mode: "free", allowRotate: false, allowParams: false, allowSwitch: true }, display: { view: "real", flow: "current", meters: "digital", potential: false, names: true, values: true, reference: null, projection: false } });
  function object(value, keys) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !keys.includes(k))) throw new Error("電路檔含不支援的欄位"); }
  function numeric(v, min, max) { if (!Number.isFinite(v) || v < min || v > max) throw new Error("數值超出合法範圍"); }
  const bool = (v) => { if (typeof v !== "boolean") throw new Error("設定必須是布林值"); };
  const choice = (v, choices) => { if (!choices.includes(v)) throw new Error("不支援的設定值"); };
  const point = (p) => { object(p, ["x", "y"]); numeric(p.x, -limits.coordinate, limits.coordinate); numeric(p.y, -limits.coordinate, limits.coordinate); };
  function endpoints(doc,legacy=false) { const map = new Map(); doc.components.forEach((c) => (legacy?R.legacyPorts(c):R.ports(c)).forEach((p) => map.set(p.id, p))); doc.junctions.forEach((j) => map.set(j.id + ":p", { ...j, id: j.id + ":p", dx: 0, dy: 0, label: "接點" })); return map; }
  function validate(input) {
    object(input, ["kind", "version", "components", "junctions", "wires", "policy", "display", "measurements", ...(input?.version>=3?["cables"]:[])]);
    if (input.kind !== "simlab-circuit" || ![1, 2, 3, 4].includes(input.version)) throw new Error("不支援的電路檔版本");
    const ids = new Set();
    const id = (value) => { if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,39}$/i.test(value) || ids.has(value)) throw new Error("元件或導線 ID 無效或重複"); ids.add(value); };
    for (const key of ["components", "junctions", "wires"]) if (!Array.isArray(input[key]) || input[key].length > limits[key]) throw new Error("電路超出容量限制");
    input.components.forEach((c) => {
      object(c, ["id", "type", "label", "x", "y", "angle", "locked", "editable", "params"]); id(c.id);
      if (typeof c.label !== "string" || c.label.length > 40) throw new Error("元件名稱過長或無效");
      numeric(c.x, -limits.coordinate, limits.coordinate); numeric(c.y, -limits.coordinate, limits.coordinate); choice(c.angle, [0, 90, 180, 270]); bool(c.locked); bool(c.editable);
      const specs = R.get(c.type).params; object(c.params, Object.keys(specs));
      for (const [k, spec] of Object.entries(specs)) {
        if(!Object.hasOwn(c.params,k)&&((c.type==='rheostat'&&k==='terminals')||(c.type==='lamp'&&['coldRatio','linearLoss'].includes(k))))continue;
        if(spec.choices)choice(c.params[k],spec.choices);else numeric(c.params[k],spec.min,spec.max);
      }
    });
    input.junctions.forEach((j) => { object(j, ["id", "x", "y"]); id(j.id); numeric(j.x, -limits.coordinate, limits.coordinate); numeric(j.y, -limits.coordinate, limits.coordinate); });
    const ports = endpoints(input,input.version<4), pairs = new Set();
    input.wires.forEach((w) => {
      object(w, input.version === 1 ? ["id", "from", "to", "via"] : ["id", "from", "to", "via", "shape", ...(input.version>=3?["length"]:[])]); id(w.id);
      if (!ports.has(w.from) || !ports.has(w.to) || (input.version<3 && w.from === w.to)) throw new Error("導線端點不存在或自接");
      const pair = [w.from, w.to].sort().join("|"); if (input.version<3 && pairs.has(pair)) throw new Error("有重複的導線"); pairs.add(pair);
      const shape = input.version === 1 ? "auto" : w.shape; choice(shape, ["auto", "free", "smooth"]);
      if (!Array.isArray(w.via) || w.via.length > (shape === "auto" ? limits.bends : limits.stroke)) throw new Error("導線路徑點過多"); w.via.forEach(point);
      if(input.version>=3){numeric(w.length,60,2000000);if(G.length(G.route(input,w))>w.length+.05)throw new Error("導線超過其限定長度；請先拔開或移近元件");}
    });
    if(input.version>=3){object(input.cables,["count","length"]);numeric(input.cables.count,1,limits.wires);if(!Number.isInteger(input.cables.count))throw new Error("導線數量必須是整數");numeric(input.cables.length,120,1200);if(input.wires.length>input.cables.count)throw new Error("已超過導線庫存數量");}
    object(input.policy, ["mode", "allowRotate", "allowParams", "allowSwitch"]); choice(input.policy.mode, ["free", "wiring"]); ["allowRotate", "allowParams", "allowSwitch"].forEach((k) => bool(input.policy[k]));
    object(input.display, ["view", "flow", "meters", "potential", "names", "values", "reference", "projection"]);
    choice(input.display.view, ["real", "schematic"]); choice(input.display.flow, ["off", "current", "electron"]); choice(input.display.meters, ["digital", "analog"]);
    ["potential", "values", "projection"].forEach((k) => bool(input.display[k]));
    if(Object.hasOwn(input.display,"names"))bool(input.display.names);
    if (input.display.reference !== null && !ports.has(input.display.reference)) throw new Error("參考端點不存在");
    if(Object.hasOwn(input,'measurements'))E.validate(input.measurements,input.components);
    const valid = clone(input);
    valid.components.forEach(c=>{if(c.type==='rheostat'&&!Object.hasOwn(c.params,'terminals'))c.params.terminals=2;if(c.type==='lamp'){if(!Object.hasOwn(c.params,'coldRatio'))c.params.coldRatio=10;if(!Object.hasOwn(c.params,'linearLoss'))c.params.linearLoss=0;}});
    if(!Object.hasOwn(valid.display,"names"))valid.display.names=true;
    if (input.version === 1) valid.wires.forEach((w) => { w.shape = "auto"; });
    if(input.version<3){valid.cables={count:Math.max(20,valid.wires.length),length:600};valid.wires.forEach(w=>{w.length=Math.max(600,Math.ceil(G.length(G.route(valid,w)))+100);});}
    const oldRoutes=input.version<4?valid.wires.map(w=>G.route(valid,w)):[];valid.version=4;
    if(input.version<4){const next=endpoints(valid),hasMeters=valid.components.some(R.dualMeter);valid.wires.forEach((w,i)=>{const a=ports.get(w.from),b=ports.get(w.to),na=next.get(w.from),nb=next.get(w.to),travel=Math.hypot(na.x-a.x,na.y-a.y)+Math.hypot(nb.x-b.x,nb.y-b.y);
      if(travel){w.length=Math.min(2000000,w.length+travel+1);w.shape="free";w.via=G.resample(G.deform(oldRoutes[i],na,nb,w.length),10).slice(1,-1).map(p=>({x:p.x,y:p.y}));}
      else if(hasMeters){w.shape="free";w.via=(oldRoutes[i].length<=limits.stroke+2?oldRoutes[i]:G.resample(oldRoutes[i],10)).slice(1,-1).map(p=>({x:p.x,y:p.y}));}
    });return validate(valid);}
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
    if(doc.wires.length>=doc.cables.count)throw new Error("導線已用完；刪除一條可放回工具箱");
    const w = { id: nextId(doc, "w"), from, to, via: clone(via), shape };
    // Connected constructors are for teacher presets/netlists. Interactive
    // cables always receive the exact toolbox budget in addWire().
    w.length=Math.max(doc.cables.length,Math.ceil(G.length(G.route(doc,w)))+160);doc.wires.push(w);return w;
  }
  const degree=(doc,endpoint)=>doc.wires.reduce((n,w)=>n+(w.from===endpoint)+(w.to===endpoint),0);
  const attached=(doc,w,key)=>!doc.junctions.some(j=>j.id+":p"===w[key])||degree(doc,w[key])>1;
  function cleanup(doc){const used=new Set(doc.wires.flatMap(w=>[w.from,w.to]));doc.junctions=doc.junctions.filter(j=>used.has(j.id+":p")||doc.display.reference===j.id+":p");}
  function freeEnd(doc,p){const j={id:nextId(doc,"j"),x:p.x,y:p.y};doc.junctions.push(j);return j.id+":p";}
  function addWire(doc,x,y){
    if(doc.wires.length>=doc.cables.count)throw new Error("導線已用完；刪除一條可放回工具箱");
    const span=Math.min(180,doc.cables.length*.65),a={x:x-span/2,y},b={x:x+span/2,y};
    const w={id:nextId(doc,"w"),from:freeEnd(doc,a),to:freeEnd(doc,b),via:[],shape:"free",length:doc.cables.length};doc.wires.push(w);return w;
  }
  function pose(doc,w,points){if(!points)return false;const fitted=G.fitLength(points,w.length);if(!fitted)return false;w.shape="free";w.via=(fitted.length>limits.stroke+2?G.resample(fitted,10):fitted).slice(1,-1).map(p=>({x:p.x,y:p.y}));return true;}
  function detach(doc,id,key,prune=true){const w=doc.wires.find(w=>w.id===id);if(!w||!["from","to"].includes(key))throw new Error("導線端點無效");if(!attached(doc,w,key))return w[key];const points=G.route(doc,w),p=endpoints(doc).get(w[key]);w[key]=freeEnd(doc,p);pose(doc,w,points);if(prune)cleanup(doc);return w[key];}
  function translateWire(doc,id,dx,dy){
    const w=doc.wires.find(w=>w.id===id);if(!w||attached(doc,w,"from")||attached(doc,w,"to"))throw new Error("接好的一端會固定；請拖自由端或線身");
    const path=G.route(doc,w),wantedX=dx,wantedY=dy;
    dx=Math.max(-limits.coordinate-Math.min(...path.map(p=>p.x)),Math.min(limits.coordinate-Math.max(...path.map(p=>p.x)),dx));
    dy=Math.max(-limits.coordinate-Math.min(...path.map(p=>p.y)),Math.min(limits.coordinate-Math.max(...path.map(p=>p.y)),dy));
    const refs=new Set([w.from,w.to]);doc.junctions.forEach(j=>{if(refs.has(j.id+":p")){j.x+=dx;j.y+=dy;}});
    w.shape="free";w.via=(path.length>limits.stroke+2?G.resample(path,10):path).slice(1,-1).map(p=>({x:p.x+dx,y:p.y+dy}));return {limited:dx!==wantedX||dy!==wantedY};
  }
  function moveWireEnd(doc,id,key,p){
    const w=doc.wires.find(w=>w.id===id),other=key==="from"?"to":"from",points=G.route(doc,w);detach(doc,id,key);
    const ends=endpoints(doc),anchor=ends.get(w[other]),bounded={x:Math.max(-limits.coordinate,Math.min(limits.coordinate,p.x)),y:Math.max(-limits.coordinate,Math.min(limits.coordinate,p.y))};
    const distance=Math.hypot(bounded.x-anchor.x,bounded.y-anchor.y),factor=Math.min(1,w.length/(distance||1));
    const target={x:anchor.x+(bounded.x-anchor.x)*factor,y:anchor.y+(bounded.y-anchor.y)*factor};
    const a=key==="from"?target:anchor,b=key==="to"?target:anchor;
    // An endpoint grip always fixes the far end. Only an attached far end
    // retains curvature; a wholly loose cable stays straight while resized.
    const fitted=attached(doc,w,other)?G.deform(points,a,b,w.length):[a,b];
    const j=doc.junctions.find(j=>j.id+":p"===w[key]);Object.assign(j,target);pose(doc,w,fitted);return {limited:distance>w.length||bounded.x!==p.x||bounded.y!==p.y};
  }
  function attach(doc,id,key,endpoint){
    const w=doc.wires.find(w=>w.id===id),target=endpoints(doc).get(endpoint);if(!w||!target||w[key]===endpoint)return false;
    const followReference=!attached(doc,w,key)&&doc.display.reference===w[key];
    const other=key==="from"?"to":"from",before=G.route(doc,w),otherFixed=attached(doc,w,other);
    if(endpoint===w[other]&&!otherFixed)return false;
    const anchor=endpoints(doc).get(w[other]);if(Math.hypot(target.x-anchor.x,target.y-anchor.y)>w.length)return false;
    detach(doc,id,key,false);
    const a=key==="from"?target:anchor,b=key==="to"?target:anchor;
    pose(doc,w,otherFixed?G.deform(before,a,b,w.length):[a,b]);
    w[key]=endpoint;if(followReference)doc.display.reference=endpoint;cleanup(doc);return true;
  }
  function bendWire(doc,id,at,dx,dy,radius=140){const w=doc.wires.find(w=>w.id===id);if(!attached(doc,w,"from")&&!attached(doc,w,"to"))return translateWire(doc,id,dx,dy);
    const bent=G.bend(G.route(doc,w),at,dx,dy,w.length,radius);pose(doc,w,bent.points);return {limited:bent.limited};
  }
  function reconcile(doc,before){
    const ends=endpoints(doc);
    for(const w of doc.wires){const old=before.wires.find(x=>x.id===w.id);if(!old)continue;const oldEnds=endpoints(before),a=ends.get(w.from),b=ends.get(w.to);if(!a||!b)return false;
      if(a.x===oldEnds.get(old.from)?.x&&a.y===oldEnds.get(old.from)?.y&&b.x===oldEnds.get(old.to)?.x&&b.y===oldEnds.get(old.to)?.y)continue;
      const fitted=G.followEndpoints(doc,w,G.route(before,old),a,b,w.length,before);if(!fitted)return false;pose(doc,w,fitted);
    }return true;
  }
  function remove(doc, id) {
    const c = doc.components.find((x) => x.id === id); if (c && !permission(doc, c, "remove")) throw new Error("這個元件已固定");
    const cable=doc.wires.find(w=>w.id===id);
    const removedPorts = new Set(c ? R.ports(c).map((p) => p.id) : cable ? [cable.from,cable.to].filter(endpoint=>doc.junctions.some(j=>j.id+":p"===endpoint)&&degree(doc,endpoint)===1) : [id + ":p"]);
    const ends=endpoints(doc),paths=new Map(doc.wires.filter(w=>removedPorts.has(w.from)||removedPorts.has(w.to)).map(w=>[w.id,G.route(doc,w)]));
    // Removing an object unplugs its cables; the physical cables stay on the table.
    doc.wires.forEach(w=>{if(w.id!==id)for(const key of ["from","to"])if(removedPorts.has(w[key]))w[key]=freeEnd(doc,ends.get(w[key]));});
    doc.components = doc.components.filter((x) => x.id !== id); doc.junctions = doc.junctions.filter((x) => x.id !== id);
    if(doc.measurements)for(const key of ['voltage','current'])if(doc.measurements[key]===id)doc.measurements[key]=null;
    doc.wires = doc.wires.filter((w) => w.id !== id);
    doc.wires.forEach(w=>{if(paths.has(w.id))pose(doc,w,paths.get(w.id));});
    if (removedPorts.has(doc.display.reference)) doc.display.reference = null;
    cleanup(doc);
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
  function straightenWire(doc,id) {
    const w=doc.wires.find(w=>w.id===id);if(!w)throw new Error("找不到導線");
    w.shape="free";w.via=[];
  }
  function setTerminals(doc,id,count){
    choice(count,[2,3,4]);const c=doc.components.find(c=>c.id===id&&c.type==='rheostat');
    if(!c||!permission(doc,c,'params'))throw new Error('這個變阻器不能修改接線孔');
    const before=clone(doc),oldPorts=R.ports(c);c.params.terminals=count;const keys=new Set(R.ports(c).map(p=>p.id));
    c.params.terminals=before.components.find(c=>c.id===id).params.terminals??2;
    for(const p of oldPorts)if(!keys.has(p.id)){doc.wires.filter(w=>w.from===p.id||w.to===p.id).forEach(w=>{for(const end of ['from','to'])if(w[end]===p.id)detach(doc,w.id,end,false);});if(doc.display.reference===p.id)doc.display.reference=null;}
    c.params.terminals=count;cleanup(doc);
    if(!reconcile(doc,before))throw new Error('導線太短，請先拔開或移近元件再切換接線孔');
  }
  function history(initial) {
    let value = validate(initial), past = [], future = [];
    return { get: () => value, change(fn) { const next = clone(value); const result = fn(next); const checked = validate(next); if (JSON.stringify(value) !== JSON.stringify(checked)) { past.push(value); if (past.length > 80) past.shift(); value = checked; future = []; } return result; }, replace(doc) { this.change((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, validate(doc)); }); }, undo() { if (!past.length) return false; future.push(value); value = past.pop(); return true; }, redo() { if (!future.length) return false; past.push(value); value = future.pop(); return true; }, canUndo: () => past.length > 0, canRedo: () => future.length > 0 };
  }
  return { limits, clone, empty, validate, endpoints, nextId, component, permission, add, connect, remove, splitWire, history, degree, attached, cleanup, addWire, detach, attach, moveWireEnd, translateWire, bendWire, straightenWire, setTerminals, reconcile };
});
