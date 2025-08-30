<script>
  import { onDestroy } from 'svelte';
  export let message = '';
  export let timeout = 2000;

  let visible = false;
  let timer;

  $: if (message) {
    visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => (visible = false), timeout);
  }

  onDestroy(() => clearTimeout(timer));
</script>

{#if visible}
  <div class="toast">{message}</div>
{/if}

<style>
  .toast {
    position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
    background:#111; color:#fff; padding:10px 14px; border-radius:999px;
    font-weight:600; box-shadow:0 6px 22px rgba(0,0,0,.2); z-index:9999;
  }
</style>
