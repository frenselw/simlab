(() => {
  "use strict";
  const M = window.CircuitModel, R = window.CircuitRegistry, S = window.CircuitSolver, D = window.CircuitDocument, G = window.CircuitRouting, V = window.CircuitRenderer, P = window.CircuitPresets;
  const $ = (id) => document.getElementById(id), surface = $("surface"), svg = $("circuitSvg"), hitLayer = $("hitLayer");
  const history = M.history(P.create("series")), camera = { x: 0, y: 0, scale: 1 }, listeners = new Set(), targets = new Map();
  let analysis = S.solve(history.get()), routes = {}, geometryKey = "", selection = null, pending = null, drag = null, probeMode = false, probeFirst = null, probeResult = null, panMode = false, paused = matchMedia("(prefers-reduced-motion: reduce)").matches, previewDoc = null, lastMessage = "", animationTime = 0, lastTime = 0;
  const current = () => previewDoc || history.get(), world = (x, y) => { const r = surface.getBoundingClientRect(); return { x: camera.x + (x - r.left) / camera.scale, y: camera.y + (y - r.top) / camera.scale }; };
  const screen = (p) => ({ x: (p.x - camera.x) * camera.scale, y: (p.y - camera.y) * camera.scale });
  const snapGrid = (v) => Math.round(v / 20) * 20;
  function notify(text, error = false) { lastMessage = text; $("hint").textContent = text; $("hint").title = text; $("hint").style.color = error ? "#a35d13" : ""; }
  function selectedWire() { return history.get().wires.find((w) => w.id === selection?.id); }
  function selectedComponent() { return history.get().components.find((c) => c.id === selection?.id); }
  function emitChange() {
    for (const listener of listeners) {
      try { listener(M.clone(history.get())); }
      catch (error) { console.error("CircuitWorkbench onChange callback failed", error); }
    }
  }
  function cancel() {
    const old = drag; const hadPreview = !!previewDoc; drag = null; previewDoc = null; pending = null; if (hadPreview) analysis = S.solve(history.get()); $("preview").hidden = true;
    if (old?.kind === "pan") Object.assign(camera, old.base);
    if (old && old.target.hasPointerCapture?.(old.pointerId)) old.target.releasePointerCapture(old.pointerId);
    render();
  }
  function change(fn, inspector = true) {
    const selectionBefore = selection && M.clone(selection);
    try { const previous = history.get(); history.change(fn); analysis = S.solve(history.get()); if (selection && !M.endpoints(history.get()).has(selection.id) && ![...history.get().components, ...history.get().junctions, ...history.get().wires].some((c) => c.id === selection.id)) selection = null; render(inspector); if (history.get() !== previous) emitChange(); return true; }
    catch (error) { selection = selectionBefore; previewDoc = null; analysis = S.solve(history.get()); render(inspector); notify(error.message, true); return false; }
  }
  function fit(overview = false) {
    const d = current(), points = [...d.components.map((c) => ({ x: c.x - 85, y: c.y - 85 })), ...d.components.map((c) => ({ x: c.x + 85, y: c.y + 125 })), ...d.junctions];
    if (!points.length) { camera.x = 0; camera.y = 0; camera.scale = 1; return; }
    const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
    camera.scale = Math.max(overview ? .25 : .65, Math.min(1.2, (surface.clientWidth - 24) / (maxX - minX), (surface.clientHeight - 24) / (maxY - minY)));
    camera.x = (minX + maxX) / 2 - surface.clientWidth / (2 * camera.scale); camera.y = (minY + maxY) / 2 - surface.clientHeight / (2 * camera.scale); if (!overview && (maxY-minY)*camera.scale > surface.clientHeight-24) camera.y = minY-12/camera.scale; if (!overview && (maxX-minX)*camera.scale > surface.clientWidth-24) camera.x = minX-12/camera.scale;
  }
  function focusPoint(p) { camera.scale = Math.max(1, camera.scale); camera.x = p.x - surface.clientWidth / (2 * camera.scale); camera.y = p.y - surface.clientHeight / (2 * camera.scale); render(false); }
  function resolveSnap(p) {
    let found = null, distance = 24 / camera.scale;
    for (const [id, port] of M.endpoints(current())) { if (id === pending?.from) continue; const d = Math.hypot(p.x - port.x, p.y - port.y); if (d < distance) { found = port; distance = d; } }
    return found;
  }
  function wireTo(to, split) {
    if (!pending || pending.from === to) return;
    const from = pending.from, via = pending.via.map((p) => ({ x: p.x, y: p.y }));
    const succeeded = change((d) => { let endpoint = to; if (split) endpoint = M.splitWire(d, split.wire.id, split.point, split.route); M.connect(d, from, endpoint, via); });
    if (!succeeded) return;
    pending = null; notify("接線完成。選取元件可調整參數；點導線可編輯或接出分支。"); render();
  }
  function startWire(from) { pending = { from, via: [], point: M.endpoints(current()).get(from), snap: null }; selection = { kind: "port", id: from }; notify("點另一個端子完成接線；點空白處加轉折，Escape 取消。"); render(); }
  function probePort(id) {
    selection = { kind: "port", id }; const value = analysis.potentials[id];
    if (probeFirst && probeFirst !== id) { probeResult = { from: probeFirst, to: id, voltage: analysis.voltage(probeFirst, id) }; probeFirst = null; notify(probeResult.voltage === null ? "兩點不屬同一個可確定電勢差的電路。" : `兩點電壓：${V.format(probeResult.voltage, "V")}（第一點 − 第二點）`); }
    else { probeFirst = id; probeResult = null; notify(`相對電勢 ${V.format(value, "V")}；再點另一個端子測量兩點電壓。`); }
    render();
  }
  function positionTarget(key, meta, p, width, height, touch = "none") {
    let target = targets.get(key);
    if (!target) { target = document.createElement("button"); target.type = "button"; target.className = "hit " + meta.kind; target.dataset.hit = key; hitLayer.append(target); targets.set(key, target); }
    target.meta = meta; target.setAttribute("aria-label", meta.label); target.style.left = p.x + "px"; target.style.top = p.y + "px"; target.style.width = Math.max(meta.kind === "wire" ? 12 : 44, width) + "px"; target.style.height = Math.max(meta.kind === "wire" ? 12 : 44, height) + "px"; target.style.touchAction = touch;
    target.classList.toggle("snap", pending?.snap?.id === meta.id); return target;
  }
  function renderHits(d) {
    const needed = new Set();
    const put = (key, ...args) => { needed.add(key); return positionTarget(key, ...args); };
    d.components.forEach((c) => {
      const w = ["ammeter", "voltmeter", "wattmeter"].includes(c.type) ? 80 : 70, h = c.type === "wattmeter" ? 78 : 46;
      put("body:" + c.id, { kind: "body", id: c.id, label: c.label + "，拖動本體或用方向鍵移動" }, screen(c), (c.angle % 180 ? h : w) * camera.scale, (c.angle % 180 ? w : h) * camera.scale, M.permission(d, c, "move") ? "none" : "pan-y");
      if (c.type === "rheostat") { const angle = c.angle * Math.PI / 180, x = -30 + c.params.position * 60, y = 38; put("slider:" + c.id, { kind: "slider", id: c.id, label: c.label + "滑塊，拖動調整電阻" }, screen({ x: c.x + x * Math.cos(angle) - y * Math.sin(angle), y: c.y + x * Math.sin(angle) + y * Math.cos(angle) }), 44, 44, M.permission(d, c, "params") ? "none" : "pan-y"); }
      if (camera.scale >= .55) R.ports(c).forEach((p) => put("port:" + p.id, { kind: "port", id: p.id, label: c.label + " " + p.label + "端子，點選接線" }, screen(p), 44, 44));
    });
    d.junctions.forEach((j) => put("junction:" + j.id, { kind: "junction", id: j.id, label: "接點，點選接線或拖動" }, screen(j), 44, 44));
    d.wires.forEach((w) => {
      const points = routes[w.id]; points.slice(1).forEach((p, i) => { const a = points[i], mid = { x: (p.x + a.x) / 2, y: (p.y + a.y) / 2 }; put("wire:" + w.id + ":" + i, { kind: "wire", id: w.id, segment: i, label: "導線 " + w.id + "，選取編輯" }, screen(mid), Math.abs(p.x - a.x) * camera.scale || 14, Math.abs(p.y - a.y) * camera.scale || 14, "pan-y"); });
      if (selection?.id === w.id) w.via.forEach((p, i) => put("bend:" + w.id + ":" + i, { kind: "bend", id: w.id, index: i, label: "導線轉折 " + (i + 1) + "，拖動調整" }, screen(p), 44, 44));
    });
    for (const [key, target] of targets) if (!needed.has(key) && target !== drag?.target) { target.remove(); targets.delete(key); }
  }
  function renderGhost() {
    let out = "";
    if (pending) {
      const from = M.endpoints(current()).get(pending.from), end = pending.snap || pending.point || from;
      if (from) { const points = G.orthogonal([from, ...pending.via, end]); out += `<path d="${G.path(points)}" stroke="#2563eb" stroke-width="${2 / camera.scale}" stroke-dasharray="${6 / camera.scale} ${4 / camera.scale}" fill="none"/><circle cx="${end.x}" cy="${end.y}" r="${10 / camera.scale}" stroke="#2563eb" stroke-width="${2 / camera.scale}" fill="#dbeafe80"/>`; }
    }
    if (probeFirst) { const p = M.endpoints(current()).get(probeFirst); if (p) out += `<circle cx="${p.x}" cy="${p.y}" r="${12 / camera.scale}" fill="none" stroke="#d97706" stroke-width="${2 / camera.scale}"/>`; }
    $("ghostLayer").innerHTML = out;
  }
  function render(inspector = true) {
    const d = current(); svg.setAttribute("viewBox", `${camera.x} ${camera.y} ${surface.clientWidth / camera.scale || 1} ${surface.clientHeight / camera.scale || 1}`);
    surface.style.backgroundSize = `${20 * camera.scale}px ${20 * camera.scale}px`; surface.style.backgroundPosition = `${-camera.x * camera.scale}px ${-camera.y * camera.scale}px`;
    const nextGeometry = JSON.stringify([d.components.map(c=>[c.id,c.type,c.x,c.y,c.angle]),d.junctions,d.wires]); if(nextGeometry!==geometryKey){routes = Object.fromEntries(d.wires.map((w) => [w.id, G.route(d, w)]));geometryKey=nextGeometry;}
    $("scene").innerHTML = V.scene(d, analysis, camera.scale, routes, selection?.id); $("flowLayer").innerHTML = V.flow(d, analysis, routes, animationTime, camera.scale);
    renderHits(d); renderGhost();
    $("emptyHint").hidden = !!d.components.length; $("zoomReadout").textContent = Math.round(camera.scale * 100) + "%";
    $("undo").disabled = !history.canUndo(); $("redo").disabled = !history.canRedo();
    for (const id of ["realView", "schematicView"]) $(id).setAttribute("aria-pressed", String(d.display.view === (id === "realView" ? "real" : "schematic")));
    ["flow", "meters"].forEach((id) => { $(id).value = d.display[id]; }); ["potential", "values", "projection"].forEach((id) => { $(id).checked = d.display[id]; });
    $("pause").checked = paused; $("mode").value = d.policy.mode; $("policyOptions").hidden = d.policy.mode !== "wiring"; ["allowRotate", "allowParams", "allowSwitch"].forEach((id) => { $(id).checked = d.policy[id]; });
    $("potentialLegend").hidden = !d.display.potential; $("pan").setAttribute("aria-pressed", String(panMode)); $("probe").setAttribute("aria-pressed", String(probeMode)); surface.classList.toggle("panning", panMode);
    $("circuitStatus").textContent = analysis.diagnostics.length ? "需檢查電路" : d.policy.mode === "wiring" ? "固定元件 · 接線" : "直流穩態"; $("circuitStatus").classList.toggle("warning", !!analysis.diagnostics.length);
    document.querySelectorAll("[data-add]").forEach((b) => { b.disabled = d.policy.mode !== "free"; });
    if (inspector) renderProperties();
    if (drag?.pointerType === "touch") renderPreview(drag.focus || world(drag.lastX, drag.lastY));
  }
  function renderPreview(p) {
    const host = $("preview"), preview = host.querySelector("svg"); host.hidden = false; if (drag && !drag.previewSide) drag.previewSide = drag.x - surface.getBoundingClientRect().left > surface.clientWidth / 2 ? "left" : "right"; host.style.left = drag?.previewSide === "left" ? "46px" : "auto"; host.style.right = drag?.previewSide === "left" ? "auto" : "46px";
    preview.setAttribute("viewBox", `${p.x - 70} ${p.y - 55} 140 110`); preview.innerHTML = $("scene").innerHTML + $("ghostLayer").innerHTML;
  }
  function button(label, fn, disabled = false, danger = false) { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.action = label; b.disabled = disabled; if (danger) b.className = "danger"; b.onclick = fn; $("objectActions").append(b); return b; }
  function readings(values) { return '<dl class="readings">' + values.map(([name, value, unit]) => `<dt>${V.esc(name)}</dt><dd>${V.esc(V.format(value, unit))}</dd>`).join("") + "</dl>"; }
  function field(label, element) { const l = document.createElement("label"); l.append(document.createTextNode(label), element); $("properties").append(l); }
  function checkbox(label, checked, fn) { const l = document.createElement("label"); l.className = "check"; const i = document.createElement("input"); i.type = "checkbox"; i.checked = checked; i.onchange = () => fn(i.checked); l.append(i, document.createTextNode(label)); $("properties").append(l); }
  function renderProperties() {
    const d = history.get(), c = selectedComponent(), wire = selectedWire(), prop = $("properties"); prop.replaceChildren(); $("objectActions").replaceChildren();
    if (c) {
      $("selectionTitle").textContent = c.label;
      const name = document.createElement("input"); name.type = "text"; name.value = c.label; name.maxLength = 40; name.disabled = !M.permission(d, c, "params"); name.onchange = () => change((doc) => { doc.components.find((x) => x.id === c.id).label = name.value; }); field("名稱", name);
      for (const [key, spec] of Object.entries(R.get(c.type).params)) {
        if (key === "polarity") continue;
        const enabled = M.permission(d, c, key === "closed" ? "switch" : "params");
        if (spec.choices) { const input = document.createElement("select"); spec.choices.forEach((choice) => { const o = document.createElement("option"); o.value = String(choice); o.textContent = key === "model" ? choice === "ideal" ? "恆阻燈（理想化）" : "熱效應燈（變阻）" : choice ? "閉合" : "斷開"; input.append(o); }); input.value = String(c.params[key]); input.disabled = !enabled; input.onchange = () => change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = key === "closed" ? input.value === "true" : input.value; }); field(key === "model" ? "燈泡模型" : "開關狀態", input); }
        else {
          const factor = key === "position" ? 100 : 1;
          const input = document.createElement("input"); input.type = "number"; input.value = c.params[key] * factor; input.min = spec.min * factor; input.max = spec.max * factor; input.step = "any"; input.disabled = !enabled; input.dataset.param = key; input.onchange = () => { const value = input.valueAsNumber / factor; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; field(spec.label + " · " + spec.unit, input);
          if (["voltage", "resistance", "position"].includes(key)) { const range = document.createElement("input"); range.type = "range"; range.min = spec.min * factor; range.max = (key === "position" ? 1 : Math.max(key === "voltage" ? 24 : c.type === "battery" ? 10 : 100, c.params[key])) * factor; range.step = spec.step * factor; range.value = c.params[key] * factor; range.disabled = !enabled; range.setAttribute("aria-label", spec.label + "滑塊"); range.oninput = () => { input.value = range.value; previewDoc = M.clone(history.get()); previewDoc.components.find((x) => x.id === c.id).params[key] = Number(range.value) / factor; analysis = S.solve(previewDoc); render(false); const result = prop.querySelector(".reading-host"); if (result) result.innerHTML = componentReadings(c.id); }; range.onchange = () => { const value = Number(range.value) / factor; previewDoc = null; change((doc) => { doc.components.find((x) => x.id === c.id).params[key] = value; }); }; range.onpointercancel = cancel; prop.append(range); }
        }
      }
      const host = document.createElement("div"); host.className = "reading-host"; host.innerHTML = componentReadings(c.id); prop.append(host);
      if (c.type === "lamp" && c.params.model === "thermal") { const n = document.createElement("p"); n.className = "note"; n.textContent = "穩態教學近似：冷態電阻為額定熱態的 1/10；以額定電壓校準散熱。未模擬預熱或燒毀。"; prop.append(n); }
      if (c.type === "wattmeter") { const n = document.createElement("p"); n.className = "note"; n.textContent = "I+/I− 串聯；V+/V− 跨接負載。讀值 = 電壓線圈電壓 × 電流線圈電流。"; prop.append(n); }
      button("旋轉 90°", () => rotate(c.id), !M.permission(d, c, "rotate"));
      button("刪除元件", () => { cancel(); change((doc) => M.remove(doc, c.id)); }, !M.permission(d, c, "remove"), true);
      button("複製元件", () => change((doc) => { const copy = M.add(doc, c.type, c.x + 140, c.y + 80, c.params); copy.angle = c.angle; copy.label = c.label + " 副本"; selection = { kind: "body", id: copy.id }; }), d.policy.mode !== "free");
      button("定位所選", () => focusPoint(c));
      if (c.type === "battery") button("反接電源極性", () => change((doc) => { doc.components.find((x) => x.id === c.id).params.polarity *= -1; }), !M.permission(d, c, "params"));
      if (d.policy.mode === "free") checkbox("固定此元件", c.locked, (v) => change((doc) => { doc.components.find((x) => x.id === c.id).locked = v; }));
      else checkbox("此元件可調參數", c.editable, (v) => change((doc) => { doc.components.find((x) => x.id === c.id).editable = v; }));
    } else if (wire) {
      $("selectionTitle").textContent = "導線 " + wire.id;
      prop.innerHTML = `<p class="note">${V.esc(portName(wire.from))} → ${V.esc(portName(wire.to))}</p>` + readings([["由起點流向終點", analysis.wires[wire.id]?.current, "A"], ["相對電勢", analysis.wires[wire.id]?.potential, "V"]]);
      if (analysis.wires[wire.id]?.cyclic) prop.insertAdjacentHTML("beforeend", '<p class="note">理想導線環路中，此段電流不能唯一確定。</p>');
      button("在這裏分支", () => { const path = routes[wire.id], point = selection.point || G.nearest(path, path[Math.floor(path.length / 2)]); let endpoint; change((doc) => { endpoint = M.splitWire(doc, wire.id, point, path); }); if (endpoint) startWire(endpoint); });
      button("刪除導線", () => { cancel(); change((doc) => M.remove(doc, wire.id)); }, false, true);
      button("編輯轉折", () => change((doc) => { doc.wires.find((w) => w.id === wire.id).via = routes[wire.id].slice(1, -1).map((p) => ({ x: p.x, y: p.y })); }));
      button("自動布線", () => change((doc) => { doc.wires.find((w) => w.id === wire.id).via = []; }));
      if (selection.kind === "bend") button("移除此轉折", () => change((doc) => { doc.wires.find((w) => w.id === wire.id).via.splice(selection.index, 1); selection = { kind: "wire", id: wire.id }; }));
    } else if (selection?.kind === "port" || selection?.kind === "junction") {
      const endpoint = selection.kind === "junction" ? selection.id + ":p" : selection.id;
      $("selectionTitle").textContent = portName(endpoint); prop.innerHTML = readings([["相對電勢", analysis.potentials[endpoint], "V"]]);
      if (probeResult) prop.innerHTML += readings([["第一點 − 第二點", probeResult.voltage, "V"]]);
      button("從此接線", () => { probeMode = false; startWire(endpoint); }); button("設為 0 V", () => change((doc) => { doc.display.reference = endpoint; }));
      if (pending) button("取消接線", () => { cancel(); notify("已取消未完成接線。"); });
      if (selection.kind === "junction") button("刪除接點及分支", () => { cancel(); change((doc) => M.remove(doc, selection.id)); }, false, true);
    } else {
      $("selectionTitle").textContent = "電路概覽"; prop.innerHTML = `<p class="note">${d.components.length} 個元件 · ${d.wires.length} 條導線<br>點選元件或導線，這裏會顯示屬性與讀值。</p>`;
      if (probeResult) prop.innerHTML += readings([["第一點 − 第二點", probeResult.voltage, "V"]]);
    }
    for (const diagnostic of analysis.diagnostics) { const p = document.createElement("p"); p.className = "diagnostic"; p.textContent = diagnostic.message; prop.append(p); }
    const list = $("wireList"); list.replaceChildren(); d.wires.forEach((w) => { const row = document.createElement("div"); row.className = "wire-row"; const b = document.createElement("button"); b.textContent = portName(w.from) + " → " + portName(w.to); b.onclick = () => { selection = { kind: "wire", id: w.id }; render(); const p = routes[w.id][0]; focusPoint(p); }; const del = document.createElement("button"); del.className = "delete"; del.textContent = "×"; del.setAttribute("aria-label", "刪除導線 " + w.id); del.onclick = () => { cancel(); change((doc) => M.remove(doc, w.id)); }; row.append(b, del); list.append(row); });
  }
  function componentReadings(id) { const c = history.get().components.find((c) => c.id === id), r = analysis.components[id]; if (!c || !r) return ""; const items = [["兩端電壓", r.voltage, "V"], [c.type === "battery" ? "向外供出電流" : "a → b 電流", c.type === "battery" && r.current !== null ? -c.params.polarity * r.current : r.current, "A"], [c.type === "battery" ? "端口輸出功率" : "吸收功率", c.type === "battery" ? r.delivered : r.power, "W"]]; if (c.type === "battery") items.push(["內阻發熱", r.internalPower, "W"], ["電源總供能", r.sourcePower, "W"]); if (c.type === "lamp") items.push(["工作電阻", r.resistance, "Ω"]); if (r.unit) items.push(["儀表讀值", r.reading, r.unit]); return readings(items); }
  function portName(id) { const [cid, port] = id.split(":"); const c = history.get().components.find((c) => c.id === cid); return c ? c.label + " " + R.ports(c).find((p) => p.key === port)?.label : "接點 " + cid; }
  function rotate(id) { const c = history.get().components.find((c) => c.id === id); if (!c || !M.permission(history.get(), c, "rotate")) return; cancel(); change((doc) => { const item = doc.components.find((x) => x.id === id); item.angle = (item.angle + 90) % 360; }); }
  document.addEventListener("pointerdown", (event) => { if (drag && event.pointerId !== drag.pointerId) { cancel(); notify("多點觸控已取消本次操作。"); } }, true);
  surface.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || (event.pointerType === "touch" && !event.isPrimary)) return;
    if (drag && event.pointerId !== drag.pointerId) { cancel(); notify("多點觸控已取消本次操作。"); return; }
    const target = event.target.closest(".hit"), meta = target?.meta;
    if (panMode) { drag = { kind: "pan", pointerId: event.pointerId, target: surface, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, base: { ...camera }, pointerType: event.pointerType }; surface.setPointerCapture(event.pointerId); return; }
    if (!meta || meta.kind === "wire") return;
    if (meta.kind === "port" && probeMode) return;
    const point = world(event.clientX, event.clientY), d = history.get();
    if (meta.kind === "body" || meta.kind === "slider") { const c = d.components.find(c=>c.id===meta.id); if (!M.permission(d, c, meta.kind === "slider" ? "params" : "move")) return; }
    selection = { ...meta };
    const from = meta.kind === "junction" ? meta.id + ":p" : meta.id;
    const previousPending = pending;
    if (meta.kind === "port") { if (!pending) startWire(from); }
    drag = { ...meta, pointerId: event.pointerId, pointerType: event.pointerType, target, down: point, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, baseDoc: M.clone(d), previousPending, moved: false };
    target.setPointerCapture(event.pointerId); render();
  });
  surface.addEventListener("pointermove", (event) => {
    if (!drag) { if (pending) { const p = world(event.clientX, event.clientY); pending.snap = resolveSnap(p); pending.point = p; renderGhost(); for (const t of targets.values()) t.classList.toggle("snap", pending.snap?.id === t.meta.id); } return; }
    if (event.pointerId !== drag.pointerId) return;
    drag.lastX = event.clientX; drag.lastY = event.clientY; const p = world(event.clientX, event.clientY); drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6;
    if (drag.kind === "pan") { camera.x = drag.base.x - (event.clientX - drag.x) / camera.scale; camera.y = drag.base.y - (event.clientY - drag.y) / camera.scale; render(false); return; }
    if (!drag.moved) return;
    if (drag.kind === "port") { pending.snap = resolveSnap(p); pending.point = p; drag.focus = pending.snap || p; render(false); }
    else {
      previewDoc = M.clone(drag.baseDoc); const dx = p.x - drag.down.x, dy = p.y - drag.down.y;
      if (drag.kind === "body" || drag.kind === "junction") { const items = drag.kind === "body" ? previewDoc.components : previewDoc.junctions, item = items.find((x) => x.id === drag.id); item.x = snapGrid(item.x + dx); item.y = snapGrid(item.y + dy); drag.focus = { x: item.x, y: item.y }; }
      else if (drag.kind === "slider") { const c = previewDoc.components.find((c) => c.id === drag.id), angle = c.angle * Math.PI / 180, local = (p.x - c.x) * Math.cos(angle) + (p.y - c.y) * Math.sin(angle); c.params.position = Math.max(0, Math.min(1, Math.round((local + 30) / 60 * 100) / 100)); analysis = S.solve(previewDoc); drag.focus = p; }
      else if (drag.kind === "bend") { const item = previewDoc.wires.find((w) => w.id === drag.id).via[drag.index]; item.x = snapGrid(item.x + dx); item.y = snapGrid(item.y + dy); drag.focus = item; }
      render(false);
    }
  });
  surface.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return; const finished = drag, preview = previewDoc; drag = null; previewDoc = null; $("preview").hidden = true;
    if (finished.target.hasPointerCapture(event.pointerId)) finished.target.releasePointerCapture(event.pointerId);
    if (finished.kind === "port") {
      if (finished.moved && pending?.snap) wireTo(pending.snap.id);
      else if (!finished.moved && finished.previousPending && finished.previousPending.from !== finished.id) wireTo(finished.id);
      else if (finished.moved) { notify("尚未接上端子；可再點另一個端子，或按 Escape 取消。"); }
    } else if (finished.kind === "junction" && !finished.moved) { const endpoint = finished.id + ":p"; if (probeMode) probePort(endpoint); else if (pending && pending.from !== endpoint) wireTo(endpoint); else startWire(endpoint); }
    else if (finished.kind === "body" && !finished.moved && selectedComponent()?.type === "switch" && M.permission(history.get(), selectedComponent(), "switch")) { change((d) => { const c = d.components.find((c) => c.id === finished.id); c.params.closed = !c.params.closed; }); }
    else if (preview && finished.moved) { change((d) => Object.assign(d, preview)); notify("位置已更新，原本接線保持連接。"); }
    render();
  });
  surface.addEventListener("pointercancel", cancel); surface.addEventListener("lostpointercapture", (e) => { if (drag?.pointerId === e.pointerId) cancel(); }); window.addEventListener("blur", cancel);
  surface.addEventListener("click", (event) => {
    const target = event.target.closest(".hit"), meta = target?.meta;
    if (panMode) return;
    if (meta?.kind === "port" && probeMode) { probePort(meta.id); return; }
    if (meta && (meta.kind === "body" || meta.kind === "slider")) { const c=history.get().components.find(c=>c.id===meta.id); if(!M.permission(history.get(),c,meta.kind=== "slider" ? "params" : "move")){selection={...meta}; if(c.type === "switch" && M.permission(history.get(),c,"switch")) change(d=>{const c=d.components.find(c=>c.id===meta.id);c.params.closed=!c.params.closed;});else render();return;} }
    if (meta?.kind === "wire") { const wire = history.get().wires.find((w) => w.id === meta.id), path = routes[wire.id], point = event.detail ? world(event.clientX, event.clientY) : path[meta.segment]; const nearest = G.nearest(path, point);
      if (pending) wireTo(null, { wire, route: path, point: nearest }); else { selection = { kind: "wire", id: wire.id, point: nearest }; render(); }
      return;
    }
    // Keyboard-generated clicks on ports have no pointerdown/up.
    if (meta && event.detail === 0) { if (["port", "junction"].includes(meta.kind)) { const endpoint = meta.kind === "junction" ? meta.id + ":p" : meta.id; if (probeMode) probePort(endpoint); else if (pending && pending.from !== endpoint) wireTo(endpoint); else startWire(endpoint); } else { selection = { ...meta }; if (meta.kind === "body" && selectedComponent()?.type === "switch" && M.permission(history.get(), selectedComponent(), "switch")) change((d) => { const c = d.components.find((c) => c.id === meta.id); c.params.closed = !c.params.closed; }); else render(); } return; }
    if (!meta) { if (pending) { const p = world(event.clientX, event.clientY); pending.via.push({ x: snapGrid(p.x), y: snapGrid(p.y) }); if (pending.via.length > M.limits.bends) pending.via.pop(); pending.point = p; renderGhost(); notify("已加轉折，點端子或導線完成接線。"); } else { selection = null; render(); } }
  });
  window.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
    if (event.key === "Escape") { cancel(); probeFirst = null; notify("已取消目前操作。"); return; }
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(event.shiftKey); return; }
    const focused = event.target.meta; if (focused && ["body", "junction", "bend", "slider"].includes(focused.kind)) selection = { ...focused };
    if (event.key.toLowerCase() === "r" && selection?.kind === "body") { event.preventDefault(); rotate(selection.id); }
    if (["Delete", "Backspace"].includes(event.key) && selection && selection.kind !== "port") { event.preventDefault(); const id = selection.id; cancel(); change((d) => M.remove(d, id)); }
    const offsets = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    if (offsets[event.key] && selection && ["body", "junction", "bend", "slider"].includes(selection.kind)) { event.preventDefault(); const [dx, dy] = offsets[event.key]; change((d) => { let item; if (selection.kind === "body") { item = d.components.find((c) => c.id === selection.id); if (!M.permission(d, item, "move")) throw new Error("此元件已固定"); } else if (selection.kind === "slider") { const c = d.components.find((c) => c.id === selection.id); if (!M.permission(d, c, "params")) throw new Error("參數已固定"); c.params.position = Math.max(0, Math.min(1, c.params.position + (dx + dy) / 400)); return; } else if (selection.kind === "junction") item = d.junctions.find((j) => j.id === selection.id); else item = d.wires.find((w) => w.id === selection.id).via[selection.index]; item.x += dx; item.y += dy; }); }
  });
  function undo(redo = false) { cancel(); const changed = redo ? history.redo() : history.undo(); selection = null; analysis = S.solve(history.get()); render(); if (changed) emitChange(); notify(redo ? "已重做。" : "已復原。"); }
  $("undo").onclick = () => undo(); $("redo").onclick = () => undo(true);
  function loadDocument(doc) { const valid = typeof doc === "string" ? D.decode(doc) : M.validate(doc); cancel(); const previous = history.get(); history.replace(valid); analysis = S.solve(history.get()); selection = null; fit(); render(); if (history.get() !== previous) emitChange(); }
  $("preset").onchange = () => { loadDocument(P.create($("preset").value)); notify("已載入範例，可自由修改；按復原可返回原電路。"); };
  $("realView").onclick = () => change((d) => { d.display.view = "real"; }); $("schematicView").onclick = () => change((d) => { d.display.view = "schematic"; });
  ["flow", "meters", "potential", "values", "projection"].forEach((id) => { $(id).onchange = () => change((d) => { d.display[id] = $(id).type === "checkbox" ? $(id).checked : $(id).value; }); });
  $("pause").onchange = () => { paused = $("pause").checked; };
  $("mode").onchange = () => { cancel(); change((d) => { d.policy.mode = $("mode").value; }); };
  ["allowRotate", "allowParams", "allowSwitch"].forEach((id) => { $(id).onchange = () => { cancel(); change((d) => { d.policy[id] = $(id).checked; }); }; });
  $("probe").onclick = () => { cancel(); probeMode = !probeMode; probeFirst = null; probeResult = null; panMode = false; render(); notify(probeMode ? "點一個端子看電勢，再點另一個量兩點電壓。" : "點兩個端子即可接線。"); };
  $("pan").onclick = () => { cancel(); panMode = !panMode; probeMode = false; render(); notify(panMode ? "拖動畫布中央平移；兩側捲動帶可捲動宿主頁面。" : "已回到元件與接線操作。"); };
  document.querySelectorAll("[data-camera]").forEach((b) => { b.onclick = () => { cancel(); const action = b.dataset.camera, cx = camera.x + surface.clientWidth / (2 * camera.scale), cy = camera.y + surface.clientHeight / (2 * camera.scale); if (action === "fit") { fit(true); if (camera.scale < .55) notify("全圖預覽：點元件後用「定位所選」放大，或按 ＋ 放大接線。"); } else if (["in", "out"].includes(action)) { camera.scale = Math.max(.65, Math.min(2.5, camera.scale * (action === "in" ? 1.2 : 1 / 1.2))); camera.x = cx - surface.clientWidth / (2 * camera.scale); camera.y = cy - surface.clientHeight / (2 * camera.scale); } else { const delta = 100 / camera.scale; if (action === "left") camera.x -= delta; if (action === "right") camera.x += delta; if (action === "up") camera.y -= delta; if (action === "down") camera.y += delta; } render(false); }; });
  $("panelToggle").onclick = () => { cancel(); const hidden = $("app").classList.toggle("panel-hidden"); $("panelToggle").setAttribute("aria-expanded", String(!hidden)); $("panelToggle").setAttribute("aria-label", hidden ? "展開操作面板" : "收起操作面板"); requestAnimationFrame(() => render(false)); };
  $("clearAll").onclick = () => { cancel(); selection = null; change((d) => { if (d.policy.mode !== "free") throw new Error("固定模式可用「只移除導線」重新接線。"); Object.assign(d, M.empty()); }); };
  $("clearWires").onclick = () => { cancel(); change((d) => { d.wires = []; d.junctions = []; if (d.display.reference && !M.endpoints(d).has(d.display.reference)) d.display.reference = null; }); };
  $("autoRoute").onclick = () => { cancel(); change((d) => d.wires.forEach((w) => { w.via = []; })); };
  function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  $("save").onclick = () => { try { download(D.encode(history.get()), "電路工作台.json", "application/json"); notify("已匯出電路檔，可用「開啟」繼續編輯。"); } catch (e) { notify(e.message, true); } };
  $("saveTemplate").onclick = () => { try { download(D.encode(D.template(history.get())), "固定元件接線模板.json", "application/json"); } catch (e) { notify(e.message, true); } };
  $("open").onclick = () => $("fileInput").click();
  $("fileInput").onchange = async () => { const file = $("fileInput").files[0]; $("fileInput").value = ""; if (!file) return; try { if (file.size > M.limits.bytes) throw new Error("電路檔超出 256 KiB 限制"); loadDocument(await file.text()); notify("已開啟電路檔；按復原可返回原電路。"); } catch (e) { notify(e.message, true); } };
  $("exportSvg").onclick = () => { const d = history.get(), points = [...M.endpoints(d).values(), ...d.components.flatMap((c) => [{ x: c.x - 90, y: c.y - 100 }, { x: c.x + 90, y: c.y + 140 }]), ...Object.values(routes).flat()]; if (!points.length) return notify("先加入元件再匯出電路圖。"); const x = Math.min(...points.map((p) => p.x)) - 20, y = Math.min(...points.map((p) => p.y)) - 20, w = Math.max(...points.map((p) => p.x)) - x + 20, h = Math.max(...points.map((p) => p.y)) - y + 20; const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${V.scene(d, analysis, 1, routes)}${V.flow(d, analysis, routes, animationTime, 1)}</svg>`; download(content, "電路圖.svg", "image/svg+xml"); };
  $("help").onclick = $("panelHelp").onclick = () => $("helpDialog").showModal(); $("closeHelp").onclick = () => $("helpDialog").close();
  for (const [type, thermal] of [["battery"], ["resistor"], ["rheostat"], ["switch"], ["lamp", false], ["lamp", true], ["ammeter"], ["voltmeter"], ["wattmeter"]]) {
    const b = document.createElement("button"); b.type = "button"; b.dataset.add = type + (thermal ? ":thermal" : "");
    b.innerHTML = `<span class="icon">${R.get(type).icon}</span><span>${type === "lamp" ? thermal ? "變阻燈" : "恆阻燈" : R.get(type).name}</span>`;
    b.onclick = () => { cancel(); const succeeded = change((d) => { const x = snapGrid(camera.x + surface.clientWidth / (2 * camera.scale)), y = snapGrid(camera.y + surface.clientHeight / (2 * camera.scale)); let offset = 0; while (d.components.some((c) => Math.hypot(c.x - x - offset, c.y - y - offset) < 100)) offset += 40; const c = M.add(d, type, x + offset, y + offset, type === "lamp" ? { model: thermal ? "thermal" : "ideal" } : {}); selection = { kind: "body", id: c.id }; }); if(succeeded) notify("元件已加入。點端子接線，或拖動本體調整位置。"); }; $("palette").append(b);
  }
  let resized = false;
  new ResizeObserver(() => { if (drag || pending || previewDoc) cancel(); if (!resized) { fit(); resized = true; } render(false); }).observe(surface);
  window.CircuitWorkbench = Object.freeze({
    getDocument: () => M.clone(history.get()), getAnalysis: () => { const { voltage, ...data } = analysis; return M.clone(data); }, voltage: (a, b) => analysis.voltage(a, b),
    exportDocument: () => D.encode(history.get()), loadDocument,
    applyPolicy(policy) { cancel(); change((d) => { d.policy = { ...d.policy, ...policy }; }); },
    onChange(fn) { if (typeof fn !== "function") throw new TypeError("onChange requires a callback"); listeners.add(fn); return () => listeners.delete(fn); },
    getInteraction: () => ({ pending: pending ? { from: pending.from, via: M.clone(pending.via), snap: pending.snap?.id || null } : null, dragging: drag?.kind || null, selection: selection ? M.clone(selection) : null, camera: { ...camera }, lastMessage }), cancel
  });
  render();
  function animate(time) { if (!paused && lastTime) animationTime += Math.min(.05, (time - lastTime) / 1000); lastTime = time; if (!document.hidden && !drag) $("flowLayer").innerHTML = V.flow(current(), analysis, routes, animationTime, camera.scale); requestAnimationFrame(animate); }
  requestAnimationFrame(animate);
})();
