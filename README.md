# Pairc - GAA Match Analyst

A mobile-first progressive web app for live GAA match analysis. An analyst captures kickouts, shots, and turnovers during a match by tapping a pitch diagram. The app derives analytics in real time and produces a shareable post-match digest.

## Documentation

- [User Guide](documentation/user-guide.md) - how to use the app during a match
- [Technical Spec](documentation/technical-spec.md) - architecture, data model, coordinate system, build and deploy
- [CTO Briefing](documentation/cto-briefing.md) - product overview, tech rationale, scaling considerations

## Quick Start

```bash
npm install
npm run dev
npm run test
```

### Environment variables

Create `.env.local` with your Supabase credentials (optional - app works fully offline without them):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

If neither Supabase variable is set, Supabase is disabled and all data persists to localStorage only.

`VITE_ADMIN_EMAILS` only controls whether the in-app Admin tab is shown. Real admin enforcement happens in the Supabase Edge Function.

### Database setup

If using Supabase, run [`supabase/schema.sql`](supabase/schema.sql) once in your project's SQL editor, then apply any newer SQL files from [`supabase/migrations`](supabase/migrations).

## Admin Onboarding Automation

The app includes a Supabase Edge Function at [`supabase/functions/onboard-user/index.ts`](supabase/functions/onboard-user/index.ts) for onboarding without manual SQL edits.

Deploy the function and set these secrets in Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS` as a comma-separated list, for example `you@example.com,ops@example.com`
- `ALLOWED_ORIGIN` set to your live app origin, for example `https://your-app-domain.vercel.app`

Once deployed, configured admin emails will see an **Admin** tab in the app where they can:

- add a user to their current club
- create or find another club and assign a user to it
- create the user's Supabase sign-in account with a password in the same flow

The function upserts the user's row in `allowed_users` and creates the Supabase Auth user in the same step. If the auth user already exists, it simply updates the club assignment.

If you later want email invites, the function also supports them. For that path to work in production:

- add your app URL to Supabase Auth redirect URLs
- configure a real SMTP sender in Supabase Auth
- keep `ALLOWED_ORIGIN` aligned with that same app URL

## Stack

- **Svelte 5** + **Vite 7** - frontend
- **Supabase** - auth and Postgres (optional)
- **Vercel** - hosting
