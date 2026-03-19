<script>
  export let events = [];
  export let periodFilter = 'ALL';

  $: filtered = events.filter(e => periodFilter === 'ALL' || e.period === periodFilter);

  // Split by type + direction
  $: ourKickouts    = filtered.filter(e => (e.event_type || 'kickout') === 'kickout'  && (e.direction || 'ours') === 'ours');
  $: theirKickouts  = filtered.filter(e => (e.event_type || 'kickout') === 'kickout'  && (e.direction || 'ours') === 'theirs');
  $: ourShots       = filtered.filter(e => (e.event_type || 'kickout') === 'shot'     && (e.direction || 'ours') === 'ours');
  $: theirShots     = filtered.filter(e => (e.event_type || 'kickout') === 'shot'     && (e.direction || 'ours') === 'theirs');
  $: ourTurnovers   = filtered.filter(e => (e.event_type || 'kickout') === 'turnover' && (e.direction || 'ours') === 'ours');
  $: theirTurnovers = filtered.filter(e => (e.event_type || 'kickout') === 'turnover' && (e.direction || 'ours') === 'theirs');

  const KO_RETAINED = new Set(['retained', 'score']);
  const SHOT_SCORED = new Set(['goal', 'point']);

  function koStat(evs) {
    const n = evs.length;
    const won = evs.filter(e => KO_RETAINED.has((e.outcome || '').toLowerCase())).length;
    return { n, won, pct: n ? Math.round(100 * won / n) : null };
  }
  function shotStat(evs) {
    const n = evs.length;
    const scored = evs.filter(e => SHOT_SCORED.has((e.outcome || '').toLowerCase())).length;
    return { n, scored, pct: n ? Math.round(100 * scored / n) : null };
  }

  $: koUs   = koStat(ourKickouts);
  $: koThem = koStat(theirKickouts);
  $: shotUs   = shotStat(ourShots);
  $: shotThem = shotStat(theirShots);

  $: toUsWon   = ourTurnovers.filter(e => (e.outcome || '').toLowerCase() === 'won').length;
  $: toThemWon = theirTurnovers.filter(e => (e.outcome || '').toLowerCase() === 'won').length;
  $: toNet   = toUsWon - toThemWon;
  $: toTotal = ourTurnovers.length + theirTurnovers.length;

  // Recent form — last 10 of our kickouts in chronological order
  $: recentForm = [...ourKickouts]
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .slice(-10)
    .map(e => KO_RETAINED.has((e.outcome || '').toLowerCase()) ? 'W' : 'L');

  // Retention by depth zone
  const DEPTH_ORDER = ['Short', 'Medium', 'Long', 'Very Long'];
  $: retByZone = DEPTH_ORDER.map(zone => {
    const evs = ourKickouts.filter(e => e.depth_band === zone);
    const n = evs.length;
    const won = evs.filter(e => KO_RETAINED.has((e.outcome || '').toLowerCase())).length;
    return { zone, n, pct: n >= 2 ? Math.round(100 * won / n) : null };
  });

  // Contest type mix + break win rate
  const CONTEST_TYPES = ['clean', 'break', 'foul', 'out'];
  $: contestBreakdown = CONTEST_TYPES.map(type => {
    const evs = ourKickouts.filter(e => (e.contest_type || 'clean') === type);
    return { type, n: evs.length };
  }).filter(c => c.n > 0);

  $: breakEvs = ourKickouts.filter(e => e.contest_type === 'break');
  $: breakWon = breakEvs.filter(e => (e.break_outcome || '').toLowerCase() === 'won').length;
  $: breakPct = breakEvs.length >= 2 ? Math.round(100 * breakWon / breakEvs.length) : null;

  // Flagged events
  $: flagCount = filtered.filter(e => e.flag).length;

  // Match context (most recent match in filtered set)
  $: matchCtx = (() => {
    if (!filtered.length) return null;
    const sorted = [...filtered].sort((a, b) =>
      (b.match_date || b.created_at || '').localeCompare(a.match_date || a.created_at || ''));
    const last = sorted[0];
    return { team: last.team, opp: last.opponent, date: last.match_date };
  })();

  function pctStr(v) { return v === null ? '–' : v + '%'; }
  function netStr(n) { return n > 0 ? '+' + n : String(n); }

  function tileBg(pct, hi, lo) {
    if (pct === null) return '#f9fafb';
    if (pct >= hi) return '#dcfce7';
    if (pct <= lo) return '#fee2e2';
    return '#fef9c3';
  }
  function pctColor(pct, hi, lo) {
    if (pct === null) return '#9ca3af';
    if (pct >= hi) return '#16a34a';
    if (pct <= lo) return '#dc2626';
    return '#d97706';
  }
</script>

<div class="digest">

  {#if filtered.length === 0}
    <!-- ── Empty state ── -->
    <div class="empty">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No events yet{periodFilter !== 'ALL' ? ' · ' + periodFilter : ''}</div>
      <div class="empty-sub">Switch to the Capture tab to start logging match events.</div>
    </div>

  {:else}

    <!-- ── Match context bar ── -->
    {#if matchCtx?.team || matchCtx?.opp}
      <div class="ctx-bar">
        <span class="ctx-teams">
          {matchCtx.team || '?'} <span class="ctx-vs">vs</span> {matchCtx.opp || '?'}
        </span>
        {#if matchCtx.date}<span class="ctx-date">{matchCtx.date}</span>{/if}
        <span class="ctx-count">{filtered.length} events · {periodFilter !== 'ALL' ? periodFilter : 'All periods'}</span>
      </div>
    {/if}

    <!-- ── Hero KPI row ── -->
    <div class="kpi-row">
      <div class="kpi-tile" style="background:{tileBg(koUs.pct, 55, 45)}">
        <div class="kpi-label">Our KO Ret.</div>
        <div class="kpi-value" style="color:{pctColor(koUs.pct, 55, 45)}">{pctStr(koUs.pct)}</div>
        <div class="kpi-sub">{koUs.won} of {koUs.n} won</div>
      </div>
      <div class="kpi-tile" style="background:{tileBg(koThem.pct, 55, 45)}">
        <div class="kpi-label">Their KO Ret.</div>
        <div class="kpi-value" style="color:{pctColor(koThem.pct, 55, 45)}">{pctStr(koThem.pct)}</div>
        <div class="kpi-sub">{koThem.won} of {koThem.n} won</div>
      </div>
      <div class="kpi-tile" style="background:{toTotal === 0 ? '#f9fafb' : toNet > 0 ? '#dcfce7' : toNet < 0 ? '#fee2e2' : '#fef9c3'}">
        <div class="kpi-label">T/O Net</div>
        <div class="kpi-value {toNet > 0 ? 'pos' : toNet < 0 ? 'neg' : ''}">
          {toTotal === 0 ? '–' : netStr(toNet)}
        </div>
        <div class="kpi-sub">{toUsWon} won · {toThemWon} lost</div>
      </div>
    </div>

    <!-- ── Recent form strip ── -->
    {#if recentForm.length >= 3}
      <div class="section-card">
        <div class="section-hd">
          Recent Form
          <span class="hd-sub">last {recentForm.length} kickouts · oldest → newest</span>
        </div>
        <div class="form-strip">
          {#each recentForm as r}
            <div class="form-dot {r === 'W' ? 'form-w' : 'form-l'}">{r}</div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Retention by depth zone ── -->
    {#if ourKickouts.length >= 2}
      <div class="section-card">
        <div class="section-hd">
          Retention by Zone
          <span class="hd-sub">our kickouts · requires ≥2 per zone</span>
        </div>
        <div class="zone-bars">
          {#each retByZone as z}
            <div class="zone-row">
              <div class="zone-name">{z.zone === 'Very Long' ? 'V-Long' : z.zone}</div>
              <div class="bar-track">
                {#if z.pct !== null}
                  <div class="bar-fill" style="width:{z.pct}%;background:{pctColor(z.pct,55,45)}"></div>
                {/if}
              </div>
              <div class="zone-pct" style="color:{pctColor(z.pct,55,45)}">{pctStr(z.pct)}</div>
              <div class="zone-n">{z.n}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Contest type mix ── -->
    {#if contestBreakdown.length > 0}
      <div class="section-card">
        <div class="section-hd">
          Contest Mix
          <span class="hd-sub">our kickouts</span>
        </div>
        <div class="contest-chips">
          {#each contestBreakdown as c}
            <div class="cc">
              <div class="cc-type">{c.type}</div>
              <div class="cc-n">{c.n}</div>
              <div class="cc-pct">{Math.round(100 * c.n / ourKickouts.length)}%</div>
            </div>
          {/each}
          {#if breakPct !== null}
            <div class="cc cc-break-win">
              <div class="cc-type">break win%</div>
              <div class="cc-n" style="color:#1c3f8a">{breakPct}%</div>
              <div class="cc-pct">{breakWon}/{breakEvs.length}</div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ── Shots + Turnovers ── -->
    <div class="two-col">
      <div class="section-card">
        <div class="section-hd">Shots</div>
        <div class="detail-row">
          <span>Our conv.</span>
          <strong style="color:{pctColor(shotUs.pct, 50, 30)}">{pctStr(shotUs.pct)}</strong>
        </div>
        <div class="detail-row"><span>Their conv.</span><strong>{pctStr(shotThem.pct)}</strong></div>
        <div class="detail-row"><span>Our shots</span><strong>{shotUs.n}</strong></div>
        <div class="detail-row"><span>Their shots</span><strong>{shotThem.n}</strong></div>
      </div>

      <div class="section-card">
        <div class="section-hd">Turnovers</div>
        <div class="detail-row"><span>Won</span><strong class="pos">{toUsWon}</strong></div>
        <div class="detail-row"><span>Conceded</span><strong class="neg">{toThemWon}</strong></div>
        <div class="detail-row">
          <span>Net</span>
          <strong class="{toNet > 0 ? 'pos' : toNet < 0 ? 'neg' : ''}">
            {toTotal === 0 ? '–' : netStr(toNet)}
          </strong>
        </div>
        {#if flagCount > 0}
          <div class="detail-row flag-row">
            <span>⚑ Flagged</span><strong>{flagCount}</strong>
          </div>
        {/if}
      </div>
    </div>

  {/if}
</div>

<style>
  .digest { display: flex; flex-direction: column; gap: 12px; }

  /* ── Empty state ── */
  .empty {
    text-align: center; padding: 56px 24px;
    background: #fff; border-radius: 12px; border: 1px solid #e5e7eb;
  }
  .empty-icon { font-size: 36px; margin-bottom: 12px; }
  .empty-title { font-size: 16px; font-weight: 700; color: #374151; margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: #9ca3af; }

  /* ── Match context bar ── */
  .ctx-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: #fff; border-radius: 10px; border: 1px solid #e5e7eb;
    padding: 10px 14px; font-size: 13px;
  }
  .ctx-teams { font-weight: 700; color: #111827; }
  .ctx-vs { font-weight: 400; color: #9ca3af; margin: 0 3px; }
  .ctx-date { color: #6b7280; }
  .ctx-count { margin-left: auto; font-size: 12px; color: #9ca3af; }

  /* ── Hero KPI tiles ── */
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi-tile {
    border-radius: 12px; padding: 16px 10px 14px; text-align: center;
    border: 1px solid rgba(0,0,0,0.06);
  }
  .kpi-label {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 6px;
  }
  .kpi-value {
    font-size: 28px; font-weight: 900; color: #111827; line-height: 1;
    font-variant-numeric: tabular-nums; letter-spacing: -0.03em;
  }
  .kpi-value.pos { color: #16a34a; }
  .kpi-value.neg { color: #dc2626; }
  .kpi-sub { font-size: 11px; color: #9ca3af; margin-top: 5px; line-height: 1.3; }

  /* ── Section cards ── */
  .section-card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px;
  }
  .section-hd {
    font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
    color: #6b7280; margin-bottom: 12px; display: flex; align-items: baseline; gap: 6px;
  }
  .hd-sub { font-size: 10px; font-weight: 500; text-transform: none; color: #9ca3af; letter-spacing: 0; }

  /* ── Recent form strip ── */
  .form-strip { display: flex; gap: 5px; flex-wrap: wrap; }
  .form-dot {
    width: 28px; height: 28px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #fff;
  }
  .form-w { background: #16a34a; }
  .form-l { background: #dc2626; }

  /* ── Zone retention bars ── */
  .zone-bars { display: flex; flex-direction: column; gap: 8px; }
  .zone-row { display: grid; grid-template-columns: 48px 1fr 36px 22px; align-items: center; gap: 8px; }
  .zone-name { font-size: 12px; font-weight: 700; color: #374151; }
  .bar-track {
    height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;
  }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; min-width: 2px; }
  .zone-pct { font-size: 12px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .zone-n { font-size: 11px; color: #9ca3af; text-align: right; font-variant-numeric: tabular-nums; }

  /* ── Contest mix chips ── */
  .contest-chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .cc {
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 8px 12px; text-align: center; min-width: 58px;
  }
  .cc-break-win { background: #eff6ff; border-color: #bfdbfe; }
  .cc-type { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; margin-bottom: 4px; }
  .cc-n { font-size: 18px; font-weight: 900; color: #111827; line-height: 1; font-variant-numeric: tabular-nums; }
  .cc-pct { font-size: 11px; color: #9ca3af; margin-top: 2px; }

  /* ── Two-column grid ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* ── Detail rows ── */
  .detail-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 5px 0; font-size: 13px; color: #4b5563;
    border-bottom: 1px solid #f3f4f6;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-row strong { font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
  .detail-row strong.pos { color: #16a34a; }
  .detail-row strong.neg { color: #dc2626; }
  .flag-row span { color: #d97706; }

  @media (max-width: 480px) {
    .kpi-value { font-size: 22px; }
    .kpi-row { gap: 8px; }
    .two-col { grid-template-columns: 1fr; }
  }
</style>
