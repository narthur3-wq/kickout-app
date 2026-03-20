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

### Database setup

If using Supabase, run [`supabase/schema.sql`](supabase/schema.sql) once in your project's SQL editor.

## Stack

- **Svelte 4** + **Vite 7** — frontend
- **Supabase** — auth and Postgres (optional)
- **Vercel** — hosting
