import { matchIdentityKey, normalizeMatchRecord } from './matchStore.js';

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableSerialize(value) {
  return JSON.stringify(canonicalize(value));
}

function logicalMatchKey(record) {
  const key = matchIdentityKey(record);
  const [date, team, opponent] = key.split('|');
  return date && team && opponent ? key : null;
}

function createMatchSeedFromEvent(event) {
  return {
    id: event.match_id || undefined,
    team: event.team,
    opponent: event.opponent,
    match_date: event.match_date || String(event.created_at || '').slice(0, 10),
  };
}

export function planImportMerge(existingEvents = [], importedEvents = []) {
  const existingById = new Map(existingEvents.map((event) => [event.id, stableSerialize(event)]));
  const conflictingById = new Map();
  const identicalById = new Map();
  const newEvents = [];

  for (const event of importedEvents) {
    const existing = existingById.get(event.id);
    if (!existing) {
      newEvents.push(event);
      continue;
    }

    const serializedImport = stableSerialize(event);
    if (existing === serializedImport) {
      identicalById.set(event.id, event);
    } else {
      conflictingById.set(event.id, event);
    }
  }

  return {
    newEvents,
    conflictingEvents: [...conflictingById.values()],
    identicalEvents: [...identicalById.values()],
    duplicateCount: conflictingById.size + identicalById.size,
    conflictingCount: conflictingById.size,
    identicalCount: identicalById.size,
  };
}

export function extractImportedEvents(parsed) {
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.events)) {
    return {
      eventArray: parsed.events,
      importedMatches: Array.isArray(parsed.matches) ? parsed.matches : [],
    };
  }
  if (Array.isArray(parsed)) {
    return { eventArray: parsed, importedMatches: [] };
  }
  throw new Error('Unrecognised import format. Expected a JSON array or { matches, events } object.');
}

export function mergeImportedMatches(existingMatches = [], importedMatches = [], importedEvents = [], options = {}) {
  const { teamId = null, userId = null } = options;
  const matches = [...existingMatches];
  const matchesById = new Map(existingMatches.map((match) => [match.id, match]));
  const matchesByKey = new Map();
  for (const match of existingMatches) {
    const key = logicalMatchKey(match);
    if (key) matchesByKey.set(key, match);
  }
  const importedIdToCanonicalId = new Map();

  let addedCount = 0;
  let linkedCount = 0;
  let createdFromEventsCount = 0;
  let sameIdConflictCount = 0;

  function registerMatch(match, { importedId = null, source = 'match' } = {}) {
    matches.push(match);
    matchesById.set(match.id, match);
    const key = logicalMatchKey(match);
    if (key) matchesByKey.set(key, match);
    if (importedId) importedIdToCanonicalId.set(importedId, match.id);
    if (source === 'event') {
      createdFromEventsCount += 1;
    } else {
      addedCount += 1;
    }
    return match.id;
  }

  for (const rawMatch of importedMatches) {
    const importedMatch = normalizeMatchRecord(rawMatch, {
      teamIdFallback: teamId,
      userIdFallback: userId,
    });
    const existingById = importedMatch.id ? matchesById.get(importedMatch.id) : null;
    const key = logicalMatchKey(importedMatch);
    const existingByKey = key ? matchesByKey.get(key) : null;

    if (existingById) {
      importedIdToCanonicalId.set(importedMatch.id, existingById.id);
      if (key && logicalMatchKey(existingById) !== key) {
        sameIdConflictCount += 1;
      }
      continue;
    }

    if (existingByKey) {
      importedIdToCanonicalId.set(importedMatch.id, existingByKey.id);
      linkedCount += 1;
      continue;
    }

    registerMatch(importedMatch, { importedId: importedMatch.id });
  }

  const events = importedEvents.map((event) => {
    const canonicalId = event.match_id
      ? importedIdToCanonicalId.get(event.match_id) || (matchesById.has(event.match_id) ? event.match_id : null)
      : null;
    if (canonicalId) {
      return { ...event, match_id: canonicalId };
    }

    const key = logicalMatchKey(event);
    if (key) {
      const existingMatch = matchesByKey.get(key);
      if (existingMatch) {
        return { ...event, match_id: existingMatch.id };
      }

      const createdMatch = normalizeMatchRecord(createMatchSeedFromEvent(event), {
        teamIdFallback: teamId,
        userIdFallback: userId,
      });
      const matchId = registerMatch(createdMatch, {
        importedId: event.match_id || null,
        source: 'event',
      });
      return { ...event, match_id: matchId };
    }

    return event;
  });

  return {
    matches,
    events,
    summary: {
      addedCount,
      linkedCount,
      createdFromEventsCount,
      sameIdConflictCount,
    },
  };
}

export function describeMatchImportSummary(summary) {
  if (!summary) return '';
  const notes = [];
  if (summary.addedCount > 0) notes.push(`Added ${summary.addedCount} new match record(s).`);
  if (summary.linkedCount > 0) notes.push(`Linked ${summary.linkedCount} imported match record(s) to existing matches.`);
  if (summary.createdFromEventsCount > 0) notes.push(`Created ${summary.createdFromEventsCount} match record(s) from imported event metadata.`);
  if (summary.sameIdConflictCount > 0) notes.push(`${summary.sameIdConflictCount} imported match record(s) reused an existing ID with different details.`);
  return notes.join(' ');
}

export function mergeImportedEvents(existingEvents = [], importedEvents = [], strategy = 'skip') {

  const plan = planImportMerge(existingEvents, importedEvents);
  const replacements = strategy === 'replace'
    ? new Map(plan.conflictingEvents.map((event) => [event.id, event]))
    : new Map();

  const mergedExisting = existingEvents.map((event) => replacements.get(event.id) || event);

  return {
    events: [...mergedExisting, ...plan.newEvents],
    upsertEvents: [...plan.newEvents, ...replacements.values()],
    plan,
  };
}
