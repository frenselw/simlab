#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const H=require('./position-time-browser-regression.js');
const M=require('../sim/centripetal-force-source-lab/model.js'),P=require('../sim/centripetal-force-source-lab/persistence.js'),S=require('../sim/centripetal-force-source-lab/scoring.js');
const root=path.resolve(__dirname,'..'),slug=M.ACTIVITY,out=path.join(root,'output/playwright',slug);
const report={completed:false,source:[],package:[],errors:[]};
let cdp,chrome,profile,extracted,server,touchId=30;
const call=code=>H.evaluate(cdp,`(()=>{const d=document,w=window,app=w.__centripetalSourceApp;${code}})()`);
const wait=async(fn,label)=>{for(let i=0;i<150;i++){try{if(await fn())return;}catch(_){}await H.delay(35);}throw Error('Timeout: '+label);};
async function viewport(width,height){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});}
async function preload(){await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const p=new URLSearchParams(location.search);Math.random=()=>.2;
  if(p.has('deny'))Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});
  if(p.has('fixture')){const key='source-lms-'+p.get('retain'),durable=JSON.parse(p.get('retain')&&sessionStorage.getItem(key)||p.get('fixture')),values={...durable};let error='0';window.__lmsValues=durable;window.__failFinal=false;window.__failFinish=false;
    window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>(error='0',values[k]||''),LMSSetValue:(k,v)=>{if(window.__failFinal&&k==='cmi.core.score.raw'){error='351';return 'false';}values[k]=String(v);error='0';return 'true';},LMSCommit:()=>{Object.assign(durable,values);if(p.get('retain'))sessionStorage.setItem(key,JSON.stringify(durable));return 'true';},LMSFinish:()=>window.__failFinish?'false':'true',LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};}
})();`});}
async function open(base,state=null,{standalone=false,retain='',deny=false}={}){
  const values=state?{'cmi.core.lesson_status':'incomplete','cmi.suspend_data':JSON.stringify({version:1,activity:slug,kind:'draft',answer:P.draft(state)})}:{'cmi.core.lesson_status':'not attempted'};
  const q=standalone?(deny?'deny=1':''):'fixture='+encodeURIComponent(JSON.stringify(values))+(retain?'&retain='+encodeURIComponent(retain):'');
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?${q}`});await wait(()=>call('return Boolean(app?.getState())&&d.readyState==="complete";'),'activity startup');
}
async function rect(selector){return call(`const e=d.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||e.hidden||!e.getClientRects().length)throw Error('Unavailable ${selector}');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,hit:d.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest(${JSON.stringify(selector)})===e};`);}
async function tap(selector){const p=await rect(selector);assert(p.hit,`blocked touch target ${selector}: ${JSON.stringify(p)}`);const id=touchId++,t={x:p.x,y:p.y,id,radiusX:1,radiusY:1,force:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(35);}
async function choose(selector,value){if(selector==='#forcePalette')await analyse();await call(`const e=d.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));`);}
async function analyse(){
  if(await call('return app.controller.mode==="edit"&&app.getState().view==="scene"&&!d.getElementById("analyseButton").disabled;'))await tap('#analyseButton');
  await wait(()=>call('return app.getState().view==="analysis";'),'analysis target reached');
}
async function seek(value){await call(`const e=d.getElementById('motionPosition');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));`);}
async function dragForce(angle,selector='#forceHandle'){
  const start=await rect(selector);assert(start.width>=44&&start.height>=44);
  const end=await call(`const g=app.getLayout(),r=d.getElementById('diagram').getBoundingClientRect(),a=${angle}*Math.PI/1800;return{x:r.left+g.cx+Math.cos(a)*60*g.scale,y:r.top+g.cy-Math.sin(a)*60*g.scale};`);
  const id=touchId++,touch=(x,y)=>({x,y,id,radiusX:1,radiusY:1,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(start.x,start.y)]});
  for(let i=1;i<=5;i++){const x=start.x+(end.x-start.x)*i/5,y=start.y+(end.y-start.y)*i/5;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(x,y)]});await H.delay(25);}
  assert(await call('return !d.getElementById("preview").hidden;'),'touch preview missing');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(35);
}
async function screenshot(label){fs.mkdirSync(out,{recursive:true});const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,label+'.png'),Buffer.from(r.data,'base64'));}
async function layoutChecks(base,label){
  for(const [width,height] of [[320,500],[390,500],[390,600],[390,844],[480,320],[320,225],[1280,800]]){
    await viewport(width,height);await open(base);
    for(let page=0;page<6;page++){
      if(width<600)await choose('#compactNav',page);else await tap('[data-page="'+page+'"]');
      await analyse();
      const x=await call(`const p=d.getElementById('controlPanel'),s=d.getElementById('stage'),last=d.getElementById('clearPage');p.scrollTop=p.scrollHeight;const r=last.getBoundingClientRect(),pr=p.getBoundingClientRect();return{rootRange:d.scrollingElement.scrollHeight-innerHeight,rootWidth:d.scrollingElement.scrollWidth,panelHeight:pr.height,panelBottom:pr.bottom,lastTop:r.top,lastBottom:r.bottom,stageHeight:s.getBoundingClientRect().height,side:[...d.querySelectorAll('.side-strip')].map(e=>e.getBoundingClientRect().width)};`);
      assert(x.rootRange<=1&&x.rootWidth<=width+1&&x.panelHeight>=95&&x.panelBottom<=height+1,JSON.stringify({width,height,page,x}));
      assert(x.lastTop>=x.panelBottom-x.panelHeight-1&&x.lastBottom<=x.panelBottom+1,JSON.stringify({width,height,page,x}));
      assert(x.side.every(n=>n>=32),JSON.stringify(x));
      if(page===0&&[[320,500],[390,844],[480,320],[1280,800]].some(v=>v[0]===width&&v[1]===height)){await call('d.getElementById("controlPanel").scrollTop=0;');await screenshot(label+'-'+width+'x'+height);}
    }
    report[label].push({layout:width+'x'+height,cases:6});
  }
}
async function fill(base,label){
  await viewport(390,844);await open(base,null,{retain:label+'-filled'});
  assert(await call('return Boolean(d.querySelector("#relationChoices math msub"));'),'native formula notation missing');
  for(let page=0;page<6;page++){
    await choose('#compactNav',page);await analyse();
    const s=await call('return app.getState();'),p=M.physics(s.def,page,s.items[page].pose),item=M.CASES[page];
    await tap(`[data-inward="${p.inward}"]`);
    for(const [kind,angle] of p.forces){await choose('#forcePalette',kind);await dragForce(angle,'#originHandle');const after=await call('return app.getState();');assert(M.difference(after.items[page].arrows.at(-1)[1],angle)<=100,JSON.stringify({page,angle,actual:after.items[page].arrows.at(-1)}));}
    await tap(`input[name="relation"][value="${item.relation}"]`);
  }
  await tap('input[name="concept"][value="radial-effect"]');
  assert.equal(await call('return CentripetalSourceScoring.score(app.getState()).score;'),100);
  await tap('#checkButton');assert.equal(await call('return app.controller.mode;'),'check');assert(await call('return !d.getElementById("checkSummary").textContent.includes("/16");'));
  await tap('#returnEdit');assert.equal(await call('return app.controller.mode;'),'edit');await tap('#checkButton');await tap('#submitButton');
  assert.equal(await call('return app.controller.mode;'),'review');assert.equal(await call('return app.controller.result.score;'),100);
  assert(await call('return d.getElementById("feedbackList").textContent.includes("一般變速圓周運動")&&d.getElementById("feedbackList").textContent.includes("離心力");'));
  assert.equal(await call('return app.controller.command({type:"clear-page"});'),false);
  await screenshot(label+'-submitted');report[label].push({flow:'six-case trusted touch full score',score:100,trustedDrags:await call('return app.diagnostics.trustedTouch;')});
}
async function edgeFlows(base,label){
  await viewport(390,844);await open(base);await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);
  await open(base);await choose('#forcePalette',6);await tap('#addForce');await dragForce(0);await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);
  await open(base);await choose('#forcePalette',2);await tap('#addForce');await call('d.getElementById("forceHandle").focus();');await cdp.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});assert.equal(await call('return app.getState().items[0].arrows[0][1];'),10);
  await open(base);await choose('#forcePalette',0);await tap('#addForce');await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.result.score;'),2);
  await open(base,null,{retain:label+'-resume'});await choose('#forcePalette',0);await tap('#addForce');await cdp.send('Page.reload');await wait(()=>call('return app?.getState()?.items[0].arrows.length===1;'),'Moodle draft resume');
  await open(base,null,{standalone:true,deny:true});await choose('#forcePalette',0);await tap('#addForce');await cdp.send('Page.reload');await wait(()=>call('return app?.getState()?.items[0].arrows.length===0;'),'standalone fresh refresh');
  await open(base,null,{retain:label+'-pending'});await call('w.__failFinal=true;');await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.mode;'),'frozen');await cdp.send('Page.reload');await wait(()=>call('return app?.controller.mode==="frozen";'),'pending resume');await tap('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base);await call('w.__failFinish=true;');await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.mode;'),'committed');await call('w.__failFinish=false;');await tap('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base);await choose('#forcePalette',0);await tap('#addForce');
  const before=await call('return JSON.stringify(app.getState());'),start=await rect('#forceHandle'),id=touchId++,t=(x,y)=>({x,y,id,radiusX:1,radiusY:1,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t(start.x,start.y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t(start.x+35,start.y-25)]});
  assert(await call('return !d.getElementById("preview").hidden;'));await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await call('return JSON.stringify(app.getState());'),before);assert(await call('return d.getElementById("preview").hidden;'));
  const second=touchId++,u={x:start.x-70,y:start.y,id:second,radiusX:1,radiusY:1,force:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t(start.x,start.y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t(start.x+20,start.y-20)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t(start.x+20,start.y-20),u]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await call('return JSON.stringify(app.getState());'),before);assert(await call('return d.getElementById("preview").hidden;'));
  const full=await call('return d.querySelector(".sim-fullscreen-button,[data-sim-fullscreen-control]")?.outerHTML||null;');assert(full,'fullscreen control missing');
  await tap('.sim-fullscreen-button');assert(await call('return Boolean(d.fullscreenElement);'));await call('return d.exitFullscreen();');
  assert.equal(await call('return JSON.stringify(app.getState());'),before);
  await open(base);await choose('#compactNav',5);await seek(0);await choose('#forcePalette',1);await tap('#addForce');await dragForce(430);
  assert.equal(await call('return app.getState().items[5].arrows[0][1];'),450,'outward diagonal did not snap');
  await call('const e=d.getElementById("diagramSvg");Object.defineProperty(e,"innerHTML",{set(){throw Error("SVG failure fixture");}});app.controller.navigate(1);');
  assert.equal(await call('return app.controller.mode;'),'technical');assert(await call('return !d.getElementById("notice").hidden&&d.getElementById("stage").getBoundingClientRect().height<1;'));
  await open(base,M.fresh(()=>.2));assert(await call('return !app.getMotion().playing&&!d.getElementById("sceneButton").disabled;'));
  await tap('#sceneButton');assert(await call('return app.getMotion().playing;'));
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await open(base);
  assert(await call('return !app.getMotion().playing;'));
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  await viewport(320,500);await open(base);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await H.delay(40);
  assert(await call('return visualViewport.scale>=1.9&&d.scrollingElement.scrollWidth<=innerWidth+1&&d.getElementById("controlPanel").getBoundingClientRect().height>=96;'));
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  report[label].push({flow:'blank,extra force,keyboard arrow,partial,resume,standalone refresh,pending,committed,cancel,secondary touch,fullscreen,diagonal reverse snap,renderer failure,paused scene restore,reduced motion,200% zoom',passed:true});
}
async function revisedScenes(base,label){
  for(const [width,height]of [[390,844],[1280,800]]){
    await viewport(width,height);await open(base);
    for(let page=0;page<6;page++){
      if(width<600)await choose('#compactNav',page);else await tap('[data-page="'+page+'"]');
      await seek(2500);
      const object=['ball','block','ball','car','car','earth'][page];
      assert(await call(`const e=d.querySelector('[data-scene="${M.CASES[page].id}"] [data-object="${object}"]');const r=e?.getBoundingClientRect();return r&&r.width>12&&r.height>12;`),'scene object absent '+page);
      await screenshot(`${label}-scene-${page}-${width}`);
    }
  }
  await viewport(390,844);await open(base);
  for(const page of [3,4])for(const value of [2500,7500]){
    await choose('#compactNav',page);if(await call('return app.getState().view==="analysis";'))await tap('#sceneButton');
    await seek(value);await tap('#analyseButton');
    assert.equal(await call('return app.getState().view;'),'scene','analysis opened before car reached target');
    const target=await call('return app.getMotion().pending;');assert.equal(target,value<5000?.5:1.5);
    assert(await call('return d.getElementById("answerArea").hidden&&d.getElementById("motionPosition").disabled;'));
    await wait(()=>call('return app.getState().view==="analysis";'),'bridge next target');
    assert.equal(await call(`return app.getState().items[${page}].pose;`),5000);
    assert.equal(await call('return app.getMotion().travel;'),target);
    await screenshot(`${label}-analysis-${page}-${value}`);
  }
  await choose('#compactNav',5);await seek(1376);await analyse();assert.equal(await call('return app.getState().items[5].pose;'),1376);
  const p=await call('const s=app.getState();return CentripetalSourceModel.physics(s.def,5,s.items[5].pose);');
  await choose('#forcePalette',1);await dragForce(p.forces[0][1],'#originHandle');
  assert.equal(await call('return app.getState().items[5].arrows.length;'),1);
  const pose=await call('return app.getState().items[5].pose;');await tap('#sceneButton');await seek(6200);await analyse();assert.equal(await call('return app.getState().items[5].pose;'),pose);
  await choose('#forcePalette',0);const before=await call('return JSON.stringify(app.getState());'),r=await rect('#originHandle'),id=touchId++;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y,id}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x,y:r.y+45,id}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await call('return JSON.stringify(app.getState());'),before);
  report[label].push({flow:'six visible scenes; direct drawing and cancel; arbitrary observation; both bridges before/after target and wrap',passed:true});
}
async function main(){
  const temp=fs.realpathSync(os.tmpdir());fs.mkdirSync(out,{recursive:true});
  try{
    extracted=H.buildAndExtractPackage(temp,{slug,packagePrefix:'simlab-source-package-',packageNamePattern:/^simlab-source-package-[A-Za-z0-9]+$/});
    const manifest=fs.readFileSync(path.join(root,'sim/manifests',slug+'.xml'),'utf8');
    const files=[...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map(x=>x[1]);
    const refs=[...fs.readFileSync(path.join(root,'sim',slug,'index.html'),'utf8').matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(x=>path.posix.normalize(slug+'/'+x[1]));
    assert.deepEqual(files.filter(x=>!x.endsWith('/index.html')).sort(),refs.sort());
    for(const file of files)assert.deepEqual(fs.readFileSync(path.join(root,'sim',file)),fs.readFileSync(path.join(extracted.packageDirectory,file)));
    report.assetHash=crypto.createHash('sha256').update(files.map(f=>fs.readFileSync(path.join(root,'sim',f))).join('')).digest('hex');
    profile=fs.mkdtempSync(path.join(temp,'simlab-source-chrome-'));chrome=spawn(H.findBrowser(),['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});chrome.stderr.resume();
    const port=await H.devToolsPort(profile,chrome),{body:target}=await H.fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});
    cdp=new H.CdpClient(target.webSocketDebuggerUrl);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');await preload();
    cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
    for(const [label,directory]of [['source',path.join(root,'sim')],['package',extracted.packageDirectory]]){
      server=H.createServer(directory);await H.listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;
      await revisedScenes(base,label);await layoutChecks(base,label);await fill(base,label);await edgeFlows(base,label);await H.closeServer(server);server=null;
    }
    assert.deepEqual(report.errors,[]);report.completed=true;console.log('Centripetal source source/package browser regression passed.');
  }finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    await H.stopChrome(chrome,cdp);cdp?.close();if(server)await H.closeServer(server);
    for(const [dir,pattern]of [[profile,/^simlab-source-chrome-[A-Za-z0-9]+$/],[extracted?.packageDirectory,/^simlab-source-package-[A-Za-z0-9]+$/]])if(dir&&fs.existsSync(dir)){H.validateOwnedDirectory(dir,temp,pattern,'centripetal browser');fs.rmSync(dir,{recursive:true,force:false,maxRetries:5,retryDelay:200});}
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
