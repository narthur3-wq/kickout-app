<script context="module" lang="ts">
  let pitchInstanceCounter = 0;
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isValidPoint, normalizePoint } from './postMatchAnalysis.js';

  export let flip = false;
  export let contestType: 'clean'|'break'|'foul'|'out' = 'clean';
  export let landing = { x: NaN, y: NaN };
  export let pickup  = { x: NaN, y: NaN };
  export let overlays: Array<any> = [];
  export let connections: Array<any> = [];
  export let editHandles: Array<any> = [];
  export let interactive = true;
  export let showZoneLabels = false;
  export let showZoneLegend = showZoneLabels;
  export let resetToken = 0;
  export let ownGoalFill = 'rgba(196,18,48,0.35)';
  export let oppositionGoalFill = 'rgba(255,255,255,0.07)';
  export let ownGoalBandStroke = '#c41230';

  const dispatch = createEventDispatcher();

  // Landscape pitch — W = length (145m), H = width (90m)
  // Stored normalised coords: x = side (0=top edge → 1=bottom edge), y = depth (0=left goal → 1=right goal)
  const W = 145, H = 90;
  const L13 = 13, L20 = 20, L45 = 45, L65 = 65;
  const SMALL_W = 14, SMALL_D = 4.5;
  const R_D = 13, R_40 = 40, R_CENTRE = 10;
  const cy = H / 2; // 45 — vertical centre

  const fieldClipId = `pitch-field-clip-${++pitchInstanceCounter}`;
  const leftDClipId = `pitch-left-d-clip-${pitchInstanceCounter}`;
  const rightDClipId = `pitch-right-d-clip-${pitchInstanceCounter}`;

  let svgEl: SVGSVGElement;
  let draggingHandleId: string | null = null;
  let draggingHandleIndex = -1;

  // Map SVG click → normalised stored coords
  function getPoint(evt: MouseEvent | PointerEvent) {
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const inv = svgEl.getScreenCTM()?.inverse();
    if (!inv) return { x: NaN, y: NaN };
    const p = pt.matrixTransform(inv);
    return {
      x: Math.max(0, Math.min(1, p.y / H)),                            // SVG-y → side
      y: Math.max(0, Math.min(1, flip ? (W - p.x) / W : p.x / W)),    // SVG-x → depth
    };
  }

  let awaitingPickup = false;
  let lastResetToken = resetToken;

  $: if (contestType !== 'break') {
    awaitingPickup = false;
  }

  $: if (Number.isNaN(landing?.x) && Number.isNaN(pickup?.x)) {
    awaitingPickup = false;
  }

  $: if (resetToken !== lastResetToken) {
    lastResetToken = resetToken;
    awaitingPickup = false;
  }

  function handleClick(e: MouseEvent) {
    if (!interactive) return;
    const pos = getPoint(e);
    if (contestType === 'break') {
      if (!awaitingPickup) { awaitingPickup = true;  dispatch('landed', pos); }
      else                 { awaitingPickup = false; dispatch('picked', pos); }
    } else { awaitingPickup = false; dispatch('landed', pos); }
  }

  function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  function editHandleId(handle: any, index: number) {
    return String(handle?.id ?? `handle-${index}`);
  }

  function editHandlePoint(handle: any) {
    return normalizePoint(handle);
  }

  function editHandleLabel(handle: any, index: number) {
    return handle?.label || `Edit handle ${index + 1}`;
  }

  function editHandleColor(handle: any) {
    return handle?.color || '#ffffff';
  }

  function editHandleRadius(handle: any) {
    const radius = Number(handle?.radius ?? 2.2);
    return Number.isFinite(radius) ? radius : 2.2;
  }

  function handleIsActive(handle: any, index: number) {
    return !!handle?.active || draggingHandleId === editHandleId(handle, index);
  }

  function dispatchHandleDrag(handle: any, index: number, point: { x: number; y: number }) {
    dispatch('handledrag', {
      id: editHandleId(handle, index),
      handle,
      index,
      point: {
        x: clamp01(point.x),
        y: clamp01(point.y),
      },
    });
  }

  function clickHandle(event: MouseEvent, handle: any, index: number) {
    event.preventDefault();
    event.stopPropagation();
    dispatch('handleclick', { handle, index });
  }

  function beginHandleDrag(event: PointerEvent, handle: any, index: number) {
    event.preventDefault();
    event.stopPropagation();
    draggingHandleId = editHandleId(handle, index);
    draggingHandleIndex = index;
    dispatch('handleclick', { handle, index });
  }

  function moveHandleDrag(event: PointerEvent) {
    if (!draggingHandleId || draggingHandleIndex < 0) return;
    const handle = editHandles[draggingHandleIndex];
    if (!handle) {
      draggingHandleId = null;
      draggingHandleIndex = -1;
      return;
    }
    event.preventDefault();
    dispatchHandleDrag(handle, draggingHandleIndex, getPoint(event));
  }

  function endHandleDrag() {
    draggingHandleId = null;
    draggingHandleIndex = -1;
  }

  function handleEditHandleKeydown(event: KeyboardEvent, handle: any, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      dispatch('handleclick', { handle, index });
      return;
    }

    const current = editHandlePoint(handle);
    if (!isValidPoint(current)) return;
    const step = event.shiftKey ? 0.02 : 0.01;
    let nextPoint = null;
    if (event.key === 'ArrowUp') nextPoint = { x: current.x - step, y: current.y };
    if (event.key === 'ArrowDown') nextPoint = { x: current.x + step, y: current.y };
    if (event.key === 'ArrowLeft') nextPoint = { x: current.x, y: current.y - step };
    if (event.key === 'ArrowRight') nextPoint = { x: current.x, y: current.y + step };
    if (!nextPoint) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch('handleclick', { handle, index });
    dispatchHandleDrag(handle, index, nextPoint);
  }

  // Keyboard crosshair — kb in normalised coords (x=side, y=depth)
  let kb = { x: 0.5, y: 0.5 };
  function handleKeydown(e: KeyboardEvent) {
    if (!interactive) return;
    const s = 0.02;
    if (e.key === 'ArrowUp')    kb = { ...kb, x: Math.max(0, kb.x - s) };
    if (e.key === 'ArrowDown')  kb = { ...kb, x: Math.min(1, kb.x + s) };
    if (e.key === 'ArrowLeft')  kb = { ...kb, y: Math.max(0, kb.y - s) };
    if (e.key === 'ArrowRight') kb = { ...kb, y: Math.min(1, kb.y + s) };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const pos = { ...kb };
      if (contestType === 'break') {
        if (!awaitingPickup) { awaitingPickup = true;  dispatch('landed', pos); }
        else                 { awaitingPickup = false; dispatch('picked', pos); }
      } else { awaitingPickup = false; dispatch('landed', pos); }
    }
  }

  // stored x = side (0–1) → SVG y;  stored y = depth (0–1) → SVG x
  function svgX(o: { x: number; y: number }) { return (flip ? 1 - o.y : o.y) * W; }
  function svgY(o: { x: number; y: number }) { return o.x * H; }

  // Bright palette — legible on dark green turf
  function outcomeColor(o: string) {
    const s = String(o || '').toLowerCase();
    if (s === 'score' || s === 'point')   return '#60a5fa'; // sky blue
    if (s === 'retained' || s === 'won')  return '#4ade80'; // bright green
    if (s === 'goal')                     return '#c084fc'; // purple
    if (s === 'lost')                     return '#f87171'; // red
    if (s === 'wide')                     return '#fbbf24'; // amber
    if (s === 'blocked')                  return '#fb923c'; // orange
    if (s === 'saved')                    return '#94a3b8'; // slate
    if (s === 'foul')                     return '#f472b6'; // pink
    return '#e2e8f0';
  }

  function overlayFill(o: any) {
    return o?.marker_fill || outcomeColor(o?.outcome);
  }

  function overlayShape(o: any) {
    if (o?.marker_shape) return o.marker_shape;
    const t = String(o?.contest_type || 'clean');
    if (t === 'break') return 'triangle';
    if (t === 'foul') return 'diamond';
    if (t === 'out') return 'square';
    return 'circle';
  }

  function overlayRing(o: any) {
    if (o?.marker_ring) return o.marker_ring;
    return o?.at_target ? 'target' : null;
  }

  function overlayRingColor(o: any) {
    return o?.marker_ring_color || 'rgba(255,255,255,0.9)';
  }

  function connectionPoint(connection: any, prefix: 'from' | 'to') {
    if (!connection || typeof connection !== 'object') return { x: NaN, y: NaN };
    if (connection[prefix]) return normalizePoint(connection[prefix]);
    return normalizePoint({
      x: connection[`${prefix}_x`],
      y: connection[`${prefix}_y`],
    });
  }

  function connectionColor(connection: any) {
    return connection?.color || connection?.stroke || 'rgba(28,63,138,0.78)';
  }

  function connectionWidth(connection: any) {
    const width = Number(connection?.width ?? connection?.stroke_width ?? 1.5);
    return Number.isFinite(width) ? width : 1.5;
  }

  function connectionDash(connection: any) {
    return connection?.dasharray || (connection?.dashed ? '4 3' : null);
  }

  function connectionArrowSize(connection: any) {
    const size = Number(connection?.arrow_size ?? 2.4);
    return Number.isFinite(size) ? size : 2.4;
  }

  function connectionIsClickable(connection: any) {
    return connection?.clickable !== false;
  }

  function connectionLabel(connection: any) {
    return connection?.label || 'Pitch connection';
  }

  function connectionPoints(connection: any): Array<{x: number; y: number}> | null {
    if (!Array.isArray(connection?.points) || connection.points.length < 2) return null;
    const pts = connection.points.map((p: any) => normalizePoint(p)).filter(isValidPoint);
    return pts.length >= 2 ? pts : null;
  }

  // Catmull-Rom spline through all points, returned as an SVG path string.
  // Uses phantom duplicated endpoints so the curve passes through every stored point.
  function catmullRomSvgPath(pts: Array<{x: number; y: number}>): string {
    if (pts.length < 2) return '';
    const xs = pts.map(p => svgX(p));
    const ys = pts.map(p => svgY(p));
    if (pts.length === 2) {
      return `M ${xs[0]} ${ys[0]} L ${xs[1]} ${ys[1]}`;
    }
    const ex = [xs[0], ...xs, xs[xs.length - 1]];
    const ey = [ys[0], ...ys, ys[ys.length - 1]];
    let d = `M ${ex[1].toFixed(3)} ${ey[1].toFixed(3)}`;
    for (let i = 1; i < ex.length - 2; i++) {
      const cp1x = ex[i] + (ex[i + 1] - ex[i - 1]) / 6;
      const cp1y = ey[i] + (ey[i + 1] - ey[i - 1]) / 6;
      const cp2x = ex[i + 1] - (ex[i + 2] - ex[i]) / 6;
      const cp2y = ey[i + 1] - (ey[i + 2] - ey[i]) / 6;
      d += ` C ${cp1x.toFixed(3)} ${cp1y.toFixed(3)} ${cp2x.toFixed(3)} ${cp2y.toFixed(3)} ${ex[i + 1].toFixed(3)} ${ey[i + 1].toFixed(3)}`;
    }
    return d;
  }

  function overlayIsClickable(o: any) {
    return o?.clickable !== false;
  }

  function connectionKeydown(event: KeyboardEvent, connection: any, index: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    dispatch('connectionclick', { connection, index });
  }

  function overlayKeydown(event: KeyboardEvent, overlay: any, index: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    dispatch('overlayclick', { overlay, index });
  }

  const SZ = 2.0;
</script>

<style>
  svg {
    touch-action: manipulation; user-select: none;
    display: block; width: 100%; height: 100%; flex: 1; min-height: 0; cursor: crosshair;
  }
  :global(.zlabel) { font-size: 3px; fill: rgba(255,255,255,0.55); pointer-events: none; font-weight: 700; }
  .zone-legend {
    display: flex; gap: 12px; justify-content: center;
    font-size: 10px; color: #6b7280; padding: 4px 0;
    flex-shrink: 0;
  }
  .clickable:focus-visible {
    outline: 2px solid rgba(255,255,255,0.9);
    outline-offset: 2px;
  }
  .edit-handle {
    pointer-events: auto;
    cursor: grab;
  }
  .edit-handle.active {
    cursor: grabbing;
  }
  .edit-handle-hit {
    pointer-events: all;
  }
  .edit-handle-core {
    filter: drop-shadow(0 1px 1px rgba(15,23,42,0.28));
  }
</style>

<svelte:window on:pointermove={moveHandleDrag} on:pointerup={endHandleDrag} on:pointercancel={endHandleDrag} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svgEl}
  viewBox="0 0 145 90"
  preserveAspectRatio="xMidYMid meet"
  role="application"
  aria-label="GAA pitch — tap or use arrow keys to set a point"
  tabindex="0"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <defs>
    <clipPath id={fieldClipId} clipPathUnits="userSpaceOnUse">
      <rect x="0" y="0" width={W} height={H} />
    </clipPath>
    <clipPath id={leftDClipId} clipPathUnits="userSpaceOnUse">
      <rect x={L20} y="0" width={W - L20} height={H} />
    </clipPath>
    <clipPath id={rightDClipId} clipPathUnits="userSpaceOnUse">
      <rect x="0" y="0" width={W - L20} height={H} />
    </clipPath>
  </defs>

  <!-- turf base -->
  <rect x="0" y="0" width={W} height={H} fill="#3d7642" />
  <!-- subtle half-pitch stripe — mimics mown stripes -->
  <rect x="0"     y="0" width={W/2} height={H} fill="rgba(0,0,0,0.04)" />
  <rect x={W*3/4} y="0" width={W/4} height={H} fill="rgba(0,0,0,0.025)" />
  <rect x="0"     y="0" width={W/4} height={H} fill="rgba(0,0,0,0.025)" />

  <!-- boundary -->
  <rect x="0.5" y="0.5" width={W-1} height={H-1}
    fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.2"
    vector-effect="non-scaling-stroke" />

  <!-- halfway line -->
  <line x1={W/2} y1="0" x2={W/2} y2={H}
    stroke="rgba(255,255,255,0.88)" stroke-width="1.1"
    vector-effect="non-scaling-stroke" />

  <!-- distance lines from each end — weight hierarchy -->
  {#each [L13, L20, L45, L65] as d (d)}
    <line x1={d}   y1="0" x2={d}   y2={H}
      stroke={d === L65 ? 'rgba(255,255,255,0.62)' : d === L13 ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.72)'}
      stroke-width="0.9"
      vector-effect="non-scaling-stroke" />
    <line x1={W-d} y1="0" x2={W-d} y2={H}
      stroke={d === L65 ? 'rgba(255,255,255,0.62)' : d === L13 ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.72)'}
      stroke-width="0.9"
      vector-effect="non-scaling-stroke" />
  {/each}

  <!-- goal small rectangles — left and right ends -->
  <!-- our end goal: filled with team red tint; opposition goal: muted white -->
  <rect x="0" y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
    fill={!flip ? ownGoalFill : oppositionGoalFill}
    stroke="rgba(255,255,255,0.88)" stroke-width="1.0"
    vector-effect="non-scaling-stroke" />
  <rect x={W - SMALL_D} y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
    fill={flip ? ownGoalFill : oppositionGoalFill}
    stroke="rgba(255,255,255,0.88)" stroke-width="1.0"
    vector-effect="non-scaling-stroke" />
  <!-- coloured band on our goal line for at-a-glance orientation -->
  {#if !flip}
    <line x1="0" y1={cy - SMALL_W/2} x2="0" y2={cy + SMALL_W/2}
      stroke={ownGoalBandStroke} stroke-width="3" stroke-linecap="round"
      vector-effect="non-scaling-stroke" />
  {:else}
    <line x1={W} y1={cy - SMALL_W/2} x2={W} y2={cy + SMALL_W/2}
      stroke={ownGoalBandStroke} stroke-width="3" stroke-linecap="round"
      vector-effect="non-scaling-stroke" />
  {/if}

  <!-- 40m arcs and D arcs — clipped circles avoid SVG arc quirks in WebKit -->
  <g clip-path={`url(#${fieldClipId})`}>
    <circle
      data-marking="40-left"
      cx="0"
      cy={cy}
      r={R_40}
      fill="none"
      stroke="rgba(255,255,255,0.65)"
      stroke-width="1.0"
      vector-effect="non-scaling-stroke"
    />
    <circle
      data-marking="40-right"
      cx={W}
      cy={cy}
      r={R_40}
      fill="none"
      stroke="rgba(255,255,255,0.65)"
      stroke-width="1.0"
      vector-effect="non-scaling-stroke"
    />
  </g>

  <g clip-path={`url(#${leftDClipId})`}>
    <circle
      data-marking="d-left"
      cx={L20}
      cy={cy}
      r={R_D}
      fill="none"
      stroke="rgba(255,255,255,0.85)"
      stroke-width="1.1"
      vector-effect="non-scaling-stroke"
    />
  </g>
  <g clip-path={`url(#${rightDClipId})`}>
    <circle
      data-marking="d-right"
      cx={W - L20}
      cy={cy}
      r={R_D}
      fill="none"
      stroke="rgba(255,255,255,0.85)"
      stroke-width="1.1"
      vector-effect="non-scaling-stroke"
    />
  </g>

  <!-- pass / carry connections -->
  <g>
    {#each connections as connection, index (`${connection.id ?? 'connection'}-${index}`)}
      {@const cpts = connectionPoints(connection)}
      {#if cpts}
        <!-- smooth multi-point carry path (Catmull-Rom) -->
        {@const pathD = catmullRomSvgPath(cpts)}
        {@const lastPt = cpts[cpts.length - 1]}
        {@const prevPt = cpts[cpts.length - 2]}
        {@const color = connectionColor(connection)}
        {@const width = connectionWidth(connection)}
        {@const dash = connectionDash(connection)}
        {@const arrowSize = connectionArrowSize(connection)}
        {@const tlx = svgX(lastPt)}
        {@const tly = svgY(lastPt)}
        {@const angle = Math.atan2(tly - svgY(prevPt), tlx - svgX(prevPt))}
        {@const arrowBackX = tlx - Math.cos(angle) * arrowSize}
        {@const arrowBackY = tly - Math.sin(angle) * arrowSize}
        {@const perpX = Math.cos(angle + Math.PI / 2) * (arrowSize * 0.45)}
        {@const perpY = Math.sin(angle + Math.PI / 2) * (arrowSize * 0.45)}
        <g opacity={connection.opacity ?? 0.78} data-draft={connection?.draft ? 'true' : undefined}>
          <path
            d={pathD}
            stroke={color}
            stroke-width={width}
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray={dash}
            vector-effect="non-scaling-stroke"
          />
          {#if connection.arrow !== false}
            <polygon
              points={`${tlx},${tly} ${arrowBackX + perpX},${arrowBackY + perpY} ${arrowBackX - perpX},${arrowBackY - perpY}`}
              fill={color}
              opacity="0.95"
            />
          {/if}
          {#if connectionIsClickable(connection)}
            <path
              class:clickable={true}
              d={pathD}
              stroke="rgba(255,255,255,0.001)"
              stroke-width={Math.max(width + 5, 7)}
              fill="none"
              stroke-linecap="round"
              pointer-events="stroke"
              role="button"
              tabindex="0"
              aria-label={connectionLabel(connection)}
              on:click={() => dispatch('connectionclick', { connection, index })}
              on:keydown={(event) => connectionKeydown(event, connection, index)}
            />
          {/if}
        </g>
      {:else}
        {@const from = connectionPoint(connection, 'from')}
        {@const to = connectionPoint(connection, 'to')}
        {#if isValidPoint(from) && isValidPoint(to)}
          {@const sx = svgX(from)}
          {@const sy = svgY(from)}
          {@const tx = svgX(to)}
          {@const ty = svgY(to)}
          {@const color = connectionColor(connection)}
          {@const width = connectionWidth(connection)}
          {@const dash = connectionDash(connection)}
          {@const arrowSize = connectionArrowSize(connection)}
          {@const angle = Math.atan2(ty - sy, tx - sx)}
          {@const arrowBackX = tx - Math.cos(angle) * arrowSize}
          {@const arrowBackY = ty - Math.sin(angle) * arrowSize}
          {@const perpX = Math.cos(angle + Math.PI / 2) * (arrowSize * 0.45)}
          {@const perpY = Math.sin(angle + Math.PI / 2) * (arrowSize * 0.45)}
          <g opacity={connection.opacity ?? 0.78} data-draft={connection?.draft ? 'true' : undefined}>
            <line
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke={color}
              stroke-width={width}
              stroke-linecap="round"
              stroke-dasharray={dash}
              vector-effect="non-scaling-stroke"
            />
            {#if connection.arrow !== false}
              <polygon
                points={`${tx},${ty} ${arrowBackX + perpX},${arrowBackY + perpY} ${arrowBackX - perpX},${arrowBackY - perpY}`}
                fill={color}
                opacity="0.95"
              />
            {/if}
            {#if connectionIsClickable(connection)}
              <line
                class:clickable={true}
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke="rgba(255,255,255,0.001)"
                stroke-width={Math.max(width + 5, 7)}
                stroke-linecap="round"
                pointer-events="stroke"
                role="button"
                tabindex="0"
                aria-label={connectionLabel(connection)}
                on:click={() => dispatch('connectionclick', { connection, index })}
                on:keydown={(event) => connectionKeydown(event, connection, index)}
              />
            {/if}
          </g>
        {/if}
      {/if}
    {/each}
  </g>

  <!-- overlays -->
  <g>
    {#each overlays as o, index (`${o.id ?? 'overlay'}-${index}`)}
      {@const sx = svgX(o)}
      {@const sy = svgY(o)}
      {@const col = overlayFill(o)}
      {@const shape = overlayShape(o)}
      {@const ring = overlayRing(o)}
      {@const ringColor = overlayRingColor(o)}
      <g
        class:clickable={overlayIsClickable(o)}
        style={overlayIsClickable(o) ? 'pointer-events:auto; cursor:pointer;' : 'pointer-events:none;'}
        data-draft={o?.draft ? 'true' : undefined}
        opacity={o.opacity ?? 1}
        role={overlayIsClickable(o) ? 'button' : undefined}
        tabindex={overlayIsClickable(o) ? '0' : undefined}
        aria-label={o?.label || 'Pitch marker'}
        on:click={() => overlayIsClickable(o) && dispatch('overlayclick', { overlay: o, index })}
        on:keydown={(event) => overlayIsClickable(o) && overlayKeydown(event, o, index)}
      >
        {#if shape === 'triangle'}
          <polygon
            points={`${sx},${sy-SZ} ${sx-SZ*.9},${sy+SZ*.7} ${sx+SZ*.9},${sy+SZ*.7}`}
            fill={col}
            stroke="rgba(255,255,255,0.75)"
            stroke-width="0.55"
            vector-effect="non-scaling-stroke"
          />
        {:else if shape === 'diamond'}
          <polygon
            points={`${sx},${sy-SZ} ${sx-SZ},${sy} ${sx},${sy+SZ} ${sx+SZ},${sy}`}
            fill={col}
            stroke="rgba(255,255,255,0.75)"
            stroke-width="0.55"
            vector-effect="non-scaling-stroke"
          />
        {:else if shape === 'square'}
          <rect
            x={sx - SZ * 0.88}
            y={sy - SZ * 0.88}
            width={SZ * 1.76}
            height={SZ * 1.76}
            fill={col}
            stroke="rgba(255,255,255,0.75)"
            stroke-width="0.55"
            vector-effect="non-scaling-stroke"
          />
        {:else}
          <circle
            cx={sx}
            cy={sy}
            r={SZ * 0.92}
            fill={col}
            stroke="rgba(255,255,255,0.75)"
            stroke-width="0.55"
            vector-effect="non-scaling-stroke"
          />
        {/if}
        {#if ring}
          {#if ring === 'target'}
            <circle
              cx={sx}
              cy={sy}
              r={SZ * 1.4}
              fill="none"
              stroke="rgba(255,255,255,0.98)"
              stroke-width="3"
              vector-effect="non-scaling-stroke"
            />
            <circle
              cx={sx}
              cy={sy}
              r={SZ * 1.4}
              fill="none"
              stroke={ringColor}
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          {:else}
            <circle
              cx={sx}
              cy={sy}
              r={SZ * 1.55}
              fill="none"
              stroke={ringColor}
              stroke-width={ring === 'goal-attempt' ? 0.9 : 0.7}
              stroke-dasharray={ring === 'goal-attempt' ? null : null}
              vector-effect="non-scaling-stroke"
            />
          {/if}
        {/if}
      </g>
    {/each}
  </g>

  <!-- edit handles -->
  <g>
    {#each editHandles as handle, index (`${editHandleId(handle, index)}`)}
      {@const point = editHandlePoint(handle)}
      {#if isValidPoint(point)}
        {@const radius = editHandleRadius(handle)}
        {@const active = handleIsActive(handle, index)}
        <g
          class="edit-handle"
          class:active={active}
          role="button"
          tabindex="0"
          aria-label={editHandleLabel(handle, index)}
          transform={`translate(${svgX(point)} ${svgY(point)})`}
          opacity={handle?.opacity ?? 1}
          on:click={(event) => clickHandle(event, handle, index)}
          on:pointerdown={(event) => beginHandleDrag(event, handle, index)}
          on:keydown={(event) => handleEditHandleKeydown(event, handle, index)}
        >
          <circle class="edit-handle-hit" r={radius * 1.9} fill="rgba(255,255,255,0.001)" />
          <circle
            r={radius * 1.35}
            fill="rgba(255,255,255,0.14)"
            stroke={active ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.55)'}
            stroke-width={active ? 0.95 : 0.75}
            vector-effect="non-scaling-stroke"
          />
          <circle
            class="edit-handle-core"
            r={radius}
            fill={editHandleColor(handle)}
            stroke={active ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.68)'}
            stroke-width={active ? 0.9 : 0.65}
            vector-effect="non-scaling-stroke"
          />
        </g>
      {/if}
    {/each}
  </g>

  <!-- landing marker — white, high-contrast -->
  {#if !Number.isNaN(landing.x) && !Number.isNaN(landing.y)}
    <circle cx={svgX(landing)} cy={svgY(landing)} r="2.4"
      fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.25)" stroke-width="0.5"
      vector-effect="non-scaling-stroke" />
  {/if}
  <!-- pickup marker + connector -->
  {#if !Number.isNaN(pickup.x) && !Number.isNaN(pickup.y)}
    <line
      x1={svgX(landing)} y1={svgY(landing)}
      x2={svgX(pickup)}  y2={svgY(pickup)}
      stroke="rgba(255,255,255,0.45)" stroke-dasharray="2 2" stroke-width="0.7"
      vector-effect="non-scaling-stroke" />
    <circle cx={svgX(pickup)} cy={svgY(pickup)} r="2.0"
      fill="rgba(255,255,255,0.65)" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"
      vector-effect="non-scaling-stroke" />
  {/if}

  <!-- zone labels -->
  {#if showZoneLabels}
    <text x="1.8" y={H/6 + 1.2}   class="zlabel">L</text>
    <text x="1.8" y={H/2 + 1.2}   class="zlabel">C</text>
    <text x="1.8" y={5*H/6 + 1.2} class="zlabel">R</text>
    <text x={L20}   y="3.5" text-anchor="middle" class="zlabel">20</text>
    <text x={L45}   y="3.5" text-anchor="middle" class="zlabel">45</text>
    <text x={L65}   y="3.5" text-anchor="middle" class="zlabel">65</text>
    <text x={W-L65} y="3.5" text-anchor="middle" class="zlabel">65</text>
    <text x={W-L45} y="3.5" text-anchor="middle" class="zlabel">45</text>
    <text x={W-L20} y="3.5" text-anchor="middle" class="zlabel">20</text>
  {/if}

  <!-- keyboard crosshair -->
  <circle cx={(flip ? 1-kb.y : kb.y)*W} cy={kb.x*H} r="1.4"
    fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.55"
    vector-effect="non-scaling-stroke" />
</svg>

{#if showZoneLabels && showZoneLegend}
  <div class="zone-legend">
    <span>L / C / R — side band</span>
    <span>20 / 45 / 65 — metres from goal</span>
  </div>
{/if}
