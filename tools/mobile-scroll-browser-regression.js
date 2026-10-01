#!/usr/bin/env node
"use strict";

// Trusted-touch acceptance: neutral hosts, production code, nonzero on failed or missing cases.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');
const { XMLParser } = require('fast-xml-parser');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const H = require(path.join(root, 'tools/position-time-browser-regression.js'));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('='); return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)];
}));
const A = require('./mobile-scroll-cases.js');
const O = require('./mobile-scroll-operations.js');
const mode = args.mode || 'source';
const topology = args.host || 'T2';
if (!['source','package','standalone'].includes(mode)) throw new Error('Unknown launch mode');
if (!['T0','T1','T2','T3'].includes(topology)) throw new Error('Unknown host topology');
args.nested = topology === 'T2' || topology === 'T3';
if (topology === 'T0' && mode !== 'standalone') throw new Error('T0 requires --mode=standalone');
if (args['native-probe'] || args['document-native-probe']) throw new Error('Diagnostic listener omission is forbidden in acceptance');
const viewports = String(args.viewports || '320x500,390x844').split(',').map(v => v.split('x').map(Number));
if (viewports.some(([width,height])=>!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)) throw new Error('Invalid viewport coverage');
const selected = args.slugs ? new Set(String(args.slugs).split(',')) : null;
const catalogue = require(path.join(root, 'sim/config.js')).simulationList.filter(s => !selected || selected.has(s.folder));
const stageSelector = '.sim-stage,.stage-region,.freefall-stage,section.stage';
const panelSelector = '.sim-panel,.control-panel,.controls-panel,.freefall-panel';
const report = { baseCommit: null, mode, engine: null, host: 'neutral same-origin iframe; no parent touch handlers or panel-lock message bridge', input: 'CDP Input.dispatchTouchEvent (trusted touch)', errors: [], cases: [], packages: [] };
report.followup={nested:Boolean(args.nested),parts:String(args.parts||''),visualBlank:Boolean(args['visual-blank']),fast:Boolean(args.fast),renderer:args.renderer||'default',documentNativeProbe:Boolean(args['document-native-probe'])};
if(args.nested)report.host='same-origin scrollable outer page; bounded non-scrolling wrapper iframe; bounded activity iframe; no touch handlers or panel-lock bridge in either host';
report.topology=topology;
if (!catalogue.length || (selected && [...selected].some(slug => !catalogue.some(s => s.folder === slug)))) throw new Error('Missing activity coverage');
function selectedProfiles(slug) {
  return args.phases==='all' ? A.profiles(slug) : slug==='centre-of-mass-investigation-lab' ? String(args.parts||'1,2,3').split(',').map(part=>({id:'part-'+part,part:Number(part)})) : [{id:'initial'}];
}
if(args.profiles){
  const available=new Set(catalogue.flatMap(sim=>selectedProfiles(sim.folder).map(profile=>profile.id)));
  for(const name of String(args.profiles).split(','))if(!available.has(name))throw new Error('Missing requested profile coverage: '+name);
}
report.completed=false;
function persistReport() {
  const prefix='mobile-scroll-acceptance-'+topology+'-'+(args.phases==='all'?'phases-':'');
  const output=args.output||path.join(root,'output/playwright/'+prefix+mode+'.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
let cdp, chrome, server, profile, currentRoot = path.resolve(args['scene-root'] || root);
const packageRoots = [];
let touchId = 200;

function hostHtml(src, height) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;scroll-behavior:auto}${topology === "T3" ? "html,body{height:100%;overflow:hidden}#scrollOwner{height:100dvh;overflow-y:auto}" : ""}.before{height:300px}iframe{display:block;width:100%;height:${height}px;border:0}.after{height:1500px}</style></head><body><main id="scrollOwner"><div class="before"></div><iframe id="activity" title="手機滾動測試"></iframe><div class="after"></div></main><script>window.__auditValues={"cmi.core.lesson_status":"not attempted"};window.API={LMSInitialize:()=>{if(window.__auditNextValues){Object.assign(window.__auditValues,window.__auditNextValues);window.__auditNextValues=null;}return "true";},LMSGetValue:k=>window.__auditValues[k]||"",LMSSetValue:(k,v)=>{if(window.__failFinal&&k==="cmi.core.score.raw"){window.__auditError="351";return "false";}window.__auditError="0";window.__auditValues[k]=String(v);return "true";},LMSCommit:()=>"true",LMSFinish:()=>"true",LMSGetLastError:()=>window.__auditError||"0",LMSGetErrorString:()=>"",LMSGetDiagnostic:()=>""};document.getElementById("activity").src=${JSON.stringify(args.nested?'/__scroll-audit-wrapper?src='+encodeURIComponent(src):src)};<\/script></body></html>`;
}

function runtimeDigest() {
  const files=new Set(),digestRoot=mode==='package'?root:path.resolve(args['scene-root']||root);
  for(const sim of catalogue){
    const manifest=path.join(digestRoot,'sim/manifests',sim.folder+'.xml');files.add(manifest);
    const parsed=new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(manifest,'utf8'));
    for(const resource of [].concat(parsed.manifest.resources.resource))for(const file of [].concat(resource.file||[]))files.add(path.join(digestRoot,'sim',file['@_href']));
  }
  const hash=crypto.createHash('sha256');
  for(const file of [...files].sort()){hash.update(path.relative(digestRoot,file)+'\0');hash.update(fs.readFileSync(file));}
  return {sha256:hash.digest('hex'),files:files.size,sourceRoot:digestRoot};
}

async function childEval(expression) {
  return H.evaluate(cdp, `(() => {const window=${mode === 'standalone' ? 'globalThis' : "globalThis.document.getElementById('activity').contentWindow" + (args.nested ? ".document.getElementById('activity').contentWindow" : '')};const document=window.document;const auditHost=window.parent!==window?window.top:window;const scrollOwner=auditHost.document.getElementById('scrollOwner');const ownerScroll=()=>topologyOwner();const topologyOwner=()=>${topology === 'T3' ? 'scrollOwner.scrollTop' : 'auditHost.scrollY'};const frameOffset=()=>{let left=0,top=0;for(let w=window;w!==w.top;w=w.parent){const r=w.frameElement.getBoundingClientRect();left+=r.left;top+=r.top;}return {left,top};};return (${expression});})()`);
}

async function observation() {
  return childEval(`(() => {
    const p=document.querySelector(${JSON.stringify(panelSelector)}), s=document.querySelector(${JSON.stringify(stageSelector)});
    const embedded=window.parent!==window, host=auditHost, iframe=embedded?host.document.getElementById('activity'):null, frame=frameOffset();
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const vv=w=>w.visualViewport?Object.fromEntries(['pageTop','pageLeft','offsetTop','offsetLeft','width','height','scale'].map(k=>[k,w.visualViewport[k]])):null;
    const scrollers=[...document.querySelectorAll('*')].filter(e=>{const c=window.getComputedStyle(e);return /auto|scroll/.test(c.overflowY)&&e.scrollHeight>e.clientHeight+1;}).map(e=>({id:e.id,class:e.className?.baseVal||e.className,top:e.scrollTop,range:e.scrollHeight-e.clientHeight,height:e.clientHeight}));
    const hooks=['__forceCompositionApp','__forceOrthogonalApp','__equilibriumApp','__advancedEquilibriumApp','__reactionApp','__newtonApp','__kinematicsGraphDebug','__centreMassDebug','__hookesLawApp','__staticKineticFrictionApp','__motionComposition'];
    const state={};for(const name of hooks){const app=window[name];if(app?.getState)state[name]=app.getState();}
    if(window.__freeFallDebug?.state)state.freeFall=window.__freeFallDebug.state();
    if(window.__kinematicsQuantitativeDebug?.state)state.quantitative=window.__kinematicsQuantitativeDebug.state();
    const forms=[...document.querySelectorAll('input,select')].map(e=>({id:e.id,name:e.name,value:e.value,checked:e.checked}));
    const phase=[...document.querySelectorAll('[data-phase],[data-step],[aria-pressed=true],[aria-selected=true]')].map(e=>({id:e.id,phase:e.dataset.phase,step:e.dataset.step,pressed:e.getAttribute('aria-pressed'),selected:e.getAttribute('aria-selected')}));
    return {host:ownerScroll(),outerWindow:host.scrollY,hostX:host.scrollX,hostViewport:vv(host),immediateParent:window.parent.scrollY,immediateParentRange:Math.max(0,window.parent.document.scrollingElement.scrollHeight-window.parent.document.scrollingElement.clientHeight),renderer:window.__centreMassDebug?.renderer?.()||null,orbit:rect(document.querySelector('.orbit-target')),iframe:embedded?{x:frame.left,y:frame.top,width:window.innerWidth,height:window.innerHeight}:null,document:window.scrollY,documentX:window.scrollX,viewport:vv(window),panel:p?.scrollTop??null,panelRange:p?Math.max(0,p.scrollHeight-p.clientHeight):null,panelBounds:rect(p),stageBounds:rect(s),documentRange:Math.max(0,document.scrollingElement.scrollHeight-document.scrollingElement.clientHeight),documentHeight:document.scrollingElement.scrollHeight,scrollers,state:{hooks:state,forms,phase,suspend:embedded?host.__auditValues?.['cmi.suspend_data']||'':null},events:window.__auditEvents||[]};
  })()`);
}

async function prepare(region, position) {
  await childEval(`(() => {
    window.__auditEvents=[];
    const p=document.querySelector(${JSON.stringify(panelSelector)});
    if(p)p.scrollTop=${position === 'top' ? '0' : position === 'bottom' ? 'p.scrollHeight' : 'Math.min(70,Math.max(0,(p.scrollHeight-p.clientHeight)/2))'};
    window.scrollTo(0,0);
    const el=document.querySelector(${JSON.stringify(region === 'stage' ? stageSelector : panelSelector)});
    if(!el)throw new Error('Missing ${region}');
    if(window.parent!==window){const f=frameOffset();const r=el.getBoundingClientRect();const absolute=f.top+ownerScroll()+r.top;${topology === 'T3' ? 'scrollOwner.scrollTop=Math.max(100,absolute+r.height/2-auditHost.innerHeight/2);' : 'auditHost.scrollTo(0,Math.max(100,absolute+r.height/2-auditHost.innerHeight/2));'}}
    return true;
  })()`);
  await H.delay(160);
  await childEval(`(() => {const p=document.querySelector(${JSON.stringify(panelSelector)});if(p)p.scrollTop=${position === "top" ? "0" : position === "bottom" ? "p.scrollHeight" : "Math.min(70,Math.max(0,(p.scrollHeight-p.clientHeight)/2))"};return true;})()`);
}

async function blankPoint(region, direction, edge) {
  return childEval(`(() => {
    const el=document.querySelector(${JSON.stringify(region === 'stage' ? stageSelector : panelSelector)}),r=el.getBoundingClientRect();
    const embedded=window.parent!==window, f=frameOffset();
    const host=auditHost;
    const left=Math.max(r.left,0),right=Math.min(r.right,window.innerWidth),top=Math.max(r.top,0,-f.top),bottom=Math.min(r.bottom,window.innerHeight,host.innerHeight-f.top);
    const travel=Math.min(88,Math.max(20,(bottom-top)*.42)),delta=${direction === 'up' ? '-travel' : 'travel'};
    const xs=${edge === 'left' ? '[left+16]' : edge === 'right' ? '[right-16]' : region === 'panel' ? '[left+6,right-6,left+16,right-16,left+(right-left)*.5]' : '[left+16,right-16]'};
    for(const x of xs)for(const fy of [.5,.62,.38,.75,.25]){
      const y=top+(bottom-top)*fy;if(y+delta<top+4||y+delta>bottom-4)continue;
      const t=document.elementFromPoint(x,y);if(!t||!el.contains(t))continue;
      const excluded=${JSON.stringify(region === 'stage' ? 'input,select,a,.stage-navigation' : 'input,select,label,.quantity-control,[data-drag],[data-hit]')};
      if(t.closest(excluded))continue;
      if(${JSON.stringify(region)} === "panel" && [-4,0,4].some(dx=>[-4,0,4].some(dy=>document.elementFromPoint(x+dx,y+dy)?.closest(excluded))))continue;
      return {x:x+f.left,y:y+f.top,localX:x,localY:y,delta,target:t.id||t.tagName,classes:t.className?.baseVal||t.className,touchAction:window.getComputedStyle(t).touchAction};
    }
    return {unavailable:true,region:${JSON.stringify(region)},bounds:{left,right,top,bottom},edge:${JSON.stringify(edge || null)}};
  })()`);
}

async function panelContentPoint(surface) {
  const result=await childEval(`(() => {
    const panel=document.querySelector(${JSON.stringify(panelSelector)}),r=panel.getBoundingClientRect(),f=frameOffset();
    const selector=${JSON.stringify(surface)}==='button'?'button:not(:disabled)':'p,h2,h3';
    for(const node of panel.querySelectorAll(selector)){
      if(!node.getClientRects().length || !node.textContent.trim())continue;
      const n=node.getBoundingClientRect();
      panel.scrollTop+=n.top+n.height/2-r.top-r.height/2;
      const t=node.getBoundingClientRect(),top=Math.max(r.top,0,-f.top),bottom=Math.min(r.bottom,window.innerHeight,auditHost.innerHeight-f.top);
      const x=t.left+t.width/2,y=t.top+t.height/2,hit=document.elementFromPoint(x,y);
      const travel=Math.min(72,y-top-8);
      if(y<top+24||y>bottom-12||travel<20||!hit||!(hit===node||node.contains(hit)))continue;
      return {x:x+f.left,y:y+f.top,localX:x,localY:y,delta:-travel,target:hit.id||hit.tagName,control:node.id||node.dataset.action||node.tagName,surface:${JSON.stringify(surface)},touchAction:window.getComputedStyle(hit).touchAction};
    }
    throw new Error('Missing reachable '+${JSON.stringify(surface)}+' panel target');
  })()`);
  await H.delay(100);return result;
}

// Observe production gestures without a host lock, scroll bridge or input interception.
async function startPanelTrace() {
  await childEval(`(() => {
    window.__auditPanelTrace?.stop();
    const trace={samples:[],styleChanges:[]}, cleanup=[], panel=document.querySelector(${JSON.stringify(panelSelector)});
    const capture=label=>{const f=frameOffset();trace.samples.push({label,time:window.performance.now(),host:ownerScroll(),outerWindow:auditHost.scrollY,page:window.scrollY,panel:panel?.scrollTop||0,iframeY:f.top});};
    for(let w=window,depth=0;;w=w.parent,depth++){
      const current=w, level=depth;
      const listener=()=>capture('scroll-'+level);
      current.addEventListener('scroll',listener,true);cleanup.push(()=>current.removeEventListener('scroll',listener,true));
      // Only the containing pages' topology is externally owned; standalone
      // also owns its bounded root and must never change it for a panel touch.
      if(current!==window || window===window.top){
        const nodes=[current.document.documentElement,current.document.body];
        if(current===auditHost&&scrollOwner)nodes.push(scrollOwner);
        const observer=new window.MutationObserver(records=>{for(const record of records)trace.styleChanges.push({depth:level,node:record.target.id||record.target.tagName,oldStyle:record.oldValue,newStyle:record.target.getAttribute('style')});capture('host-style');});
        for(const node of new Set(nodes.filter(Boolean)))observer.observe(node,{attributes:true,attributeFilter:['style'],attributeOldValue:true});
        cleanup.push(()=>observer.disconnect());
      }
      if(current===window.top)break;
    }
    let raf;
    const tick=()=>{capture('frame');raf=window.requestAnimationFrame(tick);};
    capture('before-touch');raf=window.requestAnimationFrame(tick);
    window.__auditPanelTrace={stop:()=>{window.cancelAnimationFrame(raf);capture('finished');cleanup.forEach(fn=>fn());delete window.__auditPanelTrace;return trace;}};
    return true;
  })()`);
}
async function finishPanelTrace() {return childEval(`window.__auditPanelTrace.stop()`);}
function panelTraceIssues(before, trace) {
  const issues=[];
  if(!trace?.samples?.length)return ['missing panel scroll trace'];
  if(trace.styleChanges.length)issues.push('panel gesture changed containing page styles');
  for(const sample of trace.samples){
    if(Math.abs(sample.host-before.host)>1.1)issues.push('host moved during panel trace');
    if(Math.abs(sample.outerWindow-before.outerWindow)>1.1)issues.push('outer window moved during panel trace');
    if(Math.abs(sample.page-before.document)>1.1)issues.push('activity document moved during panel trace');
    if(before.iframe&&Math.abs(sample.iframeY-before.iframe.y)>1.1)issues.push('iframe moved during panel trace');
  }
  return [...new Set(issues)];
}

async function swipe(point, releaseTimes = [20,100,400,1000], ending = 'touchEnd') {
  const id=touchId++;const touch=y=>({x:point.x,y,id,radiusX:5,radiusY:5,force:1});
  const samples=[];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(point.y)]});
  samples.push({...await childEval(`({host:ownerScroll(),outerWindow:auditHost.scrollY,page:window.scrollY,panel:document.querySelector(${JSON.stringify(panelSelector)})?.scrollTop||0})`),atTouchStart:true});
  for(let i=1;i<=8;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(point.y+point.delta*i/8)]});
    await H.delay(args.fast?8:20);
    samples.push(await childEval(`({host:ownerScroll(),outerWindow:auditHost.scrollY,page:window.scrollY,panel:document.querySelector(${JSON.stringify(panelSelector)})?.scrollTop||0})`));
  }
  await cdp.send('Input.dispatchTouchEvent',{type:ending,touchPoints:[]});
  let previousTime=0;for(const time of releaseTimes){await H.delay(time-previousTime);previousTime=time;samples.push({...await childEval(`({host:ownerScroll(),outerWindow:auditHost.scrollY,page:window.scrollY,panel:document.querySelector(${JSON.stringify(panelSelector)})?.scrollTop||0})`),afterReleaseMs:time});}return samples;
}

function layoutIssues(observation) {
  const issues=[],panel=observation.panelBounds,height=observation.viewport?.height;
  if(panel&&panel.height<95)issues.push('control panel has less than 96px usable height');
  if(panel&&height&&(panel.y<-1.1||panel.y+panel.height>height+1.1))issues.push('control panel extends outside the activity viewport');
  return issues;
}

function differences(before,after,region,direction,position) {
  const issues=[...layoutIssues(before),...layoutIssues(after)];const tolerance=1.1;
  if(before.documentRange>tolerance||after.documentRange>tolerance)issues.push('activity document has an unintended scroll range');
  if(Math.abs(after.document-before.document)>tolerance)issues.push('activity document scrolled');
  if(Math.abs(after.documentX-before.documentX)>tolerance)issues.push('activity horizontal scroll');
  const semantic=state=>({hooks:state.hooks,forms:state.forms,phase:state.phase});
  if(JSON.stringify(semantic(after.state))!==JSON.stringify(semantic(before.state)))issues.push('learner state changed');
  if(after.state.suspend!==before.state.suspend)issues.push('SCORM checkpoint changed during blank swipe');
  const vv=(a,b)=>Math.abs(a.pageTop-b.pageTop)>tolerance||Math.abs(a.pageLeft-b.pageLeft)>tolerance||Math.abs(a.offsetTop-b.offsetTop)>tolerance||Math.abs(a.offsetLeft-b.offsetLeft)>tolerance||Math.abs(a.scale-b.scale)>.001;
  if(before.viewport&&after.viewport&&vv(before.viewport,after.viewport))issues.push('activity visual viewport moved');
  if(topology==='T3'&&Math.abs(after.outerWindow-before.outerWindow)>tolerance)issues.push('T3 window moved instead of declared element owner');
  if(topology!=='T1'&&mode!=='standalone'&&Math.abs(after.immediateParent)>tolerance)issues.push('nonowner wrapper scrolled');
  if(region==='stage'){
    if(Math.abs(after.panel-before.panel)>tolerance)issues.push('stage swipe moved sibling panel');
    if(mode!=='standalone'&&(direction==='up'?after.host-before.host:before.host-after.host)<3)issues.push('host did not scroll in swipe direction');
    if(mode!=='standalone'&&after.iframe&&before.iframe&&Math.abs(after.iframe.y-before.iframe.y+after.host-before.host)>tolerance)issues.push('iframe motion differs from host scroll');
  }else{
    if(Math.abs(after.host-before.host)>tolerance)issues.push('panel gesture leaked to host');
    if(after.iframe&&before.iframe&&Math.abs(after.iframe.y-before.iframe.y)>tolerance)issues.push('panel gesture moved iframe');
    if(before.hostViewport&&after.hostViewport&&vv(before.hostViewport,after.hostViewport))issues.push('panel gesture moved host visual viewport');
    const available=direction==='up'?before.panelRange-before.panel:before.panel;
    if(position==='middle'&&before.panelRange>2&&(direction==='up'?after.panel-before.panel:before.panel-after.panel)+tolerance<Math.min(3,available))issues.push('panel did not scroll in swipe direction');
    if(position!=='middle'&&Math.abs(after.panel-before.panel)>tolerance)issues.push('panel boundary moved');
  }
  return issues;
}

async function handoff(selector) {
  const first=await childEval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing required operation target');const r=e.getBoundingClientRect(),f=frameOffset();return{x:f.left+r.left+r.width/2,y:f.top+r.top+r.height/2};})()`);
  const second=await blankPoint('stage','up','left'),id=touchId++,other=touchId++;
  const point=(p,key)=>({x:p.x,y:p.y,id:key,radiusX:3,radiusY:3,force:1});
  const started={...first,x:first.x+12};const samples=[];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(first,id)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(started,id)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(started,id),point(second,other)]});
  for(let i=1;i<=8;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(started,id),point({...second,y:second.y-i*6},other)]});await H.delay(20);
    samples.push(await childEval(`({host:ownerScroll(),outerWindow:auditHost.scrollY,page:window.scrollY,panel:document.querySelector(${JSON.stringify(panelSelector)})?.scrollTop||0})`));
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(150);return {first,second,samples};
}

function gestureIssues(before,after,samples,test) {
  const issues=differences(before,after,test.region,test.direction,test.position);
  if (!samples.length) issues.push('missing movement samples');
  if(test.region==='stage'&&mode!=='standalone') {
    const positions=[before.host,...samples.filter(s=>!s.afterReleaseMs).map(s=>s.host)];
    if(positions.slice(1).some((value,index)=>(value-positions[index])*(test.direction==='up'?1:-1)<-1.1))issues.push('host reversed during a one-direction swipe');
  }
  for(const sample of samples) {
    if(Math.abs(sample.page-before.document)>1.1)issues.push('activity document moved during gesture');
    if(test.region==='stage'&&Math.abs(sample.panel-before.panel)>1.1)issues.push('sibling panel moved during stage gesture');
    if(test.region==='panel'&&Math.abs(sample.host-before.host)>1.1)issues.push('host moved during panel gesture');
    if(topology==='T3'&&Math.abs(sample.outerWindow-before.outerWindow)>1.1)issues.push('T3 nonowner window moved during gesture');
  }
  if(!after.events.some(e=>e.type==='pointerdown'&&e.isTrusted&&e.pointerType==='touch'))issues.push('trusted touch pointer missing');
  if(test.region==='panel'&&after.events.some(e=>e.type==='click'&&e.isTrusted))issues.push('panel swipe activated a control');
  return [...new Set(issues)];
}
module.exports={gestureIssues,layoutIssues,panelTraceIssues};

async function load(base, launch, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:args.handoff||args.operations?2:1});
  await cdp.send('Page.navigate',{url:mode==='standalone'?base+launch:base+'/__scroll-audit-host?height='+String(args['iframe-height']||500)+'&src='+encodeURIComponent(launch)});
  for(let i=0;i<100;i++){
    try {if(await childEval(`document.readyState==='complete'&&Boolean(document.querySelector(${JSON.stringify(stageSelector)}))&&Boolean(document.querySelector(${JSON.stringify(panelSelector)}))`))break;}catch{}
    if(i===99)throw new Error('Activity did not load '+launch);await H.delay(60);
  }
  await H.delay(250);
  if(args['resultant-fixture']){
    await childEval(`(() => {
      const app=window.__forceCompositionApp,M=window.ForceCompositionModel,P=window.ForceCompositionPersistence;
      const state=app.getState();state.phase='practice';state.currentQuestion=2;
      const question=app.getScenario().questions[2];let answer=state.answers[2];
      answer=M.commitForceTranslation(answer,0,M.endpointForKey(answer,question,'ORIGIN'),question);
      answer=M.commitForceTranslation(answer,1,M.endpointForKey(answer,question,'F1_HEAD'),question);
      if(!M.resultantAvailable(answer,question))throw new Error('Draft is not ready for resultant drawing');
      state.answers[2]=answer;const encoded=P.encodeDraft(state);P.decodeDraft(encoded);
      auditHost.__auditValues['cmi.suspend_data']=JSON.stringify(window.SimScorm.makeSnapshot(P.ACTIVITY,'draft',encoded));
      auditHost.__auditValues['cmi.core.lesson_status']='incomplete';window.location.reload();return true;
    })()`);
    await H.delay(250);
    for(let i=0;i<100;i++){
      try{if(await childEval(`window.__forceCompositionApp?.getState()?.currentQuestion===2&&document.getElementById('drawResultant')?.disabled===false`))break;}catch{}
      if(i===99)throw new Error('Could not restore validated resultant fixture');await H.delay(50);
    }
    await childEval(`(() => {document.getElementById('drawResultant').click();if(!document.getElementById('stage').classList.contains('resultant-draw-ready'))throw new Error('Drawing mode did not open');return true;})()`);
    await H.delay(100);
  }
}

async function main() {
  report.runtime=runtimeDigest();
  report.branch=spawnSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).stdout.trim();
  report.baseCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__scroll-audit-wrapper'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%}</style><iframe id=activity src='+JSON.stringify(url.searchParams.get('src'))+'></iframe>');return;}
    if(url.pathname==='/__scroll-audit-host'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(hostHtml(url.searchParams.get('src'),Number(url.searchParams.get('height'))));return;}
    const resolved=H.resolvePackageFile(decodeURIComponent(url.pathname),{packageRoot:currentRoot});
    if(resolved.status!==200){res.writeHead(resolved.status).end('Missing file');return;}
    fs.readFile(resolved.filePath,(error,data)=>{if(error)res.writeHead(500).end('Read failed');else res.writeHead(200,{'content-type':H.contentType(resolved.filePath),'cache-control':'no-store'}).end(data);});
  });
  await H.listenServer(server);const base='http://127.0.0.1:'+server.address().port;
  profile=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'simlab-scroll-audit-chrome-'));
  chrome=spawn(H.findBrowser(),['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.resume();const port=await H.devToolsPort(profile,chrome);
  const {body:target}=await H.fetchJson('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'});
  cdp=new H.CdpClient(target.webSocketDebuggerUrl);await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.on('Runtime.exceptionThrown',event=>{report.errors.push(event.exceptionDetails?.exception?.description||event.exceptionDetails?.text||'Runtime exception');process.exitCode=1;});
  cdp.on('Runtime.consoleAPICalled',event=>{if(['error','assert'].includes(event.type)){report.errors.push(event.args.map(a=>a.value||a.description||'').join(' '));process.exitCode=1;}});
  cdp.on('Page.javascriptDialogOpening',()=>{cdp.send('Page.handleJavaScriptDialog',{accept:true}).catch(error=>{console.error(error);process.exitCode=1;});});
  report.engine=await cdp.send('Browser.getVersion');
  for(const sim of catalogue){
    let launch='/sim/'+sim.folder+'/index.html';
    if(mode==='package'){
      const packaged=H.buildAndExtractPackage(fs.realpathSync(os.tmpdir()),{slug:sim.folder,packagePrefix:'simlab-scroll-audit-package-',packageNamePattern:/^simlab-scroll-audit-package-[A-Za-z0-9]+$/});
      currentRoot=packaged.packageDirectory;packageRoots.push(currentRoot);launch=packaged.activityPath;report.packages.push({slug:sim.folder,zip:path.join(root,'output',sim.folder+'-scorm.zip'),launch});
    }
    const profiles=selectedProfiles(sim.folder).filter(p=>!args.profiles||String(args.profiles).split(',').includes(p.id));
    if(!profiles.length)throw new Error('Missing requested phase coverage: '+sim.folder);
    for(const [width,height] of viewports)for(const spec of profiles){
      const part=spec.part||null;
      const renderer=spec.renderer||args.renderer;
      await load(base,launch+(renderer?'?renderer='+encodeURIComponent(renderer):''),width,height);
      const hooks={'static-kinetic-friction-investigation-lab':'__staticKineticFrictionApp','force-composition-construction-lab':'__forceCompositionApp','force-orthogonal-decomposition':'__forceOrthogonalApp','force-equilibrium-diagram-lab':'__equilibriumApp','force-equilibrium-advanced-diagram-lab':'__advancedEquilibriumApp','newtons-second-law-investigation-lab':'__newtonApp','newtons-third-law-reaction-force-lab':'__reactionApp','centre-of-mass-investigation-lab':'__centreMassDebug'};
      if(hooks[sim.folder]&&!await childEval(`Boolean(window[${JSON.stringify(hooks[sim.folder])}]?.getState?.())`))throw new Error('Activity failed to initialize: '+sim.folder);
      if(spec.prepare){if(mode==='standalone'&&spec.prepare.includes('restore('))throw new Error('Restore profiles require a mocked LMS host');const outcome=await childEval(`(()=>{const click=selector=>{const e=document.querySelector(selector);if(!e||e.disabled)throw new Error('Required UI continuation unavailable: '+selector);e.click();};const restore=(activity,answer)=>{auditHost.__auditNextValues={'cmi.core.lesson_status':'incomplete','cmi.suspend_data':JSON.stringify(window.SimScorm.makeSnapshot(activity,'draft',answer))};window.location.reload();return {reload:true,answer};};${spec.prepare};return true;})()`);if(outcome?.reload){await H.delay(200);for(let i=0;i<100;i++){try{if(await childEval(`document.readyState==='complete'&&Boolean(document.querySelector(${JSON.stringify(stageSelector)}))`))break;}catch{}if(i===99)throw new Error('Production fixture failed to restore');await H.delay(50);}if(outcome.answer&&!await childEval(`JSON.stringify(JSON.parse(auditHost.__auditValues['cmi.suspend_data']).answer)===${JSON.stringify(JSON.stringify(outcome.answer))}`))throw new Error('Restored canonical fixture was overwritten: '+spec.id);}}
      if(spec.continue)for(const selector of spec.continue)await childEval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw new Error('Continuation unavailable: ${spec.id} ${selector} '+JSON.stringify(window.__forceOrthogonalApp?.getState()));e.click();return true;})()`);
      if(spec.expect&&!await childEval(spec.expect))throw new Error('Wrong phase after continuation: '+spec.id);
      await H.delay(spec.settleMs||100);
      if(part){await childEval(`(()=>{const tab=document.querySelector('[data-part-tab="${part}"]');if(!tab||tab.disabled)throw new Error('Part unavailable');tab.click();return true;})()`);for(let i=0;i<100;i++){const ready=await childEval(`window.__centreMassDebug?.getState()?.phase==='part${part}'&&window.__centreMassDebug.renderer().mode!=='loading'`);if(ready)break;if(i===99)throw new Error('Part failed to open');await H.delay(50);}await H.delay(120);}
      if(spec.expectReady&&!await childEval(spec.expectReady))throw new Error('Wrong renderer or variant: '+spec.id);
      await childEval(`(()=>{window.__auditEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','click'])document.addEventListener(type,e=>window.__auditEvents.push({type,isTrusted:e.isTrusted,pointerType:e.pointerType||'',pointerId:e.pointerId,target:e.target.id||e.target.tagName,clientY:e.clientY??null,screenY:e.screenY??null,defaultPrevented:e.defaultPrevented}),true);return true;})()`);
      const entry={slug:sim.folder,title:sim.title,profile:spec.id,part,viewport:{width,height,iframeHeight:mode==='standalone'?null:Number(args['iframe-height']||500)},initial:await observation(),gestures:[]};
      const tests=[{region:'stage',direction:'up',edge:'left'}, {region:'stage',direction:'down',edge:'left'}, {region:'stage',direction:'up',edge:'right'}, {region:'stage',direction:'down',edge:'right'}, {region:'panel',direction:'up',position:'middle'}, {region:'panel',direction:'down',position:'middle'}, {region:'panel',direction:'down',position:'top'}, {region:'panel',direction:'up',position:'bottom'}];
      if(part===3)for(const edge of ['top','bottom'])for(const direction of ['up','down'])tests.push({region:'stage',direction,edge});
      if(spec.noStageReason&&entry.initial.stageBounds.width>1.1&&entry.initial.stageBounds.height>1.1)throw new Error('N/A declaration contradicts visible stage: '+spec.id);
      for(const test of tests){
        if(test.region==='stage'&&spec.noStageReason){entry.gestures.push({...test,notApplicable:spec.noStageReason,issues:[]});continue;}
        if(args['resultant-fixture']&&test.region==='stage')await childEval(`(() => {const b=document.getElementById('deleteResultant');if(!b.hidden)b.click();return true;})()`);
        await prepare(test.region,test.position||'middle');let point=await blankPoint(test.region,test.direction,test.edge);
        if(part===3&&test.region==='stage'){
          point=await childEval(`(()=>{const r=document.getElementById('stage').getBoundingClientRect(),f=frameOffset(),x=r.left+r.width*${test.edge==='right'?'.88':test.edge==='left'?'.12':'.35'},y=r.top+r.height*${test.edge==='top'?'.12':test.edge==='bottom'?'.88':'.5'},t=document.elementFromPoint(x,y);return {x:x+f.left,y:y+f.top,localX:x,localY:y,delta:${test.direction==='up'?'-':'+'}${test.edge==='top'||test.edge==='bottom'?'40':'70'},target:t.id||t.tagName,classes:t.className?.baseVal||t.className,touchAction:window.getComputedStyle(t).touchAction,probe:'visually blank region inside transparent orbit target'};})()`);
        }
        if(args['resultant-fixture']&&test.region==='stage'){
          point=await childEval(`(() => {const stage=document.getElementById('stage'),r=stage.getBoundingClientRect(),f=frameOffset(),x=${test.direction === 'up' ? 'r.left+16' : 'r.right-16'},y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x:x+f.left,y:y+f.top,localX:x,localY:y,delta:${test.direction === 'up' ? '-70' : '70'},target:t.id||t.tagName,classes:t.className?.baseVal||t.className,touchAction:window.getComputedStyle(stage).touchAction,edge:${JSON.stringify(test.direction === 'up' ? 'left' : 'right')}};})()`);
        }
        if(point.unavailable){entry.gestures.push({...test,point,issues:[...layoutIssues(entry.initial),'no non-interactive swipe point found']});continue;}
        if(args.screenshot&&part===3&&test.region==='stage'&&test.direction==='up'){const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(String(args.screenshot),Buffer.from(shot.data,'base64'));}
        const before=await observation();
        if(test.region==='panel')await startPanelTrace();
        const samples=await swipe(point),after=await observation();
        const trace=test.region==='panel'?await finishPanelTrace():null;
        const issues=[...gestureIssues(before,after,samples,test),...(trace?panelTraceIssues(before,trace):[])];
        entry.gestures.push({...test,point,before,after,samples,...(trace?{trace}:{}),issues});
      }
      if(args['panel-sequence'])for(const surface of ['text','button','cancel','after-cancel']){
        await prepare('panel','middle');
        const point=['text','button'].includes(surface)?await panelContentPoint(surface):await blankPoint('panel','up');
        if(point.unavailable)throw new Error('Panel interruption point is unavailable');
        const before=await observation();await startPanelTrace();
        const samples=await swipe(point,[20,100,400,1000],surface==='cancel'?'touchCancel':'touchEnd'),after=await observation(),trace=await finishPanelTrace();
        const test={region:'panel',direction:'up',position:'middle',case:'panel-'+surface};
        entry.gestures.push({...test,point,before,after,samples,trace,issues:[...gestureIssues(before,after,samples,test),...panelTraceIssues(before,trace)]});
      }
      if(args['panel-sequence']){
        await prepare('panel','middle');
        const before=await observation(),points=[],samples=[];
        await startPanelTrace();
        for(let index=0;index<2;index++){
          const point=await blankPoint('panel','up');
          if(point.unavailable)throw new Error('Repeated panel touch has no reachable point');
          points.push(point);samples.push(...await swipe(point,index===0?[20,100]:[20,100,400,1000]));
        }
        const after=await observation(),trace=await finishPanelTrace();
        const test={region:'panel',direction:'up',position:'middle',case:'repeated-panel-swipes-100ms-gap'};
        entry.gestures.push({...test,points,before,after,samples,trace,issues:[...gestureIssues(before,after,samples,test),...panelTraceIssues(before,trace)]});
        // The next background gesture must stay usable after repeated panel
        // touches; a leftover overflow lock cannot hide behind a restored Y.
        await prepare('stage','middle');
        const point=await blankPoint('stage','up','left');
        if(!spec.noStageReason){
          if(point.unavailable)throw new Error('Post-panel background is unreachable');
          const before=await observation(),samples=await swipe(point),after=await observation();
          const test={region:'stage',direction:'up',case:'background-after-repeated-panel-swipes'};
          entry.gestures.push({...test,point,before,after,samples,issues:gestureIssues(before,after,samples,test)});
        }
      }
      if(args.handoff&&spec.handoffTarget){
        await prepare('stage','middle');const before=await observation(),result=await handoff(spec.handoffTarget),after=await observation();
        const test={region:'stage',direction:'up',case:'G6-secondary-handoff'},issues=gestureIssues(before,after,result.samples,test);
        entry.gestures.push({...test,...result,before,after,issues});
      }
      if(args.operations&&sim.folder==='plane-mirror-pencil-ray-diagram')entry.gestures.push(...await O.runMirrorOperations({cdp,childEval,observation,prepare,swipe,delay:H.delay},spec));
      report.cases.push(entry);
      if(entry.gestures.some(g=>g.issues.length)){process.exitCode=1;const shot=await cdp.send('Page.captureScreenshot',{format:'png'});const dir=path.join(root,'output/playwright/mobile-scroll-failures');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,sim.folder+'-'+spec.id+'-'+topology+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
      console.log(JSON.stringify({slug:sim.folder,profile:spec.id,part,viewport:width+'x'+height,issues:entry.gestures.filter(g=>g.issues.length).map(g=>({gesture:g.case||g.region+'-'+g.direction+'-'+(g.position||''),issues:[...new Set(g.issues)]}))}));
      persistReport();
    }
  }
  if(!report.cases.length)throw new Error('No requested coverage executed');
  if(report.errors.length)throw new Error('Browser runtime diagnostics: '+report.errors.join('; '));
  report.completed=true;
}

if(require.main===module)main().catch(error=>{report.errors.push(error.message);console.error(error.stack);process.exitCode=1;}).finally(async()=>{
  try{await H.stopChrome(chrome,null);}catch(error){console.error(error.message);process.exitCode=1;}cdp?.close();
  if(server)await H.closeServer(server);
  if(profile&&fs.existsSync(profile)){const temp=fs.realpathSync(os.tmpdir());H.validateOwnedDirectory(profile,temp,/^simlab-scroll-audit-chrome-[A-Za-z0-9]+$/,'audit profile');fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:250});}
  for(const dir of packageRoots){H.validateOwnedDirectory(dir,fs.realpathSync(os.tmpdir()),/^simlab-scroll-audit-package-[A-Za-z0-9]+$/,'audit package');fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:250});}
  report.status=process.exitCode?'failed':report.completed?'passed':'incomplete';persistReport();
});
