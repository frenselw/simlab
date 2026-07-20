"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Scoring = require("./scoring.js");
const Generator = require("./generator.js");
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
let seedCalls = 0;
const savedDrafts = [];
const SimScorm = {
  loadAttempt: () => ({ state: "new" }),
  setDraftProvider() {},
  makeSnapshot: (activity, state, answer, result) => ({ activity, state, answer, score: result?.score, passed: result?.passed }),
  saveDraft: (snapshot) => { savedDrafts.push(structuredClone(snapshot)); return true; },
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
  PositionTimeGenerator: Generator,
  PositionTimePersistence: Persistence,
  PositionTimeUiRuntime: UiRuntime,
  SimActivityFlow: ActivityFlow,
  SimScorm,
  scrollTo() {},
  crypto: { getRandomValues(words) { seedCalls += 1; words.set([1, 2, 3, 4]); return words; } }
};
const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
assert.doesNotMatch(source, /__SIMLAB_POSITION_TIME_TEST_SEED__/, "production main has no fixed-seed test hook");
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
assert.ok(explorationProbeControls.innerHTML.includes("加入 P、Q 兩個探針"), "exploration probe prompt uses neutral probe names");
assert.ok(explorationProbeControls.innerHTML.includes(">加入第一個探針</button>"), "exploration initially prompts for the first probe");
assert.ok(explorationProbeControls.innerHTML.includes('Δ<var>t</var>'), "exploration probe prompt formats delta t as a math quantity");
assert.ok(explorationProbeControls.innerHTML.includes('Δ<var>x</var>'), "exploration probe prompt formats delta x as a math quantity");
document.getElementById("timeSlider").value = "2";
document.getElementById("timeSlider").dispatch("input");
one('[data-add-probe="E"]').click();
assert.ok(explorationProbeControls.innerHTML.includes("<span>P</span>"), "exploration labels the first probe P");
assert.ok(explorationProbeControls.innerHTML.includes(">加入第二個探針</button>"), "exploration prompts for the second probe after P is added");
assert.ok(document.getElementById("graphLayer").innerHTML.includes(">P</text>"), "exploration graph labels the first probe P");
one('[data-add-probe="E"]').click();
assert.ok(explorationProbeControls.innerHTML.includes("<span>Q</span>"), "exploration labels the second probe Q");
assert.ok(explorationProbeControls.innerHTML.includes(">探針已齊</button>"), "exploration confirms when both probes are present");
assert.equal(one('[data-add-probe="E"]').disabled, true, "exploration disables add after both probes are present");
assert.ok(document.getElementById("graphLayer").innerHTML.includes(">Q</text>"), "exploration graph labels the second probe Q");
assert.ok(explorationProbeControls.innerHTML.includes('<var>t</var>'), "exploration probe reading formats time as a math quantity");
assert.ok(explorationProbeControls.innerHTML.includes('<var>x</var>'), "exploration probe reading formats position as a math quantity");
document.getElementById("timeSlider").value = "0";
document.getElementById("timeSlider").dispatch("input");

document.getElementById("labPanel").scrollTop = 640;
document.getElementById("confirmStart").click();
assert.equal(seedCalls, 1, "blank new attempt requests one Web Crypto seed");
assert.equal(savedDrafts.at(-1).answer.v, 2, "blank new attempt saves a schema v2 draft");
assert.equal(savedDrafts.at(-1).answer.g.s, "00000001000000020000000300000004", "saved draft keeps the generated attempt seed");
assert.ok(Generator.validateGeneratedPaper({ version: 2, missions: savedDrafts.at(-1).answer.g.q }), "saved draft embeds a validated authoritative paper");
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
assert.ok(document.getElementById("answerControls").innerHTML.includes('<var>x<sub class="numeric-subscript">0</sub></var>'), "mission 2 x0 control uses formula styling");
assert.ok(document.getElementById("answerControls").innerHTML.includes('<var>x<sub class="numeric-subscript">6</sub></var>'), "mission 2 x6 control uses formula styling");
assert.ok(document.getElementById("answerControls").innerHTML.includes('class="unit"'), "mission 2 time controls style units consistently");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="svg-math-symbol"'), "mission 2 graph labels use math symbols");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="svg-numeric-subscript"'), "mission 2 graph labels style numeric subscripts");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="motion-line student-line"'), "mission 2 shows the x0-to-x6 line before either position is set");
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
assert.equal(pointSteppers.length, 4, "mission 2 renders both x0/x6 stepper pairs through production controls");
for (const button of pointSteppers) {
  const label = button.getAttribute("aria-label");
  assert.equal(label.includes("<"), false, "stepper aria-label contains no rich HTML");
  assert.match(label, /x (零|六)/, "stepper aria-label uses a natural plain x0/x6 name");
}
pointSteppers.find((button) => button.dataset.stepQuantity === "xStart" && button.dataset.delta === "1").click();
assert.ok(document.getElementById("graphLayer").innerHTML.includes('= +1.0 <tspan class="svg-unit">m</tspan>'), "mission 2 graph shows the adjusted x0 position value");

one("#nextMission").click();
assert.equal(document.getElementById("graphSvg").getAttribute("viewBox"), "0 0 800 490", "mission 3 restores the height needed by its graph comparison control");
assert.ok(document.getElementById("probeControls").innerHTML.includes("加入 P、Q 兩個探針"), "mission 3 introduces the two neutral probes");
assert.ok(document.getElementById("probeControls").innerHTML.includes(">加入 A 車第一個探針</button>"), "mission 3 initially tells students to add the first A probe");
assert.ok(document.getElementById("probeControls").innerHTML.includes(">加入 B 車第一個探針</button>"), "mission 3 initially tells students to add the first B probe");
one('[data-add-probe="A"]').click();
assert.ok(document.getElementById("probeControls").innerHTML.includes("<span>P</span>"), "mission 3 labels the first probe P in its controls");
assert.ok(document.getElementById("graphLayer").innerHTML.includes(">AP</text>"), "mission 3 labels the first A probe AP on the graph");
assert.ok(one('[data-probe-line="A"]').getAttribute("aria-label").includes("P 探針"), "mission 3 first probe accessibility label uses P");
assert.ok(document.getElementById("probeControls").innerHTML.includes(">加入 A 車第二個探針</button>"), "mission 3 prompts for the second A probe after the first is added");
one('[data-add-probe="A"]').click();
assert.ok(document.getElementById("probeControls").innerHTML.includes("<span>Q</span>"), "mission 3 labels the second probe Q in its controls");
assert.ok(document.getElementById("graphLayer").innerHTML.includes(">AQ</text>"), "mission 3 labels the second A probe AQ on the graph");
assert.ok(document.getElementById("probeControls").innerHTML.includes(">A 車探針已齊</button>"), "mission 3 confirms when both A probes are present");
assert.equal(one('[data-add-probe="A"]').disabled, true, "mission 3 disables the A add button after both probes are present");
one("#nextMission").click();
assert.equal(document.getElementById("graphSvg").getAttribute("viewBox"), "0 0 800 440", "mission 4 returns to the compact graph height");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('class="motion-line student-line"'), "mission 4 shows the x-t line for the default x0 and velocity");
assert.ok(document.getElementById("roadLayer").innerHTML.includes('class="target-position-guide"'), "mission 4 marks the required position with a vertical dashed guide");
assert.match(document.getElementById("roadLayer").innerHTML, /<tspan class="svg-math-symbol">t<\/tspan> = \d+\.\d <tspan class="svg-unit">s<\/tspan>：<tspan class="svg-math-symbol">x<\/tspan> = [+-]?\d+\.\d <tspan class="svg-unit">m<\/tspan>/, "mission 4 guide labels the required time and position without giving the velocity");
assert.ok(document.getElementById("roadDesc").textContent.includes("紫色垂直虛線標示指定時刻要到達的位置"), "mission 4 road description explains the target position guide");
one("#nextMission").click();
assert.equal(document.getElementById("taskInstruction").innerHTML.includes("<sup>*</sup>"), false, "mission 5 uses plain t and x symbols in the instruction");
assert.ok(document.getElementById("taskInstruction").innerHTML.includes('<span class="math"><var>t</var></span>'), "mission 5 formats t as a math symbol");
assert.ok(document.getElementById("taskInstruction").innerHTML.includes('<span class="math"><var>x</var></span>'), "mission 5 formats x as a math symbol");
assert.ok(document.getElementById("answerControls").innerHTML.includes('<span class="math"><var>x</var></span>'), "mission 5 labels the meeting-position input x without a star");
assert.ok(document.getElementById("graphLayer").innerHTML.includes('<tspan class="svg-math-symbol">t</tspan>'), "mission 5 graph labels the specified meeting time t without a star");
assert.equal(document.getElementById("graphLayer").innerHTML.includes("t*"), false, "mission 5 graph no longer shows t star");
assert.ok(document.getElementById("dataGrid").innerHTML.includes('<span class="math"><var>t</var></span> ='), "mission 5 live data labels the specified meeting time t without a star");
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

function finalReviewFixture() {
  const fixture = Persistence.createExplore();
  assert.equal(Persistence.startAssessment(fixture, "alpha"), true);
  for (let step = 0; step < 5; step += 1) assert.equal(Persistence.nextMission(fixture), true);
  return fixture;
}

function generatedFinalReviewFixture() {
  const fixture = Persistence.createExplore();
  const seed = "0123456789abcdeffedcba9876543210";
  assert.equal(Persistence.startGeneratedAssessment(fixture, seed, Generator.generatePaper(seed)), true);
  for (let step = 0; step < 5; step += 1) assert.equal(Persistence.nextMission(fixture), true);
  return fixture;
}

function runProductionLifecycle({ attempt, submissionOutcome = null, saveDraftImpl = () => true, cryptoImpl = (words) => { words.set([5, 6, 7, 8]); return words; } }) {
  const caseDocument = new FakeDocument(ids);
  let draftProvider = null;
  const caseScorm = {
    loadAttempt: () => structuredClone(attempt),
    setDraftProvider(provider) { draftProvider = provider; },
    makeSnapshot: (activity, stateName, answer, result) => ({ activity, state: stateName, answer, score: result?.score, passed: result?.passed }),
    saveDraft: saveDraftImpl,
    submitWithCallbacks: (_result, _review, callbacks) => {
      const callback = submissionOutcome?.activityState === "success" ? callbacks.onSuccess : callbacks.onFailure;
      callback(submissionOutcome);
    },
    retryPending: () => ({ ok: false, frozen: true, committed: false, retryable: true }),
    finish: () => false
  };
  const caseWindow = {
    document: caseDocument,
    PositionTimeScoring: Scoring,
    PositionTimeGenerator: Generator,
    PositionTimePersistence: Persistence,
    PositionTimeUiRuntime: UiRuntime,
    SimActivityFlow: ActivityFlow,
    SimScorm: caseScorm,
    scrollTo() {},
    crypto: { getRandomValues: cryptoImpl }
  };
  vm.runInNewContext(source, {
    window: caseWindow,
    document: caseDocument,
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
  return { document: caseDocument, draftProvider };
}

const finalReview = finalReviewFixture();
const reviewAnswer = Persistence.encodeReview(finalReview);
const finalDraft = Persistence.encodeDraft(finalReview);
const generatedFinalReview = generatedFinalReviewFixture();
const generatedReviewAnswer = Persistence.encodeReview(generatedFinalReview);
const generatedFinalDraft = Persistence.encodeDraft(generatedFinalReview);

const editableCase = runProductionLifecycle({ attempt: { state: "new" } });
assert.equal(typeof editableCase.draftProvider, "function", "startup editable production path registers its draft provider");
assert.ok(editableCase.document.querySelectorAll("[data-drag]").length > 0, "startup editable production path renders interactive controls");

const seedFailure = runProductionLifecycle({ attempt: { state: "new" }, cryptoImpl() { throw new Error("no crypto"); } }).document;
seedFailure.getElementById("confirmStart").click();
assert.ok(seedFailure.getElementById("startAssessment"), "seed failure leaves the learner safely in exploration");
assert.ok(seedFailure.getElementById("liveStatus").textContent.includes("仍在自由探索"), "seed failure explains that no assessment was opened");

let generatedSaveCalls = 0;
const generatedSaveFailure = runProductionLifecycle({ attempt: { state: "new" }, saveDraftImpl: () => { generatedSaveCalls += 1; return generatedSaveCalls === 1; } }).document;
generatedSaveFailure.getElementById("confirmStart").click();
assert.ok(generatedSaveFailure.getElementById("startAssessment"), "generated draft save failure does not reveal mission 1");
assert.equal(generatedSaveCalls, 2, "start transition saves exploration then verifies the generated draft save");

const frozenCase = runProductionLifecycle({ attempt: { state: "pending-final" } }).document;
assert.ok(frozenCase.getElementById("resultPanel").innerHTML.includes("答案保持凍結"), "startup frozen production UI explains the unconfirmed state");
assert.ok(frozenCase.getElementById("retryPending"), "startup frozen production UI offers only pending retry");
assert.equal(frozenCase.querySelectorAll("[data-drag]").length, 0, "startup frozen production UI is locked");
assert.equal(frozenCase.getElementById("resultPanel").innerHTML.includes("已通過"), false, "startup frozen production UI makes no pass claim");

const loadErrorCase = runProductionLifecycle({ attempt: { state: "error" } }).document;
assert.ok(loadErrorCase.getElementById("resultPanel").innerHTML.includes("無法安全讀取 Moodle 作答資料"), "startup load-error renders the production technical state");
assert.equal(loadErrorCase.getElementById("retryPending"), null, "startup load-error does not invent a retry action");
assert.equal(loadErrorCase.querySelectorAll("[data-drag]").length, 0, "startup load-error remains locked");

const trustedReview = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: reviewAnswer, score: 0, passed: false }, score: "0", status: "failed" } }).document;
assert.ok(trustedReview.getElementById("resultPanel").innerHTML.includes("任務 1"), "matching finished review renders trusted production detail");
assert.equal(trustedReview.querySelectorAll("[data-drag]").length, 0, "matching finished review is read-only");

const generatedTrustedReview = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: generatedReviewAnswer, score: 0, passed: false }, score: "0", status: "failed" } }).document;
assert.ok(generatedTrustedReview.getElementById("resultPanel").innerHTML.includes("任務 1"), "matching generated finished review renders trusted detail from its embedded paper");
assert.equal(generatedTrustedReview.querySelectorAll("[data-drag]").length, 0, "generated finished review remains read-only");

const generatedDraftCase = runProductionLifecycle({ attempt: { state: "draft", snapshot: { answer: generatedFinalDraft } } });
assert.ok(generatedDraftCase.document.getElementById("submitAttempt"), "generated final-review draft restores its legal submit continuation");
assert.equal(typeof generatedDraftCase.draftProvider, "function", "generated restored draft registers the production draft provider");
for (const id of ["playButton", "stepButton", "replayButton", "timeSlider"]) {
  assert.equal(generatedDraftCase.document.getElementById(id).disabled, true, `generated final-review disables ${id}`);
}
generatedDraftCase.document.getElementById("stepButton").click();
assert.equal(generatedDraftCase.document.getElementById("timeSlider").value, "0", "disabled final-review playback cannot advance time even through a synthetic click");
generatedDraftCase.document.querySelector("[data-edit-step]").click();
for (const id of ["playButton", "replayButton", "timeSlider"]) {
  assert.equal(generatedDraftCase.document.getElementById(id).disabled, false, `editing from final-review re-enables ${id}`);
}

const scoreMismatch = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: reviewAnswer, score: 1, passed: false }, score: "0", status: "failed" } }).document;
assert.ok(scoreMismatch.getElementById("resultPanel").innerHTML.includes("無法安全驗證"), "saved score mismatch falls back to the safe production summary");
assert.equal(scoreMismatch.getElementById("resultPanel").innerHTML.includes("任務 1"), false, "score mismatch hides untrusted mission detail");

const passMismatch = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: reviewAnswer, score: 0, passed: false }, score: "0", status: "passed" } }).document;
assert.ok(passMismatch.getElementById("resultPanel").innerHTML.includes("已通過"), "Moodle pass mismatch displays only the recorded Moodle summary");
assert.ok(passMismatch.getElementById("resultPanel").innerHTML.includes("無法安全驗證"), "Moodle pass mismatch does not trust saved detail");

const unknownStatus = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: reviewAnswer, score: 0, passed: false }, score: "0", status: "completed" } }).document;
assert.ok(unknownStatus.getElementById("resultPanel").innerHTML.includes("未能安全判斷合格狀態"), "unknown Moodle status renders an honest production completion label");

const invalidFinished = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: { invalid: true }, score: 40, passed: false }, score: "40", status: "failed" } }).document;
assert.ok(invalidFinished.getElementById("resultPanel").innerHTML.includes("40 / 100"), "invalid finished review keeps the trustworthy Moodle score summary");
assert.ok(invalidFinished.getElementById("resultPanel").innerHTML.includes("無法安全驗證"), "invalid finished review hides invalid answer detail");
assert.equal(invalidFinished.querySelectorAll("[data-drag]").length, 0, "invalid finished review cannot reopen editing");

const tamperedGeneratedReview = structuredClone(generatedReviewAnswer);
tamperedGeneratedReview.g.q.m5.meetTime = 6;
const invalidGeneratedFinished = runProductionLifecycle({ attempt: { state: "finished", snapshot: { answer: tamperedGeneratedReview, score: 20, passed: false }, score: "20", status: "failed" } }).document;
assert.ok(invalidGeneratedFinished.getElementById("resultPanel").innerHTML.includes("20 / 100"), "tampered generated finished review keeps only the Moodle score summary");
assert.equal(invalidGeneratedFinished.getElementById("resultPanel").innerHTML.includes("任務 1"), false, "tampered generated finished review hides invalid mission detail");

function submissionCase(outcome, draft = finalDraft) {
  const rendered = runProductionLifecycle({ attempt: { state: "draft", snapshot: { answer: draft } }, submissionOutcome: outcome }).document;
  rendered.getElementById("confirmSubmit").click();
  return rendered;
}

const successCase = submissionCase({ activityState: "success", ok: true, committed: true, frozen: false, retryable: false });
assert.ok(successCase.getElementById("resultPanel").innerHTML.includes("0 / 100"), "submission success renders the submitted result");
assert.equal(successCase.querySelectorAll("[data-drag]").length, 0, "submission success locks production controls");

const generatedSuccessCase = submissionCase({ activityState: "success", ok: true, committed: true, frozen: false, retryable: false }, generatedFinalDraft);
assert.ok(generatedSuccessCase.getElementById("resultPanel").innerHTML.includes("0 / 100"), "generated draft follows the production submission success path");
assert.equal(generatedSuccessCase.querySelectorAll("[data-drag]").length, 0, "generated submission success locks production controls");

const submissionFrozen = submissionCase({ activityState: "frozen", ok: false, committed: false, frozen: true, retryable: true });
assert.ok(submissionFrozen.getElementById("resultPanel").innerHTML.includes("提交狀態未確認"), "submission frozen renders an unconfirmed technical state");
assert.ok(submissionFrozen.getElementById("retryPending"), "submission frozen offers same-payload retry");
assert.equal(submissionFrozen.getElementById("resultPanel").innerHTML.includes("0 / 100"), false, "submission frozen makes no score claim");

const retryableCase = submissionCase({ activityState: "retry", ok: false, committed: false, frozen: false, retryable: true });
assert.ok(retryableCase.getElementById("submitAttempt"), "retryable submission returns to editable final review");
assert.ok(retryableCase.getElementById("liveStatus").textContent.includes("答案仍可修改"), "retryable submission explains that editing remains available");

const nonRetryableCase = submissionCase({ activityState: "retry", ok: false, committed: false, frozen: false, retryable: false });
assert.ok(nonRetryableCase.getElementById("resultPanel").innerHTML.includes("未能建立可重試的提交"), "non-retryable submission renders a locked technical state");
assert.equal(nonRetryableCase.getElementById("retryPending"), null, "non-retryable submission does not offer an unsafe retry");
assert.equal(nonRetryableCase.getElementById("resultPanel").innerHTML.includes("未通過"), false, "non-retryable submission makes no pass/fail claim");

console.log("Position-time production DOM/lifecycle wiring checks passed");
