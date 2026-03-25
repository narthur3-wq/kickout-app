export function buildDraftSignature(source = {}) {
  return JSON.stringify({
    period: source.period || 'H1',
    clock: source.clock || '',
    contest: source.contest || 'clean',
    outcome: source.outcome || 'Retained',
    breakOutcome: source.breakOutcome || '',
    targetPlayer: source.targetPlayer || '',
    landing: {
      x: Number.isFinite(source.landing?.x) ? +source.landing.x.toFixed(4) : null,
      y: Number.isFinite(source.landing?.y) ? +source.landing.y.toFixed(4) : null,
    },
    pickup: {
      x: Number.isFinite(source.pickup?.x) ? +source.pickup.x.toFixed(4) : null,
      y: Number.isFinite(source.pickup?.y) ? +source.pickup.y.toFixed(4) : null,
    },
    eventType: source.eventType || 'kickout',
    direction: source.direction || 'ours',
    shotType: source.shotType || 'point',
    flagEvent: !!source.flagEvent,
    restartReason: source.restartReason || '',
    editingId: source.editingId || null,
  });
}

export function isSetupDraftDirty(currentMatch, setupDraft) {
  return (
    String(setupDraft.team || '').trim() !== String(currentMatch.team || '') ||
    String(setupDraft.opponent || '').trim() !== String(currentMatch.opponent || '') ||
    String(setupDraft.matchDate || '') !== String(currentMatch.matchDate || '')
  );
}
