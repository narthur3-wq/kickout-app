import { afterEach, describe, expect, it } from 'vitest';
import {
  appendDiagnostic,
  buildDiagnosticsExport,
  clearDiagnostics,
  formatDiagnostics,
  loadDiagnostics,
  summarizeDiagnostics,
} from './diagnostics.js';

describe('diagnostics helpers', () => {
  afterEach(() => {
    clearDiagnostics();
  });

  it('stores, loads, and formats diagnostic entries', () => {
    appendDiagnostic({
      kind: 'sync',
      message: 'Sync failed',
      details: { error: 'Network lost' },
      context: { team: 'Clontarf' },
    });

    const entries = loadDiagnostics();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'sync',
      message: 'Sync failed',
      details: { error: 'Network lost' },
      context: { team: 'Clontarf' },
    });
    expect(formatDiagnostics(entries)).toContain('[sync] Sync failed');
    expect(formatDiagnostics(entries)).toContain('"team":"Clontarf"');
  });

  it('clears the stored diagnostics log', () => {
    appendDiagnostic({ kind: 'storage', message: 'Write failed' });
    clearDiagnostics();
    expect(loadDiagnostics()).toEqual([]);
  });

  it('builds a structured export payload with summary metadata', () => {
    const entries = [
      {
        ts: '2026-04-07T10:00:00.000Z',
        kind: 'sync',
        message: 'Sync failed',
      },
      {
        ts: '2026-04-07T10:05:00.000Z',
        kind: 'support',
        message: 'Clipboard unavailable',
      },
    ];

    expect(summarizeDiagnostics(entries)).toEqual({
      total: 2,
      byKind: {
        sync: 1,
        support: 1,
      },
      latestAt: '2026-04-07T10:05:00.000Z',
    });

    const exportPayload = buildDiagnosticsExport(entries, { user_email: 'analyst@example.com' });
    expect(exportPayload).toMatchObject({
      version: 1,
      meta: { user_email: 'analyst@example.com' },
      summary: {
        total: 2,
        byKind: {
          sync: 1,
          support: 1,
        },
        latestAt: '2026-04-07T10:05:00.000Z',
      },
      entries,
    });
    expect(exportPayload.exported_at).toBeTypeOf('string');
  });
});
