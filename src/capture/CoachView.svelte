<script>
  import { events } from '../stores.js';

  const fmt = (n) => new Intl.NumberFormat().format(n);
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  // Reactive slices of data
  $: all = $events;
  $: ourList = $events.filter((e) => e.side === 'us');
  $: oppList = $events.filter((e) => e.side === 'opp');

  function agg(list) {
    const total = list.length;
    const wins = list.filter((e) => e.win).length;
    const losses = total - wins;
    const byZone = {};
    for (const e of list) {
      const z = e.zone || '—';
      byZone[z] ??= { att: 0, win: 0 };
      byZone[z].att++;
      if (e.win) byZone[z].win++;
    }
    return { total, wins, losses, byZone };
  }

  // Computed aggregates
  $: our = agg(ourList);
  $: opp = agg(oppList);
  $: overall = agg(all);
  $: headline = `Our kickouts at ${pct(our.wins, our.total)}% win (${(pct(our.wins, our.total) - pct(opp.wins, opp.total)) >= 0 ? '+' : ''}${pct(our.wins, our.total) - pct(opp.wins, opp.total)}% vs opp)`;
  $: zones = Object.keys(overall.byZone).sort();
</script>

<section class="grid gap-4">
  <!-- Top KPIs -->
  <div class="grid md:grid-cols-3 gap-3">
    <div class="card p-4">
      <h3 class="text-sm text-gray-600 mb-1">Our kickouts</h3>
      <div class="text-2xl font-semibold">{pct(our.wins, our.total)}%</div>
      <div class="text-sm text-gray-600">{fmt(our.wins)} / {fmt(our.total)} won</div>
    </div>
    <div class="card p-4">
      <h3 class="text-sm text-gray-600 mb-1">Opposition kickouts</h3>
      <div class="text-2xl font-semibold">{pct(opp.wins, opp.total)}%</div>
      <div class="text-sm text-gray-600">{fmt(opp.wins)} / {fmt(opp.total)} won</div>
    </div>
    <div class="card p-4">
      <h3 class="text-sm text-gray-600 mb-1">Overall</h3>
      <div class="text-2xl font-semibold">{pct(overall.wins, overall.total)}%</div>
      <div class="text-sm text-gray-600">{fmt(overall.wins)} / {fmt(overall.total)} won</div>
    </div>
  </div>

  <!-- Headline -->
  <div class="card p-4">
    <div class="text-base font-semibold">{headline}</div>
  </div>

  <!-- Zone grid -->
  <div class="card p-4">
    <div class="flex items-center gap-3 mb-2">
      <div class="badge badge-win"><span>✓</span> Win</div>
      <div class="badge badge-loss"><span>✕</span> Loss</div>
      <div class="text-xs text-gray-600">Grey = no attempts</div>
    </div>

    {#if zones.length === 0}
      <div class="text-sm text-gray-600">No attempts yet.</div>
    {:else}
      <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {#each zones as z}
          {#key z}
            {@const m = overall.byZone[z]}
            {@const winP = m.att ? (m.win / m.att) * 100 : 0}
            {@const lossP = m.att ? ((m.att - m.win) / m.att) * 100 : 0}
            <div class="border border-gray-200 rounded-lg p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold">{z}</div>
                <div class="text-sm text-gray-600">{fmt(m.att)} att</div>
              </div>
              <div class="h-2 w-full bg-gray-100 rounded overflow-hidden">
                <div class="h-full" style="width:{winP}%; background:#16A34A"></div>
                <div class="h-full -mt-2" style="width:{lossP}%; background:#EF4444"></div>
              </div>
              <div class="mt-1 text-xs text-gray-600">{Math.round(winP)}% win · {Math.round(lossP)}% loss</div>
            </div>
          {/key}
        {/each}
      </div>
    {/if}
  </div>
</section>
