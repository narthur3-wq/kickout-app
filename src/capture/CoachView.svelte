<script>
  import { events } from '../stores.js';

  const rows = ['Left','Centre','Right'];                  // horizontal (columns)
  const cols = ['Short','Medium','Long','Very Long'];      // vertical (rows)

  // helpers
  const pct = (n,d)=> d? (100*n/d):0;
  const r0  = (n)=> Math.round(n||0);
  const fmtPct = (n)=> `${r0(n)}%`;

  function aggSide(list){
    const total = list.length;
    const wins  = list.filter(e=>!!e.win).length;
    const losses= total-wins;
    const brAtt = list.filter(e=>e.contest_type==='break').length;
    const brWin = list.filter(e=>e.contest_type==='break' && e.win).length;
    return { total, wins, losses, winPct: pct(wins,total), breaks:{att:brAtt, win:brWin, winPct:pct(brWin,brAtt)} };
  }

  function top5(list, key){
    const map=new Map(); let tot=0;
    for(const e of list){
      const k=String(e[key]||'').trim(); if(!k) continue;
      tot++;
      const m=map.get(k)||{label:k,att:0,win:0};
      m.att++; if(e.win) m.win++; map.set(k,m);
    }
    return {
      total:tot,
      rows:[...map.values()]
        .map(m=>({...m, share:pct(m.att,tot), winPct:pct(m.win,m.att)}))
        .sort((a,b)=>b.att-a.att).slice(0,5)
    };
  }

  function zoneAgg(list){
    const grid={}; for(const r of rows){ grid[r]={}; for(const c of cols){ grid[r][c]={att:0,win:0}; } }
    for(const e of list){
      const r=e.side_band||'Centre', c=e.depth_band||'Medium';
      if(grid[r] && grid[r][c]){ grid[r][c].att++; if(e.win) grid[r][c].win++; }
    }
    let max=0; rows.forEach(r=>cols.forEach(c=>{ if(grid[r][c].att>max) max=grid[r][c].att; }));
    return {grid, max: Math.max(max,1)};
  }

  // source
  $: our = $events.filter(e=>e.side==='us');
  $: opp = $events.filter(e=>e.side==='opp');

  $: ourAgg  = aggSide(our);
  $: oppAgg  = aggSide(opp);
  $: ourTop  = top5(our,'target_player');
  $: oppTop  = top5(opp,'opponent_receiver');
  $: ourZone = zoneAgg(our);
  $: oppZone = zoneAgg(opp);

  // coaching bullets
  function zoneHot(z){
    let best={r:'Centre',c:'Medium',att:0,winPct:0};
    for(const r of rows) for(const c of cols){
      const cell=z.grid[r][c]; const wp=pct(cell.win,cell.att);
      if(cell.att>best.att) best={r,c,att:cell.att,winPct:wp};
    }
    return best;
  }
  $: bullets = (()=>{
    const b=[];
    if(ourAgg.total){
      if(ourAgg.winPct>=60) b.push(`Our kickouts humming: ${r0(ourAgg.winPct)}% (${ourAgg.wins}/${ourAgg.total}).`);
      else if(ourAgg.winPct<=40) b.push(`Low win rate on our kickouts: ${r0(ourAgg.winPct)}% — adjust matchups/targets.`);
    }
    if(ourAgg.breaks.att) b.push(`Breaks: ${ourAgg.breaks.att} → ${r0(ourAgg.breaks.winPct)}% wins.`);
    if(ourTop.rows.length){ const t=ourTop.rows[0]; b.push(`Top target #${t.label}: ${t.att} contests (${r0(t.share)}% share), ${r0(t.winPct)}% wins.`); }
    const hz=zoneHot(ourZone); if(hz.att) b.push(`Most volume: ${hz.c} / ${hz.r} — ${r0(hz.winPct)}% win on ${hz.att} kicks.`);
    if(oppTop.rows.length){ const o=oppTop.rows[0]; b.push(`Opp threat #${o.label}: ${o.att} contests, ${r0(o.winPct)}% wins.`); }
    return b.slice(0,5);
  })();

  const tau = Math.PI*2;
  const circ = r => tau*r;
</script>

<!-- Sunlight (Green/Red) palette: high-contrast for bright outdoor screens -->
<div class="coach" style="
  --bg:#F5F7FA;      /* off-white to reduce glare */
  --card:#FFFFFF;    /* crisp cards */
  --tx:#0A0A0A;      /* very dark text */
  --mut:#4B5563;     /* darker muted text for daylight */
  --border:#CBD5E1;  /* stronger border separation */
  --track:#D1D5DB;   /* visible donut/bar track */
  --win:#0F9D58;     /* saturated green (win) */
  --loss:#C81E1E;    /* saturated red (loss) */
  --accent:#2563EB;  /* punchy blue for headings */
  --grid:#E2E8F0;    /* table/grid lines */
">

  <!-- Coaching bullets -->
  <section class="bullets">
    <div class="bul-title">Coaching bullets</div>
    <ul>
      {#if bullets.length===0}
        <li class="muted">No events yet.</li>
      {:else}
        {#each bullets as bl}<li>{bl}</li>{/each}
      {/if}
    </ul>
  </section>

  <!-- Overall win/loss -->
  <section class="grid-2">
    <div class="card donut">
      <div class="card-title">Our kickouts — win rate</div>
      <div class="donut-wrap">
        <svg viewBox="0 0 160 160" class="ring" aria-label="our win rate">
          <circle cx="80" cy="80" r="60" fill="none" stroke="var(--track)" stroke-width="20"/>
          {#if ourAgg.total>0}
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--win)" stroke-width="20" stroke-linecap="round"
              stroke-dasharray="{circ(60)*(ourAgg.wins/ourAgg.total)} {circ(60)}" transform="rotate(-90 80 80)"/>
          {/if}
        </svg>
        <div class="donut-center">
          <div class="big">{fmtPct(ourAgg.winPct)}</div>
          <div class="muted small">{ourAgg.wins} W / {ourAgg.losses} L • {ourAgg.total} total</div>
        </div>
      </div>
    </div>

    <div class="card donut">
      <div class="card-title">Opposition kickouts — win rate</div>
      <div class="donut-wrap">
        <svg viewBox="0 0 160 160" class="ring" aria-label="opp win rate">
          <circle cx="80" cy="80" r="60" fill="none" stroke="var(--track)" stroke-width="20"/>
          {#if oppAgg.total>0}
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--win)" stroke-width="20" stroke-linecap="round"
              stroke-dasharray="{circ(60)*(oppAgg.wins/oppAgg.total)} {circ(60)}" transform="rotate(-90 80 80)"/>
          {/if}
        </svg>
        <div class="donut-center">
          <div class="big">{fmtPct(oppAgg.winPct)}</div>
          <div class="muted small">{oppAgg.wins} W / {oppAgg.losses} L • {oppAgg.total} total</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Breaks -->
  <section class="grid-2">
    <div class="card block">
      <div class="card-title">Our breaks</div>
      <div class="bar">
        <div class="bar-win" style="width:{ourAgg.breaks.winPct}%"></div>
      </div>
      <div class="bar-meta">
        <span class="strong">{fmtPct(ourAgg.breaks.winPct)}</span>
        <span class="muted">{ourAgg.breaks.win} W / {ourAgg.breaks.att-ourAgg.breaks.win} L • {ourAgg.breaks.att} breaks</span>
      </div>
    </div>
    <div class="card block">
      <div class="card-title">Opposition breaks</div>
      <div class="bar">
        <div class="bar-win" style="width:{oppAgg.breaks.winPct}%"></div>
      </div>
      <div class="bar-meta">
        <span class="strong">{fmtPct(oppAgg.breaks.winPct)}</span>
        <span class="muted">{oppAgg.breaks.win} W / {oppAgg.breaks.att-oppAgg.breaks.win} L • {oppAgg.breaks.att} breaks</span>
      </div>
    </div>
  </section>

  <!-- Top 5 -->
  <section class="grid-2">
    <div class="card block">
      <div class="card-title">Top 5 — our targets</div>
      {#if !ourTop.rows.length}
        <div class="muted">No data yet.</div>
      {:else}
        <div class="list">
          {#each ourTop.rows as p}
            <div class="row">
              <div class="chip">#{p.label}</div>
              <div class="grow">
                <div class="hbar"><div class="hbar-win" style="width:{p.winPct}%"></div></div>
                <div class="meta small muted">{p.att} att • {fmtPct(p.share)} of kicks • {fmtPct(p.winPct)} win</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="card block">
      <div class="card-title">Top 5 — opposition receivers</div>
      {#if !oppTop.rows.length}
        <div class="muted">No data yet.</div>
      {:else}
        <div class="list">
          {#each oppTop.rows as p}
            <div class="row">
              <div class="chip">#{p.label}</div>
              <div class="grow">
                <div class="hbar"><div class="hbar-win" style="width:{p.winPct}%"></div></div>
                <div class="meta small muted">{p.att} att • {fmtPct(p.share)} of kicks • {fmtPct(p.winPct)} win</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <!-- Zones (transposed): Columns = Left/Centre/Right; Rows = Short..Very Long -->
  <section class="grid-2">
    <div class="card block">
      <div class="card-title">Zones — our kickouts</div>
      <div class="zone zone-lcr">
        <div class="head"></div>
        {#each rows as s}<div class="head">{s}</div>{/each}
        {#each cols as d}
          <div class="side">{d}</div>
          {#each rows as s}
            {#key `our-${s}-${d}-${ourZone.grid[s][d].att}-${ourZone.grid[s][d].win}`}
              <div class="cell">
                <div class="attempts">{ourZone.grid[s][d].att} att</div>
                <div class="split">
                  <div class="w" style="width:{pct(ourZone.grid[s][d].win, ourZone.grid[s][d].att)}%"></div>
                  <div class="l"></div>
                </div>
                <div class="cellmeta small">
                  <span class="win">{ourZone.grid[s][d].win} W</span>
                  <span class="loss">{ourZone.grid[s][d].att-ourZone.grid[s][d].win} L</span>
                </div>
              </div>
            {/key}
          {/each}
        {/each}
      </div>
    </div>

    <div class="card block">
      <div class="card-title">Zones — opposition kickouts</div>
      <div class="zone zone-lcr">
        <div class="head"></div>
        {#each rows as s}<div class="head">{s}</div>{/each}
        {#each cols as d}
          <div class="side">{d}</div>
          {#each rows as s}
            {#key `opp-${s}-${d}-${oppZone.grid[s][d].att}-${oppZone.grid[s][d].win}`}
              <div class="cell">
                <div class="attempts">{oppZone.grid[s][d].att} att</div>
                <div class="split">
                  <div class="w" style="width:{pct(oppZone.grid[s][d].win, oppZone.grid[s][d].att)}%"></div>
                  <div class="l"></div>
                </div>
                <div class="cellmeta small">
                  <span class="win">{oppZone.grid[s][d].win} W</span>
                  <span class="loss">{oppZone.grid[s][d].att-oppZone.grid[s][d].win} L</span>
                </div>
              </div>
            {/key}
          {/each}
        {/each}
      </div>
    </div>
  </section>
</div>

<style>
  .coach{ background:var(--bg); color:var(--tx); padding:12px 14px 18px; }
  .muted{ color:var(--mut); } .small{ font-size:12px; }

  .bullets{ background:#EEF9FF; border:1px solid var(--grid); border-radius:12px; padding:10px 12px; margin-bottom:12px; }
  .bul-title{ font-weight:900; margin-bottom:6px; color:var(--tx); letter-spacing:.3px; }

  .grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0; }
  @media (max-width: 900px){ .grid-2{ grid-template-columns:1fr; } }

  .card{ background:var(--card); border:1px solid var(--border); border-radius:14px; padding:12px; }
  .card-title{ font-weight:900; margin-bottom:10px; color:var(--tx); letter-spacing:.2px; }

  .donut .donut-wrap{ position:relative; display:grid; place-items:center; min-height:220px; }
  .ring{ width:200px; height:200px; }
  .donut-center{ position:absolute; display:grid; place-items:center; text-align:center; }
  .big{ font-weight:900; font-size:34px; }

  .block .bar{ height:18px; border-radius:999px; background:var(--track); overflow:hidden; }
  .block .bar-win{ height:100%; background:var(--win); }
  .bar-meta{ margin-top:8px; display:flex; gap:12px; align-items:center; }
  .strong{ font-weight:900; }

  .list{ display:flex; flex-direction:column; gap:12px; }
  .row{ display:grid; grid-template-columns:84px 1fr; gap:12px; align-items:center; }
  .chip{ background:#111; color:#fff; border-radius:999px; font-weight:900; padding:6px 12px; display:inline-block; text-align:center; }
  .grow .hbar{ height:14px; border-radius:999px; background:var(--track); overflow:hidden; border:1px solid var(--border); }
  .grow .hbar-win{ height:100%; background:var(--win); }

  /* Base grid layout for zone tables; overridden for LCR layout below */
  .zone{ display:grid; gap:10px; }

  /* Transposed layout: first column for row labels (depth), three data columns for L/C/R */
  .zone-lcr{ grid-template-columns:100px repeat(3,1fr); }

  .head{ font-weight:900; text-align:center; }
  .side{ font-weight:900; display:flex; align-items:center; }

  .cell{ border:1px solid var(--border); border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:8px; background:#fff; }
  .attempts{ font-weight:800; }
  .split{ height:14px; width:100%; background:var(--track); border-radius:10px; overflow:hidden; position:relative; }
  .split .w{ height:100%; background:var(--win); }
  .split .l{ position:absolute; inset:0; background:linear-gradient(to right, transparent, transparent); } /* keeps bar height */
  .cellmeta{ display:flex; gap:12px; }
  .cellmeta .win{ color:var(--win); font-weight:800; }
  .cellmeta .loss{ color:var(--loss); font-weight:800; }
</style>
