'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),T=require('./test-support'),{warpLimit}=require('./ui-runtime');
function craft(engine=2,pair=true){let s=M.fresh();for(const action of [{type:'part',stage:0,part:'engine',value:engine},{type:'part',stage:0,part:'large',value:1},{type:'insert',stage:0,part:'medium',at:0},{type:'insert',stage:0,part:'small',at:1},...(pair?[{type:'boosters'}]:[]),{type:'capsule'},{type:'launch'}])s=M.change(s,action);return s;}
function continueCheck(s,action){T.validate(s);const next=M.change(s,action);T.validate(next);assert.notDeepEqual(next,s);return next;}
for(const engine of [0,1,2])for(const part of ['small','medium','large']){let s=M.fresh();s=M.change(s,{type:'part',stage:0,part:'engine',value:engine});s=M.change(s,{type:'part',stage:0,part,value:1});assert.equal(P.capacity(s.craft.stages[0]),{small:1500,medium:3000,large:6000}[part]);T.validate(s);continueCheck(s,{type:'capsule'});}
const pad=craft();assert.equal(P.capacity(pad.craft.stages[0]),10500);assert.deepEqual(P.tanks(pad.craft.stages[0]),['medium','small','large']);assert.equal(P.mass(pad.flight),18260);continueCheck(pad,{type:'ignite'});
for(const throttle of [0,.4,1]){let s=M.change(pad,{type:'control',key:'throttle',value:throttle});s=M.change(s,{type:'ignite'});assert.equal(M.thrust(s.flight),240000+250000*throttle);const before=P.clone(s);M.advance(s,1);assert(Math.abs(s.flight.boosters.fuel-(3000-120000/(250*P.G0)))<1e-6);assert(Math.abs(s.flight.fuel[0]-(10500-250000*throttle/(320*P.G0)))<1e-6);continueCheck(s,{type:'stop'});const stopped=M.change(s,{type:'stop'});assert.equal(M.thrust(stopped.flight),240000);assert.equal(warpLimit(stopped.flight),20);assert.equal(M.change(stopped,{type:'jettison'}).flight.boosters.status,'jettisoned');assert.deepEqual(pad,craft());}
let spent=M.change(pad,{type:'ignite'});M.advance(spent,62);assert.equal(spent.flight.boosters.status,'spent');assert.equal(spent.flight.boosters.fuel,0);assert.equal(spent.flight.status,'flying');const mass=P.mass(spent.flight),velocity=spent.flight.state.slice(),controls=P.clone(spent.flight.controls);const dropped=continueCheck(spent,{type:'jettison'});assert.equal(P.mass(dropped.flight),mass-600);assert.deepEqual(dropped.flight.state,velocity);assert.deepEqual(dropped.flight.controls,controls);assert.deepEqual(M.change(dropped,{type:'jettison'}),dropped);
// Real Controller paths must keep the solid motor alive when the main engine stops.
console.log('Expansion: all engine/tank types, mixed assembly, independent solid burn, cutoff/warp, event burnout, single manual separation, continued independent flight passed.');

// Reproducible flight uses the new medium tank and solid pair, through production commands.
for(const boosterCount of [2,4]){
let mission=M.fresh();for(const a of [{type:'part',stage:0,part:'engine',value:0},{type:'part',stage:0,part:'large',value:2},{type:'insert',stage:0,part:'medium',at:0},...Array(boosterCount/2).fill({type:'boosters'}),{type:'separator'},{type:'part',stage:1,part:'engine',value:1},{type:'part',stage:1,part:'large',value:1},{type:'capsule'},{type:'launch'},{type:'ignite'}])mission=M.change(mission,a);
let success=false;for(let i=0;i<5000&&mission.phase!=='ended';i++){let f=mission.flight;if(f.boosters.status==='spent')mission=M.change(mission,{type:'jettison'});f=mission.flight;if(f.fuel[0]===0&&!f.separated){mission=M.change(M.change(mission,{type:'separate'}),{type:'ignite'});f=mission.flight;}f.controls.angle=Math.max(0,Math.min(95,(f.t-15)/145*95));const o=O.elements(f.state);f.controls.throttle=o.tangential>=7700?.05:o.tangential>=7400?.25:(P.burning(f)?.6:1);M.advance(mission,.25);const n=O.elements(mission.flight.state);if(n.hp>=170000&&n.e<=.03){mission=M.change(mission,{type:'stop'});success=true;break;}}
assert(success);assert(O.safe(mission.flight.state));T.validate(mission);console.log(boosterCount+' boosters reach a near-circular orbit at '+mission.flight.t+' s.');

}

// Two pairs share the lowest stage and release together without changing the core velocity.
for(const count of [2,4]){
 let s=craft(2,false);s=M.change(s,{type:'workshop'});for(let i=0;i<count/2;i++)s=M.change(s,{type:'boosters'});assert.equal(s.craft.boosters,count);assert.equal(P.canFit(s.craft,1,'boosters'),false);assert.equal(P.canFit(s.craft,0,'boosters'),count===2);if(count===4)assert.deepEqual(M.change(s,{type:'boosters'}),s);
 continueCheck(s,{type:'launch'});const removed=M.change(s,{type:'transfer',from:0,to:null,part:'boosters'});assert.equal(removed.craft.boosters,undefined);
 s=M.change(s,{type:'launch'});assert.equal(P.mass(s.flight),11660+count*3300);assert.deepEqual(M.change(s,{type:'jettison'}),s);T.validate(s);s=continueCheck(s,{type:'ignite'});M.advance(s,10);T.validate(s);assert.equal(M.thrust(s.flight),250000+count*120000);T.validate(s);
 const burnout=P.clone(s);M.advance(burnout,62);assert.equal(burnout.flight.boosters.status,'spent');T.validate(burnout);const spentMass=P.mass(burnout.flight),emptyRelease=continueCheck(burnout,{type:'jettison'});assert.equal(spentMass-P.mass(emptyRelease.flight),count*300);
 const before=P.clone(s.flight),released=continueCheck(s,{type:'jettison'});assert.deepEqual(released.flight.state,before.state);assert.deepEqual(released.flight.controls,before.controls);assert.equal(released.flight.boosters.fuel,before.boosters.fuel);assert(Math.abs(P.mass(before)-P.mass(released.flight)-count*(300+before.boosters.fuel))<1e-6);assert.equal(M.thrust(released.flight),250000);
 const continued=P.clone(released);M.advance(continued,1);T.validate(continued);assert(continued.flight.t>released.flight.t);assert.equal(continued.flight.boosters.fuel,released.flight.boosters.fuel);
 const bodies=P.boosterMounts(count).map(m=>M.boosterFlight(released.flight,m));assert.equal(bodies.length,count);
 for(const b of bodies){assert.equal(b.fuel,before.boosters.fuel);const v=b.state.slice(3);M.stepBooster(b,1,{vacuum:true,noGravity:true});assert(b.state[3]>v[0]);assert(b.state.slice(3).reduce((sum,v,i)=>sum+v*b.out[i],0)>2);assert(Math.abs(b.fuel-before.boosters.fuel+120000/(250*P.G0))<1e-7);assert(Math.abs(Math.hypot(...M.boosterDirection(b))-1)<1e-12);}
 assert(Math.abs(bodies.reduce((sum,b)=>sum+b.state[1],0)/count-released.flight.state[1])<1e-6);assert(Math.abs(bodies.reduce((sum,b)=>sum+b.state[2],0))<1e-7);
 for(const b of bodies){while(b.fuel>0)M.stepBooster(b,.1,{vacuum:true,noGravity:true});assert.equal(b.fuel,0);const v=b.state.slice(3);M.stepBooster(b,1,{vacuum:true,noGravity:true});assert.deepEqual(b.state.slice(3),v);assert.equal(M.stepBooster(b,0),0);}
}

// Radial impulses cancel at any core attitude; detached thrust follows the same outward axis.
for(const angle of [0,Math.PI/4,Math.PI/2]){
 let s=M.change(craft(),{type:'ignite'});M.advance(s,10);s.flight.attitude=angle;const pieces=P.boosterMounts(4).map(m=>M.boosterFlight(s.flight,m)),axis=[Math.cos(angle),Math.sin(angle),0];
 for(let i=0;i<3;i++)assert(Math.abs(pieces.reduce((sum,b)=>sum+b.state[i+3]-s.flight.state[i+3],0))<1e-9);
 for(const b of pieces){const before=b.state.slice(3);assert(Math.abs(before.reduce((sum,v,i)=>sum+(v-s.flight.state[i+3])*axis[i],0))<1e-9);M.stepBooster(b,.5,{vacuum:true,noGravity:true});assert(b.state.slice(3).reduce((sum,v,i)=>sum+(v-before[i])*b.out[i],0)>0);assert(b.state.slice(3).reduce((sum,v,i)=>sum+(v-before[i])*axis[i],0)>0);}
 const b=M.boosterFlight(s.flight,[-1,0]),coarse=P.clone(b),fine=P.clone(b);for(let i=0;i<10;i++)M.stepBooster(coarse,.1);for(let i=0;i<100;i++)M.stepBooster(fine,.01);assert(Math.hypot(...coarse.state.map((v,i)=>v-fine.state[i]))<.02);
}
const Surface=require('./surface');for(const z of [-1000,1000]){const q=[P.R+25,200,z,0,0,0],dir=Surface.direction(q,123);assert(Math.abs(Math.hypot(...dir)-1)<1e-12);assert(Math.abs(Surface.clearance(q,123)-(Math.hypot(...q.slice(0,3))-P.R-Surface.heightAt(...dir)))<1e-8);}
console.log('Rotated four-way impulses conserve net momentum, thrust follows outward orientation, 3D terrain and integrator refinement passed.');
