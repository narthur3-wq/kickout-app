import { describe, expect, it } from 'vitest';
import { extractImportedEvents, mergeImportedEvents, planImportMerge } from './importMerge.js';

function event(id, overrides = {}) {
  return {
    id,
    outcome: 'Retained',
    x: 0.5,
    y: 0.5,
    team: 'Clontarf',
    opponent: 'Vincents',
    period: 'H1',
    ...overrides,
  };
}

// ── extractImportedEvents ─────────────────────────────────────────────────────
describe('extractImportedEvents', () => {
  it('accepts a flat event array (old format)', () => {
    const arr = [{ id: '1' }, { id: '2' }];
    const result = extractImportedEvents(arr);
    expect(result.eventArray).toEqual(arr);
    expect(result.importedMatches).toEqual([]);
  });

  it('accepts new { matches, events } format', () => {
    const matches = [{ id: 'm1' }];
    const events = [{ id: 'e1' }];
    const result = extractImportedEvents({ matches, events });
    expect(result.eventArray).toEqual(events);
    expect(result.importedMatches).toEqual(matches);
  });

  it('accepts { events } without matches key — returns empty importedMatches', () => {
    const events = [{ id: 'e1' }];
    const result = extractImportedEvents({ events });
    expect(result.eventArray).toEqual(events);
    expect(result.importedMatches).toEqual([]);
  });

  it('accepts { matches: null, events } — coerces to empty importedMatches', () => {
    const events = [{ id: 'e1' }];
    const result = extractImportedEvents({ matches: null, events });
    expect(result.importedMatches).toEqual([]);
  });

  it('throws on plain object with no events array', () => {
    expect(() => extractImportedEvents({ foo: 'bar' })).toThrow();
  });

  it('throws on null', () => {
    expect(() => extractImportedEvents(null)).toThrow();
  });

  it('throws on a string', () => {
    expect(() => extractImportedEvents('[]')).toThrow();
  });

  it('round-trips: export shape is importable', () => {
    const matches = [{ id: 'm1', team: 'Clontarf' }];
    const events = [{ id: 'e1', match_id: 'm1' }];
    const exported = { matches, events };
    const result = extractImportedEvents(exported);
    expect(result.eventArray).toEqual(events);
    expect(result.importedMatches).toEqual(matches);
  });
});

// ── planImportMerge / mergeImportedEvents ─────────────────────────────────────
describe('importMerge', () => {
  it('treats identical events with different key order as identical duplicates', () => {
    const existing = [event('1', { score_us: '0-1', score_them: '0-0', direction: 'ours' })];
    const imported = [{
      direction: 'ours',
      score_them: '0-0',
      opponent: 'Vincents',
      team: 'Clontarf',
      x: 0.5,
      y: 0.5,
      period: 'H1',
      outcome: 'Retained',
      id: '1',
      score_us: '0-1',
    }];

    const plan = planImportMerge(existing, imported);

    expect(plan.identicalCount).toBe(1);
    expect(plan.conflictingCount).toBe(0);
    expect(plan.newEvents).toHaveLength(0);
  });

  it('can replace conflicting duplicates while preserving brand-new events', () => {
    const existing = [
      event('1', { opponent: 'Crokes', score_us: '0-0' }),
      event('2', { opponent: 'Vincents', score_us: '0-1' }),
    ];
    const imported = [
      event('1', { opponent: 'Na Fianna', score_us: '0-2' }),
      event('3', { opponent: 'Ballymun', score_us: '0-3' }),
    ];

    const merged = mergeImportedEvents(existing, imported, 'replace');

    expect(merged.plan.conflictingCount).toBe(1);
    expect(merged.plan.identicalCount).toBe(0);
    expect(merged.events.find((item) => item.id === '1')?.opponent).toBe('Na Fianna');
    expect(merged.events.find((item) => item.id === '3')?.opponent).toBe('Ballymun');
    expect(merged.upsertEvents.map((item) => item.id)).toEqual(['3', '1']);
  });

  it('can keep current data for conflicting duplicates while still importing new events', () => {
    const existing = [event('1', { opponent: 'Crokes' })];
    const imported = [
      event('1', { opponent: 'Na Fianna' }),
      event('2', { opponent: 'Vincents' }),
    ];

    const merged = mergeImportedEvents(existing, imported, 'skip');

    expect(merged.plan.conflictingCount).toBe(1);
    expect(merged.events.find((item) => item.id === '1')?.opponent).toBe('Crokes');
    expect(merged.events.find((item) => item.id === '2')?.opponent).toBe('Vincents');
    expect(merged.upsertEvents.map((item) => item.id)).toEqual(['2']);
  });
});
