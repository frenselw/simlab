# <Simulation title>

## Scope

- Slug: `<simulation-slug>`
- Learning objective:
- Learner task:
- Main interactions:
- Runtime files:
- Libraries: `none` unless justified
- Out of scope:

## Physics or subject model

- State variables:
- Update rules/formulas:
- Units:
- Calibration or tolerance constants:

## Scoring

- Total: 100
- Passing threshold:
- Components and points:
- Duplicate/extra-item handling:
- Penalties:
- Lowest score: 0

## Tolerance

- Quantity checked:
- Accepted range and unit:
- Absolute/relative/symmetric/one-sided:
- Just-inside example:
- Just-outside example:
- Easy-to-change constants:

## Phase/state matrix

Use only phase names the production UI can render.

| Phase | Current step | Required data | Must be absent/pristine | Allowed next action |
|---|---:|---|---|---|
| | | | | |

Transitions:

```text
<phase> -> <phase> when <event/invariant>
```

## Persistence contract

### Draft snapshot

```js
{
  // authoritative answers and minimum continuation geometry only
}
```

### Review snapshot

```js
{
  // authoritative answers and minimum redraw geometry only
}
```

Derived fields rebuilt on restore:

- IDs/slots:
- selection/drag state:
- cached totals/button state:

Restore invariants:

- [ ] Every UI-saveable state restores.
- [ ] Score and legal next action survive round-trip.
- [ ] Required previous answers cannot be skipped.
- [ ] Active editable answers are not already completed.
- [ ] Future-step data is pristine.
- [ ] Invalid enums, dependencies, IDs, and numeric values are rejected.
- [ ] Old-version aliases are either explicitly migrated and tested or rejected.
- [ ] Snapshot fits the SCORM 1.2 size limit.

## Shared SCORM lifecycle

Startup UI:

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `review` | No | Validate, rescore, show review or safe Moodle summary |
| `editable` | Yes | Create/restore draft and register draft provider |
| `frozen` | No | Retry same pending payload; status unconfirmed |
| `load-error` | No | Technical error; no score/pass/submitted claim |

Submission UI:

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `success` | No | Submitted review-only |
| `committed` | No | Committed result; finish retry allowed |
| `frozen` | No | Pending/unconfirmed; no score/pass claim |
| `retry` | Yes | Retryable technical failure |

## Test plan

- [ ] Scoring components, penalties, tolerance boundaries, and score floor.
- [ ] One encode/decode/restore round-trip for every saveable phase.
- [ ] `score(original) === score(restore(encode(original)))`.
- [ ] Invalid state-matrix combinations fail closed.
- [ ] Production-shaped fixtures only.
- [ ] Finished invalid review remains locked with safe Moodle fallback.
- [ ] Pending-final, load-error, committed, and success UI outcomes.
- [ ] New tests added to `tools/run-tests.js`.
- [ ] Runtime files added to manifest and activity added to `sim/config.js`.

## Acceptance checklist

- [ ] Phone, tablet, and desktop layouts remain usable.
- [ ] Pointer/touch interaction and keyboard alternative are defined as needed.
- [ ] `npm.cmd run check` passes.
- [ ] `npm.cmd test` passes.
- [ ] `npm.cmd run package:all` passes.
- [ ] ZIP contains root `imsmanifest.xml` and no development-only files.
- [ ] Local browser smoke completed.
- [ ] Real Moodle learner-account validation completed or explicitly pending.
