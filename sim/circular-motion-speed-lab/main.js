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
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let state = null, mode = "technical", result = null, trusted = false, running = false, retryMode = "none";
  let observationTime = 0, observationPaused = false, lastFrame = performance.now(), lastSave = 0, unwrapStarted = null, unwrapReplay = false;
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
    if (mode !== "editable" || item()?.phase !== "captured") return;
    const next = Store.unwrap(state, state.activeCase);
    if (!next || !persist(next)) return;
    unwrapStarted = reducedMotion?.matches ? null : performance.now(); unwrapReplay = false;
    setMessage("兩條弧線按同一比例展平，起點對齊尺上的 0。"); render();
  }
  function reset() {
    if (mode !== "editable" || state.view !== "task") return;
    const old = item();
    const hasWork = old.phase !== "ready" || Scoring.NUMERIC.some(key => old.answers[key] !== "");
    if (hasWork && !window.confirm("重新量度本情境？目前軌跡和四個數值答案會清除；比較及原因答案會保留。")) return;
    const next = Store.remeasure(state, state.activeCase);
    if (!next || !persist(next)) return;
    observationTime = 0; observationPaused = false; running = false; unwrapStarted = null;
    setMessage("已清除本情境量度；可以重新開始。"); render();
  }
  function navigate(kind) {
    if (!state || mode === "technical" || mode === "frozen") return;
    pause(); if (mode === "technical") return;
    if (mode === "editable") {
      const next = Store.decode(state); next.activeCase = kind; next.view = "task";
      if (!persist(next)) return;
    } else { state.activeCase = kind; state.view = "task"; }
    observationTime = 0; observationPaused = false; unwrapStarted = null; render();
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
    const relations = Object.entries(relationText);
    const reasons = key => Store.OPTIONS[kind][key].map(value => [value, reasonText[value]]);
    el.conceptQuestions.innerHTML = question("speedRelation", "線速率大小：vA 與 vB 有甚麼關係？", relations, a.speedRelation) +
      question("speedReason", "為何有這個線速率關係？", reasons("speedReason"), a.speedReason) +
      question("angularRelation", "角速率大小：ωA 與 ωB 有甚麼關係？", relations, a.angularRelation) +
      question("angularReason", "為何有這個角速率關係？", reasons("angularReason"), a.angularReason);
  }
  function summary() {
    const names = { vA: "vA", vB: "vB", omegaA: "ωA", omegaB: "ωB", speedRelation: "線速率關係", angularRelation: "角速率關係", speedReason: "線速率原因", angularReason: "角速率原因" };
    el.checkSummary.innerHTML = Model.CASES.map(kind => {
      const c = state.cases[kind];
      const rows = Object.entries(names).map(([key, label]) => {
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
    const names = { vA: "vA", vB: "vB", omegaA: "ωA", omegaB: "ωB", speedRelation: "線速率關係", angularRelation: "角速率關係", speedReason: "線速率原因", angularReason: "角速率原因" };
    el.resultSummary.innerHTML = `<p><strong>${result.score} / 100 分 · ${Flow.completionLabel(result.passed)}</strong></p>` + Model.CASES.map(kind => {
      const c = state.cases[kind], r = result.cases[kind];
      const formula = r.reading ? `<p>讀數代入：A 線速率 = ${Model.format3(r.reading.sA)} ÷ ${Model.format3(r.reading.dt)} m/s；B 線速率 = ${Model.format3(r.reading.sB)} ÷ ${Model.format3(r.reading.dt)} m/s。A、B 角速率分別以 ${Model.format3(r.reading.angleA)}、${Model.format3(r.reading.angleB)} rad 除以共同時間。</p>` : "<p>本情境沒有可用的完整讀數。</p>";
      return `<div class="summary-case"><h3>${labels[kind]} · ${r.score}/50 分</h3>${formula}` + Object.entries(names).map(([key, label]) => {
        const d = r.detail[key], raw = c.answers[key];
        const actual = raw === null || raw === "" ? "未答" : Scoring.NUMERIC.includes(key) ? safe(raw) : safe(key.endsWith("Relation") ? relationText[raw] : reasonText[raw]);
        const expected = Scoring.NUMERIC.includes(key) ? `${Model.format3(d.expected)} ${key.startsWith("v") ? "m/s" : "rad/s"}` : safe(key.endsWith("Relation") ? relationText[d.expected] : reasonText[d.expected]);
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
    el.caseKicker.textContent = kind === "coaxial" ? "情境 1／2" : "情境 2／2";
    el.caseTitle.textContent = kind === "coaxial" ? "同一圓盤上的兩點" : "皮帶連接大小輪";
    el.caseIntro.textContent = kind === "coaxial" ? "A 在內側，B 在外側；兩點固定在同一個圓盤。" : "A 是小輪，B 是主動大輪；皮帶繃緊而不打滑。";
    el.radiusReadout.textContent = `A 半徑 ${Model.format3(p.rA)} m　·　B 半徑 ${Model.format3(p.rB)} m`;
    el.sceneTitle.textContent = labels[kind];
    el.startButton.hidden = !["ready", "measuring"].includes(c.phase) || running;
    el.startButton.textContent = c.phase === "ready" ? "開始量度" : "繼續量度";
    el.pauseButton.hidden = !(c.phase === "ready" || c.phase === "measuring" && running);
    el.pauseButton.textContent = c.phase === "ready" ? observationPaused ? "繼續示範" : "暫停示範" : "暫停量度";
    el.stopButton.hidden = c.phase !== "measuring";
    el.unwrapButton.hidden = c.phase !== "captured";
    el.replayButton.hidden = c.phase !== "unwrapped";
    el.resetButton.hidden = c.phase === "ready";
    for (const button of el.taskSection.querySelectorAll("button")) button.disabled = mode !== "editable";
    el.readingsCard.hidden = c.phase === "ready";
    el.numericForm.hidden = c.phase !== "unwrapped";
    for (const input of inputs) { input.disabled = mode !== "editable" || c.phase !== "unwrapped"; if (document.activeElement !== input) input.value = c.answers[input.dataset.answer]; }
    renderConcepts();
    el.conceptQuestions.querySelectorAll("input").forEach(input => { input.disabled = mode !== "editable"; });
    el.statusText.textContent = message || ({ ready: "先觀察運動，再自行開始量度。", measuring: running ? "正在記錄兩點的軌跡。" : "量度已暫停；可繼續或停止。", captured: "軌跡已定格。按「展平軌跡」比較路程。", unwrapped: "兩條軌跡以相同尺度展平；請根據顯示讀數計算。" })[c.phase];
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
  function drawScene() {
    if (!state || el.motionStage.hidden) return;
    const kind = state.activeCase, c = item(), p = Model.parameters(kind, c.definition), t = c.measurement.elapsed;
    const timed = c.phase !== "ready", angleA = timed ? Model.angleAt(c.measurement.startAngles[0], p.omegaA, t) : Model.angleAt(0,p.omegaA,observationTime);
    const angleB = timed ? Model.angleAt(c.measurement.startAngles[1],p.omegaB,t) : Model.angleAt(0,p.omegaB,observationTime);
    el.timerReadout.textContent = `Δt ${timed ? Model.format3(t) : "0"} s`;
    if (c.phase === "unwrapped") {
      const r = Model.readings(kind,c.definition,t), maximum = Math.max(r.sA,r.sB);
      const progress = unwrapStarted === null ? 1 : Math.min(1,(performance.now()-unwrapStarted)/1200);
      if (progress >= 1) unwrapStarted = null;
      const sx = 90, unit = 510/maximum, line = (y,length,color,name) => {
        const shown = length*progress, remain=length-shown;
        return `<text x="${sx}" y="${y-22}" font-size="23" font-weight="700" fill="${color}">${name}　${Model.format3(length)} m</text><line x1="${sx}" y1="${y}" x2="${sx+shown*unit}" y2="${y}" stroke="${color}" stroke-width="12" stroke-linecap="round"/><circle cx="${sx+shown*unit}" cy="${y}" r="8" fill="${color}"/><text x="${sx}" y="${y+29}" fill="#536b75" font-size="16">已攤平 ${Model.format3(shown)} m　·　待展開 ${Model.format3(remain)} m</text>`;
      };
      const ticks = Array.from({length:6},(_,i)=>{const x=sx+i*102;return `<line x1="${x}" x2="${x}" y1="302" y2="${i%5===0?322:314}" stroke="#405965" stroke-width="2"/><text x="${x}" y="344" text-anchor="middle" font-size="17" fill="#405965">${Model.format3(maximum*i/5)}</text>`;}).join("");
      el.motionSvg.setAttribute("aria-label",`A 路程 ${Model.format3(r.sA)} 米，B 路程 ${Model.format3(r.sB)} 米；共用同一把直尺`);
      el.motionSvg.innerHTML = `<rect width="700" height="380" fill="#f8fcfc"/><text x="90" y="54" font-size="22" font-weight="700" fill="#214751">圓周軌跡攤平 · 同一比例</text>${line(135,r.sA,"#1179bc","A")}${line(235,r.sB,"#de7529","B")}<line x1="90" y1="302" x2="600" y2="302" stroke="#405965" stroke-width="3"/>${ticks}<text x="630" y="321" fill="#405965" font-size="17">m</text>`;
      el.sceneCaption.textContent = `共用 Δt = ${Model.format3(r.dt)} s；A 轉角 ${Model.format3(r.angleA)} rad，B 轉角 ${Model.format3(r.angleB)} rad。${unwrapReplay && unwrapStarted === null ? "重播完畢。" : ""}`;
      return;
    }
    const scale = kind === "coaxial" ? 120/p.rB : 500/(4*(p.rA+p.rB));
    const cxA = kind === "coaxial" ? 350 : 92+p.rA*scale;
    const cxB = kind === "coaxial" ? 350 : cxA+p.centreDistance*scale;
    const cy = 185, ra = p.rA*scale, rb = p.rB*scale;
    let belt = "";
    if (kind === "belt") {
      const g=Model.beltTangents(ra,rb,cxB-cxA);
      const pos=(base,v)=>`${base+v[0]} ${cy-v[1]}`;
      const topA=[cxA+g.upperA[0],cy-g.upperA[1]],topB=[cxA+g.upperB[0],cy-g.upperB[1]];
      const length=Math.hypot(topB[0]-topA[0],topB[1]-topA[1]);
      const travelled=(p.vB*(timed?t:observationTime)*scale)%length;
      const fraction=travelled/length,mark=[topB[0]+(topA[0]-topB[0])*fraction,topB[1]+(topA[1]-topB[1])*fraction];
      belt=`<path d="M ${pos(cxA,g.upperA)} L ${pos(cxA,g.upperB)} A ${rb} ${rb} 0 1 1 ${pos(cxA,g.lowerB)} L ${pos(cxA,g.lowerA)} A ${ra} ${ra} 0 0 1 ${pos(cxA,g.upperA)}" fill="none" stroke="#82969c" stroke-width="15" opacity=".75"/><circle cx="${mark[0]}" cy="${mark[1]}" r="7" fill="#fff" stroke="#536a71" stroke-width="3"/>`;
    }
    const wheel = (cx,r,color,name,angle) => {
      const mark=point(cx,cy,r,angle);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${kind === "coaxial" ? "#e5f1f5" : "#f3f7f6"}" fill-opacity="${kind === "coaxial" && name === "A" ? ".15" : "1"}" stroke="${kind === "coaxial" && name === "A" ? "#8aa8b2" : "#436b78"}" stroke-width="3"/><line x1="${cx}" y1="${cy}" x2="${mark[0]}" y2="${mark[1]}" stroke="${color}" stroke-width="3"/><circle cx="${mark[0]}" cy="${mark[1]}" r="10" fill="${color}" stroke="white" stroke-width="3"/><text x="${mark[0]+12}" y="${mark[1]-12}" fill="${color}" font-size="23" font-weight="800">${name}</text>`;
    };
    const trace=(cx,r,colour,index,omega)=>{
      if (c.phase === "ready" || t<=0) return "";
      const sweep=omega*t,start=c.measurement.startAngles[index];
      const circles=sweep>=Model.TAU?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colour}" stroke-width="7" opacity=".54"/>`:"";
      const remainder=sweep>=Model.TAU?sweep%Model.TAU:sweep;
      return `<g stroke="${colour}" opacity=".8">${circles}${remainder>0.0001?arc(cx,cy,r,start+sweep-remainder,remainder):""}</g>`;
    };
    el.motionSvg.setAttribute("aria-label",kind === "coaxial" ? "同一圓盤上，藍色 A 在內圈，橙色 B 在外圈" : "不交叉皮帶連接藍色 A 小輪與橙色 B 大輪，兩輪同向轉動");
    el.motionSvg.innerHTML = `<rect width="700" height="380" fill="#f8fcfc"/>${belt}${kind === "coaxial" ? wheel(cxB,rb,"#de7529","B",angleB)+wheel(cxA,ra,"#1179bc","A",angleA) : wheel(cxA,ra,"#1179bc","A",angleA)+wheel(cxB,rb,"#de7529","B",angleB)}${trace(cxA,ra,"#1179bc",0,p.omegaA)}${trace(cxB,rb,"#de7529",1,p.omegaB)}<text x="26" y="34" fill="#1179bc" font-size="21" font-weight="700">A · 小半徑</text><text x="475" y="34" fill="#de7529" font-size="21" font-weight="700">B · 大半徑</text>`;
    const turns=t>0?`A 已走 ${Math.floor(p.omegaA*t/Model.TAU)} 整圈；B 已走 ${Math.floor(p.omegaB*t/Model.TAU)} 整圈。`:"";
    el.sceneCaption.textContent = c.phase === "ready" ? "輪正在示範轉動；按「開始量度」後，兩點會同時留下軌跡。" : `${turns}同色圓弧是量度開始後走過的軌跡；跨圈路程會累計。`;
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
  el.pauseButton.addEventListener("click",()=>{if(item()?.phase==="ready"){observationPaused=!observationPaused;setMessage(observationPaused?"示範已暫停。":"示範已繼續。");}else{pause();setMessage("量度已暫停；閱讀時間不計入 Δt。");}render();});
  el.stopButton.addEventListener("click",stop);
  el.unwrapButton.addEventListener("click",unwrap);
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
  startup();
})();
