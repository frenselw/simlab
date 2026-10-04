'use strict';
const assert = require('node:assert/strict');
const M = require('./circuit-model'), R = require('./component-registry'), G = require('./circuit-routing'),
  J = require('./circuit-snapping'), D = require('./circuit-document'), S = require('./circuit-solver'), Profile = require('./circuit-profile');
let cases = 0;
function test(name, fn) { fn(); cases++; console.log('✓ ' + name); }
function lead(d, a, b) {
  const w = M.addWire(d, (a.x + b.x) / 2, (a.y + b.y) / 2);
  Object.assign(d.junctions.find(j => j.id + ':p' === w.from), { x: a.x, y: a.y });
  Object.assign(d.junctions.find(j => j.id + ':p' === w.to), { x: b.x, y: b.y });
  return w;
}
function fixture(type = 'lamp', angle = 0, mirrored = false, key = 'a') {
  const d = M.empty(), c = M.add(d, type, 200, 200);
  c.angle = angle; if (R.dualMeter(c)) c.mirrored = mirrored;
  const at = { x: 413, y: 317 }, p = R.ports({ ...c, ...at }).find(p => p.key === key);
  const w = lead(d, p, { x: p.x + p.dx * 140, y: p.y + p.dy * 140 });
  return { d: M.validate(d), c, at, p, w };
}
test('off-grid component docking is pure, exact and preserves cable shape and budget', () => {
  const f = fixture(), before = D.encode(f.d), next = J.component(f.d, f.c.id, { x: f.at.x + 9, y: f.at.y - 7 }, 24);
  assert(next); assert.equal(D.encode(f.d), before); assert.deepEqual(next.doc.components[0], { ...f.c, ...f.at });
  assert.equal(next.doc.wires[0].from, f.p.id); assert.equal(next.snap.id, f.p.id);
  assert.deepEqual(G.route(next.doc, next.doc.wires[0]), G.route(f.d, f.d.wires[0]));
  assert.deepEqual(next.doc.cables, f.d.cables); assert.equal(next.doc.wires[0].length, f.w.length);
  for (const shape of ['free', 'smooth', 'auto']) {
    const curved = M.clone(f.d), w = curved.wires[0]; w.shape = shape;
    w.via = [{ x: f.p.x - 40, y: f.p.y + 30 }, { x: f.p.x - 100, y: f.p.y + 25 }];
    const docked = J.component(curved, f.c.id, f.at, 24); assert(docked);
    const coordinates = path => path.map(({ x, y }) => ({ x, y }));
    assert.deepEqual(coordinates(G.route(docked.doc, docked.doc.wires[0])), coordinates(G.route(curved, w)), 'original visible curve survives ' + shape);
  }
});
test('all actual ports follow rotation, mirrored meters and multi-terminal rheostats', () => {
  for (const type of ['battery', 'lamp', 'resistor', 'switch', 'rheostat', 'ammeter', 'voltmeter', 'galvanometer', 'wattmeter'])
    for (const angle of [0, 90, 180, 270]) for (const mirrored of R.dualMeter({ type }) ? [false, true] : [false]) {
      const probe = M.component(M.empty(), type, 200, 200);
      for (const port of R.ports(probe)) {
        const f = fixture(type, angle, mirrored, port.key), next = J.component(f.d, f.c.id, f.at, 10);
        assert(next, type + ' ' + angle + ' ' + port.key); assert.equal(next.doc.wires[0].from, f.p.id);
        assert.deepEqual(next.doc.components[0], { ...f.c, ...f.at });
      }
    }
});
test('only wire endpoints snap; proximity is strict and independent of zoom', () => {
  const f = fixture();
  assert.equal(J.component(f.d, f.c.id, { x: f.at.x, y: f.at.y + 24 }, 24), null);
  assert(J.component(f.d, f.c.id, { x: f.at.x, y: f.at.y + 47 }, 48));
  assert.equal(J.component(f.d, f.c.id, { x: f.at.x, y: f.at.y + 47 }, 24), null);
  const crossing = M.empty(), c = M.add(crossing, 'lamp', 200, 200), port = R.ports({ ...c, ...f.at })[0];
  lead(crossing, { x: port.x - 80, y: port.y }, { x: port.x + 80, y: port.y });
  assert.equal(J.component(crossing, c.id, f.at, 24), null);
  const other = M.add(crossing, 'resistor', f.at.x, f.at.y), connected = lead(crossing, port, { x: port.x - 140, y: port.y });
  assert(M.attach(crossing, connected.id, 'from', other.id + ':a'));
  assert.equal(J.component(crossing, c.id, f.at, 24), null, 'already owned component ports are never stolen');
});
test('multiple ends on a junction remain one net and the voltage reference follows', () => {
  const f = fixture('voltmeter'), branch = lead(f.d, f.p, { x: f.p.x - 130, y: f.p.y + 80 });
  assert(M.attach(f.d, branch.id, 'from', f.w.from)); f.d.display.reference = f.w.from;
  const next = J.component(f.d, f.c.id, f.at, 24);
  assert(next); assert.equal(next.doc.display.reference, f.p.id);
  assert(next.doc.wires.every(w => w.from === f.p.id)); assert.equal(next.snap.connections.length, 1);
  assert.deepEqual(next.snap.wires, [f.w.id, branch.id]); assert(!next.doc.junctions.some(j => j.id + ':p' === f.w.from));
});
test('two simultaneous ports close a real circuit with the correct current', () => {
  const d = M.empty(), e = M.add(d, 'battery', 160, 200), lamp = M.add(d, 'lamp', 260, 100), at = { x: 460, y: 320 };
  const ports = R.ports({ ...lamp, ...at }), ends = R.ports(e), wires = ports.map((p, i) => lead(d, p, ends[i]));
  wires.forEach((w, i) => assert(M.attach(d, w.id, 'to', ends[i].id)));
  const next = J.component(d, lamp.id, { x: at.x + 7, y: at.y + 5 }, 24);
  assert(next); assert.equal(next.snap.connections.length, 2);
  assert.deepEqual(next.doc.wires.map(w => w.from), ports.map(p => p.id));
  assert(Math.abs(S.solve(next.doc).components[lamp.id].current - .5) < 1e-8);
  const history = M.history(d); history.change(doc => Object.assign(doc, next.doc)); assert(history.undo()); assert.deepEqual(history.get(), d);
  assert(history.redo()); assert.deepEqual(history.get(), next.doc); assert(!history.canRedo());
  const restored = D.decode(D.encode(next.doc)); M.detach(restored, wires[1].id, 'from');
  const continued = J.component(restored, lamp.id, at, 24); assert(continued); assert.equal(continued.doc.wires[1].from, ports[1].id);
});
test('existing connections are retained and a short attached cable blocks unreachable docking', () => {
  const f = fixture('resistor'), c2 = M.add(f.d, 'lamp', 170, 340), old = M.connect(f.d, f.c.id + ':b', c2.id + ':a', [], 'free');
  const next = J.component(f.d, f.c.id, f.at, 24); assert(next);
  assert.deepEqual(next.doc.wires.map(w => [w.id, w.to, w.length]), f.d.wires.map(w => [w.id, w.to, w.length]));
  assert.equal(next.doc.wires.find(w => w.id === old.id).from, f.c.id + ':b'); assert.deepEqual(next.doc.components[1], c2);
  old.length = G.length(G.route(f.d, old)) + 1; const before = D.encode(f.d);
  assert.equal(J.component(f.d, f.c.id, f.at, 24), null); assert.equal(D.encode(f.d), before);
});
test('an unreachable secondary snap remains loose without stretching its budget', () => {
  const f = fixture(), b = R.ports({ ...f.c, ...f.at }).find(p => p.key === 'b');
  const w = lead(f.d, { x: b.x + 20, y: b.y }, { x: b.x + 80, y: b.y }); w.length = 60;
  const next = J.component(f.d, f.c.id, f.at, 24); assert(next); assert.equal(next.snap.connections.length, 1);
  assert.deepEqual(next.doc.wires[1], w); assert.deepEqual(next.doc.junctions.find(j => j.id + ':p' === w.from), f.d.junctions.find(j => j.id + ':p' === w.from));
});
test('document locks and activity move/wiring/read-only guards remain authoritative', () => {
  const f = fixture(), config = { initialDocument: f.d, components: { default: { move: true } } }, p = Profile.compile(config);
  const next = J.component(f.d, f.c.id, f.at, 24).doc; p.assertTransition(f.d, next);
  assert.throws(() => p.assertTransition(f.d, next, true));
  assert.throws(() => Profile.compile({ ...config, wires: false }).assertTransition(f.d, next));
  assert.throws(() => Profile.compile({ initialDocument: f.d }).assertTransition(f.d, next));
  f.d.components[0].locked = true; assert.equal(J.component(f.d, f.c.id, f.at, 24), null);
  f.d.components[0].locked = false; f.d.policy.mode = 'wiring'; assert.equal(J.component(f.d, f.c.id, f.at, 24), null);
});
console.log('Component snapping: ' + cases + ' focused groups passed.');
