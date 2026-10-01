"use strict";
const assert=require('node:assert/strict'),P=require('./persistence.js'),M=require('./model.js'),{environment,filled,durableDraft,finishedData}=require('./test-support.js');
for(const state of [P.fresh(),P.command(P.fresh(),{type:'motion',axis:0,value:'uniform'}),filled()]){
  const e=environment({durable:durableDraft(state)});assert.equal(e.c.mode,'edit');e.c.check();e.c.submit();assert.equal(e.c.mode,'review');assert.equal(e.c.editable,false);assert.equal(e.c.command({type:'clear'}),false);
  const resume=environment({durable:e.durable});assert.equal(resume.c.mode,'review');assert.equal(resume.c.result.score,e.c.result.score);
  const frozen=environment({durable:durableDraft(state),flags:{writeFail:'cmi.core.score.raw'}});frozen.c.check();frozen.c.submit();assert.equal(frozen.c.mode,'frozen');assert.equal(frozen.c.result,null);const old=JSON.stringify(frozen.c.finalSnapshot);frozen.c.navigate(3,4);assert.equal(JSON.stringify(frozen.c.finalSnapshot),old);
  const retry=environment({durable:frozen.durable});assert.equal(retry.c.mode,'frozen');retry.c.retryFinal();assert.equal(retry.c.mode,'review');
  const committed=environment({durable:durableDraft(state),flags:{finishFail:true}});committed.c.check();committed.c.submit();assert.equal(committed.c.mode,'committed');committed.flags.finishFail=false;committed.c.retryFinal();assert.equal(committed.c.mode,'review');
}
for(const durable of [{...finishedData(filled()),'cmi.core.score.raw':'19'},{...finishedData(filled()),'cmi.core.lesson_status':'completed'}, {'cmi.core.lesson_status':'passed','cmi.core.score.raw':'100','cmi.suspend_data':'broken'}]){const e=environment({durable});assert.equal(e.c.mode,'mismatch');assert.equal(e.c.editable,false);assert.equal(e.c.trusted,false);}
const broken=environment({durable:{'cmi.core.lesson_status':'incomplete','cmi.suspend_data':'broken'}});assert.equal(broken.c.mode,'technical');
const read=environment({flags:{readFail:'cmi.suspend_data'}});assert.equal(read.c.mode,'technical');assert.equal(read.stats.writes,0);
const failure=environment();failure.c.check();failure.c.handleOutcome({activityState:'retry',retryable:true});assert.equal(failure.c.mode,'check');assert.equal(failure.c.result,null);failure.c.navigate(1);assert.equal(failure.c.mode,'edit');
const checkpoint=environment();checkpoint.c.check();checkpoint.flags.writeFail='cmi.suspend_data';checkpoint.c.submit();assert.equal(checkpoint.c.mode,'frozen');checkpoint.flags.writeFail=null;checkpoint.c.retryFinal();assert.equal(checkpoint.c.mode,'review');
const nonretry=environment();nonretry.c.check();nonretry.c.handleOutcome({activityState:'retry',retryable:false});assert.equal(nonretry.c.mode,'technical');
const frozen=environment({durable:durableDraft(filled()),flags:{writeFail:'cmi.core.score.raw'}});frozen.c.check();frozen.c.submit();const bad=M.clone(frozen.durable),pending=JSON.parse(bad['cmi.suspend_data']);const inner=JSON.parse(pending.payload.reviewJson);inner.answer.cases[0].motions[0]='nonuniform';pending.payload.reviewJson=JSON.stringify(inner);bad['cmi.suspend_data']=JSON.stringify(pending);const quarantined=environment({durable:bad});assert.equal(quarantined.c.mode,'technical');const writes=quarantined.stats.writes;quarantined.events.pagehide({persisted:true});assert.equal(quarantined.stats.writes,writes);
// Score-zero metadata also cannot make a malformed authoritative enum safe.
const blankPending=environment({durable:durableDraft(P.fresh()),flags:{writeFail:'cmi.core.score.raw'}});blankPending.c.check();blankPending.c.submit();
for(const field of ['horizontal','vertical','trajectory']){
  const durable=M.clone(blankPending.durable),outer=JSON.parse(durable['cmi.suspend_data']),review=JSON.parse(outer.payload.reviewJson);
  if(field==='trajectory')review.answer.cases[0].trajectory=['line'];else review.answer.cases[0].motions[field==='horizontal'?0:1]=['uniform'];
  outer.payload.reviewJson=JSON.stringify(review);durable['cmi.suspend_data']=JSON.stringify(outer);
  const restored=environment({durable});assert.equal(restored.c.mode,'technical');assert.equal(restored.c.trusted,false);
  const before=M.clone(restored.durable),count=restored.stats.writes;restored.c.retryFinal();restored.events.pagehide({persisted:true});
  assert.equal(restored.stats.writes,count);assert.deepEqual(restored.durable,before);
}
const altered=environment();altered.c.check();altered.c.submit();const different=M.clone(altered.c.finalSnapshot);different.answer.activeTime=2;altered.c.handleOutcome({activityState:'success',review:different});assert.equal(altered.c.mode,'technical','equal score does not excuse changed authoritative answers');
const storage=new Map([['simlab:old','broken']]);for(const flags of [{},{storageReadFail:true,storageWriteFail:true}]){const e=environment({standalone:true,storage,flags});e.c.command({type:'motion',axis:0,value:'uniform'});e.c.check();e.c.submit();assert.equal(e.c.mode,'review');const reload=environment({standalone:true,storage,flags});assert.deepEqual(reload.c.state,P.fresh());assert.equal(e.stats.storageReads+e.stats.storageWrites+reload.stats.storageReads+reload.stats.storageWrites,0);}
console.log('motion composition lifecycle: all startup/submission outcomes, trust, immutable pending/review, quarantine and standalone refresh passed');
