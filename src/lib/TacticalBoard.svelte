<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import {
    W, H, svgX, svgY,
    pointerToPitch, easeInOut,
    simplifyPitchPath, defaultPlayers, derivePositionsAtStep,
  } from './tacticalBoardUtils.js';

  export let teamName = 'Home';
  export let opponentName = 'Away';

  const dispatch = createEventDispatcher();

  // ── State ───────────────────────────────────────────────────────────────
  let players = defaultPlayers();
  let moves = [];
  let nextId = 1;
  let currentStep = 1;   // step currently being drawn into
  let playhead = 0;      // 0 = before step 1, N = after step N played

  // ── Tool ────────────────────────────────────────────────────────────────
  let tool = 'select'; // 'select' | 'pass' | 'run'

  // ── Interaction ─────────────────────────────────────────────────────────
  let svgEl;
  let draggingPlayerId = null;
  let passFirstPlayerId = null;   // first player tapped in pass mode
  let runArmedPlayerId = null;    // player selected in run mode
  let rawPath = [];               // raw pitch-coord points captured during draw
  let isDrawingRun = false;

  // ── Playback ─────────────────────────────────────────────────────────────
  let animating = false;
  let animatingStep = 0;
  let animStartTime = null;
  let animProgress = 0;
  let animRafId = null;
  const ANIM_DURATION = 1200;

  onDestroy(() => { if (animRafId) cancelAnimationFrame(animRafId); });

  // ── Derived ──────────────────────────────────────────────────────────────
  $: maxStep = moves.length > 0 ? Math.max(...moves.map(m => m.step)) : 0;
  $: canPlay = !animating && playhead < maxStep;
  $: canBack = !animating && playhead > 0;

  // Cache resolved player positions at each step boundary.
  // Reactive on players + moves. Stable during animation (no edits allowed then).
  $: stepPositionCache = (() => {
    const cache = new Map([[0, derivePositionsAtStep(players, moves, 0)]]);
    for (let s = 1; s <= maxStep; s++) {
      cache.set(s, derivePositionsAtStep(players, moves, s));
    }
    return cache;
  })();

  // Animated player positions — interpolates between adjacent step cache entries.
  // When not animating, show positions relevant to the current drawing context so that
  // run paths drawn for step N start from visually correct player locations.
  $: visualPositions = (() => {
    if (!animating) {
      const displayStep = Math.max(playhead, Math.max(0, currentStep - 1));
      return stepPositionCache.get(displayStep) || derivePositionsAtStep(players, moves, displayStep);
    }
    const before = stepPositionCache.get(animatingStep - 1);
    const after  = stepPositionCache.get(animatingStep);
    if (!before || !after) return stepPositionCache.get(playhead) || new Map();
    const t = easeInOut(animProgress);
    const result = new Map();
    for (const p of players) {
      const b = before.get(p.id) || { x: p.baseX, y: p.baseY };
      const a = after.get(p.id)  || { x: p.baseX, y: p.baseY };
      result.set(p.id, { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t });
    }
    return result;
  })();

  // Ball dots that travel along pass lines during animation.
  $: passAnimDots = (() => {
    if (!animating) return [];
    const before = stepPositionCache.get(animatingStep - 1);
    if (!before) return [];
    const t = easeInOut(animProgress);
    return moves
      .filter(m => m.type === 'pass' && m.step === animatingStep)
      .flatMap(m => {
        const fp = before.get(m.fromPlayerId);
        const tp = before.get(m.toPlayerId);
        if (!fp || !tp) return [];
        return [{ id: m.id, x: fp.x + (tp.x - fp.x) * t, y: fp.y + (tp.y - fp.y) * t }];
      });
  })();

  // ── Animation loop ────────────────────────────────────────────────────────
  function startAnimation(step) {
    animating = true;
    animatingStep = step;
    animStartTime = performance.now();
    animProgress = 0;
    animRafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    animProgress = Math.min((now - animStartTime) / ANIM_DURATION, 1);
    if (animProgress < 1) {
      animRafId = requestAnimationFrame(tick);
    } else {
      animating = false;
      animProgress = 0;
      playhead = animatingStep;
      animRafId = null;
    }
  }

  // ── Playback controls ─────────────────────────────────────────────────────
  function handlePlay() {
    if (!canPlay) return;
    startAnimation(playhead + 1);
  }

  function handlePause() {
    if (!animating) return;
    cancelAnimationFrame(animRafId);
    animRafId = null;
    animating = false;
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
    animProgress = 0;
    playhead = 0;
  }

  function handleUndo() {
    if (moves.length === 0 || animating) return;
    const maxOrder = Math.max(...moves.map(m => m.createdOrder));
    const removed = moves.find(m => m.createdOrder === maxOrder);
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

  function handleClearMoves() {
    if (animating) return;
    handleReset();
    moves = [];
    currentStep = 1;
    passFirstPlayerId = null;
    runArmedPlayerId = null;
  }

  function handleResetFormation() {
    if (animating) return;
    handleReset();
    players = defaultPlayers();
    moves = [];
    currentStep = 1;
    passFirstPlayerId = null;
    runArmedPlayerId = null;
    rawPath = [];
    isDrawingRun = false;
  }

  function advanceStep() {
    if (animating) return;
    if (!moves.some(m => m.step === currentStep)) return; // require at least one move in current step
    currentStep = Math.min(currentStep + 1, 20);
    passFirstPlayerId = null;
    runArmedPlayerId = null;
    rawPath = [];
    isDrawingRun = false;
  }

  // ── Tool switching ────────────────────────────────────────────────────────
  function switchTool(t) {
    if (animating) return;
    tool = t;
    passFirstPlayerId = null;
    runArmedPlayerId = null;
    rawPath = [];
    isDrawingRun = false;
  }

  // ── Pointer handling ──────────────────────────────────────────────────────
  // Identify nearest player within HIT_RADIUS SVG units of the pointer.
  const HIT_RADIUS = 9;

  function nearestPlayer(event) {
    const pt = pointerToPitch(event, svgEl);
    if (!pt) return null;
    let best = null, bestDist = Infinity;
    for (const p of players) {
      const pos = visualPositions.get(p.id) || { x: p.baseX, y: p.baseY };
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
      if (p) draggingPlayerId = p.id;

    } else if (tool === 'pass') {
      const p = nearestPlayer(event);
      if (!p) return;
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

    } else if (tool === 'run') {
      const p = nearestPlayer(event);
      if (p) {
        runArmedPlayerId = p.id;
        rawPath = [];
        isDrawingRun = false;
      } else if (runArmedPlayerId && !isDrawingRun) {
        const startPos = (stepPositionCache.get(Math.max(0, currentStep - 1)) || new Map())
          .get(runArmedPlayerId) || { x: 0.5, y: 0.5 };
        isDrawingRun = true;
        rawPath = [startPos, pt];
      }
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
    }
  }

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const HOME_COLOR = '#c41230';
  const AWAY_COLOR = '#f1f5f9';

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

<div class="tb-overlay">
  <!-- Toolbar -->
  <div class="tb-toolbar">
    <div class="tb-section tb-tools">
      <span class="tb-section-label">Tool</span>
      <button class="tb-btn" class:active={tool === 'select'} on:click={() => switchTool('select')} disabled={animating}>Select</button>
      <button class="tb-btn" class:active={tool === 'pass'} on:click={() => switchTool('pass')} disabled={animating}>Pass</button>
      <button class="tb-btn" class:active={tool === 'run'} on:click={() => switchTool('run')} disabled={animating}>Run</button>
    </div>

    <div class="tb-section tb-playback">
      <button class="tb-btn" on:click={handleBack} disabled={!canBack}>← Back</button>
      <button class="tb-btn tb-play" on:click={animating ? handlePause : handlePlay} disabled={!animating && !canPlay}>
        {animating ? '⏸ Pause' : '▶ Play'}
      </button>
      <span class="tb-step-info">
        {#if animating}
          Step {animatingStep}/{maxStep}
        {:else}
          {playhead}/{maxStep}
        {/if}
      </span>
      <button class="tb-btn" on:click={handleReset} disabled={!animating && playhead === 0}>↺ Reset</button>
    </div>

    <div class="tb-section tb-step-draw">
      <span class="tb-section-label">Drawing step {currentStep}</span>
      <button class="tb-btn" on:click={advanceStep} disabled={animating || !moves.some(m => m.step === currentStep)} title="Start drawing the next step">+ Next Step</button>
    </div>

    <div class="tb-section tb-manage">
      <button class="tb-btn" on:click={handleUndo} disabled={moves.length === 0 || animating}>Undo</button>
      <button class="tb-btn" on:click={handleClearMoves} disabled={moves.length === 0 || animating}>Clear</button>
      <button class="tb-btn tb-reset-btn" on:click={handleResetFormation} disabled={animating}>Reset</button>
      <button class="tb-btn tb-done" on:click={() => dispatch('close')}>Done</button>
    </div>
  </div>

  <!-- Status hint -->
  <div class="tb-hint">
    {#if tool === 'pass' && passFirstPlayerId}
      Tap the receiving player
    {:else if tool === 'pass'}
      Tap the passing player
    {:else if tool === 'run' && runArmedPlayerId && isDrawingRun}
      Release to save run
    {:else if tool === 'run' && runArmedPlayerId && !isDrawingRun}
      Tap the pitch and drag to draw the run path
    {:else if tool === 'run' && !runArmedPlayerId}
      Tap a player to select them
    {:else if tool === 'select'}
      Drag players to set positions — {teamName || 'Home'} (red) vs {opponentName || 'Away'} (white)
    {:else}&nbsp;{/if}
  </div>

  <!-- Pitch -->
  <div class="tb-pitch-wrap">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svgEl}
      viewBox="0 0 145 90"
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Tactical board"
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerUp}
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
        {@const before = stepPositionCache.get(m.step - 1) || stepPositionCache.get(0) || new Map()}
        {@const fp = before.get(m.fromPlayerId)}
        {@const tp = before.get(m.toPlayerId)}
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

      <!-- Ball dots travelling along pass lines during animation -->
      {#each passAnimDots as dot (dot.id)}
        <circle cx={svgX(dot)} cy={svgY(dot)} r="2.2"
          fill="white" stroke="rgba(0,0,0,0.5)" stroke-width="0.6"
          vector-effect="non-scaling-stroke" />
      {/each}

      <!-- ── Players ───────────────────────────────────────────────────── -->
      {#each players as p (p.id)}
        {@const pos = visualPositions.get(p.id) || { x: p.baseX, y: p.baseY }}
        {@const cx = svgX(pos)}
        {@const cy2 = svgY(pos)}
        {@const isHome = p.team === 'home'}
        {@const highlighted = runArmedPlayerId === p.id || passFirstPlayerId === p.id}
        <circle
          cx={cx} cy={cy2} r="4.8"
          fill={isHome ? HOME_COLOR : AWAY_COLOR}
          stroke={highlighted ? '#fbbf24' : (isHome ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.6)')}
          stroke-width={highlighted ? 1.8 : 0.8}
          vector-effect="non-scaling-stroke"
        />
        <text
          x={cx} y={cy2}
          text-anchor="middle" dominant-baseline="central"
          font-size="3.4" font-weight="800"
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
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #0f1923;
    border-bottom: 2px solid #c41230;
    flex-wrap: wrap;
  }

  .tb-section {
    display: flex;
    align-items: center;
    gap: 4px;
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

  .tb-btn {
    padding: 7px 12px;
    font-size: 13px;
    font-weight: 700;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.85);
    cursor: pointer;
    white-space: nowrap;
    min-height: 36px;
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
    min-width: 84px;
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
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    min-width: 44px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .tb-hint {
    flex-shrink: 0;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    padding: 3px 12px;
    background: #0c141c;
    min-height: 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tb-pitch-wrap {
    flex: 1;
    display: flex;
    min-height: 0;
    padding: 6px;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    user-select: none;
    cursor: crosshair;
  }

</style>
