<script>
  // value in [0..1], countA/countB optional label (e.g., wins/attempts)
  export let value = 0;
  export let label = '';        // e.g., 'Kickout win rate'
  export let caption = '';      // small caption under the % (e.g., '0/0 wins')

  const size = 120;             // px
  const stroke = 10;            // ring thickness
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  $: dash = Math.max(0, Math.min(1, value)) * c;
  $: gap  = c - dash;
</script>

<div class="donut">
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <g transform={`translate(${size/2}, ${size/2})`}>
      <!-- track -->
      <circle r={r} fill="none" stroke="var(--ring-track, #ecf0f3)" stroke-width={stroke} />
      <!-- arc -->
      <circle
        r={r} fill="none"
        stroke="var(--ring-arc, var(--accent))"
        stroke-width={stroke}
        stroke-linecap="round"
        stroke-dasharray={`${dash} ${gap}`}
        transform="rotate(-90)"
      />
    </g>
  </svg>

  <div class="center">
    <div class="value">{Math.round(value*100)}%</div>
    {#if caption}<div class="cap">{caption}</div>{/if}
  </div>

  {#if label}
    <div class="title">{label}</div>
  {/if}
</div>

<style>
  .donut{
    position:relative;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:16px;
  }
  .center{
    position:absolute; inset:0;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    pointer-events:none;
  }
  .value{ font-size:28px; font-weight:800; line-height:1; }
  .cap{ font-size:12px; opacity:.7; margin-top:4px; }
  .title{ position:absolute; top:-10px; left:0; right:0; text-align:center; font-weight:800; }
</style>
