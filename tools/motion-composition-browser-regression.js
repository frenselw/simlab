#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {spawn}=require("node:child_process");
const {XMLParser}=require("fast-xml-parser");
const {CdpClient,buildAndExtractPackage,createServer,listenServer,devToolsPort,fetchJson,evaluate,delay,findBrowser,stopChrome,closeServer,validateOwnedDirectory}=require("./position-time-browser-regression.js");
const M=require("../sim/motion-composition-stroboscopic-lab/model.js"),P=require("../sim/motion-composition-stroboscopic-lab/persistence.js"),S=require("../sim/motion-composition-stroboscopic-lab/scoring.js");
const {filled,durableDraft,finishedData}=require("../sim/motion-composition-stroboscopic-lab/test-support.js");
const root=path.resolve(__dirname,".."),slug=P.ACTIVITY,suffix=process.env.MOTION_ARTIFACT_SUFFIX||"";
if(suffix&&!/^[a-z0-9-]+$/.test(suffix))throw new Error("Invalid artifact suffix");
const artifactDir=path.join(root,"output/playwright/motion-composition-stroboscopic-lab",suffix);
function sourceParity(){
 const html=fs.readFileSync(path.join(root,"sim",slug,"index.html"),"utf8");
 const refs=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(m=>path.posix.normalize(`${slug}/${m[1]}`)).sort();
 const parsed=new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(path.join(root,"sim/manifests",`${slug}.xml`),"utf8"));
 const declared=parsed.manifest.resources.resource.file.map(f=>f["@_href"]).filter(f=>f!=="config.js"&&f!==`${slug}/index.html`).sort();assert.deepEqual(refs,declared);return refs;
}
const call = (cdp, code, embedded = false) => evaluate(cdp, `((w,d)=>{${code}})(${embedded ? 'document.getElementById("activity").contentWindow,document.getElementById("activity").contentDocument' : "window,document"})`);
async function ready(cdp, embedded = false) {
  for (let i = 0; i < 150; i++) {
    try { if (await call(cdp, "return d.readyState==='complete' && Boolean(w.__motionComposition);", embedded)) return; } catch (_) {}
    await delay(40);
  }
  throw new Error("Activity did not initialize");
}
async function viewport(cdp, width, height, touch = true, scale = 1) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600, scale });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: 2 });
}
async function preload(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const params=new URLSearchParams(location.search);
    window.__storageProbes=0;
    if(params.has('__denyStorage')) Object.defineProperty(window,'localStorage',{get(){window.__storageProbes++;throw new DOMException('Storage denied by test','SecurityError');}});
    if(params.has('__seed')) Object.defineProperty(crypto,'getRandomValues',{value(a){a.fill(0);a[0]=Number(params.get('__seed'))>>>0;return a;}});
    if(params.has('__fixture')) {
      const durable=JSON.parse(params.get('__fixture')),values={...durable};let error='0';
      window.__lmsValues=durable;window.__failFinal=false;window.__failFinish=false;
      window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>(error='0',values[k]||''),
        LMSSetValue:(k,v)=>{if(window.__failFinal&&k==='cmi.core.score.raw'){error='351';return 'false';} values[k]=String(v);error='0';return 'true';},
        LMSCommit:()=>{Object.assign(durable,values);return 'true';},LMSFinish:()=>window.__failFinish?'false':'true',LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};
    }
  })();` });
}
async function navigate(cdp, base, options = {}) {
  // Each fixture is a new browsing session. Clear the emulator's gesture
  // sequence before replacing a document that may just have scrolled.
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const params = new URLSearchParams();
  if (options.fixture !== false) params.set("__fixture", JSON.stringify(options.fixture || { "cmi.core.lesson_status": "not attempted" }));
  if(options.denyStorage) params.set("__denyStorage","1");
  const src = `/${slug}/index.html?${params}`;
  const url = options.embedded ? `${base}/__embed-scroll-test.html?src=${encodeURIComponent(src)}${options.fluid ? "&fluid=1" : ""}` : `${base}${src}`;
  await cdp.send("Page.navigate", { url }); await delay(100); await ready(cdp, options.embedded);
  if (options.embedded) { await evaluate(cdp, "scrollTo(0,300)"); await delay(70); }
}
async function rect(cdp, selector, embedded = false, scroll = false) {
  const r = await call(cdp, `const e=d.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing ${selector}');${scroll ? "e.scrollIntoView({block:'nearest'});" : ""}const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};`, embedded);
  if (embedded) {
    const f = await evaluate(cdp, "(()=>{const r=document.getElementById('activity').getBoundingClientRect();return {x:r.left,y:r.top};})()"); r.x += f.x; r.y += f.y;
  }
  return r;
}
async function click(cdp, selector, embedded = false) {
  const p = await rect(cdp, selector, embedded, true);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 }); await delay(40);
}
const state=(cdp,embedded=false)=>call(cdp,'return w.__motionComposition.getState();',embedded);
const mode=(cdp,embedded=false)=>call(cdp,'return w.__motionComposition.getMode();',embedded);
const touchPoint=p=>({x:p.x,y:p.y,id:1,radiusX:2,radiusY:2,force:1});
async function dragTouch(cdp,start,end,during=null){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(start)]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:start.x+(end.x-start.x)*i/10,y:start.y+(end.y-start.y)*i/10})]});await delay(14);}
 if(during)await during();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(350);
}
async function screenshot(cdp,name){const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(artifactDir,`${name}.png`),Buffer.from(data,'base64'));}
async function metrics(cdp,embedded=false){
 const local=await call(cdp,`const a=w.__motionComposition,p=d.getElementById('controlPanel'),r=d.getElementById('stage').getBoundingClientRect(),v=w.visualViewport;return {doc:[w.scrollX,w.scrollY],range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.scrollTop,panelRange:p.scrollHeight-p.clientHeight,stage:[r.left,r.top,r.width,r.height],view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],answer:JSON.stringify(a.getState()),selection:a.getSelection(),pointer:a.getPointerDiagnostics()};`,embedded);
 const host=await evaluate(cdp,`(()=>{const v=visualViewport,r=${embedded?'document.getElementById("activity").getBoundingClientRect()':'null'};return {x:scrollX,y:scrollY,view:[v.offsetLeft,v.offsetTop,v.pageLeft,v.pageTop,v.width,v.height],frame:r?[r.left,r.top,r.width,r.height]:null};})()`);return {...local,host};
}
function fixed(before,after,owner,label){
 assert.deepEqual(after.selection,before.selection,`${label}: selection`);assert.deepEqual(after.doc,before.doc,`${label}: document`);assert.ok(after.range<=1,`${label}: no third scroll owner`);assert.deepEqual(after.view,before.view,`${label}: activity viewport`);assert.deepEqual(after.stage,before.stage,`${label}: local stage`);
 if(owner!=='panel')assert.equal(after.panel,before.panel,`${label}: panel`);if(owner!=='host')assert.deepEqual(after.host,before.host,`${label}: host/frame/viewport`);if(owner!=='drag')assert.equal(after.answer,before.answer,`${label}: authoritative answers`);
}
async function stagePoint(cdp,p,embedded=false){let r=await call(cdp,"const r=d.getElementById('stage').getBoundingClientRect();return{x:r.left,y:r.top};",embedded);if(embedded){const f=await evaluate(cdp,"(()=>{const r=document.getElementById('activity').getBoundingClientRect();return{x:r.left,y:r.top};})()");r={x:r.x+f.x,y:r.y+f.y};}return{x:r.x+p.x,y:r.y+p.y};}
async function target(cdp,index,slot,embedded=false){const l=await call(cdp,'return w.__motionComposition.getGeometry();',embedded);return stagePoint(cdp,M.pixel(M.expected(index)[slot],l),embedded);}
async function drawMouse(cdp,index,slot,embedded=false,finalDifferent=false){const start=await rect(cdp,'#trayHandle',embedded),end=await target(cdp,index,slot,embedded);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:end.x+(finalDifferent?20:0),y:end.y,button:'left',buttons:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',clickCount:1});await delay(60);}
async function select(cdp,id,value,embedded=false){await call(cdp,`const e=d.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new w.Event('change',{bubbles:true}));`,embedded);}
async function key(cdp,key,modifiers=0){await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,modifiers});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,modifiers});}
async function visual(cdp,base,label){const report=[];for(const [width,height] of [[320,500],[390,500],[390,600],[390,844],[768,900],[1024,768],[1280,900],[740,360],[320,400],[640,450]]){
 await viewport(cdp,width,height);await navigate(cdp,base,{fixture:durableDraft(filled())});
 const m=await call(cdp,"const p=d.getElementById('controlPanel'),s=d.getElementById('stage');return {overflow:d.documentElement.scrollWidth-w.innerWidth,range:Math.max(d.documentElement.scrollHeight,d.body.scrollHeight)-w.innerHeight,panel:p.clientHeight,stage:s.clientHeight,font:[...d.querySelectorAll('#stageSvg text')].map(e=>Number(w.getComputedStyle(e).fontSize.replace('px','')))};");assert.ok(m.overflow<=1&&m.range<=1,`${label} ${width}x${height}: bounded ${JSON.stringify(m)}`);assert.ok(m.panel>=65);assert.ok(m.stage>=150);assert.ok(m.font.every(size=>size>=11));
 for(let index=0;index<4;index++){await click(cdp,`[data-case="${index}"]`);assert.equal((await state(cdp)).activeCase,index);if((width===390&&height===600)||width===1280)await screenshot(cdp,`${label}-${width}-case-${index}`);}
 assert.equal(await call(cdp,"return [...d.querySelectorAll('#questionNav button,#timeNav button')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;});"),true);
 await click(cdp,'#checkButton');await click(cdp,'#submitButton');assert.equal(await mode(cdp),'review');assert.equal(await call(cdp,"return d.getElementById('clearCaseButton').getClientRects().length;"),0);report.push({width,height,...m});
 }
 await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});assert.equal(await call(cdp,'return w.visualViewport.scale;'),2);await screenshot(cdp,`${label}-zoom-200`);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});return report;
}
async function flows(cdp,base,label){
 await viewport(cdp,1280,900);await navigate(cdp,base,{fixture:false});
 for(let index=0;index<4;index++){await click(cdp,`[data-case="${index}"]`);await click(cdp,'#observeButton');for(let slot=0;slot<4;slot++){await click(cdp,`[data-time="${slot+1}"]`);await drawMouse(cdp,index,slot,false,true);assert.deepEqual((await state(cdp)).cases[index].points[slot],M.expected(index)[slot]);}await select(cdp,'horizontalMotion',M.CASES[index].motions[0]);await select(cdp,'verticalMotion',M.CASES[index].motions[1]);await select(cdp,'trajectorySelect',M.CASES[index].trajectory);}
 assert.equal(S.score(await state(cdp)).score,100);await click(cdp,'#checkButton');assert.equal(await mode(cdp),'check');await click(cdp,'#checkList button');assert.equal((await state(cdp)).returnToCheck,true);await click(cdp,'#returnCheckButton');await click(cdp,'#submitButton');assert.equal(await mode(cdp),'review');assert.equal((await call(cdp,'return w.__motionComposition.getResult();')).score,100);await click(cdp,'#referenceButton');await screenshot(cdp,`${label}-review`);
 for(const s of [P.fresh(),(()=>{const s=P.fresh();s.cases[0].motions[0]='uniform';return s;})()]){await navigate(cdp,base,{fixture:durableDraft(s)});await click(cdp,'#checkButton');await click(cdp,'#submitButton');assert.equal((await call(cdp,'return w.__motionComposition.getResult();')).score,S.score(s).score);}
 await navigate(cdp,base,{fixture:finishedData(filled())});assert.equal(await mode(cdp),'review');const locked=JSON.stringify(await state(cdp));await click(cdp,'[data-case="2"]');assert.equal(JSON.stringify(await state(cdp)),locked);
 await navigate(cdp,base,{fixture:durableDraft(filled())});await click(cdp,'#checkButton');await call(cdp,'w.__failFinal=true;');await click(cdp,'#submitButton');assert.equal(await mode(cdp),'frozen');assert.equal(await call(cdp,'return w.__motionComposition.getResult();'),null);const pending=await call(cdp,'return w.__lmsValues;');await navigate(cdp,base,{fixture:pending});assert.equal(await mode(cdp),'frozen');await click(cdp,'#retryFinalButton');assert.equal(await mode(cdp),'review');
 for(const phase of ['edit','check','review']){await navigate(cdp,base,{fixture:false,denyStorage:true});await click(cdp,'#observeButton');await drawMouse(cdp,0,0);if(phase!=='edit')await click(cdp,'#checkButton');if(phase==='review')await click(cdp,'#submitButton');await cdp.send('Page.reload');await ready(cdp);assert.deepEqual(await state(cdp),P.fresh());assert.equal(await call(cdp,'return w.__storageProbes;'),0);}
 await navigate(cdp,base,{fixture:false});await select(cdp,'horizontalMotion','uniform');assert.equal(S.score(await state(cdp)).score,3);await click(cdp,'#observeButton');await call(cdp,"d.getElementById('trayHandle').focus();");for(let i=0;i<4;i++)await key(cdp,'ArrowRight');for(let i=0;i<4;i++)await key(cdp,'ArrowDown');assert.equal((await state(cdp)).cases[0].points[0],null);await key(cdp,'Enter');assert.deepEqual((await state(cdp)).cases[0].points[0],[800,-800]);await key(cdp,'ArrowRight',8);await key(cdp,'Escape');assert.deepEqual((await state(cdp)).cases[0].points[0],[800,-800]);
 await click(cdp,'[data-case="1"]');await click(cdp,'#observeButton');await call(cdp,"d.getElementById('spacingDetails').open=true;");await click(cdp,'[data-compare-axis="1"]');await click(cdp,'#showIncreases');const comparison=await call(cdp,"return d.getElementById('spacingBars').textContent;");assert.match(comparison,/0.20 m/);assert.match(comparison,/1.40 m/);assert.equal((comparison.match(/0.40 m/g)||[]).length,3);await screenshot(cdp,`${label}-comparison`);
 return {mouseScore:100,blankAndPartial:true,reviewResume:true,pendingRetry:true,standaloneRefresh:true,keyboard:true,comparison:true};
}
async function touch(cdp,base,label,width){
 await viewport(cdp,width,500);const report=[];
 for(let index=0;index<4;index++)for(let slot=0;slot<4;slot++){
  const s=P.fresh();s.activeCase=index;s.activeTime=slot+1;s.cases[index].observed=true;await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});await delay(100);let before=await metrics(cdp,true),preview;
  const start=await rect(cdp,'#trayHandle',true),end=await target(cdp,index,slot,true);await dragTouch(cdp,start,end,async()=>{preview=await call(cdp,"const m=d.getElementById('magnifier'),r=m.getBoundingClientRect(),s=d.getElementById('stage').getBoundingClientRect();return {hidden:m.hidden,text:d.getElementById('previewValues').textContent,inside:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom,intercept:w.getComputedStyle(m).pointerEvents};",true);assert.equal(preview.hidden,false);assert.ok(preview.inside);assert.equal(preview.intercept,'none');if(slot===0)await screenshot(cdp,`${label}-${width}-preview-${index}`);});
  let after=await metrics(cdp,true);fixed(before,after,'drag',`${label} tray ${width}/${index}/${slot}`);assert.ok(after.pointer.trustedTouch>before.pointer.trustedTouch);assert.equal(after.pointer.cancels,before.pointer.cancels);assert.deepEqual((await state(cdp,true)).cases[index].points[slot],M.expected(index)[slot]);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);
  const head=await rect(cdp,'#activeHandle',true);before=await metrics(cdp,true);await dragTouch(cdp,head,{x:head.x+5,y:head.y+5});after=await metrics(cdp,true);fixed(before,after,'drag',`${label} active ${width}/${index}/${slot}`);assert.equal(after.pointer.cancels,before.pointer.cancels);
  report.push({index,slot,before,after,preview});
 }
 // Each scroll entrance is exercised independently in both directions.
 const s=filled();await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});
 for(const [entrance,selector] of [['left','.scroll-strip.left'],['right','.scroll-strip.right'],['background','#stage']])for(const direction of [-1,1]){
  await evaluate(cdp,'scrollTo(0,300)');await delay(100);const r=await rect(cdp,selector,true),start=entrance==='background'?{x:r.x+60,y:r.y-20}:{x:r.x,y:r.y-20};const before=await metrics(cdp,true);await dragTouch(cdp,start,{x:start.x,y:start.y+direction*45});const after=await metrics(cdp,true);fixed(before,after,'host',`${label} ${entrance}/${direction}`);assert.ok(Math.abs(after.host.y-before.host.y)>5);assert.equal(after.host.frame[1]-before.host.frame[1],before.host.y-after.host.y);report.push({entrance,direction,before,after});
 }
 await evaluate(cdp,'scrollTo(0,300)');await call(cdp,"d.getElementById('controlPanel').scrollTop=80;",true);await delay(100);
 for(const position of ['middle','top','bottom'])for(const direction of [-1,1]){
  await call(cdp,`const p=d.getElementById('controlPanel');p.scrollTop=${position==='top'?'0':position==='bottom'?'p.scrollHeight-p.clientHeight':'Math.min(120,p.scrollHeight-p.clientHeight-40)'};`,true);await delay(100);const r=await rect(cdp,'#controlPanel',true),start={x:r.x+40,y:r.y},before=await metrics(cdp,true);await dragTouch(cdp,start,{x:start.x,y:start.y+direction*45});const after=await metrics(cdp,true);fixed(before,after,'panel',`${label} panel ${position}/${direction}`);if(position==='middle')assert.notEqual(after.panel,before.panel);report.push({entrance:'panel',position,direction,before,after});
 }
 // Cancel, resizing, and a final pointer release outside the plot must keep the old answer.
 await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});const old=JSON.stringify(await state(cdp,true)),head=await rect(cdp,'#activeHandle',true);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint(head)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchPoint({x:head.x+25,y:head.y+25})]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(JSON.stringify(await state(cdp,true)),old);assert.equal(await call(cdp,"return d.getElementById('magnifier').hidden;",true),true);
 for(const lock of ['review','frozen','committed']){await navigate(cdp,base,{fixture:durableDraft(s),embedded:true});await click(cdp,'#checkButton',true);if(lock==='frozen')await call(cdp,'w.__failFinal=true;',true);if(lock==='committed')await call(cdp,'w.__failFinish=true;',true);await click(cdp,'#submitButton',true);assert.equal(await mode(cdp,true),lock);const before=await metrics(cdp,true),p=await target(cdp,0,0,true);await dragTouch(cdp,p,{x:p.x,y:p.y+40});const after=await metrics(cdp,true);fixed(before,after,'host',`${label} lock ${lock}`);assert.ok(Math.abs(after.host.y-before.host.y)>5);report.push({lock,before,after});}
 return report;
}
async function main(){
 fs.mkdirSync(artifactDir,{recursive:true});sourceParity();const tempRoot=fs.realpathSync(os.tmpdir()),servers=[];let profile,packageDirectory,chrome,cdp,targetId,failure;
 const report={activity:slug,engine:'Chrome/CDP trusted touch',viewports:{},flows:{},gestures:{},errors:[]};
 try{
  const browser=findBrowser();assert.ok(browser,'Chrome required');const extracted=buildAndExtractPackage(tempRoot,{slug,packagePrefix:'simlab-motion-package-',packageNamePattern:/^simlab-motion-package-[A-Za-z0-9]+$/});packageDirectory=extracted.packageDirectory;
  for(const name of sourceParity().concat(`${slug}/index.html`))assert.equal(fs.readFileSync(path.join(root,'sim',name),'utf8'),fs.readFileSync(path.join(packageDirectory,name),'utf8'));
  profile=fs.mkdtempSync(path.join(tempRoot,'simlab-motion-chrome-'));chrome=spawn(browser,['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';chrome.stderr.on('data',b=>stderr=(stderr+b).slice(-3000));const port=await devToolsPort(profile,chrome).catch(e=>{e.message+=stderr;throw e;});
  async function fresh(){if(cdp){await cdp.send('Target.closeTarget',{targetId});cdp.close();}const {body:t}=await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});targetId=t.id;cdp=new CdpClient(t.webSocketDebuggerUrl,WebSocket,15000);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');await preload(cdp);cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));}
  await fresh();report.browser=await cdp.send('Browser.getVersion');
  for(const [label,directory] of [['source',path.join(root,'sim')],['package',packageDirectory]]){const server=createServer(directory);servers.push(server);await listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;await fresh();console.log(`motion composition: ${label} layout/flows`);report.viewports[label]=await visual(cdp,base,label);report.flows[label]=await flows(cdp,base,label);if(!process.argv.includes('--smoke'))for(const width of [390,320]){await fresh();console.log(`motion composition: ${label} trusted touch ${width}`);report.gestures[`${label}-${width}`]=await touch(cdp,base,label,width);}}
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(artifactDir,process.argv.includes('--smoke')?'smoke-report.json':'report.json'),JSON.stringify(report,null,2));
 }catch(e){failure=e;if(cdp){report.failureUI=await evaluate(cdp,"(()=>{const w=document.getElementById('activity')?.contentWindow||window;return {text:w.document.body.innerText,mode:w.__motionComposition?.getMode(),state:w.__motionComposition?.getState()};})()").catch(()=>null);await screenshot(cdp,'failure').catch(()=>{});}fs.writeFileSync(path.join(artifactDir,'failure.json'),JSON.stringify({message:e.stack,report},null,2));}
 try{if(chrome)await stopChrome(chrome,cdp);cdp?.close();for(const server of servers)await closeServer(server);for(const dir of [profile,packageDirectory].filter(Boolean)){validateOwnedDirectory(dir,tempRoot,/^simlab-motion-(?:chrome|package)-[A-Za-z0-9]+$/,'motion test artifact');fs.rmSync(dir,{recursive:true,force:false});}}catch(e){failure ||=e;}
 if(failure)throw failure;console.log('motion composition source/package browser checks passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={sourceParity,main};
