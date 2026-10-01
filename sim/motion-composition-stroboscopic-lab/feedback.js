(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./model.js") : root.MotionCompositionModel,
    node ? require("./scoring.js") : root.MotionCompositionScoring);
  if (node) module.exports = api;
  if (root) root.MotionCompositionFeedback = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, S) {
  "use strict";
  const time = i => `<var>t</var><sub>${i}</sub>`;
  const coordinates = p => `<span><var>x</var> = ${M.format(p[0])}</span><span><var>y</var> = ${M.format(p[1])}</span>`;
  function choice(title, value, expected, labels, correct) {
    const status = value === null ? "未作答" : `${correct ? "" : "你的答案："}${labels[value]}（${correct ? "正確" : "需要修正"}）`;
    const kind = value === null ? "unanswered" : correct ? "ok" : "issue";
    return `<li><strong>${title}</strong><span class="${kind}">${status}</span>${correct ? "" : `<span class="answer-reference">正確答案：${labels[expected]}</span>`}</li>`;
  }
  function positionStatus(correct, placed, label) {
    const kind = placed ? correct ? "ok" : "issue" : "unanswered";
    return `<span class="${kind}">${label}：<bdi>${placed ? correct ? "正確" : "需修正" : "未放置"}</bdi></span>`;
  }
  function html(index, answer, detail) {
    const definition = M.CASES[index], expected = M.expected(index);
    const explanation = definition.explanation.replace(/\b([gxy])\b/g, "<var>$1</var>").replace("m/s²", "m/s<sup>2</sup>");
    const rows = answer.points.map((point, i) => {
      const checks = detail.points[i], needsReference = !point || !checks.x || !checks.y;
      return `<tr><td>${time(i + 1)}</td><td class="feedback-coordinates">${point ? coordinates(point) : '<span class="unanswered">未放置</span>'}${needsReference ? `<small class="reference-position">參考位置${coordinates(expected[i])}</small>` : ""}</td><td class="position-check">${positionStatus(checks.x, Boolean(point), "水平")}${positionStatus(checks.y, Boolean(point), "垂直")}</td></tr>`;
    }).join("");
    return `<article><h3>情境 ${index + 1}：${detail.score}/25 分</h3><p>${explanation}</p><ul class="feedback-choices">${answer.motions.map((value, axis) => choice(axis ? "垂直分運動" : "水平分運動", value, definition.motions[axis], M.MOTIONS, detail.motions[axis])).join("")}${choice("合運動軌跡", answer.trajectory, definition.trajectory, M.TRAJECTORIES, detail.trajectory)}</ul></article><article><h3>各時刻的位置</h3><table class="feedback-table"><thead><tr><th>時刻</th><th>你的位置 / m</th><th>位置檢查</th></tr></thead><tbody>${rows}</tbody></table><p class="small">水平、垂直位置各自評分，每個方向正確得${S.COORDINATE_POINTS}分；坐標誤差不超過${M.format(S.POSITION_TOLERANCE_MM)} m算正確。未放置得0分。</p></article><p class="small">把同一時刻的水平坐標和垂直坐標配對，便得到合運動的位置。</p>`;
  }
  return Object.freeze({ html });
});
