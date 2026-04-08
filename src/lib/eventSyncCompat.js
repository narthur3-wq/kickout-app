const EVENT_SYNC_OPTIONAL_COLUMNS = Object.freeze(['conversion_result', 'score_source']);
const MISSING_EVENT_COLUMN_RE = /Could not find the '([^']+)' column of 'events' in the schema cache/i;

/**
 * @param {unknown} error
 * @returns {'conversion_result'|'score_source'|null}
 */
export function parseMissingEventSyncColumn(error) {
  const message = String(error && typeof error === 'object' && 'message' in error ? error.message : '');
  const match = message.match(MISSING_EVENT_COLUMN_RE);
  const column = match?.[1] ?? null;
  if (!column || !EVENT_SYNC_OPTIONAL_COLUMNS.includes(column)) return null;
  return /** @type {'conversion_result'|'score_source'} */ (column);
}

/**
 * @param {Record<string, unknown>} row
 * @param {Iterable<string>} columns
 * @returns {Record<string, unknown>}
 */
export function stripUnsupportedEventSyncColumns(row, columns) {
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
export function describeEventSyncCompatibility(columns = []) {
  const missingColumns = new Set(columns);
  const affectedFields = [];
  if (missingColumns.has('conversion_result')) affectedFields.push('conversion review');
  if (missingColumns.has('score_source')) affectedFields.push('score-source review');
  const fieldSummary = affectedFields.length > 0 ? affectedFields.join(' and ') : 'review tags';
  const verb = affectedFields.length > 1 ? 'stay' : 'stays';

  return `Cloud sync is missing the latest review-tag columns in Supabase. Core event data still syncs, but ${fieldSummary} ${verb} on this device until the latest database migration is applied.`;
}
