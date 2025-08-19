<script>
  // Input: filtered events to respect current filters
  export let events = /** @type {Array<any>} */ ([]);

  const RETAINED = new Set(['Won']);
  const ZSIDES = ['Left','Centre','Right'];

  const byPlayer = $derived.by(() => {
    /** @type {Record<string, any>} */
    const m = {};
    for (const e of events) {
      const p = (e.target_player||'').trim();
      if (!p) continue;
      if (!m[p]) m[p] = { attempts:0, won:0, breakTot:0, breakWon:0, depthSum:0, sides:{Left:0,Centre:0,Right:0} };
      m[p].attempts++;
      if (RETAINED.has(e.outcome)) m[p].won++;
      if (e.contest_type==='break') { m[p].breakTot++; if (e.break_outcome==='won') m[p].breakWon++; }
      m[p].depthSum += +e.depth_from_own_goal_m || 0;
      m[p].sides[e.side_band] = (m[p].sides[e.side_band]||0)+1;
    }
    // compute display rows
    return Object.entries(m).map(([name, v]) => {
      const wonPct   = v.attempts ? (100*v.won/v.attempts) : 0;
      const breakPct = v.breakTot ? (100*v.breakWon/v.breakTot) : 0;
      const avgDepth = v.attempts ? (v.depthSum/v.attempts) : 0;
      const sideTot = Math.max(1, v.sides.Left+v.sides.Centre+v.sides.Right);
      const sL = Math.round(100*v.sides.Left/sideTot);
      const sC = Math.round(100*v.sides.Centre/sideTot);
      const sR = Math.round(100*v.sides.Right/sideTot);
      return { name, attempts:v.attempts, wonPct, breakPct, avgDepth, sL, sC, sR };
    }).sort((a,b)=>b.attempts - a.attempts);
  });
</script>

<div class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
  <div class="max-h-[360px] sm:max-h-[480px] overflow-auto">
    <table class="w-full border-collapse text-sm">
      <thead class="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
        <tr>
          <th class="p-2 text-left">Player</th>
          <th class="p-2">Attempts</th>
          <th class="p-2">Won %</th>
          <th class="p-2">Break Won %</th>
          <th class="p-2">Avg Depth (m)</th>
          <th class="p-2">Side L/C/R</th>
        </tr>
      </thead>
      <tbody>
        {#each byPlayer as r}
          <tr class="border-t border-neutral-200 dark:border-neutral-800">
            <td class="p-2 text-left">{r.name}</td>
            <td class="p-2">{r.attempts}</td>
            <td class="p-2">{r.attempts?Math.round(r.wonPct):'-'}%</td>
            <td class="p-2">{r.breakPct?Math.round(r.breakPct):'-'}%</td>
            <td class="p-2">{r.avgDepth.toFixed(1)}</td>
            <td class="p-2">
              <div class="h-2 w-full rounded bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div class="h-full bg-emerald-500" style={`width:${r.sL}%`}></div>
                <div class="h-full bg-sky-500" style={`width:${r.sC}%`}></div>
                <div class="h-full bg-amber-500" style={`width:${r.sR}%`}></div>
              </div>
              <div class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">{r.sL}% / {r.sC}% / {r.sR}%</div>
            </td>
          </tr>
        {/each}
        {#if byPlayer.length===0}
          <tr><td class="p-3 text-neutral-500 dark:text-neutral-400" colspan="6">No player data in current filter.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
