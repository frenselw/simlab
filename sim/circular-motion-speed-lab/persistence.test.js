"use strict";
const assert=require("node:assert/strict");
const P=require("./persistence.js"),S=require("./scoring.js"),M=require("./model.js");
const phases=["ready","measuring","captured","unwrapped"];
function setPhase(c,phase){c.phase=phase;c.measurement=phase==="ready"?{startAngles:null,elapsed:0}:{startAngles:[0,0],elapsed:phase==="measuring"?0:30};if(phase==="unwrapped")c.answers.vA=".14";}
for(const a of phases)for(const b of phases)for(const view of ["task","check"]){
  let s=P.initial(()=>0);setPhase(s.cases.coaxial,a);setPhase(s.cases.belt,b);s.view=view;s.activeCase="belt";
  const before=S.scoreAttempt(s).score,restored=P.decode(JSON.parse(JSON.stringify(P.encode(s))));
  assert.deepEqual(restored,s);assert.equal(S.scoreAttempt(restored).score,before);
  if(b==="ready")assert.equal(P.start(restored,"belt",[0,0]).cases.belt.phase,"measuring");
  else if(b==="measuring"){restored.cases.belt.measurement.elapsed=1;assert.equal(P.stop(restored,"belt").cases.belt.phase,"captured");}
  else if(b==="captured")assert.equal(P.unwrap(restored,"belt").cases.belt.phase,"unwrapped");
  else assert.equal(P.remeasure(restored,"belt").cases.belt.phase,"ready");
}
let s=P.initial(()=>0),belt=s.cases.belt;
belt.phase="measuring";belt.measurement={startAngles:[0,.2],elapsed:31};
assert.ok(P.decode(s),"belt marks may have different phase");
s.cases.coaxial.phase="measuring";s.cases.coaxial.measurement={startAngles:[0,.2],elapsed:1};
assert.equal(P.decode(s),null,"coaxial marks must share starting angle");
s.cases.coaxial.measurement.startAngles=[0,0];
s.cases.coaxial.answers.vA="1";assert.equal(P.decode(s),null,"numeric answer needs unwrapped measurement");
s.cases.coaxial.answers.vA="";belt.measurement.elapsed=M.MAX_TIME;
assert.ok(P.decode(s),"technical time ceiling remains a legal paused measurement");
belt.measurement.elapsed=M.MAX_TIME+1;assert.equal(P.decode(s),null);
s=P.initial(()=>0);for(const kind of M.CASES){let c=s.cases[kind];c.phase="unwrapped";c.measurement={startAngles:[0,0],elapsed:M.MAX_TIME};for(const key of S.NUMERIC)c.answers[key]="9".repeat(32);Object.assign(c.answers,S.CORRECT[kind]);}
const wrapped={version:1,activity:"circular-motion-speed-lab",kind:"pending-final",payload:{reviewJson:JSON.stringify({version:1,activity:"circular-motion-speed-lab",kind:"review",answer:s,score:100,passed:true}),score:100,maxScore:100,passed:true}};
assert.ok(new TextEncoder().encode(JSON.stringify(wrapped)).length<=4000,"worst-case pending checkpoint fits SCORM");
console.log("Circular speed persistence: 32 phase/view combinations, legal continuation and size passed");
