const MATCH_DATE = '2026-03-25';
const TEAM = 'Clontarf';
const OPPONENT = 'Vincents';

function zoneCode(sideBand, depthBand) {
  return `${String(sideBand || 'Centre').charAt(0).toUpperCase()}-${String(depthBand || 'Medium').charAt(0).toUpperCase()}`;
}

function isoFor(clock, offsetMinutes = 0) {
  const [minutes, seconds] = String(clock).split(':').map(Number);
  const date = new Date(Date.UTC(2026, 2, 25, 13, 0, 0));
  date.setUTCMinutes(date.getUTCMinutes() + minutes + offsetMinutes);
  date.setUTCSeconds(seconds || 0);
  return date.toISOString();
}

function buildEvent({
  id,
  sequence,
  clock,
  eventType = 'kickout',
  direction = 'ours',
  outcome,
  targetPlayer = '',
  sideBand = 'Centre',
  depthBand = 'Medium',
  contestType = 'clean',
  breakOutcome = null,
  shotType = null,
  restartReason = null,
  period = 'H1',
}) {
  const xLookup = { Left: 0.2, Centre: 0.5, Right: 0.8 };
  const yLookup = { Short: 0.12, Medium: 0.3, Long: 0.55, 'Very Long': 0.78 };
  const x = xLookup[sideBand] ?? 0.5;
  const y = yLookup[depthBand] ?? 0.3;

  return {
    id,
    created_at: isoFor(clock, sequence),
    match_date: MATCH_DATE,
    team: TEAM,
    opponent: OPPONENT,
    period,
    clock,
    target_player: targetPlayer,
    outcome,
    contest_type: eventType === 'kickout' ? contestType : null,
    break_outcome: eventType === 'kickout' && contestType === 'break' ? breakOutcome : null,
    x,
    y,
    x_m: +(x * 90).toFixed(2),
    y_m: +(y * 145).toFixed(2),
    depth_from_own_goal_m: +(y * 145).toFixed(2),
    side_band: sideBand,
    depth_band: depthBand,
    zone_code: zoneCode(sideBand, depthBand),
    our_goal_at_top: true,
    event_type: eventType,
    direction,
    pickup_x: null,
    pickup_y: null,
    pickup_x_m: null,
    pickup_y_m: null,
    break_displacement_m: null,
    score_us: null,
    score_them: null,
    flag: false,
    restart_reason: eventType === 'kickout' ? restartReason : null,
    shot_type: eventType === 'shot' ? (shotType || 'point') : null,
    ko_sequence: sequence,
    schema_version: 1,
  };
}

export function buildSimulatedMatchState() {
  const events = [
    buildEvent({ id: 's1', sequence: 1, clock: '02:00', eventType: 'shot', direction: 'ours', outcome: 'Point', sideBand: 'Right', depthBand: 'Medium', shotType: 'point' }),
    buildEvent({ id: 's2', sequence: 2, clock: '04:00', eventType: 'shot', direction: 'ours', outcome: 'Goal', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '13', shotType: 'goal' }),
    buildEvent({ id: 'k1', sequence: 3, clock: '06:00', direction: 'ours', outcome: 'Retained', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '9', restartReason: 'Score' }),
    buildEvent({ id: 'k2', sequence: 4, clock: '08:00', direction: 'theirs', outcome: 'Won', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '8', restartReason: 'Score' }),
    buildEvent({ id: 's3', sequence: 5, clock: '09:00', eventType: 'shot', direction: 'theirs', outcome: 'Point', sideBand: 'Left', depthBand: 'Medium', targetPlayer: '11', shotType: 'point' }),
    buildEvent({ id: 'k3', sequence: 6, clock: '11:00', direction: 'theirs', outcome: 'Won', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '8', restartReason: 'Wide' }),
    buildEvent({ id: 's4', sequence: 7, clock: '12:00', eventType: 'shot', direction: 'theirs', outcome: 'Point', sideBand: 'Left', depthBand: 'Medium', targetPlayer: '11', shotType: 'point' }),
    buildEvent({ id: 'k4', sequence: 8, clock: '14:00', direction: 'ours', outcome: 'Lost', sideBand: 'Left', depthBand: 'Short', targetPlayer: '6', restartReason: 'Point' }),
    buildEvent({ id: 'k5', sequence: 9, clock: '16:00', direction: 'theirs', outcome: 'Won', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '8', restartReason: 'Point' }),
    buildEvent({ id: 's5', sequence: 10, clock: '17:00', eventType: 'shot', direction: 'theirs', outcome: 'Point', sideBand: 'Left', depthBand: 'Short', targetPlayer: '14', shotType: 'point' }),
    buildEvent({ id: 'k6', sequence: 11, clock: '18:00', direction: 'ours', outcome: 'Lost', sideBand: 'Left', depthBand: 'Short', targetPlayer: '6', restartReason: 'Wide' }),
    buildEvent({ id: 's6', sequence: 12, clock: '20:00', eventType: 'shot', direction: 'theirs', outcome: 'Goal', sideBand: 'Left', depthBand: 'Medium', targetPlayer: '11', shotType: 'goal' }),
    buildEvent({ id: 'k7', sequence: 13, clock: '22:00', direction: 'theirs', outcome: 'Won', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '8', restartReason: 'Score' }),
    buildEvent({ id: 'k8', sequence: 14, clock: '24:00', direction: 'ours', outcome: 'Retained', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '10', restartReason: 'Goal' }),
    buildEvent({ id: 's7', sequence: 15, clock: '25:00', eventType: 'shot', direction: 'ours', outcome: 'Point', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '14', shotType: 'point' }),
    buildEvent({ id: 'k9', sequence: 16, clock: '27:00', direction: 'ours', outcome: 'Retained', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '10', restartReason: 'Point' }),
    buildEvent({ id: 's8', sequence: 17, clock: '28:00', eventType: 'shot', direction: 'ours', outcome: 'Point', sideBand: 'Right', depthBand: 'Short', targetPlayer: '14', shotType: 'point' }),
    buildEvent({ id: 'k10', sequence: 18, clock: '30:00', direction: 'theirs', outcome: 'Lost', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '8', restartReason: 'Score' }),
    buildEvent({ id: 'k11', sequence: 19, clock: '32:00', direction: 'ours', outcome: 'Retained', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '11', restartReason: 'Point' }),
    buildEvent({ id: 's9', sequence: 20, clock: '33:00', eventType: 'shot', direction: 'ours', outcome: 'Point', sideBand: 'Right', depthBand: 'Medium', targetPlayer: '15', shotType: 'point' }),
    buildEvent({ id: 's10', sequence: 21, clock: '35:00', eventType: 'shot', direction: 'theirs', outcome: 'Point', sideBand: 'Left', depthBand: 'Medium', targetPlayer: '11', shotType: 'point' }),
  ];

  return {
    events,
    meta: {
      team: TEAM,
      opponent: OPPONENT,
      match_date: MATCH_DATE,
      period: 'H1',
      our_goal_at_top: true,
    },
    pendingSync: [],
  };
}
