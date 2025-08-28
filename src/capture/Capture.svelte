<script>
  import { get } from 'svelte/store';
  import { events } from '../stores.js';
  import Pitch from './Pitch.svelte';
  import { jerseyNums, zoneCode } from './field.js';
  import Toast from '../lib/Toast.svelte';

  // Live state
  let side = 'us';                         // 'us' | 'opp'  (whose restart)
  let landing = { nx: NaN, ny: NaN };
  let result = '';                         // 'win' | 'loss' (for selected side)
  let contest = '';                        // 'clean' | 'break' | 'foul' | 'out'
  let inlineError = '';

  // Phase 2 (additive fields)
  let half = 1;                            // 1 | 2
  let goalAtLeft = true;                   // pitch orientation
  let winner_team = 'us';                  // default so chips show immediately
  let winner_number = '';

  // QoL
  let toastMsg = '';
  let undoLocked = false;

  // When the operator explicitly changes winner team, don't auto-overwrite
  let userPickedWinnerTeam = false;
  function pickWinnerTeam(t) {
    winner_team = t;
    userPickedWinnerTeam = true;
  }

  // Sensible default for winner team once a result is chosen,
  // but only if the user hasn't already picked it.
  $: if (result && !userPickedWinnerTeam) {
    winner_team =
      ((side === 'us' && result === 'win') || (side === 'opp' && result === 'loss'))
        ? 'us'
        : 'opp';
  }

  function resetInputs() {
    landing = { nx: NaN, ny: NaN };
    result = '';
    contest = '';
    // reset winner, but leave a default so chips are visible
    winner_team = 'us';
    winner_number = '';
    userPickedWinnerTeam = false;
    inlineError = '';
  }

  function switchSide(s) {
    side = s;
    resetInputs(); // DO NOT clear event history
  }

  function validate() {
    if (Number.isNaN(landing.nx) || Number.isNaN(landing.ny)) return 'Tap the pitch to set landing';
    if (!result) return 'Choose Win or Loss';
    if (!winner_team) return 'Select who won it (Our / Opposition)';
    return '';
  }

  function save() {
    inlineError = validate();
    if (inlineError) return;

    const e = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      type: 'kickout',
      side,                         // whose restart
      result,                       // 'win' | 'loss' for that side
      win: result === 'win',
      contest_type: contest || 'clean',
      nx: landing.nx, ny: landing.ny,
      zone: zoneCode(landing.nx, landing.ny, goalAtLeft),

      // additive fields (won't break Coach view)
      half,
      orientation_left: goalAtLeft,
      winner_team,                  // 'us' | 'opp'
      winner_number                 // jersey
    };

    events.update(a => [...a, e]);
    toastMsg = `Saved: ${side==='us'?'OUR':'OPP'} — ${result.toUpperCase()}${contest?` / ${contest}`:''}${winner_number?` / #${winner_number}`:''}`;
    resetInputs();
  }

  function clearPoints() {
    if (!confirm('Remove all kickout points for this side?')) return;
    const cur = get(events);
    events.set(cur.filter(e => e.side !== side));
    toastMsg = `Cleared ${side==='us'?'OUR':'OPP'} points`;
  }

  function undoLast() {
    if (undoLocked) return;
    const cur = get(events);
    const idx = [...cur].map((e,i)=>({e,i})).reverse().find(p => p.e.side === side)?.i;
    if (idx == null) { toastMsg = 'Nothing to undo for this side'; return; }
    const removed = cur[idx];
    events.set(cur.filter((_,i)=> i !== idx));
    toastMsg = `Undid last ${side==='us'?'OUR':'OPP'} event: ${removed.result}${removed.winner_number?` / #${removed.winner_number}`:''}`;
    undoLocked = true; setTimeout(()=> (undoLocked = false), 300);
  }

  // number chip helpers
  function pickNumber(n) { winner_number = String(n); }
  function isPicked(n)   { return String(n) === String(winner_number); }
</script>

<!-- Top controls (order preserved) -->
<div class="flex flex-wrap items-center gap-2 mb-2">
  <div class="inline-flex rounded border border-gray-300 overflow-hidden">
    <button class="px-3 py-1.5 text-sm {side==='us'?'bg-black text-white':''}"  on:click={() => switchSide('us')}>Our team</button>
    <button class="px-3 py-1.5 text-sm {side==='opp'?'bg-black text-white':''}" on:click={() => switchSide('opp')}>Opposition</button>
  </div>

  <div class="inline-flex rounded border border-gray-300 overflow-hidden">
    <button class="px-3 py-1.5 text-sm {half===1?'bg-black text-white':''}" on:click={() => (half=1)}>1st half</button>
    <button class="px-3 py-1.5 text-sm {half===2?'bg-black text-white':''}" on:click={() => (half=2)}>2nd half</button>
  </div>

  <div class="inline-flex rounded border border-gray-300 overflow-hidden">
    <button class="px-3 py-1.5 text-sm {goalAtLeft?'bg-black text-white':''}"  on:click={() => (goalAtLeft=true)}>Kicking → Right</button>
    <button class="px-3 py-1.5 text-sm {!goalAtLeft?'bg-black text-white':''}" on:click={() => (goalAtLeft=false)}>Kicking → Left</button>
  </div>

  <div class="ml-auto flex items-center gap-2">
    <button class="px-3 py-1.5 border rounded" on:click={undoLast} disabled={undoLocked}>↩️ Undo</button>
    <button class="px-3 py-1.5 border rounded" on:click={clearPoints}>Clear points</button>
  </div>
</div>

<!-- Pitch -->
<Pitch bind:value={landing} {goalAtLeft} />

<!-- Main form -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
  <!-- Outcome (radios, not checkboxes) -->
  <div class="col-span-2">
    <div class="text-sm font-semibold mb-1">Outcome</div>
    <div class="flex gap-4 items-center">
      <label class="flex items-center gap-1 text-sm">
        <input type="radio" name="result" value="win"  bind:group={result}> Win
      </label>
      <label class="flex items-center gap-1 text-sm">
        <input type="radio" name="result" value="loss" bind:group={result}> Loss
      </label>
    </div>
  </div>

  <!-- Contest -->
  <div>
    <div class="text-sm font-semibold mb-1">Contest type</div>
    <select class="w-full border rounded px-2 py-2" bind:value={contest}>
      <option value="">Choose…</option>
      <option value="clean">Clean</option>
      <option value="break">Break</option>
      <option value="foul">Foul</option>
      <option value="out">Sideline</option>
    </select>
  </div>

  <!-- Winner -->
  <div>
    <div class="text-sm font-semibold mb-1">Who won it?</div>
    <div class="flex gap-4 items-center">
      <label class="flex items-center gap-1 text-sm">
        <input type="radio" name="winner_team" value="us"  checked={winner_team==='us'}  on:change={() => pickWinnerTeam('us')}> Our
      </label>
      <label class="flex items-center gap-1 text-sm">
        <input type="radio" name="winner_team" value="opp" checked={winner_team==='opp'} on:change={() => pickWinnerTeam('opp')}> Opposition
      </label>
    </div>

    <div class="mt-2 text-sm font-semibold mb-1">Winner number</div>

    {#if winner_team === 'us'}
      <!-- Number chips for OUR players -->
      <div class="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
        {#each jerseyNums as n}
          <button
            type="button"
            class="border rounded px-2 py-1 text-sm {isPicked(n)?'bg-black text-white':''}"
            on:click={() => pickNumber(n)}
          >{n}</button>
        {/each}
      </div>
    {:else}
      <!-- Simple input for Opposition -->
      <input class="w-full border rounded px-2 py-2 mt-1" placeholder="e.g., #9" bind:value={winner_number} />
    {/if}

    <div class="text-xs text-gray-600 mt-1">Number of the player who <strong>secured</strong> possession.</div>
  </div>
</div>

{#if inlineError}
  <div class="mt-2 text-sm text-red-600">{inlineError}</div>
{/if}

<div class="mt-2 flex items-center gap-2">
  <button class="px-4 py-2 border rounded bg-black text-white" on:click={save}>Save</button>
  <span class="text-sm text-gray-600">Tap the pitch to set landing</span>
</div>

<Toast message={toastMsg} />
