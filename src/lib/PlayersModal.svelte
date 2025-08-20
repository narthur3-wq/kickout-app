<script>
  import { isModalOpen } from "../stores.js";
  const close = () => isModalOpen.set(false);
</script>

{#if $isModalOpen}
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 w-[min(90vw,32rem)] shadow-lg">
      <header class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Players</h2>
        <button class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" on:click={close}>✕</button>
      </header>
      <slot>Put player list/UI here…</slot>
    </div>
  </div>
{/if}
