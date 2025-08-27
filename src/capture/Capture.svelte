<script>
  import Pitch from './Pitch.svelte';
  import { events, meta } from '../stores.js';
  import Toast from '../lib/Toast.svelte';
  import { jerseyNums, zoneCode } from './field.js';
  import { get } from 'svelte/store';

  let side = 'us'; // 'us' | 'opp'
  let landing = { nx: NaN, ny: NaN };
  let result = ''; // 'win' | 'loss'
  let contest = ''; // clean|break|foul|out
  let targetPlayer = '';
  let oppReceiver = '';
  let inlineError = '';
  let toastMsg = '';
  let undoLocked = false;

  $: goalAtLeft = side === 'us';

  function resetInputs(){
    landing = { nx: NaN, ny: NaN };
    result = '';
    contest = '';
    targetPlayer = '';
    oppReceiver = '';
    inlineError = '';
  }

  function switchSide(s){
    side = s;
    resetInputs(); // do NOT clear saved events
  }

  function validate(){
    if (Number.isNaN(landing.nx) || Number.isNaN(landing.ny)) return 'Tap the pitch to set landing';
    if (!result) return 'Choose Win or Loss';
    return '';
  }

  function save(){
    inlineError = validate();
    if (inlineError) return;

    const e = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      side,
      win: result === 'win',
      result,
      contest_type: contest || 'clean',
      target: side==='us' ? targetPlayer : oppReceiver,
      nx: landing.nx,
      ny: landing.ny,
      zone: zoneCode(landing.nx, landing.ny, goalAtLeft),
    };
    events.update(arr => [...arr, e]);
    toastMsg = `Saved: ${side==='us'?'OUR':'OPP'} — ${result.toUpperCase()} ${contest?'/ '+contest:''}`;
    resetInputs();
  }

  function clearPoints(){
    if (!confirm('Remove all kickout points for this side?')) return;
    const cur = get(events);
    events.set(cur.filter(e => e.side !== side));
  }

  function undoLast(){
    if (undoLocked) return;
    const cur = get(events);
    const idx = [...cur].map((e,i)=>({e,i})).reverse().find(p=>p.e.side===side)?.i;
    if (idx==null) { toastMsg = 'Nothing to undo for this side'; return; }
    const removed = cur[idx];
    events.set(cur.filter((_,i)=>i!==idx));
    toastMsg = `Undid last ${side==='us'?'OUR':'OPP'} event` + (removed ? `: ${removed.result}, ${removed.contest_type}${removed.target?`, #${removed.target}`:''}` : '');
    undoLocked = true;
    setTimeout(()=> undoLocked=false, 300);
  }
</script>

<div class="grid md:grid-cols-[1fr_320px] gap-4">
  <section class="card p-3 md:p-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-sm text-gray-600">Side:</span>
      <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden">
        <button class="px-3 py-1.5 text-sm {side==='us'?'bg-accent text-white':'bg-white'}" on:click={()=>switchSide('us')}>Our team</button>
        <button class="px-3 py-1.5 text-sm {side==='opp'?'bg-accent text-white':'bg-white'}" on:click={()=>switchSide('opp')}>Opposition</button>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button class="btn btn-neutral" on:click={undoLast} disabled={undoLocked}>↩️ Undo</button>
        <button class="btn btn-danger" on:click={clearPoints}>Clear points</button>
      </div>
    </div>

    <Pitch bind:value={landing} {goalAtLeft} />

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      <div class="col-span-2">
        <div class="text-sm font-semibold mb-1">Outcome</div>
        <div class="flex gap-2">
          <button class="btn {result==='win'?'btn-primary':''}" on:click={()=>result='win'}>✅ Win</button>
          <button class="btn {result==='loss'?'btn-primary':''}" on:click={()=>result='loss'}>✕ Loss</button>
        </div>
      </div>

      <div>
        <div class="text-sm font-semibold mb-1">Contest type</div>
        <select class="w-full border border-gray-300 rounded-lg px-2 py-2" bind:value={contest}>
          <option value="">Choose…</option>
          <option value="clean">Clean</option>
          <option value="break">Break</option>
          <option value="foul">Foul</option>
          <option value="out">Sideline</option>
        </select>
      </div>

      <div>
        {#if side==='us'}
          <div class="text-sm font-semibold mb-1">Select receiver</div>
          <select class="w-full border border-gray-300 rounded-lg px-2 py-2" bind:value={targetPlayer}>
            <option value="">—</option>
            {#each jerseyNums as n}<option value={n}>{n}</option>{/each}
          </select>
        {:else}
          <div class="text-sm font-semibold mb-1">Select opposition receiver</div>
          <input class="w-full border border-gray-300 rounded-lg px-2 py-2" placeholder="e.g., #9" bind:value={oppReceiver}/>
        {/if}
      </div>
    </div>

    {#if inlineError}
      <div class="mt-2 text-sm text-red-600">{inlineError}</div>
    {/if}

    <div class="mt-3 flex items-center gap-2">
      <button class="btn btn-primary" on:click={save}>Save</button>
      <!-- Review button handled as tab in App; here we can show hint -->
      <span class="text-sm text-gray-500">Use “Coach view” tab for analysis</span>
    </div>
  </section>

  <aside class="card p-3 md:p-4">
    <h3 class="font-semibold mb-2">Session</h3>
    <label class="block mb-2">
      <span class="text-sm text-gray-600">Our team</span>
      <input class="w-full border border-gray-300 rounded-lg px-2 py-2" bind:value={$meta.team} placeholder="Clontarf"/>
    </label>
    <label class="block mb-2">
      <span class="text-sm text-gray-600">Opponent</span>
      <input class="w-full border border-gray-300 rounded-lg px-2 py-2" bind:value={$meta.opponent} placeholder="Opposition"/>
    </label>
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-600">Kicking direction</span>
      <button class="btn btn-neutral" on:click={()=> meta.update(m=>({...m,kicking_goal_top:!m.kicking_goal_top}))}>
        { $meta.kicking_goal_top ? 'Goal at left' : 'Goal at right' }
      </button>
    </div>

    <div class="mt-3 text-sm text-gray-600">Events: {$events.length}</div>
  </aside>
</div>

<Toast {message}={toastMsg} />
