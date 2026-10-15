(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./component-registry'):root.CircuitRegistry,node?require('./circuit-household-components'):root.CircuitHouseholdComponents);if(node)module.exports=api;else root.CircuitHouseholdConnections=api;})(globalThis,function(R,C){
  'use strict';
  function inspect(doc){
    const ports=new Map(doc.components.flatMap(c=>R.ports(c).map(p=>[p.id,{...p,component:c}]))),parent=new Map([...ports.keys(),...doc.junctions.map(j=>j.id+':p')].map(k=>[k,k]));
    const find=k=>{let p=k;while(parent.get(p)!==p)p=parent.get(p);return p;};
    const join=(a,b)=>parent.set(find(a),find(b));
    doc.wires.forEach(w=>join(w.from,w.to));
    for(const c of doc.components){if(['house-meter','house-breaker','house-rcd'].includes(c.type)){join(c.id+':li',c.id+':lo');join(c.id+':ni',c.id+':no');}if(['house-switch','house-fuse'].includes(c.type))join(c.id+':a',c.id+':b');}
    const roles=new Map();for(const [id,p]of ports){if(!p.role)continue;const k=find(id);if(!roles.has(k))roles.set(k,new Set());roles.get(k).add(p.role);}
    const roleOf=id=>{const r=roles.get(find(id));return r?.size===1?[...r][0]:null;};
    return {ports,find,roles,roleOf};
  }
  function validate(doc){
    if(doc.components.some(c=>!C.definitions[c.type]))throw new Error('家庭工作台只接受家庭元件');
    if(doc.components.filter(c=>c.type==='house-mains').length>1)throw new Error('只可使用一個市電電纜');
    if(doc.wires.some(w=>w.resistance!==0)||doc.cables.resistance!==0)throw new Error('家庭導線採理想導體，電阻固定為零');
    const topology=inspect(doc);
    if([...topology.roles.values()].some(set=>set.size>1))throw new Error('供電端 L／N／E 不能直接合併；家電兩條工作線仍可接錯');
    for(const c of doc.components){
      if(c.type==='house-switch'&&topology.roleOf(c.id+':a')==='E')throw new Error('普通開關可串接火線或零線，不能串接地線');
    }
    return topology;
  }
  function wireRole(doc,w,topology=inspect(doc)){
    for(const end of [w.from,w.to]){const p=topology.ports.get(end);if(p&&C.isAppliance(p.component))return p.key.toUpperCase();}
    return topology.roleOf(w.from);
  }
  return Object.freeze({inspect,validate,wireRole});
});
