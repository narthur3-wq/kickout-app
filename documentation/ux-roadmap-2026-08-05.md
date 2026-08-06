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
| 1.2 | ~~**Global focus-visible style.**~~ **Done 2026-08-06.** One rule in `app.css` covering every interactive element, with an inverted variant for the dark surfaces, plus all nine `outline: none` declarations removed. Original text: **Global focus-visible style.** One rule in `app.css` covering all interactive elements, plus removal of the `outline: none` declarations that substitute nothing. Currently `:focus-visible` exists in only 2 of 15 components. | `src/app.css`, 8 sites | S |
| 1.3 | ~~**TEAM vs OUTCOME disambiguation.**~~ **Done 2026-08-06.** Rows now read "Kickout by" / "Won by" (and "Shot by" / "Turnover by"), and the outcome options are in a fixed order so they no longer swap places when the kicking team changes. Team names kept: "Retained" was ambiguous about whom — the kicking team, or our club. Original text: **TEAM vs OUTCOME disambiguation.** Two identically-styled `[Clontarf|Vincents]` controls 200 px apart meaning different things. Relabel the outcome row to carry a verb ("Won by Clontarf" / "Retained" / "Lost"). This is the one UX defect that silently corrupts data, so it ranks above cosmetics. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | M |
| 1.4 | ~~**Touch targets to 44 px.**~~ **Partly done 2026-08-06.** 44px on phones, iPad portrait and desktop. Deliberately NOT on iPad landscape: measured there, 44px reintroduced 74px of scrolling on a kickout, and scrolling mid-match was the original complaint. Those stay 68x32 / 87x37, which clears the 24x24 WCAG minimum. Original text: **Touch targets to 44 px.** `.jersey-btn` 68×32 → 44 min-height; `.seg-btn` 87×37 → 44. Note this makes the capture form taller, so land it *after* 0.1 or the two changes fight each other. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | S |
| 1.5 | ~~**Remove the redundant `ON` pill**~~ **Reconsidered 2026-08-06 — kept, contrast fixed instead.** It was added deliberately so touch users see a selection register, with an E2E test asserting it. The real defect was its own contrast: white on a 20% white wash over the button colour, ~2.9:1. Darkened the wash. Original text: **Remove the redundant `ON` pill** from the selected outcome button — the selected state already says it, and it renders white-on-white at the button edge. | [CaptureForm.svelte](src/lib/CaptureForm.svelte) | S |

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

## Second review pass — 2026-08-05 (after Phases 0–1)

Re-reviewed by driving flows rather than only screenshotting screens, which is
how the broken password reset went unnoticed the first time.

**Fixed immediately (small):**

- Match picker did not move focus into itself despite `aria-modal="true"`, and
  Escape did not close it. The shell wraps the dialog in a
  `on:keydown|stopPropagation` div, so the existing window-level handler could
  never fire — it is now handled on the dialog itself.
- Login fields were not inside a `<form>`, so password managers would not
  reliably offer to save or autofill. Matters here because passwords are
  admin-assigned rather than user-chosen.
- Possession Analysis rendered the match date twice.
- Contrast, ahead of the token work because each was a one-line change on a
  high-traffic control: top-level nav `#b0b8c4` **2.0:1** → `#6b7280`; selected
  capture option white-on-`#0a5` **3.05:1** → `#0b8043` (5.0:1); "Other #"
  label **2.5:1**; inactive segmented labels **4.39:1**.
- The two remaining unlabelled inputs (custom jersey number, match clock).

**Checked and found healthy:** save-without-a-match is blocked with a clear
message, single-row delete does confirm, no console errors on any tab, no
horizontal overflow at any width, weak/mismatched passwords are rejected
clearly, and the demo button is a 46px target.

**Correction to the first review:** the Live panel's "N of the last M points"
line was flagged as disagreeing with its chip count. It does not — a goal is
three points, so the chips count *scores* and the sentence counts *points*.
That is correct GAA scoring. The only residual issue is that the two use
different units without saying so, which is minor.

## Phase 3 — Accessibility

Cheap once Phase 2 is in, because the contrast fixes become token edits.

| # | Item | Detail | Effort |
|---|---|---|---|
| 3.1 | ~~**Contrast to AA.**~~ **Mostly done.** All light-background failures fixed (nav, selected capture option, recent-events data, "Other #", inactive segmented labels). **Done 2026-08-06** — the dark header's `Phase:` label and inactive period pills went from `rgba(255,255,255,0.38)` (~3.4:1) to `0.62`. No known text contrast failures remain. | | S |
| 3.2 | ~~**Document structure.**~~ **Done 2026-08-06.** `<main>` landmark added, and section labels promoted from `div` to `h2` across Live, Digest, Possession, Pass and the analytics panels. Original text: **Document structure.** Add `<main>`, and promote panel titles ("Live Match State", "Kickouts", "Possession Analysis") from `div` to `h2`/`h3`. Currently the app exposes exactly one heading and no main landmark. | | M |
| 3.3 | ~~**Tab semantics.**~~ **Done 2026-08-06.** `role=tablist/tab`, `aria-selected`, and arrow/Home/End movement on all three nav levels. Done in full deliberately: announcing a control as a tab without arrow-key movement promises behaviour that is not there, which is worse than a plain button. Cost ~30 test locators, since the accessible role genuinely changed from button to tab. Original text: **Tab semantics.** `role="tablist"` / `role="tab"` / `aria-selected` / arrow-key navigation on all three nav levels. Currently zero tab roles. | | M |
| 3.4 | **Label the 2 unlabelled inputs.** | | S |
| 3.5 | ~~**`prefers-reduced-motion` block**~~ **Done 2026-08-06** in `app.css`. Original text: **`prefers-reduced-motion` block** — the app runs an infinite `timerPulse` and a `pitchFlash` error animation with no opt-out. | | S |
| 3.6 | ~~**Extend `accessibility.spec.js`**~~ **Done 2026-08-06.** Three new cases: main landmark plus heading outline, tab selected-state and arrow-key movement, and an assertion that the global focus rule exists with zero `outline: none` suppressions anywhere. Original text: **Extend `accessibility.spec.js`** to assert landmarks, heading order, tab roles and focus visibility, so 3.1–3.5 cannot regress. | | M |

---

## Phase 4 — Pitch and data visualisation

The analytics screens are the product's differentiator; this is where polish pays back most.

| # | Item | Effort |
|---|---|---|
| 4.1 | ~~**Pitch sizing.**~~ **Done 2026-08-05.** Was capped at `35svh`; now budgeted against the space actually left, with the legend moved beside the pitch above 1100px. 508x315 -> 677x420 at 1512x900. Original text: **Pitch sizing.** Currently ~670–850 px wide inside a ~1930 px card on desktop/tablet, leaving the outer thirds empty; overflows its card on phone for Kickouts/Shots but not Turnovers. Make the pitch scale to its container with a sensible max, consistently across all three tabs. | M |
| 4.2 | ~~**Remove the two-tone green letterbox**~~ **Resolved by 4.1** — the capture SVG now fills the card width (measured horizontal gap 0). Original text: **Remove the two-tone green letterbox** around the capture pitch — the `#3d7642` card behind a centred SVG reads as a rendering artifact. | S |
| 4.3 | ~~**Coincident marker handling.**~~ **Done 2026-08-05.** Markers sharing a spot now fan into a ring whose radius scales with how many share it. Shots 26 markers / 8 visible -> 26 / 26; kickouts 24 / 8 -> 24 / 24. Opt-in, so possession and pass paths still meet their markers. Original text: **Coincident marker handling.** "11 events" currently renders as 2 dots. Add count badges, jitter, or opacity accumulation — repeat kickouts to the same zone are the pattern analysts are actually hunting for. | M |
| 4.4 | ~~**Shot outcome palette.**~~ **Done 2026-08-05.** The real defect was turf contrast (1.01-1.53:1), not just hue. Now 2.0-3.7:1, with goal/point hue gap 33 -> 56 degrees and the goal-attempt ring dashed so it is distinguishable from every marker's outline. Original text: **Shot outcome palette.** Goal-vs-Point is carried by green-vs-teal at 12 px; Wide-vs-Blocked by amber-vs-orange. Re-space the hues, and fix the "ring = goal attempt" encoding, which is currently unreadable because every dot has a white ring as its base style. | M |
| 4.5 | ~~**Live panel colour-only encoding.**~~ **Done 2026-08-05.** Score chips now carry team by shape (circle = ours, square = theirs, matching the pitch grammar) plus an aria-label naming team, score type and clock. Original text: **Live panel colour-only encoding.** Recent-scores chips are red/green `P`/`G` with no legend and no second differentiator. Also the chip count (8) disagrees with the caption ("last 10 points"). | S |

---

## Phase 5 — Information architecture

Larger conceptual changes; safe to run during beta.

| # | Item | Effort |
|---|---|---|
| 5.1 | **Resolve the two period controls.** Header `Phase:` (a filter) vs form `PERIOD` (an event attribute) — same values, same visual family, opposite meanings. Resolving this should also remove the permanent "Showing all periods in this view." banner, which exists to apologise for the ambiguity. | M |
| 5.2 | **Unify the filter affordances.** `Clear` / `Reset` / `Filters · 1 ▼` are three overlapping controls for one filter state; `FILTERED: 1 match` reads as a result count. | M |
| 5.3 | **Events table on mobile** — move Edit/Delete out of the first column so identifying data (date, period, clock) is what you see first, and de-emphasise Delete relative to Edit. Fix the `Delete all` toolbar overflowing its scroll container. | M |
| 5.4 | ~~**Possession Analysis grouping**~~ **Partly done 2026-08-06.** "Show paths" moved out of "Show only:" into its own Display row and renamed "Carry paths" — it is a display toggle, not a filter. Duplicated half selectors and the repeated date still open. Original text: **Possession Analysis grouping** — move "Show paths" out of `SHOW ONLY:` (it is a display toggle, not a filter); resolve the duplicated half selectors; drop the repeated date in the header. | S |
| 5.5 | **Consolidate the two segmented-control styles** (square in analytics, pill in Possession Analysis) onto the Phase 2 tokens. | S |

---

## Phase 5b — Auth and account surfaces (new)

The first review treated Login as a screen to look at rather than a flow to
drive, and missed that password reset was broken end to end. These are the
remaining gaps in that area, none of them blocking.

| # | Item | Effort |
|---|---|---|
| 5b.1 | **No signed-in way to change your password.** The only route is "forget it and email yourself a link". For admin-assigned passwords that is the common case, not the edge case. | M |
| 5b.2 | **Reset depends on unverifiable Supabase config** — the app origin must be in Auth → Redirect URLs and SMTP must be real, or `resetPasswordForEmail` silently redirects to the Site URL. Worth a documented preflight in the release checklist. | S |
| 5b.3 | **No focus trap in modals.** Focus now moves *into* the match picker, but Tab can still walk out to the page behind it. Same for the admin and confirm dialogs. | M |
| 5b.4 | **Sign-out has no confirmation** and unsynced events are queued per-scope; signing out with a pending queue is silent. | S |

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
