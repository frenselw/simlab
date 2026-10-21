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
  const result=await H.evaluate(cdp,`(async()=>{
    window.confirm=()=>true;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const click=id=>document.getElementById(id).click();
    const fill=()=>{const kind=document.querySelector('[data-case][aria-current="page"]').dataset.case;
      const state=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer;
      const c=state.cases[kind],r=window.CircularSpeedModel.readings(kind,c.definition,c.measurement.elapsed),correct=window.CircularSpeedScoring.CORRECT[kind];
      for(const key of window.CircularSpeedScoring.NUMERIC){const input=document.querySelector('[data-answer="'+key+'"]');input.value=String(r[key]);input.dispatchEvent(new Event('input',{bubbles:true}));}
      for(const key of window.CircularSpeedScoring.CONCEPT){const input=document.querySelector('input[name="'+key+'"][value="'+correct[key]+'"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}
      return {kind,r};
    };
    const attempt=async()=>{click('startButton');await wait(180);click('stopButton');click('unwrapButton');await wait(1250);return fill();};
    const coax=await attempt();
    const measuredBefore=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer.cases.coaxial.measurement.elapsed;
    click('orbitButton');
    const orbit={viewBox:document.getElementById('motionSvg').getAttribute('viewBox'),labels:document.getElementById('motionSvg').querySelectorAll('text').length,
      canUnwrap:!document.getElementById('unwrapButton').hidden,answer:document.querySelector('[data-answer=vA]').value};
    click('unwrapButton');await wait(1250);
    const measuredAfter=JSON.parse(window.SimScorm.getLocalLog().filter(x=>x.key==='cmi.suspend_data').at(-1).value).answer.cases.coaxial.measurement.elapsed;
    const sceneA=document.getElementById('motionSvg').innerHTML;
    document.querySelector('[data-case="belt"]').click();
    const beltPath=document.getElementById('motionSvg').querySelector('path'),beltBox=beltPath.getBBox(),beltRect=beltPath.getBoundingClientRect(),svgRect=document.getElementById('motionSvg').getBoundingClientRect();
    const belt=await attempt();
    const sceneB=document.getElementById('motionSvg').innerHTML;
    const mathCount=document.querySelectorAll('math').length,mathReadout=!!document.querySelector('#radiusReadout math, #readingsCard math');
    const stageBox=document.getElementById('motionStage').getBoundingClientRect(),panelBox=document.querySelector('.circle-panel').getBoundingClientRect();
    click('checkButton');const check=document.getElementById('checkSummary').innerText;
    click('submitButton');
    const score=document.getElementById('resultSummary').innerText;
    const panel=document.querySelector('.circle-panel'),stage=document.getElementById('motionStage');
    return {coax,belt,orbit,measuredBefore,measuredAfter,beltBox:{x:beltBox.x,right:beltBox.x+beltBox.width},beltRect:{left:beltRect.left,right:beltRect.right,top:beltRect.top,bottom:beltRect.bottom},svgRect:{left:svgRect.left,right:svgRect.right,top:svgRect.top,bottom:svgRect.bottom},sceneA,sceneB,mathCount,mathReadout,stageHeight:stageBox.height,panelHeight:panelBox.height,stageWidth:stageBox.width,panelWidth:panelBox.width,check,score,review:!document.getElementById('resultSection').hidden,
      documentOverflow:document.documentElement.scrollHeight-document.documentElement.clientHeight,
      panelScroll:panel.scrollHeight-panel.clientHeight,stageTouch:getComputedStyle(stage).touchAction,
      fullscreen:!!document.getElementById('fullscreenButton')};
  })()`);
  assert.ok(result.coax.r.sB>result.coax.r.sA,"outer point must have longer arc");
  assert.ok(result.orbit.canUnwrap && result.orbit.labels===0 && result.orbit.answer!=="","return to orbit must retain the reading and remove moving labels");
  assert.equal(result.measuredAfter,result.measuredBefore,"returning and re-unwrapping must not remeasure");
  assert.equal(result.belt.r.sA,result.belt.r.sB,"no-slip wheel rims must travel equally");
  assert.ok(result.beltBox.x>0 && result.beltBox.right<700,"belt tangent loop must remain inside the stage");
  assert.ok(result.beltRect.left>=result.svgRect.left-2 && result.beltRect.right<=result.svgRect.right+2 && result.beltRect.top>=result.svgRect.top-2 && result.beltRect.bottom<=result.svgRect.bottom+2,"belt must stay visible after responsive rotation");
  assert.ok(result.mathCount>=12 && result.mathReadout,"physical quantities must use math typography");
  if(height>=600 && width<=640)assert.ok(result.stageHeight>result.panelHeight*1.5,"phone stage must dominate the panel");
  if(width>=820 && height>380)assert.ok(result.stageWidth>result.panelWidth*1.5,"desktop stage must dominate the panel");
  assert.match(result.sceneA,/共用|stroke-width="12"/);
  assert.match(result.sceneB,/stroke-width="12"/);
  assert.ok(result.check.includes("已填"));
  assert.match(result.score,/100 \/ 100 分/);
  assert.ok(result.review);
  assert.ok(result.documentOverflow<3,"activity document must be bounded");
  assert.equal(result.stageTouch,"pan-y");
  assert.ok(result.fullscreen,"shared fullscreen control must mount");
  return result;
}
async function blankFlow(cdp,url){
  await load(cdp,url,390,600);
  const result=await H.evaluate(cdp,`(()=>{window.confirm=()=>true;document.getElementById('checkButton').click();
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
      await H.evaluate(cdp,"document.getElementById('startButton').click()");await wait(500);
      await H.evaluate(cdp,"document.getElementById('stopButton').click();document.getElementById('unwrapButton').click()");await wait(1250);
      await capture("unwrapped");
      await H.evaluate(cdp,"document.querySelector('[data-case=belt]').click()");await capture("belt");
      await load(cdp,source,320,225);await capture("short");
      await load(cdp,source,1280,800);await capture("desktop");
    }
    await fullFlow(cdp,source,390,844);
    await fullFlow(cdp,source,390,600);
    await fullFlow(cdp,source,320,500);
    await fullFlow(cdp,source,320,225);
    await fullFlow(cdp,source,820,600);
    await fullFlow(cdp,packaged,1280,800);
    await blankFlow(cdp,packaged);
    assert.deepEqual(errors,[],`browser exceptions: ${errors.join("\n")}`);
    console.log("Circular-speed source/package browser flow, small/desktop layout, 100/0 score, fullscreen and standalone refresh passed");
  }catch(error){failure=error;}
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
