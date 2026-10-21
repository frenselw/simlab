(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./model.js'):root.CircularVectorModel);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CircularVectorPersistence=api;
})(typeof window==='undefined'?globalThis:window,function(M){
  'use strict';
  const MAX_BYTES=4000,ROOT=['schemaVersion','modelVersion','rubricVersion','definition','phase','task','observation','answers'];
  const ANSWERS=[...M.QUESTIONS.map(q=>q.field),'deltaFrom','deltaTo'];
  const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  const check=value=>{if(!value)throw Error('Invalid circular-motion snapshot');};
  const keys=(obj,fields)=>check(obj&&typeof obj==='object'&&!Array.isArray(obj)&&fields.every(k=>Object.hasOwn(obj,k)));
  function validate(s,kind='draft'){
    check(['draft','review'].includes(kind));keys(s,ROOT);
    check(s.schemaVersion===1&&s.modelVersion===1&&s.rubricVersion===1);
    keys(s.definition,['startIndex','sense','choiceShift']);check(M.integer(s.definition.startIndex,0,3)&&[-1,1].includes(s.definition.sense)&&M.integer(s.definition.choiceShift,0,3));
    // Older attempts retain their cardinal start; only new attempts have an angular offset.
    check(!Object.hasOwn(s.definition,'startOffsetDeg')||M.integer(s.definition.startOffsetDeg,0,89));
    check(!Object.hasOwn(s.definition,'choiceRanks')||(Array.isArray(s.definition.choiceRanks)&&s.definition.choiceRanks.length===M.QUESTIONS.length&&M.QUESTIONS.every((q,i)=>M.integer(s.definition.choiceRanks[i],0,q.type==='direction'?23:5))));
    check(['edit','check'].includes(s.phase)&&(kind!=='review'||s.phase==='check')&&M.integer(s.task,0,2));
    keys(s.observation,M.GAP_KEYS);check(M.GAP_KEYS.every(k=>M.integer(s.observation[k],5,60)));
    keys(s.answers,ANSWERS);
    M.QUESTIONS.forEach(q=>check(s.answers[q.field]===null||M.options(s,q).some(o=>o[0]===s.answers[q.field])));
    const {deltaFrom:from,deltaTo:to}=s.answers;
    check((from===null||M.NODES.includes(from))&&(to===null||M.NODES.includes(to))&&(to===null||(from!==null&&from!==to)));
    check(bytes(s)<=MAX_BYTES);return s;
  }
  const pick=(s,fields)=>Object.fromEntries(fields.map(k=>[k,s[k]]));
  function draft(s){validate(s);return M.clone({...pick(s,ROOT),definition:pick(s.definition,['startIndex','sense','choiceShift',...['startOffsetDeg','choiceRanks'].filter(k=>Object.hasOwn(s.definition,k))]),observation:pick(s.observation,M.GAP_KEYS),answers:pick(s.answers,ANSWERS)});}
  function review(s){return {...draft(s),phase:'check'};}
  function decode(snapshot,kind){
    keys(snapshot,['version','activity','kind','answer']);check(snapshot.version===1&&snapshot.activity===M.ACTIVITY&&snapshot.kind===kind&&bytes(snapshot)<=MAX_BYTES);validate(snapshot.answer,kind);
    return kind==='review'?review(snapshot.answer):draft(snapshot.answer);
  }
  return Object.freeze({ACTIVITY:M.ACTIVITY,MAX_BYTES,bytes,validate,draft,review,decode});
});
