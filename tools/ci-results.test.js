'use strict';
const assert=require('node:assert/strict');
const {validateResults}=require('./ci-results');
const plan={hash:'plan-1',sha:'sha-1',runId:'10',scope:'full',environment:{node:'22.23.3',chrome:'154.0.8037.92'},
 jobs:[{key:'node-1',kind:'node',expected:['logic']},{key:'browser-1',kind:'browser',expected:['source','package']}]};
const make=(key,expected,attempt=1)=>({jobKey:key,runId:'10',sha:'sha-1',ciPlanHash:'plan-1',attempt,status:'passed',worktreeDirty:false,
 environment:{node:'22.23.3',chrome:'154.0.8037.92',platform:'linux',image:'ubuntu24',imageVersion:'image-1',sha:'sha-1',runId:'10',attempt,jobKey:key,fontSha256:'a'.repeat(64),display:':99'},expected,entries:expected.map(id=>({id,status:'passed'})),errors:[],completedAt:new Date().toISOString(),artifactId:100+attempt});
const reports=[make('node-1',['logic']),make('browser-1',['source','package'],2)];
const executions=[{jobKey:'node-1',attempt:1,conclusion:'success',jobId:1},
 {jobKey:'browser-1',attempt:1,conclusion:'failure',jobId:2},{jobKey:'browser-1',attempt:2,conclusion:'success',jobId:3}];
assert.equal(validateResults(plan,reports,executions).status,'passed','a failed-job rerun can retain the unchanged successful job');
for(const change of [
 r=>r.pop(),r=>r[1].sha='other',r=>r[1].ciPlanHash='smaller-plan',
 r=>r[1].entries.pop(),r=>r[1].entries[0].status='not-run',r=>r[1].worktreeDirty=true,
 r=>r[1].environment.chrome='different',r=>r[1].environment.fontSha256=null,r=>r[1].environment.attempt=99,r=>r[1].environment.jobKey='other',r=>r[1].environment.imageVersion=null,r=>r[1].completedAt=null,
 r=>r[1].entries.push(r[1].entries[0])
]){const clone=structuredClone(reports);change(clone);assert.throws(()=>validateResults(plan,clone,executions));}
assert.throws(()=>validateResults(plan,reports,[...executions,{jobKey:'node-1',attempt:2,conclusion:'failure',jobId:4}]),/Latest job/,'an older success cannot hide the latest failure');
assert.throws(()=>validateResults(plan,reports,[...executions,{jobKey:'node-1',attempt:2,conclusion:'success',jobId:4}]),/latest report/,'third attempt cannot reuse first success when second execution has no report');
assert.throws(()=>validateResults(plan,reports,executions.filter(e=>e.jobKey!=='browser-1')),/history/);
assert.throws(()=>validateResults(plan,reports,executions.map(e=>e.conclusion==='failure'?{...e,testStarted:true}:e)),/unexplained/,'retry success cannot erase an earlier assertion failure');
console.log('CI gates reject missing, skipped, failed, stale, mismatched and partial evidence across attempts.');
