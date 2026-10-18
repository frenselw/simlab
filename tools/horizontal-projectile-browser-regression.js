#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {XMLParser}=require('fast-xml-parser');
const H=require('./position-time-browser-regression.js');
const M=require('../sim/horizontal-projectile-lab/model.js'),P=require('../sim/horizontal-projectile-lab/persistence.js'),T=require('../sim/horizontal-projectile-lab/test-support.js');
const root=path.resolve(__dirname,'..'),slug=P.ACTIVITY,out=path.join(root,'output/playwright',slug);
const report={errors:[],flows:[],layouts:[],gestures:[],completed:false};
let cdp,chrome,profile,extracted,server,acceptDialog=true;
const call=code=>H.evaluate(cdp,`(()=>{const w=window,d=document,app=w.__projectileApp;${code}})()`);
const wait=async(fn,label)=>{for(let i=0;i<160;i++){try{if(await fn())return;}catch(_){}await H.delay(35);}throw Error('Timeout: '+label);};
async function viewport(width,height){await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});}
async function preload(){await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const p=new URLSearchParams(location.search);Math.random=()=>.65;
  if(p.has('deny'))Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});
  if(p.has('fixture')){const durable=JSON.parse(p.get('fixture')),values={...durable};let error='0';window.__lmsValues=durable;window.__failFinal=false;window.__failFinish=false;
    window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>(error='0',values[k]||''),LMSSetValue:(k,v)=>{if(window.__failFinal&&k==='cmi.core.score.raw'){error='351';return 'false';}values[k]=String(v);error='0';return 'true';},LMSCommit:()=>{Object.assign(durable,values);return 'true';},LMSFinish:()=>window.__failFinish?'false':'true',LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};}
})();`});}
async function open(base,state=null,standalone=false,extra=''){
  const values=state?{'cmi.core.lesson_status':'incomplete','cmi.suspend_data':JSON.stringify(T.snapshot(state))}:{'cmi.core.lesson_status':'not attempted'};
  const query=standalone?extra:'fixture='+encodeURIComponent(JSON.stringify(values))+extra;
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?${query}`});
  await wait(()=>call("return Boolean(app?.getState())&&d.readyState==='complete';"),'startup');await H.delay(90);
}
async function click(selector,trusted=false){
  if(!trusted){await call(`const e=d.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});e.click();`);}
  else{const p=await rect(selector);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:p.x,y:p.y});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:p.x,y:p.y});}
  await H.delay(20);
}
async function input(selector,value){await call(`const e=d.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable input '+${JSON.stringify(selector)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));`);}
async function rect(selector){return call(`const e=d.querySelector(${JSON.stringify(selector)});if(!e||!e.getClientRects().length)throw Error('Missing target '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};`);}
const state=()=>call('return app.getState();');
async function shot(depth){
  await call(`const target=${depth};while(app.getState().setup.depthMm!==target){d.getElementById(app.getState().setup.depthMm<target?'depthDown':'depthUp').click();}`);
  await click('#release',true);await wait(()=>call('return !app.isRunning();'),'shot');
}
async function completeFlow(base,label){
  await viewport(1000,800);await open(base);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const depth of[50,150,300,450,650,800])await shot(depth);
  const recorded=await state();assert.equal(recorded.rows.filter(Boolean).length,6);
  await screenshot(label+'-apparatus');await click('#next');
  for(let i=0;i<6;i++){const row=recorded.rows[i],p=M.impact(row.depthMm,row.speedOffsetPpm);await input(`#read-x-${i}`,Math.round(p.x)/10);await input(`#read-y-${i}`,row.depthMm/10);}
  await click('#next');
  for(let i=0;i<6;i++){await input('#plotSlot',i);await click('#keyboardPoint');const r=(await state()).rows[i];await input('#pointX',r.read[0]/10);await input('#pointY',r.read[1]/10);}
  await input('#fitModel','quadratic');await click('#fitButton');assert(await call('return ProjectileModel.fit(app.getState()).ok;'));
  assert(await call('return d.getElementById("fitResult").textContent.includes("以 m 表示")&&d.getElementById("fitResult").textContent.includes("以 cm 表示");'));
  await input('#trajectory','parabola');await input('#fitModel','square');await click('#fitButton');await screenshot(label+'-trajectory');await click('#next');
  for(let i=0;i<6;i++){const r=(await state()).rows[i],t=Number(Math.sqrt(2*r.read[1]/1000/M.G).toFixed(3));await input(`#calc-t-${i}`,t);await input(`#calc-v-${i}`,Number((r.read[0]/1000/t).toFixed(3)));}
  const s=await state();await input('#meanV',Number(M.mean(s.calculations.map(c=>c.v)).toFixed(3)));await input('#fitV',Number(Math.sqrt(M.G/(2*M.fit(s).coefficients[0])).toFixed(3)));
  await click('#next');await click('#showClock');const q=await state();await input('#gFromClock',Number((2*M.timeFit(q,1).coefficients[0]).toFixed(3)));
  for(const value of['uniform','linear-x-time','free-fall','quadratic-y-time-zero-initial'])await click(`input[value="${value}"]`);
  assert.deepEqual((await state()).rows.map(r=>r.speedOffsetPpm),recorded.rows.map(r=>r.speedOffsetPpm));
  await click('#timeY');assert(await call('return d.getElementById("timeFitResult").textContent.includes("以 s 表示");'));await screenshot(label+'-time');await click('#checkButton');await click('#submitButton');
  assert.equal(await call('return app.controller.result.score;'),100);assert.equal(await call("return w.__lmsValues['cmi.core.score.raw'];"),'100');
  assert.equal(await call('return app.controller.mode;'),'review');assert.equal(await call("return Boolean(d.querySelector('#clearAll').getClientRects().length);"),false);
  report.flows.push({label,kind:'six-point-complete',score:100,ppm:recorded.rows.map(r=>r.speedOffsetPpm)});
}
async function screenshot(name){const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
async function layoutMatrix(base,label){
  for(const [width,height]of[[320,500],[390,500],[390,600],[390,844],[900,650],[1280,800],[640,400],[667,375],[320,400],[320,225]]){
    await viewport(width,height);
    for(const view of M.VIEWS){const s=T.filled();s.view=view;await open(base,s);
      const metrics=await call(`const panel=d.getElementById('controlPanel'),p=panel.getBoundingClientRect(),root=d.scrollingElement,button=d.getElementById('fullscreenButton').getBoundingClientRect();panel.scrollTop=panel.scrollHeight;return{rootRange:root.scrollHeight-root.clientHeight,rootX:root.scrollWidth-root.clientWidth,panel:[p.top,p.bottom,p.height],viewport:w.innerHeight,lastReachable:panel.scrollTop>=panel.scrollHeight-panel.clientHeight-1,fullscreen:[button.left,button.top,button.right,button.bottom]};`);
      assert(metrics.rootRange<=1&&metrics.rootX<=1,JSON.stringify({label,width,height,view,metrics}));assert(metrics.panel[2]>=95&&metrics.panel[0]>=-1&&metrics.panel[1]<=height+1,JSON.stringify({width,height,view,metrics}));assert(metrics.lastReachable);
      assert(metrics.fullscreen[0]>=0&&metrics.fullscreen[2]<=width+1&&metrics.fullscreen[3]<=height,JSON.stringify({label,width,height,view,metrics}));
      report.layouts.push({label,width,height,view,...metrics});
    }
  }
  await viewport(390,600);const s=T.filled();s.view='measure';await open(base,s);await screenshot(label+'-phone');
}
async function flows(base,label){
  for(const view of M.VIEWS){const s=M.fresh();s.view=view;await open(base,s);await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);}
  await open(base,T.filled());await click('#checkButton');await call('w.__failFinal=true;');await click('#submitButton');assert.equal(await call('return app.controller.mode;'),'frozen');assert.equal(await call('return app.controller.result;'),null);
  const pending=await call("return JSON.parse(w.__lmsValues['cmi.suspend_data']);");assert.equal(pending.kind,'pending-final');
  const frozenValues=await call('return w.__lmsValues;');await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(frozenValues))}`});await wait(()=>call("return app?.controller.mode==='frozen';"),'pending resume');await click('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base,T.filled());await click('#checkButton');await call('w.__failFinish=true;');await click('#submitButton');assert.equal(await call('return app.controller.mode;'),'committed');await call('w.__failFinish=false;');await click('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  const partial=T.filled();partial.view='speed';await open(base,partial);const original=await state();const saved=await call('return w.__lmsValues;');
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(saved))}`});await wait(()=>call('return Boolean(app?.getState());'),'resume');assert.deepEqual(await state(),original);
  const review=T.snapshot(T.filled(),'review'),values={'cmi.core.lesson_status':'passed','cmi.core.score.raw':'100','cmi.suspend_data':JSON.stringify(review)};
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(values))}`});await wait(()=>call("return app?.controller.mode==='review';"),'review restore');assert.equal(await call('return app.controller.trusted;'),true);
  for(const checkpoint of['partial','check','submitted']){
    await open(base,null,true,'deny=1');await shot(200);
    if(checkpoint!=='partial')await click('#checkButton');if(checkpoint==='submitted')await click('#submitButton');
    await cdp.send('Page.reload',{});await wait(()=>call("return app?.controller.mode==='edit';"),'standalone fresh');assert.equal((await state()).rows.filter(Boolean).length,0);
  }
  report.flows.push({label,kind:'blank-each-view/pending/finish/resume/finished/standalone-denied-storage',passed:true});
}
async function edgeFlows(base,label){
  for(const kind of['blocked','unsupported'])for(const height of[225,500]){
    await viewport(320,height);await open(base);
    await call(kind==='blocked'?'Object.defineProperty(d,"fullscreenEnabled",{value:false});':'for(const key of ["requestFullscreen","webkitRequestFullscreen"])Object.defineProperty(d.getElementById("app"),key,{value:undefined});');
    await click('#fullscreenButton',true);
    const metrics=await call('const p=d.getElementById("controlPanel").getBoundingClientRect(),s=d.getElementById("fullscreenStatus");return{bottom:p.bottom,height:p.height,viewport:innerHeight,error:s.dataset.fullscreenError,visible:!s.hidden&&s.getBoundingClientRect().height>0};');
    assert.equal(metrics.error,kind);assert(metrics.visible);assert(metrics.height>=95&&metrics.bottom<=height+1,JSON.stringify({kind,height,metrics}));
  }
  await viewport(390,600);await open(base);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await click('#release',true);assert(await call('return app.isRunning()&&["depthUp","depthDown","recordSlot","catcherHandle"].every(id=>d.getElementById(id).disabled);'));
  const original=await state();await call('d.getElementById("catcherHandle").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown"}));');assert.deepEqual(await state(),original);
  await click('#checkButton');assert.equal(await call('return app.isRunning();'),false);assert.equal((await state()).rows.filter(Boolean).length,0);
  await click('[data-go="collect"]');assert.equal(await call('return d.getElementById("depthDown").disabled;'),false);
  await click('#release',true);await viewport(390,500);await H.delay(90);assert.equal(await call('return app.isRunning();'),false);assert.equal((await state()).rows.filter(Boolean).length,0);assert.equal(await call('return d.getElementById("depthDown").disabled;'),false);
  await shot(200);assert.equal((await state()).rows[0].clockMs,M.impact(200,0).clockMs);
  const s=T.filled();s.view='measure';s.selectedSlot=0;await open(base,s);const before=await state();
  await click('#readingZoom');assert.equal(await call('return d.getElementById("magnifier").hidden;'),false);assert.deepEqual(await state(),before);
  await click('#rulerY');assert.equal(await call('return d.getElementById("magnifier").hidden;'),false);await screenshot(label+'-reading-zoom');await click('#next');assert.equal(await call('return d.getElementById("magnifier").hidden;'),true);
  await click('#checkButton');await click('[data-go="collect"]');const old=await state();acceptDialog=false;await click('#release');assert.deepEqual(await state(),old);assert.equal(await call('return app.isRunning();'),false);
  await click('#clearAll');assert.deepEqual(await state(),old);acceptDialog=true;await click('#clearAll');assert.equal((await state()).rows.filter(Boolean).length,0);
  await click('#checkButton');await click('[data-go="motion"]');await click('#showClock');await click('input[value="uniform"]');await click('#checkButton');await click('[data-go="collect"]');await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await shot(200);assert((await state()).clockShown);assert.equal((await state()).conclusions.horizontal,'uniform');
  const large=T.filled();large.view='speed';await open(base,large);await input('#calc-t-0',.001);await input('#calc-v-0',500);await input('#meanV',Number.MAX_VALUE);assert.equal((await state()).calculations[0].v,500);
  await click('#checkButton');assert(await call('return !d.getElementById("checkSummary").textContent.includes("Infinity")&&d.getElementById("checkSummary").textContent.includes("1.7977e+308");'));await click('[data-go="speed"]');
  const values=await call('return w.__lmsValues;');await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(values))}`});await wait(()=>call('return app?.getState()?.calculations[0].v===500;'),'large speed resume');assert.equal((await state()).meanV,Number.MAX_VALUE);
  const negative=M.fresh();[50,200,450].forEach((depth,i)=>{negative.rows[i]={depthMm:depth,speedOffsetPpm:0,clockMs:M.impact(depth,0).clockMs,read:[null,[300,280,220][i]],point:null};});negative.view='motion';negative.clockShown=true;await open(base,negative);const g=2*M.timeFit(negative,1).coefficients[0];await input('#gFromClock',g);assert.equal((await state()).gFromClock,g);await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.detail.find(x=>x.name==="由時間擬合換算加速度 / m/s²").points;'),3);
  await open(base,negative);await input('#gFromClock',-Number.MAX_VALUE);await click('#checkButton');await click('#submitButton');assert.equal((await state()).gFromClock,-Number.MAX_VALUE);assert(await call('return !d.getElementById("feedbackList").textContent.includes("Infinity")&&d.getElementById("feedbackList").textContent.includes("-1.7977e+308");'));
  report.flows.push({label,kind:'flight-lock/cancel/resize/ruler-reading-zoom/confirm-cancel/clear/zero-observation-continuation/large-speed/negative-g',passed:true});
}
async function touchDrag(selector,dx,dy,ending='touchEnd'){
  const start=await rect(selector),before=await state(),metricsBefore=await call('return {page:scrollY,panel:d.getElementById("controlPanel").scrollTop,diag:app.getDiagnostics()};');
  const p=(x,y,id=91)=>({x,y,id,radiusX:2,radiusY:2,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(start.x,start.y)]});
  for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p(start.x+dx*i/6,start.y+dy*i/6)]});await H.delay(15);}
  const preview=await call('return !d.getElementById("magnifier").hidden;');
  await cdp.send('Input.dispatchTouchEvent',{type:ending,touchPoints:[]});await H.delay(90);
  const after=await state(),metricsAfter=await call('return {page:scrollY,panel:d.getElementById("controlPanel").scrollTop,diag:app.getDiagnostics()};');
  assert.equal(metricsBefore.page,metricsAfter.page);assert.equal(metricsBefore.panel,metricsAfter.panel);assert(metricsAfter.diag.trustedTouch>metricsBefore.diag.trustedTouch);
  assert.equal(await call('return d.getElementById("magnifier").hidden;'),true);
  if(ending==='touchCancel')assert.deepEqual(after,before);else {assert.notDeepEqual(after,before);assert(metricsAfter.diag.ups>metricsBefore.diag.ups);assert.equal(metricsAfter.diag.cancels,metricsBefore.diag.cancels);}
  return{selector,ending,preview,metricsBefore,metricsAfter};
}
async function interactions(base,label){
  await viewport(390,600);
  const first=M.change(M.fresh(),{type:'record',slot:0,depthMm:200,ppm:0});first.view='plot';first.rows[0].read=[300,200];await open(base,first);await click('#placePoint');
  const centre=await call('const g=app.getGeometry(),r=d.getElementById("stage").getBoundingClientRect();return{x:r.left+g.ox+500*g.s,y:r.top+g.oy+500*g.s};');
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...centre});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...centre});await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});assert.equal((await state()).rows[0].point,null);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...centre,id:52,radiusX:3,radiusY:3,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual((await state()).rows[0].point,[500,500]);assert.equal(await call('return d.getElementById("plotInputSurface").hidden;'),true);
  report.gestures.push({label,kind:'central-placement/trusted-touch/right-button-ignored',passed:true});
  for(const [view,target,dx,dy]of[['collect','#catcherHandle',0,30],['measure','#rulerHandle',35,20],['plot','[data-point-slot="0"]',28,18]]){
    const s=T.filled();s.view=view;s.selectedSlot=0;
    for(const ending of['touchEnd','touchCancel']){await open(base,s);report.gestures.push({label,view,...await touchDrag(target,dx,dy,ending)});}
  }
  const s=T.filled();s.view='plot';s.selectedSlot=0;await open(base,s);await click('#placePoint');
  const strips=await call('const s=d.getElementById("stage").getBoundingClientRect(),e=d.getElementById("plotInputSurface").getBoundingClientRect();return[e.left-s.left,s.right-e.right];');assert(strips.every(v=>v>=32));
  await call("d.querySelector('[data-point-slot=\"0\"]').focus();");const old=(await state()).rows[0].point;await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});assert.equal((await state()).rows[0].point[0],old[0]+10);
  await click('#checkButton');const frozen=await state();await click('#fullscreenButton',true);await wait(()=>call('return Boolean(d.fullscreenElement);'),'fullscreen entry');assert.deepEqual(await state(),frozen);await cdp.send('Runtime.evaluate',{expression:'document.exitFullscreen()',awaitPromise:true});await wait(()=>call('return !d.fullscreenElement;'),'external fullscreen exit');
  report.gestures.push({label,kind:'keyboard/32px-side-strips/fullscreen-retains-answers',passed:true});
}
async function directTouchMatrix(base,label){
  await viewport(390,600);
  for(const phase of[...M.VIEWS,'check','review','frozen','committed']){
    const s=T.filled();s.view=M.VIEWS.includes(phase)?phase:'collect';await open(base,s);
    if(!M.VIEWS.includes(phase)){await click('#checkButton');if(phase!=='check'){await call(`w.__failFinal=${phase==='frozen'};w.__failFinish=${phase==='committed'};`);await click('#submitButton');}}
    const saved=await state();
    const swipe=async(region,delta)=>{
      const before=await call(`const p=d.getElementById('controlPanel'),r=d.getElementById(${JSON.stringify(region==='panel'?'controlPanel':'stage')}).getBoundingClientRect();w.__directTouches=0;d.addEventListener('pointerdown',function seen(e){if(e.isTrusted&&e.pointerType==='touch')w.__directTouches++;d.removeEventListener('pointerdown',seen);},{once:true});return{panel:p.scrollTop,range:p.scrollHeight-p.clientHeight,x:${region==='right'?'r.right-8':'r.left+8'},y:r.top+r.height/2};`);
      const point=y=>({x:before.x,y,id:418,radiusX:3,radiusY:3,force:1});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(before.y)]});
      for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(before.y+delta*i/6)]});await H.delay(20);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(400);
      const after=await call('return{panel:d.getElementById("controlPanel").scrollTop,document:scrollY,x:scrollX,trusted:w.__directTouches};');assert.equal(after.trusted,1);assert.equal(after.document,0);assert.equal(after.x,0);assert.deepEqual(await state(),saved);
      if(region!=='panel')assert.equal(after.panel,before.panel);else if(delta<0&&before.range-before.panel>3)assert(after.panel>before.panel);else if(delta>0&&before.panel>3)assert(after.panel<before.panel);
      return{region,delta,before,after};
    };
    await call('d.getElementById("controlPanel").scrollTop=0;');const gestures=[await swipe('panel',-60)];
    await call('d.getElementById("controlPanel").scrollTop=0;');gestures.push(await swipe('panel',60));
    await call('const p=d.getElementById("controlPanel");p.scrollTop=p.scrollHeight;');gestures.push(await swipe('panel',-60));
    if(phase!=='check')gestures.push(await swipe('left',-60),await swipe('right',60));
    if(['review','frozen','committed'].includes(phase)){await click('#fullscreenButton',true);await wait(()=>call('return Boolean(d.fullscreenElement);'),'locked fullscreen');await cdp.send('Runtime.evaluate',{expression:'document.exitFullscreen()',awaitPromise:true});assert.deepEqual(await state(),saved);}
    report.gestures.push({label,kind:'T0-direct-'+phase,gestures,passed:true});
  }
}
async function main(){
  fs.mkdirSync(out,{recursive:true});const temp=fs.realpathSync(os.tmpdir());
  try{
    const manifest=new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(path.join(root,'sim/manifests',slug+'.xml'),'utf8'));
    const files=manifest.manifest.resources.resource.file.map(f=>f['@_href']);
    const html=fs.readFileSync(path.join(root,'sim',slug,'index.html'),'utf8');const refs=[...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(m=>path.posix.normalize(slug+'/'+m[1]));assert.deepEqual(files.filter(f=>!f.endsWith('/index.html')).sort(),refs.sort());
    extracted=H.buildAndExtractPackage(temp,{slug,packagePrefix:'simlab-projectile-package-',packageNamePattern:/^simlab-projectile-package-[A-Za-z0-9]+$/});
    for(const file of files)assert.equal(fs.readFileSync(path.join(root,'sim',file),'utf8'),fs.readFileSync(path.join(extracted.packageDirectory,file),'utf8'));
    report.runtimeHash=crypto.createHash('sha256').update(files.map(f=>fs.readFileSync(path.join(root,'sim',f))).join('')).digest('hex');
    report.commit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
    profile=fs.mkdtempSync(path.join(temp,'simlab-projectile-chrome-'));
    chrome=spawn(H.findBrowser(),['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});chrome.stderr.resume();
    const port=await H.devToolsPort(profile,chrome),{body:target}=await H.fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});
    cdp=new H.CdpClient(target.webSocketDebuggerUrl);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');await preload();
    cdp.on('Page.javascriptDialogOpening',()=>{cdp.send('Page.handleJavaScriptDialog',{accept:acceptDialog}).catch(e=>report.errors.push(e.message));});
    cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));report.browser=await cdp.send('Browser.getVersion');
    for(const [label,directory]of[['source',path.join(root,'sim')],['package',extracted.packageDirectory]]){
      server=H.createServer(directory);await H.listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;
      console.log('projectile browser: '+label);await layoutMatrix(base,label);await completeFlow(base,label);
      if(!process.argv.includes('--smoke')){await flows(base,label);await edgeFlows(base,label);await interactions(base,label);await directTouchMatrix(base,label);}
      await H.closeServer(server);server=null;
    }
    assert.deepEqual(report.errors,[]);report.completed=true;console.log('Projectile source/package browser checks passed.');
  }catch(error){if(cdp){try{await screenshot('failure');}catch(_){}}throw error;}finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    await H.stopChrome(chrome,cdp);cdp?.close();if(server)await H.closeServer(server);
    for(const [directory,pattern]of[[profile,/^simlab-projectile-chrome-[A-Za-z0-9]+$/],[extracted?.packageDirectory,/^simlab-projectile-package-[A-Za-z0-9]+$/]])if(directory&&fs.existsSync(directory)){H.validateOwnedDirectory(directory,temp,pattern,'projectile browser');fs.rmSync(directory,{recursive:true,force:false,maxRetries:5,retryDelay:200});}
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
