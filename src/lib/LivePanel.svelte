<script>
  import { createEventDispatcher } from 'svelte';
  import { buildLiveInsights } from './liveInsights.js';

  export let events = [];
  export let teamName = 'Us';
  export let opponentName = 'Them';
  export let phaseLabel = 'Match';

  const dispatch = createEventDispatcher();
  const POSITIVE_KO = new Set(['retained', 'score', 'won']);

  function koStat(evs) {
    const total = evs.length;
    const won = evs.filter((event) => POSITIVE_KO.has(String(event.outcome || '').toLowerCase())).length;
    return { total, won, pct: total ? Math.round((100 * won) / total) : null };
  }

  function scoreStat(evs) {
    const goals = evs.filter((event) => String(event.outcome || '').toLowerCase() === 'goal').length;
    const points = evs.filter((event) => String(event.outcome || '').toLowerCase() === 'point').length;
    return { goals, points, total: goals * 3 + points };
  }

  $: insights = buildLiveInsights(events);
  $: ourKickouts = events.filter((event) => (event.event_type || 'kickout') === 'kickout' && (event.direction || 'ours') === 'ours');
  $: theirKickouts = events.filter((event) => (event.event_type || 'kickout') === 'kickout' && (event.direction || 'ours') === 'theirs');
  $: ourScores = scoreStat(events.filter((event) => (event.event_type || 'kickout') === 'shot' && (event.direction || 'ours') === 'ours'));
  $: theirScores = scoreStat(events.filter((event) => (event.event_type || 'kickout') === 'shot' && (event.direction || 'ours') === 'theirs'));
  $: ourKickoutStat = koStat(ourKickouts);
  $: theirKickoutStat = koStat(theirKickouts);
  $: scoreMargin = ourScores.total - theirScores.total;

  function markerLabel(item, type) {
    if (type === 'score') return item.label;
    return item.team === 'ours' ? 'U' : 'T';
  }

  function markerClass(item, type) {
    if (type === 'score') return item.team === 'ours' ? 'ours' : 'theirs';
    return item.controller === 'ours' ? 'ours' : 'theirs';
  }
</script>

<section class="live-shell">
  <div class="live-grid">
    <section class="hero-card">
      <div class="eyebrow">Live Match State</div>
      <div class="hero-topline">{phaseLabel}</div>
      <div class="score-row">
        <div class="score-side">
          <span class="score-team">{teamName || 'Us'}</span>
          <span class="score-value">{ourScores.goals}-{ourScores.points}</span>
        </div>
        <div class="score-gap {scoreMargin > 0 ? 'ahead' : scoreMargin < 0 ? 'behind' : 'level'}">
          {#if scoreMargin === 0}
            Level
          {:else if scoreMargin > 0}
            Up {scoreMargin}
          {:else}
            Down {Math.abs(scoreMargin)}
          {/if}
        </div>
        <div class="score-side">
          <span class="score-team">{opponentName || 'Them'}</span>
          <span class="score-value">{theirScores.goals}-{theirScores.points}</span>
        </div>
      </div>
      <div class="ko-snapshot">
        <div class="snapshot-pill">
          <span class="snapshot-label">Our kickouts</span>
          <span class="snapshot-value">{ourKickoutStat.pct ?? '-'}%</span>
          <span class="snapshot-sub">{ourKickoutStat.won}/{ourKickoutStat.total}</span>
        </div>
        <div class="snapshot-pill">
          <span class="snapshot-label">Their kickouts</span>
          <span class="snapshot-value">{theirKickoutStat.pct ?? '-'}%</span>
          <span class="snapshot-sub">{theirKickoutStat.won}/{theirKickoutStat.total}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="eyebrow">Recent Momentum</div>
      <div class="momentum-block">
        <div class="mini-title">Recent scores</div>
        <div class="marker-row">
          {#if insights.scoreMomentum.items.length === 0}
            <span class="empty-copy">No scoring events yet.</span>
          {:else}
            {#each insights.scoreMomentum.items as item (item.id)}
              <span class="marker score {markerClass(item, 'score')}" title={item.clock || item.label}>{markerLabel(item, 'score')}</span>
            {/each}
          {/if}
        </div>
        <p class="summary-line {insights.scoreMomentum.tone}">{insights.scoreMomentum.line}</p>
      </div>
      <div class="momentum-block">
        <div class="mini-title">Recent kickout battle</div>
        <div class="marker-row">
          {#if insights.kickoutMomentum.items.length === 0}
            <span class="empty-copy">No kickout events yet.</span>
          {:else}
            {#each insights.kickoutMomentum.items as item (item.id)}
              <span class="marker battle {markerClass(item, 'kickout')}" title={item.lane}>{markerLabel(item, 'kickout')}</span>
            {/each}
          {/if}
        </div>
        <p class="summary-line {insights.kickoutMomentum.tone}">{insights.kickoutMomentum.line}</p>
      </div>
    </section>

    <section class="card">
      <div class="eyebrow">Flow Of The {phaseLabel.startsWith('Match') ? 'Match' : phaseLabel}</div>
      <div class="flow-block">
        <div class="mini-title">Score flow</div>
        <div class="flow-row">
          {#if insights.flow.scoreItems.length === 0}
            <span class="empty-copy">No score flow yet.</span>
          {:else}
            {#each insights.flow.scoreItems as item (item.id)}
              <span class="marker score flow {item.team === 'ours' ? 'ours' : 'theirs'}" title={item.clock || item.label}>{item.label}</span>
            {/each}
          {/if}
        </div>
      </div>
      <div class="flow-block">
        <div class="mini-title">Kickout flow</div>
        <div class="flow-row">
          {#if insights.flow.kickoutItems.length === 0}
            <span class="empty-copy">No kickout flow yet.</span>
          {:else}
            {#each insights.flow.kickoutItems as item (item.id)}
              <span class="marker battle flow {item.controller === 'ours' ? 'ours' : 'theirs'}" title={item.lane}>{item.team === 'ours' ? 'U' : 'T'}</span>
            {/each}
          {/if}
        </div>
      </div>
      <div class="flow-lines">
        {#if insights.flow.lines.length === 0}
          <p class="empty-copy">Not enough data to describe the flow yet.</p>
        {:else}
          {#each insights.flow.lines as line (line)}
            <p>{line}</p>
          {/each}
        {/if}
      </div>
    </section>

    <section class="card two-column">
      <div class="eyebrow">Their Kickout Pattern</div>
      <p class="headline-copy">{insights.kickoutPattern.line}</p>
      {#if insights.kickoutPattern.primaryWinner}
        <div class="stat-chip">
          <span class="stat-chip-label">Primary winner</span>
          <span class="stat-chip-value">{insights.kickoutPattern.primaryWinner.label}</span>
          <span class="stat-chip-sub">{insights.kickoutPattern.primaryWinner.total} of {insights.kickoutPattern.wonTotal} successful kickouts</span>
        </div>
      {/if}
      {#if insights.kickoutPattern.primaryTarget}
        <div class="stat-chip">
          <span class="stat-chip-label">Most targeted</span>
          <span class="stat-chip-value">{insights.kickoutPattern.primaryTarget.label}</span>
          <span class="stat-chip-sub">{insights.kickoutPattern.primaryTarget.total} of {insights.kickoutPattern.total}</span>
        </div>
      {/if}
      {#if insights.kickoutPattern.primaryLane}
        <div class="stat-chip">
          <span class="stat-chip-label">Main lane</span>
          <span class="stat-chip-value">{insights.kickoutPattern.primaryLane.label}</span>
          <span class="stat-chip-sub">{insights.kickoutPattern.primaryLane.pct}% of their restarts</span>
        </div>
      {/if}
      {#if insights.kickoutPattern.trendLine}
        <p class="detail-note">{insights.kickoutPattern.trendLine}</p>
      {/if}
    </section>

    <section class="card two-column">
      <div class="eyebrow">Our Kickout Performance</div>
      <p class="headline-copy">{insights.kickoutPerformance.line}</p>
      <div class="lane-grid">
        {#each insights.kickoutPerformance.laneStats as lane (lane.key)}
          <div class="lane-row">
            <span class="lane-name">{lane.label}</span>
            <span class="lane-pct">{lane.pct ?? '-'}%</span>
            <span class="lane-sub">{lane.win}/{lane.total}</span>
          </div>
        {/each}
      </div>
      {#if insights.kickoutPerformance.recentWarning}
        <p class="detail-note warning">{insights.kickoutPerformance.recentWarning}</p>
      {/if}
    </section>

    <section class="card two-column">
      <div class="eyebrow">Main Threat</div>
      <p class="headline-copy">{insights.threat.line}</p>
      {#if insights.threat.mainThreat}
        <div class="stat-chip">
          <span class="stat-chip-label">Top scorer</span>
          <span class="stat-chip-value">{insights.threat.mainThreat.label}</span>
          <span class="stat-chip-sub">{insights.threat.mainThreat.points} points from {insights.threat.mainThreat.chances} chances</span>
        </div>
      {/if}
      {#if insights.threat.channelThreat}
        <div class="stat-chip">
          <span class="stat-chip-label">Danger side</span>
          <span class="stat-chip-value">{insights.threat.channelThreat.label}</span>
          <span class="stat-chip-sub">{insights.threat.channelThreat.chances} chances</span>
        </div>
      {/if}
      {#if insights.threat.secondaryThreat}
        <p class="detail-note">Secondary threat: {insights.threat.secondaryThreat.label} has {insights.threat.secondaryThreat.points} points.</p>
      {/if}
    </section>

    <section class="card two-column">
      <div class="eyebrow">Best Opportunity</div>
      <p class="headline-copy">{insights.opportunity.line}</p>
      {#if insights.opportunity.bestSide}
        <div class="stat-chip">
          <span class="stat-chip-label">Best side</span>
          <span class="stat-chip-value">{insights.opportunity.bestSide.label}</span>
          <span class="stat-chip-sub">{insights.opportunity.bestSide.points} points from {insights.opportunity.bestSide.chances} chances</span>
        </div>
      {/if}
      {#if insights.opportunity.bestLane}
        <div class="stat-chip">
          <span class="stat-chip-label">Best restart lane</span>
          <span class="stat-chip-value">{insights.opportunity.bestLane.label}</span>
          <span class="stat-chip-sub">{insights.opportunity.bestLane.pct}% retention</span>
        </div>
      {/if}
      {#if insights.keepDoing}
        <p class="detail-note positive">{insights.keepDoing}</p>
      {/if}
    </section>

    <section class="card">
      <div class="eyebrow">Top Actions</div>
      {#if insights.recommendations.length === 0}
        <p class="empty-copy">No strong recommendation yet. Keep monitoring the live patterns.</p>
      {:else}
        <div class="actions-list">
          {#each insights.recommendations as recommendation (recommendation.type)}
            <div class="action-card">
              <h3>{recommendation.title}</h3>
              <p>{recommendation.reason}</p>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="card">
      <div class="eyebrow">Deep Analysis</div>
      <p class="headline-copy">Use the detailed tabs when you need to validate the live read or dig deeper into one phase.</p>
      <div class="deep-links">
        <button on:click={() => dispatch('showTab', 'kickouts')}>Kickouts</button>
        <button on:click={() => dispatch('showTab', 'shots')}>Shots</button>
        <button on:click={() => dispatch('showTab', 'turnovers')}>Turnovers</button>
      </div>
    </section>
  </div>
</section>

<style>
  .live-shell {
    padding: 16px;
  }
  .live-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .card,
  .hero-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  }
  .hero-card {
    grid-column: 1 / -1;
    background: linear-gradient(135deg, #0f1923 0%, #13273a 100%);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.08);
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }
  .hero-card .eyebrow,
  .hero-card .hero-topline,
  .hero-card .score-team,
  .hero-card .snapshot-label,
  .hero-card .snapshot-sub {
    color: rgba(255, 255, 255, 0.72);
  }
  .hero-topline {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
  }
  .score-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 18px;
    align-items: center;
    margin-top: 18px;
  }
  .score-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .score-team {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }
  .score-value {
    font-size: 48px;
    font-weight: 900;
    line-height: 1;
  }
  .score-gap {
    padding: 10px 14px;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.1);
  }
  .score-gap.ahead { color: #86efac; }
  .score-gap.behind { color: #fca5a5; }
  .score-gap.level { color: #fde68a; }
  .ko-snapshot {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }
  .snapshot-pill {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .snapshot-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .snapshot-value {
    font-size: 28px;
    font-weight: 900;
    color: #fff;
  }
  .snapshot-sub {
    font-size: 12px;
    font-weight: 600;
  }
  .mini-title {
    font-size: 12px;
    font-weight: 800;
    color: #111827;
    margin-bottom: 8px;
  }
  .momentum-block + .momentum-block,
  .flow-block + .flow-block {
    margin-top: 14px;
  }
  .marker-row,
  .flow-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .marker {
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
  }
  .marker.flow {
    min-width: 24px;
    height: 24px;
    font-size: 10px;
  }
  .marker.ours {
    background: #1d4ed8;
  }
  .marker.theirs {
    background: #c2410c;
  }
  .summary-line,
  .headline-copy,
  .detail-note,
  .flow-lines p,
  .empty-copy {
    margin: 10px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: #475569;
  }
  .summary-line.positive,
  .detail-note.positive {
    color: #166534;
  }
  .summary-line.negative,
  .detail-note.warning {
    color: #b91c1c;
  }
  .flow-lines {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .two-column {
    min-height: 220px;
  }
  .stat-chip {
    margin-top: 12px;
    padding: 12px;
    border-radius: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-chip-label {
    font-size: 11px;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .stat-chip-value {
    font-size: 18px;
    font-weight: 900;
    color: #0f172a;
  }
  .stat-chip-sub {
    font-size: 12px;
    color: #475569;
  }
  .lane-grid {
    margin-top: 12px;
    display: grid;
    gap: 8px;
  }
  .lane-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .lane-name {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    text-transform: capitalize;
  }
  .lane-pct {
    font-size: 18px;
    font-weight: 900;
    color: #1d4ed8;
  }
  .lane-sub {
    font-size: 12px;
    color: #64748b;
  }
  .actions-list {
    margin-top: 12px;
    display: grid;
    gap: 10px;
  }
  .action-card {
    padding: 14px;
    border-radius: 12px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }
  .action-card h3 {
    margin: 0;
    font-size: 15px;
    color: #1e3a8a;
  }
  .action-card p {
    margin: 6px 0 0;
    font-size: 13px;
    color: #334155;
    line-height: 1.5;
  }
  .deep-links {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .deep-links button {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #1e3a8a;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
  .deep-links button:hover {
    background: #eff6ff;
  }

  @media (max-width: 900px) {
    .live-grid {
      grid-template-columns: 1fr;
    }
    .two-column {
      min-height: 0;
    }
  }
</style>
