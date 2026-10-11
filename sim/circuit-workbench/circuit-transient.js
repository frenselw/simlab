(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./circuit-model'):root.CircuitModel,node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-solver'):root.CircuitSolver,node?require('./circuit-ac-components'):root.CircuitAC,node?require('./circuit-observation'):root.CircuitObservation);
  if(node)module.exports=api;else root.CircuitTransient=api;
})(globalThis,function(M,R,S,AC,O){
  'use strict';
  const clone=M.clone,EPS=1e-12;
  const MIN_STEP=1e-13;
  const energySolutions=new WeakMap();
  const keys=(o,names)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==names.length||names.some(k=>!Object.hasOwn(o,k)))throw new Error('動態快照欄位無效');};
  const finite=(x,min=-1e12,max=1e12)=>{if(!Number.isFinite(x)||x<min||x>max)throw new Error('動態快照數值無效');return x;};
  function union(ids){const p=new Map(ids.map(k=>[k,k]));const find=k=>{let r=k;while(p.get(r)!==r)r=p.get(r);while(k!==r){const n=p.get(k);p.set(k,r);k=n;}return r;};return {find,join(a,b){p.set(find(a),find(b));}};}
  const byId=(a,b)=>a[0].localeCompare(b[0]);
  function signature(doc){return JSON.stringify({components:doc.components.map(c=>[c.id,c.type,Object.entries(c.params).sort()]).sort(byId),wires:doc.wires.map(w=>[w.id,w.from,w.to,w.resistance]).sort(byId)});}
  function structural(doc){return JSON.stringify({components:doc.components.map(c=>[c.id,c.type]).sort(byId),wires:doc.wires.map(w=>[w.id,w.from,w.to]).sort(byId)});}
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
    const dynamic=edges.filter(e=>['capacitor','inductor'].includes(e.kind));
    // Electrical islands stay isolated for voltage probes. Magnetic coupling also
    // joins their measurement dependencies, without joining electrical references.
    const domains=union(nets);for(const e of edges)domains.join(e.a,e.b);for(const t of transformers)if(t.kind==='ideal-primary'||t.mutual!==0)domains.join(t.a,t.other.a);
    const rootsOf=component=>[...new Set(R.localPorts(component).map(p=>domains.find(netOf[component.id+':'+p.key])))].sort();
    const policies=new Map(),cache=new Map();
    function policy(roots){
      const key=JSON.stringify(roots);if(cache.has(key))return cache.get(key);
      const includes=net=>roots.includes(domains.find(net)),members=doc.components.filter(c=>rootsOf(c).some(root=>roots.includes(root))),wires=doc.wires.filter(w=>includes(netOf[w.from])||includes(netOf[w.to]));
      const cs=dynamic.filter(e=>e.C&&includes(e.a)),ls=dynamic.filter(e=>e.L&&includes(e.a)),natural=cs.length===1&&ls.length===1?AC.TAU*Math.sqrt(cs[0].C*ls[0].L):null;
      const selected=O.measurementWindow(sources.filter(e=>includes(e.a)).map(e=>e.c.params.frequency),natural);selected.sourceCount=edges.filter(e=>e.kind==='source'&&includes(e.a)).length;
      selected.key=JSON.stringify({components:members.map(c=>[c.id,c.type,Object.entries(c.params).sort()]).sort((a,b)=>a[0].localeCompare(b[0])),wires:wires.map(w=>[w.id,w.from,w.to,w.resistance]).sort((a,b)=>a[0].localeCompare(b[0])),window:selected.window,kind:selected.windowKind});cache.set(key,selected);return selected;
    }
    for(const component of doc.components){const primary=component.type==='transformer'?[domains.find(netOf[component.id+':a'])]:rootsOf(component);policies.set(component.id,policy(primary));if(component.type==='transformer')policies.set(component.id+'~secondary',policy([domains.find(netOf[component.id+':c'])]));}
    for(const wire of doc.wires)policies.set('wire:'+wire.id,policy([...new Set([domains.find(netOf[wire.from]),domains.find(netOf[wire.to])])].sort()));
    const selectedPolicies=[...policies.values()],windows=[...new Set(selectedPolicies.map(p=>p.window))],period=selectedPolicies.length&&selectedPolicies.every(p=>p.period!==null&&p.period===selectedPolicies[0].period)?selectedPolicies[0].period:null,samplingPeriod=windows.length?Math.min(...windows):1;
    // Algebraic circuits need waveform quadrature, not stored-energy error estimates.
    const samples=dynamic.length?128:32;
    let maxStep=Math.min(.02,samplingPeriod/samples);for(const source of sources)maxStep=Math.min(maxStep,1/source.c.params.frequency/samples);
    const cs=dynamic.filter(e=>e.C),ls=dynamic.filter(e=>e.L);if(cs.length&&ls.length)maxStep=Math.min(maxStep,AC.TAU*Math.sqrt(Math.min(...cs.map(e=>e.C))*Math.min(...ls.map(e=>e.L)))/128);
    const adjacency=new Map([...ports.keys()].map(p=>[p,[]]));for(const w of doc.wires.filter(w=>!w.resistance)){adjacency.get(w.from).push({to:w.to,id:w.id});adjacency.get(w.to).push({to:w.from,id:w.id});}
    // Compile ideal-wire cuts once. A cycle current is unidentifiable, never a chosen zero.
    const injections=new Map([...ports.keys()].map(p=>[p,{coeff:Array(n).fill(0)}])),netPorts=new Map(nets.map(net=>[net,[...ports.keys()].filter(p=>netOf[p]===net)]));for(const e of edges){injections.get(e.pa).coeff[e.index]++;injections.get(e.pb).coeff[e.index]--;}
    const cuts=new Map();for(const w of doc.wires.filter(w=>!w.resistance)){const seen=new Set([w.from]),todo=[w.from];while(todo.length){const at=todo.pop();for(const e of adjacency.get(at))if(e.id!==w.id&&!seen.has(e.to)){seen.add(e.to);todo.push(e.to);}}if(seen.has(w.to)){cuts.set(w.id,null);continue;}cuts.set(w.id,S.cutExpressions(netPorts.get(netOf[w.from]),seen,n,p=>injections.get(p)));}
    const connections=Object.fromEntries(doc.components.filter(R.isMeter).map(c=>[c.id,Object.fromEntries(R.localPorts(c).map(p=>[p.key,M.degree(doc,c.id+':'+p.key)>0]))]));
    const invalidDC=transformers.some(e=>e.kind==='ideal-primary'&&edges.some(s=>s.c.type==='battery'&&[islands.find(e.a),islands.find(e.other.a)].includes(islands.find(s.a))));
    const energyGroups=new Map();for(const e of edges){const root=domains.find(e.a);if(!energyGroups.has(root))energyGroups.set(root,[]);energyGroups.get(root).push(e);}const energyDomains=new Map(),energyDomainOf=new Map();for(const members of energyGroups.values()){const key=JSON.stringify(members.map(e=>[e.id,e.pa,e.pb]).sort(byId));energyDomains.set(key,members);for(const e of members)energyDomainOf.set(e.id,key);}
    const compiled={doc,ports,netOf,islands,index,n,edges,dynamic,sources,period,policies,maxStep,diff,cuts,invalidDC,references,connections,energyDomains,energyDomainOf};
    const scales=dynamic.map(e=>{const members=energyDomains.get(energyDomainOf.get(e.id)).filter(x=>e.C?x.C:x.L),resistances=[passiveResistance(compiled,e),...(e.C?[passiveResistance(compiled,{...e,_openCapacitors:true})]:[])],resistance=e.C?Math.min(...resistances.filter(r=>r>0&&Number.isFinite(r))):resistances[0],capacitance=members.filter(x=>x.C).reduce((sum,x)=>sum+1/x.C,0),inductance=members.length?Math.min(...members.map(x=>x.L))/members.length:e.L,time=e.C?Number.isFinite(resistance)?resistance/capacitance:Infinity:inductance*Math.max(1e-9,e.other&&e.mutual!==0?1-e.c.params.coupling:1)/(resistance+e.resistance);e.startStep=Number.isFinite(time)&&time>0?time/16:Infinity;return e.startStep;});
    compiled.initialStep=Math.min(maxStep/8,...scales);return compiled;
  }
  // Driving-point resistance with independent sources suppressed. A remote
  // high-impedance meter must not become a fictitious series resistance in L/R.
  function passiveResistance(c,target){
    const uf=union([...new Set(Object.values(c.netOf))]),resistors=[];
    for(const e of c.edges){if(e.id===target.id)continue;
      const parallelCap=target.C&&e.C&&((e.a===target.a&&e.b===target.b)||(e.a===target.b&&e.b===target.a));
      const short=e.kind==='capacitor'&&!parallelCap&&!target._openCapacitors||['source','resistor','led'].includes(e.kind)&&e.resistance===0||e.kind==='inductor'&&(target.C||target._shortInductors)&&e.resistance===0;
      if(short)uf.join(e.a,e.b);else if(e.resistance>0&&(['source','resistor','led'].includes(e.kind)||e.kind==='inductor'&&(target.C||target._shortInductors)))resistors.push(e);
    }
    const a=uf.find(target.a),b=uf.find(target.b);if(a===b)return 0;
    const adjacency=new Map();for(const e of resistors){const x=uf.find(e.a),y=uf.find(e.b);if(x===y)continue;for(const [from,to]of [[x,y],[y,x]]){if(!adjacency.has(from))adjacency.set(from,[]);adjacency.get(from).push({to,g:1/e.resistance});}}
    const seen=new Set([a]),pending=[a];while(pending.length)for(const e of adjacency.get(pending.pop())||[])if(!seen.has(e.to)){seen.add(e.to);pending.push(e.to);}if(!seen.has(b)){if(target.L&&!target._shortInductors){const copy={...target,_shortInductors:true};return passiveResistance(c,copy);}return Infinity;}
    const nodes=[...seen].filter(x=>x!==a&&x!==b),index=new Map(nodes.map((x,i)=>[x,i])),matrix=nodes.map(()=>Array(nodes.length).fill(0)),rhs=nodes.map(()=>0);
    for(const [x,i]of index)for(const {to,g}of adjacency.get(x)){matrix[i][i]+=g;if(index.has(to))matrix[i][index.get(to)]-=g;else if(to===a)rhs[i]+=g;}
    const solution=S.linear(matrix,rhs);if(solution.error)return Infinity;
    const current=(adjacency.get(a)||[]).reduce((sum,{to,g})=>sum+g*(1-(to===b?0:solution.x[index.get(to)])),0);return current>0?1/current:Infinity;
  }
  function initial(c){const dynamic={};for(const e of c.dynamic){const p=e.c.params;dynamic[e.id]={i:e.C?0:e.c.type==='transformer'?(e.pa.endsWith(':a')?p.initialPrimaryCurrent:p.initialSecondaryCurrent):p.initialCurrent,v:e.C?p.initialVoltage:0};}const state={time:0,step:Math.max(MIN_STEP,c.initialStep),sources:Object.fromEntries(c.sources.map(e=>[e.c.id,AC.wrap(e.c.params.phase*Math.PI/180)])),dynamic,work:0,dissipated:0,event:true};rebaseEnergy(c,state);return state;}
  function rebaseEnergy(c,state,preserve=false){
    const previous=preserve?state.energyDomains:null,origin=previous?{...state.energyOrigin}:{work:state.work,dissipated:state.dissipated};
    if(previous)for(const [key,q]of Object.entries(previous))if(!c.energyDomains.has(key)){origin.work+=q.work;origin.dissipated+=q.dissipated;}
    state.energyOrigin=origin;state.energyDomains=Object.fromEntries([...c.energyDomains].map(([key,edges])=>[key,previous?.[key]||{initial:energy(c,state,edges),work:0,dissipated:0,throughput:0}]));
  }
  function eventStep(c,result){
    const active=new Set();
    for(const e of c.dynamic){const b=result.components[e.c.id].branches.find(b=>b.from===e.pa&&b.to===e.pb),rate=e.C?b.current:Number.isFinite(b.voltage)&&Number.isFinite(b.current)?b.voltage-e.resistance*b.current:null;if(!Number.isFinite(rate)||rate!==0)active.add(c.energyDomainOf.get(e.id));}
    for(const e of c.sources)if(e.c.type==='generator'?e.c.params.field>0:e.c.params.voltage>0)active.add(c.energyDomainOf.get(e.id));
    // A passive equilibrium has no fast transition to resolve. Unrelated AC
    // excitation cannot make its zero/current-balanced state unrepresentable.
    return Math.min(c.maxStep/8,...c.dynamic.filter(e=>active.has(c.energyDomainOf.get(e.id))).map(e=>e.startStep));
  }
  function phaseAt(c,state,e,h){return AC.wrap(state.sources[e.c.id]+AC.TAU*e.c.params.frequency*h);}
  function sourceSlope(c,state){
    if(c.type==='battery')return 0;const p=c.params,angle=state.sources[c.id],omega=AC.TAU*p.frequency;
    if(c.type==='generator')return p.turns*p.field*p.area*omega*omega*Math.cos(angle);
    if(p.waveform==='square')return 0;
    if(p.waveform==='triangle'){const right=AC.wrap(angle+1e-11);return 4*p.frequency*p.voltage*Math.sqrt(3)*(right<Math.PI/2||right>=3*Math.PI/2?1:-1);}
    return p.voltage*Math.SQRT2*omega*Math.cos(angle);
  }
  function initialSolution(c,state){
    const solution=solve(c,state);if(solution.error||!c.dynamic.length)return solution;
    // Differentiate the algebraic constraints once. This identifies capacitor
    // currents at an ideal voltage source without choosing arbitrary zero histories.
    const size=c.n,byRow=new Map(c.edges.map(e=>[e.index,e])),matrix=solution.A.map(row=>[...row,...Array(size).fill(0)]),rhs=[...solution.b];
    for(let i=0;i<size;i++){const row=Array(2*size).fill(0),e=byRow.get(i);let value=0;
      if(e?.C){const d=c.diff(e.a,e.b);for(let j=0;j<size;j++)row[size+j]=d[j];row[e.index]=-1/e.C;}
      else if(e?.kind==='inductor'){const d=c.diff(e.a,e.b);for(let j=0;j<size;j++)row[j]=d[j];row[e.index]-=e.resistance;row[size+e.index]-=e.L;if(e.other)row[size+e.other.index]-=e.mutual;}
      else{for(let j=0;j<size;j++)row[size+j]=solution.A[i][j];if(e?.kind==='source')value=sourceSlope(e.c,state);}
      matrix.push(row);rhs.push(value);
    }
    const consistent=S.linear(matrix,rhs);if(consistent.error)return solution;
    const estimate=(d,constant=0)=>S.estimateLinear(consistent,d,constant,1e-10),identify=d=>S.reading(estimate(d));return {...consistent,A:solution.A,b:solution.b,estimate,identify};
  }
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
      const estimate=(d,constant=0)=>S.estimateLinear(s,d,constant,1e-10),identify=d=>S.reading(estimate(d));
      answer={...s,identify,estimate,A,b};let changed=false;
      for(const e of c.edges.filter(e=>e.kind==='led')){const v=identify(c.diff(e.a,e.b)),i=s.x[e.index],next=active.get(e.id)?i>0:v!==null&&v>e.c.params.forwardVoltage+1e-10;if(next!==active.get(e.id)){active.set(e.id,next);changed=true;}}
      if(!changed)return answer;
    }
    return {error:'convergence'};
  }
  const errors={inconsistent:'理想電源、電容電壓或線圈電流條件互相矛盾；請加入明確的電阻／放電路徑或改接線。',numerical:'數值未得到可靠解，模擬已暫停。',convergence:'元件模型未能收斂，模擬已暫停。','dc-transformer':'理想交流變壓器不支援直流激勵；請改用線性線圈模型。',continuity:'儲能狀態無法唯一確定，模擬已暫停。','time-resolution':'暫態變化快過可可靠解析的時間尺度，模擬已暫停；請調整元件參數，放慢暫態。','energy-history':'舊快照只保存全畫布能量，無法核證各獨立電路的歷史；請重設模擬開始新實驗。','energy-balance':'能量平衡未能達到可靠容差，模擬已暫停。'};
  function energy(c,state,edges=c.edges){let value=0;for(const e of edges){if(e.C)value+=.5*e.C*state.dynamic[e.id].v**2;else if(e.kind==='inductor'){const i=state.dynamic[e.id].i;if(e.other&&e.mutual!==0){if(e.pa.endsWith(':a')){const j=state.dynamic[e.other.id].i,k=e.c.params.coupling;value+=.5*(1-k)*(e.L*i*i+e.other.L*j*j)+.5*k*(Math.sqrt(e.L)*i+Math.sqrt(e.other.L)*j)**2;}}else value+=.5*e.L*i*i;}}return value;}
  function read(c,state,solution,left=false){
    const ident=solution.error?()=>null:solution.identify,voltage=(a,b)=>{if(!c.ports.has(a)||!c.ports.has(b)||c.islands.find(c.netOf[a])!==c.islands.find(c.netOf[b]))return null;return ident(c.diff(c.netOf[a],c.netOf[b]));};
    const potentials={},islandOf={},components={},wires={},branches=new Map();
    for(const p of c.ports.keys()){potentials[p]=ident(c.diff(c.netOf[p],c.references.find(r=>c.islands.find(r)===c.islands.find(c.netOf[p]))));islandOf[p]=c.islands.find(c.netOf[p]);}
    for(const e of c.edges){const current=ident(Array.from({length:c.n},(_,i)=>i===e.index?1:0)),v=voltage(e.pa,e.pb),power=v===null||current===null?null:v*current,r={from:e.pa,to:e.pb,current,voltage:v,power,resistance:e.resistance};if(!branches.has(e.c.id))branches.set(e.c.id,[]);branches.get(e.c.id).push(r);}
    const diagnostics=solution.error?[{code:solution.error,message:errors[solution.error]||errors.numerical}]:[];
    for(const component of c.doc.components){const p=component.params,own=branches.get(component.id)||[],r=own[0]||{voltage:voltage(component.id+':a',component.id+':b'),current:['switch','ac-voltmeter','voltmeter'].includes(component.type)?0:null,power:0,resistance:null};
      const entry={...r,branches:own,power:own.some(e=>e.power===null)?null:own.reduce((s,e)=>s+e.power,0)};
      if(component.type==='capacitor'){entry.charge=p.capacitance*state.dynamic[component.id+':a'].v;entry.energy=.5*p.capacitance*state.dynamic[component.id+':a'].v**2;entry.resistance=null;}
      if(component.type==='inductor')entry.energy=.5*p.inductance*state.dynamic[component.id+':a'].i**2;
      if(component.type==='transformer'){entry.secondaryVoltage=voltage(component.id+':c',component.id+':d');entry.secondaryCurrent=own[1]?.current??null;entry.inputPower=own[0]?.power??null;entry.outputPower=own[1]?.power===null?null:-own[1]?.power;if(p.model==='ideal'){entry.coreVoltage=entry.voltage;entry.coreTurns=p.primaryTurns;}if(p.model==='coupled'){const a=state.dynamic[component.id+':a'].i,b=state.dynamic[component.id+':c'].i,l2=p.inductance*(p.secondaryTurns/p.primaryTurns)**2;entry.coreFlux=p.coupling*p.inductance*(a+p.secondaryTurns/p.primaryTurns*b)/p.primaryTurns;entry.coreFluxStatus='ready';entry.energy=energy(c,state,c.edges.filter(e=>e.c.id===component.id));}}
      if(['battery','ac-source','generator'].includes(component.type)){entry.delivered=entry.power===null?null:-entry.power;entry.internalPower=p.resistance===0?0:entry.current===null?null:p.resistance*entry.current**2;entry.phase=state.sources[component.id]??0;entry.sourceEmf=AC.source(component,entry.phase,left);entry.sourcePower=entry.current===null?null:-entry.sourceEmf*entry.current;if(component.type==='generator'){entry.flux=p.field*p.area*Math.cos(entry.phase);entry.fluxLinkage=p.turns*entry.flux;}}
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
    for(const wire of c.doc.wires){const edge=branches.get(wire.id)?.[0],cut=c.cuts.get(wire.id);wires[wire.id]={...(edge||{}),current:wire.resistance?edge.current:cut&&!solution.error?S.reading(S.bestCut(cut,solution.estimate)):null,voltage:voltage(wire.from,wire.to),potential:potentials[wire.from],potentialTo:potentials[wire.to],resistance:wire.resistance,power:wire.resistance?edge.power:solution.error?null:0,cyclic:!wire.resistance&&!cut};}
    const hazardWires={},hazardComponents={};
    for(const component of c.doc.components){const r=components[component.id];if(component.type==='capacitor'&&Number.isFinite(r.voltage)&&Math.abs(r.voltage)>component.params.rating){hazardComponents[component.id]='overload';diagnostics.push({code:'capacitor-rating',component:component.id,message:component.label+'瞬時電壓超過耐壓值；本模型只提示，未模擬擊穿。'});}}
    const residual=solution.error?null:Math.max(0,...solution.b.map((b,i)=>Math.abs(solution.A[i].reduce((sum,x,j)=>sum+x*solution.x[j],0)-b)/Math.max(1,Math.abs(b))));
    const result={mode:'transient',reliable:!solution.error,time:state.time,period:c.period,components,wires,potentials,islandOf,references:c.references.map(net=>({island:c.islands.find(net),endpoint:[...c.ports.keys()].find(p=>c.netOf[p]===net),voltage:0})),diagnostics,residual,voltage,energy:energy(c,state),sourceWork:solution.error?null:state.work,dissipatedEnergy:solution.error?null:state.dissipated,hazards:{wires:hazardWires,components:hazardComponents,short:false,overload:!!Object.keys(hazardWires).length||!!Object.keys(hazardComponents).length}};
    if(!solution.error)energySolutions.set(result,{estimate:solution.estimate,emfs:solution.b,ledger:state.energyDomains,stored:Object.fromEntries([...c.energyDomains].map(([key,edges])=>[key,energy(c,state,edges)]))});return result;
  }
  function derive(c,state,solution){const next=clone(state);for(const e of c.dynamic){const coeff=Array(c.n).fill(0);coeff[e.index]=1;const i=solution.identify(coeff),v=solution.identify(c.diff(e.a,e.b));if((e.C?v:i)===null)throw new Error('continuity');next.dynamic[e.id]={i:i??state.dynamic[e.id].i,v:e.C?v:v===null?state.dynamic[e.id].v:v-e.resistance*i};}return next;}
  function one(c,state,h,method,left){const s=solve(c,state,h,method,left);if(s.error)return {error:s.error};let next;try{next=derive(c,state,s);}catch(_){return {error:'continuity'};}next.time+=h;for(const e of c.sources)next.sources[e.c.id]=phaseAt(c,state,e,h);next.event=false;return {state:next,result:read(c,next,s,left)};}
  function accumulate(c,old,next,h){
    const branch=(result,e)=>result.components[e.c.id]?.branches?.find(b=>b.from===e.pa&&b.to===e.pb)||result.wires[e.c.id],before=energySolutions.get(old),after=energySolutions.get(next.result);let error=0,totalWork=0,totalLoss=0;
    for(const [key,edges]of c.energyDomains){const power=Array(c.n).fill(0);let loss=0;
      for(const e of edges){if(e.kind==='source')power[e.index]=-(before.emfs[e.index]+after.emfs[e.index])/2;
        if(!e.resistance&&e.kind!=='led')continue;const a=branch(old,e),b=branch(next.result,e);if(!Number.isFinite(a?.current)||!Number.isFinite(b?.current))return Infinity;const i=(a.current+b.current)/2;
        loss+=h*(e.resistance*i*i+(e.kind==='led'?e.c.params.forwardVoltage*Math.max(0,i):0));
      }
      // Equal ideal sources can have unknown individual currents but identifiable
      // total work. Evaluate that weighted sum inside its actual energy domain.
      const p0=S.reading(before.estimate(power)),p1=S.reading(after.estimate(power));if(p0===null||p1===null)return Infinity;const work=h*(p0+p1)/2,stored=after.stored[key],previous=before.stored[key];
      const defect=stored-previous+loss-work,scale=Math.max(previous,stored,Math.abs(work-loss)),tolerance=1e-14+1e-5*scale+256*Number.EPSILON*(Math.abs(work)+loss+scale);
      error=Math.max(error,Math.abs(defect)/tolerance);const ledger=before.ledger[key];next.state.energyDomains[key]={initial:ledger.initial,work:ledger.work+work,dissipated:ledger.dissipated+loss,throughput:ledger.throughput+Math.abs(work)+loss};totalWork+=work;totalLoss+=loss;
    }
    next.state.work=old.sourceWork+totalWork;next.state.dissipated=old.dissipatedEnergy+totalLoss;next.result.sourceWork=next.state.work;next.result.dissipatedEnergy=next.state.dissipated;
    // read() created this record before integration; keep its accepted ledger current.
    after.ledger=next.state.energyDomains;return error;
  }
  function energyBalance(c,state){
    const domains=Object.fromEntries([...c.energyDomains].map(([key,edges])=>{const q=state.energyDomains[key],stored=energy(c,state,edges),residual=stored+q.dissipated-q.initial-q.work,tolerance=1e-14+1e-3*Math.max(q.initial,q.throughput,Math.abs(q.work),stored+q.dissipated)+256*Number.EPSILON*(Math.abs(q.work)+q.dissipated+stored);return [key,{initial:q.initial,source:q.work,stored,dissipated:q.dissipated,residual,tolerance,status:Math.abs(residual)<=tolerance?'reliable':'unreliable'}];}));
    const rows=Object.values(domains),sum=key=>rows.reduce((n,q)=>n+q[key],0),initial=sum('initial')+state.energyOrigin.dissipated-state.energyOrigin.work,stored=sum('stored'),residual=stored+state.dissipated-initial-state.work,tolerance=sum('tolerance'),workError=state.work-state.energyOrigin.work-sum('source'),lossError=state.dissipated-state.energyOrigin.dissipated-sum('dissipated'),roundoff=1e-14+512*Number.EPSILON*(Math.abs(state.work)+state.dissipated+Math.abs(state.energyOrigin.work)+state.energyOrigin.dissipated+sum('dissipated')+rows.reduce((n,q)=>n+Math.abs(q.source),0));
    return {initial,source:state.work,stored,dissipated:state.dissipated,residual,tolerance,domains,status:rows.every(q=>q.status==='reliable')&&Math.abs(workError)<=roundoff&&Math.abs(lossError)<=roundoff?'reliable':'unreliable'};
  }
  function breakpoint(c,state){let duration=Infinity;for(const e of c.sources){const p=e.c.params;if(e.c.type!=='ac-source'||p.waveform==='sine')continue;const shift=p.waveform==='triangle'?Math.PI/2:0,angle=state.sources[e.c.id],at=AC.wrap(angle-shift)%Math.PI,remaining=Math.PI-at;duration=Math.min(duration,(remaining<1e-9?Math.PI:remaining)/(AC.TAU*p.frequency));}return duration;}
  class Session {
    constructor(doc){this.compiled=compile(doc);this.doc=this.compiled.doc;this.state=initial(this.compiled);this.listeners=new Set();this.tracker=new O.GroupTracker(this.compiled.policies);this.visualTracker=new O.Tracker(.02);this.coreTracker=new O.CoreFluxTracker(this.compiled.policies);this.fault=null;this.project();this.tracker.sample(this.result);this.visualTracker.sample(this.result);this.coreTracker.sample(this.result);}
    project({initialise=this.state.event,history=!this.state.event}={}){const s=initialise?initialSolution(this.compiled,this.state):solve(this.compiled,this.state,0,'trap',false,history);this.fault=s.error||null;if(!s.error){try{this.state=derive(this.compiled,this.state,s);}catch(_){/* Initial open branches can have unknown derivatives, not unknown stored values. */}}this.result=read(this.compiled,this.state,s);return this.result;}
    read(){this.result.energyBalance=energyBalance(this.compiled,this.state);if(this.fault)this.result.energyBalance.status='unreliable';this.result.measurements=Object.fromEntries(this.doc.components.map(c=>[c.id,this.fault?{...this.tracker.measure(c.id),status:'unknown',voltageStatus:'unknown',currentStatus:'unknown',powerStatus:'unknown',voltageRms:null,currentRms:null,averagePower:null,voltagePeak:null,currentPeak:null}:this.tracker.measure(c.id)]));
      for(const c of this.doc.components){const r=this.result.components[c.id],q=this.result.measurements[c.id];r.currentPeak=q.currentStatus==='ready'?q.currentPeak:null;r.voltagePeak=q.voltageStatus==='ready'?q.voltagePeak:null;if(c.type==='transformer'){if(c.params.model==='ideal'){const flux=this.coreTracker.measure(c.id),policy=this.compiled.policies.get(c.id);r.coreFluxWindow=policy.window;r.coreFluxWindowKind=policy.windowKind;r.coreFluxFrequencies=policy.frequencies;r.coreFlux=flux.value;r.coreFluxPeak=flux.peak;r.coreFluxStatus=flux.status;}const secondary=this.tracker.measure(c.id+'~secondary');r.secondaryCurrentPeak=!this.fault&&secondary.currentStatus==='ready'?secondary.currentPeak:null;}if(c.type.startsWith('ac-')&&R.isMeter(c)){const connected=(c.type==='ac-wattmeter'?['a','b','c','d']:['a','b']).every(k=>this.compiled.connections[c.id][k]);const status=c.type==='ac-ammeter'?q.currentStatus:c.type==='ac-voltmeter'?q.voltageStatus:q.powerStatus;r.reading=connected&&status==='ready'?c.type==='ac-ammeter'?q.currentRms:c.type==='ac-voltmeter'?q.voltageRms:q.averagePower:null;r.meterStatus=!connected?'unconnected':status==='ready'?Number.isFinite(r.reading)?Math.abs(r.reading)>r.range?'overrange':'normal':'unknown':status;}
        if(c.type==='lamp'){const visual=this.visualTracker.measure(c.id),warning=q.frequencies.length?q:visual;r.displayPower=visual.powerStatus==='ready'?Math.max(0,visual.averagePower):null;// Before a full window, only strong overloads exceeding the three-waveform crest bound use short-window evidence.
          if(!this.fault&&(warning.powerStatus==='ready'?warning.averagePower:visual.powerStatus==='ready'&&q.sourceCount<=1?visual.averagePower/3:null)>S.hazardLimits.lampRatio*c.params.ratedVoltage**2/c.params.resistance)this.result.hazards.components[c.id]='overload';else delete this.result.hazards.components[c.id];}
      }
      for(const w of this.doc.wires){const measured=this.tracker.measure('wire:'+w.id);this.result.wires[w.id].currentPeak=!this.fault&&measured.currentStatus==='ready'?measured.currentPeak:null;const q=measured.frequencies.length?measured:this.visualTracker.measure('wire:'+w.id);if(!this.fault&&q.currentStatus==='ready'&&q.currentRms>S.hazardLimits.current)this.result.hazards.wires[w.id]='overload';else delete this.result.hazards.wires[w.id];}
      this.result.hazards.overload=!!Object.keys(this.result.hazards.wires).length||!!Object.keys(this.result.hazards.components).length;return this.result;
    }
    subscribe(fn){if(typeof fn!=='function')throw new TypeError('分析訂閱需要函數');this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    emit(result){this.tracker.sample(result);this.visualTracker.sample(result);this.coreTracker.sample(result);for(const fn of this.listeners)fn(result);}
    advance(duration,{budget=Infinity}={}){
      finite(duration,0,1e9);const start=this.state.time,target=start+duration,timeTolerance=Math.max(8*Number.EPSILON*Math.max(Math.abs(start),Math.abs(target)),Math.min(EPS,duration*1e-10)),clock=performance.now();let steps=0;if(duration>0&&target===start)this.fault='time-resolution';
      while(this.state.time<target-timeTolerance&&!this.fault){if(performance.now()-clock>budget)break;const c=this.compiled,startStep=this.state.event?eventStep(c,this.result):Infinity;if(this.state.event&&c.initialStep<MIN_STEP&&startStep>=MIN_STEP)this.state.step=Math.max(this.state.step,startStep);const breakAt=breakpoint(c,this.state),h=Math.min(this.state.step,c.maxStep,startStep,target-this.state.time,breakAt),atEvent=Math.abs(h-breakAt)<Math.min(EPS,h*1e-8),method=this.state.event?'be':'trap';
        if(h<MIN_STEP||this.state.time+h===this.state.time){this.fault='time-resolution';break;}
        const half=one(c,this.state,h/2,method,false),second=half.error?half:one(c,half.state,h/2,method,atEvent),whole=c.dynamic.length?one(c,this.state,h,method,atEvent):second;
        if(whole.error||second.error){this.state.step=h/2;if(this.state.step<1e-12){this.fault=whole.error||second.error;break;}continue;}
        let error=0;for(const e of c.dynamic){const key=e.C?'v':'i',a=whole.state.dynamic[e.id][key],b=second.state.dynamic[e.id][key],old=this.state.dynamic[e.id][key];error=Math.max(error,Math.abs(a-b)/((e.C?1e-8:1e-11)+1e-5*Math.max(Math.abs(a),Math.abs(b),Math.abs(old))));}
        const energyError=Math.max(accumulate(c,this.result,half,h/2),accumulate(c,half.result,second,h/2));error=Math.max(error,energyError);
        if(error>1){this.state.step=h*Math.max(.15,.8*error**(-1/(method==='be'?2:3)));if(this.state.step<MIN_STEP){this.fault=energyError>1?'energy-balance':'time-resolution';break;}continue;}
        if(energyBalance(c,second.state).status!=='reliable'){this.state.step=h/2;if(this.state.step<MIN_STEP){this.fault='energy-balance';break;}continue;}
        this.state=half.state;this.result=half.result;this.emit(half.result);this.state=second.state;this.result=second.result;this.emit(second.result);this.state.step=Math.min(c.maxStep,h*Math.min(2,error?.9*error**(-1/(method==='be'?2:3)):2));steps++;
        if(atEvent){this.state.event=true;this.project();this.emit(this.result);}
      }
      if(this.fault){this.state.step=Math.max(MIN_STEP,this.state.step);this.result=read(this.compiled,this.state,{error:this.fault});this.emit(this.result);}
      return {advanced:this.state.time-start,complete:!this.fault&&Math.abs(this.state.time-target)<=timeTolerance,steps,result:this.read()};
    }
    update(input,{continuous=false}={}){const before=this.doc,doc=AC.toAC(input),changed=signature(before)!==signature(doc);if(!changed&&before.display.reference===doc.display.reference){this.doc=doc;this.compiled.doc=doc;return 'geometry';}const next=compile(doc),resetKeys=['capacitance','inductance','primaryTurns','secondaryTurns','coupling','model','phase','initialVoltage','initialCurrent','initialPrimaryCurrent','initialSecondaryCurrent'];
      const reset=structural(before)!==structural(next.doc)||before.components.some(c=>{const n=next.doc.components.find(n=>n.id===c.id);return n&&resetKeys.some(k=>c.params[k]!==n.params[k]);});
      const energyChanged=JSON.stringify([...this.compiled.energyDomains.keys()].sort())!==JSON.stringify([...next.energyDomains.keys()].sort());this.compiled=next;this.doc=next.doc;if(reset)this.state=initial(next);else if(changed){this.state.event=true;this.state.step=Math.max(MIN_STEP,Math.min(this.state.step,next.initialStep));if(energyChanged)rebaseEnergy(next,this.state,true);}if(changed){this.tracker=new O.GroupTracker(next.policies,reset||this.previewing?null:this.tracker);this.coreTracker=new O.CoreFluxTracker(next.policies,reset||this.previewing?null:this.coreTracker);if(reset||!continuous)this.visualTracker=new O.Tracker(.02);}this.project();if(changed)this.emit(this.result);return reset?'restarted':changed?'event':'geometry';
    }
    preview(doc){const s=Object.create(Session.prototype);Object.assign(s,{compiled:{...this.compiled},previewing:true,doc:this.doc,state:clone(this.state),listeners:new Set(),tracker:this.tracker,visualTracker:this.visualTracker,coreTracker:this.coreTracker,fault:this.fault,result:{...this.result,components:clone(this.result.components),wires:clone(this.result.wires)}});s.update(doc);return s.read();}
    reset(){this.state=initial(this.compiled);this.coreTracker=new O.CoreFluxTracker(this.compiled.policies);this.tracker=new O.GroupTracker(this.compiled.policies);this.visualTracker=new O.Tracker(.02);this.project();this.emit(this.result);return this.result;}
    capture(){return {kind:'simlab-circuit-session',version:2,modelRevision:1,document:clone(this.doc),physics:clone(this.state)};}
    static restore(snapshot){keys(snapshot,['kind','version','modelRevision','document','physics']);if(snapshot.kind!=='simlab-circuit-session'||![1,2].includes(snapshot.version)||snapshot.modelRevision!==1||snapshot.document?.version!==7)throw new Error('動態快照版本無效');const s=new Session(snapshot.document),p=snapshot.physics;
      keys(p,['time','step','sources','dynamic','work','dissipated','event',...(snapshot.version===2?['energyDomains','energyOrigin']:[])]);finite(p.time,0,1e9);finite(p.step,1e-13,1);finite(p.work,-Number.MAX_VALUE,Number.MAX_VALUE);finite(p.dissipated,0,Number.MAX_VALUE);if(typeof p.event!=='boolean')throw new Error('事件旗標無效');keys(p.sources,Object.keys(s.state.sources));for(const x of Object.values(p.sources))finite(x,0,AC.TAU);keys(p.dynamic,Object.keys(s.state.dynamic));for(const x of Object.values(p.dynamic)){keys(x,['i','v']);finite(x.i);finite(x.v);}
      const legacy= snapshot.version===1;const accepted=clone(p);
      if(legacy){const fresh=initial(s.compiled);if(s.compiled.energyDomains.size<=1){accepted.energyOrigin={work:0,dissipated:0};accepted.energyDomains=fresh.energyDomains;for(const q of Object.values(accepted.energyDomains)){q.work=p.work;q.dissipated=p.dissipated;q.throughput=Math.abs(p.work)+p.dissipated;}}else if(p.work===0&&p.dissipated===0){accepted.energyOrigin=fresh.energyOrigin;accepted.energyDomains=fresh.energyDomains;}else throw new Error(errors['energy-history']);}
      else{keys(p.energyOrigin,['work','dissipated']);finite(p.energyOrigin.work,-Number.MAX_VALUE,Number.MAX_VALUE);finite(p.energyOrigin.dissipated,0,Number.MAX_VALUE);keys(p.energyDomains,[...s.compiled.energyDomains.keys()]);for(const q of Object.values(p.energyDomains)){keys(q,['initial','work','dissipated','throughput']);finite(q.initial,0,Number.MAX_VALUE);finite(q.work,-Number.MAX_VALUE,Number.MAX_VALUE);finite(q.dissipated,0,Number.MAX_VALUE);finite(q.throughput,0,Number.MAX_VALUE);}}
      s.state=clone(accepted);s.project({initialise:false,history:false});if(!s.fault)for(const e of s.compiled.dynamic){const a=s.state.dynamic[e.id],b=p.dynamic[e.id];for(const key of p.event?[e.C?'v':'i']:['i','v'])if(Math.abs(a[key]-b[key])>1e-6*Math.max(1,Math.abs(a[key]),Math.abs(b[key])))throw new Error('動態快照不符合電路約束');}
      s.state=clone(accepted);if(p.event&&!s.fault&&eventStep(s.compiled,s.result)<MIN_STEP)s.fault='time-resolution';if(energyBalance(s.compiled,s.state).status!=='reliable')s.fault='energy-balance';const solution=p.event&&!s.fault?initialSolution(s.compiled,s.state):solve(s.compiled,s.state,0,'trap',false,!s.fault&&!p.event);if(solution.error&&!s.fault)throw new Error('動態快照不符合電路歷史約束');s.result=read(s.compiled,s.state,s.fault?{error:s.fault}:solution);s.tracker=new O.GroupTracker(s.compiled.policies);s.visualTracker=new O.Tracker(.02);s.coreTracker=new O.CoreFluxTracker(s.compiled.policies);s.coreTracker.sample(s.result);s.tracker.sample(s.result);s.visualTracker.sample(s.result);return s;
    }
    destroy(){this.listeners.clear();}
  }
  function run(document,{initialState=null,events=[],until}={}){finite(until,0,1e9);let s=initialState?Session.restore(initialState):new Session(document);if(initialState&&signature(s.doc)!==signature(AC.toAC(document)))throw new Error('離線初始狀態電路不符');let last=s.state.time;for(const event of events){keys(event,['time','command']);finite(event.time,last,until);s.advance(event.time-s.state.time);if(s.fault)break;const d=clone(s.doc),command=event.command,c=d.components.find(c=>c.id===command.id);if(!c)throw new Error('事件元件不存在');if(command.type==='setParam'){keys(command,['type','id','key','value']);if(!Object.hasOwn(c.params,command.key))throw new Error('事件參數不存在');c.params[command.key]=command.value;}else if(command.type==='toggleSwitch'){keys(command,['type','id']);if(c.type==='switch')c.params.closed=!c.params.closed;else if(c.type==='spdt')c.params.closed=c.params.closed==='b'?'c':'b';else throw new Error('事件需要開關');}else throw new Error('不支援的運算事件');if(s.update(d)==='restarted')throw new Error('離線事件表不能重設初始條件；請另開一次運算');last=event.time;}s.advance(until-s.state.time);return s;}
  return {Session,run,compile,signature,modelRevision:1};
});
