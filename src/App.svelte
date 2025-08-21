<script>
  import Capture from './capture/Capture.svelte';
  import CoachView from './capture/CoachView.svelte';
  import Review from './capture/Review.svelte';
  import { meta } from './stores.js';

  let tab = localStorage.getItem('kickout:tab') || 'live';
  $: localStorage.setItem('kickout:tab', tab);

  // Dark mode toggle updates <html> class
  $: {
    if ($meta.dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }
</script>

<div class="topnav">
  <button class="tab" class:active={tab==='live'}  on:click={() => tab='live'}>Live</button>
  <button class="tab" class:active={tab==='coach'} on:click={() => tab='coach'}>Coach View</button>
  <button class="tab" class:active={tab==='review'} on:click={() => tab='review'}>Review</button>
  <div class="spacer"></div>
  <label style="display:flex;gap:6px;align-items:center">
    <input type="checkbox" bind:checked={$meta.dark}> Dark
  </label>
  <label style="display:flex;gap:6px;align-items:center">
    <input type="checkbox" bind:checked={$meta.wake_lock}> Wake-lock
  </label>
</div>

{#if tab==='live'}      <Capture />
{:else if tab==='coach'}<CoachView />
{:else}                 <Review /> {/if}
