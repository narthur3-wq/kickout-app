import { writable } from 'svelte/store';

export const APP_ID = 'kickout-app';
export const LS_EVENTS = `${APP_ID}:events`;
export const LS_META = `${APP_ID}:meta`;

export const events = writable([]);
export const meta = writable({
  team: 'Clontarf',
  opponent: '',
  kicking_goal_top: true,
  dark: false,
  wake_lock: true,
});

// Load persisted
function load(){
  try {
    const e = JSON.parse(localStorage.getItem(LS_EVENTS) || '[]');
    const m = JSON.parse(localStorage.getItem(LS_META) || 'null');
    if (Array.isArray(e)) events.set(e);
    if (m && typeof m==='object') meta.set({ ...m });
  } catch {}
}
load();

// Persist
events.subscribe(v => { try { localStorage.setItem(LS_EVENTS, JSON.stringify(v)); } catch {} });
meta.subscribe(v => { try { localStorage.setItem(LS_META, JSON.stringify(v)); } catch {} });

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_EVENTS || e.key === LS_META) load();
  });
}
