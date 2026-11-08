(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./surface-data.js'):root.RocketSurfaceData,node?file=>require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,file))):null,node?null:document.currentScript.src);if(node)module.exports=api;root.RocketSurface=api;})(typeof window==='undefined'?globalThis:window,function(P,data,read,base){
 'use strict';
 const MAX_HEIGHT=5000,LAT=.605629,LON=-2.101376,sinLat=Math.sin(LAT),cosLat=Math.cos(LAT),sinLon=Math.sin(LON),cosLon=Math.cos(LON);
 function decode(value){const bytes=typeof Buffer==='function'?Uint8Array.from(Buffer.from(value,'base64')):Uint8Array.from(atob(value),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),out=new Uint16Array(bytes.length/2);for(let i=0;i<out.length;i++)out[i]=view.getUint16(i*2,true);return out;}
 const globe=decode(data.global),local=decode(data.local),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 let fine=null,pending=null;
 function installRegion(bytes){if(bytes.byteLength!==data.fine.size**2*2)throw Error('Invalid regional height length');const view=new DataView(bytes.buffer,bytes.byteOffset||0,bytes.byteLength),grid=new Uint16Array(data.fine.size**2);for(let i=0;i<grid.length;i++){const v=view.getUint16(i*2,true);if(v>MAX_HEIGHT*10+1)throw Error('Invalid regional height');grid[i]=v;}fine=grid;}
 if(read&&data.fine)installRegion(read(data.fine.file));
 function ready(){if(fine||!data.fine)return Promise.resolve();return pending||(pending=(async()=>{const response=await fetch(new URL(data.fine.file,base));if(!response.ok)throw Error('Regional heights unavailable');const stream=response.body.pipeThrough(new DecompressionStream('gzip'));installRegion(new Uint8Array(await new Response(stream).arrayBuffer()));})());}
 function region(x,y,land){const size=data.fine.size;x=Math.max(0,Math.min(size-1,x));y=Math.max(0,Math.min(size-1,y));if(land)return fine[Math.round(y)*size+Math.round(x)]>0;const i=Math.min(size-2,Math.floor(x)),j=Math.min(size-2,Math.floor(y)),a=x-i,b=y-j,h=(dx,dy)=>Math.max(0,fine[(j+dy)*size+i+dx]-1)*.1;return a+b<=1?h(0,0)*(1-a-b)+h(1,0)*a+h(0,1)*b:h(1,1)*(a+b-1)+h(1,0)*(1-b)+h(0,1)*(1-a);}
 function sample(grid,width,height,x,y,land=false){x=Math.max(0,Math.min(width-1,x));y=Math.max(0,Math.min(height-1,y));if(land)return Boolean(grid[Math.round(y)*width+Math.round(x)]&32768);const i=Math.min(width-2,Math.floor(x)),j=Math.min(height-2,Math.floor(y)),a=x-i,b=y-j;return (grid[j*width+i]&32767)*(1-a)*(1-b)+(grid[j*width+i+1]&32767)*a*(1-b)+(grid[(j+1)*width+i]&32767)*(1-a)*b+(grid[(j+1)*width+i+1]&32767)*a*b;}
 function geographic(e,u,n){const x=e*(-sinLon)+u*cosLat*cosLon-n*sinLat*cosLon,y=u*sinLat+n*cosLat,z=e*cosLon+u*cosLat*sinLon-n*sinLat*sinLon;return [Math.atan2(z,x)*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,y)))*180/Math.PI];}
 function sampleAt(e,u,n,land=false){
  const [lon,lat]=geographic(e,u,n),x=(lon+180)/360*(data.width-1),y=(90-lat)/180*(data.height-1),globalLand=sample(globe,data.width,data.height,x,y,true),global=globalLand?sample(globe,data.width,data.height,x,y):0,extent=Math.pow(Math.abs(e)**8+Math.abs(n)**8,1/8)*P.R;
  if(u<=0||extent>=239500)return land?globalLand:global;
  const size=fine?data.fine.size:data.localSize,lx=(e*P.R/data.extent+1)*(size-1)/2,ly=(1-n*P.R/data.extent)*(size-1)/2,nearLand=fine?region(lx,ly,true):sample(local,size,size,lx,ly,true),weight=1-smooth(175000,239500,extent);
  if(land)return weight===1?nearLand:nearLand||globalLand;
  const nearby=nearLand?(fine?region(lx,ly,false):sample(local,size,size,lx,ly)):0;return global*(1-weight)+nearby*weight;
 }
 function noise(x,y){const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);},i=Math.floor(x),j=Math.floor(y),a=smooth(0,1,x-i),b=smooth(0,1,y-j);return hash(i,j)*(1-a)*(1-b)+hash(i+1,j)*a*(1-b)+hash(i,j+1)*(1-a)*b+hash(i+1,j+1)*a*b;}
 function forestAt(e,u,n,h=heightAt(e,u,n)){
  const lat=geographic(e,u,n)[1],moisture=.28+.6*noise(e*P.R/13000+31.4,n*P.R/13000-17.8)+.2*noise(e*P.R/3100-7.3,n*P.R/3100+11.2);
  return Math.max(0,Math.min(1,(moisture-.30)*1.8))*(1-smooth(1450,2600,h))*(1-smooth(57,73,Math.abs(lat)));
 }
 function colorAt(e,u,n){
  const h=heightAt(e,u,n),lat=Math.abs(geographic(e,u,n)[1]),forest=forestAt(e,u,n,h),dry=(1-smooth(.15,.45,forest))*(1-smooth(45,65,lat)),rock=smooth(1100,2500,h)*.65,cold=smooth(65,78,lat);
  return [.24,.37,.22].map((v,k)=>{v=v*(1-forest*.6)+[.075,.19,.12][k]*forest*.6;v=v*(1-dry*.4)+[.43,.37,.25][k]*dry*.4;v=v*(1-rock)+[.34,.32,.26][k]*rock;return v*(1-cold)+[.76,.81,.72][k]*cold;});
 }
 // shortcut: fixed Earth matches the planar flight model; add launch, air and ground rotation together for a rotating model.
 function direction(q){const r=Math.hypot(q[0],q[1],q[2]||0);return [q[1]/r,q[0]/r,(q[2]||0)/r];}
 const heightAt=(e,u,n)=>sampleAt(e,u,n),waterAt=(e,u,n)=>!sampleAt(e,u,n,true),height=(q,t=0)=>heightAt(...direction(q,t)),radius=(q,t=0)=>P.R+height(q,t),clearance=(q,t=0)=>Math.hypot(q[0],q[1],q[2]||0)-radius(q,t),isWater=(q,t=0)=>waterAt(...direction(q,t));
 return Object.freeze({MAX_HEIGHT,ready,direction,geographic,heightAt,waterAt,forestAt,colorAt,height,radius,clearance,isWater});
});
