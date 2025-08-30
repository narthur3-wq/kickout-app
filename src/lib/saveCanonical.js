// Helpers to build events in canonical space (kicking → right).
import { toCanonical } from './space.js';
import { normalizeOutcome } from './outcomes.js';

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildKickoutCanonical(screen, meta, details = {}) {
  const { x_c, y_c } = toCanonical(screen, meta.orientation_left);
  return {
    id: id(),
    ts: Date.now(),
    type: 'kickout',
    side: meta.current_side,            // 'us' | 'opp'
    half: meta.half,
    orientation_left: meta.orientation_left, // audit only
    landing: { x_c, y_c },              // canonical
    contest_type: details.contest_type || 'clean',
    winner_team: details.winner_team || 'us',
    winner_number: String(details.winner_number || ''),
    win: (details.winner_team || 'us') === 'us'
  };
}

export function buildShotCanonical(screen, meta, details) {
  const { x_c, y_c } = toCanonical(screen, meta.orientation_left);
  return {
    id: id(),
    ts: Date.now(),
    type: 'shot',
    half: meta.half,
    orientation_left: meta.orientation_left, // audit only
    location: { x_c, y_c },                  // canonical
    shot_team: details.shot_team || 'us',
    shot_number: details.shot_number != null ? String(details.shot_number) : '',
    shot_context: details.shot_context || 'play',
    shot_outcome: normalizeOutcome(details.shot_outcome || 'point'),
  };
}

export function buildTurnoverCanonical(screen, meta, details) {
  const { x_c, y_c } = toCanonical(screen, meta.orientation_left);
  const outcome = (details.turnover_outcome === 'gain' || details.winner_team === 'us') ? 'gain' : 'loss';
  return {
    id: id(),
    ts: Date.now(),
    type: 'turnover',
    half: meta.half,
    orientation_left: meta.orientation_left, // audit only
    location: { x_c, y_c },                  // canonical
    turnover_outcome: outcome,               // 'gain' | 'loss'
    turnover_type: details.turnover_type || '', // 'forced' | 'unforced' | ''
    winner_team: details.winner_team || (outcome === 'gain' ? 'us' : 'opp'),
  };
}
