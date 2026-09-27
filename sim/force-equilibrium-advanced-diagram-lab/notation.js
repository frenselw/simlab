(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AdvancedEquilibriumNotation = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const names = ["重力", "支持力", "摩擦力", "繩拉力", "外加推力", "彈簧彈力"];
  const symbols = ["G", "N", "f", "T", "F", "F"];
  const colors = ["#168442", "#c02674", "#d93434", "#b86c00", "#7e3bb6", "#0369a1"];
  function label(records, i) {
    const kind = records[i][0], count = records.filter(r => r[0] === kind).length;
    const ordinal = count > 1 ? String(records.slice(0, i + 1).filter(r => r[0] === kind).length) : "";
    return { name: names[kind], symbol: symbols[kind], sub: (kind === 5 ? "s" : "") + ordinal, ordinal, color: colors[kind] };
  }
  function html(records, i) { const l = label(records, i); return `<var>${l.symbol}</var>${l.sub ? `<sub>${l.sub}</sub>` : ""}`; }
  function accessible(records, i) { const l = label(records, i); return `${l.name}${l.ordinal ? ` ${l.ordinal}` : ""}`; }
  function kindHtml(kind) { return `${symbols[kind]}${kind === 5 ? "<sub>s</sub>" : ""}`; }
  return Object.freeze({ names, symbols, colors, label, html, accessible, kindHtml });
});
