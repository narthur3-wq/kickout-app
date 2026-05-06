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
  let homeColor = '#c81f32';
  let awayColor = '#f2c94c';
  let markerSize = 'standard';
  let showTeamLabels = false;
  let saveStatus = 'Not saved yet';
  let hydrated = false;
  let loadedBoardKey = null;
  let settingsOpen = false;

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
  let penWidth = 2.2;

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
      homeColor,
      awayColor,
      markerSize,
      showTeamLabels,
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
        homeColor = DEFAULT_HOME_COLOR;
        awayColor = DEFAULT_AWAY_COLOR;
        markerSize = 'standard';
        showTeamLabels = false;
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
        homeColor = snapshot.homeColor;
        awayColor = snapshot.awayColor;
        markerSize = snapshot.markerSize;
        showTeamLabels = snapshot.showTeamLabels;
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
      homeColor = DEFAULT_HOME_COLOR;
      awayColor = DEFAULT_AWAY_COLOR;
      markerSize = 'standard';
      showTeamLabels = false;
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

  function saveBoardForState(
    _players,
    _moves,
    _penStrokes,
    _nextId,
    _currentStep,
    _pitchView,
    _playbackSpeed,
    _homeColor,
    _awayColor,
    _markerSize,
    _showTeamLabels,
  ) {
    saveBoard();
  }

  $: if (boardKey !== loadedBoardKey) {
    loadBoard();
  }

  $: if (hydrated) {
    saveBoardForState(players, moves, penStrokes, nextId, currentStep, pitchView, playbackSpeed, homeColor, awayColor, markerSize, showTeamLabels);
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
  const DEFAULT_HOME_COLOR = '#c81f32';
  const DEFAULT_AWAY_COLOR = '#f2c94c';
  const PASS_COLOR = '#38a3ff';
  const RUN_COLOR = '#f8fafc';
  const SHOT_COLOR = '#f59e0b';
  const PEN_COLORS = [
    { label: 'Yellow', value: '#facc15' },
    { label: 'Blue', value: '#60a5fa' },
    { label: 'Red', value: '#ef4444' },
    { label: 'White', value: '#ffffff' },
  ];
  const TEAM_COLORS = [
    { label: 'Red', value: '#c81f32' },
    { label: 'Yellow', value: '#f2c94c' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Green', value: '#16a34a' },
    { label: 'Black', value: '#111827' },
    { label: 'White', value: '#f8fafc' },
  ];
  const MARKER_SIZES = {
    compact: { label: 'Compact', radius: 2.82, selectedRadius: 3.42, font: 2.22 },
    standard: { label: 'Standard', radius: 3.02, selectedRadius: 3.62, font: 2.36 },
  };
  const SPEED_OPTIONS = [0.5, 1, 2];
  const PITCH_VIEWS = [
    { value: 'full', label: 'Full' },
    { value: 'left', label: 'Left half' },
    { value: 'right', label: 'Right half' },
  ];
  const TOOL_OPTIONS = [
    { value: 'select', label: 'Select' },
    { value: 'pass', label: 'Pass' },
    { value: 'run', label: 'Run' },
    { value: 'shot', label: 'Shot' },
    { value: 'pen', label: 'Pen' },
  ];

  $: markerMetrics = MARKER_SIZES[markerSize] || MARKER_SIZES.standard;

  function colorForTeam(team) {
    return team === 'home' ? homeColor : awayColor;
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { r: 200, g: 31, b: 50 };
    const value = Number.parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function mixHex(hex, mix = '#ffffff', amount = 0.2) {
    const a = hexToRgb(hex);
    const b = hexToRgb(mix);
    const channel = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
    return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`;
  }

  function contrastText(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.58 ? '#101510' : '#ffffff';
  }

  function tokenHighlightColor(team) {
    return mixHex(colorForTeam(team), '#ffffff', 0.24);
  }

  function tokenBorderColor(team) {
    return mixHex(colorForTeam(team), '#07120c', 0.42);
  }

  function teamTextColor(team) {
    return contrastText(colorForTeam(team));
  }

  function setTeamColor(team, color) {
    if (team === 'home') {
      homeColor = color;
    } else {
      awayColor = color;
    }
  }

  function moveStrokeOpacity(m) {
    if (m.step <= playhead) return 0.94;
    if (m.step === currentStep || m.step === animatingStep) return 0.86;
    return 0.34;
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

  function activeToolLabel() {
    return TOOL_OPTIONS.find((option) => option.value === tool)?.label || 'Select';
  }

  function shotTargetFor(move, before = {}) {
    return move?.target || before?.[move?.playerId] || null;
  }

  async function exportSnapshot() {
    if (exportingSnapshot || !boardEl) return;
    exportingSnapshot = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(boardEl, { backgroundColor: '#1b2d25', scale: 2, useCORS: true });
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
  <div class="tb-toolbar">
    <div class="tb-board-meta">
      <span>Tactical Board</span>
      <strong>{teamName || 'Home'} v {opponentName || 'Away'}</strong>
    </div>

    <div class="tb-toolbar-main">
      <div class="tb-cluster tb-tools">
        <span class="tb-section-label">Tools</span>
        <div class="tb-btn-group">
          {#each TOOL_OPTIONS as option (option.value)}
            <button
              class="tb-btn tb-tool-btn"
              class:active={tool === option.value}
              on:click={() => switchTool(option.value)}
              disabled={animating}
            >{option.label}</button>
          {/each}
          <button class="tb-btn tb-undo-btn" on:click={handleUndo} disabled={(moves.length === 0 && penStrokes.length === 0) || animating}>Undo</button>
        </div>
      </div>

      <div class="tb-cluster tb-playback">
        <span class="tb-section-label">Playback</span>
        <div class="tb-btn-group">
          <button class="tb-btn" on:click={handleBack} disabled={!canBack}>Back</button>
          <button class="tb-btn tb-play" on:click={animating ? handlePause : handlePlay} disabled={!animating && !canPlay}>
            {animating ? 'Pause' : 'Play'}
          </button>
          <button class="tb-btn" on:click={handleForward} disabled={!canForward}>Forward</button>
          <span class="tb-step-info">
            {#if animating}
              {animatingStep}/{maxStep}
            {:else}
              {playhead}/{maxStep}
            {/if}
          </span>
        </div>
      </div>

      <div class="tb-cluster tb-view">
        <span class="tb-section-label">View</span>
        <div class="tb-segmented" aria-label="Pitch view">
          {#each PITCH_VIEWS as option (option.value)}
            <button
              type="button"
              class="tb-segment-btn"
              class:active={pitchView === option.value}
              on:click={() => pitchView = option.value}
              disabled={animating}
            >{option.label}</button>
          {/each}
        </div>
      </div>
    </div>

    <div class="tb-toolbar-actions">
      <span class="tb-save-state" aria-live="polite">{saveStatus}</span>
      <button class="tb-btn tb-settings-btn" class:active={settingsOpen} on:click={() => settingsOpen = !settingsOpen}>
        Settings
      </button>
      <button class="tb-btn tb-done" on:click={() => dispatch('close')}>Close Board</button>
    </div>
  </div>

  <div class="tb-board-body" class:settings-open={settingsOpen}>
    {#if settingsOpen}
      <aside class="tb-side-panel" aria-label="Tactical board settings">
        <section class="tb-side-section">
          <h2>Board controls</h2>
        </section>

        <section class="tb-side-section">
          <h3>Team colours</h3>
          <div class="tb-team-color-grid">
            <div class="tb-team-color-row">
              <span>{teamName || 'Home'}</span>
              <div class="tb-color-row">
                {#each TEAM_COLORS as color (color.value)}
                  <button
                    type="button"
                    class="tb-color-btn"
                    class:active={homeColor === color.value}
                    style={`--swatch-color:${color.value}`}
                    aria-label={`Set ${teamName || 'home'} colour to ${color.label}`}
                    on:click={() => setTeamColor('home', color.value)}
                    disabled={animating}
                  ></button>
                {/each}
              </div>
            </div>
            <div class="tb-team-color-row">
              <span>{opponentName || 'Away'}</span>
              <div class="tb-color-row">
                {#each TEAM_COLORS as color (color.value)}
                  <button
                    type="button"
                    class="tb-color-btn"
                    class:active={awayColor === color.value}
                    style={`--swatch-color:${color.value}`}
                    aria-label={`Set ${opponentName || 'away'} colour to ${color.label}`}
                    on:click={() => setTeamColor('away', color.value)}
                    disabled={animating}
                  ></button>
                {/each}
              </div>
            </div>
          </div>
        </section>

        <section class="tb-side-section">
          <h3>Player display</h3>
          <div class="tb-segmented tb-segmented-panel" aria-label="Counter size">
            {#each Object.entries(MARKER_SIZES) as [value, option] (value)}
              <button
                type="button"
                class="tb-segment-btn"
                class:active={markerSize === value}
                on:click={() => markerSize = value}
                disabled={animating}
              >{option.label}</button>
            {/each}
          </div>
          <button
            type="button"
            class="tb-btn tb-panel-btn"
            class:active={showTeamLabels}
            on:click={() => showTeamLabels = !showTeamLabels}
            disabled={animating}
          >{showTeamLabels ? 'Hide pitch labels' : 'Show pitch labels'}</button>
        </section>

        <section class="tb-side-section">
          <h3>Pen</h3>
          <div class="tb-color-row">
            {#each PEN_COLORS as color (color.value)}
              <button
                type="button"
                class="tb-color-btn"
                class:active={penColor === color.value}
                style={`--swatch-color:${color.value}`}
                aria-label={`Use ${color.label} pen`}
                on:click={() => penColor = color.value}
                disabled={animating}
              ></button>
            {/each}
          </div>
          <button class="tb-btn tb-panel-btn" on:click={handleClearInk} disabled={penStrokes.length === 0 || animating}>Clear ink</button>
        </section>

        <section class="tb-side-section">
          <h3>Sequence</h3>
          <div class="tb-side-row">
            <span>Drawing step</span>
            <strong>{currentStep}</strong>
          </div>
          <button class="tb-btn tb-panel-btn" on:click={advanceStep} disabled={animating || !moves.some(m => m.step === currentStep)} title="Start drawing the next step">Next Step</button>
          <div class="tb-side-label">Playback speed</div>
          <div class="tb-segmented tb-segmented-panel" aria-label="Playback speed">
            {#each SPEED_OPTIONS as speed (speed)}
              <button
                type="button"
                class="tb-segment-btn"
                class:active={playbackSpeed === speed}
                on:click={() => playbackSpeed = speed}
                disabled={animating}
              >{speed}x</button>
            {/each}
          </div>
          <button class="tb-btn tb-panel-btn" on:click={handleReset} disabled={!animating && playhead === 0}>Reset playback</button>
        </section>

        <section class="tb-side-section">
          <h3>Output</h3>
          <button class="tb-btn tb-panel-btn" on:click={exportSnapshot} disabled={exportingSnapshot}>Export PNG</button>
        </section>

        <section class="tb-side-section tb-danger-section">
          <h3>Clear</h3>
          <button class="tb-btn tb-panel-btn" on:click={handleClearMoves} disabled={moves.length === 0 || animating}>Clear moves</button>
          <button class="tb-btn tb-panel-btn tb-reset-btn" on:click={handleResetFormation} disabled={animating}>Reset formation</button>
        </section>
      </aside>
    {/if}

    <!-- Pitch -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (custom SVG board exposes keyboard controls) -->
    <div
      class="tb-pitch-wrap"
      class:tb-tool-select={tool === 'select'}
      class:tb-tool-draw={tool === 'run' || tool === 'pen'}
      class:tb-tool-target={tool === 'pass' || tool === 'shot'}
      role="application"
      tabindex="0"
      aria-label="Tactical board. In select mode, bracket keys choose a player and arrow keys move them."
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerUp}
      on:keydown={onBoardKeyDown}
    >
    <div class="tb-inline-hint">
      <span>{activeToolLabel()}</span>
      <strong>{toolStatusText()}</strong>
    </div>
    <div class="tb-canvas-state" aria-live="polite">
      <span>View: {pitchViewLabel()}</span>
      <span>
        {#if animating}
          Step {animatingStep}/{maxStep}
        {:else}
          Step {playhead}/{maxStep}
        {/if}
      </span>
    </div>
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
        <linearGradient id="tb-pitch-surface" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#517d4e" />
          <stop offset="100%" stop-color="#436f43" />
        </linearGradient>
        <radialGradient id="tb-home-token" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stop-color={tokenHighlightColor('home')} />
          <stop offset="100%" stop-color={homeColor} />
        </radialGradient>
        <radialGradient id="tb-away-token" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stop-color={tokenHighlightColor('away')} />
          <stop offset="100%" stop-color={awayColor} />
        </radialGradient>
        <filter id="tb-token-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0.18" dy="0.36" stdDeviation="0.42" flood-color="#102016" flood-opacity="0.36" />
        </filter>
      </defs>

      <!-- ── Pitch geometry ─────────────────────────────────────────── -->
      <rect x="0" y="0" width={W} height={H} fill="url(#tb-pitch-surface)" />
      <rect x="0" y="0" width={W} height={H} fill="rgba(17,50,30,0.08)" />

      <rect x="0.5" y="0.5" width={W - 1} height={H - 1}
        fill="none" stroke="rgba(246,244,226,0.78)" stroke-width="0.78"
        vector-effect="non-scaling-stroke" />

      <line x1={W/2} y1="0" x2={W/2} y2={H}
        stroke="rgba(246,244,226,0.62)" stroke-width="0.68"
        vector-effect="non-scaling-stroke" />

      {#each [L13, L20, L45, L65] as d (d)}
        {@const op = d === L65 ? 0.42 : d === L13 ? 0.36 : 0.52}
        <line x1={d}   y1="0" x2={d}   y2={H} stroke={`rgba(246,244,226,${op})`} stroke-width="0.56" vector-effect="non-scaling-stroke" />
        <line x1={W-d} y1="0" x2={W-d} y2={H} stroke={`rgba(246,244,226,${op})`} stroke-width="0.56" vector-effect="non-scaling-stroke" />
      {/each}

      <!-- Goals -->
      <rect x="0"       y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
        fill="rgba(43,75,46,0.42)" stroke="rgba(246,244,226,0.62)" stroke-width="0.7" vector-effect="non-scaling-stroke" />
      <rect x={W - SMALL_D} y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
        fill="rgba(43,75,46,0.42)" stroke="rgba(246,244,226,0.62)" stroke-width="0.7" vector-effect="non-scaling-stroke" />
      <line x1="0" y1={cy - SMALL_W/2} x2="0" y2={cy + SMALL_W/2}
        stroke={homeColor} stroke-width="2.1" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <line x1={W} y1={cy - SMALL_W/2} x2={W} y2={cy + SMALL_W/2}
        stroke={awayColor} stroke-width="2.1" stroke-linecap="round" vector-effect="non-scaling-stroke" />

      <!-- 40m arcs -->
      <g clip-path="url(#tb-field-clip)">
        <circle cx="0"  cy={cy} r={R_40} fill="none" stroke="rgba(246,244,226,0.44)" stroke-width="0.58" vector-effect="non-scaling-stroke" />
        <circle cx={W} cy={cy} r={R_40} fill="none" stroke="rgba(246,244,226,0.44)" stroke-width="0.58" vector-effect="non-scaling-stroke" />
      </g>

      <!-- D arcs -->
      <g clip-path="url(#tb-ld-clip)">
        <circle cx={L20}     cy={cy} r={R_D} fill="none" stroke="rgba(246,244,226,0.58)" stroke-width="0.66" vector-effect="non-scaling-stroke" />
      </g>
      <g clip-path="url(#tb-rd-clip)">
        <circle cx={W - L20} cy={cy} r={R_D} fill="none" stroke="rgba(246,244,226,0.58)" stroke-width="0.66" vector-effect="non-scaling-stroke" />
      </g>

      {#if showTeamLabels}
        <text x="5" y="4.2" font-size="2.2" font-weight="800" fill="rgba(246,244,226,0.22)" pointer-events="none" style="user-select:none">
          {teamName || 'Home'}
        </text>
        <text x={W - 5} y="4.2" font-size="2.2" font-weight="800" fill="rgba(246,244,226,0.22)" text-anchor="end" pointer-events="none" style="user-select:none">
          {opponentName || 'Away'}
        </text>
      {/if}

      <!-- ── Moves layer ──────────────────────────────────────────────── -->

      <!-- Pen marks -->
      {#each penStrokes as stroke (stroke.id)}
        <polyline
          points={toSvgPoints(stroke.path)}
          fill="none"
          stroke={stroke.color}
          stroke-width={Math.max(stroke.width || penWidth, 2)}
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.96"
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
          opacity="0.96"
          vector-effect="non-scaling-stroke"
        />
      {/if}

      <!-- Run paths: dashed freehand route with arrowhead at endpoint -->
      {#each moves.filter(m => m.type === 'run') as m (m.id)}
        {@const op = moveStrokeOpacity(m)}
        {@const pts = toSvgPoints(m.path)}
        {@const last = m.path[m.path.length - 1]}
        {@const prev = m.path[m.path.length - 2] || m.path[0]}
        {@const runArrow = arrowHead(svgX(prev), svgY(prev), svgX(last), svgY(last))}
        <polyline points={pts} fill="none" stroke={RUN_COLOR} stroke-width="1.8"
          stroke-dasharray="3.1 1.9" stroke-linecap="round" stroke-linejoin="round"
          opacity={op} vector-effect="non-scaling-stroke" />
        <polygon points={runArrow} fill={RUN_COLOR} opacity={op} />
      {/each}

      <!-- Pass arrows: straight blue arrow, shortened to clear player circles -->
      {#each moves.filter(m => m.type === 'pass') as m (m.id)}
        {@const before = stepPositionCache[m.step - 1] || stepPositionCache[0] || {}}
        {@const fp = before[m.fromPlayerId]}
        {@const tp = before[m.toPlayerId]}
        {#if fp && tp}
          {@const op = moveStrokeOpacity(m)}
          {@const seg = shortenLine(svgX(fp), svgY(fp), svgX(tp), svgY(tp), 4.1)}
          <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={PASS_COLOR} stroke-width="1.9"
            stroke-linecap="round" opacity={op} vector-effect="non-scaling-stroke" />
          <polygon points={arrowHead(seg.x1, seg.y1, seg.x2, seg.y2, 3.05)} fill={PASS_COLOR} opacity={op} />
        {/if}
      {/each}

      <!-- Shot arrows -->
      {#each moves.filter(m => m.type === 'shot') as m (m.id)}
        {@const before = stepPositionCache[m.step - 1] || stepPositionCache[0] || {}}
        {@const from = before[m.playerId]}
        {@const target = shotTargetFor(m, before)}
        {#if from && target}
          {@const op = moveStrokeOpacity(m)}
          {@const seg = shortenLine(svgX(from), svgY(from), svgX(target), svgY(target), 4)}
          <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={SHOT_COLOR} stroke-width="2" stroke-linecap="round"
            opacity={op} vector-effect="non-scaling-stroke" />
          <polygon points={arrowHead(seg.x1, seg.y1, seg.x2, seg.y2, 3.15)} fill={SHOT_COLOR} opacity={op} />
        {/if}
      {/each}

      <!-- Ball dots travelling along pass and shot lines during animation -->
      {#each ballAnimDots as dot (dot.id)}
        <circle cx={svgX(dot)} cy={svgY(dot)} r="1.65"
          fill="#f8fafc" stroke="rgba(15,23,42,0.58)" stroke-width="0.45"
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
            cx={cx} cy={cy2} r={markerMetrics.selectedRadius}
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            stroke-width="0.58"
            opacity="1"
            vector-effect="non-scaling-stroke"
          />
        {/if}
        <circle
          cx={cx} cy={cy2} r={markerMetrics.radius}
          fill={isHome ? 'url(#tb-home-token)' : 'url(#tb-away-token)'}
          stroke={tokenBorderColor(p.team)}
          stroke-width="0.58"
          filter="url(#tb-token-shadow)"
          vector-effect="non-scaling-stroke"
        />
        <text
          x={cx} y={cy2 + 0.05}
          text-anchor="middle" dominant-baseline="central"
          font-size={markerMetrics.font} font-weight="850"
          fill={teamTextColor(p.team)}
          stroke={teamTextColor(p.team) === '#ffffff' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.24)'}
          stroke-width="0.24"
          paint-order="stroke"
          pointer-events="none"
          style="user-select:none;letter-spacing:0"
        >{p.number}</text>
      {/each}

      <!-- ── Live run-draw preview ──────────────────────────────────────── -->
      {#if isDrawingRun && rawPath.length >= 2}
        <polyline
          points={toSvgPoints(rawPath)}
          fill="none" stroke={RUN_COLOR} stroke-width="1.8"
          stroke-dasharray="3.1 1.9" stroke-linecap="round" stroke-linejoin="round"
          opacity="0.86"
          vector-effect="non-scaling-stroke"
        />
      {/if}
    </svg>
  </div>
  </div>
</div>

<style>
  .tb-overlay {
    --tb-bg: #1b2d25;
    --tb-bg-deep: #14241d;
    --tb-panel: #eef4ea;
    --tb-panel-strong: #ffffff;
    --tb-panel-line: rgba(45,72,55,0.18);
    --tb-ink: #1c3227;
    --tb-muted: rgba(28,50,39,0.66);
    --tb-red: #c81f32;
    --tb-yellow: #f2c94c;
    --tb-blue: #2f7de1;
    position: fixed;
    inset: 0;
    z-index: 1000;
    background:
      radial-gradient(circle at 50% 0%, rgba(79,119,79,0.24), transparent 42%),
      var(--tb-bg-deep);
    display: flex;
    flex-direction: column;
    touch-action: none;
    color: var(--tb-ink);
  }

  .tb-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 8px 14px;
    background: rgba(246,249,241,0.96);
    border-bottom: 1px solid rgba(31,55,42,0.12);
    box-shadow: 0 5px 16px rgba(7,18,13,0.1);
  }

  .tb-toolbar-main,
  .tb-toolbar-actions,
  .tb-cluster,
  .tb-btn-group,
  .tb-segmented,
  .tb-color-row {
    display: flex;
    align-items: center;
  }

  .tb-board-meta {
    display: grid;
    gap: 1px;
    min-width: 248px;
    max-width: 330px;
    color: var(--tb-ink);
  }

  .tb-board-meta span {
    font-size: 10px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(28,50,39,0.5);
  }

  .tb-board-meta strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .tb-toolbar-main {
    flex: 1;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    max-width: 1040px;
    flex-wrap: wrap;
  }

  .tb-toolbar-actions {
    gap: 8px;
    flex-shrink: 0;
  }

  .tb-cluster {
    gap: 6px;
    min-height: 36px;
    padding: 3px;
    border: 1px solid rgba(31,55,42,0.08);
    border-radius: 10px;
    background: rgba(255,255,255,0.46);
  }

  .tb-cluster + .tb-cluster {
    padding-left: 3px;
  }

  .tb-section-label {
    font-size: 10px;
    font-weight: 800;
    color: rgba(28,50,39,0.46);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    margin-left: 4px;
  }

  .tb-btn-group {
    gap: 4px;
  }

  .tb-btn {
    min-height: 31px;
    padding: 6px 11px;
    font-size: 12px;
    font-weight: 800;
    border-radius: 8px;
    border: 1px solid rgba(44,72,55,0.18);
    background: rgba(255,255,255,0.82);
    color: var(--tb-ink);
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(15,35,24,0.08);
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s, color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .tb-btn:not(:disabled):hover {
    border-color: rgba(47,125,225,0.4);
    box-shadow: 0 2px 7px rgba(15,35,24,0.12);
  }

  .tb-btn:not(:disabled):active {
    transform: translateY(1px);
  }

  .tb-btn:disabled {
    opacity: 0.46;
    cursor: default;
    box-shadow: none;
  }

  .tb-btn.active {
    background: var(--tb-red);
    border-color: rgba(105,14,28,0.36);
    color: #fff;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 2px 8px rgba(119,18,32,0.22);
  }

  .tb-tool-btn {
    min-width: 56px;
  }

  .tb-tool-btn.active {
    background: var(--tb-red);
    color: #fff;
  }

  .tb-play {
    min-width: 62px;
    background: var(--tb-blue);
    border-color: rgba(22,76,155,0.38);
    color: #fff;
    box-shadow: 0 2px 8px rgba(47,125,225,0.22);
  }

  .tb-undo-btn {
    color: #374151;
    background: rgba(255,255,255,0.54);
  }

  .tb-done {
    background: #dff5e4;
    border-color: rgba(34,133,77,0.26);
    color: #14532d;
  }

  .tb-settings-btn.active {
    background: #20392d;
    border-color: #20392d;
    color: #fff;
  }

  .tb-step-info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    min-height: 26px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(28,50,39,0.08);
    color: rgba(28,50,39,0.72);
    font-size: 12px;
    font-weight: 800;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .tb-segmented {
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: rgba(28,50,39,0.07);
    border: 1px solid rgba(28,50,39,0.08);
  }

  .tb-segment-btn {
    min-height: 26px;
    padding: 5px 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(28,50,39,0.72);
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }

  .tb-segment-btn.active {
    background: #fff;
    color: var(--tb-blue);
    box-shadow: 0 1px 5px rgba(15,35,24,0.14);
  }

  .tb-segment-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tb-save-state {
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    padding: 0 9px;
    border-radius: 999px;
    background: rgba(28,50,39,0.08);
    color: rgba(28,50,39,0.66);
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .tb-board-body {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    min-height: 0;
    padding: 22px 28px 26px;
    position: relative;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.04), transparent 38%),
      var(--tb-bg);
  }

  .tb-side-panel {
    position: absolute;
    z-index: 3;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: min(340px, calc(100% - 24px));
    overflow: auto;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 14px;
    background: linear-gradient(180deg, #f8faf3, #edf3e8);
    box-shadow: 0 22px 48px rgba(4,16,10,0.34);
    padding: 14px;
  }

  .tb-side-section {
    display: grid;
    gap: 9px;
    padding: 13px 0;
    border-bottom: 1px solid rgba(28,50,39,0.12);
  }

  .tb-side-section:first-child {
    padding-top: 0;
  }

  .tb-side-section:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .tb-side-section h2,
  .tb-side-section h3 {
    margin: 0;
  }

  .tb-side-section h2 {
    font-size: 15px;
    line-height: 1.2;
    color: var(--tb-ink);
  }

  .tb-side-section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(28,50,39,0.54);
  }

  .tb-side-label {
    font-size: 12px;
    line-height: 1.35;
    color: var(--tb-muted);
  }

  .tb-side-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    border-radius: 8px;
    background: rgba(28,50,39,0.07);
    color: var(--tb-muted);
    font-size: 12px;
  }

  .tb-side-row strong {
    color: var(--tb-ink);
    font-variant-numeric: tabular-nums;
  }

  .tb-segmented-panel {
    align-self: start;
    background: rgba(28,50,39,0.1);
  }

  .tb-panel-btn {
    justify-content: center;
    width: 100%;
    background: rgba(255,255,255,0.7);
  }

  .tb-reset-btn {
    color: #8a3b00;
    border-color: rgba(180,83,9,0.28);
    background: rgba(255,247,237,0.82);
  }

  .tb-danger-section {
    background: rgba(180,83,9,0.05);
    margin: 0 -8px -4px;
    padding: 12px 8px 8px;
    border-radius: 10px;
    border-bottom: 0;
  }

  .tb-color-row {
    gap: 8px;
    flex-wrap: wrap;
  }

  .tb-team-color-grid {
    display: grid;
    gap: 12px;
  }

  .tb-team-color-row {
    display: grid;
    gap: 6px;
  }

  .tb-team-color-row > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(28,50,39,0.68);
    font-size: 12px;
    font-weight: 800;
  }

  .tb-color-btn {
    width: 31px;
    height: 31px;
    border-radius: 999px;
    border: 2px solid rgba(28,50,39,0.18);
    background: var(--swatch-color);
    cursor: pointer;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.3), 0 1px 4px rgba(15,35,24,0.18);
  }

  .tb-color-btn.active {
    border-color: var(--tb-blue);
    box-shadow: 0 0 0 2px rgba(47,125,225,0.2), inset 0 0 0 2px rgba(255,255,255,0.34);
  }

  .tb-color-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tb-pitch-wrap {
    position: relative;
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
    min-width: 0;
    width: 100%;
    max-width: 1540px;
    height: 100%;
    padding: 20px;
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
      #20362a;
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,0.1),
      inset 0 0 28px rgba(0,0,0,0.12),
      0 16px 34px rgba(6,18,12,0.24);
  }

  .tb-inline-hint,
  .tb-canvas-state {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tb-inline-hint {
    top: 14px;
    left: 16px;
    max-width: min(560px, calc(100% - 32px));
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(14,31,23,0.72);
    color: rgba(247,249,243,0.82);
    box-shadow: 0 6px 18px rgba(5,18,11,0.16);
    backdrop-filter: blur(6px);
  }

  .tb-inline-hint span {
    flex-shrink: 0;
    min-height: 22px;
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.14);
    color: #fff;
    font-size: 11px;
    font-weight: 850;
  }

  .tb-inline-hint strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
  }

  .tb-canvas-state {
    right: 16px;
    top: 14px;
    color: rgba(247,249,243,0.7);
    font-size: 11px;
    font-weight: 800;
  }

  .tb-canvas-state span {
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(14,31,23,0.54);
    backdrop-filter: blur(6px);
  }

  .tb-pitch-wrap:focus {
    outline: 3px solid rgba(125,211,252,0.72);
    outline-offset: -4px;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    user-select: none;
    cursor: default;
    border-radius: 8px;
  }

  .tb-tool-select svg {
    cursor: grab;
  }

  .tb-tool-select svg:active {
    cursor: grabbing;
  }

  .tb-tool-target svg,
  .tb-tool-draw svg {
    cursor: pointer;
  }

  @media (max-width: 920px) {
    .tb-toolbar {
      align-items: stretch;
      flex-direction: column;
      gap: 8px;
    }

    .tb-toolbar-main,
    .tb-toolbar-actions {
      width: 100%;
      justify-content: space-between;
    }

    .tb-board-meta {
      width: 100%;
      max-width: none;
    }

    .tb-cluster {
      padding-left: 0;
      border-left: 0;
    }

    .tb-board-body {
      flex-direction: column;
      padding: 12px;
      gap: 8px;
    }

    .tb-side-panel {
      top: 8px;
      right: 8px;
      bottom: auto;
      width: calc(100% - 16px);
      max-height: 36svh;
    }
  }

  @media (max-width: 640px) {
    .tb-toolbar {
      max-height: 42svh;
      overflow-y: auto;
    }

    .tb-toolbar-main,
    .tb-cluster,
    .tb-btn-group {
      align-items: flex-start;
      width: 100%;
    }

    .tb-cluster {
      flex-direction: column;
      gap: 5px;
    }

    .tb-toolbar-actions,
    .tb-btn-group {
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .tb-pitch-wrap {
      padding: 10px;
    }

    .tb-inline-hint {
      left: 10px;
      right: 10px;
      top: 10px;
      max-width: none;
      border-radius: 10px;
    }

    .tb-canvas-state {
      right: 10px;
      top: auto;
      bottom: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }

</style>
