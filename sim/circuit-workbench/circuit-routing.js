(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry);
  if (node) module.exports = api; else root.CircuitRouting = api;
})(globalThis, function (R) {
  "use strict";
  // Geometry stays independent of document validation; both the editor and the
  // validator measure exactly the polyline that the renderer displays.
  const M = { limits: { stroke: 96, bends: 24 }, endpoints(doc) {
    const ends = new Map(); doc.components.forEach(c => (doc.version<4?R.legacyPorts(c):R.ports(c)).forEach(p => ends.set(p.id,p)));
    doc.junctions.forEach(j => ends.set(j.id+":p",{...j,dx:0,dy:0})); return ends;
  } };
  const length = points => points.slice(1).reduce((sum,p,i) => sum + Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
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
    const controls = points;
    const distances = [0]; controls.slice(1).forEach((p, n) => distances.push(distances[n] + Math.hypot(p.x - controls[n].x, p.y - controls[n].y)));
    const center = distances[i] + Math.hypot(nearestPoint.x-controls[i].x,nearestPoint.y-controls[i].y), total=distances.at(-1);
    // A C2 bump has no cusp at the held point, and fades with zero slope and
    // curvature at either anchored end. Larger pulls involve more of the cable.
    radius=Math.max(radius,Math.min(total,100+Math.hypot(dx,dy)*1.8));
    return controls.map((p,n)=>{const offset=distances[n]-center,span=Math.min(radius,offset<0?center:total-center),u=span?Math.abs(offset)/span:1;
      const weight=n===0||n===controls.length-1||u>=1?0:(1-u*u)**3;
      return {x:p.x+dx*weight,y:p.y+dy*weight};});
  }
  // Clamped cubic spline: one shared second derivative at every knot. Unlike
  // separate per-segment handles, pulling a knot cannot create a sharp join.
  function fair(points, tangents) {
    const p=compact(points);if(p.length<3)return p.map(v=>({x:v.x,y:v.y}));
    const unit=(a,b)=>{const h=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:(b.x-a.x)/h,y:(b.y-a.y)/h};};
    const ends=tangents||[unit(p[0],p[1]),unit(p.at(-2),p.at(-1))],n=p.length,h=p.slice(1).map((v,i)=>Math.hypot(v.x-p[i].x,v.y-p[i].y));
    const lower=Array(n).fill(0),diagonal=Array(n).fill(0),upper=Array(n).fill(0),rhs=Array.from({length:n},()=>({x:0,y:0}));
    diagonal[0]=2*h[0];upper[0]=h[0];lower[n-1]=h.at(-1);diagonal[n-1]=2*h.at(-1);
    for(const key of ['x','y']){rhs[0][key]=6*((p[1][key]-p[0][key])/h[0]-ends[0][key]);rhs[n-1][key]=6*(ends[1][key]-(p[n-1][key]-p[n-2][key])/h.at(-1));}
    for(let i=1;i<n-1;i++){lower[i]=h[i-1];diagonal[i]=2*(h[i-1]+h[i]);upper[i]=h[i];for(const key of ['x','y'])rhs[i][key]=6*((p[i+1][key]-p[i][key])/h[i]-(p[i][key]-p[i-1][key])/h[i-1]);}
    for(let i=1;i<n;i++){const f=lower[i]/diagonal[i-1];diagonal[i]-=f*upper[i-1];for(const key of ['x','y'])rhs[i][key]-=f*rhs[i-1][key];}
    const second=Array.from({length:n},()=>({x:0,y:0}));for(let i=n-1;i>=0;i--)for(const key of ['x','y'])second[i][key]=(rhs[i][key]-(i<n-1?upper[i]*second[i+1][key]:0))/diagonal[i];
    const out=[{x:p[0].x,y:p[0].y}];
    for(let i=0;i<n-1;i++){const steps=Math.max(4,Math.min(256,Math.ceil(h[i])));for(let j=1;j<=steps;j++){const t=h[i]*j/steps,u=h[i]-t,q={};for(const key of ['x','y'])q[key]=second[i][key]*u**3/(6*h[i])+second[i+1][key]*t**3/(6*h[i])+(p[i][key]-second[i][key]*h[i]**2/6)*u/h[i]+(p[i+1][key]-second[i+1][key]*h[i]**2/6)*t/h[i];out.push(q);}}
    out[0]={x:p[0].x,y:p[0].y};out[out.length-1]={x:p.at(-1).x,y:p.at(-1).y};return out;
  }
  function bend(points,at,dx,dy,budget,radius=140) {
    if(points.length<2||length(points)<1e-7)return {points,limited:true};
    const initial=fitLength(fair(resample(points,Math.max(16,length(points)/28))),budget);
    const controls=resample(initial,Math.max(14,length(initial)/32)),unit=(a,b)=>{const d=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
    const tangents=[unit(initial[0],initial[1]),unit(initial.at(-2),initial.at(-1))];
    const grip=nearest(initial,at),direction=unit(initial[grip.segment],initial[grip.segment+1]);
    const axial=dx*direction.x+dy*direction.y,parallel={x:axial*direction.x,y:axial*direction.y},normal={x:dx-parallel.x,y:dy-parallel.y};
    // Sliding along a cable must not squash its knots through one another. A
    // mathematically C2 spline can still have a geometric cusp at zero speed.
    // Limit axial compression independently, retaining the sideways pull.
    const support=Math.max(radius,Math.min(length(initial),100+Math.hypot(dx,dy)*1.8));
    const shifted=reshape(controls,at,1,0,support),weights=controls.map((p,i)=>shifted[i].x-p.x);
    const candidate=f=>{
      let slide=1;
      for(let i=0;i<controls.length-1;i++){
        const ex=controls[i+1].x-controls[i].x,ey=controls[i+1].y-controls[i].y,edge2=ex*ex+ey*ey,change=f*(weights[i+1]-weights[i]);
        const sideways=change*(normal.x*ex+normal.y*ey),along=change*(parallel.x*ex+parallel.y*ey);
        if(along<0)slide=Math.min(slide,Math.max(0,(edge2*.5+sideways)/-along));
      }
      const dense=fair(controls.map((p,i)=>({x:p.x+f*weights[i]*(normal.x+slide*parallel.x),y:p.y+f*weights[i]*(normal.y+slide*parallel.y)})),tangents);
      return {dense,sampled:sampleCurve(dense)};
    };
    const withinLength=p=>length(p.dense)<=budget&&p.dense.every(v=>Math.abs(v.x)<=10000&&Math.abs(v.y)<=10000);
    const regular=p=>p.sampled.slice(1,-1).every((b,i)=>{
      const a=p.sampled[i],c=p.sampled[i+2],u=Math.atan2(b.y-a.y,b.x-a.x),v=Math.atan2(c.y-b.y,c.x-b.x);
      return Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)))<=Math.PI/10;
    });
    const legal=p=>withinLength(p)&&regular(p);
    let pulled=candidate(1),limited=!withinLength(pulled);
    if(!legal(pulled)){let low=0,high=1;for(let n=0;n<26;n++){const mid=(low+high)/2;if(legal(candidate(mid)))low=mid;else high=mid;}pulled=candidate(low);}
    // Measure and save the same sampled curve that is displayed/hit-tested.
    return {points:fitLength(pulled.sampled,budget),limited};
  }
  function sampleCurve(points){
    // Spend the finite sample budget on curved sections, rather than leaving
    // short-radius end transitions represented by just one or two long chords.
    const turn=points.map((p,i)=>{if(!i||i===points.length-1)return 0;const a=points[i-1],b=points[i+1],u=Math.atan2(p.y-a.y,p.x-a.x),v=Math.atan2(b.y-p.y,b.x-p.x);return Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)));});
    const score=[0];points.slice(1).forEach((p,i)=>score.push(score[i]+Math.hypot(p.x-points[i].x,p.y-points[i].y)/8+(turn[i]+turn[i+1])/(2*Math.PI/45)));
    const total=score.at(-1),out=[{x:points[0].x,y:points[0].y}];let segment=0;
    for(let i=1;i<97;i++){const wanted=total*i/97;while(segment<points.length-2&&score[segment+1]<wanted)segment++;const t=(wanted-score[segment])/(score[segment+1]-score[segment]||1),a=points[segment],b=points[segment+1];out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    out.push({x:points.at(-1).x,y:points.at(-1).y});return compact(out);
  }
  function fitLength(points, budget) {
    const a=points[0], b=points.at(-1), chord=Math.hypot(b.x-a.x,b.y-a.y);
    if (chord > budget + 1e-7) return null;
    if (length(points) <= budget) return points.map(p=>({x:p.x,y:p.y}));
    const distances=[0]; points.slice(1).forEach((p,i)=>distances.push(distances[i]+Math.hypot(p.x-points[i].x,p.y-points[i].y)));
    const total=distances.at(-1)||1, straight=points.map((_,i)=>({x:a.x+(b.x-a.x)*distances[i]/total,y:a.y+(b.y-a.y)*distances[i]/total}));
    const blend=f=>points.map((p,i)=>({x:straight[i].x+(p.x-straight[i].x)*f,y:straight[i].y+(p.y-straight[i].y)*f}));
    let low=0, high=1; for(let n=0;n<32;n++){const mid=(low+high)/2;if(length(blend(mid))<=budget)low=mid;else high=mid;}
    return blend(low);
  }
  function deform(points, a, b, budget) {
    const first=points[0], last=points.at(-1), distances=[0];
    points.slice(1).forEach((p,i)=>distances.push(distances[i]+Math.hypot(p.x-points[i].x,p.y-points[i].y)));
    const total=distances.at(-1)||1;
    const shifted=points.map((p,i)=>{const t=distances[i]/total;return {x:p.x+(a.x-first.x)*(1-t)+(b.x-last.x)*t,y:p.y+(a.y-first.y)*(1-t)+(b.y-last.y)*t};});
    shifted[0]={x:a.x,y:a.y};shifted[shifted.length-1]={x:b.x,y:b.y};return fitLength(shifted,budget);
  }
  function route(doc, wire) {
    const ends = M.endpoints(doc), a = ends.get(wire.from), b = ends.get(wire.to); if (!a || !b) return [];
    if (wire.shape && wire.shape !== "auto") { const points = compact([clean(a), ...wire.via, clean(b)]); return wire.shape === "smooth" ? smooth(points) : points; }
    const start = { x: a.x + a.dx * 20, y: a.y + a.dy * 20 }, end = { x: b.x + b.dx * 20, y: b.y + b.dy * 20 };
    if (wire.via.length) return orthogonal([a, start, ...wire.via, end, b]);
    const bounds = { left: Math.min(start.x,end.x)-160, right: Math.max(start.x,end.x)+160, top: Math.min(start.y,end.y)-160, bottom: Math.max(start.y,end.y)+160 };
    const modernMeter=c=>doc.version>=4&&R.dualMeter(c);
    const obstacles = doc.components.filter(c => modernMeter(c)?c.x+90>bounds.left&&c.x-90<bounds.right&&c.y+100>bounds.top&&c.y-100<bounds.bottom:c.x+60>bounds.left&&c.x-60<bounds.right&&c.y+80>bounds.top&&c.y-60<bounds.bottom).map((c) => modernMeter(c)?({left:c.x-78,right:c.x+78,top:c.y-86,bottom:c.y+78}):({ left: c.x - 52, right: c.x + 52, top: c.y - 52, bottom: c.y + 65 }));
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
  return { route, path, nearest, along, orthogonal, simplify, finishStroke, smooth, resample, reshape, fair, bend, length, fitLength, deform };
});
