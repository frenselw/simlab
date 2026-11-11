import * as THREE from './vendor/three-0.185.1/three.module.min.js';

const R=6371000,radial=new THREE.Vector3(),east=new THREE.Vector3(),north=new THREE.Vector3(),sample=new THREE.Vector3();
export function terrainNormal(point,out){
 const S=window.RocketSurface;radial.copy(point).normalize();
 if(S.waterAt(radial.x,radial.y,radial.z))return out.copy(radial);
 east.set(0,1,0).cross(radial);if(east.lengthSq()<.001)east.set(1,0,0).cross(radial);east.normalize();north.crossVectors(radial,east).normalize();
 const extent=radial.y>0?Math.max(Math.abs(radial.x),Math.abs(radial.z))*R:Infinity,step=THREE.MathUtils.lerp(450,16000,THREE.MathUtils.smoothstep(extent,120000,240000));
 const height=(axis,sign)=>{sample.copy(radial).addScaledVector(axis,sign*step/R).normalize();return S.heightAt(sample.x,sample.y,sample.z);};
 const dx=(height(east,1)-height(east,-1))/(2*step),dz=(height(north,1)-height(north,-1))/(2*step);
 return out.copy(radial).addScaledVector(east,-dx).addScaledVector(north,-dz).normalize();
}
export function setTerrainNormals(geometry,origin,landOnly=false){
 const started=performance.now(),p=geometry.attributes.position,n=geometry.attributes.normal||new THREE.BufferAttribute(new Float32Array(p.count*3),3),water=geometry.attributes.surfaceWater||new THREE.BufferAttribute(new Float32Array(p.count),1),point=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).add(origin);terrainNormal(point,normal);n.setXYZ(i,normal.x,normal.y,normal.z);sample.copy(point).normalize();water.setX(i,!landOnly&&window.RocketSurface.waterAt(sample.x,sample.y,sample.z)?1:0);}geometry.setAttribute('normal',n);geometry.setAttribute('surfaceWater',water);n.needsUpdate=water.needsUpdate=true;return performance.now()-started;
}
export const terrainSlopeDetail={value:1};
// One periodic texture supplies both water normals and quiet land variation without another render pass.
const surfacePixels=new Uint8Array(128*128*4),waves=[[3,1,.55],[1,-4,.3],[7,3,.17],[-5,8,.1],[11,-7,.06]];
let landSeed=9127;
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
 const u=x/128*Math.PI*2,v=y/128*Math.PI*2;let dx=0,dy=0;
 for(const [a,b,w]of waves){const c=Math.cos(a*u+b*v);dx+=a*w*c;dy+=b*w*c;}
 landSeed=(Math.imul(landSeed,1664525)+1013904223)>>>0;
 const i=(y*128+x)*4;surfacePixels[i]=Math.round(127.5+dx*17);surfacePixels[i+1]=Math.round(127.5+dy*17);surfacePixels[i+2]=Math.round(127.5+35*Math.sin(u+2*v)+22*Math.cos(3*u-v)+12*Math.sin(5*u+3*v));surfacePixels[i+3]=landSeed>>>24;
}
const surfaceTexture=new THREE.DataTexture(surfacePixels,128,128);surfaceTexture.wrapS=surfaceTexture.wrapT=THREE.RepeatWrapping;surfaceTexture.magFilter=THREE.LinearFilter;surfaceTexture.minFilter=THREE.LinearMipmapLinearFilter;surfaceTexture.generateMipmaps=true;surfaceTexture.needsUpdate=true;
export const surfaceTextureBytes=128*128*4*4/3;
export const regionalSurfaceTexture={value:null};
export const worldSurfaceTexture={value:null};
export function createWorldSurfaceTexture(){
 const grid=window.RocketSurface.surfaceGrid(),width=(grid.width-1)/4,height=(grid.height+3)/4,pixels=new Uint8Array(width*height*2);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const h=grid.data[(grid.height-1-y*4)*grid.width+x*4]&32767,i=(y*width+x)*2;pixels[i]=h>>>8;pixels[i+1]=h&255;}
 // Coarse orbital fallback leaves memory for six view-streamed kilometre-scale normal tiles.
 const texture=new THREE.DataTexture(pixels,width,height,THREE.RGFormat);texture.wrapS=THREE.RepeatWrapping;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;worldSurfaceTexture.value=texture;return texture;
}
export function orientGroundSphere(geometry,direction){
 const data=geometry.userData;if(data.groundAnchor&&data.groundAnchor.distanceTo(direction)*R<5000)return false;
 data.groundBase ||= geometry.attributes.position.array.slice();data.groundAnchor=direction.clone();
 const target=direction.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-.7),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),target),p=new THREE.Vector3(),positions=geometry.attributes.position,normals=geometry.attributes.normal;
 for(let i=0;i<positions.count;i++){p.fromArray(data.groundBase,i*3).applyQuaternion(rotation);positions.setXYZ(i,p.x,p.y,p.z);normals.setXYZ(i,p.x,p.y,p.z);}positions.needsUpdate=normals.needsUpdate=true;geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1);return true;
}
export const surfaceUniforms={uWorldSurface:worldSurfaceTexture,uDetailEnabled:{value:0},uDetailAtlas:{value:null},uDetailLookup:{value:null},uRegionalSurface:regionalSurfaceTexture,uSurfaceMap:{value:surfaceTexture},uSurfaceTime:{value:0},uSurfaceDetail:{value:1},uSurfaceRotation:{value:new THREE.Matrix3()},uSurfaceStrength:{value:1},uOrbitalMap:{value:null},uOrbitalBlend:{value:0}};
export const groundLight=`
uniform float uSlopeDetail,uSurfaceTime,uSurfaceDetail,uSurfaceStrength;
uniform sampler2D uSurfaceMap,uRegionalSurface,uWorldSurface,uDetailAtlas,uDetailLookup;uniform float uDetailEnabled;uniform mat3 uSurfaceRotation;
vec3 geographicDirection(vec3 p){
 float lat=.605629,lon=-2.101376;
 vec3 up=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon)),east=vec3(-sin(lon),0.0,cos(lon)),north=vec3(-sin(lat)*cos(lon),cos(lat),-sin(lat)*sin(lon));
 return east*p.x+up*p.y+north*p.z;
}
vec2 geographicUv(vec3 geo){return vec2(atan(geo.z,geo.x)/6.283185307+.5,asin(clamp(geo.y,-1.0,1.0))/3.141592654+.5);}
float regionalHeight(vec2 uv){return dot(texture2D(uRegionalSurface,(uv*2048.0+.5)/2049.0).rg,vec2(65280.0,255.0))*.1;}
float worldHeight(vec2 uv){uv.x=fract(uv.x);uv.y=clamp(uv.y,0.0,1.0);return dot(texture2D(uWorldSurface,(uv*vec2(2048.0,1024.0)+.5)/vec2(2048.0,1025.0)).rg,vec2(65280.0,255.0));}
vec4 detailedNormal(vec2 uv){
 if(uDetailEnabled<.5)return vec4(0.0);uv.x=fract(uv.x);uv.y=clamp(uv.y,0.0,.9999999);vec2 cell=floor(uv*vec2(36.0,18.0));vec4 entry=texture2D(uDetailLookup,(cell+.5)/vec2(36.0,18.0));float slot=floor(entry.r*255.0+.5)-1.0;if(slot<0.0)return vec4(0.0);
 vec2 local=uv*vec2(36.0,18.0)-cell,atlas=(vec2(mod(slot,3.0),floor(slot/3.0))*1027.0+1.5+local*1024.0)/vec2(3081.0,2054.0);return vec4(normalize((texture2D(uDetailAtlas,atlas).rgb*255.0-128.0)/127.0),entry.g);
}
vec3 terrainIrradiance(vec3 normal,vec3 radial,vec3 sun){
 normal=normalize(mix(radial,normal,uSlopeDetail));
 float day=smoothstep(-.12,.25,dot(radial,sun));
 float sky=.5+.5*max(0.0,dot(normal,radial));
 vec3 ambient=mix(vec3(.0015,.0025,.005),vec3(.22,.28,.34),day)*(.7+.3*sky);
 return ambient+vec3(1.0,.95,.83)*(.92*max(0.0,dot(normal,sun)))*smoothstep(-.03,.02,dot(radial,sun));
}
vec3 landSurfaceTint(vec3 point){
 vec3 metres=normalize(point)*6371000.0;
 vec2 chart=vec2(metres.x+.37*metres.y,metres.z-.63*metres.y);
 vec2 dx=dFdx(chart),dy=dFdy(chart);
 float footprint=max(length(dx),length(dy));
 if(footprint>=220.0||uSurfaceStrength<=0.0)return vec3(1.0);
 float broad=textureGrad(uSurfaceMap,chart/38000.0,dx/38000.0,dy/38000.0).a-.5;
 float tint=broad*.32*(1.0-smoothstep(50.0,220.0,footprint));
 if(footprint<65.0){
  mat2 rotation=mat2(.8,.6,-.6,.8);
  vec2 fineUv=rotation*chart/8900.0+vec2(.018,-.024)*broad;
  float fine=textureGrad(uSurfaceMap,fineUv,rotation*dx/8900.0,rotation*dy/8900.0).a-.5;
  tint+=fine*.20*(1.0-smoothstep(12.0,65.0,footprint));
 }
 return vec3(1.0)+tint*vec3(1.0,.85,.66)*uSurfaceStrength;
}
vec3 shadeSurface(vec3 base,vec3 normal,vec3 radial,vec3 point,vec3 world,vec3 sun,float water){
 vec3 p=normalize(point);vec2 metres=p.xz*6371000.0;
 vec3 landTint=landSurfaceTint(p);
 if(water<.5){
  vec3 geo=normalize(geographicDirection(p));
  vec2 uv=geographicUv(geo),delta=vec2(1.0/2048.0,1.0/1024.0);
  vec3 east=normalize(cross(p,vec3(0.0,sin(.605629),cos(.605629)))+vec3(.0000001,0.0,0.0)),north=cross(east,p);vec4 fine=detailedNormal(uv);
  if(fine.a<1.0){float dx=(worldHeight(uv+vec2(delta.x,0.0))-worldHeight(uv-vec2(delta.x,0.0)))/(39091.966*max(.03,sqrt(max(0.0,1.0-geo.y*geo.y)))),dz=(worldHeight(uv+vec2(0.0,delta.y))-worldHeight(uv-vec2(0.0,delta.y)))/39091.966;normal=normalize(uSurfaceRotation*normalize(p-east*dx-north*dz));}
  if(fine.a>0.0)normal=normalize(mix(normal,uSurfaceRotation*(east*fine.x+north*fine.y+p*fine.z),fine.a));
 }
 if(water<.5&&p.y>.99&&max(abs(metres.x),abs(metres.y))<239000.0){
  vec2 uv=metres/480000.0+.5,stepUv=vec2(1.0/2048.0,0.0);
  float dx=(regionalHeight(uv+stepUv)-regionalHeight(uv-stepUv))/468.75,dz=(regionalHeight(uv+stepUv.yx)-regionalHeight(uv-stepUv.yx))/468.75;
  vec3 gradient=vec3(dx,0.0,dz);vec3 detailed=normalize(p-gradient+p*dot(p,gradient));
  float footprint=239000.0*pow(pow(abs(metres.x)/239000.0,8.0)+pow(abs(metres.y)/239000.0,8.0),.125);float weight=1.0-smoothstep(175000.0,239000.0,footprint);
  normal=normalize(mix(normal,uSurfaceRotation*detailed,weight));
  float trees=texture2D(uRegionalSurface,(uv*2048.0+.5)/2049.0).b,h=regionalHeight(uv),dry=1.0-smoothstep(.15,.45,trees),rock=smoothstep(1100.0,2500.0,h)*.65;
  vec3 biome=mix(vec3(.24,.37,.22),vec3(.075,.19,.12),trees*.6);biome=mix(biome,vec3(.43,.37,.25),dry*.4);biome=mix(biome,vec3(.34,.32,.26),rock);base=mix(base,biome,weight);
 }
 float footprint=max(length(dFdx(metres)),length(dFdy(metres))),detail=(1.0-smoothstep(12.0,110.0,footprint))*uSurfaceDetail;
 vec3 color=base*terrainIrradiance(normal,radial,sun);
 if(uSurfaceStrength<=0.0)return color;
 if(water>.5){
  vec3 n=radial;
  if(detail>.001){
   vec2 a=texture2D(uSurfaceMap,metres/92.0+vec2(.009,-.006)*uSurfaceTime).rg*2.0-1.0;
   vec2 b=mat2(.8,-.6,.6,.8)*(texture2D(uSurfaceMap,mat2(.8,.6,-.6,.8)*(metres/57.0)+vec2(-.005,.008)*uSurfaceTime).rg*2.0-1.0);
   vec3 east=normalize(cross(abs(p.z)<.9?vec3(0.0,0.0,1.0):vec3(0.0,1.0,0.0),p)),north=cross(p,east);vec2 slope=(a+b*.55)*(.13*detail);
   n=normalize(radial+uSurfaceRotation*(east*slope.x+north*slope.y));
  }
  vec3 eye=normalize(cameraPosition-world);float day=smoothstep(-.12,.25,dot(radial,sun)),fresnel=pow(1.0-max(0.0,dot(n,eye)),5.0);
  vec3 waterColor=base*terrainIrradiance(n,radial,sun);
  float skyHeight=smoothstep(-.15,.6,dot(reflect(-eye,n),radial));
  vec3 skyColor=mix(vec3(.08,.15,.22),vec3(.32,.43,.50),skyHeight)*day;
  waterColor=mix(waterColor,skyColor,.06+.16*fresnel);
  float glint=pow(max(0.0,dot(n,normalize(sun+eye))),80.0)*.12*day;
  color=mix(color,waterColor+vec3(1.0,.96,.86)*glint,uSurfaceStrength);
 }else{
  float regional=p.y>0.0?1.0-smoothstep(175000.0,239000.0,length(metres)):0.0;
  float variation=texture2D(uSurfaceMap,metres/2800.0).b-.5;
  vec3 regionalTint=vec3(1.0)+variation*vec3(.18,.035,-.10)*detail*uSurfaceStrength;
  color*=mix(landTint,regionalTint,regional);
 }
 return color;
}
`;
export const terrainLighting='diffuseColor.rgb=shadeSurface(diffuseColor.rgb,normalize(vSlope),normalize(vRadial),vGroundPoint,vGroundWorld,uSun,vSurfaceWater);';
export const orbitalLighting=`
uniform sampler2D uOrbitalMap;
uniform float uOrbitalBlend;
const vec3 oceanAlbedo=vec3(.035,.19,.25);
vec3 shadeOrbitalSurface(vec3 radial,vec3 point,vec3 world,vec3 sun){
 vec2 uv=geographicUv(normalize(geographicDirection(normalize(point))));
 // Wrap longitude derivatives as well as coordinates so the date line selects the same mip level.
 vec2 dx=dFdx(uv),dy=dFdy(uv);dx.x-=round(dx.x);dy.x-=round(dy.x);
 vec4 land=textureGrad(uOrbitalMap,uv,dx,dy);
 float width=max(.008,.5*fwidth(land.a)),cover=smoothstep(.5-width,.5+width,land.a);
 return shadeSurface(mix(oceanAlbedo,land.rgb,cover),radial,radial,point,world,sun,1.0-step(.5,cover));
}
`;

export function createTerrain(buffer,sun){
 const length=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),start=4+Math.ceil(length/4)*4,group=new THREE.Group();
 const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:true});
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,surfaceUniforms);shader.uniforms.uSun={value:sun};shader.uniforms.uSlopeDetail=terrainSlopeDetail;shader.vertexShader='attribute float surfaceWater;varying float vSurfaceWater;varying vec3 vGroundWorld;\nattribute float landFade;varying float vLandFade;varying vec3 vRadial,vSlope,vGroundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLandFade=landFade;vSurfaceWater=surfaceWater;vGroundWorld=(modelMatrix*vec4(position,1.0)).xyz;vGroundPoint=(position+vec3(0.0,6371000.0,0.0))/6371000.0;vSlope=normalize(mat3(modelMatrix)*normal);vRadial=normalize(mat3(modelMatrix)*normalize(position+vec3(0.0,6371000.0,0.0)));');shader.fragmentShader=groundLight+'varying float vSurfaceWater;varying vec3 vGroundWorld;\nuniform vec3 uSun;varying vec3 vRadial,vSlope,vGroundPoint;varying float vLandFade;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vLandFade;'+terrainLighting);};
 // Opaque inner tiles draw before the globe so covered ground is shaded once.
 const solid=material.clone();solid.transparent=false;solid.onBeforeCompile=material.onBeforeCompile;
 const chunks=header.chunks.map(chunk=>{
  const inner=chunk.box.every(v=>Math.abs(v)<header.extent*.88);
  // Fading ground also precedes clouds (-1), which still precede flames and smoke (0).
  const levels=chunk.levels.map(level=>{const attributes=new THREE.InterleavedBuffer(new Float32Array(buffer,start+level.offset,level.vertices*10),10),g=new THREE.BufferGeometry();for(const [name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['landFade',1,9]])g.setAttribute(name,new THREE.InterleavedBufferAttribute(attributes,size,offset));g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,start+level.offset+level.vertices*40,level.indices),1));setTerrainNormals(g,new THREE.Vector3(0,R,0),true);g.computeBoundingSphere();const mesh=new THREE.Mesh(g,inner?solid:material);mesh.renderOrder=inner?-3:-2;mesh.visible=false;group.add(mesh);return mesh;});
  return {levels,level:2,center:new THREE.Vector3((chunk.box[0]+chunk.box[1])/2,0,(chunk.box[2]+chunk.box[3])/2),size:chunk.box[1]-chunk.box[0]};
 });
 const townCandidates=[],transform=new THREE.Object3D();for(const chunk of chunks){const geometry=chunk.levels[0].geometry,positions=geometry.attributes.position;for(let i=0;i<positions.count;i+=7){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),height=y-(Math.sqrt(R**2-x*x-z*z)-R);if(x>10000&&x<80000&&Math.abs(z)<80000&&height>40&&height<300&&geometry.attributes.normal.getY(i)>.995)townCandidates.push([x,z]);}}
 const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b),position=new THREE.Vector3(),normal=new THREE.Vector3(),towardCamera=new THREE.Vector3();

 // A small spatial index also lets the contact skirt meet the actual simplified triangles.
 const bins=new Map(),binSize=8000;
 for(const chunk of chunks)for(let level=0;level<3;level++){const g=chunk.levels[level].geometry,p=g.attributes.position,ix=g.index;
  for(let k=0;k<ix.count;k+=3){const ids=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)],v=ids.map(i=>[p.getX(i),p.getY(i),p.getZ(i)]),xs=v.map(p=>p[0]),zs=v.map(p=>p[2]);for(let z=Math.floor(Math.min(...zs)/binSize);z<=Math.floor(Math.max(...zs)/binSize);z++)for(let x=Math.floor(Math.min(...xs)/binSize);x<=Math.floor(Math.max(...xs)/binSize);x++){const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push({v,chunk,level});}}
 }
 group.meshHeight=(x,z,visible=false)=>{let best=-Infinity;for(const record of bins.get(Math.floor(x/binSize)+':'+Math.floor(z/binSize))||[]){if(record.level!==(visible?record.chunk.level:0))continue;const [a,b,c]=record.v;const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-6)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)best=Math.max(best,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return best;};
 group.groundHeight=(x,z,visible=false)=>{const h=group.meshHeight(x,z,visible);return Number.isFinite(h)?h-(Math.sqrt(R*R-x*x-z*z)-R)+.78:window.RocketSurface.heightAt(x/R,Math.sqrt(1-(x*x+z*z)/(R*R)),z/R);};

 const towns=[],centers=[];for(const [x,z]of townCandidates){if(centers.length===6)break;if(centers.some(p=>Math.hypot(x-p[0],z-p[1])<14000))continue;centers.push([x,z]);for(let i=0;i<6;i++)towns.push([x+(i%3-1)*280,z+(Math.floor(i/3)-.5)*340]);}
 const settlement=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:'#ffffff'}),towns.length);for(let i=0;i<towns.length;i++){const [x,z]=towns[i],h=35+i%4*14;transform.position.set(x,Math.sqrt(6371000**2-x*x-z*z)-6371000+group.groundHeight(x,z)-.78+h/2-1,z);transform.scale.set(100+i%3*24,h,80+i%2*30);transform.rotation.y=i%3*.15;transform.updateMatrix();settlement.setMatrixAt(i,transform.matrix);settlement.setColorAt(i,new THREE.Color(['#b8bba7','#b0c0b9','#bfb39d'][i%3]));}settlement.computeBoundingSphere();group.add(settlement);
 group.updateDetail=(camera,pixels,quality,enabled)=>{
  group.updateMatrixWorld(true);const scale=group.scale.x,distance=camera.position.distanceTo(position.setFromMatrixPosition(group.matrixWorld)),extentPixels=header.extent*2*scale*pixels/Math.max(camera.near,distance),opacity=(1-smooth(90,180,extentPixels));
  normal.set(0,1,0).transformDirection(group.matrixWorld);towardCamera.copy(camera.position).sub(position.setFromMatrixPosition(group.matrixWorld));
  group.visible=Boolean(enabled&&extentPixels>90&&normal.dot(towardCamera)>-header.extent*.04*scale);material.opacity=1-opacity;material.depthWrite=material.opacity>.98;solid.opacity=material.opacity;const transparent=solid.opacity<1;if(solid.transparent!==transparent){solid.transparent=transparent;solid.needsUpdate=true;}
  for(const chunk of chunks){position.copy(chunk.center).applyMatrix4(group.matrixWorld);const distance=Math.max(camera.near,camera.position.distanceTo(position)),screen=chunk.size*scale*pixels/distance,old=chunk.level,threshold=old===0?135:180;
   chunk.level=quality>=2?2:screen>threshold?0:screen>(old===1?55:75)?1:2;if(quality===1)chunk.level=Math.max(1,chunk.level);
   for(let i=0;i<3;i++)chunk.levels[i].visible=i===chunk.level;
  }
 settlement.visible=Boolean(quality<2&&extentPixels>1800);
  group.userData.levels=chunks.map(c=>c.level);group.userData.opacity=material.opacity;
 };
 group.userData={chunks:chunks.length,extent:header.extent,canopies:0,settlements:centers.length,levels:chunks.map(c=>c.level)};return group;
}
