export const LOCAL_STORAGE_SCOPE = 'local';

export const STORAGE_KEYS = {
  events: 'ko_events',
  meta: 'ko_meta',
  sync: 'ko_sync_queue',
};

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
    return rawValue.map((id) => [id, 'upsert']);
  }

  return rawValue
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => [item.id, item.op === 'delete' ? 'delete' : 'upsert']);
}
