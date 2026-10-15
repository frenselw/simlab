'use strict';
const assert=require('node:assert/strict'),P=require('../circuit-household-workbench/presets'),M=require('./circuit-model'),H=require('./household-model'),V=require('./circuit-renderer');
const near=(actual,expected,tolerance=.005)=>assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(1e-8,Math.abs(expected)*tolerance),actual+' != '+expected);
for(const stance of ['grounded','insulated'])for(const terminal of ['l','n','e']){
 const d=P.create('C03');d.components.find(c=>c.id==='person').params.stance=stance;const w=M.connect(d,'socket:'+terminal,'person:hand'),s=new H.Session(d);
 near(s.read().components.person.current,stance==='grounded'&&terminal==='l'?230/2000:0);near(s.read().wires[w.id].current,s.read().components.person.current);
 near(s.read().components.person.voltage,terminal==='l'?230:0);assert.equal(s.read().components.person.contact,null);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);near(restored.read().components.person.current,s.read().components.person.current);restored.destroy();s.destroy();
}
{
 const d=P.create('C04');M.connect(d,'socket:l','person:hand');const s=new H.Session(d);assert(s.read().components.person.current>.1);assert(s.read().components.protector.residualCurrent>.1);s.advance(.1);
 assert.equal(s.read().components.protector.status,'tripped');near(s.read().components.person.current,0);assert(s.state.protection.protector.bodyCurrentBeforeTrip);
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
 const d=P.create('C03');d.wires=d.wires.filter(w=>w.from!=='earth:e');d.components.find(c=>c.id==='load').params.fault=true;const w=M.connect(d,'earth:e','load:e'),s=new H.Session(d);s.contact('person','load');near(s.read().components.person.current,0);near(s.read().components.load.casePotential,0);
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
 const d=P.create('C03');d.components.find(c=>c.id==='load').params.fault=true;const s=new H.Session(d);s.contact('person','load');near(s.read().components.load.casePotential,0);near(s.read().components.person.current,0);const next=M.clone(s.doc),w=next.wires.find(w=>w.to==='load:e');M.detach(next,w.id,'from');s.update(next);near(s.read().components.person.current,230/4000);near(s.read().components.load.casePotential,115);
}
{
 const d=P.create('C03');d.wires.find(w=>w.to==='load:e').from='socket:l';const s=new H.Session(d);s.contact('person','load');near(s.read().components.person.current,230/2000);near(s.read().components.load.casePotential,230);
}
{
 const d=P.create('C05');d.components.find(c=>c.id==='load').params.fault=true;const s=new H.Session(d);s.contact('person','load');near(s.read().components.person.current,0);
}
for(const key of ['C07','C07fuse']){const d=P.create(key);d.components.find(c=>c.id==='protector').params.rating=5;const s=new H.Session(d);s.advance(1.999);assert(!['tripped','blown'].includes(s.read().components.protector.status));s.advance(.001);assert.equal(s.read().components.protector.status,key==='C07'?'tripped':'blown');near(s.read().components.load.power,0);assert(s.resetProtection('protector'));s.advance(2);assert(['tripped','blown'].includes(s.read().components.protector.status));}
for(const step of [.1,.01,.003]){const d=P.create('C04');d.components.find(c=>c.id==='load').params.fault=true;const s=new H.Session(d);for(let t=0;t<.12-1e-10;t+=step)s.advance(Math.min(step,.12-t));assert.equal(s.read().components.protector.status,'tripped');near(s.state.time,.12,1e-9);}
{
 const d=P.create('C04');d.components.find(c=>c.id==='load').params.kind='heater';const balanced=new H.Session(d);balanced.advance(2);assert.equal(balanced.read().components.protector.status,'closed');assert(balanced.read().components.protector.current>8);near(balanced.read().components.protector.residualCurrent,0);
 d.components.find(c=>c.id==='load').params.fault=true;const a=new H.Session(d),b=new H.Session({...M.clone(d),components:[...d.components].reverse(),wires:[...d.wires].reverse()});a.advance(.1);b.advance(.1);assert.deepEqual(a.state.protection,b.state.protection);near(a.state.time,b.state.time,1e-9);
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
 const d=P.create('C04');d.components.find(c=>c.id==='load').params.fault=true;M.detach(d,d.wires.find(w=>w.to==='load:e').id,'from');const s=new H.Session(d);s.contact('person','load');s.advance(.04);assert(s.state.protection.protector.bodyCurrentSeen);const next=M.clone(s.doc);M.attach(next,next.wires.find(w=>w.to==='load:e').id,'from','socket:e');s.update(next);near(s.read().components.person.current,0);const restored=H.Session.restore(s.capture());restored.advance(.06);assert(restored.state.protection.protector.bodyCurrentBeforeTrip,'remember body current before earth was reconnected');
}
