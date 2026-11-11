(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./surface.js'):root.RocketSurface);if(node)module.exports=api;else root.RocketSky=api;})(typeof window==='undefined'?globalThis:window,function(S){
  'use strict';
  const START=Date.UTC(2026,0,1),YEAR_END=Date.UTC(2027,0,1),DEFAULT_START=Date.UTC(2026,2,20,20);
  const STEP=21600000,COUNT=1489,DEG=Math.PI/180,DAY=86400000;
  const unit=v=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
  const delta=(a,b)=>a.map((x,i)=>x-b[i]);
  const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);

  function departure(date,time){
    if(!/^2026-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
    const iso=date+'T'+time,utc=Date.parse(iso+':00Z');
    return Number.isFinite(utc)&&utc>=START&&utc<YEAR_END&&new Date(utc).toISOString().slice(0,16)===iso?utc:null;
  }

  function validate(data){
    if(data?.start!==START||data.step!==STEP)throw Error('Invalid ephemeris time grid');
    for(const [series,min,max]of [[data.sun,145e6,155e6],[data.moon,340000,420000]]){
      if(!Array.isArray(series)||series.length!==COUNT*3||!series.every(Number.isInteger))throw Error('Invalid ephemeris vectors');
      for(let i=0;i<series.length;i+=3){
        const range=Math.hypot(series[i],series[i+1],series[i+2]);
        if(range<min||range>max)throw Error('Invalid ephemeris distance');
      }
    }
    return data;
  }

  function sidereal(utc){
    // USNO approximate sidereal time, with UTC in place of UT1.
    const day=utc/DAY-10957.5,midnight=Math.floor(day+.5)-.5,hours=(day-midnight)*24;
    const mean=6.697375+.065709824279*midnight+1.0027379*hours+.0000258*(day/36525)**2;
    const nutation=(-.000319*Math.sin((125.04-.052954*day)*DEG)-.000024*Math.sin(2*(280.47+.98565*day)*DEG))*Math.cos((23.4393-.0000004*day)*DEG);
    return ((mean+nutation)%24)*15*DEG;
  }

  function at(data,utc){
    const index=(utc-START)/STEP;
    if(!data||!Number.isFinite(index)||index<0||index>COUNT-1)return null;
    const lo=Math.min(COUNT-2,Math.floor(index)),fraction=index-lo,angle=sidereal(utc),c=Math.cos(angle),s=Math.sin(angle);
    function body(series){
      const [x,y,z]=[0,1,2].map(i=>series[3*lo+i]+fraction*(series[3*(lo+1)+i]-series[3*lo+i]));
      return S.fromGeocentric(c*x+s*y,-s*x+c*y,z);
    }
    return {sun:body(data.sun),moon:body(data.moon),angle};
  }

  function observe(frame,observer){
    const toSun=delta(frame.sun,observer),toMoon=delta(frame.moon,observer),sun=unit(toSun),moon=unit(toMoon),moonLight=unit(delta(frame.sun,frame.moon));
    return {sun,moon,moonLight,sunRadius:695700/Math.hypot(...toSun),moonRadius:1737.4/Math.hypot(...toMoon),phase:(1-dot(moon,moonLight))/2};
  }

  return Object.freeze({DEFAULT_START,departure,validate,at,observe});
});
