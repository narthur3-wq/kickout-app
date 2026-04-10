import { describe, expect, it } from 'vitest';
import {
  kickoutOutcomeDisplayLabelOf,
  kickoutOutcomeFilterLabels,
  kickoutOutcomeSideOf,
  kickoutOutcomeWinnerNameOf,
  normalizeKickoutOutcomeFilterValue,
} from './kickoutOutcome.js';

describe('normalizeKickoutOutcomeFilterValue', () => {
  it.each([
    ['retained', 'selected'],
    ['score',    'selected'],
    ['won',      'selected'],
    ['selected', 'selected'],
    ['Retained', 'selected'],
    ['SCORE',    'selected'],
  ])('maps %s → "selected"', (input, expected) => {
    expect(normalizeKickoutOutcomeFilterValue(input)).toBe(expected);
  });

  it.each([
    ['lost',     'opposing'],
    ['opposing', 'opposing'],
    ['LOST',     'opposing'],
  ])('maps %s → "opposing"', (input, expected) => {
    expect(normalizeKickoutOutcomeFilterValue(input)).toBe(expected);
  });

  it('passes unknown values through unchanged', () => {
    expect(normalizeKickoutOutcomeFilterValue('custom')).toBe('custom');
    expect(normalizeKickoutOutcomeFilterValue('')).toBe('');
  });

  it('handles null and undefined without throwing', () => {
    expect(normalizeKickoutOutcomeFilterValue(null)).toBe(null);
    expect(normalizeKickoutOutcomeFilterValue(undefined)).toBe(undefined);
  });
});

describe('kickoutOutcomeSideOf', () => {
  const kickout = (outcome, direction = 'ours') => ({ event_type: 'kickout', outcome, direction });

  it('returns null for non-kickout events', () => {
    expect(kickoutOutcomeSideOf({ event_type: 'break', outcome: 'won' })).toBeNull();
  });

  it('returns null when outcome is missing', () => {
    expect(kickoutOutcomeSideOf({ event_type: 'kickout', outcome: '' })).toBeNull();
    expect(kickoutOutcomeSideOf({ event_type: 'kickout' })).toBeNull();
  });

  it('returns null for a null/undefined event', () => {
    expect(kickoutOutcomeSideOf(null)).toBeNull();
    expect(kickoutOutcomeSideOf(undefined)).toBeNull();
  });

  it.each(['retained', 'score', 'won'])('returns "selected" for outcome "%s"', (outcome) => {
    expect(kickoutOutcomeSideOf(kickout(outcome))).toBe('selected');
  });

  it('returns "opposing" for outcome "lost"', () => {
    expect(kickoutOutcomeSideOf(kickout('lost'))).toBe('opposing');
  });

  it('resolves "selected" side by matching the selected team name', () => {
    const event = { event_type: 'kickout', outcome: 'Dublin', direction: 'ours', team: 'Dublin' };
    expect(kickoutOutcomeSideOf(event)).toBe('selected');
  });

  it('resolves "opposing" side by matching the opposing team name', () => {
    const event = { event_type: 'kickout', outcome: 'Kerry', direction: 'ours', opponent: 'Kerry' };
    expect(kickoutOutcomeSideOf(event)).toBe('opposing');
  });

  it('returns null when outcome does not match any known side or name', () => {
    expect(kickoutOutcomeSideOf(kickout('unknown-value'))).toBeNull();
  });

  it('handles direction "theirs" by swapping selected/opposing team names', () => {
    const event = { event_type: 'kickout', outcome: 'Dublin', direction: 'theirs', opponent: 'Dublin' };
    expect(kickoutOutcomeSideOf(event)).toBe('selected');
  });
});

describe('kickoutOutcomeWinnerNameOf', () => {
  const kickout = (outcome) => ({ event_type: 'kickout', outcome, direction: 'ours', team: 'Dublin', opponent: 'Kerry' });

  it('returns null when there is no recognizable side', () => {
    expect(kickoutOutcomeWinnerNameOf({ event_type: 'kickout', outcome: '' })).toBeNull();
  });

  it('returns the selected team name for a "won" outcome using provided labels', () => {
    expect(kickoutOutcomeWinnerNameOf(kickout('won'), { teamName: 'Dublin', opponentName: 'Kerry' }))
      .toBe('Dublin');
  });

  it('returns the opposing team name for a "lost" outcome using provided labels', () => {
    expect(kickoutOutcomeWinnerNameOf(kickout('lost'), { teamName: 'Dublin', opponentName: 'Kerry' }))
      .toBe('Kerry');
  });

  it('falls back to event.team when no label is provided', () => {
    expect(kickoutOutcomeWinnerNameOf(kickout('won'))).toBe('Dublin');
  });

  it('falls back to "Ours"/"Theirs" when no label or event property is set', () => {
    expect(kickoutOutcomeWinnerNameOf({ event_type: 'kickout', outcome: 'won', direction: 'ours' })).toBe('Ours');
    expect(kickoutOutcomeWinnerNameOf({ event_type: 'kickout', outcome: 'lost', direction: 'ours' })).toBe('Theirs');
  });
});

describe('kickoutOutcomeDisplayLabelOf', () => {
  it('returns empty string when there is no side', () => {
    expect(kickoutOutcomeDisplayLabelOf({ event_type: 'kickout', outcome: '' })).toBe('');
  });

  it('returns the winner name as a string', () => {
    const event = { event_type: 'kickout', outcome: 'won', direction: 'ours', team: 'Dublin' };
    expect(kickoutOutcomeDisplayLabelOf(event, { teamName: 'Dublin' })).toBe('Dublin');
  });
});

describe('kickoutOutcomeFilterLabels', () => {
  it('returns two entries with provided team names', () => {
    const labels = kickoutOutcomeFilterLabels('Dublin', 'Kerry');
    expect(labels).toEqual([
      { value: 'selected', label: 'Dublin' },
      { value: 'opposing', label: 'Kerry' },
    ]);
  });

  it('falls back to "Ours"/"Theirs" when no names are provided', () => {
    const labels = kickoutOutcomeFilterLabels(null, undefined);
    expect(labels).toEqual([
      { value: 'selected', label: 'Ours' },
      { value: 'opposing', label: 'Theirs' },
    ]);
  });
});
