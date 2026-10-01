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
  function svg(state, index, time, l, options = {}) {
    const c = state.cases[index], origin = point([0,0],l), selected = time - 1, prefix = options.prefix || "scene";
    let out = `<defs>${gradients(prefix)}<clipPath id="${prefix}-plot"><rect x="${l.left}" y="${l.top}" width="${l.size}" height="${l.size}"/></clipPath></defs>`;
    for (let value = -400; value <= 3600; value += 200) {
      const x = point([value,0],l).x, y = point([0,-value],l).y;
      out += `<path d="M${x} ${l.top}v${l.size}" stroke="${value%800===0?'#d1d5db':'#e5e7eb'}" stroke-width=".7"/>`;
      if (value <= 3600) out += `<path d="M${l.left} ${y}h${l.size}" stroke="#e5e7eb" stroke-width=".7"/>`;
    }
    out += `<path d="M${l.left} ${origin.y}h${l.size}M${origin.x} ${l.top+l.size}V${l.top}" fill="none" stroke="#4b5563" stroke-width="1.4"/><path d="M${l.left+l.size-6} ${origin.y-3}l6 3-6 3M${origin.x-3} ${l.top+6}l3-6 3 6" fill="none" stroke="#4b5563" stroke-width="1.4"/>`;
    const originLabelX = l.compact ? l.left - 20 : origin.x - 22;
    const yLabelX = l.compact ? l.left - 20 : l.size < 300 ? l.left - 26 : origin.x + 8;
    out += `<g ${font} font-size="14" fill="#374151"><text data-axis-name="O" x="${originLabelX}" y="${origin.y+(l.compact?25:-5)}">O</text><text data-axis-name="x" x="${l.left+l.size+10}" y="${origin.y+4}" font-style="italic">x</text><text data-axis-name="y" x="${yLabelX}" y="${l.top+9}" font-style="italic">y</text>${l.compact?'':`<text x="${l.left+l.size+4}" y="${l.top+l.size+18}" font-family="sans-serif">m</text>`}`;
    for (let v = 800; v <= 3200; v += 800) {
      if (l.compact) continue;
      if (l.size < 145 && v !== 3200) continue;
      const xp = point([v,0],l), yp = point([0,-v],l);
      out += `<text x="${xp.x}" y="${l.top+l.size+17}" text-anchor="middle" font-family="sans-serif">${v/1000}</text><text x="${l.left-5}" y="${yp.y+4}" text-anchor="end" font-family="sans-serif">−${v/1000}</text>`;
    }
    out += `</g>${ball(origin,c.observed||options.reference?3:7,'#4b5563','origin',prefix)}`;
    const stamps = options.stamps ?? (c.observed || options.reference ? 4 : 0);
    for (const [i,p] of M.expected(index).slice(0,stamps).entries()) {
      for (const axis of [0,1]) {
        const projected = point(axis===0?[p[0],0]:[0,p[1]],l);
        out += ball(projected,i===selected?5:4,COLORS[axis],axis?'y':'x',prefix,`data-stamp="${i+1}" data-axis="${axis}" ${i===selected?'stroke-width="2.2" data-selected="true"':'opacity=".7"'}`);
      }
    }
    if (options.animation != null) { const p = M.position(index,options.animation); out += ball(point([p[0],0],l),8,COLORS[0],'x',prefix,'data-live-ball="x"')+ball(point([0,p[1]],l),8,COLORS[1],'y',prefix,'data-live-ball="y"'); }
    const answer = options.reference ? M.expected(index) : c.points.map((p,i)=>i===selected&&options.working?options.working:p);
    out += `<g clip-path="url(#${prefix}-plot)">`;
    if (options.reference) {
      const curve=Array.from({length:81},(_,i)=>point(M.position(index,i*.01),l));
      out += `<path d="${curve.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')}" fill="none" stroke="#166534" stroke-width="1.6"/>`;
      if(options.animation!=null)out+=ball(point(M.position(index,options.animation),l),8,'#166534','reference',prefix,'data-live-ball="resultant"');
    } else {
      const all=[[0,0],...answer];for(let i=1;i<all.length;i++)if(all[i]&&all[i-1]){const a=point(all[i-1],l),b=point(all[i],l);out+=`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="${ANSWER}" opacity=".4" stroke-width="1.5"/>`;}
    }
    answer.forEach((p,i)=>{if(p){
      const q=point(p,l);out+=ball(q,i===selected?6:4.5,options.reference?'#166534':ANSWER,options.reference?'reference':'answer',prefix,`data-point-slot="${i+1}"${i===selected?' data-selected="true"':''}`);
      if(i===selected){
        const flip=q.x+25>l.left+l.size,nearAxisName=Math.abs(q.x-origin.x)<36&&q.y<l.top+36,below=q.y-20<l.top||nearAxisName;
        const labelY=below?Math.min(Math.max(q.y+18,nearAxisName?l.top+32:0),l.top+l.size-8):q.y-7;
        out+=`<text x="${q.x+(flip?-7:7)}" y="${labelY}" text-anchor="${flip?'end':'start'}" ${font} font-size="14" fill="${ANSWER}">P<tspan baseline-shift="sub" font-size="11">${i+1}</tspan></text>`;
      }
    }});
    out += '</g>';
    return out;
  }
  return Object.freeze({ svg });
});
