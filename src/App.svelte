<script>
  import Pitch from './lib/Pitch.svelte';
  import KPIs from './lib/KPIs.svelte';
  import { ui, filtered, addEvent } from './lib/stores';
  import { displacement } from './lib/pitch-geometry';

  let form = {
    match_date: '', team: '', opponent: '',
    period: '1', clock: '', target_player: '',
    contest_type: 'clean', outcome: 'retained',
    break_outcome: 'won', time_to_tee_s: 0, total_time_s: 0, scored_20s: false,
  };

  let draft = { landing: null, pickup: null };

  function onLanding(e) { draft.landing = e.detail.landing; draft.pickup = null; }
  function onPickup(e) { draft.pickup = e.detail.pickup; }

  function save() {
    if (!draft.landing) return alert('Click the pitch to set a landing point.');
    const base = {
      ...form, our_goal_at_top: $ui.ourGoalAtTop,
      x: draft.landing.x, y: draft.landing.y,
      x_m: draft.landing.x_m, y_m: draft.landing.y_m,
      depth_from_own_goal_m: draft.landing.depth_from_own_goal_m,
      side_band: draft.landing.side_band, depth_band: draft.landing.depth_band,
      zone_code: draft.landing.zone_code,
    };
    const row = (form.contest_type === 'break' && draft.pickup)
      ? { ...base, pickup_x: draft.pickup.x, pickup_y: draft.pickup.y, break_displacement_m: displacement(draft.landing, draft.pickup) }
      : base;
    addEvent(row);
    draft = { landing: null, pickup: null };
  }
</script>

<header style="position:sticky;top:0;background:#0b1220;color:#fff;padding:.6rem 1rem;display:flex;justify-content:space-between;align-items:center">
  <strong>Kickout — NO HEATMAP v2</strong>
  <label><input type="checkbox" bind:checked={$ui.ourGoalAtTop}> Our goal at top</label>
</header>

<main style="padding:1rem;display:grid;gap:1rem;grid-template-columns:minmax(280px,480px) 1fr">
  <section style="background:#fff;border:1px solid #eee;border-radius:12px;padding:1rem">
    <h2>Capture</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1rem">
      <label>Match date <input type="date" bind:value={form.match_date}></label>
      <label>Period
        <select bind:value={form.period}>
          <option value="1">1</option><option value="2">2</option><option value="ET1">ET1</option><option value="ET2">ET2</option>
        </select>
      </label>
      <label>Team <input bind:value={form.team}></label>
      <label>Opponent <input bind:value={form.opponent}></label>
      <label>Clock <input bind:value={form.clock} placeholder="mm:ss"></label>
      <label>Target player <input bind:value={form.target_player}></label>
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

    <div style="margin-top:.75rem"></div>
    <Pitch ourGoalAtTop={$ui.ourGoalAtTop}
           contest_type={form.contest_type}
           {draft}
           on:landing={onLanding}
           on:pickup={onPickup} />

    <div style="margin-top:.75rem;display:flex;gap:.75rem">
      <button on:click={save} style="background:#1f7aec;color:#fff;border:none;padding:.5rem .75rem;border-radius:10px">Save</button>
      <button on:click={() => draft = { landing:null, pickup:null }}>Clear points</button>
    </div>
  </section>

  <section style="background:#fff;border:1px solid #eee;border-radius:12px;padding:1rem">
    <h2>KPIs</h2>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
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
    </div>

    <!-- Keep KPIs table -->
    <KPIs />
  </section>
</main>
