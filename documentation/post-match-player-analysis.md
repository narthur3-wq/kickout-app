# Post-Match Player Analysis

## Status

| Phase | Feature | Status |
|---|---|---|
| Phase 1 | Feature 1: Possession Analysis | Built by Codex — fixes merged in current working tree |
| Phase 2 | Feature 1 Extension: Cross-Match Aggregation | Built by Codex — Phase 2a and Phase 2b shipped |
| Phase 3 | Feature 2: Pass Destination / Progressive Impact | Built by Codex — fixes merged in current working tree |
| Phase 4 | Combined View | Deferred |

Resolved issues from the original Codex drop (fixed in the current working tree):

- `sessionLabel` undefined in PossessionAnalysisPanel — crashes when a player has more than one session
- Player input `disabled` logic inverted in both panels — sessions cannot be started
- Attacking direction normalization absent — forward/backward classification is wrong for any session where the attacking direction is toward lower y values
- Analysis view hardcodes `flip={false}` regardless of session orientation
- Eyebrow labels read "Feature 1" / "Feature 2" — must be replaced before real use

Implementation note: the shipped app already includes Phase 2a and Phase 2b using the local analysis store and Admin-managed roster state. The Supabase analysis schema and app sync are now in the repo; future work is only for extra resilience or richer pattern tooling.

---

## Overview

Two separate post-match analysis workflows:

- **Feature 1**: Player Possession Analysis
- **Feature 2**: Pass Destination / Progressive Impact

These features share a pitch coordinate model, match identity, and base pitch renderer. They do not share a logging flow or event schema, and they can be built and deployed independently.

Neither workflow is expected to run every week. The product should optimise for:

- low-friction resumption after a gap
- consistent player naming
- easy correction of mistakes
- clear visuals for occasional coaching review

---

## Player Identity

### Why not jersey number

Players in GAA can wear different numbers in different matches (position-based assignment). Jersey number is a per-match label, not a player identifier. It is not suitable as a cross-match key for analysis purposes.

### Approach

Player identity in the analysis features is **roster-based with a name fallback**:

- A team roster is managed in Admin settings (`squad_players`)
- Sessions store a stable `squad_player_id` when the analyst selects a roster entry
- The display name is still stored on the session for readability and legacy compatibility
- If a session predates the roster or was typed freehand, the UI falls back to a normalised `player_key` and surfaces a mismatch warning for reconciliation
- Cross-match aggregation prefers `squad_player_id`; name-based matching is a legacy fallback only

### Important constraint

Name matching is exact after normalisation when the roster ID is missing. "Cian Murphy" and "C Murphy" are treated as different players. The UI flags unmatched sessions so analysts can reconcile them to a roster entry (see Correction Policy).

### Relationship to existing event tracking

Existing in-match events (shots, tackles, turnovers, kickouts) are logged by jersey number. There is no attempt to cross-reference these with analysis sessions. They serve different purposes and use different identity models.

---

## Correction Policy

During active logging:
- Draft events render immediately in the session builder at reduced opacity
- Undo last event removes the most recent draft event
- Draft lists include a per-event remove action for long sessions
- Discard draft discards the entire unsaved session

After a session is finalized:
- Sessions can be deleted and re-logged
- Player identity can be reassigned to a roster entry to fix spelling inconsistencies across matches
- Individual event editing within a finalized session is deferred - delete and re-log if the session data is wrong

---

## Shared Foundations

The two features share:

- match records
- pitch coordinate system
- squad roster identity model (when available)
- attacking-direction normalisation (`our_goal_at_top` per session)
- session metadata structure
- base pitch renderer (connections, overlays, interactive prop)
- player switcher pattern
- empty state and loading patterns
- storage key (`ko_post_match_analysis`) and scope migration

The two features do not share:

- logging flow
- outcome taxonomy
- event schema
- summary calculations

---

## Feature 1: Player Possession Analysis

### Purpose

Enable an analyst to log and visualise where a player receives the ball, how far they carry it, and what the outcome is. Primary use case: understanding whether a player's scoring returns are being limited by positioning, pressure, or carry patterns rather than finishing.

### Value Proposition

- Replaces manual video scrubbing for spatial possession analysis
- Makes receive location tendencies obvious in a coaching review
- Separates service problems from finishing or decision-making problems
- Produces a clear, defensible visual for a short player debrief

### Data Model

Each possession event records:

- `match_id` — completed match
- `squad_player_id` — optional roster ID for cross-match identity
- `player_name` — player being analysed (free text, normalised for matching)
- `receive_x / receive_y` — pitch coordinates of reception (normalised 0–1)
- `release_x / release_y` — pitch coordinates of release (normalised 0–1)
- `outcome` — event result
- `under_pressure` — optional flag
- `created_at` — timestamp

Sessions also carry `our_goal_at_top` to record which direction the player was attacking when events were logged. This is required for correct direction classification.

### Outcome Taxonomy

- Score point
- Score goal
- Shot wide
- Shot saved / blocked / short
- Possession lost
- Passed / offloaded
- Foul won

### Logging Flow

Entry point: completed match → Analysis tab → Possession tab → Start draft session

1. Select player from squad name list (or type a name)
2. Confirm attacking direction (`our_goal_at_top`)
3. Tap receive location on pitch
4. Tap release location on pitch
5. Select outcome
6. Optionally toggle under pressure
7. Confirm and loop to the next event
8. Finalize session commits the draft session

### Session Rules

- Sessions are per player per match
- Multiple sessions can exist for the same player and match
- No minimum event count required
- Draft events remain visible in the builder as ghosted overlays and a numbered list until the session is finalized

### Viewing / Analysis

Entry point: completed match → Analysis tab → Possession tab

**Toggle:** This match / Across matches (multi-select — see Phase 2)

**Player switcher:** pill tabs showing players with logged sessions; instant re-render on switch

**Pitch view toggles:**

Dot view:
- Dot at receive location, coloured by outcome
- Arrow to release location
- Arrow colour: green = forward, yellow = lateral, red = backward
- Tap a dot for event detail
- Under-pressure events use a distinct marker (ring)

Heat map view:
- Kernel density over receive locations
- Intensity = frequency of touches
- No arrows in this mode

**Summary strip:**
- Total events logged
- Outcome breakdown
- Carry direction split (forward / lateral / backward %)
- Average carry distance
- Sample-size note when event count is small (threshold: fewer than 5 events)

### Out of Scope (Feature 1)

- Where the ball goes after release (Feature 2)
- Real-time / in-match logging
- Team-level aggregation
- Video timestamp linking

---

## Feature 2: Pass Destination / Progressive Impact

### Purpose

Enable an analyst to log and visualise where a player's passes travel to, not just where they are released from. Surfaces players who accumulate high touch counts without advancing play.

### Value Proposition

- Identifies players who are busy without progressing the ball
- Quantifies forward contribution per possession
- Supports role evaluation: a player with 30 touches but all lateral or backward passes has a measurable low progressive impact

### Data Model

Each pass event records:

- `match_id` — completed match
- `squad_player_id` — optional roster ID for cross-match identity
- `player_name` — player being analysed
- `from_x / from_y` — release location (normalised 0–1)
- `to_x / to_y` — arrival location (normalised 0–1)
- `pass_type` — Kickpass / Handpass
- `completed` — whether the pass reached the target
- `created_at` — timestamp

Sessions carry `our_goal_at_top` for direction normalisation.

This is a separate logging workflow. It is not derived from Feature 1 data.

### Logging Flow

Entry point: completed match → Analysis tab → Pass Impact tab → Start draft session

1. Select player from squad name list
2. Confirm attacking direction
3. Tap release location (from)
4. Tap arrival location (to)
5. Select pass type (Kickpass / Handpass)
6. Mark incomplete if the pass did not reach the target
7. Confirm and loop to the next pass
8. Finalize session commits the draft session

### Viewing / Analysis

**Player switcher:** same pattern as Feature 1

**Pitch view:**
- Lines from → to for each pass
- Line colour: green = forward, yellow = lateral, red = backward
- Incomplete passes shown as dashed lines
- Line weight scales with frequency when multiple passes link the same zones
- Tap a connection for detail

**Summary strip:**
- Total passes logged
- Completion rate
- Progressive pass %
- Average metres gained per pass
- Breakdown by Kickpass vs Handpass (direction + completion per type)

### Out of Scope (Feature 2)

- Linking pass destination to a named receiving player
- Full team passing network
- Real-time logging
- Cross-match pass aggregation (future phase)
- Combined possession + passing view

---

## Phase 2: Cross-Match Possession Aggregation

### Purpose

Extend Feature 1 from single-match analysis to a player-level view across multiple selected matches. A single match heat map is one data point. Across a season it becomes a pattern.

### Value Proposition

- Identify persistent positioning tendencies vs one-off occurrences
- Track whether coaching interventions are working over time
- Give context to single-match sessions: "this is the fourth match we have seen this"

### Current Implementation

- Cross-match aggregation and trend comparison are already shipped in the app using the analysis store
- Roster management is handled from Admin settings and feeds the analysis autocomplete / reconciliation flow
- Supabase sync is implemented for durability and multi-device review; local-first remains the fallback

### Prerequisites

**Phase 2 pre-A — Squad roster + identity model**

A lightweight team-scoped roster that feeds autocomplete in both panels and provides stable player IDs for cross-match aggregation.

Supabase table:

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
```

UI: squad management in Admin settings (add player by name, rename, mark inactive). No jersey number — numbers are match-specific and not used for cross-match identity.

**Phase 2 pre-B — Supabase sync for analysis sessions**

Analysis data is local-first in the app and now syncs to the Supabase analysis tables using the same retry-queue pattern as match events. The remaining work, if any, is only further resilience polish.

Supabase schema:

```sql
create table public.possession_sessions (
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

create table public.possession_events (
  id uuid primary key,
  session_id uuid references public.possession_sessions(id) on delete cascade,
  receive_x numeric not null,
  receive_y numeric not null,
  release_x numeric not null,
  release_y numeric not null,
  outcome text not null,
  under_pressure boolean not null default false,
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

Sync follows the same local-first, retry-queue pattern as events. RLS should be team-scoped, same as events and matches.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Player identity | Squad roster ID with name fallback | Stable across matches while supporting legacy sessions |
| Name consistency | Roster autocomplete + reconcile unmatched names | Prevents silent split of the same player into two identities |
| Roster management | Admin settings | Keeps roster maintenance out of match-day flow |
| Match selection UI | Toggle on Possession tab: This match / multi-select across matches | Keeps single-match workflow intact; cross-match is a deeper optional view |
| Player name mismatches | Surfaced in UI with edit affordance | Simpler than fuzzy matching; coach retains control |

### Phase 2a — Cross-Match Player Profile (Primary Phase 2 Delivery)

**Entry point:** Possession tab → select a player → "View across matches" (shown when sessions exist across more than one match)

**Match selector:**
- Multi-select list of matches that have sessions for this player
- Each match shows event count and date
- Defaults to all selected
- Persists selection for the session

**Player profile view:**
- Player name header
- Total matches included (of total available)
- Total possession events
- Date range
- Sample-size caveat if fewer than 3 matches selected

**Aggregated heat map:**
- Combined receive location density across all selected matches
- Same renderer as single-match heat map

**Aggregated summary strip:**
- Total events
- Outcome breakdown (%)
- Carry direction split
- Average carry distance

**Per-match breakdown table:**
- One row per included match
- Columns: match, date, events, forward %, backward %, top outcome
- Tappable row drills back to that match's single-match session

### Phase 2b — Trend Comparison

Shipped alongside Phase 2a once there is enough data to make comparison meaningful (practical minimum: 4–5 matches per player).

**Chronological comparison:**
- Split sessions at the midpoint chronologically or by a coach-selected date
- Show two heat maps side by side or toggled: before / after
- Direction trend delta: forward % change between periods

**Last N matches selector:**
- N = 3 or 5, coach selectable
- Compare last N vs all prior sessions
- Summary stat: "in the last 3 matches, X% of touches were in the attacking third vs Y% before"

No automated pattern detection or ML in this phase. The visual comparison makes the coaching point without it.

### Out of Scope (Phase 2)

- Pass impact cross-match aggregation (future phase)
- Team-level aggregation
- Player comparison across squad members
- Automatic pattern detection
- Export or sharing of player profiles

---

## Roadmap

### Phase 1 — Feature 1: Possession Analysis
Status: Built and validated.

Implementation notes:
- Draft events are visible immediately in the session builder as low-opacity pitch overlays plus a numbered draft list
- `Finalize session` is the commit point for the session
- `Discard draft` removes the unsaved session entirely
- Individual event editing remains deferred; remove and re-log if a finalized session is wrong
- Sample-size notes remain on the summary strip for small datasets

### Phase 2 follow-on — Future resilience
- Pass impact cross-match aggregation
- Combined possession + passing view
- Automatic pattern detection or alerts beyond the visual trend comparison

### Phase 2a — Cross-Match Player Profile
- `sessionsForPlayer` query across all matches
- Match multi-select UI
- Aggregated heat map
- Aggregated summary strip
- Per-match breakdown table
- Drill-through to single-match session
- Sample-size caveat

### Phase 2b — Trend Comparison
- Chronological split comparison
- Last N matches selector
- Before/after heat map toggle
- Direction trend delta

### Phase 3 — Feature 2: Pass Destination / Progressive Impact
Status: Built and validated.

### Phase 4 — Optional Combined View
- Possession analysis and pass impact together for one player in one view
- Not required for any earlier phase

---

## Working Isolation

Features 1 and 2 can be built and deployed independently. Recommended boundaries:

- separate tabs and logging flows
- separate event schemas and session storage keys within the shared state object
- shared pitch renderer, coordinate system, and player switcher pattern
- attacking-direction normalisation handled once in `postMatchAnalysis.js`, used by both features
