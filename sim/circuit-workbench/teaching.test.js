'use strict';
const assert=require('node:assert/strict'),{XMLValidator}=require('fast-xml-parser');
const M=require('./circuit-model'),R=require('./component-registry'),S=require('./circuit-solver'),D=require('./circuit-document'),V=require('./circuit-renderer'),G=require('./circuit-routing'),P=require('./presets'),T=require('../../tools/circuit-textbook-cases');
let cases=0;
const near=(actual,expected,message,tolerance=1e-8)=>assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${message}: ${actual} != ${expected}`);
const circuit=parts=>T.circuit(parts).doc;
const device=(key,type,ports,params)=>({key,type,ports,params});
function energy(d){const s=S.solve(d);near(Object.values(s.components).reduce((total,r)=>total+r.power,0),0,'power conservation');assert(s.residual<1e-8);return s;}
function restoredContinuation(d,fn){const restored=D.decode(D.encode(d));assert.deepEqual(restored,d);fn(restored);M.validate(restored);S.solve(restored);D.decode(D.encode(restored));cases++;}

// Terminal selection changes exposed geometry only; each retained connection is explicit.
for(const terminals of [4,3,2])for(const position of [0,.1,.5,.9,1]){
  const d=circuit([device('E','battery',{a:'p',b:'n'},{voltage:6,resistance:2}),device('R','rheostat',{a:'p',b:'q'},{terminals,resistance:20,position}),device('load','resistor',{a:'q',b:'n'},{resistance:12})]),s=energy(d),r=d.components[1];
  near(s.components[r.id].current,6/(14+20*position),'limiting current');assert.equal(R.ports(r).length,terminals);
  restoredContinuation(d,doc=>doc.components[1].params.position=position<.5?.75:.25);
}
for(const terminals of [4,3])for(const position of [0,.1,.5,.9,1])for(const load of [null,10,1000]){
  const parts=[device('E','battery',{a:'p',b:'n'},{voltage:6,resistance:0}),device('R','rheostat',{a:'p',b:'m',c:'n',...(terminals===4?{d:'m2'}:{})},{terminals,resistance:100,position}),...(load?[device('load','resistor',{a:terminals===4?'m2':'m',b:'n'},{resistance:load})]:[])];
  const d=circuit(parts),s=energy(d),lower=100*(1-position),parallel=load?lower*load/(lower+load):lower,expected=parallel===0?0:6*parallel/(100*position+parallel);
  near(s.voltage('c2:b','c1:b'),expected,'loaded divider follows actual circuit');if(terminals===4)near(s.voltage('c2:b','c2:d'),0,'both slider posts are equipotential');
  near(s.components.c1.current,parallel===0?-.06:-6/(100*position+parallel),'divider source current');
  restoredContinuation(d,doc=>doc.components[1].params.position=position===.5?.7:.5);
}
for(const position of [0,.5,1]){
  const d=circuit([device('E','battery',{a:'p',b:'n'},{voltage:6,resistance:0}),device('R','rheostat',{a:'p',c:'n'},{resistance:100,position,terminals:4})]);near(energy(d).components.c1.current,-.06,'A–B ignores slider position');cases++;
}
for(const resistance of [0,1]){
  const d=circuit([device('E','battery',{a:'p',b:'n'},{voltage:6,resistance}),device('R','rheostat',{b:'p',d:'n'},{resistance:100,position:.5,terminals:4})]),s=S.solve(d);
  if(resistance===0){assert(s.diagnostics.some(d=>d.code==='inconsistent'));assert.equal(s.components.c1.current,null);}else near(s.components.c1.current,-6,'two slider posts short a finite source');
  restoredContinuation(d,doc=>doc.components[0].params.resistance=2);
}
const switched=P.create('divider'),history=M.history(switched),initial=D.encode(history.get()),rId=switched.components[1].id,hidden=switched.wires.find(w=>w.from===rId+':c'||w.to===rId+':c');
history.change(doc=>M.setTerminals(doc,rId,3));assert.equal(R.ports(history.get().components[1]).length,3);near(S.solve(history.get()).components.c4.reading,S.solve(switched).components.c4.reading,'four to three keeps P1');
history.change(doc=>M.setTerminals(doc,rId,2));const after=history.get(),unplugged=after.wires.find(w=>w.id===hidden.id);assert(![unplugged.from,unplugged.to].includes(rId+':c'));assert.equal(after.wires.length,switched.wires.length);assert.equal(R.ports(after.components[1]).length,2);assert(after.junctions.some(j=>[unplugged.from,unplugged.to].includes(j.id+':p')),'hidden post leaves a physical free end');
history.undo();history.undo();assert.equal(D.encode(history.get()),initial);history.redo();restoredContinuation(history.get(),doc=>M.setTerminals(doc,rId,4));
assert.throws(()=>history.change(doc=>M.setTerminals(doc,rId,5)));const fixed=M.history(switched);fixed.change(d=>d.policy.mode='wiring');assert.throws(()=>fixed.change(d=>M.setTerminals(d,rId,3)));cases++;

// Legacy files preserve the old AP circuit, physical endpoints and pure-radiation lamp law.
for(const version of [1,2,3,4]){
  const old=P.create('ohm');old.version=version;if(old.cables)delete old.cables.resistance;old.wires.forEach(w=>delete w.resistance);delete old.components[2].params.terminals;
  if(version<3){delete old.cables;old.wires.forEach(w=>delete w.length);}if(version===1)old.wires.forEach(w=>{delete w.shape;w.via=[];});
  const saved=D.decode(JSON.stringify(old));assert.equal(saved.components[2].params.terminals,2);near(S.solve(saved).components.c2.reading,.5,'legacy two-post semantics');restoredContinuation(saved,doc=>M.setTerminals(doc,'c3',4));
}
const oldLamp=P.create('series');oldLamp.components[2].params.model='thermal';delete oldLamp.components[2].params.coldRatio;delete oldLamp.components[2].params.linearLoss;
const migratedLamp=D.decode(JSON.stringify(oldLamp));assert.equal(migratedLamp.components[2].params.linearLoss,0);assert.equal(migratedLamp.components[2].params.coldRatio,10);restoredContinuation(migratedLamp,doc=>doc.components[2].params.linearLoss=.1);

// G is a real resistive branch: external shunts/multipliers alter circuit currents.
for(const fraction of [-1.2,-1,-.2,0,.2,1,1.2])for(const angle of [0,90,180,270]){
  const d=circuit([device('E','battery',{a:'p',b:'n'},{voltage:Math.abs(fraction)*.005,resistance:0,polarity:fraction<0?-1:1}),device('G','galvanometer',{a:'p',b:'n'},{resistance:100,range:.00005})]);d.components[1].angle=angle;
  const s=energy(d),r=s.components.c2;near(r.reading,fraction*.00005,'signed microamp reading',1e-10);assert.equal(r.meterStatus,Math.abs(fraction)>1?'overrange':fraction<0?'reverse':'normal');
  const dial=V.galvanometerDial(d.components[1],r);assert.equal((dial.match(/data-meter-tick=/g)||[]).length,41);near(Number(dial.match(/data-angle="([^"]+)"/)[1]),-90+60*Math.max(-1.03,Math.min(1.03,fraction)),'G needle reflects actual reading');
  for(const view of ['real','schematic'])for(const meters of ['digital','analog']){d.display.view=view;d.display.meters=meters;assert.equal(XMLValidator.validate('<svg>'+V.scene(d,s)+'</svg>'),true);}
  restoredContinuation(d,doc=>doc.components[1].params.resistance=200);
}
for(const name of ['gAmmeter','gVoltmeter']){
  const d=P.create(name),s=energy(d);near(s.components.c3.reading,.00005,'converted G full scale',1e-10);
  near(s.components.c1.current,name==='gAmmeter'?-.001:-.00005,'conversion source current',1e-10);restoredContinuation(d,doc=>doc.components[1].params.resistance*=2);
}
const micro=circuit([device('E','battery',{a:'p',b:'n'},{voltage:.04,resistance:0}),device('G','galvanometer',{a:'p',b:'n'},{resistance:800,range:.00005})]);near(energy(micro).components.c2.reading,.00005,'textbook 800 ohm / 50 microamp native head',1e-10);cases++;
const gSymbol=V.body(micro.components[1],S.solve(micro).components.c2,{...micro.display,view:'schematic'}),gRadius=Number(gSymbol.match(/<circle r="([^"]+)"/)[1]),gLeadEnds=gSymbol.match(/data-leads="galvanometer" d="M-60 0H(-?[\d.]+) M([\d.]+) 0H60"/);
near(-Number(gLeadEnds[1]),gRadius,'left G lead meets the circular symbol');near(Number(gLeadEnds[2]),gRadius,'right G lead meets the circular symbol');cases++;

// The rated calibration and Jacobian hold across loss/cold-resistance settings.
for(const ratio of [1,2.1,10,30])for(const linear of [0,.1,.99,1]){
  const p={...R.defaults('lamp'),model:'thermal',coldRatio:ratio,linearLoss:linear};
  near(R.lampAt(0,p).resistance,p.resistance/ratio,'cold resistance');near(R.lampAt(6,p).current,.5,'rated current');near(R.lampAt(6,p).temperature,2600,'rated temperature');
  for(const voltage of [-12,-1,0,.5,3,12]){const at=R.lampAt(voltage,p),dv=1e-5;assert(at.conductance>0);near(at.conductance,(R.lampAt(voltage+dv,p).current-R.lampAt(voltage-dv,p).current)/(2*dv),'nonlinear lamp Jacobian',1e-5);}
  const d=circuit([device('E','battery',{a:'p',b:'n'},{voltage:3,resistance:1}),device('L','lamp',{a:'p',b:'n'},p)]);energy(d);restoredContinuation(d,doc=>doc.components[1].params.ratedVoltage=3);
}
const calibrated={...R.defaults('lamp'),model:'thermal',resistance:2.5/.43,ratedVoltage:2.5,coldRatio:2.1,linearLoss:.99};
for(const [u,i]of [[.5,.17],[1,.28],[1.5,.35],[2,.40],[2.5,.43]])near(R.lampAt(u,calibrated).current,i,'textbook graph-read comparison',.02);cases++;

for(const terminals of [5,'4']){const bad=P.create('ohm');bad.components[2].params.terminals=terminals;assert.throws(()=>D.decode(JSON.stringify(bad)));cases++;}
for(const name of ['limiting','divider','gAmmeter','gVoltmeter']){
  const d=P.create(name);energy(d);assert(d.wires.every(w=>G.length(G.route(d,w))<=w.length+.05&&w.length<=1200));restoredContinuation(d,doc=>doc.components[1].params.resistance*=1.1);
}
console.log(`DC teaching: ${cases} native multi-post/G/lamp cases, independent loading and conversion formulas, signed actual needles, thermal Jacobians, legacy migrations, production round trips + legal continuation passed.`);
