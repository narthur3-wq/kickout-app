export const WIDTH_M = 90;
export const LENGTH_M = 145;

// Jersey numbers 2..25 (quick chips)
export const jerseyNums = Array.from({ length: 24 }, (_, i) => i + 2);

export const toMetersX = (nx) => nx * WIDTH_M;
export const toMetersY = (ny) => ny * LENGTH_M;

export function depthFromKickerGoal(ny, kickingGoalTop) {
  const m = toMetersY(ny);
  return kickingGoalTop ? m : (LENGTH_M - m);
}
export function sideBand(nx) {
  return nx < 1 / 3 ? 'Left' : nx < 2 / 3 ? 'Centre' : 'Right';
}
export function depthBand(d) {
  return d < 20 ? 'Short' : d < 45 ? 'Medium' : d < 65 ? 'Long' : 'Very Long';
}
export function zoneCode(nx, ny, kickingGoalTop) {
  const d = depthFromKickerGoal(ny, kickingGoalTop);
  return `${sideBand(nx)[0]}-${depthBand(d)[0]}`; // e.g. L-S, C-M
}

