import { describe, expect, it } from 'vitest';
import {
  advanceSyncCursor,
  clearSyncCursor,
  loadSyncCursor,
  mergeRowsById,
  saveSyncCursor,
} from './syncState.js';

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    _values: values,
  };
}

describe('syncState helpers', () => {
  it('round-trips the sync cursor through storage', () => {
    const storage = makeStorage();

    saveSyncCursor({ matches: '2026-03-25T12:00:00.000Z', events: '2026-03-25T12:01:00.000Z' }, 'user:abc', { storage });

    expect(loadSyncCursor('user:abc', { storage })).toEqual({
      matches: '2026-03-25T12:00:00.000Z',
      events: '2026-03-25T12:01:00.000Z',
    });
  });

  it('advances the cursor from the latest match and event timestamps', () => {
    const next = advanceSyncCursor(
      { matches: '2026-03-25T11:00:00.000Z', events: '2026-03-25T11:05:00.000Z' },
      {
        matches: [{ updated_at: '2026-03-25T12:00:00.000Z' }],
        events: [{ created_at: '2026-03-25T12:10:00.000Z' }],
      }
    );

    expect(next).toEqual({
      matches: '2026-03-25T12:00:00.000Z',
      events: '2026-03-25T12:10:00.000Z',
    });
  });

  it('does not move the cursor backwards when a reconciliation snapshot is older', () => {
    const next = advanceSyncCursor(
      { matches: '2026-03-25T13:00:00.000Z', events: '2026-03-25T13:05:00.000Z' },
      {
        matches: [{ updated_at: '2026-03-25T12:00:00.000Z' }],
        events: [{ created_at: '2026-03-25T12:10:00.000Z' }],
      }
    );

    expect(next).toEqual({
      matches: '2026-03-25T13:00:00.000Z',
      events: '2026-03-25T13:05:00.000Z',
    });
  });

  it('merges remote rows by id without disturbing pending rows', () => {
    const merged = mergeRowsById(
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
      ],
      [
        { id: 'b', value: 20 },
        { id: 'c', value: 3 },
      ],
      { pendingIds: new Set(['c']) }
    );

    expect(merged).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 20 },
    ]);
  });

  it('clears the stored cursor', () => {
    const storage = makeStorage({
      'ko_sync_cursor:user:abc': '{"matches":"x","events":"y"}',
    });

    clearSyncCursor('user:abc', { storage });

    expect(storage._values.has('ko_sync_cursor:user:abc')).toBe(false);
  });
});
