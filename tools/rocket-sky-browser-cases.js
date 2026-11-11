'use strict';
const assert=require('node:assert/strict');

async function run({base,label,P,T,H,cdp,call,viewport,open,wait,shot,click,pointer,key,report}){
  for(const [width,height]of [[320,568],[390,844],[844,390],[1280,800]]){
    await viewport(width,height);await open(base);
    await wait(()=>call('return d.getElementById("skyAvailability").hidden;'),'local ephemeris');
    await click('#skySettings summary');
    assert(await call('return d.getElementById("skySettings").open && !d.getElementById("skyDate").disabled;'));
    await call(`app.controller.state.craft=${JSON.stringify(T.launched().craft)};app.controller.emit();`);
    await click('#launchButton');
    assert.equal(await call('return app.getState().phase;'),'pad');
    const following=await call('const s=app.getScene();return {origin:s.camera.position.toArray(),elevation:s.camera.getWorldDirection(s.camera.position.clone()).y};');
    await click('[data-camera-view="sky"]');
    const geometry=await call(`const s=app.getScene(),buttons=[...d.querySelectorAll('.camera-controls button:enabled')].map(b=>b.getBoundingClientRect().toJSON()),stage=d.getElementById('stage').getBoundingClientRect().toJSON();
      d.getElementById('cameraSurface').focus();
      const hint=d.getElementById('cameraHint');
      return {origin:s.camera.position.toArray(),look:s.camera.getWorldDirection(s.camera.position.clone()).toArray(),hint:hint.hidden?'':hint.textContent,buttons,stage};`);
    assert.deepEqual(geometry.origin,following.origin);
    assert(geometry.look[1]>.75&&following.elevation<0&&geometry.hint.includes('原地轉頭'));
    for(const b of geometry.buttons)assert(b.width>=44&&b.height>=44&&b.left>=geometry.stage.left&&b.right<=geometry.stage.right);
    await key('ArrowUp');
    await wait(()=>call(`const s=app.getScene();return s.camera.getWorldDirection(s.camera.position.clone()).y>${geometry.look[1]};`),'keyboard turns sky camera up');
    const after=await call('const s=app.getScene();return{origin:s.camera.position.toArray(),look:s.camera.getWorldDirection(s.camera.position.clone()).toArray()};');
    assert.deepEqual(after.origin,geometry.origin);assert(after.look[1]>geometry.look[1]);
    if(width===390){
      const {stage}=geometry,x=(stage.left+stage.right)/2,y=stage.top+stage.height*.55;
      await pointer({x,y},{x:x+35,y:y-35},true);
      await wait(()=>call(`const s=app.getScene();return s.camera.getWorldDirection(s.camera.position.clone()).y>${after.look[1]};`),'trusted drag turns sky camera up');
      await H.delay(250);
    }
    await click('[data-camera-view="follow"]');
    await wait(()=>call('return app.getScene().view==="follow";'),'return to follow view');
    report.flows.push({label,case:'sky-layout',width,height,buttons:geometry.buttons.length});
  }

  await viewport(1024,768);await open(base,T.launched());
  await wait(()=>call('return d.getElementById("skyAvailability").hidden;'),'ephemeris for rendering');
  assert(await call('return performance.getEntriesByType("resource").filter(e=>e.name.includes("ephemeris")).map(e=>e.name).every(name=>new URL(name).origin===location.origin);'));
  await H.evaluate(cdp,'(async()=>{window.__skyThree=await import("./vendor/three-0.185.1/three.module.min.js");})()');
  await call(`const s=app.getScene(),T=window.__skyThree;app.view('sky');
    window.__skyPixels=(hours,aim)=>{
      const f=app.controller.state.flight;f.t=hours*3600;app.controller.emit();
      const u=s.sky.material.uniforms,vec=v=>new T.Vector3(v.x,v.y,v.z);
      const sun=vec(u.uSunDisc.value),moon=vec(u.uMoonDisc.value);
      const look=aim==='both'?sun.clone().add(moon).normalize():aim==='sun'?sun:aim==='moon'?moon:new T.Vector3(0,.65,.76).normalize();
      s.yaw=Math.atan2(look.x,look.z);s.pitch=Math.asin(look.y);s.draw();
      const size=512,target=new T.WebGLRenderTarget(size,size),previous=s.renderer.getRenderTarget(),frames=[];
      target.texture.colorSpace=T.SRGBColorSpace;
      try{
        s.renderer.setRenderTarget(target);
        for(const on of [1,0]){u.uCelestial.value=on;s.renderer.render(s.scene,s.camera);const pixels=new Uint8Array(size*size*4);s.renderer.readRenderTargetPixels(target,0,0,size,size,pixels);frames.push(pixels);}
      }finally{u.uCelestial.value=1;s.renderer.setRenderTarget(previous);target.dispose();s.draw();}
      const sample=direction=>{
        const p=direction.clone().multiplyScalar(100).add(s.camera.position).project(s.camera),x=Math.round((p.x+1)*size/2),y=Math.round((p.y+1)*size/2);
        let max=0;
        for(let j=y-6;j<=y+6;j++)for(let i=x-6;i<=x+6;i++)if(i>=0&&i<size&&j>=0&&j<size){
          const at=(j*size+i)*4;for(let k=0;k<3;k++)max=Math.max(max,Math.abs(frames[0][at+k]-frames[1][at+k]));
        }
        return {x,y,max};
      };
      const observer=u.uObserver.value,center=(size*size/2+size/2)*4;
      return {sun:sample(sun),moon:sample(moon),sunElevation:sun.y,moonElevation:moon.y,daylight:s.lighting.daylight,
        direct:s.lighting.sunlight,observer:observer.length(),center:frames[0].slice(center,center+3).join(',')};
    };return true;`);
  const both=await call('return window.__skyPixels(0,"both");');
  assert(both.sun.max>50&&both.moon.max>8,JSON.stringify(both));
  await shot(label+'-sky-sun-and-moon');
  const daytime=await call('return window.__skyPixels(0,"sky");');
  const night=await call('return window.__skyPixels(12,"sky");');
  const luminance=frame=>frame.center.split(',').reduce((sum,value)=>sum+Number(value),0);
  assert(daytime.daylight>.98&&night.daylight===0&&luminance(daytime)>luminance(night)*2,JSON.stringify({daytime,night}));
  const blocked=await call('return window.__skyPixels(12,"sun");');
  assert(blocked.sun.max===0&&blocked.sunElevation<-.5,JSON.stringify(blocked));
  const orbital=await call('const state=app.controller.state,f=state.flight;state.phase="coast";f.state=RocketOrbit.circular(400000);f.status="flying";f.controls.lit=false;return window.__skyPixels(17,"sun");');
  assert(orbital.daylight===0&&orbital.direct===1&&orbital.sunElevation<0&&orbital.sun.max>50,JSON.stringify(orbital));
  await shot(label+'-sky-orbital-dawn');
  await click('#returnWorkshop');
  await call('d.getElementById("skyDate").value="2026-04-02";d.getElementById("skyTime").value="05:00";');
  await click('#launchButton');await click('[data-camera-view="sky"]');
  const full=await call('return window.__skyPixels(0,"moon");');
  assert(full.moon.max>50&&full.moonElevation>0,JSON.stringify(full));
  await shot(label+'-sky-full-moon');
  report.flows.push({label,case:'sky-pixels',both,daytime,night,blocked,orbital,full});

  await open(base);
  await wait(()=>call('return d.getElementById("skyAvailability").hidden;'),'ephemeris for mission clock');
  await call(`app.controller.state.craft=${JSON.stringify(T.launched().craft)};app.controller.emit();
    const date=d.getElementById("skyDate");date.value="";date.dispatchEvent(new Event("input",{bubbles:true}));`);
  await click('#launchButton');
  assert(await call('return app.getState().phase==="workshop"&&!d.getElementById("skyError").hidden;'));
  await call(`d.getElementById("skyDate").value="2026-12-31";d.getElementById("skyTime").value="23:59";`);
  await click('#launchButton');
  const start=Date.UTC(2026,11,31,23,59);
  assert.equal(await call('return app.getScene().skyUtc;'),start);
  await call(`app.controller.state=${JSON.stringify(T.reachOrbit())};const f=app.controller.state.flight;f.state=RocketOrbit.circular(400000);f.t=0;app.controller.emit();`);
  for(const rate of [1,100,1000]){
    const result=await call(`app.controller.play();const before=app.getState().flight.t,actual=RocketRuntime.advanceFrame(app.controller,.1,${rate});
      app.controller.pause();const t=app.getState().flight.t;return {elapsed:t-before,actual,t,utc:app.getScene().skyUtc};`);
    assert(Math.abs(result.elapsed-rate*.1)<.001&&Math.abs(result.utc-start-result.t*1000)<.001,JSON.stringify(result));
  }
  const drawn=await call('const s=app.getScene();app.controller.state.flight.t+=.25;s.draw();return s.skyUtc;');
  assert.equal(drawn,await call(`return ${start}+app.getState().flight.t*1000;`));
  await click('#separateButton');
  const frozen=await call('return app.getScene().skyUtc;');
  await click('#bodySelect');await click('[data-control-body="upper"]');
  assert.equal(await call('return app.getScene().skyUtc;'),frozen);
  const graphic=await call(`const s=app.getScene();window.__skyContext=s.renderer.getContext().getExtension('WEBGL_lose_context');
    if(!window.__skyContext)return false;window.__skyContext.loseContext();return true;`);
  assert(graphic);
  await wait(()=>call('return app.getScene().lost;'),'sky WebGL lost');
  await call('window.__skyContext.restoreContext();');
  await wait(()=>call('const s=app.getScene();return !s.lost&&s.sky.material.uniforms.uCelestial.value===1;'),'sky WebGL restored');
  assert.equal(await call('return app.getScene().skyUtc;'),frozen);
  await call('app.controller.state.flight.t=604800;app.controller.emit();');
  assert.equal(await call('return d.getElementById("skyUtc").textContent;'),'2027-01-07 23:59:00 UTC');
  await click('#returnWorkshop');
  assert.equal(await call('return d.getElementById("skyDate").value;'),'2026-12-31');
  await open(base);
  assert.equal(await call('return d.getElementById("skyDate").value;'),'2026-03-20');
  report.flows.push({label,case:'sky-clock',rates:[1,100,1000],bodySwitch:true,contextRestore:true,yearEnd:true});

  const mock=await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`const originalFetch=window.fetch;window.fetch=(url,options)=>String(url).endsWith('/sky-ephemeris.json')?Promise.resolve(new Response('{}')):originalFetch(url,options);`});
  try{
    const pad=T.launched();pad.phase='pad';pad.flight.controls.lit=false;
    await open(base,pad);
    await wait(()=>call('return d.getElementById("skyAvailability").textContent.includes("暫不可用");'),'invalid ephemeris fallback');
    assert(await call('return d.querySelector("[data-camera-view=sky]").disabled&&app.getScene().sky.material.uniforms.uCelestial.value===0;'));
    await click('#igniteButton');
    await wait(()=>call('return app.getState().flight.t>0;'),'flight without ephemeris');
    await call('app.controller.pause();');
  }finally{await cdp.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});}
  report.flows.push({label,case:'sky-fallback'});
}

module.exports={run};
