#!/usr/bin/env node
"use strict";

const path = require("path");
const {entryInfo, runTests,validateInventory} = require("./test-runner");
const {info,changedPaths,selectAffected} = require("./test-selection");
const {groups:dcGroups}=require('./circuit-test-groups');

const root = path.resolve(__dirname, "..");
const registeredTests = [
  "sim/circuit-workbench/transient.test.js",
  "sim/circuit-workbench/ac-source-protection.test.js",
  "sim/circuit-workbench/protection-continuation.test.js",
  "sim/circuit-workbench/protection-restart.test.js",
  "sim/circuit-workbench/protection-budget.test.js",
  "sim/circuit-workbench/session-capacity.test.js",
  "sim/circuit-workbench/connection.test.js",
  "tools/circuit-connections-browser-regression.js",
  "sim/circuit-workbench/ac-audit-regressions.test.js",
  "sim/circuit-workbench/ac-dependency-audit.test.js",
  "sim/circuit-workbench/ac-review-r3.test.js",
  "sim/circuit-workbench/ac-energy-r2.test.js",
  "sim/circuit-workbench/ac-platform.test.js",
  "sim/circuit-workbench/generator-graphics.test.js",
  "sim/circuit-workbench/field-graphics.test.js",
  "sim/circuit-workbench/ac-display.test.js",
  "sim/circuit-workbench/readout-math.test.js",
  "sim/circuit-workbench/ac-instrument-readouts.test.js",
  "sim/circuit-workbench/ac-meter-design.test.js",
  "sim/circuit-workbench/ac-meter-response.test.js",
  "sim/circuit-workbench/ac-reference.test.js",
  "sim/circuit-workbench/transformer-design.test.js",
  "sim/circuit-workbench/energy-sync.test.js",
  "sim/circuit-workbench/scope.test.js",
  "tools/circuit-ac-browser-regression.js",
  "sim/circuit-workbench/assessed-activities.test.js",
  "tools/circuit-assessed-browser-regression.js",
  "sim/circuit-workbench/core.test.js",
  "sim/circuit-workbench/wire-resistance.test.js",
  "sim/circuit-workbench/wire-current-labels.test.js",
  "sim/circuit-workbench/cable-grip.test.js",
  "sim/circuit-workbench/rotation.test.js",
  "sim/circuit-workbench/meter-motion.test.js",
  "sim/circuit-workbench/display-and-mirror.test.js",
  "sim/circuit-workbench/layout.test.js",
  "sim/circuit-workbench/labels.test.js",
  "sim/circuit-workbench/meters-and-math.test.js",
  "sim/circuit-workbench/feedback.test.js",
  "sim/circuit-workbench/flow.test.js",
  "sim/circuit-workbench/component-flow.test.js",
  "sim/circuit-workbench/winding-flow.test.js",
  "sim/circuit-workbench/textbook.test.js",
  "sim/circuit-workbench/teaching.test.js",
  "sim/circuit-workbench/document-import.test.js",
  "sim/circuit-workbench/activity-core.test.js",
  "sim/circuit-workbench/platform-core.test.js",
  "sim/circuit-workbench/component-snapping.test.js",
  "sim/circuit-workbench/quick-controls.test.js",
  "sim/circuit-workbench/relay.test.js",
  "sim/circuit-workbench/review-regressions.test.js",
  ...dcGroups.flatMap(group=>['source','package'].map(mode=>({
    file:'tools/circuit-workbench-browser-regression.js',args:['--entry='+mode,'--group='+group]
  }))),
  "tools/circuit-platform-browser-regression.js",
  "sim/newtons-third-law-fullscreen-test/generator.test.js",
  "sim/newtons-third-law-fullscreen-test/model.test.js",
  "sim/newtons-third-law-fullscreen-test/scoring.test.js",
  "sim/newtons-third-law-fullscreen-test/scene.test.js",
  "sim/newtons-third-law-fullscreen-test/feedback.test.js",
  "sim/newtons-third-law-fullscreen-test/persistence.test.js",
  "sim/newtons-third-law-fullscreen-test/lifecycle.test.js",
  "sim/shared/fullscreen.test.js",
  "tools/scorm-fullscreen-browser-regression.js",
  "tools/fullscreen-rollout-browser-regression.js",
  "tools/newtons-third-law-fullscreen-activity-regression.js",
  "tools/mobile-scroll-browser-regression.test.js",
  "sim/centre-of-mass-investigation-lab/hit-geometry.test.js",
  "sim/motion-composition-stroboscopic-lab/model.test.js",
  "sim/motion-composition-stroboscopic-lab/animation.test.js",
  "sim/motion-composition-stroboscopic-lab/scoring.test.js",
  "sim/motion-composition-stroboscopic-lab/feedback.test.js",
  "sim/motion-composition-stroboscopic-lab/persistence.test.js",
  "sim/motion-composition-stroboscopic-lab/lifecycle.test.js",
  "sim/motion-composition-stroboscopic-lab/scene.test.js",
  "tools/motion-composition-browser-regression.js",
  "sim/newtons-third-law-reaction-force-lab/generator.test.js",
  "sim/newtons-third-law-reaction-force-lab/model.test.js",
  "sim/newtons-third-law-reaction-force-lab/scoring.test.js",
  "sim/newtons-third-law-reaction-force-lab/scene.test.js",
  "sim/newtons-third-law-reaction-force-lab/feedback.test.js",
  "sim/newtons-third-law-reaction-force-lab/persistence.test.js",
  "sim/newtons-third-law-reaction-force-lab/lifecycle.test.js",
  "tools/newtons-third-law-browser-regression.js",
  "sim/newtons-second-law-investigation-lab/model.test.js",
  "sim/newtons-second-law-investigation-lab/fitting.test.js",
  "sim/newtons-second-law-investigation-lab/interpretation.test.js",
  "sim/newtons-second-law-investigation-lab/scoring.test.js",
  "sim/newtons-second-law-investigation-lab/graph.test.js",
  "sim/newtons-second-law-investigation-lab/persistence.test.js",
  "sim/newtons-second-law-investigation-lab/lifecycle.test.js",
  "tools/newtons-second-law-browser-regression.js",
  "sim/force-equilibrium-advanced-diagram-lab/generator.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/model.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/scene.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/scoring.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/persistence.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/lifecycle.test.js",
  "tools/force-equilibrium-advanced-browser-regression.js",
  "sim/force-equilibrium-diagram-lab/generator.test.js",
  "sim/force-equilibrium-diagram-lab/model.test.js",
  "sim/force-equilibrium-diagram-lab/scoring.test.js",
  "sim/force-equilibrium-diagram-lab/persistence.test.js",
  "sim/force-equilibrium-diagram-lab/lifecycle.test.js",
  "tools/force-equilibrium-browser-regression.js",
  "sim/fbd-horizontal-block/scoring.test.js",
  "sim/plane-mirror-pencil-ray-diagram/scoring.test.js",
  "sim/plane-mirror-pencil-ray-diagram/draft-save.test.js",
  "sim/displacement-distance-map-journey/scoring.test.js",
  "sim/displacement-distance-map-journey/route-coverage.test.js",
  "sim/displacement-distance-map-journey/map-persistence.test.js",
  "sim/inertial-reference-frame-road-observer/scoring.test.js",
  "sim/inertial-reference-frame-road-observer/animation.test.js",
  "sim/position-time-graph-motion-lab/scoring.test.js",
  "sim/position-time-graph-motion-lab/generator.test.js",
  "sim/position-time-graph-motion-lab/persistence.test.js",
  "sim/position-time-graph-motion-lab/lifecycle.test.js",
  "sim/position-time-graph-motion-lab/ui-runtime.test.js",
  "sim/position-time-graph-motion-lab/production-wiring.test.js",
  "sim/position-time-graph-motion-lab/pending-final.test.js",
  "tools/position-time-browser-regression.test.js",
  "sim/linear-motion-velocity-lab/motion-model.test.js",
  "sim/linear-motion-velocity-lab/scene-visuals.test.js",
  "sim/linear-motion-velocity-lab/scoring.test.js",
  "sim/linear-motion-velocity-lab/persistence.test.js",
  "sim/linear-motion-velocity-lab/accessibility.test.js",
  "sim/linear-motion-velocity-lab/ui-runtime.test.js",
  "sim/kinematics-driving-challenge/driving-model.test.js",
  "sim/kinematics-driving-challenge/level-definitions.test.js",
  "sim/kinematics-driving-challenge/scoring.test.js",
  "sim/kinematics-driving-challenge/persistence.test.js",
  "sim/kinematics-driving-challenge/scene-visuals.test.js",
  "sim/kinematics-driving-challenge/ui-runtime.test.js",
  "sim/kinematics-driving-challenge/accessibility.test.js",
  "sim/kinematics-qualitative-graph-sketching/task-definitions.test.js",
  "sim/kinematics-qualitative-graph-sketching/notation.test.js",
  "sim/kinematics-qualitative-graph-sketching/graph-model.test.js",
  "sim/kinematics-qualitative-graph-sketching/graph-analysis.test.js",
  "sim/kinematics-qualitative-graph-sketching/scoring.test.js",
  "sim/kinematics-qualitative-graph-sketching/persistence.test.js",
  "sim/kinematics-qualitative-graph-sketching/ui-runtime.test.js",
  "sim/kinematics-qualitative-graph-sketching/accessibility.test.js",
  "tools/kinematics-qualitative-graph-browser-regression.js",
  "sim/kinematics-quantitative-graph-builder/question-definitions.test.js",
  "sim/kinematics-quantitative-graph-builder/notation.test.js",
  "sim/kinematics-quantitative-graph-builder/graph-model.test.js",
  "sim/kinematics-quantitative-graph-builder/scoring.test.js",
  "sim/kinematics-quantitative-graph-builder/persistence.test.js",
  "sim/kinematics-quantitative-graph-builder/ui-runtime.test.js",
  "sim/kinematics-quantitative-graph-builder/accessibility.test.js",
  "tools/kinematics-quantitative-graph-browser-regression.js",
  "sim/free-fall-stroboscopic-measurement-lab/model.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/animation.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/scoring.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/persistence.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/persistence-matrix.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/ui-runtime.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/lifecycle.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/accessibility.test.js",
  "tools/free-fall-stroboscopic-browser-regression.js",
  "sim/centre-of-mass-investigation-lab/generator.test.js",
  "sim/centre-of-mass-investigation-lab/model.test.js",
  "sim/centre-of-mass-investigation-lab/scoring.test.js",
  "sim/centre-of-mass-investigation-lab/persistence.test.js",
  "sim/centre-of-mass-investigation-lab/lifecycle.test.js",
  "sim/centre-of-mass-investigation-lab/ui-runtime.test.js",
  "sim/centre-of-mass-investigation-lab/accessibility.test.js",
  "sim/hookes-law-spring-investigation-lab/generator.test.js",
  "sim/hookes-law-spring-investigation-lab/model.test.js",
  "sim/hookes-law-spring-investigation-lab/animation.test.js",
  "sim/hookes-law-spring-investigation-lab/scoring.test.js",
  "sim/hookes-law-spring-investigation-lab/persistence.test.js",
  "sim/hookes-law-spring-investigation-lab/lifecycle.test.js",
  "sim/hookes-law-spring-investigation-lab/accessibility.test.js",
  "sim/hookes-law-spring-investigation-lab/ui-runtime.test.js",
  "sim/hookes-law-spring-investigation-lab/delayed-feedback.test.js",
  "sim/hookes-law-spring-investigation-lab/touch-contract.test.js",
  "sim/hookes-law-spring-investigation-lab/pending-final.test.js",
  "tools/hookes-law-spring-browser-regression.test.js",
  "sim/static-kinetic-friction-investigation-lab/generator.test.js",
  "sim/static-kinetic-friction-investigation-lab/physics.test.js",
  "sim/static-kinetic-friction-investigation-lab/measurement.test.js",
  "sim/static-kinetic-friction-investigation-lab/graph-analysis.test.js",
  "sim/static-kinetic-friction-investigation-lab/scoring.test.js",
  "sim/static-kinetic-friction-investigation-lab/persistence.test.js",
  "sim/static-kinetic-friction-investigation-lab/lifecycle.test.js",
  "sim/static-kinetic-friction-investigation-lab/delayed-feedback.test.js",
  "sim/static-kinetic-friction-investigation-lab/accessibility.test.js",
  "sim/static-kinetic-friction-investigation-lab/production-wiring.test.js",
  "tools/static-kinetic-friction-browser-regression.js",
  "sim/force-composition-construction-lab/generator.test.js",
  "sim/force-composition-construction-lab/notation.test.js",
  "sim/force-composition-construction-lab/model.test.js",
  "sim/force-composition-construction-lab/scoring.test.js",
  "sim/force-composition-construction-lab/persistence.test.js",
  "sim/force-composition-construction-lab/lifecycle.test.js",
  "sim/force-composition-construction-lab/ui-runtime.test.js",
  "sim/force-composition-construction-lab/accessibility.test.js",
  "tools/force-composition-browser-regression.test.js",
  "sim/force-orthogonal-decomposition/model.test.js",
  "sim/force-orthogonal-decomposition/scoring.test.js",
  "sim/force-orthogonal-decomposition/persistence.test.js",
  "sim/force-orthogonal-decomposition/lifecycle.test.js",
  "sim/force-orthogonal-decomposition/ui-runtime.test.js",
  "sim/force-orthogonal-decomposition/accessibility.test.js",
  "tools/force-orthogonal-decomposition-browser-regression.test.js",
  "tools/centre-of-mass-browser-regression.js",
  "tools/mobile-touch-scroll.test.js",
  "sim/shared/touch-scroll.test.js",
  "sim/shared/scorm.test.js",
  "sim/shared/activity-flow.test.js",
  "tools/run-tests.test.js",
  "tools/test-runner.test.js",
  "tools/ci-environment.test.js",
  "tools/test-selection.test.js",
  "tools/circuit-test-groups.test.js",
  "tools/check-docs.test.js",
  "tools/ci-results.test.js",
  "tools/ci-plan.test.js",
  "tools/ci-github.test.js",
  "tools/ci-prepare.test.js",
  "tools/ci-job.test.js",
  "tools/ci-finish.test.js",
  "tools/circuit-protection-budget-browser-cases.test.js"
];

const extraBrowserTests = [
  "tools/position-time-browser-regression.js",
  "tools/linear-motion-browser-regression.js",
  "tools/mobile-touch-browser-regression.js",
  "tools/kinematics-driving-browser-regression.js",
  "tools/hookes-law-spring-browser-regression.js",
  "tools/force-composition-browser-regression.js"
];
const tests = [...registeredTests, ...extraBrowserTests];

function selectTests(files, shard) {
  if (!shard) return files;
  const match = /^--shard=(\d+)\/(\d+)$/.exec(shard);
  if (!match) throw new Error('Expected --shard=index/count');
  const index = Number(match[1]), count = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || index < 1 || index > count || count > files.length) throw new Error('Invalid test shard');
  return files.filter((_, position) => position % count === index - 1);
}

function parseOptions(args) {
  const options = {suite: 'all', kind: null, shard: null, list: false, reportPath: null, base:null, head:null, plan:false, affected:false};
  const seen = new Set();
  for (const arg of args) {
    const key = arg.split('=')[0];
    if (seen.has(key)) throw new Error('Duplicate option: ' + key);
    seen.add(key);
    if (arg === '--list') options.list = true;
    else if(arg==='--affected')options.affected=true;
    else if(arg==='--plan')options.plan=true;
    else if(arg.startsWith('--base=')&&arg.length>7)options.base=arg.slice(7);
    else if(arg.startsWith('--head=')&&arg.length>7)options.head=arg.slice(7);
    else if (/^--suite=(all|registered|extra)$/.test(arg)) options.suite = arg.split('=')[1];
    else if (/^--kind=(node|browser)$/.test(arg)) options.kind = arg.split('=')[1];
    else if (arg.startsWith('--shard=')) options.shard = arg;
    else if (arg.startsWith('--report=') && arg.length > 9) options.reportPath = arg.slice(9);
    else throw new Error('Unknown test option: ' + arg);
  }
  if(!!options.base!==!!options.head)throw new Error('Supply both --base and --head');
  if(options.affected&&!options.base)throw new Error('test:affected requires --base and --head');
  if(options.base&&(options.kind||options.suite!=='all'))throw new Error('Affected comparison cannot be combined with suite/kind filters');
  if(options.plan&&options.list)throw new Error('Choose either --plan or --list');
  return options;
}

function plannedTests(options) {
  let selected = options.suite === 'registered' ? registeredTests : options.suite === 'extra' ? extraBrowserTests : tests;
  if (options.kind) selected = selected.filter(t => entryInfo(t).kind === options.kind);
  return selectTests(selected, options.shard);
}

async function main(args = process.argv.slice(2)) {
  validateInventory(tests,root);
  const options = parseOptions(args);
  let selected=plannedTests(options);
  if(options.base){
    const comparison=changedPaths(root,options.base,options.head), plan=selectAffected(tests,comparison.paths);
    console.log(JSON.stringify({...comparison,mode:plan.mode,reasons:plan.reasons,packages:plan.packages,expected:plan.entries.map(e=>e.id)},null,2));
    if(options.plan)return;
    if(plan.mode==='docs'){console.log(JSON.stringify(require('./check-docs').checkDocs(comparison.paths,root)));return;}
    selected=selectTests(plan.entries,options.shard);
  }else if(options.plan)throw new Error('--plan needs explicit comparison refs');
  if (options.list) return console.log(JSON.stringify(selected.map(info), null, 2));
  const report = await runTests(selected, {root, reportPath: options.reportPath});
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
if (require.main === module) main().catch(e => {console.error(e.stack); process.exitCode = 1;});
module.exports = {tests, registeredTests, extraBrowserTests, selectTests, parseOptions, plannedTests};
