<script>
  import { createEventDispatcher } from 'svelte';

  // overlays: [{ x,y, ct:'clean'|'break'|'foul'|'out', side:'us'|'opp', win:boolean, idx?:number }]
  export let overlays = [];
  export let landing = { x: NaN, y: NaN };
  export let showLabels = true;

  // Landscape geometry (metres)
  const W = 145;  // length (left<->right)
  const H = 90;   // width  (top<->bottom)
  const CY = H / 2;

  // Rectangles (width across Y, depth along X)
  const SMALL_W = 14, SMALL_D = 4.5;
  const LARGE_W = 19, LARGE_D = 13;

  // Lines/distances
  const R_D = 13;
  const L13 = 13, L20 = 20, L45 = 45;

  // Palette
  const COLOR_TURF      = '#06834d';
  const COLOR_LINE      = '#ffffff';
  const COLOR_GRID      = 'rgba(255,255,255,.22)';
  const COLOR_BORDER    = '#064e3b';
  const COLOR_RING_US   = '#2563eb';
  const COLOR_RING_OPP  = '#f59e0b';
  const COLOR_WIN       = '#16a34a';
  const COLOR_LOSS      = '#ef4444';
  const COLOR_MARK_FILL = '#ffffff';

  const dispatch = createEventDispatcher();
  let svgEl;

  // robust: convert client coords -> SVG coords using CTM (fixes any offset/scale/borders)
  function clientToNorm(evt){
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const inv = svgEl.getScreenCTM().inverse();
    const p = pt.matrixTransform(inv);      // now in SVG units (same as viewBox)
    return {
      x: Math.max(0, Math.min(1, p.x / W)),
      y: Math.max(0, Math.min(1, p.y / H)),
    };
  }
  const onClick = (e) => dispatch('landed', clientToNorm(e));
  const ringForSide = s => s === 'us' ? COLOR_RING_US : COLOR_RING_OPP;

  function triPath(cx, cy, r){
    return `M ${cx} ${cy - r} L ${cx - r} ${cy + r/2} L ${cx + r} ${cy + r/2} Z`;
  }
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {W} {H}"
  preserveAspectRatio="xMidYMid meet"
  role="button"
  tabindex="0"
  on:click={onClick}
  on:keydown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onClick(e); } }}
  style="width:100%; height:auto; max-height:58vh; display:block; border:1px solid {COLOR_BORDER}; border-radius:12px; background:{COLOR_TURF}; cursor:crosshair"
>
  <!-- turf -->
  <rect x="0" y="0" width={W} height={H} fill={COLOR_TURF} rx="2" ry="2" />

  <!-- outer touchlines -->
  <rect x="0.6" y="0.6" width={W-1.2} height={H-1.2}
        fill="none" stroke={COLOR_LINE} stroke-width="1.4"
        vector-effect="non-scaling-stroke" stroke-linecap="round" />

  <!-- thirds (vertical, faint) -->
  <line x1={W/3}   y1="0" x2={W/3}   y2={H} stroke={COLOR_GRID} stroke-width="0.9" vector-effect="non-scaling-stroke" />
  <line x1={2*W/3} y1="0" x2={2*W/3} y2={H} stroke={COLOR_GRID} stroke-width="0.9" vector-effect="non-scaling-stroke" />

  <!-- halfway (vertical) -->
  <line x1={W/2} y1="0" x2={W/2} y2={H} stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />

  <!-- 13 / 20 / 45 from LEFT -->
  <line x1={L13} y1="0" x2={L13} y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />
  <line x1={L20} y1="0" x2={L20} y2={H} stroke={COLOR_LINE} stroke-width="0.9" vector-effect="non-scaling-stroke" />
  <line x1={L45} y1="0" x2={L45} y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />

  <!-- 13 / 20 / 45 from RIGHT -->
  <line x1={W-L13} y1="0" x2={W-L13} y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />
  <line x1={W-L20} y1="0" x2={W-L20} y2={H} stroke={COLOR_LINE} stroke-width="0.9" vector-effect="non-scaling-stroke" />
  <line x1={W-L45} y1="0" x2={W-L45} y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />

  <!-- rectangles (left & right ends) -->
  <rect x="0"           y={CY-LARGE_W/2} width={LARGE_D} height={LARGE_W} fill="none"
        stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />
  <rect x="0"           y={CY-SMALL_W/2} width={SMALL_D} height={SMALL_W} fill="none"
        stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />
  <rect x={W-LARGE_D}   y={CY-LARGE_W/2} width={LARGE_D} height={LARGE_W} fill="none"
        stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />
  <rect x={W-SMALL_D}   y={CY-SMALL_W/2} width={SMALL_D} height={SMALL_W} fill="none"
        stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />

  <!-- D arcs at 13m -->
  <path d={`M ${L13} ${CY-R_D} A ${R_D} ${R_D} 0 0 1 ${L13} ${CY+R_D}`}
        fill="none" stroke={COLOR_LINE} stroke-width="1.3" vector-effect="non-scaling-stroke" />
  <path d={`M ${W-L13} ${CY-R_D} A ${R_D} ${R_D} 0 0 0 ${W-L13} ${CY+R_D}`}
        fill="none" stroke={COLOR_LINE} stroke-width="1.3" vector-effect="non-scaling-stroke" />

  <!-- overlays -->
  {#each overlays as o}
    {#if o.ct === 'clean'}
      <circle cx={o.x*W} cy={o.y*H} r="2.1" fill={COLOR_MARK_FILL}
              stroke={ringForSide(o.side)} stroke-width="1.2" vector-effect="non-scaling-stroke" />
      <circle cx={o.x*W} cy={o.y*H} r="0.8" fill={o.win ? COLOR_WIN : COLOR_LOSS} />
    {:else if o.ct === 'break'}
      <rect x={o.x*W-1.8} y={o.y*H-1.8} width="3.6" height="3.6"
            transform={`rotate(45 ${o.x*W} ${o.y*H})`} fill={COLOR_MARK_FILL}
            stroke={ringForSide(o.side)} stroke-width="1.2" vector-effect="non-scaling-stroke" />
      <circle cx={o.x*W} cy={o.y*H} r="0.8" fill={o.win ? COLOR_WIN : COLOR_LOSS} />
    {:else if o.ct === 'out'}
      <rect x={o.x*W-1.9} y={o.y*H-1.9} width="3.8" height="3.8" fill={COLOR_MARK_FILL}
            stroke={ringForSide(o.side)} stroke-width="1.2" vector-effect="non-scaling-stroke" />
      <circle cx={o.x*W} cy={o.y*H} r="0.8" fill={o.win ? COLOR_WIN : COLOR_LOSS} />
    {:else if o.ct === 'foul'}
      <path d={triPath(o.x*W, o.y*H, 2.2)} fill={COLOR_MARK_FILL}
            stroke={ringForSide(o.side)} stroke-width="1.2" vector-effect="non-scaling-stroke" />
      <circle cx={o.x*W} cy={o.y*H+0.8} r="0.8" fill={o.win ? COLOR_WIN : COLOR_LOSS} />
    {/if}

    {#if showLabels && o.idx}
      <text x={o.x*W} y={o.y*H+3.6} text-anchor="middle"
            font-size="3.4" fill="#111" stroke="#fff" stroke-width="0.5">{o.idx}</text>
    {/if}
  {/each}

  <!-- tap preview -->
  {#if !Number.isNaN(landing.x)}
    <circle cx={landing.x*W} cy={landing.y*H} r="2.2" fill="#22c55e" />
  {/if}
</svg>
