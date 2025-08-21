// src/stores.js
import { writable } from 'svelte/store';

const META_KEY = 'kickout_meta_v1';
const EVENTS_KEY_V2 = 'kickout_events_v2'; // new schema

// ---- Meta (team, opponent, UI prefs) ----
const metaDefault = {
  team: 'Our team',
  opponent: 'Opposition',
  dark: false,
  wake_lock: false,
};
const metaStored = (() => {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || metaDefault; } catch { return metaDefault; }
})();
export const meta = writable(metaStored);
meta.subscribe(v => localStorage.setItem(META_KEY, JSON.stringify(v)));

// ---- Events with migration to v2 ----
function migrateToV2(list = []) {
  return list.map(e => ({
    ...e,
    // new optional review fields (keep existing if present)
    time_to_tee: typeof e.time_to_tee === 'number' ? e.time_to_tee : null,
    time_to_kick: typeof e.time_to_kick === 'number' ? e.time_to_kick : null,
    game_result: e.game_result ?? '',
    loss_category: e.loss_category ?? '',      // '', 'mechanics','decision','kick_type','player','break'
    opposition_name: e.opposition_name ?? e.opponent ?? '',
  }));
}
const loadEventsV2 = () => {
  try {
    const v2 = JSON.parse(localStorage.getItem(EVENTS_KEY_V2) || '[]');
    if (Array.isArray(v2) && v2.length) return v2;
    // migrate old key if present
    const old = JSON.parse(localStorage.getItem('kickout_events') || '[]');
    return migrateToV2(old);
  } catch {
    return [];
  }
};

export const events = writable(loadEventsV2());
events.subscribe(v => localStorage.setItem(EVENTS_KEY_V2, JSON.stringify(v)));

// ---- Small helpers for Review tab ----
export function updateEvent(id, patch) {
  events.update(list => list.map(e => (e.id === id ? { ...e, ...patch } : e)));
}
export function removeEventsBySide(side) {
  events.update(list => list.filter(e => e.side !== side));
}
