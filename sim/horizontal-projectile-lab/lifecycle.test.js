'use strict';
const assert=require('node:assert/strict'),R=require('./ui-runtime.js'),P=require('./persistence.js'),M=require('./model.js'),T=require('./test-support.js'),Flow=require('../shared/activity-flow.js');
const start=(fake)=>{const c=new R.Controller(fake,Flow);c.start();return c;};
for(const state of['new','read-error','inconsistent']){const f=T.fake({state}),c=start(f);assert.equal(c.mode,state==='new'?'edit':'technical');assert.equal(Boolean(f.provider),state==='new');}
for(const state of[M.fresh(),T.filled()]){
  const review=T.snapshot(state,'review');const f=T.fake({state:'finished',snapshot:review,score:String(review.score),status:review.passed?'passed':'failed'}),c=start(f);
  assert.equal(c.mode,'review');assert(c.trusted);assert.equal(c.command({type:'clock'}),false);c.clear();assert.equal(c.mode,'review');
  for(const mode of['success','committed','frozen','retry']){const fake=T.fake(),x=start(fake);x.state=M.clone(state);x.check();fake.nextOutcome=mode;x.submit();assert.equal(x.mode,{success:'review',committed:'committed',frozen:'frozen',retry:'check'}[mode]);assert.equal(x.trusted,mode==='success'||mode==='committed');if(mode==='frozen'||mode==='committed'){assert.equal(fake.provider,null);x.retryFinal();assert.equal(x.mode,'review');}}
}
for(const status of['passed','unknown']){const s=T.snapshot(T.filled(),'review');const c=start(T.fake({state:'finished',snapshot:s,score:'12',status}));assert.equal(c.mode,'mismatch');assert(!c.trusted);assert(!c.editable);}
assert.equal(start(T.fake({state:'finished',snapshot:null,score:'0',status:'failed'})).mode,'mismatch');
const legacy=T.legacyFilled(),oldReview=T.snapshot(legacy,'review'),oldDraft={version:1,activity:P.ACTIVITY,kind:'draft',answer:legacy};
const legacyFake=T.fake({state:'draft',snapshot:oldDraft}),old=start(legacyFake);assert.equal(old.mode,'technical');assert.equal(old.state,null);assert.equal(legacyFake.saves.length,0);assert(old.notice.includes('舊版'));
const oldFinished=start(T.fake({state:'finished',snapshot:oldReview,score:'100',status:'passed'}));assert.equal(oldFinished.mode,'review');assert.equal(oldFinished.result.score,100);assert.equal(oldFinished.command({type:'formula',field:'time',value:'fall'}),false);
const oldPending={version:1,activity:P.ACTIVITY,kind:'pending-final',payload:{score:100,maxScore:100,passed:true,reviewJson:JSON.stringify(oldReview)}},oldFake=T.fake({state:'pending-final',snapshot:oldPending}),oldFrozen=start(oldFake);assert.equal(oldFrozen.mode,'frozen');oldFake.final=oldReview;oldFrozen.retryFinal();assert.equal(oldFrozen.mode,'review');assert.equal(oldFrozen.result.score,100);
const inner=T.snapshot(T.filled(),'review'),pending={version:1,activity:P.ACTIVITY,kind:'pending-final',payload:{score:inner.score,maxScore:100,passed:inner.passed,reviewJson:JSON.stringify(inner)}};
let fake=T.fake({state:'pending-final',snapshot:pending}),c=start(fake);assert.equal(c.mode,'frozen');assert.equal(c.result,null);fake.final=inner;c.retryFinal();assert.equal(c.mode,'review');
const bad=M.clone(pending);bad.payload.reviewJson=JSON.stringify({...inner,answer:{...inner.answer,meanV:null}});fake=T.fake({state:'pending-final',snapshot:bad});c=start(fake);assert.equal(c.mode,'technical');assert(fake.quarantined);
fake=T.fake();c=start(fake);fake.failSave=true;c.command({type:'clock'});assert(c.unsaved);c.check();c.submit();assert.equal(c.mode,'check');fake.failSave=false;c.retrySave();assert(!c.unsaved);
c.handleOutcome({activityState:'retry',retryable:false});assert.equal(c.mode,'technical');
console.log('Projectile lifecycle: startup, all submission outcomes, frozen retry/quarantine, mismatch and failed-save locks passed.');
