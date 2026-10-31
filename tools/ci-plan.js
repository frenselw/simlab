'use strict';
const {createHash}=require('node:crypto');
const {info}=require('./test-selection');
const environment={runner:'ubuntu-24.04',node:'22.23.3',chrome:'154.0.8037.92'};
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function planSummary(plan){
 const comparison=plan.comparison||{};
 return ['## Planned verification','',
  'Scope: '+plan.scope+' · tested SHA: `'+plan.sha+'` · run '+plan.runId,
  'Workflow revision: `'+(plan.workflowSHA||'not recorded')+'`',
  'Base: `'+(comparison.baseSHA||'full / unavailable')+'` · head: `'+(comparison.headSHA||plan.sha)+'`',
  '',...plan.reasons.map(reason=>'- '+reason.replaceAll('\n',' ')),
  '', '| Job | Required entries | Estimated seconds |','|---|---:|---:|',
  ...plan.jobs.map(j=>'| '+j.key+' | '+j.expected.length+' | '+(j.estimatedSeconds===undefined?'not measured':Math.round(j.estimatedSeconds))+' |'),
  '', 'Results must match plan `'+plan.hash+'`; this selection is not release or real-device acceptance.',''].join('\n');
}
function estimatedSeconds(entry){
 const group=entry.args.find(a=>a.startsWith('--group='))?.slice(8);
 if(group&&entry.file.endsWith('rocket-space-mission-browser-regression.js'))return 1200;
 if(group)return {editing:1200,instruments:1200,interruptions:240,hosts:360}[group]||240;
 if(entry.kind==='node')return 2;
 if(entry.file.includes('circuit-ac-browser'))return 900;
 if(entry.file.includes('circuit-assessed'))return 300;
 if(entry.file.includes('newtons-second-law'))return 600;
 return 240;
}
function distribute(entries,count=4,durations={}){
 const buckets=Array.from({length:Math.min(count,entries.length)},()=>({entries:[],seconds:0}));
 const sorted=entries.map(e=>({entry:e,seconds:durations[e.id]||estimatedSeconds(e)}))
  .sort((a,b)=>b.seconds-a.seconds||a.entry.id.localeCompare(b.entry.id));
 for(const item of sorted){
  const bucket=buckets.reduce((a,b)=>a.seconds<=b.seconds?a:b);
  bucket.entries.push(item.entry);bucket.seconds+=item.seconds;
 }
 return buckets;
}
function buildPlan({tests,selection,runId,sha,policyHash,comparison={},durations={}}){
 const selected=(selection?.entries||tests.map(info)).map(info),scope=selection?.mode||'full',jobs=[];
 if(scope==='docs'){
  const expected=['documentation-links','diff-format'];
  jobs.push({key:'docs',kind:'docs',expected,entries:expected.map(id=>({id,file:'tools/ci-check-item.js',args:['--operation='+id],kind:'docs'}))});
 }
 else{
  for(const kind of ['node','browser'])distribute(selected.filter(e=>e.kind===kind),kind==='browser'?8:4,durations).forEach((bucket,index)=>{
   jobs.push({key:kind+'-'+(index+1),kind,entries:bucket.entries,expected:bucket.entries.map(e=>e.id),estimatedSeconds:bucket.seconds});
  });
  const packages=selection?.packages??'all';
  const expected=['syntax-and-manifests','diff-format','tracked-checkout'];
  if(packages==='all')expected.push('all-scorm-packages','circuit-platform-packages');
  else{
   if(packages.some(name=>name.startsWith('circuit-')))expected.push('circuit-platform-packages');
   for(const name of packages.filter(name=>!name.startsWith('circuit-')))expected.push('package:'+name);
  }
  jobs.push({key:'checks',kind:'checks',expected,
   entries:expected.map(id=>({id,file:'tools/ci-check-item.js',args:['--operation='+id],kind:'checks'})),packages});
 }
 const plan={schemaVersion:2,runId:String(runId),sha,policyHash,scope,environment,jobs,
  comparison,reasons:selection?.reasons||['Explicit full regression'],paths:selection?.paths||[]};
 plan.hash=digest(plan);
 return plan;
}
module.exports={environment,digest,distribute,buildPlan,planSummary};
