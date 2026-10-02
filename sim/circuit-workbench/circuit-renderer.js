(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./component-registry.js") : root.CircuitRegistry, node ? require("./circuit-routing.js") : root.CircuitRouting);
  if (node) module.exports = api; else root.CircuitRenderer = api;
})(globalThis, function (R, Routing) {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function format(v, unit = "") { if (v === null || v === undefined || !Number.isFinite(v)) return "—"; const a = Math.abs(v); let text = a >= 10000 || (a > 0 && a < .001) ? v.toExponential(2) : Number(v.toPrecision(4)).toString(); if (text === "-0") text = "0"; return text + (unit ? " " + unit : ""); }
  function colour(v, max = 6) { if (v === null) return "#64748b"; const t = Math.max(-1, Math.min(1, v / Math.max(max, .1))); return t < 0 ? `hsl(${210 + 10 * -t} 76% ${48 - 12 * -t}%)` : `hsl(${210 - 178 * t} ${35 + 45 * t}% ${48 - 8 * t}%)`; }
  function text(x, y, content, size = 14, attrs = "") { return `<text x="${x}" y="${y}" text-anchor="middle" ${attrs.includes("font-family=") ? "" : 'font-family="system-ui,sans-serif"'} font-size="${size}" ${attrs.includes("fill=") ? "" : 'fill="#334155"'} ${attrs}>${esc(content)}</text>`; }
  function meter(c, result, display) {
    const symbol = R.get(c.type).icon, v = result?.reading, unit = symbol === "A" ? "A" : symbol === "V" ? "V" : "W";
    const shell = '<rect x="-43" y="-36" width="86" height="78" rx="12" fill="#eef4fa" stroke="#446482" stroke-width="2"/>';
    let out = "";
    if (display.meters === "digital") { out += '<rect x="-35" y="-26" width="70" height="38" rx="5" fill="#dce9df"/>'; out += text(0, -1, display.values ? format(v) : symbol, 16, 'font-family="monospace"'); out += text(0, 30, unit, 14); }
    else {
      out += '<path d="M-32 9 A32 32 0 0 1 32 9" fill="#fff" stroke="#94a3b8"/>';
      for (let n = 0; n <= 8; n++) { const a = Math.PI * (1 - n / 8); out += `<path d="M${Math.cos(a) * 28},${9 - Math.sin(a) * 28} L${Math.cos(a) * 32},${9 - Math.sin(a) * 32}" stroke="#64748b"/>`; }
      out += text(-28, 22, format(-c.params.range), 9) + text(0, -14, "0", 10) + text(28, 22, format(c.params.range), 9);
      if (display.values && v !== null && v !== undefined) { const a = Math.PI * (.5 - Math.max(-1, Math.min(1, v / c.params.range)) * .45); out += `<path d="M0 9 L${Math.cos(a) * 27},${9 - Math.sin(a) * 27}" stroke="#dc2626" stroke-width="2"/><circle cx="0" cy="9" r="3" fill="#334155"/>`; }
      out += text(0, 36, display.values ? format(v, unit) : symbol, 12);
    }
    if (display.values && v !== null && Math.abs(v) > c.params.range) out += text(0, -43, "超量程", 13, 'fill="#b91c1c"');
    return shell + `<g transform="rotate(${-(c.angle || 0)})">${out}</g>`;
  }
  function body(c, result, display) {
    const schematic = display.view === "schematic", p = c.params; if(typeof R.get(c.type).render === "function") return R.get(c.type).render(c,result,display);
    const leads = '<path d="M-60 0H-35 M35 0H60" stroke="#475569" stroke-width="3" fill="none"/>';
    if (["ammeter", "voltmeter", "wattmeter"].includes(c.type)) {
      let lines = c.type === "wattmeter" ? `<path d="${schematic ? "M-60-20H-27 M27-20H60 M-60 40H-24V24 M24 24V40H60" : "M-60-20H-36 M36-20H60 M-60 40H-34 M34 40H60"}" stroke="#475569" stroke-width="3" fill="none" stroke-linejoin="round"/>` : leads;
      if (schematic) return lines + '<circle r="34" fill="#fff" stroke="#334155" stroke-width="2"/>' + `<g transform="rotate(${-(c.angle || 0)})">${text(0,6,R.get(c.type).icon,22)}</g>`;
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
      let out = `<ellipse cy="-28" rx="37" ry="41" fill="#ffc95c" opacity="${glow*.2}"/><rect x="-37" y="22" width="74" height="15" rx="6" fill="#e2e9ef" stroke="#9eafbc" stroke-width="1.5"/><path d="M-30 31H30" stroke="#c4d0d9" stroke-width="2"/>`;
      out += `<path d="M-11-9C-11-18-24-20-24-34C-24-63 24-63 24-34C24-20 11-18 11-9Z" fill="${glow>.04 ? "#ffe4a0" : "#f4f8f9"}" stroke="#9bb2bf" stroke-width="2"/><path d="M-16-37C-16-45-9-48-5-48" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M-7-8V-26L-10-31L-6-35L-2-29L2-35L6-29L10-33L7-26V-8" fill="none" stroke="${glow>.1 ? "#da8225" : "#8c7966"}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      out += '<path d="M-12-9H12V10Q12 13 8 13H-8Q-12 13-12 10Z" fill="#a8b5bf" stroke="#677c8c" stroke-width="1.5"/><path d="M-11-4H11 M-11 2H11 M-10 8H10" stroke="#6f8290" stroke-width="1.5"/><path d="M-6 14H6" stroke="#45586a" stroke-width="4"/><circle cy="18" r="3" fill="#b78b51"/>';
      out += `<path data-leads="lamp" d="M-60 0H-12 M60 0H40V18H0" ${metal}/>` + screw(-46) + screw(46);
      if (p.model === "thermal") out += text(0,-64,"熱效應",10,'fill="#986429"');
      return out;
    }
    return leads;
  }
  function scene(doc, result, scale = 1, routes = {}, selection = null) {
    const size = (doc.display.projection ? 18 : 14) / scale, max = Math.max(1, ...Object.values(result.potentials).filter((v) => v !== null).map(Math.abs));
    let out = '';
    doc.wires.forEach((w) => {
      const points = routes[w.id] || Routing.route(doc, w), colourValue = doc.display.potential ? colour(result.wires[w.id]?.potential, max) : "#50677e", d = Routing.path(points);
      out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${9 / scale}" stroke-linejoin="round"/><path data-wire="${w.id}" d="${d}" fill="none" stroke="${selection === w.id ? "#2563eb" : colourValue}" stroke-width="${(selection === w.id ? 4 : 3) / scale}" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    doc.junctions.forEach((j) => { const v = result.potentials[j.id + ":p"]; out += `<circle cx="${j.x}" cy="${j.y}" r="${5 / scale}" fill="${doc.display.potential ? colour(v, max) : "#334155"}"/>`; });
    doc.components.forEach((c) => {
      const r = result.components[c.id], isMeter = ["ammeter", "voltmeter", "wattmeter"].includes(c.type);
      out += `<g data-component="${c.id}" transform="translate(${c.x} ${c.y}) rotate(${c.angle})">${selection === c.id ? '<rect x="-46" y="-47" width="92" height="98" rx="10" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5 3"/>' : ""}${body(c, r, doc.display)}</g>`;
      const labelY = c.y + (c.angle % 180 ? 87 : isMeter ? 85 : 66) + (doc.display.projection ? 8 : 0);
      out += text(c.x, labelY, c.label + (c.locked ? " · 固定" : ""), size);
      if (doc.display.values && isMeter && doc.display.view === "schematic") out += text(c.x,labelY+20/scale,format(r?.reading,r?.unit),12/scale);
      if (doc.display.values && !isMeter && scale >= .55) {
        const resistance = c.type === "lamp" && c.params.model === "thermal" ? r?.resistance : r?.resistance ?? R.effectiveResistance(c);
        let value = c.type === "battery" ? `E ${format(c.params.voltage, "V")} · r ${format(c.params.resistance, "Ω")}` : c.type === "switch" ? (c.params.closed ? "閉合" : "斷開") : `${format(resistance, "Ω")} · ${format(r?.power, "W")}`;
        out += text(c.x, labelY + 20 / scale, value, 12 / scale);
      }
      R.ports(c).forEach((p) => {
        const v = result.potentials[p.id]; out += `<circle cx="${p.x}" cy="${p.y}" r="${5 / scale}" fill="#fff" stroke="${doc.display.potential ? colour(v, max) : "#57728b"}" stroke-width="${2 / scale}"/>`;
        if (isMeter) out += text(p.x, p.y - 12 / scale, p.label, 11 / scale);
      });
      if (doc.display.potential && r?.voltage !== null && Math.abs(r?.voltage || 0) > 1e-8) {
        const a = R.ports(c)[0], b = R.ports(c)[1], from = r.voltage > 0 ? b : a, to = r.voltage > 0 ? a : b;
        const mx = c.x, my = c.y - 58, direction = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
        out += `<g transform="translate(${mx} ${my}) rotate(${direction})"><path d="M-20 0H20 M12-5L20 0L12 5" stroke="#b36b14" stroke-width="${1.8 / scale}" fill="none"/></g>` + text(mx, my - 10 / scale, "電勢升高", 11 / scale);
      }
    });
    return out;
  }
  function flow(doc, result, routes, time, scale) {
    if (doc.display.flow === "off") return ""; let out = '';
    doc.wires.forEach((w) => {
      const current = result.wires[w.id]?.current; if (current === null || Math.abs(current || 0) < 1e-9) return;
      const points = routes[w.id], length = points.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0), spacing = 65 / scale, electron = doc.display.flow === "electron", reverse = (current < 0) !== electron;
      for (let distance = (time * 30 / scale) % spacing; distance < length; distance += spacing) {
        const p = Routing.along(points, reverse ? length - distance : distance); if (!p) continue;
        if (electron) out += `<circle cx="${p.x}" cy="${p.y}" r="${6 / scale}" fill="#2563eb"/><path d="M${p.x - 3 / scale} ${p.y}h${6 / scale}" stroke="#fff" stroke-width="${1.5 / scale}"/>`;
        else out += `<path transform="translate(${p.x} ${p.y}) rotate(${p.angle + (reverse ? 180 : 0)})" d="M${-6 / scale} ${-4 / scale}L${2 / scale} 0L${-6 / scale} ${4 / scale}" stroke="#2563eb" stroke-width="${2 / scale}" fill="none"/>`;
      }
    });
    return out;
  }
  return { scene, flow, body, text, format, esc, colour };
});
