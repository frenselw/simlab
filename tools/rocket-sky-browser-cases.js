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
    assert.equal(await call('return d.getElementById("cameraFollowLabel").textContent;'),'跟隨');
    assert(await call('return d.querySelector("[data-camera-view=factory]").hidden;'));
    await click('#cameraFollow');
    const geometry=await call(`const buttons=[...d.querySelectorAll('[data-camera-view]:enabled:not([hidden])')].map(b=>b.getBoundingClientRect().toJSON());
      return {buttons,stage:d.getElementById('stage').getBoundingClientRect().toJSON()};`);
    assert.equal(geometry.buttons.length,3);
    for(const b of geometry.buttons)assert(b.width>=44&&b.height>=44&&b.left>=geometry.stage.left&&b.right<=geometry.stage.right);
    assert.equal(await call('return d.getElementById("cameraFollowLabel").textContent;'),'鎖定');
    await click('#cameraFollow');
    const menu=await call('return d.getElementById("cameraLockMenu").getBoundingClientRect().toJSON();');
    assert(menu.width>0&&menu.top>=geometry.stage.top&&menu.bottom<=geometry.stage.bottom&&menu.left>=geometry.stage.left&&menu.right<=geometry.stage.right);
    if(width===390)await shot(label+'-camera-lock-menu-mobile');
    await click('#cameraFollow');
    if(width===390||width===1280){
      await call(`const c=app.controller;c.state=RocketModel.change(${JSON.stringify(T.reachOrbit())},{type:'capsule-separate'});
        const f=c.state.flight;f.t=2200;f.state=RocketOrbit.circular(10421000);c.emit();`);
      for(const target of ['sun','moon','earth']){
        await click('#cameraFollow');
        await click(`[data-camera-lock="${target}"]`);
        const locked=await call(`const s=app.getScene(),c=app.controller,button=d.querySelector('[data-camera-lock="${target}"]');
          const project=()=>{
            const camera=s.camera,rocket=s.rocket,disc=s.sky.material.uniforms.uSunDisc.value;
            const craft=rocket.localToWorld(rocket.userData.partBounds.getCenter(camera.position.clone())).project(camera);
            let body=s.cameraLock==='moon'?s.moonTarget:s.earth.position;
            if(s.cameraLock==='sun')body=camera.position.clone().add(camera.position.clone().set(disc.x,disc.y,disc.z));
            return {craft:[craft.x,craft.y],body:body.clone().project(camera).toArray().slice(0,2)};
          };
          const before=project();
          c.state.flight.t+=3600;c.emit();
          const distance=s.camera.position.distanceTo(s.rocket.position);
          s.setZoom(s.zoom*1.1);s.draw();
          return {lock:s.cameraLock,frames:[before,project()],zoomed:s.camera.position.distanceTo(s.rocket.position)<distance,
            drag:s.rotate(50,20),pressed:button.getAttribute('aria-pressed'),closed:d.getElementById('cameraLockMenu').hidden};`);
        assert.equal(locked.lock,target);
        assert(locked.zoomed&&locked.drag===false&&locked.pressed==='true'&&locked.closed,JSON.stringify(locked));
        for(const {craft,body}of locked.frames)assert(Math.hypot(...craft)<.002&&Math.hypot(body[0]-.45,body[1]-.38)<.002,JSON.stringify(locked));
        if(width===390&&target==='earth')await shot(label+'-follow-earth-lock-mobile');
      }
      await click('#cameraFollow');
      await click('[data-camera-lock=""]');
      assert(await call('return app.getScene().cameraLock===null&&d.getElementById("cameraHint").hidden;'));
      await call('d.getElementById("cameraSurface").focus();');
      await key('ArrowUp');
      await wait(()=>call('return app.getScene().followManual;'),'keyboard rotates the unlocked follow camera');
    }
    await click('[data-camera-view="orbit"]');
    assert.equal(await call('return d.getElementById("cameraFollowLabel").textContent;'),'跟隨');
    await click('#cameraFollow');
    assert(await call('return app.getScene().view==="follow"&&d.getElementById("cameraLockMenu").hidden;'));
    report.flows.push({label,case:'follow-lock-layout',width,height,buttons:geometry.buttons.length});
  }

  await viewport(1024,768);await open(base,T.launched());
  await wait(()=>call('return d.getElementById("skyAvailability").hidden;'),'ephemeris for rendering');
  assert(await call('return performance.getEntriesByType("resource").filter(e=>e.name.includes("ephemeris")).map(e=>e.name).every(name=>new URL(name).origin===location.origin);'));
  await H.evaluate(cdp,'(async()=>{window.__skyThree=await import("./vendor/three-0.185.1/three.module.min.js");})()');
  await call(`const s=app.getScene(),T=window.__skyThree;app.view('follow');
    window.__skyPixels=(hours,aim,view='follow',zoom=1,pan=0)=>{
      const f=app.controller.state.flight;f.t=hours*3600;app.controller.emit();
      const orbit=view==='orbit'||view==='plane';
      if(s.view!==view||orbit)app.view(view,true);
      const u=s.sky.material.uniforms,vec=v=>new T.Vector3(v.x,v.y,v.z);
      const sun=vec(u.uSunDisc.value),moon=vec(u.uMoonDisc.value);
      const look=aim==='both'?sun.clone().add(moon).normalize():aim==='sun'?sun.clone():aim==='moon'?moon.clone():new T.Vector3(0,.65,.76).normalize();
      if(orbit){
        look.negate();s.yaw=Math.atan2(look.x,look.z);s.pitch=Math.asin(look.y);s.draw();
        s.setZoom(zoom);s.draw();
        if(pan){
          const r=s.host.getBoundingClientRect(),center={x:r.left+r.width/2,y:r.top+r.height/2};
          s.transformOrbit(1,center,{x:center.x+r.width*pan,y:center.y});s.draw();
        }
      }else{
        s.camera.up.set(0,1,0);s.camera.lookAt(s.camera.position.clone().add(look));s.camera.updateMatrixWorld(true);
        u.uSkyBasis.value.setFromMatrix4(s.camera.matrixWorld);
      }
      const size=512,target=new T.WebGLRenderTarget(size,size),previous=s.renderer.getRenderTarget(),frames=[];
      target.texture.colorSpace=T.SRGBColorSpace;
      try{
        s.renderer.setRenderTarget(target);
        for(const on of [1,0]){u.uCelestial.value=on;s.renderer.render(s.scene,s.camera);const pixels=new Uint8Array(size*size*4);s.renderer.readRenderTargetPixels(target,0,0,size,size,pixels);frames.push(pixels);}
      }finally{u.uCelestial.value=1;s.renderer.setRenderTarget(previous);target.dispose();s.renderer.render(s.scene,s.camera);}
      const sample=direction=>{
        const p=direction.clone().transformDirection(s.camera.matrixWorldInverse),span=u.uSkyTangent.value;
        const x=Math.round((1-p.x/(p.z*span.x))*size/2),y=Math.round((1-p.y/(p.z*span.y))*size/2);
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
  for(const view of ['orbit','plane']){
    const close=await call(`return window.__skyPixels(0,'both','${view}',4,4);`);
    const wide=await call(`return window.__skyPixels(0,'both','${view}',.05,.3);`);
    for(const frame of [close,wide])assert(frame.sun.max>50&&frame.moon.max>8,JSON.stringify({view,frame}));
    assert.deepEqual([close.sun,close.moon,close.observer],[wide.sun,wide.moon,wide.observer]);
    await shot(label+'-'+view+'-sun-and-moon');
    const behind=await call(`return window.__skyPixels(0,'sun','${view}',1);`);
    assert.equal(behind.sun.max,0,JSON.stringify(behind));
    report.flows.push({label,case:'orbit-sky',view,close,wide,behind});
  }
  await click('#returnWorkshop');
  await call('d.getElementById("skyDate").value="2026-04-02";d.getElementById("skyTime").value="05:00";');
  await click('#launchButton');
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
    await click('#cameraFollow');await click('#cameraFollow');
    assert(await call(`return d.querySelector('[data-camera-lock="sun"]').disabled&&d.querySelector('[data-camera-lock="moon"]').disabled&&
      !d.querySelector('[data-camera-lock="earth"]').disabled&&app.getScene().sky.material.uniforms.uCelestial.value===0;`));
    await click('[data-camera-lock="earth"]');
    await click('#igniteButton');
    assert(await call('const c=app.controller;if(!c.running)return false;RocketRuntime.advanceFrame(c,2,1);c.pause();return c.state.flight.t>0&&c.state.flight.controls.lit;'));
  }finally{await cdp.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});}
  report.flows.push({label,case:'sky-fallback'});
}

module.exports={run};
