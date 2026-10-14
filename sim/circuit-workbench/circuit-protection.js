(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitProtection=api;})(globalThis,function(){
  'use strict';
  const revision='HH-teaching-1',thermalTypes=['hh-fuse','hh-plug','hh-mcb','hh-rcbo'],residualTypes=['hh-rccb','hh-rcbo'];
  const fuse=c=>['hh-fuse','hh-plug'].includes(c.type);
  const tau=c=>fuse(c)?20:30;
  const initial=()=>({status:'closed',heat:0,fast:0,residual:0,reason:null});
  function heat(theta,q,seconds,timeConstant){return theta+(q-theta)*(-Math.expm1(-seconds/timeConstant));}
  function heatTime(theta,q,timeConstant){if(theta>=2)return 0;return q>2?timeConstant*Math.log1p((2-theta)/(q-2)):Infinity;}
  function candidates(c,s,r){
    if(s.status!=='closed'||c.params.closed===false)return [];
    const result=[],current=Math.abs(r.current??0),ratio=current/c.params.rating;
    if(thermalTypes.includes(c.type))result.push({after:heatTime(s.heat,ratio**2,tau(c)),reason:'thermal'});
    if(['hh-mcb','hh-rcbo'].includes(c.type)&&ratio>=5)result.push({after:Math.max(0,.02-s.fast),reason:'magnetic'});
    if(residualTypes.includes(c.type)&&r.residualCurrent!==null&&r.residualCurrent>=c.params.residualRating)result.push({after:Math.max(0,.04-s.residual),reason:'residual'});
    return result.filter(e=>Number.isFinite(e.after)).sort((a,b)=>a.after-b.after||['residual','magnetic','thermal'].indexOf(a.reason)-['residual','magnetic','thermal'].indexOf(b.reason));
  }
  function advance(c,s,r,seconds){
    const current=s.status==='closed'&&c.params.closed!==false?Math.abs(r.current??0):0;
    if(thermalTypes.includes(c.type))s.heat=Math.max(0,heat(s.heat,(current/c.params.rating)**2,seconds,tau(c)));
    s.fast=['hh-mcb','hh-rcbo'].includes(c.type)&&current/c.params.rating>=5?Math.min(.02,s.fast+seconds):0;
    s.residual=residualTypes.includes(c.type)&&s.status==='closed'&&c.params.closed!==false&&r.residualCurrent!==null&&r.residualCurrent>=c.params.residualRating?Math.min(.04,s.residual+seconds):0;
  }
  return {revision,thermalTypes,residualTypes,fuse,tau,initial,heat,heatTime,candidates,advance};
});
