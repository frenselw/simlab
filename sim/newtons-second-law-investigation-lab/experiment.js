(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.NewtonModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonExperiment = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  function svg(width, height, settings, time, completed, group) {
    const [mi, fi] = settings, large = width >= 650 && height >= 360, s = large ? 1.7 : height < 210 ? .8 : 1;
    const motion = M.motion(mi, fi, time), trackLeft = 45 * s, trackRight = width - 35 * s, y = height * (height < 210 ? .67 : .69);
    const x = trackLeft + motion.position / 2 * (trackRight - trackLeft), cartW = 66 * s, cartH = 30 * s, cartY = y - 14 * s - cartH;
    const f = large ? 22 : 16, note = large ? 18 : 14, text = (px, py, value, extra = "") => `<text x="${px}" y="${py}" ${extra.includes("font-size=") ? "" : `font-size="${f}"`} ${extra}>${value}</text>`;
    const out = [text(18, 27, `實驗 ${group === 0 ? "A" : "B"} · ${completed ? "量測完成・定格" : time > 0 ? "量測中" : "由靜止開始"}`, 'font-weight="600"'),
      text(18, 51, "水平軌道 · 忽略摩擦及空氣阻力", `class="muted" font-size="${note}"`),
      `<path d="M${trackLeft - 22} ${y}H${trackRight + 12}" stroke="#65778b" stroke-width="${4 * s}"/>`];
    for (let i = 0; i <= 10; i++) {
      const tx = trackLeft + i / 10 * (trackRight - trackLeft);
      out.push(`<path d="M${tx} ${y + 5}v${i % 5 ? 5 : 9}" stroke="#9aa8b8"/>`);
      if (!(i % 5)) out.push(text(tx, y + 29 * s, `${(i / 5).toFixed(0)} m`, `text-anchor="middle" class="muted" font-size="${note}"`));
    }
    out.push(`<rect x="${x - cartW / 2}" y="${cartY}" width="${cartW}" height="${cartH}" rx="${6 * s}" fill="#dbeafe" stroke="#476f98" stroke-width="${2 * s}"/>`);
    for (const offset of [-21, 21]) out.push(`<circle cx="${x + offset * s}" cy="${y - 7 * s}" r="${7 * s}" fill="#64748b"/><circle cx="${x + offset * s}" cy="${y - 7 * s}" r="${3 * s}" fill="#f8fafc"/>`);
    for (let i = 0; i < mi; i++) out.push(`<rect x="${x - 27 * s + (i % 3) * 18 * s}" y="${cartY - 11 * s * (1 + Math.floor(i / 3))}" width="${16 * s}" height="${9 * s}" rx="2" fill="#b9c7d7" stroke="#71879e"/>`);
    out.push(text(x, cartY + 20 * s, `${M.mass(mi).toFixed(2)} kg`, `text-anchor="middle" font-size="${14 * s}"`));
    const start = x + cartW / 2 + 3 * s, end = start + (25 + 24 * M.force(fi)) * s, ay = cartY + cartH / 2;
    out.push(`<path d="M${start} ${ay - 2.5 * s}H${end - 9 * s}V${ay - 7 * s}L${end} ${ay}L${end - 9 * s} ${ay + 7 * s}V${ay + 2.5 * s}H${start}Z" fill="#2563a5"/>`);
    out.push(text(start > width / 2 ? end : start, ay - 15 * s, `<tspan class="variable">F</tspan><tspan baseline-shift="sub" font-size="70%">合</tspan> = ${M.force(fi).toFixed(2)} N`, `text-anchor="${start > width / 2 ? "end" : "start"}" font-size="${note * (large ? 1.1 : 1)}"`));
    out.push(text(18, height - 14, `t = ${time.toFixed(1)} s   ·   v = ${motion.velocity.toFixed(3)} m/s`, `class="muted" font-size="${note}"`));
    return out.join("");
  }
  function sensorSvg(record) {
    const a = record[2] / 1000, top = Math.ceil(a * 10) / 10 || .1;
    return `<svg viewBox="0 0 260 126" role="img" aria-label="速度隨時間均勻增加，斜率為量測加速度"><path d="M36 14V96H242" fill="none" stroke="#64748b"/><path d="M36 96L232 ${96 - a / top * 70}" stroke="#2563a5" stroke-width="2.5"/><g fill="#475569" font-size="13"><text x="7" y="14">v</text><text x="3" y="32">m/s</text><text x="28" y="112">0</text><text x="226" y="112">1</text><text x="190" y="125">t / s</text><text x="39" y="16">斜率 = ${a.toFixed(3)} m/s²</text></g></svg>`;
  }
  return Object.freeze({ svg, sensorSvg });
});
