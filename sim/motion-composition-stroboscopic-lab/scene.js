(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.MotionCompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotionCompositionScene = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const COLORS = ["#2563eb", "#b45309"], ANSWER = "#6d28d9", font = 'font-family="STIX Two Math, Cambria Math, Latin Modern Math, Times New Roman, serif"';
  const point = (p, l) => M.pixel(p, l);
  const circle = (p, r, color, extra = "") => `<circle cx="${p.x}" cy="${p.y}" r="${r}" ${extra.includes('fill=')?'':'fill="white"'} stroke="${color}" ${extra.includes('stroke-width=')?'':'stroke-width="1.6"'} ${extra}/>`;
  function svg(state, index, time, l, options = {}) {
    const c = state.cases[index], origin = point([0,0],l), selected = time - 1, prefix = options.prefix || "scene";
    let out = `<defs><clipPath id="${prefix}-plot"><rect x="${l.left}" y="${l.top}" width="${l.size}" height="${l.size}"/></clipPath></defs>`;
    for (let value = -400; value <= 3600; value += 200) {
      const x = point([value,0],l).x, y = point([0,-value],l).y;
      out += `<path d="M${x} ${l.top}v${l.size}" stroke="${value%800===0?'#d1d5db':'#e5e7eb'}" stroke-width=".7"/>`;
      if (value <= 3600) out += `<path d="M${l.left} ${y}h${l.size}" stroke="#e5e7eb" stroke-width=".7"/>`;
    }
    out += `<path d="M${l.left} ${origin.y}h${l.size}M${origin.x} ${l.top+l.size}V${l.top}" fill="none" stroke="#4b5563" stroke-width="1.4"/><path d="M${l.left+l.size-6} ${origin.y-3}l6 3-6 3M${origin.x-3} ${l.top+6}l3-6 3 6" fill="none" stroke="#4b5563" stroke-width="1.4"/>`;
    out += `<g ${font} font-size="14" fill="#374151"><text x="${origin.x-17}" y="${origin.y-5}">O</text><text x="${l.left+l.size+10}" y="${origin.y+4}" font-style="italic">x</text><text x="${origin.x+8}" y="${l.top+9}" font-style="italic">y</text><text x="${l.left+l.size+14}" y="${l.top+l.size+18}" font-family="sans-serif">m</text>`;
    for (let v = 800; v <= 3200; v += 800) {
      if (l.size < 145 && v !== 3200) continue;
      const xp = point([v,0],l), yp = point([0,-v],l);
      out += `<text x="${xp.x}" y="${l.top+l.size+17}" text-anchor="middle" font-family="sans-serif">${v/1000}</text><text x="${l.left-5}" y="${yp.y+4}" text-anchor="end" font-family="sans-serif">−${v/1000}</text>`;
    }
    out += `</g>${circle(origin,3,'#4b5563')}`;
    if (c.observed || options.reference) for (const [i,p] of M.expected(index).entries()) {
      for (const axis of [0,1]) {
        const projected = point(axis===0?[p[0],0]:[0,p[1]],l);
        out += circle(projected,i===selected?5:3,COLORS[axis],i===selected?'stroke-width="2.2"':'');
      }
    }
    if (options.animation != null) { const p = M.position(index,options.animation); out += circle(point([p[0],0],l),5,COLORS[0],'fill="#2563eb"')+circle(point([0,p[1]],l),5,COLORS[1],'fill="#b45309"'); }
    const answer = options.reference ? M.expected(index) : c.points.map((p,i)=>i===selected&&options.working?options.working:p);
    out += `<g clip-path="url(#${prefix}-plot)">`;
    if (options.reference) {
      const curve=Array.from({length:81},(_,i)=>point(M.position(index,i*.01),l));
      out += `<path d="${curve.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')}" fill="none" stroke="#166534" stroke-width="1.6"/>`;
      if(options.animation!=null)out+=circle(point(M.position(index,options.animation),l),5,'#166534');
    } else {
      const all=[[0,0],...answer];for(let i=1;i<all.length;i++)if(all[i]&&all[i-1]){const a=point(all[i-1],l),b=point(all[i],l);out+=`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="${ANSWER}" opacity=".4" stroke-width="1.5"/>`;}
    }
    answer.forEach((p,i)=>{if(p){
      const q=point(p,l);out+=circle(q,i===selected?5:3.5,options.reference?'#166534':ANSWER);
      if(i===selected){
        const flip=q.x+25>l.left+l.size,nearAxisName=Math.abs(q.x-origin.x)<36&&q.y<l.top+36,below=q.y-20<l.top||nearAxisName;
        const labelY=below?Math.min(Math.max(q.y+18,nearAxisName?l.top+32:0),l.top+l.size-8):q.y-7;
        out+=`<text x="${q.x+(flip?-7:7)}" y="${labelY}" text-anchor="${flip?'end':'start'}" ${font} font-size="14" fill="${ANSWER}">P<tspan baseline-shift="sub" font-size="11">${i+1}</tspan></text>`;
      }
    }});
    out += '</g>';
    if (options.tray) out += circle(l.tray,7,ANSWER,`fill="${ANSWER}"`);
    return out;
  }
  return Object.freeze({ svg });
});
