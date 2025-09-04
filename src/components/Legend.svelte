<script>
  // Reusable legend. Toggle sections via props.
  export let title = 'Legend';
  export let showTeam = true;       // circle = Us, diamond = Opp
  export let showOutcome = true;    // Win/Loss/Neutral color chips
  export let showCause = false;     // Forced / Unforced (turnovers)
  export let showContest = false;   // C/B/F/S (kickouts)
  export let showShots = false;     // G/P/2P/W/S/B (shots)
  export let showSource = false;    // play vs free (shots)
  export let dense = false;         // tighter spacing
  export let shotSemantics = false; // interpret team/outcome as shots legend

  // Standardized colors (match markers on the Pitch)
  const COL = {
    win: '#1f9d55',     // red
    loss: '#d64545',    // red
    neutral: '#aab2bd', // grey
    stroke: '#6b7c93',  // outline for shapes
    primary: '#0660aa'  // club blue
  };
</script>

<div class="legend" class:dense aria-label="Legend">
  <h4 class="h">{title}</h4>

  {#if showOutcome}
   {#if shotSemantics}
      <div class="row">
        <span class="shape shot goal"></span><span>Goal</span>
        <span class="shape shot point"></span><span>Point</span>
        <span class="shape shot two"></span><span>2P</span>
        <span class="shape shot wide"></span><span>Wide</span>
        <span class="shape shot short"></span><span>Short</span>
        <span class="shape shot blocked"></span><span>Blocked</span>
      </div>
    {:else}
      <div class="row">
        <span class="chip" style="--bg:{COL.win}"></span> <span>Win</span>
        <span class="chip" style="--bg:{COL.loss}"></span> <span>Loss</span>
        <span class="chip" style="--bg:{COL.neutral}"></span> <span>Neutral</span>
      </div>
    {/if} 
  {/if}

  {#if showTeam}
  {#if shotSemantics}
      <div class="row">
        <span class="chip team us"></span><span>Us</span>
        <span class="chip team opp"></span><span>Opp</span>
      </div>
    {:else}
      <div class="row">
        <span class="shape circle" title="Us"></span> <span>Us</span>
        <span class="shape diamond" title="Opp"></span> <span>Opp</span>
      </div>
    {/if}
  {/if}

  {#if shotSemantics && showSource}
    <div class="row">
      <span class="stroke solid"></span><span>From play</span>
      <span class="stroke dashed"></span><span>Free</span>
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
  .chip.team { border-color:var(--bg); }
  .chip.team.us { --bg: var(--us); }
  .chip.team.opp { --bg: var(--opp); }
  
  .shape {
    display:inline-block;
    width:12px; height:12px;
    border:2px solid #6b7c93;
    border-radius:50%;
    margin-right:2px;
    background:#fff;
  }
  .shape.diamond { transform:rotate(45deg); border-radius:2px; }
    .shape.shot { border-color:#6b7c93; }
  .shape.shot.point { border-radius:0; }
  .shape.shot.two { transform:rotate(45deg); border-radius:0; }
  .shape.shot.wide { clip-path: polygon(50% 0, 0 100%, 100% 100%); }
  .shape.shot.short { clip-path: polygon(0 0, 100% 0, 50% 100%); }
  .shape.shot.blocked { clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); }

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
  .stroke {
    display:inline-block;
    width:20px;
    border-top:3px solid #6b7c93;
    margin-right:2px;
  }
  .stroke.dashed { border-top-style:dashed; }
</style>
