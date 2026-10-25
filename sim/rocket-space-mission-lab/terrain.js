import * as THREE from './vendor/three-0.185.1/three.module.min.js';

const detailData=new Uint8Array(128*128*4);let detailSeed=9173;
for(let i=0;i<detailData.length;i+=4){detailSeed=(Math.imul(detailSeed,1664525)+1013904223)>>>0;detailData[i]=detailData[i+1]=detailData[i+2]=detailSeed>>>24;detailData[i+3]=255;}
export const terrainDetailTexture=new THREE.DataTexture(detailData,128,128);
terrainDetailTexture.wrapS=terrainDetailTexture.wrapT=THREE.RepeatWrapping;terrainDetailTexture.magFilter=THREE.LinearFilter;terrainDetailTexture.minFilter=THREE.LinearMipmapNearestFilter;terrainDetailTexture.generateMipmaps=true;terrainDetailTexture.anisotropy=1;terrainDetailTexture.needsUpdate=true;
export const terrainLighting=`
vec3 radial=normalize(vRadial);
diffuseColor.rgb*=mix(vec3(.24,.34,.48),vec3(1.06,1.03,.96),smoothstep(-.12,.7,dot(radial,uSun)))*vSlopeLight;
vec2 detail=vec2(dot(vGroundPoint,vec3(.83,.31,.46)),dot(vGroundPoint,vec3(-.2,.94,-.27)))*1555.419921875;
diffuseColor.rgb*=.82+.36*texture2D(uGroundDetail,detail).r;
`;

export function createTerrain(buffer,sun){
 const length=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),start=4+Math.ceil(length/4)*4,heights=new Float32Array(buffer,start,header.heightSize**2),group=new THREE.Group();
 const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:true});
 material.onBeforeCompile=shader=>{shader.uniforms.uSun={value:sun};shader.uniforms.uGroundDetail={value:terrainDetailTexture};shader.vertexShader='uniform vec3 uSun;varying float vSlopeLight;attribute float landFade;varying float vLandFade;varying vec3 vRadial,vSlope,vGroundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLandFade=landFade;vGroundPoint=(position+vec3(0.0,6371000.0,0.0))/6371000.0;vSlope=normalize(mat3(modelMatrix)*normal);vRadial=normalize(mat3(modelMatrix)*normalize(position+vec3(0.0,6371000.0,0.0)));vSlopeLight=clamp(1.0+8.0*dot(vSlope-vRadial,uSun),.62,1.34);');shader.fragmentShader='varying float vSlopeLight;uniform sampler2D uGroundDetail;uniform vec3 uSun;varying vec3 vRadial,vSlope,vGroundPoint;varying float vLandFade;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vLandFade;'+terrainLighting);};
 // Opaque inner tiles draw before the globe so covered ground is shaded once.
 const solid=material.clone();solid.transparent=false;solid.onBeforeCompile=material.onBeforeCompile;
 const chunks=header.chunks.map(chunk=>{
  const inner=chunk.box.every(v=>Math.abs(v)<header.extent*.88);
  const levels=chunk.levels.map(level=>{const attributes=new THREE.InterleavedBuffer(new Float32Array(buffer,start+level.offset,level.vertices*10),10),g=new THREE.BufferGeometry();for(const [name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['landFade',1,9]])g.setAttribute(name,new THREE.InterleavedBufferAttribute(attributes,size,offset));g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,start+level.offset+level.vertices*40,level.indices),1));g.computeBoundingSphere();const mesh=new THREE.Mesh(g,inner?solid:material);mesh.renderOrder=inner?-3:0;mesh.visible=false;group.add(mesh);return mesh;});
  return {levels,level:2,center:new THREE.Vector3((chunk.box[0]+chunk.box[1])/2,0,(chunk.box[2]+chunk.box[3])/2),size:chunk.box[1]-chunk.box[0]};
 });
 const townCandidates=[],canopyRows=[];for(const chunk of chunks){const geometry=chunk.levels[0].geometry,positions=geometry.attributes.position;for(let i=0;i<positions.count;i+=7){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),height=y-(Math.sqrt(6371000**2-x*x-z*z)-6371000);if(x>10000&&x<80000&&Math.abs(z)<80000&&height>40&&height<300&&geometry.attributes.normal.getY(i)>.995)townCandidates.push([x,z]);if(Math.hypot(x,z)<9000||Math.hypot(x,z)>160000||height<60||height>1100||Math.sin(x*.003+z*.002)<.25)continue;canopyRows.push([x,y,z]);}}
 const allCanopies=canopyRows.splice(0);for(let i=0;i<Math.min(240,allCanopies.length);i++)canopyRows.push(allCanopies[Math.floor(i*allCanopies.length/Math.min(240,allCanopies.length))]);
 const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#507b60'}),canopyRows.length),transform=new THREE.Object3D();for(let i=0;i<canopyRows.length;i++){const [x,y,z]=canopyRows[i],size=160+i%5*45;transform.position.set(x,y+18,z);transform.scale.set(size,42+i%3*18,size*.72);transform.rotation.y=i*2.399;transform.updateMatrix();canopy.setMatrixAt(i,transform.matrix);}canopy.computeBoundingSphere();group.add(canopy);
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
  canopy.visible=Boolean(quality<2&&extentPixels>600);settlement.visible=Boolean(quality<2&&extentPixels>1800);
  group.userData.levels=chunks.map(c=>c.level);group.userData.opacity=material.opacity;
 };
 group.userData={chunks:chunks.length,extent:header.extent,canopies:canopyRows.length,settlements:centers.length,levels:chunks.map(c=>c.level)};return group;
}
