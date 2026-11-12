'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 require('./surface-codec');
 const {createTerrainDetail}=await import(pathToFileURL(path.join(__dirname,'terrain-detail.js'))),size=259,cells={};for(let x=0;x<14;x++)cells[x+'-8']=100;
 const metadata={version:2,size,samples:256,border:1,encoding:'tangent-rgb8-127',cells},cache=createTerrainDetail(metadata),[atlas,lookup]=cache.textures,data=new Uint8ClampedArray(size*size*4);for(let i=0;i<data.length;i+=4)data.set([128,128,255,255],i);
 const at=id=>{const [x,y]=id.split('-').map(Number);return (y*144+x)*4;};
 assert(atlas.image.width<=4096&&atlas.image.height<=4096);assert(cache.stats.bytes<26e6);assert.equal(atlas.generateMipmaps,false);assert.equal(atlas.colorSpace,'');
 cache.install('0-8',data,1000);cache.select(['0-8'],1000);assert.equal(lookup.image.data[at('0-8')],1);assert.equal(lookup.image.data[at('0-8')+1],0);assert(cache.advance(1300));assert.equal(lookup.image.data[at('0-8')+1],128);assert(!cache.advance(1600));assert.equal(lookup.image.data[at('0-8')+1],255);assert.equal(atlas.image.data[2],255);
 for(let i=1;i<12;i++)cache.install(i+'-8',data,1600);assert.equal(cache.stats.loaded,12);assert.throws(()=>cache.install('12-8',data),/full/);cache.drop('0-8');assert.equal(lookup.image.data[at('0-8')],0);data[0]=200;cache.install('12-8',data,2000);cache.select(['12-8'],2600);assert.equal(lookup.image.data[at('12-8')],1);assert.equal(lookup.image.data[at('0-8')],0);assert.equal(atlas.image.data[0],200,'Reusing a slot must replace pixels without leaving the old geographic lookup');assert.equal(cache.stats.loaded,12);assert.equal(cache.stats.visible,1);
 const saved={fetch:globalThis.fetch,document:globalThis.document,createImageBitmap:globalThis.createImageBitmap};let closed=0,dimensions=size,transparent=false;
 globalThis.fetch=async()=>({ok:true,body:new Blob([new Uint8Array(100)]).stream()});globalThis.createImageBitmap=async()=>({width:dimensions,height:dimensions,close(){closed++;}});globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},drawImage(){},getImageData(){const copy=data.slice();if(transparent)copy[3]=0;return{data:copy};}})})};
 try{
  const decoded=await cache.read('13-8',new AbortController().signal);assert.equal(decoded.length,size*size*4);assert.equal(closed,1);dimensions=1;await assert.rejects(cache.read('13-8'),/size/);assert.equal(closed,2);dimensions=size;transparent=true;await assert.rejects(cache.read('13-8'),/opaque/);assert.equal(closed,3);transparent=false;const abort=new AbortController();abort.abort();await assert.rejects(cache.read('13-8',abort.signal),/Cancelled/);assert.equal(closed,4);let finishDecode;globalThis.createImageBitmap=()=>new Promise(resolve=>{finishDecode=resolve;});const lateAbort=new AbortController(),late=cache.read('13-8',lateAbort.signal);for(let i=0;i<100&&!finishDecode;i++)await new Promise(setImmediate);assert(finishDecode);lateAbort.abort();finishDecode({width:size,height:size,close(){closed++;}});await assert.rejects(late,/Cancelled/);assert.equal(closed,5,'A cancelled decode must close its bitmap before an atlas slot can be claimed');globalThis.fetch=async()=>({ok:false});await assert.rejects(cache.read('13-8'),/unavailable/);
 }finally{Object.assign(globalThis,saved);cache.dispose();}
 const fs=require('node:fs'),{gunzipSync}=require('node:zlib');
 const dir=path.join(__dirname,'assets/global-detail'),index=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,'tiles.json.gz'))));
 const source=require('../../tools/rocket-art/sources/explorer-global-detail/source.json'),manifest=require('./assets.json').files;
 assert.deepEqual(index.source,source);assert.equal(source.width,43200);assert.equal(source.height,21600);
 const coarse=gunzipSync(fs.readFileSync(path.join(__dirname,'assets/global/coarse.bin.gz')));
 const header=JSON.parse(coarse.toString('utf8',4,4+coarse.readUInt32LE()));
 const parents=new Set(header.cells.filter(c=>c.file).map(c=>c.id));
 let bytes=0;
 for(const [id,size] of Object.entries(index.cells)){
  const file='normal-'+id+'.webp',b=fs.readFileSync(path.join(dir,file));
  assert.equal(b.toString('ascii',8,16),'WEBPVP8L');assert.equal(b.length,size);
  const [x,y]=id.split('-').map(Number);
  assert(parents.has(Math.floor(x/4)+'-'+Math.floor(y/4)));
  assert(manifest.includes('rocket-side-booster-lab/assets/global-detail/'+file));
  bytes+=size;
 }
 assert.equal(bytes,index.bytes);assert(bytes<145e6);assert(manifest.includes('rocket-side-booster-lab/assets/global-detail/tiles.json.gz'));
 console.log('Global detail atlas: bounded slots, geographic reuse, smooth readiness, exact opaque decoding, abort/failure cleanup and mobile texture limits passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
