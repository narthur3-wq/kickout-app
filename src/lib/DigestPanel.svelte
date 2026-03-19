<script>
  export let events = [];
  export let periodFilter = 'ALL';

  $: filtered = events.filter(e => periodFilter === 'ALL' || e.period === periodFilter);

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
  $: toNet = toUsWon - toThemWon;
  $: toTotal = ourTurnovers.length + theirTurnovers.length;

  function pctStr(v) { return v === null ? '–' : v + '%'; }
  function netStr(n) { return n > 0 ? '+' + n : String(n); }

  function tileBg(pct, hi, lo) {
    if (pct === null) return '#f9fafb';
    if (pct >= hi)   return '#dcfce7';
    if (pct <= lo)   return '#fee2e2';
    return '#fef9c3';
  }
</script>

<div class="digest-shell"><div class="digest">

  <div class="kpi-row">
    <div class="kpi-tile" style="background:{tileBg(koUs.pct, 55, 45)}">
      <div class="kpi-label">KO Win Rate</div>
      <div class="kpi-value">{pctStr(koUs.pct)}</div>
      <div class="kpi-sub">{koUs.won}/{koUs.n} ours · {koThem.won}/{koThem.n} theirs</div>
    </div>

    <div class="kpi-tile" style="background:{tileBg(shotUs.pct, 50, 30)}">
      <div class="kpi-label">Shot Conv.</div>
      <div class="kpi-value">{pctStr(shotUs.pct)}</div>
      <div class="kpi-sub">{shotUs.scored}/{shotUs.n} scored</div>
    </div>

    <div class="kpi-tile" style="background:{toTotal === 0 ? '#f9fafb' : toNet > 0 ? '#dcfce7' : toNet < 0 ? '#fee2e2' : '#fef9c3'}">
      <div class="kpi-label">T/O Diff</div>
      <div class="kpi-value {toNet > 0 ? 'pos' : toNet < 0 ? 'neg' : ''}">{toTotal === 0 ? '–' : netStr(toNet)}</div>
      <div class="kpi-sub">{toUsWon} won · {toThemWon} conceded</div>
    </div>
  </div>

  <div class="detail-grid">
    <div class="detail-card">
      <div class="detail-title">Kickouts</div>
      <div class="detail-row"><span>Our win rate</span><strong class="green">{pctStr(koUs.pct)}</strong></div>
      <div class="detail-row"><span>Their win rate</span><strong>{pctStr(koThem.pct)}</strong></div>
      <div class="detail-row"><span>Our KOs</span><strong>{koUs.n}</strong></div>
      <div class="detail-row"><span>Their KOs</span><strong>{koThem.n}</strong></div>
    </div>

    <div class="detail-card">
      <div class="detail-title">Shots</div>
      <div class="detail-row"><span>Our conversion</span><strong class="green">{pctStr(shotUs.pct)}</strong></div>
      <div class="detail-row"><span>Their conversion</span><strong>{pctStr(shotThem.pct)}</strong></div>
      <div class="detail-row"><span>Our shots</span><strong>{shotUs.n}</strong></div>
      <div class="detail-row"><span>Their shots</span><strong>{shotThem.n}</strong></div>
    </div>

    <div class="detail-card">
      <div class="detail-title">Turnovers</div>
      <div class="detail-row"><span>Won by us</span><strong class="green">{toUsWon}</strong></div>
      <div class="detail-row"><span>Conceded</span><strong>{toThemWon}</strong></div>
      <div class="detail-row"><span>Net</span><strong class="{toNet > 0 ? 'pos' : toNet < 0 ? 'neg' : ''}">{toTotal === 0 ? '–' : netStr(toNet)}</strong></div>
    </div>

    <div class="detail-card">
      <div class="detail-title">Volume</div>
      <div class="detail-row"><span>Kickouts</span><strong>{ourKickouts.length + theirKickouts.length}</strong></div>
      <div class="detail-row"><span>Shots</span><strong>{ourShots.length + theirShots.length}</strong></div>
      <div class="detail-row"><span>Turnovers</span><strong>{toTotal}</strong></div>
      <div class="detail-row"><span>Total</span><strong>{filtered.length}</strong></div>
    </div>
  </div>

  {#if filtered.length === 0}
    <p class="empty">No events recorded yet{periodFilter !== 'ALL' ? ' for ' + periodFilter : ''}.<br/>Use the Capture tab to start logging match data.</p>
  {/if}

</div></div>

<style>
  .digest-shell { background: #fff; border-radius: 12px; border: 1px solid #e2e8df; padding: 18px; margin-bottom: 14px; }
  .digest { padding: 0; display: flex; flex-direction: column; gap: 16px; }

  /* ── KPI tiles ── */
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi-tile {
    border-radius: 10px; padding: 16px 12px; text-align: center;
    border: 1.5px solid #e5e7eb; background: #fff;
    transition: border-color 0.15s;
  }
  .kpi-tile:hover { border-color: #d1d5db; }
  .kpi-label {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 6px;
  }
  .kpi-value {
    font-size: 30px; font-weight: 900; color: #111827; line-height: 1;
    font-variant-numeric: tabular-nums; letter-spacing: -0.03em;
  }
  .kpi-value.pos { color: #16a34a; }
  .kpi-value.neg { color: #dc2626; }
  .kpi-sub { font-size: 11px; color: #9ca3af; margin-top: 5px; line-height: 1.3; }

  /* ── Detail grid ── */
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .detail-card {
    background: #fff; border: 1px solid #e2e8df; border-radius: 10px; padding: 14px 16px;
  }
  .detail-title {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 10px;
    padding-bottom: 6px; border-bottom: 1px solid #f0f4f0;
  }
  .detail-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 4px 0; font-size: 13px; color: #4b5563;
    border-bottom: 1px solid #f8faf8;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-row strong { font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
  .detail-row strong.green { color: #16a34a; }
  .detail-row strong.pos { color: #16a34a; }
  .detail-row strong.neg { color: #dc2626; }

  /* ── Empty state ── */
  .empty {
    text-align: center; padding: 48px 24px;
    color: #9ca3af; font-size: 14px; line-height: 1.5;
    background: #fff; border: 1px solid #e2e8df; border-radius: 10px; margin: 0;
  }

  @media (max-width: 480px) {
    .kpi-row { gap: 8px; }
    .kpi-value { font-size: 24px; }
    .detail-grid { grid-template-columns: 1fr; }
    .digest { gap: 12px; }
  }
</style>
