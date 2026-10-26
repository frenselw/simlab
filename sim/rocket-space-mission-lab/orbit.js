(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./parts.js'):root.RocketParts);if(typeof module==='object'&&module.exports)module.exports=api;root.RocketOrbit=api;})(typeof window==='undefined'?globalThis:window,function(P){
  'use strict';
  const TAU=2*Math.PI,wrap=a=>(a%TAU+TAU)%TAU;
  function elements(q){
    const [x,y,,vx,vy]=q,r=Math.hypot(x,y),speed=Math.hypot(vx,vy),momentum=x*vy-y*vx,energy=speed*speed/2-P.MU/r;
    const ex=vy*momentum/P.MU-x/r,ey=-vx*momentum/P.MU-y/r,e=Math.hypot(ex,ey),bound=energy<-1e-8,a=bound?-P.MU/(2*energy):null;
    return {r,height:r-P.R,speed,tangential:momentum/r,radial:(x*vx+y*vy)/r,energy,momentum,e,a,hp:bound?a*(1-e)-P.R:null,ha:bound?a*(1+e)-P.R:null,period:bound?TAU*Math.sqrt(a**3/P.MU):null,peri:Math.atan2(ey,ex),bound};
  }
  function safe(q){const o=elements(q);return o.bound&&o.hp>=150000-1;}
  function operable(q){const o=elements(q);return o.bound&&o.hp>=150000-1&&o.ha<=20000000;}
  function atAngle(o,angle){const radius=o.a*(1-o.e*o.e)/(1+o.e*Math.cos(angle-o.peri));return [radius*Math.cos(angle),radius*Math.sin(angle),0];}
  function path(q,count=180){const o=elements(q);if(Math.abs(o.momentum)<1)return [];if(o.bound&&o.e<.99999)return Array.from({length:count+1},(_,i)=>atAngle(o,TAU*i/count));if(o.bound)return [];const p=o.momentum**2/P.MU,nu=Math.atan2(Math.sin(Math.atan2(q[1],q[0])-o.peri),Math.cos(Math.atan2(q[1],q[0])-o.peri)),limit=Math.acos(Math.max(-1,Math.min(1,(p/(P.R+1e8)-1)/o.e))),end=Math.sign(o.momentum)*limit,points=[];for(let i=0;i<=count;i++){const angle=nu+(end-nu)*i/count,r=p/(1+o.e*Math.cos(angle));if(!Number.isFinite(r)||r<=0)break;points.push([r*Math.cos(angle+o.peri),r*Math.sin(angle+o.peri),0]);if(r<P.R)break;}return points;}
  function timeToAngle(q,angle){
    const o=elements(q);if(!o.bound||Math.abs(o.momentum)<1)return null;
    const meanAt=a=>{const nu=wrap(a-o.peri),E=2*Math.atan2(Math.sqrt(1-o.e)*Math.sin(nu/2),Math.sqrt(1+o.e)*Math.cos(nu/2));return wrap(E-o.e*Math.sin(E));};
    const raw=wrap(Math.sign(o.momentum)*(meanAt(angle)-meanAt(Math.atan2(q[1],q[0])))),delta=raw<1e-10||TAU-raw<1e-10?0:raw;return delta/TAU*o.period;
  }
  function node(q,at,angle){const o=elements(q);if(!operable(q))return null;const a=o.e<.002?angle:at==='periapsis'?o.peri:at==='apoapsis'?o.peri+Math.PI:angle;return {angle:wrap(a),delay:timeToAngle(q,a)};}
  function circular(height){const r=P.R+height;return [r,0,0,0,Math.sqrt(P.MU/r),0];}
  return Object.freeze({TAU,wrap,elements,safe,operable,atAngle,path,timeToAngle,node,circular});
});
