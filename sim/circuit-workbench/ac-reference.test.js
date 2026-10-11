'use strict';
// Independent sinusoidal phasors and exponential transients. No solver output
// is used to construct an expected result. PhET's source uses peak volts;
// this workbench's source uses RMS volts.
const assert=require('node:assert/strict');
const M=require('./circuit-model'),T=require('./circuit-transient'),O=require('./circuit-observation');
require('./circuit-ac-components');
const rows=[];let checks=0;
function close(actual,expected,label,relative=.003,absolute=1e-7){
  assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(absolute,Math.abs(expected)*relative),`${label}: ${actual} versus ${expected}`);checks++;
}
function board(){const doc=M.empty('transient');doc.cables.count=40;doc.cables.length=1200;return {doc,add:(type,params={})=>M.add(doc,type,120+doc.components.length*150,260,params),link:(a,ap,b,bp)=>M.connect(doc,a.id+':'+ap,b.id+':'+bp)};}
function measuredSeries({name,peak=9,frequency=.5,resistance=10,capacitance=0,inductance=0,waveform='sine',ammeterResistance=0,wattResistance=0}){
  const f=board(),omega=2*Math.PI*frequency,reactance=omega*inductance-(capacitance?1/(omega*capacitance):0),totalR=resistance+ammeterResistance+wattResistance,den=totalR**2+reactance**2,rms=peak/Math.sqrt(2);
  const source=f.add('ac-source',{voltage:rms,frequency,waveform}),w=f.add('ac-wattmeter',{range:1000,resistance:wattResistance}),a=f.add('ac-ammeter',{range:100,resistance:ammeterResistance}),r=f.add('resistor',{resistance}),v=f.add('ac-voltmeter',{range:1000});
  f.link(source,'a',w,'a');f.link(w,'b',a,'a');f.link(a,'b',r,'a');let end=r;
  let cap,ind;
  if(capacitance){cap=f.add('capacitor',{capacitance,initialVoltage:-peak*totalR/(den*omega*capacitance)});f.link(end,'b',cap,'a');end=cap;}
  if(inductance){ind=f.add('inductor',{inductance,resistance:0,initialCurrent:-peak*reactance/den});f.link(end,'b',ind,'a');end=ind;}
  f.link(end,'b',source,'b');f.link(v,'a',r,'a');f.link(v,'b',source,'b');f.link(w,'c',r,'a');f.link(w,'d',source,'b');
  const session=new T.Session(f.doc),period=1/frequency;
  session.advance(2*period);assert.equal(session.fault,null);checks++;
  const read=session.read(),expectedI=rms/Math.sqrt(den),expectedV=expectedI*Math.hypot(resistance,reactance),expectedP=expectedI**2*resistance;
  for(const [id,expected,label]of [[a.id,expectedI,'A RMS'],[v.id,expectedV,'V RMS'],[w.id,expectedP,'W real power']])close(read.components[id].reading,expected,name+' '+label);
  let maxError=0;
  for(let n=0;n<32;n++){
    session.advance(period/32);const now=session.read(),theta=omega*now.time;
    const expected=peak*(totalR*Math.sin(theta)-reactance*Math.cos(theta))/den;
    maxError=Math.max(maxError,Math.abs(now.components[a.id].current-expected));
    close(now.components[a.id].current,expected,name+' instantaneous I',0,Math.max(1e-7,expectedI*.004));
    const probe={kind:'current',probes:[{target:{kind:'component',id:a.id}}]};
    close(O.signal(probe,now,f.doc),expected,name+' current probe',0,Math.max(1e-7,expectedI*.004));
  }
  rows.push({name,peak,frequency,resistance,capacitance,inductance,expectedI,actualI:read.components[a.id].reading,expectedV,actualV:read.components[v.id].reading,expectedP,actualP:read.components[w.id].reading,phaseDegrees:-Math.atan2(reactance,totalR)*180/Math.PI,maxInstantaneousError:maxError});
}
for(const frequency of [.1,.5,1,2,50])for(const [name,capacitance,inductance]of [['R',0,0],['RC',.1,0],['RL',0,1],['RLC',.1,1]])measuredSeries({name:name+' '+frequency+' Hz',frequency,capacitance,inductance});
measuredSeries({name:'R 40 ohm',resistance:40});
measuredSeries({name:'PhET RL 5 H',inductance:5});
measuredSeries({name:'PhET RLC 5 H',inductance:5,capacitance:.1});
measuredSeries({name:'R with meter burden',ammeterResistance:2,wattResistance:3});

// Finite voltmeter input resistance loads the circuit; ideal input does not.
for(const inputResistance of [0,100]){
  const f=board(),s=f.add('ac-source',{voltage:6,frequency:1,resistance:10}),r=f.add('resistor',{resistance:100}),v=f.add('ac-voltmeter',{resistance:inputResistance});
  f.link(s,'a',r,'a');f.link(s,'b',r,'b');f.link(v,'a',r,'a');f.link(v,'b',r,'b');
  const session=new T.Session(f.doc);session.advance(2);const load=inputResistance?50:100;
  close(session.read().components[v.id].reading,6*load/(load+10),'voltmeter loading');
}

// G is a signed instantaneous instrument with a real 100-ohm burden.
for(const reverse of [false,true]){
  const f=board(),s=f.add('ac-source',{voltage:.003,frequency:1}),g=f.add('galvanometer',{resistance:100,range:50e-6});
  f.link(s,'a',g,reverse?'b':'a');f.link(s,'b',g,reverse?'a':'b');const session=new T.Session(f.doc);
  for(let n=0;n<8;n++){session.advance(.125);close(session.read().components[g.id].reading,(reverse?-1:1)*.003*Math.sqrt(2)/100*Math.sin(2*Math.PI*session.state.time),'G signed current',0,1e-10);}
}

// Charge and current continuity at ordinary RC / RL switch events.
for(const type of ['capacitor','inductor']){
  const f=board(),s=f.add('battery',{voltage:9}),r=f.add('resistor',{resistance:10}),x=f.add(type,type==='capacitor'?{capacitance:.1}:{inductance:5,resistance:0});
  f.link(s,'a',r,'a');f.link(r,'b',x,'a');f.link(x,'b',s,'b');const session=new T.Session(f.doc),tau=type==='capacitor'?1:.5;
  for(const multiple of [.25,.5,1,2,5]){session.advance(multiple*tau-session.state.time);const actual=session.read().components[x.id][type==='capacitor'?'voltage':'current'];close(actual,(type==='capacitor'?9:.9)*(1-Math.exp(-multiple)),type+' step response');}
}

// Transformer voltage, primary/secondary currents and real power at three ratios.
for(const ratio of [.25,.5,2]){
  const f=board(),s=f.add('ac-source',{voltage:6,frequency:1}),t=f.add('transformer',{primaryTurns:200,secondaryTurns:200*ratio}),r=f.add('resistor',{resistance:12});
  f.link(s,'a',t,'a');f.link(s,'b',t,'b');f.link(t,'c',r,'a');f.link(t,'d',r,'b');const session=new T.Session(f.doc);session.advance(3);const out=session.read();
  close(out.measurements[r.id].voltageRms,6*ratio,'transformer secondary RMS');close(out.measurements[r.id].currentRms,ratio/2,'transformer secondary I');close(out.measurements[t.id].currentRms,ratio**2/2,'transformer primary I');close(out.measurements[r.id].averagePower,3*ratio**2,'transformer output power');
  assert.equal(out.voltage(t.id+':a',t.id+':c'),null);checks++;
}

// Linear coupled coils: solve the two complex impedance equations independently.
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],div=(a,b)=>{const d=b[0]**2+b[1]**2;return [(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];};
for(const frequency of [.5,2,50])for(const coupling of [.8,.99]){
  const omega=2*Math.PI*frequency,L1=2,L2=.5,mutual=coupling*Math.sqrt(L1*L2),secondary=[12.25,omega*L2],reflected=div([omega**2*mutual**2,0],secondary),primary=[1+reflected[0],omega*L1+reflected[1]],I1=div([6,0],primary),I2=div(mul([0,-omega*mutual],I1),secondary);
  const f=board(),s=f.add('ac-source',{voltage:6,frequency}),t=f.add('transformer',{model:'coupled',primaryTurns:200,secondaryTurns:100,inductance:L1,coupling,primaryResistance:1,secondaryResistance:.25,initialPrimaryCurrent:Math.SQRT2*I1[1],initialSecondaryCurrent:Math.SQRT2*I2[1]}),r=f.add('resistor',{resistance:12});
  f.link(s,'a',t,'a');f.link(s,'b',t,'b');f.link(t,'c',r,'a');f.link(t,'d',r,'b');const session=new T.Session(f.doc);session.advance(3/frequency);const out=session.read();
  assert.equal(session.fault,null);checks++;close(out.measurements[t.id].currentRms,Math.hypot(...I1),'coupled primary I');close(out.measurements[r.id].currentRms,Math.hypot(...I2),'coupled secondary I');close(out.measurements[r.id].averagePower,12*Math.hypot(...I2)**2,'coupled output power');
}

// Prescribed-rotation generator: Faraday's law and the load/internal-resistance split.
for(const frequency of [.5,1,2]){
  const f=board(),g=f.add('generator',{frequency,field:.2,area:.02,turns:200,resistance:1}),r=f.add('resistor',{resistance:10});f.link(g,'a',r,'a');f.link(g,'b',r,'b');const session=new T.Session(f.doc);
  for(let n=0;n<8;n++){session.advance(1/(frequency*8));const theta=2*Math.PI*frequency*session.state.time,out=session.read().components[g.id],emf=200*.2*.02*2*Math.PI*frequency*Math.sin(theta);close(out.sourceEmf,emf,'generator emf',0,1e-8);close(out.flux,.2*.02*Math.cos(theta),'generator flux',0,1e-10);close(session.read().components[r.id].current,emf/11,'generator load current',0,1e-8);}
}

console.log('Independent AC references: '+checks+' checks across '+rows.length+' metered phasor circuits, input loading, signed G, transients, transformer ratios and generator Faraday law passed');
if(process.argv.includes('--json'))console.log(JSON.stringify({checks,rows},null,2));
