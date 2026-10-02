(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./circuit-model.js") : root.CircuitModel);
  if (node) module.exports = api; else root.CircuitRouting = api;
})(globalThis, function (M) {
  "use strict";
  function compact(points) { return points.filter((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y); }
  function orthogonal(points) { const out = [points[0]]; for (const p of points.slice(1)) { const last = out[out.length - 1]; if (p.x !== last.x && p.y !== last.y) out.push({ x: p.x, y: last.y }); out.push(p); } return compact(out); }
  const clean = (p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
  function simplify(points, tolerance = 2) {
    const src = compact(points).map(clean); if (src.length < 3) return src;
    const keep = new Set([0, src.length - 1]), stack = [[0, src.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let far = tolerance, at = -1;
      for (let i = a + 1; i < b; i++) { const q = nearest([src[a], src[b]], src[i]); if (q.distance > far) { far = q.distance; at = i; } }
      if (at !== -1) { keep.add(at); stack.push([a, at], [at, b]); }
    }
    return src.filter((_, i) => keep.has(i));
  }
  function bounded(points, limit = M.limits.stroke + 2) {
    if (points.length <= limit) return points;
    let tolerance = 1, reduced = points;
    while (reduced.length > limit) { reduced = simplify(points, tolerance); tolerance *= 1.6; }
    return reduced;
  }
  function smooth(points) {
    if (points.length < 3) return points.map(clean);
    const out = [clean(points[0])];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], before = points[i - 1] || a, after = points[i + 2] || b;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const tangent = (dx, dy) => { const size = Math.hypot(dx, dy), factor = size ? Math.min(1 / 6, length / (3 * size)) : 0; return {x:dx * factor,y:dy * factor}; };
      const ta = tangent(b.x - before.x, b.y - before.y), tb = tangent(after.x - a.x, after.y - a.y);
      const c = {x:a.x + ta.x,y:a.y + ta.y}, d = {x:b.x - tb.x,y:b.y - tb.y};
      const steps = Math.max(2, Math.min(40, Math.ceil(length / 5)));
      for (let j = 1; j <= steps; j++) { const t = j / steps, u = 1 - t; out.push(clean({x:u**3*a.x + 3*u*u*t*c.x + 3*u*t*t*d.x + t**3*b.x,y:u**3*a.y + 3*u*u*t*c.y + 3*u*t*t*d.y + t**3*b.y})); }
    }
    return compact(out);
  }
  function finishStroke(points, shape = "smooth", tolerance = 2.5) {
    const src = compact(points); if (src.length < 2) return { shape, via: [] };
    if (shape === "auto") return { shape, via: bounded(simplify(src, 14), M.limits.bends + 2).slice(1, -1) };
    const chord = Math.hypot(src.at(-1).x - src[0].x, src.at(-1).y - src[0].y);
    const length = src.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - src[i].x, p.y - src[i].y), 0);
    const straight = shape === "smooth" && length <= chord * 1.1 && src.every(p => nearest([src[0], src.at(-1)], p).distance <= Math.max(tolerance * 2, chord * .018));
    return { shape, via: straight ? [] : bounded(simplify(src, shape === "smooth" ? tolerance : Math.min(.65, tolerance))).slice(1, -1) };
  }
  function resample(points, spacing = 40) {
    const length = points.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
    const count = Math.max(2, Math.min(M.limits.stroke + 1, Math.ceil(length / spacing))), out = [];
    for (let i = 0; i <= count; i++) out.push(clean(along(points, length * i / count)));
    return out;
  }
  function reshape(points, at, dx, dy, radius = 90) {
    const nearestPoint = nearest(points, at), i = nearestPoint.segment;
    const controls = [...points.slice(0, i + 1), clean(nearestPoint), ...points.slice(i + 1)];
    const distances = [0]; controls.slice(1).forEach((p, n) => distances.push(distances[n] + Math.hypot(p.x - controls[n].x, p.y - controls[n].y)));
    const center = distances[i + 1];
    return bounded(controls.map((p, n) => { const weight = n === 0 || n === controls.length - 1 ? 0 : Math.max(0, 1 - Math.abs(distances[n] - center) / radius) ** 2; return clean({x:p.x + dx * weight,y:p.y + dy * weight}); }));
  }
  function route(doc, wire) {
    const ends = M.endpoints(doc), a = ends.get(wire.from), b = ends.get(wire.to); if (!a || !b) return [];
    if (wire.shape && wire.shape !== "auto") { const points = compact([clean(a), ...wire.via, clean(b)]); return wire.shape === "smooth" ? smooth(points) : points; }
    const start = { x: a.x + a.dx * 20, y: a.y + a.dy * 20 }, end = { x: b.x + b.dx * 20, y: b.y + b.dy * 20 };
    if (wire.via.length) return orthogonal([a, start, ...wire.via, end, b]);
    const bounds = { left: Math.min(start.x,end.x)-160, right: Math.max(start.x,end.x)+160, top: Math.min(start.y,end.y)-160, bottom: Math.max(start.y,end.y)+160 };
    const obstacles = doc.components.filter(c => c.x+60>bounds.left && c.x-60<bounds.right && c.y+80>bounds.top && c.y-60<bounds.bottom).map((c) => ({ left: c.x - 52, right: c.x + 52, top: c.y - 52, bottom: c.y + 65 }));
    const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((o) => [o.left - 8, o.right + 8])])].sort((x, y) => x - y);
    const ys = [...new Set([start.y, end.y, start.y - 40, end.y + 40, ...obstacles.flatMap((o) => [o.top - 8, o.bottom + 8])])].sort((x, y) => x - y);
    const blocked = (p, q) => obstacles.some((o) => p.y === q.y ? p.y > o.top && p.y < o.bottom && Math.max(p.x, q.x) > o.left && Math.min(p.x, q.x) < o.right : p.x > o.left && p.x < o.right && Math.max(p.y, q.y) > o.top && Math.min(p.y, q.y) < o.bottom);
    const key = (x, y) => x + "," + y, first = key(xs.indexOf(start.x), ys.indexOf(start.y)), target = key(xs.indexOf(end.x), ys.indexOf(end.y));
    const queue = [];
    const push = (item) => { queue.push(item); let i=queue.length-1; while(i){const p=Math.floor((i-1)/2);if(queue[p].priority<=item.priority)break;queue[i]=queue[p];i=p;}queue[i]=item; };
    const pop = () => { const result=queue[0],tail=queue.pop(); if(queue.length){let i=0;while(i*2+1<queue.length){let child=i*2+1;if(child+1<queue.length&&queue[child+1].priority<queue[child].priority)child++;if(queue[child].priority>=tail.priority)break;queue[i]=queue[child];i=child;}queue[i]=tail;}return result; };
    push({k:first,cost:0,priority:0});
    const distance = new Map([[first, 0]]), previous = new Map(); let found = false, steps = 0;
    while (queue.length && steps++ < 20000) {
      const { k, cost } = pop(); if (cost > distance.get(k)) continue; if (k === target) { found = true; break; }
      const [xi, yi] = k.split(",").map(Number), p = { x: xs[xi], y: ys[yi] };
      for (const [nx, ny] of [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]]) { if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue; const q = { x: xs[nx], y: ys[ny] }; if (blocked(p, q)) continue; const nk = key(nx, ny), nc = cost + Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + .01; if (nc < (distance.get(nk) ?? Infinity)) { distance.set(nk, nc); previous.set(nk, k); push({ k: nk, cost: nc, priority: nc + Math.abs(q.x-end.x)+Math.abs(q.y-end.y) }); } }
    }
    let path = [];
    if (found) { let k = target; while (k) { const [x, y] = k.split(",").map(Number); path.unshift({ x: xs[x], y: ys[y] }); k = previous.get(k); } }
    else path = orthogonal([start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end]);
    const all = compact([a, ...path, b]); return all.filter((p, i, a) => !i || i === a.length - 1 || !((a[i - 1].x === p.x && p.x === a[i + 1].x) || (a[i - 1].y === p.y && p.y === a[i + 1].y)));
  }
  function path(points) { return points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "); }
  function nearest(points, p) {
    let best = null; for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); const q = { x: a.x + t * dx, y: a.y + t * dy, segment: i }; q.distance = Math.hypot(p.x - q.x, p.y - q.y); if (!best || q.distance < best.distance) best = q; } return best;
  }
  function along(points, distance) { for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y); if (distance <= length && length) return { x: a.x + (b.x - a.x) * distance / length, y: a.y + (b.y - a.y) * distance / length, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI }; distance -= length; } return points[points.length - 1]; }
  return { route, path, nearest, along, orthogonal, simplify, finishStroke, smooth, resample, reshape };
});
