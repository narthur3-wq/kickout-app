import { describe, expect, it } from 'vitest';
import { buildDraftSignature, isSetupDraftDirty } from './captureDraft.js';

describe('buildDraftSignature', () => {
  it('changes when meaningful draft metadata changes before a pitch point is set', () => {
    const pristine = buildDraftSignature({
      period: 'H1',
      contest: 'clean',
      outcome: 'Retained',
      eventType: 'kickout',
      direction: 'ours',
      landing: { x: NaN, y: NaN },
      pickup: { x: NaN, y: NaN },
    });

    const changed = buildDraftSignature({
      period: 'H1',
      contest: 'clean',
      outcome: 'Lost',
      eventType: 'kickout',
      direction: 'ours',
      targetPlayer: '8',
      landing: { x: NaN, y: NaN },
      pickup: { x: NaN, y: NaN },
    });

    expect(changed).not.toBe(pristine);
  });
});

describe('isSetupDraftDirty', () => {
  it('flags in-progress setup edits before they are committed', () => {
    expect(isSetupDraftDirty(
      { team: 'Clontarf', opponent: 'Vincents', matchDate: '2026-03-25' },
      { team: 'Clontarf', opponent: 'Na Fianna', matchDate: '2026-03-25' },
    )).toBe(true);

    expect(isSetupDraftDirty(
      { team: 'Clontarf', opponent: 'Vincents', matchDate: '2026-03-25' },
      { team: 'Clontarf', opponent: 'Vincents', matchDate: '2026-03-25' },
    )).toBe(false);
  });
});
