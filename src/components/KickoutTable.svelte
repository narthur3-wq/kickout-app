<script>
  export let rows = [];
   $: maxAtt = Math.max(1, ...rows.map(r => r.att || 0));
  $: maxWon = Math.max(1, ...rows.map(r => r.won || 0));
</script>

<table style="width:100%; border-collapse:separate; border-spacing:0">
  <thead>
    <tr>
      <th style="padding:8px"></th>
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
      <td style="padding:8px"><div class="avatar">{r.player || '?'}</div></td>
        <td style="padding:8px;text-align:left">#{r.player || '—'}</td>
        <td style="padding:8px">
          <div class="barcell">
            <div class="statbar"><span style="width:{(r.att / maxAtt) * 100}%"></span></div>
            <span class="val">{r.att}</span>
          </div>
        </td>
        <td style="padding:8px">
          <div class="barcell">
            <div class="statbar"><span style="width:{(r.won / maxWon) * 100}%"></span></div>
            <span class="val">{r.won}</span>
          </div>
        </td>
        <td style="padding:8px;text-align:right">{r.lost}</td>
        <td style="padding:8px;text-align:right">{r.winPct}%</td>
      </tr>
    {/each}
    {#if rows.length === 0}
   <tr><td colspan="6" style="padding:10px" class="muted">No data.</td></tr>
    {/if}
  </tbody>
</table>

<style>
  .avatar{width:26px;height:26px;border-radius:999px;background:#e5e7eb;display:grid;place-items:center;font-weight:700;font-size:12px;color:#111827}
  .barcell{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
  .barcell .statbar{width:100%}
  .barcell .val{text-align:right;min-width:24px}
</style>