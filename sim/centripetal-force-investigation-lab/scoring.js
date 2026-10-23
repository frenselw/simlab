(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.CentripetalModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentripetalScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";
  const roles = [
    { independent: "r", controls: ["m", "omega"] },
    { independent: "m", controls: ["r", "omega"] },
    { independent: "omega", controls: ["m", "r"] }
  ];
  const near = (input, target) => typeof input === "string" && input.length > 0 && /^\d*(?:\.\d*)?$/.test(input) &&
    Math.abs(Number(input) - target) <= Math.max(0.01, 0.02 * Math.abs(target)) + 1e-12;
  function fair(kind, run, rv = 3) {
    if (!run || new Set(run.q.map(q => M.slot(kind === "omega" ? q : Math.abs(q)))).size < 2) return false;
    const [rA, rB, nA, nB] = run.cfg;
    if (kind === "radius") return nA === nB && (rv >= 3 || rA !== rB);
    if (kind === "mass") return rA === rB && nA !== nB;
    return true;
  }
  function matchingRatio(kind, run) {
    const fixed = kind === "radius" ? 2 : 0;
    return run.cfg[fixed] === run.cfg[fixed + 1];
  }
  function comparison(kind, run, rv = 3) {
    if (!run || !run.fit || !M.fit(kind, run).ok) return "insufficient";
    if (kind === "omega") return "square";
    if (rv >= 5) return matchingRatio(kind, run) ? "supports" : "confounded";
    const [rA, rB, nA, nB] = run.cfg;
    if (kind === "radius") return rv < 3 && rA === rB ? "no-contrast" : nA !== nB ? "confounded" : "supports";
    return nA === nB ? "no-contrast" : rA !== rB ? "confounded" : "supports";
  }
  function coverage(kind, run) {
    const samples = run ? run.q.map(q => kind === "omega" ? q : Math.abs(q)) : [];
    const span = samples.length ? (Math.max(...samples) - Math.min(...samples)) / 1000 : 0;
    const slots = new Set(samples.map(M.slot)).size;
    const dataScore = slots >= 3 && span >= 1 ? 4 : slots >= 2 && span >= 0.5 ? 2 : 0;
    return { span, slots, dataScore };
  }
  function runResult(kind, run, rv) {
    const fairScore = fair(kind, run, rv) ? 4 : 0;
    const { span, slots, dataScore } = coverage(kind, run);
    const ratio = run ? kind === "radius" ? M.radius(run.cfg[0]) / M.radius(run.cfg[1]) :
      kind === "mass" ? M.mass(run.cfg[2]) / M.mass(run.cfg[3]) : 4 : null;
    const numericScore = ratio !== null && near(run.a[0], ratio) ? 4 : 0;
    const actualFit = run?.fit ? M.fit(kind, run) : null;
    const expectedComparison = comparison(kind, run, rv);
    const expectedReason = kind === "omega" || run && (rv >= 5 ? matchingRatio(kind, run) : fair(kind, run, rv)) ? "coefficient" : "uncertain";
    const comparisonScore = actualFit?.ok && run.a[1] === expectedComparison ? (rv >= 6 ? 6 : 3) : 0;
    const reasonScore = rv < 6 && actualFit?.ok && run.a[2] === expectedReason ? 3 : 0;
    const fitScore = comparisonScore + reasonScore;
    return { fairScore, dataScore, numericScore, fitScore, comparisonScore, reasonScore, expectedComparison, expectedReason,
      score: fairScore + dataScore + numericScore + fitScore, fit: actualFit, ratio, span, slots, fair: fair(kind, run, rv) };
  }
  function roleCredits(state, i) {
    const task = state.tasks[i], [independent, controls] = task.roles, expected = roles[i];
    return state.rv >= 2 && i < 2 ?
      [task.inquiry[0] === (i === 0 ? "equal-mass" : "equal-radius") ? 3 : 0, state.rv < 7 && task.inquiry[1] === "ratio-steady" ? 3 : 0] :
      [independent === expected.independent ? 2 : 0, expected.controls.filter(key => controls?.includes(key)).length * 2];
  }
  function page(state, i) {
    const task = state.tasks[i], kind = M.KINDS[i];
    const roleScores = roleCredits(state, i), roleScore = roleScores[0] + roleScores[1];
    const lawMax = state.rv >= 7 && i < 2 ? 9 : 6;
    const lawScore = task.law === (kind === "omega" ? "square" : "linear") ? lawMax : 0;
    if (state.rv < 4) {
      const result = runResult(kind, task.selected === null ? null : task.runs[task.selected], state.rv);
      return { ...result, roleScores, roleScore, lawScore, lawMax, score: roleScore + lawScore + result.score };
    }
    const runs = [0, 1].map(index => runResult(kind, task.runs[index], state.rv));
    const credit = key => runs.reduce((sum, run) => sum + run[key] / 2, 0);
    return { roleScores, roleScore, lawScore, lawMax, fairScore: credit("fairScore"), dataScore: credit("dataScore"),
      numericScore: credit("numericScore"), fitScore: credit("fitScore"), runs,
      score: roleScore + lawScore + credit("score") };
  }
  function score(state) {
    const pages = M.KINDS.map((_, i) => page(state, i));
    const syncScore = state.sync === "same-omega" ? 5 : 0;
    const massPartsScore = state.massParts === "cap-screw-weights" ? 5 : 0;
    const total = pages.reduce((sum, item) => sum + item.score, 0) + syncScore + massPartsScore;
    return { score: total, maxScore: 100, passed: total >= 60, completed: true,
      detail: { pages, syncScore, massPartsScore } };
  }

  function feedback(state) {
    const result = score(state), rv = state.rv;
    const text = (options, key) => key == null || key === "" ? "未作答" : options[key] || key;
    const variable = { m: "總質量", r: "半徑", omega: "角速度", force: "徑向力" };
    const setup = { "equal-mass": "質量相同，避免質量差異影響兩側徑向力的比值", "equal-radius": "半徑相同，避免半徑差異影響兩側徑向力的比值", "equal-force": "先把兩個力調成相同", "different-both": "質量和半徑都要不同" };
    const prediction = { "ratio-steady": "兩側徑向力隨轉速改變，但兩者的比值保持不變", "forces-steady": "兩側徑向力都保持不變", "ratio-speed": "兩側徑向力的比值隨轉速增大", unrelated: "兩側徑向力沒有固定比例" };
    const law = { linear: "徑向力與角速度成正比", square: "徑向力與角速度的平方成正比", inverse: "徑向力與角速度成反比", none: "徑向力不隨角速度改變" };
    const ratioLaw = { linear: "兩個比值相等", square: "前者等於後者的平方", inverse: "前者等於後者的倒數", none: "沒有固定關係" };
    const item = (id, title, earned, max, answer, expected, explanation, status) => ({ id, title, earned, max, answer, expected, explanation,
      status: max === 0 ? "不計分" : earned === max ? "正確" : status || (answer === "未作答" ? "未作答" : earned ? "部分得分" : "需修正") });
    const pages = state.tasks.map((task, i) => {
      const graded = result.detail.pages[i], quantity = i === 0 ? "半徑" : "總質量", fixed = i === 0 ? "總質量" : "半徑";
      const ratio = i === 0 ? "r_A/r_B" : "m_A/m_B";
      const formula = i === 2 ? String.raw`\(F_A=m_A r_A\omega^2\)` : `\\(F_A/F_B=${ratio}\\)`;
      const general = i === 2 ? `質量及半徑固定時，${formula}，力與角速度的平方成正比。` : `兩側${fixed}相同且同時轉動，所以${formula}。這是一般關係；比值恰好為1，並不表示平方或倒數也是一般規律。`;
      const items = rv >= 2 && i < 2 ? [
        item("setup", `研究${quantity}與徑向力：兩側${fixed}應怎樣設定？`, graded.roleScores[0], 3, text(setup, task.inquiry[0]), setup[i === 0 ? "equal-mass" : "equal-radius"], `兩側${fixed}須相同，才能把徑向力的比值直接與${quantity}的比值比較。`),
        item("prediction", "實驗前預測：轉速改變時，兩側徑向力及其比值會怎樣改變？", graded.roleScores[1], rv >= 7 ? 0 : 3, text(prediction, task.inquiry[1]), prediction["ratio-steady"], (rv >= 7 ? "預測不計分，可用實驗數據修正原先想法。" : "") + "兩側同時具有相同角速度；改變轉速會同時改變兩個力，比值保持不變。")
      ] : [
        item("variable", "量測時要改變哪個量？", graded.roleScores[0], 2, text(variable, task.roles[0]), variable[roles[i].independent], `本實驗研究${variable[roles[i].independent]}改變時，徑向力如何改變。`),
        item("controls", "同一組量測期間，哪兩個量應保持不變？", graded.roleScores[1], 4, task.roles[1]?.length ? task.roles[1].map(k => variable[k]).join("、") : "未作答", roles[i].controls.map(k => variable[k]).join("、"), "每選對一個應保持不變的量得2分；兩項都選對得4分。")
      ];
      items.push(item("law", i === 2 ? "固定質量及半徑，徑向力與角速度有甚麼關係？" : `兩側${fixed}相同、角速度相同時，徑向力的比值與${quantity}的比值有甚麼一般關係？`, graded.lawScore, graded.lawMax, text(i === 2 ? law : ratioLaw, task.law), i === 2 ? law.square : ratioLaw.linear, general));
      const indexes = rv >= 4 ? [0, 1] : [task.selected];
      const runs = indexes.map((index, j) => {
        const run = index == null ? null : task.runs[index], grade = rv >= 4 ? graded.runs[j] : graded, divisor = rv >= 4 ? 2 : 1;
        const config = run ? String.raw`\(r_A=${M.radius(run.cfg[0]).toFixed(2)}\,\mathrm{m}\)、\(r_B=${M.radius(run.cfg[1]).toFixed(2)}\,\mathrm{m}\)、\(m_A=${M.mass(run.cfg[2]).toFixed(2)}\,\mathrm{kg}\)、\(m_B=${M.mass(run.cfg[3]).toFixed(2)}\,\mathrm{kg}\)` : "未量測";
        const requirements = i === 0 ? `兩側總質量相同${rv < 3 ? "、半徑不同" : "（半徑可相同）"}` : i === 1 ? "兩側半徑相同、總質量不同" : "同一組保持 A 側的總質量及半徑不變";
        const speed = i === 2 ? "角速度" : "角速率";
        const compare = { supports: `符合：兩側徑向力的比值等於${quantity}的比值`, confounded: `不符合：兩側${fixed}也不同，還須考慮${fixed}的比值`, "no-contrast": rv >= 5 ? `不符合：兩側${quantity}相同時，不能使用這個比值關係` : `不能比較：兩側${quantity}相同`, insufficient: "尚未成功擬合，未能判斷" };
        const fitExplanation = !run?.fit ? "尚未進行擬合，未取得圖像分析分。" : !grade.fit?.ok ? "擬合未成功，未取得圖像分析分；需要足夠的不同轉速。" : i === 2 ? general : grade.expectedComparison === "supports" ? general : grade.expectedComparison === "no-contrast" ? "本次作答採用的舊版規則要求兩側設定有差異，當時本組未符合比較條件。" : `本組兩側${fixed}不同，完整關係為\\(F_A/F_B=(m_A/m_B)(r_A/r_B)\\)，不能只用${quantity}的比值。`;
        const fitStatus = !run?.q.length ? "未量測" : !grade.fit?.ok ? "未完成擬合" : undefined;
        const runItems = [
          item("configuration", "量測設定", grade.fairScore / divisor, 4 / divisor, config, `${requirements}，並量測至少兩個不同轉速。`, !run?.q.length ? "本組沒有量測紀錄。" : grade.slots < 2 ? "尚未量測到兩個可區分的轉速，未能比較。" : `請核對本組設定：${requirements}。`, !run?.q.length ? "未量測" : "未達條件"),
          item("coverage", "量測的轉速範圍", grade.dataScore / divisor, 4 / divisor, run?.q.length ? `${run.q.length}點；${speed}範圍相差\\(${Number(grade.span.toFixed(3))}\\,\\mathrm{rad/s}\\)` : "未量測", `至少3個可區分的轉速，且${speed}範圍相差至少\\(1\\,\\mathrm{rad/s}\\)。`, `評分看轉速範圍，不要求固定點數；至少2個可區分轉速且相差\\(0.5\\,\\mathrm{rad/s}\\)可得一半分。半徑及質量實驗以角速率大小比較。`, !run?.q.length ? "未量測" : grade.dataScore ? "部分得分" : "轉速範圍不足"),
          item("numeric", i === 2 ? "角速度加倍時，力變成多少倍？" : `計算\\(${ratio}\\)`, grade.numericScore / divisor, 4 / divisor, run?.a[0] || "未作答", grade.ratio == null ? "先完成本組量測，才有本組設定可供計算。" : `${Number(grade.ratio.toFixed(4))}${i === 2 ? "倍" : ""}`, i === 2 ? String.raw`力與角速度的平方成正比，\(2^2=4\)。` : `用本組A側${quantity}除以B側${quantity}，次序不能倒轉。${i === 1 ? "總質量包括托座、螺絲及放上的砝碼。" : ""}`),
          item("comparison", i === 2 ? "本組圖像顯示徑向力與角速度有甚麼關係？" : `本組數據是否符合\\(F_A/F_B=${ratio}\\)？`, grade.comparisonScore / divisor, (rv >= 6 ? 6 : 3) / divisor, text(i === 2 ? law : compare, run?.a[1]), !grade.fit?.ok ? "須先成功擬合，才能取得這項分析分。" : text(i === 2 ? law : compare, grade.expectedComparison), fitExplanation, fitStatus)
        ];
        if (rv < 6) {
          const reasons = { coefficient: i === 2 ? "A側總質量與半徑的乘積" : `A側${quantity}除以B側${quantity}的比值`, constant: i === 2 ? "角速度為零時的徑向力" : "B側徑向力為零時，A側的徑向力", other: i === 2 ? "A側的總質量，與半徑無關" : "兩側共同的角速度", uncertain: i === 2 ? "係數沒有物理意義，只用來畫曲線" : rv >= 5 ? "兩側質量比與半徑比的乘積" : "本組未符合比較條件，不能單憑此係數判斷" };
          runItems.push(item("coefficient", "舊版作答：擬合係數", grade.reasonScore / divisor, 3 / divisor, text(reasons, run?.a[2]), !grade.fit?.ok ? "須先成功擬合。" : reasons[grade.expectedReason], !grade.fit?.ok ? fitExplanation : i === 2 ? String.raw`\(F_A=m_A r_A\omega^2\)，二次係數是\(m_A r_A\)。` : String.raw`完整係數為\((m_A/m_B)(r_A/r_B)\)；相同的量，其比值可化為1。`, fitStatus));
        }
        return { title: rv < 4 ? "當時選作評分的數據" : j ? "第二組數據" : "第一組數據", earned: (grade.fairScore + grade.dataScore + grade.numericScore + grade.fitScore) / divisor, max: 18 / divisor, measured: Boolean(run?.q.length), items: runItems };
      });
      return { title: `實驗${i + 1}：${["半徑", "質量", "角速度"][i]}`, earned: graded.score, max: 30, items, runs,
        untouched: !task.runs.length && items.every(entry => entry.answer === "未作答") };
    });
    const sync = { "same-omega": "同一平台兩側同時具有相同角速度，可比較兩側徑向力的比值", "same-force": "同時量測會令兩側徑向力相同", "same-mass": "同時量測會令兩側質量相同", unknown: "不能判斷" };
    const parts = { "cap-screw-weights": "托座、螺絲及放上的砝碼", "weights-only": "只有砝碼", "sensor-and-weights": "測力計及砝碼", "cap-only": "只有托座" };
    const synthesis = [
      item("sync", "為甚麼要同時讀取A、B兩個測力計？", result.detail.syncScore, 5, text(sync, state.sync), sync["same-omega"], "兩側同時具有相同角速度；力的大小仍取決於各側的總質量和半徑。"),
      item("massParts", "A側被測物的總質量包括甚麼？", result.detail.massPartsScore, 5, text(parts, state.massParts), parts["cap-screw-weights"], "被測物是托座、螺絲及砝碼；沒有加砝碼時，托座與螺絲仍有質量。")
    ];
    return { score: result.score, pages, synthesis };
  }
  return Object.freeze({ near, fair, comparison, coverage, page, score, feedback });
});
