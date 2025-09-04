<script>
  import Pitch from './Pitch.svelte';
  import Legend from './Legend.svelte';
  import TogglePills from './TogglePills.svelte';
  import { events as pending, half } from '$lib/stores.js';

  // WIN/LOSS perspective only
  let outcomes = { gain: true, loss: true };
  let causes   = { forced: true, unforced: true, unknown: true };

  const safe = (a) => Array.isArray(a) ? a : [];
  $: tosThisHalf = safe($pending).filter(
    (e) => e.type === 'turnover' && ($half === 'all' ? true : e.half === $half)
  );

  // ✅ pass filters so Svelte tracks dependencies
  function keepByFilters(e, outcomes, causes) {
    if (!outcomes[e.outcome]) return false;
    if (e.outcome === 'loss') {
      const c = e.cause ?? 'unknown';
      if (!causes[c]) return false;
    }
    return true; // ← this was falling inside the unclosed if
  }

  $: marks = tosThisHalf
    .filter((e) => keepByFilters(e, outcomes, causes))
    .map((e) => ({
      x: e.nx,
      y: e.ny,
      dataColor: e.outcome === 'gain' ? 'win' : 'loss',
      label: e.cause ? e.cause[0].toUpperCase() : '?',
      shape: null,
      savedOrientationLeft: e.savedOrientationLeft
    }));

  function tally(events, outcomes, causes) {
    const rows = events.filter((e) => keepByFilters(e, outcomes, causes));
    let win = 0, loss = 0, forced = 0, unforced = 0, unknown = 0;

    for (const e of rows) {
      if (e.outcome === 'gain') win++;
      else if (e.outcome === 'loss') {
        loss++;
        const c = e.cause ?? 'unknown';
        if (c === 'forced') forced++;
        else if (c === 'unforced') unforced++;
        else unknown++;
      }
    }

    const denom = win + loss;
    const pct = denom ? Math.round((win / denom) * 100) : 0;
    return { total: rows.length, win, loss, forced, unforced, unknown, pct };
  }

  $: usTally = tally(tosThisHalf, outcomes, causes);
</script>

<div class="to-grid">
  <div class="card sidebar">
    <TogglePills ariaLabel="Outcome"
      bind:model={outcomes}
      items={[{key:'gain',label:'Win'},{key:'loss',label:'Loss'}]} />

    <TogglePills ariaLabel="Loss Cause"
      bind:model={causes}
      items={[{key:'forced',label:'forced'},{key:'unforced',label:'unforced'},{key:'unknown',label:'unknown'}]} dense />

    <Legend title="Legend" showTeam={false} showOutcome={true} showContest={false} showCause={true} dense />

    <div class="mini-sum">
       <h4>This half</h4>
      <div><b>{toTally.win}</b> wins ({toTally.pct}%)</div>
      <div><b>{toTally.loss}</b> losses</div>
     <div class="byc">F:{usTally.forced} • U:{usTally.unforced} • ?:{usTally.unknown}</div>
    </div>
  </div>

  <div class="card pitch-panel">
    <Pitch {marks} />
  </div>
</div>

<style>
  .to-grid {
    display: grid;
    grid-template-columns: 330px 1fr;
    gap: 16px;
  }
  @media (max-width: 1100px) { .to-grid { grid-template-columns: 1fr; } }
  .card { background:#fff; border:1px solid #e6ebf1; border-radius:14px; padding:12px; }
  .sidebar :global(.seg) { margin-bottom:10px; }
  .mini-sum { margin-top:12px; }
  .mini-sum h4 { margin:6px 0; }
  .mini-sum .byc { color:#708090; font-size:12px; margin-top:4px; }
  .pitch-panel { padding:8px; }
</style>
