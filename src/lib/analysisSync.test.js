import { describe, expect, it } from 'vitest';
import {
  analysisDeleteEntriesFromStates,
  analysisStateFromSupabaseRows,
  analysisStateToSupabaseRows,
} from './analysisSync.js';
import {
  createEmptyAnalysisState,
  normalizePassSession,
  normalizePossessionSession,
  normalizeSquadPlayer,
} from './postMatchAnalysisStore.js';

describe('analysisSync helpers', () => {
  it('round-trips analysis state to Supabase rows and back', () => {
    const state = {
      ...createEmptyAnalysisState(),
      squadPlayers: [normalizeSquadPlayer({ id: 'p1', name: 'Cian Murphy' })],
      possessionSessions: [
        normalizePossessionSession({
          id: 'pos-1',
          match_id: 'match-1',
          squad_player_id: 'p1',
          player_name: 'Cian Murphy',
          our_goal_at_top: false,
          events: [
            {
              id: 'pos-ev-1',
              receive_x: 0.1,
              receive_y: 0.2,
              release_x: 0.3,
              release_y: 0.4,
              outcome: 'Score point',
              under_pressure: true,
            },
          ],
        }),
      ],
      passSessions: [
        normalizePassSession({
          id: 'pass-1',
          match_id: 'match-1',
          squad_player_id: 'p1',
          player_name: 'Cian Murphy',
          our_goal_at_top: true,
          events: [
            {
              id: 'pass-ev-1',
              from_x: 0.3,
              from_y: 0.4,
              to_x: 0.5,
              to_y: 0.7,
              pass_type: 'Kickpass',
              completed: false,
            },
          ],
        }),
      ],
    };

    const rows = analysisStateToSupabaseRows(state, 'team-1');
    const roundTripped = analysisStateFromSupabaseRows(rows);

    expect(rows.squadPlayers).toHaveLength(1);
    expect(rows.possessionSessions).toHaveLength(1);
    expect(rows.possessionEvents).toHaveLength(1);
    expect(rows.passSessions).toHaveLength(1);
    expect(rows.passEvents).toHaveLength(1);
    expect(roundTripped).toEqual(expect.objectContaining({
      squadPlayers: expect.arrayContaining([
        expect.objectContaining({ id: 'p1', name: 'Cian Murphy' }),
      ]),
      possessionSessions: expect.arrayContaining([
        expect.objectContaining({ id: 'pos-1', player_name: 'Cian Murphy', squad_player_id: 'p1' }),
      ]),
      passSessions: expect.arrayContaining([
        expect.objectContaining({ id: 'pass-1', player_name: 'Cian Murphy', squad_player_id: 'p1' }),
      ]),
    }));
  });

  it('flags deleted sessions as tombstones', () => {
    const previous = {
      ...createEmptyAnalysisState(),
      possessionSessions: [normalizePossessionSession({ id: 'pos-1', player_name: 'Cian', events: [] })],
      passSessions: [normalizePassSession({ id: 'pass-1', player_name: 'Cian', events: [] })],
    };
    const next = {
      ...previous,
      possessionSessions: [],
    };

    expect(analysisDeleteEntriesFromStates(previous, next)).toEqual([
      { mode: 'possession', id: 'pos-1' },
    ]);
  });
});
