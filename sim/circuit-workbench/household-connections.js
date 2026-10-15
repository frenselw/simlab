(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-household-components'):root.CircuitHouseholdComponents);if(node)module.exports=api;else root.CircuitHouseholdConnections=api;})(globalThis,function(R,C){
  'use strict';
  function inspect(doc){
    const ports=new Map(doc.components.flatMap(c=>R.ports(c).map(p=>[p.id,{...p,component:c}]))),parent=new Map([...ports.keys(),...doc.junctions.map(j=>j.id+':p')].map(k=>[k,k])),adjacency=new Map([...parent.keys()].map(k=>[k,[]]));
    const find=k=>{let p=k;while(parent.get(p)!==p)p=parent.get(p);return p;};
    const join=(a,b)=>{parent.set(find(a),find(b));adjacency.get(a).push(b);adjacency.get(b).push(a);};
    doc.wires.forEach(w=>join(w.from,w.to));
    for(const c of doc.components){if(['house-meter','house-breaker','house-rcd'].includes(c.type)){join(c.id+':li',c.id+':lo');join(c.id+':ni',c.id+':no');}if(['house-switch','house-fuse'].includes(c.type))join(c.id+':a',c.id+':b');}
    const roles=new Map();for(const [id,p]of ports){if(!p.role)continue;const k=find(id);if(!roles.has(k))roles.set(k,new Set());roles.get(k).add(p.role);}
    const cache=new Map(),roleOf=id=>{
      if(cache.has(id))return cache.get(id);
      let pending=[id];const seen=new Set(pending);let role=null;
      while(pending.length){const found=new Set(pending.map(k=>ports.get(k)?.role).filter(Boolean));if(found.size){role=found.size===1?[...found][0]:null;break;}const next=[];for(const k of pending)for(const other of adjacency.get(k)||[])if(!seen.has(other)){seen.add(other);next.push(other);}pending=next;}
      cache.set(id,role);return role;
    };
    return {ports,find,roles,roleOf};
  }
  function validate(doc){
    if(doc.components.some(c=>!C.definitions[c.type]))throw new Error('家庭工作台只接受家庭元件');
    if(doc.components.filter(c=>c.type==='house-mains').length>1)throw new Error('只可使用一個市電電纜');
    if(doc.wires.some(w=>w.resistance!==0)||doc.cables.resistance!==0)throw new Error('家庭導線使用模型固定的等效電阻，不能另設阻值');
    const topology=inspect(doc);
    return topology;
  }
  function wireRole(doc,w,topology=inspect(doc)){
    for(const end of [w.from,w.to]){const p=topology.ports.get(end);if(p&&C.isAppliance(p.component))return p.key.toUpperCase();}
    return topology.roleOf(w.from)||topology.roleOf(w.to);
  }
  return Object.freeze({inspect,validate,wireRole});
});
