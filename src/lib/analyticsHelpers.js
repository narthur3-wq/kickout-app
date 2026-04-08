import { kickoutOutcomeSideOf } from './kickoutOutcome.js';

const RETAINED = new Set(['retained', 'score', 'won']);
const REVIEW_RESULTS = new Set(['score', 'no_score', 'unreviewed']);
const SCORE_SOURCES = new Set(['kickout', 'turnover', 'settled', 'free', 'other', 'unreviewed']);
const SCORING_SHOT_OUTCOMES = new Set(['goal', 'point', 'two point', 'two-point']);

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

function titleCase(value, fallback = 'Unknown') {
  const label = String(value ?? '').trim();
  if (!label) return fallback;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function reviewResultOf(event) {
  const type = String(event?.event_type || 'kickout').toLowerCase();
  if (type === 'shot') return null;
  const value = String(event?.conversion_result || 'unreviewed').toLowerCase() || 'unreviewed';
  return REVIEW_RESULTS.has(value) ? value : 'unreviewed';
}

function scoreSourceOf(event) {
  const value = String(event?.score_source || 'unreviewed').toLowerCase() || 'unreviewed';
  return SCORE_SOURCES.has(value) ? value : 'unreviewed';
}

function isScoringShot(event) {
  return String(event?.event_type || 'kickout').toLowerCase() === 'shot'
    && SCORING_SHOT_OUTCOMES.has(outcomeOf(event));
}

function summarizeByPeriod(events = [], eventType = 'kickout') {
  const periods = ['H1', 'H2', 'ET'];
  return periods
    .map((period) => {
      const bucket = events.filter((event) => String(event?.event_type || 'kickout').toLowerCase() === eventType
        && String(event?.period || 'H1') === period);
      if (bucket.length === 0) return null;
      const reviewed = bucket.filter((event) => reviewResultOf(event) !== 'unreviewed').length;
      const scored = bucket.filter((event) => reviewResultOf(event) === 'score').length;
      return {
        period,
        total: bucket.length,
        reviewed,
        scored,
        noScore: reviewed - scored,
        pct: reviewed ? Math.round((100 * scored) / reviewed) : null,
      };
    })
    .filter(Boolean);
}

function summarizeByField(events = [], eventType = 'kickout', field = 'contest_type') {
  const buckets = new Map();
  for (const event of events) {
    if (String(event?.event_type || 'kickout').toLowerCase() !== eventType) continue;
    const key = String(event?.[field] || '').trim() || 'Unknown';
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: titleCase(key),
        total: 0,
        reviewed: 0,
        scored: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.total += 1;
    const result = reviewResultOf(event);
    if (result !== 'unreviewed') {
      bucket.reviewed += 1;
      if (result === 'score') bucket.scored += 1;
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      noScore: bucket.reviewed - bucket.scored,
      pct: bucket.reviewed ? Math.round((100 * bucket.scored) / bucket.reviewed) : null,
    }))
    .filter((bucket) => bucket.reviewed > 0)
    .sort((a, b) => b.reviewed - a.reviewed || b.total - a.total || a.label.localeCompare(b.label));
}

function summarizeConversionByType(events = [], eventType = 'kickout', groupField = null) {
  const filtered = events.filter((event) => String(event?.event_type || 'kickout').toLowerCase() === eventType);
  const total = filtered.length;
  const reviewed = filtered.filter((event) => reviewResultOf(event) !== 'unreviewed');
  const scored = reviewed.filter((event) => reviewResultOf(event) === 'score').length;
  const noScore = reviewed.length - scored;

  return {
    total,
    reviewed: reviewed.length,
    scored,
    noScore,
    unreviewed: total - reviewed.length,
    reviewedPct: total ? Math.round((100 * reviewed.length) / total) : null,
    scorePct: reviewed.length ? Math.round((100 * scored) / reviewed.length) : null,
    small: total < 5,
    byPeriod: summarizeByPeriod(filtered, eventType),
    byField: groupField ? summarizeByField(filtered, eventType, groupField) : [],
  };
}

function summarizeScoreSources(events = []) {
  const scoredShots = events.filter(isScoringShot);
  const reviewed = scoredShots.filter((event) => scoreSourceOf(event) !== 'unreviewed');
  const buckets = new Map();

  for (const shot of reviewed) {
    const key = scoreSourceOf(shot);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: titleCase(key),
        count: 0,
      });
    }
    buckets.get(key).count += 1;
  }

  return {
    total: scoredShots.length,
    reviewed: reviewed.length,
    unreviewed: scoredShots.length - reviewed.length,
    small: scoredShots.length < 5,
    rows: [...buckets.values()]
      .map((row) => ({
        ...row,
        pct: reviewed.length ? Math.round((100 * row.count) / reviewed.length) : null,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export function buildRetrospectiveConversionSummary(events = []) {
  return {
    kickout: summarizeConversionByType(events, 'kickout', 'contest_type'),
    turnover: summarizeConversionByType(events, 'turnover', 'zone_code'),
    scoreSource: summarizeScoreSources(events),
  };
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
    if (kickoutOutcomeSideOf(event) === 'selected' || RETAINED.has(outcomeOf(event))) bucket.ret += 1;
  }

  return buckets
    .filter((bucket) => bucket.tot >= 2)
    .map((bucket) => ({ label: bucket.label, tot: bucket.tot, pct: Math.round((100 * bucket.ret) / bucket.tot) }));
}
