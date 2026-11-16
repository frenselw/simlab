'use strict';
const assert=require('node:assert/strict');
const surface=require('../sim/rocket-side-booster-lab/surface');
const sky=require('../sim/rocket-side-booster-lab/sky');
const ephemeris=require('../sim/rocket-side-booster-lab/assets/sky-ephemeris.json');

function moveFlight(flight, angle, altitude, radius) {
  const n=[Math.cos(angle),Math.sin(angle)];
  const ground=surface.radius([radius*n[0],radius*n[1],0]);
  flight.status='flying';flight.controls.lit=false;flight.attitude=angle;
  flight.state=[(ground+altitude)*n[0],(ground+altitude)*n[1],0,0,0,0];
}

async function run({base,label,P,T,H,cdp,call,viewport,open,wait,shot,report}) {
  for(const [width,height] of [[390,844],[1280,800]]) {
    await viewport(width,height);
    if(width>=960)await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await open(base,T.reachOrbit());
    await wait(()=>call('return d.getElementById("skyAvailability").hidden;'),'world ephemeris');
    await call('app.view("orbit");');
    const orbit=await call('const s=app.getScene();return {width:s.earthMap.image.width,clouds:s.clouds.material.uniforms.uMap.value.image.width,earth:s.earth.visible,textures:s.diagnostics().textureBytes};');
    assert.equal(orbit.width, width<960?1024:2048);
    assert(orbit.earth&&orbit.clouds===512&&orbit.textures<50e6,JSON.stringify(orbit));
    await shot(label+'-procedural-orbit-'+width);
    if(width>=960){
      await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
      try{
        const zoom=await call('const s=app.getScene(),r=s.host.getBoundingClientRect(),p=s.project(s.earth.position),c={x:r.left+r.width/2,y:r.top+r.height/2};s.transformOrbit(1000/(6*s.orbitFrame.pixelsPerUnit),{x:r.left+p.x,y:r.top+p.y},c);s.draw();return{requested:s.earthDetailRequested,diameter:s.orbitFrame.pixelsPerUnit*6};');
        assert(zoom.requested&&zoom.diameter>=900,JSON.stringify(zoom));
        await H.waitForCondition(()=>call('return app.getScene().earthMap.image.width===4096;'),'4K Earth while offline',40000);
        orbit.detailWidth=4096;
        await shot(label+'-procedural-orbit-coast-4k');
      }finally{
        await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
      }
    }
    const [east,up]=sky.at(ephemeris,sky.DEFAULT_START).sun, day=Math.atan2(east,up);
    const frames=[];
    for(const [name,angle] of [['day',day],['night',day+Math.PI]]) {
      const state=T.launched();state.phase='coast';moveFlight(state.flight,angle,5000,P.R);
      const frame=await call('app.controller.state='+JSON.stringify(state)+';app.controller.emit();app.view("follow");const s=app.getScene();return {agl:RocketSurface.clearance(s.data.flight.state),lighting:s.lighting,world:s.globalTerrain.userData,lost:s.lost};');
      assert(Math.abs(frame.agl-5000)<.001&&!frame.lost,JSON.stringify(frame));
      await shot(label+'-procedural-'+name+'-'+width);
      frames.push(frame);
    }
    assert(frames[0].lighting.daylight>frames[1].lighting.daylight);
    report.flows.push({label,case:'world',width,orbit,frames});
  }
}

async function detail({base,label,P,T,cdp,call,viewport,open,wait,shot,report}) {
  await viewport(1024,768);
  const state=T.launched();state.phase='coast';moveFlight(state.flight, .113, 5000, P.R);
  await open(base,state);
  await wait(()=>call('return app.getScene().globalTerrain.userData.active.length>0;'),'generated mountain mesh');
  const first=await call('const s=app.getScene(),model=JSON.stringify(app.getState());s.yaw+=.2;s.draw();return{...s.globalTerrain.userData,unchanged:JSON.stringify(app.getState())===model};');
  assert(first.procedural&&first.fineTriangles>=8192&&first.centerSpacing<600&&first.unchanged,JSON.stringify(first));
  moveFlight(state.flight, .117, 6500, P.R);
  await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  try {
    await call('app.controller.state='+JSON.stringify(state)+';app.controller.emit();app.view("follow",true);const s=app.getScene();s.pitch=.38;s.yaw=2.9;s.draw();');
    await wait(()=>call('return app.getScene().globalTerrain.userData.rebuilds>'+first.rebuilds+';'),'next mountain mesh while offline');
    const second=await call('const s=app.getScene();return{...s.globalTerrain.userData,shaders:s.renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)};');
    assert(second.fineTriangles===first.fineTriangles&&second.shaders);
    await shot(label+'-procedural-remote-ground-detail');
    moveFlight(state.flight, -20100/P.R, 4100, P.R);
    await call('app.controller.state='+JSON.stringify(state)+';app.controller.emit();const s=app.getScene();s.pitch=.32;s.yaw=-.18;s.draw();');
    await shot(label+'-procedural-coast-detail');
    report.flows.push({label,case:'detail',first,second,offline:true});
  } finally {
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  }
}
async function distantGlobe({base,label,P,T,cdp,call,viewport,open,shot,report}){
  const state=T.reachOrbit(),f=state.flight,sun=sky.at(ephemeris,sky.DEFAULT_START).sun;
  const angle=Math.atan2(sun[0],sun[1])+.32;
  f.t=0;f.controls.lit=false;state.phase='coast';
  moveFlight(f,angle,30000000,P.R);
  await viewport(390,844);await open(base,state);
  await call('d.getElementById("toggleFlightControls").click();');
  const rows=await call(`return (async()=>{
    const T=await import('./vendor/three-0.185.1/three.module.min.js'),s=app.getScene(),r=s.renderer,
      scene=s.scene,earth=s.earth,original=earth.material,prior=r.getRenderTarget(),clear=r.getClearColor(new T.Color()),
      {x:width,y:height}=r.getDrawingBufferSize(new T.Vector2()),gl=r.getContext(),
      pixels=new Uint8Array(width*height*4),mask=pixels.slice(),flight=app.controller.state.flight;
    const maskMaterial=new T.ShaderMaterial({uniforms:{uSun:{value:s.planetSun},uDistantGlobe:{value:1}},vertexShader:original.vertexShader,
      fragmentShader:'varying vec3 vNormal;uniform vec3 uSun;void main(){if(dot(normalize(vNormal),uSun)<.4)discard;gl_FragColor=vec4(1.0);}'});
    const layers=scene.children.map(node=>[node,node.visible]),rows=[];
    try{
      for(const km of [17000,30000,57000,98500]){
        const radius=RocketParts.R+km*1000;
        flight.state=[radius*Math.cos(${angle}),radius*Math.sin(${angle}),0,0,0,0];
        app.controller.emit();s.followManual=true;
        for(const [yaw,pitch,zoom] of [[-.65,1.35,1],[-.36,1.51,1.8],[1.1,1.60,.7]]){
          s.yaw=yaw;s.pitch=pitch;s.setZoom(zoom);s.draw();
          if(s.distantGlobe.value!==1||!earth.material.depthWrite||s.oceanDepth.visible)throw Error('Distant perspective depth was not enabled');
          const visibility=layers.map(([node])=>node.visible);
          // Use the visible framebuffer to exercise the browser's real clip and resolve path.
          r.setRenderTarget(null);r.setClearColor('#ff00ff');
          for(const [node] of layers)node.visible=node===earth;
          earth.material=maskMaterial;r.render(scene,s.camera);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,mask);
          earth.material=original;
          for(const useFixedClip of km===30000&&yaw===-.65?[true,false]:[true]){
            for(const [i,[node]] of layers.entries())node.visible=visibility[i];
            s.distantGlobe.value=Number(useFixedClip);
            earth.material.depthWrite=useFixedClip;
            s.oceanDepth.visible=!useFixedClip;
            s.rocket.visible=s.velocityArrow.visible=s.thrustArrow.visible=false;
            r.render(scene,s.camera);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            let lit=0,dark=0,holes=0;
            const white=i=>mask[i]===255&&mask[i+1]===255&&mask[i+2]===255;
            for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
              const i=(y*width+x)*4;if(!white(i)||!white(i-8)||!white(i+8)||!white(i-8*width)||!white(i+8*width))continue;
              lit++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<28)dark++;
              if(pixels[i]===255&&pixels[i+1]===0&&pixels[i+2]===255)holes++;
            }
            rows.push({km,yaw,pitch,zoom,useFixedClip,lit,dark,holes});
          }
          r.setRenderTarget(prior);
          for(const [i,[node]] of layers.entries())node.visible=visibility[i];
        }
      }
    }finally{
      r.setRenderTarget(prior);r.setClearColor(clear);earth.material=original;s.distantGlobe.value=1;original.depthWrite=true;
      for(const [node,visible] of layers)node.visible=visible;
      maskMaterial.dispose();
    }
    return rows;
  })();`);
  const fixed=rows.filter(row=>row.useFixedClip&&row.lit>1000);
  assert([17000,30000,57000,98500].every(km=>fixed.filter(row=>row.km===km).length>=2),JSON.stringify(rows));
  assert(fixed.every(row=>row.dark===0&&row.holes===0),JSON.stringify(rows));
  await call(`const s=app.getScene(),f=app.controller.state.flight,r=RocketParts.R+30000000;f.state=[r*Math.cos(${angle}),r*Math.sin(${angle}),0,0,0,0];app.controller.emit();s.yaw=-.65;s.pitch=1.35;s.setZoom(1);s.draw();`);
  const after=await shot(label+'-distant-globe-30000km');
  await call('const s=app.getScene();s.distantGlobe.value=0;s.earth.material.depthWrite=false;s.oceanDepth.visible=true;s.renderer.render(s.scene,s.camera);');
  const before=await shot(label+'-distant-globe-30000km-without-clip-fix');
  await call('app.getScene().draw();');
  const screenPixels=async encoded=>call(`return (async()=>{
    const img=new Image();img.src="data:image/png;base64,${encoded}";await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    return [[48,616],[36,630],[26,703]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data.slice(0,3)));
  })();`);
  const recoveredPixels={before:await screenPixels(before),after:await screenPixels(after)};
  assert(recoveredPixels.after.every(rgb=>Math.max(...rgb)>55),JSON.stringify(recoveredPixels));
  report.flows.push({label,case:'distant-globe',rows,recoveredPixels});
}
module.exports={run,detail,distantGlobe};
