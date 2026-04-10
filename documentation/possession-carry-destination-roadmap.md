# Possession Carry + Destination Roadmap

Roadmap date: 2026-04-09

Status: in progress

Current slice status:

- Sprint 1 foundations are landed in the app: possession events normalize and sync `carry_waypoints`, nullable destination fields, and waypoint-aware carry metrics.
- The staged draft capture flow, segmented carry rendering, saved-event read-back, and CSV export are also landed.
- Saved-point editing, richer action-family and path-layer filters, ball-path summary cards, and direct-manipulation correction are now landed.
- Smoothed carry rendering is now landed: carry paths with waypoints render as Catmull-Rom splines in Pitch.svelte; two-point paths remain straight lines.
- Broader device and accessibility hardening remain pending.

## Remaining Sprint Sequence From Current State

This is the practical order for the unfinished work from the current shipped slice, not the original greenfield build order.

| Sequence | Sprint target | Focus | Includes | Why it comes next | Impact if delayed |
| --- | --- | --- | --- | --- | --- |
| `R1` | Sprint 3 | Saved-point correction + analysis filters | `PCD-S3-03`, `PCD-S3-04` | Completed. Saved events can now be corrected in place and filtered by action family or path layer. | Closed. |
| `R2` | Sprint 4 | Ball-movement summaries + reporting payoff | `PCD-S4-02` | Completed. The summary strip now surfaces ball-path count and average ball distance. | Closed. |
| `R3` | Sprint 4A | Rendering polish + drag handles | `PCD-S4A-01`, `PCD-S4A-02`, `PCD-S4A-03` | Complete. Drag-handle correction, keyboard-safe point nudging, and smoothed Catmull-Rom carry rendering are all landed. | Closed. |
| `R4` | Sprint 5 | QA, accessibility, and release hardening | `PCD-S5-01`, `PCD-S5-02`, `PCD-S5-03` | End-to-end and device hardening should happen after the interaction model stops moving. | Confidence in touch, keyboard, and real match-review use stays lower than it should be. |

This roadmap covers a post-match extension to the current possession analysis workflow so an analyst can capture:

- `A`: catch / receive point
- `A -> ... -> B`: carry path with `0-3` optional waypoints
- `B`: release point
- `B -> C`: ball path
- `C`: destination point when the action needs one

The goal is to capture "player movement plus what they did next" in one structured event without turning the UI into a freehand drawing tool.

## Scope Summary

In scope:

- post-match workflow only
- extend the possession event model from `A -> B` to `A -> waypoint(s) -> B -> C`
- keep `0` waypoints as the default fast path
- cap carry waypoints at `3`
- render the carry path separately from the ball path
- keep the data structured so metrics, export, and filters stay reliable

Out of scope for the first release slice:

- freehand line drawing
- live or in-match capture
- automatic panel merge or removal of the existing Pass Impact flow
- video linking

Over-engineered idea to avoid:

- true freehand carry drawing in V1. It slows capture, complicates editing, weakens analysis consistency, and adds more implementation risk than value for post-match review.

## Repo Evidence

The current codebase already provides most of the foundations needed for this feature:

- [src/lib/PossessionAnalysisPanel.svelte](../src/lib/PossessionAnalysisPanel.svelte) already captures a possession as receive point, release point, and outcome, and already renders carry lines in the saved analysis view.
- [src/lib/Pitch.svelte](../src/lib/Pitch.svelte) already supports generic `connections` and `overlays`, so the renderer can draw segmented carry paths and separate ball paths without replacing the pitch component.
- [src/lib/postMatchAnalysis.js](../src/lib/postMatchAnalysis.js) already calculates carry distance and direction, but it currently assumes one straight segment from receive to release.
- [src/lib/analysisSync.js](../src/lib/analysisSync.js) and [src/lib/postMatchAnalysisStore.js](../src/lib/postMatchAnalysisStore.js) currently normalize and persist possession events with receive and release coordinates only, so backward-compatible schema work is required.
- [documentation/post-match-player-analysis.md](./post-match-player-analysis.md) defines possession and pass analysis as separate workflows today, so product copy and implementation notes will need to reflect that this feature partially bridges those concepts.

## Dependency Gate

Start this work only after the active Match Entity stream is stable enough that match identity, session ownership, and analysis persistence are not still changing underneath it.

- The backlog marks the local Match Entity work as done, but if the active implementation branch is still moving the analysis store or session model, do not start schema work for this feature yet.
- Treat this as a gate before Sprint 0 and Sprint 1, not as a mid-sprint integration cleanup.
- The goal is to avoid building waypoint and destination support on top of a storage layer that is still being rewired.

## Proposed Event Model

### Event shape

- `receive_point`: required, point `A`
- `carry_waypoints`: optional array, maximum length `3`
- `release_point`: required, point `B`
- `action_type`: required
- `target_point`: optional, point `C` when the action produces a destination; otherwise `null`
- `under_pressure`: optional
- `assist`: optional where valid
- `created_at` / `updated_at`

### Action groups

Actions that should require `C`:

- `Hand pass`
- `Kick pass`

Actions that may use `C`, but should still persist `target_point = null` when the destination is not being captured in the first slice:

- `Score point`
- `Score goal`
- `Shot wide`
- `Shot short / saved / blocked`

Actions that should explicitly store `target_point = null`:

- `Possession lost`
- `Tackled / dispossessed`
- `Foul won`
- `Fouled the ball`

Important rule:

- When a destination does not apply, persist `target_point = null`. Never synthesize `C = B` as a placeholder, because that would silently poison ball-progression metrics.

### Compatibility rules

- Existing possession events with only receive and release points must load as valid events with `carry_waypoints = []`.
- Existing outcome analytics must still work when `target_point` is absent.
- Direction classification for the carry should continue to use the session attacking direction.
- The separate Pass Impact panel stays intact during the first implementation phase.
- Old events with no waypoints should preserve their current carry values because `A -> B` remains a single straight segment when `carry_waypoints = []`.

## Delivery Principles

- Prefer extending the current possession flow over inventing a third analysis workflow.
- Keep the fastest case fast: `A`, `B`, choose action, save.
- Add waypoint UI only after `A` exists.
- Hide destination capture until the chosen action requires or benefits from `C`.
- Store points in a structured array rather than storing drawn paths.
- Default to segmented paths in code; smooth visual curves can come later as a rendering enhancement.
- Preserve backward compatibility in storage, sync, export, and analytics.
- Add a read-back confirmation path before commit so analysts can verify `A -> waypoint(s) -> B -> C` before Sprint 3's fuller saved-event inspection work is complete.
- Keep `aggregateConnections` waypoint-agnostic and use it only for ball-path aggregation such as `B -> C`; carry-path rendering should use separate helpers.

## Launch Blockers

These are the items that must be correct before this feature should be considered shippable.

| ID | Title | Why it blocks launch | Acceptance criteria | File / module refs |
| --- | --- | --- | --- | --- |
| `PCD-BL-01` | Backward-compatible event schema | Old possession sessions will break or disappear if the new event model is not normalized safely. | Legacy sessions load unchanged; new sessions save and reload with waypoints and optional target point; migration has unit coverage. | `src/lib/postMatchAnalysisStore.js`, `src/lib/analysisSync.js`, `src/lib/storageScope.js` |
| `PCD-BL-02` | Clear action-to-destination rules | Analysts will not trust capture if the app inconsistently asks for `C`. | Each action type has one explicit destination rule, enforced in UI and tests. | `src/lib/PossessionAnalysisPanel.svelte`, `documentation/post-match-player-analysis.md` |
| `PCD-BL-03` | Correct carry metrics over waypoint paths | Straight-line carry distance will under-report looped or check-back runs. | Carry distance and exports use full path length across all carry points, not just `A -> B`. | `src/lib/postMatchAnalysis.js`, `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-BL-04` | Usable post-match capture flow | If the step flow becomes slow or confusing, analysts will abandon it. | The default `0` waypoint path can be logged quickly and the 3-waypoint cap is enforced cleanly. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` |

## Pre-Launch Fixes

These should be part of the initial release if the feature is intended for real analyst use.

- Saved-event editing must cover points and waypoints, not just outcome and flags.
- CSV and sync payloads must include the new path data in a readable format.
- Analysis legends and filters must distinguish carry path from ball path.
- Tablet and keyboard accessibility must remain workable for every step in the capture flow.
- The existing product spec and in-app copy must explain that this is a post-match workflow with optional waypoints, not a drawing canvas.

## Post-Launch Improvements

- Smooth or curved carry rendering over stored waypoint paths.
- Cross-match summaries for action families that happen after carries.
- Saved presets for analysts who repeatedly review the same path filters.
- More detailed target classifications for shot outcomes if coaches find them useful.

## Nice-To-Haves

- Animated playback of one event from `A` through `B` to `C`.
- Optional waypoint labels such as `W1`, `W2`, `W3`.
- Video timestamp links if video becomes a real product capability later.

## Assumptions

- Sprint length is one week.
- This feature extends the possession workflow first; it does not remove the current Pass Impact panel in the first release.
- Destination capture for score and miss actions can start simple and become more specific later if analyst demand is real.
- The team prefers minimal schema expansion over a broader rewrite of analysis storage.
- Sprint 0 is a short design and dependency spike, not a long discovery phase.

## Sprint Plan

## Sprint 0 - Dependency Gate And Draft UX Spike

Objective:

- Confirm the underlying match/session layer is stable enough to build on and settle the highest-risk UX and schema decisions before implementation begins.

Success markers:

- The team explicitly chooses `target_point = null` semantics.
- The team agrees on how an analyst exits waypoint entry and advances to `B`.
- The implementation work starts only after Match Entity churn has settled.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S0-01` | Confirm Match Entity stability gate | None | Product / frontend | S | The active branch confirms match identity, session storage, and analysis persistence are stable enough for schema extension; if not, Sprint 1 is deferred. | No code test; implementation gate recorded in planning notes. | `documentation/backlog.md`, analysis store modules |
| `PCD-S0-02` | Resolve `null C` semantics and destination taxonomy | `PCD-S0-01` | Product / frontend | S | The team commits to `target_point = null` when no destination applies and defines which actions require, allow, or skip `C`. | Doc review plus rule-table sanity check. | `documentation/post-match-player-analysis.md`, `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S0-03` | Design the draft state machine for waypoint capture | `PCD-S0-01`, `PCD-S0-02` | Frontend / UX | S | The flow explicitly answers how users add waypoints, how they stop adding them, how they place `B`, and how undo/clear behave at each step. | State-table review before Sprint 2 implementation. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/PassImpactPanel.svelte` |

## Sprint 1 - Data Model, Taxonomy, Compatibility

Objective:

- Define the event model, keep legacy events loading, and avoid breaking analytics or sync.

Success markers:

- New event fields can be stored and reloaded safely.
- The app can normalize both old and new events.
- Action rules for when `C` is required are explicit in code and docs.
- The schema never uses `C = B` as a placeholder.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S1-01` | Finalize action taxonomy and point rules | `PCD-S0-02` | Product / frontend | S | One source of truth defines which actions require `C`, allow `C`, or forbid `C`; when no destination applies the stored value is `null`; help text matches the code. | Unit tests around rule lookup; doc review. | `src/lib/PossessionAnalysisPanel.svelte`, `documentation/post-match-player-analysis.md` |
| `PCD-S1-02` | Extend possession event normalization for waypoints and target point | `PCD-S1-01` | Frontend | M | Possession events support `carry_waypoints` and `target_point`; invalid waypoint arrays are clamped or rejected safely; old events normalize to `[]`; non-applicable destinations normalize to `null`. | Unit tests for normalization and bad inputs. | `src/lib/postMatchAnalysisStore.js`, `src/lib/storageScope.js`, `src/lib/postMatchAnalysis.js` |
| `PCD-S1-03` | Extend sync/storage serialization for the new event shape | `PCD-S1-02` | Full-stack / frontend | M | Local storage and sync payloads persist new fields without losing old sessions; load/save round-trips cleanly. | Unit tests for sync row conversion and store round-trip behavior. | `src/lib/analysisSync.js`, `src/lib/storageScope.js`, `src/lib/postMatchAnalysisStore.test.js` |
| `PCD-S1-04` | Add migration and compatibility coverage | `PCD-S1-02`, `PCD-S1-03` | Frontend / QA | S | Mixed legacy and new sessions can coexist in one analysis state and still render. | Vitest coverage for mixed data sets. | `src/lib/analysisSync.test.js`, `src/lib/storageScope.test.js`, `src/lib/postMatchAnalysisStore.test.js` |

## Sprint 2 - Draft Capture Flow

Objective:

- Make `A -> waypoint(s) -> B -> C` quick to log without making the common case slower.

Success markers:

- An analyst can log a straight carry without touching waypoint controls.
- Optional waypoint capture is obvious and capped at `3`.
- Destination capture appears only when needed.
- Analysts can confirm the full point sequence before saving even though the richer analysis view lands later.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S2-01` | Replace the current two-point draft flow with staged point capture | `PCD-S1-04`, `PCD-S0-03` | Frontend | M | Draft mode supports `receive -> waypoint(s) -> release -> action -> destination-if-needed`; active step is visible at all times; the method for exiting waypoint entry and placing `B` follows the approved state-machine design. | Component tests for step transitions and reset behavior. | `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S2-02` | Add waypoint controls with a hard cap of `3` | `PCD-S2-01` | Frontend | M | Users can add, undo, and remove waypoints; `Add waypoint` is hidden or disabled at `3`; zero waypoints remains the default. | Component tests for cap enforcement and undo flows. | `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S2-03` | Render draft carry path and draft ball path separately | `PCD-S2-01` | Frontend | M | Draft pitch shows carry and ball path as visually distinct layers; the carry can have multiple straight segments through waypoints; the ball path remains one segment from `B -> C`. | Component tests for rendered path counts; manual visual sanity. | `src/lib/Pitch.svelte`, `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S2-04` | Add read-back confirmation before commit | `PCD-S2-03` | Frontend | S | Before an event is saved, the analyst can review the full captured sequence and metadata in one lightweight confirmation state. | Component tests for confirmation, back, and save paths. | `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S2-05` | Add concise capture guidance for first-use clarity | `PCD-S2-01` | Product / frontend | S | The draft UI explains `A`, optional waypoint(s), `B`, and `C` in plain language without overwhelming the analyst. | Smoke component test for help states. | `src/lib/PossessionAnalysisPanel.svelte` |

## Sprint 3 - Saved Analysis View, Read-Back, And Editing

Objective:

- Make saved events legible, inspectable, and correctable once they contain both carry and ball movement.

Status from current slice:

- `PCD-S3-01` is landed: saved carries and saved ball paths render in dot view.
- `PCD-S3-02` is landed: the detail card exposes receive, waypoint count, release, destination, carry distance, and ball distance.
- `PCD-S3-03` is landed: saved receive / waypoint / release / destination points can be corrected without deleting the event.
- `PCD-S3-04` is landed: analysts can filter the saved view by action family and carry-vs-ball path layers.

Success markers:

- Saved events show distinct carry and ball paths.
- Analysts can inspect every point in one event.
- Analysts can correct point data without deleting and recreating the full event.
- Filters and legends make the denser view understandable.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S3-01` | Render saved carry paths with waypoints in the dot view | `PCD-S2-03` | Frontend | M | Saved events show `A -> waypoint(s) -> B` for carries and `B -> C` for ball movement where relevant; old events still render; carry-path rendering uses dedicated helpers and does not make `aggregateConnections` waypoint-aware. | Component tests for mixed legacy/new rendering. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte`, `src/lib/postMatchAnalysis.js` |
| `PCD-S3-02` | Expand event detail to show receive, release, waypoints, and destination | `PCD-S3-01` | Frontend | S | Selecting an event exposes every stored point and the action metadata in order. | Component tests for event-detail rendering. | `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S3-03` | Allow saved-point editing for receive, waypoints, release, and destination | `PCD-S3-02` | Frontend | M | Analysts can correct point data without deleting and recreating the full event. | Component tests for edit, save, and cancel behavior. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` |
| `PCD-S3-04` | Update legend and filters for action families and path types | `PCD-S3-01` | Product / frontend | S | Analysts can distinguish carry path vs ball path, and can filter to passes, shots, losses, or scores. | Component tests for filter state and empty-state behavior. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/analysisUiState.js` |

## Sprint 4 - Analytics, Export, And Reporting

Objective:

- Make the richer event shape measurable and exportable.

Status from current slice:

- `PCD-S4-01` is landed: carry metrics, export, and sync all understand structured waypoint paths.
- `PCD-S4-02` is landed: the summary strip now reports ball-path count and average ball distance.

Status from current slice:

- `PCD-S4-01` is landed: carry metrics are waypoint-aware.
- `PCD-S4-03` is landed: CSV export includes waypoint and destination data.
- `PCD-S4-04` is largely landed for product and technical docs, with user-guide polish still optional.
- Remaining sprint work is `PCD-S4-02`.

Success markers:

- Carry metrics use full path length.
- Analysts can compare carry movement and ball movement separately.
- Exports stay readable and machine-usable.
- Analysts are warned when methodology changes affect how carry averages should be interpreted.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S4-01` | Replace straight-line carry calculations with waypoint-aware path metrics | `PCD-S1-04` | Frontend | M | Carry distance sums every carry segment; net movement and directional classification stay consistent with session orientation; the team documents whether a metric-version flag is needed or whether an analyst-facing methodology note is sufficient before rollout. | Unit tests for straight, bent, and loop-back paths. | `src/lib/postMatchAnalysis.js`, `src/lib/postMatchAnalysis.test.js` |
| `PCD-S4-02` | Add ball-movement metrics and summaries | `PCD-S4-01`, `PCD-S3-03` | Product / frontend | M | Summary cards can report carry length and post-release ball movement without conflating them. | Unit/component tests for summary math and breakdowns. | `src/lib/postMatchAnalysis.js`, `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S4-03` | Expand CSV export for waypoints and destination | `PCD-S1-03`, `PCD-S4-01` | Frontend | S | Export includes waypoint count, serialized waypoints, release point, destination point, action type, and path-length metrics. | Unit tests for CSV headers and row formatting. | `src/lib/PossessionAnalysisPanel.svelte` |
| `PCD-S4-04` | Update feature documentation and analyst guidance | `PCD-S4-02` | Product | S | The shipped docs describe the new event model, action rules, and practical capture guidance. | Manual doc review and sanity pass. | `documentation/post-match-player-analysis.md`, `documentation/user-guide.md` |

## Sprint 4A - Rendering Polish And Direct Manipulation

Objective:

- Improve saved-event readability and correction speed once the saved-point editing model is stable.

Success markers:

- Carry paths can render more smoothly without changing the stored segmented waypoint model.
- Analysts can drag saved receive, waypoint, release, and destination points directly on the pitch.
- Drag editing has explicit save / cancel behavior and still respects the waypoint cap and destination rules.

Status from current slice:

- `PCD-S4A-01` is landed: carry paths with 3 or more points (receive + waypoint(s) + release) now render as Catmull-Rom splines in `Pitch.svelte`; two-point paths remain straight lines; the stored waypoint model is unchanged.
- `PCD-S4A-02` is landed: saved events now expose visible receive / waypoint / release / destination handles on the pitch.
- `PCD-S4A-03` is landed: analysts can correct points via drag handles, explicit point-mode buttons, and keyboard nudge controls.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S4A-01` | Add optional smoothed carry rendering over structured waypoints | `PCD-S3-03` | Frontend | S | Saved carries can render as a visually smoother path while persistence and metrics continue to use the structured segmented data; a clean fallback to straight segments remains available. | Manual visual sanity plus focused component coverage for path generation boundaries. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` |
| `PCD-S4A-02` | Add drag handles for saved-point correction on the pitch | `PCD-S3-03` | Frontend | M | Analysts can select an event and reposition receive, each waypoint, release, and destination with visible handles; edits can be saved or canceled cleanly. | Component tests for handle visibility, drag save / cancel, waypoint deletion, and destination-rule preservation. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` |
| `PCD-S4A-03` | Keep direct-manipulation editing touch-safe and keyboard-safe | `PCD-S4A-02` | Frontend / UX | S | Tablet touch targets remain usable and keyboard users still have a non-drag correction path. | Manual accessibility pass plus focused component tests for fallback flows. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` |

## Sprint 5 - QA, Accessibility, Release Readiness

Objective:

- Make the feature safe enough to trust in real post-match workflows.

Success markers:

- Saved events can be corrected without full re-entry.
- End-to-end tests cover the new critical paths.
- The UI is workable on tablet and keyboard.

Tickets:

| ID | Title | Dependencies | Owner type | Effort | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PCD-S5-01` | Add launch-grade e2e coverage for the new workflow | `PCD-S3-03` | QA / frontend | M | Playwright covers straight carry, 3-waypoint carry, conditional destination capture, saved-event editing, and CSV export. | E2E tests in Chromium at minimum; smaller non-Chromium smoke if practical. | `tests/e2e`, `playwright.config.js` |
| `PCD-S5-02` | Tighten accessibility and tablet ergonomics | `PCD-S2-05`, `PCD-S3-03` | Frontend / UX | S | Tap targets, focus order, step announcements, and error states remain usable on touch devices and keyboard. | Manual accessibility pass plus component coverage for key states. | `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` |
| `PCD-S5-03` | Run pilot and release checklist | `PCD-S5-01`, `PCD-S5-02` | Product / QA | S | The team logs at least one real match end-to-end, records issues, and decides whether the feature is launch-ready or needs another hardening cycle. | Manual pilot plus checklist signoff. | `documentation/release-checklist.md`, pilot notes |

## Recommended Execution Order

1. `PCD-S0-01`
2. `PCD-S0-02`
3. `PCD-S0-03`
4. `PCD-S1-01`
5. `PCD-S1-02`
6. `PCD-S1-03`
7. `PCD-S1-04`
8. `PCD-S2-01`
9. `PCD-S2-02`
10. `PCD-S2-03`
11. `PCD-S2-04`
12. `PCD-S2-05`
13. `PCD-S3-01`
14. `PCD-S3-02`
15. `PCD-S3-03`
16. `PCD-S3-04`
17. `PCD-S4-01`
18. `PCD-S4-02`
19. `PCD-S4-03`
20. `PCD-S4-04`
21. `PCD-S4A-01`
22. `PCD-S4A-02`
23. `PCD-S4A-03`
24. `PCD-S5-01`
25. `PCD-S5-02`
26. `PCD-S5-03`

## Risks And Watchouts

- The feature crosses the boundary between the current possession and pass mental models, so naming and help text must stay very clear.
- Waypoints add state complexity quickly; the capture UI should stay staged and progressive rather than showing every control at once.
- The biggest technical regression risk is summary logic that silently keeps using straight-line carry assumptions after waypoint support lands.
- Ball-path metrics become untrustworthy immediately if the implementation ever falls back to `C = B` instead of a real `null`.
- Sprint 2 feedback quality will be poor unless the read-back confirmation step lands before analysts start piloting the richer capture flow.
- The biggest UX regression risk is forcing `C` for too many actions and slowing down ordinary post-match logging.

## Recommended Slice To Build First

If the team wants the smallest credible release slice before committing to the full roadmap:

1. Ship `A -> B -> C` with `target_point = null` where no destination applies.
2. Keep waypoint support present but limited to `1` internal implementation path and a visible cap of `3`.
3. Support `C` only for `Hand pass` and `Kick pass` in the first cut.
4. Include a lightweight read-back and saved-point correction path before any broad rollout recommendation.
5. Defer smooth curves and richer target taxonomies once direct-manipulation correction is in place.

That slice keeps the product moving without over-committing to the most expensive parts of the design.
