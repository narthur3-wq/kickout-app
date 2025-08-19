<script>
  import { filtered } from './stores';

  // Fixed version: compute from the store with reactive statements (no await)

  const zones = [
    'L-S','C-S','R-S',
    'L-M','C-M','R-M',
    'L-L','C-L','R-L',
    'L-V','C-V','R-V'
  ];

  // Build a zone map anytime the filtered data changes
  $: zoneMap = (() => {
    const map = Object.fromEntries(zones.map(z => [z, {
      total: 0, retained: 0, breaks: 0, breaks_won: 0
    }]));
    for (const r of $filtered) {
      const z = r.zone_code || 'C-M';
      const slot = map[z] || (map[z] = { total:0, retained:0, breaks:0, breaks_won:0 });
      slot.total += 1;
      if (r.outcome === 'retained') slot.retained += 1;
      if (r.contest_type === 'break') {
        slot.breaks += 1;
        if (r.break_outcome === 'won') slot.breaks_won += 1;
      }
    }
    return map;
  })();

  // Totals
  $: totals = Object.values(zoneMap).reduce((a,b)=>({
    total: a.total + b.total,
    retained: a.retained + b.retained,
    breaks: a.breaks + b.breaks,
    breaks_won: a.breaks_won + b.breaks_won
  }), { total:0, retained:0, breaks:0, breaks_won:0 });

  const pct = (num, den) => den ? Math.round(100 * num / den) : 0;
</script>

<div class="grid">
  <section class="card">
    <h3>Retention by Zone</h3>
    <table>
      <thead><tr><th>Zone</th><th>Ret%</th><th>N</th></tr></thead>
      <tbody>
        {#each Object.entries(zoneMap) as [z, v]}
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
        {#each Object.entries(zoneMap) as [z, v]}
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
  .grid { display: grid; gap: .75rem; grid-template-columns: repeat(3, minmax(0,1fr)); }
  .card { padding: .75rem; border: 1px solid #eee; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.04); background: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: .35rem .5rem; border-bottom: 1px solid #eee; text-align: left; }
  thead th { font-size: .85rem; opacity: .7; }
  @media (max-width: 900px){ .grid { grid-template-columns: 1fr; } }
</style>
