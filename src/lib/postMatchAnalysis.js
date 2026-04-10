export const PITCH_WIDTH_M = 90;
export const PITCH_LENGTH_M = 145;
export const DEFAULT_DIRECTION_THRESHOLD_M = 5;
export const DEFAULT_SIDE_THRESHOLD_M = 4;

export const POSSESSION_SCORE_OUTCOMES = new Set(['Score point', 'Score goal']);
export const ASSIST_ELIGIBLE_OUTCOMES = new Set([
  'Passed / offloaded',
  'Hand pass',
  'Kick pass',
  'Foul won',
]);
export const POSSESSION_TARGET_REQUIRED_OUTCOMES = new Set([
  'Hand pass',
  'Kick pass',
]);
export const POSSESSION_PASS_OUTCOMES = new Set([
  'Passed / offloaded',
  'Hand pass',
  'Kick pass',
]);
export const POSSESSION_SHOT_OUTCOMES = new Set([
  'Shot wide',
  'Shot short / saved / blocked',
]);
export const POSSESSION_LOSS_OUTCOMES = new Set([
  'Possession lost',
  'Tackled / dispossessed',
]);
export const POSSESSION_FOUL_OUTCOMES = new Set([
  'Foul won',
  'Fouled the ball',
]);

function normalizeOutcomeLabel(value) {
  return String(value ?? '').trim();
}

export function isScoreOutcome(outcome) {
  return POSSESSION_SCORE_OUTCOMES.has(normalizeOutcomeLabel(outcome));
}

export function isAssistEligibleOutcome(outcome) {
  return ASSIST_ELIGIBLE_OUTCOMES.has(normalizeOutcomeLabel(outcome));
}

export function possessionOutcomeNeedsTarget(outcome) {
  return POSSESSION_TARGET_REQUIRED_OUTCOMES.has(normalizeOutcomeLabel(outcome));
}

export function possessionActionFamily(outcome) {
  const normalized = normalizeOutcomeLabel(outcome);
  if (POSSESSION_SCORE_OUTCOMES.has(normalized)) return 'scores';
  if (POSSESSION_SHOT_OUTCOMES.has(normalized)) return 'shots';
  if (POSSESSION_PASS_OUTCOMES.has(normalized)) return 'passes';
  if (POSSESSION_LOSS_OUTCOMES.has(normalized)) return 'losses';
  if (POSSESSION_FOUL_OUTCOMES.has(normalized)) return 'fouls';
  return 'other';
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function normalizePoint(point) {
  if (!point || typeof point !== 'object') return { x: NaN, y: NaN };
  return {
    x: toFiniteNumber(point.x),
    y: toFiniteNumber(point.y),
  };
}

export function isValidPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

export function normalizeOptionalPoint(point) {
  const normalized = normalizePoint(point);
  return isValidPoint(normalized) ? normalized : null;
}

export function normalizePointList(points = [], {
  maxLength = Infinity,
} = {}) {
  if (!Array.isArray(points)) return [];
  const cap = Math.max(0, Math.floor(Number(maxLength) || 0));
  const normalized = [];
  for (const point of points) {
    const nextPoint = normalizeOptionalPoint(point);
    if (!nextPoint) continue;
    normalized.push(nextPoint);
    if (normalized.length >= cap) break;
  }
  return normalized;
}

export function normalizePointForAttackDirection(point, attackTowardPositiveY = true) {
  const normalized = normalizePoint(point);
  if (!isValidPoint(normalized)) return normalized;
  if (attackTowardPositiveY) return normalized;
  return { x: normalized.x, y: 1 - normalized.y };
}

export function sessionAttacksTowardPositiveY(session) {
  return session?.our_goal_at_top !== false;
}

export function analysisPointForSession(point, session) {
  return normalizePointForAttackDirection(point, sessionAttacksTowardPositiveY(session));
}

export function storagePointForSession(point, session) {
  return normalizePointForAttackDirection(point, sessionAttacksTowardPositiveY(session));
}

export function pointDistanceMeters(from, to) {
  if (!isValidPoint(from) || !isValidPoint(to)) return NaN;
  const dx = (to.x - from.x) * PITCH_WIDTH_M;
  const dy = (to.y - from.y) * PITCH_LENGTH_M;
  return Math.hypot(dx, dy);
}

export function ballDistanceMeters(release, target) {
  const normalizedTarget = normalizeOptionalPoint(target);
  if (!normalizedTarget) return NaN;
  return pointDistanceMeters(release, normalizedTarget);
}

export function pathDistanceMeters(points = []) {
  if (!Array.isArray(points) || points.length < 2) return NaN;
  let total = 0;
  let segments = 0;
  for (let index = 1; index < points.length; index += 1) {
    const distance = pointDistanceMeters(points[index - 1], points[index]);
    if (!Number.isFinite(distance)) continue;
    total += distance;
    segments += 1;
  }
  return segments > 0 ? total : NaN;
}

export function carryPathPoints(receive, release, carryWaypoints = []) {
  const start = normalizeOptionalPoint(receive);
  const end = normalizeOptionalPoint(release);
  if (!start || !end) return [];
  return [
    start,
    ...normalizePointList(carryWaypoints, { maxLength: 3 }),
    end,
  ];
}

export function carryDistanceMeters(receive, release, carryWaypoints = []) {
  return pathDistanceMeters(carryPathPoints(receive, release, carryWaypoints));
}

export function depthDeltaMeters(from, to) {
  if (!isValidPoint(from) || !isValidPoint(to)) return NaN;
  return (to.y - from.y) * PITCH_LENGTH_M;
}

export function sideDeltaMeters(from, to) {
  if (!isValidPoint(from) || !isValidPoint(to)) return NaN;
  return Math.abs(to.x - from.x) * PITCH_WIDTH_M;
}

export function movementDirection(from, to, {
  directionThresholdM = DEFAULT_DIRECTION_THRESHOLD_M,
  sideThresholdM = DEFAULT_SIDE_THRESHOLD_M,
  attackTowardPositiveY = true,
} = {}) {
  const normalizedFrom = normalizePointForAttackDirection(from, attackTowardPositiveY);
  const normalizedTo = normalizePointForAttackDirection(to, attackTowardPositiveY);
  const delta = depthDeltaMeters(normalizedFrom, normalizedTo);
  const sideDelta = sideDeltaMeters(normalizedFrom, normalizedTo);
  if (!Number.isFinite(delta) || !Number.isFinite(sideDelta)) return null;
  if (delta >= directionThresholdM) return 'forward';
  if (delta <= -directionThresholdM) return 'backward';
  if (sideDelta >= sideThresholdM) return 'lateral';
  return 'lateral';
}

export function movementDirectionForSession(from, to, session, options = {}) {
  return movementDirection(from, to, {
    ...options,
    attackTowardPositiveY: sessionAttacksTowardPositiveY(session),
  });
}

export function movementDirectionLabel(direction) {
  if (direction === 'forward') return 'Forward';
  if (direction === 'backward') return 'Backward';
  if (direction === 'lateral') return 'Lateral';
  return 'Unknown';
}

export function movementDirectionColor(direction) {
  if (direction === 'forward') return '#16a34a';
  if (direction === 'backward') return '#dc2626';
  if (direction === 'lateral') return '#d97706';
  return '#6b7280';
}

export function roundPoint(point, precision = 2) {
  if (!isValidPoint(point)) return { x: NaN, y: NaN };
  const factor = 10 ** precision;
  return {
    x: Math.round(point.x * factor) / factor,
    y: Math.round(point.y * factor) / factor,
  };
}

export function normalizePlayerKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeSquadPlayerName(value) {
  return normalizePlayerKey(value);
}

export function displayPlayerLabel(value) {
  return String(value ?? '').trim();
}

export function squadPlayerKey(id) {
  if (!id) return '';
  return `squad:${id}`;
}

export function buildSquadPlayerIndex(players = []) {
  const byId = new Map();
  const byNameKey = new Map();
  for (const player of players) {
    if (!player) continue;
    const id = String(player.id || '').trim();
    const name = displayPlayerLabel(player.name || player.player_name || '');
    const nameKey = normalizeSquadPlayerName(player.name_key || name);
    if (id) byId.set(id, { ...player, id, name, name_key: nameKey });
    if (nameKey && !byNameKey.has(nameKey)) {
      byNameKey.set(nameKey, id ? { ...player, id, name, name_key: nameKey } : { ...player, name, name_key: nameKey });
    }
  }
  return { byId, byNameKey };
}

export function resolveSessionPlayerIdentity(session, squadPlayers = []) {
  const name = displayPlayerLabel(session?.player_name || session?.player || '');
  const nameKey = normalizePlayerKey(name);
  const sessionId = session?.squad_player_id || session?.player_id || null;
  const roster = buildSquadPlayerIndex(Array.isArray(squadPlayers) ? squadPlayers : []);

  if (sessionId && roster.byId.has(sessionId)) {
    const player = roster.byId.get(sessionId);
    return {
      key: squadPlayerKey(player.id),
      label: displayPlayerLabel(player.name),
      squad_player_id: player.id,
      source: 'squad',
    };
  }

  if (nameKey && roster.byNameKey.has(nameKey)) {
    const player = roster.byNameKey.get(nameKey);
    if (player?.id) {
      return {
        key: squadPlayerKey(player.id),
        label: displayPlayerLabel(player.name),
        squad_player_id: player.id,
        source: 'squad-name',
      };
    }
  }

  return {
    key: nameKey,
    label: name || 'Unknown player',
    squad_player_id: null,
    source: name ? 'legacy' : 'unknown',
  };
}

export function buildPlayerDirectory(sessions = [], squadPlayers = []) {
  const directory = new Map();
  for (const session of sessions) {
    const identity = resolveSessionPlayerIdentity(session, squadPlayers);
    if (!identity.key) continue;
    if (!directory.has(identity.key)) {
      directory.set(identity.key, {
        key: identity.key,
        label: identity.label,
        count: 0,
        eventCount: 0,
        source: identity.source,
        squad_player_id: identity.squad_player_id,
      });
    }
    const entry = directory.get(identity.key);
    entry.count += 1;
    entry.eventCount += Array.isArray(session?.events) ? session.events.length : 0;
  }
  return [...directory.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function sessionLabel(session, index, singularLabel = 'event', pluralLabel = `${singularLabel}s`) {
  const count = session?.events?.length || 0;
  const playerName = displayPlayerLabel(session?.player_name) || 'Player';
  const date = String(session?.created_at || session?.updated_at || '').slice(0, 10);
  const countLabel = count === 1 ? singularLabel : pluralLabel;
  const parts = [`${index + 1}. ${playerName}`, `${count} ${countLabel}`];
  if (date) parts.push(date);
  return parts.join(' - ');
}

export function splitMatchIdsForTrend(matchIds = [], {
  dateLookup = null,
  mode = 'halves',
  lastN = 3,
} = {}) {
  const ids = Array.isArray(matchIds) ? matchIds.filter(Boolean) : [];
  const entries = ids.map((id, index) => {
    const date = dateLookup instanceof Map
      ? dateLookup.get(id)
      : (dateLookup && typeof dateLookup === 'object' ? dateLookup[id] : null);
    return {
      id,
      date: date ? String(date) : '',
      index,
    };
  });

  entries.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.index - b.index;
  });

  const ordered = entries.map((entry) => entry.id);
  if (mode === 'lastN') {
    const n = Math.max(1, Math.floor(Number(lastN) || 3));
    const cut = Math.max(0, ordered.length - n);
    return {
      ordered,
      earlier: ordered.slice(0, cut),
      recent: ordered.slice(cut),
    };
  }

  const mid = Math.ceil(ordered.length / 2);
  return {
    ordered,
    earlier: ordered.slice(0, mid),
    recent: ordered.slice(mid),
  };
}

export function collectPlayerOptions(records = [], fieldNames = ['player_name']) {
  const optionsByKey = new Map();
  for (const record of records) {
    if (Array.isArray(record) && record.length >= 2) {
      const key = normalizePlayerKey(record[0]);
      const label = displayPlayerLabel(record[1]);
      if (!key || !label) continue;
      if (!optionsByKey.has(key)) optionsByKey.set(key, { key, label, count: 0 });
      optionsByKey.get(key).count += 1;
      continue;
    }

    if (typeof record === 'string') {
      const label = displayPlayerLabel(record);
      const key = normalizePlayerKey(label);
      if (!key || !label) continue;
      if (!optionsByKey.has(key)) optionsByKey.set(key, { key, label, count: 0 });
      optionsByKey.get(key).count += 1;
      continue;
    }

    for (const fieldName of fieldNames) {
      const label = displayPlayerLabel(record?.[fieldName]);
      if (!label) continue;
      const key = normalizePlayerKey(label);
      if (!optionsByKey.has(key)) {
        optionsByKey.set(key, { key, label, count: 0 });
      }
      optionsByKey.get(key).count += 1;
    }
  }
  return [...optionsByKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function buildOutcomeBreakdown(events = [], field = 'outcome') {
  const breakdown = new Map();
  for (const event of events) {
    const value = displayPlayerLabel(event?.[field]) || 'Unknown';
    breakdown.set(value, (breakdown.get(value) ?? 0) + 1);
  }
  return [...breakdown.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizePossessionEvents(events = [], options = {}) {
  const {
    receiveSelector = (event) => event.receive || { x: event.receive_x, y: event.receive_y },
    releaseSelector = (event) => event.release || { x: event.release_x, y: event.release_y },
    targetSelector = (event) => event.target || { x: event.target_x, y: event.target_y },
    carryWaypointSelector = (event) => event.carry_waypoints || [],
    directionSelector = null,
  } = options || {};

  const total = events.length;
  const outcomeBreakdown = buildOutcomeBreakdown(events);
  const topOutcome = outcomeBreakdown[0]?.label || null;
  let forwardCount = 0;
  let lateralCount = 0;
  let backwardCount = 0;
  const distances = [];
  const ballDistances = [];

  for (const event of events) {
    const receive = normalizePoint(receiveSelector(event));
    const release = normalizePoint(releaseSelector(event));
    const target = normalizeOptionalPoint(targetSelector(event));
    const carryWaypoints = carryWaypointSelector(event);
    const direction = directionSelector
      ? directionSelector(event)
      : movementDirection(receive, release);

    if (direction === 'forward') forwardCount += 1;
    else if (direction === 'backward') backwardCount += 1;
    else if (direction === 'lateral') lateralCount += 1;

    const distance = carryDistanceMeters(receive, release, carryWaypoints);
    if (Number.isFinite(distance)) distances.push(distance);

    const ballDistance = ballDistanceMeters(release, target);
    if (Number.isFinite(ballDistance)) ballDistances.push(ballDistance);
  }

  return {
    total,
    outcomeBreakdown,
    forwardCount,
    lateralCount,
    backwardCount,
    averageCarry: averageOf(distances),
    averageBall: averageOf(ballDistances),
    totalBallDistance: sumOf(ballDistances),
    ballEvents: ballDistances.length,
    topOutcome,
  };
}

export function buildPossessionSummary(events = [], options = {}) {
  const summary = summarizePossessionEvents(events, options);
  let directScores = 0;
  let assistCount = 0;
  for (const event of events) {
    const outcome = normalizeOutcomeLabel(event?.outcome);
    if (isScoreOutcome(outcome)) {
      directScores += 1;
      continue;
    }
    if (event?.assist === true) {
      if (isAssistEligibleOutcome(outcome)) {
        assistCount += 1;
      } else {
        console.warn('Assist ignored for ineligible outcome', { outcome, eventId: event?.id });
      }
    }
  }
  const scoreInvolvement = directScores + assistCount;
  const scoreInvolvementRate = summary.total > 0 ? scoreInvolvement / summary.total : null;
  return {
    ...summary,
    totalEvents: summary.total,
    directScores,
    assistCount,
    scoreInvolvement,
    scoreInvolvementRate,
  };
}

export function averageOf(values = []) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function sumOf(values = []) {
  return values.filter((value) => Number.isFinite(value)).reduce((sum, value) => sum + value, 0);
}

export function formatMetres(value, fractionDigits = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(fractionDigits)}m`;
}

export function formatSignedMetres(value, fractionDigits = 1) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(fractionDigits)}m`;
}

/**
 * @param {Array<any>} events
 * @param {{
 *   fromSelector?: (event: any) => any,
 *   toSelector?: (event: any) => any,
 *   directionSelector?: ((event: any) => any) | null,
 *   completionSelector?: ((event: any) => any) | null,
 *   precision?: number,
 * }} [options]
 */
export function aggregateConnections(events = [], {
  fromSelector,
  toSelector,
  directionSelector = null,
  completionSelector = null,
  precision = 2,
} = {}) {
  const connections = new Map();
  for (const event of events) {
    const from = normalizePoint(fromSelector ? fromSelector(event) : event?.from);
    const to = normalizePoint(toSelector ? toSelector(event) : event?.to);
    if (!isValidPoint(from) || !isValidPoint(to)) continue;
    const direction = directionSelector ? directionSelector(event) : null;
    const completed = completionSelector ? !!completionSelector(event) : true;
    const key = [
      roundPoint(from, precision).x,
      roundPoint(from, precision).y,
      roundPoint(to, precision).x,
      roundPoint(to, precision).y,
    ].join('|');
    if (!connections.has(key)) {
      connections.set(key, {
        from: roundPoint(from, precision),
        to: roundPoint(to, precision),
        count: 0,
        completedCount: 0,
        incompleteCount: 0,
        direction,
        completed,
      });
    }
    const bucket = connections.get(key);
    bucket.count += 1;
    if (completed) bucket.completedCount += 1;
    else bucket.incompleteCount += 1;
    if (direction && !bucket.direction) bucket.direction = direction;
  }
  return [...connections.values()];
}

export function buildPointSeries(events = [], selector) {
  return events
    .map((event) => normalizePoint(selector ? selector(event) : event?.point))
    .filter(isValidPoint)
    .map((point) => ({ ...point, weight: 1 }));
}

export function countByValue(events = [], selector) {
  const counts = new Map();
  for (const event of events) {
    const value = selector(event);
    const key = String(value ?? '');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
