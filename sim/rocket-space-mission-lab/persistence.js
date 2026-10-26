(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./orbit.js'):root.RocketOrbit,node?require('./model.js'):root.RocketModel,node?require('./surface.js'):root.RocketSurface);if(node)module.exports=api;root.RocketPersistence=api;})(typeof window==='undefined'?globalThis:window,function(P,O,M,S){
  'use strict';
  const MAX_BYTES=4000,bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length,check=v=>{if(!v)throw Error('Invalid rocket snapshot');},integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
  const keys=(v,list)=>{check(v&&typeof v==='object'&&!Array.isArray(v));check(Object.keys(v).sort().join(',')===list.slice().sort().join(','));},tuple=(v,n)=>{check(Array.isArray(v)&&v.length===n);};
  function craft(c,variant,full=false){keys(c,['payload','stages','separator']);check(c.payload===variant&&Array.isArray(c.stages)&&[1,2].includes(c.stages.length)&&c.separator===(c.stages.length===2));c.stages.forEach(s=>{keys(s,s.order===undefined?['engine','small','large']:['engine','small','large','order']);check((s.engine===null||integer(s.engine,0,1))&&integer(s.small,0,4)&&integer(s.large,0,4)&&s.small+s.large<=4);if(s.order!==undefined){check(typeof s.order==='string'&&/^[sl]{1,4}$/.test(s.order)&&s.order.length===s.small+s.large&&[...s.order].filter(k=>k==='s').length===s.small&&s.order!=='l'.repeat(s.large)+'s'.repeat(s.small));}});if(full)check(P.complete(c));}

  function vector(q){tuple(q,6);check(q.every(v=>finite(v,-1.1e8,1.1e8))&&q[2]===0&&q[5]===0&&Math.hypot(q[0],q[1])>=P.R-.01&&Math.hypot(q[0],q[1])<=P.R+1e8+.01&&Math.hypot(q[3],q[4])<=30000);}
  function fuels(p,c,active,separated){tuple(p,2);check(integer(active,0,c.stages.length-1)&&typeof separated==='boolean'&&(separated?c.stages.length===2&&active===1:active===0));check(finite(p[0],0,P.capacity(c.stages[0])));if(c.stages.length===1)check(p[1]===null);else check(finite(p[1],0,P.capacity(c.stages[1])));if(separated)check(p[0]===0);}
  function base(a){craft(a.craft,0,true);fuels(a.fuel,a.craft,a.active,a.separated);vector(a.state);const o=O.elements(a.state);check(finite(a.t,0,604800)&&['pad','flying','impact','escaped'].includes(a.status)&&finite(a.maxHeight,0,1e8+.01)&&a.maxHeight>=o.height-.02);if(a.status==='impact')check(Math.abs(S.clearance(a.state,a.t))<.02);if(a.status==='escaped')check(o.height>=1e8-.02&&o.energy>=0);if(a.status==='pad')check(a.maxHeight<.01&&Math.abs(o.height)<.01);}
  function validate(s,kind='draft'){
    keys(s,kind==='review'?['schema','modelVersion','records']:['schema','modelVersion','variant','phase','backPhase','craft','flight','records']);check((kind==='review'?[2,3].includes(s.schema):s.schema===3)&&s.modelVersion===2);tuple(s.records,1);
    const r=s.records[0];if(r!==null){keys(r,['craft','state','fuel','active','separated','t','status','maxHeight','engineOff']);base(r);check(r.t>0&&r.status!=='pad'&&typeof r.engineOff==='boolean');}
    if(kind==='review')return s;
    check(s.variant===0&&M.PHASES.includes(s.phase)&&(s.phase==='check'?M.PHASES.includes(s.backPhase)&&s.backPhase!=='check':s.backPhase===null));craft(s.craft,0);const phase=s.phase==='check'?s.backPhase:s.phase,f=s.flight;
    if(f!==null){keys(f,['source','craft','t','state','fuel','active','separated','attitude','controls','status','maxHeight']);base(f);check(f.source==='own'&&finite(f.attitude,0,O.TAU));keys(f.controls,['mode','angle','throttle','lit']);check(['tilt','prograde','retrograde'].includes(f.controls.mode)&&finite(f.controls.angle,0,180)&&finite(f.controls.throttle,0,1)&&typeof f.controls.lit==='boolean');if(f.controls.lit)check(f.fuel[f.active]>0&&!['impact','escaped'].includes(f.status));}
    if(phase==='workshop')check(f===null);else check(f!==null);
    if(phase==='ended')check(['impact','escaped'].includes(f.status));else if(f)check(!['impact','escaped'].includes(f.status));if(phase==='pad')check(f.status==='pad');return s;
  }
  const encodeCraft=c=>[c.payload,c.stages.map(s=>s.order===undefined?[s.engine,s.small,s.large]:[s.engine,s.small,s.large,s.order])];
  function decodeCraft(a){tuple(a,2);check(Array.isArray(a[1]));return {payload:a[0],stages:a[1].map(t=>{check(Array.isArray(t)&&[3,4].includes(t.length));return {engine:t[0],small:t[1],large:t[2],...(t.length===4?{order:t[3]}:{})};}),separator:a[1].length===2};}
  const encodeVector=q=>[q[0],q[1],q[3],q[4]];
  function decodeVector(q){tuple(q,4);return [q[0],q[1],0,q[2],q[3],0];}

  const encodeRecord=r=>r&&[encodeCraft(r.craft),encodeVector(r.state),r.fuel,r.active,r.separated,r.t,r.status,r.maxHeight,r.engineOff];
  function decodeRecord(r){if(r===null)return null;tuple(r,9);return {craft:decodeCraft(r[0]),state:decodeVector(r[1]),fuel:r[2],active:r[3],separated:r[4],t:r[5],status:r[6],maxHeight:r[7],engineOff:r[8]};}
  function draft(s){validate(s);const f=s.flight;return [3,2,s.phase,s.backPhase,encodeCraft(s.craft),f&&[f.source,encodeCraft(f.craft),f.t,encodeVector(f.state),f.fuel,f.active,f.separated,f.attitude,[f.controls.mode,f.controls.angle,f.controls.throttle,f.controls.lit],f.status,f.maxHeight],encodeRecord(s.records[0])];}
  function review(s){const answer={schema:s.schema,modelVersion:s.modelVersion,records:s.records};validate(answer,'review');return [s.schema,2,encodeRecord(s.records[0])];}
  function decode(snapshot,kind){
    check(['draft','review'].includes(kind)&&snapshot?.version===1&&snapshot.activity===P.ACTIVITY&&snapshot.kind===kind&&bytes(snapshot)<=MAX_BYTES);const a=snapshot.answer;tuple(a,kind==='review'?3:7);check([2,3].includes(a[0])&&a[1]===2);let s;
    if(kind==='review')s={schema:a[0],modelVersion:2,records:[decodeRecord(a[2])]};else{const f=a[5];if(f!==null){tuple(f,11);tuple(f[8],4);}s={schema:3,modelVersion:2,variant:0,phase:a[2],backPhase:a[3],craft:decodeCraft(a[4]),flight:f&&{source:f[0],craft:decodeCraft(f[1]),t:f[2],state:decodeVector(f[3]),fuel:f[4],active:f[5],separated:f[6],attitude:f[7],controls:{mode:f[8][0],angle:f[8][1],throttle:f[8][2],lit:f[8][3]},status:f[9],maxHeight:f[10]},records:[decodeRecord(a[6])]};}
    validate(s,kind);return P.clone(s);
  }
  return Object.freeze({ACTIVITY:P.ACTIVITY,MAX_BYTES,bytes,validate,draft,review,decode});
});
