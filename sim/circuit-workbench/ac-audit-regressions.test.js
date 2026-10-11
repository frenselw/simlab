'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),T=require('./circuit-transient'),S=require('./circuit-solver'),O=require('./circuit-observation');
const failures=[];
function test(name,run){try{run();console.log('✓ '+name);}catch(error){failures.push(error);console.error('✗ '+name+': '+error.message);}}
const close=(a,b,relative=.001,absolute=1e-10)=>assert(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(absolute,Math.abs(b)*relative),`${a} != ${b}`);
const link=(d,a,b,ap='a',bp='a')=>M.connect(d,a.id+':'+ap,b.id+':'+bp);
function independent(){const d=M.empty('transient'),groups=[];for(const frequency of [1,.1]){const source=M.add(d,'ac-source',100,100,{frequency}),load=M.add(d,'resistor',260,100,{resistance:12}),meter=M.add(d,'ac-voltmeter',420,100);link(d,source,load);link(d,source,load,'b','b');link(d,source,meter);link(d,source,meter,'b','b');groups.push({source,load,meter});}return {d,groups};}
test('CW-01: each independent frequency owns its complete RMS/peak/power window',()=>{
 const {d,groups}=independent(),s=new T.Session(d);s.advance(1.1);let a=s.read();assert.equal(a.measurements[groups[0].meter.id].status,'ready');assert.equal(a.measurements[groups[1].meter.id].status,'collecting');assert.equal(a.components[groups[1].meter.id].reading,null);
 s.advance(10.9);a=s.read();for(const {meter,load,source}of groups){const q=a.measurements[meter.id];assert.equal(q.status,'ready');assert.equal(q.window,1/source.params.frequency);assert.equal(q.windowKind,'cycle');close(a.components[meter.id].reading,6);close(q.voltagePeak,6*Math.SQRT2,.002);close(a.measurements[load.id].averagePower,3);}
 const changed=M.clone(s.doc);changed.components.find(c=>c.id===groups[0].source.id).params.frequency=2;s.update(changed);assert.equal(s.read().measurements[groups[0].meter.id].status,'collecting');assert.equal(s.read().measurements[groups[1].meter.id].status,'ready');
 const before=JSON.stringify(s.read().measurements);const preview=M.clone(changed);preview.components.find(c=>c.id===groups[1].source.id).params.frequency=.2;s.preview(preview);assert.equal(JSON.stringify(s.read().measurements),before);
 const physics=s.capture().physics,reordered=M.clone(s.doc);reordered.components.reverse();reordered.wires.reverse();assert.equal(s.update(reordered),'geometry');assert.deepEqual(s.capture().physics,physics);assert.deepEqual(s.read().measurements,JSON.parse(before));
 for(const variant of ['reordered','added','removed']){const copy=M.clone(d);if(variant==='reordered')copy.components.reverse();if(variant==='added')M.add(copy,'ac-source',800,800,{frequency:2});if(variant==='removed'){const ids=new Set([groups[0].source.id,groups[0].load.id,groups[0].meter.id]);copy.components=copy.components.filter(c=>!ids.has(c.id));copy.wires=copy.wires.filter(w=>!ids.has(w.from.split(':')[0])&&!ids.has(w.to.split(':')[0]));}const other=new T.Session(copy);other.advance(12);const q=other.read().measurements[groups[1].meter.id];assert.equal(q.window,10);close(q.voltageRms,6);}
});
function mixed(frequency){const d=M.empty('transient'),a=M.add(d,'ac-source',100,100,{frequency:1}),b=M.add(d,'ac-source',260,100,{frequency}),r=M.add(d,'resistor',420,100,{resistance:12});link(d,a,b,'b','a');link(d,a,r);link(d,b,r,'b','b');return {d,r};}
test('CW-01: commensurate mixed sources use their actual common period',()=>{
 const {d,r}=mixed(.15),s=new T.Session(d);s.advance(7);assert.equal(s.read().measurements[r.id].status,'collecting');s.advance(14);const q=s.read().measurements[r.id];assert.equal(q.window,20);assert.equal(q.windowKind,'common-cycle');close(q.voltageRms,6*Math.SQRT2,.002);close(q.averagePower,6,.003);
});
test('CW-01: a specified mixed-frequency window is labelled and matches its finite-window integral',()=>{
 const f=Math.SQRT2,{d,r}=mixed(f),s=new T.Session(d);s.advance(12);const q=s.read().measurements[r.id],a=2*Math.PI,b=a*f,start=q.start,end=q.end,span=q.window;
 const square=w=>span/2-(Math.sin(2*w*end)-Math.sin(2*w*start))/(4*w),cross=(Math.sin((a-b)*end)-Math.sin((a-b)*start))/(2*(a-b))-(Math.sin((a+b)*end)-Math.sin((a+b)*start))/(2*(a+b));
 assert.equal(q.windowKind,'time');assert.equal(q.period,null);assert.equal(s.compiled.period,null);assert.equal(span,10);close(q.voltageRms,Math.sqrt(72*(square(a)+square(b)+2*cross)/span),.002);
});
test('CW-01: an unrelated source cannot change ideal-transformer magnetic-flux observation',()=>{
 const d=M.empty('transient'),transformers=[];for(const frequency of [1,.1]){const source=M.add(d,'ac-source',100,100,{frequency}),t=M.add(d,'transformer',300,100);link(d,source,t);link(d,source,t,'b','b');transformers.push({source,t});}
 const s=new T.Session(d);s.advance(12);for(const {source,t}of transformers){const r=s.read().components[t.id],peak=6*Math.SQRT2/(2*Math.PI*source.params.frequency*t.params.primaryTurns);assert.equal(r.coreFluxStatus,'ready');close(r.coreFlux,-peak*Math.cos(2*Math.PI*source.params.frequency*s.state.time),.002);close(r.coreFluxPeak,peak,.002);}
});
test('CW-01: an unrelated AC island cannot change DC short-window overload evidence',()=>{
 for(const withAC of [false,true])for(const type of ['lamp','resistor']){
  const d=M.empty('transient'),source=M.add(d,'battery',100,100,{voltage:type==='lamp'?6*Math.sqrt(2*S.hazardLimits.lampRatio):6}),load=M.add(d,type,260,100,type==='lamp'?{resistance:12,ratedVoltage:6}:{resistance:.1}),top=link(d,source,load);link(d,source,load,'b','b');
  if(withAC){const ac=M.add(d,'ac-source',500,300,{frequency:.1}),r=M.add(d,'resistor',700,300);link(d,ac,r);link(d,ac,r,'b','b');}
  const s=new T.Session(d);s.advance(.05);assert.equal(s.fault,null);if(type==='lamp')assert.equal(s.read().hazards.components[load.id],'overload');else assert.equal(s.read().hazards.wires[top.id],'overload');
 }
});
function discharge(resistance=.00001){const d=M.empty('transient'),c=M.add(d,'capacitor',100,100,{capacitance:.0001,initialVoltage:6}),wire=link(d,c,c,'a','b');wire.resistance=resistance;return {d,c,wire};}
test('CW-03: full Session resolves legal fast RC discharge and conserves physical energy',()=>{
 const {d,c}=discharge(),s=new T.Session(d),initial=s.read().energy;s.advance(1e-9);assert.equal(s.fault,null);close(s.read().components[c.id].voltage,6/Math.E,.002,1e-5);s.advance(.001);assert.equal(s.fault,null);close(s.read().energy+s.read().dissipatedEnergy,initial,.001,1e-12);assert.equal(s.read().energyBalance.status,'reliable');assert(s.read().dissipatedEnergy<.001802);
 const restored=T.Session.restore(s.capture());restored.advance(.001);assert.equal(restored.fault,null);close(restored.read().energy+restored.read().dissipatedEnergy,initial,.001,1e-12);
});
test('CW-03: passive fast RC energy converges under smaller initial time steps',()=>{
 const {d}=discharge();const errors=[.04,.02,.01].map(factor=>{const s=new T.Session(d),initial=s.read().energy;s.compiled.maxStep=1e-9*factor;s.state.step=Math.min(s.state.step,s.compiled.maxStep/8);s.advance(2e-8);assert.equal(s.fault,null);return Math.abs(s.read().energy+s.read().dissipatedEnergy-initial);});assert(errors.every(e=>e<1.8e-6));assert(errors[2]<=errors[0]+1e-12);
});
test('CW-03: an unresolved time scale produces a visible fault rather than fabricated energy',()=>{
 const s=new T.Session(discharge(1e-10).d);s.advance(.001);assert.equal(s.fault,'time-resolution');assert.equal(s.read().reliable,false);assert(s.read().diagnostics.some(d=>d.code==='time-resolution'));assert.equal(s.read().dissipatedEnergy,null);
 const restored=T.Session.restore(s.capture());assert.equal(restored.fault,'time-resolution');const repaired=M.clone(restored.doc);repaired.wires[0].resistance=1;restored.update(repaired);restored.advance(.001);assert.equal(restored.fault,null);close(restored.read().energy+restored.read().dissipatedEnergy,.0018,.001);
});
test('CW-03: a numerical fault cannot present earlier complete measurements as normal current results',()=>{
 const {d,groups}=independent(),s=new T.Session(d);s.advance(2);assert(s.read().components[groups[0].meter.id].reading>5.99);s.state.step=5e-14;s.advance(.001);assert.equal(s.fault,'time-resolution');assert.equal(s.read().measurements[groups[0].meter.id].status,'unknown');assert.equal(s.read().components[groups[0].meter.id].reading,null);assert.equal(s.read().components[groups[0].meter.id].meterStatus,'unknown');
});
test('CW-03: fast RL decay and resistance-switch events keep stored energy and physical loss balanced',()=>{
 const d=M.empty('transient'),l=M.add(d,'inductor',100,100,{inductance:.001,resistance:0,initialCurrent:1}),w=link(d,l,l,'a','b');w.resistance=10000;const s=new T.Session(d),initial=s.read().energy;s.advance(1e-7);assert.equal(s.fault,null);close(s.read().components[l.id].current,1/Math.E,.002);s.advance(.001);close(s.read().energy+s.read().dissipatedEnergy,initial,.001);
 const {d:rc}=discharge(10),switched=new T.Session(rc);switched.advance(.0001);const before=switched.capture(),next=M.clone(rc);next.wires[0].resistance=.00001;switched.update(next);assert.equal(switched.state.dynamic['c1:a'].v,before.physics.dynamic['c1:a'].v);switched.advance(.001);assert.equal(switched.fault,null);close(switched.read().energy+switched.read().dissipatedEnergy,.0018,.001);
});
test('CW-03: parallel ideal-source ambiguity does not erase identifiable total source energy',()=>{
 const d=M.empty('transient'),a=M.add(d,'ac-source',100,100),b=M.add(d,'ac-source',260,100),r=M.add(d,'resistor',420,100);for(const component of [b,r])for(const p of ['a','b'])link(d,a,component,p,p);const s=new T.Session(d);s.advance(2);assert.equal(s.fault,null);assert.equal(s.read().components[a.id].current,null);assert.equal(s.read().energyBalance.status,'reliable');close(s.read().sourceWork,s.read().dissipatedEnergy,1e-9,1e-10);close(s.read().measurements[r.id].voltageRms,6);
 const snapshot=s.capture();snapshot.physics.dissipated+=1;const invalid=T.Session.restore(snapshot);assert.equal(invalid.fault,'energy-balance');assert.equal(invalid.read().dissipatedEnergy,null);
});
test('CW-03: constrained ideal-source capacitor derivatives remain valid at nonzero phase and waveform corners',()=>{
 for(const waveform of ['sine','triangle'])for(const phase of [0,45,90]){
  const d=M.empty('transient'),source=M.add(d,'ac-source',100,100,{waveform,phase,frequency:1}),angle=phase*Math.PI/180,initial=waveform==='sine'?6*Math.SQRT2*Math.sin(angle):6*Math.sqrt(3)*2/Math.PI*Math.asin(Math.sin(angle)),cap=M.add(d,'capacitor',300,100,{capacitance:.01,initialVoltage:initial});link(d,source,cap);link(d,source,cap,'b','b');const s=new T.Session(d);assert.equal(s.fault,null);
  const expected=waveform==='sine'?.01*6*Math.SQRT2*2*Math.PI*Math.cos(angle):.01*24*Math.sqrt(3)*(phase<90?1:-1);close(s.read().components[cap.id].current,expected,1e-8,1e-10);
  const snapshot=s.capture();snapshot.physics.dynamic[cap.id+':a'].i=0;const legacy=T.Session.restore(snapshot);assert.deepEqual(legacy.capture(),snapshot);legacy.advance(.375);assert.equal(legacy.fault,null);
  s.advance(2);assert.equal(s.fault,null);assert.equal(s.read().energyBalance.status,'reliable');close(s.read().measurements[cap.id].voltageRms,6,.003);const restored=T.Session.restore(s.capture());restored.advance(.125);assert.equal(restored.fault,null);
 }
});
test('CW-03: passive fast equilibria remain legal, including an unrelated changing AC island',()=>{
 for(const initialVoltage of [0,6]){const {d,c}=discharge(1e-10);c.params.initialVoltage=initialVoltage;if(initialVoltage){const battery=M.add(d,'battery',300,100,{voltage:6});link(d,c,battery);link(d,c,battery,'b','b');}const ac=M.add(d,'ac-source',600,400),r=M.add(d,'resistor',800,400);link(d,ac,r);link(d,ac,r,'b','b');const s=new T.Session(d);s.advance(.1);assert.equal(s.fault,null);close(s.read().components[c.id].voltage,initialVoltage);const initial=s.capture();assert.deepEqual(T.Session.restore(initial).capture(),initial);}
 const empty=new T.Session(M.empty('transient')),snapshot=empty.capture();snapshot.physics.time=1e9;const late=T.Session.restore(snapshot),result=late.advance(1e-12);assert.equal(late.fault,'time-resolution');assert.equal(result.complete,false);
});
test('CW-04: both cut directions preserve 6 pA and agree with component/probe currents',()=>{
 const d=M.empty('transient'),source=M.add(d,'battery',100,100,{voltage:6}),r=M.add(d,'resistor',260,100,{resistance:.01}),v=M.add(d,'ac-voltmeter',420,100,{resistance:1e12});link(d,source,r);link(d,source,r,'b','b');const top=link(d,source,v),bottom=link(d,source,v,'b','b');
 for(const reversed of [false,true]){if(reversed){[top.from,top.to]=[top.to,top.from];[bottom.from,bottom.to]=[bottom.to,bottom.from];}const out=new T.Session(d).read(),expected=6e-12*(reversed?-1:1);close(out.components[v.id].current,6e-12,1e-9,1e-20);close(out.wires[top.id].current,expected,1e-9,1e-20);close(out.wires[bottom.id].current,-expected,1e-9,1e-20);const tool={kind:'current',probes:[{target:{kind:'wire',id:top.id,fraction:.5}}]};close(O.signal(tool,out,d),expected,1e-9,1e-20);}
 const dc=M.clone(d);dc.version=6;delete dc.analysis;delete dc.modelRevision;v.type='voltmeter';dc.components.find(c=>c.id===v.id).type='voltmeter';dc.components.find(c=>c.id===v.id).params=require('./component-registry').defaults('voltmeter');dc.components.find(c=>c.id===v.id).params.resistance=1e12;close(S.solve(dc).wires[top.id].current,-6e-12,1e-9,1e-20);
});
if(failures.length)throw new AggregateError(failures,'AC audit regressions: '+failures.length+' failed');
