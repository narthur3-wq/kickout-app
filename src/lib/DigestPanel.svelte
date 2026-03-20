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

  const KO_RETAINED = new Set(['retained', 'score', 'won']);
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

  // Opposition kickout tendency — which zones they target and our win rate per zone
  const OPP_SIDES = ['L','C','R'], OPP_DEPTH = ['S','M','L','V'];
  $: oppTendency = (() => {
    if (theirKickouts.length === 0) return null;
    const z = {};
    for (const S of OPP_SIDES) for (const D of OPP_DEPTH) z[`${S}-${D}`] = { tot: 0, won: 0 };
    for (const e of theirKickouts) {
      const key = e.zone_code; if (!z[key]) continue;
      z[key].tot++;
      if (KO_RETAINED.has((e.outcome || '').toLowerCase())) z[key].won++;
    }
    return { z, n: theirKickouts.length };
  })();

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

  // ── Auto-narrative ────────────────────────────────────────────────────────
  $: narrative = (() => {
    if (!filtered.length || koUs.n < 3) return [];
    const lines = [];

    // Line 1 — our kickout retention + zone insight
    const quality = koUs.pct >= 60 ? 'strong' : koUs.pct >= 50 ? 'solid' : koUs.pct >= 40 ? 'mixed' : 'poor';
    const zonesWithData = retByZone.filter(z => z.pct !== null && z.n >= 2);
    const best  = zonesWithData.length ? zonesWithData.reduce((a, b) => b.pct > a.pct ? b : a) : null;
    const worst = zonesWithData.length >= 2 ? zonesWithData.reduce((a, b) => b.pct < a.pct ? b : a) : null;
    let l1 = `Our kickout retention was ${quality} at ${koUs.pct}% (${koUs.won}/${koUs.n})`;
    if (best && worst && best.zone !== worst.zone) {
      l1 += ` — best ${best.zone.toLowerCase()} (${best.pct}%), weakest ${worst.zone.toLowerCase()} (${worst.pct}%)`;
    } else if (best) {
      l1 += ` — strongest in ${best.zone.toLowerCase()} (${best.pct}%)`;
    }
    lines.push(l1 + '.');

    // Line 2 — their kickouts + tendency
    if (koThem.n >= 3) {
      const result = koThem.pct >= 50 ? `won ${koThem.pct}%` : `won only ${koThem.pct}%`;
      let l2 = `We ${result} of their ${koThem.n} kickouts`;
      if (oppTendency) {
        const topZone = Object.entries(oppTendency.z)
          .filter(([, v]) => v.tot > 0)
          .sort(([, a], [, b]) => b.tot - a.tot)[0];
        if (topZone) {
          const [zk, zv] = topZone;
          const vol = Math.round(100 * zv.tot / oppTendency.n);
          if (vol >= 20) {
            const winR = zv.tot ? Math.round(100 * zv.won / zv.tot) : 0;
            l2 += ` — they favoured ${zk} (${vol}% of kicks, we won ${winR}%)`;
          }
        }
      }
      lines.push(l2 + '.');
    }

    // Line 3 — game shape
    const items = [];
    if (toTotal >= 3) {
      if (toNet > 0) items.push(`won the turnover battle (+${toNet})`);
      else if (toNet < 0) items.push(`lost more turnovers than we won (${toNet})`);
      else items.push('turnover battle even');
    }
    if (shotUs.n >= 3 && shotUs.pct !== null) {
      items.push(`scored on ${shotUs.pct}% of our ${shotUs.n} shots`);
    }
    if (recentForm.length >= 6) {
      const mid = Math.floor(recentForm.length / 2);
      const p1 = recentForm.slice(0, mid).filter(r => r === 'W').length / mid;
      const p2 = recentForm.slice(mid).filter(r => r === 'W').length / (recentForm.length - mid);
      if (p2 - p1 >= 0.25) items.push('improving as the game went on');
      else if (p1 - p2 >= 0.25) items.push('faded as the match progressed');
    }
    if (items.length) lines.push(`Overall: ${items.join(', ')}.`);

    return lines;
  })();

  let digestEl;
  let sharing = false;

  async function shareDigest() {
    if (sharing) return;
    sharing = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(digestEl, { backgroundColor: '#f0f4f0', scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'pairc-digest.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Páirc Digest' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'kickout-digest.png'; a.click();
          URL.revokeObjectURL(url);
        }
        sharing = false;
      }, 'image/png');
    } catch (e) {
      console.error('Share failed', e);
      sharing = false;
    }
  }

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

<div class="digest" bind:this={digestEl}>

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
        <button class="share-btn" on:click={shareDigest} disabled={sharing}>
          {sharing ? '…' : '⬆ Share'}
        </button>
      </div>
    {/if}

    <!-- ── Narrative ── -->
    {#if narrative.length > 0}
      <div class="narrative-card">
        {#each narrative as line}
          <p class="narrative-line">{line}</p>
        {/each}
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
        <div class="kpi-label">Won Their KO</div>
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

    <!-- ── Opposition KO Tendency ── -->
    {#if oppTendency}
      <div class="section-card">
        <div class="section-hd">
          Opposition KO Tendency
          <span class="hd-sub">{oppTendency.n} tracked</span>
        </div>
        <div class="opp-grid-wrap">
          <div class="opp-col-hdr">
            <span></span>
            {#each OPP_SIDES as S}<span class="opp-hdr">{S}</span>{/each}
          </div>
          {#each OPP_DEPTH as D}
            <div class="opp-row">
              <span class="opp-row-lbl">{D}</span>
              {#each OPP_SIDES as S}
                {@const cell = oppTendency.z[`${S}-${D}`]}
                {@const volPct = cell.tot ? Math.round(100 * cell.tot / oppTendency.n) : 0}
                {@const winPct = cell.tot ? Math.round(100 * cell.won / cell.tot) : null}
                <div class="opp-cell" title="{cell.tot} kicks · {winPct ?? 0}% we won"
                  style="background: rgba(196,18,48,{Math.min(0.55, volPct / 100 * 2.5)})">
                  {#if cell.tot > 0}
                    <span class="opp-vol">{volPct}%</span>
                    <span class="opp-win">{winPct ?? 0}%W</span>
                  {:else}
                    <span class="opp-empty">—</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
        <p class="opp-legend">Cell heat = how often they kick there · W = our win rate</p>
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
  .share-btn {
    padding: 5px 12px; border-radius: 7px; font-size: 12px; font-weight: 700;
    border: 1.5px solid #1c3f8a; background: #1c3f8a; color: #fff;
    cursor: pointer; font-family: inherit; transition: all 0.12s; flex-shrink: 0;
  }
  .share-btn:hover { background: #163270; }
  .share-btn:disabled { opacity: 0.5; cursor: default; }

  /* ── Narrative ── */
  .narrative-card {
    background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 12px;
    padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  }
  .narrative-line {
    margin: 0; font-size: 13px; line-height: 1.55; color: #1e3a5f; font-weight: 500;
  }
  .narrative-line + .narrative-line { padding-top: 4px; border-top: 1px solid #dbeafe; }

  /* ── Hero KPI tiles ── */
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi-tile {
    border-radius: 14px; padding: 20px 12px 18px; text-align: center;
    border: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .kpi-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 8px;
  }
  .kpi-value {
    font-size: 32px; font-weight: 900; color: #111827; line-height: 1;
    font-variant-numeric: tabular-nums; letter-spacing: -0.04em;
  }
  .kpi-value.pos { color: #16a34a; }
  .kpi-value.neg { color: #dc2626; }
  .kpi-sub { font-size: 11px; color: #9ca3af; margin-top: 7px; line-height: 1.3; }

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
  /* ── Opposition tendency grid ── */
  .opp-grid-wrap { display: flex; flex-direction: column; gap: 3px; }
  .opp-col-hdr { display: grid; grid-template-columns: 28px repeat(3, 1fr); gap: 3px; margin-bottom: 2px; }
  .opp-hdr { font-size: 10px; font-weight: 800; color: #9ca3af; text-align: center; text-transform: uppercase; }
  .opp-row { display: grid; grid-template-columns: 28px repeat(3, 1fr); gap: 3px; }
  .opp-row-lbl { font-size: 10px; font-weight: 800; color: #9ca3af; display: flex; align-items: center; text-transform: uppercase; }
  .opp-cell {
    border-radius: 6px; padding: 6px 4px; text-align: center;
    display: flex; flex-direction: column; gap: 1px;
    background: rgba(196,18,48,0.05); min-height: 40px; justify-content: center;
    border: 1px solid rgba(196,18,48,0.08);
  }
  .opp-vol { font-size: 12px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
  .opp-win { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.85); text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
  .opp-empty { font-size: 11px; color: #d1d5db; }
  .opp-legend { font-size: 10px; color: #9ca3af; margin: 8px 0 0; }
</style>
