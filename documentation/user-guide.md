# Pairc - User Guide

## What Pairc is

Pairc is a match-day GAA analyst tool. It is built for one job: capture key events quickly during a game, read the match live, and hand a coach a usable summary at the right moment.

It supports three event types:

- Kickouts
- Shots
- Turnovers

From those events it builds:

- live analyst reads in `Live`
- a coach-facing summary in `Digest`
- detailed review in `Kickouts`, `Shots`, `Turnovers`, and `Events`

## Before throw-in

Start in `Capture` and set the current match:

- Team
- Opponent
- Match date

The app stores that setup on the active match record and uses that as the current match. For older pre-migration records, it can still fall back to the legacy team/opponent/date key.

Set the first-half orientation correctly:

- `Our goal: left/right end`
- `Attacking: left/right`

If the pitch is reversed, use `Swap ends` beside the pitch.

Important:

- the app does **not** auto-flip ends at half-time
- when you change period, the timer pauses and the app reminds you to use `Swap ends` if teams changed direction

## Capture workflow

The `Capture` screen is the live logging surface.

The left panel contains the event form:

- `Type`
- `Team`
- `Period`
- event-specific controls

The right panel contains the pitch. Tap the pitch to place the event location.

### Kickouts

For a kickout, record:

- which team the event belongs to
- period
- contest type
- outcome
- restart reason if relevant
- target player if known

Tap the pitch to set the landing point.

If the contest is `break`, the app becomes a two-step flow:

1. tap the landing point
2. tap the pickup point

The `Clear points` button resets the pitch markers and the break-step state.

### Shots

For shots, record:

- team
- period
- outcome

For `Wide` and `Blocked`, the form also asks whether it was a goal attempt.

Then tap the pitch to place the shot location.

### Turnovers

Turnovers use a single pitch tap for the turnover location.

They also record who lost and won the turnover:

- `Lost by`
- `Won by`

This is the current turnover capture model. Turnovers do not use a kickout-style landing/pickup flow.

## Team and direction

`Team` means which side the event belongs to.

It does **not** mean attacking direction.

Attacking direction is shown above the pitch:

- `Our goal: ...`
- `Attacking: ...`

`Swap ends` only changes the pitch orientation. It does not change which team the event belongs to.

## Timer and period

The timer is optional. It writes the event clock into the capture record.

Key rules:

- `Play` starts the timer
- `Paused` means the timer is not running
- changing period pauses the timer
- changing period does not flip the pitch automatically

## Live and Digest

`Live` is the analyst screen.

It is designed to answer:

- what is happening now?
- who is on top?
- what pattern is developing?
- what should we look at next?

`Digest` is the coach-facing screen.

It is designed to answer:

- what is the short read of the match?
- what is the main threat?
- what is the best opportunity?
- what actions should the coach take into the next phase?

## Detailed analysis tabs

### Kickouts

Use this when you want detailed kickout review:

- dot map
- heatmap
- landing vs pickup overlays
- zone tables
- clock trends
- player and restart breakdowns

### Shots

Use this for shot location and result review.

The shot map carries more detail than the other maps, because shots need to show:

- team
- result
- goal-attempt annotation where relevant

### Turnovers

Use this for turnover location review and win/loss patterning.

## Phase filtering

The header pills `H1 / H2 / ET / All` control the phase shown in the non-capture views.

That affects:

- `Live`
- `Digest`
- `Kickouts`
- `Shots`
- `Turnovers`

The `Period` control inside the capture form is separate. That sets the period written onto the event being saved.

## Events, edit, import, and export

`Events` is the full event log for the current storage scope.

From there you can:

- search
- inspect saved records
- load an event back into the form for editing
- export JSON
- import JSON

JSON export is the main backup path.

`Events` is broader than the default active-match views. It is meant for review, search, and export, not just the currently selected match.

If cloud sync is unavailable, events are still saved locally first.

## Sync states

The app uses local-first persistence.

What the sync indicators mean:

- local save succeeded immediately
- queued/pending means the event is safe on the device but not yet synced to Supabase
- synced means cloud save caught up
- blocked means the device has local data but cloud writes are failing and need attention

If you see a retry banner, the data is normally still safe locally unless the app explicitly says the save itself failed.

## Tactical Board

The tactical board is a half-time and training presentation tool. Open it with the **Board** tab, which is always available even when no match is active. It opens as a full-screen overlay above the app. Closing it returns you to exactly where you were — no match state is affected.

### What it does

- Places both teams on a full-pitch diagram (15 vs 15) in default GAA formation
- Lets you drag players to set positions
- Lets you draw passes and runs for players on either team
- Groups those actions into numbered steps
- Plays them back step by step so you can walk through a pattern live

### Tool modes

- **Select** — drag any player to reposition them
- **Pass** — tap player A, then tap player B; a dashed arrow is drawn between them
- **Run** — tap a player to select them (they highlight in yellow), then drag on the pitch to draw a movement path

### Step sequence

Each drawn pass or run is assigned to the current drawing step (shown in the toolbar as "Drawing step N").

Press **+ Next Step** to advance to the next step. This lets you build a sequence — for example: step 1 has a run, step 2 has a pass off that run, step 3 has a response movement from the opposition.

### Playback

Press **▶ Play** to animate step 1. Players with runs animate to their path endpoints; pass arrows show a ball dot travelling to the receiver. When step 1 finishes, playback pauses.

Press **▶ Play** again for step 2, and so on.

**← Back** snaps instantly to the previous step state. **↺ Reset** returns everyone to their pre-play positions without losing the drawn moves.

### Managing the board

- **Undo** — removes the most recently drawn move
- **Clear** — removes all drawn moves and resets the step counter, keeping player positions
- **Reset** — removes all moves and returns players to the default formation
- **Done** — closes the board

### Typical half-time workflow

1. Open the board just before or at half-time
2. Drag players to reflect the actual positions you saw in the first half
3. Draw the key pattern you want to address — opponent press shape, your kickout target zone, etc.
4. Add steps to show how you want to respond
5. Press Play and walk the coach through it
6. Close when done

## Recommended live workflow

For one analyst:

- use `Capture` during play
- check `Live` at stoppages
- use `Digest` for a coach handoff

For two analysts on the same match:

- Analyst 1: Kickouts
- Analyst 2: Shots and Turnovers

Do not have both analysts logging the same event stream live, or you will create duplicates.

See [`multi-analyst-setup.md`](./multi-analyst-setup.md) for the recommended shared-match setup.

## Launch operating model

The launch build is local-first with optional Supabase auth and sync.

That means:

- every match-day event is saved locally first
- cloud sync is a convenience and collaboration layer, not the first place data is written
- if Supabase is not configured, the app runs offline-only
- if Supabase is configured but access cannot be verified, sign-in waits for a successful access check instead of assuming access

For launch support, treat `npm run test:smoke` as the cloud path proof. Treat `npm run test:e2e` as the local/offline regression suite.

## Accessibility launch checks

Before release, check the core match-day flow with keyboard controls:

- tab to the active match control
- tab through the main navigation
- focus the pitch and use arrow keys plus Enter or Space to place a point
- open and close modal surfaces with their visible controls and Escape where supported
- confirm Login and Events search fields have visible labels

The automated smoke for this is `npm run test:a11y`.
