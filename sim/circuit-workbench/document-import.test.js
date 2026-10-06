'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('./circuit-model'),D=require('./circuit-document'),S=require('./circuit-solver'),P=require('./presets'),R=require('./component-registry'),G=require('./circuit-routing');
let cases=0;const test=(name,fn)=>{fn();cases++;};
test('v4 inward sockets migrate taut wires and retain mirrored identities',()=>{
  for(const type of ['ammeter','voltmeter'])for(const angle of [0,90,180,270])for(const mirrored of [false,true])for(const key of ['a','b']){
    const d=M.empty();d.version=4;if(d.cables)delete d.cables.resistance;d.wires.forEach(w=>delete w.resistance);const c=M.add(d,type,350,350);Object.assign(c,{angle,mirrored});
    const oldPort=M.endpoints(d).get(c.id+':'+key),w=M.addWire(d,400,500);M.attach(d,w.id,'from',oldPort.id);
    const a=angle*Math.PI/180,sign=key==='a'?1:-1,factor=mirrored?-sign:sign;
    M.moveWireEnd(d,w.id,'to',{x:oldPort.x+120*factor*Math.cos(a),y:oldPort.y+120*factor*Math.sin(a)});M.straightenWire(d,w.id);w.length=120;d.display.reference=oldPort.id;
    const source=M.add(d,'battery',100,100),load=M.add(d,'resistor',280,100),other=M.connect(d,source.id+':a',load.id+':a');
    delete d.cables.resistance;d.wires.forEach(w=>delete w.resistance);const unrelated=M.clone(other),otherRoute=G.route(d,other),input=JSON.stringify(d),invalid=M.clone(d);invalid.wires[0].length=119;assert.throws(()=>D.decode(JSON.stringify(invalid)),/限定長度/);
    const restored=D.decode(input),p=M.endpoints(restored).get(oldPort.id);assert.equal(restored.version,6);assert.equal(restored.display.reference,oldPort.id);assert.equal(restored.components[0].mirrored,mirrored);
    assert(Math.abs(Math.hypot(p.x-oldPort.x,p.y-oldPort.y)-16)<1e-8);assert.equal(restored.wires[0].from,w.from);assert.equal(restored.wires[0].to,w.to);assert(restored.wires[0].length>=136);
    assert.deepEqual(restored.wires[1],{...unrelated,resistance:0});assert.deepEqual(G.route(restored,restored.wires[1]),otherRoute);assert.equal(JSON.stringify(d),input,'import does not mutate source');
    const round=D.decode(D.encode(restored));assert.deepEqual(round,restored);assert(M.attach(round,w.id,'to',c.id+':c'),'migrated partial wire can continue to the central socket');D.decode(D.encode(round));S.solve(round);
  }
});
const oldDocument=()=>{const d=P.create('ohm');d.version=5;delete d.cables.resistance;d.wires.forEach(w=>delete w.resistance);return({...d,measurements:{voltage:'c4',current:'c2',resistance:'c3:a:b',axis:'IR',fit:true,fitModel:'inverse',rows:[{u:6,i:.5,r:12,rLabel:'變阻器（A–P）',uLabel:'V',iLabel:'A',uRange:15,iRange:3,uStatus:'normal',iStatus:'normal'}]}});};
test('browser core loads and solves with no experiments or teacher interface',()=>{
  const context=vm.createContext({TextEncoder});
  for(const name of ['component-registry','circuit-routing','circuit-model','circuit-solver','circuit-document','presets'])vm.runInContext(fs.readFileSync(path.join(__dirname,name+'.js'),'utf8'),context,{filename:name});
  assert.equal(context.CircuitExperiments,undefined);
  const reading=vm.runInContext('CircuitSolver.solve(CircuitPresets.create("ohm")).components.c2.reading',context);assert(Math.abs(reading-.5)<1e-12);
});
test('new presets, saved circuits and templates contain no experiment state',()=>{
  for(const name of Object.keys(P.names)){const d=P.create(name);assert(!Object.hasOwn(d,'measurements'));assert.deepEqual(D.decode(D.encode(d)),d);assert(!Object.hasOwn(D.template(d),'measurements'));}
});
test('object and JSON legacy imports discard only retired metadata',()=>{
  const old=oldDocument(),unchanged=JSON.stringify(old),clean=M.clone(old);delete clean.measurements;const expected=M.validate(clean);
  for(const input of [old,JSON.stringify(old)]){const restored=D.importDocument(input);assert(restored.removedMeasurements);assert.deepEqual(restored.document,expected);assert.deepEqual(S.solve(restored.document).components,S.solve(expected).components);assert(!D.encode(restored.document).includes('measurements'));}
  assert.equal(JSON.stringify(old),unchanged);assert.deepEqual(D.decode(unchanged),expected);assert.throws(()=>M.validate(old),'core never consumes retired experiment metadata');
});
test('retired metadata is never interpreted as circuit rules or data',()=>{
  for(const value of [null,17,{policy:{mode:'free'},rows:'unused',extra:true}]){const old=oldDocument();old.measurements=value;assert.deepEqual(D.decode(JSON.stringify(old)),P.create('ohm'));}
});
test('all supported legacy versions migrate and can continue legal wiring',()=>{
  for(const version of [1,2,3,4]){
    const old=oldDocument();old.version=version;if(old.cables)delete old.cables.resistance;old.wires.forEach(w=>delete w.resistance);if(version<3){delete old.cables;old.wires.forEach(w=>delete w.length);}if(version===1)old.wires.forEach(w=>{delete w.shape;w.via=[];});
    const restored=D.decode(JSON.stringify(old));assert(!Object.hasOwn(restored,'measurements'));assert.equal(restored.version,6);const before=S.solve(restored).components.c2.reading;const w=M.addWire(restored,400,600);M.attach(restored,w.id,'from','c3:b');assert.equal(S.solve(restored).components.c2.reading,before);D.decode(D.encode(restored));
  }
});
test('invalid circuits, unknown fields, versions and excessive bytes still fail',()=>{
  for(const edit of [d=>d.wires[0].to='missing:a',d=>d.components[0].params.voltage=-1,d=>d.extra=true,d=>d.version=99,d=>d.policy.allowParams='true']){const bad=oldDocument();edit(bad);assert.throws(()=>D.importDocument(bad));assert.throws(()=>D.decode(JSON.stringify(bad)));}
  assert.throws(()=>D.decode('{bad'));assert.throws(()=>D.decode(null));assert.throws(()=>D.importDocument({...oldDocument(),measurements:'x'.repeat(M.limits.bytes)}));
});
test('import, edit, undo and redo preserve the circuit and permit continuation',()=>{
  const initial=P.create('series'),h=M.history(initial);h.replace(D.importDocument(oldDocument()).document);const loaded=D.encode(h.get());h.change(d=>M.addWire(d,400,600));h.undo();assert.equal(D.encode(h.get()),loaded);h.undo();assert.deepEqual(h.get(),initial);h.redo();assert.equal(D.encode(h.get()),loaded);h.change(d=>M.rotateComponent(d,'c3'));D.decode(D.encode(h.get()));
});
console.log(`Circuit import: ${cases} focused groups passed; independent core, retired metadata migration, strict circuit validation, file round trips and legal continuation.`);
