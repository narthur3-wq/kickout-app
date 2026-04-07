<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    analysisPointForSession,
    ASSIST_ELIGIBLE_OUTCOMES,
    buildPlayerDirectory,
    buildPossessionSummary,
    buildPointSeries,
    collectPlayerOptions,
    displayPlayerLabel,
    formatMetres,
    formatSignedMetres,
    movementDirection,
    movementDirectionColor,
    movementDirectionLabel,
    movementDirectionForSession,
    isScoreOutcome,
    normalizePlayerKey,
    pointDistanceMeters,
    resolveSessionPlayerIdentity,
    sessionLabel,
    splitMatchIdsForTrend,
    squadPlayerKey,
  } from './postMatchAnalysis.js';
  import Heatmap from './Heatmap.svelte';
  import Pitch from './Pitch.svelte';
  import {
    createEmptyAnalysisState,
    deleteAnalysisSession,
    loadAnalysisState,
    renameAnalysisPlayer,
    replaceAnalysisSession,
    saveAnalysisState,
    sessionsForMatch,
    sessionsForPlayer,
  } from './postMatchAnalysisStore.js';

  const dispatch = createEventDispatcher();

  export let storageScope = null;
  export let analysisRefreshToken = 0;
  export let activeMatchId = null;
  export let activeMatch = null;
  export let matches = [];
  export let teamName = '';
  export let opponentName = '';
  export let matchLabel = '';
  export let playerOptions = [];
  export let squadPlayers = [];
  export let defaultOurGoalAtTop = true;

  const OUTCOMES = [
    'Score point',
    'Score goal',
    'Shot wide',
    'Shot short / saved / blocked',
    'Hand pass',
    'Kick pass',
    'Possession lost',
    'Fouled the ball',
    'Tackled / dispossessed',
    'Foul won',
  ];

  const HALF_OPTIONS = [
    { value: null, label: 'All halves' },
    { value: 'first', label: 'First half' },
    { value: 'second', label: 'Second half' },
    { value: 'et', label: 'Extra time' },
  ];

  let analysisState = createEmptyAnalysisState();
  let loadedScope = null;
  let loadedAnalysisRefreshToken = null;
  let draftSession = null;
  let draftEvent = blankDraftEvent();
  let draftStep = 'receive';
  let draftOurGoalAtTop = defaultOurGoalAtTop;
  let draftHalf = null;
  let selectedPlayerKey = '';
  let selectedSessionId = 'all';
  let selectedEventId = null;
  let eventEditDraft = null;
  let analysisMode = 'match';
  let selectedHalf = null;
  let selectedCrossMatchIds = [];
  let mergeTargetPlayerKey = '';
  let rosterPropSource = null;
  let playerInput = '';
  let notice = '';
  let viewMode = 'dots';
  let showPressureOnly = false;
  let showScoreInvolvementsOnly = false;
  let showCarryLines = true;
  let legendOpen = false;
  let trendMode = 'halves';
  let trendLastN = 3;
  let trendFocus = 'earlier';
  let matchDateLookup = new Map();
  let analysisCardEl;
  let exportingSnapshot = false;
  let exportFeedback = null;

  const OUTCOME_COLORS = {
    'Score point': '#0f766e',
    'Score goal': '#15803d',
    'Shot wide': '#d97706',
    'Shot short / saved / blocked': '#64748b',
    'Possession lost': '#dc2626',
    'Passed / offloaded': '#2563eb',
    'Foul won': '#db2777',
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function point() {
    return { x: NaN, y: NaN };
  }

  function blankDraftEvent() {
    return {
      receive: point(),
      release: point(),
      outcome: 'Hand pass',
      under_pressure: false,
      assist: false,
    };
  }

  function titleOfMatch() {
    if (matchLabel) return matchLabel;
    if (teamName || opponentName) return `${teamName || 'Team'}${opponentName ? ` v ${opponentName}` : ''}`;
    return 'Match';
  }

  function matchCountLabel(count) {
    const total = Number(count) || 0;
    return `${total} match${total === 1 ? '' : 'es'} selected`;
  }

  function orientationLabel(flag) {
    return flag ? 'Our goal left' : 'Our goal right';
  }

  function createSession(playerName) {
    const player = displayPlayerLabel(playerName);
    if (!player) return null;
    const identity = resolveSessionPlayerIdentity({ player_name: player }, rosterList());
    const timestamp = nowIso();
    return {
      id: crypto.randomUUID(),
      mode: 'possession',
      match_id: activeMatchId || null,
      player_name: identity.label || player,
      player_key: identity.key || normalizePlayerKey(player),
      squad_player_id: identity.squad_player_id || null,
      our_goal_at_top: !!draftOurGoalAtTop,
      half: draftHalf,
      created_at: timestamp,
      updated_at: timestamp,
      notes: '',
      events: [],
    };
  }

  function rosterList() {
    const roster = Array.isArray(squadPlayers) && squadPlayers.length > 0
      ? squadPlayers
      : analysisState.squadPlayers;
    return Array.isArray(roster) ? roster : [];
  }

  function activeRosterList() {
    return rosterList().filter((player) => player?.active !== false);
  }

  function uniqueValues(values = []) {
    return values.filter((value, index) => values.indexOf(value) === index);
  }

  function formatPercent(value, total) {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '—';
    return `${Math.round((value / total) * 100)}%`;
  }

  function percentOf(value, total) {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null;
    return (value / total) * 100;
  }

  function formatPercentValue(value) {
    if (!Number.isFinite(value)) return '-';
    return `${Math.round(value)}%`;
  }

  function formatDeltaCount(value) {
    if (!Number.isFinite(value)) return '-';
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${Math.abs(Math.round(value))}`;
  }

  function formatDeltaPercent(value) {
    if (!Number.isFinite(value)) return '-';
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${Math.abs(Math.round(value))}pp`;
  }

  function saveState(nextState) {
    const previousState = analysisState;
    analysisState = nextState;
    if (storageScope) saveAnalysisState(nextState, storageScope);
    dispatch('analysischange', {
      mode: 'possession',
      state: nextState,
      previousState,
    });
  }

  function legendStorageKey() {
    return `ko_possession_legend_${storageScope || 'local'}`;
  }

  function loadLegendPreference() {
    try {
      const stored = localStorage.getItem(legendStorageKey());
      if (stored === '1') legendOpen = true;
      else if (stored === '0') legendOpen = false;
    } catch {
      // Best-effort only.
    }
  }

  function saveLegendPreference() {
    try {
      localStorage.setItem(legendStorageKey(), legendOpen ? '1' : '0');
    } catch {
      // Best-effort only.
    }
  }

  function loadScope(scope) {
    if (!scope) {
      analysisState = createEmptyAnalysisState();
      loadedScope = null;
      return;
    }
    analysisState = loadAnalysisState(scope);
    loadedScope = scope;
  }

  function syncSelection(players = [], { preserveMissing = false } = {}) {
    if (players.length === 0) {
      if (!preserveMissing) {
        selectedPlayerKey = '';
        selectedSessionId = 'all';
      }
      return;
    }
    if (!selectedPlayerKey || (!preserveMissing && !players.some((item) => item.key === selectedPlayerKey))) {
      selectedPlayerKey = players[0].key;
      selectedSessionId = 'all';
      playerInput = players[0].label;
    }
  }

  function resetDraftEvent() {
    draftEvent = blankDraftEvent();
    draftStep = 'receive';
    selectedEventId = null;
    eventEditDraft = null;
  }

  function setDraftOutcome(outcome) {
    draftEvent = {
      ...draftEvent,
      outcome,
      assist: ASSIST_ELIGIBLE_OUTCOMES.has(outcome) ? draftEvent.assist === true : false,
    };
  }

  function setDraftAssist(nextValue) {
    draftEvent = {
      ...draftEvent,
      assist: !!nextValue,
    };
  }

  function setDraftHalf(nextHalf) {
    draftHalf = nextHalf || null;
  }

  function setDraftOrientation(nextValue) {
    draftOurGoalAtTop = !!nextValue;
  }

  function isHalfMatch(sessionHalf, filterHalf) {
    if (!filterHalf) return true;
    return sessionHalf === filterHalf;
  }

  function createEventEditDraft(event, session) {
    if (!event || !session) return null;
    return {
      sessionId: session.id,
      eventId: event.id,
      outcome: event.outcome,
      under_pressure: !!event.under_pressure,
      assist: !!event.assist,
      receive_x: event.receive_x,
      receive_y: event.receive_y,
      release_x: event.release_x,
      release_y: event.release_y,
    };
  }

  function openEventEditor(event) {
    const session = displayedSessions.find((item) => item.id === event.session_id) || selectedPlayerSessions.find((item) => item.id === event.session_id) || null;
    eventEditDraft = createEventEditDraft(event, session);
    selectedEventId = event.id;
  }

  function cancelEventEditor() {
    eventEditDraft = null;
    selectedEventId = null;
  }

  function setEventEditOutcome(outcome) {
    if (!eventEditDraft) return;
    eventEditDraft = {
      ...eventEditDraft,
      outcome,
      assist: ASSIST_ELIGIBLE_OUTCOMES.has(outcome) ? eventEditDraft.assist === true : false,
    };
  }

  function setEventEditAssist(nextValue) {
    if (!eventEditDraft) return;
    eventEditDraft = {
      ...eventEditDraft,
      assist: !!nextValue,
    };
  }

  function setEventEditPressure(nextValue) {
    if (!eventEditDraft) return;
    eventEditDraft = {
      ...eventEditDraft,
      under_pressure: !!nextValue,
    };
  }

  function saveEventEditor() {
    if (!eventEditDraft) return;
    const sessionIndex = analysisState.possessionSessions.findIndex((session) => session.id === eventEditDraft.sessionId);
    if (sessionIndex < 0) return;
    const session = analysisState.possessionSessions[sessionIndex];
    const updatedEvents = (session.events || []).map((event) => {
      if (event.id !== eventEditDraft.eventId) return event;
      return {
        ...event,
        outcome: eventEditDraft.outcome,
        under_pressure: !!eventEditDraft.under_pressure,
        assist: ASSIST_ELIGIBLE_OUTCOMES.has(eventEditDraft.outcome) ? !!eventEditDraft.assist : false,
      };
    });
    const nextSession = {
      ...session,
      events: updatedEvents,
      updated_at: nowIso(),
    };
    const nextState = replaceAnalysisSession(analysisState, nextSession);
    saveState(nextState);
    eventEditDraft = null;
    selectedEventId = null;
  }

  function startDraftSession() {
    const session = createSession(playerInput);
    if (!session) {
      notice = 'Choose a player before starting a draft session.';
      return;
    }
    draftSession = session;
    resetDraftEvent();
    selectedPlayerKey = session.player_key;
    selectedSessionId = 'all';
    playerInput = session.player_name;
    selectedEventId = null;
    notice = '';
  }

  function cancelDraftSession() {
    draftSession = null;
    resetDraftEvent();
  }

  function handlePitchPoint(pos) {
    if (!draftSession) return;
    if (draftStep === 'receive') {
      draftEvent = { ...draftEvent, receive: { ...pos } };
      draftStep = 'release';
      return;
    }
    if (draftStep === 'release') {
      draftEvent = { ...draftEvent, release: { ...pos } };
      draftStep = 'outcome';
    }
  }

  function addDraftEvent() {
    if (!draftSession) return;
    if (!Number.isFinite(draftEvent.receive.x) || !Number.isFinite(draftEvent.release.x)) {
      notice = 'Tap both receive and release points first.';
      return;
    }
    const timestamp = nowIso();
    const event = {
      id: crypto.randomUUID(),
      receive_x: Math.round(draftEvent.receive.x * 100) / 100,
      receive_y: Math.round(draftEvent.receive.y * 100) / 100,
      release_x: Math.round(draftEvent.release.x * 100) / 100,
      release_y: Math.round(draftEvent.release.y * 100) / 100,
      outcome: draftEvent.outcome,
      under_pressure: draftEvent.under_pressure,
      assist: draftEvent.assist,
      created_at: timestamp,
    };
    draftSession = {
      ...draftSession,
      updated_at: timestamp,
      events: [...draftSession.events, event],
    };
    resetDraftEvent();
    selectedEventId = event.id;
    notice = '';
  }

  function clearCurrentDraftPoint() {
    if (!draftSession) return;
    if (draftStep === 'outcome') {
      draftEvent = { ...draftEvent, release: point() };
      draftStep = 'release';
      return;
    }
    if (draftStep === 'release') {
      draftEvent = { ...draftEvent, receive: point() };
      draftStep = 'receive';
    }
  }

  function undoLastDraftEvent() {
    if (!draftSession || draftSession.events.length === 0) {
      notice = 'No draft event to undo.';
      return;
    }
    draftSession = {
      ...draftSession,
      updated_at: nowIso(),
      events: draftSession.events.slice(0, -1),
    };
    selectedEventId = draftSession.events[draftSession.events.length - 1]?.id || null;
  }

  function saveDraftSession() {
    if (!draftSession) return;
    const nextState = replaceAnalysisSession(analysisState, draftSession);
    saveState(nextState);
    selectedPlayerKey = draftSession.player_key;
    selectedSessionId = draftSession.id;
    playerInput = draftSession.player_name;
    draftSession = null;
    resetDraftEvent();
    notice = 'Session finalized.';
  }

  function deleteSession(session) {
    if (!window.confirm('Delete this saved session?')) return;
    const nextState = deleteAnalysisSession(analysisState, 'possession', session.id);
    saveState(nextState);
    if (selectedSessionId === session.id) selectedSessionId = 'all';
    if (draftSession?.id === session.id) draftSession = null;
    notice = 'Session deleted.';
  }

  function selectPlayer(player) {
    selectedPlayerKey = player.key;
    selectedSessionId = 'all';
    playerInput = player.label;
    selectedEventId = null;
    eventEditDraft = null;
    mergeTargetPlayerKey = '';
    if (analysisMode === 'cross') {
      selectedCrossMatchIds = availableMatchIdsForPlayer(player.key);
    }
  }

  function selectSession(sessionId) {
    selectedSessionId = sessionId;
    selectedEventId = null;
    eventEditDraft = null;
  }

  function selectEvent(eventId) {
    selectedEventId = eventId;
    const event = displayedEvents.find((item) => item.id === eventId) || null;
    if (event) openEventEditor(event);
  }

  function currentSelectedEvent(events = [], selectedId = null) {
    if (!selectedId) return null;
    return events.find((event) => event.id === selectedId) ?? null;
  }

  function directionOf(event) {
    return movementDirection(event.receive, event.release) || 'lateral';
  }

  function draftDirectionOf(event) {
    if (!draftSession) return 'lateral';
    return movementDirectionForSession(
      { x: event.receive_x, y: event.receive_y },
      { x: event.release_x, y: event.release_y },
      draftSession,
    ) || 'lateral';
  }

  function overlayFor(event) {
    return {
      id: event.id,
      x: event.receive.x,
      y: event.receive.y,
      outcome: event.outcome,
      label: `${event.outcome}${event.assist ? ' - Assist' : ''} - ${movementDirectionLabel(directionOf(event))}`,
      marker_shape: 'circle',
      marker_fill: event.assist ? '#f59e0b' : (OUTCOME_COLORS[event.outcome] || '#1c3f8a'),
      marker_ring: event.under_pressure ? 'target' : null,
      marker_ring_color: 'rgba(220, 38, 38, 0.9)',
      clickable: true,
    };
  }

  function draftOverlayFor(event, index) {
    return {
      id: event.id,
      x: event.receive_x,
      y: event.receive_y,
      outcome: event.outcome,
      label: `Draft event ${index + 1}: ${event.outcome}${event.assist ? ' - Assist' : ''} - ${movementDirectionLabel(draftDirectionOf(event))}`,
      marker_shape: 'circle',
      marker_fill: event.assist ? '#f59e0b' : (OUTCOME_COLORS[event.outcome] || '#1c3f8a'),
      marker_ring: event.under_pressure ? 'target' : null,
      marker_ring_color: 'rgba(220, 38, 38, 0.9)',
      opacity: 0.34,
      draft: true,
      clickable: false,
    };
  }

  function lineFor(event) {
    return {
      id: event.id,
      from: event.receive,
      to: event.release,
      color: movementDirectionColor(directionOf(event)),
      width: 1.5,
      opacity: event.under_pressure ? 0.85 : 0.72,
    };
  }

  function draftLineFor(event, index) {
    return {
      id: event.id,
      from: { x: event.receive_x, y: event.receive_y },
      to: { x: event.release_x, y: event.release_y },
      color: movementDirectionColor(draftDirectionOf(event)),
      width: 1.35,
      opacity: event.under_pressure ? 0.55 : 0.35,
      dasharray: '4 3',
      arrow: true,
      draft: true,
      clickable: false,
      label: `Draft event ${index + 1}: ${event.outcome} - ${movementDirectionLabel(draftDirectionOf(event))}`,
    };
  }

  function removeDraftEvent(eventId) {
    if (!draftSession) return;
    const nextEvents = draftSession.events.filter((event) => event.id !== eventId);
    if (nextEvents.length === draftSession.events.length) return;
    draftSession = {
      ...draftSession,
      updated_at: nowIso(),
      events: nextEvents,
    };
    if (selectedEventId === eventId) {
      selectedEventId = nextEvents[nextEvents.length - 1]?.id || null;
    }
    notice = '';
  }

  function matchLabelFor(matchId) {
    const match = matches.find((item) => item.id === matchId);
    if (!match) return matchId || 'Unknown match';
    const label = `${match.team || 'Team'} v ${match.opponent || 'Opposition'}`;
    const date = match.match_date ? ` (${match.match_date})` : '';
    return `${label}${date}`;
  }

  function allSessionsForSelectedPlayer() {
    if (!selectedPlayerKey) return [];
    return sessionsForPlayer(analysisState, 'possession', selectedPlayerKey);
  }

  function selectedMatchSessionsForPlayer(matchIds = []) {
    if (!selectedPlayerKey) return [];
    const ids = Array.isArray(matchIds) ? matchIds.filter(Boolean) : [];
    return sessionsForPlayer(analysisState, 'possession', selectedPlayerKey, ids);
  }

  function setAnalysisMode(nextMode) {
    analysisMode = nextMode;
    if (nextMode === 'cross') {
      const available = availableMatchIdsForPlayer(selectedPlayerKey);
      selectedCrossMatchIds = available.length > 0 ? [...available] : [];
    }
    selectedSessionId = 'all';
    selectedEventId = null;
    eventEditDraft = null;
  }

  function toggleCrossMatch(matchId) {
    if (selectedCrossMatchIds.includes(matchId)) {
      selectedCrossMatchIds = selectedCrossMatchIds.filter((item) => item !== matchId);
    } else {
      selectedCrossMatchIds = [...selectedCrossMatchIds, matchId];
    }
    selectedSessionId = 'all';
    selectedEventId = null;
    eventEditDraft = null;
  }

  function selectAllCrossMatches(matchIds = []) {
    selectedCrossMatchIds = uniqueValues(matchIds.filter(Boolean));
    selectedSessionId = 'all';
    selectedEventId = null;
    eventEditDraft = null;
  }

  function buildCrossMatchRow(matchId) {
    const sessions = sessionsForPlayer(analysisState, 'possession', selectedPlayerKey, [matchId])
      .filter((session) => isHalfMatch(session?.half ?? null, selectedHalf));
    const events = sessions.flatMap((session) => (session.events || []).map((event) => ({
      ...event,
      session_id: session.id,
      session_our_goal_at_top: session.our_goal_at_top,
      receive: analysisPointForSession({ x: event.receive_x, y: event.receive_y }, session),
      release: analysisPointForSession({ x: event.release_x, y: event.release_y }, session),
    })));
    const summary = buildPossessionSummary(events);
    const match = matches.find((item) => item.id === matchId) || null;
    return {
      matchId,
      sessions,
      events,
      summary,
      match,
      label: matchLabelFor(matchId),
      date: match?.match_date || '',
    };
  }

  function matchDateForId(matchId, lookup) {
    if (!matchId) return '';
    if (lookup && lookup instanceof Map && lookup.has(matchId)) return lookup.get(matchId) || '';
    return '';
  }

  function dateRangeLabel(matchIds = [], lookup) {
    const dates = matchIds
      .map((id) => matchDateForId(id, lookup))
      .filter(Boolean);
    if (dates.length === 0) return '';
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (first === last) return first;
    return `${first} - ${last}`;
  }

  function buildTrendBucket(matchIds = [], lookup) {
    const ids = Array.isArray(matchIds) ? matchIds.filter(Boolean) : [];
    if (!selectedPlayerKey || ids.length === 0) {
      const summary = buildPossessionSummary([]);
      return {
        matchIds: ids,
        matchCount: ids.length,
        eventCount: 0,
        summary,
        events: [],
        heatPoints: [],
        dateRange: dateRangeLabel(ids, lookup),
      };
    }

    const sessions = sessionsForPlayer(analysisState, 'possession', selectedPlayerKey, ids)
      .filter((session) => isHalfMatch(session?.half ?? null, selectedHalf));
    const events = sessions.flatMap((session) => (session.events || []).map((event) => ({
      ...event,
      session_id: session.id,
      session_our_goal_at_top: session.our_goal_at_top,
      receive: analysisPointForSession({ x: event.receive_x, y: event.receive_y }, session),
      release: analysisPointForSession({ x: event.release_x, y: event.release_y }, session),
    })));
    const summary = buildPossessionSummary(events);
    return {
      matchIds: ids,
      matchCount: ids.length,
      eventCount: events.length,
      summary,
      events,
      heatPoints: buildPointSeries(events, (event) => event.receive),
      dateRange: dateRangeLabel(ids, lookup),
    };
  }

  function availableMatchIdsForPlayer(playerKey, halfFilter = selectedHalf) {
    if (!playerKey) return [];
    const sessions = sessionsForPlayer(analysisState, 'possession', playerKey)
      .filter((session) => isHalfMatch(session?.half ?? null, halfFilter));
    return uniqueValues(sessions.map((session) => session.match_id).filter(Boolean));
  }

  function setSelectedHalf(nextHalf) {
    selectedHalf = nextHalf || null;
    selectedSessionId = 'all';
    selectedEventId = null;
    eventEditDraft = null;
    if (analysisMode === 'cross') {
      selectedCrossMatchIds = availableMatchIdsForPlayer(selectedPlayerKey, selectedHalf);
    }
  }

  function mergeSelectedPlayerNames() {
    const target = rosterList().find((player) => squadPlayerKey(player.id) === mergeTargetPlayerKey);
    if (!target || !selectedPlayerKey) {
      notice = 'Pick the squad name to merge into first.';
      return;
    }
    const nextState = renameAnalysisPlayer(analysisState, selectedPlayerKey, target);
    saveState(nextState);
    selectedPlayerKey = squadPlayerKey(target.id);
    selectedSessionId = 'all';
    selectedEventId = null;
    if (analysisMode === 'cross') {
      selectedCrossMatchIds = availableMatchIdsForPlayer(selectedPlayerKey);
    }
    playerInput = target.name;
    mergeTargetPlayerKey = selectedPlayerKey;
    notice = `Merged sessions into ${target.name}.`;
  }

  $: if (storageScope !== loadedScope) {
    loadScope(storageScope);
    loadLegendPreference();
    draftSession = null;
    resetDraftEvent();
    selectedPlayerKey = '';
    selectedSessionId = 'all';
    selectedEventId = null;
    mergeTargetPlayerKey = '';
    playerInput = '';
    notice = '';
  }

  $: if (storageScope && analysisRefreshToken !== loadedAnalysisRefreshToken) {
    loadScope(storageScope);
    loadedAnalysisRefreshToken = analysisRefreshToken;
  }

  $: if (Array.isArray(squadPlayers) && squadPlayers !== rosterPropSource && (squadPlayers.length > 0 || rosterPropSource !== null)) {
    rosterPropSource = squadPlayers;
    analysisState = {
      ...analysisState,
      squadPlayers: Array.isArray(squadPlayers) ? squadPlayers : [],
    };
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function playerSlug() {
    return (selectedPlayerEntry?.label || 'player').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  function exportPossessionCSV() {
    if (displayedEvents.length === 0) return;
    const sessionMap = new Map(displayedSessions.map((s) => [s.id, s]));
    const matchMap = new Map(matches.map((m) => [m.id, m]));
    const rows = [
      ['player', 'match', 'match_date', 'session_date', 'receive_x', 'receive_y', 'release_x', 'release_y', 'outcome', 'under_pressure', 'direction', 'carry_m'],
    ];
    for (const event of displayedEvents) {
      const session = sessionMap.get(event.session_id);
      const match = session ? matchMap.get(session.match_id) : null;
      const direction = movementDirection(event.receive, event.release);
      const carry = pointDistanceMeters(event.receive, event.release);
      rows.push([
        session?.player_name || '',
        match ? `${match.team || 'Team'} v ${match.opponent || 'Opposition'}` : (session?.match_id || ''),
        match?.match_date || '',
        session?.created_at?.slice(0, 10) || '',
        Number.isFinite(event.receive.x) ? event.receive.x.toFixed(3) : '',
        Number.isFinite(event.receive.y) ? event.receive.y.toFixed(3) : '',
        Number.isFinite(event.release.x) ? event.release.x.toFixed(3) : '',
        Number.isFinite(event.release.y) ? event.release.y.toFixed(3) : '',
        event.outcome || '',
        event.under_pressure ? 'yes' : 'no',
        direction,
        Number.isFinite(carry) ? carry.toFixed(1) : '',
      ]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(csv, `possession-${playerSlug()}.csv`, 'text/csv;charset=utf-8;');
  }

  async function shareSnapshot() {
    if (exportingSnapshot || !analysisCardEl) return;
    exportingSnapshot = true;
    exportFeedback = null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(analysisCardEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error('Could not generate image.'));
        }, 'image/png');
      });
      const filename = `possession-${playerSlug()}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Pairc Possession Analysis' });
      } else {
        downloadFile(blob, filename, 'image/png');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        exportFeedback = 'Could not generate the snapshot on this device.';
      }
    } finally {
      exportingSnapshot = false;
    }
  }

  onMount(() => {
    if (storageScope) loadScope(storageScope);
    loadLegendPreference();
  });

  $: saveLegendPreference();

  $: matchSessions = sessionsForMatch(analysisState, 'possession', activeMatchId)
    .slice()
    .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));

  $: matchMetaTitle = analysisMode === 'cross' ? 'Across matches' : titleOfMatch();
  $: matchMetaSubtitle = analysisMode === 'cross'
    ? matchCountLabel(selectedCrossMatchIds.length)
    : (activeMatch?.match_date || 'Completed match');

  $: rosterPlayers = rosterList();
  $: activeRosterPlayers = activeRosterList();
  $: allPossessionSessions = sessionsForMatch(analysisState, 'possession', null);
  $: halfFilteredPossessionSessions = selectedHalf
    ? allPossessionSessions.filter((session) => isHalfMatch(session?.half ?? null, selectedHalf))
    : allPossessionSessions;

  $: crossMatchIdsForPlayer = uniqueValues(
    selectedPlayerKey
      ? sessionsForPlayer(analysisState, 'possession', selectedPlayerKey)
          .filter((session) => isHalfMatch(session?.half ?? null, selectedHalf))
          .map((session) => session.match_id)
          .filter(Boolean)
      : []
  );

  $: if (analysisMode === 'cross' && selectedCrossMatchIds.length === 0 && crossMatchIdsForPlayer.length > 0) {
    selectedCrossMatchIds = [...crossMatchIdsForPlayer];
  }

  $: selectedCrossMatchSessions = selectedPlayerKey && selectedCrossMatchIds.length > 0
    ? sessionsForPlayer(analysisState, 'possession', selectedPlayerKey, selectedCrossMatchIds)
        .filter((session) => isHalfMatch(session?.half ?? null, selectedHalf))
    : [];

  $: crossMatchScopeSessions = analysisMode === 'cross' && selectedCrossMatchIds.length > 0
    ? halfFilteredPossessionSessions.filter((session) => selectedCrossMatchIds.includes(session.match_id))
    : [];

  $: scopeSessions = analysisMode === 'cross'
    ? crossMatchScopeSessions
    : matchSessions.filter((session) => isHalfMatch(session?.half ?? null, selectedHalf));

  $: playerDirectory = buildPlayerDirectory(scopeSessions, rosterPlayers);

  $: syncSelection(playerDirectory, { preserveMissing: analysisMode === 'cross' });

  $: selectedPlayerSessions = selectedPlayerKey
    ? (analysisMode === 'cross'
      ? selectedCrossMatchSessions
      : sessionsForPlayer(analysisState, 'possession', selectedPlayerKey, [activeMatchId])
        .filter((session) => isHalfMatch(session?.half ?? null, selectedHalf)))
    : scopeSessions;

  $: if (selectedSessionId !== 'all' && !selectedPlayerSessions.some((session) => session.id === selectedSessionId)) {
    selectedSessionId = 'all';
  }

  $: displayedSessions = selectedSessionId === 'all'
    ? selectedPlayerSessions
    : selectedPlayerSessions.filter((session) => session.id === selectedSessionId);

  $: displayedEvents = displayedSessions.flatMap((session) =>
    (session.events || []).map((event) => ({
      ...event,
      session_id: session.id,
      session_our_goal_at_top: session.our_goal_at_top,
      receive: analysisPointForSession({ x: event.receive_x, y: event.receive_y }, session),
      release: analysisPointForSession({ x: event.release_x, y: event.release_y }, session),
    }))
  );

  $: draftEventCount = draftSession?.events?.length || 0;
  $: draftOverlays = draftSession
    ? draftSession.events.map((event, index) => draftOverlayFor(event, index))
    : [];
  $: draftConnections = draftSession
    ? draftSession.events.map((event, index) => draftLineFor(event, index))
    : [];

  $: playerAutocomplete = collectPlayerOptions([
    ...scopeSessions,
    ...(draftSession ? [draftSession] : []),
    ...activeRosterPlayers.map((player) => player.name),
    ...playerOptions,
  ], ['player_name']);

  $: possessionSummary = buildPossessionSummary(displayedEventsVisible);
  $: outcomeBreakdown = possessionSummary.outcomeBreakdown;
  $: totalEvents = possessionSummary.total ?? possessionSummary.totalEvents ?? displayedEventsVisible.length;
  $: directScores = possessionSummary.directScores ?? 0;
  $: assistCount = possessionSummary.assistCount ?? 0;
  $: scoreInvolvement = possessionSummary.scoreInvolvement ?? 0;
  $: scoreInvolvementRate = possessionSummary.scoreInvolvementRate ?? null;
  $: forwardCount = possessionSummary.forwardCount;
  $: lateralCount = possessionSummary.lateralCount;
  $: backwardCount = possessionSummary.backwardCount;
  $: averageCarry = possessionSummary.averageCarry;
  $: forwardDisplay = analysisMode === 'cross' ? formatPercent(forwardCount, totalEvents) : forwardCount;
  $: lateralDisplay = analysisMode === 'cross' ? formatPercent(lateralCount, totalEvents) : lateralCount;
  $: backwardDisplay = analysisMode === 'cross' ? formatPercent(backwardCount, totalEvents) : backwardCount;
  $: scoreInvolvementDetail = scoreInvolvement > 0
    ? (directScores > 0 && assistCount > 0
      ? `(${assistCount} assist${assistCount === 1 ? '' : 's'} · ${directScores} direct)`
      : directScores > 0
        ? '(all direct)'
        : '(all assists)')
    : '';
  $: scoreInvolvementRateLabel = analysisMode === 'cross' && Number.isFinite(scoreInvolvementRate)
    ? `${Math.round(scoreInvolvementRate * 100)}% rate`
    : '';
  $: displayedEventsVisible = displayedEvents.filter((event) => {
    if (showPressureOnly && !event.under_pressure) return false;
    if (showScoreInvolvementsOnly) {
      const outcome = String(event?.outcome ?? '').trim();
      if (!isScoreOutcome(outcome) && event?.assist !== true) return false;
    }
    return true;
  });
  $: heatPoints = buildPointSeries(displayedEventsVisible, (event) => event.receive);
  $: dotOverlays = displayedEventsVisible.map((event) => overlayFor(event));
  $: dotConnections = showCarryLines ? displayedEventsVisible.map((event) => lineFor(event)) : [];
  $: sampleNote = (() => {
    if (totalEvents <= 0) return '';
    if (analysisMode === 'cross') {
      const matchCount = selectedCrossMatchIds.length;
      if (matchCount < 3 && totalEvents < 15) {
        const matchLabel = matchCount === 1 ? 'match' : 'matches';
        return `Only ${matchCount} ${matchLabel} selected with ${totalEvents} events — treat these patterns cautiously.`;
      }
      return '';
    }
    if (totalEvents < 8) {
      return `${totalEvents} events — patterns are forming. Treat direction splits cautiously.`;
    }
    return '';
  })();

  $: crossMatchCatalogRows = crossMatchIdsForPlayer.map((matchId) => buildCrossMatchRow(matchId))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  $: matchDateLookup = new Map(crossMatchCatalogRows.map((row) => [row.matchId, row.date || '']));

  $: crossMatchRows = crossMatchCatalogRows.filter((row) => selectedCrossMatchIds.includes(row.matchId));

  $: selectedPlayerEntry = playerDirectory.find((player) => player.key === selectedPlayerKey) || null;
  $: selectedPlayerMismatch = selectedPlayerEntry?.source === 'legacy' ? selectedPlayerEntry : null;
  $: if (selectedPlayerMismatch && !mergeTargetPlayerKey) {
    mergeTargetPlayerKey = rosterPlayers[0] ? squadPlayerKey(rosterPlayers[0].id) : '';
  }

  $: trendEligible = analysisMode === 'cross'
    && selectedCrossMatchIds.length >= 4
    && !!selectedPlayerKey;

  $: trendSplit = analysisMode === 'cross'
    ? splitMatchIdsForTrend(selectedCrossMatchIds, {
        dateLookup: matchDateLookup,
        mode: trendMode,
        lastN: trendLastN,
      })
    : { ordered: [], earlier: [], recent: [] };

  $: trendEarlier = buildTrendBucket(trendSplit.earlier, matchDateLookup);
  $: trendRecent = buildTrendBucket(trendSplit.recent, matchDateLookup);

  $: trendInvolvementEarlier = percentOf(trendEarlier.summary.scoreInvolvement, trendEarlier.summary.totalEvents ?? trendEarlier.eventCount);
  $: trendInvolvementRecent = percentOf(trendRecent.summary.scoreInvolvement, trendRecent.summary.totalEvents ?? trendRecent.eventCount);
  $: trendInvolvementDelta = Number.isFinite(trendInvolvementEarlier) && Number.isFinite(trendInvolvementRecent)
    ? trendInvolvementRecent - trendInvolvementEarlier
    : null;
  $: trendDeltaTone = Number.isFinite(trendInvolvementDelta)
    ? (Math.abs(trendInvolvementDelta) < 5 ? 'flat' : (trendInvolvementDelta > 0 ? 'up' : 'down'))
    : 'flat';
  $: trendDeltaLabel = Number.isFinite(trendInvolvementEarlier) && Number.isFinite(trendInvolvementRecent)
    ? `Score involvement rate: ${formatPercentValue(trendInvolvementEarlier)} -> ${formatPercentValue(trendInvolvementRecent)} (${formatDeltaPercent(trendInvolvementDelta)})`
    : 'Score involvement rate: n/a';

  $: trendCompareRows = (() => {
    if (!trendEligible) return [];
    const earlierTotal = trendEarlier.summary.totalEvents ?? trendEarlier.eventCount;
    const recentTotal = trendRecent.summary.totalEvents ?? trendRecent.eventCount;
    const earlierForward = percentOf(trendEarlier.summary.forwardCount, earlierTotal);
    const recentForward = percentOf(trendRecent.summary.forwardCount, recentTotal);
    const earlierInvolvement = percentOf(trendEarlier.summary.scoreInvolvement, earlierTotal);
    const recentInvolvement = percentOf(trendRecent.summary.scoreInvolvement, recentTotal);
    const earlierAvgCarry = trendEarlier.summary.averageCarry;
    const recentAvgCarry = trendRecent.summary.averageCarry;
    return [
      {
        label: 'Score involvement rate',
        earlier: formatPercentValue(earlierInvolvement),
        recent: formatPercentValue(recentInvolvement),
        delta: formatDeltaPercent(Number.isFinite(earlierInvolvement) && Number.isFinite(recentInvolvement) ? recentInvolvement - earlierInvolvement : null),
        deltaTone: Number.isFinite(earlierInvolvement) && Number.isFinite(recentInvolvement)
          ? (Math.abs(recentInvolvement - earlierInvolvement) < 5
            ? 'flat'
            : (recentInvolvement - earlierInvolvement > 0 ? 'up' : 'down'))
          : 'flat',
      },
      {
        label: 'Total events',
        earlier: earlierTotal,
        recent: recentTotal,
        delta: formatDeltaCount(Number.isFinite(recentTotal) && Number.isFinite(earlierTotal) ? recentTotal - earlierTotal : null),
        deltaTone: Number.isFinite(recentTotal) && Number.isFinite(earlierTotal)
          ? (recentTotal - earlierTotal > 0 ? 'up' : recentTotal - earlierTotal < 0 ? 'down' : 'flat')
          : 'flat',
      },
      {
        label: 'Forward %',
        earlier: formatPercentValue(earlierForward),
        recent: formatPercentValue(recentForward),
        delta: formatDeltaPercent(Number.isFinite(earlierForward) && Number.isFinite(recentForward) ? recentForward - earlierForward : null),
        deltaTone: Number.isFinite(earlierForward) && Number.isFinite(recentForward)
          ? (recentForward - earlierForward > 0 ? 'up' : recentForward - earlierForward < 0 ? 'down' : 'flat')
          : 'flat',
      },
      {
        label: 'Avg carry',
        earlier: formatMetres(earlierAvgCarry),
        recent: formatMetres(recentAvgCarry),
        delta: Number.isFinite(earlierAvgCarry) && Number.isFinite(recentAvgCarry)
          ? formatSignedMetres(recentAvgCarry - earlierAvgCarry)
          : '-',
        deltaTone: Number.isFinite(earlierAvgCarry) && Number.isFinite(recentAvgCarry)
          ? (recentAvgCarry - earlierAvgCarry > 0 ? 'up' : recentAvgCarry - earlierAvgCarry < 0 ? 'down' : 'flat')
          : 'flat',
      },
      {
        label: 'Top outcome',
        earlier: trendEarlier.summary.topOutcome || '-',
        recent: trendRecent.summary.topOutcome || '-',
        delta: '-',
        deltaTone: 'flat',
      },
    ];
  })();
</script>

<section class="analysis-shell">
  <div class="heading">
    <div>
      <div class="eyebrow">Post-match</div>
      <h2>Possession Analysis</h2>
      <p>Log where a player receives the ball, what they do with it, and how the possession ends.</p>
    </div>
    <div class="match-meta">
      <div>{matchMetaTitle}</div>
      <div>{matchMetaSubtitle}</div>
    </div>
  </div>

  {#if notice}
    <div class="notice" aria-live="polite">{notice}</div>
  {/if}

  {#if !activeMatchId}
    <div class="empty-state">
      Select a completed match to start analysis.
    </div>
  {:else}
    <div class="grid">
      <section class="card">
        <h3>Session Builder</h3>
        <label class="field">
          <span>Player</span>
          <input list="possession-player-options" bind:value={playerInput} placeholder="Type a player" disabled={!!draftSession} />
          <datalist id="possession-player-options">
            {#each playerAutocomplete as player (player.key)}
              <option value={player.label}></option>
            {/each}
          </datalist>
        </label>

        <div class="button-row">
          <button type="button" on:click={startDraftSession} disabled={!!draftSession || !playerInput.trim()}>Start draft session</button>
          <button type="button" on:click={cancelDraftSession} disabled={!draftSession}>Discard draft</button>
        </div>

        <div class="session-config">
          <div class="config-group">
            <span>Attacking direction for this session</span>
            <div class="segmented">
              <button type="button" class:active={draftOurGoalAtTop} disabled={!!draftSession} on:click={() => setDraftOrientation(true)}>
                Our goal at top
              </button>
              <button type="button" class:active={!draftOurGoalAtTop} disabled={!!draftSession} on:click={() => setDraftOrientation(false)}>
                Our goal at bottom
              </button>
            </div>
          </div>
          <div class="config-group">
            <span>Half</span>
            <div class="segmented">
              {#each HALF_OPTIONS.filter((option) => option.value !== null) as option (option.value)}
                <button
                  type="button"
                  class:active={draftHalf === option.value}
                  disabled={!!draftSession}
                  on:click={() => setDraftHalf(option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
            <button type="button" class="link-button" disabled={!!draftSession || draftHalf === null} on:click={() => setDraftHalf(null)}>
              Clear half
            </button>
          </div>
        </div>

        <div class="session-guidance">
          Create a separate session for each half if the attacking direction changes at half time.
        </div>

        {#if draftSession}
          <div class="draft-box">
            <div class="draft-head">
              <div class="step">{draftStep === 'receive' ? 'Tap receive point' : draftStep === 'release' ? 'Tap release point' : 'Choose outcome then add draft event'}</div>
              <div class="draft-status">
                <span class="draft-chip">Draft session</span>
                <span>{draftEventCount} event{draftEventCount === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div class="pitch-frame">
              <Pitch
                interactive={true}
                flip={!draftSession.our_goal_at_top}
                contestType="clean"
                landing={draftSession ? draftEvent.receive : point()}
                pickup={draftSession ? draftEvent.release : point()}
                overlays={draftOverlays}
                connections={draftConnections}
                showZoneLabels={true}
                showZoneLegend={false}
                ownGoalFill="rgba(255,255,255,0.16)"
                oppositionGoalFill="rgba(255,255,255,0.05)"
                ownGoalBandStroke="rgba(255,255,255,0.95)"
                on:landed={(e) => handlePitchPoint(e.detail)}
              />
            </div>

            <div class="mini-grid">
              <div><span>Receive</span><strong>{Number.isFinite(draftEvent.receive.x) ? `${draftEvent.receive.x.toFixed(2)}, ${draftEvent.receive.y.toFixed(2)}` : 'Tap pitch'}</strong></div>
              <div><span>Release</span><strong>{Number.isFinite(draftEvent.release.x) ? `${draftEvent.release.x.toFixed(2)}, ${draftEvent.release.y.toFixed(2)}` : 'Tap pitch'}</strong></div>
            </div>

            {#if draftSession.events.length > 0}
              <div class="draft-log" aria-label="Draft event list">
                <div class="draft-log-head">
                  <strong>Draft events</strong>
                  <span>{draftSession.events.length}</span>
                </div>
                <div class="draft-log-list">
                  {#each draftSession.events as event, index (event.id)}
                    <div class="draft-log-row">
                      <div class="draft-log-main">
                        <strong>
                          {index + 1}. {event.outcome}
                          {#if event.assist}
                            <span class="event-badge assist">Assist</span>
                          {/if}
                        </strong>
                        <span>
                          {movementDirectionLabel(draftDirectionOf(event))}
                          {event.under_pressure ? ' - Under pressure' : ''}
                        </span>
                      </div>
                      <button type="button" class="draft-row-remove" on:click={() => removeDraftEvent(event.id)}>
                        Remove
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="outcomes">
              {#each OUTCOMES as outcome (outcome)}
                <button
                  type="button"
                  class:active={draftEvent.outcome === outcome}
                  on:click={() => setDraftOutcome(outcome)}
                >
                  {outcome}
                </button>
              {/each}
            </div>

            {#if ASSIST_ELIGIBLE_OUTCOMES.has(draftEvent.outcome)}
              <label class="pressure">
                <input type="checkbox" checked={draftEvent.assist} on:change={(e) => setDraftAssist(e.currentTarget.checked)} />
                <span>Assist - led directly to a score</span>
              </label>
            {/if}

            <label class="pressure">
              <input type="checkbox" bind:checked={draftEvent.under_pressure} />
              <span>Under pressure</span>
            </label>

            <div class="button-row">
              <button type="button" on:click={clearCurrentDraftPoint} disabled={!draftSession}>Clear point</button>
              <button type="button" on:click={undoLastDraftEvent} disabled={!draftSession || draftSession.events.length === 0}>Undo draft event</button>
              <button type="button" class="primary" on:click={addDraftEvent} disabled={!draftSession}>Add draft event</button>
              <button type="button" class="primary" on:click={saveDraftSession} disabled={!draftSession}>Finalize session</button>
            </div>
          </div>
        {:else}
          <div class="empty-state">Start a draft session to begin logging possession events.</div>
        {/if}
      </section>

      <section class="card" bind:this={analysisCardEl}>
        <div class="card-head">
          <h3>Analysis View</h3>
          <div class="card-head-right">
            <div class="view-toggle">
              <button type="button" class:active={viewMode === 'dots'} on:click={() => viewMode = 'dots'}>Dots</button>
              <button type="button" class:active={viewMode === 'heat'} on:click={() => viewMode = 'heat'}>Heat</button>
            </div>
            <div class="export-actions">
              <button type="button" on:click={exportPossessionCSV} disabled={totalEvents === 0} title="Download raw event data as CSV">CSV</button>
              <button type="button" on:click={shareSnapshot} disabled={totalEvents === 0 || exportingSnapshot} title="Share or download a snapshot of this view">
                {exportingSnapshot ? '...' : 'Snapshot'}
              </button>
            </div>
          </div>
        </div>
        {#if exportFeedback}
          <div class="export-feedback">{exportFeedback}</div>
        {/if}

        <div class="mode-toggle">
          <button type="button" class:active={analysisMode === 'match'} on:click={() => setAnalysisMode('match')}>
            This match
          </button>
          <button type="button" class:active={analysisMode === 'cross'} on:click={() => setAnalysisMode('cross')}>
            Across matches
          </button>
        </div>

        {#if analysisMode === 'cross'}
          {#if crossMatchCatalogRows.length === 0}
            <div class="empty-state">This player has no saved possession sessions across the available matches yet.</div>
          {:else}
            <div class="cross-match-controls">
              <div class="cross-match-list">
                {#each crossMatchCatalogRows as row (row.matchId)}
                  <label class="cross-match-item">
                    <input
                      type="checkbox"
                      checked={selectedCrossMatchIds.includes(row.matchId)}
                      on:change={() => toggleCrossMatch(row.matchId)}
                    />
                    <span>
                      <strong>{row.label}</strong>
                      <small>{row.summary.total ?? row.summary.totalEvents ?? row.events.length} events</small>
                    </span>
                  </label>
                {/each}
              </div>
              <div class="button-row">
                <button type="button" on:click={() => selectAllCrossMatches(crossMatchIdsForPlayer)} disabled={crossMatchIdsForPlayer.length === 0}>
                  Select all
                </button>
                <button type="button" on:click={() => setAnalysisMode('match')} disabled={selectedCrossMatchIds.length === 0}>
                  Back to this match
                </button>
              </div>
            </div>
          {/if}
        {/if}

        <div class="filter-row" aria-label="Half filter">
          {#each HALF_OPTIONS as option (option.label)}
            <button
              type="button"
              class:active={(selectedHalf ?? null) === option.value}
              on:click={() => setSelectedHalf(option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
        <div class="player-strip">
          {#each playerDirectory as player (player.key)}
            <button type="button" class:selected={selectedPlayerKey === player.key} on:click={() => selectPlayer(player)}>
              {player.label} <span>{player.count}</span>
            </button>
          {/each}
        </div>

        {#if selectedPlayerMismatch}
          <div class="sample-note mismatch-note">
            <div>
              <strong>Name check</strong>
              <div>
                “{selectedPlayerMismatch.label}” is not on the squad list yet. Merge these sessions into a roster player to keep cross-match profiles clean.
              </div>
              {#if rosterPlayers.length === 0}
                <small>Add players in Admin to enable merging.</small>
              {/if}
            </div>
            {#if rosterPlayers.length > 0}
              <div class="mismatch-actions">
                <select bind:value={mergeTargetPlayerKey}>
                  <option value="">Choose squad player</option>
                  {#each rosterPlayers as player (player.id)}
                    <option value={squadPlayerKey(player.id)}>{player.name}</option>
                  {/each}
                </select>
                <button type="button" class="primary" on:click={mergeSelectedPlayerNames} disabled={!mergeTargetPlayerKey}>
                  Merge names
                </button>
              </div>
            {/if}
          </div>
        {/if}

        {#if selectedPlayerSessions.length > 1}
          <label class="field">
            <span>Session</span>
            <select bind:value={selectedSessionId} on:change={(e) => selectSession(e.currentTarget.value)}>
              <option value="all">All sessions</option>
              {#each selectedPlayerSessions as session, index (session.id)}
                <option value={session.id}>{sessionLabel(session, index, 'event', 'events')}</option>
              {/each}
            </select>
          </label>
        {/if}


        <div class="filter-row show-only" aria-label="Analysis filters">
          <span class="filter-label">Show only:</span>
          <button type="button" class:active={showPressureOnly} on:click={() => showPressureOnly = !showPressureOnly}>
            Under pressure only
          </button>
          <button type="button" class:active={showScoreInvolvementsOnly} on:click={() => showScoreInvolvementsOnly = !showScoreInvolvementsOnly}>
            Score involvements only
          </button>
          <button type="button" class:active={showCarryLines} on:click={() => showCarryLines = !showCarryLines}>
            Show carry lines
          </button>
        </div>

        {#if analysisMode === 'cross' && selectedCrossMatchIds.length === 0}
          <div class="empty-state">Choose one or more matches to view the aggregated profile.</div>
        {:else if selectedHalf && selectedPlayerSessions.length === 0}
          <div class="empty-state">No sessions logged for this half.</div>
        {:else if analysisMode === 'cross' && selectedPlayerSessions.length === 0}
          <div class="empty-state">This player has no saved sessions in the selected matches.</div>
        {:else if totalEvents === 0}
          <div class="empty-state">No saved possession events for the current selection.</div>
        {:else}
          <div class="summary-grid">
            <div class="emphasis">
              <span>Score involvement</span>
              <strong>{scoreInvolvement}</strong>
              {#if scoreInvolvementDetail || scoreInvolvementRateLabel}
                <small>{scoreInvolvementDetail}{scoreInvolvementRateLabel ? ` ${scoreInvolvementRateLabel}` : ''}</small>
              {/if}
            </div>
            <div><span>Total events</span><strong>{totalEvents}</strong></div>
            <div><span>Forward</span><strong>{forwardDisplay}</strong></div>
            <div><span>Lateral</span><strong>{lateralDisplay}</strong></div>
            <div><span>Backward</span><strong>{backwardDisplay}</strong></div>
            <div><span>Avg carry</span><strong>{formatMetres(averageCarry)}</strong></div>
          </div>

          {#if sampleNote}
            <div class="sample-note">{sampleNote}</div>
          {/if}

          <div class="outcome-list">
            {#each outcomeBreakdown as item (item.label)}
              <div>
                <span>{item.label}</span>
                <strong>{item.count} <small>{formatPercent(item.count, totalEvents)}</small></strong>
              </div>
            {/each}
          </div>

          <div class="pitch-frame">
            <!-- Analysis points are normalized to attack right before render. -->
            {#if viewMode === 'heat'}
              <Heatmap points={heatPoints} cols={140} radius={3} smooth={2} colorScheme="density" />
            {:else}
              <Pitch
                interactive={false}
                flip={false}
                contestType="clean"
                landing={{ x: NaN, y: NaN }}
                pickup={{ x: NaN, y: NaN }}
                overlays={dotOverlays}
                connections={dotConnections}
                showZoneLabels={false}
                showZoneLegend={false}
                ownGoalFill="rgba(255,255,255,0.16)"
                oppositionGoalFill="rgba(255,255,255,0.05)"
                ownGoalBandStroke="rgba(255,255,255,0.95)"
                on:overlayclick={(e) => selectEvent(e.detail.overlay.id)}
              />
            {/if}
          </div>

          {#if viewMode === 'dots'}
            <div class="legend-card">
              <button type="button" class="legend-toggle" on:click={() => legendOpen = !legendOpen}>
                Legend
              </button>
              {#if legendOpen}
                <div class="legend-grid">
                  <div class="legend-section">
                    <strong>Outcomes</strong>
                    <div class="legend-list">
                      {#each OUTCOMES as outcome (outcome)}
                        <div class="legend-item">
                          <span class="legend-swatch" style={`background:${OUTCOME_COLORS[outcome] || '#1c3f8a'}`}></span>
                          <span>{outcome}</span>
                        </div>
                      {/each}
                      <div class="legend-item">
                        <span class="legend-swatch" style={`background:${OUTCOME_COLORS['Passed / offloaded']}`}></span>
                        <span>Passed / offloaded (legacy)</span>
                      </div>
                    </div>
                  </div>
                  <div class="legend-section">
                    <strong>Markers</strong>
                    <div class="legend-list">
                      <div class="legend-item"><span class="legend-dot assist"></span><span>Assist - led directly to a score</span></div>
                      <div class="legend-item"><span class="legend-ring"></span><span>Under pressure</span></div>
                    </div>
                  </div>
                  <div class="legend-section">
                    <strong>Carry arrows</strong>
                    <div class="legend-list">
                      <div class="legend-item"><span class="legend-arrow forward"></span><span>Forward carry</span></div>
                      <div class="legend-item"><span class="legend-arrow lateral"></span><span>Lateral carry</span></div>
                      <div class="legend-item"><span class="legend-arrow backward"></span><span>Backward carry</span></div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if analysisMode === 'cross'}
            <div class="trend-section">
              <div class="trend-head">
                <div>
                  <h4>Trend comparison</h4>
                  <p>Compare earlier matches to more recent ones without forcing a verdict.</p>
                </div>
                <div class="trend-controls">
                  <button type="button" class:active={trendMode === 'halves'} on:click={() => trendMode = 'halves'}>
                    First vs second half
                  </button>
                  <button
                    type="button"
                    class:active={trendMode === 'lastN' && trendLastN === 3}
                    on:click={() => {
                      trendMode = 'lastN';
                      trendLastN = 3;
                    }}
                  >
                    Last 3 matches
                  </button>
                  <button
                    type="button"
                    class:active={trendMode === 'lastN' && trendLastN === 5}
                    on:click={() => {
                      trendMode = 'lastN';
                      trendLastN = 5;
                    }}
                  >
                    Last 5 matches
                  </button>
                </div>
              </div>

              {#if !trendEligible}
                <div class="sample-note">
                  Trend comparison needs at least 4 matches selected. You have {selectedCrossMatchIds.length}.
                </div>
              {:else if trendEarlier.eventCount === 0 || trendRecent.eventCount === 0}
                <div class="sample-note">
                  Not enough split data to compare earlier vs recent yet.
                </div>
              {:else}
                <div class="trend-delta {trendDeltaTone}">{trendDeltaLabel}</div>

                <div class="trend-toggle">
                  <button type="button" class:active={trendFocus === 'earlier'} on:click={() => trendFocus = 'earlier'}>
                    Earlier
                  </button>
                  <button type="button" class:active={trendFocus === 'recent'} on:click={() => trendFocus = 'recent'}>
                    Recent
                  </button>
                </div>

                <div class="trend-grid {trendFocus === 'recent' ? 'focus-recent' : 'focus-earlier'}">
                  <div class="trend-panel earlier">
                    <div class="trend-label">Earlier</div>
                    <div class="trend-meta">{trendEarlier.matchCount} matches - {trendEarlier.eventCount} events</div>
                    {#if trendEarlier.dateRange}
                      <div class="trend-range">{trendEarlier.dateRange}</div>
                    {/if}
                    <div class="pitch-frame">
                      <Heatmap points={trendEarlier.heatPoints} cols={140} radius={3} smooth={2} colorScheme="density" />
                    </div>
                  </div>
                  <div class="trend-panel recent">
                    <div class="trend-label">Recent</div>
                    <div class="trend-meta">{trendRecent.matchCount} matches - {trendRecent.eventCount} events</div>
                    {#if trendRecent.dateRange}
                      <div class="trend-range">{trendRecent.dateRange}</div>
                    {/if}
                    <div class="pitch-frame">
                      <Heatmap points={trendRecent.heatPoints} cols={140} radius={3} smooth={2} colorScheme="density" />
                    </div>
                  </div>
                </div>

                <div class="trend-compare">
                  <div class="trend-row trend-head">
                    <span>Metric</span>
                    <span>Earlier</span>
                    <span>Recent</span>
                    <span>Delta</span>
                  </div>
                  {#each trendCompareRows as row (row.label)}
                    <div class="trend-row">
                      <strong>{row.label}</strong>
                      <span>{row.earlier}</span>
                      <span>{row.recent}</span>
                      <span class="delta {row.deltaTone}">{row.delta}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          {#if analysisMode === 'cross' && crossMatchRows.length > 0}
            <div class="cross-table">
              <div class="cross-head">
                <span>Match</span>
                <span>Involvement</span>
                <span>Events</span>
                <span>Fwd</span>
                <span>Back</span>
                <span>Top outcome</span>
              </div>
              {#each crossMatchRows as row (row.matchId)}
                {@const rowTotal = row.summary.total ?? row.summary.totalEvents ?? row.events.length}
                {@const rowInvolvementRate = Number.isFinite(row.summary.scoreInvolvementRate) ? `${Math.round(row.summary.scoreInvolvementRate * 100)}%` : '—'}
                <button
                  type="button"
                  class="cross-row"
                  on:click={() => {
                    dispatch('selectMatch', row.matchId);
                    setAnalysisMode('match');
                  }}
                >
                  <strong>{row.label}</strong>
                  <span>{row.summary.scoreInvolvement ?? 0} ({rowInvolvementRate})</span>
                  <span>{rowTotal}</span>
                  <span>{formatPercent(row.summary.forwardCount, rowTotal)}</span>
                  <span>{formatPercent(row.summary.backwardCount, rowTotal)}</span>
                  <span>{row.summary.topOutcome || '—'}</span>
                </button>
              {/each}
            </div>
          {/if}

          {@const selectedEvent = currentSelectedEvent(displayedEventsVisible, selectedEventId)}
          {#if selectedEvent && eventEditDraft}
            <div class="detail-card popover">
              <div class="detail-title">Edit event</div>
              <div class="detail-grid">
                <span>Receive</span><strong>{Number.isFinite(selectedEvent.receive.x) ? `${selectedEvent.receive.x.toFixed(2)}, ${selectedEvent.receive.y.toFixed(2)}` : '—'}</strong>
                <span>Release</span><strong>{Number.isFinite(selectedEvent.release.x) ? `${selectedEvent.release.x.toFixed(2)}, ${selectedEvent.release.y.toFixed(2)}` : '—'}</strong>
              </div>

              <label class="field edit-field">
                <span>Outcome</span>
                <select bind:value={eventEditDraft.outcome} on:change={(e) => setEventEditOutcome(e.currentTarget.value)}>
                  {#each OUTCOMES as outcome (outcome)}
                    <option value={outcome}>{outcome}</option>
                  {/each}
                </select>
              </label>

              {#if ASSIST_ELIGIBLE_OUTCOMES.has(eventEditDraft.outcome)}
                <label class="pressure">
                  <input type="checkbox" checked={eventEditDraft.assist} on:change={(e) => setEventEditAssist(e.currentTarget.checked)} />
                  <span>Assist - led directly to a score</span>
                </label>
              {/if}

              <label class="pressure">
                <input type="checkbox" checked={eventEditDraft.under_pressure} on:change={(e) => setEventEditPressure(e.currentTarget.checked)} />
                <span>Under pressure</span>
              </label>

              <div class="button-row">
                <button type="button" class="primary" on:click={saveEventEditor}>Save changes</button>
                <button type="button" on:click={cancelEventEditor}>Cancel</button>
              </div>
            </div>
          {/if}
        {/if}
      </section>
    </div>

    <section class="card sessions-card">
      <div class="card-head">
        <h3>Saved Sessions</h3>
        <span>{matchSessions.length}</span>
      </div>

      {#if matchSessions.length === 0}
        <div class="empty-state">No saved sessions yet for this match.</div>
      {:else}
        <div class="session-list">
          {#each matchSessions as session (session.id)}
            <div class="session-row {selectedSessionId === session.id ? 'selected' : ''}">
              <button type="button" class="session-main" on:click={() => selectSession(session.id)}>
                <strong>{session.player_name}</strong>
                <span>{session.events.length} events - {session.our_goal_at_top ? 'Our goal left' : 'Our goal right'} - {session.created_at.slice(0, 10)}</span>
              </button>
              <button type="button" class="danger" on:click={() => deleteSession(session)}>Delete</button>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</section>

<style>
  .analysis-shell { display: flex; flex-direction: column; gap: 14px; }
  .heading { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
  .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #1c3f8a; }
  h2 { margin: 4px 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.04em; }
  .heading p { margin: 6px 0 0; color: #6b7280; font-size: 13px; line-height: 1.5; max-width: 62ch; }
  .match-meta { text-align: right; font-size: 12px; color: #6b7280; line-height: 1.5; }
  .notice, .empty-state, .draft-box, .detail-card, .session-row { border-radius: 14px; }
  .notice { padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 13px; font-weight: 600; }
  .empty-state { padding: 16px; background: #fff; border: 1px dashed #d1d5db; color: #6b7280; font-size: 13px; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  .card-head h3 { margin: 0; font-size: 15px; font-weight: 800; }
  .card-head-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .export-actions { display: flex; gap: 6px; }
  .export-actions button { font-size: 11px; padding: 5px 9px; }
  .export-feedback { font-size: 12px; color: #b91c1c; margin-bottom: 8px; }
  .card-head span { font-size: 12px; font-weight: 700; color: #1d4ed8; background: #dbeafe; padding: 4px 8px; border-radius: 999px; }
  .field { display: flex; flex-direction: column; gap: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
  .field input, .field select { border: 1.5px solid #d1d5db; border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 13px; color: #111827; background: #fff; }
  .field input:disabled { background: #f9fafb; opacity: 0.8; }
  .button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  button { border: 1.5px solid #d1d5db; background: #fff; color: #374151; border-radius: 10px; padding: 8px 12px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; }
  button:hover:not(:disabled) { background: #f9fafb; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  .primary { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .primary:hover:not(:disabled) { background: #163270; }
  .danger { border-color: #fecaca; color: #b91c1c; }
  .link-button { padding: 0; border: none; background: transparent; color: #1d4ed8; font-size: 12px; font-weight: 700; text-align: left; }
  .link-button:hover:not(:disabled) { background: transparent; text-decoration: underline; }
  .session-config { display: grid; gap: 10px; margin-top: 12px; }
  .config-group { display: grid; gap: 8px; }
  .config-group span { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .segmented { display: inline-flex; flex-wrap: wrap; gap: 6px; }
  .segmented button { border-radius: 999px; background: #f8fafc; }
  .segmented button.active { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .session-guidance { margin-top: 10px; font-size: 12px; line-height: 1.45; color: #6b7280; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
  .mode-toggle { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 12px; border-radius: 999px; background: #eff6ff; border: 1px solid #dbeafe; }
  .mode-toggle button { border: none; background: transparent; border-radius: 999px; padding: 8px 12px; }
  .mode-toggle button.active { background: #1c3f8a; color: #fff; }
  .cross-match-controls { display: grid; gap: 10px; margin-bottom: 12px; }
  .cross-match-list { display: grid; gap: 8px; }
  .cross-match-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb; font-size: 12px; text-transform: none; letter-spacing: 0; font-weight: 600; }
  .cross-match-item input { width: 16px; height: 16px; accent-color: #1c3f8a; }
  .cross-match-item span { display: flex; flex-direction: column; gap: 2px; }
  .cross-match-item strong { font-size: 12px; color: #111827; }
  .cross-match-item small { color: #6b7280; font-size: 11px; }
  .draft-box { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef2f7; display: grid; gap: 12px; }
  .draft-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .step { font-size: 13px; font-weight: 700; color: #1d4ed8; }
  .draft-status { display: inline-flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px; font-weight: 700; }
  .draft-chip { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
  .pitch-frame { border-radius: 14px; overflow: hidden; background: #2f5f32; }
  .mini-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .mini-grid div { border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px 10px; background: #f8fafc; display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }
  .mini-grid span { color: #6b7280; font-weight: 700; }
  .mini-grid strong { font-variant-numeric: tabular-nums; color: #111827; }
  .draft-log { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; background: #fafafa; display: grid; gap: 8px; }
  .draft-log-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: #374151; }
  .draft-log-head strong { font-size: 12px; }
  .draft-log-head span { font-size: 11px; font-weight: 700; color: #1d4ed8; background: #dbeafe; padding: 3px 7px; border-radius: 999px; }
  .draft-log-list { display: grid; gap: 6px; max-height: 220px; overflow: auto; padding-right: 2px; }
  .draft-log-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-radius: 10px; border: 1px solid #eef2f7; background: #fff; padding: 8px 10px; }
  .draft-log-main { display: grid; gap: 2px; min-width: 0; }
  .draft-log-main strong { font-size: 12px; color: #111827; }
  .draft-log-main span { font-size: 11px; color: #6b7280; }
  .event-badge { display: inline-flex; align-items: center; margin-left: 6px; padding: 2px 6px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .event-badge.assist { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
  .draft-row-remove { border-color: #fecaca; color: #b91c1c; padding: 6px 10px; border-radius: 999px; font-size: 11px; }
  .outcomes { display: flex; flex-wrap: wrap; gap: 6px; }
  .outcomes button { border-radius: 999px; padding: 7px 10px; font-size: 12px; }
  .outcomes button.active { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .pressure { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; text-transform: none; letter-spacing: 0; }
  .pressure input { width: 16px; height: 16px; accent-color: #1c3f8a; }
  .filter-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; }
  .filter-row button { border-radius: 999px; background: #f8fafc; font-size: 12px; }
  .filter-row button.active { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .filter-row.show-only { margin-top: 8px; padding: 8px 10px; border-radius: 12px; background: #f8fafc; border: 1px solid #e5e7eb; }
  .filter-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .view-toggle { display: inline-flex; background: #f3f4f6; border-radius: 999px; padding: 3px; gap: 3px; }
  .view-toggle button { border: none; background: transparent; border-radius: 999px; }
  .view-toggle button.active { background: #fff; color: #1c3f8a; }
  .player-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .player-strip button { display: inline-flex; gap: 8px; align-items: center; border-radius: 999px; background: #f8fafc; }
  .player-strip button.selected { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
  .player-strip span { opacity: 0.7; font-size: 11px; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
  .summary-grid div { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
  .summary-grid .emphasis { background: #eff6ff; border-color: #bfdbfe; }
  .summary-grid span { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }
  .summary-grid strong { font-size: 18px; font-weight: 900; color: #111827; }
  .summary-grid small { font-size: 11px; font-weight: 700; line-height: 1.4; color: #1d4ed8; }
  .sample-note { margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; border: 1px dashed #d1d5db; background: #fafafa; color: #6b7280; font-size: 12px; }
  .outcome-list { display: grid; gap: 6px; margin-bottom: 12px; }
  .outcome-list div { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; font-size: 12px; }
  .outcome-list strong { display: inline-flex; align-items: baseline; gap: 4px; }
  .outcome-list small { color: #6b7280; font-size: 11px; font-weight: 700; }
  .legend-card { margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: 10px 12px; }
  .legend-toggle { padding: 0; border: none; background: transparent; color: #1d4ed8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .legend-grid { margin-top: 10px; display: grid; gap: 12px; }
  .legend-section strong { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 800; color: #111827; text-transform: uppercase; letter-spacing: 0.08em; }
  .legend-list { display: grid; gap: 6px; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #374151; }
  .legend-swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(17, 24, 39, 0.12); flex-shrink: 0; }
  .legend-dot { width: 12px; height: 12px; border-radius: 999px; background: #f59e0b; border: 1px solid rgba(17, 24, 39, 0.14); display: inline-block; flex-shrink: 0; }
  .legend-ring { width: 12px; height: 12px; border-radius: 999px; border: 2px solid rgba(220, 38, 38, 0.9); background: #fff; display: inline-block; flex-shrink: 0; }
  .legend-arrow { width: 14px; height: 3px; border-radius: 999px; display: inline-block; flex-shrink: 0; }
  .legend-arrow.forward { background: #16a34a; }
  .legend-arrow.lateral { background: #d97706; }
  .legend-arrow.backward { background: #dc2626; }
  .mismatch-note { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .mismatch-note strong { display: block; margin-bottom: 4px; }
  .mismatch-note small { display: block; margin-top: 4px; color: #6b7280; }
  .mismatch-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
  .mismatch-actions select { min-width: 180px; border: 1.5px solid #d1d5db; border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: 13px; color: #111827; background: #fff; }
  .detail-card { margin-top: 12px; background: #f8fafc; border: 1px solid #e5e7eb; padding: 12px; }
  .detail-card.popover { background: #fff; border-color: #bfdbfe; box-shadow: 0 16px 40px rgba(28, 63, 138, 0.12); }
  .detail-title { font-size: 14px; font-weight: 800; margin-bottom: 10px; }
  .detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 12px; }
  .detail-grid span { color: #6b7280; font-weight: 700; }
  .detail-grid strong { color: #111827; }
  .edit-field { margin-top: 10px; text-transform: none; letter-spacing: 0; font-size: 12px; }
  .edit-field span { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
  .edit-field select { border: 1.5px solid #d1d5db; border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 13px; color: #111827; background: #fff; }
  .cross-table { display: grid; gap: 6px; margin-top: 12px; }
  .cross-head, .cross-row { display: grid; grid-template-columns: minmax(0, 1.3fr) repeat(5, minmax(0, 0.55fr)); gap: 8px; align-items: center; }
  .cross-head { color: #6b7280; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .cross-row { width: 100%; text-align: left; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 10px; padding: 8px 10px; }
  .cross-row strong { font-size: 12px; color: #111827; }
  .cross-row span { text-align: center; color: #374151; font-size: 12px; }
  .trend-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef2f7; display: grid; gap: 12px; }
  .trend-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  .trend-head h4 { margin: 0; font-size: 14px; font-weight: 800; }
  .trend-head p { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
  .trend-controls { display: flex; flex-wrap: wrap; gap: 6px; }
  .trend-controls button { font-size: 12px; padding: 6px 10px; }
  .trend-controls button.active { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .trend-delta { font-size: 13px; font-weight: 700; color: #374151; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; }
  .trend-delta.up { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
  .trend-delta.down { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
  .trend-delta.flat { color: #374151; }
  .trend-toggle { display: none; gap: 6px; }
  .trend-toggle button { font-size: 12px; padding: 6px 10px; }
  .trend-toggle button.active { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .trend-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .trend-panel { display: grid; gap: 6px; }
  .trend-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .trend-meta { font-size: 12px; font-weight: 700; color: #111827; }
  .trend-range { font-size: 11px; color: #6b7280; }
  .trend-compare { display: grid; gap: 6px; }
  .trend-row { display: grid; grid-template-columns: minmax(0, 1.2fr) repeat(3, minmax(0, 0.6fr)); gap: 8px; align-items: center; }
  .trend-row strong { font-size: 12px; }
  .trend-row span { font-size: 12px; text-align: center; color: #374151; }
  .trend-row.trend-head { color: #6b7280; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .trend-row .delta.up { color: #166534; }
  .trend-row .delta.down { color: #b91c1c; }
  .trend-row .delta.flat { color: #6b7280; }
  .session-list { display: grid; gap: 10px; }
  .session-row { border: 1px solid #e5e7eb; padding: 10px; display: grid; gap: 8px; }
  .session-row.selected { background: #eff6ff; border-color: #93c5fd; }
  .session-main { border: none; padding: 0; background: transparent; text-align: left; display: grid; gap: 4px; }
  .session-main strong { font-size: 13px; }
  .session-main span { font-size: 11px; color: #6b7280; }
  @media (min-width: 900px) { .grid { grid-template-columns: minmax(320px, 0.9fr) 1.1fr; } .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 820px) {
    .trend-toggle { display: flex; }
    .trend-grid { grid-template-columns: 1fr; }
    .trend-grid.focus-earlier .trend-panel.recent { display: none; }
    .trend-grid.focus-recent .trend-panel.earlier { display: none; }
  }
  @media (max-width: 640px) {
    .match-meta { text-align: left; }
    .mini-grid { grid-template-columns: 1fr; }
    .summary-grid { grid-template-columns: 1fr; }
    .mode-toggle { width: 100%; justify-content: stretch; }
    .mode-toggle button { flex: 1; }
    .mismatch-note { flex-direction: column; }
    .mismatch-actions { width: 100%; justify-content: stretch; }
    .mismatch-actions select { width: 100%; min-width: 0; }
    .cross-head, .cross-row { grid-template-columns: minmax(0, 1.1fr) repeat(5, minmax(0, 0.42fr)); }
  }
</style>
