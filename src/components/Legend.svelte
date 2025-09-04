<script>
  // Reusable legend. Toggle sections via props.
  export let title = 'Legend';
  export let showTeam = true;       // circle = Us, diamond = Opp
  export let showOutcome = true;    // Win/Loss/Neutral color chips
  export let showCause = false;     // Forced / Unforced (turnovers)
  export let showContest = false;   // C/B/F/S (kickouts)
  export let showShots = false;     // G/P/2P/W/S/B (shots)
  export let dense = false;         // tighter spacing

  // Standardized colors (match markers on the Pitch)
  const COL = {
    win: '#1f9d55',     // green
    loss: '#d64545',    // red
    neutral: '#aab2bd', // grey
    stroke: '#6b7c93',  // outline for shapes
    primary: '#0660aa'  // club blue
  };
</script>

<div class="legend" class:dense aria-label="Legend">
  <h4 class="h">{title}</h4>

  {#if showOutcome}
    <div class="row">
      <span class="chip" style="--bg:{COL.win}"></span> <span>Win</span>
      <span class="chip" style="--bg:{COL.loss}"></span> <span>Loss</span>
      <span class="chip" style="--bg:{COL.neutral}"></span> <span>Neutral</span>
    </div>
  {/if}

  {#if showTeam}
    <div class="row">
      <span class="shape circle" title="Us"></span> <span>Us</span>
      <span class="shape diamond" title="Opp"></span> <span>Opp</span>
    </div>
  {/if}

  {#if showCause}
    <div class="row">
      <span class="label">F</span><span>Forced loss</span>
      <span class="label">U</span><span>Unforced loss</span>
      <span class="label">?</span><span>Unknown</span>
    </div>
  {/if}

  {#if showContest}
    <div class="row">
      <span class="label">C</span><span>Clean</span>
      <span class="label">B</span><span>Break</span>
      <span class="label">F</span><span>Foul</span>
      <span class="label">S</span><span>Sideline</span>
    </div>
  {/if}

  {#if showShots}
    <div class="row">
      <span class="label">G</span><span>Goal</span>
      <span class="label">P</span><span>Point</span>
      <span class="label">2</span><span>2P</span>
      <span class="label">W</span><span>Wide</span>
      <span class="label">S</span><span>Short</span>
      <span class="label">B</span><span>Blocked</span>
    </div>
  {/if}
</div>

<style>
  .legend { display:grid; gap:8px; color:#5f7083; }
  .legend.dense { gap:6px; }
  .h { margin:0; font-size:14px; font-weight:700; color:#213042; }

  .row {
    display:grid;
    grid-template-columns: auto 1fr auto 1fr auto 1fr auto 1fr;
    align-items:center;
    gap:8px 10px;
    font-size:13px;
  }

  .chip {
    --bg: #aab2bd;
    display:inline-block;
    width:12px; height:12px;
    border-radius:999px;
    background:var(--bg);
    border:1px solid #e2e6ea;
    margin-right:2px;
  }

  .shape {
    display:inline-block;
    width:12px; height:12px;
    border:2px solid #6b7c93;
    border-radius:50%;
    margin-right:2px;
    background:#fff;
  }
  .shape.diamond { transform:rotate(45deg); border-radius:2px; }

  .label {
    display:inline-grid; place-items:center;
    min-width:18px; height:18px;
    padding:0 6px;
    border-radius:6px;
    border:1px solid #d8e0ea;
    background:#f7f9fb;
    font-size:11px; font-weight:700;
    color:#213042;
  }
</style>
