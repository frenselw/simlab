"use strict";
const assert=require("node:assert/strict"),P=require("./persistence.js"),M=require("./model.js"),S=require("./scoring.js");
const {environment,filled,finishedData,durableDraft,drawOne}=require("./test-support.js");
// A v1 boundary answer scores differently under v2: never migrate an in-progress,
// pending or finished attempt to the rounded question set.
const legacy=filled(6,1);legacy.question=3;legacy.answers[3][0][4]=3079;
const legacyScore=S.score(legacy);assert.equal(legacyScore.detail[3].detail[0].magnitude,false);
const newVersion={...M.clone(legacy),generatorVersion:2};assert.equal(S.score(newVersion).detail[3].detail[0].magnitude,true);
for(const content of [legacy,P.check(legacy)]){
 const e=environment({durable:durableDraft(content)});assert.equal(e.c.state.generatorVersion,1);assert.equal(e.c.scenario.questions[3].given[0].force100,2799);e.c.check();e.flags.writeFail="cmi.core.score.raw";e.c.submit();assert.equal(e.c.mode,"frozen");
 const retry=environment({durable:e.durable});assert.equal(retry.c.mode,"frozen");retry.c.retryFinal();assert.equal(retry.c.mode,"review");assert.deepEqual(retry.c.state,P.review(content));assert.equal(retry.c.result.score,legacyScore.score);
 const reopened=environment({durable:retry.durable});assert.equal(reopened.c.mode,"review");assert.equal(reopened.c.result.score,legacyScore.score);assert.equal(reopened.c.state.generatorVersion,1);
}
assert.equal(environment().c.state.generatorVersion,2);
for(const content of ["blank","kind","partial","full"]){
  const e=environment();if(content==="kind")e.c.command({type:"kind",index:0,kind:1});if(content==="partial")drawOne(e.c);if(content==="full")e.c.state=filled();
  e.c.check();const before=P.review(e.c.state),score=S.score(e.c.state);e.c.submit();assert.equal(e.c.mode,"review");assert.equal(e.c.result.score,score.score);assert.equal(e.c.trusted,true);
  assert.equal(e.c.clearAllAnswers(),false);assert.equal(e.c.command({type:"clear"}),false);const saved=JSON.stringify(e.c.state);e.c.navigate(3);assert.equal(JSON.stringify(e.c.state),saved);
  const reopened=environment({durable:e.durable});assert.equal(reopened.c.mode,"review");assert.deepEqual(reopened.c.state,before);
  const frozen=environment({durable:durableDraft({...before,phase:"edit"})});frozen.c.check();frozen.flags.writeFail="cmi.core.score.raw";frozen.c.submit();assert.equal(frozen.c.mode,"frozen");assert.equal(frozen.c.familyIndex,before.question);assert.equal(frozen.c.targetIndex,before.target);assert.equal(frozen.c.clearAllAnswers(),false);assert.equal(frozen.c.result,null);
  const retry=environment({durable:frozen.durable});assert.equal(retry.c.mode,"frozen");retry.c.navigate(2,1);retry.c.retryFinal();assert.equal(retry.c.mode,"review");assert.deepEqual(retry.c.state,before);assert.equal(retry.c.result.score,score.score);
}
for(const [failure,expected] of [["commitFail","frozen"],["finishFail","committed"],["writeFail","frozen"]]){
  const e=environment();drawOne(e.c);e.c.check();const before=P.review(e.c.state);e.flags[failure]=failure==="writeFail"?"cmi.core.score.raw":true;e.c.submit();assert.equal(e.c.mode,expected);assert.equal(e.c.familyIndex,before.question);assert.equal(e.c.targetIndex,before.target);assert.equal(e.c.editable,false);assert.equal(e.c.clearAllAnswers(),false);
  if(expected==="frozen"){assert.equal(e.c.result,null);assert.equal(e.c.trusted,false);}e.flags[failure]=false;e.c.retryFinal();assert.equal(e.c.mode,"review");assert.deepEqual(e.c.state,before);
}
const pending=environment();drawOne(pending.c);pending.c.check();pending.flags.writeFail="cmi.core.score.raw";pending.c.submit();
for(const mutate of [r=>r.answer.answers[0][0]=[0,999,0,0,1],r=>r.score++,r=>r.answer.generatorVersion=999]){
 const durable=M.clone(pending.durable),outer=JSON.parse(durable["cmi.suspend_data"]),inner=JSON.parse(outer.payload.reviewJson);mutate(inner);outer.payload.reviewJson=JSON.stringify(inner);durable["cmi.suspend_data"]=JSON.stringify(outer);
 const e=environment({durable});assert.equal(e.c.mode,"technical");assert.equal(e.stats.writes,0);assert.equal(e.scorm.retryPending().reason,"no-pending");e.events.pagehide({persisted:false});assert.equal(e.stats.writes,0);
}
for(const mutate of [d=>d["cmi.core.score.raw"]="19",d=>d["cmi.core.lesson_status"]="completed",d=>d["cmi.suspend_data"]="broken",d=>{const s=JSON.parse(d["cmi.suspend_data"]);s.answer.answers.pop();d["cmi.suspend_data"]=JSON.stringify(s);}]){
 const d=finishedData(filled());mutate(d);const e=environment({durable:d});assert.equal(e.c.mode,"mismatch");assert.equal(e.c.editable,false);assert.equal(e.c.canRecover,false);assert.equal(e.stats.writes,0);assert.equal(e.c.clearAllAnswers(),false);
}
const readFail=environment({flags:{readFail:"cmi.suspend_data"}});assert.equal(readFail.c.mode,"technical");assert.equal(readFail.stats.writes,0);
for(const phase of ["edit","check","returnToCheck"]){
 const e=environment();for(let q=0;q<5;q++){e.c.navigate(q);drawOne(e.c);}e.c.undo();if(phase!=="edit")e.c.check();if(phase==="returnToCheck")e.c.navigate(2,1);
 const scenario=M.clone(e.c.scenario),commits=e.stats.commits;assert.equal(e.c.clearAllAnswers(),true);assert.deepEqual(e.c.state,P.fresh(21));assert.deepEqual(e.c.scenario,scenario);assert.equal(e.stats.commits,commits+1);assert.ok(e.c.history.undo.concat(e.c.history.redo).every(a=>!a.length));assert.equal(e.c.clearAllAnswers(),false);
 const r=environment({durable:e.durable,seed:999});assert.deepEqual(r.c.state,P.fresh(21));drawOne(r.c);r.c.check();r.c.submit();assert.equal(r.c.mode,"review");
}
const resetFailure=environment();drawOne(resetFailure.c);const old=M.clone(resetFailure.durable);resetFailure.flags.commitFail=true;resetFailure.c.clearAllAnswers();assert.equal(resetFailure.c.unsaved,true);assert.deepEqual(resetFailure.durable,old);resetFailure.c.check();resetFailure.c.submit();assert.equal(resetFailure.c.mode,"check");assert.equal(resetFailure.stats.finishes,0);resetFailure.flags.commitFail=false;resetFailure.c.retrySave();assert.equal(resetFailure.c.unsaved,false);
const resetReload=environment({durable:resetFailure.durable});assert.ok(resetReload.c.state.answers.every(a=>a.every(r=>!M.started(r))));resetReload.c.submit();assert.equal(resetReload.c.result.score,0);
const leaving=environment();drawOne(leaving.c);leaving.c.navigate(2,1);const draft=M.clone(leaving.c.state);leaving.events.pagehide({persisted:false});assert.equal(leaving.durable["cmi.core.exit"],"suspend");
const resumed=environment({durable:leaving.durable,seed:123});assert.deepEqual(resumed.c.state,draft);resumed.c.check();resumed.c.submit();resumed.events.pagehide({persisted:false});assert.equal(resumed.durable["cmi.core.exit"],"logout");const previous=M.clone(resumed.durable);assert.equal(environment({durable:resumed.durable}).c.mode,"review");const next=environment({seed:24});drawOne(next.c);assert.deepEqual(resumed.durable,previous);
for(const retryable of [true,false]){const e=environment();e.c.check();e.c.handleOutcome({activityState:"retry",retryable});assert.equal(e.c.mode,retryable?"check":"technical");}
const mismatch=environment();mismatch.c.check();mismatch.c.finalSnapshot=mismatch.scorm.makeSnapshot(P.ACTIVITY,"review",P.review(mismatch.c.state),S.score(mismatch.c.state));const other=M.clone(mismatch.c.finalSnapshot);other.answer.seed=22;mismatch.c.handleOutcome({activityState:"success",review:other,score:0,status:"failed"});assert.equal(mismatch.c.mode,"technical");
const local=environment({standalone:true});drawOne(local.c);const localReload=environment({standalone:true,storage:local.storage,seed:22});assert.deepEqual(localReload.c.state,P.fresh(22));local.c.check();local.c.submit();assert.equal(local.c.mode,"review");assert.equal(local.c.recoverDraft(),false);assert.equal(local.c.clearAllAnswers(),false);
const newRound=environment({standalone:true,storage:local.storage,seed:23});assert.deepEqual(newRound.c.state,P.fresh(23));drawOne(newRound.c);
const noStorage=environment({standalone:true,flags:{storageReadFail:true,storageWriteFail:true,storageRemoveFail:true}});drawOne(noStorage.c);assert.equal(noStorage.c.unsaved,false);noStorage.c.check();noStorage.c.submit();assert.equal(noStorage.c.mode,"review");assert.equal(noStorage.stats.storageReads+noStorage.stats.storageWrites,0);
const bad=durableDraft(P.fresh(21)),snapshot=JSON.parse(bad["cmi.suspend_data"]);snapshot.answer.target=999;bad["cmi.suspend_data"]=JSON.stringify(snapshot);const invalid=environment({durable:bad});assert.equal(invalid.c.canRecover,true);assert.equal(invalid.c.recoverDraft(),true);assert.deepEqual(invalid.c.state,P.fresh(21));drawOne(invalid.c);
console.log("third law lifecycle: shared outcomes, locked review/pending, quarantine, safe draft reset, resumed/new Moodle attempts and fresh standalone reload passed");
