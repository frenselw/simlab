(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonFitting = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  function qr(columns, ys) {
    const q = [], r = columns.map(() => columns.map(() => 0)); let largest = 0;
    for (let j = 0; j < columns.length; j++) {
      const v = columns[j].slice();
      // Reorthogonalization keeps nearly dependent columns from becoming false evidence.
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < j; i++) {
        const d = dot(q[i], v); r[i][j] += d; for (let k = 0; k < v.length; k++) v[k] -= d * q[i][k];
      }
      r[j][j] = Math.hypot(...v); largest = Math.max(largest, r[j][j]);
      if (r[j][j] <= 1e-10 * largest) return null;
      q.push(v.map(x => x / r[j][j]));
    }
    const beta = q.map(v => dot(v, ys));
    for (let j = beta.length - 1; j >= 0; j--) {
      for (let k = j + 1; k < beta.length; k++) beta[j] -= r[j][k] * beta[k];
      beta[j] /= r[j][j];
    }
    return beta;
  }
  function predict(model, c, x) {
    if (model === "inverse") return x > 0 ? c[0] / x : NaN;
    if (model === "origin") return c[0] * x;
    if (model === "linear") return c[0] * x + c[1];
    return (c[0] * x + c[1]) * x + c[2];
  }
  function fit(model, input) {
    const points = input.filter(p => p !== null), n = points.length;
    const fail = message => ({ ok: false, model, n, message });
    if (!["linear", "origin", "quadratic", "inverse"].includes(model)) return fail("先選擇一種擬合方法。");
    if (points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) return fail("點位資料未能安全讀取。");
    const distinct = new Set(points.map(p => p[0])).size, required = model === "quadratic" ? 3 : 2;
    if (n < required || distinct < required) return fail(`這個模型至少需要 ${required} 個不同橫座標的已放點。`);
    if (model === "inverse" && points.some(p => p[0] <= 0)) return fail("反比例模型需要每個橫座標大於 0；請先檢查點位。");
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]); let coefficients;
    if (model === "origin" || model === "inverse") {
      const z = xs.map(x => model === "inverse" ? 1 / x : x), den = dot(z, z);
      if (!(den > 0) || !Number.isFinite(den)) return fail("目前點位未能確定有限的擬合係數。");
      coefficients = [dot(z, ys) / den];
    } else {
      const center = xs.reduce((a, b) => a + b, 0) / n, scale = Math.max(...xs.map(x => Math.abs(x - center)));
      const z = xs.map(x => (x - center) / scale), columns = [xs.map(() => 1), z];
      if (model === "quadratic") columns.push(z.map(x => x * x));
      const beta = qr(columns, ys);
      if (!beta) return fail("這組點的橫座標太接近，未能可靠確定擬合曲線。");
      if (model === "linear") coefficients = [beta[1] / scale, beta[0] - beta[1] * center / scale];
      else { const p = beta[2] / scale ** 2; coefficients = [p, beta[1] / scale - 2 * p * center, beta[0] - beta[1] * center / scale + p * center ** 2]; }
    }
    if (!coefficients.every(Number.isFinite)) return fail("未能得到有限的擬合係數，請檢查點位。");
    const rmse = Math.sqrt(points.reduce((sum, p) => sum + (p[1] - predict(model, coefficients, p[0])) ** 2, 0) / n);
    if (!Number.isFinite(rmse)) return fail("擬合結果超出可計算範圍。");
    return { ok: true, model, coefficients, n, rmse, minX: Math.min(...xs), maxX: Math.max(...xs) };
  }
  const plotted = plot => plot.points.map(p => p === null ? null : p.map(v => v / 10000));
  return Object.freeze({ qr, predict, fit, plotted });
});
