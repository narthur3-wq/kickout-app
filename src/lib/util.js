// src/lib/util.js  — FINAL

// Clamp to [0,1]
export function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

/* ---------- Kickout zoning (canonical frame = ATTACKING → RIGHT) ---------- */

// L/C/R from Y (across the pitch, top→bottom in screen coords)
export function zoneLR_fromY(ny){
  if (ny < 1/3) return 'left';
  if (ny < 2/3) return 'centre';
  return 'right';
}

// S/M/L from X (depth along kick direction)
export function zoneDepth_fromX(nx){
  if (nx < 1/3) return 'short';
  if (nx < 2/3) return 'medium';
  return 'long';
}

// Canonical key like "long-right"
export function zoneFromCanonical(nx, ny){
  return zoneDepth_fromX(nx) + '-' + zoneLR_fromY(ny);
}

/**
 * Flip-safe classification.
 * savedLeft   = orientation when the event was captured (true => we were kicking LEFT)
 * currentLeft = current UI orientation (true => we are kicking LEFT)
 */
export function classifyKickoutZone(nx, ny, savedLeft, currentLeft){
  let cx = nx, cy = ny;

    // ✅ Normalize capture to "attack →" frame.
  if (savedLeft === true){
    cx = 1 - cx;
    cy = 1 - cy;
  }

 // ✅ Apply current orientation independently of how it was saved.
  if (currentLeft === true){
    cx = 1 - cx;
    cy = 1 - cy;
  }

  const key = zoneFromCanonical(cx, cy);
  const [length, lateral] = key.split('-');
  return { key, length, lateral };
}

/**
 * Zones relative to the *kicker's* direction (us vs opp).
 * Our saved/current flags are from our POV, so invert for opposition.
 */
export function classifyKickoutZoneForSide(nx, ny, side, savedOrientationLeft, currentLeft){
  const savedKickerLeft   = side === 'us' ? savedOrientationLeft : !savedOrientationLeft;
  const currentKickerLeft = side === 'us' ? currentLeft          : !currentLeft;
  return classifyKickoutZone(nx, ny, savedKickerLeft, currentKickerLeft);
}

// Re-export coords helpers so legacy imports continue to work
export { toNorm, getClientPoint, toDisplayXY } from './coords.js';
