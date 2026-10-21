#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process'),{XMLParser}=require('fast-xml-parser');
const H=require('./position-time-browser-regression.js'),M=require('../sim/circular-motion-vector-lab/model.js'),P=require('../sim/circular-motion-vector-lab/persistence.js'),T=require('../sim/circular-motion-vector-lab/test-support.js');
const root=path.resolve(__dirname,'..'),slug=M.ACTIVITY,out=path.join(root,'output/playwright',slug),report={errors:[],flows:[],layouts:[],drags:[],completed:false};
let cdp,chrome,profile,extracted,server,touchId=100;
const call=code=>H.evaluate(cdp,`(()=>{const w=window,d=document,app=w.__circularVectorApp;${code}})()`);
async function wait(fn,label){for(let i=0;i<140;i++){try{if(await fn())return;}catch(_){}await H.delay(35);}throw Error('Timeout: '+label);}
async function viewport(width,height){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await H.delay(70);}
async function open(base,s=null,extra={}){
  const values=extra.values||(s?{'cmi.core.lesson_status':'incomplete','cmi.suspend_data':JSON.stringify(T.snapshot(s))}:{'cmi.core.lesson_status':'not attempted'});
  const query=extra.standalone?'standalone=1'+(extra.deny?'&deny=1':''):'fixture='+encodeURIComponent(JSON.stringify(values))+(extra.retain?'&retain='+extra.retain:'');
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?${query}`});await wait(()=>call("return Boolean(app)&&d.readyState==='complete';"),'startup');await H.delay(70);
}
async function click(selector,trusted=false){
  if(trusted){const p=await call(`const e=d.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};`);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
  else await call(`const e=d.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});e.click();`);
  await H.delay(15);
}
const state=()=>call('return app.getState();');
async function screenshot(name){const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));}
async function centeredVelocity(){
  const r=await call(`const g=CircularVectorModel.scene(app.getState(),1),v=app.getGeometry().velocity,points=Object.values(g.nodes).map(p=>[v.origin[0]+p[0]*v.unit,v.origin[1]-p[1]*v.unit]);return{size:[v.width,v.height],center:[0,1].map(i=>{const a=points.map(p=>p[i]);return(Math.min(...a)+Math.max(...a))/2;})};`);
  r.center.forEach((n,i)=>assert(Math.abs(n-r.size[i]/2)<1e-7,JSON.stringify(r)));
  assert(await call(`const g=CircularVectorModel.scene(app.getState(),1),p=app.getGeometry().position,v=app.getGeometry().velocity;return [[g.rA,g.vA],[g.rB,g.vB]].every(([r,s])=>{const x=p.center[0]+p.unit*r[0]+v.unit*s[0],y=p.center[1]-p.unit*r[1]-v.unit*s[1];return x>=7&&x<=p.width-7&&y>=7&&y<=p.height-7;});`),'position velocity arrow clipped');
}
async function layouts(base,label){
  for(const [width,height]of [[320,500],[390,500],[390,600],[390,844],[665,604],[480,320],[320,225],[900,700],[1280,800],[2940,800]]){
    await viewport(width,height);
    for(let task=0;task<3;task++){
      const s=T.filled();s.task=task;s.observation[M.GAP_KEYS[task]]=5;await open(base,s);
      const r=await call(`const p=d.getElementById("controlPanel").getBoundingClientRect(),stage=d.getElementById("stage").getBoundingClientRect();d.getElementById("controlPanel").scrollTop=d.getElementById("controlPanel").scrollHeight;const last=d.getElementById("nextTask").getBoundingClientRect();return{panel:{y:p.y,height:p.height,bottom:p.bottom},stage:{width:stage.width,height:stage.height},rootRange:d.scrollingElement.scrollHeight-innerHeight,rootWidth:d.scrollingElement.scrollWidth,buttonBottom:last.bottom,buttonTop:last.top,viewport:{width:innerWidth,height:innerHeight},handle:d.getElementById("positionHandle").getBoundingClientRect().toJSON()};`);
      assert(r.panel.height>=95&&r.panel.y>=-1&&r.panel.bottom<=height+1,JSON.stringify(r));assert(r.rootRange<=1&&r.rootWidth<=width+1,JSON.stringify(r));assert(r.buttonBottom<=r.panel.bottom+1&&r.buttonTop>=r.panel.y-1,JSON.stringify(r));assert(r.stage.width>0&&r.stage.height>0);report.layouts.push({label,width,height,task,...r});
      assert(await call(`return [...d.querySelectorAll('#controlPanel p,#controlPanel legend,#controlPanel button,#controlPanel .choice-text')].filter(e=>e.getBoundingClientRect().height>0).every(e=>parseFloat(getComputedStyle(e).fontSize)>=18);`),'panel typography smaller than 18px');
      assert(await call(`return !d.querySelector('#stage [data-quantity]>rect,#stage [data-velocity-label]>rect')&&[...d.querySelectorAll('[data-tex]')].every(e=>!e.dataset.tex.includes('vec')&&!e.dataset.tex.includes('overrightarrow'));`),'opaque label or vector accent remains');
      assert(await call(`return !d.querySelector('#stage [data-quantity]>path,#stage [data-velocity-label]>path');`),'annotation leader remains');
      if(width>=900){const header=await call(`const nav=d.getElementById('taskNav').getBoundingClientRect(),check=d.getElementById('checkButton').getBoundingClientRect(),last=d.querySelector('#taskNav button:last-child').getBoundingClientRect();return{gap:check.left-nav.right,innerGap:nav.right-last.right};`);assert(header.gap>=0&&header.gap<=12&&Math.abs(header.innerGap)<1,JSON.stringify(header));}
      if(task===1){assert(await call(`return d.querySelectorAll('[data-velocity-label]').length===3&&[...d.querySelectorAll('[data-vector-node]')].map(e=>e.textContent.trim()).join('|')==='共同起點|初速度末端|末速度末端';`));await centeredVelocity();await click('#lengthen');await centeredVelocity();assert(await call(`return d.querySelectorAll('#positionSvg [data-quantity]').length===2&&d.querySelectorAll('#velocitySvg [data-quantity]').length===3;`),'missing velocity symbols');}else assert(await call(`return d.querySelector('#positionSvg [data-quantity="displacement"] [data-tex]')?.dataset.tex==='\\\\Delta x';`),'missing diagram displacement');
      if(task===1&&[[390,844],[665,604],[1280,800],[2940,800],[320,225]].some(p=>p[0]===width&&p[1]===height)){await call('d.getElementById("controlPanel").scrollTop=0;');await screenshot(`${label}-${width}x${height}-difference`);}
      await click('#checkButton');assert(await call('return d.getElementById("stage").getBoundingClientRect().height<1;'));await call('d.getElementById("controlPanel").scrollTop=d.getElementById("controlPanel").scrollHeight;');assert(await call('return d.getElementById("submitButton").getBoundingClientRect().bottom<=innerHeight+1;'));
    }
  }
}
async function pointLabels(base,label){
  for(const [width,height]of [[320,500],[390,844]]){
    await viewport(width,height);
    for(const angle of [0,37,90,143,180,217,270,323])for(const gap of [5,60]){
      const s=M.fresh(()=>0);s.definition.startIndex=Math.floor(angle/90);s.definition.startOffsetDeg=angle%90;s.observation.positionGapDeg=gap;await open(base,s);
      assert.equal(await call('return app.controller.mode;'),'edit');
      const r=await call(`const geo=app.getGeometry().position,svg=d.getElementById('positionSvg'),labels=[...svg.querySelectorAll('[data-point-label]')].map(e=>e.getBoundingClientRect().toJSON()),readouts=d.getElementById('readouts').getBoundingClientRect().toJSON();return{geo,labels,readouts,tex:d.getElementById('distanceReadout').querySelector('svg').dataset.tex,math:d.getElementById('definition').querySelectorAll('[data-tex]').length};`);
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      assert.equal(r.labels.length,2);assert(!overlap(...r.labels));assert(r.labels.every(p=>p.height>=16&&!overlap(p,r.readouts)));assert(r.tex.startsWith('\\Delta x=')&&!/[|]|vec/.test(r.tex));assert(r.math>0);
      if(width===390&&angle===37)await screenshot(`${label}-first-part-${gap}`);
    }
  }
  report.flows.push({label,pointLabelLayouts:32,mathDisplacement:'Delta x',arbitraryStart:true});
}
async function largeChoiceCards(base,label){
  await viewport(390,844);await open(base);
  const p=await call(`const card=d.querySelector('[data-question="velocityDirection"] .direction-choice'),input=card.querySelector('input');card.scrollIntoView({block:'center'});const r=card.getBoundingClientRect(),svg=card.querySelector('svg').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,art:svg.width,value:input.value,opacity:getComputedStyle(input).opacity,text:card.textContent.trim(),count:card.parentElement.children.length};`);
  assert(p.width>=150&&p.art>=p.width-12&&p.opacity==='0'&&p.text===''&&p.count===4,JSON.stringify(p));
  const touch={x:p.x,y:p.y,id:touchId++,radiusX:1,radiusY:1,force:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(40);assert.equal((await state()).answers.velocityDirection,p.value);
  await call(`d.querySelector('[data-question="velocityDirection"] input:checked').focus();`);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});assert.notEqual((await state()).answers.velocityDirection,p.value);
  await screenshot(label+'-large-choice-cards');report.flows.push({label,largeImageChoices:true,trustedCardTap:true,nativeKeyboard:true});
}
async function savedChoiceOrders(base,label){
  const s=M.fresh(()=>0);s.definition.choiceRanks=[23,5,22,4,21,20,3];await viewport(390,844);await open(base,s,{retain:label+'-orders'});
  const order=await call(`return [...d.querySelectorAll('fieldset')].map(e=>[...e.querySelectorAll('input')].map(i=>i.value));`);assert.deepEqual(order,M.QUESTIONS.map(q=>M.options(s,q).map(o=>o[0])));
  await click('#shorten');await click('#checkButton');await click('[data-return="0"]');assert.deepEqual(await call(`return [...d.querySelectorAll('fieldset')].map(e=>[...e.querySelectorAll('input')].map(i=>i.value));`),order);
  const origin=await call('return performance.timeOrigin;');await cdp.send('Page.reload');await wait(()=>call(`return performance.timeOrigin!==${origin}&&app?.controller.mode==='edit';`),'saved option orders');assert.deepEqual((await state()).definition.choiceRanks,s.definition.choiceRanks);assert.deepEqual(await call(`return [...d.querySelectorAll('fieldset')].map(e=>[...e.querySelectorAll('input')].map(i=>i.value));`),order);report.flows.push({label,independentSavedChoiceOrders:true});
}
async function answerAll(){for(let task=0;task<3;task++){await click(`[data-task="${task}"]`);for(const q of M.QUESTIONS.filter(q=>q.task===task))await click(`input[name="${q.field}"][value="${q.correct}"]`);if(task===1){await click('[data-vector-node="U"]');await click('[data-vector-node="V"]');}}}
async function flows(base,label){
  await viewport(390,844);await open(base);await answerAll();await click('#checkButton');assert(await call('return !d.body.textContent.includes("100 / 100");'));await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),100);assert(await call('return app.controller.trusted&&d.getElementById("clearTask").hidden===false&&d.getElementById("editFooter").hidden;'));await screenshot(label+'-submitted');
  await call('const s=app.getState();app.controller.command({type:"clear-task"});return JSON.stringify(s)===JSON.stringify(app.getState());').then(v=>assert(v));
  for(let task=0;task<3;task++){await open(base);await click(`[data-task="${task}"]`);await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);}
  let s=M.fresh(()=>.2);s.task=1;s.answers.deltaFrom='V';s.answers.deltaTo='U';s.answers.accelerationDirection='inward';await open(base,s);await click('#checkButton');await click('[data-return="1"]');assert.deepEqual((await state()).answers,s.answers);await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),25);
  for(const [from,to,points]of [['U',null,5],['S','V',5],['V','U',10]]){s=M.fresh(()=>.2);s.task=1;s.answers.deltaFrom=from;s.answers.deltaTo=to;await open(base,s);await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),points);}
  await open(base,T.filled(),{retain:label});await click('#checkButton');const checkOrigin=await call('return performance.timeOrigin;');await cdp.send('Page.reload');await wait(()=>call(`return performance.timeOrigin!==${checkOrigin}&&app?.controller.mode==="check";`),'Moodle check resume');await click('#submitButton');const recordedOrigin=await call('return performance.timeOrigin;');await cdp.send('Page.reload');await wait(()=>call(`return performance.timeOrigin!==${recordedOrigin}&&app?.controller.mode==="review";`),'Moodle recorded resume');assert.equal(await call('return app.controller.result.score;'),100);
  for(const deny of [false,true]){await open(base,null,{standalone:true,deny});await click('#shorten');await click('#checkButton');await click('#submitButton');await cdp.send('Page.reload');await wait(()=>call('return app?.controller.mode==="edit"&&CircularVectorScoring.score(app.getState()).score===0;'),'standalone refresh');assert.equal((await state()).observation.positionGapDeg,60);}
  for(const checkFirst of [false,true]){await open(base,null,{standalone:true});await click('#shorten');if(checkFirst)await click('#checkButton');await cdp.send('Page.reload');await wait(()=>call('return app?.controller.mode==="edit"&&app.getState().observation.positionGapDeg===60;'),'standalone draft/check refresh');assert(Object.values((await state()).answers).every(v=>v===null));}
  await open(base,T.filled());await call('w.__failFinal=true;');await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.mode;'),'frozen');assert(await call('return d.getElementById("scoreText").textContent.startsWith("--");'));await call('w.__failFinal=false;');await click('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base,T.filled(),{retain:label+'-pending'});await call('w.__failFinal=true;');await click('#checkButton');await click('#submitButton');const frozenOrigin=await call('return performance.timeOrigin;');await cdp.send('Page.reload');await wait(()=>call(`return performance.timeOrigin!==${frozenOrigin}&&app?.controller.mode==="frozen";`),'Moodle pending resume');assert(await call('return app.controller.result===null;'));await click('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base,T.filled());await call('w.__failFinish=true;');await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.mode;'),'committed');await call('w.__failFinish=false;');await click('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  const review=T.snapshot(T.filled(),'review');await open(base,null,{values:{'cmi.core.lesson_status':'passed','cmi.core.score.raw':'99','cmi.suspend_data':JSON.stringify(review)}});assert.equal(await call('return app.controller.mode;'),'mismatch');assert(await call('return d.getElementById("feedback").hidden;'));
  await open(base,null,{values:{'cmi.core.lesson_status':'incomplete','cmi.suspend_data':'{"broken":true}'}});assert.equal(await call('return app.controller.mode;'),'technical');
  await open(base);await click('[data-task="1"]');await call('Object.defineProperty(d.getElementById("positionSvg"),"innerHTML",{set(){throw Error("SVG unavailable");}});app.controller.navigate(1);');assert.equal(await call('return app.controller.mode;'),'technical');assert(await call('return d.getElementById("stage").hidden;'));
  await open(base);const fullSelector=await call(`return [...d.querySelectorAll('button')].find(b=>/全螢幕/.test(b.getAttribute('aria-label')||''))?.outerHTML;`);assert(fullSelector,'shared fullscreen button missing');
  const id=await call(`return [...d.querySelectorAll('button')].find(b=>/全螢幕/.test(b.getAttribute('aria-label')||''))?.id;`);
  const fullButton=id?'#'+id:'[data-sim-fullscreen-control]';
  await call('w.__beforeFullscreen=JSON.stringify(app.getState());');await click(fullButton,true);await H.delay(100);assert(await call('return Boolean(d.fullscreenElement);'));await call('return d.exitFullscreen();');await H.delay(60);assert(await call('return w.__beforeFullscreen===JSON.stringify(app.getState());'));
  await call('d.getElementById("positionHandle").focus();');await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});assert.equal((await state()).observation.positionGapDeg,59);
  await click('[data-task="1"]');for(const node of ['U','V']){await call(`d.querySelector('[data-vector-node="${node}"]').focus();`);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});}assert.equal((await state()).answers.deltaFrom,'U');assert.equal((await state()).answers.deltaTo,'V');
  report.flows.push({label,complete:100,blank:0,partial:[5,10,25],resume:true,pending:true,committed:true,mismatch:true,rendererError:true,fullscreen:true});
}
async function dragProbe(base,label){
  await viewport(390,844);
  for(let task=0;task<3;task++)for(let startIndex=0;startIndex<4;startIndex++)for(const sense of [-1,1]){
    const s=M.fresh(()=>.3);s.task=task;s.definition.startIndex=startIndex;s.definition.sense=sense;s.answers.deltaFrom=task===1?'V':null;s.answers.deltaTo=task===1?'U':null;await open(base,s);
    const before=await state(),info=await call('const r=d.getElementById("positionHandle").getBoundingClientRect();return {geo:app.getGeometry().position,start:{x:r.left+r.width/2,y:r.top+r.height/2},hit:d.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===d.getElementById("positionHandle")};');assert(info.hit);
    const g=M.scene(s),p=info.geo,id=touchId++,touch=point=>({...point,id,radiusX:1,radiusY:1,force:1});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(info.start)]});
    for(let i=1;i<=5;i++){const t=g.thetaA+g.sense*(60-55*i/5)*Math.PI/180;const point={x:p.left+p.center[0]+p.r*Math.cos(t),y:p.top+p.center[1]-p.r*Math.sin(t)};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(point)]});await H.delay(12);}
    assert.deepEqual(await state(),before);assert(await call('return !d.getElementById("preview").hidden;'));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(40);
    const after=await state();if(task===1)await centeredVelocity();assert.equal(after.observation[M.GAP_KEYS[task]],5);assert.deepEqual(after.answers,before.answers);const diag=await call('return app.diagnostics();');assert(diag.trustedTouch>0&&diag.up>0&&diag.move>0);assert(await call('return d.getElementById("preview").hidden&&!app.isDragging();'));report.drags.push({label,task,startIndex,sense,diagnostics:diag});
  }
  for(const ending of ['cancel','secondary','blur','lostcapture','navigate','check']){
    const s=M.fresh(()=>.1);s.task=1;await open(base,s);const before=await state(),info=await call('const r=d.getElementById("positionHandle").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,geo:app.getGeometry().position};'),id=touchId++,point=p=>({x:p.x,y:p.y,id,radiusX:1,radiusY:1,force:1}),g=M.scene(s),theta=g.thetaA+g.sense*Math.PI/6,end={x:info.geo.left+info.geo.center[0]+info.geo.r*Math.cos(theta),y:info.geo.top+info.geo.center[1]-info.geo.r*Math.sin(theta)};
    await call('d.getElementById("positionHandle").addEventListener("gotpointercapture",e=>{w.__activePointer=e.pointerId;},{once:true});');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(info)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(end)]});
    if(ending==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    else if(ending==='secondary'){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(end),{...point(end),x:end.x+20,id:touchId++}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{if(ending==='blur')await call('w.dispatchEvent(new Event("blur"));');if(ending==='lostcapture'){await call('if(!d.getElementById("positionHandle").hasPointerCapture(w.__activePointer))throw Error("Missing actual pointer capture");d.getElementById("positionHandle").releasePointerCapture(w.__activePointer);');await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(end)]});}if(ending==='navigate')await click('[data-task="2"]');if(ending==='check')await click('#checkButton');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await H.delay(40);assert.deepEqual((await state()).observation,before.observation);assert.deepEqual((await state()).answers,before.answers);assert(await call('return d.getElementById("preview").hidden&&!app.isDragging();'));
  }
}
async function main(){
  fs.mkdirSync(out,{recursive:true});const temp=fs.realpathSync(os.tmpdir());
  try{
    const manifest=new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(path.join(root,'sim/manifests',slug+'.xml'),'utf8')),files=manifest.manifest.resources.resource.file.map(f=>f['@_href']),html=fs.readFileSync(path.join(root,'sim',slug,'index.html'),'utf8');
    const refs=[...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(m=>path.posix.normalize(slug+'/'+m[1]));assert.deepEqual(files.filter(f=>!f.endsWith('/index.html')&&!f.endsWith('/mathjax-license.txt')).sort(),refs.sort());
    extracted=H.buildAndExtractPackage(temp,{slug,packagePrefix:'simlab-circular-vector-package-',packageNamePattern:/^simlab-circular-vector-package-[A-Za-z0-9]+$/});
    for(const file of files)assert(fs.readFileSync(path.join(root,'sim',file)).equals(fs.readFileSync(path.join(extracted.packageDirectory,file))));
    report.runtimeHash=crypto.createHash('sha256').update(Buffer.concat(files.map(f=>fs.readFileSync(path.join(root,'sim',f))))).digest('hex');report.commit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
    profile=fs.mkdtempSync(path.join(temp,'simlab-circular-vector-chrome-'));chrome=spawn(H.findBrowser(),['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','about:blank'],{stdio:['ignore','ignore','pipe']});chrome.stderr.resume();
    const port=await H.devToolsPort(profile,chrome),{body:target}=await H.fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});cdp=new H.CdpClient(target.webSocketDebuggerUrl);await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');
    cdp.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));cdp.on('Page.javascriptDialogOpening',()=>{cdp.send('Page.handleJavaScriptDialog',{accept:true}).catch(e=>report.errors.push(e.message));});report.engine=await cdp.send('Browser.getVersion');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const p=new URLSearchParams(location.search);if(p.has('deny'))Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});if(!p.has('fixture'))return;const retain=p.get('retain'),key='circular-vector-lms-'+retain,durable=JSON.parse(retain&&sessionStorage.getItem(key)||p.get('fixture')),values={...durable};let error='0';window.__lmsValues=durable;window.__failFinal=false;window.__failFinish=false;window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>(error='0',values[k]||''),LMSSetValue:(k,v)=>{if(window.__failFinal&&k==='cmi.core.score.raw'){error='351';return 'false';}values[k]=String(v);error='0';return 'true';},LMSCommit:()=>{Object.assign(durable,values);if(retain)sessionStorage.setItem(key,JSON.stringify(durable));return 'true';},LMSFinish:()=>window.__failFinish?'false':'true',LMSGetLastError:()=>error,LMSGetErrorString:()=>'',LMSGetDiagnostic:()=>''};})();`});
    for(const [label,directory]of [['source',path.join(root,'sim')],['package',extracted.packageDirectory]]){
      server=H.createServer(directory);await H.listenServer(server);const base=`http://127.0.0.1:${server.address().port}`;console.log('Circular vector browser: '+label);await layouts(base,label);await pointLabels(base,label);await largeChoiceCards(base,label);await savedChoiceOrders(base,label);await flows(base,label);await dragProbe(base,label);await H.closeServer(server);server=null;
    }
    assert.deepEqual(report.errors,[]);report.completed=true;console.log('Circular vector source/package: layout, learner flows, SCORM trust/resume, fullscreen and 48 trusted geometry drags passed.');
  }catch(error){if(cdp)try{await screenshot('failure');}catch(_){}throw error;}finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await H.stopChrome(chrome,cdp);cdp?.close();if(server)await H.closeServer(server);
    for(const [directory,pattern]of [[profile,/^simlab-circular-vector-chrome-[A-Za-z0-9]+$/],[extracted?.packageDirectory,/^simlab-circular-vector-package-[A-Za-z0-9]+$/]])if(directory&&fs.existsSync(directory)){H.validateOwnedDirectory(directory,temp,pattern,'circular-vector browser');fs.rmSync(directory,{recursive:true,force:false,maxRetries:5,retryDelay:200});}
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
