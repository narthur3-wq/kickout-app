/**
 * Generates the demo seed file: documentation/demo/demo-match-2026.json
 *
 * Output is in the app's own import format ({ matches, events }), so it is
 * loaded through the tested Import JSON path rather than hand-written SQL.
 * Re-run after editing to regenerate:
 *
 *   node documentation/demo/build-demo-match.mjs
 *
 * IDs are deterministic so re-importing updates the same rows instead of
 * creating duplicates — that is what makes this usable as a demo reset.
 */
import { writeFileSync } from 'node:fs';

const MATCH_ID = 'de300000-0000-4000-8000-000000000001';
const MATCH_DATE = '2026-06-14';
const TEAM = 'Clontarf';
const OPPONENT = 'Na Fianna';
const THROW_IN = Date.UTC(2026, 5, 14, 14, 0, 0);

const X = { Left: 0.22, Centre: 0.5, Right: 0.78 };
const Y = { Short: 0.14, Medium: 0.32, Long: 0.56, 'Very Long': 0.8 };

let seq = 0;

function isoAt(period, clock) {
  const [m, s] = String(clock).split(':').map(Number);
  const offset = (period === 'H2' ? 35 : 0) + m;
  return new Date(THROW_IN + offset * 60_000 + (s || 0) * 1000).toISOString();
}

function zoneCode(side, depth) {
  return `${side.charAt(0).toUpperCase()}-${depth.charAt(0).toUpperCase()}`;
}

function ev({
  period, clock, type, direction, outcome,
  side = 'Centre', depth = 'Medium',
  player = '', contest = 'clean', shotType = null, restart = null,
  wonBy = null, lostBy = null, jitter = 0,
}) {
  seq += 1;
  const x = Math.min(0.95, Math.max(0.05, X[side] + jitter));
  const y = Math.min(0.95, Math.max(0.05, Y[depth] + jitter));

  return {
    id: `demo-${String(seq).padStart(3, '0')}`,
    match_id: MATCH_ID,
    created_at: isoAt(period, clock),
    match_date: MATCH_DATE,
    team: TEAM,
    opponent: OPPONENT,
    period,
    clock,
    event_type: type,
    direction,
    outcome,
    target_player: type === 'turnover' ? null : player,
    turnover_won_player: type === 'turnover' ? wonBy : null,
    turnover_lost_player: type === 'turnover' ? lostBy : null,
    contest_type: type === 'kickout' ? contest : null,
    break_outcome: null,
    x: +x.toFixed(3),
    y: +y.toFixed(3),
    x_m: +(x * 90).toFixed(2),
    y_m: +(y * 145).toFixed(2),
    depth_from_own_goal_m: +(y * 145).toFixed(2),
    side_band: side,
    depth_band: depth,
    zone_code: zoneCode(side, depth),
    our_goal_at_top: true,
    pickup_x: null,
    pickup_y: null,
    pickup_x_m: null,
    pickup_y_m: null,
    break_displacement_m: null,
    score_us: null,
    score_them: null,
    flag: false,
    restart_reason: type === 'kickout' ? restart : null,
    shot_type: type === 'shot' ? shotType : null,
    ko_sequence: seq,
    schema_version: 1,
  };
}

// A club championship match that actually tells a story: Clontarf lose the
// first-half kickout battle and trail, fix the restart in the second half and
// win it late. Zones and outcomes are spread so every analytics tab, the
// heatmaps and the digest all have something real to show.
const events = [
  // ── First half — Na Fianna on top ──
  ev({ period: 'H1', clock: '00:40', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Right', depth: 'Medium', player: '9', restart: 'Score' }),
  ev({ period: 'H1', clock: '01:20', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Centre', depth: 'Medium', player: '11', shotType: 'point' }),
  ev({ period: 'H1', clock: '02:10', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Left', depth: 'Long', player: '8', restart: 'Point' }),
  ev({ period: 'H1', clock: '03:05', type: 'shot', direction: 'theirs', outcome: 'Wide', side: 'Left', depth: 'Medium', player: '13', shotType: 'point' }),
  ev({ period: 'H1', clock: '04:30', type: 'kickout', direction: 'ours', outcome: 'Lost', side: 'Left', depth: 'Short', player: '6', restart: 'Wide', contest: 'break' }),
  ev({ period: 'H1', clock: '05:15', type: 'turnover', direction: 'theirs', outcome: 'Lost', side: 'Centre', depth: 'Long', lostBy: '5' }),
  ev({ period: 'H1', clock: '06:00', type: 'shot', direction: 'theirs', outcome: 'Point', side: 'Centre', depth: 'Medium', player: '11', shotType: 'point' }),
  ev({ period: 'H1', clock: '07:40', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Right', depth: 'Short', player: '4', restart: 'Point' }),
  ev({ period: 'H1', clock: '08:50', type: 'shot', direction: 'ours', outcome: 'Wide', side: 'Right', depth: 'Long', player: '14', shotType: 'point' }),
  ev({ period: 'H1', clock: '10:05', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Right', depth: 'Medium', player: '9', restart: 'Wide' }),
  ev({ period: 'H1', clock: '11:30', type: 'shot', direction: 'theirs', outcome: 'Goal', side: 'Centre', depth: 'Short', player: '14', shotType: 'goal' }),
  ev({ period: 'H1', clock: '12:10', type: 'kickout', direction: 'ours', outcome: 'Lost', side: 'Centre', depth: 'Long', player: '9', restart: 'Goal' }),
  ev({ period: 'H1', clock: '13:25', type: 'turnover', direction: 'ours', outcome: 'Won', side: 'Left', depth: 'Medium', wonBy: '7' }),
  ev({ period: 'H1', clock: '14:15', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Left', depth: 'Medium', player: '10', shotType: 'point' }),
  ev({ period: 'H1', clock: '15:40', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Left', depth: 'Medium', player: '6', restart: 'Point' }),
  ev({ period: 'H1', clock: '17:00', type: 'shot', direction: 'theirs', outcome: 'Point', side: 'Right', depth: 'Medium', player: '10', shotType: 'point' }),
  ev({ period: 'H1', clock: '18:20', type: 'kickout', direction: 'ours', outcome: 'Lost', side: 'Left', depth: 'Medium', player: '8', restart: 'Point', contest: 'break' }),
  ev({ period: 'H1', clock: '19:10', type: 'shot', direction: 'theirs', outcome: 'Saved', side: 'Centre', depth: 'Short', player: '15', shotType: 'goal' }),
  ev({ period: 'H1', clock: '20:35', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Right', depth: 'Medium', player: '5', restart: 'Save' }),
  ev({ period: 'H1', clock: '21:50', type: 'turnover', direction: 'theirs', outcome: 'Lost', side: 'Right', depth: 'Long', lostBy: '12' }),
  ev({ period: 'H1', clock: '23:05', type: 'shot', direction: 'theirs', outcome: 'Point', side: 'Left', depth: 'Long', player: '11', shotType: 'point' }),
  ev({ period: 'H1', clock: '24:30', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Centre', depth: 'Medium', player: '8', restart: 'Point' }),
  ev({ period: 'H1', clock: '26:00', type: 'shot', direction: 'ours', outcome: 'Blocked', side: 'Centre', depth: 'Short', player: '13', shotType: 'point' }),
  ev({ period: 'H1', clock: '27:20', type: 'turnover', direction: 'ours', outcome: 'Won', side: 'Centre', depth: 'Medium', wonBy: '8' }),
  ev({ period: 'H1', clock: '28:15', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Centre', depth: 'Medium', player: '11', shotType: 'point' }),
  ev({ period: 'H1', clock: '29:40', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Right', depth: 'Short', player: '2', restart: 'Point' }),
  ev({ period: 'H1', clock: '31:05', type: 'shot', direction: 'ours', outcome: 'Wide', side: 'Left', depth: 'Long', player: '10', shotType: 'point' }),
  ev({ period: 'H1', clock: '32:30', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Right', depth: 'Long', player: '9', restart: 'Wide' }),
  ev({ period: 'H1', clock: '33:50', type: 'shot', direction: 'theirs', outcome: 'Point', side: 'Centre', depth: 'Medium', player: '13', shotType: 'point' }),

  // ── Second half — Clontarf fix the restart ──
  ev({ period: 'H2', clock: '00:35', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Left', depth: 'Short', player: '6', restart: 'Score' }),
  ev({ period: 'H2', clock: '01:45', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Centre', depth: 'Medium', player: '14', shotType: 'point' }),
  ev({ period: 'H2', clock: '03:00', type: 'kickout', direction: 'theirs', outcome: 'Lost', side: 'Centre', depth: 'Medium', player: '9', restart: 'Point' }),
  ev({ period: 'H2', clock: '03:50', type: 'turnover', direction: 'ours', outcome: 'Won', side: 'Centre', depth: 'Long', wonBy: '9' }),
  ev({ period: 'H2', clock: '04:40', type: 'shot', direction: 'ours', outcome: 'Goal', side: 'Centre', depth: 'Short', player: '13', shotType: 'goal' }),
  ev({ period: 'H2', clock: '05:30', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Left', depth: 'Long', player: '8', restart: 'Goal' }),
  ev({ period: 'H2', clock: '06:55', type: 'shot', direction: 'theirs', outcome: 'Wide', side: 'Left', depth: 'Long', player: '10', shotType: 'point' }),
  ev({ period: 'H2', clock: '08:10', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Right', depth: 'Medium', player: '9', restart: 'Wide' }),
  ev({ period: 'H2', clock: '09:25', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Right', depth: 'Medium', player: '15', shotType: 'point' }),
  ev({ period: 'H2', clock: '10:40', type: 'kickout', direction: 'theirs', outcome: 'Lost', side: 'Right', depth: 'Short', player: '4', restart: 'Point', contest: 'break' }),
  ev({ period: 'H2', clock: '11:30', type: 'turnover', direction: 'ours', outcome: 'Won', side: 'Right', depth: 'Medium', wonBy: '12' }),
  ev({ period: 'H2', clock: '12:20', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Right', depth: 'Medium', player: '11', shotType: 'point' }),
  ev({ period: 'H2', clock: '13:45', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Centre', depth: 'Medium', player: '8', restart: 'Point' }),
  ev({ period: 'H2', clock: '15:00', type: 'shot', direction: 'ours', outcome: 'Wide', side: 'Centre', depth: 'Long', player: '10', shotType: 'point' }),
  ev({ period: 'H2', clock: '16:20', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Centre', depth: 'Medium', player: '9', restart: 'Wide' }),
  ev({ period: 'H2', clock: '17:40', type: 'shot', direction: 'theirs', outcome: 'Point', side: 'Right', depth: 'Medium', player: '11', shotType: 'point' }),
  ev({ period: 'H2', clock: '19:05', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Left', depth: 'Medium', player: '7', restart: 'Point' }),
  ev({ period: 'H2', clock: '20:15', type: 'turnover', direction: 'theirs', outcome: 'Lost', side: 'Left', depth: 'Medium', lostBy: '6' }),
  ev({ period: 'H2', clock: '21:30', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Left', depth: 'Medium', player: '14', shotType: 'point' }),
  ev({ period: 'H2', clock: '22:50', type: 'kickout', direction: 'theirs', outcome: 'Lost', side: 'Left', depth: 'Medium', player: '6', restart: 'Point' }),
  ev({ period: 'H2', clock: '23:40', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Centre', depth: 'Medium', player: '11', shotType: 'point' }),
  ev({ period: 'H2', clock: '25:10', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Right', depth: 'Short', player: '3', restart: 'Point' }),
  ev({ period: 'H2', clock: '26:35', type: 'shot', direction: 'ours', outcome: 'Blocked', side: 'Right', depth: 'Short', player: '15', shotType: 'point' }),
  ev({ period: 'H2', clock: '27:55', type: 'turnover', direction: 'ours', outcome: 'Won', side: 'Centre', depth: 'Medium', wonBy: '5' }),
  ev({ period: 'H2', clock: '29:10', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Centre', depth: 'Long', player: '10', shotType: 'point' }),
  ev({ period: 'H2', clock: '30:40', type: 'kickout', direction: 'theirs', outcome: 'Won', side: 'Right', depth: 'Long', player: '8', restart: 'Point' }),
  ev({ period: 'H2', clock: '32:00', type: 'shot', direction: 'theirs', outcome: 'Point', side: 'Centre', depth: 'Long', player: '13', shotType: 'point' }),
  ev({ period: 'H2', clock: '33:20', type: 'kickout', direction: 'ours', outcome: 'Retained', side: 'Left', depth: 'Short', player: '5', restart: 'Point' }),
  ev({ period: 'H2', clock: '34:30', type: 'shot', direction: 'ours', outcome: 'Point', side: 'Right', depth: 'Medium', player: '14', shotType: 'point' }),
];

const match = {
  id: MATCH_ID,
  team_id: null,
  team: TEAM,
  opponent: OPPONENT,
  match_date: MATCH_DATE,
  // Left open, not closed: a closed match is read-only, and the demo is more
  // convincing if a visitor can capture a few events on top of a real one.
  status: 'open',
  created_at: new Date(THROW_IN).toISOString(),
  updated_at: new Date(THROW_IN + 75 * 60_000).toISOString(),
  last_event_at: new Date(THROW_IN + 70 * 60_000).toISOString(),
  created_by: null,
  closed_at: null,
};

const payload = { matches: [match], events };
const outPath = new URL('./demo-match-2026.json', import.meta.url);
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

// Summary so a regeneration is self-checking.
const tally = (pred) => events.filter(pred).length;
const scoreFor = (dir) => {
  const goals = tally((e) => e.event_type === 'shot' && e.direction === dir && e.outcome === 'Goal');
  const points = tally((e) => e.event_type === 'shot' && e.direction === dir && e.outcome === 'Point');
  return `${goals}-${String(points).padStart(2, '0')}`;
};

console.log(`Wrote ${events.length} events to demo-match-2026.json`);
console.log(`  ${TEAM} ${scoreFor('ours')}  —  ${OPPONENT} ${scoreFor('theirs')}   (${MATCH_DATE})`);
console.log(`  kickouts ${tally((e) => e.event_type === 'kickout')}, shots ${tally((e) => e.event_type === 'shot')}, turnovers ${tally((e) => e.event_type === 'turnover')}`);
