import { storageKey } from './storageScope.js';

// ── Storage keys ──────────────────────────────────────────────────────────────
export const MATCH_KEYS = {
  matches: 'ko_matches',
  activeMatchId: 'ko_active_match_id',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normText(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * The inferred match key used before explicit match records existed.
 * Kept here so migration can group events by the same key the shell used.
 */
export function inferredMatchKey(event) {
  const date = event?.match_date || String(event?.created_at || '').slice(0, 10);
  return `${date}|${normText(event?.team)}|${normText(event?.opponent)}`;
}

// ── Match factory ─────────────────────────────────────────────────────────────
export function createMatch({ team, opponent, match_date, team_id = null, created_by = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    team_id: team_id ?? null,
    team: String(team ?? '').trim(),
    opponent: String(opponent ?? '').trim(),
    match_date: match_date ?? '',
    status: 'open',
    created_at: now,
    updated_at: now,
    last_event_at: null,
    created_by: created_by ?? null,
    closed_at: null,
  };
}

// ── Match mutations (pure — return new objects) ───────────────────────────────
export function closeMatch(match) {
  const now = new Date().toISOString();
  return { ...match, status: 'closed', closed_at: now, updated_at: now };
}

export function reopenMatch(match) {
  const now = new Date().toISOString();
  return { ...match, status: 'open', closed_at: null, updated_at: now };
}

export function updateMatchFields(match, { team, opponent, match_date }) {
  return {
    ...match,
    ...(team !== undefined && { team: String(team).trim() }),
    ...(opponent !== undefined && { opponent: String(opponent).trim() }),
    ...(match_date !== undefined && { match_date }),
    updated_at: new Date().toISOString(),
  };
}

export function touchMatchLastEvent(match) {
  const now = new Date().toISOString();
  return { ...match, last_event_at: now, updated_at: now };
}

// ── Storage I/O ───────────────────────────────────────────────────────────────
export function loadMatches(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(MATCH_KEYS.matches, scope);
  if (!key || !storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveMatches(matches, scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(MATCH_KEYS.matches, scope);
  if (!key || !storage) return;
  try {
    storage.setItem(key, JSON.stringify(matches));
  } catch {}
}

export function loadActiveMatchId(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(MATCH_KEYS.activeMatchId, scope);
  if (!key || !storage) return null;
  try {
    return storage.getItem(key) || null;
  } catch {
    return null;
  }
}

export function saveActiveMatchId(id, scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(MATCH_KEYS.activeMatchId, scope);
  if (!key || !storage) return;
  try {
    if (id) {
      storage.setItem(key, id);
    } else {
      storage.removeItem(key);
    }
  } catch {}
}

export function clearMatchStorage(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  for (const baseKey of Object.values(MATCH_KEYS)) {
    const key = storageKey(baseKey, scope);
    if (key && storage) {
      try { storage.removeItem(key); } catch {}
    }
  }
}

// ── Migration ─────────────────────────────────────────────────────────────────
/**
 * One-time idempotent migration from inferred match identity to explicit match records.
 *
 * - If ko_matches already has records, this is a no-op.
 * - Otherwise groups events by inferred key (date|team|opponent), creates one
 *   match per group, and assigns match_id back onto each event.
 * - Persists matches and activeMatchId to storage.
 *
 * Returns { migrated, matches, updatedEvents, activeMatchId }
 */
export function migrateEventsToMatches(events, scope, options = {}) {
  const { storage = globalThis.localStorage, teamId = null, userId = null } = options;

  const existingMatches = loadMatches(scope, { storage });
  if (existingMatches.length > 0) {
    return {
      migrated: false,
      matches: existingMatches,
      updatedEvents: events,
      activeMatchId: loadActiveMatchId(scope, { storage }),
    };
  }

  if (!events || events.length === 0) {
    return { migrated: false, matches: [], updatedEvents: events || [], activeMatchId: null };
  }

  // Group events, tracking last_event_at per group
  const groups = new Map(); // key -> { team, opponent, match_date, last_event_at }
  for (const event of events) {
    const key = inferredMatchKey(event);
    if (!groups.has(key)) {
      groups.set(key, {
        team: (event.team || '').trim(),
        opponent: (event.opponent || '').trim(),
        match_date: event.match_date || String(event.created_at || '').slice(0, 10),
        last_event_at: null,
      });
    }
    const group = groups.get(key);
    const t = event.created_at || null;
    if (t && (!group.last_event_at || t > group.last_event_at)) {
      group.last_event_at = t;
    }
  }

  const now = new Date().toISOString();
  const keyToMatchId = new Map();
  const matches = [];

  for (const [key, group] of groups) {
    const match = {
      id: crypto.randomUUID(),
      team_id: teamId ?? null,
      team: group.team,
      opponent: group.opponent,
      match_date: group.match_date,
      status: 'open',
      created_at: now,
      updated_at: now,
      last_event_at: group.last_event_at,
      created_by: userId ?? null,
      closed_at: null,
    };
    matches.push(match);
    keyToMatchId.set(key, match.id);
  }

  // Assign match_id to events that don't already have one
  const updatedEvents = events.map((event) => {
    if (event.match_id) return event;
    const matchId = keyToMatchId.get(inferredMatchKey(event));
    return matchId ? { ...event, match_id: matchId } : event;
  });

  // Choose activeMatchId: most recently active match
  const activeMatchId = [...matches].sort((a, b) => {
    const aTime = a.last_event_at || a.created_at || '';
    const bTime = b.last_event_at || b.created_at || '';
    return bTime.localeCompare(aTime);
  })[0]?.id ?? null;

  saveMatches(matches, scope, { storage });
  saveActiveMatchId(activeMatchId, scope, { storage });

  return { migrated: true, matches, updatedEvents, activeMatchId };
}
