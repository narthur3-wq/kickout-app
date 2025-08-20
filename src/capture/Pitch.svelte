<script>
  import { createEventDispatcher } from 'svelte';

  export let contestType = 'clean';   // 'clean' | 'break' | 'foul' | 'out'
  export let landing = {x: NaN, y: NaN};
  export let pickup  = {x: NaN, y: NaN};
  export let overlays = [];           // [{x,y,outcome,contest_type,target}]

  const W = 90, H = 145;  // metres
  const CX = W/2;
  const SMALL_W=14, SMALL_D=4.5, LARGE_W=19, LARGE_D=13;
  const R_D=13, R_40=40;

  const dispatch = createEventDispatcher();
  let svgEl;

  function clientToNorm(evt){
    const rect = svgEl.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top)  / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  function onClick(e){
    const p = clientToNorm(e);
    const hasLanding = Number.isFinite(landing.x) && Number.isFinite(landing.y);
    const hasPickup = Number.isFinite(pickup.x) && Number.isFinite(pickup.y);
    if (!hasLanding) {
      dispatch('landed', p);
    } else if (contestType === 'break' && !hasPickup) {
      dispatch('picked', p);
    } else {
      // restart
      dispatch('landed', p);
      dispatch('picked', {x: NaN, y: NaN});
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg bind:this={svgEl} tabindex="0" viewBox="0 0 {W} {H}" on:click={onClick}
     style="width:100%; background:var(--pitch); border:1px solid var(--border); border-radius:6px">
  <!-- grid lines -->
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
    <rect x={CX-LARGE_W/2} y="0" width={LARGE_W} height={LARGE_D} />
    <rect x={CX-SMALL_W/2} y="0" width={SMALL_W} height={SMALL_D} />
    <rect x={CX-LARGE_W/2} y={H-LARGE_D} width={LARGE_W} height={LARGE_D} />
    <rect x={CX-SMALL_W/2} y={H-SMALL_D} width={SMALL_W} height={SMALL_D} />
  </g>

  <!-- 13m D arcs -->
  <g stroke="#444" stroke-width="0.7" fill="none">
    <path d="M {CX-R_D} 20 A {R_D} {R_D} 0 0 0 {CX+R_D} 20" />
    <path d="M {CX-R_D} {H-20} A {R_D} {R_D} 0 0 1 {CX+R_D} {H-20}" />
  </g>

  <!-- 40m dashed arcs -->
  <g stroke="#666" stroke-width="0.6" stroke-dasharray="3 3" fill="none">
    <path d="M {CX-R_40} 0 A {R_40} {R_40} 0 0 0 {CX+R_40} 0" />
    <path d="M {CX-R_40} {H} A {R_40} {R_40} 0 0 1 {CX+R_40} {H}" />
  </g>

  <!-- overlays -->
  {#each overlays as o (o)}
    <circle cx={o.x*W} cy={o.y*H} r="1.3" fill="hsl(160 60% 35%)" opacity="0.9">
      <title>{o.target ? `${o.target} — ` : ''}{o.outcome} ({o.contest_type})</title>
    </circle>
  {/each}

  <!-- active markers -->
  {#if Number.isNaN(landing.x) === false}
    <circle cx={landing.x*W} cy={landing.y*H} r="1.8" fill="#0a5" />
  {/if}
  {#if contestType==='break' && Number.isNaN(pickup.x) === false}
    <circle cx={pickup.x*W} cy={pickup.y*H} r="1.8" fill="#222" />
    <line x1={landing.x*W} y1={landing.y*H} x2={pickup.x*W} y2={pickup.y*H} stroke="#222" stroke-width="0.6" />
  {/if}
</svg>
