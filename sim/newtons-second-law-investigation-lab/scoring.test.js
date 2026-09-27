"use strict";
const assert=require("node:assert/strict"), M=require("./model.js"), S=require("./scoring.js"), {filled}=require("./test-support.js");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ~ ${b}`);
assert.equal(S.score(M.fresh()).score,0); const full=filled();assert.equal(S.score(full).score,100);
const designs=S.score(full).detail.experiments;assert.deepEqual(designs.map(v=>v.score),[15,15]);
let s=M.clone(full); s.groups[0].roles=[null,null,null];close(S.score(s).score,97);
s=M.clone(full);s.plots.forEach(p=>p.points=p.points.map(()=>null));close(S.score(s).score,64,"model selections retain their own credit");
s=M.clone(full); s.plots[1].model="linear";close(S.score(s).score,97,"wrong mathematical model still receives successful-fit credit");
s=M.clone(full);s.plots[0].model="quadratic";close(S.score(s).score,99,"degenerate quadratic receives partial model credit");
s=M.clone(full);s.plots[0].model="quadratic";s.plots[0].points=s.plots[0].points.map((_,i)=>[i*2000,2000+i*i*300]);close(S.graphScore(s,0).modelScore,0);
s=M.clone(full);s.plots[0].points[0]=[0,0];s.plots[0].model="inverse";assert.equal(S.graphScore(s,0).fitScore,0);assert.ok(S.score(s).score>75);
for(let graph=0;graph<3;graph++) for(let axis=0;axis<2;axis++) {
  s=M.clone(full);const result=S.graphScore(s,graph),delta=Math.floor(result.tolerance[axis]*10000+1e-8);
  s.plots[graph].points[0][axis]+=delta; assert.equal(S.graphScore(s,graph).points[0].correct[axis],true);
  s.plots[graph].points[0][axis]++; assert.equal(S.graphScore(s,graph).points[0].correct[axis],false);
}
const emptyRoles=[null,null,null];
close(S.experiment({roles:emptyRoles,records:[M.measure(2,0)]},0).score,0);
close(S.experiment({roles:emptyRoles,records:Array(6).fill(M.measure(2,0))},0).score,6,"repeat levels establish a constant condition but no sampling span");
const records=[M.measure(1,0),M.measure(1,1),M.measure(2,0),M.measure(2,5)];
const chosen=S.experiment({roles:emptyRoles,records},0);assert.equal(chosen.best.key,2);close(chosen.control,2);
for(const rs of [records,records.slice().reverse(),[records[2],records[0],records[3],records[1]]]) { const r=S.experiment({roles:emptyRoles,records:rs},0);assert.equal(r.best.key,2);close(r.score,chosen.score); }
const tie=S.experiment({roles:emptyRoles,records:[M.measure(4,0),M.measure(4,5),M.measure(2,0),M.measure(2,5)]},0);assert.equal(tie.best.key,2);
s=M.clone(full);s.groups[0].records[0]=M.measure(5,0);const r=S.score(s);assert.ok(r.detail.experiments[0].control<6);assert.equal(r.detail.graphs[1].pointScore,10);assert.equal(r.detail.graphs[2].pointScore,10);
s=M.fresh();s.conclusions[0]="direct";assert.equal(S.score(s).score,5);
console.log("newton scoring: blank/full, independent partial credit, tolerance boundaries, control subsets and model degeneracy passed");
