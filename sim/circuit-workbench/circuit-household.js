(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./circuit-household-components'):root.CircuitHouseholdComponents,node?require('./circuit-model'):root.CircuitModel,node?require('./circuit-solver'):root.CircuitSolver,node?require('./circuit-protection'):root.CircuitProtection);
  if(node)module.exports=api;else root.CircuitHousehold=api;
})(globalThis,function(C,M,S,P){
  'use strict';
  const sessionByteLimit=1048576,energyComponents=c=>['hh-energy-meter','hh-appliance'].includes(c.type);
  const keys=(value,allowed)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==allowed.length||Object.keys(value).some(k=>!allowed.includes(k)))throw new Error('家庭實驗欄位無效');};
  const number=(v,min=0,max=1e9)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error('家庭實驗數值無效');};
  function validate(doc){const d=M.validate(doc);if(d.version!==8)throw new Error('需要家庭有效值 v8 文件');return d;}
  function solve(doc,devices={}){
    const result=S.solveResistive(doc,new Map(Object.entries(devices))),signedVoltage=result.voltage;
    const earth=p=>doc.earthReference===null?null:signedVoltage(p,doc.earthReference);
    const hazards={wires:{},components:{},short:false,overload:false};
    for(const c of doc.components){
      const r=result.components[c.id],edges=r.branches,first=edges.find(b=>b.from===c.id+':a'&&b.to===c.id+':b');
      if(c.type.startsWith('hh-')){
        r.current=first?first.current:0;r.voltage=signedVoltage(c.id+':a',c.id+':b');
        if(c.type==='hh-source'){r.delivered=first?.power===null?null:-(first?.power??0);r.internalPower=r.current===null?null:r.current**2*c.params.resistance;r.sourcePower=r.current===null?null:-r.current*c.params.voltage;}
        if(C.protective(c))r.protection={...(devices[c.id]??P.initial()),manuallyOpen:c.params.closed===false};
        if(P.residualTypes.includes(c.type)){const neutral=edges.find(b=>b.from===c.id+':c'&&b.to===c.id+':d');r.lineCurrent=first?.current??0;r.neutralCurrent=neutral?.current??0;r.residualCurrent=r.lineCurrent===null||r.neutralCurrent===null?null:Math.abs(r.lineCurrent+r.neutralCurrent);}
        if(c.type==='hh-appliance'){r.loadPower=c.params.closed?first?.power??null:0;if(c.params.insulation!=='nonconductive')r.caseVoltage=earth(c.id+':h');r.power=r.loadPower;}
        if(c.type==='hh-energy-meter'){const v=signedVoltage(c.id+':b',c.id+':d');r.reading=v===null||r.current===null?null:v*r.current;r.unit='W';r.meterStatus=r.reading===null?'unknown':'normal';r.range=c.params.range;}
      }
      r.currentRms=r.current===null?null:Math.abs(r.current);r.voltageRms=r.voltage===null?null:Math.abs(r.voltage);r.meanPower=r.power;
      if(['ammeter','voltmeter'].includes(c.type)&&r.reading!==null){r.reading=Math.abs(r.reading);r.meterStatus=r.reading>r.range?'overrange':r.meterStatus==='reverse'?'normal':r.meterStatus;}
      if(c.params.rating&&r.currentRms>c.params.rating)hazards.components[c.id]='overload';
    }
    for(const w of doc.wires){const r=result.wires[w.id];r.currentRms=r.current===null?null:Math.abs(r.current);r.potential=earth(w.from);r.potentialTo=earth(w.to);if(r.currentRms>w.rating)hazards.wires[w.id]='overload';}
    result.potentials=Object.fromEntries([...M.endpoints(doc).keys()].map(p=>[p,earth(p)]));
    hazards.overload=Object.keys(hazards.components).length>0||Object.keys(hazards.wires).length>0;
    return {...result,mode:'household-rms',voltage:(a,b)=>{const v=signedVoltage(a,b);return v===null?null:Math.abs(v);},signedVoltage,hazards,reliable:!result.diagnostics.some(d=>d.code!=='indeterminate')&&!doc.components.some(c=>C.protective(c)&&result.components[c.id].current===null)};
  }
  function initial(doc){return {time:0,devices:Object.fromEntries(doc.components.filter(C.protective).map(c=>[c.id,P.initial()])),wires:Object.fromEntries(doc.wires.map(w=>[w.id,0])),energy:Object.fromEntries(doc.components.filter(energyComponents).map(c=>[c.id,0])),events:[]};}
  function validateSnapshot(input){
    keys(input,['kind','schemaVersion','modelRevision','scenarioId','scenarioRevision','document','physics']);
    if(input.kind!=='simlab-household-session'||input.schemaVersion!==1||input.modelRevision!==1||input.scenarioRevision!==1||input.scenarioId!==null&&(typeof input.scenarioId!=='string'||input.scenarioId.length>40))throw new Error('不支援的家庭實驗版本');
    const doc=validate(input.document),s=input.physics;
    keys(s,['time','devices','wires','energy','events']);number(s.time);
    keys(s.devices,doc.components.filter(C.protective).map(c=>c.id));keys(s.wires,doc.wires.map(w=>w.id));keys(s.energy,doc.components.filter(energyComponents).map(c=>c.id));
    for(const [id,d]of Object.entries(s.devices)){
      keys(d,['status','heat','fast','residual','reason']);number(d.heat,0,1e15);number(d.fast,0,.02);number(d.residual,0,.04);
      const c=doc.components.find(c=>c.id===id);
      if(!['closed','tripped','blown'].includes(d.status)||![null,'thermal','magnetic','residual'].includes(d.reason)||(d.status==='closed')!==(d.reason===null)||d.status==='blown'&&!P.fuse(c)||d.status==='tripped'&&P.fuse(c)||d.reason==='residual'&&!P.residualTypes.includes(c.type)||d.reason==='magnetic'&&!['hh-mcb','hh-rcbo'].includes(c.type)||d.reason==='thermal'&&!P.thermalTypes.includes(c.type)||c.type==='hh-rccb'&&(d.heat!==0||d.fast!==0)||!P.residualTypes.includes(c.type)&&d.residual!==0||P.fuse(c)&&d.fast!==0)throw new Error('不可能的保護狀態');
    }
    Object.values(s.wires).forEach(v=>number(v,0,1e15));Object.values(s.energy).forEach(v=>number(v,0,1e12));
    if(!Array.isArray(s.events)||s.events.length>100)throw new Error('事件歷史超出容量');let last=0;
    for(const e of s.events){keys(e,['time','id','reason','current','residual']);number(e.time,last,s.time);number(e.current);number(e.residual);const c=doc.components.find(c=>c.id===e.id);if(!c||!C.protective(c)||!['thermal','magnetic','residual'].includes(e.reason)||e.reason==='residual'&&!P.residualTypes.includes(c.type)||e.reason==='magnetic'&&!['hh-mcb','hh-rcbo'].includes(c.type)||e.reason==='thermal'&&!P.thermalTypes.includes(c.type))throw new Error('事件參照無效');last=e.time;}
    return {...M.clone(input),document:doc};
  }
  function encodeSession(input){const text=JSON.stringify(validateSnapshot(input));if(new TextEncoder().encode(text).length>sessionByteLimit)throw new Error('家庭實驗超出 1 MiB');return text;}
  function decodeSession(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>sessionByteLimit)throw new Error('家庭實驗過大');return validateSnapshot(JSON.parse(text));}
  class Session{
    constructor(doc,scenarioId=null){this.doc=validate(doc);this.scenarioId=scenarioId;this.state=initial(this.doc);this.listeners=new Set();this.destroyed=false;this.fault=null;this.result=solve(this.doc,this.state.devices);}
    read(){const hazards=M.clone(this.result.hazards);for(const [id,heat]of Object.entries(this.state.wires))if(heat>=2){hazards.wires[id]='overload';hazards.overload=true;}return {...this.result,hazards,time:this.state.time,energy:{...this.state.energy},wireHeat:{...this.state.wires},events:M.clone(this.state.events)};}
    publish(){const r=this.read();for(const fn of this.listeners)fn(r);return r;}
    subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    update(doc){
      const next=validate(doc),defaults=initial(next),old=this.doc;
      for(const [id,d]of Object.entries(defaults.devices))if(this.state.devices[id]&&old.components.find(c=>c.id===id)?.type===next.components.find(c=>c.id===id)?.type)defaults.devices[id]=this.state.devices[id];
      for(const id of Object.keys(defaults.wires))defaults.wires[id]=this.state.wires[id]??0;
      for(const id of Object.keys(defaults.energy))defaults.energy[id]=this.state.energy[id]??0;
      this.state={...defaults,time:this.state.time,events:this.state.events.filter(e=>Object.hasOwn(defaults.devices,e.id))};this.doc=next;this.fault=null;this.result=solve(this.doc,this.state.devices);return 'updated';
    }
    preview(doc){const fork=this.fork();fork.update(doc);const r=fork.read();fork.destroy();return r;}
    fork(){return Session.restore(this.capture());}
    capture(){return validateSnapshot({kind:'simlab-household-session',schemaVersion:1,modelRevision:1,scenarioId:this.scenarioId,scenarioRevision:1,document:this.doc,physics:this.state});}
    static restore(input){const s=validateSnapshot(input),session=new Session(s.document,s.scenarioId);session.state=M.clone(s.physics);session.result=solve(session.doc,session.state.devices);return session;}
    advance(seconds){
      if(this.destroyed)throw new Error('家庭 session 已卸載');number(seconds,0,1e6);let left=seconds,advanced=0;
      while(left>1e-10){
        if(!this.result.reliable){this.fault='計算暫停／讀值未確定';break;}
        const candidates=this.doc.components.filter(C.protective).flatMap(c=>P.candidates(c,this.state.devices[c.id],this.result.components[c.id]).slice(0,1).map(e=>({...e,id:c.id}))),at=Math.min(left,...candidates.map(e=>e.after)),events=candidates.filter(e=>e.after<=at+1e-9);
        for(const c of this.doc.components.filter(C.protective))P.advance(c,this.state.devices[c.id],this.result.components[c.id],at);
        for(const w of this.doc.wires){const i=this.result.wires[w.id].current;if(i!==null)this.state.wires[w.id]=Math.max(0,P.heat(this.state.wires[w.id],(i/w.rating)**2,at,60));}
        for(const c of this.doc.components.filter(energyComponents)){const r=this.result.components[c.id],power=c.type==='hh-energy-meter'?r.reading:r.loadPower;if(power!==null)this.state.energy[c.id]+=Math.max(0,power)*at/3600000;}
        this.state.time+=at;left-=at;advanced+=at;
        for(const e of events.sort((a,b)=>a.id.localeCompare(b.id))){const c=this.doc.components.find(c=>c.id===e.id),r=this.result.components[e.id],s=this.state.devices[e.id];s.status=P.fuse(c)?'blown':'tripped';s.reason=e.reason;s.fast=0;s.residual=0;this.state.events.push({time:this.state.time,id:e.id,reason:e.reason,current:Math.abs(r.current??0),residual:r.residualCurrent??0});}
        if(this.state.events.length>100)this.state.events.splice(0,this.state.events.length-100);
        if(events.length)this.result=solve(this.doc,this.state.devices);
      }
      return {advanced,complete:left<=1e-10,result:this.publish()};
    }
    resetProtection(id){const c=this.doc.components.find(c=>c.id===id),s=this.state.devices[id];if(!s||s.status==='closed')return false;s.status='closed';s.reason=null;s.fast=0;s.residual=0;if(P.fuse(c))s.heat=0;this.result=solve(this.doc,this.state.devices);this.publish();return true;}
    reset(){this.state=initial(this.doc);this.fault=null;this.result=solve(this.doc,this.state.devices);return this.publish();}
    destroy(){this.destroyed=true;this.listeners.clear();}
  }
  return {Session,solve,validate,validateSnapshot,encodeSession,decodeSession,sessionByteLimit};
});
