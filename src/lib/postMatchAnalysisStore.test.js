import { describe, expect, it } from 'vitest';
import {
  createEmptyAnalysisState,
  deleteAnalysisSession,
  loadAnalysisState,
  normalizeAnalysisState,
  normalizeSquadPlayer,
  normalizePassSession,
  normalizePossessionSession,
  renameAnalysisPlayer,
  replaceAnalysisSession,
  saveAnalysisState,
  sessionsForPlayer,
} from './postMatchAnalysisStore.js';
import { LOCAL_STORAGE_SCOPE, STORAGE_KEYS, storageKey } from './storageScope.js';

function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    _data: data,
  };
}

describe('postMatchAnalysisStore', () => {
  it('loads and saves the shared analysis blob by scope', () => {
    const storage = makeStorage();
    const scope = LOCAL_STORAGE_SCOPE;
    const state = {
      version: 1,
      possessionSessions: [
        normalizePossessionSession({
          id: 'session-1',
          match_id: 'match-1',
          player_name: '  #11  ',
          our_goal_at_top: false,
          events: [
            {
              id: 'event-1',
              receive_x: 0.1,
              receive_y: 0.2,
              release_x: 0.2,
              release_y: 0.4,
              carry_waypoints: [{ x: 0.15, y: 0.28 }],
              target_x: 0.45,
              target_y: 0.52,
              outcome: 'Score',
              under_pressure: true,
            },
          ],
        }),
      ],
      passSessions: [
        normalizePassSession({
          id: 'session-2',
          match_id: 'match-1',
          player_name: '#7',
          events: [
            {
              id: 'pass-1',
              from_x: 0.4,
              from_y: 0.3,
              to_x: 0.6,
              to_y: 0.5,
              pass_type: 'handpass',
              completed: false,
            },
          ],
        }),
      ],
      squadPlayers: [
        normalizeSquadPlayer({ id: 'p1', name: 'Cian Murphy' }),
      ],
    };

    saveAnalysisState(state, scope, { storage });
    expect(storage.getItem(storageKey(STORAGE_KEYS.analysis, scope))).toBeTruthy();
    expect(loadAnalysisState(scope, { storage })).toEqual(normalizeAnalysisState(state));
  });

  it('replaces and deletes sessions immutably', () => {
    const base = createEmptyAnalysisState();
    const possessionSession = normalizePossessionSession({
      id: 'session-1',
      match_id: 'match-1',
      player_name: '#11',
      events: [],
    });
    const passSession = normalizePassSession({
      id: 'session-2',
      match_id: 'match-1',
      player_name: '#7',
      events: [],
    });

    const withPossession = replaceAnalysisSession(base, possessionSession);
    const withPass = replaceAnalysisSession(withPossession, passSession);

    expect(withPass.possessionSessions).toHaveLength(1);
    expect(withPass.passSessions).toHaveLength(1);
    expect(deleteAnalysisSession(withPass, 'possession', 'session-1').possessionSessions).toHaveLength(0);
    expect(deleteAnalysisSession(withPass, 'pass', 'session-2').passSessions).toHaveLength(0);
  });

  it('filters sessions for a player across matches', () => {
    const base = createEmptyAnalysisState();
    const withRoster = {
      ...base,
      squadPlayers: [normalizeSquadPlayer({ id: 'p1', name: 'Cian Murphy' })],
    };
    const sessionOne = normalizePossessionSession({
      id: 'session-1',
      match_id: 'match-1',
      player_name: 'Cian Murphy',
      events: [],
    });
    const sessionTwo = normalizePossessionSession({
      id: 'session-2',
      match_id: 'match-2',
      player_name: 'Cian Murphy',
      events: [],
    });
    const sessionThree = normalizePossessionSession({
      id: 'session-3',
      match_id: 'match-2',
      player_name: 'Orla',
      events: [],
    });
    const next = replaceAnalysisSession(
      replaceAnalysisSession(
        replaceAnalysisSession(withRoster, sessionOne),
        sessionTwo
      ),
      sessionThree
    );

    const allMatches = sessionsForPlayer(next, 'possession', 'squad:p1');
    const matchTwoOnly = sessionsForPlayer(next, 'possession', 'squad:p1', ['match-2']);

    expect(allMatches).toHaveLength(2);
    expect(matchTwoOnly).toHaveLength(1);
    expect(matchTwoOnly[0].id).toBe('session-2');
  });

  it('normalizes possession events with capped carry waypoints and nullable targets', () => {
    const session = normalizePossessionSession({
      id: 'session-1',
      player_name: '#11',
      events: [
        {
          id: 'event-1',
          receive_x: 0.1,
          receive_y: 0.2,
          release_x: 0.3,
          release_y: 0.4,
          carry_waypoints: [
            { x: 0.12, y: 0.24 },
            { x: 0.16, y: 0.28 },
            { x: 0.2, y: 0.32 },
            { x: 0.24, y: 0.36 },
          ],
          target_x: '',
          target_y: 0.7,
          outcome: 'Hand pass',
        },
      ],
    });

    expect(session.events[0].carry_waypoints).toEqual([
      { x: 0.12, y: 0.24 },
      { x: 0.16, y: 0.28 },
      { x: 0.2, y: 0.32 },
    ]);
    expect(session.events[0].target_x).toBeNull();
    expect(session.events[0].target_y).toBeNull();
  });

  it('renames legacy session names to a squad player across both analysis modes', () => {
    const base = {
      ...createEmptyAnalysisState(),
      squadPlayers: [normalizeSquadPlayer({ id: 'p1', name: 'Cian Murphy' })],
    };
    const possessionSession = normalizePossessionSession({
      id: 'session-1',
      match_id: 'match-1',
      player_name: '  Cian Murph  ',
      events: [],
    });
    const passSession = normalizePassSession({
      id: 'session-2',
      match_id: 'match-1',
      player_name: '  Cian Murph  ',
      events: [],
    });

    const next = replaceAnalysisSession(replaceAnalysisSession(base, possessionSession), passSession);
    const renamed = renameAnalysisPlayer(next, 'cian murph', { id: 'p1', name: 'Cian Murphy' });

    expect(renamed.possessionSessions[0].player_name).toBe('Cian Murphy');
    expect(renamed.passSessions[0].player_key).toBe('squad:p1');
    expect(sessionsForPlayer(renamed, 'pass', 'squad:p1')).toHaveLength(1);
  });
});
