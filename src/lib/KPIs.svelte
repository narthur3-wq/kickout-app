<script>
  import { derived } from 'svelte/store';
  import { filtered } from './stores';

  const zones = [
    'L-S','C-S','R-S',
    'L-M','C-M','R-M',
    'L-L','C-L','R-L',
    'L-V','C-V','R-V'
  ];

  // Build a map of zone metrics from the filtered rows
  const byZone = derived(filtered, ($rows) => {
    const map = Object.fromEntries(zones.map(z => [z, { total:0, retained:0, breaks:0, breaks_won:0 }]));
    for (const r of $rows) {
      const z = r.zone_code || 'C-M';
      const slot = map[z] || (map[z] = { total:0, retained:0, breaks:0, breaks_won:0 });
      slot.total++;
      if (r.outcome === 'retained') slot.retained++;
      if (r.contest_type === 'break') {
        slot.breaks++;
        if (r.break_outcome === 'won') slot.breaks_won++;
      }
    }
    return map;
  });

  // Use the store's current value
  $: map = $byZone;

  // Overall totals
  $: totals = Object.values(map).reduce((a,b)=>({
    total: a.total + b.total,
    retained: a.retained + b.retained,
    breaks: a.breaks + b.breaks,
    breaks_won: a.breaks_won + b.breaks_won
  }), { total:0, retained:0, breaks:0, breaks_won:0 });

  const pct = (n,d) => d ? Math.round(100*n/d) : 0;
</script>

<div class="grid" style="display:grid;gap:.75rem;grid-template-columns:repeat(3,minmax(0,1fr));">
  <section class="card">
    <h3>Retention by Zone</h3>
    <table>
      <thead><tr><th>Zone</th><th>Ret%</th><th>N</th></tr></thead>
      <tbody>
        {#each Object.entries(map) as [z, v]}
          <tr><td>{z}</td><td>{pct(v.retained, v.total)}%</td><td>{v.total}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h3>Break Win Rate</h3>
    <table>
      <thead><tr><th>Zone</th><th>Win%</th><th>Breaks</th></tr></thead>
      <tbody>
        {#each Object.entries(map) as [z, v]}
          <tr><td>{z}</td><td>{pct(v.breaks_won, v.breaks)}%</td><td>{v.breaks}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h3>Overall</h3>
    <ul>
      <li>Retention: {pct(totals.retained, totals.total)}% ({totals.retained}/{totals.total})</li>
      <li>Break win: {pct(totals.breaks_won, totals.breaks)}% ({totals.breaks_won}/{totals.breaks})</li>
    </ul>
  </section>
</div>

<style>
  .card { padding:.75rem; border:1px solid #eee; border-radius:12px; background:#fff; }
  table { width:100%; border-collapse:collapse; }
  th,td { padding:.35rem .5rem; border-bottom:1px solid #eee; text-align:left; }
  thead th { font-size:.85rem; opacity:.7; }
</style>
