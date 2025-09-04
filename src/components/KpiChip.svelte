<script>
  export let icon = '•';
  export let label = '';
  export let valueText = '';   // e.g. "41%"
  export let subText = '';     // e.g. "(7/17)"
  export let delta = 0;        // number or null
  export let deltaSuffix = ''; // "%", " KOs", etc.
  export let empty = false;

  $: kind = empty ? 'neutral' : (delta > 0 ? 'pos' : (delta < 0 ? 'neg' : 'neutral'));
  $: arrow = empty ? '' : (delta > 0 ? '▲' : delta < 0 ? '▼' : '•');
</script>

<button class="kpi" disabled={empty} aria-label={label}>
  <div class="ic">{icon}</div>
  <div class="body">
    <div class="lbl">{label}</div>
    {#if empty}
      <div class="empty">— No data</div>
    {:else}
      <div class="val">{valueText} <span class="sub">{subText}</span></div>
      <div class="badge" data-kind={kind}><span>{arrow}</span> {delta}{deltaSuffix}</div>
    {/if}
  </div>
</button>

<style>
  .kpi{
    all:unset; display:flex; gap:10px; align-items:center;
    padding:10px 12px; border:1px solid var(--border); border-radius:12px;
    background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.05); cursor:pointer; min-width:220px;
  }
  .kpi:disabled{cursor:default; opacity:.9}
  .ic{font-size:18px}
  .lbl{font-weight:800; color:var(--ink)}
  .val{font-weight:900; font-size:28px; line-height:1}
  .sub{color:var(--neutral); font-size:12px; font-weight:700; margin-left:6px}
  .empty{color:var(--neutral); font-weight:700}
  .badge{margin-top:4px}
</style>
