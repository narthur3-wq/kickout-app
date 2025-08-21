// Field dimensions (metres) — landscape
export const LENGTH_M = 145; // X: left <-> right
export const WIDTH_M  = 90;  // Y: top  <-> bottom

// Jersey chips 1..25
export const jerseyNums = Array.from({ length: 25 }, (_, i) => i + 1);

// In landscape, X is length, Y is width
export const toMetersX = (nx) => nx * LENGTH_M;
export const toMetersY = (ny) => ny * WIDTH_M;

// Depth from kicker's goal along the length (X axis) — default goal at left
export function depthFromKickerGoal(nx, goalAtLeft = true) {
  const m = toMetersX(nx);
  return goalAtLeft ? m : (LENGTH_M - m);
}

export function sideBand(ny) {
  return ny < 1/3 ? 'Left' : ny < 2/3 ? 'Centre' : 'Right';
}
export function depthBand(d) {
  return d < 20 ? 'Short' : d < 45 ? 'Medium' : d < 65 ? 'Long' : 'Very Long';
}

export function zoneCode(nx, ny, goalAtLeft = true) {
  const d = depthFromKickerGoal(nx, goalAtLeft);
  return `${sideBand(ny)[0]}-${depthBand(d)[0]}`; // e.g., L-M
}
