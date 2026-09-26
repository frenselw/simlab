"use strict";
const assert = require("node:assert/strict");
const G = require("./generator.js"), M = require("./model.js");
const seen = new Set(), orders = new Set();
function physics(q) {
  const sum = q.expected.reduce((s, f) => {
    assert.ok(f.magnitude > 0 && Number.isFinite(f.magnitude));
    s.x += f.magnitude * Math.cos(f.angle * Math.PI / 180); s.y += f.magnitude * Math.sin(f.angle * Math.PI / 180); return s;
  }, { x: 0, y: 0 });
  assert.ok(Math.hypot(sum.x, sum.y) < 1e-12, `${q.family} balances`);
  if (q.surface === "smooth" || q.surface === "none") assert.ok(!q.expected.some(f => f.kind === 2));
  if (q.expected.some(f => f.kind === 2)) {
    const n = q.expected.find(f => f.kind === 1).magnitude, f = q.expected.find(f => f.kind === 2).magnitude;
    assert.ok(f <= q.frictionCoefficient * n + 1e-12);
  }
  for (const [i, a] of q.expected.entries()) for (const b of q.expected.slice(i + 1)) if (a.kind === b.kind) assert.ok(M.angleDelta(a.angle, b.angle) > 20);
}
for (let seed = 0; seed < 2000; seed++) {
  const s = G.generate(seed); assert.deepEqual(s, G.generate(seed));
  assert.deepEqual(s.order.slice().sort(), [0, 1, 2, 3, 4]);
  assert.ok(s.questions.some(q => q.motion) && s.questions.some(q => !q.motion));
  orders.add(s.order.join("")); s.questions.forEach(q => { physics(q); seen.add(q.family + JSON.stringify(q.params)); });
}
for (const sign of [-1, 1]) for (const theta of [20, 25, 30, 35]) {
  physics(G.build("A", { sign, theta }));
  for (const beta of [0, 10, 20]) physics(G.build("D", { sign, theta, beta }));
}
for (const sign of [-1, 1]) for (const alpha of [0, 20, 30, 40]) for (const lambda of [.2, .3, .4]) for (const moving of [0, sign]) physics(G.build("B", { sign, alpha, lambda }, moving));
for (let alpha = 25; alpha <= 65; alpha += 5) for (let beta = 25; beta <= 65; beta += 5) if (Math.abs(alpha - beta) >= 10) physics(G.build("C", { alpha, beta }));
for (const sign of [-1, 1]) for (const alpha of [25, 35, 45]) for (const beta of [25, 35, 45]) for (const p of [.35, .45, .55]) for (const q of [.75, .85, .95]) physics(G.build("E", { sign, count: 3, alpha, beta, p, q }, sign));
assert.ok(orders.size > 110 && seen.size > 200);
for (const seed of [-1, .1, NaN, Infinity, 0x100000000]) assert.throws(() => G.generate(seed));
assert.throws(() => G.generate(1, 2));
console.log("equilibrium generator: 2000 deterministic sets and exhaustive physical parameter combinations passed");
