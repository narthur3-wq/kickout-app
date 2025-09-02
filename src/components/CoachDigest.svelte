<script>
  import Donut from './Donut.svelte';
  import { pending, half } from '$lib/stores.js'; // <-- no aliasing

  // Svelte stores -> $pending, $half
  const HALVES = ['H1', 'H2'];

  // ---------- generic helpers ----------
  const isH = (h) => HALVES.includes(h);
  const safe = (n) => (Number.isFinite(n) ? n : 0);

  // ---------- FILTERS ----------
  function byHalf(e, h)      { return e.half === h; }
  function byType(e, t)      { return e.type === t; }
  function bySide(e, side)   { return e.side === side; }

  // ---------- SCOREBOARD ----------
  // Count G / P / 2P by team + half
  function scoreCounts(events, side, half) {
    const list = (events || []).filter((e) =>
      byType(e, 'shot') && bySide(e, side) && byHalf(e, half)
    );
    let g = 0, p = 0, t2 = 0;
    for (const s of list) {
      if (s.outcome === 'goal')   g++;
      else if (s.outcome === 'point') p++;
      else if (s.outcome === 'two')  t2++;        // 2-point trial shot
    }
    return { g, p, t2 };
  }

  // ---------- SHOT % ----------
  // Any successful shot (goal/point/two) counts as 1 success
  function shotSuccess(events, side, half) {
    const list = (events || []).filter(
      (e) => byType(e, 'shot') && bySide(e, side) && byHalf(e, half)
    );
    let suc = 0, tot = list.length;
    for (const s of list) {
      if (s.outcome === 'goal' || s.outcome === 'point' || s.outcome === 'two') suc++;
    }
    const pct = tot ? Math.round((suc / tot) * 100) : 0;
    return { suc, tot, pct };
  }

  // ---------- TOP SCORERS (digest-mini) ----------
  // Scores by player (Us & Opp), success = goal/point/two
  function topScorers(events, side, limit = 5) {
    const list = (events || []).filter((e) => byType(e, 'shot') && bySide(e, side));
    const map = new Map();
    for (const s of list) {
      const ok = s.outcome === 'goal' || s.outcome === 'point' || s.outcome === 'two';
      if (!ok) continue;
      const k = s.player ?? 0;
      map.set(k, (map.get(k) || 0) + 1);
    }
    // [{player, scores}] sorted desc
    const arr = Array.from(map.entries()).map(([player, scores]) => ({ player, scores }));
    arr.sort((a, b) => b.scores - a.scores || a.player - b.player);
    return arr.slice(0, limit);
  }

  // ---------- BREAK WIN RATE (overall) ----------
  // contest === 'break' on kickouts; win when outcome === 'won'
  function breakWinOverall(events, half) {
    const list = (events || []).filter(
      (e) => byType(e, 'kickout') && byHalf(e, half) && e.contest === 'break'
    );
    let wins = 0, total = 0;
    for (const k of list) {
      if (k.outcome === 'neutral') continue; // exclude neutral from %
      if (k.outcome === 'won' || k.outcome === 'lost') {
        total++;
        if (k.outcome === 'won') wins++;
      }
    }
    const pct = total ? Math.round((wins / total) * 100) : 0;
    return { wins, total, pct };
  }

  // ---------- KICKOUTS WIN / LOSS (per side) ----------
  // Winner is the side that retained; neutral excluded from %
  function koWinLossFor(side, events, half) {
    const kos = (events || []).filter(
      (e) => byType(e, 'kickout') && byHalf(e, half) && bySide(e, side)
    );

    let wins = 0, losses = 0, neutral = 0;
    for (const k of kos) {
      if (k.winner_team === 'neutral') neutral++;
      else if (k.winner_team === side) wins++;
      else if (k.winner_team) losses++;
    }
    const total = wins + losses;
    const pct = total ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, neutral, total, pct, attempts: kos.length };
  }

  // ---------- TURNOVERS TABLE (us-perspective) ----------
  function turnoversRow(events, half) {
    const list = (events || []).filter((e) => byType(e, 'turnover') && byHalf(e, half) && e.side === 'us');
    let gain = 0, loss = 0, f = 0, u = 0;
    for (const t of list) {
      if (t.outcome === 'gain') gain++;
      else if (t.outcome === 'loss') loss++;
      if (t.cause === 'forced') f++;
      else if (t.cause === 'unforced') u++;
    }
    const total = gain + loss;
    const pct = total ? Math.round((gain / total) * 100) : 0;
    return { gain, loss, pct, f, u };
  }

  // ---------- reactive projections ----------
  $: usH1   = scoreCounts($pending, 'us',  'H1');
  $: usH2   = scoreCounts($pending, 'us',  'H2');
  $: oppH1  = scoreCounts($pending, 'opp', 'H1');
  $: oppH2  = scoreCounts($pending, 'opp', 'H2');

  $: usShot = shotSuccess($pending, 'us',  $half);
  $: opShot = shotSuccess($pending, 'opp', $half);

  $: usTop  = topScorers($pending, 'us',  5);
  $: opTop  = topScorers($pending, 'opp', 5);

  $: brk    = breakWinOverall($pending, $half);

  // NEW donuts
  $: usKO   = koWinLossFor('us',  $pending, $half);
  $: oppKO  = koWinLossFor('opp', $pending, $half);

  // turnovers table rows
  $: tH1    = turnoversRow($pending, 'H1');
  $: tH2    = turnoversRow($pending, 'H2');
  $: tTot   = {
    gain: tH1.gain + tH2.gain,
    loss: tH1.loss + tH2.loss,
    f:    tH1.f    + tH2.f,
    u:    tH1.u    + tH2.u,
    get pct() {
      const tot = this.gain + this.loss;
      return tot ? Math.round((this.gain / tot) * 100) : 0;
    }
  };
</script>

<!-- GRID -->
<div class="digest-grid">
  <!-- Scoreboard -->
  <div class="card">
    <h3>Scoreboard — G / P / 2P</h3>
    <div class="sb-grid">
      <div>
        <div class="side">Us</div>
        <div class="row">
          <div class="half">H1</div>
          <div class="k">{usH1.g}</div><div class="lbl">G</div>
          <div class="k">{usH1.p}</div><div class="lbl">P</div>
          <div class="k">{usH1.t2}</div><div class="lbl">2P</div>
        </div>
        <div class="row">
          <div class="half">H2</div>
          <div class="k">{usH2.g}</div><div class="lbl">G</div>
          <div class="k">{usH2.p}</div><div class="lbl">P</div>
          <div class="k">{usH2.t2}</div><div class="lbl">2P</div>
        </div>
      </div>

      <div>
        <div class="side">Opp</div>
        <div class="row">
          <div class="half">H1</div>
          <div class="k">{oppH1.g}</div><div class="lbl">G</div>
          <div class="k">{oppH1.p}</div><div class="lbl">P</div>
          <div class="k">{oppH1.t2}</div><div class="lbl">2P</div>
        </div>
        <div class="row">
          <div class="half">H2</div>
          <div class="k">{oppH2.g}</div><div class="lbl">G</div>
          <div class="k">{oppH2.p}</div><div class="lbl">P</div>
          <div class="k">{oppH2.t2}</div><div class="lbl">2P</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Shot success % -->
  <div class="card">
    <h3>Shot success %</h3>
    <div class="two-col">
      <div class="mini">
        <div class="mini-title">Us</div>
        <div class="mini-big">{usShot.pct}%</div>
        <div class="mini-sub">{usShot.suc}/{usShot.tot} successful</div>
      </div>
      <div class="mini">
        <div class="mini-title">Opp</div>
        <div class="mini-big">{opShot.pct}%</div>
        <div class="mini-sub">{opShot.suc}/{opShot.tot} successful</div>
      </div>
    </div>
  </div>

  <!-- Top scorers -->
  <div class="card">
    <h3>Top scorers</h3>
    <div class="two-col">
      <div>
        <div class="mini-title">Us</div>
        {#if usTop.length === 0}
          <div class="mini-none">—</div>
        {:else}
          <ul class="toplist">
            {#each usTop as r}
              <li><b>#{r.player}</b> — {r.scores}</li>
            {/each}
          </ul>
        {/if}
      </div>
      <div>
        <div class="mini-title">Opp</div>
        {#if opTop.length === 0}
          <div class="mini-none">—</div>
        {:else}
          <ul class="toplist">
            {#each opTop as r}
              <li><b>#{r.player}</b> — {r.scores}</li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>

  <!-- Break win rate (overall) -->
  <div class="card">
    <h3>Break win rate (overall)</h3>
    <div class="donut-row">
      <Donut value={brk.wins} total={brk.total} />
      <div class="donut-meta">
        <div class="donut-big">{brk.pct}%</div>
        <div class="donut-sub">{brk.wins}/{brk.total} wins</div>
      </div>
    </div>
  </div>

  <!-- Kickouts — win rate (two donuts) -->
  <div class="card">
    <h3>Kickouts — win rate</h3>
    <div class="donut-grid">
      <!-- Us -->
      <div class="donut-cell">
        <div class="donut-wrap">
          <Donut value={usKO.wins} total={usKO.total} />
        </div>
        <div class="donut-meta">
          <div class="donut-title">Us kickouts</div>
          <div class="donut-big">{usKO.pct}%</div>
          <div class="donut-sub">
            {usKO.wins}W / {usKO.losses}L
            {#if usKO.neutral > 0} • {usKO.neutral}N{/if}
            {#if usKO.attempts > 0} • {usKO.attempts} att{/if}
          </div>
        </div>
      </div>

      <!-- Opp -->
      <div class="donut-cell">
        <div class="donut-wrap">
          <Donut value={oppKO.wins} total={oppKO.total} />
        </div>
        <div class="donut-meta">
          <div class="donut-title">Opp kickouts</div>
          <div class="donut-big">{oppKO.pct}%</div>
          <div class="donut-sub">
            {oppKO.wins}W / {oppKO.losses}L
            {#if oppKO.neutral > 0} • {oppKO.neutral}N{/if}
            {#if oppKO.attempts > 0} • {oppKO.attempts} att{/if}
          </div>
        </div>
      </div>
    </div>
    <div class="note">Win% excludes neutral contests.</div>
  </div>

  <!-- Turnovers — H1 / H2 / Total (Us perspective) -->
  <div class="card">
    <h3>Turnovers — H1 / H2 / Total</h3>
    <table class="tab">
      <thead>
        <tr>
          <th></th>
          <th>Gain</th>
          <th>Loss</th>
          <th>%</th>
          <th>F</th>
          <th>U</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="rowh">H1</td>
          <td class="num">{tH1.gain}</td>
          <td class="num">{tH1.loss}</td>
          <td class="num">{tH1.pct}%</td>
          <td class="num">{tH1.f}</td>
          <td class="num">{tH1.u}</td>
        </tr>
        <tr>
          <td class="rowh">H2</td>
          <td class="num">{tH2.gain}</td>
          <td class="num">{tH2.loss}</td>
          <td class="num">{tH2.pct}%</td>
          <td class="num">{tH2.f}</td>
          <td class="num">{tH2.u}</td>
        </tr>
        <tr class="tot">
          <td class="rowh">Total</td>
          <td class="num"><b>{tTot.gain}</b></td>
          <td class="num"><b>{tTot.loss}</b></td>
          <td class="num"><b>{tTot.pct}%</b></td>
          <td class="num"><b>{tTot.f}</b></td>
          <td class="num"><b>{tTot.u}</b></td>
        </tr>
      </tbody>
    </table>
    <div class="note">Us perspective only (Opp is the mirror: Opp gain ≅ Us loss)</div>
  </div>
</div>

<style>
  .digest-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .card {
    background: #fff;
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.05);
  }

  h3 { margin: 0 0 10px; }

  /* Scoreboard */
  .sb-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .side { font-weight: 700; margin-bottom: 6px; }
  .row {
    display: grid;
    grid-template-columns: 36px repeat(3, 28px 24px);
    align-items: center;
    gap: 4px;
    margin: 4px 0;
  }
  .half { font-weight: 700; }
  .k { text-align: right; font-weight: 800; }
  .lbl { opacity: 0.6; }

  /* two-column mini blocks */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .mini-title { font-weight: 700; margin-bottom: 2px; }
  .mini-big   { font-weight: 800; font-size: 28px; }
  .mini-sub   { opacity: .75; font-size: 13px; }
  .mini-none  { opacity: .5; }

  /* lists */
  .toplist { margin: 6px 0 0; padding-left: 18px; }
  .toplist li { margin: 2px 0; }

  /* donut rows */
  .donut-row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 14px;
    align-items: center;
  }
  .donut-meta { line-height: 1.2; }
  .donut-big  { font-size: 28px; font-weight: 800; }
  .donut-sub  { font-size: 13px; opacity: .75; }
  .note { margin-top: 6px; font-size: 12px; opacity: .6; }

  /* NEW: two donuts */
  .donut-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(220px, 1fr));
    gap: 16px;
    align-items: center;
  }
  .donut-cell {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 12px;
    align-items: center;
  }
  .donut-wrap { display: grid; place-items: center; }
  .donut-title { font-weight: 700; margin-bottom: 4px; }

  /* turnovers table */
  .tab { width: 100%; border-collapse: collapse; }
  .tab th, .tab td {
    padding: 10px 10px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .tab th { text-align: center; opacity: .75; }
  .tab th:first-child, .tab td:first-child { text-align: left; }
  .rowh { font-weight: 700; }
  .num { text-align: center; }
  .tot td { background: rgba(0,0,0,0.03); }
  
  /* responsive */
  @media (max-width: 1200px) {
    .digest-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 700px) {
    .digest-grid { grid-template-columns: 1fr; }
    .sb-grid, .two-col { grid-template-columns: 1fr; }
    .donut-grid { grid-template-columns: 1fr; }
  }
</style>
