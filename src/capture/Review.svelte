<script>
  import { onMount } from 'svelte';

  // ---- Utilities ------------------------------------------------------------
  const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

  // Defensive copy from localStorage (works on vercel/SSR because it's inside onMount)
  let all = [];            // all events
  let filtered = [];       // filtered view on page (date/opponent/type toggles can be added later)

  onMount(() => {
    try {
      // Try a couple of common keys we've used in this project
      const raw =
        localStorage.getItem('kickouts_v1') ??
        localStorage.getItem('kickouts') ??
        '[]';
      const data = JSON.parse(raw);
      // Normalise a little so downstream code doesn't explode if some fields are missing
      all = Array.isArray(data)
        ? data.map((p, i) => ({
            id: p.id ?? i,
            side: p.side ?? 'us',         // 'us' | 'opp'
            win: !!p.win,                 // boolean
            ct: p.ct ?? 'clean',          // 'clean' | 'break' | 'foul' | 'out'
            rcv: p.rcv ?? p.target ?? null, // receiver/target jersey number if present
            t: p.t ?? null,               // timestamp if present
            opp: p.opp ?? p.opponent ?? '', // opponent if present
          }))
        : [];
    } catch (e) {
      all = [];
    }
    filtered = all; // no filters yet (kept for future)
  });

  // ---- Derived (reactive) data ---------------------------------------------
  // split by side
  $: ours = filtered.filter((p) => p.side === 'us');
  $: theirs = filtered.filter((p) => p.side === 'opp');

  // win/loss breakdown
  $: oursW = ours.filter((p) => p.win).length;
  $: oursL = ours.length - oursW;

  $: oppW = theirs.filter((p) => p.win).length; // opposition wins on *their* kickouts
  $: oppL = theirs.length - oppW;

  // breaks only (coach asked to focus on breaks more than “clean”)
  $: oursBreaks = ours.filter((p) => p.ct === 'break');
  $: oursBreakW = oursBreaks.filter((p) => p.win).length;

  $: oppBreaks = theirs.filter((p) => p.ct === 'break');
  $: oppBreakW = oppBreaks.filter((p) => p.win).length;

  // simple “top targets” (by jersey/receiver number if present)
  function topNTargets(points, n = 5) {
    const tally = new Map();
    for (const p of points) {
      const k = p.rcv ?? '—';
      const prev = tally.get(k) ?? { att: 0, win: 0 };
      tally.set(k, { att: prev.att + 1, win: prev.win + (p.win ? 1 : 0) });
    }
    return [...tally.entries()]
      .map(([k, v]) => ({ key: k, ...v, wPct: pct(v.win, v.att) }))
      .sort((a, b) => b.att - a.att || b.wPct - a.wPct)
      .slice(0, n);
  }

  $: topUs = topNTargets(ours);
  $: topOpp = topNTargets(theirs);

  // group by opponent (very light – just counts & win%)
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

  // export helpers ------------------------------------------------------------
  function exportCSV() {
    const rows = [
      ['side', 'win', 'ct', 'rcv', 'opp', 't'],
      ...all.map((p) => [p.side, p.win ? 1 : 0, p.ct, p.rcv ?? '', p.opp ?? '', p.t ?? '']),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kickouts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // optional: export dashboard screenshot without breaking SSR
  async function exportPNG() {
    // dynamic import so builds don’t choke
    const { default: html2canvas } = await import('html2canvas');
    const el = document.getElementById('review-root');
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kickout-review.png';
    a.click();
  }
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
  h2,h3 { margin: 0 0 .5rem 0; }
  .kpi { font-size: 0.95rem; }
  .muted { color: #6b7280; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .btnrow { display:flex; gap:.5rem; margin: 1rem auto; max-width: 1200px; padding:0 1rem; }
  .btn { border: 1px solid #d1d5db; background:#fff; border-radius:8px; padding:.5rem .75rem; cursor:pointer; }
  .btn:hover { background:#f9fafb; }
  @media (max-width: 900px){
    .wrap{ grid-template-columns: 1fr; }
  }
</style>

<div class="btnrow">
  <button class="btn" on:click={exportCSV}>Export CSV</button>
  <button class="btn" on:click={exportPNG}>Save dashboard PNG</button>
</div>

<div id="review-root" class="wrap">
  <!-- Overall win/loss (our kickouts) -->
  <div class="card">
    <h3>Our kickouts — win rate</h3>
    <p class="kpi">
      <strong>{pct(oursW, ours.length)}%</strong>
      <span class="muted"> {oursW} W / {oursL} L ({ours.length} total)</span>
    </p>
  </div>

  <!-- Opposition kickouts -->
  <div class="card">
    <h3>Opposition kickouts — win rate</h3>
    <p class="kpi">
      <strong>{pct(oppW, theirs.length)}%</strong>
      <span class="muted"> {oppW} W / {oppL} L ({theirs.length} total)</span>
    </p>
  </div>

  <!-- Breaks (us) -->
  <div class="card">
    <h3>Our breaks — win %</h3>
    <p class="kpi">
      <strong>{pct(oursBreakW, oursBreaks.length)}%</strong>
      <span class="muted"> {oursBreakW} W / {oursBreaks.length - oursBreakW} L ({oursBreaks.length} breaks)</span>
    </p>
  </div>

  <!-- Breaks (opp) -->
  <div class="card">
    <h3>Opposition breaks — win %</h3>
    <p class="kpi">
      <strong>{pct(oppBreakW, oppBreaks.length)}%</strong>
      <span class="muted"> {oppBreakW} W / {oppBreaks.length - oppBreakW} L ({oppBreaks.length} breaks)</span>
    </p>
  </div>

  <!-- Top 5 targets (us) -->
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

  <!-- Top 5 targets (opposition) -->
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

  <!-- By opponent (our kickouts) -->
  <div class="card">
    <h3>By opponent (our kickouts)</h3>
    {#if tableUsByOpp.length}
      <table>
        <thead>
          <tr>
            <th>Opponent</th>
            <th class="right">Total</th>
            <th class="right">Win %</th>
          </tr>
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

  <!-- By opponent (opposition kickouts) -->
  <div class="card">
    <h3>By opponent (opposition kickouts)</h3>
    {#if tableOppByOpp.length}
      <table>
        <thead>
          <tr>
            <th>Opponent</th>
            <th class="right">Total</th>
            <th class="right">Win %</th>
          </tr>
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
