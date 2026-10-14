'use strict';
const assert=require('node:assert/strict');
const {collect,resultSummary}=require('./ci-finish');
async function main(){
 const plan={runId:'10',jobs:[{key:'node-1'},{key:'browser-1'}]};
 const api={
  json:async route=>({run_started_at:route.endsWith('/2')?'2026-10-14T12:00:00Z':'2026-10-14T10:00:00Z'}),
  pages:async route=>route.includes('/artifacts')?
   [{id:1,name:'quality-report-10-1-node-1'},{id:2,name:'quality-report-10-2-browser-1'}]:
   route.includes('/attempts/1/')?[{id:1,name:'verification / node-1',conclusion:'success'},{id:2,name:'verification / browser-1',conclusion:'failure',steps:[]}]:
   [{id:3,name:'verification / browser-1',conclusion:'success'}],
  artifactJSON:async artifact=>({jobKey:artifact.id===1?'node-1':'browser-1',attempt:artifact.id===1?1:2})
 };
 const evidence=await collect(api,plan,2);
 assert.equal(evidence.executions.length,3);
 assert.equal(evidence.reports.length,2);
 assert.equal(evidence.reports[1].artifactId,2);
 const old={id:11,name:'verification / node-1',conclusion:'success',status:'completed',run_attempt:1,started_at:'2026-10-14T10:01:00Z',completed_at:'2026-10-14T10:02:00Z'},carried={...old,id:21,run_attempt:2};
 const copiedApi={...api,pages:async route=>route.includes('/artifacts')?api.pages(route):route.includes('/attempts/1/')?[old,{id:12,name:'verification / browser-1',conclusion:'failure',steps:[]}]:[carried,{id:22,name:'verification / browser-1',conclusion:'success'}]};
 const copied=await collect(copiedApi,plan,2);assert.equal(copied.executions.length,3);assert.equal(copied.executions.find(e=>e.jobKey==='node-1').jobId,11);assert.equal(copied.executions.find(e=>e.jobKey==='node-1').attempt,1);
 for(const change of [j=>j.conclusion='failure',j=>j.started_at='2026-10-14T10:00:30Z'])await assert.rejects(collect({...copiedApi,pages:async route=>{const jobs=await copiedApi.pages(route);if(route.includes('/attempts/2/')){const altered=structuredClone(jobs);change(altered[0]);return altered;}return jobs;}},plan,2),/Unmatched carried/);
 const fresh=await collect({...copiedApi,pages:async route=>route.includes('/attempts/2/')?[{...carried,conclusion:'failure',started_at:'2026-10-14T12:01:00Z',completed_at:'2026-10-14T12:02:00Z',steps:[{name:'Run immutable planned tests',conclusion:'failure'}]},{id:22,name:'verification / browser-1',conclusion:'success'}]:copiedApi.pages(route)},plan,2);assert.equal(fresh.executions.at(-2).attempt,2);assert.equal(fresh.executions.at(-2).conclusion,'failure');assert(fresh.executions.at(-2).testStarted);
 await assert.rejects(collect({...api,json:async()=>({})},plan,2),/attempt start/);
 await assert.rejects(collect({...api,artifactJSON:async()=>({attempt:99})},plan,2),/identity/);
 await assert.rejects(collect({...api,pages:async()=>[]},plan,2),/Missing execution/);
 const summary=resultSummary({scope:'affected',sha:'tested',planHash:'immutable',policyHash:'policy',sources:[{jobKey:'node-1',attempt:1,jobId:11,artifactId:21},{jobKey:'browser-1',attempt:2,jobId:12,artifactId:22}]});
 assert(summary.includes('Passed scope: affected')&&summary.includes('| browser-1 | 2 | 12 | 22 |'));
 console.log('CI collection preserves partial-rerun lineage and rejects absent or forged report identities.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
