<script>
  import { createEventDispatcher } from 'svelte';
  export let summaryStats = null;
  export let title = 'Summary';
  export let subtitle = '';
  const dispatch = createEventDispatcher();

  function retColor(pct) {
    if (pct == null) return '#6b7280';
    if (pct >= 60)   return '#4ade80';
    if (pct >= 45)   return '#fbbf24';
    return '#f87171';
  }
</script>

{#if summaryStats}
  <div class="backdrop" role="presentation">
    <button class="backdrop-dismiss" aria-label="Close summary" on:click={() => dispatch('close')}></button>
    <div class="modal" role="dialog" aria-modal="true" tabindex="0" on:click|stopPropagation on:keydown|stopPropagation>

      <!-- Dark header matching app chrome -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-title">{title}</div>
          <div class="header-sub">{subtitle || `${summaryStats.total} kickouts in view`}</div>
        </div>
        <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">✕</button>
      </div>

      <div class="modal-body">

        <!-- Hero metric -->
        <div class="hero">
          <div class="hero-value" style="color:{retColor(summaryStats.retPct)}">
            {summaryStats.retPct}%
          </div>
          <div class="hero-label">Kickout Retention</div>
          {#if summaryStats.brTotal > 0}
            <div class="hero-sub">
              Break win rate: <strong>{summaryStats.brPct ?? '—'}%</strong>
              <span class="muted">({summaryStats.brTotal} breaks)</span>
            </div>
          {/if}
        </div>

        <!-- Half comparison -->
        <div class="half-row">
          <div class="half-card">
            <div class="half-label">First Half</div>
            <div class="half-n">{summaryStats.h1.total} kickouts</div>
            <div class="half-pct" style="color:{retColor(summaryStats.h1.retPct)}">
              {summaryStats.h1.retPct ?? '—'}%
            </div>
          </div>
          <div class="half-divider"></div>
          <div class="half-card">
            <div class="half-label">Second Half</div>
            <div class="half-n">{summaryStats.h2.total} kickouts</div>
            <div class="half-pct" style="color:{retColor(summaryStats.h2.retPct)}">
              {summaryStats.h2.retPct ?? '—'}%
            </div>
          </div>
        </div>

        <!-- Zone insights -->
        {#if summaryStats.best || summaryStats.worst}
          <div class="zone-row">
            {#if summaryStats.best}
              <div class="zone-card best">
                <div class="zone-icon">▲</div>
                <div class="zone-detail">
                  <div class="zone-title">Best Zone</div>
                  <div class="zone-val">{summaryStats.best}</div>
                </div>
              </div>
            {/if}
            {#if summaryStats.worst}
              <div class="zone-card worst">
                <div class="zone-icon">▼</div>
                <div class="zone-detail">
                  <div class="zone-title">Worst Zone</div>
                  <div class="zone-val">{summaryStats.worst}</div>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Top player -->
        {#if summaryStats.topPlayer}
          <div class="player-card">
            <div class="player-icon">#</div>
            <div class="player-detail">
              <div class="player-name">{summaryStats.topPlayer.label}</div>
              <div class="player-sub">
                Most targeted kickout option · {summaryStats.topPlayer.total} kickouts · {summaryStats.topPlayer.retPct}% retention
              </div>
            </div>
          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(2px);
  }
  .backdrop-dismiss {
    position: absolute; inset: 0; border: none; background: transparent; padding: 0; cursor: default;
  }
  .modal {
    position: relative;
    background: #fff; border-radius: 16px; width: 100%; max-width: 420px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.15);
    overflow: hidden;
  }

  /* Header — dark, matches app chrome */
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; background: #0f1923; gap: 12px;
  }
  .header-title {
    font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.02em;
  }
  .header-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
  .close-btn {
    padding: 6px 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
    border-radius: 7px; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 13px;
    font-family: inherit; font-weight: 600; transition: all 0.12s; line-height: 1;
  }
  .close-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }

  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 80svh; overflow-y: auto; }

  /* Hero */
  .hero {
    text-align: center; padding: 20px 16px 16px;
    background: #f8faf8; border-radius: 12px;
    border: 1px solid #e8eee6;
  }
  .hero-value {
    font-size: 56px; font-weight: 900; line-height: 1;
    font-variant-numeric: tabular-nums; letter-spacing: -0.04em;
  }
  .hero-label {
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af; margin-top: 6px;
  }
  .hero-sub {
    font-size: 13px; color: #6b7280; margin-top: 8px;
  }
  .hero-sub strong { color: #111827; font-weight: 700; }
  .muted { color: #9ca3af; }

  /* Half comparison */
  .half-row {
    display: flex; align-items: stretch; background: #f8faf8;
    border-radius: 12px; border: 1px solid #e8eee6; overflow: hidden;
  }
  .half-card {
    flex: 1; padding: 14px 16px; text-align: center;
  }
  .half-divider { width: 1px; background: #e8eee6; flex-shrink: 0; }
  .half-label {
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;
  }
  .half-n { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
  .half-pct {
    font-size: 28px; font-weight: 900; line-height: 1;
    font-variant-numeric: tabular-nums; letter-spacing: -0.03em;
  }

  /* Zones */
  .zone-row { display: flex; gap: 10px; }
  .zone-card {
    flex: 1; display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-radius: 10px;
  }
  .zone-card.best  { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .zone-card.worst { background: #fff7ed; border: 1px solid #fed7aa; }
  .zone-icon {
    font-size: 14px; font-weight: 900; flex-shrink: 0;
  }
  .zone-card.best  .zone-icon { color: #16a34a; }
  .zone-card.worst .zone-icon { color: #ea580c; }
  .zone-title {
    font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 2px;
  }
  .zone-val { font-size: 13px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }

  /* Top player */
  .player-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; background: #f8f5ff; border: 1px solid #e9d5ff; border-radius: 10px;
  }
  .player-icon {
    width: 36px; height: 36px; border-radius: 50%;
    background: #7c3aed; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 900; flex-shrink: 0;
  }
  .player-name { font-size: 14px; font-weight: 700; color: #111827; }
  .player-sub  { font-size: 12px; color: #6b7280; margin-top: 2px; }
</style>
