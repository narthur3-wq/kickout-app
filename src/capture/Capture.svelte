<!-- src/capture/Capture.svelte -->
<script>
  import Pitch from './Pitch.svelte';
  import { pill } from '../styles/util.js';
  import { orientationLabel } from '../stores.js';

  // Keep or replace with your existing state/stores:
  let side = 'us';            // 'us' | 'opp'
  let half = 1;               // 1 | 2
  let contest = 'clean';      // 'clean' | 'break' | 'foul' | 'sideline'
  let winner = 'our';         // 'our' | 'opp'
  let selectedNumber = '';    // jersey number input

  // Example pitch markers (empty by default)
  let overlays = [];
</script>

<style>
  .row { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
  .label { font-weight:600; margin-right:.25rem; }
  .pill { padding:.5rem .85rem; border-radius:999px; background:#f4f4f4; border:1px solid #ddd; }
  .pill.active { background:#0b2a4a; color:#fff; border-color:#0b2a4a; }
  .field { gap: .75rem; margin-top:.75rem; }
  .hgroup { display:flex; gap:.35rem; }
  input[type="text"] { padding:.45rem .6rem; border:1px solid #ddd; border-radius:8px; width:7rem; }
  .header { margin: .5rem 0 1rem; color:#3b3b3b; }
</style>

<div class="header">
  <strong>{$orientationLabel}</strong>
</div>

<div class="row field">
  <span class="label">Side</span>
  <button class={pill(side==='us')}     on:click={() => side='us'}>Us</button>
  <button class={pill(side==='opp')}    on:click={() => side='opp'}>Opposition</button>
</div>

<div class="row field">
  <span class="label">Half</span>
  <div class="hgroup">
    <button class={pill(half===1)} on:click={() => half=1}>1</button>
    <button class={pill(half===2)} on:click={() => half=2}>2</button>
  </div>
</div>

<div class="row field">
  <span class="label">Contest</span>
  <button class={pill(contest==='clean')}    on:click={() => contest='clean'}>Clean</button>
  <button class={pill(contest==='break')}    on:click={() => contest='break'}>Break</button>
  <button class={pill(contest==='foul')}     on:click={() => contest='foul'}>Foul</button>
  <button class={pill(contest==='sideline')} on:click={() => contest='sideline'}>Sideline</button>
</div>

<div class="row field">
  <span class="label">Winner</span>
  <button class={pill(winner==='our')} on:click={() => winner='our'}>Our</button>
  <button class={pill(winner==='opp')} on:click={() => winner='opp'}>Opp</button>
  <input type="text" placeholder="Number" bind:value={selectedNumber} />
</div>

<div style="margin-top: 1rem;">
  <Pitch {overlays} />
</div>

<!-- Hook your real-onclick save handlers back here when you’re ready -->
