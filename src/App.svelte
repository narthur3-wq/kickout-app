<script>
  import Capture from './capture/Capture.svelte';
  let CoachView = null, Review = null;
  let tab = 'live';

  async function loadCoach() {
    if (!CoachView) {
      try {
        CoachView = (await import('./capture/CoachView.svelte')).default;
      } catch (e) {
        console.error(e);
      }
    }
    tab = 'coach';
  }

  async function loadReview() {
    if (!Review) {
      try {
        Review = (await import('./capture/Review.svelte')).default;
      } catch (e) {
        console.error(e);
      }
    }
    tab = 'review';
  }
</script>

<header class="w-full bg-white border-b border-gray-200 sticky top-0 z-20">
  <div class="max-w-5xl mx-auto flex items-center gap-3 p-3">
    <!-- Crest intentionally removed to rule out invalid handler issues -->
    <h1 class="text-lg font-semibold">Kickout App</h1>
    <nav class="ml-auto flex items-center gap-2">
      <button class="btn {tab === 'live' ? 'btn-primary' : ''}" on:click={() => (tab = 'live')}>Live</button>
      <button class="btn {tab === 'coach' ? 'btn-primary' : ''}" on:click={loadCoach}>Coach view</button>
      <button class="btn {tab === 'review' ? 'btn-primary' : ''}" on:click={loadReview}>Review</button>
    </nav>
  </div>
</header>

<main class="max-w-5xl mx-auto p-3">
  {#if tab === 'live'}
    <Capture />
  {:else if tab === 'coach'}
    {#if CoachView}
      <svelte:component this={CoachView} />
    {:else}
      <div class="p-4">Loading…</div>
    {/if}
  {:else if tab === 'review'}
    {#if Review}
      <svelte:component this={Review} />
    {:else}
      <div class="p-4">Loading…</div>
    {/if}
  {/if}
</main>
