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
function canopyGeometry(){
 const source=new THREE.IcosahedronGeometry(1,0),p=source.attributes.position,positions=[],colors=[];
 for(const [x,z,size,tint]of [[-.4,-.12,.55,1],[.3,-.25,.48,.9],[.12,.35,.5,1.08]])for(let i=0;i<p.count;i++){positions.push(x+p.getX(i)*size,.42+p.getY(i)*.42,z+p.getZ(i)*size);colors.push(.10*tint,.24*tint,.13*tint);}
 source.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
export function createForest(){
 const group=new THREE.Group(),geometry=treeGeometry(),material=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}),canopies=new THREE.InstancedMesh(canopyGeometry(),material,256),cache=new Map(),transform=new THREE.Object3D(),point=new THREE.Vector3(),cameraPoint=new THREE.Vector3(),east=new THREE.Vector3(),north=new THREE.Vector3(),normal=new THREE.Vector3(),neighbor=new THREE.Vector3();
 group.scale.setScalar(R/(R-5));canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(canopies);
 let key='',clock=0,canopyKey='';
 const stats=group.userData={nearTrees:0,canopies:0,cached:0,cacheLimit:12,activeLimit:9,instanceBytes:0,buildMs:0,rebuilds:0,trianglesPerTree:geometry.attributes.position.count/3};
 function place(mesh,index,lon,lat,size,width=size*.32){
  direction(lon,lat,point);const h=S.heightAt(point.x,point.y,point.z);if(S.waterAt(point.x,point.y,point.z)||h>2200||point.y>0&&Math.hypot(point.x,point.z)*R<3200)return false;
  const density=S.forestAt(point.x,point.y,point.z,h);if(density<.26)return false;
  if(mesh===canopies){const delta=width/R*180/Math.PI;for(const [x,y]of [[lon-delta/Math.max(.15,Math.cos(lat*Math.PI/180)),lat],[lon+delta/Math.max(.15,Math.cos(lat*Math.PI/180)),lat],[lon,lat-delta],[lon,lat+delta]]){direction(x,y,neighbor);if(S.waterAt(neighbor.x,neighbor.y,neighbor.z)||Math.abs(S.heightAt(neighbor.x,neighbor.y,neighbor.z)-h)>100)return false;}}
  transform.position.copy(point).multiplyScalar(1+h/R);transform.quaternion.setFromUnitVectors(up,point);transform.scale.set(width/R,size/R,width/R);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);return true;
 }
 function build(x,y){
  const started=performance.now(),latitude=(y+.5)*step,dx=step/Math.max(.15,Math.cos(latitude*Math.PI/180)),mesh=new THREE.InstancedMesh(geometry,material,144);mesh.count=0;
  for(let j=0;j<12;j++)for(let i=0;i<12;i++){
   const a=seed(x*12+i,y*12+j),b=seed(y*12+j,x*12+i+17),lon=(x+(i+.15+a*.7)/12)*dx,lat=(y+(j+.15+b*.7)/12)*step;
   direction(lon,lat,point);const h=S.heightAt(point.x,point.y,point.z),density=S.forestAt(point.x,point.y,point.z,h);if(a>density*.88)continue;
   // Reject cliffs using the same canonical field as contact; no per-tree physics.
   const neighbor=direction(lon,lat+.00035,new THREE.Vector3()),slope=Math.abs(S.heightAt(neighbor.x,neighbor.y,neighbor.z)-h)/39;if(slope>.45)continue;
   if(place(mesh,mesh.count,lon,lat,11+b*12,11+b*12))mesh.count++;
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);stats.buildMs+=performance.now()-started;stats.rebuilds++;return {mesh,used:++clock,x,y};
 }
 group.update=(flight,camera,pixels,quality,enabled)=>{
  group.visible=Boolean(enabled&&flight&&quality<2&&200*pixels/Math.max(1000,S.clearance(flight.state))>1.5);if(!group.visible){stats.nearTrees=stats.canopies=0;return;}
  group.updateWorldMatrix(true,false);cameraPoint.copy(camera.position);group.worldToLocal(cameraPoint);
  const [lon,lat]=S.geographic(...S.direction(flight.state)),row=Math.floor(lat/step),desired=[];
  for(let y=row-1;y<=row+1;y++){
   const dx=step/Math.max(.15,Math.cos((y+.5)*step*Math.PI/180)),x=Math.floor(lon/dx);
   for(let a=x-1;a<=x+1;a++)desired.push([a,y]);
  }
  const next=desired.map(p=>p.join(':')).join('|');if(next!==key){key=next;for(const [x,y]of desired){const id=x+':'+y;if(!cache.has(id))cache.set(id,build(x,y));cache.get(id).used=++clock;}
   const active=new Set(desired.map(p=>p.join(':')));
   while(cache.size>12){const [id,item]=[...cache].filter(([id])=>!active.has(id)).sort((a,b)=>a[1].used-b[1].used)[0];group.remove(item.mesh);item.mesh.dispose();cache.delete(id);}
  }
  stats.nearTrees=0;
  for(const [id,item]of cache){const center=item.mesh.boundingSphere?.center,distance=center?cameraPoint.distanceTo(center)*R:Infinity,screen=16*pixels/Math.max(1,distance),active=desired.some(([x,y])=>id===x+':'+y);item.mesh.visible=active&&screen>(quality===1?2.5:1.1);if(item.mesh.visible)stats.nearTrees+=item.mesh.count;}
  const midStep=.012,cy=Math.floor(lat/midStep),dx=midStep/Math.max(.15,Math.cos((cy+.5)*midStep*Math.PI/180)),cx=Math.floor(lon/dx),midKey=cx+':'+cy+':'+quality;
  if(midKey!==canopyKey){canopyKey=midKey;canopies.count=0;
   for(let j=-9;j<=9;j++)for(let i=-9;i<=9&&canopies.count<256;i++){
    const row=cy+j,rowDx=midStep/Math.max(.15,Math.cos((row+.5)*midStep*Math.PI/180)),col=Math.floor(lon/rowDx)+i,a=seed(col,row),b=seed(row,col+73),x=(col+.2+a*.6)*rowDx,y=(row+.2+b*.6)*midStep;
    direction(x,y,point);const h=S.heightAt(point.x,point.y,point.z),density=S.forestAt(point.x,point.y,point.z,h);if(a>density*.9)continue;
    if(place(canopies,canopies.count,x,y,24+b*16,250+b*210)){
     const height=(lon,lat)=>{direction(lon,lat,neighbor);return S.heightAt(neighbor.x,neighbor.y,neighbor.z);},ex=(height(x+.001,y)-height(x-.001,y))/(2*R*Math.PI/180*.001*Math.max(.15,Math.cos(y*Math.PI/180))),nz=(height(x,y+.001)-height(x,y-.001))/(2*R*Math.PI/180*.001);
     if(Math.hypot(ex,nz)>.3)continue;
     east.copy(direction(x+.001,y,neighbor)).sub(point).normalize();north.copy(direction(x,y+.001,neighbor)).sub(point).normalize();normal.copy(point).addScaledVector(east,-ex).addScaledVector(north,-nz).normalize();transform.quaternion.setFromUnitVectors(up,normal);transform.updateMatrix();canopies.setMatrixAt(canopies.count++,transform.matrix);
    }
   }
   canopies.instanceMatrix.needsUpdate=true;canopies.computeBoundingSphere();
  }
  const agl=S.clearance(flight.state),screen=200*pixels/Math.max(1000,agl);canopies.visible=screen>1.5&&screen<2000;stats.canopies=canopies.visible?canopies.count:0;stats.cached=cache.size;stats.instanceBytes=cache.size*144*64+256*64;
 };
 return group;
}
