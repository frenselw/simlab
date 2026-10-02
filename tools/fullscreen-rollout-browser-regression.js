#!/usr/bin/env node
"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');const AdmZip=require('adm-zip');
const H=require('./position-time-browser-regression.js');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/playwright/fullscreen-rollout');
const slugs=fs.readdirSync(path.join(root,'sim/manifests')).filter(n=>n.endsWith('.xml')).map(n=>path.basename(n,'.xml')).sort();
async function main(){
 fs.mkdirSync(output,{recursive:true});const temp=fs.realpathSync(os.tmpdir());let directory,profile,chrome,cdp,server,failure;
 const headed=process.argv.includes('--headed');
 const report={engine:'Chrome/CDP trusted input',display:headed?'headed':'headless',cases:[],errors:[],completed:false};
 try{
  const build=spawnSync(process.execPath,[path.join(root,'tools/package-all.js')],{encoding:'utf8'});
  assert.equal(build.status,0,'Build all SCORM ZIPs: '+build.stderr);
  directory=fs.mkdtempSync(path.join(temp,'simlab-fullscreen-rollout-'));
  for(const slug of slugs){
   const zip=new AdmZip(path.join(root,'output',slug+'-scorm.zip'));
   for(const entry of zip.getEntries())if(!entry.isDirectory&&entry.entryName!=='imsmanifest.xml')assert.ok(entry.getData().equals(fs.readFileSync(path.join(root,'sim',entry.entryName))),slug+' package/source parity: '+entry.entryName);
   zip.extractAllTo(path.join(directory,slug));
  }
  const staticSource=H.createServer(root),sourceHandler=staticSource.listeners('request')[0];staticSource.removeAllListeners('request');
  const staticPackage=H.createServer(directory),packageHandler=staticPackage.listeners('request')[0];
  server=staticSource;
  server.on('request',(request,response)=>{
   const url=new URL(request.url,'http://127.0.0.1');
   if(url.pathname==='/__rollout-host'){
    const src=url.searchParams.get('src'),blocked=url.searchParams.has('blocked');
    response.writeHead(200,{'content-type':'text/html;charset=utf-8','cache-control':'no-store'}).end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}header{height:100px}iframe{display:block;width:100%;height:500px;border:0}.after{height:600px}</style></head><body><header>SCORM display fixture</header><iframe id="activity" title="測試活動" ${blocked?'allow="fullscreen \'none\'"':'allow="fullscreen" allowfullscreen'}></iframe><div class="after"></div><script>window.__values={'cmi.core.lesson_status':'not attempted'};window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>window.__values[k]||'',LMSSetValue:(k,v)=>(window.__values[k]=String(v),'true'),LMSCommit:()=> 'true',LMSFinish:()=> 'true',LMSGetLastError:()=> '0',LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};document.getElementById('activity').src=${JSON.stringify(src)};<\/script></body></html>`);return;
   }
   if(url.pathname.startsWith('/__packages/')){request.url=request.url.slice('/__packages'.length);return packageHandler(request,response);}
   sourceHandler(request,response);
  });
  await H.listenServer(server);const base='http://127.0.0.1:'+server.address().port;
  const browser=H.findBrowser();assert.ok(browser,'Chrome required');profile=fs.mkdtempSync(path.join(temp,'simlab-fullscreen-rollout-chrome-'));
  // The matrix uses native DOM fullscreen without OS window transitions.
  // --headed also checks the desktop window; neither mode bypasses assertions.
  chrome=spawn(browser,[...(headed?[]:['--headless=new']),'--window-size=1280,1000','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});
  const port=await H.devToolsPort(profile,chrome),{body:tab}=await H.fetchJson('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'});
  cdp=new H.CdpClient(tab.webSocketDebuggerUrl,WebSocket,15000);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');report.browser=await cdp.send('Browser.getVersion');
  cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
  const child=code=>H.evaluate(cdp,`((w,d)=>{${code}})(document.getElementById('activity').contentWindow,document.getElementById('activity').contentDocument)`);
  async function until(code){for(let i=0;i<120;i++){try{if(await child('return '+code))return;}catch(_){}await H.delay(40);}report.timeout=await child("return {trusted:w.__fullscreenTrusted,trace:w.__fullscreenTrace,focused:d.hasFocus(),visibility:d.visibilityState,active:Boolean(d.fullscreenElement),label:d.getElementById('fullscreenButton')?.getAttribute('aria-label'),disabled:d.getElementById('fullscreenButton')?.disabled,error:d.getElementById('fullscreenStatus')?.textContent};").catch(()=>null);throw Error('Condition timed out: '+code);}
  async function click(touch){
   const point=await child("const b=d.getElementById('fullscreenButton');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect(),f=w.frameElement.getBoundingClientRect();return {x:r.left+r.width/2+f.left,y:r.top+r.height/2+f.top};");
   if(touch){await H.delay(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:911,radiusX:2,radiusY:2,force:1}]});await H.delay(50);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
  }
  const evidence=()=>child(`const target=d.querySelector('[data-sim-fullscreen-target]'),button=d.getElementById('fullscreenButton'),header=d.querySelector('[data-sim-fullscreen]'),r=target.getBoundingClientRect(),b=button.getBoundingClientRect(),overlaps=[];for(const e of header.querySelectorAll('h1,button,a')){if(e===button||!e.getClientRects().length)continue;const rects=e.tagName==='H1'?(()=>{const range=d.createRange();range.selectNodeContents(e);return Array.from(range.getClientRects());})():Array.from(e.getClientRects());for(const x of rects)if(x.left<b.right-.5&&x.right>b.left+.5&&x.top<b.bottom-.5&&x.bottom>b.top+.5)overlaps.push(e.tagName+': '+e.textContent.trim());}return {active:d.fullscreenElement===target,label:button.getAttribute('aria-label'),disabled:button.disabled,pressed:button.getAttribute('aria-pressed'),button:[b.x,b.y,b.width,b.height],target:[r.x,r.y,r.width,r.height],viewport:[w.innerWidth,w.innerHeight],overlaps,error:d.getElementById('fullscreenStatus').dataset.fullscreenError||null,panels:Array.from(d.querySelectorAll('.sim-panel,.control-panel,.controls-panel,.freefall-panel')).filter(e=>e.getClientRects().length).map(e=>({height:e.clientHeight,width:e.clientWidth,range:e.scrollHeight-e.clientHeight})),trusted:w.__fullscreenTrusted};`);
  for(const mode of ['source','package'])for(const [width,height] of [[320,500],[1280,900]]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:width<600});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:2});
   for(const slug of slugs){
    console.log(mode+' '+slug+' '+width+'x'+height);
    report.current={mode,slug,width,height};
    const src=mode==='source'?'/sim/'+slug+'/index.html':'/__packages/'+slug+'/'+slug+'/index.html';
    await cdp.send('Page.navigate',{url:base+'/__rollout-host?src='+encodeURIComponent(src)});
    await until("d.readyState==='complete' && Boolean(d.getElementById('fullscreenButton'))");await H.delay(100);
    await child("w.__fullscreenTrusted=false;w.__fullscreenTrace=[];d.getElementById('fullscreenButton').addEventListener('click',e=>{w.__fullscreenTrusted=e.isTrusted;w.__fullscreenTrace.push({type:'click',trusted:e.isTrusted,active:Boolean(d.fullscreenElement)});});for(const type of ['fullscreenchange','fullscreenerror'])d.addEventListener(type,()=>w.__fullscreenTrace.push({type,active:Boolean(d.fullscreenElement)}));");
    const before=await evidence();assert.deepEqual(before.overlaps,[],slug+' header overlap');assert.equal(before.button[2],44);assert.equal(before.button[3],44);
    const lmsBefore=await H.evaluate(cdp,"JSON.stringify(window.__values)");
    await click(width<600);await until("d.fullscreenElement===d.querySelector('[data-sim-fullscreen-target]') && !d.getElementById('fullscreenButton').disabled && d.getElementById('fullscreenButton').getAttribute('aria-pressed')==='true'");
    const entered=await evidence();assert.equal(entered.trusted,true);assert.equal(entered.label,'退出全螢幕');assert.equal(entered.pressed,'true');assert.deepEqual(entered.overlaps,[],slug+' fullscreen overlap');
    assert.ok(Math.abs(entered.target[2]-entered.viewport[0])<2&&Math.abs(entered.target[3]-entered.viewport[1])<2,slug+' target fills viewport');
    assert.equal(await H.evaluate(cdp,"JSON.stringify(window.__values)"),lmsBefore,slug+' same SCORM state');
    if(width<600)for(const p of entered.panels)assert.ok(p.height>=80,slug+' usable phone panel: '+JSON.stringify(p));
    // Existing native dialogs are in the document top layer, including those
    // outside main. Verify they remain visible and clickable over fullscreen.
    const dialogs=await child("return Array.from(d.querySelectorAll('dialog')).map(dialog=>{dialog.showModal();const r=dialog.getBoundingClientRect(),hit=d.elementFromPoint(r.left+r.width/2,r.top+r.height/2);const result={id:dialog.id,visible:r.width>0&&r.height>0&&dialog.contains(hit),fullscreen:d.fullscreenElement===d.querySelector('[data-sim-fullscreen-target]')};dialog.close('cancel');return result;});");
    for(const dialog of dialogs)assert.ok(dialog.visible&&dialog.fullscreen,slug+' fullscreen dialog: '+dialog.id);
    if(slug==='newtons-third-law-reaction-force-lab'||slug==='hookes-law-spring-investigation-lab'||slug==='kinematics-quantitative-graph-builder'||slug==='position-time-graph-motion-lab'){
     const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,mode+'-'+slug+'-'+width+'.png'),Buffer.from(data,'base64'));
    }
    await click(width<600);await until("!d.fullscreenElement && !d.getElementById('fullscreenButton').disabled && d.getElementById('fullscreenButton').getAttribute('aria-pressed')==='false'");const exited=await evidence();assert.equal(exited.label,'進入全螢幕');assert.equal(exited.pressed,'false');
    assert.equal(await H.evaluate(cdp,"JSON.stringify(window.__values)"),lmsBefore,slug+' retains SCORM state after exit');
    report.cases.push({mode,slug,width,height,before,entered,exited,dialogs});
   }
  }
  // A denied frame still leaves the display button usable and reports the policy.
  await cdp.send('Page.navigate',{url:base+'/__rollout-host?blocked=1&src='+encodeURIComponent('/sim/newtons-third-law-reaction-force-lab/index.html')});await until("Boolean(d.getElementById('fullscreenButton'))");await click(false);await H.delay(80);report.denied=await evidence();assert.equal(report.denied.active,false);assert.equal(report.denied.error,'blocked');assert.equal(report.denied.disabled,false);
  assert.equal(await child("const s=d.getElementById('fullscreenStatus');return !s.hidden&&s.getBoundingClientRect().height>0&&w.getComputedStyle(s).display!=='none';"),true,'denied request message is visible');
  assert.deepEqual(report.errors,[]);report.completed=true;
 }catch(e){failure=e;report.failure=e.stack;if(cdp){const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).catch(()=>null);if(shot)fs.writeFileSync(path.join(output,'failure.png'),Buffer.from(shot.data,'base64'));}}
 finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(chrome)await H.stopChrome(chrome,cdp);cdp?.close();if(server)await H.closeServer(server);
  for(const dir of [directory,profile].filter(Boolean)){H.validateOwnedDirectory(dir,temp,/^simlab-fullscreen-rollout-(?:chrome-)?[A-Za-z0-9]+$/,'fullscreen rollout');fs.rmSync(dir,{recursive:true,force:false});}
 }
 if(failure)throw failure;console.log('All fullscreen rollout source/package checks passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});module.exports={main};
