import { kickoutOutcomeSideOf } from './kickoutOutcome.js';

export function normText(value) {
  return (value ?? '').trim().toLowerCase();
}

export function defaultMatchDate() {
  return new Date().toISOString().slice(0, 10);
}

export function scoreOutcomeOf(event) {
  return String(event?.outcome || '').trim().toLowerCase();
}

export function matchKeyOf(event) {
  const matchDate = event?.match_date || String(event?.created_at || '').slice(0, 10);
  return `${matchDate}|${normText(event?.team)}|${normText(event?.opponent)}`;
}

export function eventYearOf(event) {
  return (event?.match_date || String(event?.created_at || '').slice(0, 10)).slice(0, 4);
}

export function analyticsMarkerShape(event) {
  return String(event?.direction || 'ours').toLowerCase() === 'theirs' ? 'square' : 'circle';
}

export function analyticsMarkerFill(event) {
  const type = String(event?.event_type || 'kickout').toLowerCase();
  const outcome = scoreOutcomeOf(event);

  if (type === 'shot') {
    switch (outcome) {
      case 'goal': return '#15803d';
      case 'point': return '#0f766e';
      case 'wide': return '#f59e0b';
      case 'blocked': return '#ea580c';
      case 'saved': return '#64748b';
      default: return '#94a3b8';
    }
  }

  if (type === 'turnover') {
    if (outcome === 'won') return '#16a34a';
    if (outcome === 'lost') return '#dc2626';
    return '#d97706';
  }

  if (kickoutOutcomeSideOf(event) === 'selected') return '#16a34a';
  if (kickoutOutcomeSideOf(event) === 'opposing') return '#dc2626';
  return '#d97706';
}

export function analyticsMarkerRing(event) {
  const type = String(event?.event_type || 'kickout').toLowerCase();
  if (type === 'kickout' && event?.target_player) return 'target';
  if (type === 'shot' && String(event?.shot_type || '').toLowerCase() === 'goal') return 'goal-attempt';
  return null;
}

export function buildCurrentMatchScore(events, currentKey, activeMatchId = null) {
  const shots = events.filter((event) => {
    if (event.event_type !== 'shot') return false;
    // When an explicit match is active, use match_id as the primary filter and
    // fall back to the logical key only for legacy events that pre-date the
    // match entity model.
    if (activeMatchId) {
      return event.match_id === activeMatchId || (!event.match_id && matchKeyOf(event) === currentKey);
    }
    return matchKeyOf(event) === currentKey;
  });
  const calc = (direction) => {
    const filtered = shots.filter((event) => (event.direction || 'ours') === direction);
    const goals = filtered.filter((event) => scoreOutcomeOf(event) === 'goal').length;
    const points = filtered.filter((event) => scoreOutcomeOf(event) === 'point').length;
    return { goals, points, str: `${goals}-${points}` };
  };

  return {
    us: calc('ours'),
    them: calc('theirs'),
    hasShots: shots.length > 0,
  };
}
