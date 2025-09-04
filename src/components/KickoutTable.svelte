<script>
  export let rows = [];
</script>

<table style="width:100%; border-collapse:separate; border-spacing:0">
  <thead>
    <tr>
      <th style="text-align:left;padding:8px">Player</th>
      <th style="text-align:right;padding:8px">Att</th>
      <th style="text-align:right;padding:8px">Won</th>
      <th style="text-align:right;padding:8px">Lost</th>
      <th style="text-align:right;padding:8px">Win %</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as r}
      <tr>
        <td style="padding:8px">#{r.player || '—'}</td>
        <td style="padding:8px;text-align:right">{r.att}</td>
        <td style="padding:8px;text-align:right">{r.won}</td>
        <td style="padding:8px;text-align:right">{r.lost}</td>
        <td style="padding:8px;text-align:right">{r.winPct}%</td>
      </tr>
    {/each}
    {#if rows.length === 0}
      <tr><td colspan="5" style="padding:10px" class="muted">No data.</td></tr>
    {/if}
  </tbody>
</table>
