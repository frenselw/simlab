(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./circuit-household-components'):root.CircuitHouseholdComponents,node?require('./circuit-model'):root.CircuitModel,node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-solver'):root.CircuitSolver,node?require('./household-connections'):root.CircuitHouseholdConnections);if(node)module.exports=api;else root.CircuitHousehold=api;})(globalThis,function(C,M,R,S,Connections){
  'use strict';
  const constants=Object.freeze({voltage:230,frequency:50,sourceResistance:.01,channelResistance:.001,faultResistance:2000,humanResistance:2000,residualCurrent:.03,residualDelay:.1,overcurrentDelay:2});
  const byteLimit=M.limits.bytes,clone=M.clone;
  const bytes=s=>typeof TextEncoder==='undefined'?Buffer.byteLength(s,'utf8'):new TextEncoder().encode(s).length;
  function record(c){return {status:c.type==='house-fuse'?'intact':c.params.closed?'closed':'open',elapsed:0,reason:null,bodyCurrentSeen:false,bodyCurrentBeforeTrip:false};}
  function initial(doc){return {time:0,contacts:Object.fromEntries(doc.components.filter(c=>c.type==='house-person').map(c=>[c.id,null])),protection:Object.fromEntries(doc.components.filter(C.isProtection).map(c=>[c.id,record(c)])),energyKWh:Object.fromEntries(doc.components.filter(c=>c.type==='house-meter').map(c=>[c.id,0]))};}
  const active=(c,state)=>c.type==='house-fuse'?state.protection[c.id]?.status!=='blown':c.params.closed&&state.protection[c.id]?.status==='closed';
  function solve(input,state=initial(input)){
    const doc=M.validate(input),topology=Connections.inspect(doc),ports=M.endpoints(doc),keys=[...ports.keys(),'@earth',...doc.components.filter(C.isAppliance).map(c=>c.id+':case')],parent=new Map(keys.map(k=>[k,k]));
    const find=k=>{let p=k;while(parent.get(p)!==p)p=parent.get(p);return p;};
    const join=(a,b)=>parent.set(find(a),find(b));
    doc.wires.forEach(w=>join(w.from,w.to));
    for(const c of doc.components){if(c.type==='house-earth')join(c.id+':e','@earth');if(c.type==='house-mains')join(c.id+':n','@earth');if(c.type==='house-metal')join(c.id+':e',c.id+':case');}
    const ground=find('@earth'),nets=[...new Set(keys.map(find))].filter(k=>k!==ground),index=new Map(nets.map((k,i)=>[k,i])),edges=[];
    const edge=(id,owner,from,to,resistance,emf=0)=>{edges.push({id,owner,from,to,a:find(from),b:find(to),resistance,emf});};
    for(const c of doc.components){
      const at=k=>c.id+':'+k;
      if(c.type==='house-mains')edge(c.id+':source',c.id,at('l'),at('n'),constants.sourceResistance,constants.voltage);
      if(c.type==='house-meter'||['house-breaker','house-rcd'].includes(c.type)&&active(c,state)){edge(c.id+':l',c.id,at('li'),at('lo'),constants.channelResistance);edge(c.id+':n',c.id,at('ni'),at('no'),constants.channelResistance);}
      if(c.type==='house-switch'&&c.params.closed||c.type==='house-fuse'&&active(c,state))edge(c.id+':switch',c.id,at('a'),at('b'),constants.channelResistance);
      if(C.isAppliance(c))edge(c.id+':load',c.id,at('l'),at('n'),constants.voltage**2/C.power(c));
      if(c.type==='house-metal'&&c.params.fault)edge(c.id+':fault',c.id,at('l'),at('case'),constants.faultResistance);
      if(c.type==='house-person'&&state.contacts[c.id]&&c.params.stance==='grounded')edge(c.id+':human',c.id,state.contacts[c.id]+':case','@earth',constants.humanResistance);
    }
    const n=nets.length+edges.length,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
    edges.forEach((e,i)=>{e.index=nets.length+i;for(const [net,sign]of [[e.a,1],[e.b,-1]]){if(index.has(net)){A[index.get(net)][e.index]+=sign;A[e.index][index.get(net)]+=sign;}}A[e.index][e.index]=-e.resistance;b[e.index]=e.emf;});
    const solution=S.linear(A,b),diff=(from,to)=>{const coeff=Array(n).fill(0);for(const [net,sign]of [[find(from),1],[find(to),-1]])if(index.has(net))coeff[index.get(net)]+=sign;return coeff;};
    const estimate=(coeff,constant=0)=>S.estimateLinear(solution,coeff,constant),ident=coeff=>S.reading(estimate(coeff));
    const voltage=(from,to)=>parent.has(from)&&parent.has(to)?ident(diff(from,to)):null,potential=k=>voltage(k,'@earth');
    const branches={},injections=new Map(keys.map(k=>[k,Array(n).fill(0)]));
    for(const e of edges){const coeff=Array(n).fill(0);coeff[e.index]=1;const current=ident(coeff),u=voltage(e.from,e.to);branches[e.id]={from:e.from,to:e.to,current,voltage:u,resistance:e.resistance,power:u===null||current===null?null:u*current};injections.get(e.from)[e.index]++;injections.get(e.to)[e.index]--;}
    const components={};
    for(const c of doc.components){
      const at=k=>c.id+':'+k,load=branches[c.id+':load'],line=branches[c.id+':l'],neutral=branches[c.id+':n'],source=branches[c.id+':source'],sw=branches[c.id+':switch'];
      const result={voltage:load?.voltage??source?.voltage??sw?.voltage??null,current:load?.current??source?.current??sw?.current??line?.current??0,power:load?.power??0,branches:Object.values(branches).filter(e=>e.from.startsWith(c.id+':'))};
      if(c.type==='house-mains'){result.power=source?.power===null?null:-source.power;result.current=source?.current===null?null:-source.current;result.voltage=source?.voltage;}
      if(C.isAppliance(c)){result.resistance=constants.voltage**2/C.power(c);result.casePotential=potential(at('case'));result.leakageCurrent=branches[c.id+':fault']?.current??0;result.connections=Object.fromEntries(R.ports(c).map(p=>[p.key,topology.roleOf(p.id)]));result.earthed=c.type==='house-metal'&&result.connections.e==='E'&&find(at('case'))===ground;result.working=Number.isFinite(result.power)&&result.power>.01;}
      if(c.type==='house-person'){result.contact=state.contacts[c.id];result.current=branches[c.id+':human']?.current??0;result.voltage=result.contact?potential(result.contact+':case'):null;result.power=branches[c.id+':human']?.power??0;}
      if(c.type==='house-meter'){result.energyKWh=state.energyKWh[c.id];result.power=Number.isFinite(line?.current)&&Number.isFinite(voltage(at('lo'),at('no')))?line.current*voltage(at('lo'),at('no')):null;result.voltage=voltage(at('lo'),at('no'));}
      if(C.isProtection(c)){result.status=state.protection[c.id].status;result.protection=clone(state.protection[c.id]);result.channelL=line?.current??0;result.channelN=neutral?.current??0;result.current=c.type==='house-fuse'?sw?.current??0:Math.max(Math.abs(result.channelL),Math.abs(result.channelN));result.residualCurrent=Math.abs(result.channelL+result.channelN);}
      if(c.type==='house-switch'){result.status=c.params.closed?'closed':'open';result.voltage=voltage(at('a'),at('b'));result.role=topology.roleOf(at('a'));}
      components[c.id]=result;
    }
    const adjacency=new Map(keys.map(k=>[k,[]])),link=(from,to,id)=>{adjacency.get(from).push({to,id});adjacency.get(to).push({to:from,id});};for(const w of doc.wires)link(w.from,w.to,w.id);
    for(const c of doc.components){if(c.type==='house-earth')link(c.id+':e','@earth','@'+c.id);if(c.type==='house-mains')link(c.id+':n','@earth','@'+c.id);if(c.type==='house-metal')link(c.id+':e',c.id+':case','@'+c.id);}
    const wires={};
    for(const w of doc.wires){const seen=new Set([w.from]),pending=[w.from];while(pending.length)for(const e of adjacency.get(pending.pop()))if(e.id!==w.id&&!seen.has(e.to)){seen.add(e.to);pending.push(e.to);}
      let current=null;if(!seen.has(w.to)){const coeff=Array(n).fill(0);for(const k of keys)if(find(k)===find(w.from)&&seen.has(k)){const injection=injections.get(k);for(let i=0;i<n;i++)coeff[i]-=injection[i];}current=ident(coeff);}
      wires[w.id]={current,voltage:voltage(w.from,w.to),potential:potential(w.from),potentialTo:potential(w.to),resistance:0,power:0,cyclic:seen.has(w.to),role:Connections.wireRole(doc,w,topology)};
    }
    const diagnostics=solution.error?[{code:solution.error,message:'電路未能得到可靠結果，模擬已暫停。'}]:[];
    return {mode:'household',time:state.time,components,wires,potentials:Object.fromEntries([...ports.keys()].map(k=>[k,potential(k)])),islandOf:Object.fromEntries([...ports.keys()].map(k=>[k,'earth-reference'])),references:[{island:'earth-reference',endpoint:doc.components.find(c=>c.type==='house-mains')?.id+':n',voltage:0}],diagnostics,reliable:!solution.error,voltage};
  }
  function object(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(value,k)))throw new Error('家庭文件欄位無效');}
  function number(v,max=Infinity){if(!Number.isFinite(v)||v<0||v>max)throw new Error('家庭狀態數值無效');}
  function validateSnapshot(input){
    object(input,['kind','version','model','circuit','contacts','timeSeconds','protection','energyKWh']);
    if(input.kind!=='simlab-household-concepts'||input.version!==1||input.model!=='concept-rms-1')throw new Error('不支援的家庭文件版本');
    const doc=M.validate(input.circuit);if(doc.analysis!=='household')throw new Error('家庭文件需要家庭電路');number(input.timeSeconds);
    const people=doc.components.filter(c=>c.type==='house-person'),protectors=doc.components.filter(C.isProtection),meters=doc.components.filter(c=>c.type==='house-meter');
    object(input.contacts,people.map(c=>c.id));for(const c of people)if(input.contacts[c.id]!==null){const target=doc.components.find(a=>a.id===input.contacts[c.id]&&C.isAppliance(a));if(!target)throw new Error('接觸對象不存在或不是家電');const hand=C.hand(c),point=C.contactPoint(target,hand);if(Math.hypot(hand.x-point.x,hand.y-point.y)>1e-6)throw new Error('接觸狀態與手部位置不符');}
    object(input.protection,protectors.map(c=>c.id));for(const c of protectors){const p=input.protection[c.id],statuses=c.type==='house-fuse'?['intact','blown']:['closed','open','tripped'];object(p,['status','elapsed','reason','bodyCurrentSeen','bodyCurrentBeforeTrip']);if(!statuses.includes(p.status)||typeof p.bodyCurrentBeforeTrip!=='boolean'||typeof p.bodyCurrentSeen!=='boolean')throw new Error('保護狀態無效');number(p.elapsed,c.type==='house-rcd'?constants.residualDelay:constants.overcurrentDelay);const tripped=['tripped','blown'].includes(p.status);if((p.status==='open'||tripped)&&p.elapsed!==0||p.bodyCurrentSeen&&(tripped||p.elapsed===0))throw new Error('保護計時與人體事件不符');if(tripped?p.reason!==(c.type==='house-rcd'?'residual':'overcurrent')||p.elapsed!==0:p.reason!==null||p.bodyCurrentBeforeTrip)throw new Error('保護事件資訊無效');if(c.type!=='house-fuse'&&(p.status==='open')!==!c.params.closed)throw new Error('手柄與保護狀態不符');}
    object(input.energyKWh,meters.map(c=>c.id));Object.values(input.energyKWh).forEach(v=>number(v));
    return {doc,state:{time:input.timeSeconds,contacts:clone(input.contacts),protection:clone(input.protection),energyKWh:clone(input.energyKWh)}};
  }
  function encode(snapshot){validateSnapshot(snapshot);const text=JSON.stringify(snapshot,null,2);if(bytes(text)>byteLimit)throw new Error('家庭文件超出 256 KiB');return text;}
  function decode(input){const text=typeof input==='string'?input:JSON.stringify(input);if(typeof text!=='string'||bytes(text)>byteLimit)throw new Error('家庭文件過大或無效');let data;try{data=JSON.parse(text);}catch{throw new Error('家庭文件不是有效 JSON');}validateSnapshot(data);return data;}
  function threshold(c,analysis){const r=analysis.components[c.id];return c.type==='house-rcd'?r.residualCurrent>=constants.residualCurrent:Math.abs(r.current)>c.params.rating;}
  class Session{
    constructor(doc){this.doc=M.validate(doc);if(this.doc.analysis!=='household')throw new Error('需要家庭電路');this.state=initial(this.doc);this.listeners=new Set();this.dead=false;this.fault=null;this.result=solve(this.doc,this.state);}
    read(){return this.result;}
    publish(){this.result=solve(this.doc,this.state);this.fault=this.result.reliable?null:'求解失敗';for(const fn of this.listeners)fn(this.result);return this.result;}
    subscribe(fn){if(typeof fn!=='function')throw new Error('需要分析函數');this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    update(doc){const next=M.validate(doc),old=this.doc,start=initial(next);for(const key of ['contacts','protection','energyKWh'])for(const id of Object.keys(start[key])){if(Object.hasOwn(this.state[key],id))start[key][id]=clone(this.state[key][id]);}start.time=this.state.time;
      for(const c of next.components.filter(C.isProtection)){const previous=old.components.find(p=>p.id===c.id);if(c.type!=='house-fuse'&&previous?.params.closed!==c.params.closed)start.protection[c.id]=record(c);}
      for(const id of Object.keys(start.contacts))if(start.contacts[id]&&!next.components.some(c=>c.id===start.contacts[id]&&C.isAppliance(c)))start.contacts[id]=null;
      for(const c of next.components.filter(c=>c.type==='house-person'&&start.contacts[c.id])){const p=old.components.find(p=>p.id===c.id),target=next.components.find(a=>a.id===start.contacts[c.id]),previous=old.components.find(a=>a.id===start.contacts[c.id]);if(p&&c.params.stance===p.params.stance&&(c.x!==p.x||c.y!==p.y||c.angle!==p.angle)||previous&&(target.x!==previous.x||target.y!==previous.y||target.angle!==previous.angle))start.contacts[c.id]=null;}
      for(const c of next.components.filter(c=>c.type==='house-person'&&start.contacts[c.id])){const previous=old.components.find(p=>p.id===c.id);if(previous&&previous.params.stance!==c.params.stance)C.placeHand(c,C.hand(previous));}
      this.doc=M.validate(next);this.state=start;this.publish();this.clearInactiveTimers();return 'updated';}
    clearInactiveTimers(){for(const c of this.doc.components.filter(C.isProtection))if(!active(c,this.state)||!threshold(c,this.result)){this.state.protection[c.id].elapsed=0;this.state.protection[c.id].bodyCurrentSeen=false;this.result.components[c.id].protection.elapsed=0;this.result.components[c.id].protection.bodyCurrentSeen=false;}}
    preview(doc){const next=this.fork();next.update(doc);const result=next.read();next.destroy();return result;}
    fork(){return Session.restore(this.capture());}
    capture(){return {kind:'simlab-household-concepts',version:1,model:'concept-rms-1',circuit:clone(this.doc),contacts:clone(this.state.contacts),timeSeconds:this.state.time,protection:clone(this.state.protection),energyKWh:clone(this.state.energyKWh)};}
    static restore(snapshot){const {doc,state}=validateSnapshot(decode(snapshot)),session=new Session(doc);session.state=state;session.publish();return session;}
    contact(person,target){if(!this.doc.components.some(c=>c.id===person&&c.type==='house-person')||target!==null&&!this.doc.components.some(c=>c.id===target&&C.isAppliance(c)))throw new Error('接觸對象無效');const next=clone(this.doc);if(target){const c=next.components.find(c=>c.id===person),appliance=next.components.find(c=>c.id===target),hand=C.hand(c),near=C.contactPoint(appliance,hand);if(Math.hypot(hand.x-near.x,hand.y-near.y)>1e-6)C.placeHand(c,C.contactPoint(appliance));}else if(this.state.contacts[person]){const c=next.components.find(c=>c.id===person),appliance=next.components.find(c=>c.id===this.state.contacts[person]),hand=C.hand(c),dx=hand.x-appliance.x,dy=hand.y-appliance.y,length=Math.hypot(dx,dy)||1;C.placeHand(c,{x:hand.x+26*dx/length,y:hand.y+26*dy/length});}this.doc=M.validate(next);this.state.contacts[person]=target;this.publish();this.clearInactiveTimers();}
    resetProtection(id){const c=this.doc.components.find(c=>c.id===id&&C.isProtection(c));if(!c)return false;this.state.protection[id]=record(c);this.publish();return true;}
    reset(){this.state=initial(this.doc);return this.publish();}
    advance(seconds){if(this.dead)throw new Error('模型已卸載');number(seconds,10);if(!seconds||this.fault)return {advanced:0,complete:true,result:this.result};let remaining=seconds;
      while(remaining>1e-12){this.clearInactiveTimers();const due=this.doc.components.filter(c=>C.isProtection(c)&&active(c,this.state)&&threshold(c,this.result)),delay=c=>c.type==='house-rcd'?constants.residualDelay:constants.overcurrentDelay;let dt=remaining;for(const c of due)dt=Math.min(dt,Math.max(0,delay(c)-this.state.protection[c.id].elapsed));
        for(const c of this.doc.components.filter(c=>c.type==='house-meter')){const p=this.result.components[c.id].power;if(Number.isFinite(p))this.state.energyKWh[c.id]+=Math.max(0,p)*dt/3600000;}
        this.state.time+=dt;remaining=Math.max(0,remaining-dt);for(const c of due)this.state.protection[c.id].elapsed=Math.min(delay(c),this.state.protection[c.id].elapsed+dt);
        const body=this.doc.components.some(c=>c.type==='house-person'&&Math.abs(this.result.components[c.id].current||0)>1e-9);if(dt>0&&body)for(const c of due)this.state.protection[c.id].bodyCurrentSeen=true;
        const trips=due.filter(c=>this.state.protection[c.id].elapsed>=delay(c)-1e-12);
        for(const c of trips)this.state.protection[c.id]={status:c.type==='house-fuse'?'blown':'tripped',elapsed:0,reason:c.type==='house-rcd'?'residual':'overcurrent',bodyCurrentSeen:false,bodyCurrentBeforeTrip:this.state.protection[c.id].bodyCurrentSeen||body};
        this.publish();if(this.fault)break;if(dt===0&&!trips.length)break;
      }
      return {advanced:seconds-remaining,complete:remaining<=1e-12,result:this.result};
    }
    destroy(){this.dead=true;this.listeners.clear();}
  }
  return Object.freeze({constants,byteLimit,initial,solve,validateSnapshot,encode,decode,threshold,Session});
});
