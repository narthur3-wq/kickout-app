# File: src/App.svelte
<script>
  import Pitch from './lib/Pitch.svelte';
  import KPIs from './lib/KPIs.svelte';
  import { events, ui, filtered, addEvent, downloadCsv, dedupe } from './lib/stores';
  import { displacement } from './lib/pitch-geometry';

  let form = {
    match_date: '', team: '', opponent: '', period: '1', clock: '',
    target_player: '', contest_type: 'clean', outcome: 'retained',
    break_outcome: 'won', time_to_tee_s: 0, total_time_s: 0, scored_20s: false,
  };

  let draft = { landing: null, pickup: null };
  let teeTimer = null, totalTimer = null;
  let teeStart = 0, totalStart = 0;

  function startTee() { teeStart = Date.now(); clearInterval(teeTimer); teeTimer = setInterval(()=>form.time_to_tee_s = Math.floor((Date.now()-teeStart)/1000), 250); }
  function stopTee()  { if (!teeTimer) return; clearInterval(teeTimer); teeTimer = null; }
  function resetTee() { stopTee(); form.time_to_tee_s = 0; }

  function startTotal(){ totalStart=Date.now(); clearInterval(totalTimer); totalTimer=setInterval(()=>form.total_time_s=Math.floor((Date.now()-totalStart)/1000),250); }
  function stopTotal(){ if (!totalTimer) return; clearInterval(totalTimer); totalTimer=null; }
  function resetTotal(){ stopTotal(); form.total_time_s=0; }

  function onLanding(e) { draft.landing = e.detail.landing; draft.pickup = null; }
  function onPickup(e) { draft.pickup = e.detail.pickup; }

  function save() {
    if (!draft.landing) return alert('Click the pitch to set a landing point.');
    const base = {
      ...form,
      our_goal_at_top: $ui.ourGoalAtTop,
      x: draft.landing.x, y: draft.landing.y,
      x_m: draft.landing.x_m, y_m: draft.landing.y_m,
      depth_from_own_goal_m: draft.landing.depth_from_own_goal_m,
      side_band: draft.landing.side_band, depth_band: draft.landing.depth_band,
      zone_code: draft.landing.zone_code,
    };
    let row = base;
    if (form.contest_type === 'break' && draft.pickup) {
      row = {
        ...base,
        pickup_x: draft.pickup.x, pickup_y: draft.pickup.y,
        break_displacement_m: displacement(draft.landing, draft.pickup)
      };
    }
    addEvent(row);
    draft = { landing: null, pickup: null };
  }

  function clearPoints(){ draft = { landing: null, pickup: null }; }

  // keyboard shortcuts: t/y = tee/total, Enter save, c clear
  function onKey(e){
    if (e.key === 't') startTee();
    if (e.key === 'y') startTotal();
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'c') clearPoints();
  }
</script>

<svelte:window on:keydown={onKey} />

<header class="topbar">
  <div class="left">
    <strong>Kickout App — no-heatmap v1</strong>
    <label><input type="checkbox" bind:checked={$ui.ourGoalAtTop}> Our goal at top</label>
  </div>
  <div class="timers">
    <div class="timer">
      <span>Tee</span>
      <div class="seg">{form.time_to_tee_s}s</div>
      <div class="btns">
        <button on:click={startTee} title="t">Start</button>
        <button on:click={stopTee}>Stop</button>
        <button on:click={resetTee}>Reset</button>
      </div>
    </div>
    <div class="timer">
      <span>Total</span>
      <div class="seg">{form.total_time_s}s</div>
      <div class="btns">
        <button on:click={startTotal} title="y">Start</button>
        <button on:click={stopTotal}>Stop</button>
        <button on:click={resetTotal}>Reset</button>
      </div>
    </div>
  </div>
</header>

<main class="layout">
  <section class="pane form">
    <h2>Capture</h2>
    <div class="grid two">
      <label>Match date <input type="date" bind:value={form.match_date}></label>
      <label>Period
        <select bind:value={form.period}>
          <option value="1">1</option><option value="2">2</option><option value="ET1">ET1</option><option value="ET2">ET2</option>
        </select>
      </label>
      <label>Team <input bind:value={form.team} placeholder="Our team"></label>
      <label>Opponent <input bind:value={form.opponent}></label>
      <label>Clock <input bind:value={form.clock} placeholder="mm:ss"></label>
      <label>Target player <input bind:value={form.target_player} placeholder="Name"></label>
      <label>Contest
        <select bind:value={form.contest_type}>
          <option>clean</option><option>break</option><option>foul</option><option>out</option>
        </select>
      </label>
      <label>Outcome
        <select bind:value={form.outcome}>
          <option>retained</option><option>lost</option><option>neutral</option>
        </select>
      </label>
      {#if form.contest_type === 'break'}
      <label>Break outcome
        <select bind:value={form.break_outcome}>
          <option>won</option><option>lost</option><option>neutral</option>
        </select>
      </label>
      {/if}
      <label><input type="checkbox" bind:checked={form.scored_20s}> Scored ≤20s</label>
    </div>

    <Pitch ourGoalAtTop={$ui.ourGoalAtTop}
           contest_type={form.contest_type}
           {draft}
           on:landing={onLanding}
           on:pickup={onPickup} />

    <div class="actions">
      <button class="primary" on:click={save}>Save (Enter)</button>
      <button on:click={clearPoints}>Clear points (c)</button>
    </div>
  </section>

  <section class="pane analytics">
    <h2>KPIs</h2>
    <div class="filters">
      <input placeholder="Opponent" bind:value={$ui.filters.opponent}>
      <input placeholder="Player" bind:value={$ui.filters.player}>
      <label><input type="checkbox" bind:checked={$ui.filters.ytd}> YTD</label>
      <select bind:value={$ui.filters.contest}>
        <option value="all">Any contest</option>
        <option value="clean">Clean</option>
        <option value="break">Break</option>
        <option value="foul">Foul</option>
        <option value="out">Out</option>
      </select>
      <select bind:value={$ui.filters.outcome}>
        <option value="all">Any outcome</option>
        <option value="retained">Retained</option>
        <option value="lost">Lost</option>
        <option value="neutral">Neutral</option>
      </select>
      <button on:click={() => downloadCsv('kickouts-filtered', $filtered)}>Export CSV</button>
    </div>

    <KPIs />

    <h3>Events ({$filtered.length})</h3>
    <div class="events">
      {#each $filtered as e}
        <div class="row">
          <div>{e.match_date} {e.clock}</div>
          <div>{e.team} vs {e.opponent}</div>
          <div>{e.zone_code}</div>
          <div>{e.outcome}</div>
        </div>
      {/each}
    </div>
  </section>
</main>

<style>
  :global(html,body,#app){ height: 100%; }
  .topbar{ position: sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.5rem .75rem; background:#0b1220; color:white; }
  .topbar .left{ display:flex; align-items:center; gap:1rem; }
  .topbar input[type="checkbox"]{ margin-right:.5rem; }
  .timers{ display:flex; gap:1rem; }
  .timer{ display:flex; align-items:center; gap:.5rem; }
  .seg{ font-variant-numeric: tabular-nums; background:#111827; padding:.25rem .5rem; border-radius:8px; }

  .layout{ display:grid; grid-template-columns: minmax(280px, 480px) 1fr; gap:1rem; padding:1rem; }
  @media (max-width: 900px){ .layout{ grid-template-columns: 1fr; } }

  .pane{ background:white; border:1px solid #eee; border-radius:14px; padding:1rem; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  .pane h2{ margin-top:0; }

  .grid.two{ display:grid; grid-template-columns: 1fr 1fr; gap:.5rem 1rem; }
  .grid.two > label{ display:flex; flex-direction:column; font-size:.9rem; gap:.25rem; }
  @media (max-width: 700px){ .grid.two{ grid-template-columns: 1fr; } }

  .actions{ display:flex; gap:.75rem; margin-top:.75rem; }
  .primary{ background:#1f7aec; color:white; border:none; padding:.5rem .75rem; border-radius:10px; }

  .filters{ display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
  .filters input, .filters select{ padding:.4rem .5rem; border:1px solid #e5e7eb; border-radius:8px; }

  .events{ display:grid; gap:.25rem; margin-top:.5rem; }
  .row{ display:grid; grid-template-columns: 8rem 1fr 5rem 6rem; gap:.5rem; padding:.4rem .5rem; border:1px solid #f0f2f5; border-radius:8px; }
  @media (max-width: 700px){ .row{ grid-template-columns: 1fr; } }
</style>



