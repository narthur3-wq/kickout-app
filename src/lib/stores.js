import { writable, derived, get } from 'svelte/store';

/** Meta / UI state */
export const current_side = writable('us');       // 'us' | 'opp'
export const half = writable(1);                  // 1 | 2 | 'all'
export const orientation_left = writable(true);   // true = Left, false = Right

export const orientationLabel = derived(orientation_left, v => (v ? 'Left' : 'Right'));

export function setSide(side) {
  current_side.set(side === 'opp' ? 'opp' : 'us');
}
export function setHalf(h) {
  // allow 1, 2, 'all'
  if (h === 'all') half.set('all');
  else half.set(h === 2 ? 2 : 1);
}
export function toggleOrientation() {
  orientation_left.update(v => !v);
}

/** Data: committed + staged */
export const events = writable([]);   // committed (coach tabs read from here)
export const pending = writable([]);  // staged (dots on capture)

export function addPending(ev) {
  pending.update(p => [ev, ...p]);
}

export function clearPending() {
  pending.set([]);
}

/** Commit staged → committed */
export function commitPending() {
  const p = get(pending);
  if (!p || !p.length) {
    toast('Nothing to save', 'info', 1200);
    return;
  }
  events.update(e => [...p, ...e]);
  pending.set([]);
  toast(`Saved ${p.length} item(s)`, 'success', 1200);
}

/** Undo just the most recent staged item (option A) */
export function undoPending() {
  let removed = null;
  pending.update(p => {
    if (!p.length) return p;
    [removed, ...p] = p;
    return p;
  });
  return !!removed;
}

/** Undo most recent staged item for a side (used earlier in a few places) */
export function undoMostRecentForSide(side) {
  let removed = false;
  pending.update(p => {
    const idx = p.findIndex(ev => ev.side === side);
    if (idx === -1) return p;
    removed = true;
    const copy = p.slice();
    copy.splice(idx, 1);
    return copy;
  });
  return removed;
}

/** Toast (global) */
const _toast = writable({ message: '', kind: 'info', until: 0 });
export const toastStore = _toast;
let timer = null;

export function toast(message, kind = 'info', ms = 1400) {
  if (timer) { clearTimeout(timer); timer = null; }
  _toast.set({ message, kind, until: Date.now() + ms });
  timer = setTimeout(() => _toast.set({ message: '', kind: 'info', until: 0 }), ms);
}
