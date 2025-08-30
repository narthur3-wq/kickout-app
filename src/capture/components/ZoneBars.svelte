<!-- src/capture/components/ZoneBars.svelte -->
<script>
  export let title = '';
  export let zones = [
    { label: 'Left',    attempts: 0, wins: 0, losses: 0 },
    { label: 'Centre',  attempts: 0, wins: 0, losses: 0 },
    { label: 'Right',   attempts: 0, wins: 0, losses: 0 },
  ];
</script>

<style>
  .card { border:1px solid #e5e7eb; border-radius:12px; padding:12px; background:#fff; }
  .row { display:flex; gap:8px; align-items:center; margin:6px 0; }
  .bar { height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; flex:1; }
  .win { height:100%; background:#16a34a; }
  .loss { height:100%; background:#ef4444; }
  .hdr { font-weight:700; margin-bottom:8px; }
</style>

<div class="card">
  {#if title}<div class="hdr">{title}</div>{/if}
  {#each zones as z}
    <div class="row">
      <div style="width:90px">{z.label} · {z.attempts} att</div>
      <div class="bar">
        <div class="win" style="width: {z.attempts ? (z.wins / z.attempts) * 100 : 0}%"></div>
      </div>
      <div style="width:40px; text-align:right">{z.wins}W</div>
      <div style="width:40px; text-align:right; color:#ef4444">{z.losses}L</div>
    </div>
  {/each}
</div>
