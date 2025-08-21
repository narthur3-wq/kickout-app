<script lang="ts">
  /**
   * Review.svelte — self-contained, production-safe.
   * - No {@const ...} in markup (works on Vercel).
   * - Lazy loads html2canvas only when "Download PNG" is clicked.
   * - Reads data from localStorage('kickouts_v1'). Safe if empty.
   * - Simple filters + KPIs + breakdowns (opponent, receiver, zones).
   */

  // ---- Configuration --------------------------------------------------------
  const STORAGE_KEY = 'kickouts_v1'; // change if your Live tab uses a different key

  // ---- Types (adjust to your schema if required) ----------------------------
  type Side = 'us' | 'opp';
  type Contest = 'clean' | 'break' | 'foul' | 'sideline';
  interface Kickout {
    // geometry
    x: number;        // 0..90 field metres (left->right)
    y: number;        // 0..145 field metres (top->bottom)
    // tags
    side: Side;       // 'us' | 'opp'
    ct: Contest;      // 'clean' | 'break' | 'foul' | 'sideline'
    win: boolean;     // result (we won the ball?)
    // optional metadata
    receiver?: number | string; // jersey number or name
    opponent?: string;          // opponent team
    zone?: string;              // your zone code if present
    ts?: number;                // timestamp
  }

  // ---- Utilities ------------------------------------------------------------
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + '%' : '0%');
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const parseSafe = <T,>(txt: string | null, fallback: T): T => {
    if (!txt) return fallback;
    try {
      const v = JSON.parse(txt);
      return Array.isArray(v) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  };

  function loadAll(): Kickout[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = parseSafe<Kickout[]>(raw, []);
    // sanitise coordinates (don’t trust persisted values blindly)
    for (const k of arr) {
      k.x = clamp(Number(k.x ?? 0), 0, 90);
      k.y = clamp(Number(k.y ?? 0), 0, 145);
    }
    return arr;
  }

  // simple group-by returning array of [key, rows]
  function groupBy<T, K extends string | number | undefined>(
    rows: T[],
    keySel: (r: T) => K
  ): Array<[K extends undefined ? '—' : K, T[]]> {
    const m = new Map<any, T[]>();
    for (const r of rows) {
      const k = keySel(r) ?? '—';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return Array.from(m.entries()) as any;
  }

  // sort helpers
  const byDesc = <T,>(sel: (x: T) => number) => (a: T, b: T) => sel(b) - sel(a);

  // ---- State ----------------------------------------------------------------
  let all: Kickout[] = loadAll();

  // re-load when another tab saves
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      all = loadAll();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  // filters
  let fSide: 'all' | Side = 'all';
  let fContest: 'all' | Contest = 'all';

  // derived: filtered rows
  $: filtered = all.filter((k) => {
    if (fSide !== 'all' && k.side !== fSide) return false;
    if (fContest !== 'all' && k.ct !== fContest) return false;
    return true;
  });

  // derived: ours / opp
  $: ours = filtered.filter((k) => k.side === 'us');
  $: opp  = filtered.filter((k) => k.side === 'opp');

  // KPI counts
  $: oursWins   = ours.filter((k) => k.win).length;
  $: oursTotal  = ours.length;
  $: oursLosses = Math.max(oursTotal - oursWins, 0);

  $: oppWins   = opp.filter((k) => k.win).length;
  $: oppTotal  = opp.length;
  $: oppLosses = Math.max(oppTotal - oppWins, 0);

  // breakdowns
  $: byOpponent = groupBy(filtered, (k) => k.opponent).sort(
    byDesc(([_, rows]) => rows.length)
  );
  $: byReceiver = groupBy(filtered, (k) => k.receiver as any).sort(
    byDesc(([_, rows]) => rows.length)
  );
  $: byZone     = groupBy(filtered, (k) => k.zone).sort(
    byDesc(([_, rows]) => rows.length)
  );

  // ---- Exporters ------------------------------------------------------------
  function toCsv(rows: Kickout[]): string {
    const heads = [
      'ts', 'side', 'contest', 'win', 'x', 'y', 'receiver', 'opponent', 'zone'
    ];
    const esc = (v: any) =>
      v == null ? '' : String(v).includes(',') || String(v).includes('"')
        ? `"${String(v).replace(/"/g, '""')}"`
        : String(v);
    const body = rows
      .map((r) =>
        [
          r.ts ?? '',
          r.side ?? '',
          r.ct ?? '',
          r.win ? 1 : 0,
          r.x ?? '',
          r.y ?? '',
          r.receiver ?? '',
          r.opponent ?? '',
          r.zone ?? ''
        ]
          .map(esc)
          .join(',')
      )
      .join('\n');
    return heads.join(',') + '\n' + body + '\n';
  }

  function downloadCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kickouts.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function downloadPng() {
    // Lazy import — page still works if the lib is missing
    let html2canvas: any;
    try {
      ({ default: html2canvas } = await import('html2canvas'));
    } catch {
      alert(
        'html2canvas is not installed in production.\n\nAdd "html2canvas": "^1.4.1" to dependencies to enable PNG export.'
      );
      return;
    }
    const node = document.getElementById('review-root');
    if (!node) return;
    const canvas = await html2canvas(node, {
      backgroundColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--page-bg')
        .trim() || '#ffffff',
      scale: window.devicePixelRatio || 1
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'kickouts.png';
    a.click();
  }

  // ---- clean-up -------------------------------------------------------------
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  });
</script>

<!-- =========================  VIEW  ====================================== -->
<div class="page" id="review-root">
  <header class="toolbar">
    <div class="filters">
      <div class="group">
        <label>Side</label>
        <div class="seg">
          <button class:selected={fSide === 'all'} on:click={() => (fSide = 'all')}>All</button>
          <button class:selected={fSide === 'us'} on:click={() => (fSide = 'us')}>Us</button>
          <button class:selected={fSide === 'opp'} on:click={() => (fSide = 'opp')}>Opposition</button>
        </div>
      </div>

      <div class="group">
        <label>Contest</label>
        <div class="seg">
          <button class:selected={fContest === 'all'} on:click={() => (fContest = 'all')}>All</button>
          <button class:selected={fContest === 'clean'} on:click={() => (fContest = 'clean')}>Clean</button>
          <button class:selected={fContest === 'break'} on:click={() => (fContest = 'break')}>Break</button>
          <button class:selected={fContest === 'foul'} on:click={() => (fContest = 'foul')}>Foul</button>
          <button class:selected={fContest === 'sideline'} on:click={() => (fContest = 'sideline')}>Sideline</button>
        </div>
      </div>
    </div>

    <div class="actions">
      <button on:click={downloadCsv} class="ghost">Export CSV</button>
      <button on:click={downloadPng} class="primary">Download PNG</button>
    </div>
  </header>

  <section class="kpis">
    <div class="card">
      <h3>Our kickouts — win rate</h3>
      <p class="big">{pct(oursWins, oursTotal)}</p>
      <p>{oursWins} W / {oursLosses} L <span class="muted">({oursTotal} total)</span></p>
    </div>

    <div class="card">
      <h3>Opposition kickouts — win rate</h3>
      <p class="big">{pct(oppWins, oppTotal)}</p>
      <p>{oppWins} W / {oppLosses} L <span class="muted">({oppTotal} total)</span></p>
    </div>
  </section>

  <section class="grid">
    <div class="card span-2">
      <div class="title">By opponent</div>
      {#if byOpponent.length === 0}
        <p class="empty">No data to show.</p>
      {:else}
        <table class="kpi">
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Total</th>
              <th>Win %</th>
              <th>Wins</th>
              <th>Losses</th>
            </tr>
          </thead>
          <tbody>
            {#each byOpponent as [name, rows]}
              {#key name}
                <tr>
                  <td>{name}</td>
                  <td>{rows.length}</td>
                  <td>{pct(rows.filter(r => r.win).length, rows.length)}</td>
                  <td>{rows.filter(r => r.win).length}</td>
                  <td>{rows.length - rows.filter(r => r.win).length}</td>
                </tr>
              {/key}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="card span-2">
      <div class="title">Top receivers</div>
      {#if byReceiver.length === 0}
        <p class="empty">No data to show.</p>
      {:else}
        <table class="kpi">
          <thead>
            <tr>
              <th>Player</th>
              <th>Total</th>
              <th>Win %</th>
              <th>Wins</th>
              <th>Losses</th>
            </tr>
          </thead>
          <tbody>
            {#each byReceiver.slice(0, 15) as [name, rows]}
              {#key name}
                <tr>
                  <td>{name}</td>
                  <td>{rows.length}</td>
                  <td>{pct(rows.filter(r => r.win).length, rows.length)}</td>
                  <td>{rows.filter(r => r.win).length}</td>
                  <td>{rows.length - rows.filter(r => r.win).length}</td>
                </tr>
              {/key}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="card span-2">
      <div class="title">Zones</div>
      {#if byZone.length === 0}
        <p class="empty">No data to show.</p>
      {:else}
        <table class="kpi">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Total</th>
              <th>Win %</th>
              <th>Wins</th>
              <th>Losses</th>
            </tr>
          </thead>
          <tbody>
            {#each byZone as [z, rows]}
              {#key z}
                <tr>
                  <td>{z}</td>
                  <td>{rows.length}</td>
                  <td>{pct(rows.filter(r => r.win).length, rows.length)}</td>
                  <td>{rows.filter(r => r.win).length}</td>
                  <td>{rows.length - rows.filter(r => r.win).length}</td>
                </tr>
              {/key}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </section>

  {#if filtered.length === 0}
    <div class="empty-state">
      <p>No kickouts found. Capture some on the Live tab, then return here.</p>
    </div>
  {/if}
</div>

<style>
  :root {
    --page-bg: #ffffff;
    --card-bg: #f7f9fb;
    --muted: #6b7280;
    --text: #0f172a;
    --border: #e5e7eb;
    --brand: #0ea5e9;
    --brand-ink: #0b67a3;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page-bg: #0b1520;
      --card-bg: #0f1b2a;
      --muted: #9aa5b1;
      --text: #f3f4f6;
      --border: #243143;
      --brand: #38bdf8;
      --brand-ink: #1e90d0;
    }
  }

  .page {
    background: var(--page-bg);
    color: var(--text);
    padding: 1rem;
    min-height: 100%;
  }

  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: end;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .filters {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .group { display: grid; gap: .25rem; }
  .group label { font-size: .85rem; color: var(--muted); }

  .seg { display: inline-flex; padding: .25rem; background: var(--card-bg); border-radius: .5rem; gap: .25rem; }
  .seg button {
    border: 1px solid var(--border);
    background: transparent;
    padding: .35rem .6rem;
    border-radius: .4rem;
    cursor: pointer;
    color: var(--text);
  }
  .seg button.selected {
    background: var(--brand);
    color: white;
    border-color: transparent;
  }

  .actions { display: flex; gap: .5rem; }
  .actions .ghost, .actions .primary {
    border-radius: .5rem;
    padding: .5rem .75rem;
    border: 1px solid var(--border);
    background: var(--card-bg);
    cursor: pointer;
    color: var(--text);
  }
  .actions .primary {
    background: var(--brand);
    border-color: transparent;
    color: white;
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(2, minmax(220px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(320px, 1fr));
    gap: 1rem;
  }

  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: .75rem;
    padding: 1rem;
  }
  .card .title { font-weight: 600; margin-bottom: .5rem; }
  .card .big  { font-size: 2rem; font-weight: 700; margin: .25rem 0; }
  .muted { color: var(--muted); }

  .span-2 { grid-column: span 2; }

  table.kpi {
    width: 100%;
    border-collapse: collapse;
    font-size: .95rem;
  }
  table.kpi th, table.kpi td {
    padding: .5rem .6rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  table.kpi thead th { color: var(--muted); font-weight: 600; }

  .empty, .empty-state {
    color: var(--muted);
    padding: .5rem 0;
  }
  .empty-state {
    text-align: center;
    padding: 1.5rem 0;
  }
</style>
