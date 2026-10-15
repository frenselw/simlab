'use strict';
const assert=require('node:assert/strict'),P=require('./presets'),C=require('../circuit-workbench/circuit-household-components'),M=require('../circuit-workbench/circuit-model'),H=require('../circuit-workbench/household-model'),R=require('../circuit-workbench/component-registry'),V=require('../circuit-workbench/circuit-renderer');
for(const [key,name]of Object.entries(P.names)){const d=P.create(key);assert.equal(d.components.length,key==='empty'?0:key==='C01'||key==='C04'?6:key==='C05'||key==='C08'?4:5);assert(d.components.every(c=>Object.hasOwn(C.definitions,c.type)));assert(Object.hasOwn(P.questions,key));assert(name);const s=new H.Session(d);assert.equal(s.read().reliable,true);if(key!=='empty')assert(s.read().components.load.power>0);s.destroy();}
assert.throws(()=>P.create('unknown'));
for(const key of Object.keys(P.names).filter(k=>k!=='empty')){
 const d=P.create(key),G=require('../circuit-workbench/circuit-routing');
 for(const role of ['l','n']){
  const branch=d.wires.find(w=>w.to==='socket:'+role&&w.from.startsWith('bus-')),points=G.route(d,branch);
  assert.equal(M.degree(d,branch.from),3,'supply branch has a real junction');
  assert.equal(points[0].x,points[1].x);assert(points[1].y>points[0].y,'socket branch drops from the horizontal supply');
  const main=d.wires.filter(w=>w.to.startsWith('bus-'+role)&&!w.from.startsWith('socket'));
  assert(main.length>=2);for(const w of main){const p=G.route(d,w);assert(p.every(q=>q.y===p[0].y));assert(p.at(-1).x>p[0].x,'supply continues right after protection');}
 }
 for(const w of d.wires){const p=G.route(d,w);for(let n=1;n<p.length;n++)assert(p[n].x===p[n-1].x||p[n].y===p[n-1].y,key+' uses square wire bends');}
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
  assert.deepEqual(C.hand(c),{x:40,y:stance==='insulated'?-35:-13},'artwork keeps the established contact anchor');
 }
}
assert(!C.definitions['house-insulated'].params.kind.choices.includes('lamp'));
assert.equal(C.definitions['house-insulated'].params.kind.value,'blender');
for(const [kind,rated]of [['blender',400],['vacuum',700]]){
 const d=P.create('C05'),load=d.components.find(c=>c.id==='load');load.params.kind=kind;
 const s=new H.Session(d);assert(Math.abs(s.read().components.load.power-rated)<rated*.005);const normal=H.Session.restore(H.decode(H.encode(s.capture())));normal.advance(.01);assert(Math.abs(normal.read().components.load.power-rated)<rated*.005);normal.destroy();s.contact('person','load');assert.equal(s.read().components.person.current,0);const next=M.clone(s.doc);next.components.find(c=>c.id==='load').params.fault=true;s.update(next);assert.equal(s.read().components.person.contact,'load');assert.equal(s.read().components.person.current,0);const restored=H.Session.restore(H.decode(H.encode(s.capture())));restored.advance(.01);assert.equal(restored.read().components.person.contact,'load');assert.equal(restored.read().components.person.current,0);restored.destroy();s.destroy();
}
{const d=P.create('C05'),load=d.components.find(c=>c.id==='load');load.params.kind='lamp';assert.equal(C.power(load),40);assert.equal(M.validate(d).components.find(c=>c.id==='load').params.kind,'lamp');const s=new H.Session(d);assert(s.read().components.load.power>39);s.destroy();load.params.kind='unknown';assert.throws(()=>M.validate(d));}
for(const [type,definition]of Object.entries(C.definitions)){const d=M.empty('household'),c=M.add(d,type,0,0);for(const view of ['real','schematic']){const body=V.body(c,null,{view,idPrefix:'one-'});assert(body.includes('data-house-apparatus="'+type+'"'));assert(!body.includes('undefined'));assert(!body.includes('NaN'));assert.equal(R.ports(c).length,definition.ports.length);}}
for(const type of ['house-metal','house-insulated'])for(const kind of Object.keys(C.applianceKinds[type==='house-metal'?'metal':'insulated'])){const d=M.empty('household'),c=M.add(d,type,0,0,{kind});const a=C.render(c,{power:C.power(c)},{view:'real',idPrefix:'first-'}),b=C.render(c,{power:0},{view:'real',idPrefix:'second-'});const ids=x=>[...x.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert(ids(a).every(id=>!ids(b).includes(id)));assert(a.includes(C.power(c)+' W'));if(type==='house-metal')assert(a.includes('data-house-earth-bond'));else assert(!R.ports(c).some(p=>p.key==='e'));}
console.log('Household: eight compact concepts / fuse variant, all apparatus and artwork namespaces passed');

{const c=M.add(M.empty('household'),'house-socket',0,0),body=C.render(c);assert.match(body,/data-house-socket-hole="e"[^>]*width="10" height="16"/);for(const k of ['n','l'])assert.match(body,new RegExp('data-house-socket-hole="'+k+'"[^>]*width="16" height="10"'));}
for(const kind of Object.keys(C.applianceKinds.metal)){
 const c=M.add(M.empty('household'),'house-metal',0,0,{kind,fault:true}),body=C.render(c),bond=body.match(/data-house-earth-bond="true" cx="([\d.-]+)" cy="([\d.-]+)"/),fault=body.match(/d="M([\d.-]+) ([\d.-]+)L[^" ]+ [^" ]+L([\d.-]+) ([\d.-]+)"[^>]*data-house-fault-path/),input=body.match(/d="M-86-26H-57L-45 ([\d.-]+)H([\d.-]+)"/);
 assert(bond&&fault&&input);assert.deepEqual(fault.slice(1,3),[input[2],input[1]],'fault begins on the live internal lead');assert.deepEqual(fault.slice(3,5),bond.slice(1,3),'fault ends on the metal shell');assert(C.render(c,{}, {view:'schematic'}).includes('data-house-fault-path'));
}
