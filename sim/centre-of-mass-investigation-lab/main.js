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
  function layoutCandidateTargets(projected, width = 700, height = 460, minDistance = 46, inset = 24) {
    const diagonal=minDistance*.72,far=minDistance*1.45,offsets = [[0,0],[minDistance,0],[-minDistance,0],[0,minDistance],[0,-minDistance],[diagonal,diagonal],[-diagonal,diagonal],[diagonal,-diagonal],[-diagonal,-diagonal],[far,0],[-far,0]];
    const placed = [];
    for (const item of [...projected].sort((a,b) => b.depth-a.depth || a.key.localeCompare(b.key))) {
      let choice = null;
      for (const [dx,dy] of offsets) {
        const candidate = { ...item, anchorX:item.x, anchorY:item.y, x:Model.clamp(item.x+dx,inset,width-inset), y:Model.clamp(item.y+dy,inset,height-inset) };
        if (placed.every((other) => Math.hypot(candidate.x-other.x,candidate.y-other.y) >= minDistance)) { choice=candidate; break; }
      }
      placed.push(choice || { ...item, anchorX:item.x, anchorY:item.y, x:Model.clamp(item.x,inset,width-inset), y:Model.clamp(item.y,inset,height-inset) });
    }
    return placed.sort((a,b) => a.key.localeCompare(b.key));
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
    let supportX = .5, selectedHole = null, snapCandidateKey = null, platePose = { x: 350, y: 230, angle: 0 }, selectedRadio = null, gesture = null, hostSwipe = null, drawGhost = null, handleWorld = { x: 500, y: 100 };
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
      addEventListener("blur", rollbackInteraction); document.addEventListener("visibilitychange", () => { if (document.hidden) rollbackInteraction(); });
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
        state = restored; problem = Generator.generate(state.seed); const computed = Scoring.score(state);
        const trusted = SimActivityFlow.reviewResult(computed, attempt.snapshot, attempt); latestResult = trusted.result; latestReview = state;
        renderReview(trusted.result, trusted.trusted, trusted.trusted ? "已提交並鎖定" : "Moodle 記錄與活動重算不一致");
      } else if (outcome === "frozen") {
        try {
          const payload = attempt.snapshot?.payload, saved = JSON.parse(payload?.reviewJson || "null");
          const restored = Persistence.fromReview(saved?.answer), computed = restored && Scoring.score(restored);
          if (!restored || !reviewMatches(saved, payload, computed)) throw new Error("rejected pending payload");
          pendingExpected = Object.freeze({ reviewJson: payload.reviewJson, score: payload.score, maxScore: payload.maxScore, passed: payload.passed });
          state = restored; problem = Generator.generate(state.seed); latestReview = restored; latestResult = computed; presentation = "pending"; renderReview(null, false, "上次提交仍待確認；只可重試同一份已凍結答案。"); dom.retry.classList.remove("is-hidden");
        } catch { SimScorm.quarantinePending(); technicalLock("待提交資料的權威答案或證據不一致；已停止自動重試。"); }
      } else technicalLock("無法安全讀取 Moodle attempt；操作及分數均未確認。");
    }
    function checkpoint() { if (locked || !Persistence.validate(state)) return false; committedState = Persistence.decode(Persistence.encode(state)); return SimScorm.saveDraft(SimScorm.makeSnapshot(ACTIVITY, "draft", Persistence.encode(committedState))); }
    function update(next, message) { if (locked || !next) { announce("目前證據未達到這項操作的要求。"); return false; } clearGesture(); state = next; problem = Generator.generate(state.seed); checkpoint(); render(); announce(message); return true; }
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
        else { fallRuntime = null; fallFrame = 0; const completed = outcome === "balanced" ? Persistence.markPart1(next, supportX) : next; update(completed, outcome === "balanced" ? "物體保持水平；已在平衡位置標出重心。" : outcome === "left-fall" ? "物體向左傾倒；請重新移動承托再放手。" : "物體向右傾倒；請重新移動承托再放手。"); }
      };
      fallFrame = requestAnimationFrame(animate);
    }
    function alignHoleToNail(hole) { const offset = localToSvg(hole); platePose.x += 350 - offset.x; platePose.y += 42 - offset.y; }
    function applySwingPose(hole) { platePose.angle = swingRuntime.angle; alignHoleToNail(hole); renderPart2(true); syncPart2Targets(); updatePreview(); }
    function finishSwing(holeKey) { const next = Persistence.settleHole(state, holeKey); swingRuntime = null; swingFrame = 0; swingLastTime = null; update(next, `${holeKey} 的平板已停止，可以親手畫鉛垂線。`); }
    function resetPlateAfterLine(next) { const from={...platePose},to={x:350,y:235,angle:0},started=null,duration=matchMedia("(prefers-reduced-motion: reduce)").matches?160:430;state=next;problem=Generator.generate(state.seed);checkpoint();render();announce("鉛垂線已記錄；平板正在取下。");const animate=(time)=>{if(started===null)started=time;const t=Math.min(1,(time-started)/duration),e=1-Math.pow(1-t,3);platePose={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e,angle:from.angle+(to.angle-from.angle)*e};renderPart2(true);syncPart2Targets();if(t<1)swingFrame=requestAnimationFrame(animate);else{swingFrame=0;render();announce("平板已取下，可改用另一個小孔。");}};swingFrame=requestAnimationFrame(animate); }
    function hangSelected() {
      if (!selectedHole || state.phase !== "part2" || state.part2.activeHoleKey || swingRuntime || locked) return announce("請先選擇一個未使用的小孔。");
      const hole = problem.part2.holes.find((item) => item.key === selectedHole); if (!hole) return;
      alignHoleToNail(hole); swingRuntime = Model.createSwing(problem.part2, hole, platePose.angle); dom.p2Status.textContent = `${selectedHole} 已掛好，平板正在阻尼擺動。`; renderPart2(true); syncPart2Targets(); announce(`${selectedHole} 已掛好，平板正在擺動。`);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const start = swingRuntime.angle, target = swingRuntime.target;
        swingFrame = requestAnimationFrame(() => { if (!swingRuntime) return; swingRuntime.angle = start + (target - start) * .65; applySwingPose(hole); swingFrame = requestAnimationFrame(() => { if (!swingRuntime) return; swingRuntime.angle = target; swingRuntime.omega = 0; applySwingPose(hole); finishSwing(hole.key); }); });
        return;
      }
      const animate = (time) => {
        if (!swingRuntime) return;
        if (swingLastTime === null) swingLastTime = time;
        const settled = Model.stepSwing(swingRuntime, (time - swingLastTime) / 1000, problem.part2.mass); swingLastTime = time; applySwingPose(hole);
        if (settled) finishSwing(hole.key); else swingFrame = requestAnimationFrame(animate);
      };
      swingFrame = requestAnimationFrame(animate);
    }
    function placeNeutralMark() { const lines = state.part2.lines, valuesX = lines.flatMap((line) => [line.a[0], line.b[0]]), valuesY = lines.flatMap((line) => [line.a[1], line.b[1]]); if (!valuesX.length) return; update(Persistence.markPart2(state, { x: (Math.min(...valuesX) + Math.max(...valuesX)) / 2, y: (Math.min(...valuesY) + Math.max(...valuesY)) / 2 }), "已在學生線組的範圍中心放置標註；請自行微調。" ); }
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
      const complete=[state.part1.markX!==null,Boolean(state.part2.mark),state.part3.selectedCandidateKey!==null&&Model.validObservations(problem.part3.initialView,state.part3.observations)],count=complete.filter(Boolean).length;dom.progress.value=count;dom.badge.textContent=state.phase==="check"?"提交前檢查":`第 ${Number(state.phase.slice(-1))} 部分`;
      dom.tabs.forEach((tab,index)=>{const active=state.phase===`part${index+1}`;tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;tab.dataset.complete=String(complete[index]);});dom.checkTab.disabled=count!==3;dom.checkTab.setAttribute("aria-current",state.phase==="check"?"step":"false");
      if (state.phase === "part1") { dom.p1.classList.remove("is-hidden"); renderPart1(); }
      if (state.phase === "part2") { dom.p2.classList.remove("is-hidden"); renderPart2(); }
      if (state.phase === "part3") { dom.p3.classList.remove("is-hidden"); renderPart3(); }
      if (state.phase === "check") { dom.check.classList.remove("is-hidden"); renderCheck(); }
    }
    function svgEl(name, attrs = {}) { const element = document.createElementNS(NS, name); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value); return element; }
    function renderPart1(visualsOnly = false) {
      const x = 80 + supportX * 540, mark = state.part1.markX, last = state.part1.supportEpisodes.at(-1), angle = fallRuntime?.angle || 0, rodBottom=239;
      dom.svg.replaceChildren(svgEl("rect",{x:0,y:0,width:700,height:460,fill:"#ffffff",class:"blank-stage"}),svgEl("line",{x1:42,y1:370,x2:658,y2:370,stroke:"#e5e7eb","stroke-width":1}));
      const apparatus=svgEl("g",{transform:`rotate(${angle} ${x} ${rodBottom})`});
      apparatus.append(svgEl("rect",{x:80,y:215,width:540,height:24,rx:4,fill:"#2563eb","data-scene":"rod","data-contact-y":rodBottom}),svgEl("rect",{x:84,y:218,width:532,height:5,rx:2.5,fill:"#60a5fa",opacity:.75}));
      if(mark!==null)apparatus.append(svgEl("circle",{cx:80+mark*540,cy:227,r:10,class:"student-mark"}),svgEl("path",{d:`M${80+mark*540-5} 227h10M${80+mark*540} 222v10`,stroke:"#2563eb","stroke-width":2}));dom.svg.append(apparatus);
      dom.svg.append(svgEl("path",{d:`M${x} ${rodBottom} L${x-22} 338 L${x+22} 338Z`,fill:"#f59e0b","data-scene":"support","data-contact-y":rodBottom}),svgEl("rect",{x:x-32,y:338,width:64,height:7,rx:2,fill:"#d97706"}));
      if (visualsOnly) return;
      const support = directButton(x / 7, rodBottom/4.6, "承托架；拖動後放手測試", "support"); support.classList.add("support-target"); support.style.width="70px";support.style.height=`${(345-rodBottom)/460*100}%`;support.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { supportX = Model.clamp(supportX + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? .05 : .01), 0, 1); event.preventDefault(); render(); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); testSupport(); } }); support.addEventListener("pointerdown", (event) => beginDrag(event, support, "support", (point) => { supportX = Model.clamp((point.x - 80) / 540, 0, 1); support.style.left = `${(80 + supportX * 540) / 7}%`; renderPart1(true); }, testSupport));
      if (state.part1.supportEpisodes.some((item)=>item.outcome==="balanced")) { const markValue=mark??supportX,target=directButton((80+markValue*540)/7,227/4.6,"重心標註；拖動或用左右方向鍵調整", "mark1", "+"); target.classList.add("mark-target");target.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)&&mark===null){event.preventDefault();update(Persistence.markPart1(state,markValue),"已放置重心標註。");}else if(["ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();update(Persistence.markPart1(state,Model.clamp(markValue+(event.key==="ArrowLeft"?-1:1)*(event.shiftKey?.05:.01),0,1)),"已移動重心標註。");}});target.addEventListener("pointerdown",(event)=>beginDrag(event,target,"mark1",(point)=>{const next=Persistence.markPart1(state,Model.clamp((point.x-80)/540,0,1));if(next){state=next;target.style.left=`${(80+state.part1.markX*540)/7}%`;renderPart1(true);}},()=>{checkpoint();render();announce("標記位置已記錄。");})); }
      dom.p1Status.textContent = last ? last.outcome === "balanced" ? "物體保持水平：這是中性平衡。" : last.outcome === "left-fall" ? "上次向左傾倒。" : "上次向右傾倒。" : "尚未完成承托放手測試。";
      dom.p1MarkTools.classList.toggle("is-hidden", !state.part1.supportEpisodes.some((item) => item.outcome === "balanced"));
    }
    function localToSvg(point) { const c = Math.cos(platePose.angle), s = Math.sin(platePose.angle), scale = 245; return { x: platePose.x + (point.x * c - point.y * s) * scale, y: platePose.y + (point.x * s + point.y * c) * scale }; }
    function svgToLocal(point) { const dx = (point.x - platePose.x) / 245, dy = (point.y - platePose.y) / 245, c = Math.cos(platePose.angle), s = Math.sin(platePose.angle); return { x: dx * c + dy * s, y: -dx * s + dy * c }; }
    function platePath() { return problem.part2.polygon.map((point, i) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${i ? "L" : "M"}${p.x},${p.y}`; }).join(" ") + " Z"; }
    function safeHandlePoint() { const rect=dom.stage.getBoundingClientRect(),insetX=Math.max(23,23*700/Math.max(1,rect.width)),insetY=Math.max(23,23*460/Math.max(1,rect.height)),candidates=[localToSvg({x:.68,y:-.58}),localToSvg({x:-.68,y:.58})],margin=(p)=>Math.min(p.x-insetX,700-insetX-p.x,p.y-insetY,460-insetY-p.y),best=candidates.sort((a,b)=>margin(b)-margin(a))[0];return{x:Model.clamp(best.x,insetX,700-insetX),y:Model.clamp(best.y,insetY,460-insetY)}; }
    function nearestSnapCandidate(preferredKey = null) { const eligible=problem.part2.holes.filter((hole)=>!state.part2.lines.some((line)=>line.holeKey===hole.key)&&(preferredKey===null||hole.key===preferredKey));let best=null;for(const hole of eligible){const point=localToSvg(hole),distance=Math.hypot(point.x-350,point.y-42);if(distance<=42&&(!best||distance<best.distance))best={key:hole.key,distance};}return best?.key||null; }
    function updateSnapCandidate(preferredKey = null) { snapCandidateKey=nearestSnapCandidate(preferredKey);renderPart2(true);syncPart2Targets(); }
    function prepareTakeDown() { if (!state.part2.activeHoleKey) return true; const next=Persistence.detachActiveHole(state);if(!next)return false;state=next;problem=Generator.generate(state.seed);return checkpoint(); }
    function finishPlateDrop(preferredKey = null) { const key=snapCandidateKey||nearestSnapCandidate(preferredKey);snapCandidateKey=null;if(!key){render();announce("小孔未在牆釘的對準範圍內，未形成懸掛證據。");return;}selectedHole=key;alignHoleToNail(problem.part2.holes.find((hole)=>hole.key===key));render();hangSelected(); }
    function beginPlateDrag(event,target,preferredKey=null) { if(swingRuntime||!prepareTakeDown())return;beginDrag(event,target,preferredKey?`hole-${preferredKey}`:"plate",(point,previous)=>{platePose.x+=point.x-previous.x;platePose.y+=point.y-previous.y;updateSnapCandidate(preferredKey);updatePreview();},()=>finishPlateDrop(preferredKey)); }
    function syncPart2Targets() {
      const plate = dom.direct.querySelector('[data-direct-target="plate"]'); if (plate) plate.style.clipPath = `polygon(${problem.part2.polygon.map((point) => { const p=localToSvg({x:point[0],y:point[1]});return `${p.x/7}% ${p.y/4.6}%`; }).join(",")})`;
      for (const target of dom.direct.querySelectorAll("[data-hole-key]")) { const hole = problem.part2.holes.find((item) => item.key === target.dataset.holeKey), point = hole && localToSvg(hole); if (point) { target.style.left = `${point.x / 7}%`; target.style.top = `${point.y / 4.6}%`; } }
      const handle = dom.direct.querySelector('[data-direct-target="rotate"]'); if (handle) { handleWorld=safeHandlePoint(); handle.style.left = `${handleWorld.x / 7}%`; handle.style.top = `${handleWorld.y / 4.6}%`; }
      const mark = dom.direct.querySelector('[data-direct-target="mark2"]'); if (mark && state.part2.mark) { const point = localToSvg(state.part2.mark); mark.style.left = `${point.x / 7}%`; mark.style.top = `${point.y / 4.6}%`; }
      const draw = dom.direct.querySelector('[data-direct-target="draw"]'); if (draw) draw.style.clipPath = `polygon(${problem.part2.polygon.map((point) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${p.x / 7}% ${p.y / 4.6}%`; }).join(",")})`;
    }
    function renderPart2(visualsOnly = false) {
      dom.svg.replaceChildren(svgEl("rect", { x:0,y:0,width:700,height:460,fill:"#ffffff",class:"blank-stage" }),svgEl("line",{x1:24,y1:86,x2:676,y2:86,stroke:"#e5e7eb","stroke-width":1}),svgEl("circle",{cx:350,cy:42,r:snapCandidateKey?35:31,fill:"#dbeafe",opacity:.72,class:snapCandidateKey?"snap-ring":""}),svgEl("circle",{cx:350,cy:42,r:5,fill:snapCandidateKey?"#f97316":"#1e40af"}),svgEl("path",{d:platePath(),class:"plate"}));
      for (const line of state.part2.lines) { const a = localToSvg({ x: line.a[0], y: line.a[1] }), b = localToSvg({ x: line.b[0], y: line.b[1] }); dom.svg.append(svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "student-line" })); }
      if (state.part2.mark) { const p = localToSvg(state.part2.mark); dom.svg.append(svgEl("circle", { cx: p.x, cy: p.y, r: 14, class: "student-mark" })); }
      if(drawGhost)dom.svg.append(svgEl("line",{x1:drawGhost.a.x,y1:drawGhost.a.y,x2:drawGhost.b.x,y2:drawGhost.b.y,stroke:drawGhost.snapped?"#2563eb":"#94a3b8","stroke-width":2,"stroke-dasharray":"5 4","data-scene":"draw-ghost"}));
      if(state.part2.activeHoleKey){dom.svg.append(svgEl("line",{x1:350,y1:52,x2:350,y2:420,class:"plumb"}),svgEl("path",{d:"M350 418l-12 24h24Z",fill:"#374b57",stroke:"#1f3039","stroke-width":3}));}
      for (const hole of problem.part2.holes) { const p = localToSvg(hole),snapping=hole.key===snapCandidateKey;if(snapping)dom.svg.append(svgEl("circle",{cx:p.x,cy:p.y,r:16,class:"snap-ring","data-snap-hole":hole.key}));dom.svg.append(svgEl("circle", { cx:p.x,cy:p.y,r:snapping?10:9,class:"hole-ring" }),svgEl("circle",{cx:p.x,cy:p.y,r:3,fill:snapping?"#f97316":"#1e40af"})); }
      handleWorld=safeHandlePoint();dom.svg.append(svgEl("path",{d:`M${handleWorld.x-10} ${handleWorld.y+3} A11 11 0 1 1 ${handleWorld.x+7} ${handleWorld.y-7}`,fill:"none",stroke:"#2563eb","stroke-width":2,"stroke-linecap":"round"}),svgEl("path",{d:`M${handleWorld.x+7} ${handleWorld.y-7}l-1 7 7-2Z`,fill:"#2563eb"}));
      if (visualsOnly) return;
      const plateTarget = directButton(0,0,"拖動平板，將最近的小孔移近牆釘","plate");plateTarget.style.inset="0";plateTarget.style.width="100%";plateTarget.style.height="100%";plateTarget.style.transform="none";plateTarget.style.borderRadius="0";plateTarget.addEventListener("keydown", (event) => { if (event.key.startsWith("Arrow") && !swingRuntime) { if(!prepareTakeDown())return;const step = event.shiftKey ? 18 : 6; platePose.x += event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0; platePose.y += event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0; event.preventDefault(); render(); } });plateTarget.addEventListener("pointerdown",(event)=>beginPlateDrag(event,plateTarget));
      for (const hole of problem.part2.holes) { const p = localToSvg(hole), target = directButton(p.x / 7, p.y / 4.6, `小孔 ${hole.key.slice(1)}；拖近牆釘後放手`, `hole-${hole.key}`, hole.key.slice(1)); target.dataset.holeKey = hole.key; target.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)&&!swingRuntime){event.preventDefault();if(!prepareTakeDown())return;selectedHole=hole.key;alignHoleToNail(hole);hangSelected();}});target.addEventListener("pointerdown",(event)=>beginPlateDrag(event,target,hole.key)); }
      const handle = directButton(handleWorld.x / 7, handleWorld.y / 4.6, "平板旋轉手柄；拖動或用左右方向鍵旋轉", "rotate"); handle.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key) && !state.part2.activeHoleKey && !swingRuntime) { platePose.angle += (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 15 : 5) * Math.PI / 180; event.preventDefault(); render(); } }); handle.addEventListener("pointerdown", (event) => { if (state.part2.activeHoleKey || swingRuntime) return; const start = clientPoint(event), base = platePose.angle, pointerAngle = Math.atan2(start.y - platePose.y, start.x - platePose.x); beginDrag(event, handle, "rotate", (point) => { platePose.angle = base + Math.atan2(point.y - platePose.y, point.x - platePose.x) - pointerAngle; renderPart2(true); syncPart2Targets(); updatePreview(); }, () => render()); });
      if (state.part2.activeHoleKey) {
        const draw=document.createElement("div"),polygon=problem.part2.polygon.map((point)=>{const p=localToSvg({x:point[0],y:point[1]});return `${p.x/7}% ${p.y/4.6}%`;}).join(",");
        draw.className="draw-target";draw.dataset.directTarget="draw";draw.style.clipPath=`polygon(${polygon})`;draw.setAttribute("role","button");draw.setAttribute("tabindex","0");draw.setAttribute("aria-label","由懸掛孔向下拖畫鉛垂線，或拖動平板取下重掛");dom.direct.append(draw);
        draw.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)){event.preventDefault();const next=Persistence.traceVertical(state);if(next)resetPlateAfterLine(next);}});
        draw.addEventListener("pointerdown",(event)=>{
          const start=clientPoint(event),activeHole=problem.part2.holes.find((hole)=>hole.key===state.part2.activeHoleKey),pivot=localToSvg(activeHole),startNear=Math.hypot(start.x-pivot.x,start.y-pivot.y)<=Math.max(28,.12*problem.part2.size*245);
          if(!startNear){const closest=problem.part2.holes.map((hole)=>({hole,distance:Math.hypot(start.x-localToSvg(hole).x,start.y-localToSvg(hole).y)})).filter((item)=>item.hole.key!==activeHole.key&&item.distance<=28).sort((a,b)=>a.distance-b.distance)[0];beginPlateDrag(event,draw,closest?.hole.key||null);return;}
          let snapped=false;
          beginDrag(event,draw,"draw",(point)=>{const dx=point.x-start.x,dy=point.y-start.y,length=Math.hypot(dx,dy),deviation=length&&dy>0?Math.acos(Math.min(1,dy/length))*180/Math.PI:90;snapped=length>=.45*problem.part2.size*245&&dy>0&&deviation<=10;drawGhost=snapped?{a:{x:pivot.x,y:pivot.y},b:{x:pivot.x,y:pivot.y+Math.max(120,dy)},snapped:true}:{a:pivot,b:point,snapped:false};renderPart2(true);updatePreview();},()=>{drawGhost=null;if(!snapped){render();announce("請由懸掛孔向下沿垂直方向拖畫鉛垂線。");return;}const ux=Math.sin(platePose.angle),uy=Math.cos(platePose.angle),line={holeKey:activeHole.key,a:[activeHole.x-ux*.36,activeHole.y-uy*.36],b:[activeHole.x+ux*.36,activeHole.y+uy*.36]},next=Persistence.recordLine(state,line);if(next)resetPlateAfterLine(next);else{render();announce("線段未符合鉛垂線證據要求，請重畫。");}});
        });
      }
      const ev = Scoring.evidence(state, problem);
      if (ev.lines.length >= 2 && ev.nonDegenerate) { const evidenceCentre=Model.leastSquares(state.part2.lines)||{x:0,y:0},markValue=state.part2.mark||evidenceCentre,point=localToSvg(markValue),markTarget=directButton(point.x/7,point.y/4.6,"平板重心標註；拖動或方向鍵調整","mark2","＋");markTarget.classList.add("mark-target");markTarget.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)&&!state.part2.mark){event.preventDefault();update(Persistence.markPart2(state,markValue),"已放置平板重心標註。");return;}if(!event.key.startsWith("Arrow"))return;event.preventDefault();const step=(event.shiftKey?.05:.01)*problem.part2.size,next={x:markValue.x+(event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0),y:markValue.y+(event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0)};update(Persistence.markPart2(state,next),"已移動平板標註。");});markTarget.addEventListener("pointerdown",(event)=>beginDrag(event,markTarget,"mark2",(position)=>{const next=Persistence.markPart2(state,svgToLocal(position));if(next){state=next;markTarget.style.left=`${position.x/7}%`;markTarget.style.top=`${position.y/4.6}%`;renderPart2(true);}},()=>{checkpoint();render();announce("平板標記位置已記錄。");})); }
      syncPart2Targets();
      dom.p2MarkTools.classList.toggle("is-hidden", !(ev.lines.length >= 2 && ev.nonDegenerate));
      dom.p2Status.textContent = swingRuntime ? `${selectedHole} 已掛好，平板正在阻尼擺動。` : state.part2.activeHoleKey ? `${state.part2.activeHoleKey} 已停止，可親手畫鉛垂線。` : `已取得 ${state.part2.lines.length} 個不同小孔的有效鉛垂線。`;
    }
    function renderSolid(canvas, compact = false) {
      const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;if(!ctx)throw new Error("Canvas unavailable"); ctx.clearRect(0, 0, w, h);ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(0,i*h/8);ctx.lineTo(w,i*h/8);ctx.stroke();} const scale = compact ? w * .28 : Math.min(w, h) * .29, cx = w / 2, cy = h / 2;
      ctx.strokeStyle = "#2563eb"; ctx.fillStyle = "rgba(59,130,246,.28)"; ctx.lineWidth = compact ? 1.5 : 2;
      if (problem.part3.type === "sphere") {const glow=ctx.createRadialGradient(cx-scale*.35,cy-scale*.4,scale*.08,cx,cy,scale);glow.addColorStop(0,"rgba(255,255,255,.9)");glow.addColorStop(.35,"rgba(102,174,199,.55)");glow.addColorStop(1,"rgba(29,83,109,.38)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,scale,0,Math.PI*2);ctx.fill();ctx.stroke();for(const squash of [.28,.62]){ctx.beginPath();ctx.ellipse(cx,cy,scale,scale*squash,state.part3.view.yaw10*Math.PI/1800,0,Math.PI*2);ctx.globalAlpha=.48;ctx.stroke();}ctx.globalAlpha=1;}
      else { const axes = problem.part3.axes, vertices = []; for (const x of [-axes[0], axes[0]]) for (const y of [-axes[1], axes[1]]) for (const z of [-axes[2], axes[2]]) { const p = Model.project([x,y,z], state.part3.view, scale); vertices.push({ x: cx+p.x, y: cy+p.y, z:p.depth }); } const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].map(ids=>({ids,z:ids.reduce((s,i)=>s+vertices[i].z,0)/4})).sort((a,b)=>a.z-b.z);for(const [index,face] of faces.entries()){ctx.beginPath();face.ids.forEach((id,i)=>i?ctx.lineTo(vertices[id].x,vertices[id].y):ctx.moveTo(vertices[id].x,vertices[id].y));ctx.closePath();ctx.fillStyle=`rgba(${55+index*7},${120+index*6},${151+index*5},.24)`;ctx.fill();ctx.stroke();} }
      const projected = problem.part3.candidates.map((item) => ({ item, p: Model.project(item.position, state.part3.view, scale) })).sort((a,b) => a.p.depth-b.p.depth); for (const {item,p} of projected) { ctx.globalAlpha = p.depth < 0 ? .48 : 1; ctx.fillStyle = item.key === state.part3.selectedCandidateKey ? "#dc2626" : "#2563eb"; ctx.beginPath(); ctx.arc(cx+p.x,cy+p.y,compact?6:8,0,Math.PI*2); ctx.fill();ctx.fillStyle="#1f2937";ctx.font=`600 ${compact?13:15}px system-ui`;ctx.fillText(item.key,cx+p.x+11,cy+p.y-8); } ctx.globalAlpha=1;
      canvas.dataset.renderer="canvas-fallback";canvas.dataset.frame=String((Number(canvas.dataset.frame)||0)+1);return projected.map(({item,p}) => ({ key:item.key, x:cx+p.x, y:cy+p.y, depth:p.depth }));
    }
    function ensurePart3Renderer(){if(part3Renderer||part3Attempted)return;part3Attempted=true;part3Mode="loading";dom.rendererBadge.textContent="載入空間視圖…";import("./part3-renderer.js").then(()=>{if(globalThis.__CENTRE_MASS_FORCE_FALLBACK||new URLSearchParams(location.search).get("renderer")==="canvas")throw new Error("requested fallback");part3Renderer=globalThis.CentreMassPart3Renderer.create(dom.canvas,problem.part3,(event)=>{part3Mode=event==="restored"?"three":"fallback";if(state?.phase==="part3"&&!gesture)render();});part3Mode="three";if(state?.phase==="part3"&&!gesture)render();}).catch(()=>{part3Mode="fallback";part3Renderer=null;if(state?.phase==="part3"&&!gesture)render();});}
    function renderPart3() {
      dom.svg.replaceChildren();ensurePart3Renderer();dom.canvas.style.display=part3Mode==="three"?"block":"none";dom.fallbackCanvas.style.display=part3Mode==="three"?"none":"block";dom.rendererBadge.textContent=part3Mode==="three"?(part3Renderer?.label||"Three.js 0.185.1"):part3Mode==="loading"?"載入空間視圖…":"Canvas 相容模式";let projected;try{projected=part3Mode==="three"&&part3Renderer?part3Renderer.render(state.part3.view,state.part3.selectedCandidateKey):renderSolid(dom.fallbackCanvas);}catch{part3Mode="fallback";part3Renderer?.dispose?.();part3Renderer=null;dom.canvas.style.display="none";dom.fallbackCanvas.style.display="block";projected=renderSolid(dom.fallbackCanvas);}const stageRect=dom.stage.getBoundingClientRect(),minimum=Math.max(46,46*700/Math.max(1,stageRect.width),46*460/Math.max(1,stageRect.height)),inset=Math.max(24,24*700/Math.max(1,stageRect.width),24*460/Math.max(1,stageRect.height));projected=layoutCandidateTargets(projected,700,460,minimum,inset);lastProjection=projected; dom.direct.replaceChildren(); const orbit = directButton(50,50,"拖動立體改變觀察方向", "orbit"); orbit.classList.add("orbit-target"); orbit.addEventListener("keydown", (event) => { if (!event.key.startsWith("Arrow")) return; const step = event.shiftKey ? 150 : 50; event.preventDefault(); update(Persistence.setView(state,{yaw10:state.part3.view.yaw10+(event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0),pitch10:state.part3.view.pitch10+(event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0)}),"已記錄新的觀察方向。" ); }); orbit.addEventListener("pointerdown", (event) => beginOrbit(event, orbit));
      for (const item of projected) { const button = directButton(item.x/7,item.y/4.6,`候選點 ${item.key}${item.depth<0?"，在後方":"，在前方"}`,`candidate-${item.key}`,item.key);button.classList.add("candidate-target");button.classList.toggle("is-selected",state.part3.selectedCandidateKey===item.key);button.setAttribute("aria-pressed",String(state.part3.selectedCandidateKey===item.key));button.addEventListener("click",()=>update(Persistence.selectPart3(state,item.key),state.part3.observations.length<2?`已暫選候選點 ${item.key}；請繼續從不同方向觀察。`:`已選擇候選點 ${item.key}。`));button.addEventListener("pointerdown",(event)=>showTapPreview(event,button,`candidate-${item.key}`)); }
      dom.radios.replaceChildren(dom.radios.querySelector("legend") || Object.assign(document.createElement("legend"),{textContent:"選擇重心候選點"}), ...Generator.LABELS.map((key)=>{const label=document.createElement("label"),input=document.createElement("input");input.type="radio";input.name="candidate";input.value=key;input.checked=state.part3.selectedCandidateKey===key;input.addEventListener("change",()=>update(Persistence.selectPart3(state,key),state.part3.observations.length<2?`已暫選候選點 ${key}；請繼續觀察。`:`已選擇候選點 ${key}。`));label.append(input,` ${key} `);return label;}));
      dom.solidSummary.textContent = `${problem.part3.type === "sphere" ? "均勻球體" : problem.part3.type === "cube" ? "均勻正方體" : "均勻長方體"}；拖動立體從不同方向觀察。`;
      dom.p3Status.textContent = `已完成 ${state.part3.observations.length}/2 個有效觀察姿態${state.part3.selectedCandidateKey ? `；${state.part3.observations.length<2?"暫選":"已選"} ${state.part3.selectedCandidateKey}` : ""}。`;
    }
    function renderCheck() { const result = Scoring.score(state); dom.svg.replaceChildren(svgEl("text",{x:350,y:210,"text-anchor":"middle","font-size":28,fill:"#1e293b"})); dom.svg.firstChild.textContent="三部分實驗證據已齊全"; dom.checkSummary.innerHTML = `<ul><li>第一部分：${state.part1.supportEpisodes.length} 次承托，已標註</li><li>第二部分：${state.part2.lines.length} 條不同小孔鉛垂線，已標註</li><li>第三部分：2 個觀察姿態，已選候選點</li></ul><p>提交後會鎖定 attempt；提交前不顯示正確答案。</p><p class="sr-only">目前可重算分數 ${result.score}，提交前不作視覺顯示。</p>`; }
    function renderReview(result, trusted, message) { locked = true; hideAll(); dom.review.classList.remove("is-hidden"); dom.svg.style.display="block"; dom.canvas.style.display="none"; dom.direct.replaceChildren(); dom.badge.textContent="已鎖定的結果"; dom.progress.value=4; const safe = result && Number.isFinite(result.score); dom.reviewSummary.innerHTML = `<p class="notice">${message}</p>${safe ? `<p class="result-total">${Math.round(result.score*10)/10} / ${result.maxScore} — ${SimActivityFlow.completionLabel(result.passed)}</p><div class="score-grid">${result.detail.map((item)=>`<span>${item.label}</span><span>${Math.round(item.points*10)/10} / ${item.max}</span>`).join("")}</div>` : "<p>提交狀態未確認，因此不顯示推測分數或合格結論。</p>"}${trusted && state ? `<hr><p>一維：學生標註與真重心可比較；平衡時承托點通過重心，總力矩為零。</p><p>二維：每次停止時重心在懸掛孔正下方，鉛垂線交會給出重心。</p><p>三維：均勻對稱立體的重心位於幾何中心；正確候選為 ${problem.part3.correctKey}。</p>`:""}`; }
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
    function rollbackInteraction(){const hadGesture=Boolean(gesture),interrupted=hadGesture||Boolean(fallRuntime)||Boolean(swingRuntime)||Boolean(swingFrame),baseline=gesture?.baselineState||(interrupted&&committedState?Persistence.decode(Persistence.encode(committedState)):null),support=gesture?.baselineSupport,pose=gesture?.baselinePose;clearGesture();if(baseline){state=baseline;problem=Generator.generate(state.seed,state.generatorVersion);supportX=hadGesture?support:(state.part1.supportEpisodes.at(-1)?.x??.5);platePose=hadGesture?pose:(restoredPlatePose(state,problem)||{x:350,y:230,angle:0});render();}}
    function showTapPreview(event,target,kind){if(event.pointerType==="mouse")return;showPreview(event,kind);const clear=()=>{dom.preview.replaceChildren();dom.preview.className="preview is-hidden";};target.addEventListener("pointerup",clear,{once:true});target.addEventListener("pointercancel",clear,{once:true});}
    function previewFocus() { const kind = dom.preview.dataset.kind, last = gesture?.last;
      if (kind === "support") return { x: 80 + supportX * 540, y: 239 };
      if (kind === "mark1") return { x: 80 + (state.part1.markX ?? supportX) * 540, y: 227 };
      if (kind?.startsWith("hole-")) { const hole = problem.part2.holes.find((item) => item.key === kind.slice(5)); return hole ? localToSvg(hole) : last; }
      if (kind === "rotate") return handleWorld;
      if (kind === "mark2" && state.part2.mark) return localToSvg(state.part2.mark);
      return last || { x: platePose.x, y: platePose.y };
    }
    function renderSvgPreview(focus) { const clone=dom.svg.cloneNode(true);clone.removeAttribute("id");clone.setAttribute("viewBox",`${Model.clamp(focus.x-90,0,520)} ${Model.clamp(focus.y-90,0,280)} 180 180`);clone.querySelectorAll("[id],[tabindex],[role],[aria-label],[data-direct-target]").forEach((node)=>{node.removeAttribute("id");node.removeAttribute("tabindex");node.removeAttribute("role");node.removeAttribute("aria-label");node.removeAttribute("data-direct-target");});dom.preview.replaceChildren(clone); }
    function showPreview(event,kind){const rect=dom.stage.getBoundingClientRect(),corner=UiPolicy.previewCorner({x:event.clientX,y:event.clientY},{left:rect.left,top:rect.top,width:rect.width,height:rect.height});dom.preview.className=`preview ${corner}`;dom.preview.dataset.kind=kind;if(state.phase==="part3"){const canvas=document.createElement("canvas");canvas.width=220;canvas.height=220;dom.preview.replaceChildren(canvas);renderSolid(canvas,true);}else renderSvgPreview(clientPoint(event));}
    function updatePreview(){if(dom.preview.classList.contains("is-hidden"))return;if(state.phase==="part3"){const canvas=dom.preview.querySelector("canvas");if(canvas)renderSolid(canvas,true);}else renderSvgPreview(previewFocus());}
    function beginOrbit(event,target){if(gesture||locked||event.button>0)return;const start=clientPoint(event),base={...state.part3.view};beginDrag(event,target,"orbit",(point)=>{const next=Persistence.setView(state,{yaw10:base.yaw10+Math.round((point.x-start.x)*3),pitch10:base.pitch10+Math.round((point.y-start.y)*3)},false);if(next){state=next;if(part3Mode==="three"&&part3Renderer)part3Renderer.render(state.part3.view,state.part3.selectedCandidateKey);else renderSolid(dom.fallbackCanvas);updatePreview();}},()=>{const next=Persistence.setView(state,state.part3.view,true);if(next){state=next;checkpoint();render();announce("旋轉結束；已檢查是否形成新的觀察證據。");}});}
    return { getState:()=>state, platePose:()=>({ ...platePose }), snapCandidate:()=>snapCandidateKey, swing:()=>swingRuntime ? { angle:swingRuntime.angle, target:swingRuntime.target } : null, fall:()=>fallRuntime?{...fallRuntime}:null,renderer:()=>({mode:part3Mode,frame:Number((part3Mode==="three"?dom.canvas:dom.fallbackCanvas).dataset.frame)||0}),contextLoss:(action)=>{const extension=part3Renderer?.context?.getExtension("WEBGL_lose_context");if(!extension)return false;if(action==="lose")extension.loseContext();else if(action==="restore")extension.restoreContext();return true;},
      routeStartup, routeSubmission, render, clearGesture };
  }
  return { ACTIVITY, freshSeed, reviewMetadataValid, reviewMatches, restoredPlatePose, layoutCandidateTargets, boot };
});
