(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RocketParts=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const R=6371000,MU=3.986004418e14,G0=9.80665;
  const PAYLOADS=[150],CORE_DRAG_AREA=.35*3.14;
  const ENGINES=[{name:'大推力引擎',dry:500,thrust:600000,isp:300,color:'#ee895c'},{name:'高效率引擎',dry:150,thrust:80000,isp:340,color:'#50b5ad'},{name:'均衡型引擎',dry:250,thrust:250000,isp:320,color:'#6488bd'}];
  const BOOSTER=Object.freeze({thrust:120000,dry:300,fuel:3000,isp:250});
  const boosterMounts=count=>[[-1,0],[1,0],[0,-1],[0,1]].slice(0,count||0);
  const attached=f=>f.boosters&&f.boosters.status!=='jettisoned',burning=f=>attached(f)&&f.boosters.status==='burning';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const emptyStage=()=>({engine:null,small:0,large:0});
  const emptyCraft=variant=>({payload:variant,stages:[emptyStage()],separator:false,capsule:false});
  const tanks=s=>s.order?s.order.split('').map(k=>({s:'small',m:'medium',l:'large'})[k]):[...Array(s.large).fill('large'),...Array(s.medium||0).fill('medium'),...Array(s.small).fill('small')];
  function setTanks(s,list){s.small=list.filter(k=>k==='small').length;s.medium=list.filter(k=>k==='medium').length;s.large=list.filter(k=>k==='large').length;if(!s.medium)delete s.medium;const order=list.map(k=>({small:'s',medium:'m',large:'l'})[k]).join('');if(order==='l'.repeat(s.large)+'m'.repeat(s.medium||0)+'s'.repeat(s.small))delete s.order;else s.order=order;}
  const capacity=s=>1500*s.small+3000*(s.medium||0)+6000*s.large;
  const dry=s=>100*s.small+200*(s.medium||0)+400*s.large+(ENGINES[s.engine]?.dry||0);
  const hasCapsule=c=>c.capsule!==false,stageComplete=s=>s.engine!==null&&s.small+(s.medium||0)+s.large>0;
  const bodyComplete=c=>c.stages.length>0&&c.stages.every(stageComplete)&&c.separator===(c.stages.length===2);
  const complete=c=>bodyComplete(c)&&hasCapsule(c);
  function canFit(c,stage,part){const s=c.stages[stage];if(part==='boosters')return stage===0&&(c.boosters||0)<4&&stageComplete(c.stages[0]);if(part==='capsule')return stage===c.stages.length-1&&bodyComplete(c)&&!hasCapsule(c);if(part==='separator')return stage===0&&c.stages.length===1&&stageComplete(c.stages[0])&&!hasCapsule(c);return Boolean(s&&(['engine-0','engine-1','engine-2'].includes(part)?s.engine===null:['small','medium','large'].includes(part)&&s.engine!==null&&!hasCapsule(c)&&s.small+(s.medium||0)+s.large<4));}
  function mass(f,fuel=f.fuel){if(f.capsule?.detached)return 180+f.capsule.fuel;return (hasCapsule(f.craft)?(f.capsule?180+f.capsule.fuel:PAYLOADS[f.craft.payload]):0)+f.craft.stages.reduce((sum,s,i)=>sum+(f.separated&&i===0?0:dry(s)+(fuel[i]||0)),0)+(f.craft.separator&&!f.separated?60:0)+(attached(f)?f.craft.boosters*(BOOSTER.dry+f.boosters.fuel):0);}
  function twr(c){if(!complete(c))return 0;const f={capsule:{fuel:30},craft:c,fuel:c.stages.map(capacity),separated:false,boosters:c.boosters?{status:'ready',fuel:BOOSTER.fuel}:null};return (ENGINES[c.stages[0].engine].thrust+(c.boosters||0)*BOOSTER.thrust)/(mass(f)*MU/R**2);}
  return Object.freeze({BOOSTER,boosterMounts,attached,burning,R,MU,G0,PAYLOADS,CORE_DRAG_AREA,ENGINES,clone,emptyStage,emptyCraft,tanks,setTanks,capacity,dry,hasCapsule,stageComplete,bodyComplete,complete,canFit,mass,twr});
});
