# Go-Live Audit

Audit date: 2026-04-06

## Executive Summary

Pairc is now in **GO WITH CONDITIONS** territory from this working tree.

During this audit I made two small, high-confidence fixes:

- `package.json` now runs `typecheck` inside `check` and `check:full`
- `tests/e2e/match-summary.spec.js` now matches the shipped Live copy, which restored a green full E2E suite

Current validation evidence from this working tree:

- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run test:unit` - passed (`29` files, `187` tests)
- `npm run test:coverage` - passed from a clean `coverage/` directory (`77.43%` statements, `61.99%` branches, `77.19%` functions, `79.21%` lines)
- `npm run test:e2e` - passed (`22` green, `1` skipped Supabase smoke)
- `npm run build` - passed
- `npm run check:full` - passed
- `npm run test:smoke` - skipped because launch-environment Supabase credentials were not available
- `npm audit --omit=dev --audit-level=moderate` - passed with `0` production vulnerabilities
- `npm outdated --long` - showed manageable but real framework/tooling drift

The app is credible for a focused launch because the local quality gate is now green, the product is clearly scoped, and the offline-first architecture fits the match-day operating environment. It still should **not** ship as an unqualified GO until the launch-environment auth/sync path is proven and the remaining pre-launch UX, accessibility, and operations gaps are addressed.

## Launch Recommendation

**GO WITH CONDITIONS**

Conditions to reach an unqualified GO:

- Run `npm run test:smoke` against the actual launch Supabase project, or explicitly document that launch excludes cloud auth/sync.
- Close the essential accessibility gaps on login, search, pitch interaction, and modal keyboard handling.
- Define the production failure path for sync, onboarding, and digest sharing so launch-day issues are observable by a named owner.

## Fixes Applied During Audit

### FX-01 - Release gate now includes typecheck

- Files: `package.json`
- Why it mattered: the repo had a working `typecheck` script, but the main release gate did not actually enforce it.
- Validation: `npm run check:full` now includes `typecheck` and passed locally.

### FX-02 - Stale E2E expectation aligned with shipped copy

- Files: `tests/e2e/match-summary.spec.js`
- Why it mattered: the full E2E suite was failing because the test expected older Live-panel wording.
- Validation: `npm run test:e2e` and `npm run check:full` both passed after the update.

## Top 10 Findings By Impact

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| GL-01 | blocker | Release readiness | Launch-environment Supabase auth/sync is still unproven in this audit |
| GL-02 | high | Architecture | `src/App.svelte` is still too concentrated for safe long-term change |
| GL-03 | high | Performance | The app ships one heavy initial client bundle and pays initial load cost for nearly every feature |
| GL-04 | high | UX / Accessibility | Essential accessibility gaps remain on login, search, pitch interaction, and modal behavior |
| GL-05 | high | Reliability / Ops | Failure capture is still mostly local and incomplete for launch-day support |
| GL-06 | medium | Performance / PWA | The PWA precache currently pulls the `html2canvas` export chunk into first install |
| GL-07 | medium | Performance / Reliability | Long matches will pay extra main-thread cost from repeated full-array derivations and full-state localStorage writes |
| GL-08 | medium | Testing / QA | Release protection still misses real multi-device sync proof and any dedicated a11y validation |
| GL-09 | medium | Repo coherence | Source docs, generated artifacts, and release source-of-truth ownership are still blurry |
| GL-10 | low | Security / Dependencies | Security posture is decent, but admin UI gating is still client-exposed and dependencies are drifting |

## Architecture Review

What is working well:

- The repo structure is coherent for a small specialist app: one shell plus focused `src/lib/*` modules.
- The local-first model is correct for this product and is documented consistently in `documentation/technical-spec.md`.
- The best extracted modules are the right abstractions: `src/lib/matchStore.js`, `src/lib/storageScope.js`, `src/lib/importMerge.js`, `src/lib/syncState.js`, and `src/lib/analysisSync.js` are practical and test-backed.
- The explicit match entity model and migration path are thoughtful and reduce future data-shape ambiguity.

Main concerns:

- `src/App.svelte` is `3311` lines and `142203` bytes and still owns auth, storage-scope activation, local persistence, sync queueing, realtime wiring, match CRUD, event CRUD, import/export, tab routing, and a large render tree.
- Persistence and sync boundaries are only partially extracted. `App.svelte` still manually serializes local storage, queue state, and Supabase protocol behavior end to end.
- Match identity logic is duplicated across the shell and helpers, which raises drift risk.
- Several feature components are also becoming large enough to be second-order monoliths: `src/lib/PossessionAnalysisPanel.svelte` (`1375` lines), `src/lib/AnalyticsPanel.svelte` (`1055`), `src/lib/PassImpactPanel.svelte` (`901`), and `src/lib/CaptureForm.svelte` (`748`).

Pragmatic conclusion:

Do not rewrite the app. Extract only the shell seams that are already obvious and already hurting change safety: auth/session activation, sync/storage orchestration, and import/export workflows.

## UX Review

What is working well:

- Navigation is already protected by meaningful E2E coverage in `tests/e2e/navigation.spec.js`, `tests/e2e/layout.spec.js`, and `tests/e2e/capture-flow.spec.js`.
- Empty states are present in important surfaces like `src/lib/DigestPanel.svelte` and `src/lib/EventsTable.svelte`.
- The product is domain-specific and operationally focused instead of feeling like a generic data-entry shell.
- The app already exposes a visible sync banner and local diagnostics entry point in `src/App.svelte`, which is the right direction for a field tool.

Main concerns:

- `src/lib/Login.svelte:116-123` uses placeholder-only email and password inputs instead of explicit labels.
- `src/lib/EventsTable.svelte:147` uses a placeholder-only search field.
- `src/lib/Pitch.svelte:207-216` suppresses Svelte a11y warnings and uses `role="application"`, which is a valid but high-responsibility pattern that needs stronger documentation and test coverage.
- `src/lib/SummaryModal.svelte:19` renders a dialog but swallows keydown without explicit Escape-close or focus-return handling.
- `index.html` is still minimal. If the deployed URL is public-facing, social/share metadata is not yet ready.

Pragmatic conclusion:

The core flow is usable, but accessibility is still being carried too much by good luck and browser defaults. That is not enough for a production launch.

## Testing Review

What is working well:

- The repo has real test depth: unit, component, Playwright E2E, and a dedicated Supabase smoke test.
- Coverage is meaningful rather than cosmetic. The current run landed at `77.43%` statements overall, with strong coverage across most helpers and several critical components.
- The E2E suite covers actual user journeys: capture, import/export, layout, digest export, navigation, and PWA manifest presence.

Main concerns:

- The cloud-backed smoke path is still env-gated and was skipped in this audit.
- There is no dedicated accessibility validation in the current scripts or CI.
- The release gate only became complete in this session; keep `check:full` as the required release command so the repo does not drift again.
- The most important behavior gap is still real multi-device sync in a launch-like environment.

Pragmatic conclusion:

The current suite is strong enough to support incremental change, but launch confidence still depends on one piece of evidence the repo cannot provide by itself: a real launch-environment auth/sync run.

## Performance Review

What is working well:

- Export work is at least isolated behind dynamic imports in `src/lib/DigestPanel.svelte`, `src/lib/PassImpactPanel.svelte`, and `src/lib/PossessionAnalysisPanel.svelte`.
- The PWA direction is correct for the product. The issue is install weight and cache scope, not the existence of offline support.
- There are no obvious large static image or font payloads driving the build.

Main concerns:

- `npm run build` produced `dist/assets/index-BZxRoK8C.js` at `515.37 kB` minified / `150.22 kB` gzip and triggered Vite's chunk-size warning.
- The build reported a PWA precache size of `848.38 KiB`.
- `dist/sw.js` currently precaches `assets/html2canvas.esm-DXEQVQnt.js`, which reduces the payoff of splitting export code out of the initial app bundle.
- `src/App.svelte` repeatedly filters, maps, sorts, and summarizes large event arrays, while also doing synchronous `localStorage.setItem(JSON.stringify(...))` writes on the main thread.
- Sync paths still rely on full-table reads and realtime-triggered refreshes that will age poorly as data grows.

Pragmatic conclusion:

Before launch, trim at least one meaningful install-cost risk. After launch, tackle the broader shell/runtime cost more systematically.

## Security, Reliability, And Hidden Gotchas

What is working well:

- `supabase/functions/onboard-user/index.ts` correctly verifies JWT identity, checks admin allowlisting, and restricts CORS by `ALLOWED_ORIGIN`.
- `npm audit --omit=dev --audit-level=moderate` found `0` production vulnerabilities.
- The offline-first design is an intentional reliability choice, not an accident.

Main concerns:

- The app still leans heavily on local diagnostics plus console output. `src/lib/DigestPanel.svelte:72-79` only reports share failures locally and does not feed the same diagnostics path the shell uses.
- `src/lib/supabase.js:5` uses `VITE_ADMIN_EMAILS` for client-side admin-tab gating. Real authorization remains server-side, which is good, but the allowlist itself is still exposed in the client bundle.
- `src/lib/supabase.js:64-76` intentionally fails open on `userHasAccess()` network errors to preserve match-day usability. That is a defensible product tradeoff, but it should be explicitly owned and documented as such.

Pragmatic conclusion:

There is no obvious launch-stopping vulnerability here. The real production risk is operational: failures are still too easy to miss and too hard to review from outside the device.

## Dependency And Repo Coherence Review

What is working well:

- The repo uses one package manager (`npm`) with one lockfile (`package-lock.json`).
- CI is simple and easy to reason about: `.github/workflows/ci.yml` checks out the repo, installs Chromium, and runs `npm run check:full`.
- README setup instructions are directionally accurate for offline-first local use.

Main concerns:

- `npm outdated --long` shows drift across Playwright, Supabase, Svelte, the Svelte Vite plugin, Vite, Vitest, and related tooling.
- `npm ls --depth=0` shows `workbox-window` installed, but no references were found in `src/` or `tests/`.
- `docs/` contains generated build artifacts while source narrative docs live under `documentation/`, yet `documentation/technical-spec.md` explicitly says deployment does not rely on a committed `docs/` folder.
- `documentation/release-checklist.md` still reflects an older release gate than the now-canonical `check:full`.

Pragmatic conclusion:

The repo is not chaotic, but it does need one pass to make source-of-truth ownership obvious and prevent future documentation drift.

## Release-Readiness Review

Current state:

- The local release gate is green.
- The smoke gate is not green because it was not runnable without launch-environment secrets.
- The product is viable for a focused launch if the remaining conditions are handled deliberately, not hand-waved.

Biggest launch-day risks:

- Unproven cloud auth/sync if that is in scope for launch.
- Limited incident visibility for sync, onboarding, and digest-share failures.
- Install/perceived-speed pain on weak connectivity because the initial bundle and precache remain heavy.

## What Is Already Good And Should Be Preserved

- The product scope is tight and specialist.
- The offline-first design fits the actual operating environment.
- The current regression suite encodes a lot of valuable behavior and should be extended, not replaced.
- The match entity model, import merge path, and scoped storage work are thoughtful and worth keeping.
- The sync banner, manual retry affordance, and local diagnostics entry point are good foundations for better launch ops.
- Dynamic import for image-export functionality is the right instinct even if the current cache strategy blunts part of the gain.

## Detailed Findings

### GL-01 - Launch-environment Supabase auth/sync is still unproven

- Severity: blocker
- Area: Release readiness
- Why it matters: if launch includes sign-in, team-scoped sync, or shared-device workflows, the most important production path still lacks direct proof.
- Evidence:
  - `tests/e2e/supabase-smoke.spec.js` skips unless `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PAIRC_SMOKE_EMAIL`, and `PAIRC_SMOKE_PASSWORD` are present
  - `npm run test:smoke` on 2026-04-06 skipped `1` test
  - `README.md` and `documentation/multi-analyst-setup.md` position shared/team usage as a real workflow
- Recommended fix: run `npm run test:smoke` against the actual launch environment, then perform one manual two-device verification and record the result in the release checklist. If launch is offline-only, document that scope decision explicitly.
- Effort: S
- Confidence: high

### GL-02 - `src/App.svelte` is still too concentrated

- Severity: high
- Area: Architecture
- Why it matters: review cost, regression risk, and change latency are all higher than they need to be when one file owns most of the application protocol and composition.
- Evidence:
  - `src/App.svelte` is `3311` lines and `142203` bytes
  - The file imports and coordinates almost every major feature surface and helper seam
  - Storage/sync/auth logic still lives directly in the shell alongside rendering and event handlers
- Recommended fix: extract only the obvious seams first: auth/session activation, sync queue and realtime orchestration, and import/export flows. Do not rewrite the SPA or introduce a state library.
- Effort: L
- Confidence: high

### GL-03 - First load is paying for too much of the app up front

- Severity: high
- Area: Performance
- Why it matters: the product is intended for field use, so initial load and first install need to be treated as product quality, not just engineering neatness.
- Evidence:
  - `npm run build` produced `dist/assets/index-BZxRoK8C.js` at `515.37 kB` minified / `150.22 kB` gzip and emitted Vite's chunk-size warning
  - `src/App.svelte:2-13` statically imports all major panels
  - `src/main.js` mounts a single client-only SPA entry
- Recommended fix: lazy-load non-capture tabs first, keep Capture/Live hot, and adopt a simple bundle budget that is checked during release review.
- Effort: M
- Confidence: high

### GL-04 - Essential accessibility gaps remain on key surfaces

- Severity: high
- Area: UX / Accessibility
- Why it matters: this app uses custom interactions extensively, so missing labels and incomplete keyboard behavior become real usability and support issues.
- Evidence:
  - `src/lib/Login.svelte:116-123` uses placeholder-only email and password fields
  - `src/lib/EventsTable.svelte:147` uses a placeholder-only search field
  - `src/lib/Pitch.svelte:207-216` suppresses Svelte a11y warnings and uses `role="application"`
  - `src/lib/SummaryModal.svelte:19` captures keydown without explicit Escape-close behavior
- Recommended fix: add explicit labels, harden keyboard and focus behavior, document the pitch interaction model, and add at least one automated a11y smoke path.
- Effort: M
- Confidence: high

### GL-05 - Failure capture is still too local and incomplete

- Severity: high
- Area: Reliability / Operations
- Why it matters: production issues are much harder to support when they live only in the browser console or only on the affected device.
- Evidence:
  - `src/App.svelte:2594-2603` exposes local diagnostics and copy/clear actions, which is good
  - `src/lib/DigestPanel.svelte:72-79` logs digest-share failures to `console.error` and local UI copy only
  - no remote telemetry package appears in `package.json`
- Recommended fix: route sync, onboarding, and digest-share failures into a shared diagnostics path and decide who will review those signals on launch day. Add remote capture only if there is a real owner for it.
- Effort: M
- Confidence: medium

### GL-06 - PWA precache currently includes the export chunk

- Severity: medium
- Area: Performance / PWA
- Why it matters: pre-caching export code on first install reduces the benefit of splitting that code out of the initial app bundle.
- Evidence:
  - `src/lib/DigestPanel.svelte:52-53`, `src/lib/PassImpactPanel.svelte:480-481`, and `src/lib/PossessionAnalysisPanel.svelte:673-674` dynamically import `html2canvas`
  - `dist/sw.js` precaches `assets/html2canvas.esm-DXEQVQnt.js`
  - `npm run build` reported `848.38 KiB` total precache size
- Recommended fix: decide whether offline-first export on day-one install is actually required. If not, exclude the export chunk from precache. If yes, keep it intentionally and recover the install budget elsewhere.
- Effort: M
- Confidence: high

### GL-07 - Long-match runtime cost will grow because the shell recomputes and persists large state on the main thread

- Severity: medium
- Area: Performance / Reliability
- Why it matters: long matches and larger saved histories will amplify UI latency if every meaningful change reserializes and re-derives broad app state.
- Evidence:
  - `src/App.svelte:667-699` performs full `localStorage.setItem(JSON.stringify(...))` writes for events and meta
  - `src/App.svelte:794-816` serializes pending queues the same way
  - runtime analysis shows repeated whole-array filtering and summarization across `App.svelte` and `src/lib/liveInsights.js`
- Recommended fix: batch writes where practical, narrow persistence to changed slices where feasible, and move expensive derivations behind focused helpers so they stop re-accumulating in the shell.
- Effort: M
- Confidence: medium

### GL-08 - The release gate still misses the real multi-device and a11y risk

- Severity: medium
- Area: Testing / QA
- Why it matters: local green tests are necessary, but they do not yet prove the launch-critical cloud collaboration path or accessibility quality.
- Evidence:
  - `npm run check:full` passed on 2026-04-06
  - `npm run test:smoke` still skipped
  - no dedicated a11y command or CI step exists in `package.json` or `.github/workflows/ci.yml`
- Recommended fix: keep `check:full` mandatory, add a lightweight a11y smoke, and retain a manual two-device verification step in the release checklist until it is automated.
- Effort: M
- Confidence: high

### GL-09 - Source-of-truth ownership is still blurry across docs and generated output

- Severity: medium
- Area: Dependency and repo coherence
- Why it matters: release work gets slower and more error-prone when engineers cannot tell which docs are source, which files are build artifacts, and which checklist is canonical.
- Evidence:
  - `docs/` contains generated static output and `docs/go-live/*`
  - source narrative docs live in `documentation/`
  - `documentation/technical-spec.md` says deployment does not rely on committed `docs/`
  - `documentation/release-checklist.md` does not match the now-current `check:full` release gate
- Recommended fix: define one source-of-truth docs structure, align the source release checklist with the real gate, and stop mixing source docs with generated assets unless a host requires it.
- Effort: S
- Confidence: high

### GL-10 - Security and dependency hygiene are good enough for a pilot, not fully tightened for broader production

- Severity: low
- Area: Security / Dependencies
- Why it matters: nothing here is a launch emergency, but leaving small security and dependency issues to drift makes later hardening harder.
- Evidence:
  - `npm audit --omit=dev --audit-level=moderate` returned `0` production vulnerabilities
  - `supabase/functions/onboard-user/index.ts` applies JWT validation, admin allowlisting, and `ALLOWED_ORIGIN` checks
  - `src/lib/supabase.js:5` exposes `VITE_ADMIN_EMAILS` client-side for UI gating
  - `npm outdated --long` shows framework/tooling drift
  - `npm ls --depth=0` shows `workbox-window` installed with no references found in `src/` or `tests/`
- Recommended fix: keep real authorization server-side, move UI capability decisions to a server-driven signal when practical, refresh dependencies in small green batches, and remove unused packages as they are confirmed unnecessary.
- Effort: S
- Confidence: medium

## Assumptions And Unknowns

- This audit was run locally on Windows. CI runs on `ubuntu-latest`, so platform-specific issues may still exist.
- No live Vercel project, production URL, or real Supabase project configuration was inspected directly.
- The Supabase smoke path could not be run because launch-environment secrets were not available.
- No real multi-device signed-in sync session was exercised during this audit.
- No Lighthouse, RUM, or production tracing data was available; performance findings are based on build output and source inspection.
- It is unclear whether the deployed URL is a private team tool or a public-facing product URL; that affects the priority of metadata and some security/privacy hardening.
- Current local validation also reflects the existing worktree setting `workers: 1` in `playwright.config.js`.
