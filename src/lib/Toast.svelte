<script>
  import { onDestroy } from 'svelte';

  export let message = '';
  export let timeout = 2000;

  let visible = false;
  let timer;

  // Show the toast whenever `message` becomes truthy, then auto-hide
  $: if (message) {
    visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => (visible = false), timeout);
  }

  onDestroy(() => clearTimeout(timer));
</script>

{#if visible}
  <div
    class="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 bg-white border border-gray-200 shadow-md rounded-lg text-sm z-50"
  >
    {message}
  </div>
{/if}
