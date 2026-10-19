'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {buildPlan,digest,planSummary}=require('./ci-plan');
const {parseNameStatus,selectAffected,commit}=require('./test-selection');
const {client}=require('./ci-github');
const root=path.resolve(__dirname,'..');
function git(args,directory=root){
 const r=spawnSync('git',args,{cwd:directory,encoding:'utf8'});
 if(r.status!==0)throw Error('CI Git operation failed: '+r.stderr);return r.stdout.trim();
}
function diff(directory,base,head){
 const r=spawnSync('git',['diff','--name-status','-z','--find-renames',base,head,'--'],{cwd:directory,encoding:'utf8'});
 if(r.status!==0)throw Error('CI Git diff failed: '+r.stderr);return parseNameStatus(r.stdout);
}
function testInputFiles(directory){
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 return [...walk(path.join(directory,'tools')),...walk(path.join(directory,'.github')),
  ...walk(path.join(directory,'sim')).filter(f=>f.endsWith('.test.js')),
  ...['package.json','package-lock.json','docs/ci-test-baseline-2026-10-13.json'].map(f=>path.join(directory,f))].sort();
}
function inputFingerprint(directory,files,version){
 const h=createHash('sha256').update(version+'\0');
 for(const file of files){
  const name=path.relative(directory,file).split(path.sep).join('/');
  const content=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  h.update(JSON.stringify([name,content])+'\n');
 }
 return h.digest('hex');
}
function testInputsHash(directory=root){
 return inputFingerprint(directory,testInputFiles(directory),'simlab-ci-test-inputs-v1');
}
function policyHash(directory=root){
 const {tests,helpers,info}=require('./test-registry');
 const candidates=new Set([...tests.map(t=>info(t).file),...helpers.map(h=>h.file)]);
 // Reuse the fail-closed owner mapping; shared infrastructure and unmapped files stay protected.
 const scoped=new Set([...candidates].filter(file=>{
  const selection=selectAffected(tests,[file],{assets:new Map()});
  return selection.mode==='affected'&&selection.entries.some(e=>e.kind==='browser');
 }));
 const files=testInputFiles(directory).filter(f=>!scoped.has(path.relative(directory,f).split(path.sep).join('/')));
 return inputFingerprint(directory,files,'simlab-ci-core-policy-v2');
}
function validateMainReceipt(run,receipt,{repository,workflowId,policy}){
 return run.repository?.full_name===repository&&run.workflow_id===workflowId&&run.event==='push'&&run.head_branch==='main'&&
  run.conclusion==='success'&&receipt.status==='passed'&&receipt.repository===repository&&receipt.workflowId===workflowId&&
  receipt.event==='push'&&receipt.branch==='main'&&receipt.sha===run.head_sha&&receipt.policyHash===policy&&
  receipt.complete===true&&Array.isArray(receipt.sources)&&receipt.sources.length>0;
}
async function qualifiedMain(api,{repository,policy,sha,directory=root}){
 const workflow=await api.json('actions/workflows/quality.yml');
 const runs=await api.pages('actions/workflows/'+workflow.id+'/runs?branch=main&event=push&status=success','workflow_runs');
 for(const run of runs){
  const ancestry=spawnSync('git',['merge-base','--is-ancestor',run.head_sha,sha],{cwd:directory});
  if(ancestry.status!==0)continue;
  const artifacts=await api.pages('actions/runs/'+run.id+'/artifacts','artifacts');
  const receiptArtifact=artifacts.filter(a=>!a.expired&&a.name.startsWith('quality-receipt-'+run.id+'-')).sort((a,b)=>b.id-a.id)[0];
  if(!receiptArtifact)continue;
  const receipt=await api.artifactJSON(receiptArtifact,'receipt.json');
  if(validateMainReceipt(run,receipt,{repository,workflowId:workflow.id,policy})){
   return {sha:run.head_sha,runId:run.id,artifactId:receiptArtifact.id,workflowId:workflow.id};
  }
 }
 return null;
}
function eventComparison({event,payload,sha,ref,baseline,directory=root}){
 const comparison={event,testedSHA:sha,baseSHA:null,headSHA:sha,paths:[],forceFullReason:null,baseline};
 try{
  if(event==='pull_request'){
   if(!/^refs\/pull\/\d+\/merge$/.test(ref))throw Error('PR verification requires the merge ref');
   const base=commit(directory,payload.pull_request.base.sha),head=commit(directory,payload.pull_request.head.sha);
   const parents=git(['rev-list','--parents','-n','1',sha],directory).split(' ');
   if(parents.length!==3||parents[1]!==base||parents[2]!==head)throw Error('Checkout does not match the PR merge candidate');
   const ancestor=git(['merge-base',base,head],directory);
   comparison.baseSHA=base;comparison.headSHA=head;
   comparison.paths=[...new Set([...diff(directory,ancestor,head),...diff(directory,base,sha)])];
  }else if(event==='push'){
   const before=payload.before;
   const main=ref==='refs/heads/main';
   const base=main?(baseline?.sha||before):git(['merge-base','origin/main',sha],directory);
   if(!base||/^0+$/.test(base))throw Error('No usable pushed baseline');
   comparison.baseSHA=commit(directory,base);
   comparison.paths=diff(directory,comparison.baseSHA,sha);
   if(before&&!/^0+$/.test(before)){
    const resolved=commit(directory,before);
    const ancestry=spawnSync('git',['merge-base','--is-ancestor',resolved,sha],{cwd:directory});
    if(ancestry.status!==0)throw Error('Force-push baseline is not an ancestor');
    comparison.paths=[...new Set([...comparison.paths,...diff(directory,resolved,sha)])];
   }
  }else throw Error('Unsupported daily event: '+event);
  if(!baseline)comparison.forceFullReason='No qualified successful main baseline';
  else if(baseline.sha!==comparison.baseSHA)comparison.forceFullReason='Comparison base has no successful main evidence at that SHA';
 }catch(e){
  if(event==='pull_request')throw e;
  comparison.forceFullReason=e.message;
 }
 return comparison;
}
async function prepare({full=false,directory=root,env=process.env,api=null}={}){
 const {tests}=require('./run-tests');
 require('./test-registry').validateRegistry();
 const sha=commit(directory,'HEAD'),policy=policyHash(directory),inputsHash=testInputsHash(directory);
 const payload=env.GITHUB_EVENT_PATH?JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8')):{};
 if(!full&&sha!==env.GITHUB_SHA)throw Error('Tested checkout differs from the event SHA');
 let baseline=null,queryError=null;
 if(!full)try{baseline=await qualifiedMain(api||client(),{repository:env.GITHUB_REPOSITORY,policy,sha,directory});}catch(e){queryError=e.message;}
 const comparison=full?fullComparison({event:env.GITHUB_EVENT_NAME,payload,sha,directory}):
  eventComparison({event:env.GITHUB_EVENT_NAME,payload,sha,ref:env.GITHUB_REF,baseline,directory});
 if(queryError)comparison.forceFullReason='Main evidence query failed: '+queryError;
 const selection=full?null:selectAffected(tests,comparison.paths,{trustedEmpty:baseline?.sha===sha,forceFullReason:comparison.forceFullReason});
 const timingFile=path.join(root,'tools/test-durations.json');
 const durations=fs.existsSync(timingFile)?JSON.parse(fs.readFileSync(timingFile,'utf8')).seconds:{};
 const plan=buildPlan({tests,selection,runId:env.GITHUB_RUN_ID,sha,policyHash:policy,comparison,durations});
 plan.testInputsHash=inputsHash;
 plan.repository=env.GITHUB_REPOSITORY;plan.workflow=env.GITHUB_WORKFLOW;
 plan.workflowSHA=env.GITHUB_WORKFLOW_SHA||null;plan.workflowRef=env.GITHUB_WORKFLOW_REF||null;
 plan.event=env.GITHUB_EVENT_NAME;plan.branch=env.GITHUB_REF_NAME;
 delete plan.hash;plan.hash=digest(plan);
 return plan;
}
function fullComparison({event,payload={},sha,directory=root}){
 let base=null,method='root commit';
 try{
  const ancestor=git(['merge-base','origin/main',sha],directory);
  if(ancestor!==sha){base=ancestor;method='cumulative merge-base to origin/main';}
 }catch{}
 if(!base&&payload.before&&!/^0+$/.test(payload.before))try{
  const before=commit(directory,payload.before);
  if(spawnSync('git',['merge-base','--is-ancestor',before,sha],{cwd:directory}).status===0){base=before;method='event before to tested SHA';}
 }catch{}
 if(!base)try{base=git(['rev-parse',sha+'^'],directory);method='parent to tested SHA';}catch{}
 return {event,testedSHA:sha,baseSHA:base,headSHA:sha,paths:[],method};
}
async function recoverPlan(api,{runId,sha,policy,inputsHash}){
 const artifacts=await api.pages('actions/runs/'+runId+'/artifacts','artifacts');
 const originals=artifacts.filter(a=>a.name==='quality-plan-'+runId&&!a.expired);
 if(originals.length!==1)throw Error('Original immutable plan is missing or duplicated; start a new full verification run');
 const plan=await api.artifactJSON(originals[0],'plan.json');
 const {hash,...data}=plan;
 if(hash!==digest(data)||String(plan.runId)!==String(runId)||plan.sha!==sha||plan.policyHash!==policy||
  typeof inputsHash!=='string'||!inputsHash||plan.testInputsHash!==inputsHash){
  throw Error('Original plan no longer matches this run/checkout/policy');
 }
 return plan;
}
async function main(){
 const args=process.argv.slice(2);
 if(new Set(args).size!==args.length||args.some(a=>!['--full','--shadow'].includes(a)))throw Error('Unknown or duplicate CI planning option');
 const full=process.argv.includes('--full');
 let plan,reused=false;
 if(Number(process.env.GITHUB_RUN_ATTEMPT||'1')>1){
  plan=await recoverPlan(client(),{runId:process.env.GITHUB_RUN_ID,sha:commit(root,'HEAD'),policy:policyHash(),inputsHash:testInputsHash()});
  reused=true;
 }else plan=await prepare({full});
 fs.mkdirSync(path.join(root,'output/ci-tests'),{recursive:true});
 if(process.argv.includes('--shadow')&&!reused){
  const shadow=await prepare();
  fs.writeFileSync(path.join(root,'output/ci-tests/shadow-plan.json'),JSON.stringify(shadow,null,2)+'\n');
 }
 fs.writeFileSync(path.join(root,'output/ci-tests/plan.json'),JSON.stringify(plan,null,2)+'\n');
 const outputs={
  tested_sha:plan.sha,
  worker_matrix:JSON.stringify(plan.jobs.filter(j=>j.kind!=='browser').map(j=>({key:j.key}))),
  browser_matrix:JSON.stringify(plan.jobs.filter(j=>j.kind==='browser').map(j=>({key:j.key}))),
  has_browser:String(plan.jobs.some(j=>j.kind==='browser')),
  plan_reused:String(reused)
 };
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(outputs).map(([k,v])=>k+'='+v).join('\n')+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,planSummary(plan));
 console.log(JSON.stringify({scope:plan.scope,sha:plan.sha,jobs:plan.jobs.map(j=>({key:j.key,entries:j.expected.length})),reasons:plan.reasons},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={prepare,eventComparison,validateMainReceipt,policyHash,testInputsHash,diff,recoverPlan,fullComparison};
