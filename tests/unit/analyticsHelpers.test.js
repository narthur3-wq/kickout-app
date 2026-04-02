import { describe, expect, it } from 'vitest';
import {
  buildKickoutClockTrend,
  buildShotSummary,
  buildTurnoverSummary,
} from '../../src/lib/analyticsHelpers.js';

describe('analyticsHelpers', () => {
  it('returns null or tooFew for unsupported and undersized samples', () => {
    expect(buildShotSummary([{ outcome: 'Goal' }], 'kickout')).toBeNull();
    expect(buildShotSummary([{ outcome: 'Goal' }, { outcome: 'Point' }], 'shot')).toEqual({
      tooFew: true,
    });

    expect(buildTurnoverSummary([{ outcome: 'Won' }, { outcome: 'Lost' }], 'turnover')).toEqual({
      tooFew: true,
    });
    expect(buildKickoutClockTrend([{ clock: '0:30' }], 'shot')).toEqual([]);
  });

  it('summarizes shot outcomes and attempt types', () => {
    const summary = buildShotSummary(
      [
        undefined,
        { outcome: 'Goal', shot_type: 'goal' },
        { outcome: 'Point', shot_type: 'point' },
        { outcome: 'Two Point', shot_type: 'point' },
        { outcome: 'Saved', shot_type: 'goal' },
        { outcome: 'Wide', shot_type: 'goal' },
        { outcome: 'Wide', shot_type: 'point' },
        { outcome: 'Blocked' },
        { outcome: 'Dropped short', shot_type: 'goal' },
        { outcome: 'Dropped short', shot_type: 'point' },
      ],
      'shot'
    );

    expect(summary).toEqual({
      total: 10,
      scored: 3,
      scoredPct: 30,
      goalAttempts: 4,
      goals: 1,
      pointAttempts: 5,
      points: 2,
      small: false,
    });
  });

  it('marks a small shot sample when there are fewer than five events', () => {
    const summary = buildShotSummary(
      [
        { outcome: 'Goal', shot_type: 'goal' },
        { outcome: 'Point', shot_type: 'point' },
        { outcome: 'Wide', shot_type: 'goal' },
        { outcome: 'Blocked', shot_type: 'point' },
      ],
      'shot'
    );

    expect(summary).toMatchObject({
      total: 4,
      scored: 2,
      scoredPct: 50,
      small: true,
    });
  });

  it('summarizes turnover outcomes and ignores unrelated values', () => {
    const summary = buildTurnoverSummary(
      [
        undefined,
        { outcome: 'Retained' },
        { outcome: 'Won' },
        { outcome: 'Lost' },
        { outcome: 'Foul' },
      ],
      'turnover'
    );

    expect(summary).toEqual({
      total: 5,
      won: 2,
      lost: 1,
      net: 1,
      small: false,
    });
  });

  it('groups kickout timings into the correct clock buckets', () => {
    const trend = buildKickoutClockTrend(
      [
        { clock: '0:30', period: 'H1', outcome: 'Retained' },
        { clock: '5:00', period: 'H1', outcome: 'Lost' },
        { clock: '25:00', period: 'H1', outcome: 'Won' },
        { clock: '0:15', period: 'H2', outcome: 'Won' },
        { clock: '9:59', period: 'H2', outcome: 'Lost' },
        { clock: '0:10', period: 'ET', outcome: 'Score' },
        { clock: '5:00', period: 'ET', outcome: 'Lost' },
        { clock: 'bad', period: 'H1', outcome: 'Won' },
        { period: 'H1', outcome: 'Won' },
      ],
      'kickout'
    );

    expect(trend).toEqual([
      { label: '0-10', tot: 2, pct: 50 },
      { label: '40-50', tot: 2, pct: 50 },
      { label: '80-90', tot: 2, pct: 50 },
    ]);
    expect(trend.find((bucket) => bucket.label === '20-30')).toBeUndefined();
  });
});
