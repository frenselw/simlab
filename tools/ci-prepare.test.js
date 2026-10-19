'use strict';
const assert=require('node:assert/strict');
const {validateMainReceipt,eventComparison,recoverPlan,fullComparison,policyHash,testInputsHash,prepare}=require('./ci-prepare');
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
 const data={runId:'10',sha:'tested',policyHash:'policy',testInputsHash:'inputs',jobs:[{key:'browser-1',expected:['source','package']}],comparison:{baseline:{sha:'original-main'}}};
 const original={...data,hash:digest(data)};
 const artifact={name:'quality-plan-10',id:1,expired:false};
 const api={pages:async()=>[artifact],artifactJSON:async()=>structuredClone(original)};
 const context={runId:'10',sha:'tested',policy:'policy',inputsHash:'inputs'};
 assert.deepEqual(await recoverPlan(api,context),original,'reruns retain original entries and baseline rather than recomputing against changed main');
 for(const changed of [{sha:'new-checkout'},{policy:'new-policy'},{runId:'11'},{inputsHash:'changed-activity-test'},{inputsHash:undefined}]){
  await assert.rejects(recoverPlan(api,{...context,...changed}));
 }
 await assert.rejects(recoverPlan({...api,pages:async()=>[{...artifact,expired:true}]},context),/missing/);
 await assert.rejects(recoverPlan({...api,pages:async()=>[artifact,artifact]},context),/duplicated/);
 await assert.rejects(recoverPlan({...api,artifactJSON:async()=>({...original,jobs:[]})},context),/matches/);
 const invalid=spawnSync(process.execPath,[path.join(__dirname,'ci-prepare.js'),'--unknown'],{encoding:'utf8'});
 assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Unknown or duplicate/);
 console.log('Reruns recover the immutable original plan and reject changed identity, missing evidence and malformed options.');
}
async function verifyPolicyIsolation(){
 const dir=fs.mkdtempSync(path.join(parent,'ci-policy-fixture-'));
 const write=(file,text)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
 const g=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const scoped=['sim/horizontal-projectile-lab/model.test.js','tools/horizontal-projectile-browser-regression.js','tools/circuit-help-browser-cases.js','tools/force-composition-browser-regression.test.js'];
 const core=['tools/ci-prepare.js','tools/ci-results.js','tools/test-selection.js','tools/test-registry.js','tools/run-tests.js','tools/package-scorm.js',
  'tools/position-time-browser-regression.js','tools/mobile-scroll-operations.js','tools/check-docs.test.js','tools/unregistered-helper.js',
  'sim/shared/scorm.test.js','.github/workflows/quality.yml','package.json','package-lock.json','docs/ci-test-baseline-2026-10-13.json'];
 try{
  for(const file of [...scoped,...core])write(file,'original\n');
  const policy=policyHash(dir),inputs=testInputsHash(dir);
  assert.notEqual(policy,inputs,'core policy cannot impersonate a legacy full-input fingerprint');
  for(const file of scoped){
   write(file,'changed activity test\n');assert.equal(policyHash(dir),policy,file+' must keep the trusted core policy');
   assert.notEqual(testInputsHash(dir),inputs,file+' must still change immutable test inputs');write(file,'original\n');
  }
  for(const file of core){write(file,'changed core\n');assert.notEqual(policyHash(dir),policy,file+' must invalidate the baseline');write(file,'original\n');}
  write('tools/another-unknown-helper.js','new file\n');assert.notEqual(policyHash(dir),policy,'new unknown inputs stay fail-closed');fs.unlinkSync(path.join(dir,'tools/another-unknown-helper.js'));
  g('init','--initial-branch=main');g('config','user.name','CI policy fixture');g('config','user.email','ci@example.invalid');g('add','.');g('commit','-m','verified main');
  const base=g('rev-parse','HEAD');g('update-ref','refs/remotes/origin/main',base);g('checkout','-b','activity');
  const mainRun={id:1,repository:{full_name:'owner/repo'},workflow_id:5,event:'push',head_branch:'main',head_sha:base,conclusion:'success'};
  const mainReceipt={...receipt,sha:base,policyHash:policy};
  const artifact={id:2,name:'quality-receipt-1-1',expired:false};
  const api={json:async()=>({id:5}),pages:async route=>route.includes('/runs?')?[mainRun]:[artifact],artifactJSON:async()=>structuredClone(mainReceipt)};
  const eventFile=path.join(dir,'event.json');write('event.json',JSON.stringify({before:base}));
  const env={GITHUB_EVENT_PATH:eventFile,GITHUB_REPOSITORY:'owner/repo',GITHUB_RUN_ID:'2',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/activity',GITHUB_REF_NAME:'activity',GITHUB_WORKFLOW:'Quality'};
  // Run the real prepare path, not only the local selector that previously missed this bug.
  for(const file of scoped){
   g('reset','--hard',base);write(file,'updated coverage\n');g('add',file);g('commit','-m','activity test');const sha=g('rev-parse','HEAD');
   const plan=await prepare({directory:dir,env:{...env,GITHUB_SHA:sha},api});
   assert.equal(plan.scope,'affected',file);assert.equal(plan.comparison.baseline.sha,base);assert.equal(plan.policyHash,policy);assert.notEqual(plan.testInputsHash,inputs);
   const browser=plan.jobs.filter(j=>j.kind==='browser').flatMap(j=>j.entries);
   assert(browser.length>0&&browser.length<require('./run-tests').tests.filter(t=>require('./test-registry').info(t).kind==='browser').length);
   const scope=file.includes('circuit-help')?'circuit-family':file.includes('force-composition')?'force-composition-construction-lab':'horizontal-projectile-lab';
   assert(browser.every(e=>e.scope===scope));assert.equal(plan.jobs.filter(j=>j.kind==='node').flatMap(j=>j.entries).length,require('./run-tests').tests.filter(t=>require('./test-registry').info(t).kind==='node').length);
   assert.equal(plan.jobs.find(j=>j.key==='checks').packages==='all',false);
   const {hash,...data}=plan;assert.equal(hash,require('./ci-plan').digest(data));
   if(file===scoped[0]){
    const recoveryApi={pages:async()=>[{id:3,name:'quality-plan-2',expired:false}],artifactJSON:async()=>structuredClone(plan)};
    const context={runId:'2',sha,policy,inputsHash:testInputsHash(dir)};
    assert.deepEqual(await recoverPlan(recoveryApi,context),plan);
    write(file,'changed after planning\n');assert.equal(policyHash(dir),policy);
    await assert.rejects(recoverPlan(recoveryApi,{...context,inputsHash:testInputsHash(dir)}),/no longer matches/);
    write(file,'updated coverage\n');
   }
  }
  const sha=g('rev-parse','HEAD'),context={directory:dir,env:{...env,GITHUB_SHA:sha}};
  for(const badApi of [
   {...api,artifactJSON:async()=>({...mainReceipt,complete:false})},
   {...api,artifactJSON:async()=>({...mainReceipt,policyHash:inputs})},
   {...api,artifactJSON:async()=>({...mainReceipt,repository:'other/repo'})},
   {...api,pages:async()=>[]},
   {...api,pages:async()=>{throw Error('API unavailable');}}
  ])assert.equal((await prepare({...context,api:badApi})).scope,'full');
  for(const file of core){
   g('reset','--hard',base);write(file,'core policy change\n');g('add',file);g('commit','-m','core policy');
   const plan=await prepare({directory:dir,env:{...env,GITHUB_SHA:g('rev-parse','HEAD')},api});assert.equal(plan.scope,'full',file);
  }
  // A non-ancestor success cannot become the baseline even with an otherwise valid receipt.
  g('checkout','-b','unrelated',base);write('README.md','other branch');g('add','README.md');g('commit','-m','unrelated success');const unrelated=g('rev-parse','HEAD');
  g('checkout','activity');g('reset','--hard',base);write(scoped[0],'own branch');g('add',scoped[0]);g('commit','-m','activity');
  const noAncestor=await prepare({directory:dir,env:{...env,GITHUB_SHA:g('rev-parse','HEAD')},api:{...api,pages:async route=>route.includes('/runs?')?[{...mainRun,head_sha:unrelated}]:[artifact],artifactJSON:async()=>({...mainReceipt,sha:unrelated})}});
  assert.equal(noAncestor.scope,'full');assert.equal(noAncestor.comparison.baseline,null);
  console.log('Real CI preparation keeps scoped activity changes affected while core, shared, unknown, legacy and untrusted baselines stay full.');
 }finally{
  assert.equal(path.dirname(dir),parent);assert(path.basename(dir).startsWith('ci-policy-fixture-'));fs.rmSync(dir,{recursive:true,force:true});
 }
}
verifyPolicyIsolation().then(verifyRecovery).catch(e=>{console.error(e);process.exitCode=1;});
