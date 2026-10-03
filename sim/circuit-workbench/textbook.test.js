"use strict";
const assert=require('node:assert/strict');
const T=require('../../tools/circuit-textbook-cases');
const M=require('./circuit-model'),D=require('./circuit-document'),S=require('./circuit-solver');
const cases=T.cases(),results=cases.map(T.verify),byId=new Map(results.map(r=>[r.id,r]));
assert.equal(new Set(cases.map(c=>c.id)).size,cases.length,'case identifiers are unique');
for(const item of T.inventory)assert(cases.some(c=>c.group===item.id),'inventory has a concrete production fixture: '+item.figure);
for(const r of results){
  assert(r.maximumCableLength<=1200,'fixtures use actual finite toolbox cables');
  assert(r.pass,'textbook analytic oracle: '+r.id+' '+JSON.stringify(r.observations.filter(o=>!o.pass)));
  assert(r.continuation.performed,'every document has a legal continuation: '+r.id);
  assert.deepEqual(r.continuation.diagnostics,[],'continuation solves: '+r.id);
  assert(r.continuation.residual<1e-8,'continuation KCL residual');
}
const sample=(id,label)=>byId.get(id).observations.find(c=>c.label===label).actual;
assert(Math.abs(sample('meter-error-internal','伏安法測得 R')-87.5)<1e-9);
assert(Math.abs(sample('meter-error-external','伏安法測得 R')-87.4*1000/(87.4+1000))<1e-9);
assert(Math.abs(sample('meter-error-b-internal','伏安法測得 R')-210)<1e-9);
assert(Math.abs(sample('meter-error-b-external','伏安法測得 R')-200*2000/2200)<1e-9);
const native=T.inventory.filter(c=>c.construction==='native').length;
assert.equal(T.limitations().every(p=>p.rejected),true,'current capability limits must stay explicit until coverage is upgraded');
// Calibrating the rated point does not establish agreement with the textbook curve.
assert.equal(byId.get('lamp-curve-2.5').comparison.within,true);
assert.equal(byId.get('lamp-curve-1').comparison.within,false);
const dim=sample('parallel-dim-4','L1 power'),bright=sample('parallel-dim-1','L1 power');assert(dim<bright);
const maximum=sample('maximum-2.5','R2 power');for(const r of results.filter(r=>r.group==='maximum'&&r.id!=='maximum-output'))assert(sample(r.id,'R2 power')<=maximum+1e-9);
// Low-range meter resistance changes too; don't confuse 300 μA with the 1.5 mA hole.
for(const c of cases.filter(c=>c.group==='orange-a')){
  const a=S.solve(c.doc).components[c.components.A];assert.equal(a.range,.0003);assert.equal(a.resistance,100);
}
// Reimported documents can still be rewired, not merely inspected.
const supported=cases.find(c=>c.id==='corrected'),restored=D.decode(D.encode(supported.doc));
const wire=restored.wires.find(w=>[w.from,w.to].includes(supported.components.V+':a')),end=wire.from===supported.components.V+':a'?'from':'to';
M.detach(restored,wire.id,end);assert(M.attach(restored,wire.id,end,supported.components.V+':a'));M.validate(restored);
assert.equal(D.encode(restored),D.encode(supported.doc),'unplug and reattach preserves the actual document');
console.log(`Textbook verification: ${cases.length} circuits/workpoints, ${results.reduce((s,r)=>s+r.observations.length,0)} analytic checks, ${cases.length} production round trips + legal continuations. Inventory: ${native} native / ${T.inventory.length-native} equivalent; ${T.unavailable.length} unavailable topics. Experimental/model discrepancies are retained separately.`);
