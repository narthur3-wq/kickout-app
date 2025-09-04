<script>
  import { toastStore } from '$lib/stores.js';
  let data;
  $: data; // keep reactive
  $: $toastStore; // subscribe
</script>

{#if $toastStore.message}
  <div class="toast {$toastStore.kind}">
    <span>{$toastStore.message}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    right: 16px;
    bottom: 16px;
    background: #111827;
    color: #fff;
    border-radius: 10px;
    padding: 10px 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,.22);
    z-index: 9999;
    max-width: min(92vw, 420px);
    font: 600 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .toast.success { background: #16a34a; }
  .toast.error   { background: #dc2626; }
</style>
