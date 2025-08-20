<script lang="ts">
  type Row = { player: string; tot: number; pct: number };
  const { events = [] } = $props<{ events: any[] }>();

  const rows = $derived.by((): Row[] => {
    const by = new Map<string, { tot: number; ret: number }>();
    for (const e of events) {
      const key = (e?.target_player ?? '').trim() || '—';
      const m = by.get(key) ?? { tot: 0, ret: 0 };
      m.tot++;
      if (e?.outcome === 'Retained' || e?.outcome === 'Score' || e?.outcome === 'Won') m.ret++;
      by.set(key, m);
    }
    return [...by.entries()]
      .map(([player, m]) => ({
        player,
        tot: m.tot,
        pct: m.tot ? Math.round((100 * m.ret) / m.tot) : 0
      }))
      .sort((a, b) => b.tot - a.tot || a.player.localeCompare(b.player));
  });
</script>

<div class="card overflow-auto">
  <div class="p-4 border-b border-neutral-200 dark:border-neutral-800 font-semibold">Players</div>
  <table class="w-full text-sm">
    <thead class="bg-neutral-50 dark:bg-neutral-900/50">
      <tr>
        <th class="p-2 text-left">Player</th>
        <th class="p-2 text-right">Events</th>
        <th class="p-2 text-right">Retention %</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as r}
        <tr class="border-t border-neutral-200 dark:border-neutral-800">
          <td class="p-2">{r.player}</td>
          <td class="p-2 text-right">{r.tot}</td>
          <td class="p-2 text-right">{r.tot ? r.pct + '%' : '-'}</td>
        </tr>
      {/each}
      {#if rows.length === 0}
        <tr><td colspan="3" class="p-3 text-neutral-500">No data.</td></tr>
      {/if}
    </tbody>
  </table>
</div>
