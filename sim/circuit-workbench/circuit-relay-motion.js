(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitRelayMotion=api;})(globalThis,function(){
  'use strict';
  const travel=.08,releaseRatio=.6;
  function sync(states,doc){
    const ids=new Set(doc.components.filter(c=>c.type==='relay').map(c=>c.id));
    for(const id of states.keys())if(!ids.has(id))states.delete(id);
    for(const id of ids)if(!states.has(id))states.set(id,{position:0,target:false,contact:'d',waiting:0,moving:false});
  }
  function advance(states,doc,result,dt){
    sync(states,doc);let moved=false,switched=false;
    const elapsed=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
    if(!elapsed)return {moved,switched};
    for(const c of doc.components.filter(c=>c.type==='relay')){
      const state=states.get(c.id),current=result.components[c.id]?.current;
      if(!Number.isFinite(current)){state.waiting=0;continue;}
      let step=elapsed;
      if(!state.moving){
        const desired=state.target?Math.abs(current)>c.params.pickupCurrent*releaseRatio:Math.abs(current)>=c.params.pickupCurrent;
        if(desired===state.target){state.waiting=0;continue;}
        const needed=Math.max(0,c.params.delay/1000-state.waiting);
        if(step+1e-12<needed){state.waiting+=step;continue;}
        step=Math.max(0,step-needed);state.waiting=0;state.target=desired;state.moving=true;state.contact=null;switched=true;
      }
      // Complete a stroke before responding to lost coil current; this allows
      // a normally-closed self-interrupting circuit to oscillate visibly.
      const before=state.position;
      state.position=Math.max(0,Math.min(1,state.position+(state.target?1:-1)*step/travel));
      moved=moved||state.position!==before;
      if(Math.abs(state.position-(state.target?1:0))<1e-10){state.position=state.target?1:0;state.moving=false;state.contact=state.target?'e':'d';switched=true;}
    }
    return {moved,switched};
  }
  function advanceFrame(states,doc,result,dt,solve){
    // ponytail: cap foreground catch-up at 2 s / 100 substeps; use event
    // stepping if large, slow relay boards need a longer catch-up window.
    let remaining=Math.max(0,Math.min(2,Number.isFinite(dt)?dt:0)),moved=false,switched=false;
    while(remaining>1e-10){const step=Math.min(.02,remaining),progress=advance(states,doc,result,step);remaining-=step;moved=moved||progress.moved;switched=switched||progress.switched;if(progress.switched)result=solve(doc);}
    for(const [id,state]of states)if(result.components[id])result.components[id].position=state.position;
    return {moved,switched,result};
  }
  return {sync,advance,advanceFrame,travel,releaseRatio};
});
