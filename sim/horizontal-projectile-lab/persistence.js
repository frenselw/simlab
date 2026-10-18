(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./model.js'):root.ProjectileModel);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ProjectilePersistence=api;
})(typeof window==='undefined'?globalThis:window,function(M){
  'use strict';
  const ACTIVITY='horizontal-projectile-lab', MAX_BYTES=4000;
  const fields=['schemaVersion','modelVersion','rubricVersion','rows','fit','trajectory','calculations','meanV','fitV','clockShown','gFromClock','conclusions'];
  const draftFields=['phase','view','returnToCheck','setup','selectedSlot','ruler','connectPoints'];
  const bytes=o=>new TextEncoder().encode(JSON.stringify(o)).length;
  const fail=()=>{throw new Error('Invalid projectile snapshot');};
  const check=condition=>{if(!condition)fail();};
  const number=(v,signed=false)=>v===null||(Number.isFinite(v)&&(signed||v>=0));
  const choice=(v,values)=>v===null||values.includes(v);
  const keys=(v,required)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k)));
  function validate(s,kind){
    check(kind==='draft'||kind==='review'); keys(s,fields);
    check(s.schemaVersion===1&&s.modelVersion===1&&s.rubricVersion===1);
    check(Array.isArray(s.rows)&&s.rows.length===6&&Array.isArray(s.calculations)&&s.calculations.length===6);
    s.rows.forEach(r=>{
      if(r===null)return;
      keys(r,['depthMm','speedOffsetPpm','clockMs','read','point']);
      check(M.integer(r.depthMm,50,800)&&r.depthMm%5===0&&M.integer(r.speedOffsetPpm,-10000,10000));
      check(r.clockMs===M.impact(r.depthMm,r.speedOffsetPpm).clockMs);
      check(Array.isArray(r.read)&&r.read.length===2&&r.read.every(v=>v===null||M.integer(v,0,1000)));
      check(r.point===null||(Array.isArray(r.point)&&r.point.length===2&&r.point.every(v=>M.integer(v,0,1000))&&!r.read.includes(null)));
    });
    s.calculations.forEach((c,i)=>{
      keys(c,['t','v']); check(number(c.t)&&number(c.v)&&(c.t===null||c.t<=10));
      if(c.t!==null||c.v!==null)check(s.rows[i]&&!s.rows[i].read.includes(null));
    });
    keys(s.fit,['model','attempted']);check(choice(s.fit.model,['linear','quadratic','square'])&&typeof s.fit.attempted==='boolean'&&(s.fit.model!==null||!s.fit.attempted));
    check(choice(s.trajectory,['line','parabola','circle','other']));
    check(number(s.meanV)&&number(s.fitV)&&number(s.gFromClock,true)&&typeof s.clockShown==='boolean');
    if(s.meanV!==null)check(M.included(s).length>=2);
    if(s.fitV!==null){const f=M.fit(s);check(s.fit.attempted&&s.fit.model==='square'&&f.ok&&f.coefficients[0]>0);}
    if(s.gFromClock!==null)check(s.clockShown&&M.timeFit(s,1).ok);
    keys(s.conclusions,Object.keys(M.QUESTIONS));
    Object.entries(M.QUESTIONS).forEach(([k,q])=>check(choice(s.conclusions[k],q[1].map(o=>o[0]))));
    if(kind==='draft'){
      keys(s,draftFields);check(['edit','check'].includes(s.phase)&&M.VIEWS.includes(s.view)&&typeof s.returnToCheck==='boolean'&&(s.phase!=='check'||!s.returnToCheck));
      keys(s.setup,['depthMm','slot']);check(M.integer(s.setup.depthMm,50,800)&&s.setup.depthMm%5===0&&M.integer(s.setup.slot,0,5));
      check(s.selectedSlot===null||(M.integer(s.selectedSlot,0,5)&&s.rows[s.selectedSlot]!==null));
      keys(s.ruler,['axis','zero']);check(['x','y'].includes(s.ruler.axis)&&Array.isArray(s.ruler.zero)&&s.ruler.zero.length===2&&s.ruler.zero.every(n=>M.integer(n,-100,1000)));
      check(typeof s.connectPoints==='boolean');
    }
    check(bytes(s)<=MAX_BYTES);
    return s;
  }
  function review(s){validate(s,Object.hasOwn(s,'phase')?'draft':'review');return M.clone(Object.fromEntries(fields.map(k=>[k,s[k]])));}
  function draft(s){validate(s,'draft');return M.clone(Object.fromEntries([...fields,...draftFields].map(k=>[k,s[k]])));}
  function decode(snapshot,kind){
    check(snapshot?.version===1&&snapshot.activity===ACTIVITY&&snapshot.kind===kind&&bytes(snapshot)<=MAX_BYTES);
    validate(snapshot.answer,kind);return kind==='draft'?draft(snapshot.answer):review(snapshot.answer);
  }
  function editableFromReview(s){return {...M.fresh(),...review(s)};}
  function navigate(s,view,checkView=false){
    const n=draft(s);check(M.VIEWS.includes(view));
    n.returnToCheck=!checkView&&(s.phase==='check'||s.returnToCheck);n.phase=checkView?'check':'edit';n.view=view;return draft(n);
  }
  return Object.freeze({ACTIVITY,MAX_BYTES,bytes,validate,review,draft,decode,editableFromReview,navigate,fresh:M.fresh});
});
