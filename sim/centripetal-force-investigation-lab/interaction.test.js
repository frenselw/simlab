"use strict";
const assert = require("node:assert/strict"), M = require("./model.js"), P = require("./persistence.js"), { environment } = require("./test-support.js");
const e = environment(), c = e.c;
assert.equal(c.mode, "editable"); assert.equal(c.check(), true); assert.equal(c.state.view, "check");
assert.equal(c.back(), true); assert.equal(c.state.view, "setup");
assert.equal(c.update(s => { s.tasks[0].work[0] = 4; }), true);
assert.equal(c.update(s => { M.begin(s.tasks[0]); s.view = "collect"; }), true);
assert.equal(c.update(s => { M.record(s.tasks[0], 1.2); }), true);
assert.equal(c.navigate(0, "analyse"), true);
assert.equal(c.navigate(1, "analyse"), false, "cannot analyse without a run");
assert.equal(c.navigate(1, "setup"), true); assert.equal(c.state.tasks[0].runs[0].q.length, 1);
assert.equal(c.check(), true); assert.deepEqual(c.state.returnTo, [1, "setup"]);
assert.equal(c.navigate(0, "analyse"), true); assert.equal(c.state.fromReview, true);
assert.equal(c.update(s => { const t = s.tasks[0]; M.removeRun(t, 0); s.view = "setup"; }), true);
assert.equal(c.state.tasks[0].selected, null); assert.equal(c.state.tasks[0].current, null);
assert.equal(c.check(), true); assert.equal(c.submit(), true); assert.equal(c.mode, "review");
assert.equal(c.update(s => { s.sync = "same-omega"; }), false); assert.equal(c.navigate(2, "analyse"), true);
assert.equal(e.events.submits, 1); assert.equal(P.validate(c.state, "review").view, "review");
const reset = environment(); reset.c.update(s => { M.begin(s.tasks[0]); s.tasks[0].law = "linear"; s.tasks[1].law = "inverse"; s.sync = "same-omega"; });
assert.equal(reset.c.update(s => { s.tasks[0] = M.freshTask(); s.view = "setup"; }), true);
assert.equal(reset.c.state.tasks[0].runs.length, 0); assert.equal(reset.c.state.tasks[1].law, "inverse"); assert.equal(reset.c.state.sync, "same-omega");
console.log("centripetal interaction ok");


for(const saveFail of [false,true]) {
  const sample=environment({saveFail});let renders=0;sample.c.render=()=>{renders++;};
  sample.c.update(s=>{M.begin(s.tasks[0]);s.view="collect";});
  const before=sample.events.saves;renders=0;
  assert.equal(sample.c.update(s=>M.record(s.tasks[0],2),false),true);
  assert.equal(renders,0,"sampling does not rebuild the activity");
  assert.equal(sample.events.saves,before+1,"partial rendering still checkpoints data");
  assert.equal(sample.c.unsaved,saveFail,"save failures remain visible to the caller");
  assert.deepEqual(sample.scorm.provider().answer.tasks[0].runs[0].q,[2000],"lifecycle provider includes the latest point");
  sample.c.check();assert.ok(renders>0,"normal navigation still renders fully");
}
