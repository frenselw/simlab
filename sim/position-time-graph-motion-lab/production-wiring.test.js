"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Scoring = require("./scoring.js");
const Persistence = require("./persistence.js");
const UiRuntime = require("./ui-runtime.js");
const ActivityFlow = require("../shared/activity-flow.js");

function decode(value) {
  return String(value).replace(/&(quot|lt|gt|amp);/g, (_, entity) => ({ quot: '"', lt: "<", gt: ">", amp: "&" })[entity]);
}

function dataKey(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matches(element, selector) {
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  if (selector.startsWith(".")) return element.className.split(/\s+/).includes(selector.slice(1));
  const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (!attribute) return false;
  const actual = element.getAttribute(attribute[1]);
  return attribute[2] === undefined ? actual !== null : actual === attribute[2];
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.className = "";
    this.id = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.clientWidth = 800;
    this._innerHTML = "";
    this._textContent = "";
    this.classList = {
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : Boolean(force);
        if (enabled) names.add(name); else names.delete(name);
        this.className = Array.from(names).join(" ");
        this.attributes.class = this.className;
        return enabled;
      }
    };
  }

  setAttribute(name, rawValue = "") {
    const value = decode(rawValue);
    this.attributes[name] = value;
    if (name === "id") this.id = value;
    if (name === "class") this.className = value;
    if (name === "value") this.value = value;
    if (name === "disabled") this.disabled = true;
    if (name === "hidden") this.hidden = true;
    if (name.startsWith("data-")) this.dataset[dataKey(name)] = value;
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }

  dispatch(type, properties = {}) {
    const event = {
      target: this,
      currentTarget: this,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      key: "",
      shiftKey: false,
      preventDefault() {},
      ...properties
    };
    for (const handler of this.listeners[type] || []) handler(event);
    return event;
  }

  click() { this.dispatch("click"); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  setPointerCapture() {}

  closest(selector) {
    let current = this;
    while (current) {
      if (matches(current, selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  replaceChildren(...children) {
    this._innerHTML = "";
    this.children = children;
    for (const child of children) child.parentElement = this;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (matches(child, selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  createSVGPoint() {
    return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } };
  }

  getScreenCTM() { return { inverse() { return {}; } }; }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this._textContent = "";
    this.children = [];
    const tagPattern = /<([a-z][\w-]*)\b([^>]*)>/gi;
    let tagMatch;
    while ((tagMatch = tagPattern.exec(this._innerHTML))) {
      const child = new FakeElement(tagMatch[1], this.ownerDocument);
      child.parentElement = this;
      const attributePattern = /([:\w-]+)(?:="([^"]*)")?/g;
      let attributeMatch;
      while ((attributeMatch = attributePattern.exec(tagMatch[2]))) child.setAttribute(attributeMatch[1], attributeMatch[2] ?? "");
      this.children.push(child);
    }
  }

  get innerHTML() { return this._innerHTML; }

  set textContent(value) {
    this._textContent = String(value);
    this._innerHTML = "";
    this.children = [];
  }

  get textContent() { return this._textContent; }
}

class FakeDocument {
  constructor(ids) {
    this.roots = ids.map((id) => {
      const tag = id.endsWith("Svg") ? "svg" : id.endsWith("Dialog") ? "dialog" : "div";
      const element = new FakeElement(tag, this);
      element.setAttribute("id", id);
      return element;
    });
    this.activeElement = null;
    this.getElementById("timeSlider").value = "0";
  }

  createElement(tagName) { return new FakeElement(tagName, this); }

  allElements() {
    const all = [];
    const visit = (element) => {
      all.push(element);
      for (const child of element.children) visit(child);
    };
    for (const root of this.roots) visit(root);
    return all;
  }

  getElementById(id) { return this.allElements().find((element) => element.id === id) || null; }
  querySelectorAll(selector) { return this.allElements().filter((element) => matches(element, selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

const ids = ["modeDescription", "phaseBadge", "roadSvg", "roadDesc", "roadLayer", "graphSvg", "graphLayer", "graphSummary", "labPanel", "taskSection", "taskKicker", "taskTitle", "answerState", "taskInstruction", "setupSection", "motionControls", "presetControls", "playButton", "stepButton", "replayButton", "timeSlider", "timeOutput", "answerSection", "answerControls", "probeSection", "probeControls", "dataGrid", "liveStatus", "navigationControls", "resultSection", "resultPanel", "startDialog", "confirmStart", "submitDialog", "confirmSubmit"];
const document = new FakeDocument(ids);
let submitCalls = 0;
let finishCalls = 0;
let finishResult = false;
const SimScorm = {
  loadAttempt: () => ({ state: "new" }),
  setDraftProvider() {},
  makeSnapshot: (activity, state, answer, result) => ({ activity, state, answer, score: result?.score, passed: result?.passed }),
  saveDraft: () => true,
  submitWithCallbacks: (_result, _review, callbacks) => {
    submitCalls += 1;
    callbacks.onFailure({ activityState: "committed", ok: false, committed: true, frozen: true, retryable: true });
  },
  finish: () => {
    finishCalls += 1;
    return finishResult;
  }
};
const window = {
  document,
  PositionTimeScoring: Scoring,
  PositionTimePersistence: Persistence,
  PositionTimeUiRuntime: UiRuntime,
  SimActivityFlow: ActivityFlow,
  SimScorm,
  scrollTo() {}
};
const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
assert.match(indexSource, /id="roadSvg"[^>]+viewBox="0 0 800 145"/, "road SVG crops unused space below its final tick label");
assert.match(indexSource, /id="replayButton"[^>]*>回到 0 s<\/button>/, "time reset button says exactly what it does instead of implying immediate replay");
assert.match(indexSource, /id="taskKicker"[^>]*>活動指引<\/span>/, "task card has a dedicated visual kicker");
assert.match(stylesSource, /\.lab-shell\s*\{[^}]*grid-template-rows:\s*auto minmax\(10rem, 1fr\)/s, "mobile shell sizes the stage from its content instead of a fixed percentage");
assert.match(stylesSource, /\.lab-stage\s*\{[^}]*align-content:\s*start/s, "mobile stage rows do not stretch into blank space");
assert.doesNotMatch(stylesSource, /\.math-data\s*\{\s*grid-template-columns:\s*1fr;\s*\}/, "mobile live data keeps the compact two-column grid");
assert.match(stylesSource, /\.probe-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 1fr\)/s, "probe actions share one compact row");
assert.match(stylesSource, /\.task-section\[data-mode="mission"\]\s*\{[^}]*border-left:\s*5px solid var\(--color-accent\)/s, "assessment task card has a strong accent edge");
vm.runInNewContext(source, {
  window,
  document,
  console,
  Math,
  Number,
  String,
  Object,
  Array,
  Boolean,
  JSON,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  structuredClone
}, { filename: "position-time-graph-motion-lab/main.js" });

function one(selector, predicate = () => true) {
  const element = document.querySelectorAll(selector).find(predicate);
  assert.ok(element, `Expected production element ${selector}`);
  return element;
}

function quantity(name) {
  return one("[data-quantity]", (element) => element.dataset.quantity === name);
}

function setVelocity(value) {
  const input = quantity("velocity");
  input.value = String(value);
  input.dispatch("input");
}

function numericAttribute(element, name) { return Number(element.getAttribute(name)); }

function velocityHitState() {
  const layer = document.getElementById("roadLayer");
  const html = layer.innerHTML;
  const car = one("[data-drag]", (element) => element.dataset.drag === "car:A");
  const velocity = one("[data-drag]", (element) => element.dataset.drag === "velocity:A");
  const transform = html.match(/transform="translate\(([-\d.]+) ([-\d.]+)\)"/);
  assert.ok(transform, "production car transform is present");
  const tx = Number(transform[1]);
  const ty = Number(transform[2]);
  const x = numericAttribute(velocity, "cx");
  const y = numericAttribute(velocity, "cy");
  const carContainsVelocityCenter = x >= tx + numericAttribute(car, "x") - 22 &&
    x <= tx + numericAttribute(car, "x") + numericAttribute(car, "width") + 22 &&
    y >= ty + numericAttribute(car, "y") - 22 &&
    y <= ty + numericAttribute(car, "y") + numericAttribute(car, "height") + 22;
  const candidates = carContainsVelocityCenter ? [car, velocity] : [velocity];
  candidates.sort((a, b) => html.indexOf(`data-drag="${a.dataset.drag}"`) - html.indexOf(`data-drag="${b.dataset.drag}"`));
  return { layer, car, velocity, x, y, carContainsVelocityCenter, top: candidates.at(-1)?.dataset.drag };
}

const continuousVelocity = quantity("velocity");
assert.equal(document.getElementById("graphSvg").getAttribute("viewBox"), "0 0 800 440", "exploration graph removes the comparison-control reserve below the axis");
continuousVelocity.value = "0.5";
continuousVelocity.dispatch("input");
assert.equal(quantity("velocity"), continuousVelocity, "slider input keeps the active range element mounted");
continuousVelocity.value = "1.5";
continuousVelocity.dispatch("input");
assert.equal(quantity("velocity"), continuousVelocity, "same range element accepts consecutive input events");
assert.equal(document.getElementById("velocityValue").innerHTML.includes("+1.5"), true, "continuous input updates the heading readout");
assert.equal(document.getElementById("velocityStepperValue").innerHTML.includes("+1.5"), true, "continuous input updates the stepper readout");

for (const initialVelocity of [0, 0.5, -0.5]) {
  setVelocity(initialVelocity);
  const beforeX = quantity("x0").value;
  const hit = velocityHitState();
  assert.equal(hit.carContainsVelocityCenter, true, `v=${initialVelocity} velocity and car hit targets overlap`);
  assert.equal(hit.top, "velocity:A", `v=${initialVelocity} velocity target is topmost in production SVG paint order`);
  const velocityVisual = initialVelocity === 0 ? 'class="velocity-zero-marker"' : 'class="velocity-arrowhead"';
  assert.ok(hit.layer.innerHTML.indexOf(velocityVisual) > hit.layer.innerHTML.indexOf('data-drag="car:A"'), `v=${initialVelocity} velocity visual is above the car`);
  document.getElementById("roadSvg").dispatch("pointerdown", { target: hit.velocity, pointerId: 7, clientX: hit.x, clientY: hit.y });
  document.getElementById("roadSvg").dispatch("pointerup", { pointerId: 7, clientX: hit.x + 24, clientY: hit.y });
  assert.equal(Number(quantity("velocity").value), initialVelocity + 0.5, `v=${initialVelocity} pointer drag changes velocity`);
  assert.equal(quantity("x0").value, beforeX, `v=${initialVelocity} velocity drag does not change x0`);
}

setVelocity(1);
document.getElementById("timeSlider").value = "0.5";
document.getElementById("timeSlider").dispatch("input");
assert.ok(document.getElementById("roadLayer").innerHTML.includes('class="velocity-arrowhead"'), "velocity arrow remains visible after motion starts");
assert.equal(document.querySelectorAll("[data-drag]").some((element) => element.dataset.drag === "velocity:A"), false, "moving velocity arrow is read-only");
document.getElementById("timeSlider").value = "0";
document.getElementById("timeSlider").dispatch("input");

const explorationProbeControls = document.getElementById("probeControls");
assert.ok(explorationProbeControls.innerHTML.includes('<var>P</var>'), "exploration probe prompt formats P as a math symbol");
assert.ok(explorationProbeControls.innerHTML.includes('Δ<var>t</var>'), "exploration probe prompt formats delta t as a math quantity");
assert.ok(explorationProbeControls.innerHTML.includes('Δ<var>x</var>'), "exploration probe prompt formats delta x as a math quantity");
document.getElementById("timeSlider").value = "2";
document.getElementById("timeSlider").dispatch("input");
one('[data-add-probe="E"]').click();
assert.ok(explorationProbeControls.innerHTML.includes('<var>t</var>'), "exploration probe reading formats time as a math quantity");
assert.ok(explorationProbeControls.innerHTML.includes('<var>x</var>'), "exploration probe reading formats position as a math quantity");
document.getElementById("timeSlider").value = "0";
document.getElementById("timeSlider").dispatch("input");

document.getElementById("labPanel").scrollTop = 640;
document.getElementById("confirmStart").click();
assert.equal(document.getElementById("labPanel").scrollTop, 0, "starting the assessment returns the independently scrolling control panel to mission 1 at the top");
assert.equal(document.getElementById("taskKicker").textContent, "今題任務 · 1 / 5", "mission card clearly labels the current task number");
assert.equal(document.getElementById("taskTitle").textContent, "根據目標圖設定運動", "mission title is concise and separate from its progress label");
assert.equal(document.getElementById("answerState").textContent, "未作答", "mission 1 remains unanswered before either quantity is changed");
document.getElementById("timeSlider").value = "0.5";
document.getElementById("timeSlider").dispatch("input");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="motion-line student-line"'), "mission 1 draws the default student line during playback before either quantity is changed");
assert.equal(document.getElementById("answerState").textContent, "未作答", "default student-line preview does not mark mission 1 as answered");
document.getElementById("labPanel").scrollTop = 640;
one("#nextMission").click();
assert.equal(document.getElementById("labPanel").scrollTop, 0, "next mission returns the independently scrolling control panel to its top");
assert.ok(document.getElementById("taskTitle").innerHTML.includes('<span class="math"><var>x</var>–<var>t</var></span>'), "mission 2 title renders x-t with formula typography");
const missionTwoRoad = document.getElementById("roadLayer");
const guideAtStart = missionTwoRoad.innerHTML.match(/class="position-guide" x1="([\d.]+)"/);
assert.ok(guideAtStart, "mission 2 road renders a dashed position projection");
assert.equal(missionTwoRoad.innerHTML.includes('class="position-marker"'), false, "mission 2 road position projection has no arrowhead");
assert.ok(missionTwoRoad.innerHTML.includes('class="position-guide-label"'), "mission 2 road labels the current position");
assert.ok(document.getElementById("answerControls").innerHTML.includes('class="math"'), "mission 2 P0/P6 controls use formula styling");
assert.ok(document.getElementById("answerControls").innerHTML.includes('class="unit"'), "mission 2 time controls style units consistently");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="svg-math-symbol"'), "mission 2 graph labels use math symbols");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="svg-numeric-subscript"'), "mission 2 graph labels style numeric subscripts");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="motion-line student-line"'), "mission 2 shows the P0-to-P6 line before either point is set");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="axis-label vertical-axis-label" x="80" y="35" text-anchor="middle">x / m</text>'), "graph centers the vertical-axis title above the axis");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="tick-label horizontal-tick"'), "graph identifies horizontal ticks for responsive spacing");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('y="424"'), "graph leaves space between the horizontal axis and its tick labels");
document.getElementById("timeSlider").value = "0.5";
document.getElementById("timeSlider").dispatch("input");
const guideAfterStep = missionTwoRoad.innerHTML.match(/class="position-guide" x1="([\d.]+)"/);
assert.notEqual(guideAfterStep?.[1], guideAtStart[1], "position projection follows the moving car");
document.getElementById("timeSlider").value = "0";
document.getElementById("timeSlider").dispatch("input");
const pointSteppers = document.querySelectorAll("[data-step-quantity]").filter((button) => ["xStart", "xEnd"].includes(button.dataset.stepQuantity));
assert.equal(pointSteppers.length, 4, "mission 2 renders both P0/P6 stepper pairs through production controls");
for (const button of pointSteppers) {
  const label = button.getAttribute("aria-label");
  assert.equal(label.includes("<"), false, "stepper aria-label contains no rich HTML");
  assert.match(label, /P (零|六)/, "stepper aria-label uses a natural plain P0/P6 name");
}
pointSteppers.find((button) => button.dataset.stepQuantity === "xStart" && button.dataset.delta === "1").click();
assert.ok(document.getElementById("graphLayer").innerHTML.includes('= +1.0 <tspan class="svg-unit">m</tspan>'), "mission 2 graph shows the adjusted P0 position value");

one("#nextMission").click();
assert.equal(document.getElementById("graphSvg").getAttribute("viewBox"), "0 0 800 490", "mission 3 restores the height needed by its graph comparison control");
one("#nextMission").click();
assert.equal(document.getElementById("graphSvg").getAttribute("viewBox"), "0 0 800 440", "mission 4 returns to the compact graph height");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="motion-line student-line"'), "mission 4 shows the x-t line for the default x0 and velocity");
one("#nextMission").click();
one("#nextMission").click();
document.getElementById("confirmSubmit").click();
assert.equal(submitCalls, 1, "committed production path submits the answer once");
assert.ok(document.getElementById("retryFinish"), "committed production UI renders finish retry");
assert.equal(document.querySelectorAll("[data-drag]").length, 0, "committed review remains pointer-locked");
assert.ok(document.querySelectorAll("[data-quantity]").every((input) => input.disabled), "committed review controls remain disabled");

document.getElementById("retryFinish").click();
assert.equal(finishCalls, 1, "finish retry calls SimScorm.finish once");
assert.equal(submitCalls, 1, "failed finish retry does not resubmit answers");
assert.ok(document.getElementById("retryFinish"), "failed finish keeps retry action visible");
assert.equal(document.querySelectorAll("[data-drag]").length, 0, "failed finish remains locked");

finishResult = true;
document.getElementById("retryFinish").click();
assert.equal(finishCalls, 2, "successful retry calls SimScorm.finish once more");
assert.equal(submitCalls, 1, "successful finish does not resubmit answers");
assert.equal(document.getElementById("retryFinish"), null, "successful finish removes retry action");
assert.equal(document.querySelectorAll("[data-drag]").length, 0, "successful finish leaves submitted review locked");

console.log("Position-time production DOM/lifecycle wiring checks passed");
