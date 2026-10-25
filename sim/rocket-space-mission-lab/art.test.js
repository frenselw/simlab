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
