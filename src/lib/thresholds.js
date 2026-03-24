export const MIN_RECENT_SAMPLE = 4;
export const MIN_PHASE_SAMPLE = 6;
export const MIN_KICKOUT_PATTERN_SAMPLE = 5;
export const MIN_LANE_SAMPLE = 3;
export const MIN_SIDE_SAMPLE = 3;
export const MIN_RECOMMENDATION_SAMPLE = 4;

export function pct(part, total) {
  if (!total) return null;
  return Math.round((100 * part) / total);
}

export function hasMinimumSample(count, minimum) {
  return count >= minimum;
}

export function dominantShare(count, total, minShare = 0.45, minCount = 3) {
  if (count < minCount || !total) return false;
  return count / total >= minShare;
}

export function meaningfulGap(a, b, minGap = 15) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) >= minGap;
}

export function meaningfulCountGap(a, b, minGap = 2) {
  return Math.abs((a || 0) - (b || 0)) >= minGap;
}
