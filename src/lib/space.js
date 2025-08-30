// Single source of truth for pitch projection & zones.
// Canonical = "kicking → right": x_c in [0..1] from our goal to theirs; y_c in [0..1] top→bottom.

export function clamp01(n) {
  const x = Number(n);
  if (!isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

/** Save-time: convert screen coord (0..1) into canonical (kicking→right) using orientation at capture */
export function toCanonical({ x, y }, orientationLeftAtCapture) {
  const xs = clamp01(x);
  const ys = clamp01(y);
  const x_c = orientationLeftAtCapture ? 1 - xs : xs; // flip X if we were kicking left
  const y_c = ys; // Y never flips
  return { x_c, y_c };
}

/** Render-time: convert canonical coord to current screen orientation */
export function toScreen({ x_c, y_c }, viewingOrientationLeft) {
  const xc = clamp01(x_c);
  const yc = clamp01(y_c);
  const x = viewingOrientationLeft ? 1 - xc : xc;
  const y = yc;
  return { x, y };
}

/** Zone from canonical (depth by x_c, lateral by y_c) */
export function zoneFromCanonical(x_c, y_c) {
  const x = clamp01(x_c);
  const y = clamp01(y_c);

  // Depth thresholds (adjust if you use different breakpoints)
  const depth =
    x < 0.25 ? 'Short' :
    x < 0.50 ? 'Medium' :
    x < 0.75 ? 'Long' : 'Very Long';

  // Thirds left/centre/right from our perspective
  const lateral =
    y < 1/3 ? 'Left' :
    y < 2/3 ? 'Centre' : 'Right';

  return `${depth} ${lateral}`;
}
