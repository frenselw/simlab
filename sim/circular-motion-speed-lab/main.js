(function () {
  "use strict";
  const Model = window.CircularSpeedModel, Scoring = window.CircularSpeedScoring, Store = window.CircularSpeedPersistence;
  const Scorm = window.SimScorm, Flow = window.SimActivityFlow;
  if (!Model || !Scoring || !Store || !Scorm || !Flow) throw new Error("Circular-speed modules were not loaded");
  const ACTIVITY = "circular-motion-speed-lab";
  const el = Object.fromEntries([...document.querySelectorAll("[id]")].map(node => [node.id, node]));
  const tabs = [...document.querySelectorAll("[data-case]")];
  const inputs = [...document.querySelectorAll("[data-answer]")];
  const labels = { coaxial: "同一圓盤", belt: "皮帶傳動" };
  const reasonText = {
    "rigid-angle": "同一剛性圓盤上，各點在相同時間轉過相同角度。",
    "equal-angle-larger-radius": "轉角相同時，半徑較大的 B 點走過較長弧線。",
    "belt-no-slip": "皮帶不伸長且不打滑，兩輪邊緣在相同時間走過相同路程。",
    "equal-arc-smaller-radius": "輪緣路程相同時，半徑較小的 A 輪要轉過較大角度。",
    "larger-always-faster": "半徑較大的一點，在任何傳動方式下都一定比較快。",
    "equal-time-means-equal-speed": "只要量度時間相同，兩點的線速率就必定相同。"
  };
  const relationText = { lt: "A < B", eq: "A = B", gt: "A > B" };
  const mathBody = {
    dt: "<mrow><mi>Δ</mi><mi>t</mi></mrow>",
    rA: '<msub><mi>r</mi><mi mathvariant="normal">A</mi></msub>', rB: '<msub><mi>r</mi><mi mathvariant="normal">B</mi></msub>',
    sA: '<msub><mi>s</mi><mi mathvariant="normal">A</mi></msub>', sB: '<msub><mi>s</mi><mi mathvariant="normal">B</mi></msub>',
    angleA: '<mrow><mi>Δ</mi><msub><mi>θ</mi><mi mathvariant="normal">A</mi></msub></mrow>', angleB: '<mrow><mi>Δ</mi><msub><mi>θ</mi><mi mathvariant="normal">B</mi></msub></mrow>',
    vA: '<msub><mi>v</mi><mi mathvariant="normal">A</mi></msub>', vB: '<msub><mi>v</mi><mi mathvariant="normal">B</mi></msub>',
    omegaA: '<msub><mi>ω</mi><mi mathvariant="normal">A</mi></msub>', omegaB: '<msub><mi>ω</mi><mi mathvariant="normal">B</mi></msub>',
    speedFormula: '<mrow><mi>v</mi><mo>=</mo><mfrac><mi>s</mi><mrow><mi>Δ</mi><mi>t</mi></mrow></mfrac></mrow>',
    angularFormula: '<mrow><mi>ω</mi><mo>=</mo><mfrac><mi>Δ</mi><mi>θ</mi><mrow><mi>Δ</mi><mi>t</mi></mrow></mfrac></mrow>'
  };
  const mathLabel = { dt: "Δt", rA: "rA", rB: "rB", sA: "sA", sB: "sB", angleA: "ΔθA", angleB: "ΔθB", vA: "vA", vB: "vB", omegaA: "ωA", omegaB: "ωB", speedFormula: "v = s / Δt", angularFormula: "ω = Δθ / Δt" };
  const math = key => `<math aria-label="${mathLabel[key]}">${mathBody[key]}</math>`;
  const relationSpoken = { lt: "小於", eq: "等於", gt: "大於" }, relationOperator = { lt: "&lt;", eq: "=", gt: "&gt;" };
  const relationMath = (prefix, value) => `<math aria-label="${prefix === "v" ? "線速率" : "角速率"} A ${relationSpoken[value]} B">${mathBody[`${prefix}A`]}<mo>${relationOperator[value]}</mo>${mathBody[`${prefix}B`]}</math>`;
  const answerLabels = { vA: math("vA"), vB: math("vB"), omegaA: math("omegaA"), omegaB: math("omegaB"), speedRelation: "線速率關係", angularRelation: "角速率關係", speedReason: "線速率原因", angularReason: "角速率原因" };
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const portraitStage = window.matchMedia?.("(max-width: 640px) and (min-height: 381px)");
  const compactStage = window.matchMedia?.("(max-width: 640px) and (max-height: 380px)");
  let state = null, mode = "technical", result = null, trusted = false, running = false, retryMode = "none";
  let observationTime = 0, observationPaused = false, lastFrame = performance.now(), lastSave = 0, unwrapStarted = null, unwrapReplay = false, showOrbit = false;
  let message = "", technical = "";
  const safe = value => { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; };
  function announce(text) { el.liveRegion.textContent = ""; requestAnimationFrame(() => { el.liveRegion.textContent = text; }); }
  function item() { return state?.cases[state.activeCase]; }
  function setMessage(text) { message = text; el.statusText.textContent = text; announce(text); }
  function draftSnapshot(candidate = state) { return Scorm.makeSnapshot(ACTIVITY, "draft", Store.encode(candidate)); }
  function persist(candidate = state) {
    try {
      if (!Scorm.saveDraft(draftSnapshot(candidate))) throw new Error("Draft save rejected");
      state = candidate;
      return true;
    } catch (error) {
      console.warn(error);
      mode = "technical"; technical = "未能安全保存草稿；操作已鎖定。請稍後重新開啟活動。";
      render(); return false;
    }
  }
  function pause(save = true) {
    if (!running) return;
    running = false;
    if (save && mode === "editable") persist();
  }
  function start() {
    if (mode !== "editable" || state.view !== "task") return;
    const current = item(), kind = state.activeCase;
    if (current.phase === "ready") {
      const p = Model.parameters(kind, current.definition);
      const a = Model.angleAt(0, p.omegaA, observationTime);
      const b = kind === "coaxial" ? a : Model.angleAt(0, p.omegaB, observationTime);
      const next = Store.start(state, kind, [a, b]);
      if (!next || !persist(next)) return;
      setMessage("已開始同步量度 A、B；軌跡正持續增加。");
    } else if (current.phase !== "measuring") return;
    running = true; lastFrame = performance.now(); render();
  }
  function stop() {
    if (mode !== "editable" || item()?.phase !== "measuring") return;
    pause(false);
    const next = Store.stop(state, state.activeCase);
    if (!next) { setMessage("時間仍是 0；請繼續量度一小段時間，或直接檢查答案。"); render(); return; }
    if (!persist(next)) return;
    setMessage("已停止。兩點及軌跡同時定格；下一步展平比較路程。"); render();
  }
  function unwrap() {
    if (mode !== "editable" || !["captured", "unwrapped"].includes(item()?.phase)) return;
    if (item().phase === "captured") {
      const next = Store.unwrap(state, state.activeCase);
      if (!next || !persist(next)) return;
    } else if (!showOrbit) return;
    showOrbit = false;
    unwrapStarted = reducedMotion?.matches ? null : performance.now(); unwrapReplay = false;
    setMessage("兩條弧線按同一比例展平，起點對齊尺上的 0。"); render();
  }
  function orbit() {
    if (mode !== "editable" || item()?.phase !== "unwrapped" || showOrbit) return;
    showOrbit = true; unwrapStarted = null;
    setMessage("已返回定格的圓周軌跡；量度和答案保留，可再次展平。"); render();
  }
  function reset() {
    if (mode !== "editable" || state.view !== "task") return;
    const old = item();
    const hasWork = old.phase !== "ready" || Scoring.NUMERIC.some(key => old.answers[key] !== "");
    if (hasWork && !window.confirm("重新量度本情境？目前軌跡和四個數值答案會清除；比較及原因答案會保留。")) return;
    const next = Store.remeasure(state, state.activeCase);
    if (!next || !persist(next)) return;
    observationTime = 0; observationPaused = false; running = false; unwrapStarted = null; showOrbit = false;
    setMessage("已清除本情境量度；可以重新開始。"); render();
  }
  function navigate(kind) {
    if (!state || mode === "technical" || mode === "frozen") return;
    pause(); if (mode === "technical") return;
    if (mode === "editable") {
      const next = Store.decode(state); next.activeCase = kind; next.view = "task";
      if (!persist(next)) return;
    } else { state.activeCase = kind; state.view = "task"; }
    observationTime = 0; observationPaused = false; unwrapStarted = null; showOrbit = false; message = ""; render();
  }
  function check() {
    if (mode !== "editable") return;
    pause(); if (mode === "technical") return;
    const next = Store.decode(state); next.view = "check";
    if (!persist(next)) return;
    render(); el.checkSection.querySelector("h2").focus();
  }
  function back() {
    if (mode !== "editable" || state.view !== "check") return;
    const next = Store.decode(state); next.view = "task";
    if (persist(next)) render();
  }
  function onAnswer(event) {
    if (mode !== "editable" || state.view !== "task" || item()?.phase !== "unwrapped") return;
    const key = event.target.dataset.answer, next = Store.decode(state);
    next.cases[next.activeCase].answers[key] = event.target.value.slice(0, 32);
    persist(next);
  }
  function onChoice(event) {
    if (mode !== "editable" || state.view !== "task" || !event.target.matches("input[type=radio]")) return;
    const next = Store.decode(state);
    next.cases[next.activeCase].answers[event.target.name] = event.target.value;
    persist(next);
  }
  function question(key, title, choices, answer) {
    return `<fieldset><legend>${title}</legend>${choices.map(([value, text]) => `<label class="choice-row"><input data-choice type="radio" name="${key}" value="${value}" ${answer === value ? "checked" : ""}><span>${text}</span></label>`).join("")}</fieldset>`;
  }
  function renderConcepts() {
    if (!item()) return;
    const a = item().answers, kind = state.activeCase;
    const relations = prefix => Object.keys(relationText).map(value => [value, relationMath(prefix, value)]);
    const reasons = key => Store.OPTIONS[kind][key].map(value => [value, reasonText[value]]);
    el.conceptQuestions.innerHTML = question("speedRelation", `線速率大小：${math("vA")} 與 ${math("vB")} 有甚麼關係？`, relations("v"), a.speedRelation) +
      question("speedReason", "為何有這個線速率關係？", reasons("speedReason"), a.speedReason) +
      question("angularRelation", `角速率大小：${math("omegaA")} 與 ${math("omegaB")} 有甚麼關係？`, relations("omega"), a.angularRelation) +
      question("angularReason", "為何有這個角速率關係？", reasons("angularReason"), a.angularReason);
  }
  function summary() {
    el.checkSummary.innerHTML = Model.CASES.map(kind => {
      const c = state.cases[kind];
      const rows = Object.entries(answerLabels).map(([key, label]) => {
        const value = c.answers[key];
        return `<p>${label}：${value === null || value === "" ? "未答" : "已填"}</p>`;
      }).join("");
      return `<div class="summary-case"><h3>${labels[kind]}</h3>${rows}</div>`;
    }).join("");
  }
  function showResult(text) {
    el.resultStatus.textContent = text;
    if (!result || !trusted) {
      el.resultSummary.textContent = "詳細結果未能安全核對；請以 Moodle 顯示的狀態為準。";
      return;
    }
    el.resultSummary.innerHTML = `<p><strong>${result.score} / 100 分 · ${Flow.completionLabel(result.passed)}</strong></p>` + Model.CASES.map(kind => {
      const c = state.cases[kind], r = result.cases[kind];
      const formula = r.reading ? `<p>讀數代入：${math("vA")} = ${Model.format3(r.reading.sA)} m ÷ ${Model.format3(r.reading.dt)} s；${math("vB")} = ${Model.format3(r.reading.sB)} m ÷ ${Model.format3(r.reading.dt)} s。${math("omegaA")}、${math("omegaB")} 分別以 ${Model.format3(r.reading.angleA)} rad、${Model.format3(r.reading.angleB)} rad 除以共同時間。</p>` : "<p>本情境沒有可用的完整讀數。</p>";
      return `<div class="summary-case"><h3>${labels[kind]} · ${r.score}/50 分</h3>${formula}` + Object.entries(answerLabels).map(([key, label]) => {
        const d = r.detail[key], raw = c.answers[key];
        const relationPrefix = key === "speedRelation" ? "v" : "omega";
        const actual = raw === null || raw === "" ? "未答" : Scoring.NUMERIC.includes(key) ? safe(raw) : key.endsWith("Relation") ? relationMath(relationPrefix, raw) : safe(reasonText[raw]);
        const expected = Scoring.NUMERIC.includes(key) ? `${Model.format3(d.expected)} ${key.startsWith("v") ? "m/s" : "rad/s"}` : key.endsWith("Relation") ? relationMath(relationPrefix, d.expected) : safe(reasonText[d.expected]);
        return `<p class="feedback-row ${d.correct ? "is-correct" : "is-wrong"}">${label}：${actual} · ${d.points}/${d.max} 分。${d.correct ? "正確" : `參考：${expected}`}</p>`;
      }).join("") + "</div>";
    }).join("");
  }
  function submit() {
    if (mode !== "editable" || state.view !== "check") return;
    if (!window.confirm("確認提交目前答案？未填項目得 0 分；提交後本次嘗試只可重看。")) return;
    const computed = Scoring.scoreAttempt(state);
    const snapshot = Scorm.makeSnapshot(ACTIVITY, "review", Store.encode(state), computed);
    Scorm.submitWithCallbacks(computed, snapshot, { onSuccess: handleSubmission, onFailure: handleSubmission });
  }
  function handleSubmission(outcome) {
    Flow.submission(outcome, {
      success: () => { mode = "review"; trusted = true; result = Scoring.scoreAttempt(state); retryMode = "none"; showResult("已記錄本次結果。"); },
      committed: () => { mode = "review"; trusted = true; result = Scoring.scoreAttempt(state); retryMode = "finish"; showResult("分數已保存，Moodle 工作階段尚待完成；可重試連線。"); },
      frozen: () => { mode = "frozen"; trusted = false; result = null; retryMode = "pending"; technical = "提交狀態尚未確認；答案已凍結。只能重試同一份提交。"; },
      retry: () => { if (outcome.retryable) { mode = "editable"; state.view = "check"; technical = "提交未完成；可修改答案或重試提交。"; } else { mode = "technical"; technical = "提交前檢查失敗，活動已鎖定。"; } }
    });
    render();
  }
  function retry() {
    if (retryMode === "finish") {
      const ok = Scorm.retryFinish().ok;
      if (ok) retryMode = "none";
      showResult(ok ? "已完成 Moodle 工作階段。" : "分數已保存；Moodle 工作階段仍未完成，請再試。"); render(); return;
    }
    if (retryMode !== "pending") return;
    const raw = Scorm.retryPending();
    if (raw.ok || raw.committed) {
      mode = "review"; retryMode = raw.ok ? "none" : "finish";
      const saved = raw.review?.answer && Store.decode(raw.review.answer);
      if (saved) {
        state = saved;
        const computed = Scoring.scoreAttempt(saved);
        const verified = Flow.reviewResult(computed, raw.review, { score: raw.score, status: raw.status });
        trusted = verified.trusted; result = verified.result;
      } else { trusted = false; result = null; }
      showResult(raw.ok ? "已確認提交。" : "分數已保存；請重試完成連線。");
    } else technical = "提交仍未確認；答案保持凍結，可稍後重試。";
    render();
  }
  function render() {
    const usable = Boolean(state && mode !== "technical" && mode !== "frozen");
    const task = usable && state.view === "task", checkView = usable && mode === "editable" && state.view === "check";
    const review = mode === "review";
    el.taskSection.hidden = !task; el.checkSection.hidden = !checkView; el.resultSection.hidden = !review;
    el.motionStage.hidden = !task;
    el.technicalMessage.hidden = !(mode === "technical" || mode === "frozen" || (mode === "editable" && technical));
    el.technicalMessage.textContent = technical;
    el.checkButton.disabled = !usable || mode !== "editable";
    el.checkButton.setAttribute("aria-current", checkView ? "page" : "false");
    tabs.forEach(tab => { tab.disabled = !usable; tab.setAttribute("aria-current", task && tab.dataset.case === state.activeCase ? "page" : "false"); });
    if (!state) return;
    const c = item(), kind = state.activeCase, p = Model.parameters(kind, c.definition), r = Model.readings(kind, c.definition, c.measurement.elapsed);
    el.radiusReadout.innerHTML = `${math("rA")} = ${Model.format3(p.rA)} m　·　${math("rB")} = ${Model.format3(p.rB)} m`;
    el.sceneTitle.textContent = labels[kind];
    el.startButton.hidden = !["ready", "measuring"].includes(c.phase) || running;
    el.startButton.textContent = c.phase === "ready" ? "開始量度" : "繼續量度";
    el.pauseButton.hidden = !(c.phase === "ready" || c.phase === "measuring" && running);
    el.pauseButton.textContent = c.phase === "ready" ? observationPaused ? "繼續示範" : "暫停示範" : "暫停量度";
    el.stopButton.hidden = c.phase !== "measuring";
    el.unwrapButton.hidden = c.phase !== "captured" && !(c.phase === "unwrapped" && showOrbit);
    el.unwrapButton.textContent = c.phase === "unwrapped" ? "再次展平" : "展平軌跡";
    el.orbitButton.hidden = c.phase !== "unwrapped" || showOrbit;
    el.replayButton.hidden = c.phase !== "unwrapped" || showOrbit;
    el.resetButton.hidden = c.phase === "ready";
    for (const button of el.taskSection.querySelectorAll("button")) button.disabled = mode !== "editable";
    el.readingsCard.hidden = c.phase === "ready";
    el.numericForm.hidden = c.phase !== "unwrapped";
    for (const input of inputs) { input.disabled = mode !== "editable" || c.phase !== "unwrapped"; if (document.activeElement !== input) input.value = c.answers[input.dataset.answer]; }
    renderConcepts();
    el.conceptQuestions.querySelectorAll("input").forEach(input => { input.disabled = mode !== "editable"; });
    el.statusText.textContent = message || ({ ready: "先觀察運動，再自行開始量度。", measuring: running ? "正在記錄兩點的軌跡。" : "量度已暫停；可繼續或停止。", captured: "軌跡已定格。按「展平軌跡」比較路程。", unwrapped: showOrbit ? "已返回圓周軌跡；可再次展平，量度和答案保留。" : "兩條軌跡以相同尺度展平；請根據顯示讀數計算。" })[c.phase];
    const visible = c.phase !== "ready" && c.measurement.elapsed > 0;
    for (const [id, value, unit] of [["readDt",r?.dt,"s"],["readSA",r?.sA,"m"],["readSB",r?.sB,"m"],["readAngleA",r?.angleA,"rad"],["readAngleB",r?.angleB,"rad"]]) el[id].textContent = visible && value !== undefined ? `${Model.format3(value)} ${unit}` : "—";
    if (checkView) summary();
    if (review) showResult(el.resultStatus.textContent || "已記錄本次結果。");
    el.retryButton.hidden = retryMode === "none";
    if (mode === "frozen") { el.retryButton.hidden = false; el.resultSection.hidden = false; el.resultStatus.textContent = technical; el.resultSummary.textContent = ""; }
    drawScene();
  }
  function point(cx, cy, radius, angle) { return [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)]; }
  function arc(cx, cy, radius, start, sweep) {
    const end = point(cx, cy, radius, start + Math.min(sweep, Model.TAU - .0001));
    const first = point(cx, cy, radius, start);
    return `<path d="M ${first[0]} ${first[1]} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 0 ${end[0]} ${end[1]}" fill="none" stroke-width="7" stroke-linecap="round"/>`;
  }
  function angleGuide(cx,cy,wheelRadius,start,sweep,color) {
    if (sweep <= 0.0001) return "";
    const visible=Math.min(sweep,2*Model.TAU), from=start+sweep-visible;
    const inner=30, outer=Math.min(wheelRadius-7,54), steps=Math.ceil(visible/(Math.PI/24));
    const position=i=>point(cx,cy,inner+(outer-inner)*i/(2*Model.TAU),from+i);
    const path=Array.from({length:steps+1},(_,n)=>{const xy=position(visible*n/steps);return `${n?"L":"M"} ${xy[0]} ${xy[1]}`;}).join(" ");
    const first=position(0), last=position(visible), wedgeSweep=Math.min(sweep,Model.TAU-.0001), wedgeEnd=point(cx,cy,inner,start+wedgeSweep);
    const sector=sweep>=Model.TAU ? `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="${color}" fill-opacity=".13" stroke="none"/>` : `<path d="M ${cx} ${cy} L ${first[0]} ${first[1]} A ${inner} ${inner} 0 ${wedgeSweep>Math.PI?1:0} 0 ${wedgeEnd[0]} ${wedgeEnd[1]} Z" fill="${color}" fill-opacity=".16" stroke="none"/>`;
    return `<g class="angle-guide" data-sweep="${sweep}" data-visible-sweep="${visible}" stroke="${color}" fill="none">${sector}<line x1="${cx}" y1="${cy}" x2="${first[0]}" y2="${first[1]}" stroke-dasharray="3 3" stroke-width="2"/><path d="${path}" stroke="white" stroke-width="10" stroke-linejoin="round"/><path class="angle-sweep" d="${path}" stroke-width="5" stroke-linejoin="round"/><line class="angle-end-ray" x1="${cx}" y1="${cy}" x2="${last[0]}" y2="${last[1]}" stroke-width="2"/></g>`;
  }
  function drawScene() {
    if (!state || el.motionStage.hidden) return;
    const kind = state.activeCase, c = item(), p = Model.parameters(kind, c.definition), t = c.measurement.elapsed;
    const timed = c.phase !== "ready", angleA = timed ? Model.angleAt(c.measurement.startAngles[0], p.omegaA, t) : Model.angleAt(0,p.omegaA,observationTime);
    const angleB = timed ? Model.angleAt(c.measurement.startAngles[1],p.omegaB,t) : Model.angleAt(0,p.omegaB,observationTime);
    const portrait = Boolean(portraitStage?.matches), compact = Boolean(compactStage?.matches);
    el.timerReadout.innerHTML = `${math("dt")} = ${timed ? Model.format3(t) : "0"} s`;
    if (c.phase === "unwrapped" && !showOrbit) {
      el.motionSvg.setAttribute("viewBox", portrait || compact ? "70 0 560 380" : "0 0 700 380");
      const r = Model.readings(kind,c.definition,t), maximum = Math.max(r.sA,r.sB);
      const progress = unwrapStarted === null ? 1 : Math.min(1,(performance.now()-unwrapStarted)/1800);
      if (progress >= 1) unwrapStarted = null;
      const sx = 240, unit = 360/maximum, source = (index,color) => {
        const radius = (kind === "coaxial" ? 64 : 50) * (index === 0 ? p.rA/p.rB : 1);
        const cx=150, cy=kind === "coaxial" ? 185 : index === 0 ? 125 : 235;
        const total=(index === 0 ? p.omegaA : p.omegaB)*t, remaining=total*(1-progress);
        const start=c.measurement.startAngles[index]+total*progress, tail=remaining%Model.TAU;
        const mark=point(cx,cy,radius,start);
        const trace=remaining>0.0001 ? `<g class="source-trace" data-total-angle="${total}" data-remaining-angle="${remaining}" stroke="${color}">${remaining>=Model.TAU ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke-width="7" opacity=".55"/>` : ""}${tail>0.0001 ? arc(cx,cy,radius,start+remaining-tail,tail) : ""}<circle cx="${mark[0]}" cy="${mark[1]}" r="5" fill="${color}" stroke="none"/></g>` : "";
        return `<circle class="source-orbit" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="3" opacity=".35"/>${trace}`;
      };
      const line = (y,length,color,name) => {
        const shown=length*progress, remain=length-shown, head=sx+shown*unit;
        return `<text x="${sx}" y="${y-34}" font-size="23" font-weight="700" fill="${color}">${name}　${Model.format3(length)} m</text><text x="${sx}" y="${y-11}" fill="#536b75" font-size="16">已攤平 ${Model.format3(shown)} m　·　圓弧待展開 ${Model.format3(remain)} m</text><line class="unroll-line" x1="${sx}" y1="${y}" x2="${head}" y2="${y}" stroke="${color}" stroke-width="12" stroke-linecap="round"/><circle cx="${head}" cy="${y}" r="6" fill="${color}"/>`;
      };
      const ticks = Array.from({length:6},(_,i)=>{const x=sx+i*72;return `<line x1="${x}" x2="${x}" y1="330" y2="${i%5===0?350:342}" stroke="#405965" stroke-width="2"/><text x="${x}" y="370" text-anchor="middle" font-size="17" fill="#405965">${Model.format3(maximum*i/5)}</text>`;}).join("");
      el.motionSvg.setAttribute("aria-label",`A 路程 ${Model.format3(r.sA)} 米，B 路程 ${Model.format3(r.sB)} 米；共用同一把直尺`);
      el.motionSvg.innerHTML = `<text x="90" y="50" font-size="22" font-weight="700" fill="#214751">圓周軌跡 → 共用直尺（m）</text>${source(0,"#1179bc")}${source(1,"#de7529")}<text x="95" y="310" font-size="17" fill="#536b75">原圓周軌跡</text>${line(130,r.sA,"#1179bc","A")}${line(235,r.sB,"#de7529","B")}<line x1="${sx}" y1="330" x2="600" y2="330" stroke="#405965" stroke-width="3"/>${ticks}`;
      el.sceneCaption.innerHTML = `${unwrapStarted === null ? "兩條路程已展成直線。" : "左邊依實際轉角減少圓弧；右邊按共用比例加長直線。"}共用 ${math("dt")} = ${Model.format3(r.dt)} s；${math("angleA")} = ${Model.format3(r.angleA)} rad，${math("angleB")} = ${Model.format3(r.angleB)} rad。${unwrapReplay && unwrapStarted === null ? "重播完畢。" : ""}`;
      return;
    }
    const viewBox = portrait ? (kind === "coaxial" ? "140 0 420 380" : "0 80 380 560")
      : compact ? (kind === "coaxial" ? "140 0 420 380" : "90 0 540 380") : "0 0 700 380";
    el.motionSvg.setAttribute("viewBox", viewBox);
    const scale = kind === "coaxial" ? 120/p.rB : 115/p.rB;
    const cxA = kind === "coaxial" ? 350 : 350-p.centreDistance*scale/2;
    const cxB = kind === "coaxial" ? 350 : 350+p.centreDistance*scale/2;
    const cy = 185, ra = p.rA*scale, rb = p.rB*scale;
    let belt = "";
    if (kind === "belt") {
      const g=Model.beltTangents(ra,rb,cxB-cxA);
      const pos=(base,v)=>`${base+v[0]} ${cy-v[1]}`;
      const path=`M ${pos(cxA,g.upperA)} L ${pos(cxA,g.upperB)} A ${rb} ${rb} 0 1 1 ${pos(cxA,g.lowerB)} L ${pos(cxA,g.lowerA)} A ${ra} ${ra} 0 0 1 ${pos(cxA,g.upperA)}`;
      const offset=(p.vB*(timed?t:observationTime)*scale)%22;
      belt=`<path d="${path}" fill="none" stroke="#415860" stroke-width="23" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#91a8ac" stroke-width="17" stroke-linejoin="round"/><path class="belt-links" d="${path}" fill="none" stroke="#f2eee0" stroke-width="7" stroke-linecap="round" stroke-dasharray="11 11" stroke-dashoffset="${offset}"/>`;
    }
    const wheel = (cx,r,color,name,angle) => {
      const mark=point(cx,cy,r,angle);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${kind === "coaxial" ? "#e5f1f5" : "#f3f7f6"}" fill-opacity="${kind === "coaxial" && name === "A" ? ".15" : "1"}" stroke="${kind === "coaxial" && name === "A" ? "#8aa8b2" : "#436b78"}" stroke-width="3"/><line x1="${cx}" y1="${cy}" x2="${mark[0]}" y2="${mark[1]}" stroke="${color}" stroke-width="3"/><circle cx="${mark[0]}" cy="${mark[1]}" r="10" fill="${color}" stroke="white" stroke-width="3"/>`;
    };
    const trace=(cx,r,colour,index,omega)=>{
      if (c.phase === "ready" || t<=0) return "";
      const sweep=omega*t,start=c.measurement.startAngles[index];
      const circles=sweep>=Model.TAU?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colour}" stroke-width="7" opacity=".54"/>`:"";
      const remainder=sweep>=Model.TAU?sweep%Model.TAU:sweep;
      return `<g stroke="${colour}" opacity=".8">${circles}${remainder>0.0001?arc(cx,cy,r,start+sweep-remainder,remainder):""}</g>`;
    };
    el.motionSvg.setAttribute("aria-label",kind === "coaxial" ? "同一圓盤上，藍色 A 在內圈，橙色 B 在外圈" : "不交叉皮帶連接藍色 A 小輪與橙色 B 大輪，兩輪同向轉動");
    const guides = !timed ? "" : kind === "coaxial" ? angleGuide(cxA,cy,ra,c.measurement.startAngles[0],p.omegaA*t,"#166f7b") : angleGuide(cxA,cy,ra,c.measurement.startAngles[0],p.omegaA*t,"#1179bc")+angleGuide(cxB,cy,rb,c.measurement.startAngles[1],p.omegaB*t,"#de7529");
    const drawing = `${belt}${kind === "coaxial" ? wheel(cxB,rb,"#de7529","B",angleB)+wheel(cxA,ra,"#1179bc","A",angleA) : wheel(cxA,ra,"#1179bc","A",angleA)+wheel(cxB,rb,"#de7529","B",angleB)}${trace(cxA,ra,"#1179bc",0,p.omegaA)}${trace(cxB,rb,"#de7529",1,p.omegaB)}${guides}`;
    el.motionSvg.innerHTML = portrait && kind === "belt" ? `<g transform="translate(380 0) rotate(90)">${drawing}</g>` : drawing;
    const turns=t>0?`A 已走 ${Math.floor(p.omegaA*t/Model.TAU)} 整圈；B 已走 ${Math.floor(p.omegaB*t/Model.TAU)} 整圈。`:"";
    el.sceneCaption.textContent = c.phase === "ready" ? kind === "coaxial" ? "A、B 固定在同一圓盤；開始量度後，同時留下軌跡。" : "B 主動輪以不打滑皮帶帶動 A；開始量度後，同時留下軌跡。" : c.phase === "unwrapped" ? "已返回定格的圓周軌跡；可再次展平對照直尺。" : `${turns}圓心細弧由量度起點表示累積轉角，每圈向外一層；超過兩圈顯示最近兩圈，總圈數及轉角以讀數為準。`;
    if (timed && t>0 && !running) {
      const displayAngle=(key,omega)=>`${math(key)} = ${Model.format3(omega*t)} rad（${Model.format3(omega*t*180/Math.PI)}°）`;
      el.sceneCaption.innerHTML += ` ${kind === "coaxial" ? `${math("angleA")} = ${math("angleB")} = ${Model.format3(p.omegaA*t)} rad（${Model.format3(p.omegaA*t*180/Math.PI)}°）` : `${displayAngle("angleA",p.omegaA)}；${displayAngle("angleB",p.omegaB)}`}。`;
    }
  }
  function frame(now) {
    const dt=Math.max((now-lastFrame)/1000,0); lastFrame=now;
    if (mode === "editable" && state?.view === "task") {
      const c=item();
      if (c.phase === "ready" && !document.hidden && !observationPaused) {observationTime+=dt;drawScene();}
      else if (c.phase === "measuring" && running && !document.hidden) {
        c.measurement.elapsed=Math.min(Model.MAX_TIME,c.measurement.elapsed+dt);
        if (c.measurement.elapsed >= Model.MAX_TIME) {running=false;persist();setMessage("已達計時上限；可停止或重新量度。");render();}
        else {drawScene(); if (now-lastSave>1000) {lastSave=now;persist();}}
      }
      if (c.phase === "unwrapped" && unwrapStarted!==null) drawScene();
    }
    requestAnimationFrame(frame);
  }
  function startup() {
    const attempt=Scorm.loadAttempt(ACTIVITY), entry=Flow.startup(attempt);
    if (entry === "editable") {
      state=attempt.state === "new" ? Store.initial() : Store.decode(attempt.snapshot?.answer);
      if (!state) {technical="儲存的草稿無法安全還原；活動已鎖定。";mode="technical";}
      else {mode="editable";Scorm.setDraftProvider(draftSnapshot); if (attempt.state === "new") persist();}
    } else if (entry === "review") {
      state=Store.decode(attempt.snapshot?.answer);
      mode="review";
      if (state) {
        const computed=Scoring.scoreAttempt(state);
        const verified=Flow.reviewResult(computed,attempt.snapshot,attempt);
        trusted=verified.trusted;result=verified.result;
      } else {
        technical="已完成嘗試的詳細答案無法還原；只能參考 Moodle 記錄。";
        const recorded=Flow.recordedResult(attempt);
        el.resultStatus.textContent=`Moodle 記錄分數：${recorded.score ?? "未能讀取"}；詳細答案未能安全核對。`;
      }
    } else if (entry === "frozen") {
      const review=JSON.parse(attempt.snapshot.payload.reviewJson);
      state=Store.decode(review.answer);
      const computed=state&&Scoring.scoreAttempt(state);
      if (!state || computed.score!==attempt.snapshot.payload.score || computed.passed!==attempt.snapshot.payload.passed) {
        Scorm.quarantinePending();mode="technical";technical="待確認提交資料未能核對，已鎖定；請聯絡教師。";
      } else {mode="frozen";retryMode="pending";technical="上次提交仍待確認；答案已凍結，可重試同一份提交。";}
    } else {mode="technical";technical="未能讀取本次 Moodle 嘗試資料；活動已鎖定。";}
    render();requestAnimationFrame(frame);
  }
  el.startButton.addEventListener("click",start);
  el.pauseButton.addEventListener("click",()=>{if(item()?.phase==="ready"){observationPaused=!observationPaused;setMessage(observationPaused?"示範已暫停。":"示範已繼續。");}else{pause();setMessage("量度已暫停；暫停期間不計時。");}render();});
  el.stopButton.addEventListener("click",stop);
  el.unwrapButton.addEventListener("click",unwrap);
  el.orbitButton.addEventListener("click",orbit);
  el.replayButton.addEventListener("click",()=>{unwrapStarted=reducedMotion?.matches?null:performance.now();unwrapReplay=true;drawScene();});
  el.resetButton.addEventListener("click",reset);
  el.checkButton.addEventListener("click",check);
  el.backButton.addEventListener("click",back);
  el.submitButton.addEventListener("click",submit);
  el.retryButton.addEventListener("click",retry);
  tabs.forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.case)));
  inputs.forEach(input=>{input.maxLength=32;input.addEventListener("input",onAnswer);});
  el.conceptQuestions.addEventListener("change",onChoice);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();lastFrame=performance.now();});
  portraitStage?.addEventListener("change",drawScene);
  compactStage?.addEventListener("change",drawScene);
  document.querySelectorAll("[data-math]").forEach(node => { node.innerHTML = math(node.dataset.math); });
  startup();
})();
