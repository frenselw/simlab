(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-routing'):root.CircuitRouting,node?require('./circuit-renderer'):root.CircuitRenderer,node?require('./component-registry'):root.CircuitRegistry);if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitObservation=api;})(globalThis,function(M,G,V,R){
  'use strict';
  function measurementWindow(frequencies,naturalPeriod=null){
    const values=[...new Set(frequencies)].sort((a,b)=>a-b);
    if(values.length===1)return {window:1/values[0],period:1/values[0],windowKind:'cycle',frequencies:values};
    if(!values.length)return {window:naturalPeriod||1,period:naturalPeriod,windowKind:naturalPeriod?'natural':'time',frequencies:values};
    const scale=1e6,ticks=values.map(f=>Math.round(f*scale)),gcd=(a,b)=>{while(b){const rest=a%b;a=b;b=rest;}return a;};
    // Only claim a common cycle for checked decimal frequencies and a bounded duration.
    const exact=values.every((f,i)=>Math.abs(f-ticks[i]/scale)<=1e-12*Math.max(1,f)),period=exact?scale/ticks.reduce(gcd):Infinity;
    return period<=100?{window:period,period,windowKind:'common-cycle',frequencies:values}:{window:10,period:null,windowKind:'time',frequencies:values};
  }
  // ponytail: 512 time bins bound memory even for stiff circuits; more bins if meter accuracy requirements exceed 0.5%.
  class Tracker {
    constructor(period,ids=null){this.window=period;this.width=period/512;this.ids=ids;this.bins=[];this.previous=null;this.start=null;this.starts={};}
    copy(){const next=new Tracker(this.window,this.ids?new Set(this.ids):null);next.bins=M.clone(this.bins);next.previous=M.clone(this.previous);next.start=this.start;next.starts={...this.starts};return next;}
    retain(ids){for(const id of Object.keys(this.starts))if(!ids.has(id))delete this.starts[id];for(const bin of this.bins)for(const id of Object.keys(bin.values))if(!ids.has(id))delete bin.values[id];if(this.previous)for(const id of Object.keys(this.previous.values))if(!ids.has(id))delete this.previous.values[id];}
    sample(result){
      const values=Object.fromEntries(Object.entries(result.components).map(([id,r])=>[id,{u:r.sensedVoltage!==undefined?r.sensedVoltage:r.voltage,i:r.current,...(r.measurementBranches?{p:r.measurementBranches.map(b=>({from:b.from,to:b.to,u:b.voltage,i:b.current}))}:{})}])),next={time:result.time,values};
      for(const [id,r]of Object.entries(result.components))if(r.secondaryVoltage!==undefined)values[id+'~secondary']={u:r.secondaryVoltage,i:r.secondaryCurrent};
      for(const [id,r]of Object.entries(result.wires))values['wire:'+id]={u:r.voltage,i:r.current};
      if(this.ids)for(const id of Object.keys(values))if(!this.ids.has(id))delete values[id];
      for(const id of Object.keys(values))if(!Object.hasOwn(this.starts,id))this.starts[id]=next.time;
      if(!this.previous||next.time<=this.previous.time){this.previous=next;if(this.start===null)this.start=next.time;return;}
      const old=this.previous,h=next.time-old.time;let begin=old.time;
      // Snap bin boundaries above float roundoff so an accepted step never loses its remainder.
      while(begin<next.time-1e-14){const at=Math.floor(begin/this.width+1e-8),end=Math.min(next.time,(at+1)*this.width),duration=end-begin;if(duration<=0)break;
        let bin=this.bins.at(-1);if(!bin||bin.at!==at){bin={at,start:begin,end,values:{}};this.bins.push(bin);}bin.end=end;
        const x0=(begin-old.time)/h,x1=(end-old.time)/h;
        for(const [id,v]of Object.entries(values)){const before=old.values[id];if(!before)continue;
          const u=[before.u,v.u].every(Number.isFinite),i=[before.i,v.i].every(Number.isFinite),u0=u?before.u+(v.u-before.u)*x0:0,u1=u?before.u+(v.u-before.u)*x1:0,i0=i?before.i+(v.i-before.i)*x0:0,i1=i?before.i+(v.i-before.i)*x1:0,q=bin.values[id]||(bin.values[id]={uDuration:0,iDuration:0,pDuration:0,u2:0,i2:0,p:0,currentPeak:0,voltagePeak:0});
          if(u){q.voltagePeak=Math.max(q.voltagePeak,Math.abs(u0),Math.abs(u1));q.uDuration+=duration;q.u2+=duration*(u0*u0+u0*u1+u1*u1)/3;}
          if(i){q.currentPeak=Math.max(q.currentPeak,Math.abs(i0),Math.abs(i1));q.iDuration+=duration;q.i2+=duration*(i0*i0+i0*i1+i1*i1)/3;}
          if(v.p){const p=before.p?.length===v.p.length?v.p.map((branch,index)=>{const old=before.p[index];if(old.from!==branch.from||old.to!==branch.to||![old.u,branch.u].every(Number.isFinite))return null;const a=old.u+(branch.u-old.u)*x0,b=old.u+(branch.u-old.u)*x1;if(a===0&&b===0)return 0;if(![old.i,branch.i].every(Number.isFinite))return null;const c=old.i+(branch.i-old.i)*x0,d=old.i+(branch.i-old.i)*x1;return (2*a*c+a*d+b*c+2*b*d)/6;}):[null];if(p.every(Number.isFinite)){q.pDuration+=duration;q.p+=duration*p.reduce((sum,v)=>sum+v,0);}}
          else if(u&&i){q.pDuration+=duration;q.p+=duration*(2*u0*i0+u0*i1+u1*i0+2*u1*i1)/6;}
        }
        begin=end;
      }
      const threshold=next.time-this.window-this.width;while(this.bins[0]?.end<threshold)this.bins.shift();this.previous=next;
    }
    measure(id){const end=this.previous?.time??0,start=end-this.window,origin=this.starts[id]??this.start,collecting=origin===null||start<origin-1e-10;
      const sum={uDuration:0,iDuration:0,pDuration:0,u2:0,i2:0,p:0};let currentPeak=0,voltagePeak=0;for(const bin of this.bins){const overlap=Math.max(0,Math.min(end,bin.end)-Math.max(start,bin.start)),q=bin.values[id];if(!q||!overlap)continue;currentPeak=Math.max(currentPeak,q.currentPeak);voltagePeak=Math.max(voltagePeak,q.voltagePeak);const factor=overlap/(bin.end-bin.start);for(const k of Object.keys(sum))sum[k]+=q[k]*factor;}
      const latest=this.previous?.values[id],status=(duration,known)=>!known?'unknown':collecting?'collecting':duration>=this.window*(1-1e-6)?'ready':'collecting',voltageStatus=status(sum.uDuration,Number.isFinite(latest?.u)),currentStatus=status(sum.iDuration,Number.isFinite(latest?.i)),powerStatus=status(sum.pDuration,latest?.p?latest.p.every(b=>Number.isFinite(b.u)&&(b.u===0||Number.isFinite(b.i))):Number.isFinite(latest?.u)&&Number.isFinite(latest?.i)),states=[voltageStatus,currentStatus,powerStatus];
      // Startup estimates use only complete coverage of the elapsed window; a gap or
      // unknown channel must not masquerade as a measured zero or a complete cycle.
      const elapsed=end-Math.max(origin??end,start),covered=(duration,state)=>state==='collecting'&&elapsed>1e-12&&duration>=elapsed*(1-1e-6);
      const provisionalVoltageRms=covered(sum.uDuration,voltageStatus)?Math.sqrt(Math.max(0,sum.u2/sum.uDuration)):null,provisionalCurrentRms=covered(sum.iDuration,currentStatus)?Math.sqrt(Math.max(0,sum.i2/sum.iDuration)):null,provisionalAveragePower=covered(sum.pDuration,powerStatus)?sum.p/sum.pDuration:null;
      return {provisionalVoltageRms,provisionalCurrentRms,provisionalAveragePower,status:states.every(s=>s==='ready')?'ready':states.includes('collecting')?'collecting':'unknown',voltageStatus,currentStatus,powerStatus,start:Math.max(origin??0,start),end,window:this.window,voltageDuration:sum.uDuration,currentDuration:sum.iDuration,powerDuration:sum.pDuration,currentPeak:currentStatus==='ready'?currentPeak:null,voltagePeak:voltageStatus==='ready'?voltagePeak:null,voltageRms:voltageStatus==='ready'?Math.sqrt(Math.max(0,sum.u2/sum.uDuration)):null,currentRms:currentStatus==='ready'?Math.sqrt(Math.max(0,sum.i2/sum.iDuration)):null,averagePower:powerStatus==='ready'?sum.p/sum.pDuration:null};
    }
  }
  class GroupTracker {
    constructor(policies,previous=null,retainedIds=null){
      this.policies=policies;this.groups=new Map();
      for(const [id,policy]of policies)for(const p of new Set([policy,...Object.values(policy.quantities||{})])){let group=this.groups.get(p.key);if(!group){group={policy:p,ids:new Set()};this.groups.set(p.key,group);}group.ids.add(id);}
      for(const [key,group]of this.groups){group.tracker=previous?.groups.get(key)?.tracker||new Tracker(group.policy.window,group.ids);if(retainedIds)group.tracker.retain(retainedIds);group.tracker.ids=group.ids;}
    }
    copy(){const next=Object.create(GroupTracker.prototype);next.policies=this.policies;next.groups=new Map([...this.groups].map(([key,g])=>[key,{policy:g.policy,ids:new Set(g.ids),tracker:g.tracker.copy()}]));return next;}
    sample(result){for(const group of this.groups.values())group.tracker.sample(result);}
    measure(id){const policy=this.policies.get(id);if(!policy)return {status:'unknown'};
      const result={...this.groups.get(policy.key).tracker.measure(id),windowKind:policy.windowKind,period:policy.period,frequencies:policy.frequencies,sourceCount:policy.sourceCount};
      for(const [quantity,p]of Object.entries(policy.quantities||{})){const q=this.groups.get(p.key).tracker.measure(id),fields=quantity==='voltage'?['voltageStatus','voltageRms','provisionalVoltageRms','voltageDuration','voltagePeak']:quantity==='current'?['currentStatus','currentRms','provisionalCurrentRms','currentDuration','currentPeak']:['powerStatus','averagePower','provisionalAveragePower','powerDuration'];for(const field of fields)result[field]=q[field];result[quantity+'Window']=p.window;result[quantity+'WindowKind']=p.windowKind;}
      const states=[result.voltageStatus,result.currentStatus,result.powerStatus];result.status=states.every(s=>s==='ready')?'ready':states.includes('collecting')?'collecting':'unknown';return result;
    }
  }
  // Display-only AC flux primitive. A centred full-cycle window fixes the
  // ideal transformer's unspecified DC flux offset without inventing load current.
  class CoreFluxTracker {
    constructor(period,previous=null,retainedIds=null){this.policies=period instanceof Map?new Map([...period].map(([id,p])=>[id,p.quantities?.voltage||p])):null;this.window=this.policies?1:period;this.width=this.window/512;this.records=new Map();if(previous&&this.policies)for(const [id,r]of previous.records)if((!retainedIds||retainedIds.has(id))&&this.policies.get(id)?.key===previous.policies?.get(id)?.key)this.records.set(id,M.clone(r));}
    sample(result){for(const [id,c]of Object.entries(result.components)){
      if(c.coreVoltage===undefined)continue;const v=Number.isFinite(c.coreVoltage)?c.coreVoltage/c.coreTurns:null,t=result.time;
      const window=this.policies?.get(id)?.window||this.window,width=window/512;
      let r=this.records.get(id);if(!r||!Number.isFinite(v)||t<r.previous.time){r={previous:{time:t,v},start:t,primitive:0,bins:[]};this.records.set(id,r);continue;}
      const old=r.previous;r.previous={time:t,v};if(!Number.isFinite(old.v)||t<=old.time){if(!Number.isFinite(old.v)){r.start=t;r.primitive=0;r.bins=[];}continue;}
      const h=t-old.time;let begin=old.time;
      while(begin<t-1e-14){const at=Math.floor(begin/width+1e-8),end=Math.min(t,(at+1)*width),dt=end-begin;if(dt<=0)break;
        const u0=old.v+(v-old.v)*(begin-old.time)/h,u1=old.v+(v-old.v)*(end-old.time)/h,p0=r.primitive,p1=p0+dt*(u0+u1)/2;
        let bin=r.bins.at(-1);if(!bin||bin.at!==at){bin={at,start:begin,end,area:0,min:p0,max:p0};r.bins.push(bin);}bin.end=end;bin.area+=dt*(p0+dt*(u0/2+(u1-u0)/6));bin.min=Math.min(bin.min,p0,p1);bin.max=Math.max(bin.max,p0,p1);
        const z=-u0/(u1-u0);if(z>0&&z<1){const p=p0+dt*(u0*z+(u1-u0)*z*z/2);bin.min=Math.min(bin.min,p);bin.max=Math.max(bin.max,p);}
        r.primitive=p1;begin=end;
      }
      while(r.bins[0]?.end<t-window-width)r.bins.shift();
    }}
    measure(id){const r=this.records.get(id),window=this.policies?.get(id)?.window||this.window;if(!r||!Number.isFinite(r.previous.v))return {status:'unknown',value:null,peak:null};const end=r.previous.time,start=end-window;if(start<r.start-1e-10)return {status:'collecting',value:null,peak:null};
      let duration=0,area=0,min=Infinity,max=-Infinity;for(const b of r.bins){const overlap=Math.max(0,Math.min(end,b.end)-Math.max(start,b.start));if(!overlap)continue;duration+=overlap;area+=b.area*overlap/(b.end-b.start);min=Math.min(min,b.min);max=Math.max(max,b.max);}
      if(duration<window*(1-1e-6))return {status:'unknown',value:null,peak:null};const centre=area/duration;return {status:'ready',value:r.primitive-centre,peak:Math.max(Math.abs(min-centre),Math.abs(max-centre))};
    }
  }
  function channels(doc){const names={voltage:['電壓','V'],current:['電流','A'],charge:['電荷','C'],energy:['儲能','J'],flux:['磁通量','Wb']};return doc.components.flatMap(c=>R.observationQuantities(c).map(quantity=>({key:c.id+':'+quantity,id:c.id,quantity,label:c.label+' · '+names[quantity][0],unit:names[quantity][1]})));}
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
  return {Tracker,GroupTracker,measurementWindow,CoreFluxTracker,Buffer,channels,phase,kinds,permitted,validateTools,probePosition,signal,snapProbe,timeInterval,Trace};
});
