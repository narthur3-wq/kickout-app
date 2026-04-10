const OPTIONAL_POSSESSION_EVENT_SYNC_COLUMNS = Object.freeze(['carry_waypoints', 'target_x', 'target_y']);
const MISSING_POSSESSION_EVENT_COLUMN_RE = /Could not find the '([^']+)' column of 'possession_events' in the schema cache/i;

/**
 * @param {unknown} error
 * @returns {'carry_waypoints'|'target_x'|'target_y'|null}
 */
export function parseMissingPossessionEventSyncColumn(error) {
  const message = String(error && typeof error === 'object' && 'message' in error ? error.message : '');
  const match = message.match(MISSING_POSSESSION_EVENT_COLUMN_RE);
  const column = match?.[1] ?? null;
  if (!column || !OPTIONAL_POSSESSION_EVENT_SYNC_COLUMNS.includes(column)) return null;
  return /** @type {'carry_waypoints'|'target_x'|'target_y'} */ (column);
}

/**
 * @param {Record<string, unknown>} row
 * @param {Iterable<string>} columns
 * @returns {Record<string, unknown>}
 */
export function stripUnsupportedPossessionEventSyncColumns(row, columns) {
  const nextRow = { ...row };
  for (const column of columns) {
    delete nextRow[column];
  }
  return nextRow;
}

/**
 * @param {Iterable<string>} columns
 * @returns {string}
 */
export function describeAnalysisSyncCompatibility(columns = []) {
  const missingColumns = new Set(columns);
  const affectedFields = [];
  if (missingColumns.has('carry_waypoints')) affectedFields.push('carry-path waypoints');
  if (missingColumns.has('target_x') || missingColumns.has('target_y')) affectedFields.push('ball destinations');

  const fieldSummary = affectedFields.length > 0 ? affectedFields.join(' and ') : 'possession path data';
  const verb = affectedFields.length > 1 ? 'stay' : 'stays';

  return `Cloud sync is missing the latest possession-path columns in Supabase. Core possession sessions still sync, but ${fieldSummary} ${verb} on this device until the latest database migration is applied.`;
}
