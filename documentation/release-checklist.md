# Release Checklist

Use this as the PR description checklist before merging a production-ready change.

## Merge Gate

- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e` including the WebKit smoke lane
- [ ] `npm run build`
- [x] Supabase-backed smoke path verified or explicitly waived
- [ ] `supabase/migrations/20260330000100_add_event_indexes.sql` applied for existing projects
- [ ] If analysis tabs are in launch scope, `supabase/migrations/20260406000100_add_analysis_tables.sql` and `supabase/migrations/20260406000200_add_possession_analysis_metadata.sql` are applied
- [ ] Docs updated so the explicit match model and `Events` log behavior match reality
- [ ] Diagnostics snapshot can be copied from the account menu after a sync or onboarding failure
- [ ] Browser matrix checked on at least Chromium and WebKit for the release-critical flows

## P1 - Supabase Smoke

- [x] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the test environment
- [x] Set `PAIRC_SMOKE_EMAIL` and `PAIRC_SMOKE_PASSWORD` for a dedicated smoke account
- [x] Run `npm run test:smoke`
- [x] Sign in, create a match, save an event, reload, and confirm the event is still present

Last verified: 2026-04-06 — 1 passed (9.8s), Chromium

## P2 - Docs

- [ ] Keep [technical-spec.md](technical-spec.md) aligned with the match entity model
- [ ] Keep [user-guide.md](user-guide.md) aligned with the current user flow
- [ ] Keep [backlog.md](backlog.md) aligned with what is actually implemented

## P3 - Operations

- [ ] Verify the onboarding function has `ALLOWED_ORIGIN`, `ADMIN_EMAILS`, and service-role secrets set in Supabase
- [ ] Verify sync, onboarding, and storage failures write to the diagnostics log
- [ ] Verify the account menu can copy and clear diagnostics locally

## Still Open

- [ ] Split the biggest parts of `src/App.svelte`
- [ ] Add durable remote monitoring if this app starts handling more than a small trusted team
