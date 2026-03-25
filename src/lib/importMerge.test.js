import { describe, expect, it } from 'vitest';
import { mergeImportedEvents, planImportMerge } from './importMerge.js';

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
