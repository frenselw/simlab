'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(__dirname,'assets'),g=require('./assets/geography.json'),manifest=fs.readFileSync(path.join(root,'sim/manifests/rocket-space-mission-lab.xml'),'utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let bytes=0;
for(const [name,a]of Object.entries(g.assets)){
 const b=fs.readFileSync(path.join(dir,name));assert.equal(hash(b),a.sha256,name+' must match the inspected atlas');assert.equal(b.length,a.bytes);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert(manifest.includes('rocket-space-mission-lab/assets/'+name));bytes+=b.length;
}
assert(bytes<1024*1024);assert(manifest.includes('rocket-space-mission-lab/assets/geography.json'));
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

const terrain=fs.readFileSync(path.join(dir,g.terrain.file));assert.equal(hash(terrain),g.terrain.sha256);assert.equal(terrain.length,g.terrain.bytes);assert(manifest.includes('assets/terrain.bin'));assert(manifest.includes('/terrain.js'));
const headerLength=terrain.readUInt32LE(0),header=JSON.parse(terrain.toString('utf8',4,4+headerLength)),start=4+Math.ceil(headerLength/4)*4;
assert.equal(header.version,1);assert.equal(header.chunks.length,16);assert.equal(header.heightSize,257);assert.equal(terrain.readFloatLE(start+(128*257+128)*4),0,'Dry level launch');
let triangles=0;for(const chunk of header.chunks){assert.equal(chunk.levels.length,3);assert(chunk.levels[0].indices>=chunk.levels[2].indices);for(const level of chunk.levels){const from=start+level.offset,index=from+level.vertices*40;assert(index+level.indices*4<=terrain.length);assert.equal(level.indices%3,0);for(let i=0;i<level.vertices;i++){const at=from+i*40;for(let k=0;k<10;k++)assert(Number.isFinite(terrain.readFloatLE(at+k*4)));assert(terrain.readFloatLE(at+16)>.5,'Terrain normal points up');assert(terrain.readFloatLE(at+36)>=0&&terrain.readFloatLE(at+36)<=1);}for(let i=0;i<level.indices;i++)assert(terrain.readUInt32LE(index+i*4)<level.vertices);triangles+=level.indices/3;}}
assert(triangles<50000);assert(terrain.length<2*1024*1024);console.log('Terrain: baked chunks, LOD, finite geometry, upward normals, indices, launch clearance and budgets passed.');

const shared=new Map();for(const chunk of header.chunks)for(const level of chunk.levels){const from=start+level.offset;for(let i=0;i<level.vertices;i++){const at=from+i*40,x=terrain.readFloatLE(at),y=terrain.readFloatLE(at+4),z=terrain.readFloatLE(at+8);if(!chunk.box.some((b,j)=>Math.abs((j<2?x:z)-b)<.01))continue;const key=x.toFixed(2)+','+z.toFixed(2);if(shared.has(key))assert(Math.abs(shared.get(key)-y)<.01,'Shared chunk and LOD borders must not crack '+JSON.stringify({key,old:shared.get(key),y,box:chunk.box}));else shared.set(key,y);}}
assert(shared.size>100);console.log('Terrain shared borders agree across neighboring chunks and all detail levels.');
