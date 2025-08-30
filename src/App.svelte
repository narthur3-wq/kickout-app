<script>
  import Capture from './capture/Capture.svelte';
  import CoachView from './capture/CoachView.svelte';
  import { meta } from './stores.js';

  // tabs
  const tabs = [
    { key: 'live', label: 'Live' },
    { key: 'coach', label: 'Coach view' },
  ];
  let tab = 'live';
</script>

<header class="topbar">
  <img src="/crest.png" alt="crest" />
  <nav class="tabs">
    {#each tabs as t}
      <button type="button" class:active={tab===t.key} on:click={() => tab=t.key}>{t.label}</button>
    {/each}
  </nav>
</header>

<main class="wrap">
  {#if tab==='live'}
    <Capture />
  {:else}
    <CoachView />
  {/if}
</main>

<style>
  .topbar{
    display:flex; gap:16px; align-items:center; padding:10px 14px; border-bottom:1px solid #eee; background:#fff; position:sticky; top:0; z-index:10;
  }
  .topbar img{ height:56px; width:auto; object-fit:contain; }
  .tabs{ display:flex; gap:8px; }
  .tabs button{ padding:8px 14px; border:1px solid #dcdcdc; border-radius:999px; background:#fff; font-weight:600; }
  .tabs button.active{ background:#0b1c3f; color:#fff; border-color:#0b1c3f; }
  .wrap{ padding:16px; max-width:1200px; margin:0 auto; }
  @media (min-width: 900px){
    .topbar img{ height:72px; }
  }
</style>
