<script>
  import Pitch from './Pitch.svelte';
  import Legend from './Legend.svelte';
  import PlayerScorerTable from './PlayerScorerTable.svelte';
  import { pending, half } from '$lib/stores.js';

  // -------- Filters --------
  let teamFilter = 'both'; // 'us' | 'opp' | 'both'  (map filter only)
  let toggle = { success: true, miss: true };
  let outcomes = {
    goal: true, point: true, two: true,
    wide: true, short: true, blocked: true
  };

  // -------- Events (current half for map & lists) --------
  const safe = (a) => Array.isArray(a) ? a : [];
  $: shotsThisHalf = safe($pending).filter(
    e => e.type === 'shot' && e.half === $half
  );

  // Category helpers
  const isSuccess = (o) => o === 'goal' || o === 'point' || o === 'two';
  const isMiss    = (o) => o === 'wide' || o === 'short' || o === 'blocked';

  function keepByFilters(e) {
    if (teamFilter !== 'both' && e.side !== teamFilter) return false;
    if (!outcomes[e.outcome]) return false;
    if (!toggle.success && isSuccess(e.outcome)) return false;
    if (!toggle.miss && isMiss(e.outcome)) return false;
    return true;
  }

  // -------- Pitch marks --------
  function toLabel(o) {
    if (o === 'goal') return 'G';
    if (o === 'point') return 'P';
    if (o === 'two') return '2';
    if (o === 'wide') return 'W';
    if (o === 'short') return 'S';
    if (o === 'blocked') return 'B';
    return '?';
  }
  function toColor(o) { return isSuccess(o) ? 'win' : 'loss'; } // green/red

  $: marks = shotsThisHalf
    .filter(keepByFilters)
    .map(e => ({
      x: e.nx, y: e.ny,
      dataColor: toColor(e.outcome),
      label: toLabel(e.outcome),
      shape: e.side === 'opp' ? 'diamond' : null,
      savedOrientationLeft: e.savedOrientationLeft
    }));

  // -------- Sidebar mini summary (per team) --------
  function tally(side) {
    const rows = shotsThisHalf.filter(e => e.side === side).filter(keepByFilters);
    const attempts = rows.length;
    const success = rows.filter(e => isSuccess(e.outcome)).length;
    const pct = attempts ? Math.round((success / attempts) * 100) : 0;

    const g = rows.filter(e => e.outcome === 'goal').length;
    const p = rows.filter(e => e.outcome === 'point').length;
    const two = rows.filter(e => e.outcome === 'two').length;
    const w = rows.filter(e => e.outcome === 'wide').length;
    const s = rows.filter(e => e.outcome === 'short').length;
    const b = rows.filter(e => e.outcome === 'blocked').length;

    return { attempts, success, pct, g, p, two, w, s, b };
  }

  $: us = tally('us');
  $: opp = tally('opp');

  // -------- Per-player scorers (respect filters + half) --------
  function groupScorers(side) {
    const map = new Map(); // key = player number (0 = TBC)
    for (const e of shotsThisHalf) {
      if (e.side !== side) continue;
      if (!keepByFilters(e)) continue;

      const p = Number.isFinite(e.player) ? e.player : 0;
      const row = map.get(p) || { player:p, att:0, scores:0, g:0, p:0, two:0, w:0, s:0, b:0 };
      row.att += 1;

      // successes
      if (e.outcome === 'goal') { row.scores++; row.g++; }
      else if (e.outcome === 'point') { row.scores++; row.p++; }
      else if (e.outcome === 'two') { row.scores++; row.two++; }

      // misses
      else if (e.outcome === 'wide') { row.w++; }
      else if (e.outcome === 'short') { row.s++; }
      else if (e.outcome === 'blocked') { row.b++; }

      map.set(p, row);
    }

    // finalize pct + sort
    const out = [...map.values()].map(r => ({
      ...r,
      pct: r.att ? Math.round((r.scores / r.att) * 100) : 0
    }));
    out.sort((a,b) =>
      b.scores - a.scores || b.pct - a.pct || b.att - a.att || a.player - b.player
    );
    return out;
  }

  $: usRows  = groupScorers('us');
  $: oppRows = groupScorers('opp');
</script>

<div class="shots-grid">
  <!-- Sidebar: filters + shared legend + quick summary -->
  <div class="card sidebar">
    <div class="seg" aria-label="Team (map)">
      <button class:active={teamFilter==='us'}  on:click={() => teamFilter='us'}>Us</button>
      <button class:active={teamFilter==='opp'} on:click={() => teamFilter='opp'}>Opp</button>
      <button class:active={teamFilter==='both'} on:click={() => teamFilter='both'}>Both</button>
    </div>

    <div class="seg" aria-label="Category">
      <button class:active={toggle.success} on:click={() => toggle.success = !toggle.success}>Success</button>
      <button class:active={toggle.miss}    on:click={() => toggle.miss = !toggle.miss}>Miss</button>
    </div>

    <div class="seg columns" aria-label="Outcome">
      <label><input type="checkbox" bind:checked={outcomes.goal}    /> goal</label>
      <label><input type="checkbox" bind:checked={outcomes.point}   /> point</label>
      <label><input type="checkbox" bind:checked={outcomes.two}     /> 2P</label>
      <label><input type="checkbox" bind:checked={outcomes.wide}    /> wide</label>
      <label><input type="checkbox" bind:checked={outcomes.short}   /> short</label>
      <label><input type="checkbox" bind:checked={outcomes.blocked} /> blocked</label>
    </div>

    <Legend title="Legend" showTeam={true} showOutcome={true} showShots={true} dense />

    <div class="mini-sum">
      <div>
        <h4>Us</h4>
        <div><b>{us.pct}%</b> success &nbsp; ({us.success}/{us.attempts})</div>
        <div class="byo">
          <span>G:{us.g}</span> <span>P:{us.p}</span> <span>2P:{us.two}</span>
          <span>W:{us.w}</span> <span>S:{us.s}</span> <span>B:{us.b}</span>
        </div>
      </div>
      <div>
        <h4>Opp</h4>
        <div><b>{opp.pct}%</b> success &nbsp; ({opp.success}/{opp.attempts})</div>
        <div class="byo">
          <span>G:{opp.g}</span> <span>P:{opp.p}</span> <span>2P:{opp.two}</span>
          <span>W:{opp.w}</span> <span>S:{opp.s}</span> <span>B:{opp.b}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Pitch -->
  <div class="card pitch-panel">
    <Pitch {marks} />
  </div>

  <!-- Per-player scorers (Top-10 / Show all) -->
  <div class="tables">
    <PlayerScorerTable title="Us — scorers"  rows={usRows}  limit={10} />
    <PlayerScorerTable title="Opp — scorers" rows={oppRows} limit={10} />
  </div>
</div>

<style>
  .shots-grid {
    display:grid;
    grid-template-columns: 330px 1fr;
    gap:16px;
  }
  @media (max-width: 1200px) {
    .shots-grid { grid-template-columns: 1fr; }
  }

  .card { background:#fff; border:1px solid #e6ebf1; border-radius:14px; padding:12px; }
  .pitch-panel { padding:8px; }

  .sidebar .seg { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .seg.columns { display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
  .seg button { padding:8px 12px; border-radius:999px; border:1px solid #d8e0ea; background:#f7f9fb; cursor:pointer; }
  .seg button.active { background:#0660aa; color:#fff; border-color:#0660aa; }
  .seg label { font-size:14px; display:flex; align-items:center; gap:6px; }

  .mini-sum { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px; }
  .mini-sum h4 { margin:6px 0; }
  .byo { color:#708090; display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }

  .tables {
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:16px;
    grid-column: 1 / -1;
  }
  @media (max-width: 960px) {
    .tables { grid-template-columns: 1fr; }
  }
</style>
