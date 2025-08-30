<script>
  import CoachDigest from './CoachDigest.svelte';
  import CoachKickouts from './CoachKickouts.svelte';
  import CoachShots from './CoachShots.svelte';
  import CoachTurnovers from './CoachTurnovers.svelte';

  const tabs = [
    { key: 'digest',   label: 'Digest' },
    { key: 'kickouts', label: 'Kickouts' },
    { key: 'shots',    label: 'Shots' },
    { key: 'turnovers',label: 'Turnovers' },
  ];
  let tab = 'digest';
</script>

<nav class="tabs" style="margin-bottom:12px">
  {#each tabs as t}
    <button class:active={tab===t.key} on:click={() => tab=t.key} type="button">{t.label}</button>
  {/each}
</nav>

{#if tab==='digest'}     <CoachDigest />
{:else if tab==='kickouts'} <CoachKickouts />
{:else if tab==='shots'}    <CoachShots />
{:else}                     <CoachTurnovers />
{/if}
