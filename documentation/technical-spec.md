# Páirc — Technical Specification

**Version:** 1.0
**Date:** March 2026
**Stack:** Svelte 4 · Vite 7 · Supabase · TypeScript

---

## 1. Overview

Páirc is a progressive web app (PWA) for live GAA match analysis. A single analyst captures events during a match — kickouts, shots, and turnovers — by tapping a pitch diagram. The app derives analytics in real time and produces a shareable digest.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (PWA)                                           │
│                                                          │
│  App.svelte ─── state + derived analytics                │
│      │                                                   │
│      ├── CaptureForm.svelte  (event input)               │
│      ├── Pitch.svelte        (SVG pitch + click/kb nav)  │
│      ├── AnalyticsPanel.svelte (stats, charts)           │
│      ├── DigestPanel.svelte  (shareable match summary)   │
│      ├── EventsTable.svelte  (raw event log)             │
│      └── Login.svelte        (Supabase Auth)             │
│                                                          │
│  localStorage ── ko_events, ko_meta, ko_sync_queue       │
└─────────────────────────────┬───────────────────────────┘
                              │ HTTPS / supabase-js
                    ┌─────────▼─────────┐
                    │  Supabase          │
                    │  Auth (email/pw)   │
                    │  Postgres: events  │
                    └───────────────────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| Offline-first (localStorage primary) | Reliable at pitchside where connectivity is poor |
| Sync queue | Failed Supabase writes are retried automatically on reconnect |
| Derived score | Score is computed from Shot events (Goals×3 + Points), never entered manually |
| Normalised coordinates | y=0 always means own goal end, regardless of which physical end the team defends — ensures correct analytics for home vs away |
| Auto-flip on H2 | Switching to H2 period automatically mirrors `ourGoalAtTop` so pitch orientation stays correct without operator action |

---

## 3. Data Model

### Event object (stored in `ko_events` and Supabase `events` table)

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Unique event identifier |
| `schema_version` | number | Always `1` — allows future migrations |
| `created_at` | ISO string | Client timestamp of capture |
| `match_date` | `YYYY-MM-DD` | Date of match |
| `team` | string | Our team name |
| `opponent` | string | Opponent name |
| `event_type` | `kickout` \| `shot` \| `turnover` | Type of match event |
| `direction` | `ours` \| `theirs` | Whose kickout/possession |
| `period` | `H1` \| `H2` \| `ET` | Match period |
| `contest` | `clean` \| `break` \| `foul` \| `out` | How ball was contested |
| `outcome` | string | Result (Retained/Lost/Score/Wide/Goal/Point/Foul/Out/Won) |
| `break_outcome` | `won` \| `lost` \| `neutral` | Result of contested ball |
| `restart_reason` | `Score` \| `Wide` \| `Foul` \| `Out` \| `''` | What caused this kickout |
| `target_player` | number \| string | Jersey number of target player (1–15 or custom) |
| `landing` | `{x, y}` | Normalised landing coords (see §4) |
| `pickup` | `{x, y}` | Normalised pickup coords (break contests only) |
| `clock` | string | Match clock at event (`mm:ss`) |
| `flag` | boolean | Flagged for review |
| `score_us` | string | Derived score at time of event (`G-P` format) |
| `at_target` | boolean | Ball reached intended target player |

### Supabase table schema

```sql
create table events (
  id           text primary key,
  schema_version integer not null default 1,
  created_at   timestamptz not null,
  match_date   date,
  team         text,
  opponent     text,
  event_type   text,
  direction    text,
  period       text,
  contest      text,
  outcome      text,
  break_outcome text,
  restart_reason text,
  target_player text,
  landing      jsonb,
  pickup       jsonb,
  clock        text,
  flag         boolean default false,
  score_us     text,
  at_target    boolean default false,
  user_id      uuid references auth.users(id)
);
```

---

## 4. Coordinate System

The pitch SVG renders at **145 × 90** units (length × width). Stored coordinates are normalised `[0, 1]`:

- **x** = side position: 0 = top touchline, 1 = bottom touchline
- **y** = depth: **always 0 = own goal end**, regardless of which physical end that is

### Normalisation at save time

```js
const normY     = ourGoalAtTop ? landing.y : 1 - landing.y;
const normPickY = ourGoalAtTop ? pickup.y  : 1 - pickup.y;
```

This ensures away match events display correctly when overlaid — the "short" end is always the team's own half.

### Display conversion

```js
const svgX = (o) => (flip ? 1 - o.y : o.y) * W;   // stored y → SVG x
const svgY = (o) => o.x * H;                        // stored x → SVG y
```

---

## 5. Offline Sync

1. Every event is saved to `localStorage` immediately on capture.
2. If Supabase is configured and the user is signed in, the event is also upserted to Supabase.
3. If the upsert fails (offline, network error), the event `id` is added to `ko_sync_queue` (also persisted to localStorage).
4. On `online` event (browser connectivity restored), `flushSyncQueue()` retries all pending IDs.
5. The header shows sync state: `Offline`, `⚠ N pending`, `↻ syncing`, `✓ synced`.

---

## 6. Analytics Derivations

All analytics are computed client-side from the `events` array using Svelte reactive statements (`$:`).

| Stat | Derivation |
|---|---|
| Retention % | `RETAINED.has(outcome)` / total. `RETAINED = {Retained, Score, Won}` |
| Zone stats | Events grouped by `zoneCode(x, y)` — 3 sides × 4 depths = 12 zones |
| Player stats | Events grouped by `target_player`, sorted by volume |
| Clock trend | Events grouped into 10-minute windows by `clock` field |
| Restart retention | Events grouped by `restart_reason` (min 3 events to show) |
| Derived score | Goals × 3 + Points from `event_type=shot` in current match |
| Opp tendency | Their kickout landing zone distribution + our win rate per zone |

---

## 7. Pitch SVG

File: `src/lib/Pitch.svelte`

Markings rendered at 1:1 GAA regulation dimensions (metres):

- Boundary, halfway line
- 20m, 45m, 65m lines (both ends)
- Goal small rectangle: 14m wide × 4.5m deep
- D arc: r=13m, centred on goal line
- 40m arc: r=40m, centred on goal line
- Centre circle: r=10m

Click → `landed` event (normalised coords).
Second click on break contest → `picked` event (pickup location).
Arrow key navigation + Enter/Space for keyboard accessibility.

---

## 8. Build & Deploy

```bash
npm run dev      # Vite dev server
npm run build    # Build to dist/
npm run preview  # Preview build
```

### Vercel deployment

- `vite.config.js`: `base: '/'`
- `vercel.json`: SPA rewrite — all routes → `index.html`
- GitHub Actions: not currently configured; push to `main` triggers Vercel auto-deploy

### GitHub Pages (docs/)

The `docs/` directory serves the static build for GitHub Pages at `https://[user].github.io/ko-app/`. This is a secondary deployment target; Vercel is primary.

---

## 9. Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable anon key |

If neither is set, Supabase is disabled and the app runs fully offline in localStorage-only mode. Set in `.env.local` for development; in Vercel project settings for production.

---

## 10. Known Limitations & Future Work

| Item | Notes |
|---|---|
| No RLS on Supabase | Currently all authenticated users can read all rows. Per-user RLS policy needed before multi-team use. |
| No push sync | Changes on another device only appear after manual refresh or re-login. |
| No video integration | Clip timestamping not yet implemented. |
| Single-analyst model | No concurrent capture from multiple devices for same match. |
| Export | JSON export of raw events is available; CSV export not yet implemented. |
