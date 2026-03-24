import { describe, expect, it } from 'vitest';
import { buildKickoutClockTrend, buildShotSummary, buildTurnoverSummary } from './analyticsHelpers.js';

describe('buildShotSummary', () => {
  it('separates goal and point attempts using shot_type', () => {
    const summary = buildShotSummary([
      { outcome: 'Goal', shot_type: 'goal' },
      { outcome: 'Point', shot_type: 'point' },
      { outcome: 'Wide', shot_type: 'goal' },
      { outcome: 'Blocked', shot_type: 'point' },
      { outcome: 'Saved', shot_type: 'goal' },
    ], 'shot');

    expect(summary).toMatchObject({
      total: 5,
      scored: 2,
      goalAttempts: 3,
      goals: 1,
      pointAttempts: 2,
      points: 1,
    });
  });
});

describe('buildTurnoverSummary', () => {
  it('counts won, lost, and net turnover outcomes', () => {
    const summary = buildTurnoverSummary([
      { outcome: 'Won' },
      { outcome: 'Retained' },
      { outcome: 'Lost' },
      { outcome: 'Lost' },
    ], 'turnover');

    expect(summary).toMatchObject({ total: 4, won: 2, lost: 2, net: 0 });
  });
});

describe('buildKickoutClockTrend', () => {
  it('only returns kickout retention windows', () => {
    expect(buildKickoutClockTrend([{ outcome: 'Goal', clock: '02:00' }], 'shot')).toEqual([]);

    const trend = buildKickoutClockTrend([
      { outcome: 'Retained', clock: '01:00' },
      { outcome: 'Lost', clock: '04:00' },
      { outcome: 'Won', clock: '12:00' },
      { outcome: 'Lost', clock: '18:00' },
    ], 'kickout');

    expect(trend).toEqual([
      { label: '0-10', tot: 2, pct: 50 },
      { label: '10-20', tot: 2, pct: 50 },
    ]);
  });
});
