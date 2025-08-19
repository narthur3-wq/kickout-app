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
      <thead><tr><th>Zone</th><th>Win%</t
