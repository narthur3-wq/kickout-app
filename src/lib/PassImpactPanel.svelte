<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Pitch from './Pitch.svelte';
  import {
    aggregateConnections,
    analysisPointForSession,
    averageOf,
    collectPlayerOptions,
    buildPlayerDirectory,
    depthDeltaMeters,
    displayPlayerLabel,
    formatMetres,
    formatSignedMetres,
    movementDirection,
    movementDirectionColor,
    movementDirectionLabel,
    movementDirectionForSession,
    normalizePlayerKey,
    pointDistanceMeters,
    resolveSessionPlayerIdentity,
    sessionLabel,
    squadPlayerKey,
  } from './postMatchAnalysis.js';
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
  export let teamName = '';
  export let opponentName = '';
  export let matchLabel = '';
  export let playerOptions = [];
  export let squadPlayers = [];
  export let matches = [];
  export let defaultOurGoalAtTop = true;

  const PASS_TYPES = ['Kickpass', 'Handpass'];

  let analysisState = createEmptyAnalysisState();
  let loadedScope = null;
  let loadedAnalysisRefreshToken = null;
  let draftSession = null;
  let draftEvent = blankDraftEvent();
  let draftStep = 'from';
  let draftOurGoalAtTop = defaultOurGoalAtTop;
  let selectedPlayerKey = '';
  let selectedSessionId = 'all';
  let selectedConnectionId = null;
  let mergeTargetPlayerKey = '';
  let rosterPropSource = null;
  let playerInput = '';
  let notice = '';
  let analysisCardEl;
  let exportingSnapshot = false;
  let exportFeedback = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function point() {
    return { x: NaN, y: NaN };
  }

  function blankDraftEvent() {
    return {
      from: point(),
      to: point(),
      pass_type: 'Kickpass',
      completed: true,
    };
  }

  function titleOfMatch() {
    if (matchLabel) return matchLabel;
    if (teamName || opponentName) return `${teamName || 'Team'}${opponentName ? ` v ${opponentName}` : ''}`;
    return 'Match';
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
      mode: 'pass',
      match_id: activeMatchId || null,
      player_name: identity.label || player,
      player_key: identity.key || normalizePlayerKey(player),
      squad_player_id: identity.squad_player_id || null,
      our_goal_at_top: !!draftOurGoalAtTop,
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

  function saveState(nextState) {
    const previousState = analysisState;
    analysisState = nextState;
    if (storageScope) saveAnalysisState(nextState, storageScope);
    dispatch('analysischange', {
      mode: 'pass',
      state: nextState,
      previousState,
    });
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

  function syncSelection(players = []) {
    if (players.length === 0) {
      selectedPlayerKey = '';
      selectedSessionId = 'all';
      return;
    }
    if (!selectedPlayerKey || !players.some((item) => item.key === selectedPlayerKey)) {
      selectedPlayerKey = players[0].key;
      selectedSessionId = 'all';
      playerInput = players[0].label;
    }
  }

  function resetDraftEvent() {
    draftEvent = blankDraftEvent();
    draftStep = 'from';
    selectedConnectionId = null;
  }

  function startDraftSession() {
    const session = createSession(playerInput);
    if (!session) {
      notice = 'Choose a player before starting a draft session.';
      return;
    }
    draftSession = session;
    draftOurGoalAtTop = defaultOurGoalAtTop;
    resetDraftEvent();
    selectedPlayerKey = session.player_key;
    selectedSessionId = 'all';
    playerInput = session.player_name;
    selectedConnectionId = null;
    notice = '';
  }

  function cancelDraftSession() {
    draftSession = null;
    resetDraftEvent();
  }

  function handlePitchPoint(pos) {
    if (!draftSession) return;
    if (draftStep === 'from') {
      draftEvent = { ...draftEvent, from: { ...pos } };
      draftStep = 'to';
      return;
    }
    if (draftStep === 'to') {
      draftEvent = { ...draftEvent, to: { ...pos } };
      draftStep = 'type';
    }
  }

  function addDraftEvent() {
    if (!draftSession) return;
    if (!Number.isFinite(draftEvent.from.x) || !Number.isFinite(draftEvent.to.x)) {
      notice = 'Tap both pass points first.';
      return;
    }
    const timestamp = nowIso();
    const event = {
      id: crypto.randomUUID(),
      from_x: Math.round(draftEvent.from.x * 100) / 100,
      from_y: Math.round(draftEvent.from.y * 100) / 100,
      to_x: Math.round(draftEvent.to.x * 100) / 100,
      to_y: Math.round(draftEvent.to.y * 100) / 100,
      pass_type: draftEvent.pass_type,
      completed: draftEvent.completed,
      created_at: timestamp,
    };
    draftSession = {
      ...draftSession,
      updated_at: timestamp,
      events: [...draftSession.events, event],
    };
    resetDraftEvent();
    selectedConnectionId = null;
    notice = '';
  }

  function clearCurrentDraftPoint() {
    if (!draftSession) return;
    if (draftStep === 'type') {
      draftEvent = { ...draftEvent, to: point() };
      draftStep = 'to';
      return;
    }
    if (draftStep === 'to') {
      draftEvent = { ...draftEvent, from: point() };
      draftStep = 'from';
    }
  }

  function undoLastDraftEvent() {
    if (!draftSession || draftSession.events.length === 0) {
      notice = 'No draft pass to undo.';
      return;
    }
    draftSession = {
      ...draftSession,
      updated_at: nowIso(),
      events: draftSession.events.slice(0, -1),
    };
    selectedConnectionId = null;
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
    const nextState = deleteAnalysisSession(analysisState, 'pass', session.id);
    saveState(nextState);
    if (selectedSessionId === session.id) selectedSessionId = 'all';
    if (draftSession?.id === session.id) draftSession = null;
    notice = 'Session deleted.';
  }

  function selectPlayer(player) {
    selectedPlayerKey = player.key;
    selectedSessionId = 'all';
    playerInput = player.label;
    selectedConnectionId = null;
    mergeTargetPlayerKey = '';
  }

  function selectSession(sessionId) {
    selectedSessionId = sessionId;
    selectedConnectionId = null;
  }

  function selectConnection(connectionId) {
    selectedConnectionId = connectionId;
  }

  function currentSelectedConnection(connections = [], selectedId = null) {
    if (!selectedId) return null;
    return connections.find((connection) => connection.id === selectedId) ?? null;
  }

  function directionOf(event) {
    return movementDirection(event.from, event.to) || 'lateral';
  }

  function draftDirectionOf(event) {
    if (!draftSession) return 'lateral';
    return movementDirectionForSession(
      { x: event.from_x, y: event.from_y },
      { x: event.to_x, y: event.to_y },
      draftSession,
    ) || 'lateral';
  }

  function passDistance(event) {
    return pointDistanceMeters(event.from, event.to);
  }

  function netGain(event) {
    return depthDeltaMeters(event.from, event.to);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return '—';
    return `${Math.round(value)}%`;
  }

  function passTypeRows(events = []) {
    return PASS_TYPES.map((passType) => {
      const rows = events.filter((event) => event.pass_type === passType);
      const forward = rows.filter((event) => directionOf(event) === 'forward').length;
      const lateral = rows.filter((event) => directionOf(event) === 'lateral').length;
      const backward = rows.filter((event) => directionOf(event) === 'backward').length;
      const completed = rows.filter((event) => event.completed !== false).length;
      const completionRate = rows.length > 0 ? (100 * completed / rows.length) : null;
      return {
        label: passType,
        total: rows.length,
        forward,
        lateral,
        backward,
        completionRate,
      };
    }).filter((row) => row.total > 0 || displayedEvents.length === 0);
  }

  function draftOverlayFor(event, index) {
    return {
      id: event.id,
      x: event.from_x,
      y: event.from_y,
      outcome: event.pass_type,
      label: `Draft pass ${index + 1}: ${event.pass_type} - ${movementDirectionLabel(draftDirectionOf(event))}`,
      marker_shape: 'circle',
      marker_fill: event.completed !== false ? '#2563eb' : '#64748b',
      marker_ring: event.completed !== false ? null : 'target',
      marker_ring_color: 'rgba(255,255,255,0.95)',
      opacity: 0.34,
      draft: true,
      clickable: false,
    };
  }

  function draftConnectionFor(event, index) {
    return {
      id: event.id,
      from: { x: event.from_x, y: event.from_y },
      to: { x: event.to_x, y: event.to_y },
      color: movementDirectionColor(draftDirectionOf(event)),
      width: 1.35,
      opacity: event.completed !== false ? 0.35 : 0.28,
      dasharray: '4 3',
      arrow: true,
      draft: true,
      clickable: false,
      label: `Draft pass ${index + 1}: ${event.pass_type} - ${movementDirectionLabel(draftDirectionOf(event))}${event.completed !== false ? '' : ' - incomplete'}`,
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
    selectedConnectionId = null;
    notice = '';
  }

  function mergeSelectedPlayerNames() {
    const roster = rosterList();
    const target = roster.find((player) => squadPlayerKey(player.id) === mergeTargetPlayerKey);
    if (!target || !selectedPlayerKey) {
      notice = 'Pick the squad name to merge into first.';
      return;
    }
    const nextState = renameAnalysisPlayer(analysisState, selectedPlayerKey, target);
    saveState(nextState);
    selectedPlayerKey = squadPlayerKey(target.id);
    selectedSessionId = 'all';
    selectedConnectionId = null;
    playerInput = target.name;
    mergeTargetPlayerKey = selectedPlayerKey;
    notice = `Merged sessions into ${target.name}.`;
  }

  $: if (storageScope !== loadedScope) {
    loadScope(storageScope);
    draftSession = null;
    resetDraftEvent();
    selectedPlayerKey = '';
    selectedSessionId = 'all';
    selectedConnectionId = null;
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
    const blob = content instanceof Blob ? content : new Blob([content], { type });
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

  function exportPassCSV() {
    if (displayedEvents.length === 0) return;
    const sessionMap = new Map(displayedSessions.map((s) => [s.id, s]));
    const matchMap = new Map(matches.map((m) => [m.id, m]));
    const rows = [
      ['player', 'match', 'match_date', 'session_date', 'from_x', 'from_y', 'to_x', 'to_y', 'pass_type', 'completed', 'direction', 'net_gain_m'],
    ];
    for (const event of displayedEvents) {
      const session = sessionMap.get(event.session_id);
      const match = session ? matchMap.get(session.match_id) : null;
      const direction = movementDirection(event.from, event.to);
      const gain = depthDeltaMeters(event.from, event.to);
      rows.push([
        session?.player_name || '',
        match ? `${match.team || 'Team'} v ${match.opponent || 'Opposition'}` : (session?.match_id || ''),
        match?.match_date || '',
        session?.created_at?.slice(0, 10) || '',
        Number.isFinite(event.from.x) ? event.from.x.toFixed(3) : '',
        Number.isFinite(event.from.y) ? event.from.y.toFixed(3) : '',
        Number.isFinite(event.to.x) ? event.to.x.toFixed(3) : '',
        Number.isFinite(event.to.y) ? event.to.y.toFixed(3) : '',
        event.pass_type || '',
        event.completed !== false ? 'yes' : 'no',
        direction,
        Number.isFinite(gain) ? gain.toFixed(1) : '',
      ]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(csv, `pass-impact-${playerSlug()}.csv`, 'text/csv;charset=utf-8;');
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
      const filename = `pass-impact-${playerSlug()}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Pairc Pass Impact' });
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
  });

  $: matchSessions = sessionsForMatch(analysisState, 'pass', activeMatchId)
    .slice()
    .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));

  $: rosterPlayers = rosterList();
  $: activeRosterPlayers = activeRosterList();

  $: playerDirectory = buildPlayerDirectory(matchSessions, rosterPlayers);

  $: syncSelection(playerDirectory);

  $: selectedPlayerSessions = selectedPlayerKey
    ? sessionsForPlayer(analysisState, 'pass', selectedPlayerKey, [activeMatchId])
    : matchSessions;

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
      from: analysisPointForSession({ x: event.from_x, y: event.from_y }, session),
      to: analysisPointForSession({ x: event.to_x, y: event.to_y }, session),
    }))
  );

  $: draftEventCount = draftSession?.events?.length || 0;
  $: draftOverlays = draftSession
    ? draftSession.events.map((event, index) => draftOverlayFor(event, index))
    : [];
  $: draftConnections = draftSession
    ? draftSession.events.map((event, index) => draftConnectionFor(event, index))
    : [];

  $: playerAutocomplete = collectPlayerOptions([
    ...matchSessions,
    ...(draftSession ? [draftSession] : []),
    ...activeRosterPlayers.map((player) => player.name),
    ...playerOptions,
  ], ['player_name']);

  $: totalPasses = displayedEvents.length;
  $: completedPasses = displayedEvents.filter((event) => event.completed !== false).length;
  $: completionRate = totalPasses > 0 ? (100 * completedPasses / totalPasses) : null;
  $: progressivePasses = displayedEvents.filter((event) => directionOf(event) === 'forward').length;
  $: progressiveRate = totalPasses > 0 ? (100 * progressivePasses / totalPasses) : null;
  $: averageNetGain = averageOf(displayedEvents.map((event) => netGain(event)));
  $: pitchConnections = aggregateConnections(displayedEvents, {
    fromSelector: (event) => event.from,
    toSelector: (event) => event.to,
    directionSelector: (event) => directionOf(event),
    completionSelector: (event) => event.completed !== false,
    precision: 2,
  }).map((connection, index) => {
    const direction = connection.direction || 'lateral';
    const key = [
      connection.from.x,
      connection.from.y,
      connection.to.x,
      connection.to.y,
    ].join('|');
    return {
      id: key,
      from: connection.from,
      to: connection.to,
      count: connection.count,
      completedCount: connection.completedCount,
      incompleteCount: connection.incompleteCount,
      direction,
      color: movementDirectionColor(direction),
      width: 1.6 + Math.min(2.2, Math.max(0, connection.count - 1) * 0.45),
      opacity: connection.incompleteCount > 0 ? 0.82 : 0.74,
      dasharray: connection.incompleteCount > 0 ? '4 2' : null,
      arrow: true,
      label: `${connection.count} pass${connection.count === 1 ? '' : 'es'} - ${movementDirectionLabel(direction)}${connection.incompleteCount > 0 ? ` - ${connection.incompleteCount} incomplete` : ''}`,
      clickable: true,
      index,
    };
  });
  $: directionRows = passTypeRows(displayedEvents);
  $: selectedPlayerEntry = playerDirectory.find((player) => player.key === selectedPlayerKey) || null;
  $: selectedPlayerMismatch = selectedPlayerEntry?.source === 'legacy' ? selectedPlayerEntry : null;
  $: if (selectedPlayerMismatch && !mergeTargetPlayerKey) {
    mergeTargetPlayerKey = rosterPlayers[0] ? squadPlayerKey(rosterPlayers[0].id) : '';
  }
</script>

<section class="analysis-shell">
  <div class="heading">
    <div>
      <div class="eyebrow">Post-match</div>
      <h2>Pass Destination</h2>
      <p>Where do this player's passes travel to, and do they progress play?</p>
    </div>
    <div class="match-meta">
      <div>{titleOfMatch()}</div>
      <div>{activeMatch?.match_date || 'Completed match'}</div>
    </div>
  </div>

  {#if notice}
    <div class="notice" aria-live="polite">{notice}</div>
  {/if}

  {#if !activeMatchId}
    <div class="empty-state">
      Select a completed match to start pass analysis.
    </div>
  {:else}
    <div class="grid">
      <section class="card">
        <h3>Session Builder</h3>
        <label class="field">
          <span>Player</span>
          <input list="pass-player-options" bind:value={playerInput} placeholder="Type a player" disabled={!!draftSession} />
          <datalist id="pass-player-options">
            {#each playerAutocomplete as player (player.key)}
              <option value={player.label}></option>
            {/each}
          </datalist>
        </label>

        <div class="button-row">
          <button type="button" on:click={startDraftSession} disabled={!!draftSession || !playerInput.trim()}>Start draft session</button>
          <button type="button" on:click={cancelDraftSession} disabled={!draftSession}>Discard draft</button>
          <button type="button" on:click={() => draftOurGoalAtTop = !draftOurGoalAtTop}>
            {orientationLabel(draftOurGoalAtTop)}
          </button>
        </div>

        {#if draftSession}
          <div class="draft-box">
            <div class="draft-head">
              <div class="step">{draftStep === 'from' ? 'Tap release point' : draftStep === 'to' ? 'Tap arrival point' : 'Choose type then add draft pass'}</div>
              <div class="draft-status">
                <span class="draft-chip">Draft session</span>
                <span>{draftEventCount} pass{draftEventCount === 1 ? '' : 'es'}</span>
              </div>
            </div>
            <div class="pitch-frame">
              <Pitch
                interactive={true}
                flip={!draftSession.our_goal_at_top}
                contestType="clean"
                landing={draftSession ? draftEvent.from : point()}
                pickup={draftSession ? draftEvent.to : point()}
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
              <div><span>From</span><strong>{Number.isFinite(draftEvent.from.x) ? `${draftEvent.from.x.toFixed(2)}, ${draftEvent.from.y.toFixed(2)}` : 'Tap pitch'}</strong></div>
              <div><span>To</span><strong>{Number.isFinite(draftEvent.to.x) ? `${draftEvent.to.x.toFixed(2)}, ${draftEvent.to.y.toFixed(2)}` : 'Tap pitch'}</strong></div>
            </div>

            {#if draftSession.events.length > 0}
              <div class="draft-log" aria-label="Draft pass list">
                <div class="draft-log-head">
                  <strong>Draft passes</strong>
                  <span>{draftSession.events.length}</span>
                </div>
                <div class="draft-log-list">
                  {#each draftSession.events as event, index (event.id)}
                    <div class="draft-log-row">
                      <div class="draft-log-main">
                        <strong>{index + 1}. {event.pass_type}</strong>
                        <span>
                          {movementDirectionLabel(draftDirectionOf(event))}
                          {event.completed !== false ? ' - Completed' : ' - Incomplete'}
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
              {#each PASS_TYPES as passType (passType)}
                <button
                  type="button"
                  class:active={draftEvent.pass_type === passType}
                  on:click={() => draftEvent = { ...draftEvent, pass_type: passType }}
                >
                  {passType}
                </button>
              {/each}
            </div>

            <label class="pressure">
              <input type="checkbox" bind:checked={draftEvent.completed} />
              <span>Completed</span>
            </label>

            <div class="button-row">
              <button type="button" on:click={clearCurrentDraftPoint} disabled={!draftSession}>Clear point</button>
              <button type="button" on:click={undoLastDraftEvent} disabled={!draftSession || draftSession.events.length === 0}>Undo draft pass</button>
              <button type="button" class="primary" on:click={addDraftEvent} disabled={!draftSession}>Add draft pass</button>
              <button type="button" class="primary" on:click={saveDraftSession} disabled={!draftSession}>Finalize session</button>
            </div>
          </div>
        {:else}
          <div class="empty-state">Start a draft session to begin logging pass events.</div>
        {/if}
      </section>

      <section class="card" bind:this={analysisCardEl}>
        <div class="card-head">
          <h3>Analysis View</h3>
          <div class="card-head-right">
            <span>{totalPasses}</span>
            <div class="export-actions">
              <button type="button" on:click={exportPassCSV} disabled={totalPasses === 0} title="Download raw pass data as CSV">CSV</button>
              <button type="button" on:click={shareSnapshot} disabled={totalPasses === 0 || exportingSnapshot} title="Share or download a snapshot of this view">
                {exportingSnapshot ? '...' : 'Snapshot'}
              </button>
            </div>
          </div>
        </div>
        {#if exportFeedback}
          <div class="export-feedback">{exportFeedback}</div>
        {/if}

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
                “{selectedPlayerMismatch.label}” is not on the squad list yet. Merge these sessions into a roster player.
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
                <option value={session.id}>{sessionLabel(session, index, 'pass', 'passes')}</option>
              {/each}
            </select>
          </label>
        {/if}

        {#if totalPasses === 0}
          <div class="empty-state">No saved pass events for the current selection.</div>
        {:else}
          <div class="summary-grid">
            <div><span>Total passes</span><strong>{totalPasses}</strong></div>
            <div><span>Completion</span><strong>{formatPercent(completionRate)}</strong></div>
            <div><span>Progressive</span><strong>{formatPercent(progressiveRate)}</strong></div>
            <div><span>Avg gain</span><strong>{formatSignedMetres(averageNetGain)}</strong></div>
          </div>

          {#if totalPasses > 0 && totalPasses < 5}
            <div class="sample-note">Small sample: {totalPasses} passes. Treat these patterns cautiously.</div>
          {/if}

          <div class="direction-grid">
            <div class="direction-head">
              <span>Type</span>
              <span>Fwd</span>
              <span>Lat</span>
              <span>Back</span>
              <span>Comp</span>
            </div>
            {#each directionRows as row (row.label)}
              <div class="direction-row">
                <strong>{row.label}</strong>
                <span>{row.forward}</span>
                <span>{row.lateral}</span>
                <span>{row.backward}</span>
                <span>{formatPercent(row.completionRate)}</span>
              </div>
            {/each}
          </div>

          <div class="pitch-frame">
            <!-- Analysis points are normalized to attack right before render. -->
            <Pitch
              interactive={false}
              flip={false}
              contestType="clean"
              landing={{ x: NaN, y: NaN }}
              pickup={{ x: NaN, y: NaN }}
              overlays={[]}
              connections={pitchConnections}
              showZoneLabels={false}
              showZoneLegend={false}
              ownGoalFill="rgba(255,255,255,0.16)"
              oppositionGoalFill="rgba(255,255,255,0.05)"
              ownGoalBandStroke="rgba(255,255,255,0.95)"
              on:connectionclick={(e) => selectConnection(e.detail.connection.id)}
            />
          </div>

          {@const selectedConnection = currentSelectedConnection(pitchConnections, selectedConnectionId)}
          {#if selectedConnection}
            <div class="detail-card">
              <div class="detail-title">{selectedConnection.label}</div>
              <div class="detail-grid">
                <span>Direction</span><strong>{movementDirectionLabel(selectedConnection.direction)}</strong>
                <span>Count</span><strong>{selectedConnection.count}</strong>
                <span>Completed</span><strong>{selectedConnection.completedCount}</strong>
                <span>Incomplete</span><strong>{selectedConnection.incompleteCount}</strong>
                <span>Distance</span><strong>{formatMetres(pointDistanceMeters(selectedConnection.from, selectedConnection.to))}</strong>
                <span>Net gain</span><strong>{formatSignedMetres(depthDeltaMeters(selectedConnection.from, selectedConnection.to))}</strong>
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
                <span>{session.events.length} passes - {session.our_goal_at_top ? 'Our goal left' : 'Our goal right'} - {session.created_at.slice(0, 10)}</span>
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
  .draft-row-remove { border-color: #fecaca; color: #b91c1c; padding: 6px 10px; border-radius: 999px; font-size: 11px; }
  .outcomes { display: flex; flex-wrap: wrap; gap: 6px; }
  .outcomes button { border-radius: 999px; padding: 7px 10px; font-size: 12px; }
  .outcomes button.active { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .pressure { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; text-transform: none; letter-spacing: 0; }
  .pressure input { width: 16px; height: 16px; accent-color: #1c3f8a; }
  .player-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .player-strip button { display: inline-flex; gap: 8px; align-items: center; border-radius: 999px; background: #f8fafc; }
  .player-strip button.selected { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
  .player-strip span { opacity: 0.7; font-size: 11px; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
  .summary-grid div { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
  .summary-grid span { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }
  .summary-grid strong { font-size: 18px; font-weight: 900; color: #111827; }
  .sample-note { margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; border: 1px dashed #d1d5db; background: #fafafa; color: #6b7280; font-size: 12px; }
  .direction-grid { display: grid; gap: 6px; margin-bottom: 12px; }
  .direction-head, .direction-row { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(4, minmax(0, 0.7fr)); gap: 8px; align-items: center; font-size: 12px; }
  .direction-head { color: #6b7280; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .direction-row { border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; }
  .direction-row strong { font-weight: 800; color: #111827; }
  .direction-row span { color: #374151; text-align: center; }
  .mismatch-note { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .mismatch-note strong { display: block; margin-bottom: 4px; }
  .mismatch-note small { display: block; margin-top: 4px; color: #6b7280; }
  .mismatch-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
  .mismatch-actions select { min-width: 180px; border: 1.5px solid #d1d5db; border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: 13px; color: #111827; background: #fff; }
  .detail-card { margin-top: 12px; background: #f8fafc; border: 1px solid #e5e7eb; padding: 12px; }
  .detail-title { font-size: 14px; font-weight: 800; margin-bottom: 10px; }
  .detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 12px; }
  .detail-grid span { color: #6b7280; font-weight: 700; }
  .detail-grid strong { color: #111827; }
  .session-list { display: grid; gap: 10px; }
  .session-row { border: 1px solid #e5e7eb; padding: 10px; display: grid; gap: 8px; }
  .session-row.selected { background: #eff6ff; border-color: #93c5fd; }
  .session-main { border: none; padding: 0; background: transparent; text-align: left; display: grid; gap: 4px; }
  .session-main strong { font-size: 13px; }
  .session-main span { font-size: 11px; color: #6b7280; }
  @media (min-width: 900px) { .grid { grid-template-columns: minmax(320px, 0.9fr) 1.1fr; } .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 640px) {
    .match-meta { text-align: left; }
    .mini-grid { grid-template-columns: 1fr; }
    .direction-head, .direction-row { grid-template-columns: minmax(0, 1.2fr) repeat(4, minmax(0, 0.45fr)); }
    .mismatch-note { flex-direction: column; }
    .mismatch-actions { width: 100%; justify-content: stretch; }
    .mismatch-actions select { width: 100%; min-width: 0; }
  }
</style>
