export function compareEventOrder(a, b) {
  const seqA = Number.isFinite(a?.ko_sequence) ? a.ko_sequence : Number.MAX_SAFE_INTEGER;
  const seqB = Number.isFinite(b?.ko_sequence) ? b.ko_sequence : Number.MAX_SAFE_INTEGER;
  if (seqA !== seqB) return seqA - seqB;

  const createdCompare = String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
  if (createdCompare !== 0) return createdCompare;

  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function matchKeyForScore(event) {
  const matchDate = event?.match_date || String(event?.created_at || '').slice(0, 10);
  return [
    matchDate,
    String(event?.team || '').trim().toLowerCase(),
    String(event?.opponent || '').trim().toLowerCase(),
  ].join('|');
}

export function shotPoints(event) {
  const outcome = String(event?.outcome || '').toLowerCase();
  if (outcome === 'goal') return 3;
  if (outcome === 'point') return 1;
  return 0;
}

export function buildScoreSnapshots(events = []) {
  const byMatch = new Map();

  for (const event of events) {
    // Prefer match_id as the grouping key so that same-day replays
    // (same date + team + opponent but distinct match records) are scored
    // independently. Fall back to the logical key for legacy events without match_id.
    const key = event.match_id ?? matchKeyForScore(event);
    if (!byMatch.has(key)) byMatch.set(key, []);
    byMatch.get(key).push(event);
  }

  const snapshots = new Map();

  for (const matchEvents of byMatch.values()) {
    const ordered = [...matchEvents].sort(compareEventOrder);
    let us = 0;
    let them = 0;
    let usGoals = 0;
    let usPoints = 0;
    let themGoals = 0;
    let themPoints = 0;

    for (const event of ordered) {
      snapshots.set(event.id, {
        us,
        them,
        margin: us - them,
        usDisplay: `${usGoals}-${usPoints}`,
        themDisplay: `${themGoals}-${themPoints}`,
      });

      if ((event.event_type || 'kickout') !== 'shot') continue;

      const points = shotPoints(event);
      if (!points) continue;

      if ((event.direction || 'ours') === 'theirs') {
        them += points;
        if (points === 3) themGoals += 1;
        else themPoints += 1;
      } else {
        us += points;
        if (points === 3) usGoals += 1;
        else usPoints += 1;
      }
    }
  }

  return snapshots;
}
