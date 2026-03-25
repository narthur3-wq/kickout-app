import { describe, expect, it } from 'vitest';
import { buildLiveInsights } from './liveInsights.js';

function baseEvent(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    match_date: '2026-03-24',
    team: 'Clontarf',
    opponent: 'Vincents',
    period: 'H1',
    created_at: '2026-03-24T10:00:00.000Z',
    event_type: 'kickout',
    direction: 'ours',
    outcome: 'Retained',
    contest_type: 'clean',
    side_band: 'Centre',
    depth_band: 'Medium',
    target_player: '',
    ...overrides,
  };
}

describe('buildLiveInsights', () => {
  it('captures recent score and kickout momentum swings', () => {
    const events = [
      baseEvent({ id: 'k1', ko_sequence: 1, created_at: '2026-03-24T10:00:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 'k2', ko_sequence: 2, created_at: '2026-03-24T10:01:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 'k3', ko_sequence: 3, created_at: '2026-03-24T10:02:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 'k4', ko_sequence: 4, created_at: '2026-03-24T10:03:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 's1', ko_sequence: 5, created_at: '2026-03-24T10:04:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Point' }),
      baseEvent({ id: 's2', ko_sequence: 6, created_at: '2026-03-24T10:05:00.000Z', event_type: 'shot', direction: 'theirs', outcome: 'Point' }),
      baseEvent({ id: 's3', ko_sequence: 7, created_at: '2026-03-24T10:06:00.000Z', event_type: 'shot', direction: 'theirs', outcome: 'Point' }),
      baseEvent({ id: 's4', ko_sequence: 8, created_at: '2026-03-24T10:07:00.000Z', event_type: 'shot', direction: 'theirs', outcome: 'Point' }),
    ];

    const insights = buildLiveInsights(events);

    expect(insights.kickoutMomentum.line).toBe('They have won the last 4 kickout battles.');
    expect(insights.scoreMomentum.line).toBe('They have the last 3 scores.');
  });

  it('finds clear threats, kickout patterns, and actions', () => {
    const events = [
      baseEvent({ id: 'k1', ko_sequence: 1, created_at: '2026-03-24T10:00:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'k2', ko_sequence: 2, created_at: '2026-03-24T10:01:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'k3', ko_sequence: 3, created_at: '2026-03-24T10:02:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'k4', ko_sequence: 4, created_at: '2026-03-24T10:03:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'k5', ko_sequence: 5, created_at: '2026-03-24T10:04:00.000Z', direction: 'theirs', outcome: 'Lost', target_player: '11', side_band: 'Left', depth_band: 'Medium' }),
      baseEvent({ id: 'o1', ko_sequence: 6, created_at: '2026-03-24T10:05:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 'o2', ko_sequence: 7, created_at: '2026-03-24T10:06:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 'o3', ko_sequence: 8, created_at: '2026-03-24T10:07:00.000Z', direction: 'ours', outcome: 'Lost', side_band: 'Left', depth_band: 'Short' }),
      baseEvent({ id: 'o4', ko_sequence: 9, created_at: '2026-03-24T10:08:00.000Z', direction: 'ours', outcome: 'Retained', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'o5', ko_sequence: 10, created_at: '2026-03-24T10:09:00.000Z', direction: 'ours', outcome: 'Retained', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'o6', ko_sequence: 11, created_at: '2026-03-24T10:10:00.000Z', direction: 'ours', outcome: 'Retained', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 't1', ko_sequence: 12, created_at: '2026-03-24T10:11:00.000Z', event_type: 'shot', direction: 'theirs', outcome: 'Point', target_player: '11', side_band: 'Left' }),
      baseEvent({ id: 't2', ko_sequence: 13, created_at: '2026-03-24T10:12:00.000Z', event_type: 'shot', direction: 'theirs', outcome: 'Goal', target_player: '11', side_band: 'Left' }),
      baseEvent({ id: 't3', ko_sequence: 14, created_at: '2026-03-24T10:13:00.000Z', event_type: 'shot', direction: 'theirs', outcome: 'Point', target_player: '14', side_band: 'Left' }),
      baseEvent({ id: 'a1', ko_sequence: 15, created_at: '2026-03-24T10:14:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Point', side_band: 'Right' }),
      baseEvent({ id: 'a2', ko_sequence: 16, created_at: '2026-03-24T10:15:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Point', side_band: 'Right' }),
      baseEvent({ id: 'a3', ko_sequence: 17, created_at: '2026-03-24T10:16:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Goal', side_band: 'Right' }),
    ];

    const insights = buildLiveInsights(events);

    expect(insights.kickoutPattern.primaryTarget?.label).toBe('#8');
    expect(insights.kickoutPattern.primaryWinner?.label).toBe('#8');
    expect(insights.kickoutPerformance.worstLane?.label).toBe('left-short');
    expect(insights.kickoutPerformance.bestLane?.label).toBe('right-medium');
    expect(insights.threat.mainThreat?.label).toBe('#11');
    expect(insights.opportunity.bestSide?.label).toBe('right channel');
    expect(insights.recommendations.map((item) => item.type)).toContain('tight_mark_player');
    expect(insights.recommendations.map((item) => item.type)).toContain('press_kickout_target');
    expect(insights.recommendations.map((item) => item.type)).toContain('avoid_restart_lane');
  });

  it('softens flow narration when clock data is missing', () => {
    const events = [
      baseEvent({ id: 's1', ko_sequence: 1, created_at: '2026-03-24T10:00:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Point' }),
      baseEvent({ id: 's2', ko_sequence: 2, created_at: '2026-03-24T10:01:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Goal' }),
      baseEvent({ id: 's3', ko_sequence: 3, created_at: '2026-03-24T10:02:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Point' }),
      baseEvent({ id: 'k1', ko_sequence: 4, created_at: '2026-03-24T10:03:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'k2', ko_sequence: 5, created_at: '2026-03-24T10:04:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
      baseEvent({ id: 'k3', ko_sequence: 6, created_at: '2026-03-24T10:05:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium' }),
    ];

    const insights = buildLiveInsights(events);

    expect(insights.flow.hasClockConfidence).toBe(false);
    expect(insights.flow.lines[0]).not.toContain('early');
    expect(insights.flow.lines[0]).not.toContain('late');
  });

  it('uses event time, not event density, to describe the flow and prioritises kickout lines for coaches', () => {
    const events = [
      baseEvent({ id: 's1', ko_sequence: 1, created_at: '2026-03-24T10:00:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Point', clock: '02:00' }),
      baseEvent({ id: 's2', ko_sequence: 2, created_at: '2026-03-24T10:01:00.000Z', event_type: 'shot', direction: 'ours', outcome: 'Goal', clock: '04:00' }),
      baseEvent({ id: 'k1', ko_sequence: 3, created_at: '2026-03-24T10:18:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium', clock: '18:00' }),
      baseEvent({ id: 'k2', ko_sequence: 4, created_at: '2026-03-24T10:22:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium', clock: '22:00' }),
      baseEvent({ id: 'k3', ko_sequence: 5, created_at: '2026-03-24T10:27:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium', clock: '27:00' }),
      baseEvent({ id: 'k4', ko_sequence: 6, created_at: '2026-03-24T10:31:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium', clock: '31:00' }),
      baseEvent({ id: 'k5', ko_sequence: 7, created_at: '2026-03-24T10:33:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium', clock: '33:00' }),
      baseEvent({ id: 'k6', ko_sequence: 8, created_at: '2026-03-24T10:35:00.000Z', direction: 'theirs', outcome: 'Won', target_player: '8', side_band: 'Right', depth_band: 'Medium', clock: '35:00' }),
    ];

    const insights = buildLiveInsights(events);

    expect(insights.flow.lines[0]).toContain('late');
    expect(insights.flow.coachLines[0]).toContain('kickout');
    expect(insights.flow.hasClockConfidence).toBe(true);
  });
});
