<script>
  import { events, meta } from '../stores.js';
  import { zoneFromCanonical, clamp01 } from '../lib/space.js';

  $: half = $meta?.halfFilter ?? 'all';

  $: allKos = ($events || []).filter(e => e?.type === 'kickout' && (half === 'all' ? true : Number(e?.half) === Number(half)));

  // KPIs (Clontarf-centric)
  $: overallWins  = allKos.filter(e => e?.winner_team === 'us').length;
  $: overallTotal = allKos.length;
  $: overallPct   = overallTotal ? Math.round(100 * overallWins / overallTotal) : 0;

  $: ours   = allKos.filter(e => e?.side === 'us');
  $: opps   = allKos.filter(e => e?.side === 'opp');
  $: oursW  = ours.filter(e => e?.winner_team === 'us').length;
  $: oppW   = opps.filter(e => e?.winner_team === 'us').length;
  $: oursT  = ours.length;  $: oppT = opps.length;
  $: oursPct= oursT ? Math.round(100 * oursW / oursT) : 0;
  $: oppPct = oppT ? Math.round(100 * oppW / oppT) : 0;

  function gridOf(list) {
    const rows = ['Short','Medium','Long','Very Long'];
    const cols = ['Left','Centre','Right'];
    const g = {};
    for (const r of rows) { g[r] = {}; for (const c of cols) g[r][c] = { att: 0, w: 0, l: 0 }; }

    for (const e of list) {
      const x_c = clamp01(e?.landing?.x_c ?? e?.location?.x_c ?? e?.landing?.nx ?? e?.location?.nx);
      const y_c = clamp01(e?.landing?.y_c ?? e?.location?.y_c ?? e?.landing?.ny ?? e?.location?.ny);
      const [depth, lateral] = zoneFromCanonical(x_c, y_c).split(' ');
      g[depth][lateral].att += 1;
      if (e?.winner_team === 'us') g[depth][lateral].w += 1; else g[depth][lateral].l += 1;
    }
    return g;
  }

  $: gridUs  = gridOf(ours);
  $: gridOpp = gridOf(opps);

  const pct = (w, att) => (att ? Math.round(100 * w / att) : 0);

  function setHalf(h) { meta.update(m => ({ ...m, halfFilter: h })); }
</script>

<div class="container">
  <div class="meta">Halves: <strong>{half === 'all' ? 'All' : half === '1' ? '1st' : '2nd'}</strong></div>

  <section class="row grid-4-1">
    <div class="tile"><div class="k">Overall win % ({$meta?.team || 'Clontarf'})</div><div class="v">{overallPct}%</div><div class="s">{overallWins}/{overallTotal}</div></div>
    <div class="tile"><div class="k">Our KO win %</div><div class="v">{oursPct}%</div><div class="s">{oursW}/{oursT}</div></div>
    <div class="tile"><div class="k">Opp KO win %</div><div class="v">{oppPct}%</div><div class="s">{oppW}/{oppT}</div></div>
    <div class="tile" style="display:flex; justify-content:flex-end; align-items:center; gap:10px">
      <div class="seg">
        <button class:active={half==='all'} on:click={() => setHalf('all')} type="button">All</button>
        <button class:active={half==='1'}   on:click={() => setHalf('1')}   type="button">1st</button>
        <button class:active={half==='2'}   on:click={() => setHalf('2')}   type="button">2nd</button>
      </div>
    </div>
  </section>

  <section class="tile" style="position:relative">
    <h3 style="margin:0 0 .5rem 0">Zones — our kickouts</h3>
    <div class="zones">
      <div class="zones__head"></div>
      <div class="zones__head">Left</div>
      <div class="zones__head">Centre</div>
      <div class="zones__head">Right</div>

      {#each ['Short','Medium','Long','Very Long'] as r}
        <div class="zones__rowname">{r}</div>
        {#each ['Left','Centre','Right'] as c}
          {#key gridUs[r][c].att + '-' + gridUs[r][c].w}
          <div class="zones__cell">
            <div class="zones__att">{gridUs[r][c].att} attempts</div>
            <div class="zStack">
              <div class="zW" style="width:{pct(gridUs[r][c].w,gridUs[r][c].att)}%"></div>
              <div class="zL" style="width:{pct(gridUs[r][c].l,gridUs[r][c].att)}%"></div>
            </div>
            <div class="zWL">
              <span style="color:var(--win)">{gridUs[r][c].w} W</span>
              <span style="color:var(--loss)">{gridUs[r][c].l} L</span>
            </div>
          </div>
          {/key}
        {/each}
      {/each}
    </div>

    <div class="legend">
      <span class="lg lg-win"></span><span>Win</span>
      <span class="lg lg-loss"></span><span>Loss</span>
    </div>
  </section>

  <section class="tile" style="position:relative">
    <h3 style="margin:0 0 .5rem 0">Zones — opposition kickouts</h3>
    <div class="zones">
      <div class="zones__head"></div>
      <div class="zones__head">Left</div>
      <div class="zones__head">Centre</div>
      <div class="zones__head">Right</div>

      {#each ['Short','Medium','Long','Very Long'] as r}
        <div class="zones__rowname">{r}</div>
        {#each ['Left','Centre','Right'] as c}
          {#key gridOpp[r][c].att + '-' + gridOpp[r][c].w}
          <div class="zones__cell">
            <div class="zones__att">{gridOpp[r][c].att} attempts</div>
            <div class="zStack">
              <div class="zW" style="width:{pct(gridOpp[r][c].w,gridOpp[r][c].att)}%"></div>
              <div class="zL" style="width:{pct(gridOpp[r][c].l,gridOpp[r][c].att)}%"></div>
            </div>
            <div class="zWL">
              <span style="color:var(--win)">{gridOpp[r][c].w} W</span>
              <span style="color:var(--loss)">{gridOpp[r][c].l} L</span>
            </div>
          </div>
          {/key}
        {/each}
      {/each}
    </div>

    <div class="legend">
      <span class="lg lg-win"></span><span>Win</span>
      <span class="lg lg-loss"></span><span>Loss</span>
    </div>
  </section>
</div>

<style>
  :root{ --win:#16a34a; --loss:#dc2626; }
  .zones{
    display:grid;
    grid-template-columns: 120px repeat(3, 1fr);
    gap:12px;
  }
  .zones__head{ font-weight:800; color:#6b7280; }
  .zones__rowname{ font-weight:800; padding-top:6px; }
  .zones__cell{
    border:1px solid #e5e7eb; border-radius:12px; padding:10px;
    background:#fff;
  }
  .zones__att{ font-size:.85rem; color:#6b7280; margin-bottom:8px; }
  .zStack{
    height:12px; background:#f3f4f6; border-radius:999px; overflow:hidden; display:flex;
  }
  .zW{ background:var(--win); }
  .zL{ background:var(--loss); }
  .zWL{ display:flex; justify-content:space-between; margin-top:6px; font-weight:700; font-size:.9rem; }
</style>
