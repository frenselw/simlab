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
  function freshSeed() {
    const value = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(value)[0];
    return (Date.now() ^ Math.floor((globalThis.performance?.now?.() || 0) * 1000)) >>> 0;
  }
  function reviewMatches(reviewSnapshot, payload, computed) {
    if (!reviewMetadataValid(reviewSnapshot) || !payload || typeof payload.score !== "number" || !Number.isFinite(payload.score) ||
        typeof payload.maxScore !== "number" || !Number.isFinite(payload.maxScore) || typeof payload.passed !== "boolean") return false;
    const canonical = Persistence.fromReview(reviewSnapshot.answer);
    return Boolean(canonical && JSON.stringify(canonical) === JSON.stringify(reviewSnapshot.answer) &&
      payload?.reviewJson === JSON.stringify(reviewSnapshot) &&
      reviewSnapshot.score === computed.score && Boolean(reviewSnapshot.passed) === computed.passed &&
      payload.score === computed.score && payload.maxScore === computed.maxScore && Boolean(payload.passed) === computed.passed);
  }
  function reviewMetadataValid(snapshot) { return Boolean(snapshot && snapshot.kind === "review" && snapshot.activity === ACTIVITY &&
    typeof snapshot.score === "number" && Number.isFinite(snapshot.score) && typeof snapshot.passed === "boolean"); }
  function restoredPlatePose(state, problem, nail = { x: 350, y: 42 }, scale = 245) {
    if (state?.phase !== "part2" || !state.part2?.activeHoleKey) return null;
    const hole = problem?.part2?.holes.find((item) => item.key === state.part2.activeHoleKey); if (!hole) return null;
    const angle = Model.equilibriumAngle(hole, problem.part2.centre), c = Math.cos(angle), s = Math.sin(angle);
    return { x: nail.x - (hole.x * c - hole.y * s) * scale, y: nail.y - (hole.x * s + hole.y * c) * scale, angle };
  }
  function boot(options = {}) {
    const $ = (id) => document.getElementById(id);
    const dom = { app: $("app"), stage: $("stage"), svg: $("svgStage"), canvas: $("solidCanvas"), fallbackCanvas: $("fallbackCanvas"), direct: $("directLayer"), preview: $("preview"), rendererBadge: $("rendererBadge"), panel: $("controlPanel"),
      badge: $("phaseBadge"), progress: $("progress"), technical: $("technical"), technicalMessage: $("technicalMessage"), technicalRetry: $("technicalRetry"),
      p1: $("part1Controls"), p1Status: $("part1Status"), p1MarkTools: $("part1MarkTools"), testSupport: $("testSupport"), placeP1: $("placePart1Mark"), confirmP1: $("confirmPart1"),
      p2: $("part2Controls"), p2Status: $("part2Status"), holeButtons: $("holeButtons"), hang: $("hangHole"), trace: $("traceLine"), p2MarkTools: $("part2MarkTools"), placeP2: $("placePart2Mark"), confirmP2: $("confirmPart2"),
      p3: $("part3Controls"), p3Status: $("part3Status"), solidSummary: $("solidSummary"), radios: $("candidateRadios"), confirmCandidate: $("confirmCandidate"), confirmP3: $("confirmPart3"),
      check: $("checkControls"), checkSummary: $("checkSummary"), submit: $("submit"), review: $("reviewControls"), reviewSummary: $("reviewSummary"), retry: $("retrySubmission"), live: $("liveRegion") };
    let state = null, committedState = null, problem = null, locked = false, presentation = null, latestReview = null, latestResult = null;
    let supportX = .5, selectedHole = null, platePose = { x: 350, y: 230, angle: 0 }, selectedRadio = null, gesture = null, hostSwipe = null;
    let swingRuntime = null, swingFrame = 0, swingLastTime = null, fallRuntime = null, fallFrame = 0;
    let part3Renderer = null, part3Mode = "canvas", part3Attempted = false, lastProjection = [];
    bind();
    const attempt = options.attempt || SimScorm.loadAttempt(ACTIVITY);
    routeStartup(SimActivityFlow.startup(attempt), attempt);

    function bind() {
      dom.technicalRetry.addEventListener("click", () => location.reload());
      document.querySelectorAll("[data-p1-move]").forEach((button) => button.addEventListener("click", () => { supportX = Model.clamp(supportX + Number(button.dataset.p1Move), 0, 1); render(); }));
      dom.testSupport.addEventListener("click", testSupport);
      dom.placeP1.addEventListener("click", () => update(Persistence.markPart1(state, supportX), "已放置重心標註，可微調後確認。"));
      document.querySelectorAll("[data-p1-mark]").forEach((button) => button.addEventListener("click", () => update(Persistence.markPart1(state, Model.clamp((state.part1.markX ?? supportX) + Number(button.dataset.p1Mark), 0, 1)), "已移動重心標註。")));
      dom.confirmP1.addEventListener("click", () => update(Persistence.confirmPart1(state), "第一部分已確認。"));
      dom.hang.addEventListener("click", hangSelected);
      dom.trace.addEventListener("click", (event) => event.detail === 0
        ? update(Persistence.traceVertical(state), "已使用鍵盤等價操作沿鉛垂線畫線，請改用另一個小孔。")
        : announce("指標操作請在平板上親手沿鉛垂線畫線；此按鈕只供鍵盤等價操作。"));
      document.querySelectorAll("[data-rotate]").forEach((button) => button.addEventListener("click", () => { if (state?.phase !== "part2" || state.part2.activeHoleKey || swingRuntime) return; platePose.angle += Number(button.dataset.rotate) * Math.PI / 180; render(); }));
      dom.placeP2.addEventListener("click", placeNeutralMark);
      document.querySelectorAll("[data-p2-mark]").forEach((button) => button.addEventListener("click", () => { if (!state?.part2.mark) return; const [dx, dy] = button.dataset.p2Mark.split(",").map(Number), size = problem.part2.size; update(Persistence.markPart2(state, { x: state.part2.mark.x + dx * .01 * size, y: state.part2.mark.y + dy * .01 * size }), "已微調平板重心標註。" ); }));
      dom.confirmP2.addEventListener("click", () => update(Persistence.confirmPart2(state), "第二部分已確認。"));
      document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { const [yaw, pitch] = button.dataset.view.split(",").map(Number); update(Persistence.setView(state, { yaw10: state.part3.view.yaw10 + yaw, pitch10: state.part3.view.pitch10 + pitch }), "已記錄新的觀察方向。" ); }));
      dom.confirmCandidate.addEventListener("click", () => update(Persistence.selectPart3(state, selectedRadio), "候選點已選定；確認後才完成第三部分。"));
      dom.confirmP3.addEventListener("click", () => update(Persistence.confirmPart3(state), "三部分證據已完成。"));
      document.querySelectorAll("[data-redo]").forEach((button) => button.addEventListener("click", () => { if (confirm(`重做第 ${button.dataset.redo} 部分會清除該部分答案及證據，是否繼續？`)) update(Persistence.redo(state, Number(button.dataset.redo)), "已清除所選部分，其他部分保持不變。" ); }));
      dom.submit.addEventListener("click", submit);
      dom.retry.addEventListener("click", retryPending);
      dom.stage.addEventListener("pointerdown", (event) => { if (event.pointerType === "touch" && UiPolicy.pointerOwner(event.target) === "host") hostSwipe = { id: event.pointerId, y: event.clientY }; });
      dom.stage.addEventListener("pointermove", (event) => { if (!hostSwipe || event.pointerId !== hostSwipe.id) return; const delta = hostSwipe.y - event.clientY; hostSwipe.y = event.clientY; try { if (parent !== window) parent.scrollBy(0, delta); } catch {} });
      for (const type of ["pointerup", "pointercancel"]) dom.stage.addEventListener(type, (event) => { if (hostSwipe?.id === event.pointerId) hostSwipe = null; });
      addEventListener("blur", rollbackInteraction); document.addEventListener("visibilitychange", () => { if (document.hidden) rollbackInteraction(); });
    }
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
        else { fallRuntime = null; fallFrame = 0; update(next, outcome === "balanced" ? "物體保持水平，達到中性平衡；請直接在掃把上放置標記。" : outcome === "left-fall" ? "物體向左傾倒；請重新移動承托再放手。" : "物體向右傾倒；請重新移動承托再放手。"); }
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
    function submit() { if (locked || state.phase !== "check") return; latestReview = Persistence.makeReview(state); latestResult = Scoring.score(latestReview); if (!latestReview) return; locked = true; presentation = "submitting"; clearGesture(); renderReview(null, false, "正在提交，請勿離開。"); const snapshot = SimScorm.makeSnapshot(ACTIVITY, "review", latestReview, latestResult); const handle = (outcome) => routeSubmission(outcome); SimScorm.submitWithCallbacks(latestResult, snapshot, { onSuccess: handle, onFailure: handle }); }
    function routeSubmission(outcome) { const view = UiPolicy.submissionView(outcome); locked = view.locked; SimActivityFlow.submission(outcome, {
      success: () => renderReview(latestResult, true, "已提交並鎖定"),
      committed: () => { presentation = "committed"; renderReview(latestResult, true, "結果已寫入 Moodle；完成連線仍需重試"); dom.retry.classList.remove("is-hidden"); },
      frozen: () => { presentation = "pending"; renderReview(null, false, "提交仍待確認；答案已凍結，只可重試同一份資料。"); dom.retry.classList.remove("is-hidden"); },
      retry: () => outcome.retryable ? (locked = false, state.phase = "check", state.variant = "complete", render(), announce("提交未建立 final state；可保留答案再試。")) : technicalLock("提交前檢查失敗；系統不能承諾可安全重試。")
    }); }
    function retryPending() { if (presentation === "committed") { if (SimScorm.finish()) renderReview(latestResult, true, "已提交並完成連線"); return; } const outcome = SimScorm.retryPending(); routeSubmission({ ...outcome, activityState: outcome.ok ? "success" : outcome.committed ? "committed" : outcome.frozen ? "frozen" : "retry" }); }
    function hideAll() { [dom.technical, dom.p1, dom.p2, dom.p3, dom.check, dom.review].forEach((section) => section.classList.add("is-hidden")); }
    function render() {
      if (!state || locked) return; hideAll(); const isPart3=state.phase==="part3";dom.svg.style.display=isPart3?"none":"block";dom.canvas.style.display=isPart3&&part3Mode==="three"?"block":"none";dom.fallbackCanvas.style.display=isPart3&&part3Mode!=="three"?"block":"none";dom.rendererBadge.classList.toggle("is-hidden",!isPart3); dom.direct.replaceChildren(); dom.preview.classList.add("is-hidden");
      const order = { part1: 1, part2: 2, part3: 3, check: 4 }; dom.progress.value = order[state.phase] || 4; dom.badge.textContent = state.phase === "check" ? "提交前檢查" : `第 ${order[state.phase]}/3 部分${state.returnToCheck ? "（重做）" : ""}`;
      if (state.phase === "part1") { dom.p1.classList.remove("is-hidden"); renderPart1(); }
      if (state.phase === "part2") { dom.p2.classList.remove("is-hidden"); renderPart2(); }
      if (state.phase === "part3") { dom.p3.classList.remove("is-hidden"); renderPart3(); }
      if (state.phase === "check") { dom.check.classList.remove("is-hidden"); renderCheck(); }
    }
    function svgEl(name, attrs = {}) { const element = document.createElementNS(NS, name); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value); return element; }
    function renderPart1(visualsOnly = false) {
      const x = 80 + supportX * 540, mark = state.part1.markX, last = state.part1.supportEpisodes.at(-1), angle = fallRuntime?.angle || 0;
      const defs=svgEl("defs"), wood=svgEl("linearGradient",{id:"handleWood",x1:"0",x2:"1"});wood.append(svgEl("stop",{offset:"0","stop-color":"#8a5633"}),svgEl("stop",{offset:".22","stop-color":"#d59c5a"}),svgEl("stop",{offset:".52","stop-color":"#a8683b"}),svgEl("stop",{offset:".78","stop-color":"#e0ae69"}),svgEl("stop",{offset:"1","stop-color":"#754326"}));defs.append(wood);
      dom.svg.replaceChildren(defs,svgEl("rect", { x:0,y:0,width:700,height:460,fill:"transparent",class:"blank-stage" }),svgEl("path",{d:"M0 332 H700 V460 H0Z",fill:"#6f6555",opacity:".42"}),svgEl("path",{d:"M0 345 Q180 323 350 345 T700 345",fill:"none",stroke:"#e3d5b8","stroke-width":3,opacity:".55"}),svgEl("text",{x:28,y:405,fill:"#f5ead4",opacity:".78","font-size":13,"letter-spacing":3}));dom.svg.lastChild.textContent="TORQUE BENCH · 01";
      const apparatus=svgEl("g",{transform:`rotate(${angle} ${x} 245)`});
      apparatus.append(svgEl("ellipse",{cx:350,cy:313,rx:278,ry:15,fill:"#192735",opacity:".18"}),svgEl("rect",{x:108,y:221,width:470,height:34,rx:15,fill:"url(#handleWood)",stroke:"#4e321f","stroke-width":4}),svgEl("rect",{x:554,y:215,width:34,height:46,rx:7,fill:"#aeb8bc",stroke:"#526069","stroke-width":4}),svgEl("path",{d:"M586 211 L636 194 Q665 238 635 283 L586 263Z",fill:"#35586a",stroke:"#183747","stroke-width":5}),svgEl("path",{d:"M602 207 Q618 235 604 270 M617 202 Q636 235 620 276 M632 199 Q652 236 635 279",fill:"none",stroke:"#d6c39a","stroke-width":7,"stroke-linecap":"round"}),svgEl("rect",{x:83,y:224,width:35,height:28,rx:9,fill:"#b97943",stroke:"#56351f","stroke-width":4}),svgEl("circle",{cx:99,cy:238,r:5,fill:"#e9c686"}));
      if(mark!==null)apparatus.append(svgEl("circle",{cx:80+mark*540,cy:238,r:17,class:"student-mark"}),svgEl("path",{d:`M${80+mark*540-8} 238h16M${80+mark*540} 230v16`,stroke:"#a83f31","stroke-width":4}));dom.svg.append(apparatus);
      dom.svg.append(svgEl("path",{d:`M${x-20} 350 L${x-10} 278 Q${x} 252 ${x+10} 278 L${x+20} 350Z`,fill:"#849198",stroke:"#33434d","stroke-width":5}),svgEl("ellipse",{cx:x,cy:277,rx:15,ry:8,fill:"#dfe6e7",stroke:"#34454f","stroke-width":4}),svgEl("rect",{x:x-37,y:350,width:74,height:14,rx:5,fill:"#3b4850"}));
      if (visualsOnly) return;
      const support = directButton(x / 7, 60, "金屬承托；左右方向鍵移動，Enter 放手測試", "support"); support.classList.add("support-target"); support.textContent="◆";support.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { supportX = Model.clamp(supportX + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? .05 : .01), 0, 1); event.preventDefault(); render(); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); testSupport(); } }); support.addEventListener("pointerdown", (event) => beginDrag(event, support, "support", (point) => { supportX = Model.clamp((point.x - 80) / 540, 0, 1); support.style.left = `${(80 + supportX * 540) / 7}%`; renderPart1(true); }, testSupport));
      if (state.part1.supportEpisodes.some((item)=>item.outcome==="balanced")) { const markValue=mark??supportX,target=directButton((80+markValue*540)/7,52,"重心標註；拖動或用左右方向鍵調整", "mark1", "+"); target.classList.add("mark-target");target.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)&&mark===null){event.preventDefault();update(Persistence.markPart1(state,markValue),"已放置重心標註。");}else if(["ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();update(Persistence.markPart1(state,Model.clamp(markValue+(event.key==="ArrowLeft"?-1:1)*(event.shiftKey?.05:.01),0,1)),"已移動重心標註。");}});target.addEventListener("pointerdown",(event)=>beginDrag(event,target,"mark1",(point)=>{const next=Persistence.markPart1(state,Model.clamp((point.x-80)/540,0,1));if(next){state=next;target.style.left=`${(80+state.part1.markX*540)/7}%`;renderPart1(true);}},()=>{checkpoint();render();announce("標記位置已記錄。");})); }
      dom.p1Status.textContent = last ? last.outcome === "balanced" ? "物體保持水平：這是中性平衡。" : last.outcome === "left-fall" ? "上次向左傾倒。" : "上次向右傾倒。" : "尚未完成承托放手測試。";
      dom.p1MarkTools.classList.toggle("is-hidden", !state.part1.supportEpisodes.some((item) => item.outcome === "balanced")); dom.confirmP1.disabled = mark === null;
    }
    function localToSvg(point) { const c = Math.cos(platePose.angle), s = Math.sin(platePose.angle), scale = 245; return { x: platePose.x + (point.x * c - point.y * s) * scale, y: platePose.y + (point.x * s + point.y * c) * scale }; }
    function svgToLocal(point) { const dx = (point.x - platePose.x) / 245, dy = (point.y - platePose.y) / 245, c = Math.cos(platePose.angle), s = Math.sin(platePose.angle); return { x: dx * c + dy * s, y: -dx * s + dy * c }; }
    function platePath() { return problem.part2.polygon.map((point, i) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${i ? "L" : "M"}${p.x},${p.y}`; }).join(" ") + " Z"; }
    function syncPart2Targets() {
      const plate = dom.direct.querySelector('[data-direct-target="plate"]'); if (plate) { plate.style.left = `${platePose.x / 7}%`; plate.style.top = `${platePose.y / 4.6}%`; }
      for (const target of dom.direct.querySelectorAll("[data-hole-key]")) { const hole = problem.part2.holes.find((item) => item.key === target.dataset.holeKey), point = hole && localToSvg(hole); if (point) { target.style.left = `${point.x / 7}%`; target.style.top = `${point.y / 4.6}%`; } }
      const handle = dom.direct.querySelector('[data-direct-target="rotate"]'); if (handle) { const point = localToSvg({ x: .64, y: -.56 }); handle.style.left = `${point.x / 7}%`; handle.style.top = `${point.y / 4.6}%`; }
      const mark = dom.direct.querySelector('[data-direct-target="mark2"]'); if (mark && state.part2.mark) { const point = localToSvg(state.part2.mark); mark.style.left = `${point.x / 7}%`; mark.style.top = `${point.y / 4.6}%`; }
      const draw = dom.direct.querySelector('[data-direct-target="draw"]'); if (draw) draw.style.clipPath = `polygon(${problem.part2.polygon.map((point) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${p.x / 7}% ${p.y / 4.6}%`; }).join(",")})`;
    }
    function renderPart2(visualsOnly = false) {
      const defs=svgEl("defs"),wood=svgEl("linearGradient",{id:"wood",x1:"0",y1:"0",x2:"1",y2:"1"});wood.append(svgEl("stop",{offset:"0","stop-color":"#e7bd77"}),svgEl("stop",{offset:".45","stop-color":"#c98745"}),svgEl("stop",{offset:".72","stop-color":"#e5b66f"}),svgEl("stop",{offset:"1","stop-color":"#a86539"}));defs.append(wood);
      dom.svg.replaceChildren(defs,svgEl("rect", { x:0,y:0,width:700,height:460,fill:"#dce7e8",class:"blank-stage" }),svgEl("path",{d:"M0 0H700V92H0Z",fill:"#cbd8d9"}),svgEl("path",{d:"M20 92H680",stroke:"#8fa2a4","stroke-width":3}),svgEl("rect",{x:315,y:0,width:70,height:38,rx:4,fill:"#6f7d82",stroke:"#34444b","stroke-width":4}),svgEl("path",{d:"M350 32v22q0 15 15 15",fill:"none",stroke:"#2d383d","stroke-width":7,"stroke-linecap":"round"}),svgEl("circle",{cx:350,cy:42,r:11,fill:"#dce3e4",stroke:"#29383e","stroke-width":5}),svgEl("path",{d:platePath(),class:"plate"}),svgEl("path",{d:platePath(),class:"plate-edge"}));
      for(let i=0;i<7;i+=1){const a=localToSvg({x:-.5+i*.16,y:-.35}),b=localToSvg({x:-.38+i*.13,y:.38});dom.svg.append(svgEl("path",{d:`M${a.x} ${a.y} Q${(a.x+b.x)/2+18} ${(a.y+b.y)/2} ${b.x} ${b.y}`,fill:"none",stroke:"#80532f","stroke-width":2,opacity:".3"}));}
      for (const line of state.part2.lines) { const a = localToSvg({ x: line.a[0], y: line.a[1] }), b = localToSvg({ x: line.b[0], y: line.b[1] }); dom.svg.append(svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "student-line" })); }
      if (state.part2.mark) { const p = localToSvg(state.part2.mark); dom.svg.append(svgEl("circle", { cx: p.x, cy: p.y, r: 14, class: "student-mark" })); }
      if(state.part2.activeHoleKey){dom.svg.append(svgEl("line",{x1:350,y1:52,x2:350,y2:420,class:"plumb"}),svgEl("path",{d:"M350 418l-12 24h24Z",fill:"#374b57",stroke:"#1f3039","stroke-width":3}));}
      for (const hole of problem.part2.holes) { const p = localToSvg(hole); dom.svg.append(svgEl("circle", { cx:p.x,cy:p.y,r:12,class:"hole-ring" }),svgEl("circle",{cx:p.x,cy:p.y,r:5,fill:"#17272d"})); }
      if (visualsOnly) return;
      const plateTarget = directButton(platePose.x / 7, platePose.y / 4.6, "平板平移區；方向鍵平移", "plate"); plateTarget.style.width = "35%"; plateTarget.style.height = "35%"; plateTarget.style.background = "transparent"; plateTarget.style.borderRadius = "1rem"; plateTarget.addEventListener("keydown", (event) => { if (event.key.startsWith("Arrow") && !state.part2.activeHoleKey && !swingRuntime) { const step = event.shiftKey ? 18 : 6; platePose.x += event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0; platePose.y += event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0; event.preventDefault(); render(); } }); plateTarget.addEventListener("pointerdown", (event) => { if (!state.part2.activeHoleKey && !swingRuntime) beginDrag(event, plateTarget, "plate", (point, previous) => { platePose.x += point.x - previous.x; platePose.y += point.y - previous.y; renderPart2(true); syncPart2Targets(); updatePreview(); }, () => render()); });
      for (const hole of problem.part2.holes) { const p = localToSvg(hole), target = directButton(p.x / 7, p.y / 4.6, `小孔 ${hole.key.slice(1)}；拖到牆釘或按 Enter 掛上`, `hole-${hole.key}`, hole.key.slice(1)); target.dataset.holeKey = hole.key; target.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)){event.preventDefault();selectedHole=hole.key;hangSelected();}}); target.addEventListener("click", () => { if (swingRuntime) return; selectedHole = hole.key; announce(`已選擇小孔 ${hole.key.slice(1)}。`); }); target.addEventListener("pointerdown", (event) => { if (swingRuntime) return; selectedHole = hole.key; beginDrag(event, target, `hole-${hole.key}`, (point, previous) => { platePose.x += point.x - previous.x; platePose.y += point.y - previous.y; renderPart2(true); syncPart2Targets(); updatePreview(); }, () => { const moved = localToSvg(hole), snapped = Math.hypot(moved.x - 350, moved.y - 42) <= 42; if (snapped) { platePose.x += 350 - moved.x; platePose.y += 42 - moved.y; } render(); if (snapped) hangSelected(); else announce("小孔未在牆釘的對準範圍內，未形成懸掛證據。" ); }); }); }
      const handlePoint = localToSvg({ x: .64, y: -.56 }), handle = directButton(handlePoint.x / 7, handlePoint.y / 4.6, "平板旋轉手柄；拖動或用左右方向鍵旋轉", "rotate"); handle.textContent = "↻"; handle.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key) && !state.part2.activeHoleKey && !swingRuntime) { platePose.angle += (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 15 : 5) * Math.PI / 180; event.preventDefault(); render(); } }); handle.addEventListener("pointerdown", (event) => { if (state.part2.activeHoleKey || swingRuntime) return; const start = clientPoint(event), base = platePose.angle, pointerAngle = Math.atan2(start.y - platePose.y, start.x - platePose.x); beginDrag(event, handle, "rotate", (point) => { platePose.angle = base + Math.atan2(point.y - platePose.y, point.x - platePose.x) - pointerAngle; renderPart2(true); syncPart2Targets(); updatePreview(); }, () => render()); });
      if (state.part2.activeHoleKey) { const draw = document.createElement("div"), polygon = problem.part2.polygon.map((point) => { const p = localToSvg({ x: point[0], y: point[1] }); return `${p.x / 7}% ${p.y / 4.6}%`; }).join(","); draw.className = "draw-target"; draw.dataset.directTarget = "draw"; draw.style.clipPath = `polygon(${polygon})`; draw.setAttribute("role", "button"); draw.setAttribute("tabindex", "0"); draw.setAttribute("aria-label", "只在平板內沿鉛垂方向畫線；按 Enter 使用鍵盤等價操作"); dom.direct.append(draw);draw.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)){event.preventDefault();const next=Persistence.traceVertical(state);if(next)resetPlateAfterLine(next);}}); let startLocal = null; draw.addEventListener("pointerdown", (event) => { const start = clientPoint(event); startLocal = svgToLocal(start); beginDrag(event, draw, "draw", () => {}, (end) => { const line = { holeKey: state.part2.activeHoleKey, a: [startLocal.x, startLocal.y], b: [svgToLocal(end || start).x, svgToLocal(end || start).y] }, next = Persistence.recordLine(state, line); if (next) resetPlateAfterLine(next); else { render(); announce("這條線未穿過懸掛孔、未沿鉛垂方向，或在板內太短；請重畫。" ); } }); }); }
      const ev = Scoring.evidence(state, problem);
      if (ev.lines.length >= 2 && ev.nonDegenerate) { const evidenceCentre=Model.leastSquares(state.part2.lines)||{x:0,y:0},markValue=state.part2.mark||evidenceCentre,point=localToSvg(markValue),markTarget=directButton(point.x/7,point.y/4.6,"平板重心標註；拖動或方向鍵調整","mark2","＋");markTarget.classList.add("mark-target");markTarget.addEventListener("keydown",(event)=>{if(["Enter"," "].includes(event.key)&&!state.part2.mark){event.preventDefault();update(Persistence.markPart2(state,markValue),"已放置平板重心標註。");return;}if(!event.key.startsWith("Arrow"))return;event.preventDefault();const step=(event.shiftKey?.05:.01)*problem.part2.size,next={x:markValue.x+(event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0),y:markValue.y+(event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0)};update(Persistence.markPart2(state,next),"已移動平板標註。");});markTarget.addEventListener("pointerdown",(event)=>beginDrag(event,markTarget,"mark2",(position)=>{const next=Persistence.markPart2(state,svgToLocal(position));if(next){state=next;markTarget.style.left=`${position.x/7}%`;markTarget.style.top=`${position.y/4.6}%`;renderPart2(true);}},()=>{checkpoint();render();announce("平板標記位置已記錄。");})); }
      dom.holeButtons.replaceChildren(...problem.part2.holes.map((hole) => { const button = document.createElement("button"); button.textContent = `小孔 ${hole.key.slice(1)}`; button.disabled = state.part2.lines.some((line) => line.holeKey === hole.key); button.setAttribute("aria-pressed", String(selectedHole === hole.key)); button.addEventListener("click", () => { selectedHole = hole.key; render(); }); return button; }));
      syncPart2Targets(); dom.hang.disabled = !selectedHole || Boolean(state.part2.activeHoleKey) || Boolean(swingRuntime) || state.part2.lines.some((line) => line.holeKey === selectedHole); dom.trace.disabled = !state.part2.activeHoleKey || Boolean(swingRuntime);
      dom.p2MarkTools.classList.toggle("is-hidden", !(ev.lines.length >= 2 && ev.nonDegenerate)); dom.confirmP2.disabled = !state.part2.mark;
      dom.p2Status.textContent = swingRuntime ? `${selectedHole} 已掛好，平板正在阻尼擺動。` : state.part2.activeHoleKey ? `${state.part2.activeHoleKey} 已停止，可親手畫鉛垂線。` : `已取得 ${state.part2.lines.length} 個不同小孔的有效鉛垂線。`;
    }
    function renderSolid(canvas, compact = false) {
      const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h); const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#eef3f2");bg.addColorStop(.72,"#c9d7d8");bg.addColorStop(1,"#829296");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle="#718589";ctx.globalAlpha=.32;for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(w/2,i*h/16+h*.55);ctx.lineTo((i-4)*w/4+w/2,h);ctx.stroke();}ctx.globalAlpha=1; const scale = compact ? w * .28 : Math.min(w, h) * .29, cx = w / 2, cy = h / 2;
      ctx.strokeStyle = "#173f59"; ctx.fillStyle = "rgba(72,137,166,.38)"; ctx.lineWidth = compact ? 3 : 5;
      if (problem.part3.type === "sphere") {const glow=ctx.createRadialGradient(cx-scale*.35,cy-scale*.4,scale*.08,cx,cy,scale);glow.addColorStop(0,"rgba(255,255,255,.9)");glow.addColorStop(.35,"rgba(102,174,199,.55)");glow.addColorStop(1,"rgba(29,83,109,.38)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,scale,0,Math.PI*2);ctx.fill();ctx.stroke();for(const squash of [.28,.62]){ctx.beginPath();ctx.ellipse(cx,cy,scale,scale*squash,state.part3.view.yaw10*Math.PI/1800,0,Math.PI*2);ctx.globalAlpha=.48;ctx.stroke();}ctx.globalAlpha=1;}
      else { const axes = problem.part3.axes, vertices = []; for (const x of [-axes[0], axes[0]]) for (const y of [-axes[1], axes[1]]) for (const z of [-axes[2], axes[2]]) { const p = Model.project([x,y,z], state.part3.view, scale); vertices.push({ x: cx+p.x, y: cy+p.y, z:p.depth }); } const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].map(ids=>({ids,z:ids.reduce((s,i)=>s+vertices[i].z,0)/4})).sort((a,b)=>a.z-b.z);for(const [index,face] of faces.entries()){ctx.beginPath();face.ids.forEach((id,i)=>i?ctx.lineTo(vertices[id].x,vertices[id].y):ctx.moveTo(vertices[id].x,vertices[id].y));ctx.closePath();ctx.fillStyle=`rgba(${55+index*7},${120+index*6},${151+index*5},.24)`;ctx.fill();ctx.stroke();} }
      const projected = problem.part3.candidates.map((item) => ({ item, p: Model.project(item.position, state.part3.view, scale) })).sort((a,b) => a.p.depth-b.p.depth); for (const {item,p} of projected) { ctx.globalAlpha = p.depth < 0 ? .5 : 1; ctx.fillStyle = item.key === state.part3.selectedCandidateKey ? "#be123c" : "#f59e0b"; ctx.beginPath(); ctx.arc(cx+p.x,cy+p.y,compact?9:13,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="#111827";ctx.stroke();ctx.fillStyle="#111827";ctx.font=`bold ${compact?14:18}px system-ui`;ctx.fillText(item.key,cx+p.x+15,cy+p.y-10); } ctx.globalAlpha=1;
      canvas.dataset.renderer="canvas-fallback";canvas.dataset.frame=String((Number(canvas.dataset.frame)||0)+1);return projected.map(({item,p}) => ({ key:item.key, x:cx+p.x, y:cy+p.y, depth:p.depth }));
    }
    function ensurePart3Renderer(){if(part3Renderer||part3Attempted)return;part3Attempted=true;part3Mode="loading";dom.rendererBadge.textContent="載入空間視圖…";import("./part3-renderer.js").then(()=>{if(globalThis.__CENTRE_MASS_FORCE_FALLBACK||new URLSearchParams(location.search).get("renderer")==="canvas")throw new Error("requested fallback");part3Renderer=globalThis.CentreMassPart3Renderer.create(dom.canvas,problem.part3,(event)=>{part3Mode=event==="restored"?"three":"fallback";if(state?.phase==="part3"&&!gesture)render();});part3Mode="three";if(state?.phase==="part3"&&!gesture)render();}).catch(()=>{part3Mode="fallback";part3Renderer=null;if(state?.phase==="part3"&&!gesture)render();});}
    function renderPart3() {
      dom.svg.replaceChildren();ensurePart3Renderer();dom.canvas.style.display=part3Mode==="three"?"block":"none";dom.fallbackCanvas.style.display=part3Mode==="three"?"none":"block";dom.rendererBadge.textContent=part3Mode==="three"?(part3Renderer?.label||"Three.js 0.185.1"):part3Mode==="loading"?"載入空間視圖…":"Canvas 相容模式";const projected=part3Mode==="three"&&part3Renderer?part3Renderer.render(state.part3.view,state.part3.selectedCandidateKey):renderSolid(dom.fallbackCanvas);lastProjection=projected; dom.direct.replaceChildren(); const orbit = directButton(50,50,"旋轉立體；方向鍵旋轉", "orbit"); orbit.classList.add("orbit-target"); orbit.addEventListener("keydown", (event) => { if (!event.key.startsWith("Arrow")) return; const step = event.shiftKey ? 150 : 50; event.preventDefault(); update(Persistence.setView(state,{yaw10:state.part3.view.yaw10+(event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0),pitch10:state.part3.view.pitch10+(event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0)}),"已記錄新的觀察方向。" ); }); orbit.addEventListener("pointerdown", (event) => beginOrbit(event, orbit));
      for (const item of projected) { const button = directButton(item.x/7,item.y/4.6,`候選點 ${item.key}${item.depth<0?"，在後方":"，在前方"}`,`candidate-${item.key}`,item.key); button.addEventListener("click",()=>{selectedRadio=item.key; render();}); button.addEventListener("pointerdown",(event)=>showTapPreview(event,button,`candidate-${item.key}`)); }
      dom.radios.replaceChildren(dom.radios.querySelector("legend") || Object.assign(document.createElement("legend"),{textContent:"選擇重心候選點"}), ...Generator.LABELS.map((key)=>{const label=document.createElement("label"),input=document.createElement("input");input.type="radio";input.name="candidate";input.value=key;input.checked=selectedRadio===key;input.addEventListener("change",()=>{selectedRadio=key;render();});label.append(input,` ${key} `);return label;}));
      dom.confirmCandidate.disabled = !selectedRadio || state.part3.observations.length < 2; dom.confirmP3.disabled = !state.part3.selectedCandidateKey; dom.solidSummary.textContent = `${problem.part3.type === "sphere" ? "均勻球體" : problem.part3.type === "cube" ? "均勻正方體" : "均勻長方體"}；目前 yaw ${state.part3.view.yaw10/10}°、pitch ${state.part3.view.pitch10/10}°。`;
      dom.p3Status.textContent = `已完成 ${state.part3.observations.length}/2 個有效觀察姿態${state.part3.selectedCandidateKey ? `；已選 ${state.part3.selectedCandidateKey}` : ""}。`;
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
    function clearGesture(){clearSwing();clearFall();hostSwipe=null;if(gesture){gesture.target.classList.remove("active-direct");gesture.target.removeEventListener("pointermove",moveGesture);gesture=null;}dom.preview.replaceChildren();dom.preview.className="preview is-hidden";}
    function rollbackInteraction(){const hadGesture=Boolean(gesture),interrupted=hadGesture||Boolean(fallRuntime)||Boolean(swingRuntime)||Boolean(swingFrame),baseline=gesture?.baselineState||(interrupted&&committedState?Persistence.decode(Persistence.encode(committedState)):null),support=gesture?.baselineSupport,pose=gesture?.baselinePose;clearGesture();if(baseline){state=baseline;problem=Generator.generate(state.seed,state.generatorVersion);supportX=hadGesture?support:(state.part1.supportEpisodes.at(-1)?.x??.5);platePose=hadGesture?pose:(restoredPlatePose(state,problem)||{x:350,y:230,angle:0});render();}}
    function showTapPreview(event,target,kind){if(event.pointerType==="mouse")return;showPreview(event,kind);const clear=()=>{dom.preview.replaceChildren();dom.preview.className="preview is-hidden";};target.addEventListener("pointerup",clear,{once:true});target.addEventListener("pointercancel",clear,{once:true});}
    function previewFocus() { const kind = dom.preview.dataset.kind, last = gesture?.last;
      if (kind === "support") return { x: 90 + supportX * 520, y: 280 };
      if (kind === "mark1") return { x: 90 + (state.part1.markX ?? supportX) * 520, y: 240 };
      if (kind?.startsWith("hole-")) { const hole = problem.part2.holes.find((item) => item.key === kind.slice(5)); return hole ? localToSvg(hole) : last; }
      if (kind === "rotate") return localToSvg({ x: .64, y: -.56 });
      if (kind === "mark2" && state.part2.mark) return localToSvg(state.part2.mark);
      return last || { x: platePose.x, y: platePose.y };
    }
    function renderSvgPreview(focus) { const clone=dom.svg.cloneNode(true);clone.removeAttribute("id");clone.setAttribute("viewBox",`${Model.clamp(focus.x-90,0,520)} ${Model.clamp(focus.y-90,0,280)} 180 180`);clone.querySelectorAll("[id],[tabindex],[role],[aria-label],[data-direct-target]").forEach((node)=>{node.removeAttribute("id");node.removeAttribute("tabindex");node.removeAttribute("role");node.removeAttribute("aria-label");node.removeAttribute("data-direct-target");});dom.preview.replaceChildren(clone); }
    function showPreview(event,kind){const rect=dom.stage.getBoundingClientRect(),corner=UiPolicy.previewCorner({x:event.clientX,y:event.clientY},{left:rect.left,top:rect.top,width:rect.width,height:rect.height});dom.preview.className=`preview ${corner}`;dom.preview.dataset.kind=kind;if(state.phase==="part3"){const canvas=document.createElement("canvas");canvas.width=220;canvas.height=220;dom.preview.replaceChildren(canvas);renderSolid(canvas,true);}else renderSvgPreview(clientPoint(event));}
    function updatePreview(){if(dom.preview.classList.contains("is-hidden"))return;if(state.phase==="part3"){const canvas=dom.preview.querySelector("canvas");if(canvas)renderSolid(canvas,true);}else renderSvgPreview(previewFocus());}
    function beginOrbit(event,target){if(gesture||locked||event.button>0)return;const start=clientPoint(event),base={...state.part3.view};beginDrag(event,target,"orbit",(point)=>{const next=Persistence.setView(state,{yaw10:base.yaw10+Math.round((point.x-start.x)*3),pitch10:base.pitch10+Math.round((point.y-start.y)*3)},false);if(next){state=next;if(part3Mode==="three"&&part3Renderer)part3Renderer.render(state.part3.view,state.part3.selectedCandidateKey);else renderSolid(dom.fallbackCanvas);updatePreview();}},()=>{const next=Persistence.setView(state,state.part3.view,true);if(next){state=next;checkpoint();render();announce("旋轉結束；已檢查是否形成新的觀察證據。");}});}
    return { getState:()=>state, platePose:()=>({ ...platePose }), swing:()=>swingRuntime ? { angle:swingRuntime.angle, target:swingRuntime.target } : null, fall:()=>fallRuntime?{...fallRuntime}:null,renderer:()=>({mode:part3Mode,frame:Number((part3Mode==="three"?dom.canvas:dom.fallbackCanvas).dataset.frame)||0}),contextLoss:(action)=>{const extension=part3Renderer?.context?.getExtension("WEBGL_lose_context");if(!extension)return false;if(action==="lose")extension.loseContext();else if(action==="restore")extension.restoreContext();return true;},
      routeStartup, routeSubmission, render, clearGesture };
  }
  return { ACTIVITY, freshSeed, reviewMetadataValid, reviewMatches, restoredPlatePose, boot };
});
