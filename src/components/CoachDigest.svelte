<script>
  import TogglePills from './TogglePills.svelte';
  import Donut from './Donut.svelte';
  import { events as pending, orientation_left } from '$lib/stores.js';
  import { classifyKickoutZoneForSide } from '$lib/util.js';

  // Local scope (Digest only)
  let scope = 'h1'; // 'h1' | 'h2' | 'all'
  let source = { play: true, free: true };

  const safe = (a) => Array.isArray(a) ? a : [];
  const success = new Set(['goal','point','two']);
  const inScope = (e, scope) => scope === 'all' ? true : e.half === (scope === 'h1' ? 1 : 2);
  const fromSrc  = (e, src) => (e.source === 'free' ? src.free : src.play);
  const pts = (g,p,t2) => 3*g + p + 2*t2;

  // ----- Timestamp (latest event) -----
  function fmtClock(ms){
    if (!ms) return '—';
    const d = new Date(ms);
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    const ss = d.getSeconds().toString().padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }
  $: lastTs = Math.max(0, ...safe($pending).map(e=>e.ts||0));
  $: updatedAt = fmtClock(lastTs);

  // ---------- Scoreboard ----------
  function aggScores(side){
    const rows = safe($pending).filter(e => e.type==='shot' && e.side===side);
    const half = [1,2].map(h => {
      const r = rows.filter(r=>r.half===h);
      const g = r.filter(r=>r.outcome==='goal').length;
      const p = r.filter(r=>r.outcome==='point').length;
      const t2= r.filter(r=>r.outcome==='two').length;
      return { g,p,t2, pts:pts(g,p,t2) };
    });
    const tot = { g:half[0].g+half[1].g, p:half[0].p+half[1].p, t2:half[0].t2+half[1].t2 };
    tot.pts = pts(tot.g, tot.p, tot.t2);
    return { h1:half[0], h2:half[1], total:tot };
  }
  $: usSB  = aggScores('us');
  $: oppSB = aggScores('opp');
  $: diffPts = usSB.total.pts - oppSB.total.pts; // positive = we're ahead
  const sign = (n)=> (n>0?`+${n}`:`${n}`);

  // ---------- Shot success (scope & source) ----------
  function shotPct(side, scope, source){
    const rows = safe($pending)
      .filter(e=>e.type==='shot' && e.side===side)
      .filter(e=>inScope(e, scope))
      .filter(e=>fromSrc(e, source));
    const tot = rows.length;
    const suc = rows.filter(e=>success.has(e.outcome)).length;
    const pct = tot ? Math.round((suc/tot)*100) : 0;
    return { pct, suc, tot };
  }
  $: usShot  = shotPct('us',  scope, source);
  $: oppShot = shotPct('opp', scope, source);
  $: shotDelta = usShot.tot===0 && oppShot.tot===0 ? null : (usShot.pct - oppShot.pct);

  // ---------- Kickouts win% (our POV), by kicking side ----------
  function koPct(kickingSide, scope){
    const rows = safe($pending)
      .filter(e=>e.type==='kickout' && e.side===kickingSide)
      .filter(e=>inScope(e, scope));
    let w=0, l=0;
    for (const r of rows){
      if (r.winner_team==='us') w++;
      else if (r.winner_team==='opp') l++;
    }
    const d = w+l;
    return { pct: d ? Math.round((w/d)*100) : 0, w, l, d };
  }
  $: usKO  = koPct('us',  scope);
  $: oppKO = koPct('opp', scope);
  $: koDelta = (usKO.d===0 && oppKO.d===0) ? null : (usKO.pct - oppKO.pct);

  // ---------- Breaks ----------
  $: breaks = safe($pending)
    .filter(e=>e.type==='kickout' && e.contest==='break')
    .filter(e=>inScope(e, scope));
  $: breakWins = breaks.filter(e=>e.winner_team==='us').length;
  $: breakDenom = breaks.filter(e=>e.winner_team!=='neutral').length;
  $: breakPct = breakDenom ? Math.round((breakWins/breakDenom)*100) : 0;

  // ---------- Top scorers (all halves) ----------
  function topScorers(side, limit=5){
    const rows = safe($pending).filter(e=>e.type==='shot' && e.side===side);
    const map = new Map();
    for (const r of rows){
      const id = Number.isFinite(r.player) ? r.player : 0;
      const rec = map.get(id) || { player:id, g:0, p:0, t2:0, pts:0 };
      if      (r.outcome==='goal')  rec.g++;
      else if (r.outcome==='point') rec.p++;
      else if (r.outcome==='two')   rec.t2++;
      rec.pts = pts(rec.g, rec.p, rec.t2);
      map.set(id, rec);
    }
    return [...map.values()]
      .sort((a,b)=> b.pts - a.pts || b.g - a.g || b.p - a.p || b.t2 - a.t2 || a.player - b.player)
      .slice(0, limit);
  }
  $: usTop  = topScorers('us');
  $: oppTop = topScorers('opp');

  // ---------- Turnovers (WIN/LOSS) ----------
  function toAgg(){
   const rows = safe($pending).filter(e=>e.type==='turnover');
    const H = [1,2].map(h=>{
      const r = rows.filter(e=>e.half===h);
      const gain = r.filter(e=>e.outcome==='gain').length;
      const loss = r.filter(e=>e.outcome==='loss').length;
     const forced   = r.filter(e=>e.outcome==='loss' && e.cause==='forced').length;
      const unforced = r.filter(e=>e.outcome==='loss' && e.cause==='unforced').length;
      const d = gain+loss;
      const pct = d ? Math.round((gain/d)*100) : 0;
      return { gain, loss, pct, forced, unforced };
    });
    const T = {
      gain:H[0].gain+H[1].gain,
      loss:H[0].loss+H[1].loss,
      forced:H[0].forced+H[1].forced,
      unforced:H[0].unforced+H[1].unforced
    };
    T.pct = (T.gain+T.loss) ? Math.round((T.gain/(T.gain+T.loss))*100) : 0;
    return { h1:H[0], h2:H[1], total:T };
  }
  $: toTable = toAgg();
  $: toDiff = toTable.total.gain - toTable.total.loss;

  // ---------- KO matrix (our kicks; zones relative to kicker) ----------
  const LENGTHS  = ['short','medium','long'];
  const LATERALS = ['left','centre','right'];

  function emptyMatrix(){
    const m = {};
    for (const L of LENGTHS) for (const R of LATERALS) m[`${L}-${R}`] = { att:0, wins:0, losses:0 };
    return m;
  }
  function zoneMatrixUs(scope){
    const m = emptyMatrix();
    const rows = safe($pending)
      .filter(e=>e.type==='kickout' && e.side==='us')
      .filter(e=>inScope(e, scope));
    for (const e of rows){
      const z = classifyKickoutZoneForSide(e.nx, e.ny, e.side, e.savedOrientationLeft, $orientation_left);
      const cell = m[z.key];
      cell.att += 1;
      if (e.winner_team==='us') cell.wins += 1;
      else if (e.winner_team==='opp') cell.losses += 1;
    }
    return m;
  }
  $: usZones = zoneMatrixUs(scope);
  $: maxCellAtt = Math.max(0, ...Object.values(usZones).map(c=>c.att));
  function pctNum(n,d){ return d ? Math.round((n/d)*100) : 0; }

  // ---------- Simple notes ----------
  $: notes = [
    (toDiff<0) ? `Turnovers −${Math.abs(toDiff)} (Win ${toTable.total.gain} / Loss ${toTable.total.loss})` : null,
    (koDelta!=null && koDelta<0) ? `Kickouts trailing by ${Math.abs(koDelta)}%` : null,
    (shotDelta!=null && shotDelta<0) ? `Shot% behind by ${Math.abs(shotDelta)}%` : null
  ].filter(Boolean);
</script>

<div class="digest">
  <!-- A) Header -->
  <div class="card headbar">
    <div class="left">
      <div class="title">Digest</div>
      <div class="chips">
        <div class="seg">
          <button class:active={scope==='h1'} on:click={() => scope='h1'}>H1</button>
          <button class:active={scope==='h2'} on:click={() => scope='h2'}>H2</button>
          <button class:active={scope==='all'} on:click={() => scope='all'}>Total</button>
        </div>
        <TogglePills ariaLabel="Shot source" bind:model={source}
          items={[{key:'play',label:'From play'},{key:'free',label:'Free'}]} />
        <span class="badge" data-kind="muted">Kicking: {$orientation_left ? 'Left' : 'Right'}</span>
        <span class="badge" data-kind="muted">Updated {updatedAt}</span>
      </div>
    </div>
    <div class="scoreline">
      <div class="side">
        <div class="nm">Us</div>
        <div class="big">{usSB.total.g}-{usSB.total.p}<span class="two">(2P:{usSB.total.t2})</span></div>
        <div class="pts">{usSB.total.pts} pts</div>
      </div>
      <div class="mid">
        <div class="vs">vs</div>
        <div class="diff" data-pos={diffPts>0} data-neg={diffPts<0}>
          {diffPts===0 ? 'level' : sign(diffPts)}
        </div>
      </div>
      <div class="side right">
        <div class="nm">Opp</div>
        <div class="big">{oppSB.total.g}-{oppSB.total.p}<span class="two">(2P:{oppSB.total.t2})</span></div>
        <div class="pts">{oppSB.total.pts} pts</div>
      </div>
    </div>
  </div>

  <!-- B) KPI strip -->
  <div class="kpis">
    <!-- Shot % -->
    <div class="kpi card">
      <div class="kpi-h">Shot conversion</div>
      {#if usShot.tot===0 && oppShot.tot===0}
        <div class="muted">— No attempts in scope</div>
      {:else}
        <div class="kpi-vals">
          <div class="kpi-val"><b>{usShot.pct}%</b><span>{usShot.suc}/{usShot.tot}</span></div>
          <div class="kpi-delta badge" data-kind={shotDelta==null ? 'muted' : (shotDelta>=0 ? 'pos' : 'neg')}>
            {shotDelta==null ? 'vs Opp —' : (shotDelta>=0 ? `+${shotDelta}% vs Opp` : `${shotDelta}% vs Opp`)}
          </div>
        </div>
        <div class="bars">
          <div class="row">
            <div class="label us">Us</div>
            <div class="statbar"><span style:width={usShot.pct + '%'}></span></div>
            <div class="pct">{usShot.pct}%</div>
          </div>
          <div class="row">
            <div class="label opp">Opp</div>
            <div class="statbar"><span class="opp" style:width={oppShot.pct + '%'}></span></div>
            <div class="pct">{oppShot.pct}%</div>
          </div>
        </div>
      {/if}
    </div>

    <!-- KO win -->
    <div class="kpi card">
      <div class="kpi-h">Kickout win rate</div>
      {#if usKO.d===0 && oppKO.d===0}
        <div class="muted">— No kickouts in scope</div>
      {:else}
        <div class="kpi-vals">
          <div class="kpi-val"><b>{usKO.pct}%</b><span>{usKO.w}W / {usKO.l}L</span></div>
          <div class="kpi-delta badge" data-kind={koDelta==null ? 'muted' : (koDelta>=0 ? 'pos' : 'neg')}>
            {koDelta==null ? 'vs Opp —' : (koDelta>=0 ? `+${koDelta}% vs Opp` : `${koDelta}% vs Opp`)}
          </div>
        </div>
        <div class="bars">
          <div class="row">
            <div class="label us">Us</div>
            <div class="statbar"><span style:width={usKO.pct + '%'}></span></div>
            <div class="pct">{usKO.pct}%</div>
          </div>
          <div class="row">
            <div class="label opp">Opp</div>
            <div class="statbar"><span class="opp" style:width={oppKO.pct + '%'}></span></div>
            <div class="pct">{oppKO.pct}%</div>
          </div>
        </div>
      {/if}
    </div>

    <!-- TO diff -->
    <div class="kpi card">
      <div class="kpi-h">Turnover differential</div>
      <div class="kpi-vals">
        <div class="kpi-val">
          <b>{toDiff===0 ? 'level' : sign(toDiff)}</b>
          <span>{toTable.total.gain} win / {toTable.total.loss} loss</span>
        </div>
        <div class="kpi-delta badge" data-kind={toDiff>0 ? 'pos' : toDiff<0 ? 'neg' : 'muted'}>
          {toDiff>0 ? 'positive' : toDiff<0 ? 'negative' : 'even'}
        </div>
      </div>
    </div>
  </div>

  <!-- C) Two-column body -->
  <div class="body grid">
    <!-- 1) Possession / Restarts -->
    <div class="card col">
      <div class="section-h">Possession / Restarts</div>

      <!-- KO comparison bars -->
      <div class="block">
        <div class="block-h">Kickout win rate</div>
        {#if usKO.d===0 && oppKO.d===0}
          <div class="muted">— No kickouts in scope</div>
        {:else}
          <div class="bars">
            <div class="row">
              <div class="label us">Us</div>
              <div class="statbar"><span style:width={usKO.pct + '%'}></span></div>
              <div class="pct">{usKO.pct}%</div>
            </div>
            <div class="row">
              <div class="label opp">Opp</div>
              <div class="statbar"><span class="opp" style:width={oppKO.pct + '%'}></span></div>
              <div class="pct">{oppKO.pct}%</div>
            </div>
          </div>
          <div class="small muted">{usKO.w}W / {usKO.l}L • {usKO.d} attempts (Us) &nbsp;·&nbsp; {oppKO.w}W / {oppKO.l}L • {oppKO.d} attempts (Opp)</div>
        {/if}
      </div>

      <!-- KO 3×3 matrix (our kicks) -->
      <div class="block">
        <div class="block-h">Our kickouts — direction & length</div>
        {#if maxCellAtt===0}
          <div class="muted">— No attempts</div>
        {:else}
          <div class="matrix">
            <div></div><div class="ch">Left</div><div class="ch">Centre</div><div class="ch">Right</div>
            {#each LENGTHS as L}
              <div class="rh">{L === 'short' ? 'Short' : (L === 'medium' ? 'Medium' : 'Long')}</div>
              {#each LATERALS as R}
                {#key `${L}-${R}`}
                  {#await Promise.resolve(usZones[`${L}-${R}`]) then cell}
                    <div class="cell" style:background={`linear-gradient(0deg, rgba(37,99,235,0.12) ${maxCellAtt?Math.round((cell.att/maxCellAtt)*100):0}%, transparent 0%)`}>
                      <div class="att">{cell.att} att</div>
                      <div class="bar"><span style:width={pctNum(cell.wins, cell.wins + cell.losses) + '%'}></span></div>
                      <div class="wl">
                        <span class="w">{cell.wins} W</span>
                        <span class="l">{cell.losses} L</span>
                      </div>
                    </div>
                  {/await}
                {/key}
              {/each}
            {/each}
          </div>
          <div class="small muted">Win% excludes neutrals; zones relative to the kicker’s direction.</div>
        {/if}
      </div>

      <!-- Breaks -->
      <div class="block">
        <div class="block-h">Break win rate</div>
        {#if breakDenom===0}
          <div class="muted">— No break contests</div>
        {:else}
          <div class="donutRow">
            <Donut value={breakPct} />
            <div class="donutLabel">
              <div class="bigv">{breakPct}%</div>
              <div class="muted small">{breakWins}/{breakDenom} wins</div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- 2) Shooting Efficiency -->
    <div class="card col">
      <div class="section-h">Shooting efficiency</div>

      <div class="block">
        <div class="block-h">Conversion (scope & source)</div>
        {#if usShot.tot===0 && oppShot.tot===0}
          <div class="muted">— No attempts in scope</div>
        {:else}
          <div class="bars">
            <div class="row">
              <div class="label us">Us</div>
              <div class="statbar"><span style:width={usShot.pct + '%'}></span></div>
              <div class="pct">{usShot.pct}%</div>
            </div>
            <div class="row">
              <div class="label opp">Opp</div>
              <div class="statbar"><span class="opp" style:width={oppShot.pct + '%'}></span></div>
              <div class="pct">{oppShot.pct}%</div>
            </div>
          </div>
          <div class="small muted">{usShot.suc}/{usShot.tot} (Us) • {oppShot.suc}/{oppShot.tot} (Opp)</div>
        {/if}
      </div>

      <!-- Top scorers -->
      <div class="block">
        <div class="block-h">Top scorers (points, all halves)</div>
        <div class="twocol">
          <table class="mini">
            <thead><tr><th>Us</th><th>G</th><th>P</th><th>2P</th><th>Pts</th></tr></thead>
            <tbody>
            {#each usTop as r}
              <tr>
                <td>{'#' + r.player}</td>
                <td>{r.g}</td><td>{r.p}</td><td>{r.t2}</td><td><b>{r.pts}</b></td>
              </tr>
            {/each}
            {#if usTop.length===0}<tr><td colspan="5" class="muted">—</td></tr>{/if}
            </tbody>
          </table>
          <table class="mini">
            <thead><tr><th>Opp</th><th>G</th><th>P</th><th>2P</th><th>Pts</th></tr></thead>
            <tbody>
            {#each oppTop as r}
              <tr>
                <td>{'#' + r.player}</td>
                <td>{r.g}</td><td>{r.p}</td><td>{r.t2}</td><td><b>{r.pts}</b></td>
              </tr>
            {/each}
            {#if oppTop.length===0}<tr><td colspan="5" class="muted">—</td></tr>{/if}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Turnovers -->
      <div class="block">
       <div class="block-h">Turnovers — H1 / H2 / Total (Win/Loss)</div> 
        <table class="turns">
          <thead><tr><th></th><th>Win</th><th>Loss</th><th>%</th><th>F</th><th>U</th></tr></thead>
          <tbody>
            <tr><td>H1</td><td>{toTable.h1.gain}</td><td>{toTable.h1.loss}</td><td>{toTable.h1.pct}%</td><td>{toTable.h1.forced}</td><td>{toTable.h1.unforced}</td></tr>
            <tr><td>H2</td><td>{toTable.h2.gain}</td><td>{toTable.h2.loss}</td><td>{toTable.h2.pct}%</td><td>{toTable.h2.forced}</td><td>{toTable.h2.unforced}</td></tr>
            <tr class="total"><td>Total</td><td>{toTable.total.gain}</td><td>{toTable.total.loss}</td><td>{toTable.total.pct}%</td><td>{toTable.total.forced}</td><td>{toTable.total.unforced}</td></tr>
          </tbody>
        </table>
        <div class="small muted">F/U counts among losses</div>
      </div>
    </div>
  </div>

  <!-- Coach notes -->
  <div class="card">
    <div class="section-h">Coach notes</div>
    {#if notes.length===0}
      <div class="muted">No auto notes yet for this scope.</div>
    {:else}
      <ul class="notes">
        {#each notes as n}<li>{n}</li>{/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .digest{ display:grid; gap:16px; }

  /* Header */
  .headbar{ display:grid; grid-template-columns: 1fr; gap:10px; }
  .headbar .left{ display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
  .headbar .title{ font-weight:900; font-size:20px; }
  .headbar .chips{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }

  .scoreline{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:8px; }
  .scoreline .nm{ font-weight:800; color:var(--ink-strong); }
  .scoreline .big{ font-weight:900; font-size:34px; line-height:1; }
  .scoreline .two{ font-weight:700; color:var(--neutral); font-size:14px; margin-left:6px; }
  .scoreline .pts{ font-weight:800; color:var(--accent); }
  .scoreline .mid{ text-align:center; }
  .scoreline .vs{ font-weight:900; color:var(--neutral); }
  .diff{
    margin-top:4px; display:inline-block; padding:4px 10px; border-radius:999px;
    font-weight:800; font-size:13px; background:#f3f4f6; color:var(--ink-strong); border:1px solid var(--border);
  }
  
  .diff[data-pos="true"]{ background:color-mix(in srgb, var(--win) 18%, #fff); border-color:var(--win); color:#065f46; }
  .diff[data-neg="true"]{ background:color-mix(in srgb, var(--loss) 18%, #fff); border-color:var(--loss); color:#7f1d1d; }
  .right{ text-align:right; }

  /* KPI strip */
  .kpis{ display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
  @media (max-width:1100px){ .kpis{ grid-template-columns:1fr 1fr; } }
  @media (max-width:720px){ .kpis{ grid-template-columns:1fr; } }
  .kpi-h{ font-weight:900; margin-bottom:6px; }
  .kpi-vals{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
  .kpi-val b{ font-size:26px; font-weight:900; margin-right:8px; }
  .kpi-val span{ color:var(--neutral); font-weight:700; font-size:12px; }
  .bars{ display:grid; gap:8px; }
  .row{ display:grid; grid-template-columns: 46px 1fr 48px; align-items:center; gap:8px; }
  .label.us{ font-weight:800; color:var(--us); }
  .label.opp{ font-weight:800; color:var(--opp); }
  .pct{ font-weight:800; text-align:right; }

  /* Two-column body */
  .body{ grid-template-columns:1fr 1fr; }
  @media (max-width:1100px){ .body{ grid-template-columns:1fr; } }
  .col .section-h{ font-weight:900; font-size:18px; margin-bottom:8px; }
  .block{ border:1px solid var(--border); border-radius:12px; padding:12px; display:grid; gap:10px; }
  .block + .block{ margin-top:12px; }
  .block-h{ font-weight:800; }

  /* KO matrix */
  .matrix{ display:grid; grid-template-columns: 80px repeat(3, 1fr); gap:8px; }
  .ch, .rh{ font-weight:800; text-align:center; }
  .rh{ text-align:left; padding-top:6px; }
  .cell{ border:1px solid var(--border); border-radius:10px; padding:8px; display:grid; gap:6px; background-clip:padding-box; }
  .cell .att{ font-weight:700; font-size:13px; }
  .cell .bar{ height:10px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
  .cell .bar > span{ display:block; height:100%; background:var(--win); }
  .cell .wl{ display:flex; justify-content:space-between; font-size:12px; }
  .cell .w{ color:var(--green); } .cell .l{ color:var(--loss); }

  /* Donut row */
  .donutRow{ display:flex; gap:12px; align-items:center; }
  .donutLabel .bigv{ font-weight:900; font-size:26px; }

  /* Tables */
  .twocol{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  @media (max-width:720px){ .twocol{ grid-template-columns:1fr; } }
  table.mini{ width:100%; border-collapse:separate; border-spacing:0; }
  table.mini th, table.mini td{ padding:6px 8px; text-align:center; }
  table.mini th:first-child, table.mini td:first-child{ text-align:left; }
  table.turns{ width:100%; border-collapse:separate; border-spacing:0; }
  table.turns th, table.turns td{ padding:8px 10px; text-align:center; }
  table.turns th:first-child, table.turns td:first-child{ text-align:left; }
  .total td{ font-weight:900; }

  .small{ font-size:12px; }
  .notes{ margin:0; padding-left:18px; }
</style>
