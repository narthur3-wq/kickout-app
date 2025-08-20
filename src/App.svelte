cat > src/App.svelte <<'EOF'
<script>
  let count = 0;
</script>

<main class="min-h-screen flex flex-col items-center justify-center gap-6">
  <h1 class="text-3xl font-bold text-blue-600">Svelte + Tailwind v4 ✅</h1>
  <button
    class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
    on:click={() => count++}
  >
    Count: {count}
  </button>
</main>
EOF
