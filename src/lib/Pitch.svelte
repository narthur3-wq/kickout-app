<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let flip = false;
  export let contestType: 'clean'|'break'|'foul'|'out' = 'clean';
  export let landing = { x: NaN, y: NaN };
  export let pickup  = { x: NaN, y: NaN };
  export let overlays: Array<any> = [];
  export let showZoneLabels = false;

  const dispatch = createEventDispatcher();

  // Landscape pitch — W = length (145m), H = width (90m)
  // Stored normalised coords: x = side (0=top edge → 1=bottom edge), y = depth (0=left goal → 1=right goal)
  const W = 145, H = 90;
  const L13 = 13, L20 = 20, L45 = 45, L65 = 65;
  const SMALL_W = 14, SMALL_D = 4.5;
  const R_D = 13, R_40 = 40, R_CENTRE = 10;
  const cy = H / 2; // 45 — vertical centre

  let svgEl: SVGSVGElement;

  // Map SVG click → normalised stored coords
  function getPoint(evt: MouseEvent) {
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
  function handleClick(e: MouseEvent) {
    const pos = getPoint(e);
    if (contestType === 'break') {
      if (!awaitingPickup) { awaitingPickup = true;  dispatch('landed', pos); }
      else                 { awaitingPickup = false; dispatch('picked', pos); }
    } else { awaitingPickup = false; dispatch('landed', pos); }
  }

  // Keyboard crosshair — kb in normalised coords (x=side, y=depth)
  let kb = { x: 0.5, y: 0.5 };
  function handleKeydown(e: KeyboardEvent) {
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

  function arcPath(acx: number, acy: number, r: number, a0: number, a1: number) {
    const sx = acx + r * Math.cos(a0), sy = acy + r * Math.sin(a0);
    const ex = acx + r * Math.cos(a1), ey = acy + r * Math.sin(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`;
  }

  // D arcs — centred on the goal line (x=0 and x=W), R=13m, curving into the field
  const pathDLeft  = () => arcPath(0, cy, R_D, -Math.PI / 2,  Math.PI / 2);
  const pathDRight = () => arcPath(W, cy, R_D,  -Math.PI / 2,  Math.PI / 2);

  // 40m arcs — same centre, R=40m, curving into the field
  const path40Left  = () => arcPath(0, cy, R_40, -Math.PI / 2,  Math.PI / 2);
  const path40Right = () => arcPath(W, cy, R_40,  -Math.PI / 2,  Math.PI / 2);

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

  const SZ = 2.0;

  function markerShape(o: any): string {
    const sx = svgX(o), sy = svgY(o);
    const col = outcomeColor(o.outcome);
    const t = String(o.contest_type || 'clean');
    const ws = 'rgba(255,255,255,0.75)'; // white stroke
    const ring = o.at_target
      ? `<circle cx="${sx}" cy="${sy}" r="${SZ * 1.55}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="0.7" vector-effect="non-scaling-stroke"/>`
      : '';
    if (t === 'break')
      return `<polygon points="${sx},${sy-SZ} ${sx-SZ*.9},${sy+SZ*.7} ${sx+SZ*.9},${sy+SZ*.7}" fill="${col}" stroke="${ws}" stroke-width="0.55" vector-effect="non-scaling-stroke"/>${ring}`;
    if (t === 'foul')
      return `<polygon points="${sx},${sy-SZ} ${sx-SZ},${sy} ${sx},${sy+SZ} ${sx+SZ},${sy}" fill="${col}" stroke="${ws}" stroke-width="0.55" vector-effect="non-scaling-stroke"/>${ring}`;
    if (t === 'out') {
      const r = SZ * .88;
      return `<rect x="${sx-r}" y="${sy-r}" width="${2*r}" height="${2*r}" fill="${col}" stroke="${ws}" stroke-width="0.55" vector-effect="non-scaling-stroke"/>${ring}`;
    }
    return `<circle cx="${sx}" cy="${sy}" r="${SZ*.92}" fill="${col}" stroke="${ws}" stroke-width="0.55" vector-effect="non-scaling-stroke"/>${ring}`;
  }
</script>

<style>
  svg {
    touch-action: manipulation; user-select: none;
    display: block; width: 100%; flex: 1; min-height: 0; cursor: crosshair;
  }
  :global(.zlabel) { font-size: 3px; fill: rgba(255,255,255,0.55); pointer-events: none; font-weight: 700; }
  .zone-legend {
    display: flex; gap: 12px; justify-content: center;
    font-size: 10px; color: #6b7280; padding: 4px 0;
    flex-shrink: 0;
  }
</style>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svgEl}
  viewBox="0 0 145 90"
  role="application"
  aria-label="GAA pitch — tap or use arrow keys to set a point"
  tabindex="0"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
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
  {#each [L13, L20, L45, L65] as d}
    <line x1={d}   y1="0" x2={d}   y2={H}
      stroke={d === L65 ? 'rgba(255,255,255,0.22)' : d === L13 ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.72)'}
      stroke-width={d === L65 ? '0.55' : '0.9'}
      stroke-dasharray={d === L65 ? '3 3' : 'none'}
      vector-effect="non-scaling-stroke" />
    <line x1={W-d} y1="0" x2={W-d} y2={H}
      stroke={d === L65 ? 'rgba(255,255,255,0.22)' : d === L13 ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.72)'}
      stroke-width={d === L65 ? '0.55' : '0.9'}
      stroke-dasharray={d === L65 ? '3 3' : 'none'}
      vector-effect="non-scaling-stroke" />
  {/each}

  <!-- centre circle -->
  <circle cx={W/2} cy={cy} r={R_CENTRE}
    fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="1.0"
    vector-effect="non-scaling-stroke" />
  <!-- centre spot -->
  <circle cx={W/2} cy={cy} r="0.8"
    fill="rgba(255,255,255,0.72)" vector-effect="non-scaling-stroke" />

  <!-- goal small rectangles (parallelograms) — left and right ends -->
  <rect x="0" y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
    fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.88)" stroke-width="1.0"
    vector-effect="non-scaling-stroke" />
  <rect x={W - SMALL_D} y={cy - SMALL_W/2} width={SMALL_D} height={SMALL_W}
    fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.88)" stroke-width="1.0"
    vector-effect="non-scaling-stroke" />

  <!-- 40m arcs — centred on goal line, R=40m -->
  <path d={path40Left()}  fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="0.9" vector-effect="non-scaling-stroke" />
  <path d={path40Right()} fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="0.9" vector-effect="non-scaling-stroke" />

  <!-- D arcs — centred on goal line, R=13m -->
  <path d={pathDLeft()}  fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.0" vector-effect="non-scaling-stroke" />
  <path d={pathDRight()} fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.0" vector-effect="non-scaling-stroke" />

  <!-- overlays -->
  <g style="pointer-events:none">
    {@html overlays.map(o => markerShape(o)).join('')}
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

{#if showZoneLabels}
  <div class="zone-legend">
    <span>L / C / R — side band</span>
    <span>20 / 45 / 65 — metres from goal</span>
  </div>
{/if}
