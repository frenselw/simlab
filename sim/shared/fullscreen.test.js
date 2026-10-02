"use strict";
const assert = require("node:assert/strict");
const { attach } = require("./fullscreen.js");

class Button extends EventTarget {
  constructor() {
    super();
    this.attributes = {};
    const icon = () => ({ hidden: false, toggleAttribute(name, value) { assert.equal(name, "hidden"); this.hidden = value; } });
    this.icons = { "[data-fullscreen-enter]": icon(), "[data-fullscreen-exit]": icon() };
    this.disabled = false;
  }
  querySelector(selector) { return this.icons[selector]; }
  setAttribute(key, value) { this.attributes[key] = value; }
}
class Document extends EventTarget {
  constructor() {
    super();
    this.button = new Button();
    this.status = { dataset: {}, hidden: true, textContent: "" };
    this.documentElement = {};
    this.fullscreenElement = null;
    this.fullscreenEnabled = true;
  }
  getElementById(id) { return id === "fullscreenButton" ? this.button : id === "fullscreenStatus" ? this.status : id === "app" ? this.app || null : null; }
  change(element, legacy = false) {
    this[legacy ? "webkitFullscreenElement" : "fullscreenElement"] = element;
    this.dispatchEvent(new Event(legacy ? "webkitfullscreenchange" : "fullscreenchange"));
  }
}
function native(doc) {
  doc.documentElement.requestFullscreen = async function () {
    assert.equal(this, doc.documentElement);
    doc.change(this);
  };
  doc.exitFullscreen = async function () { assert.equal(this, doc); doc.change(null); };
}
function state(doc, active) {
  assert.equal(doc.button.attributes["aria-pressed"], String(active));
  assert.equal(doc.button.attributes["aria-label"], active ? "退出全螢幕" : "進入全螢幕");
  assert.equal(doc.button.title, doc.button.attributes["aria-label"]);
  assert.equal(doc.button.icons["[data-fullscreen-enter]"].hidden, active);
  assert.equal(doc.button.icons["[data-fullscreen-exit]"].hidden, !active);
}

(async () => {
  const doc = new Document(); native(doc);
  const controller = attach(doc); state(doc, false);
  await controller.toggle(); state(doc, true);
  await controller.toggle(); state(doc, false);
  await controller.toggle(); doc.change(null); state(doc, false); // Esc / browser exit.

  const appDoc = new Document(); native(appDoc);
  appDoc.app = { requestFullscreen: async function () { assert.equal(this, appDoc.app); appDoc.change(this); } };
  const appController = attach(appDoc);
  await appController.toggle(); assert.equal(appDoc.fullscreenElement, appDoc.app); state(appDoc, true);
  await appController.toggle(); state(appDoc, false);

  const markedDoc = new Document(); native(markedDoc);
  const markedTarget = { requestFullscreen: async function () {
    assert.equal(this, markedTarget); markedDoc.change(this);
  } };
  markedDoc.querySelector = selector => selector === "[data-sim-fullscreen-target]" ? markedTarget : null;
  const markedController = attach(markedDoc);
  await markedController.toggle(); assert.equal(markedDoc.fullscreenElement, markedTarget);
  await markedController.toggle(); state(markedDoc, false);

  let requests = 0, release;
  doc.documentElement.requestFullscreen = () => {
    requests++;
    return new Promise(resolve => { release = () => { doc.change(doc.documentElement); resolve(); }; });
  };
  const pending = controller.toggle();
  assert.equal(requests, 1, "request is made synchronously inside user activation");
  assert.equal(doc.button.disabled, true);
  state(doc, false);
  await controller.toggle(); assert.equal(requests, 1, "busy blocks a duplicate request");
  release(); await pending; assert.equal(doc.button.disabled, false); state(doc, true);

  doc.exitFullscreen = async () => { throw new Error("Denied exit"); };
  await controller.toggle(); state(doc, true);
  assert.equal(doc.status.dataset.fullscreenError, "exit");
  assert.match(doc.status.textContent, /Esc/); assert.equal(doc.button.disabled, false);
  native(doc); await controller.toggle(); state(doc, false); assert.equal(doc.status.hidden, true);

  doc.documentElement.requestFullscreen = async () => { throw new TypeError("Denied request"); };
  await controller.toggle(); state(doc, false);
  assert.equal(doc.status.hidden, false); assert.equal(doc.status.dataset.fullscreenError, "enter");
  assert.equal(doc.button.disabled, false);
  native(doc); await controller.toggle(); state(doc, true); assert.equal(doc.status.hidden, true);
  await controller.toggle();

  doc.fullscreenEnabled = false; requests = 0;
  doc.documentElement.requestFullscreen = () => { requests++; };
  await controller.toggle(); state(doc, false);
  assert.equal(requests, 0); assert.equal(doc.status.dataset.fullscreenError, "blocked");

  doc.fullscreenEnabled = true;
  doc.documentElement.requestFullscreen = async () => {}; // Promise alone is not success.
  await controller.toggle(); state(doc, false);
  assert.equal(doc.status.dataset.fullscreenError, "enter");

  const unsupported = new Document(); unsupported.fullscreenEnabled = false;
  await attach(unsupported).toggle(); state(unsupported, false);
  assert.equal(unsupported.status.dataset.fullscreenError, "unsupported");
  assert.equal(unsupported.button.disabled, false);

  const legacy = new Document(); delete legacy.fullscreenEnabled;
  legacy.webkitFullscreenEnabled = true;
  legacy.documentElement.webkitRequestFullscreen = function () { assert.equal(this, legacy.documentElement); };
  const oldController = attach(legacy);
  await oldController.toggle(); state(legacy, false); // No invented state before the WebKit event.
  legacy.change(legacy.documentElement, true); state(legacy, true);
  legacy.webkitExitFullscreen = function () { assert.equal(this, legacy); legacy.change(null, true); };
  await oldController.toggle(); state(legacy, false);
  legacy.dispatchEvent(new Event("webkitfullscreenerror"));
  assert.equal(legacy.status.hidden, false);
  legacy.change(legacy.documentElement, true); assert.equal(legacy.status.hidden, true);

  controller.destroy(); doc.change(doc.documentElement); state(doc, false);
  assert.equal(attach({ getElementById: () => null }), null);
  console.log("Fullscreen controls: native/WebKit state, external exit, busy, unsupported, policy and retry passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
