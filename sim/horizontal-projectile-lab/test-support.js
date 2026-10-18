'use strict';
const M=require('./model.js'),P=require('./persistence.js'),S=require('./scoring.js');
function filled(){
  let s=M.fresh();
  [50,150,300,450,650,800].forEach((depthMm,i)=>{
    s=M.change(s,{type:'record',slot:i,depthMm,ppm:(i*4000)-10000});
    const p=M.impact(depthMm,s.rows[i].speedOffsetPpm);
    [p.x,p.y].forEach((n,axis)=>{s=M.change(s,{type:'read',slot:i,axis,value:Math.round(n)});});
  });
  s=M.change(s,{type:'formula',field:'time',value:'fall'});s=M.change(s,{type:'formula',field:'speed',value:'horizontal'});
  s=M.change(s,{type:'model',value:'square'});s=M.change(s,{type:'fit'});
  s=M.change(s,{type:'answer',field:'meanV',value:M.mean(M.calculations(s).map(c=>c.v))});
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
function legacyFilled(){return {"schemaVersion":1,"modelVersion":1,"rubricVersion":1,"rows":[{"depthMm":50,"speedOffsetPpm":-10000,"clockMs":101,"read":[166,50],"point":[166,50]},{"depthMm":150,"speedOffsetPpm":-6000,"clockMs":175,"read":[288,150],"point":[288,150]},{"depthMm":300,"speedOffsetPpm":-2000,"clockMs":247,"read":[409,300],"point":[409,300]},{"depthMm":450,"speedOffsetPpm":2000,"clockMs":303,"read":[503,450],"point":[503,450]},{"depthMm":650,"speedOffsetPpm":6000,"clockMs":364,"read":[607,650],"point":[607,650]},{"depthMm":800,"speedOffsetPpm":10000,"clockMs":404,"read":[676,800],"point":[676,800]}],"fit":{"model":"square","attempted":true},"trajectory":"parabola","calculations":[{"t":0.10101525445522107,"v":1.6433161594775367},{"t":0.17496355305594127,"v":1.6460571071502959},{"t":0.24743582965269673,"v":1.6529538206898986},{"t":0.3030457633656632,"v":1.6598153177052228},{"t":0.3642156795423418,"v":1.6665949164042877},{"t":0.40406101782088427,"v":1.6730146442873717}],"meanV":1.6569586609524356,"fitV":1.667378415150719,"clockShown":true,"gFromClock":9.764951663564233,"conclusions":{"horizontal":"uniform","hEvidence":"linear-x-time","vertical":"free-fall","vEvidence":"quadratic-y-time-zero-initial"},"phase":"edit","view":"collect","returnToCheck":false,"setup":{"depthMm":200,"slot":5},"selectedSlot":5,"ruler":{"axis":"x","zero":[0,0]},"connectPoints":false};}
module.exports={legacyFilled,filled,snapshot,fake};
