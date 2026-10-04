"use strict";
const assert = require("node:assert/strict"), M = require("./circuit-model"), R = require("./component-registry"), S = require("./circuit-solver"), D = require("./circuit-document"), G = require("./circuit-routing"), V = require("./circuit-renderer"), P = require("./presets"), { XMLValidator } = require("fast-xml-parser");
const near = (a, b, msg, eps = 1e-7) => assert(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} != ${b}`);
function simple(resistance = 12, internal = 0, model = "ideal") { const d = M.empty(), b = M.add(d, "battery", 0, 0, { resistance: internal }), r = M.add(d, "lamp", 200, 0, { resistance, model }); M.connect(d, b.id + ":a", r.id + ":a"); M.connect(d, r.id + ":b", b.id + ":b"); return { d, b, r }; }
for (const name of Object.keys(P.names)) {
  const d = P.create(name), r = S.solve(d), restored = D.decode(D.encode(d)); assert.deepEqual(restored, d); assert.deepEqual(S.solve(restored).components, r.components); assert.equal(r.diagnostics.length, 0, name);
  // Execute a legal continuation after the production round trip.
  if (restored.policy.mode === "wiring") M.connect(restored, restored.components[0].id + ":a", restored.components[1].id + ":a"); else M.add(restored, "resistor", 900, 600);
  M.validate(restored); S.solve(restored);
}
near(S.solve(P.create("series")).components.c1.current, -.25, "series"); near(S.solve(P.create("parallel")).components.c1.current, -1, "parallel"); near(S.solve(P.create("bridge")).components.c6.reading, 0, "balanced bridge");
let f = simple(12, 2), out = S.solve(f.d); near(out.components[f.r.id].current, 6 / 14, "full circuit Ohm"); near(out.components[f.b.id].internalPower, (6 / 14) ** 2 * 2, "source heat"); near(out.components[f.b.id].sourcePower, out.components[f.b.id].delivered + out.components[f.b.id].internalPower, "source energy");
f = simple(12, 0, "thermal"); out = S.solve(f.d); near(out.components[f.r.id].current, .5, "thermal rated current", 1e-6); near(out.components[f.r.id].resistance, 12, "thermal rated R", 1e-6); near(out.components[f.r.id].temperature, 2600, "thermal rated temperature", 1e-6);
for (const voltage of [0, .0001, .1, 1, 3, 6, 12, 60]) { const at = R.lampAt(voltage, f.r.params); assert(at.conductance > 0); const dv = 1e-5; near(at.conductance, (R.lampAt(voltage + dv, f.r.params).current - R.lampAt(voltage - dv, f.r.params).current) / (2 * dv), "lamp Jacobian", 1e-4); f.b.params.voltage = voltage; out = S.solve(f.d); assert.equal(out.diagnostics.length, 0); assert(out.residual < 1e-8); near(out.components[f.r.id].power, voltage * out.components[f.r.id].current, "lamp power"); }
f = simple(); f.d.wires.pop(); out = S.solve(f.d); near(out.components[f.r.id].current, 0, "open loop"); assert.equal(out.voltage(f.b.id + ":b", f.r.id + ":b"), -6);
const isolated = M.add(f.d, "voltmeter", 0, 200); out = S.solve(f.d); assert.equal(out.components[isolated.id].reading, null, "floating meter"); assert.equal(out.voltage(f.b.id + ":a", isolated.id + ":a"), null);
f = simple(); M.connect(f.d, f.b.id + ":a", f.b.id + ":b"); out = S.solve(f.d); assert(out.diagnostics.some((x) => x.code === "inconsistent")); assert.equal(out.components[f.b.id].current, null);
f.r.params.model="thermal";out=S.solve(f.d);assert.equal(out.components[f.r.id].resistance,null,'failed thermal working resistance is unknown');assert(!V.scene(f.d,out).includes('1.2 Ω'),'failed thermal diagram cannot show a guessed cold resistance');f.r.params.model="ideal";
f.b.params.resistance = 2; out = S.solve(f.d); near(out.components[f.b.id].current, -3, "finite short current"); near(out.components[f.r.id].current, 0, "shorted load");
const independent = M.add(f.d, "battery", 500, 500); independent.params.voltage = 9; out = S.solve(f.d); near(out.voltage(independent.id + ":a", independent.id + ":b"), 9, "independent island"); assert.equal(out.voltage(independent.id + ":a", f.b.id + ":a"), null);
f.b.params.resistance = 0; out = S.solve(f.d); near(out.components[independent.id].voltage, 9, "independent solve survives bad island");
const meters = P.create("meters"); out = S.solve(meters); near(out.components.c3.reading, 3, "four port watts"); const w = meters.components.find((c) => c.type === "wattmeter"); const aWire = meters.wires.find((wire) => wire.from === w.id + ":c"); const bWire = meters.wires.find((wire) => wire.from === w.id + ":d"); [aWire.from, bWire.from] = [bWire.from, aWire.from]; out = S.solve(meters); near(out.components.c3.reading, -3, "reversed W potential coil");
const reversedCurrentCoil = P.create("meters");
reversedCurrentCoil.wires.forEach(wire => { for (const key of ["from", "to"]) if (["c3:a", "c3:b"].includes(wire[key])) wire[key] = wire[key] === "c3:a" ? "c3:b" : "c3:a"; });
near(S.solve(reversedCurrentCoil).components.c3.reading, -3, "reversed W current coil");
const loadedW = P.create("meters"); Object.assign(loadedW.components[2].params, {resistance: 1, inputResistance: 12}); out = S.solve(loadedW);
near(out.components.c3.current, 6 / 7, "finite W series and parallel loading"); near(out.components.c3.sensedVoltage, 36 / 7, "loaded W sensed voltage");
near(out.components.c3.reading, 216 / 49, "W reading includes sensed circuit current"); near(out.components.c3.power, 144 / 49, "W own power is both coils, not its reading");
near(Object.values(out.components).reduce((s, r) => s + r.power, 0), 0, "finite W energy balance");
const sources = M.empty(); M.add(sources, "battery", 0, 0, {voltage: 6, resistance: 2}); M.add(sources, "battery", 0, 200, {voltage: 3, resistance: 1}); M.add(sources, "resistor", 300, 0);
for (const id of ["c2", "c3"]) for (const port of ["a", "b"]) M.connect(sources, "c1:" + port, id + ":" + port);
out = S.solve(sources); near(out.components.c3.voltage, 72 / 19, "multiple finite sources"); assert(out.components.c2.delivered < 0, "weaker source absorbs terminal power");
near(Object.values(out.components).reduce((s, r) => s + r.power, 0), 0, "supplying and absorbing source power balance");
// Gauge changes cannot change measurable voltage/current or energy.
const parallel = P.create("parallel"), original = S.solve(parallel); parallel.display.reference = "c1:a"; const gauged = S.solve(parallel); near(gauged.potentials["c1:a"], 0, "selected reference"); for (const id of Object.keys(original.components)) { near(gauged.components[id].current, original.components[id].current, "gauge current"); near(gauged.components[id].voltage, original.components[id].voltage, "gauge voltage"); }
// Consistent ideal-source loops have ambiguous source currents but identifiable load voltage/current.
f = simple(); const other = M.add(f.d, "battery", 0, 200); M.connect(f.d, other.id + ":a", f.b.id + ":a"); M.connect(f.d, other.id + ":b", f.b.id + ":b"); out = S.solve(f.d); assert(out.diagnostics.some((d) => d.code === "indeterminate")); assert.equal(out.components[f.b.id].current, null); near(out.components[f.r.id].current, .5, "identifiable load in ideal-source loop"); near(out.wires.w1.current, .5, "identifiable wire cut despite source ambiguity");
other.params.voltage = 8; out = S.solve(f.d); assert(out.diagnostics.some((d) => d.code === "inconsistent"));
// Wire cycles don't invent a current direction.
f = simple(); f.d.junctions.push({ id: "j1", x: 80, y: 0 }, { id: "j2", x: 100, y: 80 }); M.connect(f.d, "c1:a", "j1:p"); M.connect(f.d, "j1:p", "j2:p"); M.connect(f.d, "j2:p", "c1:a"); out = S.solve(f.d); assert.equal(out.wires.w3.current, null); near(out.wires.w1.current, .5, "wire bridge remains known");
// Unequal bridge checked independently with node-equation analytical solution.
const bridge = P.create("bridge"); bridge.components[3].params.resistance = 30; out = S.solve(bridge); const left = 1 / (1 / 10 + 1 / 30), right = 1 / (1 / 20 + 1 / 20); near(out.components.c6.current, 6 * left / (left + right) / 10 - 6 * right / (left + right) / 20, "unbalanced bridge");
// Finite voltmeter changes loading; ideal meter does not.
f = simple(); const v = M.add(f.d, "voltmeter", 0, 300, { resistance: 12 }); M.connect(f.d, v.id + ":a", f.r.id + ":a"); M.connect(f.d, v.id + ":b", f.r.id + ":b"); out = S.solve(f.d); near(out.components[f.b.id].current, -1, "finite V loading"); v.params.resistance = 0; near(S.solve(f.d).components[f.b.id].current, -.5, "ideal V loading");
f.b.params.polarity = -1; v.params.range = 3; out = S.solve(f.d); near(out.components[v.id].reading, -6, "reverse voltmeter reading"); assert(V.statusText(out.components[v.id]).includes("超量程"));
const signedA = P.create("meters"); signedA.components[0].params.polarity = -1; signedA.components[1].params.range = .1; out = S.solve(signedA); near(out.components.c2.reading, -.5, "reverse ammeter reading"); assert(V.statusText(out.components.c2).includes("超量程"));
// Round trip every independent display enum and each actual document variant.
for (const view of ["real", "schematic"]) for (const flow of ["off", "current", "electron"]) for (const meters of ["digital", "analog"]) { const d = P.create("series"); Object.assign(d.display, { view, flow, meters, potential: true }); d.components[0].locked = true; const restored = D.decode(D.encode(d)); restored.components[1].params.closed = false; M.validate(restored); S.solve(restored); }
const malformed = (fn) => { const d = P.create("series"); fn(d); assert.throws(() => D.decode(JSON.stringify(d))); };
malformed(d => { d.components[0].type = ["battery"]; }); malformed(d => { d.components[0].type = {}; });
malformed((d) => { d.version = 5; }); malformed(d=>{d.wires[0].shape="spline";}); malformed(d=>{delete d.wires[0].shape;}); malformed(d=>{d.wires[0].via=Array.from({length:97},()=>({x:1,y:1}));d.wires[0].shape="free";}); malformed((d) => { d.display.flow = "charge"; }); malformed((d) => { d.components[0].x = null; }); malformed((d) => { d.components[0].params.resistance = -1; }); malformed((d) => { d.wires[0].to = "missing:a"; }); malformed(d => { d.cables.count = 1; }); malformed((d) => { d.components[1].id = d.components[0].id; }); malformed((d) => { d.policy.allowRotate = "yes"; }); malformed((d) => { d.display.reference = "unknown:a"; }); malformed((d) => { d.unknown = 1; }); malformed((d) => { delete d.components[0].params.voltage; }); assert.throws(() => D.decode("x".repeat(M.limits.bytes + 1))); assert.throws(() => D.decode("{"));
const hist = M.history(P.create("series")), before = D.encode(hist.get()); assert.throws(() => hist.change((d) => { d.wires[0].to = "missing:a"; })); assert.equal(D.encode(hist.get()), before, "invalid edits atomic"); hist.change((d) => M.remove(d, "c1")); assert.equal(hist.get().wires.length, 4, "deleting a component unplugs physical cables"); hist.undo(); assert.equal(D.encode(hist.get()), before); hist.redo(); assert.equal(hist.get().components.length, 3);
const locked = P.create("wiring"); assert.equal(M.permission(locked, locked.components[0], "move"), false); assert.throws(() => M.add(locked, "resistor", 0, 0)); assert.throws(() => M.remove(locked, "c1")); locked.policy.allowRotate = true; assert.equal(M.permission(locked, locked.components[0], "rotate"), true); locked.components[0].editable = true; assert.equal(M.permission(locked, locked.components[0], "params"), true);
const series = P.create("series"), wire = series.wires[0], route = G.route(series, wire), p = G.nearest(route, { x: 180, y: 220 }); const junction = M.splitWire(series, wire.id, p, route); M.validate(series); const result = S.solve(series); near(result.components.c1.current, -.25, "split preserves topology"); assert(M.endpoints(series).has(junction));
series.components[1].x += 40; series.components[1].angle = 90; near(S.solve(series).components.c1.current, -.25, "geometry doesn't change topology"); for (const wire of series.wires) { const route = G.route(series, {...wire,shape:"auto",via:[]}); route.slice(1).forEach((p, i) => assert(p.x === route[i].x || p.y === route[i].y, "orthogonal")); }
series.components[0].label = '<script>bad & "</script>'; const html = V.scene(series, S.solve(series)); assert(!html.includes("<script>")); assert(html.includes("&lt;script&gt;")); assert.equal(XMLValidator.validate(`<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`), true, "exported SVG is valid XML");
assert.equal(D.template(series).policy.mode, "wiring"); assert.equal(D.template(series).wires.length, 0);
console.log("Circuit core: analytical networks, thermal calibration, signed meters, ambiguous/floating/short cases, energy, round trips, atomic validation, routing and history passed.");
// Restorable unsolved work stays editable, and repair is a legal continuation.
let broken = simple(); M.connect(broken.d, broken.b.id + ':a', broken.b.id + ':b'); const savedBroken = D.decode(D.encode(broken.d)); assert(S.solve(savedBroken).diagnostics.length); savedBroken.components[0].params.resistance = 1; assert.equal(S.solve(savedBroken).diagnostics.length, 0);
let seed = 87; const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let n = 0; n < 50; n++) {
  const d = M.empty();d.cables.count=20;const source = M.add(d, 'battery', 0, 0, { voltage: .1 + rand() * 119, resistance: rand() * 10 });
  d.junctions.push({id:'j1',x:200,y:0},{id:'j2',x:400,y:0},{id:'j3',x:400,y:200});
  const connections = [['c1:a','j1:p'],['c1:a','j2:p'],['j1:p','j2:p'],['j1:p','j3:p'],['j2:p','j3:p'],['j3:p','c1:b']];
  const kcl = Object.fromEntries(['j1:p','j2:p','j3:p'].map(k=>[k,0]));
  for (const [a,b] of connections) { const c = M.add(d, n>=35 && rand()>.5 ? 'lamp' : 'resistor', 200, 200, n>=35 ? undefined : { resistance: .1 + rand()*100 }); if(c.type==='lamp')c.params.model='thermal'; M.connect(d,c.id+':a',a); M.connect(d,c.id+':b',b); }
  const result = S.solve(d); assert.equal(result.diagnostics.length, 0, 'random arbitrary network'); const load = d.components.slice(1);
  load.forEach((c,i)=>{const [a,b]=connections[i];if(a in kcl)kcl[a]+=result.components[c.id].current;if(b in kcl)kcl[b]-=result.components[c.id].current;}); Object.values(kcl).forEach(v=>near(v,0,'independent junction KCL',1e-6));
  near(Object.values(result.components).reduce((s,r)=>s+r.power,0),0,'network power conservation',1e-6); assert(result.residual<1e-8);
}
for (const name of Object.keys(P.names)) for (const view of ['real','schematic']) for(const meters of ['digital','analog']) { const d=P.create(name); Object.assign(d.display,{view,meters,potential:true}); const r=S.solve(d),routes=Object.fromEntries(d.wires.map(w=>[w.id,G.route(d,w)])); assert.equal(XMLValidator.validate(`<svg xmlns="http://www.w3.org/2000/svg">${V.scene(d,r,.65,routes)}${V.flow(d,r,routes,1,.65)}</svg>`),true,'all diagram exports valid'); }
const backwards = simple(); backwards.b.params.polarity=-1; const reversed=S.solve(backwards.d); near(reversed.components.c2.current,-.5,'reversed source'); near(reversed.components.c1.delivered,3,'reversed source delivery'); assert.equal(R.ports(backwards.b)[0].label,'−');
near(reversed.potentials['c1:a'],0,'automatic reference follows reversed negative terminal'); near(reversed.potentials['c1:b'],6,'reversed positive terminal potential');
console.log('Circuit extended verification: 50 arbitrary networks, nonlinear KCL/energy, repair continuation and all SVG variants passed.');
// A new nonlinear, four-port device is defined entirely through registry hooks.
R.register('two-loads',{name:'雙負載模型',icon:'T',ports:[{key:'p',x:-60,y:0,label:'p'},{key:'q',x:60,y:0,label:'q'},{key:'r',x:-60,y:60,label:'r'},{key:'s',x:60,y:60,label:'s'}],params:{resistance:{value:12,min:.1,max:100}},dc:c=>[{from:'p',to:'q',kind:'nonlinear',law:(v,p)=>({current:v/p.resistance+.001*v**3,conductance:1/p.resistance+.003*v**2})},{from:'r',to:'s',kind:'resistor',resistance:c.params.resistance}]});
const extension=M.empty();M.add(extension,'battery',0,0);const newDevice=M.add(extension,'two-loads',300,0);for(const [a,b] of [['p','a'],['q','b'],['r','a'],['s','b']])M.connect(extension,newDevice.id+':'+a,'c1:'+b);const extended=S.solve(D.decode(D.encode(extension)));assert.equal(extended.diagnostics.length,0);near(extended.components[newDevice.id].current,.5+.001*6**3,'nonlinear extension hook');near(extended.components.c1.current,-1-.001*6**3,'multi-port extension KCL');
near(extended.components[newDevice.id].power, 6 * (1 + .001 * 6 ** 3), 'multi-port total power'); near(extended.components.c1.power + extended.components[newDevice.id].power, 0, 'multi-port energy');
console.log('Circuit registry: a new nonlinear multi-port device solves without changing solver or document code.');
// A valid local constitutive law with no finite DC equilibrium exercises the bounded failure path.
R.register('no-equilibrium',{name:'收斂診斷測試',icon:'T',ports:R.get('resistor').ports,params:{},dc:()=>[{from:'a',to:'b',kind:'nonlinear',law:v=>({current:Math.exp(v)+1,conductance:Math.exp(v)})}]});
const nonconvergent=simple().d;const failing=M.add(nonconvergent,'no-equilibrium',600,400);const failure=S.solve(D.decode(D.encode(nonconvergent)));assert(failure.diagnostics.some(d=>d.code==='convergence'),'bounded nonlinear failure is diagnosed');assert.equal(failure.components[failing.id].current,null);assert.equal(failure.components[failing.id].power,null);near(failure.components.c2.current,.5,'independent circuit survives nonlinear failure');
const repaired=M.history(nonconvergent);repaired.change(d=>M.remove(d,failing.id));assert.equal(S.solve(repaired.get()).diagnostics.length,0,'failed nonlinear work remains repairable');
console.log('Circuit nonlinear failure: iteration limit, unknown results, independent circuit and repair continuation passed.');
// A drawn curve changes geometry only; crossing other ports cannot create topology.
const drawn=simple(), initialAnalysis=S.solve(drawn.d);
const stroke=[{x:-60,y:0},{x:-110,y:-50},{x:-40,y:-120},{x:70,y:-105},{x:105,y:-50},{x:140,y:0}];
for(const shape of ['free','smooth']) {
  const d=M.clone(drawn.d), wire=d.wires[0];Object.assign(wire,G.finishStroke(stroke,shape));
  const restored=D.decode(D.encode(d));assert.deepEqual(restored,d);assert.equal(restored.version,4);
  const path=G.route(restored,restored.wires[0]);assert.deepEqual(path[0],stroke[0]);assert.deepEqual(path.at(-1),stroke.at(-1));assert(Math.min(...path.map(p=>p.y)) < -100,'intentional bend is retained');
  near(S.solve(restored).components.c2.current,initialAnalysis.components.c2.current,'shape cannot change current');
  const beforeRoute=path, cut=G.nearest(path,path[Math.floor(path.length*.6)]), join=M.splitWire(restored,wire.id,cut,path);M.validate(restored);
  near(S.solve(restored).components.c2.current,.5,'curved branch preserves current');
  const parts=restored.wires.filter(w=>w.from===join || w.to===join).flatMap(w=>G.route(restored,w));
  for(const p of beforeRoute) assert(G.nearest(parts,p).distance < 2,'cut retains the visible curve');
  const loaded=D.decode(D.encode(restored));M.add(loaded,'resistor',400,300);M.validate(loaded);S.solve(loaded);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg">${V.scene(d,S.solve(d),1,{w1:path,w2:G.route(d,d.wires[1])})}${V.flow(d,S.solve(d),{w1:path,w2:G.route(d,d.wires[1])},1,1)}</svg>`;
  assert.equal(XMLValidator.validate(svg),true,'curved wires and their flow export valid SVG');
}
const straight=Array.from({length:31},(_,i)=>({x:i*10,y:Math.sin(i)*1.2}));assert.equal(G.finishStroke(straight,'smooth').via.length,0,'small tremor straightens');assert(G.finishStroke(straight,'free').via.length>0,'raw option retains tremor');
const loop=Array.from({length:61},(_,i)=>({x:80*Math.cos(i*Math.PI*2/60),y:80*Math.sin(i*Math.PI*2/60)}));loop.push({x:110,y:0});assert(G.finishStroke(loop,'smooth').via.length>8,'a loop must not be classified as straight');
const rough=Array.from({length:3000},(_,i)=>({x:i/10,y:Math.sin(i/6)*15}));for(const shape of ['free','smooth','auto']){const result=G.finishStroke(rough,shape);assert(result.via.length <= (shape==='auto'?M.limits.bends:M.limits.stroke));}
const curved=G.smooth(stroke), controls=G.resample(curved,25), edited=G.reshape(controls,controls[Math.floor(controls.length/2)],30,40);assert.deepEqual(edited[0],stroke[0]);assert.deepEqual(edited.at(-1),stroke.at(-1));assert(G.nearest(edited,controls[Math.floor(controls.length/2)]).distance > 10,'drag moves the wire without moving its endpoints');
const legacy=P.create('parallel');legacy.version=1;delete legacy.cables;legacy.wires.forEach(w=>{delete w.shape;delete w.length;});const legacyRoutes=legacy.wires.map(w=>G.route(legacy,w));const migrated=D.decode(JSON.stringify(legacy));assert.equal(migrated.version,4);assert(migrated.wires.every(w=>w.shape==='auto'));assert.deepEqual(migrated.wires.map(w=>G.route(migrated,w)),legacyRoutes,'v1 routes do not change on migration');const next=M.add(migrated,'resistor',900,600);M.connect(migrated,next.id+':a','c1:a',[], 'smooth');D.decode(D.encode(migrated));
console.log('Circuit drawing: curve/loop preservation, straightening option, bounded strokes, anchored reshaping, curved cuts, v1 migration and v4 continuation passed.');
// Physical cable states use the same authoritative topology and solver.
const cables=M.empty();cables.cables={count:4,length:240};M.add(cables,'battery',100,150);M.add(cables,'resistor',330,150);
const first=M.addWire(cables,170,220),initialCable=G.route(cables,first);
M.moveWireEnd(cables,first.id,'from',{x:initialCable[0].x+30,y:initialCable[0].y+30});const picked=G.route(cables,first);assert.deepEqual(picked.at(-1),initialCable.at(-1),'endpoint pickup fixes the other loose end');assert.equal(first.via.length,0,'loose endpoint pickup stays straight');assert(G.length(picked)<=first.length,'endpoint pickup keeps finite reach');
assert.equal(S.solve(cables).wires[first.id].current,0,'unconnected cable current');assert(M.attach(cables,first.id,'from','c1:a'));
const fixed=first.from,anchor=M.endpoints(cables).get(fixed);M.moveWireEnd(cables,first.id,'to',{x:250,y:200});assert.equal(first.from,fixed);assert.deepEqual(M.endpoints(cables).get(fixed),anchor,'one attached end stays anchored');
const limited=M.moveWireEnd(cables,first.id,'to',{x:2000,y:200});assert(limited.limited);assert(G.length(G.route(cables,first))<=240+.05,'maximum is arc length');
assert.equal(M.attach(cables,first.id,'to','c2:b'),false,'out-of-reach snap cannot create topology');assert.equal(first.from,fixed);
M.moveWireEnd(cables,first.id,'to',{x:225,y:150});const shared=first.to,second=M.addWire(cables,300,260);assert(M.attach(cables,second.id,'from',shared));assert(M.attach(cables,second.id,'to','c2:a'));
assert.equal(cables.wires.length,2,'joining ends does not split or invent cables');assert.equal(M.degree(cables,shared),2);assert(M.attached(cables,first,'to'));assert.equal(S.solve(cables).components.c2.current,0,'open circuit with end-to-end cable chain');
const third=M.addWire(cables,300,320);assert(M.attach(cables,third.id,'from','c2:b'));assert(M.attach(cables,third.id,'to','c1:b'));near(S.solve(cables).components.c2.current,.5,'complete circuit through cable-end junction');
const wireResults=S.solve(cables).wires;near(Math.abs(wireResults[first.id].current),.5,'first chain current');near(Math.abs(wireResults[second.id].current),.5,'second chain current');
const bendBefore=G.route(cables,first),refs=[first.from,first.to];M.bendWire(cables,first.id,G.along(bendBefore,G.length(bendBefore)/2),0,-800);assert.deepEqual([first.from,first.to],refs);assert(G.length(G.route(cables,first))<=first.length+.05);near(S.solve(cables).components.c2.current,.5,'bending preserves current');
for(const state of [cables,(()=>{const d=M.clone(cables);M.detach(d,second.id,'from');return d;})(),(()=>{const d=M.clone(cables);M.detach(d,second.id,'from');M.detach(d,second.id,'to');return d;})()]){
 const restored=D.decode(D.encode(state));assert.deepEqual(restored,state);M.moveWireEnd(restored,second.id,'from',{x:230,y:240});M.validate(restored);S.solve(restored);
}
const chainHistory=M.history(cables),complete=D.encode(chainHistory.get());chainHistory.change(d=>M.detach(d,second.id,'from'));assert.equal(S.solve(chainHistory.get()).components.c2.current,0);assert.equal(chainHistory.get().wires[0].to,shared,'other cable keeps junction when one is unplugged');chainHistory.undo();assert.equal(D.encode(chainHistory.get()),complete);chainHistory.redo();assert.equal(S.solve(chainHistory.get()).components.c2.current,0);
const stock=M.empty();stock.cables.count=2;M.addWire(stock,0,0);M.addWire(stock,220,0);assert.throws(()=>M.addWire(stock,400,0));const stockHistory=M.history(stock);stockHistory.change(d=>M.remove(d,'w1'));assert.equal(stockHistory.get().wires.length,1);stockHistory.undo();assert.equal(stockHistory.get().wires.length,2);stockHistory.redo();stockHistory.change(d=>M.addWire(d,0,0));assert.equal(stockHistory.get().wires.length,2);
const reject=M.history(cables),rejectBefore=D.encode(reject.get());assert.throws(()=>reject.change(d=>d.wires[0].via=[{x:4000,y:4000}]));assert.equal(D.encode(reject.get()),rejectBefore);assert.throws(()=>reject.change(d=>d.cables.count=1));assert.throws(()=>reject.change(d=>delete d.wires[0].length));assert.equal(D.encode(reject.get()),rejectBefore);
const loopCable=M.clone(cables),spare=M.addWire(loopCable,200,300);assert(M.attach(loopCable,spare.id,'from','c1:b'));assert(M.attach(loopCable,spare.id,'to','c1:b'));assert.equal(S.solve(loopCable).wires[spare.id].current,null,'an ideal cable loop has no invented current');
const deleted=M.clone(cables);M.remove(deleted,'c2');assert.equal(deleted.wires.length,3,'component deletion preserves physical cables');M.validate(deleted);assert.equal(S.solve(deleted).components.c1.current,0);
const moved=M.clone(cables),moveBase=M.clone(moved);moved.components[0].x-=2000;assert.equal(M.reconcile(moved,moveBase),false,'connected component cannot exceed finite reach');
for(const version of [1,2]){const legacy=P.create('parallel');legacy.version=version;delete legacy.cables;legacy.wires.forEach(w=>{delete w.length;if(version===1)delete w.shape;});const originalRoutes=legacy.wires.map(w=>G.route(legacy,w));const restored=D.decode(JSON.stringify(legacy));assert.equal(restored.version,4);assert.deepEqual(restored.wires.map(w=>G.route(restored,w)),originalRoutes);assert(restored.wires.every(w=>Number.isFinite(w.length)));M.addWire(restored,700,600);D.decode(D.encode(restored));}
console.log('Physical cables: finite stock/arc length, zero/one/two attachments, whole pickup, common ends, unplugging, loop ambiguity, file migration and atomic history passed.');
const referenced=M.empty();M.add(referenced,'battery',100,100);const refWire=M.addWire(referenced,240,180);referenced.display.reference=refWire.from;const oldRef=refWire.from;assert(M.attach(referenced,refWire.id,'from','c1:a'));assert.equal(referenced.display.reference,'c1:a','a free-end reference follows a snapped connection');assert(!M.endpoints(referenced).has(oldRef),'no hidden orphan reference after snap');near(S.solve(referenced).potentials['c1:a'],0,'snapped reference remains zero volts');referenced.display.reference=refWire.to;M.remove(referenced,refWire.id);assert.equal(referenced.display.reference,null,'deleting referenced loose cable clears its removed endpoint');assert.equal(referenced.junctions.length,0);M.validate(referenced);
const joinRef=M.empty(),refA=M.addWire(joinRef,100,100),refB=M.addWire(joinRef,340,100),commonRef=refA.to;joinRef.display.reference=refB.from;assert(M.attach(joinRef,refB.id,'from',commonRef));assert.equal(joinRef.display.reference,commonRef);M.detach(joinRef,refB.id,'from');assert.equal(joinRef.display.reference,commonRef,'unplugging leaves a shared node reference on the remaining cable');D.decode(D.encode(joinRef));
console.log('Physical cable reference nodes: snap/merge follows zero volts, unplug preserves the remaining node and deletion leaves no ghost endpoint.');
// Fairing must solve the visible sharp-corner problem, not merely round stroke joins.
function turns(points) { return points.slice(1,-1).map((b,i)=>{const a=points[i],c=points[i+2],u=Math.atan2(b.y-a.y,b.x-a.x),v=Math.atan2(c.y-b.y,c.x-b.x);return Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)))*180/Math.PI;}); }
for(const at of [.04,.15,.5,.85,.96])for(const pull of [30,100,300,-100]){
 const d=M.empty();M.add(d,'lamp',200,220);const w=M.connect(d,'c1:a','c1:b',[],'free');w.length=240;
 const route=G.route(d,w),refs=[w.from,w.to],result=M.bendWire(d,w.id,G.along(route,120*at),0,pull),next=G.route(d,w);
 assert.deepEqual([w.from,w.to],refs);assert.deepEqual(next[0],route[0]);assert.deepEqual(next.at(-1),route.at(-1));assert(Math.max(...turns(next))<15,'center and endpoint transitions cannot have visible angular kinks');assert(G.length(next)<=240+.05);assert(Math.max(...next.map(p=>Math.abs(p.y-220)))>15,'fairing responds to the pull');
 if(result.limited)assert(G.length(next)>239.9,'only the actual arc budget limits a pull');else assert(G.nearest(next,{x:140+120*at,y:220+pull}).distance<4,'a reachable pull follows the grip');
 D.decode(D.encode(d));
}
const pulledLoop=M.empty();M.add(pulledLoop,'lamp',200,220);const curled=M.connect(pulledLoop,'c1:a','c1:b',[{x:105,y:270},{x:140,y:350},{x:260,y:350},{x:295,y:270}],'smooth');curled.length=600;let loopRoute=G.route(pulledLoop,curled);M.bendWire(pulledLoop,curled.id,G.along(loopRoute,G.length(loopRoute)/2),30,50);assert(Math.max(...turns(G.route(pulledLoop,curled)))<20,'curled cable remains smooth');M.validate(pulledLoop);
for(const loop of [false,true])for(const at of [.04,.15,.5,.85,.96])for(const dx of [-300,-100,-10,0,10,100,300])for(const dy of [-100,-10,-1,0,1,10,100]){
 const d=M.empty();M.add(d,'lamp',200,220);const w=M.connect(d,'c1:a','c1:b',loop?[{x:105,y:270},{x:140,y:350},{x:260,y:350},{x:295,y:270}]:[],loop?'smooth':'free');w.length=loop?600:240;
 const before=G.route(d,w),ids=[w.from,w.to],grip=G.along(before,G.length(before)*at),result=M.bendWire(d,w.id,grip,dx,dy);const after=G.route(d,w);
 assert.deepEqual([w.from,w.to],ids);assert.deepEqual(after[0],before[0]);assert.deepEqual(after.at(-1),before.at(-1));assert(Math.max(...turns(after))<18.01,'tangential and oblique pulls cannot fold into cusps');assert(G.length(after)<=w.length+.05);assert(w.via.length<=96);D.decode(D.encode(d));
 if(!loop&&dy===0)assert(Math.max(...after.map(p=>Math.abs(p.y-220)))<2,'an axial pickup rounds any return bend locally without inventing a sideways pull');
 if(!result.limited)assert(G.nearest(after,{x:grip.x+dx,y:grip.y+dy}).distance<4,'reachable tangential and oblique grips follow the pointer');
 if(!loop&&Math.abs(dx)===100&&Math.abs(dy)===10)assert(Math.max(...after.map(p=>Math.abs(p.y-220)))>(result.limited?1:9),'finite reach retains the sideways direction');
}
console.log('Cable fairing: 20 perpendicular and 490 tangential/oblique pulls, smooth curled wire, fixed endpoints, finite arc budget and file round trips passed.');
// Regression: legality of sampled angles is not monotonic in displacement.
// Test every frame from the same drag-start snapshot, as the UI does. Checking
// only a finished pull missed >100-unit jumps between one-unit pointer moves.
const insideCable=P.create('series'),insideWire=insideCable.wires[2];
insideWire.shape='free';insideWire.via=G.resample(G.fair([
 {x:590,y:180},{x:595,y:187},{x:550,y:235},{x:520,y:272},
 {x:550,y:275},{x:610,y:252},{x:635,y:249},{x:650,y:260}
]),4).slice(1,-1);
M.validate(insideCable);
const directions=[...Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)})),{x:-1,y:.7}];
const steps=[...Array.from({length:181},(_,i)=>i),...Array.from({length:180},(_,i)=>179-i)];
let frames=0,maxJump=0,maxLag=0,maxTurn=0;
function frameChange(a,b){return Math.max(...Array.from({length:65},(_,i)=>{const u=G.along(a,G.length(a)*i/64),v=G.along(b,G.length(b)*i/64);return Math.hypot(v.x-u.x,v.y-u.y);}));}
for(const base of [P.create('series'),insideCable])for(const direction of directions){
 const w=base.wires[2],initial=G.route(base,w),grip=G.along(initial,G.length(initial)/2),electrical=S.solve(base).components;
 let previous=initial,oldStep=0;
 for(const step of steps){const d=M.clone(base),dx=step*direction.x,dy=step*direction.y,result=M.bendWire(d,w.id,grip,dx,dy,100),next=G.route(d,d.wires[2]);
   const jump=frameChange(previous,next),lag=G.nearest(next,{x:grip.x+dx,y:grip.y+dy}).distance,turn=Math.max(0,...turns(next));
   assert(jump<4*Math.max(1,Math.abs(step-oldStep)*Math.hypot(direction.x,direction.y)),`continuous cable frame: ${jump} at ${step} in ${JSON.stringify(direction)}`);
   assert.deepEqual(next[0],initial[0]);assert.deepEqual(next.at(-1),initial.at(-1));assert.deepEqual([d.wires[2].from,d.wires[2].to],[w.from,w.to]);assert(G.length(next)<=w.length+.05);
   if(step){assert(turn<18.01,'inward and outward cable trajectories remain smooth');if(!result.limited)assert(lag<6,`reachable grip cannot stick in one direction: ${lag}`);}
   if(step&&step%60===0){assert.deepEqual(S.solve(d).components,electrical);assert.deepEqual(D.decode(D.encode(d)),d);}
   frames++;maxJump=Math.max(maxJump,jump);if(!result.limited)maxLag=Math.max(maxLag,lag);if(step)maxTurn=Math.max(maxTurn,turn);previous=next;oldStep=step;
 }
 assert.deepEqual(previous,initial,'returning the pointer to its origin restores the starting line');
}
// Cross the true length boundary in small steps, then reverse. The boundary
// must act as a continuous stop, never as an angle-dependent rebound.
const taut=[{x:140,y:220},{x:260,y:220}],tautGrip={x:200,y:220};let previous=taut,limitedFrames=0;
for(const step of [...Array.from({length:401},(_,i)=>i),...Array.from({length:400},(_,i)=>399-i)]){
 const result=G.bend(taut,tautGrip,-.6*step,step,240),next=result.points;
 assert(frameChange(previous,next)<5);assert(G.length(next)<=240+.05);assert(Math.max(0,...turns(next))<18.01);
 if(result.limited){limitedFrames++;assert(G.length(next)>239.9);}previous=next;frames++;
}
assert(limitedFrames>0);assert.deepEqual(previous,taut);
console.log(`Cable trajectories: ${frames} inward/outward/reverse frames, original + inward U, all eight directions, actual reach boundary; max frame ${maxJump.toFixed(2)}, grip lag ${maxLag.toFixed(2)}, turn ${maxTurn.toFixed(2)} degrees passed.`);
function dualFixture(type,port='a',internal=0){const d=M.empty(),b=M.add(d,'battery',100,100,{voltage:type==='ammeter'?3:1.5}),load=M.add(d,'resistor',400,100,{resistance:10}),meter=M.add(d,type,260,300,{resistance:internal});
 if(type==='ammeter'){M.connect(d,b.id+':a',meter.id+':'+port,[],'free');M.connect(d,meter.id+':b',load.id+':a',[],'free');}else{M.connect(d,b.id+':a',load.id+':a',[],'free');M.connect(d,meter.id+':'+port,load.id+':a',[],'free');M.connect(d,meter.id+':b',load.id+':b',[],'free');}M.connect(d,load.id+':b',b.id+':b',[],'free');return {d,b,load,meter};}
for(const type of ['ammeter','voltmeter'])for(const port of ['a','c']){
 const f=dualFixture(type,port),r=S.solve(f.d).components[f.meter.id],ranges=type==='ammeter'?[3,.6]:[15,3],expected=type==='ammeter'?.3:1.5;
 near(r.reading,expected,'actual dual-range reading');near(r.range,port==='a'?ranges[0]:ranges[1],'socket selects full-scale');near(r.division,type==='ammeter'?(port==='a'?.1:.02):(port==='a'?.5:.1),'each minor division');assert.equal(r.activePort,port);assert.equal(r.meterStatus,'normal');assert.equal(R.ports(f.meter).length,3);
 const svg=V.body(f.meter,r,{...f.d.display,meters:'analog'});assert.equal((svg.match(/data-meter-tick=/g)||[]).length,41);near(Number(svg.match(/data-meter-needle=[\s\S]*?data-angle="([^"]+)"/)[1]),port==='c'?-75:-111,'half-small-scale and one-tenth-large-scale needles');assert.equal(XMLValidator.validate('<svg>'+svg+'</svg>'),true);assert(svg.includes('data-scale="high"')&&svg.includes('data-scale="low"'));
 const saved=D.decode(D.encode(f.d));assert.deepEqual(saved,f.d);const meterWire=saved.wires.find(w=>[w.from,w.to].includes(f.meter.id+':'+port)),key=meterWire.from===f.meter.id+':'+port?'from':'to';assert(M.attach(saved,meterWire.id,key,f.meter.id+':'+(port==='a'?'c':'a')));near(S.solve(saved).components[f.meter.id].reading,expected,'legal range change after restore');
 f.b.params.polarity=-1;const reverse=S.solve(f.d).components[f.meter.id];near(reverse.reading,-expected,'reverse retains signed value');assert.equal(reverse.meterStatus,reverse.reading<reverse.minimum?'overrange':'reverse');assert(V.statusText(reverse).includes('反接'));
 f.b.params.voltage=type==='ammeter'?40:20;const excessive=S.solve(f.d).components[f.meter.id];assert.equal(excessive.meterStatus,'overrange');assert(excessive.reading<0);const overSvg=V.body(f.meter,excessive,{...f.d.display,meters:'analog'});assert(V.statusText(excessive).includes('反接')&&V.statusText(excessive).includes('超量程'));near(Number(overSvg.match(/data-meter-needle=[\s\S]*?data-fraction="([^"]+)"/)[1]),R.meterScale.minimumFraction-R.meterScale.stopMargin,'negative mechanical stop');
 const commonWire=f.d.wires.find(w=>w.from===f.meter.id+':b'||w.to===f.meter.id+':b');M.detach(f.d,commonWire.id,commonWire.from===f.meter.id+':b'?'from':'to');const missing=S.solve(f.d).components[f.meter.id];assert.equal(missing.meterStatus,'missing-common');assert.equal(missing.reading,null);
}
for(const type of ['ammeter','voltmeter']){const f=dualFixture(type,'a',type==='ammeter'?1:1000);M.connect(f.d,f.meter.id+':c',f.b.id+':a',[],'free');const r=S.solve(f.d);assert.equal(r.components[f.meter.id].meterStatus,'dual-positive');assert.equal(r.components[f.meter.id].reading,null);assert(r.diagnostics.some(x=>x.code==='meter-terminals'));near(Object.values(r.components).reduce((n,c)=>n+c.power,0),0,'two positive ports preserve energy');assert(!V.body(f.meter,r.components[f.meter.id],{...f.d.display,meters:'analog'}).includes('data-meter-needle='));}
for(const port of ['a','c']){const f=dualFixture('ammeter',port,1),r=S.solve(f.d);near(r.components[f.meter.id].reading,3/(10+(port==='a'?1:5)),'range-specific A burden');near(Object.values(r.components).reduce((n,c)=>n+c.power,0),0,'A burden power');}
for(const port of ['a','c']){const f=dualFixture('voltmeter',port,30);f.b.params.resistance=2;f.b.params.voltage=6;const r=S.solve(f.d);near(r.components[f.meter.id].reading,port==='a'?6*7.5/9.5:6*3.75/5.75,'range-specific V loading');near(Object.values(r.components).reduce((n,c)=>n+c.power,0),0,'V loading power');}
for(const version of [1,2,3])for(const type of ['ammeter','voltmeter']){const f=dualFixture(type),old=M.clone(f.d);old.version=version;old.components[2].params.range=type==='ammeter'?6:30;old.wires.forEach(w=>{w.via=[];w.shape='free';w.length=600;if(version<3)delete w.length;if(version===1)delete w.shape;});if(version<3)delete old.cables;
 const restored=D.decode(JSON.stringify(old)),r=S.solve(restored);assert.equal(restored.version,4);near(r.components.c3.reading,type==='ammeter'?.3:1.5,'legacy two-port meaning preserved');near(r.components.c3.range,type==='ammeter'?6:30,'legacy custom range preserved');assert.deepEqual(D.decode(D.encode(restored)),restored);const positive=restored.wires.find(w=>[w.from,w.to].includes('c3:a')),end=positive.from==='c3:a'?'from':'to';assert(M.attach(restored,positive.id,end,'c3:c'));near(S.solve(restored).components.c3.range,type==='ammeter'?1.2:6,'migrated work can use third socket');
 const invalid=M.clone(old);invalid.wires[0].to='c3:c';assert.throws(()=>D.decode(JSON.stringify(invalid)),'legacy schema must reject a future third terminal');
}
console.log('Three-terminal A/V meters: both ranges, calibrated divisions/needle, reverse/overrange/ambiguous ports, range burdens/energy and strict v1–v4 migration/continuation passed.');
// A v3 auto route is validated with its original meter footprint, even when
// the cable is taut. Unrelated routes cannot silently reroute during migration.
const tightLegacy=dualFixture('ammeter').d;M.add(tightLegacy,'resistor',540,300);tightLegacy.version=3;
const unrelated={id:'w4',from:'c1:b',to:'c4:a',via:[],shape:'auto',length:600};tightLegacy.wires.push(unrelated);tightLegacy.wires.forEach(w=>{w.shape='auto';w.via=[];w.length=Math.max(60,G.length(G.route(tightLegacy,w)));});
const unaffected=G.route(tightLegacy,unrelated).map(p=>({x:p.x,y:p.y})),tightRestored=D.decode(JSON.stringify(tightLegacy));assert.deepEqual(G.route(tightRestored,tightRestored.wires[3]),unaffected,'new meter footprint cannot reroute an unrelated legacy cable');near(S.solve(tightRestored).components.c3.reading,.3,'taut legacy route preserves circuit');
for(const type of ['ammeter','voltmeter'])for(const angle of [0,90,180,270])for(const view of ['real','schematic']){const f=dualFixture(type,'c'),before=M.clone(f.d);f.meter.angle=angle;f.d.display.view=view;assert(M.reconcile(f.d,before));const restored=D.decode(D.encode(f.d)),r=S.solve(restored);near(r.components.c3.reading,type==='ammeter'?.3:1.5,'rotating a meter does not change polarity/range');const ports=R.ports(f.meter);near(Math.hypot(ports[0].x-ports[2].x,ports[0].y-ports[2].y),64,'rotated socket spacing');assert.equal(XMLValidator.validate('<svg>'+V.scene(restored,r)+'</svg>'),true);}
console.log('Meter geometry: taut legacy auto routes, unrelated cable preservation, four orientations and both views passed.');
