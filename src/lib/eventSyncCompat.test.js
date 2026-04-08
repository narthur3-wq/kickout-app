import { describe, expect, it } from 'vitest';
import {
  describeEventSyncCompatibility,
  parseMissingEventSyncColumn,
  stripUnsupportedEventSyncColumns,
} from './eventSyncCompat.js';

describe('eventSyncCompat', () => {
  it('detects optional event columns missing from the Supabase schema cache', () => {
    expect(parseMissingEventSyncColumn({
      code: 'PGRST204',
      message: "Could not find the 'conversion_result' column of 'events' in the schema cache",
    })).toBe('conversion_result');

    expect(parseMissingEventSyncColumn({
      message: "Could not find the 'score_source' column of 'events' in the schema cache",
    })).toBe('score_source');

    expect(parseMissingEventSyncColumn({
      message: "Could not find the 'team_id' column of 'events' in the schema cache",
    })).toBeNull();
  });

  it('removes only the unsupported columns from an event payload', () => {
    const payload = stripUnsupportedEventSyncColumns({
      id: 'event-1',
      conversion_result: 'score',
      score_source: 'kickout',
      outcome: 'Goal',
    }, ['conversion_result']);

    expect(payload).toEqual({
      id: 'event-1',
      score_source: 'kickout',
      outcome: 'Goal',
    });
  });

  it('describes the degraded sync mode in plain language', () => {
    expect(describeEventSyncCompatibility(['conversion_result'])).toMatch(/conversion review/i);
    expect(describeEventSyncCompatibility(['conversion_result', 'score_source'])).toMatch(/score-source review/i);
  });
});
