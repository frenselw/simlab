"use strict";
const assert=require("node:assert/strict"), M=require("./model.js"), P=require("./persistence.js"), S=require("./scoring.js");
const {environment,record,filled,durableDraft,finishedData}=require("./test-support.js");
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
for(const mutation of [s=>s.answer.plots[0].points[0]=[null,0],s=>s.score=99,s=>s.answer.groups[0].roles[0]="mass"]) {
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
const reentered=environment({durable:leaving.durable});assert.deepEqual(reentered.c.state.setups[0].candidate,[2,2,600]);assert.ok(reentered.c.command({type:"record"}));reentered.c.check();reentered.c.submit();reentered.events.pagehide({persisted:false});assert.equal(reentered.durable["cmi.core.exit"],"logout");
assert.equal(environment({durable:leaving.durable}).c.mode,"review");assert.deepEqual(environment({durable:{}}).c.state,M.fresh());
for(const phase of ["collect","plot","conclude","check"]) {
  const t=environment({durable:durableDraft(filled())});t.c.navigate(phase,phase==="collect"?1:phase==="plot"?2:null);assert.ok(t.c.clearAllAnswers());assert.deepEqual(t.c.state,M.fresh());assert.deepEqual(environment({durable:t.durable}).c.state,M.fresh());
}
const invalid=durableDraft(M.fresh()),raw=JSON.parse(invalid["cmi.suspend_data"]);raw.answer.group=9;invalid["cmi.suspend_data"]=JSON.stringify(raw);
const recover=environment({durable:invalid});assert.equal(recover.c.canRecover,true);assert.equal(recover.c.recoverDraft(),true);assert.deepEqual(recover.c.state,M.fresh());
for(const checkpoint of [durableDraft(filled()),finishedData(filled()),pending.durable,"corrupt"]) {
  const storage=new Map([[`simlab:${P.ACTIVITY}:checkpoint`,JSON.stringify(checkpoint)]]);
  const t=environment({standalone:true,storage,flags:{storageReadFail:true,storageWriteFail:true,storageRemoveFail:true}});
  assert.deepEqual(t.c.state,M.fresh());t.c.command({type:"measure"});t.c.command({type:"record"});
  assert.deepEqual(environment({standalone:true,storage}).c.state,M.fresh());
  t.c.check();assert.deepEqual(environment({standalone:true,storage}).c.state,M.fresh());t.c.submit();assert.equal(t.c.mode,"review");assert.equal(t.c.clearAllAnswers(),false);
  assert.deepEqual(environment({standalone:true,storage}).c.state,M.fresh());assert.equal(t.stats.storageReads+t.stats.storageWrites+t.stats.storageRemoves,0);
}
// Even equal numeric totals cannot substitute different frozen authoritative answers.
const altered=environment();altered.c.check();altered.c.finalSnapshot=altered.scorm.makeSnapshot(P.ACTIVITY,"review",P.review(altered.c.state),S.score(altered.c.state));
const other=M.clone(altered.c.finalSnapshot);other.answer.groups[0].roles[0]="mass";
altered.c.handleOutcome({activityState:"success",review:other,score:0,status:"failed"});assert.equal(altered.c.mode,"technical");
console.log("newton lifecycle: shared four outcomes, retry, trust/quarantine, failed saves, same/new attempt and standalone refresh passed");
