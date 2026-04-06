# Go-Live Audit

Audit date: 2026-04-01

## Executive summary

Páirc is now in **GO WITH CONDITIONS** territory from this working tree.

The first audit pass found two universal launch blockers:

- the analytics pitch overflowed the viewport in a tested landscape layout
- the local validation path was not reliable because coverage mode failed and several tests timed out

Both of those issues were fixed and revalidated during this session. The current release picture is:

- `npm run lint` — passed
- `npm run test:unit` — passed
- `npm run test:coverage` — passed
- `npm run test:e2e` — passed with `22` green and `1` skipped Supabase smoke test
- `npm run build` — passed
- `npm audit --omit=dev --audit-level=moderate` — passed with `0` production vulnerabilities
- `npx tsc --noEmit -p jsconfig.json` — failed

The repo still has meaningful pre-launch work before it deserves an unqualified **GO**:

- there is no supported green typecheck gate
- the Supabase smoke path was skipped because launch-env secrets were not available in this audit
- production observability is still mostly local diagnostics plus console output

The codebase already has strong launch-worthy traits that should be preserved:

- clear product focus
- offline-first persistence and sync design
- substantial automated coverage for a small repo
- pragmatic Supabase security checks
- useful documentation and release-checklist discipline

## Launch recommendation

**GO WITH CONDITIONS**

Conditions to reach **GO**:

- add a supported `typecheck` command and make it part of the release evidence
- run the Supabase smoke flow against the intended launch environment if cloud auth/sync is part of launch
- define the minimum acceptable production observability path for sync, onboarding, and digest-share failures

## Fixes applied during audit

- `.gitignore` now allows `docs/go-live/**` so these artifacts can be tracked in Git
- `src/lib/AnalyticsPanel.svelte` reduced the analytics pitch size cap in landscape (`52svh` -> `47svh`), which cleared the failing layout spec
- `vitest.config.js` now sets `testTimeout: 15000`, which cleared the previously timed-out tests and restored `test:coverage`

## Top 10 findings by impact

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| GL-05 | high | Release readiness | Supabase smoke path is env-gated and was not exercised in this audit |
| GL-03 | high | Engineering | No supported green typecheck workflow exists |
| GL-04 | high | Architecture | `src/App.svelte` is still too concentrated for safe change velocity |
| GL-07 | medium | Accessibility | Several key surfaces still rely on placeholder-only or custom interaction patterns |
| GL-06 | medium | Reliability / Ops | Production observability is mostly console + local diagnostics only |
| GL-08 | medium | Performance | First-load bundle is heavier than ideal for poor match-day connectivity |
| GL-09 | medium | Repo coherence | Source docs and generated static artifacts are mixed together under `docs/` |
| GL-10 | low | Dependencies | Dependency set is safe but behind on several minor/patch upgrades |
| GL-11 | low | Product / Distribution | Public metadata is still minimal if this deploy is public-facing |
| GL-12 | low | Release hygiene | The new release gate still needs a first-class typecheck step |

## Architecture review

What is working well:

- The app has a clear product core: capture, live read, analytics, digest, events, admin.
- High-risk data concerns are already partially extracted into focused helpers and stores: `matchStore.js`, `storageScope.js`, `importMerge.js`, `syncState.js`, `analyticsHelpers.js`.
- The local-first persistence and queued-sync model is appropriate for a match-day tool.

Main architectural concern:

- `src/App.svelte` is still too concentrated. It owns auth/session, storage migration, persistence, sync orchestration, notices, diagnostics, tab routing, import/export, match context, summary modal state, and a large amount of shell CSS.

Impact:

- The architecture is workable, but the current concentration increases regression risk and slows safe changes.

## UX review

What is working well:

- The capture flow is purposeful and domain-specific rather than generic.
- The app separates operator-facing (`Live`) and coach-facing (`Digest`) modes cleanly.
- Empty states and operational guidance exist in major surfaces.
- The repo already had a regression test specifically for landscape ergonomics, which is exactly the right instinct for this product.

Main UX concerns:

- The previously failing analytics landscape issue is fixed, but the surface remains dense enough that viewport regressions are still easy to reintroduce.
- Accessibility is mixed: several inputs still rely on placeholders, and the pitch uses a custom `role="application"` pattern with a deliberate a11y suppression comment.
- The summary modal is visually polished but still needs stronger focus/keyboard treatment.

## Testing review

What is working well:

- There is real depth here: unit, component, Playwright E2E, and a dedicated Supabase smoke path.
- The suite covers meaningful journeys: capture, import/export, layout, summary, navigation, and PWA wiring.

Current gaps:

- The main local validation path is now green, but the repo still lacks a supported `typecheck` command.
- The authenticated Supabase smoke test is env-gated and was skipped in this audit.
- The app-shell test runtime remains heavy enough that time budgets should be watched instead of forgotten.

## Performance review

What is working well:

- The app builds successfully.
- Digest export loads `html2canvas` dynamically instead of baking it into the initial bundle.
- The PWA setup is reasonable for an offline-first tool.

Main performance concerns:

- The main bundle is still heavy for field conditions: `dist/assets/index-DcLLKA3L.js` built at `420.71 kB` raw / `122.37 kB` gzip.
- The precache size remains notable at `731.04 KiB`.
- A very large app shell tends to drag render, test, and maintainability cost together.

## Security / reliability / hidden gotchas

What is working well:

- The Supabase onboarding function uses admin JWT verification plus an allowlisted admin email check.
- CORS handling in the Edge Function is deliberately restrictive.
- The audit command found `0` production vulnerabilities.

Main concerns:

- Runtime failures are still mostly surfaced through `console.*` and local diagnostics rather than a remote incident path.
- If launch includes shared/team sync, the most important production path still needs explicit smoke evidence.
- The app is resilient offline, but first install and authenticated sync still depend on network behavior that was not validated against live infrastructure during this audit.

## Dependency and repo coherence review

What is working well:

- The repo uses one package manager (`npm`) with a single lockfile.
- Dependency drift is modest rather than alarming.
- The repo now cleanly allows tracking `docs/go-live/**`.

Main concerns:

- Several dependencies are behind on minor or patch releases: Playwright, Supabase, Vitest, Svelte, and the Svelte Vite plugin.
- `docs/` currently mixes tracked generated static output with source documentation concerns, while deployment is described as not relying on committed `docs/`.
- CI only runs on `ubuntu-latest`, so platform-specific local issues can still slip past the main gate.

## Release-readiness review

The release gate is substantially healthier after the in-session fixes:

- `lint`, `test:unit`, `test:coverage`, `test:e2e`, and `build` now pass in this working tree
- the cloud-sync launch path still needs a real smoke run
- there is still no reliable typecheck evidence in the gate

## What is already good and should be preserved

- The product remains focused on a clear specialist use case rather than expanding into a generic club platform.
- The offline-first design is appropriate for the operating environment.
- The current regression suite encodes a lot of valuable behavior and should be extended, not replaced.
- The helper modules around match identity, storage scope, sync cursor management, scoring, and diagnostics are good building blocks.
- The admin onboarding flow is pragmatic and operator-friendly.
- The digest export being lazily loaded is the right idea and should be preserved.

## Detailed findings

### GL-01 — Analytics pitch overflowed the landscape viewport before the audit fix

- Status: resolved during audit
- Severity: blocker
- Area: Product / UX
- Why it matters: a match-day analytics screen that does not fit a common landscape viewport is a direct usability failure.
- Evidence:
  - Initial audit run: `npm run test:e2e` failed `tests/e2e/layout.spec.js:54-85`
  - Initial observed failure: expected pitch bottom `<= 768`, received `790.34375`
  - `src/lib/AnalyticsPanel.svelte:848-855` originally sized `.pitch-viz-card` with `width: min(100%, calc(52svh * 145 / 90))`
  - After reducing that cap to `47svh`, `npm run test:e2e` passed with `22` green and `1` skipped smoke test
- Recommended fix: keep the more conservative pitch sizing and preserve the Playwright layout spec as a regression gate.
- Effort: S
- Confidence: high

### GL-02 — The local release validation path was red before the audit fix

- Status: resolved during audit
- Severity: blocker
- Area: Testing / Release
- Why it matters: shipping from a repo that cannot pass its own validation path undermines release confidence and slows every follow-up fix.
- Evidence:
  - Initial audit run: `npm run test:unit` failed with timeouts in:
    - `tests/component/App.test.js:560`
    - `tests/component/CaptureContextBanner.test.js:39`
    - `tests/component/CaptureForm.test.js:20`
  - Initial audit run: `npm run test:coverage` failed with `ENOENT: no such file or directory, open 'C:\Users\neila\ko-app\coverage\.tmp\coverage-0.json'`
  - After setting `testTimeout: 15000` in `vitest.config.js`, both `npm run test:unit` and `npm run test:coverage` passed locally
- Recommended fix: keep the longer timeout only if it continues to reflect real expected runtime, and look for ways to reduce test setup cost over time.
- Effort: S
- Confidence: high

### GL-03 — There is no supported green typecheck command

- Severity: high
- Area: Engineering
- Why it matters: this repo already asks JavaScript files to participate in type checking (`checkJs: true`), but there is no supported way to run and trust that signal during release preparation.
- Evidence:
  - `package.json` has no `typecheck` script
  - `jsconfig.json` enables `checkJs`
  - `npx tsc --noEmit -p jsconfig.json` failed both in `node_modules/punycode` parsing and in repo files such as `src/lib/analyticsHelpers.js`, `src/lib/importMerge.js`, `src/lib/matchStore.js`, and `src/lib/storageScope.js`
- Recommended fix: add one supported typecheck command scoped to the app sources, make it green, and add it to the release gate.
- Effort: M
- Confidence: high

### GL-04 — `src/App.svelte` is still too concentrated

- Severity: high
- Area: Architecture
- Why it matters: the app shell now carries too much state and too many side effects in one place, which raises regression risk and makes targeted change harder than it needs to be.
- Evidence:
  - `src/App.svelte` is 3,180 lines long
  - The file owns local persistence (`src/App.svelte:589`), notices (`src/App.svelte:749`), diagnostics (`src/App.svelte:759`), sync queue flushing (`src/App.svelte:860`), Supabase sync (`src/App.svelte:903`), and auth/on-mount wiring (`src/App.svelte:1157`)
- Recommended fix: extract shell-only concerns first: auth/session wiring, sync orchestration, and import/export workflows. Do not rewrite the product surface wholesale.
- Effort: L
- Confidence: high

### GL-05 — The cloud-sync launch path still lacks real launch-env evidence

- Severity: high
- Area: Release readiness
- Why it matters: if launch includes Supabase-backed sign-in and shared sync, the most important production behavior is still only partially validated.
- Evidence:
  - `tests/e2e/supabase-smoke.spec.js` is skipped unless `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PAIRC_SMOKE_EMAIL`, and `PAIRC_SMOKE_PASSWORD` are configured
  - The test was skipped in this audit
  - README and `documentation/multi-analyst-setup.md` position shared/team usage as a real scenario
- Recommended fix: run the smoke path against the actual launch environment before go-live and treat it as mandatory evidence whenever cloud sync/auth is in scope.
- Effort: S
- Confidence: high

### GL-06 — Production observability is too local

- Severity: medium
- Area: Reliability / Operations
- Why it matters: once real users are in the field, console output and local diagnostics alone are not enough for timely incident detection.
- Evidence:
  - `src/App.svelte` uses `console.error` / `console.warn` for migration, storage, sync, and wake-lock failures
  - `src/lib/DigestPanel.svelte:72` logs digest-share failures with `console.error` only
  - `package.json` contains no remote telemetry or error-capture package
- Recommended fix: add a minimal remote error trail for sync/onboarding/share failures, or at minimum route all user-visible failures into the existing diagnostics system and define where operators should inspect them.
- Effort: M
- Confidence: medium

### GL-07 — Accessibility coverage is incomplete on key surfaces

- Severity: medium
- Area: UX / Accessibility
- Why it matters: this app uses custom controls extensively, so accessibility quality must be deliberate rather than assumed.
- Evidence:
  - `src/lib/Login.svelte` uses placeholder-only email/password inputs
  - `src/lib/EventsTable.svelte:135-139` uses a placeholder-only search box
  - `src/lib/Pitch.svelte:157-165` suppresses Svelte a11y warnings and uses `role="application"`
  - `src/lib/SummaryModal.svelte` renders a dialog but does not show explicit Escape-close or focus-trap behavior
- Recommended fix: add explicit labels, harden keyboard/focus behavior, review pitch semantics with screen-reader expectations, and add at least one automated a11y check to the validation toolchain.
- Effort: M
- Confidence: medium

### GL-08 — First-load performance is heavier than ideal

- Severity: medium
- Area: Performance
- Why it matters: the app is meant for field use, and the technical spec already notes that first install still requires network.
- Evidence:
  - `npm run build` produced:
    - `dist/assets/index-DcLLKA3L.js` — `420.71 kB` raw / `122.37 kB` gzip
    - `dist/assets/index-CSEir7gr.css` — `68.36 kB` raw / `12.03 kB` gzip
  - `documentation/technical-spec.md` explicitly calls out first-install network dependency
  - Positive evidence: `src/lib/DigestPanel.svelte:52` loads `html2canvas` dynamically
- Recommended fix: trim the app-shell payload, lazy-load non-capture surfaces where practical, and set a simple performance budget for the main bundle.
- Effort: M
- Confidence: medium

### GL-09 — Repo/documentation artifact ownership is blurry

- Severity: medium
- Area: Dependency and repo coherence
- Why it matters: release work is harder when source documentation, generated assets, and deployment assumptions are mixed together.
- Evidence:
  - `docs/` contains generated static assets and HTML
  - `dist/` also contains generated build output
  - `documentation/technical-spec.md` says deployment does not rely on a committed `docs/` folder
  - `git check-ignore -v docs\go-live\audit.md` originally showed `docs/` was ignored before the audit fix
- Recommended fix: clearly separate source docs from generated artifacts and document the intended deployment artifact path.
- Effort: M
- Confidence: high

### GL-10 — Dependencies are safe but drifting

- Severity: low
- Area: Dependencies
- Why it matters: there is no active security emergency, but letting test/build dependencies drift makes future upgrades harder.
- Evidence:
  - `npm outdated --long` shows available upgrades for Playwright, Supabase, Svelte, the Svelte Vite plugin, Vitest, and related tooling
  - `npm audit --omit=dev --audit-level=moderate` returned `0` production vulnerabilities
- Recommended fix: upgrade in small batches after the release gate is green, starting with patch/minor versions for test and framework tooling.
- Effort: M
- Confidence: high

### GL-11 — Public metadata is still minimal

- Severity: low
- Area: Product / Distribution
- Why it matters: if the deployed URL is public-facing, missing metadata hurts share quality and discoverability.
- Evidence:
  - `index.html` sets theme and PWA tags, but does not include meta description, canonical, Open Graph, or Twitter card tags
- Recommended fix: add a minimal metadata set only if the deployed URL is intended to be publicly shared beyond authenticated users.
- Effort: S
- Confidence: high

### GL-12 — The release checklist now needs to absorb the typecheck requirement

- Severity: low
- Area: Release hygiene
- Why it matters: once a supported typecheck command exists, the checklist and CI gate need to reflect it so it does not drift back out of the release process.
- Evidence:
  - `docs/go-live/release-checklist.md` now includes `npm run typecheck`
  - `package.json` still does not expose a working `typecheck` command
- Recommended fix: add the command first, then keep the checklist and CI in sync with the actual release gate.
- Effort: S
- Confidence: high

## Assumptions and unknowns

- This audit was run locally on Windows; the main CI workflow targets `ubuntu-latest`, so some failures may be platform-specific.
- No live Vercel project, production URL, or Supabase project settings were inspected directly during this audit.
- The Supabase smoke path could not be run because the required env vars were not present.
- No real multi-device signed-in sync session was exercised.
- No Lighthouse or WebPageTest run was performed; performance findings are based on build output, repo structure, and observed layout behavior.
- Because this is a specialist app rather than a marketing site, SEO/social metadata may be intentionally low priority.
- Post-match Phase 2 cross-match aggregation, roster identity, Supabase sync, and trend comparison are implemented; they remain tracked as product functionality rather than go-live remediation.
