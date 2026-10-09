(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-solver'):root.CircuitSolver,node?require('./circuit-ac-components'):root.CircuitAC,node?require('./circuit-observation'):root.CircuitObservation);
  if(node)module.exports=api;else root.CircuitTransient=api;
})(globalThis,function(M,R,S,AC,O){
  'use strict';
  const clone=M.clone,EPS=1e-12;
  const keys=(o,names)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==names.length||names.some(k=>!Object.hasOwn(o,k)))throw new Error('動態快照欄位無效');};
  const finite=(x,min=-1e12,max=1e12)=>{if(!Number.isFinite(x)||x<min||x>max)throw new Error('動態快照數值無效');return x;};
  function union(ids){const p=new Map(ids.map(k=>[k,k]));const find=k=>{let r=k;while(p.get(r)!==r)r=p.get(r);while(k!==r){const n=p.get(k);p.set(k,r);k=n;}return r;};return {find,join(a,b){p.set(find(a),find(b));}};}
  function signature(doc){return JSON.stringify({components:doc.components.map(c=>[c.id,c.type,c.params]),wires:doc.wires.map(w=>[w.id,w.from,w.to,w.resistance])});}
  function structural(doc){return JSON.stringify({components:doc.components.map(c=>[c.id,c.type]),wires:doc.wires.map(w=>[w.id,w.from,w.to])});}
  function compile(input){
    const doc=AC.toAC(input),ports=M.endpoints(doc),uf=union([...ports.keys()]);
    doc.wires.filter(w=>!w.resistance).forEach(w=>uf.join(w.from,w.to));
    const netOf=Object.fromEntries([...ports.keys()].map(p=>[p,uf.find(p)])),nets=[...new Set(Object.values(netOf))],islands=union(nets),edges=[],sources=[],transformers=[];
    const add=(c,from,to,kind,resistance=0,extra={})=>{const pa=extra.wire?from:c.id+':'+from,pb=extra.wire?to:c.id+':'+to,e={id:extra.wire?c.id:c.id+':'+from,c,pa,pb,a:netOf[pa],b:netOf[pb],kind,resistance,...extra};edges.push(e);islands.join(e.a,e.b);return e;};
    for(const c of doc.components){const p=c.params;
      if(['battery','ac-source','generator'].includes(c.type)){const e=add(c,'a','b','source',p.resistance);if(c.type!=='battery')sources.push(e);}
      else if(c.type==='capacitor')add(c,'a','b','capacitor',0,{C:p.capacitance});
      else if(c.type==='inductor')add(c,'a','b','inductor',p.resistance,{L:p.inductance});
      else if(c.type==='spdt')add(c,'a',p.closed,'resistor');
      else if(c.type==='transformer'){
        const ratio=p.primaryTurns/p.secondaryTurns,L1=p.inductance,L2=L1/ratio**2,mutual=p.coupling*Math.sqrt(L1*L2);
        const a=add(c,'a','b',p.model==='ideal'?'ideal-primary':'inductor',p.model==='ideal'?0:p.primaryResistance,{L:L1});
        const b=add(c,'c','d',p.model==='ideal'?'ideal-secondary':'inductor',p.model==='ideal'?0:p.secondaryResistance,{L:L2});
        a.other=b;b.other=a;a.mutual=b.mutual=mutual;a.ratio=b.ratio=ratio;transformers.push(a);
      }else if(c.type==='led')add(c,'a','b','led',p.resistance);
      else if(c.type==='ac-ammeter')add(c,'a','b','resistor',p.resistance);
      else if(c.type==='ac-voltmeter'){if(p.resistance>0)add(c,'a','b','resistor',p.resistance);}
      else if(c.type==='ac-wattmeter'){add(c,'a','b','resistor',p.resistance);if(p.inputResistance>0)add(c,'c','d','resistor',p.inputResistance);}
      else R.dc(c).forEach(b=>add(c,b.from,b.to,'resistor',b.resistance));
    }
    doc.wires.filter(w=>w.resistance>0).forEach(w=>add(w,w.from,w.to,'resistor',w.resistance,{wire:true}));
    const group=new Map();for(const net of nets){const g=islands.find(net);if(!group.has(g))group.set(g,[]);group.get(g).push(net);}
    const references=[];for(const [g,list]of group){const requested=netOf[doc.display.reference],source=edges.find(e=>e.kind==='source'&&islands.find(e.a)===g);const ref=list.includes(requested)?requested:source?source.b:list[0];references.push(ref);}
    const nodeKeys=nets.filter(k=>!references.includes(k)),index=new Map(nodeKeys.map((k,i)=>[k,i])),n=nodeKeys.length+edges.length;
    edges.forEach((e,i)=>e.index=nodeKeys.length+i);
    const diff=(a,b)=>{const d=Array(n).fill(0);if(index.has(a))d[index.get(a)]++;if(index.has(b))d[index.get(b)]--;return d;};
    const dynamic=edges.filter(e=>['capacitor','inductor'].includes(e.kind)),period=sources.length?1/sources[0].c.params.frequency: (()=>{const c=dynamic.find(e=>e.C),l=dynamic.find(e=>e.L);return c&&l?AC.TAU*Math.sqrt(c.C*l.L):1;})();
    // Algebraic circuits need waveform quadrature, not stored-energy error estimates.
    const samples=dynamic.length?128:32;
    let maxStep=Math.min(.02,period/samples);for(const source of sources)maxStep=Math.min(maxStep,1/source.c.params.frequency/samples);
    const cs=dynamic.filter(e=>e.C),ls=dynamic.filter(e=>e.L);if(cs.length&&ls.length)maxStep=Math.min(maxStep,AC.TAU*Math.sqrt(Math.min(...cs.map(e=>e.C))*Math.min(...ls.map(e=>e.L)))/128);
    const adjacency=new Map([...ports.keys()].map(p=>[p,[]]));for(const w of doc.wires.filter(w=>!w.resistance)){adjacency.get(w.from).push({to:w.to,id:w.id});adjacency.get(w.to).push({to:w.from,id:w.id});}
    // Compile ideal-wire cuts once. A cycle current is unidentifiable, never a chosen zero.
    const cuts=new Map();for(const w of doc.wires.filter(w=>!w.resistance)){const seen=new Set([w.from]),todo=[w.from];while(todo.length){const at=todo.pop();for(const e of adjacency.get(at))if(e.id!==w.id&&!seen.has(e.to)){seen.add(e.to);todo.push(e.to);}}if(seen.has(w.to)){cuts.set(w.id,null);continue;}const d=Array(n).fill(0);for(const e of edges){if(seen.has(e.pa))d[e.index]--;if(seen.has(e.pb))d[e.index]++;}cuts.set(w.id,d);}
    const connections=Object.fromEntries(doc.components.filter(R.isMeter).map(c=>[c.id,Object.fromEntries(R.localPorts(c).map(p=>[p.key,M.degree(doc,c.id+':'+p.key)>0]))]));
    const invalidDC=transformers.some(e=>e.kind==='ideal-primary'&&edges.some(s=>s.c.type==='battery'&&[islands.find(e.a),islands.find(e.other.a)].includes(islands.find(s.a))));
    return {doc,ports,netOf,islands,index,n,edges,dynamic,sources,period,maxStep,diff,cuts,invalidDC,references,connections};
  }
  function initial(c){const dynamic={};for(const e of c.dynamic){const p=e.c.params;dynamic[e.id]={i:e.C?0:e.c.type==='transformer'?(e.pa.endsWith(':a')?p.initialPrimaryCurrent:p.initialSecondaryCurrent):p.initialCurrent,v:e.C?p.initialVoltage:0};}return {time:0,step:c.maxStep/8,sources:Object.fromEntries(c.sources.map(e=>[e.c.id,AC.wrap(e.c.params.phase*Math.PI/180)])),dynamic,work:0,dissipated:0,event:true};}
  function phaseAt(c,state,e,h){return AC.wrap(state.sources[e.c.id]+AC.TAU*e.c.params.frequency*h);}
  function solve(c,state,h=0,method='trap',left=false,history=false){
    if(c.invalidDC)return {error:'dc-transformer'};
    const active=new Map(c.edges.filter(e=>e.kind==='led').map(e=>[e.id,true]));let answer;
    for(let iteration=0;iteration<24;iteration++){
      const A=Array.from({length:c.n},()=>Array(c.n).fill(0)),b=Array(c.n).fill(0);
      for(const e of c.edges){const d=c.diff(e.a,e.b),row=e.index;
        for(let j=0;j<c.index.size;j++)A[j][row]+=d[j];
        const stampVoltage=()=>{for(let j=0;j<c.index.size;j++)A[row][j]+=d[j];};
        if(e.kind==='ideal-primary'){stampVoltage();const other=c.diff(e.other.a,e.other.b);for(let j=0;j<c.index.size;j++)A[row][j]-=e.ratio*other[j];}
        else if(e.kind==='ideal-secondary'){A[row][row]=1;A[row][e.other.index]=e.ratio;}
        else if(e.kind==='led'&&!active.get(e.id))A[row][row]=1;
        else if(e.kind==='inductor'&&!h){A[row][row]=1;b[row]=state.dynamic[e.id].i;}
        else {stampVoltage();let resistance=e.resistance,value=0;
          if(e.kind==='source')value=AC.source(e.c,e.c.type==='battery'?0:phaseAt(c,state,e,h),left);
          else if(e.kind==='led')value=e.c.params.forwardVoltage;
          else if(e.kind==='capacitor'){const old=state.dynamic[e.id];resistance=h/(method==='be'?1:2)/e.C;value=old.v+(method==='be'?0:resistance*old.i);}
          else if(e.kind==='inductor'){const old=state.dynamic[e.id],factor=(method==='be'?1:2)/h;resistance+=factor*e.L;value=-factor*e.L*old.i-(method==='be'?0:old.v);if(e.other){A[row][e.other.index]-=factor*e.mutual;value-=factor*e.mutual*state.dynamic[e.other.id].i;}}
          A[row][row]-=resistance;b[row]=value;
        }
      }
      if(history){const extra=c.dynamic.length,total=c.n+extra;for(const row of A)row.push(...Array(extra).fill(0));for(const e of c.dynamic){const row=Array(total).fill(0);if(e.C){row[e.index]=1;b.push(state.dynamic[e.id].i);}else{const d=c.diff(e.a,e.b);for(let j=0;j<c.index.size;j++)row[j]=d[j];row[e.index]-=e.resistance;b.push(state.dynamic[e.id].v);}A.push(row);}}
      const s=S.linear(A,b);if(s.error)return s;
      const identify=d=>{if(s.nullspace.some(v=>Math.abs(d.reduce((a,x,i)=>a+x*v[i],0))>1e-10*Math.max(1,...d.map(Math.abs))))return null;const value=d.reduce((a,x,i)=>a+x*s.x[i],0),noise=d.reduce((a,x,i)=>a+Math.abs(x)*s.roundoff[i],0);return Math.abs(value)<=noise?0:value;};
      answer={...s,identify,A,b};let changed=false;
      for(const e of c.edges.filter(e=>e.kind==='led')){const v=identify(c.diff(e.a,e.b)),i=s.x[e.index],next=active.get(e.id)?i>0:v!==null&&v>e.c.params.forwardVoltage+1e-10;if(next!==active.get(e.id)){active.set(e.id,next);changed=true;}}
      if(!changed)return answer;
    }
    return {error:'convergence'};
  }
  const errors={inconsistent:'理想電源、電容電壓或線圈電流條件互相矛盾；請加入明確的電阻／放電路徑或改接線。',numerical:'數值未得到可靠解，模擬已暫停。',convergence:'元件模型未能收斂，模擬已暫停。','dc-transformer':'理想交流變壓器不支援直流激勵；請改用線性線圈模型。',continuity:'儲能狀態無法唯一確定，模擬已暫停。'};
  function energy(c,state){let value=0;for(const e of c.dynamic)value+=e.C?.5*e.C*state.dynamic[e.id].v**2:.5*e.L*state.dynamic[e.id].i**2;for(const e of c.edges.filter(e=>e.other&&e.kind==='inductor'&&e.pa.endsWith(':a')))value+=e.mutual*state.dynamic[e.id].i*state.dynamic[e.other.id].i;return value;}
  function read(c,state,solution){
    const ident=solution.error?()=>null:solution.identify,voltage=(a,b)=>{if(!c.ports.has(a)||!c.ports.has(b)||c.islands.find(c.netOf[a])!==c.islands.find(c.netOf[b]))return null;return ident(c.diff(c.netOf[a],c.netOf[b]));};
    const potentials={},islandOf={},components={},wires={},branches=new Map();
    for(const p of c.ports.keys()){potentials[p]=ident(c.diff(c.netOf[p],c.references.find(r=>c.islands.find(r)===c.islands.find(c.netOf[p]))));islandOf[p]=c.islands.find(c.netOf[p]);}
    for(const e of c.edges){const current=ident(Array.from({length:c.n},(_,i)=>i===e.index?1:0)),v=voltage(e.pa,e.pb),power=v===null||current===null?null:v*current,r={from:e.pa,to:e.pb,current,voltage:v,power,resistance:e.resistance};if(!branches.has(e.c.id))branches.set(e.c.id,[]);branches.get(e.c.id).push(r);}
    const diagnostics=solution.error?[{code:solution.error,message:errors[solution.error]||errors.numerical}]:[];
    for(const component of c.doc.components){const p=component.params,own=branches.get(component.id)||[],r=own[0]||{voltage:voltage(component.id+':a',component.id+':b'),current:['switch','ac-voltmeter','voltmeter'].includes(component.type)?0:null,power:0,resistance:null};
      const entry={...r,branches:own,power:own.some(e=>e.power===null)?null:own.reduce((s,e)=>s+e.power,0)};
      if(component.type==='capacitor'){entry.charge=p.capacitance*state.dynamic[component.id+':a'].v;entry.energy=.5*p.capacitance*state.dynamic[component.id+':a'].v**2;entry.resistance=null;}
      if(component.type==='inductor')entry.energy=.5*p.inductance*state.dynamic[component.id+':a'].i**2;
      if(component.type==='transformer'){entry.secondaryVoltage=voltage(component.id+':c',component.id+':d');entry.secondaryCurrent=own[1]?.current??null;entry.inputPower=own[0]?.power??null;entry.outputPower=own[1]?.power===null?null:-own[1]?.power;if(p.model==='coupled'){const a=state.dynamic[component.id+':a'].i,b=state.dynamic[component.id+':c'].i,l2=p.inductance*(p.secondaryTurns/p.primaryTurns)**2;entry.energy=.5*p.inductance*a*a+.5*l2*b*b+p.coupling*Math.sqrt(p.inductance*l2)*a*b;}}
      if(['battery','ac-source','generator'].includes(component.type)){entry.delivered=entry.power===null?null:-entry.power;entry.internalPower=entry.current===null?null:p.resistance*entry.current**2;entry.phase=state.sources[component.id]??0;entry.sourceEmf=entry.voltage===null||entry.current===null?null:entry.voltage-p.resistance*entry.current;entry.sourcePower=entry.current===null||entry.sourceEmf===null?null:-entry.sourceEmf*entry.current;if(component.type==='generator'){entry.flux=p.field*p.area*Math.cos(entry.phase);entry.fluxLinkage=p.turns*entry.flux;}}
      if(R.isMeter(component)){entry.unit=component.type==='galvanometer'?'A':R.get(component.type).icon;entry.range=p.range;entry.division=p.range/30;
        if(component.type==='galvanometer'||component.type==='ammeter')entry.reading=entry.current;
        else if(component.type==='voltmeter')entry.reading=entry.voltage;
        else if(component.type==='wattmeter'){const sensed=voltage(component.id+':c',component.id+':d');entry.sensedVoltage=sensed;entry.reading=sensed===null||entry.current===null?null:sensed*entry.current;}
        else {entry.reading=null;entry.meterStatus='collecting';if(component.type==='ac-wattmeter'){entry.sensedVoltage=voltage(component.id+':c',component.id+':d');entry.power=entry.sensedVoltage===null||entry.current===null?null:entry.sensedVoltage*entry.current;}}
        if(R.dualMeter(component)){const positives=['a','c'].filter(k=>c.connections[component.id][k]),common=c.connections[component.id].b,port=positives.length===1?positives[0]:null;entry.activePort=port;entry.range=port==='c'?p.range/5:p.range;entry.minimum=-entry.range/3;entry.voltage=port?voltage(component.id+':'+port,component.id+':b'):null;entry.current=port?own.find(e=>e.from===component.id+':'+port)?.current??null:null;entry.reading=port&&common?(component.type==='ammeter'?entry.current:entry.voltage):null;}
        if(R.dualMeter(component)){const positives=['a','c'].filter(k=>c.connections[component.id][k]),common=c.connections[component.id].b;entry.division=entry.range/30;entry.meterStatus=positives.length>1?'dual-positive':!entry.activePort?'unconnected':!common?'missing-common':entry.reading===null?'unknown':entry.reading>entry.range||entry.reading<entry.minimum?'overrange':entry.reading<0?'reverse':'normal';if(entry.meterStatus==='dual-positive')diagnostics.push({code:'meter-terminals',component:component.id,message:component.label+'：兩個正極孔同時接線，請只用一個量程孔及共用 − 孔。'});}
        else {const connected=(['wattmeter','ac-wattmeter'].includes(component.type)?['a','b','c','d']:['a','b']).every(k=>c.connections[component.id][k]);entry.minimum=['wattmeter','ac-wattmeter','galvanometer'].includes(component.type)?-entry.range:0;if(component.type==='galvanometer')entry.division=entry.range/20;if(!connected)entry.reading=null;entry.meterStatus=!connected?'unconnected':component.type.startsWith('ac-')?'collecting':entry.reading===null?'unknown':Math.abs(entry.reading)>entry.range?'overrange':entry.reading<0?'reverse':'normal';}
      }
      components[component.id]=entry;
    }
    for(const wire of c.doc.wires){const edge=branches.get(wire.id)?.[0],cut=c.cuts.get(wire.id);wires[wire.id]={...(edge||{}),current:wire.resistance?edge.current:cut?ident(cut):null,voltage:voltage(wire.from,wire.to),potential:potentials[wire.from],potentialTo:potentials[wire.to],resistance:wire.resistance,power:wire.resistance?edge.power:solution.error?null:0,cyclic:!wire.resistance&&!cut};}
    const hazardWires={},hazardComponents={};
    for(const component of c.doc.components){const r=components[component.id];if(component.type==='capacitor'&&Number.isFinite(r.voltage)&&Math.abs(r.voltage)>component.params.rating){hazardComponents[component.id]='overload';diagnostics.push({code:'capacitor-rating',component:component.id,message:component.label+'瞬時電壓超過耐壓值；本模型只提示，未模擬擊穿。'});}}
    const residual=solution.error?null:Math.max(0,...solution.b.map((b,i)=>Math.abs(solution.A[i].reduce((sum,x,j)=>sum+x*solution.x[j],0)-b)/Math.max(1,Math.abs(b))));
    return {mode:'transient',time:state.time,period:c.period,components,wires,potentials,islandOf,references:c.references.map(net=>({island:c.islands.find(net),endpoint:[...c.ports.keys()].find(p=>c.netOf[p]===net),voltage:0})),diagnostics,residual,voltage,energy:energy(c,state),sourceWork:state.work,dissipatedEnergy:state.dissipated,hazards:{wires:hazardWires,components:hazardComponents,short:false,overload:!!Object.keys(hazardWires).length||!!Object.keys(hazardComponents).length}};
  }
  function derive(c,state,solution){const next=clone(state);for(const e of c.dynamic){const coeff=Array(c.n).fill(0);coeff[e.index]=1;const i=solution.identify(coeff),v=solution.identify(c.diff(e.a,e.b));if((e.C?v:i)===null)throw new Error('continuity');next.dynamic[e.id]={i:i??state.dynamic[e.id].i,v:e.C?v:v===null?state.dynamic[e.id].v:v-e.resistance*i};}return next;}
  function one(c,state,h,method,left){const s=solve(c,state,h,method,left);if(s.error)return {error:s.error};let next;try{next=derive(c,state,s);}catch(_){return {error:'continuity'};}next.time+=h;for(const e of c.sources)next.sources[e.c.id]=phaseAt(c,state,e,h);next.event=false;return {state:next,result:read(c,next,s)};}
  function loss(c,result){return c.edges.reduce((sum,e)=>{const b=result.components[e.c.id]?.branches?.find(b=>b.from===e.pa&&b.to===e.pb)||result.wires[e.c.id];if(!Number.isFinite(b?.current))return sum;return sum+(e.kind==='led'?Math.max(0,b.power):e.resistance*b.current*b.current);},0);}
  function supply(c,result){return c.edges.filter(e=>e.kind==='source').reduce((sum,e)=>sum+(result.components[e.c.id].sourcePower??0),0);}
  function accumulate(c,old,next,h){next.state.work=old.sourceWork+h*(supply(c,old)+supply(c,next.result))/2;next.state.dissipated=old.dissipatedEnergy+h*(loss(c,old)+loss(c,next.result))/2;next.result.sourceWork=next.state.work;next.result.dissipatedEnergy=next.state.dissipated;}
  function breakpoint(c,state){let duration=Infinity;for(const e of c.sources){const p=e.c.params;if(e.c.type!=='ac-source'||p.waveform==='sine')continue;const shift=p.waveform==='triangle'?Math.PI/2:0,angle=state.sources[e.c.id],at=AC.wrap(angle-shift)%Math.PI,remaining=Math.PI-at;duration=Math.min(duration,(remaining<1e-9?Math.PI:remaining)/(AC.TAU*p.frequency));}return duration;}
  class Session {
    constructor(doc){this.compiled=compile(doc);this.doc=this.compiled.doc;this.state=initial(this.compiled);this.listeners=new Set();this.tracker=new O.Tracker(this.compiled.period);this.visualTracker=new O.Tracker(.02);this.fault=null;this.project();this.tracker.sample(this.result);this.visualTracker.sample(this.result);}
    project(){const s=solve(this.compiled,this.state);this.fault=s.error||null;if(!s.error){try{this.state=derive(this.compiled,this.state,s);}catch(_){/* Initial open branches can have unknown derivatives, not unknown stored values. */}}this.result=read(this.compiled,this.state,s);return this.result;}
    read(){this.result.measurements=Object.fromEntries(this.doc.components.map(c=>[c.id,this.tracker.measure(c.id)]));
      for(const c of this.doc.components){const r=this.result.components[c.id],q=this.result.measurements[c.id];if(c.type.startsWith('ac-')&&R.isMeter(c)){const connected=(c.type==='ac-wattmeter'?['a','b','c','d']:['a','b']).every(k=>this.compiled.connections[c.id][k]);r.reading=connected&&q.status==='ready'?c.type==='ac-ammeter'?q.currentRms:c.type==='ac-voltmeter'?q.voltageRms:q.averagePower:null;r.meterStatus=!connected?'unconnected':q.status==='ready'?Number.isFinite(r.reading)?Math.abs(r.reading)>r.range?'overrange':'normal':'unknown':q.status;}
        if(c.type==='lamp'){const visual=this.visualTracker.measure(c.id),warning=this.compiled.sources.length?q:visual;r.displayPower=visual.status==='ready'?Math.max(0,visual.averagePower):null;if(warning.status==='ready'&&warning.averagePower>S.hazardLimits.lampRatio*c.params.ratedVoltage**2/c.params.resistance)this.result.hazards.components[c.id]='overload';else delete this.result.hazards.components[c.id];}
      }
      for(const w of this.doc.wires){const q=(this.compiled.sources.length?this.tracker:this.visualTracker).measure('wire:'+w.id);if(q.status==='ready'&&q.currentRms>S.hazardLimits.current)this.result.hazards.wires[w.id]='overload';else delete this.result.hazards.wires[w.id];}
      this.result.hazards.overload=!!Object.keys(this.result.hazards.wires).length||!!Object.keys(this.result.hazards.components).length;return this.result;
    }
    subscribe(fn){if(typeof fn!=='function')throw new TypeError('分析訂閱需要函數');this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    emit(result){this.tracker.sample(result);this.visualTracker.sample(result);for(const fn of this.listeners)fn(result);}
    advance(duration,{budget=Infinity}={}){
      finite(duration,0,1e9);const start=this.state.time,target=start+duration,clock=performance.now();let steps=0;
      while(this.state.time<target-EPS&&!this.fault){if(performance.now()-clock>budget)break;const c=this.compiled,breakAt=breakpoint(c,this.state),h=Math.min(this.state.step,c.maxStep,target-this.state.time,breakAt),atEvent=Math.abs(h-breakAt)<EPS,method=this.state.event?'be':'trap';
        if(h<1e-13){this.fault='numerical';break;}
        const half=one(c,this.state,h/2,method,false),second=half.error?half:one(c,half.state,h/2,method,atEvent),whole=c.dynamic.length?one(c,this.state,h,method,atEvent):second;
        if(whole.error||second.error){this.state.step=h/2;if(this.state.step<1e-12){this.fault=whole.error||second.error;break;}continue;}
        let error=0;for(const e of c.dynamic){const key=e.C?'v':'i',a=whole.state.dynamic[e.id][key],b=second.state.dynamic[e.id][key],old=this.state.dynamic[e.id][key];error=Math.max(error,Math.abs(a-b)/((e.C?1e-8:1e-11)+1e-5*Math.max(Math.abs(a),Math.abs(b),Math.abs(old))));}
        if(error>1){this.state.step=h*Math.max(.15,.8*error**(-1/(method==='be'?2:3)));continue;}
        accumulate(c,this.result,half,h/2);accumulate(c,half.result,second,h/2);this.state=half.state;this.result=half.result;this.emit(half.result);this.state=second.state;this.result=second.result;this.emit(second.result);this.state.step=Math.min(c.maxStep,h*Math.min(2,error?.9*error**(-1/(method==='be'?2:3)):2));steps++;
        if(atEvent){this.state.event=true;this.project();this.emit(this.result);}
      }
      if(this.fault){this.result=read(this.compiled,this.state,{error:this.fault});this.emit(this.result);}
      return {advanced:this.state.time-start,complete:Math.abs(this.state.time-target)<EPS,steps,result:this.read()};
    }
    update(input){const before=this.doc,doc=AC.toAC(input),changed=signature(before)!==signature(doc);if(!changed&&before.display.reference===doc.display.reference){this.doc=doc;this.compiled.doc=doc;return 'geometry';}const next=compile(doc),resetKeys=['capacitance','inductance','primaryTurns','secondaryTurns','coupling','model','phase','initialVoltage','initialCurrent','initialPrimaryCurrent','initialSecondaryCurrent'];
      const reset=structural(before)!==structural(next.doc)||before.components.some(c=>{const n=next.doc.components.find(n=>n.id===c.id);return n&&resetKeys.some(k=>c.params[k]!==n.params[k]);});
      this.compiled=next;this.doc=next.doc;if(reset)this.state=initial(next);else if(changed){this.state.event=true;this.state.step=Math.min(this.state.step,next.maxStep/8);}if(changed){this.tracker=new O.Tracker(next.period);this.visualTracker=new O.Tracker(.02);}this.project();if(changed)this.emit(this.result);return reset?'restarted':changed?'event':'geometry';
    }
    preview(doc){const s=Object.create(Session.prototype);Object.assign(s,{compiled:{...this.compiled},doc:this.doc,state:clone(this.state),listeners:new Set(),tracker:this.tracker,visualTracker:this.visualTracker,fault:this.fault,result:{...this.result,components:clone(this.result.components),wires:clone(this.result.wires)}});s.update(doc);return s.read();}
    reset(){this.state=initial(this.compiled);this.tracker=new O.Tracker(this.compiled.period);this.visualTracker=new O.Tracker(.02);this.project();this.emit(this.result);return this.result;}
    capture(){return {kind:'simlab-circuit-session',version:1,modelRevision:1,document:clone(this.doc),physics:clone(this.state)};}
    static restore(snapshot){keys(snapshot,['kind','version','modelRevision','document','physics']);if(snapshot.kind!=='simlab-circuit-session'||snapshot.version!==1||snapshot.modelRevision!==1||snapshot.document?.version!==7)throw new Error('動態快照版本無效');const s=new Session(snapshot.document),p=snapshot.physics;
      keys(p,['time','step','sources','dynamic','work','dissipated','event']);finite(p.time,0,1e9);finite(p.step,1e-13,1);finite(p.work,-Number.MAX_VALUE,Number.MAX_VALUE);finite(p.dissipated,0,Number.MAX_VALUE);if(typeof p.event!=='boolean')throw new Error('事件旗標無效');keys(p.sources,Object.keys(s.state.sources));for(const x of Object.values(p.sources))finite(x,0,AC.TAU);keys(p.dynamic,Object.keys(s.state.dynamic));for(const x of Object.values(p.dynamic)){keys(x,['i','v']);finite(x.i);finite(x.v);}
      s.state=clone(p);s.project();if(!s.fault)for(const e of s.compiled.dynamic){const a=s.state.dynamic[e.id],b=p.dynamic[e.id];for(const key of ['i','v'])if(Math.abs(a[key]-b[key])>1e-6*Math.max(1,Math.abs(a[key]),Math.abs(b[key])))throw new Error('動態快照不符合電路約束');}
      s.state=clone(p);const solution=solve(s.compiled,s.state,0,'trap',false,!s.fault&&!p.event);if(solution.error&&!s.fault)throw new Error('動態快照不符合電路歷史約束');s.result=read(s.compiled,s.state,solution);s.tracker=new O.Tracker(s.compiled.period);s.visualTracker=new O.Tracker(.02);s.tracker.sample(s.result);s.visualTracker.sample(s.result);return s;
    }
    destroy(){this.listeners.clear();}
  }
  function run(document,{initialState=null,events=[],until}={}){finite(until,0,1e9);let s=initialState?Session.restore(initialState):new Session(document);if(initialState&&signature(s.doc)!==signature(AC.toAC(document)))throw new Error('離線初始狀態電路不符');let last=s.state.time;for(const event of events){keys(event,['time','command']);finite(event.time,last,until);s.advance(event.time-s.state.time);if(s.fault)break;const d=clone(s.doc),command=event.command,c=d.components.find(c=>c.id===command.id);if(!c)throw new Error('事件元件不存在');if(command.type==='setParam'){keys(command,['type','id','key','value']);if(!Object.hasOwn(c.params,command.key))throw new Error('事件參數不存在');c.params[command.key]=command.value;}else if(command.type==='toggleSwitch'){keys(command,['type','id']);if(c.type==='switch')c.params.closed=!c.params.closed;else if(c.type==='spdt')c.params.closed=c.params.closed==='b'?'c':'b';else throw new Error('事件需要開關');}else throw new Error('不支援的運算事件');if(s.update(d)==='restarted')throw new Error('離線事件表不能重設初始條件；請另開一次運算');last=event.time;}s.advance(until-s.state.time);return s;}
  return {Session,run,compile,signature,modelRevision:1};
});
