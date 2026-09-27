"use strict";
const assert=require("node:assert/strict"), M=require("./model.js"), P=require("./persistence.js"), S=require("./scoring.js");
const {environment,record,filled,durableDraft,finishedData}=require("./test-support.js");
let tested=0;
function roundtrip(state,continueWith) {
  const e=environment({durable:durableDraft(state)});assert.equal(e.c.mode,state.phase);assert.deepEqual(e.c.state,state);
  assert.equal(S.score(e.c.state).score,S.score(state).score);assert.equal(S.score(e.c.state).passed,S.score(state).passed);
  const encoded=e.c.draftSnapshot();assert.deepEqual(P.decode(JSON.parse(JSON.stringify(encoded)),"draft"),state);
  continueWith(e.c);assert.ok(e.c.editable);P.draft(e.c.state);
  e.c.check();e.c.submit();assert.equal(e.c.mode,"review","each variant can explicitly submit"); tested++;
}
for(const group of [0,1]) for(const returning of [false,true]) for(const n of [0,1,5,6]) for(const candidate of [false,true]) {
  if(n===6 && candidate) continue;
  let s=P.navigate(M.fresh(),"collect",group);
  for(let i=0;i<n;i++) s=record(s,group,i%7,i%6);
  s=M.change(s,{type:"role",group,index:0,value:"acceleration"}); // Wrong answers are legitimate.
  if(candidate) s=M.change(s,{type:"measure",group});
  s.returnToCheck=returning;
  roundtrip(s,c=>{if(candidate) {assert.ok(c.command({type:"record"}));assert.equal(c.state.groups[group].records.length,n+1);} else if(n===6) {assert.ok(c.command({type:"removeRecord",index:2}));assert.equal(c.state.groups[group].records.length,5);} else {assert.ok(c.command({type:"measure"}));assert.ok(c.state.setups[group].candidate);} });
}
for(const graph of [0,1,2]) for(const returning of [false,true]) for(const variant of ["no-source","unplaced","partial","full","fit-ok","fit-too-few","fit-domain","fit-rank","fit-invalidated","offscale"]) {
  let s=variant==="no-source"?M.fresh():filled();
  const p=s.plots[graph];
  p.model=null;p.fitAttempted=false;
  if(variant==="unplaced"||variant==="fit-too-few") p.points=p.points.map(()=>null);
  if(variant==="partial") p.points[0]=null;
  if(variant==="fit-ok") {p.model="linear";p.fitAttempted=true;}
  if(variant==="fit-too-few") {p.model="quadratic";p.fitAttempted=true;}
  if(variant==="fit-domain") {p.model="inverse";p.fitAttempted=true;p.points[0]=[0,1000];}
  if(variant==="fit-rank") {p.model="quadratic";p.fitAttempted=true;p.points=p.points.map((_,i)=>[1000,i*1000]);}
  if(variant==="fit-invalidated") p.model="inverse";
  if(variant==="offscale") p.points[0]=[1000,30000];
  s=P.navigate(s,"plot",graph);s.returnToCheck=returning;
  roundtrip(s,c=>{assert.ok(c.command({type:"model",value:variant==="fit-ok"?"origin":"linear"}));assert.ok(c.command({type:"fit"}));assert.equal(c.state.plots[graph].fitAttempted,true);});
}
for(const phase of ["conclude","check"]) for(const content of ["blank","partial","full"]) for(const returning of [false,true]) {
  if(phase==="check" && returning)continue;
  let s=content==="full"?filled():M.fresh(); if(content==="partial") s.conclusions[1]="direct";
  s=P.navigate(s,phase);s.returnToCheck=returning;
  roundtrip(s,c=>{c.navigate("collect",1);assert.equal(c.state.returnToCheck,phase==="check"||returning);assert.ok(c.command({type:"lock",index:1}));});
}
for(const state of [M.fresh(),record(M.fresh(),0,1,2),filled()]) {
  const e=environment({durable:finishedData(state)});assert.equal(e.c.mode,"review");assert.deepEqual(e.c.state,P.review(state));assert.equal(S.score(e.c.state).score,S.score(state).score);
  e.c.navigate("plot",2);assert.deepEqual(e.c.view,{phase:"plot",index:2});assert.equal(e.c.command({type:"model",value:"linear"}),false);tested++;
}
for(const graph of [0,1,2])for(const returning of [false,true])for(const meaning of [null,"mass",M.INTERPRETATIONS[graph].answer])for(const variant of ["no-source","ready","unfit","failed","invalidated"]) {
  let s=variant==="no-source"?M.fresh():filled();s=M.change(s,{type:"meaning",graph,value:meaning});
  if(variant==="unfit")s.plots[graph].fitAttempted=false;
  if(variant==="failed"){s.plots[graph].model="quadratic";s.plots[graph].points=s.plots[graph].points.map(()=>[1000,1000]);}
  if(variant==="invalidated")s=M.change(s,{type:"place",graph,index:0,point:[1200,1234]});
  s=P.navigate(s,"plot",graph);s.returnToCheck=returning;
  roundtrip(s,c=>{const value=meaning===null?M.INTERPRETATIONS[graph].answer:null;assert.ok(c.command({type:"meaning",value}));assert.equal(c.state.plots[graph].meaning,value);});
}
const invalid=[s=>s.groups.pop(),s=>s.groups[0].records.push([0,0,1]),s=>s.groups[0].roles[0]="velocity",s=>s.plots[0].points.push([1,1]),s=>s.plots[0].points[0]=[Infinity,0],s=>s.plots[0].points[0]=[-1,0],s=>s.plots[1].points[0]=[0,30001],s=>s.plots[0].points[0]=[0,0,0],s=>s.plots[0].model="cubic",s=>s.plots[0].model=null,s=>s.conclusions[0]="unknown",s=>s.phase="review",s=>s.graph=0,s=>s.group=null,s=>s.setups[0].candidate=M.measure(0,0),s=>s.schemaVersion=7,s=>s.schemaVersion=1,s=>s.rubricVersion=7,s=>delete s.plots[0].meaning,s=>s.plots[0].meaning="velocity",s=>s.setups[0].locks[0]=0,s=>s.extra=1];
for(const mutate of invalid) {const s=filled();mutate(s);assert.throws(()=>P.draft(s));}
let s=P.navigate(M.fresh(),"check");s.returnToCheck=true;assert.throws(()=>P.draft(s));
const brokenEnvelope=environment({standalone:true}).scorm.makeSnapshot(P.ACTIVITY,"draft",M.fresh());brokenEnvelope.activity="another";assert.throws(()=>P.decode(brokenEnvelope,"draft"));
// True worst-case numeric lengths, enum lengths and escaped nested review envelope.
const maximum=filled();maximum.groups.forEach(g=>g.roles=["acceleration","acceleration","acceleration"]);maximum.plots.forEach((p,i)=>{p.points=p.points.map(()=>[i===0?14000:22500,30000]);p.model="quadratic";p.meaning="inverse-force";});
maximum.conclusions=["independent","inverse-square","negative-slope","linear-reciprocal","f-m-plus-a"];
const e=environment({durable:durableDraft(maximum)}),draft=e.c.draftSnapshot();e.c.check();e.flags.writeFail="cmi.core.score.raw";e.c.submit();
const pending=JSON.parse(e.durable["cmi.suspend_data"]), review=JSON.parse(pending.payload.reviewJson),sizes=[draft,review,pending].map(P.bytes);
sizes.forEach(n=>assert.ok(n<=4000,`${n} UTF-8 bytes`));assert.equal(review.answer.setups,undefined);
console.log(`newton persistence: ${tested} production restores plus legal continuations, corrupt-state rejection; maximum draft/review/pending ${sizes.join("/")} bytes`);
