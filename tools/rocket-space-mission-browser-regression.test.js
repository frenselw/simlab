'use strict';
const assert=require('node:assert/strict');
const {groupNames,rocketCases,selectCases}=require('./rocket-space-mission-browser-regression');
// Audit the original complete owner inventory when changing CI registration.
const original=[
  "noRiver",
  "launchSite",
  "baseArt",
  "workshopActions",
  "cloudVisuals",
  "followCenter",
  "gestureZoom",
  "gestureHosts",
  "graphicsRecovery",
  "groundHandoff",
  "skyCoverage",
  "separationTrueScale",
  "cameraAndWarpRepairs",
  "terrainLightingRepair",
  "groundReadability",
  "terrainImpacts",
  "terrainColorSeams",
  "vacuumSeparation",
  "globalTerrainArt",
  "terrainArt",
  "terrainDepth",
  "artRefinements",
  "flightEffects",
  "mobileCockpit",
  "toolbarResize",
  "warpFullscreenControls",
  "warpControls",
  "geographyAndHud",
  "earthStyle",
  "sceneArt",
  "artPerformance",
  "artBenchmark",
  "naturalStaging",
  "completeTelemetry",
  "flightControls",
  "flightVectors",
  "layouts",
  "onboarding",
  "paletteScrolling",
  "assemblyDrags",
  "directCamera",
  "launchAndCamera",
  "ascentEnvironment",
  "workshop",
  "instrumentStyle",
  "compactDeck",
  "feedbackFixes",
  "launchOnly",
  "lifecycle"
];
assert.deepEqual(selectCases().map(test=>test.name),original,'default direct execution retains every original case and its order');
const grouped=groupNames.flatMap(group=>{
 const cases=selectCases(['--group='+group]);assert(cases.length>0);
 assert(cases.every(test=>test.group===group&&test.run.name===test.name));
 return cases.map(test=>test.name);
});
assert.equal(grouped.length,original.length,'no original case is duplicated across CI groups');
assert.equal(new Set(grouped).size,original.length);
assert.deepEqual(grouped.slice().sort(),original.slice().sort(),'CI groups jointly retain the full owner coverage');
assert.equal(rocketCases.length,49);
for(const args of [['--group'],['--group=unknown'],['--group=flight','--group=terrain'],['--group=flight','--smoke']])assert.throws(()=>selectCases(args));
console.log('Rocket CI groups preserve all 49 original cases exactly once and reject ambiguous selections.');

const T=require('../sim/rocket-space-mission-lab/test-support'),M=require('../sim/rocket-space-mission-lab/model'),P=require('../sim/rocket-space-mission-lab/parts'),D=require('../sim/rocket-space-mission-lab/persistence');
for(const engine of [0,1]){
 const pad=T.singlePad(engine);assert.equal(pad.phase,'pad');assert(P.complete(pad.craft));assert.equal(pad.flight.status,'pad');assert.equal(pad.flight.fuel[1],null);
 const restored=D.decode(T.snapshot(pad),'draft');assert.deepEqual(restored,pad);assert.equal(M.change(restored,{type:'ignite'}).flight.controls.lit,true);
}
let ascent=M.change(T.singlePad(0,0,2),{type:'ignite'});
for(let i=0;i<20000&&ascent.phase!=='ended'&&require('../sim/rocket-space-mission-lab/orbit').elements(ascent.flight.state).height<940400;i++)M.advance(ascent,.5);
assert(require('../sim/rocket-space-mission-lab/orbit').elements(ascent.flight.state).height>=940400,'complete single-stage fixture reaches the required Earth-style altitude through production physics');
console.log('Rocket single-stage fixtures round-trip, ignite legally and reach the real ascent checkpoint.');
