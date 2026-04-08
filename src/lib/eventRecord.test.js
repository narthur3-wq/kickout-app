import { describe, expect, it } from 'vitest';
import { CURRENT_EVENT_SCHEMA_VERSION, normalizeEventRecord } from './eventRecord.js';

describe('normalizeEventRecord', () => {
  it('adds current defaults for older kickout records before sync', () => {
    const record = normalizeEventRecord(
      {
        id: 'legacy-1',
        outcome: 'Retained',
        x: 0.25,
        y: 0.4,
        event_type: 'Kickout',
        direction: 'Theirs',
        contest_type: 'Clean',
        period: 'h2',
        schema_version: null,
        team_id: null,
      },
      { teamIdFallback: 'team-123' }
    );

    expect(record.team_id).toBe('team-123');
    expect(record.event_type).toBe('kickout');
    expect(record.direction).toBe('theirs');
    expect(record.contest_type).toBe('clean');
    expect(record.period).toBe('H2');
    expect(record.restart_reason).toBeNull();
    expect(record.conversion_result).toBe('unreviewed');
    expect(record.score_source).toBeNull();
    expect(record.schema_version).toBe(CURRENT_EVENT_SCHEMA_VERSION);
    expect(record.shot_type).toBeNull();
  });

  it('drops kickout-only fields for non-break and non-kickout records', () => {
    const shot = normalizeEventRecord({
      id: 'shot-1',
      outcome: 'Wide',
      x: 0.6,
      y: 0.2,
      event_type: 'Shot',
      direction: 'OURS',
      contest_type: 'BREAK',
      pickup_x: 0.4,
      break_outcome: 'Won',
      shot_type: 'GOAL',
    });

    expect(shot.event_type).toBe('shot');
    expect(shot.direction).toBe('ours');
    expect(shot.contest_type).toBeNull();
    expect(shot.break_outcome).toBeNull();
    expect(shot.pickup_x).toBeNull();
    expect(shot.shot_type).toBe('goal');
    expect(shot.conversion_result).toBeNull();
    expect(shot.score_source).toBeNull();
    expect(shot.schema_version).toBe(CURRENT_EVENT_SCHEMA_VERSION);
  });

  it('keeps score source only on scored shot outcomes', () => {
    const scoredShot = normalizeEventRecord({
      id: 'shot-2',
      outcome: 'Goal',
      x: 0.5,
      y: 0.5,
      event_type: 'Shot',
      score_source: 'kickout',
    });

    const missedShot = normalizeEventRecord({
      id: 'shot-3',
      outcome: 'Wide',
      x: 0.5,
      y: 0.5,
      event_type: 'Shot',
      score_source: 'kickout',
    });

    expect(scoredShot.score_source).toBe('kickout');
    expect(missedShot.score_source).toBeNull();
  });
});
