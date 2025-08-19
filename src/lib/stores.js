import { writable, derived } from 'svelte/store';

// ---- Config ----
export const APP_ID = 'kickout-app';
const KEY = `${APP_ID}:events:v1`;
const UI_KEY = `${APP_ID}:ui:v1`;

// ---- Persistence helpers (safe during build) ----
function persistable(initial, key) {
  let startValue = initial;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw) { try { startValue = JSON.parse(raw); } catch {} }
  }
  const s = writable(startValue);
  if (typeof window !== 'undefined') {
    s.subscribe(v => {
      try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
    });
  }
  return s;
}

// ---- Data model ----
export const events = persistable([], KEY);

export const ui = persistable({
  filters: { opponent: '', player: '', ytd: true, contest: 'all', outcome: 'all' },
  ourGoalAtTop: true,
  showPickup: true,
  activeEventDraft: null,
}, UI_KEY);

export const filtered = derived([events, ui], ([$events, $ui]) => {
  const { opponent, player, ytd, contest, outcome } = $ui.filters;
  const year = new Date().getFullYear();
  return $events.filter(e => {
    if (opponent && e.opponent !== opponent) return false;
    if (player && e.target_player !== player) return false;
    if (ytd && e.match_date && String(e.match_date).slice(0,4) !== String(year)) return false;
    if (contest !== 'all' && e.contest_type !== contest) return false;
    if (outcome !== 'all' && e.outcome !== outcome) return false;
    return true;
  });
});

// ---- Commands ----
export function addEvent(row) {
  const id = (globalThis.crypto && globalThis.crypto.randomUUID)
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  events.update(list => [{ ...row, id, created_at: new Date().toISOString() }, ...list]);
}
export function deleteEvent(id) { events.update(list => list.filter(e => e.id !== id)); }
export function clearAll() { events.set([]); }

// Export / Import
export function toCsvRows(rows) {
  const cols = [
    'id','created_at','match_date','team','opponent','period','clock','target_player','outcome','contest_type','break_outcome','time_to_tee_s','total_time_s','scored_20s','x','y','x_m','y_m','our_goal_at_top','depth_from_own_goal_m','side_band','depth_band','zone_code','pickup_x','pickup_y','pickup_x_m','pickup_y_m','break_displacement_m'
  ];
  const header = cols.join(',');
  const lines = rows.map(r => cols.map(k => r[k] ?? '').join(','));
  return [header, ...lines].join('\n');
}

export function downloadCsv(name, rows) {
  const csv = toCsvRows(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// Simple de-dupe by (match_date,clock,team,x,y)
export function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = [r.match_date,r.clock,r.team,Number(r.x).toFixed(3),Number(r.y).toFixed(3)].join('|');
    if (seen.has(key)) continue; seen.add(key); out.push(r);
  }
  return out;
}
