'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),M=require('../sim/circuit-workbench/circuit-model'),P=require('../sim/circuit-workbench/circuit-ac-presets');
async function protectionBudgetCases(h,source){let checks=0;const evidence=[];
 for(const width of [1280,390])for(const L of [2,1,.5]){
  await h.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});await h.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});const d=P.create('coupled');d.components.find(c=>c.type==='transformer').params.inductance=L;
  await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('setPlayback({paused:true})');await h.call('advanceTime(.99)');
  await h.inside(`if(!window.__advanceBudgetBase){__advanceBudgetBase=CircuitTransient.Session.prototype.advance;CircuitTransient.Session.prototype.advance=function(duration,options){const start=performance.now(),r=__advanceBudgetBase.call(this,duration,options);if(options?.budget!==undefined)__budgetCalls.push({elapsed:performance.now()-start,budget:options.budget,time:this.state.time,pending:!!this.protectionJob});const probeStart=performance.now();for(const [id,t]of this.protectionHistory){const m=t.measure(id);if(m.currentStatus==='ready')__maxAcceptedRms=Math.max(__maxAcceptedRms,m.currentRms);}__budgetProbeCosts.push(performance.now()-probeStart);return r;};document.addEventListener('pointerdown',e=>{if(window.__reactionTimes)__reactionTimes.push({delay:performance.now()-e.timeStamp,trusted:e.isTrusted});},true);}if(!window.__profileOriginal){__profileOriginal=[];for(const [object,key]of [[CircuitRenderer,'scene'],[CircuitRenderer,'flow'],[CircuitRenderer,'body'],[CircuitFieldGraphics,'transformer'],[CircuitTransient.Session.prototype,'read']]){const original=object[key];__profileOriginal.push([object,key,original]);object[key]=function(...args){const start=performance.now(),result=original.apply(this,args),q=__profiles[key]||(__profiles[key]={max:0,sum:0,count:0});const duration=performance.now()-start;q.max=Math.max(q.max,duration);q.sum+=duration;q.count++;return result;};}}window.__profiles={};window.__budgetCalls=[];window.__budgetProbeCosts=[];window.__maxAcceptedRms=0;window.__reactionTimes=[];window.__longTasks=[];window.__longTaskDetails=[];window.__budgetObservedStart=performance.now();window.__budgetObservationWindows=[{phase:"playback-and-input",start:__budgetObservedStart,end:null}];window.__longObserver?.disconnect();window.__longObserver=new PerformanceObserver(list=>{const entries=list.getEntries();__longTasks.push(...entries.map(e=>e.duration));__longTaskDetails.push(...entries.map(e=>({start:e.startTime,duration:e.duration})));});__longObserver.observe({type:'longtask'});`);
  const tap=async selector=>width<600?h.touch(await h.point(selector)):h.click(selector);
  await tap('[data-circuit-id=pause]');await tap('[data-circuit-id=pan]');const stage=await h.point('[data-circuit-id=surface]');if(width<600)await h.touch(stage,25,15);else{await h.send('Input.dispatchMouseEvent',{type:'mousePressed',...stage,button:'left',buttons:1,clickCount:1});for(let n=1;n<=6;n++){await h.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:stage.x+25*n/6,y:stage.y+15*n/6,button:'left',buttons:1});await h.delay(20);}await h.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:stage.x+25,y:stage.y+15,button:'left',buttons:0,clickCount:1});}await tap('[data-circuit-id=pan]');await tap('[data-circuit-id=pause]');
  assert.equal(await h.inside('CircuitACWorkbench.getPlayback().paused'),true);
  // Keep test snapshot serialization out of both live and paused-work budgets.
  const finishObservation='{const entries=__longObserver.takeRecords();__longTasks.push(...entries.map(e=>e.duration));__longTaskDetails.push(...entries.map(e=>({start:e.startTime,duration:e.duration})));window.__budgetObservedEnd=performance.now();__budgetObservationWindows.at(-1).end=__budgetObservedEnd;__longObserver.disconnect();}';
  await h.inside(finishObservation);
  const frozen=await h.inside('(()=>{const start=performance.now(),physics=CircuitACWorkbench.captureSession().physics;window.__budgetSnapshotCosts=[performance.now()-start];return physics;})()');
  await h.inside('__budgetObservationWindows.push({phase:"paused-background",start:performance.now(),end:null});__longObserver.observe({type:"longtask"});');
  await h.delay(150);await h.inside(finishObservation);
  assert.deepEqual(await h.inside('(()=>{const start=performance.now(),physics=CircuitACWorkbench.captureSession().physics;__budgetSnapshotCosts.push(performance.now()-start);return physics.time;})()'),frozen.time);checks+=2;
  // Pausing freezes physical time; feedback has no private future work.
  await h.call('getAnalysis()');assert.equal(await h.call('getAnalysis().diagnostics.length'),0);assert(await h.inside('Number.isFinite(__maxAcceptedRms)'));checks+=2;
  const stats=await h.inside('({calls:__budgetCalls,events:__reactionTimes,longTasks:__longTasks,longTaskDetails:__longTaskDetails,observedStart:__budgetObservedStart,observedEnd:__budgetObservedEnd,observationWindows:__budgetObservationWindows,snapshotCosts:__budgetSnapshotCosts,probeCosts:__budgetProbeCosts,maxRms:__maxAcceptedRms,profiles:__profiles})');await h.screenshot(source+'-protection-budget-'+L+'-'+width);assert(stats.calls.length>0,'real playback exercised finite-budget physical integration');assert(Math.max(...stats.calls.map(c=>c.elapsed))<80,JSON.stringify(stats));assert(stats.events.length>=4&&stats.events.every(e=>e.trusted&&e.delay<100),JSON.stringify({source,width,L,events:stats.events,longTasks:stats.longTasks,maxAdvance:Math.max(...stats.calls.map(c=>c.elapsed))}));assert(!stats.longTasks.some(t=>t>=100),JSON.stringify({source,width,L,profiles:stats.profiles,longTaskDetails:stats.longTaskDetails,observedStart:stats.observedStart,observedEnd:stats.observedEnd,observationWindows:stats.observationWindows,snapshotCosts:stats.snapshotCosts,probeCosts:stats.probeCosts,maxAdvance:Math.max(...stats.calls.map(c=>c.elapsed)),longTasks:stats.longTasks,events:stats.events}));checks+=4;
  evidence.push({source,width,L,maxAdvance:Math.max(...stats.calls.map(c=>c.elapsed)),maxReaction:Math.max(...stats.events.map(e=>e.delay)),longTasks:stats.longTasks,longTaskDetails:stats.longTaskDetails,observationWindows:stats.observationWindows,snapshotCosts:stats.snapshotCosts,probeCosts:stats.probeCosts,maxRms:stats.maxRms});
 }
 await h.inside('for(const [object,key,original]of __profileOriginal)object[key]=original;__profileOriginal=null;CircuitTransient.Session.prototype.advance=__advanceBudgetBase;__advanceBudgetBase=null;__reactionTimes=null;');
 console.log(source+' full-workbench protection budgets',JSON.stringify(evidence));return checks;
}
function comparison(count,status){const d=M.empty('transient');for(let n=0;n<count;n++){const a=M.add(d,'ac-source',100+n%2*400,180+Math.floor(n/2)*260,{protectionEnabled:true,phase:status==='limited'?90:0,maxCurrent:status==='limited'?.2:1}),r=M.add(d,'resistor',300+n%2*400,180+Math.floor(n/2)*260);for(const p of ['a','b'])M.connect(d,a.id+':'+p,r.id+':'+p);if(status==='tripped')M.connect(d,a.id+':a',a.id+':b');}return d;}
async function sessionCapacityCases(h,source){let checks=0;const directory=path.resolve(__dirname,'../output/playwright/circuit-ac/session-files');fs.mkdirSync(directory,{recursive:true});
 await h.inside(`window.__createObjectURLBase=window.__createObjectURLBase||URL.createObjectURL;URL.createObjectURL=function(blob){window.__savedSessionBlob=blob;return __createObjectURLBase.call(URL,blob);};document.addEventListener('click',e=>{if(e.target.closest('a[href^="blob:"]'))e.preventDefault();},true);`);
 async function reopen(saved,tag){
   await h.inside('(()=>{const input=document.querySelector("[data-circuit-id=fileInput]");if(!input.__openBase){input.__openBase=input.onchange;input.onchange=async function(e){await this.__openBase(e);window.__sessionOpenFinished=true;};}window.__sessionOpenFinished=false;})()');
   await h.click('[data-circuit-id=save]');const text=await h.inside('__savedSessionBlob.text()');assert.equal(text,JSON.stringify(saved));const file=path.join(directory,`${source}-${tag}.json`);fs.writeFileSync(file,text);
   const root=await h.send('DOM.getDocument'),input=await h.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'[data-circuit-id=fileInput]'});await h.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});await h.inside('new Promise((resolve,reject)=>{const deadline=performance.now()+5000;function check(){if(window.__sessionOpenFinished)return resolve();if(performance.now()>deadline)return reject(Error("file open timed out"));setTimeout(check,20);}check();})');assert((await h.call('getInteraction().lastMessage')).includes('已開啟電路檔'));assert.deepEqual(await h.call('captureSession()'),saved,'native open keeps all authority');
   const reference=await h.inside(`(()=>{const s=CircuitTransient.Session.restore(${JSON.stringify(saved)});s.advance(.123);return s.capture();})()`);await h.call('advanceTime(.123)');assert.deepEqual((await h.call('captureSession()')).physics,reference.physics);assert.deepEqual((await h.call('captureSession()')).protectionHistory,reference.protectionHistory);checks+=6;return Buffer.byteLength(text);
 }
 for(const time of [.1,1.1,5])for(const type of ['resistor','capacitor','ac-voltmeter']){
  const d=M.empty('transient');M.add(d,'ac-source',100,100,{protectionEnabled:true});await h.call('loadDocument('+JSON.stringify(d)+')');await h.call('setPlayback({paused:true})');await h.call('advanceTime('+time+')');
  await h.call('execute({type:"addComponent",key:'+JSON.stringify(type)+',x:400,y:240})');let saved=await h.call('captureSession()');assert.equal(saved.physics.time,0);assert.equal(saved.physics.protection.c1.reviewAt,.02);checks+=2;await reopen(saved,'restart-'+type+'-'+time+'-add');
  await h.call('execute({type:"remove",id:"c2"})');saved=await h.call('captureSession()');assert.equal(saved.physics.time,0);assert.equal(saved.physics.protection.c1.reviewAt,.02);checks+=2;await reopen(saved,'restart-'+type+'-'+time+'-remove');
 }
 for(const status of ['normal','limited','tripped'])for(const count of status==='normal'?[1,2,3,4,6]:[1,2,3,4]){
  await h.call('loadDocument('+JSON.stringify(comparison(count,status))+')');await h.call('setPlayback({paused:true})');
  for(const time of [.1,1.1,5.2]){const now=await h.call('getAnalysis().time');await h.call('advanceTime('+(time-now)+')');const saved=await h.call('captureSession()');assert(Object.values(saved.physics.protection).every(q=>q.status===status));
   const bytes=await reopen(saved,`${status}-${count}-${time}`);if(count<=4)assert(bytes<M.limits.bytes);else if(time>=1.1)assert(bytes>M.limits.bytes,'native open accepts the larger session limit');
  }
 }
 console.log(source+' capacity export/native-open/continuation:',checks,'checks');return checks;
}
async function controlRepaintCases(h,source){
 await h.send('Page.bringToFront');assert.equal(await h.inside('document.hidden'),false);
 await h.send('Emulation.setDeviceMetricsOverride',{width:1280,height:844,deviceScaleFactor:1,mobile:false});
 await h.send('Emulation.setTouchEmulationEnabled',{enabled:false});await h.call('setPlayback({paused:true})');
 await h.inside('document.fonts.ready');await h.inside('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const documentBefore=await h.call('exportDocument()'),physicsBefore=(await h.call('captureSession()')).physics;let checks=0;
  assert.equal((await h.call('getDocument()')).display.potential,false);
  await h.inside('window.__hiddenLegendWrites=0;window.__legendElement=document.querySelector("[data-circuit-id=potentialLegend]");window.__legendObserver=new MutationObserver(records=>{__hiddenLegendWrites+=records.filter(r=>r.target!==__legendElement).length;});__legendObserver.observe(__legendElement,{subtree:true,childList:true,characterData:true,attributes:true});');
 assert.equal((await h.call('getObservationTools()')).length,0);
 await h.inside('(()=>{const e=document.querySelector("[data-circuit-id=surface]");window.__emptyScopeRects=0;e.__controlRectBase=e.getBoundingClientRect;e.getBoundingClientRect=function(...args){__emptyScopeRects++;return this.__controlRectBase.apply(this,args);};return null;})()');
 try{await h.inside('new Promise(r=>{let left=3;function tick(){if(--left===0)r();else requestAnimationFrame(tick);}requestAnimationFrame(tick);})');assert.equal(await h.inside('__emptyScopeRects'),0,'an empty scope does not read surface geometry on animation frames');checks++;}
 finally{await h.inside('(()=>{const e=document.querySelector("[data-circuit-id=surface]");delete e.getBoundingClientRect;delete e.__controlRectBase;})()');}
 await h.inside('window.__controlSceneBase=CircuitRenderer.scene;window.__controlScenePaints=0;CircuitRenderer.scene=function(...args){__controlScenePaints++;return __controlSceneBase.apply(this,args);};');
 try{
  await h.call('setPlayback({paused:true})');assert.equal(await h.inside('__controlScenePaints'),1,'playback changes repaint once after cancelling interaction');checks++;
  for(const [button,flag]of [['pan','panMode'],['probe','probeMode'],['pickWire','wireMode']])for(const expected of [true,false]){
   const before=await h.inside('__controlScenePaints');await h.click('[data-circuit-id='+button+']');
   assert.equal(await h.inside('__controlScenePaints'),before+1,button+' native click repaints once');
   assert.equal((await h.call('getInteraction()'))[flag],expected,button+' retains its toggle');checks+=2;
  }
  assert.equal(await h.inside('__hiddenLegendWrites'),0,'hidden potential legend must not rebuild on every control repaint');checks++;
  await h.click('[data-circuit-id=potential]');assert.equal((await h.call('getDocument()')).display.potential,true);assert(await h.inside('!__legendElement.hidden&&__hiddenLegendWrites>0'),'showing potential still refreshes the legend');checks++;
  await h.click('[data-circuit-id=potential]');assert.equal((await h.call('getDocument()')).display.potential,false);checks++;
  assert.equal(await h.call('exportDocument()'),documentBefore);assert.deepEqual((await h.call('captureSession()')).physics,physicsBefore);checks+=2;
 }catch(error){await h.screenshot(source+'-control-repaint-failure');throw error;}
 finally{await h.inside('CircuitRenderer.scene=__controlSceneBase;delete window.__controlSceneBase;__legendObserver.disconnect();delete window.__legendObserver;delete window.__legendElement;');}
 console.log(source+' single control repaint:',checks,'checks passed');return checks;
}
module.exports={protectionBudgetCases,sessionCapacityCases,controlRepaintCases};
