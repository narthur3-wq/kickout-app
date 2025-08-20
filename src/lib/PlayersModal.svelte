<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let players = /** @type {string[]} */ ([]);

  const dispatch = createEventDispatcher<{ save: string[]; cancel: void }>();
  let draft = players.slice();

  function add(){ draft = [...draft, '']; }
  function remove(i:number){ draft = draft.filter((_,idx)=>idx!==i); }
  function save(){ dispatch('save', draft.map(v=>v.trim()).filter(Boolean)); }
</script>

<div class="fixed inset-0 grid place-items-center bg-black/40 p-4 z-50">
  <div class="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
    <h3 class="text-base font-semibold mb-3">Edit player list</h3>

    <div class="space-y-2 max-h-[50vh] overflow-auto">
      {#each draft as p, i}
        <div class="flex gap-2">
          <input class="flex-1 h-9 rounded-md border border-neutral-300 dark:border-neutral-700 px-2"
                 bind:value={draft[i]} placeholder={`Player ${i+1}`} />
          <button class="h-9 px-3 rounded-md border border-rose-300 text-rose-600 dark:border-rose-700"
                  on:click={() => remove(i)}>Remove</button>
        </div>
      {/each}
    </div>

    <div class="mt-4 flex justify-between">
      <button class="h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-700" on:click={add}>+ Add player</button>
      <div class="flex gap-2">
        <button class="h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-700" on:click={() => dispatch('cancel')}>Cancel</button>
        <button class="h-9 px-3 rounded-md border border-neutral-900 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" on:click={save}>Save</button>
      </div>
    </div>
  </div>
</div>
