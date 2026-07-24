(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsDrivingLevels = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const LEVEL_SET_VERSION = 8;
  const GRAPH_VELOCITY_SPAN = 20;
  const GRAPH_TIME_SPAN_S = 12;

  function zone(id, start, end, slopeDeg, target, points) {
    return Object.freeze({
      id, start, end, slopeDeg, target, points,
      graphVelocitySpan: GRAPH_VELOCITY_SPAN, graphTimeSpan: GRAPH_TIME_SPAN_S
    });
  }

  const LEVELS = Object.freeze([
    Object.freeze({
      id: "level1", number: 1, title: "平路保持勻速", shortTitle: "平路勻速", color: "#2563eb",
      instruction: "試出合適的油門力度，在藍色路段保持勻速。留意 v–t 圖是否接近水平直線。",
      initialSpeed: 8, maxTicks: 400, routeLength: 92,
      segments: Object.freeze([zone("l1-flat", 0, 92, 0, "uniform", 15)])
    }),
    Object.freeze({
      id: "level2", number: 2, title: "平路保持勻加速", shortTitle: "平路勻加速", color: "#16a34a",
      instruction: "比較三種油門力度，在綠色路段找出能令 v–t 圖形成向上直線的控制。",
      initialSpeed: 5, maxTicks: 400, routeLength: 86,
      segments: Object.freeze([zone("l2-flat", 0, 86, 0, "accelerating", 20)])
    }),
    Object.freeze({
      id: "level3", number: 3, title: "平路保持勻減速", shortTitle: "平路勻減速", color: "#ea580c",
      instruction: "比較三種煞車力度，在橙色路段找出能令 v–t 圖形成向下直線的控制。",
      initialSpeed: 12, maxTicks: 400, routeLength: 50,
      segments: Object.freeze([zone("l3-flat", 0, 50, 0, "decelerating", 20)])
    }),
    Object.freeze({
      id: "level4", number: 4, title: "斜坡保持勻速", shortTitle: "斜坡勻速", color: "#7c3aed",
      instruction: "在整條紫色上斜路試出合適的油門力度，令 v–t 圖保持水平。",
      initialSpeed: 8, maxTicks: 500, routeLength: 88,
      segments: Object.freeze([
        zone("l4-uphill", 0, 88, 3.50, "uniform", 15)
      ])
    }),
    Object.freeze({
      id: "level5", number: 5, title: "混合道路挑戰", shortTitle: "綜合挑戰", color: "#0f766e",
      instruction: "每個路牌正下方都有一條黃色分界線；車越過分界線後，就按路牌要求控制。",
      initialSpeed: 8, maxTicks: 1200, routeLength: 267,
      segments: Object.freeze([
        zone("l5-uniform-flat", 0, 70, 0, "uniform", 5),
        zone("l5-accelerate-flat", 70, 150, 0, "accelerating", 5),
        zone("l5-decelerate-flat", 150, 187, 0, "decelerating", 5),
        zone("l5-uniform-down", 187, 267, -4.34, "uniform", 5)
      ])
    })
  ]);

  const PRACTICE = Object.freeze({
    id: "practice", number: 0, title: "操作練習", shortTitle: "練習", color: "#64748b",
    instruction: "直接按住踏板的輕、中或盡位置，放手回到空檔，並比較 x–t 與 v–t 圖。",
    initialSpeed: 7, maxTicks: 600, routeLength: 160,
    segments: Object.freeze([zone("practice-flat", 0, 160, 0, "practice", 0)])
  });

  function levelById(id) {
    return id === "practice" ? PRACTICE : LEVELS.find((level) => level.id === id) || null;
  }

  function segmentAt(level, position) {
    if (!level || !Number.isFinite(position)) return null;
    return level.segments.find((segment, index) =>
      position >= segment.start && (position < segment.end || (index === level.segments.length - 1 && position <= segment.end))
    ) || level.segments[level.segments.length - 1];
  }

  function scoredZones(level) {
    return level.segments.filter((segment) => segment.target !== "transition" && segment.target !== "practice");
  }

  function validateLevel(level) {
    if (!level || !/^level[1-5]$/.test(level.id) || !Number.isFinite(level.initialSpeed) || level.initialSpeed <= 0 ||
        !Number.isInteger(level.maxTicks) || level.maxTicks <= 0 || !Number.isFinite(level.routeLength) || level.routeLength <= 0 ||
        !Array.isArray(level.segments) || !level.segments.length) return false;
    let end = 0;
    for (const segment of level.segments) {
      if (!segment || segment.start !== end || !Number.isFinite(segment.end) || segment.end <= segment.start ||
          !Number.isFinite(segment.slopeDeg) || !["uniform", "accelerating", "decelerating", "transition"].includes(segment.target) ||
          !Number.isFinite(segment.points) || segment.points < 0) return false;
      if (segment.target === "transition" ? segment.points !== 0 : segment.points <= 0) return false;
      end = segment.end;
    }
    return end === level.routeLength;
  }

  return {
    LEVEL_SET_VERSION, GRAPH_VELOCITY_SPAN, GRAPH_TIME_SPAN_S, LEVELS, PRACTICE,
    levelById, segmentAt, scoredZones, validateLevel
  };
});
