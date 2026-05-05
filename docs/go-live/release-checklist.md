# Launch-Day Release Checklist

Audit baseline: 2026-04-30

## Current Gate Status

- [x] `CaptureForm` unit failure fixed or intentionally rebaselined.
- [x] Normal E2E is isolated from Supabase smoke credentials and shared cloud data.
- [x] Supabase smoke data is unique per run or cleaned up.
- [x] `npm run check:full` passes from a clean test state.
- [x] `npm run test:smoke` passes against the launch smoke environment.

## Config / Env

- [ ] Vercel production env has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and any intended admin UI config.
- [ ] Supabase function secrets are set: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ALLOWED_ORIGIN`.
- [ ] `ALLOWED_ORIGIN` exactly matches the live app origin.
- [ ] Required Supabase migrations are applied through `supabase/migrations/20260409000100_add_possession_event_paths.sql`.
- [ ] Dedicated smoke credentials are available and valid: `PAIRC_SMOKE_EMAIL`, `PAIRC_SMOKE_PASSWORD`.
- [ ] Product/engineering signoff exists for the launch operating model: offline-only, cloud-sync, single-analyst, or multi-analyst.
- [ ] Launch scope is documented in `documentation/user-guide.md` under "Launch operating model".

## Local Validation

- [ ] `npm ci`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:unit`
- [x] `npm run test:coverage`
- [x] `npm run test:e2e`
- [x] `npm run test:a11y`
- [x] `npm run build`
- [x] `npm run check:full`
- [ ] `npm audit --omit=dev --audit-level=moderate`
- [ ] Save final command outputs with the release record or PR.

## Supabase Smoke

- [x] Confirm the smoke run will not pollute normal E2E data.
- [ ] Run `npm run test:smoke` against staging or production-like configuration.
- [x] Confirm smoke creates or uses a uniquely identifiable match.
- [ ] Confirm saved smoke data can be cleaned up or ignored without affecting analytics.
- [ ] Record smoke account, environment, date, and result in the release record.

## Manual Launch Smoke

- [ ] Open the live app on a real mobile or tablet device.
- [ ] Confirm the app loads without a broken shell state.
- [ ] Sign in if cloud auth is in scope.
- [ ] Create a match.
- [ ] Save a kickout event.
- [ ] Save a shot event.
- [ ] Save a turnover event.
- [ ] Reload and confirm the events persist in the intended storage mode.
- [ ] Open Capture, Live, Digest, Possession, Pass Destination, Kickouts, Shots, Turnovers, and Events.
- [ ] Open Tools > Board with and without an active match.
- [ ] On Board, add a pass, run, shot, and pen mark; confirm one Play press runs the full flow.
- [ ] On Board, switch speed and half-pitch view; reload and confirm the board restores.
- [ ] On Board, export PNG once and confirm Reset / Clear moves / Clear ink ask for confirmation.
- [ ] Export the digest image once.
- [ ] Export diagnostics once.
- [ ] If admin onboarding is in scope, onboard one test user end-to-end.
- [ ] If multi-analyst sync is in scope, verify one real cross-device create-and-refresh flow.

## Accessibility / UX

- [ ] Keyboard can reach primary navigation and account controls.
- [ ] Capture pitch can be operated with keyboard controls.
- [ ] Summary/modal flows close with Escape and return users to a sensible place.
- [ ] Login and Events search have visible/accessible labels.
- [ ] Key empty/loading/error states are understandable without developer context.

## Deploy

- [ ] Confirm the launch commit contains only intended release changes.
- [ ] Deploy from the approved branch or commit.
- [ ] Verify Vercel build logs complete cleanly.
- [ ] Confirm generated service worker and manifest are present in the deployed build.
- [ ] Confirm the live app serves the current PWA assets and shell without startup console errors.

## Monitoring / Logs

- [ ] Confirm diagnostics log/export is accessible from the account menu.
- [ ] Confirm sync, onboarding, panel-loading, and digest-share failures enter the chosen support path.
- [ ] Verify a named owner is watching launch-day errors during the first support window.
- [ ] Verify support knows how to collect diagnostics from a user device.

## Rollback Readiness

- [ ] Previous known-good Vercel deployment is identified.
- [ ] Revert path for environment/config changes is documented.
- [ ] Rollback owner is named.
- [ ] Database migration state is understood before deploy.
- [ ] Team knows which launch changes are config-only, code-only, or schema-coupled.

## Ownership And Signoff

- [ ] Engineering signoff.
- [ ] Product / UX signoff on core match-day flows.
- [ ] QA / release signoff.
- [ ] Support or operations contact named for the launch window.
