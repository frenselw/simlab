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
async function choose(selector,value){if(selector==='#forcePalette'){await analyse();await tap(`[data-palette="${value}"]`);return;}await call(`const e=d.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));`);}
async function analyse(){
  if(await call('return app.controller.mode==="edit"&&app.getState().view==="scene"&&!d.getElementById("analyseButton").disabled;'))await tap('#analyseButton');
  await wait(()=>call('return app.getState().view==="analysis";'),'analysis target reached');
}
async function seek(value){await call(`const e=d.getElementById('motionPosition');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));`);}
async function dragForce(angle,selector='#forceHandle'){
  const start=await rect(selector);assert(start.width>=44&&start.height>=44);
  const end=await call(`const g=app.getLayout(),r=d.getElementById('diagram').getBoundingClientRect(),a=${angle}*Math.PI/1800;return{x:r.left+g.cx+Math.cos(a)*60*g.scale,y:r.top+g.cy-Math.sin(a)*60*g.scale};`);
  const id=touchId++,touch=(x,y)=>({x,y,id,radiusX:1,radiusY:1,force:1});
  await call('w.__sourceLastMove=null;w.__sourceMoveObserver=e=>{if(e.isTrusted)w.__sourceLastMove={x:e.clientX,y:e.clientY};};d.addEventListener("pointermove",w.__sourceMoveObserver);');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(start.x,start.y)]});
  for(let i=1;i<=5;i++){const x=start.x+(end.x-start.x)*i/5,y=start.y+(end.y-start.y)*i/5;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(x,y)]});await H.delay(25);}
  await wait(()=>call(`const p=w.__sourceLastMove;return p&&Math.hypot(p.x-${end.x},p.y-${end.y})<1;`),'final trusted drag movement');
  await call('d.removeEventListener("pointermove",w.__sourceMoveObserver);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));');
  assert(await call('return !d.getElementById("preview").hidden;'),'touch preview missing');
  const focus=await call(`const box=d.getElementById("previewSvg").viewBox.baseVal,r=d.getElementById("diagram").getBoundingClientRect();return {x:r.left+box.x+box.width/2,y:r.top+box.y+box.height/2,single:d.querySelectorAll("#preview > svg").length===1&&!d.getElementById("previewOverview")};`);assert(Math.hypot(focus.x-end.x,focus.y-end.y)<8&&focus.single,'single magnifier must follow the arrow tip without an overview inset: '+JSON.stringify({focus,end,start,angle,selector}));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(35);
}
async function screenshot(label){fs.mkdirSync(out,{recursive:true});const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,label+'.png'),Buffer.from(r.data,'base64'));}
async function animationCadence(base,label){
  const samples=[];
  for(const [width,height]of [[390,844],[1280,800]]){
    await viewport(width,height);await open(base,M.fresh(()=>.2));
    for(let page=0;page<6;page++){
      if(width<600)await choose('#compactNav',page);else await tap(`[data-page="${page}"]`);
      if(!await call('return app.getMotion().playing;'))await tap('#sceneButton');
      const sample=await call(`return new Promise(resolve=>{
        const svg=d.getElementById('diagramSvg'),times=[];let paints=0,startTravel;
        const observer=new MutationObserver(records=>{paints+=records.length;});
        function tick(now){
          if(!times.length){startTravel=app.getMotion().travel;observer.observe(svg,{childList:true});}
          times.push(now);
          if(times.length<61){requestAnimationFrame(tick);return;}
          observer.disconnect();const elapsed=now-times[0],duration=CentripetalSourceScene.duration(app.getState().def,app.controller.page);
          resolve({callbacks:60,paints,fps:60000/elapsed,paintFps:paints*1000/elapsed,elapsed,simulatedMs:(app.getMotion().travel-startTravel)*duration*1000});
        }
        requestAnimationFrame(tick);
      });`);
      assert(sample.paints>=sample.callbacks-1&&sample.paints<=sample.callbacks+1,'animation must redraw every browser frame: '+JSON.stringify({width,page,sample}));
      assert(Math.abs(sample.simulatedMs-sample.elapsed)<150,'more redraws must preserve elapsed-time motion speed: '+JSON.stringify(sample));
      await tap('#sceneButton');const paused=await call('return [app.getMotion().travel,d.getElementById("diagramSvg").innerHTML];');await H.delay(100);
      assert.deepEqual(await call('return [app.getMotion().travel,d.getElementById("diagramSvg").innerHTML];'),paused,'paused scene must stay still');
      samples.push({width,page,...sample});
    }
  }
  report[label].push({flow:'all six scenes redraw each animation frame, retain real-time speed and pause, mobile/desktop',samples});
}
async function inputAudit(base,label){
  await viewport(390,844);
  const state=M.fresh(()=>.2);state.view='analysis';Object.assign(state.items[0],{palette:0,selected:0,arrows:[[0,2700,60]]});
  const unchanged=async(before,message)=>{assert.equal(await call('return JSON.stringify(app.getState());'),before,message);assert(await call('return d.getElementById("preview").hidden;'),message+' preview');};
  for(const jitter of [0,2]){
    await open(base,state);const before=await call('return JSON.stringify(app.getState());'),p=await rect('#forceHandle'),id=touchId++,t={x:p.x+18,y:p.y,id};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t]});
    if(jitter)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...t,x:t.x+jitter}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await unchanged(before,'tip halo tap/jitter must preserve answer');
  }
  const beforeMouse=await call('return JSON.stringify(app.getState());'),p=await rect('#forceHandle');
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x+18,y:p.y,button:'right',clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+18,y:p.y,button:'right',clickCount:1});await unchanged(beforeMouse,'right click must not edit');
  for(const target of ['#originHandle','#forceHandle'])for(const firstLift of ['primary','secondary']){
    await open(base,state);const before=await call('return JSON.stringify(app.getState());'),start=await rect('#forceHandle'),id=touchId++,other=touchId++;
    await call('w.__auditPointerIds=[];d.addEventListener("pointerdown",e=>{if(e.isTrusted)w.__auditPointerIds.push(e.pointerId);},true);');
    const a={x:start.x,y:start.y,id},moved={...a,x:a.x+24,y:a.y-20};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[moved]});await H.delay(40);
    const at=await rect(target),b={x:at.x,y:at.y,id:other};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[moved,b]});
    assert(await call('return d.getElementById("preview").hidden;'),'secondary touch must cancel immediately');
    assert(await call('const id=w.__auditPointerIds[0];return w.__auditPointerIds.length===2&&!d.getElementById("forceHandle").hasPointerCapture(id)&&!d.getElementById("originHandle").hasPointerCapture(id);'),'cancelled primary pointer must release capture');
    const next={...b,x:b.x+42,y:b.y-28};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[moved,next]});
    const remaining=firstLift==='primary'?next:moved;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[remaining]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...remaining,x:remaining.x+20}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await unchanged(before,`${target}, ${firstLift} first: neither finger may restart cancelled drag`);
    assert(await call('return w.__auditPointerIds.every(id=>!d.getElementById("forceHandle").hasPointerCapture(id)&&!d.getElementById("originHandle").hasPointerCapture(id));'),'released pointers must not retain capture');
  }
  await dragForce(1800);assert.equal(await call('return app.getState().items[0].arrows[0][1];'),1800,'new primary drag after cancellation must work');
  const key=async(key,code)=>{await cdp.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code:key,windowsVirtualKeyCode:code});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});};
  for(const name of ['relation','concept']){
    if(name==='concept'){await choose('#compactNav',5);await analyse();}
    const values=await call(`const inputs=[...d.querySelectorAll('input[name="${name}"]')];inputs[0].focus();return inputs.map(e=>e.value);`);
    for(let i=1;i<=2;i++){await key('ArrowDown',40);assert.deepEqual(await call(`return [d.activeElement.name,d.activeElement.value,d.querySelector('input[name="${name}"]:checked')?.value];`),[name,values[i],values[i]],'consecutive radio keys must retain focus');}
    await key('Tab',9);assert(await call('return d.activeElement.tagName!=="BODY";'),'Tab must continue from selected radio');
  }
  await open(base,state);
  for(const selector of ['[data-inward="N"]','[data-palette="0"]','[data-select="0"]']){
    await call(`d.querySelector(${JSON.stringify(selector)}).focus();`);await key('Enter',13);
    assert(await call(`return d.activeElement.matches(${JSON.stringify(selector)});`),'rebuilt control must retain focus '+selector);
    await key('Tab',9);assert(await call('return d.activeElement.tagName!=="BODY";'));
  }
  report[label].push({flow:'tip halo tap/jitter/right-click invariance; secondary origin/tip with both release orders; subsequent drag; consecutive native radio keys and button focus',passed:true});
}
async function shortReferences(base,label){
  for(const [width,height]of [[320,500],[390,844],[1280,800]])for(const mirror of [0,1]){
    const state=M.fresh(()=>.2);state.def[0]=[mirror,0,1,0];state.def[1]=[mirror,0,1,0];
    await viewport(width,height);await open(base,state);await tap('#checkButton');await tap('#submitButton');
    assert(await call('return d.getElementById("feedback").textContent.includes("不表示力的大小比例");'));
    for(const [page,kind]of [[0,2],[1,4]]){
      await call(`d.querySelectorAll('.feedback-card > svg')[${page}].scrollIntoView({block:'center'});`);
      const shape=await call(`const svg=d.querySelectorAll('.feedback-card > svg')[${page}],p=svg.querySelector('[data-kind="${kind}"]'),points=p.getAttribute('d').split(/[MLZ]/).filter(x=>x.trim()).map(x=>x.trim().split(',').map(Number)),r=p.getBoundingClientRect();return{tip:points[3],base:points[2],width:r.width,height:r.height,circles:svg.querySelectorAll('.student-arrows circle').length};`);
      assert(shape.width>=25&&shape.height>=9&&shape.circles===0,'short reference force must have a readable unoccluded arrowhead '+JSON.stringify(shape));
      assert.equal(shape.tip[0],160+(mirror?32:-32));assert.equal(shape.tip[1],115);
      assert(Math.abs(shape.tip[0]-shape.base[0])>12,'short force arrowhead must extend beyond the object');
      await screenshot(`${label}-short-reference-${page}-${mirror}-${width}`);
    }
  }
  report[label].push({flow:'minimum legal tension/static friction reference arrows, both mirrors, 320/390/1280 widths; adjusted lengths disclosed',passed:true});
}
async function reviewPresentation(base,label){
  const state=M.fresh(()=>.2);state.view='analysis';
  state.items.forEach((item,page)=>{const p=M.physics(state.def,page);item.inward=p.inward;item.arrows=p.forces.map(([kind,angle])=>[kind,angle,60]);item.relation=M.CASES[page].relation;});state.concept='radial-effect';
  for(const [width,height]of [[320,500],[390,844],[1280,800]]){
    await viewport(width,height);await open(base,state);await tap('#checkButton');
    assert(await call('return !d.querySelector(".inward-indicator,[data-inward-indicator],.force-labels rect");'),'check diagrams must retain transparent force labels without direction overlays');
    assert(await call('return [...d.querySelectorAll(".summary-row > svg")].every(e=>e.getBoundingClientRect().height>=165);'),'check diagrams must remain readable');
    await call('d.getElementById("controlPanel").scrollTop=0;');await screenshot(`${label}-check-${width}`);
    await tap('#submitButton');assert.equal(await call('return app.controller.mode;'),'review');
    assert(await call('return !d.querySelector(".inward-indicator,[data-inward-indicator],.force-labels rect");'),'reference diagrams must retain transparent force labels without direction overlays');
    const metrics=await call(`return [...d.querySelectorAll('#feedbackList .math-inline')].map(e=>{const r=e.getBoundingClientRect(),font=parseFloat(getComputedStyle(e).fontSize);return {tex:e.dataset.tex,width:r.width,height:r.height,expectedWidth:parseFloat(e.getAttribute('width'))*font,expectedHeight:parseFloat(e.getAttribute('height'))*font,display:getComputedStyle(e).display};});`);
    assert(metrics.length>6&&metrics.every(e=>Math.abs(e.height-e.expectedHeight)<1&&Math.abs(e.width-e.expectedWidth)<1&&e.display==='inline-block'),'inline LaTeX must keep its own dimensions: '+JSON.stringify(metrics));
    const diagrams=await call(`return [...d.querySelectorAll('.feedback-card > svg')].map(e=>{const r=e.getBoundingClientRect(),m=e.querySelector('.force-labels .force-math').getBoundingClientRect();return {width:r.width,height:r.height,labelHeight:m.height};});`);
    assert.equal(diagrams.length,6);assert(diagrams.every(e=>e.height>=165&&e.height<350&&e.labelHeight>=12&&e.labelHeight<32),'reference diagrams and force labels must have consistent readable sizes: '+JSON.stringify(diagrams));
    for(let page=0;page<6;page++){
      await call(`d.querySelectorAll('.feedback-card')[${page}].scrollIntoView({block:'start'});`);await screenshot(`${label}-feedback-${page}-${width}`);
    }
  }
  report[label].push({flow:'all six check/reference diagrams and inline LaTeX proportions at 320,390,1280 widths',passed:true});
}
async function panelDirections(base,label){
  await viewport(390,844);await open(base);await analyse();
  assert(await call('return d.getElementById("originHandle").hidden&&d.getElementById("forceHandle").hidden&&!d.getElementById("drawInward");'),'blank direction work must not offer a canvas direction tool');
  for(const key of M.DIRECTIONS){
    await tap(`[data-inward="${key}"]`);assert.equal(await call('return app.getState().items[0].inward;'),key);
    assert.equal(await call('return d.querySelector("#directionChoices [aria-pressed=true]").dataset.inward;'),key);
    assert(await call('return !d.querySelector(".inward-indicator,[data-inward-indicator]")&&d.getElementById("originHandle").hidden;'),'direction answers stay in the control panel');
  }
  await choose('#forcePalette',2);await dragForce(1800,'#originHandle');await tap('[data-inward="N"]');
  assert.deepEqual(await call('const i=app.getState().items[0];return [i.inward,i.arrows];'),['N',[[2,1800,60]]],'choosing a circle direction must preserve forces');
  await dragForce(0);assert.equal(await call('return app.getState().items[0].inward;'),'N');
  assert(await call('return !d.querySelector(".inward-indicator,.force-labels rect")&&d.querySelector("#diagramSvg .circle-center circle")&&d.querySelector("#diagramSvg .circle-center [data-tex=O] path");'),'point O and transparent force labels must be present without a direction overlay');
  await call('d.getElementById("directionChoices").closest("fieldset").scrollIntoView({block:"start"});');await screenshot(label+'-panel-direction');
  report[label].push({flow:'eight panel-only circle directions, independent force editing, LaTeX O point and transparent force labels',passed:true});
}
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
  assert(await call('return Boolean(d.querySelector("#relationChoices svg[data-tex] path"));'),'LaTeX formula glyphs missing');
  for(let page=0;page<6;page++){
    await choose('#compactNav',page);await analyse();
    const s=await call('return app.getState();'),p=M.physics(s.def,page,s.items[page].pose),item=M.CASES[page];
    await tap(`[data-inward="${p.inward}"]`);
    for(const [kind,angle] of p.forces){await choose('#forcePalette',kind);await dragForce(angle,'#originHandle');const after=await call('return app.getState();');assert(M.difference(after.items[page].arrows.at(-1)[1],angle)<=100,JSON.stringify({page,angle,actual:after.items[page].arrows.at(-1)}));}
    assert(await call(`const options=[...d.querySelectorAll('#directionChoices [data-inward]')];return options.length===8&&options.every(b=>b.querySelector('svg')&&!b.textContent.trim())&&d.querySelectorAll('.direction-pad').length===1&&!d.querySelector('#arrowDirections,#addForce,#forceControls .direction-pad')&&!/方向鍵|鍵盤|Shift/.test(d.body.textContent+[...d.querySelectorAll('[aria-label],[title]')].map(e=>e.getAttribute('aria-label')+e.title).join(''))&&!d.querySelector('.inward-indicator,[data-inward-indicator],.force-labels rect,#drawInward')&&d.querySelectorAll('#diagramSvg .force-labels .force-math[data-tex]').length===${p.forces.length};`),'circle-direction options / canvas force editing / LaTeX labels missing');
    const shapes=await call('return [...d.querySelectorAll("#diagramSvg .force-vector")].map(e=>({d:e.getAttribute("d"),fill:e.getAttribute("fill")}));');assert(shapes.every(e=>e.d.endsWith(' Z')));assert(new Set(shapes.map(e=>e.fill)).size===p.forces.length);
    await call('d.getElementById("forceControls").scrollIntoView({block:"start"});');await screenshot(`${label}-drawn-${page}`);
    await tap(`input[name="relation"][value="${item.relation}"]`);
  }
  await tap('input[name="concept"][value="radial-effect"]');
  assert.equal(await call('return CentripetalSourceScoring.score(app.getState()).score;'),100);
  await tap('#checkButton');assert.equal(await call('return app.controller.mode;'),'check');assert(await call('return !d.getElementById("checkSummary").textContent.includes("/16");'));
  await tap('#returnEdit');assert.equal(await call('return app.controller.mode;'),'edit');await tap('#checkButton');await tap('#submitButton');
  assert.equal(await call('return app.controller.mode;'),'review');assert.equal(await call('return app.controller.result.score;'),100);
  assert(await call('return [...d.querySelectorAll("#directionChoices button")].every(b=>b.disabled);'),'recorded direction choices must be read-only');
  assert(await call('return d.getElementById("feedbackList").textContent.includes("一般變速圓周運動")&&d.getElementById("feedbackList").textContent.includes("離心力");'));
  assert.equal(await call('return app.controller.command({type:"clear-page"});'),false);
  await screenshot(label+'-submitted');report[label].push({flow:'six-case trusted touch full score',score:100,trustedDrags:await call('return app.diagnostics.trustedTouch;')});
}
async function edgeFlows(base,label){
  await viewport(390,844);await open(base);await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);
  await open(base);await choose('#forcePalette',6);await dragForce(0,'#originHandle');await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);
  await open(base);await choose('#forcePalette',2);await call('d.getElementById("originHandle").focus();');await cdp.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});assert.equal(await call('return app.getState().items[0].arrows[0][1];'),0);assert.equal(await call('return d.activeElement.id;'),'forceHandle');await cdp.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});assert.equal(await call('return app.getState().items[0].arrows[0][1];'),10);
  const partial=M.change(M.change(M.fresh(()=>.2),{type:'palette',value:0}),{type:'add'});
  await open(base,partial);await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.result.score;'),2);
  await open(base,partial);await dragForce(2700);assert.equal(await call('return app.getState().items[0].arrows[0][1];'),2700,'old null-direction draft remains editable on canvas');
  await open(base,null,{retain:label+'-resume'});await choose('#forcePalette',0);await dragForce(2700,'#originHandle');await cdp.send('Page.reload');await wait(()=>call('return app?.getState()?.items[0].arrows.length===1;'),'Moodle draft resume');
  await open(base,null,{standalone:true,deny:true});await choose('#forcePalette',0);await dragForce(2700,'#originHandle');await cdp.send('Page.reload');await wait(()=>call('return app?.getState()?.items[0].arrows.length===0;'),'standalone fresh refresh');
  await open(base,null,{retain:label+'-pending'});await call('w.__failFinal=true;');await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.mode;'),'frozen');await cdp.send('Page.reload');await wait(()=>call('return app?.controller.mode==="frozen";'),'pending resume');await tap('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base);await call('w.__failFinish=true;');await tap('#checkButton');await tap('#submitButton');assert.equal(await call('return app.controller.mode;'),'committed');await call('w.__failFinish=false;');await tap('#retryFinal');assert.equal(await call('return app.controller.mode;'),'review');
  await open(base);await choose('#forcePalette',0);await dragForce(2700,'#originHandle');
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
  await open(base);await choose('#compactNav',5);await seek(0);await choose('#forcePalette',1);await dragForce(430,'#originHandle');
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
      if(page===2){
        const sizes=[];
        for(const pose of [2500,7500]){
          await seek(pose);sizes.push(await call('const e=d.querySelector("[data-pendulum-scale]"),ball=e.querySelector("[data-object=ball]").getBoundingClientRect();return {scale:Number(e.dataset.pendulumScale),width:ball.width};'));await screenshot(`${label}-pendulum-${pose}-${width}`);
        }
        sizes.sort((a,b)=>a.scale-b.scale);assert(sizes[1].width/sizes[0].width>1.5,'pendulum must be visibly larger on its near side');
        let closest={gap:Infinity,pose:0};
        for(let pose=0;pose<10000;pose+=250){
          await seek(pose);
          const gap=await call('const post=d.querySelector("[data-support=post]").getBoundingClientRect(),bob=d.querySelector("[data-pendulum-scale] [data-object=ball]").getBoundingClientRect();return bob.left-post.right;');
          if(gap<closest.gap)closest={gap,pose};
        }
        assert(closest.gap>8,'bob must clear the vertical support throughout its orbit: '+JSON.stringify(closest));
        await seek(closest.pose);await screenshot(`${label}-pendulum-support-${width}`);
        assert(await call('return !!d.querySelector(".circle-center circle")&&!!d.querySelector(".circle-center [data-tex=O] path");'),'conical orbit centre needs a visible point and LaTeX O');
      }
      if(page===3||page===4){
        assert(await call('const p=d.querySelector("[data-road=surface]"),end=p.getPointAtLength(p.getTotalLength());return p.getPointAtLength(0).x===0&&Math.abs(end.x-app.getLayout().w)<1;'),'road must extend continuously to both canvas edges');
        await seek(7500);await screenshot(`${label}-road-${page}-exit-${width}`);
      }
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
  for(const sense of [0,1])for(const [pose,expected]of [[136,0],[2636,2500],[3886,3750],[5136,5000],[6386,6250],[7636,7500],[8886,8750],[9999,0],[1376,1250]]){
    const state=M.navigate(M.fresh(()=>.2),5);state.def[5][1]=sense;await open(base,state);await seek(pose);await analyse();
    assert.equal(await call('return app.getState().items[5].pose;'),expected);assert.equal(await call('return app.getMotion().travel;'),expected/10000);
    const alignment=await call('const s=app.getState(),i=s.items[5],p=CentripetalSourceModel.physics(s.def,5,i.pose),g=app.getLayout(),center=d.querySelector("#diagramSvg .circle-center circle"),dx=Number(center.getAttribute("cx"))-g.cx,dy=g.cy-Number(center.getAttribute("cy"));return {inward:p.inward,answer:i.inward,force:p.forces[0][1],direction:CentripetalSourceModel.directionAngle(p.inward),visible:CentripetalSourceModel.angle(Math.atan2(dy,dx)*180/Math.PI)};');
    assert.equal(alignment.answer,null,'snapping the scene must not answer the question');assert.equal(alignment.force,alignment.direction);assert.equal(alignment.visible,alignment.direction,'visible Sun position must match an available arrow');
    await tap(`[data-inward="${alignment.inward}"]`);assert.equal(await call('return app.getState().items[5].inward;'),alignment.inward);
  }
  await screenshot(label+'-earth-aligned');
  const p=await call('const s=app.getState();return CentripetalSourceModel.physics(s.def,5,s.items[5].pose);');
  await choose('#forcePalette',1);await dragForce(p.forces[0][1],'#originHandle');
  assert.equal(await call('return app.getState().items[5].arrows.length;'),1);
  const pose=await call('return app.getState().items[5].pose;');await tap('#sceneButton');await seek(6200);await analyse();assert.equal(await call('return app.getState().items[5].pose;'),pose);
  await choose('#forcePalette',0);const before=await call('return JSON.stringify(app.getState());'),r=await rect('#originHandle'),id=touchId++;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y,id}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x,y:r.y+45,id}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await call('return JSON.stringify(app.getState());'),before);
  report[label].push({flow:'six visible scenes; direct drawing and cancel; Earth nearest eight directions in both senses and wrap; both bridges before/after target and wrap',passed:true});
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
      await animationCadence(base,label);await inputAudit(base,label);await shortReferences(base,label);await reviewPresentation(base,label);await panelDirections(base,label);await revisedScenes(base,label);await layoutChecks(base,label);await fill(base,label);await edgeFlows(base,label);await H.closeServer(server);server=null;
    }
    assert.deepEqual(report.errors,[]);report.completed=true;console.log('Centripetal source source/package browser regression passed.');
  }finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    await H.stopChrome(chrome,cdp);cdp?.close();if(server)await H.closeServer(server);
    for(const [dir,pattern]of [[profile,/^simlab-source-chrome-[A-Za-z0-9]+$/],[extracted?.packageDirectory,/^simlab-source-package-[A-Za-z0-9]+$/]])if(dir&&fs.existsSync(dir)){H.validateOwnedDirectory(dir,temp,pattern,'centripetal browser');fs.rmSync(dir,{recursive:true,force:false,maxRetries:5,retryDelay:200});}
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
