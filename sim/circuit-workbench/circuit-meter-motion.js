(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./component-registry.js'):root.CircuitRegistry);
  if(node)module.exports=api;else root.CircuitMeterMotion=api;
})(globalThis,function(R){
  'use strict';
  const frequency=14,damping=.4,decay=frequency*damping,damped=frequency*Math.sqrt(1-damping*damping);
  const minimum=R.meterScale.minimumFraction-R.meterScale.stopMargin,maximum=1+R.meterScale.stopMargin;
  const clamp=v=>Math.max(minimum,Math.min(maximum,v));
  function target(c,result){
    if(!R.dualMeter(c))return null;
    if(Number.isFinite(result?.reading))return clamp(result.reading/(result.range??c.params.range));
    return ['unconnected','missing-common'].includes(result?.meterStatus)?0:null;
  }
  function sync(states,doc,result,instant=false){
    const ids=new Set();
    for(const c of doc.components.filter(R.dualMeter)){
      ids.add(c.id);const goal=target(c,result.components[c.id]);let state=states.get(c.id);
      if(!state||state.type!==c.type){state={type:c.type,fraction:0,velocity:0,target:goal};states.set(c.id,state);}
      state.target=goal;
      if(goal===null||instant){state.fraction=goal??0;state.velocity=0;}
    }
    for(const id of states.keys())if(!ids.has(id))states.delete(id);
  }
  function advance(states,elapsed){
    const dt=Number.isFinite(elapsed)?Math.max(0,Math.min(.05,elapsed)):0;if(!dt)return false;
    const e=Math.exp(-decay*dt),cos=Math.cos(damped*dt),sin=Math.sin(damped*dt);let changed=false;
    for(const state of states.values()){
      if(state.target===null)continue;
      const old=state.fraction,velocity=state.velocity,offset=old-state.target;
      // Exact damped oscillator step: frame rate does not change the spring,
      // and retargeting keeps both the present angle and angular velocity.
      state.fraction=state.target+e*(offset*cos+(velocity+decay*offset)/damped*sin);
      state.velocity=e*(velocity*cos-(decay*velocity+frequency*frequency*offset)/damped*sin);
      if(state.fraction<minimum||state.fraction>maximum){state.fraction=clamp(state.fraction);state.velocity*=-.12;}
      if(Math.abs(state.fraction-state.target)<.00002&&Math.abs(state.velocity)<.0002){state.fraction=state.target;state.velocity=0;}
      changed||=state.fraction!==old||state.velocity!==velocity;
    }
    return changed;
  }
  return{target,sync,advance,minimum,maximum,frequency,damping};
});
