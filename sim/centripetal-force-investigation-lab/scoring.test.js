"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), S = require("./scoring.js");
const s = M.fresh(1); s.rv=3; assert.equal(S.score(s).score, 0);
s.tasks[0].inquiry = ["equal-mass", "ratio-steady"]; s.tasks[0].law = "linear";
assert.equal(S.score(s).detail.pages[0].score, 12, "concept credit is independent of data");
assert.equal(M.begin(s.tasks[0]), true); const run = s.tasks[0].runs[0]; run.cfg = [4, 2, 2, 2];
for (const q of [500, 1250, 2250, 3500]) assert.equal(M.record(s.tasks[0], q / 1000), true);
assert.equal(M.fitCurrent("radius", s.tasks[0]).ok, true);
run.a = ["1.5", "supports", "coefficient"];
assert.equal(S.score(s).detail.pages[0].score, 30);
assert.equal(S.near("1.47", 1.5), true); assert.equal(S.near("1.469", 1.5), false);
assert.equal(S.near("1.53", 1.5), true); assert.equal(S.near("1.531", 1.5), false);
run.cfg = [4, 2, 2, 4]; run.fit = true; run.a[1] = "confounded"; run.a[2] = "uncertain";
assert.equal(S.comparison("radius", run), "confounded");
assert.equal(S.page(s, 0).fitScore, 6, "correct recognition of confounding keeps interpretation credit");
const omega = s.tasks[2]; M.begin(omega); for (const q of [500, 1500, 3000]) M.record(omega, q / 1000);
assert.equal(M.fitCurrent("omega", omega).ok, true); omega.roles = ["omega", ["m", "r"]]; omega.law = "square";
omega.runs[0].a = ["4", "square", "coefficient"];
assert.equal(S.page(s, 2).score, 30);
s.sync = "same-omega"; s.massParts = "cap-screw-weights";
assert.equal(S.score(s).detail.syncScore + S.score(s).detail.massPartsScore, 10);
console.log("centripetal scoring ok");

const inquiry=M.fresh(99);inquiry.rv=6;inquiry.tasks[0].inquiry=["equal-mass",null];
assert.equal(S.page(inquiry,0).roleScore,3);
inquiry.tasks[0].inquiry=["equal-radius","ratio-steady"];
assert.equal(S.page(inquiry,0).roleScore,3);
inquiry.tasks[1].inquiry=["equal-radius","ratio-steady"];
assert.equal(S.page(inquiry,1).roleScore,6);


// Storage capacity is not a scoring target.
for (const kind of M.KINDS) {
  const run=M.freshRun(M.CFG);
  run.q=[500,1000,1500];
  assert.deepEqual(S.coverage(kind,run),{slots:3,span:1,dataScore:4});
  run.q=Array.from({length:48},(_,i)=>250+i*120);
  assert.equal(S.coverage(kind,run).dataScore,4,"48 points earn no more data credit than three well-spaced points");
  run.q=Array.from({length:48},(_,i)=>1000+i);
  assert.equal(S.coverage(kind,run).dataScore,0,"many tightly clustered points do not meet the coverage requirement");
  run.q=[500,750,999];assert.equal(S.coverage(kind,run).dataScore,0);
  run.q=[500,750,1000];assert.equal(S.coverage(kind,run).dataScore,2);
  run.q=[500,1000,1499];assert.equal(S.coverage(kind,run).dataScore,2);
  run.q=[-1000,-500,500];
  assert.equal(S.coverage(kind,run).dataScore,kind==="omega"?4:2,"radius/mass count magnitude; omega retains sign");
}

const equalRadius=M.fresh(21), equalTask=equalRadius.tasks[0]; equalRadius.rv=3;
equalTask.inquiry=["equal-mass","ratio-steady"];equalTask.law="linear";
M.begin(equalTask);for(const w of [.5,1.5,3])M.record(equalTask,w);
M.fitCurrent("radius",equalTask);equalTask.runs[0].a=["1","supports","coefficient"];
assert.equal(S.page(equalRadius,0).score,30,"equal radii are a valid 1:1 comparison under rv3");
assert.equal(S.page(equalRadius,0).ratio,1);
equalRadius.rv=2;equalTask.runs[0].a=["1","no-contrast","uncertain"];
assert.equal(S.page(equalRadius,0).score,26,"rv2 retains its historical equal-radius score");
equalRadius.rv=3;equalTask.runs[0].cfg[2]=4;equalTask.runs[0].a=["1","confounded","uncertain"];
assert.equal(S.page(equalRadius,0).fairScore,0,"unequal masses still confound the radius comparison");
assert.equal(S.page(equalRadius,0).fitScore,6,"recognising unequal masses still earns interpretation credit");

// rv4 and rv5 grade both runs equally; missing work receives only its own zero credit.
for(const rv of [4,5,6,7]) for(const [i,configs] of [[[2,2,2,2],[4,2,2,2]],[[2,2,4,2],[2,2,2,4]],[[2,2,2,2],[3,3,3,3]]].entries()) {
 const state=M.fresh(42),t=state.tasks[i],kind=M.KINDS[i];state.rv=rv;
 t.inquiry=i<2?[i===0?"equal-mass":"equal-radius","ratio-steady"]:[null,null];
 t.roles=["omega",["m","r"]];t.law=i===2?"square":"linear";
 assert.equal(S.page(state,i).score,12);
 for(const [j,cfg] of configs.entries()) {
  t.work=cfg.slice();M.begin(t);for(const w of [.5,1.5,3])M.record(t,w);
  M.fitCurrent(kind,t);const r=t.runs[j];
  const value=i===0?M.radius(cfg[0])/M.radius(cfg[1]):i===1?M.mass(cfg[2])/M.mass(cfg[3]):4;
  r.a=[value.toFixed(3),i===2?"square":"supports","coefficient"];
  assert.equal(S.page(state,i).score,j===0?21:30);
 }
 for(const selected of [null,0,1]) {t.selected=selected;assert.equal(S.page(state,i).score,30,"no selected run controls rv4 credit");}
 t.runs[1].a[0]=null;assert.equal(S.page(state,i).score,28,"the other run retains its earned credit");
 t.runs[1].a=[null,null,null];t.runs[1].fit=false;
 assert.equal(S.page(state,i).score,25,"an unfinished second run keeps configuration and data credit");
 t.runs[1].q=[];assert.equal(S.page(state,i).score,21);
 state.rv=3;t.selected=0;assert.equal(S.page(state,i).score,30,"old single-run rubric is preserved");
 t.selected=1;assert.equal(S.page(state,i).score,12);
}

// Interpret the actual fitted coefficient independently of configuration/coverage credit.
for (const page of [0, 1]) for (const radiiEqual of [true, false]) for (const massesEqual of [true, false]) {
  const state=M.fresh(501), task=state.tasks[page], kind=M.KINDS[page];state.rv=5;
  task.work=[radiiEqual?2:4,2,massesEqual?2:4,2];
  M.begin(task);for(const w of [1,2,3])M.record(task,w);
  assert.ok(M.fitCurrent(kind,task).ok);
  const run=task.runs[0], matches=page===0?massesEqual:radiiEqual;
  const radiusRatio=M.radius(run.cfg[0])/M.radius(run.cfg[1]);
  const massRatio=M.mass(run.cfg[2])/M.mass(run.cfg[3]);
  assert.ok(Math.abs(M.fit(kind,run).coefficients[0]-radiusRatio*massRatio)<1e-10);
  run.a=[null,matches?"supports":"confounded",matches?"coefficient":"uncertain"];
  assert.equal(S.page(state,page).runs[0].fitScore,6,`rv5 page ${page}: radiiEqual=${radiiEqual}, massesEqual=${massesEqual}`);
  run.a[1]="no-contrast";
  assert.equal(S.page(state,page).runs[0].fitScore,3,"equal target quantities alone never invalidate the ratio equation");
  run.fit=false;
  assert.equal(S.page(state,page).runs[0].fitScore,0,"analysis credit still requires a successful fit");
}
for(const page of [0,1]) {
  const state=M.fresh(502),t=state.tasks[page];state.rv=5;M.begin(t);
  const r=t.runs[0];r.q=[1000,1100,1200];r.fit=true;r.a=["1","supports","coefficient"];
  assert.ok(M.fit(M.KINDS[page],r).ok);
  assert.equal(S.page(state,page).runs[0].dataScore,0);
  assert.equal(S.page(state,page).runs[0].fairScore,0);
  assert.equal(S.page(state,page).runs[0].fitScore,6,"a narrow speed range does not change k's physical meaning");
}
const massLegacy=M.fresh(504);massLegacy.rv=4;M.begin(massLegacy.tasks[1]);
const mr=massLegacy.tasks[1].runs[0];mr.q=[1000,2000,3000];mr.fit=true;mr.a=["1","no-contrast","uncertain"];
assert.equal(S.page(massLegacy,1).runs[0].fitScore,6);
massLegacy.rv=5;assert.equal(S.page(massLegacy,1).runs[0].fitScore,0);
mr.a=["1","supports","coefficient"];assert.equal(S.page(massLegacy,1).runs[0].fitScore,6);
console.log("centripetal rv5 question/scoring consistency ok");

for(const page of [0,1,2]) {
 const state=M.fresh(606),task=state.tasks[page];M.begin(task);
 for(const w of [1,2,3])M.record(task,w);M.fitCurrent(M.KINDS[page],task);
 const r=task.runs[0];r.a=[null,page===2?"square":"supports",null];
 for(const obsolete of [null,...M.REASONS]) {r.a[2]=obsolete;assert.equal(S.page(state,page).runs[0].fitScore,6,"rv6 ignores removed coefficient answer");}
 r.a[1]=null;assert.equal(S.page(state,page).runs[0].fitScore,0);
 r.a[1]=page===2?"square":"supports";r.fit=false;assert.equal(S.page(state,page).runs[0].fitScore,0);
}


// Feedback must explain the authoritative marks, including historical attempts.
function feedbackTotal(state) {
 const report=S.feedback(state);let sum=0;
 for(const page of report.pages) {
  let pageSum=page.items.reduce((n,item)=>n+item.earned,0);
  for(const run of page.runs) {
   assert.equal(run.items.reduce((n,item)=>n+item.earned,0),run.earned);
   assert.equal(run.items.reduce((n,item)=>n+item.max,0),run.max);
   pageSum+=run.earned;
  }
  assert.equal(pageSum,page.earned);sum+=pageSum;
 }
 sum+=report.synthesis.reduce((n,item)=>n+item.earned,0);
 assert.equal(sum,S.score(state).score);assert.equal(report.score,sum);
 return report;
}
const marked=M.fresh(628),mt=marked.tasks[0];marked.rv=6;
mt.inquiry=["equal-mass","ratio-steady"];mt.law="inverse";
for(const cfg of [[2,2,2,2],[4,2,2,2]]) {
 mt.work=cfg;assert.equal(M.begin(mt),true);
 for(const w of [1,2,3])M.record(mt,w);M.fitCurrent("radius",mt);
 mt.runs[mt.current].a=[String(M.radius(cfg[0])/M.radius(cfg[1])),"supports",null];
}
marked.sync="same-omega";marked.massParts="cap-screw-weights";
let report=feedbackTotal(marked);
assert.equal(report.score,34);assert.deepEqual(report.pages.map(p=>p.earned),[24,0,0]);
assert.deepEqual(report.pages[0].runs.map(r=>r.earned),[9,9]);
assert.deepEqual(report.pages[0].items.filter(x=>x.earned<x.max).map(x=>x.id),["law"]);
assert.equal(report.pages[0].items[2].answer,"前者等於後者的倒數");
assert.equal(report.pages[0].items[2].expected,"兩個比值相等");
assert.equal(report.pages[0].items[2].status,"需修正");
assert.match(report.pages[0].items[2].explanation,/\\\(F_A\/F_B=r_A\/r_B\\\)/);
assert.equal(report.pages[1].untouched,true);
assert.equal(report.pages[0].runs[0].items.some(x=>x.id==="coefficient"),false);
mt.law=null;assert.equal(feedbackTotal(marked).pages[0].items[2].status,"未作答");
mt.law="linear";mt.inquiry=["equal-force","forces-steady"];
report=feedbackTotal(marked);assert.equal(report.score,34);
assert.deepEqual(report.pages[0].items.filter(x=>x.earned<x.max).map(x=>x.id),["setup","prediction"]);
mt.runs[0].q=[500,1000];mt.runs[0].fit=false;
report=feedbackTotal(marked);
assert.equal(report.pages[0].runs[0].items[1].earned,1);
assert.equal(report.pages[0].runs[0].items[1].status,"部分得分");
assert.equal(report.pages[0].runs[0].items[3].status,"未完成擬合");
assert.match(report.pages[0].runs[0].items[3].explanation,/尚未進行擬合/);
marked.tasks[2].roles=["omega",["m"]];
assert.equal(feedbackTotal(marked).pages[2].items[1].status,"部分得分");
for(const rv of [1,2,3,4,5,6,7]) {
 const version=M.clone(marked);version.rv=rv;
 feedbackTotal(version);const empty=M.fresh(629);empty.rv=rv;
 assert.equal(feedbackTotal(empty).score,0);
 for(let i=0;i<3;i++) {
  const t=version.tasks[i];t.runs=[];t.current=null;t.selected=null;
  t.roles=[["r","m","omega"][i],[["m","omega"],["r","omega"],["m","r"]][i]];
  t.inquiry=[i===0?"equal-mass":"equal-radius","ratio-steady"];t.law=i===2?"square":"linear";
  for(let j=0;j<2;j++) {
   t.work=i===0?[4+j,2,2,2]:i===1?[2,2,4+j,2]:[2+j,2,2,2];
   assert.ok(M.begin(t));for(const w of [1,2,3])M.record(t,w);M.fitCurrent(M.KINDS[i],t);
   const run=t.runs[j];run.a=[String(i===0?M.radius(run.cfg[0])/M.radius(run.cfg[1]):i===1?M.mass(run.cfg[2])/M.mass(run.cfg[3]):4),i===2?"square":"supports","coefficient"];
  }
 }
 assert.equal(feedbackTotal(version).score,100);
 if(rv<6)assert.ok(S.feedback(version).pages[0].runs[0].items.some(x=>x.id==="coefficient"));
}
console.log("centripetal item feedback totals and 34-point diagnoses ok");

for (const prediction of [null, ...M.SPEED_RELATIONS]) {
 const state=M.fresh(707);
 for (const [i,t] of state.tasks.entries()) {
  if(i<2) {
   t.inquiry=[null,prediction];assert.equal(S.page(state,i).score,0,"prediction alone never earns marks");
   t.inquiry[0]=i===0?"equal-mass":"equal-radius";
  } else t.roles=["omega",["m","r"]];
  t.law=i===2?"square":"linear";
  assert.equal(S.page(state,i).score,12,"same concept credit regardless of prediction");
  for(let j=0;j<2;j++) {
   t.work=i===0?[4+j,2,2,2]:i===1?[2,2,4+j,2]:[2+j,2+j,2,2];
   assert.ok(M.begin(t));for(const w of [1,2,3])M.record(t,w);M.fitCurrent(M.KINDS[i],t);
   const run=t.runs[j];run.a=[String(Number((i===0?M.radius(run.cfg[0])/M.radius(run.cfg[1]):i===1?M.mass(run.cfg[2])/M.mass(run.cfg[3]):4).toFixed(4))),i===2?"square":"supports",null];
   assert.equal(S.page(state,i).score,21+9*j,"partial and complete measurement credit survives every prediction");
  }
 }
 state.sync="same-omega";state.massParts="cap-screw-weights";
 const report=feedbackTotal(state);assert.equal(report.score,100);
 for(const page of report.pages.slice(0,2)) {
  const guess=page.items.find(x=>x.id==="prediction");
  assert.deepEqual([guess.earned,guess.max,guess.status],[0,0,"不計分"]);
  assert.equal(page.items.find(x=>x.id==="law").max,9);
 }
}
console.log("centripetal rv7 predictions ungraded at every completion level; total remains 100");
