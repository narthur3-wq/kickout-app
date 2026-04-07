# Pairc — Product Backlog

Last updated: 2026-04-06

Status key: `open` · `partial` · `deferred` · `done`

---

## Match Entity (M-series)

Introducing a real match record as the source of truth for current-match identity. Replaces the current inferred match key (team + opponent + date). Tracked in four sequential phases.

### Phase 1 — Local Match Layer

**M-01 — Create matchStore.js**
Priority: must
Status: done

Create `src/lib/matchStore.js`. Owns all local match logic:
- create match
- update match
- close / reopen match
- load / save matches from localStorage (`ko_matches`, `ko_active_match_id`)
- set / get active match
- migrate old events into match records

Keep separate from `storageScope.js` for now. Do not redesign all persistence at once.

Match shape:
```json
{
  "id": "uuid",
  "team_id": "uuid|null",
  "team": "Clontarf",
  "opponent": "Kilmacud Crokes",
  "match_date": "2026-05-10",
  "status": "open",
  "created_at": "ISO",
  "updated_at": "ISO",
  "last_event_at": "ISO|null",
  "created_by": "user-id|null",
  "closed_at": "ISO|null"
}
```

---

**M-02 — Local migration from inferred matches to explicit matches**
Priority: must
Status: done

On load, run once and idempotently:
- if `ko_matches` already exists, use it
- if not but events exist, group events by `match_date + normalized team + normalized opponent`
- create one match record per group
- assign `match_id` to each event
- set `activeMatchId` from current shell context if possible, otherwise the most recently updated match

---

**M-03 — Add match_id to events**
Priority: must
Status: done

Every newly saved event must include `match_id`.

Keep `team`, `opponent`, and `match_date` on events:
- backward compatibility with old imports
- readable exports
- less fragile analytics during transition

Event shape change:
```json
{
  "id": "uuid",
  "match_id": "uuid",
  "team": "Clontarf",
  "opponent": "Kilmacud Crokes",
  "match_date": "2026-05-10",
  "...existing fields...": "unchanged"
}
```

---

**M-04 — Replace inferred match authority in App.svelte**
Priority: must
Status: done

Stop treating `team + opponent + date` as the current-match source of truth.

Replace with:
- `matches` array
- `activeMatchId`
- derived `activeMatch`

Derive `team`, `opponent`, and `matchDate` for display and event creation from `activeMatch`.

Keep device-local: `period`, `orientation`, `timer`, `filters`, `capture draft`.

Do not run inferred-match logic and explicit-match logic in parallel longer than necessary. Migrate, then prefer `match_id`. Keep inferred matching only as fallback for old imports.

---

### Phase 2 — UI

**M-05 — MatchPicker.svelte**
Priority: must
Status: done

Create `src/lib/MatchPicker.svelte`. Supports:
- current active match display (banner in shell)
- open matches section
- recent matches section, sorted by `last_event_at`
- create new match (team, opponent, date only — no venue/competition yet)
- edit selected match
- close match
- reopen match

---

**M-06 — Match status model and read-only rules**
Priority: must
Status: done

`status: open | closed`

When `activeMatch.status === 'closed'`:
- block save
- block update
- block delete
- block delete-all
- block import into that match
- allow view and export
- show clear read-only banner
- disable mutating controls in `CaptureForm.svelte` and edit/delete affordances in `EventsTable.svelte`

---

**M-07 — Default Live and Digest to active match**
Priority: must
Status: done

Once a match is selected, all views default to it:
- `Live`
- `Digest`

`Events` remains the full event log for the current storage scope so search, edit, import, and export can review the complete history. Analytics can still allow broader views, but active match is the default for the analyst-facing summary surfaces.

---

**M-08 — Match switching guard**
Priority: must
Status: done

If capture draft is dirty and user switches match:
- prompt for confirmation
- discard draft only if confirmed

If editing an event and user switches match:
- cancel edit explicitly first

---

### Phase 3 — Import / Export

**M-09 — Match-aware export format**
Priority: must
Status: done

Preferred new export shape:
```json
{
  "matches": [...],
  "events": [...]
}
```

Old event-array format must remain supported for import.

---

**M-10 — Import backward compatibility**
Priority: must
Status: done

Import rules:
- if imported JSON is a flat array of events, auto-create or attach match records by inferred key
- never silently attach imported events to the wrong active match
- imported events with `match_id` should preserve that grouping
- imported events without `match_id` should generate match records
- importing into a closed active match must be blocked clearly

---

### Phase 4 — Supabase (after local-first is stable)

**M-11 — matches table in Supabase**
Priority: must
Status: deferred (depends on M-01 through M-10)

```sql
create table public.matches (
  id text primary key,
  team_id uuid references public.teams(id),
  team text not null,
  opponent text not null,
  match_date date not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_event_at timestamptz,
  created_by uuid,
  closed_at timestamptz
);
```

---

**M-12 — Add match_id to events table**
Priority: must
Status: deferred

```sql
alter table public.events
  add column if not exists match_id text references public.matches(id);
```

Backfill existing remote events from inferred key grouping.

---

**M-13 — Team-scoped RLS for matches**
Priority: must
Status: deferred

Matches must obey team scope the same way events do.

---

**M-14 — Sync matches like events**
Priority: must
Status: deferred

- local first
- retry queue on failure
- realtime updates for same-team users
- close/reopen status propagates across devices

Do not sync device-local state: timer, draft form, filters, orientation, active tab.

---

**M-15 — Closed-match enforcement across devices**
Priority: must
Status: deferred

If device A closes a match, device B becomes read-only after sync/realtime update.

---

### Tests

**M-T01 — matchStore unit tests**
Priority: must
Status: done

Covers:
- local migration from old events to matches
- create / select / edit / close / reopen match
- closed match blocks all mutations
- switching match with dirty draft

---

**M-T02 — Import/export tests**
Priority: must
Status: done

Covers:
- `extractImportedEvents` moved to `importMerge.js` and fully unit tested
- old flat event-array format, new `{ matches, events }` format, invalid format throws
- export/import round-trip preserves matches + events (covered by extractImportedEvents + planImportMerge tests)
- import into closed match is blocked (enforced at App.svelte level)

---

**M-T03 — App-level match switching tests**
Priority: must
Status: deferred

App-level integration tests require an E2E harness (App.svelte is not unit-testable in isolation without significant mocking). Covered structurally by matchStore unit tests (M-T01) and will be addressed with M-T04 E2E work.

---

**M-T04 — Multi-device shared match E2E**
Priority: should
Status: deferred

Covers:
- analyst A creates match, analyst B selects same match
- close on device A becomes read-only on device B
- current-match defaulting in Live and Digest, while Events remains the broader log

---

### Explicitly deferred (out of scope for this sprint)

- Fixtures calendar
- Automatic deduplication of two analysts logging the same event
- Competition hierarchy
- Full season analytics platform

---

## Existing Open Items

Remaining from independent review and code audit. Fixed items have been removed.

---

### P1 — Must fix (blocking correctness)

**B-38 — Cross-match edit corruption from global Events log**
Priority: must
Status: done

Editing an event from the global Events log could silently reassign it to the currently active match because `buildEvent` used `match_id: activeMatchId` unconditionally. Fixed: when `editingId` is set, `buildEvent` now preserves the original `match_id` from the event being edited (`events.find(r => r.id === editingId)?.match_id ?? activeMatchId`).
Files: `src/App.svelte`

---

### P2 — Should fix before wider go-live (continued)

**B-39 — Restart-context analytics miss legacy 'Point' and 'Goal' reasons**
Priority: should
Status: done

`restartStats` only recognised `['Score','Wide','Foul','Out']` but the shipped simulated fixture and older imported data also use `'Point'` and `'Goal'` as `restart_reason` values. Those events silently dropped from the restart breakdown. Fixed: expanded `REASONS` to `['Score','Wide','Foul','Out','Point','Goal']`.
File: `src/App.svelte`

---

**B-40 — Turnover net undercounts lost turnovers**
Priority: should
Status: done

`turnoverNet` was computed as `ourTurnovers.won - theirTurnovers.won`, which ignored events logged as `ours / Lost`. `koStat` now also counts `lost` outcomes; net formula updated to `(ourTurnovers.won - ourTurnovers.lost) - (theirTurnovers.won - theirTurnovers.lost)`.
File: `src/lib/DigestPanel.svelte`

---

### P3 — Should during beta (continued)

**B-41 — Digest renders player labels as ##11**
Priority: should
Status: done

`liveInsights.js` already prefixes player labels with `#` (e.g. `#11`). The Digest template additionally prepended a literal `#`, producing `##11`. Removed the hardcoded `#` from the Main Threat card in `DigestPanel.svelte`.
File: `src/lib/DigestPanel.svelte`

---

**B-42 — Events table score cell shows 0-1-0-0**
Priority: should
Status: done

`score_us` is stored as a formatted `goals-points` string (e.g. `"0-1"`). The score cell concatenated it with another `-` separator producing `0-1-0-0`. Fixed: separator changed to ` / ` so the cell now renders `0-1 / 0-0`.
File: `src/lib/EventsTable.svelte`

---

---

### P2 — Should fix before wider go-live

**B-19 — Zone tables minimum-sample UX**
Priority: should
Status: done

Standardised both zone tables to threshold n≥5 for percentage display (was 8 vs 3). Added `<caption class="kpi-table-caption">% shown when n ≥ 5</caption>` to both tables for inline explanation.
File: `src/lib/AnalyticsPanel.svelte`

---

**B-23 — Accessibility gaps**
Priority: should
Status: done

- Modal backdrops changed from `role="button" tabindex="-1"` to `role="presentation"` (no longer interactive elements in the focus order)
- `EventsTable` `<table>` now has `aria-label="Events log"`
Files: `src/App.svelte`, `src/lib/EventsTable.svelte`

---

### P3 — Should during beta

**B-26 — Pitch orientation indicator**
Priority: should
Status: done

Goal indicator banner strengthened: font size 13px/800 weight (was 11px/700), dark green background with bottom border accent, attacking direction text now 15px/900 weight, flip button more prominent. All in App.svelte `.goal-indicator` styles.
File: `src/App.svelte`

---

**B-27 — Filter state duplication**
Priority: should
Status: done

On review, Direction filter is only in the primary pill row — not in the advanced drawer. Drawer contains: Match, Opponent, Player, Contest, Outcome, Flags. No duplication present.
File: `src/lib/AnalyticsPanel.svelte`

---

**B-28 — Desktop analytics whitespace**
Priority: nice
Status: done

Added `panel-sections` grid wrapper around all section-cards. On screens ≥900px, renders as a 2-column grid with viz, zone breakdown, and player table spanning full width (`grid-column: 1 / -1`).
File: `src/lib/AnalyticsPanel.svelte`

---

**B-29 — Kickout tables visual treatment**
Priority: nice
Status: done

kpi-table redesigned: dark header row (`#111827` background, white text, uppercase), bold row headers on left column, stronger cell borders, `border-radius` on table, hover state on rows. Feels like an analysis component rather than a plain spreadsheet.
File: `src/lib/AnalyticsPanel.svelte`

---

**B-30 — Digest halftime sheet gaps**
Priority: should
Status: done

Added:
- Secondary threat player (`insights.threat.secondaryThreat`) now shown in Main Threat card
- Primary kickout winner (`insights.kickoutPattern.primaryWinner`) shown inline in restart strip
- Turnover net metric (won/total for ours + theirs, net diff with colour coding) in hero restart strip when turnover events exist
- Momentum card using `insights.scoreMomentum` and `insights.kickoutMomentum` with directional arrows (▲/▼) and tone colouring
File: `src/lib/DigestPanel.svelte`

---

**B-33 — npm audit advisories**
Priority: should
Status: done

Added `"overrides": { "serialize-javascript": ">=7.0.5" }` to package.json. Ran `npm audit fix` to resolve brace-expansion and picomatch vulnerabilities. Result: 0 vulnerabilities.
File: `package.json`

---

### P4 — Polish, post-beta

**B-34 — Momentum and alerts visual emphasis in Digest**
Priority: nice
Status: done

Momentum card added in B-30. Uses tone-coloured text (green positive / red negative / grey neutral) with ▲/▼ directional icons. Covered by B-30 implementation.
File: `src/lib/DigestPanel.svelte`

---

**B-35 — Shots vs Turnovers tab differentiation**
Priority: nice
Status: open

Both tabs share identical layout structure. Differentiation is minimal beyond event-type labels.
Effort: medium
File: `src/lib/AnalyticsPanel.svelte`

---

**B-36 — Empty and low-sample state guidance**
Priority: nice
Status: partial

Empty states and small-sample notices exist but offer no tips or guidance on what to do. Should feel informative, not just silent.
Effort: small
Files: `src/lib/AnalyticsPanel.svelte`, `src/lib/DigestPanel.svelte`, `src/lib/LivePanel.svelte`

---

**B-37 — Typography and spacing consistency**
Priority: nice
Status: open

Mixed font sizes (11px–46px) and padding values across components without a consistent system.
Effort: small–medium
Across: multiple component files

---

### P5 — Future

- CSV export
- Video timestamp integration

---

## Post-Match Analysis (A-series)

Full spec: [post-match-player-analysis.md](post-match-player-analysis.md)

Player identity note: jersey numbers are not used as cross-match identifiers in GAA because players wear different numbers each match. Analysis sessions use a squad roster ID when available, with a normalised-name fallback for legacy sessions. A squad roster (A-01) provides controlled autocomplete and a reconciliation path for mismatches.

---

### Phase 1 Bug Fixes (must resolve before any use)

**A-00 — Possession Analysis bug fixes**
Priority: must
Status: done (fixed in current working tree)

Five issues in the Codex build were fixed:

1. `sessionLabel` undefined in PossessionAnalysisPanel — crashes on multiple sessions per player
2. Player input `disabled` logic inverted in both panels — sessions cannot be started
3. Attacking direction normalisation absent — forward/backward classification is wrong when attacking toward lower y values; `our_goal_at_top` is stored but not used in `movementDirection` calculations
4. Analysis view hardcodes `flip={false}` — does not respect session orientation
5. Eyebrow labels read "Feature 1" / "Feature 2" — replace before real use

Files: `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/PassImpactPanel.svelte`, `src/lib/postMatchAnalysis.js`

---

### Phase 2 Hardening

**A-01 — Squad roster + identity model**
Priority: must
Status: done

Lightweight team-scoped roster. Feeds autocomplete in possession and pass panels and provides stable squad-player IDs for cross-match aggregation. The app persists this roster in the local analysis scope and syncs it to Supabase.
The Supabase roster table exists in `supabase/schema.sql` and `supabase/migrations/20260406000100_add_analysis_tables.sql`, with app-side sync/backfill already wired.

Supabase table: `squad_players (id, team_id, name, active, created_at, updated_at)` with per-team unique name index.

No jersey number field — numbers are match-specific and not used for player identity.

UI: squad management in Admin settings. Add player by name, rename, toggle active/inactive. Active players appear in analysis panel autocomplete.

Identity behavior:
- sessions store `squad_player_id` when selected from roster
- legacy/free-text sessions fall back to name matching and are flagged for reconciliation

---

**A-02 — Supabase sync for analysis sessions**
Priority: must
Status: done

Analysis data now syncs through the local-first retry queue pattern used by match events. The Supabase analysis tables exist in `supabase/schema.sql` and `supabase/migrations/20260406000100_add_analysis_tables.sql`, and the app reads/writes them for multi-device durability and recovery.

Four new tables required:
- `possession_sessions`
- `possession_events`
- `pass_sessions`
- `pass_events`

Full schema in [post-match-player-analysis.md](post-match-player-analysis.md). Session tables include `squad_player_id` (nullable) plus `player_name` for readability and legacy fallback.

Sync follows the same local-first, retry-queue pattern as match events. RLS must be team-scoped. Session upserts should be ordered: session before events (same FK guarantee as matches before events).

---

### Phase 2a — Cross-Match Player Profile

**A-03 — Cross-match query layer**
Priority: must
Status: done

Add `sessionsForPlayer(state, mode, playerKey, matchIds?)` to `postMatchAnalysisStore.js`. Returns all sessions for a player across all matches or a filtered subset. Include unit tests.

---

**A-04 — Cross-match player profile view (primary Phase 2 delivery)**
Priority: must
Status: done

Entry point: Possession tab → player selected → "View across matches" (shown when sessions span more than one match).

- Multi-select match filter (defaults to all; each match shows event count and date)
- Aggregated heat map across selected matches
- Aggregated summary strip (total events, outcome %, direction split, avg carry)
- Per-match breakdown table (match, date, events, fwd %, back %, top outcome)
- Drill-through row → single-match session view
- Sample-size caveat when fewer than 3 matches selected
- Unmatched player names flagged with a one-tap reconcile action (link to roster)

---

### Phase 2b — Trend Comparison

**A-05 — Chronological trend comparison**
Priority: should
Status: done

Builds on A-04. Requires minimum ~4 matches of data per player to be meaningful.

- Chronological split: first half vs second half of selected matches
- Last N matches selector (N = 3 or 5)
- Before/after heat map (side by side or toggled)
- Direction trend delta: forward % change between periods

No automated pattern detection. Visual comparison is sufficient.

---

### Phase 4

**A-06 — Combined possession and pass view**
Priority: nice
Status: deferred

Show Feature 1 and Feature 2 data together for one player in one view. Not required for any earlier phase.

---

## Possession Analysis Improvements (PA-series)

UX improvements, score involvement feature, and outcome taxonomy expansion for the Possession Analysis panel. Ordered to eliminate rework — see ordering rationale below.

Review outcome:
- Accepted: PA-01, PA-02, PA-03, PA-06, PA-07, PA-08, PA-09, PA-10, PA-11, PA-11a, PA-12, PA-13, PA-14, PA-15, PA-16, PA-18, PA-19, PA-T01, PA-T02, PA-T03
- Enhanced: PA-04, PA-05, PA-17
- Pushback: none

### Ordering rationale

- Schema additions (PA-01 half tag, PA-02 assist field) done in Sprint 1 alongside the flip bug fix — avoids touching session and event shapes across multiple PRs
- Outcome taxonomy (PA-09) done before the legend (PA-16) and before event editing (PA-17) — the legend must list the final outcomes; the edit UI must show the final outcome list from day one
- Assist visual distinction (PA-14) and pressure treatment (PA-12) done before the legend (PA-16) — legend documents both indicators once they are settled
- Score involvement metric (PA-11) done before the summary strip, filter, and cross-match surfaces — single computation point consumed in many places
- Event editing (PA-17) done after assist field and taxonomy are stable — the edit UI includes all three metadata fields without a second pass

Build order:
```
Sprint 1:  PA-01  PA-02  PA-03  PA-04  PA-05
Sprint 2:  PA-06  PA-07  PA-08  PA-09
Sprint 3:  PA-10
Sprint 4:  PA-11 → PA-11a  PA-12  PA-13  PA-14  PA-15
Sprint 5:  PA-16
Sprint 6:  PA-17
Sprint 7:  PA-18 → PA-19
Sprint 8:  PA-T01  PA-T02 → PA-T03
```

---

### Sprint 1 — Foundation

All schema additions and the P1 correctness bug. Done together to avoid touching session and event shapes across multiple PRs.

---

**PA-01 — Fix dead flip button during draft session**
Priority: must
Status: done
Depends on: none

The "switch ends" button in the active draft UI changes `draftOurGoalAtTop` (a local variable) but the pitch renderer uses `draftSession.our_goal_at_top`, which is frozen at session creation. The button currently does nothing during a live session — the analyst believes they have switched ends and continues logging with incorrect orientation.

Fix:
- Remove the flip button from the active draft session controls entirely
- Make orientation a pre-session configuration step, not an in-session one
- In the "Start session" form, make the orientation selector prominent: `Attacking direction for this session` with options `Our goal at top / Our goal at bottom`
- Add guidance note: "Create a separate session for each half if the attacking direction changes at half time"

Mid-session flip capability, if needed in future, requires per-event orientation storage and is a separate backlog item. Do not attempt to update `draftSession.our_goal_at_top` reactively — that would silently mis-classify all events logged before the flip.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-02 — Add half tag to session schema**
Priority: must
Status: done
Depends on: none

Add `half` field to the session shape. Value: `'first' | 'second' | 'et' | null`. Default: `null`.

Session shape addition:
```json
{ "half": "first" }
```

Backward compatibility: sessions without the field read as `half: null`. No migration needed. Field is set once at session creation alongside `our_goal_at_top`. Not editable post-finalise in this sprint (PA-17 covers that).

Files: `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/postMatchAnalysisStore.js`

---

**PA-03 — Add assist field to event schema**
Priority: must
Status: done
Depends on: none

Add `assist: false` (boolean, default false) to the possession event shape in `blankDraftEvent()` and any event factory in `postMatchAnalysis.js`.

Event shape addition:
```json
{ "assist": false }
```

Backward compatibility: events without the field read as `assist: false`. No migration needed. The field is only meaningful when `outcome` is a pass type or `'Foul won'`. All other outcomes store `assist: false` and the value is ignored in metric calculations.

Files: `src/lib/postMatchAnalysis.js`, `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-04 — Pass Destination tab rename**
Priority: should
Status: done
Depends on: none

Rename the "Pass Impact" tab to "Pass Destination" in `App.svelte`. Add a one-line descriptor beneath the tab header in `PassImpactPanel.svelte`: "Where do this player's passes travel to — and do they progress the ball?"

Removes the ambiguity identified in the UX review. No logic changes.

Review note: keep the rename, but shorten the descriptor a little if it crowds the tab header on smaller screens.

Files: `src/App.svelte`, `src/lib/PassImpactPanel.svelte`

---

**PA-05 — Sample size warning calibration**
Priority: must
Status: done
Depends on: none

Two issues:

1. Cross-match condition fires incorrectly. Current: `if (matchCount < 3 || totalEvents < 5)`. The `||` means 20 events across 1 match triggers the warning. Fix: change to `&&` so it fires only when both are true.

2. Single-match threshold too low. Five events is not meaningful in GAA. Raise to 8. Reword from "Small sample" to plain language.

Updated logic:
```js
if (analysisMode === 'cross') {
  if (matchCount < 3 && totalEvents < 15) {
    return `Only ${matchCount} match${matchCount === 1 ? '' : 'es'} selected with ${totalEvents} events — treat these patterns cautiously.`;
  }
} else {
  if (totalEvents < 8) {
    return `${totalEvents} events — patterns are forming. Treat direction splits cautiously.`;
  }
}
```

Review note: centralize these thresholds in a shared helper or constants block so the wording stays in step with the logic in both analysis modes.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

### Sprint 2 — Capture UX

Builds on Sprint 1 schema. All capture-time UI changes.

---

**PA-06 — Half selector in session start**
Priority: must
Status: done
Depends on: PA-02

When starting a new draft session, show a segmented control for half alongside the orientation selector:

```
Attacking direction:  [Our goal at top]  [Our goal at bottom]
Half:                 [First half]  [Second half]  [Extra time]
```

Half defaults to unselected (stores `null`). Not required — analyst can skip it. The half and orientation selectors together replace the standalone flip button removed in PA-01.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-07 — Half filter in session review**
Priority: must
Status: done
Depends on: PA-02, PA-06

Add half filter pills above the session selector in the analysis view:

```
[All halves]  [First half]  [Second half]  [Extra time]
```

When a half is selected, `displayedSessions` is filtered to sessions where `session.half === selectedHalf`. Sessions with `half: null` appear only under "All halves". If a player has no sessions in the selected half, show empty state: "No sessions logged for this half."

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-08 — Assist toggle in capture**
Priority: must
Status: done
Depends on: PA-03

Show an assist toggle in the capture form when the selected outcome is assist-eligible. Define eligible outcomes as a named constant (updated in PA-10 when taxonomy expands):

```js
const ASSIST_ELIGIBLE_OUTCOMES = new Set(['Passed / offloaded', 'Foul won']);
```

When outcome is eligible, render:
```
[✓] Assist — led directly to a score
```

Toggle is a checkbox, default unchecked. When the analyst changes outcome to a non-eligible type, `draftEvent.assist` resets to `false` silently.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-09 — Assist flag visible in draft event log**
Priority: must
Status: done
Depends on: PA-03, PA-08

In the numbered draft event log, append an "Assist" label to any event where `assist: true`:

```
3. Passed / offloaded — Forward · Under pressure · Assist
```

File: `src/lib/PossessionAnalysisPanel.svelte`

---

### Sprint 3 — Outcome taxonomy

Done after capture UX is stable so `ASSIST_ELIGIBLE_OUTCOMES` (added in PA-08) only needs one update after the final taxonomy is known.

---

**PA-10 — Expand OUTCOMES taxonomy**
Priority: should
Status: done
Depends on: PA-08

Replace the current 7-outcome flat list with an expanded taxonomy:

Scores (unchanged): Score point, Score goal

Shots (unchanged): Shot wide, Shot short / saved / blocked

Passes (split "Passed / offloaded"):
- Hand pass ← new
- Kick pass ← new

Possession lost (expand):
- Possession lost ← keep (unforced fumble)
- Fouled the ball ← new (foul conceded)
- Tackled / dispossessed ← new (lost to a tackle)

Set play (unchanged): Foul won

Backward compatibility: `'Passed / offloaded'` remains in `OUTCOME_COLORS` for rendering existing saved events but is removed from the `OUTCOMES` capture array. New captures must use Hand pass or Kick pass.

New colours:
```js
'Hand pass': '#2563eb',
'Kick pass': '#1d4ed8',
'Fouled the ball': '#7c3aed',
'Tackled / dispossessed': '#b91c1c',
```

Update `ASSIST_ELIGIBLE_OUTCOMES`:
```js
const ASSIST_ELIGIBLE_OUTCOMES = new Set([
  'Passed / offloaded', // legacy
  'Hand pass',
  'Kick pass',
  'Foul won',
]);
```

Files: `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/postMatchAnalysis.js`

---

### Sprint 4 — Analysis view

Metric computation first (PA-11), then all display surfaces. Done after taxonomy is final so legend and event editing inherit the finished set without rework.

---

**PA-11 — Score involvement metric in buildPossessionSummary**
Priority: must
Status: done
Depends on: PA-03

Extend `buildPossessionSummary` in `postMatchAnalysis.js`:

```js
{
  directScores: number,          // outcome === 'Score point' || 'Score goal'
  assistCount: number,           // assist === true
  scoreInvolvement: number,      // directScores + assistCount
  scoreInvolvementRate: number | null,  // involvement / total, null if total === 0
}
```

Rules:
- `assist: true` on a pass or foul outcome → 1 assist
- `assist: true` on a scoring outcome → not possible (mutually exclusive); if encountered, count only as directScore
- `assist: true` on any other outcome → excluded from assistCount with `console.warn`
- Legacy events without `assist` field → treated as `false`, no crash

File: `src/lib/postMatchAnalysis.js`

---

**PA-11a — Score involvement in summary strip**
Priority: must
Status: done
Depends on: PA-11

Add score involvement as the first metric in the summary strip (most coaching-relevant number).

Format:
```
Score involvement  14   (9 assists · 5 direct)
Score involvement  0
```

When only one type exists: `(all assists)` or `(all direct)`. Show the metric even when zero — a player with 20 possessions and 0 involvements is a meaningful finding.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-12 — Pressure indicator visual improvement**
Priority: should
Status: done
Depends on: none

The current `marker_ring: 'target'` is too subtle on dense sessions or small screens.

Replace with a high-contrast outer ring: white fill with red stroke (`rgba(220, 38, 38, 0.9)`) at 2px width, radius 1.4× the dot radius. Distinct from the assist gold fill (PA-14) and visible against all outcome colours.

Also add a filter toggle: **"Under pressure only"** — reduces `displayedEvents` to `under_pressure === true`. Group with the score involvement filter (PA-13) under a "Show only:" row above the pitch.

Files: `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/Pitch.svelte` (if ring styling is in the renderer)

---

**PA-13 — Score involvement filter**
Priority: should
Status: done
Depends on: PA-11

Add filter toggle: **"Score involvements only"**. When active, `displayedEvents` reduces to events where outcome is a score type OR `assist === true`.

Group with the pressure filter (PA-12) under "Show only:" above the pitch.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-14 — Assist visual distinction in dot view**
Priority: must
Status: done
Depends on: PA-03

Events with `assist: true` use gold fill (`#f59e0b`) in dot view regardless of outcome colour. A player with 20 possessions and 9 gold dots communicates their scoring contribution before the analyst reads a number.

An event can be both assist and under pressure — gold fill and pressure ring (PA-12) apply together without conflict. No change to heat map mode (density is the signal there, not outcome identity).

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-15 — Carry line toggle**
Priority: nice
Status: done
Depends on: none

In the dot view controls, add toggle: **"Show carry lines"** (default on). When off, `dotConnections` is suppressed. Useful for high-possession sessions where overlapping arrows obscure the receive point distribution.

Toggle is session-local, not persisted to localStorage.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

### Sprint 5 — Legend

Done after taxonomy (PA-10), pressure treatment (PA-12), and assist visual (PA-14) are all settled. Building the legend before those would require updating it again.

---

**PA-16 — Outcome, assist, and pressure legend**
Priority: must
Status: done
Depends on: PA-10, PA-12, PA-14

Add a collapsible legend below the pitch in dot view. Collapsed by default; state persists to localStorage so the analyst only opens it once.

Sections:

Outcomes — colour swatch + label for each entry in `OUTCOME_COLORS`, grouped:
- Scores: point, goal
- Shots: wide, short/saved/blocked
- Passes: hand pass, kick pass, passed/offloaded (legacy — label as such)
- Possession lost: lost, fouled, tackled
- Set play: foul won

Special markers:
- Gold dot: Assist — led directly to a score
- Red ring: Under pressure

Carry arrows (hide when carry lines toggled off via PA-15):
- Green: Forward carry
- Amber: Lateral carry
- Red: Backward carry

Hidden entirely in heat map mode.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

### Sprint 6 — Event editing

Done after taxonomy and assist field are stable so the edit UI ships with all three metadata fields and never needs a second pass.

---

**PA-17 — Metadata edit on finalised events**
Priority: should
Status: done
Depends on: PA-03, PA-08, PA-10

Allow the analyst to correct the metadata of a finalised event without re-logging the full session. Coordinate editing is out of scope — delete and re-log if the location is wrong. This covers 80% of correction cases (wrong outcome, missed pressure flag, missed assist flag).

Entry point: tap a dot in the analysis view dot view → event detail popover.

Popover contents:
- Outcome selector (full OUTCOMES list from PA-10)
- Under pressure toggle
- Assist toggle (shown only when outcome is assist-eligible, same rules as PA-08)
- Receive and release coordinates (read-only, for reference)
- "Save changes" and "Cancel"

On save: event updated in local state and localStorage. Supabase sync queue picks up the session-level upsert. Summary strip and dot view re-render immediately.

Review note: treat the popover as a small local edit draft so Cancel can discard changes cleanly without mutating selection state.

Constraints:
- Outcome cannot be cleared — always require a valid value before saving
- If outcome changes to a non-assist-eligible type, `assist` resets to `false` before saving
- `selectedEventId` state variable already exists — wire it to this popover

Files: `src/lib/PossessionAnalysisPanel.svelte`, `src/lib/postMatchAnalysisStore.js`

---

### Sprint 7 — Cross-match

---

**PA-18 — Score involvement in cross-match aggregate**
Priority: must
Status: done
Depends on: PA-11

Cross-match summary strip addition:
```
Score involvement: 34  (22 assists · 12 direct)  39% rate
```

Per-match breakdown table — add "Involvement" column:

| Match | Date | Events | Fwd % | Involvement |
|---|---|---|---|---|
| Clontarf v Kilmacud | May 10 | 18 | 56% | 7 (39%) |
| Clontarf v Ballymun | May 17 | 22 | 61% | 11 (50%) |

Involvement rate per match = involvement / event count for that match.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

**PA-19 — Score involvement in trend comparison**
Priority: should
Status: done
Depends on: PA-18

In the trend view, add involvement rate as a trend metric:

```
Score involvement rate:   38% → 52%   (+14pp)  ▲
```

Use existing directional colouring (green positive, red negative, grey flat). Threshold for meaningful change: ±5pp. Changes below that show as grey regardless of direction.

File: `src/lib/PossessionAnalysisPanel.svelte`

---

### Sprint 8 — Tests

---

**PA-T01 — Unit tests: score involvement calculation**
Priority: must
Status: done
Depends on: PA-11

Add to `postMatchAnalysis.test.js`:
- Zero events → `scoreInvolvement: 0`, `scoreInvolvementRate: null`
- All direct scores, no assists → involvement = directScores, assistCount = 0
- All assists, no direct scores → involvement = assistCount, directScores = 0
- Mixed → correct sum, no double-counting
- `assist: true` on ineligible outcome → excluded from assistCount
- Legacy events without `assist` field → treated as false, no crash
- `scoreInvolvementRate` = involvement / total, null when total = 0

File: `src/lib/postMatchAnalysis.test.js`

---

**PA-T02 — Unit tests: backward compatibility**
Priority: must
Status: done
Depends on: PA-T01, PA-10

Confirm that sessions and events stored before any PA-series change produce identical output from `buildPossessionSummary`. Use existing fixture data. No regressions from schema additions or taxonomy expansion.

File: `src/lib/postMatchAnalysis.test.js`

---

**PA-T03 — E2E: capture → finalise → involvement metric**
Priority: should
Status: done
Depends on: PA-08, PA-11a

- Start session → log event: Kick pass, assist checked → add → finalise
- Assert: summary strip shows `Score involvement: 1 (1 assist · 0 direct)`
- Start second session same player → log: Score point → finalise
- Assert (all sessions): `Score involvement: 2 (1 assist · 1 direct)`, rate = 50%

File: `tests/e2e/possession-analysis.spec.js`
