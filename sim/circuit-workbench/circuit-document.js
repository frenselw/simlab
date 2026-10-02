(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./circuit-model.js") : root.CircuitModel);
  if (typeof module === "object" && module.exports) module.exports = api; else root.CircuitDocument = api;
})(globalThis, function (M) {
  "use strict";
  const bytes = (s) => typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : Buffer.byteLength(s, "utf8");
  function encode(doc) { const text = JSON.stringify(M.validate(doc), null, 2); if (bytes(text) > M.limits.bytes) throw new Error("電路檔超出 256 KiB 限制"); return text; }
  function decode(text) { if (typeof text !== "string" || bytes(text) > M.limits.bytes) throw new Error("電路檔過大或無效"); let data; try { data = JSON.parse(text); } catch { throw new Error("電路檔不是有效的 JSON"); } return M.validate(data); }
  function template(doc) { const copy = M.validate(doc); copy.wires = []; copy.junctions = []; copy.display.reference = null; copy.policy.mode = "wiring"; return copy; }
  return { encode, decode, template, bytes };
});
