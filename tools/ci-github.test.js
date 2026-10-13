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
 const broken=client({repo:'owner/repo',fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(broken.json('actions/runs'),/403/);
 const invalid=client({repo:'owner/repo',fetchImpl:async()=>({ok:true,json:async()=>({})})});
 await assert.rejects(invalid.pages('actions/runs','workflow_runs'),/collection/);
 console.log('GitHub evidence requests validate identity, pagination and failure states.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
