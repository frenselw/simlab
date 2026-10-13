'use strict';
const assert=require('node:assert/strict');
const {validateMainReceipt,eventComparison,recoverPlan,fullComparison}=require('./ci-prepare');
const run={repository:{full_name:'owner/repo'},workflow_id:5,event:'push',head_branch:'main',head_sha:'sha',conclusion:'success'};
const receipt={status:'passed',repository:'owner/repo',workflowId:5,event:'push',branch:'main',sha:'sha',policyHash:'policy',complete:true,sources:[{}]};
const expected={repository:'owner/repo',workflowId:5,policy:'policy'};
assert(validateMainReceipt(run,receipt,expected));
for(const field of ['repository','workflowId','event','branch','sha','policyHash','status']){
 assert(!validateMainReceipt(run,{...receipt,[field]:'wrong'},expected),field+' cannot impersonate a main baseline');
}
assert(!validateMainReceipt({...run,conclusion:'failure'},receipt,expected));
assert(!validateMainReceipt(run,{...receipt,complete:false},expected));
assert(!validateMainReceipt(run,{...receipt,sources:[]},expected));
const unknown=eventComparison({event:'push',payload:{before:'0000000000000000000000000000000000000000'},sha:'HEAD',ref:'refs/heads/main',baseline:null});
assert(unknown.forceFullReason);
assert.throws(()=>eventComparison({event:'pull_request',payload:{},sha:'HEAD',ref:'refs/heads/feature',baseline:null}),/merge ref/);
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const parent=path.resolve(__dirname,'../output/ci-tests');fs.mkdirSync(parent,{recursive:true});
const directory=fs.mkdtempSync(path.join(parent,'ci-events-fixture-'));
const git=(...args)=>{const r=spawnSync('git',args,{cwd:directory,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const save=(name,text)=>{fs.writeFileSync(path.join(directory,name),text);git('add','.');git('commit','-m',name);return git('rev-parse','HEAD');};
try{
 git('init','--initial-branch=main');git('config','user.name','CI fixture');git('config','user.email','ci@example.invalid');
 const base=save('README.md','base');
 assert.equal(fullComparison({event:'workflow_dispatch',sha:base,directory}).baseSHA,null,'initial root formatting has an explicit root range');
 git('update-ref','refs/remotes/origin/main',base);
 git('checkout','-b','feature');const first=save('first.js','first'),head=save('second.js','second');
 const baseline={sha:base,runId:1};
 assert.equal(fullComparison({event:'workflow_dispatch',sha:head,directory}).baseSHA,base,'full branch formatting includes the complete cumulative range');
 const compare=(event,payload,sha,ref,receipt=baseline)=>eventComparison({event,payload,sha,ref,baseline:receipt,directory});
 assert.deepEqual(compare('push',{before:first},head,'refs/heads/feature').paths.sort(),['first.js','second.js']);
 assert.deepEqual(compare('push',{before:'0'.repeat(40)},head,'refs/heads/feature').paths.sort(),['first.js','second.js']);
 assert.deepEqual(compare('push',{before:first},head,'refs/heads/main').paths.sort(),['first.js','second.js'],'main retains changes after a cancelled previous push');
 assert(compare('push',{before:first},head,'refs/heads/main',null).forceFullReason);
 git('checkout','main');const nextBase=save('base-update.js','base update');
 git('update-ref','refs/remotes/origin/main',nextBase);
 assert.equal(fullComparison({event:'push',payload:{before:base},sha:nextBase,directory}).baseSHA,base);
 assert.equal(fullComparison({event:'workflow_dispatch',sha:nextBase,directory}).baseSHA,base,'full main verification explicitly records the last-commit range');
 assert(compare('push',{before:head},nextBase,'refs/heads/main').forceFullReason,'force push cannot silently shrink comparison');
 git('checkout','-b','docs-from-pending-main',nextBase);
 const docsHead=save('README.md','documentation-only');
 const pendingDocs=compare('push',{before:nextBase},docsHead,'refs/heads/docs-from-pending-main');
 assert.deepEqual(pendingDocs.paths,['README.md']);
 assert.match(pendingDocs.forceFullReason,/Comparison base/,'documentation-only changes still protect unverified inherited main code');
 assert.equal(require('./test-selection').selectAffected(require('./run-tests').tests,pendingDocs.paths,{forceFullReason:pendingDocs.forceFullReason}).mode,'full');
 git('checkout','main');
 git('merge','--no-ff','feature','-m','candidate');const merge=git('rev-parse','HEAD');
 const payload={pull_request:{base:{sha:nextBase},head:{sha:head}}};
 assert.deepEqual(compare('pull_request',payload,merge,'refs/pull/1/merge').paths.sort(),['first.js','second.js']);
 assert.match(compare('pull_request',payload,merge,'refs/pull/1/merge').forceFullReason,/Comparison base/,'an older main success cannot hide an unverified PR base');
 assert.equal(compare('pull_request',payload,merge,'refs/pull/1/merge',{sha:nextBase}).forceFullReason,null);
 assert.match(compare('push',{before:merge},merge,'refs/heads/feature').forceFullReason,/Comparison base/,'a branch cannot omit pending main changes by claiming a documentation-only diff');
 assert.throws(()=>compare('pull_request',payload,head,'refs/pull/1/merge'),/candidate/,'testing head cannot claim a merge result');
 assert.throws(()=>compare('pull_request',{pull_request:{base:{sha:base},head:{sha:head}}},merge,'refs/pull/1/merge'),/candidate/,'an outdated base cannot claim the new merge result');
 assert.throws(()=>compare('pull_request',payload,merge,'refs/pull/1/head'),/merge ref/);
 assert(compare('push',{before:'missing'},merge,'refs/heads/feature').forceFullReason);
}finally{
 assert.equal(path.dirname(directory),parent);assert(path.basename(directory).startsWith('ci-events-fixture-'));
 fs.rmSync(directory,{recursive:true,force:true});
}
console.log('CI baseline qualification rejects wrong workflow/repository/event/policy and incomplete evidence.');
async function verifyRecovery(){
 const {digest}=require('./ci-plan');
 const data={runId:'10',sha:'tested',policyHash:'policy',jobs:[{key:'browser-1',expected:['source','package']}],comparison:{baseline:{sha:'original-main'}}};
 const original={...data,hash:digest(data)};
 const artifact={name:'quality-plan-10',id:1,expired:false};
 const api={pages:async()=>[artifact],artifactJSON:async()=>structuredClone(original)};
 const context={runId:'10',sha:'tested',policy:'policy'};
 assert.deepEqual(await recoverPlan(api,context),original,'reruns retain original entries and baseline rather than recomputing against changed main');
 for(const changed of [{sha:'new-checkout'},{policy:'new-policy'},{runId:'11'}]){
  await assert.rejects(recoverPlan(api,{...context,...changed}));
 }
 await assert.rejects(recoverPlan({...api,pages:async()=>[{...artifact,expired:true}]},context),/missing/);
 await assert.rejects(recoverPlan({...api,pages:async()=>[artifact,artifact]},context),/duplicated/);
 await assert.rejects(recoverPlan({...api,artifactJSON:async()=>({...original,jobs:[]})},context),/matches/);
 const invalid=spawnSync(process.execPath,[path.join(__dirname,'ci-prepare.js'),'--unknown'],{encoding:'utf8'});
 assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Unknown or duplicate/);
 console.log('Reruns recover the immutable original plan and reject changed identity, missing evidence and malformed options.');
}
verifyRecovery().catch(e=>{console.error(e);process.exitCode=1;});
