# Páirc — User Guide

**GAA Match Analyst · Live Event Capture**

---

## What is Páirc?

Páirc is a phone-friendly app for capturing and analysing GAA match events in real time. During a match you tap a pitch diagram to record where kickouts land, where shots come from, and where turnovers happen. The app instantly shows you retention rates, player targeting patterns, zone tendencies, and a shareable post-match digest — all without needing a spreadsheet.

---

## Getting Started

### First-time setup

1. Open the app in your browser (works on iPhone, Android, desktop).
2. Tap **Add to Home Screen** from your browser menu for the best experience (full-screen, no address bar).
3. Sign in if prompted. If Supabase is configured for your deployment, an account is required to access the app.
4. In the **Capture** tab, open **Match Setup** and enter:
   - **Our Team** name
   - **Opponent** name
   - **Date** (defaults to today)
   - **Our goal end** — which end of the pitch does your team defend in H1? Tap ⬆ Top or ⬇ Bottom.

> **Tip:** Match setup is saved between sessions. You only need to change it when the opponent or date changes.

---

## Recording Events

### The Capture tab

The screen is split into two panels:
- **Left/top:** the event form (type, outcome, player, etc.)
- **Right/bottom:** the pitch diagram — tap here to place the event

### Step-by-step for a kickout

1. **Type** — select `Kickout`
2. **Direction** — `Ours` (your team kicks out) or `Theirs` (opponent kicks out)
3. **Period** — `H1`, `H2`, or `ET` (matches the current period of the game)
4. **Contest** — how the ball was contested:
   - `Clean` — one team catches cleanly
   - `Break` — contested ball, breaks loose
   - `Foul` — foul conceded
   - `Out` — ball goes out of play before being contested
5. **Outcome** — what happened:
   - `Retained` / `Lost` — possession result
   - `Score` — direct score from kickout
   - `Wide` / `Foul` / `Out` — turnover variants
6. **Restart After** *(optional)* — what caused this kickout: Score / Wide / Foul / Out
7. **Target Player** *(optional)* — jersey number of the intended target
8. **Tap the pitch** to set the landing location. A white dot appears.
   - For a `Break` contest, a second tap sets the pickup location (where the loose ball was gathered).

Tap **Save** (or press Enter) to record the event. A brief flash confirms it saved.

### Shots and Turnovers

Follow the same flow but select `Shot` or `Turnover` as the Type. The relevant outcome options update automatically.

---

## The Pitch Diagram

- The green pitch shows your half (your goal at the top or bottom depending on your setup).
- **White dot** = landing/event location.
- **Dashed line + smaller dot** = pickup location (break contests only).
- Past events appear as coloured dots/shapes. Colours indicate outcome:
  - Blue = Score/Point
  - Green = Retained/Won
  - Purple = Goal
  - Red = Lost
  - Amber = Wide
  - Orange = Blocked
  - Slate = Saved
  - Pink = Foul

**Keyboard navigation:** use Arrow keys to move the crosshair, then press Enter or Space to confirm.

---

## Header Controls

| Control | What it does |
|---|---|
| **H1 / H2 / ET / All** pills | Filter the analytics view to show only events from that period. Does not affect capture — events are always saved with the period selected in the form. |
| **End ⇄** button | Manually swap which goal end is "ours" on the pitch. Normally you only need this if the auto-flip at half-time didn't trigger correctly. |
| **Screen lock** 🔆/🔅 | Keep the screen on during the match so it doesn't auto-lock. Tap again to release. |
| **Sync chip** | Shows connectivity and sync status (Offline / ⚠ pending / ✓ synced). |

> **Half-time:** When you switch the Period in the form to `H2`, the pitch automatically flips so your goal end stays correct. You do not need to tap **End ⇄** manually at half-time.

---

## Undoing and Editing

- **Undo** — tap the Undo button to remove the last saved event. You will be asked to confirm.
- **Edit** — in the **Events** tab, tap any event row to load it back into the form. The Save button becomes **Update**. Tap it to overwrite the event.

---

## Analytics Tabs

After capturing some events, switch between:

| Tab | Shows |
|---|---|
| **Kickouts** | Retention %, zone breakdown, player targets, clock trend, restart breakdown |
| **Shots** | Shot outcomes and locations |
| **Turnovers** | Turnover locations and outcomes |
| **Digest** | Full match summary — suitable for sharing |
| **Events** | Raw event log with edit capability |

Analytics automatically filter to the event type of the current tab.

Use the **H1 / H2 / ET / All** pills in the header to narrow down to a specific period.

---

## Digest & Sharing

The **Digest** tab shows a formatted match summary including:
- Final score (derived from recorded shots)
- Kickout retention % for both teams
- Zone heatmap
- Top targeted players
- Opposition kickout tendencies (where they kick and our win rate per zone)

Tap **Share** to:
- On mobile: share the digest as a PNG image via your phone's share sheet (WhatsApp, Messages, etc.)
- On desktop: download the image as a PNG file

---

## Working Offline

Páirc keeps working if connectivity drops during a match. Events save to your device immediately, and when connectivity returns any unsynced events are automatically uploaded to the cloud (if you are signed in).

The sync status chip in the header shows:
- **● Offline** — no internet connection
- **⚠ 3** — 3 events waiting to sync
- **↻** — currently syncing
- **✓** — all events synced

---

## Tips for Live Use

- Set up the match (team, opponent, date, goal end) **before** the throw-in, not during.
- Use **Add to Home Screen** so the app opens full-screen without browser chrome.
- Enable **Screen lock** (🔆) so the phone doesn't lock mid-match.
- Period auto-flips at H2 — you don't need to do anything at half-time.
- If you make a mistake, tap **Undo** immediately — it's one tap.
- Flag an event with ⚑ if you're unsure and want to review it later.
- You can review and correct events in the **Events** tab after the match.

---

## Exporting Data

In the **Events** tab, tap **Export JSON** to download all events as a JSON file. This is your backup and can be reimported if needed.
