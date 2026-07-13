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
  const ACTIVITY = "inertial-reference-frame-road-observer";
  const SLOW_FACTOR = 0.5;
  const MIN_VISIBLE_DISPLACEMENT = 54;
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
    { positions: [-20, 0, 20], lanes: [-2 / 3, 0, 2 / 3] },
    { positions: [16, -20, 4], lanes: [-2 / 3, 0, 2 / 3] },
    { positions: [-4, 20, -20], lanes: [-2 / 3, 0, 2 / 3] },
    { positions: [20, -4, -16], lanes: [-2 / 3, 0, 2 / 3] }
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
    unavailableReason: "",
    view: { width: 760, height: 480, dpr: 1 }
  };
  const animationLoop = window.createAnimationLoop({
    requestFrame: window.requestAnimationFrame.bind(window),
    cancelFrame: window.cancelAnimationFrame.bind(window),
    now: () => performance.now(),
    onFrame: animate
  });

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

  function createAttempt() {
    const random = mulberry32(randomSeed());
    const spec = Scoring.generateAttemptSpec(random);
    state.rounds = Scoring.instantiateAttempt(spec.permutations, spec.layouts, spec.roundOrder);
    if (!Scoring.validateAttempt(state.rounds)) throw new Error("Generated attempt failed validation");
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
    return value === "up" ? "沿道路正方向移動" : "沿道路反方向移動";
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
    const next = Scoring.nextStateAfterRecord(state.fromReview, state.activeIndex, state.rounds.length);
    if (next.mode === "review") {
      showReview();
      return;
    }
    beginRound(next.activeIndex, false);
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
    saveDraft();
  }

  function showReview() {
    state.mode = "review";
    state.selected = null;
    state.playback = "idle";
    state.simTime = 0;
    state.fromReview = false;
    renderUI();
    saveDraft();
  }

  function submitAnswers() {
    if (state.locked || state.answers.some((answer) => !answer)) return;
    if (!window.confirm("確認提交全部答案？提交後本次嘗試只可重看。")) return;
    const result = Scoring.scoreAttempt(state.rounds, state.answers);
    const answer = {
      rounds: state.rounds.map(Scoring.snapshotRound),
      answers: state.answers.slice()
    };
    const snapshot = window.SimScorm.makeSnapshot(ACTIVITY, "review", answer, result);
    const lockSubmitted = (message) => {
        state.result = result;
        state.locked = true;
        state.mode = "submitted";
        state.selected = null;
        state.playback = "idle";
        if (message) window.alert(message);
    };
    const handle = (submission) => window.SimActivityFlow.submission(submission, {
      success: () => lockSubmitted(),
      committed: () => lockSubmitted("成績已保存；Moodle session 會在離開頁面時再次完成。"),
      frozen: () => lockSubmitted("提交狀態未確認；答案已凍結，請重新開啟活動再試。"),
      retry: () => window.alert("未能傳送到 Moodle，請重試。")
    });
    window.SimScorm.submitWithCallbacks(result, snapshot, { onFailure: handle, onSuccess: handle });
    renderUI();
  }

  function restoreSubmittedAttempt(attempt) {
    const saved = attempt?.snapshot || attempt?.review || null;
    const rawLmsScore = String(attempt?.score ?? "");
    const lmsScore = rawLmsScore.trim() === "" ? NaN : Number(rawLmsScore);
    try {
      if (!saved || !Array.isArray(saved.answer.rounds) || saved.answer.rounds.length !== 5) {
        throw new Error("Unsupported review state");
      }
      const rounds = saved.answer.rounds.map(Scoring.roundFromSnapshot);
      if (!Scoring.validateAttempt(rounds)) throw new Error("Invalid saved attempt structure");
      if (!Scoring.validateAnswers(saved.answer.answers, rounds.length)) throw new Error("Invalid saved answers");
      const result = Scoring.scoreAttempt(rounds, saved.answer.answers);
      const outcome = window.SimActivityFlow.reviewResult(result, saved, attempt);
      state.rounds = rounds;
      state.answers = saved.answer.answers;
      state.result = outcome.result;
      state.trustedReview = outcome.trusted;
      state.mode = "submitted";
      state.locked = true;
      state.selected = null;
      state.playback = "idle";
      return;
    } catch (error) {
      state.rounds = [];
      state.answers = [];
      const recorded = window.SimActivityFlow.recordedResult(attempt);
      state.result = {
        score: recorded.score,
        maxScore: 100,
        passed: recorded.passed,
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

  function draftState() {
    return window.SimScorm.makeSnapshot(ACTIVITY, "draft", {
      rounds: state.rounds.map(Scoring.snapshotRound),
      answers: state.answers.slice(),
      activeIndex: state.activeIndex,
      mode: state.mode,
      fromReview: state.fromReview,
      selected: state.selected,
      observedCandidates: Array.from(state.observedCandidates)
    });
  }

  function saveDraft() {
    if (!state.locked && state.rounds.length) window.SimScorm.saveDraft(draftState());
  }

  function restoreDraft(saved) {
    const restored = saved && Scoring.restoreDraft(saved.answer);
    if (!restored) return false;
    Object.assign(state, restored, {
      observedCandidates: new Set(restored.observedCandidates),
      playback: restored.selected && restored.observedCandidates.includes(restored.selected) ? "observed" : "idle"
    });
    return true;
  }

  function renderUI() {
    const isGuide = state.mode === "guide";
    const isTask = state.mode === "task";
    const isReview = state.mode === "review";
    const isSubmitted = state.mode === "submitted";
    const isUnavailable = isSubmitted && Boolean(state.unavailableReason);
    const round = (isGuide || isTask) ? activeRound() : null;

    headerText.textContent = isGuide
      ? "本活動把路旁及做勻速直線運動的車視為慣性參考系；先以一個參考物體觀察，理解畫面中「靜止」取決於參考系。"
      : "本活動把路旁及做勻速直線運動的車視為慣性參考系；請根據相對位置的改變找出合適的參考物體。";
    roundHeading.textContent = isGuide ? "導覽：先試一次" : isTask ? `第 ${state.activeIndex + 1} 題／5 題` : isReview ? "提交前檢查" : isUnavailable ? "Moodle 狀態暫時無法確認" : "提交結果";
    taskIntro.textContent = isGuide
      ? "選擇一個參考物體，播放後留意：被選物體會固定，而其他物體的相對位置可能改變。"
      : isTask
        ? "每題可能有一個或多個合適答案。請選擇任何一個同時符合全部條件的參考物體。"
        : isReview
          ? "可按任何一題返回觀察及修改答案。全部確認後才提交。"
          : isUnavailable
            ? state.unavailableReason
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
      ? isUnavailable ? "狀態未確認" : "本次嘗試已鎖定"
      : state.selected
        ? `目前參考系：${displayName(state.selected)}`
        : "請先選擇參考物體";
    drawScene();
    syncAnimation();
  }

  function statusMessage() {
    if (state.mode === "guide") return state.selected ? "完成一次完整觀察後即可開始正式任務。" : "尚未選擇參考物體。";
    if (state.mode === "review") return state.answers.every(Boolean) ? "五題答案已齊，可提交。" : "仍有未完成的題目。";
    if (state.mode === "submitted") return state.unavailableReason || (state.trustedReview ? "已提交至 Moodle／本機 SCORM 記錄。" : "已提交；只可查看安全摘要。");
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
    const result = state.result;
    const score = document.createElement("div");
    score.className = "score-value";
    score.textContent = result?.score == null ? "--" : `${result.score} / ${result.maxScore}`;
    const status = document.createElement("div");
    status.className = "muted";
    status.textContent = result?.passed === true ? "已達到合格要求。" : result?.passed === false ? "未達到合格要求。" : "未能安全判斷合格狀態。";
    scorePanel.replaceChildren(score, status);
    feedbackList.innerHTML = "";
    if (!state.trustedReview || !result) {
      const item = document.createElement("div");
      item.className = "feedback-item is-wrong";
      item.textContent = state.unavailableReason || "題目資料無法安全重建；以上只顯示可確認的 Moodle 記錄。";
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
    const narrowScreenSpeedScale = Math.max(0.82, Math.min(1, width / 600));
    return {
      anchor: { x: width * 0.5, y: height * 0.56 },
      span: diagonal * 0.72,
      roadHalf: Math.max(74, Math.min(height * 0.28, width * 0.22)),
      decorScale: Math.max(0.72, Math.min(1, width / 720)),
      speed: MIN_VISIBLE_DISPLACEMENT * narrowScreenSpeedScale / SIMULATION_SECONDS
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
        lane: layout.lanes[index] * geometryValue.roadHalf,
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
      drawHill(ctx, project(geo, along, -geo.roadHalf * 2.05), Math.max(0.72, perspective(geo, along)) * geo.decorScale, index % 2 === 0 ? "#8bc653" : "#79b94b");
      drawHill(ctx, project(geo, along + 65, geo.roadHalf * 2.15), Math.max(0.68, perspective(geo, along + 65)) * geo.decorScale, "#9fce62");
    }

    drawPond(ctx, project(geo, 98 - reference, -geo.roadHalf * 1.78), Math.max(0.66, perspective(geo, 98 - reference)) * geo.decorScale);
    drawShop(ctx, project(geo, -155 - reference, -geo.roadHalf * 1.66), Math.max(0.72, perspective(geo, -155 - reference)) * geo.decorScale);
    drawHouseIfVisible(ctx, project(geo, -228 - reference, geo.roadHalf * 1.66), Math.max(0.66, perspective(geo, -228 - reference)) * geo.decorScale);
    drawShop(ctx, project(geo, -18 - reference, -geo.roadHalf * 1.68), Math.max(0.7, perspective(geo, -18 - reference)) * geo.decorScale);
    drawGasStation(ctx, project(geo, 165 - reference, -geo.roadHalf * 1.45), Math.max(0.68, perspective(geo, 165 - reference)) * geo.decorScale);
    drawHouseIfVisible(ctx, project(geo, 150 - reference, geo.roadHalf * 1.72), Math.max(0.7, perspective(geo, 150 - reference)) * geo.decorScale);

    for (let index = -5; index <= 5; index += 1) {
      const worldAlong = index * 77;
      const along = worldAlong - reference;
      const side = index % 2 === 0 ? -geo.roadHalf * 1.52 : geo.roadHalf * 1.55;
      const point = project(geo, along, side);
      const scale = Math.max(0.58, perspective(geo, along)) * geo.decorScale;
      const overlapsUpperLandmark = side < 0 && [98, 165].some((landmarkAlong) => Math.abs(worldAlong - landmarkAlong) < 50);
      const overlapsLowerHouse = side > 0 && [-228, 150].some((houseAlong) => Math.abs(worldAlong - houseAlong) < 65);
      if (!overlapsUpperLandmark && !overlapsLowerHouse) {
        drawShrub(ctx, point, scale * (index % 3 === 0 ? 1.25 : 0.9));
        if (index % 3 === 1) drawRock(ctx, project(geo, along + 17, side * 1.15), scale);
        if (index % 4 === 2) drawPine(ctx, project(geo, along - 18, side * 1.12), scale * 1.1);
      }
    }
  }

  function drawHill(ctx, point, scale, color) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(point.x - 78 * scale, point.y + 7 * scale);
    ctx.bezierCurveTo(point.x - 48 * scale, point.y - 24 * scale, point.x - 20 * scale, point.y - 28 * scale, point.x, point.y - 14 * scale);
    ctx.bezierCurveTo(point.x + 26 * scale, point.y - 40 * scale, point.x + 61 * scale, point.y - 23 * scale, point.x + 82 * scale, point.y + 7 * scale);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.beginPath();
    ctx.ellipse(point.x - 25 * scale, point.y - 13 * scale, 27 * scale, 8 * scale, -0.18, 0, Math.PI * 2);
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
    const height = 44 * scale;
    const depth = 13 * scale;
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.beginPath();
    ctx.ellipse(point.x + 5 * scale, point.y + 5 * scale, width * 0.62, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPolygon(ctx, [
      { x: point.x - width / 2, y: point.y - height },
      { x: point.x + width * 0.34, y: point.y - height },
      { x: point.x + width * 0.34, y: point.y },
      { x: point.x - width / 2, y: point.y }
    ], "#f4c96d", "#bd8746");
    drawPolygon(ctx, [
      { x: point.x + width * 0.34, y: point.y - height },
      { x: point.x + width * 0.34 + depth, y: point.y - height - depth * 0.55 },
      { x: point.x + width * 0.34 + depth, y: point.y - depth * 0.55 },
      { x: point.x + width * 0.34, y: point.y }
    ], "#cf8f55", "#a96639");
    drawPolygon(ctx, [
      { x: point.x - width * 0.56, y: point.y - height - 3 * scale },
      { x: point.x + width * 0.34, y: point.y - height - 3 * scale },
      { x: point.x + width * 0.34 + depth, y: point.y - height - depth * 0.55 - 3 * scale },
      { x: point.x - width * 0.38, y: point.y - height - depth * 0.55 - 3 * scale }
    ], "#f7ead0", "#bda780");
    ctx.fillStyle = "#287da5";
    ctx.fillRect(point.x - width * 0.37, point.y - height * 0.61, width * 0.22, height * 0.35);
    ctx.fillRect(point.x - width * 0.03, point.y - height * 0.61, width * 0.22, height * 0.35);
    for (let index = 0; index < 5; index += 1) {
      ctx.fillStyle = index % 2 ? "#f7efe0" : "#df554d";
      ctx.fillRect(point.x - width * 0.51 + index * width * 0.17, point.y - height * 0.18, width * 0.17, height * 0.18);
    }
    ctx.restore();
  }

  function drawHouseIfVisible(ctx, point, scale) {
    const horizontalExtent = 46 * scale;
    const roofHeight = 72 * scale;
    const left = point.x - horizontalExtent;
    const right = point.x + horizontalExtent;
    const top = point.y - roofHeight;
    const bottom = point.y + 8 * scale;
    const overlapsMobileLegend = state.view.width < 700 && right > state.view.width - 180 && bottom > state.view.height - 90;
    if (
      left < 0 ||
      right > state.view.width ||
      bottom > state.view.height ||
      top < 0 ||
      overlapsMobileLegend
    ) return;
    drawHouse(ctx, point, scale);
  }

  function drawHouse(ctx, point, scale) {
    const width = 64 * scale;
    const height = 42 * scale;
    const depth = 17 * scale;
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.beginPath();
    ctx.ellipse(point.x + 7 * scale, point.y + 4 * scale, width * 0.62, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2e3bc";
    drawPolygon(ctx, [
      { x: point.x - width / 2, y: point.y - height },
      { x: point.x + width * 0.25, y: point.y - height },
      { x: point.x + width * 0.25, y: point.y },
      { x: point.x - width / 2, y: point.y }
    ], "#f2e3bc", "#bfa475");
    drawPolygon(ctx, [
      { x: point.x + width * 0.25, y: point.y - height },
      { x: point.x + width * 0.25 + depth, y: point.y - height - depth * 0.45 },
      { x: point.x + width * 0.25 + depth, y: point.y - depth * 0.45 },
      { x: point.x + width * 0.25, y: point.y }
    ], "#d5bd8f", "#a88961");
    const leftEave = { x: point.x - width * 0.58, y: point.y - height + 2 * scale };
    const ridge = { x: point.x - width * 0.14, y: point.y - height - 24 * scale };
    const rightEave = { x: point.x + width * 0.3, y: point.y - height + 2 * scale };
    drawPolygon(ctx, [
      ridge,
      rightEave,
      { x: rightEave.x + depth, y: rightEave.y - depth * 0.45 },
      { x: ridge.x + depth, y: ridge.y - depth * 0.45 }
    ], "#244f88", "#173c6b");
    drawPolygon(ctx, [leftEave, ridge, rightEave], "#2e67ae", "#1e477f");
    ctx.fillStyle = "#7b512d";
    ctx.fillRect(point.x - width * 0.08, point.y - height * 0.46, width * 0.17, height * 0.46);
    ctx.fillStyle = "#5eb6db";
    ctx.fillRect(point.x - width * 0.39, point.y - height * 0.58, width * 0.17, height * 0.23);
    ctx.fillRect(point.x + width * 0.34, point.y - height * 0.59, width * 0.11, height * 0.2);
    ctx.restore();
  }

  function drawGasStation(ctx, point, scale) {
    const width = 64 * scale;
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.15)";
    ctx.beginPath();
    ctx.ellipse(point.x + 4 * scale, point.y + 3 * scale, width * 0.62, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPolygon(ctx, [
      { x: point.x - width * 0.52, y: point.y + 1 * scale },
      { x: point.x + width * 0.47, y: point.y + 1 * scale },
      { x: point.x + width * 0.6, y: point.y - 5 * scale },
      { x: point.x - width * 0.39, y: point.y - 5 * scale }
    ], "#e8d1a0", "#c9ac73");
    drawPolygon(ctx, [
      { x: point.x - width / 2, y: point.y - 29 * scale },
      { x: point.x + width * 0.42, y: point.y - 29 * scale },
      { x: point.x + width * 0.61, y: point.y - 38 * scale },
      { x: point.x - width * 0.31, y: point.y - 38 * scale }
    ], "#e7504d", "#9e3434");
    drawPolygon(ctx, [
      { x: point.x - width / 2, y: point.y - 29 * scale },
      { x: point.x + width * 0.42, y: point.y - 29 * scale },
      { x: point.x + width * 0.42, y: point.y - 24 * scale },
      { x: point.x - width / 2, y: point.y - 24 * scale }
    ], "#c53d3d", "#963232");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(point.x - width * 0.34, point.y - 24 * scale, width * 0.08, 25 * scale);
    ctx.fillRect(point.x + width * 0.24, point.y - 24 * scale, width * 0.08, 25 * scale);
    ctx.fillStyle = "#566575";
    ctx.fillRect(point.x - width * 0.07, point.y - 17 * scale, width * 0.17, 18 * scale);
    ctx.fillStyle = "#e9f3f5";
    ctx.fillRect(point.x - width * 0.045, point.y - 14 * scale, width * 0.12, 6 * scale);
    ctx.strokeStyle = "#27384a";
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.beginPath();
    ctx.moveTo(point.x + width * 0.1, point.y - 12 * scale);
    ctx.quadraticCurveTo(point.x + width * 0.2, point.y - 12 * scale, point.x + width * 0.18, point.y - 2 * scale);
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
    const dashSpacing = 58;
    const markerOffset = reference % dashSpacing;
    const firstDash = Math.floor((-geo.span + markerOffset) / dashSpacing) - 1;
    const lastDash = Math.ceil((geo.span + markerOffset) / dashSpacing) + 1;
    ctx.save();
    ctx.lineCap = "round";
    for (let index = firstDash; index <= lastDash; index += 1) {
      const along = index * dashSpacing - markerOffset;
      const scale = perspective(geo, along);
      const center = project(geo, along, 0);
      const laneWidth = geo.roadHalf * scale;
      [-(laneWidth / 3), laneWidth / 3].forEach((sideOffset) => {
        const start = vectorPoint(center, -18 * scale, sideOffset);
        const end = vectorPoint(center, 18 * scale, sideOffset);
        ctx.strokeStyle = "rgba(255,255,255,0.84)";
        ctx.lineWidth = Math.max(1.5, 2.3 * scale);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
    }
    for (let index = -5; index <= 5; index += 1) {
      const worldAlong = index * 92;
      const along = worldAlong - reference;
      const side = index % 2 === 0 ? geo.roadHalf * 1.55 : -geo.roadHalf * 1.48;
      const point = project(geo, along, side);
      const scale = Math.max(0.58, perspective(geo, along)) * geo.decorScale;
      const overlapsHouse = side > 0 && [-228, 150].some((houseAlong) => Math.abs(worldAlong - houseAlong) < 65);
      const overlapsUpperLandmark = side < 0 && [98, 165].some((landmarkAlong) => Math.abs(worldAlong - landmarkAlong) < 50);
      if (!overlapsHouse && !overlapsUpperLandmark) drawTree(ctx, point, scale);
      if (index % 2 !== 0) drawLamp(ctx, project(geo, along + 24, side * 0.9), scale);
    }
    ctx.restore();
  }

  function drawTree(ctx, point, scale) {
    ctx.save();
    ctx.fillStyle = "rgba(22, 101, 52, 0.2)";
    ctx.beginPath();
    ctx.ellipse(point.x + 8 * scale, point.y + 2 * scale, 19 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#805638";
    drawPolygon(ctx, [
      { x: point.x - 4 * scale, y: point.y },
      { x: point.x + 4 * scale, y: point.y },
      { x: point.x + 3 * scale, y: point.y - 27 * scale },
      { x: point.x - 3 * scale, y: point.y - 27 * scale }
    ], "#805638", "#67432d");
    ctx.fillStyle = "#3b8448";
    ctx.beginPath();
    ctx.arc(point.x, point.y - 31 * scale, 17 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6eae59";
    ctx.beginPath();
    ctx.arc(point.x - 9 * scale, point.y - 27 * scale, 11 * scale, 0, Math.PI * 2);
    ctx.arc(point.x + 10 * scale, point.y - 27 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(point.x - 5 * scale, point.y - 38 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShrub(ctx, point, scale) {
    ctx.save();
    ctx.fillStyle = "rgba(22,101,52,0.14)";
    ctx.beginPath();
    ctx.ellipse(point.x + 3 * scale, point.y + 1 * scale, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#368b4a";
    ctx.beginPath();
    ctx.arc(point.x - 5 * scale, point.y - 5 * scale, 8 * scale, 0, Math.PI * 2);
    ctx.arc(point.x + 4 * scale, point.y - 7 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#69a94d";
    ctx.beginPath();
    ctx.arc(point.x + 2 * scale, point.y - 12 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPine(ctx, point, scale) {
    ctx.save();
    ctx.fillStyle = "rgba(15,72,43,0.18)";
    ctx.beginPath();
    ctx.ellipse(point.x + 5 * scale, point.y + 1 * scale, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#815334";
    ctx.fillRect(point.x - 2.5 * scale, point.y - 28 * scale, 5 * scale, 29 * scale);
    [0, 10, 20].forEach((offset, index) => {
      const width = (17 - index * 3) * scale;
      const y = point.y - 15 * scale - offset * scale;
      drawPolygon(ctx, [
        { x: point.x, y: y - 21 * scale },
        { x: point.x - width, y: y + 8 * scale },
        { x: point.x + width, y: y + 8 * scale }
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
    const isMinibus = meta.shape === "minibus";
    const center = project(geo, vehicle.along, vehicle.lane);
    const length = (isMinibus ? 31 : 23) * vehicle.scale;
    const width = (isMinibus ? 15 : 14) * vehicle.scale;
    const bodyDepth = (isMinibus ? 10 : 7) * vehicle.scale;
    const shadow = vectorPoint(center, 3 * vehicle.scale, 8 * vehicle.scale);
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

    if (!isMinibus) drawWheels(ctx, center, length, width, vehicle.scale);

    const body = vehicleCorners(center, length, width);
    const lower = body.map((point) => ({ x: point.x, y: point.y + bodyDepth }));
    drawPolygon(ctx, [body[3], body[0], lower[0], lower[3]], meta.dark, "rgba(0,0,0,0.22)");
    drawPolygon(ctx, [body[0], body[1], lower[1], lower[0]], isMinibus ? "#c78b20" : meta.dark, "rgba(0,0,0,0.22)");
    drawPolygon(ctx, body, meta.color, meta.dark);

    const cabinLength = length * (isMinibus ? 0.82 : meta.shape === "sedan" ? 0.57 : 0.52);
    const cabinCenter = vectorPoint(center, meta.shape === "hatchback" ? -3 * vehicle.scale : -1 * vehicle.scale, 0);
    const cabinBase = vehicleCorners(cabinCenter, cabinLength, width * (isMinibus ? 0.8 : 0.72));
    const cabinRise = (isMinibus ? 16 : 10) * vehicle.scale;
    const cabinTop = cabinBase.map((point) => ({ x: point.x, y: point.y - cabinRise }));
    drawPolygon(ctx, [cabinBase[3], cabinBase[0], cabinTop[0], cabinTop[3]], isMinibus ? "#3f7895" : "#78abc4", meta.dark);
    drawPolygon(ctx, [cabinBase[0], cabinBase[1], cabinTop[1], cabinTop[0]], isMinibus ? "#5d9bb5" : "#9bc7d9", meta.dark);
    drawPolygon(ctx, cabinTop, isMinibus ? "#f5cf67" : "#d7e8ed", meta.dark);

    const sideWindowInset = 3 * vehicle.scale;
    drawPolygon(ctx, [
      vectorPoint(cabinBase[3], sideWindowInset, 0),
      vectorPoint(cabinBase[0], -sideWindowInset, 0),
      { x: cabinTop[0].x - AXIS.x * sideWindowInset, y: cabinTop[0].y - AXIS.y * sideWindowInset + 2 * vehicle.scale },
      { x: cabinTop[3].x + AXIS.x * sideWindowInset, y: cabinTop[3].y + AXIS.y * sideWindowInset + 2 * vehicle.scale }
    ], "#477f9f", "rgba(24,72,102,0.8)");
    const dividerPositions = isMinibus ? [-0.45, -0.12, 0.22, 0.55] : [0];
    ctx.strokeStyle = isMinibus ? "#e7ad2f" : meta.dark;
    ctx.lineWidth = Math.max(1, 1.5 * vehicle.scale);
    dividerPositions.forEach((position) => {
      const divider = vectorPoint(cabinCenter, cabinLength * position, width * (isMinibus ? 0.8 : 0.72));
      ctx.beginPath();
      ctx.moveTo(divider.x, divider.y);
      ctx.lineTo(divider.x, divider.y - cabinRise + 2 * vehicle.scale);
      ctx.stroke();
    });
    if (isMinibus) {
      const doorTop = vectorPoint(cabinCenter, -cabinLength * 0.7, width * 0.8);
      const doorBottom = vectorPoint(center, -length * 0.62, width);
      ctx.strokeStyle = "#8b6117";
      ctx.lineWidth = Math.max(1, 1.6 * vehicle.scale);
      ctx.beginPath();
      ctx.moveTo(doorTop.x, doorTop.y - cabinRise + 2 * vehicle.scale);
      ctx.lineTo(doorBottom.x, doorBottom.y + bodyDepth * 0.75);
      ctx.stroke();
    }

    const frontNear = lower[0];
    const frontFar = lower[1];
    [0.3, 0.72].forEach((ratio) => {
      const x = frontNear.x + (frontFar.x - frontNear.x) * ratio;
      const y = frontNear.y + (frontFar.y - frontNear.y) * ratio - bodyDepth * 0.42;
      ctx.fillStyle = "#fff2b0";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, 1.8 * vehicle.scale), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.48)";
    ctx.lineWidth = Math.max(1, 1.3 * vehicle.scale);
    ctx.beginPath();
    ctx.moveTo(lower[3].x + AXIS.x * 5 * vehicle.scale, lower[3].y + AXIS.y * 5 * vehicle.scale - bodyDepth * 0.35);
    ctx.lineTo(lower[0].x - AXIS.x * 5 * vehicle.scale, lower[0].y - AXIS.y * 5 * vehicle.scale - bodyDepth * 0.35);
    ctx.stroke();
    if (isMinibus) drawWheels(ctx, center, length, width, vehicle.scale, 10.5);
    drawVehicleLabel(ctx, center, vehicle, meta);
  }

  function drawWheels(ctx, center, length, width, scale, verticalOffset = 5) {
    const wheelPoints = [
      vectorPoint(center, length * 0.64, width * 1.02),
      vectorPoint(center, -length * 0.62, width * 1.02)
    ];
    ctx.save();
    wheelPoints.forEach((point) => {
      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + verticalOffset * scale, 5.2 * scale, 3.6 * scale, ROAD_ANGLE, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(point.x, point.y + verticalOffset * scale, 1.55 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawVehicleLabel(ctx, center, vehicle, meta) {
    const label = state.selected === vehicle.id ? `${meta.name}　參考系` : meta.name;
    ctx.save();
    ctx.font = "700 14px Segoe UI, Tahoma, sans-serif";
    const width = ctx.measureText(label).width + 16;
    const vehicleLength = (meta.shape === "minibus" ? 31 : 23) * vehicle.scale;
    const labelCenter = vectorPoint(center, -(vehicleLength + width / 2 + 8), 0);
    const preferredX = labelCenter.x - width / 2;
    const x = Math.max(6, Math.min(state.view.width - width - 6, preferredX));
    const y = labelCenter.y - 11.5;
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
    const label = selected ? "路旁觀察者　參考系" : "路旁觀察者";
    ctx.font = "700 13px Segoe UI, Tahoma, sans-serif";
    const labelWidth = ctx.measureText(label).width;
    const labelX = Math.max(6, Math.min(state.view.width - labelWidth - 6, point.x - labelWidth / 2));
    ctx.fillStyle = "#1f2937";
    ctx.fillText(label, labelX, point.y - (selected ? 28 : 17));
    ctx.restore();
  }

  function animate(elapsed) {
    if (state.playback === "playing") {
      state.simTime += elapsed * (state.slow ? SLOW_FACTOR : 1);
      if (state.simTime >= SIMULATION_SECONDS) {
        state.simTime = SIMULATION_SECONDS;
        state.playback = "observed";
        state.observedCandidates.add(state.selected);
        saveDraft();
        announce(observationSummary("觀察完成"));
        renderUI();
      }
    }
    drawScene();
    return state.playback === "playing" && !document.hidden;
  }

  function syncAnimation() {
    const shouldRun = state.playback === "playing" && !document.hidden;
    if (shouldRun) animationLoop.start();
    else animationLoop.stop();
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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) drawScene();
    syncAnimation();
  });

  const attempt = window.SimScorm.loadAttempt(ACTIVITY);
  const startupState = window.SimActivityFlow.startup(attempt);
  if (startupState === "review") restoreSubmittedAttempt(attempt);
  else if (startupState === "frozen") {
    const retry = window.SimScorm.retryPending(false);
    if (retry.committed) { restoreSubmittedAttempt(retry); window.SimScorm.finish(); }
    else Object.assign(state, { locked: true, mode: "submitted", trustedReview: false, unavailableReason: "提交狀態尚未確認。答案已凍結，請重新開啟活動重試。" });
  } else if (attempt.state === "draft") {
    if (!restoreDraft(attempt.snapshot)) createAttempt();
    window.SimScorm.setDraftProvider(draftState);
  } else if (startupState === "editable") {
    createAttempt();
    window.SimScorm.setDraftProvider(draftState);
  } else Object.assign(state, { locked: true, mode: "submitted", trustedReview: false, unavailableReason: "未能從 Moodle 安全載入本次作答，暫時無法顯示分數或合格狀態。" });
  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();
  renderUI();
})();
