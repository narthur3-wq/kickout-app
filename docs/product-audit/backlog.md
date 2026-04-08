# Backlog

Priority order is based on launch risk first, then user value, then engineering cost.

## Improvement Recommendations

1. Treat access control as a real product boundary: either fail closed or show an explicit degraded state.
2. Make Supabase smoke a required release signal, not a best-effort manual step.
3. Reduce shell density through progressive disclosure and targeted component splits.
4. Keep supportability and multi-analyst guardrails in the product flow, not just in docs.
5. Expand browser coverage with one non-Chromium lane before broad launch.

## Launch Blockers

| ID | Title | Priority score | Severity | Category | Impact | Why now | Effort | Owner type | Dependencies | Acceptance criteria | Test requirements | Rollout notes | File / module refs |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-BL-01 | Fail closed on transient access-check errors | 99 | blocker | security / reliability | Release access can be bypassed on a network blip. | A trust boundary should not fail open in a launch app. | S | Full-stack / security | None | Access checks either succeed or fail in a bounded degraded state. | Unit/component test for the degraded path. | Fix before any broader launch signoff. | `src/lib/supabase.js`, `src/App.svelte`, `src/lib/Login.svelte` |
| AUD-BL-02 | Make Supabase smoke mandatory and repeatable | 95 | blocker | release readiness / operations | Cloud auth/save/reload can be broken without being exercised. | The launch path needs a cloud confidence check, not an optional skip. | S | QA / ops | Smoke credentials, Supabase env | Smoke is runnable and part of the release gate. | End-to-end smoke on a dedicated account. | Document the env and keep it current. | `tests/e2e/supabase-smoke.spec.js`, `README.md`, `documentation/release-checklist.md` |
| AUD-BL-03 | Align launch docs with the current product surface | 93 | high | product / docs | New users can land in the wrong mental model. | Docs drift is a launch credibility issue, not a cosmetic issue. | S | Product / UX | None | README, user guide, and checklist describe the current tabs and flows. | Doc review plus sanity check against the shell. | Update in one pass to avoid stale fragments. | `README.md`, `documentation/user-guide.md`, `documentation/technical-spec.md`, `documentation/release-checklist.md` |
| AUD-BL-04 | Add explicit multi-analyst guardrails | 90 | high | functionality / operations | Same-stream duplication can corrupt data. | This is a real live workflow risk. | M | Product / frontend | Workflow rules from ops | The app warns or guides when analysts share responsibility. | E2E or component coverage for the warning path. | Keep the first version simple. | `documentation/technical-spec.md`, `src/App.svelte`, `src/lib/PossessionAnalysisPanel.svelte` |

## Pre-launch Must-Haves

| ID | Title | Priority score | Severity | Category | Impact | Why now | Effort | Owner type | Dependencies | Acceptance criteria | Test requirements | Rollout notes | File / module refs |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-MH-01 | Add launch-grade e2e coverage for possession/pass analysis | 88 | high | QA | The newest analysis workflows are too important to leave lightly tested. | The product surface has grown beyond the original live capture flows. | M | QA / frontend | Stable test data | Capture, finalize, filter, and edit analysis flows are covered. | Playwright flow coverage for possession/pass tabs. | Add tests before more analysis polish. | `tests/e2e`, `src/lib/PossessionAnalysisPanel.svelte` |
| AUD-MH-02 | Expand browser coverage with one WebKit/mobile Safari lane | 84 | medium | QA | Chromium-only coverage leaves browser-specific regressions exposed. | The app is mobile-first and should not lean on one engine only. | M | QA / frontend | Stable e2e baseline | One smaller non-Chromium lane runs on each release. | Browser-matrix or smoke subset covering WebKit. | Keep the lane small and focused. | `playwright.config.js`, `tests/e2e` |
| AUD-MH-03 | Add support-grade diagnostics export | 83 | medium | reliability / support | Field failures are hard to debug today. | Operational confidence matters at launch. | M | Frontend / ops | None | A user can export diagnostics in a useful bundle. | Unit/component test for formatting and copying. | Keep local storage but add a shared export format. | `src/lib/diagnostics.js`, account/settings UI |
| AUD-MH-04 | Tighten onboarding idempotency and failure recovery | 82 | high | reliability / backend | Partial onboarding failures can leave operators in a bad state. | Admin flows are production critical. | M | Full-stack | Supabase function access | Retrying onboarding does not leave partial bad state. | Function-level tests or scripted smoke. | Make this safe before public rollout. | `supabase/functions/onboard-user/index.ts` |

## High-value Follow-ups

| ID | Title | Priority score | Severity | Category | Impact | Why now | Effort | Owner type | Dependencies | Acceptance criteria | Test requirements | Rollout notes | File / module refs |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-FU-01 | Split the largest shell responsibilities | 78 | medium | architecture | Reduces regression risk and makes future changes safer. | The shell is already large enough to slow safe iteration. | L | Frontend | None | The largest state and tab logic lives in smaller units. | Component regression coverage around split boundaries. | Do it in slices, not a rewrite. | `src/App.svelte`, `src/lib/PossessionAnalysisPanel.svelte` |
| AUD-FU-02 | Code split heavy analysis and export paths | 76 | medium | performance | Improves load time and field responsiveness. | The main bundle is already over the warning threshold. | M | Frontend | Shell decomposition helps | Default path loads less code. | Build-size check plus basic UX sanity. | Lazy-load only the heavy tabs. | `src/App.svelte`, `src/lib/PassImpactPanel.svelte`, `src/lib/PossessionAnalysisPanel.svelte` |
| AUD-FU-03 | Add saved views / presets for common analysis states | 68 | medium | UX | Cuts repetitive filter setup. | Analysts repeat the same views often. | M | Product / frontend | Stable baseline | User can restore a preferred state quickly. | Component tests for preset restore. | Keep scope narrow. | analysis panels |
| AUD-FU-04 | Improve coach handoff exports | 66 | medium | product | Makes the app more valuable after the live period ends. | The coach handoff is a monetizable moment. | M | Product / frontend | Digest flow stability | A coach-ready summary can be produced with less manual effort. | E2E for export/share path. | Extend, do not replace, the current digest. | `src/lib/DigestPanel.svelte`, export helpers |

## Cleanup and Polish

| ID | Title | Priority score | Severity | Category | Impact | Why now | Effort | Owner type | Dependencies | Acceptance criteria | Test requirements | Rollout notes | File / module refs |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-CP-01 | Reconcile release docs with the actual smoke and support flow | 60 | low | docs / release | Reduces confusion during handoff and support. | Easy to do and easy to neglect. | S | Product | None | Release checklist matches reality. | Manual doc review. | Keep language specific, not aspirational. | `documentation/release-checklist.md`, `README.md` |
| AUD-CP-02 | Improve empty, loading, and recovery states | 58 | low | UX | Users trust the app more when failures are legible. | These states are common in the field. | S | UX / frontend | None | Important empty states explain the next action. | Component tests for key fallbacks. | Add to the heaviest screens first. | `src/App.svelte`, analysis panels |
| AUD-CP-03 | Add a smaller first-use help path for orientation and half selection | 55 | low | UX | Reduces first-session mistakes. | The product assumes too much analyst context. | S | Product / frontend | None | Users understand ends, half, and session scope before starting. | Smoke component test. | Keep it short and contextual. | `src/lib/PossessionAnalysisPanel.svelte`, capture UI |

## Future Opportunities

| ID | Title | Priority score | Severity | Category | Impact | Why now | Effort | Owner type | Dependencies | Acceptance criteria | Test requirements | Rollout notes | File / module refs |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-FUT-01 | Video-linked event review | 30 | medium | strategic | High insight value if the product strategy later includes clip review. | Only worthwhile if video becomes a real product capability. | L | Product / platform | Video strategy change | Events can be reviewed against clips without manual reconciliation. | Future integration tests. | Do not fake this without real video. | future media layer |
| AUD-FUT-02 | GPS / movement / workload views | 28 | medium | strategic | High if the product later integrates player tracking. | Only worthwhile if reliable tracking data becomes available. | L | Product / platform | GPS strategy change | Movement or workload views use real tracking inputs. | Future data-quality checks. | Not a near-term need. | future tracking layer |
| AUD-FUT-03 | ML-assisted tagging or recommendations | 25 | low | strategic | Could speed up analysts later. | Useful only after the workflow and data quality are already strong. | L | Product / ML | Large labeled dataset | Suggestions improve capture speed without harming trust. | Future offline evaluation. | Do not build this before the basics are stable. | future analytics layer |

## Recommended Execution Order

1. AUTH-BL-01
2. AUD-BL-02
3. AUD-BL-03
4. AUD-BL-04
5. AUD-MH-01
6. AUD-MH-02
7. AUD-MH-03
8. AUD-MH-04
9. AUD-FU-01
10. AUD-FU-02

## Quick Wins Under Half a Day

- Update the README and user guide to reflect the current analysis tabs.
- Make the launch checklist match the current smoke and diagnostics path.
- Clarify the multi-analyst operating rule in the docs.
- Add a support note explaining how to export diagnostics locally.
- Add a browser-matrix note so release owners know Chromium-only coverage is not enough.

## Highest-Risk Hidden Gotchas

- Access checks can still fail open on a transient network error.
- Concurrent analysts can still duplicate the same event stream.
- Smoke testing can be skipped by missing environment configuration.
- Onboarding can leave partial admin state if one step fails.
- The largest shell files make regressions harder to isolate.

## Do-Not-Do List

- Do not treat a fail-open access check as a hard security boundary.
- Do not start a video rewrite before the manual workflow is trusted.
- Do not add GPS-style abstractions without a real tracking source.
- Do not split into microservices or a backend rewrite to solve shell maintainability.
- Do not add generic AI tagging before the product has stable, well-labeled data.
- Do not add more visual polish before the launch gates are reliable.
