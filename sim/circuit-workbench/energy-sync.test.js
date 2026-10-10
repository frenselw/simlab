'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),T=require('./circuit-transient'),P=require('./circuit-ac-presets'),V=require('./circuit-renderer'),O=require('./circuit-observation');
for(const name of ['rc','rl'])for(const polarity of [1,-1]){
 const d=P.create(name),c=d.components.find(c=>['capacitor','inductor'].includes(c.type)),sw=d.components.find(c=>c.type==='spdt');d.components.find(c=>c.type==='battery').params.polarity=polarity;sw.params.closed='b';const s=new T.Session(d),baselines=new Map();
 for(let n=0;n<48;n++){V.flowReferences(s.doc,s.read(),baselines);s.advance(.125);}const off=M.clone(s.doc);off.components.find(c=>c.id===sw.id).params.closed='c';s.update(off);
 let previous=null,found=false;
 for(let n=0;n<320;n++){
  const raw=s.read(),refs=V.flowReferences(s.doc,raw,baselines),r=raw.components[c.id],view=V.displayComponent(s.doc,raw,c,refs);
  if(view.energy===0){
   assert(previous&&previous.energy>0&&previous.current!==0);assert(r.energy>0&&Math.abs(r.current)>0);assert(V.storedEnergyInvisible(s.doc,raw,c.id+':a'));for(const key of ['current','voltage','fieldCurrent','fieldVoltage','energy'])assert.equal(view[key],0);if(name==='rc')assert.equal(view.charge,0);
   for(const w of s.doc.wires)assert.equal(V.displayCurrent(s.doc,raw,w.from,raw.wires[w.id].current,refs,raw.wires[w.id].currentPeak),0);
   const checkpoint=s.capture(),signal=O.signal({kind:'current',probes:[{target:{kind:'component',id:c.id}}]},raw,s.doc);assert.equal(signal,r.current);V.displayComponent(s.doc,raw,c,refs);assert.deepEqual(s.capture(),checkpoint);
   const restored=T.Session.restore(checkpoint);s.advance(.125);restored.advance(.125);assert(Math.abs(s.read().components[c.id].current-restored.read().components[c.id].current)<1e-12);
   const on=M.clone(s.doc);on.components.find(c=>c.id===sw.id).params.closed='b';s.update(on);s.advance(.125);const live=s.read(),liveView=V.displayComponent(s.doc,live,c,V.flowReferences(s.doc,live,baselines));assert(liveView.energy>0&&liveView.current!==0);found=true;break;
  }
  previous=view;s.advance(.125);
 }
 assert(found,name+' must reach the first invisible stored energy');
}
// A capacitor's instantaneous zero energy during normal LC exchange is not an empty circuit.
{
 const d=M.empty('transient'),c=M.add(d,'capacitor',0,0,{capacitance:.02,initialVoltage:0}),l=M.add(d,'inductor',200,0,{inductance:5,resistance:0,initialCurrent:.3});M.connect(d,c.id+':a',l.id+':a');M.connect(d,c.id+':b',l.id+':b');const s=new T.Session(d),raw=s.read();assert.equal(raw.components[c.id].energy,0);assert(raw.components[l.id].energy>0);assert(!V.storedEnergyInvisible(d,raw,c.id+':a'));assert(V.displayComponent(d,raw,c).current!==0);
 s.advance(2);const observed=s.read(),point={...observed,components:M.clone(observed.components)};point.components[c.id].energy=0;point.components[c.id].voltage=0;point.components[c.id].charge=0;assert(!V.storedEnergyInvisible(d,point,c.id+':a'));assert(V.displayComponent(d,point,c).current!==0);assert.equal(V.displayComponent(d,point,c).fieldVoltage,0);
}
// Visible energy in a different circuit cannot keep an exhausted circuit's currents moving.
{
 const d=M.empty('transient'),pairs=[];for(const resistance of [20,1e6]){const c=M.add(d,'capacitor',0,pairs.length*200,{capacitance:.1,initialVoltage:6}),r=M.add(d,'resistor',200,pairs.length*200,{resistance});M.connect(d,c.id+':a',r.id+':a');M.connect(d,c.id+':b',r.id+':b');pairs.push(c);}const s=new T.Session(d);s.advance(25);const raw=s.read();assert(V.storedEnergyInvisible(d,raw,pairs[0].id+':a'));assert(!V.storedEnergyInvisible(d,raw,pairs[1].id+':a'));assert(V.displayComponent(d,raw,pairs[1]).fieldVoltage>5.9);
}
// Preserve a genuinely measurable 100 pA signal despite negligible energy in a macro display.
{
 const d=M.empty('transient'),c=M.add(d,'capacitor',0,0,{capacitance:.1,initialVoltage:.0001}),r=M.add(d,'resistor',200,0,{resistance:1e6}),g=M.add(d,'galvanometer',400,0,{range:1e-9});M.connect(d,c.id+':a',r.id+':a');M.connect(d,r.id+':b',g.id+':a');M.connect(d,g.id+':b',c.id+':b');const s=new T.Session(d);s.advance(2);const raw=s.read();assert.equal(V.displayEnergy(raw.components[c.id].energy),0);assert(!V.storedEnergyInvisible(d,raw,c.id+':a'));assert(V.displayComponent(d,raw,c).current!==0);
}
{const d=M.empty('transient'),c=M.add(d,'capacitor',0,0),s=new T.Session(d);s.advance(2);const observed=s.read(),unknown={...observed,components:M.clone(observed.components)};unknown.components[c.id].current=null;assert(!V.storedEnergyInvisible(d,unknown,c.id+':a'));assert.equal(V.displayComponent(d,unknown,c).current,null);}
console.log('Energy sync: first 0 J RC/RL both polarities, currents/fields/charges, raw signal/snapshot/continuation, recharge, LC exchange, independent islands and measurable microcurrent passed');
