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
