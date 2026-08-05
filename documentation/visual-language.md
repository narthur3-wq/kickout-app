# Pairc - Visual Language

## Base rules

Across the pitch views, the app follows one base grammar:

- position = where the event happened
- shape = which team the event belongs to
- color = result
- ring = special annotation only when needed
- pitch cue = our goal / orientation

## Team shape

- circle = our event
- square = their event

This is the shared rule across the detailed analytics tabs.

## Kickouts

Kickouts prioritize fast territorial and outcome reading.

Dots mode:

- shape = team
- color:
  - green = successful / retained / won
  - red = lost
  - amber = dead-ball or non-retention outcome

Heat mode:

- Density
- Successful
- Lost

Kickouts can also show landing vs pickup perspectives.

## Turnovers

Turnovers use the simplest map language.

Dots mode:

- shape = team
- color:
  - green = turnover won
  - red = turnover lost

Heat mode:

- Density
- Won
- Lost

## Shots

Shots carry more information than the other event types.

Dots mode:

- shape = team
- color — scores read cool, misses read warm:
  - green `#22c55e` = goal
  - sky `#38bdf8` = point
  - amber `#fbbf24` = wide
  - rose `#fb7185` = blocked
  - light slate `#cbd5e1` = saved
- **dashed** ring = goal attempt (a shot that was going for goal but did not
  score)

These are deliberately bright: they are drawn on dark green turf, and they are
often read at a glance on a phone in daylight. The previous set (dark green /
teal / amber / orange) put the most important distinction in the app — goal
versus point — in two dark adjacent hues, and wide versus blocked in two
adjacent warm ones.

The goal-attempt ring is dashed rather than solid because every marker already
carries a solid light outline for contrast against the turf; a solid ring was
indistinguishable from that outline, so the encoding never actually read.

Marker colours live in `analyticsMarkerFill()` in `src/lib/appShellHelpers.js`,
with a matching fallback in `outcomeColor()` in `src/lib/Pitch.svelte` and
matching legend swatches in `outcomeColor()` in `src/lib/AnalyticsPanel.svelte`.
All three must be changed together.

Heat mode:

- Density
- Scored
- Missed

## Legend rules

Legends should always be:

- tab-specific
- mode-specific
- matched to what is actually on screen

They should not show generic items that are not active in the current view.

## Orientation

The highlighted goal/end marker indicates our goal.

This should be treated as a pitch cue, not as a point marker in the visual grammar.
