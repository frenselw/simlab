import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {terrainLighting,groundLight,setTerrainNormals,terrainSlopeDetail,surfaceUniforms} from './terrain.js';
const S=window.RocketSurface,R=6371000;
export const siteSurfaceShader=`uniform float uLaunchCut;
bool siteOpening(vec3 p){if(uLaunchCut<.5||p.y<.99)return false;vec2 m=p.xz*6371000.0;return dot(m,m)<2.89||(abs(m.x)<1.8&&m.y< -1.5&&m.y> -26.0);}

`;
export function clipPadSurface(material,uniforms,flat=false){
 const compile=material.onBeforeCompile;material.onBeforeCompile=shader=>{compile(shader);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec2 vPadPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPadPoint='+(flat?'vec2(position.x,-position.y)':'position.xz')+';');shader.fragmentShader=siteSurfaceShader+'varying vec2 vPadPoint;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(siteOpening(vec3(vPadPoint.x/6371000.0,1.0,vPadPoint.y/6371000.0)))discard;');};material.customProgramCacheKey=()=>flat?'rocket-pad-deck-cut':'rocket-pad-apron-cut';
}
export function createContactGround(sun,colorAt,site,relief,world){
 const group=new THREE.Group(),side=81,spacing=480000/4096,vertices=side*side,positions=new Float32Array(vertices*3),colors=new Float32Array(vertices*3),indices=[];
 for(let j=0;j<side-1;j++)for(let i=0;i<side-1;i++){const a=j*side+i,b=a+side;indices.push(a,b,b+1,a,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(vertices*3),3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
 const center=new THREE.Vector3(),origin=new THREE.Vector3(),east=new THREE.Vector3(),row=new THREE.Vector3(),n=new THREE.Vector3(),last=new THREE.Vector3(10,0,0),color=new THREE.Color();
 // The contact footprint and the cutout below it share one radius; the surrounding ground stays visible.
 const clipping={uContactCenter:{value:center},uContactRadius:{value:0},...site};
 const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:true});material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,surfaceUniforms,clipping,{uSun:{value:sun},uSlopeDetail:terrainSlopeDetail,uGroundOrigin:{value:origin}});shader.vertexShader='attribute float surfaceWater;varying float vSurfaceWater;varying vec3 vGroundWorld;\nuniform vec3 uGroundOrigin;varying vec3 vRadial,vSlope,vGroundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceWater=surfaceWater;vGroundWorld=(modelMatrix*vec4(position,1.0)).xyz;vGroundPoint=position+uGroundOrigin;vSlope=normalize(mat3(modelMatrix)*normal);vRadial=normalize(mat3(modelMatrix)*normalize(vGroundPoint));');shader.fragmentShader=siteSurfaceShader+groundLight+'varying float vSurfaceWater;varying vec3 vGroundWorld;\nuniform vec3 uSun,uContactCenter;uniform float uContactRadius;varying vec3 vRadial,vSlope,vGroundPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat coverage=1.0-smoothstep(uContactRadius,2.0*uContactRadius,distance(normalize(vGroundPoint),uContactCenter));if(coverage<=0.0||siteOpening(normalize(vGroundPoint)))discard;diffuseColor.a*=coverage;'+terrainLighting);};
 geometry.setIndex(indices);const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=-1;mesh.frustumCulled=false;group.add(mesh);
 const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#9b9a85',flatShading:true,transparent:true}),81),transform=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rocks.frustumCulled=false;group.add(rocks);
 let lastLevels='',lastRadius=-100;
 const basis=[[1,0,0],[0,1,0],[0,0,1]].map(q=>{const [lon,lat]=S.geographic(...q).map(a=>a*Math.PI/180);return new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));}),point=new THREE.Vector3();
 group.clipping=clipping;group.update=(flight,enabled,quality=0)=>{
  const agl=flight?S.clearance(flight.state,flight.t):0,radius=enabled?2000*(1-THREE.MathUtils.smoothstep(agl,600,2400)):0;group.visible=radius>0;clipping.uContactRadius.value=radius/R;group.userData.radius=radius;if(!group.visible)return;
  const detailOpacity=1-THREE.MathUtils.smoothstep(S.clearance(flight.state,flight.t),1200,2000);rocks.visible=quality<2&&detailOpacity>0;rocks.material.opacity=detailOpacity;
  n.set(...S.direction(flight.state,flight.t));const levels=relief.userData.levels.join(',')+'|'+(world?.userData.active.join(',')||'');if(last.distanceToSquared(n)*R*R<10000&&levels===lastLevels&&Math.abs(radius-lastRadius)<20)return;lastLevels=levels;lastRadius=radius;group.userData.detailRadius=radius;last.copy(n);center.copy(n);origin.copy(center);for(const child of group.children)child.position.copy(origin);east.set(0,1,0).cross(center);if(east.lengthSq()<.001)east.set(1,0,0).cross(center);east.normalize();row.crossVectors(east,center).normalize();
  // Relative vertices preserve centimetre detail instead of rounding near the Earth's radius.
  const regional=center.y>.99&&Math.max(Math.abs(center.x),Math.abs(center.z))*R<230000,cxGrid=Math.round(center.x*R/spacing),czGrid=Math.round(center.z*R/spacing);
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
   const index=j*side+i,x=(cxGrid+i-40)*spacing,z=(czGrid+j-40)*spacing;
   if(regional)n.set(x/R,Math.sqrt(1-(x*x+z*z)/(R*R)),z/R);else n.copy(center).addScaledVector(east,(i-40)*spacing/R).addScaledVector(row,(j-40)*spacing/R).normalize();
   let height=S.heightAt(n.x,n.y,n.z);const water=S.waterAt(n.x,n.y,n.z),distance=n.distanceTo(center)*R;
   if(distance>radius*.55){const base=regional?relief.groundHeight(x,z,true):world?.surfaceHeight(n),weight=THREE.MathUtils.smoothstep(distance,radius*.55,radius*.9);if(Number.isFinite(base))height+=(base-height)*weight;}
   if(water)color.setRGB(.035,.19,.25);else color.setRGB(...S.colorAt(n.x,n.y,n.z));positions.set([n.x-origin.x+n.x*height/R,n.y-origin.y+n.y*height/R,n.z-origin.z+n.z*height/R],index*3);colors.set([color.r,color.g,color.b],index*3);
  }

  setTerrainNormals(geometry,origin);geometry.attributes.position.needsUpdate=geometry.attributes.color.needsUpdate=true;
  const [lon,lat]=S.geographic(center.x,center.y,center.z),step=.0015,cx=Math.floor(lon/step),cy=Math.floor(lat/step);rocks.count=0;
  for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++){const seed=THREE.MathUtils.euclideanModulo(Math.sin(x*127.1+y*311.7)*43758.5453,1),a=(x+.2+seed*.6)*step*Math.PI/180,b=THREE.MathUtils.clamp((y+.2+seed*.6)*step,-89.999,89.999)*Math.PI/180;point.set(Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a));n.set(point.dot(basis[0]),point.dot(basis[1]),point.dot(basis[2]));if(S.waterAt(n.x,n.y,n.z)||n.distanceTo(center)*R<35)continue;if(seed<.86)continue;const size=2+seed*4,height=S.heightAt(n.x,n.y,n.z)+size*.3;transform.position.copy(n).multiplyScalar(1+height/R).sub(origin);transform.quaternion.setFromUnitVectors(up,n);transform.scale.set(size/R,size/R,size*.8/R);transform.updateMatrix();rocks.setMatrixAt(rocks.count++,transform.matrix);}
  rocks.instanceMatrix.needsUpdate=true;group.userData.props=rocks.count;group.userData.rebuilds++;
 };
 group.userData={triangles:indices.length/3,rebuilds:0,props:0};return group;
}
export function clipContact(material,uniforms,local=false){
 const compile=material.onBeforeCompile;material.onBeforeCompile=shader=>{compile(shader);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 vContactDirection;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvContactDirection=normalize(position'+(local?'+vec3(0.0,6371000.0,0.0)':'')+');');shader.fragmentShader=siteSurfaceShader+'uniform vec3 uContactCenter;uniform float uContactRadius;varying vec3 vContactDirection;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uContactRadius>0.0&&distance(normalize(vContactDirection),uContactCenter)<uContactRadius)discard;if(siteOpening(normalize(vContactDirection)))discard;');};material.customProgramCacheKey=()=>local?'rocket-contact-local-site':'rocket-contact-global-site';
}
