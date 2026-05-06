# Go-Live Audit

Audit date: 2026-04-30

Last tactical-board/doc update: 2026-05-06

## Executive Summary

Pairc is **GO WITH CONDITIONS from this working tree**.

The release gate is now green, the normal E2E suite is isolated from Supabase smoke credentials, the smoke path uses unique match data, and the app has a minimum accessibility smoke plus improved diagnostics coverage for digest-share failures. The app still has meaningful follow-up work, but the current state is no longer blocked by red validation or mixed local/cloud test behavior.

Current validation evidence from this working tree:

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run test:unit` - passed: 38 files, 312 tests on the latest 2026-05-06 gate.
- `npm run test:coverage` - passed.
- `npm run test:e2e` - passed: 50 tests passed, 3 auth/smoke tests skipped by design.
- `npm run test:a11y` - passed.
- `npm run build` - passed. Latest 2026-05-06 build output: main JS `494.11 kB` minified / `142.32 kB` gzip; lazy tactical-board chunk `38.42 kB` / `12.29 kB` gzip; `html2canvas` chunk `201.04 kB` / `47.43 kB`; PWA precache `781.56 KiB`.
- `npm run check:full` - passed on 2026-04-30.
- `npm run test:smoke` - passed against configured Supabase smoke credentials on 2026-04-29.

Tactical board update validation on 2026-05-04:

- `npm run check` - passed after rerun outside the sandbox because the sandbox blocked Vitest/esbuild process spawn.
- `npm run test:e2e -- tests/e2e/navigation.spec.js --project=chromium` - passed: 2 tests.
- `npm run test:a11y` - passed: 1 test.
- Build output kept the board lazy-loaded as `TacticalBoard-By7yfWmT.js` at `27.10 kB` minified / `9.06 kB` gzip; main JS was `494.10 kB` minified / `142.32 kB` gzip.

Tactical board product polish validation on 2026-05-06:

- `npm.cmd run check` - passed: lint, typecheck, 38 unit/component files, 312 tests, and production build.
- `npm.cmd run test:e2e -- tests/e2e/tactical-board.spec.js --project=chromium` - passed.
- `npm.cmd run test:a11y` - passed during the 2026-05-06 rail/marker polish pass.
- Board remains lazy-loaded as its own production chunk.

Worktree note:

- `src/App.svelte` and `src/lib/CaptureForm.svelte` were already modified at audit start. This cleanup kept working with those changes and did not revert them.

## Launch Recommendation

**GO WITH CONDITIONS**

Conditions before or during launch signoff:

- Run `npm run test:smoke` again against the intended launch environment and record the account, date, and result.
- Complete the manual launch smoke on a real device, especially the local-first save/reload path.
- Name the launch operating model explicitly for the release: offline-only, cloud-sync, single-analyst, or multi-analyst.

## Top Findings By Impact

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| GL-01 | medium | Architecture | `src/App.svelte` remains too large and owns too many protocols |
| GL-02 | medium | Performance / PWA | Bundle size is acceptable but still heavy for a field PWA |
| GL-03 | medium | Operations | Supabase smoke remains a separate required signoff, not part of `check:full` |
| GL-04 | low | Accessibility | The minimum a11y gate exists, but manual device validation still matters |
| GL-05 | low | Maintenance | Dependency drift is manageable but should be refreshed in small batches |

## What Changed In This Cleanup

- Restored the `CaptureForm` selected-state contract so the component test passes again.
- Separated ordinary E2E from Supabase-backed smoke by default.
- Added unique per-run smoke match naming so repeated smoke runs do not collide on reused opponent data.
- Reworked the possession-analysis E2E helpers to use deterministic pitch coordinates and the current draft-review flow.
- Added a lightweight accessibility smoke test and corresponding release-checklist coverage.
- Routed digest share failures into the shared diagnostic path.
- Added quick analysis preset support and coach-handoff copy support as low-risk polish.
- Excluded the export-only `html2canvas` chunk from the PWA precache, reducing precache size materially.
- Added the tactical board MVP/product polish: per-context save/restore, autoplay, playback speed, pen marks, shot arrows, half-pitch views, PNG export, compact left tool rail, bottom step strip, smaller tactical counters, distinct navy/green keeper counters, confirmation on destructive board actions, and clearer `Close Board` wording.

## Resolved Audit Items

### GL-R1 - Release gate is green again

- Evidence:
  - `npm run check:full` passed on 2026-04-30.
  - `npm run test:unit`, `npm run test:coverage`, `npm run test:e2e`, and `npm run build` all passed in this tree.
- Outcome: the repo's main release gate is trustworthy again.

### GL-R2 - Normal E2E is isolated from Supabase smoke

- Evidence:
  - `playwright.config.js` now keeps normal E2E local/offline unless the smoke spec is being run explicitly.
  - `npm run test:e2e` passed without signing into the shared Supabase smoke account.
- Outcome: ordinary regression runs are deterministic and no longer depend on shared cloud state.

### GL-R3 - Smoke data is uniquely identifiable per run

- Evidence:
  - `tests/e2e/supabase-smoke.spec.js` appends a run id to the smoke opponent name.
  - `npm run test:smoke` passed with the unique-name behavior in place.
- Outcome: repeated smoke runs can be identified and ignored or cleaned up safely.

### GL-R4 - Configured-cloud access no longer fails open on thrown errors

- Evidence:
  - `src/lib/supabase.js` now keeps offline mode open, but returns false for configured-cloud lookup failures.
  - `tests/unit/supabase.test.js` covers the disabled-supabase and fail-closed paths.
- Outcome: the launch app no longer silently treats unknown cloud access state as allowed.

### GL-R5 - Minimum accessibility gate exists

- Evidence:
  - `tests/e2e/accessibility.spec.js` validates keyboard reachability for the core match-day controls.
  - `npm run test:a11y` passed on 2026-04-29.
- Outcome: the custom pitch and navigation flows now have a basic automated accessibility regression signal.

### GL-R6 - Digest-share failures enter diagnostics

- Evidence:
  - `src/lib/DigestPanel.svelte` now reports digest image failures through the shell diagnostic path.
  - `tests/component/DigestPanel.test.js` covers the diagnostics callback path.
- Outcome: support now has a shared trail for this class of user-visible export failure.

## Remaining Follow-Up Work

### GL-01 - App shell concentration is still high

- Severity: medium
- Evidence:
  - `src/App.svelte` still owns auth/session, persistence, sync, diagnostics, and broad render composition.
- Why it matters: the code is workable, but future changes will remain harder to review and test than they should be.
- Recommended follow-up: extract only high-payoff seams after launch, starting with auth/session activation and sync orchestration.

### GL-02 - Bundle size still deserves attention

- Severity: medium
- Evidence:
  - Main JS remains `488.76 kB` minified.
  - `html2canvas` still ships as a `201.04 kB` chunk, even though it is no longer precached.
  - PWA precache improved to `725.17 KiB`, down from the earlier broader precache.
- Why it matters: match-day installs and reloads can happen in poor network conditions.
- Recommended follow-up: keep a small bundle/precache budget in release review and continue lazy-loading/export isolation work.

### GL-03 - Smoke signoff still needs operational discipline

- Severity: medium
- Evidence:
  - `npm run test:smoke` is intentionally outside `check:full`.
  - Launch still depends on having valid smoke credentials and recording the result.
- Why it matters: this is the proof of the cloud path and should stay explicit, not assumed.
- Recommended follow-up: keep smoke mandatory in the release checklist and record each run.

## Validation Gaps

- No Lighthouse, RUM, production tracing, or live Vercel inspection was performed in this cleanup pass.
- No manual two-device sync session was performed during this cleanup pass.
- The release checklist still needs human signoff for environment, deploy, monitoring, rollback, and real-device smoke steps.

## Release Readiness Verdict

The working tree is in much better shape than the original audit baseline. The launch blockers that made the tree non-releasable have been cleared, and the remaining work is mostly operational discipline plus post-launch hardening rather than immediate code rescue.
