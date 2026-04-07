# Go-Live Backlog

Audit date: 2026-04-06

One small audit fix already landed:

- [`tests/e2e/match-summary.spec.js:24-27`](../../tests/e2e/match-summary.spec.js) was updated to current Live panel copy so the digest-summary E2E is green again.

Each backlog item maps back to the findings in `docs/go-live/audit.md`.

## Launch blockers

### BL-01

- ID: BL-01
- Title: Stabilize the coverage gate and make `check:full` deterministic
- Source finding(s): GL-01
- Priority score: 98
- Severity: blocker
- User/business impact: release confidence is not trustworthy while the main validation gate can fail nondeterministically
- Technical risk: CI and local release prep can fail for tooling reasons unrelated to app behavior
- Effort: M
- Owner type: frontend engineer or test/tooling owner
- Dependencies: none
- Acceptance criteria:
  - `npm run test:coverage` passes reliably on the supported release machine
  - `npm run check:full` is green and repeatable
  - the chosen fix is documented in the repo if it depends on a platform-specific constraint
- Test requirements:
  - run `npm run test:coverage` at least twice on the supported release machine
  - run `npm run check:full`
- Rollout notes: do not “solve” this with an undocumented local-only command
- File/module references:
  - `package.json`
  - `.github/workflows/ci.yml`
  - `vitest.config.js`

### BL-02

- ID: BL-02
- Title: Execute the Supabase smoke path against the launch environment or explicitly remove cloud scope
- Source finding(s): GL-02
- Priority score: 97
- Severity: blocker
- User/business impact: shared sync and auth cannot be trusted on launch day without real-environment evidence
- Technical risk: the untested path is the one most likely to fail only after deploy
- Effort: S
- Owner type: QA / release engineer
- Dependencies: access to staging or production-like Supabase credentials
- Acceptance criteria:
  - `npm run test:smoke` passes against the intended launch environment
  - the result is recorded in `docs/go-live/release-checklist.md`
  - if cloud features are not launching, that scope decision is documented explicitly
- Test requirements:
  - run `npm run test:smoke`
  - perform one manual create-save-reload verification on a real device if cloud scope is in launch
- Rollout notes: this is mandatory if Supabase auth/sync is in scope
- File/module references:
  - `tests/e2e/supabase-smoke.spec.js`
  - `README.md`
  - `documentation/release-checklist.md`

### BL-03

- ID: BL-03
- Title: Verify onboarding and password-reset production configuration
- Source finding(s): GL-03
- Priority score: 94
- Severity: blocker
- User/business impact: admins can be blocked from onboarding users, and users can be blocked from resetting passwords, after deploy
- Technical risk: origin/redirect misconfiguration produces production-only failures
- Effort: S
- Owner type: Supabase / platform owner
- Dependencies: deployed domain and access to Supabase project settings
- Acceptance criteria:
  - `ALLOWED_ORIGIN` exactly matches the live app origin
  - Supabase Auth redirect URLs include the live app origin
  - admin onboarding works from the deployed app
  - password reset works from the deployed app
- Test requirements:
  - manual staging verification of invite or password onboarding path
  - manual staging verification of password reset
- Rollout notes: if admin onboarding is not in launch scope, record that scope decision
- File/module references:
  - `src/lib/AdminPanel.svelte`
  - `src/lib/Login.svelte`
  - `supabase/functions/onboard-user/index.ts`
  - `README.md`

## Pre-launch must-haves

### BL-04

- ID: BL-04
- Title: Add a supportable error-reporting path for sync, onboarding, and share failures
- Source finding(s): GL-04
- Priority score: 90
- Severity: high
- User/business impact: production issues are hard to diagnose, which increases launch-day support time and failed follow-up fixes
- Technical risk: device-local diagnostics disappear with storage clears or device loss and are not trendable
- Effort: M
- Owner type: frontend engineer with release/ops input
- Dependencies: Phase 0 complete
- Acceptance criteria:
  - sync, onboarding, and digest-share failures are visible somewhere outside browser console only
  - operators know where to look on launch day
  - the fallback local diagnostics path still works
- Test requirements:
  - simulate one failure in each path and verify the chosen reporting path captures it
  - keep diagnostics-related component tests green
- Rollout notes: prefer the lightest workable solution over a heavyweight monitoring stack
- File/module references:
  - `src/App.svelte`
  - `src/lib/AdminPanel.svelte`
  - `src/lib/DigestPanel.svelte`
  - `src/lib/diagnostics.js`

### BL-05

- ID: BL-05
- Title: Close key accessibility gaps and add one automated a11y regression check
- Source finding(s): GL-05
- Priority score: 88
- Severity: high
- User/business impact: unlabeled or weakly keyboard-accessible controls slow users down and create avoidable support issues
- Technical risk: custom UI can regress silently without explicit tests
- Effort: M
- Owner type: UX-minded frontend engineer
- Dependencies: none
- Acceptance criteria:
  - login inputs and event search have explicit accessible names
  - summary modal supports expected close and focus behavior
  - pitch interaction semantics are documented and tested
  - at least one automated a11y regression runs in the normal validation path
- Test requirements:
  - extend affected component tests
  - add one automated accessibility assertion or check over a representative path
  - rerun `npm run test:unit` and `npm run test:e2e`
- Rollout notes: improve semantics without changing the operator workflow
- File/module references:
  - `src/lib/Login.svelte`
  - `src/lib/EventsTable.svelte`
  - `src/lib/Pitch.svelte`
  - `src/lib/SummaryModal.svelte`

### BL-06

- ID: BL-06
- Title: Decide and document the offline fail-open access policy
- Source finding(s): GL-08
- Priority score: 82
- Severity: high
- User/business impact: avoids launch-day confusion about revoked users, device loss, and what “signed out” really means offline
- Technical risk: the current behavior is intentional but easy to misunderstand
- Effort: S
- Owner type: product owner plus engineering owner
- Dependencies: none
- Acceptance criteria:
  - the accepted offline access policy is documented in release docs
  - device-loss and urgent offboarding handling are documented
  - support knows what is and is not guaranteed while offline
- Test requirements:
  - no code change required unless policy changes
  - if behavior changes, add focused auth/offline tests
- Rollout notes: do not change this policy casually during launch week
- File/module references:
  - `src/lib/supabase.js`
  - `documentation/technical-spec.md`
  - `docs/go-live/release-checklist.md`

### BL-07

- ID: BL-07
- Title: Reduce initial payload or explicitly accept a measured budget exception
- Source finding(s): GL-06
- Priority score: 80
- Severity: high
- User/business impact: first install and first open are more painful than they should be on poor connectivity
- Technical risk: large bundles tend to stay large once accepted without a budget
- Effort: M
- Owner type: frontend engineer
- Dependencies: none
- Acceptance criteria:
  - a bundle budget is documented for the main entry chunk
  - at least one non-core surface is deferred or otherwise trimmed if it yields a clear win
  - the capture path remains unchanged or improves
- Test requirements:
  - rerun `npm run build`
  - rerun affected E2E navigation flows
- Rollout notes: avoid clever manual chunking unless a simple split is not enough
- File/module references:
  - `src/App.svelte`
  - `src/lib/DigestPanel.svelte`
  - `vite.config.js`

### BL-08

- ID: BL-08
- Title: Add a Windows validation path to release readiness
- Source finding(s): GL-09
- Priority score: 76
- Severity: medium
- User/business impact: prevents platform-specific release failures from surprising the team late
- Technical risk: the current gate only represents Ubuntu
- Effort: M
- Owner type: release / platform engineer
- Dependencies: BL-01
- Acceptance criteria:
  - CI or a documented pre-release automation covers the supported Windows path
  - the repo states which platform(s) are considered release-authoritative
- Test requirements:
  - run the chosen Windows validation path end-to-end
- Rollout notes: documented manual validation is acceptable if the team will actually run it
- File/module references:
  - `.github/workflows/ci.yml`
  - `package.json`

## Post-launch high-value work

### BL-09

- ID: BL-09
- Title: Extract the highest-risk orchestration seams from `src/App.svelte`
- Source finding(s): GL-07
- Priority score: 68
- Severity: high
- User/business impact: faster and safer future changes
- Technical risk: lower regression risk in auth, sync, diagnostics, and import/export behavior
- Effort: L
- Owner type: senior frontend engineer
- Dependencies: launch gate stable
- Acceptance criteria:
  - `src/App.svelte` no longer directly owns all auth/session, sync, diagnostics, and import/export orchestration
  - extracted units have focused tests
  - no user-visible behavior regressions are introduced
- Test requirements:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:e2e`
  - `npm run build`
- Rollout notes: no shell rewrite; extract seams only
- File/module references:
  - `src/App.svelte`
  - `src/lib/analysisSync.js`
  - `src/lib/syncState.js`
  - `src/lib/matchStore.js`
  - `src/lib/storageScope.js`

### BL-10

- ID: BL-10
- Title: Separate source docs from generated artifacts and document the true deploy artifact path
- Source finding(s): GL-10
- Priority score: 58
- Severity: medium
- User/business impact: lowers contributor confusion and release friction
- Technical risk: mixed artifact ownership causes stale-doc and stale-build mistakes
- Effort: M
- Owner type: repo / platform engineer
- Dependencies: none
- Acceptance criteria:
  - source docs and generated assets live in clearly different locations
  - the deployment artifact path is documented once and consistently
  - `docs/go-live/**` remains trackable in Git
- Test requirements:
  - verify the chosen docs/build workflow still works
- Rollout notes: keep the change mechanical and low-drama
- File/module references:
  - `docs/`
  - `documentation/`
  - `dist/`
  - `.gitignore`
  - `documentation/technical-spec.md`

### BL-11

- ID: BL-11
- Title: Refresh lagging patch and minor dependencies in small validated batches
- Source finding(s): GL-10
- Priority score: 46
- Severity: low
- User/business impact: reduces future upgrade pain and picks up tooling fixes
- Technical risk: patch/minor drift compounds over time
- Effort: M
- Owner type: repo / platform engineer
- Dependencies: BL-01
- Acceptance criteria:
  - Vitest, Playwright, Supabase, Svelte, and related tooling are reviewed and upgraded in small batches where appropriate
  - each batch stays green
- Test requirements:
  - rerun the full validation gate after each batch
- Rollout notes: keep major-version upgrades scoped separately
- File/module references:
  - `package.json`
  - `package-lock.json`

## Cleanup / polish

### BL-12

- ID: BL-12
- Title: Revisit deeper observability and performance only if usage proves the need
- Source finding(s): GL-04, GL-06
- Priority score: 28
- Severity: low
- User/business impact: helps later scale, but not necessary for the current launch goal
- Technical risk: low if deferred intentionally
- Effort: M
- Owner type: product engineer plus ops partner
- Dependencies: post-launch usage data
- Acceptance criteria:
  - deeper work is triggered by actual usage pain, not speculation
  - no unnecessary abstraction is introduced ahead of evidence
- Test requirements:
  - define these only when scope is concrete
- Rollout notes: this is intentionally not a launch task
- File/module references:
  - `src/App.svelte`
  - `src/lib/DigestPanel.svelte`
  - `vite.config.js`

## Recommended execution order

- BL-01
- BL-02
- BL-03
- BL-04
- BL-05
- BL-06
- BL-07
- BL-08
- BL-09
- BL-10
- BL-11
- BL-12

## Quick wins under half a day

- Run `npm run test:smoke` on staging and record the result in `docs/go-live/release-checklist.md`.
- Manually verify password reset and admin onboarding against the deployed domain with the real Supabase config.
- Add an explicit supported-platform note to the release checklist so Windows validation is not implied away.
- Add explicit labels to login and event-search inputs.
- Document the current offline fail-open access policy in release docs so support has a clear answer.

## Do not do

- Do not rewrite the app into SvelteKit to look more “production-grade”.
- Do not add a heavyweight monitoring stack before defining who will read and act on the signals.
- Do not introduce a global state library just to split `App.svelte`.
- Do not start hand-crafted chunking or architecture work before the release gate and cloud smoke path are stable.
