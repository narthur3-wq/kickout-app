<script>
  import Pitch from './Pitch.svelte';
  import { events, meta } from '../stores.js';
  import { onMount } from 'svelte';
  import {
    jerseyNums,
    toMetersX, toMetersY,
    depthFromKickerGoal, sideBand, depthBand, zoneCode
  } from './field.js';

  const SIDES = ['us','opp'];
  const CONTESTS = [
    { key:'clean', label:'Clean' },
    { key:'break', label:'Break' },
    { key:'foul',  label:'Foul'  },
    { key:'out',   label:'Sideline' }
  ];

  let side='us';
  let contest='clean';
  let win=true;

  let landing={x:NaN,y:NaN};
  let targetPlayer='';
  let presserPlayer='';
  let oppReceiver='';

  let showNumbers=true;
  let overlayFilter='';
  let showStats=true;  // << bring back per-player stats

  // Wake-lock (optional)
  let lock=null;
  async function ensureWake() {
    if (!$meta.wake_lock || !('wakeLock' in navigator)) return;
    try { lock = await navigator.wakeLock.request('screen'); } catch {}
  }
  onMount(() => {
    ensureWake();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) ensureWake();
    });
  });

  $: $meta;

  function onLanding(e){ landing=e.detail; }
  function clearPoints(){ landing={x:NaN,y:NaN}; }

  function validate(){
    if (Number.isNaN(landing.x)||Number.isNaN(landing.y)) return 'Tap the pitch to set landing.';
    return '';
  }

  function buildEvent(){
    // Landscape: depth along X, side-bands across Y
    const d = depthFromKickerGoal(landing.x, $meta.kicking_goal_top); // "Goal at left"
    return {
      id: Date.now(),
      created_at: new Date().toISOString(),
      match_date: new Date().toISOString().slice(0,10),
      team: $meta.team, opponent: $meta.opponent,
      side,
      contest_type: contest,
      win,
      x: landing.x, y: landing.y,
      x_m: toMetersX(landing.x),
      y_m: toMetersY(landing.y),
      side_band: sideBand(landing.y),
      depth_band: depthBand(d),
      zone_code: zoneCode(landing.x, landing.y, $meta.kicking_goal_top),
      kicking_goal_top: $meta.kicking_goal_top,
      target_player: side==='us' ? (targetPlayer||'') : '',
      presser_player: side==='opp' ? (presserPlayer||'') : '',
      opponent_receiver: side==='opp' ? (oppReceiver||'') : ''
    };
  }

  function saveEvent(){
    const err=validate(); if (err){ alert(err); return; }
    events.update(list => [buildEvent(), ...list]);
    clearPoints();
    if (side==='us') targetPlayer=''; else { presserPlayer=''; oppReceiver=''; }
    navigator.vibrate?.(20);
  }
  function undoLast(){ events.update(list => list.slice(1)); }
  function delEvent(id){ if(!confirm('Delete this event?')) return; events.update(list => list.filter(e=>e.id!==id)); }
  function loadToForm(e){
    side = e.side; win = !!e.win; contest = e.contest_type;
    targetPlayer = e.target_player||''; presserPlayer = e.presser_player||''; oppReceiver = e.opponent_receiver||'';
    landing = { x:e.x, y:e.y };
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function exportCSV(){
    const headers=['id','created_at','match_date','team','opponent','side','contest_type','win','x','y','x_m','y_m','side_band','depth_band','zone_code','kicking_goal_top','target_player','presser_player','opponent_receiver'];
    const rows=[headers.join(',')].concat(
      $events.map(e=>headers.map(h=>{
        const v=e[h];
        return (typeof v==='number' || typeof v==='boolean') ? String(v) : '"'+String(v??'').replace(/"/g,'""')+'"';
      }).join(','))
    ).join('\n');
    const url=URL.createObjectURL(new Blob([rows],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url; a.download='kickouts.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // ---------- overlays & KPIs ----------
  const norm = s => (s||'').trim().toLowerCase();

  $: sideEventsAll = $events.filter(e=>e.side===side);

  $: filteredForOverlay = side==='us'
    ? sideEventsAll.filter(e => overlayFilter ? norm(e.target_player)===norm(overlayFilter) : true)
    : sideEventsAll.filter(e => overlayFilter ? (norm(e.presser_player)===norm(overlayFilter) || norm(e.opponent_receiver)===norm(overlayFilter)) : true);

  $: overlays = filteredForOverlay.map((e,i)=>({
    x:e.x, y:e.y, idx: filteredForOverlay.length - i,
    ct:e.contest_type, side:e.side, win:!!e.win
  }));

  $: ourPlayerStats = (()=> {
    const map=new Map();
    for (const e of $events){ if (e.side!=='us') continue; const key=norm(e.target_player); if(!key) continue;
      const m=map.get(key)||{label:(e.target_player||'—'), tot:0, win:0};
      m.tot++; if (e.win) m.win++; map.set(key,m);
    }
    return Array.from(map.values()).sort((a,b)=>b.tot-a.tot);
  })();

  $: presserStats = (()=> {
    const map=new Map();
    for (const e of $events){ if (e.side!=='opp') continue; const key=norm(e.presser_player); if(!key) continue;
      const m=map.get(key)||{label:(e.presser_player||'—'), tot:0, win:0};
      m.tot++; if (!e.win) m.win++; map.set(key,m);
    }
    return Array.from(map.values()).sort((a,b)=>b.tot-a.tot);
  })();

  // datalist choices
  $: ourReceiverChoices = Array.from(new Set($events.filter(e=>e.side==='us').map(e=>e.target_player).filter(Boolean))).sort();
  $: presserChoices     = Array.from(new Set($events.filter(e=>e.side==='opp').map(e=>e.presser_player).filter(Boolean))).sort();
  $: oppReceiverChoices = Array.from(new Set($events.filter(e=>e.side==='opp').map(e=>e.opponent_receiver).filter(Boolean))).sort();
</script>

<div class="container">
  <h1>Kickout — Live</h1>

  <!-- TOP BAR (extra compact) -->
  <div class="topbar">
    <div class="seg">
      <div class="segbtns">
        {#each SIDES as s}
          <button class:active={side===s} on:click={()=>{ side=s; clearPoints(); }}>{s==='us'?'Us':'Opposition'}</button>
        {/each}
      </div>
    </div>

    <label class="inline" for="goalLeft">
      <input id="goalLeft" type="checkbox" bind:checked={$meta.kicking_goal_top}/>
      Goal at left
    </label>

    <input class="grow" aria-label="Team"     bind:value={$meta.team}     placeholder="Our team" />
    <input class="grow" aria-label="Opponent" bind:value={$meta.opponent} placeholder="Opposition" />
  </div>

  <!-- Contest / Result -->
  <div class="controls">
    <div class="seg">
      <span class="seglabel">Contest</span>
      <div class="segbtns">
        {#each CONTESTS as c}
          <button class:active={contest===c.key} on:click={()=>{ contest=c.key; }}>{c.label}</button>
        {/each}
      </div>
    </div>
    <div class="seg">
      <span class="seglabel">Result</span>
      <div class="segbtns">
        <button class:active={win===true}  on:click={()=> win=true }>Win</button>
        <button class:active={win===false} on:click={()=> win=false }>Loss</button>
      </div>
    </div>
  </div>

  <!-- Players / Pressers -->
  <div class="controls">
    {#if side==='us'}
      <div class="seg">
        <span class="seglabel">Receivers (tap)</span>
        <div class="chips-row">
          {#each jerseyNums as n}<button class="chip" on:click={()=> targetPlayer=String(n)}>{n}</button>{/each}
        </div>
      </div>
      <input aria-label="Target player" list="players" bind:value={targetPlayer} placeholder="e.g. 14 – Murphy" />
      <datalist id="players">{#each ourReceiverChoices as p}<option value={p}></option>{/each}</datalist>

    {:else}
      <div class="seg">
        <span class="seglabel">Pressers (tap)</span>
        <div class="chips-row">
          {#each jerseyNums as n}<button class="chip" on:click={()=> presserPlayer=String(n)}>{n}</button>{/each}
        </div>
      </div>
      <input aria-label="Our presser" list="pressers" bind:value={presserPlayer} placeholder="e.g. 5 – Walsh" />
      <datalist id="pressers">{#each presserChoices as p}<option value={p}></option>{/each}</datalist>
      <input aria-label="Opponent receiver" list="opprecv" bind:value={oppReceiver} placeholder="Opponent receiver (optional)" />
      <datalist id="opprecv">{#each oppReceiverChoices as p}<option value={p}></option>{/each}</datalist>
    {/if}
  </div>

  <!-- Filters -->
  <div class="controls">
    <label for="showNums" class="inline">
      <input id="showNums" type="checkbox" bind:checked={showNumbers}/>
      Show numbers
    </label>

    {#if side==='us'}
      <input list="ovrPlayers" bind:value={overlayFilter} placeholder="All players" />
      <datalist id="ovrPlayers">{#each ourReceiverChoices as p}<option value={p}></option>{/each}</datalist>
    {:else}
      <input list="ovrPressers" bind:value={overlayFilter} placeholder="All pressers/receivers" />
      <datalist id="ovrPressers">
        {#each presserChoices as p}<option value={p}></option>{/each}
        {#each oppReceiverChoices as p}<option value={p}></option>{/each}
      </datalist>
    {/if}

    <button on:click={()=>overlayFilter=''}>Clear filter</button>
    <button class="ghost" on:click={()=>showStats=!showStats}>{showStats?'Hide':'Show'} stats</button>
  </div>

  <Pitch overlays={overlays} landing={landing} showLabels={showNumbers} on:landed={onLanding} />

  <!-- Compact stats -->
  {#if showStats}
    <div class="kpi">
      {#if side==='us'}
        <div class="kpi-title">By player</div>
        <table class="kpi-table">
          <thead><tr><th>Player</th><th>Att</th><th>Wins</th><th>%</th></tr></thead>
          <tbody>{#each ourPlayerStats as p}<tr><td>{p.label}</td><td>{p.tot}</td><td>{p.win}</td><td>{p.tot?Math.round(100*p.win/p.tot):0}%</td></tr>{/each}</tbody>
        </table>
      {:else}
        <div class="kpi-title">By presser (press wins)</div>
        <table class="kpi-table">
          <thead><tr><th>Presser</th><th>Contests</th><th>Wins</th><th>%</th></tr></thead>
          <tbody>{#each presserStats as p}<tr><td>{p.label}</td><td>{p.tot}</td><td>{p.win}</td><td>{p.tot?Math.round(100*p.win/p.tot):0}%</td></tr>{/each}</tbody>
        </table>
      {/if}
    </div>
  {/if}

  <div class="actions-bar">
    <button on:click={clearPoints}>Clear points</button>
    <button class="danger" on:click={undoLast}>Undo</button>
    <button class="primary" on:click={saveEvent}>Save</button>
    <button on:click={exportCSV}>Export CSV</button>
  </div>
</div>

<style>
  h1{font-weight:700;font-size:22px;margin:0 0 8px}

  .topbar{
    display:grid;
    grid-template-columns:auto auto minmax(180px,1fr) minmax(180px,1fr);
    gap:8px 10px; align-items:center; margin:6px 0 6px;
  }

  .controls{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:6px 0 8px}
  .inline{display:inline-flex;gap:6px;align-items:center}

  .seg{display:flex;flex-direction:column;gap:4px}
  .seglabel{font-weight:600}
  .segbtns{display:flex;gap:6px}
  .segbtns button{border-radius:8px;padding:6px 10px}
  .segbtns .active{background:#111;color:#fff;border-color:#111}

  input{padding:6px 8px;border:1px solid #ccc;border-radius:8px}
  input.grow{min-width:0}
  button{padding:6px 10px;border:1px solid #bbb;border-radius:8px;background:#fff;cursor:pointer}
  button:hover{background:#f6f6f6}
  .ghost{background:#fff;border-color:#ddd;color:#111}
  .primary{background:#111;color:#fff;border-color:#111}
  .danger{border-color:#b33;color:#b33}

  .chips{display:flex;gap:8px;align-items:center}
  .chips-row{display:flex;gap:6px;flex-wrap:wrap}
  .chip{min-width:32px;height:32px;border-radius:8px}

  .kpi{margin:10px 0}
  .kpi-title{font-weight:600;margin:6px 0 4px}
  .kpi-table{border-collapse:collapse;font-size:13px;min-width:360px}
  .kpi-table th,.kpi-table td{border:1px solid #e5e7eb;padding:6px 8px;text-align:center}

  .actions-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #eee;padding:8px;display:flex;gap:8px;justify-content:flex-end;z-index:5}
</style>
