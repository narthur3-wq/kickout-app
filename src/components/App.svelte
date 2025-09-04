<script>
  import Toast from './Toast.svelte';
  import {
    half, orientation_left, orientationLabel,
    setHalf, toggleOrientation, commitPending, undoPending, toast
  } from '$lib/stores.js';

  import Capture from './Capture.svelte';
  import CoachDigest from './CoachDigest.svelte';
  import CoachKickouts from './CoachKickouts.svelte';
  import CoachShots from './CoachShots.svelte';
  import CoachTurnovers from './CoachTurnovers.svelte';

  let tab = 'capture';
  const tabs = [
    { key:'capture',  label:'Capture' },
    { key:'digest',   label:'Digest' },
    { key:'kickouts', label:'Kickouts' },
    { key:'shots',    label:'Shots' },
    { key:'tos',      label:'Turnovers' }
  ];

  function doUndo(){
    const ok = undoPending();
    toast(ok ? 'Removed last unsaved event' : 'Nothing to undo', ok ? 'success' : 'info', 1400);
  }
  function flipOrientation(){ toggleOrientation(); }
  function doSave(){ commitPending(); }
</script>

<div class="topbar">
  <div class="brand">
    <img src="/crest.png" alt="Crest" on:error={(e)=>{e.currentTarget.style.display='none'}} />
    Kickout
  </div>

  <div class="tabs" role="tablist" aria-label="Views">
    {#each tabs as t}
      <button role="tab" aria-selected={tab===t.key} class:active={tab===t.key} on:click={()=>tab=t.key}>
        {t.label}
      </button>
    {/each}
  </div>

  <div style="margin-left:auto" class="toolbar">
    <div class="badge" title="Orientation"><strong>Clontarf kicking — {$orientationLabel}</strong></div>
    <div class="seg" aria-label="Half">
      <button class:active={$half===1} on:click={()=>setHalf(1)}>H1</button>
      <button class:active={$half===2} on:click={()=>setHalf(2)}>H2</button>
      <button class:active={$half==='all'} on:click={()=>setHalf('all')}>All</button>
    </div>
        <button
      class="icon-btn"
      on:click={flipOrientation}
      aria-label="Flip orientation"
      title="Flip orientation">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7 7h10" />
        <path d="M7 7l-3 3" />
        <path d="M7 7l-3-3" />
        <path d="M17 17H7" />
        <path d="M17 17l3 3" />
        <path d="M17 17l3-3" />
      </svg>
    </button>
    <button class="btn secondary" on:click={doUndo} aria-label="Undo last action">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 5 3 12 9 19" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
      <span>Undo</span>
    </button>
    <button class="btn primary" on:click={doSave} aria-label="Save events">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.6 7.59a1 1 0 01-1.41 0L3.29 9.86a1 1 0 011.42-1.42l3.3 3.3 6.89-6.9a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
      <span>Save</span>
    </button>
    </div>
</div>

<div class="wrap">
  {#if tab === 'capture'}
    <Capture />
  {:else if tab === 'digest'}
    <CoachDigest />
  {:else if tab === 'kickouts'}
    <CoachKickouts />
  {:else if tab === 'shots'}
    <CoachShots />
  {:else if tab === 'tos'}
    <CoachTurnovers />
  {/if}
</div>

<Toast />

<style>
  .topbar{
    display:flex; align-items:center; gap:16px;
    padding:10px 14px; background:#fff; border-bottom:1px solid #eee;
    position:sticky; top:0; z-index:10;
  }
  .brand{ display:flex; gap:10px; align-items:center; font-weight:800; }
  .brand img{ height:28px; }

  .tabs{ display:flex; gap:8px; }
  .tabs button{
    border:1px solid #e5e7eb; background:#fff; border-radius:999px; padding:8px 14px;
    font-weight:700; cursor:pointer;
  }
  .tabs button.active{ background:#0c66ff; border-color:#0c66ff; color:#fff; }

  .toolbar{ display:flex; gap:8px; align-items:center; }
  .badge{ background:#f3f4f6; border-radius:8px; padding:6px 10px; }
  .seg{ display:inline-flex; gap:6px; padding:4px; background:#f6f7fb; border-radius:999px; }
  .seg>button{ border:0; background:transparent; padding:6px 10px; border-radius:999px; cursor:pointer; font-weight:700; }
  .seg>button.active{ background:#0c66ff; color:#fff; }
  .btn{
    border:1px solid #e5e7eb; background:#fff; padding:8px 12px; border-radius:10px;
    font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;
  }
  .btn svg{ width:16px; height:16px; }
  .btn.primary{ background:#0c66ff; border-color:#0c66ff; color:#fff; }
  
  .wrap{ padding:16px; }
</style>
