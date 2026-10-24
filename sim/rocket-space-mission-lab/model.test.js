'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),T=require('./test-support');
let s=T.launched();const initial=P.mass(s.flight),engine=P.ENGINES[0];M.advance(s,10);assert(Math.abs(P.mass(s.flight)-(initial-10*engine.thrust/(engine.isp*P.G0)))<1e-6);assert(s.flight.state[0]>P.R);
const q=s.flight.state.slice(),fuel=s.flight.fuel[1];s=M.change(s,{type:'separate'});assert.deepEqual(s.flight.state,q);assert.equal(s.flight.fuel[1],fuel);assert.equal(s.flight.fuel[0],0);assert.equal(s.flight.controls.lit,false);assert.deepEqual(M.change(s,{type:'separate'}),s);
for(let variant=0;variant<3;variant++){const result=T.reachOrbit(variant);assert(O.safe(result.flight.state));assert(O.elements(result.flight.state).e<.03);assert(result.flight.fuel[1]>0);}
assert(O.safe(T.reachOrbit(1,1,true).flight.state));
let weak=M.fresh(()=>.5);weak.craft={payload:1,stages:[{engine:1,small:0,large:4}],separator:false};weak=M.change(M.change(weak,{type:'launch'}),{type:'ignite'});M.advance(weak,5);assert.equal(weak.flight.status,'pad');assert(weak.flight.fuel[0]<24000);assert.equal(weak.flight.state[0],P.R);
const falling=M.flight({payload:1,stages:[{engine:1,small:1,large:0}],separator:false},'own',[P.R+2,0,0,-100,0,0]);falling.status='flying';M.step(falling,.1);assert.equal(falling.status,'impact');assert(Math.abs(O.elements(falling.state).height)<.01);
const vacuum=M.flight({payload:1,stages:[{engine:1,small:1,large:0}],separator:false},'practice',O.circular(300000));vacuum.controls.lit=true;vacuum.controls.mode='tilt';vacuum.status='flying';const m0=P.mass(vacuum),v0=vacuum.state[3];for(let i=0;i<100;i++)M.step(vacuum,.1,{vacuum:true,noGravity:true});const ideal=P.ENGINES[1].isp*P.G0*Math.log(m0/P.mass(vacuum));assert(Math.abs((vacuum.state[3]-v0)/ideal-1)<.001);
let a=T.launched(),b=P.clone(a);for(let i=0;i<150;i++)M.advance(a,1/15);for(let i=0;i<600;i++)M.advance(b,1/60);assert(Math.hypot(...a.flight.state.map((v,i)=>v-b.flight.state[i]))<.01);
console.log('rocket model: mass, launch variants, staging, pad, impact, rocket equation and frame-rate checks passed');
