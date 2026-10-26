import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {EARTH_DAY,material,dispose,fadeEnvironment,buildRocket,createPad,createRelief,createLandscape,createPlanet,createSky,textureBudget} from './scene-art.js';
import {createContactGround,clipContact} from './contact-ground.js';
import {createImpactEffects,hullMinimum,hullClearance} from './impact-effects.js';
const P=window.RocketParts,O=window.RocketOrbit,M=window.RocketModel,S=window.RocketSurface;
function vectorArrow(color){const group=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.74,8),mat),head=new THREE.Mesh(new THREE.ConeGeometry(.09,.26,10),mat);shaft.position.y=.37;head.position.y=.87;shaft.renderOrder=head.renderOrder=10;group.add(shaft,head);return group;}
export class RocketScene{
  constructor(host,onFault){
    this.host=host;this.onFault=onFault;this.renderCount=0;this.quality=0;this.frameSamples=[];this.sampleAfter=0;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<960?1.5:2));this.renderer.setClearColor('#dbece2');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.01,50000);this.ambient=new THREE.HemisphereLight('#fafff3','#64818d',1.65);this.sunLight=new THREE.DirectionalLight('#fff5e5',2.4);this.sunLight.position.set(30,40,40);this.fillLight=new THREE.DirectionalLight('#a4cce7',.6);this.fillLight.position.set(-20,10,-30);this.scene.add(this.ambient,this.sunLight,this.fillLight);
    const planet=createPlanet();this.studio=createPad();this.scene.add(this.studio);this.relief=createRelief(planet.sun);this.scene.add(this.relief);this.landscape=createLandscape(this.relief);this.scene.add(this.landscape);this.sky=createSky();this.sky.renderOrder=-10;this.scene.add(this.sky);
    this.earth=planet.earth;this.clouds=planet.clouds;this.halo=planet.halo;this.planetSun=planet.sun;this.planetOpacity=planet.opacity;this.planetSurface=planet.surface;this.earthMap=this.earth.material.uniforms.uMap.value;this.scene.add(this.earth,this.clouds,this.halo);this.globalTerrain=planet.globalTerrain;this.globalTerrain.onChange=()=>this.draw();this.scene.add(this.globalTerrain);this.contactGround=createContactGround(planet.sun,this.globalTerrain.colorAt);this.scene.add(this.contactGround);const materials=new Set();this.relief.traverse(o=>{if(o.material&&o.geometry?.attributes.landFade)materials.add(o.material);});for(const material of materials)clipContact(material,this.contactGround.clipping,true);clipContact(this.globalTerrain.children[0].material,this.contactGround.clipping);
    Object.assign(this.earth.material.uniforms,this.contactGround.clipping);this.earth.material.fragmentShader='uniform vec3 uContactCenter;uniform float uContactRadius;\n'+this.earth.material.fragmentShader.replace('vec2 metres=chart*6371000.0;', 'vec2 metres=chart*6371000.0;if(uCloud<.5&&uContactRadius>0.0&&distance(normalize(vec3(chart.x,vSurface.y,chart.y)),uContactCenter)<uContactRadius)discard;');
    this.impacts=createImpactEffects();this.scene.add(this.impacts);this.effectClock=0;
    const coords=[],starColors=[],sizes=[],rng=(()=>{let t=512;return()=>{t=(t*1664525+1013904223)>>>0;return t/4294967296;};})();
    for(let i=0;i<1050;i++){const a=rng()*Math.PI*2,latitude=i%4===0?(rng()-.5)*.26+Math.sin(a)*.35:Math.asin(2*rng()-1),bright=rng();coords.push(70*Math.cos(latitude)*Math.cos(a),70*Math.sin(latitude),70*Math.cos(latitude)*Math.sin(a));const color=new THREE.Color(i%7===0?'#a9d0fa':i%11===0?'#ffe0af':'#e1edf5').multiplyScalar(.35+bright*.65);starColors.push(color.r,color.g,color.b);sizes.push(bright>.97?2.4:bright>.8?1.4:.65+bright*.6);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));geo.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));this.starPixelRatio={value:this.renderer.getPixelRatio()};this.stars=new THREE.Points(geo,new THREE.PointsMaterial({vertexColors:true,size:1,sizeAttenuation:false,transparent:true,depthWrite:false}));this.scene.add(this.stars);
    // Clip stars analytically to the globe, including cameras inside its atmosphere.
    this.starOcclusion={uPlanetCenter:{value:this.earth.position},uPlanetRadius:{value:0}};this.stars.material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.starOcclusion,{uPixelRatio:this.starPixelRatio});shader.vertexShader='attribute float aSize;uniform float uPixelRatio;varying vec3 vStarWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;','gl_PointSize = aSize * uPixelRatio;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStarWorld=(modelMatrix*vec4(position,1.0)).xyz;');shader.fragmentShader='varying vec3 vStarWorld;uniform vec3 uPlanetCenter;uniform float uPlanetRadius;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= 1.0-smoothstep(.12,.5,length(gl_PointCoord-.5));\n#include <alphatest_fragment>');shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 center=uPlanetCenter-cameraPosition;float along=dot(normalize(vStarWorld-cameraPosition),center);float radius2=uPlanetRadius*uPlanetRadius;if(uPlanetRadius>0.0&&(dot(center,center)<radius2||(along>0.0&&dot(center,center)-along*along<radius2)))discard;');};this.stars.material.customProgramCacheKey=()=> 'rocket-painted-stars';
    this.velocityArrow=vectorArrow('#137b7e');this.thrustArrow=vectorArrow('#9c5e20');this.scene.add(this.velocityArrow,this.thrustArrow);this.lines={};this.data=null;this.view='factory';this.yaw=.55;this.pitch=.18;this.zoom=1;this.lost=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onFault('lost');});this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.lost=false;this.renderer.resetState();onFault('restored');this.draw();});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.deviceRatio=devicePixelRatio;const ratio=Math.min(this.deviceRatio,(innerWidth<960?[1.5,1.25,1]:[2,1.5,1.25])[this.quality]);if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);this.starPixelRatio.value=ratio;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.draw();}
  observeFrame(milliseconds,now){
    if(!this.sampleAfter){this.sampleAfter=now+2000;return;}
    if(now<this.sampleAfter||milliseconds<=0||milliseconds>250||this.quality>=2)return;
    this.frameSamples.push(milliseconds);if(this.frameSamples.length<120)return;
    this.frameSamples.sort((a,b)=>a-b);const slow=this.frameSamples[107]>40;this.frameSamples.length=0;
    if(slow){this.quality++;this.sampleAfter=now+5000;this.resize();}
  }
  resetFrameSample(){this.frameSamples.length=0;this.sampleAfter=0;}
  setView(view){this.view=view;this.yaw=view==='plane'?0:view==='orbit'?.7:view==='follow'?-.65:.55;this.pitch=view==='plane'?0:view==='orbit'?.48:.18;this.zoom=1;this.draw();}
  rotate(dx,dy){this.yaw+=dx*.008;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+dy*.006));this.draw();}
  clearSeparation(){if(this.separation){this.scene.remove(this.separation.body);dispose(this.separation.body);this.separation=null;}}
  setData(data){
    const previous=this.data?.flight,f=data.flight,craft=JSON.stringify(data.craft),key=JSON.stringify([data.craft,f?.separated]);
    if(!data.live||!this.data?.live||!f||f.t<(this.effectPose?.t||0)||craft!==this.effectCraft||previous?.source!==f.source){this.clearSeparation();this.effectPose=null;this.rcsUntil=0;}
    if(!data.live||!this.data?.live||!f||f.t<(this.lastFlightTime||0)||craft!==this.effectCraft){this.impacts.clear();this.impacted=false;this.pendingImpact=false;}
    if(data.live&&this.data?.live&&f?.status==='impact'&&this.lastFlightStatus==='flying')this.pendingImpact=true;
    if(key!==this.craftKey){
      if(this.rocket){
        if(data.live&&this.data?.live&&f?.separated&&previous&&!previous.separated&&craft===this.effectCraft){
          this.clearSeparation();const coast=P.clone(previous);coast.controls.lit=false;coast.state[3]-=1.5*Math.cos(f.attitude);coast.state[4]-=1.5*Math.sin(f.attitude);
          this.separation={body:this.rocket,coast,mass:P.dry(previous.craft.stages[0])+previous.fuel[0]+60,start:f.t,visualAge:0,attitude:f.attitude,join:this.rocket.userData.ranges[1].base,height:this.rocket.userData.height};
          for(const child of this.rocket.children)child.visible=Boolean(child.userData.part&&(child.userData.part.stage===0||child.userData.part.part==='separator'));
        }else{this.scene.remove(this.rocket);dispose(this.rocket);}
      }
      this.rocket=buildRocket(data.craft,Boolean(f?.separated));this.scene.add(this.rocket);this.craftKey=key;
    }
    this.data=data;this.effectCraft=craft;this.lastFlightStatus=f?.status;this.lastFlightTime=f?.t||0;this.draw();
  }
  drawEffects(f,space,theta){
    const pose=this.effectPose,dt=f&&pose?f.t-pose.t:0,turn=f&&pose?Math.atan2(Math.sin(f.attitude-pose.attitude),Math.cos(f.attitude-pose.attitude)):0;
    if(dt>0){
      this.rcsUntil=0;
      // Slow local-vertical/orbit tracking must not look like a permanent RCS burn.
      if(this.data.live&&Math.abs(turn)/dt>Math.PI/360){this.rcsDirection=Math.sign(turn);const target=M.targetAttitude(f)-f.attitude,aligned=Math.abs(Math.atan2(Math.sin(target),Math.cos(target)))<1e-5;this.rcsUntil=dt>.25&&aligned?f.t:f.t+.08;}
    }
    if(f)this.effectPose={t:f.t,attitude:f.attitude};
    for(const [i,jets]of this.rocket.userData.rcs.entries()){jets.visible=Boolean(this.data.live&&f&&!['impact','escaped'].includes(f.status)&&f.t<this.rcsUntil&&this.rcsDirection===[-1,1][i]);for(const plume of jets.children)plume.material.opacity=plume.userData.baseOpacity*(this.reducedMotion?1:.85+.15*Math.sin(f?.t*70||0));}
    const drop=this.separation;if(!drop||!f)return;
    if(drop.coast.status==='impact'){this.impacts.emit(drop.coast.state,drop.coast.t,Math.max(.015,this.rocket.scale.y*this.rocket.userData.height*.6));this.clearSeparation();return;}
    const angle=space?0:theta,dx=drop.coast.state[0]-f.state[0],dy=drop.coast.state[1]-f.state[1],axis=new THREE.Vector3(Math.sin(drop.attitude-angle),Math.cos(drop.attitude-angle),0),offset=new THREE.Vector3(dy*Math.cos(angle)-dx*Math.sin(angle),dx*Math.cos(angle)+dy*Math.sin(angle),0);
    // Flight coordinates use metres; only the stage artwork uses the enlarged scale.
    const units=space?3/P.R:.001,scale=Math.min(this.rocket.scale.y,Math.max(0,O.elements(drop.coast.state).height)*units*.9/(drop.join+2));
    drop.body.scale.setScalar(scale);drop.body.position.copy(this.rocket.position).addScaledVector(offset,units).addScaledVector(axis,-drop.join*scale);drop.body.rotation.z=angle-drop.attitude;
    drop.body.updateMatrixWorld(true);
  }
  line(name,points,color,dashed=false){
    const old=this.lines[name];if(old){this.scene.remove(old);old.geometry.dispose();old.material.dispose();delete this.lines[name];}if(points.length<2)return;
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(q=>new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,q[2]*3/P.R))),mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.035,gapSize:.025,transparent:true,opacity:.9}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}),line=new THREE.Line(geometry,mat);if(dashed)line.computeLineDistances();this.scene.add(line);this.lines[name]=line;
  }
  setPaths(actual,predicted,planned){this.line('actual',actual,'#ee9674');this.line('predicted',predicted,'#b0e3d4',true);this.line('planned',planned,'#f6ca74',true);}
  draw(){
    if(!this.data||!this.rocket||this.lost)return;const {flight:f,workshop}=this.data,space=['orbit','plane'].includes(this.view),factory=workshop&&this.view==='factory',height=this.rocket.userData.height;
    const agl=f?S.clearance(f.state,f.t):0,altitude=f?Math.max(0,O.elements(f.state).height):0,theta=f?Math.atan2(f.state[1],f.state[0]):0;
    this.earth.geometry=f&&!space&&altitude<120000?this.earth.userData.nearGeometry:this.earth.userData.farGeometry;
    const drop=this.separation;if(drop&&f)for(let i=0;i<20000&&drop.coast.t<f.t-1e-8&&!['impact','escaped'].includes(drop.coast.status);i++)M.step(drop.coast,Math.min(O.elements(drop.coast.state).height<120000?.1:2,f.t-drop.coast.t),{mass:drop.mass});
    const separation=this.separation,blend=separation?THREE.MathUtils.smoothstep(separation.visualAge,0,.6):1,displayHeight=separation?THREE.MathUtils.lerp(separation.height,height,blend):height;
    const localOpacity=(1-THREE.MathUtils.smoothstep(altitude,20000,60000))*(1-THREE.MathUtils.smoothstep(Math.abs(theta)*P.R,300000,600000)),local=Boolean(f&&!space&&localOpacity>0);
    this.environmentOpacity=localOpacity;this.planetOpacity.value=space?1:1-localOpacity;
    this.studio.visible=factory||local;this.landscape.visible=local;this.earth.visible=space||Boolean(f&&!factory);this.clouds.visible=this.halo.visible=this.earth.visible&&this.planetOpacity.value>0;Object.values(this.lines).forEach(l=>l.visible=space);
    fadeEnvironment(this.studio,factory||!f?1:localOpacity);fadeEnvironment(this.landscape,localOpacity);
    // The globe is the only ground surface; geography stays fixed while small nearby props fade with altitude.
    this.earth.renderOrder=-2;this.earth.material.depthWrite=true;
    const sky=space?1:THREE.MathUtils.smoothstep(altitude,0,120000);this.skyFraction=sky;
    this.sky.visible=!(factory||!f&&!space);this.sky.material.uniforms.uSpace.value=sky;
    const target=new THREE.Vector3();let distance;
    if(space){this.earth.position.set(0,0,0);this.earth.scale.setScalar(3);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar(3.045);this.rocket.scale.setScalar(.33/displayHeight);this.rocket.position.set(f?f.state[1]*3/P.R:0,f?f.state[0]*3/P.R:3,0);this.rocket.rotation.z=f?-f.attitude:0;target.set(0,.3,0);const h=this.host.clientHeight;distance=Math.max(14.5,3*h/(2*Math.tan(Math.PI/9)*Math.max(20,(h-130)/2)))/this.zoom;}
    else if(factory||!f){this.rocket.scale.setScalar(1);this.rocket.position.set(0,0,0);this.rocket.rotation.z=0;target.set(0,height*.44,0);distance=Math.max(24,height*1.85)/this.zoom;}
    else{
      // Leave depth clearance for Float32 rounding at planetary scale.
      const r=Math.hypot(f.state[0],f.state[1]);this.earth.position.set(0,-r/1000,0);this.earth.scale.setScalar((P.R-5)/1000);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar((P.R+80000)/1000);
      distance=Math.max(.035,displayHeight*(this.host.clientHeight<240?.007:.0038),Math.max(0,agl)/1000*3+.035)/this.zoom;
      // Keep the upper stage framing independent of the falling stage's distance.
      if(separation){const close=Math.max(.035,displayHeight*.0038,Math.max(0,agl)*.0002)/this.zoom;distance*=Math.pow(Math.min(1,close/distance),blend);}
      this.rocket.scale.setScalar(Math.max(.001,distance*.16/displayHeight));this.rocket.position.set(0,0,0);this.rocket.rotation.z=theta-f.attitude;target.set(0,displayHeight*this.rocket.scale.y*.65,0);
      for(const environment of [this.studio,this.landscape,this.relief]){environment.scale.setScalar(.001);environment.position.set(-P.R*Math.sin(theta)/1000,(P.R*Math.cos(theta)-r)/1000,0);environment.rotation.z=theta;}
    }
    if(f&&!factory&&!space&&agl<500){const blend=1-THREE.MathUtils.smoothstep(agl,200,500),minimum=hullMinimum(this.rocket,this.rocket.rotation.z);let offset=-minimum*this.rocket.scale.y*blend+Math.max(0,-agl)/1000;if(agl<10){const key=[f.t,f.attitude,this.rocket.scale.y].join(',');if(this.rocket.contactKey!==key){this.rocket.contactKey=key;this.rocket.contactOffset=(Math.max(0,agl)-hullClearance(this.rocket,f,this.rocket.rotation.z))/1000;}offset=this.rocket.contactOffset;}this.rocket.position.y+=offset;target.copy(this.rocket.position).add(new THREE.Vector3(0,displayHeight*this.rocket.scale.y*.5,0).applyQuaternion(this.rocket.quaternion));}
    if(separation)this.rocket.position.addScaledVector(new THREE.Vector3(Math.sin(separation.attitude-(space?0:theta)),Math.cos(separation.attitude-(space?0:theta)),0),separation.join*(1-blend)*this.rocket.scale.y);
    if(space&&f&&O.elements(f.state).r>2*P.R)distance=Math.max(distance,(O.elements(f.state).r*3/P.R+1)/Math.tan(Math.PI/9)*1.1/this.zoom);
    this.earth.rotation.y=.7+(f?.t||0)%EARTH_DAY/EARTH_DAY*O.TAU;this.earth.rotation.z=space?0:theta;this.clouds.position.copy(this.earth.position);this.clouds.scale.copy(this.earth.scale).multiplyScalar(1.0018);this.clouds.rotation.copy(this.earth.rotation);this.clouds.rotateY(.025);const sunAngle=space?0:theta;this.planetSun.set(-.5*Math.cos(sunAngle)-.3*Math.sin(sunAngle),-.5*Math.sin(sunAngle)+.3*Math.cos(sunAngle),1).normalize();
    this.sunLight.position.copy(factory||!f?new THREE.Vector3(30,40,40):this.planetSun);this.sunLight.intensity=factory||!f?2.4:2;this.ambient.intensity=factory||!f?1.65:1;this.ambient.position.copy(space?this.rocket.position:new THREE.Vector3(0,1,0));this.fillLight.intensity=factory||!f?.6:0;
    if(factory||!f){this.studio.scale.setScalar(1);this.studio.position.set(0,0,0);this.studio.rotation.z=0;}
    this.landscape.rotation.y=(f?.t||0)%EARTH_DAY/EARTH_DAY*O.TAU;this.relief.rotation.y=this.landscape.rotation.y;
    this.globalTerrain.position.copy(this.earth.position);this.globalTerrain.scale.copy(this.earth.scale);this.globalTerrain.rotation.copy(this.earth.rotation);this.globalTerrain.rotateY(-.7);this.globalTerrain.updateMatrixWorld(true);
    const positionCamera=pitch=>this.camera.position.copy(target).add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(this.yaw)*Math.cos(pitch)*distance));positionCamera(this.pitch);
    let cameraClearance=Infinity;
    if(!space){
      const inverse=this.globalTerrain.matrixWorld.clone().invert(),point=new THREE.Vector3(),margin=factory||!f?.2:.002;
      const clearance=()=>{if(factory||!f)return this.camera.position.y+.8;point.copy(this.camera.position).applyMatrix4(inverse);const radius=point.length();point.divideScalar(radius);return (radius*(P.R-5)-P.R-S.heightAt(point.x,point.y,point.z))/1000;};
      cameraClearance=clearance();
      if(cameraClearance<margin){let low=this.pitch,high=Math.PI/2;for(let i=0;i<16;i++){const pitch=(low+high)/2;positionCamera(pitch);if(clearance()<margin)low=pitch;else high=pitch;}this.pitch=high;positionCamera(this.pitch);cameraClearance=clearance();}
    }
    this.camera.near=space?.05:factory||!f?.1:Math.max(.0001,Math.min(distance*.05,cameraClearance*.25));this.camera.far=space?Math.max(150,distance*4):factory||!f?500:Math.max(20000,distance*6);this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);this.sky.scale.setScalar(this.camera.far*.48);
    const pixelsPerUnit=this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*distance),groundDetails=f&&!space&&pixelsPerUnit*.001>.02&&this.quality<2;this.studio.workshopFloor.visible=factory||!f;for(const mesh of this.studio.nearDetails)mesh.visible=factory||!f||groundDetails;for(const mesh of this.landscape.nearDetails)mesh.visible=groundDetails;for(const mesh of this.landscape.landmarks)mesh.visible=Boolean(f&&!space);for(const rocket of [this.rocket,this.assemblyPreview])for(const mesh of rocket?.microDetails||[])mesh.visible=pixelsPerUnit*this.rocket.scale.y>18&&this.quality<2;
    this.relief.updateDetail(this.camera,this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),this.quality,Boolean(f&&!factory&&!space));
    this.earth.material.uniforms.uRelief.value=this.relief.visible?this.relief.userData.opacity:0;

    this.globalTerrain.updateDetail(this.camera,this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),this.quality,this.earth.visible,this.relief.visible&&this.relief.userData.opacity>=.999,!space&&(altitude>20000||Math.abs(theta)*P.R>211200));
    this.contactGround.position.copy(this.globalTerrain.position);this.contactGround.rotation.copy(this.globalTerrain.rotation);this.contactGround.scale.copy(this.globalTerrain.scale).multiplyScalar(space?1:P.R/(P.R-5));this.contactGround.update(f,Boolean(f&&!factory&&!space&&agl<5000),this.quality);this.contactGround.updateMatrixWorld(true);
    this.starOcclusion.uPlanetRadius.value=this.earth.visible?this.earth.scale.x:0;this.stars.visible=space||Boolean(f&&altitude>25000);this.stars.material.transparent=true;this.stars.material.opacity=space?1:THREE.MathUtils.smoothstep(altitude,25000,120000);this.stars.material.depthWrite=false;this.stars.position.copy(this.camera.position);this.stars.scale.setScalar(this.camera.far/140);
    this.rocket.visible=(!space||Boolean(f))&&!this.assemblyPreview?.visible;
    if(this.assemblyPreview?.visible){this.assemblyPreview.position.copy(this.rocket.position);this.assemblyPreview.quaternion.copy(this.rocket.quaternion);this.assemblyPreview.scale.copy(this.rocket.scale);}const lit=f?.controls.lit&&f.controls.throttle>0&&f.fuel[f.active]>0;this.rocket.userData.flame.visible=Boolean(lit);if(lit){this.rocket.userData.flame.scale.y=(.4+.7*f.controls.throttle)*(this.reducedMotion?.9:.9+.08*Math.sin(f.t*9));const flame=this.rocket.userData.flame,width=.65+.35*f.controls.throttle;if(flame.userData.width!==width){const matrix=new THREE.Matrix4();for(const plume of flame.children){for(let i=0;i<plume.count;i++){plume.getMatrixAt(i,matrix);matrix.elements[0]=matrix.elements[10]=width;plume.setMatrixAt(i,matrix);}plume.instanceMatrix.needsUpdate=true;}flame.userData.width=width;}}
    this.drawEffects(f,space,theta);
    if(this.pendingImpact){this.impacts.emit(f.state,f.t,Math.max(.015,displayHeight*this.rocket.scale.y*.8),true);this.pendingImpact=false;this.impacted=true;this.effectClock=performance.now();}
    this.impacts.update(this.contactGround.visible?this.contactGround:this.globalTerrain,this.reducedMotion);if(this.impacted&&f?.status==='impact'&&this.impacts.mainHidden())this.rocket.visible=false;else if(this.impacted&&f?.status==='impact'&&!this.impacts.userData.active)this.rocket.visible=false;
    this.velocityArrow.visible=Boolean(f&&Math.hypot(f.state[3],f.state[4])>.1);this.thrustArrow.visible=Boolean(f&&M.thrust(f)>0);
    if(f){
      const theta=space?0:Math.atan2(f.state[1],f.state[0]),o=O.elements(f.state),center=this.rocket.localToWorld(new THREE.Vector3(0,height*.5,0)),axis=new THREE.Vector3(0,1,0).applyQuaternion(this.rocket.quaternion),forward=this.camera.getWorldDirection(new THREE.Vector3()),depth=center.clone().sub(this.camera.position).dot(forward),pixelWorld=2*depth*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)/this.host.clientHeight,reference=pixelWorld*Math.min(90,this.host.clientHeight*.18,this.host.clientWidth*.25),halfHeight=height*this.rocket.scale.y*.5,radius=1.6*this.rocket.scale.x;
      for(const [arrow,direction,length,sign]of [[this.velocityArrow,new THREE.Vector3(space?f.state[4]:o.tangential,space?f.state[3]:o.radial,0),reference*o.speed/8000,-1],[this.thrustArrow,new THREE.Vector3(Math.sin(f.attitude-theta),Math.cos(f.attitude-theta),0),reference*M.thrust(f)/600000,1]]){
        if(!arrow.visible)continue;direction.normalize();const side=forward.clone().cross(direction);if(side.lengthSq()<1e-8)side.set(1,0,0).applyQuaternion(this.camera.quaternion);side.normalize();const a=side.dot(axis),support=halfHeight*Math.abs(a)+radius*Math.sqrt(Math.max(0,1-a*a)),width=Math.min(pixelWorld*40,length*2);
        // Keep the whole vector outside the rotated rocket's enclosing cylinder.
        arrow.position.copy(center).addScaledVector(side,sign*(support+8*pixelWorld));arrow.scale.set(width,length,width);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
      }
    }
    try{this.renderer.render(this.scene,this.camera);this.renderCount++;}catch(_){this.lost=true;this.onFault('render');}
  }
  animateEffects(now){const elapsed=this.effectClock?Math.max(0,(now-this.effectClock)/1000):0,delta=Math.min(.05,elapsed);this.effectClock=now;if(this.lost||document.hidden||!this.data?.live||(this.data.running===false&&this.data.flight?.status!=='impact'))return false;const separating=this.separation&&this.data.running!==false&&this.separation.visualAge<.6;if(separating)this.separation.visualAge=Math.min(.6,this.separation.visualAge+elapsed);if(this.impacts.advance(delta)||separating){this.draw();return true;}return false;}
  project(position){const p=position.clone().project(this.camera);const r=this.host.getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.98};}
  slotPoints(part=null,source=null){
    if(!this.rocket)return [];this.rocket.updateMatrixWorld();const engine=part?.startsWith('engine-'),tank=part&&!engine&&part!=='separator';
    const point=(stage,y,at,gap=false)=>{const p=this.project(this.rocket.localToWorld(new THREE.Vector3(0,y,0))),bodyX=p.x,bodyY=p.y;if(part)p.x=Math.max(28,Math.min(this.host.clientWidth-28,p.x+(engine||gap?-1:1)*58));else p.x+=48;p.y=Math.max(28,Math.min(this.host.clientHeight-96,p.y));return {...p,bodyX,bodyY,localY:y,stage,at,gap,compatible:!part||source?.stage===stage||P.canFit(this.data.craft,stage,part)};};
    if(part==='separator')return this.rocket.userData.slots.map((middle,i)=>point(i,source&&i===1?this.rocket.userData.separatorY:this.data.craft.stages.length===1?-.5:middle,undefined));
    const points=this.rocket.userData.slots.map((middle,i)=>{const r=this.rocket.userData.ranges[i],at=tank?r.joins.length-1:undefined,y=!part?middle:engine?r.base+.85:at?r.joins[at]:r.base+r.engine+2.05;return point(i,y,at);});
    if(tank)for(const [i,r]of this.rocket.userData.ranges.entries())r.joins.slice(0,-1).forEach((y,at)=>points.push(point(i,y,at,true)));return points;
  }
  gripRect(){
    if(!this.rocket?.userData.parts.length)return null;this.rocket.updateMatrixWorld();const box=this.rocket.userData.partBounds.clone().applyMatrix4(this.rocket.matrixWorld);
    const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(this.project(new THREE.Vector3(x,y,z)));
    const left=Math.min(...points.map(p=>p.x))-5,right=Math.max(...points.map(p=>p.x))+5,top=Math.min(...points.map(p=>p.y))-5,bottom=Math.max(...points.map(p=>p.y))+5,width=Math.max(44,right-left),height=Math.max(44,bottom-top);return {left:(left+right-width)/2,top:(top+bottom-height)/2,width,height};
  }
  pickPart(x,y,touch=false){
    if(!this.data?.workshop)return null;const rect=this.host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),this.camera);
    for(const hit of ray.intersectObjects(this.rocket.userData.parts,true)){let node=hit.object;while(node&&!node.userData.part)node=node.parent;if(node?.userData.part)return {...node.userData.part};}
    if(touch){let best=null,distance=24;for(const p of this.partPoints()){const d=Math.hypot(p.x-x,p.y-y);if(d<distance){distance=d;best={stage:p.stage,part:p.part,ordinal:p.ordinal,index:p.index};}}return best;}return null;
  }
  partPoints(){return this.rocket?.userData.parts.map(part=>({...part.userData.part,...this.project(part.userData.pickY===undefined?new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()):this.rocket.localToWorld(new THREE.Vector3(0,part.userData.pickY,0)))}))||[];}
  dragPart(part,x,y,snap,source,craft){
    const key=craft?JSON.stringify(craft):null;
    if(key!==this.assemblyPreviewKey){if(this.assemblyPreview){this.scene.remove(this.assemblyPreview);dispose(this.assemblyPreview);this.assemblyPreview=null;}this.assemblyPreviewKey=key;if(craft){this.assemblyPreview=buildRocket(craft,false);this.scene.add(this.assemblyPreview);}}
    if(this.assemblyPreview){this.assemblyPreview.visible=true;if(this.dragGhost)this.dragGhost.visible=false;this.draw();return;}
    if(!part){if(this.dragGhost)this.dragGhost.visible=false;for(const p of this.rocket?.userData.parts||[])p.visible=true;this.draw();return;}
    if(this.ghostPart!==part){if(this.dragGhost){this.scene.remove(this.dragGhost);dispose(this.dragGhost);}const c=P.emptyCraft(0);if(part==='separator'){c.stages=[P.emptyStage(),{engine:0,small:1,large:0}];c.separator=true;}else if(part.startsWith('engine-'))c.stages[0].engine=Number(part.slice(-1));else c.stages[0][part]=1;const temporary=buildRocket(c,false),piece=temporary.userData.parts.find(p=>p.userData.part.part===part),center=new THREE.Box3().setFromObject(piece).getCenter(new THREE.Vector3());piece.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.65;}});temporary.remove(piece);dispose(temporary);piece.position.sub(center);this.dragGhost=new THREE.Group();this.dragGhost.add(piece);this.scene.add(this.dragGhost);this.ghostPart=part;}
    for(const p of this.rocket.userData.parts)p.visible=!(source&&p.userData.part.stage===source.stage&&p.userData.part.part===source.part&&p.userData.part.ordinal===source.ordinal);
    this.dragGhost.visible=x>=0&&y>=0&&x<=this.host.clientWidth&&y<=this.host.clientHeight;
    if(snap!==null){const point=this.slotPoints(part,source)[snap];this.dragGhost.position.copy(this.rocket.localToWorld(new THREE.Vector3(0,point.localY,0)));}
    else{const ray=new THREE.Raycaster(),normal=this.camera.getWorldDirection(new THREE.Vector3()),center=new THREE.Vector3(0,this.rocket.userData.height/2,0);ray.setFromCamera(new THREE.Vector2(x/this.host.clientWidth*2-1,1-y/this.host.clientHeight*2),this.camera);ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center),this.dragGhost.position);}
    this.draw();
  }
  nodePoint(angle){if(!this.data?.flight)return null;const o=O.elements(this.data.flight.state);if(!o.bound)return null;const q=O.atAngle(o,angle);return this.project(new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,0));}
  angleAt(x,y){const rect=this.host.getBoundingClientRect(),pointer=new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);const p=new THREE.Vector3(),hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),p);return hit?O.wrap(Math.atan2(p.x,p.y)):null;}
  magnify(canvas,x,y){const source=this.renderer.domElement,rect=this.host.getBoundingClientRect(),ratio=source.width/rect.width,context=canvas.getContext('2d');this.draw();context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(source,(x-45)*ratio,(y-30)*ratio,90*ratio,60*ratio,0,0,canvas.width,canvas.height);context.strokeStyle='#eeaf42';context.lineWidth=3;context.beginPath();context.arc(canvas.width/2,canvas.height/2,12,0,Math.PI*2);context.moveTo(canvas.width/2-18,canvas.height/2);context.lineTo(canvas.width/2+18,canvas.height/2);context.moveTo(canvas.width/2,canvas.height/2-18);context.lineTo(canvas.width/2,canvas.height/2+18);context.stroke();}
  diagnostics(){return {renderCount:this.renderCount,quality:this.quality,textureBytes:textureBudget(),starCount:this.stars.geometry.attributes.position.count,webgl2:this.renderer.capabilities.isWebGL2!==false,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,programs:this.renderer.info.programs.length,earthAngle:this.earth.rotation.y,earthMapWidth:this.earthMap.image.width,earthSegments:this.earth.geometry.parameters.widthSegments,pixelRatio:this.renderer.getPixelRatio(),lost:this.lost,separatedStage:Boolean(this.separation),rcsDirection:this.rocket?.userData.rcs.some(j=>j.visible)?this.rcsDirection:0,skyFraction:this.skyFraction,landscapeVisible:this.landscape.visible,globalTerrain:this.globalTerrain.userData,contactGround:this.contactGround.visible,contact:this.contactGround.userData,impacts:this.impacts.userData,terrainVisible:this.relief.visible,terrain:this.relief.userData,environmentOpacity:this.environmentOpacity,padVisible:this.studio.visible,padPosition:this.studio.position.toArray(),launchArea:this.landscape.userData,parts:this.rocket?.userData.parts.length||0,ghostVisible:Boolean(this.dragGhost?.visible),assemblyPreviewVisible:Boolean(this.assemblyPreview?.visible),assemblyPreviewCraft:this.assemblyPreviewKey?JSON.parse(this.assemblyPreviewKey):null};}
}
