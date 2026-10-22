"use strict";
const assert = require("node:assert/strict"), M = require("./model.js");
assert.equal(M.mass(0), 0.04); assert.equal(M.mass(8), 0.2);
assert.equal(M.radius(0), 0.1); assert.equal(M.radius(6), 0.4);
const cfg = [4, 2, 2, 2], reading = M.readings(cfg, 3);
assert.ok(Math.abs(reading.a / reading.b - M.radius(4) / M.radius(2)) < 1e-12);
assert.deepEqual(M.readings(cfg, -3), { ...reading, omega: -3 }, "reverse rotation changes signed angular velocity, not force magnitudes");
const t = M.freshTask(); assert.equal(M.record(t, 1), false, "no run, no data");
assert.equal(M.begin(t), true); assert.equal(M.record(t, 0), false); assert.equal(M.record(t, 0.249), false);
assert.equal(M.record(t, 0.25), true); assert.equal(M.record(t, 0.4), false, "readings closer than the sampling resolution are not duplicated");
assert.equal(M.record(t, 0.4), false, "exact duplicate explains why no point is added");
assert.equal(M.record(t, -0.4), true, "opposite direction is a different measurement");
assert.equal(M.record(t, 0.5), true); assert.equal(M.record(t, 6), true); assert.equal(M.record(t, M.MAX_OMEGA), true); assert.equal(M.record(t, -M.MAX_OMEGA), true); assert.equal(M.record(t, M.MAX_OMEGA + .001), false);
const saved = M.clone(t.runs[0]); M.setWork(t, 2, 8); assert.deepEqual(t.runs[0], saved, "working setup cannot rewrite recorded setup");
assert.equal(M.begin(t), true); assert.equal(M.begin(t), false, "third run needs explicit deletion");
assert.equal(M.removeRun(t, 0), true); assert.equal(t.selected, null, "delete must not silently score another run");
let spin = M.motion(); spin = M.dragMotion(spin, 3.1, 0); spin = M.dragMotion(spin, -3.1, 40);
assert.ok(spin.omega < 0 && spin.omega >= -M.MAX_OMEGA && spin.gestureAngle < 0, "clockwise crossing π stays negative and capped");
const before = spin.gestureAngle; spin = M.dragMotion(spin, -2.9, 40); assert.equal(spin.gestureAngle, before, "zero time cannot change angle");
spin = M.dragMotion(spin, -2.7, 500); assert.ok(spin.gestureAngle < before, "long event gap still measures pointer displacement"); assert.ok(Math.abs(spin.omega + .4/.46)<1e-12,"long event gap uses actual elapsed time without clearing release speed");
spin = M.dragMotion(spin, 0.1, 520); assert.equal(spin.warning, true, "ambiguous jump is discarded");
const coast = M.coast(spin, 0.05); assert.equal(coast.angle, spin.angle + spin.omega * 0.05);
const fast = M.dragMotion(M.dragMotion(M.motion(), 0, 0), 0.2, 40);
const slow = M.dragMotion(M.dragMotion(M.motion(), 0, 0), 0.2, 80);
assert.ok(Math.abs(fast.omega) > Math.abs(slow.omega), "faster hand motion produces faster rotation");
const many = M.freshTask(); M.begin(many);
for (let i = 0; i < 80; i++) assert.ok(M.record(many, -(1 + i * .25)));
assert.equal(many.runs[0].q.length,80,"recording continues beyond the old quota");
const retained = many.runs[0].q.slice();assert.ok(M.record(many,-24));assert.ok(retained.every(q=>many.runs[0].q.includes(q)));
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
assert.ok(Math.abs(direct.gestureAngle-.8)<1e-12,"speed estimation uses the full pointer displacement");
assert.equal(direct.angle,0,"pointer input does not compete with the animation clock for position");
assert.equal(direct.omega,M.MAX_OMEGA,"fast hand speed can reach the expanded range");
direct=M.dragMotion(direct,-.5,60);
assert.ok(direct.omega<0,"direction reversal immediately changes the release direction");
assert.ok(Math.abs(direct.gestureAngle-.5)<1e-12);
assert.equal(M.releaseMotion(direct).omega,direct.omega,"immediate release retains the latest gesture speed");
const still=M.dragMotion(direct,-.5,360);
assert.equal(still.omega,direct.omega,"stationary event retains last moving speed");
const released=M.releaseMotion(still);
assert.equal(released.omega,direct.omega,"release retains push speed even after a short hold");
assert.ok(M.coast(released,.016).angle<released.angle,"first frame after reverse release continues moving");
assert.equal(M.sampleReady({q:[]},24),true); assert.equal(M.sampleReady({q:[]},24.001),false);
for(let q=250;q<=6000;q++) assert.equal(M.slot(q),1+Math.min(23,Math.floor((q-250)/250)),"legacy speed bins unchanged");
assert.deepEqual(M.releaseMotion(direct).history,[]);

const flick=M.dragMotion(M.dragMotion(M.motion(),0,0),-.6,40);
const tail=M.dragMotion(flick,-.6001,180);
assert.equal(tail.omega,flick.omega,"subpixel release jitter cannot erase flick speed");
assert.ok(Math.abs(tail.gestureAngle-.6001)<1e-12,"even tiny final displacement keeps its position");
assert.equal(M.coast(flick,.18).angle,flick.angle+flick.omega*.18,"a long frame cannot discard elapsed rotation");
assert.equal(M.coast(flick,.18).omega,flick.omega);
const stopped=M.coast({...M.motion(),omega:.18},1,true);
assert.equal(stopped.omega,0);assert.ok(Math.abs(stopped.angle-.009)<1e-12,"braking integrates only until stopped");
const reverseStop=M.coast({...M.motion(),omega:-.18},1,true);
assert.equal(reverseStop.omega,0);assert.ok(Math.abs(reverseStop.angle+.009)<1e-12);

for (const sign of [-1,1]) {
  let continuous={...M.motion(),angle:2,omega:sign*8};
  continuous=M.dragMotion(continuous,0,100);
  assert.equal(continuous.omega,sign*8,"grabbing a moving ring must not stop it");
  continuous=M.dragMotion(continuous,-sign*.4,150);
  for(let i=0;i<60;i++) continuous=M.coast(continuous,1/60);
  assert.ok(Math.abs(continuous.angle-(2+sign*8))<1e-10,"the clock keeps moving while release is delayed a second");
  const next=M.dragMotion(continuous,-sign*.8,200);
  assert.equal(next.omega,sign*8,"gesture speed excludes animation displacement");
  assert.equal(next.angle,continuous.angle,"a new input does not rewind the animated position");
  const released=M.releaseMotion(next);
  assert.equal(released.angle,next.angle);assert.equal(released.omega,next.omega);
  const jump=M.dragMotion(next,sign*2,220);
  assert.equal(jump.warning,true);assert.equal(jump.omega,next.omega,"invalid pointer jump cannot stop rotation");
}

for(const sign of [-1,1]) {
  const braking=M.coast({...M.motion(),omega:sign*6},.5,true);
  assert.ok(Math.abs(braking.omega-sign*5.1)<1e-12,"brake reduces speed by 1.8 rad/s every second");
  assert.ok(Math.abs(braking.angle-sign*2.775)<1e-12,"faster braking integrates the changing speed");
  assert.equal(M.coast(braking,.5).omega,braking.omega,"letting go holds the reduced speed");
}

for (const sign of [1, -1]) {
  const task=M.freshTask();M.begin(task);
  for(let i=0;i<48;i++) assert.ok(M.record(task,sign*(.25+i*.4),"omega"));
  const first=task.runs[0].q.slice();
  assert.equal(M.record(task,sign*24,"omega"),true,"the former direction quota no longer stops collection");
  assert.equal(M.sampleReady(task.runs[0],sign*23.5,"omega"),true);
  assert.equal(M.sampleReady(task.runs[0],-sign*24,"omega"),true,"opposite direction remains available after 48 points");
  for(let i=0;i<48;i++) assert.ok(M.record(task,-sign*(.25+i*.4),"omega"));
  assert.equal(task.runs[0].q.length,97);
  assert.ok(first.every(q=>task.runs[0].q.includes(q)),"original readings are retained");
  assert.equal(M.record(task,-sign*24,"omega"),true);
}
