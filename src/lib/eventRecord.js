export const CURRENT_EVENT_SCHEMA_VERSION = 1;
export const KICKOUT_REVIEW_RESULTS = ['score', 'no_score', 'unreviewed'];
export const SHOT_SCORE_SOURCES = ['kickout', 'turnover', 'settled', 'free', 'other', 'unreviewed'];

function normalizeLower(value, fallback = '') {
  return String(value ?? fallback).trim().toLowerCase();
}

function normalizeUpper(value, fallback = '') {
  return String(value ?? fallback).trim().toUpperCase();
}

export function normalizeEventRecord(event, { teamIdFallback = null } = {}) {
  const raw = event ?? {};
  const type = normalizeLower(raw.event_type, 'kickout') || 'kickout';
  const direction = normalizeLower(raw.direction, 'ours') || 'ours';
  const contestTypeRaw = normalizeLower(raw.contest_type, 'clean') || 'clean';
  const contestType = type === 'kickout' ? (['clean', 'break', 'foul', 'out'].includes(contestTypeRaw) ? contestTypeRaw : 'clean') : null;
  const isBreak = type === 'kickout' && contestType === 'break';
  const periodRaw = normalizeUpper(raw.period, 'H1') || 'H1';
  const period = ['H1', 'H2', 'ET'].includes(periodRaw) ? periodRaw : 'H1';
  const shotTypeRaw = normalizeLower(raw.shot_type, 'point') || 'point';
  const shotType = type === 'shot' ? (['goal', 'point'].includes(shotTypeRaw) ? shotTypeRaw : 'point') : null;
  const outcome = normalizeLower(raw.outcome, '') || '';
  const reviewResultRaw = normalizeLower(raw.conversion_result, 'unreviewed') || 'unreviewed';
  const conversionResult = KICKOUT_REVIEW_RESULTS.includes(reviewResultRaw) ? reviewResultRaw : 'unreviewed';
  const scoreSourceRaw = normalizeLower(raw.score_source, 'unreviewed') || 'unreviewed';
  const scoreSource = type === 'shot' && ['goal', 'point', 'two point', 'two-point'].includes(outcome)
    ? (SHOT_SCORE_SOURCES.includes(scoreSourceRaw) ? scoreSourceRaw : 'unreviewed')
    : null;

  return {
    ...raw,
    team_id: teamIdFallback ?? raw.team_id ?? null,
    event_type: type,
    direction: direction === 'theirs' ? 'theirs' : 'ours',
    target_player: type === 'turnover' ? null : (raw.target_player || ''),
    turnover_lost_player: type === 'turnover' ? (raw.turnover_lost_player || null) : null,
    turnover_won_player: type === 'turnover' ? (raw.turnover_won_player || null) : null,
    contest_type: contestType,
    break_outcome: isBreak ? normalizeLower(raw.break_outcome || '') : null,
    pickup_x: isBreak ? (raw.pickup_x ?? null) : null,
    pickup_y: isBreak ? (raw.pickup_y ?? null) : null,
    pickup_x_m: isBreak ? (raw.pickup_x_m ?? null) : null,
    pickup_y_m: isBreak ? (raw.pickup_y_m ?? null) : null,
    break_displacement_m: isBreak ? (raw.break_displacement_m ?? null) : null,
    restart_reason: type === 'kickout' ? (raw.restart_reason || null) : null,
    shot_type: shotType,
    conversion_result: type === 'kickout' || type === 'turnover' ? conversionResult : null,
    score_source: type === 'shot' ? scoreSource : null,
    period,
    flag: !!raw.flag,
    schema_version: raw.schema_version ?? CURRENT_EVENT_SCHEMA_VERSION,
  };
}
