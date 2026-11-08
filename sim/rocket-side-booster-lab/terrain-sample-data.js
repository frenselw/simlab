(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerrainSampleData=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 function decode(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<16||buffer.byteLength>4*1024*1024)throw Error('Invalid terrain sample size');
  const length=new DataView(buffer).getUint32(0,true);if(length>10000||length+4>=buffer.byteLength)throw Error('Invalid terrain header');
  const h=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),start=4+Math.ceil(length/4)*4,n=h.gridSize;
  if(h.version!==1||!Number.isInteger(n)||n<16||n>1025||h.spanMetres!==40000||h.heightScale!==.1||h.heightBytes!==n*n*2||h.densityBytes!==n*n||h.levels?.length!==3)throw Error('Unsupported terrain sample');
  const heights=new Uint16Array(buffer,start,n*n),density=new Uint8Array(buffer,start+h.heightBytes,n*n);let end=Math.ceil((h.heightBytes+h.densityBytes)/4)*4;
  const levels=h.levels.map(level=>{
   if(level.offset!==end||!Number.isInteger(level.vertices)||level.vertices<3||level.vertices>18000||!Number.isInteger(level.indices)||level.indices%3||level.indices<3)throw Error('Invalid terrain mesh');
   end+=level.vertices*36+level.indices*4;if(start+end>buffer.byteLength)throw Error('Truncated terrain mesh');
   const vertices=new Float32Array(buffer,start+level.offset,level.vertices*9),indices=new Uint32Array(buffer,start+level.offset+level.vertices*36,level.indices);
   if(!vertices.every(Number.isFinite)||!indices.every(i=>i<level.vertices))throw Error('Invalid terrain vertices');return {vertices,indices};
  });
  if(h.standsOffset!==end||!Number.isInteger(h.stands)||h.stands<0||h.stands>512||start+end+h.stands*32!==buffer.byteLength)throw Error('Invalid woodland data');
  const stands=new Float32Array(buffer,start+end,h.stands*8);if(!stands.every(Number.isFinite))throw Error('Invalid woodland coordinates');
  function sample(grid,x,z,scale){
   if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Invalid terrain position');
   const u=Math.max(0,Math.min(n-1,(x/h.spanMetres+.5)*(n-1))),v=Math.max(0,Math.min(n-1,(.5-z/h.spanMetres)*(n-1))),i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j;
   return (grid[j*n+i]*(1-a)*(1-b)+grid[j*n+i+1]*a*(1-b)+grid[(j+1)*n+i]*(1-a)*b+grid[(j+1)*n+i+1]*a*b)*scale;
  }
  const heightAt=(x,z)=>sample(heights,x,z,h.heightScale),densityAt=(x,z)=>sample(density,x,z,1/255);
  function gridGroundAt(x,z){
   const step=h.spanMetres/(n-1),u=Math.max(0,Math.min(n-1,(x/h.spanMetres+.5)*(n-1))),v=Math.max(0,Math.min(n-1,(z/h.spanMetres+.5)*(n-1))),i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j,px=-h.spanMetres/2+i*step,pz=-h.spanMetres/2+j*step,A=heightAt(px,pz),B=heightAt(px+step,pz),C=heightAt(px,pz+step),D=heightAt(px+step,pz+step);
   return a+b<=1?[A*(1-a-b)+B*a+C*b,(B-A)/step,(C-A)/step]:[D*(a+b-1)+B*(1-b)+C*(1-a),(D-C)/step,(D-B)/step];
  }
  const bins=new Map(),fine=levels[2],stride=9;
  for(let i=0;i<fine.indices.length;i+=3){const ids=[0,1,2].map(k=>fine.indices[i+k]*stride),xs=ids.map(k=>fine.vertices[k]),zs=ids.map(k=>fine.vertices[k+2]);for(let y=Math.floor(Math.min(...zs)/1000);y<=Math.floor(Math.max(...zs)/1000);y++)for(let x=Math.floor(Math.min(...xs)/1000);x<=Math.floor(Math.max(...xs)/1000);x++){const key=x+':'+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);}}
  function groundAt(x,z){
   for(const index of bins.get(Math.floor(x/1000)+':'+Math.floor(z/1000))||[]){const v=fine.vertices,ids=[0,1,2].map(k=>fine.indices[index+k]*stride),[a,b,c]=ids,d=(v[b+2]-v[c+2])*(v[a]-v[c])+(v[c]-v[b])*(v[a+2]-v[c+2]);if(Math.abs(d)<1e-9)continue;
    const u=((v[b+2]-v[c+2])*(x-v[c])+(v[c]-v[b])*(z-v[c+2]))/d,w=((v[c+2]-v[a+2])*(x-v[c])+(v[a]-v[c])*(z-v[c+2]))/d;
    if(u>=-1e-6&&w>=-1e-6&&u+w<=1+1e-6){const sx=((v[b+1]-v[a+1])*(v[c+2]-v[a+2])-(v[c+1]-v[a+1])*(v[b+2]-v[a+2]))/((v[b]-v[a])*(v[c+2]-v[a+2])-(v[c]-v[a])*(v[b+2]-v[a+2])),sz=((v[b]-v[a])*(v[c+1]-v[a+1])-(v[c]-v[a])*(v[b+1]-v[a+1]))/((v[b]-v[a])*(v[c+2]-v[a+2])-(v[c]-v[a])*(v[b+2]-v[a+2]));return [u*v[a+1]+w*v[b+1]+(1-u-w)*v[c+1],sx,sz];}
   }return [heightAt(x,z),...slopeAt(x,z)];
  }
  function slopeAt(x,z){return [(heightAt(x+80,z)-heightAt(x-80,z))/160,(heightAt(x,z+80)-heightAt(x,z-80))/160];}
  function treesAt(cx,cz){
   let state=(Math.imul(cx+731,73856093)^Math.imul(cz+19,19349663))>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},rows=[];
   for(let i=0;i<240&&rows.length<96;i++){
    const x=(cx+random())*500,z=(cz+random())*500,chance=random(),size=10+random()*12,rotation=random()*Math.PI*2;
    if(Math.abs(x)>h.spanMetres/2-150||Math.abs(z)>h.spanMetres/2-150||chance>densityAt(x,z)||rows.some(r=>(r[0]-x)**2+(r[2]-z)**2<14**2)||Math.hypot(...slopeAt(x,z))>.65)continue;
    rows.push([x,heightAt(x,z),z,size,rotation]);
   }return rows;
  }
  return {header:h,heights,density,levels,stands,heightAt,densityAt,slopeAt,groundAt,gridGroundAt,treesAt};
 }
 return {decode};
});
