'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js'),T=require('./test-support.js');
const arrows=[[null,null],...M.NODES.map(k=>[k,null]),...M.NODES.flatMap(a=>M.NODES.filter(b=>b!==a).map(b=>[a,b]))];let cases=0,maxBytes=0;
for(const phase of ['edit','check'])for(let task=0;task<3;task++)for(let startIndex=0;startIndex<4;startIndex++)for(const sense of [-1,1])for(let choiceShift=0;choiceShift<4;choiceShift++)for(const gap of [5,31,60])for(const answerClass of ['blank','partial','full'])for(const [from,to]of arrows){
  const s=answerClass==='full'?T.filled():M.fresh(()=>0);s.phase=phase;s.task=task;s.definition={startIndex,sense,choiceShift};s.observation={positionGapDeg:gap,velocityGapDeg:65-gap,transferGapDeg:gap};
  if(answerClass==='partial'){s.answers.transferReason='speed-only';s.answers.velocityReason='displacement-per-time';}
  s.answers.deltaFrom=from;s.answers.deltaTo=to;
  for(const kind of ['draft','review']){const encoded=T.snapshot(s,kind),restored=P.decode(JSON.parse(JSON.stringify(encoded)),kind);assert.deepEqual(restored,kind==='review'?P.review(s):P.draft(s));assert.deepEqual(S.score(restored),S.score(s));
    const editable=M.navigate(restored,task),continued=M.change(editable,{type:'gap',value:gap===5?6:5});assert.equal(continued.observation[M.GAP_KEYS[task]],gap===5?6:5);assert.deepEqual(continued.answers,s.answers);P.validate(continued);maxBytes=Math.max(maxBytes,P.bytes(encoded));}
  cases++;
}
const invalid=[s=>{delete s.answers.deltaFrom;},s=>{s.answers.deltaTo='V';},s=>{s.answers.deltaFrom=s.answers.deltaTo='U';},s=>{s.answers.velocityReason='unknown';},s=>{s.definition.sense=0;},s=>{s.definition.startIndex=4;},s=>{s.definition.choiceShift='0';},s=>{s.schemaVersion=2;},s=>{s.modelVersion=0;},s=>{s.rubricVersion=0;},s=>{s.task=3;},s=>{s.phase='submitted';},s=>{s.answers=[];}];
for(const value of [null,NaN,Infinity,-1,0,4,61,5.5,'5'])invalid.push(s=>{s.observation.positionGapDeg=value;});
for(const mutate of invalid){const s=M.fresh();mutate(s);assert.throws(()=>P.validate(s));}
assert.throws(()=>P.decode({...T.snapshot(M.fresh()),kind:'review'},'review'));
const generated={...M.fresh(),generatedId:'obsolete-dom',permissions:'editable'};assert(!Object.hasOwn(P.draft(generated),'generatedId'));assert(!Object.hasOwn(P.draft(generated),'permissions'));
let s=T.filled();s=M.navigate(s,1);s=M.change(s,{type:'change-end'});assert.equal(s.answers.deltaFrom,'U');assert.equal(s.answers.deltaTo,null);s=M.change(s,{type:'redraw'});assert.equal(s.answers.deltaFrom,null);const before=s.answers.velocityDirection;s=M.change(s,{type:'clear-task'});assert.equal(s.answers.velocityDirection,before);assert.equal(s.answers.accelerationDirection,null);
const final=T.snapshot(T.filled(),'review'),pending={version:1,activity:M.ACTIVITY,kind:'pending-final',payload:{score:100,maxScore:100,passed:true,reviewJson:JSON.stringify(final)}};assert(P.bytes(pending)<=4000);
const longest=T.filled();longest.phase='check';longest.task=2;longest.definition={startIndex:3,sense:-1,choiceShift:3};longest.observation={positionGapDeg:60,velocityGapDeg:60,transferGapDeg:60};
for(const q of M.QUESTIONS)longest.answers[q.field]=M.options(longest,q).map(o=>o[0]).sort((a,b)=>b.length-a.length)[0];
const worstReview=T.snapshot(longest,'review'),worstPending={version:1,activity:M.ACTIVITY,kind:'pending-final',payload:{score:worstReview.score,maxScore:100,passed:worstReview.passed,reviewJson:JSON.stringify(worstReview)}};
for(const snap of [T.snapshot(longest),worstReview,worstPending])assert(P.bytes(snap)<=4000);
console.log(`Circular vector persistence: ${cases} phase/task/definition/gap/answer/drawing variants each restored as draft/review with legal continuation; max matrix snapshot ${maxBytes} bytes; longest draft/review/pending ${P.bytes(T.snapshot(longest))}/${P.bytes(worstReview)}/${P.bytes(worstPending)} bytes.`);
