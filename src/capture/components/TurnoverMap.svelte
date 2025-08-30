<script>
  import Pitch from '../Pitch.svelte';
  import { meta } from '../../stores.js';
  import { toScreen, clamp01 } from '../../lib/space.js';

  export let losses = []; // parent filters to Clontarf losses

  $: viewingLeft =
    $meta && $meta['orientation_left'] != null
      ? Boolean($meta['orientation_left'])
      : true;

  function toDot(t) {
    const rawx = t?.location?.x_c ?? t?.landing?.x_c ?? t?.location?.nx ?? t?.landing?.nx;
    const rawy = t?.location?.y_c ?? t?.landing?.y_c ?? t?.location?.ny ?? t?.landing?.ny;
    const x_c = clamp01(rawx), y_c = clamp01(rawy);
    const { x, y } = toScreen({ x_c, y_c }, viewingLeft);
    const sx = x * 1000, sy = y * 600;
    const forced = String(t?.turnover_type||'').toLowerCase()==='forced';
    return { key: t?.id ?? `${sx}-${sy}-${forced?'f':'u'}`, x: sx, y: sy, forced };
  }

  $: dots = (losses || []).map(toDot);

  const fillForced = '#ef4444';  // red
  const fillUnf    = '#f97316';  // orange
  const outline    = '#ffffff';
</script>

<div class="tile" style="position:relative">
  <div class="k" style="margin-bottom:.5rem">Turnover losses</div>
  <div class="field">
    <Pitch />
    <svg class="overlay" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
      {#each dots as d (d.key)}
        <g>
          <circle cx={d.x} cy={d.y} r="8" fill={outline} opacity=".95"></circle>
          <circle cx={d.x} cy={d.y} r="8" fill={d.forced ? fillForced : fillUnf} opacity=".95"></circle>
        </g>
      {/each}
    </svg>

    <div class="legend">
      <span class="lg" style="background:#ef4444"></span><span>Forced loss</span>
      <span class="lg" style="background:#f97316"></span><span>Unforced loss</span>
    </div>
  </div>
</div>
