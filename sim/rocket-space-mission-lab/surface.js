(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./surface-data.js'):root.RocketSurfaceData);if(node)module.exports=api;root.RocketSurface=api;})(typeof window==='undefined'?globalThis:window,function(P,data){
 'use strict';
 const EARTH_DAY=86164.2,MAX_HEIGHT=3500,LAT=.605629,LON=-2.101376,sinLat=Math.sin(LAT),cosLat=Math.cos(LAT),sinLon=Math.sin(LON),cosLon=Math.cos(LON);
 function decode(value){const bytes=typeof Buffer==='function'?Uint8Array.from(Buffer.from(value,'base64')):Uint8Array.from(atob(value),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),out=new Uint16Array(bytes.length/2);for(let i=0;i<out.length;i++)out[i]=view.getUint16(i*2,true);return out;}
 const globe=decode(data.global),local=decode(data.local),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 function sample(grid,width,height,x,y,land=false){x=Math.max(0,Math.min(width-1,x));y=Math.max(0,Math.min(height-1,y));if(land)return Boolean(grid[Math.round(y)*width+Math.round(x)]&32768);const i=Math.min(width-2,Math.floor(x)),j=Math.min(height-2,Math.floor(y)),a=x-i,b=y-j;return (grid[j*width+i]&32767)*(1-a)*(1-b)+(grid[j*width+i+1]&32767)*a*(1-b)+(grid[(j+1)*width+i]&32767)*(1-a)*b+(grid[(j+1)*width+i+1]&32767)*a*b;}
 function geographic(e,u,n){const x=e*(-sinLon)+u*cosLat*cosLon-n*sinLat*cosLon,y=u*sinLat+n*cosLat,z=e*cosLon+u*cosLat*sinLon-n*sinLat*sinLon;return [Math.atan2(z,x)*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,y)))*180/Math.PI];}
 function sampleAt(e,u,n,land=false){
  const [lon,lat]=geographic(e,u,n),x=(lon+180)/360*(data.width-1),y=(90-lat)/180*(data.height-1),globalLand=sample(globe,data.width,data.height,x,y,true),global=land?globalLand:globalLand?sample(globe,data.width,data.height,x,y):0,extent=Math.max(Math.abs(e),Math.abs(n))*P.R;
  if(u<=0||extent>=data.extent)return global;
  const lx=(e*P.R/data.extent+1)*(data.localSize-1)/2,ly=(1-n*P.R/data.extent)*(data.localSize-1)/2,nearLand=sample(local,data.localSize,data.localSize,lx,ly,true),isLand=extent<211200?nearLand:globalLand;
  if(land)return isLand;if(!isLand)return 0;
  const nearby=nearLand?sample(local,data.localSize,data.localSize,lx,ly):0,weight=1-smooth(211200,239500,extent);return global*(1-weight)+nearby*weight;
 }
 function direction(q,t=0){const theta=Math.atan2(q[1],q[0]),spin=t%EARTH_DAY/EARTH_DAY*Math.PI*2,s=Math.sin(theta);return [s*Math.cos(spin),Math.cos(theta),s*Math.sin(spin)];}
 const heightAt=(e,u,n)=>sampleAt(e,u,n),waterAt=(e,u,n)=>!sampleAt(e,u,n,true),height=(q,t=0)=>heightAt(...direction(q,t)),radius=(q,t=0)=>P.R+height(q,t),clearance=(q,t=0)=>Math.hypot(q[0],q[1])-radius(q,t),isWater=(q,t=0)=>waterAt(...direction(q,t));
 return Object.freeze({EARTH_DAY,MAX_HEIGHT,direction,geographic,heightAt,waterAt,height,radius,clearance,isWater});
});
