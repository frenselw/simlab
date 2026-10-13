'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {buildPlan}=require('./ci-plan'),{validatePlan}=require('./ci-job'),{commit}=require('./test-selection');
const {tests}=require('./run-tests');
const old=process.env.GITHUB_RUN_ID;process.env.GITHUB_RUN_ID='fixture';
try{
 const plan=buildPlan({tests,runId:'fixture',sha:commit(path.resolve(__dirname,'..'),'HEAD'),policyHash:'policy'});
 validatePlan(plan);
 assert.throws(()=>validatePlan({...plan,scope:'docs'}),/hash/);
 assert.throws(()=>validatePlan({...plan,hash:'bad'}),/hash/);
 process.env.GITHUB_RUN_ID='another';
 assert.throws(()=>validatePlan(plan),/another workflow/);
}finally{if(old===undefined)delete process.env.GITHUB_RUN_ID;else process.env.GITHUB_RUN_ID=old;}
console.log('CI workers reject changed plans, another checkout and another workflow identity.');
