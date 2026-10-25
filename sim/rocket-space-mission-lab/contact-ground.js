import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {terrainLighting} from './terrain.js';
const S=window.RocketSurface,R=6371000;
export function createContactGround(sun,colorAt){
 const group=new THREE.Group(),rings=[0,10,30,100,300,800,2000,5000,12000,24000,48000,96000,120000,160000],segments=64,vertices=rings.length*(segments+1),positions=new Float32Array(vertices*3),colors=new Float32Array(vertices*3),fades=new Float32Array(vertices),indices=[];
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('landFade',new THREE.BufferAttribute(fades,1));geometry.setIndex(indices);
 const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:true});material.onBeforeCompile=shader=>{shader.uniforms.uSun={value:sun};shader.vertexShader='attribute float landFade;varying float vFade;varying vec3 vRadial;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFade=landFade;vRadial=normalize(mat3(modelMatrix)*normalize(position));');shader.fragmentShader='uniform vec3 uSun;varying float vFade;varying vec3 vRadial;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vFade;'+terrainLighting);};const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=-1;mesh.frustumCulled=false;group.add(mesh);
 const center=new THREE.Vector3(),east=new THREE.Vector3(),north=new THREE.Vector3(),n=new THREE.Vector3(),last=new THREE.Vector3(10,0,0),color=new THREE.Color();
 const clipping={uContactCenter:{value:center},uContactRadius:{value:0}};
 group.clipping=clipping;group.update=(flight,enabled)=>{
  group.visible=Boolean(enabled);clipping.uContactRadius.value=enabled?120000/R:0;if(!enabled)return;
  center.set(...S.direction(flight.state,flight.t));if(last.distanceToSquared(center)*R*R<10000)return;last.copy(center);east.set(0,1,0).cross(center);if(east.lengthSq()<.001)east.set(1,0,0);east.normalize();north.crossVectors(center,east).normalize();
  for(let j=0;j<rings.length;j++)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=rings[j],index=j*(segments+1)+i;n.copy(center).addScaledVector(east,Math.cos(a)*r/R).addScaledVector(north,Math.sin(a)*r/R).normalize();const height=S.heightAt(n.x,n.y,n.z),water=S.waterAt(n.x,n.y,n.z);if(water)color.setRGB(.035,.19,.25);else colorAt(n,color);positions.set([n.x*(1+height/R),n.y*(1+height/R),n.z*(1+height/R)],index*3);colors.set([color.r,color.g,color.b],index*3);fades[index]=1-THREE.MathUtils.smoothstep(r,120000,160000);}
  geometry.attributes.position.needsUpdate=geometry.attributes.color.needsUpdate=geometry.attributes.landFade.needsUpdate=true;group.userData.rebuilds++;
 };
 group.userData={triangles:indices.length/3,rebuilds:0};return group;
}
export function clipContact(material,uniforms,local=false){
 const compile=material.onBeforeCompile;material.onBeforeCompile=shader=>{compile(shader);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 vContactDirection;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvContactDirection=normalize(position'+(local?'+vec3(0.0,6371000.0,0.0)':'')+');');shader.fragmentShader='uniform vec3 uContactCenter;uniform float uContactRadius;varying vec3 vContactDirection;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uContactRadius>0.0&&distance(normalize(vContactDirection),uContactCenter)<uContactRadius)discard;');};material.customProgramCacheKey=()=>local?'rocket-contact-local':'rocket-contact-global';
}
