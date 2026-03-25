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
        event_type: 'kickout',
        contest_type: 'clean',
        schema_version: null,
        team_id: null,
      },
      { teamIdFallback: 'team-123' }
    );

    expect(record.team_id).toBe('team-123');
    expect(record.direction).toBe('ours');
    expect(record.restart_reason).toBeNull();
    expect(record.schema_version).toBe(CURRENT_EVENT_SCHEMA_VERSION);
    expect(record.shot_type).toBeNull();
  });

  it('drops kickout-only fields for non-break and non-kickout records', () => {
    const shot = normalizeEventRecord({
      id: 'shot-1',
      outcome: 'Wide',
      x: 0.6,
      y: 0.2,
      event_type: 'shot',
      contest_type: 'break',
      pickup_x: 0.4,
      break_outcome: 'won',
      shot_type: '',
    });

    expect(shot.contest_type).toBeNull();
    expect(shot.break_outcome).toBeNull();
    expect(shot.pickup_x).toBeNull();
    expect(shot.shot_type).toBe('point');
    expect(shot.schema_version).toBe(CURRENT_EVENT_SCHEMA_VERSION);
  });
});
