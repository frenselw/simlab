(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RocketParts=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const ACTIVITY='rocket-launch-orbit-lab-v2',R=6371000,MU=3.986004418e14,G0=9.80665;
  const PAYLOADS=[150];
  const ENGINES=[{name:'大推力引擎',dry:500,thrust:600000,isp:300,color:'#ee895c'},{name:'高效率引擎',dry:150,thrust:80000,isp:340,color:'#50b5ad'}];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const emptyStage=()=>({engine:null,small:0,large:0});
  const emptyCraft=variant=>({payload:variant,stages:[emptyStage()],separator:false});
  const tanks=s=>s.order?s.order.split('').map(k=>k==='s'?'small':'large'):[...Array(s.large).fill('large'),...Array(s.small).fill('small')];
  function setTanks(s,list){s.small=list.filter(k=>k==='small').length;s.large=list.length-s.small;const order=list.map(k=>k==='small'?'s':'l').join('');if(order==='l'.repeat(s.large)+'s'.repeat(s.small))delete s.order;else s.order=order;}
  const capacity=s=>1500*s.small+6000*s.large;
  const dry=s=>100*s.small+400*s.large+(ENGINES[s.engine]?.dry||0);
  const complete=c=>c.stages.length>0&&c.stages.every(s=>s.engine!==null&&s.small+s.large>0)&&c.separator===(c.stages.length===2);
  function canFit(c,stage,part){const s=c.stages[stage];if(part==='separator')return stage===0&&c.stages.length===1&&complete(c);return Boolean(s&&(['engine-0','engine-1'].includes(part)?s.engine===null:['small','large'].includes(part)&&s.small+s.large<4));}
  function mass(f,fuel=f.fuel){return PAYLOADS[f.craft.payload]+f.craft.stages.reduce((sum,s,i)=>sum+(f.separated&&i===0?0:dry(s)+(fuel[i]||0)),0)+(f.craft.separator&&!f.separated?60:0);}
  function twr(c){if(!complete(c))return 0;const f={craft:c,fuel:c.stages.map(capacity),separated:false};return ENGINES[c.stages[0].engine].thrust/(mass(f)*MU/R**2);}
  return Object.freeze({ACTIVITY,R,MU,G0,PAYLOADS,ENGINES,clone,emptyStage,emptyCraft,tanks,setTanks,capacity,dry,complete,canFit,mass,twr});
});
