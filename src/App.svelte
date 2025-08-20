<script>
  let count = 0;
</script>

<main class="min-h-screen flex flex-col items-center justify-center gap-6">
  <h1 class="text-3xl font-bold">Svelte + Tailwind v4 ✅</h1>

  <button
    class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
    on:click={() => count++}
  >
    Count: {count}
  </button>

  <p class="text-sm text-gray-600">If you can see this, everything is wired up.</p>
</main>
