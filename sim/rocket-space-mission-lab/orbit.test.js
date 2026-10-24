'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),S=require('./scoring'),T=require('./test-support');
const q=O.circular(200000),o=O.elements(q);assert(Math.abs(o.speed-7788.49)<1);assert(Math.abs(o.period/60-88.4)<.1);assert(o.e<1e-12);assert(Math.abs(O.timeToAngle(q,Math.PI)-o.period/2)<1e-6);assert(!O.elements([P.R+1e6,0,0,15000,0,0]).bound);const hyperbola=O.path([P.R+1e6,0,0,0,15000,0]);assert(hyperbola.length>2&&hyperbola.flat().every(Number.isFinite));
let s=M.change(M.fresh(()=>.5),{type:'practice'}),before=O.elements(s.flight.state);M.advance(s,before.period*10);let after=O.elements(s.flight.state);assert(Math.abs(after.energy/before.energy-1)<1e-5);assert(Math.abs(after.momentum/before.momentum-1)<1e-5);
s=M.change(s,{type:'node',dv:150});const preview=M.preview(s),executed=T.execute(s);assert(preview);assert(Math.abs(O.elements(executed.flight.state).ha-preview.orbit.ha)<1);assert(Math.abs(executed.burn.achievedDv-150)<1e-5);
for(let variant=0;variant<3;variant++){const raised=T.raised(variant);assert.equal(S.score(raised).score,40,JSON.stringify(O.elements(raised.flight.state)));}
const current=T.reachOrbit(2).flight.state;assert(O.timeToAngle(current,Math.atan2(current[1],current[0]))<1e-6);
console.log('rocket orbit: circular values, 10-orbit conservation, finite-burn preview and all target transfers passed');
