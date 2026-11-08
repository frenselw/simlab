import * as THREE from './vendor/three-0.185.1/three.module.min.js';

const R=6371000,radial=new THREE.Vector3(),east=new THREE.Vector3(),north=new THREE.Vector3(),sample=new THREE.Vector3();
export function terrainNormal(point,out){
 const S=window.RocketSurface;radial.copy(point).normalize();
 if(S.waterAt(radial.x,radial.y,radial.z))return out.copy(radial);
 east.set(0,1,0).cross(radial);if(east.lengthSq()<.001)east.set(1,0,0).cross(radial);east.normalize();north.crossVectors(radial,east).normalize();
 const extent=radial.y>0?Math.max(Math.abs(radial.x),Math.abs(radial.z))*R:Infinity,step=THREE.MathUtils.lerp(450,16000,THREE.MathUtils.smoothstep(extent,120000,240000));
 const height=(axis,sign)=>{sample.copy(radial).addScaledVector(axis,sign*step/R).normalize();return S.heightAt(sample.x,sample.y,sample.z);};
 const dx=(height(east,1)-height(east,-1))/(2*step),dz=(height(north,1)-height(north,-1))/(2*step);
 // Only physical relief slopes are emphasized; mesh curvature and tile borders never enter the lighting normal.
 return out.copy(radial).addScaledVector(east,-2*dx).addScaledVector(north,-2*dz).normalize();
}
export function setTerrainNormals(geometry,origin){
 const started=performance.now(),p=geometry.attributes.position,n=geometry.attributes.normal||new THREE.BufferAttribute(new Float32Array(p.count*3),3),water=geometry.attributes.surfaceWater||new THREE.BufferAttribute(new Float32Array(p.count),1),point=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).add(origin);terrainNormal(point,normal);n.setXYZ(i,normal.x,normal.y,normal.z);sample.copy(point).normalize();water.setX(i,window.RocketSurface.waterAt(sample.x,sample.y,sample.z)?1:0);}geometry.setAttribute('normal',n);geometry.setAttribute('surfaceWater',water);n.needsUpdate=water.needsUpdate=true;return performance.now()-started;
}
export const terrainSlopeDetail={value:1};
// One periodic texture supplies both water normals and quiet land variation without another render pass.
const surfacePixels=new Uint8Array(128*128*4),waves=[[3,1,.55],[1,-4,.3],[7,3,.17],[-5,8,.1],[11,-7,.06]];
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
 const u=x/128*Math.PI*2,v=y/128*Math.PI*2;let dx=0,dy=0;
 for(const [a,b,w]of waves){const c=Math.cos(a*u+b*v);dx+=a*w*c;dy+=b*w*c;}
 const i=(y*128+x)*4;surfacePixels[i]=Math.round(127.5+dx*17);surfacePixels[i+1]=Math.round(127.5+dy*17);surfacePixels[i+2]=Math.round(127.5+35*Math.sin(u+2*v)+22*Math.cos(3*u-v)+12*Math.sin(5*u+3*v));surfacePixels[i+3]=255;
}
const surfaceTexture=new THREE.DataTexture(surfacePixels,128,128);surfaceTexture.wrapS=surfaceTexture.wrapT=THREE.RepeatWrapping;surfaceTexture.magFilter=THREE.LinearFilter;surfaceTexture.minFilter=THREE.LinearMipmapLinearFilter;surfaceTexture.generateMipmaps=true;surfaceTexture.needsUpdate=true;
export const surfaceTextureBytes=128*128*4*4/3;
export const surfaceUniforms={uSurfaceMap:{value:surfaceTexture},uSurfaceTime:{value:0},uSurfaceDetail:{value:1},uSurfaceRotation:{value:new THREE.Matrix3()},uSurfaceStrength:{value:1}};
export const groundLight=`
uniform float uSlopeDetail,uSurfaceTime,uSurfaceDetail,uSurfaceStrength;
uniform sampler2D uSurfaceMap;uniform mat3 uSurfaceRotation;
vec3 terrainIrradiance(vec3 normal,vec3 radial,vec3 sun){
 normal=normalize(mix(radial,normal,uSlopeDetail));
 float day=smoothstep(-.12,.25,dot(radial,sun));
 float sky=.5+.5*max(0.0,dot(normal,radial));
 vec3 ambient=mix(vec3(.035,.045,.07),vec3(.22,.28,.34),day)*(.7+.3*sky);
 return ambient+vec3(1.0,.95,.83)*(.92*max(0.0,dot(normal,sun)));
}
vec3 shadeSurface(vec3 base,vec3 normal,vec3 radial,vec3 point,vec3 world,vec3 sun,float water){
 vec3 p=normalize(point);vec2 metres=p.xz*6371000.0;
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
 }else if(detail>.001){
  float variation=texture2D(uSurfaceMap,metres/2800.0).b-.5;
  vec3 tint=vec3(1.0)+variation*vec3(.18,.035,-.10)*detail*uSurfaceStrength;
  color*=tint;
 }
 return color;
}
`;
export const terrainLighting='diffuseColor.rgb=shadeSurface(diffuseColor.rgb,normalize(vSlope),normalize(vRadial),vGroundPoint,vGroundWorld,uSun,vSurfaceWater);';

export function createTerrain(buffer,sun){
 const length=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),start=4+Math.ceil(length/4)*4,heights=new Float32Array(buffer,start,header.heightSize**2),group=new THREE.Group();
 const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:true});
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,surfaceUniforms);shader.uniforms.uSun={value:sun};shader.uniforms.uSlopeDetail=terrainSlopeDetail;shader.vertexShader='attribute float surfaceWater;varying float vSurfaceWater;varying vec3 vGroundWorld;\nattribute float landFade;varying float vLandFade;varying vec3 vRadial,vSlope,vGroundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLandFade=landFade;vSurfaceWater=surfaceWater;vGroundWorld=(modelMatrix*vec4(position,1.0)).xyz;vGroundPoint=(position+vec3(0.0,6371000.0,0.0))/6371000.0;vSlope=normalize(mat3(modelMatrix)*normal);vRadial=normalize(mat3(modelMatrix)*normalize(position+vec3(0.0,6371000.0,0.0)));');shader.fragmentShader=groundLight+'varying float vSurfaceWater;varying vec3 vGroundWorld;\nuniform vec3 uSun;varying vec3 vRadial,vSlope,vGroundPoint;varying float vLandFade;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vLandFade;'+terrainLighting);};
 // Opaque inner tiles draw before the globe so covered ground is shaded once.
 const solid=material.clone();solid.transparent=false;solid.onBeforeCompile=material.onBeforeCompile;
 const chunks=header.chunks.map(chunk=>{
  const inner=chunk.box.every(v=>Math.abs(v)<header.extent*.88);
  // Fading ground also precedes clouds (-1), which still precede flames and smoke (0).
  const levels=chunk.levels.map(level=>{const attributes=new THREE.InterleavedBuffer(new Float32Array(buffer,start+level.offset,level.vertices*10),10),g=new THREE.BufferGeometry();for(const [name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['landFade',1,9]])g.setAttribute(name,new THREE.InterleavedBufferAttribute(attributes,size,offset));g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,start+level.offset+level.vertices*40,level.indices),1));setTerrainNormals(g,new THREE.Vector3(0,R,0));g.computeBoundingSphere();const mesh=new THREE.Mesh(g,inner?solid:material);mesh.renderOrder=inner?-3:-2;mesh.visible=false;group.add(mesh);return mesh;});
  return {levels,level:2,center:new THREE.Vector3((chunk.box[0]+chunk.box[1])/2,0,(chunk.box[2]+chunk.box[3])/2),size:chunk.box[1]-chunk.box[0]};
 });
 const townCandidates=[],transform=new THREE.Object3D();for(const chunk of chunks){const geometry=chunk.levels[0].geometry,positions=geometry.attributes.position;for(let i=0;i<positions.count;i+=7){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),height=y-(Math.sqrt(R**2-x*x-z*z)-R);if(x>10000&&x<80000&&Math.abs(z)<80000&&height>40&&height<300&&geometry.attributes.normal.getY(i)>.995)townCandidates.push([x,z]);}}
 const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b),position=new THREE.Vector3(),normal=new THREE.Vector3(),towardCamera=new THREE.Vector3();
 group.groundHeight=(x,z)=>{const n=header.heightSize,u=THREE.MathUtils.clamp((x/header.extent+1)*(n-1)/2,0,n-1),v=THREE.MathUtils.clamp((1-z/header.extent)*(n-1)/2,0,n-1),i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j;return heights[j*n+i]*(1-a)*(1-b)+heights[j*n+i+1]*a*(1-b)+heights[(j+1)*n+i]*(1-a)*b+heights[(j+1)*n+i+1]*a*b;};
 const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0)),hits=[];
 const fieldHeight=group.groundHeight;group.groundHeight=(x,z)=>{group.updateMatrixWorld(true);ray.ray.origin.set(x,10000,z).applyMatrix4(group.matrixWorld);ray.ray.direction.set(0,-1,0).transformDirection(group.matrixWorld);hits.length=0;for(const chunk of chunks){const box=chunk.levels[0].geometry.boundingSphere;if(!box||Math.hypot(x-box.center.x,z-box.center.z)>box.radius)continue;chunk.levels[0].raycast(ray,hits);}if(!hits.length)return fieldHeight(x,z);return Math.max(...hits.map(h=>group.worldToLocal(h.point).y))-(Math.sqrt(6371000**2-x*x-z*z)-6371000)+.78;};
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
