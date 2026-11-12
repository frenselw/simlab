'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(__dirname,'assets'),g=require('./assets/geography.json'),manifest=JSON.stringify(require('./assets.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let bytes=0;
for(const [name,a]of Object.entries(g.assets)){
 const b=fs.readFileSync(path.join(dir,name));assert.equal(hash(b),a.sha256,name+' must match the inspected atlas');assert.equal(b.length,a.bytes);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert(manifest.includes('rocket-side-booster-lab/assets/'+name));bytes+=b.length;
}
assert(bytes<1024*1024);const zlib=require('node:zlib'),codec=require('./surface-codec');
const compact=file=>zlib.gunzipSync(fs.readFileSync(path.join(dir,file)));
const chart=JSON.parse(compact('geography-v2.gz'));
assert.deepEqual(chart.coastRows,g.coastRows);assert.equal(chart.ridges,g.ridges.length);
for(const source of g.sources)assert.equal(hash(fs.readFileSync(path.join(root,'tools/rocket-art/sources',source.file))),source.sha256);
assert.equal(g.projection.radius,6371000);assert(g.projection.imagesNorthUp);
const grid=g.landGrid;assert.equal(grid.rows.length,grid.height);assert(grid.rows.every(r=>r.length===grid.width&&/^[01]+$/.test(r)));
const land=(x,z)=>grid.rows[Math.round((1-z/grid.extentMetres)*(grid.height-1)/2)][Math.round((x/grid.extentMetres+1)*(grid.width-1)/2)]==='1';
assert(land(0,0),'Launch remains on dry land');assert(!land(-50000,0),'Pacific remains west of launch');assert(land(50000,0),'Mainland remains east of launch');
assert.equal(g.coastRows.length,481);assert(g.coastRows.every((r,i)=>r.z===-120000+i*500&&(r.x===null||Number.isFinite(r.x)&&Math.abs(r.x)<=120000)));
assert(g.coastRows[240].x<-20000&&g.coastRows[240].x>-22000,'Local shore must match the geographic launch site');
assert.equal(g.ridges.length,36);assert(g.ridges.every(r=>land(r.x,r.z)));assert.deepEqual(g.ridges[0],{x:3200,z:-14000,h:450,r:900});
assert.equal(g.river.nearPad.waterWidth,76);assert.equal(g.river.nearPad.bankWidth,112);assert(g.river.samples[0][0]<-20000,'River must extend to the west coast');
console.log('Rocket art: pinned assets/sources, package closure, dry launch, geographic orientation, coast/ridge/river contracts passed.');

const terrain=compact('region-mesh-v2.gz'),manifestFiles=require('./assets.json').files;
const coarseBytes=compact('global/coarse.bin.gz');
const worldRecords=g.globalTerrain.files;
let geometryBytes=0;
for(const {file} of worldRecords){
 const packedFile=file+'.gz',data=compact(packedFile),length=data.readUInt32LE(),offset=4+Math.ceil(length/4)*4;
 const header=JSON.parse(data.toString('utf8',4,4+length));
 assert.equal(header.version,2);assert.equal(offset+header.vertexCount*8+header.indexCount*4,data.length);
 assert(header.cells.every(c=>!c.file||manifestFiles.includes('rocket-side-booster-lab/assets/global/'+c.file)));
 assert(manifestFiles.includes('rocket-side-booster-lab/assets/'+packedFile));
 const directions=[];
 for(let i=0,lon=0,lat=0;i<header.vertexCount;i++){
  lon+=data.readInt32LE(offset+i*4);lat+=data.readInt32LE(offset+(header.vertexCount+i)*4);
  const a=lon/1e7,b=lat/1e7,c=Math.cos(b);
  directions.push([c*Math.cos(a),Math.sin(b),c*Math.sin(a)]);
 }
 let index=0,end=0;
 for(const cell of header.cells){assert.equal(cell.firstIndex,end);end+=cell.indexCount;}
 assert.equal(end,header.indexCount);
 for(let i=offset+header.vertexCount*8;i<data.length;i+=12){
  const points=[];
  for(let k=0;k<3;k++){
   index+=data.readInt32LE(i+k*4);
   assert(index>=0&&index<header.vertexCount);
   points.push(directions[index]);
  }
  const [a,b,c]=points,u=b.map((v,k)=>v-a[k]),w=c.map((v,k)=>v-a[k]);
  const winding=a[0]*(u[1]*w[2]-u[2]*w[1])+a[1]*(u[2]*w[0]-u[0]*w[2])+a[2]*(u[0]*w[1]-u[1]*w[0]);
  assert(winding>0,'Compact globe triangles must face outward');
 }
 geometryBytes+=fs.statSync(path.join(dir,packedFile)).size;
}
assert(geometryBytes<10e6,'Streamed geometry must not carry duplicate heights, normals and colors');
assert(!manifestFiles.some(f=>f.endsWith('/regional-surface.png')||f.endsWith('/terrain.bin')));
const Surface=require('./surface'),surfaceData=require('./surface-data'),surfaceBytes=fs.readFileSync(path.join(__dirname,g.surface.file));assert(surfaceBytes.length<2000);assert.equal(surfaceData.version,2);assert.equal(Surface.height([6371000,0],0),0);assert(!Surface.isWater([6371000,0],0));for(let i=0;i<2000;i++){const angle=i*.117,t=i*173,q=[6371000*Math.cos(angle),6371000*Math.sin(angle),0],height=Surface.height(q,t);assert(Number.isFinite(height)&&height>=0&&height<=Surface.MAX_HEIGHT);if(Surface.isWater(q,t))assert.equal(height,0);assert(Math.abs(Surface.clearance([q[0]*(1+height/6371000),q[1]*(1+height/6371000)],t))<.00001);}for(const file of ['surface-data.js','surface.js','contact-ground.js','impact-effects.js'])assert(manifest.includes('/'+file));console.log('Shared surface: pinned compact grids, finite elevations, water at zero, exact radial clearance, launch and package dependencies passed.');

const R=6371000,field=(x,z=0)=>Surface.heightAt(x/R,Math.sqrt(1-(x*x+z*z)/(R*R)),z/R);
const world=Surface.surfaceGrid();assert.equal(world.width,8193);assert.equal(world.height,4097);assert.equal(world.data.byteLength,67133442);assert.equal(hash(fs.readFileSync(path.join(__dirname,surfaceData.world.file))),surfaceData.world.sha256);
for(let row=0;row<world.height;row++)assert.equal(world.data[row*world.width],world.data[(row+1)*world.width-1],'Longitude seam');assert(world.data.subarray(0,world.width).every(v=>v===0));assert(world.data.subarray((world.height-1)*world.width).every(v=>v===world.data.at(-1)));
const basis=[[1,0,0],[0,1,0],[0,0,1]].map(q=>{const [lon,lat]=Surface.geographic(...q).map(v=>v*Math.PI/180);return [Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];});
const directionAt=(lon,lat)=>{lon*=Math.PI/180;lat*=Math.PI/180;const p=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];return basis.map(v=>v.reduce((s,n,i)=>s+n*p[i],0));};
for(const [name,lon,lat,low,high]of [['Himalaya',86.9,28,4500,9000],['Andes',-70,-30,1500,6500],['Alps',10.5,46.8,1000,4500],['Australia',133,-25,0,2000],['Antarctica',0,-89,1000,4500]]){const p=directionAt(lon,lat),h=Surface.heightAt(...p);assert(h>=low&&h<=high,name+' '+h);assert(!Surface.waterAt(...p));}
assert(Surface.waterAt(...directionAt(-150,0)));assert.equal(Surface.heightAt(...directionAt(-150,0)),0);assert(Surface.forestAt(...directionAt(14,23))<.1,'Sahara must not become a dense forest');assert(Math.abs(Surface.heightAt(...directionAt(-180+1e-7,66))-Surface.heightAt(...directionAt(180-1e-7,66)))<.1);
const worldSource=require('../../tools/rocket-art/sources/explorer-world-terrain/source.json');assert.equal(hash(fs.readFileSync(path.join(root,'tools/rocket-art/sources/explorer-world-terrain/height-land-8k.png'))),worldSource.derivativeSha256);assert.equal(g.globalTerrain.illustrative,false);assert.equal(g.reliefModel.globalIllustrative,false);
assert.equal(surfaceData.fine.width,4097);assert.equal(g.reliefModel.localSpacingMetres,117.1875);assert.equal(Surface.MAX_HEIGHT,9000);
const fine=fs.readFileSync(path.join(__dirname,surfaceData.fine.file));assert.equal(hash(fine),surfaceData.fine.sha256);assert.equal(require('node:zlib').gunzipSync(fine).length,surfaceData.fine.decodedBytes);assert(manifest.includes(surfaceData.fine.file));
assert(g.reliefModel.fine.maximumMetres>3500&&g.reliefModel.fine.maximumMetres<Surface.MAX_HEIGHT,'Real summits are not clipped to the historical ceiling');
const demPath=path.join(root,'tools/rocket-art/sources/explorer-natural-region/usgs-region-dem.tif');assert.equal(hash(fs.readFileSync(demPath)),g.reliefModel.source.sha256);assert(g.reliefModel.noDataFraction<.02);
const sampleBytes=fs.readFileSync(path.join(dir,'terrain-sample/sample.bin')),sample=require('./terrain-sample-data').decode(sampleBytes.buffer.slice(sampleBytes.byteOffset,sampleBytes.byteOffset+sampleBytes.length));
const errors=[];for(let z=-15000;z<=15000;z+=1500)for(let x=-15000;x<=15000;x+=1500)errors.push(Math.abs(field(x+28000,z)-sample.heightAt(x,z)));errors.sort((a,b)=>a-b);assert(errors[Math.floor(errors.length*.95)]<35,'Full region retains accepted sample landforms');
for(const edge of [175000,211200,239500,240000])for(const z of [0,12000,-12000])assert(Math.abs(field(edge-1,z)-field(edge+1,z))<1,'Regional/global relief has no height step');
for(const x of [10000,30000,50000,180000,260000]){const e=x/R,u=Math.sqrt(1-e*e),density=Surface.forestAt(e,u,0),color=Surface.colorAt(e,u,0);assert(density>=0&&density<=1&&color.every(v=>v>=0&&v<=1));assert.deepEqual(Surface.colorAt(e,u,0),color);}
assert.equal(field(0),0);assert(!Surface.waterAt(0,1,0));assert.equal(field(-50000),0);assert(Surface.waterAt(-50000/R,Math.sqrt(1-(-50000/R)**2),0));
// Fine local triangles have no bilinear saddle: rendering and collision share the diagonal.
const unit=480000/4096,x=30000,z=10000,i=Math.floor((x+240000)/unit),j=Math.floor((240000-z)/unit),gx=-240000+i*unit,gz=240000-j*unit;
const blend=.5*field(gx,gz)+.25*field(gx+unit,gz)+.25*field(gx,gz-unit);assert(Math.abs(field(gx+unit*.25,gz-unit*.25)-blend)<1e-6);
console.log(JSON.stringify({acceptedSampleError95Metres:errors[Math.floor(errors.length*.95)],fineDecodedBytes:4097**2*2}));
(async()=>{
 const vm=require('node:vm'),code=fs.readFileSync(path.join(__dirname,'surface.js'),'utf8'),heightRequests=[];
 const raw=Buffer.alloc(1230),compressed=zlib.gzipSync(raw);
 const fixture={codec:'pyramid-i8-v1',width:33,height:33,step:80,maximum:9000,decodedBytes:raw.length,bytes:compressed.length};
 assert.equal(codec.decode(raw,fixture).length,1089);
 assert.throws(()=>codec.decode(raw.subarray(1),fixture),/length/);
 const bad=Buffer.from(raw);bad.writeUInt16LE(9001,137);
 assert.throws(()=>codec.decode(bad,fixture),/base height/);
 let worker;
 class TestWorker {
  constructor(){worker=this;}
  postMessage(message){this.files=message.files;}
  terminate(){this.terminated=true;}
 }
 const browser={RocketParts:require('./parts'),RocketSurfaceCodec:codec,RocketSurfaceData:{
  version:2,extent:240000,fine:{...fixture,file:'region.gz'},world:{...fixture,file:'world.gz'}
 }};
 vm.runInNewContext(code,{window:browser,URL,Worker:TestWorker,AbortController,
  document:{currentScript:{src:'https://test.invalid/rocket/surface.js'}},
  fetch:(url,options)=>new Promise(resolve=>heightRequests.push({url,options,resolve}))
 });
 const batch=browser.RocketSurface,fallback=batch.surfaceGrid().data,first=batch.ready();
 assert.equal(batch.ready(),first,'Concurrent callers share a batch');
 heightRequests[1].resolve(new Response(compressed));
 heightRequests[0].resolve(new Response(null,{status:404}));
 await assert.rejects(first,/unavailable/);
 assert(heightRequests.every(r=>r.options.signal.aborted));
 assert.equal(batch.surfaceGrid().data,fallback);
 const retry=batch.ready();
 for(const request of heightRequests.slice(2)){
  assert.equal(request.options.cache,'reload');request.resolve(new Response(compressed));
 }
 for(let i=0;i<100&&!worker;i++)await new Promise(setImmediate);
 assert(worker,'Both compressed bodies arrive before decoding');
 assert.equal(batch.surfaceGrid().data,fallback,'Nothing publishes until both grids validate');
 worker.onmessage({data:{grids:worker.files.map(({bytes,record})=>codec.decode(zlib.gunzipSync(bytes),record))}});
 await retry;
 assert.equal(batch.surfaceGrid().width,33);assert(worker.terminated);
 globalThis.window={RocketSurface:Surface};const {pathToFileURL}=require('node:url'),THREE=await import(pathToFileURL(path.join(__dirname,'vendor/three-0.185.1/three.module.min.js'))),{createTerrain,createWorldSurfaceTexture,orientGroundSphere}=await import(pathToFileURL(path.join(__dirname,'terrain.js'))),{createContactGround}=await import(pathToFileURL(path.join(__dirname,'contact-ground.js'))),relief=await createTerrain(terrain.buffer.slice(terrain.byteOffset,terrain.byteOffset+terrain.length),new THREE.Vector3(0,1,0)),contact=createContactGround(new THREE.Vector3(0,1,0),null,{uLaunchCut:{value:0}},relief);
 let vertices=0;
 const shared=new Map();
 for(const mesh of relief.children){
  if(!mesh.geometry.attributes.landFade)continue;
  const {position,color}=mesh.geometry.attributes,indices=mesh.geometry.index.array;
  assert(indices.every(i=>i<position.count));
  for(let i=0;i<position.count;i++){
   const x=position.getX(i),y=position.getY(i),z=position.getZ(i),e=x/R,n=z/R,u=Math.sqrt(1-e*e-n*n);
   const curve=(u-1)*R*THREE.MathUtils.smoothstep(Math.hypot(x,z),1500,5000);
   assert(Math.abs(y-curve+.78-Surface.heightAt(e,u,n))<.001);
   const key=x+','+z;
   if(shared.has(key))assert.equal(y,shared.get(key),'Matching LOD vertices remain watertight');
   else shared.set(key,y);
   if(i%13===0)assert(Math.abs(color.getX(i)-Surface.colorAt(e,u,n)[0])<1e-6);
   vertices++;
  }
 }
 assert(vertices>10000);
 const texture=createWorldSurfaceTexture();assert.equal(texture.image.data.length,2048*1025*2);assert.equal(texture.generateMipmaps,false);assert.equal(texture.image.width,2048);assert.equal(texture.wrapS,THREE.RepeatWrapping);for(const [x,y]of [[0,0],[1024,512],[2047,1024],[1234,800]])assert.equal(texture.image.data[(y*2048+x)*2]*256+texture.image.data[(y*2048+x)*2+1],world.data[(4096-y*4)*8193+x*4]&32767);
 const sphere=new THREE.SphereGeometry(1,24,12),target=new THREE.Vector3(...directionAt(86.9,28));assert(orientGroundSphere(sphere,target));const before=sphere.attributes.position.array.slice();assert.equal(orientGroundSphere(sphere,target),false);assert.deepEqual(sphere.attributes.position.array,before);assert(orientGroundSphere(sphere,new THREE.Vector3(...directionAt(10,47))));sphere.dispose();texture.dispose();
 const {createGlobalTerrain}=await import(pathToFileURL(path.join(__dirname,'global-terrain.js'))),globe=await createGlobalTerrain(coarseBytes.buffer.slice(coarseBytes.byteOffset,coarseBytes.byteOffset+coarseBytes.length),new THREE.Vector3(0,1,0));for(const [lon,lat]of [[86.9,28],[-70,-30],[10.5,46.8],[133,-25]])assert(Number.isFinite(globe.surfaceHeight(new THREE.Vector3(...directionAt(lon,lat)))));assert(globe.userData.heightCells<=8);
 // Real camera rays must select ahead of a trailing camera, with route tiles cached before use.
 const nativeFetch=globalThis.fetch,requests=[];globalThis.fetch=(url,{signal})=>new Promise((resolve,reject)=>{const item={url,resolve,signal};requests.push(item);signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});
 try{
  const camera=new THREE.PerspectiveCamera(40,1,.00001,10),a=.14,view=(angle,sign)=>{camera.position.set(Math.sin(angle-.05*sign),Math.cos(angle-.05*sign),0).multiplyScalar(1.02);camera.lookAt(new THREE.Vector3(Math.sin(angle+.1*sign),Math.cos(angle+.1*sign),0));camera.updateMatrixWorld();},flight=(angle,speed=7800,status='flying')=>({status,state:[(R+50000)*Math.cos(angle),(R+50000)*Math.sin(angle),0,-speed*Math.sin(angle),speed*Math.cos(angle),0]}),update=f=>globe.updateDetail(camera,800,0,true,false,true,f);
  view(a,1);update(flight(a));assert(globe.userData.desired.includes('8-12'),'Visible eastward terrain must precede the tiles behind the camera');assert(globe.userData.desired.length<=4&&globe.userData.pending<=2);view(a,-1);update(flight(a,-7800));assert(globe.userData.desired.includes('5-12'),'Turning the camera west must prioritize the westward view');
  await new Promise(setImmediate);camera.position.set(Math.sin(.28),Math.cos(.28),0).multiplyScalar(1.01);camera.lookAt(new THREE.Vector3(Math.sin(.15),Math.cos(.15),0));camera.updateMatrixWorld();update(flight(.25));assert(globe.userData.prefetch.includes('8-12'),'A route tile outside the current backward view must be prefetched');
  async function deliver(){for(const item of requests.splice(0)){if(item.signal.aborted)continue;const bytes=fs.readFileSync(item.url);item.resolve(new Response(bytes));}await new Promise(resolve=>setTimeout(resolve,70));update(flight(.25));assert(globe.userData.loaded<=6&&globe.userData.active.length<=4&&globe.userData.pending<=2);}
  assert(globe.children[0].geometry.drawRange.count>0,'Coarse ground remains while fine requests wait');for(let i=0;i<5;i++)await deliver();assert.equal(globe.userData.pending,0);assert(!globe.userData.active.includes('8-12'),'Prefetch must not consume an active view slot');const order=globe.userData.desired.slice();update(flight(.25));assert.deepEqual(globe.userData.desired,order);assert.equal(requests.length,0,'A stationary view must not restart downloads');
  view(.25,1);update(flight(.25));assert(globe.userData.active.includes('8-12'),'The forward tile must already be drawable when the camera turns');update(flight(.25,0,'landed'));assert.equal(globe.userData.prefetch.length,0);globe.updateDetail(camera,800,2,true,false,true,flight(.25));assert.equal(globe.userData.desired.length,0);assert.equal(globe.userData.prefetch.length,0);await new Promise(setImmediate);
  const radial=flight(.25);radial.state[3]=500*Math.cos(.25);radial.state[4]=500*Math.sin(.25);update(radial);assert.equal(globe.userData.prefetch.length,0,'Pure radial motion must not predict sideways terrain');globe.updateDetail(camera,800,2,true,false,true,radial);await new Promise(setImmediate);
  globalThis.fetch=async()=>({ok:false});view(2,1);for(let i=0;i<3;i++){update(flight(2));await new Promise(setImmediate);}assert(globe.userData.failures.length>0);assert(globe.children[0].geometry.drawRange.count>0,'Failed detail retains coarse ground');assert.equal(globe.userData.active.length,0);
  console.log(JSON.stringify({terrainAhead:true,viewAndRouteSeparated:true,cache:globe.userData.loaded}));
 }finally{globalThis.fetch=nativeFetch;}
 const x=28000,z=10000,e=x/R,n=z/R,u=Math.sqrt(1-e*e-n*n),r=R+field(x,z)+30;contact.update({state:[u*r,e*r,n*r,0,0,0],t:0},true);const p=contact.children[0].geometry.attributes.position,origin=contact.children[0].position,v=new THREE.Vector3();let checked=0,error=0;
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).add(origin);const length=v.length(),unit=v.clone().normalize();if(unit.distanceTo(contact.clipping.uContactCenter.value)*R>900)continue;error=Math.max(error,Math.abs((length-1)*R-Surface.heightAt(unit.x,unit.y,unit.z)));checked++;}assert(checked>150&&error<.1,'Local contact vertices share canonical collision heights');assert.equal(contact.userData.triangles,12800);
 for(const [px,pz]of [[0,0],[28000,10000],[80000,0]])assert(Number.isFinite(relief.meshHeight(px,pz)),'Indexed mesh lookup must cover land');
 const rebuilds=contact.userData.rebuilds,camera=new THREE.PerspectiveCamera();camera.position.set(28000,500,10000);relief.updateDetail(camera,800,0,true);contact.update({state:[u*r,e*r,n*r,0,0,0],t:0},true);assert(contact.userData.rebuilds>rebuilds,'A stationary contact skirt must refresh when surrounding LOD changes');
 const fineLevels=relief.userData.levels.slice();relief.updateDetail(camera,800,2,true);assert(fineLevels.some(level=>level===0)&&relief.userData.levels.every(level=>level===2));contact.update({state:[u*r,e*r,n*r,0,0,0],t:0},true);assert(contact.userData.rebuilds>rebuilds+1);
 for(const [east,up,north] of [[e,u,n],directionAt(12,47)]){
  const radius=R+Surface.heightAt(east,up,north)+30;
  contact.update({state:[up*radius,east*radius,north*radius,0,0,0],t:0},true);
  const {index}=contact.children[0].geometry;
  const [a,b,c]=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i)));
  assert(b.sub(a).cross(c.sub(a)).dot(contact.clipping.uContactCenter.value)>0,'Contact ground must face outward both near and far from the launch site');
 }
 console.log(JSON.stringify({browserHeightValidation:true,contactVertices:checked,maximumContactErrorMetres:error,contactTriangles:contact.userData.triangles}));
})().catch(error=>{console.error(error);process.exitCode=1;});
