'use strict';
const assert=require('node:assert/strict'),F=require('./presentation.js'),M=require('./model.js');
global.CircuitMath=require('../circuit-workbench/circuit-math.js');
assert(F.math('\\Delta x','Δx').includes('data-tex="\\Delta x"'));
assert(!F.prose('Δx / Δt；Δv').includes('<text'));
let cases=0;
for(const [w,h]of [[320,77],[160,77],[160,220],[195,371],[390,371],[920,730]])for(let angle=0;angle<360;angle+=3)for(const gap of [5,60])for(const sense of [-1,1])for(const velocity of [false,true])for(const review of [false,true]){
  const compact=h<140,r=Math.max(10,Math.min((w-108)/2,(h-(compact?60:154))/2,165)),o=[w/2,h/2+(compact?12:20)],at=t=>[o[0]+r*Math.cos(t),o[1]-r*Math.sin(t)];
  const theta=angle*Math.PI/180,A=at(theta),B=at(theta+sense*gap*Math.PI/180),segments=[];
  const endpoint=(p,v,length)=>{const n=Math.hypot(...v);return[p[0]+v[0]/n*length,p[1]+v[1]/n*length];};
  if(velocity){const scale=Math.max(18,Math.min(w-68,h-92,330))*.5;segments.push([A,[A[0]-sense*Math.sin(theta)*scale,A[1]-sense*Math.cos(theta)*scale]],[B,[B[0]-sense*Math.sin(theta+sense*gap*Math.PI/180)*scale,B[1]-sense*Math.cos(theta+sense*gap*Math.PI/180)*scale]]);const change=M.subtract(M.subtract(segments[1][1],B),M.subtract(segments[0][1],A));segments.push([A,endpoint(A,change,Math.max(20,r*.95))]);}
  else segments.push([A,B],[A,endpoint(A,M.subtract(B,A),Math.max(22,r*.8))]);
  if(review)segments.push([A,endpoint(A,[-sense*Math.sin(theta),-sense*Math.cos(theta)],r*.65)]);
  const labels=F.labels([A,B],o,r,w,h,segments,compact);
  labels.forEach(p=>{assert(Math.hypot(p.x-o[0],p.y-o[1])>=r+29);assert(segments.every(([a,b])=>!F.intersects(p.box,a,b)));assert(p.box[0]>=5&&p.box[2]<=w-5&&p.box[1]>=0&&p.box[3]<=h-5);});
  const [a,b]=labels.map(p=>p.box);assert(a[2]+8<b[0]||a[0]-8>b[2]||a[3]+8<b[1]||a[1]-8>b[3]);cases++;
}
const angles=new Set();
for(let angle=0;angle<360;angle++){
  const draws=[Math.floor(angle/90)/4,0,0,((angle%90)+.5)/90],s=M.fresh(()=>draws.shift());
  angles.add(Math.round(M.scene(s).thetaA*180/Math.PI));
}
assert.equal(angles.size,360);
console.log(`Circular vector presentation: ${cases} crowded label layouts; all 360 fresh starting angles and local math glyphs passed.`);
