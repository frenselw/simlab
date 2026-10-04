'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('./circuit-model'),D=require('./circuit-document'),S=require('./circuit-solver'),P=require('./presets');
let cases=0;const test=(name,fn)=>{fn();cases++;};
const oldDocument=()=>({...P.create('ohm'),measurements:{voltage:'c4',current:'c2',resistance:'c3:a:b',axis:'IR',fit:true,fitModel:'inverse',rows:[{u:6,i:.5,r:12,rLabel:'變阻器（A–P）',uLabel:'V',iLabel:'A',uRange:15,iRange:3,uStatus:'normal',iStatus:'normal'}]}});
test('browser core loads and solves with no experiments or teacher interface',()=>{
  const context=vm.createContext({TextEncoder});
  for(const name of ['component-registry','circuit-routing','circuit-model','circuit-solver','circuit-document','presets'])vm.runInContext(fs.readFileSync(path.join(__dirname,name+'.js'),'utf8'),context,{filename:name});
  assert.equal(context.CircuitExperiments,undefined);
  const reading=vm.runInContext('CircuitSolver.solve(CircuitPresets.create("ohm")).components.c2.reading',context);assert.equal(reading,.5);
});
test('new presets, saved circuits and templates contain no experiment state',()=>{
  for(const name of Object.keys(P.names)){const d=P.create(name);assert(!Object.hasOwn(d,'measurements'));assert.deepEqual(D.decode(D.encode(d)),d);assert(!Object.hasOwn(D.template(d),'measurements'));}
});
test('object and JSON legacy imports discard only retired metadata',()=>{
  const old=oldDocument(),unchanged=JSON.stringify(old),expected=M.clone(old);delete expected.measurements;
  for(const input of [old,JSON.stringify(old)]){const restored=D.importDocument(input);assert(restored.removedMeasurements);assert.deepEqual(restored.document,expected);assert.deepEqual(S.solve(restored.document).components,S.solve(expected).components);assert(!D.encode(restored.document).includes('measurements'));}
  assert.equal(JSON.stringify(old),unchanged);assert.deepEqual(D.decode(unchanged),expected);assert.throws(()=>M.validate(old),'core never consumes retired experiment metadata');
});
test('retired metadata is never interpreted as circuit rules or data',()=>{
  for(const value of [null,17,{policy:{mode:'free'},rows:'unused',extra:true}]){const old=oldDocument();old.measurements=value;assert.deepEqual(D.decode(JSON.stringify(old)),P.create('ohm'));}
});
test('all supported legacy versions migrate and can continue legal wiring',()=>{
  for(const version of [1,2,3,4]){
    const old=oldDocument();old.version=version;if(version<3){delete old.cables;old.wires.forEach(w=>delete w.length);}if(version===1)old.wires.forEach(w=>{delete w.shape;w.via=[];});
    const restored=D.decode(JSON.stringify(old));assert(!Object.hasOwn(restored,'measurements'));assert.equal(restored.version,4);const before=S.solve(restored).components.c2.reading;const w=M.addWire(restored,400,600);M.attach(restored,w.id,'from','c3:b');assert.equal(S.solve(restored).components.c2.reading,before);D.decode(D.encode(restored));
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
