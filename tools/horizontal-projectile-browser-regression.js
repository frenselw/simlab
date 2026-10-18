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
  const p=new URLSearchParams(location.search);Math.random=()=>p.has('draw')?Number(p.get('draw')):.65;
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
async function alignRuler(axis,offset=0,fraction=.65,slot=0){
  await click(axis==='x'?'#rulerX':'#rulerY');await click('#rulerHome');
  const before=await state(),r=before.rows[slot],p=M.impact(r.depthMm,r.speedOffsetPpm),zero=axis==='x'?[offset,p.y]:[Math.round(p.x),offset];
  const raw=zero.map((n,i)=>i===(axis==='x'?0:1)&&n===0?5:n);
  const g=await call('return app.getGeometry();');
  if(Math.hypot(...zero)*g.s<6){await call(`app.controller.command({type:'ruler',value:${JSON.stringify({axis,zero})}});`);return;}
  const start=await call(`const e=d.getElementById('rulerBodyTarget'),r=e.getBoundingClientRect(),stage=d.getElementById('stage').getBoundingClientRect();const left=Math.max(r.left,stage.left),right=Math.min(r.right,stage.right),top=Math.max(r.top,stage.top),bottom=Math.min(r.bottom,stage.bottom);return{x:left+(right-left)*${fraction},y:top+(bottom-top)*${fraction},hit:!!e&&d.elementFromPoint(left+(right-left)*${fraction},top+(bottom-top)*${fraction})===e};`);
  assert(start.hit);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:start.x,y:start.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:start.x+raw[0]*g.s,y:start.y+raw[1]*g.s});
  assert.deepEqual(await state(),before);assert(await call('return !d.getElementById("readingChoices").hidden&&d.querySelectorAll("#readingOptions button:disabled").length===4;'));
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:start.x+raw[0]*g.s,y:start.y+raw[1]*g.s});
  assert.deepEqual((await state()).ruler,{axis,zero});assert.equal(await call('return +d.getElementById("readingChoices").dataset.slot;'),slot);assert(await call('return !d.getElementById("measureSlot");'));assert(await call('return !d.getElementById("readingChoices").hidden&&!d.getElementById("readingPreview").hidden;'));
}
async function completeFlow(base,label){
  await viewport(1000,800);await open(base);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const depth of[50,150,300,450,650,800])await shot(depth);
  const recorded=await state();assert.equal(recorded.rows.filter(Boolean).length,6);
  await screenshot(label+'-apparatus');await click('#next');
  for(let i=0;i<6;i++){
    for(const axis of ['x','y']){await alignRuler(axis,0,.65,i);const row=recorded.rows[i],p=M.impact(row.depthMm,row.speedOffsetPpm),n=Math.round(axis==='x'?p.x:p.y);await click(`[data-reading="${n}"]`);}
  }
  await click('#next');
  assert.equal(await call('return d.querySelectorAll("#scene [data-plot-point]").length;'),6);assert(await call('return !d.getElementById("plotSlot")&&!d.getElementById("plotInputSurface");'));
  await input('#fitModel','quadratic');await click('#fitButton');assert(await call('return ProjectileModel.fit(app.getState()).ok;'));
  assert(await call(`return d.getElementById("fitResult").querySelector('[data-math="m"]');`));
  assert.equal((await call('return ProjectileModel.fit(app.getState());')).n,7);
  assert(await call('return d.querySelectorAll("#scene [data-origin]").length===1&&d.querySelectorAll("[data-panel]").length===4&&d.getElementById("progress").textContent.includes("/ 4");'));
  assert.deepEqual(await call('return [...d.getElementById("fitModel").options].map(o=>o.value);'),['','linear','quadratic']);
  assert(await call('return !d.getElementById("fitV")&&!d.getElementById("questions")&&!d.querySelector("[data-go=motion]")&&!/RMSE|係數|複雜/.test(d.getElementById("fitResult").textContent);'));
  await input('#fitModel','linear');await click('#fitButton');assert.equal((await call('return ProjectileModel.fit(app.getState());')).n,7);
  await input('#fitModel','quadratic');await click('#fitButton');
  await input('#trajectory','parabola');await screenshot(label+'-trajectory');await click('#next');
  await click('[data-formula-choice="time"][value="fall"]',true);await click('[data-formula-choice="speed"][value="horizontal"]',true);
  const s=await state();await input('#meanV',Number(M.mean(M.calculations(s).map(c=>c.v)).toFixed(3)));
  assert.deepEqual((await state()).rows.map(r=>r.speedOffsetPpm),recorded.rows.map(r=>r.speedOffsetPpm));
  await screenshot(label+'-speed');await click('#next');assert.equal(await call('return app.controller.mode;'),'check');await click('#submitButton');
  assert.equal(await call('return app.controller.result.score;'),100);assert.equal(await call("return w.__lmsValues['cmi.core.score.raw'];"),'100');
  assert.equal(await call('return app.controller.mode;'),'review');assert.equal(await call("return Boolean(d.querySelector('#clearAll').getClientRects().length);"),false);
  report.flows.push({label,kind:'six-point-complete',score:100,ppm:recorded.rows.map(r=>r.speedOffsetPpm)});
}
async function readingFlow(base,label){
  for(const [width,height]of[[1280,800],[390,600],[320,500],[320,225]]){
    await viewport(width,height);const s=T.filled();s.view='measure';s.ruler.zero=[0,s.rows[0].depthMm];await open(base,s);
    const initial=await state(),p=M.impact(initial.rows[0].depthMm,initial.rows[0].speedOffsetPpm),correct=Math.round(p.x);
    const metrics=await call(`const card=d.getElementById('readingChoices'),r=card.getBoundingClientRect(),o=d.querySelector('[data-origin]');return{font:parseFloat(getComputedStyle(d.body).fontSize),origin:!!o,math:d.querySelectorAll('#scene [data-tex]').length,formula:[...d.querySelectorAll('[data-formula]')].every(e=>e.querySelector('svg[data-tex]')),parent:card.parentElement.id,card:[r.left,r.top,r.right,r.bottom],buttons:[...d.querySelectorAll('.reading-choice')].map(e=>({value:+e.dataset.reading,height:e.getBoundingClientRect().height,math:!!e.querySelector('svg[data-tex]')}))};`);
    assert(metrics.font>=(width>=900?21:18));assert(metrics.origin&&metrics.math>0&&metrics.formula);assert.equal(metrics.buttons.length,4);assert(metrics.buttons.every(b=>b.height>=44&&b.math));assert.equal(metrics.buttons.filter(b=>b.value===correct).length,1);assert.equal(Math.max(...metrics.buttons.map(b=>b.value))-Math.min(...metrics.buttons.map(b=>b.value)),3);
    assert.equal(metrics.parent,'stage');const canvas=await call(`const r=d.getElementById('stage').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};`);assert(metrics.card[0]>=canvas.left&&metrics.card[2]<=canvas.right&&metrics.card[1]>=canvas.top&&metrics.card[3]<=canvas.bottom,JSON.stringify({width,height,metrics,canvas}));
    const wrong=metrics.buttons.find(b=>b.value!==correct).value;await click(`[data-reading="${wrong}"]`,true);assert.equal((await state()).rows[0].read[0],wrong);assert.equal((await state()).fit.attempted,false);assert.equal((await state()).meanV,null);
    await call('app.controller.command({type:"ruler",value:{axis:"x",zero:[1,50]}});');
    const off=await call('return [...d.querySelectorAll(".reading-choice")].map(b=>+b.dataset.reading);');assert(off.every(n=>n!==correct));await click(`[data-reading="${off[0]}"]`,true);assert.equal((await state()).rows[0].read[0],off[0]);
    if(width===1280)await screenshot(label+'-reading-misaligned');
    await alignRuler('x');await click(`[data-reading="${correct}"]`,true);assert.equal((await state()).rows[0].read[0],correct);
    await alignRuler('y');const mark=await rect(`[data-reading="${initial.rows[0].depthMm}"]`),touch={...mark,id:817,radiusX:2,radiusY:2,force:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state()).rows[0].read[1],initial.rows[0].depthMm);
    const saved=await call('return w.__lmsValues;'),before=await state();await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(saved))}`});await wait(()=>call('return Boolean(app?.getState());'),'reading resume');assert.deepEqual(await state(),before);
    await screenshot(label+'-canvas-reading-'+width+'x'+height);
    await click('#checkButton');await click('#submitButton');await click('[data-go="measure"]');assert(await call('return d.getElementById("readingChoices").hidden&&[...d.querySelectorAll("[data-clear-read]")].every(e=>e.disabled);'));
    report.flows.push({label,kind:'TeX-origin-large-text/own-scale-four-choices/wrong-origin/touch-choice/resume/review',width,height,metrics});
  }
}
async function rulerRevision(base,label){
  await viewport(1280,800);await open(base);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await call('return !d.getElementById("scene").textContent.includes("固定釋放標記");'));
  await shot(200);assert(await call('return d.getElementById("release").disabled&&!d.getElementById("heightNotice").hidden;'));
  const before=await state();await call('d.getElementById("release").onclick();');assert.deepEqual(await state(),before);assert.equal(await call('return app.isRunning();'),false);
  await call('for(let n=0;n<9;n++)d.getElementById("depthDown").click();');assert(await call('return d.getElementById("release").disabled;'));await click('#depthDown');assert.equal(await call('return d.getElementById("release").disabled;'),false);await click('#release');await wait(()=>call('return !app.isRunning();'),'5 cm boundary shot');assert.equal((await state()).rows[1].depthMm,250);
  const live=T.filled();live.view='collect';live.setup={slot:0,depthMm:50};await open(base,live);
  const unchanged=await state(),suspend=await call('return w.__lmsValues["cmi.suspend_data"];'),handle=await rect('#catcherHandle'),g=await call('return app.getGeometry();');
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...handle});
  for(const [depth,valid]of[[150,false],[100,true],[145,false]]){
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:handle.x,y:handle.y+(depth-50)*g.s});
    assert(await call(`return !d.getElementById('heightNotice').hidden&&d.getElementById('heightNotice').dataset.valid===${JSON.stringify(String(valid))};`));assert.deepEqual(await state(),unchanged);assert.equal(await call('return w.__lmsValues["cmi.suspend_data"];'),suspend);
  }
  await call('w.dispatchEvent(new Event("blur"));');await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:handle.x,y:handle.y+95*g.s});assert.deepEqual(await state(),unchanged);assert(await call('return d.getElementById("heightNotice").hidden&&!d.getElementById("release").disabled;'));
  for(const [width,height]of[[1280,800],[390,844],[320,500]])for(const axis of['x','y']){
    await viewport(width,height);const s=T.filled();s.view='measure';s.ruler.axis=axis;await open(base,s);
    assert(await call('return !d.getElementById("rulerHandle")&&!d.getElementById("readingZoom")&&!d.getElementById("readingZoomInline")&&d.getElementById("readingChoices").hidden;'));
    for(const fraction of [.2,.8]){
      await alignRuler(axis,0,fraction);const saved=await state();
      const labels=await call('const boxes=[...d.querySelectorAll("#scene [data-impact-mark]")].map(e=>e.getBoundingClientRect());return [...d.querySelectorAll("#scene [data-point-label]")].map(e=>{const r=e.getBoundingClientRect(),p=boxes[+e.dataset.pointLabel];return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,px:p.left+p.width/2,py:p.top+p.height/2};});');for(const l of labels)assert(l.right<=l.px-6||l.bottom<=l.py-6,JSON.stringify(l));
      const geometry=await call(`const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};},body=box(d.querySelector('#scene [data-ruler-body]')),target=box(d.getElementById('rulerBodyTarget'));return{body,target,labels:[...d.querySelectorAll('#scene [data-ruler-value]')].map(box),background:getComputedStyle(d.getElementById('rulerBodyTarget')).backgroundColor};`);
      const b=geometry.body;assert(Object.keys(b).every(k=>Math.abs(geometry.target[k]-b[k])<1),JSON.stringify(geometry));assert.equal(geometry.background,'rgba(0, 0, 0, 0)');for(const r of geometry.labels)assert(r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1,JSON.stringify({b,r,axis,width}));
      assert(await call('return !d.getElementById("readingChoices").hidden&&d.querySelectorAll("#readingPreviewSvg [data-ruler-value]").length>0&&[...d.querySelectorAll("[data-impact-mark]")].every(e=>+e.getAttribute("r")>=6);'));assert.deepEqual(await state(),saved);
      if(width===1280||width===390)await screenshot(label+'-ruler-auto-preview-'+axis+'-'+width);
      await alignRuler(axis,50,fraction);const moved=await state(),row=moved.rows[0],actual=Math.round(axis==='x'?M.impact(row.depthMm,row.speedOffsetPpm).x:row.depthMm);
      const choices=await call('return [...d.querySelectorAll(".reading-choice")].map(e=>+e.dataset.reading);');assert.equal(choices.length,4);assert(choices.every(n=>Math.abs(n-actual)>5));assert.equal(moved.ruler.zero[axis==='x'?0:1],50);
      if(width===1280)await screenshot(label+'-ruler-wrong-zero-'+axis);
      await call(`app.controller.command({type:'ruler',value:{axis:${JSON.stringify(axis)},zero:[200,200]}});`);assert(await call('return d.getElementById("readingChoices").hidden&&!d.getElementById("magnifier")&&d.getElementById("readingChoices").parentElement.id==="stage";'));
      report.gestures.push({label,kind:'whole-ruler-drag/auto-preview/perpendicular-snap/wrong-zero-all-wrong',width,height,axis,fraction,geometry,passed:true});
    }
  }
  report.flows.push({label,kind:'5cm-height-guard/disabled-release/model-preserves-legacy/transparent-ruler/selected-zoom',passed:true});
}
async function screenshot(name){const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
async function layoutMatrix(base,label){
  for(const [width,height]of[[320,500],[390,500],[390,600],[390,844],[900,650],[1280,800],[640,400],[667,375],[320,400],[320,225]]){
    await viewport(width,height);
    for(const view of M.VIEWS){const s=T.filled();s.view=view;await open(base,s);
      const metrics=await call(`const panel=d.getElementById('controlPanel'),p=panel.getBoundingClientRect(),root=d.scrollingElement,button=d.getElementById('fullscreenButton').getBoundingClientRect();panel.scrollTop=panel.scrollHeight;return{rootRange:root.scrollHeight-root.clientHeight,rootX:root.scrollWidth-root.clientWidth,panel:[p.top,p.bottom,p.height],viewport:w.innerHeight,lastReachable:panel.scrollTop>=panel.scrollHeight-panel.clientHeight-1,fullscreen:[button.left,button.top,button.right,button.bottom]};`);
      assert(metrics.rootRange<=1&&metrics.rootX<=1,JSON.stringify({label,width,height,view,metrics}));assert(metrics.panel[2]>=95&&metrics.panel[0]>=-1&&metrics.panel[1]<=height+1,JSON.stringify({width,height,view,metrics}));assert(metrics.lastReachable);
      assert(metrics.fullscreen[0]>=0&&metrics.fullscreen[2]<=width+1&&metrics.fullscreen[3]<=height,JSON.stringify({label,width,height,view,metrics}));
      if(width<900&&height>420){
        const geometry=await call(`const g=app.getGeometry(),stage=d.getElementById('stage').getBoundingClientRect(),box=e=>{const r=e.getBoundingClientRect();return{left:r.left-stage.left,top:r.top-stage.top,right:r.right-stage.left,bottom:r.bottom-stage.top};};return{...g,hintHost:d.getElementById('stageHint').parentElement.id,labels:[...d.querySelectorAll('#scene [data-tex]')].map(box),ball:d.querySelector('#scene circle[fill="#677586"]')?box(d.querySelector('#scene circle[fill="#677586"]')):null};`);
        assert.equal(geometry.hintHost,'controlPanel');const oldScale=Math.min((geometry.w-108)/(view==='collect'?1300:1100),(geometry.h-124)/(view==='collect'?1300:1100));assert(geometry.s>=oldScale*1.2,JSON.stringify({width,height,view,geometry}));
        assert(geometry.ox+1000*geometry.s<=geometry.w-32+1&&geometry.oy+1000*geometry.s<=geometry.h-39);
        if(view!=='collect')assert(geometry.ox>=32);
        for(const b of [...geometry.labels,...(geometry.ball?[geometry.ball]:[])])assert(b.left>=-1&&b.top>=-1&&b.right<=geometry.w+1&&b.bottom<=geometry.h+1,JSON.stringify({width,height,view,b,geometry}));
        metrics.geometry=geometry;
        if(width===320&&height===500||width===390&&height===844){await call('d.getElementById("controlPanel").scrollTop=0;');await screenshot(label+'-mobile-space-'+view+'-'+width);}
      }
      report.layouts.push({label,width,height,view,...metrics});
    }
  }
  await viewport(390,600);const s=T.filled();s.view='measure';await open(base,s);await screenshot(label+'-phone');
}
async function flows(base,label){
  for(const attempted of [false,true]){
    const retired=T.filled();retired.view='plot';retired.fit={model:'inverse',attempted};await open(base,retired);
    assert.deepEqual(await state(),retired);assert(await call('return d.getElementById("fitButton").disabled&&d.getElementById("fitFormula").textContent.includes("已移除")&&!d.querySelector("#fitModel option[value=inverse]");'));
    await input('#fitModel','quadratic');await click('#fitButton');assert((await call('return ProjectileModel.fit(app.getState());')).ok);
    await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),100);
    await open(base,retired);await click('#checkButton');await click('#submitButton');const score=await call('return app.controller.result.score;');assert.equal(score,80);
    const values=await call('return w.__lmsValues;');await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(values))}`});await wait(()=>call('return app?.controller.mode==="review";'),'retired inverse review');await click('[data-go="plot"]');assert.equal(await call('return app.controller.result.score;'),score);assert(await call('return d.getElementById("fitFormula").textContent.includes("原作答");'));
  }
  report.flows.push({label,kind:'removed-inverse-not-offered/retained-draft-reselection/original-review-score',passed:true});
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
    await open(base,null,true,'test=0&deny=1');await shot(200);
    if(checkpoint!=='partial')await click('#checkButton');if(checkpoint==='submitted')await click('#submitButton');
    await cdp.send('Page.reload',{});await wait(()=>call("return app?.controller.mode==='edit';"),'standalone fresh');assert.equal((await state()).rows.filter(Boolean).length,0);
  }
  report.flows.push({label,kind:'blank-each-view/pending/finish/resume/finished/standalone-denied-storage',passed:true});
  for(const old of [T.legacyFilled(),T.legacyV2Filled()]){
  const legacy=T.snapshot(old,'review'),oldValues={'cmi.core.lesson_status':'passed','cmi.core.score.raw':'100','cmi.suspend_data':JSON.stringify(legacy)};
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(oldValues))}`});await wait(()=>call("return app?.controller.mode==='review';"),'legacy review');await click('[data-go="plot"]');assert.equal(await call('return d.querySelectorAll("#scene [data-plot-point]").length;'),6);await click('[data-go="speed"]');assert.equal(await call('return app.controller.result.score;'),100);assert(await call('return [...d.querySelectorAll("[data-formula-choice]")].every(e=>e.disabled)&&d.getElementById("calc-v-0").querySelector("svg");'));
  const oldDraft={version:1,activity:P.ACTIVITY,kind:'draft',answer:old},unfinished={'cmi.core.lesson_status':'incomplete','cmi.suspend_data':JSON.stringify(oldDraft)};
  await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(unfinished))}`});await wait(()=>call("return app?.controller.mode==='technical';"),'legacy draft lock');assert.equal(await call('return w.__lmsValues["cmi.suspend_data"];'),unfinished['cmi.suspend_data']);assert.equal(await state(),null);
  }
  report.flows.push({label,kind:'legacy-review-original-score-and-render/unfinished-draft-not-overwritten',passed:true});
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
  await click('#release',true);acceptDialog=false;await click('#clearAll');acceptDialog=true;assert.equal(await call('return app.isRunning();'),false);assert.equal(await call('return d.getElementById("release").disabled||d.getElementById("depthDown").disabled;'),false);assert.equal((await state()).rows.filter(Boolean).length,0);
  await shot(200);assert.equal((await state()).rows[0].clockMs,M.impact(200,0).clockMs);
  const s=T.filled();s.view='measure';s.ruler.zero=[0,s.rows[0].depthMm];await open(base,s);const before=await state();
  assert(await call('return !d.getElementById("readingChoices").hidden;'));assert.deepEqual(await state(),before);
  await click('#rulerY');assert(await call('return d.getElementById("readingChoices").hidden;'));await alignRuler('y');await screenshot(label+'-reading-auto-zoom');await click('#next');assert(await call('return d.getElementById("readingChoices").hidden;'));
  await click('#checkButton');await click('[data-go="collect"]');const old=await state();acceptDialog=false;await click('#release');assert.deepEqual(await state(),old);assert.equal(await call('return app.isRunning();'),false);
  await click('#clearAll');assert.deepEqual(await state(),old);acceptDialog=true;await click('#clearAll');assert.equal((await state()).rows.filter(Boolean).length,0);
  await click('#checkButton');await click('[data-go="speed"]');await click('[data-formula-choice="time"][value="half"]');await click('#checkButton');await click('[data-go="collect"]');await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await shot(200);assert.equal((await state()).formulas.time,'half');
  const large=T.filled();large.view='speed';await open(base,large);await input('#meanV',Number.MAX_VALUE);
  await click('#checkButton');assert(await call(`return !d.getElementById("checkSummary").textContent.includes("Infinity")&&Boolean(d.getElementById("checkSummary").querySelector('[data-math="1.7977e+308 m/s"]'));`));await click('[data-go="speed"]');
  const values=await call('return w.__lmsValues;');await cdp.send('Page.navigate',{url:`${base}/${slug}/index.html?fixture=${encodeURIComponent(JSON.stringify(values))}`});await wait(()=>call('return app?.getState()?.meanV===Number.MAX_VALUE;'),'large speed resume');assert.equal((await state()).meanV,Number.MAX_VALUE);
  report.flows.push({label,kind:'flight-lock/cancel/resize/ruler-reading-zoom/confirm-cancel/clear/zero-observation-continuation/large-speed/formula-retained',passed:true});
}
async function touchDrag(selector,dx,dy,ending='touchEnd'){
  const start=await rect(selector),before=await state(),metricsBefore=await call('return {page:scrollY,panel:d.getElementById("controlPanel").scrollTop,diag:app.getDiagnostics()};');
  const p=(x,y,id=91)=>({x,y,id,radiusX:2,radiusY:2,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(start.x,start.y)]});
  for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p(start.x+dx*i/6,start.y+dy*i/6)]});await H.delay(15);}
  const preview=await call('return !!d.getElementById("magnifier")||!d.getElementById("readingChoices").hidden;');
  await cdp.send('Input.dispatchTouchEvent',{type:ending,touchPoints:[]});await H.delay(90);
  const after=await state(),metricsAfter=await call('return {page:scrollY,panel:d.getElementById("controlPanel").scrollTop,diag:app.getDiagnostics()};');
  assert.equal(metricsBefore.page,metricsAfter.page);assert.equal(metricsBefore.panel,metricsAfter.panel);assert(metricsAfter.diag.trustedTouch>metricsBefore.diag.trustedTouch);
  assert.equal(await call('return !d.getElementById("magnifier");'),true);
  if(ending==='touchCancel')assert.deepEqual(after,before);else {assert.notDeepEqual(after,before);assert(metricsAfter.diag.ups>metricsBefore.diag.ups);assert.equal(metricsAfter.diag.cancels,metricsBefore.diag.cancels);}
  return{selector,ending,preview,metricsBefore,metricsAfter};
}
async function interactions(base,label){
  await viewport(390,600);const fixture=T.filled();fixture.view='plot';fixture.rows[0].read=[100,300];fixture.meanV=null;fixture.fit.attempted=false;await open(base,fixture);
  const points=await call('const g=app.getGeometry();return [...d.querySelectorAll("#scene [data-plot-point]")].map(e=>({slot:+e.dataset.plotPoint,x:(+e.getAttribute("cx")-g.ox)/g.s,y:(+e.getAttribute("cy")-g.oy)/g.s}));');
  assert.equal(points.length,6);assert(Math.abs(points[0].x-100)<1e-8&&Math.abs(points[0].y-300)<1e-8);assert(await call('return !d.getElementById("plotInputSurface")&&!d.querySelector("[data-point-slot]");'));
  const saved=await state(),suspend=await call('return w.__lmsValues["cmi.suspend_data"];'),p=await call('const g=app.getGeometry(),r=d.getElementById("stage").getBoundingClientRect();return{x:r.left+g.ox+500*g.s,y:r.top+g.oy+500*g.s};');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:52,radiusX:3,radiusY:3,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual(await state(),saved);assert.equal(await call('return w.__lmsValues["cmi.suspend_data"];'),suspend);
  await click('#next');assert(await call('return d.querySelectorAll("#speedTable input").length===0&&d.querySelectorAll("#formulaChoices input[type=radio]").length===8;'));
  await click('[data-formula-choice="speed"][value="double"]',true);const wrong=await state(),expected=M.calculations(wrong);assert.equal(expected[0].v,2*.1/Math.sqrt(2*.3/M.G));assert.equal(wrong.meanV,null);assert(await call('return d.getElementById("calc-v-0").querySelector("[data-math]")!==null;'));
  await click('[data-clear-formula="time"]');assert(M.calculations(await state()).every(c=>c.t===null&&c.v===null));await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.mode;'),'review');
  report.flows.push({label,kind:'auto-points-use-own-readings/no-point-editing/formula-choice/wrong-formula/clear/partial-submit',passed:true});
  for(const [view,target,dx,dy]of[['collect','#catcherHandle',0,30],['measure','#rulerBodyTarget',35,20]])for(const ending of['touchEnd','touchCancel']){
    const s=T.filled();s.view=view;await open(base,s);report.gestures.push({label,view,...await touchDrag(target,dx,dy,ending)});
  }
  await click('#checkButton');const frozen=await state();await click('#fullscreenButton',true);await wait(()=>call('return Boolean(d.fullscreenElement);'),'fullscreen entry');assert.deepEqual(await state(),frozen);await cdp.send('Runtime.evaluate',{expression:'document.exitFullscreen()',awaitPromise:true});await wait(()=>call('return !d.fullscreenElement;'),'external fullscreen exit');
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
async function launchAndPreview(base,label){
  for(const [width,height]of[[1280,800],[390,844],[320,500],[320,225]])for(const view of ['collect','measure','plot']){
    await viewport(width,height);const s=M.practice(M.fresh(-300000),()=>.5);s.view=view;if(view==='measure')s.ruler.zero=[0,50];await open(base,s);
    const labels=await call('const g=app.getGeometry(),r=d.getElementById("stage").getBoundingClientRect();return [...d.querySelectorAll("#scene [data-point-label]")].map(e=>{const b=e.getBoundingClientRect();return{slot:+e.dataset.pointLabel,left:b.left-r.left,right:b.right-r.left,top:b.top-r.top,bottom:b.bottom-r.top,ax:g.ox,ay:g.oy,end:g.ox+1000*g.s};});');
    for(const b of labels)assert(!(b.right>=b.ax-2&&b.left<=b.end+10&&b.top<=b.ay+4&&b.bottom>=b.ay-(width>=900?24:16)-10),JSON.stringify({width,height,view,b}));
    const first=labels.find(l=>l.slot===0);assert(first);if(first.right>=first.ax-2)assert(first.top>first.ay+4);if(width===390&&view==='measure')await screenshot(label+'-label-beside-axis');
    if(view==='measure'){
      const body=await call('const r=d.querySelector("#scene [data-ruler-body]").getBoundingClientRect(),s=d.getElementById("stage").getBoundingClientRect();return{left:r.left-s.left,right:r.right-s.left,top:r.top-s.top,bottom:r.bottom-s.top};');
      for(const b of labels)assert(b.right<body.left||b.left>body.right||b.bottom<body.top||b.top>body.bottom,JSON.stringify({width,height,b,body}));
    }
    report.layouts.push({label,width,height,view,kind:'low-mark-label-avoids-horizontal-axis',labels});
  }
  await viewport(390,844);await open(base,null,true,'draw=0');const slow=await state();assert.equal(slow.launchOffsetPpm,-300000);assert.equal(slow.view,'plot');assert.equal(slow.rows.filter(Boolean).length,6);assert(Object.values(slow.formulas).every(v=>v===null));assert.equal(slow.fit.model,null);assert.equal(slow.meanV,null);assert(!Object.hasOwn(slow,'clockShown'));assert(!Object.hasOwn(slow,'conclusions'));
  for(const r of slow.rows){const p=M.impact(r.depthMm,r.speedOffsetPpm);assert.deepEqual(r.read,[Math.round(p.x),p.y]);}
  assert(await call('return !d.getElementById("modeControls").hidden&&d.getElementById("status").textContent.includes("測試模式");'));
  const demoState=await state(),panel=await call('const p=d.getElementById("controlPanel"),r=p.getBoundingClientRect();p.scrollTop=0;return{x:r.left+8,y:r.top+r.height*.65};'),touch=y=>({x:panel.x,y,id:911,radiusX:3,radiusY:3,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(panel.y)]});for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(panel.y-i*10)]});await H.delay(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await H.delay(400);assert(await call('return d.getElementById("controlPanel").scrollTop>0&&scrollY===0;'));assert.deepEqual(await state(),demoState);
  await open(base,null,true,'draw=.999999');const fast=await state();assert.equal(fast.launchOffsetPpm,0);assert(M.impact(fast.rows[5].depthMm,fast.rows[5].speedOffsetPpm).x>M.impact(slow.rows[5].depthMm,slow.rows[5].speedOffsetPpm).x+150);
  await call('Math.random=()=>.1;');await click('#clearAll');assert.equal((await state()).launchOffsetPpm,M.drawLaunchOffset(()=>.1));assert.equal((await state()).view,'plot');assert.equal((await state()).rows.filter(Boolean).length,6);
  await screenshot(label+'-test-mode-third-stage');await click('#modeToggle');await wait(()=>call('return app?.getState()?.view==="collect"&&app.getState().rows.every(r=>r===null);'),'normal mode');assert.equal(await call('return ProjectileScoring.score(app.getState()).score;'),0);
  await click('#modeToggle');await wait(()=>call('return app?.getState()?.view==="plot"&&app.getState().rows.every(Boolean);'),'test mode');await click('#checkButton');await click('#submitButton');assert(await call('return app.controller.mode==="review"&&d.getElementById("modeControls").hidden&&!d.getElementById("clearAll").getClientRects().length;'));
  await cdp.send('Page.reload',{});await wait(()=>call('return app?.controller.mode==="edit"&&app.getState().view==="plot";'),'fresh test preview');assert.equal((await state()).fit.model,null);
  await open(base,null,false,'&test=1');assert((await state()).rows.every(r=>r===null));assert(await call('return d.getElementById("modeControls").hidden;'));await click('#checkButton');await click('#submitButton');assert.equal(await call('return app.controller.result.score;'),0);
  report.flows.push({label,kind:'random-new-run/constant-baseline/test-prefill-only-first-two-stages/reset/mode-switch/no-LMS-autofill/no-review-reset',passed:true});
}
async function main(){
  fs.mkdirSync(out,{recursive:true});const temp=fs.realpathSync(os.tmpdir());
  try{
    const manifest=new XMLParser({ignoreAttributes:false}).parse(fs.readFileSync(path.join(root,'sim/manifests',slug+'.xml'),'utf8'));
    const files=manifest.manifest.resources.resource.file.map(f=>f['@_href']);
    const html=fs.readFileSync(path.join(root,'sim',slug,'index.html'),'utf8');const refs=[...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(m=>path.posix.normalize(slug+'/'+m[1]));assert.deepEqual(files.filter(f=>!f.endsWith('/index.html')&&!f.endsWith('/mathjax-license.txt')).sort(),refs.sort());
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
      console.log('projectile browser: '+label);await layoutMatrix(base,label);await readingFlow(base,label);await rulerRevision(base,label);await completeFlow(base,label);await launchAndPreview(base,label);
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
