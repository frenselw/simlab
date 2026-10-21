'use strict';
const M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js');
function filled(){const s=M.fresh(()=>.65);M.QUESTIONS.forEach(q=>{s.answers[q.field]=q.correct;});s.answers.deltaFrom='U';s.answers.deltaTo='V';return s;}
const snapshot=(s,kind='draft')=>({version:1,activity:M.ACTIVITY,kind,answer:kind==='review'?P.review(s):P.draft(s),...(kind==='review'?{score:S.score(s).score,passed:S.score(s).passed}:{})});
function fake(attempt={state:'new'}){
  const f={attempt,provider:null,saves:[],failSave:false,nextOutcome:'success',final:null,quarantined:false,
    loadAttempt:()=>f.attempt,makeSnapshot:(activity,kind,answer,result)=>({version:1,activity,kind,answer,...(result?{score:result.score,passed:result.passed}:{})}),
    setDraftProvider:p=>{f.provider=p;},saveDraft:s=>{f.saves.push(M.clone(s));return !f.failSave;},
    submitWithCallbacks:(result,review,cbs)=>{f.final=review;const mode=f.nextOutcome,o={activityState:mode,retryable:mode==='retry',review,score:result.score,status:result.passed?'passed':'failed'};cbs[mode==='success'?'onSuccess':'onFailure'](o);},
    retryFinish:()=>({ok:true,review:f.final}),retryPending:()=>({ok:true,review:f.final}),quarantinePending:()=>{f.quarantined=true;}};
  return f;
}
module.exports={filled,snapshot,fake};
