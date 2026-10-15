(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./circuit-model.js') : root.CircuitModel,
    node ? require('./component-registry.js') : root.CircuitRegistry,
    node ? require('./circuit-routing.js') : root.CircuitRouting);
  if (node) module.exports = api; else root.CircuitSnapping = api;
})(globalThis, function (M, R, G) {
  'use strict';

  function candidates(doc, component, radius, portId) {
    const loose = doc.junctions.filter(j => M.degree(doc, j.id + ':p') > 0), pairs = [];
    for (const port of R.ports(component).filter(p => !portId || p.id === portId)) for (const j of loose) {
      const distance = Math.hypot(port.x - j.x, port.y - j.y);
      if (distance < radius) pairs.push({ port, endpoint: j.id + ':p', x: j.x, y: j.y, distance });
    }
    // Equal-distance choices follow the stable registry/document ordering.
    return pairs.sort((a, b) => a.distance - b.distance);
  }

  function join(doc, endpoint, portId) {
    const next = M.clone(doc), wires = [];
    for (const w of next.wires) {
      if (w.from !== endpoint && w.to !== endpoint) continue;
      wires.push(w.id);
      // Capture the visible cable before a junction becomes a component port;
      // automatic routing must not redraw it merely because its owner changes.
      const path = G.route(doc, w);
      if (w.shape !== 'free') {
        w.shape = 'free';
        w.via = (path.length > M.limits.stroke + 2 ? G.resample(path, 10) : path)
          .slice(1, -1).map(p => ({ x: p.x, y: p.y }));
      }
      if (w.from === endpoint) w.from = portId;
      if (w.to === endpoint) w.to = portId;
    }
    if (!wires.length) return null;
    if (next.display.reference === endpoint) next.display.reference = portId;
    M.cleanup(next);
    if (!M.reconcile(next, doc)) return null;
    try { return { doc: M.validate(next), wires }; } catch { return null; }
  }

  // Pure drag preview. Callers own activity permissions, release and history;
  // every pointer sample starts from the committed document, never this result.
  function component(doc, id, position, radius, portId) {
    const c = doc.components.find(c => c.id === id);
    if (!c || !M.permission(doc, c, 'move') || !Number.isFinite(position.x) ||
        !Number.isFinite(position.y) || !Number.isFinite(radius) || radius <= 0) return null;
    for (const candidate of candidates(doc, { ...c, ...position }, radius, portId)) {
      let next = M.clone(doc);
      const moved = next.components.find(c => c.id === id);
      moved.x = candidate.x - (candidate.port.x - position.x);
      moved.y = candidate.y - (candidate.port.y - position.y);
      if (!M.reconcile(next, doc)) continue;
      let joined = join(next, candidate.endpoint, candidate.port.id);
      if (!joined) continue;
      next = joined.doc;
      const port = R.ports(next.components.find(c => c.id === id)).find(p => p.id === candidate.port.id);
      const connections = [{ id: port.id, x: port.x, y: port.y, endpoint: candidate.endpoint, wires: joined.wires }];
      const used = new Set([candidate.endpoint]);
      // A junction is indivisible: all of its wire ends dock to one nearest port.
      for (const other of candidates(next, next.components.find(c => c.id === id), radius)) {
        if (portId) break;
        if (used.has(other.endpoint)) continue;
        joined = join(next, other.endpoint, other.port.id);
        if (!joined) continue;
        next = joined.doc; used.add(other.endpoint);
        connections.push({ id: other.port.id, x: other.port.x, y: other.port.y, endpoint: other.endpoint, wires: joined.wires });
      }
      return { doc: next, snap: { ...connections[0], connections } };
    }
    return null;
  }
  function hand(doc, id, position, radius, portId) {
    const person = doc.components.find(c => c.id === id);
    if (doc.analysis !== 'household' || person?.type !== 'house-person' ||
        !R.ports(person).some(p => p.id === portId) || !M.permission(doc, person, 'move')) return null;
    const loose = component(doc, id, position, radius, portId);
    if (loose) return loose;
    if (![position.x, position.y, radius].every(Number.isFinite) || radius <= 0) return null;
    const grip = R.ports({ ...person, ...position }).find(p => p.id === portId), targets = [];
    for (const c of doc.components.filter(c => c.id !== id)) for (const p of R.ports(c)) {
      const distance = Math.hypot(p.x - grip.x, p.y - grip.y);
      if (distance < radius) targets.push({ ...p, endpoint: p.id, distance });
    }
    const own = new Set(R.ports(person).map(p => p.id));
    for (const w of doc.wires.filter(w => !own.has(w.from) && !own.has(w.to))) {
      const route = G.route(doc, w), point = G.nearest(route, grip);
      if (point?.distance < radius) targets.push({ ...point, wire: w.id, route });
    }
    // Give fixed terminals a small grip area before choosing the adjacent wire body.
    const priority = t => t.endpoint && t.distance < radius / 2 ? 0 : 1;
    for (const target of targets.sort((a, b) => priority(a) - priority(b) || a.distance - b.distance)) {
      const next = M.clone(doc), moved = next.components.find(c => c.id === id);
      moved.x = position.x + target.x - grip.x; moved.y = position.y + target.y - grip.y;
      if (!M.reconcile(next, doc)) continue;
      try {
        let endpoint = target.endpoint, wires;
        if (target.wire) {
          const w = next.wires.find(w => w.id === target.wire), budget = w.length, length = G.length(target.route);
          // Split the visible cable at the palm; keep both original ends connected.
          w.shape = 'free'; w.via = target.route.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
          endpoint = M.splitWire(next, w.id, target, target.route);
          for (const half of next.wires.filter(w => w.from === endpoint || w.to === endpoint))
            half.length = Math.max(60, budget * G.length(G.route(next, half)) / (length || 1));
          const joined = join(next, endpoint, portId);
          if (!joined) continue;
          Object.assign(next, joined.doc); wires = joined.wires;
        } else {
          // A fixed terminal stays owned by its component, including its earth bond.
          const existing = next.wires.find(w => w.from === portId && w.to === endpoint || w.to === portId && w.from === endpoint);
          wires = [(existing || M.connect(next, portId, endpoint, [], 'free')).id];
        }
        const snap = { id: portId, x: target.x, y: target.y, endpoint, wires };
        return { doc: M.validate(next), snap: { ...snap, connections: [snap] } };
      } catch { /* A full toolbox or invalid cable leaves the original circuit intact. */ }
    }
    return null;
  }
  return { component, hand };
});
