const RETAINED = new Set(['retained', 'score', 'won']);

function outcomeOf(event) {
  return String(event?.outcome || '').toLowerCase();
}

function shotTypeOf(event) {
  return String(event?.shot_type || 'point').toLowerCase();
}

export function buildShotSummary(events = [], analyticsEventType = 'ALL') {
  if (analyticsEventType !== 'shot') return null;
  const total = events.length;
  if (total < 3) return { tooFew: true };

  const goals = events.filter((event) => outcomeOf(event) === 'goal').length;
  const points = events.filter((event) => outcomeOf(event) === 'point').length;
  const scored = goals + points;

  const goalAttempts = events.filter((event) => {
    const outcome = outcomeOf(event);
    return outcome === 'goal' || outcome === 'saved' || ((outcome === 'wide' || outcome === 'blocked') && shotTypeOf(event) === 'goal');
  }).length;

  const pointAttempts = events.filter((event) => {
    const outcome = outcomeOf(event);
    return outcome === 'point' || ((outcome === 'wide' || outcome === 'blocked') && shotTypeOf(event) !== 'goal');
  }).length;

  return {
    total,
    scored,
    scoredPct: Math.round((100 * scored) / total),
    goalAttempts,
    goals,
    pointAttempts,
    points,
    small: total < 5,
  };
}

export function buildTurnoverSummary(events = [], analyticsEventType = 'ALL') {
  if (analyticsEventType !== 'turnover') return null;
  const total = events.length;
  if (total < 3) return { tooFew: true };
  const won = events.filter((event) => {
    const outcome = outcomeOf(event);
    return outcome === 'retained' || outcome === 'won';
  }).length;
  const lost = events.filter((event) => outcomeOf(event) === 'lost').length;
  return { total, won, lost, net: won - lost, small: total < 5 };
}

export function buildKickoutClockTrend(events = [], analyticsEventType = 'ALL') {
  if (analyticsEventType !== 'kickout') return [];
  const windows = [[0, 10, '0-10'], [10, 20, '10-20'], [20, 30, '20-30'], [30, 40, '30-40'], [40, 60, '40+']];
  const buckets = windows.map(([lo, hi, label]) => ({ label, lo, hi, tot: 0, ret: 0 }));

  for (const event of events) {
    if (!event?.clock) continue;
    const match = String(event.clock).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) continue;
    const mins = Number.parseInt(match[1], 10) + Number.parseInt(match[2], 10) / 60;
    const bucket = buckets.find((candidate) => mins >= candidate.lo && mins < candidate.hi);
    if (!bucket) continue;
    bucket.tot += 1;
    if (RETAINED.has(outcomeOf(event))) bucket.ret += 1;
  }

  return buckets
    .filter((bucket) => bucket.tot >= 2)
    .map((bucket) => ({ label: bucket.label, tot: bucket.tot, pct: Math.round((100 * bucket.ret) / bucket.tot) }));
}
