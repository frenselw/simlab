'use strict';
const assert=require('node:assert/strict');
const {validateMainReceipt,eventComparison}=require('./ci-prepare');
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
 const base=save('README.md','base');git('update-ref','refs/remotes/origin/main',base);
 git('checkout','-b','feature');const first=save('first.js','first'),head=save('second.js','second');
 const baseline={sha:base,runId:1};
 const compare=(event,payload,sha,ref,receipt=baseline)=>eventComparison({event,payload,sha,ref,baseline:receipt,directory});
 assert.deepEqual(compare('push',{before:first},head,'refs/heads/feature').paths.sort(),['first.js','second.js']);
 assert.deepEqual(compare('push',{before:'0'.repeat(40)},head,'refs/heads/feature').paths.sort(),['first.js','second.js']);
 assert.deepEqual(compare('push',{before:first},head,'refs/heads/main').paths.sort(),['first.js','second.js'],'main retains changes after a cancelled previous push');
 assert(compare('push',{before:first},head,'refs/heads/main',null).forceFullReason);
 git('checkout','main');const nextBase=save('base-update.js','base update');
 assert(compare('push',{before:head},nextBase,'refs/heads/main').forceFullReason,'force push cannot silently shrink comparison');
 git('merge','--no-ff','feature','-m','candidate');const merge=git('rev-parse','HEAD');
 const payload={pull_request:{base:{sha:nextBase},head:{sha:head}}};
 assert.deepEqual(compare('pull_request',payload,merge,'refs/pull/1/merge').paths.sort(),['first.js','second.js']);
 assert.throws(()=>compare('pull_request',payload,head,'refs/pull/1/merge'),/candidate/,'testing head cannot claim a merge result');
 assert.throws(()=>compare('pull_request',{pull_request:{base:{sha:base},head:{sha:head}}},merge,'refs/pull/1/merge'),/candidate/,'an outdated base cannot claim the new merge result');
 assert.throws(()=>compare('pull_request',payload,merge,'refs/pull/1/head'),/merge ref/);
 assert(compare('push',{before:'missing'},merge,'refs/heads/feature').forceFullReason);
}finally{
 assert.equal(path.dirname(directory),parent);assert(path.basename(directory).startsWith('ci-events-fixture-'));
 fs.rmSync(directory,{recursive:true,force:true});
}
console.log('CI baseline qualification rejects wrong workflow/repository/event/policy and incomplete evidence.');
