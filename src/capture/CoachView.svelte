<script>
  import { events } from '../stores.js';
  import { derived } from 'svelte/store';

  const fmt = (n)=> new Intl.NumberFormat().format(n);
  const pct = (n,d)=> d? Math.round((n/d)*100) : 0;

  // Derived splits
  const our = derived(events, $e => $e.filter(ev=>ev.side==='us'));
  const opp = derived(events, $e => $e.filter(ev=>ev.side==='opp'));
  const all = derived(events, $e => $e);

  const agg = (list)=> {
    const total = list.length;
    const wins = list.filter(e=>e.win).length;
    const losses = total - wins;
    const byZone = new Map();
    for (const e of list) {
      const z = e.zone || '—';
      const m = byZone.get(z) || { att:0, win:0 };
      m.att++; if (e.win) m.win++;
      byZone.set(z,m);
    }
    return { total, wins, losses, byZone };
  };
</script>

<section class="grid gap-4">
  <!-- Top KPIs -->
  <div class="grid md:grid-cols-3 gap-3">
    <div class="card p-4">
      <h3 class="text-sm text-gray-600 mb-1">Our kickouts</h3>
      {#await our}
        <div>—</div>
      {:then list}
        {@const a = agg(list)}
        <div class="text-2xl font-semibold">{pct(a.wins,a.total)}%</div>
        <div class="text-sm text-gray-600">{fmt(a.wins)} / {fmt(a.total)} won</div>
      {/await}
    </div>
    <div class="card p-4">
      <h3 class="text-sm text-gray-600 mb-1">Opposition kickouts</h3>
      {#await opp}
        <div>—</div>
      {:then list}
        {@const a = agg(list)}
        <div class="text-2xl font-semibold">{pct(a.wins,a.total)}%</div>
        <div class="text-sm text-gray-600">{fmt(a.wins)} / {fmt(a.total)} won</div>
      {/await}
    </div>
    <div class="card p-4">
      <h3 class="text-sm text-gray-600 mb-1">Overall</h3>
      {#await all}
        <div>—</div>
      {:then list}
        {@const a = agg(list)}
        <div class="text-2xl font-semibold">{pct(a.wins,a.total)}%</div>
        <div class="text-sm text-gray-600">{fmt(a.wins)} / {fmt(a.total)} won</div>
      {/await}
    </div>
  </div>

  <!-- Headline -->
  {#await Promise.all([our,opp])}
    <div class="card p-4">—</div>
  {:then res}
    {@const [ourList, oppList] = res}
    {@const a = agg(ourList)}
    {@const b = agg(oppList)}
    {@const headline = `Our kickouts at ${pct(a.wins,a.total)}% win (${(pct(a.wins,a.total)-pct(b.wins,b.total))>=0?'+':''}${pct(a.wins,a.total)-pct(b.wins,b.total)}% vs opp)`}
    <div class="card p-4">
      <div class="text-base font-semibold">{headline}</div>
    </div>
  {/await}

  <!-- Zone grid -->
  <div class="card p-4">
    <div class="flex items-center gap-3 mb-2">
      <div class="badge badge-win"><span>✓</span> Win</div>
      <div class="badge badge-loss"><span>✕</span> Loss</div>
      <div class="text-xs text-gray-600">Grey = no attempts</div>
    </div>

    {#await all}
      <div>—</div>
    {:then list}
      {@const zones = Array.from(new Set(list.map(e=>e.zone))).sort()}
      {#if zones.length===0}
        <div class="text-sm text-gray-600">No attempts yet.</div>
      {:else}
        <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {#each zones as z}
            {@const m = list.filter(e=>e.zone===z)}
            {@const a = agg(m)}
            {@const winP = a.total? (a.wins/a.total)*100 : 0}
            {@const lossP = a.total? ((a.total-a.wins)/a.total)*100 : 0}
            <div class="border border-gray-200 rounded-lg p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold">{z}</div>
                <div class="text-sm text-gray-600">{fmt(a.total)} att</div>
              </div>
              <div class="h-2 w-full bg-gray-100 rounded overflow-hidden">
                <div class="h-full" style="width:{winP}%; background:#16A34A"></div>
                <div class="h-full -mt-2" style="width:{lossP}%; background:#EF4444"></div>
              </div>
              <div class="mt-1 text-xs text-gray-600">{Math.round(winP)}% win · {Math.round(lossP)}% loss</div>
            </div>
          {/each}
        </div>
      {/if}
    {/then}
  </div>
</section>
