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
- color:
  - dark green = goal
  - teal = point
  - amber = wide
  - orange = blocked
  - slate = saved
- ring = goal attempt

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
