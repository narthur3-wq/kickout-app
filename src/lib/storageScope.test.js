import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_SCOPE,
  STORAGE_KEYS,
  migrateLocalScopeToUserScope,
  parsePendingSyncEntries,
  parseStoredMeta,
  readScopeSnapshot,
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

  it('migrates legacy local data into the first user scope without dropping events', () => {
    const storage = {
      values: new Map([
        ['ko_events', JSON.stringify([{ id: 'local-1', outcome: 'Retained' }])],
        ['ko_meta', JSON.stringify({ team: 'Clontarf', opponent: 'Boden', match_date: '2026-03-25', period: 'H1', our_goal_at_top: true })],
        ['ko_sync_queue', JSON.stringify([{ id: 'local-1', op: 'upsert' }])],
      ]),
      getItem(key) { return this.values.get(key) ?? null; },
      setItem(key, value) { this.values.set(key, value); },
      removeItem(key) { this.values.delete(key); },
    };

    const result = migrateLocalScopeToUserScope('user:abc', { storage });

    expect(result).toEqual({ migrated: true, eventCount: 1, reason: 'migrated' });
    expect(readScopeSnapshot('user:abc', { storage })).toEqual({
      events: [{ id: 'local-1', outcome: 'Retained' }],
      meta: {
        team: 'Clontarf',
        opponent: 'Boden',
        match_date: '2026-03-25',
        period: 'H1',
        our_goal_at_top: true,
      },
      pendingSync: [['local-1', 'upsert']],
    });
    expect(storage.getItem('ko_events')).toBeNull();
    expect(storage.getItem('ko_meta')).toBeNull();
    expect(storage.getItem('ko_sync_queue')).toBeNull();
  });

  it('merges local data into an existing user scope without dropping newer scoped records', () => {
    const storage = {
      values: new Map([
        ['ko_events', JSON.stringify([{ id: 'local-1', outcome: 'Retained' }, { id: 'shared-1', outcome: 'Lost' }])],
        ['ko_meta', JSON.stringify({ team: 'Clontarf', opponent: 'Boden', match_date: '2026-03-25', period: 'H2', our_goal_at_top: false })],
        ['ko_sync_queue', JSON.stringify([{ id: 'local-1', op: 'upsert' }])],
        ['ko_events:user:abc', JSON.stringify([{ id: 'remote-1', outcome: 'Point' }, { id: 'shared-1', outcome: 'Retained' }])],
        ['ko_meta:user:abc', JSON.stringify({ team: 'Clontarf', opponent: 'Na Fianna', match_date: '2026-03-24', period: 'H1', our_goal_at_top: true })],
        ['ko_sync_queue:user:abc', JSON.stringify([{ id: 'remote-1', op: 'delete' }])],
      ]),
      getItem(key) { return this.values.get(key) ?? null; },
      setItem(key, value) { this.values.set(key, value); },
      removeItem(key) { this.values.delete(key); },
    };

    const result = migrateLocalScopeToUserScope('user:abc', { storage });

    expect(result).toEqual({ migrated: true, eventCount: 2, reason: 'migrated' });
    expect(readScopeSnapshot('user:abc', { storage })).toEqual({
      events: [
        { id: 'remote-1', outcome: 'Point' },
        { id: 'shared-1', outcome: 'Lost' },
        { id: 'local-1', outcome: 'Retained' },
      ],
      meta: {
        team: 'Clontarf',
        opponent: 'Boden',
        match_date: '2026-03-25',
        period: 'H2',
        our_goal_at_top: false,
      },
      pendingSync: [
        ['remote-1', 'delete'],
        ['local-1', 'upsert'],
      ],
    });
  });
});
