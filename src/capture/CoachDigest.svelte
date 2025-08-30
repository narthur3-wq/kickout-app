<script>
  import { events } from '../stores.js';

  // Calculate totals
  function calcScores() {
    let team = { goals: 0, pts: 0, two: 0 };
    let opp = { goals: 0, pts: 0, two: 0 };

    $events.forEach(e => {
      if (e.type !== 'shot') return;
      const t = e.side === 'us' ? team : opp;
      if (e.result === 'goal') t.goals++;
      else if (e.result === 'two') t.two++;
      else if (e.result === 'point') t.pts++;
    });

    const total = (t) => t.goals*3 + t.two*2 + t.pts;
    return {
      team, opp,
      teamTotal: total(team),
      oppTotal: total(opp)
    };
  }

  $: scores = calcScores();
</script>

<div class="digest-grid">
  <div class="tile">
    <h3>Clontarf</h3>
    <p class="big">{scores.team.goals}-{scores.team.pts} ({scores.teamTotal})</p>
    {#if scores.team.two>0}<p class="muted">incl. {scores.team.two}×2pt</p>{/if}
  </div>
  <div class="tile">
    <h3>Opposition</h3>
    <p class="big">{scores.opp.goals}-{scores.opp.pts} ({scores.oppTotal})</p>
    {#if scores.opp.two>0}<p class="muted">incl. {scores.opp.two}×2pt</p>{/if}
  </div>
</div>

<style>
  .digest-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:16px;}
  .tile{border:1px solid #eee;border-radius:14px;background:#fff;padding:16px;text-align:center;}
  .big{font-size:2rem;font-weight:700;}
  .muted{color:#6b7280;font-size:0.9rem;}
</style>
