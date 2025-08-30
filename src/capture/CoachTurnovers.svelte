<!-- src/capture/CoachTurnovers.svelte -->
<script>
  import Pitch from './Pitch.svelte';
  import { team, opponent, turnovers, half as halfFilter } from '../stores.js';
  import { pill } from '../styles/util.js';
  import { get } from 'svelte/store';

  let tabHalf = 'all';       // 'all' | 1 | 2
  let typeFilter = 'all';    // 'all' | 'gains' | 'losses'

  $: raw = get(turnovers) || [];

  $: filtered = raw.filter(t => {
    const okHalf = tabHalf === 'all' || t.half === tabHalf;
    const okType = typeFilter === 'all' || (typeFilter === 'gains' ? t.type === 'gain' : t.type === 'loss');
    return okHalf && okType;
  });

  $: markers = filtered.map(t => ({
    x: clamp01(t.x ?? 0.5),
    y: clamp01(t.y ?? 0.5),
    color: t.type === 'gain' ? '#10b981' : '#ef4444'
  }));

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
</script>

<style>
  .row { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-bottom:.5rem; }
  .pill { padding:.4rem .75rem; border-radius:999px; border:1px solid #d5d5d5; background:#f6f6f6; }
  .pill.active { background:#0b2a4a; color:#fff; border-color:#0b2a4a; }
  .header { font-weight:700; margin:.25rem 0 .5rem; }
</style>

<div class="header">Turnovers</div>

<div class="row">
  <button class={pill(tabHalf==='all')} on:click={() => tabHalf='all'}>All</button>
  <button class={pill(tabHalf===1)}     on:click={() => tabHalf=1}>1st</button>
  <button class={pill(tabHalf===2)}     on:click={() => tabHalf=2}>2nd</button>

  <span style="margin-left:.75rem;"></span>

  <button class={pill(typeFilter==='all')}   on:click={() => typeFilter='all'}>All</button>
  <button class={pill(typeFilter==='gains')} on:click={() => typeFilter='gains'}>Gains</button>
  <button class={pill(typeFilter==='losses')} on:click={() => typeFilter='losses'}>Losses</button>
</div>

<Pitch overlays={markers} />
