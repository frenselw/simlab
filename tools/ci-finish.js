'use strict';
const fs=require('node:fs'),path=require('node:path');
const {client}=require('./ci-github'),{digest}=require('./ci-plan'),{validateResults}=require('./ci-results');
function resultSummary(receipt){
 return ['## Verified result','',
  'Passed scope: '+receipt.scope+' · tested SHA: `'+receipt.sha+'`',
  'Plan: `'+receipt.planHash+'` · policy: `'+receipt.policyHash+'`',
  '', '| Job | Latest attempt used | Job ID | Artifact ID |','|---|---:|---:|---:|',
  ...receipt.sources.map(s=>'| '+s.jobKey+' | '+s.attempt+' | '+s.jobId+' | '+s.artifactId+' |'),
  '', 'These sources belong to the same run. Other failed runs and deployment gates remain separate.',''].join('\n');
}
async function collect(api,plan,attempt){
 const executions=[];
 for(let a=1;a<=attempt;a++){
  const jobs=await api.pages('actions/runs/'+plan.runId+'/attempts/'+a+'/jobs','jobs');
  for(const j of jobs){
   const key=j.name.split(' / ').at(-1);
   if(!plan.jobs.some(p=>p.key===key))continue;
   executions.push({jobKey:key,attempt:j.run_attempt||a,conclusion:j.conclusion,jobId:j.id,
    testStarted:j.steps?.some(s=>s.name==='Run immutable planned tests'&&s.conclusion!=='skipped')||false});
  }
 }
 const artifacts=await api.pages('actions/runs/'+plan.runId+'/artifacts','artifacts'),reports=[];
 for(const job of plan.jobs){
  const latest=executions.filter(e=>e.jobKey===job.key).sort((a,b)=>b.attempt-a.attempt)[0];
  if(!latest)throw Error('Missing execution: '+job.key);
  const history=artifacts.filter(a=>a.name.startsWith('quality-report-'+plan.runId+'-')&&a.name.endsWith('-'+job.key)&&!a.expired);
  for(const artifact of history){
   const report=await api.artifactJSON(artifact,'report.json');
   const expectedName='quality-report-'+plan.runId+'-'+report.attempt+'-'+job.key;
   if(artifact.name!==expectedName)throw Error('Artifact identity does not match its report');
   reports.push({...report,artifactId:artifact.id});
  }
 }
 return {reports,executions};
}
async function main(){
 const plan=JSON.parse(fs.readFileSync('output/ci-tests/plan.json','utf8'));
 const {hash,...data}=plan;
 if(hash!==digest(data)||String(plan.runId)!==process.env.GITHUB_RUN_ID)throw Error('Untrusted or mismatched immutable plan');
 const api=client(),{reports,executions}=await collect(api,plan,Number(process.env.GITHUB_RUN_ATTEMPT));
 const result=validateResults(plan,reports,executions);
 const run=await api.json('actions/runs/'+plan.runId);
 const receipt={...result,repository:plan.repository,workflowId:run.workflow_id,event:plan.event,branch:plan.branch,
  workflowSHA:plan.workflowSHA,workflowRef:plan.workflowRef,
  policyHash:plan.policyHash,complete:true,completedAt:new Date().toISOString()};
 fs.writeFileSync(path.resolve('output/ci-tests/receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,resultSummary(receipt));
 console.log(JSON.stringify(receipt,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={collect,resultSummary};
