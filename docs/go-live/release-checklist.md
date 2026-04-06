# Launch-Day Release Checklist

Audit basis: April 1, 2026

## Config / Env

- [ ] Vercel production env has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_EMAILS`
- [ ] Supabase Edge Function secrets are set: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ALLOWED_ORIGIN`
- [ ] `ALLOWED_ORIGIN` exactly matches the live app origin
- [ ] The dedicated smoke account credentials are available and still valid: `PAIRC_SMOKE_EMAIL`, `PAIRC_SMOKE_PASSWORD`
- [ ] Existing environments have applied `supabase/migrations/20260330000100_add_event_indexes.sql`
- [ ] Existing environments have applied `supabase/migrations/20260406000100_add_analysis_tables.sql`
- [ ] Product/engineering signoff exists for the current offline access policy on transient network loss

## Build

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] `npm run check:full`

## Deploy

- [ ] Confirm the launch commit contains only intended release changes and no debug-only edits
- [ ] Deploy from the approved branch or commit
- [ ] Verify the Vercel build logs complete cleanly
- [ ] Confirm the generated service worker and manifest are present in the production build
- [ ] Confirm the fixed landscape analytics layout is present in the deployed build

## Smoke Test

- [ ] Run `npm run test:smoke` against staging or production-like configuration
- [ ] Open the live app on a real mobile or tablet device
- [ ] Confirm the app loads without a broken shell state
- [ ] Sign in
- [ ] Create a match
- [ ] Save a kickout event
- [ ] Reload and confirm the event persists
- [ ] Open Kickouts, Shots, and Turnovers in landscape and confirm the analytics pitch is fully visible
- [ ] Export the digest image once
- [ ] If admin onboarding is part of launch scope, onboard one test user end-to-end

## Monitoring / Logs

- [ ] Confirm the on-device diagnostics log is accessible from the account menu
- [ ] Confirm the chosen operator-visible monitoring path for auth, sync, onboarding, and client errors is working
- [ ] Verify a named owner is watching launch-day errors for the first support window

## Analytics

- [ ] Confirm product analytics are either intentionally omitted or working as expected
- [ ] If launch metrics are manual, confirm who owns the manual check and where results will be recorded

## Rollback Readiness

- [ ] The previous known-good Vercel deployment is identified
- [ ] The revert path for environment/config changes is documented
- [ ] The rollback owner is named
- [ ] Database migration state is understood before deploy
- [ ] The team knows whether any launch changes are config-only, code-only, or schema-coupled

## Ownership And Signoff

- [ ] Engineering signoff
- [ ] Product/UX signoff on the core match-day flows
- [ ] Release owner signoff
- [ ] Support or operations contact named for the launch window
