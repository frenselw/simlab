#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  CdpClient,
  buildAndExtractPackage,
  closeServer,
  createServer,
  delay,
  devToolsPort,
  evaluate,
  fetchJson,
  findBrowser,
  listenServer,
  stopChrome,
  validateOwnedDirectory,
  withTimeout
} = require("./position-time-browser-regression.js");

const root = path.resolve(__dirname, "..");
const tempRoot = fs.realpathSync(os.tmpdir());
const profilePattern = /^simlab-mobile-touch-chrome-[A-Za-z0-9]+$/;
const packages = [];
const allMetadata = [];
let pointerSequence = 10;

function diagnosticArgumentText(argument = {}) {
  if (Object.prototype.hasOwnProperty.call(argument, "value")) {
    if (typeof argument.value === "string") return argument.value;
    try {
      return JSON.stringify(argument.value);
    } catch (_error) {
      return String(argument.value);
    }
  }
  return argument.unserializableValue || argument.description || argument.type || "unknown";
}

function attachDiagnostics(cdp, label) {
  const diagnostics = { label, errors: [] };
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    diagnostics.errors.push(`exception: ${exceptionDetails?.exception?.description || exceptionDetails?.text || "unknown"}`);
  });
  cdp.on("Runtime.consoleAPICalled", ({ type, args = [] }) => {
    if (type === "error" || type === "assert") {
      diagnostics.errors.push(`console.${type}: ${args.map(diagnosticArgumentText).join(" ")}`);
    }
  });
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (entry?.level === "error") diagnostics.errors.push(`log.error: ${entry.text || entry.url || "unknown"}`);
  });
  return diagnostics;
}

function assertNoDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.errors, [], `${diagnostics.label}: no runtime, console, or browser-log errors`);
}

function touchPoint(x, y, id) {
  return { x, y, id, radiusX: 1, radiusY: 1, force: 1 };
}

async function frameEval(cdp, expression) {
  return evaluate(cdp, `(() => {
    const frame = globalThis.document.getElementById("activity");
    if (!frame?.contentWindow) throw new Error("Activity iframe is unavailable");
    const window = frame.contentWindow;
    return ((document) => (${expression}))(window.document);
  })()`);
}

function lmsPreload(snapshot, options = {}) {
  const suspend = snapshot ? JSON.stringify(snapshot) : "";
  const status = options.status || "incomplete";
  const score = options.score == null ? "" : String(options.score);
  return `(() => {
    const values = {
      "cmi.core.lesson_status": ${JSON.stringify(status)},
      "cmi.suspend_data": ${JSON.stringify(suspend)},
      "cmi.core.score.raw": ${JSON.stringify(score)}
    };
    window.__touchLmsValues = values;
    window.API = {
      LMSInitialize: () => "true",
      LMSFinish: () => "true",
      LMSCommit: () => "true",
      LMSGetValue: (key) => values[key] || "",
      LMSSetValue: (key, value) => (values[key] = String(value), "true"),
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => ""
    };
  })();`;
}

async function loadActivity(cdp, baseUrl, activityPath, readySelector, snapshot = null, lmsOptions = {}) {
  const preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: lmsPreload(snapshot, lmsOptions)
  });
  try {
    const src = `${activityPath}?mobile-touch-regression=${Date.now()}`;
    await cdp.send("Page.navigate", {
      url: `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(src)}`
    });
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const ready = await evaluate(cdp, `(() => {
        const frame = document.getElementById("activity");
        const child = frame?.contentDocument;
        return child?.readyState === "complete" && Boolean(child.querySelector(${JSON.stringify(readySelector)}));
      })()`);
      if (ready) break;
      if (attempt === 159) throw new Error(`${activityPath} did not become ready`);
      await delay(50);
    }
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: preload.identifier
    });
  }
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await evaluate(cdp, "scrollTo(0, 120)");
  await delay(150);
  await frameEval(cdp, `(() => {
    window.__touchEvents = [];
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
      document.addEventListener(type, (event) => {
        window.__touchEvents.push({
          type,
          isTrusted: event.isTrusted,
          pointerType: event.pointerType,
          pointerId: event.pointerId,
          target: event.target?.id || event.target?.dataset?.id || event.target?.dataset?.arrow || event.target?.className?.baseVal || event.target?.className || ""
        });
      }, true);
    }
    return true;
  })()`);
  allMetadata.push(await frameEval(cdp, `(() => ({
    activityPath: ${JSON.stringify(activityPath)},
    hostViewport: {
      width: window.parent.innerWidth,
      height: window.parent.innerHeight,
      visualWidth: window.parent.visualViewport?.width || null,
      visualHeight: window.parent.visualViewport?.height || null
    },
    activityViewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      visualWidth: window.visualViewport?.width || null,
      visualHeight: window.visualViewport?.height || null
    },
    maxTouchPoints: navigator.maxTouchPoints
  }))()`));
}

async function resetEvents(cdp) {
  await frameEval(cdp, "(() => (window.__touchEvents = [], true))()");
}

async function surfaces(cdp) {
  return frameEval(cdp, `(() => ({
    panel: document.querySelector(".sim-panel")?.scrollTop || 0,
    page: window.scrollY,
    viewport: window.visualViewport?.pageTop || 0,
    host: window.parent.scrollY,
    scale: window.visualViewport?.scale || 1,
    hostScale: window.parent.visualViewport?.scale || 1
  }))()`);
}

function assertSurfaceDelta(before, after, label, allowed = []) {
  for (const key of ["panel", "page", "viewport", "host"]) {
    if (!allowed.includes(key)) {
      assert.equal(after[key], before[key], `${label}: unexpected ${key} scroll`);
    }
  }
}

async function events(cdp) {
  return frameEval(cdp, "window.__touchEvents.slice()");
}

async function suspendSnapshot(cdp) {
  const raw = await frameEval(cdp, "window.__touchLmsValues['cmi.suspend_data']");
  return raw ? JSON.parse(raw) : null;
}

async function suspendRaw(cdp) {
  return frameEval(cdp, "window.__touchLmsValues['cmi.suspend_data']");
}

function assertCompletedTouch(log, label, options = {}) {
  const relevant = log.filter((event) => event.pointerType === "touch");
  assert(relevant.length > 0, `${label}: touch pointer events were observed`);
  assert(relevant.every((event) => event.isTrusted), `${label}: all pointer events are trusted`);
  assert(relevant.some((event) => event.type === "pointerdown"), `${label}: pointerdown occurred`);
  assert(relevant.some((event) => event.type === "pointermove"), `${label}: pointermove occurred`);
  assert(relevant.some((event) => event.type === "pointerup"), `${label}: pointerup occurred`);
  if (!options.allowCancel) {
    assert.equal(relevant.some((event) => event.type === "pointercancel"), false, `${label}: no pointercancel`);
  }
}

async function oneFinger(cdp, start, delta, steps = 4) {
  const id = pointerSequence++;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(start.x, start.y, id)]
  });
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [touchPoint(
        start.x + delta.x * step / steps,
        start.y + delta.y * step / steps,
        id
      )]
    });
    await delay(20);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(300);
}

async function mapBlankPoint(cdp) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const svg = document.getElementById("mapSvg");
    const bounds = svg.getBoundingClientRect();
    const candidates = [
      [0.50, 0.52], [0.23, 0.40], [0.72, 0.42], [0.50, 0.22], [0.18, 0.68], [0.75, 0.70]
    ];
    for (const [rx, ry] of candidates) {
      const x = bounds.left + bounds.width * rx;
      const y = bounds.top + bounds.height * ry;
      const hit = document.elementFromPoint(x, y);
      if (svg.contains(hit) && !hit.closest("[data-arrow],[data-person-hit]")) {
        return { x: frame.left + x, y: frame.top + y };
      }
    }
    throw new Error("No non-interactive map point found");
  })()`);
}

async function mapBlankFootprint(cdp, offsets, label) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const svg = document.getElementById("mapSvg");
    const bounds = svg.getBoundingClientRect();
    const offsets = ${JSON.stringify(offsets)};
    const candidates = [];
    for (const ry of [0.38, 0.50, 0.62, 0.72]) {
      for (const rx of [0.30, 0.42, 0.55, 0.68]) candidates.push([rx, ry]);
    }
    const describe = (hit) => hit?.id || hit?.dataset?.arrow || hit?.dataset?.personHit || hit?.className?.baseVal || hit?.className || hit?.tagName || "none";
    for (const [rx, ry] of candidates) {
      const centre = { x: bounds.left + bounds.width * rx, y: bounds.top + bounds.height * ry };
      const hits = offsets.map(({ x, y }) => {
        const localX = centre.x + x;
        const localY = centre.y + y;
        const hit = document.elementFromPoint(localX, localY);
        return {
          x: localX,
          y: localY,
          insideSvg: Boolean(hit && svg.contains(hit)),
          interactive: Boolean(hit?.closest("[data-arrow],[data-person-hit],.person-touch-target,.arrow-touch-target")),
          target: describe(hit)
        };
      });
      if (hits.every((hit) => hit.insideSvg && !hit.interactive)) {
        return {
          x: frame.left + centre.x,
          y: frame.top + centre.y,
          hits,
          label: ${JSON.stringify(label)}
        };
      }
    }
    throw new Error(${JSON.stringify(label)} + ": no map point keeps the complete two-touch footprint on non-interactive stage content");
  })()`);
}

async function mapTarget(cdp, selector) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target || target.hidden) throw new Error("Missing visible target: " + ${JSON.stringify(selector)});
    const bounds = target.getBoundingClientRect();
    return {
      x: frame.left + bounds.left + bounds.width / 2,
      y: frame.top + bounds.top + bounds.height / 2,
      localX: bounds.left + bounds.width / 2,
      localY: bounds.top + bounds.height / 2,
      localHit: document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.id || document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.className || "",
      hostHit: window.parent.document.elementFromPoint(frame.left + bounds.left + bounds.width / 2, frame.top + bounds.top + bounds.height / 2)?.id || window.parent.document.elementFromPoint(frame.left + bounds.left + bounds.width / 2, frame.top + bounds.top + bounds.height / 2)?.tagName || ""
    };
  })()`);
}

async function mapTargetCentre(cdp, selector) {
  return frameEval(cdp, `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    const bounds = target.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  })()`);
}

async function testMapForwarding(cdp, label) {
  const point = await mapBlankPoint(cdp);
  await frameEval(cdp, `(() => {
    const panel = document.querySelector(".sim-panel");
    if (panel.scrollHeight <= panel.clientHeight) throw new Error("Control panel must overflow");
    panel.scrollTop = 0;
    return true;
  })()`);
  const stateBefore = await suspendRaw(cdp);
  const assertStateUnchanged = async (variant) => {
    assert.equal(await suspendRaw(cdp), stateBefore, `${label} ${variant}: journey state remains unchanged`);
  };
  const before = await surfaces(cdp);
  await resetEvents(cdp);
  await oneFinger(cdp, point, { x: 0, y: -90 });
  const after = await surfaces(cdp);
  assert(after.panel > before.panel, `${label}: blank-map upward swipe forwards to panel`);
  assertSurfaceDelta(before, after, label, ["panel"]);
  assertCompletedTouch(await events(cdp), `${label} vertical forwarding`);
  await assertStateUnchanged("upward forwarding");

  await frameEval(cdp, `(() => {
    const panel = document.querySelector(".sim-panel");
    panel.scrollTop = Math.min(panel.scrollHeight - panel.clientHeight - 10, 120);
    if (panel.scrollTop <= 0) throw new Error("Panel needs interior range for downward forwarding");
    return true;
  })()`);
  const downwardBefore = await surfaces(cdp);
  await resetEvents(cdp);
  await oneFinger(cdp, point, { x: 0, y: 65 });
  const downwardAfter = await surfaces(cdp);
  assert(downwardAfter.panel < downwardBefore.panel, `${label}: blank-map downward swipe decreases panel scroll`);
  assertSurfaceDelta(downwardBefore, downwardAfter, `${label} downward`, ["panel"]);
  assertCompletedTouch(await events(cdp), `${label} downward forwarding`);
  await assertStateUnchanged("downward forwarding");

  await frameEval(cdp, "(() => (document.querySelector('.sim-panel').scrollTop = 50, true))()");
  const horizontalBefore = await surfaces(cdp);
  await resetEvents(cdp);
  await oneFinger(cdp, point, { x: 80, y: 3 });
  const horizontalAfter = await surfaces(cdp);
  assert.equal(horizontalAfter.panel, horizontalBefore.panel, `${label}: horizontal gesture is not forwarded`);
  assertSurfaceDelta(horizontalBefore, horizontalAfter, `${label} horizontal`);
  await assertStateUnchanged("horizontal");

  for (const boundary of ["top", "bottom"]) {
    await frameEval(cdp, `(() => {
      const panel = document.querySelector(".sim-panel");
      panel.scrollTop = ${boundary === "top" ? "0" : "panel.scrollHeight"};
      return true;
    })()`);
    const edgeBefore = await surfaces(cdp);
    await oneFinger(cdp, point, { x: 0, y: boundary === "top" ? 70 : -70 });
    const edgeAfter = await surfaces(cdp);
    assert.equal(edgeAfter.panel, edgeBefore.panel, `${label}: ${boundary} boundary stays clamped`);
    assertSurfaceDelta(edgeBefore, edgeAfter, `${label} ${boundary}`);
    await assertStateUnchanged(`${boundary} boundary`);
  }
}

async function testMapMultitouch(cdp, label) {
  const twoOffsets = [
    { x: -20, y: 0 }, { x: 20, y: 0 },
    { x: -32, y: 0 }, { x: 32, y: 0 },
    { x: -45, y: 0 }, { x: 45, y: 0 },
    { x: -58, y: 0 }, { x: 58, y: 0 }
  ];
  const point = await mapBlankFootprint(cdp, twoOffsets, `${label} two-touch footprint`);
  const stateBefore = await frameEval(cdp, "window.__touchLmsValues['cmi.suspend_data']");
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await frameEval(cdp, "(() => (document.querySelector('.sim-panel').scrollTop = 40, true))()");
  const twoBefore = await surfaces(cdp);
  await resetEvents(cdp);
  const firstId = pointerSequence++;
  const secondId = pointerSequence++;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      touchPoint(point.x - 20, point.y, firstId),
      touchPoint(point.x + 20, point.y, secondId)
    ]
  });
  for (const spread of [32, 45, 58]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        touchPoint(point.x - spread, point.y, firstId),
        touchPoint(point.x + spread, point.y, secondId)
      ]
    });
    await delay(35);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(50);
  const twoAfter = await surfaces(cdp);
  assert.equal(twoAfter.panel, twoBefore.panel, `${label}: two-touch start is not forwarded`);
  assertSurfaceDelta(twoBefore, twoAfter, `${label} two-touch start`);
  const twoLog = await events(cdp);
  assert(twoLog.filter((event) => event.type === "pointerdown" && event.pointerType === "touch" && event.isTrusted).length >= 2, `${label}: two-touch start reaches the browser as trusted touch`);
  assert(twoLog.some((event) => event.type === "pointercancel"), `${label}: browser takes over the two-touch gesture`);

  const lateOffsets = [
    { x: 0, y: 0 }, { x: 0, y: -12 }, { x: 0, y: -24 }, { x: 0, y: -35 },
    { x: 35, y: -35 }, { x: -12, y: -35 }, { x: 47, y: -35 },
    { x: -24, y: -35 }, { x: 58, y: -35 }, { x: -35, y: -35 }, { x: 70, y: -35 }
  ];
  const latePoint = await mapBlankFootprint(cdp, lateOffsets, `${label} late-second footprint`);
  await frameEval(cdp, "(() => (document.querySelector('.sim-panel').scrollTop = 0, true))()");
  await resetEvents(cdp);
  const lateFirst = pointerSequence++;
  const lateSecond = pointerSequence++;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(latePoint.x, latePoint.y, lateFirst)]
  });
  for (const dy of [-12, -24, -35]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [touchPoint(latePoint.x, latePoint.y + dy, lateFirst)]
    });
    await delay(35);
  }
  const claimed = await surfaces(cdp);
  assert(claimed.panel > 0, `${label}: first pointer claims forwarding before late second touch`);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      touchPoint(latePoint.x, latePoint.y - 35, lateFirst),
      touchPoint(latePoint.x + 35, latePoint.y - 35, lateSecond)
    ]
  });
  for (const [left, right] of [[-12, 47], [-24, 58], [-35, 70]]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        touchPoint(latePoint.x + left, latePoint.y - 35, lateFirst),
        touchPoint(latePoint.x + right, latePoint.y - 35, lateSecond)
      ]
    });
    await delay(35);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(50);
  const takeover = await surfaces(cdp);
  assert.equal(takeover.panel, claimed.panel, `${label}: late second touch stops panel forwarding`);
  assertSurfaceDelta(claimed, takeover, `${label} late multi-touch`);
  const lateLog = await events(cdp);
  assert(lateLog.filter((event) => event.type === "pointerdown" && event.pointerType === "touch" && event.isTrusted).length >= 2, `${label}: late second touch is trusted`);
  assert(lateLog.some((event) => event.type === "pointermove"), `${label}: late multi-touch remains browser-observable after forwarding is released`);
  assert(lateLog.some((event) => event.type === "pointerup"), `${label}: late multi-touch completes without the simulation retaining capture`);
  assert.equal(await frameEval(cdp, "window.__touchLmsValues['cmi.suspend_data']"), stateBefore, `${label}: multi-touch does not save journey state`);
}

async function testMapSecondaryDragGuard(cdp, label, firstOwner) {
  const person = await mapTarget(cdp, "#personTouchTarget");
  const blank = await mapBlankPoint(cdp);
  if (!(await suspendRaw(cdp))) {
    await oneFinger(cdp, person, { x: 0, y: 0 }, 1);
  }
  const stateBefore = await suspendRaw(cdp);
  const centreBefore = await mapTargetCentre(cdp, "#personTouchTarget");
  await resetEvents(cdp);
  const firstId = pointerSequence++;
  const secondId = pointerSequence++;
  const first = firstOwner === "blank" ? blank : person;
  const second = firstOwner === "blank" ? person : blank;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(first.x, first.y, firstId)]
  });
  await delay(50);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      touchPoint(first.x, first.y, firstId),
      touchPoint(second.x, second.y, secondId)
    ]
  });
  for (let step = 1; step <= 3; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        touchPoint(first.x, first.y, firstId),
        touchPoint(second.x + step * 12, second.y, secondId)
      ]
    });
    await delay(35);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(100);
  const log = await events(cdp);
  assert(log.filter((event) => event.type === "pointerdown" && event.pointerType === "touch" && event.isTrusted).length >= 2, `${label}: both touch starts are trusted`);
  assert.deepEqual(await mapTargetCentre(cdp, "#personTouchTarget"), centreBefore, `${label}: secondary touch cannot move the person`);
  assert.equal(await suspendRaw(cdp), stateBefore, `${label}: secondary touch cannot persist a drag`);
}

async function personDragVector(cdp) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const target = document.getElementById("personTouchTarget");
    const bounds = target.getBoundingClientRect();
    const group = document.querySelector(".person-marker");
    const match = group.getAttribute("transform").match(/translate\\(([-\\d.]+) ([-\\d.]+)\\)/);
    const point = { x: Number(match[1]), y: Number(match[2]) };
    let best = null;
    for (const line of document.querySelectorAll("#roadLayer .road-line")) {
      const a = { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) };
      const b = { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) };
      const length2 = (b.x-a.x)**2 + (b.y-a.y)**2;
      const t = Math.max(0, Math.min(1, ((point.x-a.x)*(b.x-a.x)+(point.y-a.y)*(b.y-a.y))/length2));
      const q = { x: a.x+t*(b.x-a.x), y: a.y+t*(b.y-a.y) };
      const distance = Math.hypot(point.x-q.x, point.y-q.y);
      if (!best || distance < best.distance) best = { a, b, t, distance };
    }
    const destination = best.t < 0.5 ? best.b : best.a;
    const unit = {
      x: (destination.x-point.x) / Math.hypot(destination.x-point.x, destination.y-point.y),
      y: (destination.y-point.y) / Math.hypot(destination.x-point.x, destination.y-point.y)
    };
    const svg = document.getElementById("mapSvg");
    const origin = new DOMPoint(point.x, point.y).matrixTransform(svg.getScreenCTM());
    const moved = new DOMPoint(point.x + unit.x * 6, point.y + unit.y * 6).matrixTransform(svg.getScreenCTM());
    return {
      start: { x: frame.left + bounds.left + bounds.width/2, y: frame.top + bounds.top + bounds.height/2 },
      delta: { x: moved.x-origin.x, y: moved.y-origin.y }
    };
  })()`);
}

async function personCompletionPath(cdp) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const svg = document.getElementById("mapSvg");
    const target = document.getElementById("personTouchTarget").getBoundingClientRect();
    const personMatch = document.querySelector(".person-marker").getAttribute("transform").match(/translate\\(([-\\d.]+) ([-\\d.]+)\\)/);
    const start = { x: Number(personMatch[1]), y: Number(personMatch[2]) };
    const targetRect = document.querySelector(".place-rect.is-target");
    const targetDot = targetRect?.nextElementSibling?.nextElementSibling;
    if (!targetDot?.classList.contains("position-dot")) throw new Error("Could not locate target place position");
    const destination = { x: Number(targetDot.getAttribute("cx")), y: Number(targetDot.getAttribute("cy")) };
    const key = (point) => point.x + "," + point.y;
    const nodes = new Map();
    const adjacency = new Map();
    const add = (point) => {
      nodes.set(key(point), point);
      if (!adjacency.has(key(point))) adjacency.set(key(point), []);
    };
    for (const line of document.querySelectorAll("#roadLayer .road-line")) {
      const a = { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) };
      const b = { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) };
      add(a); add(b);
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      adjacency.get(key(a)).push({ point: b, distance });
      adjacency.get(key(b)).push({ point: a, distance });
    }
    const startKey = key(start);
    const destinationKey = key(destination);
    const distances = new Map([[startKey, 0]]);
    const previous = new Map();
    const pending = new Set(nodes.keys());
    while (pending.size) {
      let current = null;
      let best = Infinity;
      for (const candidate of pending) {
        const distance = distances.get(candidate) ?? Infinity;
        if (distance < best) { best = distance; current = candidate; }
      }
      if (!current || current === destinationKey) break;
      pending.delete(current);
      for (const link of adjacency.get(current) || []) {
        const next = best + link.distance;
        if (next < (distances.get(key(link.point)) ?? Infinity)) {
          distances.set(key(link.point), next);
          previous.set(key(link.point), current);
        }
      }
    }
    const route = [];
    for (let current = destinationKey; current && current !== startKey; current = previous.get(current)) {
      route.unshift(nodes.get(current));
    }
    if (!route.length || key(route.at(-1)) !== destinationKey) throw new Error("No road path to target place");
    const svgPoints = [];
    let from = start;
    for (const to of route) {
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4);
      for (let step = 1; step <= steps; step += 1) {
        svgPoints.push({
          x: from.x + (to.x - from.x) * step / steps,
          y: from.y + (to.y - from.y) * step / steps
        });
      }
      from = to;
    }
    return {
      start: { x: frame.left + target.left + target.width / 2, y: frame.top + target.top + target.height / 2 },
      moves: svgPoints.map((point) => {
        const client = new DOMPoint(point.x, point.y).matrixTransform(svg.getScreenCTM());
        return { x: frame.left + client.x, y: frame.top + client.y };
      })
    };
  })()`);
}

async function assertPersonCompletionRollback(cdp, label, mode) {
  const path = await personCompletionPath(cdp);
  const centreBefore = await mapTargetCentre(cdp, "#personTouchTarget");
  const savedBefore = await suspendRaw(cdp);
  await resetEvents(cdp);
  const inputId = pointerSequence++;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(path.start.x, path.start.y, inputId)]
  });
  for (const point of path.moves) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [touchPoint(point.x, point.y, inputId)]
    });
    await delay(35);
  }
  const reached = await frameEval(cdp, `(() => ({
    personHidden: document.getElementById("personTouchTarget").hidden,
    arrowHidden: document.getElementById("arrowTouchTarget").hidden,
    personTransform: document.querySelector(".person-marker")?.getAttribute("transform"),
    target: (() => {
      const rect = document.querySelector(".place-rect.is-target");
      const dot = rect?.nextElementSibling?.nextElementSibling;
      return dot ? [dot.getAttribute("cx"), dot.getAttribute("cy")] : null;
    })()
  }))()`);
  assert.equal(reached.personHidden, true, `${label}: drag reaches destination and exits walk phase before rollback (${JSON.stringify({ reached, pathLength: path.moves.length, events: (await events(cdp)).length })})`);
  assert.equal(await frameEval(cdp, "document.getElementById('arrowTouchTarget').hidden"), false, `${label}: destination consequence creates the segment arrow before rollback`);
  if (mode === "cancel") {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  } else {
    const pointerId = (await events(cdp)).find((event) => event.type === "pointerdown")?.pointerId;
    await frameEval(cdp, `(() => {
      const target = document.getElementById("personTouchTarget");
      if (!target.hasPointerCapture(${pointerId})) throw new Error("Expected person pointer capture");
      target.releasePointerCapture(${pointerId});
      return true;
    })()`);
    await delay(50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await delay(100);
  const expectedEvent = mode === "cancel" ? "pointercancel" : "lostpointercapture";
  const log = await events(cdp);
  assert(log.some((event) => event.type === expectedEvent && event.pointerType === "touch" && event.isTrusted), `${label}: trusted ${expectedEvent} is observed`);
  assert.deepEqual(await mapTargetCentre(cdp, "#personTouchTarget"), centreBefore, `${label}: person returns exactly after full route rollback`);
  assert.equal(await frameEval(cdp, "document.getElementById('arrowTouchTarget').hidden"), true, `${label}: rollback removes destination-phase arrow consequence`);
  assert.equal(await suspendRaw(cdp), savedBefore, `${label}: completed-route rollback is not saved`);
  await oneFinger(cdp, await mapTarget(cdp, "#personTouchTarget"), { x: 0, y: 0 }, 1);
  assert.equal(await suspendRaw(cdp), savedBefore, `${label}: subsequent save excludes completed-route rollback`);
}

async function assertMapDrag(cdp, selector, delta, label, validateSemantic) {
  const snapshotBefore = await suspendSnapshot(cdp);
  const start = await mapTarget(cdp, selector);
  const centreBefore = await mapTargetCentre(cdp, selector);
  const scrollBefore = await surfaces(cdp);
  await resetEvents(cdp);
  await oneFinger(cdp, start, delta);
  const centreAfter = await mapTargetCentre(cdp, selector);
  const log = await events(cdp);
  assert(
    Math.hypot(centreAfter.x - centreBefore.x, centreAfter.y - centreBefore.y) > 2,
    `${label}: target moves (${JSON.stringify({ start, centreBefore, centreAfter, delta, log })})`
  );
  assertSurfaceDelta(scrollBefore, await surfaces(cdp), label);
  assertCompletedTouch(log, label);
  const snapshotAfter = await suspendSnapshot(cdp);
  assert(snapshotAfter, `${label}: successful drag persists suspend_data`);
  validateSemantic?.(snapshotBefore, snapshotAfter);
  return { snapshotBefore, snapshotAfter };
}

async function assertRollback(cdp, selector, delta, label, mode) {
  const start = await mapTarget(cdp, selector);
  const centreBefore = await mapTargetCentre(cdp, selector);
  const savedBefore = await suspendRaw(cdp);
  await resetEvents(cdp);
  const inputId = pointerSequence++;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(start.x, start.y, inputId)]
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [touchPoint(start.x + delta.x, start.y + delta.y, inputId)]
  });
  await delay(50);
  const centreDuring = await mapTargetCentre(cdp, selector);
  assert(Math.hypot(centreDuring.x - centreBefore.x, centreDuring.y - centreBefore.y) > 2, `${label}: target mutates before ${mode}`);
  if (mode === "cancel") {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  } else {
    const pointerId = (await events(cdp)).find((event) => event.type === "pointerdown")?.pointerId;
    assert(Number.isInteger(pointerId), `${label}: captured pointer id is observable`);
    await frameEval(cdp, `(() => {
      const target = document.querySelector(${JSON.stringify(selector)});
      if (!target.hasPointerCapture(${pointerId})) throw new Error("Expected active pointer capture");
      target.releasePointerCapture(${pointerId});
      return true;
    })()`);
    await delay(50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await delay(100);
  const log = await events(cdp);
  const expectedEvent = mode === "cancel" ? "pointercancel" : "lostpointercapture";
  assert(log.some((event) => event.type === expectedEvent && event.pointerType === "touch" && event.isTrusted), `${label}: trusted ${expectedEvent} is observed`);
  const centreAfter = await mapTargetCentre(cdp, selector);
  assert.deepEqual(centreAfter, centreBefore, `${label}: target returns exactly to its pre-drag position`);
  assert.equal(await suspendRaw(cdp), savedBefore, `${label}: rollback does not save`);
  await oneFinger(cdp, await mapTarget(cdp, selector), { x: 0, y: 0 }, 1);
  assert.equal(await suspendRaw(cdp), savedBefore, `${label}: a subsequent zero-change successful save excludes the rolled-back mutation`);
}

function mapPhaseSnapshot(base, phase) {
  const snapshot = structuredClone(base);
  const answer = snapshot.answer;
  const arrow = { tail: [18, 18], head: [58, 40] };
  const complete = {
    reached: true,
    routeDistance: 12,
    coverage: [],
    arrow,
    answers: { routeDistance: 12, displacementMagnitude: 10, direction: { directionType: "east" } }
  };
  answer.traceFormat = 2;
  answer.person = [18, 18];
  answer.totalArrow = null;
  answer.totalAnswers = null;
  answer.segments = [
    { reached: false, routeDistance: 0, coverage: [], arrow: null, answers: null },
    { reached: false, routeDistance: 0, coverage: [], arrow: null, answers: null }
  ];
  if (phase === "segment-one") {
    answer.currentSegment = 0;
    answer.phase = "draw-segment";
    answer.segments[0] = { ...structuredClone(complete), answers: null };
  } else if (phase === "segment-two") {
    answer.currentSegment = 1;
    answer.phase = "draw-segment";
    answer.segments[0] = structuredClone(complete);
    answer.segments[1] = { ...structuredClone(complete), answers: null };
  } else {
    answer.currentSegment = 1;
    answer.phase = "draw-total";
    answer.segments = [structuredClone(complete), structuredClone(complete)];
    answer.totalArrow = structuredClone(arrow);
  }
  return snapshot;
}

function assertPersonSemanticSave(before, after, label) {
  assert(before?.answer && after?.answer, `${label}: before/after draft snapshots decode`);
  assert.equal(after.activity, "displacement-distance-map-journey", `${label}: activity identity persists`);
  assert.equal(after.kind, "draft", `${label}: successful person drag persists a draft`);
  assert.equal(before.answer.phase, "walk", `${label}: person starts in walk phase`);
  assert.equal(after.answer.phase, "walk", `${label}: short person drag remains in walk phase`);
  assert.notDeepEqual(after.answer.person, before.answer.person, `${label}: saved person coordinate changes`);
  assert(after.answer.segments[0].routeDistance > before.answer.segments[0].routeDistance, `${label}: saved route distance increases`);
  assert.notDeepEqual(after.answer.segments[0].coverage, before.answer.segments[0].coverage, `${label}: saved route coverage changes`);
  const normalized = structuredClone(after);
  normalized.answer.person = structuredClone(before.answer.person);
  normalized.answer.segments[0].routeDistance = before.answer.segments[0].routeDistance;
  normalized.answer.segments[0].coverage = structuredClone(before.answer.segments[0].coverage);
  assert.deepEqual(normalized, before, `${label}: unrelated journey fields remain unchanged`);
}

function mapArrowAccessor(snapshot, phase) {
  if (phase === "segment-one") return snapshot.answer.segments[0].arrow;
  if (phase === "segment-two") return snapshot.answer.segments[1].arrow;
  return snapshot.answer.totalArrow;
}

function assertMapArrowSemanticSave(before, after, phase, label) {
  assert(before?.answer && after?.answer, `${label}: before/after draft snapshots decode`);
  assert.equal(after.activity, "displacement-distance-map-journey", `${label}: activity identity persists`);
  assert.equal(after.kind, "draft", `${label}: arrow drag persists a draft`);
  assert.equal(after.answer.phase, phase === "total" ? "draw-total" : "draw-segment", `${label}: correct map phase persists`);
  assert.notDeepEqual(mapArrowAccessor(after, phase).head, mapArrowAccessor(before, phase).head, `${label}: intended arrow head changes`);
  const normalized = structuredClone(after);
  mapArrowAccessor(normalized, phase).head = structuredClone(mapArrowAccessor(before, phase).head);
  assert.deepEqual(normalized, before, `${label}: unrelated arrows and journey fields remain unchanged`);
}

async function runMap(cdp, baseUrl, activityPath, label) {
  await loadActivity(cdp, baseUrl, activityPath, "#personTouchTarget");
  await testMapForwarding(cdp, `${label} map`);
  const personVector = await personDragVector(cdp);
  await oneFinger(cdp, personVector.start, { x: 0, y: 0 }, 1);
  await assertPersonCompletionRollback(cdp, `${label} map person cancel rollback`, "cancel");
  await assertPersonCompletionRollback(cdp, `${label} map person lost-capture rollback`, "lost");
  const restoredWalkSnapshot = await suspendSnapshot(cdp);
  await loadActivity(cdp, baseUrl, activityPath, "#personTouchTarget", restoredWalkSnapshot);
  const successfulPersonVector = await personDragVector(cdp);
  await assertMapDrag(
    cdp,
    "#personTouchTarget",
    successfulPersonVector.delta,
    `${label} map person`,
    (before, after) => assertPersonSemanticSave(before, after, `${label} map person`)
  );
  const saved = await suspendRaw(cdp);
  assert(saved, `${label}: person drag saves a draft`);
  const baseSnapshot = JSON.parse(saved);
  for (const phase of ["segment-one", "segment-two", "total"]) {
    await loadActivity(cdp, baseUrl, activityPath, "#arrowTouchTarget", mapPhaseSnapshot(baseSnapshot, phase));
    await oneFinger(cdp, await mapTarget(cdp, "#arrowTouchTarget"), { x: 0, y: 0 }, 1);
    if (phase === "segment-one") {
      await assertRollback(cdp, "#arrowTouchTarget", { x: 22, y: -14 }, `${label} map arrow cancel rollback`, "cancel");
      await assertRollback(cdp, "#arrowTouchTarget", { x: 22, y: -14 }, `${label} map arrow lost-capture rollback`, "lost");
    }
    await assertMapDrag(
      cdp,
      "#arrowTouchTarget",
      { x: 28, y: -18 },
      `${label} map ${phase} arrow`,
      (before, after) => assertMapArrowSemanticSave(before, after, phase, `${label} map ${phase} arrow`)
    );
  }

  const lockedSnapshot = mapPhaseSnapshot(baseSnapshot, "total");
  lockedSnapshot.kind = "review";
  lockedSnapshot.score = 0;
  lockedSnapshot.passed = false;
  await loadActivity(cdp, baseUrl, activityPath, "#mapSvg", lockedSnapshot, { status: "failed", score: 0 });
  assert.equal(await frameEval(cdp, "document.getElementById('arrowTouchTarget').hidden"), true, `${label}: locked review disables draggable overlay`);
  await testMapForwarding(cdp, `${label} locked-review map`);
}

function fbdSnapshot() {
  const types = ["weight", "normal", "applied", "friction", "tension"];
  const arrows = [];
  types.forEach((type, typeIndex) => {
    for (let slot = 0; slot < 2; slot += 1) {
      const angle = (typeIndex * 2 + slot) * Math.PI * 2 / 10;
      arrows.push({
        type,
        slot: slot + 1,
        start: { x: 320, y: 255 },
        end: { x: 320 + Math.cos(angle) * (105 + slot * 22), y: 255 + Math.sin(angle) * (105 + slot * 22) }
      });
    }
  });
  return {
    version: 1,
    activity: "fbd-horizontal-block",
    kind: "draft",
    answer: { arrows }
  };
}

async function fbdTargets(cdp) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const saved = JSON.parse(window.__touchLmsValues["cmi.suspend_data"]);
    return Array.from(document.querySelectorAll(".force-touch-target")).map((target, index) => {
      const bounds = target.getBoundingClientRect();
      const arrow = saved.answer.arrows[index];
      return {
        id: target.dataset.id,
        type: arrow.type,
        slot: String(saved.answer.arrows.slice(0, index + 1).filter((item) => item.type === arrow.type).length),
        x: frame.left + bounds.left + bounds.width / 2,
        y: frame.top + bounds.top + bounds.height / 2
      };
    });
  })()`);
}

async function fbdNativePoint(cdp, kind) {
  return frameEval(cdp, `(() => {
    const frame = window.frameElement.getBoundingClientRect();
    const svg = document.getElementById("diagram");
    const bounds = svg.getBoundingClientRect();
    const overlays = Array.from(document.querySelectorAll(".force-touch-target:not([hidden])"), (target) => target.getBoundingClientRect());
    const outsideOverlays = (x, y) => overlays.every((rect) => x < rect.left || x > rect.right || y < rect.top || y > rect.bottom);
    if (${JSON.stringify(kind)} === "shaft") {
      const line = document.querySelector(".force-line");
      const midpoint = new DOMPoint(
        (Number(line.getAttribute("x1")) + Number(line.getAttribute("x2"))) / 2,
        (Number(line.getAttribute("y1")) + Number(line.getAttribute("y2"))) / 2
      ).matrixTransform(svg.getScreenCTM());
      const hit = document.elementFromPoint(midpoint.x, midpoint.y);
      if (!outsideOverlays(midpoint.x, midpoint.y) || hit?.closest(".force-touch-target,[data-id]")) {
        throw new Error("FBD shaft midpoint overlaps a draggable head target");
      }
      return {
        x: frame.left + midpoint.x,
        y: frame.top + midpoint.y,
        localHit: hit?.id || hit?.className?.baseVal || hit?.className || hit?.tagName || ""
      };
    }
    const candidates = [[0.12, 0.18], [0.88, 0.18], [0.12, 0.78], [0.88, 0.78]];
    for (const [rx, ry] of candidates) {
      const x = bounds.left + bounds.width * rx;
      const y = bounds.top + bounds.height * ry;
      const hit = document.elementFromPoint(x, y);
      if (svg.contains(hit) && outsideOverlays(x, y) && !hit.closest("[data-id]")) {
        return { x: frame.left + x, y: frame.top + y, localHit: hit.id || hit.className?.baseVal || hit.className || hit.tagName || "" };
      }
    }
    throw new Error("No deterministic FBD blank point outside head overlays");
  })()`);
}

function assertTrustedNativeGesture(log, label) {
  const touch = log.filter((event) => event.pointerType === "touch");
  assert(touch.length > 0 && touch.every((event) => event.isTrusted), `${label}: native gesture events are trusted touch`);
  assert(touch.some((event) => event.type === "pointerdown"), `${label}: native gesture starts`);
  assert(touch.some((event) => event.type === "pointermove"), `${label}: native gesture moves`);
  assert(touch.some((event) => event.type === "pointerup" || event.type === "pointercancel"), `${label}: native gesture ends or is browser-cancelled`);
}

async function testFbdNativeScroll(cdp, label, kind) {
  await frameEval(cdp, `(() => {
    const scroller = document.scrollingElement;
    if (scroller.scrollHeight <= scroller.clientHeight) throw new Error("FBD document must overflow for native-scroll regression");
    scroller.scrollTop = 0;
    return true;
  })()`);
  const point = await fbdNativePoint(cdp, kind);
  const stateBefore = await suspendRaw(cdp);
  const before = await surfaces(cdp);
  await resetEvents(cdp);
  await oneFinger(cdp, point, { x: 0, y: -90 });
  const after = await surfaces(cdp);
  assert(after.page > before.page, `${label} ${kind}: vertical swipe scrolls the activity document`);
  assertSurfaceDelta(before, after, `${label} ${kind}`, ["page", "viewport"]);
  assertTrustedNativeGesture(await events(cdp), `${label} ${kind}`);
  assert.equal(await suspendRaw(cdp), stateBefore, `${label} ${kind}: no force state changes or saves`);
}

async function testFbdSecondaryDragGuard(cdp, label, firstOwner) {
  await frameEval(cdp, "(() => (document.scrollingElement.scrollTop = 0, true))()");
  const target = (await fbdTargets(cdp))[0];
  const selector = `.force-touch-target[data-id="${target.id}"]`;
  const blank = await fbdNativePoint(cdp, "blank");
  const stateBefore = await suspendRaw(cdp);
  const centreBefore = await mapTargetCentre(cdp, selector);
  await resetEvents(cdp);
  const firstId = pointerSequence++;
  const secondId = pointerSequence++;
  const first = firstOwner === "blank" ? blank : target;
  const second = firstOwner === "blank" ? target : blank;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(first.x, first.y, firstId)]
  });
  await delay(50);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      touchPoint(first.x, first.y, firstId),
      touchPoint(second.x, second.y, secondId)
    ]
  });
  for (let step = 1; step <= 3; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        touchPoint(first.x, first.y, firstId),
        touchPoint(second.x + step * 12, second.y, secondId)
      ]
    });
    await delay(35);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(100);
  const log = await events(cdp);
  assert(log.filter((event) => event.type === "pointerdown" && event.pointerType === "touch" && event.isTrusted).length >= 2, `${label}: both touch starts are trusted`);
  assert.deepEqual(await mapTargetCentre(cdp, selector), centreBefore, `${label}: secondary touch cannot move a force head`);
  assert.equal(await suspendRaw(cdp), stateBefore, `${label}: secondary touch cannot persist a force drag`);
}

function assertFbdSemanticSave(before, after, target, label) {
  assert(before?.answer?.arrows && after?.answer?.arrows, `${label}: before/after FBD snapshots decode`);
  assert.equal(after.activity, "fbd-horizontal-block", `${label}: activity identity persists`);
  assert.equal(after.kind, "draft", `${label}: successful force drag persists a draft`);
  const index = Number(target.id) - 1;
  assert.equal(before.answer.arrows[index].type, target.type, `${label}: intended force type is selected`);
  assert.equal(String(before.answer.arrows[index].slot), target.slot, `${label}: intended duplicate slot is selected`);
  assert.notDeepEqual(after.answer.arrows[index].end, before.answer.arrows[index].end, `${label}: intended arrow end changes`);
  const normalized = structuredClone(after);
  normalized.answer.arrows[index].end = structuredClone(before.answer.arrows[index].end);
  assert.deepEqual(normalized, before, `${label}: unrelated force arrows remain unchanged`);
}

async function runFbd(cdp, baseUrl, activityPath, label) {
  await loadActivity(cdp, baseUrl, activityPath, ".force-touch-target", fbdSnapshot());
  const targets = await fbdTargets(cdp);
  assert.equal(targets.length, 10, `${label}: all five FBD types and duplicates restore`);
  await testFbdNativeScroll(cdp, `${label} FBD`, "blank");
  await testFbdNativeScroll(cdp, `${label} FBD`, "shaft");
  await frameEval(cdp, "(() => (document.scrollingElement.scrollTop = 0, true))()");
  const firstSelector = `.force-touch-target[data-id="${targets[0].id}"]`;
  await assertRollback(cdp, firstSelector, { x: 16, y: -12 }, `${label} FBD cancel rollback`, "cancel");
  await assertRollback(cdp, firstSelector, { x: 16, y: -12 }, `${label} FBD lost-capture rollback`, "lost");
  const symbols = { weight: "G", normal: "N", applied: "F", friction: "f", tension: "T" };
  for (const target of targets) {
    const selector = `.force-touch-target[data-id="${target.id}"]`;
    const snapshotBefore = await suspendSnapshot(cdp);
    const before = await mapTargetCentre(cdp, selector);
    const scrollBefore = await surfaces(cdp);
    await resetEvents(cdp);
    await oneFinger(cdp, target, { x: 18, y: -14 });
    const after = await mapTargetCentre(cdp, selector);
    const itemLabel = `${label} FBD ${symbols[target.type]}${target.slot}`;
    assert(Math.hypot(after.x - before.x, after.y - before.y) > 2, `${itemLabel}: arrow head moves`);
    assertSurfaceDelta(scrollBefore, await surfaces(cdp), itemLabel);
    assertCompletedTouch(await events(cdp), itemLabel);
    assertFbdSemanticSave(snapshotBefore, await suspendSnapshot(cdp), target, itemLabel);
  }
  assert.equal(
    await frameEval(cdp, "document.querySelectorAll('.force-line[data-id]').length"),
    0,
    `${label}: FBD shafts have no drag identity`
  );
}

async function createPageClient(port) {
  const { response, body: target } = await fetchJson(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" }
  );
  if (!response.ok) throw new Error(`Could not create isolated Chrome target (${response.status}).`);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 620,
    deviceScaleFactor: 1,
    mobile: true
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  return client;
}

async function withIsolatedPage(port, label, run) {
  const client = await createPageClient(port);
  const diagnostics = attachDiagnostics(client, label);
  try {
    await run(client);
    assertNoDiagnostics(diagnostics);
  } finally {
    try {
      await client.send("Page.close");
      await delay(100);
    } catch {}
    client.close();
  }
}

async function runMapMultitouchIsolated(port, baseUrl, item) {
  await withIsolatedPage(port, `${item.label} map multi-touch`, async (client) => {
    await loadActivity(client, baseUrl, item.activityPath, "#personTouchTarget");
    await testMapMultitouch(client, `${item.label} map`);
  });
  for (const firstOwner of ["blank", "target"]) {
    await withIsolatedPage(port, `${item.label} map ${firstOwner}-first guard`, async (client) => {
      await loadActivity(client, baseUrl, item.activityPath, "#personTouchTarget");
      await testMapSecondaryDragGuard(client, `${item.label} map ${firstOwner}+secondary guard`, firstOwner);
    });
  }
}

async function runFbdMultitouchIsolated(port, baseUrl, item) {
  for (const firstOwner of ["blank", "target"]) {
    await withIsolatedPage(port, `${item.label} FBD ${firstOwner}-first guard`, async (client) => {
      await loadActivity(client, baseUrl, item.activityPath, ".force-touch-target", fbdSnapshot());
      await testFbdSecondaryDragGuard(client, `${item.label} FBD ${firstOwner}+secondary guard`, firstOwner);
    });
  }
}

async function runRoot(cdp, port, packageRoot, cases) {
  const server = createServer(packageRoot);
  await withTimeout(listenServer(server), 3000, "mobile touch HTTP server listen");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const item of cases) {
      if (item.slug === "displacement-distance-map-journey") {
        await runMap(cdp, baseUrl, item.activityPath, item.label);
        await runMapMultitouchIsolated(port, baseUrl, item);
      } else {
        await runFbd(cdp, baseUrl, item.activityPath, item.label);
        await runFbdMultitouchIsolated(port, baseUrl, item);
      }
    }
  } finally {
    try {
      await cdp.send("Page.navigate", { url: "about:blank" });
      await delay(100);
    } catch {}
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    await closeServer(server);
  }
}

function removePackage(directory, pattern) {
  if (!directory || !fs.existsSync(directory)) return;
  const exact = validateOwnedDirectory(directory, tempRoot, pattern, "mobile touch package");
  fs.rmSync(exact, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
}

async function main() {
  let profileDirectory;
  let chrome;
  let cdp;
  let diagnostics;
  let browserVersion;
  let browserErrors = "";
  let failure;
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required; install it or set CHROME_PATH.");
    for (const slug of ["displacement-distance-map-journey", "fbd-horizontal-block"]) {
      const prefix = `simlab-mobile-touch-${slug}-package-`;
      const pattern = new RegExp(`^${prefix}[A-Za-z0-9]+$`);
      const extracted = buildAndExtractPackage(tempRoot, {
        slug,
        packagePrefix: prefix,
        packageNamePattern: pattern
      });
      packages.push({ ...extracted, slug, pattern });
    }
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-mobile-touch-chrome-"));
    validateOwnedDirectory(profileDirectory, tempRoot, profilePattern, "mobile touch Chrome profile");
    const args = [
      "--headless=new",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--metrics-recording-only",
      "about:blank"
    ];
    if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr.on("data", (chunk) => { browserErrors = `${browserErrors}${chunk}`.slice(-4000); });
    const port = await withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome DevTools startup");
    const { response, body: target } = await fetchJson(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" }
    );
    if (!response.ok) throw new Error(`Could not create Chrome target (${response.status}).`);
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    diagnostics = attachDiagnostics(cdp, "primary mobile-touch target");
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    browserVersion = await cdp.send("Browser.getVersion");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 620,
      deviceScaleFactor: 1,
      mobile: true
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });

    await runRoot(cdp, port, root, [
      { slug: "displacement-distance-map-journey", activityPath: "/sim/displacement-distance-map-journey/index.html", label: "development" },
      { slug: "fbd-horizontal-block", activityPath: "/sim/fbd-horizontal-block/index.html", label: "development" }
    ]);
    for (const item of packages) {
      await runRoot(cdp, port, item.packageDirectory, [
        { slug: item.slug, activityPath: item.activityPath, label: `packaged ${item.slug}` }
      ]);
    }
    assertNoDiagnostics(diagnostics);
    console.log(`Mobile trusted-touch browser regression passed for development and extracted SCORM launches. ${JSON.stringify({
      browser: {
        product: browserVersion.product,
        userAgent: browserVersion.userAgent,
        jsVersion: browserVersion.jsVersion
      },
      emulation: { width: 390, height: 620, deviceScaleFactor: 1, maxTouchPoints: 2 },
      launches: allMetadata
    })}`);
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    failure = error;
  }
  try { await stopChrome(chrome, cdp); } catch (error) {
    failure = new AggregateError(failure ? [failure, error] : [error], "Chrome cleanup failed");
  }
  try {
    if (profileDirectory && fs.existsSync(profileDirectory)) {
      const exact = validateOwnedDirectory(profileDirectory, tempRoot, profilePattern, "mobile touch Chrome profile");
      fs.rmSync(exact, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
    }
    for (const item of packages) removePackage(item.packageDirectory, item.pattern);
  } catch (error) {
    failure = new AggregateError(failure ? [failure, error] : [error], "Temporary cleanup failed");
  }
  if (failure) throw failure;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
