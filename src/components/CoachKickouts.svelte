<script>
  import Pitch from './Pitch.svelte';
  import PlayerKickoutTable from './PlayerKickoutTable.svelte';
  import Legend from './Legend.svelte';
  import { pending, half } from '$lib/stores.js';

  // -------- Filters (local UI state) --------
  let teamFilter = 'both'; // 'us' | 'opp' | 'both'
  let outcomes = { won: true, lost: true, neutral: true };
  let contests = { clean: true, break: true, foul: true, sideline: true };

  // -------- Source events for the selected half --------
  $: koThisHalf = ($pending || []).filter(
    (e) => e.type === 'kickout' && e.half === $half
  );

  // -------- Pitch marks (respect filters) --------
  function keepByFilters(e) {
    if (teamFilter !== 'both' && e.side !== teamFilter) return false;
    if (!outcomes[e.outcome]) return false;
    const c = e.contest || 'clean';
    if (!contests[c]) return false;
    return true;
  }

  $: marks = koThisHalf
    .filter(keepByFilters)
    .map((e) => {
      const dataColor =
        e.outcome === 'won'
          ? 'win'
          : e.outcome === 'lost'
          ? 'loss'
          : 'neutral';
      const label = (e.contest?.[0] || 'c').toUpperCase(); // C/B/F/S
      const shape = e.side === 'opp' ? 'diamond' : null;
      return {
        x: e.nx,
        y: e.ny,
        class: 'ko',
        dataColor,
        label,
        shape,
        savedOrientationLeft: e.savedOrientationLeft
      };
    });

  // -------- Sidebar counts (quick read) --------
  function tally(side) {
    const rows = koThisHalf.filter((e) => e.side === side).filter(keepByFilters);
    const wins = rows.filter((e) => e.outcome === 'won').length;
    const losses = rows.filter((e) => e.outcome === 'lost').length;
    const neutral = rows.filter((e) => e.outcome === 'neutral').length;
    const pct = Math.round((wins / Math.max(rows.length, 1)) * 100);
    const byContest = { clean:0, break:0, foul:0, sideline:0 };
    for (const r of rows) byContest[r.contest || 'clean']++;
    return { total: rows.length, wins, losses, neutral, pct, byContest };
  }
  $: usTally = tally('us');
  $: oppTally = tally('opp');

  // -------- Per-player tables (respect filters + half) --------
  function groupByPlayer(side) {
    const map = new Map(); // key = player number (0 = TBC)
    for (const e of koThisHalf) {
      if (e.side !== side) continue;
      if (!keepByFilters(e)) continue;

      const p = Number.isFinite(e.player) ? e.player : 0;
      const curr = map.get(p) || { player: p, att: 0, wins: 0 };
      curr.att += 1;
      if (e.outcome === 'won') curr.wins += 1; // win is for receiver's team
      map.set(p, curr);
    }
    return [...map.values()].sort(
      (a, b) => b.att - a.att || b.wins - a.wins || a.player - b.player
    );
  }

  $: usRows  = groupByPlayer('us');
  $: oppRows = groupByPlayer('opp');

  const pct = (n) => (Number.isFinite(n) ? `${n}%` : '—');
</script>

<div class="ko-grid">
  <!-- Sidebar: filters + shared legend + quick summary -->
  <div class="card sidebar">
    <div class="seg" aria-label="Team">
      <button class:active={teamFilter === 'us'}  on:click={() => (teamFilter = 'us')}>Us</button>
      <button class:active={teamFilter === 'opp'} on:click={() => (teamFilter = 'opp')}>Opp</button>
      <button class:active={teamFilter === 'both'} on:click={() => (teamFilter = 'both')}>Both</button>
    </div>

    <div class="seg" aria-label="Outcome">
      <button class:active={outcomes.won}     on:click={() => (outcomes.won = !outcomes.won)}>Win</button>
      <button class:active={outcomes.lost}    on:click={() => (outcomes.lost = !outcomes.lost)}>Loss</button>
      <button class:active={outcomes.neutral} on:click={() => (outcomes.neutral = !outcomes.neutral)}>Neutral</button>
    </div>

    <div class="seg columns" aria-label="Contest">
      <label><input type="checkbox" bind:checked={contests.clean}   /> clean</label>
      <label><input type="checkbox" bind:checked={contests.break}   /> break</label>
      <label><input type="checkbox" bind:checked={contests.foul}    /> foul</label>
      <label><input type="checkbox" bind:checked={contests.sideline}/> sideline</label>
    </div>

    <Legend title="Legend" showTeam={true} showOutcome={true} showContest={true} showCause={false} dense />

    <div class="mini-sum">
      <div>
        <h4>Us</h4>
        <div><b>{usTally.wins}</b> wins ({pct(usTally.pct)})</div>
        <div><b>{usTally.losses}</b> losses</div>
        <div><b>{usTally.neutral}</b> neutral</div>
        <div class="byc">C:{usTally.byContest.clean} • B:{usTally.byContest.break} • F:{usTally.byContest.foul} • S:{usTally.byContest.sideline}</div>
      </div>
      <div>
        <h4>Opp</h4>
        <div><b>{oppTally.wins}</b> wins ({pct(oppTally.pct)})</div>
        <div><b>{oppTally.losses}</b> losses</div>
        <div><b>{oppTally.neutral}</b> neutral</div>
        <div class="byc">C:{oppTally.byContest.clean} • B:{oppTally.byContest.break} • F:{oppTally.byContest.foul} • S:{oppTally.byContest.sideline}</div>
      </div>
    </div>
  </div>

  <!-- Pitch -->
  <div class="card pitch-panel">
    <Pitch {marks} />
  </div>

  <!-- Per-player tables with Top-10 / Show all -->
  <div class="tables">
    <PlayerKickoutTable title="Us — receivers"  rows={usRows}  limit={10} />
    <PlayerKickoutTable title="Opp — receivers" rows={oppRows} limit={10} />
  </div>
</div>

<style>
  .ko-grid {
    display: grid;
    grid-template-columns: 330px 1fr;
    grid-template-rows: auto auto;
    gap: 16px;
  }
  @media (max-width: 1200px) {
    .ko-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
    }
  }

  .card { background:#fff; border:1px solid #e6ebf1; border-radius:14px; padding:12px; }
  .sidebar .seg { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .seg.columns { display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
  .seg button { padding:8px 12px; border-radius:999px; border:1px solid #d8e0ea; background:#f7f9fb; cursor:pointer; }
  .seg button.active { background:#0660aa; color:#fff; border-color:#0660aa; }
  .seg label { font-size:14px; display:flex; align-items:center; gap:6px; }

  .mini-sum { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px; }
  .mini-sum h4 { margin:6px 0; }
  .mini-sum .byc { color:#708090; font-size:12px; margin-top:4px; }

  .pitch-panel { padding:8px; }

  .tables {
    grid-column: 1 / -1;
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:16px;
  }
  @media (max-width: 960px) {
    .tables { grid-template-columns: 1fr; }
  }
</style>
