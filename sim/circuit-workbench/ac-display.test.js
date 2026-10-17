'use strict';
const assert=require('node:assert/strict'),D=require('./circuit-ac-display'),P=require('./circuit-ac-presets'),T=require('./circuit-transient'),M=require('./circuit-model'),V=require('./circuit-renderer');
const cap=M.component(M.empty('transient'),'capacitor',0,0),coil=M.component(M.empty('transient'),'inductor',0,0);
for(const c of [cap,coil]){
 const r={voltage:1e-25,voltagePeak:1e-24,current:-1e-25,currentPeak:1e-24,charge:1e-26,energy:1e-49},before=JSON.stringify(r),v=D.visual(c,r);assert.equal(v.current,0);assert.equal(v.voltage,0);assert.equal(v.energy,0);assert.equal(v.polarity,c.type==='capacitor'?1:-1);assert.equal(JSON.stringify(r),before);
 const svg=V.body(c,v,{view:'real',fields:false,values:true});assert(c.type==='capacitor'?svg.includes('data-capacitor-polarity'):svg.includes('data-field-poles'));assert(svg.includes('data-polarity-active="false"'));assert(!svg.includes('data-field-kind'));
}
const nearCross=V.body(coil,D.visual(coil,{current:1e-8,currentPeak:1}),{view:'real',fields:true}),afterCross=V.body(coil,D.visual(coil,{current:1,currentPeak:1}),{view:'real',fields:true});assert(nearCross.includes('opacity="0"'));assert(nearCross.includes('data-polarity-active="false"'));assert(afterCross.includes('data-polarity-active="true"'));
const charged=D.visual(cap,{voltage:6,voltagePeak:6,current:0,currentPeak:0,charge:.12,energy:.36});assert.equal(charged.voltage,6);assert.equal(charged.charge,.12);assert.equal(charged.current,0);
assert.equal(D.visual(coil,{current:1e-8,currentPeak:1}).fieldCurrent,0);assert.equal(D.visual(coil,{current:1e-8,currentPeak:1}).current,1e-8,'do not erase an AC zero crossing while its window has visible current');
assert.equal(D.visual(cap,{voltage:1e-8,voltagePeak:6,current:0,currentPeak:0}).voltage,1e-8);
assert.equal(D.visual(cap,{voltage:null,current:null,energy:null}).voltage,null);
const smallDischarge={voltage:20e-6,voltagePeak:30e-6,current:-.5e-6,currentPeak:.8e-6,charge:2e-6,energy:2e-11},synchronized=D.visual(cap,smallDischarge);
for(const key of ['current','voltage','fieldVoltage','charge','energy'])assert.equal(synchronized[key],0,'small stored voltage follows the current cutoff');
assert.equal(D.visual(cap,{...smallDischarge,voltage:6,voltagePeak:6,energy:.36}).fieldVoltage,6,'meaningful charge must survive zero displayed current');
assert.equal(D.visual(cap,{...smallDischarge,voltagePeak:null}).voltage,20e-6,'unknown window is not confirmed empty');
assert.equal(D.visual(cap,{...smallDischarge,currentPeak:1}).voltage,20e-6,'an AC crossing is not a discharged capacitor');
{
 const d=M.empty('transient'),c=M.add(d,'capacitor',0,0,{capacitance:.1,initialVoltage:.5}),load=M.add(d,'resistor',200,0,{resistance:1e6});M.connect(d,c.id+':a',load.id+':a');M.connect(d,load.id+':b',c.id+':b');const s=new T.Session(d);s.advance(2);const raw=s.read(),display=V.displayComponent(s.doc,raw,c);assert.equal(display.current,0);assert(display.voltage>.49&&display.fieldVoltage>.49&&display.energy>0,'a slow discharge with meaningful stored voltage keeps its field');
}
const readouts=new D.Readouts(),text=h=>h.match(/class="ac-bar-value">([^<]*)/)[1];
// A shared reference node and zero magnetic coupling do not supply the capacitor.
for(const mode of ['separate','reference-node','zero-coupling','coupled','driven']){
 const d=M.empty('transient'),c=M.add(d,'capacitor',0,0,{capacitance:.2,initialVoltage:.1}),r=M.add(d,'resistor',200,0,{resistance:1e6}),b=M.add(d,'ac-source',600,0,{voltage:1000,frequency:1}),link=(a,b,ap='a',bp='a')=>M.connect(d,a.id+':'+ap,b.id+':'+bp);
 link(c,r);if(['zero-coupling','coupled'].includes(mode)){const t=M.add(d,'transformer',400,0,{model:'coupled',coupling:mode==='coupled'?.5:0});link(r,t,'b','a');link(c,t,'b','b');link(b,t,'a','c');link(b,t,'b','d');}else if(mode==='driven'){link(r,b,'b','a');link(c,b,'b','b');}else{link(c,r,'b','b');if(mode==='reference-node')link(c,b,'b','b');}
 const s=new T.Session(d);s.advance(2);assert.equal(s.fault,null,mode);const raw=s.read(),saved=JSON.stringify(s.capture()),view=V.displayComponent(s.doc,raw,c),related=['coupled','driven'].includes(mode);assert.equal(raw.measurements[c.id].voltageReference,related?1000*Math.SQRT2:0,mode);
 if(!related){assert(raw.components[c.id].voltage>.099);assert.equal(view.voltage,raw.components[c.id].voltage,mode);assert.equal(view.charge,raw.components[c.id].charge,mode);assert.equal(view.energy,raw.components[c.id].energy,mode);assert(view.fieldVoltage>0,mode);}
 assert.equal(JSON.stringify(s.capture()),saved,'display does not change saved physics');
}
const a=readouts.html(coil,'current',.12,'A',{paused:false,now:0}),b=readouts.html(coil,'current',.23,'A',{paused:false,now:100}),c=readouts.html(coil,'current',-.23,'A',{paused:false,now:250});assert.equal(text(a),text(b));assert.notEqual(text(a),text(c));assert(c.includes('negative'));assert(!text(c).includes('−'));assert.equal(text(c).split(' ').at(-1),text(a).split(' ').at(-1));assert(!/[eE][+-]?\d/.test(text(c)));
assert(text(readouts.html(coil,'current',-.23,'A',{paused:true,now:251})).startsWith('-'));assert(text(readouts.html(coil,'current',0,'A',{paused:false,now:252})).includes('0'));readouts.clear();assert.equal(readouts.states.size,0);
// Exercise the actual preset, including switching to a discharge-only circuit.
const doc=P.create('rc'),session=new T.Session(doc),capacitor=doc.components.find(c=>c.type==='capacitor'),sw=doc.components.find(c=>c.type==='spdt'),lamp=doc.components.find(c=>c.type==='lamp');assert.equal(capacitor.params.capacitance*lamp.params.resistance,2);
const on=M.clone(doc);on.components.find(c=>c.id===sw.id).params.closed='b';session.update(on);session.advance(6);const u0=session.read().components[capacitor.id].voltage;const off=M.clone(on);off.components.find(c=>c.id===sw.id).params.closed='c';session.update(off);
let at=0;for(const t of [2,6,10,20,40]){session.advance(t-at);at=t;const r=session.read().components[capacitor.id];assert(Math.abs(r.voltage-u0*Math.exp(-t/2))<1e-6);assert(Math.abs(r.current+r.voltage/20)<1e-10);}
const analysis=session.read(),saved=JSON.stringify(session.capture()),view=V.displayComponent(session.doc,analysis,capacitor);assert(analysis.components[capacitor.id].voltage>0);assert.equal(view.voltage,0);assert.equal(view.current,0);assert.equal(view.charge,0);assert.equal(JSON.stringify(session.capture()),saved);
// Test the first invisible current, not a much later residual voltage cutoff.
for(const polarity of [1,-1]){
 const d=M.clone(off);d.components.find(c=>c.id===capacitor.id).params.initialVoltage=6*polarity;
 const s=new T.Session(d),baselines=new Map();let previous=null,found=false;
 for(let n=0;n<256;n++){
  const raw=s.read(),refs=V.flowReferences(s.doc,raw,baselines),r=raw.components[capacitor.id],display=V.displayComponent(s.doc,raw,capacitor,refs);
  if(display.current===0){assert(previous&&previous.current!==0);assert(Math.abs(r.voltage)>1e-6&&Math.abs(r.current)>0);for(const key of ['voltage','fieldVoltage','charge','energy'])assert.equal(display[key],0);const checkpoint=s.capture();D.visual(capacitor,r,{doc:s.doc,result:raw,references:refs});assert.deepEqual(s.capture(),checkpoint);const restored=T.Session.restore(checkpoint);s.advance(.125);restored.advance(.125);assert(Math.abs(s.read().components[capacitor.id].voltage-restored.read().components[capacitor.id].voltage)<1e-12);found=true;break;}
  previous=display;s.advance(.125);
 }
 assert(found,'both discharge polarities must reach the synchronized display cutoff');
}
console.log('AC display: signed bars, stable units/throttled numerals, polarity independent of fields, window-aware tails/zero crossings, charged capacitor at I=0 and actual 2 s RC decay passed');

// A per-coil peak calibrates small starts but must not shrink during discharge.
{const F=require('./circuit-field-graphics'),T=require('./circuit-transient'),M=require('./circuit-model');
 for(const initial of [.5,.001]){const doc=M.empty('transient'),c=M.add(doc,'inductor',200,200,{inductance:1,resistance:0,initialCurrent:initial}),resistor=M.add(doc,'resistor',400,200,{resistance:2});M.connect(doc,c.id+':a',resistor.id+':a');M.connect(doc,c.id+':b',resistor.id+':b');const session=new T.Session(doc),baselines=new Map(),before=session.capture();
  for(const [time,expected]of [[0,25],[.5*Math.log(2),13],[.5*Math.log(10),3],[.5*Math.log(100),1]]){session.advance(time-session.state.time);const raw=session.read(),refs=V.flowReferences(doc,raw,baselines),display=V.displayComponent(doc,raw,c,refs),f=F.inductor(c,display),count=(f.front.match(/data-field-line="inside"/g)||[]).length;assert(Math.abs(refs.get('field:'+c.id)-initial)<1e-12);if(display.fieldCurrent===0)assert.equal(count,0);else{assert(count>=1);assert(Math.abs(count-expected)<=1,'rounding a line count allows either side of a half-line boundary');}assert.equal(raw.reliable,true);}
  const held=new Map(baselines),preview=M.clone(doc);preview.components[0].params.initialCurrent=10;const p=new T.Session(preview);V.flowReferences(preview,p.read(),new Map(baselines));assert.deepEqual(baselines,held,'preview cannot change the formal scale');assert.deepEqual(before,T.Session.restore(before).capture());
  const other=M.add(doc,'inductor',700,200,{initialCurrent:1000});V.flowReferences(doc,session.read(),baselines);assert.equal(baselines.get('field:'+c.id).peak,initial,'unrelated coil cannot enlarge this scale');assert.equal(baselines.get('field:'+other.id).peak,1000);
 }
 console.log('Proportional magnetic density: approximately linear line counts, tiny initial calibration, decay/preview isolation and independent coils passed.');}

{const c=M.component(M.empty('transient'),'ac-ammeter',0,0),b=new D.Readouts(),html=b.html(c,'meterReadingRms',3e-12,'A',{preserveTiny:true,result:{range:1},paused:true});assert(!html.includes('≈0')&&html.includes('unsigned')&&html.includes('aria-valuemax="1"'),'a measured tiny signal remains readable in its own instrument range');}
