<script>
  import { get } from 'svelte/store';
  import { events, meta } from '../stores.js';
  import Pitch from './Pitch.svelte';
  import { jerseyNums, zoneCode } from './field.js';
  import Toast from '../lib/Toast.svelte';

  // ======= state (kept close to your original) =======
  let side = 'us';                         // whose kickout it is: 'us' | 'opp'
  let landing = { nx: NaN, ny: NaN };      // bound to Pitch
  let result = '';                         // 'win' | 'loss' (for the selected side)
  let contest = '';                        // 'clean' | 'break' | 'foul' | 'out'
  let inlineError = '';

  // Phase 2 (additive; non-breaking)
  let half = 1;                            // 1 | 2
  let goalAtLeft = true;                   // flip orientation w/o rotating device
  let winner_team = '';                    // 'us' | 'opp'
  let winner_number = '';                  // jersey text

  // QoL
  let toastMsg = '';
  let undoLocked = false;

  // Default winner team once result chosen (Clontarf-centric default)
  $: if (result) {
    const def =
      (side === 'us'  && result === 'win') ||
      (side === 'opp' && result === 'loss') ? 'us' : 'opp';
    if (!winner_team) winner_team = def;
  }

  function resetInputs() {
    landing = { nx: NaN, ny: NaN };
    result = '';
    contest = '';
    winner_team = '';
    winner_number = '';
    inlineError = '';
  }

  // ======= minimal behavior changes =======
  function switchSide(s) {
    side = s;
    // DO NOT clear recorded events; only clear the in-progress form
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
      side,                  // whose restart it was
      result,                // 'win' | 'loss' for that side
      win: result === 'win',
      contest_type: contest || 'clean',
      nx: landing.nx, ny: landing.ny,
      zone: zoneCode(landing.nx, landing.ny, goalAtLeft),

      // Phase 2 fields (ignored by older Coach view code)
      half,
      orientation_left: goalAtLeft,
      winner_team,           // who actually secured it
      winner_number          // jersey
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
    undoLocked = true; setTimeout(()=> (undoLocked=false), 300);
  }

  // number chip utils
  function pickNumber(n) {
    winner_number = String(n);
  }
  function isPicked(n) {
    return String(n) === String(winner_number);
  }
</script>

<!-- ======= top controls (order preserved & simple) ======= -->
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

<!-- ======= pitch ======= -->
<Pitch bind:value={landing} {goalAtLeft} />

<!-- ======= main form (kept close to original) ======= -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
  <!-- Outcome -->
  <div class="col-span-2">
    <div class="text-sm font-semibold mb-1">Outcome</div>
    <div class="flex gap-2">
      <button class="px-3 py-2 border rounded {result==='win'?'bg-black text-white':''}"  on:click={() => (result='win')}>✅ Win</button>
      <button class="px-3 py-2 border rounded {result==='loss'?'bg-black text-white':''}" on:click={() => (result='loss')}>✕ Loss</button>
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
    <div class="flex gap-3">
      <label class="flex items-center gap-1 text-sm"><input type="radio" name="winner" value="us"  bind:group={winner_team}> Our</label>
      <label class="flex items-center gap-1 text-sm"><input type="radio" name="winner" value="opp" bind:group={winner_team}> Opposition</label>
    </div>

    <div class="mt-2 text-sm font-semibold mb-1">Winner number</div>

    {#if winner_team === 'us'}
      <!-- number chip grid (ours) -->
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
      <!-- opposition free-text / small input (as before) -->
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
