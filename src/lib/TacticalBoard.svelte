<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import {
    W, H, svgX, svgY,
    pointerToPitch, easeInOut,
    simplifyPitchPath, defaultPlayers, derivePositionsAtStep,
    buildStepPositionCache, interpolatePlayerPositions, playerPosition,
    clampPoint, normalizeBoardSnapshot, tacticalBoardStorageKey,
  } from './tacticalBoardUtils.js';

  export let teamName = 'Home';
  export let opponentName = 'Away';
  export let boardKey = 'training';

  const dispatch = createEventDispatcher();

  // ── State ───────────────────────────────────────────────────────────────
  let players = defaultPlayers();
  let moves = [];
  let penStrokes = [];
  let nextId = 1;
  let currentStep = 1;   // step currently being drawn into
  let playhead = 0;      // 0 = before step 1, N = after step N played
  let pitchView = 'full';
  let playbackSpeed = 1;
  let saveStatus = 'Not saved yet';
  let hydrated = false;
  let loadedBoardKey = null;

  // ── Tool ────────────────────────────────────────────────────────────────
  let tool = 'select'; // 'select' | 'pass' | 'run' | 'shot' | 'pen'

  // ── Interaction ─────────────────────────────────────────────────────────
  let svgEl;
  let draggingPlayerId = null;
  let selectedPlayerId = 'home-1';
  let passFirstPlayerId = null;   // first player tapped in pass mode
  let shotPlayerId = null;
  let runArmedPlayerId = null;    // player selected in run mode
  let rawPath = [];               // raw pitch-coord points captured during draw
  let isDrawingRun = false;
  let isDrawingPen = false;
  let penColor = '#facc15';
  let penWidth = 1.4;

  // ── Playback ─────────────────────────────────────────────────────────────
  let animating = false;
  let animatingStep = 0;
  let animStartTime = null;
  let animProgress = 0;
  let animRafId = null;
  let autoplay = false;
  let exportingSnapshot = false;
  let boardEl;
  const BASE_ANIM_DURATION = 1200;

  onMount(() => {
    loadBoard();
  });

  onDestroy(() => { if (animRafId) cancelAnimationFrame(animRafId); });

  function boardSnapshot() {
    return {
      version: 1,
      players,
      moves,
      penStrokes,
      nextId,
      currentStep,
      pitchView,
      playbackSpeed,
    };
  }

  function highestCreatedOrder(nextMoves = moves, nextPenStrokes = penStrokes) {
    const moveMax = nextMoves.length > 0 ? Math.max(...nextMoves.map((move) => Number(move.createdOrder) || 0)) : 0;
    const strokeMax = nextPenStrokes.length > 0 ? Math.max(...nextPenStrokes.map((stroke) => Number(stroke.createdOrder) || 0)) : 0;
    return Math.max(moveMax, strokeMax);
  }

  function loadBoard() {
    loadedBoardKey = boardKey || 'training';
    hydrated = false;
    if (typeof localStorage === 'undefined') {
      hydrated = true;
      return;
    }
    try {
      const raw = localStorage.getItem(tacticalBoardStorageKey(loadedBoardKey));
      if (!raw) {
        players = defaultPlayers();
        moves = [];
        penStrokes = [];
        nextId = 1;
        currentStep = 1;
        pitchView = 'full';
        playbackSpeed = 1;
        saveStatus = 'New board';
      } else {
        const snapshot = normalizeBoardSnapshot(JSON.parse(raw));
        players = snapshot.players;
        moves = snapshot.moves;
        penStrokes = snapshot.penStrokes;
        nextId = Math.max(snapshot.nextId, highestCreatedOrder(snapshot.moves, snapshot.penStrokes) + 1);
        currentStep = snapshot.currentStep;
        pitchView = snapshot.pitchView;
        playbackSpeed = snapshot.playbackSpeed;
        playhead = 0;
        saveStatus = 'Restored';
      }
    } catch {
      players = defaultPlayers();
      moves = [];
      penStrokes = [];
      nextId = 1;
      currentStep = 1;
      pitchView = 'full';
      playbackSpeed = 1;
      saveStatus = 'Could not restore';
    } finally {
      selectedPlayerId = players[0]?.id || null;
      passFirstPlayerId = null;
      shotPlayerId = null;
      runArmedPlayerId = null;
      rawPath = [];
      isDrawingRun = false;
      isDrawingPen = false;
      hydrated = true;
    }
  }

  function saveBoard() {
    if (!hydrated || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(tacticalBoardStorageKey(loadedBoardKey || boardKey || 'training'), JSON.stringify(boardSnapshot()));
      saveStatus = 'Saved';
    } catch {
      saveStatus = 'Save failed';
    }
  }

  function saveBoardForState(_players, _moves, _penStrokes, _nextId, _currentStep, _pitchView, _playbackSpeed) {
    saveBoard();
  }

  $: if (boardKey !== loadedBoardKey) {
    loadBoard();
  }

  $: if (hydrated) {
    saveBoardForState(players, moves, penStrokes, nextId, currentStep, pitchView, playbackSpeed);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  $: maxStep = moves.length > 0 ? Math.max(...moves.map(m => m.step)) : 0;
  $: canPlay = !animating && playhead < maxStep;
  $: canBack = !animating && playhead > 0;
  $: canForward = !animating && playhead < maxStep;
  $: animationDuration = BASE_ANIM_DURATION / playbackSpeed;
  $: viewBox = pitchView === 'left' ? `0 0 ${W / 2} ${H}` : pitchView === 'right' ? `${W / 2} 0 ${W / 2} ${H}` : `0 0 ${W} ${H}`;

  // Cache resolved player positions at each step boundary.
  // Reactive on players + moves. Stable during animation (no edits allowed then).
  $: stepPositionCache = buildStepPositionCache(players, moves, maxStep);

  // Animated player positions — interpolates between adjacent step cache entries.
  // When not animating, show positions relevant to the current drawing context so that
  // run paths drawn for step N start from visually correct player locations.
  $: visualPositions = (() => {
    if (!animating) {
      const displayStep = Math.max(playhead, Math.max(0, currentStep - 1));
      return stepPositionCache[displayStep] || derivePositionsAtStep(players, moves, displayStep);
    }
    const before = stepPositionCache[animatingStep - 1];
    const after  = stepPositionCache[animatingStep];
    if (!before || !after) return stepPositionCache[playhead] || {};
    return interpolatePlayerPositions(players, before, after, easeInOut(animProgress));
  })();

  // Ball dots that travel along pass and shot lines during animation.
  $: ballAnimDots = (() => {
    if (!animating) return [];
    const before = stepPositionCache[animatingStep - 1];
    if (!before) return [];
    const t = easeInOut(animProgress);
    return moves
      .filter(m => (m.type === 'pass' || m.type === 'shot') && m.step === animatingStep)
      .flatMap(m => {
        const fp = before[m.fromPlayerId || m.playerId];
        const tp = m.type === 'shot' ? m.target : before[m.toPlayerId];
        if (!fp || !tp) return [];
        return [{ id: m.id, x: fp.x + (tp.x - fp.x) * t, y: fp.y + (tp.y - fp.y) * t }];
      });
  })();

  // ── Animation loop ────────────────────────────────────────────────────────
  function startAnimation(step, continueFlow = true) {
    animating = true;
    autoplay = continueFlow;
    animatingStep = step;
    animStartTime = performance.now();
    animProgress = 0;
    animRafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    animProgress = Math.min((now - animStartTime) / animationDuration, 1);
    if (animProgress < 1) {
      animRafId = requestAnimationFrame(tick);
    } else {
      const completedStep = animatingStep;
      playhead = completedStep;
      if (autoplay && completedStep < maxStep) {
        animatingStep = completedStep + 1;
        animStartTime = now;
        animProgress = 0;
        animRafId = requestAnimationFrame(tick);
      } else {
        animating = false;
        autoplay = false;
        animProgress = 0;
        animRafId = null;
      }
    }
  }

  // ── Playback controls ─────────────────────────────────────────────────────
  function handlePlay() {
    if (!canPlay) return;
    startAnimation(playhead + 1, true);
  }

  function handlePause() {
    if (!animating) return;
    cancelAnimationFrame(animRafId);
    animRafId = null;
    animating = false;
    autoplay = false;
    playhead = animatingStep - 1; // snap to pre-step state so Play replays the same step
    animProgress = 0;
  }

  function handleBack() {
    if (animating) handlePause();
    if (playhead > 0) playhead--;
  }

  function handleReset() {
    if (animRafId) cancelAnimationFrame(animRafId);
    animRafId = null;
    animating = false;
    autoplay = false;
    animProgress = 0;
    playhead = 0;
  }

  function handleForward() {
    if (canForward) playhead++;
  }

  function handleUndo() {
    if ((moves.length === 0 && penStrokes.length === 0) || animating) return;
    const maxOrder = highestCreatedOrder();
    const removed = moves.find(m => m.createdOrder === maxOrder);
    if (!removed) {
      penStrokes = penStrokes.filter((stroke) => stroke.createdOrder !== maxOrder);
      return;
    }
    moves = moves.filter(m => m.createdOrder !== maxOrder);
    if (removed) {
      const stepIsNowEmpty = !moves.some(m => m.step === removed.step);
      if (stepIsNowEmpty && removed.step === currentStep && currentStep > 1) {
        currentStep--;
      }
      // Pull currentStep back if it's drifted beyond the new frontier
      const newMaxStep = moves.length > 0 ? Math.max(...moves.map(m => m.step)) : 0;
      if (currentStep > newMaxStep + 1) currentStep = Math.max(1, newMaxStep + 1);
      if (playhead >= removed.step) playhead = Math.max(0, removed.step - 1);
    }
  }

  function confirmAction(message) {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
    return window.confirm(message);
  }

  function handleClearMoves() {
    if (animating) return;
    if (!confirmAction('Clear all passes, runs and shots from this board? Player positions and pen marks will stay.')) return;
    handleReset();
    moves = [];
    currentStep = 1;
    passFirstPlayerId = null;
    shotPlayerId = null;
    runArmedPlayerId = null;
  }

  function handleClearInk() {
    if (animating || penStrokes.length === 0) return;
    if (!confirmAction('Clear all pen marks from this board?')) return;
    penStrokes = [];
    rawPath = [];
    isDrawingPen = false;
  }

  function handleResetFormation() {
    if (animating) return;
    if (!confirmAction('Reset the board to the default formation and clear all drawings?')) return;
    handleReset();
    players = defaultPlayers();
    selectedPlayerId = players[0]?.id || null;
    moves = [];
    penStrokes = [];
    currentStep = 1;
    passFirstPlayerId = null;
    shotPlayerId = null;
    runArmedPlayerId = null;
    rawPath = [];
    isDrawingRun = false;
    isDrawingPen = false;
  }

  function advanceStep() {
    if (animating) return;
    if (!moves.some(m => m.step === currentStep)) return; // require at least one move in current step
    currentStep = Math.min(currentStep + 1, 20);
    passFirstPlayerId = null;
    shotPlayerId = null;
    runArmedPlayerId = null;
    rawPath = [];
    isDrawingRun = false;
    isDrawingPen = false;
  }

  // ── Tool switching ────────────────────────────────────────────────────────
  function switchTool(t) {
    if (animating) return;
    tool = t;
    passFirstPlayerId = null;
    shotPlayerId = null;
    runArmedPlayerId = null;
    rawPath = [];
    isDrawingRun = false;
    isDrawingPen = false;
  }

  // ── Pointer handling ──────────────────────────────────────────────────────
  // Identify nearest player within HIT_RADIUS SVG units of the pointer.
  const HIT_RADIUS = 9;

  function nearestPlayer(event) {
    const pt = pointerToPitch(event, svgEl);
    if (!pt) return null;
    let best = null, bestDist = Infinity;
    for (const p of players) {
      const pos = playerPosition(visualPositions, p);
      const dx = (pos.y - pt.y) * W;
      const dy = (pos.x - pt.x) * H;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return bestDist <= HIT_RADIUS ? best : null;
  }

  function onPointerDown(event) {
    if (animating) return;
    event.preventDefault();
    svgEl.setPointerCapture(event.pointerId);
    const pt = pointerToPitch(event, svgEl);
    if (!pt) return;

    if (tool === 'select') {
      const p = nearestPlayer(event);
      if (p) {
        selectedPlayerId = p.id;
        draggingPlayerId = p.id;
      }

    } else if (tool === 'pass') {
      const p = nearestPlayer(event);
      if (!p) return;
      selectedPlayerId = p.id;
      if (!passFirstPlayerId) {
        passFirstPlayerId = p.id;
      } else if (p.id === passFirstPlayerId) {
        passFirstPlayerId = null;
      } else {
        const fromTeam = players.find(pl => pl.id === passFirstPlayerId)?.team || 'home';
        moves = [...moves, {
          id: `m${nextId}`,
          type: 'pass',
          team: fromTeam,
          fromPlayerId: passFirstPlayerId,
          toPlayerId: p.id,
          step: currentStep,
          createdOrder: nextId++,
        }];
        passFirstPlayerId = null;
      }

    } else if (tool === 'shot') {
      const p = nearestPlayer(event);
      if (p && !shotPlayerId) {
        selectedPlayerId = p.id;
        shotPlayerId = p.id;
      } else if (p && p.id === shotPlayerId) {
        shotPlayerId = null;
      } else if (shotPlayerId) {
        const shooterTeam = players.find(pl => pl.id === shotPlayerId)?.team || 'home';
        moves = [...moves, {
          id: `m${nextId}`,
          type: 'shot',
          team: shooterTeam,
          playerId: shotPlayerId,
          target: pt,
          step: currentStep,
          createdOrder: nextId++,
        }];
        shotPlayerId = null;
      }

    } else if (tool === 'run') {
      const p = nearestPlayer(event);
      if (p) {
        selectedPlayerId = p.id;
        runArmedPlayerId = p.id;
        rawPath = [];
        isDrawingRun = false;
      } else if (runArmedPlayerId && !isDrawingRun) {
        const startPositions = stepPositionCache[Math.max(0, currentStep - 1)] || {};
        const startPos = startPositions[runArmedPlayerId] || { x: 0.5, y: 0.5 };
        isDrawingRun = true;
        rawPath = [startPos, pt];
      }
    } else if (tool === 'pen') {
      isDrawingPen = true;
      rawPath = [pt];
    }
  }

  function onPointerMove(event) {
    if (animating || !event.buttons) return;
    event.preventDefault();
    const pt = pointerToPitch(event, svgEl);
    if (!pt) return;

    if (tool === 'select' && draggingPlayerId) {
      players = players.map(p =>
        p.id === draggingPlayerId ? { ...p, baseX: pt.x, baseY: pt.y } : p
      );
    } else if (tool === 'run' && isDrawingRun && runArmedPlayerId) {
      rawPath = [...rawPath, pt];
    } else if (tool === 'pen' && isDrawingPen) {
      rawPath = [...rawPath, pt];
    }
  }

  function onPointerUp(event) {
    if (tool === 'select') {
      draggingPlayerId = null;
    } else if (tool === 'run' && isDrawingRun && runArmedPlayerId) {
      isDrawingRun = false;
      if (rawPath.length >= 3) {
        const path = simplifyPitchPath(rawPath);
        if (path.length >= 2) {
          const armedTeam = players.find(p => p.id === runArmedPlayerId)?.team || 'home';
          moves = [...moves, {
            id: `m${nextId}`,
            type: 'run',
            team: armedTeam,
            playerId: runArmedPlayerId,
            path,
            step: currentStep,
            createdOrder: nextId++,
          }];
        }
      }
      rawPath = [];
    } else if (tool === 'pen' && isDrawingPen) {
      isDrawingPen = false;
      if (rawPath.length >= 2) {
        const path = simplifyPitchPath(rawPath, 1.2, 80);
        if (path.length >= 2) {
          penStrokes = [...penStrokes, {
            id: `p${nextId}`,
            color: penColor,
            width: penWidth,
            path,
            createdOrder: nextId++,
          }];
        }
      }
      rawPath = [];
    }
  }

  function cycleSelectedPlayer(direction = 1) {
    if (players.length === 0) return;
    const currentIndex = players.findIndex((player) => player.id === selectedPlayerId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (baseIndex + direction + players.length) % players.length;
    selectedPlayerId = players[nextIndex].id;
  }

  function nudgeSelectedPlayer(dx, dy) {
    if (!selectedPlayerId) selectedPlayerId = players[0]?.id || null;
    if (!selectedPlayerId) return;
    players = players.map((player) => {
      if (player.id !== selectedPlayerId) return player;
      const next = clampPoint({ x: player.baseX + dx, y: player.baseY + dy });
      return { ...player, baseX: next.x, baseY: next.y };
    });
  }

  function onBoardKeyDown(event) {
    if (animating || event.key === 'Tab') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      passFirstPlayerId = null;
      shotPlayerId = null;
      runArmedPlayerId = null;
      rawPath = [];
      isDrawingRun = false;
      isDrawingPen = false;
      return;
    }
    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      cycleSelectedPlayer(event.key === ']' ? 1 : -1);
      return;
    }
    if (tool !== 'select') return;

    const step = event.shiftKey ? 0.035 : 0.012;
    const deltas = {
      ArrowUp: { dx: -step, dy: 0 },
      ArrowDown: { dx: step, dy: 0 },
      ArrowLeft: { dx: 0, dy: -step },
      ArrowRight: { dx: 0, dy: step },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    nudgeSelectedPlayer(delta.dx, delta.dy);
  }

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const HOME_COLOR = '#c41230';
  const AWAY_COLOR = '#f1f5f9';
  const PEN_COLORS = [
    { label: 'Yellow', value: '#facc15' },
    { label: 'Blue', value: '#60a5fa' },
    { label: 'Red', value: '#ef4444' },
    { label: 'White', value: '#ffffff' },
  ];
  const SPEED_OPTIONS = [0.5, 1, 2];
  const PITCH_VIEWS = [
    { value: 'full', label: 'Full' },
    { value: 'left', label: 'Left half' },
    { value: 'right', label: 'Right half' },
  ];

  function teamColor(team) { return team === 'home' ? HOME_COLOR : AWAY_COLOR; }
  function teamTextColor(team) { return team === 'home' ? '#fff' : '#111'; }

  function moveOpacity(m) {
    if (m.step <= playhead) return 0.85;
    if (m.step === currentStep || m.step === animatingStep) return 0.78;
    return 0.28;
  }

  function arrowHead(x1, y1, x2, y2, size = 2.6) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const bx = x2 - Math.cos(angle) * size;
    const by = y2 - Math.sin(angle) * size;
    const px = Math.cos(angle + Math.PI / 2) * (size * 0.45);
    const py = Math.sin(angle + Math.PI / 2) * (size * 0.45);
    return `${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`;
  }

  // Convert a pitch-coord path to an SVG polyline points string
  function toSvgPoints(pitchPts) {
    return pitchPts.map(p => `${svgX(p).toFixed(2)},${svgY(p).toFixed(2)}`).join(' ');
  }

  function toolStatusText() {
    if (exportingSnapshot) return 'Exporting board image...';
    if (tool === 'pass' && passFirstPlayerId) return 'Pass: tap the receiving player.';
    if (tool === 'pass') return 'Pass: tap the passing player, then the receiver.';
    if (tool === 'shot' && shotPlayerId) return 'Shot: tap the target area or goal.';
    if (tool === 'shot') return 'Shot: tap the shooter, then tap the target.';
    if (tool === 'run' && runArmedPlayerId && isDrawingRun) return 'Run: release to save the path.';
    if (tool === 'run' && runArmedPlayerId) return 'Run: drag on the pitch to draw the movement.';
    if (tool === 'run') return 'Run: tap a player, then draw the run.';
    if (tool === 'pen') return 'Pen: draw directly on the pitch.';
    return `Select: drag players to set positions - ${teamName || 'Home'} vs ${opponentName || 'Away'}.`;
  }

  function pitchViewLabel() {
    return PITCH_VIEWS.find((option) => option.value === pitchView)?.label || 'Full';
  }

  function shotTargetFor(move, before = {}) {
    return move?.target || before?.[move?.playerId] || null;
  }

  async function exportSnapshot() {
    if (exportingSnapshot || !boardEl) return;
    exportingSnapshot = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(boardEl, { backgroundColor: '#0f1923', scale: 2, useCORS: true });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `tactical-board-${stamp}.png`;
      a.click();
      saveStatus = 'Exported PNG';
    } catch {
      saveStatus = 'Export failed';
    } finally {
      exportingSnapshot = false;
    }
  }

  // Shorten a line segment by 'amount' SVG units from each end (to clear player circles)
  function shortenLine(x1, y1, x2, y2, amount) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len <= amount * 2) return { x1, y1, x2, y2 };
    const ratio = amount / len;
    return {
      x1: x1 + (x2 - x1) * ratio,
      y1: y1 + (y2 - y1) * ratio,
      x2: x2 - (x2 - x1) * ratio,
      y2: y2 - (y2 - y1) * ratio,
    };
  }

  // Pitch geometry constants (matching Pitch.svelte)
  const cy = H / 2;
  const L13 = 13, L20 = 20, L45 = 45, L65 = 65;
  const SMALL_W = 14, SMALL_D = 4.5;
  const R_D = 13, R_40 = 40;
</script>

<div class="tb-overlay" bind:this={boardEl}>
  <!-- Toolbar -->
  <div class="tb-toolbar">
    <div class="tb-section">
      <span class="tb-section-label">Tools</span>
      <div class="tb-btn-group">
        <button class="tb-btn" class:active={tool === 'select'} on:click={() => switchTool('select')} disabled={animating}>Select</button>
        <button class="tb-btn" class:active={tool === 'pass'} on:click={() => switchTool('pass')} disabled={animating}>Pass</button>
        <button class="tb-btn" class:active={tool === 'run'} on:click={() => switchTool('run')} disabled={animating}>Run</button>
        <button class="tb-btn" class:active={tool === 'shot'} on:click={() => switchTool('shot')} disabled={animating}>Shot</button>
        <button class="tb-btn" class:active={tool === 'pen'} on:click={() => switchTool('pen')} disabled={animating}>Pen</button>
      </div>
    </div>

    <div class="tb-section">
      <span class="tb-section-label">Pen</span>
      <div class="tb-btn-group">
        {#each PEN_COLORS as color (color.value)}
          <button
            type="button"
            class="tb-color-btn"
            class:active={penColor === color.value}
            style={`--pen-color:${color.value}`}
            aria-label={`Use ${color.label} pen`}
            on:click={() => penColor = color.value}
            disabled={animating}
          ></button>
        {/each}
        <button class="tb-btn" on:click={handleClearInk} disabled={penStrokes.length === 0 || animating}>Clear ink</button>
      </div>
    </div>

    <div class="tb-section tb-playback">
      <span class="tb-section-label">Playback</span>
      <div class="tb-btn-group">
        <button class="tb-btn" on:click={handleBack} disabled={!canBack}>Back</button>
        <button class="tb-btn tb-play" on:click={animating ? handlePause : handlePlay} disabled={!animating && !canPlay}>
          {animating ? 'Pause' : 'Play'}
        </button>
        <button class="tb-btn" on:click={handleForward} disabled={!canForward}>Forward</button>
        <button class="tb-btn" on:click={handleReset} disabled={!animating && playhead === 0}>Reset</button>
      </div>
      <span class="tb-step-info">
        {#if animating}
          {animatingStep}/{maxStep}
        {:else}
          {playhead}/{maxStep}
        {/if}
      </span>
      <div class="tb-speed-group" aria-label="Playback speed">
        {#each SPEED_OPTIONS as speed (speed)}
          <button
            type="button"
            class="tb-speed-btn"
            class:active={playbackSpeed === speed}
            on:click={() => playbackSpeed = speed}
            disabled={animating}
          >{speed}x</button>
        {/each}
      </div>
    </div>

    <div class="tb-section tb-step-draw">
      <span class="tb-section-label">Step {currentStep}</span>
      <button class="tb-btn" on:click={advanceStep} disabled={animating || !moves.some(m => m.step === currentStep)} title="Start drawing the next step">Next Step</button>
    </div>

    <div class="tb-section">
      <span class="tb-section-label">View</span>
      <div class="tb-speed-group" aria-label="Pitch view">
        {#each PITCH_VIEWS as option (option.value)}
          <button
            type="button"
            class="tb-speed-btn"
            class:active={pitchView === option.value}
            on:click={() => pitchView = option.value}
            disabled={animating}
          >{option.label}</button>
        {/each}
      </div>
    </div>

    <div class="tb-section tb-manage">
      <span class="tb-section-label">Actions</span>
      <div class="tb-btn-group">
        <button class="tb-btn" on:click={handleUndo} disabled={(moves.length === 0 && penStrokes.length === 0) || animating}>Undo</button>
        <button class="tb-btn" on:click={handleClearMoves} disabled={moves.length === 0 || animating}>Clear moves</button>
        <button class="tb-btn tb-reset-btn" on:click={handleResetFormation} disabled={animating}>Reset</button>
        <button class="tb-btn" on:click={exportSnapshot} disabled={exportingSnapshot}>PNG</button>
        <button class="tb-btn tb-done" on:click={() => dispatch('close')}>Close Board</button>
      </div>
    </div>
  </div>

  <!-- Status hint -->
  <div class="tb-hint">
    <strong>{toolStatusText()}</strong>
    <span>{saveStatus} - View: {pitchViewLabel()}</span>
  </div>

  <!-- Pitch -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (custom SVG board exposes keyboard controls) -->
  <div
    class="tb-pitch-wrap"
    role="application"
    tabindex="0"
    aria-label="Tactical board. In select mode, bracket keys choose a player and arrow keys move them."
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerUp}
    on:keydown={onBoardKeyDown}
  >
    <svg
      bind:this={svgEl}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="tb-field-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
        <clipPath id="tb-ld-clip" clipPathUnits="userSpaceOnUse">
          <rect x={L20} y="0" width={W - L20} height={H} />
        </clipPath>
        <clipPath id="tb-rd-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width={W - L20} height={H} />
        </clipPath>
      </defs>

      <!-- ── Pitch geometry ─────────────────────────────────────────── -->
      <rect x="0" y="0" width={W} height={H} fill="#3d7642" />
      <rect x="0"     y="0" width={W / 2} height={H} fill="rgba(0,0,0,0.04)" />
      <rect x={W*3/4} y="0" width={W / 4} height={H} fill="rgba(0,0,0,0.025)" />
      <rect x="0"     y="0" width={W / 4} height={H} fill="rgba(0,0,0,0.025)" />

      <rect x="0.5" y="0.5" width={W - 1} height={H - 1}
        fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.2"
        vector-effect="non-scaling-stroke" />

      <line x1={W/2} y1="0" x2={W/2} y2={H}
        stroke="rgba(255,255,255,0.88)" stroke-width="1.1"
        vector-effect="non-scaling-stroke" />

      {#each [L13, L20, L45, L65] as d (d)}
        {@const op = d === L65 ? 0.62 : d === L13 ? 0.52 : 0.72}
        <line x1={d}   y1="0" x2={d}   y2={H} stroke={`rgba(255,255,255,${op})`} stroke-width="0.9" vector-effect="non-scaling-stroke" />
        <line x1={W-d} y1="0" x2={W-d} y2={H} stroke={`rgba(255,255,255,${op})`} stroke-width="0.9" vector-effect="non-scaling-stroke" />
      {/each}

      <!-- Goals -->
      <rect x="0"       y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
        fill="rgba(196,18,48,0.35)" stroke="rgba(255,255,255,0.88)" stroke-width="1.0" vector-effect="non-scaling-stroke" />
      <rect x={W - SMALL_D} y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
        fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.88)" stroke-width="1.0" vector-effect="non-scaling-stroke" />
      <line x1="0" y1={cy - SMALL_W/2} x2="0" y2={cy + SMALL_W/2}
        stroke="#c41230" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <line x1={W} y1={cy - SMALL_W/2} x2={W} y2={cy + SMALL_W/2}
        stroke="#1c3f8a" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke" />

      <!-- 40m arcs -->
      <g clip-path="url(#tb-field-clip)">
        <circle cx="0"  cy={cy} r={R_40} fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.0" vector-effect="non-scaling-stroke" />
        <circle cx={W} cy={cy} r={R_40} fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.0" vector-effect="non-scaling-stroke" />
      </g>

      <!-- D arcs -->
      <g clip-path="url(#tb-ld-clip)">
        <circle cx={L20}     cy={cy} r={R_D} fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.1" vector-effect="non-scaling-stroke" />
      </g>
      <g clip-path="url(#tb-rd-clip)">
        <circle cx={W - L20} cy={cy} r={R_D} fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.1" vector-effect="non-scaling-stroke" />
      </g>

      <!-- Team labels -->
      <text x="6" y="5.5" font-size="4" font-weight="700" fill="rgba(255,255,255,0.55)" pointer-events="none" style="user-select:none">
        {teamName || 'Home'}
      </text>
      <text x={W - 6} y="5.5" font-size="4" font-weight="700" fill="rgba(255,255,255,0.55)" text-anchor="end" pointer-events="none" style="user-select:none">
        {opponentName || 'Away'}
      </text>

      <!-- ── Moves layer ──────────────────────────────────────────────── -->

      <!-- Pen marks -->
      {#each penStrokes as stroke (stroke.id)}
        <polyline
          points={toSvgPoints(stroke.path)}
          fill="none"
          stroke={stroke.color}
          stroke-width={stroke.width}
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
          vector-effect="non-scaling-stroke"
        />
      {/each}
      {#if isDrawingPen && rawPath.length >= 2}
        <polyline
          points={toSvgPoints(rawPath)}
          fill="none"
          stroke={penColor}
          stroke-width={penWidth}
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
          vector-effect="non-scaling-stroke"
        />
      {/if}

      <!-- Run paths (dashed lines with arrowhead at endpoint) -->
      {#each moves.filter(m => m.type === 'run') as m (m.id)}
        {@const color = teamColor(m.team)}
        {@const op = moveOpacity(m)}
        {@const pts = toSvgPoints(m.path)}
        {@const last = m.path[m.path.length - 1]}
        {@const prev = m.path[m.path.length - 2] || m.path[0]}
        {@const runArrow = arrowHead(svgX(prev), svgY(prev), svgX(last), svgY(last))}
        <polyline points={pts} fill="none" stroke={color} stroke-width="1.8"
          stroke-dasharray="3.5 2" stroke-linecap="round"
          opacity={op} vector-effect="non-scaling-stroke" />
        <polygon points={runArrow} fill={color} opacity={op} />
      {/each}

      <!-- Pass arrows (dashed line with arrowhead, shortened to clear player circles) -->
      {#each moves.filter(m => m.type === 'pass') as m (m.id)}
        {@const before = stepPositionCache[m.step - 1] || stepPositionCache[0] || {}}
        {@const fp = before[m.fromPlayerId]}
        {@const tp = before[m.toPlayerId]}
        {#if fp && tp}
          {@const color = teamColor(m.team)}
          {@const op = moveOpacity(m)}
          {@const seg = shortenLine(svgX(fp), svgY(fp), svgX(tp), svgY(tp), 5)}
          <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={color} stroke-width="1.8" stroke-dasharray="4 2.5"
            stroke-linecap="round" opacity={op} vector-effect="non-scaling-stroke" />
          <polygon points={arrowHead(seg.x1, seg.y1, seg.x2, seg.y2)} fill={color} opacity={op} />
        {/if}
      {/each}

      <!-- Shot arrows -->
      {#each moves.filter(m => m.type === 'shot') as m (m.id)}
        {@const before = stepPositionCache[m.step - 1] || stepPositionCache[0] || {}}
        {@const from = before[m.playerId]}
        {@const target = shotTargetFor(m, before)}
        {#if from && target}
          {@const op = moveOpacity(m)}
          {@const seg = shortenLine(svgX(from), svgY(from), svgX(target), svgY(target), 4)}
          <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke="#f59e0b" stroke-width="2.1" stroke-linecap="round"
            opacity={op} vector-effect="non-scaling-stroke" />
          <polygon points={arrowHead(seg.x1, seg.y1, seg.x2, seg.y2, 3.1)} fill="#f59e0b" opacity={op} />
        {/if}
      {/each}

      <!-- Ball dots travelling along pass and shot lines during animation -->
      {#each ballAnimDots as dot (dot.id)}
        <circle cx={svgX(dot)} cy={svgY(dot)} r="2.2"
          fill="white" stroke="rgba(0,0,0,0.5)" stroke-width="0.6"
          vector-effect="non-scaling-stroke" />
      {/each}

      <!-- ── Players ───────────────────────────────────────────────────── -->
      {#each players as p (p.id)}
        {@const pos = playerPosition(visualPositions, p)}
        {@const cx = svgX(pos)}
        {@const cy2 = svgY(pos)}
        {@const isHome = p.team === 'home'}
        {@const highlighted = selectedPlayerId === p.id || runArmedPlayerId === p.id || passFirstPlayerId === p.id || shotPlayerId === p.id || draggingPlayerId === p.id}
        {#if highlighted}
          <circle
            cx={cx} cy={cy2} r="4.35"
            fill="none"
            stroke="#fbbf24"
            stroke-width="1.05"
            vector-effect="non-scaling-stroke"
          />
        {/if}
        <circle
          cx={cx} cy={cy2} r="3.75"
          fill={isHome ? HOME_COLOR : AWAY_COLOR}
          stroke={isHome ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.6)'}
          stroke-width="0.7"
          vector-effect="non-scaling-stroke"
        />
        <text
          x={cx} y={cy2}
          text-anchor="middle" dominant-baseline="central"
          font-size="2.95" font-weight="800"
          fill={teamTextColor(p.team)}
          pointer-events="none"
          style="user-select:none"
        >{p.number}</text>
      {/each}

      <!-- ── Live run-draw preview ──────────────────────────────────────── -->
      {#if isDrawingRun && rawPath.length >= 2}
        <polyline
          points={toSvgPoints(rawPath)}
          fill="none" stroke="rgba(251,191,36,0.75)" stroke-width="1.8"
          stroke-dasharray="3 2" stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
      {/if}
    </svg>
  </div>
</div>

<style>
  .tb-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: #0f1923;
    display: flex;
    flex-direction: column;
    touch-action: none;
  }

  .tb-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 10px;
    background: #0f1923;
    border-bottom: 2px solid #c41230;
    flex-wrap: wrap;
  }

  .tb-section {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
  }

  .tb-section + .tb-section {
    padding-left: 8px;
    border-left: 1px solid rgba(255,255,255,0.15);
  }

  .tb-section-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .tb-btn-group,
  .tb-speed-group {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tb-btn {
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.85);
    cursor: pointer;
    white-space: nowrap;
    min-height: 32px;
    transition: background 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .tb-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tb-btn.active {
    background: #c41230;
    border-color: #c41230;
    color: #fff;
  }

  .tb-btn:not(:disabled):not(.active):active {
    background: rgba(255,255,255,0.16);
  }

  .tb-play {
    background: #1c3f8a;
    border-color: #1c3f8a;
    color: #fff;
    min-width: 64px;
  }

  .tb-play:not(:disabled):active {
    background: #1a3577;
  }

  .tb-done {
    background: #4ade80;
    border-color: #4ade80;
    color: #052e16;
    font-weight: 800;
  }

  .tb-reset-btn {
    color: rgba(255,180,0,0.9);
    border-color: rgba(255,180,0,0.35);
  }

  .tb-step-info {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    min-width: 44px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .tb-speed-btn {
    min-height: 28px;
    padding: 5px 8px;
    border: 1px solid rgba(255,255,255,0.16);
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.78);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .tb-speed-btn.active {
    background: rgba(250,204,21,0.18);
    border-color: rgba(250,204,21,0.6);
    color: #fde68a;
  }

  .tb-speed-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tb-color-btn {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,0.2);
    background: var(--pen-color);
    cursor: pointer;
    box-shadow: inset 0 0 0 2px rgba(15,25,35,0.45);
  }

  .tb-color-btn.active {
    border-color: #fff;
  }

  .tb-color-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tb-hint {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    color: rgba(255,255,255,0.66);
    padding: 6px 12px;
    background: #0c141c;
    min-height: 30px;
  }

  .tb-hint strong {
    color: rgba(255,255,255,0.92);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tb-hint span {
    flex-shrink: 0;
    color: rgba(255,255,255,0.5);
    font-size: 12px;
  }

  .tb-pitch-wrap {
    flex: 1;
    display: flex;
    min-height: 0;
    padding: 6px;
  }

  .tb-pitch-wrap:focus {
    outline: 3px solid rgba(250,204,21,0.7);
    outline-offset: -3px;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    user-select: none;
    cursor: default;
  }

  @media (max-width: 760px) {
    .tb-toolbar {
      max-height: 37svh;
      overflow-y: auto;
    }

    .tb-section {
      width: 100%;
      justify-content: flex-start;
    }

    .tb-section + .tb-section {
      padding-left: 0;
      border-left: 0;
    }

    .tb-hint {
      align-items: flex-start;
      flex-direction: column;
      gap: 2px;
    }
  }

</style>
