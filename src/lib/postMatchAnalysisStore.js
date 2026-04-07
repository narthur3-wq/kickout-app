import { STORAGE_KEYS, normalizeAnalysisSnapshot, readStoredJson, storageKey } from './storageScope.js';
import {
  displayPlayerLabel,
  normalizePlayerKey,
  normalizePoint,
  normalizeSquadPlayerName,
  resolveSessionPlayerIdentity,
  squadPlayerKey,
} from './postMatchAnalysis.js';

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function normalizeOutcomeList(outcomes = []) {
  return outcomes
    .map((outcome) => String(outcome ?? '').trim())
    .filter(Boolean);
}

function normalizeHalfTag(value) {
  const half = String(value ?? '').trim();
  return ['first', 'second', 'et'].includes(half) ? half : null;
}

export function createEmptyAnalysisState() {
  return {
    version: 1,
    possessionSessions: [],
    passSessions: [],
    squadPlayers: [],
  };
}

export function normalizePossessionEvent(event, fallbackCreatedAt = nowIso()) {
  const receive = normalizePoint({ x: event?.receive_x, y: event?.receive_y });
  const release = normalizePoint({ x: event?.release_x, y: event?.release_y });
  return {
    id: event?.id || createId(),
    receive_x: receive.x,
    receive_y: receive.y,
    release_x: release.x,
    release_y: release.y,
    outcome: String(event?.outcome ?? '').trim() || 'Passed / offloaded',
    under_pressure: !!event?.under_pressure,
    assist: event?.assist === true,
    created_at: event?.created_at || fallbackCreatedAt,
  };
}

export function normalizePassEvent(event, fallbackCreatedAt = nowIso()) {
  const from = normalizePoint({ x: event?.from_x, y: event?.from_y });
  const to = normalizePoint({ x: event?.to_x, y: event?.to_y });
  return {
    id: event?.id || createId(),
    from_x: from.x,
    from_y: from.y,
    to_x: to.x,
    to_y: to.y,
    pass_type: normalizeOutcomeList([event?.pass_type])[0] || 'Kickpass',
    completed: event?.completed !== false,
    created_at: event?.created_at || fallbackCreatedAt,
  };
}

function normalizeSessionBase(session, mode) {
  const createdAt = session?.created_at || nowIso();
  const updatedAt = session?.updated_at || createdAt;
  const playerName = displayPlayerLabel(session?.player_name || session?.player || '');
  return {
    id: session?.id || createId(),
    mode,
    match_id: session?.match_id || null,
    player_name: playerName,
    player_key: normalizePlayerKey(session?.player_key || playerName),
    squad_player_id: session?.squad_player_id || session?.player_id || null,
    our_goal_at_top: session?.our_goal_at_top !== undefined ? !!session.our_goal_at_top : true,
    half: normalizeHalfTag(session?.half),
    created_at: createdAt,
    updated_at: updatedAt,
    notes: String(session?.notes ?? '').trim(),
  };
}

export function normalizePossessionSession(session, squadPlayers = []) {
  const base = normalizeSessionBase(session, 'possession');
  const identity = resolveSessionPlayerIdentity(session, squadPlayers);
  return {
    ...base,
    player_name: identity.label || base.player_name,
    player_key: identity.key || base.player_key,
    squad_player_id: identity.squad_player_id || base.squad_player_id || null,
    events: Array.isArray(session?.events)
      ? session.events.map((event) => normalizePossessionEvent(event, base.created_at))
      : [],
  };
}

export function normalizePassSession(session, squadPlayers = []) {
  const base = normalizeSessionBase(session, 'pass');
  const identity = resolveSessionPlayerIdentity(session, squadPlayers);
  return {
    ...base,
    player_name: identity.label || base.player_name,
    player_key: identity.key || base.player_key,
    squad_player_id: identity.squad_player_id || base.squad_player_id || null,
    events: Array.isArray(session?.events)
      ? session.events.map((event) => normalizePassEvent(event, base.created_at))
      : [],
  };
}

export function normalizeSquadPlayer(player, fallbackCreatedAt = nowIso()) {
  const createdAt = player?.created_at || fallbackCreatedAt;
  const updatedAt = player?.updated_at || createdAt;
  const name = displayPlayerLabel(player?.name || player?.player_name || '');
  return {
    id: player?.id || createId(),
    name,
    name_key: normalizeSquadPlayerName(name),
    active: player?.active !== false,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function normalizeSquadPlayers(players = []) {
  if (!Array.isArray(players)) return [];
  const playersByNameKey = new Map();
  for (const player of players) {
    const normalized = normalizeSquadPlayer(player);
    if (!normalized.name_key) continue;
    const existing = playersByNameKey.get(normalized.name_key);
    if (!existing || (normalized.updated_at || '') >= (existing.updated_at || '')) {
      playersByNameKey.set(normalized.name_key, normalized);
    }
  }
  return [...playersByNameKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertSquadPlayer(state, player) {
  const normalized = normalizeAnalysisState(state);
  const nextPlayer = normalizeSquadPlayer(player);
  if (!nextPlayer.name) return normalized;
  const players = [...normalized.squadPlayers];
  const indexById = players.findIndex((item) => item.id === nextPlayer.id);
  const indexByName = players.findIndex((item) => item.name_key === nextPlayer.name_key);
  const index = indexById >= 0 ? indexById : indexByName;
  if (index >= 0) players[index] = { ...players[index], ...nextPlayer };
  else players.unshift(nextPlayer);
  return { ...normalized, squadPlayers: normalizeSquadPlayers(players) };
}

export function setSquadPlayerActive(state, playerId, active) {
  const normalized = normalizeAnalysisState(state);
  const players = normalized.squadPlayers.map((player) => {
    if (player.id !== playerId) return player;
    return {
      ...player,
      active: active === undefined ? !player.active : !!active,
      updated_at: nowIso(),
    };
  });
  return { ...normalized, squadPlayers: normalizeSquadPlayers(players) };
}

export function renameAnalysisPlayer(state, playerKey, player) {
  const normalized = normalizeAnalysisState(state);
  const nextPlayer = normalizeSquadPlayer(player);
  if (!playerKey || !nextPlayer.name) return normalized;

  const nextKey = squadPlayerKey(nextPlayer.id);
  const updateSession = (session) => {
    const identity = resolveSessionPlayerIdentity(session, normalized.squadPlayers);
    const currentKey = identity?.key || session.player_key || normalizePlayerKey(session.player_name);
    if (currentKey !== playerKey) return session;
    return {
      ...session,
      player_name: nextPlayer.name,
      player_key: nextKey,
      squad_player_id: nextPlayer.id,
      updated_at: nowIso(),
    };
  };

  return {
    ...normalized,
    possessionSessions: normalized.possessionSessions.map(updateSession),
    passSessions: normalized.passSessions.map(updateSession),
  };
}

/**
 * @param {any} rawState
 */
export function normalizeAnalysisState(rawState = {}) {
  const snapshot = normalizeAnalysisSnapshot(rawState);
  const squadPlayers = normalizeSquadPlayers(snapshot.squadPlayers);
  return {
    ...createEmptyAnalysisState(),
    version: snapshot.version,
    possessionSessions: snapshot.possessionSessions.map((session) => normalizePossessionSession(session, squadPlayers)),
    passSessions: snapshot.passSessions.map((session) => normalizePassSession(session, squadPlayers)),
    squadPlayers,
  };
}

export function loadAnalysisState(scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const raw = readStoredJson(STORAGE_KEYS.analysis, createEmptyAnalysisState(), scope, { storage });
  return normalizeAnalysisState(raw);
}

export function saveAnalysisState(state, scope, options = {}) {
  const { storage = globalThis.localStorage } = options;
  const key = storageKey(STORAGE_KEYS.analysis, scope);
  if (!key || !storage) return;
  try {
    storage.setItem(key, JSON.stringify(normalizeAnalysisState(state)));
  } catch {
    // Keep analysis sessions best-effort like the rest of local storage writes.
  }
}

export function sessionsForMatch(state, mode, matchId) {
  const normalized = normalizeAnalysisState(state);
  const sessions = mode === 'pass' ? normalized.passSessions : normalized.possessionSessions;
  if (!matchId) return sessions;
  return sessions.filter((session) => session.match_id === matchId);
}

export function sessionsForPlayer(state, mode, playerKey, matchIds = null) {
  if (!playerKey) return [];
  const normalized = normalizeAnalysisState(state);
  const sessions = mode === 'pass' ? normalized.passSessions : normalized.possessionSessions;
  const matchFilter = Array.isArray(matchIds) && matchIds.length > 0
    ? new Set(matchIds)
    : null;

  return sessions.filter((session) => {
    if (matchFilter && !matchFilter.has(session.match_id)) return false;
    const identity = resolveSessionPlayerIdentity(session, normalized.squadPlayers);
    const key = identity?.key || session.player_key || normalizePlayerKey(session.player_name);
    return key === playerKey;
  });
}

export function replaceAnalysisSession(state, session) {
  const normalized = normalizeAnalysisState(state);
  const key = session.mode === 'pass' ? 'passSessions' : 'possessionSessions';
  const sessions = [...normalized[key]];
  const index = sessions.findIndex((item) => item.id === session.id);
  const nextSession = session.mode === 'pass'
    ? normalizePassSession(session, normalized.squadPlayers)
    : normalizePossessionSession(session, normalized.squadPlayers);
  if (index >= 0) sessions[index] = nextSession;
  else sessions.unshift(nextSession);
  return { ...normalized, [key]: sessions };
}

export function deleteAnalysisSession(state, mode, sessionId) {
  const normalized = normalizeAnalysisState(state);
  const key = mode === 'pass' ? 'passSessions' : 'possessionSessions';
  return {
    ...normalized,
    [key]: normalized[key].filter((session) => session.id !== sessionId),
  };
}

export function mergeImportedAnalysisState(currentState, importedState) {
  const base = normalizeAnalysisState(currentState);
  const incoming = normalizeAnalysisState(importedState);
  const mergeById = (existing, next) => {
    const merged = new Map(existing.map((session) => [session.id, session]));
    for (const session of next) merged.set(session.id, session);
    return [...merged.values()].sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
  };

  return {
    version: Math.max(base.version || 1, incoming.version || 1),
    possessionSessions: mergeById(base.possessionSessions, incoming.possessionSessions),
    passSessions: mergeById(base.passSessions, incoming.passSessions),
    squadPlayers: mergeById(base.squadPlayers, incoming.squadPlayers),
  };
}

// Supabase row mapping and sync orchestration now live in analysisSync.js.
