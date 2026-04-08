# Go-Live Remediation Roadmap

Roadmap date: 2026-04-07

This roadmap turns `docs/go-live/backlog.md` into a practical sequence. It is ordered by launch risk first, then launch credibility, then post-launch value. The future-opportunity phase is included for completeness, but it is intentionally non-blocking.

Status note:

- Phase 1 has been shipped in this pass.
- Phase 2 has started with lazy-loaded analysis panels, persisted analysis UI state, and browser-matrix coverage, but it remains open for the explicit preset flow, coach-export polish, and fuller shell decomposition.

## Phase 0 - Blockers and credibility gates

Objective:

- Remove the trust-boundary, cloud-confidence, docs, and workflow risks that would make a launch misleading.

Dependencies:

- Access to the launch Supabase environment or a clear decision that cloud scope is excluded.
- Agreement on the multi-analyst operating rule.

Owner types:

- Full-stack / security
- QA / ops
- Product / UX
- Product / frontend

Effort:

- Small to medium

Acceptance criteria:

- A transient network error cannot silently fail open on access checks.
- Supabase smoke is runnable against the intended launch environment, or cloud scope is explicitly waived.
- The README, user guide, and release checklist all describe the current product surface.
- Analysts sharing responsibility is handled with an explicit warning or guide instead of implied behavior.

Risk reduction:

- Prevents a false launch signal and removes the biggest credibility failures before any broader rollout.

| Task | Dependencies | Owner type | Effort | Acceptance criteria | Risk reduction / value |
| --- | --- | --- | --- | --- | --- |
| `AUTH-BL-01` Fail closed on transient access-check errors | None | Full-stack / security | S | Access checks either succeed or fail in a bounded degraded state; degraded-path coverage exists. | Removes a trust-boundary bypass risk. |
| `AUD-BL-02` Make Supabase smoke mandatory and repeatable | Smoke credentials and Supabase env | QA / ops | S | `npm run test:smoke` runs against the launch environment and is recorded in the release checklist, or cloud scope is explicitly waived. | Proves the real auth/save/reload path. |
| `AUD-BL-03` Align launch docs with the current product surface | None | Product / UX | S | README, user guide, and release checklist match the actual tabs and flows. | Prevents launch-day confusion and stale instructions. |
| `AUD-BL-04` Add explicit multi-analyst guardrails | Workflow rules from ops | Product / frontend | M | The app warns or guides when analysts share responsibility; the warning path is covered. | Reduces same-stream duplication and data corruption risk. |

## Phase 1 - Pre-launch excellence work

Objective:

- Make the launch surface dependable, accessible, supportable, and easy to operate without changing the product's scope.

Dependencies:

- Phase 0 complete.
- Stable test data and a repeatable release machine.
- Supabase function access for onboarding recovery work.

Owner types:

- QA / frontend
- Frontend / ops
- Full-stack
- UX / frontend
- Product

Effort:

- Small to medium, with one larger onboarding recovery item

Acceptance criteria:

- The new analysis flows are covered by meaningful E2E tests.
- One non-Chromium browser lane runs in release validation.
- Users can export diagnostics in a useful bundle.
- Onboarding retries do not leave partial bad state behind.
- Empty, loading, and first-use states make the next action obvious.

Risk reduction / value creation:

- Raises launch confidence without introducing large abstractions and makes the app easier to support in the field.

| Task | Dependencies | Owner type | Effort | Acceptance criteria | Risk reduction / value |
| --- | --- | --- | --- | --- | --- |
| `AUD-MH-01` Add launch-grade e2e coverage for possession/pass analysis | Stable test data | QA / frontend | M | Capture, finalize, filter, and edit analysis flows are covered. | Protects the newest high-value workflows from regression. |
| `AUD-MH-02` Expand browser coverage with one WebKit/mobile Safari lane | Stable e2e baseline | QA / frontend | M | One smaller non-Chromium lane runs on each release. | Catches browser-specific issues before broad launch. |
| `AUD-MH-03` Add support-grade diagnostics export | None | Frontend / ops | M | A user can export diagnostics in a useful bundle. | Gives support a shared failure artifact instead of browser-console-only clues. |
| `AUD-MH-04` Tighten onboarding idempotency and failure recovery | Supabase function access | Full-stack | M | Retrying onboarding does not leave partial bad state. | Prevents partial admin/setup failures from becoming launch blockers. |
| `AUD-CP-01` Reconcile release docs with the actual smoke and support flow | None | Product | S | The release checklist matches the real smoke and diagnostics path. | Reduces handoff mistakes and support confusion. |
| `AUD-CP-02` Improve empty, loading, and recovery states | None | UX / frontend | S | Important empty states explain the next action. | Makes failures and waiting states feel intentional and trustworthy. |
| `AUD-CP-03` Add a smaller first-use help path for orientation and half selection | None | Product / frontend | S | Users understand ends, half, and session scope before starting. | Reduces first-session mistakes and analyst hesitation. |

## Phase 2 - Early post-launch strengthening

Objective:

- Reduce change risk and improve the app's long-term value once the launch surface is stable.

Dependencies:

- Launch gate stable.
- A calm post-launch window.

Owner types:

- Senior frontend engineer
- Frontend
- Product / frontend

Effort:

- Medium to large

Acceptance criteria:

- `src/App.svelte` is materially smaller in responsibility, not just cosmetically reorganized.
- The main bundle is lighter because heavy paths are split or deferred.
- Analysts can save and restore common view states.
- Coach handoff outputs are easier to generate without manual rework.

Risk reduction / value creation:

- Lowers regression risk, improves performance, and creates repeatable workflows for heavier users.

| Task | Dependencies | Owner type | Effort | Acceptance criteria | Risk reduction / value |
| --- | --- | --- | --- | --- | --- |
| `AUD-FU-01` Split the largest shell responsibilities | None | Frontend | L | The largest state and tab logic lives in smaller units with focused tests. | Makes future changes safer and easier to reason about. |
| `AUD-FU-02` Code split heavy analysis and export paths | Shell decomposition helps | Frontend | M | The default path loads less code. | Reduces first-load cost and improves perceived performance. |
| `AUD-FU-03` Add saved views / presets for common analysis states | Stable baseline | Product / frontend | M | Users can restore a preferred state quickly. | Cuts repetitive filter setup and speed bumps in analysis workflows. |
| `AUD-FU-04` Improve coach handoff exports | Digest flow stability | Product / frontend | M | A coach-ready summary can be produced with less manual effort. | Increases post-match value without replacing the current digest flow. |

## Phase 3 - Strategic opportunity work

Objective:

- Only pursue these items if the product strategy later expands into adjacent capabilities.

Dependencies:

- Video or GPS strategy change, or a clearly justified product shift.
- Enough usage volume or business need to justify the added complexity.

Owner types:

- Product / platform
- Product / ML

Effort:

- Large

Acceptance criteria:

- Each item is backed by a real product strategy change, not speculation.
- No future-opportunity item is implemented as a disguised launch requirement.

Value creation:

- These items open new product surfaces, but only if the underlying capability becomes real.

| Task | Dependencies | Owner type | Effort | Acceptance criteria | Risk reduction / value |
| --- | --- | --- | --- | --- | --- |
| `AUD-FUT-01` Video-linked event review | Video strategy change | Product / platform | L | Events can be reviewed against clips without manual reconciliation. | High insight value if video becomes part of the product. |
| `AUD-FUT-02` GPS / movement / workload views | GPS strategy change | Product / platform | L | Movement or workload views use real tracking inputs. | Adds a performance lens if reliable tracking data becomes available. |
| `AUD-FUT-03` ML-assisted tagging or recommendations | Large labeled dataset | Product / ML | L | Suggestions improve capture speed without harming trust. | Could accelerate analysts later, but only after data quality is strong. |

## Recommended Execution Order

1. `AUTH-BL-01`
2. `AUD-BL-02`
3. `AUD-BL-03`
4. `AUD-BL-04`
5. `AUD-MH-01`
6. `AUD-MH-02`
7. `AUD-MH-03`
8. `AUD-MH-04`
9. `AUD-CP-01`
10. `AUD-CP-02`
11. `AUD-CP-03`
12. `AUD-FU-01`
13. `AUD-FU-02`
14. `AUD-FU-03`
15. `AUD-FU-04`
16. `AUD-FUT-01` if video strategy changes
17. `AUD-FUT-02` if GPS strategy changes
18. `AUD-FUT-03` if the team has a large labeled dataset and a real product reason for ML assistance

## Notes on Sequencing

- Phase 0 must be green before any launch recommendation changes from conditional to clear.
- Phase 1 is the lowest-risk place to finish the small polish items if the team wants the launch to feel finished rather than merely acceptable.
- Phase 2 is the right place to pay down the shell and bundle debt after launch pressure drops.
- Phase 3 is intentionally separated so video/GPS ideas do not sneak into the launch critical path.

## Feature Roadmap - Retrospective Conversion And Flow Analysis

This is the delivery plan for the first release slice of the kickout / turnover analysis work.
The deeper possession timing ideas are intentionally moved to the backlog so Phase 1 stays shippable.

Delivery principles:

- Do not infer conversion from event order.
- Keep capture-time UX unchanged.
- Only tag reviewed outcomes on recorded events after the match.
- Prefer a shared retrospective review model rather than one-off capture controls.

Recommended tag model:

- Kickout and turnover events get a retrospective conversion tag with `score`, `no_score`, or `unreviewed`.
- Score events get a retrospective source tag such as `kickout`, `turnover`, `settled`, `free`, or `other`.
- The exact field names can be finalized during implementation, but the product behavior should stay this simple.

### Phase 1 - Retrospective conversion and source tagging

Objective:

- Let analysts review a recorded match after the fact and answer the first group of questions without changing live capture.

Scope:

- Kickout-to-score conversion
- Turnover punishment rate
- Kickout type effectiveness
- Score-source mix
- Zone-based turnover danger
- Phase / momentum splits

Dependencies:

- Existing event edit flow and storage/sync pipeline
- Agreement on the review vocabulary
- Existing event order and match metadata

Owner types:

- Full-stack / frontend
- Frontend / UX
- QA / product

Effort:

- Small to medium

Acceptance criteria:

- An analyst can open a recorded kickout, turnover, or score and tag it retrospectively.
- Kickouts and turnovers can be counted as `score`, `no_score`, or `unreviewed` in edit-only mode.
- Scores can be tagged by source so score-source mix is reportable.
- Kickout type breakdowns can use contest type, break result, target player, and restart reason.
- Turnover danger can be grouped by zone and direction.
- Phase and momentum views can split first half, second half, and short time windows.
- Tags persist through local storage, Supabase sync, import/export, and CSV.
- Capture-time behavior does not change.

| Workstream | Scope | Exit criteria |
| --- | --- | --- |
| 1. Data model | Add the retrospective tag fields to event normalization, storage, sync, import/export, and schema. | Tags round-trip on existing records without data loss. |
| 2. Retrospective edit UX | Add edit-only controls to the recorded-event editor and events table edit path. | An analyst can tag score source or conversion after the match. |
| 3. Reporting surfaces | Add kickout, turnover, score-source, zone, and phase summaries. | The Phase 1 questions are visible in analytics. |
| 4. Validation | Add unit, component, and E2E coverage for tagging, persistence, and summaries. | The phase can ship behind the normal release gate. |

Recommended execution order:

1. Decide the exact tag vocabulary.
2. Add schema and normalization support.
3. Wire the retrospective edit controls.
4. Add the first reporting cards and breakdown tables.
5. Add tests for edit, save, reload, import, export, and analytics.
6. Release through the normal check/build/test gate.

Notes:

- This is a small-to-medium feature family, not a rewrite.
- The same tag backbone should serve all six Phase 1 questions.
- The more detailed possession timing ideas below are intentionally parked in the backlog so Phase 1 stays focused.

## Feature Backlog - Follow-Up Possession Analysis

The second-piece items are listed in `docs/go-live/backlog.md` under the analysis follow-up section.
They depend on the Phase 1 retrospective tagging backbone and are best treated as follow-up work, not launch-critical scope.
