"use strict";
const assert = require('node:assert/strict');
const M = require('./model.js'), Scene = require('./scene.js'), cases = require('./test-cases.js');
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} ≠ ${b}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a, b) => Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI;
let count = 0;
for (const q of cases) for (const [w, h] of [[320,208], [390,220], [320,164], [430,160], [520,400], [760,640], [980,620]]) {
  const l = M.layout(w, h, q), g = Scene.geometry(q, l), base = Scene.sceneMarkup(q, l);
  const target = g.bodies.filter(b => b.target); assert.equal(target.length, 1);
  assert.deepEqual(target[0].center, l.center);
  assert.equal(g.bodies.length, ['C','E'].includes(q.family) ? 2 : 1);
  assert.equal((base.html.match(/class="center-mark"/g) || []).length, 1);
  assert.ok(!base.html.includes('data-arrow') && !base.html.includes('NaN'));
  for (const b of g.bodies) {
    const rx = b.radius || (Math.abs(Math.cos(b.tilt * Math.PI / 180)) * b.width + Math.abs(Math.sin(b.tilt * Math.PI / 180)) * b.height) / 2;
    const ry = b.radius || (Math.abs(Math.sin(b.tilt * Math.PI / 180)) * b.width + Math.abs(Math.cos(b.tilt * Math.PI / 180)) * b.height) / 2;
    assert.ok(b.center.x - rx >= 8 && b.center.x + rx <= w - 8, `${q.family} horizontal bounds`);
    assert.ok(b.center.y - ry >= 43 && b.center.y + ry <= h - 12, `${q.family} vertical bounds ${w}x${h}`);
  }
  for (const link of g.links) {
    assert.ok(distance(link.from, link.to) > 0, `${q.family} link has positive length`);
    for (const p of [link.from, link.to]) assert.ok(p.x >= 10 && p.x <= w - 10 && p.y >= 43 && p.y <= h - 12, `${q.family} link bounds`);
    if (link.type === 'spring') assert.ok(!Scene.springPath(link.from, link.to, link.state === 'compressed', l.displayScale).includes('NaN'));
  }
  if (q.family === 'A') {
    close(Math.abs(g.walls[0].x - l.center.x), target[0].radius, 'wall touches sphere');
    close(distance(l.center, g.surfaces[0].foot), target[0].radius, 'plane touches sphere');
  }
  if (q.family === 'B') for (const link of g.links) {
    close(M.angleDelta(angle(link.from, link.to), link.angle), 0, 'visible axis');
    close(distance(l.center, link.from), target[0].radius, 'link attached at sphere');
  }
  if (q.family === 'C') {
    const [a,b] = g.bodies; close(a.center.y + a.height / 2, g.surfaces[0].foot.y, 'A floor');
    close(b.center.y + b.height / 2, g.surfaces[0].foot.y, 'B floor');
    const spring = g.links[0], rod = g.links[1]; assert.ok(spring.from.y > rod.from.y, 'two sources separated');
    close(Math.abs(rod.to.x - b.center.x), b.width / 2, 'actuator acts on B');
  }
  if (q.family === 'D') close(distance(l.center, g.surfaces[0].foot), target[0].height / 2, 'block on incline');
  if (q.family === 'E') {
    for (const link of g.links) close(M.angleDelta(angle(link.from, link.to), q.ropes.find(r => r.id === link.id).angle), 0, `rope ${link.id}`);
    const [a,b] = g.bodies; close(distance(a.center, g.links[1].from), a.radius, 'b joins sphere 1');
    close(distance(b.center, g.links[1].to), b.radius, 'b joins sphere 2');
  }
  for (let a = 0; a < 3600; a += 50) {
    const p = M.endpoint([5, a, 1000], l);
    assert.ok(p.x >= 58 - 1e-7 && p.x <= w - 58 + 1e-7 && p.y >= 54 - 1e-7 && p.y <= h - 42 + 1e-7, 'all directions stay drawable');
  }
  count++;
}
const q = cases.find(q => q.family === 'C' && q.params.target === 'B');
const svg = { setAttribute(){}, innerHTML: '' };
Scene.render(svg, q, M.layout(760,640,q), [[5,0,600],[4,0,600]], 0);
assert.ok(svg.innerHTML.indexOf('data-arrow="1"') < svg.innerHTML.indexOf('data-arrow="0"'), 'selected overlapping arrow is visible on top');
console.log(`advanced equilibrium scene: ${count} geometry/viewport combinations and coincident-arrow selection passed`);
