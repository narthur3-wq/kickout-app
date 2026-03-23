# Páirc — GAA Match Analyst

A mobile-first progressive web app for live GAA match analysis. An analyst captures kickouts, shots, and turnovers during a match by tapping a pitch diagram. The app derives analytics in real time and produces a shareable post-match digest.

## Documentation

- [User Guide](documentation/user-guide.md) — how to use the app during a match
- [Technical Spec](documentation/technical-spec.md) — architecture, data model, coordinate system, build & deploy
- [CTO Briefing](documentation/cto-briefing.md) — product overview, tech rationale, scaling considerations

## Quick Start

```bash
npm install
npm run dev
```

### Environment variables

Create `.env.local` with your Supabase credentials (optional — app works fully offline without them):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

If neither variable is set, Supabase is disabled and all data persists to localStorage only.

Optional client-side admin visibility:

```
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

This only controls whether the in-app Admin tab is shown. Real admin enforcement happens in the Supabase Edge Function.

### Database setup

If using Supabase, run [`supabase/schema.sql`](supabase/schema.sql) once in your project's SQL editor.

## Admin Onboarding Automation

The app includes a Supabase Edge Function at [`supabase/functions/onboard-user/index.ts`](supabase/functions/onboard-user/index.ts) for onboarding without manual SQL edits.

Deploy the function and set these secrets in Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS` as a comma-separated list, for example `you@example.com,ops@example.com`

Once deployed, configured admin emails will see an **Admin** tab in the app where they can:

- add a user to their current club
- create/find another club and assign a user to it
- create the user's Supabase sign-in account with a temporary password in the same flow

The function upserts the user's row in `allowed_users` and can also create the Supabase Auth user. If the auth user already exists, it simply updates the club assignment.

## Stack

- **Svelte 4** + **Vite 7** — frontend
- **Supabase** — auth and Postgres (optional)
- **Vercel** — hosting
