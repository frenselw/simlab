import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import {terrainLighting,groundLight,setTerrainNormals,yieldTerrainTask,terrainSlopeDetail,surfaceUniforms,orbitalLighting} from './terrain.js';

async function geometry(buffer,signal){
 const length=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),start=4+Math.ceil(length/4)*4;
 const {vertexCount,indexCount}=header;
 if(header.version!==2||!Number.isInteger(vertexCount)||vertexCount<3||!Number.isInteger(indexCount)||indexCount<0||indexCount%3||
  start+vertexCount*8+indexCount*4!==buffer.byteLength)throw Error('Invalid global terrain');
 const coordinates=new Int32Array(buffer,start,vertexCount*2),deltas=new Int32Array(buffer,start+vertexCount*8,indexCount);
 const positions=new Float32Array(vertexCount*3),colors=new Uint8Array(vertexCount*4),indices=new Uint32Array(indexCount);
 const surface=window.RocketSurface,radius=6371000;
 for(let i=0,longitude=0,latitude=0;i<vertexCount;i++){
  longitude+=coordinates[i];latitude+=coordinates[i+vertexCount];
  const a=longitude/1e7,b=latitude/1e7,c=Math.cos(b);
  if(Math.abs(a)>Math.PI+1e-7||Math.abs(b)>Math.PI/2+1e-7)throw Error('Invalid global terrain coordinates');
  const x=c*Math.cos(a),y=Math.sin(b),z=c*Math.sin(a),scale=1+surface.heightAt(x,y,z)/radius;
  positions.set([x*scale,y*scale,z*scale],i*3);
  const [red,green,blue]=surface.colorAt(x,y,z);
  colors.set([Math.round(red*255),Math.round(green*255),Math.round(blue*255),255],i*4);
  if(i%8192===8191){
   await yieldTerrainTask();
   if(signal?.aborted)throw signal.reason;
  }
 }
 for(let i=0,vertex=0;i<indexCount;i++){
  vertex+=deltas[i];
  if(vertex<0||vertex>=vertexCount)throw Error('Invalid global terrain index');
  indices[i]=vertex;
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 g.setAttribute('color',new THREE.BufferAttribute(colors,4,true));
 g.setIndex(new THREE.BufferAttribute(indices,1));g.computeBoundingSphere();return {header,g};
}
export async function createGlobalTerrain(buffer,sun,loadDetail){
 const {header,g}=await geometry(buffer),origin=new THREE.Vector3(),group=new THREE.Group(),regional={value:0},material=new THREE.MeshBasicMaterial({vertexColors:true,depthTest:false,depthWrite:true});
 let normalMs=0;
 for(let first=0;first<header.vertexCount;first+=8192){
  normalMs+=setTerrainNormals(g,origin,true,first,Math.min(first+8192,header.vertexCount));
  await yieldTerrainTask();
 }
 // Coarse sphere chords must not disappear below the smooth ocean; clip the far hemisphere analytically.
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,surfaceUniforms,{uRegional:regional,uSun:{value:sun},uSlopeDetail:terrainSlopeDetail});shader.vertexShader='attribute float surfaceWater;varying float vSurfaceWater;varying vec3 vGroundWorld;\nvarying vec3 vSurface,vTerrainWorld,vRadial,vSlope,vGroundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=position;vSurfaceWater=surfaceWater;vGroundWorld=(modelMatrix*vec4(position,1.0)).xyz;vGroundPoint=position;vSlope=normalize(mat3(modelMatrix)*normal);vTerrainWorld=(modelMatrix*vec4(position,1.0)).xyz;vRadial=normalize(mat3(modelMatrix)*normalize(position));');shader.fragmentShader=groundLight+orbitalLighting+'varying float vSurfaceWater;varying vec3 vGroundWorld;\nuniform float uRegional;uniform vec3 uSun;varying vec3 vSurface,vTerrainWorld,vRadial,vSlope,vGroundPoint;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(dot(normalize(vRadial),cameraPosition-vTerrainWorld)<=0.0)discard;if(uRegional>.5&&vSurface.y>0.0&&max(abs(vSurface.x),abs(vSurface.z))*6371000.0<211200.0)discard;').replace('#include <color_fragment>','#include <color_fragment>\n'+terrainLighting+'\nif(uOrbitalBlend>0.0)diffuseColor.rgb=mix(diffuseColor.rgb,shadeOrbitalSurface(normalize(vRadial),vGroundPoint,vGroundWorld,uSun),uOrbitalBlend);');};material.customProgramCacheKey=()=> 'rocket-global-terrain';
 const original=g.index.array,index=new THREE.BufferAttribute(new Uint32Array(original.length),1).setUsage(THREE.DynamicDrawUsage);g.setIndex(index);g.setDrawRange(0,0);const coarse=new THREE.Mesh(g,material);coarse.renderOrder=-1;coarse.frustumCulled=false;group.add(coarse);
 const cells=header.cells.map(c=>({...c,normal:new THREE.Vector3(...c.center)})),cache=new Map(),pending=new Map(),failed=new Set(),cameraLocal=new THREE.Vector3(),world=new THREE.Vector3(),frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),inverse=new THREE.Matrix4(),sphere=new THREE.Sphere(),ray=new THREE.Raycaster(),focus=new THREE.Vector3(),lead=new THREE.Vector3(),tangent=new THREE.Vector3();let selected='',clock=0,desired=new Set(),wanted=new Set();
 const stats=group.userData={normalBuildMs:normalMs,lastNormalBuildMs:normalMs,coarseTriangles:0,fineTriangles:0,loaded:0,pending:0,cacheLimit:6,activeLimit:4,requestLimit:2,failures:[],active:[],normalFailures:[],bytes:buffer.byteLength};
 let detail,detailRequest,detailWanted=new Set(),detailVisible=false;
 let fineMaterial;const normalFailed=new Set();group.advanceDetail=now=>detail?.advance(now)||false;
 async function meshFor(data,signal){
  const {g}=await geometry(data,signal);
  if(signal.aborted){g.dispose();return null;}
  const normalMs=setTerrainNormals(g,origin,true);stats.normalBuildMs+=normalMs;stats.lastNormalBuildMs=normalMs;
  // Fine mountain faces must occlude each other; only distant coarse ocean chords keep the depth workaround.
  if(!fineMaterial){fineMaterial=material.clone();fineMaterial.depthTest=true;fineMaterial.onBeforeCompile=material.onBeforeCompile;fineMaterial.customProgramCacheKey=()=>material.customProgramCacheKey()+'-fine-depth';}
  const mesh=new THREE.Mesh(g,fineMaterial);mesh.renderOrder=-1;mesh.visible=false;group.add(mesh);return {mesh,bytes:data.byteLength,used:++clock};}
 function evict(limit=6){while(cache.size>limit){const candidates=[...cache].filter(([id])=>!wanted.has(id)).sort((a,b)=>a[1].used-b[1].used);if(!candidates.length)break;const [id,item]=candidates[0];group.remove(item.mesh);item.mesh.geometry.dispose();cache.delete(id);}}
 function updateMetadata(){
  if(!loadDetail||detail)return;
  if(!detailVisible){
   detailRequest?.abort();detailRequest=null;stats.detailPending=false;
   return;
  }
  if(detailRequest)return;
  const request=new AbortController();
  detailRequest=request;stats.detailPending=true;
  loadDetail(request.signal).then(result=>{
   if(!request.signal.aborted){detail=result;stats.detail=detail.stats;}
  },()=>{}).finally(()=>{
   if(detailRequest===request){stats.detailPending=false;group.onChange?.();}
  });
 }
 async function loadCell(id,signal){
  let item=cache.get(id);
  if(!item){
   const cell=cellMap.get(id),response=await fetch(new URL('./assets/global/'+cell.file,import.meta.url),{signal});
   if(!response.ok)throw Error('Global detail unavailable');
   const compressed=await RocketSurfaceCodec.readBytes(response.body,300000);
   const data=(await RocketSurfaceCodec.gunzip(compressed,500000)).slice().buffer;
   if(signal.aborted)return;
   item=await meshFor(data,signal);
   if(item){evict(5);cache.set(id,item);}
  }
 }
 async function loadNormal(id,signal){
  const pixels=await detail.read(id,signal);
  if(signal.aborted||!pixels||!detailWanted.has(id))return;
  if(detail.stats.loaded>=detail.capacity){
   const outside=detail.stats.ids.find(key=>!detailWanted.has(key));
   if(!outside)return;
   detail.drop(outside);
  }
  detail.install(id,pixels);
 }
 function load(){
  const jobs=[
   ...[...desired].map(id=>[id,false]),
   ...[...detailWanted].map(id=>[id,true]),
   ...[...wanted].filter(id=>!desired.has(id)).map(id=>[id,false])
  ];
  for(const [id,normal] of jobs){
   if(pending.size>=2)break;
   const key=normal?'normal:'+id:id;
   if(pending.has(key)||(normal?(detail.has(id)||normalFailed.has(id)):(cache.has(id)||failed.has(id))))continue;
   const abort=new AbortController();pending.set(key,abort);
   (normal?loadNormal(id,abort.signal):loadCell(id,abort.signal)).catch(()=>{
    if(!abort.signal.aborted)(normal?normalFailed:failed).add(id);
   }).finally(()=>{
    pending.delete(key);evict();group.onChange?.();
   });
  }
 }
 const normalCentres=new Map();
 function selectDetail(candidates){
  if(!detail||!detailVisible)return new Set();
  const options=[];
  for(const {c,screen} of candidates){
   if(screen<260)continue;
   const [cx,cy]=c.id.split('-').map(Number);
   for(let y=cy*4;y<cy*4+4;y++)for(let x=cx*4;x<cx*4+4;x++){
    const id=x+'-'+y,bytes=detail.sizeOf(id);
    if(!bytes||normalFailed.has(id))continue;
    if(!normalCentres.has(id)){
     const a=((x+.5)*2.5-180)*Math.PI/180,b=((y+.5)*2.5-90)*Math.PI/180,cos=Math.cos(b);
     normalCentres.set(id,new THREE.Vector3(...window.RocketSurface.fromGeocentric(cos*Math.cos(a),cos*Math.sin(a),Math.sin(b))));
    }
    const center=normalCentres.get(id);
    sphere.center.copy(center);sphere.radius=.032;sphere.applyMatrix4(group.matrixWorld);
    if(frustum.intersectsSphere(sphere))options.push({id,bytes,score:1-center.dot(focus)});
   }
  }
  let bytes=0;
  const selected=new Set();
  for(const tile of options.sort((a,b)=>a.score-b.score)){
   if(bytes+tile.bytes>450000)continue;
   selected.add(tile.id);bytes+=tile.bytes;
   if(selected.size===detail.capacity)break;
  }
  return selected;
 }
 const cellMap=new Map(cells.map(c=>[c.id,c])),heightCache=new Map();
 group.surfaceHeight=direction=>{
  const S=window.RocketSurface,[lon,lat]=S.geographic(direction.x,direction.y,direction.z),id=Math.min(35,Math.floor((lon+180)/10))+'-'+Math.min(17,Math.floor((lat+90)/10)),cell=cellMap.get(id);if(!cell)return -5;
  const fine=cache.get(id)?.mesh,geometry=fine?.visible?fine.geometry:g,key=geometry.uuid+':'+id;
  if(!heightCache.has(key)){
   const east=new THREE.Vector3(0,1,0).cross(cell.normal);if(east.lengthSq()<.001)east.set(1,0,0);east.normalize();const north=cell.normal.clone().cross(east),limit=Math.tan(cell.angularRadius)*1.1,source=geometry===g?original:geometry.index.array,first=geometry===g?cell.firstIndex:0,count=geometry===g?cell.indexCount:source.length,rows=new Float64Array(count/3*9),bins=Array.from({length:256},()=>[]),p=new THREE.Vector3(),position=geometry.attributes.position,toBin=v=>Math.max(0,Math.min(15,Math.floor((v/limit+1)*8)));
   for(let i=0;i<count;i+=3){const row=i/3,at=row*9;for(let k=0;k<3;k++){p.fromBufferAttribute(position,source[first+i+k]);const d=p.dot(cell.normal);rows.set([p.dot(east)/d,p.dot(north)/d,1/d],at+k*3);}const xs=[rows[at],rows[at+3],rows[at+6]],ys=[rows[at+1],rows[at+4],rows[at+7]];for(let y=toBin(Math.min(...ys));y<=toBin(Math.max(...ys));y++)for(let x=toBin(Math.min(...xs));x<=toBin(Math.max(...xs));x++)bins[y*16+x].push(row);}
   heightCache.set(key,{east,north,normal:cell.normal,rows,bins,toBin});if(heightCache.size>8)heightCache.delete(heightCache.keys().next().value);stats.heightCells=heightCache.size;
  }
  const data=heightCache.get(key),denom=direction.dot(data.normal),x=direction.dot(data.east)/denom,y=direction.dot(data.north)/denom;let best=-5;
  for(const row of data.bins[data.toBin(y)*16+data.toBin(x)]){const at=row*9,r=data.rows,ax=r[at],ay=r[at+1],bx=r[at+3],by=r[at+4],cx=r[at+6],cy=r[at+7],det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-18)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)best=Math.max(best,(6371000-5)/(denom*(u*r[at+2]+v*r[at+5]+(1-u-v)*r[at+8]))-6371000);}
  return best;
 };
 const colorCache=new Map();
 group.colorAt=(direction,out)=>{
  const [lon,lat]=window.RocketSurface.geographic(direction.x,direction.y,direction.z),id=Math.min(35,Math.floor((lon+180)/10))+'-'+Math.min(17,Math.floor((lat+90)/10)),cell=cells.find(c=>c.id===id);if(!cell)return out.setRGB(.24,.37,.22);
  if(!colorCache.has(id)){const east=new THREE.Vector3(0,1,0).cross(cell.normal);if(east.lengthSq()<.001)east.set(1,0,0);east.normalize();const north=cell.normal.clone().cross(east),rows=[],pos=g.attributes.position,col=g.attributes.color,v=new THREE.Vector3();for(let i=cell.firstIndex;i<cell.firstIndex+cell.indexCount;i+=3){const triangle=[];for(let k=0;k<3;k++){const j=original[i+k];v.fromBufferAttribute(pos,j);const d=v.dot(cell.normal);triangle.push([v.dot(east)/d,v.dot(north)/d,col.getX(j),col.getY(j),col.getZ(j)]);}rows.push(triangle);}colorCache.set(id,{east,north,normal:cell.normal,rows});if(colorCache.size>8)colorCache.delete(colorCache.keys().next().value);}
  const c=colorCache.get(id),d=direction.dot(c.normal),x=direction.dot(c.east)/d,y=direction.dot(c.north)/d;let nearest=null,best=Infinity;for(const [a,b,e]of c.rows){for(const v of [a,b,e]){const distance=(v[0]-x)**2+(v[1]-y)**2;if(distance<best){nearest=v;best=distance;}}const det=(b[1]-e[1])*(a[0]-e[0])+(e[0]-b[0])*(a[1]-e[1]);if(Math.abs(det)<1e-14)continue;const u=((b[1]-e[1])*(x-e[0])+(e[0]-b[0])*(y-e[1]))/det,v=((e[1]-a[1])*(x-e[0])+(a[0]-e[0])*(y-e[1]))/det;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)return out.setRGB(...[2,3,4].map(k=>u*a[k]+v*b[k]+(1-u-v)*e[k]));}return out.setRGB(...nearest.slice(2));
 };
 group.updateDetail=(camera,pixels,quality,enabled,localVisible,allowFine=true,flight=null)=>{
  group.visible=Boolean(enabled);regional.value=localVisible?1:0;group.updateMatrixWorld(true);cameraLocal.copy(camera.position);group.worldToLocal(cameraLocal);const d=cameraLocal.length(),angle=Math.acos(Math.min(1,1/Math.max(1,d))),direction=cameraLocal.clone().normalize(),scale=group.scale.x;
  const orbitalBlend=THREE.MathUtils.smoothstep((d-1)*6371000,100000,220000);
  surfaceUniforms.uOrbitalBlend.value=stats.orbitalBlend=orbitalBlend;
  terrainSlopeDetail.value=THREE.MathUtils.smoothstep(12000*pixels/Math.max(1,(d-1)*6371000),1,24);
  const visible=enabled?cells.filter(c=>c.normal.dot(direction)>Math.cos(Math.min(Math.PI,angle+c.angularRadius+.03))):[];
  const fineEnabled=enabled&&allowFine&&(quality<2||Boolean(loadDetail));
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));inverse.copy(group.matrixWorld).invert();focus.copy(direction);
  // Prefer the ground actually ahead in the image, not the ground nearest a trailing camera.
  for(const y of [0,-.55,-.9]){ray.setFromCamera(new THREE.Vector2(0,y),camera);ray.ray.applyMatrix4(inverse);if(ray.ray.intersectSphere(sphere.set(new THREE.Vector3(),1),focus)){focus.normalize();break;}focus.copy(direction);}
  const candidates=fineEnabled?visible.map(c=>{sphere.center.copy(c.normal).multiplyScalar(Math.cos(c.angularRadius));sphere.radius=Math.sin(c.angularRadius)+.002;sphere.applyMatrix4(group.matrixWorld);world.copy(c.normal).applyMatrix4(group.matrixWorld);const distance=camera.position.distanceTo(world),screen=.174533*scale*pixels/Math.max(camera.near,distance);return {c,screen,inView:frustum.intersectsSphere(sphere),score:1-c.normal.dot(focus)};}).filter(({c,screen,inView})=>c.file&&inView&&screen>(cache.get(c.id)?.mesh.visible?180:260)*(quality===1?1.5:1)).sort((a,b)=>a.score-b.score).slice(0,4):[];
  const inView=new Set(candidates.map(({c})=>c.id));desired=quality<2&&orbitalBlend<1?new Set(inView):new Set();wanted=new Set(desired);
  if(desired.size&&flight?.status==='flying'){
   lead.set(...window.RocketSurface.direction(flight.state));tangent.set(flight.state[4],flight.state[3],0).addScaledVector(lead,-(flight.state[4]*lead.x+flight.state[3]*lead.y));const speed=tangent.length();
   if(speed>25){tangent.divideScalar(speed);for(const seconds of [30,60]){const a=Math.min(.065,speed*seconds/6371000),point=lead.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangent,Math.sin(a)),[lon,lat]=window.RocketSurface.geographic(point.x,point.y,point.z),id=Math.min(35,Math.max(0,Math.floor((lon+180)/10)))+'-'+Math.min(17,Math.max(0,Math.floor((lat+90)/10)));if(cellMap.get(id)?.file)wanted.add(id);}}
  }
  stats.desired=[...desired];stats.prefetch=[...wanted].filter(id=>!inView.has(id));stats.focus=focus.toArray();
  detailVisible=inView.size>0;updateMetadata();
  detailWanted=selectDetail(candidates);
  for(const [id,abort]of pending){
   if(id.startsWith('normal:')?!detailWanted.has(id.slice(7)):!wanted.has(id))abort.abort();
  }
  for(const [id,item]of cache){item.mesh.visible=Boolean(enabled&&desired.has(id));if(item.mesh.visible)item.used=++clock;}
  evict();load();detail?.select(detailWanted);stats.normalFailures=[...normalFailed];
  const coarseCells=orbitalBlend===1?[]:visible.filter(c=>!cache.has(c.id)||!desired.has(c.id)),key=coarseCells.map(c=>c.id).join(',');if(key!==selected){let offset=0;for(const c of coarseCells){index.array.set(original.subarray(c.firstIndex,c.firstIndex+c.indexCount),offset);offset+=c.indexCount;}index.needsUpdate=true;g.setDrawRange(0,offset);selected=key;}
  stats.coarseTriangles=g.drawRange.count/3;stats.fineTriangles=[...cache.values()].filter(i=>i.mesh.visible).reduce((n,i)=>n+i.mesh.geometry.index.count/3,0);stats.loaded=cache.size;stats.pending=pending.size;stats.failures=[...failed];stats.active=[...cache].filter(([,i])=>i.mesh.visible).map(([id])=>id);stats.bytes=buffer.byteLength+[...cache.values()].reduce((n,i)=>n+i.bytes,0);
 };
 return group;
}
