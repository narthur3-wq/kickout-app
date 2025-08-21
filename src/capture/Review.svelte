<script>
  import { onMount } from "svelte";
  import { points } from "../stores.js"; // same store used by Live/Coach

  let all = [];
  let filtered = [];

  // simple filter controls (expand later if you want)
  let side = "both"; // "us" | "opp" | "both"

  $: filtered = all.filter((p) => {
    if (side === "both") return true;
    return p.side === side;
  });

  // guard: render empty state on first load with no data
  let mounted = false;
  onMount(() => {
    mounted = true;
    const unsub = points.subscribe((arr) => {
      all = Array.isArray(arr) ? arr : [];
    });
    return () => unsub && unsub();
  });

  // --- helpers (safe if filtered = []) ---
  function fmtPct(num, den) {
    if (!den) return "0%";
    return `${Math.round((num / den) * 100)}%`;
  }

  function aggByOpponent(list) {
    const m = new Map();
    for (const p of list) {
      const k = p.opponent || "—";
      const cur = m.get(k) ?? { total: 0, wins: 0, longs: 0 };
      cur.total += 1;
      if (p.win) cur.wins += 1;
      if (p.depthBand === "Long" || p.depthBand === "Very Long") cur.longs += 1;
      m.set(k, cur);
    }
    return [...m.entries()].map(([op, v]) => ({
      opponent: op,
      total: v.total,
      wins: v.wins,
      winPct: fmtPct(v.wins, v.total),
      longPct: fmtPct(v.longs, v.total),
    }));
  }

  function topTargets(list, sideKey = "us") {
    // “receiver” is jersey (number) we targeted; adjust if your field name differs
    const m = new Map();
    for (const p of list.filter((x) => x.side === sideKey)) {
      const k = p.receiver || "—";
      const cur = m.get(k) ?? { total: 0, wins: 0 };
      cur.total += 1;
      if (p.win) cur.wins += 1;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([player, v]) => ({
        player,
        total: v.total,
        wins: v.wins,
        winPct: fmtPct(v.wins, v.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  // --- CSV export (client-side only) ---
  function exportCSV() {
    const rows = [
      [
        "date",
        "side",
        "receiver",
        "contest",
        "win",
        "x_m",
        "y_m",
        "zone",
        "depthBand",
        "opponent",
      ],
      ...filtered.map((p) => [
        p.date || "",
        p.side || "",
        p.receiver ?? "",
        p.contest_type || "",
        p.win ? "1" : "0",
        p.x_m?.toFixed(2) ?? "",
        p.y_m?.toFixed(2) ?? "",
        p.zoneCode || "",
        p.depthBand || "",
        p.opponent || "",
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kickouts.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // --- PNG export via dynamic import (no SSR surprises) ---
  let captureEl; // wrapper to screenshot
  async function exportPNG() {
    try {
      const { default: html2canvas } = await import("html2canvas"); // loads only on click
      const canvas = await html2canvas(captureEl, { backgroundColor: "#ffffff" });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "dashboards.png";
      a.click();
    } catch (e) {
      alert("PNG export failed. (html2canvas not available)");
      console.error(e);
    }
  }
</script>

<style>
  .wrap {
    display: grid;
    gap: 1rem;
  }
  .toolbar {
    display: flex;
    gap: .5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .card {
    background: #fff;
    border: 1px solid rgba(0,0,0,.08);
    border-radius: .6rem;
    padding: 1rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: .95rem;
  }
  th, td {
    padding: .5rem .6rem;
    border-bottom: 1px solid rgba(0,0,0,.08);
    text-align: left;
  }
  th {
    background: rgba(0,0,0,.03);
    font-weight: 700;
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: #666;
  }
  .kpis { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 1rem; }
  @media (max-width: 720px) { .kpis { grid-template-columns: 1fr; } }
  .pill {
    padding: .3rem .6rem; border-radius: 999px; font-weight: 600;
    background: #f1f5f9; border: 1px solid rgba(0,0,0,.06)
  }
  .btn {
    padding: .5rem .9rem;
    border-radius: .5rem;
    border: 1px solid rgba(0,0,0,.12);
    background: #fff;
    cursor: pointer;
  }
  .btn.primary { background:#0a7; color:#fff; border-color:#0a7; }
</style>

<div class="wrap">
  <div class="toolbar">
    <div class="pill">Review</div>
    <label>Side:
      <select bind:value={side}>
        <option value="both">Both</option>
        <option value="us">Us</option>
        <option value="opp">Opposition</option>
      </select>
    </label>
    <button class="btn" on:click={exportCSV}>Export CSV</button>
    <button class="btn" on:click={exportPNG}>Download PNG</button>
  </div>

  <!-- Empty state (renders on Vercel even with no data) -->
  {#if mounted && filtered.length === 0}
    <div class="card empty">
      <div><strong>No events yet.</strong></div>
      <div>Add some points on the Live tab and return here to analyse them.</div>
    </div>
  {:else}
    <!-- everything we want to capture as a PNG goes inside captureEl -->
    <div bind:this={captureEl} class="wrap">
      <div class="kpis">
        <div class="card">
          <h3>Our kickouts — win rate</h3>
          {#if filtered.length}
            {#await Promise.resolve() then _}
              {#const ours = filtered.filter(p => p.side === 'us')}
              <p>
                <strong>{fmtPct(ours.filter(p=>p.win).length, ours.length)}</strong>
                &nbsp;{ours.filter(p=>p.win).length} W / {ours.length - ours.filter(p=>p.win).length} L
                &nbsp;({ours.length} total)
              </p>
            {/await}
          {/if}
        </div>

        <div class="card">
          <h3>Opposition kickouts — win rate</h3>
          {#if filtered.length}
            {#await Promise.resolve() then _}
              {#const opp = filtered.filter(p => p.side === 'opp')}
              <p>
                <strong>{fmtPct(opp.filter(p=>p.win).length, opp.length)}</strong>
                &nbsp;{opp.filter(p=>p.win).length} W / {opp.length - opp.filter(p=>p.win).length} L
                &nbsp;({opp.length} total)
              </p>
            {/await}
          {/if}
        </div>
      </div>

      <div class="card">
        <h3>By opponent</h3>
        {#if filtered.length}
          {#await Promise.resolve() then _}
            {#const rows = aggByOpponent(filtered)}
            <table>
              <thead>
                <tr>
                  <th>Opponent</th><th>Total</th><th>Wins</th><th>Win %</th><th>Long % of total</th>
                </tr>
              </thead>
              <tbody>
                {#each rows as r}
                  <tr>
                    <td>{r.opponent}</td>
                    <td>{r.total}</td>
                    <td>{r.wins}</td>
                    <td>{r.winPct}</td>
                    <td>{r.longPct}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/await}
        {/if}
      </div>

      <div class="kpis">
        <div class="card">
          <h3>Top 10 — our targets</h3>
          {#if filtered.length}
            {#await Promise.resolve() then _}
              {#const topUs = topTargets(filtered, 'us')}
              <table>
                <thead><tr><th>Player</th><th>Total</th><th>Wins</th><th>Win %</th></tr></thead>
                <tbody>
                  {#each topUs as r}
                    <tr>
                      <td>{r.player}</td><td>{r.total}</td><td>{r.wins}</td><td>{r.winPct}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/await}
          {/if}
        </div>

        <div class="card">
          <h3>Top 10 — opposition receivers</h3>
          {#if filtered.length}
            {#await Promise.resolve() then _}
              {#const topOpp = topTargets(filtered, 'opp')}
              <table>
                <thead><tr><th>Player</th><th>Total</th><th>Wins</th><th>Win %</th></tr></thead>
                <tbody>
                  {#each topOpp as r}
                    <tr>
                      <td>{r.player}</td><td>{r.total}</td><td>{r.wins}</td><td>{r.winPct}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/await}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
