const RETAINED = new Set(['retained', 'score', 'won']);

function outcomeOf(event) {
  return String(event?.outcome || '').toLowerCase();
}

function shotTypeOf(event) {
  return String(event?.shot_type || 'point').toLowerCase();
}

function parseClockMinutes(clock) {
  const match = String(clock || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) + Number.parseInt(match[2], 10) / 60;
}

function periodBase(period) {
  if (period === 'H2') return 40;
  if (period === 'ET') return 80;
  return 0;
}

export function buildShotSummary(events = [], analyticsEventType = 'ALL') {
  if (analyticsEventType !== 'shot') return null;
  const total = events.length;
  if (total < 3) return { tooFew: true };

  const goals = events.filter((event) => outcomeOf(event) === 'goal').length;
  const points = events.filter((event) => {
    const outcome = outcomeOf(event);
    return outcome === 'point' || outcome === 'two point' || outcome === 'two-point';
  }).length;
  const scored = goals + points;

  const goalAttempts = events.filter((event) => {
    const outcome = outcomeOf(event);
    return outcome === 'goal'
      || outcome === 'saved'
      || ((outcome === 'wide' || outcome === 'blocked' || outcome === 'dropped short') && shotTypeOf(event) === 'goal');
  }).length;

  const pointAttempts = events.filter((event) => {
    const outcome = outcomeOf(event);
    return outcome === 'point'
      || outcome === 'two point'
      || outcome === 'two-point'
      || ((outcome === 'wide' || outcome === 'blocked' || outcome === 'dropped short') && shotTypeOf(event) !== 'goal');
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
  const windows = [
    { lo: 0, hi: 10, label: '0-10' },
    { lo: 10, hi: 20, label: '10-20' },
    { lo: 20, hi: 30, label: '20-30' },
    { lo: 30, hi: 40, label: '30-40' },
    { lo: 40, hi: 50, label: '40-50' },
    { lo: 50, hi: 60, label: '50-60' },
    { lo: 60, hi: 70, label: '60-70' },
    { lo: 70, hi: 80, label: '70-80' },
    { lo: 80, hi: 90, label: '80-90' },
    { lo: 90, hi: Infinity, label: '90+' },
  ];
  const buckets = windows.map(({ lo, hi, label }) => ({ label, lo, hi, tot: 0, ret: 0 }));

  for (const event of events) {
    if (!event?.clock) continue;
    const mins = parseClockMinutes(event.clock);
    if (mins == null) continue;
    const absoluteMinutes = periodBase(String(event?.period || 'H1')) + mins;
    const bucket = buckets.find((candidate) => absoluteMinutes >= candidate.lo && absoluteMinutes < candidate.hi);
    if (!bucket) continue;
    bucket.tot += 1;
    if (RETAINED.has(outcomeOf(event))) bucket.ret += 1;
  }

  return buckets
    .filter((bucket) => bucket.tot >= 2)
    .map((bucket) => ({ label: bucket.label, tot: bucket.tot, pct: Math.round((100 * bucket.ret) / bucket.tot) }));
}
