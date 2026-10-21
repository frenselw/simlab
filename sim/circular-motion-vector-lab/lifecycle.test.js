'use strict';
const assert=require('node:assert/strict'),R=require('./ui-runtime.js'),M=require('./model.js'),P=require('./persistence.js'),T=require('./test-support.js'),Flow=require('../shared/activity-flow.js');
const start=f=>{const c=new R.Controller(f,Flow);c.start();return c;};
for(const state of ['new','read-error','inconsistent']){const f=T.fake({state}),c=start(f);assert.equal(c.mode,state==='new'?'edit':'technical');assert.equal(Boolean(f.provider),state==='new');}
for(const source of [M.fresh(),T.filled(),{...T.filled(),answers:{...T.filled().answers,deltaFrom:'V',deltaTo:'U'}}]){
  const review=T.snapshot(source,'review'),done=start(T.fake({state:'finished',snapshot:review,score:String(review.score),status:review.passed?'passed':'failed'}));assert.equal(done.mode,'review');assert(done.trusted);assert.equal(done.command({type:'gap',value:5}),false);
  for(const mode of ['success','committed','frozen','retry']){const f=T.fake({state:'draft',snapshot:T.snapshot(source)}),c=start(f);c.check();f.nextOutcome=mode;c.submit();assert.equal(c.mode,{success:'review',committed:'committed',frozen:'frozen',retry:'check'}[mode]);assert.equal(c.trusted,['success','committed'].includes(mode));if(['frozen','committed'].includes(mode)){assert.equal(f.provider,null);assert.equal(c.command({type:'clear-task'}),false);c.retryFinal();assert.equal(c.mode,'review');}}
}
for(let task=0;task<3;task++){const f=T.fake(),c=start(f);c.navigate(task);c.check();assert.equal(c.state.task,task);c.submit();assert.equal(c.result.score,0);}
const review=T.snapshot(T.filled(),'review'),pending={version:1,activity:M.ACTIVITY,kind:'pending-final',payload:{score:100,maxScore:100,passed:true,reviewJson:JSON.stringify(review)}};
let f=T.fake({state:'pending-final',snapshot:pending}),c=start(f);assert.equal(c.mode,'frozen');assert.equal(c.result,null);f.final=review;c.retryFinal();assert.equal(c.mode,'review');
for(const mutate of [s=>{s.payload.score=0;},s=>{s.payload.reviewJson='bad';},s=>{const inner=JSON.parse(s.payload.reviewJson);inner.answer.answers.velocityDirection=null;s.payload.reviewJson=JSON.stringify(inner);},s=>{s.payload.reviewJson+=' '.repeat(4000);}]){const bad=M.clone(pending);mutate(bad);f=T.fake({state:'pending-final',snapshot:bad});c=start(f);assert.equal(c.mode,'technical');assert(f.quarantined);}
f=T.fake({state:'pending-final',snapshot:pending});c=start(f);const changed=M.clone(review);changed.answer.observation.velocityGapDeg=5;f.final=changed;c.retryFinal();assert.equal(c.mode,'technical');
for(const [score,status]of [['99','passed'],['100','unknown'],['','failed']]){c=start(T.fake({state:'finished',snapshot:review,score,status}));assert.equal(c.mode,'mismatch');assert(!c.trusted);assert(!c.editable);}
c=start(T.fake({state:'finished',snapshot:{...review,answer:{}},score:'100',status:'passed'}));assert.equal(c.mode,'mismatch');
f=T.fake();c=start(f);f.failSave=true;c.command({type:'gap',value:5});assert(c.unsaved);c.check();c.submit();assert.equal(c.mode,'check');f.failSave=false;c.retrySave();assert(!c.unsaved);c.handleOutcome({activityState:'retry',retryable:false});assert.equal(c.mode,'technical');
f=T.fake({state:'draft',snapshot:{...T.snapshot(M.fresh()),answer:{}}});c=start(f);assert.equal(c.mode,'technical');assert.equal(f.saves.length,0);
console.log('Circular vector lifecycle: startup, blank/partial submit, all outcomes, locked retry, pending quarantine/canonical answer checks, recorded trust and failed saves passed.');
