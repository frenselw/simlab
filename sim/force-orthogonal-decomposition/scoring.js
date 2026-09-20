(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.ForceOrthogonalDecompositionModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceOrthogonalDecompositionScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (M) {
  "use strict";

  if (!M) throw new Error("Force orthogonal decomposition model is required");
  const MAX_SCORE = 100;
  const GROUP_POINTS = 20;
  const SCENARIO_IDS = Object.freeze(Object.keys(M.SCENARIOS));

  function item(key, label, points, correct, detail = "") {
    return { key, label, points, earned: correct ? points : 0, correct: Boolean(correct), detail };
  }

  function sceneFor(answer) {
    return M.getScenario(answer?.scenarioId) || M.getScenario();
  }

  function directionGroup(answer, scene) {
    const expected = scene.axes.map(axis => axis.key);
    const found = answer.directions.map(direction => M.directionAxisKey(direction, scene));
    return expected.map((key) => item(`direction-${key}`, `${scene.axes.find(axis => axis.key === key)?.label || key} 方向線`, 10,
      found.filter(Boolean).includes(key), found.includes(key) ? "方向線軸向正確" : "尚未建立或軸向未吸附"));
  }

  function perpendicularGroup(answer, scene) {
    const results = scene.axes.map(axis => {
      const line = answer.perpendiculars.find(perpendicular => M.perpendicularDirection(perpendicular, answer.directions, scene) &&
        M.directionAxisKey(M.perpendicularDirection(perpendicular, answer.directions, scene), scene) === axis.key);
      // A perpendicular is correct when its segment crosses the projection
      // foot. Its endpoint may be short of the foot (incorrect), exactly at
      // the foot, or past it (still correct); the model owns that geometry
      // semantics through perpendicularDirection().
      const correct = Boolean(line);
      return item(`perpendicular-${axis.key}`, `到${axis.label}的垂線`, 10, correct,
        correct ? "垂直且通過垂足" : "垂線尚未通過正確垂足");
    });
    return results;
  }

  function componentGroup(answer, scene) {
    const visible = M.visibleIntersections(answer.perpendiculars, answer.directions, scene);
    const byKey = new Map(visible.map(candidate => [candidate.key, candidate]));
    const targetFor = (component) => {
      const target = byKey.get(component?.targetKey);
      if (!target) return null;
      const direction = answer.directions.find(entry => entry.key === target.directionKey);
      return M.directionAxisKey(direction, scene) ? { target, axisKey: M.directionAxisKey(direction, scene) } : null;
    };
    return scene.axes.map(axis => {
      const expectedKey = scene.id === "inclined-gravity"
        ? `F${scene.axes.indexOf(axis) + 1}`
        : null;
      // Resolve the intersection from each component's own targetKey. There
      // may be several visible intersections on one axis, and their array
      // order depends on the learner's drawing order.
      const component = answer.components.find(entry => {
        const resolved = targetFor(entry);
        return resolved?.axisKey === axis.key &&
          (!expectedKey || entry.key === expectedKey) &&
          M.distance(entry.end, resolved.target.point) <= 1e-5;
      });
      const swapped = scene.id === "inclined-gravity" && answer.components.some(entry => {
        const resolved = targetFor(entry);
        return resolved?.axisKey === axis.key && entry.key !== expectedKey && M.distance(entry.end, resolved.target.point) <= 1e-5;
      });
      return item(`component-${axis.key}`, `${axis.label}分力箭頭`, 10, Boolean(component),
        component ? "箭頭端點與可見交點重合" : swapped
          ? "第三題要求 Gₓ 平行斜面、Gᵧ 垂直斜面；兩者位置不可對調"
          : "分力箭頭尚未與可見交點重合");
    });
  }

  function thetaGroup(answer, scene) {
    const candidate = M.thetaCandidates(answer.directions, scene).find(entry => entry.key === answer.theta);
    const semantic = Boolean(candidate) && (scene.thetaMode !== "given" || candidate.key === scene.givenTheta.key);
    return [item("theta", "θ 的角度語意", GROUP_POINTS, Boolean(answer.theta) && semantic,
      answer.theta ? (semantic ? candidate.description : "θ 不是本題可接受的角度") : "尚未放置 θ")];
  }

  function formulaGroup(answer, scene) {
    const expectations = M.formulaExpectations(answer);
    return (expectations || [{ key: "F1", value: null }, { key: "F2", value: null }]).slice(0, 2).map((expected, index) => {
      const key = expected.key || `F${index + 1}`;
      const actual = answer.formulas?.[key];
      const correct = Boolean(expectations) && actual === expected.value;
      const axis = scene.id === "inclined-gravity"
        ? (key === "F1" ? "parallel" : "normal")
        : expected.axis;
      const label = M.componentSymbol(scene, axis, index);
      return item(`formula-${key}`, `${label} 的分力表達式`, 10, correct,
        correct ? `${actual} θ` : actual ? `目前為 ${actual} θ，應檢查分解三角形` : "尚未填寫");
    });
  }

  function questionDetail(answer, index) {
    const scene = sceneFor(answer);
    const groups = [
      { key: "directions", label: "方向線", items: directionGroup(answer, scene) },
      { key: "perpendiculars", label: "垂線", items: perpendicularGroup(answer, scene) },
      { key: "components", label: "分力", items: componentGroup(answer, scene) },
      { key: "theta", label: "θ 標示", items: thetaGroup(answer, scene) },
      { key: "formulas", label: "公式", items: formulaGroup(answer, scene) }
    ];
    groups.forEach(group => {
      group.points = GROUP_POINTS;
      group.earned = group.items.reduce((sum, entry) => sum + entry.earned, 0);
      group.correct = group.earned === group.points;
    });
    const raw = groups.reduce((sum, group) => sum + group.earned, 0);
    return {
      id: scene.id,
      index,
      title: scene.title,
      score: raw,
      maxScore: 100,
      complete: raw === 100,
      groups,
      components: groups.flatMap(group => group.items),
      feedback: groups.filter(group => !group.correct).map(group => `${group.label} ${group.earned}/${group.points}`).join("；") || "五組均完成"
    };
  }

  function score(activityState) {
    if (!activityState || !Array.isArray(activityState.questions) || activityState.questions.length !== SCENARIO_IDS.length) {
      throw new Error("A complete three-question force decomposition state is required");
    }
    const detail = activityState.questions.map(questionDetail);
    const raw = detail.reduce((sum, entry) => sum + entry.score, 0);
    const total = Math.max(0, Math.min(MAX_SCORE, Math.round(raw * MAX_SCORE / (detail.length * 100))));
    const completed = activityState.phase === "summary" || activityState.phase === "practice";
    const feedbackItems = detail.map((entry, index) => `第 ${index + 1} 題（${entry.title}）：${entry.feedback}。`);
    return {
      score: total,
      maxScore: MAX_SCORE,
      // Formative activity has no arbitrary achievement threshold. `passed` is
      // a shared-runtime receipt flag; learner copy uses the explicit
      // formative label instead of claiming mastery.
      passed: true,
      completed,
      detail,
      feedbackItems,
      feedback: feedbackItems.join(" ")
    };
  }

  return Object.freeze({ MAX_SCORE, GROUP_POINTS, SCENARIO_IDS, item, directionGroup, perpendicularGroup, componentGroup, thetaGroup, formulaGroup, questionDetail, score });
});
