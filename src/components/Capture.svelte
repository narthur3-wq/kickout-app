<script>
  import Pitch from './Pitch.svelte';
  import { pending, current_side, half, orientation_left, setSide, toast, addPending } from '$lib/stores.js';
  import { toNorm, getClientPoint } from '$lib/coords.js';
  import { clamp01 } from '$lib/util.js';

  let kind = 'kickout';                  // 'kickout' | 'shot' | 'turnover'
  let outcome = 'won';
  let contest = 'clean';                 // kickout-only: 'clean' | 'break' | 'foul' | 'sideline'
  let cause = 'forced';                  // turnover-only: 'forced' | 'unforced'
  let player = null;                     // required; use 0 for TBC

  const outcomeOptions = {
    kickout: ['won', 'lost', 'neutral'],
    shot: ['goal', 'point', 'wide', 'short', 'blocked', 'two'],
    turnover: ['gain','loss']
  };
  const causeOptions = ['forced','unforced'];
  const numbers = Array.from({length: 25}, (_, i) => i + 1);

  function setType(t) { kind = t; outcome = outcomeOptions[kind][0]; }

  // Show pending markers for current type + side + half
  $: marks = ($pending || []).filter(e =>
      e.type === kind && e.side === $current_side && e.half === $half
    ).map(e => {
      if (e.type === 'kickout') {
        const label = (e.contest?.[0] || 'c').toUpperCase();
        const dataColor = e.outcome==='won' ? 'win' : (e.outcome==='lost' ? 'loss' : 'neutral');
        const team = e.winner_team && e.winner_team !== 'neutral' ? e.winner_team : null;
        const shape = team==='opp' ? 'diamond' : null; // circle=us (default), diamond=opp
        return { x:e.nx, y:e.ny, class:'ko', dataColor, shape, label, savedOrientationLeft:e.savedOrientationLeft };
      }
      if (e.type === 'shot') {
        const cls = `shot ${e.outcome || ''}`;
        const label = e.outcome==='two' ? '2' : '';
        const shape = e.side==='opp' ? 'diamond' : null;
        return { x:e.nx, y:e.ny, class:cls, label, shape, savedOrientationLeft:e.savedOrientationLeft };
      }
      const dataColor = e.outcome==='gain' ? 'win' : 'loss';
      const label = e.cause ? e.cause[0].toUpperCase() : 'T';
      return { x:e.nx, y:e.ny, dataColor, label, savedOrientationLeft:e.savedOrientationLeft };
    });

  // One event per human tap (debounce a bit)
  let lastFire = 0;
  function activateAtPointer(e) {
    const now = performance.now();
    if (now - lastFire < 220) return;
    lastFire = now;

    if (player === null) {
      toast('Select a player number or choose TBC', 'error', 1600);
      return;
    }

    // read the underlying SVG's bounding rect
    const host = e.currentTarget.querySelector('.pitch') || e.currentTarget.closest('.pitch');
    if (!host) return;
    const rect = host.getBoundingClientRect();

    const pt = getClientPoint(e);
    const n = toNorm(pt, rect);
    const nx = clamp01(n.x), ny = clamp01(n.y);

    const base = {
      side: $current_side,
      half: $half,
      savedOrientationLeft: $orientation_left, // store orientation used when captured
      nx, ny,
      player,
      ts: Date.now()
    };

    let payload;
    if (kind === 'shot') {
      payload = { type:'shot', outcome, ...base };
    } else if (kind === 'kickout') {
      const winner_team = outcome === 'won'
        ? ($current_side === 'us' ? 'us' : 'opp')
        : (outcome === 'lost' ? ($current_side === 'us' ? 'opp' : 'us') : 'neutral');
      payload = { type:'kickout', outcome, contest, winner_team, ...base };
    } else {
      payload = { type:'turnover', outcome, cause, ...base };
    }

    addPending(payload);
    toast(`${kind} (${outcome}) by ${player===0 ? 'TBC' : ('#'+player)} staged`, 'success', 1200);
  }

  function onKeyActivate(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateAtPointer(e);
    }
  }
</script>

<style>
  .live-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
  }
  @media (max-width: 900px) {
    .live-grid { grid-template-columns: 1fr; }
  }
  .card {
    border: 1px solid var(--border, #e6e6e6);
    border-radius: 12px;
    background: #fff;
    padding: 12px;
  }
  .sticky-panel { position: sticky; top: 12px; }

  .seg { display: inline-flex; gap: 8px; padding: 4px; background: #f6f7fb; border-radius: 999px; }
  .seg > button { border: 0; background: transparent; padding: 6px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; }
  .seg > button.active { background: #0c66ff; color: #fff; }

  .player-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .player-grid > button {
    border: 1px solid var(--border, #e6e6e6);
    background: #fff; border-radius: 10px; padding: 8px 0; font-weight: 700; cursor: pointer;
  }
  .player-grid > button.active { background: #0c66ff; color: #fff; border-color: #0c66ff; }

  .pitch-interactive h2 { margin: 0 0 10px; }
</style>

<div class="live-grid">
  <!-- Control panel -->
  <div class="card sticky-panel">
    <div class="center" style="margin-bottom:8px">
      <img src="/crest.png" alt="Crest" style="height:42px" on:error={(e)=>{e.currentTarget.style.display='none'}} />
    </div>

    <h3>Team</h3>
    <div class="seg" aria-label="Team">
      <button class:active={$current_side==='us'}  on:click={()=>setSide('us')}>Us</button>
      <button class:active={$current_side==='opp'} on:click={()=>setSide('opp')}>Opp</button>
    </div>

    <h3 style="margin-top:12px">Type</h3>
    <div class="seg" aria-label="Type">
      <button class:active={kind==='kickout'} on:click={()=>setType('kickout')}>Kickout</button>
      <button class:active={kind==='shot'} on:click={()=>setType('shot')}>Shot</button>
      <button class:active={kind==='turnover'} on:click={()=>setType('turnover')}>Turnover</button>
    </div>

    <h3 style="margin-top:12px">Outcome</h3>
    <div class="seg" aria-label="Outcome">
      {#each outcomeOptions[kind] as o}
        <button class:active={outcome===o} on:click={()=>outcome=o}>{o}</button>
      {/each}
    </div>

    {#if kind==='kickout'}
      <h3 style="margin-top:12px">Contest</h3>
      <div class="seg" aria-label="Contest">
        {#each ['clean','break','foul','sideline'] as c}
          <button class:active={contest===c} on:click={()=>contest=c}>{c}</button>
        {/each}
      </div>
    {/if}

    {#if kind==='turnover'}
      <h3 style="margin-top:12px">Cause</h3>
      <div class="seg" aria-label="Cause">
        {#each causeOptions as c}
          <button class:active={cause===c} on:click={()=>cause=c}>{c}</button>
        {/each}
      </div>
    {/if}

    <h3 style="margin-top:12px">Player</h3>
    <div class="seg" style="margin-bottom:8px">
      <button class:active={player===0} on:click={()=>player=0}>TBC</button>
    </div>
    <div class="player-grid">
      {#each numbers as n}
        <button class:active={player===n} on:click={()=>player=n}>{n}</button>
      {/each}
    </div>
  </div>

  <!-- Pitch (keyboard optional; click/tap is primary) -->
  <div
    class="pitch-interactive card"
    role="button"
    tabindex="0"
    aria-label={`Tap to add a ${$current_side} ${kind} (${outcome}) on the pitch`}
    on:pointerdown|preventDefault|stopPropagation={activateAtPointer}
    on:keydown={onKeyActivate}
  >
    <h2>Tap pitch to add a {$current_side} {kind} ({outcome})</h2>
    <Pitch {marks} />
  </div>
</div>
