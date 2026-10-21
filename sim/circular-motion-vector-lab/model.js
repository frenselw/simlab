(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CircularVectorModel=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const ACTIVITY='circular-motion-vector-lab',RADIUS=.5,SPEED=.5;
  const GAP_KEYS=['positionGapDeg','velocityGapDeg','transferGapDeg'];
  const DIRECTIONS=['forward-tangent','backward-tangent','inward','outward'];
  const NODES=['S','U','V'];
  const QUESTIONS=[
    {id:'V1',field:'velocityDirection',task:0,type:'direction',points:15,correct:'forward-tangent',title:'根據觀察，A 點的瞬時速度應指向哪裡？'},
    {id:'V2',field:'velocityReason',task:0,type:'reason',points:10,correct:'displacement-per-time',title:'把 B 逐漸移近 A，以下哪句描述正確？',options:[['displacement-per-time','位移方向會越來越接近 A 點的瞬時速度方向。'],['finite-equals-instant','任何時間間隔的位移方向，都完全等於 A 點的瞬時速度方向。'],['arc-is-displacement','應看圓弧的彎曲方向，因為 A 到 B 的圓弧就是位移。']]},
    {id:'A1',field:'accelerationDirection',task:1,type:'direction',points:15,correct:'inward',title:'根據縮短時間後的觀察，A 點的瞬時加速度應指向哪裡？'},
    {id:'A2',field:'accelerationReason',task:1,type:'reason',points:10,correct:'velocity-change-per-time',title:'縮短時間間隔後，可以怎樣利用正確的速度變化量？',options:[['velocity-change-per-time','時間越短，正確 Δv 的方向越接近 A 點的瞬時加速度方向。'],['finite-equals-instant','任何時間間隔的 Δv 方向，都完全等於 A 點的瞬時加速度方向。'],['vanishing-change-zero-acceleration','Δv 越短，便代表 A 點的瞬時加速度越接近零。']]},
    {id:'T1',field:'transferVelocity',task:2,type:'direction',points:10,correct:'forward-tangent',title:'換了位置與轉向，A 點的瞬時速度應指向哪裡？'},
    {id:'T2',field:'transferAcceleration',task:2,type:'direction',points:10,correct:'inward',title:'這次 A 點的瞬時加速度應指向哪裡？'},
    {id:'T3',field:'transferReason',task:2,type:'reason',points:10,correct:'direction-changes',title:'物體的速率保持不變，為甚麼仍然有加速度？',options:[['direction-changes','速度方向持續改變，所以速度仍在改變。'],['speed-only','只要速率不變，速度就沒有變化。'],['motion-direction','物體繼續前進，所以加速度必定沿前進方向。']]}
  ];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  const length=v=>Math.hypot(...v);
  const scale=(v,k)=>v.map(n=>n*k);
  function draw(random,n){const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Invalid random draw');return Math.floor(x*n);}
  function fresh(random=Math.random){
    return {schemaVersion:1,modelVersion:1,rubricVersion:1,definition:{startIndex:draw(random,4),sense:draw(random,2)?1:-1,choiceShift:draw(random,4),startOffsetDeg:draw(random,90)},phase:'edit',task:0,
      observation:{positionGapDeg:60,velocityGapDeg:60,transferGapDeg:45},
      answers:{...Object.fromEntries(QUESTIONS.map(q=>[q.field,null])),deltaFrom:null,deltaTo:null}};
  }
  function scene(state,task=state.task,gap=state.observation[GAP_KEYS[task]]){
    const thetaA=(state.definition.startIndex*90+(state.definition.startOffsetDeg??0))*Math.PI/180+(task===2?Math.PI/4:0),sense=state.definition.sense*(task===2?-1:1),delta=gap*Math.PI/180,thetaB=thetaA+sense*delta;
    const position=t=>[RADIUS*Math.cos(t),RADIUS*Math.sin(t)],velocity=t=>[-sense*SPEED*Math.sin(t),sense*SPEED*Math.cos(t)];
    const rA=position(thetaA),rB=position(thetaB),vA=velocity(thetaA),vB=velocity(thetaB),dr=subtract(rB,rA),dv=subtract(vB,vA),dt=delta/(SPEED/RADIUS);
    return {thetaA,thetaB,sense,delta,rA,rB,vA,vB,dr,dv,dt,averageV:scale(dr,1/dt),averageA:scale(dv,1/dt),nodes:{S:[0,0],U:vA,V:vB}};
  }
  function direction(state,task,key){const g=scene(state,task);return {'forward-tangent':scale(g.vA,1/SPEED),'backward-tangent':scale(g.vA,-1/SPEED),inward:scale(g.rA,-1/RADIUS),outward:scale(g.rA,1/RADIUS)}[key];}
  function options(state,q){
    const values=q.type==='direction'?DIRECTIONS.map(key=>[key,key]):q.options;
    const fields=q.type==='direction'?['velocityDirection','accelerationDirection','transferVelocity','transferAcceleration']:['velocityReason','accelerationReason','transferReason'];
    const shift=(state.definition.choiceShift+fields.indexOf(q.field))%values.length;
    return values.slice(shift).concat(values.slice(0,shift));
  }
  function change(state,action){
    if(state.phase!=='edit')throw Error('Answers are not editable');
    const n=clone(state);
    switch(action.type){
      case 'gap':if(!integer(action.value,5,60))throw Error('Invalid gap');n.observation[GAP_KEYS[n.task]]=action.value;break;
      case 'answer':{const q=QUESTIONS.find(q=>q.field===action.field&&q.task===n.task);if(!q||(action.value!==null&&!options(n,q).some(o=>o[0]===action.value)))throw Error('Invalid answer');n.answers[q.field]=action.value;break;}
      case 'node':if(n.task!==1||!NODES.includes(action.value))throw Error('Invalid node');if(n.answers.deltaFrom===null)n.answers.deltaFrom=action.value;else if(n.answers.deltaTo===null&&action.value!==n.answers.deltaFrom)n.answers.deltaTo=action.value;break;
      case 'redraw':if(n.task!==1)throw Error('Wrong task');n.answers.deltaFrom=n.answers.deltaTo=null;break;
      case 'change-end':if(n.task!==1)throw Error('Wrong task');n.answers.deltaTo=null;break;
      case 'clear-task':QUESTIONS.filter(q=>q.task===n.task).forEach(q=>{n.answers[q.field]=null;});if(n.task===1)n.answers.deltaFrom=n.answers.deltaTo=null;n.observation[GAP_KEYS[n.task]]=[60,60,45][n.task];break;
      default:throw Error('Unknown operation');
    }
    return n;
  }
  function navigate(state,task,check=false){if(!integer(task,0,2))throw Error('Invalid task');return {...clone(state),task,phase:check?'check':'edit'};}
  return Object.freeze({ACTIVITY,RADIUS,SPEED,GAP_KEYS,DIRECTIONS,NODES,QUESTIONS,clone,integer,subtract,length,scale,fresh,scene,direction,options,change,navigate});
});
