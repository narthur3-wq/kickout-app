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
    <button class="btn" on:click={flipOrientation}>Flip</button>
    <button class="btn" on:click={doUndo}>Undo</button>
    <button class="btn primary" on:click={doSave}>Save</button>
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
  .btn{ border:1px solid #e5e7eb; background:#fff; padding:8px 12px; border-radius:10px; font-weight:700; cursor:pointer; }
  .btn.primary{ background:#0c66ff; border-color:#0c66ff; color:#fff; }

  .wrap{ padding:16px; }
</style>
