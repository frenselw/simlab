(function(root,factory){const api=factory(typeof module==="object"&&module.exports?require("./model.js"):root.ReactionModel,typeof module==="object"&&module.exports?require("./notation.js"):root.ReactionNotation);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ReactionScene=api;})(typeof window!=="undefined"?window:globalThis,function(M,N){
  "use strict";
  const e=N.escape;
  function arrowPath(start,end,shaft=3,head=11){const dx=end.x-start.x,dy=end.y-start.y,L=Math.hypot(dx,dy);if(L<.05)return "";const ux=dx/L,uy=dy/L,nx=-uy,ny=ux,h=Math.min(head,L*.46),w=Math.min(head*.44,L*.27),s=Math.min(shaft/2,w*.5);const at=(d,o)=>`${start.x+ux*d+nx*o},${start.y+uy*d+ny*o}`;return `M${at(0,s)} L${at(L-h,s)} L${at(L-h,w)} L${at(L,0)} L${at(L-h,-w)} L${at(L-h,-s)} L${at(0,-s)} Z`;}
  function svg(q,l,answers,selected,working=null,reference=false){
    const pix=p=>M.pixel(p,l), path=pts=>pts.map(p=>{const v=pix(p);return `${v.x},${v.y}`;}).join(" "), font=l.width>=600&&l.height>=350?24:14;
    const text=(p,s,cls="",attrs="")=>`<text x="${p.x}" y="${p.y}" class="${cls}" ${attrs}>${e(s)}</text>`;
    const circle=(p,r,fill,stroke="#64748b")=>{const v=pix(p);return `<circle cx="${v.x}" cy="${v.y}" r="${r*l.unit}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;};
    const line=(a,b,cls="scene-line")=>{a=pix(a);b=pix(b);return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" class="${cls}"/>`;};
    const box=(b,w,h,fill)=>{const c=pix(b.center);return `<rect x="${c.x-w*l.unit/2}" y="${c.y-h*l.unit/2}" width="${w*l.unit}" height="${h*l.unit}" rx="4" fill="${fill}" stroke="#6b829b" stroke-width="1.6"/><path d="M${c.x-w*l.unit/2+5} ${c.y-h*l.unit/2+5}h${Math.max(0,w*l.unit-10)}" stroke="white" stroke-width="2"/>`;};
    const parts=[`<defs><pattern id="surface" width="22" height="18" patternUnits="userSpaceOnUse"><path d="M2 16l7-9" stroke="#c9c5ba" stroke-width="1.2"/></pattern><clipPath id="scene-clip"><rect x="32" y="27" width="${l.width-64}" height="${l.height-52}"/></clipPath></defs><rect width="${l.width}" height="${l.height}" fill="white"/>`];
    if(q.family===0){const [a,b]=q.geometry.plane.map(pix);parts.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}L${b.x} ${l.height}L${a.x} ${l.height}Z" fill="#f3f0e8"/><path d="M${a.x} ${a.y}L${b.x} ${b.y}L${b.x} ${l.height}L${a.x} ${l.height}Z" fill="url(#surface)"/><path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#8f8c83" stroke-width="2"/><polygon points="${path(q.geometry.corners)}" fill="#dceafe" stroke="#547499" stroke-width="1.6"/>`);}
    if(q.family===1||q.family===2){const floor=pix({x:0,y:q.geometry.groundY}).y;parts.push(`<path d="M0 ${floor}H${l.width}V${l.height}H0Z" fill="#f3f0e8"/><rect x="0" y="${floor}" width="${l.width}" height="16" fill="url(#surface)"/><path d="M0 ${floor}H${l.width}" stroke="#8f8c83" stroke-width="2"/>`);}
    if(q.family===1){parts.push(box(q.bodies[1],1.2,1,"#ebe6dc"),box(q.bodies[0],1.2,1,"#dceafe"));const [a,b]=q.geometry.drive.map(pix);parts.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#97a2af" stroke-width="6"/>`);parts.push(text({x:a.x,y:a.y-12},"推動器","scene-note",'text-anchor="middle"'));}
    if(q.family===2){parts.push(circle({x:q.bodies[0].center.x-.36,y:-.32},.08,"#7f8d9a"),circle({x:q.bodies[0].center.x+.36,y:-.32},.08,"#7f8d9a"),box(q.bodies[0],1.2,.8,"#dceafe"),box(q.bodies[3],.18,1.5,"#ccc7bd"));const [a,b]=q.geometry.spring.map(pix),dx=b.x-a.x;let d=`M${a.x} ${a.y}L${a.x+dx*.1} ${a.y}`;for(let i=0;i<=20;i++)d+=`L${a.x+dx*(.1+.8*i/20)} ${a.y+(i===0||i===20?0:(i%2?-1:1)*Math.min(6,l.unit*.14))}`;d+=`L${b.x} ${b.y}`;parts.push(`<path d="${d}" fill="none" stroke="#667a91" stroke-width="2"/>`);}
    if(q.family===3){if(q.geometry.moving){const arc=[];for(let a=-60;a<=60;a+=4){const r=(a-90)*Math.PI/180;arc.push({x:q.geometry.pivot.x+1.8*Math.cos(r),y:q.geometry.pivot.y+1.8*Math.sin(r)});}parts.push(`<polyline points="${path(arc)}" fill="none" stroke="#d1dae6" stroke-dasharray="3 5"/>`);}parts.push(box(q.bodies[2],1.2,.2,"#c8c4ba"),line({x:0,y:1.42},q.geometry.pivot),line(...q.geometry.rope),circle(q.bodies[0].center,.27,"#c8ddeb"));}
    if(q.family===4){const c=pix(q.geometry.earth),r=q.geometry.earthRadius*l.unit;parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="#dcebf5" stroke="#6f91ad" stroke-width="2"/><path d="M${c.x-r*.6} ${c.y-r*.4}q${r*.3} ${-r*.45} ${r*.7} ${-.1*r}l${-.2*r} ${r*.4}l${-.35*r} ${r*.1}Z M${c.x+r*.1} ${c.y+r*.1}l${r*.55} ${-.05*r}l${-.15*r} ${r*.5}l${-.25*r} ${r*.15}Z" fill="#b3cdbd"/><path d="M${c.x-r} ${c.y}h${r*2}" stroke="#94b0c7" stroke-dasharray="2 4"/>`,line(...q.geometry.axis,"axis-line"),circle(q.bodies[0].center,.22,"#ddd1be"));}
    const occupied=[];
    const bodyOffsets = q.family===0 ? [[0,.83],[0,0]] : q.family===1 ? [[0,.7],[0,.7],[0,0]] : q.family===2 ? [[0,.7],[0,.38],[0,0],[0,.65]] : q.family===3 ? [[.58,-.1],[.5,0],[1,0]] : [[.55,0],[0,-.58]];
    const bodyNames = q.family===1 ? ["B","A","地面"] : q.family===3 ? ["小球","繩","固定架"] : q.bodies.map(b=>b.name);
    q.bodies.forEach((b,i)=>{const offset=bodyOffsets[i],p=pix({x:b.center.x+offset[0],y:b.center.y+offset[1]}),name=bodyNames[i],w=[...name].length*14;
      const x=M.clamp(p.x,35+w/2,l.width-35-w/2),y=M.clamp(p.y,44,l.height-35);parts.push(text({x,y},name,"body-label",'text-anchor="middle"'));occupied.push({x:x-w/2,y:y-14,width:w,height:18});
    });
    function label(end,label,symbol,kind,ordinal,force,cls,offset=0){
      const val=` = ${N.value(force/100)} N`,sym=symbol==="Fs"?"F":symbol,sub=symbol==="Fs"?"s":"",prefix=ordinal?"′":"",width=(sym.length+prefix.length+val.length+(sub?1:0))*font*.53+10,height=font+8;
      const options=[[8,-12],[8,font+9],[-width-8,-12],[-width-8,font+9],[-width/2,-25],[-width/2,font+26]];
      let best=null;for(const [dx,dy] of options){const x=M.clamp(end.x+dx,35,l.width-width-35),y=M.clamp(end.y+dy,46,l.height-33),rect={x,y:y-font,width,height};let cost=0;for(const r of occupied){const overlap=Math.max(0,Math.min(rect.x+width,r.x+r.width)-Math.max(rect.x,r.x))*Math.max(0,Math.min(rect.y+height,r.y+r.height)-Math.max(rect.y,r.y));cost+=overlap;}cost+=Math.hypot(x-(end.x+dx),y-(end.y+dy))*20;if(!best||cost<best.cost)best={x,y,rect,cost};}
      occupied.push(best.rect);parts.push(`<text x="${best.x}" y="${best.y}" class="force-label ${cls}" font-size="${font}" aria-label="${e(label)}"><tspan class="math">${e(sym)}</tspan>${sub?`<tspan baseline-shift="sub" font-size=".7em">${sub}</tspan>`:""}<tspan>${prefix}${e(val)}</tspan></text>`);
    }
    const selectedForce=q.given.find(f=>f.id===q.targets[selected]);
    parts.push(`<g clip-path="url(#scene-clip)">`);
    for(const f of q.given){const start=pix(f.origin),a=f.angle10*Math.PI/1800,length=f.force100/100*l.forceScale*l.unit,end={x:start.x+Math.cos(a)*length,y:start.y-Math.sin(a)*length};parts.push(`<path data-given="${f.id}" data-force="${f.force100}" data-length="${length}" d="${arrowPath(start,end,l.width>=600?4:3,l.width>=600?15:11)}" class="given-arrow ${f.id===selectedForce?.id?"active":""}"/>`);}
    const visible=reference?q.expected:answers;
    visible.forEach((original,i)=>{const r=working&&i===selected?working:original;if(r[3]===null)return;const start=pix(M.origin(r,q)),end=M.endpoint(r,q,l);parts.push(`<path data-reaction="${i}" data-force="${r[4]}" d="${arrowPath(start,end,l.width>=600?5:3.6,l.width>=600?17:12)}" class="reaction-arrow ${i===selected?"active":""}"/>`);});parts.push("</g>");
    for(const f of q.given){const start=pix(f.origin),a=f.angle10*Math.PI/1800,length=f.force100/100*l.forceScale*l.unit,end={x:start.x+Math.cos(a)*length,y:start.y-Math.sin(a)*length};label(end,f.name,f.symbol,f.kind,0,f.force100,"given-label");}
    visible.forEach((original,i)=>{const r=working&&i===selected?working:original;if(r[3]===null)return;const end=M.endpoint(r,q,l),h=M.handle(end,l);label(h,`畫在${q.bodies[r[0]].name}的${r[2]===null?"未標種類的力":N.shortNames[r[2]]}`,N.reactionSymbol(r[2],q.given.find(f=>f.id===q.targets[i])),r[2],i+1,r[4],"reaction-label");if(h.offscale)parts.push(text({x:h.x,y:h.y-10},"超框","offscale-note",'text-anchor="middle"'));});
    // Only the learner's selected body supplies draggable public anchors.
    const current=working||visible[selected];
    if(current?.[0]!==null&&current){for(const a of q.bodies[current[0]].anchors){const p=pix(a.point);parts.push(`<circle data-anchor-dot="${a.id}" cx="${p.x}" cy="${p.y}" r="${a.id===current[1]?4.5:3}" fill="${a.id===current[1]?"#a03a70":"#475569"}" stroke="white" stroke-width="1.5"/>`);}}
    const max=Math.max(...q.given.map(f=>f.force100))/100,unit=[1,2,5,10,20].filter(x=>x<=max/2).pop()||1,len=unit*l.unit*l.forceScale,x=39,y=l.height-14;
    parts.push(`<path d="M${x} ${y-4}v8m0-4h${len}m0-4v8" stroke="#64748b" fill="none"/>`,text({x:x+len+6,y:y+5},`${unit} N`,"ruler-label"));
    if(working&&working[3]!==null){const p=M.handle(M.endpoint(working,q,l),l);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="5" fill="none" stroke="#a03a70" stroke-width="1.5"/>`);}
    return parts.join("");
  }
  return Object.freeze({svg,arrowPath});
});
