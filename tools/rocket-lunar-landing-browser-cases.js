'use strict';

// Exercise the player commands at the same 2° / 1% precision as the controls.
function pilot(controller,L,update=()=>{},hover=false){
  const f=controller.state.flight,cmd=(type,extra)=>controller.command({type,...extra});
  const control=(key,value)=>cmd('control',{key,value});
  function tick(dt){controller.tick(dt,1000);if(!controller.running&&controller.state.phase!=='ended')throw Error('Unexpected pause');}
  function until(condition,step,limit){
    for(let i=0;i<limit&&!condition();i++)tick(step);
    if(!condition())throw Error('Step limit at '+JSON.stringify({t:f.t,moon:f.moon,fuel:f.capsule.fuel}));
  }
  if(f.lunar.handoff!=='manual'&&!cmd('moon-takeover'))throw Error('Takeover refused');
  controller.play();
  control('mode','retrograde');control('throttle',1);
  tick(22);
  cmd('ignite');
  until(()=>f.moon.hp<=30000,.05,200);
  cmd('stop');
  update('deorbit',f);
  until(()=>f.moon.height<30400,2,4500);
  control('angle',270);tick(10);
  cmd('ignite');
  const throttle=(up,back)=>{
    const mass=L.LANDER.dry+f.capsule.fuel;
    let angle=(Math.atan2(-back,up)*180/Math.PI+360)%360;
    control('angle',Math.round(angle/2)*2%360);
    control('throttle',Math.round(100*Math.min(1,mass*Math.hypot(up,back)/L.LANDER.thrust))/100);
  };
  const limit=(value,low,high)=>Math.min(high,Math.max(low,value));
  const g=()=>4.902800118e12/(L.MOON_RADIUS+f.moon.height)**2;
  for(let step=0;step<2500&&f.moon.surface.horizontal>.20&&controller.state.phase!=='ended';step++){
    const {vertical,horizontal:speed}=f.moon.surface, max=L.LANDER.thrust/(L.LANDER.dry+f.capsule.fuel);
    const up=limit(g()-f.moon.tangential**2/(L.MOON_RADIUS+f.moon.height)+(-45-vertical)/1.5,0,max);
    const back=Math.min(Math.sqrt(Math.max(0,max*max-up*up)),speed/.9);
    throttle(up,back);
    tick(.2);
    if(f.capsule.fuel<=0) throw Error('Fuel exhausted under horizontal braking');
  }
  update('braked',f);
  let held=0;
  const max=24000;
  let count=0;
  while(controller.state.phase!=='ended'&&count++<max){
    const {height,vertical,horizontal}=f.moon.surface, acceleration=3;
    const remaining=hover&&held<20;
    const targetAltitude=remaining?32:0;
    const descSpeed=Math.sqrt(1.1**2+2*acceleration*Math.max(0,height-targetAltitude));
    const target=remaining&&height<targetAltitude+4?limit((targetAltitude-height)*.8,-3,3):-descSpeed;
    const error=target-vertical;
    const ff=remaining&&height<targetAltitude+4?0:-acceleration*vertical/descSpeed;
    const up=error<-.6?0:limit(g()+ff+error/.55,0,8);
    const back=limit((horizontal-.12)*.65,0,.12*up);
    throttle(up,back);
    tick(.10);
    if(remaining&&Math.abs(height-targetAltitude)<2&&Math.abs(vertical)<1){held+=.10;}
  }
  update('contact',f);
  return {outcome:f.lunar.outcome,held,fuel:f.capsule.fuel,touchdown:f.lunar.touchdown};
}
module.exports=pilot;
