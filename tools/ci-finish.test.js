'use strict';
const assert=require('node:assert/strict');
const {collect}=require('./ci-finish');
async function main(){
 const plan={runId:'10',jobs:[{key:'node-1'},{key:'browser-1'}]};
 const api={
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
 await assert.rejects(collect({...api,artifactJSON:async()=>({attempt:99})},plan,2),/identity/);
 await assert.rejects(collect({...api,pages:async()=>[]},plan,2),/Missing execution/);
 console.log('CI collection preserves partial-rerun lineage and rejects absent or forged report identities.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
