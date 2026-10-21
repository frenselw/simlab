#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawn}=require("node:child_process");
const H=require("./position-time-browser-regression.js");
const root=path.resolve(__dirname,".."),tempRoot=fs.realpathSync(os.tmpdir());
const packagePattern=/^simlab-circular-speed-package-[A-Za-z0-9]+$/;
const profilePattern=/^simlab-circular-speed-chrome-[A-Za-z0-9]+$/;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(cdp){for(let i=0;i<100;i++){if(await H.evaluate(cdp,"Boolean(window.CircularSpeedPersistence && document.getElementById('startButton') && !document.getElementById('startButton').hidden)"))return;await wait(50);}throw new Error("Circular-speed activity did not load");}
async function load(cdp,url,width,height){await cdp.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});await cdp.send("Page.navigate",{url});await ready(cdp);}
async function fullFlow(cdp,url,width,height){
  await load(cdp,url,width,height);
  const timer=await H.evaluate(cdp,`(()=>{const readout=document.getElementById('timerReadout'),value=document.getElementById('timerValue'),label=readout.firstElementChild,unit=readout.lastElementChild;
    return ['0','9.99','10','100','8.64×10^4'].map(text=>{value.textContent=text;return {label:label.getBoundingClientRect().left,value:value.getBoundingClientRect().left,unit:unit.getBoundingClientRect().left,valueRight:value.getBoundingClientRect().right,unitRight:unit.getBoundingClientRect().right,readoutRight:readout.getBoundingClientRect().right,stageRight:document.getElementById('motionStage').getBoundingClientRect().right,valueFits:value.scrollWidth<=value.clientWidth+1,fontSize:parseFloat(getComputedStyle(readout).fontSize)};});})()`);
  for(const position of timer){
    assert.ok(Math.abs(position.label-timer[0].label)<.2 && Math.abs(position.value-timer[0].value)<.2 && Math.abs(position.unit-timer[0].unit)<.2,"timer label, number and unit must not shift as digits change");
    assert.ok(position.valueFits && position.valueRight<=position.unit+1 && position.unitRight<=position.readoutRight+1 && position.readoutRight<=position.stageRight+1 && position.fontSize>=(height<=380?13:17),`enlarged timer must fit its fixed slot at ${width}×${height}: ${JSON.stringify(position)}`);
  }
  const result=await H.evaluate(cdp,`(async()=>{
    window.confirm=()=>{throw new Error('Native confirmation must not open');};
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const click=id=>document.getElementById(id).click();
    const fill=()=>{const kind=document.querySelector('[data-case][aria-current="page"]').dataset.case;
      const state=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer;
      const c=state.cases[kind],r=window.CircularSpeedModel.readings(kind,c.definition,c.measurement.elapsed),correct=window.CircularSpeedScoring.CORRECT[kind];
      for(const key of window.CircularSpeedScoring.NUMERIC){const input=document.querySelector('[data-answer="'+key+'"]');input.value=String(r[key]);input.dispatchEvent(new Event('input',{bubbles:true}));}
      for(const key of window.CircularSpeedScoring.CONCEPT){const input=document.querySelector('input[name="'+key+'"][value="'+correct[key]+'"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}
      return {kind,r};
    };
    const choiceOrder=()=>[...document.querySelectorAll('#conceptQuestions fieldset')].map(fieldset=>[...fieldset.querySelectorAll('input')].map(input=>input.value));
    const attempt=async()=>{const initialChoices=choiceOrder();click('startButton');await wait(180);
      for(let i=0;i<20&&!document.querySelector('.angle-guide');i++)await wait(50);
      if(!document.querySelector('.angle-guide'))throw new Error('angle guide did not appear while measuring');
      const liveGuides=[...document.querySelectorAll('.angle-guide')].map(guide=>({sweep:Number(guide.dataset.sweep),path:!!guide.querySelector('.angle-sweep'),ray:!!guide.querySelector('.angle-end-ray'),extraPoint:!!guide.querySelector('circle[stroke="white"]')}));
      const liveCaption=document.getElementById('sceneCaption').innerText;
      click('stopButton');
      const capturedCaption=document.getElementById('sceneCaption').innerText,capturedMath=document.querySelectorAll('#sceneCaption math').length;
      click('unwrapButton');await wait(650);
      const orbits=()=>[...document.querySelectorAll('.source-orbit')].map(circle=>[circle.getAttribute('cx'),circle.getAttribute('cy'),circle.getAttribute('r')]);
      const unit=document.querySelector('.ruler-unit'),svgBox=document.getElementById('motionSvg').getBoundingClientRect(),unitBox=unit?.getBoundingClientRect();
      const middle={traces:[...document.querySelectorAll('.source-trace')].map(trace=>({total:Number(trace.dataset.totalAngle),remaining:Number(trace.dataset.remainingAngle)})),orbits:orbits(),heads:[...document.querySelectorAll('.unroll-line')].map(line=>Number(line.getAttribute('x2'))),caption:document.getElementById('sceneCaption').innerText,rollingCircles:document.querySelectorAll('.unroll-arc').length,unit:unit?.textContent,unitVisible:!!unitBox&&unitBox.left>=svgBox.left-2&&unitBox.right<=svgBox.right+2};
      await wait(1250);return {...fill(),initialChoices,finalChoices:choiceOrder(),liveGuides,liveCaption,capturedCaption,capturedMath,middle,finishedTraces:document.querySelectorAll('.source-trace').length,finishedOrbits:orbits(),finishedHeads:[...document.querySelectorAll('.unroll-line')].map(line=>Number(line.getAttribute('x2')))};};
    const coax=await attempt();
    const measuredBefore=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer.cases.coaxial.measurement.elapsed;
    click('orbitButton');
    const orbit={viewBox:document.getElementById('motionSvg').getAttribute('viewBox'),labels:document.getElementById('motionSvg').querySelectorAll('text').length,
      canUnwrap:!document.getElementById('unwrapButton').hidden,answer:document.querySelector('[data-answer=vA]').value};
    click('unwrapButton');await wait(1900);
    const measuredAfter=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer.cases.coaxial.measurement.elapsed;
    const sceneA=document.getElementById('motionSvg').innerHTML;
    document.querySelector('[data-case="belt"]').click();
    const beltPath=document.getElementById('motionSvg').querySelector('path'),beltBox=beltPath.getBBox(),beltRect=beltPath.getBoundingClientRect(),svgRect=document.getElementById('motionSvg').getBoundingClientRect();
    const beltLinks=document.querySelector('.belt-links'),beltTexture={dash:beltLinks.getAttribute('stroke-dasharray'),start:beltLinks.getAttribute('stroke-dashoffset'),length:beltLinks.getTotalLength()};
    await wait(250);beltTexture.end=document.querySelector('.belt-links').getAttribute('stroke-dashoffset');
    click('pauseButton');beltTexture.paused=document.querySelector('.belt-links').getAttribute('stroke-dashoffset');await wait(150);
    beltTexture.pausedAfter=document.querySelector('.belt-links').getAttribute('stroke-dashoffset');click('pauseButton');
    const belt=await attempt();
    const sceneB=document.getElementById('motionSvg').innerHTML;
    const mathCount=document.querySelectorAll('math').length,mathReadout=!!document.querySelector('#radiusReadout math, #readingsCard math');
    const stageBox=document.getElementById('motionStage').getBoundingClientRect(),panelBox=document.querySelector('.circle-panel').getBoundingClientRect(),legendSize=parseFloat(getComputedStyle(document.querySelector('.stage-legend')).fontSize);
    click('checkButton');const check=document.getElementById('checkSummary').innerText,checkNotice=document.querySelector('#checkSection>p').innerText;
    click('submitButton');
    const score=document.getElementById('resultSummary').innerText;
    const panel=document.querySelector('.circle-panel'),stage=document.getElementById('motionStage');
    return {coax,belt,beltTexture,orbit,measuredBefore,measuredAfter,beltBox:{x:beltBox.x,right:beltBox.x+beltBox.width},beltRect:{left:beltRect.left,right:beltRect.right,top:beltRect.top,bottom:beltRect.bottom},svgRect:{left:svgRect.left,right:svgRect.right,top:svgRect.top,bottom:svgRect.bottom},sceneA,sceneB,mathCount,mathReadout,stageHeight:stageBox.height,panelHeight:panelBox.height,stageWidth:stageBox.width,panelWidth:panelBox.width,legendSize,check,checkNotice,score,review:!document.getElementById('resultSection').hidden,
      documentOverflow:document.documentElement.scrollHeight-document.documentElement.clientHeight,
      panelScroll:panel.scrollHeight-panel.clientHeight,stageTouch:getComputedStyle(stage).touchAction,
      fullscreen:!!document.getElementById('fullscreenButton')};
  })()`);
  assert.ok(result.coax.r.sB>result.coax.r.sA,"outer point must have longer arc");
  assert.equal(result.coax.liveGuides.length,1,"coaxial points must share one angle guide");
  assert.equal(result.belt.liveGuides.length,2,"belt wheels must show separate angle guides");
  for(const [item,keys] of [[result.coax,["angleA"]],[result.belt,["angleA","angleB"]]]){
    assert.ok(!item.liveCaption.includes('rad') && item.capturedCaption.includes('rad') && item.capturedCaption.includes('°') && item.capturedMath>=keys.length,"angle values should appear only after pausing or stopping, in radians and degrees with math typography");
    for(const [index,key] of keys.entries()){
      const guide=item.liveGuides[index];
      assert.ok(guide.path && guide.ray && !guide.extraPoint && guide.sweep>0 && Math.abs(guide.sweep-item.r[key])<0.002,"live angle guide must track the measured angular displacement without adding another point");
    }
  }
  for(const item of [result.coax,result.belt]){
    assert.deepEqual(item.finalChoices,item.initialChoices,"option order must remain fixed throughout the same attempt");
    assert.ok(item.middle.unit==="m" && item.middle.unitVisible,"the ruler itself must display a visible metre unit");
    assert.ok(item.middle.traces.length===2 && item.middle.heads.every(head=>head>240&&head<600) && item.middle.caption.includes("實際轉角") && item.middle.rollingCircles===0 && item.finishedTraces===0,"actual circular traces must shorten as straight tracks grow, with no surrogate rolling wheels");
    assert.deepEqual(item.middle.orbits,item.finishedOrbits,"source circles must stay fixed throughout unwrapping");
    for(const [index,key] of ["angleA","angleB"].entries()){
      const trace=item.middle.traces[index],angleFraction=1-trace.remaining/trace.total,lineFraction=(item.middle.heads[index]-240)/(item.finishedHeads[index]-240);
      assert.ok(trace.remaining>0 && trace.remaining<trace.total && Math.abs(trace.total-item.r[key])<0.002 && Math.abs(angleFraction-lineFraction)<0.02,"lost circular angle and gained straight length must represent the same measured fraction");
    }
  }
  assert.equal(result.coax.middle.orbits[0][0],result.coax.middle.orbits[1][0],"coaxial tracks must share a centre");
  assert.notEqual(result.belt.middle.orbits[0][1],result.belt.middle.orbits[1][1],"belt wheel tracks must have separate centres");
  assert.ok(result.orbit.canUnwrap && result.orbit.labels===0 && result.orbit.answer!=="","return to orbit must retain the reading and remove moving labels");
  assert.equal(result.measuredAfter,result.measuredBefore,"returning and re-unwrapping must not remeasure");
  assert.equal(result.belt.r.sA,result.belt.r.sB,"no-slip wheel rims must travel equally");
  assert.ok(result.beltTexture.dash==="11 11" && result.beltTexture.length>600 && (Number(result.beltTexture.end)-Number(result.beltTexture.start)+22)%22>0 && result.beltTexture.paused===result.beltTexture.pausedAfter,"textured belt must move with the wheels and freeze when paused");
  assert.ok(result.beltBox.x>0 && result.beltBox.right<700,"belt tangent loop must remain inside the stage");
  assert.ok(result.beltRect.left>=result.svgRect.left-2 && result.beltRect.right<=result.svgRect.right+2 && result.beltRect.top>=result.svgRect.top-2 && result.beltRect.bottom<=result.svgRect.bottom+2,"belt must stay visible after responsive rotation");
  assert.ok(result.mathCount>=12 && result.mathReadout,"physical quantities must use math typography");
  if(height>=500 && width<=640)assert.ok(result.panelHeight>=96 && result.stageHeight<=height*.6+2,"phone panel must retain the guide's 96px minimum under the 60dvh stage cap");
  if(height>=600 && width<=640)assert.ok(result.stageHeight>result.panelHeight*1.5,"phone stage must dominate the panel");
  if(width>=820 && height>380)assert.ok(result.stageWidth>result.panelWidth*1.5,"desktop stage must dominate the panel");
  if(width>=1280)assert.ok(result.legendSize>=17,"desktop A/B legend must grow with available stage space");
  assert.match(result.sceneA,/共用|stroke-width="12"/);
  assert.match(result.sceneB,/stroke-width="12"/);
  assert.ok(result.check.includes("已填"));
  assert.ok(result.checkNotice.includes("未填項目得 0 分") && result.checkNotice.includes("只可重看"),"submission consequences must be visible within the check step");
  assert.match(result.score,/100 \/ 100 分/);
  assert.ok(result.review);
  assert.ok(result.documentOverflow<3,"activity document must be bounded");
  assert.equal(result.stageTouch,"pan-y");
  assert.ok(result.fullscreen,"shared fullscreen control must mount");
  return result;
}
async function multiTurnGuide(cdp,url){
  await load(cdp,url,390,844);
  const omega=await H.evaluate(cdp,`(()=>{document.querySelector('[data-case="belt"]').click();document.getElementById('startButton').click();
    const state=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer;
    return window.CircularSpeedModel.parameters('belt',state.cases.belt.definition).omegaA;})()`);
  await wait(200);
  const early=await H.evaluate(cdp,`(()=>{const ray=document.querySelector('.angle-guide .angle-end-ray');return Math.hypot(ray.x2.baseVal.value-ray.x1.baseVal.value,ray.y2.baseVal.value-ray.y1.baseVal.value);})()`);
  await wait(Math.ceil((2*Math.PI/omega+0.25)*1000));
  const later=await H.evaluate(cdp,`(()=>{const guides=[...document.querySelectorAll('.angle-guide')],a=guides[0],ray=a.querySelector('.angle-end-ray');
    const result={count:guides.length,sweep:Number(a.dataset.sweep),visible:Number(a.dataset.visibleSweep),radius:Math.hypot(ray.x2.baseVal.value-ray.x1.baseVal.value,ray.y2.baseVal.value-ray.y1.baseVal.value),extraPoint:!!a.querySelector('circle[stroke="white"]')};
    document.getElementById('stopButton').click();return {...result,caption:document.getElementById('sceneCaption').textContent,readout:document.getElementById('readAngleA').textContent};})()`);
  if(process.env.CIRCULAR_SPEED_SCREENSHOTS){const {data}=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    fs.writeFileSync(path.join(root,"output","playwright","circular-speed-angle-multiturn.png"),Buffer.from(data,"base64"));}
  assert.ok(later.count===2 && later.sweep>2*Math.PI && later.visible>2*Math.PI && later.radius>early+7 && !later.extraPoint && later.caption.includes('1 整圈') && later.readout.endsWith('rad'),`after one turn the guide must grow outward without adding another point: ${JSON.stringify({early,later})}`);
}
async function resetFlow(cdp,url){
  await load(cdp,url,390,600);
  const result=await H.evaluate(cdp,`(async()=>{window.confirm=()=>{throw new Error('Native confirmation must not open');};
    document.getElementById('startButton').click();await new Promise(resolve=>setTimeout(resolve,180));document.getElementById('stopButton').click();document.getElementById('unwrapButton').click();
    const number=document.querySelector('[data-answer=vA]');number.value='1';number.dispatchEvent(new Event('input',{bubbles:true}));
    const choice=document.querySelector('input[name=speedRelation]');choice.click();const selected=choice.value;
    document.getElementById('resetButton').click();
    const state=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer.cases.coaxial;
    return {phase:state.phase,number:state.answers.vA,choice:state.answers.speedRelation,selected,resetHidden:document.getElementById('resetButton').hidden};})()`);
  assert.deepEqual(result,{phase:"ready",number:"",choice:result.selected,selected:result.selected,resetHidden:true},"reset must clear measurement and numeric answer without a popup, while preserving concept work");
}
async function blankFlow(cdp,url){
  await load(cdp,url,390,600);
  const result=await H.evaluate(cdp,`(()=>{window.confirm=()=>{throw new Error('Native confirmation must not open');};document.getElementById('checkButton').click();
    const before=document.getElementById('checkSummary').innerText;
    document.getElementById('submitButton').click();
    return {before,after:document.getElementById('resultSummary').innerText,locked:document.getElementById('resultSection').hidden===false};})()`);
  assert.match(result.before,/未答/);assert.match(result.after,/0 \/ 100 分/);assert.ok(result.locked);
  await load(cdp,url,390,600);
  assert.ok(await H.evaluate(cdp,"!document.getElementById('startButton').hidden && document.querySelector('[data-answer=vA]').value === ''"),"standalone refresh starts new practice");
}
async function main(){
  let sourceServer,packageServer,chrome,cdp,profile,packageDir,failure;
  const errors=[];
  try{
    const browser=H.findBrowser();if(!browser)throw new Error("Chrome/Chromium unavailable");
    const pkg=H.buildAndExtractPackage(tempRoot,{slug:"circular-motion-speed-lab",packagePrefix:"simlab-circular-speed-package-",packageNamePattern:packagePattern});
    packageDir=pkg.packageDirectory;
    sourceServer=H.createServer(path.join(root,"sim"));packageServer=H.createServer(packageDir);
    await Promise.all([H.listenServer(sourceServer),H.listenServer(packageServer)]);
    profile=fs.mkdtempSync(path.join(tempRoot,"simlab-circular-speed-chrome-"));
    H.validateOwnedDirectory(profile,tempRoot,profilePattern,"Chrome profile");
    const args=["--headless=new","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0",`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","--disable-background-networking","--disable-component-update","--disable-sync","about:blank"];
    if(process.platform!=="win32"&&typeof process.getuid==="function"&&process.getuid()===0)args.unshift("--no-sandbox");
    chrome=spawn(browser,args,{stdio:["ignore","ignore","pipe"]});
    const port=await H.devToolsPort(profile,chrome);
    const {body:target}=await H.fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`,{method:"PUT"});
    cdp=new H.CdpClient(target.webSocketDebuggerUrl,WebSocket,45000);
    cdp.on("Runtime.exceptionThrown",({exceptionDetails})=>errors.push(exceptionDetails?.exception?.description||exceptionDetails?.text));
    await cdp.send("Page.enable");await cdp.send("Runtime.enable");
    const source=`http://127.0.0.1:${sourceServer.address().port}/circular-motion-speed-lab/index.html`;
    const packaged=`http://127.0.0.1:${packageServer.address().port}${pkg.activityPath}`;
    if(process.env.CIRCULAR_SPEED_SCREENSHOTS){
      const capture=async name=>{const {data}=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        const file=path.join(root,"output","playwright",`circular-speed-${name}.png`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(data,"base64"));};
      await load(cdp,source,390,844);await capture("ready");
      await H.evaluate(cdp,"document.getElementById('startButton').click()");await wait(3000);await capture("angle-live");
      await H.evaluate(cdp,"document.getElementById('stopButton').click();document.getElementById('unwrapButton').click()");await wait(650);
      await capture("unrolling");await wait(1250);
      await capture("unwrapped");
      await H.evaluate(cdp,"document.querySelector('[data-case=belt]').click()");await capture("belt");
      await H.evaluate(cdp,"document.getElementById('startButton').click()");await wait(500);
      await H.evaluate(cdp,"document.getElementById('stopButton').click();document.getElementById('unwrapButton').click()");await wait(650);
      await capture("belt-unrolling");await wait(1250);await capture("belt-unwrapped");
      await load(cdp,source,320,225);await capture("short");
      await load(cdp,source,1280,800);await capture("desktop");
    }
    await fullFlow(cdp,source,390,844);
    await fullFlow(cdp,source,390,600);
    await fullFlow(cdp,source,320,500);
    await fullFlow(cdp,source,320,225);
    await fullFlow(cdp,source,820,600);
    await fullFlow(cdp,packaged,1280,800);
    await multiTurnGuide(cdp,source);
    await resetFlow(cdp,source);
    await blankFlow(cdp,packaged);
    assert.deepEqual(errors,[],`browser exceptions: ${errors.join("\n")}`);
    console.log("Circular-speed source/package browser flow, small/desktop layout, 100/0 score, fullscreen and standalone refresh passed");
  }catch(error){failure=error;if(errors.length)console.error("Browser exceptions:",errors);}
  const cleanup=[];
  try{await H.stopChrome(chrome,cdp);}catch(e){cleanup.push(e);}try{cdp?.close();}catch(e){cleanup.push(e);}
  for(const server of [sourceServer,packageServer])try{await H.closeServer(server);}catch(e){cleanup.push(e);}
  for(const [dir,pattern,label] of [[profile,profilePattern,"Chrome profile"],[packageDir,packagePattern,"SCORM package"]])if(dir&&fs.existsSync(dir))try{
    const exact=H.validateOwnedDirectory(dir,tempRoot,pattern,label);fs.rmSync(exact,{recursive:true,force:false,maxRetries:3,retryDelay:100});
  }catch(e){cleanup.push(e);}
  if(cleanup.length)failure=new AggregateError(failure?[failure,...cleanup]:cleanup,"Browser cleanup failed");
  if(failure)throw failure;
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
