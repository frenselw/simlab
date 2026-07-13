# PR #1 Review 11 Follow-up

Starting head: `9ceec71`

## Completed checklist

- [x] Reject map snapshots whose `currentSegment` conflicts with completed or
  future segment data.
- [x] Require segment 1 to be answered before segment 2 can be active.
- [x] Reject stale second-segment distance, coverage, reached, arrow, or answer
  data while segment 1 is active.
- [x] Reject answered active segments in `walk` or `draw-segment`; preserve valid
  `walk`, `draw-segment`, and `draw-total` states.
- [x] Give the reference-frame feedback heading an ID and show `Moodle 狀態資訊`
  for unavailable technical states while genuine submissions retain `提交結果`.
- [x] Add focused regression checks for both changes.
- [x] Complete two implement/review rounds; both independent reviewers reported
  no findings on final code head `f217176`.
- [x] Pass `npm.cmd run check`, `npm.cmd test`, `npm.cmd run package:all`, and
  final diff validation.
- [x] Pass the four-activity Playwright smoke check without `### Error`.
- [x] Defer browser CI as non-blocking; no browser dependency was added.
- [ ] Complete real Moodle learner-account validation.
