(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry, node ? require("./circuit-routing.js") : root.CircuitRouting, node ? require("./circuit-label-layout.js") : root.CircuitLabelLayout, node ? require("./circuit-math.js") : root.CircuitMath, node ? require("./circuit-solver.js") : root.CircuitSolver);
  if (node) module.exports = api; else root.CircuitRenderer = api;
})(globalThis, function (R, Routing, L, Q, S) {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function format(v,unit=''){return Number.isFinite(v)?Q.quantity(v,unit).text:'—';}
  const quantity=(x,y,v,u='',size=14,attrs='')=>Q.svg(x,y,Q.quantity(v,u),size,attrs);
  const lampFilament=[[-7,-8],[-7,-26],[-10,-31],[-6,-35],[-2,-29],[2,-35],[6,-29],[10,-33],[7,-26],[7,-8]];
  const resistorTrack=[[-32,0],[-27,-8],[-21,8],[-15,-8],[-9,8],[-3,-8],[3,8],[9,-8],[15,8],[21,-8],[27,8],[32,0]];
  // The third coordinate marks an incoming half-turn behind the opaque core.
  const relayCoil=[[-28,80],[-28,72],[-44,72],[-44,6],...Array.from({length:209},(_,n)=>{const t=n/32,angle=Math.PI+2*Math.PI*t;return[-8+25*Math.cos(angle),6+5.6*t+4*Math.sin(angle),n>0&&n%32>0&&n%32<=16];}),[28,42.4],[28,80]];
  const relayFront=[],relayHidden=[];
  let coilDistance=0,coilPart=[];
  for(let n=1;n<relayCoil.length;n++){
    const a=relayCoil[n-1],b=relayCoil[n],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(b[2]){if(coilPart.length){relayFront.push(coilPart);coilPart=[];}const last=relayHidden.at(-1);if(last?.[1]===coilDistance)last[1]+=length;else relayHidden.push([coilDistance,coilDistance+length]);}
    else{if(!coilPart.length)coilPart.push(a);coilPart.push(b);}coilDistance+=length;
  }
  if(coilPart.length)relayFront.push(coilPart);
  const relayPivot=-15,relayStroke=12,relayTip=position=>relayPivot+relayStroke*position;
  function relayCommon(position){const y=relayTip(position);return [[92,0],[74,0],...Array.from({length:12},(_,n)=>{const t=(n+1)/12,u=1-t;return[u*u*u*74+3*u*u*t*66+3*u*t*t*66+t*t*t*55,(3*u*t*t+t*t*t)*y];})];}

  const localPath=points=>Routing.path(points.map(([x,y])=>({x,y})));
  function colour(v, max = 6) { if (v === null) return "#64748b"; const t = Math.max(-1, Math.min(1, v / Math.max(max, .1))); return t < 0 ? `hsl(${210 + 10 * -t} 76% ${48 - 12 * -t}%)` : `hsl(${210 - 178 * t} ${35 + 45 * t}% ${48 - 8 * t}%)`; }
  function potentialRange(result){const values=Object.values(result.potentials).filter(Number.isFinite);return{low:Math.min(0,...values),high:Math.max(0,...values),max:Math.max(1,...values.map(Math.abs)),known:values.length>0};}
  function text(x, y, content, size = 14, attrs = "") { return `<text x="${x}" y="${y}" ${attrs.includes('text-anchor=')?'':'text-anchor="middle"'} ${attrs.includes("font-family=") ? "" : 'font-family="system-ui,sans-serif"'} font-size="${size}" ${attrs.includes("fill=") ? "" : 'fill="#334155"'} ${attrs}>${esc(content)}</text>`; }
  const statusText=r=>r?.meterStatus==='overrange'&&r.reading<0?'負向超量程 · 反接':({'unconnected':'接入 − 與一個正極孔','missing-common':'請接共用 − 孔','dual-positive':'兩個正極孔同時接線','unknown':'讀值未能確定','reverse':'反接','overrange':'超量程'}[r?.meterStatus]||'');
  function lampLight(c,result) {
    const ratedPower=c.params.ratedVoltage**2/c.params.resistance,measured=Object.hasOwn(result||{},'displayPower')?result.displayPower:result?.power,known=Number.isFinite(measured),power=known?Math.max(0,measured):null,ratio=known?power/ratedPower:0;
    return{known,power,ratedPower,ratio,brightness:Math.pow(Math.min(1,ratio),.6),overloaded:known&&ratio>S.hazardLimits.lampRatio};
  }
  const blend=(a,b,t)=>'#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');
  const hazardLimits=S.hazardLimits, visualState=(doc,result)=>result.mode==='transient'?result.hazards:S.hazards(doc,result);
  function heatEffect(x,y,scale,attrs='') {
    return `<g class="heat-effect" ${attrs} transform="translate(${x} ${y}) scale(${1/scale})" pointer-events="none"><title>短路／過載發熱示意</title><circle cy="-8" r="23" fill="#ff9e3744"/><path class="heat-flame" d="M-13 0C-24-18-7-23-8-40C0-33 3-27 2-19C9-22 10-28 12-30C24-10 19 1 5 4C-3 7-9 4-13 0Z" fill="#ed6728" stroke="#c94a24" stroke-width="1.5"/><path d="M-5 1C-13-9-2-15-1-23C8-14 13-4 6 1C3 4-2 4-5 1Z" fill="#ffe681"/><path class="heat-sparks" d="M-22-25l-6-7 M22-16l7-4 M15-38l4-7" fill="none" stroke="#e78b20" stroke-width="2.5" stroke-linecap="round"/><path d="M-2-46q-8-7 1-13t-2-12" fill="none" stroke="#82919b" stroke-width="3" stroke-linecap="round" opacity=".45"/></g>`;
  }
  const dialAngle=fraction=>R.meterScale.zeroAngle+R.meterScale.sweep*fraction;
  const dialPoint=(fraction,radius=80)=>{const angle=dialAngle(fraction)*Math.PI/180;return{x:radius*Math.cos(angle),y:24+radius*Math.sin(angle)};};
  function galvanometerDial(c,result,values=true){
    const point=(fraction,r)=>{const a=(-90+60*fraction)*Math.PI/180;return{x:r*Math.cos(a),y:25+r*Math.sin(a)};};
    let out='<rect x="-45" y="-41" width="90" height="83" rx="6" fill="#fff" stroke="#b2c2cf"/>';
    for(let n=-20;n<=20;n++){
      const a=point(n/20,51),b=point(n/20,n%5===0?44:48);out+=`<path data-meter-tick="${n}" data-fraction="${n/20}" d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#607487" stroke-width="${n===0?1.8:1}"/>`;
      if(n%10===0){const p=point(n/20,35);out+=quantity(p.x,p.y+3,c.params.range*1e6*n/20,'',8);}
    }
    out+=Q.svg(0,-32,Q.unit('μA'),10);
    if(!result||values&&(Number.isFinite(result.reading)||result.meterStatus==='unconnected')){
      const f=Number.isFinite(result?.reading)?Math.max(-1.03,Math.min(1.03,result.reading/c.params.range)):0,p=point(f,43);
      out+=`<path data-meter-needle="${esc(c.id)}" data-reading="${Number.isFinite(result?.reading)?result.reading:''}" data-range="${c.params.range}" data-fraction="${f}" data-angle="${-90+60*f}" d="M0 25L${p.x} ${p.y}" stroke="#c33b35" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    return `<g data-meter-dial="${esc(c.id)}" data-zero-angle="-90" data-divisions="20" data-negative-divisions="20">${out}<circle cy="25" r="3" fill="#475569"/>${text(0,37,'G',12)}</g>`;
  }
  function dualDial(c,result,values=true) {
    const ranges=R.meterRanges(c),unit=R.get(c.type).icon,low=result?.activePort==='c',high=result?.activePort==='a',range=result?.range??ranges.high,v=result?.reading;
    let out='<rect x="-72" y="-70" width="144" height="108" rx="7" fill="#fff" stroke="#b2c2cf"/>';
    const first=dialPoint(R.meterScale.minimumFraction),last=dialPoint(1);out+=`<path d="M${first.x} ${first.y}A80 80 0 0 1 ${last.x} ${last.y}" fill="none" stroke="#a6b5c1" stroke-width=".6"/>`;
    for(let i=-ranges.negativeDivisions;i<=ranges.divisions;i++){const f=i/ranges.divisions,a=dialPoint(f),b=dialPoint(f,i%10===0?71:i%5===0?74:77);out+=`<path data-meter-tick="${i}" data-fraction="${f}" data-angle="${dialAngle(f)}" d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${i<0?'#9b6258':'#475569'}" stroke-width="${i===0?2:i%10===0?1.5:1}"/>`;
      if(i%10===0){for(const [kind,radius,value,active]of [['high',64,ranges.high*f,high],['low',46,ranges.low*f,low]]){const p=dialPoint(f,radius);out+=quantity(p.x,p.y+3,value,'',10,`data-scale="${kind}" data-value="${value}" fill="${active?'#245b94':'#64748b'}"`);}}
    }
    out+=Q.svg(0,10,Q.unit(unit),17);
    const unconnected=['unconnected','missing-common'].includes(result?.meterStatus);
    if(values&&(Number.isFinite(v)||unconnected)){const fraction=unconnected?0:Math.max(R.meterScale.minimumFraction-R.meterScale.stopMargin,Math.min(1+R.meterScale.stopMargin,v/range)),p=dialPoint(fraction,69);out+=`<path data-meter-needle="${esc(c.id||'preview')}" data-reading="${Number.isFinite(v)?v:''}" data-range="${range}" data-target-fraction="${fraction}" data-fraction="${fraction}" data-angle="${dialAngle(fraction)}" d="M0 24L${p.x} ${p.y}" stroke="#c33b35" stroke-width="2" stroke-linecap="round"/>`;}
    out+='<circle cx="0" cy="24" r="4" fill="#475569"/>';
    return `<g data-meter-dial="${esc(c.id||'preview')}" transform="translate(0 -10) scale(1.04)" data-divisions="${ranges.divisions}" data-negative-divisions="${ranges.negativeDivisions}" data-zero-angle="${R.meterScale.zeroAngle}">${out}</g>`;
  }
  function dualMeter(c,result,display) {
    const out=dualDial(c,result,display.values);
    let shell='<rect data-meter-case="true" x="-78" y="-86" width="156" height="150" rx="12" fill="#e8f0f6" stroke="#446482" stroke-width="2"/>';
    shell+=`<g data-meter-face="${esc(c.id||'preview')}">${out}</g>`;
    const scale=R.meterBodyScale(c);shell=`<g data-meter-housing="${esc(c.id||'preview')}" transform="scale(${scale})">${shell}</g>`;
    R.localPorts(c).forEach(p=>{shell+=`<path data-socket-lead="${p.key}" d="M${p.x} 50V${p.y}" fill="none" stroke="#667b8e" stroke-width="4" stroke-linecap="round"/><circle data-socket="${p.key}" cx="${p.x}" cy="${p.y}" r="8" fill="${p.key==='b'?'#475569':'#bb6554'}"/><circle cx="${p.x}" cy="${p.y}" r="5" fill="#edbf77" stroke="#916c3e"/>`;});return shell;
  }
  function meter(c, result, display) {
    if(R.dualMeter(c))return dualMeter(c,result,display);
    const symbol = R.get(c.type).icon, v = result?.reading, unit = symbol === "A" ? "A" : symbol === "V" ? "V" : "W";
    const shell = '<rect x="-43" y="-36" width="86" height="78" rx="12" fill="#eef4fa" stroke="#446482" stroke-width="2"/>';
    let out = "";
    {
      out += '<path d="M-32 9 A32 32 0 0 1 32 9" fill="#fff" stroke="#94a3b8"/>';
      for (let n = 0; n <= 8; n++) { const a = Math.PI * (1 - n / 8); out += `<path d="M${Math.cos(a) * 28},${9 - Math.sin(a) * 28} L${Math.cos(a) * 32},${9 - Math.sin(a) * 32}" stroke="#64748b"/>`; }
      out += quantity(-28,22,-c.params.range,'',9)+quantity(0,-14,0,'',10)+quantity(28,22,c.params.range,'',9);
      if (!result||display.values&&(Number.isFinite(v)||result.meterStatus==='unconnected')) { const f=Number.isFinite(v)?Math.max(-1,Math.min(1,v/c.params.range)):0,a=Math.PI*(.5-f*.5);out+=`<path data-meter-needle="${esc(c.id)}" data-reading="${Number.isFinite(v)?v:''}" data-range="${c.params.range}" data-fraction="${f}" data-angle="${-90+90*f}" d="M0 9 L${Math.cos(a)*27},${9-Math.sin(a)*27}" stroke="#dc2626" stroke-width="2"/><circle cx="0" cy="9" r="3" fill="#334155"/>`; }
      out += Q.svg(0,36,Q.unit(unit),14);
    }
    if (display.values && v !== null && Math.abs(v) > c.params.range) out += text(0, -43, "超量程", 13, 'fill="#b91c1c"');
    return `<g data-meter-housing="${esc(c.id||'preview')}" transform="scale(${R.meterBodyScale(c)})">${shell}<g transform="rotate(${-(c.angle || 0)})">${out}</g></g>`;
  }
  function body(c, result, display) {
    const schematic = display.view === "schematic", p = c.params; if(typeof R.get(c.type).render === "function") return R.get(c.type).render(c,result,display);
    const leads = '<path d="M-60 0H-35 M35 0H60" stroke="#475569" stroke-width="3" fill="none"/>';
    if(c.type==='relay'){
      const position=result?.position??0,y=relayTip(position),leftY=relayPivot-14/105*relayStroke*position,coilOn=Number.isFinite(result?.current)&&Math.abs(result.current)>0;
      let out=schematic?'':`<rect data-relay-base="true" x="-73" y="58" width="125" height="9" rx="2" fill="#c2a580" stroke="#967c5d"/><rect x="-54" y="${relayPivot}" width="8" height="${58-relayPivot}" fill="#b6a18a" stroke="#817262"/>`;
      out+=`<path data-relay-leads="true" d="M92-48H55V${relayTip(0)} M92 48H55V${relayTip(1)}" fill="none" stroke="#667b8e" stroke-width="3"/><path data-relay-common="true" d="${localPath(relayCommon(position))}" fill="none" stroke="#667b8e" stroke-width="3"/>`;
      if(schematic)out+=`<rect x="-33" y="-3" width="50" height="51" fill="#fff" stroke="#334155" stroke-width="2"/><path d="M-8-3V${relayPivot}" stroke="#64748b" stroke-dasharray="3 3"/>`;
      else{
        out+=`<path data-relay-coil-back="true" d="${localPath(relayCoil)}" fill="none" stroke="#8f633d" stroke-width="2.8"/><rect data-relay-foot="true" x="-36" y="54" width="56" height="4" fill="#8d9fab" stroke="#627887"/><path data-relay-seat="true" d="M-36 54L-30 46H14L20 54Z" fill="#b6c5ce" stroke="#627887"/><g data-relay-core="true"><path d="M-29 0V49C-29 53 13 53 13 49V0Z" fill="${coilOn?'#93adbf':'#9eafb9'}" stroke="#627887"/><path d="M-22 1V50Q-10 53 4 50V1Z" fill="${coilOn?'#c5d6df':'#cbd4da'}"/><path d="M-21 3V48" stroke="#e8edf0" stroke-width="3"/><ellipse data-relay-core-cap="true" cx="-8" cy="0" rx="21" ry="4" fill="#cbd6dd" stroke="#627887"/></g>`;
        const spring=[[-64,leftY],[-64,leftY+7],...Array.from({length:15},(_,n)=>[-64+(n%2?5:-5),leftY+10+n*(45-leftY)/15]),[-64,58]];
        out+=`<path data-relay-spring="true" d="${localPath(spring)}" stroke="#89969e" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;
      }
      const winding=schematic?localPath(relayCoil):relayFront.map(localPath).join(' ');
      out+=`<path data-relay-coil="true" d="${winding}" fill="none" stroke="${schematic?'#475569':'#a57545'}" stroke-width="${schematic?1.5:2.8}" stroke-linejoin="round" stroke-linecap="round"/>`;
      if(!schematic)out+=`<path d="${winding}" transform="translate(0 -.4)" fill="none" stroke="#e0b983" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>`;
      out+=`<circle cx="55" cy="${relayTip(0)}" r="2.8" fill="#b88b4f"/><circle cx="55" cy="${relayTip(1)}" r="2.8" fill="#b88b4f"/><path data-relay-armature="true" d="M-64 ${leftY}L55 ${y}" stroke="${schematic?'#334155':'#8b775f'}" stroke-width="${schematic?3:4.5}" stroke-linecap="round"/><circle cx="-50" cy="${relayPivot}" r="3.5" fill="#596b78"/><circle cx="55" cy="${y}" r="2.5" fill="#596b78"/>`;
      return `<g data-relay="${esc(c.id||'sample')}" data-position="${position}" data-contact="${result?.contact===null?'open':result?.contact||'d'}" data-coil-current="${Number.isFinite(result?.current)?result.current:''}">${out}</g>`;
    }
    if(c.type==='galvanometer'){
      if(schematic)return '<path data-leads="galvanometer" d="M-60 0H-28 M28 0H60" stroke="#475569" stroke-width="3" fill="none"/><circle r="28" fill="#fff" stroke="#334155" stroke-width="2.5"/>'+`<g transform="rotate(${-(c.angle||0)})">${text(0,7,'G',24)}</g>`;
      const face=galvanometerDial(c,result,display.values);
      return '<path d="M-60 0H-51 M51 0H60" stroke="#667b8e" stroke-width="4" fill="none"/>'+'<rect data-meter-case="true" x="-51" y="-48" width="102" height="97" rx="10" fill="#e8f0f6" stroke="#446482" stroke-width="2"/>'+`<g data-meter-face="${esc(c.id)}" transform="rotate(${-(c.angle||0)})">${face}</g>`;
    }
    if (["ammeter", "voltmeter", "wattmeter"].includes(c.type)) {
      if(R.dualMeter(c)){
        if(!schematic)return meter(c,result,display);
        const ports=R.localPorts(c);return `<path d="${ports.map(p=>p.key==='c'?`M${p.x} 66V34`:`M${p.x} 66V39H${Math.sign(p.x)*20}V27`).join(' ')}" fill="none" stroke="#475569" stroke-width="3" stroke-linejoin="round"/><circle r="34" fill="#fff" stroke="#334155" stroke-width="2"/>`+`<g transform="rotate(${-(c.angle||0)})">${Q.svg(0,6,Q.unit(R.get(c.type).icon),22)}</g>`;
      }
      let lines = c.type === "wattmeter" ? `<path d="${schematic ? "M-60-20H-27 M27-20H60 M-60 40H-24V24 M24 24V40H60" : "M-60-20H-32 M32-20H60 M-60 40H-34V30 M34 30V40H60"}" stroke="#475569" stroke-width="3" fill="none" stroke-linejoin="round"/>` : leads;
      if (schematic) return lines + '<circle r="34" fill="#fff" stroke="#334155" stroke-width="2"/>' + `<g transform="rotate(${-(c.angle || 0)})">${Q.svg(0,6,Q.unit(R.get(c.type).icon),22)}</g>`;
      return lines + meter(c, result, display);
    }
    const metal = 'stroke="#667b8e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"';
    if (c.type === "battery") {
      if (schematic) return `<path data-leads="battery" d="M-60 0H-12 M12 0H60" ${metal}/><path d="M${-12*p.polarity}-26V26 M${12*p.polarity}-13V13" stroke="#334155" stroke-width="3"/>` + text(-25*p.polarity,-30,"+",14) + text(25*p.polarity,-30,"−",14);
      return `<path data-leads="battery" d="M-60 0H-37 M37 0H60" ${metal}/><g transform="scale(${p.polarity} 1)"><rect x="-39" y="-14" width="78" height="28" rx="6" fill="#a9b9c5" stroke="#607487" stroke-width="1.5"/><rect x="-33" y="-21" width="66" height="42" rx="7" fill="#486d83" stroke="#334e62" stroke-width="2"/><path d="M-24-20V20" stroke="#efbc68" stroke-width="14"/><path d="M-15-15H24" stroke="#7995a6" stroke-width="2" stroke-linecap="round"/></g>` + text(8,7,"DC",14,'fill="#fff" font-weight="600"') + text(-47*p.polarity,-15,"+",14) + text(47*p.polarity,-15,"−",14);
    }
    if(c.type==='rheostat'&&(p.terminals??2)>2){
      const x=-30+p.position*60,extra=p.terminals===4?'M30-34H68':'';
      if(schematic)return `<path data-leads="rheostat" d="M-68 20H-34 M34 20H68 M-68-34H${x}V6 ${extra}" ${metal}/><rect x="-34" y="7" width="68" height="26" fill="#fff" stroke="#334155" stroke-width="2.5"/><path d="M${x-5} 1L${x} 6L${x+5} 1" fill="none" stroke="#334155" stroke-width="2.5"/><path d="M-30-34H30" stroke="#92a9b9" stroke-width="5"/><rect data-rheostat-slider="true" x="${x-8}" y="-41" width="16" height="14" rx="3" fill="#397cab"/>`;
      let out='<rect x="-47" y="-24" width="94" height="65" rx="8" fill="#efe6d0" stroke="#a2977d" stroke-width="2"/><path d="M-36 10H36" stroke="#fff6df" stroke-width="18"/>';
      for(let n=-32;n<=32;n+=5)out+=`<path d="M${n} 3v30" stroke="#a57b5c" stroke-width="2"/>`;
      out+=`<path data-leads="rheostat" d="M-68 20H-36 M36 20H68 M-68-34H30 ${extra}" ${metal}/><path d="M-30-34H30" stroke="#a7bac5" stroke-width="7" stroke-linecap="round"/><path d="M${x}-34V10" stroke="#397cab" stroke-width="4"/><rect data-rheostat-slider="true" x="${x-8}" y="-41" width="16" height="14" rx="4" fill="#397cab" stroke="#23577e" stroke-width="1.5"/>`;
      return out;
    }
    if (c.type === "resistor" || c.type === "rheostat") {
      const variable = c.type === "rheostat", x = variable ? -30 + p.position * 60 : 0;
      if (schematic) return `<path data-leads="resistor" d="M-60 0H-34 M34 0H60" ${metal}/><rect x="-34" y="-13" width="68" height="26" fill="#fff" stroke="#334155" stroke-width="2.5"/>` + (variable ? '<path d="M-23 28L24-28 M12-25L24-28L21-16" stroke="#334155" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' + `<path d="M-30 38H30" stroke="#c2cfda" stroke-width="4"/><circle cx="${x}" cy="38" r="7" fill="#397cab"/>` : "");
      let out = '<rect x="-36" y="-17" width="72" height="34" rx="8" fill="#ece2ca" stroke="#9e9278" stroke-width="2"/><path d="M-27-11H27" stroke="#fff9e8" stroke-width="3" stroke-linecap="round"/>';
      out += `<path data-leads="resistor" d="M-60 0H-32 ${variable ? "" : "M32 0H60"}" ${metal}/><path d="${localPath(resistorTrack)}" fill="none" stroke="#9e6c4f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (variable) out += `<path d="M60 0H47V38H-30" ${metal}/><path d="M-30 38H30" stroke="#c0d4e2" stroke-width="7" stroke-linecap="round"/><path d="M${x} 38V-8 M${x-4}-2L${x}-8L${x+4}-2" fill="none" stroke="#397cab" stroke-width="3" stroke-linejoin="round"/><rect x="${x-8}" y="31" width="16" height="14" rx="4" fill="#397cab" stroke="#23577e" stroke-width="1.5"/><path d="M${x-3} 35V41 M${x+3} 35V41" stroke="#b9d9ec"/>`;
      return out;
    }
    if (c.type === "switch") {
      let out = schematic ? "" : '<rect x="-39" y="-18" width="78" height="40" rx="8" fill="#dce9e2" stroke="#8baca0" stroke-width="1.5"/><path d="M-29 14H29" stroke="#bdd0c7" stroke-width="2"/>';
      out += `<path data-leads="switch" d="M-60 0H-25 M25 0H60" ${metal}/><path d="M-25 0L25 ${p.closed ? 0 : -27}" fill="none" stroke="${schematic ? "#334155" : "#9b7952"}" stroke-width="${schematic ? 3 : 5}" stroke-linecap="round"/>`;
      if (!schematic) out += `<path d="M-10 ${p.closed ? 0 : -8.1}L13 ${p.closed ? 0 : -20.5}" stroke="#638b78" stroke-width="9" stroke-linecap="round"/>`;
      else out += '<circle cx="-25" r="3.5" fill="#fff" stroke="#334155" stroke-width="2"/><circle cx="25" r="3.5" fill="#fff" stroke="#334155" stroke-width="2"/>';
      return out;
    }
    if (c.type === "lamp") {
      const light=lampLight(c,result),glow=light.brightness,hot=Math.min(1,Math.max(0,light.ratio-1)),glass=blend([244,248,249],[255,224,104],glow),filament=blend([140,121,102],[255,249,217],glow);
      const wrap=out=>`<g data-lamp="${esc(c.id||'sample')}" data-power-known="${light.known}" data-power="${light.power??''}" data-rated-power="${light.ratedPower}" data-brightness="${glow}">${out}</g>`;
      if (schematic) return wrap(`<circle data-lamp-halo="outer" r="${28+12*glow}" fill="#ffca52" opacity="${glow*.3}"/><path data-leads="lamp" d="M-60 0H-28 M28 0H60" ${metal}/><circle data-lamp-glass="true" r="28" fill="${glass}" stroke="#334155" stroke-width="2.5"/><path d="M-19-19L19 19M19-19L-19 19" stroke="#334155" stroke-width="2.5"/>`);
      // The shell contact (left) and insulated bottom contact (right) are separate.
      // Both leads overlap their metal contact; neither ends at the glass envelope.
      let out = `<ellipse data-lamp-halo="outer" cy="-29" rx="${30+20*glow}" ry="${36+19*glow}" fill="#ffbf39" opacity="${glow*(.22+.08*hot)}"/><ellipse data-lamp-halo="inner" cy="-29" rx="${23+10*glow}" ry="${29+11*glow}" fill="#ffe075" opacity="${glow*.58}"/>`;
      out += `<path data-lamp-glass="true" d="M-11-9C-11-18-24-20-24-34C-24-63 24-63 24-34C24-20 11-18 11-9Z" fill="${glass}" stroke="#9bb2bf" stroke-width="2"/><path d="M-16-37C-16-45-9-48-5-48" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path data-lamp-filament="true" d="${localPath(lampFilament)}" fill="none" stroke="${filament}" stroke-width="${2+glow}" stroke-linejoin="round" stroke-linecap="round"/>`;
      out += '<path d="M-12-9H12V10Q12 13 8 13H-8Q-12 13-12 10Z" fill="#a8b5bf" stroke="#677c8c" stroke-width="1.5"/><path d="M-11-4H11 M-11 2H11 M-10 8H10" stroke="#6f8290" stroke-width="1.5"/><path d="M-6 14H6" stroke="#45586a" stroke-width="4"/><circle cy="18" r="3" fill="#b78b51"/>';
      out += `<path data-leads="lamp" d="M-60 0H-12 M60 0H40V18H0" ${metal}/>`;
      if (p.model === "thermal") out += text(0,-64,"熱效應",10,'fill="#986429"');
      return wrap(out);
    }
    return leads;
  }
  function potentialDirection(c,result){
    const r=result.components[c.id],branch=!R.dualMeter(c)&&r?.branches?.[0],ports=R.ports(c);
    const a=ports.find(p=>p.id===(c.type==='wattmeter'?c.id+':c':branch?.from||c.id+':'+(R.dualMeter(c)?r?.activePort:'a'))),b=ports.find(p=>p.id===(c.type==='wattmeter'?c.id+':d':branch?.to||c.id+':b'));
    const voltage=a&&b?(typeof result.voltage==='function'?result.voltage(a.id,b.id):Number.isFinite(result.potentials[a.id])&&Number.isFinite(result.potentials[b.id])?result.potentials[a.id]-result.potentials[b.id]:null):null;
    const from=voltage>0?b:a,to=voltage>0?a:b,known=Number.isFinite(voltage),directed=known&&voltage!==0;
    return {kind:'potentialDirection',componentId:c.id,text:directed?'電勢升高':known?'等電勢':'未能確定',voltage,from:directed?from.id:null,to:directed?to.id:null,angle:directed?Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI:null};
  }
  function labels(doc,result,scale=1,routes={},viewport=null,options=null){
    if(options)options.crowded=false;
    if(viewport&&scale<.4)return [];
    const items=[],details=[...(options?.exclusions||[])],nameSize=doc.display.projection?18:14,valueSize=doc.display.projection?16:12;
    doc.components.forEach(c=>{
      const r=result.components[c.id],isMeter=R.isMeter(c),lines=[];
      if(doc.display.names!==false)lines.push({kind:'name',text:c.label+(c.locked?' · 固定':''),size:nameSize});
      if(doc.display.values){
        if(isMeter)lines.push({kind:'value',...Q.quantity(c.type==='galvanometer'&&Number.isFinite(r?.reading)?r.reading*1e6:r?.reading,c.type==='galvanometer'?'μA':r?.unit),size:valueSize});
        else{const show=doc.display.quantities||{},parts=[],resistance=c.type==='lamp'&&c.params.model==='thermal'?r?.resistance:r?.resistance??R.effectiveResistance(c);
          if(c.type==='battery'){parts.push(Q.assignment('E',c.params.voltage,'V'));if(show.sourceResistance!==false)parts.push(Q.assignment('r',c.params.resistance,'Ω'));}
          else if(c.type==='switch')parts.push({text:c.params.closed?'閉合':'斷開'});
          else if(R.get(c.type).analysis==='transient'){const primary=R.primaryParameter(c);if(primary)parts.push(Q.quantity(primary.value*primary.factor,primary.unit));else if(c.type==='spdt')parts.push({text:c.params.closed==='b'?'接充電側':'接放電側'});}
          else if(c.type==='relay')parts.push({text:r?.contact==='e'?'已吸合':r?.contact===null?'切換中':'未吸合'});
          else{if(c.type==='rheostat'?show.loadResistance===true:show.loadResistance!==false){if(c.type==='rheostat')lines.push({kind:'value',text:'最大電阻',size:valueSize});parts.push(Q.quantity(c.type==='rheostat'?c.params.resistance:resistance,'Ω'));}if(show.loadPower!==false)parts.push(Q.quantity(r?.power,'W'));}
          if(parts.length)lines.push({kind:'value',...(['switch','relay'].includes(c.type)?parts[0]:Q.join(parts)),size:valueSize});
        }
      }
      if(lines.length)items.push({id:c.id,lines,maxWidth:doc.display.projection?230:180});
      if(options?.selection===c.id){const b=R.bodyBounds(c);details.push({left:b.left-6,right:b.right+6,top:b.top-6,bottom:b.bottom+6});}
      if((isMeter||c.type==='rheostat')&&(!R.dualMeter(c)||scale>=(doc.display.view==='real'?.4:.7)))R.ports(c).forEach(p=>{const label=portLabel(c,p,scale,doc.display.view);details.push(label.box);});
      if(options?.potentialDirections?.has(c.id)){const direction=potentialDirection(c,result);items.push({id:'potential-'+c.id,componentId:c.id,paddingLeft:direction.angle===null?0:32,lines:[{...direction,size:doc.display.projection?18:16}]});}
    });
    for(const w of doc.wires){
      if(!options?.wireCurrents?.has(w.id))continue;
      const points=Routing.simplify(routes[w.id]||Routing.route(doc,w),.6/scale);let anchor=null,longest=0;
      // ponytail: anchor one straight segment; add multiple anchors if dense diagrams need them.
      for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],span=viewport?L.segmentSpan(a,b,{left:viewport.x,right:viewport.x+viewport.width,top:viewport.y,bottom:viewport.y+viewport.height}):[0,1];if(!span)continue;const length=Math.hypot(b.x-a.x,b.y-a.y)*(span[1]-span[0]),t=(span[0]+span[1])/2,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};if(length>longest){anchor=p;longest=length;}}
      if(!anchor||viewport&&longest*scale<12)continue;
      const current=result.wires[w.id]?.current,size=doc.display.projection?16:14,value=Math.abs(current),unit=value===0||value>=1?'A':value>=.001?'mA':'μA',factor=unit==='A'?1:unit==='mA'?1e3:1e6;
      const quantity=Number.isFinite(current)?Q.quantity(value*factor,unit):{text:'未能確定'};
      items.push({id:w.id,anchor,paddingLeft:Number.isFinite(current)&&current!==0?32:0,lines:[{kind:'wireCurrent',...quantity,size,current,angle:anchor.angle+(current<0?180:0)}]});
    }
    const placed=L.layout(doc,items,scale,routes,viewport,details,options?.previous);
    if(viewport&&options?.potentialDirections?.size&&placed.some(p=>p.crowded)){options.crowded=true;return [];}
    if(options)options.previous=new Map(placed.map(p=>[p.id,p.slot]));return placed;
  }
  function portSpec(c,p){if(p.key==='b')return{text:'−',tex:'-'};const ranges=R.meterRanges(c);return Q.quantity(p.key==='a'?ranges.high:ranges.low,'');}
  function portLabel(c,p,scale=1,view='real') {
    if(R.dualMeter(c)&&view==='real'){
      const spec=portSpec(c,p),metrics=Q.measure(spec.tex,16),widthRatio=metrics.width/16;
      // Screen-sized lettering in a reserved strip inside the case. At very
      // small zooms, constrain each label to its column (or the rotated strip).
      const local=R.localPorts(c).find(port=>port.key===p.key),columnWidth=Math.min(42,2*(78*R.meterBodyScale(c)-Math.abs(local.x)-2));
      const size=Math.min(16/scale,(c.angle%180?25:columnWidth)/widthRatio,25/(metrics.height/16)),m=Q.measure(spec.tex,size),bounds=R.meterHousingBounds(c);
      const a=c.angle*Math.PI/180,cos=Math.round(Math.cos(a)),sin=Math.round(Math.sin(a));
      const lx=local.x,ly=40;
      const x=Math.max(bounds.left+m.width/2+2,Math.min(bounds.right-m.width/2-2,c.x+lx*cos-ly*sin));
      const cy=Math.max(bounds.top+m.height/2+2,Math.min(bounds.bottom-m.height/2-2,c.y+lx*sin+ly*cos)),y=cy+(m.ascent-m.descent)/2;
      return{x,y,spec,size,box:{left:x-m.width/2-1,right:x+m.width/2+1,top:y-m.ascent-1,bottom:y+m.descent+1}};
    }
    const dual=R.dualMeter(c),watt=c.type==='wattmeter',size=watt?14:11,spec=dual?portSpec(c,p):watt?{text:p.label,tex:(['a','b'].includes(p.key)?'I':'V')+'_{'+(['a','c'].includes(p.key)?'+':'-')+'}'}:{text:p.label},m=spec.tex?Q.measure(spec.tex,size):{width:L.measure(p.label,size),ascent:size,descent:2};
    let x=p.x,y=p.y-(dual?8+(4+m.descent)/scale:(watt?15:12)/scale);
    if(dual){const bounds=view==='real'?R.meterHousingBounds(c):{left:c.x-35,right:c.x+35,top:c.y-35,bottom:c.y+35};
      if(p.dx<0)x=Math.min(x,bounds.left-(3+m.width/2)/scale);
      if(p.dx>0)x=Math.max(x,bounds.right+(3+m.width/2)/scale);
      if(p.dy>0)y=Math.max(y,bounds.bottom+(3+m.ascent)/scale);
    }
    return{x,y,spec,size:size/scale,box:{left:x-(m.width/2+2)/scale,right:x+(m.width/2+2)/scale,top:y-(m.ascent+2)/scale,bottom:y+(m.descent+2)/scale}};
  }
  function scene(doc, result, scale = 1, routes = {}, selection = null, wireMode = false, viewport = null, labelOptions = null) {
    const {max} = potentialRange(result);
    if(labelOptions)labelOptions.selection=selection;
    const placed=labels(doc,result,scale,routes,viewport,labelOptions),hazards=visualState(doc,result);
    const tiny=viewport&&(scale<.4||labelOptions?.crowded)&&(doc.components.length>0||labelOptions?.wireCurrents?.size);
    let out = '';
    placed.filter(p=>p.leader).forEach(p=>{const a=p.leader.from,b=p.leader.to;out+=`<path data-label-leader="${p.id}" d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="#a9bdcb" stroke-width="${1/scale}" stroke-dasharray="${3/scale} ${3/scale}"/>`;});
    doc.components.forEach((c) => {
      const r = result.components[c.id];
      const size=R.meterBodyScale(c),box=c.type==='relay'?'x="-78" y="-42" width="158" height="112"':R.dualMeter(c)?doc.display.view==='real'?`x="-80" y="${-86*size-6}" width="160" height="${78+86*size+12}"`:'x="-72" y="-44" width="144" height="116"':'x="-46" y="-47" width="92" height="98"';
      out += `<g data-component="${c.id}" transform="translate(${c.x} ${c.y}) rotate(${c.angle})">${selection === c.id ? `<rect ${box} rx="10" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5 3"/>` : ""}${body(c, r, result.mode==='transient'?{...doc.display,fields:labelOptions?.fields??true}:doc.display)}</g>`;
    });
    // Cables lie on top of components; terminals and labels stay legible above them.
    doc.wires.forEach((w) => {
      const points = routes[w.id] || Routing.route(doc, w), colourValue = doc.display.potential ? colour(result.wires[w.id]?.potential, max) : "#50677e", d = Routing.path(points);
      const reading=result.wires[w.id],gradient=doc.display.potential&&w.resistance>0&&selection!==w.id&&Number.isFinite(reading?.potential)&&Number.isFinite(reading?.potentialTo);
      if(hazards.wires[w.id])out+=`<path data-wire-heat="${w.id}" d="${d}" fill="none" stroke="#f09b50" opacity=".5" stroke-width="${12/scale}" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>`;
      out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${9 / scale}" stroke-linejoin="round"/><path ${hazards.wires[w.id]?`data-wire-hazard="${hazards.wires[w.id]}"`:''} ${selection===w.id?`data-raised-wire="${w.id}"`:""} data-wire="${w.id}" d="${d}" fill="none" stroke="${selection === w.id ? "#2563eb" : gradient?'transparent':colourValue}" stroke-width="${(selection === w.id ? 5 : 4) / scale}" stroke-linejoin="round" stroke-linecap="round"/>`;
      if(gradient){const total=Routing.length(points)||1,drop=reading.potentialTo-reading.potential;let at=0;
        for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],distance=Math.hypot(b.x-a.x,b.y-a.y);if(!distance)continue;const id=esc((labelOptions?.idPrefix||'')+'wire-potential-'+w.id+'-'+i),from=reading.potential+drop*at/total,to=reading.potential+drop*(at+distance)/total;at+=distance;
          out+=`<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><stop offset="0" stop-color="${colour(from,max)}"/><stop offset="1" stop-color="${colour(to,max)}"/></linearGradient></defs><path data-wire-potential="${w.id}" d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="url(#${id})" stroke-width="${4/scale}" stroke-linecap="round" pointer-events="none"/>`;
        }
      }
    });
    doc.junctions.filter(j=>doc.wires.reduce((n,w)=>n+(w.from===j.id+":p")+(w.to===j.id+":p"),0)>1).forEach((j) => { const v = result.potentials[j.id + ":p"]; out += `<circle cx="${j.x}" cy="${j.y}" r="${5 / scale}" fill="${doc.display.potential ? colour(v, max) : "#334155"}"/>`; });
    doc.components.forEach(c=>{const isMeter=R.isMeter(c)||c.type==='rheostat';
      R.ports(c).forEach((p) => {
        const v = result.potentials[p.id]; out += `<circle data-port="${p.id}" cx="${p.x}" cy="${p.y}" r="${5 / scale}" fill="#fff" stroke="${doc.display.potential ? colour(v, max) : "#57728b"}" stroke-width="${2 / scale}"/>`;
        if(isMeter&&!tiny&&(!R.dualMeter(c)||scale>=(doc.display.view==='real'?.4:.7))){const a=portLabel(c,p,scale,doc.display.view),attrs=`data-port-label="${p.id}"`;if(!R.dualMeter(c)||doc.display.view!=='real')out+=`<rect x="${a.box.left}" y="${a.box.top}" width="${a.box.right-a.box.left}" height="${a.box.bottom-a.box.top}" rx="${2/scale}" fill="#ffffffee" pointer-events="none"/>`;out+=(a.spec.tex?Q.svg(a.x,a.y,a.spec,a.size,attrs):text(a.x,a.y,a.spec.text,a.size,attrs));}
      });
    });
    let effects=0;
    doc.components.forEach(c=>{if(hazards.components[c.id]&&effects++<8)out+=heatEffect(c.x+(c.type==='lamp'?24:0)/scale,c.y-(c.type==='lamp'?44:14)/scale,scale,`data-hazard-component="${c.id}" data-hazard="${hazards.components[c.id]}"`);});
    doc.wires.forEach(w=>{if(hazards.wires[w.id]&&effects++<8){const points=routes[w.id]||Routing.route(doc,w),p=Routing.along(points,Routing.length(points)/2);out+=heatEffect(p.x,p.y-3/scale,scale,`data-hazard-wire="${w.id}" data-hazard="${hazards.wires[w.id]}"`);}});
    const ends=new Map();doc.components.forEach(c=>R.ports(c).forEach(p=>ends.set(p.id,p)));doc.junctions.forEach(j=>ends.set(j.id+":p",j));
    doc.wires.forEach(w=>["from","to"].forEach((key,i)=>{
      const p=ends.get(w[key]),free=doc.junctions.some(j=>j.id+":p"===w[key])&&doc.wires.reduce((n,v)=>n+(v.from===w[key])+(v.to===w[key]),0)===1;
      if(free||selection===w.id||wireMode){out+=`<circle data-cable-end="${w.id}:${key}" cx="${p.x}" cy="${p.y}" r="${7/scale}" fill="${free?"#fff":"#2563eb"}" stroke="${selection===w.id?"#2563eb":"#526f88"}" stroke-width="${2.5/scale}"/>`;if(selection===w.id)out+=text(p.x,p.y-13/scale,i?"B":"A",11/scale,'fill="#245b94"');}
    }));
    placed.forEach(p=>{const b=p.box,row=p.rows[0],wire=row.kind==='wireCurrent',potential=row.kind==='potentialDirection',current=row.current;out+=`<g data-label-block="${p.id}" data-label-slot="${p.slot}" data-label-crowded="${p.crowded}" pointer-events="none" ${wire?`data-wire-current-label="${p.id}" data-current="${Number.isFinite(current)?current:''}"`:potential?`data-potential-label="${row.componentId}"`:''}>${wire?'<title>'+esc('導線 '+p.id+'：'+(Number.isFinite(current)&&current!==0?(current<0?'B → A，':'A → B，'):'')+row.text)+'</title>':potential?'<title>'+esc(doc.components.find(c=>c.id===row.componentId).label+'：'+p.rows.map(r=>r.text).join('')+(row.from?'（'+row.from+' → '+row.to+'）':''))+'</title>':''}<rect data-label-box="${p.id}" x="${b.left}" y="${b.top}" width="${b.right-b.left}" height="${b.bottom-b.top}" rx="${4/scale}" fill="#fff" fill-opacity=".95" ${wire||potential?`stroke="${potential?'#d6b889':'#bfd1df'}" stroke-width="${1/scale}"`:''}/>`;
      if(wire&&Number.isFinite(current)&&current!==0)out+=`<path data-wire-current-arrow="${p.id}" data-direction="${current<0?-1:1}" transform="translate(${b.left+17/scale} ${(b.top+b.bottom)/2}) rotate(${p.rows[0].angle}) scale(${1/scale})" d="M-9 0H9 M3-5L9 0L3 5" fill="none" stroke="#245b94" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      if(potential&&row.angle!==null)out+=`<path data-potential-direction="${row.componentId}" data-potential-from="${row.from}" data-potential-to="${row.to}" transform="translate(${b.left+17/scale} ${(b.top+b.bottom)/2}) rotate(${row.angle}) scale(${1/scale})" d="M-9 0H9 M3-5L9 0L3 5" fill="none" stroke="#a45d0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      p.rows.forEach(row=>{const attrs=wire?`data-wire-current-value="${p.id}"`:potential?`data-potential-value="${row.componentId}" fill="#815019"`:`data-component-${row.kind==='name'?'label':'value'}="${p.id}"`;out+=row.tex?Q.svg(row.x,row.y,row,row.size/scale,attrs):text(row.x,row.y,row.text,row.size/scale,attrs);});out+='</g>';});
    if(tiny){
      const meters=doc.components.filter(R.isMeter),shown=doc.display.values&&viewport.height*scale>=260?meters.slice(0,3):[],height=shown.length?56:30;
      const x=viewport.x+12/scale,bottom=viewport.y+viewport.height-10/scale,width=viewport.width-24/scale;
      out+=`<g data-overview-caption="true"><rect x="${x-5/scale}" y="${bottom-(height-8)/scale}" width="${width+10/scale}" height="${height/scale}" rx="${7/scale}" fill="#fff" fill-opacity=".95"/>`;
      shown.forEach((c,i)=>{const r=result.components[c.id],symbol={ammeter:'A',voltmeter:'V',wattmeter:'W',galvanometer:'G'}[c.type],q=Q.quantity(c.type==='galvanometer'&&Number.isFinite(r?.reading)?r.reading*1e6:r?.reading,c.type==='galvanometer'?'μA':r?.unit);out+=Q.svg(x+(i+.5)*width/shown.length,bottom-27/scale,{text:symbol+'：'+q.text,tex:'\\mathrm{'+symbol+'}:\\;'+q.tex},14/scale,`data-overview-readout="${c.id}"`);});
      out+=text(x+width/2,bottom,labelOptions?.crowded?'標示較密 · 放大或逐個顯示':labelOptions?.potentialDirections?.size?'電勢方向'+(labelOptions?.wireCurrents?.size?'／電流':'')+'已開啟 · 放大查看':labelOptions?.wireCurrents?.size?'導線電流已開啟 · 放大查看':meters.length>3?'全圖概覽 · 放大查看各儀表':'全圖概覽 · 放大查看元件',14/scale,(labelOptions?.wireCurrents?.size?'data-wire-current-overview="true" ':'')+(labelOptions?.potentialDirections?.size?'data-potential-overview="true"':''))+`</g>`;
    }
    return out;
  }
  const flowSpacing=65,modulo=(v,n)=>(v%n+n)%n;
  // The electrical branches and the visible conductors have different topology:
  // combine shared conductors before drawing, rather than overlay opposite flows.
  function componentFlowPaths(doc,result){
    const paths=[],schematic=doc.display.view==='schematic';
    for(const c of doc.components){
      const branches=result.components[c.id]?.branches||[],prefix=c.id+':',x=-30+60*(c.params.position??.5);
      const current=(a,b)=>branches.find(e=>e.from===prefix+a&&e.to===prefix+b)?.current??null;
      const sum=(...values)=>values.every(Number.isFinite)?values.reduce((s,v)=>s+v,0):null;
      const i=current('a','b'),angle=c.angle*Math.PI/180,cos=Math.round(Math.cos(angle)),sin=Math.round(Math.sin(angle));
      const add=(key,from,to,value,local)=>{
        const points=local.map(([px,py])=>({x:c.x+px*cos-py*sin,y:c.y+px*sin+py*cos}));
        const path={id:'component:'+c.id+':'+key,component:c.id,key,from:prefix+from,to:prefix+to,current:value,points};if(Routing.length(points)>1e-8)paths.push(path);return path;
      };
      if(R.dualMeter(c)){
        const high=i,low=current('c','b'),ports=R.localPorts(c),a=ports.find(p=>p.key==='a'),b=ports.find(p=>p.key==='b');
        add('high','a','coil',high,schematic?[[a.x,66],[a.x,39],[Math.sign(a.x)*20,39],[Math.sign(a.x)*20,27],[Math.sign(a.x)*16,24],[0,24]]:[[a.x,66],[a.x,34],[0,34]]);
        add('low','c','coil',low,schematic?[[0,66],[0,34],[0,24]]:[[0,66],[0,34]]);
        add('common','coil','b',sum(high,low),schematic?[[0,24],[Math.sign(b.x)*16,24],[Math.sign(b.x)*20,27],[Math.sign(b.x)*20,39],[b.x,39],[b.x,66]]:[[0,34],[b.x,34],[b.x,66]]);
      }else if(c.type==='rheostat'&&(c.params.terminals??2)>2){
        const right=current('b','c'),bar=c.params.terminals===4?current('b','d'):0;
        add('resistance-a','a','contact',i,[[-68,20],[x,20]]);
        add('resistance-c','contact','c',right,[[x,20],[68,20]]);
        add('slider','contact','slider',sum(i,Number.isFinite(right)?-right:null),[[x,20],[x,-34]]);
        add('bar-left','b','slider',sum(Number.isFinite(i)?-i:null,right,bar),[[-68,-34],[x,-34]]);
        if(c.params.terminals===4)add('bar-right','slider','d',bar,[[x,-34],[68,-34]]);
      }else if(c.type==='wattmeter'){
        add('current-coil','a','b',i,schematic?[[-60,-20],[60,-20]]:[[-60,-20],[-32,-20],[-32,-28],[32,-28],[32,-20],[60,-20]]);
        add('voltage-coil','c','d',current('c','d'),schematic?[[-60,40],[-24,40],[-24,24],[-18,20],[18,20],[24,24],[24,40],[60,40]]:[[-60,40],[-34,40],[-34,33],[34,33],[34,40],[60,40]]);
      }else if(c.type==='relay'){
        const coil=add('coil','a','b',i,relayCoil);
        if(!schematic){coil.hidden=relayHidden;coil.track=relayFront.map(part=>Routing.path(part.map(([px,py])=>({x:c.x+px*cos-py*sin,y:c.y+px*sin+py*cos})))).join(' ');}
        const contact=result.components[c.id]?.contact;
        if(['d','e'].includes(contact)){add('contact','c',contact,current('c',contact),[...relayCommon(contact==='d'?0:1),[55,contact==='d'?-48:48],[92,contact==='d'?-48:48]]);}
      }else{
        let points;
        if(c.type==='lamp')points=schematic?[[-60,0],[-28,0],[-19,-19],[19,19],[28,0],[60,0]]:[[-60,0],[-12,0],...lampFilament,[0,18],[40,18],[40,0],[60,0]];
        else if(c.type==='battery')points=schematic?[[-60,0],[60,0]]:[[-60,0],[-37,0],[-29,-10],[29,-10],[37,0],[60,0]];
        else if(c.type==='resistor')points=schematic?[[-60,0],[60,0]]:[[-60,0],...resistorTrack,[60,0]];
        else if(c.type==='rheostat'){
          const track=resistorTrack.filter(p=>p[0]<x),segment=resistorTrack.findIndex(p=>p[0]>=x),a=resistorTrack[Math.max(0,segment-1)],b=resistorTrack[segment],y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
          points=schematic?[[-60,0],[60,0]]:[[-60,0],...track,[x,y],[x,38],[47,38],[47,0],[60,0]];
        }else if(c.type==='switch')points=[[-60,0],[60,0]];
        else if(c.type==='galvanometer')points=schematic?[[-60,0],[-28,0],[-16,20],[16,20],[28,0],[60,0]]:[[-60,0],[-51,0],[-47,45],[47,45],[51,0],[60,0]];
        if(points)add('main','a','b',i,points);
      }
    }
    return paths;
  }
  function componentFlowSpacing(points,scale){
    // An integer subdivision preserves phase when the 65 px accumulator wraps.
    const target=Math.min(flowSpacing,36*scale,Routing.length(points)*scale/2);
    return flowSpacing/Math.max(1,Math.ceil(flowSpacing/target));
  }
  // Each electrically connected island gets its own current scale. A second,
  // unrelated circuit must not hide a microamp circuit's moving charges.
  function flowReferences(doc,result,baselines=null){
    const references=new Map();
    const record=(endpoint,current)=>{
      if(!Number.isFinite(current)||current===0)return;
      const island=result.islandOf?.[endpoint]??endpoint;
      references.set(island,Math.max(references.get(island)||0,Math.abs(current)));
    };
    for(const w of doc.wires)record(w.from,result.wires[w.id]?.current);
    for(const c of doc.components)for(const b of result.components[c.id]?.branches||[])record(b.from,b.current);
    if(baselines){
      // Island roots change when ideal wires gain resistance; endpoint membership does not.
      const members=new Map();for(const [endpoint,island]of Object.entries(result.islandOf||{})){if(!members.has(island))members.set(island,[]);members.get(island).push(endpoint);}
      const live=new Set();for(const [island,endpoints]of members){const key=JSON.stringify(endpoints.sort());live.add(key);if(references.has(island)){if(!baselines.has(key))baselines.set(key,references.get(island));references.set(island,baselines.get(key));}}
      for(const key of baselines.keys())if(!live.has(key))baselines.delete(key);
    }
    return references;
  }
  const referenceAt=(references,result,endpoint)=>references.get(result.islandOf?.[endpoint]??endpoint);
  // Compressed relative speeds with a visible floor; never a physical drift
  // velocity or an exact current ratio. Only genuine zero/unknown stays still.
  function flowSpeed(current,reference=4){
    if(!Number.isFinite(current)||current===0)return 0;
    const scale=Number.isFinite(reference)&&reference>0?reference:4;
    return 18+222/(1+2*Math.sqrt(scale/Math.abs(current)));
  }
  function advanceFlow(offsets,doc,result,dt,baselines=null){
    const paths=[...doc.wires.map(w=>({id:w.id,from:w.from,current:result.wires[w.id]?.current})),...componentFlowPaths(doc,result)];
    const ids=new Set(paths.map(p=>p.id));for(const id of offsets.keys())if(!ids.has(id))offsets.delete(id);
    if(doc.display.flow==='off')return;
    const references=flowReferences(doc,result,baselines),elapsed=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0)),polarity=doc.display.flow==='electron'?-1:1;
    for(const p of paths){const speed=flowSpeed(p.current,referenceAt(references,result,p.from));if(speed)offsets.set(p.id,modulo((offsets.get(p.id)||0)+polarity*Math.sign(p.current)*speed*elapsed,flowSpacing));}
  }
  function flowParticles(points,phase,spacing,scale,electron,reverse,size,hidden=[]){
    let out='';const length=Routing.length(points);
    for(let distance=modulo(phase,spacing)/scale;distance<length;distance+=spacing/scale){
      if(hidden.some(([a,b])=>distance>a&&distance<b))continue;
      const p=Routing.along(points,distance);if(!p)continue;const attrs=`data-flow-distance="${distance}"`;
      if(electron)out+=`<circle ${attrs} cx="${p.x}" cy="${p.y}" r="${6*size}" fill="#2563eb"/><path d="M${p.x-3*size} ${p.y}h${6*size}" stroke="#fff" stroke-width="${1.5*size}"/>`;
      else out+=`<path ${attrs} transform="translate(${p.x} ${p.y}) rotate(${p.angle+(reverse?180:0)})" d="M${-6*size} ${-4*size}L${2*size} 0L${-6*size} ${4*size}" stroke="#2563eb" stroke-width="${2*size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return out;
  }
  function flow(doc, result, routes, time, scale, offsets=null,baselines=null) {
    if (doc.display.flow === "off") return ""; let out = '';const electron=doc.display.flow==='electron',references=flowReferences(doc,result,baselines);
    doc.wires.forEach((w) => {
      const current = result.wires[w.id]?.current,reference=referenceAt(references,result,w.from),speed=flowSpeed(current,reference);if(!speed)return;
      const points=routes[w.id]||Routing.route(doc,w),reverse=(current<0)!==electron,phase=modulo(offsets?offsets.get(w.id)||0:time*speed*(reverse?-1:1),flowSpacing);
      out+=`<g data-flow-wire="${w.id}" data-current="${current}" data-reference-current="${reference}" data-speed="${speed}" data-phase="${phase}" data-direction="${reverse?-1:1}">`;
      out+=flowParticles(points,phase,flowSpacing,scale,electron,reverse,1/scale);
      out+='</g>';
    });
    for(const p of componentFlowPaths(doc,result)){
      const reference=referenceAt(references,result,p.from),speed=flowSpeed(p.current,reference);if(!speed)continue;
      const reverse=(p.current<0)!==electron,phase=modulo(offsets?offsets.get(p.id)||0:time*speed*(reverse?-1:1),flowSpacing),spacing=componentFlowSpacing(p.points,scale),size=Math.min(1/scale,.55);
      out+=`<g data-flow-component="${esc(p.component)}" data-flow-path="${p.key}" data-from="${esc(p.from)}" data-to="${esc(p.to)}" data-current="${p.current}" data-reference-current="${reference}" data-speed="${speed}" data-phase="${phase}" data-direction="${reverse?-1:1}" data-spacing="${spacing}" pointer-events="none"><path data-flow-track="true" d="${p.track??Routing.path(p.points)}" fill="none" stroke="#2563eb" opacity=".2" stroke-width="${2*size}" stroke-linejoin="round"/>`;
      out+=flowParticles(p.points,phase,spacing,scale,electron,reverse,size,p.hidden)+'</g>';
    }
    return out;
  }
  return { scene, labels, flow, advanceFlow, flowReferences, flowSpeed, flowSpacing, componentFlowPaths, componentFlowSpacing, body, dualDial, galvanometerDial, dialPoint, dialAngle, portLabel, lampLight, visualState, hazardLimits, statusText, text, format, esc, colour, potentialRange };
});
