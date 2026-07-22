# <Simulation title>

## Scope

- Slug: `<simulation-slug>`
- Learning objective:
- Learner task:
- Main interactions:
- Runtime files:
- Libraries: `none` unless justified
- Assessment risk: `formative` / `low-risk graded` / `high-risk graded`
- Trusted validation for high risk: `not applicable` or describe Moodle/LTI/backend validation
- Out of scope:

## Catalogue metadata (`sim/config.js`)

```js
{
  title: "<learner-facing title>",
  folder: "<simulation-slug>",
  categories: ["<catalogue category>"],
  description: "<one-sentence learner-facing description>",
  tags: ["<search-tag>", "scorm"],
  status: "active"
}
```

- [ ] `folder` is unique and exactly matches the activity directory and manifest slug.
- [ ] `title` and `description` are non-empty learner-facing copy.
- [ ] `categories` and `tags` are non-empty string arrays without duplicates.
- [ ] `status` is `active`, `planned`, or `archived`; only deployable activities are active.

## Physics or subject model

- State variables:
- Update rules/formulas:
- Units:
- Calibration or tolerance constants:

## Responsive layout contract

- Control-panel classification: `none/short natural flow` or `bounded split-panel`
- Why the stage must or need not remain visible while controls are used:
- Phone stage track (bounded split-panel only; baseline starting point is
  `minmax(13rem, 44vh)` plus `44dvh` when supported):
- Normal vertical scroll owner: `document` or `control panel`
- Extreme-height/zoom stage overflow policy:
- Desktop/tablet arrangement:

For a bounded split-panel activity, require `100vh`/`100dvh`, an upper stage and
lower independently scrolling control panel, `min-height: 0` throughout the
shrinking grid/flex chain, and no competing activity-body scroll. Do not apply
this contract when the activity has no substantial control panel.

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

Required for every activity with draft or review persistence. Use only phases the
production UI can render, and add a row for every invariant variant that changes
legal data or continuation. A review-edit row may legitimately retain an active
answer, selection, observations, or future answers when its transition requires them.

| Phase | Variant/invariant | Current step | Required semantic state | Must be absent/pristine | Allowed next action |
|---|---|---:|---|---|---|
| | | | | | |

Transitions:

```text
<phase> -> <phase> when <event/invariant>
```

## Persistence contract

### Draft snapshot

```js
{
  // authoritative answers plus semantic state needed to continue
}
```

### Review snapshot

```js
{
  // authoritative answers sufficient to validate, rescore, and redraw
}
```

Saved result metadata (score/pass) is comparison data only. Finished restore is:

```text
validate snapshot -> restore authoritative answer -> activity scorer
-> SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

Semantic continuation state persisted:

- phase/variant/current step:
- review-edit flags, authoritative semantic selection keys, or completed
  observations needed for the next action:

Transient state never persisted:

- pointer/drag state, DOM references, hover/open animation state:

Derived fields rebuilt on restore:

- generated IDs/slots:
- DOM selection objects, CSS selection state, and control state rebuilt from any
  authoritative semantic selection key:
- cached totals/button state:

Relationship keys:

- authoritative keys to validate for type, uniqueness, and references:
- generated IDs to omit/ignore and rebuild:

Restore invariants:

- [ ] Every saveable phase/invariant variant restores.
- [ ] Score and legal next action survive round-trip, and the test executes that action.
- [ ] Required previous answers cannot be skipped.
- [ ] Active answers and future data match the rules of their matrix row.
- [ ] Invalid enums, dependencies, authoritative relationship keys, and numeric
  values are rejected; generated IDs are omitted/ignored and rebuilt.
- [ ] Old-version aliases are either explicitly migrated and tested or rejected.
- [ ] Snapshot fits the SCORM 1.2 size limit.

Invalid snapshot policy:

- Finished review: remain locked; show only trustworthy Moodle summary.
- Pending-final: shared runtime keeps the same payload frozen for retry.
- Editable draft: safely reset only after the plan-defined clear/overwrite path;
  otherwise lock with a technical load error.

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
| `retry` | Depends | Check `retryable`; never promise retry or claim submission when false |

Canonical glue follows `docs/simulation-scorm-production-guide.md`: route both
`submitWithCallbacks` callbacks through `SimActivityFlow.submission()` and handle
all four outcomes.

## Test plan

- [ ] Scoring components, penalties, tolerance boundaries, and score floor.
- [ ] One encode/decode/restore round-trip for every saveable phase/invariant variant.
- [ ] `score(original) === score(restore(encode(original)))`.
- [ ] Each restored fixture executes one legal continuation and reaches the expected state.
- [ ] Invalid state-matrix combinations fail closed.
- [ ] Production-shaped fixtures only.
- [ ] Finished invalid review remains locked with safe Moodle fallback.
- [ ] Startup `review`, `editable`, `frozen`, and `load-error` UI outcomes.
- [ ] Submission `success`, `committed`, `frozen`, retryable `retry`, and
  non-retryable `retry` UI outcomes.
- [ ] Trusted review, score/status mismatch, and unknown Moodle status outcomes.
- [ ] Lifecycle tests execute production outcome/render logic, not source-string checks.
- [ ] New tests added to `tools/run-tests.js`.
- [ ] Runtime files added to manifest and activity added to `sim/config.js`.
- [ ] If bounded split-panel: `320x500`, `390x500`, `390x600`, normal phone
      portrait, phone landscape, browser-toolbar change, software keyboard, and
      200% zoom keep the panel bottom and all primary actions reachable.
- [ ] If bounded split-panel: normal vertical scrolling belongs to the panel,
      without a competing Moodle-page/activity-body scroll trap.

## Package-ready checklist

- [ ] Phone, tablet, and desktop layouts remain usable.
- [ ] The chosen control-panel classification and mobile scroll owner match the
      implemented layout.
- [ ] Pointer/touch interaction and keyboard alternative are defined as needed.
- [ ] `npm.cmd run check` passes.
- [ ] `npm.cmd test` passes.
- [ ] `npm.cmd run package:all` passes.
- [ ] `git diff --check origin/main...HEAD` passes (or use the actual PR base).
- [ ] ZIP contains root `imsmanifest.xml` and no development-only files.
- [ ] Every local HTML `src`/`href` and loaded asset is declared in the manifest.
- [ ] Browser smoke launches the built or extracted ZIP through the documented Git Bash route.
- [ ] Assessment risk and any trusted validation requirement are recorded.

## Moodle-ready checklist

- [ ] Package-ready checklist is complete.
- [ ] Real Moodle student-account submission records score and status.
- [ ] Draft resume, pending retry, completed review-only re-entry, and new-attempt policy work.
- [ ] Required server-side validation works for high-risk assessment.
- [ ] Moodle evidence is recorded separately from local checks.
