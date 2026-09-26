# <Simulation title>

Fill in activity-specific decisions and evidence; do not copy shared rules here.
Follow the [shared style](00-shared-platform-and-style.md) and [production guide](../docs/simulation-scorm-production-guide.md). Mark inapplicable items `N/A` with a reason; leave unverified checks unchecked.

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | |
| Learner task / main interactions | |
| Runtime files / libraries and justification | Prefer native browser features |
| Assessment risk / trusted validation | `formative`, `low-risk graded`, or `high-risk graded`; describe required server validation |
| Out of scope | |

## Catalogue metadata (`sim/config.js`)

```js
{
  title: "<learner-facing title>",
  folder: "<simulation-slug>",
  categories: ["<category>"],
  description: "<one-sentence learner-facing description>",
  tags: ["<search-tag>", "scorm"],
  status: "planned"
}
```

Use a unique folder matching the activity directory and manifest slug; supply non-empty title, description, categories and tags without duplicate entries. Change status to `active` only when deployable; `archived` remains available for retired activities.

## Physics or subject model

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| | | | |

## Responsive layout contract

Apply [layout](00-shared-platform-and-style.md#layout) and [mobile interaction](00-shared-platform-and-style.md#mobile-interaction).

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header contents and navigation placement; stage; control panel |
| Desktop / tablet | Arrangement, panel width or width range, and stage/control space needed |
| Control-panel classification | `none/short natural flow` or `bounded split-panel`; why the stage must or need not stay visible during control use |
| Phone stage and controls | Stage track, remaining control space, and short-viewport reflow |
| Phone text | Body/control/diagram sizes; readability after SVG or camera scaling |
| Viewports | Small and normal portrait, landscape, short Moodle iframe, toolbar changes, keyboard and 200% zoom |
| Scroll topology | Standalone and embedded owners; bounded activity document has no usable vertical scroll range |

## Navigation, submission and reset

Apply [navigation](00-shared-platform-and-style.md#navigation) and [submission/reset](00-shared-platform-and-style.md#submission-and-reset).

| Decision | Activity specification |
|---|---|
| Navigation | `independent`, `dependent`, or `mixed`; header jump buttons or sequential controls, with reason |
| Final check access | Route from **every editable phase** to final check, including entirely blank and partially answered attempts; no all-seen/all-complete gate |
| Incomplete submission | Neutral unanswered summary; submit current answers, including a zero-score attempt |
| Editable reset | Scope, confirmation, affected downstream answers, and retained data |
| Scored / pending attempt | No in-page clear-results/restart action; retain permitted technical retry/recovery. Standalone browser refresh follows the shared refresh/resume contract |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| | | Explicitly represent unanswered work; never fabricate prerequisite answers | |

## Diagrams, notation and assistance

Apply [diagrams/notation](00-shared-platform-and-style.md#diagrams-and-notation), [snapping](00-shared-platform-and-style.md#snapping) and [touch preview](00-shared-platform-and-style.md#touch-preview).

| Decision | Activity specification and reason |
|---|---|
| Notation | Symbols, vector versus magnitude convention, units and subscripts; consistent stage/panel/preview/review rendering |
| Arrow graphics | Shape, widths and head proportions, endpoint alignment, short-vector treatment, label placement and scaling |
| Snap | Required/not required; visible target types, screen CSS-pixel/angle tolerances by input type, release behavior and rationale; assistance must not supply answers |
| Touch preview | Required/not required **with finger-occlusion analysis** for each precision task; targets, scene/focus, placement, scale and cleanup |

## Touch gesture ownership contract

Use the production guide's [complete touch acceptance contract](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership). Fill actual regions, selectors and evidence; inventory **every** target type, including editing handles and drawing surfaces.

| Target type | Selector / hit area and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| | | Remains mounted throughout drag | |

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| Non-interactive stage | Enclosing page/Moodle host | `pan-y`; identify reachable region | |
| Independent control panel, if present | Panel only, including boundaries | Otherwise explain natural-flow host ownership | |
| Drawing surface, if present | Simulation during drawing | Explicit drawing boundary and mode | |
| Left scroll strip, when drawing occupies the stage | Enclosing page/Moodle host | Width and reason; remains reachable during drawing | |
| Right scroll strip, when drawing occupies the stage | Enclosing page/Moodle host | Width and reason; remains reachable during drawing | |
| `<each draggable target type>` | Simulation during drag | Target changes; all scroll/viewport/iframe positions stay fixed | |

- Host scroll path (native or same-host forwarding), bounded-document enforcement, and any Canvas/SVG hit-target alternative:
- Source/extracted-package test host, engine/device, trusted-input method, metrics and artifact paths:
- Test both stage swipe directions, panel boundaries, every target and drawing-mode side strips; preserve `pointermove`/`pointerup` without `pointercancel` during active drags. Control continuous animation separately from gesture-caused changes.
- DOM-dispatched events, programmatic scrolling and source/style checks do not establish touch acceptance. Standalone with no host range does not replace a scrollable Moodle-like iframe check.

## Scoring and tolerance

| Decision | Activity specification |
|---|---|
| Rubric | Components, points, total (normally 100), pass threshold and minimum 0 |
| Granularity | Which independent answers earn credit; avoid unrelated errors erasing valid work |
| Unanswered / null | Exact representation and score; blank/partial submission is valid |
| Extras / duplicates / penalties | |
| Tolerances | Quantity, units, absolute/relative and symmetric/one-sided rule; just-inside/outside examples and configurable constants |

## Phase/state matrix

Before persistence code, add **every saveable phase and invariant variant**, including blank/partial work, final check, review-edit continuations and submitted review. Each row must describe a renderable production state.

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| | | | | |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| | | |

## Persistence contract

Follow the production guide's [snapshot/restore contract](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract) and [required persistence tests](../docs/simulation-scorm-production-guide.md#required-persistence-tests). Specify exact versioned fields and validation before implementation.

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| Draft | Authoritative answers plus phase/variant, current step and semantic state needed for continuation |
| Review | Authoritative answers sufficient to validate, rescore and redraw; saved score/pass are comparison metadata |
| Unanswered encoding | Legal null/empty values per phase; distinguish these from missing required fields, invalid values and broken relationships, which remain invalid |

| State category | Activity fields and treatment |
|---|---|
| Authoritative | Answers, semantic relationship/selection keys, observations and review-edit state; validate references and invariants |
| Transient | Pointer/drag/hover/preview, DOM references and animation state; never persist |
| Derived | IDs/slots, DOM/control state and totals; rebuild from authoritative state |
| Version compatibility | Explicitly tested migration or rejection; never silently reinterpret old answers |
| Size | Worst-case UTF-8 snapshot measurement, maximum **4000 bytes** |
| Invalid finished review | Remain locked; display only trustworthy recorded summary |
| Invalid pending-final | Quarantine and technical lock; no retry, clear or reopening. Only a validated pending payload may use the shared retry path |
| Invalid editable draft | Defined safe clear/overwrite recovery, or technical load lock; never clear a scored/pending attempt |

Finished restore validates and restores answers, runs the activity scorer, then uses `SimActivityFlow.reviewResult()` to compare computed, saved and Moodle outcomes.

## Shared SCORM lifecycle

Use `SimScorm.loadAttempt()` with `SimActivityFlow.startup()`, register `SimScorm.setDraftProvider()`, and route `submitWithCallbacks()` through `SimActivityFlow.submission()` as specified in the [shared lifecycle flow](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow).

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup `editable`, `review`, `frozen`, `load-error` | Specify each outcome; technical locks must not claim a confirmed result |
| Submit `success`, `committed`, `frozen`, `retry` | Specify each outcome; distinguish retryable/non-retryable `retry` and finish retry |
| Review trust | Trusted result, mismatch, unknown status and invalid recorded summary |
| Standalone refresh | Mandatory memory-only practice: refresh starts fresh after drafts/check/submission; ignore old checkpoints, and remain usable when browser storage is denied. Follow the [shared contract](../docs/simulation-scorm-production-guide.md#standalone-refresh-and-moodle-resume) |
| Moodle resume / recovery | Same-attempt draft/review/pending restoration; fresh only when Moodle supplies a new attempt; permitted unfinished-draft recovery and save-failure handling |

## Test plan

Apply all relevant [verification checks](../docs/simulation-scorm-production-guide.md#verification-checklists), including the minimum phone/short-iframe viewport matrix.

- [ ] Scoring covers blank/partial answers, component independence, extras, penalties and tolerance boundaries.
- [ ] Every editable phase can reach final check and submit blank/partial work; scored/pending states have no erase/restart route.
- [ ] Production encode/decode/restore round-trip covers **every** matrix row with production-shaped fixtures, equal score and execution of one legal continuation.
- [ ] Invalid matrix combinations, numbers, enums, dependencies and authoritative keys fail closed; derived IDs rebuild; version policy and 4000-byte ceiling are tested.
- [ ] Production startup/submission/render logic covers all outcomes above, invalid finished review, pending retry and trust mismatch/unknown status; source checks alone are insufficient.
- [ ] Source and extracted SCORM standalone refresh clears partial/check/submitted work and permits redraw/submission, including old draft/review/pending/corrupt checkpoints and denied browser storage; separate Moodle cases retain same-attempt work.
- [ ] Phone typography, arrow/label geometry, snap and required previews work in the planned viewport/zoom matrix.
- [ ] Every applicable gesture row passes with trusted input in a scrollable Moodle-like iframe on **source and extracted SCORM**; record all guide-required scroll/viewport/iframe metrics, including no third scroll owner.
- [ ] Every new test is registered in `tools/run-tests.js`; runtime dependencies are in the manifest and metadata in `sim/config.js`.

## Package-ready checklist

- [ ] Above decisions, state matrix and test evidence are complete; required keyboard alternatives work.
- [ ] Phone, tablet and desktop layouts, short iframe, toolbar/keyboard changes and 200% zoom preserve readable content and reachable actions.
- [ ] `npm run check`, `npm test` and `npm run package:all` pass; record commands, results and artifact paths.
- [ ] `git diff --check` and the PR diff against its actual base pass.
- [ ] ZIP has root `imsmanifest.xml`, every runtime asset is declared and no development-only files ship.
- [ ] Built/extracted launch smoke and the full applicable trusted-touch matrix pass; use the documented Git Bash route on Windows.
- [ ] Assessment risk and any trusted validation requirement are recorded.

## Moodle-ready checklist

- [ ] Package-ready gates pass; real Moodle student-account submission records score/status.
- [ ] Draft resume, pending retry, immutable scored review and LMS new-attempt policy work.
- [ ] Real-phone complete gesture matrix passes in current-window and offered new-window Moodle players.
- [ ] Required server-side validation works for high-risk assessment.
- [ ] Moodle and physical-device evidence is recorded separately from local checks; list any unverified item explicitly.
