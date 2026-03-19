<script>
  import { onMount } from 'svelte';

  // small helper
  const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

  // storage
  let all = [];
  let filtered = [];

  onMount(() => {
    try {
      const raw =
        localStorage.getItem('kickouts_v1') ??
        localStorage.getItem('kickouts') ??
        '[]';
      const data = JSON.parse(raw);
      all = Array.isArray(data) ? data : [];
      filtered = all;
    } catch {
      all = [];
      filtered = [];
    }
  });

  // derived (reactive)
  $: ours = filtered.filter((p) => p.side === 'us');
  $: theirs = filtered.filter((p) => p.side === 'opp');

  $: oursW = ours.filter((p) => p.win).length;
  $: oursL = ours.length - oursW;

  $: oppW = theirs.filter((p) => p.win).length;
  $: oppL = theirs.length - oppW;

  $: oursBreaks = ours.filter((p) => p.ct === 'break');
  $: oursBreakW = oursBreaks.filter((p) => p.win).length;

  $: oppBreaks = theirs.filter((p) => p.ct === 'break');
  $: oppBreakW = oppBreaks.filter((p) => p.win).length;

  function topNTargets(points, n = 5) {
    const m = new Map();
    for (const p of points) {
      const key = p.rcv ?? '—';
      const prev = m.get(key) ?? { att: 0, win: 0 };
      m.set(key, { att: prev.att + 1, win: prev.win + (p.win ? 1 : 0) });
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v, wPct: pct(v.win, v.att) }))
      .sort((a, b) => b.att - a.att || b.wPct - a.wPct)
      .slice(0, n);
  }

  $: topUs = topNTargets(ours);
  $: topOpp = topNTargets(theirs);

  function byOpponent(points) {
    const m = new Map();
    for (const p of points) {
      const k = p.opp || '—';
      const prev = m.get(k) ?? { att: 0, win: 0 };
      m.set(k, { att: prev.att + 1, win: prev.win + (p.win ? 1 : 0) });
    }
    return [...m.entries()]
      .map(([opp, v]) => ({ opp, ...v, wPct: pct(v.win, v.att) }))
      .sort((a, b) => b.att - a.att || b.wPct - a.wPct);
  }

  $: tableUsByOpp = byOpponent(ours);
  $: tableOppByOpp = byOpponent(theirs);
</script>

<style>
  .wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .card {
    background: var(--card, #fff);
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px;
  }
  h2, h3 { margin: 0 0 .5rem 0; }
  .kpi { font-size: 0.95rem; }
  .muted { color: #6b7280; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  @media (max-width: 900px){
    .wrap { grid-template-columns: 1fr; }
  }
</style>

<div id="review-root" class="wrap">
  <div class="card">
    <h3>Our kickouts — win rate</h3>
    <p class="kpi">
      <strong>{pct(oursW, ours.length)}%</strong>
      <span class="muted"> {oursW} W / {oursL} L ({ours.length} total)</span>
    </p>
  </div>

  <div class="card">
    <h3>Opposition kickouts — win rate</h3>
    <p class="kpi">
      <strong>{pct(oppW, theirs.length)}%</strong>
      <span class="muted"> {oppW} W / {oppL} L ({theirs.length} total)</span>
    </p>
  </div>

  <div class="card">
    <h3>Our breaks — win %</h3>
    <p class="kpi">
      <strong>{pct(oursBreakW, oursBreaks.length)}%</strong>
      <span class="muted">
        {oursBreakW} W / {oursBreaks.length - oursBreakW} L ({oursBreaks.length} breaks)
      </span>
    </p>
  </div>

  <div class="card">
    <h3>Opposition breaks — win %</h3>
    <p class="kpi">
      <strong>{pct(oppBreakW, oppBreaks.length)}%</strong>
      <span class="muted">
        {oppBreakW} W / {oppBreaks.length - oppBreakW} L ({oppBreaks.length} breaks)
      </span>
    </p>
  </div>

  <div class="card">
    <h3>Top 5 — our targets</h3>
    {#if topUs.length}
      <table>
        <thead>
          <tr><th>Player</th><th class="right">Attempts</th><th class="right">Win %</th></tr>
        </thead>
        <tbody>
          {#each topUs as r}
            <tr>
              <td>#{r.key}</td>
              <td class="right">{r.att}</td>
              <td class="right">{r.wPct}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No data.</p>
    {/if}
  </div>

  <div class="card">
    <h3>Top 5 — opposition receivers</h3>
    {#if topOpp.length}
      <table>
        <thead>
          <tr><th>Player</th><th class="right">Attempts</th><th class="right">Win %</th></tr>
        </thead>
        <tbody>
          {#each topOpp as r}
            <tr>
              <td>#{r.key}</td>
              <td class="right">{r.att}</td>
              <td class="right">{r.wPct}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No data.</p>
    {/if}
  </div>

  <div class="card">
    <h3>By opponent (our kickouts)</h3>
    {#if tableUsByOpp.length}
      <table>
        <thead>
          <tr><th>Opponent</th><th class="right">Total</th><th class="right">Win %</th></tr>
        </thead>
        <tbody>
          {#each tableUsByOpp as r}
            <tr>
              <td>{r.opp}</td>
              <td class="right">{r.att}</td>
              <td class="right">{r.wPct}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No data.</p>
    {/if}
  </div>

  <div class="card">
    <h3>By opponent (opposition kickouts)</h3>
    {#if tableOppByOpp.length}
      <table>
        <thead>
          <tr><th>Opponent</th><th class="right">Total</th><th class="right">Win %</th></tr>
        </thead>
        <tbody>
          {#each tableOppByOpp as r}
            <tr>
              <td>{r.opp}</td>
              <td class="right">{r.att}</td>
              <td class="right">{r.wPct}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No data.</p>
    {/if}
  </div>
</div>
