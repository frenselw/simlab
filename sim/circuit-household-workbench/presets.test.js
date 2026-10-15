'use strict';
const assert=require('node:assert/strict'),P=require('./presets'),C=require('../circuit-workbench/circuit-household-components'),M=require('../circuit-workbench/circuit-model'),H=require('../circuit-workbench/household-model'),R=require('../circuit-workbench/component-registry'),V=require('../circuit-workbench/circuit-renderer');
for(const [key,name]of Object.entries(P.names)){const d=P.create(key);assert.equal(d.components.length,key==='empty'?0:key==='C10'?3:key==='C09'?2:key==='C01'||key==='C04'?6:key==='C05'||key==='C08'?4:5);assert(d.components.every(c=>Object.hasOwn(C.definitions,c.type)));assert(Object.hasOwn(P.questions,key));assert(name);const s=new H.Session(d);assert.equal(s.read().reliable,true);if(key!=='empty')assert(key==='C09'?s.read().components.person.current>.1:s.read().components.load.power>0);s.destroy();}
assert.throws(()=>P.create('unknown'));
assert.deepEqual(P.groups.flatMap(g=>g.keys).sort(),Object.keys(P.names).filter(k=>k!=='empty').sort(),'each example appears in one group');
assert.deepEqual(C.palette.map(p=>p.type),['house-mains','house-meter','house-breaker','house-rcd','house-fuse','house-switch','house-socket','house-earth','house-metal','house-insulated','house-person']);
for(const type of ['house-breaker','house-rcd'])for(const angle of [0,45,90,180])for(const view of ['real','schematic']){
 const c=M.add(M.empty('household'),type,100,200);c.angle=angle;const a=R.rotation(angle),at=(x,y)=>({x:c.x+x*a.cos-y*a.sin,y:c.y+x*a.sin+y*a.cos});assert(C.switchHit(c,at(0,11),view));for(const [x,y]of [[0,-38],[0,48],[-40,0],[40,0]])assert(!C.switchHit(c,at(x,y),view),'outside handle selects without operating');
}
for(const key of Object.keys(P.names).filter(k=>k!=='empty')){
 const d=P.create(key),G=require('../circuit-workbench/circuit-routing');
 for(const role of ['C09','C10'].includes(key)?[]:['l','n']){
  const branch=d.wires.find(w=>w.to==='socket:'+role&&w.from.startsWith('bus-')),points=G.route(d,branch);
  assert.equal(M.degree(d,branch.from),3,'supply branch has a real junction');
  assert.equal(points[0].x,points[1].x);assert(points[1].y>points[0].y,'socket branch drops from the horizontal supply');
  const main=d.wires.filter(w=>w.to.startsWith('bus-'+role)&&!w.from.startsWith('socket'));
  assert(main.length>=2);for(const w of main){const p=G.route(d,w);assert(p.every(q=>q.y===p[0].y));assert(p.at(-1).x>p[0].x,'supply continues right after protection');}
 }
 for(const w of d.wires){const p=G.route(d,w);for(let n=1;n<p.length;n++)assert(p[n].x===p[n-1].x||p[n].y===p[n-1].y,key+' uses square wire bends');}
 for(const w of d.wires){const p=G.route(d,w);for(const c of d.components)for(const port of R.ports(c).filter(port=>port.id!==w.from&&port.id!==w.to))for(let n=1;n<p.length;n++){const a=p[n-1],b=p[n];assert(!(a.x===b.x&&Math.abs(port.x-a.x)<.1&&port.y>=Math.min(a.y,b.y)&&port.y<=Math.max(a.y,b.y)||a.y===b.y&&Math.abs(port.y-a.y)<.1&&port.x>=Math.min(a.x,b.x)&&port.x<=Math.max(a.x,b.x)),key+' '+w.id+' passes unconnected '+port.id);}}
 for(let i=0;i<d.wires.length;i++)for(let j=i+1;j<d.wires.length;j++){const p=G.route(d,d.wires[i]),q=G.route(d,d.wires[j]);for(let a=1;a<p.length;a++)for(let b=1;b<q.length;b++){const u=p[a-1],v=p[a],x=q[b-1],y=q[b],overlap=u.x===v.x&&x.x===y.x&&u.x===x.x?Math.min(Math.max(u.y,v.y),Math.max(x.y,y.y))-Math.max(Math.min(u.y,v.y),Math.min(x.y,y.y)):u.y===v.y&&x.y===y.y&&u.y===x.y?Math.min(Math.max(u.x,v.x),Math.max(x.x,y.x))-Math.max(Math.min(u.x,v.x),Math.min(x.x,y.x)):0;assert(overlap<.001,key+' has overlapping '+d.wires[i].id+' and '+d.wires[j].id);}}
 for(const w of d.wires){const p=G.route(d,w);for(const c of d.components.filter(c=>!w.from.startsWith(c.id+':')&&!w.to.startsWith(c.id+':'))){const b=R.bodyBounds(c);for(let n=1;n<p.length;n++){const a=p[n-1],z=p[n];assert(!(a.x===z.x&&a.x>b.left+2&&a.x<b.right-2&&Math.max(a.y,z.y)>b.top+2&&Math.min(a.y,z.y)<b.bottom-2||a.y===z.y&&a.y>b.top+2&&a.y<b.bottom-2&&Math.max(a.x,z.x)>b.left+2&&Math.min(a.x,z.x)<b.right-2),key+' '+w.id+' crosses unrelated '+c.id);}}}
}
{
 const d=P.create('C06'),s=new H.Session(d),branch=d.wires.find(w=>w.to==='socket:l');M.detach(d,branch.id,'to');s.update(d);
 assert(Math.abs(s.read().components.load.power)<1e-9);assert(s.read().components.load2.power>59,'second branch is independent of the first socket');s.destroy();
}
{
 const d=M.empty('household'),c=M.add(d,'house-person',0,0);assert.equal(C.definitions[c.type].primaryParameter,'stance');
 for(const stance of ['grounded','insulated']){
  c.params.stance=stance;const body=C.render(c,{contact:'load',current:.05});
  for(const detail of ['face','shirt','fingers','soles'])assert(body.includes('data-house-person-'+detail+'="true"'));
  assert(body.includes('data-house-person-support="'+stance+'"'));
  const left=R.ports(c).find(p=>p.key==='hand-left');assert.equal(left.x,-25);assert.equal(left.y,stance==='insulated'?-2:20);
  assert.deepEqual(C.hand(c),{x:40,y:stance==='insulated'?-35:-13},'artwork keeps the established contact anchor');
 }
}
assert(!C.definitions['house-insulated'].params.kind.choices.includes('lamp'));
assert(C.definitions['house-metal'].params.kind.choices.includes('washer'));assert(!C.definitions['house-metal'].params.kind.choices.includes('aircon'));
for(const [kind,rated]of [['washer',500],['aircon',1000]]){
 const d=P.create('C03'),load=d.components.find(c=>c.id==='load');load.params.kind=kind;const s=new H.Session(d);assert.equal(C.power(load),rated);assert(Math.abs(s.read().components.load.power-rated)<rated*.005);s.contact('person','load');const next=M.clone(s.doc);next.components.find(c=>c.id==='load').params.fault=true;s.update(next);assert(Math.abs(s.read().components.person.current)<1e-6);M.detach(next,next.wires.find(w=>w.to==='load:e').id,'from');s.update(next);assert(s.read().components.person.current>.05);const saved=s.capture(),restored=H.Session.restore(H.decode(H.encode(saved)));assert.deepEqual(restored.capture(),saved);restored.advance(.01);assert.equal(restored.doc.components.find(c=>c.id==='load').params.kind,kind);assert(restored.read().components.person.current>.05);restored.destroy();s.destroy();
}
assert.equal(C.definitions['house-insulated'].params.kind.value,'blender');
for(const [kind,rated]of [['blender',400],['vacuum',700]]){
 const d=P.create('C05'),load=d.components.find(c=>c.id==='load');load.params.kind=kind;
 const s=new H.Session(d);assert(Math.abs(s.read().components.load.power-rated)<rated*.005);const normal=H.Session.restore(H.decode(H.encode(s.capture())));normal.advance(.01);assert(Math.abs(normal.read().components.load.power-rated)<rated*.005);normal.destroy();s.contact('person','load');assert.equal(s.read().components.person.current,0);const next=M.clone(s.doc);next.components.find(c=>c.id==='load').params.fault=true;s.update(next);assert.equal(s.read().components.person.contact,'load');assert.equal(s.read().components.person.current,0);const restored=H.Session.restore(H.decode(H.encode(s.capture())));restored.advance(.01);assert.equal(restored.read().components.person.contact,'load');assert.equal(restored.read().components.person.current,0);restored.destroy();s.destroy();
}
{const d=P.create('C05'),load=d.components.find(c=>c.id==='load');load.params.kind='lamp';assert.equal(C.power(load),40);assert.equal(M.validate(d).components.find(c=>c.id==='load').params.kind,'lamp');const s=new H.Session(d);assert(s.read().components.load.power>39);s.destroy();load.params.kind='unknown';assert.throws(()=>M.validate(d));}
for(const [type,definition]of Object.entries(C.definitions)){const d=M.empty('household'),c=M.add(d,type,0,0);for(const view of ['real','schematic']){const body=V.body(c,null,{view,idPrefix:'one-'});assert(body.includes('data-house-apparatus="'+type+'"'));assert(!body.includes('undefined'));assert(!body.includes('NaN'));assert.equal(R.ports(c).length,definition.ports.length);}}
for(const type of ['house-metal','house-insulated'])for(const kind of Object.keys(C.applianceKinds[type==='house-metal'?'metal':'insulated'])){const d=M.empty('household'),c=M.add(d,type,0,0,{kind});const a=C.render(c,{power:C.power(c)},{view:'real',idPrefix:'first-'}),b=C.render(c,{power:0},{view:'real',idPrefix:'second-'});const ids=x=>[...x.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert(ids(a).every(id=>!ids(b).includes(id)));assert(a.includes(C.power(c)+' W'));if(type==='house-metal')assert(a.includes('data-house-earth-bond'));else assert(!R.ports(c).some(p=>p.key==='e'));}
console.log('Household: ten compact concepts / fuse variant, all apparatus and artwork namespaces passed');

{const c=M.add(M.empty('household'),'house-socket',0,0),body=C.render(c);assert.match(body,/data-house-socket-hole="e"[^>]*width="10" height="16"/);for(const k of ['n','l'])assert.match(body,new RegExp('data-house-socket-hole="'+k+'"[^>]*width="16" height="10"'));}
for(const energyKWh of [0,.1234,123456789]){const c=M.add(M.empty('household'),'house-meter',0,0),body=C.render(c,{energyKWh});assert(body.includes('aria-label="'+energyKWh.toFixed(4)+' kWh"'));assert.match(body,/data-house-energy-reading[^>]*><svg x="-22" y="-30" width="44" height="13"/);assert(!/<text[^>]*data-house-energy-reading/.test(body),'meter digits use bundled vector glyphs, independent of system font metrics');}
for(const kind of Object.keys(C.applianceKinds.metal)){
 const c=M.add(M.empty('household'),'house-metal',0,0,{kind,fault:true}),body=C.render(c),bond=body.match(/data-house-earth-bond="true" cx="([\d.-]+)" cy="([\d.-]+)"/),fault=body.match(/d="M([\d.-]+) ([\d.-]+)L[^" ]+ [^" ]+L([\d.-]+) ([\d.-]+)"[^>]*data-house-fault-path/),input=body.match(/d="M-86-26H-57L-45 ([\d.-]+)H([\d.-]+)"/);
 assert(bond&&fault&&input);assert(Number(bond[1])<0,'earth screw stays on the left');assert.deepEqual(fault.slice(1,3),[input[2],input[1]],'fault begins on the live internal lead');assert.deepEqual(fault.slice(3,5),bond.slice(1,3),'fault ends on the metal shell');assert(C.render(c,{}, {view:'schematic'}).includes('data-house-fault-path'));
}
for(const closed of [false,true]){const c=M.add(M.empty('household'),'house-switch',0,0,{closed});assert(!C.render(c).includes('M-18 48'),'real switch has no duplicate symbol below it');assert(C.render(c,{}, {view:'schematic'}).includes('M-20 0L20 '+(closed?0:-24)));}

for(const stance of ['grounded','insulated'])for(const view of ['real','schematic']){
 const d=P.create('C09');d.components.find(c=>c.id==='person').params.stance=stance;const s=new H.Session(d),c=s.doc.components.find(c=>c.id==='person'),r=s.read().components.person,ports=R.ports(c);
 const body=C.render(c,r,{view});assert(body.includes('data-house-person-reaction="true"'));assert(body.includes('data-house-person-grimace="true"'));assert(body.includes('data-house-person-shock="true"'));assert(body.includes('M40-13'));assert(body.includes('L-15-18-20-1-25 20'));assert.equal(body.includes('M0-12V8L1 31'),stance==='grounded');assert.deepEqual(R.ports(c),ports);
 const calm=C.render(c,{...r,current:0},{view});assert(calm.includes('data-house-person-reaction="false"'));assert(!calm.includes('data-house-person-grimace'));assert(!calm.includes('data-house-person-shock'));s.destroy();
}

for(const hand of ['hand','hand-left'])for(const stance of ['grounded','insulated']){
 const d=P.create('C03');d.components.find(c=>c.id==='person').params.stance=stance;M.connect(d,'socket:l','person:'+hand);const s=new H.Session(d),c=s.doc.components.find(c=>c.id==='person'),body=C.render(c,s.read().components.person);
 assert.equal(body.includes('data-house-person-shock'),stance==='grounded');
 if(stance==='grounded'){assert.equal(body.includes('M40-13'),hand==='hand');assert.equal(body.includes('M-25 20'),hand==='hand-left');assert(body.includes('M0-12V8L1 31'));}s.destroy();
}

for(const [key,id,low,high]of [['C08','socket','n','l'],['C09','person','hand-left','hand']]){
 const d=P.create(key),s=new H.Session(d),result=s.read(),before=s.capture(),options={potentialDirections:new Set([id])},label=V.labels(d,result,1,{},null,options).find(p=>p.id==='potential-'+id).rows[0];
 assert.equal(label.from,id+':'+low);assert.equal(label.to,id+':'+high);assert.equal(label.text,'電勢升高');
 const w=d.wires.find(w=>w.from==='source:l'),path=svg=>svg.match(new RegExp('data-wire="'+w.id+'"[^>]*stroke="([^"]+)"'))[1];
 assert.equal(path(V.scene(d,result)),'#a56535');d.display.potential=true;assert.equal(path(V.scene(d,result)),V.colour(result.wires[w.id].potential,V.potentialRange(result).max));
 assert.equal(result.wires[w.id].role,'L');assert.deepEqual(s.capture(),before,'display rendering does not change saved circuit state');s.destroy();
}

for(const [type,kinds]of [['house-metal',[...Object.keys(C.applianceKinds.metal),'aircon']],['house-insulated',[...Object.keys(C.applianceKinds.insulated),'lamp']]])for(const kind of kinds)for(const view of ['real','schematic']){
 const d=P.create(type==='house-metal'?'C03':'C05'),c=d.components.find(c=>c.id==='load');c.params.kind=kind;d.display.view=view;const s=new H.Session(d),before=s.capture(),r=s.read(),paths=V.componentFlowPaths(d,r).filter(p=>p.component==='load'),at=key=>paths.find(p=>p.key===key),near=(a,b)=>assert(Math.abs(a-b)<1e-8);
 for(const key of ['live','working','neutral'])assert(at(key)&&Number.isFinite(at(key).current));near(at('live').current,r.components.load.current);near(at('neutral').current,-r.components.load.current);assert.deepEqual(at('live').points[0],{x:c.x-86,y:c.y-26});assert.deepEqual(at('neutral').points[0],{x:c.x-86,y:c.y});assert.deepEqual(at('live').points.at(-1),at('working').points[0]);assert.deepEqual(at('working').points.at(-1),at('neutral').points.at(-1));if(type==='house-metal')near(at('earth').current,0);
 let svg=V.flow(d,r,{},.1,1);assert(svg.includes('data-flow-path="working"'));assert(!svg.includes('data-flow-path="earth"'));assert(!/NaN|Infinity/.test(svg));assert.notEqual(V.flow(d,r,{},.3,1),svg);const directions=text=>[...text.matchAll(/data-flow-component="load"[^>]*data-direction="(-?1)"/g)].map(m=>+m[1]);d.display.flow='electron';assert.deepEqual(directions(V.flow(d,r,{},.1,1)),directions(svg).map(v=>-v));d.display.flow='off';assert.equal(V.flow(d,r,{},.1,1),'');d.display.flow='current';assert.deepEqual(s.capture(),before);
 const reversed=M.clone(d);for(const w of reversed.wires){if(w.to==='load:l')w.to='load:n';else if(w.to==='load:n')w.to='load:l';}s.update(reversed);assert(V.componentFlowPaths(reversed,s.read()).find(p=>p.component==='load'&&p.key==='working').current<0);
 if(type==='house-metal'){
  s.update(d);s.contact('person','load');const fault=M.clone(s.doc);fault.components.find(c=>c.id==='load').params.fault=true;s.update(fault);let result=s.read(),p=V.componentFlowPaths(fault,result).filter(p=>p.component==='load');near(p.find(p=>p.key==='live').current,result.components.load.current+result.components.load.leakageCurrent);assert(p.find(p=>p.key==='earth').current<0);assert(V.flow(fault,result,{},.1,1).includes('data-flow-path="fault"'));
  M.detach(fault,fault.wires.find(w=>w.to==='load:e').id,'from');s.update(fault);result=s.read();p=V.componentFlowPaths(fault,result).filter(p=>p.component==='load');near(p.find(p=>p.key==='earth').current,0);assert(!V.flow(fault,result,{},.1,1).includes('data-flow-path="earth"'));assert(result.components.person.current>.05);
 }else{const broken=M.clone(d);broken.components.find(c=>c.id==='load').params.fault=true;s.update(broken);assert(!V.flow(broken,s.read(),{},.1,1).includes('data-flow-path="fault"'));}
 const off=M.clone(d);M.detach(off,off.wires.find(w=>w.to==='load:l').id,'to');s.update(off);assert(!V.flow(off,s.read(),{},.1,1).includes('data-flow-component="load"'));s.destroy();
}
console.log('Household internal flow: every appliance and legacy kind, both views, signed leads, fault/earth KCL, reverse wiring, zero suppression and immutable snapshots passed');
