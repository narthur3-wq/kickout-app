<script>
  import { createEventDispatcher } from 'svelte';

  /**
   * overlays: Array<{
   *   x:number, y:number,               // 0..1 normalised
   *   ct:'clean'|'break'|'foul'|'out',  // contest type
   *   side:'us'|'opp',
   *   win:boolean,
   *   idx?:number                       // recency label (1..N)
   * }>
   */
  export let overlays = [];
  export let landing = { x: NaN, y: NaN }; // current tap preview
  export let showLabels = true;

  // Pitch geometry (metres)
  const W = 90, H = 145;
  const CX = W / 2;
  const SMALL_W = 14, SMALL_D = 4.5, LARGE_W = 19, LARGE_D = 13;
  const R_D = 13, R_40 = 40;

  const dispatch = createEventDispatcher();
  let svgEl;

  function clientToNorm(evt){
    const rect = svgEl.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  function onClick(e){ dispatch('landed', clientToNorm(e)); }

  const RING_US = '#2563eb';   // blue ring for Us
  const RING_OPP = '#f59e0b';  // amber ring for Opposition
  const strokeForSide = s => s === 'us' ? RING_US : RING_OPP;
  const fillForWin = win => win ? '#10b981' : '#ef4444'; // green win / red loss

  function triPath(cx, cy, r){
    return `M ${cx} ${cy - r} L ${cx - r} ${cy + r/2} L ${cx + r} ${cy + r/2} Z`;
  }
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {W} {H}"
  role="button"
  tabindex="0"
  on:click={onClick}
  on:keydown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onClick(e); } }}
  style="width:100%; background:var(--pitch); border:1px solid var(--border); border-radius:6px"
>
  <!-- vertical thirds + horizontal guides -->
  <g stroke="var(--grid)" stroke-width="0.3">
    <line x1={W/3} y1="0" x2={W/3} y2={H} />
    <line x1={2*W/3} y1="0" x2={2*W/3} y2={H} />
    {#each [13,20,45,65,H/2,H-65,H-45,H-20,H-13] as m}
      <line x1="0" y1={m} x2={W} y2={m} />
    {/each}
  </g>

  <!-- halfway -->
  <line x1="0" y1={H/2} x2={W} y2={H/2} stroke="#111" stroke-width="0.6" />

  <!-- rectangles -->
  <g stroke="#222" stroke-width="0.6" fill="none">
    <rect x={CX-LARGE_W/2} y="0"             width={LARGE_W} height={LARGE_D} />
    <rect x={CX-SMALL_W/2} y="0"             width={SMALL_W} height={SMALL_D} />
    <rect x={CX-LARGE_W/2} y={H-LARGE_D}     width={LARGE_W} height={LARGE_D} />
    <rect x={CX-SMALL_W/2} y={H-SMALL_D}     width={SMALL_W} height={SMALL_D} />
  </g>

  <!-- 13m D arcs -->
  <g stroke="#444" stroke-width="0.7" fill="none">
    <path d={`M ${CX-R_D} 20 A ${R_D} ${R_D} 0 0 0 ${CX+R_D} 20`} />
    <path d={`M ${CX-R_D} ${H-20} A ${R_D} ${R_D} 0 0 1 ${CX+R_D} ${H-20}`} />
  </g>

  <!-- 40m dashed arcs -->
  <g stroke="#666" stroke-width="0.6" stroke-dasharray="3 3" fill="none">
    <path d={`M ${CX-R_40} 0 A ${R_40} ${R_40} 0 0 0 ${CX+R_40} 0`} />
    <path d={`M ${CX-R_40} ${H} A ${R_40} ${R_40} 0 0 1 ${CX+R_40} ${H}`} />
  </g>

  <!-- overlays -->
  {#each overlays as o}
    {#if o.ct === 'clean'}
      <circle cx={o.x*W} cy={o.y*H} r="1.7" fill={fillForWin(o.win)} stroke={strokeForSide(o.side)} stroke-width="0.5">
        <title>{o.side==='us'?'Us':'Opp'} · Clean · {o.win?'Win':'Loss'}</title>
      </circle>
    {:else if o.ct === 'break'}
      <rect x={o.x*W-1.4} y={o.y*H-1.4} width="2.8" height="2.8"
            transform={`rotate(45 ${o.x*W} ${o.y*H})`} fill={fillForWin(o.win)}
            stroke={strokeForSide(o.side)} stroke-width="0.5">
        <title>{o.side==='us'?'Us':'Opp'} · Break · {o.win?'Win':'Loss'}</title>
      </rect>
    {:else if o.ct === 'out'}
      <rect x={o.x*W-1.5} y={o.y*H-1.5} width="3" height="3" fill={fillForWin(o.win)}
            stroke={strokeForSide(o.side)} stroke-width="0.5">
        <title>{o.side==='us'?'Us':'Opp'} · Sideline · {o.win?'Win':'Loss'}</title>
      </rect>
    {:else if o.ct === 'foul'}
      <path d={triPath(o.x*W, o.y*H, 1.8)} fill={fillForWin(o.win)} stroke={strokeForSide(o.side)} stroke-width="0.5">
        <title>{o.side==='us'?'Us':'Opp'} · Foul · {o.win?'Win':'Loss'}</title>
      </path>
    {/if}
    {#if showLabels && o.idx}
      <text x={o.x*W} y={o.y*H+0.9} text-anchor="middle" font-size="2.6" fill="#fff" stroke="#111" stroke-width="0.2">{o.idx}</text>
    {/if}
  {/each}

  <!-- active tap preview -->
  {#if Number.isNaN(landing.x) === false}
    <circle cx={landing.x*W} cy={landing.y*H} r="2.1" fill="#0a5" />
  {/if}
</svg>
