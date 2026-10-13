'use strict';
const assert=require('node:assert/strict');
const same=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());
function latestReport(jobKey,reports,executions){
 const history=executions.filter(e=>e.jobKey===jobKey);
 assert(history.length,'Missing execution history: '+jobKey);
 const latest=history.sort((a,b)=>b.attempt-a.attempt)[0];
 assert.equal(latest.conclusion,'success','Latest job did not succeed: '+jobKey);
 const matches=reports.filter(r=>r.jobKey===jobKey&&Number(r.attempt)===latest.attempt);
 assert.equal(matches.length,1,'Missing or duplicate latest report: '+jobKey);
 return {report:matches[0],execution:latest};
}
function validateReport(plan,job,report){
 assert.equal(String(report.runId),String(plan.runId),'Run identity mismatch');
 assert.equal(report.sha,plan.sha,'Tested SHA mismatch');
 assert.equal(report.ciPlanHash,plan.hash,'Immutable plan mismatch');
 assert.equal(report.jobKey,job.key,'Job key mismatch');
 assert.equal(report.status,'passed','Report did not pass');
 assert.equal(report.worktreeDirty,false,'Tested checkout was dirty');
 assert.equal((report.environment.node||'').replace(/^v/,''),plan.environment.node,'Node environment mismatch');
 assert.equal(report.environment.platform,'linux','CI operating system mismatch');
 assert.equal(report.environment.image,'ubuntu24','CI runner image mismatch');
 assert(report.environment.imageVersion,'Missing runner image version');
 assert.equal(report.environment.sha,plan.sha,'Environment checkout mismatch');
 assert.equal(String(report.environment.runId),String(plan.runId),'Environment run mismatch');
 assert.equal(String(report.environment.attempt),String(report.attempt),'Environment attempt mismatch');
 assert.equal(report.environment.jobKey,job.key,'Environment job mismatch');
 if(job.kind==='browser'){
  assert.equal(report.environment.chrome,plan.environment.chrome,'Chrome environment mismatch');
  assert.match(report.environment.fontSha256||'',/^[a-f0-9]{64}$/,'Missing CJK font fingerprint');
  assert(report.environment.display,'Native browser display is missing');
 }
 assert(!report.errors?.length,'Report contains errors');
 assert(Number.isFinite(Date.parse(report.completedAt)),'Report is incomplete');
 const expected=job.expected;
 same(report.expected,expected);
 same(report.entries.map(e=>e.id),expected);
 assert.equal(new Set(report.entries.map(e=>e.id)).size,expected.length,'Duplicate entry completion');
 assert(report.entries.every(e=>e.status==='passed'),'Not every expected entry passed');
}
function validateResults(plan,reports,executions){
 assert(plan?.hash&&plan?.sha&&plan.jobs?.length,'Missing immutable plan');
 assert.equal(new Set(plan.jobs.map(j=>j.key)).size,plan.jobs.length,'Duplicate expected job');
 const sources=[];let browserFingerprint=null;
 for(const job of plan.jobs){
  const {report,execution}=latestReport(job.key,reports,executions);
  for(const prior of executions.filter(e=>e.jobKey===job.key&&e.attempt<execution.attempt&&e.conclusion==='failure')){
   const earlier=reports.find(r=>r.jobKey===job.key&&Number(r.attempt)===prior.attempt);
   if(prior.testStarted||earlier?.entries?.some(e=>['failed','timeout','cancelled'].includes(e.status))){
    throw Error('Earlier test failure remains unexplained: '+job.key+' attempt '+prior.attempt);
   }
  }
  validateReport(plan,job,report);
  if(job.kind==='browser'){
   const current=JSON.stringify(['image','imageVersion','os','arch','node','chrome','fontSha256'].map(key=>report.environment[key]));
   if(browserFingerprint!==null)assert.equal(current,browserFingerprint,'Browser jobs used different actual environments');
   browserFingerprint=current;
  }
  sources.push({jobKey:job.key,attempt:execution.attempt,jobId:execution.jobId,artifactId:report.artifactId,environment:report.environment});
 }
 return {status:'passed',sha:plan.sha,planHash:plan.hash,scope:plan.scope,sources};
}
module.exports={latestReport,validateReport,validateResults};
