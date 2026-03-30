# Release Checklist

Use this as the PR description checklist before merging a production-ready change.

## Merge Gate

- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] Supabase-backed smoke path verified or explicitly waived
- [ ] `supabase/migrations/20260330000100_add_event_indexes.sql` applied for existing projects
- [ ] Docs updated so the explicit match model and `Events` log behavior match reality
- [ ] Diagnostics snapshot can be copied from the account menu after a sync or onboarding failure

## P1 - Supabase Smoke

- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the test environment
- [ ] Set `PAIRC_SMOKE_EMAIL` and `PAIRC_SMOKE_PASSWORD` for a dedicated smoke account
- [ ] Run `npm run test:smoke`
- [ ] Sign in, create a match, save an event, reload, and confirm the event is still present

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
