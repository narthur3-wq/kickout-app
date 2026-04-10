import { describe, expect, it } from 'vitest';
import {
  dominantShare,
  hasMinimumSample,
  meaningfulCountGap,
  meaningfulGap,
  MIN_KICKOUT_PATTERN_SAMPLE,
  MIN_LANE_SAMPLE,
  MIN_PHASE_SAMPLE,
  MIN_RECENT_SAMPLE,
  MIN_RECOMMENDATION_SAMPLE,
  MIN_SIDE_SAMPLE,
  pct,
} from './thresholds.js';

describe('constants', () => {
  it('exports expected threshold constants', () => {
    expect(MIN_RECENT_SAMPLE).toBe(4);
    expect(MIN_PHASE_SAMPLE).toBe(6);
    expect(MIN_KICKOUT_PATTERN_SAMPLE).toBe(5);
    expect(MIN_LANE_SAMPLE).toBe(3);
    expect(MIN_SIDE_SAMPLE).toBe(3);
    expect(MIN_RECOMMENDATION_SAMPLE).toBe(4);
  });
});

describe('pct', () => {
  it('returns null when total is zero', () => {
    expect(pct(5, 0)).toBeNull();
    expect(pct(0, 0)).toBeNull();
  });

  it('returns null when total is falsy', () => {
    expect(pct(5, null)).toBeNull();
    expect(pct(5, undefined)).toBeNull();
  });

  it('rounds to the nearest integer', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(1, 2)).toBe(50);
  });

  it('returns 100 for a full fraction', () => {
    expect(pct(5, 5)).toBe(100);
  });

  it('returns 0 when part is 0', () => {
    expect(pct(0, 10)).toBe(0);
  });
});

describe('hasMinimumSample', () => {
  it('returns true when count meets the minimum', () => {
    expect(hasMinimumSample(5, 5)).toBe(true);
    expect(hasMinimumSample(6, 5)).toBe(true);
  });

  it('returns false when count is below the minimum', () => {
    expect(hasMinimumSample(4, 5)).toBe(false);
    expect(hasMinimumSample(0, 1)).toBe(false);
  });
});

describe('dominantShare', () => {
  it('returns false when count is below minCount', () => {
    expect(dominantShare(2, 10)).toBe(false);
    expect(dominantShare(0, 10)).toBe(false);
  });

  it('returns false when total is falsy', () => {
    expect(dominantShare(5, 0)).toBe(false);
    expect(dominantShare(5, null)).toBe(false);
  });

  it('returns true when share meets the default 45% threshold', () => {
    expect(dominantShare(5, 10)).toBe(true);   // 50%
    expect(dominantShare(9, 20)).toBe(true);   // 45%
  });

  it('returns false when share is below the threshold', () => {
    expect(dominantShare(4, 10)).toBe(false);  // 40%
    expect(dominantShare(8, 20)).toBe(false);  // 40%
  });

  it('respects custom minShare and minCount overrides', () => {
    expect(dominantShare(3, 10, 0.30, 2)).toBe(true);   // 30%, meets custom threshold
    expect(dominantShare(2, 10, 0.30, 3)).toBe(false);  // count below custom minCount
  });
});

describe('meaningfulGap', () => {
  it('returns true when the absolute gap meets the default 15-unit threshold', () => {
    expect(meaningfulGap(50, 35)).toBe(true);
    expect(meaningfulGap(35, 50)).toBe(true);
    expect(meaningfulGap(50, 34)).toBe(true);  // gap = 16
  });

  it('returns false when the gap is below the threshold', () => {
    expect(meaningfulGap(50, 36)).toBe(false); // gap = 14
    expect(meaningfulGap(50, 50)).toBe(false);
  });

  it('returns false when either value is null', () => {
    expect(meaningfulGap(null, 50)).toBe(false);
    expect(meaningfulGap(50, null)).toBe(false);
    expect(meaningfulGap(null, null)).toBe(false);
  });

  it('respects a custom minGap', () => {
    expect(meaningfulGap(10, 5, 5)).toBe(true);
    expect(meaningfulGap(10, 6, 5)).toBe(false);
  });
});

describe('meaningfulCountGap', () => {
  it('returns true when the count difference meets the default 2-unit threshold', () => {
    expect(meaningfulCountGap(5, 3)).toBe(true);
    expect(meaningfulCountGap(3, 5)).toBe(true);
  });

  it('returns false when the gap is below the threshold', () => {
    expect(meaningfulCountGap(5, 4)).toBe(false);
    expect(meaningfulCountGap(5, 5)).toBe(false);
  });

  it('treats null and undefined as 0', () => {
    expect(meaningfulCountGap(null, null)).toBe(false);
    expect(meaningfulCountGap(undefined, 0)).toBe(false);
    expect(meaningfulCountGap(null, 3)).toBe(true);  // |0 - 3| = 3 >= 2
  });

  it('respects a custom minGap', () => {
    expect(meaningfulCountGap(5, 2, 3)).toBe(true);
    expect(meaningfulCountGap(5, 3, 3)).toBe(false);
  });
});
