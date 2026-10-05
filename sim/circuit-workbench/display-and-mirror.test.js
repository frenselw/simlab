'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),R=require('./component-registry'),G=require('./circuit-routing'),S=require('./circuit-solver'),D=require('./circuit-document'),V=require('./circuit-renderer'),P=require('./presets');
const {meterMathFixture}=require('../../tools/circuit-meters-math-browser-cases');
let cases=0;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const rows=(d,id)=>V.labels(d,S.solve(d)).find(p=>p.id===id)?.rows.filter(r=>r.kind==='value').map(r=>r.text).join(' ')||'';
const all=Object.fromEntries(Object.keys(M.quantityDefaults).map(k=>[k,true]));
function labelsFixture(){const d=M.empty();for(const [i,type]of ['battery','resistor','lamp','rheostat'].entries())M.add(d,type,150+i*240,240);return d;}
for(const view of ['real','schematic'])for(const loadResistance of [false,true])for(const loadPower of [false,true]){
  const d=labelsFixture();d.display.view=view;Object.assign(d.display.quantities,{loadResistance,loadPower});const initial=S.solve(d).components;
  for(const id of ['c2','c3']){assert.equal(rows(d,id).includes('Ω'),loadResistance);assert.equal(rows(d,id).includes('W'),loadPower);}
  assert(rows(d,'c1').includes('V'));assert(!rows(d,'c1').includes('Ω'));assert(rows(d,'c4').includes('Ω'));assert.equal(rows(d,'c4').includes('W'),loadPower);
  const restored=D.decode(D.encode(d));assert.deepEqual(restored.display.quantities,d.display.quantities);assert.deepEqual(S.solve(restored).components,initial);assert.deepEqual(D.template(restored).display.quantities,d.display.quantities);
  restored.display.quantities.loadPower=!loadPower;M.validate(restored);assert.equal(rows(restored,'c3').includes('W'),!loadPower);near(S.solve(restored).components.c3.power,initial.c3.power);cases++;
}
{
  const d=labelsFixture();d.display.quantities.sourceResistance=true;d.display.quantities.rheostatResistance=false;assert(rows(d,'c1').includes('Ω'));assert.equal(rows(d,'c4'),'');
  const old=D.encode(d);d.display.values=false;assert.equal(V.labels(d,S.solve(d)).some(p=>p.rows.some(r=>r.kind==='value')),false);d.display.names=false;assert.equal(V.labels(d,S.solve(d)).length,0);
  const h=M.history(D.decode(old));h.change(doc=>doc.display.quantities.sourceResistance=false);h.undo();assert.equal(D.encode(h.get()),old);h.redo();assert.equal(rows(h.get(),'c1').includes('Ω'),false);cases++;
}
for(const version of [1,2,3,4]){
  const d=labelsFixture();d.version=version;delete d.display.quantities;if(version<3)delete d.cables;
  const restored=D.decode(JSON.stringify(d));assert.deepEqual(restored.display.quantities,all);assert(rows(restored,'c3').includes('Ω'));assert(rows(restored,'c3').includes('W'));restored.display.quantities.loadResistance=false;M.validate(restored);assert(!rows(restored,'c3').includes('Ω'));cases++;
}
for(const key of Object.keys(M.quantityDefaults)){
  for(const invalid of [null,1,'false']){const d=M.empty();d.display.quantities[key]=invalid;assert.throws(()=>M.validate(d));}
  const missing=M.empty();delete missing.display.quantities[key];assert.throws(()=>M.validate(missing));cases++;
}
{
  const invalid=M.empty();invalid.display.quantities.extra=true;assert.throws(()=>M.validate(invalid));invalid.display.quantities=null;assert.throws(()=>M.validate(invalid));
  for(const name of ['series','parallel','mixed','ohm','limiting','divider','gAmmeter','gVoltmeter','meters','bridge','wiring','empty'])assert.deepEqual(P.create(name).display.quantities,M.quantityDefaults);
  cases++;
}
for(const type of ['ammeter','voltmeter'])for(const port of ['a','c'])for(const angle of [0,90,180,270]){
  const d=meterMathFixture(type,port,.1);d.wires.forEach(w=>w.length=1200);const beforeRotation=M.clone(d),c=d.components[2];c.angle=angle;assert(M.reconcile(d,beforeRotation));M.validate(d);
  const before=M.clone(d),oldPorts=R.ports(c),expected=(port==='a'?c.params.range:c.params.range/5)*.1;near(S.solve(d).components.c3.reading,expected);M.flipMeter(d,c.id);M.validate(d);
  assert.equal(d.components[2].mirrored,true);assert.deepEqual(d.wires.map(w=>[w.id,w.from,w.to,w.length]),before.wires.map(w=>[w.id,w.from,w.to,w.length]));near(S.solve(d).components.c3.reading,expected);assert.equal(S.solve(d).components.c3.activePort,port);
  const next=R.ports(d.components[2]),a=angle*Math.PI/180;
  for(const p of next){const old=oldPorts.find(q=>q.id===p.id),x=R.get(type).ports.find(q=>q.key===p.key).x;near(p.x,old.x-2*x*Math.cos(a));near(p.y,old.y-2*x*Math.sin(a));assert.equal(p.label,old.label);}
  for(const w of d.wires){const path=G.route(d,w),ends=M.endpoints(d);assert.deepEqual(path[0],{x:ends.get(w.from).x,y:ends.get(w.from).y});assert.deepEqual(path.at(-1),{x:ends.get(w.to).x,y:ends.get(w.to).y});assert(G.length(path)<=w.length+.05);}
  const body=V.body(d.components[2],S.solve(d).components.c3,d.display);assert(body.includes('data-socket="b" cx="48"'));assert(body.includes('data-socket="a" cx="-48"'));assert(!body.includes('scale(-1'));
  assert.equal(V.dualDial(d.components[2],S.solve(d).components.c3),V.dualDial({...d.components[2],mirrored:false},S.solve(d).components.c3));
  const restored=D.decode(D.encode(d));assert.equal(restored.components[2].mirrored,true);assert.equal(D.template(restored).components[2].mirrored,true);M.flipMeter(restored,'c3');assert.equal(restored.components[2].mirrored,false);near(S.solve(M.validate(restored)).components.c3.reading,expected);cases++;
}
for(const type of ['ammeter','voltmeter']){
  const d=meterMathFixture(type),h=M.history(d),saved=D.encode(h.get());h.change(doc=>M.flipMeter(doc,'c3'));const flipped=D.encode(h.get());h.undo();assert.equal(D.encode(h.get()),saved);h.redo();assert.equal(D.encode(h.get()),flipped);
  for(const invalid of [null,1,'true']){const bad=M.clone(d);bad.components[2].mirrored=invalid;assert.throws(()=>M.validate(bad));}
  const old=M.clone(d);delete old.components[2].mirrored;assert.equal(D.decode(JSON.stringify(old)).components[2].mirrored,false);
  const locked=M.clone(d);locked.components[2].locked=true;assert.throws(()=>M.flipMeter(locked,'c3'));locked.components[2].locked=false;locked.policy.mode='wiring';assert.throws(()=>M.flipMeter(locked,'c3'));locked.policy.allowRotate=true;M.flipMeter(locked,'c3');assert.equal(locked.components[2].mirrored,true);cases++;
}
{
  const d=M.empty(),c=M.add(d,'ammeter',300,200),w=M.addWire(d,364,326);assert(M.attach(d,w.id,'from',c.id+':a'));const port=R.ports(c).find(p=>p.key==='a');M.moveWireEnd(d,w.id,'to',{x:port.x+120,y:port.y});M.straightenWire(d,w.id);w.length=120;M.validate(d);const saved=D.encode(d);assert.throws(()=>M.flipMeter(d,c.id),/導線太短/);assert.equal(D.encode(d),saved,'failed mirror is atomic and preserves finite lengths');
  const bad=M.empty();M.add(bad,'lamp',0,0).mirrored=false;assert.throws(()=>M.validate(bad));assert.throws(()=>M.flipMeter(bad,'c1'));cases++;
}
console.log(`Focused display + mirror: ${cases} cases passed; independent quantities, simple defaults, strict/legacy JSON, all A/V ranges/orientations, unchanged readings, finite cables, permissions, undo and restored continuation.`);
