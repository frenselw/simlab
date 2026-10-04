'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),R=require('./component-registry'),S=require('./circuit-solver'),
  D=require('./circuit-document'),V=require('./circuit-renderer'),P=require('./presets'),Profile=require('./circuit-profile'),Q=require('./circuit-math'),G=require('./circuit-routing');
let cases=0;
function test(name,fn){fn();cases++;console.log('✓ '+name);}
const edit=(d,fn)=>{const n=M.clone(d);fn(n);return n;};
const near=(actual,expected,epsilon=1e-8)=>assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=epsilon*Math.max(1,Math.abs(expected)),`${actual} ≠ ${expected}`);
function join(d,a,b){return M.connect(d,a,b,[],'free');}

test('restored answers respect document locks and fixed-component mode',()=>{
  for(const mode of ['locked','wiring']){
    const d=M.empty(),c=M.add(d,'lamp',100,100);
    if(mode==='locked')c.locked=true;else d.policy.mode='wiring';
    const p=Profile.compile({initialDocument:d,palette:[{type:'resistor'}],components:{default:{remove:true}}});
    assert(!p.allows(p.initial,p.initial.components[0],'remove'));
    assert.throws(()=>p.assertSnapshot(edit(d,n=>n.components=[])));
    if(mode==='wiring')assert.throws(()=>p.assertSnapshot(edit(d,n=>n.components.push(M.component(n,'resistor',300,100)))));
    const restored=p.assertSnapshot(D.decode(D.encode(d))),next=edit(restored,n=>M.addWire(n,300,200));
    p.assertTransition(restored,next);p.assertSnapshot(D.decode(D.encode(next)));
  }
});
test('explicit no-wiring applies to both roles, including saved answers',()=>{
  for(const role of ['teacher','student']){
    const d=M.empty();M.add(d,'battery',100,100);const w=M.addWire(d,300,200),p=Profile.compile({role,initialDocument:d,wires:false});
    for(const mutate of [n=>M.addWire(n,300,300),n=>M.remove(n,w.id),n=>M.moveWireEnd(n,w.id,'from',{x:280,y:260})]){
      const next=edit(d,mutate);assert.throws(()=>p.assertTransition(d,next));assert.throws(()=>p.assertSnapshot(D.decode(D.encode(next))));
    }
    assert.deepEqual(p.assertSnapshot(D.decode(D.encode(d))),d);
  }
});
test('palette names cannot override label permission on creation or restore',()=>{
  for(const label of [false,true]){
    const p=Profile.compile({palette:[{type:'resistor'}],components:{default:{label,params:['resistance']}}}),added=edit(p.initial,n=>M.add(n,'resistor',200,100));
    p.assertTransition(p.initial,added);
    const renamed=edit(added,n=>n.components[0].label='自訂名稱');
    if(label)p.assertSnapshot(renamed);else{assert.throws(()=>p.assertSnapshot(renamed));assert.throws(()=>p.assertTransition(p.initial,renamed));}
    const restored=p.assertSnapshot(D.decode(D.encode(label?renamed:added))),next=edit(restored,n=>n.components[0].params.resistance=24);
    p.assertTransition(restored,next);
  }
});
function coupled(resistance,ideal,secondVoltage,links){
  const d=M.empty(),a=M.add(d,'battery',0,0,{voltage:6,resistance:ideal?0:.01}),r=M.add(d,'resistor',200,0,{resistance:.01}),
    b=M.add(d,'battery',0,300,{voltage:secondVoltage,resistance:ideal?0:.01}),s=M.add(d,'resistor',200,300,{resistance:.01}),v=M.add(d,'voltmeter',500,0,{resistance});
  for(const [source,load]of[[a,r],[b,s]])for(const p of ['a','b'])join(d,source.id+':'+p,load.id+':'+p);
  join(d,v.id+':a',a.id+':a');join(d,v.id+':b',b.id+':a');
  if(links===2){const other=M.add(d,'voltmeter',500,300,{resistance});join(d,other.id+':a',a.id+':b');join(d,other.id+':b',b.id+':b');}
  return {d,a,b,r,s,v};
}
test('finite high-input meters determine the relative potentials of source loops',()=>{
  let samples=0;
  for(const resistance of [1e10,1e12])for(const ideal of [true,false])for(const voltage of [6,9])for(const links of [1,2]){
    const f=coupled(resistance,ideal,voltage,links),o=S.solve(f.d),expected=links===1?0:(6-voltage)*(ideal?1:.5)/(2+2*(ideal?0:.005)/resistance);
    assert.deepEqual(o.diagnostics,[]);near(o.components[f.v.id].reading,expected);near(o.components[f.v.id].current,expected/resistance,1e-20);
    assert(Object.values(o.potentials).every(Number.isFinite));assert(o.residual<1e-8);
    if(links===1){near(o.components[f.r.id].current,ideal?600:300);near(o.components[f.s.id].current,voltage/(ideal?.01:.02));}
    const restored=D.decode(D.encode(f.d));restored.display.reference=f.b.id+':b';near(S.solve(restored).components[f.v.id].reading,expected);
    restored.components[0].params.voltage=9;assert.deepEqual(S.solve(restored).diagnostics,[]);samples++;
  }
  assert.equal(samples,16);
});
test('genuinely ambiguous ideal branches remain unknown; contradictory sources still fail',()=>{
  const d=M.empty(),a=M.add(d,'battery',0,0),b=M.add(d,'battery',0,200),r=M.add(d,'resistor',250,0);
  for(const p of ['a','b']){join(d,a.id+':'+p,b.id+':'+p);join(d,a.id+':'+p,r.id+':'+p);}
  let o=S.solve(d);assert(o.diagnostics.some(d=>d.code==='indeterminate'));assert.equal(o.components[a.id].current,null);assert.equal(o.components[b.id].current,null);near(o.components[r.id].current,.5);
  const duplicate=M.addWire(d,150,300);assert(M.attach(d,duplicate.id,'from',a.id+':a'));assert(M.attach(d,duplicate.id,'to',r.id+':a'));
  o=S.solve(D.decode(D.encode(d)));assert.equal(o.wires[duplicate.id].current,null);near(o.components[r.id].current,.5);
  b.params.voltage=9;o=S.solve(d);assert(o.diagnostics.some(d=>d.code==='inconsistent'));assert.equal(o.components[r.id].current,null);
});
test('finite meter input current stays unknown without a solution; ideal input stays zero',()=>{
  for(const resistance of [0,1e6])for(const positive of ['a','c']){
    const d=M.empty(),a=M.add(d,'battery',0,0,{voltage:6}),b=M.add(d,'battery',0,200,{voltage:9}),v=M.add(d,'voltmeter',300,0,{resistance});
    for(const p of ['a','b'])join(d,a.id+':'+p,b.id+':'+p);
    join(d,a.id+':a',v.id+':'+positive);join(d,a.id+':b',v.id+':b');
    let o=S.solve(d),r=o.components[v.id];assert(o.diagnostics.some(q=>q.code==='inconsistent'));
    assert.equal(r.current,resistance===0?0:null);assert.equal(r.reading,null);assert.equal(r.voltage,null);assert.equal(r.power,null);assert.equal(r.meterStatus,'unknown');
    if(resistance>0)assert.equal(r.branches.find(e=>e.from===v.id+':'+positive).current,null);
    const restored=D.decode(D.encode(d));restored.components.find(c=>c.id===b.id).params.voltage=6;
    o=S.solve(restored);near(o.components[v.id].reading,6);near(o.components[v.id].current,resistance===0?0:6/(resistance/(positive==='c'?5:1)),1e-20);
    assert(o.diagnostics.some(q=>q.code==='indeterminate'));assert.equal(o.components[a.id].current,null);
  }
});
test('balanced bridges display numerical zero while genuine tiny currents survive',()=>{
  const d=P.create('bridge'),balanced=S.solve(d);
  assert.equal(balanced.components.c6.reading,0);assert.equal(Q.quantity(balanced.components.c6.reading,'A').text,'0 A');
  assert(V.scene(d,balanced).includes('data-math="0 A"'));
  d.components[2].params.resistance=20+1e-10;
  const delta=d.components[2].params.resistance-20,expected=6*.1*delta/(20*(20+delta))/(.2+.05+1/(20+delta)),o=S.solve(d);
  assert(o.components.c6.reading>0);assert(Math.abs(o.components.c6.reading-expected)<1e-16);
  const tiny=M.empty(),source=M.add(tiny,'battery',0,0,{voltage:6}),meter=M.add(tiny,'voltmeter',200,0,{resistance:1e12});
  join(tiny,source.id+':a',meter.id+':a');join(tiny,source.id+':b',meter.id+':b');near(S.solve(tiny).components[meter.id].current,6e-12,1e-25);
});
test('wire currents preserve tiny parallel branches and reverse only with wire direction',()=>{
  for(const resistance of [1e10,1e12]){
    const d=M.empty(),source=M.add(d,'battery',0,0,{voltage:6}),load=M.add(d,'resistor',200,0,{resistance:.01}),meter=M.add(d,'voltmeter',400,0,{resistance});
    for(const c of [load,meter])for(const p of ['a','b'])join(d,source.id+':'+p,c.id+':'+p);
    let o=S.solve(d);assert.deepEqual(o.diagnostics,[]);near(o.components[meter.id].current,6/resistance,1e-25);
    for(const w of d.wires.filter(w=>w.to.startsWith(meter.id+':')))near(o.wires[w.id].current,(w.to.endsWith(':a')?1:-1)*6/resistance,1e-25);
    for(const reference of [source.id+':a',source.id+':b']){
      const restored=D.decode(D.encode(d));restored.display.reference=reference;
      for(const w of restored.wires)[w.from,w.to]=[w.to,w.from];
      const reversed=S.solve(restored);assert.deepEqual(reversed.diagnostics,[]);
      for(const w of d.wires)near(reversed.wires[w.id].current,-o.wires[w.id].current,1e-25);
      restored.components[0].params.voltage=9;const next=S.solve(restored);
      for(const w of restored.wires.filter(w=>w.from.startsWith(meter.id+':')))near(next.wires[w.id].current,(w.from.endsWith(':a')?-1:1)*9/resistance,1e-25);
    }
    const f=coupled(resistance,true,9,2),before=S.solve(f.d),reversed=D.decode(D.encode(f.d));
    for(const w of reversed.wires)[w.from,w.to]=[w.to,w.from];
    const after=S.solve(reversed);near(before.components[f.v.id].current,-1.5/resistance,1e-25);
    for(const w of f.d.wires)near(after.wires[w.id].current,-before.wires[w.id].current,1e-25);
    for(const w of f.d.wires.slice(4))assert(Math.abs(before.wires[w.id].current)>0);
  }
  const bridge=P.create('bridge'),o=S.solve(bridge),meterWire=bridge.wires.filter(w=>w.from.startsWith('c6:')||w.to.startsWith('c6:'));
  assert.equal(meterWire.length,2);for(const w of meterWire)assert.equal(o.wires[w.id].current,0);
});
test('accepted near-limit wires bend safely and impossible rotations stay atomic',()=>{
  const d=M.empty(),c=M.add(d,'resistor',200,200),w=M.addWire(d,200,200);assert(M.attach(d,w.id,'from',c.id+':b'));
  const far=d.junctions.find(j=>j.id+':p'===w.to);Object.assign(far,{x:860.01,y:200});w.via=[];M.validate(d);
  const saved=D.encode(d),restored=D.decode(saved);assert(M.bendWire(restored,w.id,{x:560,y:200},0,30).limited);assert.equal(D.encode(restored),saved);
  M.moveWireEnd(restored,w.id,'to',{x:760,y:200});assert(!M.bendWire(restored,w.id,{x:510,y:200},0,30).limited);assert(restored.wires[0].via.length>0);M.validate(restored);
  M.moveWireEnd(d,w.id,'to',{x:800,y:265});const before=D.encode(d);assert.throws(()=>M.rotateComponent(d,c.id,1),/導線太短/);assert.equal(D.encode(d),before);
  const h=M.history(d);assert.throws(()=>h.change(next=>M.rotateComponent(next,c.id,1)));assert.equal(h.canUndo(),false);assert.equal(D.encode(h.get()),before);
  M.moveWireEnd(d,w.id,'to',{x:799,y:260});M.rotateComponent(d,c.id,1);assert.equal(d.components[0].angle,90);
  assert.equal(G.route(d,d.wires[0]).length,2);M.bendWire(d,w.id,{x:500,y:260},0,30);M.validate(d);
});
test('linear and thermal DC behavior survives the changed branch representation',()=>{
  near(S.solve(P.create('series')).components.c1.current,-.25);near(S.solve(P.create('parallel')).components.c1.current,-1);
  const d=M.empty(),a=M.add(d,'battery',0,0,{resistance:2}),r=M.add(d,'resistor',200,0,{resistance:12});join(d,a.id+':a',r.id+':a');join(d,a.id+':b',r.id+':b');
  let o=S.solve(d);near(o.components[r.id].current,6/14);near(o.components[a.id].sourcePower,o.components[a.id].delivered+o.components[a.id].internalPower);
  const lamp=M.empty(),source=M.add(lamp,'battery',0,0),bulb=M.add(lamp,'lamp',200,0,{model:'thermal'});join(lamp,source.id+':a',bulb.id+':a');join(lamp,source.id+':b',bulb.id+':b');
  for(const voltage of [.1,6,60]){source.params.voltage=voltage;o=S.solve(lamp);assert.deepEqual(o.diagnostics,[]);near(o.components[bulb.id].power,voltage*o.components[bulb.id].current);}
  source.params.voltage=6;o=S.solve(lamp);near(o.components[bulb.id].current,.5);near(o.components[bulb.id].resistance,12);
  const meters=P.create('meters');near(S.solve(meters).components.c3.reading,3);
});
test('potential-rise arrows use the same branch voltage and terminals',()=>{
  for(const terminals of [3,4])for(const angle of [0,90,180,270]){
    const d=M.empty(),r=M.add(d,'rheostat',200,200,{terminals,resistance:20}),a=M.add(d,'battery',0,0,{voltage:6}),b=M.add(d,'battery',0,400,{voltage:9});r.angle=angle;d.display.potential=true;
    join(d,a.id+':a',r.id+':a');join(d,a.id+':b',r.id+':c');join(d,b.id+':a',r.id+':b');join(d,b.id+':b',r.id+':c');
    const o=S.solve(d),html=V.scene(d,o),match=html.match(/data-potential-direction="c1" data-potential-from="([^"]+)" data-potential-to="([^"]+)" transform="[^\"]*rotate\(([^)]+)\)/);
    assert(match);assert.equal(match[1],'c1:a');assert.equal(match[2],'c1:b');assert(o.potentials[match[2]]>o.potentials[match[1]]);
    const ports=M.endpoints(d),from=ports.get(match[1]),to=ports.get(match[2]);near(Number(match[3]),Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI);
  }
});
console.log(`Audit regressions: ${cases} focused groups passed.`);
