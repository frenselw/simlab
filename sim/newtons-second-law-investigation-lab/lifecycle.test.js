"use strict";
const assert=require("node:assert/strict"), M=require("./model.js"), P=require("./persistence.js"), S=require("./scoring.js");
const {environment,record,filled,durableDraft,finishedData,legacy,assertFresh}=require("./test-support.js");
for(const state of [M.fresh(),M.change(M.fresh(),{type:"measure"}),record(M.fresh(),0,2,3),filled()]) {
  for(const failure of [null,"writeFail","commitFail","finishFail"]) {
    const e=environment({durable:durableDraft(state)});e.c.check();const expected=S.score(state),answer=P.review(state);
    if(failure)e.flags[failure]=failure==="writeFail"?"cmi.core.score.raw":true;
    e.c.submit();assert.equal(e.c.mode,failure==="finishFail"?"committed":failure?"frozen":"review");
    assert.equal(e.c.clearAllAnswers(),false);assert.equal(e.c.command({type:"measure"}),false);
    if(e.c.mode==="frozen"){assert.equal(e.c.result,null);assert.equal(e.c.trusted,false);}
    if(failure) {e.flags[failure]=false;e.c.retryFinal();assert.equal(e.c.mode,"review");}
    assert.equal(e.c.result.score,expected.score);assert.deepEqual(e.c.state,answer);
    const resumed=environment({durable:e.durable});assert.equal(resumed.c.mode,"review");assert.deepEqual(resumed.c.state,answer);
  }
}
const pending=environment({durable:durableDraft(filled())});pending.c.check();pending.flags.writeFail="cmi.core.score.raw";pending.c.submit();
const checkpoint=M.clone(pending.durable),resumed=environment({durable:M.clone(checkpoint)});assert.equal(resumed.c.mode,"frozen");resumed.c.navigate("plot",2);resumed.c.retryFinal();assert.equal(resumed.c.result.score,100);
for(const mutation of [s=>s.answer.plots[0].points[0]=[null,0],s=>s.score=99,s=>s.answer.groups[0].roles[0]="mass",s=>s.answer.plots[0].meaning="velocity"]) {
  const data=M.clone(checkpoint),outer=JSON.parse(data["cmi.suspend_data"]),inner=JSON.parse(outer.payload.reviewJson);mutation(inner);outer.payload.reviewJson=JSON.stringify(inner);data["cmi.suspend_data"]=JSON.stringify(outer);
  const e=environment({durable:data});assert.equal(e.c.mode,"technical");assert.equal(e.stats.writes,0);assert.equal(e.scorm.retryPending().reason,"no-pending");e.events.pagehide({persisted:false});assert.equal(e.stats.writes,0);
}
for(const mutate of [d=>d["cmi.core.score.raw"]="19",d=>d["cmi.core.lesson_status"]="completed",d=>d["cmi.suspend_data"]="corrupt",d=>d["cmi.suspend_data"]=durableDraft(filled())["cmi.suspend_data"]]) {
  const data=finishedData(filled());mutate(data);const e=environment({durable:data});assert.equal(e.c.mode,"mismatch");assert.equal(e.c.editable,false);assert.equal(e.c.clearAllAnswers(),false);assert.equal(e.stats.writes,0);
}
const denied=environment({flags:{readFail:"cmi.suspend_data"}});assert.equal(denied.c.mode,"technical");assert.equal(denied.c.canRecover,false);assert.equal(denied.stats.writes,0);
const e=environment();e.flags.commitFail=true;e.c.command({type:"measure"});assert.equal(e.c.unsaved,true);e.c.check();e.c.submit();assert.equal(e.c.mode,"check");e.flags.commitFail=false;e.c.retrySave();e.c.submit();assert.equal(e.c.mode,"review");
for(const retryable of [true,false]) {const t=environment();t.c.check();t.c.handleOutcome({activityState:"retry",retryable});assert.equal(t.c.mode,retryable?"check":"technical");}
const leaving=environment();leaving.c.command({type:"measure"});leaving.events.pagehide({persisted:false});assert.equal(leaving.durable["cmi.core.exit"],"suspend");
const reentered=environment({durable:leaving.durable});assert.deepEqual(reentered.c.state.setups[0].candidate,leaving.c.state.setups[0].candidate);assert.ok(reentered.c.command({type:"record"}));reentered.c.check();reentered.c.submit();reentered.events.pagehide({persisted:false});assert.equal(reentered.durable["cmi.core.exit"],"logout");
assert.equal(environment({durable:leaving.durable}).c.mode,"review");assertFresh(environment({durable:{}}).c.state);
for(const phase of ["collect","plot","conclude","check"]) {
  const t=environment({durable:durableDraft(filled())});t.c.navigate(phase,phase==="collect"?1:phase==="plot"?2:null);assert.ok(t.c.clearAllAnswers());assertFresh(t.c.state);assert.deepEqual(environment({durable:t.durable}).c.state,t.c.state);
}
const invalid=durableDraft(M.fresh()),raw=JSON.parse(invalid["cmi.suspend_data"]);raw.answer.group=9;invalid["cmi.suspend_data"]=JSON.stringify(raw);
const recover=environment({durable:invalid});assert.equal(recover.c.canRecover,true);assert.equal(recover.c.recoverDraft(),true);assertFresh(recover.c.state);
for(const checkpoint of [durableDraft(filled()),finishedData(filled()),pending.durable,"corrupt"]) {
  const storage=new Map([[`simlab:${P.ACTIVITY}:checkpoint`,JSON.stringify(checkpoint)]]);
  const t=environment({standalone:true,storage,flags:{storageReadFail:true,storageWriteFail:true,storageRemoveFail:true}});
  assertFresh(t.c.state);t.c.command({type:"measure"});t.c.command({type:"record"});
  assertFresh(environment({standalone:true,storage}).c.state);
  t.c.check();assertFresh(environment({standalone:true,storage}).c.state);t.c.submit();assert.equal(t.c.mode,"review");assert.equal(t.c.clearAllAnswers(),false);
  assertFresh(environment({standalone:true,storage}).c.state);assert.equal(t.stats.storageReads+t.stats.storageWrites+t.stats.storageRemoves,0);
}
// Even equal numeric totals cannot substitute different frozen authoritative answers.
const altered=environment();altered.c.check();altered.c.finalSnapshot=altered.scorm.makeSnapshot(P.ACTIVITY,"review",P.review(altered.c.state),S.score(altered.c.state));
const other=M.clone(altered.c.finalSnapshot);other.answer.groups[0].roles[0]="mass";
altered.c.handleOutcome({activityState:"success",review:other,score:0,status:"failed"});assert.equal(altered.c.mode,"technical");
// Old attempts retain their original rubric, including partial credit and pending results.
const old=legacy(M.fresh());old.conclusions[0]="direct";assert.equal(S.score(old).score,5);
const upgraded=environment({durable:durableDraft(old)});assert.equal(upgraded.c.state.schemaVersion,3);assert.equal(upgraded.c.state.rubricVersion,1);
assert.deepEqual(upgraded.c.state.plots.map(p=>p.meaning),[null,null,null]);assert.equal(S.score(upgraded.c.state).score,5);
upgraded.c.navigate("plot",0);assert.ok(upgraded.c.command({type:"meaning",value:"inverse-mass"}));assert.equal(S.score(upgraded.c.state).score,5);
const upgradeResume=environment({durable:upgraded.durable});assert.equal(upgradeResume.c.state.plots[0].meaning,"inverse-mass");
upgradeResume.c.check();upgradeResume.c.submit();assert.equal(upgradeResume.c.result.score,5);assert.equal(upgradeResume.c.state.schemaVersion,3);
upgraded.c.clearAllAnswers();assert.equal(upgraded.c.state.rubricVersion,1);assert.equal(S.score(upgraded.c.state).score,0);
const oldReview=environment({durable:finishedData(old)});assert.equal(oldReview.c.mode,"review");assert.equal(oldReview.c.result.score,5);assert.deepEqual(oldReview.c.state,P.review(old));assert.equal(oldReview.c.command({type:"meaning",graph:0,value:"inverse-mass"}),false);
const oldPending=environment();oldPending.flags.writeFail="cmi.core.score.raw";
oldPending.scorm.submitWithCallbacks(S.score(old),oldPending.scorm.makeSnapshot(P.ACTIVITY,"review",P.review(old),S.score(old)),{onSuccess(){},onFailure(){}});
const oldRetry=environment({durable:oldPending.durable});assert.equal(oldRetry.c.mode,"frozen");assert.equal(oldRetry.c.state.schemaVersion,1);oldRetry.c.retryFinal();assert.equal(oldRetry.c.mode,"review");assert.equal(oldRetry.c.result.score,5);assert.equal(oldRetry.c.state.schemaVersion,1);
const badUpgrade=durableDraft(old),badRaw=JSON.parse(badUpgrade["cmi.suspend_data"]);badRaw.answer.plots[0].points.push([1000,1000]);badUpgrade["cmi.suspend_data"]=JSON.stringify(badRaw);
assert.equal(environment({durable:badUpgrade}).c.mode,"technical","validate legacy state before migrating it");
for(const [version,rubric] of [[1,1],[2,1],[2,2]]) {
  let base=record(M.fresh(),0,2,2);base=M.change(base,{type:"measure"});base.conclusions[0]="direct";base.plots[0].meaning="inverse-mass";
  base=P.navigate(base,"plot",0);base.returnToCheck=true;
  for(let mask=0;mask<16;mask++) {
    const old=legacy(base,version);old.rubricVersion=rubric;
    old.setups.forEach((setup,i)=>{setup.locks=[Boolean(mask&(1<<(2*i))),Boolean(mask&(1<<(2*i+1)))];});
    const e=environment({durable:durableDraft(old)}),expected=P.upgradeDraft(old);
    assert.deepEqual(e.c.state,expected);assert.equal(S.score(e.c.state).score,S.score(old).score);
    assert.deepEqual(environment({durable:e.durable}).c.state,expected,"migration is saved without rerandomizing");
    e.c.navigate("collect",1);assert.ok(e.c.command({type:"setting",index:0,value:2}));assert.ok(e.c.command({type:"setting",index:1,value:3}));
    e.c.navigate("collect",0);assert.deepEqual(e.c.state.setups[0].candidate,base.setups[0].candidate);assert.ok(e.c.command({type:"record"}));
    e.c.check();e.c.submit();assert.equal(e.c.mode,"review");
  }
  const old=legacy(base,version);old.rubricVersion=rubric;
  const redraft=P.editableFromReview(P.review(old));assert.equal(redraft.schemaVersion,3);assert.equal(redraft.rubricVersion,rubric);assert.equal(S.score(redraft).score,S.score(old).score);
  const review=environment({durable:finishedData(old)});assert.deepEqual(review.c.state,P.review(old));assert.equal(review.c.result.score,S.score(old).score);
  const failed=environment();failed.flags.writeFail="cmi.core.score.raw";
  failed.scorm.submitWithCallbacks(S.score(old),failed.scorm.makeSnapshot(P.ACTIVITY,"review",P.review(old),S.score(old)),{onSuccess(){},onFailure(){}});
  const retry=environment({durable:failed.durable});assert.equal(retry.c.mode,"frozen");assert.deepEqual(retry.c.state,P.review(old));
  retry.c.retryFinal();assert.equal(retry.c.mode,"review");assert.deepEqual(retry.c.state,P.review(old));assert.equal(retry.c.result.score,S.score(old).score);
  const bad=legacy(base,version);bad.setups[0].locks=[true,0];assert.throws(()=>P.upgradeDraft(bad));
}
console.log("newton lifecycle: shared outcomes, 48 legacy lock migrations, versioned review/pending, quarantine and fresh/resumed attempts passed");
