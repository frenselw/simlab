'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('./circuit-model'),F=require('./circuit-profile'),G=require('./circuit-routing'),Solver=require('./circuit-solver'),Data=require('./circuit-activity-data'),Flow=require('../shared/activity-flow'),{Controller}=require('./circuit-activity-runtime');
const source=fs.readFileSync(require.resolve('../shared/scorm'),'utf8');
const tasks=['circuit-dc-series-build','circuit-dc-rheostat-adjust'].map(slug=>({Q:require('../'+slug+'/spec'),P:require('../'+slug+'/persistence'),S:require('../'+slug+'/scoring')}));
function environment(t,options={}){
 const durable=options.durable||{},values={...durable},flags=options.flags||{},events={},stats={writes:0,commits:0,finishes:0,storage:0};let error='0';
 const window={location:{reload(){}},addEventListener:(k,v)=>events[k]=v};window.parent=window;window.top=window;
 Object.defineProperty(window,'localStorage',{get(){stats.storage++;throw Error('storage denied');}});
 if(!options.standalone)window.API={LMSInitialize:()=>flags.initFail?'false':'true',LMSGetValue(k){error=flags.readFail===k?'101':'0';return error==='0'?values[k]||'':'';},LMSSetValue(k,v){stats.writes++;if(flags.writeFail===k){error='351';return 'false';}values[k]=String(v);error='0';return 'true';},LMSCommit(){stats.commits++;if(flags.commitFail){error='391';return 'false';}Object.assign(durable,values);error='0';return 'true';},LMSFinish(){stats.finishes++;error=flags.finishFail?'101':'0';return flags.finishFail?'false':'true';},LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};
 vm.runInNewContext(source,{window,console:{warn(){},info(){},error(){}},TextEncoder,setTimeout,clearTimeout});
 const c=new Controller(t.Q,t.P,t.S,window.SimScorm,Flow);c.start();return {c,scorm:window.SimScorm,durable,events,stats,flags};
}
function envelope(t,s,kind='draft'){return {version:1,activity:t.P.ACTIVITY,kind,answer:kind==='review'?t.P.review(s):t.P.draft(s),...(kind==='review'?{score:t.S.score(s).score,passed:t.S.score(s).passed}:{})};}
function draft(t,s){return {'cmi.core.lesson_status':'incomplete','cmi.suspend_data':JSON.stringify(envelope(t,s))};}
function ring(){const d=M.clone(F.compile(tasks[0].Q.config()).initial);for(const [type,x,y]of [['battery',160,300],['switch',320,150],['lamp',530,150],['lamp',530,400]]){const p=F.compile(tasks[0].Q.config()).palette.find(p=>p.type===type);M.add(d,type,x,y,p.params);}d.components[0].angle=90;for(const [from,to]of [['c1:a','c2:a'],['c2:b','c3:a'],['c3:b','c4:b'],['c4:a','c1:b']]){M.connect(d,from,to);d.wires.at(-1).length=600;}return M.validate(d);}
const series=tasks[0],slider=tasks[1],perfect=series.P.capture(ring(),series.P.fresh());
assert.equal(series.S.score(perfect).score,100);
const open=ring();open.components[1].params.closed=false;assert.equal(series.S.score(series.P.capture(open,perfect)).score,80);
assert.equal(series.S.score(series.P.capture(open,perfect)).passed,false);
const chain=ring();chain.wires=chain.wires.slice(1,3);assert.equal(series.S.score(series.P.capture(chain,perfect)).score,50);
const loose=ring();loose.wires=[];assert.equal(series.S.score(series.P.capture(loose,perfect)).score,0);
for(const [a,b]of [['c3:a','c3:b'],['c3:a','c4:a']]){const d=ring();d.wires[2].to=b;d.wires[2].from=a;d.wires[2].shape='free';d.wires[2].via=[];assert(series.S.score(series.P.capture(M.validate(d),perfect)).score<100);}
const correct=slider.P.fresh();correct.answers=[{position:.3,reason:-1,view:0},{position:.7,reason:1,view:1}];assert.equal(slider.S.score(correct).score,100);
assert.equal(slider.S.score({...correct,answers:correct.answers.map(a=>({...a,position:null}))}).score,40);
assert.equal(slider.S.score({...correct,answers:correct.answers.map(a=>({...a,reason:null}))}).score,60);
for(const [i,target,tolerance]of [[0,.25,.005],[1,1.8,.03]])for(const sign of [-1,1]){
 const s=slider.P.fresh();s.question=i;s.answers[i].position=(i===0?6/(target+sign*tolerance)-12:72/(target+sign*tolerance)-12)/40;
 assert.equal(slider.S.score(s).detail[i*2].earned,30);
 s.answers[i].position=(i===0?6/(target+sign*(tolerance+.0001))-12:72/(target+sign*(tolerance+.0001))-12)/40;
 assert.equal(slider.S.score(s).detail[i*2].earned,0);
}
const viewOnly=slider.P.document(slider.P.fresh());viewOnly.display.view='schematic';assert.equal(slider.P.capture(viewOnly,slider.P.fresh()).answers[0].position,null);
const fixed=F.compile(slider.Q.config());for(const mutate of [d=>d.components[0].x++,d=>d.components[2].params.resistance++,d=>d.wires.pop(),d=>M.add(d,'lamp',0,0)]){const d=M.clone(fixed.initial);mutate(d);assert.throws(()=>fixed.assertSnapshot(d));}
const fine=ring();fine.wires[0].shape='free';const endpoints=M.endpoints(fine),start=endpoints.get(fine.wires[0].from),end=endpoints.get(fine.wires[0].to);fine.wires[0].via=Array.from({length:96},(_,i)=>({x:start.x+(end.x-start.x)*(i+1)/97,y:start.y+(end.y-start.y)*(i+1)/97+Math.sin(i)*.1}));
const before=Solver.solve(fine),length=G.length(G.route(fine,fine.wires[0]));const teacher=F.compile({role:'teacher'});teacher.prepare(fine);assert.equal(fine.wires[0].via.length,96);const bounded=F.compile(series.Q.config());assert.throws(()=>bounded.assertSnapshot(fine));bounded.prepare(fine);assert.equal(fine.wires[0].via.length,8);assert(G.length(G.route(fine,fine.wires[0]))<=length);assert.deepEqual(Solver.solve(fine).components,before.components);M.validate(fine);
const worst=M.clone(bounded.initial);for(let i=0;i<4;i++){const type=['battery','switch','lamp','lamp'][i];M.add(worst,type,1/300000,-1/300000,bounded.palette.find(e=>e.type===type).params);const w=M.addWire(worst,-5000+i*500,100.123456789);w.via=Array.from({length:8},(_,j)=>({x:-5080+i*500+j*20.123456789,y:100.123456789+Math.sin(j)*1.123456789}));}
const worstAnswer=series.P.capture(worst,perfect);assert.deepEqual(series.P.document(worstAnswer),M.validate(worst));
for(const phase of ['edit','check']){const s={...worstAnswer,phase},d=envelope(series,s),r=envelope(series,s,'review'),pending={version:1,activity:series.P.ACTIVITY,kind:'pending-final',payload:{reviewJson:JSON.stringify(r),score:r.score,maxScore:100,passed:r.passed}};for(const x of [d,r,pending])assert(Data.bytes(x)<=4000,Data.bytes(x));console.log('D3 '+phase+' bytes:',Data.bytes(d),Data.bytes(r),Data.bytes(pending));}
for(const t of tasks){
 const full=t===series?perfect:correct;assert.equal(t.S.score(t.P.fresh()).score,0);
 for(const sample of [t.P.fresh(),full])for(const phase of ['edit','check'])for(let question=0;question<t.Q.count;question++){
  const s=t.P.validate({...sample,phase,...(t.Q.count>1?{question}:{})});const e=environment(t,{durable:draft(t,s)});assert.equal(e.c.mode,phase);assert.deepEqual(e.c.state,s);assert.deepEqual(t.P.document(t.P.decode(envelope(t,s),'draft')),t.P.document(s));
  if(phase==='check')e.c.edit();if(t.Q.count>1)e.c.reason(question===0?-1:1);else{const d=t.P.document(e.c.state);if(d.wires.length<4){M.addWire(d,300,400);e.c.updateDocument(d);}}
  e.c.check();e.c.submit();assert.equal(e.c.mode,'review');assert.equal(e.c.editable,false);assert.equal(e.c.updateDocument(t.P.document(e.c.state)),false);const resumed=environment(t,{durable:e.durable});assert.equal(resumed.c.mode,'review');assert.equal(resumed.c.result.score,e.c.result.score);assert.equal(resumed.stats.writes,0);
 }
 for(const [flag,value,mode]of [['writeFail','cmi.core.score.raw','frozen'],['commitFail',true,'frozen'],['finishFail',true,'committed'],['writeFail','cmi.suspend_data','frozen']]){
  const e=environment(t,{durable:draft(t,full)});e.c.check();e.flags[flag]=value;e.c.submit();assert.equal(e.c.mode,mode);if(mode==='frozen')assert.equal(e.c.result,null);e.flags[flag]=false;if(mode==='check')e.c.submit();else e.c.retryFinal();assert.equal(e.c.mode,'review');assert.equal(e.c.result.score,100);
 }
 const pending=environment(t,{durable:draft(t,full)});pending.c.check();pending.flags.writeFail='cmi.core.score.raw';pending.c.submit();const resumed=environment(t,{durable:M.clone(pending.durable)});assert.equal(resumed.c.mode,'frozen');resumed.c.navigate(t.Q.count-1);resumed.c.retryFinal();assert.equal(resumed.c.mode,'review');assert.equal(resumed.c.result.score,100);
 for(const mutation of [r=>r.score--,r=>r.answer.revision++,r=>r.answer.extra=1,r=>r.passed=1]){const d=M.clone(pending.durable),p=JSON.parse(d['cmi.suspend_data']),r=JSON.parse(p.payload.reviewJson);mutation(r);p.payload.reviewJson=JSON.stringify(r);d['cmi.suspend_data']=JSON.stringify(p);const e=environment(t,{durable:d});assert.equal(e.c.mode,'technical');assert.equal(e.stats.writes,0);e.events.pagehide({persisted:false});assert.equal(e.stats.writes,0);assert.equal(e.scorm.retryPending().reason,'no-pending');}
 for(const mutate of [d=>d['cmi.core.score.raw']='11',d=>d['cmi.suspend_data']='broken',d=>d['cmi.core.lesson_status']='completed']){const d=M.clone(resumed.durable);mutate(d);const e=environment(t,{durable:d});assert.equal(e.c.mode,'mismatch');assert.equal(e.stats.writes,0);assert.equal(e.c.editable,false);}
 for(const flags of [{readFail:'cmi.suspend_data'},{initFail:true}])assert.equal(environment(t,{flags}).c.mode,'technical');
 const invalid=envelope(t,full);invalid.answer.revision=999;const e=environment(t,{durable:{'cmi.suspend_data':JSON.stringify(invalid)}});assert.equal(e.c.mode,'technical');assert.equal(e.stats.writes,0);e.events.pagehide({persisted:false});assert.equal(e.stats.writes,0);
 const save=environment(t);save.flags.commitFail=true;save.c.check();assert.equal(save.c.unsaved,true);save.c.submit();assert.equal(save.c.mode,'check');save.flags.commitFail=false;save.c.retrySave();save.c.submit();assert.equal(save.c.mode,'review');assert.equal(save.c.result.score,0);
 const local=environment(t,{standalone:true});local.c.check();local.c.submit();assert.equal(local.c.mode,'review');assert.equal(local.stats.storage,0);assert.deepEqual(environment(t,{standalone:true}).c.state,t.P.fresh());
 for(const retryable of [true,false]){const e=environment(t);e.c.check();e.c.handleOutcome({activityState:'retry',retryable});assert.equal(e.c.mode,retryable?'check':'technical');}
 const leave=environment(t,{durable:draft(t,full)});leave.events.pagehide({persisted:false});assert.equal(environment(t,{durable:leave.durable}).c.result,null);
}
for(const phase of ['edit','check']){const e=environment(series,{durable:draft(series,{...worstAnswer,phase})});e.c.check();e.flags.writeFail='cmi.core.score.raw';e.c.submit();const actual=JSON.parse(e.durable['cmi.suspend_data']);assert.equal(actual.kind,'pending-final');assert(Data.bytes(actual)<=4000);const resumed=environment(series,{durable:M.clone(e.durable)});assert.equal(resumed.c.mode,'frozen');resumed.c.retryFinal();assert.equal(resumed.c.mode,'review');assert.equal(resumed.c.result.score,0);}
for(const n of [0,97,1.5])assert.throws(()=>F.compile({...series.Q.config(),wirePointLimit:n}));
for(const s of ['A','AA==','AAAA','//////////8='])assert.throws(()=>Data.unpack(s,16));
console.log('Assessed circuit scoring, lossless geometry, size, profile and real shared SCORM lifecycle passed.');
