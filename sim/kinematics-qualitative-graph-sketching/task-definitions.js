(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphTasks = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TASK_SET_VERSION = 1;
  const GRAPH_TYPES = Object.freeze(["vt", "at", "xt"]);
  const DISPLAY_GRAPH_TYPES = Object.freeze(["xt", "vt", "at"]);
  const SCENARIOS = Object.freeze([
    {
      id: "uniform",
      number: 1,
      title: "正方向勻速",
      prompt: "一個物體一直向正方向作勻速直線運動。",
      points: 15
    },
    {
      id: "accelerating",
      number: 2,
      title: "已有正速度的勻加速",
      prompt: "一個物體開始時已向正方向運動，其後作勻加速直線運動。",
      points: 25
    },
    {
      id: "decelerating",
      number: 3,
      title: "勻減速至停止",
      prompt: "一個物體開始時向正方向運動，其後作勻減速直線運動；作圖時間在物體剛好停止的一刻結束，物體沒有反向。",
      points: 25
    },
    {
      id: "composite",
      number: 4,
      title: "四階段綜合運動",
      prompt: "物體由靜止開始，先勻加速，再保持勻速，之後勻減速至停止，最後保持靜止。",
      points: 35,
      phases: Object.freeze(["A 勻加速", "B 勻速", "C 勻減速至停止", "D 靜止"])
    }
  ]);

  const TASK_SPECS = Object.freeze({
    "uniform-vt": { graphType: "vt", points: 5, rubric: "uniform-vt" },
    "uniform-at": { graphType: "at", points: 5, rubric: "uniform-at" },
    "uniform-xt": { graphType: "xt", points: 5, rubric: "uniform-xt" },
    "accelerating-vt": { graphType: "vt", points: 8, rubric: "accelerating-vt" },
    "accelerating-at": { graphType: "at", points: 8, rubric: "accelerating-at" },
    "accelerating-xt": { graphType: "xt", points: 9, rubric: "accelerating-xt" },
    "decelerating-vt": { graphType: "vt", points: 8, rubric: "decelerating-vt" },
    "decelerating-at": { graphType: "at", points: 8, rubric: "decelerating-at" },
    "decelerating-xt": { graphType: "xt", points: 9, rubric: "decelerating-xt" },
    "composite-vt": { graphType: "vt", points: 11, rubric: "composite-vt" },
    "composite-at": { graphType: "at", points: 11, rubric: "composite-at" },
    "composite-xt": { graphType: "xt", points: 13, rubric: "composite-xt" }
  });

  const GRAPH_LABELS = Object.freeze({
    vt: "速度—時間圖（v–t）",
    at: "加速度—時間圖（a–t）",
    xt: "位置—時間圖（x–t）"
  });

  const TASKS = Object.freeze(SCENARIOS.flatMap((scenario) =>
    GRAPH_TYPES.map((graphType) => {
      const id = `${scenario.id}-${graphType}`;
      const spec = TASK_SPECS[id];
      return Object.freeze({
        id,
        scenarioId: scenario.id,
        scenarioNumber: scenario.number,
        title: scenario.title,
        prompt: scenario.prompt,
        graphType,
        graphLabel: GRAPH_LABELS[graphType],
        points: spec.points,
        rubric: spec.rubric,
        phases: scenario.phases || null
      });
    })
  ));

  function taskById(id) {
    return TASKS.find((task) => task.id === id) || null;
  }

  function taskIndexById(id) {
    return TASKS.findIndex((task) => task.id === id);
  }

  function scenarioById(id) {
    return SCENARIOS.find((scenario) => scenario.id === id) || null;
  }

  function tasksForScenario(id) {
    return TASKS.filter((task) => task.scenarioId === id);
  }

  function displayTasksForScenario(id) {
    const tasks = tasksForScenario(id);
    return DISPLAY_GRAPH_TYPES.map((type) => tasks.find((task) => task.graphType === type)).filter(Boolean);
  }

  return {
    TASK_SET_VERSION,
    GRAPH_TYPES,
    DISPLAY_GRAPH_TYPES,
    GRAPH_LABELS,
    SCENARIOS,
    TASKS,
    taskById,
    taskIndexById,
    scenarioById,
    tasksForScenario,
    displayTasksForScenario
  };
});
