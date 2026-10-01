(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.MotionCompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotionCompositionScene = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const COLORS = ["#2563eb", "#b45309"], ANSWER = "#6d28d9", font = 'font-family="STIX Two Math, Cambria Math, Latin Modern Math, Times New Roman, serif"';
  const point = (p, l) => M.pixel(p, l);
  const circle = (p, r, color, extra = "") => `<circle cx="${p.x}" cy="${p.y}" r="${r}" ${extra.includes('fill=')?'':'fill="white"'} stroke="${color}" ${extra.includes('stroke-width=')?'':'stroke-width="1.6"'} ${extra}/>`;
  const palettes = [ ['x','#dbeafe','#60a5fa','#2563eb','#1e3a8a'], ['y','#fef3c7','#fbbf24','#b45309','#78350f'], ['answer','#ede9fe','#a78bfa','#6d28d9','#2e1065'], ['reference','#dcfce7','#4ade80','#166534','#052e16'], ['origin','#f3f4f6','#9ca3af','#4b5563','#111827'] ];
  const gradients = prefix => palettes.map(([key,light,mid,color,dark])=>`<radialGradient id="${prefix}-${key}-ball" cx="30%" cy="25%" r="75%"><stop offset="0" stop-color="white"/><stop offset=".15" stop-color="${light}"/><stop offset=".4" stop-color="${mid}"/><stop offset=".7" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`).join('');
  const ball = (p,r,color,key,prefix,extra='') => circle(p,r,color,`fill="url(#${prefix}-${key}-ball)" data-ball="${key}" ${extra}`);
  const box = (x,y,w,h) => ({left:x,top:y,right:x+w,bottom:y+h});
  const intersects = (a,b) => a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  function crosses(rect,a,b) {
    let low=0,high=1;
    for(const [start,end,min,max] of [[a.x,b.x,rect.left,rect.right],[a.y,b.y,rect.top,rect.bottom]]){
      const delta=end-start;if(!delta){if(start<min||start>max)return false;continue;}
      const t1=(min-start)/delta,t2=(max-start)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));if(low>high)return false;
    }
    return true;
  }
  function labelPosition(q,l,obstacles,segments) {
    const scale=l.presentation?22/14:1;
    const allowed=p=>{const r=box(p.x-1,p.y-14*scale,20*scale,24*scale);return r.left>=2&&r.right<=l.width-2&&r.top>=2&&r.bottom<=l.height-2&&!obstacles.some(b=>intersects(r,b))&&!segments.some(([a,b])=>crosses(r,a,b));};
    const candidates=[];
    for(const dx of [8,16,24,32,40,48,64,80,-26,-34,-42,-50,-58,-66,-82,-98,-9])for(const dy of [-10,-18,-26,-34,-42,-50,-66,24,32,40,48,56,72,5])candidates.push({x:q.x+dx*scale,y:q.y+dy*scale});
    const distance=p=>Math.hypot(p.x+7*scale-q.x,p.y-3*scale-q.y);
    candidates.sort((a,b)=>distance(a)-distance(b));const nearby=candidates.find(allowed);if(nearby)return nearby;
    // Dense or deliberately wrong answers can fill all nearby candidates.
    // Search the stage margins as well; the label itself is outside the clip.
    let best=null;for(let y=16*scale;y<=l.height-12*scale;y+=4)for(let x=3;x<=l.width-22*scale;x+=4){const p={x,y};if((!best||distance(p)<distance(best))&&allowed(p))best=p;}
    return best||{x:122,y:18};
  }
  function svg(state, index, time, l, options = {}) {
    const c = state.cases[index], origin = point([0,0],l), selected = time - 1, prefix = options.prefix || "scene";
    const obstacles=[],segments=[],large=l.presentation, textSize=large?22:14, scale=textSize/14;
    const sphere=(p,r,color,key,extra='')=>{r*=large?2.5:1;const pad=r+1.2;obstacles.push(box(p.x-pad,p.y-pad,2*pad,2*pad));return ball(p,r,color,key,prefix,extra);};
    let out = `<defs>${gradients(prefix)}<clipPath id="${prefix}-plot"><rect x="${l.left}" y="${l.top}" width="${l.size}" height="${l.size}"/></clipPath></defs>`;
    for (let value = -400; value <= 3600; value += 200) {
      const x = point([value,0],l).x, y = point([0,-value],l).y;
      out += `<path d="M${x} ${l.top}v${l.size}" stroke="${value%800===0?'#d1d5db':'#e5e7eb'}" stroke-width=".7"/>`;
      if (value <= 3600) out += `<path d="M${l.left} ${y}h${l.size}" stroke="#e5e7eb" stroke-width=".7"/>`;
    }
    const arrow=large?9:6, halfArrow=arrow/2, axisWidth=large?2:1.4;
    out += `<path d="M${l.left} ${origin.y}h${l.size}M${origin.x} ${l.top+l.size}V${l.top}" fill="none" stroke="#4b5563" stroke-width="${axisWidth}"/><path d="M${l.left+l.size-arrow} ${origin.y-halfArrow}l${arrow} ${halfArrow}-${arrow} ${halfArrow}M${origin.x-halfArrow} ${l.top+arrow}l${halfArrow}-${arrow} ${halfArrow} ${arrow}" fill="none" stroke="#4b5563" stroke-width="${axisWidth}"/>`;
    const originLabelX = l.compact ? l.left - 20 : origin.x - (large?34:22), originLabelY=origin.y+(l.compact?25:large?-10:-5);
    const yLabelX = l.compact ? l.left - 20 : l.size < 300 ? l.left - (large?40:26) : origin.x + (large?14:8);
    const xLabelX=l.left+l.size+(large?14:10), xLabelY=origin.y+(large?7:4), yLabelY=l.top+(large?15:9), numberY=l.top+l.size+(large?28:17);
    for(const [x,y] of [[originLabelX,originLabelY],[xLabelX,xLabelY],[yLabelX,yLabelY]])obstacles.push(box(x-2,y-16*scale,17*scale,23*scale));
    out += `<g ${font} font-size="${textSize}" fill="#374151"><text data-axis-name="O" x="${originLabelX}" y="${originLabelY}">O</text><text data-axis-name="x" x="${xLabelX}" y="${xLabelY}" font-style="italic">x</text><text data-axis-name="y" x="${yLabelX}" y="${yLabelY}" font-style="italic">y</text>${l.compact?'':`<text x="${l.left+l.size+(large?8:4)}" y="${numberY+1}" font-family="sans-serif">m</text>`}`;
    for (let v = 800; v <= 3200; v += 800) {
      if (l.compact) continue;
      if (l.size < 145 && v !== 3200) continue;
      const xp = point([v,0],l), yp = point([0,-v],l);
      obstacles.push(box(xp.x-14*scale,l.top+l.size+1,28*scale,23*scale),box(l.left-40*scale,yp.y-12*scale,37*scale,23*scale));
      out += `<text x="${xp.x}" y="${numberY}" text-anchor="middle" font-family="sans-serif">${v/1000}</text><text x="${l.left-(large?10:5)}" y="${yp.y+(large?7:4)}" text-anchor="end" font-family="sans-serif">−${v/1000}</text>`;
    }
    if(!l.compact){obstacles.push(box(l.left+l.size+2,l.top+l.size+2,18*scale,23*scale),box(26,1,l.width-52,large?47:27),box(26,l.height-(large?36:28),l.width-52,large?35:27));}
    if(state.phase==='edit'&&c.observed&&!options.reference)for(const tray of l.trays)obstacles.push(box(tray.x-(large?33:23),tray.y-(large?34:24),large?66:46,large?68:48));
    segments.push([{x:l.left,y:origin.y},{x:l.left+l.size,y:origin.y}],[{x:origin.x,y:l.top},{x:origin.x,y:l.top+l.size}]);
    out += `</g>${sphere(origin,c.observed||options.reference?3:7,'#4b5563','origin')}`;
    if(options.guides&&options.animation!=null&&!options.reference&&c.points.every(p=>p!==null)){
      const p=M.position(index,options.animation),x=point([p[0],0],l),y=point([0,p[1]],l),intersection=point(p,l);
      out+=`<g data-composition-guides clip-path="url(#${prefix}-plot)" fill="none" stroke-width="${large?2:1.5}" stroke-dasharray="${large?'8 6':'6 4'}"><line data-guide-axis="x" x1="${x.x}" y1="${x.y}" x2="${intersection.x}" y2="${intersection.y}" stroke="${COLORS[0]}"/><line data-guide-axis="y" x1="${y.x}" y1="${y.y}" x2="${intersection.x}" y2="${intersection.y}" stroke="${COLORS[1]}"/></g>`;
    }
    const stamps = options.stamps ?? (c.observed || options.reference ? 4 : 0);
    for (const [i,p] of M.expected(index).slice(0,stamps).entries()) {
      for (const axis of [0,1]) {
        const projected = point(axis===0?[p[0],0]:[0,p[1]],l);
        out += sphere(projected,i===selected?5:4,COLORS[axis],axis?'y':'x',`data-stamp="${i+1}" data-axis="${axis}" ${i===selected?'stroke-width="2.2" data-selected="true"':'opacity=".7"'}`);
      }
    }
    if (options.animation != null) { const p = M.position(index,options.animation); out += sphere(point([p[0],0],l),8,COLORS[0],'x','data-live-ball="x"')+sphere(point([0,p[1]],l),8,COLORS[1],'y','data-live-ball="y"'); }
    const answer = options.reference ? M.expected(index) : c.points.map((p,i)=>i===selected&&options.working?options.working:p);
    out += `<g clip-path="url(#${prefix}-plot)">`;
    if (options.reference) {
      const curve=Array.from({length:81},(_,i)=>point(M.position(index,i*.01),l));
      for(let i=1;i<curve.length;i++)segments.push([curve[i-1],curve[i]]);
      out += `<path d="${curve.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')}" fill="none" stroke="#166534" stroke-width="1.6"/>`;
      if(options.animation!=null)out+=sphere(point(M.position(index,options.animation),l),8,'#166534','reference','data-live-ball="resultant"');
    }
    answer.forEach((p,i)=>{if(p){
      const q=point(p,l);out+=sphere(q,i===selected?6:4.5,options.reference?'#166534':ANSWER,options.reference?'reference':'answer',`data-point-slot="${i+1}"${i===selected?' data-selected="true" stroke-width="2.2"':''}`);
    }});
    out += '</g>';
    if(answer[selected]){
      const q=point(answer[selected],l),p=l.compact?{x:l.left+l.size+10,y:Math.min(l.top+l.size-10.5,Math.max(origin.y+25.5,q.y+4))}:labelPosition(q,l,obstacles,segments);
      const narrow=l.compact&&l.width-p.x<50,x=narrow?l.width-4:p.x;
      const index=`<tspan baseline-shift="sub" font-size="${large?16:11}">${time}</tspan>`;
      const text=narrow?`<tspan font-family="sans-serif">所選</tspan><tspan x="${x}" dy="18"> P${index}</tspan>`:`${l.compact?'<tspan font-family="sans-serif">所選 </tspan>':''}P${index}`;
      out+=`<text data-point-label="${time}" x="${x}" y="${p.y}" text-anchor="${narrow?'end':'start'}" ${font} font-size="${textSize}" fill="${options.reference?'#166534':ANSWER}">${text}</text>`;
    }
    return out;
  }
  return Object.freeze({ svg });
});
