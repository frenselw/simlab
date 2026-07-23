"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(__dirname, "panel-scroll-forwarding.js"), "utf8");
const listeners = new Map();
const surface = {
  captures: new Set(),
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type) { listeners.delete(type); },
  setPointerCapture(id) { this.captures.add(id); },
  hasPointerCapture(id) { return this.captures.has(id); },
  releasePointerCapture(id) { this.captures.delete(id); }
};
const panel = { scrollTop: 0, scrollHeight: 700, clientHeight: 200 };
const context = { window: {} };
vm.runInNewContext(source, context);
const forwarding = context.window.SimPanelScrollForwarding.attach({ surface, panel });

function event(type, x, y, overrides = {}) {
  let prevented = false;
  const value = {
    pointerType: "touch",
    pointerId: 1,
    isPrimary: true,
    clientX: x,
    clientY: y,
    preventDefault() { prevented = true; },
    ...overrides
  };
  listeners.get(type)(value);
  return () => prevented;
}

event("pointerdown", 50, 100, { pointerId: 2, isPrimary: false });
const secondaryPrevented = event("pointermove", 50, 50, { pointerId: 2, isPrimary: false });
assert.equal(panel.scrollTop, 0, "a non-primary pointer first seen on the surface is never forwarded");
assert.equal(secondaryPrevented(), false, "a non-primary pointer remains browser-owned");
assert.equal(surface.captures.size, 0, "a non-primary pointer is never captured");
event("pointerup", 50, 50, { pointerId: 2, isPrimary: false });

event("pointerdown", 50, 100);
const verticalPrevented = event("pointermove", 52, 60);
assert.equal(panel.scrollTop, 40, "vertical stage gesture scrolls the sibling panel with signed finger mapping");
assert.equal(verticalPrevented(), true, "claimed vertical forwarding prevents host-page scrolling");
assert.equal(surface.captures.has(1), true, "vertical forwarding captures its active pointer");
event("pointerup", 52, 60);
assert.equal(surface.captures.size, 0, "pointer capture is released at gesture end");

panel.scrollTop = 60;
event("pointerdown", 20, 20);
const horizontalPrevented = event("pointermove", 70, 22);
assert.equal(panel.scrollTop, 60, "horizontal gesture is not forwarded");
assert.equal(horizontalPrevented(), false, "horizontal gesture remains browser-owned");
event("pointercancel", 70, 22);

panel.scrollTop = 495;
event("pointerdown", 30, 80);
event("pointermove", 30, 20);
assert.equal(panel.scrollTop, 500, "forwarding clamps at the panel bottom");
event("pointerup", 30, 20);

forwarding.detach();
assert.equal(listeners.size, 0, "detach removes every forwarding listener");

for (const slug of ["inertial-reference-frame-road-observer", "linear-motion-velocity-lab"]) {
  const index = fs.readFileSync(path.join(root, "sim", slug, "index.html"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "sim", "manifests", `${slug}.xml`), "utf8");
  assert.match(index, /shared\/panel-scroll-forwarding\.js/, `${slug} loads the shared forwarding runtime`);
  assert.match(manifest, /shared\/panel-scroll-forwarding\.js/, `${slug} packages the shared forwarding runtime`);
}

console.log("panel scroll forwarding tests passed");
