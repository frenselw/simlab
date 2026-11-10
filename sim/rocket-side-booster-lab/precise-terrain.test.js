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

test('relay sends only the requested Copernicus object and preserves byte ranges',async()=>{
  const {terrainRelay}=await import('./terrain-relay.mjs');
  let calls=0;
  const fetchData=async(url,options)=>{
    calls++;
    assert.equal(url,'https://copernicus-dem-90m.s3.eu-central-1.amazonaws.com/Copernicus_DSM_COG_30_S34_00_W072_00_DEM/AUXFILES/Copernicus_DSM_COG_30_S34_00_W072_00_WBM.tif');
    assert.deepEqual(options.headers,{Range:'bytes=0-2'});
    assert.equal(options.redirect,'error');
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
});
