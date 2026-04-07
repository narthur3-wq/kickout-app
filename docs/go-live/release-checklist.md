# Launch-Day Release Checklist

Audit baseline: 2026-04-06

## Config / Env

- [ ] Vercel production env has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_EMAILS`
- [ ] Supabase function secrets are set: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ALLOWED_ORIGIN`
- [ ] `ALLOWED_ORIGIN` exactly matches the live app origin
- [ ] The launch environment has applied `supabase/migrations/20260330000100_add_event_indexes.sql`
- [ ] If analysis tabs are in launch scope, the launch environment has applied `supabase/migrations/20260406000100_add_analysis_tables.sql`
- [ ] Dedicated smoke credentials are available and still valid: `PAIRC_SMOKE_EMAIL`, `PAIRC_SMOKE_PASSWORD`
- [ ] Product/engineering signoff exists for the current offline and multi-analyst operating model

## Build

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run test:coverage`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] `npm run check:full`
- [ ] Save the final command outputs with the release record or PR

## Deploy

- [ ] Confirm the launch commit contains only intended release changes
- [ ] Deploy from the approved branch or commit
- [ ] Verify the Vercel build logs complete cleanly
- [ ] Confirm the generated service worker and manifest are present in the deployed build
- [ ] Confirm the live app serves the current PWA assets and shell without console-breaking startup errors

## Smoke Test

- [ ] Run `npm run test:smoke` against staging or production-like configuration
- [ ] Open the live app on a real mobile or tablet device
- [ ] Confirm the app loads without a broken shell state
- [ ] Sign in
- [ ] Create a match
- [ ] Save a kickout event
- [ ] Reload and confirm the event persists
- [ ] Open Kickouts, Shots, and Turnovers in landscape and confirm the key visuals remain fully visible
- [ ] Export the digest image once
- [ ] If admin onboarding is in launch scope, onboard one test user end-to-end
- [ ] If multi-analyst sync is in launch scope, verify one real cross-device create-and-refresh flow

## Monitoring / Logs

- [ ] Confirm the current diagnostics log is accessible from the account menu
- [ ] Confirm the chosen operator-visible path for sync, onboarding, and digest-share failures is working
- [ ] Verify a named owner is watching launch-day errors during the first support window
- [ ] Verify support knows where to find the failure trail and how to export it

## Analytics

- [ ] Confirm product analytics are intentionally omitted or working as expected
- [ ] If launch metrics are manual, confirm who records them and where

## Rollback Readiness

- [ ] The previous known-good Vercel deployment is identified
- [ ] The revert path for environment/config changes is documented
- [ ] The rollback owner is named
- [ ] Database migration state is understood before deploy
- [ ] The team knows which launch changes are config-only, code-only, or schema-coupled

## Ownership And Signoff

- [ ] Engineering signoff
- [ ] Product / UX signoff on the core match-day flows
- [ ] QA / release signoff
- [ ] Support or operations contact named for the launch window
