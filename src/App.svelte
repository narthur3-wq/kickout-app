<script>
  import { onMount } from 'svelte';
  import Pitch from './lib/Pitch.svelte';

  // --- Pitch dimensions for labels / conversions (if needed) ---
  const WIDTH_M  = 90;
  const LENGTH_M = 145;

  // --- Options ---
  const CONTESTS = /** @type {const} */ (['clean','break','foul','out']);
  const OUTCOMES = /** @type {const} */ (['Retained','Lost','Score','Wide','Out','Foul']);

  // --- Capture state ---
  let contest = /** @type {'clean'|'break'|'foul'|'out'} */ ('clean');
  let outcome = /** @type {'Retained'|'Lost'|'Score'|'Wide'|'Out'|'Foul'} */ ('Retained');

  let team = '';
  let opponent = '';
  let matchDate = new Date().toISOString().slice(0,10);

  let targetPlayer = '';
  let ourGoalAtTop = true;

  let landing = { x: NaN, y: NaN };
  let pickup  = { x: NaN, y: NaN };

  /** @typedef {{
   *  id:number, created_at:string, match_date:string, team:string, opponent:string,
   *  outcome:string, contest_type:string, target_player?:string,
   *  x:number, y:number, x_m:number, y_m:number, our_goal_at_top:boolean,
   *  pickup_x?:number|null, pickup_y?:number|null,
   * }} EventRow */
  /** @type {EventRow[]} */
  let events = [];

  // overlays for the pitch (filtered = all for now)
  $: overlays = events.map(e => ({
    x: e.x, y: e.y, outcome: e.outcome, contest_type: e.contest_type, target: e.target_player
  }));

  // --- Persistence for fixture (home/away sticks) and events ---
  onMount(() => {
    const fx = JSON.parse(localStorage.getItem('ko_fixture') || '{}');
    team = fx.team || team;
    opponent = fx.opponent || opponent;
    ourGoalAtTop = !!fx.our_goal_at_top;

    events = JSON.parse(localStorage.getItem('ko_events') || '[]');
  });

  function persistFixture() {
    localStorage.setItem('ko_fixture', JSON.stringify({ team, opponent, our_goal_at_top: ourGoalAtTop }));
  }
  function persistEvents() {
    localStorage.setItem('ko_events', JSON.stringify(events));
  }

  // --- Pitch event handlers ---
  function onLanded(ev) {
    landing = ev.detail;        // {x,y} normalized 0..1
    if (contest !== 'break') pickup = { x: NaN, y: NaN };
  }
  function onPicked(ev) {
    pickup = ev.detail;         // {x,y}
  }

  function clearPoints() {
    landing = { x: NaN, y: NaN };
    pickup  = { x: NaN, y: NaN };
  }

  function saveEvent() {
    if (Number.isNaN(landing.x) || Number.isNaN(landing.y)) return;

    const toMetersX = (nx) => nx * WIDTH_M;
    const toMetersY = (ny) => ny * LENGTH_M;

    /** @type {EventRow} */
    const row = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      match_date: matchDate,
      team: team.trim(),
      opponent: opponent.trim(),
      outcome,
      contest_type: contest,
      target_player: targetPlayer.trim() || undefined,
      x: landing.x, y: landing.y,
      x_m: +toMetersX(landing.x).toFixed(2),
      y_m: +toMetersY(landing.y).toFixed(2),
      our_goal_at_top: !!ourGoalAtTop,
      pickup_x: contest === 'break' && !Number.isNaN(pickup.x) ? pickup.x : null,
      pickup_y: contest === 'break' && !Number.isNaN(pickup.y) ? pickup.y : null
    };

    events = [row, ...events];
    persistEvents();
    clearPoints();
    targetPlayer = '';
  }

  function delEvent(id) {
    events = events.filter(e => e.id !== id);
    persistEvents();
  }

  // CSV export
  function exportCSV() {
    const headers = [
      'id','created_at','match_date','team','opponent','outcome','contest_type',
      'target_player','x','y','x_m','y_m','our_goal_at_top','pickup_x','pickup_y'
    ];
    const rows = [headers.join(',')].concat(events.map(e =>
      headers.map(h => {
        const v = /** @type {any} */ (e)[h];
        return `"${String(v ?? '').replace(/"/g,'""')}"`;
      }).join(',')
    ));
    const blob = new Blob([rows.join('\n')], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kickout_events.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function resetFixture() {
    team = opponent = '';
    ourGoalAtTop = true;
    persistFixture();
  }

  // keep fixture sticky on change
  $: persistFixture();
</script>

<!-- Header -->
<div class="max-w-[1000px] mx-auto p-3 md:p-4 text-neutral-900 dark:text-neutral-100">
  <div class="flex items-center justify-between mb-3">
    <h1 class="text-xl font-semibold">Kickout — Capture</h1>
    <div class="text-xs opacity-70">Pitch: {WIDTH_M}×{LENGTH_M} m</div>
  </div>

  <!-- Fixture / quick options -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
    <label class="flex items-center gap-2 text-sm">
      <span class="w-16">Home</span>
      <input class="w-full rounded-md border border-neutral-300 bg-white/90 text-neutral-900 px-2 py-1 outline-none"
             placeholder="Team"
             bind:value={team} onblur={persistFixture} />
    </label>
    <label class="flex items-center gap-2 text-sm">
      <span class="w-16">Away</span>
      <input class="w-full rounded-md border border-neutral-300 bg-white/90 text-neutral-900 px-2 py-1 outline-none"
             placeholder="Opponent"
             bind:value={opponent} onblur={persistFixture} />
    </label>
    <label class="flex items-center gap-2 text-sm">
      <span class="w-16">Date</span>
      <input type="date"
             class="w-full rounded-md border border-neutral-300 bg-white/90 text-neutral-900 px-2 py-1 outline-none"
             bind:value={matchDate} />
    </label>
    <label class="flex items-center gap-2 text-sm">
      <span class="w-28">Our goal at top</span>
      <input type="checkbox" class="h-4 w-4" bind:checked={ourGoalAtTop} />
    </label>
  </div>

  <!-- Quick choices -->
  <div class="flex flex-wrap items-center gap-2 mb-2">
    <div class="text-sm mr-1">Contest:</div>
    {#each CONTESTS as c}
      <button class="px-2.5 py-1 rounded-md border text-sm
                     {contest===c ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white/80 dark:bg-neutral-800 border-neutral-300'}"
              onclick={() => contest=c}>{c}</button>
    {/each}
  </div>
  <div class="flex flex-wrap items-center gap-2 mb-3">
    <div class="text-sm mr-1">Outcome:</div>
    {#each OUTCOMES as o}
      <button class="px-2.5 py-1 rounded-md border text-sm
                     {outcome===o ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white/80 dark:bg-neutral-800 border-neutral-300'}"
              onclick={() => outcome=o}>{o}</button>
    {/each}
    <label class="flex items-center gap-2 text-sm ml-auto">
      <span>Target</span>
      <input class="rounded-md border border-neutral-300 bg-white/90 text-neutral-900 px-2 py-1 outline-none"
             placeholder="player"
             bind:value={targetPlayer} />
    </label>
  </div>

  <!-- Pitch -->
  <div class="rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800 bg-white dark:bg-neutral-950 p-2 md:p-3 mb-2">
    <Pitch
      contestType={contest}
      landing={landing}
      pickup={pickup}
      overlays={overlays}
      on:landed={onLanded}
      on:picked={onPicked}
    />
  </div>

  <!-- Actions -->
  <div class="flex flex-wrap gap-2 mb-3">
    <button class="px-3 py-1.5 rounded-md border border-neutral-300 bg-white"
            onclick={clearPoints}>Clear</button>
    <button class="px-3 py-1.5 rounded-md border border-amber-400 bg-amber-100 text-amber-900"
            onclick={() => { landing.x = NaN; pickup.x = NaN; if (events.length) events = events.slice(1); persistEvents(); }}>Undo last</button>
    <button class="px-3 py-1.5 rounded-md border border-neutral-900 bg-neutral-900 text-white"
            onclick={saveEvent}>Save event</button>

    <div class="ml-auto flex gap-2">
      <button class="px-3 py-1.5 rounded-md border border-neutral-300 bg-white" onclick={exportCSV}>Export CSV</button>
      <button class="px-3 py-1.5 rounded-md border border-red-300 bg-red-50 text-red-700" onclick={resetFixture}>Reset Fixture</button>
    </div>
  </div>

  <!-- Saved events -->
  <div class="rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800 overflow-auto">
    <table class="w-full text-sm table-fixed">
      <thead class="bg-neutral-50 dark:bg-neutral-900 sticky top-0">
        <tr>
          <th class="p-2 text-left w-24">Date</th>
          <th class="p-2 text-left w-16">Out</th>
          <th class="p-2 text-left w-16">Type</th>
          <th class="p-2 text-left w-24">Player</th>
          <th class="p-2 text-left w-24">Team</th>
          <th class="p-2 text-left w-28">Opp</th>
          <th class="p-2 text-left w-20">x,y</th>
          <th class="p-2 text-left w-24">Pickup</th>
          <th class="p-2 text-left"></th>
        </tr>
      </thead>
      <tbody>
        {#each events as e}
          <tr class="border-t border-neutral-200 dark:border-neutral-800">
            <td class="p-2">{e.match_date}</td>
            <td class="p-2">{e.outcome}</td>
            <td class="p-2">{e.contest_type}</td>
            <td class="p-2">{e.target_player ?? '-'}</td>
            <td class="p-2">{e.team}</td>
            <td class="p-2">{e.opponent}</td>
            <td class="p-2">{e.x.toFixed(3)}, {e.y.toFixed(3)}</td>
            <td class="p-2">
              {e.pickup_x==null ? '-' : `${e.pickup_x.toFixed(3)}, ${e.pickup_y?.toFixed?.(3)}`}
            </td>
            <td class="p-2 text-right">
              <button class="px-2 py-1 rounded-md border border-red-300 bg-red-50 text-red-700"
                      onclick={() => delEvent(e.id)}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  :global(html) { background: white; }
  :global(.dark html) { background: #0a0a0a; }
  .ring-1 { box-shadow: 0 0 0 1px rgb(226 232 240 / 1) }
  @media (prefers-color-scheme: dark) {
    .ring-1 { box-shadow: 0 0 0 1px rgb(38 38 38 / 1) }
  }
</style>
