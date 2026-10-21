(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.CircularVectorModel,node?require('./persistence.js'):root.CircularVectorPersistence);
  if(node)module.exports=api;if(root)root.CircularVectorScoring=api;
})(typeof window==='undefined'?globalThis:window,function(M,P){
  'use strict';
  function score(state){
    P.validate(state);const a=state.answers;
    const detail=M.QUESTIONS.map(q=>({id:q.id,title:q.title,earned:a[q.field]===q.correct?q.points:0,max:q.points,answer:a[q.field],correct:q.correct,task:q.task}));
    const selected=[a.deltaFrom,a.deltaTo],ends=5*['U','V'].filter(k=>selected.includes(k)).length,forward=a.deltaFrom==='U'&&a.deltaTo==='V';
    detail.splice(2,0,{id:'D1',title:'選出兩個速度末端',earned:ends,max:10,task:1},{id:'D2',title:'末速度減初速度的箭向',earned:forward?10:0,max:10,task:1});
    const total=detail.reduce((n,d)=>n+d.earned,0);
    return {score:total,maxScore:100,passed:total>=60,completed:true,detail,feedback:'依最終答案逐項計分；未答項為零，其餘保留部分得分。'};
  }
  return Object.freeze({score});
});
