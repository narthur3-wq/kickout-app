<script>
  import Pitch from "./lib/Pitch.svelte";
  import PlayerDashboard from "./lib/PlayerDashboard.svelte";
  import PlayersModal from "./lib/PlayersModal.svelte";
  import { isModalOpen } from "./stores.js";

  const openModal = () => isModalOpen.set(true);
</script>

<main class="min-h-screen bg-slate-50 py-10">
  <div class="container mx-auto px-4 max-w-7xl space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl md:text-3xl font-bold text-blue-600">
        Kickout App
      </h1>

      <div class="flex gap-3">
        <button
          class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          on:click={openModal}
        >
          Manage Players
        </button>
      </div>
    </header>

    <div class="grid gap-6 md:grid-cols-3">
      <section class="md:col-span-2">
        <Pitch />
      </section>

      <aside>
        <PlayerDashboard />
      </aside>
    </div>
  </div>

  <PlayersModal />
</main>
