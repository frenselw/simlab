"use strict";
const assert=require("node:assert/strict"),M=require("./circuit-model"),R=require("./component-registry"),G=require("./circuit-routing"),D=require("./circuit-document"),S=require("./circuit-solver");
const {meterMathFixture}=require("../../tools/circuit-meters-math-browser-cases");
let cases=0;
const test=(name,fn)=>{fn();cases++;};
const topology=d=>d.wires.map(w=>[w.id,w.from,w.to,w.length]);
function straight(d,w){assert.equal(w.shape,"free");assert.deepEqual(w.via,[]);const ends=M.endpoints(d),a=ends.get(w.from),b=ends.get(w.to),p=G.route(d,w);assert(Math.abs(G.length(p)-Math.hypot(a.x-b.x,a.y-b.y))<1e-8);assert(G.length(p)<=w.length+.05);}

for(const [type,params,mirrored]of [
  ["battery"],["lamp"],["switch"],["resistor"],["rheostat",{terminals:2}],["rheostat",{terminals:3}],["rheostat",{terminals:4}],
  ["ammeter"],["voltmeter"],["ammeter",{},true],["voltmeter",{},true],["galvanometer"],["wattmeter"]
])test(type+JSON.stringify(params||{})+(mirrored?" mirrored":""),()=>{
  const d=M.empty(),c=M.add(d,type,300,260,params);if(mirrored)c.mirrored=true;
  R.ports(c).forEach((p,i)=>{const j={id:"j"+(i+1),x:p.x+200+i*30,y:p.y+180-i*30};d.junctions.push(j);const w=M.connect(d,p.id,j.id+":p",[{x:p.x+60,y:p.y+120},{x:j.x-30,y:j.y+70}],i%2?"smooth":"free");w.length=1200;});
  const unrelated=M.addWire(d,900,500);unrelated.shape="smooth";unrelated.via=[{x:900,y:560}];
  const untouched=M.clone(unrelated),nodes=M.clone(d.junctions),ids=topology(d),readings=S.solve(M.validate(d)).components;
  for(const angle of [90,180,270,0]){
    M.rotateComponent(d,c.id);assert.equal(d.components[0].angle,angle);assert.deepEqual(topology(d),ids);assert.deepEqual(d.junctions,nodes);assert.deepEqual(d.wires.find(w=>w.id===unrelated.id),untouched);
    d.wires.filter(w=>w.id!==unrelated.id).forEach(w=>straight(d,w));M.validate(d);assert.deepEqual(S.solve(d).components,readings);
  }
});

for(const type of ["ammeter","voltmeter"])test(type+" signed reading and range",()=>{
  const d=meterMathFixture(type,"c",-.1),before=S.solve(d).components.c3,ids=topology(d),unrelated=M.clone(d.wires.filter(w=>![w.from,w.to].some(p=>p.startsWith("c3:"))));
  for(let i=0;i<4;i++){M.rotateComponent(d,"c3");assert.deepEqual(S.solve(M.validate(d)).components.c3,before);assert.deepEqual(topology(d),ids);for(const w of unrelated)assert.deepEqual(d.wires.find(v=>v.id===w.id),w);}
});

test("same component endpoints and shared junction",()=>{
  const d=M.empty(),c=M.add(d,"lamp",300,200),loop=M.connect(d,c.id+":a",c.id+":b",[{x:260,y:310},{x:360,y:310}],"free");
  d.junctions.push({id:"j1",x:460,y:360},{id:"j2",x:620,y:420});
  const branch=M.connect(d,c.id+":b","j1:p",[{x:420,y:300}],"smooth"),other=M.connect(d,"j1:p","j2:p",[{x:560,y:460}],"free"),keep=M.clone(other),nodes=M.clone(d.junctions);
  M.rotateComponent(d,c.id);straight(d,d.wires.find(w=>w.id===loop.id));straight(d,d.wires.find(w=>w.id===branch.id));assert.deepEqual(d.wires.find(w=>w.id===other.id),keep);assert.deepEqual(d.junctions,nodes);M.validate(d);
});

test("one connected end and loose cables",()=>{
  const d=M.empty(),c=M.add(d,"battery",260,200),w=M.addWire(d,440,330);assert(M.attach(d,w.id,"from",c.id+":a"));const p=G.route(d,w);M.bendWire(d,w.id,G.along(p,G.length(p)/2),0,60);
  const free=M.endpoints(d).get(w.to),unrelated=M.addWire(d,800,400),keep=M.clone(unrelated);M.rotateComponent(d,c.id);straight(d,d.wires.find(v=>v.id===w.id));assert.deepEqual(M.endpoints(d).get(w.to),free);assert.deepEqual(d.wires.find(v=>v.id===unrelated.id),keep);M.validate(d);
});

test("a taut drawn curve can be replaced by a feasible direct route",()=>{
  const d=meterMathFixture("ammeter"),w=d.wires[1];w.length=G.length(G.route(d,w));const budget=w.length;M.validate(d);M.rotateComponent(d,"c3");straight(d,d.wires[1]);assert.equal(d.wires[1].length,budget);assert(G.length(G.route(d,d.wires[1]))<budget);M.validate(d);
});

test("too-short cable refuses the entire rotation atomically",()=>{
  const d=M.empty(),c=M.add(d,"battery",0,0);d.junctions.push({id:"j1",x:100,y:160},{id:"j2",x:-220,y:0});
  M.connect(d,c.id+":b","j1:p",[{x:140,y:60}],"smooth");const short=M.connect(d,c.id+":a","j2:p",[{x:-140,y:20}],"free");short.length=180;M.validate(d);
  const before=D.encode(d);assert.throws(()=>M.rotateComponent(d,c.id),/導線太短/);assert.equal(D.encode(d),before);const h=M.history(d);assert.throws(()=>h.change(next=>M.rotateComponent(next,c.id)),/導線太短/);assert.equal(D.encode(h.get()),before);assert.equal(h.canUndo(),false);
});

test("rotation permissions and no-wire rotation",()=>{
  const d=M.empty(),c=M.add(d,"lamp",0,0);c.locked=true;const locked=D.encode(d);assert.throws(()=>M.rotateComponent(d,c.id));assert.equal(D.encode(d),locked);c.locked=false;d.policy.mode="wiring";assert.throws(()=>M.rotateComponent(d,c.id));d.policy.allowRotate=true;M.rotateComponent(d,c.id);assert.equal(d.components[0].angle,90);assert.throws(()=>M.rotateComponent(d,"missing"));
});

test("single undo restores angle and curves; restored files can continue",()=>{
  const d=meterMathFixture("voltmeter"),h=M.history(d),before=D.encode(h.get());h.change(next=>M.rotateComponent(next,"c3"));const after=D.encode(h.get());assert(h.undo());assert.equal(D.encode(h.get()),before);assert.equal(h.canUndo(),false);assert(h.redo());assert.equal(D.encode(h.get()),after);
  const restored=D.decode(after);M.rotateComponent(restored,"c3");assert.equal(restored.components[2].angle,180);const w=restored.wires.find(w=>w.from==="c3:a");const route=G.route(restored,w);M.bendWire(restored,w.id,G.along(route,G.length(route)/2),0,40);assert(w.via.length>0);M.validate(restored);
});
console.log(`Rotation: ${cases} focused cases passed; attached cables straighten, topology/readings/ranges stay fixed, finite rejection is atomic and undo/restore continue.`);
