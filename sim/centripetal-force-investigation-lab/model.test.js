"use strict";
const assert = require("node:assert/strict"), M = require("./model.js");
assert.equal(M.mass(0), 0.04); assert.equal(M.mass(8), 0.2);
assert.equal(M.radius(0), 0.1); assert.equal(M.radius(6), 0.4);
const cfg = [4, 2, 2, 2], reading = M.readings(cfg, 3);
assert.ok(Math.abs(reading.a / reading.b - M.radius(4) / M.radius(2)) < 1e-12);
assert.deepEqual(M.readings(cfg, -3), { ...reading, omega: -3 }, "reverse rotation changes signed angular velocity, not force magnitudes");
const t = M.freshTask(); assert.equal(M.record(t, 1), false, "no run, no data");
assert.equal(M.begin(t), true); assert.equal(M.record(t, 0), false); assert.equal(M.record(t, 0.249), false);
assert.equal(M.record(t, 0.25), true); assert.equal(M.record(t, 0.4), true, "different readings in the old slot are accepted");
assert.equal(M.record(t, 0.4), false, "exact duplicate explains why no point is added");
assert.equal(M.record(t, -0.4), true, "opposite direction is a different measurement");
assert.equal(M.record(t, 0.5), true); assert.equal(M.record(t, 6), true); assert.equal(M.record(t, M.MAX_OMEGA), true); assert.equal(M.record(t, -M.MAX_OMEGA), true); assert.equal(M.record(t, M.MAX_OMEGA + .001), false);
const saved = M.clone(t.runs[0]); M.setWork(t, 2, 8); assert.deepEqual(t.runs[0], saved, "working setup cannot rewrite recorded setup");
assert.equal(M.begin(t), true); assert.equal(M.begin(t), false, "third run needs explicit deletion");
assert.equal(M.removeRun(t, 0), true); assert.equal(t.selected, null, "delete must not silently score another run");
let spin = M.motion(); spin = M.dragMotion(spin, 3.1, 0); spin = M.dragMotion(spin, -3.1, 40);
assert.ok(spin.omega < 0 && spin.omega >= -M.MAX_OMEGA && spin.angle < 0, "clockwise crossing π stays negative and capped");
const before = spin.angle; spin = M.dragMotion(spin, -2.9, 40); assert.equal(spin.angle, before, "zero time cannot change angle");
spin = M.dragMotion(spin, -2.7, 500); assert.ok(spin.angle < before, "long event gap still follows pointer position"); assert.ok(Math.abs(spin.omega + .4/.46)<1e-12,"long event gap uses actual elapsed time without clearing release speed");
spin = M.dragMotion(spin, 0.1, 520); assert.equal(spin.warning, true, "ambiguous jump is discarded");
const coast = M.coast(spin, 0.05); assert.equal(coast.angle, spin.angle + spin.omega * 0.05);
const fast = M.dragMotion(M.dragMotion(M.motion(), 0, 0), 0.2, 40);
const slow = M.dragMotion(M.dragMotion(M.motion(), 0, 0), 0.2, 80);
assert.ok(Math.abs(fast.omega) > Math.abs(slow.omega), "faster hand motion produces faster rotation");
const many = M.freshTask(); M.begin(many);
for (let i = 0; i < M.MAX_SAMPLES; i++) assert.equal(M.record(many, -(1 + i / 1000)), true);
assert.equal(many.runs[0].q.length, 48, "recording continues beyond 24 without bin exclusion");
const retained = M.clone(many); assert.equal(M.record(many, -3), false); assert.deepEqual(many, retained, "capacity cannot discard existing measurements");
assert.equal(M.coast(fast, .1).omega, fast.omega, "released apparatus keeps angular velocity constant for manual measurement");
assert.ok(M.points('omega', many.runs[0]).every(([x,y]) => x < 0 && y > 0));
assert.equal(M.fit("quadratic", M.freshRun(cfg)).ok, false, "empty run has no fitted curve");
console.log("centripetal model ok");

for (const sign of [-1,1]) {
  let state = {...M.motion(),omega:sign*6}; const task=M.freshTask();M.begin(task);
  for(let i=0;i<1500;i++) {
    if(M.sampleReady(task.runs[0],state.omega)) M.record(task,state.omega);
    const old=state; state=M.coast(state,.01,true);
    assert.ok(Math.abs(state.omega)<=Math.abs(old.omega));
    assert.ok(sign*state.omega>=0,"braking never reverses direction");
  }
  assert.equal(state.omega,0); assert.ok(task.runs[0].q.length>=22);
  const sweep=task.runs[0].q.slice();state={...M.motion(),omega:sign*6};
  for(let i=0;i<1500;i++) {
    if(M.sampleReady(task.runs[0],state.omega)) M.record(task,state.omega);
    state=M.coast(state,.01,true);
  }
  assert.deepEqual(task.runs[0].q,sweep,"repeating an already measured sweep adds no duplicate samples");

  assert.equal(M.sampleReady(task.runs[0],0),false);
  const middle={...state,omega:sign*2};assert.equal(M.coast(middle,.1).omega,middle.omega,"release holds current speed");
  assert.equal(M.sampleReady(task.runs[0],sign*6),false,"steady or repeated speed does not refill run");
  assert.equal(M.sampleReady(task.runs[0],-sign*6),true,"reverse sweep remains available");
}


let direct=M.dragMotion(M.motion(),0,0);
direct=M.dragMotion(direct,-.8,30);
assert.ok(Math.abs(direct.angle-.8)<1e-12,"fast dragging follows the full pointer angle instead of clipping to 6*dt");
assert.equal(direct.omega,M.MAX_OMEGA,"fast hand speed can reach the expanded range");
direct=M.dragMotion(direct,-.5,60);
assert.ok(direct.omega<0,"direction reversal immediately changes the release direction");
assert.ok(Math.abs(direct.angle-.5)<1e-12);
assert.equal(M.releaseMotion(direct).omega,direct.omega,"immediate release retains the latest gesture speed");
const still=M.dragMotion(direct,-.5,360);
assert.equal(still.omega,direct.omega,"stationary event retains last moving speed");
const released=M.releaseMotion(still);
assert.equal(released.omega,direct.omega,"release retains push speed even after a short hold");
assert.ok(M.coast(released,.016).angle<released.angle,"first frame after reverse release continues moving");
assert.equal(M.sampleReady({q:[]},24),true); assert.equal(M.sampleReady({q:[]},24.001),false);
for(let q=250;q<=6000;q++) assert.equal(M.slot(q),1+Math.min(23,Math.floor((q-250)/250)),"legacy speed bins unchanged");
assert.deepEqual(M.releaseMotion(direct).history,[]);
