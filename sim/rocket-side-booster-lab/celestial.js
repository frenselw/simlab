(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RocketCelestial=api;
})(globalThis,function(){
  'use strict';
  const DAY=86400,STEP=21600,COUNT=1545,START_JD=2461041.5;
  const EPOCH=Date.UTC(2026,0,1),MAX_TIME=(COUNT-1)*STEP,PACKED_BYTES=COUNT*2*24;
  const EARTH=3.986004418e14,MOON=4.902800118e12,SUN=1.32712440041279419e20;
  const MOON_RADIUS=1737400,OMEGA=7.2921158553e-5,DEG=Math.PI/180;
  const norm=a=>Math.hypot(...a),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const scale=(a,k)=>a.map(v=>v*k),add=(a,b,k=1)=>a.map((v,i)=>v+k*b[i]);
  const unit=a=>{const m=norm(a);return m>0?scale(a,1/m):[0,0,0];};
  const fromColumns=(columns,v)=>columns[0].map((_,i)=>columns[0][i]*v[0]+columns[1][i]*v[1]+columns[2][i]*v[2]);
  const toColumns=(columns,v)=>columns.map(axis=>dot(axis,v));
  const rz=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a),v[2]];
  const ry=(v,a)=>[v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)];
  function ttMinusTdb(t){
    const anomaly=(357.53+.9856003*(START_JD-2451545+t/DAY))*DEG;
    return -.001657*Math.sin(anomaly)-.000022*Math.sin(2*anomaly);
  }
  const utcSeconds=t=>t+ttMinusTdb(t)-69.184;
  const utc=t=>EPOCH+1000*utcSeconds(t);
  function earthFrame(t){
    // IAU 1976 mean precession and GMST, with UT1 approximated by UTC for 2026.
    const ut=START_JD-2451545+utcSeconds(t)/DAY,tt=(START_JD-2451545+(t+ttMinusTdb(t))/DAY)/36525;
    const zeta=(2306.2181+(.30188+.017998*tt)*tt)*tt*DEG/3600;
    const z=(2306.2181+(1.09468+.018203*tt)*tt)*tt*DEG/3600;
    const theta=(2004.3109-(.42665+.041833*tt)*tt)*tt*DEG/3600;
    const gmst=((280.46061837+360.98564736629*ut+.000387933*tt*tt-tt**3/38710000)%360)*DEG;
    return [[1,0,0],[0,1,0],[0,0,1]].map(v=>rz(ry(rz(v,gmst-z),theta),-zeta));
  }
  const spin=(pole,r)=>scale(cross(pole,r),OMEGA);
  function ephemeris(buffer){
    if(buffer.byteLength!==PACKED_BYTES)throw Error('Invalid geometric ephemeris length');
    const bytes=new DataView(buffer),samples=new Float64Array(COUNT*12);
    for(let i=0;i<samples.length;i++){
      const position=i%6<3, divisor=position?(i<COUNT*6?1:100):.0001;
      samples[i]=bytes.getInt32(i*4,true)*divisor;
    }
    for(let i=0;i<COUNT*12;i+=6){
      const moon=i<COUNT*6,range=Math.hypot(samples[i],samples[i+1],samples[i+2]);
      if(range<(moon?340e6:145e9)||range>(moon?420e6:155e9))throw Error('Invalid geometric position');
      const speed=Math.hypot(samples[i+3],samples[i+4],samples[i+5]);
      if(speed>(moon?2000:40000))throw Error('Invalid geometric velocity');
    }
    function body(t,index){
      if(!Number.isFinite(t)||t<0||t>MAX_TIME)throw RangeError('Outside geometric ephemeris');
      const i=Math.min(COUNT-2,Math.floor(t/STEP)),u=t/STEP-i,k=(index*COUNT+i)*6;
      const result=new Array(6);
      for(let axis=0;axis<3;axis++){
        const a=samples[k+axis],d=samples[k+6+axis]-a;
        const v=samples[k+3+axis],w=samples[k+9+axis];
        result[axis]=a+u*u*(3-2*u)*d+STEP*u*(1-u)*((1-u)*v-u*w);
        result[axis+3]=6*u*(1-u)/STEP*d+(1-u)*(1-3*u)*v+u*(3*u-2)*w;
      }
      return result;
    }
    return Object.freeze({body});
  }
  const attraction=(r,mu)=>scale(r,mu/norm(r)**3);
  const tidal=(r,b,mu)=>add(attraction(add(b,r,-1),mu),attraction(b,mu),-1);
  function gravity(table,t,r){
    const moon=tidal(r,table.body(t,0).slice(0,3),MOON);
    const sun=tidal(r,table.body(t,1).slice(0,3),SUN);
    return add(add(attraction(r,-EARTH),moon),sun);
  }
  function rk4(fn,t,q,h){
    const a=fn(t,q),b=fn(t+h/2,add(q,a,h/2)),c=fn(t+h/2,add(q,b,h/2)),d=fn(t+h,add(q,c,h));
    return q.map((v,i)=>v+h/6*(a[i]+2*b[i]+2*c[i]+d[i]));
  }
  return Object.freeze({DAY,MAX_TIME,MOON_RADIUS,PACKED_BYTES,DEG,norm,dot,cross,scale,add,unit,fromColumns,toColumns,
    utc,earthFrame,spin,ephemeris,gravity,rk4});
});
