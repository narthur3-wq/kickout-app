# Pairc — Product Backlog

Last updated: 2026-03-30

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
- Squad / player registry
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
- Season / cross-match analytics
- Video timestamp integration
