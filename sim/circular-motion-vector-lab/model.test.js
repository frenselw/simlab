'use strict';
const assert=require('node:assert/strict'),M=require('./model.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`),dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
let cases=0;
for(let startIndex=0;startIndex<4;startIndex++)for(const sense of [-1,1])for(let task=0;task<3;task++)for(let gap=5;gap<=60;gap++){
  const s=M.fresh(()=>0);s.definition={startIndex,sense,choiceShift:0};s.task=task;s.observation[M.GAP_KEYS[task]]=gap;
  const g=M.scene(s),radial=M.direction(s,task,'inward'),velocity=M.direction(s,task,'forward-tangent');
  near(M.length(g.rA),.5);near(M.length(g.rB),.5);near(M.length(g.vA),.5);near(M.length(g.vB),.5);near(g.dt,gap*Math.PI/180);
  near(dot(g.rA,g.vA),0);near(M.length(g.dr),Math.sin(g.delta/2));assert(M.length(g.dr)<.5*g.delta);
  near(cross(g.dr,g.averageV),0);near(cross(g.dv,g.averageA),0);assert(dot(g.dr,g.averageV)>0&&dot(g.dv,g.averageA)>0);
  near(Math.acos(Math.min(1,dot(g.dr,velocity)/M.length(g.dr))),g.delta/2);near(Math.acos(Math.min(1,dot(g.dv,radial)/M.length(g.dv))),g.delta/2);
  assert(dot(g.dv,radial)>0);near(dot(velocity,radial),0);assert.equal(g.sense,task===2?-sense:sense);cases++;
}
const s=M.fresh(()=>0);s.task=1;let n=M.change(s,{type:'node',value:'V'});assert.deepEqual(M.change(n,{type:'node',value:'V'}),n);n=M.change(n,{type:'node',value:'U'});assert.equal(n.answers.deltaTo,'U');n=M.change(n,{type:'gap',value:5});assert.equal(n.answers.deltaFrom,'V');assert.equal(n.answers.deltaTo,'U');
assert.throws(()=>M.fresh(()=>1));assert.throws(()=>M.change(s,{type:'gap',value:0}));
console.log(`Circular vector model: ${cases} physical configurations, finite-time limits, transfer and semantic node updates passed.`);
