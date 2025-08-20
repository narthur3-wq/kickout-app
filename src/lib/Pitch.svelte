<script>
  import { createEventDispatcher, onMount } from 'svelte';

  /** Contest type controls whether we expect a pickup point after landing */
  export let contestType = /** @type {'clean'|'break'|'foul'|'out'} */ ('clean');

  /** Landing & pickup points as normalized coords (0..1); NaN means unset */
  export let landing = { x: NaN, y: NaN };
  export let pickup  = { x: NaN, y: NaN };

  /**
   * Overlays to draw on the pitch (e.g., prior events / heat points)
   * items: { x:number (0..1), y:number (0..1), outcome?:string, contest_type?:string, target?:string }
   */
  export let overlays = /** @type {Array<{x:number,y:number,outcome?:string,contest_type?:string,target?:string}>} */ ([]);

  const W = 90;    // meters across
  const H = 145;   // meters long

  const dispatch = createEventDispatcher();

  let el;                 // clickable container (same element we measure)
  let bbox = { left:0, top:0, width:1, height:1 };

  function updateBox() {
    const r = el?.getBoundingClientRect?.();
    if (r) bbox = { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
  }

  onMount(() => {
    updateBox();
    const ro = new ResizeObserver(updateBox);
    ro.observe(el);
    const s = () => updateBox();
    window.addEventListener('scroll', s, true);
    return () => { ro.disconnect(); window.removeEventListener('scroll', s, true); };
  });

  function toNorm(clientX, clientY) {
    const nx = Math.min(1, Math.max(0, (clientX + window.scrollX - bbox.left) / bbox.width));
    const ny = Math.min(1, Math.max(0, (clientY + window.scrollY - bbox.top)  / bbox.height));
    return { x: nx, y: ny };
  }

  function onClick(ev) {
    const { x, y } = toNorm(ev.clientX, ev.clientY);
    if (contestType === 'break') {
      // if landing not set, set landing; else set pickup
      if (Number.isNaN(landing.x) || Number.isNaN(landing.y)) {
        dispatch('landed', { x, y });
      } else {
        dispatch('picked', { x, y });
      }
    } else {
      dispatch('landed', { x, y });
    }
  }

  function onKey(ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      // "Activate" at center if keyboard-activated
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      onClick({ clientX: cx, clientY: cy });
      ev.preventDefault();
    }
  }

  // helpers to display normalized points on SVG meters
  const nx = (n) => n * W;
  const ny = (n) => n * H;
  const isSet = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && !Number.isNaN(p.x) && !Number.isNaN(p.y);

  // simple color per outcome/contest
  function dotColor(pt) {
    if (pt.contest_type === 'break') return 'hsl(200 80% 45%)';
    if (pt.outcome === 'Score' || pt.outcome === 'Won' || pt.outcome === 'Retained') return 'hsl(140 70% 40%)';
    if (pt.outcome === 'Lost' || pt.outcome === 'Out' || pt.outcome === 'Foul') return 'hsl(0 70% 50%)';
    return 'hsl(220 10% 50%)';
  }
</script>

<!--
  Clickable container: maintain the *same* element for sizing/click mapping
  aspect ratio matches viewBox 90:145; rounded and bordered; keyboardable
-->
<div
  bind:this={el}
  class="relative w-full aspect-[90/145] rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden select-none"
  role="button"
  tabindex="0"
  aria-label="Pitch (click or press Enter/Space to place points)"
  onclick={onClick}
  onkeydown={onKey}
>
  <!-- SVG field: viewBox in meters -->
  <svg viewBox="0 0 90 145" class="absolute inset-0 w-full h-full text-neutral-400 dark:text-neutral-600">
    <!-- Grass stripes -->
    {#each Array.from({ length: 12 }) as _, i}
      <rect x="0" y={(i*H)/12} width="90" height={H/12} fill={i % 2 === 0 ? 'hsl(160 30% 94%)' : 'hsl(160 30% 98%)'} />
    {/each}

    <!-- Sidelines / endlines -->
    <rect x="0.5" y="0.5" width="89" height="144" fill="none" stroke="currentColor" stroke-width="1"/>

    <!-- Midline -->
    <line x1="0" y1={H/2} x2="90" y2={H/2} stroke="currentColor" stroke-width="0.8" />

    <!-- 21m / 45m lines from both ends -->
    <line x1="0" y1="21" x2="90" y2="21" stroke="currentColor" stroke-width="0.6" />
    <line x1="0" y1="45" x2="90" y2="45" stroke="currentColor" stroke-width="0.6" />
    <line x1="0" y1={H-21} x2="90" y2={H-21} stroke="currentColor" stroke-width="0.6" />
    <line x1="0" y1={H-45} x2="90" y2={H-45} stroke="currentColor" stroke-width="0.6" />

    <!-- D arcs (simple semicircles) near both goals -->
    <!-- Top arc -->
    <path d={`M ${W/2-13},21 A 13 13 0 0 1 ${W/2+13},21`} fill="none" stroke="currentColor" stroke-width="0.7" />
    <!-- Bottom arc -->
    <path d={`M ${W/2-13},${H-21} A 13 13 0 0 0 ${W/2+13},${H-21}`} fill="none" stroke="currentColor" stroke-width="0.7" />

    <!-- Goals (small thick bars) -->
    <rect x={W/2-5} y="0.5" width="10" height="1.5" rx="0.3" fill="currentColor" />
    <rect x={W/2-5} y={H-2} width="10" height="1.5" rx="0.3" fill="currentColor" />

    <!-- Prior overlays -->
    {#each overlays as p}
      <circle cx={nx(p.x)} cy={ny(p.y)} r="1.2" fill={dotColor(p)} opacity="0.7">
        <title>{p.target ? `${p.target} • ${p.outcome ?? ''}` : (p.outcome ?? '')}</title>
      </circle>
    {/each}

    <!-- Current landing / pickup markers -->
    {#if isSet(landing)}
      <circle cx={nx(landing.x)} cy={ny(landing.y)} r="1.8" fill="hsl(220 80% 40%)" />
      <circle cx={nx(landing.x)} cy={ny(landing.y)} r="3"   fill="none" stroke="hsl(220 80% 40%)" stroke-width="0.7" />
    {/if}
    {#if contestType === 'break' && isSet(pickup)}
      <circle cx={nx(pickup.x)} cy={ny(pickup.y)} r="1.8" fill="hsl(28 88% 48%)" />
      <path d={`M ${nx(landing.x)},${ny(landing.y)} L ${nx(pickup.x)},${ny(pickup.y)}`} stroke="hsl(28 88% 48%)" stroke-width="0.8" />
    {/if}
  </svg>

  <!-- Tiny helper text -->
  <div class="absolute bottom-1 left-2 text-[11px] text-neutral-500 dark:text-neutral-400 bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded">
    Click to set {contestType === 'break' ? 'landing, then pickup' : 'landing'}
  </div>
</div>

<style>
  :global(.dark) .pitch-grid { color: #4b5563; }
</style>
