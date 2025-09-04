<script>
  import Pitch from './Pitch.svelte';
  import PlayerKickoutTable from './PlayerKickoutTable.svelte';
  import Legend from './Legend.svelte';
  import TogglePills from './TogglePills.svelte';
  import { events as pending, half, orientation_left } from '$lib/stores.js';
  import { classifyKickoutZoneForSide } from '$lib/util.js';

  // -------- Filters (local UI state) --------
  let teamFilter = 'both';                          // 'us' | 'opp' | 'both'
  let outcomes  = { won: true, lost: true };        // our-POV (neutrals excluded)
  let contests  = { clean: true, break: true, foul: true, sideline: true };

  const safe = (a) => Array.isArray(a) ? a : [];

  // Selected-half events (respect header H1/H2/ALL)
  $: koThisHalf = safe($pending).filter(
    e => e.type === 'kickout' && ($half === 'all' ? true : e.half === $half)
  );

  // our-POV outcome key
  function ourOutcomeKey(e){
    return e.winner_team === 'us' ? 'won'
         : e.winner_team === 'opp' ? 'lost'
         : 'neutral';
  }

  // -------- filter predicate (explicit deps so Svelte re-runs) --------
  function keepByFilters(e, teamFilter, outcomes, contests) {
    if (teamFilter !== 'both' && e.side !== teamFilter) return false;
    const ok = ourOutcomeKey(e);
    if (!(ok in outcomes) || !outcomes[ok]) return false;
    const c = e.contest || 'clean';
    if (!contests[c]) return false;
    return true;
  }

  // -------- Pitch marks (our-POV colors) --------
  $: marks = koThisHalf
    .filter(e => keepByFilters(e, teamFilter, outcomes, contests))
    .map((e) => {
      const dataColor =
        e.winner_team === 'us'  ? 'win' :
        e.winner_team === 'opp' ? 'loss' : 'neutral';
      const label = (e.contest?.[0] || 'c').toUpperCase(); // C/B/F/S
      const shape = e.side === 'opp' ? 'diamond' : null;   // diamond = opp kicked
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

  // -------- Sidebar tallies (our-POV) --------
  function tallyByKickingSide(side, teamFilter, outcomes, contests) {
    const rows = koThisHalf.filter((e) => e.side === side).filter(e => keepByFilters(e, teamFilter, outcomes, contests));
    let wins = 0, losses = 0;
    const byContest = { clean:0, break:0, foul:0, sideline:0 };
    for (const r of rows) {
      if (r.winner_team === 'us') wins++;
      else if (r.winner_team === 'opp') losses++;
      byContest[r.contest || 'clean']++;
    }
    const denom = wins + losses; // neutrals excluded
    const pct = denom ? Math.round((wins / denom) * 100) : 0;
    return { total: rows.length, wins, losses, pct, byContest };
  }
  $: usTally  = tallyByKickingSide('us',  teamFilter, outcomes, contests);
  $: oppTally = tallyByKickingSide('opp', teamFilter, outcomes, contests);

  // -------- Per-player tables (receiver wins for the *kicking* side) --------
  function groupByPlayer(side, teamFilter, outcomes, contests) {
    const map = new Map();
    for (const e of koThisHalf) {
      if (e.side !== side) continue;
      if (!keepByFilters(e, teamFilter, outcomes, contests)) continue;
      const p = Number.isFinite(e.player) ? e.player : 0;
      const curr = map.get(p) || { player: p, att: 0, wins: 0 };
      curr.att += 1;
      if (e.outcome === 'won') curr.wins += 1;
      map.set(p, curr);
    }
    return [...map.values()].sort(
      (a, b) => b.att - a.att || b.wins - a.wins || a.player - b.player
    );
  }
  $: usRows  = groupByPlayer('us',  teamFilter, outcomes, contests);
  $: oppRows = groupByPlayer('opp', teamFilter, outcomes, contests);

  const pct = (n) => (Number.isFinite(n) ? `${n}%` : '—');

  // -------- Zone summary (zones relative to the *kicker*) --------
  const LENGTHS  = ['short','medium','long'];
  const LATERALS = ['left','centre','right'];
  function pctNum(n, d){ return d ? Math.round((n/d)*100) : 0; }

  function keepForZones(e, outcomes, contests) {
    const ok = ourOutcomeKey(e);
    if (!(ok in outcomes) || !outcomes[ok]) return false;
    const c = e.contest || 'clean';
    if (!contests[c]) return false;
    return true;
  }

  function emptyMatrix() {
    const m = {};
    for (const L of LENGTHS) for (const R of LATERALS) m[`${L}-${R}`] = { att:0, wins:0, losses:0 };
    return m;
  }

  function zoneMatrix(kickingSide, teamFilter, outcomes, contests) {
    const m = emptyMatrix();
    const rows = koThisHalf.filter(e => e.side === kickingSide).filter(e => keepForZones(e, outcomes, contests));
    for (const e of rows) {
      // ✅ zones relative to the kicker’s direction
      const z = classifyKickoutZoneForSide(
        e.nx, e.ny, e.side, e.savedOrientationLeft, $orientation_left
      );
      const cell = m[z.key];
      cell.att += 1;
      if (e.winner_team === 'us') cell.wins += 1;
      else if (e.winner_team === 'opp') cell.losses += 1;
    }
    return m;
  }

  $: usZones  = zoneMatrix('us',  teamFilter, outcomes, contests);
  $: oppZones = zoneMatrix('opp', teamFilter, outcomes, contests);
</script>

<div class="ko-grid">
  <!-- Sidebar -->
  <div class="card sidebar">
    <div class="seg" aria-label="Team">
      <button class:active={teamFilter === 'us'}  on:click={() => (teamFilter = 'us')}>Us</button>
      <button class:active={teamFilter === 'opp'} on:click={() => (teamFilter = 'opp')}>Opp</button>
      <button class:active={teamFilter === 'both'} on:click={() => (teamFilter = 'both')}>Both</button>
    </div>

    <TogglePills ariaLabel="Outcome (our POV)"
      bind:model={outcomes}
      items={[{key:'won',label:'Win'},{key:'lost',label:'Loss'}]} />

    <TogglePills ariaLabel="Contest"
      bind:model={contests}
      items={[
        {key:'clean',label:'clean'},
        {key:'break',label:'break'},
        {key:'foul',label:'foul'},
        {key:'sideline',label:'sideline'}
      ]} dense />

    <Legend
      title="Legend"
      showTeam={true}
      showOutcome={true}
      showContest={true}
      showCause={false}
      dense
      showOutcomeNeutral={false}
    />

    <div class="mini-sum">
      <div>
        <h4>Us (we kicked)</h4>
        <div><b>{usTally.wins}</b> wins ({pct(usTally.pct)})</div>
        <div><b>{usTally.losses}</b> losses</div>
        <div class="byc">C:{usTally.byContest.clean} • B:{usTally.byContest.break} • F:{usTally.byContest.foul} • S:{usTally.byContest.sideline}</div>
      </div>
      <div>
        <h4>Opp (they kicked)</h4>
        <div><b>{oppTally.wins}</b> wins ({pct(oppTally.pct)})</div>
        <div><b>{oppTally.losses}</b> losses</div>
        <div class="byc">C:{oppTally.byContest.clean} • B:{oppTally.byContest.break} • F:{oppTally.byContest.foul} • S:{oppTally.byContest.sideline}</div>
      </div>
    </div>
  </div>

  <!-- Pitch -->
  <div class="card pitch-panel">
    <Pitch {marks} />
  </div>

  <!-- ZONES — our kickouts -->
  <div class="card zones">
    <h3>Zones — our kickouts</h3>
    <div class="zone-grid">
      <div class="corner"></div>
      <div class="colhead">Left</div><div class="colhead">Centre</div><div class="colhead">Right</div>

      {#each ['short','medium','long'] as L}
        <div class="rowhead">{L === 'short' ? 'Short' : (L === 'medium' ? 'Medium' : 'Long')}</div>
        {#each ['left','centre','right'] as R}
          <div class="zcell">
            <div class="att">{usZones[`${L}-${R}`].att} att</div>
            <div class="bar">
              <span style="width:{(() => {
                const c = usZones[`${L}-${R}`]; const d = c.wins + c.losses; return d ? Math.round((c.wins/d)*100) : 0;
              })()}%"></span>
            </div>
            <div class="wl">
              <span class="w">{usZones[`${L}-${R}`].wins} W</span>
              <span class="l">{usZones[`${L}-${R}`].losses} L</span>
            </div>
          </div>
        {/each}
      {/each}
    </div>
  </div>

  <!-- ZONES — opposition kickouts -->
  <div class="card zones">
    <h3>Zones — opposition kickouts</h3>
    <div class="zone-grid">
      <div class="corner"></div>
      <div class="colhead">Left</div><div class="colhead">Centre</div><div class="colhead">Right</div>

      {#each ['short','medium','long'] as L}
        <div class="rowhead">{L === 'short' ? 'Short' : (L === 'medium' ? 'Medium' : 'Long')}</div>
        {#each ['left','centre','right'] as R}
          <div class="zcell">
            <div class="att">{oppZones[`${L}-${R}`].att} att</div>
            <div class="bar">
              <span style="width:{(() => {
                const c = oppZones[`${L}-${R}`]; const d = c.wins + c.losses; return d ? Math.round((c.wins/d)*100) : 0;
              })()}%"></span>
            </div>
            <div class="wl">
              <span class="w">{oppZones[`${L}-${R}`].wins} W</span>
              <span class="l">{oppZones[`${L}-${R}`].losses} L</span>
            </div>
          </div>
        {/each}
      {/each}
    </div>
  </div>

  <!-- Per-player tables -->
  <div class="tables">
    <PlayerKickoutTable title="Us — receivers"  rows={usRows}  limit={10} />
    <PlayerKickoutTable title="Opp — receivers" rows={oppRows} limit={10} />
  </div>
</div>

<style>
  .ko-grid { display:grid; grid-template-columns:330px 1fr; grid-template-rows:auto auto auto auto; gap:16px; }
  @media (max-width:1200px){ .ko-grid { grid-template-columns:1fr; grid-template-rows:auto auto auto auto auto; } }
  .card { background:#fff; border:1px solid #e6ebf1; border-radius:14px; padding:12px; }
  .sidebar .seg { margin-bottom:10px; }
  .seg button { padding:8px 12px; border-radius:999px; border:1px solid #d8e0ea; background:#f7f9fb; cursor:pointer; }
  .seg button.active { background:#0660aa; color:#fff; border-color:#0660aa; }
  .mini-sum { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
  .mini-sum h4 { margin:6px 0; }
  .mini-sum .byc { color:#708090; font-size:12px; margin-top:4px; }
  .pitch-panel { padding:8px; }
  .tables { grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:960px){ .tables { grid-template-columns:1fr; } }
  .zones h3 { margin:4px 0 10px; }
  .zone-grid { display:grid; grid-template-columns:80px repeat(3,1fr); gap:10px; align-items:start; }
  .colhead, .rowhead { font-weight:700; text-align:center; }
  .rowhead { text-align:left; padding-top:6px; }
  .zcell { border:1px solid #e6ebf1; border-radius:10px; padding:8px; display:grid; gap:6px; }
  .zcell .att { font-weight:700; font-size:13px; }
  .bar { height:10px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
  .bar span { display:block; height:100%; background:#16a34a; }
  .wl { display:flex; justify-content:space-between; font-size:12px; }
  .wl .w { color:#16a34a; }
  .wl .l { color:#dc2626; }
</style>
