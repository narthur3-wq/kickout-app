import { writable } from 'svelte/store';

export const APP_ID = 'kickout-app';
export const LS_EVENTS = `${APP_ID}:events`;
export const LS_META = `${APP_ID}:meta`;

// Shared state
export const events = writable([]);
/** meta: { team, opponent, kicking_goal_top, dark, wake_lock } */
export const meta = writable({
  team: '',
  opponent: '',
  kicking_goal_top: true,
  dark: false,
  wake_lock: true,
});

// Load once
function load() {
  try {
    const e = JSON.parse(localStorage.getItem(LS_EVENTS) || '[]');
    const m = JSON.parse(localStorage.getItem(LS_META) || '{}');
    events.set(Array.isArray(e) ? e : []);
    meta.update(v => ({ ...v, ...(m || {}) }));
  } catch {}
}
load();

// Persist
events.subscribe(v => { try { localStorage.setItem(LS_EVENTS, JSON.stringify(v)); } catch {} });
meta.subscribe(v => { try { localStorage.setItem(LS_META, JSON.stringify(v)); } catch {} });

// Sync between tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_EVENTS || e.key === LS_META) load();
  });
}
