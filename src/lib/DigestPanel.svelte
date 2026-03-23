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

  $: koUs   = koStat(ourKickouts);
  $: koThem = koStat(theirKickouts);

  // Match context (most recent match in filtered set)
  $: matchCtx = (() => {
    if (!filtered.length) return null;
    const sorted = [...filtered].sort((a, b) =>
      (b.match_date || b.created_at || '').localeCompare(a.match_date || a.created_at || ''));
    const last = sorted[0];
    return { team: last.team, opp: last.opponent, date: last.match_date };
  })();

  // Score computation
  $: scoreUs = (() => {
    const goals  = ourShots.filter(e => (e.outcome||'').toLowerCase() === 'goal').length;
    const points = ourShots.filter(e => (e.outcome||'').toLowerCase() === 'point').length;
    return { goals, points, total: goals * 3 + points };
  })();
  $: scoreThem = (() => {
    const goals  = theirShots.filter(e => (e.outcome||'').toLowerCase() === 'goal').length;
    const points = theirShots.filter(e => (e.outcome||'').toLowerCase() === 'point').length;
    return { goals, points, total: goals * 3 + points };
  })();
  $: margin = scoreUs.total - scoreThem.total;

  // Shot type breakdown
  function isGoalChance(e) {
    const o = (e.outcome || '').toLowerCase();
    if (o === 'goal' || o === 'saved') return true;
    if (o === 'point') return false;
    // Wide or Blocked: use shot_type if available, default to point attempt
    return e.shot_type === 'goal';
  }
  $: shotBreakdown = (evs) => {
    const goalCh = evs.filter(isGoalChance);
    const pointCh = evs.filter(e => !isGoalChance(e));
    const gcScored = goalCh.filter(e => (e.outcome||'').toLowerCase() === 'goal').length;
    const ptScored = pointCh.filter(e => (e.outcome||'').toLowerCase() === 'point').length;
    const total = evs.length;
    const scored = gcScored + ptScored;
    return {
      goalChances: goalCh.length, goalScored: gcScored,
      pointChances: pointCh.length, pointScored: ptScored,
      total, scored,
      pct: total ? Math.round(100 * scored / total) : null
    };
  };
  $: shotUs2   = shotBreakdown(ourShots);
  $: shotThem2 = shotBreakdown(theirShots);

  // Momentum
  $: momentum = (() => {
    const scores = filtered
      .filter(e => e.event_type === 'shot' && SHOT_SCORED.has((e.outcome||'').toLowerCase()))
      .sort((a, b) => (a.created_at||'').localeCompare(b.created_at||''));
    if (scores.length < 3) return { hasEnoughData: false, line: null, direction: 'neutral' };
    const last = scores.slice(-6);
    const usCount   = last.filter(e => (e.direction||'ours') === 'ours').length;
    const themCount = last.length - usCount;
    if (usCount === last.length) return { hasEnoughData: true, line: `We scored the last ${last.length} scores.`, direction: 'positive' };
    if (themCount === last.length) return { hasEnoughData: true, line: `They scored the last ${last.length} scores.`, direction: 'negative' };
    if (usCount > themCount) return { hasEnoughData: true, line: `We scored ${usCount} of the last ${last.length} scores.`, direction: 'positive' };
    if (themCount > usCount) return { hasEnoughData: true, line: `They scored ${themCount} of the last ${last.length} scores.`, direction: 'negative' };
    return { hasEnoughData: true, line: null, direction: 'neutral' };
  })();

  // Turnover net
  // "We won N of their turnovers" = direction=theirs AND outcome='lost' (they lost the ball)
  // "They won N of ours"          = direction=ours  AND outcome='lost' (we lost the ball)
  $: turnoverNet = (() => {
    const theirLost = theirTurnovers.filter(e => (e.outcome||'').toLowerCase() === 'lost').length;
    const ourLost   = ourTurnovers.filter(e => (e.outcome||'').toLowerCase() === 'lost').length;
    const net = theirLost - ourLost;
    const hasData = theirTurnovers.length > 0 || ourTurnovers.length > 0;
    return { theirLost, ourLost, net, hasData };
  })();

  // Opposition danger players (their shots grouped by target_player)
  $: dangerPlayers = (() => {
    const map = {};
    for (const e of theirShots) {
      const p = e.target_player;
      if (!p) continue;
      if (!map[p]) map[p] = { player: p, shots: 0, goals: 0, points: 0 };
      map[p].shots++;
      const o = (e.outcome||'').toLowerCase();
      if (o === 'goal')  map[p].goals++;
      if (o === 'point') map[p].points++;
    }
    return Object.values(map)
      .map(d => ({ ...d, scores: d.goals + d.points }))
      .filter(d => d.scores >= 1)
      .sort((a, b) => b.scores - a.scores || b.shots - a.shots)
      .slice(0, 3);
  })();

  $: hasDangerPlayerData = theirShots.some(e => e.target_player);

  // Their kickout targets (theirKickouts grouped by target_player)
  $: theirKoTargets = (() => {
    const map = {};
    for (const e of theirKickouts) {
      const p = e.target_player;
      if (!p) continue;
      if (!map[p]) map[p] = { player: p, times: 0, retained: 0 };
      map[p].times++;
      if (KO_RETAINED.has((e.outcome||'').toLowerCase())) map[p].retained++;
    }
    return Object.values(map)
      .sort((a, b) => b.times - a.times)
      .slice(0, 3)
      .map(d => ({ ...d, retPct: d.times ? Math.round(100 * d.retained / d.times) : null }));
  })();

  $: hasKoTargetData = theirKickouts.some(e => e.target_player);

  // Watch bullets (plain English)
  $: watchBullets = (() => {
    const bullets = [];
    // Opp kickout zone tendency
    if (theirKickouts.length >= 3) {
      const zoneCounts = {};
      for (const e of theirKickouts) {
        const z = e.zone_code; if (!z) continue;
        zoneCounts[z] = (zoneCounts[z] || 0) + 1;
      }
      const top = Object.entries(zoneCounts).sort((a,b) => b[1]-a[1])[0];
      if (top) {
        const pct = Math.round(100 * top[1] / theirKickouts.length);
        if (pct >= 25) bullets.push(`Their kickouts favour ${top[0]} — ${pct}% of kicks`);
      }
    }
    // Top target player on their kickouts
    if (theirKickouts.length >= 3) {
      const playerCounts = {};
      for (const e of theirKickouts) {
        const p = e.target_player; if (!p) continue;
        playerCounts[p] = (playerCounts[p] || 0) + 1;
      }
      const top = Object.entries(playerCounts).sort((a,b) => b[1]-a[1])[0];
      if (top && top[1] >= 2) bullets.push(`#${top[0]} their main kickout target — ${top[1]} times`);
    }
    return bullets;
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
</script>

<div class="digest" bind:this={digestEl}>

  {#if filtered.length === 0}
    <!-- Empty state -->
    <div class="empty">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No events yet{periodFilter !== 'ALL' ? ' · ' + periodFilter : ''}</div>
      <div class="empty-sub">Switch to the Capture tab to start logging match events.</div>
    </div>

  {:else}

    <!-- Match context bar -->
    {#if matchCtx?.team || matchCtx?.opp}
      <div class="ctx-bar">
        <span class="ctx-teams">{matchCtx.team || '?'} <span class="ctx-vs">vs</span> {matchCtx.opp || '?'}</span>
        {#if matchCtx.date}<span class="ctx-date">{matchCtx.date}</span>{/if}
        <span class="ctx-sep">·</span>
        <span class="ctx-period">{periodFilter !== 'ALL' ? periodFilter : 'Full match'}</span>
        <button class="share-btn" on:click={shareDigest} disabled={sharing}>{sharing ? '…' : '⬆ Share'}</button>
      </div>
    {/if}

    <!-- 1. Score block (hero) -->
    <div class="score-block {margin > 0 ? 'ahead' : margin < 0 ? 'behind' : 'level'}">
      <div class="score-side">
        <div class="score-team">{matchCtx?.team || 'Us'}</div>
        <div class="score-val">{scoreUs.goals}–{String(scoreUs.points).padStart(2,'0')}</div>
        <div class="score-total">{scoreUs.total} pts</div>
      </div>
      <div class="score-margin">
        {#if margin === 0}
          <span class="margin-label level">Level</span>
        {:else}
          <span class="margin-label {margin > 0 ? 'ahead' : 'behind'}">
            {margin > 0 ? `Up ${margin}` : `Down ${Math.abs(margin)}`}
          </span>
        {/if}
      </div>
      <div class="score-side">
        <div class="score-team">{matchCtx?.opp || 'Them'}</div>
        <div class="score-val">{scoreThem.goals}–{String(scoreThem.points).padStart(2,'0')}</div>
        <div class="score-total">{scoreThem.total} pts</div>
      </div>
    </div>

    <!-- 2. Kickout battle -->
    {#if koUs.n > 0 || koThem.n > 0}
      <div class="section-card">
        <div class="section-hd">Kickout Battle</div>
        {#each [{ label: 'Our kickouts', s: koUs }, { label: 'Their kickouts', s: koThem }] as row}
          <div class="ko-row">
            <span class="ko-label">{row.label}</span>
            <span class="ko-stat">{row.s.won}/{row.s.n}</span>
            <span class="ko-pct">{row.s.pct !== null ? row.s.pct + '%' : '–'}</span>
          </div>
          {#if row.s.n > 0}
            <div class="ko-bar-wrap">
              <div class="ko-bar-fill" style="width:{row.s.pct ?? 0}%"></div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- 3. Shot efficiency — both sides always shown side by side -->
    {#if ourShots.length > 0 || theirShots.length > 0}
      <div class="section-card">
        <div class="section-hd">Shot Efficiency</div>
        <div class="shot-compare">
          <!-- Our shots -->
          <div class="shot-col">
            <div class="shot-col-hd">{matchCtx?.team || 'Us'}</div>
            {#if ourShots.length === 0}
              <div class="shot-empty">—</div>
            {:else}
              <div class="shot-big">{shotUs2.pct !== null ? shotUs2.pct + '%' : '—'}</div>
              <div class="shot-sub">{shotUs2.scored}/{shotUs2.total} scored</div>
              <div class="shot-gc">
                Goal ch: {shotUs2.goalChances > 0 ? `${shotUs2.goalScored}/${shotUs2.goalChances}` : '—'}
              </div>
            {/if}
          </div>
          <div class="shot-divider"></div>
          <!-- Their shots -->
          <div class="shot-col">
            <div class="shot-col-hd">{matchCtx?.opp || 'Them'}</div>
            {#if theirShots.length === 0}
              <div class="shot-empty">—</div>
            {:else}
              <div class="shot-big">{shotThem2.pct !== null ? shotThem2.pct + '%' : '—'}</div>
              <div class="shot-sub">{shotThem2.scored}/{shotThem2.total} scored</div>
              <div class="shot-gc">
                Goal ch: {shotThem2.goalChances > 0 ? `${shotThem2.goalScored}/${shotThem2.goalChances}` : '—'}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- 4. Momentum -->
    <div class="section-card momentum-section momentum-{momentum.direction}">
      <div class="section-hd">Momentum</div>
      {#if !momentum.hasEnoughData}
        <p class="momentum-insufficient">Not enough scores logged to assess momentum.</p>
      {:else if momentum.line}
        <p class="momentum-line">{momentum.line}</p>
      {:else}
        <p class="momentum-line">Momentum is evenly balanced.</p>
      {/if}
    </div>

    <!-- 5. Turnover net -->
    {#if turnoverNet.hasData}
      <div class="section-card">
        <div class="section-hd">Turnovers</div>
        <div class="to-row">
          <span class="to-label">Turnovers</span>
          <span class="to-net {turnoverNet.net > 0 ? 'net-pos' : turnoverNet.net < 0 ? 'net-neg' : 'net-even'}">
            Net {turnoverNet.net > 0 ? '+' : ''}{turnoverNet.net}
          </span>
          <span class="to-detail">won {turnoverNet.theirLost}, lost {turnoverNet.ourLost}</span>
        </div>
      </div>
    {/if}

    <!-- 6. Their danger players -->
    {#if hasDangerPlayerData && dangerPlayers.length > 0}
      <div class="section-card danger-card">
        <div class="section-hd">Their danger players</div>
        {#each dangerPlayers as p}
          <div class="dp-row">
            <span class="dp-num">#{p.player}</span>
            <span class="dp-scores">{p.scores} score{p.scores !== 1 ? 's' : ''}</span>
            <span class="dp-breakdown">({p.goals}G {p.points}P)</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- 7. Their kickout targets -->
    {#if hasKoTargetData && theirKoTargets.length > 0}
      <div class="section-card">
        <div class="section-hd">Their kickout targets</div>
        {#each theirKoTargets as t}
          <div class="kot-row">
            <span class="kot-num">#{t.player}</span>
            <span class="kot-times">{t.times} time{t.times !== 1 ? 's' : ''}</span>
            <span class="kot-ret">{t.retPct !== null ? t.retPct + '% retention' : '—'}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- 8. Watch bullets -->
    {#if watchBullets.length > 0}
      <div class="section-card">
        <div class="section-hd">Watch</div>
        <ul class="watch-list">
          {#each watchBullets as b}
            <li>{b}</li>
          {/each}
        </ul>
      </div>
    {/if}

  {/if}
</div>

<style>
  .digest { display: flex; flex-direction: column; gap: 12px; }

  .empty { text-align: center; padding: 56px 24px; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; }
  .empty-icon { font-size: 36px; margin-bottom: 12px; }
  .empty-title { font-size: 16px; font-weight: 700; color: #374151; margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: #9ca3af; }

  .ctx-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; padding: 10px 14px; font-size: 13px; }
  .ctx-teams { font-weight: 700; color: #111827; }
  .ctx-vs { font-weight: 400; color: #9ca3af; margin: 0 3px; }
  .ctx-date { color: #6b7280; }
  .ctx-sep { color: #d1d5db; }
  .ctx-period { font-size: 12px; color: #9ca3af; }
  .share-btn { margin-left: auto; padding: 5px 12px; border-radius: 7px; font-size: 12px; font-weight: 700; border: 1.5px solid #1c3f8a; background: #1c3f8a; color: #fff; cursor: pointer; font-family: inherit; flex-shrink: 0; }
  .share-btn:disabled { opacity: 0.5; cursor: default; }

  /* Score block — hero element */
  .score-block { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 28px 20px; border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); }
  .score-block.ahead { background: #dcfce7; }
  .score-block.behind { background: #fee2e2; }
  .score-block.level { background: #fef9c3; }
  .score-side { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .score-team { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  .score-val { font-size: 48px; font-weight: 900; color: #111827; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
  .score-total { font-size: 13px; font-weight: 600; color: #6b7280; font-variant-numeric: tabular-nums; }
  .score-margin { text-align: center; }
  .margin-label { display: block; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 14px; border-radius: 10px; white-space: nowrap; }
  .margin-label.ahead { color: #16a34a; background: rgba(22,163,74,0.15); }
  .margin-label.behind { color: #dc2626; background: rgba(220,38,38,0.15); }
  .margin-label.level { color: #d97706; background: rgba(217,119,6,0.15); }

  .section-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
  .section-hd { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 12px; }

  .ko-row { display: flex; align-items: baseline; gap: 8px; padding: 8px 0 4px; font-size: 13px; color: #374151; }
  .ko-label { flex: 1; }
  .ko-stat { font-weight: 600; color: #6b7280; font-variant-numeric: tabular-nums; font-size: 12px; }
  .ko-pct { font-weight: 900; font-size: 20px; color: #111827; font-variant-numeric: tabular-nums; min-width: 48px; text-align: right; }
  .ko-bar-wrap { height: 5px; background: #f3f4f6; border-radius: 99px; margin-bottom: 10px; overflow: hidden; }
  .ko-bar-fill { height: 100%; background: #1c3f8a; border-radius: 99px; transition: width 0.4s ease; }

  /* Shot efficiency — side by side */
  .shot-compare { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0; align-items: start; }
  .shot-col { padding: 0 12px; display: flex; flex-direction: column; gap: 4px; }
  .shot-col:first-child { padding-left: 0; }
  .shot-col:last-child { padding-right: 0; }
  .shot-col-hd { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #9ca3af; margin-bottom: 4px; }
  .shot-big { font-size: 28px; font-weight: 900; color: #111827; font-variant-numeric: tabular-nums; line-height: 1; }
  .shot-sub { font-size: 12px; color: #6b7280; font-variant-numeric: tabular-nums; }
  .shot-gc { font-size: 12px; color: #9ca3af; }
  .shot-empty { font-size: 22px; font-weight: 700; color: #d1d5db; padding: 4px 0; }
  .shot-divider { width: 1px; background: #e5e7eb; align-self: stretch; margin: 0; }

  .momentum-section { }
  .momentum-positive { background: rgba(22, 163, 74, 0.08); border-left: 3px solid #16a34a; }
  .momentum-negative { background: rgba(220, 38, 38, 0.08); border-left: 3px solid #dc2626; }
  .momentum-neutral { }
  .momentum-line { margin: 0; font-size: 14px; font-weight: 700; color: #111827; line-height: 1.4; }
  .momentum-insufficient { margin: 0; font-size: 13px; color: #9ca3af; font-style: italic; line-height: 1.4; }

  /* Turnovers */
  .to-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
  .to-label { font-weight: 600; color: #374151; }
  .to-net { font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; padding: 3px 8px; border-radius: 6px; }
  .net-pos { color: #16a34a; background: rgba(22,163,74,0.12); }
  .net-neg { color: #dc2626; background: rgba(220,38,38,0.12); }
  .net-even { color: #d97706; background: rgba(217,119,6,0.12); }
  .to-detail { font-size: 12px; color: #9ca3af; font-variant-numeric: tabular-nums; }

  /* Danger players */
  .danger-card { border-left: 3px solid #ef4444; }
  .dp-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .dp-row:last-child { border-bottom: none; padding-bottom: 0; }
  .dp-num { font-weight: 900; color: #111827; min-width: 32px; }
  .dp-scores { font-weight: 700; color: #374151; flex: 1; }
  .dp-breakdown { font-size: 12px; color: #9ca3af; font-variant-numeric: tabular-nums; }

  /* Kickout targets */
  .kot-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .kot-row:last-child { border-bottom: none; padding-bottom: 0; }
  .kot-num { font-weight: 900; color: #111827; min-width: 32px; }
  .kot-times { font-weight: 600; color: #374151; flex: 1; }
  .kot-ret { font-size: 12px; color: #9ca3af; font-variant-numeric: tabular-nums; }

  .watch-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .watch-list li { font-size: 13px; color: #374151; padding-left: 14px; position: relative; line-height: 1.4; }
  .watch-list li::before { content: '→'; position: absolute; left: 0; color: #9ca3af; font-weight: 700; }

  @media (max-width: 480px) {
    .score-val { font-size: 36px; }
    .shot-big { font-size: 22px; }
  }
</style>
