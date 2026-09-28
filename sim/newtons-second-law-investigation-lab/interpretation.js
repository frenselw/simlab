(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.NewtonModel,
    typeof module === "object" && module.exports ? require("./fitting.js") : root.NewtonFitting);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NewtonInterpretation = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, F) {
  "use strict";
  function analyze(state, graph, meaning = state.plots[graph].meaning) {
    const plot = state.plots[graph], fit = plot.fitAttempted ? F.fit(plot.model, F.plotted(plot)) : null;
    const kind = graph === 1 ? "反比例係數" : "直線斜率";
    if (!fit?.ok) return { available: false, kind, reason: "先用自己的點完成擬合，再查看係數及作比較。" };
    if (!(graph === 1 ? fit.model === "inverse" : ["linear", "origin"].includes(fit.model))) {
      return { available: false, kind, reason: graph === 1 ? "目前擬合不是反比例模型，不能把它的斜率當成反比例係數。" : "這裡以直線模型的係數 k 作比較。若二次項近乎零，可再用較簡單的直線模型比較。" };
    }
    const coefficient = fit.coefficients[0], unit = graph === 0 ? "kg⁻¹" : "N", inverseUnit = graph === 0 ? "kg" : "N⁻¹";
    const result = { available: true, kind, coefficient, unit, intercept: fit.model === "linear" ? fit.coefficients[1] : null, conversion: null };
    if (!M.MEANINGS.some(([value]) => value === meaning)) return result;
    const inverse = meaning.startsWith("inverse-"), quantity = meaning.endsWith("mass") ? "mass" : "force";
    const value = inverse ? 1 / coefficient : coefficient;
    // Carry the coefficient's real units through the learner's chosen operation.
    // Never replace them with the units implied by an incorrect interpretation.
    result.conversion = { inverse, quantity, value: coefficient > 0 && Number.isFinite(value) ? value : null,
      unit: inverse ? inverseUnit : unit, referenceUnit: quantity === "mass" ? "kg" : "N",
      references: [...new Set(state.groups[M.sourceGroup(graph)].records.map(r => quantity === "mass" ? M.mass(r[0]) : M.force(r[1])))].sort((a, b) => a - b) };
    return result;
  }
  return Object.freeze({ analyze });
});
