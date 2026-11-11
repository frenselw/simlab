'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');

test('global index and visible patch resolution include poles and the date line',async()=>{
  const {terrainPatch}=await import('./precise-terrain.js');
  const inventory=fs.readFileSync(path.join(__dirname,'assets/precise-terrain-index.bin'));
  const present=(lon,lat)=>{
    const i=(lat+90)*360+lon+180;return Boolean(inventory[i>>3]&(1<<(i&7)));
  };
  assert.equal(inventory.length,8100);
  assert.equal([...inventory].reduce((n,b)=>n+b.toString(2).replaceAll('0','').length,0),26475);
  for(const [lon,lat] of [[86,27],[-72,-34],[0,-90],[179,66]])assert(present(lon,lat));
  assert(!present(-130,0));
  assert.deepEqual(terrainPatch(180,90,1),{id:'-180/89.96875/0.03125',west:-180,south:89.96875,size:.03125});
  assert.equal(terrainPatch(86.8,27.7,2).size*111195/32,108.5888671875);
  assert(terrainPatch(86.8,27.7,350).size>terrainPatch(86.8,27.7,2).size);
});

test('terrain cancels obsolete work and retries transient failures while paused',async t=>{
  const {createPreciseTerrain}=await import('./precise-terrain.js');
  const THREE=await import('./vendor/three-0.185.1/three.module.min.js');
  const requests=[];
  let worker,now=0;
  t.mock.method(performance,'now',()=>now);
  globalThis.window={RocketSurface:require('./surface')};
  globalThis.Worker=class{
    constructor(){worker=this;}
    postMessage(patch){requests.push(patch);}
  };
  t.after(()=>{delete globalThis.window;delete globalThis.Worker;});
  const terrain=createPreciseTerrain(new THREE.Vector3(1,0,0),'/rocket-terrain/');
  new THREE.Group().add(terrain);
  const camera=new THREE.PerspectiveCamera(40,1,.00001,10);
  const aim=z=>{camera.lookAt(.88,0,z);camera.updateMatrixWorld();};
  camera.position.set(1.0003,0,0);aim(1);
  const update=()=>terrain.update(camera,500,true);
  terrain.onChange=update;
  update();
  const obsolete=requests[0];
  aim(-1);update();update();
  assert.deepEqual(requests.slice(1),[{cancel:obsolete.id}]);
  worker.onmessage({data:{id:obsolete.id,error:'aborted'}});
  assert.equal(terrain.userData.failed,0);
  requests.splice(0,2);
  assert.notEqual(requests[0].west,obsolete.west);
  for(let i=0;i<requests.length;i++)worker.onmessage({data:{id:requests[i].id,error:true}});
  assert(requests.length>0);
  const failed=requests.length;
  now=29999;terrain.advance(now);assert.equal(requests.length,failed);
  now=30000;terrain.advance(now);assert.equal(requests.length,failed+1);
  assert.equal(requests.at(-1).west,requests[0].west);
});

test('terrain worker aborts GeoTIFF metadata ranges and reads the next patch',async t=>{
  const vm=require('node:vm'),GeoTIFF=require('./vendor/geotiff-3.0.5/geotiff.js');
  const inventory=new Uint8Array(8100);
  for(const id of [90*360+180,91*360+181])inventory[id>>3]|=1<<(id&7);
  const firstBlock=Buffer.alloc(65536);
  firstBlock.write('II');firstBlock.writeUInt16LE(42,2);firstBlock.writeUInt32LE(65536,4);
  const dem=GeoTIFF.writeArrayBuffer([12,12,12,12],{width:2,height:2});
  const water=GeoTIFF.writeArrayBuffer([0,0,0,0],{width:2,height:2});
  const range=(data,start,total)=>new Response(data,{status:206,headers:{'Content-Range':`bytes ${start}-${start+data.byteLength-1}/${total}`}});
  const metadata=[];
  const fetchData=async(url,{headers,signal})=>{
    const pathname=new URL(url).pathname;
    if(pathname.endsWith('.bin'))return new Response(inventory);
    const offset=Number(/^bytes=(\d+)-/.exec(headers.Range)[1]);
    if(pathname.includes('/1/1/')){
      const bytes=pathname.endsWith('water.tif')?water:dem;
      return range(bytes,0,bytes.byteLength);
    }
    if(!offset)return range(firstBlock,0,131072);
    return new Promise((resolve,reject)=>{
      metadata.push({signal,reject});
      signal?.addEventListener('abort',()=>reject(signal.reason),{once:true});
    });
  };
  t.mock.method(globalThis,'fetch',fetchData);
  const self={},messages=[];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'precise-terrain-worker.js'),'utf8'),{
    GeoTIFF,self,fetch:fetchData,importScripts(){},location:{href:'https://example.test/worker.js'},
    URL,AbortController,AbortSignal,setTimeout,clearTimeout,postMessage:data=>messages.push(data)
  });
  const endpoint='https://example.test/rocket-terrain/';
  const pending=self.onmessage({data:{endpoint,id:1,west:.25,south:.25,size:.03125}});
  try{
    for(let i=0;metadata.length<2&&i<20;i++)await new Promise(setImmediate);
    assert.equal(metadata.length,2);
    await self.onmessage({data:{cancel:1}});
    assert(metadata.every(({signal})=>signal?.aborted));
  }finally{
    for(const {reject} of metadata)reject(Error('Fixture cleanup'));
    await pending;
  }
  assert.equal(messages[0].id,1);assert(messages[0].error);
  await self.onmessage({data:{endpoint,id:2,west:1.25,south:1.25,size:.03125}});
  assert.equal(messages[1].id,2);assert(!messages[1].error,messages[1].error);
  assert(messages[1].heights.length===4489&&messages[1].heights.every(value=>value===48));
  assert(messages[1].water.every(value=>value===0));
});

test('relay sends only the requested Copernicus object and preserves byte ranges',async()=>{
  const {terrainRelay}=await import('./terrain-relay.mjs');
  let calls=0;
  const fetchData=async(url,options)=>{
    calls++;
    assert.equal(url,'https://copernicus-dem-90m.s3.eu-central-1.amazonaws.com/Copernicus_DSM_COG_30_S34_00_W072_00_DEM/AUXFILES/Copernicus_DSM_COG_30_S34_00_W072_00_WBM.tif');
    assert.deepEqual(options.headers,{Range:'bytes=0-2'});
    assert.equal(options.redirect,'manual');
    return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Type':'image/tiff','Content-Length':'3','Content-Range':'bytes 0-2/100'}});
  };
  const request=(path,options)=>new Request('https://example.test'+path,options);
  const tile='/rocket-terrain/-34/-72/water.tif';
  const config=await terrainRelay(request('/rocket-side-booster-lab/precise-terrain-config.js'),fetchData);
  assert.match(await config.text(),/RocketPreciseTerrainEndpoint=/);
  assert.equal(await terrainRelay(request('/anything-else'),fetchData),null);
  assert.equal((await terrainRelay(request(tile+'?target=other'),fetchData)).status,400);
  assert.equal((await terrainRelay(request('/rocket-terrain/90/0/dem.tif'),fetchData)).status,400);
  assert.equal((await terrainRelay(request(tile,{method:'POST'}),fetchData)).status,405);
  assert.equal((await terrainRelay(request(tile,{headers:{Range:'bytes=0-1,4-5'}}),fetchData)).status,416);
  const response=await terrainRelay(request(tile,{headers:{Range:'bytes=0-2',Authorization:'ignored'}}),fetchData);
  assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 0-2/100');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
  assert.equal(calls,1);
  const redirect=await terrainRelay(request(tile),async()=>Response.redirect('https://example.test/other'));
  assert.equal(redirect.status,502);
});
