(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry, node ? require("./circuit-routing.js") : root.CircuitRouting, node ? require("./circuit-label-layout.js") : root.CircuitLabelLayout, node ? require("./circuit-math.js") : root.CircuitMath);
  if (node) module.exports = api; else root.CircuitRenderer = api;
})(globalThis, function (R, Routing, L, Q) {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function format(v,unit=''){return Number.isFinite(v)?Q.quantity(v,unit).text:'—';}
  const quantity=(x,y,v,u='',size=14,attrs='')=>Q.svg(x,y,Q.quantity(v,u),size,attrs);
  function colour(v, max = 6) { if (v === null) return "#64748b"; const t = Math.max(-1, Math.min(1, v / Math.max(max, .1))); return t < 0 ? `hsl(${210 + 10 * -t} 76% ${48 - 12 * -t}%)` : `hsl(${210 - 178 * t} ${35 + 45 * t}% ${48 - 8 * t}%)`; }
  function text(x, y, content, size = 14, attrs = "") { return `<text x="${x}" y="${y}" ${attrs.includes('text-anchor=')?'':'text-anchor="middle"'} ${attrs.includes("font-family=") ? "" : 'font-family="system-ui,sans-serif"'} font-size="${size}" ${attrs.includes("fill=") ? "" : 'fill="#334155"'} ${attrs}>${esc(content)}</text>`; }
  const statusText=r=>r?.meterStatus==='overrange'&&r.reading<0?'負向超量程 · 反接':({'unconnected':'接入 − 與一個正極孔','missing-common':'請接共用 − 孔','dual-positive':'兩個正極孔同時接線','unknown':'讀值未能確定','reverse':'反接','overrange':'超量程'}[r?.meterStatus]||'');
  const dialAngle=fraction=>R.meterScale.zeroAngle+R.meterScale.sweep*fraction;
  const dialPoint=(fraction,radius=70)=>{const angle=dialAngle(fraction)*Math.PI/180;return{x:radius*Math.cos(angle),y:24+radius*Math.sin(angle)};};
  function dualDial(c,result,values=true) {
    const ranges=R.meterRanges(c),unit=R.get(c.type).icon,low=result?.activePort==='c',high=result?.activePort==='a',range=result?.range??ranges.high,v=result?.reading;
    let out='<rect x="-69" y="-65" width="138" height="102" rx="7" fill="#fff" stroke="#b2c2cf"/>';
    out+=quantity(-33,-73,ranges.low,unit,11,`fill="${low?'#245b94':'#64748b'}"`)+quantity(33,-73,ranges.high,unit,11,`fill="${high?'#245b94':'#64748b'}"`);
    const first=dialPoint(R.meterScale.minimumFraction),last=dialPoint(1);out+=`<path d="M${first.x} ${first.y}A70 70 0 0 1 ${last.x} ${last.y}" fill="none" stroke="#a6b5c1" stroke-width=".6"/>`;
    for(let i=-ranges.negativeDivisions;i<=ranges.divisions;i++){const f=i/ranges.divisions,a=dialPoint(f),b=dialPoint(f,i%10===0?61:i%5===0?64:67);out+=`<path data-meter-tick="${i}" data-fraction="${f}" data-angle="${dialAngle(f)}" d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${i<0?'#9b6258':'#475569'}" stroke-width="${i===0?2:i%10===0?1.5:1}"/>`;
      if(i%10===0){for(const [kind,radius,value,active]of [['high',54,ranges.high*f,high],['low',37,ranges.low*f,low]]){const p=dialPoint(f,radius);out+=quantity(p.x,p.y+3,value,'',9,`data-scale="${kind}" data-value="${value}" fill="${active?'#245b94':'#64748b'}"`);}}
    }
    out+=Q.svg(0,10,Q.unit(unit),17);
    if(values&&Number.isFinite(v)){const fraction=Math.max(R.meterScale.minimumFraction-R.meterScale.stopMargin,Math.min(1+R.meterScale.stopMargin,v/range)),p=dialPoint(fraction,59);out+=`<path data-meter-needle="${esc(c.id||'preview')}" data-reading="${v}" data-range="${range}" data-fraction="${fraction}" data-angle="${dialAngle(fraction)}" d="M0 24L${p.x} ${p.y}" stroke="#c33b35" stroke-width="2" stroke-linecap="round"/>`;}
    out+='<circle cx="0" cy="24" r="4" fill="#475569"/>';
    return `<g data-meter-dial="${esc(c.id||'preview')}" data-divisions="${ranges.divisions}" data-negative-divisions="${ranges.negativeDivisions}" data-zero-angle="${R.meterScale.zeroAngle}">${out}</g>`;
  }
  function dualMeter(c,result,display) {
    const symbol=R.get(c.type).icon,ranges=R.meterRanges(c),range=result?.range??ranges.high;
    const value=display.values?Q.quantity(result?.reading,symbol):Q.unit(symbol),valueWidth=Q.measure(value.tex,22).width,valueSize=Math.min(22,120*22/valueWidth);
    let out=display.meters==='analog'?dualDial(c,result,display.values):'<rect x="-66" y="-67" width="132" height="77" rx="6" fill="#dce9df"/>'+Q.svg(0,-28,value,valueSize)+(result?.activePort?text(-26,-4,'量程',12)+quantity(15,-4,range,symbol,12):text(0,-4,'接入 − 與一個正極孔',12));
    out+=text(0,display.meters==='analog'?41:36,statusText(result),10,'fill="#a74730"');
    let shell='<rect x="-78" y="-86" width="156" height="164" rx="12" fill="#e8f0f6" stroke="#446482" stroke-width="2"/>';
    shell+=`<g data-meter-face="${esc(c.id||'preview')}">${out}</g>`;
    R.get(c.type).ports.forEach(p=>{shell+=`<circle data-socket="${p.key}" cx="${p.x}" cy="${p.y}" r="10" fill="${p.key==='b'?'#475569':'#bb6554'}"/><circle cx="${p.x}" cy="${p.y}" r="6" fill="#edbf77" stroke="#916c3e"/>`;});return shell;
  }
  function meter(c, result, display) {
    if(R.dualMeter(c))return dualMeter(c,result,display);
    const symbol = R.get(c.type).icon, v = result?.reading, unit = symbol === "A" ? "A" : symbol === "V" ? "V" : "W";
    const shell = '<rect x="-43" y="-36" width="86" height="78" rx="12" fill="#eef4fa" stroke="#446482" stroke-width="2"/>';
    let out = "";
    if (display.meters === "digital") { out += '<rect x="-35" y="-26" width="70" height="38" rx="5" fill="#dce9df"/>'; out += display.values?quantity(0,-1,v,'',16):Q.svg(0,-1,Q.unit(symbol),16); out += Q.svg(0,30,Q.unit(unit),14); }
    else {
      out += '<path d="M-32 9 A32 32 0 0 1 32 9" fill="#fff" stroke="#94a3b8"/>';
      for (let n = 0; n <= 8; n++) { const a = Math.PI * (1 - n / 8); out += `<path d="M${Math.cos(a) * 28},${9 - Math.sin(a) * 28} L${Math.cos(a) * 32},${9 - Math.sin(a) * 32}" stroke="#64748b"/>`; }
      out += quantity(-28,22,-c.params.range,'',9)+quantity(0,-14,0,'',10)+quantity(28,22,c.params.range,'',9);
      if (display.values && v !== null && v !== undefined) { const a = Math.PI * (.5 - Math.max(-1, Math.min(1, v / c.params.range)) * .5); out += `<path d="M0 9 L${Math.cos(a) * 27},${9 - Math.sin(a) * 27}" stroke="#dc2626" stroke-width="2"/><circle cx="0" cy="9" r="3" fill="#334155"/>`; }
      out += display.values?quantity(0,36,v,unit,12):Q.svg(0,36,Q.unit(symbol),12);
    }
    if (display.values && v !== null && Math.abs(v) > c.params.range) out += text(0, -43, "超量程", 13, 'fill="#b91c1c"');
    return shell + `<g transform="rotate(${-(c.angle || 0)})">${out}</g>`;
  }
  function body(c, result, display) {
    const schematic = display.view === "schematic", p = c.params; if(typeof R.get(c.type).render === "function") return R.get(c.type).render(c,result,display);
    const leads = '<path d="M-60 0H-35 M35 0H60" stroke="#475569" stroke-width="3" fill="none"/>';
    if (["ammeter", "voltmeter", "wattmeter"].includes(c.type)) {
      if(R.dualMeter(c)){
        if(!schematic)return meter(c,result,display);
        return '<path d="M-64 66V39H-20V27 M0 66V34 M64 66V39H20V27" fill="none" stroke="#475569" stroke-width="3" stroke-linejoin="round"/><circle r="34" fill="#fff" stroke="#334155" stroke-width="2"/>'+`<g transform="rotate(${-(c.angle||0)})">${Q.svg(0,6,Q.unit(R.get(c.type).icon),22)}</g>`;
      }
      let lines = c.type === "wattmeter" ? `<path d="${schematic ? "M-60-20H-27 M27-20H60 M-60 40H-24V24 M24 24V40H60" : "M-60-20H-36 M36-20H60 M-60 40H-34 M34 40H60"}" stroke="#475569" stroke-width="3" fill="none" stroke-linejoin="round"/>` : leads;
      if (schematic) return lines + '<circle r="34" fill="#fff" stroke="#334155" stroke-width="2"/>' + `<g transform="rotate(${-(c.angle || 0)})">${Q.svg(0,6,Q.unit(R.get(c.type).icon),22)}</g>`;
      return lines + meter(c, result, display);
    }
    const metal = 'stroke="#667b8e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"';
    const screw = (x, y = 0) => `<circle cx="${x}" cy="${y}" r="5" fill="#e9b86b" stroke="#9b793e" stroke-width="1.5"/><path d="M${x-2.5} ${y}h5" stroke="#846635" stroke-width="1.5"/>`;
    if (c.type === "battery") {
      if (schematic) return `<path data-leads="battery" d="M-60 0H-12 M12 0H60" ${metal}/><path d="M${-12*p.polarity}-26V26 M${12*p.polarity}-13V13" stroke="#334155" stroke-width="3"/>` + text(-25*p.polarity,-30,"+",14) + text(25*p.polarity,-30,"−",14);
      return `<path data-leads="battery" d="M-60 0H-37 M37 0H60" ${metal}/><g transform="scale(${p.polarity} 1)"><rect x="-39" y="-14" width="78" height="28" rx="6" fill="#a9b9c5" stroke="#607487" stroke-width="1.5"/><rect x="-33" y="-21" width="66" height="42" rx="7" fill="#486d83" stroke="#334e62" stroke-width="2"/><path d="M-24-20V20" stroke="#efbc68" stroke-width="14"/><path d="M-15-15H24" stroke="#7995a6" stroke-width="2" stroke-linecap="round"/></g>` + text(8,7,"DC",14,'fill="#fff" font-weight="600"') + text(-47*p.polarity,-15,"+",14) + text(47*p.polarity,-15,"−",14);
    }
    if (c.type === "resistor" || c.type === "rheostat") {
      const variable = c.type === "rheostat", x = variable ? -30 + p.position * 60 : 0;
      if (schematic) return `<path data-leads="resistor" d="M-60 0H-34 M34 0H60" ${metal}/><rect x="-34" y="-13" width="68" height="26" fill="#fff" stroke="#334155" stroke-width="2.5"/>` + (variable ? '<path d="M-23 28L24-28 M12-25L24-28L21-16" stroke="#334155" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' + `<path d="M-30 38H30" stroke="#c2cfda" stroke-width="4"/><circle cx="${x}" cy="38" r="7" fill="#397cab"/>` : "");
      let out = '<rect x="-36" y="-17" width="72" height="34" rx="8" fill="#ece2ca" stroke="#9e9278" stroke-width="2"/><path d="M-27-11H27" stroke="#fff9e8" stroke-width="3" stroke-linecap="round"/>';
      out += `<path data-leads="resistor" d="M-60 0H-32 ${variable ? "" : "M32 0H60"}" ${metal}/><path d="M-32 0L-27-8L-21 8L-15-8L-9 8L-3-8L3 8L9-8L15 8L21-8L27 8L32 0" fill="none" stroke="#9e6c4f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (variable) out += `<path d="M60 0H47V38H-30" ${metal}/><path d="M-30 38H30" stroke="#c0d4e2" stroke-width="7" stroke-linecap="round"/><path d="M${x} 38V-8 M${x-4}-2L${x}-8L${x+4}-2" fill="none" stroke="#397cab" stroke-width="3" stroke-linejoin="round"/><rect x="${x-8}" y="31" width="16" height="14" rx="4" fill="#397cab" stroke="#23577e" stroke-width="1.5"/><path d="M${x-3} 35V41 M${x+3} 35V41" stroke="#b9d9ec"/>`;
      return out;
    }
    if (c.type === "switch") {
      let out = schematic ? "" : '<rect x="-39" y="-18" width="78" height="40" rx="8" fill="#dce9e2" stroke="#8baca0" stroke-width="1.5"/><path d="M-29 14H29" stroke="#bdd0c7" stroke-width="2"/>';
      out += `<path data-leads="switch" d="M-60 0H-25 M25 0H60" ${metal}/><path d="M-25 0L25 ${p.closed ? 0 : -27}" fill="none" stroke="${schematic ? "#334155" : "#9b7952"}" stroke-width="${schematic ? 3 : 5}" stroke-linecap="round"/>`;
      if (!schematic) out += `<path d="M-10 ${p.closed ? 0 : -8.1}L13 ${p.closed ? 0 : -20.5}" stroke="#638b78" stroke-width="9" stroke-linecap="round"/>` + screw(-25) + screw(25);
      else out += '<circle cx="-25" r="3.5" fill="#fff" stroke="#334155" stroke-width="2"/><circle cx="25" r="3.5" fill="#fff" stroke="#334155" stroke-width="2"/>';
      return out;
    }
    if (c.type === "lamp") {
      const rated = p.ratedVoltage ** 2 / p.resistance, glow = Math.max(0, Math.min(1, (result?.power || 0) / rated));
      if (schematic) return `<path data-leads="lamp" d="M-60 0H-28 M28 0H60" ${metal}/><circle r="28" fill="#fff" stroke="#334155" stroke-width="2.5"/><path d="M-19-19L19 19M19-19L-19 19" stroke="#334155" stroke-width="2.5"/>`;
      // The shell contact (left) and insulated bottom contact (right) are separate.
      // Both leads overlap their metal contact; neither ends at the glass envelope.
      let out = `<ellipse cy="-28" rx="37" ry="41" fill="#ffc95c" opacity="${glow*.2}"/>`;
      out += `<path d="M-11-9C-11-18-24-20-24-34C-24-63 24-63 24-34C24-20 11-18 11-9Z" fill="${glow>.04 ? "#ffe4a0" : "#f4f8f9"}" stroke="#9bb2bf" stroke-width="2"/><path d="M-16-37C-16-45-9-48-5-48" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M-7-8V-26L-10-31L-6-35L-2-29L2-35L6-29L10-33L7-26V-8" fill="none" stroke="${glow>.1 ? "#da8225" : "#8c7966"}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      out += '<path d="M-12-9H12V10Q12 13 8 13H-8Q-12 13-12 10Z" fill="#a8b5bf" stroke="#677c8c" stroke-width="1.5"/><path d="M-11-4H11 M-11 2H11 M-10 8H10" stroke="#6f8290" stroke-width="1.5"/><path d="M-6 14H6" stroke="#45586a" stroke-width="4"/><circle cy="18" r="3" fill="#b78b51"/>';
      out += `<path data-leads="lamp" d="M-60 0H-12 M60 0H40V18H0" ${metal}/>` + screw(-46) + screw(46);
      if (p.model === "thermal") out += text(0,-64,"熱效應",10,'fill="#986429"');
      return out;
    }
    return leads;
  }
  function labels(doc,result,scale=1,routes={},viewport=null,options=null){
    if(viewport&&scale<.4)return [];
    const items=[],details=[...(options?.exclusions||[])],nameSize=doc.display.projection?18:14,valueSize=doc.display.projection?16:12;
    doc.components.forEach(c=>{
      const r=result.components[c.id],isMeter=['ammeter','voltmeter','wattmeter'].includes(c.type),lines=[];
      if(doc.display.names!==false)lines.push({kind:'name',text:c.label+(c.locked?' · 固定':''),size:nameSize});
      if(doc.display.values){
        if(isMeter){if(doc.display.view==='schematic'||R.dualMeter(c)&&(doc.display.meters==='analog'||c.angle!==0||scale<.7))lines.push({kind:'value',...Q.quantity(r?.reading,r?.unit),size:valueSize});}
        else{const resistance=c.type==='lamp'&&c.params.model==='thermal'?r?.resistance:r?.resistance??R.effectiveResistance(c),value=c.type==='battery'?Q.join([Q.assignment('E',c.params.voltage,'V'),Q.assignment('r',c.params.resistance,'Ω')]):c.type==='switch'?{text:c.params.closed?'閉合':'斷開'}:Q.join([Q.quantity(resistance,'Ω'),Q.quantity(r?.power,'W')]);lines.push({kind:'value',...value,size:valueSize});}
      }
      if(lines.length)items.push({id:c.id,lines,maxWidth:doc.display.projection?230:180});
      if(options?.selection===c.id){const b=R.bodyBounds(c);details.push({left:b.left-6,right:b.right+6,top:b.top-6,bottom:b.bottom+6});}
      if(isMeter&&(!R.dualMeter(c)||scale>=.7))R.ports(c).forEach(p=>{const x=R.dualMeter(c)?p.x-p.dx*17:p.x,y=R.dualMeter(c)?p.y-p.dy*17:p.y-12/scale,width=(R.dualMeter(c)&&p.key!=='b'?Q.measure(portSpec(c,p).tex,11).width:L.measure(p.label,11))/scale;details.push({left:x-width/2-2/scale,right:x+width/2+2/scale,top:y-13/scale,bottom:y+4/scale});});
      if(doc.display.potential&&Math.abs(r?.voltage||0)>1e-8){const extent=Math.max(22/scale,20);details.push({left:c.x-extent,right:c.x+extent,top:c.y-58-25/scale,bottom:c.y-58+6/scale});}
    });
    const placed=L.layout(doc,items,scale,routes,viewport,details,options?.previous);if(options)options.previous=new Map(placed.map(p=>[p.id,p.slot]));return placed;
  }
  function portSpec(c,p){const ranges=R.meterRanges(c),q=Q.quantity(p.key==='a'?ranges.high:ranges.low,R.get(c.type).icon);return{text:'+'+q.text,tex:'+'+q.tex};}
  function scene(doc, result, scale = 1, routes = {}, selection = null, wireMode = false, viewport = null, labelOptions = null) {
    const max = Math.max(1, ...Object.values(result.potentials).filter((v) => v !== null).map(Math.abs));
    const tiny=viewport&&scale<.4&&doc.components.length>0;
    if(labelOptions)labelOptions.selection=selection;
    const placed=labels(doc,result,scale,routes,viewport,labelOptions);
    let out = '';
    doc.wires.forEach((w) => {
      const points = routes[w.id] || Routing.route(doc, w), colourValue = doc.display.potential ? colour(result.wires[w.id]?.potential, max) : "#50677e", d = Routing.path(points);
      out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${9 / scale}" stroke-linejoin="round"/><path data-wire="${w.id}" d="${d}" fill="none" stroke="${selection === w.id ? "#2563eb" : colourValue}" stroke-width="${(selection === w.id ? 5 : 4) / scale}" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    doc.junctions.filter(j=>doc.wires.reduce((n,w)=>n+(w.from===j.id+":p")+(w.to===j.id+":p"),0)>1).forEach((j) => { const v = result.potentials[j.id + ":p"]; out += `<circle cx="${j.x}" cy="${j.y}" r="${5 / scale}" fill="${doc.display.potential ? colour(v, max) : "#334155"}"/>`; });
    placed.filter(p=>p.leader).forEach(p=>{const a=p.leader.from,b=p.leader.to;out+=`<path data-label-leader="${p.id}" d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="#a9bdcb" stroke-width="${1/scale}" stroke-dasharray="${3/scale} ${3/scale}"/>`;});
    doc.components.forEach((c) => {
      const r = result.components[c.id], isMeter = ["ammeter", "voltmeter", "wattmeter"].includes(c.type);
      const box=R.dualMeter(c)?'x="-82" y="-91" width="164" height="174"':'x="-46" y="-47" width="92" height="98"';
      out += `<g data-component="${c.id}" transform="translate(${c.x} ${c.y}) rotate(${c.angle})">${selection === c.id ? `<rect ${box} rx="10" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5 3"/>` : ""}${body(c, r, doc.display)}</g>`;
      // Sockets sit inside the housing. Paint the actual cable tail over that
      // housing, then paint the terminal, so there is no hidden 12-unit gap.
      if(R.dualMeter(c))doc.wires.forEach(w=>['from','to'].forEach(key=>{if(!w[key].startsWith(c.id+':'))return;
        let points=routes[w.id]||Routing.route(doc,w);if(key==='to')points=[...points].reverse();let distance=0;const lead=[points[0]];
        for(let i=1;i<points.length;i++){const step=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);if(distance+step>=24){lead.push(Routing.along(points,24));break;}lead.push(points[i]);distance+=step;}
        const tint=selection===w.id?'#2563eb':doc.display.potential?colour(result.wires[w.id]?.potential,max):'#50677e';
        out+=`<path data-terminal-lead="${w.id}:${key}" d="${Routing.path(lead)}" fill="none" stroke="${tint}" stroke-width="${4/scale}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }));
      R.ports(c).forEach((p) => {
        const v = result.potentials[p.id]; out += `<circle data-port="${p.id}" cx="${p.x}" cy="${p.y}" r="${5 / scale}" fill="#fff" stroke="${doc.display.potential ? colour(v, max) : "#57728b"}" stroke-width="${2 / scale}"/>`;
        if(isMeter&&!tiny&&(!R.dualMeter(c)||scale>=.7)){const x=R.dualMeter(c)?p.x-p.dx*17:p.x,y=R.dualMeter(c)?p.y-p.dy*17:p.y-12/scale,attrs=`data-port-label="${p.id}"`;out+=R.dualMeter(c)&&p.key!=='b'?Q.svg(x,y,portSpec(c,p),11/scale,attrs):text(x,y,p.label,11/scale,attrs);}
      });
      if (doc.display.potential && r?.voltage !== null && Math.abs(r?.voltage || 0) > 1e-8) {
        const ports=R.ports(c),a=ports.find(p=>p.key===(r.activePort||'a'))||ports[0], b=ports[1], from = r.voltage > 0 ? b : a, to = r.voltage > 0 ? a : b;
        const mx = c.x, my = c.y - 58, direction = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
        out += `<g transform="translate(${mx} ${my}) rotate(${direction})"><path d="M-20 0H20 M12-5L20 0L12 5" stroke="#b36b14" stroke-width="${1.8 / scale}" fill="none"/></g>` + text(mx, my - 10 / scale, "電勢升高", 11 / scale);
      }
    });
    // Selected cable stays visible even when it shorts a component beneath it.
    const raised=doc.wires.find(w=>w.id===selection);if(raised){const d=Routing.path(routes[raised.id]||Routing.route(doc,raised));out+=`<path data-raised-wire="${raised.id}" d="${d}" fill="none" stroke="#fff" stroke-width="${9/scale}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#2563eb" stroke-width="${5/scale}" stroke-linecap="round" stroke-linejoin="round"/>`;}
    const ends=new Map();doc.components.forEach(c=>R.ports(c).forEach(p=>ends.set(p.id,p)));doc.junctions.forEach(j=>ends.set(j.id+":p",j));
    doc.wires.forEach(w=>["from","to"].forEach((key,i)=>{
      const p=ends.get(w[key]),free=doc.junctions.some(j=>j.id+":p"===w[key])&&doc.wires.reduce((n,v)=>n+(v.from===w[key])+(v.to===w[key]),0)===1;
      if(free||selection===w.id||wireMode){out+=`<circle data-cable-end="${w.id}:${key}" cx="${p.x}" cy="${p.y}" r="${7/scale}" fill="${free?"#fff":"#2563eb"}" stroke="${selection===w.id?"#2563eb":"#526f88"}" stroke-width="${2.5/scale}"/>`;if(selection===w.id)out+=text(p.x,p.y-13/scale,i?"B":"A",11/scale,'fill="#245b94"');}
    }));
    placed.forEach(p=>{const b=p.box;out+=`<g data-label-block="${p.id}" data-label-slot="${p.slot}" data-label-crowded="${p.crowded}"><rect data-label-box="${p.id}" x="${b.left}" y="${b.top}" width="${b.right-b.left}" height="${b.bottom-b.top}" rx="${4/scale}" fill="#fff" fill-opacity=".92"/>`;p.rows.forEach(row=>{const attrs=`data-component-${row.kind==='name'?'label':'value'}="${p.id}"`;out+=row.tex?Q.svg(row.x,row.y,row,row.size/scale,attrs):text(row.x,row.y,row.text,row.size/scale,attrs);});out+='</g>';});
    if(tiny){
      const meters=doc.components.filter(c=>['ammeter','voltmeter','wattmeter'].includes(c.type)),shown=doc.display.values&&viewport.height*scale>=260?meters.slice(0,3):[],height=shown.length?56:30;
      const x=viewport.x+12/scale,bottom=viewport.y+viewport.height-10/scale,width=viewport.width-24/scale;
      out+=`<g data-overview-caption="true"><rect x="${x-5/scale}" y="${bottom-(height-8)/scale}" width="${width+10/scale}" height="${height/scale}" rx="${7/scale}" fill="#fff" fill-opacity=".95"/>`;
      shown.forEach((c,i)=>{const r=result.components[c.id],symbol={ammeter:'A',voltmeter:'V',wattmeter:'W'}[c.type],q=Q.quantity(r?.reading,r?.unit);out+=Q.svg(x+(i+.5)*width/shown.length,bottom-27/scale,{text:symbol+'：'+q.text,tex:Q.unit(symbol).tex+':\\;'+q.tex},14/scale,`data-overview-readout="${c.id}"`);});
      out+=text(x+width/2,bottom,meters.length>3?'全圖概覽 · 放大查看各儀表':'全圖概覽 · 放大查看元件',14/scale)+`</g>`;
    }
    return out;
  }
  function flow(doc, result, routes, time, scale) {
    if (doc.display.flow === "off") return ""; let out = '';
    doc.wires.forEach((w) => {
      const current = result.wires[w.id]?.current; if (current === null || Math.abs(current || 0) < 1e-9) return;
      const points = routes[w.id], length = points.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0), spacing = 65 / scale, electron = doc.display.flow === "electron", reverse = (current < 0) !== electron;
      for (let distance = (time * 30 / scale) % spacing; distance < length; distance += spacing) {
        const p = Routing.along(points, reverse ? length - distance : distance); if (!p) continue;
        if(doc.components.some(c=>{if(!R.dualMeter(c))return false;const b=R.bodyBounds(c);return p.x>b.left&&p.x<b.right&&p.y>b.top&&p.y<b.bottom;}))continue;
        if (electron) out += `<circle cx="${p.x}" cy="${p.y}" r="${6 / scale}" fill="#2563eb"/><path d="M${p.x - 3 / scale} ${p.y}h${6 / scale}" stroke="#fff" stroke-width="${1.5 / scale}"/>`;
        else out += `<path transform="translate(${p.x} ${p.y}) rotate(${p.angle + (reverse ? 180 : 0)})" d="M${-6 / scale} ${-4 / scale}L${2 / scale} 0L${-6 / scale} ${4 / scale}" stroke="#2563eb" stroke-width="${2 / scale}" fill="none"/>`;
      }
    });
    return out;
  }
  return { scene, labels, flow, body, dualDial, dialPoint, dialAngle, statusText, text, format, esc, colour };
});
