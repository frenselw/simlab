(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.EquilibriumModel,
    typeof module === "object" && module.exports ? require("./notation.js") : root.EquilibriumNotation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquilibriumScene = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, N) {
  "use strict";
  const unit = angle => ({ x: Math.cos(angle * Math.PI / 180), y: -Math.sin(angle * Math.PI / 180) });
  const point = (c, a, r) => { const u = unit(a); return { x: c.x + u.x * r, y: c.y + u.y * r }; };
  const xy = p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const line = (a, b, attrs = "") => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs}/>`;
  function arrowPath(start, end, scale = 1) {
    const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
    if (length < .01) return "";
    const u = { x: dx / length, y: dy / length }, n = { x: -u.y, y: u.x };
    const head = Math.min(14 * scale, length * .4), half = Math.min(6 * scale, length * .18), shaft = 1.7 * scale;
    const base = { x: end.x - u.x * head, y: end.y - u.y * head };
    return [
      { x: start.x + n.x * shaft, y: start.y + n.y * shaft },
      { x: base.x + n.x * shaft, y: base.y + n.y * shaft },
      { x: base.x + n.x * half, y: base.y + n.y * half }, end,
      { x: base.x - n.x * half, y: base.y - n.y * half },
      { x: base.x - n.x * shaft, y: base.y - n.y * shaft },
      { x: start.x - n.x * shaft, y: start.y - n.y * shaft }
    ].map((p, i) => `${i ? "L" : "M"}${xy(p)}`).join(" ") + " Z";
  }
  function edgeRadius(angle, rotation, halfWidth, halfHeight) {
    const u = unit(angle - rotation);
    return Math.min(halfWidth / Math.max(1e-8, Math.abs(u.x)), halfHeight / Math.max(1e-8, Math.abs(u.y)));
  }
  function sceneMarkup(q, l) {
    const { width: w, height: h, center: c, displayScale: scale } = l;
    const slope = ["A", "D"].includes(q.family) ? q.params.sign * q.params.theta : 0;
    const blockWidth = Math.min(100, Math.max(66, w * .14)) * scale, blockHeight = blockWidth * .59;
    const normal = unit(90 + slope), foot = { x: c.x - normal.x * blockHeight / 2, y: c.y - normal.y * blockHeight / 2 };
    let html = `<rect width="${w}" height="${h}" fill="#fff"/>`;
    if (q.surface !== "none") {
      const y = x => foot.y - Math.tan(slope * Math.PI / 180) * (x - foot.x);
      html += `<path d="M-5,${y(-5)} L${w + 5},${y(w + 5)} L${w + 5},${h} L-5,${h}Z" fill="${q.surface === "rough" ? "#f2eee6" : "#edf4f7"}"/>`;
      html += line({ x: -5, y: y(-5) }, { x: w + 5, y: y(w + 5) }, 'stroke="#64748b" stroke-width="2.5"');
      html += '<g data-background="ground">';
      if (q.surface === "rough") for (let x = -144; x < w + 144; x += 18)
        html += line({ x, y: y(x) + 4 }, { x: x - 6, y: y(x) + 12 }, 'stroke="#c7c3b8" stroke-width="1.4"');
      if (q.motion) {
        // A continuous floor strip gives a ground reference without upright
        // scenery competing with the force diagram. Every motif repeats at 144px.
        const top = foot.y + 18 * scale, bottom = top + 26 * scale, slant = 18 * scale;
        const fill = q.surface === "rough" ? "#e5dfd4" : "#dbe8ee", seam = q.surface === "rough" ? "#d3cbbb" : "#c2d5df";
        for (let x = -288; x < w + 144; x += 144) {
          html += `<path d="M${x},${top}h100l${-slant},${bottom - top}h-100Z" fill="${fill}"/>`;
          html += line({ x, y: top }, { x: x - slant, y: bottom }, `stroke="${seam}" stroke-width="1.5"`);
        }
      }
      html += "</g>";
    }
    const reach = angle => {
      const u = unit(angle), dx = u.x > 0 ? w - 18 - c.x : c.x - 18, dy = u.y > 0 ? h - 30 - c.y : c.y - 50;
      return Math.max(48, Math.min(dx / Math.max(Math.abs(u.x), 1e-6), dy / Math.max(Math.abs(u.y), 1e-6)));
    };
    q.ropes.forEach(a => {
      const start = point(c, a, edgeRadius(a, slope, blockWidth / 2, blockHeight / 2)), end = point(c, a, reach(a));
      html += line(start, end, `class="scene-rope" stroke="#8a7759" stroke-width="${3 * scale}"`);
      if (q.family !== "B") html += `<path d="M${end.x - 9},${end.y - 4}h18m-14,0l-4,-6m11,6l-4,-6m11,6l-4,-6" fill="none" stroke="#64748b" stroke-width="2"/>`;
      else html += `<circle cx="${end.x}" cy="${end.y}" r="6" fill="#f7dcc1" stroke="#92755a" stroke-width="1.5"/>`;
    });
    q.rods.forEach((f, i) => {
      const a = f.angle + 180, start = point(c, a, edgeRadius(a, 0, blockWidth / 2, blockHeight / 2) + 2), end = point(c, a, reach(a) - 8);
      html += line(start, end, `class="scene-rod" stroke="#94a3b8" stroke-width="${6 * scale}" stroke-linecap="round"`);
      const label = point(c, a, reach(a));
      html += `<text class="rod-label" x="${label.x}" y="${Math.max(42 + 16 * scale, label.y - 7 * scale)}" text-anchor="middle" font-size="${14 * scale}" font-family="system-ui" fill="#475569">${"ABC"[i]}</text>`;
    });
    html += `<g class="object" transform="translate(${c.x} ${c.y}) rotate(${-slope})"><rect x="${-blockWidth / 2}" y="${-blockHeight / 2}" width="${blockWidth}" height="${blockHeight}" rx="4" fill="#dbeafe" stroke="#476b96" stroke-width="2"/><path d="M${-blockWidth / 2 + 7},${-blockHeight / 2 + 6}h${blockWidth - 14}" stroke="#fff" stroke-width="2"/></g>`;
    html += `<circle class="center-mark" cx="${c.x}" cy="${c.y}" r="${3.5 * scale}" fill="#334155"/>`;
    const rotation = slope * Math.PI / 180;
    const bodyWidth = Math.abs(Math.cos(rotation)) * blockWidth + Math.abs(Math.sin(rotation)) * blockHeight + 12 * scale;
    const bodyHeight = Math.abs(Math.sin(rotation)) * blockWidth + Math.abs(Math.cos(rotation)) * blockHeight + 12 * scale;
    return { html, body: { x: c.x - bodyWidth / 2, y: c.y - bodyHeight / 2, width: bodyWidth, height: bodyHeight } };
  }
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  function labelPositions(records, l, body) {
    const scale = l.displayScale;
    const boxes = [], entries = records.map((r, i) => r[1] === null ? null : { record: r, i, end: M.endpoint(r, l), label: N.label(records, i) }).filter(Boolean);
    return entries.map(entry => {
      const u = unit(entry.record[1] / 10), n = { x: -u.y, y: u.x }, width = (entry.label.sub ? 27 : 19) * scale, height = 21 * scale;
      const options = [];
      for (const side of [1, -1]) for (const offset of [15, 28, 42]) for (const along of [9, -12]) {
        const x = M.clamp(entry.end.x + n.x * offset * side * scale + u.x * along * scale - width / 2, 6, l.width - width - 6);
        const y = M.clamp(entry.end.y + n.y * offset * side * scale + u.y * along * scale - height / 2, 43, l.height - height - 20);
        const b = { x, y, width, height };
        let penalty = (overlap(b, body) ? 200 : 0) + boxes.filter(other => overlap(b, other)).length * 500 + offset;
        // Penalize labels covering any arrow shaft, not just another label.
        for (const arrow of entries) {
          for (let t = .25; t <= 1; t += .15) {
            const p = { x: l.center.x + (arrow.end.x - l.center.x) * t, y: l.center.y + (arrow.end.y - l.center.y) * t };
            if (p.x >= b.x - 3 && p.x <= b.x + b.width + 3 && p.y >= b.y - 3 && p.y <= b.y + b.height + 3) penalty += 55;
          }
        }
        options.push({ b, penalty });
      }
      options.sort((a, b) => a.penalty - b.penalty); boxes.push(options[0].b);
      return { ...entry, box: options[0].b };
    });
  }
  function render(svg, q, l, records, selected = -1, guideAngle = null) {
    const scale = l.displayScale;
    svg.setAttribute("viewBox", `0 0 ${l.width} ${l.height}`);
    const base = sceneMarkup(q, l);
    let html = base.html;
    if (guideAngle !== null) html += line(point(l.center, guideAngle, -55 * scale), point(l.center, guideAngle, 95 * scale), 'stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 4"');
    const positions = labelPositions(records, l, base.body);
    html += '<g class="student-arrows">';
    for (const { i, end, label } of positions) html += `<path data-arrow="${i}" d="${arrowPath(l.center, end, scale)}" fill="${label.color}" opacity="${selected === -1 || selected === i ? 1 : .82}"/><circle cx="${end.x}" cy="${end.y}" r="${2.5 * scale}" fill="#fff" stroke="${label.color}"/>`;
    html += "</g><g class=\"force-labels\">";
    for (const { box, label } of positions) html += `<text class="force-label" x="${box.x + box.width / 2}" y="${box.y + 16 * scale}" text-anchor="middle" font-size="${18 * scale}" fill="${label.color}" stroke="#fff" stroke-width="${4 * scale}" paint-order="stroke" stroke-linejoin="round">${label.symbol}${label.sub ? `<tspan font-size="${12 * scale}" dy="${4 * scale}" font-style="normal">${label.sub}</tspan>` : ""}</text>`;
    svg.innerHTML = html + "</g>";
  }
  function animate(svg, elapsed, motion) {
    const ground = svg.querySelector('[data-background="ground"]');
    if (ground) ground.setAttribute("transform", `translate(${M.backgroundOffset(elapsed, motion)} 0)`);
  }
  return Object.freeze({ arrowPath, sceneMarkup, labelPositions, render, animate, unit, point });
});
