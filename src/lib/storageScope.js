export const LOCAL_STORAGE_SCOPE = 'local';

export const STORAGE_KEYS = {
  events: 'ko_events',
  meta: 'ko_meta',
  sync: 'ko_sync_queue',
  matchSync: 'ko_match_sync_queue',
  syncCursor: 'ko_sync_cursor',
};

/**
 * @typedef {'upsert' | 'delete'} PendingSyncOperation
 */

/**
 * @typedef {[string, PendingSyncOperation]} PendingSyncEntry
 */

export function storageScopeForUser(nextUser, supabaseConfigured) {
  if (nextUser?.id) return `user:${nextUser.id}`;
  return supabaseConfigured ? null : LOCAL_STORAGE_SCOPE;
}

export function storageKey(baseKey, scope) {
  if (!scope) return null;
  return scope === LOCAL_STORAGE_SCOPE ? baseKey : `${baseKey}:${scope}`;
}

export function readStoredJson(baseKey, fallback, scope, options = {}) {
  const { onCorrupt = null, storage = globalThis.localStorage } = options;
  const key = storageKey(baseKey, scope);
  if (!key || !storage) return fallback;
  try {
    return JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
  } catch {
    onCorrupt?.();
    return fallback;
  }
}

function hasMeaningfulMeta(meta = {}) {
  return Boolean(
    meta.team ||
    meta.opponent ||
    meta.match_date ||
    meta.period ||
    meta.our_goal_at_top !== undefined
  );
}

export function serializeMatchMeta({ team, opponent, matchDate, period, ourGoalAtTop }) {
  return {
    team,
    opponent,
    match_date: matchDate,
    period,
    our_goal_at_top: ourGoalAtTop,
  };
}

export function parseStoredMeta(meta, fallbackDate) {
  return {
    team: meta.team || '',
    opponent: meta.opponent || '',
    matchDate: /^\d{4}-\d{2}-\d{2}$/.test(meta.match_date || '') ? meta.match_date : fallbackDate,
    period: ['H1', 'H2', 'ET'].includes(meta.period) ? meta.period : 'H1',
    ourGoalAtTop: meta.our_goal_at_top !== undefined ? !!meta.our_goal_at_top : true,
  };
}

export function parsePendingSyncEntries(rawValue) {
  if (!Array.isArray(rawValue)) return [];
  if (rawValue.every((item) => typeof item === 'string')) {
    return rawValue.map((id) => /** @type {PendingSyncEntry} */ ([id, 'upsert']));
  }

  return rawValue
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => /** @type {PendingSyncEntry} */ ([item.id, item.op === 'delete' ? 'delete' : 'upsert']));
}

export function readScopeSnapshot(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  return {
    events: readStoredJson(STORAGE_KEYS.events, [], scope, { storage }),
    meta: readStoredJson(STORAGE_KEYS.meta, {}, scope, { storage }),
    pendingSync: parsePendingSyncEntries(readStoredJson(STORAGE_KEYS.sync, [], scope, { storage })),
    pendingMatchSync: parsePendingSyncEntries(readStoredJson(STORAGE_KEYS.matchSync, [], scope, { storage })),
  };
}

export function migrateLocalScopeToUserScope(targetScope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  if (!storage || !targetScope || targetScope === LOCAL_STORAGE_SCOPE) {
    return { migrated: false, eventCount: 0, reason: 'invalid-target' };
  }

  const localSnapshot = readScopeSnapshot(LOCAL_STORAGE_SCOPE, { storage });
  const localHasData =
    localSnapshot.events.length > 0 ||
    localSnapshot.pendingSync.length > 0 ||
    localSnapshot.pendingMatchSync.length > 0 ||
    hasMeaningfulMeta(localSnapshot.meta);

  if (!localHasData) {
    return { migrated: false, eventCount: 0, reason: 'no-local-data' };
  }

  const targetSnapshot = readScopeSnapshot(targetScope, { storage });

  const mergedEventsById = new Map(targetSnapshot.events.map((event) => [event.id, event]));
  for (const event of localSnapshot.events) {
    mergedEventsById.set(event.id, event);
  }

  const mergedPendingById = new Map(
    /** @type {Iterable<PendingSyncEntry>} */ (targetSnapshot.pendingSync)
  );
  for (const [id, op] of localSnapshot.pendingSync) {
    mergedPendingById.set(id, op);
  }

  const mergedPendingMatchesById = new Map(
    /** @type {Iterable<PendingSyncEntry>} */ (targetSnapshot.pendingMatchSync)
  );
  for (const [id, op] of localSnapshot.pendingMatchSync) {
    mergedPendingMatchesById.set(id, op);
  }

  const mergedMeta = hasMeaningfulMeta(localSnapshot.meta)
    ? { ...targetSnapshot.meta, ...localSnapshot.meta }
    : targetSnapshot.meta;

  const eventsKey = storageKey(STORAGE_KEYS.events, targetScope);
  const metaKey = storageKey(STORAGE_KEYS.meta, targetScope);
  const syncKey = storageKey(STORAGE_KEYS.sync, targetScope);
  const matchSyncKey = storageKey(STORAGE_KEYS.matchSync, targetScope);
  if (!eventsKey || !metaKey || !syncKey || !matchSyncKey) {
    return { migrated: false, eventCount: 0, reason: 'invalid-target' };
  }

  storage.setItem(eventsKey, JSON.stringify([...mergedEventsById.values()]));
  storage.setItem(metaKey, JSON.stringify(mergedMeta));
  storage.setItem(syncKey, JSON.stringify([...mergedPendingById].map(([id, op]) => ({ id, op }))));
  storage.setItem(matchSyncKey, JSON.stringify([...mergedPendingMatchesById].map(([id, op]) => ({ id, op }))));

  for (const baseKey of Object.values(STORAGE_KEYS)) {
    const localKey = storageKey(baseKey, LOCAL_STORAGE_SCOPE);
    if (localKey) storage.removeItem(localKey);
  }

  return {
    migrated: true,
    eventCount: localSnapshot.events.length,
    reason: 'migrated',
  };
}
