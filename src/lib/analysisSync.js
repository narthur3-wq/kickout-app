import { mergeRowsById } from './syncState.js';
import {
  normalizeAnalysisState,
  normalizePassEvent,
  normalizePassSession,
  normalizePossessionEvent,
  normalizePossessionSession,
  normalizeSquadPlayer,
} from './postMatchAnalysisStore.js';

function groupRowsBySessionId(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const sessionId = String(row?.session_id ?? '').trim();
    if (!sessionId) continue;
    if (!grouped.has(sessionId)) grouped.set(sessionId, []);
    grouped.get(sessionId).push(row);
  }
  return grouped;
}

function cloneSessionRow(row = {}, events = []) {
  return {
    ...row,
    events,
  };
}

function normalizeRowRows(rows = []) {
  return rows
    .filter((row) => row && row.id)
    .map((row) => ({ ...row }));
}

export function analysisDeleteKey(mode, id) {
  return `${mode}:${id}`;
}

export function analysisDeleteEntryFromKey(key) {
  const [mode, ...rest] = String(key || '').split(':');
  const id = rest.join(':').trim();
  if (!id || (mode !== 'possession' && mode !== 'pass')) return null;
  return { mode, id };
}

export function analysisDeleteEntriesFromStates(previousState = {}, nextState = {}) {
  const previous = normalizeAnalysisState(previousState);
  const next = normalizeAnalysisState(nextState);
  const removed = [];

  const collectRemoved = (mode, prevSessions, nextSessions) => {
    const nextIds = new Set(nextSessions.map((session) => session.id));
    for (const session of prevSessions) {
      if (!session?.id || nextIds.has(session.id)) continue;
      removed.push({ mode, id: session.id });
    }
  };

  collectRemoved('possession', previous.possessionSessions, next.possessionSessions);
  collectRemoved('pass', previous.passSessions, next.passSessions);

  return removed;
}

export function analysisStateToSupabaseRows(state = {}, teamId = null) {
  const normalized = normalizeAnalysisState(state);

  const possessionSessions = normalized.possessionSessions.map((session) => ({
    id: session.id,
    team_id: teamId,
    match_id: session.match_id ?? null,
    squad_player_id: session.squad_player_id ?? null,
    player_name: session.player_name,
    our_goal_at_top: session.our_goal_at_top !== false,
    half: session.half ?? null,
    notes: session.notes || null,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }));

  const passSessions = normalized.passSessions.map((session) => ({
    id: session.id,
    team_id: teamId,
    match_id: session.match_id ?? null,
    squad_player_id: session.squad_player_id ?? null,
    player_name: session.player_name,
    our_goal_at_top: session.our_goal_at_top !== false,
    notes: session.notes || null,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }));

  const possessionEvents = normalized.possessionSessions.flatMap((session) =>
    (session.events || []).map((event) => ({
      id: event.id,
      session_id: session.id,
      receive_x: event.receive_x,
      receive_y: event.receive_y,
      release_x: event.release_x,
      release_y: event.release_y,
      carry_waypoints: Array.isArray(event.carry_waypoints) ? event.carry_waypoints : [],
      target_x: event.target_x ?? null,
      target_y: event.target_y ?? null,
      outcome: event.outcome,
      under_pressure: !!event.under_pressure,
      assist: !!event.assist,
      created_at: event.created_at,
    }))
  );

  const passEvents = normalized.passSessions.flatMap((session) =>
    (session.events || []).map((event) => ({
      id: event.id,
      session_id: session.id,
      from_x: event.from_x,
      from_y: event.from_y,
      to_x: event.to_x,
      to_y: event.to_y,
      pass_type: event.pass_type,
      completed: event.completed !== false,
      created_at: event.created_at,
    }))
  );

  return {
    squadPlayers: normalized.squadPlayers.map((player) => ({
      id: player.id,
      team_id: teamId,
      name: player.name,
      active: player.active !== false,
      created_at: player.created_at,
      updated_at: player.updated_at,
    })),
    possessionSessions,
    possessionEvents,
    passSessions,
    passEvents,
  };
}

export function analysisStateFromSupabaseRows({
  squadPlayers = [],
  possessionSessions = [],
  possessionEvents = [],
  passSessions = [],
  passEvents = [],
} = {}) {
  const possessionEventsBySession = groupRowsBySessionId(possessionEvents);
  const passEventsBySession = groupRowsBySessionId(passEvents);

  return normalizeAnalysisState({
    version: 1,
    squadPlayers: normalizeRowRows(squadPlayers).map((player) => normalizeSquadPlayer(player)),
    possessionSessions: normalizeRowRows(possessionSessions).map((session) =>
      normalizePossessionSession(
        cloneSessionRow(session, (possessionEventsBySession.get(session.id) || []).map((event) => normalizePossessionEvent(event))),
      )
    ),
    passSessions: normalizeRowRows(passSessions).map((session) =>
      normalizePassSession(
        cloneSessionRow(session, (passEventsBySession.get(session.id) || []).map((event) => normalizePassEvent(event))),
      )
    ),
  });
}

export function mergeAnalysisRows(remoteRows = [], localRows = []) {
  return mergeRowsById(remoteRows, localRows);
}

