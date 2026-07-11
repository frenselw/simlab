(function () {
  "use strict";

  const Scoring = window.ReferenceFrameScoring;
  if (!Scoring) throw new Error("Reference-frame scoring module was not loaded");

  const canvas = document.getElementById("roadCanvas");
  const context = canvas.getContext("2d");
  const headerText = document.getElementById("headerText");
  const roundHeading = document.getElementById("roundHeading");
  const taskIntro = document.getElementById("taskIntro");
  const conditionList = document.getElementById("conditionList");
  const roundStatus = document.getElementById("roundStatus");
  const stageBadge = document.getElementById("stageBadge");
  const candidateButtons = Array.from(document.querySelectorAll("[data-candidate]"));
  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const replayButton = document.getElementById("replayButton");
  const slowButton = document.getElementById("slowButton");
  const recordButton = document.getElementById("recordButton");
  const guideButton = document.getElementById("guideButton");
  const reviewList = document.getElementById("reviewList");
  const submitButton = document.getElementById("submitButton");
  const feedbackSection = document.getElementById("feedbackSection");
  const scorePanel = document.getElementById("scorePanel");
  const feedbackList = document.getElementById("feedbackList");
  const screenReaderStatus = document.getElementById("screenReaderStatus");

  const SIMULATION_SECONDS = 3.5;
  const SLOW_FACTOR = 0.5;
  const MIN_VISIBLE_DISPLACEMENT = 36;
  const ROAD_ANGLE = Math.PI / 18;
  const AXIS = { x: Math.cos(ROAD_ANGLE), y: -Math.sin(ROAD_ANGLE) };
  const SIDE = { x: -AXIS.y, y: AXIS.x };
  const PREFERS_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const VEHICLES = {
    A: { name: "車 A", longName: "車 A（紅色小型車）", color: "#e4554f", dark: "#9f2d31", shape: "hatchback" },
    B: { name: "車 B", longName: "車 B（藍色房車）", color: "#3478d2", dark: "#1e4f98", shape: "sedan" },
    C: { name: "車 C", longName: "車 C（黃色小巴）", color: "#efb94e", dark: "#9e6e14", shape: "minibus" }
  };
  const LAYOUTS = [
    { positions: [-42, 0, 42], lanes: [-1, 0, 1] },
    { positions: [32, -42, 6], lanes: [0, 1, -1] },
    { positions: [-8, 42, -42], lanes: [1, -1, 0] },
    { positions: [42, -6, -36], lanes: [-1, 1, 0] }
  ];

  const state = {
    mode: "guide",
    guideRound: Scoring.instantiateRound("core-upper-middle", "ABC", 0),
    rounds: [],
    answers: [],
    activeIndex: 0,
    selected: null,
    observedCandidates: new Set(),
    playback: "idle",
    simTime: 0,
    slow: PREFERS_REDUCED_MOTION,
    fromReview: false,
    locked: false,
    result: null,
    trustedReview: true,
    view: { width: 760, height: 480, dpr: 1 },
    lastFrame: performance.now()
  };

  function randomSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function mulberry32(seed) {
    return function random() {
      let value = seed += 0x6d2b79f5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(value, random) {
    const items = value.slice();
    for (let index = items.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  }

  function createAttempt() {
    const random = mulberry32(randomSeed());
    const permutation = shuffled(["A", "B", "C"], random).join("");
    const layouts = Scoring.ROUND_ORDER.map(() => Math.floor(random() * LAYOUTS.length));
    state.rounds = Scoring.instantiateAttempt(permutation, layouts);
    state.answers = Array(state.rounds.length).fill(null);
    state.activeIndex = 0;
    state.mode = "guide";
    state.selected = null;
    state.observedCandidates = new Set();
    state.playback = "idle";
    state.simTime = 0;
    state.slow = PREFERS_REDUCED_MOTION;
    state.fromReview = false;
    state.locked = false;
    state.result = null;
    state.trustedReview = true;
  }

  function activeRound() {
    return state.mode === "guide" ? state.guideRound : state.rounds[state.activeIndex];
  }

  function displayName(candidate, long) {
    if (candidate === "R") return "路旁觀察者";
    return long ? VEHICLES[candidate].longName : VEHICLES[candidate].name;
  }

  function objectName(object, long) {
    return object === "roadside" ? "路旁景物" : displayName(object, long);
  }

  function stateText(value) {
    if (value === "stationary") return "靜止";
    return value === "up" ? "向右上方（↗）移動" : "向左下方（↙）移動";
  }

  function conditionText(condition) {
    return `${objectName(condition.object, true)}在該參考系中${stateText(condition.state)}`;
  }

  function chooseCandidate(candidate) {
    if (state.locked || state.playback === "playing" || state.mode === "review") return;
    state.selected = candidate;
    state.simTime = 0;
    state.playback = state.observedCandidates.has(candidate) ? "observed" : "idle";
    announce(`已選擇${displayName(candidate)}。請開始觀察。`);
    renderUI();
  }

  function startObservation(reset) {
    if (!state.selected || state.locked || state.mode === "review") return;
    if (reset) state.simTime = 0;
    state.playback = "playing";
    announce(observationSummary("開始觀察"));
    renderUI();
  }

  function pauseOrResume() {
    if (state.playback === "playing") {
      state.playback = "paused";
      announce(observationSummary("已暫停"));
    } else if (state.playback === "paused") {
      state.playback = "playing";
      announce(observationSummary("繼續觀察"));
    }
    renderUI();
  }

  function recordAnswer() {
    if (state.mode !== "task" || !state.selected || !state.observedCandidates.has(state.selected)) return;
    state.answers[state.activeIndex] = state.selected;
    if (state.fromReview) {
      showReview();
      return;
    }
    if (state.activeIndex === state.rounds.length - 1) {
      showReview();
    } else {
      beginRound(state.activeIndex + 1, false);
    }
  }

  function completeGuide() {
    if (!state.selected || !state.observedCandidates.has(state.selected)) return;
    beginRound(0, false);
  }

  function beginRound(index, fromReview) {
    state.mode = "task";
    state.activeIndex = index;
    state.fromReview = Boolean(fromReview);
    state.selected = fromReview ? state.answers[index] : null;
    state.observedCandidates = new Set(state.selected ? [state.selected] : []);
    state.playback = state.selected ? "observed" : "idle";
    state.simTime = 0;
    state.slow = PREFERS_REDUCED_MOTION;
    renderUI();
  }

  function showReview() {
    state.mode = "review";
    state.selected = null;
    state.playback = "idle";
    state.simTime = 0;
    state.fromReview = false;
    renderUI();
  }

  function submitAnswers() {
    if (state.locked || state.answers.some((answer) => !answer)) return;
    if (!window.confirm("確認提交全部答案？提交後本次嘗試只可重看。")) return;
    const result = Scoring.scoreAttempt(state.rounds, state.answers);
    const snapshot = {
      v: 1,
      locked: 1,
      rounds: state.rounds.map(Scoring.snapshotRound),
      answers: state.answers.slice(),
      score: result.score,
      passed: result.passed ? 1 : 0
    };
    const size = new TextEncoder().encode(JSON.stringify(snapshot)).length;
    if (size > 3000) throw new Error("Review snapshot is unexpectedly too large");
    state.result = result;
    state.locked = true;
    state.mode = "submitted";
    state.selected = null;
    state.playback = "idle";
    window.SimScorm.submitResult(result, snapshot);
    renderUI();
  }

  function restoreSubmittedAttempt() {
    const raw = window.SimScorm.getValue("cmi.suspend_data");
    const lmsScore = Number(window.SimScorm.getValue("cmi.core.score.raw"));
    try {
      const saved = JSON.parse(raw);
      if (!saved || saved.v !== 1 || saved.locked !== 1 || !Array.isArray(saved.rounds) || saved.rounds.length !== 5) {
        throw new Error("Unsupported review state");
      }
      const rounds = saved.rounds.map(Scoring.roundFromSnapshot);
      if (!Scoring.validateAnswers(saved.answers, rounds.length)) throw new Error("Invalid saved answers");
      const result = Scoring.scoreAttempt(rounds, saved.answers);
      const scoreMatches = Number.isFinite(lmsScore) ? result.score === lmsScore : result.score === saved.score;
      const savedMatches = result.score === saved.score && Boolean(result.passed) === Boolean(saved.passed);
      state.rounds = rounds;
      state.answers = saved.answers;
      state.result = scoreMatches && savedMatches ? result : {
        score: Number.isFinite(lmsScore) ? lmsScore : saved.score,
        maxScore: 100,
        passed: Boolean(saved.passed),
        completed: true,
        detail: []
      };
      state.trustedReview = scoreMatches && savedMatches;
      state.mode = "submitted";
      state.locked = true;
      state.selected = null;
      state.playback = "idle";
      return;
    } catch (error) {
      state.rounds = [];
      state.answers = [];
      state.result = {
        score: Number.isFinite(lmsScore) ? lmsScore : 0,
        maxScore: 100,
        passed: window.SimScorm.getValue("cmi.core.lesson_status") === "passed",
        completed: true,
        detail: []
      };
      state.trustedReview = false;
      state.mode = "submitted";
      state.locked = true;
      state.selected = null;
      state.playback = "idle";
    }
  }

  function renderUI() {
    const isGuide = state.mode === "guide";
    const isTask = state.mode === "task";
    const isReview = state.mode === "review";
    const isSubmitted = state.mode === "submitted";
    const round = (isGuide || isTask) ? activeRound() : null;

    headerText.textContent = isGuide
      ? "本活動把路旁及做勻速直線運動的車視為慣性參考系；先以一個參考物體觀察，理解畫面中「靜止」取決於參考系。"
      : "本活動把路旁及做勻速直線運動的車視為慣性參考系；請根據相對位置的改變找出合適的參考物體。";
    roundHeading.textContent = isGuide ? "導覽：先試一次" : isTask ? `第 ${state.activeIndex + 1} 題／5 題` : isReview ? "提交前檢查" : "提交結果";
    taskIntro.textContent = isGuide
      ? "選擇一個參考物體，播放後留意：被選物體會固定，而其他物體的相對位置可能改變。"
      : isTask
        ? "每題可能有一個或多個合適答案。請選擇任何一個同時符合兩項條件的參考物體。"
        : isReview
          ? "可按任何一題返回觀察及修改答案。全部確認後才提交。"
          : state.trustedReview
            ? "本次嘗試已提交並鎖定，只供重看。"
            : "本次嘗試已提交並鎖定。詳細題目資料無法安全重建。";
    conditionList.innerHTML = "";
    if (round && !isGuide) {
      round.conditions.forEach((condition) => {
        const item = document.createElement("li");
        item.textContent = conditionText(condition);
        conditionList.append(item);
      });
    }

    candidateButtons.forEach((button) => {
      const candidate = button.dataset.candidate;
      const selected = candidate === state.selected;
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = state.locked || isReview || state.playback === "playing";
    });

    const canStart = Boolean(state.selected && !state.locked && !isReview && state.playback === "idle");
    startButton.disabled = !canStart;
    pauseButton.disabled = !(state.playback === "playing" || state.playback === "paused");
    pauseButton.textContent = state.playback === "paused" ? "繼續" : "暫停";
    replayButton.disabled = !state.selected || state.locked || isReview || state.playback === "playing";
    slowButton.disabled = state.playback === "playing" || state.locked || isReview;
    slowButton.textContent = `慢動作：${state.slow ? "開" : "關"}`;
    slowButton.setAttribute("aria-pressed", String(state.slow));

    recordButton.classList.toggle("is-hidden", !isTask);
    guideButton.classList.toggle("is-hidden", !isGuide);
    recordButton.disabled = !isTask || !state.selected || !state.observedCandidates.has(state.selected) || state.playback === "playing";
    guideButton.disabled = !isGuide || !state.selected || !state.observedCandidates.has(state.selected) || state.playback === "playing";
    recordButton.textContent = state.fromReview ? "更新本題答案" : "記錄為本題答案";

    reviewList.classList.toggle("is-hidden", !isReview);
    submitButton.classList.toggle("is-hidden", !isReview);
    submitButton.disabled = !isReview || state.answers.some((answer) => !answer);
    if (isReview) renderReviewList();

    feedbackSection.classList.toggle("is-hidden", !isSubmitted);
    if (isSubmitted) renderFeedback();

    roundStatus.textContent = statusMessage();
    stageBadge.textContent = isSubmitted
      ? "本次嘗試已鎖定"
      : state.selected
        ? `目前參考系：${displayName(state.selected)}`
        : "請先選擇參考物體";
  }

  function statusMessage() {
    if (state.mode === "guide") return state.selected ? "完成一次完整觀察後即可開始正式任務。" : "尚未選擇參考物體。";
    if (state.mode === "review") return state.answers.every(Boolean) ? "五題答案已齊，可提交。" : "仍有未完成的題目。";
    if (state.mode === "submitted") return state.trustedReview ? "已提交至 Moodle／本機 SCORM 記錄。" : "已提交；只可查看安全摘要。";
    if (!state.selected) return "尚未選擇參考物體。";
    if (state.playback === "playing") return "正在觀察；播放期間不能切換參考物體。";
    if (state.playback === "paused") return "已暫停；可繼續、重播或改選另一個參考物體。";
    if (state.observedCandidates.has(state.selected)) return "已完成此參考物體的觀察，可記錄答案或再測試。";
    return "已選擇參考物體，請開始觀察。";
  }

  function renderReviewList() {
    reviewList.innerHTML = "";
    state.rounds.forEach((round, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<span>第 ${index + 1} 題</span><strong>${state.answers[index] ? displayName(state.answers[index]) : "未作答"}</strong>`;
      button.addEventListener("click", () => beginRound(index, true));
      reviewList.append(button);
    });
  }

  function renderFeedback() {
    const result = state.result || { score: 0, maxScore: 100, passed: false, detail: [] };
    scorePanel.innerHTML = `<div>分數</div><div class="score-value">${result.score} / ${result.maxScore}</div><div class="muted">${result.passed ? "已達到合格要求。" : "未達到合格要求。"}</div>`;
    feedbackList.innerHTML = "";
    if (!state.trustedReview) {
      const item = document.createElement("div");
      item.className = "feedback-item is-wrong";
      item.textContent = "題目資料無法安全重建；以上顯示的是已記錄的最終分數。";
      feedbackList.append(item);
      return;
    }
    result.detail.forEach((detail, index) => {
      const round = state.rounds[index];
      const item = document.createElement("div");
      item.className = `feedback-item ${detail.correct ? "is-correct" : "is-wrong"}`;
      const selected = displayName(detail.answer);
      const accepted = detail.accepted.map((candidate) => displayName(candidate)).join("、");
      const conditionNotes = round.conditions.map((condition) => {
        const actual = Scoring.relation(Scoring.objectClass(round, condition.object), Scoring.referenceClass(round, detail.answer));
        return `${objectName(condition.object)}${actual === condition.state ? "符合" : `實際為${stateText(actual)}`}`;
      }).join("；");
      item.innerHTML = `<strong>第 ${index + 1} 題：${detail.correct ? "正確" : "未符合全部條件"}（${detail.score}/${detail.maxScore}）</strong><p>你選擇：${selected}。${conditionNotes}。可接受的參考物體：${accepted}。</p>`;
      feedbackList.append(item);
    });
  }

  function observationSummary(prefix) {
    if (!state.selected) return prefix;
    const round = activeRound();
    const reference = Scoring.referenceClass(round, state.selected);
    const pieces = ["A", "B", "C"].map((id) => {
      return `${displayName(id)}${stateText(Scoring.relation(round.classes[id], reference))}`;
    });
    pieces.push(`路旁景物${stateText(Scoring.relation(0, reference))}`);
    return `${prefix}：目前以${displayName(state.selected)}作參考系。${pieces.join("；")}。`;
  }

  function announce(message) {
    screenReaderStatus.textContent = "";
    window.setTimeout(() => { screenReaderStatus.textContent = message; }, 20);
  }

  function layoutFor(round) {
    return LAYOUTS[((round.layout % LAYOUTS.length) + LAYOUTS.length) % LAYOUTS.length];
  }

  function geometry() {
    const { width, height } = state.view;
    const diagonal = Math.hypot(width, height);
    return {
      anchor: { x: width * 0.5, y: height * 0.56 },
      span: diagonal * 0.72,
      roadHalf: Math.max(74, Math.min(height * 0.28, width * 0.22)),
      laneStep: Math.max(28, Math.min(52, height * 0.1)),
      speed: MIN_VISIBLE_DISPLACEMENT / SIMULATION_SECONDS
    };
  }

  function vectorPoint(center, along, across) {
    return {
      x: center.x + AXIS.x * along + SIDE.x * across,
      y: center.y + AXIS.y * along + SIDE.y * across
    };
  }

  function perspective(geometryValue, along) {
    const normalized = Math.max(-1, Math.min(1, along / geometryValue.span));
    return 1 - normalized * 0.16;
  }

  function project(geometryValue, along, across) {
    return vectorPoint(geometryValue.anchor, along, across * perspective(geometryValue, along));
  }

  function currentReferenceDistance(round) {
    if (!state.selected) return 0;
    const layout = layoutFor(round);
    if (state.selected === "R") return 0;
    const positionIndex = state.selected.charCodeAt(0) - 65;
    return layout.positions[positionIndex] + round.classes[state.selected] * geometry().speed * state.simTime;
  }

  function vehicleStates(round) {
    const layout = layoutFor(round);
    const referenceDistance = currentReferenceDistance(round);
    const geometryValue = geometry();
    return ["A", "B", "C"].map((id) => {
      const index = id.charCodeAt(0) - 65;
      const longitudinal = layout.positions[index] + round.classes[id] * geometryValue.speed * state.simTime - referenceDistance;
      return {
        id,
        along: longitudinal,
        lane: layout.lanes[index] * geometryValue.laneStep,
        scale: Math.max(0.75, Math.min(1.22, perspective(geometryValue, longitudinal)))
      };
    });
  }

  function drawRoundRect(ctx, x, y, width, height, radius) {
    const safe = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safe, y);
    ctx.arcTo(x + width, y, x + width, y + height, safe);
    ctx.arcTo(x + width, y + height, x, y + height, safe);
    ctx.arcTo(x, y + height, x, y, safe);
    ctx.arcTo(x, y, x + width, y, safe);
    ctx.closePath();
  }

  function drawPolygon(ctx, points, fill, stroke) {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    if (fill) ctx.fillStyle = fill, ctx.fill();
    if (stroke) ctx.strokeStyle = stroke, ctx.stroke();
  }

  function drawScene() {
    const { width, height } = state.view;
    if (width < 2 || height < 2) return;
    const round = activeRound() || state.rounds[0] || state.guideRound;
    if (!round) return;
    const geo = geometry();
    const ctx = context;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#cce5c3";
    ctx.fillRect(0, 0, width, height);
    drawGroundDetails(ctx, geo, round);
    drawRoad(ctx, geo);
    drawRoadside(ctx, geo, round);
    vehicleStates(round).sort((a, b) => b.along - a.along).forEach((vehicle) => drawVehicle(ctx, geo, vehicle));
    drawRoadObserver(ctx, geo, round);
  }

  function drawGroundDetails(ctx, geo, round) {
    const reference = currentReferenceDistance(round);
    for (let index = -4; index <= 4; index += 1) {
      const along = index * 165 - reference;
      drawHill(ctx, project(geo, along, -geo.roadHalf * 2.05), Math.max(0.72, perspective(geo, along)), index % 2 === 0 ? "#8bc653" : "#79b94b");
      drawHill(ctx, project(geo, along + 65, geo.roadHalf * 2.15), Math.max(0.68, perspective(geo, along + 65)), "#9fce62");
    }

    drawPond(ctx, project(geo, 98 - reference, -geo.roadHalf * 1.78), Math.max(0.66, perspective(geo, 98 - reference)));
    drawShop(ctx, project(geo, -155 - reference, -geo.roadHalf * 1.66), Math.max(0.72, perspective(geo, -155 - reference)));
    drawHouse(ctx, project(geo, -228 - reference, geo.roadHalf * 1.66), Math.max(0.66, perspective(geo, -228 - reference)));
    drawShop(ctx, project(geo, -18 - reference, -geo.roadHalf * 1.68), Math.max(0.7, perspective(geo, -18 - reference)));
    drawGasStation(ctx, project(geo, 138 - reference, -geo.roadHalf * 1.7), Math.max(0.68, perspective(geo, 138 - reference)));
    drawHouse(ctx, project(geo, 150 - reference, geo.roadHalf * 1.72), Math.max(0.7, perspective(geo, 150 - reference)));

    for (let index = -5; index <= 5; index += 1) {
      const along = index * 77 - reference;
      const side = index % 2 === 0 ? -geo.roadHalf * 1.52 : geo.roadHalf * 1.55;
      const point = project(geo, along, side);
      const scale = Math.max(0.58, perspective(geo, along));
      drawShrub(ctx, point, scale * (index % 3 === 0 ? 1.25 : 0.9));
      if (index % 3 === 1) drawRock(ctx, project(geo, along + 17, side * 1.15), scale);
      if (index % 4 === 2) drawPine(ctx, project(geo, along - 18, side * 1.12), scale * 1.1);
    }
  }

  function drawHill(ctx, point, scale, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 76 * scale, 31 * scale, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.beginPath();
    ctx.ellipse(point.x - 19 * scale, point.y - 10 * scale, 35 * scale, 15 * scale, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPond(ctx, point, scale) {
    ctx.save();
    ctx.fillStyle = "#d6b86a";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 66 * scale, 30 * scale, ROAD_ANGLE, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#58b7e5";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 57 * scale, 24 * scale, ROAD_ANGLE, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.58)";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(point.x - 14 * scale, point.y - 4 * scale, 14 * scale, 0.1, 1.5);
    ctx.arc(point.x + 17 * scale, point.y + 6 * scale, 10 * scale, 3.1, 4.65);
    ctx.stroke();
    ctx.restore();
  }

  function drawShop(ctx, point, scale) {
    const width = 68 * scale;
    const height = 47 * scale;
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.fillRect(point.x - width * 0.35, point.y + height * 0.38, width * 0.9, 8 * scale);
    ctx.fillStyle = "#f6c96a";
    drawRoundRect(ctx, point.x - width / 2, point.y - height / 2, width, height, 3 * scale);
    ctx.fill();
    ctx.fillStyle = "#d58b5c";
    drawPolygon(ctx, [
      { x: point.x + width / 2, y: point.y - height / 2 },
      { x: point.x + width * 0.65, y: point.y - height * 0.35 },
      { x: point.x + width * 0.65, y: point.y + height * 0.45 },
      { x: point.x + width / 2, y: point.y + height / 2 }
    ], "#d58b5c");
    ctx.fillStyle = "#f5ead1";
    drawPolygon(ctx, [
      { x: point.x - width * 0.56, y: point.y - height * 0.56 },
      { x: point.x + width * 0.42, y: point.y - height * 0.56 },
      { x: point.x + width * 0.58, y: point.y - height * 0.37 },
      { x: point.x - width * 0.42, y: point.y - height * 0.37 }
    ], "#f5ead1");
    ctx.fillStyle = "#2478a8";
    ctx.fillRect(point.x - width * 0.28, point.y - height * 0.1, width * 0.24, height * 0.32);
    ctx.fillRect(point.x + width * 0.09, point.y - height * 0.1, width * 0.21, height * 0.32);
    ctx.fillStyle = "#df554d";
    for (let index = 0; index < 4; index += 1) {
      ctx.fillRect(point.x - width * 0.38 + index * width * 0.16, point.y + height * 0.2, width * 0.08, height * 0.18);
    }
    ctx.restore();
  }

  function drawHouse(ctx, point, scale) {
    const width = 64 * scale;
    const height = 43 * scale;
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.beginPath();
    ctx.ellipse(point.x + 7 * scale, point.y + height * 0.55, width * 0.62, 9 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2e3bc";
    drawPolygon(ctx, [
      { x: point.x - width / 2, y: point.y - height * 0.1 },
      { x: point.x + width * 0.18, y: point.y - height * 0.1 },
      { x: point.x + width * 0.18, y: point.y + height / 2 },
      { x: point.x - width / 2, y: point.y + height / 2 }
    ], "#f2e3bc", "#c2a773");
    drawPolygon(ctx, [
      { x: point.x + width * 0.18, y: point.y - height * 0.1 },
      { x: point.x + width / 2, y: point.y + height * 0.08 },
      { x: point.x + width / 2, y: point.y + height * 0.43 },
      { x: point.x + width * 0.18, y: point.y + height / 2 }
    ], "#d5bd8f", "#a88961");
    drawPolygon(ctx, [
      { x: point.x - width * 0.58, y: point.y - height * 0.12 },
      { x: point.x - width * 0.16, y: point.y - height * 0.64 },
      { x: point.x + width * 0.56, y: point.y - height * 0.18 },
      { x: point.x + width * 0.15, y: point.y + height * 0.02 }
    ], "#2e67ae", "#1e477f");
    ctx.fillStyle = "#7b512d";
    ctx.fillRect(point.x - width * 0.12, point.y + height * 0.12, width * 0.16, height * 0.38);
    ctx.fillStyle = "#5eb6db";
    ctx.fillRect(point.x - width * 0.38, point.y + height * 0.08, width * 0.15, height * 0.18);
    ctx.fillRect(point.x + width * 0.24, point.y + height * 0.1, width * 0.11, height * 0.16);
    ctx.restore();
  }

  function drawGasStation(ctx, point, scale) {
    const width = 64 * scale;
    ctx.save();
    ctx.fillStyle = "#e7504d";
    drawPolygon(ctx, [
      { x: point.x - width / 2, y: point.y - 22 * scale },
      { x: point.x + width / 2, y: point.y - 22 * scale },
      { x: point.x + width * 0.64, y: point.y - 13 * scale },
      { x: point.x - width * 0.42, y: point.y - 13 * scale }
    ], "#e7504d", "#9e3434");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(point.x - width * 0.31, point.y - 13 * scale, width * 0.09, 31 * scale);
    ctx.fillRect(point.x + width * 0.22, point.y - 13 * scale, width * 0.09, 31 * scale);
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(point.x - width * 0.06, point.y - 5 * scale, width * 0.15, 20 * scale);
    ctx.fillStyle = "#e9f3f5";
    ctx.fillRect(point.x - width * 0.04, point.y - 2 * scale, width * 0.1, 7 * scale);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(point.x + width * 0.61, point.y - 31 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e7504d";
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(point.x + width * 0.61, point.y - 31 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoad(ctx, geo) {
    const nearWidth = geo.roadHalf * 1.25;
    const farWidth = geo.roadHalf * 0.82;
    const shoulder = [
      vectorPoint(geo.anchor, -geo.span, -(nearWidth + 11)),
      vectorPoint(geo.anchor, -geo.span, nearWidth + 11),
      vectorPoint(geo.anchor, geo.span, farWidth + 8),
      vectorPoint(geo.anchor, geo.span, -(farWidth + 8))
    ];
    drawPolygon(ctx, shoulder, "#f5f0df", "#d4cfc1");
    const corners = [
      vectorPoint(geo.anchor, -geo.span, -nearWidth),
      vectorPoint(geo.anchor, -geo.span, nearWidth),
      vectorPoint(geo.anchor, geo.span, farWidth),
      vectorPoint(geo.anchor, geo.span, -farWidth)
    ];
    drawPolygon(ctx, corners, "#4a596b", "#2f3e51");
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 3;
    [[corners[0], corners[3]], [corners[1], corners[2]]].forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });
    ctx.restore();
    const face = [corners[1], corners[2], vectorPoint(corners[2], 0, 9), vectorPoint(corners[1], 0, 12)];
    drawPolygon(ctx, face, "#2f3e51");
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 3;
    for (let index = -4; index <= 4; index += 1) {
      const start = vectorPoint(geo.anchor, -geo.span, index * geo.roadHalf * 0.2);
      const end = vectorPoint(geo.anchor, geo.span, index * geo.roadHalf * 0.13);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoadside(ctx, geo, round) {
    const reference = currentReferenceDistance(round);
    const markerOffset = reference % 54;
    ctx.save();
    ctx.lineCap = "round";
    for (let index = -7; index <= 7; index += 1) {
      const along = index * 54 - markerOffset;
      const scale = perspective(geo, along);
      const center = project(geo, along, 0);
      const laneWidth = geo.roadHalf * scale;
      [-(laneWidth * 0.3), laneWidth * 0.3].forEach((sideOffset) => {
        const start = vectorPoint(center, -11 * scale, sideOffset);
        const end = vectorPoint(center, 11 * scale, sideOffset);
        ctx.strokeStyle = "rgba(255,255,255,0.84)";
        ctx.lineWidth = Math.max(1.5, 2.3 * scale);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
      [-3.5 * scale, 3.5 * scale].forEach((sideOffset) => {
        const start = vectorPoint(center, -19 * scale, sideOffset);
        const end = vectorPoint(center, 19 * scale, sideOffset);
        ctx.strokeStyle = "#f4c242";
        ctx.lineWidth = Math.max(1.6, 2.3 * scale);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
    }
    for (let index = -5; index <= 5; index += 1) {
      const along = index * 92 - reference;
      const side = index % 2 === 0 ? geo.roadHalf * 1.55 : -geo.roadHalf * 1.48;
      const point = project(geo, along, side);
      const scale = Math.max(0.58, perspective(geo, along));
      drawTree(ctx, point, scale);
      if (index % 2 !== 0) drawLamp(ctx, project(geo, along + 24, side * 0.9), scale);
    }
    ctx.restore();
  }

  function drawTree(ctx, point, scale) {
    ctx.fillStyle = "rgba(22, 101, 52, 0.2)";
    ctx.beginPath();
    ctx.ellipse(point.x + 8 * scale, point.y + 10 * scale, 19 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#805638";
    ctx.fillRect(point.x - 3 * scale, point.y - 2 * scale, 6 * scale, 18 * scale);
    ctx.fillStyle = "#3d884d";
    ctx.beginPath();
    ctx.arc(point.x, point.y - 14 * scale, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6eae59";
    ctx.beginPath();
    ctx.arc(point.x - 8 * scale, point.y - 10 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.arc(point.x + 8 * scale, point.y - 9 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShrub(ctx, point, scale) {
    ctx.save();
    ctx.fillStyle = "rgba(22,101,52,0.14)";
    ctx.beginPath();
    ctx.ellipse(point.x + 3 * scale, point.y + 5 * scale, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#368b4a";
    ctx.beginPath();
    ctx.arc(point.x - 5 * scale, point.y, 8 * scale, 0, Math.PI * 2);
    ctx.arc(point.x + 4 * scale, point.y - 2 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#69a94d";
    ctx.beginPath();
    ctx.arc(point.x + 2 * scale, point.y - 6 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPine(ctx, point, scale) {
    ctx.save();
    ctx.fillStyle = "rgba(15,72,43,0.18)";
    ctx.beginPath();
    ctx.ellipse(point.x + 5 * scale, point.y + 8 * scale, 11 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#815334";
    ctx.fillRect(point.x - 2 * scale, point.y - 2 * scale, 4 * scale, 16 * scale);
    [0, 9, 17].forEach((offset, index) => {
      const width = (15 - index * 3) * scale;
      const y = point.y + 4 * scale - offset * scale;
      drawPolygon(ctx, [
        { x: point.x, y: y - 19 * scale },
        { x: point.x - width, y: y + 6 * scale },
        { x: point.x + width, y: y + 6 * scale }
      ], index === 0 ? "#2d8a50" : "#247342");
    });
    ctx.restore();
  }

  function drawRock(ctx, point, scale) {
    drawPolygon(ctx, [
      { x: point.x - 9 * scale, y: point.y + 5 * scale },
      { x: point.x - 4 * scale, y: point.y - 5 * scale },
      { x: point.x + 8 * scale, y: point.y - 2 * scale },
      { x: point.x + 11 * scale, y: point.y + 6 * scale }
    ], "#8d9aa0", "#718087");
  }

  function drawLamp(ctx, point, scale) {
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y + 15 * scale);
    ctx.lineTo(point.x, point.y - 15 * scale);
    ctx.lineTo(point.x + 7 * scale, point.y - 15 * scale);
    ctx.stroke();
    ctx.fillStyle = "#f8e9a1";
    ctx.fillRect(point.x + 5 * scale, point.y - 14 * scale, 5 * scale, 4 * scale);
  }

  function vehicleCorners(center, longitudinal, lateral) {
    return [
      vectorPoint(center, longitudinal, lateral),
      vectorPoint(center, longitudinal, -lateral),
      vectorPoint(center, -longitudinal, -lateral),
      vectorPoint(center, -longitudinal, lateral)
    ];
  }

  function drawVehicle(ctx, geo, vehicle) {
    const meta = VEHICLES[vehicle.id];
    const center = project(geo, vehicle.along, vehicle.lane);
    const length = 23 * vehicle.scale;
    const width = 14 * vehicle.scale;
    const shadow = vectorPoint(center, 4 * vehicle.scale, 7 * vehicle.scale);
    ctx.fillStyle = "rgba(15, 23, 42, 0.2)";
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, length * 1.05, width * 0.9, ROAD_ANGLE, 0, Math.PI * 2);
    ctx.fill();

    if (state.selected === vehicle.id) {
      ctx.strokeStyle = "rgba(37, 99, 235, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, length * 1.45, width * 1.65, ROAD_ANGLE, 0, Math.PI * 2);
      ctx.stroke();
    }

    const body = vehicleCorners(center, length, width);
    const depth = { x: 0, y: 6 * vehicle.scale };
    drawPolygon(ctx, [body[1], body[2], { x: body[2].x + depth.x, y: body[2].y + depth.y }, { x: body[1].x + depth.x, y: body[1].y + depth.y }], meta.dark, "rgba(0,0,0,0.18)");
    drawPolygon(ctx, [body[2], body[3], { x: body[3].x + depth.x, y: body[3].y + depth.y }, { x: body[2].x + depth.x, y: body[2].y + depth.y }], meta.dark, "rgba(0,0,0,0.18)");
    drawPolygon(ctx, body, meta.color, meta.dark);
    const roofCenter = vectorPoint(center, -3 * vehicle.scale, 0);
    const roof = vehicleCorners(roofCenter, length * 0.47, width * 0.69);
    drawPolygon(ctx, roof, meta.shape === "minibus" ? "#dcebef" : "#b9d9e9", meta.dark);
    const windshieldCenter = vectorPoint(center, length * 0.36, 0);
    const windshield = vehicleCorners(windshieldCenter, length * 0.17, width * 0.64);
    drawPolygon(ctx, windshield, "#79b8d6", meta.dark);
    const rearWindow = vehicleCorners(vectorPoint(center, -length * 0.43, 0), length * 0.12, width * 0.6);
    drawPolygon(ctx, rearWindow, "#9ccce1", meta.dark);
    drawWheels(ctx, center, length, width, vehicle.scale);
    ctx.fillStyle = "#f8fafc";
    const light = vectorPoint(center, length * 0.94, 0);
    ctx.beginPath();
    ctx.arc(light.x, light.y, Math.max(1.4, 2.2 * vehicle.scale), 0, Math.PI * 2);
    ctx.fill();
    drawVehicleLabel(ctx, center, vehicle, meta);
  }

  function drawWheels(ctx, center, length, width, scale) {
    const wheelPoints = [
      vectorPoint(center, length * 0.6, width * 0.98),
      vectorPoint(center, -length * 0.58, width * 0.98)
    ];
    ctx.save();
    wheelPoints.forEach((point) => {
      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 3 * scale, 4.5 * scale, 3 * scale, ROAD_ANGLE, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(point.x, point.y + 3 * scale, 1.35 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawVehicleLabel(ctx, center, vehicle, meta) {
    const label = state.selected === vehicle.id ? `${meta.name}　參考系` : meta.name;
    const offsets = {
      A: { x: -12, y: -42 },
      B: { x: -92, y: 16 },
      C: { x: 34, y: -30 }
    };
    const offset = offsets[vehicle.id];
    ctx.save();
    ctx.font = "700 14px Segoe UI, Tahoma, sans-serif";
    const width = ctx.measureText(label).width + 16;
    const x = center.x - width / 2 + offset.x * vehicle.scale;
    const y = center.y + offset.y * vehicle.scale;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundRect(ctx, x, y, width, 23, 7);
    ctx.fill();
    ctx.strokeStyle = state.selected === vehicle.id ? "#2563eb" : "rgba(31,41,55,0.24)";
    ctx.lineWidth = 1;
    drawRoundRect(ctx, x, y, width, 23, 7);
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 8, y + 11.5);
    ctx.restore();
  }

  function drawRoadObserver(ctx, geo, round) {
    const reference = currentReferenceDistance(round);
    const point = project(geo, -reference - 8, -geo.roadHalf * 1.23);
    const selected = state.selected === "R";
    ctx.save();
    if (selected) {
      ctx.strokeStyle = "rgba(37,99,235,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#475569";
    drawRoundRect(ctx, point.x - 11, point.y - 8, 22, 15, 3);
    ctx.fill();
    ctx.fillStyle = "#dbeafe";
    ctx.beginPath();
    ctx.arc(point.x + 4, point.y - 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(point.x - 5, point.y + 7);
    ctx.lineTo(point.x - 9, point.y + 19);
    ctx.moveTo(point.x + 4, point.y + 7);
    ctx.lineTo(point.x + 9, point.y + 19);
    ctx.stroke();
    ctx.font = "700 13px Segoe UI, Tahoma, sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText(selected ? "路旁觀察者　參考系" : "路旁觀察者", point.x - 33, point.y - 17);
    ctx.restore();
  }

  function tick(now) {
    const elapsed = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;
    if (state.playback === "playing") {
      state.simTime += elapsed * (state.slow ? SLOW_FACTOR : 1);
      if (state.simTime >= SIMULATION_SECONDS) {
        state.simTime = SIMULATION_SECONDS;
        state.playback = "observed";
        state.observedCandidates.add(state.selected);
        announce(observationSummary("觀察完成"));
        renderUI();
      }
    }
    drawScene();
    window.requestAnimationFrame(tick);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
    canvas.width = Math.round(state.view.width * dpr);
    canvas.height = Math.round(state.view.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene();
  }

  candidateButtons.forEach((button) => button.addEventListener("click", () => chooseCandidate(button.dataset.candidate)));
  startButton.addEventListener("click", () => startObservation(true));
  pauseButton.addEventListener("click", pauseOrResume);
  replayButton.addEventListener("click", () => startObservation(true));
  slowButton.addEventListener("click", () => {
    if (state.playback === "playing") return;
    state.slow = !state.slow;
    renderUI();
  });
  recordButton.addEventListener("click", recordAnswer);
  guideButton.addEventListener("click", completeGuide);
  submitButton.addEventListener("click", submitAnswers);

  window.SimScorm.init();
  if (window.SimScorm.isAttemptFinished()) restoreSubmittedAttempt();
  else createAttempt();
  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();
  renderUI();
  window.requestAnimationFrame(tick);
})();
