'use strict';
const assert=require('node:assert/strict'),M=require('./model.js');
const s=M.fresh(()=>.2);
assert(M.validDefinition(s.def));assert.deepEqual(s.def[3],s.def[4]);
for(let mirror=0;mirror<2;mirror++)for(let mi=0;mi<2;mi++)for(let ri=0;ri<2;ri++)for(let vi=0;vi<2;vi++){
  for(const page of [0,1]){const def=M.clone(s.def);def[page]=[mirror,mi,ri,vi];const p=M.physics(def,page);assert.equal(p.inward,mirror?'E':'W');assert.deepEqual(p.forces.map(x=>x[0]),page===0?[0,3,2]:[0,3,4]);assert.equal(p.forces[2][1],M.directionAngle(p.inward));if(page===1)assert(p.forces[2][2]<=.5*p.forces[1][2]);}
}
for(let mirror=0;mirror<2;mirror++)for(let mi=0;mi<2;mi++)for(let li=0;li<2;li++)for(let ti=0;ti<3;ti++){
  const def=M.clone(s.def);def[2]=[mirror,mi,li,ti];const p=M.physics(def,2),v=p.values;
  assert(Math.abs(v.r-v.L*Math.sin(v.theta))<1e-10);assert(Math.abs(v.T*Math.cos(v.theta)-v.m*M.G)<1e-10);
  assert(Math.abs(v.omega*v.r-v.v)<1e-10);assert.deepEqual(p.forces.map(x=>x[0]),[0,2]);
}
for(let mi=0;mi<2;mi++)for(let ri=0;ri<3;ri++)for(let li=0;li<3;li++){
  const def=M.clone(s.def),tuple=[mi,ri,li];def[3]=tuple;def[4]=tuple.slice();assert(M.validDefinition(def));
  const crest=M.physics(def,3),trough=M.physics(def,4);assert(crest.values.N>0);assert(trough.values.N>crest.values.m*M.G);assert.equal(crest.inward,'S');assert.equal(trough.inward,'N');
}
for(let pos=0;pos<8;pos++){const def=M.clone(s.def);def[5]=[pos,1];const p=M.physics(def,5);assert.equal(p.forces.length,1);assert.equal(p.forces[0][0],1);assert.equal(p.forces[0][1],M.directionAngle(p.inward));}
for(let pos=0;pos<8;pos++)for(const sense of [0,1])for(const pose of [0,624,625,626,1249,1250,1376,1874,1875,6200,9374,9375,9999]){
  const state=M.navigate(s,5);state.def[5]=[pos,sense];
  const analysed=M.change(state,{type:'analyse',pose}),item=analysed.items[5],p=M.physics(state.def,5,item.pose),observed=M.poseAngle(state.def,5,pose),snapped=M.poseAngle(state.def,5,item.pose);
  assert.equal(item.pose%1250,0);assert.equal(p.forces[0][1],M.directionAngle(p.inward));assert.equal(item.inward,null);assert.deepEqual(item.arrows,[]);
  const distance=M.difference(observed,snapped);assert(distance<=225);
  assert(M.DIRECTIONS.every(key=>M.difference(observed,M.directionAngle(key))>=distance),'Earth must stop at a nearest available direction');
  const answered=M.change(analysed,{type:'inward',value:p.inward});assert.deepEqual(M.change(answered,{type:'analyse',pose:4321}).items[5],answered.items[5]);
}
assert.equal(M.difference(3590,10),20);assert.equal(M.difference(100,200),100);
for(let page=0;page<6;page++){const o=M.options(s,page),keys=M.CASES[page].choices.map(x=>x[0]);assert.equal(new Set(o.map(x=>x[0])).size,4);assert.deepEqual(o.map(x=>x[0]).sort(),keys.sort());}
console.log('Centripetal source model: six cases, legal variants, forces, magnitudes and directions passed.');
