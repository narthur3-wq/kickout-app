<script>
  import Pitch from './Pitch.svelte';
  import Heatmap from './Heatmap.svelte';
  import { createEventDispatcher } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { buildShotSummary, buildTurnoverSummary } from './analyticsHelpers.js';

  // ── Read-only data props ─────────────────────────────────────────────────
  export let vizEvents    = [];
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
  export let clockTrend   = [];
  export let restartStats = [];

  // ── Bindable filter state ────────────────────────────────────────────────
  export let matchFilter  = 'ALL';
  export let oppFilter    = 'ALL';
  export let plyFilter    = 'ALL';
  export let periodFilter = 'ALL';
  export let ytdOnly      = false;
  export let useFilters   = true;
  export let fContest     = new SvelteSet();
  export let fOutcome     = new SvelteSet();
  export let overlayMode  = 'landing';
  export let flaggedOnly         = false;
  export let analyticsEventType  = 'ALL';
  export let directionFilter     = 'ALL';

  const dispatch = createEventDispatcher();

  // Local: pitch vs heatmap toggle
  let vizMode = 'dots'; // 'dots' | 'heat'

  // Advanced filter drawer
  let advancedOpen = false;

  // Player stats sort
  let playerSort = 'total'; // 'total' | 'ret' | 'break'
  $: sortedPlayers = [...playerStats].sort((a, b) => {
    if (playerSort === 'ret')   return (b.retPct   ?? -1) - (a.retPct   ?? -1);
    if (playerSort === 'break') return (b.brWonPct ?? -1) - (a.brWonPct ?? -1);
    return b.total - a.total;
  });

  // Count of active "advanced" filters
  $: advancedCount = [
    matchFilter !== 'ALL',
    oppFilter !== 'ALL',
    plyFilter !== 'ALL',
    ytdOnly,
    flaggedOnly,
    fContest.size !== CONTESTS.length,
    fOutcome.size !== OUTCOMES.length,
  ].filter(Boolean).length;

  // Local: heatmap split — all density, won only, or lost only
  let heatMode = 'all'; // 'all' | 'won' | 'lost'
  const HEAT_POS = new Set(['retained','score','won','goal','point']);

  $: wonPoints  = overlays.filter(o => HEAT_POS.has((o.outcome || '').toLowerCase())).map(o => ({ ...o, weight: 1 }));
  $: lostPoints = overlays.filter(o => !HEAT_POS.has((o.outcome || '').toLowerCase())).map(o => ({ ...o, weight: 1 }));
  $: heatPoints = heatMode === 'won' ? wonPoints : heatMode === 'lost' ? lostPoints : overlays.map(o => ({ ...o, weight: 1 }));
  $: heatScheme = heatMode === 'won' ? 'positive' : heatMode === 'lost' ? 'negative' : 'density';

  function cellColor(pct) {
    const t = Math.max(0, Math.min(1, pct / 100));
    return `hsl(${120 * t} 70% 45% / 0.25)`;
  }

  function outcomeColor(o) {
    switch ((o||'').toLowerCase()) {
      case 'score':
      case 'retained':
      case 'won':      return '#16a34a';
      case 'goal':     return '#15803d';
      case 'point':    return '#0f766e';
      case 'lost':     return '#dc2626';
      case 'wide':
      case 'out':
      case 'foul':     return '#d97706';
      case 'blocked':  return '#ea580c';
      case 'saved':    return '#64748b';
      default:         return '#6b7280';
    }
  }

  const TEAM_LEGEND = [
    { label: 'Ours', shape: 'circle', color: '#f8fafc' },
    { label: 'Theirs', shape: 'square', color: '#f8fafc' },
  ];

  $: heatSuccessButtonLabel =
    effectiveEventType === 'shot' ? 'Scored'
    : effectiveEventType === 'turnover' ? 'Won'
    : 'Successful';

  $: heatFailureButtonLabel =
    effectiveEventType === 'shot' ? 'Missed'
    : 'Lost';

  $: dotsOutcomeLegend = (() => {
    if (effectiveEventType === 'shot') {
      return [
        { label: 'Goal', color: outcomeColor('goal') },
        { label: 'Point', color: outcomeColor('point') },
        { label: 'Wide', color: outcomeColor('wide') },
        { label: 'Blocked', color: outcomeColor('blocked') },
        { label: 'Saved', color: outcomeColor('saved') },
      ];
    }
    if (effectiveEventType === 'turnover') {
      return [
        { label: 'Won', color: outcomeColor('won') },
        { label: 'Lost', color: outcomeColor('lost') },
      ];
    }
    return [
      { label: 'Successful', color: outcomeColor('retained') },
      { label: 'Lost', color: outcomeColor('lost') },
      { label: 'Dead-ball / foul', color: outcomeColor('wide') },
    ];
  })();

  $: specialLegend = (() => {
    if (effectiveEventType === 'shot' && vizEvents.some((e) => String(e.shot_type || '').toLowerCase() === 'goal')) {
      return [{ label: 'Goal attempt', ring: 'goal-attempt' }];
    }
    if (effectiveEventType === 'kickout' && vizEvents.some((e) => e.target_player)) {
      return [{ label: 'Targeted player', ring: 'target' }];
    }
    return [];
  })();

  function toggleContest(val) {
    const s = new SvelteSet(fContest); s.has(val) ? s.delete(val) : s.add(val); fContest = s;
  }
  function toggleOutcome(val) {
    const s = new SvelteSet(fOutcome); s.has(val) ? s.delete(val) : s.add(val); fOutcome = s;
  }

  $: outcomeBreakdown = (() => {
    if (vizEvents.length === 0) return [];
    const map = {};
    for (const e of vizEvents) { const o = e.outcome || 'Unknown'; map[o] = (map[o] || 0) + 1; }
    return Object.entries(map)
      .map(([outcome, count]) => ({ outcome, count, pct: Math.round(100 * count / vizEvents.length) }))
      .sort((a, b) => b.count - a.count);
  })();

  $: hasBreakEvents = vizEvents.some(e => e.contest_type === 'break');
  $: zoneRetTotal = zoneTableRet.reduce((s, row) => s + row.cells.reduce((rs, c) => rs + c.tot, 0), 0);

  const TYPE_LABELS = { 'kickout': 'Kickouts', 'shot': 'Shots', 'turnover': 'Turnovers', 'ALL': 'Analytics' };
  $: inferredEventType = (() => {
    const types = [...new Set(vizEvents.map((event) => String(event?.event_type || 'kickout').toLowerCase()))];
    return types.length === 1 ? types[0] : analyticsEventType;
  })();
  $: effectiveEventType = inferredEventType || analyticsEventType;
  $: panelTitle = TYPE_LABELS[effectiveEventType] || 'Analytics';

  $: isKickoutView = effectiveEventType === 'kickout' || effectiveEventType === 'ALL';

  // Headline summary stats for shots and turnovers
  $: shotSummary = buildShotSummary(vizEvents, effectiveEventType);
  $: turnoverSummary = buildTurnoverSummary(vizEvents, effectiveEventType);

  // Active filter tags for summary bar
  $: filterTags = (() => {
    const tags = [];
    if (periodFilter !== 'ALL') tags.push(periodFilter);
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
    fContest = new SvelteSet(CONTESTS); fOutcome = new SvelteSet(OUTCOMES);
  }
</script>

<section class="card" data-etype={analyticsEventType}>

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
      {#each filterTags as tag (tag)}
        <span class="filter-tag">{tag}</span>
      {/each}
      <button class="filter-clear" on:click={resetFilters}>Clear</button>
    </div>
  {/if}

  <!-- Filters -->
  <div class="filters">
    <!-- Primary row: Direction always visible -->
    <div class="filter-primary-row">
      <div class="fpill-group">
        <span class="fpill-label">Direction</span>
        {#each [['ALL','Both'],['ours','Ours'],['theirs','Theirs']] as [val, lbl] (val)}
          <button class="fpill {directionFilter === val ? 'fpill-on' : ''}" on:click={() => directionFilter = val}>{lbl}</button>
        {/each}
      </div>
      <div class="filter-toolbar">
        <button
          class="adv-toggle {advancedOpen ? 'adv-open' : ''} {advancedCount > 0 ? 'adv-active' : ''}"
          on:click={() => advancedOpen = !advancedOpen}
        >
          Filters {advancedCount > 0 ? `· ${advancedCount}` : ''} {advancedOpen ? '▲' : '▼'}
        </button>
        {#if filterTags.length > 0}
          <button class="reset-btn" on:click={resetFilters}>Reset</button>
        {/if}
      </div>
    </div>

    <!-- Advanced drawer -->
    {#if advancedOpen}
      <div class="adv-drawer">
        <!-- Match / Opponent / Player selects -->
        <div class="filter-selects-row">
          <div class="fselect-wrap">
            <span class="fselect-label">Match</span>
            <select bind:value={matchFilter}>
              <option value="ALL">All matches</option>
              {#each uniqueMatches as m (m.key)}
                <option value={m.key}>{m.match_date} · {m.opponent || 'Unknown'} ({m.count})</option>
              {/each}
            </select>
          </div>
          <div class="fselect-wrap">
            <span class="fselect-label">Opponent</span>
            <select bind:value={oppFilter}>
              <option value="ALL">All</option>
              {#each opponentChoices as [key,lbl] (key)}<option value={key}>{lbl}</option>{/each}
            </select>
          </div>
          <div class="fselect-wrap">
            <span class="fselect-label">Player</span>
            <select bind:value={plyFilter}>
              <option value="ALL">All</option>
              {#each playerChoices as [key,lbl] (key)}<option value={key}>{lbl}</option>{/each}
            </select>
          </div>
        </div>

        <!-- Contest / Outcome pills (kickout only) -->
        {#if isKickoutView}
          <div class="filter-pills-row">
            <div class="fpill-group">
              <span class="fpill-label">Contest</span>
              {#each CONTESTS as c (c)}
                <button class="fpill {fContest.has(c) ? 'fpill-on' : ''}" on:click={() => toggleContest(c)}>{c}</button>
              {/each}
            </div>
          </div>
          <div class="filter-pills-row">
            <div class="fpill-group">
              <span class="fpill-label">Outcome</span>
              {#each OUTCOMES as o (o)}
                <button class="fpill {fOutcome.has(o) ? 'fpill-on' : ''}" on:click={() => toggleOutcome(o)}>{o}</button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Flags row -->
        <div class="filter-flags-row">
          <label class="flag-check"><input type="checkbox" bind:checked={ytdOnly}/> {currentYear} only</label>
          <label class="flag-check"><input type="checkbox" bind:checked={flaggedOnly}/> Flagged only</label>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Empty state ── -->
  {#if vizEvents.length === 0}
    <div class="empty-analytics">
      <div class="empty-icon">📊</div>
      <div class="empty-title">No {panelTitle} logged yet. Switch to Capture to start recording.</div>
      <div class="empty-sub">Adjust or clear your filters to see data.</div>
      <button class="empty-reset" on:click={resetFilters}>Reset filters</button>
    </div>

  {:else}

    {#if vizEvents.length < 5 && analyticsEventType !== 'shot' && analyticsEventType !== 'turnover'}
      <p class="small-sample-notice">(small sample — interpret with caution)</p>
    {/if}

    <!-- ── Shot headline summary ── -->
    {#if shotSummary}
      {#if shotSummary.tooFew}
        <div class="summary-kpi-row"><span class="summary-kpi-empty">Not enough data yet</span></div>
      {:else}
        <div class="summary-kpi-row {shotSummary.small ? 'summary-kpi-small' : ''}">
          <div class="summary-chip">
            <span class="summary-chip-val">{shotSummary.total}</span>
            <span class="summary-chip-lbl">Total shots</span>
          </div>
          <div class="summary-chip">
            <span class="summary-chip-val">{shotSummary.scored} <span class="summary-chip-pct">({shotSummary.scoredPct}%)</span></span>
            <span class="summary-chip-lbl">Scored</span>
          </div>
          <div class="summary-chip">
            <span class="summary-chip-val">{shotSummary.goalAttempts} <span class="summary-chip-pct">→ {shotSummary.goals}</span></span>
            <span class="summary-chip-lbl">Goal chances / scored</span>
          </div>
          <div class="summary-chip">
            <span class="summary-chip-val">{shotSummary.pointAttempts} <span class="summary-chip-pct">→ {shotSummary.points}</span></span>
            <span class="summary-chip-lbl">Point attempts / scored</span>
          </div>
        </div>
        {#if shotSummary.small}<p class="small-sample-notice">(small sample — interpret with caution)</p>{/if}
      {/if}
    {/if}

    <!-- ── Turnover headline summary ── -->
    {#if turnoverSummary}
      {#if turnoverSummary.tooFew}
        <div class="summary-kpi-row"><span class="summary-kpi-empty">Not enough data yet</span></div>
      {:else}
        <div class="summary-kpi-row {turnoverSummary.small ? 'summary-kpi-small' : ''}">
          <div class="summary-chip">
            <span class="summary-chip-val">{turnoverSummary.total}</span>
            <span class="summary-chip-lbl">Total turnovers</span>
          </div>
          <div class="summary-chip">
            <span class="summary-chip-val" style="color:#16a34a">{turnoverSummary.won}</span>
            <span class="summary-chip-lbl">Won</span>
          </div>
          <div class="summary-chip">
            <span class="summary-chip-val" style="color:#dc2626">{turnoverSummary.lost}</span>
            <span class="summary-chip-lbl">Lost</span>
          </div>
          <div class="summary-chip">
            <span class="summary-chip-val" style="color:{turnoverSummary.net >= 0 ? '#16a34a' : '#dc2626'}">{turnoverSummary.net >= 0 ? '+' : ''}{turnoverSummary.net}</span>
            <span class="summary-chip-lbl">Net</span>
          </div>
        </div>
        {#if turnoverSummary.small}<p class="small-sample-notice">(small sample — interpret with caution)</p>{/if}
      {/if}
    {/if}

    <!-- ── Viz section: Pitch (dots) or Heatmap ── -->
    <div class="section-card viz-section">
      <div class="viz-controls-bar">
        <div class="viz-seg">
          <button class="vseg {vizMode === 'dots' ? 'vseg-on' : ''}" on:click={() => vizMode = 'dots'}>Dots</button>
          <button class="vseg {vizMode === 'heat' ? 'vseg-on' : ''}" on:click={() => vizMode = 'heat'}>Heat</button>
        </div>
        {#if analyticsEventType === 'kickout' && hasBreakEvents}
          <div class="viz-seg">
            <button class="vseg {overlayMode === 'landing' ? 'vseg-on' : ''}" on:click={() => overlayMode = 'landing'}>Landing</button>
            <button class="vseg {overlayMode === 'pickup' ? 'vseg-on' : ''}" on:click={() => overlayMode = 'pickup'}>Pickup</button>
          </div>
        {/if}
        {#if vizMode === 'heat'}
          <div class="viz-seg">
            <button class="vseg {heatMode === 'all'  ? 'vseg-on' : ''}" on:click={() => heatMode = 'all'}>Density</button>
            <button class="vseg {heatMode === 'won'  ? 'vseg-on' : ''}" on:click={() => heatMode = 'won'}>{heatSuccessButtonLabel}</button>
            <button class="vseg {heatMode === 'lost' ? 'vseg-on' : ''}" on:click={() => heatMode = 'lost'}>{heatFailureButtonLabel}</button>
          </div>
        {/if}
      </div>
      <div class="pitch-viz-frame">
        <div class="pitch-viz-card">
          {#if vizMode === 'heat'}
            <Heatmap points={heatPoints} cols={140} radius={3} smooth={2} colorScheme={heatScheme} />
          {:else}
            <Pitch
              contestType="clean"
              landing={{x:NaN,y:NaN}}
              pickup={{x:NaN,y:NaN}}
              {overlays}
              showZoneLabels={true}
              showZoneLegend={false}
            />
          {/if}
        </div>
      </div>
      <div class="pitch-viz-legend">
        {#if vizMode === 'dots'}
          <div class="legend-group">
            <span class="legend-group-label">Team</span>
            {#each TEAM_LEGEND as item (item.label)}
              <span class="legend-item">
                <span class="legend-marker-wrap">
                  <span class="legend-marker {item.shape === 'square' ? 'legend-marker-square' : 'legend-marker-circle'}" style="background:{item.color}"></span>
                </span>
                {item.label}
              </span>
            {/each}
          </div>

          <div class="legend-group">
            <span class="legend-group-label">Outcome</span>
            {#each dotsOutcomeLegend as item (item.label)}
              <span class="legend-item">
                <span class="legend-marker-wrap">
                  <span class="legend-marker legend-marker-circle" style="background:{item.color}"></span>
                </span>
                {item.label}
              </span>
            {/each}
          </div>

          {#if specialLegend.length > 0}
            <div class="legend-group">
              <span class="legend-group-label">Special</span>
              {#each specialLegend as item (item.label)}
                <span class="legend-item">
                  <span class="legend-marker-wrap">
                    <span class="legend-marker legend-marker-circle" style="background:#f8fafc"></span>
                    <span class="legend-marker-ring {item.ring}"></span>
                  </span>
                  {item.label}
                </span>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="legend-group">
            <span class="legend-group-label">Heat</span>
            <span class="legend-item">
              <span class="legend-heat-swatch {heatMode === 'won' ? 'legend-heat-won' : heatMode === 'lost' ? 'legend-heat-lost' : 'legend-heat-density'}"></span>
              {heatMode === 'won' ? `${heatSuccessButtonLabel} density` : heatMode === 'lost' ? `${heatFailureButtonLabel} density` : 'Event density'}
            </span>
          </div>
        {/if}

        <div class="legend-group">
          <span class="legend-group-label">Pitch</span>
          <span class="legend-item"><span class="legend-end-swatch"></span> Highlighted end = our goal</span>
          <span class="legend-item">L / C / R = side band</span>
          <span class="legend-item">20 / 45 / 65 = metres from goal</span>
        </div>
      </div>
    </div>

    <!-- ── Outcomes ── -->
    {#if outcomeBreakdown.length > 0}
      <div class="section-card">
        <div class="section-hd">Outcomes</div>
        <div class="outcome-chips">
          {#each outcomeBreakdown as o (o.outcome)}
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
          {#each timelineEvents as e (e.id)}
            <div
              class="tl-dot {e.flag ? 'tl-flagged' : ''}"
              style="background:{outcomeColor(e.outcome)}"
              title="#{e.ko_sequence ?? i+1} · {e.outcome} · {e.contest_type} · {e.period} {e.clock}{e.target_player ? ' → #' + e.target_player : ''}{e.notes ? ' — ' + e.notes : ''}"
            >{e.ko_sequence ?? i+1}</div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Clock trend ── -->
    {#if analyticsEventType === 'kickout' && clockTrend.length >= 2}
      <div class="section-card">
        <div class="section-hd">Retention by Clock <span class="section-ct">{clockTrend.reduce((s,b)=>s+b.tot,0)} with clock</span></div>
        <div class="clock-bars">
          {#each clockTrend as b (b.label)}
            {@const color = b.pct >= 60 ? '#16a34a' : b.pct >= 45 ? '#d97706' : '#dc2626'}
            <div class="clock-row">
              <span class="clock-lbl">{b.label}'</span>
              <div class="clock-track">
                <div class="clock-fill" style="width:{b.pct}%;background:{color}"></div>
              </div>
              <span class="clock-pct" style="color:{color}">{b.pct}%</span>
              <span class="clock-n">n={b.tot}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── By restart reason ── -->
    {#if restartStats.length > 0}
      <div class="section-card">
        <div class="section-hd">Retention by Restart</div>
        <div class="restart-bars">
          {#each restartStats as r (r.reason)}
            {@const color = r.pct >= 60 ? '#16a34a' : r.pct >= 45 ? '#d97706' : '#dc2626'}
            <div class="clock-row">
              <span class="clock-lbl" style="width:46px">{r.reason}</span>
              <div class="clock-track">
                <div class="clock-fill" style="width:{r.pct}%;background:{color}"></div>
              </div>
              <span class="clock-pct" style="color:{color}">{r.pct}%</span>
              <span class="clock-n">n={r.tot}</span>
            </div>
          {/each}
        </div>
        <p class="hint">Shown when n≥3. Tap "Restart after" in capture to tag each kickout.</p>
      </div>
    {/if}

    <!-- ── Zone breakdown (kickout only) ── -->
    {#if isKickoutView}
      <div class="section-card">
        <div class="section-hd">Zone Breakdown</div>
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-title">Retention by Zone</div>
            {#if zoneRetTotal < 5}
              <p class="hint">Add more events to see zone breakdown.</p>
            {:else}
              <table class="kpi-table">
                <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
                <tbody>
                  {#each zoneTableRet as row (row.D)}
                    <tr>
                      <th>{row.D}</th>
                      {#each row.cells as c (c.zk)}
                        {@const trend = retTrend(c.pct, c.zk)}
                        <td
                          style="background:{c.tot >= 8 ? cellColor(c.pct) : c.tot > 0 && c.tot < 3 ? '#f3f4f6' : 'transparent'}"
                          class="{c.tot >= 3 && c.tot < 8 ? 'low-n' : ''}"
                          title="{c.ret}/{c.tot} retained"
                        >
                          {#if c.tot >= 8}
                            {Math.round(c.pct)}%{#if trend}<span class="trend-{trend}">{trend === 'up' ? ' ▲' : ' ▼'}</span>{/if}
                          {:else if c.tot >= 3}
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
            {/if}
          </div>

          <div class="kpi">
            <div class="kpi-title">
              Break Win-Rate — {overallBreak.tot ? Math.round(overallBreak.pct)+'%' : '—'}
              ({overallBreak.won}/{overallBreak.tot})
            </div>
            {#if overallBreak.tot < 5}
              <p class="hint">Add more events to see zone breakdown.</p>
            {:else}
              <table class="kpi-table">
                <thead><tr><th></th><th>L</th><th>C</th><th>R</th></tr></thead>
                <tbody>
                  {#each zoneTableBreak as row (row.D)}
                    <tr>
                      <th>{row.D}</th>
                      {#each row.cells as c (c.zk)}
                        <td
                          style="background:{c.tot >= 3 ? cellColor(c.pct) : '#f3f4f6'}"
                          class="{c.tot > 0 && c.tot < 3 ? 'low-n' : ''}"
                          title="{c.won}/{c.tot}"
                        >
                          {#if c.tot >= 3}
                            {Math.round(c.pct)}%
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
            {/if}
          </div>
        </div>
        <div class="zone-legend">S = 0–20m · M = 20–45m · L = 45–65m · V = 65m+ &nbsp;|&nbsp; L = Left · C = Centre · R = Right</div>
      </div>
    {/if}

    <!-- ── Target players (kickout only) ── -->
    {#if isKickoutView && sortedPlayers.length > 0}
      <div class="section-card">
        <div class="section-hd">
          Target Players
          <div class="player-sort">
            Sort:
            {#each [['total','Volume'],['ret','Retention'],['break','Break win%']] as [k,l] (k)}
              <button class="psort {playerSort === k ? 'psort-on' : ''}" on:click={() => playerSort = k}>{l}</button>
            {/each}
          </div>
        </div>
        <table class="kpi-table player-table">
          <thead><tr><th>Player</th><th>Targeted</th><th>Retention</th><th>Breaks</th><th>Break win%</th></tr></thead>
          <tbody>
            {#each sortedPlayers as p (p.key)}
              <tr
                class="player-row {plyFilter === p.key ? 'player-row-active' : ''}"
                tabindex="0"
                role="button"
                on:click={() => dispatch('filterPlayer', plyFilter === p.key ? 'ALL' : p.key)}
                on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && dispatch('filterPlayer', plyFilter === p.key ? 'ALL' : p.key)}
                title="Tap to filter"
              >
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
        <div class="ss-bars">
          {#each scoreStateStats as s (s.bucket)}
            {@const barColor = s.pct == null ? null : s.pct >= 60 ? '#16a34a' : s.pct >= 40 ? '#d97706' : '#dc2626'}
            <div class="ss-row">
              <span class="ss-lbl">{s.bucket}</span>
              <div class="ss-track">
                {#if s.pct != null}
                  <div class="ss-fill" style="width:{s.pct}%;background:{barColor}"></div>
                {/if}
              </div>
              {#if s.pct != null}
                <span class="ss-n">{s.tot}</span>
                <span class="ss-pct" style="color:{barColor}">{s.pct}%</span>
              {:else}
                <span class="ss-n">{s.tot}</span>
                <span class="ss-null">—</span>
              {/if}
            </div>
          {/each}
        </div>
        <p class="hint">Retention rate in each score-state context. Derived from tracked shot events. Shown when n≥3.</p>
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
  .filter-summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #3b82f6; }
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
    display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;
    padding: 0 0 12px; border-bottom: 1px solid #f0f0f0;
  }
  .filter-primary-row {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .filter-toolbar { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  /* Advanced toggle — ghost style */
  .adv-toggle {
    padding: 4px 10px; border: 1px solid transparent; border-radius: 6px;
    background: transparent; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #9ca3af; font-family: inherit; transition: all 0.12s; white-space: nowrap;
  }
  .adv-toggle:hover { color: #4b5563; background: #f3f4f6; }
  .adv-toggle.adv-open { color: #1c3f8a; background: #eff6ff; }
  .adv-toggle.adv-active { color: #1c3f8a; font-weight: 700; }

  /* Advanced drawer — inset/quiet */
  .adv-drawer {
    display: flex; flex-direction: column; gap: 10px;
    background: #f9fafb; border: 1px solid #f0f0f0; border-radius: 8px;
    padding: 12px 14px; margin-top: 2px;
  }

  /* Pill controls */
  .filter-pills-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .fpill-group { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .fpill-label { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #9ca3af; margin-right: 2px; white-space: nowrap; }
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
  .fselect-label { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #9ca3af; }
  .fselect-wrap select {
    padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    font-size: 13px; background: #fff; color: #111827; font-family: inherit;
    cursor: pointer; transition: border-color 0.12s;
  }
  .fselect-wrap select:focus { outline: none; border-color: #1c3f8a; box-shadow: 0 0 0 3px rgba(28,63,138,0.12); }

  /* Flags row */
  .filter-flags-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .flag-check { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; }
  .flag-check input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: #1c3f8a; }
  .reset-btn {
    padding: 5px 11px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #6b7280; font-family: inherit; transition: all 0.12s;
  }
  .reset-btn:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; }

  /* ── Empty state ── */
  .empty-analytics {
    display: flex; flex-direction: column; align-items: center;
    padding: 48px 24px; background: #fff; border: 1px solid #e5e7eb;
    border-radius: 12px; text-align: center; gap: 8px;
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
    background: #fff; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 16px 18px; margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .section-hd {
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: #374151;
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 14px;
  }
  .section-ct {
    background: #f3f4f6; color: #9ca3af; font-size: 11px; font-weight: 600;
    padding: 2px 7px; border-radius: 99px;
    letter-spacing: 0;
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
  .pitch-viz-frame {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }
  .pitch-viz-card {
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,50,0,0.18), 0 1px 6px rgba(0,0,0,0.08);
    aspect-ratio: 145 / 90;
    width: min(100%, calc(58svh * 145 / 90));
    max-width: 1280px;
  }
  .pitch-viz-legend {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 11px;
    color: #64748b;
    margin: 0 2px 14px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
  }
  .legend-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }
  .legend-group-label {
    color: #94a3b8;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    min-width: 54px;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .legend-marker-wrap {
    position: relative;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .legend-marker {
    width: 12px;
    height: 12px;
    border: 1px solid rgba(15, 23, 42, 0.14);
    background: #f8fafc;
  }
  .legend-marker-circle { border-radius: 999px; }
  .legend-marker-square { border-radius: 3px; }
  .legend-marker-ring {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    border: 1.6px solid rgba(255,255,255,0.95);
    pointer-events: none;
  }
  .legend-marker-ring.target { border-style: dashed; }
  .legend-marker-ring.goal-attempt { border-style: solid; }
  .legend-end-swatch {
    width: 18px;
    height: 12px;
    border: 1px solid rgba(255,255,255,0.92);
    border-left: 3px solid rgba(255,255,255,0.98);
    border-radius: 2px;
    background: rgba(255,255,255,0.12);
    box-shadow: inset 0 0 0 1px rgba(148,163,184,0.2);
  }
  .legend-heat-swatch {
    width: 22px;
    height: 12px;
    display: inline-block;
    border-radius: 999px;
    border: 1px solid rgba(15, 23, 42, 0.12);
  }
  .legend-heat-density {
    background: linear-gradient(135deg, #f59e0b, #ef4444);
  }
  .legend-heat-won {
    background: linear-gradient(135deg, #fde68a, #ca8a04);
  }
  .legend-heat-lost {
    background: linear-gradient(135deg, #f87171, #dc2626);
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
  .kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
  .kpi-title { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 8px; }
  .kpi-table { border-collapse: collapse; font-size: 13px; width: 100%; font-variant-numeric: tabular-nums; }
  .kpi-table th, .kpi-table td { border: 1px solid #f3f4f6; padding: 7px 8px; text-align: center; }
  .kpi-table thead th { background: #f9fafb; font-size: 11px; font-weight: 600; color: #9ca3af; border-bottom: 1px solid #e5e7eb; }
  .kpi-table tbody tr:hover { background: #f9fbf9; }
  .player-table { width: 100%; }
  .player-sort {
    margin-left: auto; display: flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: none; letter-spacing: 0;
  }
  .psort {
    padding: 2px 7px; border: 1px solid #e5e7eb; border-radius: 5px;
    background: #fff; cursor: pointer; font-size: 11px; font-weight: 600;
    color: #6b7280; font-family: inherit;
  }
  .psort.psort-on { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .low-n { color: #b0b8b0; font-size: 11px; font-style: italic; background: #f3f4f6; }
  :global(.trend-up)   { color: #16a34a; font-weight: 800; }
  :global(.trend-down) { color: #dc2626; font-weight: 800; }

  /* ── Zone legend ── */
  .zone-legend {
    font-size: 11px; color: #9ca3af; margin-top: 10px;
    padding-top: 8px; border-top: 1px solid #f0f0f0; line-height: 1.5;
  }

  /* ── Outcome chips ── */
  .outcome-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .outcome-chip {
    padding: 5px 12px; border-radius: 7px; border: 1.5px solid;
    font-size: 12px; font-weight: 700; background: #fff;
  }

  /* ── Clock trend ── */
  .clock-bars { display: flex; flex-direction: column; gap: 6px; }
  .clock-row { display: flex; align-items: center; gap: 8px; }
  .clock-lbl { font-size: 11px; font-weight: 700; color: #6b7280; width: 38px; flex-shrink: 0; }
  .clock-track { flex: 1; height: 10px; background: #f0f0f0; border-radius: 99px; overflow: hidden; }
  .clock-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }
  .clock-pct { font-size: 12px; font-weight: 700; width: 36px; text-align: right; flex-shrink: 0; }
  .clock-n { font-size: 11px; color: #9ca3af; width: 34px; flex-shrink: 0; }

  /* ── Player row tap-to-filter ── */
  .player-row { cursor: pointer; transition: background 0.1s; }
  .player-row:hover { background: #f0f4ff; }
  .player-row-active { background: #dbeafe !important; }
  .player-row-active td { color: #1c3f8a; font-weight: 700; }

  /* ── Hint ── */
  .hint { font-size: 11px; color: #b0b8b0; margin: 8px 0 0; }

  /* fallback buttons */
  button { padding: 7px 14px; border: 1.5px solid #e5e7eb; border-radius: 7px; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; transition: all 0.12s; }
  button:hover { background: #f9fafb; }
  label { display: flex; gap: 6px; align-items: center; font-size: 13px; }

  @media (max-width: 900px) {
    .pitch-viz-card {
      width: 100%;
    }
  }

  /* ── Headline summary KPI row (shots / turnovers) ── */
  .summary-kpi-row {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-bottom: 14px;
  }
  .summary-kpi-row.summary-kpi-small { opacity: 0.85; }
  .summary-kpi-empty {
    font-size: 13px; color: #9ca3af; font-style: italic; padding: 8px 0;
  }
  .summary-chip {
    display: flex; flex-direction: column; align-items: center;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 10px 16px; flex: 1; min-width: 80px;
  }
  .summary-chip-val {
    font-size: 20px; font-weight: 800; color: #111827;
    font-variant-numeric: tabular-nums; line-height: 1.2;
  }
  .summary-chip-pct { font-size: 13px; font-weight: 600; color: #6b7280; }
  .summary-chip-lbl {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #9ca3af; margin-top: 2px; text-align: center;
  }
  .small-sample-notice {
    font-size: 11px; color: #b45309; font-style: italic; margin: 0 0 10px;
  }

  /* ── Tab accent colours ── */
  /* Shots: green accent */
  :global(.analytics-shots) .panel-title { color: #15803d; }
  :global(.analytics-shots) .section-hd  { color: #15803d; }
  /* Turnovers: amber accent */
  :global(.analytics-turnovers) .panel-title { color: #b45309; }
  :global(.analytics-turnovers) .section-hd  { color: #b45309; }

  /* Panel title accent via data attribute on root section */
  .card[data-etype="shot"]     .panel-title { color: #15803d; border-left: 3px solid #15803d; padding-left: 8px; }
  .card[data-etype="shot"]     .section-hd  { color: #15803d; }
  .card[data-etype="turnover"] .panel-title { color: #b45309; border-left: 3px solid #b45309; padding-left: 8px; }
  .card[data-etype="turnover"] .section-hd  { color: #b45309; }
  .card[data-etype="kickout"]  .panel-title { border-left: 3px solid #1c3f8a; padding-left: 8px; }

  /* ── Score state bar chart ── */
  .ss-bars { display: flex; flex-direction: column; gap: 7px; }
  .ss-row { display: flex; align-items: center; gap: 8px; }
  .ss-lbl { font-size: 11px; font-weight: 700; color: #6b7280; width: 72px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ss-track { flex: 1; height: 10px; background: #f0f0f0; border-radius: 99px; overflow: hidden; }
  .ss-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }
  .ss-n { font-size: 11px; color: #9ca3af; width: 28px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .ss-pct { font-size: 12px; font-weight: 700; width: 38px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .ss-null { font-size: 12px; font-weight: 600; color: #d1d5db; width: 38px; text-align: right; flex-shrink: 0; }

  /* ── Desktop whitespace ── */
  @media (min-width: 900px) {
    .section-card { margin-bottom: 12px; padding: 14px 16px; }
    .card { margin-bottom: 10px; }
    .kpi-grid { gap: 10px; }
    .kpi { padding: 12px 14px; }
    .viz-controls-bar { margin-bottom: 8px; }
  }

  @media (max-width: 480px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .card { padding: 14px; }
    .section-card { padding: 12px 12px; }
  }
</style>
