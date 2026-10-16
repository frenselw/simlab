'use strict';
const assert=require('node:assert/strict'),P=require('../circuit-household-workbench/presets'),M=require('./circuit-model'),H=require('./household-model'),V=require('./circuit-renderer'),R=require('./component-registry'),C=require('./circuit-household-components');
const near=(actual,expected,tolerance=.005)=>assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(1e-8,Math.abs(expected)*tolerance),actual+' != '+expected);
for(const supplyVoltage of [220,230]){
 const d=P.create('C01');d.supplyVoltage=supplyVoltage;const s=new H.Session(d),r=s.read(),load=r.components.load,resistance=230**2/2000;
 near(load.current,supplyVoltage/(resistance+.05+.008),.001);near(load.power,load.current**2*resistance,1e-10);assert.equal(r.references[0].voltage,0);
 for(const terminalLabels of [false,true])for(const showSupplyVoltage of [false,true])for(const view of ['real','schematic'])for(const values of [false,true]){
  const shown=M.clone(d);Object.assign(shown.display,{terminalLabels,showSupplyVoltage,view,values});const svg=V.scene(shown,r,.3);
  assert.equal(svg.includes('data-house-port-label='),terminalLabels);assert.equal(svg.includes('data-house-supply-voltage='),showSupplyVoltage);if(showSupplyVoltage)assert(svg.includes(supplyVoltage+' V～'));
  near(H.solve(shown).components.load.current,load.current,1e-10);
 }
 s.advance(.01);const saved=s.capture(),restored=H.Session.restore(H.decode(H.encode(saved)));assert.deepEqual(restored.capture(),saved);restored.advance(.01);assert(restored.state.time>saved.timeSeconds);restored.destroy();s.destroy();
}
for(const supplyVoltage of [0,219,240,'220',NaN,Infinity])assert.throws(()=>M.validate({...P.create('C01'),supplyVoltage}));
for(const key of ['terminalLabels','showSupplyVoltage'])assert.throws(()=>M.validate({...P.create('C01'),display:{...P.create('C01').display,[key]:'true'}}));
for(const analysis of ['dc','transient']){const d=M.empty(analysis);assert.throws(()=>M.validate({...d,supplyVoltage:220}));assert.throws(()=>M.validate({...d,display:{...d.display,terminalLabels:true}}));}
{const d=P.create('C01'),profile=require('./circuit-profile').compile({role:'student',analysis:'household',initialDocument:d,palette:[]});assert.throws(()=>profile.assertTransition(d,{...d,supplyVoltage:220}),/供電電壓已固定/);}
function shorted(type='house-breaker',target='n'){
 const d=P.create('C10'),p=d.components.find(c=>c.id==='protector');
 if(type==='house-fuse'){p.type=type;p.params={rating:5};d.wires=d.wires.filter(w=>w.to!=='protector:ni');for(const w of d.wires){if(w.to==='protector:li')w.to='protector:a';if(w.from==='protector:lo')w.from='protector:b';if(w.from==='protector:no')w.from='source:n';}}
 if(type==='house-rcd'){p.type=type;p.params={closed:true};}
 if(target==='e'){M.add(d,'house-earth',70,180).id='earth';M.attach(d,'short-link','to','earth:e');}else M.attach(d,'short-link','to','short-n:p');return M.validate(d);
}
for(const type of ['house-breaker','house-fuse'])for(const target of ['n','e'])for(const step of [.1,.007,.001]){
 const d=shorted(type,target),s=new H.Session(d),r=s.read(),current=r.components.protector.current;assert(r.shortCircuit&&r.reliable);assert(current>1000&&Number.isFinite(current));for(const wire of Object.values(r.wires)){assert(Number.isFinite(wire.current)&&Number.isFinite(wire.power));near(wire.power,wire.current**2*H.constants.wireResistance,1e-8);}
 const dissipation=Object.values(r.wires).reduce((sum,w)=>sum+w.power,0)+d.components.filter(c=>c.type!=='house-mains').reduce((sum,c)=>sum+r.components[c.id].branches.reduce((n,b)=>n+b.power,0),0);near(r.components.source.power,dissipation,1e-8);
 near(r.components.protector.current,Math.abs(r.wires['short-link'].current)+r.components.load.current,1e-8);
 s.advance(.019);assert(!['tripped','blown'].includes(s.read().components.protector.status));const counting=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(counting.capture(),s.capture());counting.advance(.001);assert.equal(counting.read().components.protector.status,type==='house-fuse'?'blown':'tripped');counting.destroy();
 for(let t=.019;t<.1-1e-12;t+=step)s.advance(Math.min(step,.1-t));const p=s.read().components.protector.protection;assert.equal(p.reason,'short-circuit');near(p.currentBeforeTrip,current,1e-10);near(s.read().components.protector.current,0);assert.equal(p.timingMode,null);
 const saved=s.capture(),restored=H.Session.restore(H.decode(H.encode(saved)));assert.deepEqual(restored.capture(),saved);restored.advance(.1);near(restored.read().components.protector.protection.currentBeforeTrip,current);restored.destroy();
 const fixed=M.clone(s.doc);M.detach(fixed,'short-link','to');s.update(fixed);near(s.read().components.protector.current,0);near(s.read().components.protector.protection.currentBeforeTrip,current);assert(s.resetProtection('protector'));assert.equal(s.read().components.protector.protection.currentBeforeTrip,null);assert(s.read().components.load.power>59);s.destroy();
}
{
 const d=shorted('house-rcd'),s=new H.Session(d);assert(s.read().components.protector.current>1000);near(s.read().components.protector.residualCurrent,0);s.advance(.2);assert.equal(s.read().components.protector.status,'closed','balanced L/N short is not a residual-current event');s.destroy();
 const e=new H.Session(shorted('house-rcd','e'));assert(e.read().components.protector.residualCurrent>1000);e.advance(.1);assert.equal(e.read().components.protector.status,'tripped');assert(e.read().components.protector.protection.residualBeforeTrip>1000);e.destroy();
}
{
 const d=P.create('C04');M.connect(d,'socket:n','socket:e');const s=new H.Session(d);assert(!s.read().shortCircuit&&s.read().reliable);assert(s.read().components.protector.residualCurrent>.03);s.advance(.1);assert.equal(s.read().components.protector.protection.reason,'residual','N/E mixing is solved as a bypass return, not rejected as a short');s.destroy();
}
for(const target of ['source:n','earth:e']){
 const d=P.create('C07');if(target==='earth:e')M.add(d,'house-earth',-290,80).id='earth';M.connect(d,'source:l',target);const s=new H.Session(d);assert(s.read().shortCircuit&&s.read().components.source.current>1000);assert(s.read().components.protector.current<1);s.advance(3);assert.equal(s.read().components.protector.status,'closed','an upstream short does not falsely trip an uninvolved downstream breaker');assert.equal(s.read().components.protector.protection.currentBeforeTrip,null);s.destroy();
}
{
 const d=P.create('C07');d.components.filter(c=>c.type==='house-switch').forEach(c=>c.params.closed=true);d.components.find(c=>c.id==='protector').params.rating=5;const s=new H.Session(d);s.advance(1);assert.equal(s.state.protection.protector.timingMode,'overload');const short=M.clone(s.doc);M.connect(short,'protector:lo','protector:no');s.update(short);assert.equal(s.state.protection.protector.elapsed,0);assert.equal(s.state.protection.protector.timingMode,'fast');s.advance(.019);assert.equal(s.read().components.protector.status,'closed');s.advance(.001);assert.equal(s.read().components.protector.status,'tripped');assert(s.state.protection.protector.currentBeforeTrip>1000);s.destroy();
 const open=shorted();open.components.find(c=>c.id==='protector').params.closed=false;const stopped=new H.Session(open);near(stopped.read().components.source.current,0);stopped.advance(3);assert.equal(stopped.read().components.protector.status,'open');stopped.destroy();
}
{
 const d=shorted(),second=M.add(d,'house-breaker',-120,-80,{rating:15});second.id='second';for(const w of d.wires){if(w.from==='source:l')w.from='second:lo';if(w.from==='source:n')w.from='second:no';}M.connect(d,'source:l','second:li');M.connect(d,'source:n','second:ni');
 const a=new H.Session(d),b=new H.Session({...M.clone(d),components:[...d.components].reverse(),wires:[...d.wires].reverse()});a.advance(.02);b.advance(.02);for(const id of ['protector','second']){assert.equal(a.read().components[id].status,'tripped');assert.equal(b.read().components[id].status,'tripped');near(a.state.protection[id].currentBeforeTrip,b.state.protection[id].currentBeforeTrip,1e-10);}a.destroy();b.destroy();
}
for(const stance of ['grounded','insulated'])for(const terminal of ['l','n','e']){
 const d=P.create('C03');d.components.find(c=>c.id==='person').params.stance=stance;const w=M.connect(d,'socket:'+terminal,'person:hand'),s=new H.Session(d);
 near(s.read().components.person.current,stance==='grounded'?s.read().potentials['socket:'+terminal]/2000:0);near(s.read().wires[w.id].current,s.read().components.person.current);
 near(s.read().components.person.voltage,s.read().potentials['socket:'+terminal]);assert.equal(s.read().components.person.contact,null);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);near(restored.read().components.person.current,s.read().components.person.current);restored.destroy();s.destroy();
}
{
 const d=P.create('C04');M.connect(d,'socket:l','person:hand');const s=new H.Session(d);assert(s.read().components.person.current>.1);assert(s.read().components.protector.residualCurrent>.1);s.advance(.1);
 assert.equal(s.read().components.protector.status,'tripped');assert(Math.abs(s.read().components.person.current)<1e-6);assert(s.state.protection.protector.bodyCurrentBeforeTrip);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);assert.equal(restored.read().components.protector.status,'tripped');assert(restored.state.protection.protector.bodyCurrentBeforeTrip);restored.destroy();s.destroy();
}
{
 const d=P.create('C03');M.detach(d,d.wires.find(w=>w.to==='load:e').id,'from');d.components.find(c=>c.id==='load').params.fault=true;const w=M.connect(d,'load:e','person:hand'),s=new H.Session(d);
 near(s.read().components.person.current,230/4000);near(s.read().wires[w.id].current,230/4000);s.contact('person','load');near(s.read().components.person.current,230/4000);s.destroy();
}
{
 const d=P.create('C03');M.connect(d,'socket:l','person:hand');const far=M.add(d,'house-metal',2500,0),s=new H.Session(d),before=s.capture();
 assert.throws(()=>s.contact('person',far.id),/導線太短/);assert.deepEqual(s.capture(),before,'contact rejected by cable length is atomic');s.destroy();
}
for(const value of [.02,.03,.04])assert.equal(H.threshold({id:'r',type:'house-rcd'},{components:{r:{residualCurrent:value}}}),value>=.03);
{
 const d=P.create('C03');d.wires=d.wires.filter(w=>w.from!=='earth:e');d.components.find(c=>c.id==='load').params.fault=true;const w=M.connect(d,'earth:e','load:e'),s=new H.Session(d);s.contact('person','load');assert(Math.abs(s.read().components.person.current)<1e-6);assert(Math.abs(s.read().components.load.casePotential)<.001);
 const next=M.clone(s.doc);M.detach(next,w.id,'from');s.update(next);near(s.read().components.person.current,230/4000);s.destroy();
}
for(const value of [4.99,5,5.01,-5.01])assert.equal(H.threshold({id:'r',type:'house-breaker',params:{rating:5}},{components:{r:{current:value}}}),Math.abs(value)>5);
for(const key of ['C01','C02','C03','C04','C05','C06','C07','C07fuse','C08']){const d=P.create(key),s=new H.Session(d),r=s.read();assert(r.reliable);assert(!r.diagnostics.length);near(r.components.load.power,key==='C07fuse'?0:d.components.find(c=>c.id==='load').params.kind==='heater'?2000:d.components.find(c=>c.id==='load').params.kind==='fan'?60:400);assert.equal(V.visualState(d,r).overload,false);s.destroy();}
for(const metal of [false,true])for(const a of ['l','n','e'])for(const b of ['l','n','e']){
 const d=P.create(metal?'C03':'C08');for(const w of d.wires){if(w.to==='load:l')w.from='socket:'+a;if(w.to==='load:n')w.from='socket:'+b;}const s=new H.Session(d),r=s.read().components.load;
 const works=a==='l'&&b!=='l'||b==='l'&&a!=='l';near(r.power,works?metal?60:400:0);if(a===b)near(r.voltage,0);if(a==='l'&&b==='l'){near(s.read().potentials['load:l'],230);near(s.read().potentials['load:n'],230);}if(a==='n'&&b==='l')assert(r.voltage<0);
 if(a==='e'||b==='e'){const earth=d.wires.find(w=>w.from==='earth:e');M.detach(d,earth.id,'to');s.update(d);near(s.read().components.load.current,0);if(works)near(s.read().potentials['socket:e'],230);}
}
for(const neutral of [false,true])for(const fault of [false,true])for(const touched of [false,true])for(const insulated of [false,true]){
 const d=P.create('C02');d.components.find(c=>c.id==='switch').params.closed=false;d.components.find(c=>c.id==='load').params.fault=fault;d.components.find(c=>c.id==='person').params.stance=insulated?'insulated':'grounded';
 if(neutral){d.wires.find(w=>w.to==='switch:a').from='socket:n';d.wires.find(w=>w.from==='switch:b').to='load:n';const direct=d.wires.find(w=>w.to==='load:n'&&w.from!=='switch:b');direct.from='socket:l';direct.to='load:l';}
 const s=new H.Session(d);if(touched)s.contact('person','load');near(s.read().components.person.current,neutral&&fault&&touched&&!insulated?230/4000:0);
}
{
 const d=P.create('C03');d.components.find(c=>c.id==='load').params.fault=true;const s=new H.Session(d);s.contact('person','load');assert(Math.abs(s.read().components.load.casePotential)<.001);assert(Math.abs(s.read().components.person.current)<1e-6);const next=M.clone(s.doc),w=next.wires.find(w=>w.to==='load:e');M.detach(next,w.id,'from');s.update(next);near(s.read().components.person.current,230/4000);near(s.read().components.load.casePotential,115);
}
{
 const d=P.create('C03');d.wires.find(w=>w.to==='load:e').from='socket:l';const s=new H.Session(d);s.contact('person','load');near(s.read().components.person.current,230/2000);near(s.read().components.load.casePotential,230);
}
{
 const d=P.create('C05');d.components.find(c=>c.id==='load').params.fault=true;const s=new H.Session(d);s.contact('person','load');assert(Math.abs(s.read().components.person.current)<1e-6);
}
for(const key of ['C07','C07fuse']){const d=P.create(key);d.components.filter(c=>c.type==='house-switch').forEach(c=>c.params.closed=true);d.components.find(c=>c.id==='protector').params.rating=5;const s=new H.Session(d);s.advance(1.999);assert(!['tripped','blown'].includes(s.read().components.protector.status));s.advance(.001);assert.equal(s.read().components.protector.status,key==='C07'?'tripped':'blown');near(s.read().components.load.power,0);assert(s.resetProtection('protector'));s.advance(2);assert(['tripped','blown'].includes(s.read().components.protector.status));}
for(const step of [.1,.01,.003]){const d=P.create('C04');d.components.find(c=>c.id==='load').params.fault=true;const s=new H.Session(d);for(let t=0;t<.12-1e-10;t+=step)s.advance(Math.min(step,.12-t));assert.equal(s.read().components.protector.status,'tripped');near(s.state.time,.12,1e-9);}
{
 const d=P.create('C04');d.components.find(c=>c.id==='load').params.kind='heater';const balanced=new H.Session(d);balanced.advance(2);assert.equal(balanced.read().components.protector.status,'closed');assert(balanced.read().components.protector.current>8);near(balanced.read().components.protector.residualCurrent,0);
 d.components.find(c=>c.id==='load').params.fault=true;const a=new H.Session(d),b=new H.Session({...M.clone(d),components:[...d.components].reverse(),wires:[...d.wires].reverse()});a.advance(.1);b.advance(.1);for(const id of Object.keys(a.state.protection)){const p=a.state.protection[id],q=b.state.protection[id];near(p.currentBeforeTrip,q.currentBeforeTrip,1e-10);near(p.residualBeforeTrip,q.residualBeforeTrip,1e-10);assert.deepEqual({...p,currentBeforeTrip:null,residualBeforeTrip:null},{...q,currentBeforeTrip:null,residualBeforeTrip:null});}near(a.state.time,b.state.time,1e-9);
 const other=P.create('C04');other.wires=other.wires.filter(w=>w.to!=='load:e');const c=other.components.find(c=>c.id==='load');c.type='house-insulated';c.params={kind:'blender',fault:false};other.wires.find(w=>w.to==='load:n').from='socket:e';const s=new H.Session(other);s.advance(.1);assert.equal(s.read().components.protector.status,'tripped','intact double insulation does not prevent residual current from L–E miswiring');
}
{
 const d=P.create('C04');d.components.find(c=>c.id==='load').params.fault=true;const w=d.wires.find(w=>w.to==='load:e');M.detach(d,w.id,'from');const s=new H.Session(d);s.advance(.2);assert.equal(s.read().components.protector.status,'closed');s.contact('person','load');s.advance(.1);assert.equal(s.read().components.protector.status,'tripped');assert(s.state.protection.protector.bodyCurrentBeforeTrip);
}
{
 const d=P.create('C04');d.components.find(c=>c.id==='load').params.fault=true;for(const w of d.wires){if(w.to==='load:l')w.from='socket:n';if(w.to==='load:n')w.from='socket:l';}const s=new H.Session(d);s.advance(.2);assert.equal(s.read().components.protector.status,'closed','fault stays at intended L terminal, now fed from N');
}
{
 const d=P.create('C04');d.wires.find(w=>w.to==='load:n').from='socket:e';const s=new H.Session(d);near(s.read().components.protector.residualCurrent,60/230);s.advance(.1);assert.equal(s.read().components.protector.status,'tripped');
}
{
 const d=P.create('C01'),s=new H.Session(d),power=s.read().components.meter.power;s.advance(3);near(s.state.energyKWh.meter,power*3/3600000,1e-10);near(s.read().wires[d.wires.find(w=>w.from==='earth:e').id].current,0);
}
console.log('Household: analytical wiring matrix, neutral switch, earthing, insulation, timed protection and energy passed');
{
 const d=P.create('C04');d.components.find(c=>c.id==='load').params.fault=true;M.detach(d,d.wires.find(w=>w.to==='load:e').id,'from');const s=new H.Session(d);s.contact('person','load');s.advance(.04);assert(s.state.protection.protector.bodyCurrentSeen);const next=M.clone(s.doc);M.attach(next,next.wires.find(w=>w.to==='load:e').id,'from','socket:e');s.update(next);assert(Math.abs(s.read().components.person.current)<1e-6);const restored=H.Session.restore(s.capture());restored.advance(.06);assert(restored.state.protection.protector.bodyCurrentBeforeTrip,'remember body current before earth was reconnected');
}

// Two distinct hands make a finite body path even without a path to earth.
for(const stance of ['grounded','insulated'])for(const right of ['l','n','e',null])for(const left of ['l','n','e',null]){
 const d=P.create('C03');d.components.find(c=>c.id==='person').params.stance=stance;
 if(right)M.connect(d,'socket:'+right,'person:hand');if(left)M.connect(d,'socket:'+left,'person:hand-left');
 const s=new H.Session(d),r=s.read().components.person,rv=right?s.read().potentials['socket:'+right]:0,lv=left?s.read().potentials['socket:'+left]:0;
 const connected=[...(right?[rv]:[]),...(left?[lv]:[]),...(stance==='grounded'?[0]:[])],body=connected.reduce((a,b)=>a+b,0)/(connected.length||1);
 const ri=right?(rv-body)/1000:0,li=left?(lv-body)/1000:0,gi=stance==='grounded'?body/1000:0;
 near(r.handCurrents.right,ri);near(r.handCurrents.left,li);near(r.groundCurrent,gi);near(r.current,Math.max(Math.abs(ri),Math.abs(li),Math.abs(gi)));
 near(r.power,(ri*ri+li*li+gi*gi)*1000);near(ri+li,gi);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);near(restored.read().components.person.current,r.current);restored.destroy();s.destroy();
}
{
 const s=new H.Session(P.create('C09')),r=s.read().components.person;near(r.current,.115);near(r.handVoltage,230);near(r.groundCurrent,0);near(r.power,26.45);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));restored.advance(.01);near(restored.read().components.person.current,.115);restored.destroy();s.destroy();
}
for(const stance of ['grounded','insulated']){
 const d=P.create('C04');d.components.find(c=>c.id==='person').params.stance=stance;M.connect(d,'socket:l','person:hand');M.connect(d,'socket:n','person:hand-left');const s=new H.Session(d);
 assert(s.read().components.person.current>.1);if(stance==='insulated')near(s.read().components.protector.residualCurrent,0);else assert(s.read().components.protector.residualCurrent>.03);
 s.advance(.2);assert.equal(s.read().components.protector.status,stance==='insulated'?'closed':'tripped');
 if(stance==='insulated')near(s.read().components.person.current,.115);else assert(Math.abs(s.read().components.person.current)<1e-6);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));restored.advance(.01);assert.equal(restored.read().components.protector.status,s.read().components.protector.status);restored.destroy();s.destroy();
}
console.log('Household: both hands L/N/E/open, grounded/chair, finite body power, balanced RCD and round-trips passed');

{
 const d=P.create('C03');d.components.find(c=>c.id==='person').params.stance='insulated';d.components.find(c=>c.id==='load').params.fault=true;M.detach(d,d.wires.find(w=>w.to==='load:e').id,'from');M.connect(d,'socket:n','person:hand-left');
 const s=new H.Session(d);s.contact('person','load');near(s.read().components.person.current,230/4000);near(s.read().components.person.groundCurrent,0);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));restored.advance(.01);near(restored.read().components.person.current,230/4000);assert.equal(restored.read().components.person.contact,'load');restored.destroy();s.destroy();
}

for(const hand of ['hand','hand-left'])for(const stance of ['grounded','insulated'])for(const target of ['socket:l','socket:n','socket:e','load:l','load:n','load:e','earth:e','source:l','source:n']){
 const J=require('./circuit-snapping'),d=P.create('C03'),person=d.components.find(c=>c.id==='person');person.params.stance=stance;
 const before=M.clone(d),p=R.ports(person).find(p=>p.id==='person:'+hand),q=M.endpoints(d).get(target),position={x:person.x+q.x-p.x+4,y:person.y+q.y-p.y},snap=J.component(d,'person',position,24,'person:'+hand,d.components.filter(c=>c.type!=='house-person').flatMap(c=>R.ports(c)));
 assert(snap&&snap.snap.contact,target+' direct hand contact');assert.equal(snap.snap.endpoint,target);assert.deepEqual(d,before);assert.deepEqual(snap.doc.wires,d.wires,'direct touch creates no cable');assert(C.handContacts(snap.doc).some(p=>p.hand==='person:'+hand&&p.target===target));
 const s=new H.Session(snap.doc),r=s.read(),live=target.endsWith(':l');assert(r.reliable);if(stance==='grounded'&&live)assert(r.components.person.current>.1);else assert(Math.abs(r.components.person.current)<1e-6,target+' carries no appreciable body current');
 if(stance==='grounded'&&live){const path=require('./circuit-renderer').componentFlowPaths(s.doc,r).find(p=>p.component===target.split(':')[0]&&p.key==='live');if(path)near(path.current,target.startsWith('source:')?-r.components.source.current:r.components.load.current);}
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);near(restored.read().components.person.current,r.components.person.current);
 const changed=M.clone(restored.doc);changed.components.find(c=>c.id==='person').params.stance=stance==='grounded'?'insulated':'grounded';restored.update(changed);assert(C.handContacts(restored.doc).some(p=>p.hand==='person:'+hand&&p.target===target),'stance keeps direct contact');
 const away=M.clone(restored.doc);away.components.find(c=>c.id==='person').x+=100;restored.update(away);assert.equal(C.handContacts(restored.doc).length,0);near(restored.read().components.person.current,0);assert.deepEqual(restored.doc.wires,before.wires,'pulling away creates no extra cable');restored.destroy();s.destroy();
}
{
 const d=M.empty('household'),person=M.add(d,'house-person',0,0,{stance:'insulated'});person.id='person';const palms=R.ports(person);for(const [id,type,key,hand]of [['source','house-mains','l','hand'],['earth','house-earth','e','hand-left']]){const p=palms.find(p=>p.key===hand),c=M.add(d,type,0,0);c.id=id;const q=R.ports(c).find(p=>p.key===key);c.x=p.x-q.x;c.y=p.y-q.y;}
 const s=new H.Session(d);near(s.read().components.person.current,.115);near(s.read().components.person.groundCurrent,0);assert.equal(s.doc.wires.length,0);assert.equal(C.handContacts(d).length,2);const paths=require('./circuit-renderer').componentFlowPaths(d,s.read());near(paths.find(p=>p.component==='source'&&p.key==='live').current,-s.read().components.person.current);near(paths.find(p=>p.component==='source'&&p.key==='neutral').current,0);s.destroy();
}
console.log('Direct hand contacts: both hands, every socket/appliance/earth/source terminal, no cables, release, stance, restore and finite chair current passed');
for(const key of ['C01','C03','C04'])for(const wiring of ['earth','disconnected','neutral-only','mixed','open-earth']){
 const d=P.create(key),wire=d.wires.find(w=>w.from==='earth:e');
 if(wiring==='disconnected')d.wires=d.wires.filter(w=>w!==wire);
 if(wiring==='neutral-only')wire.from='source:n';
 if(wiring==='mixed')M.connect(d,'source:n','earth:e');
 if(wiring==='open-earth'){const c=M.add(d,'house-switch',-300,200,{closed:false});wire.from=c.id+':b';M.connect(d,'earth:e',c.id+':a');}
 const s=new H.Session(d),r=s.read();assert(r.reliable);assert.equal(r.components.load.earthed,wiring==='earth',key+' '+wiring+' protective-earth classification');
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.equal(restored.read().components.load.earthed,r.components.load.earthed);near(restored.read().components.load.current,r.components.load.current);restored.advance(.01);assert(restored.read().reliable);restored.destroy();s.destroy();
}
console.log('Protective earth: genuine E, disconnected E, neutral-only socket E, mixed N/E and open earth path, with production round-trip/continuation passed');
for(const type of ['house-switch','house-fuse','house-breaker','house-rcd']){
 const d=P.create('C03'),c=M.add(d,type,-250,220,type==='house-switch'?{closed:false}:{}),ends=['house-switch','house-fuse'].includes(type)?['a','b']:['ni','no'];
 M.connect(d,'source:n',c.id+':'+ends[0]);M.connect(d,c.id+':'+ends[1],'earth:e');const s=new H.Session(d);
 if(type!=='house-switch'){Object.assign(s.state.protection[c.id],{status:type==='house-fuse'?'blown':'tripped',reason:type==='house-rcd'?'residual':'overcurrent'});s.publish();}
 assert.equal(s.read().components.load.earthed,true,type+' isolated N/E bridge keeps genuine earth');near(s.read().components.load.casePotential,0);near(s.read().components[c.id].current,0);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.equal(restored.read().components.load.earthed,true);restored.advance(.01);assert.equal(restored.read().components.load.earthed,true);restored.destroy();
 if(type==='house-switch'){const next=M.clone(s.doc);next.components.find(x=>x.id===c.id).params.closed=true;s.update(next);}else s.resetProtection(c.id);
 assert.equal(s.read().components.load.earthed,false,type+' closed bridge is an actual neutral/earth mix');s.destroy();
}
{
 const Solver=require('./circuit-solver'),original=Solver.linearSteps;let calls=0;Solver.linearSteps=function(...args){calls++;return original(...args);};
 try{const s=new H.Session(P.create('C01')),before=calls,energy=s.read().components.meter.energyKWh,old=s.read();for(let i=0;i<120;i++)s.advance(1/60,{budget:10});assert.equal(calls,before,'steady frames reuse the electrical solve');assert(s.read().components.meter.energyKWh>energy);near(s.read().time,2);assert.equal(old.time,0,'previous observations remain unchanged');assert.equal(old.components.meter.energyKWh,energy);const display=M.clone(s.doc);display.display.flow='off';display.components.find(c=>c.id==='load').label='自訂家電';s.update(display);assert.equal(calls,before,'display and name changes keep the electrical cache');const electrical=M.clone(s.doc);electrical.supplyVoltage=220;s.update(electrical);assert(calls>before);near(s.read().components.source.voltage,220);s.destroy();}finally{Solver.linearSteps=original;}
}
for(const key of ['C04','C07','C07fuse','C10']){
 const d=P.create(key);if(key==='C04')d.components.find(c=>c.id==='load').params.fault=true;if(key==='C07')d.components.filter(c=>c.type==='house-switch').forEach(c=>c.params.closed=true);if(key==='C07fuse')d.components.find(c=>c.id==='switch').params.closed=true;if(key==='C10')M.attach(d,'short-link','to','short-n:p');
 const baseline=new H.Session(d),s=new H.Session(d);baseline.advance(3);const realClock=globalThis.performance;let now=0;globalThis.performance={now:()=>++now};
 try{let remaining=3,count=0,roundTrip=false;do{const p=s.advance(remaining,{budget:4});remaining=Math.max(0,remaining-p.advanced);assert(++count<20000);assert.equal(s.fault,null);assert.doesNotThrow(()=>H.encode(s.capture()));if(s.pending){const status=s.read().components.protector.status;assert.equal(status,key==='C07fuse'?'intact':'closed','pending event keeps accepted status and currents');assert(s.read().components.protector.current>0);if(!roundTrip){const copy=H.Session.restore(H.decode(H.encode(s.capture())));copy.advance(0);assert(['tripped','blown'].includes(copy.read().components.protector.status));copy.destroy();roundTrip=true;}}if(p.complete)break;}while(true);assert.deepEqual(s.capture(),baseline.capture(),key+' budget continuation matches unbudgeted physics');assert.deepEqual(s.read().components,baseline.read().components);}finally{globalThis.performance=realClock;s.destroy();baseline.destroy();}
}
{
 const d=P.create('C10');M.attach(d,'short-link','to','short-n:p');const s=new H.Session(d),clock=globalThis.performance;let t=0;globalThis.performance={now:()=>++t};
 try{const p=s.advance(.02,{budget:2});assert.equal(p.advanced,.02);assert.equal(p.complete,false);assert(s.pending);const repaired=M.clone(s.doc);M.detach(repaired,'short-link','to');s.update(repaired);assert.equal(s.pending,null);assert.equal(s.read().components.protector.status,'closed');s.advance(.1);assert.equal(s.read().components.protector.status,'closed','editing cancels stale pending trips');}finally{globalThis.performance=clock;s.destroy();}
}
console.log('External audit: real isolated earth paths, steady solve cache, budgeted atomic trips, zero-time continuation and cancellation passed');
for(const count of [20,40,80]){
 const d=M.empty('household');d.cables={count:240,length:1200,resistance:0};M.add(d,'house-mains',-140,0).id='source';M.add(d,'house-breaker',0,0,{rating:5}).id='protector';M.connect(d,'source:l','protector:li');M.connect(d,'source:n','protector:ni');let l='protector:lo',n='protector:no';
 for(let i=0;i<count-3;i++){const c=M.add(d,'house-meter',i%10*100,Math.floor(i/10)*100);M.connect(d,l,c.id+':li');M.connect(d,n,c.id+':ni');l=c.id+':lo';n=c.id+':no';}M.add(d,'house-insulated',600,600,{kind:'dryer'}).id='load';M.connect(d,l,'load:l');M.connect(d,n,'load:n');
 const G=require('./circuit-routing');for(const w of d.wires)w.length=Math.max(w.length,Math.ceil(G.length(G.route(d,w)))+20);
 const baseline=new H.Session(d),s=new H.Session(d);baseline.advance(2);const real=globalThis.performance;let clock=0;globalThis.performance={now:()=>clock+=.01};
 try{let remaining=2,calls=0;do{const p=s.advance(remaining,{budget:10});remaining=Math.max(0,remaining-p.advanced);assert(++calls<10000);if(s.pending){assert.equal(s.read().components.protector.status,'closed');assert(s.read().components.protector.current>5);}if(p.complete)break;}while(true);assert(calls>1,'connected event solve is resumable');assert.deepEqual(s.capture(),baseline.capture());assert.equal(s.read().components.protector.status,'tripped');near(s.read().components.load.current,0);}finally{globalThis.performance=real;s.destroy();baseline.destroy();}
}
console.log('Capacity: 20/40/80 connected component event solves honour continuation and exact state/energy');
{
 const d=P.create('C10');M.attach(d,'short-link','to','short-n:p');const fuse=M.add(d,'house-fuse',-300,-150,{rating:3}),wire=d.wires.find(w=>w.to==='protector:li');wire.to=fuse.id+':a';M.connect(d,fuse.id+':b','protector:li');
 const baseline=new H.Session(d),s=new H.Session(d);baseline.advance(.1);const real=globalThis.performance;let clock=0;globalThis.performance={now:()=>++clock};
 try{let remaining=.1,done=false,calls=0;while(!done){const p=s.advance(remaining,{budget:4});remaining=Math.max(0,remaining-p.advanced);done=p.complete;assert(++calls<20000);const r=s.read().components;assert.equal(r.protector.status==='tripped',r[fuse.id].status==='blown','simultaneous protection statuses publish together');if(s.pending){assert.equal(r.protector.status,'closed');assert.equal(r[fuse.id].status,'intact');assert(r.protector.current>100);}assert.doesNotThrow(()=>H.encode(s.capture()));}assert.deepEqual(s.capture(),baseline.capture());assert.equal(s.read().components.protector.status,'tripped');assert.equal(s.read().components[fuse.id].status,'blown');}finally{globalThis.performance=real;s.destroy();baseline.destroy();}
}
