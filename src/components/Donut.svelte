<script>
  // Props: pass raw counts (value = wins, total = wins + losses)
  export let value = 0;
  export let total = 0;

  // presentation
  export let size = 96;        // px
  export let thickness = 10;   // ring thickness

  // compute ratio safely
  $: ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  $: pct = Math.round(ratio * 100);

  // circle geometry
  const r = (size - thickness) / 2;   // radius of the ring center line
  const c = 2 * Math.PI * r;          // circumference
  $: dash = c * ratio;                // drawn arc length
  $: gap  = c - dash;                 // remaining gap

  // accessibility label
  $: label = `${pct}% (${value}/${total})`;
</script>

<svg
  class="donut"
  width={size}
  height={size}
  viewBox={`0 0 ${size} ${size}`}
  role="img"
  aria-label={label}
>
  <!-- base ring -->
  <circle
    cx={size/2} cy={size/2} r={r}
    fill="none"
    stroke="var(--donut-bg, #e5e7eb)"
    stroke-width={thickness}
  />
  <!-- progress arc; rotated so it starts at 12 o'clock -->
  <circle
    cx={size/2} cy={size/2} r={r}
    fill="none"
    stroke="var(--donut-fg, #0c66ff)"
    stroke-width={thickness}
    stroke-linecap="round"
    stroke-dasharray={`${dash} ${gap}`}
    transform={`rotate(-90 ${size/2} ${size/2})`}
  />
</svg>

<style>
  .donut { display: block; }
</style>
