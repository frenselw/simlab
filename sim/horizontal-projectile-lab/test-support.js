'use strict';
const M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js');
function filled(){
  let s=M.fresh();
  [50,150,300,450,650,800].forEach((depthMm,i)=>{
    s=M.change(s,{type:'record',slot:i,depthMm,ppm:(i*4000)-10000});
    const p=M.impact(depthMm,s.rows[i].speedOffsetPpm);
    [p.x,p.y].forEach((n,axis)=>{s=M.change(s,{type:'read',slot:i,axis,value:Math.round(n)});});
    s=M.change(s,{type:'point',slot:i,value:s.rows[i].read.slice()});
    const t=Math.sqrt(2*s.rows[i].read[1]/1000/M.G);
    s=M.change(s,{type:'calculation',slot:i,field:'t',value:t});
    s=M.change(s,{type:'calculation',slot:i,field:'v',value:s.rows[i].read[0]/1000/t});
  });
  s=M.change(s,{type:'model',value:'square'});s=M.change(s,{type:'fit'});
  s=M.change(s,{type:'answer',field:'meanV',value:M.mean(s.calculations.map(c=>c.v))});
  s=M.change(s,{type:'answer',field:'fitV',value:Math.sqrt(M.G/(2*M.fit(s).coefficients[0]))});
  s=M.change(s,{type:'clock'});s=M.change(s,{type:'answer',field:'gFromClock',value:2*M.timeFit(s,1).coefficients[0]});
  s=M.change(s,{type:'answer',field:'trajectory',value:'parabola'});
  const answers={horizontal:'uniform',hEvidence:'linear-x-time',vertical:'free-fall',vEvidence:'quadratic-y-time-zero-initial'};
  for(const [field,value]of Object.entries(answers))s=M.change(s,{type:'conclusion',field,value});
  return P.draft(s);
}
const snapshot=(s,kind='draft')=>({version:1,activity:P.ACTIVITY,kind,answer:kind==='draft'?P.draft(s):P.review(s),...(kind==='review'?{score:S.score(s).score,passed:S.score(s).passed}:{})});
function fake(attempt={state:'new'}){
  const scorm={attempt,saves:[],provider:null,quarantined:false,failSave:false,nextOutcome:'success',final:null,
    loadAttempt:()=>scorm.attempt,makeSnapshot:(activity,kind,answer,result)=>({version:1,activity,kind,answer,...(result?{score:result.score,passed:result.passed}:{})}),
    setDraftProvider:p=>{scorm.provider=p;},saveDraft:s=>{scorm.saves.push(M.clone(s));return !scorm.failSave;},
    submitWithCallbacks:(result,review,callbacks)=>{scorm.final=review;const mode=scorm.nextOutcome;const o={activityState:mode,retryable:mode==='retry',review,score:result.score,status:result.passed?'passed':'failed'};callbacks[mode==='success'?'onSuccess':'onFailure'](o);},
    quarantinePending:()=>{scorm.quarantined=true;},retryFinish:()=>({ok:true,review:scorm.final}),retryPending:()=>({ok:true,review:scorm.final})};
  return scorm;
}
module.exports={filled,snapshot,fake};
