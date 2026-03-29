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

The app determines the current match from:

- `match_date`
- normalized `team`
- normalized `opponent`

That key is used to decide:

- which events belong to the current match
- which scoreline to show in the shell
- what data feeds `Live` and `Digest`

This makes setup changes operationally important. Changing those values changes the current match context.

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
- first-login migration moves older local-only records into user-scoped storage

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
