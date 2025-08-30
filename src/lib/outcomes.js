// Normalise shot outcomes and compute points consistently.

const TWO_POINTERS = new Set(['two', 'two_points', 'two-point', '2pt', 'twopoint', 'twopoints', 'twopt', 'twoPoint']);
const ONE_POINTERS = new Set(['point', 'point1', 'one', '1pt', 'pt']);
const GOALS        = new Set(['goal', 'goals']);

export function normalizeOutcome(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
  if (GOALS.has(s)) return 'goal';
  if (TWO_POINTERS.has(s)) return 'two_points';
  if (ONE_POINTERS.has(s)) return 'point';
  if (s === 'wide' || s === 'miss') return 'wide';
  if (s === 'short') return 'short';
  if (s === 'blocked') return 'blocked';
  return s || '';
}

export function isScore(o) {
  const n = normalizeOutcome(o);
  return n === 'goal' || n === 'point' || n === 'two_points';
}

export function pointsFor(o) {
  const n = normalizeOutcome(o);
  if (n === 'goal') return 3;
  if (n === 'two_points') return 2;
  if (n === 'point') return 1;
  return 0;
}

export function isFree(ctx) {
  const s = String(ctx || '').toLowerCase();
  return s === 'free' || s === 'placed' || s === 'setplay';
}

export function formatScoreLine({ goals = 0, points = 0, twos = 0 }) {
  // Total points = one-pointers + (two-pointers * 2) + (goals * 3)
  const totalPoints = points + (twos * 2) + (goals * 3);

  // Display as Goals–Points (where Points is only one-pointers)
  // This mirrors GAA conventions; two-pointers are not added to the "points"
  const primary = `${goals}–${points}`;

  // Only append the "incl. 1×2pt" note when twos > 0
  const twoNote = twos > 0
    ? `incl. ${twos}×2pt`
    : '';

  return { primary, totalPoints, twoNote };
}
