<script>
  import { createEventDispatcher } from 'svelte';

  // Two-way bound model: e.g. { goal:true, point:false, ... }
  export let model = {};
  // Items: [{ key:'goal', label:'Goal' }, ...]
  export let items = [];
  export let ariaLabel = '';
  export let dense = false;

  const dispatch = createEventDispatcher();

  function toggle(key) {
    // IMPORTANT: reassign the whole object so Svelte propagates to parent
    const next = { ...model, [key]: !model[key] };
    model = next;                       // <-- this triggers bind:model
    dispatch('change', { key, value: next[key], model: next });
  }
</script>

<div class="seg {dense ? 'dense' : ''}" role="group" aria-label={ariaLabel}>
  {#each items as it}
    <button
      type="button"
      class:active={!!model[it.key]}
      aria-pressed={!!model[it.key]}
      on:click={() => toggle(it.key)}
    >
      {it.label}
    </button>
  {/each}
</div>

<style>
  /* local pill styling (parents also style .seg in some places;
     this gives TogglePills a nice default on its own too) */
  .seg {
    display: inline-flex;
    gap: 8px;
    padding: 4px;
    background: #f6f7fb;
    border-radius: 999px;
    flex-wrap: wrap;
  }
  .seg.dense { gap: 6px; padding: 3px; }
  .seg > button {
    border: 1px solid #d8e0ea;
    background: #fff;
    padding: 6px 12px;
    border-radius: 999px;
    font-weight: 700;
    cursor: pointer;
  }
  .seg > button.active {
    background: #0660aa;
    color: #fff;
    border-color: #0660aa;
  }
</style>
