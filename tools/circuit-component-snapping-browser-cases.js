'use strict';
const assert = require('node:assert/strict');
const M = require('../sim/circuit-workbench/circuit-model'), R = require('../sim/circuit-workbench/component-registry'),
  G = require('../sim/circuit-workbench/circuit-routing');

function lead(d, a, b) {
  const w = M.addWire(d, (a.x + b.x) / 2, (a.y + b.y) / 2);
  for (const [end, p] of [['from', a], ['to', b]]) Object.assign(d.junctions.find(j => j.id + ':p' === w[end]), { x: p.x, y: p.y });
  return w;
}
function fixture(type = 'lamp') {
  const d = M.empty(); d.display.flow = 'off';
  const source = type === 'lamp' ? M.add(d, 'battery', 160, 420) : null;
  const c = M.add(d, type, 260, 190), at = { x: 433, y: 337 };
  if (type === 'voltmeter') { c.angle = 90; c.mirrored = true; }
  const ports = R.ports({ ...c, ...at }), wanted = type === 'lamp' ? ports : [ports.at(-1)];
  const wires = wanted.map((p, i) => {
    const q = source ? R.ports(source)[i] : { x: p.x + p.dx * 145, y: p.y + p.dy * 145 };
    const w = lead(d, p, q); if (source) assert(M.attach(d, w.id, 'to', q.id)); return w;
  });
  return { d: M.validate(d), c, at, wanted, wires };
}

async function componentSnappingCases(h, mode, base) {
  let width, contactId = 97000;
  const evidence = (kind, data = {}) => h.evidence.push({ mode, width, componentSnap: kind, ...data });
  async function launch(w) {
    width = w; await h.freshPage(); h.setContext('window');
    await h.send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 800, deviceScaleFactor: 1, mobile: width < 600 });
    await h.send('Emulation.setTouchEmulationEnabled', { enabled: width < 600, maxTouchPoints: 2 });
    await h.send('Page.navigate', { url: base + '/circuit-workbench/index.html' }); await h.ready();
    await h.inside(`window.__snapEvents=[];document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-circuit-id=surface]'))__snapEvents.push({trusted:e.isTrusted,pointer:e.pointerType,kind:e.target.meta?.kind});},true);`);
  }
  async function sample() {
    return h.inside(`(()=>{const p=document.querySelector('[data-circuit-id=preview]'),n=document.querySelector('[data-circuit-id=canvasNotice]');return{document:CircuitWorkbench.exportDocument(),interaction:CircuitWorkbench.getInteraction(),preview:!p.hidden,notice:n.hidden?null:n.innerText,rings:[...document.querySelectorAll('[data-snap-target]')].map(e=>({id:e.dataset.snapTarget,x:+e.getAttribute('cx'),y:+e.getAttribute('cy')})),changes:window.__snapChanges};})()`);
  }
  async function gripPoint(id) {
    return h.inside(`(()=>{const e=document.querySelector('[data-hit="body:${id}"]'),r=e.getBoundingClientRect();for(const fx of [.5,.3,.7])for(const fy of [.5,.25,.75]){const x=r.left+r.width*fx,y=r.top+r.height*fy;if(document.elementFromPoint(x,y)===e)return{x,y};}throw new Error('No exposed component body: ${id}');})()`);
  }
  async function start(p) {
    const id = contactId++;
    if (width < 600) await h.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id, radiusX: 2, radiusY: 2, force: 1 }] });
    else await h.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', buttons: 1, clickCount: 1 });
    await h.delay(20); return { id, start: p, last: p };
  }
  async function move(grip, to) {
    const old = grip.last;
    for (let i = 1; i <= 6; i++) {
      const p = { x: old.x + (to.x - old.x) * i / 6, y: old.y + (to.y - old.y) * i / 6 };
      if (width < 600) await h.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: grip.id, radiusX: 2, radiusY: 2, force: 1 }] });
      else await h.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, button: 'left', buttons: 1 });
      await h.delay(15);
    }
    grip.last = to; await h.delay(20); return sample();
  }
  async function finish(grip, cancel = false) {
    if (width < 600) await h.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    else {
      if (cancel) await h.key('Escape', 'Escape', 27);
      await h.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...grip.last, button: 'left', buttons: 0, clickCount: 1 });
    }
    await h.delay(40); return sample();
  }
  async function destination(f) {
    const p = await gripPoint(f.c.id), camera = await h.inside('CircuitWorkbench.getInteraction().camera');
    return { p, camera, to: { x: p.x + (f.at.x + 8 - f.c.x) * camera.scale, y: p.y + (f.at.y + 5 - f.c.y) * camera.scale } };
  }
  async function prepare(f) {
    await h.load(f.d); await h.inside('window.__snapChanges=0;window.__stopSnapChanges?.();window.__stopSnapChanges=CircuitWorkbench.onChange(()=>__snapChanges++);');
    return h.save();
  }
  function heldChecks(held, before, dest, f) {
    assert.equal(held.document, before); assert.equal(held.interaction.dragging, 'body');
    assert.equal(held.changes, 0); assert.deepEqual(held.interaction.camera, dest.camera);
    assert(!held.preview, 'component movement does not open a magnifier');
    assert.equal(held.rings.length, f.wanted.length); assert(held.notice?.startsWith('元件將接線：'));
    for (const p of f.wanted) {
      const ring = held.rings.find(r => r.id === p.id); assert(ring); assert(Math.hypot(ring.x - p.x, ring.y - p.y) < .001);
    }
  }
  for (const w of [1280, 390]) {
    console.log(`${mode}: component-body snap ${w}px`); await launch(w);
    for (const type of ['lamp', 'voltmeter', 'rheostat']) {
      const f = fixture(type), before = await prepare(f), dest = await destination(f), grip = await start(dest.p);
      const held = await move(grip, dest.to); heldChecks(held, before, dest, f);
      if (type === 'lamp') {
        const away = await move(grip, grip.start); assert.equal(away.rings.length, 0); assert.equal(away.interaction.snap, null); assert.equal(away.document, before);
        heldChecks(await move(grip, dest.to), before, dest, f);
        await h.screenshot(`${mode}-component-snap-${w}.png`);
      }
      const released = await finish(grip), d = await h.doc();
      assert.equal(released.changes, 1); assert.equal(released.interaction.dragging, null); assert.equal(released.rings.length, 0);
      const placed = d.components.find(c => c.id === f.c.id);
      assert(Math.hypot(placed.x - f.at.x, placed.y - f.at.y) < 1e-7);
      assert.deepEqual({ ...placed, x: f.c.x, y: f.c.y }, f.c);
      f.wires.forEach((old, i) => {
        const wire = d.wires.find(w => w.id === old.id); assert.equal(wire.from, f.wanted[i].id); assert.equal(wire.to, old.to); assert.equal(wire.length, old.length);
        assert(G.length(G.route(d, wire)) <= wire.length + .05);
      });
      if (type === 'lamp') assert(Math.abs((await h.inside('CircuitWorkbench.getAnalysis()')).components[f.c.id].current - .5) < 1e-8);
      const committed = await h.save(); await h.click('#undo'); assert.equal(await h.save(), before); await h.click('#redo'); assert.equal(await h.save(), committed);
      await h.inside(`CircuitWorkbench.loadDocument(${JSON.stringify(committed)})`);
      assert.equal(await h.save(), committed);
      assert(await h.inside(`CircuitWorkbench.execute({type:'detach',id:${JSON.stringify(f.wires[0].id)},end:'from'})`));
      // A saved answer can continue with the original wire-grip route as well.
      const endpoint = await h.point(`[data-hit="wireend:${f.wires[0].id}:from"]`), free = await start(endpoint);
      await move(free, { x: endpoint.x + 30, y: endpoint.y + 30 }); await finish(free);
      assert.notEqual((await h.doc()).wires.find(w => w.id === f.wires[0].id).from, f.wanted[0].id);
      evidence('attach-and-continue', { type, angle: f.c.angle, mirrored: !!f.c.mirrored, ports: f.wanted.map(p => p.id), trusted: true, preview: false, changes: 1, undoRedo: true });
    }
    const f = fixture(), before = await prepare(f), dest = await destination(f), grip = await start(dest.p);
    heldChecks(await move(grip, dest.to), before, dest, f); const cancelled = await finish(grip, true);
    assert.equal(cancelled.document, before); assert.equal(cancelled.changes, 0); assert.equal(cancelled.rings.length, 0); assert.equal(cancelled.interaction.dragging, null);
    assert.deepEqual(cancelled.interaction.camera, dest.camera); evidence('cancel', { input: width < 600 ? 'touchCancel' : 'Escape' });
    if (width < 600) {
      const g = await start(dest.p); heldChecks(await move(g, dest.to), before, dest, f);
      const second = { x: g.last.x - 65, y: g.last.y + 35, id: contactId++, radiusX: 2, radiusY: 2, force: 1 };
      await h.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...g.last, id: g.id, radiusX: 2, radiusY: 2, force: 1 }, second] });
      await h.delay(30); const navigation = await sample(); assert.equal(navigation.interaction.dragging, 'camera');
      assert.equal(navigation.document, before); assert.equal(navigation.rings.length, 0); assert.equal(navigation.changes, 0);
      await h.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await h.delay(30);
      assert.equal(await h.save(), before); evidence('second-finger-cancels-snap');
    }
    await h.inside('CircuitWorkbench.setReadOnly(true)'); const blocked = await start(await gripPoint(f.c.id)); await move(blocked, dest.to); await finish(blocked);
    assert.equal(await h.save(), before); assert.equal((await sample()).rings.length, 0); evidence('read-only');
    await h.inside('CircuitWorkbench.setReadOnly(false)');
    const student = { idPrefix: '', initialDocument: f.d, components: { default: { move: true } } };
    await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),${JSON.stringify(student)});})()`);
    await h.delay(100);
    const studentDest = await destination(f), studentGrip = await start(studentDest.p);
    const studentHeld = await move(studentGrip, studentDest.to); assert.equal(studentHeld.rings.length, 2, JSON.stringify(studentHeld)); await finish(studentGrip);
    assert((await h.doc()).wires.every(w => w.from.startsWith(f.c.id + ':')));
    assert(!(await h.inside('Boolean(document.querySelector("[data-circuit-id=settings]"))'))); evidence('student-movable');
    for (const config of [{ ...student, components: {} }, { ...student, wires: false }]) {
      await h.inside(`(async()=>{CircuitWorkbench.destroy();window.CircuitWorkbench=await CircuitEditor.mount(document.getElementById('app'),${JSON.stringify(config)});})()`);
      await h.delay(100);
      const initial = await h.save(), target = await destination(f), g = await start(target.p); const preview = await move(g, target.to); await finish(g);
      assert.equal(preview.rings.length, 0); assert.deepEqual((await h.doc()).wires, f.d.wires);
      if (config.wires !== false) assert.equal(await h.save(), initial); else assert.notEqual(await h.save(), initial, 'no-wiring still permits ordinary component moves');
      evidence(config.wires === false ? 'wiring-disabled' : 'student-fixed');
    }
    const events = await h.inside('__snapEvents'); assert(events.length > 0); assert(events.every(e => e.trusted));
    assert(events.some(e => e.kind === 'body' && e.pointer === (width < 600 ? 'touch' : 'mouse')));
    assert(await h.inside('document.documentElement.scrollWidth<=innerWidth')); evidence('trusted-input', { contacts: events.length });
  }
}
module.exports = { componentSnappingCases };
