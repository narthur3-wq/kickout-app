// Field dimensions (metres)
export const LENGTH_M = 145; // left <-> right (X)
export const WIDTH_M  = 90;  // top <-> bottom (Y)

// Jersey quick chips 2..25
export const jerseyNums = Array.from({ length: 24 }, (_, i) => i + 2);

// In landscape, X is length, Y is width
export const toMetersX = (nx) => nx * LENGTH_M; // along length
export const toMetersY = (ny) => ny * WIDTH_M;  // across width

// Depth is distance from kicker's goal along the length (X axis)
// NOTE: we continue to use meta.kicking_goal_top to avoid store rename.
// In landscape, treat "true" as "kicking goal at LEFT".
export function depthFromKickerGoal(nx, goalAtLeft) {
  const m = toMetersX(nx);
  return goalAtLeft ? m : (LENGTH_M - m);
}

// Side bands across the width (Y axis)
export function sideBand(ny) {
  return ny < 1/3 ? 'Left' : ny < 2/3 ? 'Centre' : 'Right';
}

export function depthBand(d) {
  return d < 20 ? 'Short' : d < 45 ? 'Medium' : d < 65 ? 'Long' : 'Very Long';
}

export function zoneCode(nx, ny, goalAtLeft) {
  const d = depthFromKickerGoal(nx, goalAtLeft);
  return `${sideBand(ny)[0]}-${depthBand(d)[0]}`; // e.g., L-M
}
