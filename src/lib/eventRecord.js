export const CURRENT_EVENT_SCHEMA_VERSION = 1;

export function normalizeEventRecord(event, { teamIdFallback = null } = {}) {
  const raw = event ?? {};
  const type = raw.event_type || 'kickout';
  const contestType = type === 'kickout' ? (raw.contest_type || 'clean') : null;
  const isBreak = type === 'kickout' && contestType === 'break';

  return {
    ...raw,
    team_id: teamIdFallback ?? raw.team_id ?? null,
    event_type: type,
    direction: raw.direction || 'ours',
    contest_type: contestType,
    break_outcome: isBreak ? (raw.break_outcome || '') : null,
    pickup_x: isBreak ? (raw.pickup_x ?? null) : null,
    pickup_y: isBreak ? (raw.pickup_y ?? null) : null,
    pickup_x_m: isBreak ? (raw.pickup_x_m ?? null) : null,
    pickup_y_m: isBreak ? (raw.pickup_y_m ?? null) : null,
    break_displacement_m: isBreak ? (raw.break_displacement_m ?? null) : null,
    restart_reason: type === 'kickout' ? (raw.restart_reason || null) : null,
    shot_type: type === 'shot' ? (raw.shot_type || 'point') : null,
    flag: !!raw.flag,
    schema_version: raw.schema_version ?? CURRENT_EVENT_SCHEMA_VERSION,
  };
}
