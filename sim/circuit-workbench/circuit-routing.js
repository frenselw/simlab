(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry);
  if (node) module.exports = api; else root.CircuitRouting = api;
})(globalThis, function (R) {
  "use strict";
  // Geometry stays independent of document validation; both the editor and the
  // validator measure exactly the polyline that the renderer displays.
  const M = { limits: { stroke: 96, bends: 24 }, endpoints(doc) {
    const ends = new Map(); doc.components.forEach(c => R.portsForVersion(c,doc.version).forEach(p => ends.set(p.id,p)));
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
  // Fixed-parameter, open cubic B-spline. Moving the controls is a continuous
  // deformation even when two controls pass each other; the endpoint positions
  // remain exact and their directions can follow the cable naturally.
  function softCurve(points) {
    const n=points.length,degree=Math.min(3,n-1),end=n-degree;
    const knots=Array.from({length:n+degree+1},(_,i)=>i<=degree?0:i>=n?end:i-degree);
    function value(t) {
      let k=degree;while(k<n-1&&t>=knots[k+1])k++;
      const d=Array.from({length:degree+1},(_,j)=>({...points[k-degree+j]}));
      for(let r=1;r<=degree;r++)for(let j=degree;j>=r;j--){const a=(t-knots[k-degree+j])/(knots[k+1+j-r]-knots[k-degree+j]||1);
        d[j]={x:(1-a)*d[j-1].x+a*d[j].x,y:(1-a)*d[j-1].y+a*d[j].y};}
      return d[degree];
    }
    const out=[];for(let i=0;i<end;i++)for(let j=0;j<48;j++)out.push(value(i+j/48));
    out.push({...points.at(-1)});return out;
  }
  function roundCable(points) {
    // A local return bend can have zero speed even in a C2 spline. Round it
    // locally, rather than rejecting the user's entire displacement. A fixed
    // number of unrounded arc samples avoids thresholds as the cable moves.
    const total=length(points),p=Array.from({length:65},(_,i)=>along(points,total*i/64));
    const unit=(a,b)=>{const h=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:(b.x-a.x)/h,y:(b.y-a.y)/h};};
    const edges=p.slice(1).map((b,i)=>unit(p[i],b)),dist=p.slice(1).map((b,i)=>Math.hypot(b.x-p[i].x,b.y-p[i].y));
    const tangents=p.map((_,i)=>{if(!i)return edges[0];if(i===p.length-1)return edges.at(-1);
      const e=edges[i-1],f=edges[i],x=e.x+f.x,y=e.y+f.y,h=Math.hypot(x,y);
      return h>1e-8?{x:x/h,y:y/h}:{x:-e.y,y:e.x};});
    // Shared handles give a continuous tangent through every join, including
    // a half-turn. Handle sizes are local, so one fold cannot lock other parts.
    const handles=p.map((_,i)=>.32*Math.min(dist[Math.max(0,i-1)],dist[Math.min(i,dist.length-1)])),out=[p[0]];
    const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const turn=(u,v)=>Math.abs(Math.atan2(u.x*v.y-u.y*v.x,u.x*v.x+u.y*v.y));
    function flatten(a,c,d,b,depth=0) {
      const u={x:c.x-a.x,y:c.y-a.y},v={x:d.x-c.x,y:d.y-c.y},w={x:b.x-d.x,y:b.y-d.y};
      // Resolve direction changes before the final 98-point sample. Uniform
      // parameter steps can miss a tight bend, leaving a sharp chord at a join.
      if(depth>=16||turn(u,v)+turn(v,w)<.025){out.push(b);return;}
      const ac=mid(a,c),cd=mid(c,d),db=mid(d,b),left=mid(ac,cd),right=mid(cd,db),center=mid(left,right);
      flatten(a,ac,left,center,depth+1);flatten(center,right,db,b,depth+1);
    }
    for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];
      flatten(a,{x:a.x+tangents[i].x*handles[i],y:a.y+tangents[i].y*handles[i]},
        {x:b.x-tangents[i+1].x*handles[i+1],y:b.y-tangents[i+1].y*handles[i+1]},b);}
    out[0]={x:points[0].x,y:points[0].y};out[out.length-1]={x:points.at(-1).x,y:points.at(-1).y};return out;
  }
  function bend(points,at,dx,dy,budget,radius=140) {
    if(points.length<2||length(points)<1e-7)return {points,limited:true};
    if(Math.hypot(dx,dy)<1e-7)return {points:points.map(p=>({x:p.x,y:p.y})),limited:false};
    const initial=fitLength(points,budget);
    // Imported routes allow a small measurement tolerance, so their chord
    // can be just beyond physical reach. Keep the anchored shape and report
    // the limit instead of passing null into resampling.
    if(!initial)return {points:points.map(p=>({x:p.x,y:p.y})),limited:true};
    const controls=resample(initial,Math.max(14,length(initial)/32));
    const support=Math.max(radius,Math.min(length(initial),100+Math.hypot(dx,dy)*1.8));
    const shifted=reshape(controls,at,1,0,support),weights=controls.map((p,i)=>shifted[i].x-p.x);
    const soft=softCurve(controls),distances=[0];soft.slice(1).forEach((p,n)=>distances.push(distances[n]+Math.hypot(p.x-soft[n].x,p.y-soft[n].y)));
    // Apply the smooth displacement field to the original shape. Refairing the
    // whole starting cable would make an existing tight U jump on first pickup.
    const baseCurve=soft.map((_,n)=>along(initial,length(initial)*distances[n]/distances.at(-1)));
    const weightCurve=softCurve(weights.map(x=>({x,y:0}))),held=nearest(baseCurve,at);
    const i=held.segment,a=baseCurve[i],b=baseCurve[i+1],t=Math.hypot(held.x-a.x,held.y-a.y)/(Math.hypot(b.x-a.x,b.y-a.y)||1);
    // Normalize at the held point, not at the largest control weight: smoothing
    // must not make grips near an endpoint lag behind the finger.
    const gain=weightCurve[i].x+(weightCurve[i+1].x-weightCurve[i].x)*t||1;
    const candidate=f=>roundCable(baseCurve.map((p,n)=>({x:p.x+f*weightCurve[n].x/gain*dx,y:p.y+f*weightCurve[n].x/gain*dy})));
    const reachable=p=>length(p)<=budget&&p.every(v=>Math.abs(v.x)<=10000&&Math.abs(v.y)<=10000);
    let pulled=candidate(1),limited=!reachable(pulled);
    // Only physical reach bounds the pull. Sampled angles are not a monotonic
    // predicate: putting them in this search caused the inward-drag rebound.
    if(limited){let low=0,high=1;for(let n=0;n<26;n++){const mid=(low+high)/2;if(reachable(candidate(mid)))low=mid;else high=mid;}pulled=candidate(low);}
    return {points:fitLength(sampleCurve(pulled),budget),limited};
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
  // Round each authored corner locally. Long straight runs remain straight;
  // a global interpolating spline can overshoot and loop around nearby sockets.
  function rounded(points,radius=20) {
    const p=compact(points).filter((v,i,a)=>!i||i===a.length-1||Math.abs((v.x-a[i-1].x)*(a[i+1].y-v.y)-(v.y-a[i-1].y)*(a[i+1].x-v.x))>1e-7||(v.x-a[i-1].x)*(a[i+1].x-v.x)+(v.y-a[i-1].y)*(a[i+1].y-v.y)<0);
    if(p.length<3)return p.map(v=>({x:v.x,y:v.y}));
    const out=[{x:p[0].x,y:p[0].y}];
    for(let i=1;i<p.length-1;i++){const a=p[i-1],b=p[i],c=p[i+1],before=Math.hypot(b.x-a.x,b.y-a.y),after=Math.hypot(c.x-b.x,c.y-b.y),cut=Math.min(radius,before*.45,after*.45);
      const first={x:b.x+(a.x-b.x)*cut/before,y:b.y+(a.y-b.y)*cut/before},last={x:b.x+(c.x-b.x)*cut/after,y:b.y+(c.y-b.y)*cut/after};out.push(first);
      for(let n=1;n<=9;n++){const t=n/9,u=1-t;out.push({x:u*u*first.x+2*u*t*b.x+t*t*last.x,y:u*u*first.y+2*u*t*b.y+t*t*last.y});}
    }out.push({x:p.at(-1).x,y:p.at(-1).y});return compact(out);
  }
  function followEndpoints(doc,wire,points,a,b,budget,before) {
    const owner=p=>doc.components.find(c=>c.id===p.id?.split(':')[0]&&R.dualMeter(c));
    const rotates=c=>{const old=before?.components.find(v=>v.id===c.id);return !old||old.angle!==c.angle||!!old.mirrored!==!!c.mirrored;};
    const ca=owner(a),cb=owner(b),changed=(p,q)=>p.x!==q.x||p.y!==q.y,fixA=ca&&rotates(ca)&&changed(a,points[0]),fixB=cb&&rotates(cb)&&changed(b,points.at(-1));
    if(!fixA&&!fixB)return deform(points,a,b,budget);
    if(ca&&cb&&ca.id===cb.id){const p=rounded(route(doc,{...wire,shape:'auto',via:[]},{rotatedMeters:true}),12);return p.length>=2&&length(p)<=budget?p:null;}
    // A moving meter changes only its connector tail; keep the far cable as drawn.
    let result=deform(points,fixA?points[0]:a,fixB?points.at(-1):b,budget);if(!result)return null;
    function tail(src,port,c){const box=R.bodyBounds(c),region={left:c.x-200,right:c.x+200,top:c.y-200,bottom:c.y+200},inside=p=>p.x>=region.left-1e-7&&p.x<=region.right+1e-7&&p.y>=region.top-1e-7&&p.y<=region.bottom+1e-7;
      let join=1;while(join<src.length-1&&inside(src[join]))join++;
      // An existing bend may reenter the new housing; replace through its exit.
      for(let i=join;i<src.length-1;i++)if(src[i].x>box.left&&src[i].x<box.right&&src[i].y>box.top&&src[i].y<box.bottom)join=i+1;
      if(join===src.length-1&&inside(src[join])){const p=route(doc,{...wire,from:port.id,to:port.id===a.id?b.id:a.id,shape:'auto',via:[]},{rotatedMeters:true});return p.length?rounded(p,12):null;}
      let target=src[join],rest=src.slice(join);
      // A rotation-invariant boundary and a confined prefix keep successive
      // turns from winding extra laps while preserving the far cable.
      if(inside(src[join-1])){const p=src[join-1],v={x:target.x-p.x,y:target.y-p.y},tx=v.x?(v.x>0?region.right-p.x:region.left-p.x)/v.x:Infinity,ty=v.y?(v.y>0?region.bottom-p.y:region.top-p.y)/v.y:Infinity,t=Math.min(tx,ty);
        target={x:Math.max(region.left,Math.min(region.right,p.x+v.x*t)),y:Math.max(region.top,Math.min(region.bottom,p.y+v.y*t))};
      }else rest=src.slice(join+1);
      // A frozen join may already lie over another object in a user-drawn cable.
      // Keep that far portion; only the rotating housing is mandatory here.
      const local={...doc,components:doc.components.filter(v=>{const box=R.bodyBounds(v);return v.id===c.id||!(target.x>box.left&&target.x<box.right&&target.y>box.top&&target.y<box.bottom);}),junctions:[...doc.junctions,{id:'_connector',x:target.x,y:target.y}]};
      const prefix=route(local,{from:port.id,to:'_connector:p',via:[],shape:'auto'},{rotatedMeters:true,region});
      if(!prefix.length)return null;
      return compact([...rounded([...prefix,...rest.slice(0,1)],12),...rest.slice(1)]);
    }
    if(fixA){result=tail(result,a,ca);if(!result)return null;}if(fixB){result=tail([...result].reverse(),b,cb);if(!result)return null;result.reverse();}
    result[0]={x:a.x,y:a.y};result[result.length-1]={x:b.x,y:b.y};
    // Straightening an overlong repaired tail could put it back through the shell.
    return length(result)<=budget+1e-7?result:null;
  }
  function route(doc, wire, options={}) {
    const ends = M.endpoints(doc), a = ends.get(wire.from), b = ends.get(wire.to); if (!a || !b) return [];
    if (wire.shape && wire.shape !== "auto") { const points = compact([clean(a), ...wire.via, clean(b)]); return wire.shape === "smooth" ? smooth(points) : points; }
    const lead=options.rotatedMeters?32:20;
    const start = { x: a.x + a.dx * lead, y: a.y + a.dy * lead }, end = { x: b.x + b.dx * lead, y: b.y + b.dy * lead };
    if(options.region&&[start,end].some(p=>p.x<options.region.left||p.x>options.region.right||p.y<options.region.top||p.y>options.region.bottom))return [];
    if (wire.via.length) return orthogonal([a, start, ...wire.via, end, b]);
    const bounds = { left: Math.min(start.x,end.x)-160, right: Math.max(start.x,end.x)+160, top: Math.min(start.y,end.y)-160, bottom: Math.max(start.y,end.y)+160 };
    const modernMeter=c=>doc.version>=4&&R.dualMeter(c);
    const obstacles = options.rotatedMeters?doc.components.map(R.bodyBounds).filter(o=>o.right>bounds.left&&o.left<bounds.right&&o.bottom>bounds.top&&o.top<bounds.bottom):doc.components.filter(c => modernMeter(c)?c.x+90>bounds.left&&c.x-90<bounds.right&&c.y+100>bounds.top&&c.y-100<bounds.bottom:c.x+60>bounds.left&&c.x-60<bounds.right&&c.y+80>bounds.top&&c.y-60<bounds.bottom).map((c) => modernMeter(c)?({left:c.x-78,right:c.x+78,top:c.y-86,bottom:c.y+78}):({ left: c.x - 52, right: c.x + 52, top: c.y - 52, bottom: c.y + 65 }));
    const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((o) => [o.left - 8, o.right + 8]),...(options.region?[options.region.left,options.region.right]:[])])].filter(x=>!options.region||x>=options.region.left&&x<=options.region.right).sort((x, y) => x - y);
    const ys = [...new Set([start.y, end.y, start.y - 40, end.y + 40, ...obstacles.flatMap((o) => [o.top - 8, o.bottom + 8]),...(options.region?[options.region.top,options.region.bottom]:[])])].filter(y=>!options.region||y>=options.region.top&&y<=options.region.bottom).sort((x, y) => x - y);
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
      for (const [nx, ny] of [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]]) { if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue; const q = { x: xs[nx], y: ys[ny] }; if (blocked(p, q)) continue; const nk = key(nx, ny); if(options.rotatedMeters&&(k===first&&(q.x-p.x)*a.dx+(q.y-p.y)*a.dy<-1e-7||nk===target&&(p.x-q.x)*b.dx+(p.y-q.y)*b.dy<-1e-7))continue; const nc = cost + Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + .01; if (nc < (distance.get(nk) ?? Infinity)) { distance.set(nk, nc); previous.set(nk, k); push({ k: nk, cost: nc, priority: nc + Math.abs(q.x-end.x)+Math.abs(q.y-end.y) }); } }
    }
    let path = [];
    if (found) { let k = target; while (k) { const [x, y] = k.split(",").map(Number); path.unshift({ x: xs[x], y: ys[y] }); k = previous.get(k); } }
    else if(options.rotatedMeters)return [];
    else path = orthogonal([start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end]);
    const all = compact([a, ...path, b]); return all.filter((p, i, a) => !i || i === a.length - 1 || !((a[i - 1].x === p.x && p.x === a[i + 1].x) || (a[i - 1].y === p.y && p.y === a[i + 1].y)) || options.rotatedMeters&&(p.x-a[i-1].x)*(a[i+1].x-p.x)+(p.y-a[i-1].y)*(a[i+1].y-p.y)<0);
  }
  function path(points) { return points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "); }
  function nearest(points, p) {
    let best = null; for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); const q = { x: a.x + t * dx, y: a.y + t * dy, segment: i }; q.distance = Math.hypot(p.x - q.x, p.y - q.y); if (!best || q.distance < best.distance) best = q; } return best;
  }
  function along(points, distance) { for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y); if (distance <= length && length) return { x: a.x + (b.x - a.x) * distance / length, y: a.y + (b.y - a.y) * distance / length, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI }; distance -= length; } return points[points.length - 1]; }
  return { route, path, nearest, along, orthogonal, simplify, finishStroke, smooth, resample, reshape, fair, bend, length, fitLength, deform, rounded, followEndpoints };
});
