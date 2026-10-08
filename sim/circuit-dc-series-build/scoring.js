(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./persistence'):root.CircuitTaskPersistence,node?require('../circuit-workbench/circuit-checks'):root.CircuitChecks,node?require('../circuit-workbench/circuit-solver'):root.CircuitSolver);if(node)module.exports=api;else root.CircuitTaskScoring=api;})(globalThis,function(P,C,S){
'use strict';
function score(s){const d=P.document(s),lamps=d.components.filter(c=>c.type==='lamp').map(c=>c.id),sw=d.components.find(c=>c.type==='switch'),battery=d.components.find(c=>c.type==='battery'),all=d.components.map(c=>c.id);
const wiring=JSON.parse(JSON.stringify(d));wiring.components.filter(c=>c.type==='switch').forEach(c=>c.params.closed=true);
const series=ids=>ids.length>=2&&C.series(wiring,ids).passed,t=C.topology(wiring,true);
const ring=lamps.length===2&&!!sw&&!!battery&&all.length===4&&series(all)&&t.edges.every(e=>e.a!==e.b&&[e.a,e.b].every(n=>t.incident.get(n)?.length===2));
const a=S.solve(d),powered=ring&&C.series(d,all,{requirePowered:true}).passed&&lamps.every(id=>Math.abs(Math.abs(a.components[id].current)-.25)<=1e-6);
const detail=[['兩燈串聯',30,lamps.length===2&&series(lamps)],['開關與兩燈串聯',20,lamps.length===2&&!!sw&&series([...lamps,sw.id])],['全部元件構成環路接線',30,ring],['兩燈各有 0.25 A 電流',20,powered]].map(([label,max,ok])=>({label,max,earned:ok?max:0}));const total=detail.reduce((n,x)=>n+x.earned,0);return {score:total,maxScore:100,passed:total>=80&&powered,completed:true,detail};}
return {score};
});
