<script>
  import Pitch from './lib/Pitch.svelte';
  import Heatmap from './lib/Heatmap.svelte';
  import PlayerDashboard from './lib/PlayerDashboard.svelte';
  import { onMount } from 'svelte';

  // Pitch size (m)
  const WIDTH_M = 90, LENGTH_M = 145;

  // Options
  const OUTCOMES = ['Retained','Lost','Score','Wide','Out','Foul'];
  const CONTESTS = ['clean','break','foul','out'];
  const BREAK_OUTS = ['won','lost','neutral'];

  /** @type {'clean'|'break'|'foul'|'out'} */ let contest='clean';
  /** @type {'Retained'|'Lost'|'Score'|'Wide'|'Out'|'Foul'} */ let outcome='Retained';
  /** @type {'won'|'lost'|'neutral'|''} */ let breakOutcome='';

  let team='', opponent='', period='H1', clock='';
  let targetPlayer='';                    // NEW: the player targeted
  let timeToTee='', totalTime='';         // (s) strings okay
  let scored20=false;                     // scored within 20s?
  let matchDate = new Date().toISOString().slice(0,10);
  let ourGoalAtTop=true;

  // Click points
  let landing={x:NaN,y:NaN}, pickup={x:NaN,y:NaN};

  // Storage
  let events=[], editingId=null;

  // ---- Viz filters ----
  let fContest=new Set(CONTESTS);
  let fOutcome=new Set(OUTCOMES);
  /** @type {'landing'|'pickup'} */ let overlayMode='landing';
  let useFilters=true;

  let oppFilter='ALL';     // opponent normalized key; 'ALL' => no filter
  let plyFilter='ALL';     // player  normalized key; 'ALL' => no filter
  let ytdOnly=false;

  const today = new Date();
  const currentYear = today.getFullYear();

  onMount(()=>{
    events = JSON.parse(localStorage.getItem('ko_events') || '[]');
    const meta = JSON.parse(localStorage.getItem('ko_meta') || '{}');
    team = meta.team || '';
    opponent = meta.opponent || '';
    ourGoalAtTop = !!meta.our_goal_at_top;
  });
  function persist(){
    localStorage.setItem('ko_events', JSON.stringify(events));
    localStorage.setItem('ko_meta', JSON.stringify({team,opponent,our_goal_at_top:ourGoalAtTop}));
  }

  // ---- Helpers ----
  const norm = s => (s ?? '').trim().toLowerCase();
  const toMetersX = nx => nx*WIDTH_M;
  const toMetersY = ny => ny*LENGTH_M;
  const sideBand  = nx => nx<1/3 ? 'Left' : (nx<2/3 ? 'Centre' : 'Right');
  const depthMetersFromOwnGoal = ny => ourGoalAtTop ? toMetersY(ny) : (LENGTH_M - toMetersY(ny));
  const depthBandFromMeters = d => d<20?'Short':(d<45?'Medium':(d<65?'Long':'Very Long'));
  const zoneCode = (nx,ny) => `${sideBand(nx)[0]}-${depthBandFromMeters(depthMetersFromOwnGoal(ny))[0]}`;
  const breakDispM = (x1,y1,x2,y2)=> Math.hypot((x2-x1)*WIDTH_M,(y2-y1)*LENGTH_M);
  const getEventDate = (e)=> new Date((e.match_date || (e.created_at||'').slice(0,10)));

  function onLanding(e){ landing=e.detail; }
  function onPickup(e){ pickup=e.detail; }
  function clearPoints(){ landing={x:NaN,y:NaN}; pickup={x:NaN,y:NaN}; }

  function validate(){
    if (clock.trim()!=='' && !/^(\d{1,2}):\d{2}$/.test(clock)) return 'Clock must be mm:ss or blank.';
    if (Number.isNaN(landing.x)||Number.isNaN(landing.y)) return 'Click the pitch to set landing.';
    if (contest==='break'){
      if (Number.isNaN(pickup.x)||Number.isNaN(pickup.y)) return 'For a break, click the pickup point.';
      if (!breakOutcome) return 'Choose break outcome.';
    }
    if (timeToTee!=='' && isNaN(+timeToTee)) return 'Time to tee must be seconds (number) or blank.';
    if (totalTime!=='' && isNaN(+totalTime)) return 'Total time must be seconds (number) or blank.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return 'Match date must be YYYY-MM-DD.';
    return '';
  }

  function buildEvent(){
    const depth_m=depthMetersFromOwnGoal(landing.y);
    return {
      id: editingId ?? Date.now(),
      created_at: new Date().toISOString(),
      match_date: matchDate,
      team: team.trim(), opponent: opponent.trim(), period, clock,
      target_player: targetPlayer.trim(),               // NEW
      outcome, contest_type:contest, break_outcome: contest==='break'?breakOutcome:'',
      time_to_tee_s: timeToTee===''? null : +timeToTee,
      total_time_s:  totalTime===''? null : +totalTime,
      scored_20s: !!scored20,
      x:landing.x,y:landing.y, x_m:toMetersX(landing.x), y_m:toMetersY(landing.y),
      depth_from_own_goal_m:+depth_m.toFixed(2),
      side_band:sideBand(landing.x), depth_band: depthBandFromMeters(depth_m),
      zone_code: zoneCode(landing.x,landing.y), our_goal_at_top: ourGoalAtTop,
      pickup_x: contest==='break'?pickup.x:null, pickup_y: contest==='break'?pickup.y:null,
      pickup_x_m: contest==='break'?toMetersX(pickup.x):null, pickup_y_m: contest==='break'?toMetersY(pickup.y):null,
      break_displacement_m: contest==='break'? +breakDispM(landing.x,landing.y,pickup.x,pickup.y).toFixed(2):null
    };
  }

  function saveEvent(){
    const err=validate(); if (err){alert(err);return;}
    const ev=buildEvent();
    const idx = events.findIndex(r=>r.id===ev.id);
    if (idx>=0) events[idx]=ev; else events=[ev,...events];
    persist(); clearPoints(); editingId=null; targetPlayer='';
  }

  function delEvent(id){
    if(!confirm('Delete this event?')) return;
    events = events.filter(e=>e.id!==id); persist();
    if (editingId===id){ editingId=null; clearPoints(); }
  }
  function loadToForm(e){
    editingId=e.id;
    team=e.team||''; opponent=e.opponent||''; period=e.period||'H1'; clock=e.clock||'';
    outcome=e.outcome; contest=e.contest_type; breakOutcome=e.break_outcome||'';
    targetPlayer=e.target_player || '';                        // NEW
    scored20=!!e.scored_20s; ourGoalAtTop=!!e.our_goal_at_top;
    timeToTee = e.time_to_tee_s==null ? '' : String(e.time_to_tee_s);
    totalTime = e.total_time_s==null ? '' : String(e.total_time_s);
    matchDate = e.match_date || (e.created_at || '').slice(0,10) || new Date().toISOString().slice(0,10);
    landing={x:e.x,y:e.y};
    pickup=(e.pickup_x==null||e.pickup_y==null)?{x:NaN,y:NaN}:{x:e.pickup_x,y:e.pickup_y};
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function exportCSV(){
    const headers=['id','created_at','match_date','team','opponent','period','clock',
      'target_player',                                  // NEW
      'outcome','contest_type','break_outcome',
      'time_to_tee_s','total_time_s','scored_20s',
      'x','y','x_m','y_m','depth_from_own_goal_m','side_band','depth_band','zone_code','our_goal_at_top',
      'pickup_x','pickup_y','pickup_x_m','pickup_y_m','break_displacement_m'];
    const rows=[headers.join(',')].concat(
      events.map(e=>headers.map(h=>{
        const v=e[h]; return typeof v==='number' ? `"${v}"` : `"${String(v??'').replace(/"/g,'""')}"`;
      }).join(','))
    ).join('\n');
    const blob=new Blob([rows],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='kickout_events.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // ---- Opponent & Player choices (normalized unique) ----
  $: opponentChoices = Object.entries(
    events.reduce((acc, e) => { const k=norm(e.opponent), label=(e.opponent||'').trim(); if(k&&label) acc[k]=label; return acc; }, /** @type {Record<string,string>} */ ({}))
  ).sort((a,b)=>a[1].localeCompare(b[1])); // [key,label]

  $: playerChoices = Object.entries(
    events.reduce((acc, e) => { const k=norm(e.target_player), label=(e.target_player||'').trim(); if(k&&label) acc[k]=label; return acc; }, /** @type {Record<string,string>} */ ({}))
  ).sort((a,b)=>a[1].localeCompare(b[1]));

  // toggle helpers that REASSIGN Sets (forces reactivity)
  function toggleContest(val){ const s=new Set(fContest); s.has(val)?s.delete(val):s.add(val); fContest=s; }
  function toggleOutcome(val){ const s=new Set(fOutcome); s.has(val)?s.delete(val):s.add(val); fOutcome=s; }

  // filtered events for BOTH visualisations (pitch + heatmap) and KPIs
  $: vizEvents = events.filter(e => {
    const passOpp = oppFilter==='ALL' || norm(e.opponent)===oppFilter;
    const passPly = plyFilter==='ALL' || norm(e.target_player)===plyFilter;
    let passYTD = true;
    if (ytdOnly) {
      const d = getEventDate(e); const t=d.getTime();
      passYTD = Number.isFinite(t) && d.getFullYear()===currentYear && t<=today.getTime();
    }
    const passCO = !useFilters || (fContest.has(e.contest_type) && fOutcome.has(e.outcome));
    return passOpp && passPly && passYTD && passCO;
  });

  // overlays (landing/pickup)
  $: overlays = vizEvents
    .map(e => overlayMode==='landing'
      ? { x:e.x, y:e.y, outcome:e.outcome, contest_type:e.contest_type, target:e.target_player }
      : (e.pickup_x==null||e.pickup_y==null ? null : { x:e.pickup_x, y:e.pickup_y, outcome:e.outcome, contest_type:e.contest_type, target:e.target_player })
    ).filter(Boolean);

  // ---- KPIs (use vizEvents) ----
  const ZSIDES=['L','C','R'], ZDEPTH=['S','M','L','V']; // Short/Med/Long/Very
  const zoneKey = (s,d)=>`${s}-${d}`;
  const RETAINED = new Set(['Retained','Score']);

  $: zoneStats = (() => {
    const z = {};
    for (const S of ZSIDES) for (const D of ZDEPTH) z[zoneKey(S,D)] = {tot:0, ret:0, brTot:0, brWon:0};
    for (const e of vizEvents) {
      const key = e.zone_code;
      if (!z[key]) continue;
      z[key].tot++;
      if (RETAINED.has(e.outcome)) z[key].ret++;
      if (e.contest_type==='break') { z[key].brTot++; if (e.break_outcome==='won') z[key].brWon++; }
    }
    return z;
  })();

  $: zoneTableRet = ZDEPTH.map(D => ({
    D,
    cells: ZSIDES.map(S => {
      const st = zoneStats[zoneKey(S, D)] || { tot: 0, ret: 0 };
      const pct = st.tot ? (100 * st.ret / st.tot) : 0;
      return { tot: st.tot, ret: st.ret, pct };
    })
  }));

  $: zoneTableBreak = ZDEPTH.map(D => ({
    D,
    cells: ZSIDES.map(S => {
      const st = zoneStats[zoneKey(S, D)] || { brTot: 0, brWon: 0 };
      const pct = st.brTot ? (100 * st.brWon / st.brTot) : 0;
      return { tot: st.brTot, won: st.brWon, pct };
    })
  }));

  $: overallBreak = (() => {
    let tot=0, won=0;
    for (const e of vizEvents) if (e.contest_type==='break'){ tot++; if (e.break_outcome==='won') won++; }
    return {tot, won, pct: tot? (100*won/tot) : 0};
  })();

  function cellColor(pct){ const t=Math.max(0,Math.min(1,pct/100)); const h=120*t; return `hsl(${h} 70% 45% / 0.25)`; }
</script>

<div class="container">
  <h1>Kickout — Capture</h1>

  <div class="controls">
    <label>Contest:
      <select bind:value={contest}>
        {#each CONTESTS as c}<option value={c}>{c}</option>{/each}
      </select>
    </label>
    <label>Outcome:
      <select bind:value={outcome}>
        {#each OUTCOMES as o}<option>{o}</option>{/each}
      </select>
    </label>
    {#if contest==='break'}
      <label>Break outcome:
        <select bind:value={breakOutcome}>
          <option value="" disabled selected hidden>Select…</option>
          {#each BREAK_OUTS as b}<option value={b}>{b}</option>{/each}
        </select>
      </label>
    {/if}
  </div>

  <div class="controls">
    <label>Team <input bind:value={team} placeholder="Clontarf" /></label>
    <label>Opponent <input bind:value={opponent} placeholder="Crokes" /></label>
    <label>Target player
      <input list="players" bind:value={targetPlayer} placeholder="e.g. Leo" />
      <datalist id="players">
        {#each playerChoices as [,label]}<option value={label}></option>{/each}
      </datalist>
    </label>
    <label>Match date <input type="date" bind:value={matchDate} /></label>
    <label>Period <select bind:value={period}><option>H1</option><option>H2</option></select></label>
    <label>Clock <input bind:value={clock} placeholder="12:34" /></label>
    <label><input type="checkbox" bind:checked={ourGoalAtTop}/> Our goal at top</label>
  </div>

  <div class="controls">
    <label>Time to tee (s) <input inputmode="decimal" bind:value={timeToTee} placeholder="e.g. 4.2" /></label>
    <label>Total time (s) <input inputmode="decimal" bind:value={totalTime} placeholder="e.g. 11.0" /></label>
    <label><input type="checkbox" bind:checked={scored20}/> Scored ≤20s</label>
    <button on:click={clearPoints}>Clear points</button>
    <button class="primary" on:click={saveEvent}>{editingId?'Update event':'Save event'}</button>
    <button on:click={exportCSV}>Export CSV</button>
  </div>

  <!-- Viz filter UI -->
  <div class="legend">
    <div>Heatmap source:
      <label><input type="radio" bind:group={overlayMode} value="landing"> landing</label>
      <label><input type="radio" bind:group={overlayMode} value="pickup"> pickup</label>
    </div>
    <div>
      <label><input type="checkbox" bind:checked={useFilters}> use contest/outcome filters</label>
    </div>
  </div>
  <div class="filters">
    <div>
      Contest:
      {#each CONTESTS as c}
        <label><input type="checkbox" checked={fContest.has(c)} on:change={() => toggleContest(c)}/> {c}</label>
      {/each}
    </div>
    <div>
      Outcome:
      {#each OUTCOMES as o}
        <label><input type="checkbox" checked={fOutcome.has(o)} on:change={() => toggleOutcome(o)}/> {o}</label>
      {/each}
    </div>
    <div>
      Opponent:
      <select bind:value={oppFilter}>
        <option value="ALL">All opponents</option>
        {#each opponentChoices as [key,label]}<option value={key}>{label}</option>{/each}
      </select>
      Player:
      <select bind:value={plyFilter}>
        <option value="ALL">All players</option>
        {#each playerChoices as [key,label]}<option value={key}>{label}</option>{/each}
      </select>
      <label><input type="checkbox" bind:checked={ytdOnly}/> YTD ({currentYear})</label>
      <button on:click={() => { oppFilter='ALL'; plyFilter='ALL'; ytdOnly=false; }}>Clear</button>
    </div>
  </div>

  <!-- Pitch with markers (filtered) -->
  <Pitch
    contestType={contest}
    landing={landing}
    pickup={pickup}
    overlays={overlays}
    on:landed={onLanding}
    on:picked={onPickup}
  />

  <!-- Heatmap (filtered) -->
  <h2>Heatmap</h2>
  <Heatmap points={overlays} cols={140} radius={3} smooth={2} />

  <p class="coords">
    Landing: {Number.isNaN(landing.x)?'-':landing.x.toFixed(3)}, {Number.isNaN(landing.y)?'-':landing.y.toFixed(3)}
    {#if contest==='break'}
      &nbsp;|&nbsp; Pickup: {Number.isNaN(pickup.x)?'-':pickup.x.toFixed(3)}, {Number.isNaN(pickup.y)?'-':pickup.y.toFixed(3)}
    {/if}
  </p>

  <!-- KPIs (filtered) -->
  <h2>KPIs</h2>

  <div class="kpi">
    <div class="kpi-title">Retention by Zone (S/M/L/V × L/C/R)</div>
    <table class="kpi-table">
      <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
      <tbody>
        {#each zoneTableRet as row}
          <tr>
            <th>{row.D}</th>
            {#each row.cells as c}
              <td style="background:{cellColor(c.pct)}" title={`${c.ret}/${c.tot}`}>
                {c.tot ? `${Math.round(c.pct)}%` : '-'}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="kpi">
    <div class="kpi-title">
      Break Win-Rate (overall: {overallBreak.tot ? Math.round(overallBreak.pct)+'%' : '-'} — {overallBreak.won}/{overallBreak.tot})
    </div>
    <table class="kpi-table">
      <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
      <tbody>
        {#each zoneTableBreak as row}
          <tr>
            <th>{row.D}</th>
            {#each row.cells as c}
              <td style="background:{cellColor(c.pct)}" title={`${c.won}/${c.tot}`}>
                {c.tot ? `${Math.round(c.pct)}%` : '-'}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  </div> <!-- closes Break Win-Rate KPI -->

  <!-- Per-player metrics -->
  <h2>Per-Player Metrics</h2>
  <div class="tablewrap">
    <table>
      <thead>
        <tr><th>Player</th><th>Total</th><th>Retained</th><th>% Retained</th></tr>
      </thead>
      <tbody>
        {#each Object.entries(playerStats) as [p, st]}
          <tr>
            <td>{p}</td>
            <td>{st.tot}</td>
            <td>{st.ret}</td>
            <td>{st.tot ? Math.round(100*st.ret/st.tot)+'%' : '-'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Unfiltered saved list -->
  <!-- Unfiltered saved list -->
  <h2>Saved events</h2>
  <div class="tablewrap">
    <table>
      <thead>
        <tr>
          <th>Match date</th><th>Time</th><th>Target</th><th>Outcome</th><th>Contest</th><th>Break</th>
          <th>Tee(s)</th><th>Total(s)</th><th>Scored≤20s</th>
          <th>Side</th><th>Depth</th><th>Depth(m)</th>
          <th>x,y</th><th>pickup x,y</th><th>Δbreak(m)</th>
          <th>Team</th><th>Opp</th><th></th>
        </tr>
      </thead>
      <tbody>
        {#each events as e}
          <tr>
            <td>{e.match_date || (e.created_at||'').slice(0,10)}</td>
            <td>{e.period} {e.clock}</td>
            <td>{e.target_player || '-'}</td>
            <td>{e.outcome}</td>
            <td>{e.contest_type}</td>
            <td>{e.break_outcome||'-'}</td>
            <td>{e.time_to_tee_s ?? '-'}</td>
            <td>{e.total_time_s ?? '-'}</td>
            <td>{e.scored_20s? '✓' : '-'}</td>
            <td>{e.side_band}</td>
            <td>{e.depth_band}</td>
            <td>{e.depth_from_own_goal_m?.toFixed?.(1)}</td>
            <td>{e.x.toFixed(2)}, {e.y.toFixed(2)}</td>
            <td>{e.pickup_x==null ? '-' : `${e.pickup_x.toFixed(2)}, ${e.pickup_y.toFixed(2)}`}</td>
            <td>{e.break_displacement_m==null ? '-' : e.break_displacement_m.toFixed(1)}</td>
            <td>{e.team}</td>
            <td>{e.opponent}</td>
            <td class="actions">
              <button on:click={() => loadToForm(e)}>Load</button>
              <button class="danger" on:click={() => delEvent(e.id)}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .container{max-width:980px;margin:16px auto;padding:8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222}
  h1{font-weight:600;font-size:20px;margin:0 0 8px}
  h2{font-weight:600;font-size:16px;margin:12px 0 6px}
  .controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:8px 0 12px}
  label{display:flex;gap:6px;align-items:center;font-size:14px}
  input,select{padding:6px 8px;border:1px solid #ccc;border-radius:6px}
  button{padding:6px 10px;border:1px solid #bbb;border-radius:6px;background:#fff;cursor:pointer}
  button:hover{background:#f6f6f6}
  .primary{background:#111;color:#fff;border-color:#111}
  .danger{border-color:#b33;color:#b33}
  .coords{margin-top:8px;font-size:14px;color:#444}
  .legend{display:flex;gap:18px;align-items:center;margin:6px 0 2px;font-size:13px;color:#333}
  .filters{display:flex;gap:24px;flex-wrap:wrap;margin:4px 0 8px}
  .filters label{gap:4px}
  .kpi{margin:12px 0}
  .kpi-title{font-weight:600;margin-bottom:4px}
  .kpi-table{border-collapse:collapse;font-size:13px;min-width:360px}
  .kpi-table th,.kpi-table td{border:1px solid #e5e7eb;padding:6px 8px;text-align:center}
  .tablewrap{overflow:auto;border:1px solid #ddd;border-radius:6px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:6px 8px;border-top:1px solid #eee;text-align:left;white-space:nowrap}
  thead th{background:#f7f7f7;position:sticky;top:0}
  .actions{display:flex;gap:6px}
</style>
