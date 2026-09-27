(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.NewtonModel,
    typeof module === "object" && module.exports ? require("./fitting.js") : root.NewtonFitting);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonGraph = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, F) {
  "use strict";
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = n => Number(n.toFixed(3)).toString();
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function geometry(width, height, range) {
    const large = width >= 650 && height >= 360, left = large ? 86 : 58, right = width - (large ? 66 : 56), top = large ? 88 : 71, bottom = height - (large ? 66 : 43);
    const intervals = Math.max(1, Math.min(6, Math.floor((bottom - top) / ((large ? 20 : 14) * 1.2))));
    const majorY = [.025, .05, .1, .2, .25, .5, 1, 1.5, 2, 3].find(v => v >= range.y / intervals - 1e-12) || 3;
    return { width, height, left, right, top, bottom, plotWidth: right - left, plotHeight: Math.max(30, bottom - top), range, font: large ? 20 : 14, majorY, minorY: majorY / 5, majorX: range.x === 1.4 ? .2 : .5, minorX: range.x === 1.4 ? .05 : .1 };
  }
  const pixel = (g, p) => ({ x: g.left + p[0] / g.range.x * g.plotWidth, y: g.bottom - p[1] / g.range.y * g.plotHeight });
  const data = (g, p) => [(p.x - g.left) / g.plotWidth * g.range.x, (g.bottom - p.y) / g.plotHeight * g.range.y];
  const inside = (g, p) => p.x >= g.left && p.x <= g.right && p.y >= g.top && p.y <= g.bottom;
  const encoded = p => p.map(v => Math.round(v * 10000));
  function handle(g, p) { const raw = pixel(g, p); return { x: clamp(raw.x, g.left, g.right), y: clamp(raw.y, g.top, g.bottom), offscale: !inside(g, raw) }; }
  function snap(g, position, known, pointerType, held = null) {
    const radius = pointerType === "mouse" ? 6 : 10, exit = pointerType === "mouse" ? 9 : 14;
    const distance = point => { const q = pixel(g, point); return Math.hypot(position.x - q.x, position.y - q.y); };
    // A nearby reading takes priority over a held grid intersection, especially on dense phone grids.
    if (known && distance(known) <= radius) return { point: known, held: known };
    if (held && distance(held) <= exit) return { point: held, held };
    const raw = data(g, position), grid = [Math.round(raw[0] / g.minorX) * g.minorX, Math.round(raw[1] / g.minorY) * g.minorY];
    const target = known && distance(known) <= radius ? known : inside(g, pixel(g, grid)) && distance(grid) <= radius ? grid : null;
    return { point: (target || raw).map((v, i) => clamp(v, 0, i ? g.range.y : g.range.x)), held: target };
  }
  function svg(state, graph, g, selected = -1, working = null, reference = false) {
    const parts = [], text = (x, y, content, attrs = "") => `<text x="${x}" y="${y}" ${attrs.includes("font-size=") ? "" : `font-size="${g.font}"`} ${attrs}>${content}</text>`;
    parts.push(`<defs><clipPath id="plot-clip"><rect x="${g.left}" y="${g.top}" width="${g.plotWidth}" height="${g.plotHeight}"/></clipPath></defs>`);
    for (let x = 0; x <= g.range.x + 1e-9; x += g.minorX) {
      const px = pixel(g, [x, 0]).x, major = Math.abs(x / g.majorX - Math.round(x / g.majorX)) < 1e-7;
      parts.push(`<path d="M${px} ${g.top}V${g.bottom}" class="${major ? "grid-major" : "grid-minor"}"/>`);
      if (major) parts.push(text(px, g.bottom + g.font + 5, fmt(x), 'text-anchor="middle"'));
    }
    for (let y = 0; y <= g.range.y + 1e-9; y += g.minorY) {
      const py = pixel(g, [0, y]).y, major = Math.abs(y / g.majorY - Math.round(y / g.majorY)) < 1e-7;
      parts.push(`<path d="M${g.left} ${py}H${g.right}" class="${major ? "grid-major" : "grid-minor"}"/>`);
      if (major) parts.push(text(g.left - 9, py + g.font * .34, fmt(y), 'text-anchor="end"'));
    }
    parts.push(`<path d="M${g.left} ${g.top - 8}V${g.bottom}H${g.right + 8}" class="axis"/>`);
    parts.push(text(g.left, g.top - 13, '<tspan class="variable">a</tspan> / (m/s²)'));
    const xTitle = graph === 0 ? '<tspan class="variable">F</tspan><tspan baseline-shift="sub" font-size="70%">合</tspan> / N' : graph === 1 ? '<tspan class="variable">m</tspan> / kg' : '1/<tspan class="variable">m</tspan> / kg⁻¹';
    parts.push(text((g.left + g.right) / 2, g.height - 7, xTitle, 'text-anchor="middle"'));
    const plot = state.plots[graph], rows = state.groups[M.sourceGroup(graph)].records;
    if (plot.fitAttempted) {
      const fit = F.fit(plot.model, F.plotted(plot));
      if (fit.ok) {
        let path = "", pen = false;
        for (let i = 0; i <= 360; i++) {
          const x = g.range.x * i / 360, y = F.predict(fit.model, fit.coefficients, x);
          if (!Number.isFinite(y) || Math.abs(y) > 1e5) { pen = false; continue; }
          const point = pixel(g, [x, y]); path += `${pen ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`; pen = true;
        }
        parts.push(`<path d="${path}" class="fit-curve" clip-path="url(#plot-clip)"/>`);
      }
    }
    if (reference) rows.forEach(r => { const p = pixel(g, M.expected(graph, r)); parts.push(`<circle cx="${p.x}" cy="${p.y}" r="7" class="reference-point"/>`); });
    const order = plot.points.map((_, i) => i).filter(i => i !== selected).concat(selected >= 0 ? [selected] : []);
    for (const i of order) {
      const actual = working && i === selected ? working : plot.points[i]?.map(v => v / 10000);
      if (!actual) continue;
      const p = handle(g, actual), active = i === selected;
      if (active) parts.push(`<path d="M${g.left} ${p.y}H${p.x}V${g.bottom}" class="projection"/>`);
      parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${active ? 6.5 : 5}" class="data-point ${active ? "selected" : ""}"/>`);
      if (p.offscale) parts.push(text(p.x, p.y + g.font + 11, "↥", 'text-anchor="middle"'));
      if (active) {
        const label = `#${i + 1} (${fmt(actual[0])}, ${fmt(actual[1])})${p.offscale ? " 超出圖框" : ""}`;
        const rightSide = p.x > (g.left + g.right) / 2;
        const labelWidth = [...label].reduce((sum, ch) => sum + g.font * (/[^\x00-\x7F]/.test(ch) ? 1 : .6), 0);
        const labelX = rightSide ? clamp(p.x - 10, labelWidth + 4, g.width - 4) : clamp(p.x + 10, 4, g.width - labelWidth - 4);
        parts.push(text(labelX, clamp(p.y - 12, g.top + 15, g.bottom - 8), escape(label), `class="point-label" text-anchor="${rightSide ? "end" : "start"}" font-size="${g.font}"`));
      }
    }
    if (!rows.length) parts.push(text((g.left + g.right) / 2, (g.top + g.bottom) / 2, "先回實驗頁記錄數據", 'text-anchor="middle" class="empty-plot"'));
    return parts.join("");
  }
  return Object.freeze({ clamp, fmt, escape, geometry, pixel, data, inside, encoded, handle, snap, svg });
});
