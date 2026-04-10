import { describe, expect, it } from 'vitest';
import {
  describeAnalysisSyncCompatibility,
  parseMissingPossessionEventSyncColumn,
  stripUnsupportedPossessionEventSyncColumns,
} from './analysisSyncCompat.js';

describe('analysisSyncCompat', () => {
  it('detects optional possession-event columns missing from the Supabase schema cache', () => {
    expect(parseMissingPossessionEventSyncColumn({
      code: 'PGRST204',
      message: "Could not find the 'carry_waypoints' column of 'possession_events' in the schema cache",
    })).toBe('carry_waypoints');

    expect(parseMissingPossessionEventSyncColumn({
      message: "Could not find the 'target_x' column of 'possession_events' in the schema cache",
    })).toBe('target_x');

    expect(parseMissingPossessionEventSyncColumn({
      message: "Could not find the 'assist' column of 'possession_events' in the schema cache",
    })).toBeNull();
  });

  it('removes only the unsupported columns from a possession-event payload', () => {
    const payload = stripUnsupportedPossessionEventSyncColumns({
      id: 'event-1',
      carry_waypoints: [{ x: 0.15, y: 0.3 }],
      target_x: 0.55,
      target_y: 0.65,
      outcome: 'Hand pass',
    }, ['carry_waypoints', 'target_x']);

    expect(payload).toEqual({
      id: 'event-1',
      target_y: 0.65,
      outcome: 'Hand pass',
    });
  });

  it('describes the degraded analysis sync mode in plain language', () => {
    expect(describeAnalysisSyncCompatibility(['carry_waypoints'])).toMatch(/carry-path waypoints/i);
    expect(describeAnalysisSyncCompatibility(['carry_waypoints', 'target_x'])).toMatch(/ball destinations/i);
  });
});
