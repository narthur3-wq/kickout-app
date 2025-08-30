<!-- src/capture/CoachShots.svelte -->
<script>
  import Pitch from './Pitch.svelte';
  import { team, opponent, half as halfFilter, current_side, shots } from '../stores.js';
  import { pill } from '../styles/util.js';
  import { get } from 'svelte/store';

  let tabHalf = 'all';     // 'all' | 1 | 2
  let sideFilter = 'us';   // 'us' | 'opp'

  // Use real shots from store (provide fallback to render)
  $: raw = get(shots) || [];

  $: filtered = raw.filter(s => {
    return (tabHalf === 'all' || s.half === tabHalf) && (sideFilter === 'all' || s.who === sideFilter);
  });

  $: markers = filtered.map(s => ({
    x: clamp01(s.x ?? 0.5),
    y: clamp01(s.y ?? 0.5),
    color: s.who === 'us' ? '#10b981' : '#e11d48'
  }));

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
</script>

<style>
  .row { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-bottom:.5rem; }
  .pill { padding:.4rem .75rem; border-radius:999px; border:1px solid #d5d5d5; background:#f6f6f6; }
  .pill.active { background:#0b2a4a; color:#fff; border-color:#0b2a4a; }
  .header { font-weight:700; margin:.25rem 0 .5rem; }
</style>

<div class="header">Shots</div>

<div class="row">
  <button class={pill(tabHalf==='all')} on:click={() => tabHalf='all'}>All</button>
  <button class={pill(tabHalf===1)}     on:click={() => tabHalf=1}>1st</button>
  <button class={pill(tabHalf===2)}     on:click={() => tabHalf=2}>2nd</button>

  <span style="margin-left:.75rem;"></span>

  <button class={pill(sideFilter==='all')} on:click={() => sideFilter='all'}>All</button>
  <button class={pill(sideFilter==='us')}  on:click={() => sideFilter='us'}>{$team}</button>
  <button class={pill(sideFilter==='opp')} on:click={() => sideFilter='opp'}>{$opponent}</button>
</div>

<Pitch overlays={markers} />
