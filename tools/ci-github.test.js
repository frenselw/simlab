'use strict';
const assert=require('node:assert/strict');
const {client}=require('./ci-github');
async function main(){
 const requests=[];
 const c=client({repo:'owner/repo',token:'fixture-token',fetchImpl:async(url,options)=>{
  requests.push({url,options});return{ok:true,json:async()=>({artifacts:[{id:1}]})};
 }});
 assert.deepEqual(await c.pages('actions/runs/1/artifacts','artifacts'),[{id:1}]);
 assert.equal(requests[0].options.headers.Authorization,'Bearer fixture-token');
 assert(requests[0].url.startsWith('https://api.github.com/repos/owner/repo/'));
 assert.throws(()=>client({repo:'../../other'}),/identity/);
 let deniedCalls=0;
 const broken=client({repo:'owner/repo',fetchImpl:async()=>{deniedCalls++;return{ok:false,status:403};}});
 await assert.rejects(broken.json('actions/runs'),/403/);
 assert.equal(deniedCalls,1,'permission failures are not server-error retries');
 const warnings=[],originalWarn=console.warn;console.warn=message=>warnings.push(message);
 try{
  let calls=0;
  const transient=client({repo:'owner/repo',fetchImpl:async()=>++calls===1?{ok:false,status:502}:{ok:true,json:async()=>({status:'success'})}});
  assert.deepEqual(await transient.json('actions/runs/1'),{status:'success'});assert.equal(calls,2);
  calls=0;
  const persistent=client({repo:'owner/repo',fetchImpl:async()=>{calls++;return{ok:false,status:503};}});
  await assert.rejects(persistent.json('actions/runs/1'),/503/);assert.equal(calls,2,'server retries are bounded');
  assert(warnings.some(message=>message.includes('(502)'))&&warnings.some(message=>message.includes('(503)')),'first faults remain in diagnostics');
 }finally{console.warn=originalWarn;}
 const invalid=client({repo:'owner/repo',fetchImpl:async()=>({ok:true,json:async()=>({})})});
 await assert.rejects(invalid.pages('actions/runs','workflow_runs'),/collection/);
 console.log('GitHub evidence requests validate identity, pagination and failure states.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
