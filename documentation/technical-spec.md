# Pairc - Technical Specification

## Overview

Pairc is a Svelte 5 progressive web app for live GAA match analysis. It is an offline-first client application with optional Supabase auth and sync.

The current product focus is:

- live capture
- live analyst interpretation
- coach-facing match summaries

It is not intended to be a full club operations platform.

## Architecture

High-level shape:

- `src/App.svelte`
  - app shell
  - auth/session handling
  - match setup and capture state
  - sync orchestration
  - tab routing
- `src/lib/CaptureForm.svelte`
  - event form UI
- `src/lib/Pitch.svelte`
  - pitch rendering and capture interaction
- `src/lib/AnalyticsPanel.svelte`
  - Kickouts / Shots / Turnovers analysis
- `src/lib/LivePanel.svelte`
  - analyst-first live read
- `src/lib/DigestPanel.svelte`
  - coach-facing summary and image export
- `src/lib/EventsTable.svelte`
  - event log, search, edit support
- `src/lib/AdminPanel.svelte`
  - lightweight admin/onboarding operations

Supporting helper modules include:

- `analyticsHelpers.js`
- `appShellHelpers.js`
- `captureDraft.js`
- `eventRecord.js`
- `importMerge.js`
- `liveInsights.js`
- `score.js`
- `storageScope.js`
- `supabase.js`
- `thresholds.js`

## Data model

Core event fields:

- `id`
- `schema_version`
- `created_at`
- `match_id` (links to the parent match entity; absent on legacy pre-migration events)
- `match_date`
- `team`
- `opponent`
- `event_type`
- `direction`
- `period`
- `clock`
- `contest_type`
- `outcome`
- `break_outcome`
- `restart_reason`
- `shot_type`
- `target_player`
- `turnover_lost_player`
- `turnover_won_player`
- `x`, `y`
- `x_m`, `y_m`
- `pickup_x`, `pickup_y`
- `pickup_x_m`, `pickup_y_m`
- `break_displacement_m`
- `score_us`, `score_them`
- `flag`
- `ko_sequence`
- `team_id`
- `updated_at`

Canonical schema source:

- [`supabase/schema.sql`](../supabase/schema.sql)
- newer changes in [`supabase/migrations`](../supabase/migrations)

## Match identity

The app uses an explicit match entity model. Each match has a unique `id` (UUID) stored in a `matches` record.

Canonical identity:

- `matches.id` is the authoritative match identifier
- events are linked via `events.match_id`
- match records carry `team`, `opponent`, `match_date`, `status`, and timestamps

Fallback identity (legacy and import):

- for events that pre-date the match entity model, or for imports from older exports, the app falls back to a logical key: `match_date|team|opponent`
- this fallback is used only when `match_id` is absent or unresolvable

Match-scoped behaviour:

- the shell scoreline filters by `match_id` when an active match is selected, falling back to the logical key for legacy events without a `match_id`
- `Live` and `Digest` both scope to `currentMatchEvents`, which uses `match_id` as the primary filter
- score snapshots group by `match_id` first, then fall back to the logical key for unmigrated events
- import merging resolves imported match records by ID, then by logical key, then creates new records from event metadata
- `Events` is the broader event log for the current storage scope; it supports search, edit, import, and export across the stored history rather than only the active match

Setup changes update the active match record and back-fill the new team/opponent/date onto existing events for that match. This keeps the match model consistent across devices.

## Coordinate system

The pitch is rendered at GAA proportions and stores normalized coordinates.

Conceptually:

- one axis stores side position
- one axis stores depth from our goal end

The app normalizes depth from our own goal so that analytics remain consistent even when the physical defended end changes.

Break kickouts also store:

- landing point
- pickup point
- break displacement

Turnovers currently store a single location plus named loser/winner players.

## Post-match analysis

Two post-match analysis workflows are built as separate tabs: Possession Analysis (Feature 1) and Pass Impact (Feature 2). Full product spec: [post-match-player-analysis.md](post-match-player-analysis.md).

### Player identity

Analysis sessions use a **squad roster ID** as the cross-match identity key, not jersey number. Jersey numbers are not consistent across matches in GAA (position-based assignment). Numbers remain the identifier for in-match event tracking (shots, tackles, turnovers, kickouts) and the two systems are not cross-referenced.

Sessions store a `squad_player_id` when the analyst selects a roster entry. The display name is still stored on the session for readability and legacy compatibility. When `squad_player_id` is missing (legacy or free-text), the UI falls back to a normalised `player_key` and surfaces a reconciliation warning. Roster management lives in Admin settings, is persisted in the local analysis scope, and syncs to the Supabase roster table for cross-match identity and reconciliation.

While a session is being built, draft events stay in component state and render as ghosted overlays plus a numbered draft list. Only when the analyst taps `Finalize session` does the draft become part of the saved analysis state and sync queue.

### Coordinate model

Each event stores normalised pitch coordinates (0–1 range) plus an `our_goal_at_top` flag on the session. Direction classification (forward / lateral / backward) must normalise the y-axis against this flag before computing the depth delta. Raw coordinates without normalisation will produce inverted direction labels when the attacking direction is toward lower y values.

Possession events may also store `carry_waypoints` plus nullable `target_x / target_y` values so one post-match event can represent `A -> waypoint(s) -> B -> C` without freehand drawing. Carry metrics sum the full carry path when waypoints exist, while ball metrics separately measure the `B -> C` leg when a destination is present.

### Local storage

Analysis state is stored under the key `ko_post_match_analysis` within the scoped storage pattern. The shape is:

```json
{
  "version": 1,
  "squadPlayers": [...],
  "possessionSessions": [...],
  "passSessions": [...]
}
```

Sessions carry `match_id`, `player_name`, and optional `squad_player_id`. Events carry coordinates, outcome or pass metadata, and a timestamp. Possession events now also normalize `carry_waypoints`, nullable destination fields, and `assist` through local-first save/load and sync. The saved possession analysis view persists UI state for action-family filters and carry-vs-ball path filters, and finalized events can be corrected in place through explicit point controls plus pitch handles. Draft sessions are not written to the stored analysis arrays until they are finalized.

Scope migration (`migrateLocalScopeToUserScope`) merges analysis state by session ID, same as events.

### Supabase schema and sync (landed)

Analysis data is local-first in the UI, and the app now syncs analysis sessions and roster state to the Supabase tables below using the same retry-queue pattern as match events. The schema lives in `supabase/schema.sql` and the matching migration files:

```sql
create table public.squad_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists squad_players_team_name_unique
  on public.squad_players (team_id, lower(name));

create table public.possession_sessions (
  id uuid primary key,
  team_id uuid references public.teams(id),
  match_id text references public.matches(id),
  squad_player_id uuid references public.squad_players(id),
  player_name text not null,
  our_goal_at_top boolean not null default true,
  half text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.possession_events (
  id uuid primary key,
  session_id uuid references public.possession_sessions(id) on delete cascade,
  receive_x numeric not null,
  receive_y numeric not null,
  carry_waypoints jsonb not null default '[]'::jsonb,
  release_x numeric not null,
  release_y numeric not null,
  target_x numeric,
  target_y numeric,
  outcome text not null,
  under_pressure boolean not null default false,
  assist boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pass_sessions (
  id uuid primary key,
  team_id uuid references public.teams(id),
  match_id text references public.matches(id),
  squad_player_id uuid references public.squad_players(id),
  player_name text not null,
  our_goal_at_top boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pass_events (
  id uuid primary key,
  session_id uuid references public.pass_sessions(id) on delete cascade,
  from_x numeric not null,
  from_y numeric not null,
  to_x numeric not null,
  to_y numeric not null,
  pass_type text not null,
  completed boolean not null default true,
  created_at timestamptz not null default now()
);
```

RLS must be team-scoped on all five tables. Sync ordering: sessions before events (same FK guarantee as matches before events).

---

## Sync and persistence

The app is local-first.

Local persistence:

- match metadata
- event records
- pending sync queue
- post-match analysis sessions and roster state (localStorage-backed with Supabase sync and retry queues)

Cloud sync:

- optional
- Supabase-backed
- team-scoped when the user has a team assignment

Current behavior:

- saves are written locally first
- failed cloud writes are queued
- queued writes can be retried
- realtime refresh is used when Supabase is configured
- sync uses a stored `updated_at` cursor per storage scope to fetch deltas after the first full reconciliation
- reconnects and destructive realtime events force a full refresh so the local view can be reconciled safely
- first-login migration moves older local-only records into user-scoped storage

Sync ordering guarantee:

- event upserts whose parent match is still pending are deferred to the flush queue, not pushed immediately, so that the match FK is always satisfied before the event reaches Supabase
- `flushSyncQueue` processes matches before events, in line with this ordering guarantee

## Team and access model

Current access shape:

- optional Supabase login
- team-scoped access using `team_id`
- team-scoped RLS in Supabase

Important product constraint:

- the app can share a match across devices for the same team
- it does not deduplicate two analysts logging the same event independently

Operationally, concurrent capture works best when analysts split responsibility by event type.

## Capture behavior

Kickouts:

- team
- period
- contest
- outcome
- optional restart reason
- optional target player
- location
- optional pickup location for break contests

Shots:

- team
- period
- outcome
- location
- optional goal-attempt annotation for `Wide` and `Blocked`

Turnovers:

- team
- period
- outcome
- location
- `Lost by`
- `Won by`

## Live and Digest

`Live` and `Digest` both operate on the current match and current phase scope.

`Live` is the operational analyst screen.

`Digest` is the coach-facing summary layer.

Both consume shared derived logic from:

- `liveInsights.js`
- `thresholds.js`

## Analytics visual model

Base grammar:

- position = where the event happened
- shape = which team the event belongs to
- color = result
- ring = special annotation only where needed

Shots intentionally carry one extra layer of detail compared with kickouts and turnovers.

See [`visual-language.md`](./visual-language.md) for the current visual rules.

## Deployment

Primary deployment target:

- Vercel

PWA handling:

- `vite-plugin-pwa`
- generated `manifest.webmanifest`
- generated service worker

The repo does **not** rely on a committed `docs/` folder for deployment.

## Testing

Current quality gate:

- lint
- unit/component coverage
- Playwright end-to-end flows
- production build

The highest-risk areas remain:

- `App.svelte` app-shell behavior
- analytics branch combinations
- real multi-device signed-in sync behavior

## Current limitations

- the app is still primarily a specialist match-day tool, not a full season platform
- concurrent analysts can still duplicate events if they log the same stream
- some of the heavier shell responsibilities are still concentrated in `App.svelte`
- first install still requires network even though ongoing use is resilient offline
