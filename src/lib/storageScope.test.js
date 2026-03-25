import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_SCOPE,
  STORAGE_KEYS,
  parsePendingSyncEntries,
  parseStoredMeta,
  readStoredJson,
  serializeMatchMeta,
  storageKey,
  storageScopeForUser,
} from './storageScope.js';

describe('storageScope helpers', () => {
  it('builds user-scoped and local storage keys correctly', () => {
    expect(storageScopeForUser({ id: 'abc' }, true)).toBe('user:abc');
    expect(storageScopeForUser(null, false)).toBe(LOCAL_STORAGE_SCOPE);
    expect(storageScopeForUser(null, true)).toBeNull();
    expect(storageKey(STORAGE_KEYS.events, LOCAL_STORAGE_SCOPE)).toBe('ko_events');
    expect(storageKey(STORAGE_KEYS.events, 'user:abc')).toBe('ko_events:user:abc');
  });

  it('reads stored JSON safely and reports corrupt data', () => {
    const storage = {
      getItem: vi
        .fn()
        .mockReturnValueOnce('{"ok":true}')
        .mockReturnValueOnce('{broken-json'),
    };
    const onCorrupt = vi.fn();

    expect(readStoredJson(STORAGE_KEYS.meta, {}, 'user:abc', { storage })).toEqual({ ok: true });
    expect(readStoredJson(STORAGE_KEYS.meta, { fallback: true }, 'user:abc', { storage, onCorrupt })).toEqual({ fallback: true });
    expect(onCorrupt).toHaveBeenCalledTimes(1);
  });

  it('normalizes stored match meta and pending sync payloads', () => {
    expect(parseStoredMeta({ team: 'Clontarf', opponent: 'Boden', match_date: '2026-03-25', period: 'H2', our_goal_at_top: false }, '2026-03-24')).toEqual({
      team: 'Clontarf',
      opponent: 'Boden',
      matchDate: '2026-03-25',
      period: 'H2',
      ourGoalAtTop: false,
    });

    expect(serializeMatchMeta({
      team: 'Clontarf',
      opponent: 'Boden',
      matchDate: '2026-03-25',
      period: 'H2',
      ourGoalAtTop: false,
    })).toEqual({
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-25',
      period: 'H2',
      our_goal_at_top: false,
    });

    expect(parsePendingSyncEntries(['one', 'two'])).toEqual([
      ['one', 'upsert'],
      ['two', 'upsert'],
    ]);
    expect(parsePendingSyncEntries([{ id: 'one', op: 'delete' }, { id: 'two', op: 'upsert' }])).toEqual([
      ['one', 'delete'],
      ['two', 'upsert'],
    ]);
  });
});
