'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),T=require('./circuit-transient'),P=require('./circuit-ac-presets'),D=require('./circuit-document');
const close=(a,b,t=.002)=>assert(Math.abs(a-b)<=t,`${a} != ${b}`);
function load(params={},resistance=12,type='resistor',extra={}){
 const d=M.empty('transient'),s=M.add(d,'ac-source',100,100,{protectionEnabled:true,...params}),r=M.add(d,type,300,100,type==='resistor'?{resistance,...extra}:extra);
 M.connect(d,s.id+':a',r.id+':a');M.connect(d,s.id+':b',r.id+':b');return {d,s,r};
}
function resume(s){const saved=s.capture(),r=T.decodeSession(T.encodeSession(saved));assert.deepEqual(r.capture(),saved);r.advance(.005);assert.equal(r.fault,null);return r;}
for(const turns of [100,200,400]){
 const d=P.create('transformer');d.components[1].params.secondaryTurns=turns;const s=new T.Session(d),scale=turns===400?.5:1;
 close(s.state.protection.c1.scale,scale,1e-7);s.advance(1.125);assert.equal(s.fault,null);const a=s.read();
 for(const [id,expected]of [['c5',turns===400?1:turns===200?.5:.125],['c6',6*scale],['c7',turns===100?3:6]])close(a.components[id].reading,expected,.005);
 assert.equal(a.components.c1.protection.status,turns===400?'limited':'normal');close(a.measurements.c1.currentRms,turns===400?1:turns===200?.5:.125);resume(s);
}
// The limit is evaluated at t=0, including 0.1 Hz and without any meter.
for(const frequency of [.1,1,50]){const f=load({frequency,maxCurrent:.25,maxPower:100}),s=new T.Session(f.d);close(s.state.protection[f.s.id].scale,.5,1e-7);assert.equal(s.read().measurements[f.s.id].status,'collecting');resume(s);}
// Average power is 3 W although its sine-wave instantaneous peak is 6 W.
{const f=load({maxPower:3}),s=new T.Session(f.d);assert.equal(s.state.protection[f.s.id].status,'normal');s.advance(.25);close(s.read().components[f.s.id].delivered,6,1e-8);assert.equal(s.state.protection[f.s.id].status,'normal');}
{const f=load({maxCurrent:10,maxPower:1.5}),s=new T.Session(f.d);close(s.state.protection[f.s.id].scale,Math.SQRT1_2,1e-7);s.advance(1.05);close(-s.read().measurements[f.s.id].averagePower,1.5);resume(s);f.r.params.resistance=100;s.update(f.d);assert.equal(s.state.protection[f.s.id].status,'normal');}
// Pure reactive VA must not be mistaken for mean active watts.
{for(const protectionEnabled of [false,true]){const f=load({protectionEnabled,resistance:2,maxCurrent:10,maxPower:100}),s=new T.Session(f.d);s.advance(1.1);close(s.read().measurements[f.s.id].voltageRms,protectionEnabled?6:6*12/14,.005);assert.equal(s.read().energyBalance.status,'reliable');resume(s);}}
{const f=load({maxCurrent:100,maxPower:.001},0,'inductor',{inductance:1,resistance:0}),s=new T.Session(f.d);assert.equal(s.state.protection[f.s.id].status,'normal');s.advance(.01);assert.equal(s.fault,null);resume(s);}
for(const waveform of ['sine','square','triangle']){const f=load({waveform,maxCurrent:.25,maxPower:100}),s=new T.Session(f.d);close(s.state.protection[f.s.id].scale,.5,.0001);s.advance(1.1);close(s.read().measurements[f.s.id].currentRms,.25,.0005);assert.equal(s.fault,null);resume(s);}
// A short latches only its source; remove it and reset manually.
{const f=load(),other=M.add(f.d,'ac-source',100,350),r=M.add(f.d,'resistor',300,350);M.connect(f.d,other.id+':a',r.id+':a');M.connect(f.d,other.id+':b',r.id+':b');const short=M.connect(f.d,f.s.id+':a',f.s.id+':b'),s=new T.Session(f.d);assert.equal(s.state.protection[f.s.id].status,'tripped');s.advance(.25);assert.equal(s.fault,null);assert(Math.abs(s.read().components[other.id].current)>.5);resume(s);f.d.wires=f.d.wires.filter(w=>w.id!==short.id);s.update(f.d);assert.equal(s.state.protection[f.s.id].status,'tripped');assert(s.resetProtection(f.s.id));assert.equal(s.state.protection[f.s.id].status,'normal');resume(s);}
// Reflected short through an ideal transformer also trips before the first step.
{const d=P.create('transformer'),t=d.components[1];M.connect(d,t.id+':c',t.id+':d');const s=new T.Session(d);assert.equal(s.state.protection.c1.reason,'short-circuit');s.advance(.01);assert.equal(s.fault,null);resume(s);}
// Opening a tripped source preserves capacitor energy and permits load discharge.
{const f=load({},0,'capacitor',{capacitance:.02}),r=M.add(f.d,'resistor',300,300,{resistance:12});M.connect(f.d,r.id+':a',f.r.id+':a');M.connect(f.d,r.id+':b',f.r.id+':b');const s=new T.Session(f.d);s.advance(.25);const stored=s.state.dynamic[f.r.id+':a'].v;assert(stored>8);const d=M.clone(s.doc);d.components.find(c=>c.id===f.s.id).params.maxCurrent=.001; // forcing incompatible clamp must diagnose, never erase charge
 s.update(d);close(s.state.dynamic[f.r.id+':a'].v,stored,1e-10);assert.equal(s.state.protection[f.s.id].status,'tripped');assert.equal(s.fault,null);s.advance(.1);close(s.state.dynamic[f.r.id+':a'].v,stored*Math.exp(-.1/.24));resume(s);
}
// Topological short/trip and removing the short never erase inductor current.
{const f=load({maxCurrent:100,maxPower:100},0,'inductor',{inductance:1,resistance:0}),r=M.add(f.d,'resistor',300,300,{resistance:12});M.connect(f.d,r.id+':a',f.r.id+':a');M.connect(f.d,r.id+':b',f.r.id+':b');const s=new T.Session(f.d);s.advance(.25);const i=s.state.dynamic[f.r.id+':a'].i,short=M.connect(f.d,f.s.id+':a',f.s.id+':b');s.update(f.d);close(s.state.dynamic[f.r.id+':a'].i,i,1e-10);assert.equal(s.state.protection[f.s.id].status,'tripped');s.advance(.05);close(s.state.dynamic[f.r.id+':a'].i,i,1e-10);f.d.wires=f.d.wires.filter(w=>w.id!==short.id);s.update(f.d);s.advance(.05);close(s.state.dynamic[f.r.id+':a'].i,i*Math.exp(-12*.05));resume(s);}
// A manual reset and unrelated edits leave another protected source untouched.
{const f=load({maxCurrent:.7,maxPower:100},0,'inductor',{inductance:1,resistance:12,initialCurrent:3}),s=new T.Session(f.d);assert.equal(s.state.protection[f.s.id].status,'limited');assert.equal(s.state.protection[f.s.id].reviewAt,1);const restored=resume(s);s.advance(1);restored.advance(.995);assert.equal(s.state.protection[f.s.id].status,'normal');assert.equal(restored.state.protection[f.s.id].status,'normal');assert.equal(s.fault,null);assert(s.read().measurements[f.s.id].currentRms<.701);}
{const f=load({maxCurrent:.25,maxPower:100}),other=M.add(f.d,'ac-source',100,350,{protectionEnabled:true}),r=M.add(f.d,'resistor',300,350);M.connect(f.d,other.id+':a',r.id+':a');M.connect(f.d,other.id+':b',r.id+':b');const short=M.connect(f.d,other.id+':a',other.id+':b'),s=new T.Session(f.d);s.advance(.05);const before=M.clone(s.state.protection[f.s.id]);f.d.wires=f.d.wires.filter(w=>w.id!==short.id);s.update(f.d);assert.deepEqual(s.state.protection[f.s.id],before);s.resetProtection(other.id);assert.deepEqual(s.state.protection[f.s.id],before);resume(s);}
// Old documents and v2 sessions retain ideal source behavior.
{const f=load({protectionEnabled:false},1);for(const key of ['protectionEnabled','maxCurrent','maxPower'])delete f.s.params[key];const d=D.decode(D.encode(f.d)),s=new T.Session(d);assert.equal(d.components[0].params.protectionEnabled,false);assert.equal(s.capture().version,2);s.advance(.01);assert.equal(s.fault,null);resume(s);}
for(const name of Object.keys(P.names)){const d=P.create(name),source=d.components.find(c=>c.type==='ac-source');if(source)assert.equal(source.params.protectionEnabled,['transformer','coupled'].includes(name));const s=new T.Session(d);s.advance(.005);assert.equal(s.fault,null,name);resume(s);}
assert.equal(P.examples('transformer').initialDocument.components[0].params.protectionEnabled,false);
for(const mutate of [d=>d.components[0].params.maxCurrent=0,d=>d.components[0].params.maxPower=-1,d=>d.components[0].params.protectionEnabled='yes']){const f=load();mutate(f.d);assert.throws(()=>new T.Session(f.d));}
{const s=new T.Session(load().d);for(const mutate of [q=>q.scale=2,q=>q.status='bogus',q=>q.reason='short-circuit',q=>q.extra=true]){const p=s.capture();mutate(p.physics.protection.c1);assert.throws(()=>T.Session.restore(p));}}
console.log('AC source protection: transformer meters, low-frequency RMS/mean power, reactive loads, waveforms, local trip/reset, persistence, legacy and presets passed');
