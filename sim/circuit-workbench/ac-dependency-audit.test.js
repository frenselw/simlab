'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),T=require('./circuit-transient');
const link=(d,a,b,ap='a',bp='a')=>M.connect(d,a.id+':'+ap,b.id+':'+bp);
function acPair(){const d=M.empty('transient');d.cables.count=40;d.cables.length=1200;const a=M.add(d,'ac-source',100,200,{frequency:.17}),r=M.add(d,'resistor',300,200,{resistance:12}),v=M.add(d,'ac-voltmeter',100,400);link(d,a,r);link(d,a,r,'b','b');link(d,a,v);link(d,a,v,'b','b');return {d,a,r,v};}
function other(d,type='ac-source',join=true){const b=M.add(d,type,600,200,type==='ac-source'?{frequency:1}:{voltage:6}),r=M.add(d,'resistor',800,200,{resistance:12});link(d,b,r);link(d,b,r,'b','b');if(join)link(d,d.components[0],b,'b','b');return {b,r};}
function transformer(mode){const d=M.empty('transient');d.cables.length=1200;d.cables.count=40;const a=M.add(d,'ac-source',100,200),t=M.add(d,'transformer',300,200),r=M.add(d,'resistor',500,200,{resistance:12});if(mode==='zero-series'){const z=M.add(d,'battery',150,400,{voltage:0,resistance:0});link(d,a,z);link(d,z,t,'b','a');}else link(d,a,t);link(d,a,t,'b','b');link(d,t,r,'c','a');link(d,t,r,'d','b');if(['separate','reference','dangling'].includes(mode)){const b=M.add(d,'battery',100,600,{voltage:6}),load=M.add(d,'resistor',300,600);link(d,b,load);if(mode!=='dangling')link(d,b,load,'b','b');if(mode!=='separate')link(d,a,b,'b','b');}if(mode==='true-dc'){a.type='battery';a.params=require('./component-registry').defaults('battery');}return {d,a,t,r};}
function assertContinuation(actual,expected){
 // Re-solving a restored constraint can differ by a few IEEE-754 rounding bits.
 assert.deepEqual({...actual,dynamic:expected.dynamic},expected);
 assert.deepEqual(Object.keys(actual.dynamic),Object.keys(expected.dynamic));
 for(const [id,value]of Object.entries(expected.dynamic)){
  assert.deepEqual(Object.keys(actual.dynamic[id]),Object.keys(value));
  for(const key of ['i','v'])assert(Math.abs(actual.dynamic[id][key]-value[key])<=4*Number.EPSILON*Math.max(1,Math.abs(value[key])),'restored '+id+' '+key);
 }
}
if(require.main===module){
 assertContinuation({dynamic:{c:{i:.3+Number.EPSILON,v:2}}},{dynamic:{c:{i:.3,v:2}}});
 assert.throws(()=>assertContinuation({dynamic:{c:{i:.3+1e-8,v:2}}},{dynamic:{c:{i:.3,v:2}}}));
 // A dangling lead does not change the powered loop or its brightness window.
 for(const name of ['resistive','capacitive']){
  const P=require('./circuit-ac-presets'),V=require('./circuit-renderer'),d=P.create(name),w=M.addWire(d,430,320),s=new T.Session(d);
  s.advance(.25);const before=s.capture(),lamp=d.components.find(c=>c.type==='lamp'),cap=d.components.find(c=>c.type==='capacitor'),power=s.read().components[lamp.id].displayPower,measurements=s.read().measurements[lamp.id];
  const moved=M.clone(d);moved.components.find(c=>c.id===lamp.id).x+=20;assert.equal(s.update(moved),'geometry');assert.deepEqual(s.capture().physics,before.physics);
  const connected=M.clone(moved);assert(M.attach(connected,w.id,'from','c2:a'));assert.equal(s.update(connected),'event');
  assert.equal(s.state.time,before.physics.time);assert.deepEqual(s.state.sources,before.physics.sources);assertContinuation({dynamic:s.state.dynamic},{dynamic:before.physics.dynamic});assert.deepEqual(s.read().measurements[lamp.id],measurements);
  assert.equal(s.read().components[lamp.id].displayPower,power);assert(V.lampLight(lamp,s.read().components[lamp.id]).brightness>0);if(cap)assert(s.read().components[cap.id].charge>0);
  const restored=T.Session.restore(s.capture());s.advance(.025);restored.advance(.025);assertContinuation(restored.state,s.state);assert.equal(s.fault,null);
  // A genuine disconnection still restarts this sole affected circuit.
  const open=M.clone(s.doc);M.detach(open,d.wires[1].id,'from');assert.equal(s.update(open),'restarted');assert.equal(s.state.time,0);assert.equal(s.read().components[lamp.id].displayPower,null);if(cap)assert.equal(s.read().components[cap.id].charge,0);
 }
 console.log('Live drag: geometry, dangling-lead phase/storage/brightness retention, restore continuation and genuine rewiring passed.');
 for(const mode of ['base','separate','reference','zero-series','dangling']){const f=transformer(mode),s=new T.Session(f.d);assert.equal(s.fault,null,mode);s.advance(1.1);assert.equal(s.fault,null,mode);assert(Math.abs(s.read().measurements[f.r.id].voltageRms-3)<.006,mode);}assert.equal(new T.Session(transformer('true-dc').d).fault,'dc-transformer');console.log('CW-08 actual DC excitation / shared reference / zero source / dangling branch passed.');
 for(const join of [false,true]){const f=acPair();other(f.d,'ac-source',join);const s=new T.Session(f.d);s.advance(6);const q=s.read().measurements[f.v.id];assert.equal(q.window,1/.17);assert.equal(q.voltageStatus,'ready');assert(Math.abs(q.voltageRms-6)<.006);}
 const f=acPair(),s=new T.Session(f.d);s.advance(6);const ready=s.read().measurements[f.v.id];const d=M.clone(s.doc),o=other(d);s.update(d);assert.equal(s.state.time,6);assert.deepEqual(s.read().measurements[f.v.id],ready);const change=M.clone(s.doc);change.components.find(c=>c.id===o.b.id).params.frequency=2;s.update(change);assert.deepEqual(s.read().measurements[f.v.id],ready);const remove=M.clone(s.doc);M.remove(remove,o.b.id);M.remove(remove,o.r.id);s.update(remove);assert.equal(s.state.time,6);assert.deepEqual(s.read().measurements[f.v.id],ready);s.advance(.2);assert.equal(s.fault,null);assert.equal(s.read().energyBalance.status,'reliable');const restored=T.Session.restore(s.capture());restored.advance(.1);assert.equal(restored.fault,null);console.log('CW-09 shared-reference windows and unaffected add/change/remove history passed.');
 {const f=acPair(),b=other(f.d).b,cross=M.add(f.d,'ac-voltmeter',400,400);link(f.d,cross,f.a);link(f.d,cross,b,'b','a');const s=new T.Session(f.d);s.advance(6);assert.equal(s.read().measurements[cross.id].window,100);assert.equal(s.read().measurements[cross.id].voltageStatus,'collecting');assert.equal(s.read().measurements[f.v.id].voltageStatus,'ready');assert.equal(s.read().measurements[f.v.id].window,1/.17);}
 {const f=acPair(),b=other(f.d).b,w=M.add(f.d,'ac-wattmeter',400,400);M.remove(f.d,f.d.wires[0].id);link(f.d,f.a,w);link(f.d,w,f.r,'b','a');link(f.d,w,b,'c','a');link(f.d,w,b,'d','b');const s=new T.Session(f.d);s.advance(6);const q=s.read().measurements[w.id];assert.equal(q.currentWindow,1/.17);assert.equal(q.voltageWindow,1);assert.equal(q.powerWindow,100);assert.equal(q.currentStatus,'ready');assert.equal(q.voltageStatus,'ready');assert.equal(q.powerStatus,'collecting');assert.equal(s.fault,null);}
 {const f=acPair(),b=other(f.d).b,r=M.add(f.d,'resistor',400,400,{resistance:12});link(f.d,r,f.a);link(f.d,r,b,'b','a');const s=new T.Session(f.d);assert.equal(s.compiled.policies.get(r.id).quantities.current.window,100);assert.equal(s.compiled.policies.get(f.v.id).window,1/.17);s.advance(6);assert.equal(s.read().measurements[f.v.id].voltageStatus,'ready');}
 console.log('CW-09 genuine mixed current, cross-block voltage/power and ideal voltage constraints passed.');
}
module.exports={acPair,other,transformer};
