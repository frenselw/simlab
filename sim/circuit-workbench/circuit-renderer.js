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
    let out = '<rect x="-43" y="-36" width="86" height="78" rx="12" fill="#eef4fa" stroke="#446482" stroke-width="2"/>';
    if (display.meters === "digital") { out += '<rect x="-35" y="-26" width="70" height="38" rx="5" fill="#dce9df"/>'; out += text(0, -1, display.values ? format(v) : symbol, 16, 'font-family="monospace"'); out += text(0, 30, unit, 14); }
    else {
      out += '<path d="M-32 9 A32 32 0 0 1 32 9" fill="#fff" stroke="#94a3b8"/>';
      for (let n = 0; n <= 8; n++) { const a = Math.PI * (1 - n / 8); out += `<path d="M${Math.cos(a) * 28},${9 - Math.sin(a) * 28} L${Math.cos(a) * 32},${9 - Math.sin(a) * 32}" stroke="#64748b"/>`; }
      out += text(-28, 22, format(-c.params.range), 9) + text(0, -14, "0", 10) + text(28, 22, format(c.params.range), 9);
      if (display.values && v !== null && v !== undefined) { const a = Math.PI * (.5 - Math.max(-1, Math.min(1, v / c.params.range)) * .45); out += `<path d="M0 9 L${Math.cos(a) * 27},${9 - Math.sin(a) * 27}" stroke="#dc2626" stroke-width="2"/><circle cx="0" cy="9" r="3" fill="#334155"/>`; }
      out += text(0, 36, display.values ? format(v, unit) : symbol, 12);
    }
    if (display.values && v !== null && Math.abs(v) > c.params.range) out += text(0, -43, "超量程", 13, 'fill="#b91c1c"');
    return out;
  }
  function body(c, result, display) {
    const schematic = display.view === "schematic", p = c.params; if(typeof R.get(c.type).render === "function") return R.get(c.type).render(c,result,display);
    const leads = '<path d="M-60 0H-35 M35 0H60" stroke="#475569" stroke-width="3" fill="none"/>';
    if (["ammeter", "voltmeter", "wattmeter"].includes(c.type)) {
      let lines = c.type === "wattmeter" ? '<path d="M-60-20H-43 M43-20H60 M-60 40H-43 M43 40H60" stroke="#475569" stroke-width="3"/>' : leads;
      if (schematic) return lines + '<circle r="34" fill="#fff" stroke="#334155" stroke-width="2"/>' + text(0, 6, R.get(c.type).icon, 22) + (display.values ? text(0, 57, format(result?.reading, result?.unit), 14) : "");
      return lines + meter(c, result, display);
    }
    if (c.type === "battery") return leads + (schematic ? `<path d="M${-10*p.polarity}-25V25 M${10*p.polarity}-13V13 M-35 0H-10 M10 0H35" stroke="#334155" stroke-width="3"/>` : '<rect x="-36" y="-23" width="72" height="46" rx="9" fill="#c7dff7" stroke="#446482" stroke-width="2"/><path d="M-22-22V22" stroke="#538bc5" stroke-width="8"/>' + text(5, 6, "DC", 16)) + text(-23 * p.polarity, -30, "+", 16) + text(23 * p.polarity, -30, "−", 16);
    if (c.type === "resistor" || c.type === "rheostat") {
      let out = leads + `<rect x="-35" y="-14" width="70" height="28" rx="${schematic ? 0 : 7}" fill="${schematic ? "#fff" : "#ead8b4"}" stroke="#6b5948" stroke-width="2"/>`;
      if (!schematic) out += '<path d="M-20-13V13 M-7-13V13 M6-13V13 M23-13V13" stroke="#9b5b3c" stroke-width="5"/>';
      if (c.type === "rheostat") out += `<path d="M-30 38H30" stroke="#a6bace" stroke-width="4"/><circle cx="${-30 + c.params.position * 60}" cy="38" r="7" fill="#2563eb"/><path d="M-18 25L22-28 M10-26L22-28L20-16" stroke="#2563eb" stroke-width="3" fill="none"/>`;
      return out;
    }
    if (c.type === "switch") return '<path d="M-60 0H-26 M26 0H60" stroke="#475569" stroke-width="3"/>' + (schematic ? "" : '<rect x="-38" y="-19" width="76" height="38" rx="8" fill="#e0e9e1" stroke="#96ab9d"/>') + `<path d="M-26 0L26 ${p.closed ? 0 : -24}" stroke="${p.closed ? "#2f7651" : "#d97706"}" stroke-width="5" stroke-linecap="round"/><circle cx="-26" cy="0" r="4" fill="#334155"/><circle cx="26" cy="0" r="4" fill="#334155"/>`;
    if (c.type === "lamp") {
      const rated = p.ratedVoltage ** 2 / p.resistance, glow = Math.max(0, Math.min(1, (result?.power || 0) / rated));
      return leads + (schematic ? `<circle r="28" fill="#fff" stroke="#334155" stroke-width="2"/><path d="M-19-19L19 19M19-19L-19 19" stroke="#334155" stroke-width="2"/>` : `<circle cy="-5" r="37" fill="#fbbf24" opacity="${glow * .15}"/><circle cy="-5" r="25" fill="${glow > .05 ? "#ffdf7b" : "#f4f0df"}" stroke="#bca35d" stroke-width="2"/><path d="M-12 12L-6-8L0 2L6-8L12 12" stroke="${glow > .1 ? "#d98613" : "#928772"}" stroke-width="2" fill="none"/><rect x="-12" y="17" width="24" height="15" rx="3" fill="#88939c"/>`) + (p.model === "thermal" ? text(0, -40, "熱", 12, 'fill="#9a5b14"') : "");
    }
    return leads;
  }
  function scene(doc, result, scale = 1, routes = {}, selection = null) {
    const size = (doc.display.projection ? 18 : 14) / scale, max = Math.max(1, ...Object.values(result.potentials).filter((v) => v !== null).map(Math.abs));
    let out = '';
    doc.wires.forEach((w) => {
      const points = routes[w.id] || Routing.route(doc, w), colourValue = doc.display.potential ? colour(result.wires[w.id]?.potential, max) : "#50677e", d = Routing.path(points);
      out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${9 / scale}" stroke-linejoin="round"/><path data-wire="${w.id}" d="${d}" fill="none" stroke="${selection === w.id ? "#2563eb" : colourValue}" stroke-width="${(selection === w.id ? 4 : 3) / scale}" stroke-linejoin="round"/>`;
    });
    doc.junctions.forEach((j) => { const v = result.potentials[j.id + ":p"]; out += `<circle cx="${j.x}" cy="${j.y}" r="${5 / scale}" fill="${doc.display.potential ? colour(v, max) : "#334155"}"/>`; });
    doc.components.forEach((c) => {
      const r = result.components[c.id], isMeter = ["ammeter", "voltmeter", "wattmeter"].includes(c.type);
      out += `<g data-component="${c.id}" transform="translate(${c.x} ${c.y}) rotate(${c.angle})">${selection === c.id ? '<rect x="-46" y="-47" width="92" height="98" rx="10" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5 3"/>' : ""}${body(c, r, doc.display)}</g>`;
      const labelY = c.y + (c.angle % 180 ? 87 : isMeter ? 85 : 66) + (doc.display.projection ? 8 : 0);
      out += text(c.x, labelY, c.label + (c.locked ? " · 固定" : ""), size);
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
