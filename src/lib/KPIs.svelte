# File: src/lib/KPIs.svelte
<script>
  import { derived } from 'svelte/store';
  import { filtered } from './stores';

  const zones = ['L-S','C-S','R-S','L-M','C-M','R-M','L-L','C-L','R-L','L-V','C-V','R-V'];

  const byZone = derived(filtered, ($rows) => {
    const map = Object.fromEntries(zones.map(z => [z, { total:0, retained:0, breaks:0, breaks_won:0 }]));
    for (const r of $rows) {
      const z = r.zone_code || 'C-M';
      const slot = map[z] || (map[z] = { total:0, retained:0, breaks:0, breaks_won:0 });
      slot.total++;
      if (r.outcome === 'retained') slot.retained++;
      if (r.contest_type === 'break') { slot.breaks++; if (r.break_outcome === 'won') slot.breaks_won++; }
    }
    return map;
  });
</script>

<div class="grid gap-3" style="grid-template-columns: repeat(3, minmax(0,1fr));">
  <section class="card">
    <h3>Retention by Zone</h3>
    <table>
      <thead><tr><th>Zone</th><th>Ret%</th><th>N</th></tr></thead>
      <tbody>
        {#await byZone}
          <tr><td colspan="3">…</td></tr>
        {:then map}
          {#each Object.entries(map) as [z, v]}
            <tr><td>{z}</td><td>{v.total? Math.round(100*v.retained/v.total): 0}%</td><td>{v.total}</td></tr>
          {/each}
        {/await}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h3>Break Win Rate</h3>
    <table>
      <thead><tr><th>Zone</th><th>Win%</th><th>Breaks</th></tr></thead>
      <tbody>
        {#await byZone}
          <tr><td colspan="3">…</td></tr>
        {:then map}
          {#each Object.entries(map) as [z, v]}
            <tr><td>{z}</td><td>{v.breaks? Math.round(100*v.breaks_won/v.breaks): 0}%</td><td>{v.breaks}</td></tr>
          {/each}
        {/await}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h3>Overall</h3>
    {#await byZone}
      <p>…</p>
    {:then map}
      {#const totals = Object.values(map).reduce((a,b)=>({
        total:a.total+b.total, retained:a.retained+b.retained,
        breaks:a.breaks+b.breaks, breaks_won:a.breaks_won+b.breaks_won
      }), {total:0, retained:0, breaks:0, breaks_won:0})}
      <ul>
        <li>Retention: {totals.total? Math.round(100*totals.retained/totals.total):0}% ({totals.retained}/{totals.total})</li>
        <li>Break win: {totals.breaks? Math.round(100*totals.breaks_won/totals.breaks):0}% ({totals.breaks_won}/{totals.breaks})</li>
      </ul>
    {/then}
  </section>
</div>

<style>
  .card { padding: .75rem; border: 1px solid #eee; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.04); background: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: .35rem .5rem; border-bottom: 1px solid #eee; text-align: left; }
  thead th { font-size: .85rem; opacity: .7; }
</style>
