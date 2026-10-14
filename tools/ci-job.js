'use strict';
const fs=require('node:fs'),path=require('node:path');
const {digest}=require('./ci-plan'),{runTests}=require('./test-runner');
const {commit}=require('./test-selection');
const root=path.resolve(__dirname,'..');
function validatePlan(plan){
 const {hash,...data}=plan;
 if(hash!==digest(data))throw Error('Immutable plan hash does not match its contents');
 if(plan.sha!==commit(root,'HEAD'))throw Error('Plan does not match the tested checkout');
 if(String(plan.runId)!==String(process.env.GITHUB_RUN_ID))throw Error('Plan belongs to another workflow run');
}
async function main(){
 require('./test-registry').validateRegistry();
 const planPath=path.resolve(process.env.SIMLAB_CI_PLAN||'output/ci-tests/plan.json');
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));validatePlan(plan);
 const key=process.env.SIMLAB_JOB_KEY,job=plan.jobs.find(j=>j.key===key);
 if(!job)throw Error('Job is not in the immutable plan: '+key);
 process.env.SIMLAB_CI_PLAN=planPath;
 const entries=job.entries;
 if(JSON.stringify(entries.map(e=>e.id).sort())!==JSON.stringify([...job.expected].sort()))throw Error('Planned entries do not match the job expectation');
 const report=await runTests(entries,{root,reportPath:process.env.SIMLAB_TEST_REPORT,ciPlanHash:plan.hash,requireClean:true});
 process.exitCode=report.status==='passed'?0:1;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={validatePlan};
