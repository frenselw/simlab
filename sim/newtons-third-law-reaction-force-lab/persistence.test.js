"use strict";
const assert=require("node:assert/strict"),P=require("./persistence.js"),M=require("./model.js"),G=require("./generator.js"),S=require("./scoring.js");
const {environment,filled,envelope,durableDraft,finishedData,drawOne}=require("./test-support.js");
let rows=0; const covered=new Set();
function roundtrip(s,continuation){
  const e=environment({durable:durableDraft(s),seed:999});assert.equal(e.c.mode,s.phase);assert.deepEqual(e.c.state,s);
  assert.deepEqual(P.decode(JSON.parse(JSON.stringify(e.c.draftSnapshot())),"draft"),s);assert.deepEqual(S.score(e.c.state),S.score(s));
  continuation(e.c);P.draft(e.c.state);e.c.check();e.c.submit();assert.equal(e.c.mode,"review");rows++;
}
// Every generated variant restores through the production controller, not just a validator.
for(let seed=0;covered.size<75 && seed<10000;seed++)for(const q of G.generate(seed).questions){
  const key=q.family+JSON.stringify(q.params);if(covered.has(key))continue;covered.add(key);
  const s=filled(seed);s.question=q.family;s.target=q.targets.length-1;
  roundtrip(s,c=>{c.command({type:"remove",index:c.targetIndex});assert.equal(M.started(c.state.answers[c.familyIndex][c.targetIndex]),false);drawOne(c);});
}
assert.equal(covered.size,75);
for(let family=0;family<5;family++)for(let target=0;target<G.generate(21).questions[family].targets.length;target++)for(const returning of [false,true])for(const variant of ["blank","kind","body","anchor","drawn","wrong","offscale","overlap","full"]){
  const s=P.fresh(21);s.question=family;s.target=target;s.returnToCheck=returning;const q=G.generate(21).questions[family];
  const f=q.given.find(f=>f.id===q.targets[target]),originalAnchor=q.bodies[0].anchors.find(a=>a.point.x===f.origin.x&&a.point.y===f.origin.y).id;
  const options={offscale:[0,0,0,0,q.maxForce100],overlap:[0,originalAnchor,f.kind,f.angle10,f.force100],blank:M.blank(),kind:[null,null,3,null,null],body:[0,null,null,null,null],anchor:[0,0,null,null,null],drawn:[0,0,null,1350,321],wrong:[0,0,4,1234,100],full:q.expected[target]};
  s.answers[family][target]=M.clone(options[variant]);
  roundtrip(s,c=>{if(returning){c.check();assert.equal(c.mode,"check");}else{drawOne(c);assert.equal(c.state.answers[family][target][3],1234);}});
}
const partial=P.fresh(21);partial.answers[0][0][2]=0;
for(const content of [P.fresh(21),partial,filled(22)]){
  const s=P.check(content);roundtrip(s,c=>{c.navigate(2,1);assert.equal(c.state.returnToCheck,true);drawOne(c);});
  const done=P.review(content),e=environment({durable:finishedData(done)});assert.equal(e.c.mode,"review");assert.deepEqual(e.c.state,done);
  const before=JSON.stringify(e.c.state);e.c.navigate(3);assert.equal(e.c.familyIndex,3);assert.equal(JSON.stringify(e.c.state),before);rows++;
}
const max=filled(0xffffffff);max.answers=G.generate(max.seed).questions.map(q=>q.targets.map(()=>[q.bodies.length-1,0,4,3599,q.maxForce100]));
const review=envelope("review",max),pending={version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(review),score:review.score,maxScore:100,passed:review.passed}};
for(const s of [envelope("draft",max),review,pending])assert.ok(P.bytes(s)<=4000);
for(const mutate of [s=>s.question=null,s=>s.question=5,s=>s.target=99,s=>s.seed=-1,s=>s.generatorVersion=2,s=>s.rubricVersion=2,s=>s.schemaVersion=2,s=>s.phase="review",s=>s.returnToCheck=1,s=>s.answers.pop(),s=>s.answers[0].push(M.blank()),s=>s.answers[0][0]=[null,0,null,null,null],s=>s.answers[0][0]=[0,999,0,10,100],s=>s.answers[0][0]=[0,0,5,10,100],s=>s.answers[0][0]=[0,0,1,null,100],s=>s.answers[0][0]=[0,0,1,3600,100],s=>s.answers[0][0]=[0,0,1,NaN,100],s=>s.answers[0][0]=[0,0,1,100,Infinity],s=>s.answers[0][0]=[0,0,1,100,0],s=>s.answers[0][0]=[0,0,1,100,100000],s=>s.secret=1,s=>delete s.answers]){
 const s=P.fresh(21);mutate(s);assert.throws(()=>P.draft(s));
}
assert.throws(()=>P.draft({...P.check(P.fresh(21)),returnToCheck:true}));
assert.throws(()=>P.decode({...review,activity:"force-equilibrium-advanced-diagram-lab"},"review"));
console.log(`third law persistence: ${rows} restore/continuation rows, all 75 variants, draft/review/pending ${P.bytes(envelope("draft",max))}/${P.bytes(review)}/${P.bytes(pending)} bytes`);
