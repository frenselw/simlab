(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./circuit-model') : root.CircuitModel,
    node ? require('./component-registry') : root.CircuitRegistry,
    node ? require('./circuit-solver') : root.CircuitSolver);
  if (node) module.exports = api; else root.CircuitChecks = api;
})(typeof window === 'undefined' ? globalThis : window, function (M, R, S) {
  'use strict';
  const result = (passed,message,evidence={}) => ({passed,message,evidence});
  function topology(input,idealOnly=false) {
    const doc = M.validate(input), parent = new Map([...M.endpoints(doc).keys()].map(id => [id,id]));
    function net(id) {
      if (!parent.has(id)) throw new Error('不存在的端點：' + id);
      let root = id; while (parent.get(root) !== root) root = parent.get(root);
      while (id !== root) { const next = parent.get(id); parent.set(id,root); id = next; }
      return root;
    }
    doc.wires.filter(w=>!idealOnly||w.resistance===0).forEach(w => parent.set(net(w.to),net(w.from)));
    const edges = [], incident = new Map();
    function addEdge(e){edges.push(e);if(e.a!==e.b)for(const n of [e.a,e.b]){if(!incident.has(n))incident.set(n,[]);incident.get(n).push(e);}}
    for (const c of doc.components) R.dc(c).forEach((branch,i) => {
      const a=net(c.id+':'+branch.from), b=net(c.id+':'+branch.to);
      // A shorted branch cannot establish a series relationship.
      addEdge({id:c.id+':'+i,component:c.id,type:c.type,a,b});
    });
    if(idealOnly)doc.wires.filter(w=>w.resistance>0).forEach(w=>addEdge({id:w.id,component:w.id,type:'wire',a:net(w.from),b:net(w.to)}));
    return {doc,net,edges,incident};
  }
  function connected(doc,groups) {
    const t=topology(doc), nets=groups.map(group => group.map(t.net));
    const passed=nets.every(group => group.length > 1 && group.every(n => n===group[0]));
    return result(passed,passed?'指定端點已接通。':'指定端點尚未接通。',{groups,nets});
  }
  function series(input,ids,{requirePowered=false,minimumCurrent=1e-8}={}) {
    if (!Array.isArray(ids) || ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('串聯檢查需要至少兩個不同元件');
    const t=topology(input,true), selected=ids.map(id => t.edges.filter(e => e.component===id));
    if (selected.some(es => es.length!==1 || es[0].a===es[0].b)) return result(false,'有元件未形成有效支路，或被短路。');
    const first=selected[0][0], visited=new Set(), stack=[first];
    // Walk through degree-two nets only: a junction with another conductive
    // branch splits the series chain, regardless of where symbols are drawn.
    while (stack.length) {
      const edge=stack.pop(); if (visited.has(edge.id)) continue; visited.add(edge.id);
      for (const n of [edge.a,edge.b]) if (t.incident.get(n)?.length===2) stack.push(...t.incident.get(n));
    }
    let passed=selected.every(es => visited.has(es[0].id));
    const chain=t.edges.filter(e => visited.has(e.id));
    // Two unpowered branches sharing both nets are a parallel pair, not a
    // closed series circuit. A powered series ring contains a source branch.
    if (passed && chain.every(e => [e.a,e.b].every(n => t.incident.get(n)?.length===2)) && !chain.some(e => e.type==='battery')) passed=false;
    let currents;
    if (passed && requirePowered) {
      const a=S.solve(t.doc); currents=ids.map(id => a.components[id]?.current);
      passed=currents.every(i => Number.isFinite(i) && Math.abs(i)>minimumCurrent) && a.diagnostics.length===0;
    }
    return result(passed,passed?'指定元件已串聯'+(requirePowered?'，並有有效電流。':'。'):'尚未形成要求的串聯'+(requirePowered?'閉合電路。':'接法。'),{components:ids,chain:chain.map(e=>e.component),...(currents?{currents}:{})});
  }
  function parameter(input,{id,key,value,min,max,tolerance=1e-6}) {
    const doc=M.validate(input), c=doc.components.find(c=>c.id===id);
    if (!c || !Object.hasOwn(c.params,key)) return result(false,'找不到指定元件或參數。');
    const actual=c.params[key];
    const passed=value!==undefined ? typeof value==='number' ? Number.isFinite(actual)&&Math.abs(actual-value)<=tolerance : actual===value : typeof actual==='number'&&(min===undefined||actual>=min)&&(max===undefined||actual<=max);
    return result(passed,passed?'參數符合要求。':'參數尚未符合要求。',{id,key,actual,value,min,max});
  }
  function sliderEffect(input,{rheostat,lamp,direction='right',effect='dimmer',positions=[.2,.5,.8],minimumChange=.03}={}) {
    const doc=M.validate(input), rheo=doc.components.find(c=>c.id===rheostat), load=doc.components.find(c=>c.id===lamp);
    if (rheo?.type!=='rheostat' || load?.type!=='lamp') return result(false,'需要指定滑動變阻器與燈泡。');
    const vectors={right:[1,0],left:[-1,0],down:[0,1],up:[0,-1]}, vector=vectors[direction];
    if (!vector || !['dimmer','brighter'].includes(effect) || positions.length<3 || positions.some((p,i)=>!Number.isFinite(p)||p<=0||p>=1||i&&p<=positions[i-1]) || !(minimumChange>0)) throw new Error('滑片效果檢查設定無效');
    const angle=rheo.angle*Math.PI/180, projection=Math.cos(angle)*vector[0]+Math.sin(angle)*vector[1];
    if (Math.abs(projection)<.9) return result(false,'滑片移動方向與題目要求不一致。');
    const samples=positions.map(p => {
      const copy=M.clone(doc), position=projection>0?p:1-p;
      copy.components.find(c=>c.id===rheostat).params.position=position;
      const a=S.solve(copy), power=a.components[lamp]?.power;
      return {position,power,valid:a.diagnostics.length===0&&Number.isFinite(power)&&power>1e-9};
    });
    const sign=effect==='dimmer'?-1:1;
    const valid=samples.every(s=>s.valid), delta=sign*(samples.at(-1).power-samples[0].power);
    const passed=valid && samples.slice(1).every((s,i)=>sign*(s.power-samples[i].power)>1e-9) && delta/Math.max(...samples.map(s=>s.power))>=minimumChange;
    return result(passed,passed?'滑片向'+{right:'右',left:'左',down:'下',up:'上'}[direction]+'移動時，燈泡會'+(effect==='dimmer'?'變暗。':'變亮。'):'接法未能產生要求的亮度變化。',{rheostat,lamp,direction,effect,samples});
  }
  function all(...checks) { return result(checks.every(c=>c.passed),checks.every(c=>c.passed)?'全部條件符合。':'仍有條件未符合。',{checks}); }
  return {topology,connected,series,parameter,sliderEffect,all};
});
