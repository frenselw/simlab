"use strict";
const assert = require('node:assert/strict');
const G = require('./generator.js'), M = require('./model.js'), cases = require('./test-cases.js');
const seen = new Set(), orders = new Set();
const key = q => q.family + JSON.stringify(Object.fromEntries(Object.entries(q.params).sort()));
function balance(forces, name) {
  const sum = forces.reduce((s, f) => {
    assert.ok(f.magnitude > 0 && Number.isFinite(f.magnitude));
    s.x += f.magnitude * Math.cos(f.angle * Math.PI / 180); s.y += f.magnitude * Math.sin(f.angle * Math.PI / 180); return s;
  }, { x: 0, y: 0 });
  assert.ok(Math.hypot(sum.x, sum.y) < 1e-12, `${name} balances`);
}
function physics(q) {
  balance(q.expected, q.family);
  if (q.checks.otherBody) balance(q.checks.otherBody, 'other sphere');
  if (q.surface === 'smooth' || q.surface === 'none') assert.ok(!q.expected.some(f => f.kind === 2));
  for (const f of q.checks.friction || []) {
    assert.ok(f.normal > 0 && f.magnitude > 0 && f.coefficient > 0);
    assert.ok(f.magnitude <= f.coefficient * f.normal + 1e-12);
    if (q.family === 'C') assert.ok(f.magnitude < f.coefficient * f.normal);
    else assert.ok(Math.abs(f.magnitude - f.coefficient * f.normal) < 1e-12);
  }
  if (q.checks.spring) {
    const s = q.checks.spring;
    assert.ok(s.length > 0 && s.k > 0);
    assert.ok(Math.abs(s.k * Math.abs(s.length - s.naturalLength) - s.magnitude) < 1e-12);
    assert.equal(s.length > s.naturalLength, q.family === 'B');
  }
  for (const [i, a] of q.expected.entries()) for (const b of q.expected.slice(i + 1)) if (a.kind === b.kind) assert.ok(M.angleDelta(a.angle, b.angle) > 20);
  const mirrored = G.build(q.family, { ...q.params, sign: -q.params.sign });
  q.expected.forEach((f, i) => {
    assert.ok(M.angleDelta(mirrored.expected[i].angle, 180 - f.angle) < 1e-10);
    assert.equal(mirrored.expected[i].magnitude, f.magnitude);
  });
  assert.equal(mirrored.motion, q.motion, 'mirror keeps uphill/downhill meaning');
  for (const f of [...q.ropes, ...q.springs]) for (const direction of [f.angle, f.angle + 180]) assert.ok(q.referenceAngles.some(a => M.angleDelta(a, direction) < 1e-9));
  assert.equal(q.expected.filter(f => f.kind === 0).length, 1, 'only selected body weight');
}
cases.forEach(physics);
assert.equal(cases.length, 164);
for (let seed = 0; seed < 2000; seed++) {
  const s = G.generate(seed); assert.deepEqual(s, G.generate(seed));
  assert.deepEqual(s.order.slice().sort(), [0, 1, 2, 3, 4]);
  assert.equal(s.questions.filter(q => q.motion).length, 1);
  orders.add(s.order.join('')); s.questions.forEach(q => { balance(q.expected, q.family); seen.add(key(q)); });
}
assert.equal(orders.size, 120); assert.equal(seen.size, cases.length);
for (const q of cases) assert.ok(seen.has(key(q)));
for (const seed of [-1, .1, NaN, Infinity, 0x100000000]) assert.throws(() => G.generate(seed));
for (const version of [2, '__proto__', 'constructor']) assert.throws(() => G.generate(1, version));
console.log('advanced equilibrium generator: all 164 physical variants, 2000 deterministic sets and 120 orders passed');
