<script>
  import Pitch from './Pitch.svelte';
  import Heatmap from './Heatmap.svelte';
  import { createEventDispatcher } from 'svelte';

  // ── Read-only data props ─────────────────────────────────────────────────
  export let vizEvents    = [];
  export let totalEvents  = 0;
  export let overlays     = [];
  export let zoneTableRet = [];
  export let zoneTableBreak = [];
  export let overallBreak = { tot: 0, won: 0, pct: 0 };
  export let scoreStateStats = [];
  export let playerStats  = [];
  export let timelineEvents = [];
  export let uniqueMatches  = [];
  export let opponentChoices = [];
  export let playerChoices   = [];
  export let currentYear  = new Date().getFullYear();
  export let CONTESTS     = [];
  export let OUTCOMES     = [];
  export let retTrend     = () => null;

  // ── Bindable filter state ────────────────────────────────────────────────
  export let matchFilter  = 'ALL';
  export let oppFilter    = 'ALL';
  export let plyFilter    = 'ALL';
  export let periodFilter = 'ALL';
  export let ytdOnly      = false;
  export let useFilters   = true;
  export let fContest     = new Set();
  export let fOutcome     = new Set();
  export let overlayMode  = 'landing';
  export let flaggedOnly         = false;
  export let analyticsEventType  = 'ALL';
  export let directionFilter     = 'ALL';

  const dispatch = createEventDispatcher();

  // Local: pitch vs heatmap toggle
  let vizMode = 'dots'; // 'dots' | 'heat'

  // Local: heatmap density vs quality toggle
  let heatmapWeighted = false;

  $: heatPoints = heatmapWeighted
    ? overlays
    : overlays.map(o => ({ ...o, weight: 1 }));

  function cellColor(pct) {
    const t = Math.max(0, Math.min(1, pct / 100));
    return `hsl(${120 * t} 70% 45% / 0.25)`;
  }

  function outcomeColor(o) {
    switch ((o||'').toLowerCase()) {
      case 'score':
      case 'point':    return '#2563eb';
      case 'retained':
      case 'won':      return '#16a34a';
      case 'lost':     return '#dc2626';
      case 'goal':     return '#7c3aed';
      case 'wide':     return '#d97706';
      case 'blocked':  return '#b45309';
      case 'saved':    return '#6b7280';
      case 'out':      return '#7c3aed';
      case 'foul':     return '#db2777';
      default:         return '#6b7280';
    }
  }

  function toggleContest(val) {
    const s = new Set(fContest); s.has(val) ? s.delete(val) : s.add(val); fContest = s;
  }
  function toggleOutcome(val) {
    const s = new Set(fOutcome); s.has(val) ? s.delete(val) : s.add(val); fOutcome = s;
  }

  $: outcomeBreakdown = (() => {
    if (vizEvents.length === 0) return [];
    const map = {};
    for (const e of vizEvents) { const o = e.outcome || 'Unknown'; map[o] = (map[o] || 0) + 1; }
    return Object.entries(map)
      .map(([outcome, count]) => ({ outcome, count, pct: Math.round(100 * count / vizEvents.length) }))
      .sort((a, b) => b.count - a.count);
  })();

  $: isKickoutView = analyticsEventType === 'kickout' || analyticsEventType === 'ALL';

  const TYPE_LABELS = { 'kickout': 'Kickouts', 'shot': 'Shots', 'turnover': 'Turnovers', 'ALL': 'Analytics' };
  $: panelTitle = TYPE_LABELS[analyticsEventType] || 'Analytics';

  // Active filter tags for summary bar
  $: filterTags = (() => {
    const tags = [];
    if (periodFilter !== 'ALL') tags.push(periodFilter);
    if (directionFilter !== 'ALL') tags.push(directionFilter === 'ours' ? 'Ours' : 'Theirs');
    if (oppFilter !== 'ALL') {
      const m = opponentChoices.find(([k]) => k === oppFilter);
      tags.push('vs ' + (m ? m[1] : oppFilter));
    }
    if (matchFilter !== 'ALL') tags.push('1 match');
    if (plyFilter !== 'ALL') {
      const m = playerChoices.find(([k]) => k === plyFilter);
      tags.push(m ? '#' + m[1] : 'player');
    }
    if (flaggedOnly) tags.push('flagged');
    if (ytdOnly) tags.push(String(currentYear) + ' only');
    return tags;
  })();

  function resetFilters() {
    matchFilter = 'ALL'; oppFilter = 'ALL'; plyFilter = 'ALL'; periodFilter = 'ALL';
    ytdOnly = false; useFilters = true; flaggedOnly = false;
    directionFilter = 'ALL';
    fContest = new Set(CONTESTS); fOutcome = new Set(OUTCOMES);
  }
</script>

<section class="card">

  <!-- Panel header -->
  <div class="panel-header">
    <div class="panel-title">{panelTitle}</div>
    <span class="panel-count">{vizEvents.length} events</span>
    {#if isKickoutView}
      <button class="summary-btn" on:click={() => dispatch('showSummary')}>Summary</button>
    {/if}
  </div>

  <!-- Active filter summary bar -->
  {#if filterTags.length > 0}
    <div class="filter-summary">
      <span class="filter-summary-label">Filtered:</span>
      {#each filterTags as tag}
        <span class="filter-tag">{tag}</span>
      {/each}
      <button class="filter-clear" on:click={resetFilters}>Clear</button>
    </div>
  {/if}

  <!-- Filters -->
  <div class="filters">
    <!-- Direction + match selects row -->
    <div class="filter-pills-row">
      <div class="fpill-group">
        <span class="fpill-label">Direction</span>
        {#each [['ALL','Both'],['ours','Ours'],['theirs','Theirs']] as [val, lbl]}
          <button class="fpill {directionFilter === val ? 'fpill-on' : ''}" on:click={() => directionFilter = val}>{lbl}</button>
        {/each}
      </div>
    </div>
    <!-- Select row -->
    <div class="filter-selects-row">
      <div class="fselect-wrap">
        <span class="fselect-label">Match</span>
        <select bind:value={matchFilter}>
          <option value="ALL">All matches</option>
          {#each uniqueMatches as m}
            <option value={m.key}>{m.match_date} · {m.opponent || 'Unknown'} ({m.count})</option>
          {/each}
        </select>
      </div>
      <div class="fselect-wrap">
        <span class="fselect-label">Opponent</span>
        <select bind:value={oppFilter}>
          <option value="ALL">All</option>
          {#each opponentChoices as [key,lbl]}<option value={key}>{lbl}</option>{/each}
        </select>
      </div>
      <div class="fselect-wrap">
        <span class="fselect-label">Player</span>
        <select bind:value={plyFilter}>
          <option value="ALL">All</option>
          {#each playerChoices as [key,lbl]}<option value={key}>{lbl}</option>{/each}
        </select>
      </div>
    </div>
    <!-- Flags + reset -->
    <div class="filter-flags-row">
      <label class="flag-check"><input type="checkbox" bind:checked={useFilters}/> Contest filters</label>
      <label class="flag-check"><input type="checkbox" bind:checked={ytdOnly}/> YTD {currentYear}</label>
      <label class="flag-check"><input type="checkbox" bind:checked={flaggedOnly}/> Flagged</label>
      <button class="reset-btn" on:click={resetFilters}>Reset</button>
    </div>
    {#if useFilters && isKickoutView}
      <div class="filter-pills-row">
        <div class="fpill-group">
          <span class="fpill-label">Contest</span>
          {#each CONTESTS as c}
            <button class="fpill {fContest.has(c) ? 'fpill-on' : ''}" on:click={() => toggleContest(c)}>{c}</button>
          {/each}
        </div>
      </div>
      <div class="filter-pills-row">
        <div class="fpill-group">
          <span class="fpill-label">Outcome</span>
          {#each OUTCOMES as o}
            <button class="fpill {fOutcome.has(o) ? 'fpill-on' : ''}" on:click={() => toggleOutcome(o)}>{o}</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Empty state ── -->
  {#if vizEvents.length === 0}
    <div class="empty-analytics">
      <div class="empty-icon">📊</div>
      <div class="empty-title">No events match the current filters</div>
      <div class="empty-sub">Adjust or clear your filters to see data.</div>
      <button class="empty-reset" on:click={resetFilters}>Reset filters</button>
    </div>

  {:else}

    <!-- ── Viz section: Pitch (dots) or Heatmap ── -->
    <div class="section-card viz-section">
      <div class="viz-controls-bar">
        <div class="viz-seg">
          <button class="vseg {vizMode === 'dots' ? 'vseg-on' : ''}" on:click={() => vizMode = 'dots'}>Dots</button>
          <button class="vseg {vizMode === 'heat' ? 'vseg-on' : ''}" on:click={() => vizMode = 'heat'}>Heat</button>
        </div>
        <div class="viz-seg">
          <button class="vseg {overlayMode === 'landing' ? 'vseg-on' : ''}" on:click={() => overlayMode = 'landing'}>Landing</button>
          <button class="vseg {overlayMode === 'pickup' ? 'vseg-on' : ''}" on:click={() => overlayMode = 'pickup'}>Pickup</button>
        </div>
        {#if vizMode === 'heat'}
          <label class="fpill-check"><input type="checkbox" bind:checked={heatmapWeighted}/> Weighted</label>
        {/if}
      </div>
      <div class="pitch-viz-card">
        {#if vizMode === 'heat'}
          <Heatmap points={heatPoints} cols={140} radius={3} smooth={2} />
        {:else}
          <Pitch
            contestType="clean"
            landing={{x:NaN,y:NaN}}
            pickup={{x:NaN,y:NaN}}
            {overlays}
            showZoneLabels={true}
          />
        {/if}
      </div>
    </div>

    <!-- ── Outcomes ── -->
    {#if outcomeBreakdown.length > 0}
      <div class="section-card">
        <div class="section-hd">Outcomes</div>
        <div class="outcome-chips">
          {#each outcomeBreakdown as o}
            <div class="outcome-chip" style="border-color:{outcomeColor(o.outcome)};color:{outcomeColor(o.outcome)}">
              {o.outcome}: {o.count} ({o.pct}%)
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Timeline ── -->
    {#if timelineEvents.length > 0}
      <div class="section-card">
        <div class="section-hd">Timeline <span class="section-ct">{timelineEvents.length}</span></div>
        <div class="timeline-wrap">
          {#each timelineEvents as e, i}
            <div
              class="tl-dot {e.flag ? 'tl-flagged' : ''}"
              style="background:{outcomeColor(e.outcome)}"
              title="#{e.ko_sequence ?? i+1} · {e.outcome} · {e.contest_type} · {e.period} {e.clock}{e.target_player ? ' → #' + e.target_player : ''}{e.notes ? ' — ' + e.notes : ''}"
            >{e.ko_sequence ?? i+1}</div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Zone breakdown (kickout only) ── -->
    {#if isKickoutView}
      <div class="section-card">
        <div class="section-hd">Zone Breakdown</div>
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-title">Retention by Zone</div>
            <table class="kpi-table">
              <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
              <tbody>
                {#each zoneTableRet as row}
                  <tr>
                    <th>{row.D}</th>
                    {#each row.cells as c}
                      {@const trend = retTrend(c.pct, c.zk)}
                      <td
                        style="background:{c.tot >= 8 ? cellColor(c.pct) : 'transparent'}"
                        class="{c.tot > 0 && c.tot < 8 ? 'low-n' : ''}"
                        title="{c.ret}/{c.tot} retained"
                      >
                        {#if c.tot >= 8}
                          {Math.round(c.pct)}%{#if trend}<span class="trend-{trend}">{trend === 'up' ? ' ▲' : ' ▼'}</span>{/if}
                        {:else if c.tot > 0}
                          n={c.tot}
                        {:else}
                          —
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div class="kpi">
            <div class="kpi-title">
              Break Win-Rate — {overallBreak.tot ? Math.round(overallBreak.pct)+'%' : '—'}
              ({overallBreak.won}/{overallBreak.tot})
            </div>
            <table class="kpi-table">
              <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
              <tbody>
                {#each zoneTableBreak as row}
                  <tr>
                    <th>{row.D}</th>
                    {#each row.cells as c}
                      <td style="background:{cellColor(c.pct)}" title="{c.won}/{c.tot}">
                        {c.tot ? `${Math.round(c.pct)}%` : '—'}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
        <div class="zone-legend">S = 0–20m · M = 20–45m · L = 45–65m · V = 65m+ &nbsp;|&nbsp; L = Left · C = Centre · R = Right</div>
      </div>
    {/if}

    <!-- ── Target players (kickout only) ── -->
    {#if isKickoutView && playerStats.length > 0}
      <div class="section-card">
        <div class="section-hd">Target Players</div>
        <table class="kpi-table player-table">
          <thead><tr><th>Player</th><th>Targeted</th><th>Retention</th><th>Breaks</th><th>Break win%</th></tr></thead>
          <tbody>
            {#each playerStats as p}
              <tr>
                <td style="text-align:left">{p.label}</td>
                <td>{p.total}</td>
                <td style="background:{cellColor(p.retPct)}">{p.retPct}%</td>
                <td>{p.brTotal}</td>
                <td>{p.brWonPct != null ? p.brWonPct + '%' : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- ── Score state (kickout only) ── -->
    {#if isKickoutView && scoreStateStats.length > 0}
      <div class="section-card">
        <div class="section-hd">By Score State</div>
        <table class="kpi-table player-table">
          <thead><tr><th>Score state</th><th>KOs</th><th>Retention</th></tr></thead>
          <tbody>
            {#each scoreStateStats as s}
              <tr>
                <td style="text-align:left">{s.bucket}</td>
                <td>{s.tot}</td>
                <td style="background:{s.pct != null ? cellColor(s.pct) : 'transparent'}">
                  {s.pct != null ? s.pct + '%' : `(n=${s.tot})`}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="hint">Score state when each kickout was taken. Requires Score field to be filled. Shown when n≥3.</p>
      </div>
    {/if}

  {/if}<!-- /vizEvents.length > 0 -->

</section>

<style>
  .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8df; padding: 16px 18px; margin-bottom: 14px; }

  /* ── Panel header ── */
  .panel-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
  }
  .panel-title { font-size: 16px; font-weight: 800; color: #111827; letter-spacing: -0.02em; }
  .panel-count { font-size: 12px; font-weight: 500; color: #9ca3af; margin-right: auto; }
  .summary-btn {
    padding: 5px 12px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #374151; font-family: inherit; transition: all 0.12s;
  }
  .summary-btn:hover { background: #f9fafb; border-color: #d1d5db; }

  /* ── Active filter summary bar ── */
  .filter-summary {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
    padding: 7px 12px; margin-bottom: 10px; font-size: 12px;
  }
  .filter-summary-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #3b82f6; }
  .filter-tag {
    background: #1c3f8a; color: #fff;
    border-radius: 5px; padding: 2px 8px; font-size: 11px; font-weight: 700;
  }
  .filter-clear {
    margin-left: auto; padding: 3px 9px; border: 1px solid #93c5fd; border-radius: 5px;
    background: #fff; cursor: pointer; font-size: 11px; font-weight: 700;
    color: #1c3f8a; font-family: inherit; transition: all 0.12s;
  }
  .filter-clear:hover { background: #dbeafe; }

  /* ── Filters ── */
  .filters {
    display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;
    background: #f8faf8; border: 1px solid #e8eee6; border-radius: 10px; padding: 12px 14px;
  }

  /* Pill controls */
  .filter-pills-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .fpill-group { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .fpill-label { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9ca3af; margin-right: 2px; white-space: nowrap; }
  .fpill {
    padding: 5px 11px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #4b5563; font-family: inherit; transition: all 0.12s; white-space: nowrap;
  }
  .fpill:hover { border-color: #d1d5db; background: #f9fafb; }
  .fpill.fpill-on { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .fpill-check { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; }

  /* Select row */
  .filter-selects-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .fselect-wrap { display: flex; flex-direction: column; gap: 3px; }
  .fselect-label { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9ca3af; }
  .fselect-wrap select {
    padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    font-size: 13px; background: #fff; color: #111827; font-family: inherit;
    cursor: pointer; transition: border-color 0.12s;
  }
  .fselect-wrap select:focus { outline: none; border-color: #1c3f8a; box-shadow: 0 0 0 3px rgba(28,63,138,0.12); }

  /* Flags + reset */
  .filter-flags-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .flag-check { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; }
  .flag-check input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: #1c3f8a; }
  .fpill-check input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: #1c3f8a; }
  .reset-btn {
    margin-left: auto; padding: 5px 11px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #6b7280; font-family: inherit; transition: all 0.12s;
  }
  .reset-btn:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; }

  /* ── Empty state ── */
  .empty-analytics {
    display: flex; flex-direction: column; align-items: center;
    padding: 48px 24px; background: #f8faf8; border: 1px solid #e8eee6;
    border-radius: 10px; text-align: center; gap: 8px;
  }
  .empty-icon { font-size: 28px; line-height: 1; }
  .empty-title { font-size: 14px; font-weight: 700; color: #374151; }
  .empty-sub { font-size: 13px; color: #9ca3af; }
  .empty-reset {
    margin-top: 8px; padding: 8px 20px; border: 1.5px solid #1c3f8a;
    border-radius: 8px; background: #fff; color: #1c3f8a; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: inherit; transition: all 0.12s;
  }
  .empty-reset:hover { background: #1c3f8a; color: #fff; }

  /* ── Section cards ── */
  .section-card {
    background: #f8faf8; border: 1px solid #e8eee6;
    border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
  }
  .section-hd {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af;
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 12px;
  }
  .section-ct {
    background: #e8eee6; color: #6b7280; font-size: 11px; font-weight: 700;
    padding: 2px 7px; border-radius: 99px;
    text-transform: none; letter-spacing: 0;
  }

  /* ── Viz section ── */
  .viz-section { padding: 12px 14px 0; }
  .viz-controls-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
  }
  .viz-seg {
    display: flex; background: #f0f0f0; border-radius: 8px; padding: 2px; gap: 1px;
  }
  .vseg {
    padding: 5px 12px; border: none; border-radius: 6px; font-size: 12px; font-weight: 700;
    background: transparent; cursor: pointer; color: #6b7280;
    font-family: inherit; transition: all 0.15s;
  }
  .vseg.vseg-on {
    background: #fff; color: #1c3f8a;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.05);
  }
  .pitch-viz-card {
    border-radius: 10px; overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,50,0,0.18), 0 1px 6px rgba(0,0,0,0.08);
    margin-bottom: 14px;
  }

  /* ── Timeline ── */
  .timeline-wrap { display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 0; }
  .tl-dot {
    width: 26px; height: 26px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; color: #fff;
    cursor: default; flex-shrink: 0;
  }
  .tl-flagged { outline: 2px solid #f59e0b; outline-offset: 2px; }

  /* ── KPI grid ── */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .kpi { background: #fff; border: 1px solid #e8eee6; border-radius: 8px; padding: 12px 14px; }
  .kpi-title { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 8px; }
  .kpi-table { border-collapse: collapse; font-size: 13px; width: 100%; font-variant-numeric: tabular-nums; }
  .kpi-table th, .kpi-table td { border: 1px solid #e8eee6; padding: 6px 8px; text-align: center; }
  .kpi-table thead th { background: #f0f4f0; font-size: 11px; font-weight: 700; color: #6b7280; }
  .kpi-table tbody tr:hover { background: #f9fbf9; }
  .player-table { width: 100%; }
  .low-n { color: #b0b8b0; font-size: 11px; font-style: italic; }
  :global(.trend-up)   { color: #16a34a; font-weight: 800; }
  :global(.trend-down) { color: #dc2626; font-weight: 800; }

  /* ── Zone legend ── */
  .zone-legend {
    font-size: 10px; color: #9ca3af; margin-top: 10px;
    padding-top: 8px; border-top: 1px solid #f0f0f0; line-height: 1.5;
  }

  /* ── Outcome chips ── */
  .outcome-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .outcome-chip {
    padding: 5px 12px; border-radius: 7px; border: 1.5px solid;
    font-size: 12px; font-weight: 700; background: #fff;
  }

  /* ── Hint ── */
  .hint { font-size: 11px; color: #b0b8b0; margin: 8px 0 0; }

  /* fallback buttons */
  button { padding: 7px 14px; border: 1.5px solid #e5e7eb; border-radius: 7px; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; transition: all 0.12s; }
  button:hover { background: #f9fafb; }
  label { display: flex; gap: 6px; align-items: center; font-size: 13px; }

  @media (max-width: 480px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .card { padding: 14px; }
    .section-card { padding: 12px 12px; }
  }
</style>
