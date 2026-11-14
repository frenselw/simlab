import * as THREE from './vendor/three-0.185.1/three.module.min.js';
const S=window.RocketSurface,R=6371000,step=.006,up=new THREE.Vector3(0,1,0);
const seed=(x,y)=>THREE.MathUtils.euclideanModulo(Math.sin(x*127.1+y*311.7)*43758.5453,1);
function direction(lon,lat,out){const a=lon*Math.PI/180,b=lat*Math.PI/180,v=[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)];return out.set(...basis.map(q=>q[0]*v[0]+q[1]*v[1]+q[2]*v[2]));}
const basis=[[1,0,0],[0,1,0],[0,0,1]].map(q=>{const [lon,lat]=S.geographic(...q).map(a=>a*Math.PI/180);return [Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];});
function treeGeometry(){
 const positions=[],colors=[];
 for(const [geometry,color]of [[new THREE.CylinderGeometry(.045,.065,.4,3),[.18,.12,.075]],[new THREE.ConeGeometry(.32,.85,5),[.10,.25,.13]]]){
  const flat=geometry.toNonIndexed(),p=flat.attributes.position;
  for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i)+(geometry.type==='ConeGeometry'?.55:.2),p.getZ(i));colors.push(...color);}geometry.dispose();flat.dispose();
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function woodlandMaterial(near,scale){
 const material=new THREE.MeshLambertMaterial({vertexColors:true,alphaHash:true});material.onBeforeCompile=shader=>{shader.uniforms.uTreeMetres=scale;shader.vertexShader='varying vec3 vTreeWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`vec4 treePoint=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 treePoint=instanceMatrix*treePoint;
 #endif
 vTreeWorld=(modelMatrix*treePoint).xyz;
 #include <project_vertex>`);shader.fragmentShader='varying vec3 vTreeWorld;uniform float uTreeMetres;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat treeDistance=distance(vTreeWorld,cameraPosition)*uTreeMetres;diffuseColor.a*='+(near?'1.0-smoothstep(650.0,950.0,treeDistance)':'smoothstep(650.0,1100.0,treeDistance)*(1.0-smoothstep(6000.0,9000.0,treeDistance))')+';');};material.customProgramCacheKey=()=>near?'explorer-near-woodland-v2':'explorer-mid-woodland-v2';return material;
}

export function createForest(relief,world,contact,occupied){
 const group=new THREE.Group(),geometry=treeGeometry(),scale={value:1},material=woodlandMaterial(true,scale),canopies=new THREE.InstancedMesh(geometry,woodlandMaterial(false,scale),256),cache=new Map(),transform=new THREE.Object3D(),point=new THREE.Vector3(),cameraPoint=new THREE.Vector3(),normal=new THREE.Vector3();
 group.scale.setScalar(R/(R-5));canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(canopies);
 let key='',clock=0,canopyKey='';
 const canopyAnchors=[],matrix=new THREE.Matrix4();
 const stats=group.userData={nearTrees:0,canopies:0,cached:0,cacheLimit:12,activeLimit:9,instanceBytes:0,buildMs:0,rebuilds:0,trianglesPerTree:geometry.attributes.position.count/3};
 function place(mesh,index,lon,lat,size,width){
  direction(lon,lat,point);
  const x=point.x*R,z=point.z*R,h=S.heightAt(point.x,point.y,point.z);
  if(S.waterAt(point.x,point.y,point.z)||h>2200||point.y>0&&(Math.hypot(x,z)<650||occupied?.(x,z)))return null;
  if(S.forestAt(point.x,point.y,point.z,h)<.26)return null;
  transform.position.copy(point).multiplyScalar(1+h/R);
  transform.quaternion.setFromUnitVectors(up,point);
  transform.scale.set(width/R,size/R,width/R);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);
  return {unit:point.clone(),height:h,size};
 }
 function anchor(mesh,roots,revision){
  if(mesh.userData.groundRevision===revision)return;
  mesh.userData.groundRevision=revision;
  for(const [i,{unit,height,size}]of roots.entries()){
   let radius=R+height;
   const x=unit.x*R,z=unit.z*R;
   if(relief?.visible&&unit.y>.99&&Math.max(Math.abs(x),Math.abs(z))<211200){
    const y=contact.groundHeightAt(x,z);
    if(Number.isFinite(y))radius=(R+y)/unit.y;
   }else if(mesh===canopies&&world?.visible){
    radius=R+world.surfaceHeight(unit);
   }
   mesh.getMatrixAt(i,matrix);
   matrix.elements[12]=unit.x*(radius-size*.045)/R;
   matrix.elements[13]=unit.y*(radius-size*.045)/R;
   matrix.elements[14]=unit.z*(radius-size*.045)/R;
   mesh.setMatrixAt(i,matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
 }
 function build(x,y){
  const started=performance.now(),latitude=(y+.5)*step,dx=step/Math.max(.15,Math.cos(latitude*Math.PI/180)),mesh=new THREE.InstancedMesh(geometry,material,144);mesh.count=0;
  const accepted=[],roots=[];
  for(let i=0;i<260&&mesh.count<144;i++){
   const a=seed(x*311+i,y*17+91),b=seed(y*197+i,x*31+17),lon=(x+.02+a*.96)*dx,lat=(y+.02+b*.96)*step;
   if(accepted.some(([p,q])=>((p-lon)*Math.cos(latitude*Math.PI/180))**2+(q-lat)**2<(14/111195)**2))continue;
   direction(lon,lat,point);const h=S.heightAt(point.x,point.y,point.z),density=S.forestAt(point.x,point.y,point.z,h);if(seed(x+i*13,y-i*17)>density*.88)continue;
   // Reject cliffs using the same canonical field as contact; no per-tree physics.
   const neighbor=direction(lon,lat+.00035,new THREE.Vector3()),slope=Math.abs(S.heightAt(neighbor.x,neighbor.y,neighbor.z)-h)/39;if(slope>.45)continue;
   const root=place(mesh,mesh.count,lon,lat,11+b*12,11+b*12);
   if(root){roots.push(root);mesh.count++;accepted.push([lon,lat]);}
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);stats.buildMs+=performance.now()-started;stats.rebuilds++;return {mesh,roots,used:++clock,x,y};
 }
 group.update=(flight,camera,pixels,quality,enabled)=>{
  group.visible=Boolean(enabled&&flight&&quality<2&&200*pixels/Math.max(1000,S.clearance(flight.state))>1.5);if(!group.visible){stats.nearTrees=stats.canopies=0;return;}
  group.updateWorldMatrix(true,false);scale.value=R/group.getWorldScale(normal).x;cameraPoint.copy(camera.position);group.worldToLocal(cameraPoint);
  const [lon,lat]=S.geographic(...S.direction(flight.state)),row=Math.floor(lat/step),desired=[];
  for(let y=row-1;y<=row+1;y++){
   const dx=step/Math.max(.15,Math.cos((y+.5)*step*Math.PI/180)),x=Math.floor(lon/dx);
   for(let a=x-1;a<=x+1;a++)desired.push([a,y]);
  }
  const next=desired.map(p=>p.join(':')).join('|');if(next!==key){key=next;for(const [x,y]of desired){const id=x+':'+y;if(!cache.has(id))cache.set(id,build(x,y));cache.get(id).used=++clock;}
   const active=new Set(desired.map(p=>p.join(':')));
   while(cache.size>12){const [id,item]=[...cache].filter(([id])=>!active.has(id)).sort((a,b)=>a[1].used-b[1].used)[0];group.remove(item.mesh);item.mesh.dispose();cache.delete(id);}
  }
  const revision=[relief?.visible,relief?.userData.levels.join(','),world?.visible,world?.userData.active.join(','),contact?.userData.placementRevision].join('|');
  stats.nearTrees=0;
  for(const [id,item]of cache){
   const active=desired.some(([x,y])=>id===x+':'+y);
   if(active)anchor(item.mesh,item.roots,revision);
   const center=item.mesh.boundingSphere?.center,distance=center?cameraPoint.distanceTo(center)*R:Infinity,screen=16*pixels/Math.max(1,distance);
   item.mesh.visible=active&&screen>(quality===1?2.5:1.1);
   if(item.mesh.visible)stats.nearTrees+=item.mesh.count;
  }
  const midStep=.012,cy=Math.floor(lat/midStep),dx=midStep/Math.max(.15,Math.cos((cy+.5)*midStep*Math.PI/180)),cx=Math.floor(lon/dx),midKey=cx+':'+cy;
  if(midKey!==canopyKey){
   canopyKey=midKey;canopies.count=0;canopyAnchors.length=0;
   for(let j=-9;j<=9;j++)for(let i=-9;i<=9&&canopies.count<256;i++){
    const row=cy+j,rowDx=midStep/Math.max(.15,Math.cos((row+.5)*midStep*Math.PI/180)),col=Math.floor(lon/rowDx)+i,a=seed(col,row),b=seed(row,col+73),x=(col+.02+a*.96)*rowDx,y=(row+.02+b*.96)*midStep;
    direction(x,y,point);
    if(a>S.forestAt(point.x,point.y,point.z)*.9)continue;
    const root=place(canopies,canopies.count,x,y,16+b*9,12+b*9);
    if(root){canopyAnchors.push(root);canopies.count++;}
   }
   delete canopies.userData.groundRevision;
  }
  anchor(canopies,canopyAnchors,revision);
  const agl=S.clearance(flight.state),screen=200*pixels/Math.max(1000,agl);canopies.visible=screen>1.5&&screen<2000;stats.canopies=canopies.visible?canopies.count:0;stats.cached=cache.size;stats.instanceBytes=cache.size*144*64+256*64;
 };
 return group;
}
