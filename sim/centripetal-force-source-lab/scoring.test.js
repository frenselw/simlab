'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),S=require('./scoring.js');
const filled=()=>{const s=M.fresh(()=>.2);M.CASES.forEach((q,page)=>{const p=M.physics(s.def,page),i=s.items[page];i.inward=p.inward;i.relation=q.relation;i.arrows=p.forces.map(([kind,a])=>[kind,a,60]);});s.concept='radial-effect';return s;};
assert.equal(S.score(M.fresh(()=>.2)).score,0);assert.equal(S.score(filled()).score,100);
{const s=filled();s.items.forEach(item=>item.arrows.forEach((a,i)=>{a[2]=i%2?40:100;}));assert.equal(S.score(s).score,100);}
for(let page=0;page<6;page++){
  const s=filled(),item=s.items[page],correct=S.score(s).detail[page];
  item.inward=null;assert.equal(S.score(s).detail[page].earned,correct.earned-3);item.inward='NE';
  item.relation=null;assert.equal(S.score(s).detail[page].relation,0);
  item.arrows[0][1]=null;assert.equal(S.score(s).detail[page].direction,4*(item.arrows.length-1)/item.arrows.length);
  item.arrows=[];assert.equal(S.score(s).detail[page].force,0);
}
{
  const s=M.fresh(()=>.2),p=M.physics(s.def,0),item=s.items[0];item.arrows=[[p.forces[0][0],null,60]];
  assert.equal(S.score(s).detail[0].force,2);assert.equal(S.score(s).detail[0].direction,0);
  item.arrows[0][1]=M.angle(p.forces[0][1]/10+10);assert.equal(S.score(s).detail[0].direction,4/3);
  item.arrows[0][1]=M.angle(p.forces[0][1]/10+10.1);assert.equal(S.score(s).detail[0].direction,0);
  item.arrows.push([p.forces[0][0],p.forces[0][1],60]);assert.equal(S.score(s).detail[0].force,0);assert.equal(S.score(s).detail[0].direction,4/3);
}
{
  const s=M.fresh(()=>.2),i=s.items[5],p=M.physics(s.def,5);i.arrows=[[1,p.forces[0][1],60],[0,p.forces[0][1],60],[6,p.forces[0][1],60]];
  assert.equal(S.score(s).detail[5].force,2);assert.equal(S.score(s).detail[5].direction,4);i.relation='solar-gravity';assert.equal(S.score(s).detail[5].relation,3);
}
{
  const s=filled();s.items[2].relation='full-tension';assert.equal(S.score(s).detail[2].relation,0);assert.equal(S.score(s).detail[2].force,6);
  s.items[3].relation='normal-minus-weight';s.items[4].relation='weight-minus-normal';assert.equal(S.score(s).detail[3].relation,0);assert.equal(S.score(s).detail[4].relation,0);
}
console.log('Centripetal source scoring: full, blank, partial, tolerance, duplicate and independent relation credit passed.');
