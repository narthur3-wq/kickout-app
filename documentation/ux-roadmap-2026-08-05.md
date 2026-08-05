# Pairc — UX / UI Fix Roadmap

**Source:** [ux-review-2026-08-05.md](ux-review-2026-08-05.md)
**Date:** 2026-08-05

Sequenced so that each phase unblocks the next. The ordering is not by severity alone — the token work in Phase 2 is deliberately placed before the contrast and polish fixes, because doing it in the other order means making the same edit a hundred times.

Effort labels: **S** ≈ under an hour, **M** ≈ half a day, **L** ≈ 1–2 days.

---

## Phase 0 — Launch blockers ✅ DONE (2026-08-05)

All three landed. Measured after, at 390×844: header 120px → **50px** with no
overlap, pitch 0px → **232px**, Save Event in view, no horizontal scroll. Six
portrait-phone E2E tests added at 360×740 and 390×844.

Two things came out of the work that were not in the original plan:

- **1.1 (sticky Save bar) is also done.** The bar is now sticky in *every*
  layout, not just ≥768px, because the phone form scrolls internally and
  hunting for the save button mid-match is the wrong ask.
- **The recent events strip was a contributing factor**, not just a polish
  item — at a flat 202px it was 24% of a phone viewport. Now 116px expanded,
  30px collapsed, and collapsed by default on phones.

Nothing ships until these are done. All three are layout defects on the app's primary device.

| # | Item | Ref | Effort |
|---|---|---|---|
| 0.1 | **Phone capture layout.** `.form-panel` is `flex-shrink: 0` with no height cap below 768 px, so it takes 811 px and collapses `.pitch-panel` to zero. Change to `flex: 1 1 auto; min-height: 0` in the column layout and give `.pitch-panel` a floor (`min-height: 45vh`). Verify the pitch has non-zero height and `Save Event` is in view at 390×844. | [App.svelte:3877-3890](src/App.svelte#L3877-L3890) | M |
| 0.2 | **Portrait-phone layout test.** `layout.spec.js` is pinned to 1366×768, which is why 0.1 survived. Add a 390×844 describe block asserting: pitch SVG height > 0, `Save Event` fully within viewport, header height ≤ 64 px. This is the regression guard for the whole phase. | [layout.spec.js:26](tests/e2e/layout.spec.js#L26) | S |
| 0.3 | **Phone header collision.** Match name renders on top of the crest and wordmark; score wraps to four lines; header doubles to 120 px. Below 640 px, drop the match context and score from the header — both already appear in the match context bar and Live panel. Add `min-width: 0` to `.header-center` and `white-space: nowrap` to `.match-score` for the widths where they are kept. | [App.svelte:3480](src/App.svelte#L3480), [3586](src/App.svelte#L3586) | S |

**Exit criteria:** an analyst can create a match, tap the pitch, and save an event on a 390 px phone in portrait, with the new tests green.

---

## Phase 1 — Correctness and access

Fast, high-value, low-risk. Mostly one-line or one-rule changes.

| # | Item | Ref | Effort |
|---|---|---|---|
| 1.1 | ~~**Sticky Save bar overlap.**~~ **Done in Phase 0.** The action row is now sticky in all layouts. It still overlays scrolling content at rest, but it is the last child, so at full scroll nothing is hidden — the fields are reachable. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | — |
| 1.2 | **Global focus-visible style.** One rule in `app.css` covering all interactive elements, plus removal of the `outline: none` declarations that substitute nothing. Currently `:focus-visible` exists in only 2 of 15 components. | `src/app.css`, 8 sites | S |
| 1.3 | **TEAM vs OUTCOME disambiguation.** Two identically-styled `[Clontarf|Vincents]` controls 200 px apart meaning different things. Relabel the outcome row to carry a verb ("Won by Clontarf" / "Retained" / "Lost"). This is the one UX defect that silently corrupts data, so it ranks above cosmetics. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | M |
| 1.4 | **Touch targets to 44 px.** `.jersey-btn` 68×32 → 44 min-height; `.seg-btn` 87×37 → 44. Note this makes the capture form taller, so land it *after* 0.1 or the two changes fight each other. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | S |
| 1.5 | **Remove the redundant `ON` pill** from the selected outcome button — the selected state already says it, and it renders white-on-white at the button edge. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | S |

---

## Phase 2 — Design tokens

The unlock for everything after it. Do not skip ahead to Phase 3.

| # | Item | Effort |
|---|---|---|
| 2.1 | **Define `:root` tokens in `app.css`:** ~10 colour roles (surface, ink, ink-muted, primary, primary-ink, success, danger, warning, border, pitch), 4 radii, 5 type sizes, 3 elevations. | M |
| 2.2 | **Migrate `App.svelte` + `src/lib/*.svelte`** off hard-coded hex. Current state: 144 distinct hex values, 14 distinct `border-radius` values, 6 blues and 8 greens competing for the same semantic roles. Fold `TacticalBoard.svelte`'s private `--tb-*` set into the global one. | L |
| 2.3 | **Resolve the three primary-button colours** to one token: Login/Capture `#1c3f8a`, Match picker `#0f1923`, Digest `#1d4ed8`. | S |

**Exit criteria:** no raw hex outside `:root`; one primary, one danger, one success.

---

## Phase 3 — Accessibility

Cheap once Phase 2 is in, because the contrast fixes become token edits.

| # | Item | Detail | Effort |
|---|---|---|---|
| 3.1 | **Contrast to AA.** `.seg-btn.active` 3.05:1 (selected capture option — the most-tapped control, and it has to read in bright outdoor light); `.section-btn`/`.tab-btn` 2.00:1 (top-level nav is barely visible); `.re-hint` 1.41:1; `.re-period`/`.re-clock`/`.re-muted` 2.43:1 (this is match *data*, not chrome); `.jersey-custom-label` 2.54:1; header period pills ~3.4:1. | 7 token edits after 2.2 | S |
| 3.2 | **Document structure.** Add `<main>`, and promote panel titles ("Live Match State", "Kickouts", "Possession Analysis") from `div` to `h2`/`h3`. Currently the app exposes exactly one heading and no main landmark. | | M |
| 3.3 | **Tab semantics.** `role="tablist"` / `role="tab"` / `aria-selected` / arrow-key navigation on all three nav levels. Currently zero tab roles. | | M |
| 3.4 | **Label the 2 unlabelled inputs.** | | S |
| 3.5 | **`prefers-reduced-motion` block** — the app runs an infinite `timerPulse` and a `pitchFlash` error animation with no opt-out. | | S |
| 3.6 | **Extend `accessibility.spec.js`** to assert landmarks, heading order, tab roles and focus visibility, so 3.1–3.5 cannot regress. | | M |

---

## Phase 4 — Pitch and data visualisation

The analytics screens are the product's differentiator; this is where polish pays back most.

| # | Item | Effort |
|---|---|---|
| 4.1 | **Pitch sizing.** Currently ~670–850 px wide inside a ~1930 px card on desktop/tablet, leaving the outer thirds empty; overflows its card on phone for Kickouts/Shots but not Turnovers. Make the pitch scale to its container with a sensible max, consistently across all three tabs. | M |
| 4.2 | **Remove the two-tone green letterbox** around the capture pitch — the `#3d7642` card behind a centred SVG reads as a rendering artifact. | S |
| 4.3 | **Coincident marker handling.** "11 events" currently renders as 2 dots. Add count badges, jitter, or opacity accumulation — repeat kickouts to the same zone are the pattern analysts are actually hunting for. | M |
| 4.4 | **Shot outcome palette.** Goal-vs-Point is carried by green-vs-teal at 12 px; Wide-vs-Blocked by amber-vs-orange. Re-space the hues, and fix the "ring = goal attempt" encoding, which is currently unreadable because every dot has a white ring as its base style. | M |
| 4.5 | **Live panel colour-only encoding.** Recent-scores chips are red/green `P`/`G` with no legend and no second differentiator. Also the chip count (8) disagrees with the caption ("last 10 points"). | S |

---

## Phase 5 — Information architecture

Larger conceptual changes; safe to run during beta.

| # | Item | Effort |
|---|---|---|
| 5.1 | **Resolve the two period controls.** Header `Phase:` (a filter) vs form `PERIOD` (an event attribute) — same values, same visual family, opposite meanings. Resolving this should also remove the permanent "Showing all periods in this view." banner, which exists to apologise for the ambiguity. | M |
| 5.2 | **Unify the filter affordances.** `Clear` / `Reset` / `Filters · 1 ▼` are three overlapping controls for one filter state; `FILTERED: 1 match` reads as a result count. | M |
| 5.3 | **Events table on mobile** — move Edit/Delete out of the first column so identifying data (date, period, clock) is what you see first, and de-emphasise Delete relative to Edit. Fix the `Delete all` toolbar overflowing its scroll container. | M |
| 5.4 | **Possession Analysis grouping** — move "Show paths" out of `SHOW ONLY:` (it is a display toggle, not a filter); resolve the duplicated half selectors; drop the repeated date in the header. | S |
| 5.5 | **Consolidate the two segmented-control styles** (square in analytics, pill in Possession Analysis) onto the Phase 2 tokens. | S |

---

## Phase 6 — Post-launch

| # | Item | Effort |
|---|---|---|
| 6.1 | Dark mode via `prefers-color-scheme`. The header, Live panel and Tactical Board are already dark, and the app gets used under floodlights — this is closer than it looks. | L |
| 6.2 | "Keep awake" state indicator — currently the only signal is the label changing to "Awake"; also make it an icon on phone, where it eats ~110 px of header. | S |
| 6.3 | Tactical Board disabled-state contrast, and a team legend (teams are distinguished by colour alone, with both using 1–15 numbering). | S |
| 6.4 | Possession Analysis first-run — the screen currently opens as a wall of six disabled controls. | S |
| 6.5 | Align Live and Digest score presentation (side-by-side vs stacked for the same data). | S |

---

## Dependency notes

- **0.1 before 1.4.** Raising touch targets makes the capture form taller; doing it before the layout fix makes the phone problem worse.
- **2.x before 3.1.** Contrast fixes are 7 token edits after the migration, or ~100 scattered edits before it.
- **0.2 before everything.** The portrait test is what stops Phase 1 and 4 reintroducing the blocker.
- **Demo access depends on Phase 0.** See below.

---

## Interaction with demo access

**Resolved.** Phase 0 landed on 2026-08-05, so the demo (see
[demo-access.md](demo-access.md)) now opens on a working capture screen at
phone widths. The link is safe to share once the demo account is seeded.

## Note on the E2E suite

19 tests were failing on `main` before this work, which is why the phone
regression went unnoticed for so long. The cause is **stale test selectors, not
broken app behaviour**:

1. Navigation became two-level, so analytics sub-tabs only exist after opening
   the In-game section. Older tests clicked them straight from Capture.
2. The Live panel later gained deep-analysis shortcuts with the same labels as
   the nav tabs, so unscoped `getByRole('button', { name: /^Kickouts/i })`
   lookups now hit two elements and fail Playwright strict mode.

`layout.spec.js` is fixed and fully green. The same two fixes almost certainly
apply to the remaining failures in `capture-flow`, `import-export`,
`match-summary` and `possession-analysis`.
