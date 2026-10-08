(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./persistence'):root.CircuitTaskPersistence,node?require('../circuit-workbench/circuit-solver'):root.CircuitSolver);if(node)module.exports=api;else root.CircuitTaskScoring=api;})(globalThis,function(P,S){
'use strict';
function score(input){const s=P.validate(input),detail=[];s.answers.forEach((answer,i)=>{const a=S.solve(P.document({...s,question:i})),reading=Math.abs(i===0?a.components.c2.reading:a.components.c5.reading),target=i===0?.25:1.8,tolerance=i===0?.005:.03;detail.push({label:'第 '+(i+1)+' 題：指定讀數',max:30,earned:answer.position!==null&&a.diagnostics.length===0&&Math.abs(reading-target)<=tolerance+1e-12?30:0});detail.push({label:'第 '+(i+1)+' 題：電阻變化',max:20,earned:answer.reason===(i===0?-1:1)?20:0});});const total=detail.reduce((n,x)=>n+x.earned,0);return {score:total,maxScore:100,passed:total>=80,completed:true,detail};}
return {score};
});
