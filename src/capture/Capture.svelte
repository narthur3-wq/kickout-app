<script>
  import { get } from 'svelte/store';
  import { events, meta } from '../stores.js';
  import Toast from '../lib/Toast.svelte';
  import Pitch from './Pitch.svelte';
  import { jerseyNums, zoneCode } from './field.js';

  // ---- Live tab state (minimal + safe) ----
  let side = 'us';                 // whose kickout is it: 'us' | 'opp'
  let landing = { nx: NaN, ny: NaN };
  let result = '';                 // 'win' | 'loss'   (result for the selected side)
  let contest = '';                // 'clean' | 'break' | 'foul' | 'out'
  let inlineError = '';

  // Phase 2 additions (lightweight; backward compatible)
  let half = 1;                    // 1 | 2
  let goalAtLeft = true;           // flip pitch orientation without rotating device
  let winner_team = '';            // 'us' | 'opp'
  let winner_number = '';          // jersey number text

  // QoL
  let toastMsg = '';
  let undoLocked = false;

  // derive default winner based on side+result once result picked
  $: if (result) {
    const defaultTeam =
      (side === 'us'  && result === 'win') ||
      (side === 'opp' && result === 'loss') ? 'us' : 'opp';
    if (!winner_team) winner_team = defaultTeam;
  }

  function resetInputs() {
    landing = { nx: NaN, ny: NaN };
    result = '';
    contest = '';
    winner_team = '';
    winner_number = '';
    inlineError = '';
  }

  function switchSide(s) {
    side = s;
    // DO NOT clear recorded history; only reset in-progress inputs
    resetInputs();
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
      side,                        // whose restart it was (our/opp)
      result,                      // 'win' | 'loss' for that side
      win: result === 'win',
      contest_type: contest || 'clean',
      nx: landing.nx, ny: landing.ny,
      zone: zoneCode(landing.nx, landing.ny, goalAtLeft),

      // phase 2 fields (non-breaking for existing CoachView)
      half,                        // 1 or 2
      orientation_left: goalAtLeft,
      winner_team,                 // 'us' | 'opp' (who actually secured it)
      winner_number                // jersey #
    };

    events.update(arr => [...arr, e]);
    toastMsg = `Saved: ${side==='us' ? 'OUR' : 'OPP'} — ${result.toUpperCase()}${contest ? ` / ${contest}` : ''}${winner_number ? ` / #${winner_number}` : ''}`;
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
    // find last event for current side only
    const idx = [...cur]
      .map((e, i) => ({ e, i }))
      .reverse()
      .find(p => p.e.side === side)?.i;

    if (idx == null) {
      toastMsg = 'Nothing to undo for this side';
      return;
    }

    const removed = cur[idx];
    events.set(cur.filter((_, i) => i !== idx));
    toastMsg = `Undid last ${side==='us'?'OUR':'OPP'} event: ${removed.result}${removed.winner_number ? ` / #${removed.winner_number}` : ''}`;

    // throttle to avoid double-undo
    undoLocked = true;
    setTimeout(() => (undoLocked = false), 300);
  }
</script>

<!-- Top controls -->
<div class="flex flex-wrap items-center gap-2 mb-3">
  <!-- Our/Opp side toggle (no data clearing) -->
  <div class="inline-flex rounded border border-gray-300 overflow-hidden">
    <button class="px-3 py-1.5 text-sm {side==='us' ? 'bg-blue-600 text-white' : ''}"  on:click={() => switchSide('us')}>Our team</button>
    <button class="px-3 py-1.5 text-sm {side==='opp' ? 'bg-blue-600 text-white' : ''}" on:click={() => switchSide('opp')}>Opposition</button>
  </div>

  <!-- Half selector -->
  <div class="inline-flex rounded border border-gray-300 overflow-hidden ml-2">
    <button class="px-3 py-1.5 text-sm {half===1 ? 'bg-gray-800 text-white' : ''}" on:click={() => (half = 1)}>1st half</button>
    <button class="px-3 py-1.5 text-sm {half===2 ? 'bg-gray-800 text-white' : ''}" on:click={() => (half = 2)}>2nd half</button>
  </div>

  <!-- Orientation toggle (flip pitch) -->
  <div class="inline-flex rounded border border-gray-300 overflow-hidden ml-2">
    <button class="px-3 py-1.5 text-sm {goalAtLeft ? 'bg-gray-800 text-white' : ''}"  on:click={() => (goalAtLeft = true)}>Kicking → Right</button>
    <button class="px-3 py-1.5 text-sm {!goalAtLeft ? 'bg-gray-800 text-white' : ''}" on:click={() => (goalAtLeft = false)}>Kicking → Left</button>
  </div>

  <div class="ml-auto flex items-center gap-2">
    <button class="px-3 py-1.5 border rounded" on:click={undoLast} disabled={undoLocked}>↩️ Undo</button>
    <button class="px-3 py-1.5 border rounded" on:click={clearPoints}>Clear points</button>
  </div>
</div>

<!-- Pitch -->
<Pitch bind:value={landing} {goalAtLeft} />

<!-- Outcome & contest -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
  <div class="col-span-2">
    <div class="text-sm font-semibold mb-1">Outcome</div>
    <div class="flex gap-2">
      <button class="px-3 py-2 border rounded {result==='win'  ? 'bg-blue-600 text-white' : ''}" on:click={() => (result = 'win')}>✅ Win</button>
      <button class="px-3 py-2 border rounded {result==='loss' ? 'bg-blue-600 text-white' : ''}" on:click={() => (result = 'loss')}>✕ Loss</button>
    </div>
  </div>

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

  <!-- Winner clarity -->
  <div>
    <div class="text-sm font-semibold mb-1">Who won it?</div>
    <div class="flex gap-2">
      <label class="flex items-center gap-1 text-sm"><input type="radio" name="winner" value="us"  bind:group={winner_team}> Our</label>
      <label class="flex items-center gap-1 text-sm"><input type="radio" name="winner" value="opp" bind:group={winner_team}> Opposition</label>
    </div>

    <div class="mt-2 text-sm font-semibold mb-1">Winner number</div>

    {#if winner_team === 'us'}
      <select class="w-full border rounded px-2 py-2" bind:value={winner_number}>
        <option value="">—</option>
        {#each jerseyNums as n}
          <option value={n}>{n}</option>
        {/each}
      </select>
    {:else}
      <input class="w-full border rounded px-2 py-2" placeholder="e.g., #9" bind:value={winner_number} />
    {/if}

    <div class="text-xs text-gray-500 mt-1">Number of the player who <strong>secured</strong> possession.</div>
  </div>
</div>

{#if inlineError}
  <div class="mt-2 text-sm text-red-600">{inlineError}</div>
{/if}

<div class="mt-3 flex items-center gap-2">
  <button class="px-4 py-2 border rounded bg-blue-600 text-white" on:click={save}>Save</button>
  <span class="text-sm text-gray-500">Coach view has the analysis</span>
</div>

<Toast message={toastMsg} />
