<script>
  import { events } from '../../stores.js';

  export let halfFilter = 'all'; // 'all' | '1' | '2'
  export let teamUs = 'Clontarf';
  export let teamOpp = 'Opposition';

  const ptsOf = (o) => (o === 'goal' ? 3 : o === 'two_points' ? 2 : o === 'point' ? 1 : 0);

  $: shotsAll = $events.filter(e => e?.type === 'shot');
  $: shots = shotsAll.filter(e => halfFilter === 'all' ? true : Number(e?.half) === Number(halfFilter));

  function tally(team) {
    const s = shots.filter(e => e?.shot_team === team);
    const goals  = s.filter(e => e?.shot_outcome === 'goal').length;
    const twoPts = s.filter(e => e?.shot_outcome === 'two_points').length;
    const onePts = s.filter(e => e?.shot_outcome === 'point').length;
    const total  = goals*3 + onePts + twoPts*2;
    return { goals, points: onePts, twoPts, total };
  }

  $: us  = tally('us');
  $: opp = tally('opp');
</script>

<div class="board">
  <div class="side">
    <div class="name">{teamUs}</div>
    <div class="gp">
      <span class="big">{us.goals}–{us.points}</span>
      <span class="total">{us.total}</span>
    </div>
    {#if us.twoPts > 0}<div class="note">incl. {us.twoPts}×2pt</div>{/if}
  </div>

  <div class="side">
    <div class="name">{teamOpp}</div>
    <div class="gp">
      <span class="big">{opp.goals}–{opp.points}</span>
      <span class="total">{opp.total}</span>
    </div>
    {#if opp.twoPts > 0}<div class="note">incl. {opp.twoPts}×2pt</div>{/if}
  </div>
</div>

<style>
  .board{ display:grid; grid-template-columns:1fr 1fr; gap:12px }
  .side{ border:1px solid #e5e7eb; border-radius:12px; padding:10px; background:#fff }
  .name{ font-weight:800; margin-bottom:6px }
  .gp{ display:flex; align-items:baseline; gap:10px }
  .big{ font-size:28px; font-weight:900 }
  .total{ font-size:14px; color:#6b7280 }
  .note{ font-size:12px; color:#6b7280; margin-top:2px }
</style>
