 'use strict';
const assert=require('node:assert/strict'),P=require('./parts'),M=require('./model'),O=require('./orbit'),R=require('./recovery'),T=require('./test-support');
const q=O.circular(300000),o=O.elements(q);assert(Math.abs(o.hp-300000)<1e-6&&Math.abs(o.ha-300000)<1e-6);assert(o.e<1e-12);assert(O.safe(q));
const f=M.flight(T.launched().craft,'own',q);f.status='flying';for(let i=0;i<Math.ceil(o.period*10/2);i++)M.step(f,2);const after=O.elements(f.state);assert(Math.abs(after.energy/o.energy-1)<1e-8);assert(Math.abs(after.momentum/o.momentum-1)<1e-8);
let s=T.reachOrbit();const before=O.elements(s.flight.state);M.advance(s,before.period+1);assert(O.safe(s.flight.state));assert(Math.abs(O.elements(s.flight.state).hp-before.hp)<.1);
s=T.launched();s=M.change(s,{type:'control',key:'angle',value:90});M.advance(s,.1);assert(s.flight.attitude<=12*Math.PI/180*.1+1e-12);
for(const type of ['practice','mission','import','node','execute','cancel'])assert.deepEqual(M.change(s,{type,dv:200}),s,'Removed transfer command must have no effect');
const stack=T.launched(),upper=T.reachOrbit(),released=M.change(upper,{type:'capsule-separate'}).flight;
for(const body of [stack.flight,upper.flight,released.upperStage,released])for(const sign of [-1,1]){
 const f=P.clone(body);
 Object.assign(f,{status:'flying',state:[P.R+200000,0,0,100,0,0],attitude:0,angularVelocity:0,rcsDirection:0});
 f.controls={mode:'tilt',angle:sign>0?30:330,throttle:0,lit:false};
 const samples=[];
 for(let i=0;i<80;i++){
  M.step(f,.05);
  samples.push(R.rcsDirection(f));
  if(i<10||R.rcsDirection(f)===-sign)assert(f.angularVelocity*sign>0);
  assert(Math.abs(f.angularVelocity)<=12*Math.PI/180+1e-9);
 }
 const phases=samples.filter((value,i)=>i===0||value!==samples[i-1]);
 assert.deepEqual(phases,[sign,0,-sign,0]);
 assert(samples.filter(value=>value===sign).length>=11);
 assert(samples.filter(value=>value===-sign).length>=11);
 assert.equal(f.angularVelocity,0);
 assert(Math.abs(R.angleDelta(M.targetAttitude(f),f.attitude))<1e-9);
}
console.log('rocket orbit: circular values, ten-orbit conservation, successful coast, manual turn rate and removed transfer commands passed');
