'use strict';
const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path'),S=require('./surface'),R=6371000;
(async()=>{
 globalThis.window={RocketSurface:S};
 const THREE=await import(pathToFileURL(path.join(__dirname,'vendor/three-0.185.1/three.module.min.js'))),{createForest}=await import(pathToFileURL(path.join(__dirname,'forest.js'))),forest=createForest(),camera=new THREE.PerspectiveCamera(40,1,.000001,10),origin=new THREE.Vector3(10000/R,Math.sqrt(1-(10000/R)**2),0),[lon,lat]=S.geographic(...origin.toArray());
 function flight(longitude,latitude){const a=longitude*Math.PI/180,b=latitude*Math.PI/180,v=[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)],basis=[[1,0,0],[0,1,0],[0,0,1]].map(q=>{const [x,y]=S.geographic(...q).map(a=>a*Math.PI/180);return [Math.cos(y)*Math.cos(x),Math.sin(y),Math.cos(y)*Math.sin(x)];}),p=basis.map(q=>q.reduce((t,n,i)=>t+n*v[i],0)),r=R+S.heightAt(...p)+80;camera.position.set(p[0],p[1],p[2]).multiplyScalar(1+200/R);return {state:[p[1]*r,p[0]*r,p[2]*r,0,0,0],t:0};}
 const update=(x,y,quality=0)=>forest.update(flight(x,y),camera,800,quality,true),positions=()=>{const mesh=forest.children[0],m=new THREE.Matrix4(),rows=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);rows.push(m.elements.slice(12,15).join(','));}return rows;};
 update(lon,lat);const first=positions();assert(first.length>80);update(lon,lat);assert.deepEqual(positions(),first);
 update(lon,lat+.036);const shifted=positions(),same=shifted.filter(p=>new Set(first).has(p)).length;assert(same>Math.min(first.length,shifted.length)*.7,'Overlapping geographic forest cells must never move after crossing a latitude row');
 let sharedDisposals=0;for(const mesh of forest.children.slice(1)){mesh.geometry.addEventListener('dispose',()=>sharedDisposals++);mesh.material.addEventListener('dispose',()=>sharedDisposals++);}
 for(let i=0;i<40;i++){update(lon+i*.009,lat);assert(forest.userData.cached<=12&&forest.userData.nearTrees<=1296&&forest.userData.canopies<=256);}
 assert.equal(sharedDisposals,0,'Evict instances without destroying shared prototypes');update(lon,lat,2);assert(!forest.visible);update(lon,lat);assert.deepEqual(positions(),first,'Eviction and quality restoration reproduce the same forest');
 console.log('Forest: stable geographic overlap, repeatable eviction, bounded cache/instances, shared resources and low-quality fallback passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
