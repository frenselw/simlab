(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./motion-model.js") : root.LinearMotionModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LinearMotionScoring = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";

  const WEIGHTS = {
    uniform: { displacement: 10, time: 5, averageVelocity: 10, relationship: 5 },
    variable: { displacement: 10, time: 5, averageVelocity: 10, relationship: 10 },
    instant: { predictionChoice: 20, concept: 10, stoppedVelocity: 5 }
  };
  const RELATIONSHIPS = ["yes", "no"];
  const CONCEPTS = ["limit", "journey-average", "zero-division", "largest-one-second"];

  function validNumericAnswer(value) { return Boolean(Model.normalizeInput(value)); }
  function completeAnswers(answers) {
    if (!answers || !answers.uniform || !answers.variable || !answers.instant) return false;
    const numeric = [
      answers.uniform.displacement, answers.uniform.time, answers.uniform.averageVelocity,
      answers.variable.displacement, answers.variable.time, answers.variable.averageVelocity,
      answers.instant.stoppedVelocity
    ];
    return numeric.every(validNumericAnswer) && RELATIONSHIPS.includes(answers.uniform.relationship) &&
      RELATIONSHIPS.includes(answers.variable.relationship) && CONCEPTS.includes(answers.instant.concept) &&
      typeof answers.instant.predictionChoice === "string";
  }
  function component(answerText, expected, weight) {
    const parsed = Model.normalizeInput(answerText);
    const correct = Boolean(parsed && Model.numericMatch(parsed.value, expected));
    return { correct, points: correct ? weight : 0, answer: parsed?.text || String(answerText ?? ""), expected: Model.formatInput3(expected) };
  }
  function scoreAttempt(definition, uniformMeasurement, variableMeasurement, answers) {
    if (!Model.validateDefinition(definition) || !uniformMeasurement || !variableMeasurement || !completeAnswers(answers)) throw new Error("Incomplete or invalid answer state");
    const uniformExpected = Model.expectedFromMeasurement(uniformMeasurement);
    const variableExpected = Model.expectedFromMeasurement(variableMeasurement);
    const detail = {
      uniform: {
        displacement: component(answers.uniform.displacement, uniformExpected.displacement, WEIGHTS.uniform.displacement),
        time: component(answers.uniform.time, uniformExpected.time, WEIGHTS.uniform.time),
        averageVelocity: component(answers.uniform.averageVelocity, uniformExpected.averageVelocity, WEIGHTS.uniform.averageVelocity),
        relationship: choice(answers.uniform.relationship, "yes", WEIGHTS.uniform.relationship)
      },
      variable: {
        displacement: component(answers.variable.displacement, variableExpected.displacement, WEIGHTS.variable.displacement),
        time: component(answers.variable.time, variableExpected.time, WEIGHTS.variable.time),
        averageVelocity: component(answers.variable.averageVelocity, variableExpected.averageVelocity, WEIGHTS.variable.averageVelocity),
        relationship: choice(answers.variable.relationship, "no", WEIGHTS.variable.relationship)
      },
      instant: {
        predictionChoice: choice(answers.instant.predictionChoice, correctOption(definition).id, WEIGHTS.instant.predictionChoice),
        concept: choice(answers.instant.concept, "limit", WEIGHTS.instant.concept),
        stoppedVelocity: component(answers.instant.stoppedVelocity, 0, WEIGHTS.instant.stoppedVelocity)
      }
    };
    const score = Math.max(0, Math.min(100, Object.values(detail).flatMap(Object.values).reduce((sum, item) => sum + item.points, 0)));
    return {
      score,
      maxScore: 100,
      passed: score >= 60,
      completed: true,
      detail,
      feedback: score === 100 ? "你已準確連繫平均速度、瞬時速度和圖線斜率。" : "請對照各階段讀數，留意平均速度所描述的時間區間。",
      feedbackItems: feedback(definition, uniformMeasurement, variableMeasurement, answers, detail)
    };
  }
  function choice(answer, expected, weight) {
    const correct = answer === expected;
    return { correct, points: correct ? weight : 0, answer, expected };
  }
  function correctOption(definition) { return definition.instantOptions.find((option) => option.correct === 1); }
  function feedback(definition, uniformMeasurement, variableMeasurement, answers, detail) {
    const uniform = Model.expectedFromMeasurement(uniformMeasurement);
    const variable = Model.expectedFromMeasurement(variableMeasurement);
    const windows = Model.analysisWindows(definition);
    const exact = correctOption(definition).value;
    return [
      {
        title: "第 1 關：勻速運動",
        correct: Object.values(detail.uniform).every((item) => item.correct),
        text: [
          numericFeedback("位移大小", detail.uniform.displacement, "m"),
          numericFeedback("經過時間", detail.uniform.time, "s"),
          numericFeedback("平均速度大小", detail.uniform.averageVelocity, "m/s"),
          choiceFeedback("每一時刻關係", detail.uniform.relationship, { yes: "是", no: "否" }),
          "理想勻速模型在每一時刻都有相同瞬時速度；末位差異可來自三位有效數字讀數。"
        ].join("\n"),
        formula: { kind: "average", x1: uniformMeasurement.x1, x2: uniformMeasurement.x2, displacement: uniform.displacement, time: uniform.time, averageVelocity: uniform.averageVelocity }
      },
      {
        title: "第 2 關：變速運動",
        correct: Object.values(detail.variable).every((item) => item.correct),
        text: [
          numericFeedback("位移大小", detail.variable.displacement, "m"),
          numericFeedback("經過時間", detail.variable.time, "s"),
          numericFeedback("平均速度大小", detail.variable.averageVelocity, "m/s"),
          choiceFeedback("每一時刻關係", detail.variable.relationship, { yes: "是", no: "否" }),
          "變速時不會在每一時刻都等於整段平均值，但某一刻可以巧合相等。"
        ].join("\n"),
        formula: { kind: "average", x1: variableMeasurement.x1, x2: variableMeasurement.x2, displacement: variable.displacement, time: variable.time, averageVelocity: variable.averageVelocity }
      },
      {
        title: "第 3 關：時間放大鏡",
        correct: Object.values(detail.instant).every((item) => item.correct),
        text: [
          choiceFeedback("目標時刻的瞬時速度估計", detail.instant.predictionChoice, Object.fromEntries(definition.instantOptions.map((option) => [option.id, quantity(option.value, "m/s")]))),
          choiceFeedback("瞬時速度概念", detail.instant.concept, { limit: "愈短時間內平均速度所趨近的值", "journey-average": "全程平均", "zero-division": "除以零秒", "largest-one-second": "一秒內最大速度" }),
          numericFeedback("車輛停定、位置保持不變時的瞬時速度大小", detail.instant.stoppedVelocity, "m/s"),
          "時間區間逐步縮短時，區間平均速度會趨近目標瞬時速度；車輛停定、位置保持不變時，瞬時速度是 0.00 m/s。"
        ].join("\n"),
        formula: { kind: "limit", windows: windows.map((row) => ({ duration: row.duration, averageVelocity: row.averageVelocity })), exact }
      }
    ];
  }
  function numericFeedback(name, item, unit) {
    return `${item.correct ? "✓" : "✗"} ${name}：你的答案 ${quantity(Model.normalizeInput(item.answer)?.value, unit)}；正確答案 ${quantity(Model.normalizeInput(item.expected)?.value, unit)}；${item.points} 分。`;
  }
  function quantity(value, unit) { return `${Model.format3(value)} ${unit}`; }
  function choiceFeedback(name, item, labels) {
    return `${item.correct ? "✓" : "✗"} ${name}：你的答案「${labels[item.answer] || item.answer}」；正確答案「${labels[item.expected] || item.expected}」；${item.points} 分。`;
  }

  return { WEIGHTS, RELATIONSHIPS, CONCEPTS, validNumericAnswer, completeAnswers, correctOption, scoreAttempt };
});
