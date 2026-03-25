<script>
  import { buildLiveInsights } from './liveInsights.js';

  export let events = [];
  export let teamName = 'Us';
  export let opponentName = 'Them';
  export let phaseLabel = 'Match';

  const POSITIVE_KO = new Set(['retained', 'score', 'won']);
  let digestEl;
  let sharing = false;
  let shareFeedback = null;

  function scoreStat(evs) {
    const goals = evs.filter((event) => String(event.outcome || '').toLowerCase() === 'goal').length;
    const points = evs.filter((event) => String(event.outcome || '').toLowerCase() === 'point').length;
    return { goals, points, total: goals * 3 + points };
  }

  function koStat(evs) {
    const total = evs.length;
    const won = evs.filter((event) => POSITIVE_KO.has(String(event.outcome || '').toLowerCase())).length;
    return { total, won, pct: total ? Math.round((100 * won) / total) : null };
  }

  $: insights = buildLiveInsights(events);
  $: ourScores = scoreStat(events.filter((event) => (event.event_type || 'kickout') === 'shot' && (event.direction || 'ours') === 'ours'));
  $: theirScores = scoreStat(events.filter((event) => (event.event_type || 'kickout') === 'shot' && (event.direction || 'ours') === 'theirs'));
  $: ourKickouts = koStat(events.filter((event) => (event.event_type || 'kickout') === 'kickout' && (event.direction || 'ours') === 'ours'));
  $: theirKickouts = koStat(events.filter((event) => (event.event_type || 'kickout') === 'kickout' && (event.direction || 'ours') === 'theirs'));
  $: scoreMargin = ourScores.total - theirScores.total;

  async function shareDigest() {
    if (sharing) return;
    sharing = true;
    shareFeedback = null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(digestEl, { backgroundColor: '#eef3ee', scale: 2, useCORS: true });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error('Could not generate digest image.'));
        }, 'image/png');
      });
      const file = new File([blob], 'pairc-digest.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Pairc Digest' });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'pairc-digest.png';
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Digest share failed', error);
      if (error?.name === 'AbortError') {
        shareFeedback = { type: 'info', message: 'Share cancelled.' };
      } else {
        shareFeedback = {
          type: 'error',
          message: 'Could not generate the digest image on this device. Try again or use the browser download flow.',
        };
      }
    } finally {
      sharing = false;
    }
  }
</script>

<div class="digest-shell" bind:this={digestEl}>
  {#if events.length === 0}
    <section class="empty-card">
      <div class="empty-title">No events yet for this digest.</div>
      <div class="empty-sub">Capture your first few kickouts, shots, or turnovers to build a coach-ready read for {phaseLabel}.</div>
    </section>
  {:else}
    <section class="digest-header">
      <div>
        <div class="eyebrow">Coach Digest</div>
        <h2>{teamName || 'Us'} vs {opponentName || 'Them'}</h2>
        <p>{phaseLabel} summary built for a 3-minute team talk.</p>
      </div>
      <button class="share-btn" on:click={shareDigest} disabled={sharing}>
        {sharing ? 'Preparing...' : 'Share image'}
      </button>
    </section>

    {#if shareFeedback}
      <div class="share-feedback share-feedback-{shareFeedback.type}">
        {shareFeedback.message}
      </div>
    {/if}

    <section class="hero-card">
      <div class="hero-team">
        <span class="hero-label">{teamName || 'Us'}</span>
        <span class="hero-score">{ourScores.goals}-{ourScores.points}</span>
      </div>
      <div class="hero-margin {scoreMargin > 0 ? 'ahead' : scoreMargin < 0 ? 'behind' : 'level'}">
        {#if scoreMargin === 0}
          Level
        {:else if scoreMargin > 0}
          Up {scoreMargin}
        {:else}
          Down {Math.abs(scoreMargin)}
        {/if}
      </div>
      <div class="hero-team">
        <span class="hero-label">{opponentName || 'Them'}</span>
        <span class="hero-score">{theirScores.goals}-{theirScores.points}</span>
      </div>
      <div class="restart-strip">
        <div class="restart-pill">
          <span>Our kickouts</span>
          <strong>{ourKickouts.pct ?? '-'}%</strong>
          <small>{ourKickouts.won}/{ourKickouts.total}</small>
        </div>
        <div class="restart-pill">
          <span>Their kickouts</span>
          <strong>{theirKickouts.pct ?? '-'}%</strong>
          <small>{theirKickouts.won}/{theirKickouts.total}</small>
        </div>
      </div>
    </section>

    <div class="digest-grid">
      <section class="card">
        <div class="eyebrow">Flow Read</div>
        {#if insights.flow.coachLines.length === 0}
          <p class="copy">Not enough data yet to describe the flow with confidence.</p>
        {:else}
          {#each insights.flow.coachLines as line (line)}
            <p class="copy">{line}</p>
          {/each}
        {/if}
      </section>

      <section class="card">
        <div class="eyebrow">Main Threat</div>
        <p class="copy strong">{insights.threat.line}</p>
        {#if insights.threat.mainThreat}
          <p class="detail">{insights.threat.mainThreat.label}: {insights.threat.mainThreat.points} points from {insights.threat.mainThreat.chances} chances.</p>
        {/if}
        {#if insights.threat.channelThreat}
          <p class="detail">Danger side: {insights.threat.channelThreat.label}.</p>
        {/if}
      </section>

      <section class="card">
        <div class="eyebrow">Best Opportunity</div>
        <p class="copy strong">{insights.opportunity.line}</p>
        {#if insights.opportunity.bestSide}
          <p class="detail">{insights.opportunity.bestSide.label} is giving us {insights.opportunity.bestSide.points} points from {insights.opportunity.bestSide.chances} chances.</p>
        {/if}
        {#if insights.opportunity.bestLane}
          <p class="detail">{insights.opportunity.bestLane.label} is retaining at {insights.opportunity.bestLane.pct}%.</p>
        {/if}
      </section>

      <section class="card actions-card">
        <div class="eyebrow">Top 3 Actions</div>
        {#if insights.recommendations.length === 0}
          <p class="copy">No strong tactical change yet. Keep monitoring the half.</p>
        {:else}
          <ol class="actions-list">
            {#each insights.recommendations as recommendation (recommendation.type)}
              <li>
                <span class="action-title">{recommendation.title}</span>
                <span class="action-reason">{recommendation.reason}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      <section class="card keep-card">
        <div class="eyebrow">Keep Doing</div>
        <p class="copy strong">{insights.keepDoing || 'No strong positive reinforcement signal yet - keep decisions simple.'}</p>
      </section>
    </div>
  {/if}
</div>

<style>
  .digest-shell {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .empty-card,
  .digest-header,
  .hero-card,
  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  }
  .empty-card {
    padding: 28px 24px;
    text-align: center;
  }
  .empty-title {
    font-size: 18px;
    font-weight: 800;
    color: #111827;
  }
  .empty-sub {
    margin-top: 8px;
    font-size: 14px;
    color: #64748b;
  }
  .digest-header {
    padding: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .digest-header h2 {
    margin: 6px 0 0;
    font-size: 24px;
    color: #111827;
    letter-spacing: -0.03em;
  }
  .digest-header p {
    margin: 6px 0 0;
    font-size: 13px;
    color: #64748b;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }
  .share-btn {
    border: 1px solid #1d4ed8;
    background: #1d4ed8;
    color: #fff;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    font-family: inherit;
  }
  .share-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .share-feedback {
    margin-top: -2px;
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
  }
  .share-feedback-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
  .share-feedback-info {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
  }
  .hero-card {
    padding: 22px 18px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 14px;
    align-items: center;
    background: linear-gradient(135deg, #f8fafc 0%, #eef4f8 100%);
  }
  .hero-team {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .hero-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }
  .hero-score {
    font-size: 46px;
    font-weight: 900;
    line-height: 1;
    color: #0f172a;
  }
  .hero-margin {
    padding: 10px 14px;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 900;
    text-transform: uppercase;
    text-align: center;
  }
  .hero-margin.ahead { background: #dcfce7; color: #166534; }
  .hero-margin.behind { background: #fee2e2; color: #991b1b; }
  .hero-margin.level { background: #fef3c7; color: #92400e; }
  .restart-strip {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 4px;
  }
  .restart-pill {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid #dbe4ea;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .restart-pill span {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }
  .restart-pill strong {
    font-size: 26px;
    color: #0f172a;
  }
  .restart-pill small {
    font-size: 12px;
    color: #475569;
  }
  .digest-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .card {
    padding: 18px;
  }
  .actions-card,
  .keep-card {
    grid-column: 1 / -1;
  }
  .copy,
  .detail {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: #475569;
  }
  .copy.strong {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }
  .actions-list {
    margin: 12px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 12px;
  }
  .actions-list li {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #0f172a;
  }
  .action-title {
    font-weight: 800;
    font-size: 15px;
  }
  .action-reason {
    font-size: 13px;
    line-height: 1.5;
    color: #475569;
  }

  @media (max-width: 900px) {
    .digest-grid {
      grid-template-columns: 1fr;
    }
    .hero-card {
      grid-template-columns: 1fr;
    }
    .hero-margin {
      justify-self: center;
    }
    .digest-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .share-btn {
      width: 100%;
    }
  }
</style>
