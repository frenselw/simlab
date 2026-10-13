'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {trackedDiff}=require('./test-runner');
const root=path.resolve(__dirname,'..');
function command(file,args=[]){
 const r=spawnSync(process.execPath,[path.join(root,file),...args],{cwd:root,stdio:'inherit'});
 if(r.status!==0)throw Error('Check command failed: '+file);
}
function main(operation,plan){
 if(operation==='syntax-and-manifests')command('tools/check.js');
 else if(operation==='all-scorm-packages')command('tools/package-all.js');
 else if(operation==='circuit-platform-packages')command('tools/package-circuit-platform.js');
 else if(operation==='diff-format'){
  const base=plan.comparison.baseSHA;
  const args=base?['diff','--check',base,plan.sha,'--']:['diff-tree','--check','--root',plan.sha];
  const r=spawnSync('git',args,{cwd:root,stdio:'inherit'});
  if(r.status!==0)throw Error('Changed-file formatting check failed');
 }else if(operation==='tracked-checkout'){
  if(trackedDiff(root))throw Error('A check/build changed tracked files');
 }else if(operation.startsWith('package:')){
  const slug=operation.slice(8);
  if(!/^[a-z0-9-]+$/.test(slug)||!fs.existsSync(path.join(root,'sim/manifests',slug+'.xml')))throw Error('Unknown package: '+slug);
  command('tools/package-scorm.js',[slug]);
 }else if(operation==='documentation-links'){
  require('./check-docs').checkDocs(plan.paths,root);
 }else throw Error('Unknown planned check: '+operation);
}
if(require.main===module){
 try{
  const operation=process.argv.find(a=>a.startsWith('--operation='))?.slice(12);
  if(!process.env.SIMLAB_CI_PLAN)throw Error('An immutable plan is required');
  const plan=JSON.parse(fs.readFileSync(process.env.SIMLAB_CI_PLAN,'utf8'));
  main(operation,plan);
 }catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={main};
