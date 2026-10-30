# CI browser failures — 2026-10-30

Base: `375540b646a34f6c7355b7592d0dc4649ac783fe`.
Failures inspected: [Quality 41024564549](https://github.com/frenselw/simlab/actions/runs/41024564549) and [Quality 41036993841](https://github.com/frenselw/simlab/actions/runs/41036993841).

## Findings and changes

- The older run could not open the wire-match ZIP. The base already fixes the package path; no additional packaging-path change is needed.
- Both runs fail the fullscreen rollout because `#editor .panel` sets `overscroll-behavior:contain` with greater specificity than the shared fullscreen rule. Remove that redundant activity declaration. The editor still supplies normal-mode containment; the shared stylesheet can now supply fullscreen `none`.
- The rocket camera suite first opens a synthetic 80 km flight, and `open()` updates that same fixture's `maxHeight`. The pad case then clones it and changes altitude/status without resetting the height history. Production persistence correctly rejects a pad with `maxHeight=80000`. Build that case from a new, stopped launch fixture with zero height history. Keep persistence validation unchanged.
- The latest wire-match job receives trusted touch down/up on question 1 after the question-5 wire drag, but never receives a click. Declare `touch-action:manipulation` on question buttons to remove double-tap gesture ambiguity while retaining native pan/pinch behavior. Wait for the actual destination question and its mounted editor before continuing. This dropped click did not reproduce locally on Chrome 156; the mitigation still needs the pinned Chrome 154 CI result.
- Resolve the wire-match runner's temporary root before creating its profile/package, so macOS's `/var` alias does not cause safe cleanup to reject a task-owned directory.

Assessment risk, rubric, dependency set, phase matrix, authoritative snapshot schemas, scoring and submission contracts remain those of the existing activity plans. No new test files or registry entries are introduced. The registered browser owners retain their full default coverage and gain focused diagnostic switches.

## Executed local verification

Environment: macOS, Node `24.8.0`, Chrome `156.0.8078.76`. This is not the CI baseline of Ubuntu / Node `22.23.3` / Chrome `154.0.8037.92`.

| Command | Result and retained evidence |
|---|---|
| `npm run check:tests` | Pass: 288 entries (248 Node, 40 browser), 48 helpers, 2 manual gates |
| `npm run check` | JavaScript and manifest checks pass |
| `node tools/fullscreen-rollout-browser-regression.js` | Pass after the CSS fix: 128 source/package cases, no runtime errors; `output/playwright/fullscreen-rollout/report.json` |
| `node tools/rocket-space-mission-browser-regression.js --camera-warp-repairs-only` | Pass after the fixture fix: 4 source/package flows at desktop/phone sizes, no runtime errors; `output/playwright/rocket-space-mission-lab/report.json` |
| `node tools/circuit-wire-match-browser-regression.js` | Diagnostic baseline passes locally: 290 evidence entries across source/package, no runtime errors. The process started before the changes and built its ZIP before them; this is not post-fix coverage. `output/playwright/wire-match/evidence.json` |
| `node tools/circuit-wire-match-browser-regression.js --navigation-only` | Pass after the navigation/cleanup changes: both shuffled wire-drag fixtures, source/package, exact answer preservation across navigation and reload; 4 entries, no runtime errors. `output/playwright/wire-match-navigation/evidence.json` |
| `node sim/rocket-space-mission-lab/persistence.test.js` | Production codec, phase continuations, review compatibility and invalid-state rejection pass |
| `node sim/circuit-dc-wire-match/lifecycle.test.js` | Shared-runtime resume, submission/retry, review, legacy versions and geometry preservation pass |
| `git diff --check` | Pass |

The fullscreen runner rebuilt all SCORM ZIPs under `output/packages/` and checked source/package parity. The navigation runner rebuilt the final wire-match ZIP. Browser profiles, extracted packages and task-owned diagnostic downloads/logs are cleaned after verification. The compact original touch-failure record is retained at `output/reports/ci-browser-failure-2026-10-30.json`.

## Outstanding verification

Committed selection preview and GitHub verification are recorded below after the implementation commit. Local checks do not establish real-phone or Moodle readiness, and the local diagnostic success does not clear the pinned CI navigation failure.
