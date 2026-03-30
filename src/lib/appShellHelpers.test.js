import { describe, expect, it } from 'vitest';
import {
  analyticsMarkerFill,
  analyticsMarkerRing,
  analyticsMarkerShape,
  buildCurrentMatchScore,
  eventYearOf,
  matchKeyOf,
  normText,
  scoreOutcomeOf,
} from './appShellHelpers.js';

describe('appShellHelpers', () => {
  it('normalizes text and match keys consistently', () => {
    expect(normText(' Clontarf ')).toBe('clontarf');
    expect(matchKeyOf({
      match_date: '2026-03-29',
      team: ' Clontarf ',
      opponent: ' Crokes ',
    })).toBe('2026-03-29|clontarf|crokes');
    expect(eventYearOf({ created_at: '2026-03-29T12:00:00Z' })).toBe('2026');
  });

  it('normalizes outcomes and builds current match scores', () => {
    const currentKey = '2026-03-29|clontarf|crokes';
    const result = buildCurrentMatchScore([
      { id: '1', match_date: '2026-03-29', team: 'Clontarf', opponent: 'Crokes', event_type: 'shot', direction: 'ours', outcome: 'goal' },
      { id: '2', match_date: '2026-03-29', team: 'Clontarf', opponent: 'Crokes', event_type: 'shot', direction: 'ours', outcome: 'Point' },
      { id: '3', match_date: '2026-03-29', team: 'Clontarf', opponent: 'Crokes', event_type: 'shot', direction: 'theirs', outcome: 'POINT' },
      { id: '4', match_date: '2026-03-29', team: 'Clontarf', opponent: 'Crokes', event_type: 'kickout', direction: 'ours', outcome: 'Retained' },
    ], currentKey);

    expect(scoreOutcomeOf({ outcome: ' Goal ' })).toBe('goal');
    expect(result.hasShots).toBe(true);
    expect(result.us.str).toBe('1-1');
    expect(result.them.str).toBe('0-1');
  });

  it('filters by match_id when activeMatchId is provided, excluding shots from other matches with the same logical key', () => {
    const currentKey = '2026-04-05|clontarf|vincents';
    const events = [
      // Active match — should count.
      { id: 'a1', match_id: 'active-match', match_date: '2026-04-05', team: 'Clontarf', opponent: 'Vincents', event_type: 'shot', direction: 'ours', outcome: 'goal' },
      // Different match record, same logical key — must NOT bleed in.
      { id: 'b1', match_id: 'other-match', match_date: '2026-04-05', team: 'Clontarf', opponent: 'Vincents', event_type: 'shot', direction: 'ours', outcome: 'Point' },
      // Legacy event (no match_id) for same logical key — included as fallback.
      { id: 'c1', match_date: '2026-04-05', team: 'Clontarf', opponent: 'Vincents', event_type: 'shot', direction: 'theirs', outcome: 'Point' },
    ];

    const result = buildCurrentMatchScore(events, currentKey, 'active-match');

    expect(result.us.str).toBe('1-0');  // only the goal from active-match
    expect(result.them.str).toBe('0-1'); // legacy fallback event counts for theirs
    expect(result.hasShots).toBe(true);
  });

  it('falls back to logical key when no activeMatchId is passed', () => {
    const currentKey = '2026-04-05|clontarf|vincents';
    const events = [
      { id: 'x1', match_id: 'some-match', match_date: '2026-04-05', team: 'Clontarf', opponent: 'Vincents', event_type: 'shot', direction: 'ours', outcome: 'Point' },
    ];
    const result = buildCurrentMatchScore(events, currentKey);
    expect(result.us.str).toBe('0-1');
  });

  it('maps marker visuals from event semantics', () => {
    expect(analyticsMarkerShape({ direction: 'ours' })).toBe('circle');
    expect(analyticsMarkerShape({ direction: 'theirs' })).toBe('square');

    expect(analyticsMarkerFill({ event_type: 'kickout', outcome: 'Retained' })).toBe('#16a34a');
    expect(analyticsMarkerFill({ event_type: 'turnover', outcome: 'Lost' })).toBe('#dc2626');
    expect(analyticsMarkerFill({ event_type: 'shot', outcome: 'Saved' })).toBe('#64748b');

    expect(analyticsMarkerRing({ event_type: 'kickout', target_player: '8' })).toBe('target');
    expect(analyticsMarkerRing({ event_type: 'shot', shot_type: 'goal' })).toBe('goal-attempt');
    expect(analyticsMarkerRing({ event_type: 'turnover' })).toBe(null);
  });
});
