import * as THREE from './vendor/three-0.185.1/three.module.min.js';
const P=window.RocketParts,cache=new Map();
const compact=innerWidth<960,loader=new THREE.TextureLoader();
async function artTexture(name){const texture=await loader.loadAsync(new URL('./assets/'+name,import.meta.url).href);texture.colorSpace=THREE.SRGBColorSpace;cache.set(name,texture);return texture;}
const [dayMap,regionMap,weatherTexture,starMap,geography]=await Promise.all([
 artTexture(compact?'earth-2k.webp':'earth-4k.webp'),artTexture('launch-region.webp'),artTexture('clouds.webp'),artTexture('starfield.webp'),
 fetch(new URL('./assets/geography.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Geography unavailable');return r.json();})
]);
for(const texture of [dayMap,weatherTexture,starMap])texture.wrapS=THREE.RepeatWrapping;
export function textureBudget(){return [...cache.values()].reduce((bytes,t)=>bytes+t.image.width*t.image.height*4*(t.generateMipmaps?4/3:1),0);}

export const EARTH_DAY=86164.2;
export function material(color,extra={}){const {roughness=.65,metalness=.12,...options}=extra;return new THREE.MeshPhongMaterial({color,shininess:Math.max(2,(1-roughness)*60),specular:new THREE.Color('#ffffff').multiplyScalar(.06+metalness*.25),...options});}
export function dispose(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
export function fadeEnvironment(group,opacity){
 if(group.artOpacity===opacity)return;group.artOpacity=opacity;
 group.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){const base=m.userData.environmentBase??={opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite},transparent=base.transparent||opacity<1;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}m.opacity=base.opacity*opacity;m.depthWrite=base.depthWrite&&opacity===1;}});
}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function canvasMap(key,width,height,paint){if(cache.has(key))return cache.get(key);const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height,random(731+key.length*97));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=['metal','small','large','payload','separator'].includes(key)?2:1;cache.set(key,t);return t;}
function surface(key){return canvasMap(key,compact?256:512,compact?256:512,(x,w,h,rng)=>{
 x.scale(w/512,h/512);w=h=512;
 const metal=key==='metal',ground=['concrete','grass','road'].includes(key);x.fillStyle=metal?'#84939c':key==='grass'?'#d1d5bc':key==='road'?'#45525b':key==='concrete'?'#c2c7c5':'#e9eee9';x.fillRect(0,0,w,h);
 for(let i=0;i<(ground?5500:1800);i++){const shade=Math.floor(110+rng()*100);x.fillStyle=`rgba(${shade},${shade},${shade},${metal?.13:.07})`;x.fillRect(rng()*w,rng()*h,ground?1+rng()*3:w,metal?1:1+rng()*2);}
 if(key==='grass')return;
 if(key==='road'){x.fillStyle='#bac4c4';x.fillRect(20,0,5,h);x.fillRect(w-25,0,5,h);x.fillStyle='#e2d7a0';for(let y=0;y<h;y+=96)x.fillRect(w/2-3,y,6,48);return;}
 if(key==='concrete'){x.strokeStyle='#7f91913b';x.lineWidth=2;for(let a=0;a<=w;a+=128){x.beginPath();x.moveTo(a,0);x.lineTo(a,h);x.moveTo(0,a);x.lineTo(w,a);x.stroke();}return;}
 if(metal){x.strokeStyle='#c8d2d34d';for(let y=0;y<h;y+=8){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}return;}
 const sheen=x.createLinearGradient(0,0,w,0);sheen.addColorStop(0,'#d6e0da80');sheen.addColorStop(.35,'#ffffff70');sheen.addColorStop(.72,'#96b5b426');sheen.addColorStop(1,'#d6e0da80');x.fillStyle=sheen;x.fillRect(0,0,w,h);
 x.strokeStyle='#9daead';x.lineWidth=2;for(let i=0;i<2;i++){const a=i*w/2;x.beginPath();x.moveTo(a,0);x.lineTo(a,h);x.stroke();for(let y=12;y<h;y+=28){x.fillStyle='#798d90';x.beginPath();x.arc(a+5,y,1.7,0,Math.PI*2);x.fill();}}
 for(const y of [18,h-18]){x.fillStyle='#c1cdcd';x.fillRect(0,y-4,w,8);for(let a=10;a<w;a+=18){x.fillStyle='#667a7b';x.fillRect(a,y-1,3,2);}}
 if(key==='separator'){for(let a=10;a<w;a+=16){x.fillStyle='#b0bfbd';x.fillRect(a,45,3,h-90);}return;}
 if(key!=='payload'){x.fillStyle='#38565c';x.font='700 39px sans-serif';x.textAlign='center';for(const a of [128,384])x.fillText('SIMLAB',a,205,190);}
 if(key==='payload'){x.fillStyle='#baa86e';x.fillRect(0,h-80,w,52);x.strokeStyle='#e4d7ab';for(let y=h-78;y<h-28;y+=8){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}}
 });}
function instances(parent,geometry,mat,rows){const mesh=new THREE.InstancedMesh(geometry,mat,rows.length),o=new THREE.Object3D();rows.forEach((r,i)=>{o.position.set(r[0],r[1],r[2]);o.scale.set(r[3],r[4],r[5]);o.rotation.set(r[6]||0,r[7]||0,r[8]||0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);if(r[9])mesh.setColorAt(i,new THREE.Color(r[9]));});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;parent.add(mesh);return mesh;}

const ridges=geography.ridges;
function coast(z){const rows=geography.coastRows;let i=0;while(i<rows.length-2&&rows[i+1].z<z)i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((z-a.z)/(b.z-a.z),0,1);return THREE.MathUtils.lerp(a.x??-120000,b.x??-120000,t);}
export function createSky(){
 return new THREE.Mesh(new THREE.SphereGeometry(1,32,16),new THREE.ShaderMaterial({
  uniforms:{uMap:{value:starMap},uSpace:{value:0}},side:THREE.BackSide,depthWrite:false,depthTest:false,
  vertexShader:`varying vec3 vDirection;varying vec2 vUv;void main(){vDirection=position;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D uMap;uniform float uSpace;varying vec3 vDirection;varying vec2 vUv;void main(){vec3 d=normalize(vDirection);vec2 uv=vUv;vec3 day=mix(vec3(.66,.83,.88),vec3(.19,.48,.68),smoothstep(-.12,.8,d.y));vec3 night=texture2D(uMap,uv).rgb;gl_FragColor=vec4(mix(day,night,uSpace),1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>}`
 }));
}
function planetGeometry(){
 const rings=[0,.01,.1,1,10,100,300,800,2000,5000,12000,32000,60000,120000,240000,480000,960000,1280000].map(r=>r/P.R),edge=rings.at(-1);for(let i=1;i<=64;i++)rings.push(edge+(Math.PI-edge)*i/64);
 const segments=compact?96:128,g=new THREE.SphereGeometry(1,segments,rings.length-1),positions=g.attributes.position,normals=g.attributes.normal,uv=g.attributes.uv;
 // Dense rings near the launch pole keep one curved surface usable from metres to orbit.
 for(let i=0;i<positions.count;i++){const theta=rings[Math.floor(i/(segments+1))],phi=i%(segments+1)/segments*Math.PI*2,x=-Math.cos(phi)*Math.sin(theta),y=Math.cos(theta),z=Math.sin(phi)*Math.sin(theta);positions.setXYZ(i,x,y,z);normals.setXYZ(i,x,y,z);uv.setY(i,1-theta/Math.PI);}return g;
}
const planetVertex=`varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vSurface;void main(){vUv=uv;vSurface=position;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
export function createPlanet(){
 const sun=new THREE.Vector3(-.5,.3,1).normalize(),opacity={value:1},surface={region:{value:regionMap}},shader=(map,cloud)=>new THREE.ShaderMaterial({uniforms:{uMap:{value:map},uSun:{value:sun},uCloud:{value:cloud?1:0},uOpacity:opacity,uRegion:surface.region},vertexShader:planetVertex,fragmentShader:`uniform sampler2D uMap,uRegion;uniform vec3 uSun;uniform float uCloud,uOpacity;varying vec2 vUv;varying vec3 vNormal,vWorld,vSurface;void main(){vec2 chart=mat2(.764842,-.644218,.644218,.764842)*vSurface.xz;vec2 metres=chart*6371000.0;float region=(1.0-smoothstep(75000.0,115000.0,length(metres)))*step(0.0,vSurface.y);vec4 tex;if(uCloud<.5&&region==1.0){tex=texture2D(uRegion,metres/240000.0+.5);}else{vec3 local=vec3(chart.x,vSurface.y,chart.y);float lat=.605629,lon=-2.101376;vec3 up=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon)),east=vec3(-sin(lon),0.0,cos(lon)),north=vec3(-sin(lat)*cos(lon),cos(lat),-sin(lat)*sin(lon)),geo=normalize(east*local.x+up*local.y+north*local.z);vec2 atlas=vec2(atan(geo.z,geo.x)/6.2831853+.5,asin(clamp(geo.y,-1.0,1.0))/3.14159265+.5);tex=texture2D(uMap,atlas);if(uCloud<.5)tex.rgb=mix(tex.rgb,texture2D(uRegion,metres/240000.0+.5).rgb,region);}vec3 n=normalize(vNormal),eye=normalize(cameraPosition-vWorld);float light=smoothstep(-.12,.7,dot(n,uSun));vec3 ground=tex.rgb;vec3 color=ground*mix(vec3(.24,.34,.48),vec3(1.06,1.03,.96),light);if(uCloud>.5)color=tex.rgb*(.52+light*.48);float rim=pow(1.0-max(0.0,dot(n,eye)),4.0);color+=vec3(.025,.12,.24)*rim*light;gl_FragColor=vec4(color,mix(1.0,tex.a*.64*uOpacity,uCloud));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,transparent:cloud,depthWrite:!cloud});
 const earth=new THREE.Mesh(planetGeometry(),shader(dayMap,false)),clouds=new THREE.Mesh(new THREE.SphereGeometry(1,96,48),shader(weatherTexture,true));earth.rotation.z=0;clouds.renderOrder=-1;
 const halo=new THREE.Mesh(new THREE.SphereGeometry(1,64,32),new THREE.ShaderMaterial({uniforms:{uSun:{value:sun},uOpacity:opacity},vertexShader:planetVertex,fragmentShader:`uniform vec3 uSun;uniform float uOpacity;varying vec3 vNormal;varying vec3 vWorld;void main(){vec3 n=normalize(vNormal);float rim=pow(1.0-abs(dot(n,normalize(cameraPosition-vWorld))),2.4);float sun=.25+.75*max(0.0,dot(n,uSun));gl_FragColor=vec4(.16,.52,.92,rim*sun*.36*uOpacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,side:THREE.BackSide,transparent:true,depthWrite:false}));
 earth.rotation.order='ZYX';return {earth,clouds,halo,sun,opacity,surface};
}
export function createPad(){
 const group=new THREE.Group(),add=(g,m,x,y,z)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);group.add(mesh);return mesh;},concrete=new THREE.MeshLambertMaterial({color:'#b8c6c5',map:surface('concrete')}),steel=material('#71848b',{map:surface('metal'),metalness:.7,roughness:.42});
 const floor=add(new THREE.PlaneGeometry(200,200),new THREE.MeshLambertMaterial({color:'#8daba0',map:surface('concrete')}),0,-.8,0);floor.rotation.x=-Math.PI/2;floor.material.map.wrapS=floor.material.map.wrapT=THREE.RepeatWrapping;floor.material.map.repeat.set(8,8);
 const apron=add(new THREE.CylinderGeometry(22,22,.16,64),concrete,0,-.7,0),side=add(new THREE.CylinderGeometry(8,8.3,.7,64,1,true),concrete,0,-.36,0);side.material=concrete;
 const markings=canvasMap('pad',1024,1024,(x,w,h,rng)=>{x.fillStyle='#c2cbca';x.fillRect(0,0,w,h);x.strokeStyle='#8e9e9e';x.lineWidth=2;for(let i=0;i<=w;i+=128){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.moveTo(0,i);x.lineTo(w,i);x.stroke();}for(let i=0;i<1400;i++){x.fillStyle='#263f4212';x.fillRect(rng()*w,rng()*h,1+rng()*5,1+rng()*2);}x.translate(w/2,h/2);for(let i=0;i<72;i++){x.save();x.rotate(i*Math.PI/36);x.fillStyle=i%2?'#b8a46d':'#485963';x.fillRect(-9,-480,18,32);x.restore();}x.strokeStyle='#e4e8de';x.lineWidth=7;for(const r of [160,330]){x.beginPath();x.arc(0,0,r,0,Math.PI*2);x.stroke();}x.fillStyle='#42616a';x.font='700 110px sans-serif';x.textAlign='center';x.fillText('01',0,290);});
 const deck=add(new THREE.RingGeometry(1.7,8,64),material('#ffffff',{map:markings,roughness:.85,side:THREE.DoubleSide}),0,.015,0);deck.rotation.x=-Math.PI/2;
 add(new THREE.CylinderGeometry(1.7,1.7,.7,32,1,true),material('#24353d',{side:THREE.DoubleSide}),0,-.34,0);const throat=add(new THREE.CircleGeometry(1.7,32),material('#18272e'),0,-.73,0);throat.rotation.x=-Math.PI/2;
 const trench=add(new THREE.BoxGeometry(3,.18,14),material('#263940'),0,-.57,-14);instances(group,new THREE.BoxGeometry(1,1,1),steel,Array.from({length:14},(_,i)=>[0,-.38,-8-i,.1,.12,1.1,0,Math.PI/2,0]));
 instances(group,new THREE.BoxGeometry(1,1,1),steel,Array.from({length:4},(_,i)=>{const a=i*Math.PI/2+.5;return [3.1*Math.cos(a),.32,3.1*Math.sin(a),.7,.62,1.3,0,-a,0];}));
 instances(group,new THREE.CylinderGeometry(1,1,1,8),steel,Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return [6.5*Math.cos(a),.11,6.5*Math.sin(a),.09,.13,.09];}));
 const shadow=canvasMap('shadow',128,128,(x)=>{const g=x.createRadialGradient(64,64,8,64,64,60);g.addColorStop(0,'#19303866');g.addColorStop(1,'#19303800');x.fillStyle=g;x.fillRect(0,0,128,128);}),contact=add(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false}),0,.025,0);contact.rotation.x=-Math.PI/2;
 group.workshopFloor=floor;group.nearDetails=group.children.filter(o=>o!==floor&&o!==apron);group.userData={flameTrench:true,anchorCount:4};return group;
}
export function createLandscape(){
 const group=new THREE.Group(),groundY=(x,z)=>Math.sqrt(P.R*P.R-x*x-z*z)-P.R;
 function ribbon(width,color,center,start,length,mat){const v=[],uv=[];for(let i=0;i<96;i++){const edge=(j,s)=>{const z=start+j/96*length,x=center(z)+s*width/2;return [x,groundY(x,z)-.7,z];};for(const [j,s]of [[i,-1],[i+1,-1],[i,1],[i,1],[i+1,-1],[i+1,1]]){v.push(...edge(j,s));uv.push((s+1)/2,j/96*length/80);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();group.add(new THREE.Mesh(geo,mat||material(color,{side:THREE.DoubleSide})));}
 const road=surface('road');road.wrapS=road.wrapT=THREE.RepeatWrapping;ribbon(18,'#ffffff',()=>320,-1800,4200,material('#ffffff',{map:road,roughness:.92}));
 ribbon(112,'#bfc19f',z=>-540+Math.sin(z/4400*Math.PI*3)*90,-2200,4400);ribbon(76,'#448fa7',z=>-540+Math.sin(z/4400*Math.PI*3)*90,-2200,4400,material('#448fa7',{roughness:.3,metalness:.25,side:THREE.DoubleSide}));
 group.landmarks=[instances(group,new THREE.ConeGeometry(1,1,7),new THREE.MeshLambertMaterial({color:'#789273'}),ridges.map(r=>[r.x,groundY(r.x,r.z)+r.h/2-.85,r.z,r.r,r.h,r.r*.75,0,.3,0]))];
 group.nearDetails=[];const trunks=[],cones=[],leaves=[];let treeMin=Infinity,buildingMin=Infinity;for(let i=0;i<256;i++){const a=i*2.399,r=450+i%24*250;let x=Math.cos(a)*r,z=Math.sin(a)*r;if(x<coast(z)+300)x=coast(z)+500;const riverX=-540+Math.sin(z/4400*Math.PI*3)*90;if(Math.abs(z)<=2200&&Math.abs(x-riverX)<90)x=riverX-90;if(Math.abs(x-320)<22)x=344;const y=groundY(x,z),s=.8+i%7*.12;treeMin=Math.min(treeMin,Math.hypot(x,z));trunks.push([x,y+4*s,z,.8*s,8*s,.8*s]);for(let tier=0;tier<2;tier++){const row=[x,y+(9+tier*5)*s,z,(6-tier)*s,(i%2?11:7)*s,(6-tier)*s,0,a,0,i%3?'#4b7963':'#638a6b'];(i%2?cones:leaves).push(row);}}
 group.nearDetails.push(instances(group,new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshLambertMaterial({color:'#756457'}),trunks));group.nearDetails.push(instances(group,new THREE.ConeGeometry(1,1,7),new THREE.MeshLambertMaterial({color:'#ffffff'}),cones));group.nearDetails.push(instances(group,new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#ffffff'}),leaves));
 const wallMap=canvasMap('buildings',256,256,(x,w,h)=>{x.fillStyle='#c2cdcc';x.fillRect(0,0,w,h);x.fillStyle='#5d7880';x.fillRect(20,75,216,180);x.strokeStyle='#8fa6a9';for(let y=80;y<h;y+=12){x.beginPath();x.moveTo(22,y);x.lineTo(234,y);x.stroke();}x.fillStyle='#aec9cb';for(let a=22;a<240;a+=36)x.fillRect(a,28,27,20);});
 const walls=[],roofs=[],windows=[];for(let i=0;i<24;i++){const x=650+i%4*130,z=-650+Math.floor(i/4)*210,h=12+i%4*6,y=groundY(x,z);buildingMin=Math.min(buildingMin,Math.hypot(x,z));walls.push([x,y+h/2,z,60,h,42]);roofs.push([x,y+h+2,z,64,4,46]);for(let j=0;j<4;j++)windows.push([x-22+j*14,y+h*.7,z+21.1,8,3,.1]);}
 group.nearDetails.push(instances(group,new THREE.BoxGeometry(1,1,1),material('#ffffff',{map:wallMap}),walls));group.nearDetails.push(instances(group,new THREE.BoxGeometry(1,1,1),material('#6f858a',{metalness:.4}),roofs));group.nearDetails.push(instances(group,new THREE.BoxGeometry(1,1,1),material('#a2ced2',{emissive:'#3c6265',emissiveIntensity:.18}),windows));
 const storage=[];for(let i=0;i<6;i++){const x=1300+i%3*65,z=850+Math.floor(i/3)*80;storage.push([x,groundY(x,z)+13,z,18,26,18]);}group.nearDetails.push(instances(group,new THREE.CylinderGeometry(1,1,1,20),material('#d2dcdb',{metalness:.45}),storage));
 const clouds=[],cloudCenters=[];for(let i=0;i<18;i++){
  const a=i*2.399,r=i<6?9500+i*1600:30000+(i-6)*7000,cx=Math.cos(a)*r,cz=Math.sin(a)*r,h=4100+i%4*430;cloudCenters.push([cx,cz]);
  for(const [j,dx,dy,dz]of [[0,-1200,0,0],[1,-520,280,-160],[2,150,440,100],[3,830,150,-100],[4,1400,-50,80]]){const scale=.85+i%3*.16;clouds.push([cx+dx*scale,groundY(cx+dx*scale,cz+dz)+h+dy*scale,cz+dz,(720+j%3*150)*scale,(290+j%3*60)*scale,(650+j%2*140)*scale,0,a,0]);}
 }
 const weather=instances(group,new THREE.SphereGeometry(1,8,5),new THREE.MeshLambertMaterial({color:'#f2f3eb'}),clouds);group.landmarks.push(weather);group.weather=weather;
 group.userData={clearRadius:300,treeMin,buildingMin,trees:256,buildings:24,mountains:ridges.length,regionalMapWidth:regionMap.image.width,river:true,coast:true,cloudClearRadius:5000,cloudCenters};return group;
}

export function buildRocket(c,separated){
  const group=new THREE.Group(),white=material('#edf1eb',{roughness:.42}),skin=material('#ffffff',{map:surface('payload'),roughness:.5}),shell=material('#ffffff',{map:surface('separator'),roughness:.55,metalness:.25}),dark=material('#4b535c',{map:surface('metal'),metalness:.78,roughness:.36,side:THREE.DoubleSide}),metal=material('#a2b3b9',{map:surface('metal'),metalness:.7,roughness:.38}),mint=material('#318d84',{metalness:.3}),orange=material('#d59257',{metalness:.3}),slots=[],parts=[],ranges=[];let y=0,partParent=group,separatorY=null;
  const mesh=(geometry,mat,x,yy,z,parent=partParent)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,yy,z);parent.add(m);return m;};
  const microDetails=[],bolts=new THREE.IcosahedronGeometry(1,0),pipe=new THREE.CylinderGeometry(1,1,1,8),band=new THREE.CylinderGeometry(1,1,1,32),tankMats=Object.fromEntries(['small','large'].map(k=>[k,material('#ffffff',{map:surface(k),roughness:.55,metalness:.22})])),batch=(g,m,rows)=>{const mesh=instances(partParent,g,m,rows);if(g===bolts||g.type==='TorusGeometry')microDetails.push(mesh);return mesh;};
  c.stages.forEach((s,i)=>{
    if(separated&&i===0)return;
    const accent=s.engine===0?orange:mint;const startPart=(part,ordinal=0,index=null)=>{partParent=new THREE.Group();partParent.userData.part={stage:i,part,ordinal,index};group.add(partParent);parts.push(partParent);};
    if(i===1&&c.separator&&!separated){startPart('separator');const cover=s.engine===null?.65:s.engine===1?2.32:2.15;separatorY=y+cover/2;mesh(new THREE.CylinderGeometry(1.47,1.47,cover,32),shell,0,separatorY,0);batch(band,orange,[.12,cover-.12].map(dy=>[0,y+dy,0,1.49,.18,1.49]));batch(bolts,metal,Array.from({length:12},(_,j)=>{const a=j*Math.PI/6;return [1.48*Math.sin(a),y+.14,1.48*Math.cos(a),.035,.035,.035];}));y+=.65;}
    const base=y;
    if(s.engine!==null){
      startPart('engine-'+s.engine);if(i===1&&!separated)partParent.userData.pickY=y+(s.engine===1?1.7:1.5);
      const clustered=s.engine===0,centers=clustered?[[-.61,-.61],[-.61,.61],[.61,-.61],[.61,.61]]:[[0,0]],throat=clustered?.25:.3,rim=clustered?.58:1.38,bellHeight=clustered?1.25:1.65,radius=h=>throat+(rim-throat)*Math.pow(Math.max(0,1-h/bellHeight),1.35),profile=Array.from({length:13},(_,j)=>new THREE.Vector2(radius(j*bellHeight/12),j*bellHeight/12));
      batch(new THREE.LatheGeometry(profile,24),dark,centers.map(([x,z])=>[x,y,z,1,1,1]));mesh(new THREE.CylinderGeometry(1.1,1.1,.45,32),metal,0,y+1.55,0);
      const ribs=[];for(const [x,z]of centers)for(let j=0;j<(clustered?5:8);j++){const h=.07+j*(clustered?.23:.2),r=radius(h)+.025;ribs.push([x,y+h,z,r,r,1,Math.PI/2]);}batch(new THREE.TorusGeometry(1,.022,4,20),accent,ribs);
      batch(bolts,metal,Array.from({length:16},(_,j)=>{const a=j*Math.PI/8;return [.97*Math.sin(a),y+1.8,.97*Math.cos(a),.055,.035,.055];}));batch(pipe,metal,[[-.72,y+1.25,.72,.055,.75,.055],[.72,y+1.25,.72,.055,.75,.055]]);batch(new THREE.BoxGeometry(1,1,1),metal,[[-.55,y+1.22,.68,.34,.38,.3],[.55,y+1.22,.68,.34,.38,.3]]);y+=2;
    }
    partParent=group;const tanks=P.tanks(s),joins=[y],ordinals={small:0,large:0};
    tanks.forEach((part,j)=>{const h=part==='large'?4.1:2.4;startPart(part,ordinals[part]++,j);mesh(new THREE.CylinderGeometry(1.4,1.4,h,32),tankMats[part],0,y+h/2,0);batch(band,accent,[.2,h-.2].map(dy=>[0,y+dy,0,1.43,.23,1.43]));batch(pipe,metal,[[-.2,y+h/2,1.41,.04,h*.67,.04],[.2,y+h/2,1.41,.04,h*.67,.04],[0,y+h*.48,1.44,.115,.06,.115,Math.PI/2]]);batch(bolts,metal,Array.from({length:16},(_,j)=>{const a=(j%8)*Math.PI/4;return [1.44*Math.sin(a),y+(j<8?.2:h-.2),1.44*Math.cos(a),.04,.04,.04];}));y+=h;joins.push(y);});
    partParent=group;if(tanks.length===0){mesh(new THREE.CylinderGeometry(1.35,1.35,3,16),material('#a7c0b7',{transparent:true,opacity:.3,wireframe:true}),0,y+1.5,0);y+=3;}
    slots[i]=(base+y)/2;ranges[i]={base,engine:s.engine===null?0:2,large:s.large,small:s.small,joins};
  });
  mesh(new THREE.CylinderGeometry(1.25,1.4,2,32),skin,0,y+1,0);mesh(new THREE.SphereGeometry(1.25,32,20,0,Math.PI*2,0,Math.PI/2),white,0,y+2,0);const faceY=y+1.1;
  batch(new THREE.SphereGeometry(1,12,8),dark,[-1,1].map(side=>[side*.4,faceY,1.24,.16,.16,.16]));batch(new THREE.SphereGeometry(1,8,6),material('#ffffff'),[-1,1].map(side=>[side*.4-.03,faceY+.05,1.37,.07,.07,.07]));
  const smile=new THREE.TorusGeometry(.24,.035,6,14,Math.PI);const mouth=mesh(smile,dark,0,faceY-.25,1.32);mouth.rotation.z=Math.PI;
  mesh(new THREE.CylinderGeometry(.04,.04,1.1,8),metal,0,y+3.6,0);mesh(new THREE.SphereGeometry(.17,10,8),orange,0,y+4.15,0);
  const rcs=[new THREE.Group(),new THREE.Group()],nozzles=[];
  for(const [index,direction]of [-1,1].entries())for(const [level,side]of [[y+.25,-direction],[1.8,direction]]){
    nozzles.push([side*1.53,level,0,.13,.24,.13,0,0,-side*Math.PI/2]);
    for(const [radius,length,opacity]of [[.5,3.2,.45],[.23,2.1,.9]]){
      const plume=mesh(new THREE.ConeGeometry(radius,length,10),new THREE.MeshBasicMaterial({color:radius>.3?'#7bc9ff':'#e1f6ff',transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),side*(1.65+length/2),level,0,rcs[index]);plume.rotation.z=side*Math.PI/2;plume.userData.baseOpacity=opacity;
    }
  }
  batch(new THREE.CylinderGeometry(1,1,1,10),dark,nozzles);for(const jets of rcs){jets.visible=false;group.add(jets);}
  const flame=new THREE.Group(),clustered=c.stages[separated?1:0].engine===0,exits=clustered?[[-.61,-.61],[-.61,.61],[.61,-.61],[.61,.61]]:[[0,0]];flame.position.y=-.04;
  for(const [radius,length,color,opacity]of clustered?[[.43,4.2,'#ffad52',.45],[.27,3.1,'#b4e8ff',.8],[.13,1.8,'#fff8e7',1]]:[[.9,5.4,'#69b9ff',.45],[.52,4,'#b4e8ff',.8],[.25,2.4,'#fff8e7',1]]){
    const plume=instances(flame,new THREE.ConeGeometry(radius,length,20).rotateZ(Math.PI),new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),exits.map(([x,z])=>[x,-length/2,z,1,1,1]));
    // Keep full-width bounds while throttle only narrows the individual plumes.
    plume.computeBoundingSphere();
  }
  flame.visible=false;group.add(flame);group.microDetails=microDetails;group.userData={slots,parts,ranges,separatorY,height:y+4.4,flame,rcs};group.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const part of parts)bounds.union(new THREE.Box3().setFromObject(part));group.userData.partBounds=bounds;return group;
}
