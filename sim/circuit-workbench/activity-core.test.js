'use strict';
const assert=require('node:assert/strict'),M=require('./circuit-model'),D=require('./circuit-document'),P=require('./presets'),Profile=require('./circuit-profile'),C=require('./circuit-checks'),A=require('./activity-profiles');
let cases=0;
function test(name,fn){fn();cases++;console.log('✓ '+name);}
function edit(doc,fn){const next=M.clone(doc);fn(next);return next;}
function cable(doc,from,to){const a=M.endpoints(doc).get(from),b=M.endpoints(doc).get(to),w=M.addWire(doc,(a.x+b.x)/2,(a.y+b.y)/2);assert(M.attach(doc,w.id,'from',from));assert(M.attach(doc,w.id,'to',to));return w;}
function correct(id){const config=A.create(id),d=config.initialDocument;
  if(id==='two-lamps')cable(d,'c1:b','c2:a');
  else if(id==='fixed'){cable(d,'c1:a','c2:a');cable(d,'c2:b','c3:a');cable(d,'c3:b','c4:a');cable(d,'c4:b','c1:b');}
  else if(id==='slider'){cable(d,'c1:a','c2:a');cable(d,'c2:b','c3:a');cable(d,'c3:b','c4:b');cable(d,'c4:a','c1:b');}
  return d;
}
test('author settings are fail-closed and copied',()=>{
  assert.throws(()=>Profile.compile({ui:{teacher:true}}));assert.throws(()=>Profile.compile({role:'student',ui:{settings:true}}));
  assert.throws(()=>Profile.compile({palette:[{type:'lamp',limit:0}]}));assert.throws(()=>Profile.compile({components:{byType:{rheostat:{params:['oops']}}}}));
  assert.throws(()=>Profile.compile({palette:[{type:'lamp'},{type:'lamp'}]}));
  const config=A.create('fixed'),p=Profile.compile(config);config.components.byType.switch.switch=false;assert(p.allows(p.initial,p.initial.components[1],'switch'));
});
test('fixed parts reject movement, rotation, removal, parameter and permission changes',()=>{
  const p=Profile.compile(A.create('fixed')),d=p.initial;
  for(const mutate of [n=>n.components[0].x+=20,n=>n.components[0].angle=0,n=>n.components.shift(),n=>n.components[0].params.voltage=9,n=>n.components[0].editable=true,n=>n.policy.allowParams=true,n=>n.cables.count=20,n=>n.display.values=true])assert.throws(()=>p.assertTransition(d,edit(d,mutate)));
});
test('a switch and physical cables remain editable in fixed activities',()=>{
  const p=Profile.compile(A.create('fixed')),d=p.initial,n=edit(d,n=>n.components[1].params.closed=false);p.assertTransition(d,n);
  const connected=correct('fixed');p.assertTransition(d,connected);assert(A.create('fixed').check(connected).passed);
});
test('the slider exposes position alone and its four terminals stay fixed',()=>{
  const p=Profile.compile(A.create('slider')),d=p.initial,c=d.components[3];assert.equal(c.params.terminals,4);
  assert(p.allows(d,c,'params','position'));assert(!p.allows(d,c,'params','resistance'));assert(!p.allows(d,c,'move'));
  p.assertTransition(d,edit(d,n=>n.components[3].params.position=.8));
  for(const k of ['resistance','terminals'])assert.throws(()=>p.assertSnapshot(edit(d,n=>n.components[3].params[k]=k==='terminals'?2:60)));
});
test('toolbox whitelist and stock apply to additions and imported answers',()=>{
  const p=Profile.compile(A.create('toolbox')),d=M.clone(p.initial);
  M.add(d,'lamp',100,100);M.add(d,'lamp',260,100);p.assertSnapshot(d);assert(!p.canAdd(p.palette[2],d));
  assert.throws(()=>p.assertSnapshot(edit(d,n=>M.add(n,'lamp',400,100))));assert.throws(()=>p.assertSnapshot(edit(d,n=>M.add(n,'voltmeter',400,100))));
  assert.throws(()=>p.assertSnapshot(edit(d,n=>n.components[0].params.model='thermal')));
  const n=edit(d,n=>n.components[0].x+=20);p.assertTransition(d,n);const r=edit(n,n=>M.rotateComponent(n,'c1'));p.assertTransition(n,r);
  p.assertTransition(r,edit(r,n=>M.remove(n,'c1')));
});
test('preplaced stock is included; existing fixed parts need not be in the toolbox',()=>{
  const d=A.create('two-lamps').initialDocument,p=Profile.compile({initialDocument:d,palette:[{type:'lamp',limit:2}],ui:{palette:true}});
  assert.equal(p.count(d,p.palette[0]),2);assert(!p.canAdd(p.palette[0],d));assert.doesNotThrow(()=>Profile.compile(A.create('fixed')));
});
test('wire length, stock, and no-wiring profiles cannot be overridden',()=>{
  const config=A.create('two-lamps'),p=Profile.compile(config),d=correct('two-lamps');
  assert.throws(()=>p.assertSnapshot(edit(d,n=>n.wires[0].length=900)));
  const frozen=Profile.compile({...config,wires:false});assert.throws(()=>frozen.assertSnapshot(d));
  const full=edit(config.initialDocument,n=>{for(let i=0;i<4;i++)M.addWire(n,200,100+i*30);});p.assertSnapshot(full);assert.throws(()=>M.addWire(full,200,300));
});
test('read-only rejects topology, parameters and display edits without changing the original',()=>{
  const p=Profile.compile(A.create('slider')),d=p.initial,saved=D.encode(d);
  for(const mutate of [n=>M.addWire(n,300,200),n=>n.components[3].params.position=.8,n=>n.display.view='schematic'])assert.throws(()=>p.assertTransition(d,edit(d,mutate),true));
  p.assertTransition(d,d,true);assert.equal(D.encode(d),saved);
});
test('snapshot constraints respect document locks and JSON key order',()=>{
  const config=A.create('slider');config.initialDocument.components[3].locked=true;const p=Profile.compile(config),d=p.initial;
  assert(!p.allows(d,d.components[3],'params','position'));assert.throws(()=>p.assertSnapshot(edit(d,n=>n.components[3].params.position=.8)));
  const reordered=edit(d,n=>{n.policy=Object.fromEntries(Object.entries(n.policy).reverse());n.cables=Object.fromEntries(Object.entries(n.cables).reverse());n.display=Object.fromEntries(Object.entries(n.display).reverse());});p.assertSnapshot(reordered);
});
test('valid partial snapshots restore and continue; unrelated policy/data is rejected',()=>{
  for(const id of ['two-lamps','fixed','slider']){
    const config=A.create(id),p=Profile.compile(config),partial=edit(p.initial,n=>M.addWire(n,340,240)),restored=p.assertSnapshot(D.decode(D.encode(partial)));
    assert.deepEqual(restored,partial);const next=edit(restored,n=>M.attach(n,n.wires[0].id,'from',n.components[0].id+':a'));p.assertTransition(restored,next);D.decode(D.encode(next));
    assert.throws(()=>p.assertSnapshot(edit(restored,n=>n.components[0].params.resistance=4)));
  }
});
test('teacher retains free editing and wiring-policy restrictions',()=>{
  const p=Profile.compile({role:'teacher',initialDocument:P.create('series')}),d=p.initial;
  p.assertTransition(d,edit(d,n=>n.components[0].params.voltage=9));p.assertSnapshot(P.create('parallel'));
  const fixed=edit(d,n=>n.policy.mode='wiring');assert(!p.allows(fixed,fixed.components[0],'move'));assert.throws(()=>p.assertTransition(fixed,edit(fixed,n=>n.components[0].x+=20)));
});
test('an unpowered two-lamp series connection is checked by topology',()=>{
  const config=A.create('two-lamps'),empty=config.initialDocument,d=correct('two-lamps');assert(!config.check(empty).passed);assert(config.check(d).passed);
  const reordered=edit(d,n=>{n.wires[0].from='c1:a';n.wires[0].to='c2:b';});assert(config.check(reordered).passed);
  const geometry=edit(d,n=>{n.wires[0].via=[{x:400,y:120}];});assert(config.check(geometry).passed);
});
test('parallel, bypassed, disconnected and branched lamps fail series checks',()=>{
  const d=correct('two-lamps');cable(d,'c1:a','c2:b');assert(!C.series(d,['c1','c2']).passed);
  const short=correct('two-lamps');cable(short,'c1:a','c1:b');assert(!C.series(short,['c1','c2']).passed);
  const disconnected=A.create('two-lamps').initialDocument;assert(!C.series(disconnected,['c1','c2'],{requirePowered:true}).passed);
  const branch=correct('two-lamps'),r=M.add(branch,'resistor',410,340);cable(branch,r.id+':a','c1:b');assert(!C.series(branch,['c1','c2']).passed);
  assert(!C.series(P.create('parallel'),['c3','c4'],{requirePowered:true}).passed);
});
test('powered checks require a closed valid circuit, not equal zero readings',()=>{
  const d=correct('fixed'),config=A.create('fixed');assert(config.check(d).passed);d.components[1].params.closed=false;assert(!config.check(d).passed);
  const sourceShort=correct('fixed');cable(sourceShort,'c1:a','c1:b');assert(!config.check(sourceShort).passed);
});
test('endpoint checks follow multiple physical wires through junctions, not crossings',()=>{
  const d=A.create('two-lamps').initialDocument,w1=M.addWire(d,340,200),w2=M.addWire(d,460,200);
  M.attach(d,w1.id,'from','c1:b');M.attach(d,w2.id,'to','c2:a');assert(!C.connected(d,[['c1:b','c2:a']]).passed);
  M.attach(d,w2.id,'from',w1.to);assert(C.connected(d,[['c1:b','c2:a']]).passed);assert(!C.connected(d,[['c1:a','c2:b']]).passed);
});
test('parameter checks support numeric tolerance, ranges and exact model values',()=>{
  const d=correct('slider');assert(C.parameter(d,{id:'c4',key:'position',value:.5}).passed);assert(C.parameter(d,{id:'c4',key:'resistance',min:39,max:41}).passed);
  assert(C.parameter(d,{id:'c3',key:'model',value:'ideal'}).passed);assert(!C.parameter(d,{id:'c4',key:'position',value:.6}).passed);assert(!C.parameter(d,{id:'missing',key:'position',value:.5}).passed);
});
test('slider AP dims, BP brightens, AB and P1/P2 do not change brightness',()=>{
  const d=correct('slider'),config=A.create('slider'),saved=D.encode(d),good=config.check(d);assert(good.passed);assert.equal(D.encode(d),saved);assert.equal(good.evidence.samples.length,3);
  const wire=d.wires.find(w=>w.from==='c4:a');
  for(const port of ['c','d']){const wrong=edit(d,n=>n.wires.find(w=>w.id===wire.id).from='c4:'+port);assert(!config.check(wrong).passed);}
  const fixed=edit(d,n=>n.wires.find(w=>w.to==='c4:b').to='c4:c');assert(!config.check(fixed).passed);
});
test('slider rejects open circuits and respects physical right after rotation',()=>{
  const config=A.create('slider'),d=correct('slider');assert(!config.check(config.initialDocument).passed);assert(!config.check(edit(d,n=>n.components[1].params.closed=false)).passed);
  const reverse=edit(d,n=>n.components[3].angle=180);assert(!config.check(reverse).passed);assert(C.sliderEffect(reverse,{rheostat:'c4',lamp:'c3',direction:'left'}).passed);
  assert(!config.check(edit(d,n=>n.components[3].angle=90)).passed);
});
test('all examples accept legal unanswered documents and only correct work passes',()=>{
  for(const definition of A.definitions){const config=A.create(definition.id),p=Profile.compile(config);assert(!config.check(p.initial).passed);p.assertSnapshot(D.decode(D.encode(p.initial)));}
  for(const id of ['two-lamps','fixed','slider'])assert(A.create(id).check(correct(id)).passed);
});
console.log(`Activity foundation: ${cases} focused groups passed.`);
