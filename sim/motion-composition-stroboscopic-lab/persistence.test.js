"use strict";
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js'),{environment,filled,envelope,durableDraft,finishedData}=require('./test-support.js');
const blank=P.fresh(),observed=P.command(blank,{type:'observe'}),oneType=P.command(blank,{type:'motion',axis:0,value:'uniform'}),bothTypes=P.command(oneType,{type:'motion',axis:1,value:'accelerating'}),trajectory=P.command(blank,{type:'trajectory',value:'other'}),partial=P.command(observed,{type:'place',point:[800,-700]}),onlyPoints=filled();onlyPoints.cases.forEach(c=>{c.motions.fill(null);c.trajectory=null;});
const variants=[blank,observed,oneType,bothTypes,trajectory,partial,onlyPoints,filled()];let count=0;
for(const base of variants)for(let index=0;index<4;index++)for(let time=1;time<=4;time++)for(const phase of ['edit','check','return','review']){
  let s=P.navigate(base,index,time);if(phase==='check')s=P.check(s);if(phase==='return')s=P.navigate(P.check(s),index,time);if(phase==='review')s=P.review(s);
  const kind=phase==='review'?'review':'draft',encoded=envelope(kind,s),restored=P.decode(JSON.parse(JSON.stringify(encoded)),kind);assert.deepEqual(restored,s);assert.equal(S.score(restored).score,S.score(s).score);assert.equal(S.score(restored).passed,S.score(s).passed);
  const e=environment({durable:kind==='review'?finishedData(s):durableDraft(s)});
  if(kind==='review'){const old=JSON.stringify(e.c.state);e.c.navigate((index+1)%4,time);assert.equal(e.c.mode,'review');assert.equal(JSON.stringify(e.c.state),old);}
  else if(phase==='check'){e.c.navigate(index,time);assert.equal(e.c.state.returnToCheck,true);}
  else{e.c.check();assert.equal(e.c.mode,'check');assert.deepEqual(e.c.state.cases,s.cases);}
  count++;
}
const invalid=[s=>delete s.cases,s=>s.cases.pop(),s=>s.activeTime=0,s=>s.activeCase=4,s=>s.modelVersion=2,s=>s.phase='lost',s=>{s.phase='check';s.returnToCheck=true;},s=>s.cases[0].motions[0]='all',s=>s.cases[0].points[0]=[NaN,0],s=>s.cases[0].points[0]=[0,Infinity],s=>s.cases[0].points[0]=[0.1,0],s=>s.cases[0].points[0]=[3601,0],s=>s.cases[0].points[0]=[0,0,0],s=>s.cases[0].points[0]=[0,0],s=>s.cases[0].trajectory='all'];
for(const change of invalid){const s=P.fresh();change(s);assert.throws(()=>P.validate(s,'draft'));}
for(const field of ['horizontal','vertical','trajectory'])for(const value of [[],[field==='trajectory'?'line':'uniform'],{},true,1]){
  const snapshot=envelope('draft',P.fresh());
  if(field==='trajectory')snapshot.answer.cases[0].trajectory=value;
  else snapshot.answer.cases[0].motions[field==='horizontal'?0:1]=value;
  assert.throws(()=>P.decode(JSON.parse(JSON.stringify(snapshot)),'draft'),`${field} rejects a non-string enum`);
  const review=envelope('review',P.fresh());review.answer=M.clone(snapshot.answer);review.answer.phase='review';
  assert.throws(()=>P.decode(JSON.parse(JSON.stringify(review)),'review'));
}
assert.throws(()=>P.decode(envelope('review',filled()),'draft'));assert.throws(()=>P.command(P.fresh(),{type:'place',point:[0,0]}));
const longestMotion=Object.keys(M.MOTIONS).sort((a,b)=>b.length-a.length)[0],longestTrajectory=Object.keys(M.TRAJECTORIES).sort((a,b)=>b.length-a.length)[0];
const max=filled();max.cases.forEach(c=>{c.points=Array.from({length:4},()=>[-400,-3600]);c.motions=[longestMotion,longestMotion];c.trajectory=longestTrajectory;});
const draft=envelope('draft',P.check(max)),review=envelope('review',max),r=S.score(max),pending={version:1,activity:P.ACTIVITY,kind:'pending-final',payload:{reviewJson:JSON.stringify(review),score:r.score,maxScore:100,passed:r.passed}};
for(const v of [draft,review,pending])assert.ok(P.bytes(v)<=4000);assert.ok(!JSON.stringify(draft).includes('pointer'));
const reset=P.command(partial,{type:'clear'});assert.equal(reset.cases[0].observed,true);assert.deepEqual(reset.cases[0].points,[null,null,null,null]);
console.log(`motion composition persistence: ${count} production round-trips and legal continuations; bytes ${[draft,review,pending].map(P.bytes).join('/')}; invalid states passed`);
