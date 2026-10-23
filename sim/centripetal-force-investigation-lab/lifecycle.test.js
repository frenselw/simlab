"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), P = require("./persistence.js"), S = require("./scoring.js"), { environment } = require("./test-support.js");
for (const mode of ["success", "committed", "frozen", "retry"]) {
  const e = environment({ submitMode: mode }); e.c.check(); e.c.submit();
  assert.equal(e.c.mode, { success: "review", committed: "committed", frozen: "frozen", retry: "editable" }[mode]);
  if (mode === "frozen") { assert.equal(e.c.result, null); e.c.retryFinal(); assert.equal(e.c.mode, "review"); }
  if (mode === "committed") { e.c.retryFinal(); assert.equal(e.c.mode, "review"); }
  if (mode === "retry") assert.equal(e.c.state.view, "check");
  else { assert.equal(e.c.result.score, 0); assert.equal(e.c.update(s => s.sync = "same-omega"), false); }
}
const denied = environment({ submitMode: "retry", retryable: false }); denied.c.check(); denied.c.submit(); assert.equal(denied.c.mode, "technical");
const badSave = environment({ saveFail: true }); badSave.c.check(); assert.equal(badSave.c.submit(), false); assert.equal(badSave.c.mode, "editable");
const draft = environment(); draft.c.update(s => { s.tasks[0].work[0] = 4; });
assert.equal(environment({ durable: draft.durable }).c.state.tasks[0].work[0], 4, "Moodle draft resumes");
const done = environment(); done.c.check(); done.c.submit(); assert.equal(environment({ durable: done.durable }).c.mode, "review");
for (const mutate of [d => d.score = "99", d => d.status = "completed", d => d.snapshot.answer.sync = "same-omega"] ) {
  const wrong = M.clone(done.durable); mutate(wrong); const resumed = environment({ durable: wrong });
  assert.equal(resumed.c.mode, "mismatch"); assert.equal(resumed.c.editable, false);
}
const review = P.review(M.fresh(1)), result = S.score(review), inner = { version: 1, activity: P.ACTIVITY, kind: "review", answer: P.encode(review), score: result.score, passed: result.passed };
const pending = { state: "pending-final", snapshot: { version: 1, activity: P.ACTIVITY, kind: "pending-final", payload: { reviewJson: JSON.stringify(inner), score: result.score, maxScore: 100, passed: result.passed } } };
const resumedPending = environment({ durable: M.clone(pending) }); assert.equal(resumedPending.c.mode, "frozen"); resumedPending.c.retryFinal(); assert.equal(resumedPending.c.mode, "review");
const damaged = M.clone(pending); damaged.snapshot.payload.reviewJson = JSON.stringify({ ...inner, answer: { ...review, sync: "invalid" } });
const quarantined = environment({ durable: damaged }); assert.equal(quarantined.c.mode, "technical"); assert.equal(quarantined.events.quarantined, 1);
const invalidDraft = M.clone(draft.durable); invalidDraft.snapshot.answer.tasks[0].work[0] = -1;
assert.equal(environment({ durable: invalidDraft }).c.mode, "technical");
assert.equal(environment().c.state.tasks[0].work[0], 2, "standalone new launch starts fresh");
const legacy = M.fresh(12); legacy.mv = 1; legacy.rv = 1; legacy.tasks.forEach(t => delete t.inquiry);
for (const [i,t] of legacy.tasks.entries()) {
  t.work = [[4,2,2,2],[2,2,4,2],[2,2,2,2]][i];
  t.roles = [["r",["m","omega"]],["m",["r","omega"]],["omega",["m","r"]]][i];
  t.law = i === 2 ? "square" : "linear";
  M.begin(t); for (const w of [.5,1.5,3]) M.record(t,w);
  M.fitCurrent(M.KINDS[i],t); t.runs[0].a = [i === 2 ? "4" : "1.5", i === 2 ? "square" : "supports", "coefficient"];
}
legacy.sync = "same-omega"; legacy.massParts = "cap-screw-weights";
const oldAnswer = P.review(legacy), oldSnapshot = {version:1,activity:P.ACTIVITY,kind:"review",answer:oldAnswer,score:100,passed:true};
assert.equal(S.score(oldAnswer).score,100,"old positive measurements keep their recorded score");
const oldReview = environment({durable:{state:"finished",snapshot:oldSnapshot,score:"100",status:"passed"}}).c;
assert.equal(oldReview.mode,"review"); assert.deepEqual(oldReview.state,oldAnswer);
assert.equal(oldReview.update(s=>s.mv=2),false);
const oldPending = environment({durable:{state:"pending-final",snapshot:{version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(oldSnapshot),score:100,maxScore:100,passed:true}}}}).c;
assert.equal(oldPending.mode,"frozen"); assert.equal(oldPending.update(s=>s.mv=2),false);
oldPending.retryFinal(); assert.equal(oldPending.mode,"review");
assert.equal(oldPending.result.score,100); assert.deepEqual(oldPending.state,oldAnswer,"pending retry preserves the original version and answers");
legacy.page=2; legacy.view="collect";
const oldDraft = environment({durable:{state:"draft",snapshot:{version:1,activity:P.ACTIVITY,kind:"draft",answer:legacy}}}).c;
assert.equal(oldDraft.state.mv,5); assert.equal(oldDraft.state.rv,6); assert.deepEqual(oldDraft.state.tasks[0].inquiry,[null,null]); assert.deepEqual(oldDraft.state.tasks[0].roles,legacy.tasks[0].roles); assert.ok(oldDraft.update(s=>M.record(s.tasks[2],-1)));
assert.equal(oldDraft.state.mv,5); assert.deepEqual(oldDraft.state.tasks[2].runs[0].q,[-1000,500,1500,3000]);
console.log("centripetal lifecycle ok");

const latestLegacy=M.clone(oldAnswer);latestLegacy.mv=2;
latestLegacy.tasks[2].runs[0].q=[-3000,-1500,500];
const latestSnapshot={...oldSnapshot,answer:latestLegacy};
assert.equal(environment({durable:{state:"finished",snapshot:latestSnapshot,score:"100",status:"passed"}}).c.mode,"review");
const upgraded=M.upgradeDraft(M.clone(legacy));upgraded.mv=2;
for(const [i,t] of upgraded.tasks.entries()){t.work[0]++;t.work[1]++;M.begin(t);for(const w of [.5,1.5,3])M.record(t,w);M.fitCurrent(M.KINDS[i],t);t.runs[1].a=t.runs[0].a.slice();if(i===0)t.runs[1].a[0]=(M.radius(t.work[0])/M.radius(t.work[1])).toFixed(3);}
upgraded.tasks[0].inquiry=["equal-mass","ratio-steady"];upgraded.tasks[1].inquiry=["equal-radius","ratio-steady"];
assert.equal(S.score(upgraded).score,100,"fully answered new rubric still totals 100");

const mv2Draft=M.clone(upgraded);mv2Draft.page=2;mv2Draft.view="collect";
const resumedMv2=environment({durable:{state:"draft",snapshot:{version:1,activity:P.ACTIVITY,kind:"draft",answer:mv2Draft}}}).c;
assert.equal(resumedMv2.state.mv,5);assert.ok(resumedMv2.update(s=>M.record(s.tasks[2],-24)));assert.equal(resumedMv2.state.mv,5);
assert.deepEqual(resumedMv2.state.tasks[2].runs[1].q,[-24000,500,1500,3000],"old draft retains data while accepting faster measurements");
const mv2Review=P.review(upgraded),mv2Result=S.score(mv2Review);
const mv2Snapshot={version:1,activity:P.ACTIVITY,kind:"review",answer:mv2Review,score:mv2Result.score,passed:mv2Result.passed};
const mv2Pending=environment({durable:{state:"pending-final",snapshot:{version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(mv2Snapshot),score:mv2Result.score,maxScore:100,passed:mv2Result.passed}}}}).c;
assert.equal(mv2Pending.mode,"frozen");assert.equal(mv2Pending.update(s=>s.mv=3),false);
mv2Pending.retryFinal();assert.equal(mv2Pending.mode,"review");assert.equal(mv2Pending.result.score,100);assert.deepEqual(mv2Pending.state,mv2Review);

const equalOld=M.fresh(22);equalOld.rv=2;equalOld.mv=3;
const eq=equalOld.tasks[0];eq.inquiry=["equal-mass","ratio-steady"];eq.law="linear";
M.begin(eq);for(const w of [.5,1.5,3])M.record(eq,w);M.fitCurrent("radius",eq);
eq.runs[0].a=["1","no-contrast","uncertain"];equalOld.view="collect";
const equalAnswer=P.review(equalOld),equalSnapshot={version:1,activity:P.ACTIVITY,kind:"review",answer:equalAnswer,score:26,passed:false};
assert.equal(S.score(equalAnswer).score,26);
const equalFinished=environment({durable:{state:"finished",snapshot:equalSnapshot,score:"26",status:"failed"}}).c;
assert.equal(equalFinished.mode,"review");assert.equal(equalFinished.state.rv,2);assert.equal(equalFinished.result.score,26);
const equalPending=environment({durable:{state:"pending-final",snapshot:{version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(equalSnapshot),score:26,maxScore:100,passed:false}}}}).c;
assert.equal(equalPending.mode,"frozen");equalPending.retryFinal();assert.equal(equalPending.mode,"review");
assert.equal(equalPending.result.score,26);assert.equal(equalPending.state.rv,2);
for(const view of ["setup","collect","analyse","check"]) {
 const old=M.clone(equalOld);old.view=view;if(view==="check")old.returnTo=[0,"collect"];
 const env=environment({durable:{state:"draft",snapshot:{version:1,activity:P.ACTIVITY,kind:"draft",answer:old}}});
 assert.equal(env.c.state.rv,6);assert.equal(env.durable.snapshot.answer.rv,6,"upgraded draft is saved");
 assert.deepEqual(env.c.state.tasks,old.tasks,"upgrade preserves learner answers and measurements");
 if(view==="check")env.c.back();
 assert.ok(env.c.update(s=>{s.tasks[0].runs[0].a=["1","supports","coefficient"];}));
 env.c.check();env.c.submit();assert.equal(env.c.result.score,21,"upgraded single-run draft keeps earned partial credit");
}

const max=environment({submitMode:"frozen"});
max.c.update(s=>{for(const [i,t] of s.tasks.entries())for(let n=0;n<2;n++){
 t.work[0]=2+n;M.begin(t);for(let j=0;j<48;j++){M.record(t,24-j*.3,M.KINDS[i]);if(i===2)M.record(t,-24+j*.3,"omega");}
}});
assert.equal(max.c.state.tasks[2].runs[0].q.length,96);
assert.ok(P.bytes(max.durable.snapshot)<=4000);
const maxResume=environment({durable:M.clone(max.durable)});assert.deepEqual(maxResume.c.state,max.c.state);
maxResume.c.navigate(2,"analyse");assert.ok(maxResume.c.update(s=>M.fitCurrent("omega",s.tasks[2])));
max.c.check();max.c.submit();assert.equal(max.c.mode,"frozen");assert.ok(P.bytes(max.durable.snapshot)<=4000);
const maxPending=environment({durable:M.clone(max.durable)});assert.equal(maxPending.c.mode,"frozen");maxPending.c.retryFinal();assert.equal(maxPending.c.mode,"review");
assert.equal(maxPending.c.state.tasks[2].runs[0].q.length,96);assert.equal(maxPending.c.update(s=>M.record(s.tasks[2],1,"omega")),false);
const balanced=environment();balanced.c.update(s=>{M.setWork(s.tasks[2],0,5);M.setWork(s.tasks[2],2,7);});
assert.deepEqual(balanced.c.state.tasks[2].work,[5,5,7,7]);

// rv3 finished/pending stays at its original score; an editable draft upgrades without data loss.
const rv3=M.fresh(93);rv3.rv=3;const r3=rv3.tasks[0];r3.inquiry=["equal-mass","ratio-steady"];r3.law="linear";
M.begin(r3);for(const w of [.5,1.5,3])M.record(r3,w);M.fitCurrent("radius",r3);r3.runs[0].a=["1","supports","coefficient"];
const rv3Answer=P.review(rv3),rv3Snapshot={version:1,activity:P.ACTIVITY,kind:"review",answer:P.encode(rv3Answer),score:30,passed:false};
assert.equal(environment({durable:{state:"finished",snapshot:rv3Snapshot,score:"30",status:"failed"}}).c.result.score,30);
const rv3Pending=environment({durable:{state:"pending-final",snapshot:{version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(rv3Snapshot),score:30,maxScore:100,passed:false}}}}).c;
assert.equal(rv3Pending.mode,"frozen");rv3Pending.retryFinal();assert.equal(rv3Pending.result.score,30);assert.equal(rv3Pending.state.rv,3);
const rv3Draft=environment({durable:{state:"draft",snapshot:{version:1,activity:P.ACTIVITY,kind:"draft",answer:P.encode(rv3)}}});
assert.equal(rv3Draft.c.state.rv,6);assert.deepEqual(rv3Draft.c.state.tasks,rv3.tasks);
assert.equal(S.score(rv3Draft.c.state).score,21);
assert.ok(rv3Draft.c.update(s=>{const t=s.tasks[0];t.work[0]++;t.work[1]++;M.begin(t);for(const w of [.5,1.5,3])M.record(t,w);M.fitCurrent("radius",t);t.runs[1].a=["1","supports","coefficient"];}));
rv3Draft.c.check();rv3Draft.c.submit();assert.equal(rv3Draft.c.result.score,30);
const resumedRv4=environment({durable:M.clone(rv3Draft.durable)}).c;
assert.equal(resumedRv4.mode,"review");assert.equal(resumedRv4.state.tasks[0].runs.length,2);

// Frozen/finished rv4 uses its own questions and scoring; only editable drafts upgrade.
const v4=M.fresh(505);v4.rv=4;v4.page=1;v4.view="analyse";
const v4t=v4.tasks[1];v4t.inquiry=["equal-radius","ratio-steady"];v4t.law="linear";
for(let i=0;i<2;i++) {v4t.runs.push(M.freshRun(v4t.work));v4t.current=i;for(const w of [1,2,3])M.record(v4t,w);M.fitCurrent("mass",v4t);v4t.runs[i].a=["1","no-contrast","uncertain"];}
const v4answer=P.review(v4),v4result=S.score(v4answer);
assert.equal(v4result.score,26);
const v4snap={version:1,activity:P.ACTIVITY,kind:"review",answer:P.encode(v4answer),score:26,passed:false};
const v4finished=environment({durable:{state:"finished",snapshot:v4snap,score:"26",status:"failed"}}).c;
assert.equal(v4finished.mode,"review");assert.equal(v4finished.state.rv,4);assert.equal(v4finished.result.score,26);
const v4pending=environment({durable:{state:"pending-final",snapshot:{version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(v4snap),score:26,maxScore:100,passed:false}}}}).c;
assert.equal(v4pending.mode,"frozen");v4pending.retryFinal();assert.equal(v4pending.state.rv,4);assert.equal(v4pending.result.score,26);
for(const saveFail of [false,true]) {
 const v4draft=environment({saveFail,durable:{state:"draft",snapshot:{version:1,activity:P.ACTIVITY,kind:"draft",answer:P.encode(v4)}}});
 assert.equal(v4draft.c.state.rv,6);assert.deepEqual(v4draft.c.state.tasks,v4.tasks);
 assert.equal(v4draft.c.state.view,"analyse");assert.equal(v4draft.c.state.page,1);
 assert.match(v4draft.c.notice,saveFail?/尚未保存/:/分析題已修訂/);
 if(saveFail)continue;
 for(const index of [0,1])assert.ok(v4draft.c.update(s=>{s.tasks[1].current=index;s.tasks[1].runs[index].a=["1","supports","coefficient"];}));
 v4draft.c.check();v4draft.c.submit();assert.equal(v4draft.c.result.score,26);
 const restored=environment({durable:v4draft.durable}).c;
 assert.equal(restored.mode,"review");assert.equal(restored.state.rv,6);assert.equal(restored.result.score,26);
 assert.ok(restored.state.tasks[1].runs.every(r=>r.a[1]==="supports"&&r.a[2]==="coefficient"));
}
console.log("centripetal rv4 compatibility and rv5 continuation ok");

const v5=M.fresh(607);v5.rv=5;M.begin(v5.tasks[0]);
const v5run=v5.tasks[0].runs[0];v5run.q=[1000,2000,3000];v5run.fit=true;v5run.a=["1","supports",null];
const v5answer=P.review(v5),v5score=S.score(v5answer).score;
assert.equal(v5score,7.5,"old missing coefficient answer retains partial credit");
const v5snap={version:1,activity:P.ACTIVITY,kind:"review",answer:P.encode(v5answer),score:v5score,passed:false};
const v5done=environment({durable:{state:"finished",snapshot:v5snap,score:String(v5score),status:"failed"}}).c;
assert.equal(v5done.state.rv,5);assert.equal(v5done.result.score,v5score);
const v5pending=environment({durable:{state:"pending-final",snapshot:{version:1,activity:P.ACTIVITY,kind:"pending-final",payload:{reviewJson:JSON.stringify(v5snap),score:v5score,maxScore:100,passed:false}}}}).c;
assert.equal(v5pending.mode,"frozen");v5pending.retryFinal();assert.equal(v5pending.state.rv,5);assert.equal(v5pending.result.score,v5score);
const v5draft=environment({durable:{state:"draft",snapshot:{version:1,activity:P.ACTIVITY,kind:"draft",answer:P.encode(v5)}}}).c;
assert.equal(v5draft.state.rv,6);assert.deepEqual(v5draft.state.tasks,v5.tasks);
v5draft.check();v5draft.submit();assert.equal(v5draft.result.score,9,"removed question is not required for full run credit");
