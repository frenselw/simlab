'use strict';
const assert=require('node:assert/strict'),M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js'),R=require('./ui-runtime.js'),Flow=require('../shared/activity-flow.js');
const snapshot=(s,kind='draft')=>{const answer=kind==='review'?P.review(s):P.draft(s),v={version:1,activity:M.ACTIVITY,kind,answer};if(kind==='review'){const result=S.score(answer);v.score=result.score;v.passed=result.passed;}return v;};
function fake(attempt={state:'new'}){const f={attempt,provider:null,saves:[],failSave:false,nextOutcome:'success',final:null,quarantined:false,
  loadAttempt:()=>f.attempt,makeSnapshot:(activity,kind,answer,result)=>({version:1,activity,kind,answer,...(result?{score:result.score,passed:result.passed}:{})}),
  setDraftProvider:p=>{f.provider=p;},saveDraft:s=>{f.saves.push(M.clone(s));return !f.failSave;},
  submitWithCallbacks:(result,review,cbs)=>{f.final=review;const mode=f.nextOutcome,o={activityState:mode,retryable:mode==='retry',review,score:result.score,status:result.passed?'passed':'failed'};cbs[mode==='success'?'onSuccess':'onFailure'](o);},
  retryFinish:()=>({ok:true,review:f.final}),retryPending:()=>({ok:true,review:f.final}),quarantinePending:()=>{f.quarantined=true;}};return f;}
const start=f=>{const c=new R.Controller(f,Flow);c.start();return c;};
for(const state of ['new','read-error','inconsistent']){const f=fake({state}),c=start(f);assert.equal(c.mode,state==='new'?'edit':'technical');assert.equal(Boolean(f.provider),state==='new');assert.equal(c.startedNew,state==='new');}
for(let page=0;page<6;page++){
  const f=fake(),c=start(f);c.navigate(page);c.command({type:'palette',value:M.physics(c.state.def,page).forces[0][0]});c.command({type:'add'});c.check();assert.equal(c.state.items[page].arrows[0][1],null);c.returnToEdit();assert.equal(c.state.items[page].selected,0);c.check();c.submit();assert.equal(c.mode,'review');assert(c.result.score>0);
  const blank=start(fake());blank.navigate(page);blank.check();blank.submit();assert.equal(blank.result.score,0);
}
const full=M.fresh(()=>.2);M.CASES.forEach((q,page)=>{const p=M.physics(full.def,page),i=full.items[page];i.inward=p.inward;i.relation=q.relation;i.arrows=p.forces.map(([kind,a])=>[kind,a,60]);});full.concept='radial-effect';
const review=snapshot(full,'review');assert.equal(review.score,100);
for(const mode of ['success','committed','frozen','retry']){const f=fake({state:'draft',snapshot:snapshot(full)}),c=start(f);c.check();f.nextOutcome=mode;c.submit();assert.equal(c.mode,{success:'review',committed:'committed',frozen:'frozen',retry:'check'}[mode]);assert.equal(c.trusted,['success','committed'].includes(mode));if(['frozen','committed'].includes(mode)){assert.equal(f.provider,null);assert.equal(c.command({type:'clear-page'}),false);c.retryFinal();assert.equal(c.mode,'review');}}
const pending={version:1,activity:M.ACTIVITY,kind:'pending-final',payload:{score:100,maxScore:100,passed:true,reviewJson:JSON.stringify(review)}};
let f=fake({state:'pending-final',snapshot:pending}),c=start(f);assert.equal(c.mode,'frozen');f.final=review;c.retryFinal();assert.equal(c.mode,'review');
const oldReview=M.clone(review);oldReview.answer.v=1;oldReview.answer.mv=1;oldReview.answer.items.forEach(item=>delete item.pose);
const oldPending={...pending,payload:{...pending.payload,reviewJson:JSON.stringify(oldReview)}};
f=fake({state:'pending-final',snapshot:oldPending});c=start(f);assert.equal(c.mode,'frozen');assert.equal(c.state.v,2);f.final=oldReview;c.retryFinal();assert.equal(c.mode,'review');assert.equal(c.result.score,100);
for(const mutate of [s=>{s.payload.score=0;},s=>{s.payload.reviewJson='bad';},s=>{const inner=JSON.parse(s.payload.reviewJson);inner.answer.items[0].inward=null;s.payload.reviewJson=JSON.stringify(inner);},s=>{s.payload.reviewJson+=' '.repeat(4000);}]){const bad=M.clone(pending);mutate(bad);f=fake({state:'pending-final',snapshot:bad});c=start(f);assert.equal(c.mode,'technical');assert(f.quarantined);}
for(const [score,status]of [['99','passed'],['100','unknown'],['','failed']]){c=start(fake({state:'finished',snapshot:review,score,status}));assert.equal(c.mode,'mismatch');assert(!c.trusted);}
c=start(fake({state:'finished',snapshot:review,score:'100',status:'passed'}));assert.equal(c.mode,'review');assert.equal(c.command({type:'clear-page'}),false);
f=fake();c=start(f);f.failSave=true;c.command({type:'palette',value:0});assert(c.unsaved);c.check();c.submit();assert.equal(c.mode,'check');f.failSave=false;c.retrySave();assert(!c.unsaved);c.handleOutcome({activityState:'retry',retryable:false});assert.equal(c.mode,'technical');
f=fake({state:'draft',snapshot:{...snapshot(M.fresh(()=>.2)),answer:{}}});c=start(f);assert.equal(c.mode,'technical');assert.equal(f.saves.length,0);
console.log('Centripetal source lifecycle: startup, blank/partial, outcomes, pending, trust mismatch and save failure passed.');
