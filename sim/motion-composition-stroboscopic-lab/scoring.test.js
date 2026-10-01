"use strict";
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js'),{filled}=require('./test-support.js');
assert.equal(S.score(P.fresh()).score,0);assert.equal(S.score(filled()).score,100);
const classification=filled();classification.cases.forEach(c=>c.points.fill(null));assert.equal(S.score(classification).score,36);
const positions=filled();positions.cases.forEach(c=>{c.motions.fill(null);c.trajectory=null;});assert.equal(S.score(positions).score,64);
for(let index=0;index<4;index++)for(let slot=0;slot<4;slot++)for(const axis of [0,1])for(const error of [-51,-50,-49,49,50,51]){
  const s=P.fresh(),p=[...M.expected(index)[slot]];p[axis]+=error;s.cases[index].observed=true;s.cases[index].points[slot]=p;assert.equal(S.score(s).score,Math.abs(error)<=50?4:2);
}
const partial=P.fresh();partial.cases[1].observed=true;partial.cases[1].points[1]=[1600,-1600];assert.equal(S.score(partial).score,2);
partial.cases[1].motions[0]='uniform';assert.equal(S.score(partial).score,5);partial.cases[1].trajectory='parabola';assert.equal(S.score(partial).score,8);
const duplicate=P.fresh();duplicate.cases.forEach(c=>{c.observed=true;c.points.fill([3200,-3200]);});assert.equal(S.score(duplicate).score,16);
const observed=P.fresh();observed.cases.forEach(c=>c.observed=true);assert.equal(S.score(observed).score,0);
const invalid=filled();invalid.cases[0].motions.push('uniform');assert.throws(()=>S.score(invalid));
console.log('motion composition scoring: 0/100, 64/36, independent coordinate/type credit, duplicates and ±50mm boundaries passed');
