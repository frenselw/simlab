'use strict';
const assert=require('node:assert/strict'),C=require('./circuit-household-components'),M=require('./circuit-model'),J=require('./circuit-snapping'),Rules=require('./household-connections'),P=require('../circuit-household-workbench/presets'),Profile=require('./circuit-profile');
for(const type of ['house-metal','house-insulated'])for(const a of ['l','n','e'])for(const b of ['l','n','e'])for(const reverse of [false,true]){
  const d=M.empty('household');M.add(d,'house-socket',0,0).id='socket';M.add(d,type,200,0).id='load';const pairs=[['socket:'+a,'load:l'],['socket:'+b,'load:n']];if(reverse)pairs.reverse();for(const pair of pairs)M.connect(d,...pair);assert.equal(M.validate(d).wires.length,2,type+' '+a+b);assert.equal(Rules.inspect(d).roleOf('load:l'),a.toUpperCase());
}
for(const role of ['l','n','e']){const d=P.create('C03'),w=d.wires.find(w=>w.to==='load:e');w.from='socket:'+role;assert.doesNotThrow(()=>M.validate(d));}
for(const [a,b]of [['source:l','socket:n'],['socket:l','socket:e'],['socket:n','socket:e']]){const d=P.create('C03'),before=d.wires.length;assert(M.connect(d,a,b));assert.equal(d.wires.length,before+1);assert.doesNotThrow(()=>M.validate(d));}
for(const target of ['source:l','socket:n']){const d=P.create('C03');d.wires=d.wires.filter(w=>w.from!=='earth:e');assert(M.connect(d,'earth:e',target));assert.doesNotThrow(()=>M.validate(d));}
{
 const d=P.create('C08');const w=d.wires.find(w=>w.to==='load:n');M.detach(d,w.id,'from');assert(M.attach(d,w.id,'from','socket:l'));assert.equal(w.from,'socket:l');assert(M.attach(d,d.wires.find(w=>w.from==='source:l').id,'to','socket:n'));assert.doesNotThrow(()=>M.validate(d));
}
{
 const d=M.empty('household');M.add(d,'house-socket',0,0).id='socket';const load=M.add(d,'house-insulated',260,0);load.id='load';const w=M.addWire(d,120,40);M.attach(d,w.id,'from','socket:l');const p=M.endpoints(d).get(w.to),next=J.component(d,'load',{x:p.x+86,y:p.y},24);assert(next);assert.equal(next.doc.wires[0].to,'load:n','neutral appliance lead may snap onto the live supply net');
}
{
 const d=P.create('C02');const a=d.wires.find(w=>w.to==='switch:a'),b=d.wires.find(w=>w.from==='switch:b'),direct=d.wires.find(w=>w.to==='load:n');a.from='socket:n';b.to='load:n';direct.from='socket:l';direct.to='load:l';assert.doesNotThrow(()=>M.validate(d));a.from='socket:e';assert.doesNotThrow(()=>M.validate(d));
}
assert.throws(()=>Profile.compile({role:'teacher',initialDocument:P.create('C01')}),/分析種類/);
assert.throws(()=>M.validate({...P.create('C01'),kind:'simlab-circuit',version:6}),/欄位|家庭/);
assert.equal(Object.keys(C.definitions).length,11);
for(const stance of ['grounded','insulated']){
 const d=P.create('C03'),person=d.components.find(c=>c.id==='person');person.params.stance=stance;
 assert.deepEqual(C.hand(person),{x:person.x+40,y:person.y+(stance==='insulated'?-35:-13)});
 const wire=M.addWire(d,person.x+150,person.y+150),end=M.endpoints(d).get(wire.to),h=C.hand(person);
 const snapped=J.component(d,'person',{x:person.x+end.x-h.x+4,y:person.y+end.y-h.y+3},24);assert(snapped);assert.equal(snapped.doc.wires.find(w=>w.id===wire.id).to,'person:hand');assert.doesNotThrow(()=>M.validate(snapped.doc));
 M.connect(d,'socket:l','person:hand');assert(M.connect(d,'socket:n','person:hand'));assert(new (require('./household-model').Session)(d).read().shortCircuit);
}
for(const type of ['house-mains','house-earth'])for(const end of ['from','to']){
 const d=M.empty('household'),c=M.add(d,type,0,0);assert.equal(d.wires.length,0);const endpoint=c.id+':'+(type==='house-mains'?'l':'e'),w=M.addWire(d,140,70);assert(M.attach(d,w.id,end,endpoint));assert.equal(w.anchor,undefined);assert.doesNotThrow(()=>M.validate(d));
 const legacy=M.clone(d);legacy.wires[0].anchor=endpoint;const original=M.clone(legacy);assert.deepEqual(M.validate(legacy),d,'legacy pins release without changing the circuit');assert.deepEqual(legacy,original);
 const template=require('./circuit-document').template(d);assert.equal(template.wires.length,0);assert.equal(template.junctions.length,0);
 M.detach(d,w.id,end);assert(M.attach(d,w.id,end,endpoint));const G=require('./circuit-routing'),route=G.route(d,w),point=G.nearest(route,G.along(route,G.length(route)/2));M.splitWire(d,w.id,point,route);assert.doesNotThrow(()=>M.validate(d));
 M.remove(d,c.id);assert.equal(d.wires.length,2,'removing a component unplugs ordinary cables');assert.doesNotThrow(()=>M.validate(d));M.remove(d,d.wires[0].id);assert.equal(d.wires.length,1);
}
for(const target of ['load:e','person:hand']){
 const d=P.create('C03');d.wires=d.wires.filter(w=>w.from!=='earth:e');const w=M.connect(d,'earth:e',target);assert.equal(w.anchor,undefined);assert.doesNotThrow(()=>M.validate(d));M.detach(d,w.id,'from');assert(M.attach(d,w.id,'from','earth:e'));
}
for(const end of ['from','to']){
 const d=M.empty('household'),earth=M.add(d,'house-earth',0,0),w=M.addWire(d,190,90),p=M.endpoints(d).get(w[end]);const snap=J.component(d,earth.id,{x:p.x-58+5,y:p.y-4},24);assert(snap);assert.equal(snap.doc.wires[0][end],earth.id+':e');assert.equal(snap.doc.wires[0].anchor,undefined);
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

for(const stance of ['grounded','insulated'])for(const hand of ['hand','hand-left'])for(const end of ['from','to'])for(const role of ['l','n','e']){
 const d=P.create('C03'),person=d.components.find(c=>c.id==='person');person.params.stance=stance;
 const w=M.addWire(d,person.x+140,person.y+120),other=end==='from'?'to':'from';assert(M.attach(d,w.id,other,'socket:'+role));const p=M.endpoints(d).get(w[end]),h=M.endpoints(d).get('person:'+hand),before=M.clone(d);
 const snapped=J.component(d,'person',{x:person.x+p.x-h.x+4,y:person.y+p.y-h.y-3},24,'person:'+hand);assert(snapped);assert.deepEqual(d,before);assert.equal(snapped.snap.id,'person:'+hand);assert.equal(snapped.snap.connections.length,1);assert.equal(snapped.doc.wires.find(v=>v.id===w.id)[end],'person:'+hand);assert.equal(snapped.doc.wires.find(v=>v.id===w.id)[other],'socket:'+role);
 const point=M.endpoints(snapped.doc).get('person:'+hand);assert.equal(point.x,p.x);assert.equal(point.y,p.y);
 const H=require('./household-model'),s=new H.Session(snapped.doc),r=s.read().components.person;assert(Math.abs(r.current-(stance==='grounded'&&role==='l'?.115:0))<1e-5);const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);assert(restored.read().reliable);restored.destroy();s.destroy();
}
{
 const d=M.empty('household'),person=M.add(d,'house-person',0,0);person.id='person';const ports=M.endpoints(d),left=ports.get('person:hand-left'),right=ports.get('person:hand'),w=M.addWire(d,left.x+90,left.y);assert.equal(J.component(d,'person',{x:0,y:0},10,'person:hand'),null,'a right-hand grip cannot dock the left hand');
 const v=M.addWire(d,right.x+90,right.y),next=J.component(d,'person',{x:1,y:1},10,'person:hand');assert(next);assert.equal(next.doc.wires.find(x=>x.id===v.id).from,'person:hand');assert.equal(next.doc.wires.find(x=>x.id===w.id).from,w.from,'the other hand stays disconnected');assert.equal(J.component(d,'person',{x:0,y:0},24,'person:missing'),null);
}
{
 const d=M.empty('household');M.add(d,'house-mains',-200,0).id='source';M.add(d,'house-person',0,0).id='person';const fixed=M.connect(d,'source:n','person:hand-left'),ends=M.endpoints(d),a=ends.get(fixed.from),b=ends.get(fixed.to);fixed.length=Math.hypot(b.x-a.x,b.y-a.y);const w=M.addWire(d,100,-13);assert(M.attach(d,w.id,'from','source:l'));const before=M.clone(d);assert.equal(J.component(d,'person',{x:150,y:0},24,'person:hand'),null,'the other wired hand cannot stretch past its cable length');assert.deepEqual(d,before);
}
for(const role of ['l','n']){
 const d=P.create('C03'),person=d.components.find(c=>c.id==='person');M.connect(d,'socket:l','person:hand');const w=M.addWire(d,person.x+20,person.y);assert(M.attach(d,w.id,'from','socket:'+role));const ends=M.endpoints(d),h=ends.get('person:hand'),p=ends.get(w.to),before=M.clone(d),next=J.component(d,'person',{x:person.x+p.x-h.x,y:person.y+p.y-h.y},24,'person:hand');assert(next,'same-hand supply-net mixing is now accepted');assert.equal(new (require('./household-model').Session)(next.doc).read().shortCircuit,role==='n');assert.deepEqual(d,before);
}

for(const stance of ['grounded','insulated'])for(const end of ['from','to']){
 const d=P.create('C03'),person=d.components.find(c=>c.id==='person');person.params.stance=stance;
 const left=M.endpoints(d).get('person:hand-left');assert.equal(left.x,person.x-25);assert.equal(left.y,person.y+(stance==='insulated'?-2:20));
 const wire=M.addWire(d,person.x+150,person.y+150),p=M.endpoints(d).get(wire[end]);
 const snapped=J.component(d,'person',{x:person.x+p.x-left.x+4,y:person.y+p.y-left.y+3},24);assert(snapped);assert.equal(snapped.doc.wires.find(w=>w.id===wire.id)[end],'person:hand-left');assert.doesNotThrow(()=>M.validate(snapped.doc));
 M.connect(d,'socket:l','person:hand');M.connect(d,'socket:n','person:hand-left');assert.doesNotThrow(()=>M.validate(d));
 assert(M.connect(d,'socket:l','person:hand-left'));assert(new (require('./household-model').Session)(d).read().shortCircuit);
}

for(const stance of ['grounded','insulated'])for(const hand of ['hand','hand-left'])for(const target of ['earth:e','socket:e','wire']){
 const d=M.empty('household');M.add(d,'house-mains',-160,-100).id='source';M.add(d,'house-earth',0,0).id='earth';M.add(d,'house-socket',220,22).id='socket';const person=M.add(d,'house-person',300,170,{stance});person.id='person';
 const earthWire=M.connect(d,'earth:e','socket:e',[],'free'),other=hand==='hand'?'hand-left':'hand';M.connect(d,'source:l','person:'+other,[],'free');
 const ends=M.endpoints(d),p=target==='wire'?{x:140,y:0}:ends.get(target),h=ends.get('person:'+hand),initial=M.clone(d);assert.equal(J.component(d,'person',{x:person.x+p.x-h.x,y:person.y+p.y-h.y+4},24,'person:'+hand),null,'ordinary components do not create wires by overlapping fixed terminals or wire bodies');assert.deepEqual(d,initial);
 const cable=M.addWire(d,140,140);M.attach(d,cable.id,'from','earth:e');const free=M.endpoints(d).get(cable.to),before=M.clone(d),next=J.component(d,'person',{x:person.x+free.x-h.x,y:person.y+free.y-h.y+4},24,'person:'+hand);assert(next,target+' '+hand);assert.deepEqual(d,before);assert.equal(next.snap.id,'person:'+hand);assert.equal(next.snap.connections.length,1);assert.equal(next.doc.wires.length,d.wires.length);assert.equal(next.doc.wires.find(w=>w.id===cable.id).to,'person:'+hand);
 const topology=Rules.inspect(next.doc);assert.equal(topology.find('earth:e'),topology.find('socket:e'));assert.equal(topology.find('earth:e'),topology.find('person:'+hand));assert.equal(next.doc.wires.find(w=>w.from==='source:l').to,'person:'+other);
 if(target!=='wire')assert.deepEqual(next.doc.wires.find(w=>w.id===earthWire.id),earthWire,'touching an occupied E terminal must not unplug its earth wire');
 const H=require('./household-model'),s=new H.Session(next.doc),r=s.read().components.person;assert(Math.abs(r.current-(stance==='insulated'?.115:230/1500))<1e-5);if(stance==='insulated')assert.equal(r.groundCurrent,0);
 const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);assert(restored.read().reliable);restored.destroy();s.destroy();
 const history=M.history(d);history.change(doc=>Object.assign(doc,next.doc));assert(history.undo());assert.deepEqual(history.get(),before);assert(history.redo());assert.deepEqual(history.get(),next.doc);
 const full=M.clone(d);full.cables.count=full.wires.length;assert(J.component(full,'person',{x:person.x+free.x-h.x,y:person.y+free.y-h.y},24,'person:'+hand),'an existing cable can connect with no spare stock');assert.deepEqual(d,before);
 const moved=M.clone(next.doc);moved.components.find(c=>c.id==='person').y+=40;assert(M.reconcile(moved,next.doc));assert.equal(moved.wires.length,next.doc.wires.length);assert.deepEqual(moved.wires.map(w=>[w.id,w.from,w.to]),next.doc.wires.map(w=>[w.id,w.from,w.to]),'moving a wired person retains the ordinary cables');
 const eOnly=M.clone(next.doc);M.remove(eOnly,eOnly.wires.find(w=>w.from==='source:l').id);const safe=new H.Session(eOnly);assert(Math.abs(safe.read().components.person.current)<1e-9,'earth-only hand contact has no body current');safe.destroy();
}
{
 const d=M.empty('household'),person=M.add(d,'house-person',300,170);person.id='person';M.add(d,'house-earth',0,0).id='earth';M.add(d,'house-socket',220,22).id='socket';const w=M.connect(d,'earth:e','socket:e',[],'free');
 assert.equal(J.component(d,'person',{x:18+.01,y:13},24,'person:hand'),null);assert.deepEqual(d.wires,[w],'being near E never adds a cable');
}
{
 const d=M.empty('household');M.add(d,'house-mains',-200,0).id='source';M.add(d,'house-person',0,0).id='person';M.add(d,'house-earth',400,0).id='earth';const w=M.connect(d,'source:l','person:hand-left',[],'free'),G=require('./circuit-routing');w.length=G.length(G.route(d,w));const before=M.clone(d);
 assert.equal(J.component(d,'person',{x:418,y:13},24,'person:hand'),null,'an existing other-hand cable cannot stretch to reach earth');assert.deepEqual(d,before);
 d.components.find(c=>c.id==='person').locked=true;assert.equal(J.component(d,'person',{x:418,y:13},24,'person:hand'),null);
}
console.log('Household: ordinary hand ports reuse existing cables; no automatic wires at E or wire bodies; stock, movement, history and round-trips passed');
