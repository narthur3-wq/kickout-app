# Go-Live Backlog

This backlog is organized by sprint so another engineer can pick up a sprint in isolation.

How to use it:
- Start with the highest-priority sprint that is not blocked.
- Read the objective, dependencies, and file references before changing code.
- Keep the docs in `docs/go-live/` in sync if scope or ordering changes.
- Run the tests listed for the sprint before moving on.

## Completed During Prior Audit

These are already done and stay here as context for the later sprints.

### BL-01 - Fix analytics landscape overflow on 1366x768 and comparable tablet layouts

- Source finding(s): `GL-01`
- Severity: blocker
- Outcome: completed during the earlier audit pass
- Why it mattered: analysts were landing on a broken analytics screen where the full pitch was not visible in a common landscape viewport
- Files involved: `src/lib/AnalyticsPanel.svelte`, `tests/e2e/layout.spec.js`

### BL-02 - Restore a green `npm run test:unit`

- Source finding(s): `GL-02`
- Severity: blocker
- Outcome: completed during the earlier audit pass
- Why it mattered: critical component and app-shell tests had been timing out, which weakened release confidence
- Files involved: `tests/component/App.test.js`, `tests/component/CaptureContextBanner.test.js`, `tests/component/CaptureForm.test.js`, `vitest.config.js`

### BL-03 - Make `npm run test:coverage` reliable on supported contributor platforms

- Source finding(s): `GL-02`
- Severity: blocker
- Outcome: completed during the earlier audit pass
- Why it mattered: a broken coverage command slows contributors and weakens the release checklist
- Files involved: `package.json`, `vitest.config.js`

## Sprint 0 - Release Hygiene And Handoff

Objective: decide whether the prior audit bundle should ship as one coherent set, then close the release-readiness gap around typechecking.

This sprint is intentionally a gate. Do not move into the feature sprints until the audit bundle decision is recorded and the typecheck path is clear.

### BL-00 - Resolve the prior audit bundle as one unit

- Source finding(s): prior go-live audit leftovers
- Severity: release hygiene
- Why it matters: the repo is dirty because an earlier audit left a small bundle of uncommitted changes behind, and they should be treated as one decision rather than piecemeal drift
- Files involved:
  - `.gitignore`
  - `src/lib/AnalyticsPanel.svelte`
  - `vitest.config.js`
  - `docs/go-live/audit.md`
  - `docs/go-live/roadmap.md`
  - `docs/go-live/backlog.md`
  - `docs/go-live/release-checklist.md`
- Acceptance criteria:
  - the audit bundle is explicitly kept or discarded as one coherent set
  - the go-live docs render cleanly in a real editor
  - the docs remain internally consistent after the decision
- Test requirements:
  - if the bundle is kept, verify the docs display cleanly and still match the release checklist
  - if the bundle is discarded, do it as a single reviewable change rather than file-by-file

### BL-04 - Add a supported `typecheck` command and make it green

- Source finding(s): `GL-03`, `GL-12`
- Severity: high
- Why it matters: missing type safety increases regression risk in a JS-heavy app with complex state and data transforms
- Dependencies: none, but this is a release-readiness gate for later refactors
- Files involved:
  - `package.json`
  - `jsconfig.json`
  - `src/lib/analyticsHelpers.js`
  - `src/lib/importMerge.js`
  - `src/lib/matchStore.js`
  - `src/lib/storageScope.js`
- Acceptance criteria:
  - `package.json` includes a documented `typecheck` script
  - the chosen typecheck path passes locally and in CI
  - the scope is correct for the app sources and does not fail on unrelated parsing noise
- Test requirements:
  - run `npm run typecheck`
  - keep `lint`, `test:unit`, `test:coverage`, `test:e2e`, and `build` green after adding it

## Sprint 1 - Trust The Data

Objective: make the kickout story and sync story trustworthy enough that coaches can rely on the app in live use.

This sprint should complete before any broader capture or analytics redesign. If the data trust is shaky, later UX work will not matter.

### BL-14 - Align kickout capture semantics and analytics totals with live operator expectations

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: blocker
- Why it matters: if the kickout tab shows only a fraction of the kickouts logged in one match, coaches and analysts will stop trusting the product
- Scope:
  - overall kickout outcome uses `Retained / Lost` from the perspective of the team taking the kickout
  - break-only result uses `Won / Lost / Neutral`
  - the kickout tab supports `Our kickouts`, `Their kickouts`, or `Both`
  - the reported `34 tracked, 9 shown` mismatch class stays covered by regression tests
- Files involved:
  - `src/lib/CaptureForm.svelte`
  - `src/App.svelte`
  - `src/lib/AnalyticsPanel.svelte`
  - `src/lib/liveInsights.js`
  - `tests/component/CaptureForm.test.js`
  - `tests/component/AnalyticsPanel.test.js`
  - `tests/component/App.test.js`
- Acceptance criteria:
  - the capture labels and analytics labels use the agreed kickout language consistently
  - the default kickout analytics view no longer silently drops valid captured kickouts
  - the tab makes the team perspective obvious
- Test requirements:
  - extend capture and analytics tests for the new kickout semantics
  - add one representative app-shell or E2E regression for the count mismatch

### BL-15 - Add an explicit sync banner and manual push path for pending cloud data

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: blocker
- Why it matters: analysts should not have to guess whether match data has left the device, especially when reviewing later on another screen
- Files involved:
  - `src/App.svelte`
  - `src/lib/syncState.js`
  - `tests/component/App.test.js`
  - `tests/e2e/supabase-smoke.spec.js`
- Acceptance criteria:
  - when pending sync exists or sync errors occur, a visible banner appears
  - the banner includes a manual `Sync now` action
  - queued events can be flushed without a manual tab refresh on the source device
  - release validation includes a verified cross-device sync check in the intended launch environment
- Test requirements:
  - extend app-shell tests for pending sync, error, and manual retry states
  - run the Supabase smoke or manual shared-device verification flow for launch evidence

### BL-05 - Execute the Supabase smoke path against the actual launch environment

- Source finding(s): `GL-05`
- Severity: blocker
- Why it matters: if cloud sync/auth is part of launch, the shared-user path still lacks real release evidence
- Dependencies: launch environment and smoke credentials
- Files involved:
  - `tests/e2e/supabase-smoke.spec.js`
  - `README.md`
  - `documentation/release-checklist.md`
- Acceptance criteria:
  - `npm run test:smoke` passes against the intended launch Supabase project
  - the run is recorded in the release checklist
  - if cloud sync is not launching, that scope decision is documented explicitly
- Test requirements:
  - run `npm run test:smoke`
  - optionally repeat the manual create-save-reload flow from the release checklist

Sprint 1 handoff notes:
- If kickout semantics move, keep the data model and the analytics labels aligned in the same change.
- If sync scope is still undecided, settle that before starting capture work.

## Sprint 2 - Live Capture Reliability

Objective: make live entry fast and obvious on the devices people actually use at the sideline or in the stand.

This sprint focuses on flow, layout, and the time model. Keep the implementation small and practical.

### BL-16 - Fit full capture data entry without scrolling on iPad landscape

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: high
- Why it matters: if analysts have to scroll to reach save or late-form fields during live capture, speed and confidence drop sharply
- Files involved:
  - `src/App.svelte`
  - `src/lib/CaptureForm.svelte`
  - `tests/e2e/layout.spec.js`
- Acceptance criteria:
  - core capture data entry is fully visible without scrolling on iPad landscape targets
  - the no-scroll constraint holds for kickout, shot, and turnover capture states
  - save remains visible without hunting for it
  - desktop and narrow mobile layouts do not regress
- Test requirements:
  - extend Playwright layout coverage with representative iPad landscape viewport(s)
  - verify capture reachability for kickout, shot, and turnover states

### BL-17 - Replace the shared clock with remembered per-period clocks and safe paused defaults

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: high
- Why it matters: analysts need each half timed independently, without losing the previous half clock if they tap the wrong period button
- Files involved:
  - `src/App.svelte`
  - `src/lib/analyticsHelpers.js`
  - `tests/component/App.test.js`
  - `tests/e2e/capture-flow.spec.js`
- Acceptance criteria:
  - `H1`, `H2`, and `ET` each keep their own remembered clock value
  - the first visit to a new period shows `0:00` paused
  - switching back to a previously timed period restores its earlier value
  - analytics that bucket by period and clock still behave correctly after the model change
- Test requirements:
  - extend app-shell timer tests for period switching and restore behavior
  - add or extend E2E coverage for the remembered-clock flow

### BL-19 - Reorder capture so `Team` leads the flow on every screen size

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: medium
- Why it matters: leading with team selection matches the operator's mental model and reduces friction in live entry
- Files involved:
  - `src/lib/CaptureForm.svelte`
  - `tests/component/CaptureForm.test.js`
  - `tests/e2e/layout.spec.js`
- Acceptance criteria:
  - `Team` appears above `Type` on capture across desktop, tablet, and mobile layouts
  - the revised order still fits the no-scroll landscape constraint from `BL-16`
  - no capture-state regressions are introduced
- Test requirements:
  - update capture form component tests for the new order
  - keep layout coverage green

### BL-20 - Make Events edit/delete actions obvious and left-aligned

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: medium
- Why it matters: if edit/delete controls are hard to spot, analysts will assume the Events tab is read-only
- Files involved:
  - `src/lib/EventsTable.svelte`
  - `tests/component/EventsTable.test.js`
  - `tests/component/App.test.js`
- Acceptance criteria:
  - event row actions are visually obvious at a glance
  - actions are placed on the left as agreed unless a better proven pattern emerges during implementation
  - delete no longer relies on a lone ambiguous `X` affordance
  - the current edit/delete flow remains intact
- Test requirements:
  - update Events table component tests for the revised action affordance
  - keep existing app-shell edit/delete tests green

Sprint 2 handoff notes:
- The layout work and the team/type reorder should be validated together because they share the same capture panel constraints.
- Keep timer changes isolated from analytics cleanup so the clock model stays easy to reason about.

## Sprint 3 - Match Model And Launch Hardening

Objective: extend the match model so it matches the real game, then close the highest-value usability and observability gaps.

This sprint is the last major pre-launch functionality step. Keep changes surgical and test them end-to-end.

### BL-18 - Extend shot capture and scoring for `Dropped short` and `Two Point`

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: high
- Why it matters: current shot capture cannot represent important review distinctions or scoring outcomes used in live match analysis
- Files involved:
  - `src/lib/CaptureForm.svelte`
  - `src/lib/score.js`
  - `src/lib/analyticsHelpers.js`
  - `src/lib/liveInsights.js`
  - `tests/component/CaptureForm.test.js`
  - `src/lib/score.test.js`
- Acceptance criteria:
  - shot capture supports `Dropped short` as a distinct outcome from `Saved`
  - shot capture supports `Two Point` as a first-class scoring result alongside `Point` and `Goal`
  - missed two-point shots are recorded as the actual miss outcome rather than as failed two-point attempts
  - score calculations, exports, live/digest reads, and analytics all handle the new taxonomy consistently
- Test requirements:
  - extend score/unit tests for the new scoring model
  - extend capture, analytics, and app-shell tests for the new shot taxonomy

### BL-06 - Close high-value accessibility gaps in login, search, pitch, and summary modal

- Source finding(s): `GL-07`
- Severity: high
- Why it matters: custom controls without solid accessible names and keyboard behavior exclude users and make assistive-tech support unpredictable
- Files involved:
  - `src/lib/Login.svelte`
  - `src/lib/EventsTable.svelte`
  - `src/lib/Pitch.svelte`
  - `src/lib/SummaryModal.svelte`
- Acceptance criteria:
  - login and events search inputs have explicit labels or equivalent accessible names
  - the summary modal supports expected close/focus behavior
  - the pitch interaction model is documented and tested for keyboard use
  - at least one automated a11y check is added for a representative flow
- Test requirements:
  - add or extend component tests for accessible names and keyboard close behavior
  - run the affected component tests plus E2E navigation

### BL-07 - Add a minimal production observability path

- Source finding(s): `GL-06`
- Severity: high
- Why it matters: production failures become much harder to diagnose once users leave the developer console behind
- Files involved:
  - `src/App.svelte`
  - `src/lib/AdminPanel.svelte`
  - `src/lib/DigestPanel.svelte`
  - `src/lib/diagnostics.js`
- Acceptance criteria:
  - sync, onboarding, and digest-share failures are visible somewhere operators can actually review
  - the chosen approach is documented in the release checklist
  - local diagnostics remain usable as a fallback support artifact
- Test requirements:
  - verify a simulated sync/onboarding/share failure is captured by the chosen path
  - keep existing diagnostics tests green

Sprint 3 handoff notes:
- Do not start the observability work before the new shot model is stable, because shared state and failure reporting both depend on the same capture semantics.
- The a11y work should improve semantics without changing the operator workflow.

## Sprint 4 - Performance And Change Safety

Objective: make the app cheaper to load and safer to change without rewriting the shell.

This sprint should stay incremental. No broad architecture work unless it clearly reduces present risk.

### BL-08 - Reduce first-load cost where there is clear low-churn payoff

- Source finding(s): `GL-08`
- Severity: medium
- Why it matters: field users on weak connectivity feel install and first-open pain most sharply
- Files involved:
  - `src/App.svelte`
  - `src/lib/DigestPanel.svelte`
  - `package.json`
  - `vite.config.js`
- Acceptance criteria:
  - a bundle budget is documented for the main entry chunk
  - at least one non-core surface is deferred or split without hurting the capture path
  - build output shows an improved or explicitly accepted bundle profile
- Test requirements:
  - rerun `npm run build`
  - rerun E2E navigation on affected lazy-loaded surfaces

### BL-09 - Extract the highest-risk shell concerns out of `src/App.svelte`

- Source finding(s): `GL-04`
- Severity: high
- Why it matters: future changes stay expensive and risky if the shell remains this concentrated
- Files involved:
  - `src/App.svelte`
  - `src/lib/syncState.js`
  - `src/lib/matchStore.js`
  - `src/lib/storageScope.js`
- Acceptance criteria:
  - `src/App.svelte` no longer directly owns all auth, sync, and import/export orchestration
  - extracted modules/components have focused tests
  - no user-visible behavior regressions are introduced
- Test requirements:
  - full `lint`, `typecheck`, `test:unit`, `test:coverage`, `test:e2e`, and `build`

### BL-12 - Expand validation coverage beyond Ubuntu-only CI

- Source finding(s): `GL-09`
- Severity: medium
- Why it matters: platform-specific validation failures are easier to miss when CI only represents one OS
- Files involved:
  - `.github/workflows/ci.yml`
  - `package.json`
  - `vitest.config.js`
- Acceptance criteria:
  - CI or a documented pre-release automation covers the supported local platform risk
  - the chosen validation matrix is documented in the repo
- Test requirements:
  - verify all configured matrix jobs or smoke validations pass

Sprint 4 handoff notes:
- Keep performance work separate from shell extraction if one would slow the other down.
- Do not expand the validation matrix faster than the team can maintain it.

## Sprint 5 - Repo And Platform Cleanup

Objective: tidy the repository and surrounding release hygiene so the project is easier to maintain after launch.

This sprint is mostly platform and documentation cleanup. It should not block the feature work in earlier sprints.

### BL-10 - Separate source docs from generated static artifacts

- Source finding(s): `GL-09`
- Severity: medium
- Why it matters: future release work and documentation updates are harder to reason about than they should be
- Files involved:
  - `docs/`
  - `dist/`
  - `.gitignore`
  - `documentation/technical-spec.md`
- Acceptance criteria:
  - generated output and source docs live in clearly different locations
  - the intended deployment artifact path is documented
  - the go-live docs path remains trackable in Git
- Test requirements:
  - confirm the chosen doc/build workflow still produces the intended artifact

### BL-13 - Refresh lagging dependencies in small verified batches

- Source finding(s): `GL-10`
- Severity: low
- Why it matters: dependency drift compounds future upgrade pain and may mask tooling bug fixes
- Files involved:
  - `package.json`
  - `package-lock.json`
- Acceptance criteria:
  - patch or minor upgrades for test/framework tooling land in small batches
  - each batch ships with green validation
  - any major-version adoption is treated as a separate scoped change
- Test requirements:
  - full validation after each batch

### BL-11 - Add public metadata only if the deployed URL is truly public-facing

- Source finding(s): `GL-11`
- Severity: low
- Why it matters: improves share quality and discoverability if the app URL is marketed publicly
- Files involved:
  - `index.html`
  - `README.md`
  - `documentation/product-positioning.md`
- Acceptance criteria:
  - `index.html` includes a minimal accurate description and share metadata
  - metadata reflects the real product positioning
- Test requirements:
  - inspect generated HTML after build

Sprint 5 handoff notes:
- Keep metadata, docs, and build artifacts aligned so the release story stays easy to understand.
- If the app is not public-facing, skip BL-11 rather than forcing it into the release path.

## Sprint 6 - Later Product Decision

Objective: decide whether a secondary total-match-time display is worth shipping after the half-by-half clock model has been proven in use.

This sprint is explicitly out of scope for the current implementation pass.

### BL-21 - Evaluate whether a secondary total-match-time display adds real coaching value

- Source finding(s): first live-use feedback (2026-04-01)
- Severity: low
- Why it matters: a secondary total-time read might help some analysts later, but it is not core to the agreed half-by-half timing workflow
- Files involved:
  - `src/App.svelte`
  - `src/lib/analyticsHelpers.js`
- Acceptance criteria:
  - the product decision is documented before implementation
  - if adopted, total time is clearly secondary and does not replace per-period clocks
  - the added display does not complicate live capture interactions
- Test requirements:
  - if implemented later, add focused timer coverage only

## Regression Guardrails

- Keep `BL-14`, `BL-15`, and `BL-05` together in the trust sprint until the kickout and sync stories are stable.
- Keep `BL-16`, `BL-17`, `BL-19`, and `BL-20` together in the live-capture sprint because they all affect the operator flow on the same screen.
- Keep `BL-18`, `BL-06`, and `BL-07` together in the match-model sprint so the new shot taxonomy, accessibility, and observability stay synchronized.
- Treat `BL-09` and `BL-12` as shell-safety work that should only start after the launch-critical user flows are calm.

## Do Not Do

- Do not rewrite the app into SvelteKit just to feel more production-grade.
- Do not replace Supabase unless the current launch scope actually proves it insufficient.
- Do not add a heavyweight global state library before extracting the existing shell concerns.
- Do not introduce a complex monitoring stack before defining who will read and act on the signals.
- Do not broaden the product into a generic season-management platform while launch blockers remain open.

## Post-Launch Product Track (Not In Go-Live Scope)

Phase 2 post-match analysis work is tracked in `documentation/post-match-player-analysis.md` and the A-series backlog. The app already ships the local-first Phase 2a cross-match view; the remaining work is Supabase sync hardening and trend comparison, both intentionally outside the go-live sprint plan.

Current hardening path:
- squad roster + stable player ID model (Admin settings; local today, Supabase later)
- analysis session sync to Supabase

Primary Phase 2 delivery:
- cross-match possession aggregation (Phase 2a)

Deferred follow-on:
- trend comparison (Phase 2b) after enough data exists
