<script>
  import { onMount } from "svelte";
  import { points } from "../stores.js"; // same store Live/Coach use

  let all = [];
  let filtered = [];

  // simple filter
  let side = "both"; // "us" | "opp" | "both"

  // recompute filtered on any change
  $: filtered = (all ?? []).filter((p) => {
    if (side === "both") return true;
    return p?.side === side;
  });

  // subscribe safely on client
  onMount(() => {
    const unsub = points?.subscribe?.((arr) => {
      all = Array.isArray(arr) ? arr : [];
    });
    return () => unsub && unsub();
  });

  // helpers
  const pct = (n, d) => (!d ? "0%" : `${Math.round((n / d) * 100)}%`);

  function byOpponent(list) {
    const m = new Map();
    for (const p of list) {
      const k = p?.opponent || "—";
      const cur = m.get(k) ?? { total: 0, wins: 0, longs: 0 };
      cur.total += 1;
      if (p?.win) cur.wins += 1;
      if (p?.depthBand === "Long" || p?.depthBand === "Very Long") cur.longs += 1;
      m.set(k, cur);
    }
    return [...m.entries()].map(([op, v]) => ({
      opponent: op,
      total: v.total,
      wins: v.wins,
      winPct: pct(v.wins, v.total),
      longPct: pct(v.longs, v.total),
    }));
  }

  function topTargets(list, sideKey) {
    const m = new Map();
    for (const p of list) {
      if (p?.side !== sideKey) continue;
      const k = p?.receiver ?? "—";
      const cur = m.get(k) ?? { total: 0, wins: 0 };
      cur.total += 1;
      if (p?.win) cur.wins += 1;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([player, v]) => ({
        player,
        total: v.total,
        wins: v.wins,
        winPct: pct(v.wins, v.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  // CSV (client only)
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
        p?.date ?? "",
        p?.side ?? "",
        p?.receiver ?? "",
        p?.contest_type ?? "",
        p?.win ? "1" : "0",
        p?.x_m != null ? p.x_m.toFixed(2) : "",
        p?.y_m != null ? p.y_m.toFixed(2) : "",
        p?.zoneCode ?? "",
        p?.depthBand ?? "",
        p?.opponent ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kickouts.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // PNG (lazy loaded)
  let cap;
  async function exportPNG() {
    try {
      const mod = await import("html2canvas"); // loads only when clicked
      const canvas = await mod.default(cap, { backgroundColor: "#ffffff" });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "review.png";
      a.click();
    } catch (e) {
      console.warn("PNG export failed or html2canvas missing:", e);
      alert("PNG export not available in this build.");
    }
  }
</script>

<style>
  .wrap { display: grid; gap: 1rem; }
  .toolbar { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
  .card {
    background: #fff; border: 1px solid rgba(0,0,0,.08);
    border-radius: .6rem; padding: 1rem;
  }
  .empty {
    background: #fff; border: 1px dashed rgba(0,0,0,.2);
    color:#444; text-align: center; padding: 2rem; border-radius: .6rem;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: .5rem .6rem; border-bottom: 1px solid rgba(0,0,0,.08); text-align: left; }
  th { background: rgba(0,0,0,.03); }
  .kpis { display:grid; grid-template-columns: repeat(2, minmax(260px,1fr)); gap:1rem; }
  @media (max-width: 760px){ .kpis{ grid-template-columns: 1fr; } }
  .btn { padding:.5rem .9rem; border-radius:.5rem; border:1px solid rgba(0,0,0,.12); background:#fff; cursor:pointer; }
</style>

<div class="wrap">
  <div class="toolbar">
    <strong>Review</strong>
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

  <!-- Always render something immediately -->
  {#if filtered.length === 0}
    <div class="empty">
      <div><strong>No events to review yet.</strong></div>
      <div>Add some points on the Live tab, then return here.</div>
    </div>
  {:else}
    <div bind:this={cap} class="wrap">
      <div class="kpis">
        <div class="card">
          <h3>Our kickouts — win rate</h3>
          {#const ours = filtered.filter(p=>p?.side==='us')}
          <p><strong>{pct(ours.filter(p=>p?.win).length, ours.length)}</strong>
             &nbsp;{ours.filter(p=>p?.win).length} W / {ours.length - ours.filter(p=>p?.win).length} L
             &nbsp;({ours.length} total)</p>
        </div>

        <div class="card">
          <h3>Opposition kickouts — win rate</h3>
          {#const opp = filtered.filter(p=>p?.side==='opp')}
          <p><strong>{pct(opp.filter(p=>p?.win).length, opp.length)}</strong>
             &nbsp;{opp.filter(p=>p?.win).length} W / {opp.length - opp.filter(p=>p?.win).length} L
             &nbsp;({opp.length} total)</p>
        </div>
      </div>

      <div class="card">
        <h3>By opponent</h3>
        {#const rows = byOpponent(filtered)}
        <table>
          <thead><tr>
            <th>Opponent</th><th>Total</th><th>Wins</th><th>Win %</th><th>Long % of total</th>
          </tr></thead>
          <tbody>
            {#each rows as r}
              <tr>
                <td>{r.opponent}</td><td>{r.total}</td><td>{r.wins}</td><td>{r.winPct}</td><td>{r.longPct}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="kpis">
        <div class="card">
          <h3>Top 10 — our targets</h3>
          {#const t1 = topTargets(filtered, 'us')}
          <table>
            <thead><tr><th>Player</th><th>Total</th><th>Wins</th><th>Win %</th></tr></thead>
            <tbody>
              {#each t1 as r}
                <tr><td>{r.player}</td><td>{r.total}</td><td>{r.wins}</td><td>{r.winPct}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>Top 10 — opposition receivers</h3>
          {#const t2 = topTargets(filtered, 'opp')}
          <table>
            <thead><tr><th>Player</th><th>Total</th><th>Wins</th><th>Win %</th></tr></thead>
            <tbody>
              {#each t2 as r}
                <tr><td>{r.player}</td><td>{r.total}</td><td>{r.wins}</td><td>{r.winPct}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>
