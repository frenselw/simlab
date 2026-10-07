(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry, node ? require("./circuit-model.js") : root.CircuitModel);
  if (node) module.exports = api; else root.CircuitSolver = api;
})(globalThis, function (R, M) {
  "use strict";
  function union(keys) {
    const parent = new Map(keys.map((x) => [x, x]));
    const find = (x) => { let p = x; while (parent.get(p) !== p) p = parent.get(p); while (parent.get(x) !== x) { const next = parent.get(x); parent.set(x, p); x = next; } return p; };
    return { find, join(a, b) { parent.set(find(a), find(b)); } };
  }
  // Row-scaled RREF exposes the nullspace. Unidentifiable currents are never reported as zero.
  function linear(A, b) {
    const n = b.length; if (!n) return { x: [], nullspace: [], roundoff: [] };
    const rows = A.map((a, i) => { const scale = Math.max(...a.map(Math.abs), 1e-30); return [...a.map((v) => v / scale), b[i] / scale]; });
    // Track the RHS magnitudes involved in cancellation, in each unknown's
    // own units. Tiny high-resistance currents have tiny error scales too.
    const rhsScales=rows.map(row=>Math.abs(row[n])),pivots = []; let rank = 0;
    for (let col = 0; col < n; col++) {
      let p = rank; for (let i = rank; i < n; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[p]?.[col] || 0)) p = i;
      if (rank === n || Math.abs(rows[p][col]) < 1e-15) continue;
      [rows[p], rows[rank]] = [rows[rank], rows[p]];
      [rhsScales[p],rhsScales[rank]]=[rhsScales[rank],rhsScales[p]];
      const value = rows[rank][col]; rhsScales[rank]/=Math.abs(value);for (let j = col; j <= n; j++) rows[rank][j] /= value;
      for (let i = 0; i < n; i++) if (i !== rank) { const factor = rows[i][col];rhsScales[i]+=Math.abs(factor)*rhsScales[rank];for (let j = col; j <= n; j++) rows[i][j] -= factor * rows[rank][j]; }
      pivots.push(col); rank++;
    }
    for (let i = rank; i < n; i++) if (Math.abs(rows[i][n]) > 1e-8) return { error: "inconsistent" };
    const x = Array(n).fill(0); pivots.forEach((col, i) => { x[col] = rows[i][n]; });
    const nullspace = [];
    for (let col = 0; col < n; col++) if (!pivots.includes(col)) { const v = Array(n).fill(0); v[col] = 1; pivots.forEach((p, i) => { v[p] = -rows[i][col]; }); nullspace.push(v); }
    if (x.some((v) => !Number.isFinite(v))) return { error: "numerical" };
    const roundoff=Array(n).fill(0);pivots.forEach((col,i)=>roundoff[col]=32*n*Number.EPSILON*rhsScales[i]);
    return { x, nullspace, roundoff };
  }
  function solve(input,relayStates=null) {
    const doc = M.validate(input), ports = M.endpoints(doc), uf = union([...ports.keys()]); doc.wires.filter(w=>w.resistance===0).forEach((w) => uf.join(w.from, w.to));
    const netOf = Object.fromEntries([...ports.keys()].map((p) => [p, uf.find(p)])), netKeys = [...new Set(Object.values(netOf))], conductive = union(netKeys);
    const edges = [], branches = new Map();
    function edge(c, a, b, kind, resistance, emf = 0, law = null, wire = false) {
      const pa=wire?a:c.id+":"+a,pb=wire?b:c.id+":"+b;
      const e = { id: wire?c.id:c.id + ":" + a, c, a: netOf[pa], b: netOf[pb], pa, pb, kind, resistance, emf, law };
      edges.push(e); conductive.join(e.a, e.b); if (!branches.has(c.id)) branches.set(c.id, e);
    }
    doc.components.forEach(c => R.dc(c,relayStates?.get(c.id)).forEach(b => edge(c,b.from,b.to,b.kind,b.resistance,b.emf||0,b.law)));
    doc.wires.filter(w=>w.resistance>0).forEach(w=>edge(w,w.from,w.to,'resistor',w.resistance,0,null,true));
    const groups = new Map();
    netKeys.forEach((net) => { const key = conductive.find(net); if (!groups.has(key)) groups.set(key, { key, nets: [], edges: [] }); groups.get(key).nets.push(net); });
    edges.forEach((e) => groups.get(conductive.find(e.a)).edges.push(e));
    const solutions = new Map(), diagnostics = [], potentials = {}, components = {}, wires = {}, islandOf = {};
    const injections = new Map([...ports.keys()].map((key) => [key, null]));
    for (const g of groups.values()) {
      const requested = doc.display.reference && netOf[doc.display.reference];
      const source = g.edges.find((e) => e.c.type === "battery");
      g.reference = g.nets.includes(requested) ? requested : source ? source.c.params.polarity < 0 ? source.a : source.b : g.nets[0];
      const nodes = g.nets.filter((net) => net !== g.reference), nodeIndex = new Map(nodes.map((net, i) => [net, i]));
      // Keep each linear resistance as V − R I = 0. Stamping a tiny meter
      // conductance into a low-resistance node loses finite coupling by cancellation.
      const voltageEdges = g.edges.filter((e) => e.kind === "branch" || e.kind === "resistor"), n = nodes.length + voltageEdges.length;
      voltageEdges.forEach((e, i) => { e.index = nodes.length + i; });
      const diff = (a, b) => { const v = Array(n).fill(0); if (nodeIndex.has(a)) v[nodeIndex.get(a)]++; if (nodeIndex.has(b)) v[nodeIndex.get(b)]--; return v; };
      const dot = (a, x) => a.reduce((s, v, i) => s + v * x[i], 0);
      function assemble(x) {
        const A = Array.from({ length: n }, () => Array(n).fill(0)), b = Array(n).fill(0);
        g.edges.forEach((e) => {
          const d = diff(e.a, e.b);
          if (e.kind === "branch" || e.kind === "resistor") { for (let i = 0; i < nodes.length; i++) { A[i][e.index] += d[i]; A[e.index][i] += d[i]; } A[e.index][e.index] -= e.resistance; b[e.index] = e.emf; }
          else {
            const v = dot(d, x), at = e.kind === "nonlinear" ? e.law(v, e.c.params) : { current: v / e.resistance, conductance: 1 / e.resistance };
            const offset = at.current - at.conductance * v;
            for (let i = 0; i < nodes.length; i++) { b[i] -= d[i] * offset; for (let j = 0; j < nodes.length; j++) A[i][j] += d[i] * at.conductance * d[j]; }
          }
        });
        return { A, b };
      }
      function residual(x) {
        const { A, b } = assemble(x); return Math.max(0, ...b.map((v, i) => Math.abs(dot(A[i], x) - v) / Math.max(1, Math.abs(v), ...A[i].map((a, j) => Math.abs(a * x[j])))));
      }
      let x = Array(n).fill(0), result, error, iteration = 0;
      for (; iteration < 100; iteration++) {
        const { A, b } = assemble(x); result = linear(A, b);
        if (result.error) { error = result.error; break; }
        const oldResidual = residual(x); let next = result.x, factor = 1;
        while (residual(next) > oldResidual && factor > 1 / 2048) { factor /= 2; next = x.map((v, i) => v + factor * (result.x[i] - v)); }
        x = next;
        if (residual(x) < 1e-9) break;
      }
      if (!error && (iteration === 100 || residual(x) > 1e-8)) error = "convergence";
      if (!error) { const { A, b } = assemble(x); result = linear(A, b); if (result.error) error = result.error; }
      const estimate = (coeff, constant = 0) => {
        if (error) return null;
        if (result.nullspace.some((v) => Math.abs(dot(coeff, v)) > 1e-8 * Math.max(1, ...coeff.map(Math.abs)))) return null;
        const value=dot(coeff,x)+constant;
        const noise=coeff.reduce((sum,c,i)=>sum+Math.abs(c)*result.roundoff[i],0)+4*Number.EPSILON*(Math.abs(constant)+coeff.reduce((sum,c,i)=>sum+Math.abs(c*x[i]),0));
        return { value, noise };
      };
      const reading = (e) => e===null?null:Math.abs(e.value)<=e.noise?0:e.value;
      const ident = (coeff, constant = 0) => reading(estimate(coeff, constant));
      const solution = { ...g, x, error, n, diff, ident, estimate, reading, residual: error ? null : residual(x), iterations: iteration + 1 };
      solutions.set(g.key, solution);
      if (error) diagnostics.push({ code: error, island: g.key, message: error === "inconsistent" ? "理想電源短路或電源條件互相矛盾；此電路沒有有限解。" : "此電路未得到可靠解，請檢查接線或參數。" });
      else if (result.nullspace.length) diagnostics.push({ code: "indeterminate", island: g.key, message: "部分理想支路電流不能唯一確定；相關讀值顯示 —。可加入實際內阻。" });
      g.nets.forEach((net) => { potentials[net] = ident(diff(net, g.reference)); });
      [...ports.keys()].filter((p) => g.nets.includes(netOf[p])).forEach((p) => { islandOf[p] = g.key; injections.set(p, { coeff: Array(n).fill(0), constant: 0, solution }); });
      g.edges.forEach((e) => {
        const d = diff(e.a, e.b), v = ident(d); let coeff, constant = 0, at;
        if (e.kind === "branch" || e.kind === "resistor") { coeff = Array(n).fill(0); coeff[e.index] = 1; }
        else { const voltage = d.reduce((s, value, i) => s + value * x[i], 0); at = e.kind === "nonlinear" ? e.law(voltage, e.c.params) : { current: voltage / e.resistance, conductance: 1 / e.resistance, resistance: e.resistance }; coeff = d.map((a) => a * at.conductance); constant = at.current - at.conductance * voltage; }
        const current = ident(coeff, constant);
        e.result = { voltage: v, current, power: v===0?0:v === null || current === null ? null : v * current, resistance: v === null && e.kind === "nonlinear" ? null : at?.resistance ?? e.resistance, temperature: v === null ? null : at?.temperature ?? null };
        for (const [port, sign] of [[e.pa, 1], [e.pb, -1]]) { const injection = injections.get(port); injection.coeff = injection.coeff.map((c, i) => c + sign * coeff[i]); injection.constant += sign * constant; }
      });
    }
    const potential = (p) => potentials[netOf[p]] ?? null;
    const voltage = (a, b) => { if (!ports.has(a) || !ports.has(b) || islandOf[a] !== islandOf[b]) return null; const s = solutions.get(islandOf[a]); return s.ident(s.diff(netOf[a], netOf[b])); };
    doc.components.forEach((c) => {
      const e = branches.get(c.id), v = voltage(c.id + ":a", c.id + ":b");
      const entry = e?.result ? { ...e.result } : { voltage: v, current: c.type === "switch" || c.type === "voltmeter" ? 0 : null, power: 0, resistance: null, temperature: null };
      const ownEdges = edges.filter(e=>e.c.id===c.id); entry.branches = ownEdges.map(e=>({from:e.pa,to:e.pb,...e.result})); if(ownEdges.length) entry.power=ownEdges.some(e=>e.result.power===null) ? null : ownEdges.reduce((s,e)=>s+e.result.power,0);
      if(c.type==='relay'){const state=relayStates?.get(c.id);entry.contact=state?state.contact:'d';entry.position=state?.position??0;entry.target=state?.target??false;const contactEdge=ownEdges.find(e=>e.pa===c.id+':c');entry.contactCurrent=contactEdge?contactEdge.result.current:0;}
      if(R.dualMeter(c)){
        const positives=['a','c'].filter(key=>M.degree(doc,c.id+':'+key)>0),common=M.degree(doc,c.id+':b')>0,active=positives.length===1?positives[0]:null;
        const activeEdge=ownEdges.find(e=>e.pa===c.id+':'+active),ranges=R.meterRanges(c);
        entry.activePort=active;entry.range=active==='c'?ranges.low:ranges.high;entry.minimum=entry.range*R.meterScale.minimumFraction;entry.division=entry.range/ranges.divisions;entry.unit=R.get(c.type).icon;
        entry.voltage=active?voltage(c.id+':'+active,c.id+':b'):null;
        entry.current=activeEdge?activeEdge.result.current:(c.type==='voltmeter'?0:null);
        entry.resistance=activeEdge?.result.resistance??(c.type==='voltmeter'&&c.params.resistance>0?c.params.resistance/(active==='c'?5:1):null);
        entry.reading=active&&common?(c.type==='voltmeter'?entry.voltage:entry.current):null;
        entry.meterStatus=positives.length>1?'dual-positive':!active?'unconnected':!common?'missing-common':entry.reading===null?'unknown':entry.reading>entry.range+1e-10||entry.reading<entry.minimum-1e-10?'overrange':entry.reading<-1e-10?'reverse':'normal';
        if(entry.meterStatus==='dual-positive')diagnostics.push({code:'meter-terminals',component:c.id,message:c.label+'：兩個正極孔同時接線，請只用一個量程孔及共用 − 孔。'});
      }
      else if(c.type==='galvanometer'){
        const connected=['a','b'].every(key=>M.degree(doc,c.id+':'+key)>0);
        entry.range=c.params.range;entry.minimum=-entry.range;entry.division=entry.range/20;entry.unit='A';
        entry.reading=connected?entry.current:null;
        entry.meterStatus=!connected?'unconnected':entry.reading===null?'unknown':Math.abs(entry.reading)>entry.range+entry.range*1e-8?'overrange':entry.reading<0?'reverse':'normal';
      }
      else if (c.type === "wattmeter") { const sensed = voltage(c.id + ":c", c.id + ":d"); entry.reading = sensed === null || entry.current === null ? null : sensed * entry.current; entry.sensedVoltage = sensed; entry.unit = "W";const connected=['a','b','c','d'].every(key=>M.degree(doc,c.id+':'+key)>0);entry.meterStatus=!connected?'unconnected':entry.reading===null?'unknown':Math.abs(entry.reading)>c.params.range?'overrange':entry.reading<0?'reverse':'normal'; }
      if (c.type === "battery") { entry.delivered = entry.power === null ? null : -entry.power; entry.internalPower = entry.current === null ? null : entry.current ** 2 * c.params.resistance; entry.sourcePower = entry.current === null ? null : -c.params.voltage * c.params.polarity * entry.current; }
      if (entry.voltage === null && !e) entry.power = null;
      components[c.id] = entry;
    });
    // A wire is identifiable precisely when its KCL cut is identifiable.
    // Non-bridge ideal-wire cycle edges carry no arbitrary animated current.
    const adjacency = new Map([...ports.keys()].map((p) => [p, []]));
    const netPorts = new Map(netKeys.map(net => [net, []]));
    for (const p of ports.keys()) netPorts.get(netOf[p]).push(p);
    doc.wires.filter(w=>w.resistance===0).forEach((w) => { adjacency.get(w.from).push({ to: w.to, id: w.id }); adjacency.get(w.to).push({ to: w.from, id: w.id }); });
    doc.wires.forEach((w) => {
      if(w.resistance>0){wires[w.id]={...branches.get(w.id).result,potential:potential(w.from),potentialTo:potential(w.to),cyclic:false};return;}
      const seen = new Set([w.from]), pending = [w.from];
      while (pending.length) { const p = pending.pop(); for (const e of adjacency.get(p)) if (e.id !== w.id && !seen.has(e.to)) { seen.add(e.to); pending.push(e.to); } }
      let current = null;
      if (!seen.has(w.to)) {
        const s = injections.get(w.from).solution, cuts = [-1, 1].map(sign => {
          const coeff = Array(s.n).fill(0); let constant = 0;
          for (const p of netPorts.get(netOf[w.from])) if (seen.has(p) === (sign === -1)) {
            const q = injections.get(p); for (let i = 0; i < s.n; i++) coeff[i] += sign * q.coeff[i]; constant += sign * q.constant;
          }
          return s.estimate(coeff, constant);
        }).filter(e => e !== null);
        // Either side gives the same oriented current. Prefer the expression
        // with less cancellation, so a large parallel load cannot hide a
        // meter's real tiny current or make it depend on from/to storage.
        current = s.reading(cuts.reduce((best, e) => best===null||e.noise<best.noise?e:best, null));
      }
      const drop=voltage(w.from,w.to);
      wires[w.id] = { current, potential: potential(w.from), potentialTo:potential(w.to), voltage:drop, resistance:0, power:drop===0?0:null, cyclic: seen.has(w.to) };
    });
    return { components, wires, potentials: Object.fromEntries([...ports.keys()].map((p) => [p, potential(p)])), islandOf, references: [...solutions.values()].map((s) => ({ island: s.key, endpoint: [...ports.keys()].find((p) => netOf[p] === s.reference), voltage: 0 })), diagnostics, residual: Math.max(0, ...[...solutions.values()].filter((s) => !s.error).map((s) => s.residual)), voltage };
  }
  return { solve, linear };
});
