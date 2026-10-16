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
assert.equal(Object.keys(C.definitions).length,12);
{
 const H=require('./household-model'),D=require('./circuit-document'),V=require('./circuit-renderer'),Profile=require('./circuit-profile'),d=M.empty('household');d.cables={count:40,length:1200,resistance:0};
 M.add(d,'house-mains',-200,-150).id='source';M.add(d,'house-socket',0,0).id='socket';M.add(d,'house-earth',-160,150).id='earth';
 const strip=M.add(d,'house-power-strip',300,150);strip.id='strip';
 M.connect(d,'source:l','socket:l');M.connect(d,'source:n','socket:n');M.connect(d,'earth:e','socket:e');
 for(const [i,type,kind]of [[1,'house-metal','fan'],[2,'house-insulated','blender'],[3,'house-insulated','fan']]){const c=M.add(d,type,180+i*180,400,{kind});c.id='load'+i;M.connect(d,'strip:l'+i,c.id+':l');M.connect(d,'strip:n'+i,c.id+':n');if(type==='house-metal')M.connect(d,'strip:e'+i,c.id+':e');}
 const before=M.clone(d),preview=C.previewPlug(d,'strip',{x:10,y:5},24);assert(preview?.snap);assert.deepEqual(d,before,'plug preview / cancellation never mutates the committed circuit');assert.equal(preview.doc.wires.length,d.wires.length,'integrated cable consumes no loose wires');assert.equal(C.plugContacts(preview.doc).length,3);assert.deepEqual(C.plugPoint(preview.doc.components.find(c=>c.id==='strip')),{x:0,y:0});
 const session=new H.Session(preview.doc),r=session.read();assert(r.reliable);for(const [i,power]of [[1,60],[2,400],[3,60]])assert(Math.abs(r.components['load'+i].power-power)<power*.005);assert(r.components.load1.earthed);assert(Math.abs(r.components.strip.current-r.components.source.current)<1e-7);assert.equal(Rules.inspect(preview.doc).roleOf('strip:l3'),'L');
 for(const angle of [0,45,90,135,180,225,270,315]){const turned=M.clone(d);turned.components.find(c=>c.id==='socket').angle=angle;const p=C.previewPlug(turned,'strip',{x:7,y:4},24);assert(p?.snap);assert.equal(p.doc.components.find(c=>c.id==='strip').params.plugAngle,angle);assert.equal(C.plugContacts(p.doc).length,3);}
 assert.equal(C.previewPlug(d,'strip',{x:1200,y:1200},24),null,'cord cannot extend beyond its fixed length');
 const locked=M.clone(d);locked.components.find(c=>c.id==='strip').locked=true;assert.equal(C.previewPlug(locked,'strip',{x:0,y:0},24),null);locked.components.find(c=>c.id==='strip').locked=false;locked.policy.mode='wiring';assert.equal(C.previewPlug(locked,'strip',{x:0,y:0},24),null);
 const profile=Profile.compile({role:'teacher',analysis:'household',initialDocument:d,palette:C.palette});assert.throws(()=>profile.assertTransition(d,preview.doc,true),/只讀/);
 const noWiring=Profile.compile({role:'teacher',analysis:'household',initialDocument:d,palette:C.palette,wires:false});assert.throws(()=>noWiring.assertTransition(d,preview.doc),/不允許改接拖板/);
 const crowded=M.clone(preview.doc),second=M.add(crowded,'house-power-strip',600,150);assert.equal(C.previewPlug(crowded,second.id,{x:0,y:0},24),null,'one plug per socket');
 const invalid=M.clone(crowded);Object.assign(invalid.components.find(c=>c.id===second.id).params,{plugX:-600,plugY:-150});assert.throws(()=>M.validate(invalid),/同一插位/);
 const chained=C.previewPlug(crowded,second.id,{x:400,y:150},24);assert(chained?.snap);assert.equal(C.plugContacts(chained.doc).length,6);const chainSession=new H.Session(chained.doc);assert(chainSession.read().potentials[second.id+':l1']>229);chainSession.destroy();
 assert.throws(()=>D.template(preview.doc),/拔開拖板插頭/);assert.doesNotThrow(()=>D.template(d));
 const saved=session.capture(),restored=H.Session.restore(H.decode(H.encode(saved)));assert.deepEqual(restored.capture(),saved);restored.advance(.01);assert(restored.read().components.load2.working);
 const noEarth=M.clone(restored.doc);M.detach(noEarth,noEarth.wires.find(w=>w.from==='earth:e').id,'from');restored.update(noEarth);assert(!restored.read().components.load1.earthed,'earth protection follows the actual third conductor');
 const unplugged=C.previewPlug(restored.doc,'strip',{x:-50,y:0});assert(unplugged);assert.equal(C.plugContacts(unplugged.doc).length,0);restored.update(unplugged.doc);assert(!restored.read().components.load1.working&&!restored.read().components.load2.working&&!restored.read().components.load3.working);restored.destroy();session.destroy();
 const history=M.history(d);history.replace(preview.doc);assert(history.undo());assert.equal(C.plugContacts(history.get()).length,0);assert(history.redo());assert.equal(C.plugContacts(history.get()).length,3);
 for(const view of ['real','schematic']){const c=preview.doc.components.find(c=>c.id==='strip'),art=C.render(c,{}, {view});assert.equal((art.match(/data-house-strip-socket=/g)||[]).length,3);assert.equal((art.match(/data-house-socket-hole=/g)||[]).length,9);assert(art.includes('data-house-strip-internal="true" opacity=".12"'));const cord=art.match(/<g data-house-strip-cord="true">(.*?)<\/g>/)[1];assert(cord.includes('stroke="#fff"'));for(const colour of Object.values(C.colours))assert(!cord.includes(colour),'external cord hides coloured cores');assert(art.includes('data-house-strip-plug="true"'));assert(!art.includes('NaN')&&!art.includes('undefined'));}
 const svg=V.scene(preview.doc,r,.7);assert(!svg.includes('data-port="strip:pl"'),'plug pins do not expose three loose wire targets');
 assert(!Object.keys(P.names).some(key=>P.create(key).components.some(c=>c.type==='house-power-strip')),'new component stays out of existing examples');
 const fs=require('node:fs'),vm=require('node:vm'),browser=vm.createContext({TextEncoder,CircuitMath:require('./circuit-math')});
 for(const file of ['component-registry','circuit-household-components','circuit-routing','circuit-model','household-connections'])vm.runInContext(fs.readFileSync(require.resolve('./'+file),'utf8'),browser);
 assert.equal(vm.runInContext('CircuitHouseholdComponents.previewPlug('+JSON.stringify(d)+',"strip",{x:10,y:5},24).snap.id',browser),'socket:e','deferred browser script order supports plug dragging');
}
console.log('Three-outlet strip: bundled plug snapping, parallel loads / earth, rotations, occupancy, cord limits, permissions, save / undo and subtle SVG passed');
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
 const H=require('./household-model'),s=new H.Session(snapped.doc),r=s.read().components.person;assert(Math.abs(r.current-(stance==='grounded'?Math.abs(s.read().potentials['socket:'+role])/(2000+.001):0))<1e-5,JSON.stringify({stance,hand,end,role,r,contacts:C.handContacts(snapped.doc)}));const restored=H.Session.restore(H.decode(H.encode(s.capture())));assert.deepEqual(restored.capture(),s.capture());restored.advance(.01);assert(restored.read().reliable);restored.destroy();s.destroy();
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
 const ends=M.endpoints(d),p=target==='wire'?{x:140,y:0}:ends.get(target),h=ends.get('person:'+hand),initial=M.clone(d),direct=J.component(d,'person',{x:person.x+p.x-h.x,y:person.y+p.y-h.y+4},24,'person:'+hand,[...M.endpoints(d).values()].filter(p=>!p.id.startsWith('person:')));if(target==='wire')assert.equal(direct,null,'wire bodies do not dock');else{assert(direct?.snap.contact);assert.equal(direct.snap.endpoint,target);assert.deepEqual(direct.doc.wires,d.wires,'touching a terminal creates no wire');}assert.deepEqual(d,initial);
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
 const snap=J.component(d,'person',{x:18+.01,y:13},24,'person:hand',[...M.endpoints(d).values()].filter(p=>!p.id.startsWith('person:')));assert(snap?.snap.contact);assert.equal(snap.snap.endpoint,'earth:e');assert.deepEqual(snap.doc.wires,[w],'touching E never adds a cable');assert.deepEqual(d.wires,[w],'preview does not change the source');
}
{
 const d=M.empty('household');M.add(d,'house-mains',-200,0).id='source';M.add(d,'house-person',0,0).id='person';M.add(d,'house-earth',400,0).id='earth';const w=M.connect(d,'source:l','person:hand-left',[],'free'),G=require('./circuit-routing');w.length=G.length(G.route(d,w));const before=M.clone(d);
 assert.equal(J.component(d,'person',{x:418,y:13},24,'person:hand'),null,'an existing other-hand cable cannot stretch to reach earth');assert.deepEqual(d,before);
 d.components.find(c=>c.id==='person').locked=true;assert.equal(J.component(d,'person',{x:418,y:13},24,'person:hand'),null);
}
console.log('Household: ordinary hand ports reuse existing cables; no automatic wires at E or wire bodies; stock, movement, history and round-trips passed');
for(const hand of ['hand','hand-left'])for(const [type,keys]of [['house-mains',['l','n']],['house-socket',['l','n','e']],['house-metal',['l','n','e']],['house-earth',['e']]])for(const key of keys){
 const d=M.empty('household'),target=M.add(d,type,0,0),person=M.add(d,'house-person',250,150),R=require('./component-registry'),D=require('./circuit-document'),a=R.ports(target).find(p=>p.key===key),b=R.ports(person).find(p=>p.key===hand);person.x+=a.x-b.x;person.y+=a.y-b.y;
 assert(C.handContacts(d).some(p=>p.hand===person.id+':'+hand&&p.target===target.id+':'+key));const before=M.clone(d);assert.throws(()=>D.template(d),/雙手移離元件接線端/);assert.deepEqual(d,before,'template rejection leaves the original circuit unchanged');
}
{
 const D=require('./circuit-document'),H=require('./household-model'),d=P.create('C09'),copy=D.template(d);assert.equal(C.handContacts(copy).length,0);assert.equal(copy.wires.length,0);assert.equal(copy.junctions.length,0);assert.equal(copy.policy.mode,'wiring');const s=H.Session.restore(H.decode(H.encode(new H.Session(copy).capture())));assert.equal(s.read().components.person.current,0);s.advance(.01);assert.equal(s.read().components.person.current,0);s.destroy();
 const shell=new H.Session(P.create('C03'));shell.contact('person','load');const safe=D.template(shell.doc),restored=new H.Session(safe);assert.equal(restored.state.contacts.person,null);assert.equal(restored.read().components.person.current,0);restored.destroy();shell.destroy();
}
