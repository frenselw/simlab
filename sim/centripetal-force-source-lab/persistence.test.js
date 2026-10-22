'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js');
const snap=(s,kind='draft')=>({version:1,activity:M.ACTIVITY,kind,answer:kind==='review'?P.review(s):P.draft(s)});
for(let page=0;page<6;page++)for(const phase of ['edit','check'])for(const variant of ['blank','kind','partial','extra']){
  const s=M.fresh(()=>.3);s.page=page;s.view='analysis';s.phase=phase;if(phase==='check')s.returnTo=[page,'analysis'];
  const item=s.items[page],physics=M.physics(s.def,page);
  if(variant!=='blank'){item.palette=physics.forces[0][0];item.arrows=[[item.palette,null,60]];item.selected=0;}
  if(variant==='partial'||variant==='extra'){item.inward='NE';item.arrows[0][1]=3599;item.relation=M.CASES[page].choices[1][0];}
  if(variant==='extra')item.arrows.push([6,1200,40]);
  const copy=P.decode(snap(s),'draft');assert.deepEqual(copy,s);assert.equal(S.score(copy).score,S.score(s).score);
  if(phase==='check'){copy.phase='edit';copy.fromReview=true;}M.change(copy,{type:'concept',value:'extra-force'});
}
{
  const s=M.fresh(()=>.2);s.items[0].arrows=[[0,null,60],[0,3599,75]];s.items[0].selected=0;
  const decoded=P.decode(snap(s),'draft');const deleted=M.change(decoded,{type:'delete'});assert.equal(deleted.items[0].selected,0);assert.equal(deleted.items[0].arrows[0][1],3599);
  const review=snap(s,'review');assert.equal(P.decode(review,'review').phase,'review');
}
{
  const s=M.fresh(()=>.9);for(const item of s.items){item.arrows=Array.from({length:6},(_,i)=>[i,3599,100]);item.selected=5;item.palette=8;item.inward='SW';item.relation='';}M.CASES.forEach((q,i)=>s.items[i].relation=q.choices[0][0]);
  const review=snap(s,'review'),result=S.score(P.decode(review,'review'));review.score=result.score;review.passed=result.passed;
  const pending={version:1,activity:M.ACTIVITY,kind:'pending-final',payload:{reviewJson:JSON.stringify(review),score:result.score,maxScore:100,passed:result.passed}};
  assert(P.bytes(pending)<=4000,`pending uses ${P.bytes(pending)} bytes`);
}
for(const mutate of [s=>{s.mv=2;},s=>{s.def[3][0]=9;},s=>{s.def[4][0]=1-s.def[3][0];},s=>{s.items[0].arrows=[[0,3600,60]];},s=>{s.items[0].selected=0;},s=>{s.items[0].relation='bogus';},s=>{delete s.concept;},s=>{s.seed=-1;}]){
  const s=M.fresh(()=>.2);mutate(s);assert.throws(()=>P.validate(s));
}
console.log('Centripetal source persistence: phase/variant round trips, legal continuation, corrupt rejection and pending size passed.');
