# Pairc Product And Engineering Audit

Audit date: 2026-04-07

Launch recommendation: NO-GO

## Executive Summary

Pairc is a coherent, genuinely useful match-day analyst tool. The local-first architecture is the right default for the problem, the feature set is domain-specific, and the repo has real testing and deployment discipline.

It is not yet excellent by production standards. The biggest issue is not a missing feature so much as concentration of responsibility: the app shell still owns too much behavior, some feature panels are becoming second-order monoliths, and the docs are not consistently aligned with shipped naming and workflows. The release gate is stronger than it was earlier in the audit, but the access boundary is still too permissive and the cloud path is still too easy to skip.

The product is coherent without video or GPS. Those constraints do not block a credible launch. What does block launch confidence is operational reliability, test determinism, and maintainability.

## Overall Verdict

The app is good enough for a controlled team pilot. It is not yet excellent enough for a broad production launch.

### Launch Recommendation

NO-GO

Reasons:

1. The access gate can still fail open on transient Supabase errors.
2. The cloud smoke path is still optional rather than enforced.
3. Product docs do not yet fully match the current UI and workflow surface.
4. Multi-analyst and supportability gaps need explicit launch handling.
5. The largest shell components need a first pass at decomposition or lazy loading.

### Fixed During This Audit Pass

- `npm run test:coverage` now passes reliably in the repo because the temp output path is prepared before coverage starts.
- The login, events search, and summary dialog now have visible labels and keyboard-friendly behavior.
- `README.md` and the release checklist now call out the current analysis migrations.

## Scorecards

| Area | Score | Assessment |
| --- | ---: | --- |
| Functionality | 7.5/10 | Strong core job coverage, but collaboration and operational guardrails are still thin. |
| UI | 6.5/10 | Functional and mostly coherent, but dense and utilitarian in the heavier analysis surfaces. |
| UX | 6/10 | Good for experienced analysts; weaker on first-use guidance, recovery, and edge-case confidence. |
| Repo structure | 5.5/10 | Understandable, but too much logic is concentrated in a few oversized files. |
| Architecture | 6/10 | The local-first/Supabase split is sensible, but the shell is carrying too much. |
| Testing | 6/10 | Good breadth and now green, but smoke and browser coverage remain weak. |
| Performance | 5.5/10 | Acceptable for a specialist app, but the main bundle is too large for a polished mobile-first product. |
| Release readiness | 4/10 | Useful product, but the access gate and smoke posture keep it out of launch territory. |

## Top 10 Issues

### AUTH-01 - Access checks fail open on transient network errors
- **Severity:** blocker
- **Category:** security / reliability
- **Why it matters:** A transient Supabase failure can bypass the access gate during sign-in or refresh.
- **Evidence:** `src/lib/supabase.js` returns `true` in the `catch` path for `userHasAccess()`, and `src/App.svelte` calls that helper during auth handling.
- **What is missing or weak:** The product does not have a clearly bounded degraded mode or a fail-closed access policy.
- **Recommended fix:** Fail closed on access-check errors, or replace the boolean helper with an explicit degraded-state flow and UI.
- **Effort:** S
- **Confidence:** high

### AUD-02 - Documentation lags the actual product surface
- **Severity:** high
- **Category:** product / UX / docs
- **Why it matters:** Launch-quality software must explain itself accurately.
- **Evidence:** `documentation/post-match-player-analysis.md` still refers to the older Feature 2 naming and deferred-editing language, and `documentation/technical-spec.md` still trails some of the shipped analysis workflow details.
- **What is missing or weak:** The deeper product docs do not fully match the product people actually see in the shell.
- **Recommended fix:** Update the README, user guide, technical spec, and release checklist so they describe the live tabs, analysis workflows, and verification steps that actually exist.
- **Effort:** M
- **Confidence:** high

### AUD-03 - Supabase smoke is optional instead of a hard launch gate
- **Severity:** high
- **Category:** release readiness / operations
- **Why it matters:** A production launch needs one end-to-end cloud path that is always exercised.
- **Evidence:** `tests/e2e/supabase-smoke.spec.js` skips when Supabase env vars and smoke credentials are missing.
- **What is missing or weak:** There is no always-on, repeatable smoke path for cloud auth/save/reload.
- **Recommended fix:** Establish a dedicated smoke environment and make the smoke path part of the release signoff.
- **Effort:** S
- **Confidence:** high

### AUD-04 - Global shell overload buries the primary workflow
- **Severity:** high
- **Category:** UX / product architecture
- **Why it matters:** The app asks the user to process too many equal-priority destinations at once, which makes first-use and fast switching harder than they should be.
- **Evidence:** `src/App.svelte` exposes Capture, Live, Digest, Possession Analysis, Pass Destination, Kickouts, Shots, Turnovers, Events, and Admin together in one top-level shell, alongside sync and diagnostics chrome.
- **What is missing or weak:** Stronger progressive disclosure and a clearer primary path per state.
- **Recommended fix:** Collapse less-used destinations behind a secondary menu or more deliberate task grouping, and reduce banner stacking.
- **Effort:** M
- **Confidence:** high

### AUD-05 - The app shell and possession panel are too monolithic
- **Severity:** high
- **Category:** architecture / maintainability
- **Why it matters:** A few very large files are a regression risk and slow down safe iteration.
- **Evidence:** `src/App.svelte` is 3311 lines, and `src/lib/PossessionAnalysisPanel.svelte` is 1746 lines.
- **What is missing or weak:** Clearer component boundaries and smaller state ownership units.
- **Recommended fix:** Extract stable subcomponents and move tab-specific logic behind smaller units or lazy-loaded modules.
- **Effort:** L
- **Confidence:** high

### AUD-06 - The client bundle is too large for a polished mobile-first app
- **Severity:** high
- **Category:** performance
- **Why it matters:** A 500kB+ main chunk hurts first load and update confidence on weaker devices.
- **Evidence:** `vite build` reports `assets/index-BoOiR20w.js` at 527.92 kB minified and warns about chunks over 500 kB.
- **What is missing or weak:** Code splitting for tab-heavy and export-heavy paths.
- **Recommended fix:** Split analysis tabs and export features with dynamic imports and manual chunking where it clearly reduces the main path.
- **Effort:** M
- **Confidence:** high

### AUD-07 - Browser and viewport coverage is too narrow
- **Severity:** medium
- **Category:** QA / runtime
- **Why it matters:** The app is mobile-first, but the E2E matrix is Chromium-only with a single viewport, so browser-specific layout and focus regressions can slip through.
- **Evidence:** `playwright.config.js` runs with `browserName: 'chromium'`, `workers: 1`, `retries: 0`, and one fixed viewport.
- **What is missing or weak:** At least one additional browser or mobile Safari/WebKit lane.
- **Recommended fix:** Add one smaller WebKit or mobile Safari smoke lane, even if the full suite stays Chromium-only.
- **Effort:** M
- **Confidence:** high

### AUD-08 - Diagnostics are local-only
- **Severity:** medium
- **Category:** reliability / supportability
- **Why it matters:** Field failures are hard to debug if the support path is only local storage.
- **Evidence:** `src/lib/diagnostics.js` stores diagnostics in localStorage only.
- **What is missing or weak:** No remote incident capture, no central error view, no app-level telemetry.
- **Recommended fix:** Add an exportable diagnostics bundle now and consider remote collection if the app grows beyond a small trusted team.
- **Effort:** M
- **Confidence:** medium

### AUD-09 - The onboarding edge function is not fully atomic
- **Severity:** high
- **Category:** reliability / ops
- **Why it matters:** Onboarding is a production-critical admin path.
- **Evidence:** `supabase/functions/onboard-user/index.ts` creates team, auth user, and allowed_users entries in separate steps, with only best-effort cleanup on one failure path.
- **What is missing or weak:** Strong end-to-end idempotency and failure recovery.
- **Recommended fix:** Tighten the onboarding flow so it is safe to retry and leaves less partial state behind.
- **Effort:** M
- **Confidence:** high

### AUD-10 - Concurrent analysts can still duplicate the same live event
- **Severity:** high
- **Category:** functionality / workflow reliability
- **Why it matters:** This is a real operational failure mode in the app's core use case.
- **Evidence:** `documentation/multi-analyst-setup.md` explicitly warns that two analysts can work the same match and `documentation/technical-spec.md` says the app does not deduplicate same-stream events.
- **What is missing or weak:** There is no detection, warning, or merge strategy for same-stream duplication.
- **Recommended fix:** Add explicit role split guardrails and, if possible, duplicate-event detection or reconciliation support.
- **Effort:** M
- **Confidence:** high

## Top 10 Strengths Worth Preserving

1. The app solves a real live match-day job rather than trying to be a generic sports platform.
2. The offline-first/local-first persistence model is the right default for field use.
3. The explicit match entity model is a meaningful improvement over the older implicit key approach.
4. The shell separates capture, live read, digest, analysis, and events into understandable user jobs.
5. The possession and pass analysis work is internally coherent and now has its own workflow surface.
6. The product already includes import/export and basic recovery paths, which is practical for analysts.
7. The login, search, and summary-dialog trust moments were improved during this audit pass without broad code churn.
8. The documentation set is present and mostly organized, which makes the repo approachable.
9. The test suite already covers real user flows rather than only isolated units.
10. The app is deployable on Vercel without a heavy backend deployment process.

## What Is Missing

- a reliable, non-optional Supabase smoke path
- fail-closed or explicitly degraded access control
- support-grade error and diagnostics handling
- duplicate-event guardrails for multiple analysts
- docs that match the current product surface
- smaller, safer shell boundaries
- a clearer launch checklist tied to real verification steps

## Validation Snapshot

- `npm run check:full` passed after the audit-pass fixes.
- `npm run test:e2e` passed with the Supabase smoke spec skipped because the smoke env vars were not set.
- `npm run build` passed with the existing large-chunk warning.

## Assumptions and Unknowns

Assumptions:

- the near-term market is a trusted club/team workflow, not a broad consumer product
- video and GPS are not available near term
- analysts will continue to use the app live on mobile/tablet-sized devices

Unknowns:

- how many teams will use this beyond a small trusted set
- whether support is expected to be self-serve or operator-assisted
- whether the app will need to handle active multi-analyst collaboration at scale
- whether launch targets require stronger analytics than the current live/capture use case
