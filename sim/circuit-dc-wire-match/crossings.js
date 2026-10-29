(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('../circuit-workbench/circuit-routing'):root.CircuitRouting);if(node)module.exports=api;else root.CircuitWireCrossings=api;})(globalThis,function(G){
'use strict';

const EPS=1e-6,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),cross=(a,b)=>a.x*b.y-a.y*b.x,sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
function intersection(a,b,c,d){if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-EPS||Math.max(c.x,d.x)<Math.min(a.x,b.x)-EPS||Math.max(a.y,b.y)<Math.min(c.y,d.y)-EPS||Math.max(c.y,d.y)<Math.min(a.y,b.y)-EPS)return null;const r=sub(b,a),s=sub(d,c),den=cross(r,s),ca=sub(c,a);if(dist(a,b)<EPS||dist(c,d)<EPS)return null;if(Math.abs(den)>EPS){const t=cross(ca,s)/den,u=cross(ca,r)/den;return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{x:a.x+t*r.x,y:a.y+t*r.y}:null;}if(Math.abs(cross(ca,r))>EPS)return null;const rr=r.x*r.x+r.y*r.y,t=(ca.x*r.x+ca.y*r.y)/rr,z=sub(d,a),u=(z.x*r.x+z.y*r.y)/rr,lo=Math.max(0,Math.min(t,u)),hi=Math.min(1,Math.max(t,u));return hi>=lo-EPS?{x:a.x+(lo+hi)/2*r.x,y:a.y+(lo+hi)/2*r.y,overlap:[{x:a.x+lo*r.x,y:a.y+lo*r.y},{x:a.x+hi*r.x,y:a.y+hi*r.y}]}:null;}
function events(doc){const paths=doc.wires.map(w=>G.route(doc,w)),out=[];for(let i=0;i<paths.length;i++)for(let j=i;j<paths.length;j++){const a=paths[i],b=paths[j],wi=doc.wires[i],wj=doc.wires[j],shared=i===j?[]:['from','to'].flatMap(k=>['from','to'].filter(l=>wi[k]===wj[l]).map(()=>a[k==='from'?0:a.length-1]));let found=null;for(let x=0;x<a.length-1&&!found;x++)for(let y=i===j?x+2:0;y<b.length-1;y++){const p=intersection(a[x],a[x+1],b[y],b[y+1]);if(p&&!shared.some(s=>(p.overlap||[p]).every(v=>dist(v,s)<=12+EPS))){found=p;break;}}if(found)out.push({wires:[wi.id,wj.id],point:found});}return out;}
return{events,intersection};

});
