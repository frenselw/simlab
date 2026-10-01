(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassHitGeometry = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function hull(points) {
    const sorted = [...points].sort((a,b) => a.x-b.x || a.y-b.y);
    const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const half = items => { const out=[]; for(const p of items) { while(out.length>1 && cross(out.at(-2),out.at(-1),p)<=0) out.pop(); out.push(p); } return out; };
    const lower=half(sorted),upper=half([...sorted].reverse()); lower.pop();upper.pop();return [...lower,...upper];
  }
  // The renderer provides the solid silhouette, never a candidate-point box.
  function clip(outline, width, height, margin = 8) {
    if (!outline || width<=0 || height<=0) return "polygon(0 0,0 0,0 0)";
    if(outline.kind === "ellipse") {
      return `ellipse(${(outline.rx/700+margin/width)*100}% ${(outline.ry/460+margin/height)*100}% at ${outline.cx/7}% ${outline.cy/4.6}%)`;
    }
    const points=[];
    for(const p of outline.points) for(let i=0;i<16;i++) { const angle=i*Math.PI/8;points.push({x:p.x+Math.cos(angle)*margin*700/width,y:p.y+Math.sin(angle)*margin*460/height}); }
    return `polygon(${hull(points).map(p=>`${p.x/7}% ${p.y/4.6}%`).join(",")})`;
  }
  return { hull, clip };
});
