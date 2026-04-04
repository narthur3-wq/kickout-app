function normText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeKickoutOutcomeFilterValue(value) {
  const outcome = normText(value);
  if (outcome === 'retained' || outcome === 'score' || outcome === 'won' || outcome === 'selected') {
    return 'selected';
  }
  if (outcome === 'lost' || outcome === 'opposing') {
    return 'opposing';
  }
  return value;
}

function eventTypeOf(event) {
  return normText(event?.event_type || 'kickout') || 'kickout';
}

function directionOf(event) {
  return normText(event?.direction || 'ours') === 'theirs' ? 'theirs' : 'ours';
}

/**
 * @param {{ teamName?: string, opponentName?: string }} [labels]
 */
function selectedTeamName(event, labels = {}) {
  const { teamName, opponentName } = labels;
  return directionOf(event) === 'ours'
    ? (teamName || event?.team || 'Ours')
    : (opponentName || event?.opponent || 'Theirs');
}

/**
 * @param {{ teamName?: string, opponentName?: string }} [labels]
 */
function opposingTeamName(event, labels = {}) {
  const { teamName, opponentName } = labels;
  return directionOf(event) === 'ours'
    ? (opponentName || event?.opponent || 'Theirs')
    : (teamName || event?.team || 'Ours');
}

export function kickoutOutcomeSideOf(event) {
  if (eventTypeOf(event) !== 'kickout') return null;

  const outcome = normText(event?.outcome);
  if (!outcome) return null;

  const selected = normText(selectedTeamName(event));
  const opposing = normText(opposingTeamName(event));

  if (outcome === 'retained' || outcome === 'score' || outcome === 'won') return 'selected';
  if (outcome === 'lost') return 'opposing';
  if (selected && outcome === selected) return 'selected';
  if (opposing && outcome === opposing) return 'opposing';
  return null;
}

export function kickoutOutcomeWinnerNameOf(event, labels = {}) {
  const side = kickoutOutcomeSideOf(event);
  if (!side) return null;
  return side === 'selected'
    ? selectedTeamName(event, labels)
    : opposingTeamName(event, labels);
}

export function kickoutOutcomeDisplayLabelOf(event, labels = {}) {
  return kickoutOutcomeWinnerNameOf(event, labels) || '';
}

export function kickoutOutcomeFilterLabels(teamName, opponentName) {
  return [
    { value: 'selected', label: teamName || 'Ours' },
    { value: 'opposing', label: opponentName || 'Theirs' },
  ];
}
