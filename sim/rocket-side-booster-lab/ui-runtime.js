(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./parts.js'):root.RocketParts,node?require('./model.js'):root.RocketModel,node?require('./orbit.js'):root.RocketOrbit);if(node)module.exports=api;root.RocketRuntime=api;})(typeof window==='undefined'?globalThis:window,function(P,M,O){
  'use strict';
  class Controller{
    constructor(render=()=>{},canLaunch=()=>true){
      this.render=render;this.canLaunch=canLaunch;this.state=M.fresh();this.running=false;this.notice='';this.events=[];
      this.record=(type,t,f)=>{
        const mission=this.state.flight;
        const body=f===mission.upperStage?(mission.craft.stages.length===1?'core':'upper'):f.capsule?.detached?'capsule':f.separated?'upper':'rocket';
        this.events=[{type,t,body},...this.events].sort((a,b)=>b.t-a.t).slice(0,2);
      };
    }
    get editable(){return true;}
    emit(){this.render(this);}
    start(){this.state=M.fresh();this.events=[];this.running=false;this.notice='';this.emit();}
    command(action){
      try{
        if(action.type==='launch'&&!this.canLaunch())return false;
        const before=this.state.flight,next=M.change(this.state,action);
        if(JSON.stringify(next)===JSON.stringify(this.state))return false;
        this.state=next;this.notice='';
        const f=next.flight;
        if(!f||!before)this.events=[];
        else{
          const upper=f.controlled==='upper',body=upper?f.upperStage:f,oldBody=upper?before.upperStage:before;
          if(action.type==='ignite'&&body.controls.lit&&!oldBody.controls.lit)this.record('ignite',f.t,body);
          if(action.type==='jettison'&&f.boosters?.status==='jettisoned'&&before.boosters?.status!=='jettisoned')this.record('jettison',f.t,f);
          if(action.type==='separate'&&f.separated&&!before.separated)this.record('separate',f.t,f);
          if(action.type==='capsule-separate'&&f.capsule.detached&&!before.capsule.detached)this.record('capsule-separate',f.t,f);
        }
        if(!['control','stop','separate','jettison','capsule-separate','chute-arm','select-body','auto-dispose'].includes(action.type))this.running=false;
        this.emit();return true;
      }catch(_){this.notice='這個操作未能完成，請再試一次。';this.emit();return false;}
    }
    tick(seconds,budget){if(!this.running)return null;const before=this.state.flight?.status,result=M.advance(this.state,seconds,budget,this.record);if(before==='flying'&&this.state.flight.status==='landed'||this.state.phase==='ended'||this.state.flight.t>=604800||this.state.flight.status==='flying'&&Math.hypot(...this.state.flight.state.slice(0,2))>=P.R+1e8-.01)this.running=false;return result;}
    pause(){this.running=false;this.emit();}
    play(){if(this.state.flight&&!['ended','workshop'].includes(this.state.phase)){this.running=true;this.emit();}}
  }
  function warpLimit(flight){if(flight.capsule?.detached&&flight.status==='flying'&&flight.capsule.chute.phase!=='stowed')return 1000;if(flight.capsule?.detached){const bodies=[flight,flight.upperStage].filter(f=>f&&!['landed','impact','destroyed','escaped'].includes(f.status));return bodies.some(f=>f.controls.lit||O.elements(f.state).height<120000)||['waiting','turning','burning'].includes(flight.upperStage?.auto.mode)?20:1000;}return flight.controls.lit||P.burning(flight)||O.elements(flight.state).height<120000?20:1000;}
  function advanceFrame(controller,seconds,warp){
    let remaining=seconds,elapsed=0,steps=0;
    while(remaining>1e-9&&steps<800){
      const f=controller.state.flight,o=O.elements(f.state),rate=Math.min(warp,warpLimit(f));let request=remaining*rate;
      // Approach the atmosphere boundary before rechecking the rate for the remaining wall time.
      if(rate>20&&f.status==='flying'&&o.height>120000&&o.radial<0)request=Math.min(request,Math.max(.001,(o.height-120000)/-o.radial));
      const result=controller.tick(request,1);if(!result||result.elapsed<=0||!result.steps)break;
      elapsed+=result.elapsed;remaining=Math.max(0,remaining-result.elapsed/rate);steps+=result.steps;
    }
    return seconds>0?elapsed/seconds:0;
  }
  return Object.freeze({Controller,warpLimit,advanceFrame});
});
