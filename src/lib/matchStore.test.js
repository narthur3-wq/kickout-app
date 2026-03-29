import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MATCH_KEYS,
  closeMatch,
  clearMatchStorage,
  createMatch,
  inferredMatchKey,
  loadActiveMatchId,
  loadMatches,
  migrateEventsToMatches,
  reopenMatch,
  saveActiveMatchId,
  saveMatches,
  touchMatchLastEvent,
  updateMatchFields,
} from './matchStore.js';
import { storageKey, LOCAL_STORAGE_SCOPE } from './storageScope.js';

// ── Minimal localStorage stub ─────────────────────────────────────────────────
function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
    _data: data,
  };
}

// ── inferredMatchKey ──────────────────────────────────────────────────────────
describe('inferredMatchKey', () => {
  it('builds key from match_date, team, opponent', () => {
    expect(inferredMatchKey({ match_date: '2026-05-10', team: 'Clontarf', opponent: 'Crokes' }))
      .toBe('2026-05-10|clontarf|crokes');
  });

  it('trims and lowercases', () => {
    expect(inferredMatchKey({ match_date: '2026-05-10', team: '  Clontarf  ', opponent: ' Crokes ' }))
      .toBe('2026-05-10|clontarf|crokes');
  });

  it('falls back to created_at date when match_date is absent', () => {
    expect(inferredMatchKey({ created_at: '2026-05-10T12:00:00Z', team: 'Clontarf', opponent: 'Crokes' }))
      .toBe('2026-05-10|clontarf|crokes');
  });
});

// ── createMatch ───────────────────────────────────────────────────────────────
describe('createMatch', () => {
  it('creates a valid open match with a uuid', () => {
    const m = createMatch({ team: 'Clontarf', opponent: 'Crokes', match_date: '2026-05-10' });
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.status).toBe('open');
    expect(m.team).toBe('Clontarf');
    expect(m.opponent).toBe('Crokes');
    expect(m.match_date).toBe('2026-05-10');
    expect(m.team_id).toBeNull();
    expect(m.closed_at).toBeNull();
    expect(m.last_event_at).toBeNull();
    expect(m.created_at).toBeTruthy();
    expect(m.updated_at).toBeTruthy();
  });

  it('trims whitespace from team and opponent', () => {
    const m = createMatch({ team: '  Clontarf  ', opponent: '  Crokes  ', match_date: '2026-05-10' });
    expect(m.team).toBe('Clontarf');
    expect(m.opponent).toBe('Crokes');
  });

  it('accepts team_id and created_by', () => {
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01', team_id: 'tid', created_by: 'uid' });
    expect(m.team_id).toBe('tid');
    expect(m.created_by).toBe('uid');
  });
});

// ── closeMatch / reopenMatch ──────────────────────────────────────────────────
describe('closeMatch / reopenMatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closeMatch sets status closed and records closed_at', () => {
    vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    vi.setSystemTime(new Date('2026-05-10T10:00:01Z'));
    const closed = closeMatch(m);
    expect(closed.status).toBe('closed');
    expect(closed.closed_at).toBeTruthy();
    expect(closed.updated_at).not.toBe(m.updated_at);
    // original unchanged
    expect(m.status).toBe('open');
  });

  it('reopenMatch resets status and clears closed_at', () => {
    const m = closeMatch(createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' }));
    const reopened = reopenMatch(m);
    expect(reopened.status).toBe('open');
    expect(reopened.closed_at).toBeNull();
    expect(reopened.updated_at).toBeTruthy();
  });
});

// ── updateMatchFields ─────────────────────────────────────────────────────────
describe('updateMatchFields', () => {
  it('updates only the provided fields', () => {
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    const updated = updateMatchFields(m, { team: 'Clontarf' });
    expect(updated.team).toBe('Clontarf');
    expect(updated.opponent).toBe('B');
    expect(updated.match_date).toBe('2026-01-01');
    expect(updated.updated_at).toBeTruthy();
  });

  it('trims team and opponent', () => {
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    const updated = updateMatchFields(m, { team: '  Clontarf  ', opponent: '  Crokes  ' });
    expect(updated.team).toBe('Clontarf');
    expect(updated.opponent).toBe('Crokes');
  });
});

// ── touchMatchLastEvent ───────────────────────────────────────────────────────
describe('touchMatchLastEvent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('updates last_event_at and updated_at', () => {
    vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    vi.setSystemTime(new Date('2026-05-10T10:00:01Z'));
    const touched = touchMatchLastEvent(m);
    expect(touched.last_event_at).toBeTruthy();
    expect(touched.updated_at).not.toBe(m.updated_at);
  });
});

// ── loadMatches / saveMatches ─────────────────────────────────────────────────
describe('loadMatches / saveMatches', () => {
  it('returns empty array when nothing stored', () => {
    const storage = makeStorage();
    expect(loadMatches(LOCAL_STORAGE_SCOPE, { storage })).toEqual([]);
  });

  it('round-trips matches through storage', () => {
    const storage = makeStorage();
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    saveMatches([m], LOCAL_STORAGE_SCOPE, { storage });
    expect(loadMatches(LOCAL_STORAGE_SCOPE, { storage })).toEqual([m]);
  });

  it('uses scoped keys for non-local scope', () => {
    const storage = makeStorage();
    const m = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    saveMatches([m], 'user:abc', { storage });
    expect(storage._data.has('ko_matches:user:abc')).toBe(true);
    expect(storage._data.has('ko_matches')).toBe(false);
  });

  it('returns empty array on corrupt data', () => {
    const storage = makeStorage({ ko_matches: 'not-json' });
    expect(loadMatches(LOCAL_STORAGE_SCOPE, { storage })).toEqual([]);
  });

  it('returns empty array on non-array data', () => {
    const storage = makeStorage({ ko_matches: '{"id":"x"}' });
    expect(loadMatches(LOCAL_STORAGE_SCOPE, { storage })).toEqual([]);
  });
});

// ── loadActiveMatchId / saveActiveMatchId ─────────────────────────────────────
describe('loadActiveMatchId / saveActiveMatchId', () => {
  it('returns null when nothing stored', () => {
    const storage = makeStorage();
    expect(loadActiveMatchId(LOCAL_STORAGE_SCOPE, { storage })).toBeNull();
  });

  it('round-trips activeMatchId', () => {
    const storage = makeStorage();
    saveActiveMatchId('match-1', LOCAL_STORAGE_SCOPE, { storage });
    expect(loadActiveMatchId(LOCAL_STORAGE_SCOPE, { storage })).toBe('match-1');
  });

  it('removes key when id is null/falsy', () => {
    const storage = makeStorage({ ko_active_match_id: 'match-1' });
    saveActiveMatchId(null, LOCAL_STORAGE_SCOPE, { storage });
    expect(storage._data.has('ko_active_match_id')).toBe(false);
  });
});

// ── clearMatchStorage ─────────────────────────────────────────────────────────
describe('clearMatchStorage', () => {
  it('removes both keys for the scope', () => {
    const storage = makeStorage({
      ko_matches: '[{"id":"x"}]',
      ko_active_match_id: 'x',
    });
    clearMatchStorage(LOCAL_STORAGE_SCOPE, { storage });
    expect(storage._data.has('ko_matches')).toBe(false);
    expect(storage._data.has('ko_active_match_id')).toBe(false);
  });

  it('uses scoped keys', () => {
    const storage = makeStorage({
      'ko_matches:user:abc': '[{"id":"x"}]',
      'ko_active_match_id:user:abc': 'x',
    });
    clearMatchStorage('user:abc', { storage });
    expect(storage._data.has('ko_matches:user:abc')).toBe(false);
    expect(storage._data.has('ko_active_match_id:user:abc')).toBe(false);
  });
});

// ── migrateEventsToMatches ────────────────────────────────────────────────────
describe('migrateEventsToMatches', () => {
  it('is a no-op when matches already exist', () => {
    const storage = makeStorage();
    const existingMatch = createMatch({ team: 'A', opponent: 'B', match_date: '2026-01-01' });
    saveMatches([existingMatch], LOCAL_STORAGE_SCOPE, { storage });
    saveActiveMatchId(existingMatch.id, LOCAL_STORAGE_SCOPE, { storage });

    const events = [{ id: 'e1', team: 'A', opponent: 'B', match_date: '2026-01-01', outcome: 'Retained', x: 0.5, y: 0.5 }];
    const result = migrateEventsToMatches(events, LOCAL_STORAGE_SCOPE, { storage });

    expect(result.migrated).toBe(false);
    expect(result.matches).toEqual([existingMatch]);
    expect(result.updatedEvents).toBe(events); // same reference — no change
    expect(result.activeMatchId).toBe(existingMatch.id);
  });

  it('is a no-op when there are no events', () => {
    const storage = makeStorage();
    const result = migrateEventsToMatches([], LOCAL_STORAGE_SCOPE, { storage });
    expect(result.migrated).toBe(false);
    expect(result.matches).toEqual([]);
    expect(result.activeMatchId).toBeNull();
  });

  it('creates one match per inferred key and assigns match_id to events', () => {
    const storage = makeStorage();
    const events = [
      { id: 'e1', team: 'Clontarf', opponent: 'Crokes', match_date: '2026-05-10', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-05-10T10:00:00Z' },
      { id: 'e2', team: 'Clontarf', opponent: 'Crokes', match_date: '2026-05-10', outcome: 'Lost',     x: 0.3, y: 0.3, created_at: '2026-05-10T10:05:00Z' },
      { id: 'e3', team: 'Clontarf', opponent: 'Na Fianna', match_date: '2026-04-20', outcome: 'Score',  x: 0.6, y: 0.6, created_at: '2026-04-20T14:00:00Z' },
    ];

    const result = migrateEventsToMatches(events, LOCAL_STORAGE_SCOPE, { storage });

    expect(result.migrated).toBe(true);
    expect(result.matches).toHaveLength(2);

    const matchIds = new Set(result.matches.map((m) => m.id));
    for (const ev of result.updatedEvents) {
      expect(ev.match_id).toBeTruthy();
      expect(matchIds.has(ev.match_id)).toBe(true);
    }

    // e1 and e2 should share the same match
    expect(result.updatedEvents[0].match_id).toBe(result.updatedEvents[1].match_id);
    // e3 should be on a different match
    expect(result.updatedEvents[2].match_id).not.toBe(result.updatedEvents[0].match_id);
  });

  it('picks the most recently active match as activeMatchId', () => {
    const storage = makeStorage();
    const events = [
      { id: 'e1', team: 'A', opponent: 'B', match_date: '2026-04-01', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-04-01T10:00:00Z' },
      { id: 'e2', team: 'A', opponent: 'C', match_date: '2026-05-10', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-05-10T12:00:00Z' },
    ];

    const result = migrateEventsToMatches(events, LOCAL_STORAGE_SCOPE, { storage });

    // The May match has the later created_at so should be activeMatchId
    const mayMatch = result.matches.find((m) => m.opponent === 'C');
    expect(result.activeMatchId).toBe(mayMatch.id);
  });

  it('persists matches and activeMatchId to storage', () => {
    const storage = makeStorage();
    const events = [
      { id: 'e1', team: 'A', opponent: 'B', match_date: '2026-05-10', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-05-10T10:00:00Z' },
    ];

    const result = migrateEventsToMatches(events, LOCAL_STORAGE_SCOPE, { storage });

    expect(loadMatches(LOCAL_STORAGE_SCOPE, { storage })).toEqual(result.matches);
    expect(loadActiveMatchId(LOCAL_STORAGE_SCOPE, { storage })).toBe(result.activeMatchId);
  });

  it('does not overwrite match_id if event already has one', () => {
    const storage = makeStorage();
    const events = [
      { id: 'e1', team: 'A', opponent: 'B', match_date: '2026-05-10', match_id: 'existing-id', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-05-10T10:00:00Z' },
    ];

    const result = migrateEventsToMatches(events, LOCAL_STORAGE_SCOPE, { storage });
    expect(result.updatedEvents[0].match_id).toBe('existing-id');
  });

  it('sets correct match metadata (team, opponent, date, last_event_at)', () => {
    const storage = makeStorage();
    const events = [
      { id: 'e1', team: 'Clontarf', opponent: 'Crokes', match_date: '2026-05-10', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-05-10T10:00:00Z' },
      { id: 'e2', team: 'Clontarf', opponent: 'Crokes', match_date: '2026-05-10', outcome: 'Lost',     x: 0.3, y: 0.3, created_at: '2026-05-10T10:30:00Z' },
    ];

    const result = migrateEventsToMatches(events, LOCAL_STORAGE_SCOPE, { storage });
    const match = result.matches[0];

    expect(match.team).toBe('Clontarf');
    expect(match.opponent).toBe('Crokes');
    expect(match.match_date).toBe('2026-05-10');
    expect(match.last_event_at).toBe('2026-05-10T10:30:00Z'); // latest event
    expect(match.status).toBe('open');
  });

  it('uses scoped storage keys for user scope', () => {
    const storage = makeStorage();
    const events = [
      { id: 'e1', team: 'A', opponent: 'B', match_date: '2026-05-10', outcome: 'Retained', x: 0.5, y: 0.5, created_at: '2026-05-10T10:00:00Z' },
    ];

    migrateEventsToMatches(events, 'user:abc', { storage });

    expect(storage._data.has('ko_matches:user:abc')).toBe(true);
    expect(storage._data.has('ko_active_match_id:user:abc')).toBe(true);
    expect(storage._data.has('ko_matches')).toBe(false);
  });
});
