// General UI helpers
export function pill(active){ return `pill${active ? ' active' : ''}`; }
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const pct = (num, den) => den ? Math.round((num/den)*100) : 0;

// Math helpers used around the app
export function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

// Zoning helpers (L/C/R & S/M/L)
export function zoneLR(nx){ if(nx < 1/3) return 'L'; if(nx < 2/3) return 'C'; return 'R'; }
export function zoneDepth(ny){ if(ny < 1/3) return 'S'; if(ny < 2/3) return 'M'; return 'L'; }
export function zoneFromCanonical(nx, ny){ return zoneLR(nx) + zoneDepth(ny); }

// Re-export coordinate helpers so legacy imports can consolidate here too
export { toNorm, getClientPoint, toDisplayXY } from './coords.js';
