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

## Sync and persistence

The app is local-first.

Local persistence:

- match metadata
- event records
- pending sync queue

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
