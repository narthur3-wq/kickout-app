<script>
  import Capture from './capture/Capture.svelte';

  // Lazy tabs (safe even if files are missing)
  let CoachView = null, Review = null;
  let tab = 'live';
  async function loadCoach(){ if(!CoachView){ try{ CoachView=(await import('./capture/CoachView.svelte')).default; }catch{ CoachView={$$render:()=> 'Coach view not available'}; } } tab='coach'; }
  async function loadReview(){ if(!Review){ try{ Review=(await import('./capture/Review.svelte')).default; }catch{ Review={$$render:()=> 'Review not available'}; } } tab='review'; }
</script>

<div class="app-shell">
  <header class="app-header">
    <div class="brand">kickout tracker</div>
  </header>

  <nav class="tabs">
    <button class:active={tab==='live'}   on:click={()=>tab='live'}>Live</button>
    <button class:active={tab==='coach'}  on:click={loadCoach}>Coach view</button>
    <button class:active={tab==='review'} on:click={loadReview}>Review</button>
  </nav>

  <main class="app-main">
    {#if tab==='live'}
      <Capture />
    {:else if tab==='coach' && CoachView}
      <svelte:component this={CoachView}/>
    {:else if tab==='review' && Review}
      <svelte:component this={Review}/>
    {/if}
  </main>
</div>

<style>
  .app-header{
    position:sticky; top:0; z-index:30;
    background:#0ea76a; color:#fff;
    border-bottom:1px solid rgba(0,0,0,.08);
    padding:10px 14px; display:flex; justify-content:center;
  }
  .brand{
    font-weight:900; letter-spacing:.5px;
    text-transform:uppercase; /* UAT: ALL CAPS */
  }
  .tabs{
    position:sticky; top:48px; z-index:25;
    display:flex; gap:8px; padding:8px 12px; background:#fff; border-bottom:1px solid #eee;
  }
  .tabs button{ border:1px solid #d1d5db; border-radius:999px; padding:6px 12px; background:#fff; cursor:pointer; }
  .tabs button.active{ background:#111; color:#fff; border-color:#111; }
  .app-main{ padding:10px 12px; }
</style>
