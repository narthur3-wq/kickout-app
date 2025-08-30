// /src/stores.js
import { writable, derived } from 'svelte/store';

/** Raw event stream {type, team, half, x, y, ...} */
export const events = writable([]);

/** Game meta */
export const team = writable('Clontarf');
export const opponent = writable('Opposition');

/** Current half (1 or 2) */
export const half = writable(1);

/** True if Clontarf kicks toward the TOP goal in the current half */
export const kicking_goal_top = writable(false);

/** Which side’s events to view by default on some tabs: 'us' | 'opp'  */
export const current_side = writable('us');

/** Standard derived collections many tabs use */
export const clontarf = derived(events, $e => $e.filter(ev => ev.team === 'us'));
export const opp      = derived(events, $e => $e.filter(ev => ev.team === 'opp'));
export const shots    = derived(events, $e => $e.filter(ev => ev.type === 'shot'));
export const kickouts = derived(events, $e => $e.filter(ev => ev.type === 'kickout'));
export const turnovers= derived(events, $e => $e.filter(ev => ev.type === 'turnover'));

/**
 * Orientation label text — some screens import this by name.
 * Your earlier UI phrasing was “Clontarf kicking → Left/Right”.
 * If your notion of Left/Right flips with $kicking_goal_top, adjust below.
 */
export const orientationLabel = derived(
  kicking_goal_top,
  $top => ($top ? 'Clontarf kicking → Left' : 'Clontarf kicking → Right')
);

/** UI preferences */
export const ui = writable({ dark: false });
