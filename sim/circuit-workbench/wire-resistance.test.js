'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),S=require('./circuit-solver'),D=require('./circuit-document'),G=require('./circuit-routing'),Profile=require('./circuit-profile'),C=require('./circuit-checks'),V=require('./circuit-renderer');
const near=(a,b)=>{assert(Number.isFinite(a));assert(Math.abs(a-b)<=Math.max(1e-24,Math.abs(b)*1e-8),`${a} != ${b}`);};
const report=d=>{const {voltage,...values}=S.solve(d);return values;};
function fixture(){const d=M.empty(),battery=M.add(d,'battery',100,150,{voltage:6}),load=M.add(d,'resistor',360,150,{resistance:12});M.connect(d,battery.id+':a',load.id+':a',[],'free');M.connect(d,load.id+':b',battery.id+':b',[],'free');return d;}
let groups=0;
function test(name,fn){fn();groups++;console.log('✓ '+name);}
test('per-wire resistance, voltage drop, power and conservation',()=>{
  const d=fixture();near(S.solve(d).components.c2.current,.5);M.setWireResistance(d,'w1',6);const o=S.solve(d);
  near(o.components.c2.current,1/3);near(o.wires.w1.current,1/3);near(o.wires.w2.current,1/3);near(o.wires.w1.voltage,2);near(o.wires.w1.power,2/3);near(o.components.c2.voltage,4);near(o.wires.w1.potential-o.wires.w1.potentialTo,2);near(o.components.c1.delivered,o.components.c2.power+o.wires.w1.power);
  assert(C.series(d,['c1','c2'],{requirePowered:true}).passed);assert(C.connected(d,[['c1:a','c2:a']]).passed);assert(!V.visualState(d,o).short);
});
test('parallel resistive wires, ideal bypass and orientation',()=>{
  const d=fixture();d.wires[0].resistance=6;d.wires.push({...M.clone(d.wires[0]),id:'w3',resistance:12});let o=S.solve(d);
  near(o.components.c2.current,.375);near(o.wires.w1.current,.25);near(o.wires.w3.current,.125);assert(C.series(d,['c1','c2'],{requirePowered:true}).passed);
  const branched=M.clone(d);branched.wires.push({...M.clone(d.wires[0]),id:'w4',to:'c2:b',resistance:6});assert(!C.series(branched,['c1','c2'],{requirePowered:true}).passed,'a resistive bypass must count as a conductive branch');
  const reversed=M.clone(d);for(const w of reversed.wires)[w.from,w.to]=[w.to,w.from];const r=S.solve(reversed);for(const w of d.wires){near(r.wires[w.id].current,-o.wires[w.id].current);near(r.wires[w.id].voltage,-o.wires[w.id].voltage);near(r.wires[w.id].power,o.wires[w.id].power);}
  d.wires[2].resistance=0;o=S.solve(d);near(o.components.c2.current,.5);near(o.wires.w1.current,0);near(o.wires.w3.current,.5);
});
test('order, revert, geometry, history and document continuation',()=>{
  const d=fixture(),original=D.encode(d),originalResult=report(d),a=M.clone(d),b=M.clone(d);
  M.setWireResistance(a,'w1',2);M.setWireResistance(a,'w2',4);M.setWireResistance(b,'w2',4);M.setWireResistance(b,'w1',2);assert.deepEqual(report(a),report(b));
  M.setWireResistance(a,'w1',0);M.setWireResistance(a,'w2',0);assert.equal(D.encode(a),original);assert.deepEqual(report(a),originalResult);
  const h=M.history(d);h.change(n=>M.setWireResistance(n,'w1',6));const saved=D.encode(h.get()),restored=D.decode(saved);assert.equal(D.encode(restored),saved);M.straightenWire(restored,'w1');const route=G.route(restored,restored.wires[0]);M.bendWire(restored,'w1',G.along(route,G.length(route)/2),0,20);assert.equal(restored.wires[0].resistance,6);near(S.solve(restored).components.c2.current,1/3);M.setWireResistance(restored,'w2',6);near(S.solve(restored).components.c2.current,.25);
  h.undo();assert.equal(D.encode(h.get()),original);h.redo();assert.equal(D.encode(h.get()),saved);
  const cut=G.nearest(G.route(h.get(),h.get().wires[0]),{x:220,y:110}),split=M.clone(h.get());M.splitWire(split,'w1',cut,G.route(split,split.wires[0]));M.validate(split);near(split.wires.reduce((s,w)=>s+w.resistance,0),6);near(S.solve(split).components.c2.current,1/3);
});
test('new cable defaults leave previous cables unchanged',()=>{
  const d=fixture();d.cables.resistance=3;const next=M.addWire(d,200,320);assert.equal(next.resistance,3);assert.deepEqual(d.wires.slice(0,2).map(w=>w.resistance),[0,0]);d.cables.resistance=8;assert.equal(next.resistance,3);assert.equal(M.addWire(d,200,400).resistance,8);assert.equal(D.template(d).cables.resistance,8);
});
test('resistive bridge and thermal lamp use the same solver',()=>{
  const d=M.empty(),b=M.add(d,'battery',100,100,{voltage:6}),parts=[];for(let i=0;i<4;i++)parts.push(M.add(d,'resistor',250+i*100,250,{resistance:12}));
  const top=M.connect(d,b.id+':a',parts[0].id+':a');M.connect(d,b.id+':a',parts[2].id+':a');M.connect(d,parts[0].id+':b',parts[1].id+':a');M.connect(d,parts[2].id+':b',parts[3].id+':a');M.connect(d,parts[1].id+':b',b.id+':b');M.connect(d,parts[3].id+':b',b.id+':b');const bridge=M.connect(d,parts[0].id+':b',parts[2].id+':b');bridge.resistance=6;
  near(S.solve(d).wires[bridge.id].current,0);top.resistance=6;const o=S.solve(d);near(o.wires[bridge.id].current,-.03125);near(o.wires[top.id].current,.1875);near(o.potentials['c2:b'],2.625);near(o.potentials['c4:b'],2.8125);
  const lamp=fixture();lamp.components[1].type='lamp';lamp.components[1].params=require('./component-registry').defaults('lamp');lamp.components[1].params.model='thermal';lamp.wires[0].resistance=6;const hot=S.solve(lamp);assert.equal(hot.diagnostics.length,0);near(hot.components.c1.delivered,hot.components.c2.power+hot.wires.w1.power);near(hot.wires.w1.voltage,hot.wires.w1.current*6);assert(hot.components.c2.current>0);
});
test('legacy documents migrate to zero resistance; invalid values fail atomically',()=>{
  for(const version of [1,2,3,4,5]){const d=fixture();d.version=version;delete d.cables.resistance;for(const w of d.wires){delete w.resistance;if(version===1){delete w.shape;w.via=[];}if(version<3)delete w.length;}if(version<3)delete d.cables;const n=D.decode(JSON.stringify(d));assert.equal(n.version,6);assert.equal(n.cables.resistance,0);assert(n.wires.every(w=>w.resistance===0));near(S.solve(n).components.c2.current,.5);M.setWireResistance(n,'w1',6);near(S.solve(n).components.c2.current,1/3);}
  const h=M.history(fixture()),saved=D.encode(h.get());for(const value of [-1,NaN,Infinity,M.limits.resistance+1]){assert.throws(()=>h.change(d=>M.setWireResistance(d,'w1',value)));assert.throws(()=>h.change(d=>d.cables.resistance=value));assert.equal(D.encode(h.get()),saved);}
  assert.throws(()=>h.change(d=>delete d.wires[0].resistance));const old=fixture();old.version=5;assert.throws(()=>M.validate(old),'old versions cannot smuggle the new fields');
});
test('student fixed/open permissions and no-wiring/read-only guards',()=>{
  const d=fixture();d.wires[0].resistance=6;const fixed=Profile.compile({initialDocument:d}),allowed=Profile.compile({initialDocument:d,wireResistance:true});
  assert(!fixed.canSetWireResistance(d));assert(allowed.canSetWireResistance(d));const n=M.clone(d);n.wires[0].resistance=2;assert.throws(()=>fixed.assertSnapshot(n));allowed.assertSnapshot(n);assert.throws(()=>allowed.assertTransition(d,n,true));
  const extra=M.clone(d);M.addWire(extra,100,300).resistance=2;assert.throws(()=>fixed.assertSnapshot(extra));const defaults=M.clone(d);defaults.cables.resistance=3;assert.throws(()=>allowed.assertSnapshot(defaults));
  const noWires=Profile.compile({role:'teacher',initialDocument:d,wires:false});assert(!noWires.canSetWireResistance(d));assert.throws(()=>noWires.assertSnapshot(n));for(const value of ['yes',null,0])assert.throws(()=>Profile.compile({wireResistance:value}));
  const locked=M.clone(d);locked.policy.mode='wiring';const teacher=Profile.compile({role:'teacher',initialDocument:locked});assert(!teacher.canSetWireResistance(locked));const changed=M.clone(locked);changed.wires[0].resistance=1;assert.throws(()=>teacher.assertTransition(locked,changed));
});
test('floating wires, finite loop, short circuit recovery and resistance extremes',()=>{
  const loose=M.empty(),w=M.addWire(loose,100,100);w.resistance=2;near(S.solve(loose).wires[w.id].current,0);
  const d=M.empty(),battery=M.add(d,'battery',200,200,{voltage:6}),wire=M.connect(d,battery.id+':a',battery.id+':b');wire.resistance=6;let o=S.solve(d);near(o.wires[wire.id].current,1);assert(!V.visualState(d,o).short);wire.resistance=0;o=S.solve(d);assert.equal(o.wires[wire.id].current,null);assert(o.diagnostics.some(x=>x.code==='inconsistent'));assert(V.visualState(d,o).short);
  for(const r of [1e-8,.001,1,M.limits.resistance]){const f=fixture();f.wires[0].resistance=r;const a=S.solve(f);near(a.components.c2.current,6/(12+r));assert(!a.diagnostics.length);}
  const f=fixture();f.wires[0].resistance=6;f.wires[1].resistance=3;f.components[0].params.polarity=-1;const a=S.solve(f);near(a.wires.w1.current,-6/21);near(a.wires.w1.power,36/441*6);
});
test('potential gradients follow arc length and use editor namespaces',()=>{
  const d=fixture();d.display.potential=true;d.wires[0].resistance=6;d.wires[0].via=[{x:160,y:90},{x:220,y:60}];const o=S.solve(d),markup=V.scene(d,o,1,{},null,false,null,{idPrefix:'one-'});assert(markup.includes('data-wire-potential="w1"'));assert(markup.includes('id="one-wire-potential-w1-1"'));assert(!markup.includes('wire-potential-w2-'));assert(V.scene(d,o,1,{},null,false,null,{idPrefix:'two-'}).includes('id="two-wire-potential-w1-1"'));
});
console.log(`Wire resistance: ${groups} focused groups passed.`);
