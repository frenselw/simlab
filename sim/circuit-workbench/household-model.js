(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./circuit-household-components'):root.CircuitHouseholdComponents,node?require('./circuit-model'):root.CircuitModel,node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-solver'):root.CircuitSolver,node?require('./household-connections'):root.CircuitHouseholdConnections);if(node)module.exports=api;else root.CircuitHousehold=api;})(globalThis,function(C,M,R,S,Connections){
  'use strict';
  const constants=Object.freeze({voltage:230,frequency:50,sourceResistance:.05,wireResistance:.001,channelResistance:.001,faultResistance:2000,humanResistance:2000,residualCurrent:.03,residualDelay:.1,overcurrentDelay:2,fastDelay:.02,fastMultiple:5});
  const byteLimit=M.limits.bytes,clone=M.clone;
  const bytes=s=>typeof TextEncoder==='undefined'?Buffer.byteLength(s,'utf8'):new TextEncoder().encode(s).length;
  function record(c){return {status:c.type==='house-fuse'?'intact':c.params.closed?'closed':'open',elapsed:0,reason:null,bodyCurrentSeen:false,bodyCurrentBeforeTrip:false,timingMode:null,currentBeforeTrip:null,residualBeforeTrip:null};}
  function initial(doc){return {time:0,contacts:Object.fromEntries(doc.components.filter(c=>c.type==='house-person').map(c=>[c.id,null])),protection:Object.fromEntries(doc.components.filter(C.isProtection).map(c=>[c.id,record(c)])),energyKWh:Object.fromEntries(doc.components.filter(c=>c.type==='house-meter').map(c=>[c.id,0]))};}
  const active=(c,state)=>c.type==='house-fuse'?state.protection[c.id]?.status!=='blown':c.params.closed&&state.protection[c.id]?.status==='closed';
  const electricalKey=(doc,state)=>JSON.stringify([doc.supplyVoltage,doc.components.map(c=>[c.id,c.type,c.params]),doc.junctions.map(j=>j.id),doc.wires.map(w=>[w.id,w.from,w.to]),C.handContacts(doc),C.plugContacts(doc),state.contacts,Object.entries(state.protection).map(([id,p])=>[id,p.status])]);
  // Session events reuse validated geometry; public solve still validates external documents.
  function* solveSteps(doc,state=initial(doc)){
    const topology=Connections.inspect(doc),ports=M.endpoints(doc),contacts=C.handContacts(doc),keys=[...new Set([...ports.keys(),'@earth',...doc.components.filter(C.isAppliance).map(c=>c.id+':case'),...doc.components.filter(c=>c.type==='house-person').map(c=>c.id+':body')])],parent=new Map(keys.map(k=>[k,k]));
    const find=k=>{let p=k;while(parent.get(p)!==p)p=parent.get(p);return p;};
    const join=(a,b)=>parent.set(find(a),find(b));
    yield;
    for(const c of doc.components){if(c.type==='house-earth')join(c.id+':e','@earth');if(c.type==='house-mains')join(c.id+':n','@earth');if(c.type==='house-metal')join(c.id+':e',c.id+':case');}
    for(const c of doc.components)if(c.type==='house-person'&&state.contacts[c.id])join(c.id+':hand',state.contacts[c.id]+':case');
    contacts.forEach(({hand,target})=>join(hand,target));
    C.plugContacts(doc).forEach(({plug,target})=>join(plug,target));
    const ground=find('@earth'),nets=[...new Set(keys.map(find))].filter(k=>k!==ground),index=new Map(nets.map((k,i)=>[k,i])),edges=[];
    const edge=(id,owner,from,to,resistance,emf=0)=>{edges.push({id,owner,from,to,a:find(from),b:find(to),resistance,emf});};
    for(const c of doc.components){
      const at=k=>c.id+':'+k;
      if(c.type==='house-mains')edge(c.id+':source',c.id,at('l'),at('n'),constants.sourceResistance,doc.supplyVoltage);
      if(c.type==='house-meter'||['house-breaker','house-rcd'].includes(c.type)&&active(c,state)){edge(c.id+':l',c.id,at('li'),at('lo'),constants.channelResistance);edge(c.id+':n',c.id,at('ni'),at('no'),constants.channelResistance);}
      if(c.type==='house-switch'&&c.params.closed||c.type==='house-fuse'&&active(c,state))edge(c.id+':switch',c.id,at('a'),at('b'),constants.channelResistance);
      if(c.type==='house-power-strip')for(const [from,to,key]of C.stripLinks)edge(at(key),c.id,at(from),at(to),constants.channelResistance);
      if(C.isAppliance(c))edge(c.id+':load',c.id,at('l'),at('n'),constants.voltage**2/C.power(c));
      if(c.type==='house-metal'&&c.params.fault)edge(c.id+':fault',c.id,at('l'),at('case'),constants.faultResistance);
      if(c.type==='house-person'){
        // Each arm and the ground path are half the existing hand-to-ground resistance.
        edge(at('human-right'),c.id,at('hand'),at('body'),constants.humanResistance/2);
        edge(at('human-left'),c.id,at('hand-left'),at('body'),constants.humanResistance/2);
        if(c.params.stance==='grounded')edge(at('human-ground'),c.id,at('body'),'@earth',constants.humanResistance/2);
      }
    }
    for(const w of doc.wires)edge('@wire:'+w.id,null,w.from,w.to,constants.wireResistance);
    // This graph has actual closed paths, without the source's virtual N/earth reference bond.
    const external=new Map(keys.map(k=>[k,k])),externalFind=k=>{let p=k;while(external.get(p)!==p)p=external.get(p);while(external.get(k)!==k){const next=external.get(k);external.set(k,p);k=next;}return p;},externalJoin=(a,b)=>external.set(externalFind(a),externalFind(b));
    for(const e of edges)if(e.resistance<=constants.sourceResistance&&e.id!==e.owner+':source')externalJoin(e.from,e.to);
    for(const c of doc.components){if(c.type==='house-metal')externalJoin(c.id+':e',c.id+':case');if(c.type==='house-person'&&state.contacts[c.id])externalJoin(c.id+':hand',state.contacts[c.id]+':case');}
    contacts.forEach(({hand,target})=>externalJoin(hand,target));
    C.plugContacts(doc).forEach(({plug,target})=>externalJoin(plug,target));
    const earthRoots=new Set(doc.components.filter(c=>c.type==='house-earth').map(c=>externalFind(c.id+':e'))),supplyRoots=new Set(doc.components.filter(c=>c.type==='house-mains').flatMap(c=>[externalFind(c.id+':l'),externalFind(c.id+':n')]));
    // Trace actual closed conductors; socket lettering remains a separate display role.
    const sources=new Map();
    for(const c of doc.components)for(const key of c.type==='house-mains'?['l','n']:c.type==='house-earth'?['e']:[]){const root=externalFind(c.id+':'+key);if(!sources.has(root))sources.set(root,new Set());sources.get(root).add(key.toUpperCase());}
    const connectionSources=id=>[...(sources.get(externalFind(id))||[])].sort();
    yield;
    const conducting=new Map([...new Set(keys.map(find))].map(k=>[k,[]]));
    for(const e of edges)if(e.resistance<=constants.sourceResistance&&e.id!==e.owner+':source'){conducting.get(e.a).push({to:e.b,id:e.id});conducting.get(e.b).push({to:e.a,id:e.id});}
    const reaches=(from,to,exclude)=>{const seen=new Set([from]),pending=[from];while(pending.length){const k=pending.pop();if(k===to)return true;for(const e of conducting.get(k)||[])if(e.id!==exclude&&!seen.has(e.to)){seen.add(e.to);pending.push(e.to);}}return false;};
    const live=doc.components.filter(c=>c.type==='house-mains').map(c=>find(c.id+':l')),shortCircuit=live.some(k=>reaches(k,ground));
    const n=nets.length+edges.length,A=[],b=Array(n).fill(0);for(let i=0;i<n;i++){A.push(Array(n).fill(0));yield;}
    edges.forEach((e,i)=>{e.index=nets.length+i;for(const [net,sign]of [[e.a,1],[e.b,-1]]){if(index.has(net)){A[index.get(net)][e.index]+=sign;A[e.index][index.get(net)]+=sign;}}A[e.index][e.index]=-e.resistance;b[e.index]=e.emf;});
    // Independent unknown blocks do not acquire a connection through a shared 0 V reference.
    const blockParent=Array.from({length:n},(_,i)=>i),blockFind=i=>{let p=i;while(blockParent[p]!==p)p=blockParent[p];while(blockParent[i]!==i){const next=blockParent[i];blockParent[i]=p;i=next;}return p;};
    for(let i=0;i<n;i++){for(let j=0;j<n;j++)if(i!==j&&A[i][j])blockParent[blockFind(i)]=blockFind(j);yield;}
    const groups=new Map();for(let i=0;i<n;i++){const key=blockFind(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
    const solution={blocks:[],error:null};
    for(const ids of groups.values()){const rows=[];for(const i of ids){rows.push(ids.map(j=>A[i][j]));yield;}const part=yield* S.linearSteps(rows,ids.map(i=>b[i]));if(part.error){solution.error=part.error;break;}part.roundoff=part.roundoff.map(v=>v*n/ids.length);solution.blocks.push({ids,part});}
    const diff=(from,to)=>{const coeff=Array(n).fill(0);for(const [net,sign]of [[find(from),1],[find(to),-1]])if(index.has(net))coeff[index.get(net)]+=sign;return coeff;};
    const estimate=(coeff,constant=0)=>{if(solution.error)return null;let value=constant,noise=4*Number.EPSILON*Math.abs(constant);for(const {ids,part}of solution.blocks){if(!ids.some(i=>coeff[i]))continue;const e=S.estimateLinear(part,ids.map(i=>coeff[i]));if(!e)return null;value+=e.value;noise+=e.noise;}return{value,noise};},ident=coeff=>S.reading(estimate(coeff));
    const voltage=(from,to)=>parent.has(from)&&parent.has(to)?ident(diff(from,to)):null,potential=k=>voltage(k,'@earth');
    const branches={};
    for(const e of edges){const coeff=Array(n).fill(0);coeff[e.index]=1;const current=ident(coeff),u=voltage(e.from,e.to);branches[e.id]={from:e.from,to:e.to,current,voltage:u,resistance:e.resistance,power:u===null||current===null?null:u*current};yield;}
    const components={};
    for(const c of doc.components){
      const at=k=>c.id+':'+k,load=branches[c.id+':load'],line=branches[c.id+':l'],neutral=branches[c.id+':n'],source=branches[c.id+':source'],sw=branches[c.id+':switch'];
      const result={voltage:load?.voltage??source?.voltage??sw?.voltage??null,current:load?.current??source?.current??sw?.current??line?.current??0,power:load?.power??0,branches:edges.filter(e=>e.owner===c.id).map(e=>branches[e.id])};
      if(c.type==='house-mains'){result.power=source?.power===null?null:-source.power;result.current=source?.current===null?null:-source.current;result.voltage=source?.voltage;}
      if(C.isAppliance(c)){result.resistance=constants.voltage**2/C.power(c);result.casePotential=potential(at('case'));result.leakageCurrent=branches[c.id+':fault']?.current??0;result.connectionSources=Object.fromEntries(R.ports(c).filter(p=>p.key!=='case').map(p=>[p.key,connectionSources(p.id)]));result.connections=Object.fromEntries(Object.entries(result.connectionSources).map(([key,roles])=>[key,roles.length===1?roles[0]:null]));result.earthed=c.type==='house-metal'&&earthRoots.has(externalFind(at('e')))&&!supplyRoots.has(externalFind(at('e')));result.working=Number.isFinite(result.power)&&result.power>.01;}
      if(c.type==='house-person'){
        const right=branches[at('human-right')],left=branches[at('human-left')],feet=branches[at('human-ground')];
        result.contact=state.contacts[c.id];result.handCurrents={right:right?.current??0,left:left?.current??0};result.groundCurrent=feet?.current??0;
        result.caseContacts=Object.fromEntries([['right','hand'],['left','hand-left']].map(([side,key])=>[side,contacts.find(p=>p.hand===at(key)&&p.target.endsWith(':case'))?.target.split(':')[0]||null]));
        result.current=Math.max(Math.abs(result.handCurrents.right),Math.abs(result.handCurrents.left),Math.abs(result.groundCurrent));
        result.voltage=potential(at('hand'));result.handVoltage=voltage(at('hand'),at('hand-left'));result.power=[right,left,feet].reduce((sum,b)=>sum+(b?.power??0),0);
      }
      if(c.type==='house-meter'){result.energyKWh=state.energyKWh[c.id];result.power=Number.isFinite(line?.current)&&Number.isFinite(voltage(at('lo'),at('no')))?line.current*voltage(at('lo'),at('no')):null;result.voltage=voltage(at('lo'),at('no'));}
      if(C.isProtection(c)){result.status=state.protection[c.id].status;result.protection=clone(state.protection[c.id]);result.channelL=line?.current??0;result.channelN=neutral?.current??0;result.current=c.type==='house-fuse'?sw?.current??0:Math.max(Math.abs(result.channelL),Math.abs(result.channelN));result.residualCurrent=Math.abs(result.channelL+result.channelN);
        result.shortCircuit=shortCircuit&&c.type!=='house-rcd'&&Math.abs(result.current)>=constants.fastMultiple*c.params.rating&&edges.some(e=>e.owner===c.id&&Math.abs(branches[e.id].current)>1e-9&&live.some(k=>reaches(e.a,k,e.id)&&reaches(e.b,ground,e.id)||reaches(e.b,k,e.id)&&reaches(e.a,ground,e.id)));
      }
      if(c.type==='house-switch'){result.status=c.params.closed?'closed':'open';result.voltage=voltage(at('a'),at('b'));result.sourceRoles=[...new Set(['a','b'].flatMap(key=>connectionSources(at(key))))].sort();result.role=result.sourceRoles.length===1?result.sourceRoles[0]:null;}
      components[c.id]=result;
      yield;
    }
    const wires={};for(const w of doc.wires){const b=branches['@wire:'+w.id];wires[w.id]={current:b.current,voltage:b.voltage,potential:potential(w.from),potentialTo:potential(w.to),resistance:constants.wireResistance,power:b.power,cyclic:false,role:Connections.wireRole(doc,w,topology)};yield;}
    const diagnostics=solution.error?[{code:solution.error,message:'電路未能得到可靠結果，模擬已暫停。'}]:[];
    const potentials={};for(const k of ports.keys()){potentials[k]=potential(k);yield;}
    return {mode:'household',shortCircuit,time:state.time,components,wires,potentials,islandOf:Object.fromEntries([...ports.keys()].map(k=>[k,'earth-reference'])),references:[{island:'earth-reference',endpoint:doc.components.find(c=>c.type==='house-mains')?.id+':n',voltage:0}],diagnostics,reliable:!solution.error,voltage};
  }
  function solve(input,state){const job=solveSteps(M.validate(input),state);let step;do{step=job.next();}while(!step.done);return step.value;}
  function object(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(value,k)))throw new Error('家庭文件欄位無效');}
  function number(v,max=Infinity){if(!Number.isFinite(v)||v<0||v>max)throw new Error('家庭狀態數值無效');}
  function validateSnapshot(input){
    object(input,['kind','version','model','circuit','contacts','timeSeconds','protection','energyKWh']);
    const legacy=input.version===1;
    if(input.kind!=='simlab-household-concepts'||!(legacy&&input.model==='concept-rms-1'||input.version===2&&input.model==='concept-rms-2'))throw new Error('不支援的家庭文件版本');
    const doc=M.validate(input.circuit);if(doc.analysis!=='household')throw new Error('家庭文件需要家庭電路');number(input.timeSeconds);
    const people=doc.components.filter(c=>c.type==='house-person'),protectors=doc.components.filter(C.isProtection),meters=doc.components.filter(c=>c.type==='house-meter');
    object(input.contacts,people.map(c=>c.id));for(const c of people)if(input.contacts[c.id]!==null){const target=doc.components.find(a=>a.id===input.contacts[c.id]&&C.isAppliance(a));if(!target)throw new Error('接觸對象不存在或不是家電');const hand=C.hand(c),point=C.contactPoint(target,hand);if(Math.hypot(hand.x-point.x,hand.y-point.y)>1e-6)throw new Error('接觸狀態與手部位置不符');}
    object(input.protection,protectors.map(c=>c.id));const protection={};
    for(const c of protectors){
      const p={...input.protection[c.id]},statuses=c.type==='house-fuse'?['intact','blown']:['closed','open','tripped'];protection[c.id]=p;
      object(p,['status','elapsed','reason','bodyCurrentSeen','bodyCurrentBeforeTrip',...(legacy?[]:['timingMode','currentBeforeTrip','residualBeforeTrip'])]);
      if(!statuses.includes(p.status)||typeof p.bodyCurrentBeforeTrip!=='boolean'||typeof p.bodyCurrentSeen!=='boolean')throw new Error('保護狀態無效');
      if(legacy)Object.assign(p,{timingMode:p.elapsed>0?(c.type==='house-rcd'?'residual':'overload'):null,currentBeforeTrip:null,residualBeforeTrip:null});
      if(![null,'overload','fast','residual'].includes(p.timingMode)||p.timingMode&&(p.timingMode==='residual')!==(c.type==='house-rcd'))throw new Error('保護計時種類無效');
      number(p.elapsed,p.timingMode==='fast'?constants.fastDelay:c.type==='house-rcd'?constants.residualDelay:constants.overcurrentDelay);
      const tripped=['tripped','blown'].includes(p.status),reasons=c.type==='house-rcd'?['residual']:legacy?['overcurrent']:['overcurrent','short-circuit'];
      if((p.status==='open'||tripped||!p.timingMode)&&p.elapsed!==0||p.bodyCurrentSeen&&(tripped||p.elapsed===0)||(p.status==='open'||tripped)&&p.timingMode!==null)throw new Error('保護計時與人體事件不符');
      if(tripped?!reasons.includes(p.reason)||p.elapsed!==0:p.reason!==null||p.bodyCurrentBeforeTrip)throw new Error('保護事件資訊無效');
      if(p.currentBeforeTrip===null?p.residualBeforeTrip!==null:!tripped||p.residualBeforeTrip===null)throw new Error('切斷前讀數無效');
      if(p.currentBeforeTrip!==null){number(p.currentBeforeTrip);number(p.residualBeforeTrip);}
      if(c.type!=='house-fuse'&&(p.status==='open')!==!c.params.closed)throw new Error('手柄與保護狀態不符');
    }
    object(input.energyKWh,meters.map(c=>c.id));Object.values(input.energyKWh).forEach(v=>number(v));
    return {doc,state:{time:input.timeSeconds,contacts:clone(input.contacts),protection,energyKWh:clone(input.energyKWh)}};
  }
  function encode(snapshot){validateSnapshot(snapshot);const text=JSON.stringify(snapshot,null,2);if(bytes(text)>byteLimit)throw new Error('家庭文件超出 256 KiB');return text;}
  function decode(input){if(typeof input!=='string')validateSnapshot(input);const text=typeof input==='string'?input:JSON.stringify(input);if(typeof text!=='string'||bytes(text)>byteLimit)throw new Error('家庭文件過大或無效');let data;try{data=JSON.parse(text);}catch{throw new Error('家庭文件不是有效 JSON');}validateSnapshot(data);return data;}
  function threshold(c,analysis){const r=analysis.components[c.id];return c.type==='house-rcd'?r.residualCurrent>=constants.residualCurrent:Math.abs(r.current)>c.params.rating;}
  function timingMode(c,analysis){return !threshold(c,analysis)?null:c.type==='house-rcd'?'residual':Math.abs(analysis.components[c.id].current)>=constants.fastMultiple*c.params.rating?'fast':'overload';}
  const delay=mode=>mode==='residual'?constants.residualDelay:mode==='fast'?constants.fastDelay:constants.overcurrentDelay;
  class Session{
    constructor(doc){this.doc=M.validate(doc);if(this.doc.analysis!=='household')throw new Error('需要家庭電路');this.state=initial(this.doc);this.listeners=new Set();this.dead=false;this.pending=null;this.result=solve(this.doc,this.state);this.electricalKey=electricalKey(this.doc,this.state);this.fault=this.result.reliable?null:'求解失敗';}
    read(){return this.result;}
    refresh(){const components={...this.result.components};for(const [id,p]of Object.entries(this.state.protection))components[id]={...components[id],status:p.status,protection:clone(p)};for(const [id,energyKWh]of Object.entries(this.state.energyKWh))components[id]={...components[id],energyKWh};this.result={...this.result,time:this.state.time,components};return this.result;}
    publish(recompute=true){if(recompute){this.pending=null;const key=electricalKey(this.doc,this.state);if(key!==this.electricalKey||!this.result.reliable)this.result=solve(this.doc,this.state);this.electricalKey=key;}this.refresh();this.fault=this.result.reliable?null:'求解失敗';for(const fn of this.listeners)fn(this.result);return this.result;}
    subscribe(fn){if(typeof fn!=='function')throw new Error('需要分析函數');this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    update(doc){const next=M.validate(doc),old=this.doc,start=initial(next);for(const key of ['contacts','protection','energyKWh'])for(const id of Object.keys(start[key])){if(Object.hasOwn(this.state[key],id)&&old.components.find(c=>c.id===id)?.type===next.components.find(c=>c.id===id)?.type)start[key][id]=clone(this.state[key][id]);}start.time=this.state.time;
      for(const c of next.components.filter(C.isProtection))if(c.type!=='house-fuse'&&(start.protection[c.id].status==='open')!==!c.params.closed)start.protection[c.id]=record(c);
      for(const id of Object.keys(start.contacts))if(start.contacts[id]&&!next.components.some(c=>c.id===start.contacts[id]&&C.isAppliance(c)))start.contacts[id]=null;
      for(const c of next.components.filter(c=>c.type==='house-person'&&start.contacts[c.id])){const p=old.components.find(p=>p.id===c.id),target=next.components.find(a=>a.id===start.contacts[c.id]),previous=old.components.find(a=>a.id===start.contacts[c.id]);if(p&&c.params.stance===p.params.stance&&(c.x!==p.x||c.y!==p.y||c.angle!==p.angle)||previous&&(target.x!==previous.x||target.y!==previous.y||target.angle!==previous.angle||target.type!==previous.type||target.params.kind!==previous.params.kind))start.contacts[c.id]=null;}
      for(const c of next.components.filter(c=>c.type==='house-person'&&(start.contacts[c.id]||C.handContacts(old).some(p=>p.hand.startsWith(c.id+':'))))){const previous=old.components.find(p=>p.id===c.id);if(previous&&previous.params.stance!==c.params.stance)C.placeHand(c,C.hand(previous));}
      this.doc=M.validate(next);this.state=start;this.publish();this.clearInactiveTimers();return 'updated';}
    clearInactiveTimers(){for(const c of this.doc.components.filter(C.isProtection)){const p=this.state.protection[c.id],mode=active(c,this.state)?timingMode(c,this.result):null;if(!mode||mode!==p.timingMode){p.elapsed=0;p.bodyCurrentSeen=false;}p.timingMode=mode;}this.refresh();}
    preview(doc){const next=this.fork();next.update(doc);const result=next.read();next.destroy();return result;}
    fork(){return Session.restore(this.capture());}
    capture(){return {kind:'simlab-household-concepts',version:2,model:'concept-rms-2',circuit:clone(this.doc),contacts:clone(this.state.contacts),timeSeconds:this.state.time,protection:clone(this.state.protection),energyKWh:clone(this.state.energyKWh)};}
    static restore(snapshot){const {doc,state}=validateSnapshot(decode(snapshot)),session=new Session(doc);session.state=state;session.publish();return session;}
    contact(person,target){if(!this.doc.components.some(c=>c.id===person&&c.type==='house-person')||target!==null&&!this.doc.components.some(c=>c.id===target&&C.isAppliance(c)))throw new Error('接觸對象無效');const next=clone(this.doc);if(target){const c=next.components.find(c=>c.id===person),appliance=next.components.find(c=>c.id===target),hand=C.hand(c),near=C.contactPoint(appliance,hand);if(Math.hypot(hand.x-near.x,hand.y-near.y)>1e-6)C.placeHand(c,C.contactPoint(appliance));}else if(this.state.contacts[person]){const c=next.components.find(c=>c.id===person),appliance=next.components.find(c=>c.id===this.state.contacts[person]),hand=C.hand(c),dx=hand.x-appliance.x,dy=hand.y-appliance.y,length=Math.hypot(dx,dy)||1;C.placeHand(c,{x:hand.x+26*dx/length,y:hand.y+26*dy/length});}if(!M.reconcile(next,this.doc))throw new Error('導線太短，請先拔開或移近人物');this.doc=M.validate(next);this.state.contacts[person]=target;this.publish();this.clearInactiveTimers();}
    resetProtection(id){const c=this.doc.components.find(c=>c.id===id&&C.isProtection(c));if(!c)return false;this.state.protection[id]=record(c);this.publish();return true;}
    reset(){this.state=initial(this.doc);return this.publish();}
    // Cooperative budget yields between solver rows; JavaScript and GC cannot be preempted.
    advance(seconds,{budget=Infinity}={}){if(this.dead)throw new Error('模型已卸載');number(seconds,10);if(budget!==Infinity)number(budget);if(this.fault)return {advanced:0,complete:true,result:this.result};let remaining=seconds;const started=budget===Infinity?0:performance.now();
      while(remaining>1e-12||this.pending||Object.values(this.state.protection).some(p=>p.timingMode&&p.elapsed>=delay(p.timingMode)-1e-12)){
        if(budget!==Infinity&&performance.now()-started>=budget)break;
        if(this.pending){const step=this.pending.job.next();if(!step.done)continue;this.state=this.pending.state;this.result=step.value;this.pending=null;this.electricalKey=electricalKey(this.doc,this.state);this.fault=this.result.reliable?null:'求解失敗';if(this.fault)break;continue;}
        this.clearInactiveTimers();const due=this.doc.components.filter(c=>C.isProtection(c)&&active(c,this.state)&&threshold(c,this.result));let dt=remaining;for(const c of due)dt=Math.min(dt,Math.max(0,delay(this.state.protection[c.id].timingMode)-this.state.protection[c.id].elapsed));
        for(const c of this.doc.components.filter(c=>c.type==='house-meter')){const p=this.result.components[c.id].power;if(Number.isFinite(p))this.state.energyKWh[c.id]+=Math.max(0,p)*dt/3600000;}
        this.state.time+=dt;remaining=Math.max(0,remaining-dt);for(const c of due)this.state.protection[c.id].elapsed=Math.min(delay(this.state.protection[c.id].timingMode),this.state.protection[c.id].elapsed+dt);
        const body=this.doc.components.some(c=>c.type==='house-person'&&Math.abs(this.result.components[c.id].current||0)>=.001);if(dt>0&&body)for(const c of due)this.state.protection[c.id].bodyCurrentSeen=true;
        const trips=due.filter(c=>this.state.protection[c.id].elapsed>=delay(this.state.protection[c.id].timingMode)-1e-12);
        if(trips.length){const state=clone(this.state);for(const c of trips){const r=this.result.components[c.id],p=this.state.protection[c.id];state.protection[c.id]={...record(c),status:c.type==='house-fuse'?'blown':'tripped',reason:c.type==='house-rcd'?'residual':r.shortCircuit?'short-circuit':'overcurrent',bodyCurrentBeforeTrip:p.bodyCurrentSeen||body,currentBeforeTrip:Math.abs(r.current),residualBeforeTrip:r.residualCurrent};}this.pending={state,job:solveSteps(this.doc,state)};}
        if(dt===0&&!trips.length)break;
      }
      this.publish(false);return {advanced:seconds-remaining,complete:remaining<=1e-12&&!this.pending,result:this.result};
    }
    destroy(){this.dead=true;this.pending=null;this.listeners.clear();}
  }
  return Object.freeze({constants,byteLimit,initial,solve,validateSnapshot,encode,decode,threshold,Session});
});
