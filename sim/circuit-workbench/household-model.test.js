'use strict';
const assert=require('node:assert/strict'),P=require('../circuit-household-workbench/presets'),M=require('./circuit-model'),H=require('./household-model'),V=require('./circuit-renderer');
const near=(actual,expected,tolerance=.005)=>assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(1e-8,Math.abs(expected)*tolerance),actual+' != '+expected);
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
 const d=P.create('C07');M.connect(d,'source:l',target);const s=new H.Session(d);assert(s.read().shortCircuit&&s.read().components.source.current>1000);assert(s.read().components.protector.current<1);s.advance(3);assert.equal(s.read().components.protector.status,'closed','an upstream short does not falsely trip an uninvolved downstream breaker');assert.equal(s.read().components.protector.protection.currentBeforeTrip,null);s.destroy();
}
{
 const d=P.create('C07');d.components.find(c=>c.id==='protector').params.rating=5;const s=new H.Session(d);s.advance(1);assert.equal(s.state.protection.protector.timingMode,'overload');const short=M.clone(s.doc);M.connect(short,'socket:l','socket:n');s.update(short);assert.equal(s.state.protection.protector.elapsed,0);assert.equal(s.state.protection.protector.timingMode,'fast');s.advance(.019);assert.equal(s.read().components.protector.status,'closed');s.advance(.001);assert.equal(s.read().components.protector.status,'tripped');assert(s.state.protection.protector.currentBeforeTrip>1000);s.destroy();
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
for(const key of ['C01','C02','C03','C04','C05','C06','C07','C07fuse','C08']){const d=P.create(key),s=new H.Session(d),r=s.read();assert(r.reliable);assert(!r.diagnostics.length);near(r.components.load.power,d.components.find(c=>c.id==='load').params.kind==='heater'?2000:d.components.find(c=>c.id==='load').params.kind==='fan'?60:400);assert.equal(V.visualState(d,r).overload,false);s.destroy();}
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
for(const key of ['C07','C07fuse']){const d=P.create(key);d.components.find(c=>c.id==='protector').params.rating=5;const s=new H.Session(d);s.advance(1.999);assert(!['tripped','blown'].includes(s.read().components.protector.status));s.advance(.001);assert.equal(s.read().components.protector.status,key==='C07'?'tripped':'blown');near(s.read().components.load.power,0);assert(s.resetProtection('protector'));s.advance(2);assert(['tripped','blown'].includes(s.read().components.protector.status));}
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
