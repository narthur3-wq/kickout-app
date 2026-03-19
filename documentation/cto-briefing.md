# Páirc — CTO Briefing

**GAA Match Analysis Platform**
**March 2026 · Confidential**

---

## Executive Summary

Páirc is a live match analysis tool built for GAA teams. An analyst uses it pitchside to record every significant match event — kickouts, shots, turnovers — by tapping a pitch diagram on a phone. The app derives statistics in real time and produces a shareable post-match digest.

The product solves a real operational problem: GAA teams at club and intercounty level want data-driven analysis but can't afford the infrastructure or personnel costs of professional sports analytics platforms. Páirc requires one person, one phone, and no specialist training.

**Current state:** functional MVP, in active use. Built by one developer. Ready for a second-stage technical decision: whether to scale it, productise it, or keep it as a club-internal tool.

---

## The Problem

GAA teams analyse matches retrospectively through video review — slow, expensive in analyst time, and not available during the game. Kickout strategy in particular has become a major tactical lever since the 2021 rule change, but clubs lack any structured way to track:

- Which zones retain possession under different kickout strategies
- Which players are being targeted — and how often they win their ball
- How an opponent tends to use their own kickouts
- How retention changes across the match (early vs. late, H1 vs. H2)

The alternative — spreadsheets and manual video tagging — takes 2–3 hours per match and produces data too late to influence the next game preparation.

---

## The Solution

Páirc reduces per-event capture to a 3-second tap sequence. For each event:

1. Analyst selects type, direction, and outcome from large touch targets
2. Taps the pitch to pinpoint the location
3. Taps Save

The app computes all analytics instantly. No spreadsheet, no video scrubbing, no post-processing.

**Key capabilities:**
- Kickout retention by zone, player, period, restart type, and clock window
- Opposition kickout tendency grid (where they kick and our win rate per zone)
- Derived match score (no manual entry — inferred from shot events)
- Shareable match digest image (one tap, shares via native mobile share sheet)
- Full offline operation with automatic background sync

---

## Technical Overview

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Svelte 4, Vite 7 | ~1,400 lines of application code across 6 components |
| Hosting | Vercel | CDN-deployed, instant rollout |
| Database | Supabase (Postgres) | Managed, no ops overhead |
| Auth | Supabase Auth | Email/password |
| Offline | localStorage + sync queue | Events persist on-device first, sync when online |
| PWA | Web App Manifest | Installable on iOS and Android from browser |
| Sharing | Web Share API + html2canvas | Native share sheet on mobile |

### Why these choices?

**Svelte** — minimal bundle, no virtual DOM overhead, runs well on mid-range Android phones with limited CPU. No framework server-side rendering complexity needed for a primarily single-user interactive tool.

**Supabase** — managed Postgres with a usable free tier. Handles auth, realtime, and row-level security out of the box. Avoids the operational overhead of running a backend.

**Offline-first** — matches are played at pitches with poor 4G coverage. The app is unusable without this guarantee.

**No native app** — web PWA avoids App Store review delays, works cross-platform, and can be deployed in minutes. For a club tool, install friction via App Store is a barrier.

---

## Data Architecture

Every event is a JSON object stored in localStorage and synced to a Postgres `events` table. The schema is flat and simple — no relational joins needed for analytics because all relevant data is denormalised onto the event record (team, match date, period, location, outcome).

Coordinates use a normalised system: `y=0` always equals the capturing team's own goal end, regardless of which physical end they defend. This means home and away match data overlays correctly without any post-processing.

Estimated storage: ~2KB per event. A typical match produces 40–80 events. At 30 matches per season, one team generates ~6MB/year — trivially small.

---

## Current Limitations

| Limitation | Impact | Effort to fix |
|---|---|---|
| No row-level security | All signed-in users see all data — not a problem for single-club use, blocker for multi-tenant | 1–2 days |
| Single-analyst model | Can't have two analysts capturing concurrently for the same match | Requires conflict resolution logic — medium |
| No video link | Can't attach a timestamp to a clip | Requires video player integration — high |
| No CSV export | Power users want data in Excel | 1 day |
| No team management | No concept of squad, roles, or permissions | Medium — depends on Supabase Auth groups |

---

## What Would "Scale" Look Like?

If this were to be offered to multiple clubs or a county board, the priority changes are:

1. **Row-level security** — per-user data isolation in Supabase (SQL policy, ~1 day of work)
2. **Team model** — a `teams` table, users belonging to teams, events scoped to a team
3. **Subscription / access control** — could integrate Stripe with Supabase Auth metadata
4. **Coach view** — a separate read-only dashboard for management who don't capture events
5. **Season analytics** — cross-match trends, opponent scouting reports across multiple games

The existing architecture supports all of this without a rewrite. The data model is already match-keyed and team-keyed; adding a team foreign key and RLS policies is the main structural change.

---

## Cost to Operate

| Resource | Current cost |
|---|---|
| Vercel (hobby) | Free |
| Supabase (free tier) | Free — supports up to 50,000 rows and 500MB |
| Domain | ~€12/year if desired |
| Developer time | 1 person, part-time |

At 10 clubs with 80 matches/season each: ~64,000 events/year total. Still within Supabase free tier. Supabase Pro ($25/month) comfortably handles 100+ clubs.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase outage | Low | Offline-first — app continues working; events sync when back online |
| localStorage data loss (cleared cache) | Low–Medium | Sync to Supabase provides backup; Export JSON available |
| Coordinate data quality | Medium | Validation on pitch bounds; normalisation logic tested |
| Single dev bus factor | High | Codebase is small (~1,400 lines); well-commented; Svelte is mainstream |

---

## Recommendation

For a single club, the app is production-ready as-is. The missing piece for broader rollout is row-level security (a 1–2 day engineering task) and a team model.

If the goal is to offer this commercially to multiple clubs, the highest-value next steps in order are:

1. RLS + team model
2. CSV export
3. Season analytics (cross-match trends)
4. Video timestamp integration

The foundation is solid. The risk of a rewrite at any of these stages is low — the architecture naturally accommodates them.

---

*Prepared by the Páirc development team · March 2026*
