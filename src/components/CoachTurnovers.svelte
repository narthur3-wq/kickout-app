<script>
  import Pitch from './Pitch.svelte';
  import Legend from './Legend.svelte';
  import TogglePills from './TogglePills.svelte';
  import { events as pending, half } from '$lib/stores.js';

  // US perspective only
  let outcomes = { gain: true, loss: true };           // labels shown as Win/Loss
  let causes   = { forced: true, unforced: true };

  const safe = (a) => Array.isArray(a) ? a : [];
  $: tosThisHalf = safe($pending).filter(
    (e) => e.type === 'turnover' && ($half === 'all' ? true : e.half === $half) && e.side === 'us'
  );

  // ✅ pass filters so Svelte tracks dependencies
  function keepByFilters(e, outcomes, causes) {
    if (!outcomes[e.outcome]) return false;
    const c = e.cause || 'forced';
    if (!causes[c]) return false;
    return true;
  }

  $: marks = tosThisHalf
    .filter(e => keepByFilters(e, outcomes, causes))
    .map((e) => ({
      x: e.nx,
      y: e.ny,
      dataColor: e.outcome === 'gain' ? 'win' : 'loss',
      label: (e.cause?.[0] || '').toUpperCase(),
      shape: null,
      savedOrientationLeft: e.savedOrientationLeft
    }));

  function tally(outcomes, causes) {
    const rows = tosThisHalf.filter(e => keepByFilters(e, outcomes, causes));
    const win  = rows.filter((e) => e.outcome === 'gain').length;
    const loss = rows.filter((e) => e.outcome === 'loss').length;
    const forced   = rows.filter((e) => e.cause === 'forced').length;
    const unforced = rows.filter((e) => e.cause === 'unforced').length;
    const denom = win + loss;
    const pct = denom ? Math.round((win / denom) * 100) : 0;
    return { total: rows.length, win, loss, forced, unforced, pct };
  }
  $: usTally = tally(outcomes, causes);
</script>

<div class="to-grid">
  <div class="card sidebar">
    <TogglePills ariaLabel="Outcome"
      bind:model={outcomes}
      items={[{key:'gain',label:'Win'},{key:'loss',label:'Loss'}]} />

    <TogglePills ariaLabel="Cause"
      bind:model={causes}
      items={[{key:'forced',label:'forced'},{key:'unforced',label:'unforced'}]} dense />

    <Legend title="Legend" showTeam={false} showOutcome={true} showContest={false} showCause={true} dense />

    <div class="mini-sum">
      <h4>Us (this half)</h4>
      <div><b>{usTally.win}</b> wins ({usTally.pct}%)</div>
      <div><b>{usTally.loss}</b> losses</div>
      <div class="byc">F:{usTally.forced} • U:{usTally.unforced}</div>
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
