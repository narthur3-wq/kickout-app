<script>
  import { createEventDispatcher, onMount } from 'svelte';

  /** @type {'clean'|'break'|'foul'|'out'} */ export let contestType='clean';
  /** @type {{x:number,y:number}} */ export let landing={x:NaN,y:NaN};
  /** @type {{x:number,y:number}} */ export let pickup={x:NaN,y:NaN};

  const dispatch = createEventDispatcher();
  let svgEl;

  // Constants for markings (in metres)
  const LENGTH_M = 145;
  const M21 = 21, M45 = 45;    // distance from each end line
  const ARC_R = 13;            // semicircle radius (commonly ~13m near goals)

  // Helpers
  function toNorm(evt) {
    const r = svgEl.getBoundingClientRect();
    const x = Math.min(Math.max(0, (evt.clientX - r.left) / r.width), 1);
    const y = Math.min(Math.max(0, (evt.clientY - r.top) / r.height), 1);
    return { x, y };
  }
  function handlePrimary(p) {
    if (Number.isNaN(landing.x) || Number.isNaN(landing.y) || contestType!=='break') {
      dispatch('landed', p);
    } else {
      dispatch('picked', p);
    }
  }
  function handleClick(evt){ handlePrimary(toNorm(evt)); }
  function handlePointer(evt){ if (evt.pointerType!=='mouse' || evt.button===0) handlePrimary(toNorm(evt)); }
  function handleContext(evt){ evt.preventDefault(); if (contestType==='break') dispatch('picked', toNorm(evt)); }

  onMount(()=>{ svgEl?.setAttribute('tabindex','0'); });

  // Convert metres from end line to y in viewBox (0..100)
  const my = (m)=> (m / LENGTH_M) * 100;
  const y21 = my(M21), y45 = my(M45), y21b = 100 - y21, y45b = 100 - y45;
  const rArc = my(ARC_R);

  // Arc paths (top and bottom), centered on goal line mid (x=50, y≈0/100)
  const arcTop = `M ${50 - rArc},0 A ${rArc},${rArc} 0 0 1 ${50 + rArc},0`;
  const arcBot = `M ${50 - rArc},100 A ${rArc},${rArc} 0 0 0 ${50 + rArc},100`;
</script>

<div class="w-full h-full">
  <svg
    bind:this={svgEl}
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="Pitch. Click to set landing; in a break, click again or right-click to set pickup."
    class="h-full w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-emerald-50/40 dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-sky-400"
    on:click={handleClick}
    on:pointerdown|preventDefault={handlePointer}
    on:contextmenu|preventDefault={handleContext}
  >
    <!-- subtle grid -->
    <defs>
      <pattern id="g" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M10 0H0V10" fill="none" stroke="#94a3b855" stroke-width="0.4"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="100" height="100" fill="url(#g)"/>

    <!-- sidelines / end lines -->
    <rect x="0" y="0" width="100" height="100" fill="none" stroke="#334155" stroke-width="0.7" opacity="0.45"/>

    <!-- halfway -->
    <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" stroke-width="0.6" opacity="0.45"/>

    <!-- 21 / 45 from both ends -->
    <line x1="0" y1={y21} x2="100" y2={y21} stroke="#334155" stroke-width="0.5" opacity="0.45"/>
    <line x1="0" y1={y45} x2="100" y2={y45} stroke="#334155" stroke-width="0.5" opacity="0.45"/>
    <line x1="0" y1={y21b} x2="100" y2={y21b} stroke="#334155" stroke-width="0.5" opacity="0.45"/>
    <line x1="0" y1={y45b} x2="100" y2={y45b} stroke="#334155" stroke-width="0.5" opacity="0.45"/>

    <!-- goal rectangles -->
    <rect x="40" y="1.5"  width="20" height="2" fill="#111827AA" rx="0.2"/>
    <rect x="40" y="96.5" width="20" height="2" fill="#111827AA" rx="0.2"/>

    <!-- arcs near goals -->
    <path d={arcTop} stroke="#334155" stroke-width="0.6" fill="none" opacity="0.5"/>
    <path d={arcBot} stroke="#334155" stroke-width="0.6" fill="none" opacity="0.5"/>

    <!-- markers -->
    {#if !Number.isNaN(landing.x) && !Number.isNaN(landing.y)}
      <circle cx={landing.x*100} cy={landing.y*100} r="2.2" fill="#0ea5e9" opacity="0.95"/>
      <circle cx={landing.x*100} cy={landing.y*100} r="4" fill="none" stroke="#0ea5e9" stroke-width="0.8" opacity="0.6"/>
    {/if}
    {#if contestType==='break' && !Number.isNaN(pickup.x) && !Number.isNaN(pickup.y)}
      <g transform={`translate(${pickup.x*100}, ${pickup.y*100})`}>
        <line x1="-2.2" y1="-2.2" x2="2.2" y2="2.2" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="-2.2" y1="2.2"  x2="2.2" y2="-2.2" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>
      </g>
    {/if}

    <text x="2" y="97" font-size="3" fill="#334155AA">
      {contestType==='break' ? 'Click to set landing, click/right-click for pickup' : 'Click to set landing'}
    </text>
  </svg>
</div>
