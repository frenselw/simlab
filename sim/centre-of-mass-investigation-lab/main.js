(function (root, factory) {
  const G = typeof module === "object" && module.exports ? require("./generator.js") : root.CentreMassGenerator;
  const M = typeof module === "object" && module.exports ? require("./model.js") : root.CentreMassModel;
  const S = typeof module === "object" && module.exports ? require("./scoring.js") : root.CentreMassScoring;
  const P = typeof module === "object" && module.exports ? require("./persistence.js") : root.CentreMassPersistence;
  const U = typeof module === "object" && module.exports ? require("./ui-policy.js") : root.CentreMassUiPolicy;
  const api = factory(G, M, S, P, U);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CentreMassApp = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => { root.__centreMassDebug = api.boot(); });
})(typeof window !== "undefined" ? window : globalThis, function (Generator, Model, Scoring, Persistence, UiPolicy) {
  "use strict";
  const ACTIVITY = "centre-of-mass-investigation-lab";
  const NS = "http://www.w3.org/2000/svg";
  const exactKeys = (value, keys) => Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)));
  function freshSeed() {
    const value = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(value)[0];
    return (Date.now() ^ Math.floor((globalThis.performance?.now?.() || 0) * 1000)) >>> 0;
  }
  function reviewMatches(reviewSnapshot, payload, computed) {
    if (!reviewMetadataValid(reviewSnapshot) || !exactKeys(payload, ["reviewJson", "score", "maxScore", "passed"]) || !computed ||
        typeof payload.reviewJson !== "string" || typeof payload.score !== "number" || !Number.isFinite(payload.score) ||
        typeof payload.maxScore !== "number" || !Number.isFinite(payload.maxScore) || typeof payload.passed !== "boolean") return false;
    const canonical = Persistence.fromReview(reviewSnapshot.answer);
    const answerIsCanonical = reviewSnapshot.answer?.v === Persistence.VERSION
      ? JSON.stringify(canonical) === JSON.stringify(reviewSnapshot.answer)
      : reviewSnapshot.answer?.v === 1 && Boolean(Persistence.migrateV1(reviewSnapshot.answer));
    return Boolean(canonical && answerIsCanonical &&
      payload?.reviewJson === JSON.stringify(reviewSnapshot) &&
      reviewSnapshot.score === computed.score && reviewSnapshot.passed === computed.passed &&
      payload.score === computed.score && payload.maxScore === computed.maxScore && payload.passed === computed.passed);
  }
  function reviewMetadataValid(snapshot) { return Boolean(exactKeys(snapshot, ["version", "activity", "kind", "answer", "score", "passed"]) && snapshot.version === 1 && snapshot.kind === "review" && snapshot.activity === ACTIVITY &&
    typeof snapshot.score === "number" && Number.isFinite(snapshot.score) && typeof snapshot.passed === "boolean"); }
  function restoredPlatePose(state, problem, nail = { x: 350, y: 42 }, scale = 245) {
    if (state?.phase !== "part2" || !state.part2?.activeHoleKey) return null;
    const hole = problem?.part2?.holes.find((item) => item.key === state.part2.activeHoleKey); if (!hole) return null;
    const angle = Model.equilibriumAngle(hole, problem.part2.centre), c = Math.cos(angle), s = Math.sin(angle);
    return { x: nail.x - (hole.x * c - hole.y * s) * scale, y: nail.y - (hole.x * s + hole.y * c) * scale, angle };
  }
  function layoutCandidateTargets(projected, cssWidth = 700, cssHeight = 460) {
    const gap=48,inset=24,axis=(size)=>{const count=Math.max(1,Math.floor((size-inset*2)/gap)+1),start=(size-(count-1)*gap)/2;return Array.from({length:count},(_,index)=>start+index*gap);},xs=axis(cssWidth),ys=axis(cssHeight),slots=ys.flatMap((y)=>xs.map((x)=>({x,y}))),available=new Set(slots);
    if(slots.length<projected.length)throw new Error("Candidate stage is below the supported layout size");
    const placed=[];
    for(const item of [...projected].sort((a,b)=>b.depth-a.depth||a.key.localeCompare(b.key))){const anchor={x:item.x*cssWidth/700,y:item.y*cssHeight/460},slot=[...available].sort((a,b)=>(a.x-anchor.x)**2+(a.y-anchor.y)**2-((b.x-anchor.x)**2+(b.y-anchor.y)**2)||a.y-b.y||a.x-b.x)[0];available.delete(slot);placed.push({...item,anchorX:item.x,anchorY:item.y,x:slot.x*700/cssWidth,y:slot.y*460/cssHeight,displacementCss:Math.hypot(slot.x-anchor.x,slot.y-anchor.y)});}
    return placed.sort((a,b)=>a.key.localeCompare(b.key));
  }
  function part2Structure(state, problem) {
    const holes = new Map(problem.part2.holes.map((hole) => [hole.key, hole]));
    const lines = state.part2.lines.filter((line) => Model.lineRecordable(line, holes.get(line.holeKey), problem.part2.centre, problem.part2.size));
    let nonDegenerate = false;
    for (let i = 0; i < lines.length; i += 1) for (let j = i + 1; j < lines.length; j += 1) {
      if (Model.acuteLineAngle(lines[i], lines[j]) >= 25) nonDegenerate = true;
    }
    return { lines, nonDegenerate, ready: lines.length >= 2 && nonDegenerate };
  }
  function drawEndpoint(pivot, point, snapDegrees = 10) {
    const dx = point.x - pivot.x, dy = point.y - pivot.y, length = Math.hypot(dx, dy);
    const deviation = length && dy > 0 ? Math.acos(Model.clamp(dy / length, -1, 1)) * 180 / Math.PI : 180;
    return { point: deviation <= snapDegrees ? { x: pivot.x, y: pivot.y + length } : { x: point.x, y: point.y }, snapped: deviation <= snapDegrees, downward: dy > 0, length };
  }
  function boot(options = {}) {
    const $ = (id) => document.getElementById(id);
    const dom = { app: $("app"), stage: $("stage"), svg: $("svgStage"), canvas: $("solidCanvas"), fallbackCanvas: $("fallbackCanvas"), direct: $("directLayer"), preview: $("preview"), rendererBadge: $("rendererBadge"), panel: $("controlPanel"),
      badge: $("phaseBadge"), progress: $("progress"), tabs: [...document.querySelectorAll("[data-part-tab]")], checkTab: $("checkTab"), technical: $("technical"), technicalMessage: $("technicalMessage"), technicalRetry: $("technicalRetry"),
      p1: $("part1Controls"), p1Status: $("part1Status"), p1MarkTools: $("part1MarkTools"),
      p2: $("part2Controls"), p2Status: $("part2Status"), p2MarkTools: $("part2MarkTools"),
      p3: $("part3Controls"), p3Status: $("part3Status"), solidSummary: $("solidSummary"), radios: $("candidateRadios"),
      check: $("checkControls"), checkSummary: $("checkSummary"), submit: $("submit"), review: $("reviewControls"), reviewSummary: $("reviewSummary"), retry: $("retrySubmission"), live: $("liveRegion") };
    let state = null, committedState = null, problem = null, locked = false, presentation = null, latestReview = null, latestResult = null, pendingExpected = null;
    let supportX = .5, selectedHole = null, snapCandidateKey = null, platePose = { x: 350, y: 230, angle: 0 }, selectedRadio = null, gesture = null, hostSwipe = null, drawGhost = null, markDraft = null, handleWorld = { x: 500, y: 100 };
    let swingRuntime = null, swingFrame = 0, swingLastTime = null, fallRuntime = null, fallFrame = 0;
    let part3Renderer = null, part3Mode = "canvas", part3Attempted = false, lastProjection = [];
    bind();
    const attempt = options.attempt || SimScorm.loadAttempt(ACTIVITY);
    routeStartup(SimActivityFlow.startup(attempt), attempt);

    function bind() {
      dom.technicalRetry.addEventListener("click", () => location.reload());
      document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { const [yaw, pitch] = button.dataset.view.split(",").map(Number); update(Persistence.setView(state, { yaw10: state.part3.view.yaw10 + yaw, pitch10: state.part3.view.pitch10 + pitch }), "已記錄新的觀察方向。" ); }));
      dom.tabs.forEach((tab) => tab.addEventListener("click", () => switchToPart(Number(tab.dataset.partTab))));
      dom.checkTab.addEventListener("click", () => update(Persistence.enterCheck(state), "已進入提交前檢查。"));
      dom.submit.addEventListener("click", submit);
      dom.retry.addEventListener("click", retryPending);
      dom.stage.addEventListener("pointerdown", (event) => { if (event.pointerType === "touch" && UiPolicy.pointerOwner(event.target) === "host") hostSwipe = { id: event.pointerId, y: event.clientY }; });
      dom.stage.addEventListener("pointermove", (event) => { if (!hostSwipe || event.pointerId !== hostSwipe.id) return; const delta = hostSwipe.y - event.clientY; hostSwipe.y = event.clientY; try { if (parent !== window) parent.scrollBy(0, delta); } catch {} });
      for (const type of ["pointerup", "pointercancel"]) dom.stage.addEventListener(type, (event) => { if (hostSwipe?.id === event.pointerId) hostSwipe = null; });
      addEventListener("resize",()=>{if(state?.phase==="part3"&&!gesture&&!locked)render();});
      addEventListener("blur", () => { if (swingRuntime) pauseSwing(); else rollbackInteraction(); });
      addEventListener("focus", resumeSwing);
      document.addEventListener("visibilitychange", () => { if (document.hidden) pauseSwing(); else resumeSwing(); });
    }
    function switchToPart(part) { if (locked || state.phase === `part${part}`) return; rollbackInteraction(); const next=Persistence.switchPart(state,part); if(next) update(next,`已切換至第 ${part} 部分。`); }
    function routeStartup(outcome, attempt) {
      clearGesture(); const view = UiPolicy.startupView(outcome); locked = view.locked;
      if (outcome === "editable") {
        if (attempt.state === "draft") state = Persistence.decode(attempt.snapshot?.answer);
        else state = Persistence.initial(options.seed ?? freshSeed());
        if (!state) return technicalLock("儲存的草稿不符合活動狀態規則；系統沒有把它改成另一份答案。");
        problem = Generator.generate(state.seed, state.generatorVersion); supportX = state.part1.supportEpisodes.at(-1)?.x ?? .5;
        platePose = restoredPlatePose(state, problem) || { x: 350, y: 230, angle: 0 };
        committedState = Persistence.decode(Persistence.encode(state));
        SimScorm.setDraftProvider(() => SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(committedState)));
        if (attempt.state === "new" && !checkpoint()) return technicalLock("未能保存今次隨機題目；操作保持鎖定，重新載入不會聲稱已保存。");
        render();
      } else if (outcome === "review") {
        if (!reviewMetadataValid(attempt.snapshot)) return safeFallback(attempt, "已完成 attempt 的保存分數或合格 metadata 不是 canonical 類型。");
        const restored = Persistence.fromReview(attempt.snapshot?.answer);
        if (!restored) return safeFallback(attempt, "已完成 attempt 的詳細答案無法驗證。");
        state = restored; problem = Generator.generate(state.seed, state.generatorVersion); const computed = Scoring.score(state);
        const trusted = SimActivityFlow.reviewResult(computed, attempt.snapshot, attempt); latestResult = trusted.result; latestReview = state;
        renderReview(trusted.result, trusted.trusted, trusted.trusted ? "已提交並鎖定" : "Moodle 記錄與活動重算不一致");
      } else if (outcome === "frozen") {
        try {
          const payload = attempt.snapshot?.payload, saved = JSON.parse(payload?.reviewJson || "null");
          const restored = Persistence.fromReview(saved?.answer), computed = restored && Scoring.score(restored);
          if (!restored || !reviewMatches(saved, payload, computed)) throw new Error("rejected pending payload");
          pendingExpected = Object.freeze({ reviewJson: payload.reviewJson, score: payload.score, maxScore: payload.maxScore, passed: payload.passed });
          state = restored; problem = Generator.generate(state.seed, state.generatorVersion); latestReview = restored; latestResult = computed; presentation = "pending"; renderReview(null, false, "上次提交仍待確認；只可重試同一份已凍結答案。"); dom.retry.classList.remove("is-hidden");
        } catch { SimScorm.quarantinePending(); technicalLock("待提交資料的權威答案或證據不一致；已停止自動重試。"); }
      } else technicalLock("無法安全讀取 Moodle attempt；操作及分數均未確認。");
    }
    function checkpoint() { if (locked || !Persistence.validate(state)) return false; committedState = Persistence.decode(Persistence.encode(state)); return SimScorm.saveDraft(SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(committedState))); }
    function update(next, message) { if (locked || !next) { announce("目前證據未達到這項操作的要求。"); return false; } clearGesture(); state = next; problem = Generator.generate(state.seed, state.generatorVersion); checkpoint(); render(); announce(message); return true; }
    function announce(message) { dom.live.textContent = ""; requestAnimationFrame(() => { dom.live.textContent = message; }); }
    function testSupport() {
      if (fallRuntime || locked) return;
      const next = Persistence.release(state, supportX); if (!next) return;
      const outcome = next.part1.supportEpisodes.at(-1).outcome, reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      fallRuntime = { outcome, angle: 0, started: null, duration: reduced ? 260 : outcome === "balanced" ? 850 : 760 };
      dom.p1Status.textContent = outcome === "balanced" ? "承托已放開：觀察中性平衡的輕微晃動。" : "承托已放開：正在觀察物體受力矩轉動。";
      const animate = (time) => {
        if (!fallRuntime) return;
        if (fallRuntime.started === null) fallRuntime.started = time;
        const t = Math.min(1, (time - fallRuntime.started) / fallRuntime.duration), eased = 1 - Math.pow(1 - t, 3);
        fallRuntime.angle = outcome === "balanced" ? Math.sin(t * Math.PI * 4) * (1 - t) * 2.4 : (outcome === "right-fall" ? 1 : -1) * eased * 31;
        renderPart1(true);
        if (t < 1) fallFrame = requestAnimationFrame(animate);
        else { fallRuntime = null; fallFrame = 0; const completed = outcome === "balanced" ? Persistence.markPart1(next, problem.part1.xCm) : next; update(completed, outcome === "balanced" ? "承托點進入平衡容差；系統已揭示題目生成的精確重心。" : outcome === "left-fall" ? "物體向左傾倒；請重新移動承托再放手。" : "物體向右傾倒；請重新移動承托再放手。"); }
      };
      fallFrame = requestAnimationFrame(animate);
    }
    function alignHoleToNail(hole) { const offset = localToSvg(hole); platePose.x += 350 - offset.x; platePose.y += 42 - offset.y; }
    function applySwingPose(hole) { platePose.angle = swingRuntime.angle; alignHoleToNail(hole); renderPart2(true); syncPart2Targets(); updatePreview(); }
    function finishSwing(holeKey) { if (!swingRuntime) return; const next = Persistence.settleHole(state, holeKey); swingRuntime = null; swingFrame = 0; swingLastTime = null; update(next, `${holeKey} 的平板已停止，可以親手畫鉛垂線。`); }
    function swingTick(time) {
      swingFrame = 0; if (!swingRuntime || document.hidden) return;
      const hole = problem.part2.holes.find((item) => item.key === selectedHole); if (!hole) return clearSwing();
      if (swingRuntime.reducedStep !== undefined) {
        if (swingRuntime.reducedStep === 0) { swingRuntime.angle += (swingRuntime.target - swingRuntime.angle) * .65; swingRuntime.reducedStep = 1; applySwingPose(hole); scheduleSwing(); }
        else { swingRuntime.angle = swingRuntime.target; swingRuntime.omega = 0; applySwingPose(hole); finishSwing(hole.key); }
        return;
      }
      if (swingLastTime === null) swingLastTime = time;
      const settled = Model.stepSwing(swingRuntime, (time - swingLastTime) / 1000, problem.part2.mass); swingLastTime = time; applySwingPose(hole);
      if (settled) finishSwing(hole.key); else scheduleSwing();
    }
    function scheduleSwing() { if (swingRuntime && !swingFrame && !document.hidden) swingFrame = requestAnimationFrame(swingTick); }
    function pauseSwing() { if (!swingRuntime) return; if (swingFrame) cancelAnimationFrame(swingFrame); swingFrame = 0; swingLastTime = null; dom.preview.replaceChildren(); dom.preview.className = "preview is-hidden"; }
    function resumeSwing() { if (swingRuntime) { swingLastTime = null; scheduleSwing(); } }
    function finishLineWhileHung(next) { state=next;problem=Generator.generate(state.seed, state.generatorVersion);checkpoint();render();announce("線段已記錄；平板會保持懸掛，可重畫或拖走平板。"); }
    function hangSelected() {
      if (!selectedHole || state.phase !== "part2" || state.part2.activeHoleKey || swingRuntime || locked) return announce("請先選擇一個小孔。");
      const hole = problem.part2.holes.find((item) => item.key === selectedHole); if (!hole) return;
      alignHoleToNail(hole); swingRuntime = Model.createSwing(problem.part2, hole, platePose.angle); dom.p2Status.textContent = `${selectedHole} 已掛好，平板正在阻尼擺動。`; renderPart2(true); syncPart2Targets(); announce(`${selectedHole} 已掛好，平板正在擺動。`);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) swingRuntime.reducedStep = 0;
      scheduleSwing();
    }
    function submit() { if (locked || state.phase !== "check") return; latestReview = Persistence.makeReview(state); latestResult = Scoring.score(latestReview); if (!latestReview) return; locked = true; presentation = "submitting"; clearGesture(); renderReview(null, false, "正在提交，請勿離開。"); const snapshot = SimScorm.makeSnapshot(ACTIVITY, "review", latestReview, latestResult); pendingExpected = Object.freeze({ reviewJson: JSON.stringify(snapshot), score: latestResult.score, maxScore: latestResult.maxScore, passed: latestResult.passed }); const handle = (outcome) => routeSubmission(outcome); SimScorm.submitWithCallbacks(latestResult, snapshot, { onSuccess: handle, onFailure: handle }); }
    function routeSubmission(outcome) { const view = UiPolicy.submissionView(outcome); locked = view.locked; SimActivityFlow.submission(outcome, {
      success: () => renderReview(latestResult, true, "已提交並鎖定"),
      committed: () => { presentation = "committed"; renderReview(latestResult, true, "結果已寫入 Moodle；完成連線仍需重試"); dom.retry.classList.remove("is-hidden"); },
      frozen: () => { presentation = "pending"; renderReview(null, false, "提交仍待確認；答案已凍結，只可重試同一份資料。"); dom.retry.classList.remove("is-hidden"); },
      retry: () => outcome.retryable ? (locked = false, state.phase = "check", state.variant = "complete", render(), announce("提交未建立 final state；可保留答案再試。")) : technicalLock("提交前檢查失敗；系統不能承諾可安全重試。")
    }); }
    function retryPending() { if (presentation === "committed") { if (SimScorm.finish()) renderReview(latestResult, true, "已提交並完成連線"); return; } const outcome = SimScorm.retryPending(); if ((outcome.ok || outcome.committed) && (!pendingExpected || !outcome.review || !reviewMatches(outcome.review, pendingExpected, latestResult) || outcome.score !== pendingExpected.score || outcome.status !== (pendingExpected.passed ? "passed" : "failed"))) { SimScorm.quarantinePending(); return technicalLock("重試回傳資料與原有凍結提交不一致；已停止繼續處理。"); } routeSubmission({ ...outcome, activityState: outcome.ok ? "success" : outcome.committed ? "committed" : outcome.frozen ? "frozen" : "retry" }); }
    function hideAll() { [dom.technical, dom.p1, dom.p2, dom.p3, dom.check, dom.review].forEach((section) => section.classList.add("is-hidden")); }
    function render() {
      if (!state || locked) return; hideAll(); const isPart3=state.phase==="part3";dom.svg.style.display=isPart3?"none":"block";dom.canvas.style.display=isPart3&&part3Mode==="three"?"block":"none";dom.fallbackCanvas.style.display=isPart3&&part3Mode!=="three"?"block":"none";dom.rendererBadge.classList.toggle("is-hidden",!isPart3); dom.direct.replaceChildren(); dom.preview.classList.add("is-hidden");
      const complete=[state.part1.markX!==null,part2Structure(state,problem).ready&&Boolean(state.part2.mark)&&state.part2.activeHoleKey===null,state.part3.selectedCandidateKey!==null&&Model.validObservations(problem.part3.initialView,state.part3.observations)],count=complete.filter(Boolean).length;dom.progress.value=count;dom.badge.textContent=state.phase==="check"?"提交前檢查":`第 ${Number(state.phase.slice(-1))} 部分`;
      dom.tabs.forEach((tab,index)=>{const active=state.phase===`part${index+1}`;tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;tab.dataset.complete=String(complete[index]);});dom.checkTab.disabled=count!==3;dom.checkTab.setAttribute("aria-current",state.phase==="check"?"step":"false");
      if (state.phase === "part1") { dom.p1.classList.remove("is-hidden"); renderPart1(); }
      if (state.phase === "part2") { dom.p2.classList.remove("is-hidden"); renderPart2(); }
      if (state.phase === "part3") { dom.p3.classList.remove("is-hidden"); renderPart3(); }
      if (state.phase === "check") { dom.check.classList.remove("is-hidden"); renderCheck(); }
    }
    function svgEl(name, attrs = {}) { const element = document.createElementNS(NS, name); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value); return element; }
    function renderPart1(visualsOnly = false) {
      const x = 80 + supportX * 540, revealed = state.part1.markX !== null, centreX = 80 + problem.part1.xCm * 540, last = state.part1.supportEpisodes.at(-1), angle = fallRuntime?.angle || 0, rodBottom=239;
      dom.svg.replaceChildren(svgEl("rect",{x:0,y:0,width:700,height:460,fill:"#ffffff",class:"blank-stage"}),svgEl("line",{x1:42,y1:370,x2:658,y2:370,stroke:"#e5e7eb","stroke-width":1}));
      const apparatus=svgEl("g",{transform:`rotate(${angle} ${x} ${rodBottom})`});
      apparatus.append(svgEl("rect",{x:80,y:215,width:540,height:24,rx:4,fill:"#2563eb","data-scene":"rod","data-contact-y":rodBottom}),svgEl("rect",{x:84,y:218,width:532,height:5,rx:2.5,fill:"#60a5fa",opacity:.75}));
      if(revealed)apparatus.append(svgEl("circle",{cx:centreX,cy:227,r:5,class:"centre-reveal-dot","data-scene":"part1-centre"}),svgEl("text",{x:centreX,y:204,"text-anchor":"middle",class:"centre-reveal-label","data-scene":"part1-centre-label"}));
      if(revealed)apparatus.lastChild.textContent="重心";dom.svg.append(apparatus);
      dom.svg.append(svgEl("path",{d:`M${x} ${rodBottom} L${x-22} 338 L${x+22} 338Z`,fill:"#f59e0b","data-scene":"support","data-contact-y":rodBottom}),svgEl("rect",{x:x-32,y:338,width:64,height:7,rx:2,fill:"#d97706"}));
      if (visualsOnly) return;
      const support = directButton(x / 7, rodBottom/4.6, "承托架；拖動後放手測試", "support"); support.classList.add("support-target"); support.style.width="70px";support.style.height=`${(345-rodBottom)/460*100}%`;support.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { supportX = Model.clamp(supportX + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? .05 : .01), 0, 1); event.preventDefault(); render(); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); testSupport(); } }); support.addEventListener("pointerdown", (event) => beginDrag(event, support, "support", (point) => { supportX = Model.clamp((point.x - 80) / 540, 0, 1); support.style.left = `${(80 + supportX * 540) / 7}%`; renderPart1(true); }, testSupport));
      dom.p1Status.textContent = last ? last.outcome === "balanced" ? "物體保持水平：這是中性平衡。" : last.outcome === "left-fall" ? "上次向左傾倒。" : "上次向右傾倒。" : "尚未完成承托放手測試。";
      dom.p1MarkTools.classList.toggle("is-hidden", !state.part1.supportEpisodes.some((item) => item.outcome === "balanced"));
    }
    function localToSvg(point) { const c = Math.cos(platePose.angle), s = Math.sin(platePose.angle), scale = 245; return { x: platePose.x + (point.x * c - point.y * s) * scale, y: platePose.y + (point.x * s + point.y * c) * scale }; }
    function svgToLocal(point) { const dx = (point.x - platePose.x) / 245, dy = (point.y - platePose.y) / 245, c = Math.cos(platePose.angle), s = Math.sin(platePose.angle); return { x: dx * c + dy * s, y: -dx * s + dy * c }; }
    function pathForPoints(points) { return points.map((point, i) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${i ? "L" : "M"}${p.x},${p.y}`; }).join(" ") + " Z"; }
    function platePath() { return [problem.part2.polygon, ...(problem.part2.cutouts || [])].map(pathForPoints).join(" "); }
    function pointInPolygon(point, polygon) { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) { const a = polygon[i], b = polygon[j], crosses = (a[1] > point.y) !== (b[1] > point.y); if (crosses && point.x < (b[0] - a[0]) * (point.y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }
    function pointInMaterial(point) { return pointInPolygon(point, problem.part2.polygon) && !(problem.part2.cutouts || []).some((cutout) => pointInPolygon(point, cutout)); }
    function safeHandlePoint() { const rect=dom.stage.getBoundingClientRect(),insetX=Math.max(23,23*700/Math.max(1,rect.width)),insetY=Math.max(23,23*460/Math.max(1,rect.height)),candidates=[localToSvg({x:.68,y:-.58}),localToSvg({x:-.68,y:.58})],margin=(p)=>Math.min(p.x-insetX,700-insetX-p.x,p.y-insetY,460-insetY-p.y),best=candidates.sort((a,b)=>margin(b)-margin(a))[0];return{x:Model.clamp(best.x,insetX,700-insetX),y:Model.clamp(best.y,insetY,460-insetY)}; }
    function nearestSnapCandidate(preferredKey = null) { const eligible=problem.part2.holes.filter((hole)=>preferredKey===null||hole.key===preferredKey);let best=null;for(const hole of eligible){const point=localToSvg(hole),distance=Math.hypot(point.x-350,point.y-42);if(distance<=42&&(!best||distance<best.distance))best={key:hole.key,distance};}return best?.key||null; }
    function updateSnapCandidate(preferredKey = null) { snapCandidateKey=nearestSnapCandidate(preferredKey);renderPart2(true);syncPart2Targets(); }
    function prepareTakeDown() { if (!state.part2.activeHoleKey) return true; const next=Persistence.detachActiveHole(state);if(!next)return false;state=next;problem=Generator.generate(state.seed, state.generatorVersion);return checkpoint(); }
    function finishPlateDrop(preferredKey = null) { const key=snapCandidateKey||nearestSnapCandidate(preferredKey);snapCandidateKey=null;if(!key){render();announce("小孔未在牆釘的對準範圍內，未形成懸掛證據。");return;}selectedHole=key;alignHoleToNail(problem.part2.holes.find((hole)=>hole.key===key));render();hangSelected(); }
    function beginPlateDrag(event,target,preferredKey=null) { if(gesture||locked||event.button>0||swingRuntime||!preferredKey&&!pointInMaterial(svgToLocal(clientPoint(event)))||!prepareTakeDown())return;beginDrag(event,target,preferredKey?`hole-${preferredKey}`:"plate",(point,previous)=>{platePose.x+=point.x-previous.x;platePose.y+=point.y-previous.y;updateSnapCandidate(preferredKey);updatePreview();},()=>finishPlateDrop(preferredKey)); }
    function syncPart2Targets() {
      const plate = dom.direct.querySelector('[data-direct-target="plate"]'); if (plate) plate.style.clipPath = `polygon(${problem.part2.polygon.map((point) => { const p=localToSvg({x:point[0],y:point[1]});return `${p.x/7}% ${p.y/4.6}%`; }).join(",")})`;
      for (const target of dom.direct.querySelectorAll("[data-hole-key]")) { const hole = problem.part2.holes.find((item) => item.key === target.dataset.holeKey), point = hole && localToSvg(hole); if (point) { target.style.left = `${point.x / 7}%`; target.style.top = `${point.y / 4.6}%`; } }
      const handle = dom.direct.querySelector('[data-direct-target="rotate"]'); if (handle) { handleWorld=safeHandlePoint(); handle.style.left = `${handleWorld.x / 7}%`; handle.style.top = `${handleWorld.y / 4.6}%`; }
      const mark = dom.direct.querySelector('[data-direct-target="mark2"]'); if (mark) { const point = markDraft?.world || (state.part2.mark ? localToSvg(state.part2.mark) : {x:650,y:390}); mark.style.left = `${point.x / 7}%`; mark.style.top = `${point.y / 4.6}%`; }
      const draw = dom.direct.querySelector('[data-direct-target="draw"]'); if (draw) draw.style.clipPath = `polygon(${problem.part2.polygon.map((point) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${p.x / 7}% ${p.y / 4.6}%`; }).join(",")})`;
    }
    function nearestMarkIntersection(world, radiusCss = 30) {
      const rect = dom.stage.getBoundingClientRect(); let best = null;
      for (const intersection of Model.pairwiseIntersections(state.part2.lines)) {
        const point = localToSvg(intersection), distance = Math.hypot((point.x-world.x)*rect.width/700,(point.y-world.y)*rect.height/460);
        if (distance <= radiusCss && (!best || distance < best.distance)) best = { world:point, local:{x:intersection.x,y:intersection.y}, distance, pair:intersection.pair };
      }
      return best;
    }
    function renderPart2(visualsOnly = false) {
      dom.svg.replaceChildren(svgEl("rect", { x:0,y:0,width:700,height:460,fill:"#ffffff",class:"blank-stage" }),svgEl("line",{x1:24,y1:86,x2:676,y2:86,stroke:"#e5e7eb","stroke-width":1}),svgEl("circle",{cx:350,cy:42,r:snapCandidateKey?35:31,fill:"#dbeafe",opacity:.72,class:snapCandidateKey?"snap-ring":""}),svgEl("circle",{cx:350,cy:42,r:5,fill:snapCandidateKey?"#f97316":"#1e40af"}),svgEl("path",{d:platePath(),class:"plate","fill-rule":"evenodd"}));
      for (const line of state.part2.lines) { const a = localToSvg({ x: line.a[0], y: line.a[1] }), b = localToSvg({ x: line.b[0], y: line.b[1] }); dom.svg.append(svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "student-line" })); }
      const structure=part2Structure(state,problem),markerPoint=markDraft?.world||(state.part2.mark?localToSvg(state.part2.mark):structure.ready?{x:650,y:390}:null);
      if (markerPoint) { const marker=svgEl("g",{"data-scene":"part2-centre-marker"});marker.append(svgEl("circle",{cx:markerPoint.x,cy:markerPoint.y,r:10,class:"part2-centre-dot"}),svgEl("text",{x:markerPoint.x,y:markerPoint.y-16,"text-anchor":"middle",class:"part2-centre-label"}));marker.lastChild.textContent="重心";dom.svg.append(marker); }
      if(drawGhost)dom.svg.append(svgEl("line",{x1:drawGhost.a.x,y1:drawGhost.a.y,x2:drawGhost.b.x,y2:drawGhost.b.y,stroke:drawGhost.snapped?"#2563eb":"#94a3b8","stroke-width":2,"stroke-dasharray":"5 4","data-scene":"draw-ghost"}));
      if(state.part2.activeHoleKey){dom.svg.append(svgEl("line",{x1:350,y1:52,x2:350,y2:420,class:"plumb"}),svgEl("path",{d:"M350 418l-12 24h24Z",fill:"#374b57",stroke:"#1f3039","stroke-width":3}));}
      for (const hole of problem.part2.holes) { const p = localToSvg(hole),snapping=hole.key===snapCandidateKey;if(snapping)dom.svg.append(svgEl("circle",{cx:p.x,cy:p.y,r:16,class:"snap-ring","data-snap-hole":hole.key}));dom.svg.append(svgEl("circle", { cx:p.x,cy:p.y,r:snapping?10:9,class:"hole-ring" }),svgEl("circle",{cx:p.x,cy:p.y,r:3,fill:snapping?"#f97316":"#1e40af"})); }
      handleWorld=safeHandlePoint();const rotateLabelOnLeft=handleWorld.x>545,rotateControl=svgEl("g",{"data-scene":"rotate-control"});rotateControl.append(svgEl("circle",{cx:handleWorld.x,cy:handleWorld.y,r:10,class:"rotate-handle-dot"}),svgEl("text",{x:handleWorld.x+(rotateLabelOnLeft?-16:16),y:handleWorld.y+6,"text-anchor":rotateLabelOnLeft?"end":"start",class:"rotate-handle-label"}));rotateControl.lastChild.textContent="拖動旋轉";dom.svg.append(rotateControl);
      if (visualsOnly) return;
      const plateTarget = directButton(0,0,"拖動平板，將最近的小孔移近牆釘","plate");plateTarget.style.inset="0";plateTarget.style.width="100%";plateTarget.style.height="100%";plateTarget.style.transform="none";plateTarget.style.borderRadius="0";plateTarget.addEventListener("keydown", (event) => { if (event.key.startsWith("Arrow") && !swingRuntime) { if(!prepareTakeDown())return;const step = event.shiftKey ? 18 : 6; platePose.x += event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0; platePose.y += event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0; event.preventDefault(); render(); } });plateTarget.addEventListener("pointerdown",(event)=>beginPlateDrag(event,plateTarget));
      for (const hole of problem.part2.holes) { const p = localToSvg(hole), target = directButton(p.x / 7, p.y / 4.6, `小孔 ${hole.key.slice(1)}；拖近牆釘後放手`, `hole-${hole.key}`, hole.key.slice(1)); target.dataset.holeKey = hole.key; target.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)&&!swingRuntime){event.preventDefault();if(!prepareTakeDown())return;selectedHole=hole.key;alignHoleToNail(hole);hangSelected();}});target.addEventListener("pointerdown",(event)=>beginPlateDrag(event,target,hole.key)); }
      const handle = directButton(handleWorld.x / 7, handleWorld.y / 4.6, "平板旋轉手柄；拖動或用左右方向鍵旋轉", "rotate"); handle.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key) && !state.part2.activeHoleKey && !swingRuntime) { platePose.angle += (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 15 : 5) * Math.PI / 180; event.preventDefault(); render(); } }); handle.addEventListener("pointerdown", (event) => { if (state.part2.activeHoleKey || swingRuntime) return; const start = clientPoint(event), base = platePose.angle, pointerAngle = Math.atan2(start.y - platePose.y, start.x - platePose.x); beginDrag(event, handle, "rotate", (point) => { platePose.angle = base + Math.atan2(point.y - platePose.y, point.x - platePose.x) - pointerAngle; renderPart2(true); syncPart2Targets(); updatePreview(); }, () => render()); });
      if (state.part2.activeHoleKey) {
        const draw=document.createElement("div"),polygon=problem.part2.polygon.map((point)=>{const p=localToSvg({x:point[0],y:point[1]});return `${p.x/7}% ${p.y/4.6}%`;}).join(",");
        draw.className="draw-target";draw.dataset.directTarget="draw";draw.style.clipPath=`polygon(${polygon})`;draw.setAttribute("role","button");draw.setAttribute("tabindex","0");draw.setAttribute("aria-label","由懸掛孔向下拖畫鉛垂線，或拖動平板取下重掛");dom.direct.append(draw);
        draw.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)){event.preventDefault();const next=Persistence.traceVertical(state);if(next)finishLineWhileHung(next);}});
        draw.addEventListener("pointerdown",(event)=>{
          const start=clientPoint(event),activeHole=problem.part2.holes.find((hole)=>hole.key===state.part2.activeHoleKey),pivot=localToSvg(activeHole),startNear=Math.hypot(start.x-pivot.x,start.y-pivot.y)<=Math.max(28,.12*problem.part2.size*245);
          if(!startNear){const closest=problem.part2.holes.map((hole)=>({hole,distance:Math.hypot(start.x-localToSvg(hole).x,start.y-localToSvg(hole).y)})).filter((item)=>item.hole.key!==activeHole.key&&item.distance<=28).sort((a,b)=>a.distance-b.distance)[0];beginPlateDrag(event,draw,closest?.hole.key||null);return;}
          let candidate=null;
          beginDrag(event,draw,"draw",(point)=>{candidate=drawEndpoint(pivot,point);drawGhost={a:pivot,b:candidate.point,snapped:candidate.snapped};renderPart2(true);updatePreview();},()=>{drawGhost=null;if(!candidate?.downward){render();announce("請由懸掛孔向下拖畫線段。");return;}const end=svgToLocal(candidate.point),line={holeKey:activeHole.key,a:[activeHole.x,activeHole.y],b:[end.x,end.y]},next=Persistence.recordLine(state,line);if(next)finishLineWhileHung(next);else{render();announce("線段太短、超出可記錄範圍或資料無效，請由小孔向下重畫。");}});
        });
      }
      if (structure.ready) { const point=state.part2.mark?localToSvg(state.part2.mark):{x:650,y:390},markTarget=directButton(point.x/7,point.y/4.6,"重心標記；拖到平板上，接近任意兩線交點時會吸附","mark2");markTarget.classList.add("mark-target");markTarget.addEventListener("keydown",(event)=>{if(!event.key.startsWith("Arrow")&&!['Enter',' '].includes(event.key))return;event.preventDefault();const base=state.part2.mark||svgToLocal({x:650,y:390}),step=(event.shiftKey?.05:.01)*problem.part2.size,next={x:base.x+(event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0),y:base.y+(event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0)};update(Persistence.markPart2(state,next),state.part2.mark?"已移動平板重心標記。":"已將重心標記放到平板上。");});markTarget.addEventListener("pointerdown",(event)=>beginDrag(event,markTarget,"mark2",(position)=>{const snapped=nearestMarkIntersection(position);markDraft=snapped||{world:position,local:svgToLocal(position),pair:null};syncPart2Targets();renderPart2(true);updatePreview();},()=>{const finalMark=markDraft?.local;markDraft=null;const next=finalMark&&Persistence.markPart2(state,finalMark);if(next)update(next,"平板重心標記位置已記錄。");else{render();announce("標記位置超出可記錄範圍，請放到平板上。");}})); }
      syncPart2Targets();
      dom.p2MarkTools.classList.toggle("is-hidden", !structure.ready);
      const activeHasLine=state.part2.activeHoleKey&&state.part2.lines.some((line)=>line.holeKey===state.part2.activeHoleKey);
      dom.p2Status.textContent = swingRuntime ? `${selectedHole} 已掛好，平板正在阻尼擺動。` : activeHasLine ? `${state.part2.activeHoleKey} 已畫線並保持懸掛；可重畫或拖走平板。` : state.part2.activeHoleKey ? `${state.part2.activeHoleKey} 已停止，可親手畫線。` : `已記錄 ${structure.lines.length} 個不同小孔的線段。`;
    }
    function renderSolid(canvas, compact = false) {
      const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;if(!ctx)throw new Error("Canvas unavailable"); ctx.clearRect(0, 0, w, h);ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(0,i*h/8);ctx.lineTo(w,i*h/8);ctx.stroke();} const scale = compact ? w * .28 : Math.min(w, h) * .29, cx = w / 2, cy = h / 2;
      ctx.strokeStyle = "#2563eb"; ctx.fillStyle = "rgba(59,130,246,.28)"; ctx.lineWidth = compact ? 1.5 : 2;
      if (problem.part3.type === "sphere") {
        const glow=ctx.createRadialGradient(cx-scale*.35,cy-scale*.4,scale*.08,cx,cy,scale);glow.addColorStop(0,"rgba(255,255,255,.9)");glow.addColorStop(.35,"rgba(102,174,199,.55)");glow.addColorStop(1,"rgba(29,83,109,.38)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,scale,0,Math.PI*2);ctx.fill();ctx.stroke();
        const point=(latitude,longitude,radius=1)=>Model.project([Math.cos(latitude)*Math.cos(longitude)*radius,Math.sin(latitude)*radius,Math.cos(latitude)*Math.sin(longitude)*radius],state.part3.view,scale);
        const loop=(points,color,alpha,width)=>{ctx.beginPath();points.forEach((item,index)=>index?ctx.lineTo(cx+item.x,cy+item.y):ctx.moveTo(cx+item.x,cy+item.y));ctx.closePath();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.stroke();};
        for(const latitude of [-.48,0,.48])loop(Array.from({length:96},(_,i)=>{const angle=i*Math.PI*2/96;return point(latitude,angle)}),"#1e40af",.42,compact?1:1.35);
        for(const longitude of [0,Math.PI/2,Math.PI,Math.PI*1.5])loop(Array.from({length:96},(_,i)=>point(-Math.PI/2+i*Math.PI/95,longitude)),longitude===0?"#f59e0b":"#1e40af",longitude===0?.9:.42,longitude===0?(compact?1.6:2):(compact?1:1.35));
        const axisStart=point(0,0,.79),axisEnd=point(0,0,1.04);ctx.beginPath();ctx.moveTo(cx+axisStart.x,cy+axisStart.y);ctx.lineTo(cx+axisEnd.x,cy+axisEnd.y);ctx.strokeStyle="#f59e0b";ctx.globalAlpha=.9;ctx.lineWidth=compact?2:2.5;ctx.stroke();ctx.fillStyle="#f59e0b";ctx.beginPath();ctx.arc(cx+axisEnd.x,cy+axisEnd.y,compact?4.5:6,0,Math.PI*2);ctx.fill();const dx=axisEnd.x-axisStart.x,dy=axisEnd.y-axisStart.y,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len;ctx.beginPath();ctx.moveTo(cx+axisEnd.x,cy+axisEnd.y);ctx.lineTo(cx+axisEnd.x-dx/len*(compact?8:11)+px*(compact?4:6),cy+axisEnd.y-dy/len*(compact?8:11)+py*(compact?4:6));ctx.lineTo(cx+axisEnd.x-dx/len*(compact?8:11)-px*(compact?4:6),cy+axisEnd.y-dy/len*(compact?8:11)-py*(compact?4:6));ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      }
      else { const axes = problem.part3.axes, vertices = []; for (const x of [-axes[0], axes[0]]) for (const y of [-axes[1], axes[1]]) for (const z of [-axes[2], axes[2]]) { const p = Model.project([x,y,z], state.part3.view, scale); vertices.push({ x: cx+p.x, y: cy+p.y, z:p.depth }); } const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].map(ids=>({ids,z:ids.reduce((s,i)=>s+vertices[i].z,0)/4})).sort((a,b)=>a.z-b.z);for(const [index,face] of faces.entries()){ctx.beginPath();face.ids.forEach((id,i)=>i?ctx.lineTo(vertices[id].x,vertices[id].y):ctx.moveTo(vertices[id].x,vertices[id].y));ctx.closePath();ctx.fillStyle=`rgba(${55+index*7},${120+index*6},${151+index*5},.24)`;ctx.fill();ctx.stroke();} }
      const projected = problem.part3.candidates.map((item) => ({ item, p: Model.project(item.position, state.part3.view, scale) })).sort((a,b) => a.p.depth-b.p.depth); for (const {item,p} of projected) { ctx.globalAlpha = p.depth < 0 ? .48 : 1; ctx.fillStyle = item.key === state.part3.selectedCandidateKey ? "#dc2626" : "#2563eb"; ctx.beginPath(); ctx.arc(cx+p.x,cy+p.y,compact?4:6,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1;
      canvas.dataset.renderer="canvas-fallback";canvas.dataset.frame=String((Number(canvas.dataset.frame)||0)+1);return projected.map(({item,p}) => ({ key:item.key, x:cx+p.x, y:cy+p.y, depth:p.depth }));
    }
    function ensurePart3Renderer(){if(part3Renderer||part3Attempted)return;part3Attempted=true;part3Mode="loading";dom.rendererBadge.textContent="載入空間視圖…";import("./part3-renderer.js").then(()=>{if(globalThis.__CENTRE_MASS_FORCE_FALLBACK||new URLSearchParams(location.search).get("renderer")==="canvas")throw new Error("requested fallback");part3Renderer=globalThis.CentreMassPart3Renderer.create(dom.canvas,problem.part3,(event)=>{part3Mode=event==="restored"?"three":"fallback";if(state?.phase==="part3"&&!gesture)render();});part3Mode="three";if(state?.phase==="part3"&&!gesture)render();}).catch(()=>{part3Mode="fallback";part3Renderer=null;if(state?.phase==="part3"&&!gesture)render();});}
    function renderPart3() {
      dom.svg.replaceChildren();ensurePart3Renderer();dom.canvas.style.display=part3Mode==="three"?"block":"none";dom.fallbackCanvas.style.display=part3Mode==="three"?"none":"block";dom.rendererBadge.textContent=part3Mode==="three"?(part3Renderer?.label||"Three.js 0.185.1"):part3Mode==="loading"?"載入空間視圖…":"Canvas 相容模式";let projected;try{projected=part3Mode==="three"&&part3Renderer?part3Renderer.render(state.part3.view,state.part3.selectedCandidateKey):renderSolid(dom.fallbackCanvas);}catch{part3Mode="fallback";part3Renderer?.dispose?.();part3Renderer=null;dom.canvas.style.display="none";dom.fallbackCanvas.style.display="block";projected=renderSolid(dom.fallbackCanvas);}const stageRect=dom.stage.getBoundingClientRect();projected=layoutCandidateTargets(projected,Math.max(1,stageRect.width),Math.max(1,stageRect.height));lastProjection=projected;dom.direct.replaceChildren();const leaders=svgEl("svg",{viewBox:"0 0 700 460",class:"candidate-leaders","aria-hidden":"true"});for(const item of projected)if(item.displacementCss>16)leaders.append(svgEl("line",{x1:item.anchorX,y1:item.anchorY,x2:item.x,y2:item.y}),svgEl("circle",{cx:item.anchorX,cy:item.anchorY,r:3}));dom.direct.append(leaders); const orbit = directButton(50,50,"拖動立體改變觀察方向", "orbit"); orbit.classList.add("orbit-target"); orbit.addEventListener("keydown", (event) => { if (!event.key.startsWith("Arrow")) return; const step = event.shiftKey ? 150 : 50; event.preventDefault(); update(Persistence.setView(state,{yaw10:state.part3.view.yaw10+(event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0),pitch10:state.part3.view.pitch10+(event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0)}),"已記錄新的觀察方向。" ); }); orbit.addEventListener("pointerdown", (event) => beginOrbit(event, orbit));
      const observationReady=state.part3.observations.length>0||Model.orientationDifference(problem.part3.initialView,state.part3.view)>=21;
      for (const item of projected) { const button = directButton(item.x/7,item.y/4.6,`候選點 ${item.key}${item.depth<0?"，在後方":"，在前方"}`,`candidate-${item.key}`,item.key);button.classList.add("candidate-target");button.classList.toggle("is-selected",state.part3.selectedCandidateKey===item.key);button.classList.toggle("is-observation-locked",!observationReady);button.setAttribute("aria-pressed",String(state.part3.selectedCandidateKey===item.key));button.setAttribute("aria-disabled",String(!observationReady));button.addEventListener("click",()=>{if(!observationReady){announce("請先拖動立體，從不同方向觀察；完成一次旋轉後即可按候選點。");return;}update(Persistence.selectPart3(state,item.key),state.part3.observations.length<2?`已暫選候選點 ${item.key}；如要完成觀察證據，請再轉動一次。`:`已選擇候選點 ${item.key}。`);});button.addEventListener("pointerdown",(event)=>showTapPreview(event,button,`candidate-${item.key}`)); }
      dom.radios.replaceChildren(dom.radios.querySelector("legend") || Object.assign(document.createElement("legend"),{textContent:"選擇重心候選點"}), ...Generator.LABELS.map((key)=>{const label=document.createElement("label"),input=document.createElement("input");input.type="radio";input.name="candidate";input.value=key;input.disabled=!observationReady;input.checked=state.part3.selectedCandidateKey===key;input.addEventListener("change",()=>{if(!observationReady)return;update(Persistence.selectPart3(state,key),state.part3.observations.length<2?`已暫選候選點 ${key}；如要完成觀察證據，請再轉動一次。`:`已選擇候選點 ${key}。`);});label.append(input,` ${key} `);return label;}));
      dom.solidSummary.textContent = observationReady ? `${problem.part3.type === "sphere" ? "均勻球體" : problem.part3.type === "cube" ? "均勻正方體" : "均勻長方體"}；你已完成一次觀察，現在可以按立體內的候選點判斷重心；亦可繼續轉動觀察藍色經緯線及橙色方向標記。` : `${problem.part3.type === "sphere" ? "均勻球體" : problem.part3.type === "cube" ? "均勻正方體" : "均勻長方體"}；請先拖動立體，從不同方向觀察藍色經緯線及橙色方向標記。完成一次明顯旋轉後，才可按候選點。`;
      dom.p3Status.textContent = observationReady ? `已完成 ${state.part3.observations.length}/2 個有效觀察姿態；現在可以按候選點${state.part3.selectedCandidateKey ? `，${state.part3.observations.length<2?"暫選":"已選"} ${state.part3.selectedCandidateKey}` : ""}。` : "尚未完成觀察；請先拖動立體旋轉。";
    }
    function renderCheck() { const result = Scoring.score(state); dom.svg.replaceChildren(svgEl("text",{x:350,y:210,"text-anchor":"middle","font-size":28,fill:"#1e293b"})); dom.svg.firstChild.textContent="三部分實驗證據已齊全"; dom.checkSummary.innerHTML = `<ul><li>第一部分：${state.part1.supportEpisodes.length} 次承托，平衡後已揭示精確重心</li><li>第二部分：${state.part2.lines.length} 條不同小孔鉛垂線，已標註</li><li>第三部分：2 個觀察姿態，已選候選點</li></ul><p>提交後會鎖定 attempt；提交前不顯示正確答案。</p><p class="sr-only">目前可重算分數 ${result.score}，提交前不作視覺顯示。</p>`; }
    function renderReview(result, trusted, message) { locked = true; hideAll(); dom.review.classList.remove("is-hidden"); dom.svg.style.display="block"; dom.canvas.style.display="none"; dom.direct.replaceChildren(); if(trusted&&state&&problem){supportX=state.part1.supportEpisodes.at(-1)?.x??.5;renderPart1(true);}else dom.svg.replaceChildren(); dom.badge.textContent="已鎖定的結果"; dom.progress.value=4; const safe = result && Number.isFinite(result.score); dom.reviewSummary.innerHTML = `<p class="notice">${message}</p>${safe ? `<p class="result-total">${Math.round(result.score*10)/10} / ${result.maxScore} — ${SimActivityFlow.completionLabel(result.passed)}</p><div class="score-grid">${result.detail.map((item)=>`<span>${item.label}</span><span>${Math.round(item.points*10)/10} / ${item.max}</span>`).join("")}</div>` : "<p>提交狀態未確認，因此不顯示推測分數或合格結論。</p>"}${trusted && state ? `<hr><p>一維：承托點進入平衡容差後，系統揭示題目生成的精確重心；理想情況下承托點與重心完全重合時，總力矩為零。</p><p>二維：每次停止時重心在懸掛孔正下方，鉛垂線交會給出重心。</p><p>三維：均勻對稱立體的重心位於幾何中心；正確候選為 ${problem.part3.correctKey}。</p>`:""}`; }
    function technicalLock(message) { locked=true;presentation="technical";rollbackInteraction();hideAll();dom.technical.classList.remove("is-hidden");dom.technicalMessage.textContent=message;dom.svg.replaceChildren();dom.canvas.style.display="none";dom.fallbackCanvas.style.display="none"; }
    function safeFallback(attempt,message) { latestResult={score:String(attempt.score).trim()===""?null:Number(attempt.score),maxScore:100,passed:attempt.status==="passed"?true:attempt.status==="failed"?false:null,detail:[]}; renderReview(latestResult,false,message); }
    function directButton(left, top, label, kind, text="") { const button=document.createElement("button");button.type="button";button.className="direct-target";button.dataset.directTarget=kind;button.style.left=`${left}%`;button.style.top=`${top}%`;button.setAttribute("aria-label",label);button.textContent=text;dom.direct.append(button);return button; }
    function clientPoint(event) { const rect=dom.stage.getBoundingClientRect();return {x:(event.clientX-rect.left)*700/rect.width,y:(event.clientY-rect.top)*460/rect.height,clientX:event.clientX,clientY:event.clientY}; }
    function beginDrag(event,target,kind,onMove,onEnd=()=>{}) { if (gesture || locked || event.button>0) return; event.preventDefault();target.setPointerCapture(event.pointerId);const start=clientPoint(event);gesture={id:event.pointerId,target,kind,last:start,onMove,onEnd,baselineState:Persistence.decode(Persistence.encode(committedState)),baselineSupport:supportX,baselinePose:{...platePose}};target.classList.add("active-direct");if(event.pointerType!=="mouse")showPreview(event,kind);target.addEventListener("pointermove",moveGesture);target.addEventListener("pointerup",endGesture,{once:true});target.addEventListener("pointercancel",cancelGesture,{once:true});target.addEventListener("lostpointercapture",lostGesture,{once:true}); }
    function moveGesture(event){if(!gesture||event.pointerId!==gesture.id)return;const point=clientPoint(event);gesture.onMove(point,gesture.last);gesture.last=point;updatePreview();}
    function endGesture(event){if(!gesture||event.pointerId!==gesture.id)return;const end=gesture.onEnd,last=gesture.last;clearGesture();end(last);}
    function cancelGesture(){rollbackInteraction();} function lostGesture(){if(gesture)rollbackInteraction();}
    function clearSwing(){if(swingFrame)cancelAnimationFrame(swingFrame);swingFrame=0;swingRuntime=null;swingLastTime=null;}
    function clearFall(){if(fallFrame)cancelAnimationFrame(fallFrame);fallFrame=0;fallRuntime=null;}
    function clearGesture(){clearSwing();clearFall();hostSwipe=null;snapCandidateKey=null;drawGhost=null;if(gesture){gesture.target.classList.remove("active-direct");gesture.target.removeEventListener("pointermove",moveGesture);gesture=null;}dom.preview.replaceChildren();dom.preview.className="preview is-hidden";}
    function rollbackInteraction(){const hadGesture=Boolean(gesture),interrupted=hadGesture||Boolean(fallRuntime)||Boolean(swingRuntime)||Boolean(swingFrame),baseline=gesture?.baselineState||(interrupted&&committedState?Persistence.decode(Persistence.encode(committedState)):null),support=gesture?.baselineSupport,pose=gesture?.baselinePose;clearGesture();markDraft=null;if(baseline){state=baseline;problem=Generator.generate(state.seed,state.generatorVersion);supportX=hadGesture?support:(state.part1.supportEpisodes.at(-1)?.x??.5);platePose=hadGesture?pose:(restoredPlatePose(state,problem)||{x:350,y:230,angle:0});render();}}
    function showTapPreview(event,target,kind){if(event.pointerType==="mouse")return;showPreview(event,kind);const clear=()=>{dom.preview.replaceChildren();dom.preview.className="preview is-hidden";};target.addEventListener("pointerup",clear,{once:true});target.addEventListener("pointercancel",clear,{once:true});}
    function previewFocus() { const kind = dom.preview.dataset.kind, last = gesture?.last;
      if (kind === "support") return { x: 80 + supportX * 540, y: 239 };
      if (kind?.startsWith("hole-")) { const hole = problem.part2.holes.find((item) => item.key === kind.slice(5)); return hole ? localToSvg(hole) : last; }
      if (kind === "rotate") return handleWorld;
      if (kind === "mark2") return markDraft?.world || (state.part2.mark ? localToSvg(state.part2.mark) : {x:650,y:390});
      return last || { x: platePose.x, y: platePose.y };
    }
    function renderSvgPreview(focus) { const clone=dom.svg.cloneNode(true);clone.removeAttribute("id");clone.setAttribute("viewBox",`${Model.clamp(focus.x-90,0,520)} ${Model.clamp(focus.y-90,0,280)} 180 180`);clone.querySelectorAll("[id],[tabindex],[role],[aria-label],[data-direct-target]").forEach((node)=>{node.removeAttribute("id");node.removeAttribute("tabindex");node.removeAttribute("role");node.removeAttribute("aria-label");node.removeAttribute("data-direct-target");});dom.preview.replaceChildren(clone); }
    function showPreview(event,kind){const rect=dom.stage.getBoundingClientRect(),corner=UiPolicy.previewCorner({x:event.clientX,y:event.clientY},{left:rect.left,top:rect.top,width:rect.width,height:rect.height});dom.preview.className=`preview ${corner}`;dom.preview.dataset.kind=kind;if(state.phase==="part3"){const canvas=document.createElement("canvas");canvas.width=220;canvas.height=220;dom.preview.replaceChildren(canvas);renderSolid(canvas,true);}else renderSvgPreview(clientPoint(event));}
    function updatePreview(){if(dom.preview.classList.contains("is-hidden"))return;if(state.phase==="part3"){const canvas=dom.preview.querySelector("canvas");if(canvas)renderSolid(canvas,true);}else renderSvgPreview(previewFocus());}
    function beginOrbit(event,target){if(gesture||locked||event.button>0)return;const start=clientPoint(event),base={...state.part3.view},before=state.part3.observations.length;beginDrag(event,target,"orbit",(point)=>{const next=Persistence.setView(state,{yaw10:base.yaw10+Math.round((point.x-start.x)*3),pitch10:base.pitch10+Math.round((point.y-start.y)*3)},false);if(next){state=next;if(part3Mode==="three"&&part3Renderer)part3Renderer.render(state.part3.view,state.part3.selectedCandidateKey);else renderSolid(dom.fallbackCanvas);updatePreview();}},()=>{const next=Persistence.setView(state,state.part3.view,true);if(next){state=next;checkpoint();announce(state.part3.observations.length>before?state.part3.observations.length===1?"已完成第一次觀察；現在可以按候選點判斷重心。再轉動一次可完成全部觀察證據。":"已完成兩個觀察姿態；現在可以按候選點判斷重心。":"旋轉幅度未達觀察要求，請再轉動較大角度。");render();}});}
    return { getState:()=>state, platePose:()=>({ ...platePose }), snapCandidate:()=>snapCandidateKey, swing:()=>swingRuntime ? { angle:swingRuntime.angle, target:swingRuntime.target, omega:swingRuntime.omega, settledFor:swingRuntime.settledFor, frame:swingFrame, lastTime:swingLastTime } : null, visibility:(hidden)=>hidden?pauseSwing():resumeSwing(), fall:()=>fallRuntime?{...fallRuntime}:null,renderer:()=>({mode:part3Mode,frame:Number((part3Mode==="three"?dom.canvas:dom.fallbackCanvas).dataset.frame)||0}),contextLoss:(action)=>{const extension=part3Renderer?.context?.getExtension("WEBGL_lose_context");if(!extension)return false;if(action==="lose")extension.loseContext();else if(action==="restore")extension.restoreContext();return true;},
      routeStartup, routeSubmission, render, clearGesture };
  }
  return { ACTIVITY, freshSeed, reviewMetadataValid, reviewMatches, restoredPlatePose, layoutCandidateTargets, part2Structure, drawEndpoint, boot };
});
