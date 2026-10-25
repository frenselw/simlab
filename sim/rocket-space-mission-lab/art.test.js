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

const global=g.globalTerrain;assert(global&&!global.prototype&&global.fineCells===global.landCells);assert(global.bytes<28e6);assert.equal(global.cellDegrees,10);assert.equal(global.source.sha256,hash(fs.readFileSync(path.join(root,'tools/rocket-art/sources',global.source.file))));assert(manifest.includes('/global-terrain.js'));
let totalGlobalBytes=0;const globalHeaders=new Map();
for(const asset of global.files){
 const b=fs.readFileSync(path.join(dir,asset.file));assert.equal(hash(b),asset.sha256,asset.file);assert.equal(b.length,asset.bytes);assert(manifest.includes('rocket-space-mission-lab/assets/'+asset.file));totalGlobalBytes+=b.length;
 const n=b.readUInt32LE(0),h=JSON.parse(b.toString('utf8',4,n+4)),offset=4+Math.ceil(n/4)*4,index=offset+h.vertexCount*16;assert.equal(h.version,1);assert.equal(h.prototype,false);assert.equal(index+h.indexCount*4,b.length);assert.equal(h.indexCount%3,0);assert.equal(h.indexCount/3,asset.triangles);globalHeaders.set(asset.file,h);
 for(let i=0;i<h.vertexCount;i++){const p=Array.from({length:3},(_,k)=>b.readFloatLE(offset+i*12+k*4)),r=Math.hypot(...p);assert(p.every(Number.isFinite));assert(r>.99999&&r<1.00056,'Normalized radial relief');assert.equal(b[offset+h.vertexCount*12+i*4+3],255);}
 for(let i=0;i<h.indexCount;i+=3){const v=[];for(let j=0;j<3;j++){const k=b.readUInt32LE(index+(i+j)*4);assert(k<h.vertexCount);v.push(Array.from({length:3},(_,a)=>b.readFloatLE(offset+k*12+a*4)));}const [a,c,d]=v,u=c.map((x,j)=>x-a[j]),w=d.map((x,j)=>x-a[j]),cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];assert(cross.reduce((sum,x,j)=>sum+x*a[j],0)>0,'Every global triangle points outward');}
 let end=0;for(const c of h.cells){assert.equal(c.firstIndex,end);end+=c.indexCount;assert.equal(c.bounds.length,4);assert(c.center.every(Number.isFinite)&&Math.abs(Math.hypot(...c.center)-1)<1e-6);assert(c.angularRadius>0&&c.angularRadius<.13);if(c.file)assert(global.files.some(a=>a.file==='global/'+c.file));}assert.equal(end,h.indexCount);
 if(asset.file!=='global/coarse.bin')assert(asset.triangles<15000);
}
assert.equal(totalGlobalBytes,global.bytes);assert.equal(globalHeaders.get(global.coarse).cells.length,global.landCells);assert(globalHeaders.get(global.coarse).indexCount/3<100000);assert(global.files.length===global.landCells+1);
console.log('Global terrain: pinned source, all land cells packaged, finite radial relief, outward triangles, binary blocks and bounded asset budgets passed.');

const Surface=require('./surface'),surfaceData=require('./surface-data'),surfaceBytes=fs.readFileSync(path.join(__dirname,g.surface.file));assert.equal(hash(surfaceBytes),g.surface.sha256);assert.equal(surfaceBytes.length,g.surface.bytes);assert.equal(surfaceData.width,721);assert.equal(surfaceData.height,361);assert.equal(Surface.height([6371000,0],0),0);assert(!Surface.isWater([6371000,0],0));for(let i=0;i<2000;i++){const angle=i*.117,t=i*173,q=[6371000*Math.cos(angle),6371000*Math.sin(angle),0],height=Surface.height(q,t);assert(Number.isFinite(height)&&height>=0&&height<=3500);if(Surface.isWater(q,t))assert.equal(height,0);assert(Math.abs(Surface.clearance([q[0]*(1+height/6371000),q[1]*(1+height/6371000)],t))<.00001);}for(const file of ['surface-data.js','surface.js','contact-ground.js','impact-effects.js'])assert(manifest.includes('/'+file));console.log('Shared surface: pinned compact grids, finite elevations, water at zero, exact radial clearance, launch and package dependencies passed.');
