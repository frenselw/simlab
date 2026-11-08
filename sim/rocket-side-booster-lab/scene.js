import {surfaceUniforms,surfaceTextureBytes,orientGroundSphere} from './terrain.js';
import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {material,dispose,fadeEnvironment,buildRocket,createPad,createLaunchEffects,createRelief,createLandscape,createPlanet,createSky,createParachute,createReentryEffects,textureBudget,artRecovery,artTexturesReady,restoreArtTextures} from './scene-art.js';
import {createContactGround,clipContact,siteSurfaceShader,clipPadSurface} from './contact-ground.js';
import {createForest} from './forest.js';
import {createImpactEffects,hullPoints,hullMinimum,hullClearance} from './impact-effects.js';
const P=window.RocketParts,O=window.RocketOrbit,M=window.RocketModel,S=window.RocketSurface,L=window.RocketLighting;
function vectorArrow(color){const group=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.74,8),mat),head=new THREE.Mesh(new THREE.ConeGeometry(.09,.26,10),mat);shaft.position.y=.37;head.position.y=.87;shaft.renderOrder=head.renderOrder=10;group.add(shaft,head);return group;}
export class RocketScene{
  constructor(host,onFault){
    this.host=host;this.onFault=onFault;this.renderCount=0;this.quality=0;this.frameSamples=[];this.sampleAfter=0;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,logarithmicDepthBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<960||matchMedia('(pointer: coarse)').matches?1.5:2));this.configureRenderer();host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.01,50000);this.ambient=new THREE.HemisphereLight('#fafff3','#64818d',1.65);this.sunLight=new THREE.DirectionalLight('#fff5e5',2.4);this.sunLight.position.set(30,40,40);this.fillLight=new THREE.DirectionalLight('#a4cce7',.6);this.fillLight.position.set(-20,10,-30);this.scene.add(this.ambient,this.sunLight,this.fillLight);
    const planet=createPlanet();this.studio=createPad();this.scene.add(this.studio);this.relief=createRelief(planet.sun);this.scene.add(this.relief);this.landscape=createLandscape(this.relief);this.scene.add(this.landscape);this.sky=createSky();this.sky.renderOrder=-10;this.scene.add(this.sky);
    this.earth=planet.earth;this.clouds=planet.clouds;this.halo=planet.halo;this.planetSun=planet.sun;this.planetOpacity=planet.opacity;this.planetSurface=planet.surface;this.earthMap=this.earth.material.uniforms.uMap.value;this.scene.add(this.earth,this.clouds,this.halo);this.oceanDepth=new THREE.Mesh(this.earth.geometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true}));this.oceanDepth.renderOrder=-.5;this.scene.add(this.oceanDepth);this.shadowUniforms={uShadowPlanetCenter:{value:this.earth.position},uShadowPlanetRadius:{value:1},uShadowSun:{value:this.planetSun},uShadowEnabled:{value:0}};this.globalTerrain=planet.globalTerrain;this.globalTerrain.onChange=()=>this.draw();this.scene.add(this.globalTerrain);this.siteSurface={uLaunchCut:{value:0}};this.contactGround=createContactGround(planet.sun,this.globalTerrain.colorAt,this.siteSurface,this.relief,this.globalTerrain);clipPadSurface(this.studio.padDeck.material,this.siteSurface,true);clipPadSurface(this.studio.apron.material,this.siteSurface);this.scene.add(this.contactGround);this.forest=createForest(this.relief,this.globalTerrain,this.contactGround);this.globalTerrain.add(this.forest);const materials=new Set();this.relief.traverse(o=>{if(o.material&&o.geometry?.attributes.landFade)materials.add(o.material);});for(const material of materials)clipContact(material,this.contactGround.clipping,true);clipContact(this.globalTerrain.children[0].material,this.contactGround.clipping);
    Object.assign(this.earth.material.uniforms,this.contactGround.clipping);this.earth.material.fragmentShader=siteSurfaceShader+'uniform vec3 uContactCenter;uniform float uContactRadius;\n'+this.earth.material.fragmentShader.replace('vec2 metres=chart*6371000.0;', 'vec2 metres=chart*6371000.0;if(uCloud<.5&&siteOpening(vec3(chart.x,vSurface.y,chart.y)))discard;if(uCloud<.5&&uContactRadius>0.0&&distance(normalize(vec3(chart.x,vSurface.y,chart.y)),uContactCenter)<uContactRadius)discard;');
    this.launchEffects=createLaunchEffects();this.studio.add(this.launchEffects);this.launchArmAge=0;this.launchStarted=false;this.impacts=createImpactEffects();this.scene.add(this.impacts);this.effectClock=0;
    const coords=[],starColors=[],sizes=[],rng=(()=>{let t=512;return()=>{t=(t*1664525+1013904223)>>>0;return t/4294967296;};})();
    for(let i=0;i<1050;i++){const a=rng()*Math.PI*2,latitude=i%4===0?(rng()-.5)*.26+Math.sin(a)*.35:Math.asin(2*rng()-1),bright=rng();coords.push(70*Math.cos(latitude)*Math.cos(a),70*Math.sin(latitude),70*Math.cos(latitude)*Math.sin(a));const color=new THREE.Color(i%7===0?'#a9d0fa':i%11===0?'#ffe0af':'#e1edf5').multiplyScalar(.35+bright*.65);starColors.push(color.r,color.g,color.b);sizes.push(bright>.97?2.4:bright>.8?1.4:.65+bright*.6);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));geo.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));this.starPixelRatio={value:this.renderer.getPixelRatio()};this.stars=new THREE.Points(geo,new THREE.PointsMaterial({vertexColors:true,size:1,sizeAttenuation:false,transparent:true,depthWrite:false}));this.scene.add(this.stars);
    // Clip stars analytically to the globe, including cameras inside its atmosphere.
    this.starOcclusion={uPlanetCenter:{value:this.earth.position},uPlanetRadius:{value:0}};this.stars.material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.starOcclusion,{uPixelRatio:this.starPixelRatio});shader.vertexShader='attribute float aSize;uniform float uPixelRatio;varying vec3 vStarWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;','gl_PointSize = aSize * uPixelRatio;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStarWorld=(modelMatrix*vec4(position,1.0)).xyz;');shader.fragmentShader='varying vec3 vStarWorld;uniform vec3 uPlanetCenter;uniform float uPlanetRadius;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= 1.0-smoothstep(.12,.5,length(gl_PointCoord-.5));\n#include <alphatest_fragment>');shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 center=uPlanetCenter-cameraPosition;float along=dot(normalize(vStarWorld-cameraPosition),center);float radius2=uPlanetRadius*uPlanetRadius;if(uPlanetRadius>0.0&&(dot(center,center)<radius2||(along>0.0&&dot(center,center)-along*along<radius2)))discard;');};this.stars.material.customProgramCacheKey=()=> 'rocket-painted-stars';
    this.velocityArrow=vectorArrow('#137b7e');this.thrustArrow=vectorArrow('#9c5e20');this.scene.add(this.velocityArrow,this.thrustArrow);this.lines={};this.data=null;this.cameraViews=new Map();this.view='factory';this.yaw=.55;this.pitch=.18;this.zoom=1;this.lost=false;this.webglLost=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.webglLost=this.lost=true;onFault('lost');});this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.webglLost=false;this.restoreGraphics();});artRecovery.addEventListener('lost',()=>{this.lost=true;onFault('lost');});artRecovery.addEventListener('restored',()=>this.restoreGraphics());
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  configureRenderer(){this.renderer.setClearColor('#dbece2');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;}
  restoreGraphics(){
    if(this.webglLost||!artTexturesReady())return;
    try{restoreArtTextures();this.renderer.resetState();this.configureRenderer();this.lost=false;this.draw();if(!this.lost)this.onFault('restored');}
    catch(_){this.lost=true;this.onFault('restore-failed');}
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.deviceRatio=devicePixelRatio;const ratio=Math.min(this.deviceRatio,(innerWidth<960||matchMedia('(pointer: coarse)').matches?[1.5,1.25,1]:[2,1.5,1.25])[this.quality]);if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);this.starPixelRatio.value=ratio;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.draw();}
  observeFrame(milliseconds,now){
    if(!this.sampleAfter){this.sampleAfter=now+2000;return;}
    if(now<this.sampleAfter||milliseconds<=0||milliseconds>250||this.quality>=2)return;
    this.frameSamples.push(milliseconds);if(this.frameSamples.length<120)return;
    this.frameSamples.sort((a,b)=>a-b);const slow=this.frameSamples[107]>40;this.frameSamples.length=0;
    if(slow){this.quality++;this.sampleAfter=now+5000;this.resize();}
  }
  resetFrameSample(){this.frameSamples.length=0;this.sampleAfter=0;}
  setView(view,reset=false){if(view==='factory'&&reset)this.factoryHeight=13;this.cameraViews.set(this.view,{yaw:this.yaw,pitch:this.pitch,zoom:this.zoom});const saved=!reset&&this.cameraViews.get(view);this.view=view;Object.assign(this,saved||{yaw:view==='plane'?0:view==='orbit'?.7:view==='follow'?-.65:.55,pitch:view==='plane'?0:view==='orbit'?.48:.18,zoom:1});this.draw();}
  setZoom(value){if(Number.isFinite(value)){const next=Math.max(.4,Math.min(2.5,value));if(next!==this.zoom){this.zoom=next;this.cameraDirty=true;}}return this.zoom;}
  rotate(dx,dy,draw=true){this.yaw+=dx*.008;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+dy*.006));this.cameraDirty=true;if(draw)this.draw();}
  clearSeparation(){if(this.separation){this.scene.remove(this.separation.body);dispose(this.separation.body);this.separation=null;}}
  clearBoosterDrop(){if(this.boosterDrop){this.scene.remove(this.boosterDrop.body);dispose(this.boosterDrop.body);this.boosterDrop=null;}}
  setData(data){
    const previous=this.data?.flight,f=data.flight,craft=JSON.stringify(data.craft),key=JSON.stringify([data.craft,f?.separated,f?.capsule?.detached]);
    const other=data.other,otherKey=other?JSON.stringify([other.craft,other.capsule?.detached]):'',oldCapsule=previous?.capsule?.detached?previous:this.data?.other?.capsule?.detached?this.data.other:null,newCapsule=f?.capsule?.detached?f:other?.capsule?.detached?other:null;
    let carriedCanopy=null,carriedLanding=null;
    if((key!==this.craftKey||otherKey!==this.otherKey)&&data.live&&this.data?.live&&oldCapsule&&newCapsule&&newCapsule.t>=oldCapsule.t&&JSON.stringify(oldCapsule.craft)===JSON.stringify(newCapsule.craft)){
      const body=previous?.capsule?.detached?this.rocket:this.otherRocket;carriedLanding=body?.userData.landingMotion||null;carriedCanopy=body?.userData.parachute||null;if(carriedCanopy){carriedCanopy.removeFromParent();delete body.userData.parachute;}
    }
    const chute=f?.capsule?.detached?f.capsule.chute.phase:'stowed',sameFlight=data.live&&this.data?.live&&key===this.craftKey&&f&&f.t>=(this.lastFlightTime||0);
    if(sameFlight&&this.lastChutePhase==='stowed'&&chute!=='stowed')this.chuteFrameAge=0;else if(!sameFlight||chute==='stowed')this.chuteFrameAge=1.2;
    this.lastChutePhase=chute;
    if(!data.live||!this.data?.live||!f||f.t<(this.lastFlightTime||0)||craft!==this.effectCraft||previous?.source!==f.source){this.clearSeparation();}
    if(!data.live||!this.data?.live||!f||f.t<(this.lastFlightTime||0)||craft!==this.effectCraft){this.launchEffects.clear();this.launchStarted=Boolean(f&&(f.t>0||f.status!=='pad'));this.launchArmAge=this.launchStarted?1.1:0;this.impacts.clear();this.impacted=false;this.pendingImpact=false;this.pendingBurnup=false;}
    if(data.live&&this.data?.live&&key===this.craftKey&&f?.status==='impact'&&this.lastFlightStatus==='flying')this.pendingImpact=true;
    if(data.live&&this.data?.live&&key===this.craftKey&&f?.status==='destroyed'&&this.lastFlightStatus==='flying')this.pendingBurnup=true;
    if(f?.capsule?.detached&&!previous?.capsule?.detached)this.clearSeparation();
    if(key!==this.craftKey){
      if(this.rocket){
        if(data.live&&this.data?.live&&f?.separated&&previous&&!previous.separated&&craft===this.effectCraft){
          this.clearSeparation();const coast=P.clone(previous);coast.controls.lit=false;coast.state[3]-=1.5*Math.cos(f.attitude);coast.state[4]-=1.5*Math.sin(f.attitude);
          this.separation={body:this.rocket,coast,mass:P.dry(previous.craft.stages[0])+previous.fuel[0]+60,start:f.t,visualAge:0,attitude:f.attitude,join:this.rocket.userData.ranges[1].base,height:this.rocket.userData.height};
          for(const child of this.rocket.children)child.visible=Boolean(child.userData.part&&child.userData.part.part!=='boosters'&&(child.userData.part.stage===0||child.userData.part.part==='separator'));
          this.rocket.hullPoints=null;
        }else{this.scene.remove(this.rocket);dispose(this.rocket);}
      }
      this.canopy=null;this.rocket=buildRocket(data.craft,Boolean(f?.separated),Boolean(f?.capsule?.detached));this.scene.add(this.rocket);this.craftKey=key;
    }
    if(this.boosterDrop&&(!data.live||!f||f.t<this.boosterDrop.start||craft!==this.effectCraft))this.clearBoosterDrop();
    if(data.live&&this.data?.live&&f?.boosters?.status==='jettisoned'&&['burning','spent'].includes(this.lastBoosterStatus)&&this.rocket){
      this.clearBoosterDrop();const body=new THREE.Group(),pieces=[];
      for(const [i,mount]of P.boosterMounts(f.craft.boosters).entries()){
        const piece=this.rocket.userData.boosters.clone(true);for(const child of [...piece.children])if(child.userData.booster!==i)piece.remove(child);
        const center=new THREE.Box3().setFromObject(piece).getCenter(new THREE.Vector3());
        const flame=this.rocket.userData.boosterFlames[i].clone();piece.add(flame);
        piece.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();}});
        for(const child of piece.children)child.position.sub(center);
        const coast=M.boosterFlight(f,mount,center.toArray());body.add(piece);pieces.push({body:piece,coast,center,mount,side:mount[0],flame,impact:false});
      }
      this.scene.add(body);this.boosterDrop={body,pieces,start:f.t,attitude:f.attitude};
    }
    this.lastBoosterStatus=f?.boosters?.status;


    if(otherKey!==this.otherKey){if(this.otherRocket){this.scene.remove(this.otherRocket);dispose(this.otherRocket);}this.otherRocket=other?buildRocket(other.craft,Boolean(other.separated),Boolean(other.capsule?.detached)):null;if(this.otherRocket)this.scene.add(this.otherRocket);this.otherKey=otherKey;this.lastOtherStatus=other?.status;}
    if(carriedCanopy){const body=f?.capsule?.detached?this.rocket:this.otherRocket;body.add(carriedCanopy);body.userData.parachute=carriedCanopy;if(carriedLanding)body.userData.landingMotion=carriedLanding;}
    this.data=data;this.effectCraft=craft;this.lastFlightStatus=f?.status;this.lastFlightTime=f?.t||0;this.draw();
  }
  drawEffects(f,space,theta){
    if(this.boosterDrop&&f){
      const drop=this.boosterDrop,angle=space?0:theta,units=space?3/P.R:.001,scale=space?this.rocket.scale.y:.001;
      for(const piece of drop.pieces){
        const started=performance.now();while(piece.coast.t<f.t-1e-8&&piece.coast.status==='flying'&&performance.now()-started<4){const t=piece.coast.t;M.stepBooster(piece.coast,Math.min(piece.coast.fuel>0||Math.hypot(...piece.coast.state.slice(0,3))-P.R<120000?.1:2,f.t-t));if(piece.coast.t<=t)break;}
        const dx=piece.coast.state[0]-f.state[0],dy=piece.coast.state[1]-f.state[1],offset=new THREE.Vector3(dy*Math.cos(angle)-dx*Math.sin(angle),dx*Math.cos(angle)+dy*Math.sin(angle),piece.coast.state[2]-f.state[2]);
        piece.body.position.copy(this.rocket.position).addScaledVector(offset,units);piece.body.scale.setScalar(scale);
        const age=piece.coast.t-drop.start,base=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle-drop.attitude),tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(piece.mount[1],0,-piece.mount[0]),M.boosterTilt(age));piece.body.quaternion.copy(base.multiply(tilt));piece.flame.visible=piece.coast.fuel>0&&piece.coast.status==='flying';
        piece.body.visible=piece.coast.status==='flying';
        if(piece.coast.status==='impact'&&!piece.impact){piece.impact=true;this.impacts.emit(piece.coast.state,piece.coast.t,Math.max(.006,scale*6.6));}
      }
    }

    this.drawRcs(this.rocket,f);
    const drop=this.separation;if(!drop||!f)return;
    if(drop.coast.status==='impact'){this.impacts.emit(drop.coast.state,drop.coast.t,Math.max(.015,this.rocket.scale.y*this.rocket.userData.height*.6));this.clearSeparation();return;}
    const angle=space?0:theta,dx=drop.coast.state[0]-f.state[0],dy=drop.coast.state[1]-f.state[1],axis=new THREE.Vector3(Math.sin(drop.attitude-angle),Math.cos(drop.attitude-angle),0),offset=new THREE.Vector3(dy*Math.cos(angle)-dx*Math.sin(angle),dx*Math.cos(angle)+dy*Math.sin(angle),0);
    // Follow-view geometry and separation displacement both use one metre per .001 world units.
    const units=space?3/P.R:.001,scale=space?this.rocket.scale.y:.001;
    drop.body.scale.setScalar(scale);drop.body.position.copy(this.rocket.position).addScaledVector(offset,units).addScaledVector(axis,-drop.join*scale);drop.body.rotation.z=angle-drop.attitude;
    drop.body.updateMatrixWorld(true);
    if(!space&&S.clearance(drop.coast.state,drop.coast.t)<drop.join+drop.height+10){
      const p=drop.body.position,q=drop.coast.state.slice();q[0]=f.state[0]+(p.y*Math.cos(theta)-p.x*Math.sin(theta))*1000;q[1]=f.state[1]+(p.y*Math.sin(theta)+p.x*Math.cos(theta))*1000;
      const slope=RocketRecovery.contactVelocity(q,drop.coast.t).slope,minimum=hullMinimum(drop.body,Math.atan2(q[1],q[0])-drop.attitude-Math.atan(slope));
      if(S.clearance(q,drop.coast.t)/Math.sqrt(1+slope*slope)+minimum<=0){this.impacts.emit(q,drop.coast.t,Math.max(.015,scale*drop.join*.6));this.clearSeparation();}
    }
  }
  line(name,points,color,dashed=false){
    const old=this.lines[name];if(old){this.scene.remove(old);old.geometry.dispose();old.material.dispose();delete this.lines[name];}if(points.length<2)return;
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(q=>new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,q[2]*3/P.R))),mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.035,gapSize:.025,transparent:true,opacity:.9}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}),line=new THREE.Line(geometry,mat);if(dashed)line.computeLineDistances();this.scene.add(line);this.lines[name]=line;
  }
  drawEngine(rocket,f){const flame=rocket.userData.flame,lit=Boolean(f&&M.coreThrust(f)>0);flame.visible=lit;if(!lit)return;
    const capsule=Boolean(f.capsule?.detached),throttle=f.controls.throttle,width=capsule ? .35+.65*throttle : .65+.35*throttle;
    const lengthScale=(capsule ? .2+.8*throttle : .4+.7*throttle)*(this.reducedMotion?.9:.9+(capsule ? .03 : .08)*Math.sin(f.t*(capsule?16:9)));
    if(capsule){const matrix=new THREE.Matrix4(),scale=new THREE.Vector3(width,lengthScale,width);for(const plume of flame.children){const half=plume.geometry.parameters.height*lengthScale/2;flame.userData.ports.forEach(([x,y,z,angle],i)=>{matrix.makeRotationZ(angle).scale(scale).setPosition(x+Math.sin(angle)*half,y-Math.cos(angle)*half,z);plume.setMatrixAt(i,matrix);});plume.instanceMatrix.needsUpdate=true;}flame.userData.width=width;return;}
    flame.scale.y=lengthScale;
    if(flame.userData.width!==width){const matrix=new THREE.Matrix4();for(const plume of flame.children){for(let i=0;i<plume.count;i++){plume.getMatrixAt(i,matrix);matrix.elements[0]=matrix.elements[10]=width;plume.setMatrixAt(i,matrix);}plume.instanceMatrix.needsUpdate=true;}flame.userData.width=width;}
  }
  drawRcs(rocket,f){
    if(!rocket)return;const pose=rocket.userData.rcsPose,dt=f&&pose?f.t-pose.t:0,turn=f&&pose?Math.atan2(Math.sin(f.attitude-pose.attitude),Math.cos(f.attitude-pose.attitude)):0;
    let until=pose?.until||0,direction=pose?.direction||0;
    if(!this.data.live||dt<0)until=0;
    if(dt>0){until=0;
      // Slow local-vertical/orbit tracking must not look like a permanent RCS burn.
      if(this.data.live&&Math.abs(turn)/dt>Math.PI/360){direction=Math.sign(turn);const target=M.targetAttitude(f)-f.attitude,aligned=Math.abs(Math.atan2(Math.sin(target),Math.cos(target)))<1e-5;until=dt>.25&&aligned?f.t:f.t+.08;}
    }
    rocket.userData.rcsPose=f&&this.data.live?{t:f.t,attitude:f.attitude,until,direction}:null;
    if(rocket===this.rocket){this.rcsDirection=direction;this.rcsUntil=until;}
    for(const [i,jets]of rocket.userData.rcs.entries()){jets.visible=Boolean(this.data.live&&f&&(!f.capsule?.detached||f.capsule.chute.phase==='stowed')&&!window.RocketRecovery.terminal(f)&&f.t<until&&direction===[-1,1][i]);for(const plume of jets.children)plume.material.opacity=plume.userData.baseOpacity*(this.reducedMotion?1:.85+.15*Math.sin(f?.t*70||0));}
  }
  drawThermal(rocket,f){
    if(!rocket||!f?.capsule?.detached)return;const shield=rocket.userData.heatShield,e=window.RocketRecovery.reentry(f,M.atmosphere),level=f.status==='flying'&&f.capsule.chute.phase==='stowed'?Math.min(1,e.flux*100):0;
    if(!rocket.userData.reentryEffects){rocket.userData.reentryEffects=createReentryEffects();rocket.add(rocket.userData.reentryEffects);}const effects=rocket.userData.reentryEffects;effects.visible=level>.005;const art=effects.userData;art.wakeFrame.rotation.z=f.attitude-Math.atan2(f.state[4],f.state[3])-Math.PI;art.flow.value.set(-Math.sin(f.attitude)*f.state[3]+Math.cos(f.attitude)*f.state[4],Math.cos(f.attitude)*f.state[3]+Math.sin(f.attitude)*f.state[4],0).normalize();
    art.glow.material.opacity=level*.45*Math.max(0,-art.flow.value.y);art.skinMaterial.opacity=level*.55;art.wake.material.opacity=level*.085;art.trails.material.opacity=level*.3;
    if(shield){const remaining=1-f.capsule.heat;shield.material.color.setRGB(.035+.045*remaining,.025+.025*remaining,.02+.015*remaining);shield.material.emissiveIntensity=level*Math.max(0,Math.cos(e.shieldAngle*Math.PI/180));}
  }
  drawLandingPose(rocket,f,space,primary=false){
    if(!rocket||!f?.capsule?.detached)return;if(f.status!=='landed'){delete rocket.userData.landingMotion;if(rocket.userData.landingRipple)rocket.userData.landingRipple.visible=false;return;}
    let motion=rocket.userData.landingMotion;if(!motion)motion=rocket.userData.landingMotion={age:0,water:S.isWater(f.state,f.t),hit:f.capsule.touchdown||RocketRecovery.contactVelocity(f.state,f.t),lastDraw:0};
    motion.appliedAngle=0;if(space)return;
    const pose=RocketRecovery.landingPose({...f,capsule:{touchdown:motion.hit}},motion.age,motion.water,this.reducedMotion),slope=motion.hit.slope||0,theta=Math.atan2(f.state[1],f.state[0]),frame=Math.atan2(this.data.flight.state[1],this.data.flight.state[0]),a=frame-theta+Math.atan(slope),normal=new THREE.Vector3(-Math.sin(a),Math.cos(a),0),points=hullPoints(rocket),base=rocket.rotation.z;
    const support=angle=>{const sn=Math.sin(angle),cs=Math.cos(angle);let min=Infinity;for(let i=0;i<points.length;i+=3)min=Math.min(min,normal.x*(cs*points[i]-sn*points[i+1])+normal.y*(sn*points[i]+cs*points[i+1]));return min;},before=support(base);
    if(!primary)rocket.position.addScaledVector(normal,-before*rocket.scale.y);
    const floor=rocket.position.clone().addScaledVector(normal,before*rocket.scale.y);motion.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,floor);motion.pose=pose;motion.appliedAngle=pose.angle;
    rocket.rotation.z=base+pose.angle;rocket.position.addScaledVector(normal,(before-support(rocket.rotation.z)+pose.heave)*rocket.scale.y);rocket.updateMatrixWorld(true);
    let ripple=rocket.userData.landingRipple;if(!ripple){ripple=new THREE.Mesh(new THREE.TorusGeometry(3,.06,8,48),new THREE.MeshBasicMaterial({color:motion.water?'#83bfcc':'#b5a276',transparent:true,opacity:.35,depthWrite:false}));ripple.userData.recoveryDecoration=true;rocket.add(ripple);rocket.userData.landingRipple=ripple;}
    const point=motion.plane.projectPoint(rocket.position,new THREE.Vector3()).addScaledVector(normal,.02*rocket.scale.y);ripple.position.copy(rocket.worldToLocal(point));ripple.quaternion.copy(rocket.quaternion).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal));ripple.material.opacity=.35*Math.exp(-motion.age*.7);ripple.visible=ripple.material.opacity>.015;
  }
  drawParachute(rocket,f,space){
    if(!rocket||!f?.capsule?.detached)return;let canopy=rocket.userData.parachute;if(!canopy){canopy=createParachute();rocket.userData.parachute=canopy;rocket.add(canopy);}if(rocket===this.rocket)this.canopy=canopy;const motion=rocket.userData.landingMotion;canopy.rotation.z=f.status==='landed'&&!space?-(motion?.appliedAngle||0):0;if(f.status==='landed'&&!space&&motion?.plane){rocket.updateMatrixWorld(true);const plane=motion.plane.clone().applyMatrix4(canopy.matrixWorld.clone().invert());canopy.userData.ground={normal:plane.normal,level:-plane.constant+plane.normal.y*canopy.position.y,slope:motion.hit.slope||0};}else if(f.status==='landed'){
      const theta=Math.atan2(f.state[1],f.state[0]),sample=d=>S.radius([f.state[0]-Math.sin(theta)*d,f.state[1]+Math.cos(theta)*d,0,0,0,0],f.t),slope=(sample(10)-sample(-10))/20,a=theta-f.attitude,s=Math.sin(a),c=Math.cos(a),normal=new THREE.Vector3(s-slope*c,c+slope*s,0).normalize(),points=hullPoints(rocket);let level=Infinity;
      for(let i=0;i<points.length;i+=3)level=Math.min(level,normal.x*points[i]+normal.y*points[i+1]+normal.z*points[i+2]);canopy.userData.ground={normal,level,slope};
    }else canopy.userData.ground=null;canopy.update(f,this.reducedMotion,this.data.live);
  }
  drawRecovery(space,f){
    if(!f)return;const other=this.data.other;if(this.data.live&&other?.status==='impact'&&this.lastOtherStatus==='flying')this.impacts.emit(other.state,other.t,.012);
    if(this.otherRocket&&other?.status==='destroyed'&&this.lastOtherStatus==='flying'&&this.data.live)this.impacts.emit(other.state,other.t,this.otherRocket.scale.y*this.otherRocket.userData.height*.7,false,this.otherRocket);
    if(this.otherRocket&&other){const theta=space?0:Math.atan2(f.state[1],f.state[0]),dx=other.state[0]-f.state[0],dy=other.state[1]-f.state[1],unit=space?3/P.R:.001;this.otherRocket.position.copy(f.status==='landed'&&!space?this.flightOrigin:this.rocket.position).add(new THREE.Vector3(-Math.sin(theta)*dx+Math.cos(theta)*dy,Math.cos(theta)*dx+Math.sin(theta)*dy,0).multiplyScalar(unit));this.otherRocket.scale.setScalar(space?.18/this.otherRocket.userData.height:.001);this.otherRocket.rotation.z=theta-other.attitude;this.drawLandingPose(this.otherRocket,other,space);this.otherRocket.visible=!['destroyed','impact'].includes(other.status);this.drawEngine(this.otherRocket,other);this.drawRcs(this.otherRocket,other);}
    this.lastOtherStatus=other?.status;if(f.status==='destroyed')this.rocket.visible=false;
    this.drawThermal(this.rocket,f);this.drawThermal(this.otherRocket,other);this.drawParachute(this.rocket,f,space);this.drawParachute(this.otherRocket,other,space);
    if(f.capsule?.detached){const c=f.capsule.chute;

      this.rocket.visible=!['destroyed','impact'].includes(f.status);
    }
  }
  setPaths(actual,predicted,planned){this.line('actual',actual,'#ee9674');this.line('predicted',predicted,'#b0e3d4',true);this.line('planned',planned,'#f6ca74',true);}
  draw(){
    if(!this.data||!this.rocket||this.lost)return;this.cameraDirty=false;const {flight:f,workshop}=this.data,space=['orbit','plane'].includes(this.view),factory=workshop&&this.view==='factory',height=Math.max(.1,this.rocket.userData.height,f?.capsule?.detached&&this.lastChutePhase!=='stowed'?THREE.MathUtils.lerp(this.rocket.userData.height,16,THREE.MathUtils.smoothstep(this.chuteFrameAge??1.2,0,this.reducedMotion?.25:1.2)):0);
    this.rocket.userData.boosters.visible=Boolean(this.data.craft.boosters&&(!f||P.attached(f)));if(f?.boosters?.status==='jettisoned'&&!this.rocket.boosterBoundsRemoved){this.rocket.updateMatrixWorld(true);const inverse=this.rocket.matrixWorld.clone().invert(),bounds=new THREE.Box3();for(const part of this.rocket.userData.parts)if(part!==this.rocket.userData.boosters)bounds.union(new THREE.Box3().setFromObject(part).applyMatrix4(inverse));this.rocket.userData.partBounds=bounds;this.rocket.hullPoints=null;this.rocket.boosterBoundsRemoved=true;}
    const agl=f?S.clearance(f.state,f.t):0,altitude=f?Math.max(0,O.elements(f.state).height):0,theta=f?Math.atan2(f.state[1],f.state[0]):0;
    if(f&&!space&&altitude<120000)orientGroundSphere(this.earth.userData.nearGeometry,new THREE.Vector3(...S.direction(f.state)));
    this.earth.geometry=f&&!space&&altitude<120000?this.earth.userData.nearGeometry:this.earth.userData.farGeometry;
    const drop=this.separation;if(drop&&f)for(let i=0;i<20000&&drop.coast.t<f.t-1e-8&&!['impact','escaped'].includes(drop.coast.status);i++)M.step(drop.coast,Math.min(O.elements(drop.coast.state).height<120000?.1:2,f.t-drop.coast.t),{mass:drop.mass});
    const separation=this.separation,blend=separation?THREE.MathUtils.smoothstep(separation.visualAge,0,.6):1,displayHeight=separation?THREE.MathUtils.lerp(separation.height,height,blend):height;
    const localOpacity=(1-THREE.MathUtils.smoothstep(altitude,20000,60000))*(1-THREE.MathUtils.smoothstep(Math.abs(theta)*P.R,300000,600000)),local=Boolean(f&&!space&&localOpacity>0);
    this.environmentOpacity=localOpacity;this.planetOpacity.value=space?1:1-localOpacity;
    this.studio.visible=factory||local;this.landscape.visible=local;this.earth.visible=space||Boolean(f&&!factory);this.clouds.visible=this.halo.visible=this.earth.visible&&this.planetOpacity.value>0;Object.values(this.lines).forEach(l=>l.visible=space);
    fadeEnvironment(this.studio,factory||!f?1:localOpacity);fadeEnvironment(this.landscape,localOpacity);
    // The globe is the only ground surface; geography stays fixed while small nearby props fade with altitude.
    this.earth.renderOrder=-2;this.earth.material.depthWrite=false;
    const sky=space?1:THREE.MathUtils.smoothstep(altitude,0,120000);this.skyFraction=sky;
    this.sky.visible=!(factory||!f&&!space);this.sky.material.uniforms.uSpace.value=sky;
    const target=new THREE.Vector3();let distance;
    if(space){this.earth.position.set(0,0,0);this.earth.scale.setScalar(3);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar(3.045);this.rocket.scale.setScalar(.33/displayHeight);this.rocket.position.set(f?f.state[1]*3/P.R:0,f?f.state[0]*3/P.R:3,0);this.rocket.rotation.z=f?-f.attitude:0;target.set(0,.3,0);const h=this.host.clientHeight;distance=Math.max(14.5,3*h/(2*Math.tan(Math.PI/9)*Math.max(20,(h-130)/2)));}
    else if(factory||!f){this.rocket.scale.setScalar(1);this.rocket.position.set(0,0,0);this.rocket.rotation.z=0;this.factoryHeight=this.factoryHeight||13;const framing=height+(P.hasCapsule(this.data.craft)?0:4.4);if(framing>this.factoryHeight)this.factoryHeight=Math.ceil(framing/5)*5;target.set(0,this.factoryHeight*.44,0);distance=Math.max(24,this.factoryHeight*1.85);}
    else{
      // Leave depth clearance for Float32 rounding at planetary scale.
      const r=Math.hypot(f.state[0],f.state[1]);this.earth.position.set(0,-r/1000,0);this.earth.scale.setScalar((P.R-5)/1000);this.halo.position.copy(this.earth.position);this.halo.scale.setScalar((P.R+80000)/1000);
      const size=this.rocket.userData.partBounds.getSize(new THREE.Vector3()),width=Math.max(size.x,size.z,f.capsule?.detached&&this.lastChutePhase!=='stowed'?14:0);
      const framing=.001/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*.36),goal=Math.max(.025,displayHeight*framing,width*framing/this.camera.aspect);
      if(!this.followFrame||this.followFrame.aspect!==this.camera.aspect)this.followFrame={distance:goal,goal,aspect:this.camera.aspect};
      this.followFrame.goal=goal;distance=this.followFrame.distance;
      this.rocket.scale.setScalar(.001);this.rocket.position.set(0,0,0);this.rocket.rotation.z=theta-f.attitude;
      for(const environment of [this.studio,this.landscape,this.relief]){environment.scale.setScalar(.001);environment.position.set(-P.R*Math.sin(theta)/1000,(P.R*Math.cos(theta)-r)/1000,0);environment.rotation.set(0,0,theta,'ZYX');}
    }
    if(space||factory||!f)this.followFrame=null;
    if(f&&!factory&&!space&&agl<500){const blend=1-THREE.MathUtils.smoothstep(agl,200,500),minimum=hullMinimum(this.rocket,this.rocket.rotation.z);let offset=-minimum*this.rocket.scale.y*blend+Math.max(0,-agl)/1000;if(agl<10){const key=[f.t,f.attitude,this.rocket.scale.y].join(',');if(this.rocket.contactKey!==key){this.rocket.contactKey=key;this.rocket.contactOffset=(Math.max(0,agl)-hullClearance(this.rocket,f,this.rocket.rotation.z))/1000;}offset=this.rocket.contactOffset;}this.rocket.position.y+=offset;}
    const landingTarget=f?.status==='landed'&&!space?this.rocket.userData.partBounds.getCenter(new THREE.Vector3()).multiplyScalar(this.rocket.scale.y).applyQuaternion(this.rocket.quaternion).add(this.rocket.position):null;
    this.flightOrigin=this.rocket.position.clone();this.drawLandingPose(this.rocket,f,space,true);
    if(separation)this.rocket.position.addScaledVector(new THREE.Vector3(Math.sin(separation.attitude-(space?0:theta)),Math.cos(separation.attitude-(space?0:theta)),0),separation.join*(1-blend)*this.rocket.scale.y);
    if(f&&!factory&&!space){
      this.rocket.userData.partBounds.getCenter(target);
      // Blend from the complete body centre without following the falling stage.
      if(separation&&blend<1){const initial=separation.body.userData.partBounds.getCenter(new THREE.Vector3());initial.y-=separation.join;target.lerp(initial,1-blend);}
      target.multiplyScalar(this.rocket.scale.y).applyQuaternion(this.rocket.quaternion).add(this.rocket.position);
      if(landingTarget)target.copy(landingTarget);
    }
    if(space&&f&&O.elements(f.state).r>2*P.R)distance=Math.max(distance,(O.elements(f.state).r*3/P.R+1)/Math.tan(Math.PI/9)*1.1);
    this.earth.rotation.y=.7;this.earth.rotation.z=space?0:theta;this.clouds.position.copy(this.earth.position);this.clouds.scale.copy(this.earth.scale).multiplyScalar(1.0018);this.clouds.rotation.copy(this.earth.rotation);this.clouds.rotateY(.025);const sunAngle=space?0:theta;this.planetSun.set(-.5*Math.cos(sunAngle)-.3*Math.sin(sunAngle),-.5*Math.sin(sunAngle)+.3*Math.cos(sunAngle),1).normalize();
    this.lighting=f?L.solar(f.state):{daylight:1,sunlight:1,elevation:1};const daylight=factory||!f?1:this.lighting.daylight;this.sky.material.uniforms.uDaylight.value=daylight;this.shadowUniforms.uShadowEnabled.value=Number(Boolean(f&&!factory));this.shadowUniforms.uShadowPlanetRadius.value=space?3:P.R/1000;L.shade(this.studio,this.shadowUniforms);L.shade(this.landscape,this.shadowUniforms);L.shade(this.relief,this.shadowUniforms);L.shade(this.contactGround,this.shadowUniforms);L.shade(this.rocket,this.shadowUniforms,this.lighting.sunlight);if(this.otherRocket&&this.data.other)L.shade(this.otherRocket,this.shadowUniforms,L.solar(this.data.other.state).sunlight);if(this.separation)L.shade(this.separation.body,this.shadowUniforms);if(this.boosterDrop)L.shade(this.boosterDrop.body,this.shadowUniforms);this.oceanDepth.geometry=this.earth.geometry;this.oceanDepth.position.copy(this.earth.position);this.oceanDepth.rotation.copy(this.earth.rotation);this.oceanDepth.scale.copy(this.earth.scale);this.oceanDepth.visible=this.earth.visible;
    this.sunLight.position.copy(factory||!f?new THREE.Vector3(30,40,40):this.planetSun);this.sunLight.intensity=factory||!f?2.4:2;this.ambient.intensity=factory||!f?1.65:THREE.MathUtils.lerp(.12,1,daylight);this.ambient.position.copy(space?this.rocket.position:new THREE.Vector3(0,1,0));this.fillLight.intensity=factory||!f?.6:0;
    if(factory||!f){this.studio.scale.setScalar(1);this.studio.position.set(0,0,0);this.studio.rotation.z=0;}
    this.globalTerrain.position.copy(this.earth.position);this.globalTerrain.scale.copy(this.earth.scale);this.globalTerrain.rotation.copy(this.earth.rotation);this.globalTerrain.rotateY(-.7);this.globalTerrain.updateMatrixWorld(true);surfaceUniforms.uSurfaceRotation.value.setFromMatrix4(this.globalTerrain.matrixWorld).multiplyScalar(1/this.globalTerrain.scale.x);surfaceUniforms.uSurfaceDetail.value=[1,.55,0][this.quality];
    // Keep model scale and staging independent of the user camera distance.
    distance/=this.zoom;
    const positionCamera=pitch=>this.camera.position.copy(target).add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(this.yaw)*Math.cos(pitch)*distance));positionCamera(this.pitch);
    let cameraClearance=Infinity;
    if(!space){
      const inverse=this.globalTerrain.matrixWorld.clone().invert(),point=new THREE.Vector3(),margin=factory||!f?.2:.002;
      const clearance=()=>{if(factory||!f)return this.camera.position.y+.8;point.copy(this.camera.position).applyMatrix4(inverse);const radius=point.length();point.divideScalar(radius);return (radius*(P.R-5)-P.R-S.heightAt(point.x,point.y,point.z))/1000;};
      cameraClearance=clearance();
      if(cameraClearance<margin){let low=this.pitch,high=Math.PI/2;for(let i=0;i<16;i++){const pitch=(low+high)/2;positionCamera(pitch);if(clearance()<margin)low=pitch;else high=pitch;}positionCamera(high);cameraClearance=clearance();}
    }
    this.camera.near=space?.05:factory||!f?.1:Math.max(.0001,Math.min(distance*.05,cameraClearance*.25));this.camera.far=space?Math.max(150,distance*4):factory||!f?500:Math.max(20000,distance*6);this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);this.sky.scale.setScalar(this.camera.far*.48);
    const pixelsPerUnit=this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*distance),groundDetails=f&&!space&&pixelsPerUnit*.001>.02&&this.quality<2;this.studio.workshopFloor.visible=factory||!f;for(const mesh of this.studio.nearDetails)mesh.visible=factory||!f||groundDetails;for(const mesh of this.landscape.nearDetails)mesh.visible=groundDetails;for(const mesh of this.landscape.landmarks)mesh.visible=Boolean(f&&!space);for(const rocket of [this.rocket,this.assemblyPreview])for(const mesh of rocket?.microDetails||[])mesh.visible=pixelsPerUnit*this.rocket.scale.y>18&&this.quality<2;
    this.studio.workshopFixtures.visible=factory||!f;this.studio.launchFixtures.visible=Boolean(f&&!factory&&groundDetails);this.studio.apron.visible=!factory;this.studio.flameTrench.visible=this.studio.trenchGrates.visible=Boolean(f&&!factory&&groundDetails);if(!f?.separated)this.studio.launchTower.scale.y=Math.max(.3,height/26);this.siteSurface.uLaunchCut.value=Number(Boolean(f&&!factory&&!space&&this.studio.visible&&groundDetails&&localOpacity>=.999));
    const atPad=Boolean(f&&this.data.live&&!factory&&['pad','flying'].includes(f.status)&&Math.abs(theta)*P.R<80&&agl<70),emitting=atPad&&M.thrust(f)>0?Math.min(1.3,M.thrust(f)/600000):0;
    if(emitting&&!this.launchStarted){this.launchStarted=true;this.effectClock=performance.now();}this.launchEffects.emitting=emitting;const arm=Math.min(1,this.launchArmAge/(this.reducedMotion?.25:1.1));this.studio.serviceArms.rotation.y=Math.PI/2*(1-(1-arm)**3);
    this.relief.updateDetail(this.camera,this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),this.quality,Boolean(f&&!factory&&!space));
    this.earth.material.uniforms.uRelief.value=this.relief.visible?this.relief.userData.opacity:0;

    this.globalTerrain.updateDetail(this.camera,this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),this.quality,this.earth.visible,this.relief.visible&&this.relief.userData.opacity>=.999,!space&&(altitude>20000||Math.abs(theta)*P.R>211200));
    this.contactGround.position.copy(this.globalTerrain.position);this.contactGround.rotation.copy(this.globalTerrain.rotation);this.contactGround.scale.copy(this.globalTerrain.scale).multiplyScalar(space?1:P.R/(P.R-5));this.contactGround.update(f,Boolean(f&&!factory&&!space),this.quality);this.contactGround.updateMatrixWorld(true);this.forest.update(f,this.camera,this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),this.quality,Boolean(f&&!factory&&!space));L.shade(this.forest,this.shadowUniforms);
    this.starOcclusion.uPlanetRadius.value=this.earth.visible?this.earth.scale.x:0;this.stars.visible=space||Boolean(f&&(altitude>25000||daylight<.15));this.stars.material.transparent=true;this.stars.material.opacity=space?1:Math.max(THREE.MathUtils.smoothstep(altitude,25000,120000),(1-daylight)*.5);this.stars.material.depthWrite=false;this.stars.position.copy(this.camera.position);this.stars.scale.setScalar(this.camera.far/140);
    this.rocket.visible=(!space||Boolean(f))&&!this.assemblyPreview?.visible;
    if(this.assemblyPreview?.visible){this.assemblyPreview.position.copy(this.rocket.position);this.assemblyPreview.quaternion.copy(this.rocket.quaternion);this.assemblyPreview.scale.copy(this.rocket.scale);}for(const flame of this.rocket.userData.boosterFlames)flame.visible=Boolean(f&&P.burning(f));this.drawEngine(this.rocket,f);
    this.drawEffects(f,space,theta);
    if(this.pendingImpact){this.impacts.emit(f.state,f.t,Math.max(.015,displayHeight*this.rocket.scale.y*.8),true);this.pendingImpact=false;this.impacted=true;this.effectClock=performance.now();}
    if(this.pendingBurnup){this.impacts.emit(f.state,f.t,this.rocket.scale.y*this.rocket.userData.height*.7,true,this.rocket);this.pendingBurnup=false;this.effectClock=performance.now();}
    this.impacts.update(this.contactGround.visible?this.contactGround:this.globalTerrain,this.reducedMotion);if(f?.status==='impact'&&(!this.impacted||this.impacts.mainHidden()||!this.impacts.userData.active))this.rocket.visible=false;
    this.velocityArrow.visible=Boolean(f&&!['impact','landed'].includes(f.status)&&Math.hypot(f.state[3],f.state[4])>.1);this.thrustArrow.visible=Boolean(f&&M.thrust(f)>0);
    if(f){
      const theta=space?0:Math.atan2(f.state[1],f.state[0]),o=O.elements(f.state),center=this.rocket.localToWorld(new THREE.Vector3(0,height*.5,0)),axis=new THREE.Vector3(0,1,0).applyQuaternion(this.rocket.quaternion),forward=this.camera.getWorldDirection(new THREE.Vector3()),depth=center.clone().sub(this.camera.position).dot(forward),pixelWorld=2*depth*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)/this.host.clientHeight,reference=pixelWorld*Math.min(90,this.host.clientHeight*.18,this.host.clientWidth*.25)*(space?.5:1),halfHeight=height*this.rocket.scale.y*.5,radius=1.6*this.rocket.scale.x;
      for(const [arrow,direction,length,sign]of [[this.velocityArrow,new THREE.Vector3(space?f.state[4]:o.tangential,space?f.state[3]:o.radial,0),reference*o.speed/8000,-1],[this.thrustArrow,new THREE.Vector3(Math.sin(f.attitude-theta),Math.cos(f.attitude-theta),0),reference*M.thrust(f)/600000,1]]){
        if(!arrow.visible)continue;direction.normalize();const side=forward.clone().cross(direction);if(side.lengthSq()<1e-8)side.set(1,0,0).applyQuaternion(this.camera.quaternion);side.normalize();const a=side.dot(axis),support=halfHeight*Math.abs(a)+radius*Math.sqrt(Math.max(0,1-a*a)),width=Math.min(pixelWorld*40,length*2);
        // Keep the whole vector outside the rotated rocket's enclosing cylinder.
        arrow.position.copy(center).addScaledVector(side,sign*(support+8*pixelWorld));arrow.scale.set(width,length,width);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
      }
    }
    this.launchEffects.update(this.camera);
    try{this.drawRecovery(space,f);this.renderer.render(this.scene,this.camera);this.renderCount++;}catch(_){this.lost=true;this.onFault('render');}
  }
  animateEffects(now){const elapsed=this.effectClock?Math.max(0,(now-this.effectClock)/1000):0,delta=Math.min(.05,elapsed);this.effectClock=now;if(this.lost||document.hidden||!this.data?.live)return false;if((this.data.running||this.rocket?.userData.landingMotion?.water)&&!this.reducedMotion&&this.quality<2&&this.data.flight&&O.elements(this.data.flight.state).height<20000)surfaceUniforms.uSurfaceTime.value=(surfaceUniforms.uSurfaceTime.value+delta)%1000;let settling=false;const frame=this.followFrame;if(frame&&frame.distance!==frame.goal){const difference=frame.goal-frame.distance;frame.distance=Math.abs(difference)<frame.goal*1e-5?frame.goal:frame.distance+difference*(1-Math.exp(-delta/(this.reducedMotion?.06:.25)));settling=true;}if(this.lastChutePhase!=='stowed'&&this.chuteFrameAge<(this.reducedMotion?.25:1.2)){this.chuteFrameAge=Math.min(this.reducedMotion?.25:1.2,this.chuteFrameAge+delta);settling=true;}for(const rocket of [this.rocket,this.otherRocket]){if(rocket?.userData.parachute?.advance(delta))settling=true;const motion=rocket?.userData.landingMotion;if(motion){const limit=this.reducedMotion?.45:6,before=motion.age;motion.age=motion.water&&!this.reducedMotion?motion.age+delta:Math.min(limit,motion.age+delta);const floating=motion.water&&!this.reducedMotion&&rocket===this.rocket&&this.view==='follow';if(before<limit||floating&&now-motion.lastDraw>=1000/(this.quality?20:30)){settling=true;motion.lastDraw=now;}}}if(settling)this.draw();if(this.data.running===false&&!['impact','destroyed'].includes(this.data.flight?.status)&&!['impact','destroyed'].includes(this.data.other?.status))return Boolean(settling);const transition=this.separation,separating=transition&&this.data.running!==false&&transition.visualAge<.6;if(separating)transition.visualAge=Math.min(.6,transition.visualAge+elapsed);const releasing=this.launchStarted&&this.launchArmAge<(this.reducedMotion?.25:1.1);if(releasing)this.launchArmAge+=delta;const vapour=this.launchEffects.advance(delta);if(this.impacts.advance(delta)||separating||releasing||vapour){this.draw();return true;}return false;}
  project(position){const p=position.clone().project(this.camera);const r=this.host.getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.98};}
  slotPoints(part=null,source=null){
    if(!this.rocket)return [];this.rocket.updateMatrixWorld();const engine=part?.startsWith('engine-'),tank=['small','medium','large'].includes(part);
    const point=(stage,y,at,gap=false)=>{const p=this.project(this.rocket.localToWorld(new THREE.Vector3(0,y,0))),bodyX=p.x,bodyY=p.y;if(part)p.x=Math.max(28,Math.min(this.host.clientWidth-28,p.x+(engine||gap?-1:1)*58));else p.x+=48;p.y=Math.max(28,Math.min(this.host.clientHeight-96,p.y));return {...p,bodyX,bodyY,localY:y,stage,at,gap,compatible:!part||source?.stage===stage||P.canFit(this.data.craft,stage,part)};};
    if(part==='boosters')return [-1,1].map(side=>{const q=this.project(this.rocket.localToWorld(new THREE.Vector3(side*2.4,3.5,0)));return {...q,bodyX:q.x,bodyY:q.y,localY:3.5,stage:0,compatible:source?.part==='boosters'||P.canFit(this.data.craft,0,'boosters')};});
    if(part==='capsule')return [point(this.data.craft.stages.length-1,this.rocket.userData.bodyTop,undefined)];
    if(part==='separator')return [source?point(1,this.rocket.userData.separatorY,undefined):point(0,this.rocket.userData.ranges[0].joins.at(-1)+.325,undefined)];
    const points=this.rocket.userData.slots.map((middle,i)=>{const r=this.rocket.userData.ranges[i],at=tank?r.joins.length-1:undefined,y=!part?middle:engine?r.base+.85:at?r.joins[at]:r.base+r.engine+2.05;return point(i,y,at);});
    if(tank)for(const [i,r]of this.rocket.userData.ranges.entries())r.joins.slice(0,-1).forEach((y,at)=>points.push(point(i,y,at,true)));return points;
  }
  gripRect(){
    if(!this.rocket?.userData.parts.length)return null;this.rocket.updateMatrixWorld();const box=this.rocket.userData.partBounds.clone().applyMatrix4(this.rocket.matrixWorld);
    const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(this.project(new THREE.Vector3(x,y,z)));
    const left=Math.min(...points.map(p=>p.x))-5,right=Math.max(...points.map(p=>p.x))+5,top=Math.min(...points.map(p=>p.y))-5,bottom=Math.max(...points.map(p=>p.y))+5,width=Math.max(44,right-left),height=Math.max(44,bottom-top);return {left:(left+right-width)/2,top:(top+bottom-height)/2,width,height};
  }
  pickPart(x,y,touch=false){
    if(!this.rocket?.visible)return null;const rect=this.host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),this.camera);
    for(const hit of ray.intersectObjects(this.rocket.userData.parts,true)){let node=hit.object;while(node&&!node.userData.part)node=node.parent;if(node?.userData.part)return {...node.userData.part};}
    if(touch){let best=null,distance=24;for(const p of this.partPoints()){const d=Math.hypot(p.x-x,p.y-y);if(d<distance){distance=d;best={stage:p.stage,part:p.part,ordinal:p.ordinal,index:p.index};}}return best;}return null;
  }
  partPoints(){return this.rocket?.userData.parts.map(part=>({...part.userData.part,...this.project(part.userData.pickY===undefined?new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()):this.rocket.localToWorld(new THREE.Vector3(0,part.userData.pickY,0)))}))||[];}
  dragPart(part,x,y,snap,source,craft){
    const key=craft?JSON.stringify(craft):null;
    if(key!==this.assemblyPreviewKey){if(this.assemblyPreview){this.scene.remove(this.assemblyPreview);dispose(this.assemblyPreview);this.assemblyPreview=null;}this.assemblyPreviewKey=key;if(craft){this.assemblyPreview=buildRocket(craft,false);this.scene.add(this.assemblyPreview);}}
    if(this.assemblyPreview){this.assemblyPreview.visible=true;if(this.dragGhost)this.dragGhost.visible=false;this.draw();return;}
    if(!part){if(this.dragGhost)this.dragGhost.visible=false;for(const p of this.rocket?.userData.parts||[])p.visible=true;this.draw();return;}
    if(this.ghostPart!==part){if(this.dragGhost){this.scene.remove(this.dragGhost);dispose(this.dragGhost);}const c=P.emptyCraft(0);if(part==='capsule')delete c.capsule;else if(part==='boosters'){c.stages=[{engine:0,small:1,large:0}];c.boosters=2;}else if(part==='separator'){c.stages=[P.emptyStage(),{engine:0,small:1,large:0}];c.separator=true;}else if(part.startsWith('engine-'))c.stages[0].engine=Number(part.slice(-1));else c.stages[0][part]=1;const temporary=buildRocket(c,false),piece=temporary.userData.parts.find(p=>p.userData.part.part===part),center=new THREE.Box3().setFromObject(piece).getCenter(new THREE.Vector3());piece.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.65;}});temporary.remove(piece);dispose(temporary);piece.position.sub(center);this.dragGhost=new THREE.Group();this.dragGhost.add(piece);this.scene.add(this.dragGhost);this.ghostPart=part;}
    for(const p of this.rocket.userData.parts)p.visible=!(source&&p.userData.part.stage===source.stage&&p.userData.part.part===source.part&&p.userData.part.ordinal===source.ordinal);
    this.dragGhost.visible=x>=0&&y>=0&&x<=this.host.clientWidth&&y<=this.host.clientHeight;
    if(snap!==null){const point=this.slotPoints(part,source)[snap];this.dragGhost.position.copy(this.rocket.localToWorld(new THREE.Vector3(0,point.localY,0)));}
    else{const ray=new THREE.Raycaster(),normal=this.camera.getWorldDirection(new THREE.Vector3()),center=new THREE.Vector3(0,this.rocket.userData.height/2,0);ray.setFromCamera(new THREE.Vector2(x/this.host.clientWidth*2-1,1-y/this.host.clientHeight*2),this.camera);ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center),this.dragGhost.position);}
    this.draw();
  }
  nodePoint(angle){if(!this.data?.flight)return null;const o=O.elements(this.data.flight.state);if(!o.bound)return null;const q=O.atAngle(o,angle);return this.project(new THREE.Vector3(q[1]*3/P.R,q[0]*3/P.R,0));}
  angleAt(x,y){const rect=this.host.getBoundingClientRect(),pointer=new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);const p=new THREE.Vector3(),hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),p);return hit?O.wrap(Math.atan2(p.x,p.y)):null;}
  magnify(canvas,x,y){const source=this.renderer.domElement,rect=this.host.getBoundingClientRect(),ratio=source.width/rect.width,context=canvas.getContext('2d');this.draw();context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(source,(x-45)*ratio,(y-30)*ratio,90*ratio,60*ratio,0,0,canvas.width,canvas.height);context.strokeStyle='#eeaf42';context.lineWidth=3;context.beginPath();context.arc(canvas.width/2,canvas.height/2,12,0,Math.PI*2);context.moveTo(canvas.width/2-18,canvas.height/2);context.lineTo(canvas.width/2+18,canvas.height/2);context.moveTo(canvas.width/2,canvas.height/2-18);context.lineTo(canvas.width/2,canvas.height/2+18);context.stroke();}
  diagnostics(){return {lighting:this.lighting,oceanAnchor:this.earth.userData.nearGeometry.userData.groundAnchor?.toArray(),surface:{time:surfaceUniforms.uSurfaceTime.value,detail:surfaceUniforms.uSurfaceDetail.value,textureBytes:surfaceTextureBytes},renderCount:this.renderCount,quality:this.quality,textureBytes:textureBudget(),starCount:this.stars.geometry.attributes.position.count,webgl2:this.renderer.capabilities.isWebGL2!==false,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,programs:this.renderer.info.programs.length,earthAngle:this.earth.rotation.y,earthMapWidth:this.earthMap.image.width,earthSegments:this.earth.geometry.parameters.widthSegments,pixelRatio:this.renderer.getPixelRatio(),lost:this.lost,separatedStage:Boolean(this.separation),rcsDirection:this.rocket?.userData.rcs.some(j=>j.visible)?this.rcsDirection:0,skyFraction:this.skyFraction,landscapeVisible:this.landscape.visible,globalTerrain:this.globalTerrain.userData,contactGround:this.contactGround.visible,contact:this.contactGround.userData,forest:this.forest.userData,impacts:this.impacts.userData,terrainVisible:this.relief.visible,terrain:this.relief.userData,environmentOpacity:this.environmentOpacity,padVisible:this.studio.visible,padPosition:this.studio.position.toArray(),launchArea:this.landscape.userData,parts:this.rocket?.userData.parts.length||0,ghostVisible:Boolean(this.dragGhost?.visible),assemblyPreviewVisible:Boolean(this.assemblyPreview?.visible),assemblyPreviewCraft:this.assemblyPreviewKey?JSON.parse(this.assemblyPreviewKey):null};}
}
