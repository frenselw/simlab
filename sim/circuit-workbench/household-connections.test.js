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
for(const type of ['house-mains','house-earth']){
 const d=M.empty('household'),c=M.add(d,type,0,0);M.addLeads(d,c);assert.equal(d.wires.length,type==='house-mains'?2:1);assert.doesNotThrow(()=>M.validate(d));const w=d.wires[0],before=JSON.stringify(d);assert.throws(()=>M.detach(d,w.id,'from'),/固定/);assert.throws(()=>M.remove(d,w.id),/固定/);assert.equal(JSON.stringify(d),before);const template=require('./circuit-document').template(d);assert.equal(template.wires.length,d.wires.length);assert.doesNotThrow(()=>M.validate(template));M.remove(d,c.id);assert.equal(d.wires.length,0);assert.doesNotThrow(()=>M.validate(d));
}
console.log('Household: 36 working-lead combinations / order, supply boundaries, atomic attach and component snapping passed');
