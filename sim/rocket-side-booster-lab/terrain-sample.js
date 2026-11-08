import * as THREE from './vendor/three-0.185.1/three.module.min.js';
const $=id=>document.getElementById(id),host=$('sampleCanvas'),loading=$('sampleLoading');
function plantGeometry(cluster=false){
 const positions=[],colors=[],parts=[];
 if(cluster){for(let i=0;i<9;i++){const a=i*2.399,r=.12+Math.sqrt(i/9)*.32;parts.push([new THREE.ConeGeometry(.09,.65,5,1,true),Math.cos(a)*r,.36+(i%3)*.08,Math.sin(a)*r,[.10,.22,.105]]);}}
 else parts.push([new THREE.CylinderGeometry(.035,.05,.4,4,1,true),0,.2,0,[.18,.13,.075]],[new THREE.ConeGeometry(.25,.65,5,1,true),0,.55,0,[.095,.22,.10]],[new THREE.ConeGeometry(.19,.5,5,1,true),.015,.78,0,[.12,.26,.12]]);
 for(const [g,x,y,z,c]of parts){const flat=g.index?g.toNonIndexed():g,p=flat.attributes.position;for(let i=0;i<p.count;i++){positions.push(p.getX(i)+x,p.getY(i)+y,p.getZ(i)+z);colors.push(...c);}if(flat!==g)flat.dispose();g.dispose();}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
async function start(){
 const response=await fetch(new URL('./assets/terrain-sample/sample.bin',import.meta.url));if(!response.ok)throw Error('高程檔案未能載入');
 const data=window.TerrainSampleData.decode(await response.arrayBuffer()),scene=new THREE.Scene(),sky=new THREE.Color('#c5d3d2'),renderer=new THREE.WebGLRenderer({antialias:true}),camera=new THREE.PerspectiveCamera(48,1,3,160000);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;host.append(renderer.domElement);scene.background=sky;scene.fog=new THREE.Fog(sky,28000,110000);
 const ambient=new THREE.HemisphereLight('#dfe8df','#8d795b',1.35),sun=new THREE.DirectionalLight('#fff1d6',2.2);sun.position.set(-.7,.85,.45);scene.add(ambient,sun);
 const loader=new THREE.TextureLoader(),[albedo,heightTexture]=await Promise.all(['albedo.webp','heights.png'].map(name=>loader.loadAsync(new URL('./assets/terrain-sample/'+name,import.meta.url).href)));
 heightTexture.generateMipmaps=false;heightTexture.minFilter=heightTexture.magFilter=THREE.LinearFilter;
 const uniforms={uAlbedo:{value:albedo},uHeight:{value:heightTexture},uSun:{value:sun.position.clone().normalize()},uPatchOn:{value:0},uPatchMesh:{value:0},uPatchCenter:{value:new THREE.Vector2()},uMode:{value:0},uFog:{value:0},uSky:{value:sky}};
 const natural=new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 vGroundUv;varying vec3 vGroundWorld;
 void main(){vGroundUv=position.xz/40000.0+.5;vGroundWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform sampler2D uAlbedo,uHeight;uniform vec3 uSun,uSky;uniform float uMode,uFog,uPatchOn,uPatchMesh;uniform vec2 uPatchCenter;varying vec2 vGroundUv;varying vec3 vGroundWorld;
 float groundHeight(vec2 uv){return dot(texture2D(uHeight,(uv*512.0+.5)/513.0).rg,vec2(65280.0,255.0))*.1;}
 void main(){if(any(greaterThan(abs(vGroundWorld.xz),vec2(20000.0))))discard;if(uPatchOn>.5){bool inside=distance(vGroundWorld.xz,uPatchCenter)<(uPatchMesh>.5?3000.0:2800.0);if(uPatchMesh>.5?!inside:inside)discard;}vec2 stepUv=vec2(1.0/512.0,0.0);float dx=(groundHeight(vGroundUv+stepUv)-groundHeight(vGroundUv-stepUv))/156.25,dz=(groundHeight(vGroundUv+stepUv.yx)-groundHeight(vGroundUv-stepUv.yx))/156.25;vec3 n=normalize(vec3(-dx,1.0,-dz));vec3 base=uMode>.5?vec3(.42):texture2D(uAlbedo,vGroundUv).rgb;
 vec3 light=mix(vec3(.25,.26,.23),vec3(.50,.54,.49),max(0.0,n.y))+vec3(1.0,.97,.89)*max(0.0,dot(n,uSun))*.72;
 vec3 color=uMode>1.5?n*.5+.5:base*light;if(uMode<.5&&uFog>.5)color=mix(color,uSky,smoothstep(28000.0,110000.0,distance(cameraPosition,vGroundWorld)));
 gl_FragColor=vec4(color,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}),wire=new THREE.MeshBasicMaterial({color:'#31594e',wireframe:true,fog:false}),terrain=new THREE.Group(),forests=new THREE.Group();scene.add(terrain,forests);
 const meshes=data.levels.map(level=>{const buffer=new THREE.InterleavedBuffer(level.vertices,9),geometry=new THREE.BufferGeometry();for(const [name,offset]of [['position',0],['normal',3],['color',6]])geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(buffer,3,offset));geometry.setIndex(new THREE.BufferAttribute(level.indices,1));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,natural);mesh.visible=false;terrain.add(mesh);return mesh;});
 function woodlandMaterial(near){const material=new THREE.MeshLambertMaterial({vertexColors:true,alphaHash:true});material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vTreeWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`vec4 treePoint=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 treePoint=instanceMatrix*treePoint;
 #endif
 vTreeWorld=(modelMatrix*treePoint).xyz;
 #include <project_vertex>`);shader.fragmentShader='varying vec3 vTreeWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat treeDistance=distance(vTreeWorld.xz,cameraPosition.xz);diffuseColor.a*='+(near?'1.0-smoothstep(650.0,950.0,treeDistance)':'smoothstep(650.0,1100.0,treeDistance)*(1.0-smoothstep(6000.0,9000.0,treeDistance))')+';');};material.customProgramCacheKey=()=>near?'sample-near-woodland':'sample-medium-woodland';return material;}
 const treeGeometry=plantGeometry(),standGeometry=plantGeometry(true),stands=new THREE.InstancedMesh(standGeometry,woodlandMaterial(false),data.header.stands),nearTrees=new THREE.InstancedMesh(treeGeometry,woodlandMaterial(true),1690),matrix=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),n=new THREE.Vector3(),cache=new Map();nearTrees.instanceMatrix.setUsage(THREE.DynamicDrawUsage);nearTrees.count=0;forests.add(stands,nearTrees);
 const patchMaterial=new THREE.ShaderMaterial({polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,uniforms:{...uniforms,uPatchMesh:{value:1}},vertexShader:natural.vertexShader,fragmentShader:natural.fragmentShader}),patchGeometry=new THREE.BufferGeometry(),patchPositions=new Float32Array(81*81*3),patchIndices=[];
 for(let j=0;j<80;j++)for(let i=0;i<80;i++){const a=j*81+i,b=a+1,c=a+81;patchIndices.push(a,c,b,b,c,c+1);}patchGeometry.setAttribute('position',new THREE.BufferAttribute(patchPositions,3).setUsage(THREE.DynamicDrawUsage));patchGeometry.setIndex(patchIndices);const patch=new THREE.Mesh(patchGeometry,patchMaterial);patch.frustumCulled=false;scene.add(patch);let patchKey='';
 function visibleGround(x,z){const original=data.groundAt(x,z),fine=data.gridGroundAt(x,z),r=Math.hypot(x-uniforms.uPatchCenter.value.x,z-uniforms.uPatchCenter.value.y),w=1-THREE.MathUtils.smoothstep(r,2200,2700);return original.map((v,i)=>v+(fine[i]-v)*w);}
 function placeStands(){for(let i=0;i<data.header.stands;i++){const at=i*8,x=data.stands[at],z=data.stands[at+2],[h,sx,sz]=uniforms.uPatchOn.value?visibleGround(x,z):data.groundAt(x,z);matrix.position.set(x,h-1,z);n.set(-sx,1,-sz).normalize();matrix.quaternion.setFromUnitVectors(up,n);matrix.rotateY(data.stands[at+7]*Math.PI*2);matrix.scale.set(data.stands[at+5],data.stands[at+6],data.stands[at+5]);matrix.updateMatrix();stands.setMatrixAt(i,matrix.matrix);}stands.instanceMatrix.needsUpdate=true;stands.computeBoundingSphere();}
 function updatePatch(){
  const enabled=camera.position.y-data.heightAt(camera.position.x,camera.position.z)<1800&&mode!=='wire',was=Boolean(uniforms.uPatchOn.value);uniforms.uPatchOn.value=Number(enabled);patch.visible=enabled;if(!enabled){if(was)placeStands();return;}
  const step=data.header.spacingMetres,x=Math.round((camera.position.x+20000)/(step*4))*step*4-20000,z=Math.round((camera.position.z+20000)/(step*4))*step*4-20000,next=x+':'+z;if(next===patchKey&&was)return;patchKey=next;uniforms.uPatchCenter.value.set(x,z);
  for(let j=0;j<81;j++)for(let i=0;i<81;i++){const px=x+(i-40)*step,pz=z+(j-40)*step,r=Math.hypot(px-x,pz-z),height=r<2200||r>3150?data.heightAt(px,pz):visibleGround(px,pz)[0];patchPositions.set([px,height,pz],(j*81+i)*3);}patchGeometry.attributes.position.needsUpdate=true;placeStands();
 }
 placeStands();
 let view='overview',mode='natural',forestEnabled=true,sunAlternate=false,running=false,lost=false,phase=0,last=0,frame=0,transition=false,yaw=-.7,pitch=.62,distance=54000,key='',clock=0;
 const focus=new THREE.Vector3(0,data.heightAt(0,0),0),aim=focus.clone(),eye=new THREE.Vector3(),desired=new THREE.Vector3(),currentAim=focus.clone();
 const route=new THREE.CatmullRomCurve3([[-14000,0,10500],[-8000,0,6500],[-2000,0,2500],[4500,0,-3500],[12500,0,-9000]].map(p=>new THREE.Vector3(...p))),stats={ready:true,level:0,nearTrees:0,stands:0,cached:0,buildMs:0,renders:0,mode,view};
 function updateForest(){
  forests.visible=forestEnabled&&mode==='natural'&&distance<18000;stats.nearTrees=stats.stands=0;if(!forests.visible)return;const agl=camera.position.y-data.heightAt(camera.position.x,camera.position.z);stands.visible=agl<6000;if(stands.visible)stats.stands=data.header.stands;
  const near=agl<1800,cx=Math.floor(camera.position.x/500),cz=Math.floor(camera.position.z/500),next=cx+':'+cz;
  nearTrees.visible=near;
  if(near&&next!==key){key=next;const started=performance.now(),active=new Set(),visibleRows=[];nearTrees.count=0;
   for(let z=cz-2;z<=cz+2;z++)for(let x=cx-2;x<=cx+2;x++){
    const id=x+':'+z;active.add(id);let item=cache.get(id);if(!item){const rows=data.treesAt(x,z).map(([px,,pz,size,rotation])=>[px,data.gridGroundAt(px,pz)[0]-.15,pz,size,rotation]);item={rows,used:0};cache.set(id,item);}item.used=++clock;
    visibleRows.push(...item.rows);
   }
   visibleRows.sort((a,b)=>(a[0]-camera.position.x)**2+(a[2]-camera.position.z)**2-(b[0]-camera.position.x)**2-(b[2]-camera.position.z)**2);for(const [px,h,pz,size,rotation]of visibleRows.slice(0,1690)){matrix.position.set(px,h,pz);matrix.rotation.set(0,rotation,0);matrix.scale.setScalar(size);matrix.updateMatrix();nearTrees.setMatrixAt(nearTrees.count++,matrix.matrix);}
   while(cache.size>32){const [id]=[...cache].filter(([id])=>!active.has(id)).sort((a,b)=>a[1].used-b[1].used)[0];cache.delete(id);}
   nearTrees.instanceMatrix.needsUpdate=true;nearTrees.computeBoundingSphere();stats.buildMs+=performance.now()-started;
  }
  if(near)stats.nearTrees=nearTrees.count;stats.cached=cache.size;
 }
 function pose(){
  if(view==='flight'){const p=route.getPointAt(phase),ahead=route.getPointAt(Math.min(.999,phase+.045));desired.set(p.x,data.heightAt(p.x,p.z)+300,p.z);aim.set(ahead.x,data.heightAt(ahead.x,ahead.z)+120,ahead.z);}
  else{desired.copy(focus).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance));desired.y=Math.max(desired.y,data.heightAt(desired.x,desired.z)+80);aim.copy(focus);}
 }
 function render(){
  if(lost)return;const level=2;for(let i=0;i<meshes.length;i++){meshes[i].visible=i===level;meshes[i].material=mode==='wire'?wire:natural;}uniforms.uMode.value=mode==='gray'?1:mode==='normal'?2:0;uniforms.uFog.value=view==='overview'||view==='top'?0:1;updatePatch();updateForest();renderer.render(scene,camera);stats.level=level;stats.mode=mode;stats.view=view;stats.renders++;stats.calls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;
 }
 function schedule(){if(!frame&&!document.hidden&&!lost)frame=requestAnimationFrame(tick);}
 function tick(now){frame=0;const dt=last?Math.min(.05,(now-last)/1000):.016;last=now;if(running&&view==='flight'){phase=(phase+dt/90)%.96;const p=route.getPointAt(phase);focus.set(p.x,data.heightAt(p.x,p.z),p.z);}
  pose();if(transition||running){const a=1-Math.exp(-dt*5);camera.position.lerp(desired,a);currentAim.lerp(aim,a);transition=camera.position.distanceTo(desired)>1||currentAim.distanceTo(aim)>1;}else{camera.position.copy(desired);currentAim.copy(aim);}camera.position.y=Math.max(camera.position.y,data.heightAt(camera.position.x,camera.position.z)+80);camera.lookAt(currentAim);render();if(view==='flight')$('sampleAltitude').textContent='離地約 '+Math.round(camera.position.y-data.heightAt(camera.position.x,camera.position.z))+' m・地貌飛行預覽';if(running||transition)schedule();
 }
 function setView(value,immediate=false){
  view=value;running=value==='flight';phase=0;last=0;focus.set(value==='low'?-4500:0,0,value==='low'?2500:0);focus.y=data.heightAt(focus.x,focus.z);yaw=value==='low'?-1.05:-.7;pitch=value==='top'?1.54:value==='low'?.16:.62;distance=value==='top'?Math.max(53000,44000/camera.aspect):value==='low'?2200:value==='flight'?2200:Math.max(54000,36000/camera.aspect);
  transition=!immediate&&!matchMedia('(prefers-reduced-motion: reduce)').matches;pose();if(!transition){camera.position.copy(desired);currentAim.copy(aim);}for(const e of document.querySelectorAll('[data-view]'))e.setAttribute('aria-pressed',String(e.dataset.view===view));$('samplePause').hidden=value!=='flight';$('samplePause').textContent='暫停';$('sampleViewName').textContent={overview:'山勢全景',low:'低空望山谷',top:'俯視山脊與林帶',flight:'沿路飛行'}[view]||'自由觀察';$('sampleAltitude').textContent='聖伊內斯山脈附近・40 × 40 km';schedule();
 }
 function setMode(value){mode=value;for(const e of document.querySelectorAll('[data-mode]'))e.setAttribute('aria-pressed',String(e.dataset.mode===mode));schedule();}
 function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);schedule();}
 function manual(){if(view==='flight'){running=false;view='custom';distance=3300;focus.copy(currentAim);yaw=Math.atan2(camera.position.x-focus.x,camera.position.z-focus.z);pitch=Math.asin((camera.position.y-focus.y)/Math.max(1,camera.position.distanceTo(focus)));$('samplePause').hidden=true;}transition=false;$('sampleViewName').textContent='自由觀察';for(const e of document.querySelectorAll('[data-view]'))e.setAttribute('aria-pressed','false');}
 function zoom(factor){manual();distance=THREE.MathUtils.clamp(distance*factor,350,120000);schedule();}
 const pointers=new Map();let pinch=0;
 host.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();manual();host.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;});
 host.addEventListener('pointermove',e=>{const before=pointers.get(e.pointerId);if(!before)return;const dx=e.clientX-before.x,dy=e.clientY-before.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch&&d)distance=THREE.MathUtils.clamp(distance*pinch/d,350,120000);pinch=d;}else{yaw-=dx*.006;pitch=THREE.MathUtils.clamp(pitch+dy*.004,.06,1.54);}schedule();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(name,e=>{pointers.delete(e.pointerId);pinch=0;});
 host.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});for(const name of ['gesturestart','gesturechange'])host.addEventListener(name,e=>e.preventDefault(),{passive:false});
 host.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)){e.preventDefault();manual();if(e.key==='ArrowLeft')yaw+=.1;if(e.key==='ArrowRight')yaw-=.1;if(e.key==='ArrowUp')pitch=Math.min(1.54,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(.06,pitch-.1);if(e.key==='+'||e.key==='=')zoom(.8);if(e.key==='-')zoom(1.25);if(e.key==='Home')setView('overview');schedule();}});
 for(const e of document.querySelectorAll('[data-view]'))e.addEventListener('click',()=>setView(e.dataset.view));for(const e of document.querySelectorAll('[data-mode]'))e.addEventListener('click',()=>setMode(e.dataset.mode));
 $('sampleForest').addEventListener('click',()=>{forestEnabled=!forestEnabled;$('sampleForest').setAttribute('aria-pressed',String(forestEnabled));$('sampleForest').textContent='樹木：'+(forestEnabled?'開':'關');schedule();});
 $('sampleSun').addEventListener('click',()=>{sunAlternate=!sunAlternate;sun.position.set(sunAlternate?.7:-.7,.85,sunAlternate?-.45:.45);uniforms.uSun.value.copy(sun.position).normalize();$('sampleSun').setAttribute('aria-pressed',String(sunAlternate));$('sampleSun').textContent='光向：'+(sunAlternate?'二':'一');schedule();});
 $('samplePause').addEventListener('click',()=>{running=!running;last=0;$('samplePause').textContent=running?'暫停':'繼續';schedule();});$('sampleZoomIn').addEventListener('click',()=>zoom(.8));$('sampleZoomOut').addEventListener('click',()=>zoom(1.25));
 document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)schedule();});renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;loading.hidden=false;loading.textContent='畫面暫停，正在等待圖像恢復…';});renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;loading.hidden=true;schedule();});
 const observer=new ResizeObserver(resize);observer.observe(host);resize();setView('low',true);loading.hidden=true;
 window.__terrainSample={data,scene,camera,renderer,host,terrain,forests,stats,setView,setMode,render,diagnostics:()=>({...stats,running,phase,forestEnabled,sunAlternate,heightRange:[data.header.minimumMetres,data.header.maximumMetres],sourceBytes:response.headers.get('content-length'),cached:cache.size,distance,pitch,yaw,localDetail:patch.visible,localTriangles:patchGeometry.index.count/3,textureBytes:1024*1024*4*4/3+513*513*4})};
}
start().catch(error=>{loading.hidden=false;loading.textContent='地形預覽未能載入，請重新整理再試。';console.error(error);});
