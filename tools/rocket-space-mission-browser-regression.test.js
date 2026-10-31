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
