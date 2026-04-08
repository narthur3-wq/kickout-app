# Pairc - GAA Match Analyst

A mobile-first progressive web app for live GAA match analysis. An analyst captures kickouts, shots, and turnovers during a match by tapping a pitch diagram. The app derives analytics in real time and produces a shareable post-match digest.

## Documentation

- [User Guide](documentation/user-guide.md) - how to use the app during a match
- [Technical Spec](documentation/technical-spec.md) - architecture, data model, coordinate system, build and deploy
- [CTO Briefing](documentation/cto-briefing.md) - product overview, tech rationale, scaling considerations
- [Product Positioning](documentation/product-positioning.md) - what Pairc is, and what it is not
- [Visual Language](documentation/visual-language.md) - how pitch maps encode team, result, and special annotations
- [Multi-Analyst Setup](documentation/multi-analyst-setup.md) - recommended setup for two analysts on one match
- [Release Checklist](documentation/release-checklist.md) - merge gate, smoke path, docs, and operational checks

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

**Fresh project:** run [`supabase/schema.sql`](supabase/schema.sql) once in your project's SQL editor. It includes all schema and indexes up to date — no migrations need to be applied separately.

**Existing project (upgrading):** apply only the migration files newer than your current schema state, in filename order, from [`supabase/migrations`](supabase/migrations). Do not re-run `schema.sql` on an existing database.

Current migrations in order:
1. `20260322000000_add_rls.sql`
2. `20260323000000_team_rls.sql`
3. `20260323010000_team_name_uniqueness.sql`
4. `20260325000100_allow_null_contest_type.sql`
5. `20260326000100_add_turnover_players.sql`
6. `20260329000100_add_matches_table.sql`
7. `20260329000200_add_event_match_id.sql`
8. `20260330000100_add_event_indexes.sql` — adds indexes on `events.team_id` and `events.match_id`
9. `20260406000100_add_analysis_tables.sql` — adds the analysis session/event tables
10. `20260406000200_add_possession_analysis_metadata.sql` — adds `half` and `assist` to possession analysis rows

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

Creating a user in Supabase Auth alone is not enough for login. The email must also exist in `allowed_users`, which is why the Admin onboarding flow creates both records together.

If you later want email invites, the function also supports them. For that path to work in production:

- add your app URL to Supabase Auth redirect URLs
- configure a real SMTP sender in Supabase Auth
- keep `ALLOWED_ORIGIN` aligned with that same app URL

## Stack

- **Svelte 5** + **Vite 7** - frontend
- **Supabase** - auth and Postgres (optional)
- **Vercel** - hosting
