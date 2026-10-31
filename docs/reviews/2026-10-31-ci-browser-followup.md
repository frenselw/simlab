# CI browser follow-up — 2026-10-31

Starting head: `32e3083751d0e2fd1c9da84ca63be243f106a4bb`, [PR #16](https://github.com/frenselw/simlab/pull/16).
Inspected both the [PR run](https://github.com/frenselw/simlab/actions/runs/41040989010) and [push run](https://github.com/frenselw/simlab/actions/runs/41040982060), including failures present in only one run. The fullscreen and pad-fixture fixes passed their previous failure points; the previous touch-action mitigation did not clear the navigation failure.

## Decisions and failure evidence

- **Trusted touch input:** the shared helper previously dispatched touch start/end back-to-back and treated CDP acknowledgement as input delivery. Wait for the renderer's native pointerdown and hold the same tap for 50 ms before release. Keep the single press/release policy and every trusted down/up/click assertion; there are no click retries or JavaScript click fallbacks. An asynchronous pointerdown unit fixture covers the delivery gap. The exact Linux/Chrome 154 navigation outcome remains a required CI check.
- **Rocket pinch:** the push run failed its 1.5× assertion while the PR run passed it and continued farther. Wait for both native presses and both final native move positions before observing zoom. Retain the 1.5× tolerance, interrupted-gesture, reverse-from-limit, yaw/pitch and immutable-answer assertions. Failure messages now identify viewport, interruption and camera state.
- **Rocket terrain:** reproduced the PR's daylight mean `23.11158` / p95 `39` locally, with the original thresholds unchanged. Regional vertex albedo agrees numerically with the baked coarse field (maximum sampled error below `1.5e-8`). Forcing coarse detail still failed, so a detail-cache change was not the cause. Captured buffers and isolated renders showed that clouds occlude regional and coarse ground differently. Exclude only clouds from the controlled ground-color comparison. Full production altitude frames still include clouds; daylight/night thresholds and geometry budgets are unchanged. Final `draw()` restores the normal scene.
- **Centripetal capacity:** one push job failed with 107 saved readings versus a 106-reading baseline. The baseline was taken while production sampling was still running, before the analysis button paused it. Take the baseline after that real pause, then compare the entire submitted readings array rather than only its length. Do not stop or change learner sampling in production.

No production physics, scoring, persistence, phase matrix, rubric, runtime dependencies or manifest contents change in this follow-up. Activity assessment decisions remain in their existing plans. No new formal test files or registrations are needed; all changes stay in registered owners. New focused switches retain source and extracted-package checks and do not narrow default CI coverage.

## Validation plan and evidence

Local environment: macOS, Node 24.8.0, Chrome 156.0.8078.76. GitHub's Ubuntu / Node 22.23.3 / Chrome 154.0.8037.92 remains the authoritative CI environment.

- `node tools/position-time-browser-regression.test.js`: pass, including delayed native delivery and rejection of missing/untrusted/wrong-target events without retries.
- `node tools/rocket-space-mission-browser-regression.js --terrain-color-seams-only`: pass, four source/package desktop/phone flows with original daylight/night thresholds; `output/reports/ci-followup-rocket-terrain.json`.
- `node tools/centripetal-force-investigation-browser-regression.js --directional-capacity-only`: pass for source/package, with full-array preservation after production pause.
- `node tools/position-time-browser-regression.js`: pass; owning browser includes desktop, mobile, embedded interaction, persistence and trusted-input cases.
- Registry: pass, 288 entries (248 Node / 40 browser), 48 helpers and 2 manual gates. JavaScript/manifest and diff checks pass.
- Full wire-match owner and synchronized rocket zoom matrix: running; results are recorded after completion.
- Additional local full centripetal owner attempt stopped in the earlier native-select feedback test (`已答 0 / 2` versus `已答 1 / 2` on macOS), before capacity checks. This is not a full local pass and is not waived by the focused capacity success; the complete Linux CI owner remains required.
- The 248 Node entries passed the previous implementation. The changed helper unit suite is rerun here; new full CI must cover all entries and failed browser owners.

Committed selection evidence and the new GitHub run will be linked after the implementation commit. A local diagnosis or isolated pass does not clear a failed full CI run. Real-phone and Moodle acceptance remain separate and unclaimed.
