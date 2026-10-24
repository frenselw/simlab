'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),S=require('./scoring'),T=require('./test-support');
const q=O.circular(200000),o=O.elements(q);assert(Math.abs(o.speed-7788.49)<1);assert(Math.abs(o.period/60-88.4)<.1);assert(o.e<1e-12);assert(Math.abs(O.timeToAngle(q,Math.PI)-o.period/2)<1e-6);assert(!O.elements([P.R+1e6,0,0,15000,0,0]).bound);const hyperbola=O.path([P.R+1e6,0,0,0,15000,0]);assert(hyperbola.length>2&&hyperbola.flat().every(Number.isFinite));
let s=M.change(M.fresh(()=>.5),{type:'practice'}),before=O.elements(s.flight.state);M.advance(s,before.period*10);let after=O.elements(s.flight.state);assert(Math.abs(after.energy/before.energy-1)<1e-5);assert(Math.abs(after.momentum/before.momentum-1)<1e-5);
s=M.change(s,{type:'node',dv:150});const preview=M.preview(s),executed=T.execute(s);assert(preview);assert(Math.abs(O.elements(executed.flight.state).ha-preview.orbit.ha)<1);assert(Math.abs(executed.burn.achievedDv-150)<1e-5);
for(let variant=0;variant<3;variant++){const raised=T.raised(variant);assert.equal(S.score(raised).score,40,JSON.stringify(O.elements(raised.flight.state)));}
const current=T.reachOrbit(2).flight.state;assert(O.timeToAngle(current,Math.atan2(current[1],current[0]))<1e-6);
console.log('rocket orbit: circular values, 10-orbit conservation, finite-burn preview and all target transfers passed');


for(let variant=0;variant<3;variant++){
 let start=M.change(M.fresh(()=>variant/3+.01),{type:'practice'}),planned=M.change(start,{type:'node',at:'phase',angle:0,direction:'retrograde',dv:65});
 const predicted=M.preview(planned),actual=T.execute(planned),initial=O.elements(start.flight.state),result=O.elements(actual.flight.state);
 assert(result.energy<initial.energy&&result.momentum<initial.momentum,'A short retrograde burn must reduce energy and angular momentum');assert(result.ha<initial.ha+1);assert(Math.abs(actual.burn.achievedDv-65)<1e-5);assert(Math.abs(result.hp-predicted.orbit.hp)<1);assert(Math.abs(result.ha-predicted.orbit.ha)<1);
 start=T.execute(M.change(start,{type:'node',at:'phase',angle:0,direction:'retrograde',dv:30}));M.advance(start,30);planned=M.change(start,{type:'node',at:'phase',angle:O.wrap(Math.atan2(start.flight.state[1],start.flight.state[0])),direction:'prograde',dv:100});const faster=T.execute(planned);assert(O.elements(faster.flight.state).energy>O.elements(start.flight.state).energy,'Changing from retrograde to prograde must accelerate immediately at the node');
 let launch=M.change(T.launched(variant),{type:'control',key:'angle',value:90});M.advance(launch,.1);assert(launch.flight.attitude<=12*Math.PI/180*.1+1e-12,'A manual attitude must retain its turn-rate limit');
}
let longWait=M.change(M.fresh(()=>.4),{type:'practice'});longWait=T.execute(M.change(longWait,{type:'node',at:'phase',angle:0,dv:2000}));longWait=M.change(longWait,{type:'node',at:'periapsis',dv:100});const unchanged=P.clone(longWait),wait=O.timeToAngle(longWait.flight.state,longWait.node.angle);assert(wait>20000);const longPreview=M.preview(longWait),longActual=T.execute(longWait);assert(longPreview&&longPreview.elapsed>wait);assert(Math.abs(longPreview.achievedDv-100)<1e-5);assert(Math.abs(longPreview.orbit.ha-O.elements(longActual.flight.state).ha)<1);assert.deepEqual(longWait,unchanged);
let high=M.change(M.fresh(()=>.4),{type:'practice'});high.flight.state=O.circular(19000000);high=M.change(high,{type:'node',at:'phase',angle:-Math.PI/12,dv:100});assert(O.timeToAngle(high.flight.state,high.node.angle)>38000);assert(Math.abs(M.preview(high).achievedDv-100)<1e-5);
let boundary=M.change(M.fresh(()=>.4),{type:'practice'});boundary.flight.t=604790;boundary=M.change(boundary,{type:'node',at:'phase',angle:Math.PI,dv:100});assert.equal(M.preview(boundary),null,'An unfinishable preview must not claim an old or partial burn');
console.log('rocket audit: automatic burn direction, A turn limit, long-wait new-burn preview and incomplete model-boundary preview passed');
