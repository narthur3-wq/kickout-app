# File: src/lib/Pitch.svelte
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { ui } from './stores';
  import { toMeters, bandsFrom, depthFromOwnGoal, displacement } from './pitch-geometry';

  const dispatch = createEventDispatcher();

  export let width = 700; // responsive container will scale this via CSS
  export let ourGoalAtTop = true;
  export let contest_type = 'clean'; // used to decide if pickup is captured
  export let draft = null; // { landing: {x,y}, pickup: {x,y} }

  let bbox; // svg bounding box
  let svgEl;

  function norm(evt) {
    const pt = svgEl.createSVGPoint();
    const isTouch = evt.touches && evt.touches.length;
    const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
    const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
    pt.x = clientX; pt.y = clientY;
    const ctm = svgEl.getScreenCTM().inverse();
    const { x, y } = pt.matrixTransform(ctm);
    const nx = Math.min(1, Math.max(0, (x - 20) / (bbox.width - 40))); // 20px side padding
    const ny = Math.min(1, Math.max(0, (y - 20) / (bbox.height - 40)));
    return { x: nx, y: ny };
  }

  function handlePrimary(evt) {
    evt.preventDefault();
    const p = norm(evt);
    const { x_m, y_m } = toMeters(p.x, p.y);
    const bands = bandsFrom(p.x, p.y);
    const depth = depthFromOwnGoal(p.y, ourGoalAtTop);
    const landing = { ...p, ...bands, ...{ x_m, y_m, depth_from_own_goal_m: depth } };
    dispatch('landing', { landing });
  }

  function handleSecondary(evt) {
    if (contest_type !== 'break') return; // only capture pickup when break
    evt.preventDefault();
    const pick = norm(evt);
    dispatch('pickup', { pickup: pick });
  }

  onMount(() => {
    bbox = svgEl.getBBox();
  });
</script>

<div class="pitch-wrap">
  <svg bind:this={svgEl} viewBox="0 0 900 1450" class="pitch"
       on:click={handlePrimary}
       on:contextmenu|preventDefault={handleSecondary}
       on:touchstart={handlePrimary}
       on:touchend|preventDefault={() => { /* no-op to stop ghost click */ }}>
    <!-- safe clickable margin -->
    <rect x="20" y="20" width="860" height="1410" fill="#f7f9fb" stroke="#cfd8e3" rx="16" />

    <!-- halfway line -->
    <line x1="20" x2="880" y1="745" y2="745" stroke="#cfd8e3" stroke-width="4" />

    <!-- simple goals at top/bottom -->
    <rect x="400" y="20" width="100" height="20" fill="#cfd8e3" />
    <rect x="400" y="1410" width="100" height="20" fill="#cfd8e3" />

    <!-- zone guides (thirds & quarters) -->
    {#each [1,2] as i}
      <line x1={20 + i*860/3} x2={20 + i*860/3} y1="20" y2="1430" stroke="#e5e7eb" stroke-dasharray="6 6" />
    {/each}
    {#each [0.22,0.45,0.72].map(d => 20 + d*1410) as y}
      <line x1="20" x2="880" {y1}={y} {y2}={y} stroke="#e5e7eb" stroke-dasharray="6 6" />
    {/each}

    <!-- markers -->
    {#if draft?.landing}
      <circle cx={20 + draft.landing.x*860} cy={20 + draft.landing.y*1410} r="10" fill="#1f7aec" />
    {/if}
    {#if draft?.pickup}
      <circle cx={20 + draft.pickup.x*860} cy={20 + draft.pickup.y*1410} r="10" fill="#10b981" />
      <line x1={20 + draft.landing.x*860} y1={20 + draft.landing.y*1410}
            x2={20 + draft.pickup.x*860}  y2={20 + draft.pickup.y*1410}
            stroke="#10b981" stroke-width="3" />
    {/if}
  </svg>

  <div class="legend">
    <span class="dot blue"></span> Landing
    <span class="dot green"></span> Pickup (breaks only)
  </div>
</div>

<style>
  .pitch-wrap { width: 100%; }
  .pitch { width: 100%; height: auto; touch-action: manipulation; user-select: none; border-radius: 14px; background: white; }
  .legend { margin-top: .5rem; display: flex; gap: 1rem; font-size: .9rem; color: #475569; }
  .dot { width: .75rem; height: .75rem; border-radius: 999px; display: inline-block; }
  .dot.blue { background: #1f7aec; }
  .dot.green { background: #10b981; }
</style>
