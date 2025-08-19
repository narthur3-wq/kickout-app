# File: src/lib/pitch-geometry.js
// Pitch geometry & zone helpers (90 x 145 m)
export const PITCH_WIDTH_M = 90;
export const PITCH_LENGTH_M = 145;

export function toMeters(x, y) {
  return { x_m: x * PITCH_WIDTH_M, y_m: y * PITCH_LENGTH_M };
}

export function bandsFrom(x, y) {
  // side: L/C/R thirds; depth: S/M/L/V quarters (tunable)
  const side_band = x < 1/3 ? 'L' : x < 2/3 ? 'C' : 'R';
  const d = y;
  const depth_band = d < 0.22 ? 'S' : d < 0.45 ? 'M' : d < 0.72 ? 'L' : 'V';
  return { side_band, depth_band, zone_code: `${side_band}-${depth_band}` };
}

export function depthFromOwnGoal(y, ourGoalAtTop) {
  // y is 0..1 from top; convert to metres from our own goal line
  const fromTop = y * PITCH_LENGTH_M;
  return ourGoalAtTop ? fromTop : PITCH_LENGTH_M - fromTop;
}

export function displacement(a, b) {
  if (!a || !b) return 0;
  const dx = (b.x - a.x) * PITCH_WIDTH_M;
  const dy = (b.y - a.y) * PITCH_LENGTH_M;
  return Math.hypot(dx, dy);
}
