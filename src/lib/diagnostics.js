const DIAGNOSTICS_KEY = 'ko_diagnostics';
const DEFAULT_LIMIT = 40;

function safeParseDiagnostics(storage) {
  if (!storage) return [];

  try {
    const raw = JSON.parse(storage.getItem(DIAGNOSTICS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry === 'object') : [];
  } catch {
    return [];
  }
}

export function loadDiagnostics(options = {}) {
  const { storage = globalThis.localStorage } = options;
  return safeParseDiagnostics(storage);
}

export function appendDiagnostic(entry, options = {}) {
  const { storage = globalThis.localStorage, limit = DEFAULT_LIMIT } = options;
  if (!storage) return [];

  const next = [
    {
      ts: new Date().toISOString(),
      kind: entry?.kind || 'info',
      message: String(entry?.message || ''),
      details: entry?.details ?? null,
      context: entry?.context ?? null,
    },
    ...safeParseDiagnostics(storage),
  ].slice(0, limit);

  try {
    storage.setItem(DIAGNOSTICS_KEY, JSON.stringify(next));
  } catch {}

  return next;
}

export function clearDiagnostics(options = {}) {
  const { storage = globalThis.localStorage } = options;
  if (!storage) return;

  try {
    storage.removeItem(DIAGNOSTICS_KEY);
  } catch {}
}

export function formatDiagnostics(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return 'No diagnostics recorded.';

  return entries.map((entry, index) => {
    const lines = [
      `${index + 1}. ${entry.ts || 'unknown time'} [${entry.kind || 'info'}] ${entry.message || ''}`.trim(),
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      lines.push(`   context: ${JSON.stringify(entry.context)}`);
    }

    if (entry.details && (typeof entry.details !== 'object' || Object.keys(entry.details).length > 0)) {
      lines.push(`   details: ${JSON.stringify(entry.details)}`);
    }

    return lines.join('\n');
  }).join('\n\n');
}

export function summarizeDiagnostics(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      total: 0,
      byKind: {},
      latestAt: null,
    };
  }

  const byKind = {};
  let latestAt = null;

  for (const entry of entries) {
    const kind = entry?.kind || 'info';
    byKind[kind] = (byKind[kind] || 0) + 1;

    if (entry?.ts && (!latestAt || String(entry.ts) > latestAt)) {
      latestAt = String(entry.ts);
    }
  }

  return {
    total: entries.length,
    byKind,
    latestAt,
  };
}

export function buildDiagnosticsExport(entries = [], meta = {}) {
  const safeEntries = Array.isArray(entries) ? entries : [];

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    summary: summarizeDiagnostics(safeEntries),
    meta: meta && typeof meta === 'object' ? meta : {},
    entries: safeEntries,
  };
}
