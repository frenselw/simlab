'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {protectionBudgetCases}=require('./circuit-protection-budget-browser-cases');
async function exercise(liveLongTask,screenshots=[],pausedLongTask=0,delivered=false){
 let observer,clock=0,paused=true,session;
 const listeners=[];
 class Session{
  constructor(){this.state={time:0};this.protectionHistory=new Map([['c1',{measure:()=>({currentStatus:'ready',currentRms:1})}]]);}
  advance(duration){this.state.time+=duration;return {};}
 }
 class Observer{
  constructor(callback){this.callback=callback;this.active=false;this.records=[];observer=this;}
  observe(){this.active=true;}disconnect(){this.active=false;}
  takeRecords(){const records=this.records;this.records=[];return records;}
  emit(duration){if(this.active){const entry={startTime:clock,duration};if(delivered)this.callback({getEntries:()=>[entry]});else this.records.push(entry);}}
 }
 const context={performance:{now:()=>++clock},PerformanceObserver:Observer,CircuitTransient:{Session},
  CircuitRenderer:{scene(){},flow(){},body(){}},CircuitFieldGraphics:{transformer(){}},
  document:{addEventListener:(_type,listener)=>listeners.push(listener)},
  CircuitACWorkbench:{getPlayback:()=>({paused}),captureSession:()=>{observer?.emit(150);return {physics:{time:session.state.time}};}}};
 context.window=context;vm.createContext(context);
 const input=selector=>{
  for(const listener of listeners)listener({timeStamp:clock,isTrusted:true});
  if(selector.includes('pause'))paused=!paused;
  if(!paused){session.advance(.016,{budget:10});observer?.emit(liveLongTask);}
 };
 const h={inside:async code=>vm.runInContext(code,context),
  call:async code=>{if(code.startsWith('loadDocument(')){session=new Session();return;}
   if(code.startsWith('setPlayback(')){paused=true;return;}
   if(code.startsWith('advanceTime(')){session.advance(.99);return;}
   if(code==='getAnalysis()')return {diagnostics:[]};
   if(code==='getAnalysis().diagnostics.length')return 0;throw Error('Unexpected call: '+code);},
  send:async(name,args)=>{if(name==='Input.dispatchMouseEvent'&&args.type==='mousePressed')input('surface');},
  point:async selector=>({x:100,y:100,selector}),click:async selector=>input(selector),
  touch:async point=>input(point.selector||'surface'),delay:async ms=>{if(ms===150)observer?.emit(pausedLongTask);},screenshot:async name=>screenshots.push(name)};
 return protectionBudgetCases(h,'fixture');
}
async function main(){
 const original=console.log;console.log=()=>{};
 try{
  assert.equal(await exercise(60),48,'150ms test-only snapshot work must not contaminate the live input budget');
  const screenshots=[];
  await assert.rejects(exercise(113,screenshots),/113/,'a real live-window long task still violates the unchanged 100ms gate');
  assert.equal(screenshots.length,1,'the failing budget case preserves its actual screen before rejecting it');
  await assert.rejects(exercise(60,[],113),/113/,'post-pause production work retains the original long-task gate');
  await assert.rejects(exercise(113,[],0,true),/113/,'already delivered long tasks cannot disappear during draining');
 }finally{console.log=original;}
 console.log('Protection budgets retain live long-task failures and exclude test snapshot serialization.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
