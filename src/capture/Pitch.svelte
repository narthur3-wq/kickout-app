<script>
  import { createEventDispatcher } from 'svelte';

  // overlays: [{ x,y, ct:'clean'|'break'|'foul'|'out', side:'us'|'opp', win:boolean }]
  export let overlays = [];
  export let landing = { x: NaN, y: NaN };
  export let goalLeft = true; // orientation indicator

  // Landscape geometry (metres)
  const W = 145, H = 90, CY = H/2;

  // Rectangles (height across Y, depth along X)
  const SMALL_W = 14, SMALL_D = 4.5;
  const LARGE_W = 19, LARGE_D = 13;

  // Distances
  const L21 = 21;          // UAT: D arc off 21 m line
  const R_D = 13;          // D radius
  const L20 = 20, L45 = 45;
  const R40 = 40;          // 40 m arc

  // Palette
  const COLOR_TURF   = '#C8E6C9';
  const COLOR_LINE   = '#ffffff';
  const COLOR_GRID   = 'rgba(255,255,255,.25)';
  const COLOR_BORDER = '#0c7357';

  // Markers
  const RING_US  = '#2563eb';
  const RING_OPP = '#f59e0b';
  const FILL_WIN = '#1B5E20';
  const FILL_LOS = '#ef4444';
  const TXT      = '#fff';

  const dispatch = createEventDispatcher();
  let svgEl;

  function clientToNorm(evt){
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    return { x: Math.max(0, Math.min(1, p.x / W)), y: Math.max(0, Math.min(1, p.y / H)) };
  }
  const onClick = (e)=> dispatch('landed', clientToNorm(e));

  const ring = (s)=> s==='us' ? RING_US : RING_OPP;
  const letter = (ct)=> ({clean:'C', break:'B', foul:'F', out:'S'})[ct] || '?';
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {W} {H}"
  preserveAspectRatio="xMidYMid meet"
  role="button" tabindex="0"
  on:click={onClick}
  on:keydown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onClick(e); } }}
  style="width:100%; height:auto; max-height:62vh; display:block; border-radius:12px; background:{COLOR_TURF}; cursor:crosshair"
>
  <!-- turf -->
  <rect x="0" y="0" width={W} height={H} fill={COLOR_TURF} />

  <!-- touchlines -->
  <rect x="0.3" y="0.3" width={W-0.6} height={H-0.6}
        fill="none" stroke={COLOR_LINE} stroke-width="1.4"
        vector-effect="non-scaling-stroke" stroke-linecap="round" />

  <!-- thirds -->
  <line x1={W/3}   y1="0" x2={W/3}   y2={H} stroke={COLOR_GRID} stroke-width="1.0" vector-effect="non-scaling-stroke" />
  <line x1={2*W/3} y1="0" x2={2*W/3} y2={H} stroke={COLOR_GRID} stroke-width="1.0" vector-effect="non-scaling-stroke" />

  <!-- halfway -->
  <line x1={W/2} y1="0" x2={W/2} y2={H} stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />

  <!-- 20 / 45 from both ends -->
  <line x1={L20}     y1="0" x2={L20}     y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />
  <line x1={L45}     y1="0" x2={L45}     y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />
  <line x1={W-L20}   y1="0" x2={W-L20}   y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />
  <line x1={W-L45}   y1="0" x2={W-L45}   y2={H} stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />

  <!-- rectangles -->
  <rect x="0"         y={CY-LARGE_W/2} width={LARGE_D} height={LARGE_W} fill="none" stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />
  <rect x="0"         y={CY-SMALL_W/2} width={SMALL_D} height={SMALL_W} fill="none" stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />
  <rect x={W-LARGE_D} y={CY-LARGE_W/2} width={LARGE_D} height={LARGE_W} fill="none" stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />
  <rect x={W-SMALL_D} y={CY-SMALL_W/2} width={SMALL_D} height={SMALL_W} fill="none" stroke={COLOR_LINE} stroke-width="1.4" vector-effect="non-scaling-stroke" />

  <!-- D arcs off 21 m line (UAT) -->
  <path d={`M ${L21} ${CY-R_D} A ${R_D} ${R_D} 0 0 1 ${L21} ${CY+R_D}`}   fill="none" stroke={COLOR_LINE} stroke-width="1.3" vector-effect="non-scaling-stroke" />
  <path d={`M ${W-L21} ${CY-R_D} A ${R_D} ${R_D} 0 0 0 ${W-L21} ${CY+R_D}`} fill="none" stroke={COLOR_LINE} stroke-width="1.3" vector-effect="non-scaling-stroke" />

  <!-- 40 m arcs -->
  <path d={`M 0 ${CY-R40} A ${R40} ${R40} 0 0 1 0 ${CY+R40}`}   fill="none" stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />
  <path d={`M ${W} ${CY-R40} A ${R40} ${R40} 0 0 0 ${W} ${CY+R40}`} fill="none" stroke={COLOR_LINE} stroke-width="1.1" vector-effect="non-scaling-stroke" />

  <!-- markers -->
  {#each overlays as o}
    <g transform={`translate(${o.x*W} ${o.y*H})`}>
      <circle r="2.6" fill={o.win ? FILL_WIN : FILL_LOS} stroke={ring(o.side)} stroke-width="1.4" vector-effect="non-scaling-stroke" />
      <text y="1.0" text-anchor="middle" font-size="2.6" font-weight="900" fill={TXT}>{letter(o.ct)}</text>
      <title>{o.side==='us'?'Us':'Opp'} · {o.ct} · {o.win?'Win':'Loss'}</title>
    </g>
  {/each}

  <!-- tap preview -->
  {#if !Number.isNaN(landing.x)}
    <g transform={`translate(${landing.x*W} ${landing.y*H})`}>
      <circle r="2.2" fill="#2563EB" stroke="white" stroke-width="1.0" vector-effect="non-scaling-stroke" />
    </g>
  {/if}

  <!-- orientation badge -->
  <g transform="translate(4 6)">
    <rect rx="2.5" ry="2.5" width="34" height="8" fill="white" stroke="#e5e7eb" stroke-width="0.6"/>
    <text x="17" y="5.5" text-anchor="middle" font-size="3.2" fill="#111827">{goalLeft ? '← Our Kick' : 'Our Kick →'}</text>
  </g>
</svg>
