'use strict';
const assert=require('node:assert/strict'),P=require('./presets'),H=require('../circuit-workbench/circuit-household'),M=require('../circuit-workbench/circuit-model'),Codec=require('./persistence');
assert.equal(P.experiments.length,18);
for(const e of P.experiments){const d=P.create(e.id),s=new H.Session(d);assert.equal(s.read().diagnostics.length,0,e.id);assert(d.components.length<=80&&d.wires.length<=240);const restored=Codec.decode(H.encodeSession(s.capture()));assert.deepEqual(restored.experiment.document,d);s.advance(.1);}
for(const variant of ['grouped','rcbo','radial']){const d=P.create('H12',variant);assert.equal(d.components.filter(c=>c.type==='hh-appliance').length,7);assert.equal(H.solve(d).diagnostics.length,0);}
const a=new H.Session(P.create('H02')),d=M.clone(a.doc),loads=d.components.filter(c=>c.type==='hh-appliance');d.components.find(c=>c.id===loads[0].id).params.closed=false;a.update(d);assert(a.read().components[loads[1].id].power>100);assert.equal(a.read().components[loads[0].id].power,0);
const ii=new H.Session(P.create('H18')),load=ii.doc.components.find(c=>c.type==='hh-appliance');assert(ii.read().components.c6.residualCurrent<1e-10);const next=M.clone(ii.doc);next.components.find(c=>c.id===load.id).params.fault='double';const body=M.add(next,'resistor',1900,300,{resistance:1000});M.connect(next,load.id+':h',body.id+':a');M.connect(next,body.id+':b',next.earthReference);ii.update(next);assert(ii.read().components.c6.residualCurrent>0);
console.log('H01–H18 and four-branch variants passed.');
