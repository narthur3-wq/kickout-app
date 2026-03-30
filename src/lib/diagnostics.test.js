import { afterEach, describe, expect, it } from 'vitest';
import { appendDiagnostic, clearDiagnostics, formatDiagnostics, loadDiagnostics } from './diagnostics.js';

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
});
