import { STORAGE_KEYS, storageKey } from './storageScope.js';

const DEFAULT_SYNC_CURSOR = {
  matches: null,
  events: null,
};

function normalizeCursorValue(value) {
  return typeof value === 'string' && value ? value : null;
}

export function normalizeSyncCursor(cursor = {}) {
  return {
    matches: normalizeCursorValue(cursor.matches),
    events: normalizeCursorValue(cursor.events),
  };
}

export function loadSyncCursor(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(STORAGE_KEYS.syncCursor, scope);
  if (!key || !storage) return { ...DEFAULT_SYNC_CURSOR };

  try {
    return normalizeSyncCursor(JSON.parse(storage.getItem(key) || '{}'));
  } catch {
    return { ...DEFAULT_SYNC_CURSOR };
  }
}

export function saveSyncCursor(cursor, scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(STORAGE_KEYS.syncCursor, scope);
  if (!key || !storage) return;

  try {
    storage.setItem(key, JSON.stringify(normalizeSyncCursor(cursor)));
  } catch {}
}

export function clearSyncCursor(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(STORAGE_KEYS.syncCursor, scope);
  if (!key || !storage) return;

  try {
    storage.removeItem(key);
  } catch {}
}

function latestTimestamp(rows = []) {
  let latest = null;

  for (const row of rows) {
    const candidate = row?.updated_at || row?.created_at || null;
    if (!candidate) continue;
    if (!latest || candidate > latest) {
      latest = candidate;
    }
  }

  return latest;
}

function laterTimestamp(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

export function advanceSyncCursor(cursor = DEFAULT_SYNC_CURSOR, { matches = [], events = [] } = {}) {
  const next = normalizeSyncCursor(cursor);
  const latestMatches = latestTimestamp(matches);
  const latestEvents = latestTimestamp(events);

  return {
    matches: laterTimestamp(next.matches, latestMatches),
    events: laterTimestamp(next.events, latestEvents),
  };
}

export function mergeRowsById(existingRows = [], remoteRows = [], { pendingIds = new Set() } = {}) {
  const mergedById = new Map();
  const order = [];

  for (const row of existingRows) {
    if (!row?.id) continue;
    if (!mergedById.has(row.id)) order.push(row.id);
    mergedById.set(row.id, row);
  }

  for (const row of remoteRows) {
    if (!row?.id || pendingIds.has(row.id)) continue;
    if (!mergedById.has(row.id)) order.push(row.id);
    mergedById.set(row.id, row);
  }

  return order.map((id) => mergedById.get(id)).filter(Boolean);
}
