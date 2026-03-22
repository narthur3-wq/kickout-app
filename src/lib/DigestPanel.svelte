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

  // Momentum sentence
  $: momentumLine = (() => {
    const scores = filtered
      .filter(e => e.event_type === 'shot' && SHOT_SCORED.has((e.outcome||'').toLowerCase()))
      .sort((a, b) => (a.created_at||'').localeCompare(b.created_at||''));
    if (scores.length < 3) return null;
    const last = scores.slice(-6);
    const usCount   = last.filter(e => (e.direction||'ours') === 'ours').length;
    const themCount = last.length - usCount;
    if (usCount === last.length) return `We scored the last ${last.length} scores.`;
    if (themCount === last.length) return `They scored the last ${last.length} scores.`;
    if (themCount > usCount) return `They scored ${themCount} of the last ${last.length} scores.`;
    if (usCount > themCount) return `We scored ${usCount} of the last ${last.length} scores.`;
    return null;
  })();

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
    // Turnover net
    const toUsWon   = ourTurnovers.filter(e => (e.outcome||'').toLowerCase() === 'won').length;
    const toThemWon = theirTurnovers.filter(e => (e.outcome||'').toLowerCase() === 'won').length;
    const net = toUsWon - toThemWon;
    if (Math.abs(net) >= 2) {
      bullets.push(net > 0 ? `Turnover battle: us +${net}` : `Turnover battle: them +${Math.abs(net)}`);
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

    <!-- Score block -->
    <div class="score-block {margin > 0 ? 'ahead' : margin < 0 ? 'behind' : 'level'}">
      <div class="score-side">
        <div class="score-team">{matchCtx?.team || 'Us'}</div>
        <div class="score-val">{scoreUs.goals}-{String(scoreUs.points).padStart(2,'0')}</div>
        <div class="score-total">({scoreUs.total})</div>
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
        <div class="score-val">{scoreThem.goals}-{String(scoreThem.points).padStart(2,'0')}</div>
        <div class="score-total">({scoreThem.total})</div>
      </div>
    </div>

    <!-- Kickout battle -->
    {#if koUs.n > 0 || koThem.n > 0}
      <div class="section-card">
        <div class="section-hd">Kickout Battle</div>
        <div class="ko-row">
          <span class="ko-label">Our kickouts</span>
          <span class="ko-stat">{koUs.won}/{koUs.n}</span>
          <span class="ko-pct">{koUs.pct !== null ? koUs.pct + '%' : '–'}</span>
        </div>
        <div class="ko-row">
          <span class="ko-label">Their kickouts</span>
          <span class="ko-stat">{koThem.won}/{koThem.n}</span>
          <span class="ko-pct">{koThem.pct !== null ? koThem.pct + '%' : '–'}</span>
        </div>
      </div>
    {/if}

    <!-- Shots -->
    {#if ourShots.length > 0 || theirShots.length > 0}
      <div class="two-col">
        <div class="section-card">
          <div class="section-hd">Our Shots</div>
          {#if shotUs2.goalChances > 0}
            <div class="shot-row"><span>Goal chances</span><strong>{shotUs2.goalScored}/{shotUs2.goalChances}</strong></div>
          {/if}
          {#if shotUs2.pointChances > 0}
            <div class="shot-row"><span>Point attempts</span><strong>{shotUs2.pointScored}/{shotUs2.pointChances}</strong></div>
          {/if}
          <div class="shot-row total-row"><span>Overall</span><strong>{shotUs2.pct !== null ? shotUs2.pct + '%' : '–'} <small>({shotUs2.scored}/{shotUs2.total})</small></strong></div>
        </div>
        <div class="section-card">
          <div class="section-hd">Their Shots</div>
          {#if shotThem2.goalChances > 0}
            <div class="shot-row"><span>Goal chances</span><strong>{shotThem2.goalScored}/{shotThem2.goalChances}</strong></div>
          {/if}
          {#if shotThem2.pointChances > 0}
            <div class="shot-row"><span>Point attempts</span><strong>{shotThem2.pointScored}/{shotThem2.pointChances}</strong></div>
          {/if}
          <div class="shot-row total-row"><span>Overall</span><strong>{shotThem2.pct !== null ? shotThem2.pct + '%' : '–'} <small>({shotThem2.scored}/{shotThem2.total})</small></strong></div>
        </div>
      </div>
    {/if}

    <!-- Momentum -->
    {#if momentumLine}
      <div class="momentum-card">{momentumLine}</div>
    {/if}

    <!-- Watch -->
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

  .score-block { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 24px 20px; border-radius: 14px; border: 1px solid rgba(0,0,0,0.08); }
  .score-block.ahead { background: #dcfce7; }
  .score-block.behind { background: #fee2e2; }
  .score-block.level { background: #fef9c3; }
  .score-side { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .score-team { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  .score-val { font-size: 36px; font-weight: 900; color: #111827; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
  .score-total { font-size: 14px; font-weight: 600; color: #6b7280; font-variant-numeric: tabular-nums; }
  .score-margin { text-align: center; }
  .margin-label { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 10px; border-radius: 8px; }
  .margin-label.ahead { color: #16a34a; background: rgba(22,163,74,0.12); }
  .margin-label.behind { color: #dc2626; background: rgba(220,38,38,0.12); }
  .margin-label.level { color: #d97706; background: rgba(217,119,6,0.12); }

  .section-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
  .section-hd { font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #6b7280; margin-bottom: 12px; }

  .ko-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
  .ko-row:last-child { border-bottom: none; }
  .ko-label { flex: 1; }
  .ko-stat { font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
  .ko-pct { font-weight: 900; font-size: 15px; color: #111827; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .shot-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; font-size: 13px; color: #4b5563; border-bottom: 1px solid #f3f4f6; }
  .shot-row:last-child { border-bottom: none; }
  .shot-row strong { font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
  .total-row { margin-top: 2px; }
  .total-row span { font-weight: 700; color: #374151; }
  .total-row strong { font-size: 15px; }
  small { font-size: 11px; color: #9ca3af; font-weight: 400; }

  .momentum-card { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1e3a5f; }

  .watch-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .watch-list li { font-size: 13px; color: #374151; padding-left: 14px; position: relative; line-height: 1.4; }
  .watch-list li::before { content: '→'; position: absolute; left: 0; color: #9ca3af; font-weight: 700; }

  @media (max-width: 480px) {
    .score-val { font-size: 28px; }
    .two-col { grid-template-columns: 1fr; }
  }
</style>
