(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-routing'):root.CircuitRouting,node?require('./circuit-renderer'):root.CircuitRenderer);if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitObservation=api;})(globalThis,function(M,G,V){
  'use strict';
  // ponytail: 512 time bins bound memory even for stiff circuits; more bins if meter accuracy requirements exceed 0.5%.
  class Tracker {
    constructor(period){this.window=period;this.width=period/512;this.bins=[];this.previous=null;this.start=null;}
    sample(result){
      const values=Object.fromEntries(Object.entries(result.components).map(([id,r])=>[id,{u:r.sensedVoltage!==undefined?r.sensedVoltage:r.voltage,i:r.current}])),next={time:result.time,values};
      for(const [id,r]of Object.entries(result.components))if(r.secondaryVoltage!==undefined)values[id+'~secondary']={u:r.secondaryVoltage,i:r.secondaryCurrent};
      for(const [id,r]of Object.entries(result.wires))values['wire:'+id]={u:r.voltage,i:r.current};
      if(!this.previous||next.time<=this.previous.time){this.previous=next;if(this.start===null)this.start=next.time;return;}
      const old=this.previous,h=next.time-old.time;let begin=old.time;
      // Snap bin boundaries above float roundoff so an accepted step never loses its remainder.
      while(begin<next.time-1e-14){const at=Math.floor(begin/this.width+1e-8),end=Math.min(next.time,(at+1)*this.width),duration=end-begin;if(duration<=0)break;
        let bin=this.bins.at(-1);if(!bin||bin.at!==at){bin={at,start:begin,end,values:{}};this.bins.push(bin);}bin.end=end;
        const x0=(begin-old.time)/h,x1=(end-old.time)/h;
        for(const [id,v]of Object.entries(values)){const before=old.values[id];if(!before||![before.u,before.i,v.u,v.i].every(Number.isFinite))continue;
          const u0=before.u+(v.u-before.u)*x0,u1=before.u+(v.u-before.u)*x1,i0=before.i+(v.i-before.i)*x0,i1=before.i+(v.i-before.i)*x1,q=bin.values[id]||(bin.values[id]={duration:0,u2:0,i2:0,p:0,currentPeak:0});
          q.currentPeak=Math.max(q.currentPeak,Math.abs(i0),Math.abs(i1));q.duration+=duration;q.u2+=duration*(u0*u0+u0*u1+u1*u1)/3;q.i2+=duration*(i0*i0+i0*i1+i1*i1)/3;q.p+=duration*(2*u0*i0+u0*i1+u1*i0+2*u1*i1)/6;
        }
        begin=end;
      }
      const threshold=next.time-this.window-this.width;while(this.bins[0]?.end<threshold)this.bins.shift();this.previous=next;
    }
    measure(id){const end=this.previous?.time??0,start=end-this.window;if(this.start===null||start<this.start-1e-10)return {status:'collecting',start:Math.max(0,start),end,window:this.window};
      const sum={duration:0,u2:0,i2:0,p:0};let currentPeak=0;for(const bin of this.bins){const overlap=Math.max(0,Math.min(end,bin.end)-Math.max(start,bin.start)),q=bin.values[id];if(!q||!overlap)continue;currentPeak=Math.max(currentPeak,q.currentPeak);const factor=overlap/(bin.end-bin.start);for(const k of Object.keys(sum))sum[k]+=q[k]*factor;}
      if(sum.duration<this.window*(1-1e-6))return {status:'unknown',start,end,window:this.window};
      return {status:'ready',start,end,window:this.window,currentPeak,voltageRms:Math.sqrt(Math.max(0,sum.u2/sum.duration)),currentRms:Math.sqrt(Math.max(0,sum.i2/sum.duration)),averagePower:sum.p/sum.duration};
    }
  }
  function channels(doc){const options=[];for(const c of doc.components){options.push({key:c.id+':voltage',id:c.id,quantity:'voltage',label:c.label+' · 電壓',unit:'V'},{key:c.id+':current',id:c.id,quantity:'current',label:c.label+' · 電流',unit:'A'});if(c.type==='capacitor')options.push({key:c.id+':charge',id:c.id,quantity:'charge',label:c.label+' · 電荷',unit:'C'});if(['capacitor','inductor','transformer'].includes(c.type))options.push({key:c.id+':energy',id:c.id,quantity:'energy',label:c.label+' · 儲能',unit:'J'});if(c.type==='generator')options.push({key:c.id+':flux',id:c.id,quantity:'flux',label:c.label+' · 磁通量',unit:'Wb'});}return options;}
  class Buffer {
    constructor(limit=2048){this.limit=limit;this.points=[];}
    sample(result){this.points.push({time:result.time,values:Object.fromEntries(Object.entries(result.components).map(([id,c])=>[id,{voltage:c.voltage,current:c.current,charge:c.charge,energy:c.energy,flux:c.flux}]))});if(this.points.length>this.limit)this.points.splice(0,this.points.length-this.limit);}
    clear(){this.points=[];}
  }
  function phase(points,a,b,frequency){if(points.length<16||!(frequency>0))return null;const end=points.at(-1).time,start=end-2/frequency,rows=points.filter(p=>p.time>=start);if(rows[0]?.time>start+1/frequency/20)return null;
    const fit=channel=>{const values=rows.map(p=>p.values[channel.id]?.[channel.quantity]);if(values.some(v=>!Number.isFinite(v)))return null;const mean=values.reduce((s,v)=>s+v,0)/values.length;let sine=0,cosine=0;for(let i=1;i<rows.length;i++){const dt=rows[i].time-rows[i-1].time,angle=2*Math.PI*frequency*(rows[i].time+rows[i-1].time)/2,v=(values[i]+values[i-1])/2-mean;sine+=dt*v*Math.sin(angle);cosine+=dt*v*Math.cos(angle);}const amplitude=Math.hypot(sine,cosine)*frequency;if(amplitude<1e-12)return null;const angle=Math.atan2(cosine,sine);let error=0,total=0;for(let i=1;i<rows.length;i++){const dt=rows[i].time-rows[i-1].time,expected=amplitude*Math.sin(2*Math.PI*frequency*rows[i].time+angle);error+=dt*(values[i]-mean-expected)**2;total+=dt*(values[i]-mean)**2;}return error/Math.max(total,1e-24)<.005?angle:null;};
    const x=fit(a),y=fit(b);return x===null||y===null?null:((y-x)*180/Math.PI+540)%360-180;
  }
  const kinds=['voltage','current','charge','energy','flux'];
  const strict=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k));
  const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  const point=p=>strict(p,['x','y'])&&number(p.x,-10000,10000)&&number(p.y,-10000,10000);
  function targetValid(target,kind,doc){
    if(target===null)return true;if(!strict(target,['kind','id','fraction'])||typeof target.id!=='string')return false;
    if(target.kind==='endpoint')return kind==='voltage'&&strict(target,['kind','id'])&&M.endpoints(doc).has(target.id);
    if(target.kind==='component')return kind==='current'&&strict(target,['kind','id','fraction'])&&(target.fraction===undefined||number(target.fraction,0,1))&&doc.components.some(c=>c.id===target.id);
    return target.kind==='wire'&&number(target.fraction,0,1)&&doc.wires.some(w=>w.id===target.id&&(kind==='current'||w.resistance===0));
  }
  function permitted(tool,doc,allowed){
    if(!kinds.includes(tool.kind))return false;
    if(!['voltage','current'].includes(tool.kind))return tool.probes.length===0&&strict(tool.channel,['id'])&&channels(doc).some(c=>c.id===tool.channel?.id&&c.quantity===tool.kind)&&(allowed===null||allowed.some(c=>c.id===tool.channel.id&&c.quantity===tool.kind));
    if(tool.probes.length!==(tool.kind==='voltage'?2:1)||tool.probes.some(p=>!targetValid(p.target,tool.kind,doc)))return false;
    if(allowed===null)return true;
    return allowed.some(c=>c.quantity===tool.kind&&tool.probes.every((p,i)=>p.target===null||(tool.kind==='current'?p.target.kind==='component'&&p.target.id===c.id:p.target.kind==='endpoint'&&p.target.id===c.id+':'+(i===0?'a':'b'))));
  }
  function validateTools(input,doc,profile){
    if(!profile.ui.waveform||!Array.isArray(input)||input.length>profile.observationLimit)return null;const ids=new Set();
    for(const t of input){if(!strict(t,['id','kind','x','y','width','height','range','span','probes','channel'])||!/^scope-[a-z0-9-]+$/.test(t.id)||ids.has(t.id)||!number(t.x,0,10000)||!number(t.y,0,10000)||!number(t.width,200,1200)||!number(t.height,180,900)||!number(t.range,1e-12,1e12)||!number(t.span,.00001,1000)||!Array.isArray(t.probes)||t.probes.some(p=>!strict(p,['position','target','bends'])||!point(p.position)||!Array.isArray(p.bends)||p.bends.length>32||!p.bends.every(point))||!permitted(t,doc,profile.observationChannels))return null;ids.add(t.id);}
    if(input.some(t=>t.span!==input[0].span))return null;return M.clone(input);
  }
  function probePosition(probe,doc,routes={}){
    const t=probe.target;if(!t)return probe.position;
    if(t.kind==='endpoint')return M.endpoints(doc).get(t.id)||null;
    if(t.kind==='component'){const path=componentPaths(doc).find(p=>p.component===t.id);return path&&t.fraction!==undefined?G.along(path.points,G.length(path.points)*t.fraction):M.endpoints(doc).get(t.id+':a')||null;}
    const w=doc.wires.find(w=>w.id===t.id);return w?G.along(routes[w.id]||G.route(doc,w),G.length(routes[w.id]||G.route(doc,w))*t.fraction):null;
  }
  function signal(tool,result,doc){
    if(!['voltage','current'].includes(tool.kind)){const v=result.components[tool.channel.id]?.[tool.kind];return Number.isFinite(v)?v:null;}
    if(tool.probes.some(p=>!p.target))return null;
    if(tool.kind==='current'){const t=tool.probes[0].target,v=t.kind==='wire'?result.wires[t.id]?.current:result.components[t.id]?.current;return Number.isFinite(v)?v:null;}
    const node=p=>p.target.kind==='endpoint'?p.target.id:doc.wires.find(w=>w.id===p.target.id)?.from,[a,b]=tool.probes.map(node),u=result.potentials[a],v=result.potentials[b];return result.islandOf[a]!==undefined&&result.islandOf[a]===result.islandOf[b]&&Number.isFinite(u)&&Number.isFinite(v)?u-v:null;
  }
  const componentPaths=doc=>V.componentFlowPaths(doc,{components:{}}).filter(p=>p.key==='main'||p.key==='contact');
  function timeInterval(span){const half=span/2,base=10**Math.floor(Math.log10(half));return [5,2,1].find(n=>n*base<=half*(1+1e-12))*base;}
  function snapProbe(tool,index,at,doc,routes,scale,allowed){
    const candidates=[],ends=M.endpoints(doc);if(tool.kind==='voltage')for(const [id,p]of ends)candidates.push({target:{kind:'endpoint',id},position:p,distance:Math.hypot(at.x-p.x,at.y-p.y)});
    for(const w of doc.wires){if(tool.kind==='voltage'&&w.resistance)continue;const path=routes[w.id]||G.route(doc,w),p=G.nearest(path,at);if(!p)continue;let distance=0;for(let n=0;n<p.segment;n++)distance+=Math.hypot(path[n+1].x-path[n].x,path[n+1].y-path[n].y);distance+=Math.hypot(p.x-path[p.segment].x,p.y-path[p.segment].y);candidates.push({target:{kind:'wire',id:w.id,fraction:Math.max(0,Math.min(1,distance/Math.max(G.length(path),1e-9)))},position:p,distance:p.distance});}
    if(tool.kind==='current')for(const c of doc.components){const path=componentPaths(doc).find(p=>p.component===c.id),p=path?G.nearest(path.points,at):ends.get(c.id+':a');let fraction;if(path){let distance=0;for(let n=0;n<p.segment;n++)distance+=Math.hypot(path.points[n+1].x-path.points[n].x,path.points[n+1].y-path.points[n].y);distance+=Math.hypot(p.x-path.points[p.segment].x,p.y-path.points[p.segment].y);fraction=Math.max(0,Math.min(1,distance/G.length(path.points)));}candidates.push({target:{kind:'component',id:c.id,...(fraction===undefined?{}:{fraction})},position:p,distance:p.distance??Math.hypot(at.x-p.x,at.y-p.y)});}
    return candidates.sort((a,b)=>a.distance-b.distance).find(c=>c.distance*scale<=24&&permitted({...tool,probes:tool.probes.map((p,i)=>i===index?{...p,target:c.target}:p)},doc,allowed))||null;
  }
  function tracePoint(bins,p,width){const at=Math.floor(p.time/width);let b=bins.at(-1);if(!b||b.at!==at){b={at,first:p,last:p,min:p,max:p,gap:p.value===null};bins.push(b);}else{b.last=p;b.gap||=p.value===null;if(p.value!==null){if(b.min.value===null||p.value<b.min.value)b.min=p;if(b.max.value===null||p.value>b.max.value)b.max=p;}}}
  function tracePoints(bins,begin=-Infinity){return bins.filter(b=>b.last.time>=begin).flatMap(b=>b.gap?[{time:b.first.time,value:null},{time:b.last.time,value:null}]:[...new Map([b.first,b.min,b.max,b.last].map(p=>[p.time+':'+p.value,p])).values()].sort((a,b)=>a.time-b.time));}
  // ponytail: 8192 history bins cover up to 1000 s; older detail is compacted with extrema/gaps, never used for physical integration.
  class Trace {
    constructor(span){this.span=span;this.width=span/1024;this.bins=[];this.history=[];this.historyWidth=this.width;this.time=-Infinity;}
    clear(){this.bins=[];this.history=[];this.historyWidth=this.width;this.time=-Infinity;}
    sample(time,value){if(time<this.time-1e-10)this.clear();value=Number.isFinite(value)?value:null;if(time===this.time&&this.bins.at(-1)?.last.value===value)return;this.time=time;const p={time,value};tracePoint(this.bins,p,this.width);tracePoint(this.history,p,this.historyWidth);
      while(this.bins.length>1025||this.bins[0]?.last.time<time-this.span-this.width)this.bins.shift();
      while(this.history[0]?.last.time<time-1000)this.history.shift();
      while(this.history.length>8192){const points=tracePoints(this.history);this.historyWidth*=2;this.history=[];for(const p of points)tracePoint(this.history,p,this.historyWidth);}
    }
    points(){return tracePoints(this.bins);}
    setSpan(span){const begin=this.time-span,old=this.points(),fine=this.width<=this.historyWidth,cutoff=old[0]?.time??Infinity,points=[...tracePoints(this.history,begin).filter(p=>!fine||p.time<cutoff),...(fine?old:[])];this.span=span;this.width=span/1024;this.bins=[];for(const p of points)if(p.time>=begin-this.width)tracePoint(this.bins,p,this.width);while(this.bins.length>1025)this.bins.shift();}
    copy(){const trace=new Trace(this.span);Object.assign(trace,{width:this.width,historyWidth:this.historyWidth,time:this.time,bins:M.clone(this.bins),history:M.clone(this.history)});return trace;}
  }
  return {Tracker,Buffer,channels,phase,kinds,permitted,validateTools,probePosition,signal,snapProbe,timeInterval,Trace};
});
