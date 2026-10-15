'use strict';
const assert=require('node:assert/strict'),C=require('./circuit-household-components'),M=require('./circuit-model'),J=require('./circuit-snapping'),Rules=require('./household-connections'),P=require('../circuit-household-workbench/presets'),Profile=require('./circuit-profile');
for(const type of ['house-metal','house-insulated'])for(const a of ['l','n','e'])for(const b of ['l','n','e'])for(const reverse of [false,true]){
  const d=M.empty('household');M.add(d,'house-socket',0,0).id='socket';M.add(d,type,200,0).id='load';const pairs=[['socket:'+a,'load:l'],['socket:'+b,'load:n']];if(reverse)pairs.reverse();for(const pair of pairs)M.connect(d,...pair);assert.equal(M.validate(d).wires.length,2,type+' '+a+b);assert.equal(Rules.inspect(d).roleOf('load:l'),a.toUpperCase());
}
for(const role of ['l','n','e']){const d=P.create('C03'),w=d.wires.find(w=>w.to==='load:e');w.from='socket:'+role;assert.doesNotThrow(()=>M.validate(d));}
for(const [a,b]of [['source:l','socket:n'],['socket:l','socket:e'],['socket:n','socket:e']]){const d=P.create('C03'),before=JSON.stringify(d);assert.throws(()=>M.connect(d,a,b),/不能直接合併/);assert.equal(JSON.stringify(d),before);}
for(const target of ['source:l','socket:n','load:e']){const d=P.create('C03');d.wires=d.wires.filter(w=>w.from!=='earth:e');assert.throws(()=>M.connect(d,'earth:e',target));}
{
 const d=P.create('C08');const w=d.wires.find(w=>w.to==='load:n');M.detach(d,w.id,'from');assert(M.attach(d,w.id,'from','socket:l'));assert.equal(w.from,'socket:l');const before=JSON.stringify(d);assert.throws(()=>M.attach(d,d.wires.find(w=>w.from==='source:l').id,'to','socket:n'));assert.equal(JSON.stringify(d),before);
}
{
 const d=M.empty('household');M.add(d,'house-socket',0,0).id='socket';const load=M.add(d,'house-insulated',260,0);load.id='load';const w=M.addWire(d,120,40);M.attach(d,w.id,'from','socket:l');const p=M.endpoints(d).get(w.to),next=J.component(d,'load',{x:p.x+86,y:p.y},24);assert(next);assert.equal(next.doc.wires[0].to,'load:n','neutral appliance lead may snap onto the live supply net');
}
{
 const d=P.create('C02');const a=d.wires.find(w=>w.to==='switch:a'),b=d.wires.find(w=>w.from==='switch:b'),direct=d.wires.find(w=>w.to==='load:n');a.from='socket:n';b.to='load:n';direct.from='socket:l';direct.to='load:l';assert.doesNotThrow(()=>M.validate(d));a.from='socket:e';assert.throws(()=>M.validate(d),/地線/);
}
assert.throws(()=>Profile.compile({role:'teacher',initialDocument:P.create('C01')}),/分析種類/);
assert.throws(()=>M.validate({...P.create('C01'),kind:'simlab-circuit',version:6}),/欄位|家庭/);
assert.equal(Object.keys(C.definitions).length,11);
for(const stance of ['grounded','insulated']){
 const d=P.create('C03'),person=d.components.find(c=>c.id==='person');person.params.stance=stance;
 assert.deepEqual(C.hand(person),{x:person.x+40,y:person.y+(stance==='insulated'?-35:-13)});
 const wire=M.addWire(d,person.x+150,person.y+150),end=M.endpoints(d).get(wire.to),h=C.hand(person);
 const snapped=J.component(d,'person',{x:person.x+end.x-h.x+4,y:person.y+end.y-h.y+3},24);assert(snapped);assert.equal(snapped.doc.wires.find(w=>w.id===wire.id).to,'person:hand');assert.doesNotThrow(()=>M.validate(snapped.doc));
 M.connect(d,'socket:l','person:hand');const before=M.clone(d);assert.throws(()=>M.connect(d,'socket:n','person:hand'),/不能直接合併/);assert.deepEqual(d,before);
}
{
 const d=M.empty('household'),c=M.add(d,'house-earth',0,0);M.addLeads(d,c);assert.equal(d.wires.length,1);assert.doesNotThrow(()=>M.validate(d));const w=d.wires[0],before=JSON.stringify(d);assert.throws(()=>M.detach(d,w.id,'from'),/固定/);assert.throws(()=>M.remove(d,w.id),/固定/);assert.equal(JSON.stringify(d),before);const template=require('./circuit-document').template(d);assert.equal(template.wires.length,d.wires.length);assert.doesNotThrow(()=>M.validate(template));M.remove(d,c.id);assert.equal(d.wires.length,0);assert.doesNotThrow(()=>M.validate(d));
}
{
 const d=M.empty('household'),c=M.add(d,'house-mains',0,0);M.addLeads(d,c);assert.equal(d.wires.length,2);
 const w=d.wires[0];assert.equal(w.anchor,undefined);M.detach(d,w.id,'from');assert(M.attach(d,w.id,'from',c.id+':l'));assert.doesNotThrow(()=>M.validate(d));
 const legacy=M.clone(d);legacy.wires[0].anchor=c.id+':l';const restored=M.validate(legacy);assert.deepEqual(restored,d,'legacy pinned source preserves geometry and connections');M.detach(restored,w.id,'from');assert.doesNotThrow(()=>M.validate(restored));
 assert.equal(require('./circuit-document').template(d).wires.length,0);M.remove(d,w.id);assert.equal(d.wires.length,1);M.remove(d,c.id);assert.equal(d.wires.length,1);assert.doesNotThrow(()=>M.validate(d));
}
// Component capabilities cannot be overridden by teacher mode or wiring permissions.
for(const mode of ['free','wiring'])for(const role of ['teacher','student']){
 const d=P.create('C03'),insulated=M.add(d,'house-insulated',500,200);d.policy.mode=mode;d.policy.allowRotate=true;
 const profile=Profile.compile({role,analysis:'household',initialDocument:d,palette:[],components:{default:{rotate:true}}});
 for(const c of [d.components.find(c=>c.id==='load'),insulated,d.components.find(c=>c.id==='person')]){
  assert.equal(profile.allows(d,c,'rotate'),false,c.type+' '+role+' '+mode);
  for(const direction of [1,-1]){const before=M.clone(d);assert.throws(()=>M.rotateComponent(d,c.id,direction),/不能旋轉/);assert.deepEqual(d,before);}
  const changed=M.clone(d);changed.components.find(p=>p.id===c.id).angle=45;assert.throws(()=>profile.assertTransition(d,changed));
 }
 assert(profile.allows(d,d.components.find(c=>c.id==='socket'),'rotate'));
}
{
 const d=P.create('C05');d.components.find(c=>c.id==='load').angle=45;d.components.find(c=>c.id==='person').angle=90;
 const profile=Profile.compile({role:'teacher',analysis:'household',initialDocument:d,palette:[]});
 assert.deepEqual(profile.assertSnapshot(M.validate(d)),d,'old orientations load without moving wires or people');
 const next=M.clone(d);next.components.find(c=>c.id==='load').x+=20;assert.doesNotThrow(()=>profile.assertTransition(d,next));
}
console.log('Household: working-lead combinations, supply boundaries, atomic attach, snapping and fixed appliance/person orientations passed');
