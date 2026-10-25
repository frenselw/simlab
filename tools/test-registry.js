'use strict';
const fs=require('node:fs'),path=require('node:path');
const {entryInfo,validateInventory}=require('./test-runner');
const {groups:dcGroups}=require('./circuit-test-groups');
const root=path.resolve(__dirname,'..');

const registeredTests = [
  'sim/rocket-space-mission-lab/art.test.js',
  'sim/rocket-space-mission-lab/model.test.js',
  'sim/rocket-space-mission-lab/orbit.test.js',
  'sim/rocket-space-mission-lab/scoring.test.js',
  'sim/rocket-space-mission-lab/persistence.test.js',
  'sim/rocket-space-mission-lab/interaction.test.js',
  'sim/rocket-space-mission-lab/lifecycle.test.js',
  {file:'tools/rocket-space-mission-browser-regression.js',kind:'browser',scope:'rocket-space-mission-lab'},
  'sim/centripetal-force-investigation-lab/model.test.js',
  'sim/centripetal-force-investigation-lab/scoring.test.js',
  'sim/centripetal-force-investigation-lab/persistence.test.js',
  'sim/centripetal-force-investigation-lab/interaction.test.js',
  'sim/centripetal-force-investigation-lab/lifecycle.test.js',
  {file:'tools/centripetal-force-investigation-browser-regression.js',kind:'browser',scope:'centripetal-force-investigation-lab'},
  'sim/centripetal-force-source-lab/model.test.js',
  'sim/centripetal-force-source-lab/scene.test.js',
  'sim/centripetal-force-source-lab/notation.test.js',
  'sim/centripetal-force-source-lab/scoring.test.js',
  'sim/centripetal-force-source-lab/persistence.test.js',
  'sim/centripetal-force-source-lab/interaction.test.js',
  'sim/centripetal-force-source-lab/lifecycle.test.js',
  {file:'tools/centripetal-force-source-browser-regression.js',kind:'browser',scope:'centripetal-force-source-lab'},
  'sim/circular-motion-vector-lab/model.test.js',
  'sim/circular-motion-vector-lab/presentation.test.js',
  'sim/circular-motion-vector-lab/scoring.test.js',
  'sim/circular-motion-vector-lab/persistence.test.js',
  'sim/circular-motion-vector-lab/lifecycle.test.js',
  {file:'tools/circular-motion-vector-browser-regression.js',kind:'browser',scope:'circular-motion-vector-lab'},
  'sim/horizontal-projectile-lab/model.test.js',
  'sim/horizontal-projectile-lab/scoring.test.js',
  'sim/horizontal-projectile-lab/persistence.test.js',
  'sim/horizontal-projectile-lab/lifecycle.test.js',
  {file:'tools/horizontal-projectile-browser-regression.js',kind:'browser',scope:'horizontal-projectile-lab'},
  'sim/circuit-workbench/audit-followup.test.js',
  'sim/circuit-workbench/household-connections.test.js',
  'sim/circuit-workbench/household-model.test.js',
  'sim/circuit-workbench/household-state.test.js',
  'sim/circuit-household-workbench/presets.test.js',
  {file:'tools/circuit-household-browser-regression.js',kind:'browser',scope:'circuit-family'},
  "sim/circuit-workbench/transient.test.js",
  "sim/circuit-workbench/ac-source-protection.test.js",
  "sim/circuit-workbench/protection-continuation.test.js",
  "sim/circuit-workbench/protection-restart.test.js",
  "sim/circuit-workbench/protection-budget.test.js",
  "sim/circuit-workbench/session-capacity.test.js",
  "sim/circuit-workbench/connection.test.js",
  {file:"tools/circuit-connections-browser-regression.js",kind:'browser',scope:"circuit-family"},
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
  {file:"tools/circuit-ac-browser-regression.js",kind:'browser',scope:"circuit-family"},
  "sim/circuit-workbench/assessed-activities.test.js",
  {file:"tools/circuit-assessed-browser-regression.js",kind:'browser',scope:"circuit-family"},
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
    file:'tools/circuit-workbench-browser-regression.js',kind:'browser',scope:'circuit-family',args:['--entry='+mode,'--group='+group]
  }))),
  {file:"tools/circuit-platform-browser-regression.js",kind:'browser',scope:"circuit-family"},
  "sim/newtons-third-law-fullscreen-test/generator.test.js",
  "sim/newtons-third-law-fullscreen-test/model.test.js",
  "sim/newtons-third-law-fullscreen-test/scoring.test.js",
  "sim/newtons-third-law-fullscreen-test/scene.test.js",
  "sim/newtons-third-law-fullscreen-test/feedback.test.js",
  "sim/newtons-third-law-fullscreen-test/persistence.test.js",
  "sim/newtons-third-law-fullscreen-test/lifecycle.test.js",
  "sim/shared/fullscreen.test.js",
  {file:"tools/scorm-fullscreen-browser-regression.js",kind:'browser',scope:"shared-fullscreen"},
  {file:"tools/fullscreen-rollout-browser-regression.js",kind:'browser',scope:"shared-fullscreen"},
  {file:"tools/newtons-third-law-fullscreen-activity-regression.js",kind:'browser',scope:"newtons-third-law-fullscreen-test"},
  "tools/mobile-scroll-browser-regression.test.js",
  "sim/centre-of-mass-investigation-lab/hit-geometry.test.js",
  "sim/motion-composition-stroboscopic-lab/model.test.js",
  "sim/motion-composition-stroboscopic-lab/animation.test.js",
  "sim/motion-composition-stroboscopic-lab/scoring.test.js",
  "sim/motion-composition-stroboscopic-lab/feedback.test.js",
  "sim/motion-composition-stroboscopic-lab/persistence.test.js",
  "sim/motion-composition-stroboscopic-lab/lifecycle.test.js",
  "sim/motion-composition-stroboscopic-lab/scene.test.js",
  {file:"tools/motion-composition-browser-regression.js",kind:'browser',scope:"motion-composition-stroboscopic-lab"},
  "sim/newtons-third-law-reaction-force-lab/generator.test.js",
  "sim/newtons-third-law-reaction-force-lab/model.test.js",
  "sim/newtons-third-law-reaction-force-lab/scoring.test.js",
  "sim/newtons-third-law-reaction-force-lab/scene.test.js",
  "sim/newtons-third-law-reaction-force-lab/feedback.test.js",
  "sim/newtons-third-law-reaction-force-lab/persistence.test.js",
  "sim/newtons-third-law-reaction-force-lab/lifecycle.test.js",
  {file:"tools/newtons-third-law-browser-regression.js",kind:'browser',scope:"newtons-third-law-reaction-force-lab"},
  "sim/newtons-second-law-investigation-lab/model.test.js",
  "sim/newtons-second-law-investigation-lab/fitting.test.js",
  "sim/newtons-second-law-investigation-lab/interpretation.test.js",
  "sim/newtons-second-law-investigation-lab/scoring.test.js",
  "sim/newtons-second-law-investigation-lab/graph.test.js",
  "sim/newtons-second-law-investigation-lab/persistence.test.js",
  "sim/newtons-second-law-investigation-lab/lifecycle.test.js",
  {file:"tools/newtons-second-law-browser-regression.js",kind:'browser',scope:"newtons-second-law-investigation-lab"},
  "sim/force-equilibrium-advanced-diagram-lab/generator.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/model.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/scene.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/scoring.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/persistence.test.js",
  "sim/force-equilibrium-advanced-diagram-lab/lifecycle.test.js",
  {file:"tools/force-equilibrium-advanced-browser-regression.js",kind:'browser',scope:"force-equilibrium-advanced-diagram-lab"},
  "sim/force-equilibrium-diagram-lab/generator.test.js",
  "sim/force-equilibrium-diagram-lab/model.test.js",
  "sim/force-equilibrium-diagram-lab/scoring.test.js",
  "sim/force-equilibrium-diagram-lab/persistence.test.js",
  "sim/force-equilibrium-diagram-lab/lifecycle.test.js",
  {file:"tools/force-equilibrium-browser-regression.js",kind:'browser',scope:"force-equilibrium-diagram-lab"},
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
  {file:'tools/position-time-browser-regression.test.js',kind:'node',scope:'position-time-graph-motion-lab'},
  "sim/circular-motion-speed-lab/model.test.js",
  "sim/circular-motion-speed-lab/scoring.test.js",
  "sim/circular-motion-speed-lab/persistence.test.js",
  "sim/circular-motion-speed-lab/ui-runtime.test.js",
  {file:"tools/circular-motion-speed-browser-regression.js",kind:"browser",scope:"circular-motion-speed-lab"},
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
  {file:"tools/kinematics-qualitative-graph-browser-regression.js",kind:'browser',scope:"kinematics-qualitative-graph-sketching"},
  "sim/kinematics-quantitative-graph-builder/question-definitions.test.js",
  "sim/kinematics-quantitative-graph-builder/notation.test.js",
  "sim/kinematics-quantitative-graph-builder/graph-model.test.js",
  "sim/kinematics-quantitative-graph-builder/scoring.test.js",
  "sim/kinematics-quantitative-graph-builder/persistence.test.js",
  "sim/kinematics-quantitative-graph-builder/ui-runtime.test.js",
  "sim/kinematics-quantitative-graph-builder/accessibility.test.js",
  {file:"tools/kinematics-quantitative-graph-browser-regression.js",kind:'browser',scope:"kinematics-quantitative-graph-builder"},
  "sim/free-fall-stroboscopic-measurement-lab/model.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/animation.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/scoring.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/persistence.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/persistence-matrix.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/ui-runtime.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/lifecycle.test.js",
  "sim/free-fall-stroboscopic-measurement-lab/accessibility.test.js",
  {file:"tools/free-fall-stroboscopic-browser-regression.js",kind:'browser',scope:"free-fall-stroboscopic-measurement-lab"},
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
  {file:'tools/hookes-law-spring-browser-regression.test.js',kind:'node',scope:'hookes-law-spring-investigation-lab'},
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
  {file:"tools/static-kinetic-friction-browser-regression.js",kind:'browser',scope:"static-kinetic-friction-investigation-lab"},
  "sim/force-composition-construction-lab/generator.test.js",
  "sim/force-composition-construction-lab/notation.test.js",
  "sim/force-composition-construction-lab/model.test.js",
  "sim/force-composition-construction-lab/scoring.test.js",
  "sim/force-composition-construction-lab/persistence.test.js",
  "sim/force-composition-construction-lab/lifecycle.test.js",
  "sim/force-composition-construction-lab/ui-runtime.test.js",
  "sim/force-composition-construction-lab/accessibility.test.js",
  {file:'tools/force-composition-browser-regression.test.js',kind:'node',scope:'force-composition-construction-lab'},
  "sim/force-orthogonal-decomposition/model.test.js",
  "sim/force-orthogonal-decomposition/scoring.test.js",
  "sim/force-orthogonal-decomposition/persistence.test.js",
  "sim/force-orthogonal-decomposition/lifecycle.test.js",
  "sim/force-orthogonal-decomposition/ui-runtime.test.js",
  "sim/force-orthogonal-decomposition/accessibility.test.js",
  "tools/force-orthogonal-decomposition-browser-regression.test.js",
  {file:"tools/centre-of-mass-browser-regression.js",kind:'browser',scope:"centre-of-mass-investigation-lab"},
  "tools/mobile-touch-scroll.test.js",
  "sim/shared/touch-scroll.test.js",
  "sim/shared/scorm.test.js",
  "sim/shared/activity-flow.test.js",
  "tools/run-tests.test.js",
  "tools/test-registry.test.js",
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

const extraBrowserEntries = [
  {file:"tools/position-time-browser-regression.js",kind:'browser',scope:"position-time-graph-motion-lab"},
  {file:"tools/linear-motion-browser-regression.js",kind:'browser',scope:"linear-motion-velocity-lab"},
  {file:"tools/mobile-touch-browser-regression.js",kind:'browser',scope:"shared-touch"},
  {file:"tools/kinematics-driving-browser-regression.js",kind:'browser',scope:"kinematics-driving-challenge"},
  {file:"tools/hookes-law-spring-browser-regression.js",kind:'browser',scope:"hookes-law-spring-investigation-lab"},
  {file:"tools/force-composition-browser-regression.js",kind:'browser',scope:"force-composition-construction-lab"}
];
const tests = [...registeredTests, ...extraBrowserEntries];

const extraBrowserTests=extraBrowserEntries.map(e=>e.file);

const helpers = [
  {"file":"tools/circuit-ac-audit-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-ac-review-r3-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-activity-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-cable-handling-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-camera-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-canvas-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js","tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-component-flow-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-component-snapping-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-dependency-audit-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-discard-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-display-mirror-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js","tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-drag-playback-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-energy-r2-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-audit-browser-cases.js"]},
  {"file":"tools/circuit-feedback-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-field-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-flow-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-foundation-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-generator-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-help-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js","tools/circuit-ac-browser-regression.js","tools/circuit-household-browser-regression.js"]},
  {"file":"tools/circuit-instrument-readouts-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-label-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-meter-design-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js","tools/circuit-meter-response-browser-cases.js"]},
  {"file":"tools/circuit-meter-response-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-meter-snapping-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-cable-handling-browser-cases.js","tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-meters-math-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-display-mirror-browser-cases.js","tools/circuit-needle-browser-cases.js","tools/circuit-rotation-browser-cases.js","tools/circuit-settings-browser-cases.js","tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-needle-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-palette-drag-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-platform-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-preset-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-protection-budget-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-quick-controls-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js","tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-quick-response-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-readout-animation-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-readout-math-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-relay-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-review-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-rotation-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-scope-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-settings-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-audit-browser-cases.js","tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-source-protection-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-teaching-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-textbook-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-transformer-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-winding-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-ac-browser-regression.js"]},
  {"file":"tools/circuit-wire-current-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-wire-grip-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-wire-inspector-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]},
  {"file":"tools/circuit-wire-resistance-browser-cases.js","scope":"circuit-family","consumers":["tools/circuit-workbench-browser-regression.js"]}
];

const manualBrowserTests = [
  {file:'tools/mobile-scroll-browser-regression.js',scope:'shared-touch',reason:'Separate T0-T3 deployment host/phase matrix; see production guide.'},
  {file:'tools/force-orthogonal-decomposition-browser-regression.sh',scope:'force-orthogonal-decomposition',reason:'Separate Git Bash / Playwright deployment matrix; see production guide.'}
];

const assetLists = [
  {scope:'circuit-workbench',file:'sim/circuit-workbench/assets.json'},
  {scope:'circuit-ac-workbench',file:'sim/circuit-ac-workbench/assets.json'},
  {scope:'circuit-household-workbench',file:'sim/circuit-household-workbench/assets.json'}
];

function info(test) {
  const entry=entryInfo(test),registered=tests.find(t=>entryInfo(t).id===entry.id);
  entry.scope=test.scope||registered?.scope||(entry.file.startsWith('sim/')?entry.file.split('/')[1]:entry.kind==='node'?'tools':null);
  if(!entry.scope)throw Error('Missing test scope: '+entry.file);
  return entry;
}

function validateRegistry({entries=tests,helperEntries=helpers,manualEntries=manualBrowserTests,lists=assetLists,directory=root}={}) {
  const checkFile=file=>{
    if(typeof file!=='string'||! /^(sim|tools)\//.test(file)||path.posix.normalize(file)!==file||file.includes('\\')||!fs.statSync(path.join(directory,file)).isFile())throw Error('Invalid registry file: '+file);
  };
  const checkScope=(scope,kind)=>{
    if(typeof scope!=='string'||!scope||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scope)||
      (scope==='tools'?kind!=='node':scope!=='circuit-family'&&!scope.startsWith('shared-')&&!fs.existsSync(path.join(directory,'sim',scope))))throw Error('Invalid test scope: '+scope);
  };
  const described=entries.map(test=>{
    const entry=entryInfo(test);
    entry.scope=typeof test==='object'?test.scope:null;
    entry.scope ||= entry.file.startsWith('sim/')?entry.file.split('/')[1]:entry.kind==='node'?'tools':null;
    checkFile(entry.file);checkScope(entry.scope,entry.kind);
    if(!entry.file.endsWith('.js')||!['node','browser'].includes(entry.kind)||(entry.kind==='browser'&&test.kind!=='browser')||!Array.isArray(entry.args)||entry.args.some(a=>typeof a!=='string')||
      (!entry.file.endsWith('.test.js')&&entry.kind==='node'))throw Error('Invalid test kind/arguments: '+entry.file);
    return entry;
  });
  const formalFiles=new Set(described.map(e=>e.file)),excluded=new Set();
  for(const entry of [...helperEntries,...manualEntries]){
    checkFile(entry.file);checkScope(entry.scope,'browser');
    if(formalFiles.has(entry.file)||excluded.has(entry.file))throw Error('Duplicate test classification: '+entry.file);
    excluded.add(entry.file);
  }
  for(const entry of manualEntries)if(typeof entry.reason!=='string'||!entry.reason.trim()||entry.file.endsWith('.test.js'))throw Error('Manual browser test requires a reason: '+entry.file);
  const helperMap=new Map(helperEntries.map(e=>[e.file,e]));
  const imports=consumer=>[...fs.readFileSync(path.join(directory,consumer),'utf8').matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
    .map(m=>path.posix.normalize(path.posix.join(path.posix.dirname(consumer),m[1].endsWith('.js')?m[1]:m[1]+'.js')));
  const reachesBrowser=(file,seen=new Set())=>{
    if(described.some(e=>e.file===file&&e.kind==='browser'))return true;
    if(seen.has(file))return false;
    return (helperMap.get(file)?.consumers||[]).some(consumer=>reachesBrowser(consumer,new Set([...seen,file])));
  };
  for(const entry of helperEntries){
    if(!entry.file.endsWith('-browser-cases.js'))throw Error('Invalid browser helper filename: '+entry.file);
    if(!Array.isArray(entry.consumers)||!entry.consumers.length||new Set(entry.consumers).size!==entry.consumers.length)throw Error('Browser helper requires consumers: '+entry.file);
    for(const consumer of entry.consumers){
      const owner=described.find(e=>e.file===consumer&&e.kind==='browser')||helperMap.get(consumer);
      if(!owner||(!entry.scope.startsWith('shared-')&&owner.scope!==entry.scope))throw Error('Unmapped browser helper consumer: '+consumer);
      if(!imports(consumer).includes(entry.file))throw Error('Browser helper is not imported by consumer: '+entry.file+' -> '+consumer);
    }
    if(!reachesBrowser(entry.file))throw Error('Browser helper has no formal browser entry: '+entry.file);
  }
  for(const consumer of new Set([...described.filter(e=>e.kind==='browser').map(e=>e.file),...helperMap.keys()])){
    for(const file of imports(consumer).filter(f=>f.endsWith('-browser-cases.js'))){
      if(!helperMap.get(file)?.consumers.includes(consumer))throw Error('Unregistered browser helper import: '+file+' -> '+consumer);
    }
  }
  const listFiles=new Set();
  for(const list of lists){
    checkFile(list.file);checkScope(list.scope,'browser');
    if(listFiles.has(list.file))throw Error('Duplicate runtime asset list: '+list.file);
    listFiles.add(list.file);
    const files=JSON.parse(fs.readFileSync(path.join(directory,list.file),'utf8')).files;
    if(!Array.isArray(files)||!files.length)throw Error('Empty runtime asset list: '+list.file);
    for(const file of files)checkFile('sim/'+file);
  }
  validateInventory(entries,directory,[...excluded]);
  return {entries:described.length,node:described.filter(e=>e.kind==='node').length,browser:described.filter(e=>e.kind==='browser').length,helpers:helperEntries.length,manual:manualEntries.length};
}

if(require.main===module)console.log(JSON.stringify(validateRegistry(),null,2));
module.exports={tests,registeredTests,extraBrowserTests,helpers,manualBrowserTests,assetLists,info,validateRegistry};
